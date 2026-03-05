// ──────────────────────────────────────────────────────────
// Runtime integration store
//
// Holds OAuth tokens configured at runtime through the
// Settings → Integrations UI. The in-memory Map acts as a
// write-through cache: every mutation is also persisted to
// MongoDB via integration-persistence.ts so connections
// survive server restarts.
//
// Hydration: call hydrateFromDB(deviceId) once per request
// before reading config (the GET /api/integrations handler
// does this automatically).
// ──────────────────────────────────────────────────────────

import { logger } from "@/lib/logger";
import { getCurrentDeviceId } from "@/lib/request-context";
import {
  loadIntegrationsFromDB,
  saveIntegrationToDB,
  deleteIntegrationFromDB,
} from "./integration-persistence";

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
// Use globalThis to survive Next.js HMR module re-evaluation.

const globalStore = globalThis as unknown as {
  __integrationStore?: Map<string, IntegrationConfig>;
  __integrationHydrationTimestamps?: Map<string, number>;
};
const store = (globalStore.__integrationStore ??= new Map<string, IntegrationConfig>());
const hydrationTimestamps = (globalStore.__integrationHydrationTimestamps ??= new Map<string, number>());

const HYDRATION_TTL_MS = 30_000; // 30 seconds

const getConfig = (): IntegrationConfig => {
  const key = getCurrentDeviceId();
  return store.get(key) ?? {};
};

const setConfig = (config: IntegrationConfig): void => {
  const key = getCurrentDeviceId();
  store.set(key, config);
};

// ── DB Hydration ─────────────────────────────────────────
// Call once at the top of any GET handler that reads config.
// Skipped if the device already has data in memory.

export const hydrateFromDB = async (deviceId: string): Promise<void> => {
  const lastHydration = hydrationTimestamps.get(deviceId);
  if (lastHydration && Date.now() - lastHydration < HYDRATION_TTL_MS) return;

  const dbConfig = await loadIntegrationsFromDB(deviceId);
  if (dbConfig) {
    store.set(deviceId, dbConfig as IntegrationConfig);
    logger.info("Integrations hydrated from DB", { deviceId });
  }
  hydrationTimestamps.set(deviceId, Date.now());
};

// ── GitHub disconnect callbacks ──────────────────────────

const gitHubDisconnectCallbacks: Array<() => void> = [];

export const onGitHubDisconnect = (callback: () => void): void => {
  gitHubDisconnectCallbacks.push(callback);
};

// ── GitHub ──────────────────────────────────────────────

export const getRuntimeGitHubConfig = (): GitHubIntegration | null => {
  return getConfig().github ?? null;
};

export const setRuntimeGitHubConfig = (github: GitHubIntegration): void => {
  const config = getConfig();
  config.github = github;
  setConfig(config);
  logger.info("GitHub integration connected", {
    login: github.login,
    owner: github.owner,
    repo: github.repo,
  });
};

export const disconnectGitHub = (): void => {
  const config = getConfig();
  delete config.github;
  setConfig(config);
  for (const cb of gitHubDisconnectCallbacks) cb();
  logger.info("GitHub integration disconnected");
};

// ── Jira ────────────────────────────────────────────────

export const getRuntimeJiraConfig = (): JiraIntegration | null => {
  const config = getConfig();
  if (!config.jira) return null;

  if (config.jira.expiresAt < Date.now() + 60_000) {
    logger.warn("Jira OAuth token expired, needs refresh");
  }

  return config.jira;
};

export const setRuntimeJiraConfig = (jira: JiraIntegration): void => {
  const config = getConfig();
  config.jira = jira;
  setConfig(config);
  logger.info("Jira integration connected", {
    siteName: jira.siteName,
    email: jira.email,
    projectKey: jira.projectKey,
  });
};

export const updateJiraTokens = async ({
  accessToken,
  refreshToken,
  expiresIn,
}: {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}): Promise<void> => {
  const config = getConfig();
  if (!config.jira) return;

  config.jira.accessToken = accessToken;
  config.jira.refreshToken = refreshToken;
  config.jira.expiresAt = Date.now() + expiresIn * 1000;
  setConfig(config);

  await saveIntegrationToDB({
    deviceId: getCurrentDeviceId(),
    service: "jira",
    data: config.jira as unknown as Record<string, unknown>,
  });

  logger.info("Jira tokens refreshed");
};

// ── Jira Token Refresh ─────────────────────────────────

let jiraRefreshInFlight: Promise<JiraIntegration | null> | null = null;

export const refreshJiraTokenIfNeeded = async (): Promise<JiraIntegration | null> => {
  const config = getConfig();
  if (!config.jira) return null;

  if (config.jira.expiresAt > Date.now() + 60_000) {
    return config.jira;
  }

  if (jiraRefreshInFlight) return jiraRefreshInFlight;

  jiraRefreshInFlight = (async () => {
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

      await updateJiraTokens({
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresIn: data.expires_in,
      });

      logger.info("Jira token refreshed successfully");
      return getConfig().jira!;
    } catch (err) {
      logger.error("Jira token refresh error", {
        error: err instanceof Error ? err.message : String(err),
      });
      return config.jira!;
    } finally {
      jiraRefreshInFlight = null;
    }
  })();

  return jiraRefreshInFlight;
};

export const disconnectJira = (): void => {
  const config = getConfig();
  delete config.jira;
  setConfig(config);
  jiraRefreshInFlight = null;
  logger.info("Jira integration disconnected");
};

// ── Vercel ──────────────────────────────────────────────

export const getRuntimeVercelConfig = (): VercelIntegration | null => {
  return getConfig().vercel ?? null;
};

export const setRuntimeVercelConfig = (vercel: VercelIntegration): void => {
  const config = getConfig();
  config.vercel = vercel;
  setConfig(config);
  logger.info("Vercel integration connected", { projectId: vercel.projectId });
};

export const disconnectVercel = (): void => {
  const config = getConfig();
  delete config.vercel;
  setConfig(config);
  logger.info("Vercel integration disconnected");
};

// ── Status ──────────────────────────────────────────────

export const getIntegrationStatus = (): IntegrationStatus => {
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
      : { connected: false },

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
      : { connected: false },
  };
};
