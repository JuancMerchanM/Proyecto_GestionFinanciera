import * as transactionService from '../../services/transactionService.mjs';
import * as accountService from '../../services/accountService.mjs';
import * as categoryService from '../../services/categoryService.mjs';

const today = () => new Date().toISOString().slice(0, 10);

const formData = (req, home) => {
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

const renderForm = (req, res, { status = 200, tx = null, error = null, form = null }) => {
  const home = { id: req.params.homeId, name: req.home.name, currency: req.home.currency };
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
    accountService.listAccounts(req.home),
    categoryService.listCategories(req.home._id),
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
export const index = async (req, res, next) => {
  try {
    const query = { ...req.query };
    const [result, accounts, categories] = await Promise.all([
      transactionService.listTransactions(req.home, query, req.user),
      accountService.listAccounts(req.home),
      categoryService.listCategories(req.home._id),
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
      home: { id: req.params.homeId, name: req.home.name, currency: req.home.currency },
      role: req.homeRole,
      accounts,
      categories,
      filters,
      ...result,
    });
  } catch (err) {
    if (err.status === 400) {
      return res.status(400).render('error', {
        title: 'Filtros inválidos',
        status: 400,
        message: err.message,
      });
    }
    next(err);
  }
};

export const showNew = (req, res, next) => {
  renderForm(req, res, {}).catch(next);
};

export const create = async (req, res, next) => {
  try {
    const body = formData(req, req.home);
    const tx = await transactionService.createTransaction(req.home, req.user, body);
    const label = tx.type === 'income' ? 'Ingreso' : 'Gasto';
    res.redirect(
      `/homes/${req.params.homeId}/transactions?success=${encodeURIComponent(`${label} registrado`)}`
    );
  } catch (err) {
    if (err.status === 400) {
      const error = Object.values(err.details ?? {}).join('. ') || err.message;
      return renderForm(req, res, { status: 400, error, form: req.body }).catch(next);
    }
    next(err);
  }
};

export const showEdit = async (req, res, next) => {
  try {
    const tx = await transactionService.getTransaction(req.home._id, req.params.transactionId);
    if (!transactionService.canModify(tx, req.user, req.homeRole)) {
      return res.redirect(
        `/homes/${req.params.homeId}/transactions?error=${encodeURIComponent(
          'Solo puede modificar sus propias transacciones'
        )}`
      );
    }
    await renderForm(req, res, { tx });
  } catch (err) {
    if (err.status === 404) {
      return res.redirect(
        `/homes/${req.params.homeId}/transactions?error=${encodeURIComponent('Transacción no encontrada')}`
      );
    }
    next(err);
  }
};

export const update = async (req, res, next) => {
  try {
    const body = formData(req, req.home);
    await transactionService.updateTransaction(
      req.home,
      req.params.transactionId,
      body,
      req.user,
      req.homeRole
    );
    res.redirect(
      `/homes/${req.params.homeId}/transactions?success=${encodeURIComponent('Transacción actualizada')}`
    );
  } catch (err) {
    if (err.status === 400) {
      const error = Object.values(err.details ?? {}).join('. ') || err.message;
      return renderForm(req, res, { status: 400, error, form: req.body }).catch(next);
    }
    if (err.status === 403) {
      return res.redirect(
        `/homes/${req.params.homeId}/transactions?error=${encodeURIComponent(err.message)}`
      );
    }
    if (err.status === 404) {
      return res.redirect(
        `/homes/${req.params.homeId}/transactions?error=${encodeURIComponent('Transacción no encontrada')}`
      );
    }
    next(err);
  }
};

export const remove = async (req, res, next) => {
  try {
    await transactionService.deleteTransaction(
      req.home,
      req.params.transactionId,
      req.user,
      req.homeRole
    );
    res.redirect(
      `/homes/${req.params.homeId}/transactions?success=${encodeURIComponent('Transacción eliminada')}`
    );
  } catch (err) {
    if (err.status === 403 || err.status === 404) {
      return res.redirect(
        `/homes/${req.params.homeId}/transactions?error=${encodeURIComponent(err.message)}`
      );
    }
    next(err);
  }
};
