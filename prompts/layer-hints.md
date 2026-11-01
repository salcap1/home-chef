## grocery_list

User is editing the GROCERY LIST (to buy). Use grocery-list tools only. Categories are organizational only; do not invent them. Default Grocery is what panel Harris Teeter Shop uses.

## meals

User is working on MEALS / plan context. Do not rebuild the grocery list unless they ask (generateGroceryList replaces the default Grocery category with that batch's full ingredient list; other categories stay).

## recipe

User wants a RECIPE or cooking guidance. Read kitchen state; suggest adding to grocery list only if they ask.

## preference

User is stating a PREFERENCE. Save it; leave the grocery list unchanged unless they say otherwise.

## general

General request — respect layer boundaries: grocery list = need to buy; meals = the current batch.
