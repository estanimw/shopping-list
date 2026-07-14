"use server";

import { revalidatePath } from "next/cache";
import { isItemIconKey, isShoppingCategory } from "@/lib/catalog";
import {
  addShoppingItem,
  deleteShoppingItem,
  finishCurrentPurchase,
  restoreShoppingItem,
  setShoppingItemCompletion,
} from "@/lib/shopping";
import { getCurrentUser } from "@/lib/current-user";
import type { ActionResult, NewShoppingItem, ShoppingItem } from "@/lib/types";

function validItemId(itemId: string) {
  return typeof itemId === "string" && itemId.length > 0;
}

function validateNewItem(input: {
  name: string;
  category: string;
  iconKey: string;
}): NewShoppingItem | null {
  const name = input.name?.trim().replace(/\s+/g, " ");

  if (!name || name.length > 60) {
    return null;
  }

  if (!isShoppingCategory(input.category) || !isItemIconKey(input.iconKey)) {
    return null;
  }

  return { name, category: input.category, iconKey: input.iconKey };
}

export async function addItemAction(
  input: {
    name: string;
    category: string;
    iconKey: string;
  },
): Promise<ActionResult<ShoppingItem>> {
  const user = await getCurrentUser();
  if (!user) {
    return { ok: false, error: "Tu sesión venció. Volvé a ingresar para continuar." };
  }

  const item = validateNewItem(input);
  if (!item) {
    return { ok: false, error: "Revisá el nombre y la categoría del producto." };
  }

  try {
    const createdItem = addShoppingItem(user.id, item);
    revalidatePath("/");
    return { ok: true, data: createdItem };
  } catch {
    return { ok: false, error: "No pudimos guardar ese producto. Probá de nuevo." };
  }
}

export async function setItemCompletionAction(
  itemId: string,
  completed: boolean,
): Promise<ActionResult<ShoppingItem>> {
  const user = await getCurrentUser();
  if (!user) {
    return { ok: false, error: "Tu sesión venció. Volvé a ingresar para continuar." };
  }

  if (!validItemId(itemId)) {
    return { ok: false, error: "El producto ya no está disponible." };
  }

  try {
    const updatedItem = setShoppingItemCompletion(user.id, itemId, completed);
    revalidatePath("/");
    return { ok: true, data: updatedItem };
  } catch {
    return { ok: false, error: "No pudimos actualizar ese producto." };
  }
}

export async function deleteItemAction(
  itemId: string,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) {
    return { ok: false, error: "Tu sesión venció. Volvé a ingresar para continuar." };
  }

  if (!validItemId(itemId)) {
    return { ok: false, error: "El producto ya no está disponible." };
  }

  try {
    deleteShoppingItem(user.id, itemId);
    revalidatePath("/");
    return { ok: true };
  } catch {
    return { ok: false, error: "No pudimos eliminar ese producto." };
  }
}

export async function restoreItemAction(
  itemId: string,
): Promise<ActionResult<ShoppingItem>> {
  const user = await getCurrentUser();
  if (!user) {
    return { ok: false, error: "Tu sesión venció. Volvé a ingresar para continuar." };
  }

  if (!validItemId(itemId)) {
    return { ok: false, error: "El producto ya no está disponible." };
  }

  try {
    const restoredItem = restoreShoppingItem(user.id, itemId);
    revalidatePath("/");
    return { ok: true, data: restoredItem };
  } catch {
    return { ok: false, error: "No pudimos recuperar ese producto." };
  }
}

export async function finishPurchaseAction(): Promise<ActionResult<string>> {
  const user = await getCurrentUser();
  if (!user) {
    return { ok: false, error: "Tu sesión venció. Volvé a ingresar para continuar." };
  }

  try {
    const nextListId = finishCurrentPurchase(user.id);
    revalidatePath("/");
    return { ok: true, data: nextListId };
  } catch {
    return { ok: false, error: "No pudimos finalizar la compra. Probá de nuevo." };
  }
}
