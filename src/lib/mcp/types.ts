export interface SwarmInitParams {
  topology?: "hierarchical" | "mesh" | "hierarchical-mesh" | "ring" | "star" | "adaptive";
  maxAgents?: number;
  strategy?: "balanced" | "specialized" | "adaptive";
}

export interface SwarmStatusResult {
  active: boolean;
  topology: string;
  agentCount: number;
  status: string;
}

export interface AgentSpawnParams {
  type: string;
  name: string;
}

export interface AgentSpawnResult {
  id: string;
  type: string;
  name: string;
  status: string;
}

export interface MemorySearchParams {
  query: string;
  namespace?: string;
  limit?: number;
}

export interface MemorySearchResult {
  results: Array<{
    key: string;
    value: string;
    score: number;
    namespace: string;
  }>;
}

export interface MemoryStoreParams {
  key: string;
  value: string;
  namespace?: string;
}

export interface MemoryStoreResult {
  success: boolean;
  key: string;
}

export interface MemoryRetrieveParams {
  key: string;
  namespace?: string;
}

export interface MemoryRetrieveResult {
  key: string;
  value: string;
  namespace: string;
}

export interface HookRouteParams {
  task: string;
}

export interface HookRouteResult {
  routingCode: number;
  complexity: "low" | "medium" | "high";
  suggestedAgents: string[];
  suggestedTopology: string;
}

export interface HookPreTaskParams {
  description: string;
}

export interface HookPostTaskParams {
  taskId: string;
  success: boolean;
  trainNeural?: boolean;
}

export interface NeuralTrainParams {
  patterns: string[];
  namespace?: string;
}

export interface NeuralTrainResult {
  trained: boolean;
  patternsCount: number;
}

export interface HiveMindInitParams {
  topology?: string;
  maxWorkers?: number;
}

export interface MCPToolCallResult {
  content?: Array<{ type: string; text: string }>;
  isError?: boolean;
}

export interface MCPInitializeResult {
  serverInfo?: {
    name: string;
    version: string;
  };
  capabilities?: Record<string, unknown>;
}

export interface MCPToolInfo {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

export interface MCPToolsListResult {
  tools: MCPToolInfo[];
}
