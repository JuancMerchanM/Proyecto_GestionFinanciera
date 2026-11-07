import type { RequestHandler } from 'express';
import * as transactionService from '../../services/transactionService.ts';

/**
 * @openapi
 * /api/homes/{homeId}/transactions:
 *   get:
 *     tags: [Transacciones]
 *     summary: Listar transacciones con filtros y paginación
 *     parameters:
 *       - $ref: '#/components/parameters/homeId'
 *       - { in: query, name: from, schema: { type: string, format: date }, description: 'Fecha desde (YYYY-MM-DD, inclusive)' }
 *       - { in: query, name: to, schema: { type: string, format: date }, description: 'Fecha hasta (YYYY-MM-DD, inclusive)' }
 *       - { in: query, name: categoryId, schema: { type: string } }
 *       - { in: query, name: accountId, schema: { type: string } }
 *       - { in: query, name: type, schema: { type: string, enum: [income, expense] } }
 *       - { in: query, name: mine, schema: { type: boolean }, description: 'Solo mis movimientos' }
 *       - { in: query, name: page, schema: { type: integer, default: 1 } }
 *       - { in: query, name: limit, schema: { type: integer, default: 20, maximum: 100 } }
 *     responses:
 *       '200':
 *         description: Lista paginada (consolidada del hogar)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/Transaction' }
 *                 meta: { $ref: '#/components/schemas/PaginationMeta' }
 *       '400': { $ref: '#/components/responses/Validation' }
 *       '401': { $ref: '#/components/responses/Unauthorized' }
 *       '403': { $ref: '#/components/responses/Forbidden' }
 *   post:
 *     tags: [Transacciones]
 *     summary: Registrar ingreso o gasto
 *     parameters:
 *       - $ref: '#/components/parameters/homeId'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/TransactionInput' }
 *           example: { type: 'expense', amountMinor: 50000, date: '2026-10-06', accountId: '652f1c2e9a1b2c3d4e5f6a7c', categoryId: '652f1c2e9a1b2c3d4e5f6a7d', note: 'Mercado' }
 *     responses:
 *       '201':
 *         description: Transacción registrada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 transaction: { $ref: '#/components/schemas/Transaction' }
 *                 budgetWarnings:
 *                   type: array
 *                   description: Presupuestos excedidos por la transacción (aditivo, vacío si ninguno)
 *                   items:
 *                     type: object
 *                     properties:
 *                       budget: { type: string }
 *                       month: { type: string, example: '2026-12' }
 *                       limitMinor: { type: integer, example: 100000 }
 *                       spentMinor: { type: integer, example: 160000 }
 *                       overMinor: { type: integer, example: 60000 }
 *                       categoryName: { type: string, example: 'Alimentación' }
 *       '400': { $ref: '#/components/responses/Validation' }
 *       '403': { $ref: '#/components/responses/Forbidden' }
 */
export const list: RequestHandler = async (req, res, next) => {
  try {
    const result = await transactionService.listTransactions(req.home!, req.query, req.user!);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

export const create: RequestHandler = async (req, res, next) => {
  try {
    const { transaction, budgetWarnings } = await transactionService.createTransaction(
      req.home!,
      req.user!,
      req.body ?? {}
    );
    res.status(201).json({
      transaction: await transactionService.publicOne(transaction),
      budgetWarnings,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @openapi
 * /api/homes/{homeId}/transactions/{transactionId}:
 *   get:
 *     tags: [Transacciones]
 *     summary: Detalle de una transacción
 *     parameters:
 *       - $ref: '#/components/parameters/homeId'
 *       - $ref: '#/components/parameters/transactionId'
 *     responses:
 *       '200': { description: Transacción }
 *       '404': { description: Transacción no encontrada }
 *   put:
 *     tags: [Transacciones]
 *     summary: 'Editar transacción propia (admin: cualquier movimiento)'
 *     parameters:
 *       - $ref: '#/components/parameters/homeId'
 *       - $ref: '#/components/parameters/transactionId'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/TransactionInput' }
 *           example: { type: 'expense', amountMinor: 50000, date: '2026-10-06', accountId: '652f1c2e9a1b2c3d4e5f6a7c', categoryId: '652f1c2e9a1b2c3d4e5f6a7d', note: 'Mercado' }
 *     responses:
 *       '200':
 *         description: Transacción actualizada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 transaction: { $ref: '#/components/schemas/Transaction' }
 *                 budgetWarnings:
 *                   type: array
 *                   description: Presupuestos excedidos tras la edición (aditivo)
 *                   items: { type: object }
 *       '400': { $ref: '#/components/responses/Validation' }
 *       '403': { description: No es su transacción y no es admin }
 *       '404': { description: Transacción no encontrada }
 *   delete:
 *     tags: [Transacciones]
 *     summary: 'Eliminar transacción propia (admin: cualquier movimiento)'
 *     parameters:
 *       - $ref: '#/components/parameters/homeId'
 *       - $ref: '#/components/parameters/transactionId'
 *     responses:
 *       '200': { description: Eliminada }
 *       '403': { description: No es su transacción y no es admin }
 *       '404': { description: Transacción no encontrada }
 */
export const detail: RequestHandler = async (req, res, next) => {
  try {
    const tx = await transactionService.getTransaction(req.home!._id, req.params.transactionId as string);
    res.json({ transaction: await transactionService.publicOne(tx) });
  } catch (err) {
    next(err);
  }
};

export const update: RequestHandler = async (req, res, next) => {
  try {
    const { transaction, budgetWarnings } = await transactionService.updateTransaction(
      req.home!,
      req.params.transactionId as string,
      req.body ?? {},
      req.user!,
      req.homeRole
    );
    res.json({ transaction: await transactionService.publicOne(transaction), budgetWarnings });
  } catch (err) {
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
    res.json({ message: 'Transacción eliminada' });
  } catch (err) {
    next(err);
  }
};
