import { NextRequest, NextResponse } from "next/server";
import { checkGitHubReady } from "@/lib/agents/frontend-developer/services/github.service";
import { runWithDeviceId, getDeviceIdFromCookies } from "@/lib/request-context";
import { hydrateFromDB } from "@/lib/clients/integration-store";

export async function GET(request: NextRequest) {
  const deviceId = getDeviceIdFromCookies(request.cookies);
  return runWithDeviceId(deviceId, async () => {
    await hydrateFromDB(deviceId);
    return NextResponse.json(checkGitHubReady());
  });
}
