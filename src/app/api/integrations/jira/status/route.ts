// ──────────────────────────────────────────────────────────
// GET /api/integrations/jira/status
//
// Health-check endpoint for the Jira integration.
// Mirrors the existing GET /api/integrations/github/status.
// ──────────────────────────────────────────────────────────

import { NextResponse } from "next/server";
import {
  getRuntimeJiraConfig,
  refreshJiraTokenIfNeeded,
} from "@/lib/clients/integration-store";

export async function GET() {
  try {
    // Try runtime OAuth first (with automatic refresh)
    const runtime = await refreshJiraTokenIfNeeded();
    if (runtime?.accessToken && runtime.cloudId && runtime.projectKey) {
      return NextResponse.json({
        ready: true,
        source: "runtime" as const,
        siteName: runtime.siteName,
        projectKey: runtime.projectKey,
        email: runtime.email,
        tokenExpired: runtime.expiresAt < Date.now(),
      });
    }

    // Fall back to env-var configuration
    if (
      process.env.JIRA_BASE_URL &&
      process.env.JIRA_EMAIL &&
      process.env.JIRA_API_TOKEN &&
      process.env.JIRA_PROJECT_KEY
    ) {
      return NextResponse.json({
        ready: true,
        source: "env" as const,
        siteName: process.env.JIRA_BASE_URL,
        projectKey: process.env.JIRA_PROJECT_KEY,
        email: process.env.JIRA_EMAIL,
        tokenExpired: false,
      });
    }

    return NextResponse.json({
      ready: false,
      error: "Jira is not connected. Configure via Settings → Integrations or set JIRA_* env vars.",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ready: false, error: message }, { status: 500 });
  }
}
