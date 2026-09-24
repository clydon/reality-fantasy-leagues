"use client";

import { useEffect } from "react";

// Registers public/sw.js (see its header for what it does and, more importantly, what it doesn't).
// Production only: in `next dev` a registered worker outlives the tab and can mask hot reloads, which
// makes local debugging miserable for no benefit.
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {
      // Non-fatal: the app works identically without it, just with no offline screen.
    });
  }, []);
  return null;
}
