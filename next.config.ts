import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "resource.heygen.com" },
      { protocol: "https", hostname: "files.heygen.ai" },
    ],
  },
};

export default nextConfig;
