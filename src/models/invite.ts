import mongoose, { Model, Types } from 'mongoose';
import type { Query } from 'mongoose';
import { Role } from './home.ts';

export enum InviteStatus {
  Pending = 'pending',
  Accepted = 'accepted',
  Rejected = 'rejected',
  /** Anulada por un admin del hogar (distinto de rechazada por el invitado). */
  Revoked = 'revoked',
}

export interface IInvite {
  _id: Types.ObjectId;
  code: string;
  homeId: Types.ObjectId;
  role: Role;
  email: string | null;
  status: InviteStatus;
  createdBy: Types.ObjectId;
  expiresAt: Date;
  resolvedBy: Types.ObjectId | null;
  resolvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Contrato del modelo: API de mongoose + estáticos propios (POO). */
export interface IInviteModel extends Model<IInvite> {
  findByCode(code: string): Promise<IInvite | null>;
  listPending(homeId: Types.ObjectId | string, now?: Date): Query<IInvite[], IInvite>;
}

const inviteSchema = new mongoose.Schema<IInvite>(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    homeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Home', required: true },
    role: { type: String, enum: Object.values(Role), default: Role.Member },
    email: { type: String, default: null, lowercase: true, trim: true },
    status: { type: String, enum: Object.values(InviteStatus), default: InviteStatus.Pending },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    expiresAt: { type: Date, required: true },
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    resolvedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

inviteSchema.index({ homeId: 1, status: 1 });

/** Implementación de los estáticos; se copian al modelo vía schema.loadClass. */
class InviteModel extends Model<IInvite> {
  static findByCode(this: IInviteModel, code: string) {
    return this.findOne({ code: code.trim().toUpperCase() }).lean();
  }

  static listPending(this: IInviteModel, homeId: Types.ObjectId | string, now: Date = new Date()) {
    return this.find({ homeId, status: InviteStatus.Pending, expiresAt: { $gt: now } }).lean();
  }
}

inviteSchema.loadClass(InviteModel);

export const Invite = mongoose.model<IInvite, IInviteModel>('Invite', inviteSchema);
