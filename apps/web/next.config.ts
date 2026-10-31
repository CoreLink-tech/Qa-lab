import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Backend API is separate; no rewrites required for scaffold.
  // Optionally proxy in dev:
  // async rewrites() {
  //   return [{ source: "/api/:path*", destination: "http://localhost:3000/api/:path*" }];
  // },
};

export default nextConfig;
