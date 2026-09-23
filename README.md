# Reality Fantasy Leagues — Next.js proof of concept

**This is a proof-of-concept spike, not the live app.** The live, actively-used Survivor Fantasy
Engine is the `SurvivorDraft` repo (vanilla JS/Express/Postgres) — see that repo's `CLAUDE.md`
and `docs/ARCHITECTURE.md`/`docs/HANDOFF.md` for full context on why this repo exists and what
it's validating.

## What this validates

Per `SurvivorDraft/docs/ARCHITECTURE.md`'s Phase 1 recommendation: React + Next.js (App Router) +
Tailwind CSS + shadcn/ui + Zustand, with the **Overview tab ported first** as a self-contained
validation case before committing to a full port of the live app.

Ported so far: the three Overview dashboard cards (Latest Episode, Season Status, Standings),
using the live app's `shared/state-logic.js` **copied in verbatim** (`src/lib/game/state-logic.js`
— see the provenance comment at its top) against a ported copy of the live app's mock/demo season
data (`src/lib/game/mock-state.ts`). No real API wiring yet — see "Not done yet" below.

## Design tokens

The terracotta/cream palette from the live app's `public/styles.css` `:root` block is ported 1:1
into `src/app/globals.css`'s `:root` (mapped onto shadcn's semantic color slots — `--primary` is
the terracotta accent, `--background`/`--card`/`--border`/etc. follow the live app's
`--bg`/`--panel`/`--border`), plus a few extra `--color-*` theme entries (`panel-menu`, `accent-2`,
`good`) for tokens that don't have a natural shadcn slot. Same IBM Plex Sans / IBM Plex Mono
typefaces via `next/font/google`. This is meant to be a translation of the existing look, not a
redesign — see `ARCHITECTURE.md`'s styling rationale.

## Not done yet (intentionally, for this POC's scope)

- **No real API wiring.** Uses the ported mock/demo dataset only. Wiring to the live Express API
  needs CORS added there (currently none) since dev servers run on different origins/ports —
  worth scoping as its own small change to the live repo before real data flows here.
- **Notifications banner, Side Bets section, and the post-draft Board grid** — each a meaningful
  chunk of interactive state, deliberately left for a later pass once the card-grid approach here
  is validated.
- **No other tabs** (Draft, Episodes, Mid-Season, Scoreboard, Chat, Admin) — Overview only, per
  the phased/tab-by-tab plan.
- **No auth, no routing beyond `/`.**

## Stack

- Next.js 16 (App Router, Turbopack), TypeScript
- Tailwind CSS v4 + shadcn/ui (`base-nova` style/preset)
- Zustand for state (`src/lib/store.ts`)

## Getting started

```bash
npm install
npm run dev
```

Open http://localhost:3000.
