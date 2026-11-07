import type { Request, RequestHandler, Response } from 'express';
import { isHttpError } from '../../middlewares/error.ts';
import * as goalService from '../../services/goalService.ts';

const base = (req: Request) => ({
  title: 'Metas de ahorro',
  home: { id: req.params.homeId as string, name: req.home!.name, currency: req.home!.currency },
  role: req.homeRole,
});

interface RenderFormOpts {
  status?: number;
  goal?: Record<string, unknown> | null;
  error?: string | null;
  form?: Record<string, unknown> | null;
}

// El formulario envía el objetivo y los aportes en unidades decimales.
const toMinor = (raw: unknown, currency: string): number => {
  if (raw === undefined || raw === null || raw === '') return NaN;
  const decimals = currency === 'USD' ? 2 : 0;
  const num = Number(raw);
  return Number.isFinite(num) ? Math.round(num * 10 ** decimals) : NaN;
};

const goalMinorBody = (req: Request, body: Record<string, unknown>): Record<string, unknown> => {
  const decimals = req.home!.currency === 'USD' ? 2 : 0;
  const out: Record<string, unknown> = { ...body };
  if (body.targetDecimal !== undefined && body.targetDecimal !== null && body.targetDecimal !== '') {
    out.targetMinor = toMinor(body.targetDecimal, req.home!.currency);
  } else if (body.targetMinor === undefined) {
    out.targetMinor = NaN;
  }
  delete out.targetDecimal;
  if (body.deadline === '') out.deadline = null;
  return out;
};

const renderForm = async (req: Request, res: Response, opts: RenderFormOpts = {}) => {
  const { status = 200, goal = null, error = null, form = null } = opts;
  const decimals = req.home!.currency === 'USD' ? 2 : 0;
  const values =
    form ??
    (goal
      ? {
          name: goal.name,
          targetDecimal: ((goal.targetMinor as number) / 10 ** decimals).toFixed(decimals),
          color: goal.color ?? '',
          deadline: goal.deadline ?? '',
        }
      : { name: '', targetDecimal: '', color: '', deadline: '' });
  res.status(status).render('goals/form', { ...base(req), title: goal ? 'Editar meta' : 'Nueva meta', goal, values, error });
};

// Lista con tarjetas, barra de progreso y aportes (lectura para miembros).
export const index: RequestHandler = async (req, res, next) => {
  try {
    const archived = req.query.archived === 'true' || req.query.archived === '1';
    const goals = await goalService.listGoals(req.home!, { archived });
    res.render('goals/index', { ...base(req), goals, archived });
  } catch (err) {
    next(err);
  }
};

export const showNew: RequestHandler = (req, res, next) => {
  renderForm(req, res, {}).catch(next);
};

export const create: RequestHandler = async (req, res, next) => {
  try {
    await goalService.createGoal(req.home!, req.user!, goalMinorBody(req, req.body ?? {}));
    res.redirect(
      `/homes/${req.params.homeId as string}/goals?success=${encodeURIComponent('Meta creada')}`
    );
  } catch (err) {
    if (isHttpError(err) && err.status === 400) {
      const error = Object.values(err.details ?? {}).join('. ') || err.message;
      return renderForm(req, res, { status: 400, error, form: req.body }).catch(next);
    }
    next(err);
  }
};

export const showEdit: RequestHandler = async (req, res, next) => {
  try {
    const goal = await goalService.getGoal(req.home!._id, req.params.goalId as string);
    await renderForm(req, res, { goal: goalService.toPublic(goal, req.home!.currency) });
  } catch (err) {
    if (isHttpError(err) && err.status === 404) {
      return res.redirect(
        `/homes/${req.params.homeId as string}/goals?error=${encodeURIComponent('Meta no encontrada')}`
      );
    }
    next(err);
  }
};

export const update: RequestHandler = async (req, res, next) => {
  try {
    await goalService.updateGoal(req.home!, req.params.goalId as string, goalMinorBody(req, req.body ?? {}));
    res.redirect(
      `/homes/${req.params.homeId as string}/goals?success=${encodeURIComponent('Meta actualizada')}`
    );
  } catch (err) {
    if (isHttpError(err) && err.status === 400) {
      const error = Object.values(err.details ?? {}).join('. ') || err.message;
      return renderForm(req, res, { status: 400, error, form: req.body }).catch(next);
    }
    if (isHttpError(err) && err.status === 404) {
      return res.redirect(
        `/homes/${req.params.homeId as string}/goals?error=${encodeURIComponent('Meta no encontrada')}`
      );
    }
    next(err);
  }
};

export const remove: RequestHandler = async (req, res, next) => {
  try {
    const result = await goalService.removeGoal(req.home!._id, req.params.goalId as string);
    res.redirect(
      `/homes/${req.params.homeId as string}/goals?success=${encodeURIComponent(result.message)}`
    );
  } catch (err) {
    if (isHttpError(err) && err.status === 404) {
      return res.redirect(
        `/homes/${req.params.homeId as string}/goals?error=${encodeURIComponent('Meta no encontrada')}`
      );
    }
    next(err);
  }
};

/** Archivar/restaurar (POST+redirect, patrón del resto de la web). */
export const setArchived: RequestHandler = async (req, res, next) => {
  try {
    const archived = req.body?.archived === 'true' || req.body?.archived === '1';
    await goalService.updateGoal(req.home!, req.params.goalId as string, { archived });
    res.redirect(
      `/homes/${req.params.homeId as string}/goals?success=` +
        encodeURIComponent(archived ? 'Meta archivada' : 'Meta restaurada')
    );
  } catch (err) {
    if (isHttpError(err) && err.status === 404) {
      return res.redirect(
        `/homes/${req.params.homeId as string}/goals?error=${encodeURIComponent('Meta no encontrada')}`
      );
    }
    next(err);
  }
};

/** Aportar/retirar desde la tarjeta (monto en decimales; negativo = retiro). */
export const contribute: RequestHandler = async (req, res, next) => {
  try {
    const body = req.body ?? {};
    await goalService.addContribution(req.home!, req.params.goalId as string, {
      amountMinor: toMinor(body.amountDecimal, req.home!.currency),
      date: body.date || new Date().toISOString().slice(0, 10),
      note: body.note,
    });
    res.redirect(
      `/homes/${req.params.homeId as string}/goals?success=${encodeURIComponent('Aporte registrado')}`
    );
  } catch (err) {
    if (isHttpError(err) && (err.status === 400 || err.status === 404)) {
      const error = Object.values(err.details ?? {}).join('. ') || err.message;
      return res.redirect(
        `/homes/${req.params.homeId as string}/goals?error=${encodeURIComponent(error)}`
      );
    }
    next(err);
  }
};
