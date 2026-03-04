// ──────────────────────────────────────────────────────────
// GET /api/auth/github/callback — GitHub OAuth callback
//
// Exchanges the authorization code for an access token,
// fetches user info, and stores the integration config.
// Then renders a small HTML page that notifies the opener
// window and closes itself.
// ──────────────────────────────────────────────────────────

import { NextRequest } from "next/server";
import { setRuntimeGitHubConfig } from "@/lib/clients/integration-store";
import { runWithDeviceId, getDeviceIdFromCookies } from "@/lib/request-context";
import { logger } from "@/lib/logger";

export async function GET(request: NextRequest) {
  const deviceId = getDeviceIdFromCookies(request.cookies);
  return runWithDeviceId(deviceId, async () => {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    const error = searchParams.get("error");

    if (error || !code) {
      return renderPopupResult(false, error ?? "No authorization code received");
    }

    try {
      // 1. Exchange code for access token
      const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          client_id: process.env.GITHUB_CLIENT_ID,
          client_secret: process.env.GITHUB_CLIENT_SECRET,
          code,
        }),
      });

      const tokenData = await tokenRes.json();

      if (tokenData.error) {
        logger.error("GitHub OAuth token exchange failed", { error: tokenData.error });
        return renderPopupResult(false, tokenData.error_description ?? tokenData.error);
      }

      const accessToken = tokenData.access_token as string;

      // 2. Fetch authenticated user info
      const userRes = await fetch("https://api.github.com/user", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/vnd.github+json",
        },
      });

      if (!userRes.ok) {
        throw new Error(`GitHub API returned ${userRes.status}`);
      }

      const userData = await userRes.json();

      // 3. Store the integration (owner/repo will be selected in UI)
      setRuntimeGitHubConfig({
        accessToken,
        owner: userData.login,
        repo: "", // Will be selected via UI
        login: userData.login,
        avatarUrl: userData.avatar_url,
        connectedAt: Date.now(),
      });

      logger.info("GitHub OAuth completed", { login: userData.login });

      return renderPopupResult(true, undefined, {
        login: userData.login,
        avatarUrl: userData.avatar_url,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error("GitHub OAuth callback error", { error: message });
      return renderPopupResult(false, message);
    }
  });
}

function renderPopupResult(
  success: boolean,
  error?: string,
  data?: { login: string; avatarUrl: string },
) {
  const message = success
    ? JSON.stringify({ type: "github-connected", ...data })
    : JSON.stringify({ type: "github-error", error });

  const html = `<!DOCTYPE html>
<html>
<head><title>GitHub Authorization</title></head>
<body>
<p>${success ? "Connected to GitHub! This window will close." : `Error: ${error}`}</p>
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
