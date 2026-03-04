// ──────────────────────────────────────────────────────────
// GET /api/auth/jira/callback — Jira OAuth 2.0 (3LO) callback
//
// Exchanges the authorization code for tokens, fetches the
// accessible cloud resources, and stores the integration.
// ──────────────────────────────────────────────────────────

import { NextRequest } from "next/server";
import { setRuntimeJiraConfig } from "@/lib/clients/integration-store";
import { logger } from "@/lib/logger";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error || !code) {
    return renderPopupResult(false, error ?? "No authorization code received");
  }

  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

    // 1. Exchange code for tokens
    const tokenRes = await fetch("https://auth.atlassian.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "authorization_code",
        client_id: process.env.JIRA_CLIENT_ID,
        client_secret: process.env.JIRA_CLIENT_SECRET,
        code,
        redirect_uri: `${appUrl}/api/auth/jira/callback`,
      }),
    });

    const tokenData = await tokenRes.json();

    if (!tokenRes.ok || tokenData.error) {
      logger.error("Jira OAuth token exchange failed", { error: tokenData.error });
      return renderPopupResult(false, tokenData.error_description ?? tokenData.error ?? "Token exchange failed");
    }

    const { access_token, refresh_token, expires_in } = tokenData;

    // 2. Fetch accessible resources (cloud sites)
    const resourcesRes = await fetch("https://api.atlassian.com/oauth/token/accessible-resources", {
      headers: {
        Authorization: `Bearer ${access_token}`,
        Accept: "application/json",
      },
    });

    if (!resourcesRes.ok) {
      throw new Error(`Failed to fetch Jira resources: ${resourcesRes.status}`);
    }

    const resources = await resourcesRes.json();

    if (!resources.length) {
      return renderPopupResult(false, "No accessible Jira sites found for this account.");
    }

    // Use the first accessible site
    const site = resources[0];
    const cloudId = site.id;
    const siteName = site.name;
    const siteUrl = site.url;

    // 3. Fetch user info
    const meRes = await fetch("https://api.atlassian.com/me", {
      headers: {
        Authorization: `Bearer ${access_token}`,
        Accept: "application/json",
      },
    });

    const meData = meRes.ok ? await meRes.json() : { email: "unknown" };

    // 4. Store integration (project key will be selected in UI)
    setRuntimeJiraConfig({
      accessToken: access_token,
      refreshToken: refresh_token,
      cloudId,
      siteUrl,
      siteName,
      projectKey: "", // Will be selected via UI
      email: meData.email ?? meData.account_id ?? "unknown",
      connectedAt: Date.now(),
      expiresAt: Date.now() + (expires_in ?? 3600) * 1000,
    });

    logger.info("Jira OAuth completed", { siteName, cloudId, email: meData.email });

    return renderPopupResult(true, undefined, {
      siteName,
      email: meData.email ?? meData.account_id,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("Jira OAuth callback error", { error: message });
    return renderPopupResult(false, message);
  }
}

function renderPopupResult(
  success: boolean,
  error?: string,
  data?: { siteName: string; email: string },
) {
  const message = success
    ? JSON.stringify({ type: "jira-connected", ...data })
    : JSON.stringify({ type: "jira-error", error });

  const html = `<!DOCTYPE html>
<html>
<head><title>Jira Authorization</title></head>
<body>
<p>${success ? "Connected to Jira! This window will close." : `Error: ${error}`}</p>
<script>
  if (window.opener) {
    window.opener.postMessage(${message}, window.location.origin);
  }
  setTimeout(() => window.close(), 1500);
</script>
</body>
</html>`;

  return new Response(html, {
    headers: { "Content-Type": "text/html" },
  });
}
