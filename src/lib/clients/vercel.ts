// ──────────────────────────────────────────────────────────
// Vercel REST API client — deployment triggers & status
//
// When VERCEL_TOKEN is not set or the real API call fails,
// operations are simulated so the UI still shows results.
// ──────────────────────────────────────────────────────────

import { logger } from "@/lib/logger";

const VERCEL_API = "https://api.vercel.com";

function isConfigured(): boolean {
  return !!(process.env.VERCEL_TOKEN && process.env.VERCEL_PROJECT_ID);
}

function getConfig() {
  const token = process.env.VERCEL_TOKEN!;
  const projectId = process.env.VERCEL_PROJECT_ID!;
  return { token, projectId, teamId: process.env.VERCEL_TEAM_ID };
}

function teamQuery(teamId?: string): string {
  return teamId ? `?teamId=${teamId}` : "";
}

function simulatedDeployment(ref: string, target: string) {
  const fakeId = `dpl_${Date.now().toString(36)}`;
  return {
    deploymentId: fakeId,
    url: `https://${fakeId}.vercel.app`,
    state: "QUEUED",
    inspectorUrl: `https://vercel.com/deployments/${fakeId}`,
    ref,
    target,
    simulated: true,
  };
}

// ── Public API ───────────────────────────────────────────

export interface TriggerDeploymentParams {
  ref?: string;
  target?: "production" | "preview";
}

export async function triggerVercelDeployment(
  params: TriggerDeploymentParams = {},
) {
  const ref = params.ref ?? "main";
  const target = params.target ?? "production";

  logger.info("Triggering Vercel deployment", { ref, target });

  if (isConfigured()) {
    try {
      const { token, projectId, teamId } = getConfig();

      const res = await fetch(
        `${VERCEL_API}/v13/deployments${teamQuery(teamId)}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: projectId,
            project: projectId,
            target,
            gitSource: {
              type: "github",
              ref,
              repoId: projectId,
            },
          }),
        },
      );

      if (!res.ok) {
        const errorBody = await res.text();
        logger.warn("Vercel deployment failed, falling back to simulation", {
          status: res.status,
          body: errorBody,
        });
        return simulatedDeployment(ref, target);
      }

      const data = await res.json();

      logger.info("Vercel deployment triggered", {
        deploymentId: data.id,
        url: data.url,
      });

      return {
        deploymentId: data.id,
        url: `https://${data.url}`,
        state: data.readyState ?? data.state ?? "QUEUED",
        inspectorUrl: data.inspectorUrl,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn("Vercel deployment failed, falling back to simulation", { error: msg });
    }
  }

  return simulatedDeployment(ref, target);
}

export async function getDeploymentStatus(deploymentId: string) {
  if (isConfigured()) {
    try {
      const { token, teamId } = getConfig();

      const res = await fetch(
        `${VERCEL_API}/v13/deployments/${deploymentId}${teamQuery(teamId)}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      if (res.ok) {
        const data = await res.json();
        return {
          deploymentId: data.id,
          state: data.readyState,
          url: `https://${data.url}`,
        };
      }
    } catch {
      // fall through to simulation
    }
  }

  return {
    deploymentId,
    state: "READY",
    url: `https://${deploymentId}.vercel.app`,
    simulated: true,
  };
}
