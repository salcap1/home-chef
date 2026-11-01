"use client";

import { useState, useTransition } from "react";

import { createHarrisTeeterLinkAction } from "@/lib/panel/actions";

type HarrisTeeterStatus =
  | { linked: true; locationName: string | null }
  | { linked: false };

export function GroceryExtrasClient({
  harrisTeeter,
}: {
  harrisTeeter: HarrisTeeterStatus;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function linkAccount() {
    setError(null);
    startTransition(async () => {
      const result = await createHarrisTeeterLinkAction();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      window.location.href = result.url;
    });
  }

  return (
    <div className="mb-4 space-y-3">
      <div className="rounded-xl border border-neutral-200 bg-white p-3 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-semibold">Harris Teeter</p>
            <p className="text-sm text-neutral-500">
              {harrisTeeter.linked
                ? `Linked${harrisTeeter.locationName ? ` · ${harrisTeeter.locationName}` : ""} · use Shop on each Grocery item`
                : "Not linked — connect once, then Shop each Grocery item to add to cart."}
            </p>
          </div>
          {!harrisTeeter.linked ? (
            <button
              type="button"
              disabled={pending}
              onClick={linkAccount}
              className="inline-flex min-h-10 cursor-pointer items-center rounded-lg border border-neutral-300 bg-white px-3 text-sm font-medium transition-colors hover:border-neutral-400 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-950 dark:hover:border-neutral-600 dark:hover:bg-neutral-900"
            >
              {pending ? "Opening…" : "Link account"}
            </button>
          ) : null}
        </div>
      </div>

      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </p>
      ) : null}
    </div>
  );
}
