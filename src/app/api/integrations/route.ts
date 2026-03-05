// ──────────────────────────────────────────────────────────
// /api/integrations — Integration status & management
//
// GET    → Hydrates from MongoDB then returns connection status
// DELETE → Disconnect a specific service and remove from DB
// PATCH  → Update config for a service (e.g. select repo)
// ──────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";

import {
  getIntegrationStatus,
  hydrateFromDB,
  disconnectGitHub,
  disconnectJira,
  disconnectVercel,
  getRuntimeGitHubConfig,
  setRuntimeGitHubConfig,
  getRuntimeJiraConfig,
  setRuntimeJiraConfig,
} from "@/lib/clients/integration-store";
import {
  deleteIntegrationFromDB,
  saveIntegrationToDB,
} from "@/lib/clients/integration-persistence";
import { revokeGitHubToken, revokeJiraToken } from "@/lib/clients/token-revocation";
import { runWithDeviceId, getDeviceIdFromCookies } from "@/lib/request-context";

export const GET = async (request: NextRequest): Promise<NextResponse> => {
  const deviceId = getDeviceIdFromCookies(request.cookies);
  return runWithDeviceId(deviceId, async () => {
    await hydrateFromDB(deviceId);
    const status = getIntegrationStatus();
    return NextResponse.json(status);
  });
};

export const DELETE = async (request: NextRequest): Promise<NextResponse> => {
  const deviceId = getDeviceIdFromCookies(request.cookies);
  return runWithDeviceId(deviceId, async () => {
    const { searchParams } = new URL(request.url);
    const service = searchParams.get("service") as "github" | "jira" | "vercel" | null;

    switch (service) {
      case "github": {
        const githubConfig = getRuntimeGitHubConfig();
        if (githubConfig?.accessToken) {
          await revokeGitHubToken(githubConfig.accessToken);
        }
        disconnectGitHub();
        break;
      }
      case "jira": {
        const jiraConfig = getRuntimeJiraConfig();
        if (jiraConfig?.refreshToken) {
          await revokeJiraToken(jiraConfig.refreshToken);
        }
        disconnectJira();
        break;
      }
      case "vercel":
        disconnectVercel();
        break;
      default:
        return NextResponse.json({ error: "Invalid service" }, { status: 400 });
    }

    await deleteIntegrationFromDB({ deviceId, service });

    return NextResponse.json({ disconnected: service });
  });
};

export const PATCH = async (request: NextRequest): Promise<NextResponse> => {
  const deviceId = getDeviceIdFromCookies(request.cookies);
  return runWithDeviceId(deviceId, async () => {
    const body = await request.json();
    const { service, ...updates } = body as { service: string; [key: string]: unknown };

    switch (service) {
      case "github": {
        const current = getRuntimeGitHubConfig();
        if (!current) {
          return NextResponse.json({ error: "GitHub not connected" }, { status: 400 });
        }
        if (updates.owner) current.owner = updates.owner as string;
        if (updates.repo) current.repo = updates.repo as string;
        setRuntimeGitHubConfig(current);
        await saveIntegrationToDB({
          deviceId,
          service: "github",
          data: current as unknown as Record<string, unknown>,
        });
        break;
      }
      case "jira": {
        const current = getRuntimeJiraConfig();
        if (!current) {
          return NextResponse.json({ error: "Jira not connected" }, { status: 400 });
        }
        if (updates.projectKey) current.projectKey = updates.projectKey as string;
        setRuntimeJiraConfig(current);
        await saveIntegrationToDB({
          deviceId,
          service: "jira",
          data: current as unknown as Record<string, unknown>,
        });
        break;
      }
      default:
        return NextResponse.json({ error: "Invalid service" }, { status: 400 });
    }

    return NextResponse.json({ updated: service });
  });
};
