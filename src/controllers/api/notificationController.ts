import type { RequestHandler } from 'express';
import * as notificationService from '../../services/notificationService.ts';
import type { INotification } from '../../models/notification.ts';

/** Forma pública de una notificación para la API. */
const toPublic = (n: INotification) => ({
  id: n._id.toString(),
  homeId: n.homeId.toString(),
  type: n.type,
  title: n.title,
  message: n.message,
  ref: {
    kind: n.ref.kind,
    id: n.ref.id.toString(),
    month: n.ref.month,
    categoryId: n.ref.categoryId ? n.ref.categoryId.toString() : null,
  },
  read: n.read,
  readAt: n.readAt,
  createdAt: n.createdAt,
});

/**
 * @openapi
 * /api/notifications:
 *   get:
 *     tags: [Notificaciones]
 *     summary: Listar notificaciones del usuario autenticado
 *     description: >-
 *       Devuelve las notificaciones propias (más recientes primero) con un
 *       `unreadCount` global para la campana. Cada usuario solo ve las suyas,
 *       nunca las de otros usuarios.
 *     responses:
 *       '200':
 *         description: Lista de notificaciones propias
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 notifications:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: string }
 *                       homeId: { type: string }
 *                       type: { type: string, enum: [budget_exceeded] }
 *                       title: { type: string, example: 'Presupuesto excedido · Alimentación' }
 *                       message: { type: string }
 *                       ref:
 *                         type: object
 *                         properties:
 *                           kind: { type: string, example: 'budget' }
 *                           id: { type: string }
 *                           month: { type: string, nullable: true, example: '2026-12' }
 *                           categoryId: { type: string, nullable: true }
 *                       read: { type: boolean }
 *                       readAt: { type: string, format: date-time, nullable: true }
 *                       createdAt: { type: string, format: date-time }
 *                 unreadCount: { type: integer, example: 2 }
 *       '401': { $ref: '#/components/responses/Unauthorized' }
 */
export const list: RequestHandler = async (req, res, next) => {
  try {
    const userId = req.user!._id;
    const [notifications, unreadCount] = await Promise.all([
      notificationService.listNotifications(userId),
      notificationService.countUnread(userId),
    ]);
    res.json({ notifications: notifications.map(toPublic), unreadCount });
  } catch (err) {
    next(err);
  }
};

/**
 * @openapi
 * /api/notifications/{id}/read:
 *   post:
 *     tags: [Notificaciones]
 *     summary: Marcar una notificación como leída
 *     description: >-
 *       Solo afecta notificaciones del usuario autenticado; una notificación
 *       ajena o inexistente responde 404 (no revela su existencia).
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         example: '652f1c2e9a1b2c3d4e5f6a7d'
 *     responses:
 *       '200':
 *         description: Notificación marcada como leída
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 notification:
 *                   type: object
 *                   properties:
 *                     id: { type: string }
 *                     read: { type: boolean, example: true }
 *                     readAt: { type: string, format: date-time }
 *       '401': { $ref: '#/components/responses/Unauthorized' }
 *       '404': { description: Notificación no encontrada o ajena }
 */
export const read: RequestHandler = async (req, res, next) => {
  try {
    const notification = await notificationService.markRead(
      req.user!._id,
      req.params.id as string
    );
    res.json({ notification: toPublic(notification) });
  } catch (err) {
    next(err);
  }
};

/**
 * @openapi
 * /api/notifications/read-all:
 *   post:
 *     tags: [Notificaciones]
 *     summary: Marcar todas las notificaciones del usuario como leídas
 *     description: >-
 *       Marca todas las no leídas del usuario autenticado; no toca las de
 *       otros usuarios. Devuelve cuántas se marcaron.
 *     responses:
 *       '200':
 *         description: Notificaciones marcadas
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 marked: { type: integer, example: 3 }
 *                 unreadCount: { type: integer, example: 0 }
 *       '401': { $ref: '#/components/responses/Unauthorized' }
 */
export const readAll: RequestHandler = async (req, res, next) => {
  try {
    const marked = await notificationService.markAllRead(req.user!._id);
    const unreadCount = await notificationService.countUnread(req.user!._id);
    res.json({ marked, unreadCount });
  } catch (err) {
    next(err);
  }
};
