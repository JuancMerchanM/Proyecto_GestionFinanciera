import mongoose from 'mongoose';
import { HttpError } from '../middlewares/error.mjs';
import { Category } from '../models/category.mjs';

const COLOR_RE = /^#[0-9a-fA-F]{6}$/;
const TYPES = ['income', 'expense'];

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Convierte una categoría en su forma pública (para API y vistas).
 */
export const toPublic = (c) => ({
  id: c._id.toString(),
  name: c.name,
  color: c.color,
  type: c.type,
  isDefault: c.isDefault ?? false,
  archived: c.archived ?? false,
});

const validate = ({ name, color, type }) => {
  const errors = {};
  const clean = {};
  const n = typeof name === 'string' ? name.trim() : '';
  if (n.length < 2 || n.length > 40) errors.name = 'El nombre debe tener entre 2 y 40 caracteres';
  else clean.name = n;

  if (color !== undefined && color !== null && color !== '') {
    if (!COLOR_RE.test(color)) errors.color = 'El color debe ser un hex (#RRGGBB)';
    else clean.color = color.toLowerCase();
  }

  if (!TYPES.includes(type)) errors.type = 'Tipo inválido (income|expense)';
  else clean.type = type;

  if (Object.keys(errors).length) {
    throw new HttpError(400, 'Datos de categoría inválidos', errors);
  }
  return clean;
};

const assertUniqueName = async (homeId, { name, type }, excludeId = null) => {
  const filter = {
    homeId,
    type,
    archived: false,
    name: { $regex: `^${escapeRe(name)}$`, $options: 'i' },
  };
  if (excludeId) filter._id = { $ne: excludeId };
  const dup = await Category.exists(filter);
  if (dup) {
    throw new HttpError(409, 'Ya existe una categoría con ese nombre', {
      name: 'Ya existe una categoría con ese nombre en este tipo',
    });
  }
};

/**
 * Lista las categorías del hogar ordenadas por tipo y nombre.
 * Excluye archivadas salvo que `includeArchived` sea true.
 */
export const listCategories = async (homeId, { includeArchived = false } = {}) => {
  const filter = { homeId };
  if (!includeArchived) filter.archived = false;
  const cats = await Category.find(filter).sort({ type: 1, name: 1 }).lean();
  return cats.map(toPublic);
};

/**
 * Busca una categoría por id dentro del hogar (incluye archivadas).
 * Lanza HttpError(404) si no existe.
 */
export const getCategory = async (homeId, categoryId) => {
  if (!mongoose.Types.ObjectId.isValid(categoryId)) {
    throw new HttpError(404, 'Categoría no encontrada');
  }
  const cat = await Category.findOne({ _id: categoryId, homeId }).lean();
  if (!cat) throw new HttpError(404, 'Categoría no encontrada');
  return cat;
};

/**
 * Crea una categoría validando datos y nombre único por tipo.
 * Lanza HttpError(400) si los datos son inválidos o 409 si el nombre ya existe.
 */
export const createCategory = async (homeId, data) => {
  const clean = validate(data);
  await assertUniqueName(homeId, clean);
  const cat = await Category.create({ ...clean, homeId, isDefault: false, archived: false });
  return toPublic(cat);
};

/**
 * Actualiza nombre, color o tipo de una categoría (y su estado de archivado).
 * Lanza HttpError(400|404|409); devuelve la categoría pública resultante.
 */
export const updateCategory = async (homeId, categoryId, data) => {
  const current = await getCategory(homeId, categoryId);
  const merged = {
    name: data.name !== undefined ? data.name : current.name,
    color: data.color !== undefined ? data.color : current.color,
    type: data.type !== undefined ? data.type : current.type,
  };
  const clean = validate(merged);
  if (clean.name !== current.name || clean.type !== current.type) {
    await assertUniqueName(homeId, clean, current._id);
  }
  if (data.archived === true || data.archived === false) clean.archived = data.archived;

  await Category.updateOne({ _id: current._id }, { $set: clean });
  return toPublic({ ...current, ...clean });
};

/**
 * Elimina una categoría; si tiene transacciones asociadas la archiva en su lugar.
 * Devuelve { mode: 'deleted'|'archived', message }.
 */
export const removeCategory = async (homeId, categoryId) => {
  const current = await getCategory(homeId, categoryId);
  const used = await mongoose.connection
    .collection('transactions')
    .countDocuments({ categoryId: current._id });
  if (used > 0) {
    await Category.updateOne({ _id: current._id }, { $set: { archived: true } });
    return {
      mode: 'archived',
      message: `Categoría archivada (tiene ${used} transacción(es) asociadas)`,
    };
  }
  await Category.deleteOne({ _id: current._id });
  return { mode: 'deleted', message: 'Categoría eliminada' };
};

/**
 * Restaura una categoría archivada y la devuelve en forma pública.
 * Lanza HttpError(404) si no existe.
 */
export const restoreCategory = async (homeId, categoryId) => {
  const current = await getCategory(homeId, categoryId);
  await Category.updateOne({ _id: current._id }, { $set: { archived: false } });
  return toPublic({ ...current, archived: false });
};
