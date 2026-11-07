import mongoose from 'mongoose';
import type { Types } from 'mongoose';
import { HttpError } from '../middlewares/error.ts';
import { Notification, NotificationType } from '../models/notification.ts';
import type { INotification } from '../models/notification.ts';
import { Budget } from '../models/budget.ts';
import { Category } from '../models/category.ts';
import { Home, Role } from '../models/home.ts';
import { formatMoney } from '../utils/money.ts';

/** Aviso de presupuesto excedido devuelto al autor de la transacción. */
export interface BudgetWarning {
  budget: string;
  month: string;
  limitMinor: number;
  spentMinor: number;
  overMinor: number;
  categoryName: string;
}

/** Par (categoría, fecha) afectado por una escritura de transacción. */
export interface TriggerTarget {
  categoryId: Types.ObjectId;
  date: Date;
}

const monthOf = (d: Date): string => d.toISOString().slice(0, 7);

/**
 * Agregado dirigido: gastos de una categoría en un mes concreto
 * (aprovecha el índice {homeId, categoryId, date}; no recorre otros meses).
 */
const spentFor = async (
  homeId: Types.ObjectId,
  categoryId: Types.ObjectId,
  month: string
): Promise<number> => {
  const [y, m] = month.split('-').map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1));
  const end = new Date(Date.UTC(y, m, 1));
  const rows = await mongoose.connection
    .collection('transactions')
    .aggregate([
      { $match: { homeId, categoryId, type: 'expense', date: { $gte: start, $lt: end } } },
      { $group: { _id: null, total: { $sum: '$amountMinor' } } },
    ])
    .toArray();
  return (rows[0]?.total as number | undefined) ?? 0;
};

/**
 * Disparador de presupuestos (se invoca después de crear, actualizar o
 * eliminar una transacción). Para cada (categoría, fecha) afectado:
 * - si el presupuesto del mes quedó excedido (spent > limit): crea la
 *   notificación para cada admin del hogar **solo si no tiene una no leída
 *   igual** (dedup por usuario+presupuesto+mes+tipo) y devuelve el aviso;
 * - si dejó de estar excedido: marca como leídas las no leídas de ese
 *   presupuesto-mes (auto-resolución).
 * Devuelve los avisos para el autor (para el flash inmediato).
 */
export const runBudgetCheck = async (
  homeId: Types.ObjectId,
  currency: string,
  targets: TriggerTarget[]
): Promise<BudgetWarning[]> => {
  const warnings: BudgetWarning[] = [];
  const evaluated = new Set<string>();

  for (const target of targets) {
    const month = monthOf(target.date);
    const dedupKey = `${target.categoryId.toString()}|${month}`;
    if (evaluated.has(dedupKey)) continue;
    evaluated.add(dedupKey);

    const budget = await Budget.findOne({
      homeId,
      categoryId: target.categoryId,
      month,
    }).lean();
    if (!budget) continue;

    const spent = await spentFor(homeId, budget.categoryId, month);

    if (spent > budget.limitMinor) {
      const [home, category] = await Promise.all([
        Home.findById(homeId).select('members').lean(),
        Category.findById(budget.categoryId).select('name').lean(),
      ]);
      const categoryName = category?.name ?? 'una categoría';
      const admins = (home?.members ?? []).filter((m) => m.role === Role.Admin);

      for (const admin of admins) {
        const exists = await Notification.hasUnread(admin.userId, {
          id: budget._id,
          month,
          type: NotificationType.BudgetExceeded,
        });
        if (exists) continue;
        await Notification.create({
          homeId,
          userId: admin.userId,
          type: NotificationType.BudgetExceeded,
          title: `Presupuesto excedido · ${categoryName}`,
          message:
            `Gastaste ${formatMoney(spent, currency)} de un límite de ` +
            `${formatMoney(budget.limitMinor, currency)} en ${categoryName} (${month}).`,
          ref: { kind: 'budget', id: budget._id, month, categoryId: budget.categoryId },
          read: false,
        });
      }

      warnings.push({
        budget: budget._id.toString(),
        month,
        limitMinor: budget.limitMinor,
        spentMinor: spent,
        overMinor: spent - budget.limitMinor,
        categoryName,
      });
    } else {
      await Notification.updateMany(
        {
          homeId,
          type: NotificationType.BudgetExceeded,
          'ref.id': budget._id,
          'ref.month': month,
          read: false,
        },
        { $set: { read: true, readAt: new Date() } }
      );
    }
  }

  return warnings;
};

/** Lista las notificaciones del usuario (más recientes primero). */
export const listNotifications = async (userId: Types.ObjectId): Promise<INotification[]> =>
  Notification.listForUser(userId);

/** Cuenta las no leídas del usuario (campana del nav). */
export const countUnread = (userId: Types.ObjectId): Promise<number> =>
  Notification.countUnread(userId);

/**
 * Marca una notificación como leída. Lanza HttpError(404) si no existe o no
 * es del usuario (cada usuario solo ve/lee las suyas).
 */
export const markRead = async (
  userId: Types.ObjectId,
  notificationId: string
): Promise<INotification> => {
  if (!mongoose.Types.ObjectId.isValid(notificationId)) {
    throw new HttpError(404, 'Notificación no encontrada');
  }
  const updated = await Notification.findOneAndUpdate(
    { _id: notificationId, userId },
    { $set: { read: true, readAt: new Date() } },
    { new: true }
  ).lean();
  if (!updated) throw new HttpError(404, 'Notificación no encontrada');
  return updated;
};

/** Marca todas las no leídas del usuario como leídas; devuelve cuántas. */
export const markAllRead = async (userId: Types.ObjectId): Promise<number> => {
  const result = await Notification.updateMany(
    { userId, read: false },
    { $set: { read: true, readAt: new Date() } }
  );
  return result.modifiedCount ?? 0;
};
