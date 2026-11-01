import { GroceryExtrasClient } from "@/components/panel/grocery-extras";
import { GroceryListClient } from "@/components/panel/grocery-list";
import { PanelShell } from "@/components/panel/ui";
import { loadGroceries } from "@/lib/panel/queries";

export default async function GroceriesPage() {
  const { items, categories, harrisTeeter } = await loadGroceries();
  const sorted = [...items]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((item) => ({
      id: item.id,
      name: item.name,
      quantityText: item.quantityText,
      categoryId: item.categoryId,
    }));

  return (
    <PanelShell active="/panel/groceries" title="Grocery list" hideTitle>
      <GroceryExtrasClient harrisTeeter={harrisTeeter} />
      <GroceryListClient
        initialItems={sorted}
        initialCategories={categories.map((category) => ({
          id: category.id,
          name: category.name,
          isDefault: category.isDefault,
          sortOrder: category.sortOrder,
        }))}
        harrisTeeterLinked={harrisTeeter.linked}
      />
    </PanelShell>
  );
}
