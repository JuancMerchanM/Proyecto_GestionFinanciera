import mongoose from 'mongoose';
import { HttpError } from '../middlewares/error.mjs';
import { Account } from '../models/account.mjs';

const TYPES = ['cash', 'bank', 'card', 'savings'];

export const TYPE_LABELS = { cash: 'Efectivo', bank: 'Banco', card: 'Tarjeta', savings: 'Ahorro' };

/**
 * Convierte una cuenta en su forma pública (JSON para la API).
 * `balanceMinor` es opcional: el saldo calculado cuando se conoce.
 */
export const toPublic = (a, balanceMinor = null) => ({
  id: a._id.toString(),
  name: a.name,
  type: a.type,
  typeLabel: TYPE_LABELS[a.type] ?? a.type,
  currency: a.currency,
  openingBalanceMinor: a.openingBalanceMinor ?? 0,
  balanceMinor,
  archived: a.archived ?? false,
  createdAt: a.createdAt,
});

const validate = ({ name, type, openingBalanceMinor, currency }, home) => {
  const errors = {};
  const clean = {};

  const n = typeof name === 'string' ? name.trim() : '';
  if (n.length < 2 || n.length > 40) errors.name = 'El nombre debe tener entre 2 y 40 caracteres';
  else clean.name = n;

  if (!TYPES.includes(type)) errors.type = 'Tipo inválido (cash|bank|card|savings)';
  else clean.type = type;

  const ob = openingBalanceMinor ?? 0;
  if (!Number.isSafeInteger(ob)) {
    errors.openingBalanceMinor = Number.isNaN(ob)
      ? 'Saldo inicial inválido'
      : 'El saldo inicial debe ser un entero en la unidad mínima (COP: 50000 = $50.000)';
  } else {
    clean.openingBalanceMinor = ob;
  }

  if (currency !== undefined && currency !== null && currency !== '') {
    if (currency !== home.currency) {
      errors.currency = `La moneda debe ser ${home.currency} (moneda del hogar)`;
    }
  }
  clean.currency = home.currency;

  if (Object.keys(errors).length) {
    throw new HttpError(400, 'Datos de cuenta inválidos', errors);
  }
  return clean;
};

const assertUniqueName = async (homeId, name, excludeId = null) => {
  const filter = {
    homeId,
    archived: false,
    name: { $regex: `^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' },
  };
  if (excludeId) filter._id = { $ne: excludeId };
  if (await Account.exists(filter)) {
    throw new HttpError(409, 'Ya existe una cuenta con ese nombre', {
      name: 'Ya existe una cuenta con ese nombre en este hogar',
    });
  }
};

// saldo = saldo inicial + ingresos − gastos (agregación sobre transacciones).
const computeBalances = async (homeId) => {
  const rows = await mongoose.connection
    .collection('transactions')
    .aggregate([
      { $match: { homeId } },
      {
        $group: {
          _id: { accountId: '$accountId', type: '$type' },
          total: { $sum: '$amountMinor' },
        },
      },
    ])
    .toArray();

  const map = new Map();
  for (const r of rows) {
    const key = r._id.accountId?.toString();
    if (!key) continue;
    const cur = map.get(key) ?? { income: 0, expense: 0 };
    if (r._id.type === 'income') cur.income += r.total;
    else if (r._id.type === 'expense') cur.expense += r.total;
    map.set(key, cur);
  }
  return map;
};

/**
 * Lista las cuentas del hogar con su saldo calculado desde movimientos.
 * `includeArchived` incluye también las archivadas.
 */
export const listAccounts = async (home, { includeArchived = false } = {}) => {
  const filter = { homeId: home._id };
  if (!includeArchived) filter.archived = false;
  const accounts = await Account.find(filter).sort({ type: 1, name: 1 }).lean();
  const balances = await computeBalances(home._id);
  return accounts.map((a) => {
    const b = balances.get(a._id.toString()) ?? { income: 0, expense: 0 };
    return toPublic(a, (a.openingBalanceMinor ?? 0) + b.income - b.expense);
  });
};

/**
 * Busca una cuenta por id dentro del hogar.
 * Lanza HttpError(404) si no existe o no pertenece al hogar.
 */
export const getAccount = async (homeId, accountId) => {
  if (!mongoose.Types.ObjectId.isValid(accountId)) {
    throw new HttpError(404, 'Cuenta no encontrada');
  }
  const account = await Account.findOne({ _id: accountId, homeId }).lean();
  if (!account) throw new HttpError(404, 'Cuenta no encontrada');
  return account;
};

/**
 * Calcula el saldo actual de una cuenta (saldo inicial + ingresos − gastos).
 * Devuelve el saldo en la unidad mínima.
 */
export const getBalance = async (account) => {
  const balances = await computeBalances(account.homeId);
  const b = balances.get(account._id.toString()) ?? { income: 0, expense: 0 };
  return (account.openingBalanceMinor ?? 0) + b.income - b.expense;
};

/**
 * Crea una cuenta validando datos y nombre único dentro del hogar.
 * Lanza HttpError(400) si los datos son inválidos o 409 si el nombre ya existe.
 */
export const createAccount = async (home, data) => {
  const clean = validate(data, home);
  await assertUniqueName(home._id, clean.name);
  const account = await Account.create({ ...clean, homeId: home._id, archived: false });
  return toPublic(account, clean.openingBalanceMinor);
};

/**
 * Actualiza nombre, tipo, saldo inicial y estado de archivado de una cuenta.
 * Lanza HttpError(400|404|409); devuelve la cuenta pública con saldo actualizado.
 */
export const updateAccount = async (home, accountId, data) => {
  const current = await getAccount(home._id, accountId);
  const merged = {
    name: data.name !== undefined ? data.name : current.name,
    type: data.type !== undefined ? data.type : current.type,
    openingBalanceMinor:
      data.openingBalanceMinor !== undefined ? data.openingBalanceMinor : current.openingBalanceMinor,
    currency: data.currency !== undefined ? data.currency : current.currency,
  };
  const clean = validate(merged, home);
  if (clean.name !== current.name) await assertUniqueName(home._id, clean.name, current._id);
  if (data.archived === true || data.archived === false) clean.archived = data.archived;

  await Account.updateOne({ _id: current._id }, { $set: clean });
  return toPublic({ ...current, ...clean }, await getBalance({ ...current, ...clean }));
};

/**
 * Elimina una cuenta; si tiene transacciones asociadas la archiva en su lugar.
 * Devuelve { mode: 'deleted'|'archived', message }.
 */
export const removeAccount = async (homeId, accountId) => {
  const current = await getAccount(homeId, accountId);
  const used = await mongoose.connection
    .collection('transactions')
    .countDocuments({ accountId: current._id });
  if (used > 0) {
    await Account.updateOne({ _id: current._id }, { $set: { archived: true } });
    return {
      mode: 'archived',
      message: `Cuenta archivada (tiene ${used} transacción(es) asociadas)`,
    };
  }
  await Account.deleteOne({ _id: current._id });
  return { mode: 'deleted', message: 'Cuenta eliminada' };
};

/**
 * Restaura una cuenta archivada y la devuelve en forma pública.
 * Lanza HttpError(404) si no existe.
 */
export const restoreAccount = async (homeId, accountId) => {
  const current = await getAccount(homeId, accountId);
  await Account.updateOne({ _id: current._id }, { $set: { archived: false } });
  return toPublic({ ...current, archived: false });
};
