import mongoose, { Model, Types } from 'mongoose';
import type { QueryFilter } from 'mongoose';
import { Currency } from './home.ts';

export enum AccountType {
  Cash = 'cash',
  Bank = 'bank',
  Card = 'card',
  Savings = 'savings',
}

export interface IAccount {
  _id: Types.ObjectId;
  homeId: Types.ObjectId;
  name: string;
  type: AccountType;
  currency: Currency;
  openingBalanceMinor: number;
  archived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/** Contrato del modelo: API de mongoose + estáticos propios (POO). */
export interface IAccountModel extends Model<IAccount> {
  existsName(
    homeId: Types.ObjectId | string,
    name: string,
    excludeId?: Types.ObjectId | null
  ): Promise<boolean>;
  findByIdForHome(
    accountId: Types.ObjectId | string,
    homeId: Types.ObjectId | string
  ): Promise<IAccount | null>;
}

const accountSchema = new mongoose.Schema<IAccount>(
  {
    homeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Home', required: true },
    name: { type: String, required: true, trim: true, maxlength: 40 },
    type: { type: String, enum: Object.values(AccountType), required: true },
    currency: { type: String, enum: Object.values(Currency), required: true },
    openingBalanceMinor: { type: Number, default: 0 },
    archived: { type: Boolean, default: false },
  },
  { timestamps: true }
);

accountSchema.index({ homeId: 1, archived: 1 });

/** Implementación de los estáticos; se copian al modelo vía schema.loadClass. */
class AccountModel extends Model<IAccount> {
  static async existsName(
    this: IAccountModel,
    homeId: Types.ObjectId | string,
    name: string,
    excludeId: Types.ObjectId | null = null
  ): Promise<boolean> {
    const filter: QueryFilter<IAccount> = {
      homeId,
      archived: false,
      name: { $regex: `^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' },
    };
    if (excludeId) filter._id = { $ne: excludeId };
    return Boolean(await this.exists(filter));
  }

  static findByIdForHome(this: IAccountModel, accountId: Types.ObjectId | string, homeId: Types.ObjectId | string) {
    return this.findOne({ _id: accountId, homeId }).lean();
  }
}

accountSchema.loadClass(AccountModel);

export const Account = mongoose.model<IAccount, IAccountModel>('Account', accountSchema);
