# Household Chef

[![CI](https://github.com/salcap1/home-chef/actions/workflows/ci.yml/badge.svg)](https://github.com/salcap1/home-chef/actions/workflows/ci.yml)
[![Coverage](./.github/badges/coverage.svg)](./.github/badges/coverage.svg)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)

Personal AI household chef that removes the mental load of deciding what to cook, remembering tastes, and keeping a living grocery list — without forcing a rigid plan → list → shop workflow.

Demo: [home-chef-sepia.vercel.app](https://home-chef-sepia.vercel.app)

The passcode-protected web app at `/panel` is the interface: generate meals, chat with Chef Carmela, manage groceries and preferences, cook, and optionally add Harris Teeter items to cart one at a time.

> We use the app whenever we need something. It remembers what matters and gets better over time.

This is a kitchen ecosystem for one household (two adults), not a public meal-planning SaaS.

## Features

- Recommend dinners from preferences, favorites, and recent meals
- Plan a numbered **meal batch** (current + optional upcoming)
- Generate and tweak simple family recipes
- Mark meals cooked; save favorites (cooking feedback regenerates the recipe)
- Build and edit a persistent grocery list
- Per-item Harris Teeter cart add via the official Kroger API (no scraping)
- Monthly AI usage summary with per-kitchen and optional site-wide budgets

## Quick start

You need your **own** Neon database, session key, and AI auth. Cloning this repo does not include production credentials.

```bash
npm install
cp .env.example .env.local
# Fill DATABASE_URL (your Neon), WEB_PANEL_SESSION_KEY, and AI auth (see env table)
node --env-file=.env.local ./node_modules/drizzle-kit/bin.cjs migrate
npm run dev
```

Open [http://localhost:3000/login](http://localhost:3000/login) — **Create account** (demo kitchen: limited chef messages, no Harris Teeter Shop) or **Sign in**.

For a full kitchen (unlimited chat subject to budget, Shop allowed when Kroger is configured):

```bash
npm run household:create -- --passcode='your-long-passcode' --name='Home'
```

Generate a session key:

```bash
openssl rand -base64 32
```

Do **not** run `npm run dev:vercel` unless you own the linked Vercel project — that pulls host secrets into `.env.local`.

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | yes | Neon Postgres connection string |
| `AI_GATEWAY_API_KEY` / OIDC | one of | Vercel AI Gateway auth |
| `WEB_PANEL_SESSION_KEY` | yes | 32+ char cookie signing + passcode HMAC pepper |
| `WEB_PANEL_SECRET` | no | One-time bootstrap passcode for the oldest kitchen without a login key |
| `AI_MODEL` | no | Default chat model |
| `AI_PLANNING_MODEL` | no | Planning / recipe generation model |
| `AI_MONTHLY_BUDGET_USD` | no | Default per-kitchen monthly AI budget (default `5`) |
| `AI_GLOBAL_MONTHLY_BUDGET_USD` | no | Optional hard cap across all kitchens |
| `AI_CHAT_HOURLY_LIMIT` | no | Chef chat messages per kitchen per hour (default `10`) |
| `AI_CHAT_DAILY_LIMIT` | no | Chef chat messages per kitchen per day (default `40`) |
| `AI_SELF_SIGNUP_CHAT_LIMIT` | no | Lifetime chef messages for UI Create account kitchens (default `3`) |
| `HOUSEHOLD_NAME` | no | Default kitchen name when creating accounts |
| `HOUSEHOLD_TIMEZONE` | no | Default `America/New_York` |
| `APP_BASE_URL` | for OAuth | Public origin (e.g. `http://localhost:3000`) |
| `KROGER_CLIENT_ID` / `KROGER_CLIENT_SECRET` | for Shop | Your own Kroger developer app (never reuse another deploy’s) |
| `KROGER_REDIRECT_URI` | for OAuth | Must match the Kroger app redirect URI |
| `KROGER_LOCATION_ID` | for Shop | Your store location ID from the Kroger location API |
| `KROGER_LOCATION_NAME` | no | Display name when location ID is set |
| `HARRIS_TEETER_ZIP` | no | Discover a store when `KROGER_LOCATION_ID` is unset |
| `HARRIS_TEETER_STORE_NAME` | no | Prefer a store name substring during discovery |

Never commit `.env.local` or real credentials. Use host env (e.g. Vercel) for preview and production. On shared public deploys, set `AI_GLOBAL_MONTHLY_BUDGET_USD` as a site-wide backstop.

## Commands

| Script | Purpose |
| --- | --- |
| `npm run dev` | Local Next.js server |
| `npm run dev:vercel` | Pull linked Vercel env into `.env.local`, then `next dev` (owners only) |
| `npm run build` | Production build |
| `npm run start` | Run production server |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript (`tsc --noEmit`) |
| `npm run test` | Unit tests (Vitest) |
| `npm run test:coverage` | Tests with V8 coverage + badge update |
| `npm run db:migrate` | Apply Drizzle migrations |
| `npm run household:create` | Create a kitchen passcode account |

## Layout

```
prompts/                 Runtime AI prompts (Chef Carmela)
src/app/                 Next.js App Router (panel, login, APIs)
src/lib/ai/              Agent, recipes, planning, budget gates
src/lib/panel/           Passcode auth, session, server actions
src/lib/planning/        Meal batches, grocery merge
src/lib/kroger/          Product search, cart add, OAuth
src/lib/db/              Drizzle schema + client
scripts/                 Ops scripts (create household, recipe regen)
tests/                   Vitest unit tests
AGENTS.md                Developer product specification
```

## Testing

Deterministic business logic is covered with Vitest (grocery math, planning rules, session/passcode, food matching, etc.). Subjective recipe quality is not unit-tested.

```bash
npm run test
npm run test:coverage
```

Coverage focuses on deterministic `src/lib` logic (grocery math, formatting, session/passcode, planning rules). DB/HTTP/server-action modules are excluded from the badge denominator. CI publishes a job summary + artifact; the in-repo badge lives at `.github/badges/coverage.svg`.

## Harris Teeter (optional)

Register **your own** app at [developer.kroger.com](https://developer.kroger.com) — do not copy production client secrets from someone else’s deploy.

1. Scopes: `product.compact`, `cart.basic:write`, `profile.compact`
2. Set redirect URI to `{APP_BASE_URL}/api/kroger/callback`
3. Set `KROGER_CLIENT_ID`, `KROGER_CLIENT_SECRET`, `KROGER_REDIRECT_URI`, and `KROGER_LOCATION_ID`
4. Use a **full** kitchen (`household:create`), then Link once via panel Groceries and **Shop** on default Grocery lines

Demo kitchens from **Create account** cannot Link or Shop (even if Kroger env is set). OAuth tokens are always per kitchen in `kroger_connections` — never a shared cart token.

The API is add-only; review the cart on the Harris Teeter site. This project does not scrape stores or store merchant passwords.

## Architecture (short)

```
Web app (/panel)
  → session cookie (householdId)
  → shared domain services → Neon (scoped per kitchen)
  → chef chat / recipes / planning → budget + rate gates → AI Gateway
  → per-item Shop → Kroger API
```

Product behavior for developers: `AGENTS.md` (not sent to the model). Runtime prompts: `prompts/*.md`.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md). Use Conventional Commits; PR titles must follow the same rules.

## Security

See [SECURITY.md](./SECURITY.md) for private vulnerability reporting.

## License

[MIT](./LICENSE)
