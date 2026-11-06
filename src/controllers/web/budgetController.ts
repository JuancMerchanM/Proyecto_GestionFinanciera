import type { Request, RequestHandler, Response } from 'express';
import { isHttpError } from '../../middlewares/error.ts';
import * as budgetService from '../../services/budgetService.ts';
import * as categoryService from '../../services/categoryService.ts';

const currentMonth = () => new Date().toISOString().slice(0, 7);

// El formulario envía el límite en unidades decimales; se convierte a entero mínimo.
const toMinorBody = (body: Record<string, unknown>, currency: string) => {
  const raw = body?.limitDecimal;
  if (raw === undefined || raw === null || raw === '') {
    return {
      ...body,
      limitMinor: Number.isSafeInteger(body?.limitMinor) ? body.limitMinor : NaN,
    };
  }
  const num = Number(raw);
  const decimals = currency === 'USD' ? 2 : 0;
  const minor = Number.isFinite(num) ? Math.round(num * 10 ** decimals) : NaN;
  return { ...body, limitMinor: minor };
};

const base = (req: Request) => ({
  title: 'Presupuestos',
  home: { id: req.params.homeId as string, name: req.home!.name, currency: req.home!.currency },
  role: req.homeRole,
});

/** Forma mínima del presupuesto que necesita el formulario. */
interface BudgetLike {
  month: string;
  categoryId: string;
  limitMinor: number;
}

interface RenderFormOpts {
  status?: number;
  budget?: BudgetLike | null;
  error?: string | null;
  form?: Record<string, unknown> | null;
}

const renderForm = async (
  req: Request,
  res: Response,
  { status = 200, budget = null, error = null, form = null }: RenderFormOpts = {}
) => {
  const expenseCategories = (await categoryService.listCategories(req.home!._id)).filter(
    (c) => c.type === 'expense'
  );
  const decimals = req.home!.currency === 'USD' ? 2 : 0;
  const values =
    form ??
    (budget
      ? {
          month: budget.month,
          categoryId: budget.categoryId,
          limitDecimal: (budget.limitMinor / 10 ** decimals).toFixed(decimals),
        }
      : { month: currentMonth(), categoryId: '', limitDecimal: '' });
  res.status(status).render('budgets/form', {
    ...base(req),
    title: budget ? 'Editar presupuesto' : 'Nuevo presupuesto',
    budget,
    values,
    categories: expenseCategories,
    error,
  });
};

// lista con consumo y barra de progreso.
export const index: RequestHandler = async (req, res, next) => {
  try {
    const month = (req.query.month as string | undefined) ?? '';
    const [budgets, expenseCategories] = await Promise.all([
      budgetService.listBudgets(req.home!, { month: month || null }),
      categoryService.listCategories(req.home!._id).then((cs) => cs.filter((c) => c.type === 'expense')),
    ]);
    res.render('budgets/index', {
      ...base(req),
      budgets,
      categories: expenseCategories,
      month,
    });
  } catch (err) {
    if (isHttpError(err) && (err.status === 400)) {
      return res.status(400).render('error', {
        title: 'Filtros inválidos',
        status: 400,
        message: Object.values(err.details ?? {}).join('. ') || err.message,
      });
    }
    next(err);
  }
};

export const showNew: RequestHandler = (req, res, next) => {
  renderForm(req, res, {}).catch(next);
};

export const create: RequestHandler = async (req, res, next) => {
  try {
    const budget = await budgetService.createBudget(
      req.home!,
      toMinorBody(req.body ?? {}, req.home!.currency)
    );
    res.redirect(
      `/homes/${req.params.homeId as string}/budgets?success=${encodeURIComponent('Presupuesto creado')}`
    );
  } catch (err) {
    if (isHttpError(err) && (err.status === 400 || err.status === 409)) {
      const error = Object.values(err.details ?? {}).join('. ') || err.message;
      return renderForm(req, res, { status: err.status, error, form: req.body }).catch(next);
    }
    next(err);
  }
};

export const showEdit: RequestHandler = async (req, res, next) => {
  try {
    const budget = await budgetService.getBudgetWithUsage(req.home!, req.params.budgetId as string);
    await renderForm(req, res, { budget });
  } catch (err) {
    if (isHttpError(err) && (err.status === 404)) {
      return res.redirect(
        `/homes/${req.params.homeId as string}/budgets?error=${encodeURIComponent('Presupuesto no encontrado')}`
      );
    }
    next(err);
  }
};

export const update: RequestHandler = async (req, res, next) => {
  try {
    await budgetService.updateBudget(
      req.home!,
      req.params.budgetId as string,
      toMinorBody(req.body ?? {}, req.home!.currency)
    );
    res.redirect(
      `/homes/${req.params.homeId as string}/budgets?success=${encodeURIComponent('Presupuesto actualizado')}`
    );
  } catch (err) {
    if (isHttpError(err) && (err.status === 400 || err.status === 409)) {
      const error = Object.values(err.details ?? {}).join('. ') || err.message;
      return renderForm(req, res, { status: err.status, error, form: req.body }).catch(next);
    }
    if (isHttpError(err) && (err.status === 404)) {
      return res.redirect(
        `/homes/${req.params.homeId as string}/budgets?error=${encodeURIComponent('Presupuesto no encontrado')}`
      );
    }
    next(err);
  }
};

export const remove: RequestHandler = async (req, res, next) => {
  try {
    const result = await budgetService.removeBudget(req.home!._id, req.params.budgetId as string);
    res.redirect(
      `/homes/${req.params.homeId as string}/budgets?success=${encodeURIComponent(result.message)}`
    );
  } catch (err) {
    if (isHttpError(err) && (err.status === 404)) {
      return res.redirect(
        `/homes/${req.params.homeId as string}/budgets?error=${encodeURIComponent('Presupuesto no encontrado')}`
      );
    }
    next(err);
  }
};
