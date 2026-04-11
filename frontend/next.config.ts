import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Turbopack: handle Leaflet canvas for SSR
  turbopack: {
    resolveAlias: {
      canvas: "./empty-module.js",
    },
  },
  // Webpack fallback (used when Turbopack is not active)
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        canvas: false,
      };
    }
    return config;
  },
};

export default nextConfig;
