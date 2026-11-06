import mongoose, { Model, Types } from 'mongoose';
import { Currency } from './home.ts';

export interface IBudget {
  _id: Types.ObjectId;
  homeId: Types.ObjectId;
  categoryId: Types.ObjectId;
  month: string;
  limitMinor: number;
  currency: Currency;
  createdAt: Date;
  updatedAt: Date;
}

/** Contrato del modelo: API de mongoose + estáticos propios (POO). */
export interface IBudgetModel extends Model<IBudget> {
  findByIdForHome(
    budgetId: Types.ObjectId | string,
    homeId: Types.ObjectId | string
  ): Promise<IBudget | null>;
  findForMonth(
    homeId: Types.ObjectId | string,
    categoryId: Types.ObjectId | string,
    month: string,
    excludeId?: Types.ObjectId | null
  ): Promise<IBudget | null>;
}

const budgetSchema = new mongoose.Schema<IBudget>(
  {
    homeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Home', required: true },
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
    month: { type: String, required: true, match: /^\d{4}-(0[1-9]|1[0-2])$/ },
    limitMinor: { type: Number, required: true, min: 1 },
    currency: { type: String, enum: Object.values(Currency), required: true },
  },
  { timestamps: true }
);

budgetSchema.index({ homeId: 1, month: 1 });
budgetSchema.index({ homeId: 1, categoryId: 1, month: 1 }, { unique: true });

/** Implementación de los estáticos; se copian al modelo vía schema.loadClass. */
class BudgetModel extends Model<IBudget> {
  static findByIdForHome(
    this: IBudgetModel,
    budgetId: Types.ObjectId | string,
    homeId: Types.ObjectId | string
  ) {
    return this.findOne({ _id: budgetId, homeId }).lean();
  }

  static findForMonth(
    this: IBudgetModel,
    homeId: Types.ObjectId | string,
    categoryId: Types.ObjectId | string,
    month: string,
    excludeId: Types.ObjectId | null = null
  ) {
    return this.findOne({
      homeId,
      categoryId,
      month,
      ...(excludeId ? { _id: { $ne: excludeId } } : {}),
    }).lean();
  }
}

budgetSchema.loadClass(BudgetModel);

export const Budget = mongoose.model<IBudget, IBudgetModel>('Budget', budgetSchema);
