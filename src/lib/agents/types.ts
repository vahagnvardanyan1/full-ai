// ──────────────────────────────────────────────────────────
// Shared type definitions for the multi-agent system
// ──────────────────────────────────────────────────────────

/** Enum of every agent role in the system */
export type AgentRole =
  | "orchestrator"
  | "product_manager"
  | "frontend_developer"
  | "qa"
  | "devops";

/** Task lifecycle statuses for the Kanban board */
export type TaskStatus = "open" | "in_progress" | "review" | "testing" | "done";

/** A single tool invocation recorded during an agent run */
export interface ToolCall {
  tool: string;
  arguments: Record<string, unknown>;
  result: unknown;
}

/** The structured response every agent returns */
export interface AgentResponse {
  agent: AgentRole;
  summary: string;
  toolCalls: ToolCall[];
  /** Raw markdown / text the agent produced */
  detail: string;
}

/** A task created by the PM agent and assigned to a team member / agent */
export interface TaskItem {
  id: string;
  title: string;
  description: string;
  type: "task" | "story" | "bug";
  priority: "high" | "medium" | "low";
  assignedTo: string;
  status: TaskStatus;
  labels: string[];
  createdAt: string;
}

/** A generated code file produced by an agent */
export interface GeneratedFile {
  id: string;
  filePath: string;
  language: string;
  code: string;
  description: string;
  createdBy: string;
  createdAt: string;
}

/** Top-level response returned by the orchestrator API route */
export interface OrchestratorResponse {
  requestId: string;
  userRequest: string;
  plan: string;
  agentResults: AgentResponse[];
  /** Tasks created during this orchestration run */
  tasks: TaskItem[];
  /** Code files generated during this orchestration run */
  files: GeneratedFile[];
}

// ── SSE streaming event types ────────────────────────────

export type StreamEvent =
  | { type: "plan"; plan: string; agents: AgentRole[]; phases: AgentRole[][] }
  | { type: "agent_start"; agent: AgentRole }
  | {
      type: "agent_complete";
      response: AgentResponse;
      tasks: TaskItem[];
      files: GeneratedFile[];
    }
  | { type: "error"; agent: AgentRole; message: string }
  | { type: "tasks_updated"; tasks: TaskItem[] }
  | { type: "done"; requestId: string };

/** Shape of the request body sent from the frontend */
export interface OrchestrateRequestBody {
  message: string;
  /** Optional session id to maintain conversation state */
  sessionId?: string;
}

/** Minimal conversation message stored for context */
export interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

/** In-memory session store entry */
export interface Session {
  id: string;
  messages: ConversationMessage[];
  createdAt: number;
}
