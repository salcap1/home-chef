import { createAccountAction, loginAction } from "@/lib/panel/actions";
import { MIN_PASSCODE_LENGTH } from "@/lib/panel/auth";
import { getEnv } from "@/lib/env";
import { PendingSubmitButton } from "@/components/panel/pending-button";
import { LoginModeTabs } from "@/components/panel/login-mode-tabs";

const ERROR_COPY: Record<string, string> = {
  "1": "Incorrect passcode.",
  too_short: `Use at least ${MIN_PASSCODE_LENGTH} characters.`,
  mismatch: "Passcodes do not match.",
  in_use: "That passcode is already in use.",
  failed: "Could not create account.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string; mode?: string }>;
}) {
  const params = await searchParams;
  const next = params.next ?? "/panel/meals";
  const mode = params.mode === "create" ? "create" : "sign_in";
  const errorMessage = params.error ? ERROR_COPY[params.error] : undefined;
  const demoChatLimit = getEnv().AI_SELF_SIGNUP_CHAT_LIMIT;

  return (
    <div
      className="flex min-h-dvh items-center justify-center bg-neutral-50 px-4 py-8 dark:bg-neutral-950"
      style={{
        paddingTop: "max(2rem, env(safe-area-inset-top, 0px))",
        paddingBottom: "max(2rem, env(safe-area-inset-bottom, 0px))",
      }}
    >
      <div className="w-full max-w-sm rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
        <h1 className="text-xl font-semibold tracking-tight">Household Chef</h1>
        <p className="mt-1 text-base text-neutral-600 dark:text-neutral-400">
          {mode === "create"
            ? "One passcode is one kitchen — no username."
            : "Sign in with your kitchen passcode"}
        </p>

        <LoginModeTabs mode={mode} next={next} />

        {errorMessage ? (
          <p className="mt-4 rounded-lg bg-red-50 px-3 py-3 text-base text-red-700 dark:bg-red-950 dark:text-red-300">
            {errorMessage}
          </p>
        ) : null}

        {mode === "create" ? (
          <form action={createAccountAction} className="mt-6 space-y-4">
            <input type="hidden" name="next" value={next} />
            <div>
              <label htmlFor="passcode" className="mb-2 block text-sm font-medium">
                Passcode
              </label>
              <input
                id="passcode"
                name="passcode"
                type="password"
                inputMode="text"
                autoComplete="new-password"
                required
                minLength={MIN_PASSCODE_LENGTH}
                placeholder="At least 8 characters"
                className="min-h-11 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-base transition-colors placeholder:text-neutral-400 hover:border-neutral-400 focus:border-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-900/10 dark:border-neutral-700 dark:bg-neutral-950 dark:hover:border-neutral-600 dark:focus:ring-neutral-100/10"
              />
            </div>
            <div>
              <label
                htmlFor="confirm"
                className="mb-2 block text-sm font-medium"
              >
                Confirm passcode
              </label>
              <input
                id="confirm"
                name="confirm"
                type="password"
                inputMode="text"
                autoComplete="new-password"
                required
                minLength={MIN_PASSCODE_LENGTH}
                placeholder="Confirm passcode"
                className="min-h-11 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-base transition-colors placeholder:text-neutral-400 hover:border-neutral-400 focus:border-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-900/10 dark:border-neutral-700 dark:bg-neutral-950 dark:hover:border-neutral-600 dark:focus:ring-neutral-100/10"
              />
            </div>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              Demo kitchens get {demoChatLimit} chef messages and cannot use
              Harris Teeter Shop. Full kitchens use the create-household script
              on your own deploy.
            </p>
            <PendingSubmitButton
              variant="primary"
              pendingLabel="Creating…"
              className="!w-full"
            >
              Create account
            </PendingSubmitButton>
          </form>
        ) : (
          <form action={loginAction} className="mt-6 space-y-4">
            <input type="hidden" name="next" value={next} />
            <div>
              <label htmlFor="passcode" className="mb-2 block text-sm font-medium">
                Passcode
              </label>
              <input
                id="passcode"
                name="passcode"
                type="password"
                inputMode="text"
                autoComplete="current-password"
                required
                placeholder="Enter your passcode"
                className="min-h-11 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-base transition-colors placeholder:text-neutral-400 hover:border-neutral-400 focus:border-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-900/10 dark:border-neutral-700 dark:bg-neutral-950 dark:hover:border-neutral-600 dark:focus:ring-neutral-100/10"
              />
            </div>
            <PendingSubmitButton
              variant="primary"
              pendingLabel="Signing in…"
              className="!w-full"
            >
              Sign in
            </PendingSubmitButton>
          </form>
        )}
      </div>
    </div>
  );
}
