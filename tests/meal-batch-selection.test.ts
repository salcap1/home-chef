import { describe, expect, it } from "vitest";

import type { MealPlan } from "@/lib/db/schema";
import {
  resolveNewMealBatchMode,
  selectCurrentAndUpcomingPlans,
} from "@/lib/planning/service";

function plan(
  partial: Pick<MealPlan, "id" | "status"> &
    Partial<MealPlan> & { createdAt?: Date },
): MealPlan {
  return {
    householdId: "h",
    weekStartDate: "2026-09-01",
    title: partial.title ?? partial.id,
    notes: null,
    createdAt: partial.createdAt ?? new Date("2026-09-01T12:00:00Z"),
    updatedAt: new Date(),
    ...partial,
  } as MealPlan;
}

describe("selectCurrentAndUpcomingPlans", () => {
  it("returns nulls when empty", () => {
    expect(selectCurrentAndUpcomingPlans([])).toEqual({
      current: null,
      upcoming: null,
    });
  });

  it("uses the only active plan as current", () => {
    const current = plan({ id: "a1", status: "active" });
    expect(selectCurrentAndUpcomingPlans([current])).toEqual({
      current,
      upcoming: null,
    });
  });

  it("orders by createdAt: older current, newer upcoming", () => {
    const older = plan({
      id: "older",
      status: "active",
      createdAt: new Date("2026-09-01T10:00:00Z"),
    });
    const newer = plan({
      id: "newer",
      status: "active",
      createdAt: new Date("2026-09-08T10:00:00Z"),
    });
    expect(selectCurrentAndUpcomingPlans([newer, older])).toEqual({
      current: older,
      upcoming: newer,
    });
  });
});

describe("resolveNewMealBatchMode", () => {
  it("creates current when empty", () => {
    expect(resolveNewMealBatchMode([])).toBe("create_current");
  });

  it("creates upcoming when one active exists", () => {
    expect(
      resolveNewMealBatchMode([plan({ id: "a1", status: "active" })]),
    ).toBe("create_upcoming");
  });

  it("replaces current when one active and replaceExisting", () => {
    expect(
      resolveNewMealBatchMode([plan({ id: "a1", status: "active" })], {
        replaceExisting: true,
      }),
    ).toBe("replace_current");
  });

  it("replaces upcoming when two actives exist", () => {
    expect(
      resolveNewMealBatchMode([
        plan({
          id: "a1",
          status: "active",
          createdAt: new Date("2026-09-01T10:00:00Z"),
        }),
        plan({
          id: "a2",
          status: "active",
          createdAt: new Date("2026-09-08T10:00:00Z"),
        }),
      ]),
    ).toBe("replace_upcoming");
  });
});
