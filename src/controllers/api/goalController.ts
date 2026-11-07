import type { RequestHandler } from 'express';
import * as goalService from '../../services/goalService.ts';

/**
 * @openapi
 * /api/homes/{homeId}/goals:
 *   get:
 *     tags: [Metas]
 *     summary: Listar metas de ahorro del hogar
 *     description: >-
 *       Devuelve las metas activas con el ahorro derivado de sus aportes
 *       (`savedMinor`), el porcentaje y el estado (`completed` si ya se
 *       alcanzó el objetivo). Los miembros solo leen; `archived=true` lista
 *       las archivadas.
 *     parameters:
 *       - $ref: '#/components/parameters/homeId'
 *       - in: query
 *         name: archived
 *         schema: { type: boolean }
 *         description: Listar las metas archivadas en lugar de las activas
 *     responses:
 *       '200':
 *         description: Lista de metas con progreso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 goals:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/Goal' }
 *       '401': { $ref: '#/components/responses/Unauthorized' }
 *       '403': { $ref: '#/components/responses/Forbidden' }
 *   post:
 *     tags: [Metas]
 *     summary: Crear una meta de ahorro (solo admin)
 *     parameters:
 *       - $ref: '#/components/parameters/homeId'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/GoalInput' }
 *           example: { name: 'Viaje a la costa', targetMinor: 2000000, color: '#1f9d61', deadline: '2027-06-30' }
 *     responses:
 *       '201':
 *         description: Meta creada (savedMinor 0, status active)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 goal: { $ref: '#/components/schemas/Goal' }
 *       '400': { $ref: '#/components/responses/Validation' }
 *       '403': { description: Requiere rol admin }
 */
export const list: RequestHandler = async (req, res, next) => {
  try {
    const archived = req.query.archived === 'true' || req.query.archived === '1';
    res.json({ goals: await goalService.listGoals(req.home!, { archived }) });
  } catch (err) {
    next(err);
  }
};

export const create: RequestHandler = async (req, res, next) => {
  try {
    const goal = await goalService.createGoal(req.home!, req.user!, req.body ?? {});
    res.status(201).json({ goal });
  } catch (err) {
    next(err);
  }
};

/**
 * @openapi
 * /api/homes/{homeId}/goals/{goalId}:
 *   put:
 *     tags: [Metas]
 *     summary: Editar o archivar una meta de ahorro (solo admin)
 *     description: 'Campos opcionales: name, targetMinor, color, deadline (vaciarlo lo elimina) y archived (true la archiva, false la restaura)'
 *     parameters:
 *       - $ref: '#/components/parameters/homeId'
 *       - $ref: '#/components/parameters/goalId'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/GoalInput' }
 *           example: { name: 'Viaje a la costa 2027', targetMinor: 2500000 }
 *     responses:
 *       '200':
 *         description: Meta actualizada con progreso recalculado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 goal: { $ref: '#/components/schemas/Goal' }
 *       '400': { $ref: '#/components/responses/Validation' }
 *       '403': { description: Requiere rol admin }
 *       '404': { description: Meta no encontrada }
 *   delete:
 *     tags: [Metas]
 *     summary: Eliminar una meta y sus aportes (solo admin)
 *     parameters:
 *       - $ref: '#/components/parameters/homeId'
 *       - $ref: '#/components/parameters/goalId'
 *     responses:
 *       '200':
 *         description: Eliminada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 mode: { type: string, enum: [deleted] }
 *                 message: { type: string }
 *       '403': { description: Requiere rol admin }
 *       '404': { description: Meta no encontrada }
 */
export const update: RequestHandler = async (req, res, next) => {
  try {
    const goal = await goalService.updateGoal(
      req.home!,
      req.params.goalId as string,
      req.body ?? {}
    );
    res.json({ goal });
  } catch (err) {
    next(err);
  }
};

export const remove: RequestHandler = async (req, res, next) => {
  try {
    res.json(await goalService.removeGoal(req.home!._id, req.params.goalId as string));
  } catch (err) {
    next(err);
  }
};

/**
 * @openapi
 * /api/homes/{homeId}/goals/{goalId}/contributions:
 *   post:
 *     tags: [Metas]
 *     summary: Registrar un aporte o un retiro en una meta (solo admin)
 *     description: >-
 *       `amountMinor` positivo aporta y negativo retira; no puede ser 0 ni
 *       dejar el ahorro por debajo de 0. El ahorro total y el estado se
 *       derivan siempre de la suma de aportes.
 *     parameters:
 *       - $ref: '#/components/parameters/homeId'
 *       - $ref: '#/components/parameters/goalId'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [amountMinor, date]
 *             properties:
 *               amountMinor: { type: integer, example: 200000, description: 'Entero ≠ 0; negativo = retiro' }
 *               date: { type: string, format: date, example: '2026-11-07' }
 *               note: { type: string, maxLength: 200, nullable: true }
 *           example: { amountMinor: 200000, date: '2026-11-07', note: 'Pago quincenal' }
 *     responses:
 *       '201':
 *         description: Meta con el nuevo aporte y progreso derivado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 goal: { $ref: '#/components/schemas/Goal' }
 *       '400': { $ref: '#/components/responses/Validation' }
 *       '403': { description: Requiere rol admin }
 *       '404': { description: Meta no encontrada }
 */
export const contribute: RequestHandler = async (req, res, next) => {
  try {
    const goal = await goalService.addContribution(
      req.home!,
      req.params.goalId as string,
      req.body ?? {}
    );
    res.status(201).json({ goal });
  } catch (err) {
    next(err);
  }
};
