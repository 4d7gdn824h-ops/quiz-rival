import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: "/scan", destination: "/homework", permanent: false },
      { source: "/create", destination: "/homework", permanent: false },
      { source: "/room/new", destination: "/homework", permanent: false },
      { source: "/homework/confirm", destination: "/homework", permanent: false },
      { source: "/write", destination: "/homework", permanent: false },
    ];
  },
  experimental: {
    proxyClientMaxBodySize: "10mb",
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
