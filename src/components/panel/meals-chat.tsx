"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { panelChefChatAction } from "@/lib/panel/actions";

export function MealsChat() {
  const router = useRouter();
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function send(text: string) {
    const message = text.trim();
    if (!message || pending) return;

    setDraft("");
    setError(null);

    startTransition(async () => {
      const result = await panelChefChatAction({ message });
      if (!result.ok) {
        setDraft(message);
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <section className="mt-6 rounded-xl border border-neutral-200 bg-white p-3 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
      <p className="text-sm font-semibold tracking-tight">Tell the chef</p>
      <p className="mt-0.5 text-xs text-neutral-500">
        Edit meals, the grocery list, or preferences in plain language.
      </p>

      {error ? (
        <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>
      ) : null}

      <form
        className="mt-3 flex items-stretch gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          send(draft);
        }}
      >
        <textarea
          value={draft}
          rows={2}
          disabled={pending}
          placeholder="e.g. Swap meal 2 for something with pork tenderloin"
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              send(draft);
            }
          }}
          className="min-h-12 flex-1 resize-none rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-base leading-relaxed transition-colors hover:border-neutral-400 focus:border-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-900/10 disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-950 dark:hover:border-neutral-600"
        />
        <button
          type="submit"
          disabled={pending || !draft.trim()}
          aria-label={pending ? "Updating" : "Send"}
          className="inline-flex min-h-12 w-16 shrink-0 cursor-pointer items-center justify-center rounded-xl bg-neutral-900 text-sm font-semibold text-white shadow-sm transition-all duration-150 hover:bg-neutral-800 hover:shadow active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-white"
        >
          {pending ? (
            <span
              className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white dark:border-neutral-900/30 dark:border-t-neutral-900"
              aria-hidden
            />
          ) : (
            "Send"
          )}
        </button>
      </form>
    </section>
  );
}
