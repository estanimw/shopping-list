import type { ItemIconKey, ShoppingCategory } from "@/lib/catalog";

export type ItemStatus = "PENDING" | "COMPLETED";

export interface ShoppingItem {
  id: number;
  name: string;
  category: ShoppingCategory;
  iconKey: ItemIconKey;
  status: ItemStatus;
  createdAt: string;
  completedAt: string | null;
}

export interface ShoppingSnapshot {
  listId: number;
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
