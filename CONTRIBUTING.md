# Contributing

Thanks for taking an interest in Household Chef.

## Development setup

1. Fork and clone the repo
2. Copy `.env.example` to `.env.local` and fill in required values (see README)
3. `npm install`
4. Apply migrations: `node --env-file=.env.local ./node_modules/drizzle-kit/bin.cjs migrate`
5. `npm run dev`

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

CI runs the same suite on every pull request.

## Product / agent behavior

`AGENTS.md` is the developer product specification. Runtime chef prompts live in `prompts/*.md`. Prefer changing prompts and deterministic TypeScript services over duplicating logic in the UI.

## Code style

- TypeScript strict mode
- Zod for external inputs and AI tool schemas
- Shared server-side services for panel mutations and chef tools (no parallel business logic in the UI)
- When removing a feature, delete it fully (UI, domain logic, types, tests, prompts/docs, and schema) — see AGENTS engineering standards
