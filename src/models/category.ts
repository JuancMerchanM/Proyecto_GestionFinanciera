import mongoose, { Model, Types } from 'mongoose';
import type { QueryFilter } from 'mongoose';

export enum MovementType {
  Income = 'income',
  Expense = 'expense',
}

export interface ICategory {
  _id: Types.ObjectId;
  homeId: Types.ObjectId;
  name: string;
  color: string;
  type: MovementType;
  isDefault: boolean;
  archived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/** Contrato del modelo: API de mongoose + estáticos propios (POO). */
export interface ICategoryModel extends Model<ICategory> {
  existsName(
    homeId: Types.ObjectId | string,
    name: string,
    type: MovementType,
    excludeId?: Types.ObjectId | null
  ): Promise<boolean>;
  findByIdForHome(
    categoryId: Types.ObjectId | string,
    homeId: Types.ObjectId | string
  ): Promise<ICategory | null>;
}

const categorySchema = new mongoose.Schema<ICategory>(
  {
    homeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Home', required: true },
    name: { type: String, required: true, trim: true, maxlength: 40 },
    color: { type: String, default: '#67718a', match: /^#[0-9a-fA-F]{6}$/ },
    type: { type: String, enum: Object.values(MovementType), required: true },
    isDefault: { type: Boolean, default: false },
    archived: { type: Boolean, default: false },
  },
  { timestamps: true }
);

categorySchema.index({ homeId: 1, type: 1 });

/** Implementación de los estáticos; se copian al modelo vía schema.loadClass. */
class CategoryModel extends Model<ICategory> {
  static async existsName(
    this: ICategoryModel,
    homeId: Types.ObjectId | string,
    name: string,
    type: MovementType,
    excludeId: Types.ObjectId | null = null
  ): Promise<boolean> {
    const filter: QueryFilter<ICategory> = {
      homeId,
      type,
      archived: false,
      name: { $regex: `^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' },
    };
    if (excludeId) filter._id = { $ne: excludeId };
    return Boolean(await this.exists(filter));
  }

  static findByIdForHome(this: ICategoryModel, categoryId: Types.ObjectId | string, homeId: Types.ObjectId | string) {
    return this.findOne({ _id: categoryId, homeId }).lean();
  }
}

categorySchema.loadClass(CategoryModel);

export const Category = mongoose.model<ICategory, ICategoryModel>('Category', categorySchema);
