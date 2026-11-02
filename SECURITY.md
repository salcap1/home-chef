# Security Policy

## Supported versions

Security fixes are applied to the latest commit on `main`.

## Reporting a vulnerability

Please **do not** open a public GitHub issue for security problems.

Prefer [GitHub private vulnerability reporting](https://github.com/salcap1/home-chef/security/advisories/new) when available, or email **salvatore.cap15@gmail.com**, with:

- A short description of the issue
- Steps to reproduce (or a proof of concept)
- Impact assessment if you have one

You should receive an acknowledgment within a few days. Please give reasonable time for a fix before any public disclosure.

## Scope notes

Passcode-gated panel (no username), Neon Postgres, Vercel AI Gateway, optional Kroger OAuth for Harris Teeter cart add. Reports involving leaked secrets, auth bypass, or cross-household data access are especially welcome.

### Tenant and secret boundaries

- Cloning the repo alone cannot reach production data: `DATABASE_URL`, `WEB_PANEL_SESSION_KEY`, AI keys, and Kroger credentials live only in host env / local `.env.local` (gitignored).
- Panel data is scoped by `householdId` in the signed session cookie.
- Harris Teeter user tokens are per kitchen in `kroger_connections`. Demo (self-signup) kitchens cannot Shop or start Kroger OAuth on a shared deploy.
- Contributors must use their own Neon, session key, AI auth, and Kroger developer app.
