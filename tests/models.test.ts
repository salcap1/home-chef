import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { getConversationModel, getPlanningModel } from "@/lib/ai/models";

const KEYS = ["AI_MODEL", "AI_PLANNING_MODEL"] as const;
const saved: Partial<Record<(typeof KEYS)[number], string | undefined>> = {};

beforeEach(() => {
  for (const key of KEYS) {
    saved[key] = process.env[key];
  }
});

afterEach(() => {
  for (const key of KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
    delete saved[key];
  }
});

describe("ai models", () => {
  it("reads conversation and planning models from env", () => {
    process.env.AI_MODEL = "openai/gpt-test-chat";
    process.env.AI_PLANNING_MODEL = "openai/gpt-test-plan";
    expect(getConversationModel()).toBe("openai/gpt-test-chat");
    expect(getPlanningModel()).toBe("openai/gpt-test-plan");
  });
});
