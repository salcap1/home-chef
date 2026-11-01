"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  addHarrisTeeterProductAction,
  searchHarrisTeeterProductsAction,
} from "@/lib/panel/actions";
import type { ShopProductCandidate } from "@/lib/kroger/shop";

type PickerState =
  | { status: "loading"; name: string }
  | {
      status: "ready";
      name: string;
      quantityText: string | null;
      candidates: ShopProductCandidate[];
    }
  | { status: "error"; name: string; message: string };

const MIN_QTY = 1;
const MAX_QTY = 20;

function clampQty(value: number): number {
  if (!Number.isFinite(value)) return MIN_QTY;
  return Math.max(MIN_QTY, Math.min(MAX_QTY, Math.round(value)));
}

function CandidatePriceLine({
  candidate,
}: {
  candidate: ShopProductCandidate;
}) {
  const meta = [candidate.brand, candidate.packageSize].filter(Boolean);
  const salePrice =
    candidate.onSale && candidate.promoPrice != null
      ? candidate.promoPrice
      : null;
  const displayPrice =
    salePrice ?? candidate.promoPrice ?? candidate.regularPrice;

  return (
    <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-neutral-500">
      {meta.length > 0 ? <span>{meta.join(" · ")}</span> : null}
      {meta.length > 0 && displayPrice != null ? (
        <span aria-hidden>·</span>
      ) : null}
      {displayPrice != null ? (
        <span
          className={
            salePrice != null
              ? "font-medium text-neutral-900 dark:text-neutral-100"
              : undefined
          }
        >
          ${displayPrice.toFixed(2)}
        </span>
      ) : null}
      {salePrice != null ? (
        <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[0.65rem] font-bold uppercase tracking-wide text-amber-950 bg-amber-300 dark:bg-amber-400 dark:text-amber-950">
          Sale
        </span>
      ) : null}
      {salePrice != null && candidate.regularPrice != null ? (
        <span className="text-neutral-400 line-through">
          ${candidate.regularPrice.toFixed(2)}
        </span>
      ) : null}
    </p>
  );
}

export function GroceryShopPicker({
  groceryItemId,
  itemName,
  onClose,
  onAdded,
}: {
  groceryItemId: string;
  itemName: string;
  onClose: () => void;
  onAdded: () => void;
}) {
  const router = useRouter();
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const [state, setState] = useState<PickerState>({
    status: "loading",
    name: itemName,
  });
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [addingUpc, setAddingUpc] = useState<string | null>(null);
  const [addError, setAddError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    startTransition(async () => {
      const result = await searchHarrisTeeterProductsAction(groceryItemId);
      if (cancelled) return;
      if (!result.ok) {
        setState({
          status: "error",
          name: itemName,
          message: result.error,
        });
        return;
      }
      const nextQuantities: Record<string, number> = {};
      for (const candidate of result.candidates) {
        nextQuantities[candidate.upc] = clampQty(candidate.suggestedQuantity);
      }
      setQuantities(nextQuantities);
      setState({
        status: "ready",
        name: result.name,
        quantityText: result.quantityText,
        candidates: result.candidates,
      });
    });
    return () => {
      cancelled = true;
    };
  }, [groceryItemId, itemName]);

  useEffect(() => {
    closeRef.current?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  function setQty(upc: string, value: number) {
    setQuantities((prev) => ({ ...prev, [upc]: clampQty(value) }));
  }

  function pick(candidate: ShopProductCandidate) {
    setAddError(null);
    setAddingUpc(candidate.upc);
    const quantity = clampQty(
      quantities[candidate.upc] ?? candidate.suggestedQuantity,
    );
    startTransition(async () => {
      const result = await addHarrisTeeterProductAction({
        groceryItemId,
        upc: candidate.upc,
        packageSize: candidate.packageSize,
        description: candidate.description,
        brand: candidate.brand,
        quantity,
      });
      if (!result.ok) {
        setAddError(result.error);
        setAddingUpc(null);
        return;
      }
      onAdded();
      router.refresh();
      onClose();
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex max-h-[92vh] w-full max-w-2xl flex-col rounded-t-2xl border border-neutral-200 bg-white shadow-xl dark:border-neutral-800 dark:bg-neutral-900 sm:max-h-[90vh] sm:rounded-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
          <div className="min-w-0">
            <h2 id={titleId} className="truncate text-base font-semibold">
              Shop · {state.name}
            </h2>
            <p className="text-sm text-neutral-500">
              {state.status === "ready" && state.quantityText
                ? `List qty: ${state.quantityText} · set cart packs below`
                : "Pick a product and quantity to add to cart"}
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
          {state.status === "loading" ? (
            <p className="px-2 py-6 text-center text-sm text-neutral-500">
              Searching Harris Teeter…
            </p>
          ) : null}

          {state.status === "error" ? (
            <p className="px-2 py-6 text-center text-sm text-red-700 dark:text-red-300">
              {state.message}
            </p>
          ) : null}

          {state.status === "ready" && state.candidates.length === 0 ? (
            <p className="px-2 py-6 text-center text-sm text-neutral-500">
              No products found. Try editing the item name and search again.
            </p>
          ) : null}

          {state.status === "ready" && state.candidates.length > 0 ? (
            <ul className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {state.candidates.map((candidate) => {
                const pending = addingUpc === candidate.upc;
                const qty =
                  quantities[candidate.upc] ?? candidate.suggestedQuantity;
                return (
                  <li key={candidate.upc} className="px-3 py-4">
                    <div className="flex items-start gap-4">
                      <span className="flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-neutral-100 dark:bg-neutral-800 sm:h-32 sm:w-32">
                        {candidate.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element -- Kroger CDN URLs; no remotePatterns needed
                          <img
                            src={candidate.imageUrl}
                            alt=""
                            width={128}
                            height={128}
                            className="h-full w-full object-contain"
                            loading="lazy"
                          />
                        ) : (
                          <span className="text-xs text-neutral-400">—</span>
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-neutral-900 dark:text-neutral-100">
                          {candidate.description}
                        </p>
                        <CandidatePriceLine candidate={candidate} />
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <div className="inline-flex items-center rounded-md border border-neutral-200 dark:border-neutral-700">
                            <button
                              type="button"
                              disabled={addingUpc !== null || qty <= MIN_QTY}
                              aria-label="Decrease quantity"
                              className="inline-flex h-9 w-9 items-center justify-center text-neutral-600 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40 dark:text-neutral-300 dark:hover:bg-neutral-800"
                              onClick={() => setQty(candidate.upc, qty - 1)}
                            >
                              −
                            </button>
                            <input
                              type="number"
                              inputMode="numeric"
                              min={MIN_QTY}
                              max={MAX_QTY}
                              value={qty}
                              disabled={addingUpc !== null}
                              aria-label={`Quantity for ${candidate.description}`}
                              className="h-9 w-12 border-x border-neutral-200 bg-transparent text-center text-sm tabular-nums outline-none disabled:opacity-60 dark:border-neutral-700"
                              onChange={(event) =>
                                setQty(
                                  candidate.upc,
                                  Number(event.target.value),
                                )
                              }
                            />
                            <button
                              type="button"
                              disabled={addingUpc !== null || qty >= MAX_QTY}
                              aria-label="Increase quantity"
                              className="inline-flex h-9 w-9 items-center justify-center text-neutral-600 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40 dark:text-neutral-300 dark:hover:bg-neutral-800"
                              onClick={() => setQty(candidate.upc, qty + 1)}
                            >
                              +
                            </button>
                          </div>
                          <button
                            type="button"
                            disabled={addingUpc !== null}
                            onClick={() => pick(candidate)}
                            className="inline-flex h-9 items-center rounded-md bg-neutral-900 px-3 text-sm font-medium text-white transition-colors hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-white"
                          >
                            {pending ? "Adding…" : "Add"}
                          </button>
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>

        {addError ? (
          <p className="border-t border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
            {addError}
          </p>
        ) : null}
      </div>
    </div>
  );
}
