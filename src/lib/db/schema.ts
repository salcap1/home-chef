import { relations, sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import type { RecipeInstructionStep } from "@/lib/recipes/instruction-steps";

export const preferenceKindEnum = pgEnum("preference_kind", [
  "like",
  "dislike",
  "constraint",
  "note",
]);

export const preferenceStrengthEnum = pgEnum("preference_strength", [
  "explicit",
  "inferred",
]);

export const conversationRoleEnum = pgEnum("conversation_role", [
  "user",
  "assistant",
  "system",
]);

export const aiUsageCategoryEnum = pgEnum("ai_usage_category", [
  "conversation",
  "planning",
  "recipe",
  "grocery",
  "memory",
  "cost",
]);

export const mealFeedbackSentimentEnum = pgEnum("meal_feedback_sentiment", [
  "loved",
  "liked",
  "okay",
  "disliked",
  "never_again",
]);

export const mealFeedbackTargetEnum = pgEnum("meal_feedback_target", [
  "meal",
  "recipe",
  "ingredient",
  "sauce",
  "method",
  "other",
]);

export const mealPlanStatusEnum = pgEnum("meal_plan_status", [
  "active",
  "completed",
]);

export const mealSlotTypeEnum = pgEnum("meal_slot_type", [
  "breakfast",
  "lunch",
  "dinner",
]);

export const groceryListStatusEnum = pgEnum("grocery_list_status", [
  "active",
  "archived",
]);

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

export const households = pgTable(
  "households",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    /**
     * HMAC-SHA256 (base64url) of the household passcode with WEB_PANEL_SESSION_KEY.
     * Unique login key — no username; the passcode is the account.
     */
    passcodeLookup: text("passcode_lookup"),
    /** Per-household monthly AI budget (USD). Null → AI_MONTHLY_BUDGET_USD env default. */
    monthlyBudgetUsd: numeric("monthly_budget_usd", {
      precision: 12,
      scale: 2,
    }),
    /**
     * Lifetime user chef-chat message cap for demo / self-signup kitchens.
     * Null = unlimited (script-created full kitchens). Non-null also disables HT Shop.
     */
    aiChatLifetimeLimit: integer("ai_chat_lifetime_limit"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("households_passcode_lookup_uidx").on(table.passcodeLookup),
  ],
);

export const householdMembers = pgTable(
  "household_members",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    displayName: text("display_name"),
    ...timestamps,
  },
  (table) => [index("household_members_household_id_idx").on(table.householdId)],
);

export const recipes = pgTable(
  "recipes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    normalizedName: text("normalized_name").notNull(),
    servings: integer("servings"),
    summary: text("summary"),
    ingredientsText: text("ingredients_text"),
    instructionsText: text("instructions_text"),
    /** Structured steps with per-step ingredients for cook mode. */
    instructionSteps: jsonb("instruction_steps").$type<
      RecipeInstructionStep[] | null
    >(),
    prepTimeMinutes: integer("prep_time_minutes"),
    cookTimeMinutes: integer("cook_time_minutes"),
    totalTimeMinutes: integer("total_time_minutes"),
    isFavorite: boolean("is_favorite").notNull().default(false),
    timesCooked: integer("times_cooked").notNull().default(0),
    lastCookedAt: timestamp("last_cooked_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("recipes_household_normalized_name_uidx").on(
      table.householdId,
      table.normalizedName,
    ),
    index("recipes_household_favorite_idx").on(
      table.householdId,
      table.isFavorite,
    ),
  ],
);

export const mealHistory = pgTable(
  "meal_history",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    recipeId: uuid("recipe_id").references(() => recipes.id, {
      onDelete: "set null",
    }),
    memberId: uuid("member_id").references(() => householdMembers.id, {
      onDelete: "set null",
    }),
    name: text("name").notNull(),
    mealType: text("meal_type").notNull().default("dinner"),
    servingsText: text("servings_text"),
    wasPlanned: boolean("was_planned").notNull().default(false),
    actuallyCooked: boolean("actually_cooked").notNull().default(true),
    notes: text("notes"),
    cookedAt: timestamp("cooked_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("meal_history_household_cooked_idx").on(
      table.householdId,
      table.cookedAt,
    ),
  ],
);

export const mealFeedback = pgTable(
  "meal_feedback",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    recipeId: uuid("recipe_id").references(() => recipes.id, {
      onDelete: "set null",
    }),
    mealHistoryId: uuid("meal_history_id").references(() => mealHistory.id, {
      onDelete: "set null",
    }),
    memberId: uuid("member_id").references(() => householdMembers.id, {
      onDelete: "set null",
    }),
    sentiment: mealFeedbackSentimentEnum("sentiment").notNull(),
    target: mealFeedbackTargetEnum("target").notNull().default("meal"),
    targetDetail: text("target_detail"),
    feedbackText: text("feedback_text").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("meal_feedback_household_created_idx").on(
      table.householdId,
      table.createdAt,
    ),
  ],
);

export const mealPlans = pgTable(
  "meal_plans",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    weekStartDate: text("week_start_date").notNull(),
    status: mealPlanStatusEnum("status").notNull().default("active"),
    title: text("title"),
    notes: text("notes"),
    ...timestamps,
  },
  (table) => [
    index("meal_plans_household_week_idx").on(
      table.householdId,
      table.weekStartDate,
    ),
    index("meal_plans_household_status_idx").on(table.householdId, table.status),
  ],
);

export const mealPlanItems = pgTable(
  "meal_plan_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    mealPlanId: uuid("meal_plan_id")
      .notNull()
      .references(() => mealPlans.id, { onDelete: "cascade" }),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    mealDate: text("meal_date").notNull(),
    mealType: mealSlotTypeEnum("meal_type").notNull().default("dinner"),
    title: text("title").notNull(),
    recipeId: uuid("recipe_id").references(() => recipes.id, {
      onDelete: "set null",
    }),
    notes: text("notes"),
    sortOrder: integer("sort_order").notNull().default(0),
    ...timestamps,
  },
  (table) => [
    index("meal_plan_items_plan_date_idx").on(table.mealPlanId, table.mealDate),
  ],
);

export const scheduleEvents = pgTable(
  "schedule_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    eventDate: text("event_date").notNull(),
    title: text("title").notNull(),
    notes: text("notes"),
    skipDinner: boolean("skip_dinner").notNull().default(false),
    skipLunch: boolean("skip_lunch").notNull().default(false),
    skipBreakfast: boolean("skip_breakfast").notNull().default(false),
    ...timestamps,
  },
  (table) => [
    index("schedule_events_household_date_idx").on(
      table.householdId,
      table.eventDate,
    ),
  ],
);

export const groceryLists = pgTable(
  "grocery_lists",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    mealPlanId: uuid("meal_plan_id").references(() => mealPlans.id, {
      onDelete: "set null",
    }),
    status: groceryListStatusEnum("status").notNull().default("active"),
    title: text("title"),
    ...timestamps,
  },
  (table) => [
    index("grocery_lists_household_status_idx").on(
      table.householdId,
      table.status,
    ),
  ],
);

export const groceryListCategories = pgTable(
  "grocery_list_categories",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    isDefault: boolean("is_default").notNull().default(false),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("grocery_list_categories_household_name_uidx").on(
      table.householdId,
      table.name,
    ),
    uniqueIndex("grocery_list_categories_household_default_uidx")
      .on(table.householdId)
      .where(sql`${table.isDefault} = true`),
    index("grocery_list_categories_household_id_idx").on(table.householdId),
  ],
);

export const groceryListItems = pgTable(
  "grocery_list_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    groceryListId: uuid("grocery_list_id")
      .notNull()
      .references(() => groceryLists.id, { onDelete: "cascade" }),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => groceryListCategories.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    normalizedName: text("normalized_name").notNull(),
    quantityText: text("quantity_text"),
    notes: text("notes"),
    ...timestamps,
  },
  (table) => [
    index("grocery_list_items_list_idx").on(table.groceryListId),
    index("grocery_list_items_category_idx").on(table.categoryId),
    uniqueIndex("grocery_list_items_list_normalized_uidx").on(
      table.groceryListId,
      table.normalizedName,
    ),
  ],
);

export const preferences = pgTable(
  "preferences",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    kind: preferenceKindEnum("kind").notNull(),
    key: text("key").notNull(),
    value: text("value").notNull(),
    strength: preferenceStrengthEnum("strength").notNull().default("explicit"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("preferences_household_kind_key_uidx").on(
      table.householdId,
      table.kind,
      table.key,
    ),
    index("preferences_household_id_idx").on(table.householdId),
  ],
);

export const conversationMessages = pgTable(
  "conversation_messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    memberId: uuid("member_id").references(() => householdMembers.id, {
      onDelete: "set null",
    }),
    role: conversationRoleEnum("role").notNull(),
    content: text("content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("conversation_messages_household_created_idx").on(
      table.householdId,
      table.createdAt,
    ),
  ],
);

export const aiUsage = pgTable(
  "ai_usage",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    model: text("model").notNull(),
    category: aiUsageCategoryEnum("category").notNull().default("conversation"),
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    estimatedCostUsd: numeric("estimated_cost_usd", {
      precision: 12,
      scale: 6,
    })
      .notNull()
      .default("0"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("ai_usage_household_created_idx").on(
      table.householdId,
      table.createdAt,
    ),
  ],
);

/** OAuth tokens for Kroger / Harris Teeter cart integration (one per household). */
export const krogerConnections = pgTable(
  "kroger_connections",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    accessToken: text("access_token").notNull(),
    refreshToken: text("refresh_token").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    locationId: text("location_id").notNull(),
    locationName: text("location_name"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("kroger_connections_household_id_uidx").on(table.householdId),
  ],
);

/**
 * Purchase memory for Harris Teeter / Kroger product selection.
 * Official API has no order history — we learn from cart adds, user picks,
 * and explicit "I bought X" confirmations. Sale preference is household-wide.
 */
export const groceryProductPreferences = pgTable(
  "grocery_product_preferences",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    normalizedName: text("normalized_name").notNull(),
    preferredUpc: text("preferred_upc").notNull(),
    preferredBrand: text("preferred_brand"),
    productDescription: text("product_description"),
    /** How this memory was learned: user_pick | cart_add | purchase */
    source: text("source").notNull().default("cart_add"),
    /** Soft lock: when true, prefer this brand even over a competing sale item */
    brandLocked: boolean("brand_locked").notNull().default(false),
    timesChosen: integer("times_chosen").notNull().default(1),
    lastChosenAt: timestamp("last_chosen_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("grocery_product_prefs_household_name_uidx").on(
      table.householdId,
      table.normalizedName,
    ),
    index("grocery_product_prefs_household_id_idx").on(table.householdId),
  ],
);

/** Short-lived OAuth state → household mapping for Kroger login flow. */
export const krogerOauthStates = pgTable(
  "kroger_oauth_states",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    stateToken: text("state_token").notNull(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("kroger_oauth_states_token_uidx").on(table.stateToken),
    index("kroger_oauth_states_expires_idx").on(table.expiresAt),
  ],
);

export const householdsRelations = relations(households, ({ many }) => ({
  members: many(householdMembers),
  recipes: many(recipes),
  mealHistory: many(mealHistory),
  mealPlans: many(mealPlans),
  groceryLists: many(groceryLists),
  groceryListCategories: many(groceryListCategories),
  scheduleEvents: many(scheduleEvents),
  preferences: many(preferences),
  conversationMessages: many(conversationMessages),
  aiUsage: many(aiUsage),
}));

export const householdMembersRelations = relations(
  householdMembers,
  ({ one }) => ({
    household: one(households, {
      fields: [householdMembers.householdId],
      references: [households.id],
    }),
  }),
);

export const mealPlansRelations = relations(mealPlans, ({ many }) => ({
  items: many(mealPlanItems),
}));

export type Household = typeof households.$inferSelect;
export type HouseholdMember = typeof householdMembers.$inferSelect;
export type Recipe = typeof recipes.$inferSelect;
export type MealHistory = typeof mealHistory.$inferSelect;
export type MealFeedback = typeof mealFeedback.$inferSelect;
export type MealPlan = typeof mealPlans.$inferSelect;
export type MealPlanItem = typeof mealPlanItems.$inferSelect;
export type ScheduleEvent = typeof scheduleEvents.$inferSelect;
export type GroceryList = typeof groceryLists.$inferSelect;
export type GroceryListCategory = typeof groceryListCategories.$inferSelect;
export type GroceryListItem = typeof groceryListItems.$inferSelect;
export type Preference = typeof preferences.$inferSelect;
export type ConversationMessage = typeof conversationMessages.$inferSelect;
export type AiUsage = typeof aiUsage.$inferSelect;
export type KrogerConnection = typeof krogerConnections.$inferSelect;
export type KrogerOauthState = typeof krogerOauthStates.$inferSelect;
export type GroceryProductPreference =
  typeof groceryProductPreferences.$inferSelect;
