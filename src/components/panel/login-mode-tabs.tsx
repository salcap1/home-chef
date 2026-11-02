import Link from "next/link";

export function LoginModeTabs({
  mode,
  next,
}: {
  mode: "sign_in" | "create";
  next: string;
}) {
  const nextQ = encodeURIComponent(next);
  const base =
    "flex-1 rounded-lg px-3 py-2 text-center text-sm font-medium transition-colors";
  const active =
    "bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900";
  const inactive =
    "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800";

  return (
    <div
      className="mt-5 flex gap-1 rounded-xl border border-neutral-200 bg-neutral-50 p-1 dark:border-neutral-800 dark:bg-neutral-950"
      role="tablist"
      aria-label="Account"
    >
      <Link
        href={`/login?next=${nextQ}`}
        role="tab"
        aria-selected={mode === "sign_in"}
        className={`${base} ${mode === "sign_in" ? active : inactive}`}
      >
        Sign in
      </Link>
      <Link
        href={`/login?mode=create&next=${nextQ}`}
        role="tab"
        aria-selected={mode === "create"}
        className={`${base} ${mode === "create" ? active : inactive}`}
      >
        Create account
      </Link>
    </div>
  );
}
