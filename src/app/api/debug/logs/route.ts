// ──────────────────────────────────────────────────────────
// GET /api/debug/logs
//
// SSE endpoint that streams backend log entries in real time.
// Only available when SHOW_DEBUG_UI=true.
// ──────────────────────────────────────────────────────────

import { NextResponse } from "next/server";
import { getLogBuffer, subscribeToLogs } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function GET() {
  if (process.env.SHOW_DEBUG_UI !== "true") {
    return NextResponse.json({ error: "Debug UI is disabled" }, { status: 403 });
  }

  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | null = null;

  const stream = new ReadableStream({
    start(controller) {
      // Send buffered logs first
      const buffer = getLogBuffer();
      for (const entry of buffer) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(entry)}\n\n`),
        );
      }

      // Stream new logs
      unsubscribe = subscribeToLogs((entry) => {
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(entry)}\n\n`),
          );
        } catch {
          unsubscribe?.();
        }
      });

      controller.enqueue(encoder.encode(": connected\n\n"));
    },
    cancel() {
      unsubscribe?.();
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
