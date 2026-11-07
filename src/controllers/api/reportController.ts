import type { RequestHandler } from 'express';
import * as reportService from '../../services/reportService.ts';

/**
 * @openapi
 * /api/homes/{homeId}/reports/summary:
 *   get:
 *     tags: [Reportes]
 *     summary: Resumen del dashboard — balance total, ingresos/gastos del rango y desglose por categoría
 *     description: >-
 *       Por defecto usa el mes completo en curso (UTC). `from`/`to` (YYYY-MM-DD)
 *       personalizan el rango; si se envía uno se exigen ambos.
 *       `previous` es un periodo de igual duración inmediatamente anterior.
 *       `expensesByCategory` alimenta el gráfico donut, ordenado de mayor a menor.
 *     parameters:
 *       - $ref: '#/components/parameters/homeId'
 *       - in: query
 *         name: from
 *         schema: { type: string, format: date }
 *         example: '2026-12-01'
 *       - in: query
 *         name: to
 *         schema: { type: string, format: date }
 *         example: '2026-12-31'
 *     responses:
 *       '200':
 *         description: Resumen con totales y desglose
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ReportSummary'
 *             example:
 *               currency: 'COP'
 *               range: { from: '2026-12-01', to: '2026-12-31', days: 31 }
 *               previous: { from: '2026-11-01', to: '2026-11-30', incomeMinor: 400000, expenseMinor: 100000, netMinor: 300000 }
 *               balanceMinor: 150000
 *               incomeMinor: 300000
 *               expenseMinor: 200000
 *               netMinor: 100000
 *               expensesByCategory:
 *                 - { categoryId: '652f1c2e9a1b2c3d4e5f6a7d', label: 'Alimentación', amountMinor: 100000, percent: 50 }
 *                 - { categoryId: '652f1c2e9a1b2c3d4e5f6a7e', label: 'Transporte', amountMinor: 60000, percent: 30 }
 *       '400': { $ref: '#/components/responses/Validation' }
 *       '401': { $ref: '#/components/responses/Unauthorized' }
 *       '403': { $ref: '#/components/responses/Forbidden' }
 */
export const summary: RequestHandler = async (req, res, next) => {
  try {
    res.json(await reportService.summary(req.home!, req.query));
  } catch (err) {
    next(err);
  }
};

/**
 * @openapi
 * /api/homes/{homeId}/reports/timeline:
 *   get:
 *     tags: [Reportes]
 *     summary: Serie temporal de ingresos y gastos del rango (para gráficos)
 *     description: >-
 *       Usa la misma regla de rango que el resumen (mes en curso por defecto).
 *       La granularidad se adapta a la duración — diaria hasta 31 días,
 *       semanal hasta 180 y mensual más allá — y todos los intervalos se
 *       devuelven aunque estén en cero. `userId` filtra por persona; un
 *       miembro solo puede consultar lo suyo y recibe 403 si pide datos de
 *       otro. `byMember` trae los totales por persona del hogar (para un
 *       miembro, solo los suyos).
 *     parameters:
 *       - $ref: '#/components/parameters/homeId'
 *       - in: query
 *         name: from
 *         schema: { type: string, format: date }
 *         example: '2026-12-01'
 *       - in: query
 *         name: to
 *         schema: { type: string, format: date }
 *         example: '2026-12-31'
 *       - in: query
 *         name: userId
 *         schema: { type: string }
 *         example: '652f1c2e9a1b2c3d4e5f6a7d'
 *     responses:
 *       '200':
 *         description: Serie temporal con granularidad y totales por persona
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 currency: { type: string, example: 'COP' }
 *                 range:
 *                   type: object
 *                   properties:
 *                     from: { type: string, example: '2026-12-01' }
 *                     to: { type: string, example: '2026-12-31' }
 *                     days: { type: integer, example: 31 }
 *                     granularity: { type: string, enum: [daily, weekly, monthly] }
 *                 filter:
 *                   type: object
 *                   properties:
 *                     userId: { type: string, nullable: true }
 *                 timeline:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       key: { type: string, example: '2026-12-02' }
 *                       label: { type: string, example: '02/12' }
 *                       incomeMinor: { type: integer, example: 0 }
 *                       expenseMinor: { type: integer, example: 100000 }
 *                 byMember:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       userId: { type: string }
 *                       name: { type: string, example: 'Usuario ana' }
 *                       incomeMinor: { type: integer, example: 300000 }
 *                       expenseMinor: { type: integer, example: 0 }
 *       '400': { $ref: '#/components/responses/Validation' }
 *       '401': { $ref: '#/components/responses/Unauthorized' }
 *       '403': { $ref: '#/components/responses/Forbidden' }
 */
export const timeline: RequestHandler = async (req, res, next) => {
  try {
    res.json(
      await reportService.timeline(req.home!, req.query, {
        userId: req.user!._id,
        isAdmin: req.homeRole === 'admin',
      })
    );
  } catch (err) {
    next(err);
  }
};
