// ──────────────────────────────────────────────────────────
// Vercel REST API client — queries auto-deployed previews
//
// GitHub is connected to Vercel directly, so deployments
// happen automatically on push. This client fetches the
// preview URL for a given branch from the Vercel API.
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
 * Query Vercel for the latest auto-deployed preview for a branch.
 * Retries a few times since the deployment may still be in progress
 * right after the git push.
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

  const maxAttempts = 6;
  const delayMs = 10_000; // 10s between retries (auto-deploys take time)

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      // Try both with and without projectId filter — the env value
      // might be a team scope rather than a Vercel project ID.
      const qs = new URLSearchParams({ limit: "20" });
      if (teamId) qs.set("teamId", teamId);
      // Only add projectId if it looks like a Vercel project ID
      if (projectId.startsWith("prj_")) {
        qs.set("projectId", projectId);
      }

      const res = await fetch(
        `${VERCEL_API}/v6/deployments?${qs.toString()}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );

      if (!res.ok) {
        const body = await res.text();
        logger.warn("Vercel list deployments failed", { status: res.status, body, attempt });
        break;
      }

      const data = await res.json();
      const deployments = data.deployments ?? [];

      // Log what we got back for debugging
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const refs = deployments.map((d: any) => ({
        ref: d.meta?.githubCommitRef ?? d.gitSource?.ref ?? "unknown",
        url: d.url,
        state: d.readyState ?? d.state,
      }));
      logger.debug("Vercel deployments fetched", { attempt, branch, count: deployments.length, refs });

      // Find a deployment whose git ref matches our branch
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const match = deployments.find((d: any) => {
        const ref = d.meta?.githubCommitRef ?? d.gitSource?.ref ?? "";
        return ref === branch;
      });

      if (match) {
        const url = `https://${match.url}`;
        const inspectorUrl = match.inspectorUrl ?? null;
        const state = match.readyState ?? match.state ?? "UNKNOWN";

        logger.info("Vercel preview deployment found", {
          deploymentId: match.uid,
          url,
          state,
          attempt,
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

      if (attempt < maxAttempts) {
        logger.info("Vercel preview not found yet, retrying...", { attempt, branch });
        await new Promise((r) => setTimeout(r, delayMs));
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn("Vercel API error while looking up preview", { error: msg, attempt });
      break;
    }
  }

  logger.warn("Vercel preview deployment not found for branch", { branch });
  return { branch, found: false };
}
