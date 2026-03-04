// ──────────────────────────────────────────────────────────
// Token revocation helpers
//
// Called on disconnect so that the provider invalidates the
// existing grant. After revocation GitHub/Atlassian will show
// the full authorization UI again on the next OAuth attempt,
// allowing the user to pick a different account.
//
// All functions are fire-and-forget safe — errors are logged
// but never thrown, so a failed revocation never blocks the
// local disconnect flow.
// ──────────────────────────────────────────────────────────

import { logger } from "@/lib/logger";

export const revokeGitHubToken = async (accessToken: string): Promise<void> => {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    logger.warn("Cannot revoke GitHub grant — GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET not set");
    return;
  }

  try {
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

    // DELETE /grant removes the entire OAuth authorization for this user,
    // not just the individual token. After this GitHub will show the full
    // authorization screen on the next OAuth attempt, allowing account switching.
    const res = await fetch(`https://api.github.com/applications/${clientId}/grant`, {
      method: "DELETE",
      headers: {
        Authorization: `Basic ${credentials}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ access_token: accessToken }),
    });

    if (res.ok || res.status === 204 || res.status === 404) {
      logger.info("GitHub authorization grant revoked");
    } else {
      const body = await res.text().catch(() => "");
      logger.warn("GitHub grant revocation returned non-OK status", {
        status: res.status,
        body,
      });
    }
  } catch (err) {
    logger.error("GitHub grant revocation failed", {
      error: err instanceof Error ? err.message : String(err),
    });
  }
};

export const revokeJiraToken = async (refreshToken: string): Promise<void> => {
  const clientId = process.env.JIRA_CLIENT_ID;
  const clientSecret = process.env.JIRA_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    logger.warn("Cannot revoke Jira token — JIRA_CLIENT_ID / JIRA_CLIENT_SECRET not set");
    return;
  }

  try {
    const body = new URLSearchParams({
      token: refreshToken,
      token_type_hint: "refresh_token",
      client_id: clientId,
      client_secret: clientSecret,
    });

    const res = await fetch("https://auth.atlassian.com/oauth/token/revoke", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });

    if (res.ok) {
      logger.info("Jira token revoked");
    } else {
      const text = await res.text().catch(() => "");
      logger.warn("Jira token revocation returned non-OK status", {
        status: res.status,
        body: text,
      });
    }
  } catch (err) {
    logger.error("Jira token revocation failed", {
      error: err instanceof Error ? err.message : String(err),
    });
  }
};
