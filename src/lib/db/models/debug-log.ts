import mongoose, { type Document, type Model } from "mongoose";

export interface IDebugLogDocument extends Document {
  ts: Date;
  level: string;
  msg: string;
  meta: Record<string, unknown>;
  createdAt: Date;
}

const debugLogSchema = new mongoose.Schema<IDebugLogDocument>(
  {
    ts: { type: Date, required: true, index: true },
    level: { type: String, required: true },
    msg: { type: String, required: true },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);

// Auto-delete after 1 hour
debugLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 3600 });

export const DebugLogModel: Model<IDebugLogDocument> =
  (mongoose.models.DebugLog as Model<IDebugLogDocument>) ??
  mongoose.model<IDebugLogDocument>("DebugLog", debugLogSchema, "debug_logs");
