"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  addMealPlanItemAction,
  completeCurrentMealBatchAction,
  generateMealBatchAction,
  rebuildGroceriesFromMealsAction,
  removeMealPlanItemAction,
} from "@/lib/panel/actions";
import {
  EmptyState,
  PanelList,
} from "@/components/panel/ui";
import { PanelIcon } from "@/components/panel/pending-button";
import { MealsChat } from "@/components/panel/meals-chat";

export type MealBatchItemView = {
  id: string;
  title: string;
  cookedAt: string | null;
  hasRecipeIngredients: boolean;
};

export type MeatOptionView = {
  id: string;
  label: string;
};

export type PastMealOptionView = {
  id: string;
  name: string;
  cookedAt: string | null;
  starsDisplay: string | null;
};

type LockMergeResult = {
  added: string[];
  recipesGenerated: number;
  mealsMissingRecipes: number;
  groceryCount: number;
};

const inputClass =
  "min-h-10 w-full rounded-md border border-neutral-300 bg-white px-2.5 py-2 text-base transition-colors placeholder:text-neutral-400 hover:border-neutral-400 focus:border-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-900/10 dark:border-neutral-700 dark:bg-neutral-950 dark:hover:border-neutral-600 dark:focus:ring-neutral-100/10";

function formatCookedDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function MergeResultBanner({
  result,
  title = "Grocery list updated",
  onDismiss,
}: {
  result: LockMergeResult;
  title?: string;
  onDismiss: () => void;
}) {
  return (
    <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="font-semibold">{title}</p>
          {result.recipesGenerated > 0 ? (
            <p>
              Generated {result.recipesGenerated} recipe
              {result.recipesGenerated === 1 ? "" : "s"}.
            </p>
          ) : null}
          <p>
            Grocery now has {result.groceryCount} item
            {result.groceryCount === 1 ? "" : "s"} from this batch.
          </p>
          {result.mealsMissingRecipes > 0 ? (
            <p className="text-amber-800 dark:text-amber-200">
              {result.mealsMissingRecipes} meal
              {result.mealsMissingRecipes === 1 ? "" : "s"} still missing
              recipes — open them to retry, then update the grocery list.
            </p>
          ) : null}
          {result.added.length > 0 ? (
            <ul className="mt-1 list-inside list-disc text-emerald-900/90 dark:text-emerald-100/90">
              {result.added.slice(0, 8).map((name) => (
                <li key={name}>{name}</li>
              ))}
              {result.added.length > 8 ? (
                <li>…and {result.added.length - 8} more</li>
              ) : null}
            </ul>
          ) : null}
          <Link
            href="/panel/groceries"
            className="inline-flex cursor-pointer pt-1 font-medium underline-offset-2 hover:underline"
          >
            Open grocery list
          </Link>
        </div>
        <button
          type="button"
          className="shrink-0 cursor-pointer rounded-md px-2 py-1 text-emerald-800/70 transition-colors hover:bg-emerald-100 hover:text-emerald-950 dark:text-emerald-200/70 dark:hover:bg-emerald-900/50 dark:hover:text-emerald-100"
          onClick={onDismiss}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}

function GenerateMealsForm({
  meatOptions,
  pastMeals,
  pickCount,
  defaultMealCount,
  hasExisting,
  confirmLabel = "Replace current batch",
  heading = "Generate meals",
  planAhead = false,
  onDone,
}: {
  meatOptions: MeatOptionView[];
  pastMeals: PastMealOptionView[];
  pickCount: number;
  defaultMealCount: number;
  hasExisting: boolean;
  confirmLabel?: string;
  heading?: string;
  /** One active batch already — primary action creates upcoming without replace. */
  planAhead?: boolean;
  onDone: () => void;
}) {
  type Step = "past" | "count" | "use" | "proteins";
  const [step, setStep] = useState<Step>(
    pastMeals.length > 0 ? "past" : "count",
  );
  const [includedPast, setIncludedPast] = useState<string[]>([]);
  const [useText, setUseText] = useState("");
  const [wantSpecificProteins, setWantSpecificProteins] = useState<
    boolean | null
  >(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [mealCount, setMealCount] = useState(defaultMealCount);
  const [error, setError] = useState<string | null>(null);
  const [needsConfirm, setNeedsConfirm] = useState(false);
  const [pending, startTransition] = useTransition();

  const newMealSlots = Math.max(0, mealCount - includedPast.length);
  const useIngredients = useText
    .split(/[\n,;]+/)
    .map((part) => part.trim())
    .filter(Boolean);

  function togglePastMeal(name: string) {
    setIncludedPast((prev) => {
      const next = prev.includes(name)
        ? prev.filter((item) => item !== name)
        : [...prev, name];
      setMealCount((count) => Math.max(count, next.length, 1));
      return next;
    });
    setError(null);
  }

  function toggleMeat(label: string) {
    setSelected((prev) =>
      prev.includes(label)
        ? prev.filter((item) => item !== label)
        : [...prev, label],
    );
    setNeedsConfirm(false);
    setError(null);
  }

  function continueFromPast() {
    setError(null);
    setMealCount((count) => Math.max(count, includedPast.length, 1));
    setStep("count");
  }

  function continueFromCount() {
    setError(null);
    const count = Math.max(mealCount, includedPast.length, 1);
    setMealCount(count);
    if (count <= includedPast.length) {
      // All slots filled by past meals — generate without use/protein picks.
      setWantSpecificProteins(false);
      setSelected([]);
      runGenerate(false, {
        count,
        meats: [],
        include: includedPast,
        use: [],
      });
      return;
    }
    setWantSpecificProteins(null);
    setSelected([]);
    setStep("use");
  }

  function continueFromUse() {
    setError(null);
    setWantSpecificProteins(null);
    setSelected([]);
    setStep("proteins");
  }

  function runGenerate(
    replaceExisting: boolean,
    override?: {
      count: number;
      meats: string[];
      include: string[];
      use?: string[];
    },
  ) {
    setError(null);
    const count = override?.count ?? Math.max(mealCount, includedPast.length, 1);
    const meats = override?.meats ?? selected;
    const include = override?.include ?? includedPast;
    const use = override?.use ?? useIngredients;
    startTransition(async () => {
      const result = await generateMealBatchAction({
        selectedMeats: meats,
        mealCount: count,
        includePastMeals: include,
        useIngredients: use,
        replaceExisting,
      });
      if (!result.ok) {
        if (result.needsReplaceConfirm) {
          setNeedsConfirm(true);
          setError(result.error);
          return;
        }
        setError(result.error);
        return;
      }
      onDone();
    });
  }

  const shellClass =
    "rounded-xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900";
  const primaryBtn =
    "inline-flex min-h-11 cursor-pointer items-center justify-center rounded-lg bg-neutral-900 px-4 text-sm font-medium text-white transition-colors hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-white";
  const secondaryBtn =
    "inline-flex min-h-11 cursor-pointer items-center justify-center rounded-lg border border-neutral-300 bg-white px-4 text-sm font-medium transition-colors hover:border-neutral-400 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-950 dark:hover:border-neutral-600 dark:hover:bg-neutral-900";
  const ghostLink =
    "cursor-pointer text-sm font-medium text-neutral-600 underline-offset-2 transition-colors hover:text-neutral-900 hover:underline dark:text-neutral-400 dark:hover:text-neutral-200";
  const ghostLinkXs =
    "cursor-pointer text-xs font-medium text-neutral-600 underline-offset-2 transition-colors hover:text-neutral-900 hover:underline dark:text-neutral-400 dark:hover:text-neutral-200";

  function renderIncludedSummary(onEdit?: () => void) {
    if (includedPast.length === 0) return null;
    return (
      <div className="mt-3 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5 dark:border-neutral-800 dark:bg-neutral-950/60">
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
            Included past meals
          </p>
          {onEdit ? (
            <button type="button" className={ghostLinkXs} onClick={onEdit}>
              Edit
            </button>
          ) : null}
        </div>
        <ul className="mt-1 list-inside list-disc text-sm text-neutral-800 dark:text-neutral-200">
          {includedPast.map((name) => (
            <li key={name}>{name}</li>
          ))}
        </ul>
      </div>
    );
  }

  function renderUseSummary(onEdit?: () => void) {
    if (useIngredients.length === 0) return null;
    return (
      <div className="mt-3 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5 dark:border-neutral-800 dark:bg-neutral-950/60">
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
            Use these
          </p>
          {onEdit ? (
            <button type="button" className={ghostLinkXs} onClick={onEdit}>
              Edit
            </button>
          ) : null}
        </div>
        <p className="mt-1 text-sm text-neutral-800 dark:text-neutral-200">
          {useIngredients.join(", ")}
        </p>
      </div>
    );
  }

  if (step === "past") {
    return (
      <div className={shellClass}>
        <p className="text-sm font-semibold tracking-tight">{heading}</p>
        <p className="mt-1 text-sm text-neutral-500">
          Want any past meals in this batch? Check the ones to include.
        </p>

        <ul className="mt-3 max-h-72 space-y-1 overflow-y-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
          {pastMeals.map((meal) => {
            const checked = includedPast.includes(meal.name);
            return (
              <li key={meal.id}>
                <label
                  className={`flex min-h-12 cursor-pointer items-start gap-3 px-3 py-3 transition-colors ${
                    checked
                      ? "bg-neutral-100 dark:bg-neutral-800/60"
                      : "hover:bg-neutral-50 dark:hover:bg-neutral-800/40"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => togglePastMeal(meal.name)}
                    className="mt-0.5 h-6 w-6 shrink-0 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-900/20 dark:border-neutral-600 dark:bg-neutral-950"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium leading-snug">
                      {meal.name}
                    </span>
                    <span className="mt-0.5 block text-xs text-neutral-500">
                      {meal.cookedAt
                        ? formatCookedDate(meal.cookedAt)
                        : "Past meal"}
                      {meal.starsDisplay ? (
                        <>
                          {" · "}
                          <span className="text-amber-500 dark:text-amber-400">
                            {meal.starsDisplay}
                          </span>
                        </>
                      ) : null}
                    </span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>

        <p className="mt-2 text-xs text-neutral-500">
          {includedPast.length === 0
            ? "None selected — new meals only."
            : `${includedPast.length} included; remaining slots will be generated.`}
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" onClick={continueFromPast} className={primaryBtn}>
            {includedPast.length > 0
              ? `Continue with ${includedPast.length}`
              : "Skip — no past meals"}
          </button>
        </div>
      </div>
    );
  }

  if (step === "count") {
    return (
      <div className={shellClass}>
        <p className="text-sm font-semibold tracking-tight">{heading}</p>
        <p className="mt-1 text-sm text-neutral-500">How many meals in this batch?</p>

        {renderIncludedSummary(
          pastMeals.length > 0
            ? () => {
                setError(null);
                setStep("past");
              }
            : undefined,
        )}

        {includedPast.length > 0 ? (
          <p className="mt-3 text-xs text-neutral-500">
            {includedPast.length} past +{" "}
            {Math.max(0, mealCount - includedPast.length)} new
          </p>
        ) : null}

        <div className="mt-3 flex flex-wrap gap-2">
          {Array.from(
            new Set(
              [3, 4, 5, 6, mealCount].filter(
                (n) => n >= Math.max(1, includedPast.length) && n <= 10,
              ),
            ),
          )
            .sort((a, b) => a - b)
            .map((n) => {
              const active = mealCount === n;
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => setMealCount(n)}
                  className={`min-h-12 min-w-12 cursor-pointer rounded-lg border px-3 text-sm font-medium transition-colors ${
                    active
                      ? "border-neutral-900 bg-neutral-900 text-white dark:border-neutral-100 dark:bg-neutral-100 dark:text-neutral-900"
                      : "border-neutral-300 bg-white text-neutral-800 hover:border-neutral-400 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100 dark:hover:border-neutral-600 dark:hover:bg-neutral-900"
                  }`}
                >
                  {n}
                </button>
              );
            })}
        </div>

        {error ? (
          <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-2">
          {pastMeals.length > 0 ? (
            <button
              type="button"
              className={secondaryBtn}
              onClick={() => {
                setError(null);
                setStep("past");
              }}
            >
              Back
            </button>
          ) : null}
          <button
            type="button"
            disabled={pending}
            onClick={continueFromCount}
            className={primaryBtn}
          >
            {pending
              ? "Generating…"
              : mealCount <= includedPast.length
                ? planAhead
                  ? "Create upcoming batch"
                  : hasExisting
                    ? "Replace with these meals"
                    : "Create batch"
                : "Continue"}
          </button>
          {needsConfirm || (hasExisting && !planAhead) ? (
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                runGenerate(true, {
                  count: Math.max(mealCount, includedPast.length, 1),
                  meats: [],
                  include: includedPast,
                  use: [],
                })
              }
              className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-lg border border-amber-400 bg-amber-50 px-4 text-sm font-medium text-amber-950 transition-colors hover:border-amber-500 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100 dark:hover:bg-amber-950/70"
            >
              {pending ? "Replacing…" : confirmLabel}
            </button>
          ) : null}
          {planAhead ? (
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                runGenerate(true, {
                  count: Math.max(mealCount, includedPast.length, 1),
                  meats: [],
                  include: includedPast,
                  use: [],
                })
              }
              className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-lg border border-amber-400 bg-amber-50 px-4 text-sm font-medium text-amber-950 transition-colors hover:border-amber-500 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100 dark:hover:bg-amber-950/70"
            >
              {pending ? "Replacing…" : "Replace current instead"}
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  if (step === "use") {
    return (
      <div className={shellClass}>
        <p className="text-sm font-semibold tracking-tight">{heading}</p>
        <p className="mt-1 text-sm text-neutral-500">
          Anything you specifically want to use? Pantry leftovers, produce that’s
          hanging around — list them and new meals will try to use them.
        </p>

        {renderIncludedSummary(
          pastMeals.length > 0
            ? () => {
                setError(null);
                setStep("past");
              }
            : undefined,
        )}

        <textarea
          value={useText}
          onChange={(event) => {
            setUseText(event.target.value);
            setError(null);
          }}
          rows={3}
          placeholder="e.g. spinach, ricotta, lemon"
          className={`${inputClass} mt-3 resize-y`}
        />
        <p className="mt-1.5 text-xs text-neutral-500">
          Separate with commas. Skip if nothing specific.
        </p>

        {error ? (
          <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            className={secondaryBtn}
            onClick={() => {
              setError(null);
              setStep("count");
            }}
          >
            Back
          </button>
          <button
            type="button"
            onClick={continueFromUse}
            className={primaryBtn}
          >
            {useIngredients.length > 0
              ? `Continue with ${useIngredients.length}`
              : "Skip — nothing specific"}
          </button>
        </div>
      </div>
    );
  }

  // step === "proteins"
  const canGenerateWithPicks =
    wantSpecificProteins === false ||
    (wantSpecificProteins === true && selected.length > 0);

  return (
    <div className={shellClass}>
      <p className="text-sm font-semibold tracking-tight">{heading}</p>
      <p className="mt-1 text-sm text-neutral-500">
        Want specific proteins for the{" "}
        {newMealSlots === 1 ? "new meal" : `${newMealSlots} new meals`}?
        {mealCount > 0 ? ` Batch size: ${mealCount}.` : ""}
      </p>

      {renderIncludedSummary(
        pastMeals.length > 0
          ? () => {
              setError(null);
              setStep("past");
            }
          : undefined,
      )}
      {renderUseSummary(() => {
        setError(null);
        setStep("use");
      })}

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => {
            setWantSpecificProteins(true);
            setNeedsConfirm(false);
            setError(null);
          }}
          className={`inline-flex min-h-11 cursor-pointer items-center rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors ${
            wantSpecificProteins === true
              ? "border-neutral-900 bg-neutral-900 text-white hover:bg-neutral-800 dark:border-neutral-100 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-white"
              : "border-neutral-300 bg-white text-neutral-800 hover:border-neutral-400 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100 dark:hover:border-neutral-600 dark:hover:bg-neutral-900"
          }`}
        >
          Yes — I’ll pick
        </button>
        <button
          type="button"
          onClick={() => {
            setWantSpecificProteins(false);
            setSelected([]);
            setNeedsConfirm(false);
            setError(null);
          }}
          className={`inline-flex min-h-11 cursor-pointer items-center rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors ${
            wantSpecificProteins === false
              ? "border-neutral-900 bg-neutral-900 text-white hover:bg-neutral-800 dark:border-neutral-100 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-white"
              : "border-neutral-300 bg-white text-neutral-800 hover:border-neutral-400 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100 dark:hover:border-neutral-600 dark:hover:bg-neutral-900"
          }`}
        >
          No — you choose
        </button>
      </div>

      {wantSpecificProteins === true ? (
        <>
          <p className="mt-4 text-sm text-neutral-500">
            Pick about {pickCount} protein{pickCount === 1 ? "" : "s"}.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {meatOptions.map((option) => {
              const active = selected.includes(option.label);
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => toggleMeat(option.label)}
                  className={`inline-flex min-h-11 cursor-pointer items-center rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                    active
                      ? "border-neutral-900 bg-neutral-900 text-white hover:bg-neutral-800 dark:border-neutral-100 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-white"
                      : "border-neutral-300 bg-white text-neutral-800 hover:border-neutral-400 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100 dark:hover:border-neutral-600 dark:hover:bg-neutral-900"
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </>
      ) : null}

      {wantSpecificProteins === false ? (
        <p className="mt-3 text-sm text-neutral-500">
          Proteins will be chosen from preferences.
        </p>
      ) : null}

      {error ? (
        <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          className={secondaryBtn}
          onClick={() => {
            setError(null);
            setNeedsConfirm(false);
            setStep("use");
          }}
        >
          Back
        </button>
        <button
          type="button"
          disabled={pending || !canGenerateWithPicks}
          onClick={() => runGenerate(false)}
          className={primaryBtn}
        >
          {pending ? "Generating…" : "Generate meals"}
        </button>
        {needsConfirm || (hasExisting && !planAhead) ? (
          <button
            type="button"
            disabled={pending || !canGenerateWithPicks}
            onClick={() => runGenerate(true)}
            className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-lg border border-amber-400 bg-amber-50 px-4 text-sm font-medium text-amber-950 transition-colors hover:border-amber-500 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100 dark:hover:bg-amber-950/70"
          >
            {pending ? "Replacing…" : confirmLabel}
          </button>
        ) : null}
        {planAhead ? (
          <button
            type="button"
            disabled={pending || !canGenerateWithPicks}
            onClick={() => runGenerate(true)}
            className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-lg border border-amber-400 bg-amber-50 px-4 text-sm font-medium text-amber-950 transition-colors hover:border-amber-500 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100 dark:hover:bg-amber-950/70"
          >
            {pending ? "Replacing…" : "Replace current instead"}
          </button>
        ) : null}
      </div>

      {pastMeals.length === 0 ? null : (
        <button
          type="button"
          className={`mt-3 ${ghostLink}`}
          onClick={() => {
            setError(null);
            setStep("past");
          }}
        >
          Edit past meals…
        </button>
      )}
    </div>
  );
}

function MealRow({
  item,
  index,
  editable,
  onChanged,
}: {
  item: MealBatchItemView;
  index: number;
  editable: boolean;
  onChanged: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const cooked = Boolean(item.cookedAt);

  function remove() {
    setError(null);
    startTransition(async () => {
      const result = await removeMealPlanItemAction(item.id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onChanged();
    });
  }

  return (
    <li
      className={`transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-800/40 ${
        cooked ? "bg-emerald-50/40 dark:bg-emerald-950/20" : ""
      }`}
    >
      <div className="flex min-h-11 items-start gap-1">
        <Link
          href={`/panel/meals/item/${item.id}`}
          className="min-w-0 flex-1 cursor-pointer px-3 py-2.5 transition-colors hover:bg-neutral-50/80 active:bg-neutral-100/80 dark:hover:bg-neutral-800/30 dark:active:bg-neutral-800/60"
        >
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
              Meal {index + 1}
            </p>
            {cooked && item.cookedAt ? (
              <span className="inline-flex items-center rounded-md bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200">
                Cooked · {formatCookedDate(item.cookedAt)}
              </span>
            ) : null}
            {!item.hasRecipeIngredients ? (
              <span className="text-[10px] font-medium uppercase tracking-wide text-amber-700 dark:text-amber-300">
                Needs recipe
              </span>
            ) : null}
          </div>
          <p
            className={`text-base font-medium leading-snug break-words ${
              cooked ? "text-neutral-600 dark:text-neutral-300" : ""
            }`}
          >
            {item.title}
          </p>
        </Link>
        {editable ? (
          <div className="flex shrink-0 items-center py-2 pr-2">
            <button
              type="button"
              disabled={pending}
              className="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-md text-red-600 transition-colors hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-950 dark:hover:text-red-300"
              onClick={remove}
              aria-label="Remove meal"
              title="Remove"
            >
              <PanelIcon>×</PanelIcon>
            </button>
          </div>
        ) : null}
      </div>
      {error ? (
        <p className="px-3 pb-2 text-sm text-red-600 dark:text-red-400">{error}</p>
      ) : null}
    </li>
  );
}

export function MealsBatchClient({
  currentPlan,
  currentItems,
  upcomingPlan,
  upcomingItems,
  meatOptions,
  pastMeals,
  pickCount,
  defaultMealCount,
}: {
  currentPlan: {
    id: string;
    title: string | null;
    weekStartDate: string;
    status: string;
  } | null;
  currentItems: MealBatchItemView[];
  upcomingPlan: {
    id: string;
    title: string | null;
    weekStartDate: string;
    status: string;
  } | null;
  upcomingItems: MealBatchItemView[];
  meatOptions: MeatOptionView[];
  pastMeals: PastMealOptionView[];
  pickCount: number;
  defaultMealCount: number;
}) {
  const router = useRouter();
  const [showGenerate, setShowGenerate] = useState(!currentPlan);
  const [addTitle, setAddTitle] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [mergeResult, setMergeResult] = useState<LockMergeResult | null>(null);
  const [mergeTitle, setMergeTitle] = useState("Grocery list rebuilt");
  const [pending, startTransition] = useTransition();

  const canPlanAhead = Boolean(currentPlan) && !upcomingPlan;
  const replaceConfirmLabel = upcomingPlan
    ? "Replace upcoming batch"
    : "Replace current batch";
  const generateHeading = canPlanAhead
    ? "Plan next batch"
    : upcomingPlan
      ? "Replace upcoming batch"
      : "Generate meals";

  function refresh() {
    router.refresh();
  }

  function startGroceryUpdate(mealPlanId: string) {
    setActionError(null);
    setMergeResult(null);
    startTransition(async () => {
      const result = await rebuildGroceriesFromMealsAction({ mealPlanId });
      if (!result.ok) {
        setActionError(result.error);
        return;
      }
      setMergeTitle("Grocery list rebuilt");
      setMergeResult({
        added: result.added,
        recipesGenerated: result.recipesGenerated,
        mealsMissingRecipes: result.mealsMissingRecipes,
        groceryCount: result.groceryCount,
      });
      refresh();
    });
  }

  function finishCurrentBatch() {
    setActionError(null);
    startTransition(async () => {
      const result = await completeCurrentMealBatchAction();
      if (!result.ok) {
        setActionError(result.error);
        return;
      }
      refresh();
    });
  }

  function addMeal() {
    const title = addTitle.trim();
    if (!title) return;
    setActionError(null);
    startTransition(async () => {
      const result = await addMealPlanItemAction({ title });
      if (!result.ok) {
        setActionError(result.error);
        return;
      }
      setAddTitle("");
      refresh();
    });
  }

  function renderBatchSection(input: {
    role: "Current" | "Upcoming";
    plan: NonNullable<typeof currentPlan>;
    items: MealBatchItemView[];
    canFinish?: boolean;
    showAdd?: boolean;
  }) {
    const cookedCount = input.items.filter((item) => item.cookedAt).length;
    return (
      <section className="mb-6">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
              {input.role}
            </p>
            <p className="mt-0.5 text-sm text-neutral-500">
              {input.plan.title ?? `Week of ${input.plan.weekStartDate}`}
              {input.items.length > 0
                ? ` · ${cookedCount}/${input.items.length} cooked`
                : null}
            </p>
            {input.role === "Current" ? (
              <p className="mt-1 text-sm text-neutral-500">
                Cooking through this batch. You can keep one upcoming batch for
                grocery foresight.
              </p>
            ) : (
              <p className="mt-1 text-sm text-neutral-500">
                Next batch — edit anytime. Finish the current batch when you’re
                ready for this one to become current.
              </p>
            )}
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap">
            {input.items.length > 0 ? (
              <button
                type="button"
                disabled={pending}
                onClick={() => startGroceryUpdate(input.plan.id)}
                className="inline-flex min-h-12 w-full cursor-pointer items-center justify-center rounded-lg bg-neutral-900 px-3 text-sm font-medium text-white transition-colors hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-white"
              >
                {pending ? "Building grocery list…" : "Build grocery list"}
              </button>
            ) : null}
            {input.canFinish ? (
              <button
                type="button"
                disabled={pending}
                onClick={finishCurrentBatch}
                className="inline-flex min-h-11 cursor-pointer items-center rounded-lg border border-neutral-300 bg-white px-3 text-sm font-medium transition-colors hover:border-neutral-400 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-900 dark:hover:border-neutral-600 dark:hover:bg-neutral-800"
              >
                {pending ? "Finishing…" : "Finish batch"}
              </button>
            ) : null}
          </div>
        </div>

        {input.showAdd ? (
          <form
            className="mb-3 flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              addMeal();
            }}
          >
            <input
              value={addTitle}
              onChange={(event) => setAddTitle(event.target.value)}
              placeholder="Add a meal title…"
              className={`${inputClass} min-w-0 flex-1`}
            />
            <button
              type="submit"
              disabled={pending || !addTitle.trim()}
              className="inline-flex h-10 shrink-0 cursor-pointer items-center rounded-md border border-neutral-300 bg-white px-3 text-sm font-medium transition-colors hover:border-neutral-400 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-900 dark:hover:border-neutral-600 dark:hover:bg-neutral-800"
            >
              Add
            </button>
          </form>
        ) : null}

        {input.items.length === 0 ? (
          <EmptyState>No dinner meals in this batch.</EmptyState>
        ) : (
          <PanelList>
            {input.items.map((item, index) => (
              <MealRow
                key={item.id}
                item={item}
                index={index}
                editable
                onChanged={refresh}
              />
            ))}
          </PanelList>
        )}
      </section>
    );
  }

  return (
    <div>
      {mergeResult ? (
        <MergeResultBanner
          result={mergeResult}
          title={mergeTitle}
          onDismiss={() => setMergeResult(null)}
        />
      ) : null}

      {actionError ? (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          <p>{actionError}</p>
        </div>
      ) : null}

      {currentPlan || upcomingPlan ? (
        <>
          <div className="mb-4 flex flex-wrap gap-2">
            <button
              type="button"
              className="inline-flex min-h-11 cursor-pointer items-center rounded-lg border border-neutral-300 bg-white px-3 text-sm font-medium transition-colors hover:border-neutral-400 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:hover:border-neutral-600 dark:hover:bg-neutral-800"
              onClick={() => setShowGenerate((value) => !value)}
            >
              {showGenerate
                ? "Hide generator"
                : canPlanAhead
                  ? "Plan next batch"
                  : upcomingPlan
                    ? "Replace upcoming"
                    : "New batch"}
            </button>
          </div>

          {showGenerate ? (
            <div className="mb-4">
              <GenerateMealsForm
                meatOptions={meatOptions}
                pastMeals={pastMeals}
                pickCount={pickCount}
                defaultMealCount={defaultMealCount}
                hasExisting={Boolean(upcomingPlan) || Boolean(currentPlan)}
                confirmLabel={replaceConfirmLabel}
                heading={generateHeading}
                planAhead={canPlanAhead}
                onDone={() => {
                  setShowGenerate(false);
                  setMergeResult(null);
                  refresh();
                }}
              />
            </div>
          ) : null}

          {currentPlan
            ? renderBatchSection({
                role: "Current",
                plan: currentPlan,
                items: currentItems,
                canFinish: Boolean(upcomingPlan),
                showAdd: !upcomingPlan,
              })
            : null}

          {upcomingPlan
            ? renderBatchSection({
                role: "Upcoming",
                plan: upcomingPlan,
                items: upcomingItems,
                showAdd: true,
              })
            : null}

          <MealsChat />
        </>
      ) : (
        <div className="space-y-4">
          <EmptyState>
            No active meal batch. Pick proteins and generate the next set of
            dinners.
          </EmptyState>
          <GenerateMealsForm
            meatOptions={meatOptions}
            pastMeals={pastMeals}
            pickCount={pickCount}
            defaultMealCount={defaultMealCount}
            hasExisting={false}
            onDone={refresh}
          />
        </div>
      )}
    </div>
  );
}

