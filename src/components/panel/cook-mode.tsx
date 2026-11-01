"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

import type { InstructionStep } from "@/lib/panel/recipe-format";

type CookModeViewProps = {
  recipeName: string;
  steps: InstructionStep[];
  onExit: () => void;
};

const emptySubscribe = () => () => {};

/**
 * Full-viewport cook experience (not a modal over the panel).
 * Portaled to document.body so PanelShell overflow / bottom nav cannot clip it.
 * Layout: sticky header · independently scrollable step · sticky controls.
 */
export function CookModeView({ recipeName, steps, onExit }: CookModeViewProps) {
  const [index, setIndex] = useState(0);
  const [wakeSupported, setWakeSupported] = useState(true);
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const step = steps[index];
  const isFirst = index === 0;
  const isLast = index >= steps.length - 1;

  const goPrev = useCallback(() => {
    setIndex((value) => Math.max(value - 1, 0));
  }, []);

  const goNext = useCallback(() => {
    setIndex((value) => Math.min(value + 1, steps.length - 1));
  }, [steps.length]);

  const requestWakeLock = useCallback(async () => {
    try {
      if (!("wakeLock" in navigator)) {
        setWakeSupported(false);
        return null;
      }
      return await navigator.wakeLock.request("screen");
    } catch {
      setWakeSupported(false);
      return null;
    }
  }, []);

  // Own the viewport: lock body scroll, request wake lock
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    let lock: WakeLockSentinel | null = null;
    let cancelled = false;

    void (async () => {
      lock = await requestWakeLock();
      if (cancelled && lock) {
        await lock.release().catch(() => undefined);
      }
    })();

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void (async () => {
          lock = await requestWakeLock();
        })();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("visibilitychange", onVisibility);
      void lock?.release().catch(() => undefined);
    };
  }, [requestWakeLock]);

  // Reset scroll when the step changes
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = 0;
  }, [index]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onExit();
      if (event.key === "ArrowRight" || event.key === " ") {
        event.preventDefault();
        goNext();
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        goPrev();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goNext, goPrev, onExit]);

  if (!step || !mounted) return null;

  return createPortal(
    <div
      className="fixed inset-x-0 top-0 z-[200] flex flex-col overflow-hidden bg-neutral-950 text-neutral-50"
      style={{
        /* Height tracks the visible viewport; keep top pinned at 0. */
        height:
          "var(--app-height, calc(100dvh + env(safe-area-inset-bottom, 0px)))",
      }}
      role="dialog"
      aria-modal="true"
      aria-label={`Cook mode: ${recipeName}`}
    >
      <header className="shrink-0 border-b border-white/10 bg-neutral-950 px-4 pt-[max(0.75rem,env(safe-area-inset-top,0px))] pb-3">
        <div className="mx-auto flex max-w-2xl items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-neutral-200">
              {recipeName}
            </p>
            <p className="mt-0.5 text-xs text-neutral-500">
              Step {index + 1} of {steps.length}
              {wakeSupported ? " · Screen stays on" : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={onExit}
            className="min-h-11 shrink-0 rounded-lg px-3 text-sm font-medium text-neutral-300 transition-colors hover:bg-white/10 hover:text-white"
          >
            Recipe
          </button>
        </div>
        <div className="mx-auto mt-3 max-w-2xl">
          <div className="h-1 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-white transition-all duration-300"
              style={{ width: `${((index + 1) / steps.length) * 100}%` }}
            />
          </div>
        </div>
      </header>

      <div
        ref={scrollRef}
        className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]"
      >
        <div className="mx-auto max-w-2xl px-4 py-8">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">
            Step {step.number}
          </p>
          <p className="text-balance text-xl font-medium leading-snug sm:text-3xl">
            {step.text}
          </p>

          {step.ingredients.length > 0 ? (
            <ul className="mt-8 space-y-2">
              <li className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500">
                This step
              </li>
              {step.ingredients.map((ingredient, i) => (
                <li
                  key={`${ingredient.name}-${i}`}
                  className="rounded-xl bg-white/5 px-4 py-3.5"
                >
                  <p className="text-base font-medium leading-snug sm:text-lg">
                    {ingredient.name}
                  </p>
                  {ingredient.quantity ? (
                    <p className="mt-1 text-sm tabular-nums text-neutral-400">
                      {ingredient.quantity}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>

      <footer
        className="shrink-0 border-t border-white/10 bg-neutral-950 px-4 pt-3"
        style={{
          paddingBottom:
            "max(0.75rem, var(--safe-area-bottom, env(safe-area-inset-bottom, 0px)))",
        }}
      >
        <div className="mx-auto grid max-w-2xl grid-cols-2 gap-3">
          <button
            type="button"
            disabled={isFirst}
            onClick={goPrev}
            className="min-h-14 rounded-xl border border-white/15 text-base font-medium transition-colors hover:bg-white/10 active:bg-white/15 disabled:cursor-not-allowed disabled:opacity-30"
          >
            Previous
          </button>
          {isLast ? (
            <button
              type="button"
              onClick={onExit}
              className="min-h-14 rounded-xl bg-white text-base font-medium text-neutral-950 transition-colors hover:bg-neutral-200 active:bg-neutral-300"
            >
              Finish
            </button>
          ) : (
            <button
              type="button"
              onClick={goNext}
              className="min-h-14 rounded-xl bg-white text-base font-medium text-neutral-950 transition-colors hover:bg-neutral-200 active:bg-neutral-300"
            >
              Next
            </button>
          )}
        </div>
      </footer>
    </div>,
    document.body,
  );
}
