/**
 * Ruflo MCP Integration Test for full-ai.
 *
 * Spawns the MCP server via the npm package (@claude-flow/cli@latest),
 * sends JSON-RPC over newline-delimited stdio, and verifies we can
 * list tools, check status, use memory, and test swarm init.
 *
 * Usage:  node scripts/test-ruflo-integration.mjs
 */

import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { randomUUID } from "node:crypto";

const REQUEST_TIMEOUT_MS = 30_000;

// ── Newline-delimited JSON-RPC client ───────────────────

const createMCPClient = (serverProcess) => {
  const pendingRequests = new Map();
  let nextId = 1;

  const rl = createInterface({ input: serverProcess.stdout });

  rl.on("line", (line) => {
    if (!line.trim()) return;
    try {
      const msg = JSON.parse(line);
      if (msg.id !== undefined && pendingRequests.has(msg.id)) {
        const { resolve, reject, timer } = pendingRequests.get(msg.id);
        pendingRequests.delete(msg.id);
        clearTimeout(timer);
        if (msg.error) reject(new Error(JSON.stringify(msg.error)));
        else resolve(msg.result);
      }
    } catch {
      // non-JSON line, ignore
    }
  });

  const request = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = nextId++;
      const timer = setTimeout(() => {
        pendingRequests.delete(id);
        reject(new Error(`${method} timed out after ${REQUEST_TIMEOUT_MS / 1000}s`));
      }, REQUEST_TIMEOUT_MS);

      pendingRequests.set(id, { resolve, reject, timer });
      const msg = JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n";
      serverProcess.stdin.write(msg);
    });

  const notify = (method, params = {}) => {
    const msg = JSON.stringify({ jsonrpc: "2.0", method, params }) + "\n";
    serverProcess.stdin.write(msg);
  };

  return { request, notify };
};

// ── Helpers ─────────────────────────────────────────────

const log = (label, data) => {
  console.log(`\n${"─".repeat(50)}`);
  console.log(`  ✓  ${label}`);
  if (data !== undefined) {
    const text = typeof data === "string" ? data : JSON.stringify(data, null, 2);
    console.log(`     ${text.split("\n").join("\n     ")}`);
  }
};

const fail = (label, err) => {
  console.error(`\n${"─".repeat(50)}`);
  console.error(`  ✗  ${label}`);
  console.error(`     ${(err.message || String(err)).split("\n").join("\n     ")}`);
};

const waitForReady = (serverProcess, maxWaitMs = 90_000) =>
  new Promise((resolve) => {
    let ready = false;

    const onData = (chunk) => {
      const text = chunk.toString();
      if (text.includes("Starting in stdio mode") || text.includes("mcp-stdio")) {
        ready = true;
        serverProcess.stderr.off("data", onData);
        resolve(true);
      }
    };

    serverProcess.stderr.on("data", onData);

    setTimeout(() => {
      if (!ready) {
        serverProcess.stderr.off("data", onData);
        resolve(true);
      }
    }, maxWaitMs);
  });

// ── Main ────────────────────────────────────────────────

const run = async () => {
  console.log("╔══════════════════════════════════════════════════╗");
  console.log("║    Ruflo MCP Integration Test (full-ai)         ║");
  console.log("╚══════════════════════════════════════════════════╝");
  console.log("\nSpawning MCP server via npm package...");
  console.log("(First run downloads the package — this may take 30-60s)\n");

  const server = spawn("npx", ["-y", "@claude-flow/cli@latest", "mcp", "start"], {
    cwd: process.cwd(),
    stdio: ["pipe", "pipe", "pipe"],
    env: {
      ...process.env,
      npm_config_update_notifier: "false",
      CLAUDE_FLOW_MODE: "v3",
      CLAUDE_FLOW_HOOKS_ENABLED: "true",
      CLAUDE_FLOW_TOPOLOGY: "hierarchical-mesh",
      CLAUDE_FLOW_MAX_AGENTS: "15",
      CLAUDE_FLOW_MEMORY_BACKEND: "hybrid",
    },
  });

  let stderrLog = "";
  server.stderr.on("data", (chunk) => {
    stderrLog += chunk.toString();
    process.stderr.write(".");
  });

  server.on("error", (err) => {
    console.error("\nFailed to start MCP server:", err.message);
    process.exit(1);
  });

  await waitForReady(server);
  console.log("\n\nServer is ready. Running tests...");

  const client = createMCPClient(server);
  let passed = 0;
  let failed = 0;

  const test = async (label, fn) => {
    try {
      const result = await fn();
      log(label, result);
      passed++;
    } catch (err) {
      fail(label, err);
      failed++;
    }
  };

  // ── Test 1: Initialize ────────────────────────────────
  await test("1. MCP Handshake (initialize)", async () => {
    const result = await client.request("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "full-ai-test", version: "1.0.0" },
    });
    client.notify("notifications/initialized");
    return `Server: ${result.serverInfo?.name} v${result.serverInfo?.version}`;
  });

  // ── Test 2: List tools ────────────────────────────────
  let toolNames = [];
  await test("2. List available tools", async () => {
    const result = await client.request("tools/list");
    toolNames = (result.tools || []).map((t) => t.name);
    const grouped = toolNames.reduce((acc, name) => {
      const prefix = name.split("_")[0];
      acc[prefix] = (acc[prefix] || 0) + 1;
      return acc;
    }, {});
    return `${toolNames.length} tools: ${JSON.stringify(grouped)}`;
  });

  // ── Test 3: Ping ──────────────────────────────────────
  await test("3. Ping server", async () => {
    await client.request("ping");
    return "pong";
  });

  // ── Test 4: Status tool ───────────────────────────────
  const statusTool = toolNames.find(
    (t) => t.includes("status") || t.includes("system") || t.includes("health"),
  );
  if (statusTool) {
    await test(`4. Call tool: ${statusTool}`, async () => {
      const result = await client.request("tools/call", {
        name: statusTool,
        arguments: {},
      });
      const text = result.content?.[0]?.text || JSON.stringify(result);
      return text.slice(0, 400);
    });
  }

  // ── Test 5: Memory store ──────────────────────────────
  const memTool = toolNames.find((t) => t.includes("memory"));
  if (memTool) {
    await test(`5. Memory store (via ${memTool})`, async () => {
      const result = await client.request("tools/call", {
        name: memTool,
        arguments: {
          action: "store",
          key: `test-${randomUUID().slice(0, 8)}`,
          value: "Integration test from full-ai workspace",
          namespace: "test",
        },
      });
      return result.content?.[0]?.text?.slice(0, 300) || JSON.stringify(result).slice(0, 300);
    });

    await test(`6. Memory search (via ${memTool})`, async () => {
      const result = await client.request("tools/call", {
        name: memTool,
        arguments: {
          action: "search",
          query: "integration test",
          namespace: "test",
        },
      });
      return result.content?.[0]?.text?.slice(0, 300) || JSON.stringify(result).slice(0, 300);
    });
  }

  // ── Test 7: Swarm init ────────────────────────────────
  const swarmTool = toolNames.find((t) => t.includes("swarm"));
  if (swarmTool) {
    await test(`7. Swarm init (via ${swarmTool})`, async () => {
      const result = await client.request("tools/call", {
        name: swarmTool,
        arguments: {
          topology: "hierarchical",
          maxAgents: 8,
          strategy: "specialized",
        },
      });
      return result.content?.[0]?.text?.slice(0, 400) || JSON.stringify(result).slice(0, 400);
    });
  }

  // ── Test 8: Hooks route ───────────────────────────────
  const routeTool = toolNames.find((t) => t.includes("route"));
  if (routeTool) {
    await test(`8. Hook route (via ${routeTool})`, async () => {
      const result = await client.request("tools/call", {
        name: routeTool,
        arguments: {
          task: "Implement user authentication with OAuth",
        },
      });
      return result.content?.[0]?.text?.slice(0, 400) || JSON.stringify(result).slice(0, 400);
    });
  }

  // ── Results ───────────────────────────────────────────
  console.log(`\n${"═".repeat(50)}`);
  console.log(`  Results: ${passed} passed, ${failed} failed`);
  console.log(`${"═".repeat(50)}`);

  if (toolNames.length > 0) {
    console.log("\n  All available MCP tools:");
    toolNames.forEach((t, i) => console.log(`    ${i + 1}. ${t}`));
  }

  console.log("\nShutting down...");
  server.kill("SIGTERM");
  setTimeout(() => process.exit(failed > 0 ? 1 : 0), 2000);
};

run();
