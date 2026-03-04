// ──────────────────────────────────────────────────────────
// Runtime integration store
//
// Holds OAuth tokens configured at runtime through the
// Settings → Integrations UI. GitHub is runtime-only (no
// env var fallback). Jira and Vercel still fall back to
// env vars when not connected via OAuth.
//
// In-memory for now (same pattern as session-store.ts).
// Swap with Redis / DB for production persistence.
// ──────────────────────────────────────────────────────────

import { logger } from "@/lib/logger";

// ── Types ───────────────────────────────────────────────

export interface GitHubIntegration {
  accessToken: string;
  owner: string;
  repo: string;
  login: string;
  avatarUrl?: string;
  connectedAt: number;
}

export interface JiraIntegration {
  accessToken: string;
  refreshToken: string;
  cloudId: string;
  siteUrl: string;
  siteName: string;
  projectKey: string;
  email: string;
  connectedAt: number;
  expiresAt: number;
}

export interface VercelIntegration {
  accessToken: string;
  teamId?: string;
  projectId: string;
  connectedAt: number;
}

export interface IntegrationConfig {
  github?: GitHubIntegration;
  jira?: JiraIntegration;
  vercel?: VercelIntegration;
}

export interface IntegrationStatus {
  github: { connected: boolean; login?: string; avatarUrl?: string; owner?: string; repo?: string };
  jira: { connected: boolean; email?: string; siteName?: string; projectKey?: string };
  vercel: { connected: boolean; projectId?: string };
}

// ── Store ───────────────────────────────────────────────
// Use globalThis to survive Next.js HMR module re-evaluation
// in development mode. Without this, connecting one service
// resets the Map and disconnects the other.

const globalStore = globalThis as unknown as {
  __integrationStore?: Map<string, IntegrationConfig>;
};
const store = (globalStore.__integrationStore ??= new Map<string, IntegrationConfig>());
const DEFAULT_KEY = "default";

function getConfig(): IntegrationConfig {
  return store.get(DEFAULT_KEY) ?? {};
}

function setConfig(config: IntegrationConfig) {
  store.set(DEFAULT_KEY, config);
}

// ── GitHub disconnect callbacks ──────────────────────────
// Modules that cache GitHub-related state (e.g. Octokit instances)
// register cleanup callbacks here to avoid circular imports.

const gitHubDisconnectCallbacks: Array<() => void> = [];

export function onGitHubDisconnect(callback: () => void) {
  gitHubDisconnectCallbacks.push(callback);
}

// ── GitHub ──────────────────────────────────────────────

export function getRuntimeGitHubConfig(): GitHubIntegration | null {
  const config = getConfig();
  return config.github ?? null;
}

export function setRuntimeGitHubConfig(github: GitHubIntegration) {
  const config = getConfig();
  config.github = github;
  setConfig(config);
  logger.info("GitHub integration connected", {
    login: github.login,
    owner: github.owner,
    repo: github.repo,
  });
}

export function disconnectGitHub() {
  const config = getConfig();
  delete config.github;
  setConfig(config);
  for (const cb of gitHubDisconnectCallbacks) cb();
  logger.info("GitHub integration disconnected");
}

// ── Jira ────────────────────────────────────────────────

export function getRuntimeJiraConfig(): JiraIntegration | null {
  const config = getConfig();
  if (!config.jira) return null;

  // Check if token is about to expire (within 60s)
  if (config.jira.expiresAt < Date.now() + 60_000) {
    logger.warn("Jira OAuth token expired, needs refresh");
    // Caller should trigger refresh flow
  }

  return config.jira;
}

export function setRuntimeJiraConfig(jira: JiraIntegration) {
  const config = getConfig();
  config.jira = jira;
  setConfig(config);
  logger.info("Jira integration connected", {
    siteName: jira.siteName,
    email: jira.email,
    projectKey: jira.projectKey,
  });
}

export function updateJiraTokens(accessToken: string, refreshToken: string, expiresIn: number) {
  const config = getConfig();
  if (config.jira) {
    config.jira.accessToken = accessToken;
    config.jira.refreshToken = refreshToken;
    config.jira.expiresAt = Date.now() + expiresIn * 1000;
    setConfig(config);
    logger.info("Jira tokens refreshed");
  }
}

// ── Jira Token Refresh ─────────────────────────────────

let refreshInFlight: Promise<JiraIntegration | null> | null = null;

/**
 * Return the current Jira config, automatically refreshing the
 * OAuth token if it is about to expire. A single in-flight promise
 * prevents concurrent refresh race conditions.
 */
export async function refreshJiraTokenIfNeeded(): Promise<JiraIntegration | null> {
  const config = getConfig();
  if (!config.jira) return null;

  // Token still fresh — return as-is
  if (config.jira.expiresAt > Date.now() + 60_000) {
    return config.jira;
  }

  // Deduplicate concurrent refresh calls
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    try {
      const clientId = process.env.JIRA_CLIENT_ID;
      const clientSecret = process.env.JIRA_CLIENT_SECRET;

      if (!clientId || !clientSecret) {
        logger.warn("Cannot refresh Jira token — missing JIRA_CLIENT_ID / JIRA_CLIENT_SECRET");
        return config.jira!;
      }

      logger.info("Refreshing Jira OAuth token…");

      const res = await fetch("https://auth.atlassian.com/oauth/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          grant_type: "refresh_token",
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: config.jira!.refreshToken,
        }),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        logger.error("Jira token refresh failed", { status: res.status, body });
        return config.jira!;
      }

      const data = (await res.json()) as {
        access_token: string;
        refresh_token: string;
        expires_in: number;
      };

      updateJiraTokens(data.access_token, data.refresh_token, data.expires_in);
      logger.info("Jira token refreshed successfully");
      return getConfig().jira!;
    } catch (err) {
      logger.error("Jira token refresh error", { error: err instanceof Error ? err.message : String(err) });
      return config.jira!;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

export function disconnectJira() {
  const config = getConfig();
  delete config.jira;
  setConfig(config);
  refreshInFlight = null;
  logger.info("Jira integration disconnected");
}

// ── Vercel ──────────────────────────────────────────────

export function getRuntimeVercelConfig(): VercelIntegration | null {
  const config = getConfig();
  return config.vercel ?? null;
}

export function setRuntimeVercelConfig(vercel: VercelIntegration) {
  const config = getConfig();
  config.vercel = vercel;
  setConfig(config);
  logger.info("Vercel integration connected", { projectId: vercel.projectId });
}

export function disconnectVercel() {
  const config = getConfig();
  delete config.vercel;
  setConfig(config);
  logger.info("Vercel integration disconnected");
}

// ── Status ──────────────────────────────────────────────

export function getIntegrationStatus(): IntegrationStatus {
  const config = getConfig();

  return {
    github: config.github
      ? {
          connected: !!config.github.accessToken,
          login: config.github.login,
          avatarUrl: config.github.avatarUrl,
          owner: config.github.owner,
          repo: config.github.repo,
        }
      : {
          connected: false,
        },
    jira: config.jira
      ? {
          connected: true,
          email: config.jira.email,
          siteName: config.jira.siteName,
          projectKey: config.jira.projectKey,
        }
      : {
          connected: !!(
            process.env.JIRA_BASE_URL &&
            process.env.JIRA_EMAIL &&
            process.env.JIRA_API_TOKEN &&
            process.env.JIRA_PROJECT_KEY
          ),
          email: process.env.JIRA_EMAIL,
          projectKey: process.env.JIRA_PROJECT_KEY,
        },
    vercel: config.vercel
      ? {
          connected: true,
          projectId: config.vercel.projectId,
        }
      : {
          connected: !!(process.env.VERCEL_TOKEN && process.env.VERCEL_PROJECT_ID),
          projectId: process.env.VERCEL_PROJECT_ID,
        },
  };
}
