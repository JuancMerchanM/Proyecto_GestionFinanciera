import mongoose, { Model, Types } from 'mongoose';

/** Aporte (o retiro, si el monto es negativo) de una meta de ahorro. */
export interface IContribution {
  _id: Types.ObjectId;
  amountMinor: number;
  date: Date;
  note: string;
  createdAt: Date;
}

export interface IGoal {
  _id: Types.ObjectId;
  homeId: Types.ObjectId;
  name: string;
  targetMinor: number;
  color: string | null;
  /** Fecha límite opcional (null = sin fecha). */
  deadline: Date | null;
  archived: boolean;
  createdBy: Types.ObjectId;
  /** Aportes manuales; el ahorro total se deriva de ellos (sin campo guardado). */
  contributions: IContribution[];
  createdAt: Date;
  updatedAt: Date;
}

/** Contrato del modelo: API de mongoose + estáticos propios (POO). */
export interface IGoalModel extends Model<IGoal> {
  findByIdForHome(
    goalId: Types.ObjectId | string,
    homeId: Types.ObjectId | string
  ): Promise<IGoal | null>;
}

const contributionSchema = new mongoose.Schema<IContribution>(
  {
    amountMinor: { type: Number, required: true },
    date: { type: Date, required: true },
    note: { type: String, default: '', trim: true, maxlength: 200 },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const goalSchema = new mongoose.Schema<IGoal>(
  {
    homeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Home', required: true },
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 60 },
    targetMinor: { type: Number, required: true, min: 1 },
    color: { type: String, default: null, match: /^#[0-9a-fA-F]{6}$/ },
    deadline: { type: Date, default: null },
    archived: { type: Boolean, default: false },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    contributions: { type: [contributionSchema], default: [] },
  },
  { timestamps: true }
);

goalSchema.index({ homeId: 1, createdAt: -1 });

/** Implementación de los estáticos; se copian al modelo vía schema.loadClass. */
class GoalModel extends Model<IGoal> {
  static findByIdForHome(
    this: IGoalModel,
    goalId: Types.ObjectId | string,
    homeId: Types.ObjectId | string
  ) {
    return this.findOne({ _id: goalId, homeId }).lean();
  }
}

goalSchema.loadClass(GoalModel);

export const Goal = mongoose.model<IGoal, IGoalModel>('Goal', goalSchema);
