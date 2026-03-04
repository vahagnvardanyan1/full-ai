import mongoose, { type Document, type Model } from "mongoose";

import type { StreamEvent, AgentRole } from "@/lib/agents/types";

// ── Embedded sub-documents ────────────────────────────────

export interface ITask {
  id: string;
  title: string;
  description: string;
  type: "task" | "story" | "bug";
  priority: "high" | "medium" | "low";
  assignedTo: string;
  createdBy: string;
  status: string;
  labels: string[];
  createdAt: string;
}

export interface ICodeFile {
  id: string;
  filePath: string;
  language: string;
  code: string;
  description: string;
  createdBy: string;
  createdAt: string;
}

export interface IAgentResult {
  agent: AgentRole;
  summary: string;
  detail: string;
  prUrl?: string;
  toolCalls: Array<{
    tool: string;
    arguments: Record<string, unknown>;
    result: unknown;
  }>;
}

// ── Main document ─────────────────────────────────────────

export interface IWorkflowRunDocument extends Document {
  requestId: string;
  sessionId: string;
  userMessage: string;
  status: "running" | "completed" | "failed";
  planSummary: string;
  phases: AgentRole[][];
  events: StreamEvent[];
  tasks: ITask[];
  files: ICodeFile[];
  agentResults: IAgentResult[];
  createdAt: Date;
  updatedAt: Date;
}

// ── Schemas ───────────────────────────────────────────────

const taskSchema = new mongoose.Schema<ITask>(
  {
    id: String,
    title: String,
    description: String,
    type: { type: String, enum: ["task", "story", "bug"] },
    priority: { type: String, enum: ["high", "medium", "low"] },
    assignedTo: String,
    createdBy: String,
    status: String,
    labels: [String],
    createdAt: String,
  },
  { _id: false },
);

const codeFileSchema = new mongoose.Schema<ICodeFile>(
  {
    id: String,
    filePath: String,
    language: String,
    code: String,
    description: String,
    createdBy: String,
    createdAt: String,
  },
  { _id: false },
);

const agentResultSchema = new mongoose.Schema<IAgentResult>(
  {
    agent: String,
    summary: String,
    detail: String,
    prUrl: String,
    toolCalls: { type: mongoose.Schema.Types.Mixed, default: [] },
  },
  { _id: false },
);

const workflowRunSchema = new mongoose.Schema<IWorkflowRunDocument>(
  {
    requestId: { type: String, required: true, unique: true, index: true },
    sessionId: { type: String, required: true, index: true },
    userMessage: { type: String, required: true },
    status: {
      type: String,
      enum: ["running", "completed", "failed"],
      default: "running",
    },
    planSummary: { type: String, default: "" },
    phases: { type: [[String]], default: [] },
    // Store every SSE event so the UI can replay on reload
    events: { type: [mongoose.Schema.Types.Mixed], default: [] },
    tasks: { type: [taskSchema], default: [] },
    files: { type: [codeFileSchema], default: [] },
    agentResults: { type: [agentResultSchema], default: [] },
  },
  { timestamps: true },
);

export const WorkflowRunModel: Model<IWorkflowRunDocument> =
  (mongoose.models.WorkflowRun as Model<IWorkflowRunDocument>) ??
  mongoose.model<IWorkflowRunDocument>("WorkflowRun", workflowRunSchema, "workflows-run");
