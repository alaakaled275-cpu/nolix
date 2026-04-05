import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // output: "standalone", // disabled in dev - causes Turbopack RSC manifest bug
  experimental: {
    // Disable Turbopack to fix "Could not find module in React Client Manifest" bug
  },
};

export default nextConfig;
