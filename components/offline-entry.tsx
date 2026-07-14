"use client";

import { useEffect, useState } from "react";
import { ShoppingShell } from "@/components/shopping-shell";
import { loadLastOfflineProfile, type OfflineProfile } from "@/lib/offline-store";

export function OfflineEntry() {
  const [profile, setProfile] = useState<OfflineProfile | null>(null);

  useEffect(() => {
    void loadLastOfflineProfile()
      .then((storedProfile) => setProfile(storedProfile ?? null))
      .catch(() => setProfile(null));
  }, []);

  if (!profile) {
    return (
      <main className="offline-loading">
        <h1>Necesitás Internet una primera vez</h1>
        <p>Abrí Compra Ligera con conexión para dejar tu lista disponible sin señal.</p>
      </main>
    );
  }

  return (
    <ShoppingShell
      initialSnapshot={profile.snapshot}
      userId={profile.userId}
      userName={profile.userName}
    />
  );
}
