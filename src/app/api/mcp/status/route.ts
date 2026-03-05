import { NextResponse } from "next/server";

import { getMCPClient } from "@/lib/mcp/client";
import { ping, swarmStatus, getAvailableTools } from "@/lib/mcp/tools";

export const dynamic = "force-dynamic";

export const GET = async () => {
  const client = getMCPClient();
  const isConnected = client.isReady();

  if (!isConnected) {
    return NextResponse.json({
      connected: false,
      server: null,
      toolCount: 0,
      tools: [],
      swarm: null,
      healthy: false,
    });
  }

  const [isHealthy, swarm, toolNames] = await Promise.all([
    ping(),
    swarmStatus(),
    Promise.resolve(getAvailableTools()),
  ]);

  return NextResponse.json({
    connected: true,
    server: "Ruflo MCP v3.5",
    toolCount: toolNames.length,
    tools: toolNames.slice(0, 50),
    swarm: swarm ?? { active: false, topology: "none", agentCount: 0 },
    healthy: isHealthy,
  });
};
