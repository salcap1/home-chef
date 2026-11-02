# Contributing

Thanks for taking an interest in Household Chef.

## Development setup

1. Fork and clone the repo
2. Create your **own** Neon Postgres database (do not use someone else’s `DATABASE_URL`)
3. Copy `.env.example` to `.env.local` and fill in: your `DATABASE_URL`, a new `WEB_PANEL_SESSION_KEY` (`openssl rand -base64 32`), and your AI Gateway key
4. For Harris Teeter Shop, register **your own** Kroger developer app and set `KROGER_*` — never reuse another deploy’s secrets
5. `npm install`
6. Apply migrations: `node --env-file=.env.local ./node_modules/drizzle-kit/bin.cjs migrate`
7. `npm run dev` — use **Create account** for a demo kitchen, or `npm run household:create` for a full kitchen (Shop + no lifetime chat cap)
8. Do **not** run `npm run dev:vercel` unless you own the Vercel project (it overwrites `.env.local` with host secrets)

## Workflow

- Open a PR against `main`
- Use [Conventional Commits](https://www.conventionalcommits.org/) for commit messages and PR titles (`feat:`, `fix:`, `docs:`, `chore:`, `ci:`, `test:`, `refactor:`, …)
- Keep PRs focused; prefer small, reviewable changes
- Do not invent product features unrelated to the issue or PR description
- Do not commit `.env.local`, credentials, or anything under `docs/private/`

## Checks before opening a PR

```bash
npm run lint
npm run typecheck
npm run test:coverage
npm run build
```

Open changes against `main` via pull request (branch protection requires CI + a conventional PR title). Do not push directly to `main` unless you are unblocking a broken release.

CI runs the same suite on every pull request. Coverage measures deterministic `src/lib` helpers; DB/HTTP/action modules are excluded from the badge.

## Product / agent behavior

`AGENTS.md` is the developer product specification. Runtime chef prompts live in `prompts/*.md`. Prefer changing prompts and deterministic TypeScript services over duplicating logic in the UI.

## Code style

- TypeScript strict mode
- Zod for external inputs and AI tool schemas
- Shared server-side services for panel mutations and chef tools (no parallel business logic in the UI)
- When removing a feature, delete it fully (UI, domain logic, types, tests, prompts/docs, and schema) — see AGENTS engineering standards
