"use client";

import { useEffect, useOptimistic, useRef, useState } from "react";

import {
  removePreferenceAction,
  savePreferenceAction,
} from "@/lib/panel/actions";
import {
  EmptyState,
  PanelCompactInput,
  PanelCompactTextarea,
  PanelList,
  PanelSelect,
} from "@/components/panel/ui";
import {
  PanelIcon,
  PanelIconButton,
  PendingIconButton,
} from "@/components/panel/pending-button";
import { focusFieldIntoView } from "@/lib/panel/focus-field";

export type PreferenceView = {
  id: string;
  kind: string;
  key: string;
  value: string;
  strength: string;
};

const KIND_OPTIONS = [
  { value: "like", label: "Like" },
  { value: "dislike", label: "Dislike" },
  { value: "constraint", label: "Constraint" },
  { value: "note", label: "Note" },
];

const STRENGTH_OPTIONS = [
  { value: "explicit", label: "Explicit" },
  { value: "inferred", label: "Inferred" },
];

type OptimisticAction =
  | { type: "upsert"; pref: PreferenceView }
  | { type: "remove"; id: string };

function reducePrefs(
  state: PreferenceView[],
  action: OptimisticAction,
): PreferenceView[] {
  switch (action.type) {
    case "upsert": {
      const without = state.filter(
        (p) => !(p.kind === action.pref.kind && p.key === action.pref.key),
      );
      return [action.pref, ...without];
    }
    case "remove":
      return state.filter((p) => p.id !== action.id);
    default:
      return state;
  }
}

function cancelWhenFocusLeavesForm(
  form: HTMLFormElement | null,
  cancel: () => void,
) {
  requestAnimationFrame(() => {
    if (!form) return;
    if (form.contains(document.activeElement)) return;
    cancel();
  });
}

export function PreferencesListClient({
  initialPreferences,
}: {
  initialPreferences: PreferenceView[];
}) {
  const [preferences, setOptimistic] = useOptimistic(
    initialPreferences,
    reducePrefs,
  );
  const [adding, setAdding] = useState(false);
  const addFormRef = useRef<HTMLFormElement>(null);
  const addKeyRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (adding) focusFieldIntoView(addKeyRef.current);
  }, [adding]);

  return (
    <div className="space-y-4">
      {adding ? (
        <form
          ref={addFormRef}
          className="space-y-2 rounded-xl border border-neutral-200 bg-white p-2 dark:border-neutral-800 dark:bg-neutral-900"
          action={async (formData) => {
            const kind = String(formData.get("kind") ?? "note");
            const key = String(formData.get("key") ?? "").trim();
            const value = String(formData.get("value") ?? "").trim();
            const strength = String(formData.get("strength") ?? "explicit");
            if (!key || !value) return;
            setOptimistic({
              type: "upsert",
              pref: {
                id: `temp-${crypto.randomUUID()}`,
                kind,
                key,
                value,
                strength,
              },
            });
            setAdding(false);
            addFormRef.current?.reset();
            await savePreferenceAction(formData);
          }}
          onBlur={() =>
            cancelWhenFocusLeavesForm(addFormRef.current, () => setAdding(false))
          }
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              setAdding(false);
              return;
            }
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
              event.preventDefault();
              addFormRef.current?.requestSubmit();
            }
          }}
        >
          <div className="grid grid-cols-2 gap-2">
            <PanelSelect name="kind" defaultValue="note" options={KIND_OPTIONS} />
            <PanelSelect
              name="strength"
              defaultValue="explicit"
              options={STRENGTH_OPTIONS}
            />
          </div>
          <PanelCompactInput
            name="key"
            placeholder="Key"
            required
            inputRef={addKeyRef}
            className="w-full"
          />
          <PanelCompactTextarea
            name="value"
            placeholder="Value"
            required
            rows={4}
          />
          <div className="flex justify-end gap-1">
            <PendingIconButton
              variant="icon-success"
              title="Save"
              aria-label="Save"
            >
              ✓
            </PendingIconButton>
            <PanelIconButton
              onClick={() => setAdding(false)}
              aria-label="Cancel"
            >
              ×
            </PanelIconButton>
          </div>
        </form>
      ) : (
        <button
          type="button"
          className="flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-neutral-300 text-sm font-medium text-neutral-600 transition-colors hover:border-neutral-400 hover:bg-neutral-50 hover:text-neutral-900 dark:border-neutral-700 dark:text-neutral-400 dark:hover:border-neutral-600 dark:hover:bg-neutral-900 dark:hover:text-neutral-100"
          onClick={() => setAdding(true)}
        >
          <PanelIcon>+</PanelIcon>
          Add preference
        </button>
      )}

      {preferences.length === 0 && !adding ? (
        <EmptyState>No preferences saved yet.</EmptyState>
      ) : preferences.length > 0 ? (
        <PanelList>
          {sortPreferences(preferences).map((pref) => (
            <PreferenceRow
              key={pref.id}
              pref={pref}
              onSave={async (formData) => {
                const kind = String(formData.get("kind") ?? pref.kind);
                const key = String(formData.get("key") ?? "").trim();
                const value = String(formData.get("value") ?? "").trim();
                const strength = String(
                  formData.get("strength") ?? pref.strength,
                );
                if (!key || !value) return;
                setOptimistic({
                  type: "upsert",
                  pref: {
                    ...pref,
                    kind,
                    key,
                    value,
                    strength,
                  },
                });
                await savePreferenceAction(formData);
              }}
              onRemove={async (formData) => {
                setOptimistic({ type: "remove", id: pref.id });
                await removePreferenceAction(formData);
              }}
            />
          ))}
        </PanelList>
      ) : null}
    </div>
  );
}

const KIND_ORDER = ["constraint", "dislike", "like", "note"] as const;

function kindLabel(kind: string) {
  return KIND_OPTIONS.find((o) => o.value === kind)?.label ?? kind;
}

function sortPreferences(prefs: PreferenceView[]) {
  return [...prefs].sort((a, b) => {
    const ai = KIND_ORDER.indexOf(a.kind as (typeof KIND_ORDER)[number]);
    const bi = KIND_ORDER.indexOf(b.kind as (typeof KIND_ORDER)[number]);
    const aRank = ai === -1 ? KIND_ORDER.length : ai;
    const bRank = bi === -1 ? KIND_ORDER.length : bi;
    if (aRank !== bRank) return aRank - bRank;
    return a.key.localeCompare(b.key);
  });
}

function PreferenceRow({
  pref,
  onSave,
  onRemove,
}: {
  pref: PreferenceView;
  onSave: (formData: FormData) => void | Promise<void>;
  onRemove: (formData: FormData) => void | Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const keyRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) focusFieldIntoView(keyRef.current);
  }, [editing]);

  if (editing) {
    return (
      <li className="border-b border-neutral-200 last:border-b-0 dark:border-neutral-800">
        <form
          ref={formRef}
          className="space-y-2 p-2"
          action={async (formData) => {
            await onSave(formData);
            setEditing(false);
          }}
          onBlur={() =>
            cancelWhenFocusLeavesForm(formRef.current, () => setEditing(false))
          }
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              setEditing(false);
              return;
            }
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
              event.preventDefault();
              formRef.current?.requestSubmit();
            }
          }}
        >
          <div className="grid grid-cols-2 gap-2">
            <PanelSelect
              name="kind"
              defaultValue={pref.kind}
              options={KIND_OPTIONS}
            />
            <PanelSelect
              name="strength"
              defaultValue={pref.strength}
              options={STRENGTH_OPTIONS}
            />
          </div>
          <PanelCompactInput
            name="key"
            defaultValue={pref.key}
            required
            inputRef={keyRef}
            className="w-full"
          />
          <PanelCompactTextarea
            name="value"
            defaultValue={pref.value}
            required
            rows={4}
          />
          <div className="flex justify-end gap-1">
            <PendingIconButton
              variant="icon-success"
              title="Save"
              aria-label="Save"
            >
              ✓
            </PendingIconButton>
            <PanelIconButton
              onClick={() => setEditing(false)}
              aria-label="Cancel"
            >
              ×
            </PanelIconButton>
          </div>
        </form>
      </li>
    );
  }

  return (
    <li className="group/row flex items-stretch transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-800/40">
      <button
        type="button"
        className="min-w-0 flex-1 px-3 py-2.5 text-left"
        onClick={() => setEditing(true)}
      >
        <span className="inline-flex rounded-md bg-neutral-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400">
          {kindLabel(pref.kind)}
        </span>
        <p className="mt-1.5 text-[15px] font-medium leading-snug text-neutral-900 dark:text-neutral-100">
          {pref.key}
        </p>
        <p className="mt-0.5 whitespace-pre-wrap text-sm leading-snug text-neutral-500 dark:text-neutral-400">
          {pref.value}
        </p>
      </button>
      <div className="flex shrink-0 items-center border-l border-neutral-100 dark:border-neutral-800">
        <form action={onRemove}>
          <input type="hidden" name="kind" value={pref.kind} />
          <input type="hidden" name="key" value={pref.key} />
          <PendingIconButton
            variant="icon-danger"
            title="Remove"
            aria-label="Remove"
          >
            ×
          </PendingIconButton>
        </form>
      </div>
    </li>
  );
}
