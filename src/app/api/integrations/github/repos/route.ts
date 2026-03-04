// ──────────────────────────────────────────────────────────
// GET /api/integrations/github/repos
//
// Lists repositories accessible to the connected GitHub user.
// Used by the Settings UI for repo selection after OAuth.
// ──────────────────────────────────────────────────────────

import { NextResponse } from "next/server";
import { getRuntimeGitHubConfig } from "@/lib/clients/integration-store";

export async function GET() {
  const config = getRuntimeGitHubConfig();

  if (!config) {
    return NextResponse.json({ error: "GitHub not connected" }, { status: 401 });
  }

  try {
    const res = await fetch(
      "https://api.github.com/user/repos?per_page=100&sort=updated&affiliation=owner,collaborator,organization_member",
      {
        headers: {
          Authorization: `Bearer ${config.accessToken}`,
          Accept: "application/vnd.github+json",
        },
      },
    );

    if (!res.ok) {
      return NextResponse.json(
        { error: `GitHub API returned ${res.status}` },
        { status: res.status },
      );
    }

    const repos = await res.json();

    const simplified = repos.map((repo: Record<string, unknown>) => ({
      fullName: repo.full_name,
      name: repo.name,
      owner: (repo.owner as Record<string, unknown>)?.login,
      private: repo.private,
      description: repo.description,
      updatedAt: repo.updated_at,
    }));

    return NextResponse.json({ repos: simplified });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
