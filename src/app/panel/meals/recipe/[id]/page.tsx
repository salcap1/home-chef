import { notFound } from "next/navigation";

import { RecipeView } from "@/components/panel/recipe-view";
import { PanelShell } from "@/components/panel/ui";
import { loadRecipe } from "@/lib/panel/queries";

/** Recipe regeneration from feedback can exceed a short function timeout. */
export const maxDuration = 300;

export default async function RecipePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const recipe = await loadRecipe(id);

  if (!recipe) {
    notFound();
  }

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
        backHref="/panel/history"
        backLabel="Back to history"
      />
    </PanelShell>
  );
}
