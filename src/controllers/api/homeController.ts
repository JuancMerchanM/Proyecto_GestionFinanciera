import type { RequestHandler } from 'express';
import { Role } from '../../models/home.ts';
import * as homeService from '../../services/homeService.ts';
import * as inviteService from '../../services/inviteService.ts';

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
export const list: RequestHandler = async (req, res, next) => {
  try {
    res.json({ homes: await homeService.listHomesForUser(req.user!) });
  } catch (err) {
    next(err);
  }
};

export const create: RequestHandler = async (req, res, next) => {
  try {
    const home = await homeService.createHome(req.user!, req.body ?? {});
    res.status(201).json({ home: homeService.homeToPublic(home, Role.Admin) });
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
 *   put:
 *     tags: [Hogares]
 *     summary: Actualizar el nombre del hogar (solo admin)
 *     parameters:
 *       - $ref: '#/components/parameters/homeId'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name: { type: string, minLength: 2, maxLength: 60 }
 *           example: { name: 'Hogar Pérez' }
 *     responses:
 *       '200':
 *         description: Hogar actualizado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 home: { $ref: '#/components/schemas/Home' }
 *       '400': { $ref: '#/components/responses/Validation' }
 *       '403':
 *         description: Requiere rol admin
 *         content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } }
 *   delete:
 *     tags: [Hogares]
 *     summary: Eliminar el hogar y todos sus datos en cascada (solo admin)
 *     description: Borra transacciones, presupuestos, cuentas, categorías e invitaciones del hogar, y lo retira de sus usuarios. Acción irreversible.
 *     parameters:
 *       - $ref: '#/components/parameters/homeId'
 *     responses:
 *       '200':
 *         description: Hogar eliminado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 deleted: { type: boolean }
 *                 homeId: { type: string }
 *       '403':
 *         description: Requiere rol admin
 *         content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } }
 */
export const detail: RequestHandler = (req, res) => {
  res.json({ home: homeService.homeToPublic(req.home!, req.homeRole) });
};

export const update: RequestHandler = async (req, res, next) => {
  try {
    const home = await homeService.updateHome(req.home!, req.body ?? {});
    res.json({ home: homeService.homeToPublic(home, req.homeRole) });
  } catch (err) {
    next(err);
  }
};

export const remove: RequestHandler = async (req, res, next) => {
  try {
    await homeService.deleteHome(req.home!);
    res.json({ deleted: true, homeId: req.params.homeId as string });
  } catch (err) {
    next(err);
  }
};

/**
 * @openapi
 * /api/homes/{homeId}/leave:
 *   post:
 *     tags: [Hogares]
 *     summary: Salir del hogar (cualquier miembro)
 *     description: Se rechaza con 409 si el usuario es el único admin del hogar (un hogar nunca queda sin admin). Sus transacciones se conservan.
 *     parameters:
 *       - $ref: '#/components/parameters/homeId'
 *     responses:
 *       '200':
 *         description: Salida confirmada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 left: { type: boolean }
 *       '401': { $ref: '#/components/responses/Unauthorized' }
 *       '403': { $ref: '#/components/responses/Forbidden' }
 *       '409': { description: Último admin del hogar }
 */
export const leave: RequestHandler = async (req, res, next) => {
  try {
    await homeService.leaveHome(req.home!, req.user!._id);
    res.json({ left: true });
  } catch (err) {
    next(err);
  }
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
export const members: RequestHandler = async (req, res, next) => {
  try {
    res.json({ members: await homeService.listMembers(req.home!) });
  } catch (err) {
    next(err);
  }
};

/**
 * @openapi
 * /api/homes/{homeId}/members/{userId}:
 *   put:
 *     tags: [Hogares]
 *     summary: Cambiar el rol de un miembro (solo admin)
 *     parameters:
 *       - $ref: '#/components/parameters/homeId'
 *       - name: userId
 *         in: path
 *         required: true
 *         schema: { type: string }
 *         description: Id del miembro
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [role]
 *             properties:
 *               role: { type: string, enum: [admin, member] }
 *           example: { role: 'admin' }
 *     responses:
 *       '200':
 *         description: Rol actualizado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 updated: { type: boolean }
 *                 userId: { type: string }
 *                 role: { type: string, enum: [admin, member] }
 *       '400': { $ref: '#/components/responses/Validation' }
 *       '403': { $ref: '#/components/responses/Forbidden' }
 *       '404': { description: El usuario no es miembro del hogar }
 *       '409': { description: Quedaría el hogar sin admin }
 *   delete:
 *     tags: [Hogares]
 *     summary: Quitar a un miembro del hogar (solo admin)
 *     description: Sus transacciones se conservan (son datos del hogar). Se rechaza con 409 si es el único admin.
 *     parameters:
 *       - $ref: '#/components/parameters/homeId'
 *       - name: userId
 *         in: path
 *         required: true
 *         schema: { type: string }
 *         description: Id del miembro
 *     responses:
 *       '200':
 *         description: Miembro quitado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 removed: { type: boolean }
 *                 userId: { type: string }
 *       '403': { $ref: '#/components/responses/Forbidden' }
 *       '404': { description: El usuario no es miembro del hogar }
 *       '409': { description: Último admin del hogar }
 */
export const updateMember: RequestHandler = async (req, res, next) => {
  try {
    const userId = req.params.userId as string;
    const role = await homeService.updateMemberRole(req.home!, userId, req.body?.role);
    res.json({ updated: true, userId, role });
  } catch (err) {
    next(err);
  }
};

export const removeMember: RequestHandler = async (req, res, next) => {
  try {
    const userId = req.params.userId as string;
    await homeService.removeMember(req.home!, userId);
    res.json({ removed: true, userId });
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
export const createInvite: RequestHandler = async (req, res, next) => {
  try {
    const invite = await inviteService.createInvite(req.home!, req.user!._id, req.body ?? {});
    res.status(201).json({
      invite: inviteService.inviteToPublic(invite),
      url: `/invite/${invite.code}`,
    });
  } catch (err) {
    next(err);
  }
};

export const listInvites: RequestHandler = async (req, res, next) => {
  try {
    res.json({ invites: await inviteService.listPendingInvites(req.home!._id) });
  } catch (err) {
    next(err);
  }
};

/**
 * @openapi
 * /api/homes/{homeId}/invites/{code}:
 *   delete:
 *     tags: [Hogares]
 *     summary: Revocar una invitación pendiente (solo admin)
 *     description: La anula para que ya no pueda aceptarse. Estado nuevo "revoked" (distinto de "rejected", que es del invitado).
 *     parameters:
 *       - $ref: '#/components/parameters/homeId'
 *       - name: code
 *         in: path
 *         required: true
 *         schema: { type: string }
 *         description: Código de la invitación
 *     responses:
 *       '200':
 *         description: Invitación revocada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 invite:
 *                   type: object
 *                   properties:
 *                     code: { type: string }
 *                     status: { type: string, enum: [revoked] }
 *       '403': { $ref: '#/components/responses/Forbidden' }
 *       '404': { description: Invitación no encontrada o de otro hogar }
 *       '409': { description: La invitación ya no está pendiente }
 */
export const revokeInvite: RequestHandler = async (req, res, next) => {
  try {
    const invite = await inviteService.revokeInvite(
      req.home!._id,
      req.params.code as string,
      req.user!._id
    );
    res.json({ invite });
  } catch (err) {
    next(err);
  }
};
