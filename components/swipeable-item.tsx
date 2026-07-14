"use client";

import { useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { Check, RotateCcw, Trash2 } from "lucide-react";
import { CATEGORY_LABELS } from "@/lib/catalog";
import type { ShoppingItem } from "@/lib/types";
import { IconBadge } from "@/components/icon-badge";

interface SwipeableItemProps {
  busy?: boolean;
  item: ShoppingItem;
  onComplete: (itemId: string, completed: boolean) => void;
  onDelete: (item: ShoppingItem) => void;
}

interface DragSession {
  pointerId: number;
  startX: number;
  width: number;
}

export function SwipeableItem({
  busy = false,
  item,
  onComplete,
  onDelete,
}: SwipeableItemProps) {
  const rowRef = useRef<HTMLDivElement>(null);
  const dragSession = useRef<DragSession | null>(null);
  const offsetRef = useRef(0);
  const [offset, setOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const direction = offset === 0 ? null : offset > 0 ? "complete" : "delete";
  const progress = Math.min(Math.abs(offset) / 118, 1);
  const itemStyle = {
    transform: `translateX(${offset}px)`,
  } as CSSProperties;
  const swipeStyle = { "--swipe-progress": progress } as CSSProperties;

  function releaseDrag(event: PointerEvent<HTMLDivElement>) {
    const session = dragSession.current;
    if (!session) {
      return;
    }

    dragSession.current = null;
    setIsDragging(false);

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    const actionThreshold = Math.min(110, session.width * 0.31);
    const finalOffset = offsetRef.current;
    const shouldComplete = item.status === "PENDING" && finalOffset >= actionThreshold;
    const shouldDelete = finalOffset <= -actionThreshold;

    offsetRef.current = 0;
    setOffset(0);

    if (shouldComplete) {
      onComplete(item.id, true);
    }

    if (shouldDelete) {
      onDelete(item);
    }
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (busy || (event.pointerType === "mouse" && event.button !== 0)) {
      return;
    }

    const width = rowRef.current?.clientWidth ?? 320;
    dragSession.current = { pointerId: event.pointerId, startX: event.clientX, width };
    offsetRef.current = 0;
    event.currentTarget.setPointerCapture(event.pointerId);
    setIsDragging(true);
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    const session = dragSession.current;
    if (!session || session.pointerId !== event.pointerId) {
      return;
    }

    const rawOffset = event.clientX - session.startX;
    const maxOffset = Math.min(session.width * 0.72, 240);
    const maxRightOffset = item.status === "COMPLETED" ? 0 : maxOffset;
    const nextOffset = Math.max(-maxOffset, Math.min(maxRightOffset, rawOffset));
    offsetRef.current = nextOffset;
    setOffset(nextOffset);
  }

  function stopSwipe(event: PointerEvent<HTMLButtonElement>) {
    event.stopPropagation();
  }

  return (
    <div
      className="swipe-item"
      data-direction={direction ?? "idle"}
      onPointerCancel={releaseDrag}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={releaseDrag}
      ref={rowRef}
      style={swipeStyle}
    >
      <div aria-hidden="true" className="swipe-action swipe-action--complete">
        <Check size={21} strokeWidth={2.8} />
        <span>Completar</span>
      </div>
      <div aria-hidden="true" className="swipe-action swipe-action--delete">
        <span>Eliminar</span>
        <Trash2 size={20} strokeWidth={2.6} />
      </div>

      <article
        aria-label={`${item.name}, ${item.status === "COMPLETED" ? "completado" : "pendiente"}`}
        className={`shopping-item${item.status === "COMPLETED" ? " shopping-item--completed" : ""}${isDragging ? " shopping-item--dragging" : ""}`}
        style={itemStyle}
      >
        <IconBadge category={item.category} iconKey={item.iconKey} />
        <div className="shopping-item__body">
          <p>{item.name}</p>
          <span>{CATEGORY_LABELS[item.category]}</span>
        </div>

        <div className="shopping-item__controls">
          {item.status === "COMPLETED" ? (
            <button
              aria-label={`Volver a dejar ${item.name} como pendiente`}
              className="mini-action mini-action--restore"
              disabled={busy}
              onClick={() => onComplete(item.id, false)}
              onPointerDown={stopSwipe}
              title="Volver a pendientes"
              type="button"
            >
              <RotateCcw size={16} />
            </button>
          ) : (
            <button
              aria-label={`Completar ${item.name}`}
              className="mini-action mini-action--complete"
              disabled={busy}
              onClick={() => onComplete(item.id, true)}
              onPointerDown={stopSwipe}
              title="Completar"
              type="button"
            >
              <Check size={17} />
            </button>
          )}
          <button
            aria-label={`Eliminar ${item.name}`}
            className="mini-action mini-action--delete"
            disabled={busy}
            onClick={() => onDelete(item)}
            onPointerDown={stopSwipe}
            title="Eliminar"
            type="button"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </article>
    </div>
  );
}
