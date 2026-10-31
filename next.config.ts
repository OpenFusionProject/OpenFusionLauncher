import type { NextConfig } from "next";

// https://v2.tauri.app/start/frontend/nextjs/
const nextConfig: NextConfig = {
  output: "export",
  // Next.js 16 writes AGENTS.md/CLAUDE.md into the repo root by default.
  agentRules: false,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
