import mongoose from 'mongoose';

const budgetSchema = new mongoose.Schema(
  {
    homeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Home', required: true },
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
    month: { type: String, required: true, match: /^\d{4}-(0[1-9]|1[0-2])$/ },
    limitMinor: { type: Number, required: true, min: 1 },
    currency: { type: String, enum: ['COP', 'USD'], required: true },
  },
  { timestamps: true }
);

budgetSchema.index({ homeId: 1, month: 1 });
budgetSchema.index({ homeId: 1, categoryId: 1, month: 1 }, { unique: true });

export const Budget = mongoose.model('Budget', budgetSchema);
