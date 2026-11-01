import { describe, expect, it } from "vitest";

import {
  meatEmojiForMeal,
  primaryProteinClass,
} from "@/lib/meals/history-display";
import {
  formatStarsDisplay,
  sentimentToStars,
  shouldMarkFavoriteFromStars,
  starsToSentiment,
} from "@/lib/meals/rating";

describe("stars ↔ sentiment", () => {
  it("maps stars to sentiments", () => {
    expect(starsToSentiment(5)).toBe("loved");
    expect(starsToSentiment(4)).toBe("liked");
    expect(starsToSentiment(3)).toBe("okay");
    expect(starsToSentiment(2)).toBe("disliked");
    expect(starsToSentiment(1)).toBe("never_again");
  });

  it("maps sentiments back to stars", () => {
    expect(sentimentToStars("loved")).toBe(5);
    expect(sentimentToStars("liked")).toBe(4);
    expect(sentimentToStars(null)).toBeNull();
  });

  it("favorites from 4+", () => {
    expect(shouldMarkFavoriteFromStars(5)).toBe(true);
    expect(shouldMarkFavoriteFromStars(4)).toBe(true);
    expect(shouldMarkFavoriteFromStars(3)).toBe(false);
  });

  it("formats star display", () => {
    expect(formatStarsDisplay(4)).toBe("★★★★☆");
    expect(formatStarsDisplay(null)).toBe("");
  });
});

describe("history meat display", () => {
  it("detects primary protein and emoji", () => {
    expect(primaryProteinClass("Honey garlic chicken")).toBe("chicken");
    expect(meatEmojiForMeal("Honey garlic chicken")).toBe("🍗");
    expect(meatEmojiForMeal("Beef fried rice")).toBe("🥩");
    expect(meatEmojiForMeal("Veggie pasta")).toBe("🥗");
  });
});
