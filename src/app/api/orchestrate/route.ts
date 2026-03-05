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
import { hydrateFromDB } from "@/lib/clients/integration-store";
import { orchestrateStream } from "@/lib/orchestrator";
import { logger } from "@/lib/logger";
import { runWithDeviceId, getDeviceIdFromCookies } from "@/lib/request-context";
import type { OrchestrateRequestBody, StreamEvent } from "@/lib/agents/types";

export const maxDuration = 120;

export async function POST(request: NextRequest) {
  const deviceId = getDeviceIdFromCookies(request.cookies);

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

  // Track whether the client is still connected. When the browser closes
  // the connection (e.g. page reload), the controller becomes closed.
  // We must NOT let that error abort the server-side pipeline — the
  // orchestrator should keep running and writing events to MongoDB so
  // the polling endpoint can serve them on the next page load.
  let controllerOpen = true;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: StreamEvent) => {
        if (!controllerOpen) return;
        try {
          const data = `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
          controller.enqueue(encoder.encode(data));
        } catch {
          // Client disconnected — mark closed so we stop trying to enqueue,
          // but let the orchestrator finish and persist to MongoDB.
          controllerOpen = false;
        }
      };

      try {
        // Load runtime integration config (GitHub/Jira from Settings) from DB
        // so agents use the user's repo/project instead of empty store (e.g. production cold start).
        await hydrateFromDB(deviceId);

        // Bind device ID so all downstream store calls (agents → github/jira clients)
        // resolve the correct per-user integration config.
        await runWithDeviceId(deviceId, () =>
          orchestrateStream(body.message, body.sessionId, send),
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error("Orchestration stream error", { error: message });
        send({
          type: "error",
          agent: "orchestrator",
          message: "Internal server error. Check server logs.",
        });
      } finally {
        if (controllerOpen) {
          try { controller.close(); } catch { /* already closed */ }
        }
        controllerOpen = false;
      }
    },
    cancel() {
      // Browser closed the connection (e.g. page reload / tab close).
      // Signal send() to stop enqueueing, but do NOT throw —
      // orchestrateStream will continue and persist events to MongoDB.
      controllerOpen = false;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
      "Content-Encoding": "none",
    },
  });
}
