import crypto from 'node:crypto';
import type { Types } from 'mongoose';
import { HttpError } from '../middlewares/error.ts';
import { Invite, InviteStatus } from '../models/invite.ts';
import type { IInvite } from '../models/invite.ts';
import { Home, Role } from '../models/home.ts';
import type { IHome } from '../models/home.ts';
import { User } from '../models/user.ts';
import type { IUser } from '../models/user.ts';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sin 0/O ni 1/I
const CODE_LEN = 8;
const INVITE_TTL_DAYS = 7;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ROLE_VALUES: string[] = Object.values(Role);

const generateCode = (): string => {
  let code = '';
  const bytes = crypto.randomBytes(CODE_LEN);
  for (let i = 0; i < CODE_LEN; i++) code += ALPHABET[bytes[i] % ALPHABET.length];
  return code;
};

/**
 * Crea una invitación con código manual de 8 caracteres (vigencia 7 días).
 * Lanza HttpError(400) si rol/email son inválidos o 500 si no se pudo generar el código.
 */
export const createInvite = async (
  home: Pick<IHome, '_id'>,
  createdBy: Types.ObjectId,
  { role = 'member', email = null }: { role?: unknown; email?: unknown } = {}
): Promise<IInvite> => {
  if (!ROLE_VALUES.includes(role as string)) {
    throw new HttpError(400, 'Invitación inválida', { role: 'Rol inválido (admin|member)' });
  }
  let normalizedEmail: string | null = null;
  if (email) {
    if (!EMAIL_RE.test(email as string)) {
      throw new HttpError(400, 'Invitación inválida', { email: 'Email inválido' });
    }
    normalizedEmail = (email as string).trim().toLowerCase();
  }

  let invite: IInvite | null = null;
  for (let attempt = 0; attempt < 5 && !invite; attempt++) {
    try {
      invite = await Invite.create({
        code: generateCode(),
        homeId: home._id,
        role: role as Role,
        email: normalizedEmail,
        createdBy,
        expiresAt: new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000),
      });
    } catch (err) {
      if ((err as { code?: number } | null)?.code !== 11000) throw err; // colisión de código: reintentar
    }
  }
  if (!invite) throw new HttpError(500, 'No se pudo generar el código de invitación');
  return invite;
};

/**
 * Busca una invitación por su código (sin validar estado ni vigencia).
 * Lanza HttpError(404) si no existe.
 */
export const findPendingInvite = async (code: unknown): Promise<IInvite> => {
  if (!code || typeof code !== 'string') {
    throw new HttpError(404, 'Invitación no encontrada');
  }
  const invite = await Invite.findByCode(code);
  if (!invite) throw new HttpError(404, 'Invitación no encontrada');
  return invite;
};

const assertUsable = (invite: IInvite): void => {
  if (invite.status !== InviteStatus.Pending) {
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
export const previewInvite = async (code: unknown) => {
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
export const acceptInvite = async (user: IUser, code: unknown) => {
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

  invite.status = InviteStatus.Accepted;
  invite.resolvedBy = user._id;
  invite.resolvedAt = new Date();
  await Invite.updateOne(
    { _id: invite._id },
    { status: InviteStatus.Accepted, resolvedBy: user._id, resolvedAt: invite.resolvedAt }
  );

  return { home, role: invite.role };
};

/**
 * Rechaza una invitación pendiente y la marca como resuelta.
 * Lanza HttpError(404|409) si no existe o ya no está pendiente.
 */
export const rejectInvite = async (
  user: IUser,
  code: unknown
): Promise<{ code: string; status: string }> => {
  const invite = await findPendingInvite(code);
  assertUsable(invite);
  await Invite.updateOne(
    { _id: invite._id },
    { status: InviteStatus.Rejected, resolvedBy: user._id, resolvedAt: new Date() }
  );
  return { code: invite.code, status: InviteStatus.Rejected };
};

/**
 * Lista las invitaciones pendientes y vigentes de un hogar.
 */
export const listPendingInvites = async (homeId: Types.ObjectId | string) => {
  const invites = await Invite.listPending(homeId).sort({ createdAt: -1 });
  return invites.map(inviteToPublic);
};

/**
 * Convierte una invitación en su forma pública (sin datos internos).
 */
export const inviteToPublic = (invite: IInvite) => ({
  code: invite.code,
  role: invite.role,
  email: invite.email,
  status: invite.status,
  expiresAt: invite.expiresAt,
  createdAt: invite.createdAt,
});
