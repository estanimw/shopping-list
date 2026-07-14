import type { ItemIconKey, ShoppingCategory } from "@/lib/catalog";

export type ItemStatus = "PENDING" | "COMPLETED";

export interface ShoppingItem {
  /** A client-generated ID that remains stable before and after synchronization. */
  id: string;
  name: string;
  category: ShoppingCategory;
  iconKey: ItemIconKey;
  status: ItemStatus;
  createdAt: string;
  completedAt: string | null;
}

export interface ShoppingSnapshot {
  listId: string;
  items: ShoppingItem[];
}

export interface NewShoppingItem {
  name: string;
  category: ShoppingCategory;
  iconKey: ItemIconKey;
}

export interface ActionResult<T = undefined> {
  ok: boolean;
  data?: T;
  error?: string;
}

interface SyncOperationBase {
  deviceId: string;
  occurredAt: string;
  operationId: string;
  sequence: number;
}

export interface CreateItemOperation extends SyncOperationBase {
  item: ShoppingItem;
  listId: string;
  type: "CREATE_ITEM";
}

export interface SetItemStatusOperation extends SyncOperationBase {
  completed: boolean;
  itemId: string;
  listId: string;
  type: "SET_ITEM_STATUS";
}

export interface DeleteItemOperation extends SyncOperationBase {
  itemId: string;
  listId: string;
  type: "DELETE_ITEM";
}

export interface RestoreItemOperation extends SyncOperationBase {
  item: ShoppingItem;
  listId: string;
  type: "RESTORE_ITEM";
}

export interface FinishPurchaseOperation extends SyncOperationBase {
  listId: string;
  nextListId: string;
  type: "FINISH_PURCHASE";
}

export type SyncOperation =
  | CreateItemOperation
  | SetItemStatusOperation
  | DeleteItemOperation
  | RestoreItemOperation
  | FinishPurchaseOperation;

export interface SyncResponse {
  processedOperationIds: string[];
  snapshot: ShoppingSnapshot;
}
