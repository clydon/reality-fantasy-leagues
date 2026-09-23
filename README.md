# Reality Fantasy Leagues — Next.js proof of concept

**This is a proof-of-concept spike, not the live app.** The live, actively-used Survivor Fantasy
Engine is the `SurvivorDraft` repo (vanilla JS/Express/Postgres) — see that repo's `CLAUDE.md`
and `docs/ARCHITECTURE.md`/`docs/HANDOFF.md` for full context on why this repo exists and what
it's validating.

## What this validates

Per `SurvivorDraft/docs/ARCHITECTURE.md`'s Phase 1 recommendation: React + Next.js (App Router) +
Tailwind CSS + shadcn/ui + Zustand, with the **Overview tab ported first** as a self-contained
validation case before committing to a full port of the live app. **All seven tabs are now
ported** (Overview, Draft, Episodes, Mid-Season, Scoreboard, Chat, Admin), with real
routing/navigation between them — the full live app's tab set, not just the one-tab proof of
concept the plan called for as a first checkpoint.

`ARCHITECTURE.md` is explicit that this should be **"a translation, not a redesign"** — visual
parity with the live app is a real goal here, not a nice-to-have. A side-by-side screenshot
comparison (Puppeteer, since browser automation was unavailable this session — see
`docs/HANDOFF.md`) surfaced a real gap: the sidebar chrome had never been ported at all (a
placeholder top-tab-bar stood in for it), several Board-grid card details were wrong (badge
corner/color, no eliminated-✕ overlay, owner names styled as colored pills instead of the
original's plain text), and the login/demo-content fallback had an actual bug — both were
rendering stacked on the same page instead of being mutually exclusive. All three are fixed now
(`src/components/sidebar.tsx`, `src/components/login-screen.tsx`, `board-grid.tsx`, and
`auth-gate.tsx`'s rewritten state machine), verified by re-screenshotting and comparing again, not
just by re-reading the code. What's genuinely still approximate rather than measured 1:1 against
`styles.css`: exact button/input styling elsewhere (still using Tailwind/shadcn defaults, not the
live app's `.btn`/`input[type=...]` rules), and the mobile bottom-tab-bar chrome isn't ported —
this sidebar is desktop-only.

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

**Chat tab** (`src/components/chat/*`, `src/lib/chat-store.ts`, route `/chat`): port of
`renderChat()`/`renderChatMessage()`, with two deliberate simplifications flagged here rather
than silently cut:

- **No auto-polling.** The live app refreshes chat every 5 seconds; no tab in this POC has any
  live-refresh yet (everything fetches once via `AuthGate`), so Chat doesn't introduce that
  infrastructure alone. A manual Refresh button stands in for it. Same underlying reasoning as
  the Notifications banner staying unported.
- **A fixed 5-emoji reaction palette (👍😂😮🔥🎉) instead of the live app's full emoji-mart
  picker.** That library is explicitly called out in the original code as unable to fit the
  declarative render model (`new EmojiMart.Picker(...)` builds a real DOM node imperatively) —
  it's the one part of the live UI that was never a template-string render to begin with. The
  underlying capability (`toggleReaction`/`react()` takes any emoji string) isn't missing, just a
  full picker UI, if that's ever wanted.

Chat's data lives in its own Postgres tables (`chat_messages`/`chat_reactions`), not the JSONB
league state, so it gets its own Zustand store (`chat-store.ts`) rather than folding into
`useLeagueStore` — reads `mode`/`leagueId`/`userId` from that store rather than duplicating them.
Send/edit/delete/react all wired to the real API and independently verified against the fixture
league. `annotateMentions()` (owned-castaway names get a small colored owner badge inline) is
ported as a proper React component (`mention-text.tsx`) rather than HTML-string concatenation —
React auto-escapes text content, so this needed no `esc()` equivalent at all.

**Admin tab** (`src/components/admin/*`, `src/lib/admin-store.ts`, route `/admin`): direct port
of `renderAdmin()`. Unlike every other tab, Admin has **no mock-mode equivalent at all** — the
live app never shows its nav link to non-super-admins in the first place, demo mode included — so
`admin-store.ts` only ever makes real API calls, and `Sidebar`/`AdminTab` both replicate that
same-origin gate (`useIsSuperAdmin()`) rather than just leaving the tab inert for non-admins.
Cross-league scope (all users, all leagues — not the single league `useLeagueStore` holds), so it
got its own store. Surfaced and fixed a real gap this uncovered: "My Leagues"
(`GET /api/auth/me`) reflects real membership only, even for a super-admin, so a pure super-admin
with zero personal leagues would never have reached `loadLive()` at all under the original
`AuthGate` logic — `useLeagueStore` gained a separate `setIdentity()` action so identity
(`userId`/`isSuperAdmin`) is known independent of whether the signed-in account has a league of
its own to show. Verified against a dedicated fixture super-admin account created via the live
repo's own `db/create-super-admin.js`, including that exact zero-leagues case; all read routes
plus a full create→reset-password→delete cycle on a disposable throwaway user (never touching
the shared dev database's existing users/leagues).

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
- **Photos aren't ported as assets** — the Board grid shows initials only, not the live app's
  cast photos.
- **The Reports tab** (`renderAdminReports()`, super-admin-only bug/feature report inbox) and the
  in-app "Report an Issue" submission modal — a separate, smaller super-admin utility not named in
  `ARCHITECTURE.md`'s Phase 1 tab list (Overview/Draft/Episodes/Mid-Season/Scoreboard/Chat/Admin,
  all now done), so it wasn't in scope for validating that list.
- **No signup/session-persistence UI polish** — the login form is functional but minimal (see
  `auth-gate.tsx`).
- **Mobile nav chrome isn't ported** — the sidebar (`sidebar.tsx`) is desktop-only; the live app's
  Chess.com-style bottom-tab-bar + top-bar for narrow viewports (a separate, sizeable section of
  `public/app.js` per `CLAUDE.md`) is a distinct piece of work not started here.
- **Buttons/inputs elsewhere still use Tailwind/shadcn defaults**, not measured 1:1 against the
  live app's `.btn`/`input[type=...]` CSS rules the way the sidebar, login screen, and Board grid
  now are — those three got a rigorous screenshot-driven pass; the rest didn't yet.

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
