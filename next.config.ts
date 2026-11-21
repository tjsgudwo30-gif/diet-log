import type { NextConfig } from "next";

// Unique per build: the commit SHA on Vercel, otherwise a timestamp.
// Used to version the service worker URL (/sw.js?v=...) and its caches.
const APP_VERSION = (process.env.VERCEL_GIT_COMMIT_SHA ?? Date.now().toString(36)).slice(0, 12);

const nextConfig: NextConfig = {
  /* config options here */
  env: {
    NEXT_PUBLIC_APP_VERSION: APP_VERSION,
  },
  cacheComponents: true,
  partialPrefetching: true,
  async headers() {
    return [
      {
        // Service worker must never be HTTP-cached so updates roll out immediately.
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
        ],
      },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
