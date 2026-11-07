import mongoose from 'mongoose';
import type { Types } from 'mongoose';
import { HttpError } from '../middlewares/error.ts';
import { Category } from '../models/category.ts';
import { User } from '../models/user.ts';
import type { IHome } from '../models/home.ts';
import * as accountService from './accountService.ts';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DAY = 86400000;

const parseDate = (s: unknown): Date | null => {
  if (typeof s !== 'string' || !DATE_RE.test(s)) return null;
  const d = new Date(`${s}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
};

const fmt = (d: Date): string => d.toISOString().slice(0, 10);
const addDays = (d: Date, n: number): Date => new Date(d.getTime() + n * DAY);

interface DateRange {
  start: Date;
  endExcl: Date;
}

const currentMonthRange = (): DateRange => {
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
export const parseRange = (query: Record<string, unknown>) => {
  const fromRaw = query.from ?? '';
  const toRaw = query.to ?? '';

  let start!: Date;
  let endExcl!: Date;

  if (fromRaw || toRaw) {
    const errors: Record<string, string> = {};
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

  const days = Math.round((endExcl.getTime() - start.getTime()) / DAY);
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

const totalsInRange = async (homeId: Types.ObjectId | string, start: Date, endExcl: Date) => {
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
const expensesByCategory = async (homeId: Types.ObjectId | string, start: Date, endExcl: Date) => {
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

  const catMap = new Map(categories.map((c) => [c._id.toString(), c] as const));
  const total = rows.reduce((s: number, r) => s + r.total, 0);

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
export const summary = async (home: IHome, query: Record<string, unknown> = {}) => {
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

// ===== Serie temporal (gráficos de línea y barras por persona) =====

type Granularity = 'daily' | 'weekly' | 'monthly';

const OBJECT_ID_RE = /^[0-9a-fA-F]{24}$/;
const WEEK = 7 * DAY;

const pad2 = (n: number): string => String(n).padStart(2, '0');

/** Granularidad adaptativa: ≤31 días diaria, ≤180 semanal, más allá mensual. */
const granularityFor = (days: number): Granularity =>
  days <= 31 ? 'daily' : days <= 180 ? 'weekly' : 'monthly';

interface Bucket {
  key: string;
  label: string;
  incomeMinor: number;
  expenseMinor: number;
}

const dayLabel = (d: Date): string => `${pad2(d.getUTCDate())}/${pad2(d.getUTCMonth() + 1)}`;

/**
 * Construye los intervalos del rango (todos presentes, aunque estén en cero):
 * diarios, semanales desde el inicio del rango o mensuales calendario
 * recortados al rango.
 */
const buildBuckets = (start: Date, endExcl: Date, granularity: Granularity): Bucket[] => {
  const buckets: Bucket[] = [];
  const push = (key: string, label: string, bStart: Date, bEnd: Date) => {
    if (bStart < bEnd) buckets.push({ key, label, incomeMinor: 0, expenseMinor: 0 });
  };

  if (granularity === 'daily') {
    for (let d = start; d < endExcl; d = addDays(d, 1)) push(fmt(d), dayLabel(d), d, addDays(d, 1));
  } else if (granularity === 'weekly') {
    for (let d = start; d < endExcl; d = addDays(d, 7)) {
      const next = addDays(d, 7);
      push(fmt(d), dayLabel(d), d, next < endExcl ? next : endExcl);
    }
  } else {
    const last = addDays(endExcl, -1);
    let y = start.getUTCFullYear();
    let m = start.getUTCMonth();
    while (y < last.getUTCFullYear() || (y === last.getUTCFullYear() && m <= last.getUTCMonth())) {
      const monthStart = new Date(Date.UTC(y, m, 1));
      const monthEnd = new Date(Date.UTC(y, m + 1, 1));
      push(`${y}-${pad2(m + 1)}`, `${pad2(m + 1)}/${y}`, monthStart > start ? monthStart : start, monthEnd < endExcl ? monthEnd : endExcl);
      m += 1;
      if (m > 11) {
        m = 0;
        y += 1;
      }
    }
  }
  return buckets;
};

/** Índice del intervalo que contiene al día (aritmético, O(1)). */
const bucketIndexFor = (dayStr: string, start: Date, granularity: Granularity): number => {
  const day = new Date(`${dayStr}T00:00:00Z`);
  const delta = day.getTime() - start.getTime();
  if (granularity === 'daily') return Math.floor(delta / DAY);
  if (granularity === 'weekly') return Math.floor(delta / WEEK);
  return (day.getUTCFullYear() - start.getUTCFullYear()) * 12 + (day.getUTCMonth() - start.getUTCMonth());
};

export interface TimelineContext {
  /** Usuario autenticado (para forzar el filtro propio en miembros). */
  userId: Types.ObjectId | string;
  /** ¿Es admin del hogar? (admin ve a todos, miembro solo lo suyo). */
  isAdmin: boolean;
}

/**
 * Serie temporal de ingresos/gastos del rango con granularidad adaptativa y
 * totales por persona. Reglas de visibilidad:
 * - admin: ve todo el hogar y puede filtrar por cualquier `userId`;
 * - miembro: siempre lo suyo; si pide `userId` de otro → HttpError(403);
 * - `userId` mal formado → HttpError(400).
 * Los intervalos se devuelven completos (rellenados en cero) para graficar.
 */
export const timeline = async (
  home: IHome,
  query: Record<string, unknown> = {},
  ctx: TimelineContext
) => {
  const range = parseRange(query);
  const granularity = granularityFor(range.days);

  const rawUserId = query.userId ?? '';
  let filterUserId: string | null = null;
  if (rawUserId) {
    if (typeof rawUserId !== 'string' || !OBJECT_ID_RE.test(rawUserId)) {
      throw new HttpError(400, 'Filtro de usuario inválido', { userId: 'Debe ser un id de usuario válido' });
    }
    if (!ctx.isAdmin && rawUserId.toLowerCase() !== String(ctx.userId).toLowerCase()) {
      throw new HttpError(403, 'No puede ver datos de otro usuario');
    }
    filterUserId = rawUserId.toLowerCase();
  } else if (!ctx.isAdmin) {
    filterUserId = String(ctx.userId);
  }

  const match: Record<string, unknown> = {
    homeId: home._id,
    date: { $gte: range.start, $lt: range.endExcl },
  };
  if (filterUserId) match.userId = new mongoose.Types.ObjectId(filterUserId);

  const [dayRows, userTotals] = await Promise.all([
    mongoose.connection
      .collection('transactions')
      .aggregate([
        { $match: match },
        {
          $group: {
            _id: { day: { $dateToString: { format: '%Y-%m-%d', date: '$date' } }, type: '$type' },
            total: { $sum: '$amountMinor' },
          },
        },
      ])
      .toArray(),
    mongoose.connection
      .collection('transactions')
      .aggregate([
        { $match: match },
        {
          $group: {
            _id: '$userId',
            income: { $sum: { $cond: [{ $eq: ['$type', 'income'] }, '$amountMinor', 0] } },
            expense: { $sum: { $cond: [{ $eq: ['$type', 'expense'] }, '$amountMinor', 0] } },
          },
        },
      ])
      .toArray(),
  ]);

  // Distribución de los totales por día hacia sus intervalos.
  const buckets = buildBuckets(range.start, range.endExcl, granularity);
  for (const row of dayRows) {
    const idx = bucketIndexFor(row._id.day as string, range.start, granularity);
    if (idx < 0 || idx >= buckets.length) continue;
    if (row._id.type === 'income') buckets[idx].incomeMinor += row.total as number;
    else if (row._id.type === 'expense') buckets[idx].expenseMinor += row.total as number;
  }

  // Por persona: el filtro acota la lista (miembro → solo él; admin → todos
  // los miembros del hogar, o el usuario exacto si filtró).
  const targetIds = filterUserId ? [filterUserId] : home.members.map((m) => m.userId.toString());
  const totalsByUser = new Map(userTotals.map((r) => [String(r._id), r] as const));
  const memberNames = await User.find({ _id: { $in: home.members.map((m) => m.userId) } })
    .select('name')
    .lean();
  const nameById = new Map(memberNames.map((u) => [u._id.toString(), u.name] as const));

  const byMember = targetIds.map((id) => {
    const t = totalsByUser.get(id);
    return {
      userId: id,
      // Solo se resuelven nombres de miembros del hogar (evita filtrar
      // existencia/nombres de usuarios ajenos).
      name: nameById.get(id) ?? '(no es miembro del hogar)',
      incomeMinor: t?.income ?? 0,
      expenseMinor: t?.expense ?? 0,
    };
  });

  return {
    currency: home.currency,
    range: { from: range.fromStr, to: range.toStr, days: range.days, granularity },
    filter: { userId: filterUserId },
    timeline: buckets.map(({ key, label, incomeMinor, expenseMinor }) => ({
      key,
      label,
      incomeMinor,
      expenseMinor,
    })),
    byMember,
  };
};
