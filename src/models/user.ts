import mongoose, { Model, Types } from 'mongoose';

export interface IUser {
  _id: Types.ObjectId;
  name: string;
  email: string;
  passwordHash: string;
  homeIds: Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

/** Contrato del modelo: API de mongoose + estáticos propios (POO). */
export interface IUserModel extends Model<IUser> {
  findByEmail(email: string): Promise<IUser | null>;
  findLeanById(userId: Types.ObjectId | string): Promise<IUser | null>;
}

const userSchema = new mongoose.Schema<IUser>(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    homeIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Home', default: [] }],
  },
  { timestamps: true }
);

userSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete (ret as Partial<IUser>).passwordHash;
    return ret;
  },
});

/** Implementación de los estáticos; se copian al modelo vía schema.loadClass. */
class UserModel extends Model<IUser> {
  static findByEmail(this: IUserModel, email: string) {
    return this.findOne({ email: email.trim().toLowerCase() }).lean();
  }

  static findLeanById(this: IUserModel, userId: Types.ObjectId | string) {
    return this.findById(userId).lean();
  }
}

userSchema.loadClass(UserModel);

export const User = mongoose.model<IUser, IUserModel>('User', userSchema);
