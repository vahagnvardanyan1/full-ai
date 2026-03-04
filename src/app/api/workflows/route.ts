// ──────────────────────────────────────────────────────────
// GET  /api/workflows          — list recent workflow runs
// GET  /api/workflows?id=<id>  — get a single run with all
//                                SSE events for UI replay
// ──────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";

import { connectDB, isDBEnabled } from "@/lib/db/connection";
import { WorkflowRunModel } from "@/lib/db/models/workflow-run";

// Events that carry no meaningful state for UI replay
const SKIP_EVENT_TYPES = new Set(["agent_progress"]);

export const GET = async (request: NextRequest): Promise<NextResponse> => {
  if (!isDBEnabled()) {
    return NextResponse.json(
      { error: "Persistence is disabled — MONGODB_URI is not configured." },
      { status: 503 },
    );
  }

  await connectDB();

  const { searchParams } = request.nextUrl;
  const requestId = searchParams.get("id");

  // ── Single run (structural events only — no agent_progress noise) ──
  if (requestId) {
    const run = await WorkflowRunModel.findOne({ requestId }).lean();
    if (!run) {
      return NextResponse.json({ error: "Workflow run not found." }, { status: 404 });
    }
    return NextResponse.json({
      run: {
        ...run,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        events: (run.events as any[]).filter((e) => !SKIP_EVENT_TYPES.has(e?.type)),
      },
    });
  }

  // ── List recent runs ──────────────────────────────────────
  const sessionId = searchParams.get("sessionId");
  const limit = Math.min(Number(searchParams.get("limit") ?? "20"), 50);
  const query = sessionId ? { sessionId } : {};

  const rawRuns = await WorkflowRunModel.find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  // Strip agent_progress events to keep the payload small while
  // keeping the structural events needed to replay UI state:
  // plan, agent_start, agent_complete, tasks_updated, error, done
  const runs = rawRuns.map((run) => ({
    ...run,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    events: (run.events as any[]).filter((e) => !SKIP_EVENT_TYPES.has(e?.type)),
  }));

  return NextResponse.json({ runs });
};
