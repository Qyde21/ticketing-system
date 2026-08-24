import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-DNS-Prefetch-Control", value: "on" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(self), microphone=(), geolocation=(self), payment=(self)",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      // Scripts: Next + Paystack Popup/Inline + Google Maps
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.paystack.co https://*.paystack.co https://paystack.com https://*.paystack.com https://maps.googleapis.com https://*.googleapis.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://*.paystack.co",
      "img-src 'self' data: blob: https: http:",
      "font-src 'self' data: https://fonts.gstatic.com https://*.paystack.co",
      // XHR / fetch to Paystack API + everything HTTPS (maps, neon, etc.)
      "connect-src 'self' https: wss:",
      // Iframes: Paystack checkout + Google Maps + OAuth
      "frame-src 'self' https://js.paystack.co https://*.paystack.co https://checkout.paystack.com https://paystack.com https://*.paystack.com https://standard.paystack.co https://accounts.google.com https://maps.google.com https://www.google.com https://maps.googleapis.com https://*.google.com",
      "child-src 'self' blob: https://js.paystack.co https://*.paystack.co https://checkout.paystack.com https://maps.google.com https://www.google.com https://*.google.com",
      "worker-src 'self' blob:",
      "object-src 'none'",
      "base-uri 'self'",
      // Form posts into Paystack
      "form-action 'self' https://*.paystack.co https://checkout.paystack.com https://paystack.com https://*.paystack.com https://www.google.com",
      "frame-ancestors 'self'",
      "upgrade-insecure-requests",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
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
