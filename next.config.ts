import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_SHOW_DEBUG_UI: process.env.SHOW_DEBUG_UI ?? "",
  },
  // All API keys are server-side only — never bundled into the client
  serverExternalPackages: ["openai", "@octokit/rest"],
  // Allow three.js / R3F packages to compile through Webpack
  transpilePackages: ["three", "@react-three/fiber", "@react-three/drei", "three-stdlib"],
  images: {
    dangerouslyAllowSVG: true,
    contentDispositionType: "attachment",
    remotePatterns: [
      { protocol: "https", hostname: "api.dicebear.com" },
    ],
  },
};

export default nextConfig;
