import mongoose from 'mongoose';

const categorySchema = new mongoose.Schema(
  {
    homeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Home', required: true },
    name: { type: String, required: true, trim: true, maxlength: 40 },
    color: { type: String, default: '#67718a', match: /^#[0-9a-fA-F]{6}$/ },
    type: { type: String, enum: ['income', 'expense'], required: true },
    isDefault: { type: Boolean, default: false },
    archived: { type: Boolean, default: false },
  },
  { timestamps: true }
);

categorySchema.index({ homeId: 1, type: 1 });

export const Category = mongoose.model('Category', categorySchema);
