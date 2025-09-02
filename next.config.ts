import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {
    turbo: {
      rules: {
        "*.tsx": {
          loaders: ["@babel/preset-typescript"],
        },
      },
    },
  },
};

export default nextConfig;
