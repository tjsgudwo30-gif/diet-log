"use client";

import { useEffect } from "react";

/** Registers /sw.js in production builds only, so dev HMR is never served from cache. */
export function RegisterSW() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {
      /* offline support is best-effort */
    });
  }, []);
  return null;
}
