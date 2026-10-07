import { Router } from 'express';
import { isConnected, getConnection } from '../driver/mongodb.mjs';

const router = Router();

/**
 * @openapi
 * /health:
 *   get:
 *     tags: [Sistema]
 *     summary: Estado del servidor y de la base de datos
 *     security: []
 *     responses:
 *       '200':
 *         description: Servicio funcionando
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: string, example: ok }
 *                 db: { type: string, example: up }
 *                 uptime: { type: number, example: 12.345 }
 *                 timestamp: { type: string, format: date-time }
 */
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    db: isConnected() ? 'up' : 'down',
    connection: getConnection().name || null,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

export default router;
