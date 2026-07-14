import {
  Apple,
  Baby,
  Banana,
  Beef,
  Carrot,
  Coffee,
  Croissant,
  CupSoda,
  Dog,
  Egg,
  House,
  Milk,
  Package,
  Plus,
  ShowerHead,
  Snowflake,
  SoapDispenserDroplet,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import type { ItemIconKey, ShoppingCategory } from "@/lib/catalog";

const icons: Record<ItemIconKey, LucideIcon> = {
  milk: Milk,
  bakery: Croissant,
  produce: Apple,
  eggs: Egg,
  coffee: Coffee,
  carrot: Carrot,
  pantry: Package,
  cleaning: Sparkles,
  household: House,
  meat: Beef,
  frozen: Snowflake,
  beverages: CupSoda,
  personalCare: ShowerHead,
  pets: Dog,
  baby: Baby,
  banana: Banana,
  dishSoap: SoapDispenserDroplet,
  custom: Plus,
};

interface IconBadgeProps {
  iconKey: ItemIconKey;
  category: ShoppingCategory;
  size?: "small" | "regular";
}

export function IconBadge({ iconKey, category, size = "regular" }: IconBadgeProps) {
  const Icon = icons[iconKey];

  return (
    <span
      aria-hidden="true"
      className={`item-icon item-icon--${category} item-icon--${size}`}
    >
      <Icon size={size === "small" ? 17 : 21} strokeWidth={2.1} />
    </span>
  );
}
