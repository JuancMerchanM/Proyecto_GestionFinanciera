import crypto from 'node:crypto';
import { HttpError } from '../middlewares/error.mjs';
import { Invite } from '../models/invite.mjs';
import { Home } from '../models/home.mjs';
import { User } from '../models/user.mjs';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sin 0/O ni 1/I
const CODE_LEN = 8;
const INVITE_TTL_DAYS = 7;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const generateCode = () => {
  let code = '';
  const bytes = crypto.randomBytes(CODE_LEN);
  for (let i = 0; i < CODE_LEN; i++) code += ALPHABET[bytes[i] % ALPHABET.length];
  return code;
};

/**
 * Crea una invitación con código manual de 8 caracteres (vigencia 7 días).
 * Lanza HttpError(400) si rol/email son inválidos o 500 si no se pudo generar el código.
 */
export const createInvite = async (home, createdBy, { role = 'member', email = null } = {}) => {
  if (!['admin', 'member'].includes(role)) {
    throw new HttpError(400, 'Invitación inválida', { role: 'Rol inválido (admin|member)' });
  }
  let normalizedEmail = null;
  if (email) {
    if (!EMAIL_RE.test(email)) {
      throw new HttpError(400, 'Invitación inválida', { email: 'Email inválido' });
    }
    normalizedEmail = email.trim().toLowerCase();
  }

  let invite = null;
  for (let attempt = 0; attempt < 5 && !invite; attempt++) {
    try {
      invite = await Invite.create({
        code: generateCode(),
        homeId: home._id,
        role,
        email: normalizedEmail,
        createdBy,
        expiresAt: new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000),
      });
    } catch (err) {
      if (err?.code !== 11000) throw err; // colisión de código: reintentar
    }
  }
  if (!invite) throw new HttpError(500, 'No se pudo generar el código de invitación');
  return invite;
};

/**
 * Busca una invitación por su código (sin validar estado ni vigencia).
 * Lanza HttpError(404) si no existe.
 */
export const findPendingInvite = async (code) => {
  if (!code || typeof code !== 'string') {
    throw new HttpError(404, 'Invitación no encontrada');
  }
  const invite = await Invite.findOne({ code: code.trim().toUpperCase() }).lean();
  if (!invite) throw new HttpError(404, 'Invitación no encontrada');
  return invite;
};

const assertUsable = (invite) => {
  if (invite.status !== 'pending') {
    throw new HttpError(409, 'La invitación ya fue utilizada o rechazada');
  }
  if (new Date(invite.expiresAt) < new Date()) {
    throw new HttpError(409, 'La invitación ha expirado');
  }
};

/**
 * Devuelve la vista previa de un código: hogar, rol ofrecido e invitador.
 * Lanza HttpError(404) si el código o el hogar ya no existen.
 */
export const previewInvite = async (code) => {
  const invite = await findPendingInvite(code);
  const home = await Home.findById(invite.homeId).lean();
  if (!home) throw new HttpError(404, 'El hogar de esta invitación ya no existe');
  const inviter = await User.findById(invite.createdBy).select('name').lean();
  return {
    code: invite.code,
    status: invite.status,
    expiresAt: invite.expiresAt,
    role: invite.role,
    email: invite.email,
    home: { id: home._id.toString(), name: home.name, currency: home.currency },
    invitedBy: inviter?.name ?? 'Desconocido',
  };
};

/**
 * Acepta una invitación: da de alta la membresía y agrega el hogar al usuario.
 * Lanza HttpError(403|404|409) si no corresponde, no existe o ya se usó.
 */
export const acceptInvite = async (user, code) => {
  const invite = await findPendingInvite(code);
  assertUsable(invite);
  if (invite.email && invite.email !== user.email) {
    throw new HttpError(403, 'Esta invitación está asignada a otro email');
  }

  const home = await Home.findById(invite.homeId);
  if (!home) throw new HttpError(404, 'El hogar de esta invitación ya no existe');

  if (!home.members.some((m) => m.userId.equals(user._id))) {
    home.members.push({ userId: user._id, role: invite.role, joinedAt: new Date() });
    await home.save();
    await User.updateOne({ _id: user._id }, { $addToSet: { homeIds: home._id } });
  }

  invite.status = 'accepted';
  invite.resolvedBy = user._id;
  invite.resolvedAt = new Date();
  await Invite.updateOne(
    { _id: invite._id },
    { status: 'accepted', resolvedBy: user._id, resolvedAt: invite.resolvedAt }
  );

  return { home, role: invite.role };
};

/**
 * Rechaza una invitación pendiente y la marca como resuelta.
 * Lanza HttpError(404|409) si no existe o ya no está pendiente.
 */
export const rejectInvite = async (user, code) => {
  const invite = await findPendingInvite(code);
  assertUsable(invite);
  await Invite.updateOne(
    { _id: invite._id },
    { status: 'rejected', resolvedBy: user._id, resolvedAt: new Date() }
  );
  return { code: invite.code, status: 'rejected' };
};

/**
 * Lista las invitaciones pendientes y vigentes de un hogar.
 */
export const listPendingInvites = async (homeId) => {
  const invites = await Invite.find({ homeId, status: 'pending', expiresAt: { $gt: new Date() } })
    .sort({ createdAt: -1 })
    .lean();
  return invites.map(inviteToPublic);
};

/**
 * Convierte una invitación en su forma pública (sin datos internos).
 */
export const inviteToPublic = (invite) => ({
  code: invite.code,
  role: invite.role,
  email: invite.email,
  status: invite.status,
  expiresAt: invite.expiresAt,
  createdAt: invite.createdAt,
});
