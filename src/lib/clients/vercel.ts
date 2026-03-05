// ──────────────────────────────────────────────────────────
// Vercel REST API client — queries auto-deployed previews
//
// GitHub is connected to Vercel directly, so deployments
// happen automatically on push. This client fetches the
// latest deployment URL from the Vercel API.
// ──────────────────────────────────────────────────────────

import { logger } from "@/lib/logger";
import { getRuntimeVercelConfig } from "./integration-store";

const VERCEL_API = "https://api.vercel.com";

function isConfigured(): boolean {
  const runtime = getRuntimeVercelConfig();
  if (runtime) return true;
  return !!(process.env.VERCEL_TOKEN && process.env.FULL_AI_VERCEL_PROJECT_ID);
}

function getConfig() {
  const runtime = getRuntimeVercelConfig();
  if (runtime) {
    return {
      token: runtime.accessToken,
      projectId: runtime.projectId,
      teamId: runtime.teamId,
    };
  }
  const token = process.env.VERCEL_TOKEN!;
  const projectId = process.env.FULL_AI_VERCEL_PROJECT_ID!;
  return { token, projectId, teamId: process.env.VERCEL_TEAM_ID };
}

// ── Public API ───────────────────────────────────────────

export interface GetPreviewUrlParams {
  branch: string;
}

const MAX_POLL_ATTEMPTS = 10;
const POLL_DELAY_MS = 6_000; // 6 seconds between polls

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Query Vercel for the latest deployment matching the given branch.
 * Prefers READY deployments over building ones. If the best match
 * is still building, polls up to ~60 s for it to become READY.
 */
export async function getVercelPreviewUrl(
  params: GetPreviewUrlParams,
) {
  const { branch } = params;

  logger.info("Looking up Vercel preview deployment", { branch });
  if (!isConfigured()) {
    logger.warn("Vercel not configured (VERCEL_TOKEN / FULL_AI_VERCEL_PROJECT_ID missing)");
    return { branch, found: false, simulated: true };
  }

  const { token, projectId, teamId } = getConfig();

  const fetchDeployments = async () => {
    const qs = new URLSearchParams({ limit: "20" });
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
      return null;
    }

    const data = await res.json();
    return (data.deployments ?? []) as Array<{
      uid: string;
      url: string;
      readyState?: string;
      state?: string;
      inspectorUrl?: string;
      meta?: { githubCommitRef?: string };
      gitSource?: { ref?: string };
    }>;
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getRef = (d: any): string =>
    d.meta?.githubCommitRef ?? d.gitSource?.ref ?? "unknown";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getState = (d: any): string =>
    d.readyState ?? d.state ?? "UNKNOWN";

  const pickBest = (deployments: NonNullable<Awaited<ReturnType<typeof fetchDeployments>>>) => {
    const refs = deployments.map((d) => ({
      ref: getRef(d),
      url: d.url,
      state: getState(d),
    }));
    logger.debug("Vercel deployments fetched", { branch, count: deployments.length, refs });

    // 1. Try branch-matched READY deployment
    const branchReady = deployments.find(
      (d) => getRef(d) === branch && getState(d) === "READY",
    );
    if (branchReady) return branchReady;

    // 2. Try branch-matched deployment in any state (building/initializing)
    const branchAny = deployments.find((d) => getRef(d) === branch);
    if (branchAny) return branchAny;

    // 3. Fallback: any READY deployment (newest first)
    const anyReady = deployments.find((d) => getState(d) === "READY");
    if (anyReady) return anyReady;

    // 4. Last resort: newest deployment
    return deployments[0] ?? null;
  };

  try {
    let deployments = await fetchDeployments();
    if (!deployments) return { branch, found: false };

    let match = pickBest(deployments);
    if (!match) {
      logger.warn("Vercel preview deployment not found", { branch });
      return { branch, found: false };
    }

    // If best match is still building, poll until READY or timeout
    const matchState = getState(match);
    if (matchState !== "READY" && matchState !== "ERROR") {
      logger.info("Vercel deployment still building, polling…", {
        deploymentId: match.uid,
        state: matchState,
      });

      for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
        await sleep(POLL_DELAY_MS);
        deployments = await fetchDeployments();
        if (!deployments) break;

        match = pickBest(deployments);
        if (!match) break;

        const currentState = getState(match);
        logger.debug("Vercel poll check", { attempt: attempt + 1, state: currentState });

        if (currentState === "READY" || currentState === "ERROR") break;
      }
    }

    if (match) {
      const url = `https://${match.url}`;
      const inspectorUrl = match.inspectorUrl ?? null;
      const state = getState(match);

      logger.info("Vercel deployment selected", {
        deploymentId: match.uid,
        url,
        state,
        ref: getRef(match),
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
