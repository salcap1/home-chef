import { PanelShell } from "@/components/panel/ui";
import { loadCostSummary } from "@/lib/panel/queries";

export default async function CostPage() {
  const summary = await loadCostSummary();
  const categories = Object.entries(summary.byCategory).sort(
    (a, b) => b[1] - a[1],
  );
  const remaining = Math.max(0, summary.budgetUsd - summary.totalUsd);
  const overBudget = summary.totalUsd > summary.budgetUsd;

  return (
    <PanelShell active="/panel/cost" title="AI usage">
      <p className="mb-4 text-sm text-neutral-500">
        Month {summary.month} · tracked for this household
      </p>

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-neutral-200 bg-white px-3 py-3 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
            Total
          </p>
          <p className="mt-1 text-2xl font-semibold tracking-tight">
            ${summary.totalUsd.toFixed(2)}
          </p>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white px-3 py-3 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
            Budget
          </p>
          <p className="mt-1 text-2xl font-semibold tracking-tight">
            ${summary.budgetUsd.toFixed(2)}
          </p>
        </div>
        <div className="col-span-2 rounded-xl border border-neutral-200 bg-white px-3 py-3 shadow-sm sm:col-span-1 dark:border-neutral-800 dark:bg-neutral-900">
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
            {overBudget ? "Over" : "Left"}
          </p>
          <p
            className={`mt-1 text-2xl font-semibold tracking-tight ${
              overBudget ? "text-red-600 dark:text-red-400" : ""
            }`}
          >
            ${overBudget
              ? (summary.totalUsd - summary.budgetUsd).toFixed(2)
              : remaining.toFixed(2)}
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
        <div className="border-b border-neutral-200 px-3 py-2.5 dark:border-neutral-800">
          <p className="text-sm font-semibold">By category</p>
        </div>
        {categories.length === 0 ? (
          <p className="px-3 py-8 text-center text-sm text-neutral-500">
            No AI usage recorded yet this month.
          </p>
        ) : (
          <ul className="divide-y divide-neutral-200 dark:divide-neutral-800">
            {categories.map(([category, amount]) => (
              <li
                key={category}
                className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm"
              >
                <span className="capitalize text-neutral-700 dark:text-neutral-300">
                  {category}
                </span>
                <span className="font-medium tabular-nums">
                  ${amount.toFixed(2)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </PanelShell>
  );
}
