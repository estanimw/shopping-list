"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, Check, ChevronDown, Sparkles, X } from "lucide-react";
import {
  CATEGORY_DEFAULT_ICON,
  CATEGORY_LABELS,
  SHOPPING_CATEGORIES,
  type ShoppingCategory,
} from "@/lib/catalog";
import type { NewShoppingItem } from "@/lib/types";
import { IconBadge } from "@/components/icon-badge";

interface AddItemDialogProps {
  isOpen: boolean;
  isSubmitting: boolean;
  onAdd: (item: NewShoppingItem) => Promise<boolean>;
  onClose: () => void;
}

export function AddItemDialog({
  isOpen,
  isSubmitting,
  onAdd,
  onClose,
}: AddItemDialogProps) {
  const dialogRef = useRef<HTMLElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const categoryTriggerRef = useRef<HTMLButtonElement>(null);
  const isSubmittingRef = useRef(isSubmitting);
  const isCategoryPickerOpenRef = useRef(false);
  const previouslyFocusedElementRef = useRef<HTMLElement | null>(null);
  const [name, setName] = useState("");
  const [category, setCategory] = useState<ShoppingCategory>("pantry");
  const [error, setError] = useState("");
  const [isCategoryPickerOpen, setIsCategoryPickerOpen] = useState(false);

  const closeDialog = useCallback(() => {
    isCategoryPickerOpenRef.current = false;
    setIsCategoryPickerOpen(false);
    onClose();
  }, [onClose]);

  useEffect(() => {
    isSubmittingRef.current = isSubmitting;
  }, [isSubmitting]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    previouslyFocusedElementRef.current = document.activeElement as HTMLElement | null;
    const appContent = document.querySelector(".shopping-app__content") as HTMLElement | null;
    const previousBodyOverflow = document.body.style.overflow;
    const previousInertState = appContent?.inert;
    document.body.style.overflow = "hidden";
    if (appContent) {
      appContent.inert = true;
    }

    const focusTimer = window.setTimeout(() => inputRef.current?.focus(), 80);
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isSubmittingRef.current) {
        if (isCategoryPickerOpenRef.current) {
          isCategoryPickerOpenRef.current = false;
          setIsCategoryPickerOpen(false);
          categoryTriggerRef.current?.focus();
          return;
        }

        closeDialog();
      }
    };
    const handleFocusTrap = (event: KeyboardEvent) => {
      if (event.key !== "Tab" || !dialogRef.current) {
        return;
      }

      const focusableElements = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          "button:not([disabled]), input:not([disabled]), select:not([disabled]), [href], [tabindex]:not([tabindex='-1'])",
        ),
      ).filter((element) => !element.hasAttribute("hidden"));

      const firstElement = focusableElements[0];
      const lastElement = focusableElements.at(-1);
      if (!firstElement || !lastElement) {
        return;
      }

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    window.addEventListener("keydown", handleEscape);
    window.addEventListener("keydown", handleFocusTrap);
    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener("keydown", handleEscape);
      window.removeEventListener("keydown", handleFocusTrap);
      document.body.style.overflow = previousBodyOverflow;
      if (appContent) {
        appContent.inert = previousInertState ?? false;
      }
      previouslyFocusedElementRef.current?.focus();
    };
  }, [closeDialog, isOpen]);

  if (!isOpen) {
    return null;
  }

  const iconKey = CATEGORY_DEFAULT_ICON[category];

  function toggleCategoryPicker() {
    const nextIsOpen = !isCategoryPickerOpenRef.current;
    isCategoryPickerOpenRef.current = nextIsOpen;
    setIsCategoryPickerOpen(nextIsOpen);
  }

  function pickCategory(nextCategory: ShoppingCategory) {
    setCategory(nextCategory);
    isCategoryPickerOpenRef.current = false;
    setIsCategoryPickerOpen(false);
    window.requestAnimationFrame(() => categoryTriggerRef.current?.focus());
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    let added = false;
    try {
      added = await onAdd({
        name,
        category,
        iconKey,
      });
    } catch {
      setError("No pudimos guardar ese producto. Intentá otra vez.");
      return;
    }

    if (!added) {
      setError("No pudimos guardar ese producto. Revisá el nombre e intentá otra vez.");
      return;
    }

    setName("");
    setCategory("pantry");
    closeDialog();
  }

  return (
    <div
      aria-describedby="add-item-description"
      aria-labelledby="add-item-title"
      aria-modal="true"
      className="dialog-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isSubmitting) {
          closeDialog();
        }
      }}
      role="dialog"
    >
      <section className="add-dialog" ref={dialogRef}>
        <div className="add-dialog__topline">
          <span className="add-dialog__eyebrow">
            <Sparkles aria-hidden="true" size={15} /> Nuevo en la lista
          </span>
          <button
            aria-label="Cerrar"
            className="icon-button"
            disabled={isSubmitting}
            onClick={closeDialog}
            type="button"
          >
            <X size={19} />
          </button>
        </div>

        <h2 id="add-item-title">¿Qué hace falta?</h2>
        <p className="add-dialog__copy" id="add-item-description">
          Elegí una categoría para que sea fácil de reconocer mientras comprás.
        </p>

        <form className="add-item-form" onSubmit={handleSubmit}>
          <label className="field-label" htmlFor="item-name">
            Producto
          </label>
          <input
            autoComplete="off"
            disabled={isSubmitting}
            id="item-name"
            maxLength={60}
            onChange={(event) => setName(event.target.value)}
            placeholder="Por ejemplo, tomates"
            ref={inputRef}
            required
            value={name}
          />

          <span className="field-label" id="item-category-label">
            Categoría
          </span>
          <div className="category-selector">
            <div className="category-picker">
              <IconBadge category={category} iconKey={iconKey} size="small" />
              <button
                aria-controls="category-options"
                aria-expanded={isCategoryPickerOpen}
                aria-label={`Categoría: ${CATEGORY_LABELS[category]}`}
                className="category-picker__trigger"
                disabled={isSubmitting}
                onClick={toggleCategoryPicker}
                ref={categoryTriggerRef}
                type="button"
              >
                <span>{CATEGORY_LABELS[category]}</span>
                <ChevronDown
                  aria-hidden="true"
                  className={isCategoryPickerOpen ? "category-picker__chevron category-picker__chevron--open" : "category-picker__chevron"}
                  size={17}
                />
              </button>
            </div>

            {isCategoryPickerOpen ? (
              <div
                aria-label="Categorías disponibles"
                className="category-options"
                id="category-options"
                role="group"
              >
                {SHOPPING_CATEGORIES.map((categoryOption) => {
                  const isSelected = categoryOption === category;

                  return (
                    <button
                      aria-pressed={isSelected}
                      className={
                        isSelected
                          ? "category-option category-option--selected"
                          : "category-option"
                      }
                      disabled={isSubmitting}
                      key={categoryOption}
                      onClick={() => pickCategory(categoryOption)}
                      type="button"
                    >
                      <IconBadge
                        category={categoryOption}
                        iconKey={CATEGORY_DEFAULT_ICON[categoryOption]}
                        size="small"
                      />
                      <span>{CATEGORY_LABELS[categoryOption]}</span>
                      {isSelected ? <Check aria-hidden="true" size={15} strokeWidth={2.6} /> : null}
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>

          {error ? <p className="form-error" role="alert">{error}</p> : null}

          <button className="dialog-submit" disabled={isSubmitting} type="submit">
            <span>{isSubmitting ? "Agregando…" : "Sumar a la compra"}</span>
            <ArrowRight aria-hidden="true" size={18} />
          </button>
        </form>
      </section>
    </div>
  );
}
