import { notFound } from "next/navigation";

import { MealRecipeGenerator } from "@/components/panel/meal-recipe-generator";
import { RecipeView } from "@/components/panel/recipe-view";
import { PanelShell } from "@/components/panel/ui";
import { loadMealPlanItemRecipe } from "@/lib/panel/queries";

/** Recipe generation / tweak can exceed a short function timeout. */
export const maxDuration = 300;

export default async function MealItemRecipePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await loadMealPlanItemRecipe(id);

  if (!data) {
    notFound();
  }

  const { item, recipe, ready } = data;

  if (ready && recipe) {
    return (
      <PanelShell active="/panel/meals" title={recipe.name} hideTitle>
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
          backLabel="Back"
          mealPlanItemId={item.id}
          cookedAt={data.cookedAt?.toISOString() ?? null}
        />
      </PanelShell>
    );
  }

  return (
    <PanelShell active="/panel/meals" title={item.title} hideTitle>
      <MealRecipeGenerator
        mealPlanItemId={item.id}
        mealTitle={item.title}
        cookedAt={data.cookedAt?.toISOString() ?? null}
      />
    </PanelShell>
  );
}
