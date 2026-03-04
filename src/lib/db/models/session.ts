import mongoose, { type Document, type Model } from "mongoose";

export interface IConversationMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

export interface ISessionDocument extends Document {
  sessionId: string;
  messages: IConversationMessage[];
  createdAt: Date;
  updatedAt: Date;
}

const conversationMessageSchema = new mongoose.Schema<IConversationMessage>(
  {
    role: { type: String, enum: ["user", "assistant"], required: true },
    content: { type: String, required: true },
    timestamp: { type: Number, required: true },
  },
  { _id: false },
);

const sessionSchema = new mongoose.Schema<ISessionDocument>(
  {
    sessionId: { type: String, required: true, unique: true, index: true },
    messages: { type: [conversationMessageSchema], default: [] },
  },
  { timestamps: true },
);

export const SessionModel: Model<ISessionDocument> =
  mongoose.models.Session ??
  mongoose.model<ISessionDocument>("Session", sessionSchema);
