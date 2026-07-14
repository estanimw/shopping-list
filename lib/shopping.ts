import type { ItemIconKey, ShoppingCategory } from "@/lib/catalog";
import { getDatabase } from "@/lib/db";
import type {
  ItemStatus,
  NewShoppingItem,
  ShoppingItem,
  ShoppingSnapshot,
} from "@/lib/types";

interface ListRow {
  id: number;
}

interface ItemRow {
  id: number;
  name: string;
  category: ShoppingCategory;
  icon_key: ItemIconKey;
  status: ItemStatus;
  created_at: string;
  completed_at: string | null;
}

function mapItem(row: ItemRow): ShoppingItem {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    iconKey: row.icon_key,
    status: row.status,
    createdAt: row.created_at,
    completedAt: row.completed_at,
  };
}

function claimLegacyListsForUser(userId: string) {
  const database = getDatabase();
  database
    .prepare("UPDATE shopping_lists SET user_id = ? WHERE user_id IS NULL")
    .run(userId);
}

function findOrCreateActiveListId(userId: string) {
  const database = getDatabase();
  const currentList = database
    .prepare(
      "SELECT id FROM shopping_lists WHERE user_id = ? AND status = 'ACTIVE' LIMIT 1",
    )
    .get(userId) as ListRow | undefined;

  if (currentList) {
    return currentList.id;
  }

  try {
    return Number(
      database
        .prepare("INSERT INTO shopping_lists (user_id, status) VALUES (?, 'ACTIVE')")
        .run(userId).lastInsertRowid,
    );
  } catch {
    const createdByAnotherRequest = database
      .prepare(
        "SELECT id FROM shopping_lists WHERE user_id = ? AND status = 'ACTIVE' LIMIT 1",
      )
      .get(userId) as ListRow | undefined;

    if (!createdByAnotherRequest) {
      throw new Error("No se pudo crear una lista de compras activa.");
    }

    return createdByAnotherRequest.id;
  }
}

function ensureListIsActive(listId: number, userId: string) {
  const database = getDatabase();
  const activeList = database
    .prepare(
      "SELECT id FROM shopping_lists WHERE id = ? AND user_id = ? AND status = 'ACTIVE'",
    )
    .get(listId, userId) as ListRow | undefined;

  if (!activeList) {
    throw new Error("Esta lista ya no está activa.");
  }
}

function getItemInList(itemId: number, listId: number, userId: string) {
  const database = getDatabase();
  return database
    .prepare(
      `SELECT items.id, items.name, items.category, items.icon_key, items.status,
              items.created_at, items.completed_at
       FROM shopping_items AS items
       INNER JOIN shopping_lists AS lists ON lists.id = items.list_id
       WHERE items.id = ? AND items.list_id = ? AND lists.user_id = ?
         AND items.status != 'DELETED'`,
    )
    .get(itemId, listId, userId) as ItemRow | undefined;
}

export function getShoppingSnapshot(userId: string): ShoppingSnapshot {
  const database = getDatabase();
  claimLegacyListsForUser(userId);
  const listId = findOrCreateActiveListId(userId);
  const itemRows = database
    .prepare(
      `SELECT items.id, items.name, items.category, items.icon_key, items.status,
              items.created_at, items.completed_at
       FROM shopping_items AS items
       WHERE items.list_id = ? AND items.status != 'DELETED'
       ORDER BY CASE items.status WHEN 'PENDING' THEN 0 ELSE 1 END, items.created_at DESC`,
    )
    .all(listId) as ItemRow[];

  return {
    listId,
    items: itemRows.map(mapItem),
  };
}

export function addShoppingItem(userId: string, input: NewShoppingItem) {
  const database = getDatabase();
  const listId = findOrCreateActiveListId(userId);
  const result = database
    .prepare(
      `INSERT INTO shopping_items (list_id, name, category, icon_key, status)
       VALUES (?, ?, ?, ?, 'PENDING')`,
    )
    .run(listId, input.name, input.category, input.iconKey);

  const item = getItemInList(Number(result.lastInsertRowid), listId, userId);
  if (!item) {
    throw new Error("No se pudo recuperar el producto creado.");
  }

  return mapItem(item);
}

export function setShoppingItemCompletion(
  userId: string,
  itemId: number,
  completed: boolean,
) {
  const database = getDatabase();
  const listId = findOrCreateActiveListId(userId);
  const result = database
    .prepare(
      `UPDATE shopping_items
       SET status = ?, completed_at = CASE WHEN ? THEN CURRENT_TIMESTAMP ELSE NULL END
       WHERE id = ? AND list_id = ? AND status != 'DELETED'`,
    )
    .run(completed ? "COMPLETED" : "PENDING", completed ? 1 : 0, itemId, listId);

  if (!result.changes) {
    throw new Error("No encontramos ese producto en la lista activa.");
  }

  const item = getItemInList(itemId, listId, userId);
  if (!item) {
    throw new Error("No se pudo actualizar el producto.");
  }

  return mapItem(item);
}

export function deleteShoppingItem(userId: string, itemId: number) {
  const database = getDatabase();
  const listId = findOrCreateActiveListId(userId);
  const result = database
    .prepare(
      `UPDATE shopping_items
       SET status = 'DELETED', deleted_at = CURRENT_TIMESTAMP
       WHERE id = ? AND list_id = ? AND status != 'DELETED'`,
    )
    .run(itemId, listId);

  if (!result.changes) {
    throw new Error("No encontramos ese producto en la lista activa.");
  }
}

export function restoreShoppingItem(userId: string, itemId: number) {
  const database = getDatabase();
  const listId = findOrCreateActiveListId(userId);
  const result = database
    .prepare(
      `UPDATE shopping_items
       SET status = 'PENDING', completed_at = NULL, deleted_at = NULL
       WHERE id = ? AND list_id = ? AND status = 'DELETED'`,
    )
    .run(itemId, listId);

  if (!result.changes) {
    throw new Error("Ese producto ya no se puede recuperar.");
  }

  const item = database
    .prepare(
      `SELECT items.id, items.name, items.category, items.icon_key, items.status,
              items.created_at, items.completed_at
       FROM shopping_items AS items
       INNER JOIN shopping_lists AS lists ON lists.id = items.list_id
       WHERE items.id = ? AND items.list_id = ? AND lists.user_id = ?`,
    )
    .get(itemId, listId, userId) as ItemRow | undefined;

  if (!item) {
    throw new Error("No se pudo recuperar el producto.");
  }

  return mapItem(item);
}

export function finishCurrentPurchase(userId: string) {
  const database = getDatabase();
  const finishPurchase = database.transaction(() => {
    const listId = findOrCreateActiveListId(userId);
    ensureListIsActive(listId, userId);

    database
      .prepare(
        `UPDATE shopping_items
         SET status = 'COMPLETED', completed_at = COALESCE(completed_at, CURRENT_TIMESTAMP)
         WHERE list_id = ? AND status = 'PENDING'`,
      )
      .run(listId);

    database
      .prepare(
        `UPDATE shopping_lists
         SET status = 'FINISHED', finished_at = CURRENT_TIMESTAMP
         WHERE id = ? AND user_id = ?`,
      )
      .run(listId, userId);

    return Number(
      database
        .prepare("INSERT INTO shopping_lists (user_id, status) VALUES (?, 'ACTIVE')")
        .run(userId).lastInsertRowid,
    );
  });

  return finishPurchase();
}

export function checkDatabase() {
  const database = getDatabase();
  database.prepare("SELECT 1 AS ok").get();
}
