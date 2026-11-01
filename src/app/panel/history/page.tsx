import Link from "next/link";

import {
  EmptyState,
  PanelLinkButton,
  PanelList,
  PanelShell,
} from "@/components/panel/ui";
import { loadMealHistory } from "@/lib/panel/queries";
import {
  HISTORY_MEAT_FILTERS,
  isHistoryMeatFilter,
  meatEmojiForProteinClass,
} from "@/lib/meals/history-display";

function historyHref(input: {
  offset?: number;
  sort?: string;
  meat?: string | null;
}) {
  const params = new URLSearchParams();
  if (input.sort && input.sort !== "date") params.set("sort", input.sort);
  if (input.meat) params.set("meat", input.meat);
  if (input.offset && input.offset > 0) {
    params.set("offset", String(input.offset));
  }
  const query = params.toString();
  return query ? `/panel/history?${query}` : "/panel/history";
}

function chipClass(active: boolean) {
  return active
    ? "inline-flex min-h-9 items-center rounded-lg bg-neutral-900 px-3 text-sm font-medium text-white dark:bg-neutral-100 dark:text-neutral-900"
    : "inline-flex min-h-9 items-center rounded-lg border border-neutral-200 bg-white px-3 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800";
}

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ offset?: string; sort?: string; meat?: string }>;
}) {
  const params = await searchParams;
  const offset = Math.max(0, Number(params.offset ?? "0") || 0);
  const sort = params.sort === "rating" ? "rating" : "date";
  const meat = isHistoryMeatFilter(params.meat) ? params.meat : null;
  const { items, hasMore } = await loadMealHistory(offset, { sort, meat });

  return (
    <PanelShell active="/panel/history" title="Past meals">
      <div className="mb-4 space-y-3">
        <div className="flex flex-wrap gap-2">
          <Link href={historyHref({ sort: "date", meat })} className={chipClass(sort === "date")}>
            Newest
          </Link>
          <Link
            href={historyHref({ sort: "rating", meat })}
            className={chipClass(sort === "rating")}
          >
            Top rated
          </Link>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={historyHref({ sort, meat: null })} className={chipClass(!meat)}>
            All meats
          </Link>
          {HISTORY_MEAT_FILTERS.map((filter) => (
            <Link
              key={filter}
              href={historyHref({ sort, meat: filter })}
              className={chipClass(meat === filter)}
            >
              {meatEmojiForProteinClass(filter)} {filter}
            </Link>
          ))}
        </div>
      </div>

      {items.length === 0 ? (
        <EmptyState>No meal history recorded yet.</EmptyState>
      ) : (
        <>
          <PanelList>
            {items.map(({ meal, recipe, starsDisplay, meatEmoji }) => (
              <li
                key={meal.id}
                className="px-3 py-2.5 transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-800/40"
              >
                <div className="flex min-h-11 items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs text-neutral-500">
                      {meal.cookedAt.toISOString().slice(0, 10)}
                      {starsDisplay ? (
                        <>
                          {" · "}
                          <span className="text-amber-500 dark:text-amber-400">
                            {starsDisplay}
                          </span>
                        </>
                      ) : null}
                    </p>
                    <p className="truncate font-medium">
                      <span aria-hidden className="mr-1.5">
                        {meatEmoji}
                      </span>
                      {meal.name}
                    </p>
                  </div>
                  {recipe ? (
                    <PanelLinkButton href={`/panel/meals/recipe/${recipe.id}`}>
                      Recipe
                    </PanelLinkButton>
                  ) : null}
                </div>
              </li>
            ))}
          </PanelList>

          {hasMore ? (
            <div className="mt-3">
              <Link
                href={historyHref({ offset: offset + 10, sort, meat })}
                className="flex min-h-11 items-center justify-center rounded-xl border border-neutral-200 bg-white text-sm font-medium shadow-sm transition-all duration-150 hover:border-neutral-300 hover:bg-neutral-50 hover:shadow active:scale-[0.99] dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-neutral-700 dark:hover:bg-neutral-800"
              >
                Load more
              </Link>
            </div>
          ) : null}
        </>
      )}
    </PanelShell>
  );
}
