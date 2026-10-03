import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: [
    "@neondatabase/serverless",
    "pg",
    "ws",
    "bcryptjs",
    "plaid",
    "@google/generative-ai",
    "@langchain/core",
    "stripe",
  ],
};

export default nextConfig;
