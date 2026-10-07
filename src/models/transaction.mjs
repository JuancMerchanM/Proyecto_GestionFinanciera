import mongoose from 'mongoose';

const transactionSchema = new mongoose.Schema(
  {
    homeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Home', required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    accountId: { type: mongoose.Schema.Types.ObjectId, ref: 'Account', required: true },
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
    type: { type: String, enum: ['income', 'expense'], required: true },
    amountMinor: { type: Number, required: true },
    currency: { type: String, enum: ['COP', 'USD'], required: true },
    date: { type: Date, required: true },
    note: { type: String, default: '', maxlength: 200, trim: true },
  },
  { timestamps: true }
);

transactionSchema.index({ homeId: 1, date: -1 });
transactionSchema.index({ homeId: 1, categoryId: 1, date: -1 });
transactionSchema.index({ homeId: 1, accountId: 1, date: -1 });
transactionSchema.index({ homeId: 1, userId: 1, date: -1 });

export const Transaction = mongoose.model('Transaction', transactionSchema);
