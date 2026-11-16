import type { NextConfig } from "next";

// Anti-framing + HSTS only in production deployments (Vercel sets VERCEL=1), so local
// previews that embed the app in a frame keep working.
const production = process.env.VERCEL === "1" || process.env.PELOTON_STRICT_HEADERS === "1";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self)" },
  {
    key: "Content-Security-Policy",
    value: `${production ? "frame-ancestors 'none'; " : ""}base-uri 'self'; form-action 'self'; object-src 'none'`,
  },
  ...(production
    ? [
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
      ]
    : []),
];

// Static export for hosts without a server (GitHub Pages): STATIC_EXPORT=1 npm run build:static
const staticExport = process.env.STATIC_EXPORT === "1";
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const nextConfig: NextConfig = staticExport
  ? { output: "export", basePath, trailingSlash: true, images: { unoptimized: true }, poweredByHeader: false }
  : {
      poweredByHeader: false,
      async headers() {
        return [{ source: "/:path*", headers: securityHeaders }];
      },
    };

export default nextConfig;
