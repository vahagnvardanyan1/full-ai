import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
