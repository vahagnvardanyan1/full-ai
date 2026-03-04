// ──────────────────────────────────────────────────────────
// POST /api/orchestrate
//
// Streams Server-Sent Events (SSE) as each agent starts,
// completes, and produces tasks/files.
//
// Events:
//   plan           → { plan, agents }
//   agent_start    → { agent }
//   agent_complete → { response, tasks, files }
//   error          → { agent, message }
//   done           → { requestId }
// ──────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { orchestrateStream } from "@/lib/orchestrator";
import { logger } from "@/lib/logger";
import type { OrchestrateRequestBody, StreamEvent } from "@/lib/agents/types";

export const maxDuration = 120;

export async function POST(request: NextRequest) {
  let body: OrchestrateRequestBody;

  try {
    body = (await request.json()) as OrchestrateRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  // ── Input validation ────────────────────────────────
  if (!body.message || typeof body.message !== "string") {
    return NextResponse.json(
      { error: "Request body must include a non-empty 'message' string." },
      { status: 400 },
    );
  }

  if (body.message.length > 5000) {
    return NextResponse.json(
      { error: "Message must be under 5 000 characters." },
      { status: 400 },
    );
  }

  // ── Stream SSE ──────────────────────────────────────
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      function send(event: StreamEvent) {
        const data = `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
        controller.enqueue(encoder.encode(data));
      }

      try {
        await orchestrateStream(body.message, body.sessionId, send);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error("Orchestration stream error", { error: message });
        const errorEvent: StreamEvent = {
          type: "error",
          agent: "orchestrator",
          message: "Internal server error. Check server logs.",
        };
        send(errorEvent);
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
