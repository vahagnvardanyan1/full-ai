import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // All API keys are server-side only — never bundled into the client
  serverExternalPackages: ["openai", "@octokit/rest"],
  images: {
    dangerouslyAllowSVG: true,
    contentDispositionType: "attachment",
    remotePatterns: [
      { protocol: "https", hostname: "api.dicebear.com" },
    ],
  },
};

export default nextConfig;
