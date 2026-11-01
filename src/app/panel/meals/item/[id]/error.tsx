"use client";

import Link from "next/link";
import { useEffect } from "react";

import { PanelShell } from "@/components/panel/ui";

export default function MealItemRecipeError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Meal recipe page error:", error);
  }, [error]);

  return (
    <PanelShell active="/panel/meals" title="Recipe" hideTitle>
      <div className="space-y-6">
        <Link
          href="/panel/meals"
          className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
        >
          <span aria-hidden>←</span>
          Back to meals
        </Link>
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-5 dark:border-red-900/60 dark:bg-red-950/40">
          <p className="text-sm font-semibold text-red-800 dark:text-red-200">
            Something went wrong loading this recipe
          </p>
          <p className="mt-2 text-sm leading-relaxed text-red-700 dark:text-red-300">
            {error.message || "Please try again."}
          </p>
          <button
            type="button"
            className="mt-4 inline-flex min-h-11 items-center justify-center rounded-lg bg-neutral-900 px-4 text-sm font-medium text-white transition-colors hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-white"
            onClick={reset}
          >
            Try again
          </button>
        </div>
      </div>
    </PanelShell>
  );
}
