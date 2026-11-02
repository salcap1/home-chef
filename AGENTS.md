<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->


# Household Chef — Project Specification

## 1. Product Mission

Build a personal AI household chef whose purpose is to eliminate the mental burden of deciding what to cook, remembering what the household likes, and maintaining a living grocery list — without forcing plan → list → shop workflows.

The product is a **kitchen ecosystem**: three parallel layers the household edits anytime (grocery list, optional meal batch, preferences). Weekly meal planning is one capability within that ecosystem, not the whole product.

The application is for one household consisting of two adults.

The primary interface is a passcode-protected web app at `/panel` for generating meals, conversationally editing the meal batch, managing grocery/preferences, cooking, and Harris Teeter per-item cart add.

The desired experience is:

> We use the app whenever we need something. It remembers everything important and gets better at helping us over time.

This is NOT a traditional meal-planning SaaS product for the public.

---

# 2. Core Product Philosophy

The most important product principle is:

> The agent manages the household's food knowledge. The humans should not have to manage the system.

The system should minimize mental effort.

Do not force users to:

* Track what food is on hand
* Enter expiration dates
* Browse recipes
* Maintain a meal calendar
* Update dashboards
* Manually categorize food
* Maintain a recipe database
* Learn complex commands

Natural language conversation in the panel chef chat is the primary way to edit kitchen state.

The household should be able to simply tell the chef what is happening.

Examples:

> We bought two pounds of chicken thighs.

> We finished the chicken.

> That was really good.

> Don't make that again.

> We're going out Thursday.

> Show this week's meals.

> Give me meal 2.

> Swap meal 2 for something with beef.

> Add milk to the grocery list.

> Remove avocados from the grocery list.

> What do we need from Harris Teeter?

> How much have you cost me this month?

The agent should understand these naturally.

## 2A. Kitchen Ecosystem Model

Maintain three parallel layers. The household may edit any layer without running a workflow:

| Layer | Meaning | Examples |
| --- | --- | --- |
| **Grocery list** | Things to buy (need) — persistent scratch pad | "Add mozz to the list" |
| **Meals** | Optional saved meal batch(es): CURRENT (+ at most one UPCOMING) | "Plan our week", "Plan next week", "Show this week's meals", "Add these groceries" |
| **Preferences** | Household taste and memory | "We don't like fish", favorites, notes |

Critical rules:

* Grocery tools only change what to buy. “We finished X” adds X to the grocery list. “We bought X” removes X from the grocery list if it is present.
* When asked to add to the grocery list, **add it**.
* Panel **Mark as cooked** records the meal and optional recipe feedback. It does not track what was used up.
* Adding groceries from a meal batch is optional. Panel **Build grocery list** and chef chat `generateGroceryList` replace the default Grocery category with that batch’s full ingredient list. Other categories stay. Each generation is a fresh list — nothing is stored as purchased or “already have,” and names already on the list are not skipped.
* The household may keep **one UPCOMING** batch while CURRENT is still cooking (panel “Plan next batch” / chef “plan next week”) for grocery foresight. **Finish** the current batch to archive it and promote upcoming to current. There is no lock step.
* Harris Teeter shopping is secondary — do not block other kitchen edits on cart issues. Panel **Shop** on default Grocery lines only; other household-created categories are organizational only.
* This product does **not** track on-hand inventory.

## 2B. Conversation Style

Minimize mental effort and back-and-forth:

* Execute requested edits immediately — avoid A/B/C option menus unless truly ambiguous.
* **Do not end replies with questions**, "let me know", "want me to…", or "anything else?" — state what you did and stop.
* Only ask a clarifying question when you literally cannot act (e.g. two equally valid items and no reasonable default).
* When uncertain, make a reasonable assumption rather than interrogating the user.

## 2C. Runtime Prompts vs This Document

`AGENTS.md` is the **developer specification**. It is **not** sent to the model at runtime.

Runtime Carmela behavior lives in `prompts/*.md`, loaded by `src/lib/ai/prompts/`. When changing how the chef talks or behaves in production, edit those prompt files (and deterministic TypeScript), and keep this document aligned for future development.

| File | Purpose |
| --- | --- |
| `chef-system.md` | Voice, layer rules, cut policy, reply style |
| `food-knowledge.md` | Canonical/cut/protein rules |
| `planning-workflow-base.md` | Meal batch workflow |
| `layer-hints.md` | Per-intent tool boundary hints |
| `recipe-generation.md` | Recipe generation template (grocery-safe ingredient names) |
| `recipe-tweak.md` | Surgical cooking-feedback patch (prefer patch over full rewrite) |
| `active-planning.md` | Snippet when a draft meal batch is active |

Deterministic logic (food matching, grocery math, lock validation) stays in TypeScript — not in prompts.

---

# 3. Technology Stack

Use the following stack unless there is a compelling technical reason to deviate.

## Application

* Next.js
* TypeScript
* App Router
* Vercel

## AI

* Vercel AI SDK
* Vercel AI Gateway
* Tool-based agent architecture

Use inexpensive models for simple tasks.

Use stronger models only when additional reasoning is actually valuable.

Model selection should be configurable rather than hard-coded throughout the application.

## Database

* Neon Postgres
* Drizzle ORM

Do NOT use Supabase.

Do NOT introduce a separate backend.

Do NOT introduce Redis initially.

Do NOT introduce a vector database initially.

Do NOT introduce a dedicated memory provider.

Postgres is the authoritative source of truth for household memory.

## Workflows

Use Vercel Workflow for durable multi-step workflows where appropriate.

Use Vercel Cron only when a scheduled process is actually required.

There are currently no proactive user notifications.

## Future grocery integration

The long-term grocery target is Harris Teeter's native online pickup checkout.

Do not implement checkout integration in the initial versions.

Do not use Instacart as the primary checkout target.

The grocery system should be provider-agnostic so a legitimate Harris Teeter integration can be added later.

---

# 4. Product Interfaces

The **passcode-protected web app at `/panel`** is the place to run kitchen workflows:

* Generate, edit (forms or in-app chef chat), and lock meal batches
* View recipes, cook, and mark meals cooked
* Manage grocery list (including merge from meals and Harris Teeter per-item shop)
* Manage preferences
* View meal history and AI cost

Do NOT build:

* Recipe browsing marketplace or public SaaS
* Drag-and-drop meal calendar
* Analytics dashboard beyond simple AI cost
* User profiles, roles, or multi-tenant account management
* Marketing or landing pages

The web application also runs backend infrastructure (OAuth, health). Panel mutations must call the same server-side services as the chef agent.

---

# 5. Cost Monitoring

AI cost tracking is required.

The household can view a simple summary in the panel (`/panel/cost`) or ask in chef chat:

> How much have you cost me this month?

Example:

> 💰 AI usage this month
>
> Total: $3.42
> Budget: $10.00
>
> Planning: $1.81
> Recipes: $0.94
> Conversation: $0.51

Track enough information to calculate this accurately.

Initially configure the budget through environment variables rather than building a settings interface.

Example:

AI_MONTHLY_BUDGET_USD=10

Enforce the monthly budget before model calls (chef chat, recipe generation, meal-batch planning). Also enforce optional site-wide `AI_GLOBAL_MONTHLY_BUDGET_USD` and per-kitchen chef chat rate limits (`AI_CHAT_HOURLY_LIMIT`, `AI_CHAT_DAILY_LIMIT`).

Do not build a graphical analytics dashboard beyond the simple cost summary.

Also set a spend limit on the Vercel AI Gateway dashboard as a last line of defense.

---

# 6. Authentication and Security

The git repo may be public. Protect `/panel` with **passcode accounts**: each passcode is one kitchen (`households.passcode_lookup` = HMAC of the passcode with `WEB_PANEL_SESSION_KEY`). No username. The signed session cookie embeds `householdId` so all panel data is scoped to that kitchen.

**Create account** on `/login` is public self-signup. UI-created kitchens are **demo kitchens**: `households.ai_chat_lifetime_limit` is set from `AI_SELF_SIGNUP_CHAT_LIMIT` (default 3). Demo kitchens cannot use Harris Teeter Shop / Kroger OAuth. Also enforce site-wide `AI_GLOBAL_MONTHLY_BUDGET_USD` on shared deploys.

**Full kitchens** (unlimited chat subject to monthly $ + rate limits, Shop allowed): provision with `scripts/create-household.ts` (optional per-kitchen `monthly_budget_usd`). `ai_chat_lifetime_limit` stays null.

Optional `WEB_PANEL_SECRET`: one-time bootstrap — first login matching it claims the oldest household that still has a null `passcode_lookup`.

Forks and local contributors must use their **own** Neon `DATABASE_URL`, `WEB_PANEL_SESSION_KEY`, AI Gateway auth, and (for Shop) Kroger developer app credentials. Do not point local env at production Neon or reuse production Kroger secrets. Do not run `npm run dev:vercel` unless you own the Vercel project.

Both people in the same kitchen share that kitchen’s:

* Meal plans
* Recipes
* Preferences
* Meal history
* Grocery lists
* Schedule

The system may record which household member provided information when useful, but household-wide preferences are the default.

Do not build a phone-number authentication system.

Do not store phone numbers unless a future requirement makes it necessary.

---

# 7. Household Preferences

Preferences are primarily household-wide.

Examples:

* Favorite cuisines
* Favorite proteins
* Disliked ingredients
* Favorite meals
* Meals we did not like
* Preferred cooking time
* Preferred serving size
* Preference for leftovers
* Preference for bulk cooking
* Typical breakfast
* Typical lunch
* Typical dinner
* Budget preferences
* Schedule constraints

The AI should distinguish between explicit and inferred preferences.

Explicit:

> We don't like fish.

Inferred:

> We have rejected salmon several times.

Do not turn weak inference into a strong permanent preference without sufficient evidence.

The household should be able to correct preferences naturally.

---

# 8. Household Inventory

This product does **not** track on-hand inventory. There are no inventory tables, tools, or panel pages.

Grocery-list phrases still apply:

> We bought chicken thighs.

→ Remove chicken thighs from the grocery list if present.

> We finished the chicken.

→ Add chicken thighs to the grocery list.

**Cut policy:** Same animal, different cut (pork chops vs pork tenderloin) are not interchangeable for recipes or meal titles. Never assume swaps.

---

# 10. Planned vs Actual Cooking

This is important.

Do not assume planned meals were actually cooked. Only persist cooked meals when the household marks them cooked in the panel or says they cooked them.

---

# 11. Perishable Food (User-Stated Only)

Do **not** track, infer, or nudge about "use soon", spoilage priority, or expiration dates.

The household will say verbally when something needs to be used (e.g. "use the spinach first"). Treat that as conversational context for that turn — not as a persisted system field or automatic planning priority.

Do not require expiration dates. Do not pretend to know exact spoilage timelines.

---

# 13. Recipe Generation

The AI should generate simple recipes itself.

Do NOT require a recipe API.

Recipes should prioritize:

* Simple ingredients
* Short preparation
* Approximately 30–45 minute dinners when possible
* Minimal dishes
* Family-sized portions
* Good leftovers
* Affordable ingredients
* Common grocery-store ingredients
* Ingredient reuse

The objective is not culinary sophistication.

The objective is:

> "This sounds easy and we'll actually make it."

A recipe should generally contain:

* Name
* Servings
* Prep time
* Cook time
* Total time
* Ingredients
* Instructions

Ingredient lines are also the grocery list. Persist **shopping names** (`chicken breasts`, `black beans`) and **simple amounts** (`3 lb`, `2 cans`). Do not put prep, parentheticals, "optional", or "divided" in the ingredient name or quantity. Do not list water, reserved cooking water, or leftovers from another meal. Cooking technique belongs in the steps. Deterministic sanitizing in TypeScript enforces this even when the model is sloppy.

Cooking tweaks (`Tweak recipe`, "make it crispier") apply a **patch** to the saved recipe when possible — change only the affected ingredients/steps. Full rewrite only when the cooking method or dish actually changes.

---

# 14. Household Favorite Recipes

Recipes that the household explicitly likes should be saved as household favorites.

The agent should be able to maintain a list of recipes that have been deemed successful.

Example:

> We loved that chicken.

The recipe should be marked as a household favorite.

The household should also be able to explicitly say:

> Save this recipe.

Favorite recipes are living documents. When the household gives cooking feedback ("make it crispier", "less Cajun", "double the sauce"), regenerate the saved recipe so ingredients and steps produce that result next time. Do **not** store a separate notes list or remind them what they said — the updated recipe is the memory.

Example:

> Make the creamy Cajun chicken less spicy next time.

→ Regenerate the recipe with milder seasoning baked into the ingredients and steps, then confirm with the updated recipe.

> Let's make the creamy Cajun chicken.

→ Return the current recipe as stored (already reflecting prior tweaks). Do not say "last time you noted…"

---

# 15. Meal Feedback

Feedback is conversational.

The user does not need to rate meals through a UI.

Examples:

> That was really good.

> We loved that.

> Don't make that again.

> That was okay.

> I loved the chicken but didn't like the sauce.

The agent should record useful feedback.

Feedback may apply to:

* Entire meal
* Recipe
* Ingredient
* Sauce
* Preparation method

Do not require formal ratings unless useful.

---

# 16. Meal Repetition

Do not enforce rigid repetition rules.

Use judgment based on:

* Recent meals
* Household favorites
* Variety
* Schedule
* Seasonality
* User feedback

A favorite meal may be repeated sooner.

A disliked or recently eaten meal should generally not be suggested again.

---

# 17. Breakfast

Breakfast is lower priority than dinner.

The household often eats the same breakfast repeatedly.

Support:

* Recurring breakfast
* Bulk breakfast
* Make-ahead breakfast
* Breakfast leftovers
* Occasional alternatives

The user can say:

> Ignore breakfast this week.

Breakfast should then be omitted from the active weekly planning process.

---

# 18. Lunch

Lunch should heavily leverage leftovers.

Do not create seven independent elaborate lunch recipes.

Prefer:

* Dinner leftovers
* Simple sandwiches
* Bowls
* Reheated meals
* Bulk lunches
* Minimal preparation

The agent should understand that dinner portions can intentionally become future lunches.

---

# 19. Dinner

Dinner receives the most planning attention.

Prioritize:

* Simple
* Quick
* Affordable
* Family-sized
* Good leftovers
* Minimal cleanup
* Common ingredients
* Ingredient reuse

Include at least some very easy options during busy weeks.

---

# 20. Leftovers (not tracked)

Do **not** maintain a separate leftovers / prepared-food inventory.

When scaling meal batches, prefer recipes that yield dinner + lunch portions (6–8 servings).

Do **not** suggest eating leftovers when the user asks for **meal ideas**.

The meal batch planner may intentionally relate meals (e.g. bulk chicken → tacos later), but leftover nudging is not a default suggestion behavior.

---

# 21. Meal Batch Planning

Weekly planning is **manual**. There is no proactive weekly notification.

The user initiates with "Plan our week" or similar.

## Flow

1. **Past meals** (optional) — include favorites/repeats in the batch
2. **Meal count** — how many bulk meals (typically ~4)
3. **Use these** — pantry/produce they want used (one-shot planning hint, not inventory)
4. **Meat picker** — proteins for the new slots
5. **Meal batch** — numbered list (**Meal 1**, **Meal 2**, …), each scaled for dinner + lunch leftovers (6–8 servings)
6. **Optional groceries** — rebuild the default Grocery category from a batch’s recipes; chef chat can do the same on request

## Planning inputs

The agent should consider:

1. Household preferences
2. Recent meals and favorites
3. Ingredients the household asked to use this batch
4. Schedule constraints
5. Desired variety and structural rules (meat variety, servings, menu caps from preferences)
6. Grocery requirements (optional, after recipes exist)

Breakfast and lunch are lower priority than dinner. Lunch should leverage leftovers and simple options — do not generate seven independent elaborate lunch recipes.

## Example output

> **Meal 1** — Honey garlic chicken (8 servings)
>
> **Meal 2** — Beef fried rice
>
> **Meal 3** — Easy quesadillas
>
> **Meal 4** — Burgers

Day assignment (Mon/Tue/…) is optional — the household picks from the batch unless they assign days.

The plan is conversational. Batches stay editable while active.

---

# 22. Meal Batch / Plan State

A meal batch (stored as a weekly plan) supports:

ACTIVE
COMPLETED

**CURRENT** = oldest active batch (what you’re cooking through).

**UPCOMING** = optional second active batch (planning ahead / grocery foresight).

Cap: at most two active plans. Completed plans are archived.

There is no “locked” state. Recipes generate when opened, cooked, or when adding groceries from a batch.

Real life can change — the household’s latest explicit decision takes precedence.

When a plan or recipe is saved, persist it in the database immediately.

Do NOT rely on chat history as the place to find recipes again.

---

# 22A. Finding Locked Recipes Again

Chat history is a bad recipe binder. Users must never need to scroll old chef chat to rediscover a weekly plan or a saved recipe.

Source of truth:

* Neon stores the weekly plan, each meal slot, and the full recipe content needed to cook it.
* The panel Meals page and chef chat are retrieval interfaces.

Primary retrieval (required):

The household can ask naturally in chef chat and get the recipe back:

> Show this week's meals.
>
> Give me meal 2.
>
> Give me the honey garlic chicken recipe.

The chef should respond with the full useful recipe — ingredients, steps, servings — not a vague reminder to look earlier in history.

Do NOT require browsing chat history.

The household should be able to tell the agent about schedule changes naturally.

Examples:

> We're going out Thursday.

> Wednesday is going to be crazy.

> We have friends over Saturday.

The agent should adapt meal planning accordingly.

Do not require a calendar UI.

---

# 24. "What Can We Make?"

The user can say:

> What can we make for dinner?

The agent should:

1. Consider preferences, favorites, and recent meals
2. Suggest simple meals
3. Shopping is expected for ingredients

This should work even when there is no active meal batch.

---

# 25. Meal Batch Recipe Retrieval

Once a meal batch is planned, the user should be able to simply ask:

> Show this week's meals.

or:

> Give me meal 2.

or:

> Give me the honey garlic chicken recipe.

The agent should retrieve the meal from the current batch in the database and show the full recipe.

Prior cooking tweaks should already be reflected in the stored recipe (regenerated when feedback was given) — do not recite old notes.

Example:

> Give me meal 1.

→

> Meal 1 is the honey garlic chicken (six servings for leftovers).
>
> Ingredients:
> ...
> Steps:
> ...

The user should not need to navigate anywhere or search prior messages.

The same pattern applies to any locked/favorite recipe by name or meal number. Meals are a numbered batch — not assigned to specific weeknights.

---

# 26. Grocery List

The grocery list is a **persistent scratch pad**. It may be built from a meal batch or edited conversationally at any time.

Items may be organized into **user-defined categories** (e.g. Costco, Amazon). Categories are UI organization only — not food taxonomy.

* Exactly one undeletable **default** category (named Grocery unless renamed) supports panel Harris Teeter **Shop**.
* Additional categories the household creates are never shopped via Harris Teeter.
* The household can create, rename, and delete non-default categories; deleting a category reassigns its items to Grocery.

When generated from a meal batch (`generateGroceryList` or panel **Build grocery list**):

Recipes
→ take the ingredients list **and** any step-only ingredients
→ sanitize to shopping names (strip prep/optional/parentheticals; drop water and leftover-from-another-meal lines)
→ normalize ingredients to canonical names
→ combine duplicates (merge recipe quantities for the grocery line)
→ **replace** the default Grocery category with that full list (other categories stay; do not skip names already listed)

Do NOT initially map items to specific store SKUs or package sizes.

When the user asks to add an item, add it.

The list should provide human-readable measurements.

Example:

* Chicken thighs — 2.5 lb
* Rice — 3 cups
* Broccoli — 2 heads
* Tortillas — 1 package
* Shredded cheese — 8 oz

The household can manage package sizes when shopping.

---

# 27. Grocery List Conversation

The grocery list is conversational.

Users should be able to say:

> Add coffee to the grocery list.

> Remove avocados.

> We already bought the milk.

> What do we need from Harris Teeter?

> What groceries are left?

The agent should update the grocery list accordingly — add when asked, remove when asked.

The grocery list may be associated with the current meal batch/week but remains editable independently.

---

# 28. Harris Teeter

The long-term goal is to eventually use the generated grocery list with Harris Teeter's native pickup checkout.

Do NOT implement checkout integration initially.

Do NOT store Harris Teeter passwords.

Do NOT scrape Harris Teeter.

Do NOT implement brittle browser automation.

Do not assume a public API exists.

When this phase is eventually reached, research legitimate supported integration options.

The internal grocery system must be provider-agnostic.

Conceptually:

GroceryProvider

Future implementation:

HarrisTeeterProvider

The meal-planning system should only understand a generic grocery list.

---

# 29. AI Tool Architecture

The AI should interact with the household database through typed tools.

Do not allow the model to execute arbitrary SQL.

Use application-controlled tools.

Potential tools include:

## Preferences

getPreferences()
savePreference()

## Meals

getRecentMeals()
getMealHistory()
getFavoriteRecipes()
saveMealFeedback()

## Recipes

generateRecipe()
saveFavoriteRecipe()
applyRecipeFeedback()
getRecipe()
modifyRecipe()

## Leftovers

Not tracked as a separate entity.

## Planning

createWeeklyPlan()
getCurrentWeeklyPlan()
modifyWeeklyPlan()
completeCurrentMealBatch()
generateGroceryList()

## Grocery

getGroceryList()
addGroceryItem()
removeGroceryItem()
generateGroceryList()

## Schedule

getSchedule()
addScheduleEvent()
removeScheduleEvent()

## Cost

getAICostSummary()

All tool inputs and outputs should be validated with Zod.

Business logic must remain outside the model.

---

# 30. AI Memory Strategy

The model should NOT receive the entire household history on every request.

Retrieve only relevant information.

Example:

User:

> Give me meal 2.

Potential retrieval:

* Current meal batch
* Meal 2 recipe (already reflecting past tweaks)
* Relevant leftovers

Do not retrieve the entire conversation history and recipe history unnecessarily.

User:

> Add eggs to the grocery list.

Only retrieve the information needed to perform the grocery update.

This reduces cost and improves reliability.

---

# 31. Conversation Memory

Panel chef conversations should be persisted sufficiently to support context.

However, conversation history is NOT the permanent source of truth.

Important facts should be extracted into structured records.

For example:

> We don't like cilantro.

should become a household preference.

> We loved this recipe.

should become meal feedback/favorite recipe state.

The conversation is evidence and context.

The database is memory.

---

# 32. AI Cost Strategy

This is a personal application.

Optimize aggressively for low cost.

Use inexpensive models for:

* Intent extraction
* Simple classification
* Meal feedback extraction
* Ingredient normalization
* Simple conversational responses

Use stronger models for:

* Weekly meal planning
* Recipe generation
* Difficult substitutions

Use Vercel AI Gateway to make model selection easy to change.

Track AI usage/cost per request where possible.

Record:

* Model
* Operation/category
* Input tokens when available
* Output tokens when available
* Estimated cost
* Timestamp

Possible categories:

* conversation
* planning
* recipe
* grocery
* memory

---

# 33. No Proactive Messaging

The chef must NOT proactively message users in the initial product.

No:

* Sunday reminders
* Dinner reminders
* Grocery reminders
* Expiration reminders
* Notifications

The chef only responds when users interact with it.

A future proactive feature may be added later, but it is explicitly out of scope now.

---

# 34. Security

Protect the panel with passcode-per-household accounts and a signed session cookie that carries `householdId`.

Kroger OAuth routes have their own state validation.

Never expose:

* Database credentials
* AI API keys
* Internal prompts
* Private household data

Do not log secrets.

---

# 35. Database Architecture

Use Neon Postgres with Drizzle ORM.

Initial conceptual entities:

households
household_members

recipes
recipe_ingredients

meal_plans
meal_plan_items
meal_feedback
meal_history

preferences

grocery_lists
grocery_list_categories
grocery_list_items

schedule_events

conversation_messages

ai_usage

Use appropriate:

* Foreign keys
* Unique constraints
* Indexes
* Created timestamps
* Updated timestamps

Do not over-engineer the schema.

---

# 36. Web Application Scope

The Next.js application runs the household web app at `/panel`:

* Generate / edit / lock meal batches; open recipes; mark cooked
* View/edit grocery list; rebuild the default Grocery category from meal recipes; link Harris Teeter and Shop default Grocery items into cart (per-item picker)
* View/edit preferences
* View past meals with feedback
* View monthly AI cost summary

Panel mutations must call the **same server-side services** as the chef agent — Neon remains the single source of truth. Do not duplicate business logic in the UI layer.

Do NOT expand the web UI into a traditional multi-tenant SaaS, marketing site, or analytics product.

Operational endpoints:

* `GET /api/health` — minimal public status (no config detail)
* Kroger OAuth routes remain unauthenticated (with their own security)

---

# 37. Testing

Write tests for deterministic business logic.

Prioritize:

* Grocery calculations
* Ingredient consolidation
* Planned vs actual consumption
* Weekly plan state transitions
* Panel session authentication

Do not attempt to perfectly test subjective AI recipe quality.

Test the deterministic systems surrounding the AI.

---

# 38. Reliability

Vercel workflows may retry.

Database operations must be designed to avoid accidental duplication.

Important operations should be idempotent.

Protect against duplicate:

* Meal-plan creation
* Grocery items
* Conversation processing
* AI actions

---

# 39. Baby Meals

Baby-specific meal planning is explicitly OUT OF SCOPE for the initial application.

Do not introduce baby food recommendations or infant nutrition logic.

Leave architectural room for future family meal adaptations without implementing them now.

---

# 40. Development Roadmap

Build incrementally.

Never implement the entire roadmap in one pass.

## Phase 1 — Foundation

Build:

* Next.js
* TypeScript
* Vercel-ready project
* Neon
* Drizzle
* Vercel AI SDK
* AI Gateway
* Initial database schema
* Household
* Household members
* Basic preferences
* Basic agent
* AI usage tracking

First end-to-end experience:

User sends:

> What can we make for dinner?

The agent retrieves household preferences from Neon and responds with a useful simple recommendation.

---

# Phase 2 — Household Memory

Implement:

* Preferences
* Meal history
* Favorite recipes
* Favorite recipes (living recipes — feedback regenerates content)
* Meal feedback
* Canonical food names and cut/protein awareness

Do NOT add pantry/fridge/freezer location tracking.

Do NOT add automated use-soon / freshness tracking — the household states perishability in conversation when relevant.

---

# Phase 3 — Recipes

Implement:

* AI recipe generation
* Recipe modification
* Favorite recipe storage
* Apply cooking feedback by regenerating the recipe (no notes list)
* Recipe / meal feedback
* Household recipe memory

---

# Phase 4 — Meal Batch Planning

Implement:

* Manual meal batch planning (meat picker)
* Numbered meal batch (~4 dinners, 6–8 servings each)
* Schedule awareness
* Proposed / active meal batches (CURRENT + optional UPCOMING)
* Optional grocery merge from batch recipes (no wipe)
* Recipe retrieval from the meal batch by name or meal number
* Runtime prompts in `prompts/*.md`

---

# Phase 5 — Grocery Lists

Implement:

* Ingredient normalization
* Grocery calculations
* Duplicate consolidation
* Add/remove grocery items conversationally
* Weekly grocery list

---

# Phase 6 — Harris Teeter

Research legitimate integration options for converting the household grocery list into a Harris Teeter pickup shopping experience.

Do not implement until earlier phases are stable.

Do not use unsupported scraping or credential automation.

---

# 41. Engineering Standards

Write production-quality TypeScript.

Use strict TypeScript.

Use Zod for external inputs and AI tool schemas.

Prefer simple architecture.

Do not add infrastructure without a demonstrated need.

Do not add dependencies without a reason.

Separate:

* Agent logic
* AI tools
* Business logic
* Database access
* Grocery provider logic
* Workflow logic

Keep business logic testable independently of the web UI and AI.

Keep the application deployable throughout development.

**Never leave deprecated code.** When removing a feature or concept, delete it fully: UI, domain logic, types, tests, docs, and schema (with a migration). Do not leave unused columns, shims, commented-out code, or parallel implementations.

---

# 42. Product Quality Bar

The final product should feel like:

> Someone who knows our household is taking care of food.

It should NOT feel like:

> ChatGPT generated seven recipes.

The system should improve as it is used.

It should remember:

* What we like
* What we dislike
* What meals we've eaten
* What recipes became favorites (with tweaks baked into the recipe)
* What we planned
* What actually happened
* What groceries we need

The user should be able to correct the agent naturally.

When reality differs from the plan, reality wins.

When the household changes its mind, the latest decision wins.

Replies should execute and stop — see §2B. Do not end every message with a follow-up question.

---

# 43. Current Task Rule

At the beginning of every development task:

1. Read AGENTS.md.
2. Read relevant runtime prompts in `prompts/` if changing chef behavior.
3. Inspect the existing repository.
4. Inspect existing database schema/migrations.
5. Inspect environment configuration.
6. Inspect existing documentation.
7. Understand existing architecture before changing it.

Do not blindly overwrite existing work.

When asked to implement a phase, implement only that phase.

Do not silently implement future phases.

After implementation:

1. Run tests.
2. Run TypeScript checks.
3. Run linting.
4. Run the production build.
5. Report what changed.
6. Report required environment variables.
7. Report setup steps.
8. Report anything incomplete.
9. Identify architectural decisions that may affect future phases.

Keep changes focused and easy to review.