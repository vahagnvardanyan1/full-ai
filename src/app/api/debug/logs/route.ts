// ──────────────────────────────────────────────────────────
// GET /api/debug/logs
//
// JSON polling endpoint — returns logs newer than `?since=`.
// Primary: reads from MongoDB. Fallback: in-memory buffer.
// ──────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { getLogBuffer } from "@/lib/logger";
import { connectDB, isDBEnabled } from "@/lib/db/connection";
import { DebugLogModel } from "@/lib/db/models/debug-log";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (process.env.SHOW_DEBUG_UI !== "true") {
    return NextResponse.json({ error: "Debug UI is disabled" }, { status: 403 });
  }

  const sinceParam = req.nextUrl.searchParams.get("since");

  // Try MongoDB first
  if (isDBEnabled()) {
    try {
      const conn = await connectDB();
      if (conn) {
        const query = sinceParam
          ? { ts: { $gt: new Date(sinceParam) } }
          : {};
        const docs = await DebugLogModel.find(query)
          .sort({ ts: 1 })
          .limit(200)
          .lean();

        const logs = docs.map((d) => ({
          ts: (d.ts as Date).toISOString(),
          level: d.level,
          msg: d.msg,
          ...(d.meta as Record<string, unknown>),
        }));

        return NextResponse.json({ logs });
      }
    } catch {
      // fall through to in-memory buffer
    }
  }

  // Fallback: in-memory buffer
  let logs = getLogBuffer();
  if (sinceParam) {
    const since = new Date(sinceParam).getTime();
    logs = logs.filter((e) => new Date(e.ts).getTime() > since);
  }

  return NextResponse.json({ logs: logs.slice(-200) });
}
