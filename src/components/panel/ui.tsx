import Link from "next/link";

import { logoutAction } from "@/lib/panel/actions";
import { PendingSubmitButton } from "@/components/panel/pending-button";

const NAV = [
  { href: "/panel/meals", label: "Meals", shortLabel: "Meals" },
  { href: "/panel/groceries", label: "Groceries", shortLabel: "List" },
  { href: "/panel/preferences", label: "Preferences", shortLabel: "Prefs" },
  { href: "/panel/history", label: "History", shortLabel: "Past" },
  { href: "/panel/cost", label: "Cost", shortLabel: "Cost" },
];

function PanelTopBar() {
  return (
    <header className="shrink-0 border-b border-neutral-200/80 bg-white/95 backdrop-blur-md dark:border-neutral-800/80 dark:bg-neutral-950/95">
      <div
        className="mx-auto flex max-w-3xl items-center justify-between px-4 pb-3"
        style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top, 0px))" }}
      >
        <p className="text-sm font-semibold tracking-tight">Household Chef</p>
        <form action={logoutAction}>
          <PendingSubmitButton
            variant="ghost"
            pendingLabel="…"
            className="!min-h-11 text-neutral-500"
          >
            Log out
          </PendingSubmitButton>
        </form>
      </div>
    </header>
  );
}

function PanelBottomNav({ active }: { active: string }) {
  return (
    <nav
      className="shrink-0 border-t border-neutral-200/80 bg-white/95 backdrop-blur-md dark:border-neutral-800/80 dark:bg-neutral-950/95"
      aria-label="Main"
    >
      <div className="mx-auto flex max-w-3xl">
        {NAV.map((item) => {
          const isActive = active === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-1 cursor-pointer flex-col items-center justify-center gap-2 px-1 text-center text-[15px] font-semibold leading-none tracking-tight transition-colors duration-150 active:bg-neutral-100 hover:bg-neutral-100/80 sm:text-sm dark:active:bg-neutral-900 dark:hover:bg-neutral-900 ${
                isActive
                  ? "text-neutral-900 dark:text-neutral-100"
                  : "text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200"
              }`}
              style={{
                paddingTop: "18px",
                paddingBottom:
                  "max(22px, var(--safe-area-bottom, env(safe-area-inset-bottom, 0px)))",
              }}
            >
              <span className="sm:hidden">{item.shortLabel}</span>
              <span className="hidden sm:inline">{item.label}</span>
              {isActive ? (
                <span className="h-1.5 w-8 rounded-full bg-neutral-900 dark:bg-neutral-100" />
              ) : (
                <span className="h-1.5 w-8" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function PanelShell({
  active,
  title,
  children,
  hideTitle = false,
  titleAction,
}: {
  active: string;
  title: string;
  children: React.ReactNode;
  hideTitle?: boolean;
  titleAction?: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-x-0 top-0 flex flex-col overflow-hidden bg-neutral-50 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100"
      style={{
        /* Height tracks the visible viewport when the keyboard opens.
         * Keep top pinned at 0 — never shift by visualViewport.offsetTop. */
        height:
          "var(--app-height, calc(100dvh + env(safe-area-inset-bottom, 0px)))",
      }}
    >
      <PanelTopBar />
      <main
        className="mx-auto min-h-0 w-full max-w-3xl flex-1 overflow-y-auto overscroll-y-contain px-4 py-4 [-webkit-overflow-scrolling:touch]"
        data-panel-scroll
      >
        {hideTitle ? null : (
          <div className="mb-4 flex items-center justify-between gap-3">
            <h1 className="min-w-0 text-lg font-semibold tracking-tight sm:text-2xl">
              {title}
            </h1>
            {titleAction ? (
              <div className="shrink-0">{titleAction}</div>
            ) : null}
          </div>
        )}
        {children}
      </main>
      <div className="shrink-0" data-panel-bottom-nav>
        <PanelBottomNav active={active} />
      </div>
    </div>
  );
}

export function PanelList({ children }: { children: React.ReactNode }) {
  return (
    <ul className="divide-y divide-neutral-200 overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm dark:divide-neutral-800 dark:border-neutral-800 dark:bg-neutral-900">
      {children}
    </ul>
  );
}

export function PanelCompactInput({
  name,
  defaultValue,
  value,
  placeholder,
  required,
  className = "",
  autoFocus,
  inputRef,
  readOnly,
  onChange,
}: {
  name: string;
  defaultValue?: string;
  value?: string;
  placeholder?: string;
  required?: boolean;
  className?: string;
  autoFocus?: boolean;
  inputRef?: React.Ref<HTMLInputElement>;
  readOnly?: boolean;
  onChange?: React.ChangeEventHandler<HTMLInputElement>;
}) {
  return (
    <input
      ref={inputRef}
      name={name}
      defaultValue={defaultValue}
      value={value}
      placeholder={placeholder}
      required={required}
      autoFocus={autoFocus}
      readOnly={readOnly}
      onChange={onChange}
      className={`min-h-10 rounded-md border border-neutral-300 bg-white px-2.5 py-2 text-base transition-colors placeholder:text-neutral-400 hover:border-neutral-400 focus:border-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-900/10 dark:border-neutral-700 dark:bg-neutral-950 dark:hover:border-neutral-600 dark:focus:ring-neutral-100/10 ${readOnly ? "text-neutral-500" : ""} ${className}`}
    />
  );
}

export function PanelCompactTextarea({
  name,
  defaultValue,
  placeholder,
  required,
  className = "",
  autoFocus,
  textareaRef,
  rows = 3,
}: {
  name: string;
  defaultValue?: string;
  placeholder?: string;
  required?: boolean;
  className?: string;
  autoFocus?: boolean;
  textareaRef?: React.Ref<HTMLTextAreaElement>;
  rows?: number;
}) {
  return (
    <textarea
      ref={textareaRef}
      name={name}
      defaultValue={defaultValue}
      placeholder={placeholder}
      required={required}
      autoFocus={autoFocus}
      rows={rows}
      className={`min-h-20 w-full resize-y rounded-md border border-neutral-300 bg-white px-2.5 py-2 text-base leading-snug transition-colors placeholder:text-neutral-400 hover:border-neutral-400 focus:border-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-900/10 dark:border-neutral-700 dark:bg-neutral-950 dark:hover:border-neutral-600 dark:focus:ring-neutral-100/10 ${className}`}
    />
  );
}

export function PanelAddRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-2 shadow-sm transition-shadow hover:shadow dark:border-neutral-800 dark:bg-neutral-900">
      {children}
    </div>
  );
}

export function PanelSelect({
  name,
  defaultValue,
  options,
  className = "",
}: {
  name: string;
  defaultValue?: string;
  options: Array<{ value: string; label: string }>;
  className?: string;
}) {
  return (
    <select
      name={name}
      defaultValue={defaultValue}
      className={`h-10 w-full appearance-none rounded-md border border-neutral-300 bg-white bg-[length:1rem] bg-[right_0.65rem_center] bg-no-repeat px-2.5 pr-9 text-base leading-10 text-neutral-900 transition-colors hover:border-neutral-400 focus:border-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-900/10 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100 dark:hover:border-neutral-600 dark:focus:ring-neutral-100/10 ${className}`}
      style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23a3a3a3'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E")`,
      }}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

export function PanelLinkButton({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="flex min-h-11 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-800 shadow-sm transition-all duration-150 hover:border-neutral-400 hover:bg-neutral-50 hover:shadow active:scale-[0.98] dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:border-neutral-600 dark:hover:bg-neutral-800"
    >
      {children}
    </Link>
  );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-xl border border-dashed border-neutral-300 px-4 py-10 text-center text-base leading-relaxed text-neutral-500 dark:border-neutral-700">
      {children}
    </p>
  );
}
