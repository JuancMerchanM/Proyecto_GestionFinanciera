import * as budgetService from '../../services/budgetService.mjs';

/**
 * @openapi
 * /api/homes/{homeId}/budgets:
 *   get:
 *     tags: [Presupuestos]
 *     summary: Listar presupuestos con consumo vs límite
 *     description: 'spentMinor = gastos de la categoría en el mes; percent = floor(spent*100/limit); exceeded = spent > limit'
 *     parameters:
 *       - $ref: '#/components/parameters/homeId'
 *       - in: query
 *         name: month
 *         schema: { type: string, pattern: '^\d{4}-(0[1-9]|1[0-2])$' }
 *         example: '2026-11'
 *         description: Filtrar por mes YYYY-MM
 *     responses:
 *       '200':
 *         description: Presupuestos con uso calculado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 budgets:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/Budget' }
 *       '400': { $ref: '#/components/responses/Validation' }
 *       '401': { $ref: '#/components/responses/Unauthorized' }
 *       '403': { $ref: '#/components/responses/Forbidden' }
 *   post:
 *     tags: [Presupuestos]
 *     summary: Crear presupuesto mensual por categoría de gasto (solo admin)
 *     parameters:
 *       - $ref: '#/components/parameters/homeId'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/BudgetInput' }
 *           example: { categoryId: '652f1c2e9a1b2c3d4e5f6a7b', month: '2026-11', limitMinor: 300000 }
 *     responses:
 *       '201':
 *         description: Presupuesto creado (spentMinor 0)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 budget: { $ref: '#/components/schemas/Budget' }
 *       '400': { $ref: '#/components/responses/Validation' }
 *       '403': { description: Requiere rol admin }
 *       '409': { description: 'Ya existe presupuesto de esa categoría en ese mes' }
 */
export const list = async (req, res, next) => {
  try {
    const month = req.query.month ?? null;
    res.json({ budgets: await budgetService.listBudgets(req.home, { month }) });
  } catch (err) {
    next(err);
  }
};

export const create = async (req, res, next) => {
  try {
    const budget = await budgetService.createBudget(req.home, req.body ?? {});
    res.status(201).json({ budget });
  } catch (err) {
    next(err);
  }
};

/**
 * @openapi
 * /api/homes/{homeId}/budgets/{budgetId}:
 *   get:
 *     tags: [Presupuestos]
 *     summary: Detalle de un presupuesto con su consumo
 *     parameters:
 *       - $ref: '#/components/parameters/homeId'
 *       - $ref: '#/components/parameters/budgetId'
 *     responses:
 *       '200':
 *         description: Presupuesto con uso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 budget: { $ref: '#/components/schemas/Budget' }
 *       '404': { description: Presupuesto no encontrado }
 *   put:
 *     tags: [Presupuestos]
 *     summary: Editar presupuesto (solo admin)
 *     parameters:
 *       - $ref: '#/components/parameters/homeId'
 *       - $ref: '#/components/parameters/budgetId'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/BudgetInput' }
 *           example: { categoryId: '652f1c2e9a1b2c3d4e5f6a7b', month: '2026-11', limitMinor: 300000 }
 *     responses:
 *       '200': { description: Presupuesto actualizado con uso recalculado }
 *       '400': { $ref: '#/components/responses/Validation' }
 *       '403': { description: Requiere rol admin }
 *       '404': { description: Presupuesto no encontrado }
 *       '409': { description: Duplicado en categoría+mes }
 *   delete:
 *     tags: [Presupuestos]
 *     summary: Eliminar presupuesto (solo admin)
 *     parameters:
 *       - $ref: '#/components/parameters/homeId'
 *       - $ref: '#/components/parameters/budgetId'
 *     responses:
 *       '200':
 *         description: Eliminado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 mode: { type: string, enum: [deleted] }
 *                 message: { type: string }
 *       '403': { description: Requiere rol admin }
 *       '404': { description: Presupuesto no encontrado }
 */
export const detail = async (req, res, next) => {
  try {
    res.json({
      budget: await budgetService.getBudgetWithUsage(req.home, req.params.budgetId),
    });
  } catch (err) {
    next(err);
  }
};

export const update = async (req, res, next) => {
  try {
    const budget = await budgetService.updateBudget(
      req.home,
      req.params.budgetId,
      req.body ?? {}
    );
    res.json({ budget });
  } catch (err) {
    next(err);
  }
};

export const remove = async (req, res, next) => {
  try {
    res.json(await budgetService.removeBudget(req.home._id, req.params.budgetId));
  } catch (err) {
    next(err);
  }
};
