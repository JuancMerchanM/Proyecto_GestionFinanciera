import mongoose from 'mongoose';

const accountSchema = new mongoose.Schema(
  {
    homeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Home', required: true },
    name: { type: String, required: true, trim: true, maxlength: 40 },
    type: { type: String, enum: ['cash', 'bank', 'card', 'savings'], required: true },
    currency: { type: String, enum: ['COP', 'USD'], required: true },
    openingBalanceMinor: { type: Number, default: 0 },
    archived: { type: Boolean, default: false },
  },
  { timestamps: true }
);

accountSchema.index({ homeId: 1, archived: 1 });

export const Account = mongoose.model('Account', accountSchema);
