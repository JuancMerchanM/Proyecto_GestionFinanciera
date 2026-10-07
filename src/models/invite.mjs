import mongoose from 'mongoose';

const inviteSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    homeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Home', required: true },
    role: { type: String, enum: ['admin', 'member'], default: 'member' },
    email: { type: String, default: null, lowercase: true, trim: true },
    status: { type: String, enum: ['pending', 'accepted', 'rejected'], default: 'pending' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    expiresAt: { type: Date, required: true },
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    resolvedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

inviteSchema.index({ homeId: 1, status: 1 });

export const Invite = mongoose.model('Invite', inviteSchema);
