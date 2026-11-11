import mongoose from 'mongoose';

const vehicleSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    length: { type: Number, required: true, min: 0.001 },
    width: { type: Number, required: true, min: 0.001 },
    height: { type: Number, required: true, min: 0.001 },
    maxPayloadKg: { type: Number, required: true, min: 0.001 },
    rearDoorWidth: { type: Number, required: true, min: 0.001 },
    rearDoorHeight: { type: Number, required: true, min: 0.001 },
  },
  { timestamps: true },
);
const packageSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    label: { type: String, required: true },
    length: { type: Number, required: true, min: 0.001 },
    width: { type: Number, required: true, min: 0.001 },
    height: { type: Number, required: true, min: 0.001 },
    weight: { type: Number, required: true, min: 0.001 },
    stop: { type: Number, required: true, min: 1 },
    fragile: Boolean,
    noStack: Boolean,
    baseRotationAllowed: Boolean,
    maxStackingLoadKg: { type: Number, default: null, min: 0 },
  },
  { _id: false },
);
const resultSchema = new mongoose.Schema(
  {
    valid: Boolean,
    errors: [String],
    placed: [mongoose.Schema.Types.Mixed],
    unplaced: [mongoose.Schema.Types.Mixed],
    unloadingOrder: [String],
    accessibility: mongoose.Schema.Types.Mixed,
    stacking: [mongoose.Schema.Types.Mixed],
    score: Number,
    constraints: mongoose.Schema.Types.Mixed,
    metrics: mongoose.Schema.Types.Mixed,
    assumptions: [String],
  },
  { _id: false, suppressReservedKeysWarning: true },
);
const planSchema = new mongoose.Schema(
  {
    ownerId: { type: String, required: true, index: true },
    name: { type: String, required: true, maxlength: 100 },
    vehicle: { type: vehicleSchema, required: true },
    packages: [packageSchema],
    result: { type: resultSchema, default: null },
  },
  { timestamps: true },
);

const presetSchema = vehicleSchema.clone();
presetSchema.add({ ownerId: { type: String, required: true, index: true } });
planSchema.index({ ownerId: 1, updatedAt: -1 });
const userSchema = new mongoose.Schema(
  { _id: String, name: String, email: String },
  { timestamps: true },
);
const sessionSchema = new mongoose.Schema({
  _id: String,
  user: { _id: String, name: String, email: String },
  csrfToken: String,
  expiresAt: { type: Date, expires: 0 },
});
const flowSchema = new mongoose.Schema({
  _id: String,
  browserHash: String,
  verifier: String,
  nonce: String,
  returnTo: String,
  expiresAt: { type: Date, expires: 0 },
});
export const Vehicle =
  mongoose.models.Vehicle || mongoose.model('Vehicle', presetSchema);
export const LoadPlan =
  mongoose.models.LoadPlan || mongoose.model('LoadPlan', planSchema);
export const User = mongoose.models.User || mongoose.model('User', userSchema);
export const Session =
  mongoose.models.Session || mongoose.model('Session', sessionSchema);
export const OAuthFlow =
  mongoose.models.OAuthFlow || mongoose.model('OAuthFlow', flowSchema);
