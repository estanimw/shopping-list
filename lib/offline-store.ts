import type { ShoppingSnapshot, SyncOperation } from "@/lib/types";

const DATABASE_NAME = "compra-ligera-offline";
const DATABASE_VERSION = 1;
const PROFILE_STORE = "profiles";
const META_STORE = "meta";
const LAST_USER_KEY = "last-user-id";

export interface OfflineProfile {
  deviceId: string;
  nextSequence: number;
  operations: SyncOperation[];
  snapshot: ShoppingSnapshot;
  updatedAt: string;
  userId: string;
  userName: string;
}

interface MetaValue {
  key: string;
  value: string;
}

function requestResult<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("No pudimos acceder al almacenamiento local."));
  });
}

function transactionDone(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("No pudimos guardar los cambios locales."));
    transaction.onabort = () => reject(transaction.error ?? new Error("Se canceló el guardado local."));
  });
}

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    if (!("indexedDB" in window)) {
      reject(new Error("Este navegador no permite guardar datos sin conexión."));
      return;
    }

    let settled = false;
    const fail = (error: Error) => {
      if (!settled) {
        settled = true;
        reject(error);
      }
    };
    const timeout = window.setTimeout(
      () => fail(new Error("El almacenamiento local no respondió a tiempo.")),
      1800,
    );
    const request = window.indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(PROFILE_STORE)) {
        database.createObjectStore(PROFILE_STORE, { keyPath: "userId" });
      }
      if (!database.objectStoreNames.contains(META_STORE)) {
        database.createObjectStore(META_STORE, { keyPath: "key" });
      }
    };
    request.onsuccess = () => {
      window.clearTimeout(timeout);
      if (settled) {
        request.result.close();
        return;
      }
      settled = true;
      resolve(request.result);
    };
    request.onerror = () => {
      window.clearTimeout(timeout);
      fail(request.error ?? new Error("No pudimos abrir el almacenamiento local."));
    };
  });
}

function createDeviceId() {
  return crypto.randomUUID();
}

export function createOfflineProfile(
  userId: string,
  userName: string,
  snapshot: ShoppingSnapshot,
): OfflineProfile {
  return {
    userId,
    userName,
    snapshot,
    operations: [],
    deviceId: createDeviceId(),
    nextSequence: 0,
    updatedAt: new Date().toISOString(),
  };
}

export async function loadOfflineProfile(userId: string) {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(PROFILE_STORE, "readonly");
    return (await requestResult(transaction.objectStore(PROFILE_STORE).get(userId))) as OfflineProfile | undefined;
  } finally {
    database.close();
  }
}

export async function loadLastOfflineProfile() {
  const database = await openDatabase();
  try {
    const transaction = database.transaction([META_STORE, PROFILE_STORE], "readonly");
    const lastUser = (await requestResult(
      transaction.objectStore(META_STORE).get(LAST_USER_KEY),
    )) as MetaValue | undefined;
    if (!lastUser) {
      return undefined;
    }
    return (await requestResult(
      transaction.objectStore(PROFILE_STORE).get(lastUser.value),
    )) as OfflineProfile | undefined;
  } finally {
    database.close();
  }
}

export async function saveOfflineProfile(profile: OfflineProfile) {
  const database = await openDatabase();
  try {
    const transaction = database.transaction([PROFILE_STORE, META_STORE], "readwrite");
    transaction.objectStore(PROFILE_STORE).put(profile);
    transaction.objectStore(META_STORE).put({ key: LAST_USER_KEY, value: profile.userId } satisfies MetaValue);
    await transactionDone(transaction);
  } finally {
    database.close();
  }
}

export async function clearOfflineProfile(userId: string) {
  const database = await openDatabase();
  try {
    const transaction = database.transaction([PROFILE_STORE, META_STORE], "readwrite");
    transaction.objectStore(PROFILE_STORE).delete(userId);
    const metaStore = transaction.objectStore(META_STORE);
    const lastUser = (await requestResult(metaStore.get(LAST_USER_KEY))) as MetaValue | undefined;
    if (lastUser?.value === userId) {
      metaStore.delete(LAST_USER_KEY);
    }
    await transactionDone(transaction);
  } finally {
    database.close();
  }
}

export function applyLocalOperation(snapshot: ShoppingSnapshot, operation: SyncOperation): ShoppingSnapshot {
  if (operation.type === "CREATE_ITEM") {
    if (snapshot.listId !== operation.listId || snapshot.items.some((item) => item.id === operation.item.id)) {
      return snapshot;
    }
    return { ...snapshot, items: [operation.item, ...snapshot.items] };
  }

  if (operation.type === "SET_ITEM_STATUS") {
    return {
      ...snapshot,
      items: snapshot.items.map((item) =>
        item.id === operation.itemId
          ? {
              ...item,
              status: operation.completed ? "COMPLETED" : "PENDING",
              completedAt: operation.completed ? operation.occurredAt : null,
            }
          : item,
      ),
    };
  }

  if (operation.type === "DELETE_ITEM") {
    return { ...snapshot, items: snapshot.items.filter((item) => item.id !== operation.itemId) };
  }

  if (operation.type === "RESTORE_ITEM") {
    if (snapshot.listId !== operation.listId || snapshot.items.some((item) => item.id === operation.item.id)) {
      return snapshot;
    }
    return {
      ...snapshot,
      items: [
        { ...operation.item, status: "PENDING", completedAt: null },
        ...snapshot.items,
      ],
    };
  }

  if (snapshot.listId !== operation.listId) {
    return snapshot;
  }
  return { listId: operation.nextListId, items: [] };
}
