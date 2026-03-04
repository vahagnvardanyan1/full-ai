import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // All API keys are server-side only — never bundled into the client
  serverExternalPackages: ["openai", "@octokit/rest"],
};

export default nextConfig;
