import { RecipeLoadingSkeleton } from "@/components/panel/recipe-view";
import { PanelShell } from "@/components/panel/ui";

export default function Loading() {
  return (
    <PanelShell active="/panel/meals" title="Recipe" hideTitle>
      <RecipeLoadingSkeleton />
    </PanelShell>
  );
}
