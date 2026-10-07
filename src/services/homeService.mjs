import { HttpError } from '../middlewares/error.mjs';
import { Home } from '../models/home.mjs';
import { User } from '../models/user.mjs';
import { Category } from '../models/category.mjs';
import { DEFAULT_CATEGORIES } from './seed/default-categories.mjs';
import { isSupportedCurrency } from '../config/currencies.mjs';

const validateName = (name) => {
  if (!name || name.trim().length < 2 || name.trim().length > 60) {
    throw new HttpError(400, 'Datos del hogar inválidos', {
      name: 'El nombre debe tener entre 2 y 60 caracteres',
    });
  }
};

/**
 * Crea un hogar con su creador como admin y siembra sus categorías por defecto.
 * Lanza HttpError(400) si el nombre o la moneda no son válidos.
 */
export const createHome = async (user, { name, currency }) => {
  validateName(name);
  const code = (currency ?? '').toUpperCase();
  if (!isSupportedCurrency(code)) {
    throw new HttpError(400, 'Datos del hogar inválidos', {
      currency: 'Moneda no soportada (use COP o USD)',
    });
  }

  const home = await Home.create({
    name: name.trim(),
    currency: code,
    createdBy: user._id,
    members: [{ userId: user._id, role: 'admin', joinedAt: new Date() }],
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
export const getMembership = (home, userId) =>
  home.members.find((m) => m.userId.toString() === userId.toString()) ?? null;

/**
 * Lista los hogares de un usuario con su rol en cada uno.
 */
export const listHomesForUser = async (user) => {
  const homes = await Home.find({ _id: { $in: user.homeIds ?? [] } }).lean();
  return homes.map((h) => homeToPublic(h, getMembership(h, user._id)?.role));
};

/**
 * Lista los miembros del hogar con nombre, email y rol de cada uno.
 */
export const listMembers = async (home) => {
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
export const homeToPublic = (home, role = null) => ({
  id: home._id.toString(),
  name: home.name,
  currency: home.currency,
  role,
  membersCount: home.members?.length ?? 0,
  createdAt: home.createdAt,
});
