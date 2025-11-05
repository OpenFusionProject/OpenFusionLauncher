import type { NextConfig } from "next";

// https://v2.tauri.app/start/frontend/nextjs/
const nextConfig: NextConfig = {
  output: "export",
  distDir: "out",
  images: {
    unoptimized: true,
  },
  typedRoutes: true,
};

export default nextConfig;
