import { logger } from "@/lib/logger";

import { getMCPClient } from "./client";
import type {
  SwarmInitParams,
  SwarmStatusResult,
  AgentSpawnParams,
  AgentSpawnResult,
  MemorySearchParams,
  MemorySearchResult,
  MemoryStoreParams,
  MemoryStoreResult,
  MemoryRetrieveParams,
  MemoryRetrieveResult,
  HookRouteParams,
  HookRouteResult,
  HookPreTaskParams,
  HookPostTaskParams,
  NeuralTrainParams,
  NeuralTrainResult,
  HiveMindInitParams,
  MCPToolCallResult,
} from "./types";

const parseToolText = (result: MCPToolCallResult): string => {
  return result.content?.[0]?.text ?? JSON.stringify(result);
};

const parseToolJSON = <T>(result: MCPToolCallResult): T => {
  const text = parseToolText(result);
  try {
    return JSON.parse(text) as T;
  } catch {
    return text as unknown as T;
  }
};

const findTool = (toolNames: string[], ...candidates: string[]): string | null => {
  for (const candidate of candidates) {
    const match = toolNames.find((t) => t === candidate || t.includes(candidate));
    if (match) return match;
  }
  return null;
};

export const swarmInit = async (params: SwarmInitParams = {}): Promise<SwarmStatusResult | null> => {
  try {
    const client = getMCPClient();
    if (!client.isReady()) return null;

    const toolName = findTool(client.getToolNames(), "swarm_init", "swarm");
    if (!toolName) {
      logger.warn("No swarm_init tool found in MCP");
      return null;
    }

    const result = await client.callTool(toolName, {
      topology: params.topology ?? "hierarchical",
      maxAgents: params.maxAgents ?? 8,
      strategy: params.strategy ?? "specialized",
    });

    return parseToolJSON<SwarmStatusResult>(result);
  } catch (err) {
    logger.warn("swarmInit failed", { error: String(err) });
    return null;
  }
};

export const swarmStatus = async (): Promise<SwarmStatusResult | null> => {
  try {
    const client = getMCPClient();
    if (!client.isReady()) return null;

    const toolName = findTool(client.getToolNames(), "swarm_status", "status");
    if (!toolName) return null;

    const result = await client.callTool(toolName, {});
    return parseToolJSON<SwarmStatusResult>(result);
  } catch (err) {
    logger.warn("swarmStatus failed", { error: String(err) });
    return null;
  }
};

export const agentSpawn = async (params: AgentSpawnParams): Promise<AgentSpawnResult | null> => {
  try {
    const client = getMCPClient();
    if (!client.isReady()) return null;

    const toolName = findTool(client.getToolNames(), "agent_spawn", "agent");
    if (!toolName) return null;

    const result = await client.callTool(toolName, {
      type: params.type,
      name: params.name,
    });

    return parseToolJSON<AgentSpawnResult>(result);
  } catch (err) {
    logger.warn("agentSpawn failed", { error: String(err) });
    return null;
  }
};

export const memorySearch = async (params: MemorySearchParams): Promise<MemorySearchResult | null> => {
  try {
    const client = getMCPClient();
    if (!client.isReady()) return null;

    const toolName = findTool(client.getToolNames(), "memory_usage", "memory");
    if (!toolName) return null;

    const result = await client.callTool(toolName, {
      action: "search",
      query: params.query,
      namespace: params.namespace ?? "patterns",
    });

    return parseToolJSON<MemorySearchResult>(result);
  } catch (err) {
    logger.warn("memorySearch failed", { error: String(err) });
    return null;
  }
};

export const memoryStore = async (params: MemoryStoreParams): Promise<MemoryStoreResult | null> => {
  try {
    const client = getMCPClient();
    if (!client.isReady()) return null;

    const toolName = findTool(client.getToolNames(), "memory_usage", "memory");
    if (!toolName) return null;

    const result = await client.callTool(toolName, {
      action: "store",
      key: params.key,
      value: params.value,
      namespace: params.namespace ?? "patterns",
    });

    return parseToolJSON<MemoryStoreResult>(result);
  } catch (err) {
    logger.warn("memoryStore failed", { error: String(err) });
    return null;
  }
};

export const memoryRetrieve = async (params: MemoryRetrieveParams): Promise<MemoryRetrieveResult | null> => {
  try {
    const client = getMCPClient();
    if (!client.isReady()) return null;

    const toolName = findTool(client.getToolNames(), "memory_usage", "memory");
    if (!toolName) return null;

    const result = await client.callTool(toolName, {
      action: "retrieve",
      key: params.key,
      namespace: params.namespace ?? "patterns",
    });

    return parseToolJSON<MemoryRetrieveResult>(result);
  } catch (err) {
    logger.warn("memoryRetrieve failed", { error: String(err) });
    return null;
  }
};

export const hookRoute = async (params: HookRouteParams): Promise<HookRouteResult | null> => {
  try {
    const client = getMCPClient();
    if (!client.isReady()) return null;

    const toolName = findTool(client.getToolNames(), "hooks_route", "route");
    if (!toolName) return null;

    const result = await client.callTool(toolName, { task: params.task });
    return parseToolJSON<HookRouteResult>(result);
  } catch (err) {
    logger.warn("hookRoute failed", { error: String(err) });
    return null;
  }
};

export const hookPreTask = async (params: HookPreTaskParams): Promise<string | null> => {
  try {
    const client = getMCPClient();
    if (!client.isReady()) return null;

    const toolName = findTool(client.getToolNames(), "hooks_pre_task", "pre_task", "pre-task");
    if (!toolName) return null;

    const result = await client.callTool(toolName, { description: params.description });
    return parseToolText(result);
  } catch (err) {
    logger.warn("hookPreTask failed", { error: String(err) });
    return null;
  }
};

export const hookPostTask = async (params: HookPostTaskParams): Promise<string | null> => {
  try {
    const client = getMCPClient();
    if (!client.isReady()) return null;

    const toolName = findTool(
      client.getToolNames(),
      "hooks_post_task",
      "post_task",
      "post-task",
    );
    if (!toolName) return null;

    const result = await client.callTool(toolName, {
      taskId: params.taskId,
      success: params.success,
      trainNeural: params.trainNeural ?? true,
    });
    return parseToolText(result);
  } catch (err) {
    logger.warn("hookPostTask failed", { error: String(err) });
    return null;
  }
};

export const neuralTrain = async (params: NeuralTrainParams): Promise<NeuralTrainResult | null> => {
  try {
    const client = getMCPClient();
    if (!client.isReady()) return null;

    const toolName = findTool(client.getToolNames(), "neural_train", "neural");
    if (!toolName) return null;

    const result = await client.callTool(toolName, {
      patterns: params.patterns,
      namespace: params.namespace ?? "patterns",
    });

    return parseToolJSON<NeuralTrainResult>(result);
  } catch (err) {
    logger.warn("neuralTrain failed", { error: String(err) });
    return null;
  }
};

export const hiveMindInit = async (params: HiveMindInitParams = {}): Promise<string | null> => {
  try {
    const client = getMCPClient();
    if (!client.isReady()) return null;

    const toolName = findTool(client.getToolNames(), "hive-mind_init", "hive_mind", "hivemind");
    if (!toolName) return null;

    const result = await client.callTool(toolName, {
      topology: params.topology ?? "hierarchical-mesh",
      maxWorkers: params.maxWorkers ?? 8,
    });

    return parseToolText(result);
  } catch (err) {
    logger.warn("hiveMindInit failed", { error: String(err) });
    return null;
  }
};

export const ping = async (): Promise<boolean> => {
  try {
    const client = getMCPClient();
    if (!client.isReady()) return false;

    await client.request("ping");
    return true;
  } catch {
    return false;
  }
};

export const getAvailableTools = (): string[] => {
  const client = getMCPClient();
  return client.getToolNames();
};
