import mongoose from 'mongoose';
import type { QueryFilter, Types } from 'mongoose';
import { HttpError } from '../middlewares/error.ts';
import { Budget } from '../models/budget.ts';
import type { IBudget } from '../models/budget.ts';
import { Category, MovementType } from '../models/category.ts';
import type { ICategory } from '../models/category.ts';
import type { Currency, IHome } from '../models/home.ts';

export const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

const monthError = (m: unknown): string | null =>
  typeof m !== 'string' || !MONTH_RE.test(m)
    ? 'El mes debe tener formato YYYY-MM con mes entre 01 y 12'
    : null;

interface BudgetInput {
  month?: unknown;
  categoryId?: unknown;
  limitMinor?: unknown;
}

interface CleanBudget {
  month: string;
  limitMinor: number;
  categoryId: Types.ObjectId;
  homeId: Types.ObjectId;
  currency: Currency;
}

/**
 * Convierte un presupuesto en su forma pública con consumo calculado.
 * Calcula percent (floor), exceeded y overMinor a partir de `spentMinor`.
 */
export const toPublic = (
  b: IBudget,
  { category = null, spentMinor = 0 }: { category?: ICategory | null; spentMinor?: number } = {}
) => ({
  id: b._id.toString(),
  homeId: b.homeId?.toString(),
  categoryId: b.categoryId.toString(),
  category: category
    ? {
        id: category._id.toString(),
        name: category.name,
        color: category.color,
        type: category.type,
      }
    : null,
  month: b.month,
  limitMinor: b.limitMinor,
  currency: b.currency,
  spentMinor,
  // % consumido (entero hacia abajo; 350000/300000 → 116)
  percent: b.limitMinor > 0 ? Math.floor((spentMinor * 100) / b.limitMinor) : 0,
  exceeded: spentMinor > b.limitMinor,
  overMinor: Math.max(spentMinor - b.limitMinor, 0),
  createdAt: b.createdAt,
  updatedAt: b.updatedAt,
});

const validate = async (
  data: BudgetInput,
  home: IHome,
  excludeId: Types.ObjectId | null = null
): Promise<CleanBudget> => {
  const errors: Record<string, string> = {};
  const clean = {} as Partial<CleanBudget>;

  const mErr = monthError(data.month);
  if (mErr) errors.month = mErr;
  else clean.month = data.month as string;

  const limit = data.limitMinor;
  if (!Number.isSafeInteger(limit)) {
    errors.limitMinor = Number.isNaN(limit as number)
      ? 'Límite inválido'
      : 'El límite debe ser un entero en la unidad mínima (COP: 300000 = $300.000)';
  } else if ((limit as number) < 1) {
    errors.limitMinor = 'El límite debe ser mayor a 0';
  } else {
    clean.limitMinor = limit as number;
  }

  if (!mongoose.Types.ObjectId.isValid(data.categoryId as string)) {
    errors.categoryId = 'Categoría inválida';
  } else {
    const cat = await Category.findByIdForHome(
      data.categoryId as string,
      home._id
    );
    if (!cat) errors.categoryId = 'La categoría no pertenece al hogar';
    else if (cat.type !== MovementType.Expense)
      errors.categoryId = 'Solo se pueden presupuestar categorías de gasto';
    else if (cat.archived) errors.categoryId = 'La categoría está archivada';
    else clean.categoryId = cat._id;
  }

  if (Object.keys(errors).length) {
    throw new HttpError(400, 'Presupuesto inválido', errors);
  }

  clean.homeId = home._id;
  clean.currency = home.currency;

  const dupe = await Budget.findForMonth(
    home._id,
    clean.categoryId as Types.ObjectId,
    clean.month as string,
    excludeId
  );
  if (dupe) {
    throw new HttpError(409, 'Presupuesto duplicado', {
      month: 'Ya existe un presupuesto para esta categoría en este mes',
    });
  }
  return clean as CleanBudget;
};

// consumo = gastos del mes por categoría (agregación sobre transacciones).
const computeSpent = async (homeId: Types.ObjectId | string): Promise<Map<string, number>> => {
  const rows = await mongoose.connection
    .collection('transactions')
    .aggregate([
      { $match: { homeId, type: 'expense' } },
      {
        $group: {
          _id: {
            categoryId: '$categoryId',
            month: { $dateToString: { format: '%Y-%m', date: '$date' } },
          },
          spent: { $sum: '$amountMinor' },
        },
      },
    ])
    .toArray();

  const map = new Map<string, number>();
  for (const r of rows) {
    const cat = r._id.categoryId?.toString();
    if (!cat || !r._id.month) continue;
    map.set(`${cat}|${r._id.month}`, r.spent);
  }
  return map;
};

/**
 * Lista los presupuestos del hogar (opcionalmente de un mes) con consumo y categoría.
 * Lanza HttpError(400) si el filtro de mes es inválido.
 */
export const listBudgets = async (
  home: IHome,
  { month = null }: { month?: string | null } = {}
) => {
  if (month !== null && month !== undefined && month !== '') {
    const mErr = monthError(month);
    if (mErr) throw new HttpError(400, 'Filtros inválidos', { month: mErr });
  }
  const filter: QueryFilter<IBudget> = { homeId: home._id };
  if (month) filter.month = month;

  const [budgets, categories, spent] = await Promise.all([
    Budget.find(filter).sort({ month: -1, categoryId: 1 }).lean(),
    Category.find({ homeId: home._id }).lean(),
    computeSpent(home._id),
  ]);
  const catMap = new Map(categories.map((c) => [c._id.toString(), c]));

  return budgets.map((b) => {
    const catId = b.categoryId.toString();
    return toPublic(b, {
      category: catMap.get(catId) ?? null,
      spentMinor: spent.get(`${catId}|${b.month}`) ?? 0,
    });
  });
};

/**
 * Busca un presupuesto por id dentro del hogar.
 * Lanza HttpError(404) si no existe.
 */
export const getBudget = async (
  homeId: Types.ObjectId | string,
  budgetId: Types.ObjectId | string
): Promise<IBudget> => {
  if (!mongoose.Types.ObjectId.isValid(budgetId)) {
    throw new HttpError(404, 'Presupuesto no encontrado');
  }
  const budget = await Budget.findByIdForHome(budgetId, homeId);
  if (!budget) throw new HttpError(404, 'Presupuesto no encontrado');
  return budget;
};

/**
 * Devuelve un presupuesto público con consumo y categoría resueltos.
 * Lanza HttpError(404) si no existe.
 */
export const getBudgetWithUsage = async (home: IHome, budgetId: Types.ObjectId | string) => {
  const budget = await getBudget(home._id, budgetId);
  const cat = await Category.findByIdForHome(budget.categoryId, home._id);
  const spent = await computeSpent(home._id);
  return toPublic(budget, {
    category: cat,
    spentMinor: spent.get(`${budget.categoryId.toString()}|${budget.month}`) ?? 0,
  });
};

const withUsage = async (home: IHome, budget: IBudget) => {
  const [cat, spent] = await Promise.all([
    Category.findByIdForHome(budget.categoryId, home._id),
    computeSpent(home._id),
  ]);
  return toPublic(budget, {
    category: cat,
    spentMinor: spent.get(`${budget.categoryId.toString()}|${budget.month}`) ?? 0,
  });
};

/**
 * Crea un presupuesto mensual por categoría de gasto del hogar.
 * Lanza HttpError(400) si los datos son inválidos o 409 si ya existe en ese mes.
 */
export const createBudget = async (home: IHome, data: BudgetInput) => {
  const clean = await validate(data, home);
  try {
    const budget = await Budget.create(clean);
    return await withUsage(home, budget.toObject() as IBudget);
  } catch (err) {
    if ((err as { code?: number } | null)?.code === 11000) {
      throw new HttpError(409, 'Presupuesto duplicado', {
        month: 'Ya existe un presupuesto para esta categoría en este mes',
      });
    }
    throw err;
  }
};

/**
 * Actualiza mes, categoría o límite de un presupuesto existente.
 * Lanza HttpError(400|404|409); devuelve el presupuesto público con consumo.
 */
export const updateBudget = async (
  home: IHome,
  budgetId: Types.ObjectId | string,
  data: BudgetInput
) => {
  const current = await getBudget(home._id, budgetId);
  const merged: BudgetInput = {
    month: data.month !== undefined ? data.month : current.month,
    categoryId: data.categoryId !== undefined ? data.categoryId : current.categoryId,
    limitMinor: data.limitMinor !== undefined ? data.limitMinor : current.limitMinor,
  };
  const clean = await validate(merged, home, current._id);
  await Budget.updateOne({ _id: current._id }, { $set: clean });
  return await withUsage(home, { ...current, ...clean });
};

/**
 * Elimina un presupuesto del hogar.
 * Lanza HttpError(404) si no existe; devuelve { mode, message }.
 */
export const removeBudget = async (
  homeId: Types.ObjectId | string,
  budgetId: Types.ObjectId | string
): Promise<{ mode: 'deleted'; message: string }> => {
  const current = await getBudget(homeId, budgetId);
  await Budget.deleteOne({ _id: current._id });
  return { mode: 'deleted', message: 'Presupuesto eliminado' };
};
