import { NextRequest, NextResponse } from "next/server";

import { listAgentRuns } from "@/lib/agents/agent-history";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const agentType = searchParams.get("agentType") ?? undefined;
  const limit = Number(searchParams.get("limit") ?? "20");

  try {
    const runs = await listAgentRuns({ agentType, limit });
    return NextResponse.json({ runs });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
