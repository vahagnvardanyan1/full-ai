import { NextResponse } from "next/server";
import { checkGitHubReady } from "@/lib/agents/frontend-developer/services/github.service";

export async function GET() {
  return NextResponse.json(checkGitHubReady());
}
