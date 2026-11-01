import { tool } from "ai";
import { z } from "zod";

import type { HouseholdToolContext } from "@/lib/ai/tools/context";
import { getEnv } from "@/lib/env";
import {
  addDaysToIsoDate,
  dateInTimeZone,
  mondayOfWeek,
} from "@/lib/grocery/calculate";
import {
  addGroceryItem,
  addScheduleEvent,
  completeCurrentMealBatch,
  createWeeklyPlan,
  clearGroceryList,
  getActiveGroceryList,
  getCurrentWeeklyPlan,
  getEditableWeeklyPlan,
  getUpcomingWeeklyPlan,
  listScheduleEvents,
  mergeGroceriesFromMealPlan,
  modifyWeeklyPlanItem,
  moveGroceryItem,
  prepareSlotForNewMealBatch,
  removeGroceryItem,
  removeGroceryItems,
  removeScheduleEvent,
  setGroceryList,
  tidyGroceryList,
} from "@/lib/planning/service";
import {
  createGroceryCategory,
  deleteGroceryCategory,
  listGroceryCategories,
  renameGroceryCategory,
} from "@/lib/planning/grocery-categories";
import {
  formatHouseholdGroceryList,
  formatWeeklyPlan,
} from "@/lib/kitchen/format";
import { getRecentMeals } from "@/lib/meals/service";
import {
  formatMeatOptions,
  proposeWeeklyMeatOptions,
} from "@/lib/planning/meat-options";
import { listPreferences } from "@/lib/preferences/service";
import {
  buildPlanningProfile,
  formatStructuralPlanningRulesForPrompt,
  validateWeeklyDinners,
} from "@/lib/preferences/planning-rules";

async function validatePlanForHousehold(
  householdId: string,
  items: Array<{ title: string; mealType?: string; mealDate?: string }>,
) {
  const prefs = await listPreferences(householdId);
  const profile = buildPlanningProfile(prefs);
  const dinners = items.filter(
    (item) => (item.mealType ?? "dinner") === "dinner",
  );
  const violations = validateWeeklyDinners({ profile, dinners });
  return {
    violations,
    planningRules: formatStructuralPlanningRulesForPrompt(prefs),
  };
}

const mealTypeSchema = z.enum(["breakfast", "lunch", "dinner"]);

export function createPlanningTools(ctx: HouseholdToolContext) {
  const tz = getEnv().HOUSEHOLD_TIMEZONE;

  return {
    proposeWeeklyMeatOptions: tool({
      description:
        "Step 1 of weekly planning: show 5–7 random meat/protein options for the household to pick from (usually 3). Call this when starting a new week before proposing meals.",
      inputSchema: z.object({
        optionCount: z
          .number()
          .int()
          .min(5)
          .max(7)
          .optional()
          .describe("How many options to show; defaults to random 5–7"),
      }),
      execute: async (input) => {
        const [prefs, recentMeals] = await Promise.all([
          listPreferences(ctx.householdId),
          getRecentMeals(ctx.householdId, 12),
        ]);
        const profile = buildPlanningProfile(prefs);
        const excludeSeafood = prefs.some(
          (pref) =>
            /exclude fish|do not include fish|no fish/i.test(
              `${pref.key} ${pref.value}`,
            ),
          );
        const options = proposeWeeklyMeatOptions({
          optionCount: input.optionCount,
          recentMealTitles: recentMeals.map((meal) => meal.name),
          excludeSeafood,
        });
        const pickCount = profile.maxDistinctMeats ?? 3;
        return {
          ok: true,
          pickCount,
          options: options.map((option) => option.label),
          formatted: formatMeatOptions(options, pickCount),
          instruction: `Wait for the household to pick ${pickCount} meats before proposing meals or asking meal count.`,
        };
      },
    }),

    createWeeklyPlan: tool({
      description:
        "Create a meal batch. With no active batch, creates CURRENT. With one active, creates UPCOMING (at most two). With two actives, set replaceExisting to replace UPCOMING. Ask about ingredients to use up (pantry/produce) and how many meals before proposing. MUST follow structural planning rules. Meals are a numbered list — not tied to weekdays unless the user wants that.",
      inputSchema: z.object({
        weekStartDate: z
          .string()
          .optional()
          .describe("Monday YYYY-MM-DD; defaults to current week"),
        title: z.string().optional(),
        notes: z
          .string()
          .optional()
          .describe(
            "Include Use: item1, item2 when the household named pantry/produce to use up",
          ),
        replaceExisting: z
          .boolean()
          .optional()
          .describe(
            "True to replace the sole CURRENT batch, or replace UPCOMING when two batches exist. Omit/false to plan ahead as UPCOMING when one batch exists.",
          ),
        items: z.array(
          z.object({
            mealDate: z
              .string()
              .optional()
              .describe("Optional YYYY-MM-DD — omit for a dayless meal batch"),
            mealType: mealTypeSchema.default("dinner"),
            title: z.string(),
            recipeName: z.string().optional(),
            notes: z.string().optional(),
          }),
        ),
      }),
      execute: async (input) => {
        const slot = await prepareSlotForNewMealBatch(ctx.householdId, {
          replaceExisting: input.replaceExisting ?? false,
        });
        if (!slot.ok) {
          return {
            ok: false,
            error: slot.error,
            needsReplaceConfirm: true,
            mode: slot.mode,
          };
        }

        const weekStart =
          input.weekStartDate ?? mondayOfWeek(new Date(), tz);
        const validation = await validatePlanForHousehold(
          ctx.householdId,
          input.items,
        );
        const created = await createWeeklyPlan({
          householdId: ctx.householdId,
          weekStartDate: weekStart,
          title: input.title,
          notes: input.notes,
          status: "active",
          items: input.items.map((item, index) => ({
            ...item,
            mealDate:
              item.mealDate ?? addDaysToIsoDate(weekStart, index),
          })),
        });
        return {
          ok: true,
          planId: created.plan.id,
          mode: slot.mode,
          role:
            slot.mode === "create_upcoming" || slot.mode === "replace_upcoming"
              ? "upcoming"
              : "current",
          formatted: formatWeeklyPlan(created.plan, created.items),
          planningViolations: validation.violations,
          ...(validation.violations.length > 0
            ? {
                warning:
                  "Plan saved but violates household meal-planning rules — revise before presenting.",
              }
            : {}),
        };
      },
    }),

    getCurrentWeeklyPlan: tool({
      description:
        "Get CURRENT (oldest active) and optional UPCOMING (second active) meal batches. Cap is two active batches.",
      inputSchema: z.object({}),
      execute: async () => {
        const [current, upcoming] = await Promise.all([
          getCurrentWeeklyPlan(ctx.householdId),
          getUpcomingWeeklyPlan(ctx.householdId),
        ]);
        if (!current && !upcoming) {
          return { ok: false, error: "No weekly plan yet." };
        }
        return {
          ok: true,
          current: current
            ? {
                planId: current.plan.id,
                status: current.plan.status,
                role: "current",
                formatted: formatWeeklyPlan(current.plan, current.items),
              }
            : null,
          upcoming: upcoming
            ? {
                planId: upcoming.plan.id,
                status: upcoming.plan.status,
                role: "upcoming",
                formatted: formatWeeklyPlan(upcoming.plan, upcoming.items),
              }
            : null,
        };
      },
    }),

    modifyWeeklyPlan: tool({
      description:
        "Change, add, or remove a meal on the preferred edit batch (UPCOMING if present, else CURRENT). Prefer mealNumber (Meal 1, Meal 2, …). mealDate is optional fallback. Must keep the batch compliant with household meal-planning rules.",
      inputSchema: z.object({
        mealNumber: z
          .number()
          .int()
          .positive()
          .optional()
          .describe("1-based Meal N from the editable batch list"),
        mealDate: z
          .string()
          .optional()
          .describe("YYYY-MM-DD slot date — use when mealNumber is unknown"),
        mealType: mealTypeSchema.default("dinner"),
        title: z.string().optional(),
        notes: z.string().optional(),
        recipeName: z.string().optional(),
        remove: z.boolean().optional(),
      }),
      execute: async (input) => {
        if (input.mealNumber == null && !input.mealDate?.trim()) {
          return {
            ok: false,
            error: "Provide mealNumber (preferred) or mealDate.",
          };
        }
        const item = await modifyWeeklyPlanItem({
          householdId: ctx.householdId,
          mealNumber: input.mealNumber,
          mealDate: input.mealDate,
          mealType: input.mealType,
          title: input.title,
          notes: input.notes,
          recipeName: input.recipeName,
          remove: input.remove,
        });
        if (!item) {
          return { ok: false, error: "No weekly plan/item to modify." };
        }
        const editable = await getEditableWeeklyPlan(ctx.householdId);
        const validation = editable
          ? await validatePlanForHousehold(ctx.householdId, editable.items)
          : { violations: [], planningRules: "" };
        return {
          ok: true,
          formatted: editable
            ? formatWeeklyPlan(editable.plan, editable.items)
            : item.title,
          planningViolations: validation.violations,
        };
      },
    }),

    generateGroceryList: tool({
      description:
        "Optional: generate missing recipes for a meal batch and replace the default Grocery category with that batch's full ingredient list. Other categories stay. Each generation is a fresh list. Defaults to CURRENT batch.",
      inputSchema: z.object({
        mealPlanId: z
          .string()
          .optional()
          .describe("Optional plan id; defaults to CURRENT"),
      }),
      execute: async (input) => {
        const merged = await mergeGroceriesFromMealPlan(
          ctx.householdId,
          input.mealPlanId,
        );
        if (!merged) {
          return { ok: false, error: "No meal batch to build groceries from." };
        }
        return {
          ok: true,
          recipesGenerated: merged.recipesGenerated,
          mealsMissingRecipes: merged.mealsMissingRecipes,
          added: merged.added,
          groceryCount: merged.groceryItems.length,
          groceryFormatted: await formatHouseholdGroceryList(
            ctx.householdId,
            merged.groceryItems,
          ),
        };
      },
    }),

    completeCurrentMealBatch: tool({
      description:
        "Finish the CURRENT meal batch (archive it). If UPCOMING exists, it becomes the new CURRENT.",
      inputSchema: z.object({}),
      execute: async () => {
        const completed = await completeCurrentMealBatch(ctx.householdId);
        if (!completed) {
          return { ok: false, error: "No current meal batch to finish." };
        }
        const [current, upcoming] = await Promise.all([
          getCurrentWeeklyPlan(ctx.householdId),
          getUpcomingWeeklyPlan(ctx.householdId),
        ]);
        return {
          ok: true,
          completedPlanId: completed.id,
          current: current
            ? formatWeeklyPlan(current.plan, current.items)
            : null,
          upcoming: upcoming
            ? formatWeeklyPlan(upcoming.plan, upcoming.items)
            : null,
        };
      },
    }),
    getSchedule: tool({
      description: "Get upcoming household schedule constraints for planning.",
      inputSchema: z.object({}),
      execute: async () => {
        const start = mondayOfWeek(new Date(), tz);
        const events = await listScheduleEvents(
          ctx.householdId,
          start,
          addDaysToIsoDate(start, 14),
        );
        return {
          today: dateInTimeZone(new Date(), tz),
          weekStart: start,
          events: events.map((event) => ({
            date: event.eventDate,
            title: event.title,
            notes: event.notes,
            skipDinner: event.skipDinner,
            skipLunch: event.skipLunch,
            skipBreakfast: event.skipBreakfast,
          })),
        };
      },
    }),

    addScheduleEvent: tool({
      description: "Record a schedule constraint like going out or busy night.",
      inputSchema: z.object({
        eventDate: z.string(),
        title: z.string(),
        notes: z.string().optional(),
        skipDinner: z.boolean().default(false),
        skipLunch: z.boolean().default(false),
        skipBreakfast: z.boolean().default(false),
      }),
      execute: async (input) => {
        const event = await addScheduleEvent({
          householdId: ctx.householdId,
          ...input,
        });
        return { ok: true, event };
      },
    }),

    removeScheduleEvent: tool({
      description: "Remove a schedule event by date (and optional title).",
      inputSchema: z.object({
        eventDate: z.string(),
        title: z.string().optional(),
      }),
      execute: async (input) => {
        const removed = await removeScheduleEvent(
          ctx.householdId,
          input.eventDate,
          input.title,
        );
        return { ok: removed > 0, removed };
      },
    }),

    getGroceryList: tool({
      description:
        "Get the active grocery list (things TO BUY at the store), grouped by category. The default Grocery category is what panel Harris Teeter Shop uses.",
      inputSchema: z.object({}),
      execute: async () => {
        const active = await getActiveGroceryList(ctx.householdId);
        if (!active) return { ok: true, formatted: "Grocery list is empty.", items: [] };
        return {
          ok: true,
          formatted: await formatHouseholdGroceryList(
            ctx.householdId,
            active.items,
          ),
          remaining: active.items.length,
        };
      },
    }),

    addGroceryItem: tool({
      description:
        "Add an item to the grocery list (things TO BUY). Optional category places it in a user category (e.g. Costco, Amazon); default is Grocery (panel HT Shop). Always use this when the user asks to add to the grocery/shopping list.",
      inputSchema: z.object({
        name: z.string(),
        quantityText: z.string().optional(),
        notes: z.string().optional(),
        category: z
          .string()
          .optional()
          .describe("Category name (must already exist). Defaults to Grocery."),
      }),
      execute: async (input) => {
        const item = await addGroceryItem({
          householdId: ctx.householdId,
          ...input,
        });
        return { ok: true, item };
      },
    }),

    removeGroceryItem: tool({
      description:
        "Remove one item from the grocery/shopping list. Use removeGroceryItems for multiple.",
      inputSchema: z.object({ name: z.string() }),
      execute: async (input) => {
        const removed = await removeGroceryItem(ctx.householdId, input.name);
        return { ok: removed };
      },
    }),

    removeGroceryItems: tool({
      description:
        "Remove multiple items from the grocery/shopping list in one call. Use when the user lists several items to remove.",
      inputSchema: z.object({
        names: z.array(z.string()).min(1),
      }),
      execute: async (input) => {
        const result = await removeGroceryItems(ctx.householdId, input.names);
        const active = await getActiveGroceryList(ctx.householdId);
        return {
          ok: true,
          ...result,
          formatted: await formatHouseholdGroceryList(
            ctx.householdId,
            active?.items ?? [],
          ),
        };
      },
    }),

    setGroceryList: tool({
      description:
        "Replace items in the default Grocery category only (what panel Harris Teeter Shop uses). Other categories are preserved. Use when the user wants a clean definitive shopping list.",
      inputSchema: z.object({
        items: z.array(
          z.object({
            name: z.string(),
            quantityText: z.string().optional(),
          }),
        ),
      }),
      execute: async (input) => {
        const result = await setGroceryList(ctx.householdId, input.items);
        return {
          ok: true,
          count: result.items.length,
          formatted: await formatHouseholdGroceryList(
            ctx.householdId,
            result.items,
          ),
        };
      },
    }),

    clearGroceryList: tool({
      description:
        "Clear the default Grocery category only (what panel Harris Teeter Shop uses). Other categories are untouched. Optionally keep only specific items in Grocery.",
      inputSchema: z.object({
        keepOnly: z
          .array(z.string())
          .optional()
          .describe("Item names to keep in Grocery; everything else in Grocery is removed"),
      }),
      execute: async (input) => {
        const result = await clearGroceryList(
          ctx.householdId,
          input.keepOnly ?? [],
        );
        return {
          ok: true,
          removed: result.removed,
          formatted: await formatHouseholdGroceryList(
            ctx.householdId,
            result.items,
          ),
        };
      },
    }),

    tidyGroceryList: tool({
      description:
        "Clean the grocery list: collapse duplicates and remove catalog-variant junk lines (organic/sale/store-brand alternatives).",
      inputSchema: z.object({}),
      execute: async () => {
        const result = await tidyGroceryList(ctx.householdId);
        return {
          ok: true,
          merged: result.merged,
          removed: result.removed,
          formatted: await formatHouseholdGroceryList(
            ctx.householdId,
            result.items,
          ),
        };
      },
    }),

    listGroceryCategories: tool({
      description:
        "List grocery list organization categories. The default Grocery category cannot be deleted and is what panel Harris Teeter Shop uses.",
      inputSchema: z.object({}),
      execute: async () => {
        const categories = await listGroceryCategories(ctx.householdId);
        return {
          ok: true,
          categories: categories.map((category) => ({
            id: category.id,
            name: category.name,
            isDefault: category.isDefault,
          })),
        };
      },
    }),

    createGroceryCategory: tool({
      description:
        "Create a new grocery list category for organization (e.g. Costco, Amazon). Does not invent categories unless the user asks.",
      inputSchema: z.object({ name: z.string() }),
      execute: async (input) => {
        try {
          const category = await createGroceryCategory({
            householdId: ctx.householdId,
            name: input.name,
          });
          return { ok: true, category };
        } catch (error) {
          return {
            ok: false,
            error: error instanceof Error ? error.message : "Failed to create category.",
          };
        }
      },
    }),

    renameGroceryCategory: tool({
      description: "Rename a grocery list category (including the default Grocery name if desired).",
      inputSchema: z.object({
        category: z.string().describe("Current category name or id"),
        newName: z.string(),
      }),
      execute: async (input) => {
        const categories = await listGroceryCategories(ctx.householdId);
        const target =
          categories.find((c) => c.id === input.category) ??
          categories.find(
            (c) => c.name.toLowerCase() === input.category.trim().toLowerCase(),
          );
        if (!target) return { ok: false, error: "Category not found." };
        try {
          const category = await renameGroceryCategory({
            householdId: ctx.householdId,
            categoryId: target.id,
            name: input.newName,
          });
          return { ok: Boolean(category), category };
        } catch (error) {
          return {
            ok: false,
            error: error instanceof Error ? error.message : "Failed to rename.",
          };
        }
      },
    }),

    deleteGroceryCategory: tool({
      description:
        "Delete a non-default grocery category. Items in it move to Grocery. Cannot delete the default Grocery category.",
      inputSchema: z.object({
        category: z.string().describe("Category name or id"),
      }),
      execute: async (input) => {
        const categories = await listGroceryCategories(ctx.householdId);
        const target =
          categories.find((c) => c.id === input.category) ??
          categories.find(
            (c) => c.name.toLowerCase() === input.category.trim().toLowerCase(),
          );
        if (!target) return { ok: false, error: "Category not found." };
        return deleteGroceryCategory({
          householdId: ctx.householdId,
          categoryId: target.id,
        });
      },
    }),

    moveGroceryItem: tool({
      description:
        "Move an existing grocery list item into a category (e.g. move paper towels to Amazon).",
      inputSchema: z.object({
        name: z.string(),
        category: z.string(),
      }),
      execute: async (input) => {
        try {
          const item = await moveGroceryItem({
            householdId: ctx.householdId,
            name: input.name,
            category: input.category,
          });
          return { ok: Boolean(item), item };
        } catch (error) {
          return {
            ok: false,
            error: error instanceof Error ? error.message : "Failed to move item.",
          };
        }
      },
    }),
  };
}
