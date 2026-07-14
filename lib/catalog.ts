export const SHOPPING_CATEGORIES = [
  "produce",
  "dairy",
  "bakery",
  "butcher",
  "frozen",
  "pantry",
  "beverages",
  "cleaning",
  "personalCare",
  "household",
  "pets",
  "baby",
] as const;

export type ShoppingCategory = (typeof SHOPPING_CATEGORIES)[number];

export const ITEM_ICON_KEYS = [
  "milk",
  "bakery",
  "produce",
  "eggs",
  "coffee",
  "carrot",
  "pantry",
  "cleaning",
  "household",
  "meat",
  "frozen",
  "beverages",
  "personalCare",
  "pets",
  "baby",
  "banana",
  "dishSoap",
  "custom",
] as const;

export type ItemIconKey = (typeof ITEM_ICON_KEYS)[number];

export interface FrequentItem {
  name: string;
  category: ShoppingCategory;
  iconKey: ItemIconKey;
}

export const CATEGORY_LABELS: Record<ShoppingCategory, string> = {
  produce: "Frutas y verduras",
  dairy: "Lácteos",
  bakery: "Panadería",
  butcher: "Carnes y pescados",
  frozen: "Congelados",
  pantry: "Almacén",
  beverages: "Bebidas",
  cleaning: "Limpieza",
  personalCare: "Cuidado personal",
  household: "Hogar",
  pets: "Mascotas",
  baby: "Bebés",
};

export const CATEGORY_DEFAULT_ICON: Record<ShoppingCategory, ItemIconKey> = {
  produce: "produce",
  dairy: "milk",
  bakery: "bakery",
  butcher: "meat",
  frozen: "frozen",
  pantry: "pantry",
  beverages: "beverages",
  cleaning: "cleaning",
  personalCare: "personalCare",
  household: "household",
  pets: "pets",
  baby: "baby",
};

export const FREQUENT_ITEMS: FrequentItem[] = [
  { name: "Leche entera", category: "dairy", iconKey: "milk" },
  { name: "Pan lactal", category: "bakery", iconKey: "bakery" },
  { name: "Huevos (docena)", category: "dairy", iconKey: "eggs" },
  { name: "Bananas", category: "produce", iconKey: "banana" },
  { name: "Zanahorias", category: "produce", iconKey: "carrot" },
  { name: "Café", category: "pantry", iconKey: "coffee" },
  { name: "Arroz largo fino", category: "pantry", iconKey: "pantry" },
  { name: "Detergente para platos", category: "cleaning", iconKey: "dishSoap" },
  { name: "Pechuga de pollo", category: "butcher", iconKey: "meat" },
  { name: "Hamburguesas congeladas", category: "frozen", iconKey: "frozen" },
  { name: "Agua mineral", category: "beverages", iconKey: "beverages" },
  { name: "Shampoo", category: "personalCare", iconKey: "personalCare" },
  { name: "Papel higiénico", category: "household", iconKey: "household" },
  { name: "Yerba mate", category: "pantry", iconKey: "coffee" },
  { name: "Fideos secos", category: "pantry", iconKey: "pantry" },
];

export function isShoppingCategory(value: string): value is ShoppingCategory {
  return (SHOPPING_CATEGORIES as readonly string[]).includes(value);
}

export function isItemIconKey(value: string): value is ItemIconKey {
  return (ITEM_ICON_KEYS as readonly string[]).includes(value);
}
