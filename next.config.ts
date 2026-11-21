import type { NextConfig } from "next";

// Unique per build: the commit SHA on Vercel, otherwise a timestamp taken when the config loads.
// Inlined into the client bundle and used to version the service worker URL (/sw.js?v=...)
// and its cache names, so every deploy installs a fresh worker.
const APP_VERSION = (process.env.VERCEL_GIT_COMMIT_SHA ?? Date.now().toString(36)).slice(0, 12);

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_APP_VERSION: APP_VERSION,
  },

  // Next 16 caching model (recommended pair; see docs/01-app/01-getting-started/08-caching.md).
  // The dashboard is a client component, so the page shell is prerendered and data stays in LocalStorage.
  cacheComponents: true,
  partialPrefetching: true,

  async headers() {
    return [
      {
        // The service worker script must never be HTTP-cached so updates roll out immediately.
        // (Next already serves public/*.js as application/javascript, so no Content-Type override.)
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
        ],
      },
    ];
  },

  // Tailwind CSS v4 is wired through this Turbopack loader (there is no postcss.config),
  // so this rule is required — removing it drops all utility classes.
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
