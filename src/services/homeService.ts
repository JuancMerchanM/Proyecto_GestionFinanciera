import type { Types } from 'mongoose';
import { HttpError } from '../middlewares/error.ts';
import { Home, Role } from '../models/home.ts';
import type { Currency, IHome, IMember } from '../models/home.ts';
import { User } from '../models/user.ts';
import type { IUser } from '../models/user.ts';
import { Category } from '../models/category.ts';
import { Transaction } from '../models/transaction.ts';
import { Budget } from '../models/budget.ts';
import { Account } from '../models/account.ts';
import { Invite } from '../models/invite.ts';
import { DEFAULT_CATEGORIES } from './seed/default-categories.ts';
import { isSupportedCurrency } from '../config/currencies.ts';

const ROLE_VALUES: string[] = Object.values(Role);

function validateName(name: unknown): asserts name is string {
  if (!name || (name as string).trim().length < 2 || (name as string).trim().length > 60) {
    throw new HttpError(400, 'Datos del hogar inválidos', {
      name: 'El nombre debe tener entre 2 y 60 caracteres',
    });
  }
}

/**
 * Crea un hogar con su creador como admin y siembra sus categorías por defecto.
 * Lanza HttpError(400) si el nombre o la moneda no son válidos.
 */
export const createHome = async (
  user: Pick<IUser, '_id'>,
  { name, currency }: { name?: unknown; currency?: unknown }
) => {
  validateName(name);
  const code = ((currency ?? '') as string).toUpperCase();
  if (!isSupportedCurrency(code)) {
    throw new HttpError(400, 'Datos del hogar inválidos', {
      currency: 'Moneda no soportada (use COP o USD)',
    });
  }

  const home = await Home.create({
    name: name.trim(),
    currency: code as Currency,
    createdBy: user._id,
    members: [{ userId: user._id, role: Role.Admin, joinedAt: new Date() }],
  });

  await Category.insertMany(
    DEFAULT_CATEGORIES.map((c) => ({ ...c, homeId: home._id, isDefault: true }))
  );
  await User.updateOne({ _id: user._id }, { $addToSet: { homeIds: home._id } });

  return home;
};

/**
 * Devuelve la membresía de un usuario en el hogar, o null si no es miembro.
 */
export const getMembership = (home: IHome, userId: Types.ObjectId | string): IMember | null =>
  Home.getMembership(home, userId);

/**
 * Lista los hogares de un usuario con su rol en cada uno.
 */
export const listHomesForUser = async (user: Pick<IUser, '_id' | 'homeIds'>) => {
  const homes = await Home.findForUser(user.homeIds ?? []);
  return homes.map((h) => homeToPublic(h, getMembership(h, user._id)?.role ?? null));
};

/**
 * Lista los miembros del hogar con nombre, email y rol de cada uno.
 */
export const listMembers = async (home: IHome) => {
  const ids = home.members.map((m) => m.userId);
  const users = await User.find({ _id: { $in: ids } })
    .select('name email')
    .lean();
  const byId = new Map(users.map((u) => [u._id.toString(), u]));
  return home.members.map((m) => {
    const u = byId.get(m.userId.toString());
    return {
      userId: m.userId.toString(),
      name: u?.name ?? '(usuario eliminado)',
      email: u?.email ?? null,
      role: m.role,
      joinedAt: m.joinedAt,
    };
  });
};

/**
 * Convierte un hogar en su forma pública (para API y vistas).
 * `role` es el rol del usuario actual en ese hogar, si se conoce.
 */
export const homeToPublic = (home: IHome, role: Role | null = null) => ({
  id: home._id.toString(),
  name: home.name,
  currency: home.currency,
  role,
  membersCount: home.members?.length ?? 0,
  createdAt: home.createdAt,
});

const countAdmins = (home: IHome): number =>
  home.members.filter((m) => m.role === Role.Admin).length;

const findMember = (home: IHome, userId: Types.ObjectId | string): IMember | null =>
  home.members.find((m) => m.userId.toString() === userId.toString()) ?? null;

/**
 * Actualiza los campos editables del hogar (hoy: solo el nombre).
 * Lanza HttpError(400) si el nombre no es válido.
 */
export const updateHome = async (home: IHome, { name }: { name?: unknown }): Promise<IHome> => {
  validateName(name);
  const trimmed = name.trim();
  await Home.updateOne({ _id: home._id }, { name: trimmed });
  return { ...home, name: trimmed };
};

/**
 * Sale del hogar: retira la membresía y el índice del usuario.
 * Lanza HttpError(404) si no es miembro y 409 si es el único admin
 * (un hogar nunca queda sin admin).
 */
export const leaveHome = async (home: IHome, userId: Types.ObjectId): Promise<void> => {
  const membership = Home.getMembership(home, userId);
  if (!membership) throw new HttpError(404, 'No es miembro de este hogar');
  if (membership.role === Role.Admin && countAdmins(home) <= 1) {
    throw new HttpError(409, 'No puede salir: es el único admin del hogar');
  }
  await Home.updateOne({ _id: home._id }, { $pull: { members: { userId } } });
  await User.updateOne({ _id: userId }, { $pull: { homeIds: home._id } });
};

/**
 * Elimina el hogar en cascada (transacciones, presupuestos, cuentas,
 * categorías e invitaciones) y lo retira de `homeIds` de todos sus usuarios.
 */
export const deleteHome = async (home: IHome): Promise<void> => {
  const homeId = home._id;
  await Promise.all([
    Transaction.deleteMany({ homeId }),
    Budget.deleteMany({ homeId }),
    Account.deleteMany({ homeId }),
    Category.deleteMany({ homeId }),
    Invite.deleteMany({ homeId }),
  ]);
  await Home.deleteOne({ _id: homeId });
  await User.updateMany({ homeIds: homeId }, { $pull: { homeIds: homeId } });
};

/**
 * Cambia el rol de un miembro (solo admin).
 * Lanza HttpError(400) rol inválido, 404 si no es miembro y 409 si
 * intentaría dejar al hogar sin admin.
 */
export const updateMemberRole = async (
  home: IHome,
  targetUserId: Types.ObjectId | string,
  role: unknown
): Promise<Role> => {
  if (!ROLE_VALUES.includes(role as string)) {
    throw new HttpError(400, 'Rol inválido', { role: 'Debe ser admin o member' });
  }
  const membership = findMember(home, targetUserId);
  if (!membership) throw new HttpError(404, 'El usuario no es miembro del hogar');
  const nextRole = role as Role;
  if (membership.role === Role.Admin && nextRole !== Role.Admin && countAdmins(home) <= 1) {
    throw new HttpError(409, 'No se puede quitar el rol al único admin del hogar');
  }
  await Home.updateOne(
    { _id: home._id, 'members.userId': membership.userId },
    { $set: { 'members.$.role': nextRole } }
  );
  return nextRole;
};

/**
 * Quita a un miembro del hogar. Sus transacciones se conservan (son datos
 * del hogar; el usuario sigue existiendo en la plataforma).
 * Lanza HttpError(404) si no es miembro y 409 si es el único admin.
 */
export const removeMember = async (
  home: IHome,
  targetUserId: Types.ObjectId | string
): Promise<void> => {
  const membership = findMember(home, targetUserId);
  if (!membership) throw new HttpError(404, 'El usuario no es miembro del hogar');
  if (membership.role === Role.Admin && countAdmins(home) <= 1) {
    throw new HttpError(409, 'No se puede quitar al único admin del hogar');
  }
  await Home.updateOne({ _id: home._id }, { $pull: { members: { userId: membership.userId } } });
  await User.updateOne({ _id: membership.userId }, { $pull: { homeIds: home._id } });
};
