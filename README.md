# Reality Fantasy Leagues — Next.js proof of concept

**This is a proof-of-concept spike, not the live app.** The live, actively-used Survivor Fantasy
Engine is the `SurvivorDraft` repo (vanilla JS/Express/Postgres) — see that repo's `CLAUDE.md`
and `docs/ARCHITECTURE.md`/`docs/HANDOFF.md` for full context on why this repo exists and what
it's validating.

## What this validates

Per `SurvivorDraft/docs/ARCHITECTURE.md`'s Phase 1 recommendation: React + Next.js (App Router) +
Tailwind CSS + shadcn/ui + Zustand, with the **Overview tab ported first** as a self-contained
validation case before committing to a full port of the live app — now joined by a **second real
tab (Draft)** and real routing/navigation between them (`src/components/top-nav.tsx`, real
Next.js pages at `/` and `/draft`, not a client-side tab switcher), validating that this approach
holds up across more than one isolated tab.

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

**Draft tab** (`src/components/draft/*`, route `/draft`): direct port of `renderDraft()` — draft
order (reorder via ↑↓ buttons; drag-and-drop itself isn't ported, but the live app's own
touch-device fallback already *is* this, so nothing loses its accessible equivalent), the
not-started/in-progress/complete status banner, Draft Results (who each player originally
drafted), and Free Agents (click to draft, with the same commissioner-drafting-for-someone-else
confirm dialog). All four draft mutation routes (`force-start`, `order`, `pick`, `DELETE
pick/:id`) wired to the real API and verified against the fixture league, not just the mock path.
`AuthGate` moved up into the root layout so login/live-data state persists across tab navigation
instead of re-checking on every page.

**Episodes tab** (`src/components/episodes/*`, route `/episodes`): direct port of
`renderEpisodes()`/`renderEpisodeCard()` — expandable/collapsible episode cards (newest open by
default), episode number/post-merge fields, Eliminations (log/undo, with the same
already-replenished confirm warning as the original), and a fuller per-episode Side Bets editor
(`episode-bet-row.tsx`) than Overview's read-mostly version: editable label/points, remove-a-guess,
and the commissioner-can-guess-on-anyone's-behalf player picker. `renderUnsettledBetsPanel()`
isn't ported — it's pure duplication of signals already available elsewhere (Overview's "needs
your guess" count, inline grading here), so it wasn't validating anything new. All episode/
elimination/bet-editing mutation routes (`addEpisode`, `removeEpisode`, `updateEpisode`,
`addElimination`, `removeElimination`, `updateBet`, `removeBetPrediction`) wired to the real API
and independently verified against the fixture league.

**Mid-Season tab** (`src/components/mid-season/*`, route `/mid-season`): direct port of
`renderMidseason()` — Replenish (`replenish-panel.tsx`), Swap (`trade-panel.tsx`), and Finale
Predictions (`finale-panel.tsx`), same three-panel order as the original. The live app's
transient `tradeDropId` global becomes `TradePanel`'s own local state, same pattern as several
other converted flags elsewhere in this POC. Every route (`replenish/start`, `replenish/assign`,
`replenish/cancel`, `trade/start`, `trade/swap`, `trade/skip`, `trade/cancel`,
`finale/predictions/:id`, `finale/predictions/:id/winner`, `finale/actual/top3`,
`finale/actual/winner`) is commissioner-gated **server-side** (`requireLeagueRole('commissioner')`
for Replenish/Swap; an explicit per-route check for Finale's Actual Result), and this repo's
`useCanManage()` gating matches that exactly — a member never sees a control they'd be rejected
for using.

**Scoreboard tab** (`src/components/scoreboard/*`, route `/scoreboard`): direct port of
`renderScoreboard()` — a pure-read tab, no mutations at all, so it needed no `use-mutate.ts`
wiring. Per-player leaderboard rows with Roster detail and Bonus bets breakdowns, using the
native `<details>` element directly rather than `useState` for the disclosure toggles — unlike
the toggle flags converted to local state elsewhere in this POC, there was no shared/global state
here to eliminate in the first place, so `<details>` is the more direct translation, not a step
backward.

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
- **No other tabs yet** (Chat, Admin) — Overview, Draft, Episodes, Mid-Season, and Scoreboard so
  far, per the phased/tab-by-tab plan.
- **Photos aren't ported as assets** — the Board grid shows initials only, not the live app's
  cast photos.
- **No signup/session-persistence UI polish** — the login form is functional but minimal (see
  `auth-gate.tsx`).

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
