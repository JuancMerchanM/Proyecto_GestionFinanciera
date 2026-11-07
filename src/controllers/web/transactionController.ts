import type { Request, RequestHandler, Response } from 'express';
import { isHttpError } from '../../middlewares/error.ts';
import * as transactionService from '../../services/transactionService.ts';
import * as accountService from '../../services/accountService.ts';
import * as categoryService from '../../services/categoryService.ts';
import type { BudgetWarning } from '../../services/notificationService.ts';
import type { Currency, IHome } from '../../models/home.ts';
import type { ITransaction } from '../../models/transaction.ts';
import { formatMoney } from '../../utils/money.ts';

const today = () => new Date().toISOString().slice(0, 10);

/** Redirect con ?success= y, si hubo excedidos, ?warning= (flash ámbar). */
const successRedirect = (
  basePath: string,
  success: string,
  warnings: BudgetWarning[],
  currency: Currency
): string => {
  const params = new URLSearchParams();
  params.set('success', success);
  if (warnings.length > 0) {
    const w = warnings[0];
    params.set(
      'warning',
      `Presupuesto excedido en ${w.categoryName} (${w.month}): ` +
        `${formatMoney(w.spentMinor, currency)} de ${formatMoney(w.limitMinor, currency)}`
    );
  }
  return `${basePath}?${params.toString()}`;
};

const formData = (req: Request, home: IHome) => {
  const decimals = home.currency === 'USD' ? 2 : 0;
  const raw = req.body?.amountDecimal;
  const amount =
    raw === undefined || raw === null || raw === ''
      ? NaN
      : Math.round(Number(raw) * 10 ** decimals);
  return {
    ...req.body,
    amountMinor: amount,
  };
};

interface RenderFormOpts {
  status?: number;
  tx?: ITransaction | null;
  error?: string | null;
  form?: Record<string, unknown> | null;
}

const renderForm = (req: Request, res: Response, { status = 200, tx = null, error = null, form = null }: RenderFormOpts) => {
  const home = { id: req.params.homeId as string, name: req.home!.name, currency: req.home!.currency };
  const decimals = home.currency === 'USD' ? 2 : 0;
  const values =
    form ??
    (tx
      ? {
          type: tx.type,
          amountDecimal: (tx.amountMinor / 10 ** decimals).toFixed(decimals),
          date: transactionService.toDateString(tx.date),
          accountId: tx.accountId?.toString(),
          categoryId: tx.categoryId?.toString(),
          note: tx.note ?? '',
        }
      : {
          type: 'expense',
          amountDecimal: '',
          date: today(),
          accountId: '',
          categoryId: '',
          note: '',
        });
  return Promise.all([
    accountService.listAccounts(req.home!),
    categoryService.listCategories(req.home!._id),
  ]).then(([accounts, categories]) => {
    res.status(status).render('transactions/form', {
      title: tx ? 'Editar transacción' : 'Nueva transacción',
      home,
      tx,
      values,
      accounts,
      categories,
      error,
    });
  });
};

// listado con filtros y paginación.
export const index: RequestHandler = async (req, res, next) => {
  try {
    const query = { ...req.query };
    const [result, accounts, categories] = await Promise.all([
      transactionService.listTransactions(req.home!, query, req.user!),
      accountService.listAccounts(req.home!),
      categoryService.listCategories(req.home!._id),
    ]);
    const filters = {
      from: req.query.from ?? '',
      to: req.query.to ?? '',
      type: req.query.type ?? '',
      categoryId: req.query.categoryId ?? '',
      accountId: req.query.accountId ?? '',
      mine: req.query.mine === 'true' || req.query.mine === '1',
    };
    res.render('transactions/index', {
      title: 'Movimientos',
      home: { id: req.params.homeId as string, name: req.home!.name, currency: req.home!.currency },
      role: req.homeRole,
      accounts,
      categories,
      filters,
      ...result,
    });
  } catch (err) {
    if (isHttpError(err) && (err.status === 400)) {
      return res.status(400).render('error', {
        title: 'Filtros inválidos',
        status: 400,
        message: err.message,
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
    const body = formData(req, req.home!);
    const { transaction, budgetWarnings } = await transactionService.createTransaction(
      req.home!,
      req.user!,
      body
    );
    const label = transaction.type === 'income' ? 'Ingreso' : 'Gasto';
    res.redirect(
      successRedirect(
        `/homes/${req.params.homeId as string}/transactions`,
        `${label} registrado`,
        budgetWarnings,
        req.home!.currency
      )
    );
  } catch (err) {
    if (isHttpError(err) && (err.status === 400)) {
      const error = Object.values(err.details ?? {}).join('. ') || err.message;
      return renderForm(req, res, { status: 400, error, form: req.body }).catch(next);
    }
    next(err);
  }
};

export const showEdit: RequestHandler = async (req, res, next) => {
  try {
    const tx = await transactionService.getTransaction(req.home!._id, req.params.transactionId as string);
    if (!transactionService.canModify(tx, req.user!, req.homeRole)) {
      return res.redirect(
        `/homes/${req.params.homeId as string}/transactions?error=${encodeURIComponent(
          'Solo puede modificar sus propias transacciones'
        )}`
      );
    }
    await renderForm(req, res, { tx });
  } catch (err) {
    if (isHttpError(err) && (err.status === 404)) {
      return res.redirect(
        `/homes/${req.params.homeId as string}/transactions?error=${encodeURIComponent('Transacción no encontrada')}`
      );
    }
    next(err);
  }
};

export const update: RequestHandler = async (req, res, next) => {
  try {
    const body = formData(req, req.home!);
    const { budgetWarnings } = await transactionService.updateTransaction(
      req.home!,
      req.params.transactionId as string,
      body,
      req.user!,
      req.homeRole
    );
    res.redirect(
      successRedirect(
        `/homes/${req.params.homeId as string}/transactions`,
        'Transacción actualizada',
        budgetWarnings,
        req.home!.currency
      )
    );
  } catch (err) {
    if (isHttpError(err) && (err.status === 400)) {
      const error = Object.values(err.details ?? {}).join('. ') || err.message;
      return renderForm(req, res, { status: 400, error, form: req.body }).catch(next);
    }
    if (isHttpError(err) && (err.status === 403)) {
      return res.redirect(
        `/homes/${req.params.homeId as string}/transactions?error=${encodeURIComponent(err.message)}`
      );
    }
    if (isHttpError(err) && (err.status === 404)) {
      return res.redirect(
        `/homes/${req.params.homeId as string}/transactions?error=${encodeURIComponent('Transacción no encontrada')}`
      );
    }
    next(err);
  }
};

export const remove: RequestHandler = async (req, res, next) => {
  try {
    await transactionService.deleteTransaction(
      req.home!,
      req.params.transactionId as string,
      req.user!,
      req.homeRole
    );
    res.redirect(
      `/homes/${req.params.homeId as string}/transactions?success=${encodeURIComponent('Transacción eliminada')}`
    );
  } catch (err) {
    if (isHttpError(err) && (err.status === 403 || err.status === 404)) {
      return res.redirect(
        `/homes/${req.params.homeId as string}/transactions?error=${encodeURIComponent(err.message)}`
      );
    }
    next(err);
  }
};
