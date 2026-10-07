import * as reportService from '../../services/reportService.mjs';

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
export const summary = async (req, res, next) => {
  try {
    res.json(await reportService.summary(req.home, req.query));
  } catch (err) {
    next(err);
  }
};
