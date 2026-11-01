"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";

import { CookModeView } from "@/components/panel/cook-mode";
import {
  markMealPlanItemCookedAction,
  regenerateRecipeFeedbackAction,
  type GeneratedMealRecipePayload,
} from "@/lib/panel/actions";
import {
  parseIngredientLines,
  resolveInstructionSteps,
} from "@/lib/panel/recipe-format";

type RecipeViewProps = {
  name: string;
  servings?: number | null;
  prepTimeMinutes?: number | null;
  cookTimeMinutes?: number | null;
  totalTimeMinutes?: number | null;
  ingredientsText?: string | null;
  instructionsText?: string | null;
  instructionSteps?: unknown;
  isFavorite?: boolean;
  backHref: string;
  backLabel?: string;
  banner?: string | null;
  /** When set, show Mark as cooked for this meal-batch item. */
  mealPlanItemId?: string;
  cookedAt?: string | null;
};

function MetaChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-neutral-100 px-3.5 py-2.5 dark:bg-neutral-800/80">
      <p className="text-[11px] font-medium uppercase tracking-wide text-neutral-500">
        {label}
      </p>
      <p className="mt-0.5 text-base font-semibold tabular-nums text-neutral-900 dark:text-neutral-50">
        {value}
      </p>
    </div>
  );
}

export function RecipeView({
  name: initialName,
  servings: initialServings,
  prepTimeMinutes: initialPrep,
  cookTimeMinutes: initialCook,
  totalTimeMinutes: initialTotal,
  ingredientsText: initialIngredients,
  instructionsText: initialInstructions,
  instructionSteps: initialSteps,
  isFavorite: initialFavorite,
  backHref,
  backLabel = "Back",
  banner: initialBanner,
  mealPlanItemId,
  cookedAt: initialCookedAt,
}: RecipeViewProps) {
  const [recipe, setRecipe] = useState({
    name: initialName,
    servings: initialServings ?? null,
    prepTimeMinutes: initialPrep ?? null,
    cookTimeMinutes: initialCook ?? null,
    totalTimeMinutes: initialTotal ?? null,
    ingredientsText: initialIngredients ?? null,
    instructionsText: initialInstructions ?? null,
    instructionSteps: initialSteps,
    isFavorite: initialFavorite ?? false,
  });
  const [banner, setBanner] = useState(initialBanner ?? null);
  const [cookedAt, setCookedAt] = useState(initialCookedAt ?? null);
  const [cookMode, setCookMode] = useState(false);

  // Keep local editable state aligned when the server re-renders with new props.
  /* eslint-disable react-hooks/set-state-in-effect -- intentional prop→state sync for soft navigation */
  useEffect(() => {
    setRecipe({
      name: initialName,
      servings: initialServings ?? null,
      prepTimeMinutes: initialPrep ?? null,
      cookTimeMinutes: initialCook ?? null,
      totalTimeMinutes: initialTotal ?? null,
      ingredientsText: initialIngredients ?? null,
      instructionsText: initialInstructions ?? null,
      instructionSteps: initialSteps,
      isFavorite: initialFavorite ?? false,
    });
    setBanner(initialBanner ?? null);
    setCookedAt(initialCookedAt ?? null);
  }, [
    initialName,
    initialServings,
    initialPrep,
    initialCook,
    initialTotal,
    initialIngredients,
    initialInstructions,
    initialSteps,
    initialFavorite,
    initialBanner,
    initialCookedAt,
  ]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const ingredients = parseIngredientLines(recipe.ingredientsText);
  const steps = resolveInstructionSteps({
    instructionSteps: recipe.instructionSteps,
    instructionsText: recipe.instructionsText,
  });

  const time =
    recipe.totalTimeMinutes ??
    (recipe.prepTimeMinutes || recipe.cookTimeMinutes
      ? (recipe.prepTimeMinutes ?? 0) + (recipe.cookTimeMinutes ?? 0)
      : null);

  const showTweak = ingredients.length > 0 || steps.length > 0;
  const tweak = useRecipeTweakControls({
    recipeName: recipe.name,
    mealPlanItemId,
    onUpdated: (updated) => {
      setRecipe(updated);
      setBanner("Recipe updated from your notes");
    },
    enabled: showTweak,
  });

  if (cookMode && steps.length > 0) {
    return (
      <CookModeView
        recipeName={recipe.name}
        steps={steps}
        onExit={() => setCookMode(false)}
      />
    );
  }

  return (
    <article className="recipe-view">
      <div className="mb-6 space-y-3">
        <div className="flex flex-nowrap space-between items-center gap-1.5 sm:gap-2">
          <Link
            href={backHref}
            className="inline-flex h-10 min-w-0 shrink items-center gap-1 rounded-lg px-2 text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900 active:bg-neutral-200 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
          >
            <span aria-hidden>←</span>
            <span className="truncate">{backLabel}</span>
          </Link>
          <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
            {steps.length > 0 ? (
              <button
                type="button"
                onClick={() => setCookMode(true)}
                className="inline-flex h-10 items-center justify-center rounded-lg bg-neutral-900 px-3 text-sm font-medium text-white transition-all duration-150 hover:bg-neutral-800 active:scale-[0.98] sm:px-4 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-white"
              >
                Cook mode
              </button>
            ) : null}
            {tweak.trigger}
          </div>
        </div>
        {tweak.panel}
      </div>

      <header className="mb-8 border-b border-neutral-200 pb-8 dark:border-neutral-800">
        <h1 className="text-balance text-2xl font-semibold tracking-tight text-neutral-950 sm:text-4xl dark:text-neutral-50">
          {recipe.name}
          {recipe.isFavorite ? (
            <span
              className="ml-2 align-middle text-lg text-amber-500"
              title="Favorite"
            >
              ★
            </span>
          ) : null}
        </h1>
        {banner ? (
          <p className="mt-4 inline-flex rounded-full bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
            {banner}
          </p>
        ) : null}

        {(recipe.servings || time || recipe.prepTimeMinutes || recipe.cookTimeMinutes) && (
          <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {recipe.servings ? (
              <MetaChip label="Servings" value={String(recipe.servings)} />
            ) : null}
            {time ? <MetaChip label="Total" value={`${time} min`} /> : null}
            {recipe.prepTimeMinutes ? (
              <MetaChip label="Prep" value={`${recipe.prepTimeMinutes} min`} />
            ) : null}
            {recipe.cookTimeMinutes ? (
              <MetaChip label="Cook" value={`${recipe.cookTimeMinutes} min`} />
            ) : null}
          </div>
        )}

        {mealPlanItemId ? (
          <div className="mt-6">
            <MarkCookedControls
              mealPlanItemId={mealPlanItemId}
              cookedAt={cookedAt}
              onCooked={(result) => {
                setCookedAt(result.cookedAt);
                setRecipe(result.recipe);
                const parts = [
                  result.regenerated
                    ? "Marked cooked · recipe updated from your notes"
                    : "Marked as cooked",
                  `${result.stars}/5`,
                ];
                setBanner(parts.filter(Boolean).join(" · "));
              }}
            />
          </div>
        ) : null}
      </header>

      <div className="space-y-10">
        {ingredients.length > 0 ? (
          <section>
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.12em] text-neutral-500">
              Ingredients
            </h2>
            <ul className="divide-y divide-neutral-100 overflow-hidden rounded-2xl border border-neutral-200 bg-white dark:divide-neutral-800 dark:border-neutral-800 dark:bg-neutral-900">
              {ingredients.map((row, index) => (
                <li
                  key={`${row.name}-${index}`}
                  className="flex items-baseline justify-between gap-4 px-4 py-3.5"
                >
                  <span className="text-base font-medium text-neutral-900 dark:text-neutral-100">
                    {row.name}
                  </span>
                  {row.quantity ? (
                    <span className="shrink-0 text-right text-sm tabular-nums text-neutral-500">
                      {row.quantity}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {steps.length > 0 ? (
          <section>
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.12em] text-neutral-500">
              Instructions
            </h2>
            <ol className="space-y-4">
              {steps.map((step) => (
                <li
                  key={step.number}
                  className="rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900"
                >
                  <div className="flex gap-4">
                    <span
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-sm font-semibold text-white dark:bg-neutral-100 dark:text-neutral-900"
                      aria-hidden
                    >
                      {step.number}
                    </span>
                    <p className="pt-1.5 text-base leading-relaxed text-neutral-800 dark:text-neutral-200">
                      {step.text}
                    </p>
                  </div>
                  {step.ingredients.length > 0 ? (
                    <ul className="mt-3 space-y-2 border-t border-neutral-100 pt-3 dark:border-neutral-800">
                      {step.ingredients.map((ingredient, i) => (
                        <li
                          key={`${step.number}-${ingredient.name}-${i}`}
                          className="rounded-lg bg-neutral-50 px-3 py-2 dark:bg-neutral-800/60"
                        >
                          <p className="text-sm font-medium leading-snug text-neutral-800 dark:text-neutral-200">
                            {ingredient.name}
                          </p>
                          {ingredient.quantity ? (
                            <p className="mt-0.5 text-xs tabular-nums text-neutral-500">
                              {ingredient.quantity}
                            </p>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              ))}
            </ol>
          </section>
        ) : null}
      </div>
    </article>
  );
}

function formatCookedLabel(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Cooked";
  return `Cooked · ${date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  })}`;
}

function useRecipeTweakControls({
  recipeName,
  mealPlanItemId,
  onUpdated,
  enabled,
}: {
  recipeName: string;
  mealPlanItemId?: string;
  onUpdated: (recipe: GeneratedMealRecipePayload) => void;
  enabled: boolean;
}): { trigger: ReactNode; panel: ReactNode } {
  const [step, setStep] = useState<"idle" | "edit" | "saving">("idle");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!enabled) {
    return { trigger: null, panel: null };
  }

  async function submit() {
    const feedback = notes.trim();
    if (!feedback) {
      setError("Describe what should change.");
      return;
    }
    setError(null);
    setStep("saving");
    try {
      const result = await regenerateRecipeFeedbackAction({
        recipeName,
        feedback,
        mealPlanItemId,
      });
      if (!result.ok) {
        setError(result.error);
        setStep("edit");
        return;
      }
      setNotes("");
      setStep("idle");
      onUpdated(result.recipe);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not update the recipe. Try again.",
      );
      setStep("edit");
    }
  }

  const trigger =
    step === "idle" ? (
      <button
        type="button"
        className="inline-flex h-10 items-center justify-center rounded-lg border border-neutral-300 bg-white px-3 text-sm font-medium text-neutral-800 transition-colors hover:bg-neutral-50 sm:px-4 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100 dark:hover:bg-neutral-800"
        onClick={() => {
          setError(null);
          setStep("edit");
        }}
      >
        Tweak recipe
      </button>
    ) : null;

  const panel =
    step === "saving" ? (
      <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-4 dark:border-neutral-800 dark:bg-neutral-900/60">
        <div className="flex items-center gap-3">
          <div
            className="h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-900 dark:border-neutral-600 dark:border-t-neutral-100"
            aria-hidden
          />
          <div>
            <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
              Updating recipe from your notes…
            </p>
            <p className="mt-0.5 text-xs text-neutral-500">
              Applying your notes to ingredients and steps.
            </p>
          </div>
        </div>
      </div>
    ) : step === "edit" ? (
      <div className="rounded-2xl border border-neutral-200 bg-white px-4 py-4 dark:border-neutral-800 dark:bg-neutral-900">
        <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
          What should change?
        </p>
        <p className="mt-1 text-sm text-neutral-500">
          We’ll update the recipe so this feedback is built into the ingredients
          and steps.
        </p>
        <div className="mt-3">
          <CookingNotesField value={notes} onChange={setNotes} />
        </div>
        {error ? (
          <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>
        ) : null}
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            className="inline-flex min-h-11 items-center justify-center rounded-lg bg-neutral-900 px-4 text-sm font-medium text-white transition-colors hover:bg-neutral-800 disabled:opacity-60 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-white"
            disabled={!notes.trim()}
            onClick={() => void submit()}
          >
            Update recipe
          </button>
          <button
            type="button"
            className="inline-flex min-h-11 items-center justify-center rounded-lg px-3 text-sm font-medium text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-800 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
            onClick={() => {
              setError(null);
              setNotes("");
              setStep("idle");
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    ) : null;

  return { trigger, panel };
}

function MarkCookedControls({
  mealPlanItemId,
  cookedAt,
  onCooked,
}: {
  mealPlanItemId: string;
  cookedAt: string | null;
  onCooked: (result: {
    cookedAt: string;
    regenerated: boolean;
    recipe: GeneratedMealRecipePayload;
    stars: 1 | 2 | 3 | 4 | 5;
  }) => void;
}) {
  const [step, setStep] = useState<"idle" | "rate" | "ask" | "notes" | "saving">(
    "idle",
  );
  const [rating, setRating] = useState<1 | 2 | 3 | 4 | 5 | null>(null);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (cookedAt && step === "idle") {
    return (
      <p className="inline-flex rounded-full bg-emerald-100 px-3 py-1 text-sm font-medium text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200">
        {formatCookedLabel(cookedAt)}
      </p>
    );
  }

  async function confirmCooked(feedbackOverride?: string | null) {
    if (!rating) {
      setError("Pick a rating from 1 to 5 stars.");
      setStep("rate");
      return;
    }
    setError(null);
    setStep("saving");
    const feedback =
      feedbackOverride !== undefined
        ? feedbackOverride?.trim() || null
        : notes.trim() || null;
    try {
      const result = await markMealPlanItemCookedAction({
        mealPlanItemId,
        rating,
        feedback,
      });
      if (!result.ok) {
        setError(result.error);
        setStep(notes.trim() ? "notes" : "ask");
        return;
      }
      setNotes("");
      setRating(null);
      setStep("idle");
      onCooked({
        cookedAt: result.cookedAt,
        regenerated: result.regenerated,
        recipe: result.recipe,
        stars: result.stars,
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not mark this meal as cooked. Try again.",
      );
      setStep(notes.trim() ? "notes" : "ask");
    }
  }

  if (step === "saving") {
    return (
      <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-4 dark:border-neutral-800 dark:bg-neutral-900/60">
        <div className="flex items-center gap-3">
          <div
            className="h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-900 dark:border-neutral-600 dark:border-t-neutral-100"
            aria-hidden
          />
          <div>
            <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
              {notes.trim()
                ? "Saving cooked meal and recipe notes…"
                : "Saving cooked meal…"}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (step === "rate") {
    return (
      <div className="rounded-2xl border border-neutral-200 bg-white px-4 py-4 dark:border-neutral-800 dark:bg-neutral-900">
        <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
          How was it?
        </p>
        <p className="mt-1 text-sm text-neutral-500">Rate this meal out of 5.</p>
        {error ? (
          <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>
        ) : null}
        <div className="mt-3 flex flex-wrap gap-1">
          {([1, 2, 3, 4, 5] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-label={`${value} star${value === 1 ? "" : "s"}`}
              className={`inline-flex h-11 w-11 items-center justify-center rounded-lg text-xl transition-colors ${rating !== null && value <= rating
                  ? "bg-amber-100 text-amber-600 dark:bg-amber-950/50 dark:text-amber-300"
                  : "bg-neutral-50 text-neutral-300 hover:bg-neutral-100 hover:text-amber-400 dark:bg-neutral-950 dark:text-neutral-600 dark:hover:bg-neutral-800"
                }`}
              onClick={() => {
                setRating(value);
                setError(null);
              }}
            >
              ★
            </button>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            className="inline-flex min-h-11 items-center justify-center rounded-lg bg-neutral-900 px-4 text-sm font-medium text-white transition-colors hover:bg-neutral-800 disabled:opacity-60 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-white"
            disabled={rating === null}
            onClick={() => setStep("ask")}
          >
            Continue
          </button>
          <button
            type="button"
            className="inline-flex min-h-11 items-center justify-center rounded-lg px-3 text-sm font-medium text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-800 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
            onClick={() => {
              setError(null);
              setRating(null);
              setStep("idle");
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  if (step === "ask") {
    return (
      <div className="rounded-2xl border border-neutral-200 bg-white px-4 py-4 dark:border-neutral-800 dark:bg-neutral-900">
        <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
          Any notes to bake into the recipe next time?
        </p>
        <p className="mt-1 text-sm text-neutral-500">
          Example: less spicy, crispier chicken, double the sauce.
        </p>
        {error ? (
          <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>
        ) : null}
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            className="inline-flex min-h-11 items-center justify-center rounded-lg bg-neutral-900 px-4 text-sm font-medium text-white transition-colors hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-white"
            onClick={() => setStep("notes")}
          >
            Add notes
          </button>
          <button
            type="button"
            className="inline-flex min-h-11 items-center justify-center rounded-lg border border-neutral-300 bg-white px-4 text-sm font-medium text-neutral-800 transition-colors hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100 dark:hover:bg-neutral-800"
            onClick={() => void confirmCooked()}
          >
            Skip
          </button>
          <button
            type="button"
            className="inline-flex min-h-11 items-center justify-center rounded-lg px-3 text-sm font-medium text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-800 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
            onClick={() => {
              setError(null);
              setStep("rate");
            }}
          >
            Back
          </button>
        </div>
      </div>
    );
  }

  if (step === "notes") {
    return (
      <div className="rounded-2xl border border-neutral-200 bg-white px-4 py-4 dark:border-neutral-800 dark:bg-neutral-900">
        <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
          What should change next time?
        </p>
        <p className="mt-1 text-sm text-neutral-500">
          We’ll update the recipe so this feedback is built into the steps.
        </p>
        <div className="mt-3">
          <CookingNotesField value={notes} onChange={setNotes} />
        </div>
        {error ? (
          <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>
        ) : null}
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            className="inline-flex min-h-11 items-center justify-center rounded-lg bg-neutral-900 px-4 text-sm font-medium text-white transition-colors hover:bg-neutral-800 disabled:opacity-60 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-white"
            disabled={!notes.trim()}
            onClick={() => void confirmCooked()}
          >
            Mark cooked
          </button>
          <button
            type="button"
            className="inline-flex min-h-11 items-center justify-center rounded-lg border border-neutral-300 bg-white px-4 text-sm font-medium text-neutral-800 transition-colors hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100 dark:hover:bg-neutral-800"
            onClick={() => {
              setNotes("");
              void confirmCooked("");
            }}
          >
            Skip notes
          </button>
          <button
            type="button"
            className="inline-flex min-h-11 items-center justify-center rounded-lg px-3 text-sm font-medium text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-800 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
            onClick={() => setStep("ask")}
          >
            Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      className="inline-flex min-h-11 items-center justify-center rounded-lg border border-emerald-300 bg-emerald-50 px-4 text-sm font-medium text-emerald-900 transition-colors hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-100 dark:hover:bg-emerald-950"
      onClick={() => {
        setError(null);
        setStep("rate");
      }}
    >
      Mark as cooked
    </button>
  );
}

function CookingNotesField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <textarea
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder="Make it less Cajun, crispier edges, more sauce…"
      rows={3}
      autoFocus
      className="min-h-20 w-full resize-y rounded-md border border-neutral-300 bg-white px-2.5 py-2 text-base leading-snug transition-colors placeholder:text-neutral-400 hover:border-neutral-400 focus:border-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-900/10 dark:border-neutral-700 dark:bg-neutral-950 dark:hover:border-neutral-600 dark:focus:ring-neutral-100/10"
    />
  );
}

export function RecipeGeneratingState({ mealTitle }: { mealTitle: string }) {
  return (
    <div className="space-y-6" aria-busy aria-live="polite">
      <Link
        href="/panel/meals"
        className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
      >
        <span aria-hidden>←</span>
        Back to meals
      </Link>

      <div className="rounded-2xl border border-neutral-200 bg-white px-5 py-8 text-center dark:border-neutral-800 dark:bg-neutral-900">
        <div
          className="mx-auto mb-5 h-10 w-10 animate-spin rounded-full border-2 border-neutral-200 border-t-neutral-900 dark:border-neutral-700 dark:border-t-neutral-100"
          aria-hidden
        />
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-neutral-500">
          Meal batch
        </p>
        <h1 className="mt-2 text-balance text-2xl font-semibold tracking-tight text-neutral-950 dark:text-neutral-50">
          {mealTitle}
        </h1>
        <p className="mt-3 text-base font-medium text-neutral-800 dark:text-neutral-200">
          Generating recipe…
        </p>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-neutral-500">
          Writing ingredients and steps for this meal. Usually under a minute —
          leave this screen open.
        </p>
      </div>
    </div>
  );
}

export function RecipeLoadingSkeleton() {
  return <RecipeGeneratingState mealTitle="Loading meal…" />;
}
