import * as homeService from '../../services/homeService.mjs';
import * as inviteService from '../../services/inviteService.mjs';

/**
 * @openapi
 * /api/homes:
 *   get:
 *     tags: [Hogares]
 *     summary: Listar los hogares del usuario autenticado
 *     responses:
 *       '200':
 *         description: Hogares del usuario
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 homes:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/Home' }
 *       '401': { $ref: '#/components/responses/Unauthorized' }
 *   post:
 *     tags: [Hogares]
 *     summary: Crear un hogar con categorías semilla
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, currency]
 *             properties:
 *               name: { type: string, minLength: 2, maxLength: 60, example: Hogar Pérez }
 *               currency: { type: string, enum: [COP, USD], example: COP }
 *           example: { name: 'Hogar Pérez', currency: 'COP' }
 *     responses:
 *       '201':
 *         description: Hogar creado; el creador queda como admin
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 home: { $ref: '#/components/schemas/Home' }
 *       '400': { $ref: '#/components/responses/Validation' }
 *       '401': { $ref: '#/components/responses/Unauthorized' }
 */
export const list = async (req, res, next) => {
  try {
    res.json({ homes: await homeService.listHomesForUser(req.user) });
  } catch (err) {
    next(err);
  }
};

export const create = async (req, res, next) => {
  try {
    const home = await homeService.createHome(req.user, req.body ?? {});
    res.status(201).json({ home: homeService.homeToPublic(home, 'admin') });
  } catch (err) {
    next(err);
  }
};

/**
 * @openapi
 * /api/homes/{homeId}:
 *   get:
 *     tags: [Hogares]
 *     summary: Detalle del hogar (solo miembros — aislamiento)
 *     parameters:
 *       - $ref: '#/components/parameters/homeId'
 *     responses:
 *       '200': { description: Hogar }
 *       '401': { $ref: '#/components/responses/Unauthorized' }
 *       '403': { $ref: '#/components/responses/Forbidden' }
 *       '404': { description: Hogar no encontrado }
 */
export const detail = (req, res) => {
  res.json({ home: homeService.homeToPublic(req.home, req.homeRole) });
};

/**
 * @openapi
 * /api/homes/{homeId}/members:
 *   get:
 *     tags: [Hogares]
 *     summary: Listar miembros del hogar
 *     parameters:
 *       - $ref: '#/components/parameters/homeId'
 *     responses:
 *       '200':
 *         description: Miembros con nombre, email y rol
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 members:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/Member' }
 *       '403': { $ref: '#/components/responses/Forbidden' }
 */
export const members = async (req, res, next) => {
  try {
    res.json({ members: await homeService.listMembers(req.home) });
  } catch (err) {
    next(err);
  }
};

/**
 * @openapi
 * /api/homes/{homeId}/invites:
 *   post:
 *     tags: [Hogares]
 *     summary: Generar código de invitación
 *     parameters:
 *       - $ref: '#/components/parameters/homeId'
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               role: { type: string, enum: [admin, member], default: member }
 *               email: { type: string, format: email, nullable: true, description: Si se indica, solo ese email puede aceptar }
 *           example: { role: 'member', email: 'carlos@ejemplo.com' }
 *     responses:
 *       '201':
 *         description: Código generado (compartir el link manualmente)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 invite: { $ref: '#/components/schemas/Invite' }
 *                 url: { type: string, example: /invite/AB3K9ZQ2 }
 *       '403':
 *         description: Requiere rol admin
 *         content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } }
 *   get:
 *     tags: [Hogares]
 *     summary: Invitaciones pendientes del hogar (solo admin)
 *     parameters:
 *       - $ref: '#/components/parameters/homeId'
 *     responses:
 *       '200':
 *         description: Invitaciones pendientes
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 invites:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/Invite' }
 *       '403': { $ref: '#/components/responses/Forbidden' }
 */
export const createInvite = async (req, res, next) => {
  try {
    const invite = await inviteService.createInvite(req.home, req.user._id, req.body ?? {});
    res.status(201).json({
      invite: inviteService.inviteToPublic(invite),
      url: `/invite/${invite.code}`,
    });
  } catch (err) {
    next(err);
  }
};

export const listInvites = async (req, res, next) => {
  try {
    res.json({ invites: await inviteService.listPendingInvites(req.home._id) });
  } catch (err) {
    next(err);
  }
};
