import mongoose, { Model, Types } from 'mongoose';

/** Tipos de notificación (abierto a futuros tipos: meta alcanzada, etc.). */
export enum NotificationType {
  /** Presupuesto mensual excedido por gastos. */
  BudgetExceeded = 'budget_exceeded',
}

/** Referencia al objeto que originó la notificación (hoy: un presupuesto). */
export interface INotificationRef {
  kind: string;
  id: Types.ObjectId;
  /** Mes del presupuesto (YYYY-MM); null para tipos sin mes. */
  month: string | null;
  categoryId: Types.ObjectId | null;
}

export interface INotification {
  _id: Types.ObjectId;
  homeId: Types.ObjectId;
  /** Destinatario (cada usuario solo ve/lee las suyas). */
  userId: Types.ObjectId;
  type: NotificationType;
  title: string;
  message: string;
  ref: INotificationRef;
  read: boolean;
  readAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Contrato del modelo: API de mongoose + estáticos propios (POO). */
export interface INotificationModel extends Model<INotification> {
  listForUser(userId: Types.ObjectId | string, limit?: number): Promise<INotification[]>;
  countUnread(userId: Types.ObjectId | string): Promise<number>;
  hasUnread(
    userId: Types.ObjectId | string,
    ref: { id: Types.ObjectId | string; month: string; type: NotificationType }
  ): Promise<boolean>;
}

const notificationSchema = new mongoose.Schema<INotification>(
  {
    homeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Home', required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: Object.values(NotificationType), required: true },
    title: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    ref: {
      kind: { type: String, required: true },
      id: { type: mongoose.Schema.Types.ObjectId, required: true },
      month: { type: String, default: null },
      categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null },
    },
    read: { type: Boolean, default: false },
    readAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Lista/campana del usuario y dedup de no leídas por presupuesto-mes.
notificationSchema.index({ userId: 1, read: 1, createdAt: -1 });
notificationSchema.index({ homeId: 1, 'ref.id': 1, 'ref.month': 1, type: 1, userId: 1, read: 1 });

/** Implementación de los estáticos; se copian al modelo vía schema.loadClass. */
class NotificationModel extends Model<INotification> {
  static listForUser(this: INotificationModel, userId: Types.ObjectId | string, limit = 100) {
    return this.find({ userId }).sort({ createdAt: -1, _id: -1 }).limit(limit).lean();
  }

  static countUnread(this: INotificationModel, userId: Types.ObjectId | string) {
    return this.countDocuments({ userId, read: false });
  }

  static async hasUnread(
    this: INotificationModel,
    userId: Types.ObjectId | string,
    ref: { id: Types.ObjectId | string; month: string; type: NotificationType }
  ): Promise<boolean> {
    const doc = await this.exists({
      userId,
      type: ref.type,
      'ref.id': ref.id,
      'ref.month': ref.month,
      read: false,
    });
    return doc != null;
  }
}

notificationSchema.loadClass(NotificationModel);

export const Notification = mongoose.model<INotification, INotificationModel>(
  'Notification',
  notificationSchema
);
