"use client";

import { useEffect } from "react";

/** Registers a minimal service worker for installability / standalone launches. */
export function RegisterServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") return;

    void (async () => {
      try {
        // Force update checks so layout fixes reach installed PWAs quickly.
        const existing = await navigator.serviceWorker.getRegistrations();
        await Promise.all(existing.map((reg) => reg.update()));
        await navigator.serviceWorker.register("/sw.js");
      } catch {
        // Non-fatal — install still works on iOS without a service worker.
      }
    })();
  }, []);

  return null;
}
