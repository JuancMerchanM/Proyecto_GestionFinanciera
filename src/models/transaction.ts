import mongoose, { Model, Types } from 'mongoose';
import { Currency } from './home.ts';
import { MovementType } from './category.ts';

export interface ITransaction {
  _id: Types.ObjectId;
  homeId: Types.ObjectId;
  userId: Types.ObjectId | null;
  accountId: Types.ObjectId;
  categoryId: Types.ObjectId;
  type: MovementType;
  amountMinor: number;
  currency: Currency;
  date: Date;
  note: string;
  createdAt: Date;
  updatedAt: Date;
}

/** Contrato del modelo: API de mongoose + estáticos propios (POO). */
export interface ITransactionModel extends Model<ITransaction> {
  findByIdForHome(
    txId: Types.ObjectId | string,
    homeId: Types.ObjectId | string
  ): Promise<ITransaction | null>;
}

const transactionSchema = new mongoose.Schema<ITransaction>(
  {
    homeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Home', required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    accountId: { type: mongoose.Schema.Types.ObjectId, ref: 'Account', required: true },
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
    type: { type: String, enum: Object.values(MovementType), required: true },
    amountMinor: { type: Number, required: true },
    currency: { type: String, enum: Object.values(Currency), required: true },
    date: { type: Date, required: true },
    note: { type: String, default: '', maxlength: 200, trim: true },
  },
  { timestamps: true }
);

transactionSchema.index({ homeId: 1, date: -1 });
transactionSchema.index({ homeId: 1, categoryId: 1, date: -1 });
transactionSchema.index({ homeId: 1, accountId: 1, date: -1 });
transactionSchema.index({ homeId: 1, userId: 1, date: -1 });

/** Implementación de los estáticos; se copian al modelo vía schema.loadClass. */
class TransactionModel extends Model<ITransaction> {
  static findByIdForHome(
    this: ITransactionModel,
    txId: Types.ObjectId | string,
    homeId: Types.ObjectId | string
  ) {
    return this.findOne({ _id: txId, homeId }).lean();
  }
}

transactionSchema.loadClass(TransactionModel);

export const Transaction = mongoose.model<ITransaction, ITransactionModel>(
  'Transaction',
  transactionSchema
);
