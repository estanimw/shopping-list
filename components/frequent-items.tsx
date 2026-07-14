"use client";

import { Plus } from "lucide-react";
import { FREQUENT_ITEMS, type FrequentItem } from "@/lib/catalog";
import { IconBadge } from "@/components/icon-badge";

interface FrequentItemsProps {
  disabled?: boolean;
  onPick: (item: FrequentItem) => void;
}

export function FrequentItems({ disabled = false, onPick }: FrequentItemsProps) {
  return (
    <section aria-labelledby="frequent-title" className="frequent-panel">
      <div className="section-heading frequent-panel__heading">
        <div>
          <p className="eyebrow">Atajos</p>
          <h2 id="frequent-title">Lo de siempre</h2>
        </div>
        <span className="section-count">{FREQUENT_ITEMS.length}</span>
      </div>

      <p className="frequent-panel__description">
        Un toque y lo sumamos a tu compra.
        <span className="frequent-panel__scroll-hint"> Deslizá para ver todos.</span>
      </p>

      <div className="frequent-grid" id="frequent-items">
        {FREQUENT_ITEMS.map((item) => (
          <button
            className="frequent-item"
            disabled={disabled}
            key={item.name}
            onClick={() => onPick(item)}
            type="button"
          >
            <IconBadge category={item.category} iconKey={item.iconKey} size="small" />
            <span>{item.name}</span>
            <Plus aria-hidden="true" size={14} strokeWidth={2.4} />
          </button>
        ))}
      </div>
    </section>
  );
}
