// ──────────────────────────────────────────────────────────
// Vercel REST API client — queries auto-deployed previews
//
// GitHub is connected to Vercel directly, so deployments
// happen automatically on push. This client fetches the
// latest deployment URL from the Vercel API.
// ──────────────────────────────────────────────────────────

import { logger } from "@/lib/logger";

const VERCEL_API = "https://api.vercel.com";

function isConfigured(): boolean {
  return !!(process.env.VERCEL_TOKEN && process.env.FULL_AI_VERCEL_PROJECT_ID);
}

function getConfig() {
  const token = process.env.VERCEL_TOKEN!;
  const projectId = process.env.FULL_AI_VERCEL_PROJECT_ID!;
  return { token, projectId, teamId: process.env.VERCEL_TEAM_ID };
}

// ── Public API ───────────────────────────────────────────

export interface GetPreviewUrlParams {
  branch: string;
}

/**
 * Query Vercel for the latest deployment.
 * Uses the most recent deployment rather than matching by branch ref,
 * since the branch name reported by Vercel may not always match.
 */
export async function getVercelPreviewUrl(
  params: GetPreviewUrlParams,
) {
  const { branch } = params;

  logger.info(`Looking up Vercel preview deployment  ${JSON.stringify(getConfig())}`, { branch });
  if (!isConfigured()) {
    logger.warn(`Vercel not configured (VERCEL_TOKEN / FULL_AI_VERCEL_PROJECT_ID missing) ${JSON.stringify(getConfig())}`);
    return { branch, found: false, simulated: true };
  }

  const { token, projectId, teamId } = getConfig();

  try {
    const qs = new URLSearchParams({ limit: "5" });
    if (teamId) qs.set("teamId", teamId);
    if (projectId.startsWith("prj_")) {
      qs.set("projectId", projectId);
    }

    const res = await fetch(
      `${VERCEL_API}/v6/deployments?${qs.toString()}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );

    if (!res.ok) {
      const body = await res.text();
      logger.warn("Vercel list deployments failed", { status: res.status, body });
      return { branch, found: false };
    }

    const data = await res.json();
    const deployments = data.deployments ?? [];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const refs = deployments.map((d: any) => ({
      ref: d.meta?.githubCommitRef ?? d.gitSource?.ref ?? "unknown",
      url: d.url,
      state: d.readyState ?? d.state,
    }));
    logger.debug("Vercel deployments fetched", { branch, count: deployments.length, refs });

    // Use the most recent deployment (Vercel API returns newest first)
    const match = deployments[0];

    if (match) {
      const url = `https://${match.url}`;
      const inspectorUrl = match.inspectorUrl ?? null;
      const state = match.readyState ?? match.state ?? "UNKNOWN";

      logger.info("Vercel latest deployment found", {
        deploymentId: match.uid,
        url,
        state,
      });

      return {
        branch,
        found: true,
        deploymentId: match.uid,
        url,
        state,
        inspectorUrl,
      };
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn("Vercel API error while looking up preview", { error: msg });
  }

  logger.warn("Vercel preview deployment not found", { branch });
  return { branch, found: false };
}
