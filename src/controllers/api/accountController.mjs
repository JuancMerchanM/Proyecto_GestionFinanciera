import * as accountService from '../../services/accountService.mjs';

/**
 * @openapi
 * /api/homes/{homeId}/accounts:
 *   get:
 *     tags: [Cuentas]
 *     summary: Listar cuentas con saldo calculado desde movimientos
 *     parameters:
 *       - $ref: '#/components/parameters/homeId'
 *       - in: query
 *         name: includeArchived
 *         schema: { type: boolean, default: false }
 *     responses:
 *       '200':
 *         description: Cuentas con balanceMinor = inicial + ingresos − gastos
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 accounts:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/Account' }
 *       '401': { $ref: '#/components/responses/Unauthorized' }
 *       '403': { $ref: '#/components/responses/Forbidden' }
 *   post:
 *     tags: [Cuentas]
 *     summary: Crear cuenta (solo admin del hogar)
 *     parameters:
 *       - $ref: '#/components/parameters/homeId'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/AccountInput' }
 *           example: { name: 'Davivienda', type: 'bank', openingBalanceMinor: 100000 }
 *     responses:
 *       '201':
 *         description: Cuenta creada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 account: { $ref: '#/components/schemas/Account' }
 *       '400': { $ref: '#/components/responses/Validation' }
 *       '403': { description: Requiere rol admin }
 *       '409': { description: Nombre duplicado }
 */
export const list = async (req, res, next) => {
  try {
    const includeArchived = req.query.includeArchived === 'true';
    res.json({ accounts: await accountService.listAccounts(req.home, { includeArchived }) });
  } catch (err) {
    next(err);
  }
};

export const create = async (req, res, next) => {
  try {
    const account = await accountService.createAccount(req.home, req.body ?? {});
    res.status(201).json({ account });
  } catch (err) {
    next(err);
  }
};

/**
 * @openapi
 * /api/homes/{homeId}/accounts/{accountId}:
 *   get:
 *     tags: [Cuentas]
 *     summary: Detalle de una cuenta con su saldo
 *     parameters:
 *       - $ref: '#/components/parameters/homeId'
 *       - $ref: '#/components/parameters/accountId'
 *     responses:
 *       '200':
 *         description: Cuenta con saldo
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 account: { $ref: '#/components/schemas/Account' }
 *       '404': { description: Cuenta no encontrada }
 *   put:
 *     tags: [Cuentas]
 *     summary: Editar cuenta (solo admin)
 *     parameters:
 *       - $ref: '#/components/parameters/homeId'
 *       - $ref: '#/components/parameters/accountId'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/AccountInput' }
 *           example: { name: 'Davivienda', type: 'bank', openingBalanceMinor: 100000 }
 *     responses:
 *       '200': { description: Cuenta actualizada }
 *       '400': { $ref: '#/components/responses/Validation' }
 *       '403': { description: Requiere rol admin }
 *       '404': { description: Cuenta no encontrada }
 *   delete:
 *     tags: [Cuentas]
 *     summary: Eliminar cuenta (solo admin). Si tiene transacciones se archiva
 *     parameters:
 *       - $ref: '#/components/parameters/homeId'
 *       - $ref: '#/components/parameters/accountId'
 *     responses:
 *       '200':
 *         description: 'mode=deleted o mode=archived'
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 mode: { type: string, enum: [deleted, archived] }
 *                 message: { type: string }
 *       '403': { description: Requiere rol admin }
 *       '404': { description: Cuenta no encontrada }
 */
export const detail = async (req, res, next) => {
  try {
    const account = await accountService.getAccount(req.home._id, req.params.accountId);
    const balanceMinor = await accountService.getBalance(account);
    res.json({ account: accountService.toPublic(account, balanceMinor) });
  } catch (err) {
    next(err);
  }
};

export const update = async (req, res, next) => {
  try {
    const account = await accountService.updateAccount(req.home, req.params.accountId, req.body ?? {});
    res.json({ account });
  } catch (err) {
    next(err);
  }
};

export const remove = async (req, res, next) => {
  try {
    res.json(await accountService.removeAccount(req.home._id, req.params.accountId));
  } catch (err) {
    next(err);
  }
};

/**
 * @openapi
 * /api/homes/{homeId}/accounts/{accountId}/restore:
 *   post:
 *     tags: [Cuentas]
 *     summary: Restaurar cuenta archivada (solo admin)
 *     parameters:
 *       - $ref: '#/components/parameters/homeId'
 *       - $ref: '#/components/parameters/accountId'
 *     responses:
 *       '200': { description: Cuenta restaurada }
 *       '403': { description: Requiere rol admin }
 *       '404': { description: Cuenta no encontrada }
 */
export const restore = async (req, res, next) => {
  try {
    res.json({ account: await accountService.restoreAccount(req.home._id, req.params.accountId) });
  } catch (err) {
    next(err);
  }
};
