import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Transpile the workspace packages that ship TypeScript / raw source.
  transpilePackages: ["@inkd/core", "@inkd/ui"],
};

export default nextConfig;
