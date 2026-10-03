import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: [
    "@neondatabase/serverless",
    "ws",
    "bcryptjs",
    "plaid",
    "@google/generative-ai",
    "@langchain/core",
    "stripe",
  ],
};

export default nextConfig;
