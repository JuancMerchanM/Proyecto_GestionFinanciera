import mongoose from 'mongoose';
import { HttpError } from '../middlewares/error.mjs';
import { Category } from '../models/category.mjs';
import * as accountService from './accountService.mjs';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DAY = 86400000;

const parseDate = (s) => {
  if (typeof s !== 'string' || !DATE_RE.test(s)) return null;
  const d = new Date(`${s}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
};

const fmt = (d) => d.toISOString().slice(0, 10);
const addDays = (d, n) => new Date(d.getTime() + n * DAY);

const currentMonthRange = () => {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const endExcl = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { start, endExcl };
};

/**
 * Resuelve el rango de fechas de un reporte a partir de query (from/to, YYYY-MM-DD).
 * Si se envía uno se exigen ambos; por defecto es el mes en curso (UTC). Incluye
 * el periodo anterior de igual duración. Lanza HttpError(400) si el rango es inválido.
 */
export const parseRange = (query) => {
  const fromRaw = query.from ?? '';
  const toRaw = query.to ?? '';

  let start;
  let endExcl;

  if (fromRaw || toRaw) {
    const errors = {};
    if (!fromRaw) errors.from = 'Falta from (YYYY-MM-DD)';
    else {
      const d = parseDate(fromRaw);
      if (!d) errors.from = 'Fecha inválida (formato YYYY-MM-DD)';
      else start = d;
    }
    if (!toRaw) errors.to = 'Falta to (YYYY-MM-DD)';
    else {
      const d = parseDate(toRaw);
      if (!d) errors.to = 'Fecha inválida (formato YYYY-MM-DD)';
      else endExcl = addDays(d, 1);
    }
    if (!Object.keys(errors).length && start >= endExcl) {
      errors.from = 'El rango debe tener from anterior a to';
    }
    if (Object.keys(errors).length) {
      throw new HttpError(400, 'Rango de fechas inválido', errors);
    }
  } else {
    ({ start, endExcl } = currentMonthRange());
  }

  const days = Math.round((endExcl - start) / DAY);
  // Mes completo (desde el día 1 hasta el día 1 del mes siguiente) → mes calendario
  // anterior; en cualquier otro caso, ventana de igual duración inmediatamente previa.
  const isFullMonth =
    start.getUTCDate() === 1 &&
    endExcl.getTime() === Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1);
  const prevEndExcl = start;
  const prevStart = isFullMonth
    ? new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() - 1, 1))
    : addDays(prevEndExcl, -days);

  return {
    start,
    endExcl,
    fromStr: fmt(start),
    toStr: fmt(addDays(endExcl, -1)),
    days,
    prev: {
      start: prevStart,
      endExcl: prevEndExcl,
      fromStr: fmt(prevStart),
      toStr: fmt(addDays(prevEndExcl, -1)),
    },
  };
};

const totalsInRange = async (homeId, start, endExcl) => {
  const rows = await mongoose.connection
    .collection('transactions')
    .aggregate([
      { $match: { homeId, date: { $gte: start, $lt: endExcl } } },
      { $group: { _id: '$type', total: { $sum: '$amountMinor' } } },
    ])
    .toArray();

  let incomeMinor = 0;
  let expenseMinor = 0;
  for (const r of rows) {
    if (r._id === 'income') incomeMinor += r.total;
    else expenseMinor += r.total;
  }
  return { incomeMinor, expenseMinor, netMinor: incomeMinor - expenseMinor };
};

// gastos del rango agrupados por categoría (para el donut).
const expensesByCategory = async (homeId, start, endExcl) => {
  const [rows, categories] = await Promise.all([
    mongoose.connection
      .collection('transactions')
      .aggregate([
        { $match: { homeId, type: 'expense', date: { $gte: start, $lt: endExcl } } },
        { $group: { _id: '$categoryId', total: { $sum: '$amountMinor' } } },
        { $sort: { total: -1 } },
      ])
      .toArray(),
    Category.find({ homeId }).lean(),
  ]);

  const catMap = new Map(categories.map((c) => [c._id.toString(), c]));
  const total = rows.reduce((s, r) => s + r.total, 0);

  return rows.map((r) => {
    const cat = r._id ? catMap.get(r._id.toString()) : null;
    return {
      categoryId: r._id ? r._id.toString() : null,
      category: cat
        ? { id: cat._id.toString(), name: cat.name, color: cat.color }
        : null,
      label: cat ? cat.name : '(sin categoría)',
      amountMinor: r.total,
      percent: total > 0 ? Math.floor((r.total * 100) / total) : 0,
    };
  });
};

/**
 * Resumen del dashboard: balance total, ingresos/gastos/neto del rango,
 * comparación con el periodo anterior y gastos por categoría.
 */
export const summary = async (home, query = {}) => {
  const range = parseRange(query);

  const [current, previous, byCategory, accounts] = await Promise.all([
    totalsInRange(home._id, range.start, range.endExcl),
    totalsInRange(home._id, range.prev.start, range.prev.endExcl),
    expensesByCategory(home._id, range.start, range.endExcl),
    accountService.listAccounts(home),
  ]);

  const balanceMinor = accounts.reduce((s, a) => s + (a.balanceMinor ?? 0), 0);

  return {
    currency: home.currency,
    range: { from: range.fromStr, to: range.toStr, days: range.days },
    previous: {
      from: range.prev.fromStr,
      to: range.prev.toStr,
      ...previous,
    },
    balanceMinor,
    ...current,
    expensesByCategory: byCategory,
  };
};
