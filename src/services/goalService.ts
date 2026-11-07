import mongoose from 'mongoose';
import type { Types } from 'mongoose';
import { HttpError } from '../middlewares/error.ts';
import { Goal } from '../models/goal.ts';
import type { IContribution, IGoal } from '../models/goal.ts';
import type { IHome } from '../models/home.ts';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const COLOR_RE = /^#[0-9a-fA-F]{6}$/;

interface GoalInput {
  name?: unknown;
  targetMinor?: unknown;
  color?: unknown;
  deadline?: unknown;
  archived?: unknown;
}

interface ContributionInput {
  amountMinor?: unknown;
  date?: unknown;
  note?: unknown;
}

interface CleanGoal {
  name: string;
  targetMinor: number;
  color: string | null;
  deadline: Date | null;
  archived: boolean;
}

/** Devuelve la fecha, `null` si está vacía o `undefined` si es inválida. */
const parseDate = (value: unknown): Date | null | undefined => {
  if (value == null || value === '') return null;
  if (typeof value === 'string' && DATE_RE.test(value)) {
    const d = new Date(`${value}T00:00:00Z`);
    return Number.isNaN(d.getTime()) ? undefined : d;
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  return undefined;
};

/** Ahorro total = suma de aportes (fuente única de verdad, sin campo guardado). */
export const savedOf = (goal: Pick<IGoal, 'contributions'>): number =>
  goal.contributions.reduce((s, c) => s + c.amountMinor, 0);

/** Forma pública de la meta con progreso derivado (ahorro, % y estado). */
export const toPublic = (g: IGoal, currency: string) => {
  const savedMinor = savedOf(g);
  const percent =
    g.targetMinor > 0 ? Math.min(Math.floor((savedMinor * 100) / g.targetMinor), 100) : 0;
  return {
    id: g._id.toString(),
    homeId: g.homeId?.toString(),
    name: g.name,
    targetMinor: g.targetMinor,
    savedMinor,
    percent,
    // estado derivado, no guardado
    status: savedMinor >= g.targetMinor ? 'completed' : 'active',
    color: g.color,
    deadline: g.deadline ? g.deadline.toISOString().slice(0, 10) : null,
    archived: g.archived,
    createdBy: g.createdBy?.toString(),
    currency,
    contributions: g.contributions.map((c) => ({
      id: c._id.toString(),
      amountMinor: c.amountMinor,
      date: c.date.toISOString().slice(0, 10),
      note: c.note,
      createdAt: c.createdAt,
    })),
    createdAt: g.createdAt,
    updatedAt: g.updatedAt,
  };
};

const validate = (data: GoalInput, partial = false): Partial<CleanGoal> | never => {
  const errors: Record<string, string> = {};
  const clean: Partial<CleanGoal> = {};

  if (data.name !== undefined || !partial) {
    const name = typeof data.name === 'string' ? data.name.trim() : '';
    if (name.length < 2 || name.length > 60) {
      errors.name = 'El nombre debe tener entre 2 y 60 caracteres';
    } else clean.name = name;
  }

  if (data.targetMinor !== undefined || !partial) {
    const target = data.targetMinor;
    if (!Number.isSafeInteger(target)) {
      errors.targetMinor = 'El objetivo debe ser un entero en la unidad mínima';
    } else if ((target as number) < 1) {
      errors.targetMinor = 'El objetivo debe ser mayor a 0';
    } else clean.targetMinor = target as number;
  }

  if (data.color !== undefined) {
    if (data.color === null || data.color === '') clean.color = null;
    else if (typeof data.color !== 'string' || !COLOR_RE.test(data.color)) {
      errors.color = 'El color debe ser un hex de 6 dígitos (ej: #1f9d61)';
    } else clean.color = data.color;
  }

  if (data.deadline !== undefined) {
    const d = parseDate(data.deadline);
    if (d === undefined) errors.deadline = 'Fecha límite inválida (YYYY-MM-DD)';
    else clean.deadline = d;
  }

  if (data.archived !== undefined) {
    if (typeof data.archived !== 'boolean') errors.archived = 'Debe ser true o false';
    else clean.archived = data.archived;
  }

  if (Object.keys(errors).length) {
    throw new HttpError(400, 'Meta de ahorro inválida', errors);
  }
  return clean;
};

/**
 * Lista las metas del hogar (activas por defecto; `archived` conmuta).
 */
export const listGoals = async (
  home: IHome,
  { archived = false }: { archived?: boolean } = {}
) => {
  const goals = await Goal.find({ homeId: home._id, archived })
    .sort({ createdAt: -1 })
    .lean();
  return goals.map((g) => toPublic(g as IGoal, home.currency));
};

/**
 * Busca una meta por id dentro del hogar.
 * Lanza HttpError(404) si no existe.
 */
export const getGoal = async (
  homeId: Types.ObjectId | string,
  goalId: Types.ObjectId | string
): Promise<IGoal> => {
  if (!mongoose.Types.ObjectId.isValid(goalId)) {
    throw new HttpError(404, 'Meta no encontrada');
  }
  const goal = await Goal.findByIdForHome(goalId, homeId);
  if (!goal) throw new HttpError(404, 'Meta no encontrada');
  return goal;
};

/**
 * Crea una meta de ahorro para el hogar.
 * Lanza HttpError(400) si los datos no son válidos.
 */
export const createGoal = async (home: IHome, user: { _id: Types.ObjectId }, data: GoalInput) => {
  const clean = validate(data) as CleanGoal;
  const goal = await Goal.create({
    ...clean,
    homeId: home._id,
    createdBy: user._id,
  });
  return toPublic(goal, home.currency);
};

/**
 * Actualiza los campos editables de una meta (nombre, objetivo, color,
 * fecha límite, archivado). Lanza HttpError(400|404); devuelve la meta
 * pública actualizada.
 */
export const updateGoal = async (
  home: IHome,
  goalId: Types.ObjectId | string,
  data: GoalInput
) => {
  const current = await getGoal(home._id, goalId);
  const clean = validate(data, true);
  if (Object.keys(clean).length === 0) {
    throw new HttpError(400, 'Meta de ahorro inválida', { name: 'No hay cambios que aplicar' });
  }
  await Goal.updateOne({ _id: current._id }, { $set: clean });
  return toPublic({ ...current, ...clean }, home.currency);
};

/**
 * Elimina una meta y sus aportes.
 * Lanza HttpError(404); devuelve { mode, message }.
 */
export const removeGoal = async (
  homeId: Types.ObjectId | string,
  goalId: Types.ObjectId | string
): Promise<{ mode: 'deleted'; message: string }> => {
  const current = await getGoal(homeId, goalId);
  await Goal.deleteOne({ _id: current._id });
  return { mode: 'deleted', message: 'Meta eliminada' };
};

/**
 * Registra un aporte (positivo) o un retiro (negativo) en una meta.
 * Reglas: monto entero ≠ 0, fecha válida y el ahorro nunca baja de 0.
 * Lanza HttpError(400|404); devuelve la meta pública con el progreso nuevo.
 */
export const addContribution = async (
  home: IHome,
  goalId: Types.ObjectId | string,
  data: ContributionInput
) => {
  const goal = await getGoal(home._id, goalId);
  const errors: Record<string, string> = {};

  const amount = data.amountMinor;
  let amountMinor = NaN;
  if (!Number.isSafeInteger(amount)) {
    errors.amountMinor = 'El aporte debe ser un entero en la unidad mínima';
  } else if ((amount as number) === 0) {
    errors.amountMinor = 'El aporte no puede ser 0';
  } else amountMinor = amount as number;

  const date = parseDate(data.date);
  if (date === undefined) {
    errors.date = 'Fecha inválida (YYYY-MM-DD)';
  }

  const note = data.note != null ? String(data.note).trim() : '';
  if (data.note != null && String(data.note).length > 200) {
    errors.note = 'La nota no puede superar 200 caracteres';
  }

  if (Object.keys(errors).length) {
    throw new HttpError(400, 'Aporte inválido', errors);
  }

  const saved = savedOf(goal);
  if (saved + amountMinor < 0) {
    throw new HttpError(400, 'Aporte inválido', {
      amountMinor: 'El retiro supera el ahorro actual de la meta',
    });
  }

  const contribution: IContribution = {
    _id: new mongoose.Types.ObjectId(),
    amountMinor,
    date: date ?? new Date(),
    note,
    createdAt: new Date(),
  };
  await Goal.updateOne({ _id: goal._id }, { $push: { contributions: contribution } });
  return toPublic({ ...goal, contributions: [...goal.contributions, contribution] }, home.currency);
};
