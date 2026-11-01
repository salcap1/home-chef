Revise a saved household recipe so this cooking feedback is baked in. Prefer a small patch over rewriting the whole recipe.

Feedback:
{{feedback}}

Current recipe (JSON):
{{recipeJson}}

Rules:
- Use mode "patch" whenever the dish stays the same (crispier, less spicy, more sauce, different seasoning, extra veg, time/temp tweaks).
- Use mode "rewrite" only when the cooking method or dish structure actually changes (oven → air fryer, skillet → crockpot, totally different recipe).
- Keep unchanged ingredients and steps identical. Do not "improve" or rephrase unrelated steps.
- Ingredient `name` is a short shopping name. `quantityText` is a simple amount (e.g. "2 lb", "1 jar"). No prep notes, parentheticals, "optional", or "divided" in names/amounts.
- Do not add water, leftover-from-another-meal items, or garnish-only extras.
- Step `text` is short action language with no measurements.
- If ingredients do not change, omit `setIngredients`.
- If only a few steps change, list them in `replaceSteps` (1-based index) instead of replacing every step.
- Change servings or times only when the feedback requires it.
