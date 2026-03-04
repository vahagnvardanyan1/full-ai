// ──────────────────────────────────────────────────────────
// /api/integrations — Integration status & management
//
// GET    → Returns connection status for all integrations
// DELETE → Disconnect a specific service (?service=github)
// PATCH  → Update config for a service (e.g. select repo)
// ──────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import {
  getIntegrationStatus,
  disconnectGitHub,
  disconnectJira,
  disconnectVercel,
  getRuntimeGitHubConfig,
  setRuntimeGitHubConfig,
  getRuntimeJiraConfig,
  setRuntimeJiraConfig,
} from "@/lib/clients/integration-store";
import { runWithDeviceId, getDeviceIdFromCookies } from "@/lib/request-context";

export async function GET(request: NextRequest) {
  const deviceId = getDeviceIdFromCookies(request.cookies);
  return runWithDeviceId(deviceId, () => {
    const status = getIntegrationStatus();
    return NextResponse.json(status);
  });
}

export async function DELETE(request: NextRequest) {
  const deviceId = getDeviceIdFromCookies(request.cookies);
  return runWithDeviceId(deviceId, () => {
    const { searchParams } = new URL(request.url);
    const service = searchParams.get("service");

    switch (service) {
      case "github":
        disconnectGitHub();
        break;
      case "jira":
        disconnectJira();
        break;
      case "vercel":
        disconnectVercel();
        break;
      default:
        return NextResponse.json({ error: "Invalid service" }, { status: 400 });
    }

    return NextResponse.json({ disconnected: service });
  });
}

export async function PATCH(request: NextRequest) {
  const deviceId = getDeviceIdFromCookies(request.cookies);
  return runWithDeviceId(deviceId, async () => {
    const body = await request.json();
    const { service, ...updates } = body;

    switch (service) {
      case "github": {
        const current = getRuntimeGitHubConfig();
        if (!current) {
          return NextResponse.json({ error: "GitHub not connected" }, { status: 400 });
        }
        if (updates.owner) current.owner = updates.owner;
        if (updates.repo) current.repo = updates.repo;
        setRuntimeGitHubConfig(current);
        break;
      }
      case "jira": {
        const current = getRuntimeJiraConfig();
        if (!current) {
          return NextResponse.json({ error: "Jira not connected" }, { status: 400 });
        }
        if (updates.projectKey) current.projectKey = updates.projectKey;
        setRuntimeJiraConfig(current);
        break;
      }
      default:
        return NextResponse.json({ error: "Invalid service" }, { status: 400 });
    }

    return NextResponse.json({ updated: service });
  });
}
