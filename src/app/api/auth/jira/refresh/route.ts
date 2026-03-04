// ──────────────────────────────────────────────────────────
// POST /api/auth/jira/refresh
//
// Proactively refreshes the Jira OAuth token. Useful for UI
// health checks or pre-flight calls before long operations.
// ──────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { refreshJiraTokenIfNeeded } from "@/lib/clients/integration-store";
import { runWithDeviceId, getDeviceIdFromCookies } from "@/lib/request-context";

export async function POST(request: NextRequest) {
  const deviceId = getDeviceIdFromCookies(request.cookies);
  return runWithDeviceId(deviceId, async () => {
    try {
      const config = await refreshJiraTokenIfNeeded();

      if (!config) {
        return NextResponse.json(
          { refreshed: false, error: "Jira is not connected" },
          { status: 400 },
        );
      }

      return NextResponse.json({
        refreshed: true,
        expiresAt: config.expiresAt,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return NextResponse.json(
        { refreshed: false, error: message },
        { status: 500 },
      );
    }
  });
}
