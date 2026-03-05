// ──────────────────────────────────────────────────────────
// POST /api/fashion-stylist
//
// Standalone SSE endpoint for the Fashion Stylist agent.
// Runs independently from the orchestrator pipeline.
//
// Events:
//   progress → { stage, message, progress }
//   complete → { response }
//   error    → { message }
// ──────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { runFashionStylist } from "@/lib/agents/fashion-stylist";
import { logger } from "@/lib/logger";
import type { FashionContext } from "@/lib/agents/types";

export const maxDuration = 120;

interface FashionRequestBody {
  fashionContext: FashionContext;
  message?: string;
}

export async function POST(request: NextRequest) {
  let body: FashionRequestBody;

  try {
    body = (await request.json()) as FashionRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!body.fashionContext) {
    return NextResponse.json(
      { error: "Request body must include 'fashionContext'." },
      { status: 400 },
    );
  }

  const encoder = new TextEncoder();
  let controllerOpen = true;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (eventType: string, data: unknown) => {
        if (!controllerOpen) return;
        try {
          const payload = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(encoder.encode(payload));
        } catch {
          controllerOpen = false;
        }
      };

      try {
        const message = body.message ?? `Style me a ${body.fashionContext.style} outfit for ${body.fashionContext.occasion}`;

        const result = await runFashionStylist(
          message,
          (stage, msg, progress) => {
            send("progress", { stage, message: msg, progress });
          },
          body.fashionContext,
          (type, data) => {
            send("detail", { type, data });
          },
        );

        send("complete", { response: result });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error("Fashion stylist stream error", { error: message });
        send("error", { message: "Fashion stylist failed. Check server logs." });
      } finally {
        if (controllerOpen) {
          try { controller.close(); } catch { /* already closed */ }
        }
        controllerOpen = false;
      }
    },
    cancel() {
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
