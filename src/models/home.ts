import mongoose, { Model, Types } from 'mongoose';

export enum Role {
  Admin = 'admin',
  Member = 'member',
}

export enum Currency {
  COP = 'COP',
  USD = 'USD',
}

export interface IMember {
  userId: Types.ObjectId;
  role: Role;
  joinedAt: Date;
}

export interface IHome {
  _id: Types.ObjectId;
  name: string;
  currency: Currency;
  members: IMember[];
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

/** Contrato del modelo: API de mongoose + estáticos propios (POO). */
export interface IHomeModel extends Model<IHome> {
  getMembership(home: IHome, userId: Types.ObjectId | string): IMember | null;
  findForUser(homeIds: Types.ObjectId[]): Promise<IHome[]>;
}

const memberSchema = new mongoose.Schema<IMember>(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, enum: Object.values(Role), default: Role.Member },
    joinedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const homeSchema = new mongoose.Schema<IHome>(
  {
    name: { type: String, required: true, trim: true, maxlength: 60 },
    currency: { type: String, enum: Object.values(Currency), required: true },
    members: { type: [memberSchema], default: [] },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

homeSchema.index({ 'members.userId': 1 });

/** Implementación de los estáticos; se copian al modelo vía schema.loadClass. */
class HomeModel extends Model<IHome> {
  static getMembership(home: IHome, userId: Types.ObjectId | string): IMember | null {
    return home.members.find((m) => m.userId.toString() === userId.toString()) ?? null;
  }

  static findForUser(this: IHomeModel, homeIds: Types.ObjectId[]) {
    return this.find({ _id: { $in: homeIds } }).lean();
  }
}

homeSchema.loadClass(HomeModel);

export const Home = mongoose.model<IHome, IHomeModel>('Home', homeSchema);
