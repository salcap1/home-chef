import { MealsBatchClient } from "@/components/panel/meals-batch";
import { PanelShell } from "@/components/panel/ui";
import {
  loadMealBatches,
  loadMeatPickerOptions,
  loadPastMealsForBatch,
} from "@/lib/panel/queries";

/** Lock may generate several recipes before merging groceries. */
export const maxDuration = 300;

function toDinnerViews(
  plan: NonNullable<Awaited<ReturnType<typeof loadMealBatches>>["current"]>,
) {
  return plan.items
    .filter((item) => item.mealType === "dinner")
    .sort(
      (a, b) =>
        a.sortOrder - b.sortOrder || a.mealDate.localeCompare(b.mealDate),
    )
    .map((item) => ({
      id: item.id,
      title: item.title,
      cookedAt: item.cookedAt?.toISOString() ?? null,
      hasRecipeIngredients: Boolean(item.recipe?.ingredientsText?.trim()),
    }));
}

function toPlanView(
  plan: NonNullable<Awaited<ReturnType<typeof loadMealBatches>>["current"]>,
) {
  return {
    id: plan.plan.id,
    title: plan.plan.title,
    weekStartDate: plan.plan.weekStartDate,
    status: plan.plan.status,
  };
}

export default async function MealsPage() {
  const [batches, meatPicker, pastMeals] = await Promise.all([
    loadMealBatches(),
    loadMeatPickerOptions(),
    loadPastMealsForBatch(),
  ]);

  return (
    <PanelShell active="/panel/meals" title="Meals">
      <MealsBatchClient
        currentPlan={
          batches.current ? toPlanView(batches.current) : null
        }
        currentItems={
          batches.current ? toDinnerViews(batches.current) : []
        }
        upcomingPlan={
          batches.upcoming ? toPlanView(batches.upcoming) : null
        }
        upcomingItems={
          batches.upcoming ? toDinnerViews(batches.upcoming) : []
        }
        meatOptions={meatPicker.options.map((option) => ({
          id: option.id,
          label: option.label,
        }))}
        pastMeals={pastMeals}
        pickCount={meatPicker.pickCount}
        defaultMealCount={meatPicker.defaultMealCount}
      />
    </PanelShell>
  );
}
