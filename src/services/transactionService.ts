import mongoose from 'mongoose';
import type { QueryFilter, Types } from 'mongoose';
import { HttpError } from '../middlewares/error.ts';
import { Transaction } from '../models/transaction.ts';
import type { ITransaction } from '../models/transaction.ts';
import { Category, MovementType } from '../models/category.ts';
import type { ICategory } from '../models/category.ts';
import { Account } from '../models/account.ts';
import type { IAccount } from '../models/account.ts';
import { User } from '../models/user.ts';
import type { IUser } from '../models/user.ts';
import type { Currency } from '../models/home.ts';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MOVEMENT_VALUES: string[] = Object.values(MovementType);

const parseDate = (value: unknown): Date | null => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === 'string' && DATE_RE.test(value)) {
    const d = new Date(`${value}T00:00:00Z`);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return null;
};

/**
 * Convierte una Date a string YYYY-MM-DD (devuelve el valor si no es Date).
 */
export function toDateString(d: Date): string;
export function toDateString(d: unknown): unknown;
export function toDateString(d: unknown): unknown {
  return d instanceof Date ? d.toISOString().slice(0, 10) : d;
}

interface TransactionInput {
  amountMinor?: unknown;
  type?: unknown;
  date?: unknown;
  note?: unknown;
  accountId?: unknown;
  categoryId?: unknown;
}

interface CleanTransaction {
  amountMinor: number;
  type: MovementType;
  date: Date;
  note: string;
  accountId: Types.ObjectId;
  categoryId: Types.ObjectId;
}

const validate = async (home: IHomeLike, data: TransactionInput): Promise<CleanTransaction> => {
  const errors: Record<string, string> = {};
  const clean = {} as Partial<CleanTransaction>;

  const amount = data.amountMinor;
  if (!Number.isSafeInteger(amount) || (amount as number) <= 0) {
    errors.amountMinor = Number.isNaN(amount as number)
      ? 'Ingrese un monto válido mayor a 0'
      : 'El monto debe ser un entero mayor a 0 en la unidad mínima';
  } else {
    clean.amountMinor = amount as number;
  }

  if (!MOVEMENT_VALUES.includes(data.type as string)) {
    errors.type = 'Tipo inválido (income|expense)';
  } else {
    clean.type = data.type as MovementType;
  }

  const date = parseDate(data.date);
  if (!date) errors.date = 'Fecha inválida (use YYYY-MM-DD)';
  else clean.date = date;

  if (data.note != null && String(data.note).length > 200) {
    errors.note = 'La nota no puede superar 200 caracteres';
  } else {
    clean.note = data.note != null ? String(data.note).trim() : '';
  }

  if (!mongoose.Types.ObjectId.isValid(data.accountId as string)) {
    errors.accountId = 'Cuenta inválida';
  }
  if (!mongoose.Types.ObjectId.isValid(data.categoryId as string)) {
    errors.categoryId = 'Categoría inválida';
  }

  if (Object.keys(errors).length) {
    throw new HttpError(400, 'Transacción inválida', errors);
  }

  const [account, category] = await Promise.all([
    Account.findByIdForHome(data.accountId as string, home._id),
    Category.findByIdForHome(data.categoryId as string, home._id),
  ]);
  const relErrors: Record<string, string> = {};
  if (!account) relErrors.accountId = 'La cuenta no pertenece a este hogar';
  else if (account.archived) relErrors.accountId = 'La cuenta está archivada';
  if (!category) relErrors.categoryId = 'La categoría no pertenece a este hogar';
  else if (category.archived) relErrors.categoryId = 'La categoría está archivada';
  else if (clean.type && category.type !== clean.type) {
    relErrors.categoryId = `La categoría es de tipo ${category.type} y la transacción es ${clean.type}`;
  }
  if (Object.keys(relErrors).length || !account || !category) {
    throw new HttpError(400, 'Transacción inválida', relErrors);
  }

  clean.accountId = account._id;
  clean.categoryId = category._id;
  return clean as CleanTransaction;
};

/** Hogar mínimo que necesita el servicio (evita ciclos de imports). */
interface IHomeLike {
  _id: Types.ObjectId;
  currency: Currency;
}

/**
 * Crea una transacción validada (montos, fechas y pertenencia al hogar).
 * Lanza HttpError(400) si los datos o las relaciones no son válidos.
 */
export const createTransaction = async (
  home: IHomeLike,
  user: Pick<IUser, '_id'>,
  data: TransactionInput
) => {
  const clean = await validate(home, data);
  const tx = await Transaction.create({
    ...clean,
    homeId: home._id,
    userId: user._id,
    currency: home.currency,
  });
  return tx;
};

/**
 * Busca una transacción por id dentro del hogar.
 * Lanza HttpError(404) si no existe.
 */
export const getTransaction = async (
  homeId: Types.ObjectId | string,
  txId: Types.ObjectId | string
): Promise<ITransaction> => {
  if (!mongoose.Types.ObjectId.isValid(txId)) throw new HttpError(404, 'Transacción no encontrada');
  const tx = await Transaction.findByIdForHome(txId, homeId);
  if (!tx) throw new HttpError(404, 'Transacción no encontrada');
  return tx;
};

/**
 * Indica si un usuario puede modificar una transacción: el admin del hogar
 * cualquier una; el miembro solo las propias.
 */
export const canModify = (
  tx: ITransaction,
  user: Pick<IUser, '_id'>,
  homeRole: string | null | undefined
): boolean => homeRole === 'admin' || (tx.userId != null && tx.userId.toString() === user._id.toString());

const assertCanModify = (
  tx: ITransaction,
  user: Pick<IUser, '_id'>,
  homeRole: string | null | undefined
): void => {
  if (!canModify(tx, user, homeRole)) {
    throw new HttpError(403, 'Solo puede modificar sus propias transacciones');
  }
};

/**
 * Actualiza una transacción si el usuario tiene permiso sobre ella.
 * Lanza HttpError(400|403|404); devuelve la transacción actualizada.
 */
export const updateTransaction = async (
  home: IHomeLike,
  txId: Types.ObjectId | string,
  data: TransactionInput,
  user: Pick<IUser, '_id'>,
  homeRole: string | null | undefined
) => {
  const current = await getTransaction(home._id, txId);
  assertCanModify(current, user, homeRole);
  const merged: TransactionInput = {
    amountMinor: data.amountMinor !== undefined ? data.amountMinor : current.amountMinor,
    type: data.type !== undefined ? data.type : current.type,
    date: data.date !== undefined ? data.date : toDateString(current.date),
    note: data.note !== undefined ? data.note : current.note,
    accountId: data.accountId !== undefined ? data.accountId : current.accountId.toString(),
    categoryId: data.categoryId !== undefined ? data.categoryId : current.categoryId.toString(),
  };
  const clean = await validate(home, merged);
  await Transaction.updateOne({ _id: current._id }, { $set: clean });
  return getTransaction(home._id, txId);
};

/**
 * Elimina una transacción si el usuario tiene permiso sobre ella.
 * Lanza HttpError(403|404); devuelve el documento eliminado.
 */
export const deleteTransaction = async (
  home: IHomeLike,
  txId: Types.ObjectId | string,
  user: Pick<IUser, '_id'>,
  homeRole: string | null | undefined
) => {
  const current = await getTransaction(home._id, txId);
  assertCanModify(current, user, homeRole);
  await Transaction.deleteOne({ _id: current._id });
  return current;
};

/**
 * Lista transacciones del hogar con filtros (tipo, categoría, cuenta, rango)
 * y paginación. Solo el admin ve movimientos de todos los miembros.
 */
export const listTransactions = async (
  home: IHomeLike,
  query: Record<string, unknown> = {},
  user: IUser | null = null
) => {
  const filter: QueryFilter<ITransaction> = { homeId: home._id };

  if (query.type && MOVEMENT_VALUES.includes(query.type as string)) {
    filter.type = query.type as MovementType;
  }
  if (query.categoryId && mongoose.Types.ObjectId.isValid(query.categoryId as string)) {
    filter.categoryId = new mongoose.Types.ObjectId(query.categoryId as string);
  }
  if (query.accountId && mongoose.Types.ObjectId.isValid(query.accountId as string)) {
    filter.accountId = new mongoose.Types.ObjectId(query.accountId as string);
  }
  if (query.userId && mongoose.Types.ObjectId.isValid(query.userId as string)) {
    filter.userId = new mongoose.Types.ObjectId(query.userId as string);
  }
  if (query.mine === 'true' || query.mine === '1') {
    if (!user) throw new HttpError(400, 'Filtro mine requiere usuario');
    filter.userId = user._id;
  }

  const from = query.from ? parseDate(query.from) : null;
  const to = query.to ? parseDate(query.to) : null;
  if (query.from && !from) throw new HttpError(400, 'Fecha desde inválida (YYYY-MM-DD)');
  if (query.to && !to) throw new HttpError(400, 'Fecha hasta inválida (YYYY-MM-DD)');
  if (from && to && from > to) throw new HttpError(400, 'Rango de fechas inválido (desde > hasta)');
  if (from || to) {
    const range: { $gte?: Date; $lt?: Date } = {};
    if (from) range.$gte = from;
    if (to) range.$lt = new Date(to.getTime() + 86400000); // inclusive de "hasta"
    filter.date = range;
  }

  const page = Math.max(1, parseInt(query.page as string, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit as string, 10) || 20));

  const [total, docs] = await Promise.all([
    Transaction.countDocuments(filter),
    Transaction.find(filter)
      .sort({ date: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
  ]);

  const [categories, accounts, users] = await Promise.all([
    Category.find({ homeId: home._id })
      .select('name color type archived')
      .lean(),
    Account.find({ homeId: home._id })
      .select('name type archived')
      .lean(),
    User.find({
      _id: { $in: docs.map((d) => d.userId).filter((id): id is Types.ObjectId => id != null) },
    })
      .select('name')
      .lean(),
  ]);
  const catMap = new Map(categories.map((c) => [c._id.toString(), c] as const));
  const accMap = new Map(accounts.map((a) => [a._id.toString(), a] as const));
  const userMap = new Map(users.map((u) => [u._id.toString(), u] as const));

  const data = docs.map((tx) => toPublic(tx, catMap, accMap, userMap));
  return {
    data,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      hasNext: page * limit < total,
      hasPrev: page > 1,
    },
  };
};

/**
 * Convierte una transacción en su forma pública enriquecida con maps
 * opcionales de categoría, cuenta y usuario.
 */
export const toPublic = (
  tx: ITransaction,
  catMap: Map<string, ICategory> = new Map(),
  accMap: Map<string, IAccount> = new Map(),
  userMap: Map<string, IUser> = new Map()
) => {
  const cat = catMap.get(tx.categoryId?.toString());
  const acc = accMap.get(tx.accountId?.toString());
  const usr = tx.userId ? userMap.get(tx.userId.toString()) : null;
  return {
    id: tx._id.toString(),
    type: tx.type,
    amountMinor: tx.amountMinor,
    currency: tx.currency,
    date: toDateString(tx.date),
    note: tx.note ?? '',
    accountId: tx.accountId?.toString(),
    account: acc ? { id: acc._id.toString(), name: acc.name, type: acc.type } : null,
    categoryId: tx.categoryId?.toString(),
    category: cat
      ? { id: cat._id.toString(), name: cat.name, color: cat.color, type: cat.type }
      : null,
    userId: tx.userId?.toString() ?? null,
    user: usr ? { id: usr._id.toString(), name: usr.name } : null,
    createdAt: tx.createdAt,
    updatedAt: tx.updatedAt,
  };
};

/**
 * Devuelve una transacción suelta en forma pública (detalle/edición),
 * resolviendo categoría, cuenta y usuario en una sola consulta.
 */
export const publicOne = async (tx: ITransaction) => {
  const [cat, acc, usr] = await Promise.all([
    Category.findById(tx.categoryId).select('name color type').lean(),
    Account.findById(tx.accountId).select('name type').lean(),
    tx.userId ? User.findById(tx.userId).select('name').lean() : Promise.resolve(null),
  ]);
  const c2 = new Map<string, ICategory>(cat ? [[cat._id.toString(), cat]] : []);
  const a2 = new Map<string, IAccount>(acc ? [[acc._id.toString(), acc]] : []);
  const u2 = new Map<string, IUser>(usr ? [[usr._id.toString(), usr]] : []);
  return toPublic(tx, c2, a2, u2);
};
