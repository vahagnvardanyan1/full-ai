import { spawn } from "node:child_process";
import { createInterface } from "node:readline";

import { logger } from "@/lib/logger";

import type { MCPInitializeResult, MCPToolCallResult, MCPToolsListResult } from "./types";

const MCP_COMMAND = "npx";
const MCP_ARGS = ["-y", "@claude-flow/cli@latest", "mcp", "start"];
const MCP_ENV: Record<string, string> = {
  CLAUDE_FLOW_MODE: "v3",
  CLAUDE_FLOW_HOOKS_ENABLED: "true",
  CLAUDE_FLOW_TOPOLOGY: "hierarchical-mesh",
  CLAUDE_FLOW_MAX_AGENTS: "15",
  CLAUDE_FLOW_MEMORY_BACKEND: "hybrid",
  npm_config_update_notifier: "false",
};
const REQUEST_TIMEOUT_MS = 30_000;
const STARTUP_TIMEOUT_MS = 90_000;

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

let instance: MCPClient | null = null;

export class MCPClient {
  private process: ReturnType<typeof spawn> | null = null;
  private pendingRequests = new Map<number, PendingRequest>();
  private nextId = 1;
  private initialized = false;
  private toolNames: string[] = [];
  private starting = false;
  private startPromise: Promise<void> | null = null;

  static getInstance(): MCPClient {
    if (!instance) {
      instance = new MCPClient();
    }
    return instance;
  }

  async ensureReady(): Promise<boolean> {
    if (this.initialized && this.process && !this.process.killed) {
      return true;
    }

    if (this.starting && this.startPromise) {
      try {
        await this.startPromise;
        return this.initialized;
      } catch {
        return false;
      }
    }

    this.starting = true;
    this.startPromise = this.start();

    try {
      await this.startPromise;
      return this.initialized;
    } catch {
      return false;
    } finally {
      this.starting = false;
      this.startPromise = null;
    }
  }

  private async start(): Promise<void> {
    this.cleanup();

    logger.info("Starting Ruflo MCP server...");

    const serverProcess = spawn(MCP_COMMAND, MCP_ARGS, {
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, ...MCP_ENV },
    });

    this.process = serverProcess;

    serverProcess.on("error", (err) => {
      logger.error("MCP server process error", { error: err.message });
      this.initialized = false;
    });

    serverProcess.on("exit", (code) => {
      logger.info("MCP server process exited", { code });
      this.initialized = false;
      this.rejectAllPending(new Error(`MCP server exited with code ${code}`));
    });

    const rl = createInterface({ input: serverProcess.stdout! });
    rl.on("line", (line) => {
      if (!line.trim()) return;
      try {
        const msg = JSON.parse(line);
        if (msg.id !== undefined && this.pendingRequests.has(msg.id)) {
          const { resolve, reject, timer } = this.pendingRequests.get(msg.id)!;
          this.pendingRequests.delete(msg.id);
          clearTimeout(timer);
          if (msg.error) {
            reject(new Error(JSON.stringify(msg.error)));
          } else {
            resolve(msg.result);
          }
        }
      } catch {
        // non-JSON line
      }
    });

    await this.waitForReady(serverProcess);

    const initResult = await this.request("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "full-ai", version: "1.0.0" },
    }) as MCPInitializeResult;

    this.notify("notifications/initialized");

    logger.info("MCP server initialized", {
      server: initResult.serverInfo?.name,
      version: initResult.serverInfo?.version,
    });

    const toolsResult = await this.request("tools/list") as MCPToolsListResult;
    this.toolNames = (toolsResult.tools || []).map((t) => t.name);

    logger.info("MCP tools loaded", { count: this.toolNames.length });

    this.initialized = true;

    this.registerShutdownHandlers();
  }

  private waitForReady(serverProcess: ReturnType<typeof spawn>): Promise<void> {
    return new Promise((resolve) => {
      let ready = false;

      const onData = (chunk: Buffer) => {
        const text = chunk.toString();
        if (text.includes("Starting in stdio mode") || text.includes("mcp-stdio")) {
          ready = true;
          serverProcess.stderr?.off("data", onData);
          resolve();
        }
      };

      serverProcess.stderr?.on("data", onData);

      setTimeout(() => {
        if (!ready) {
          serverProcess.stderr?.off("data", onData);
          resolve();
        }
      }, STARTUP_TIMEOUT_MS);
    });
  }

  request(method: string, params: Record<string, unknown> = {}): Promise<unknown> {
    return new Promise((resolve, reject) => {
      if (!this.process || this.process.killed) {
        reject(new Error("MCP server not running"));
        return;
      }

      const id = this.nextId++;
      const timer = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`MCP ${method} timed out after ${REQUEST_TIMEOUT_MS / 1000}s`));
      }, REQUEST_TIMEOUT_MS);

      this.pendingRequests.set(id, { resolve, reject, timer });

      const msg = JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n";
      this.process.stdin?.write(msg);
    });
  }

  notify(method: string, params: Record<string, unknown> = {}): void {
    if (!this.process || this.process.killed) return;
    const msg = JSON.stringify({ jsonrpc: "2.0", method, params }) + "\n";
    this.process.stdin?.write(msg);
  }

  async callTool(name: string, args: Record<string, unknown> = {}): Promise<MCPToolCallResult> {
    const result = await this.request("tools/call", { name, arguments: args });
    return result as MCPToolCallResult;
  }

  getToolNames(): string[] {
    return this.toolNames;
  }

  isReady(): boolean {
    return this.initialized && !!this.process && !this.process.killed;
  }

  private rejectAllPending(error: Error): void {
    for (const [id, { reject, timer }] of this.pendingRequests) {
      clearTimeout(timer);
      reject(error);
      this.pendingRequests.delete(id);
    }
  }

  private cleanup(): void {
    if (this.process && !this.process.killed) {
      this.process.kill("SIGTERM");
    }
    this.rejectAllPending(new Error("MCP client cleanup"));
    this.process = null;
    this.initialized = false;
    this.toolNames = [];
  }

  shutdown(): void {
    logger.info("Shutting down MCP client");
    this.cleanup();
    instance = null;
  }

  private registerShutdownHandlers(): void {
    const handler = () => this.shutdown();
    process.once("SIGINT", handler);
    process.once("SIGTERM", handler);
    process.once("beforeExit", handler);
  }
}

export const getMCPClient = (): MCPClient => MCPClient.getInstance();
