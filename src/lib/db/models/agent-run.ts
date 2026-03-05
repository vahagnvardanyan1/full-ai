import mongoose, { type Document, type Model } from "mongoose";

export type AgentRunStatus = "completed" | "failed";

export interface IAgentRunDocument extends Document {
  runId: string;
  agentType: string;
  status: AgentRunStatus;
  input: Record<string, unknown>;
  errorCode?: number;
  createdAt: Date;
  updatedAt: Date;
}

const agentRunSchema = new mongoose.Schema<IAgentRunDocument>(
  {
    runId: { type: String, required: true, unique: true, index: true },
    agentType: { type: String, required: true, index: true },
    status: {
      type: String,
      enum: ["completed", "failed"] as AgentRunStatus[],
      required: true,
    },
    input: { type: mongoose.Schema.Types.Mixed, required: true },
    errorCode: { type: Number },
  },
  { timestamps: true },
);

agentRunSchema.index({ agentType: 1, createdAt: -1 });

export const AgentRunModel: Model<IAgentRunDocument> =
  (mongoose.models.AgentRun as Model<IAgentRunDocument>) ??
  mongoose.model<IAgentRunDocument>("AgentRun", agentRunSchema, "agent_runs");
