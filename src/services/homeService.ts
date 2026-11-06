import type { Types } from 'mongoose';
import { HttpError } from '../middlewares/error.ts';
import { Home, Role } from '../models/home.ts';
import type { Currency, IHome, IMember } from '../models/home.ts';
import { User } from '../models/user.ts';
import type { IUser } from '../models/user.ts';
import { Category } from '../models/category.ts';
import { DEFAULT_CATEGORIES } from './seed/default-categories.ts';
import { isSupportedCurrency } from '../config/currencies.ts';

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
