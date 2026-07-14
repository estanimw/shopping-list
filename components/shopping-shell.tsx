"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Check,
  ChevronDown,
  ChevronUp,
  CircleCheckBig,
  ListChecks,
  LogOut,
  PartyPopper,
  Plus,
  ShoppingBasket,
  Sparkles,
  Undo2,
  UserRound,
  X,
} from "lucide-react";
import {
  addItemAction,
  deleteItemAction,
  finishPurchaseAction,
  restoreItemAction,
  setItemCompletionAction,
} from "@/app/actions";
import { AddItemDialog } from "@/components/add-item-dialog";
import { FrequentItems } from "@/components/frequent-items";
import { SwipeableItem } from "@/components/swipeable-item";
import { authClient } from "@/lib/auth-client";
import type { FrequentItem } from "@/lib/catalog";
import type { NewShoppingItem, ShoppingItem } from "@/lib/types";

interface ShoppingShellProps {
  initialItems: ShoppingItem[];
  userName: string;
}

interface Toast {
  message: string;
  undoItem?: ShoppingItem;
}

export function ShoppingShell({ initialItems, userName }: ShoppingShellProps) {
  const [items, setItems] = useState(initialItems);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);
  const [isFinishConfirmationOpen, setIsFinishConfirmationOpen] = useState(false);
  const [isCompletedOpen, setIsCompletedOpen] = useState(true);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [mutatingItemIds, setMutatingItemIds] = useState<number[]>([]);
  const [toast, setToast] = useState<Toast | null>(null);
  const toastTimeoutRef = useRef<number | null>(null);

  const pendingItems = items.filter((item) => item.status === "PENDING");
  const completedItems = items.filter((item) => item.status === "COMPLETED");
  const totalItems = items.length;
  const hasItemsToFinish = totalItems > 0;
  const isReadyToClose = hasItemsToFinish && pendingItems.length === 0;
  const completedPercent = totalItems
    ? Math.round((completedItems.length / totalItems) * 100)
    : 0;
  const isListBusy = isAdding || isFinishing || mutatingItemIds.length > 0;
  const closeAddDialog = useCallback(() => setIsAddOpen(false), []);

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) {
        window.clearTimeout(toastTimeoutRef.current);
      }
    };
  }, []);

  function showToast(message: string, undoItem?: ShoppingItem) {
    if (toastTimeoutRef.current) {
      window.clearTimeout(toastTimeoutRef.current);
    }

    setToast({ message, undoItem });
    toastTimeoutRef.current = window.setTimeout(
      () => setToast(null),
      undoItem ? 5600 : 3600,
    );
  }

  function markItemAsMutating(itemId: number, isMutating: boolean) {
    setMutatingItemIds((currentIds) =>
      isMutating
        ? currentIds.includes(itemId)
          ? currentIds
          : [...currentIds, itemId]
        : currentIds.filter((currentId) => currentId !== itemId),
    );
  }

  async function createItem(input: NewShoppingItem, shouldAnnounce = true) {
    if (isFinishing) {
      showToast("Estamos terminando esta compra. Esperá un instante.");
      return false;
    }

    setIsAdding(true);

    try {
      const result = await addItemAction(input);

      if (!result.ok || !result.data) {
        showToast(result.error ?? "No pudimos sumar ese producto.");
        return false;
      }

      setItems((currentItems) => [result.data!, ...currentItems]);

      if (shouldAnnounce) {
        showToast(`${result.data.name} ya está en tu lista.`);
      }

      return true;
    } catch {
      showToast("No pudimos conectar para sumar ese producto. Probá de nuevo.");
      return false;
    } finally {
      setIsAdding(false);
    }
  }

  function handleFrequentPick(item: FrequentItem) {
    if (isListBusy) {
      return;
    }

    void createItem(item);
  }

  function handleCompletion(itemId: number, completed: boolean) {
    const originalItem = items.find((item) => item.id === itemId);
    if (!originalItem || isFinishing || mutatingItemIds.includes(itemId)) {
      return;
    }

    markItemAsMutating(itemId, true);
    setItems((currentItems) =>
      currentItems.map((item) =>
        item.id === itemId
          ? {
              ...item,
              status: completed ? "COMPLETED" : "PENDING",
              completedAt: completed ? new Date().toISOString() : null,
            }
          : item,
      ),
    );

    void (async () => {
      try {
        const result = await setItemCompletionAction(itemId, completed);

        if (!result.ok || !result.data) {
          setItems((currentItems) =>
            currentItems.map((item) => (item.id === itemId ? originalItem : item)),
          );
          showToast(result.error ?? "No pudimos actualizar ese producto.");
          return;
        }

        setItems((currentItems) =>
          currentItems.map((item) => (item.id === itemId ? result.data! : item)),
        );
      } catch {
        setItems((currentItems) =>
          currentItems.map((item) => (item.id === itemId ? originalItem : item)),
        );
        showToast("No pudimos conectar para actualizar ese producto.");
      } finally {
        markItemAsMutating(itemId, false);
      }
    })();
  }

  function handleDelete(item: ShoppingItem) {
    if (isFinishing || mutatingItemIds.includes(item.id)) {
      return;
    }

    markItemAsMutating(item.id, true);
    setItems((currentItems) => currentItems.filter((currentItem) => currentItem.id !== item.id));

    void (async () => {
      try {
        const result = await deleteItemAction(item.id);

        if (!result.ok) {
          setItems((currentItems) => [item, ...currentItems]);
          showToast(result.error ?? "No pudimos eliminar ese producto.");
          return;
        }

        showToast(`${item.name} se eliminó de la lista.`, item);
      } catch {
        setItems((currentItems) => [item, ...currentItems]);
        showToast("No pudimos conectar para eliminar ese producto.");
      } finally {
        markItemAsMutating(item.id, false);
      }
    })();
  }

  function handleUndoDelete() {
    const itemToRestore = toast?.undoItem;
    if (!itemToRestore) {
      return;
    }

    if (toastTimeoutRef.current) {
      window.clearTimeout(toastTimeoutRef.current);
    }
    setToast(null);
    markItemAsMutating(itemToRestore.id, true);

    void (async () => {
      try {
        const result = await restoreItemAction(itemToRestore.id);

        if (!result.ok || !result.data) {
          showToast(result.error ?? "No pudimos recuperar ese producto.");
          return;
        }

        setItems((currentItems) => [result.data!, ...currentItems]);
        showToast(`${result.data.name} volvió a pendientes.`);
      } catch {
        showToast("No pudimos conectar para recuperar ese producto.");
      } finally {
        markItemAsMutating(itemToRestore.id, false);
      }
    })();
  }

  function handleFinishPurchase() {
    if (!hasItemsToFinish || isListBusy) {
      if (mutatingItemIds.length || isAdding) {
        showToast("Esperá a que termine la acción en curso antes de finalizar.");
      }
      return;
    }

    setIsFinishing(true);
    setIsAddOpen(false);

    void (async () => {
      try {
        const result = await finishPurchaseAction();

        if (!result.ok || !result.data) {
          showToast(result.error ?? "No pudimos finalizar la compra.");
          return;
        }

        setItems([]);
        setIsFinishConfirmationOpen(false);
        setIsCompletedOpen(false);
        showToast("¡Compra cerrada! Dejamos una lista nueva para la próxima vez.");
      } catch {
        showToast("No pudimos conectar para finalizar la compra.");
      } finally {
        setIsFinishing(false);
      }
    })();
  }

  async function handleSignOut() {
    setIsSigningOut(true);

    try {
      await authClient.signOut();
      window.location.assign("/sign-in");
    } catch {
      setIsSigningOut(false);
      showToast("No pudimos cerrar tu sesión. Probá de nuevo.");
    }
  }

  const firstName = userName.trim().split(/\s+/)[0] || "ahí";

  return (
    <main className="shopping-app">
      <div aria-hidden="true" className="ambient ambient--one" />
      <div aria-hidden="true" className="ambient ambient--two" />
      <div aria-hidden="true" className="ambient ambient--three" />

      <div className="shopping-app__content">
        <header className="app-header">
          <div className="app-header__copy">
            <div className="app-header__topline">
              <span className="welcome-line">
                <Sparkles aria-hidden="true" size={15} /> Hola, {firstName}
              </span>
              <button
                aria-label="Cerrar sesión"
                className="account-button"
                disabled={isSigningOut}
                onClick={handleSignOut}
                type="button"
              >
                <UserRound aria-hidden="true" size={16} />
                <span className="account-button__name">{userName}</span>
                <LogOut aria-hidden="true" size={15} />
                <span className="account-button__label">
                  {isSigningOut ? "Saliendo…" : "Salir"}
                </span>
              </button>
            </div>
            <h1>Hagamos que comprar sea más liviano.</h1>
            <p>Sumá lo que falta y deslizá cada producto cuando ya esté listo.</p>
          </div>

          <div
            aria-label="Progreso de la compra"
            aria-valuemax={100}
            aria-valuemin={0}
            aria-valuenow={completedPercent}
            aria-valuetext={
              totalItems
                ? `${completedItems.length} de ${totalItems} productos listos`
                : "Todavía no hay productos en la lista"
            }
            className="progress-card"
            role="progressbar"
          >
            <div className="progress-card__topline">
              <span>Tu avance</span>
              <strong>{totalItems ? `${completedPercent}%` : "Todo listo"}</strong>
            </div>
            <div className="progress-track">
              <span style={{ width: `${completedPercent}%` }} />
            </div>
            <p>
              {totalItems
                ? `${completedItems.length} de ${totalItems} productos listos`
                : "Tu lista está libre para empezar"}
            </p>
          </div>
        </header>

        <div className="shopping-layout">
          <section className="shopping-column" aria-labelledby="pending-title">
            <button
              className="add-item-card"
              disabled={isFinishing}
              onClick={() => setIsAddOpen(true)}
              type="button"
            >
              <span className="add-item-card__icon">
                <Plus size={23} strokeWidth={2.45} />
              </span>
              <span className="add-item-card__copy">
                <strong>Sumar algo a la compra</strong>
                <span>Agregá un producto con su propia categoría.</span>
              </span>
              <ArrowRight aria-hidden="true" className="add-item-card__arrow" size={20} />
            </button>

            <section className="shopping-list">
              <div className="section-heading shopping-list__heading">
                <div>
                  <p className="eyebrow">Tu lista</p>
                  <h2 id="pending-title">Para comprar</h2>
                </div>
                <span className="section-count">{pendingItems.length}</span>
              </div>

              {pendingItems.length ? (
                <p className="swipe-hint">
                  <span aria-hidden="true" className="swipe-hint__check">
                    <Check size={13} />
                  </span>
                  Deslizá a la derecha para completar o a la izquierda para eliminar.
                </p>
              ) : (
                <div className="empty-state">
                  <span className="empty-state__icon">
                    <ShoppingBasket aria-hidden="true" size={28} />
                  </span>
                  <div>
                    <h3>{completedItems.length ? "¡Vas excelente!" : "¿Empezamos?"}</h3>
                    <p>
                      {completedItems.length
                        ? "No queda nada pendiente en tu compra."
                        : "Elegí algo de tus frecuentes o agregá un producto nuevo."}
                    </p>
                  </div>
                </div>
              )}

              <div className="item-stack">
                {pendingItems.map((item) => (
                  <SwipeableItem
                    busy={isFinishing || mutatingItemIds.includes(item.id)}
                    item={item}
                    key={item.id}
                    onComplete={handleCompletion}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            </section>

            {completedItems.length ? (
              <section className="completed-section" aria-labelledby="completed-title">
                <button
                  aria-controls="completed-items"
                  aria-expanded={isCompletedOpen}
                  className="completed-toggle"
                  onClick={() => setIsCompletedOpen((isOpen) => !isOpen)}
                  type="button"
                >
                  <span className="completed-toggle__left">
                    <CircleCheckBig aria-hidden="true" size={19} />
                    <span id="completed-title">Completados ({completedItems.length})</span>
                  </span>
                  {isCompletedOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </button>

                <div className="item-stack item-stack--completed" hidden={!isCompletedOpen} id="completed-items">
                    {completedItems.map((item) => (
                      <SwipeableItem
                        busy={isFinishing || mutatingItemIds.includes(item.id)}
                        item={item}
                        key={item.id}
                        onComplete={handleCompletion}
                        onDelete={handleDelete}
                      />
                    ))}
                </div>
              </section>
            ) : null}
          </section>

          <aside className="frequent-column">
            <FrequentItems disabled={isListBusy} onPick={handleFrequentPick} />
          </aside>
        </div>

        <section className="finish-card" aria-label="Cerrar compra">
          {isFinishConfirmationOpen ? (
            <div className="finish-confirmation">
              <div>
                <span className="finish-card__icon finish-card__icon--warm">
                  <PartyPopper aria-hidden="true" size={21} />
                </span>
                <div>
                  <strong>{isReadyToClose ? "¿Querés cerrar esta compra?" : "¿Terminaste la compra?"}</strong>
                  <p>
                    {isReadyToClose
                      ? `Guardaremos estos ${completedItems.length} productos como completados y prepararemos una lista nueva.`
                      : `Marcaremos los ${pendingItems.length} pendientes y prepararemos una lista nueva.`}
                  </p>
                </div>
              </div>
              <div className="finish-confirmation__actions">
                <button
                  className="button-quiet"
                  disabled={isFinishing}
                  onClick={() => setIsFinishConfirmationOpen(false)}
                  type="button"
                >
                  Ahora no
                </button>
                <button
                  className="button-primary"
                  disabled={isListBusy}
                  onClick={handleFinishPurchase}
                  type="button"
                >
                  {isFinishing ? "Finalizando…" : "Sí, finalizar"}
                </button>
              </div>
            </div>
          ) : (
            <div className="finish-card__default">
              <div className="finish-card__intro">
                <span className="finish-card__icon">
                  <ListChecks aria-hidden="true" size={21} />
                </span>
                <div>
                  <strong>{isReadyToClose ? "¡Todo comprado!" : "¿La compra ya está hecha?"}</strong>
                  <p>
                    {pendingItems.length
                      ? `Terminá los ${pendingItems.length} pendientes de una vez.`
                      : completedItems.length
                        ? "Cerrá esta compra cuando quieras empezar una lista nueva."
                        : "Agregá productos para empezar una compra."}
                  </p>
                </div>
              </div>
              <button
                className="finish-button"
                disabled={!hasItemsToFinish || isListBusy}
                onClick={() => setIsFinishConfirmationOpen(true)}
                type="button"
              >
                <span>{isReadyToClose ? "Cerrar compra y crear lista nueva" : "Finalizar compra"}</span>
                <ArrowRight aria-hidden="true" size={17} />
              </button>
            </div>
          )}
        </section>
      </div>

      <AddItemDialog
        isOpen={isAddOpen}
        isSubmitting={isAdding || isFinishing}
        onAdd={(item) => createItem(item, false)}
        onClose={closeAddDialog}
      />

      {toast ? (
        <div aria-live="polite" className="toast" role="status">
          <span>{toast.message}</span>
          {toast.undoItem ? (
            <button onClick={handleUndoDelete} type="button">
              <Undo2 aria-hidden="true" size={15} /> Deshacer
            </button>
          ) : (
            <button aria-label="Cerrar aviso" className="toast__close" onClick={() => setToast(null)} type="button">
              <X size={16} />
            </button>
          )}
        </div>
      ) : null}
    </main>
  );
}
