"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import {
  generateMealPlanItemRecipeAction,
  type GeneratedMealRecipePayload,
} from "@/lib/panel/actions";
import {
  RecipeGeneratingState,
  RecipeView,
} from "@/components/panel/recipe-view";

export function MealRecipeGenerator({
  mealPlanItemId,
  mealTitle,
  cookedAt = null,
}: {
  mealPlanItemId: string;
  mealTitle: string;
  cookedAt?: string | null;
}) {
  const [recipe, setRecipe] = useState<GeneratedMealRecipePayload | null>(null);
  const [generated, setGenerated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setError(null);
      try {
        const result = await generateMealPlanItemRecipeAction(mealPlanItemId);
        if (cancelled) return;
        if (!result.ok) {
          setError(result.error);
          return;
        }
        setGenerated(result.generated);
        setRecipe(result.recipe);
      } catch (err) {
        if (cancelled) return;
        setError(
          err instanceof Error ? err.message : "Recipe generation failed.",
        );
      } finally {
        if (!cancelled) setIsRetrying(false);
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [mealPlanItemId, retryKey]);

  if (recipe) {
    return (
      <RecipeView
        name={recipe.name}
        servings={recipe.servings}
        prepTimeMinutes={recipe.prepTimeMinutes}
        cookTimeMinutes={recipe.cookTimeMinutes}
        totalTimeMinutes={recipe.totalTimeMinutes}
        ingredientsText={recipe.ingredientsText}
        instructionsText={recipe.instructionsText}
        instructionSteps={recipe.instructionSteps}
        isFavorite={recipe.isFavorite}
        backHref="/panel/meals"
        backLabel="Back to meals"
        banner={generated ? "Freshly generated and saved" : null}
        mealPlanItemId={mealPlanItemId}
        cookedAt={cookedAt}
      />
    );
  }

  if (error) {
    return (
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
            Couldn’t generate this recipe
          </p>
          <p className="mt-2 text-sm leading-relaxed text-red-700 dark:text-red-300">
            {error}
          </p>
          <button
            type="button"
            className="mt-4 inline-flex min-h-11 items-center justify-center rounded-lg bg-neutral-900 px-4 text-sm font-medium text-white transition-colors hover:bg-neutral-800 disabled:opacity-60 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-white"
            onClick={() => {
              setError(null);
              setIsRetrying(true);
              setRetryKey((value) => value + 1);
            }}
            disabled={isRetrying}
          >
            {isRetrying ? "Retrying…" : "Try again"}
          </button>
        </div>
      </div>
    );
  }

  return <RecipeGeneratingState mealTitle={mealTitle} />;
}
