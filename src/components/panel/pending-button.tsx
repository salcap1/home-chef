"use client";

import { useFormStatus } from "react-dom";

/** Shared glyph size for ✓ × + across the panel. */
export function PanelIcon({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex h-5 w-5 items-center justify-center text-[1.25rem] leading-none ${className}`}
      aria-hidden
    >
      {children}
    </span>
  );
}

const ICON_BUTTON =
  "inline-flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-md transition-colors duration-150 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-60";

const iconVariants = {
  icon: "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 active:bg-neutral-200 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100",
  "icon-danger":
    "text-red-600 hover:bg-red-50 hover:text-red-700 active:bg-red-100 dark:text-red-500 dark:hover:bg-red-950 dark:hover:text-red-400",
  "icon-success":
    "text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 active:bg-emerald-100 dark:text-emerald-500 dark:hover:bg-emerald-950 dark:hover:text-emerald-400",
} as const;

function Spinner({ className = "" }: { className?: string }) {
  return (
    <svg
      className={`animate-spin ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="3"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

export function PendingSubmitButton({
  children,
  pendingLabel,
  variant = "primary",
  className = "",
  title,
  "aria-label": ariaLabel,
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  variant?:
    | "primary"
    | "secondary"
    | "danger"
    | "ghost"
    | "icon"
    | "icon-danger"
    | "icon-success";
  className?: string;
  title?: string;
  "aria-label"?: string;
}) {
  const { pending } = useFormStatus();

  const base =
    "inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg text-sm font-medium transition-all duration-150 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-60";

  const variants: Record<string, string> = {
    primary:
      "min-h-11 w-full bg-neutral-900 px-4 py-2.5 text-base text-white hover:bg-neutral-800 active:scale-[0.98] sm:w-auto sm:text-sm dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-white",
    secondary:
      "min-h-11 w-full border border-neutral-300 bg-white px-4 py-2.5 text-base text-neutral-800 hover:border-neutral-400 hover:bg-neutral-50 active:scale-[0.98] sm:w-auto sm:text-sm dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:border-neutral-600 dark:hover:bg-neutral-800",
    danger:
      "min-h-11 w-full bg-red-600 px-4 py-2.5 text-base text-white hover:bg-red-700 active:scale-[0.98] sm:w-auto sm:text-sm",
    ghost:
      "min-h-10 rounded-md px-3 text-neutral-700 hover:bg-neutral-100 active:bg-neutral-200 dark:text-neutral-300 dark:hover:bg-neutral-800 dark:active:bg-neutral-700",
    icon: `${ICON_BUTTON} ${iconVariants.icon}`,
    "icon-danger": `${ICON_BUTTON} ${iconVariants["icon-danger"]}`,
    "icon-success": `${ICON_BUTTON} ${iconVariants["icon-success"]}`,
  };

  return (
    <button
      type="submit"
      disabled={pending}
      title={title}
      aria-label={ariaLabel}
      aria-busy={pending}
      className={`${base} ${variants[variant]} ${className}`}
    >
      {pending ? (
        <>
          <Spinner className="h-4 w-4" />
          {pendingLabel ? <span>{pendingLabel}</span> : null}
        </>
      ) : (
        children
      )}
    </button>
  );
}

export function PendingIconButton({
  children,
  variant = "icon",
  title,
  className = "",
  "aria-label": ariaLabel,
}: {
  children: React.ReactNode;
  variant?: "icon" | "icon-danger" | "icon-success";
  title?: string;
  className?: string;
  "aria-label"?: string;
}) {
  return (
    <PendingSubmitButton
      variant={variant}
      title={title}
      aria-label={ariaLabel}
      className={className}
    >
      <PanelIcon>{children}</PanelIcon>
    </PendingSubmitButton>
  );
}

/** Non-submit icon button (cancel, open add, etc.) — same size as PendingIconButton. */
export function PanelIconButton({
  children,
  variant = "icon",
  title,
  className = "",
  "aria-label": ariaLabel,
  onClick,
}: {
  children: React.ReactNode;
  variant?: "icon" | "icon-danger" | "icon-success";
  title?: string;
  className?: string;
  "aria-label"?: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={ariaLabel}
      onClick={onClick}
      className={`${ICON_BUTTON} ${iconVariants[variant]} ${className}`}
    >
      <PanelIcon>{children}</PanelIcon>
    </button>
  );
}
