import * as accountService from '../../services/accountService.mjs';

const msg = (req, key) => req.query[key] ?? null;

// El formulario envía el saldo en unidades decimales; se convierte a entero mínimo.
const toMinorBody = (body, currency) => {
  const raw = body?.openingBalanceDecimal;
  if (raw === undefined || raw === null || raw === '') {
    return { ...body, openingBalanceMinor: Number.isSafeInteger(body?.openingBalanceMinor) ? body.openingBalanceMinor : 0 };
  }
  const num = Number(raw);
  const decimals = currency === 'USD' ? 2 : 0;
  const minor = Number.isFinite(num) ? Math.round(num * 10 ** decimals) : NaN;
  return { ...body, openingBalanceMinor: minor };
};

export const index = async (req, res, next) => {
  try {
    const includeArchived = req.query.archived === '1';
    res.render('accounts/index', {
      title: 'Cuentas',
      home: { id: req.params.homeId, name: req.home.name, currency: req.home.currency },
      role: req.homeRole,
      includeArchived,
      accounts: await accountService.listAccounts(req.home, { includeArchived }),
      success: msg(req, 'success'),
      error: msg(req, 'error'),
    });
  } catch (err) {
    next(err);
  }
};

export const showNew = (req, res) => {
  res.render('accounts/form', {
    title: 'Nueva cuenta',
    home: { id: req.params.homeId, name: req.home.name, currency: req.home.currency },
    account: null,
    form: { type: 'cash' },
    error: msg(req, 'error'),
  });
};

const renderForm = (req, res, status, error) =>
  res.status(status).render('accounts/form', {
    title: req.params.accountId ? 'Editar cuenta' : 'Nueva cuenta',
    home: { id: req.params.homeId, name: req.home.name, currency: req.home.currency },
    account: req.accountView ?? null,
    form: req.body ?? {},
    error,
  });

export const create = async (req, res, next) => {
  try {
    const account = await accountService.createAccount(
      req.home,
      toMinorBody(req.body ?? {}, req.home.currency)
    );
    res.redirect(
      `/homes/${req.params.homeId}/accounts?success=${encodeURIComponent(`Cuenta "${account.name}" creada`)}`
    );
  } catch (err) {
    if (err.status === 400 || err.status === 409) {
      req.accountView = null;
      return renderForm(req, res, err.status, Object.values(err.details ?? {}).join('. ') || err.message);
    }
    next(err);
  }
};

export const showEdit = async (req, res, next) => {
  try {
    const account = await accountService.getAccount(req.home._id, req.params.accountId);
    const balanceMinor = await accountService.getBalance(account);
    const pub = accountService.toPublic(account, balanceMinor);
    res.render('accounts/form', {
      title: 'Editar cuenta',
      home: { id: req.params.homeId, name: req.home.name, currency: req.home.currency },
      account: pub,
      form: { ...pub },
      error: msg(req, 'error'),
    });
  } catch (err) {
    if (err.status === 404) {
      return res.redirect(
        `/homes/${req.params.homeId}/accounts?error=${encodeURIComponent('Cuenta no encontrada')}`
      );
    }
    next(err);
  }
};

export const update = async (req, res, next) => {
  try {
    const account = await accountService.updateAccount(
      req.home,
      req.params.accountId,
      toMinorBody(req.body ?? {}, req.home.currency)
    );
    res.redirect(
      `/homes/${req.params.homeId}/accounts?success=${encodeURIComponent(`Cuenta "${account.name}" actualizada`)}`
    );
  } catch (err) {
    if (err.status === 400 || err.status === 409) {
      req.accountView = { id: req.params.accountId };
      return renderForm(req, res, err.status, Object.values(err.details ?? {}).join('. ') || err.message);
    }
    next(err);
  }
};

export const remove = async (req, res, next) => {
  try {
    const result = await accountService.removeAccount(req.home._id, req.params.accountId);
    res.redirect(
      `/homes/${req.params.homeId}/accounts?success=${encodeURIComponent(result.message)}`
    );
  } catch (err) {
    if (err.status === 404) {
      return res.redirect(
        `/homes/${req.params.homeId}/accounts?error=${encodeURIComponent('Cuenta no encontrada')}`
      );
    }
    next(err);
  }
};

export const restore = async (req, res, next) => {
  try {
    const account = await accountService.restoreAccount(req.home._id, req.params.accountId);
    res.redirect(
      `/homes/${req.params.homeId}/accounts?success=${encodeURIComponent(`Cuenta "${account.name}" restaurada`)}`
    );
  } catch (err) {
    if (err.status === 404) {
      return res.redirect(
        `/homes/${req.params.homeId}/accounts?error=${encodeURIComponent('Cuenta no encontrada')}`
      );
    }
    next(err);
  }
};
