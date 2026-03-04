// ──────────────────────────────────────────────────────────
// GET /api/auth/jira — Initiates Jira OAuth 2.0 (3LO) flow
//
// Redirects the user to Atlassian's authorization page.
// After the user authorizes, Atlassian redirects to
// /api/auth/jira/callback.
// ──────────────────────────────────────────────────────────

import { NextResponse } from "next/server";

export async function GET() {
  const clientId = process.env.JIRA_CLIENT_ID;

  if (!clientId) {
    return NextResponse.json(
      { error: "Jira OAuth is not configured. Set JIRA_CLIENT_ID." },
      { status: 500 },
    );
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const redirectUri = `${appUrl}/api/auth/jira/callback`;

  const params = new URLSearchParams({
    audience: "api.atlassian.com",
    client_id: clientId,
    scope: [
      "read:jira-work",
      "write:jira-work",
      "manage:jira-project",
      "manage:jira-configuration",
      "read:jira-user",
      "read:me",
      "offline_access",
    ].join(" "),
    redirect_uri: redirectUri,
    state: crypto.randomUUID(),
    response_type: "code",
    prompt: "consent",
  });

  return NextResponse.redirect(`https://auth.atlassian.com/authorize?${params.toString()}`);
}
