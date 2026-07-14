"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  applyLocalOperation,
  clearOfflineProfile,
  createOfflineProfile,
  loadOfflineProfile,
  saveOfflineProfile,
  type OfflineProfile,
} from "@/lib/offline-store";
import type { NewShoppingItem, ShoppingItem, ShoppingSnapshot, SyncOperation, SyncResponse } from "@/lib/types";

export type SynchronizationState = "offline" | "pending" | "synchronized" | "synchronizing" | "needs-auth";

interface UseOfflineShoppingOptions {
  initialSnapshot: ShoppingSnapshot;
  userId: string;
  userName: string;
}

function initialSyncState() {
  return typeof navigator !== "undefined" && !navigator.onLine ? "offline" : "synchronized";
}

function operationMetadata(profile: OfflineProfile) {
  const sequence = profile.nextSequence + 1;
  return {
    deviceId: profile.deviceId,
    occurredAt: new Date().toISOString(),
    operationId: crypto.randomUUID(),
    sequence,
  };
}

export function useOfflineShopping({ initialSnapshot, userId, userName }: UseOfflineShoppingOptions) {
  const profileRef = useRef<OfflineProfile>(createOfflineProfile(userId, userName, initialSnapshot));
  const writeChainRef = useRef(Promise.resolve());
  const syncInFlightRef = useRef(false);
  const readyRef = useRef(false);
  const authPausedRef = useRef(false);
  const [profile, setProfile] = useState(() => createOfflineProfile(userId, userName, initialSnapshot));
  const [isReady, setIsReady] = useState(false);
  const [syncState, setSyncState] = useState<SynchronizationState>(initialSyncState);

  const persist = useCallback((nextProfile: OfflineProfile) => {
    profileRef.current = nextProfile;
    setProfile(nextProfile);
    writeChainRef.current = writeChainRef.current.then(() => saveOfflineProfile(nextProfile));
    return writeChainRef.current;
  }, []);

  const synchronize = useCallback(async () => {
    if (!readyRef.current || syncInFlightRef.current || authPausedRef.current) {
      return;
    }

    await writeChainRef.current;
    const currentProfile = profileRef.current;
    if (!currentProfile.operations.length) {
      setSyncState(navigator.onLine ? "synchronized" : "offline");
      return;
    }
    if (!navigator.onLine) {
      setSyncState("offline");
      return;
    }

    syncInFlightRef.current = true;
    setSyncState("synchronizing");
    const sentOperationIds = new Set(currentProfile.operations.map((operation) => operation.operationId));

    try {
      const response = await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ operations: currentProfile.operations }),
      });

      if (response.status === 401) {
        authPausedRef.current = true;
        setSyncState("needs-auth");
        return;
      }
      if (!response.ok) {
        throw new Error("La sincronización fue rechazada.");
      }

      const result = (await response.json()) as SyncResponse;
      const confirmed = new Set(result.processedOperationIds.filter((id) => sentOperationIds.has(id)));
      const latestProfile = profileRef.current;
      const remainingOperations = latestProfile.operations.filter(
        (operation) => !confirmed.has(operation.operationId),
      );
      const localSnapshot = remainingOperations.reduce(applyLocalOperation, result.snapshot);
      await persist({
        ...latestProfile,
        snapshot: localSnapshot,
        operations: remainingOperations,
        updatedAt: new Date().toISOString(),
      });
      setSyncState(remainingOperations.length ? "pending" : "synchronized");
    } catch {
      setSyncState(navigator.onLine ? "pending" : "offline");
    } finally {
      syncInFlightRef.current = false;
    }
  }, [persist]);

  useEffect(() => {
    let cancelled = false;
    readyRef.current = false;
    authPausedRef.current = false;

    void (async () => {
      try {
        const storedProfile = await loadOfflineProfile(userId);
        const nextProfile = storedProfile?.operations.length
          ? { ...storedProfile, userName }
          : storedProfile
            ? {
                ...storedProfile,
                userName,
                snapshot: initialSnapshot,
                updatedAt: new Date().toISOString(),
              }
            : createOfflineProfile(userId, userName, initialSnapshot);

        if (cancelled) {
          return;
        }
        profileRef.current = nextProfile;
        setProfile(nextProfile);
        await saveOfflineProfile(nextProfile);
        if (cancelled) {
          return;
        }
        readyRef.current = true;
        setIsReady(true);
        void synchronize();
      } catch {
        if (!cancelled) {
          setSyncState("offline");
          readyRef.current = true;
          setIsReady(true);
        }
      }
    })();

    const resumeSynchronization = () => {
      if (!authPausedRef.current) {
        void synchronize();
      }
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        resumeSynchronization();
      }
    };
    const onOffline = () => setSyncState("offline");
    window.addEventListener("online", resumeSynchronization);
    window.addEventListener("offline", onOffline);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      cancelled = true;
      window.removeEventListener("online", resumeSynchronization);
      window.removeEventListener("offline", onOffline);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [initialSnapshot, synchronize, userId, userName]);

  const enqueue = useCallback(
    async (createOperation: (profile: OfflineProfile, metadata: ReturnType<typeof operationMetadata>) => SyncOperation) => {
      if (!readyRef.current) {
        return false;
      }

      const currentProfile = profileRef.current;
      const metadata = operationMetadata(currentProfile);
      const operation = createOperation(currentProfile, metadata);
      const nextProfile = {
        ...currentProfile,
        nextSequence: metadata.sequence,
        operations: [...currentProfile.operations, operation],
        snapshot: applyLocalOperation(currentProfile.snapshot, operation),
        updatedAt: new Date().toISOString(),
      };
      await persist(nextProfile);
      setSyncState(navigator.onLine ? "pending" : "offline");
      void synchronize();
      return true;
    },
    [persist, synchronize],
  );

  const addItem = useCallback(
    (input: NewShoppingItem) => {
      const item: ShoppingItem = {
        id: crypto.randomUUID(),
        name: input.name.trim().replace(/\s+/g, " "),
        category: input.category,
        iconKey: input.iconKey,
        status: "PENDING",
        createdAt: new Date().toISOString(),
        completedAt: null,
      };
      return enqueue((currentProfile, metadata) => ({
        ...metadata,
        type: "CREATE_ITEM",
        listId: currentProfile.snapshot.listId,
        item,
      })).then((saved) => ({ saved, item }));
    },
    [enqueue],
  );

  const setItemCompletion = useCallback(
    (itemId: string, completed: boolean) =>
      enqueue((currentProfile, metadata) => ({
        ...metadata,
        type: "SET_ITEM_STATUS",
        listId: currentProfile.snapshot.listId,
        itemId,
        completed,
      })),
    [enqueue],
  );

  const deleteItem = useCallback(
    (itemId: string) =>
      enqueue((currentProfile, metadata) => ({
        ...metadata,
        type: "DELETE_ITEM",
        listId: currentProfile.snapshot.listId,
        itemId,
      })),
    [enqueue],
  );

  const restoreItem = useCallback(
    (item: ShoppingItem) =>
      enqueue((currentProfile, metadata) => ({
        ...metadata,
        type: "RESTORE_ITEM",
        listId: currentProfile.snapshot.listId,
        item,
      })),
    [enqueue],
  );

  const finishPurchase = useCallback(
    () =>
      enqueue((currentProfile, metadata) => ({
        ...metadata,
        type: "FINISH_PURCHASE",
        listId: currentProfile.snapshot.listId,
        nextListId: crypto.randomUUID(),
      })),
    [enqueue],
  );

  const clearLocalData = useCallback(async () => {
    await clearOfflineProfile(userId);
  }, [userId]);

  return {
    addItem,
    clearLocalData,
    deleteItem,
    finishPurchase,
    isReady,
    pendingChanges: profile.operations.length,
    restoreItem,
    setItemCompletion,
    snapshot: profile.snapshot,
    syncState,
  };
}
