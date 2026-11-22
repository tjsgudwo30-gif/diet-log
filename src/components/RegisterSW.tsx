"use client";

import { useEffect } from "react";

/** Build stamp inlined at build time (next.config.ts → env). Changes on every build. */
const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "dev";

/**
 * Registers /sw.js in production builds only, so dev HMR is never served from cache.
 * The build stamp in the script URL makes each deploy install a fresh worker
 * (and lets that worker drop the previous build's caches).
 */
export function RegisterSW() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;

    // All records live in localStorage. When running as the installed home-screen app,
    // ask the browser to mark this origin's storage persistent so it isn't evicted under
    // storage pressure. (Only in standalone mode: some browsers prompt in a normal tab.)
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (standalone) navigator.storage?.persist?.().catch(() => {});

    if (!("serviceWorker" in navigator)) return;
    const url = `/sw.js?v=${encodeURIComponent(APP_VERSION)}`;
    const register = () =>
      navigator.serviceWorker.register(url, { scope: "/", updateViaCache: "none" }).catch(() => {
        /* offline support is best-effort */
      });
    // Don't compete with first paint / hydration for bandwidth.
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }, []);
  return null;
}
