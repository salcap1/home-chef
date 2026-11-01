import { tool } from "ai";
import { z } from "zod";

import {
  listPreferences,
  removePreference,
  savePreference,
  type PreferenceKind,
  type PreferenceStrength,
} from "@/lib/preferences/service";

import type { HouseholdToolContext } from "@/lib/ai/tools/context";

const kindSchema = z.enum(["like", "dislike", "constraint", "note"]);
const strengthSchema = z.enum(["explicit", "inferred"]);

export function createPreferenceTools(ctx: HouseholdToolContext) {
  return {
    getPreferences: tool({
      description: "Get household food preferences, likes, and dislikes.",
      inputSchema: z.object({}),
      execute: async () => {
        const items = await listPreferences(ctx.householdId);
        return {
          count: items.length,
          preferences: items.map((item) => ({
            kind: item.kind,
            key: item.key,
            value: item.value,
            strength: item.strength,
          })),
        };
      },
    }),

    savePreference: tool({
      description:
        "Save or update a household preference. Use kind=constraint or note for weekly meal-planning rules (meals per week, meat caps, servings, menu structure). Use like/dislike for ingredient/food preferences. Put the full preference text in value — there is no separate notes field.",
      inputSchema: z.object({
        kind: kindSchema,
        key: z
          .string()
          .min(1)
          .describe(
            "Short key — planning examples: weekly bulk meals, max meats per week, servings per meal, max pork per week; food examples: cilantro, olives",
          ),
        value: z.string().min(1),
        strength: strengthSchema.default("explicit"),
      }),
      execute: async (input) => {
        const saved = await savePreference({
          householdId: ctx.householdId,
          kind: input.kind as PreferenceKind,
          key: input.key,
          value: input.value,
          strength: input.strength as PreferenceStrength,
        });

        return {
          ok: true,
          preference: {
            kind: saved.kind,
            key: saved.key,
            value: saved.value,
            strength: saved.strength,
          },
        };
      },
    }),

    removePreference: tool({
      description: "Remove a previously saved preference.",
      inputSchema: z.object({
        kind: kindSchema,
        key: z.string().min(1),
      }),
      execute: async (input) => {
        const removed = await removePreference(
          ctx.householdId,
          input.kind as PreferenceKind,
          input.key,
        );
        return { ok: removed };
      },
    }),
  };
}
