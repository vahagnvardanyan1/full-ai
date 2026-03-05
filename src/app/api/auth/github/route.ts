// ──────────────────────────────────────────────────────────
// GET /api/auth/github — Initiates GitHub OAuth flow
//
// Redirects the user to GitHub's authorization page.
// After the user authorizes, GitHub redirects to /api/auth/github/callback.
// The disconnect flow deletes the full authorization grant so GitHub
// always shows a fresh auth screen on the next connect attempt.
// ──────────────────────────────────────────────────────────

import { NextResponse } from "next/server";

export const GET = (): NextResponse => {
  const clientId = process.env.GITHUB_CLIENT_ID;

  if (!clientId) {
    return NextResponse.json(
      { error: "GitHub OAuth is not configured. Set GITHUB_CLIENT_ID." },
      { status: 500 },
    );
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const redirectUri = `${appUrl}/api/auth/github/callback`;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: "repo read:user user:email",
    state: crypto.randomUUID(),
  });

  return NextResponse.redirect(`https://github.com/login/oauth/authorize?${params.toString()}`);
};
