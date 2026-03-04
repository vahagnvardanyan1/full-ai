// ──────────────────────────────────────────────────────────
// GET /api/integrations/jira/projects
//
// Lists Jira projects accessible to the connected user.
// Used by the Settings UI for project selection after OAuth.
// ──────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { refreshJiraTokenIfNeeded } from "@/lib/clients/integration-store";
import { runWithDeviceId, getDeviceIdFromCookies } from "@/lib/request-context";

export async function GET(request: NextRequest) {
  const deviceId = getDeviceIdFromCookies(request.cookies);
  return runWithDeviceId(deviceId, async () => {
    const config = await refreshJiraTokenIfNeeded();

    if (!config) {
      return NextResponse.json({ error: "Jira not connected" }, { status: 401 });
    }

    try {
      const res = await fetch(
        `https://api.atlassian.com/ex/jira/${config.cloudId}/rest/api/3/project/search?maxResults=50&orderBy=name`,
        {
          headers: {
            Authorization: `Bearer ${config.accessToken}`,
            Accept: "application/json",
          },
        },
      );

      if (!res.ok) {
        return NextResponse.json(
          { error: `Jira API returned ${res.status}` },
          { status: res.status },
        );
      }

      const data = await res.json();

      const projects = data.values?.map(
        (project: Record<string, unknown>) => ({
          key: project.key,
          name: project.name,
          id: project.id,
          style: project.style,
          avatarUrl: (project.avatarUrls as Record<string, string>)?.["48x48"],
        }),
      ) ?? [];

      return NextResponse.json({ projects });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return NextResponse.json({ error: message }, { status: 500 });
    }
  });
}
