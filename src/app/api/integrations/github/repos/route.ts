// ──────────────────────────────────────────────────────────
// GET /api/integrations/github/repos
//
// Lists repositories accessible to the connected GitHub user.
// Used by the Settings UI for repo selection after OAuth.
// ──────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { getRuntimeGitHubConfig } from "@/lib/clients/integration-store";
import { runWithDeviceId, getDeviceIdFromCookies } from "@/lib/request-context";

export async function GET(request: NextRequest) {
  const deviceId = getDeviceIdFromCookies(request.cookies);
  return runWithDeviceId(deviceId, async () => {
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
  });
}
