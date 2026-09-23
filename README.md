# Reality Fantasy Leagues — Next.js proof of concept

**This is a proof-of-concept spike, not the live app.** The live, actively-used Survivor Fantasy
Engine is the `SurvivorDraft` repo (vanilla JS/Express/Postgres) — see that repo's `CLAUDE.md`
and `docs/ARCHITECTURE.md`/`docs/HANDOFF.md` for full context on why this repo exists and what
it's validating.

## What this validates

Per `SurvivorDraft/docs/ARCHITECTURE.md`'s Phase 1 recommendation: React + Next.js (App Router) +
Tailwind CSS + shadcn/ui + Zustand, with the **Overview tab ported first** as a self-contained
validation case before committing to a full port of the live app.

Ported so far: the full Overview tab — Side Bets section (propose a bet, guess, commissioner
grading, delete), the three dashboard cards (Latest Episode, Season Status, Standings), and the
post-draft Board grid (castaways by tribe, ownership, elimination medals) — using the live app's
`shared/state-logic.js` **copied in verbatim** (`src/lib/game/state-logic.js` — see the provenance
comment at its top) for every mutation, not just reads. Two data sources, switchable at runtime:

- **Mock/demo data** (`src/lib/game/mock-state.ts`, a port of the live app's demo dataset) — the
  default, no server needed.
- **Real data from the live Express API** (`src/lib/api.ts`, gated by `src/components/auth-gate.tsx`)
  — logs in against the real `/api/auth/login`, then fetches a real league's state via
  `/api/leagues/:id/state`, exactly like the live app does. Requires the `SurvivorDraft` repo's dev
  server running with its CORS middleware enabled (`NODE_ENV !== 'production'`) and
  `DEV_CORS_ORIGINS` including this app's dev origin — see that repo's `server/index.js` and
  `docs/HANDOFF.md`. Set `NEXT_PUBLIC_API_BASE` in `.env.local` (gitignored) to point at it; see
  `.env.local` example below.

Verified end-to-end (login → session cookie → cross-origin fetch → real Postgres data rendering
in the Overview cards) against a throwaway fixture user/league, not just the mock path. Bet
mutations also call the real API in live mode (`POST .../bets`, `POST .../predictions`, `PATCH
.../predictions/:id`, `DELETE .../bets/:id`) — see `src/lib/use-mutate.ts`, one hook standing in
for the `isDemoMode` branch every mutator in the live app's `public/app.js` has.

Mock mode intentionally mirrors the live app's *actual* demo-mode behavior, not an idealized one:
full commissioner powers (propose/delete/grade bets), but no personal player identity to submit a
guess as — `enterDemoMode()` in the live app never sets a player identity either.

## Design tokens

The terracotta/cream palette from the live app's `public/styles.css` `:root` block is ported 1:1
into `src/app/globals.css`'s `:root` (mapped onto shadcn's semantic color slots — `--primary` is
the terracotta accent, `--background`/`--card`/`--border`/etc. follow the live app's
`--bg`/`--panel`/`--border`), plus a few extra `--color-*` theme entries (`panel-menu`, `accent-2`,
`good`) for tokens that don't have a natural shadcn slot. Same IBM Plex Sans / IBM Plex Mono
typefaces via `next/font/google`. This is meant to be a translation of the existing look, not a
redesign — see `ARCHITECTURE.md`'s styling rationale.

## Not done yet (intentionally, for this POC's scope)

- **Notifications banner** — deliberately not ported. Unlike everything else here it isn't a pure
  function of state; the live app builds it from cross-poll deltas ("a bet appeared since your
  last poll", "it just became your turn"), which is a polling-infrastructure concern, not a
  componentization one. Worth its own pass once real-time/polling strategy for this repo is
  decided.
- **No other tabs** (Draft, Episodes, Mid-Season, Scoreboard, Chat, Admin) — Overview only, per
  the phased/tab-by-tab plan.
- **Photos aren't ported as assets** — the Board grid shows initials only, not the live app's
  cast photos.
- **No signup/session-persistence UI polish, no routing beyond `/`** — the login form is
  functional but minimal (see `auth-gate.tsx`), and there's nothing beyond the one page yet.

## Stack

- Next.js 16 (App Router, Turbopack), TypeScript
- Tailwind CSS v4 + shadcn/ui (`base-nova` style/preset)
- Zustand for state (`src/lib/store.ts`)

## Getting started

```bash
npm install
npm run dev
```

Open http://localhost:3000 — defaults to demo data. To use real data, first get the
`SurvivorDraft` repo's dev server running locally with CORS enabled for this app's origin (see
that repo's README/CLAUDE.md), then add a `.env.local` here:

```
NEXT_PUBLIC_API_BASE=http://localhost:<survivordraft-dev-port>
```

and sign in with a real account on the "Sign in" screen (or click "Skip — use demo data instead").
