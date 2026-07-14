"use client";

import { useEffect } from "react";

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    if (process.env.NODE_ENV !== "production") {
      void navigator.serviceWorker.getRegistrations().then((registrations) =>
        Promise.all(registrations.map((registration) => registration.unregister())),
      );
      return;
    }

    void navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((registration) => {
        const warmCache = () => registration.active?.postMessage({ type: "WARM_OFFLINE_SHELL" });
        if (registration.active) {
          warmCache();
          return;
        }
        const installing = registration.installing;
        installing?.addEventListener("statechange", () => {
          if (installing.state === "activated") {
            warmCache();
          }
        });
      })
      .catch(() => {
        // The app remains usable online when the browser declines service workers.
      });
  }, []);

  return null;
}
