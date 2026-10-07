import * as inviteService from '../../services/inviteService.mjs';

/**
 * @openapi
 * /api/invites/{code}:
 *   get:
 *     tags: [Invitaciones]
 *     summary: Preview de una invitación
 *     parameters:
 *       - $ref: '#/components/parameters/inviteCode'
 *     responses:
 *       '200':
 *         description: Datos de la invitación y del hogar
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 invite: { $ref: '#/components/schemas/InvitePreview' }
 *       '401': { $ref: '#/components/responses/Unauthorized' }
 *       '404': { description: Invitación no encontrada }
 *   post:
 *     tags: [Invitaciones]
 *     summary: Aceptar invitación
 *     parameters:
 *       - $ref: '#/components/parameters/inviteCode'
 *     responses:
 *       '200':
 *         description: Membresía creada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 home: { $ref: '#/components/schemas/Home' }
 *                 role: { type: string, example: member }
 *       '403': { description: Invitación asignada a otro email }
 *       '404': { description: Invitación no encontrada }
 *       '409': { description: Invitación expirada o ya utilizada }
 */
export const preview = async (req, res, next) => {
  try {
    res.json({ invite: await inviteService.previewInvite(req.params.code) });
  } catch (err) {
    next(err);
  }
};

export const accept = async (req, res, next) => {
  try {
    const { home, role } = await inviteService.acceptInvite(req.user, req.params.code);
    res.json({ home: { id: home._id.toString(), name: home.name, currency: home.currency }, role });
  } catch (err) {
    next(err);
  }
};

/**
 * @openapi
 * /api/invites/{code}/reject:
 *   post:
 *     tags: [Invitaciones]
 *     summary: Rechazar invitación
 *     parameters:
 *       - $ref: '#/components/parameters/inviteCode'
 *     responses:
 *       '200': { description: Invitación rechazada }
 *       '404': { description: Invitación no encontrada }
 *       '409': { description: Invitación expirada o ya utilizada }
 */
export const reject = async (req, res, next) => {
  try {
    res.json(await inviteService.rejectInvite(req.user, req.params.code));
  } catch (err) {
    next(err);
  }
};
