import type { NextConfig } from "next";

const apiUrl =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api";

/** Derive API origin for CSP connect-src (no path). */
function apiOrigin(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return "http://localhost:3000";
  }
}

const connectSrc = ["'self'", apiOrigin(apiUrl)].join(" ");

const securityHeaders = [
  { key: "X-DNS-Prefetch-Control", value: "on" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "base-uri 'self'",
      "frame-ancestors 'none'",
      "object-src 'none'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      // Next.js requires inline scripts/styles in many setups; tighten when moving to nonces
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      `connect-src ${connectSrc}`,
      "form-action 'self'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
