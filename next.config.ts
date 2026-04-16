import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["better-sqlite3"],
  eslint: {
    // Repo has legacy ESLint violations; CI can enable strict lint separately.
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
