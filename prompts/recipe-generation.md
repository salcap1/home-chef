Generate a simple household dinner recipe.

Requirements:
- Easy, affordable, common grocery ingredients
- About 30-45 minutes when possible
- Scale to {{servingsTarget}} servings (dinner + lunch leftovers for two adults). Do NOT use 4 servings unless the household context explicitly asks for a different count.
- Minimal dishes
- Clear ingredients with shoppable quantities sized for {{servingsTarget}} servings
- Clear steps as an array of objects
- Prefer using items mentioned in household context when they fit. Missing ingredients are fine (they become grocery needs)

Ingredient format (critical — this list is also the grocery list):
- `name` is a short shopping name only. No prep, no parentheticals, no "optional", no "divided", no "or homemade", no "for serving".
  - Good: "chicken breasts", "black beans", "carrots", "garlic", "BBQ sauce"
  - Bad: "green cabbage, shredded", "pinto beans (canned, 15 oz)", "cilantro (optional, chopped)", "onion (medium, diced)", "pesto (store-bought or homemade)"
- `quantityText` is a simple shoppable amount. Number + unit only. Do NOT repeat the ingredient name. Do NOT add metric conversions, prep, or "divided".
  - Good: "3 lb", "2 cans", "12", "1 jar", "2 tbsp"
  - Bad: "2 lb (about 900 g) carrots, peeled and cut into 2-inch pieces", "3 cans (drained and rinsed)", "about 2 tbsp kosher salt, divided"
- Do NOT list: water, ice, reserved pasta water, boiling water, or "shredded chicken from Meal 1" leftovers
- Do NOT list garnish-only extras unless the household should actually buy them
- Put knife-work and technique in the step `text`, not in the ingredient name
- Prefer jarred garlic and bottled/pre-made sauces when household context asks for that

Step format (important for cooking from a phone):
- Each step has `text` (the action) and `ingredients` (what is used in that step)
- Put ALL amounts only in that step's `ingredients` array (`name` + `quantityText`) using the same shopping names as the ingredients list
- Step `text` must be short action language only — name the food when helpful, but NEVER include measurements, weights, volumes, counts, or parenthetical amounts in `text`
  - Good: "Toss the chicken with oil, salt, pepper, and paprika."
  - Bad: "Toss 6 chicken thighs with 1 Tbsp oil, 1 tsp salt…"
- For every ingredient added, mixed, seasoned, or cooked in a step, include it in that step's `ingredients` with the amount used in that step
- Pure technique steps with no ingredients (e.g. "Preheat the oven to 425°F") may use an empty ingredients array
- Do not number the step text (no "1." prefix)

User request:
{{userRequest}}

Household context:
{{context}}
