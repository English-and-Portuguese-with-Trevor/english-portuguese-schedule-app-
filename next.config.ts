import type { NextConfig } from "next";

// The site is never shown inside another page, so it refuses framing.
const SECURITY_HEADERS = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Turbopack copies small shared modules into every chunk group below 50 kB
  // (the default), so the error and not-found pages each carried their own
  // copy of the status page into every page's first load. Smaller chunks share them.
  experimental: { turbopackChunking: { minChunkSize: 10000 } },
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;
