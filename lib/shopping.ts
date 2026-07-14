import { randomUUID } from "node:crypto";
import { isItemIconKey, isShoppingCategory } from "@/lib/catalog";
import { getDatabase } from "@/lib/db";
import type {
  ItemStatus,
  NewShoppingItem,
  ShoppingItem,
  ShoppingSnapshot,
  SyncOperation,
  SyncResponse,
} from "@/lib/types";

type StoredItemStatus = ItemStatus | "DELETED";

interface ListRow {
  id: number;
  last_mutation_at: string;
  last_mutation_operation_id: string;
  status: "ACTIVE" | "FINISHED";
  sync_id: string;
}

interface ItemRow {
  category: ShoppingItem["category"];
  completed_at: string | null;
  created_at: string;
  icon_key: ShoppingItem["iconKey"];
  id: number;
  last_mutation_at: string;
  last_mutation_operation_id: string;
  list_id: number;
  name: string;
  status: StoredItemStatus;
  sync_id: string;
}

const itemColumns = `items.id, items.sync_id, items.list_id, items.name, items.category,
  items.icon_key, items.status, items.created_at, items.completed_at,
  items.last_mutation_at, items.last_mutation_operation_id`;

function mapItem(row: ItemRow): ShoppingItem {
  return {
    id: row.sync_id,
    name: row.name,
    category: row.category,
    iconKey: row.icon_key,
    status: row.status as ItemStatus,
    createdAt: row.created_at,
    completedAt: row.completed_at,
  };
}

function claimLegacyListsForUser(userId: string) {
  getDatabase()
    .prepare("UPDATE shopping_lists SET user_id = ? WHERE user_id IS NULL")
    .run(userId);
}

function activeListForUser(userId: string) {
  return getDatabase()
    .prepare(
      `SELECT id, sync_id, status, last_mutation_at, last_mutation_operation_id
       FROM shopping_lists WHERE user_id = ? AND status = 'ACTIVE' LIMIT 1`,
    )
    .get(userId) as ListRow | undefined;
}

function listForUser(userId: string, syncId: string) {
  return getDatabase()
    .prepare(
      `SELECT id, sync_id, status, last_mutation_at, last_mutation_operation_id
       FROM shopping_lists WHERE user_id = ? AND sync_id = ?`,
    )
    .get(userId, syncId) as ListRow | undefined;
}

function findOrCreateActiveList(userId: string) {
  const existing = activeListForUser(userId);
  if (existing) {
    return existing;
  }

  const database = getDatabase();
  const syncId = randomUUID();
  const mutationAt = new Date().toISOString();
  try {
    const result = database
      .prepare(
        `INSERT INTO shopping_lists
          (sync_id, user_id, status, last_mutation_at, last_mutation_operation_id)
         VALUES (?, ?, 'ACTIVE', ?, ?)`,
      )
      .run(syncId, userId, mutationAt, `server:${syncId}`);

    return {
      id: Number(result.lastInsertRowid),
      sync_id: syncId,
      status: "ACTIVE" as const,
      last_mutation_at: mutationAt,
      last_mutation_operation_id: `server:${syncId}`,
    };
  } catch {
    const createdByAnotherRequest = activeListForUser(userId);
    if (!createdByAnotherRequest) {
      throw new Error("No se pudo crear una lista de compras activa.");
    }
    return createdByAnotherRequest;
  }
}

function itemForUser(userId: string, itemId: string) {
  return getDatabase()
    .prepare(
      `SELECT ${itemColumns}
       FROM shopping_items AS items
       INNER JOIN shopping_lists AS lists ON lists.id = items.list_id
       WHERE items.sync_id = ? AND lists.user_id = ?`,
    )
    .get(itemId, userId) as ItemRow | undefined;
}

function activeListForOperation(userId: string, requestedListId: string) {
  const requested = listForUser(userId, requestedListId);
  if (requested?.status === "ACTIVE") {
    return requested;
  }

  return activeListForUser(userId);
}

function validMutationTime(value: string) {
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    throw new Error("La fecha de una operación no es válida.");
  }
  return new Date(parsed).toISOString();
}

function operationWins(
  lastMutationAt: string,
  lastOperationId: string,
  nextMutationAt: string,
  nextOperationId: string,
) {
  const previous = Date.parse(lastMutationAt);
  const next = Date.parse(nextMutationAt);
  if (Number.isNaN(previous) || next > previous) {
    return true;
  }
  if (next < previous) {
    return false;
  }
  return nextOperationId > lastOperationId;
}

function itemInputIsValid(item: unknown): item is ShoppingItem {
  if (!item || typeof item !== "object") {
    return false;
  }

  const candidate = item as Partial<ShoppingItem>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.name === "string" &&
    candidate.name.trim().length > 0 &&
    candidate.name.trim().length <= 60 &&
    typeof candidate.category === "string" &&
    isShoppingCategory(candidate.category) &&
    typeof candidate.iconKey === "string" &&
    isItemIconKey(candidate.iconKey) &&
    (candidate.status === "PENDING" || candidate.status === "COMPLETED") &&
    typeof candidate.createdAt === "string"
  );
}

function syncOperationIsValid(operation: unknown): operation is SyncOperation {
  if (!operation || typeof operation !== "object") {
    return false;
  }

  const candidate = operation as Partial<SyncOperation>;
  if (
    typeof candidate.operationId !== "string" ||
    typeof candidate.deviceId !== "string" ||
    typeof candidate.occurredAt !== "string" ||
    typeof candidate.sequence !== "number" ||
    !Number.isSafeInteger(candidate.sequence) ||
    candidate.sequence < 0 ||
    typeof candidate.type !== "string" ||
    typeof candidate.listId !== "string"
  ) {
    return false;
  }

  if (candidate.type === "CREATE_ITEM" || candidate.type === "RESTORE_ITEM") {
    return itemInputIsValid(candidate.item);
  }
  if (candidate.type === "SET_ITEM_STATUS") {
    return typeof candidate.itemId === "string" && typeof candidate.completed === "boolean";
  }
  if (candidate.type === "DELETE_ITEM") {
    return typeof candidate.itemId === "string";
  }
  if (candidate.type === "FINISH_PURCHASE") {
    return typeof candidate.nextListId === "string";
  }
  return false;
}

function setItemMutation(
  itemId: number,
  status: StoredItemStatus,
  completedAt: string | null,
  deletedAt: string | null,
  mutationAt: string,
  operationId: string,
) {
  getDatabase()
    .prepare(
      `UPDATE shopping_items
       SET status = ?, completed_at = ?, deleted_at = ?,
           last_mutation_at = ?, last_mutation_operation_id = ?
       WHERE id = ?`,
    )
    .run(status, completedAt, deletedAt, mutationAt, operationId, itemId);
}

function applyCreateItem(userId: string, operation: Extract<SyncOperation, { type: "CREATE_ITEM" }>) {
  const database = getDatabase();
  const existing = database
    .prepare("SELECT id FROM shopping_items WHERE sync_id = ?")
    .get(operation.item.id) as { id: number } | undefined;
  if (existing) {
    return;
  }

  const list = activeListForOperation(userId, operation.listId);
  if (!list) {
    return;
  }

  const mutationAt = validMutationTime(operation.occurredAt);
  database
    .prepare(
      `INSERT INTO shopping_items
       (sync_id, list_id, name, category, icon_key, status, created_at,
        completed_at, last_mutation_at, last_mutation_operation_id)
       VALUES (?, ?, ?, ?, ?, 'PENDING', ?, NULL, ?, ?)`,
    )
    .run(
      operation.item.id,
      list.id,
      operation.item.name.trim().replace(/\s+/g, " "),
      operation.item.category,
      operation.item.iconKey,
      operation.item.createdAt,
      mutationAt,
      operation.operationId,
    );
}

function applySetItemStatus(
  userId: string,
  operation: Extract<SyncOperation, { type: "SET_ITEM_STATUS" }>,
) {
  const item = itemForUser(userId, operation.itemId);
  if (!item || item.status === "DELETED") {
    return;
  }

  const mutationAt = validMutationTime(operation.occurredAt);
  if (!operationWins(item.last_mutation_at, item.last_mutation_operation_id, mutationAt, operation.operationId)) {
    return;
  }

  setItemMutation(
    item.id,
    operation.completed ? "COMPLETED" : "PENDING",
    operation.completed ? mutationAt : null,
    null,
    mutationAt,
    operation.operationId,
  );
}

function applyDeleteItem(
  userId: string,
  operation: Extract<SyncOperation, { type: "DELETE_ITEM" }>,
) {
  const item = itemForUser(userId, operation.itemId);
  if (!item) {
    return;
  }

  const mutationAt = validMutationTime(operation.occurredAt);
  if (!operationWins(item.last_mutation_at, item.last_mutation_operation_id, mutationAt, operation.operationId)) {
    return;
  }

  setItemMutation(item.id, "DELETED", item.completed_at, mutationAt, mutationAt, operation.operationId);
}

function applyRestoreItem(
  userId: string,
  operation: Extract<SyncOperation, { type: "RESTORE_ITEM" }>,
) {
  const item = itemForUser(userId, operation.item.id);
  if (!item) {
    return;
  }

  const mutationAt = validMutationTime(operation.occurredAt);
  if (!operationWins(item.last_mutation_at, item.last_mutation_operation_id, mutationAt, operation.operationId)) {
    return;
  }

  setItemMutation(item.id, "PENDING", null, null, mutationAt, operation.operationId);
}

function finishListItems(listId: number, mutationAt: string, operationId: string) {
  const rows = getDatabase()
    .prepare(
      `SELECT ${itemColumns} FROM shopping_items AS items
       WHERE items.list_id = ? AND items.status = 'PENDING'`,
    )
    .all(listId) as ItemRow[];

  for (const item of rows) {
    if (operationWins(item.last_mutation_at, item.last_mutation_operation_id, mutationAt, operationId)) {
      setItemMutation(item.id, "COMPLETED", mutationAt, null, mutationAt, operationId);
    }
  }
}

function insertList(userId: string, syncId: string, status: "ACTIVE" | "FINISHED", mutationAt: string, operationId: string) {
  const result = getDatabase()
    .prepare(
      `INSERT INTO shopping_lists
       (sync_id, user_id, status, last_mutation_at, last_mutation_operation_id)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(syncId, userId, status, mutationAt, operationId);

  return {
    id: Number(result.lastInsertRowid),
    sync_id: syncId,
    status,
    last_mutation_at: mutationAt,
    last_mutation_operation_id: operationId,
  } satisfies ListRow;
}

function finishListRow(listId: number, mutationAt: string, operationId: string) {
  getDatabase()
    .prepare(
      `UPDATE shopping_lists
       SET status = 'FINISHED', finished_at = ?, last_mutation_at = ?, last_mutation_operation_id = ?
       WHERE id = ?`,
    )
    .run(mutationAt, mutationAt, operationId, listId);
}

function activateListRow(listId: number, mutationAt: string, operationId: string) {
  getDatabase()
    .prepare(
      `UPDATE shopping_lists
       SET status = 'ACTIVE', finished_at = NULL, last_mutation_at = ?, last_mutation_operation_id = ?
       WHERE id = ?`,
    )
    .run(mutationAt, operationId, listId);
}

function applyFinishPurchase(
  userId: string,
  operation: Extract<SyncOperation, { type: "FINISH_PURCHASE" }>,
) {
  const source = listForUser(userId, operation.listId);
  if (!source) {
    return;
  }

  const mutationAt = validMutationTime(operation.occurredAt);
  if (!operationWins(source.last_mutation_at, source.last_mutation_operation_id, mutationAt, operation.operationId)) {
    return;
  }

  finishListItems(source.id, mutationAt, operation.operationId);
  finishListRow(source.id, mutationAt, operation.operationId);

  let target = listForUser(userId, operation.nextListId);
  let active = activeListForUser(userId);

  if (active?.id === source.id) {
    active = undefined;
  }

  if (active && active.id !== target?.id) {
    if (!target) {
      target = insertList(userId, operation.nextListId, "FINISHED", mutationAt, operation.operationId);
    }

    getDatabase()
      .prepare("UPDATE shopping_items SET list_id = ? WHERE list_id = ? AND status != 'DELETED'")
      .run(target.id, active.id);
    finishListRow(active.id, mutationAt, operation.operationId);
    active = undefined;
  }

  if (!target) {
    insertList(userId, operation.nextListId, "ACTIVE", mutationAt, operation.operationId);
  } else if (target.status !== "ACTIVE") {
    activateListRow(target.id, mutationAt, operation.operationId);
  }
}

function applyOperation(userId: string, operation: SyncOperation) {
  if (operation.type === "CREATE_ITEM") {
    applyCreateItem(userId, operation);
  } else if (operation.type === "SET_ITEM_STATUS") {
    applySetItemStatus(userId, operation);
  } else if (operation.type === "DELETE_ITEM") {
    applyDeleteItem(userId, operation);
  } else if (operation.type === "RESTORE_ITEM") {
    applyRestoreItem(userId, operation);
  } else {
    applyFinishPurchase(userId, operation);
  }
}

export function getShoppingSnapshot(userId: string): ShoppingSnapshot {
  const database = getDatabase();
  claimLegacyListsForUser(userId);
  const list = findOrCreateActiveList(userId);
  const itemRows = database
    .prepare(
      `SELECT ${itemColumns}
       FROM shopping_items AS items
       WHERE items.list_id = ? AND items.status != 'DELETED'
       ORDER BY CASE items.status WHEN 'PENDING' THEN 0 ELSE 1 END, items.created_at DESC`,
    )
    .all(list.id) as ItemRow[];

  return { listId: list.sync_id, items: itemRows.map(mapItem) };
}

export function synchronizeShopping(userId: string, rawOperations: unknown): SyncResponse {
  if (!Array.isArray(rawOperations) || !rawOperations.every(syncOperationIsValid)) {
    throw new Error("Las operaciones de sincronización no son válidas.");
  }

  const operations = rawOperations as SyncOperation[];
  const database = getDatabase();
  const synchronize = database.transaction(() => {
    claimLegacyListsForUser(userId);
    const processedOperationIds: string[] = [];
    const receipt = database.prepare(
      "SELECT user_id FROM sync_operation_receipts WHERE operation_id = ?",
    );
    const saveReceipt = database.prepare(
      "INSERT INTO sync_operation_receipts (operation_id, user_id) VALUES (?, ?)",
    );

    for (const operation of operations) {
      const existingReceipt = receipt.get(operation.operationId) as { user_id: string } | undefined;
      if (existingReceipt) {
        if (existingReceipt.user_id !== userId) {
          throw new Error("La operación pertenece a otra cuenta.");
        }
        processedOperationIds.push(operation.operationId);
        continue;
      }

      applyOperation(userId, operation);
      saveReceipt.run(operation.operationId, userId);
      processedOperationIds.push(operation.operationId);
    }

    return { processedOperationIds, snapshot: getShoppingSnapshot(userId) };
  });

  return synchronize();
}

// These helpers keep the existing server-action surface usable for callers outside the PWA.
export function addShoppingItem(userId: string, input: NewShoppingItem) {
  const list = findOrCreateActiveList(userId);
  const item: ShoppingItem = {
    id: randomUUID(),
    name: input.name.trim().replace(/\s+/g, " "),
    category: input.category,
    iconKey: input.iconKey,
    status: "PENDING",
    createdAt: new Date().toISOString(),
    completedAt: null,
  };
  applyCreateItem(userId, {
    type: "CREATE_ITEM",
    operationId: `server:${randomUUID()}`,
    deviceId: "server",
    sequence: 0,
    occurredAt: item.createdAt,
    listId: list.sync_id,
    item,
  });
  return item;
}

export function setShoppingItemCompletion(userId: string, itemId: string, completed: boolean) {
  const item = itemForUser(userId, itemId);
  if (!item || item.status === "DELETED") {
    throw new Error("No encontramos ese producto en la lista activa.");
  }
  const mutationAt = new Date().toISOString();
  applySetItemStatus(userId, {
    type: "SET_ITEM_STATUS",
    operationId: `server:${randomUUID()}`,
    deviceId: "server",
    sequence: 0,
    occurredAt: mutationAt,
    listId: findOrCreateActiveList(userId).sync_id,
    itemId,
    completed,
  });
  const updated = itemForUser(userId, itemId);
  if (!updated || updated.status === "DELETED") {
    throw new Error("No se pudo actualizar el producto.");
  }
  return mapItem(updated);
}

export function deleteShoppingItem(userId: string, itemId: string) {
  const item = itemForUser(userId, itemId);
  if (!item || item.status === "DELETED") {
    throw new Error("No encontramos ese producto en la lista activa.");
  }
  applyDeleteItem(userId, {
    type: "DELETE_ITEM",
    operationId: `server:${randomUUID()}`,
    deviceId: "server",
    sequence: 0,
    occurredAt: new Date().toISOString(),
    listId: findOrCreateActiveList(userId).sync_id,
    itemId,
  });
}

export function restoreShoppingItem(userId: string, itemId: string) {
  const item = itemForUser(userId, itemId);
  if (!item || item.status !== "DELETED") {
    throw new Error("Ese producto ya no se puede recuperar.");
  }
  applyRestoreItem(userId, {
    type: "RESTORE_ITEM",
    operationId: `server:${randomUUID()}`,
    deviceId: "server",
    sequence: 0,
    occurredAt: new Date().toISOString(),
    listId: findOrCreateActiveList(userId).sync_id,
    item: mapItem({ ...item, status: "PENDING" }),
  });
  const restored = itemForUser(userId, itemId);
  if (!restored || restored.status === "DELETED") {
    throw new Error("No se pudo recuperar el producto.");
  }
  return mapItem(restored);
}

export function finishCurrentPurchase(userId: string) {
  const list = findOrCreateActiveList(userId);
  const nextListId = randomUUID();
  applyFinishPurchase(userId, {
    type: "FINISH_PURCHASE",
    operationId: `server:${randomUUID()}`,
    deviceId: "server",
    sequence: 0,
    occurredAt: new Date().toISOString(),
    listId: list.sync_id,
    nextListId,
  });
  return nextListId;
}

export function checkDatabase() {
  getDatabase().prepare("SELECT 1 AS ok").get();
}
