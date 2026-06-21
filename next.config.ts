import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Native / Node-only packages must not be bundled by Turbopack/webpack.
  serverExternalPackages: ["@lancedb/lancedb", "pdf-parse", "pdfjs-dist"],
  // Hide the floating Next.js dev indicator badge.
  devIndicators: false,
};

export default nextConfig;
