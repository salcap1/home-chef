export type FeedbackSentiment =
  | "loved"
  | "liked"
  | "okay"
  | "disliked"
  | "never_again";

export type StarRating = 1 | 2 | 3 | 4 | 5;

const STARS_TO_SENTIMENT: Record<StarRating, FeedbackSentiment> = {
  5: "loved",
  4: "liked",
  3: "okay",
  2: "disliked",
  1: "never_again",
};

const SENTIMENT_TO_STARS: Record<FeedbackSentiment, StarRating> = {
  loved: 5,
  liked: 4,
  okay: 3,
  disliked: 2,
  never_again: 1,
};

export function starsToSentiment(stars: StarRating): FeedbackSentiment {
  return STARS_TO_SENTIMENT[stars];
}

export function sentimentToStars(
  sentiment: FeedbackSentiment | string | null | undefined,
): StarRating | null {
  if (!sentiment) return null;
  return SENTIMENT_TO_STARS[sentiment as FeedbackSentiment] ?? null;
}

export function shouldMarkFavoriteFromStars(stars: StarRating): boolean {
  return stars >= 4;
}

export function formatStarsDisplay(stars: StarRating | null): string {
  if (stars === null) return "";
  return "★".repeat(stars) + "☆".repeat(5 - stars);
}
