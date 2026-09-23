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

**Mobile nav chrome** (`src/components/mobile-nav/*`): port of the live app's Chess.com-style
top bar + bottom tab bar (`public/index.html`'s `.mobile-topbar`/`.mobile-bottombar`, populated by
`renderMobileNav()` in `public/app.js`) — the piece the earlier visual-fidelity pass explicitly
left out. A custom Tailwind breakpoint (`--breakpoint-nav: 880px` in `globals.css`) matches the
live app's single `@media (max-width:880px)` cutoff exactly, generating `nav:`/`max-nav:`
variants; `Sidebar` hides and `MobileNav` shows below it, mirroring `body.in-league`'s rules.
Includes the real SVG icon set (`icons.tsx`, copied from `MOBILE_ICONS`), the same 4th-bottom-slot
swap (Draft while the draft is running, Mid-Season once it's done, with the other one demoted
into the "More" sheet), and a working More sheet (backdrop + slide-up panel) with a real
log out (calls the actual `/api/auth/logout` route in live mode).

Two things this surfaced along the way, both fixed rather than left in:
- **A real layout bug**: `MobileNav`'s top bar uses `position:sticky`, which still participates in
  normal flex layout — nested inside the sidebar+main flex row, it became a flex item squeezing
  main's width on mobile instead of stacking above it. Moved outside that flex row entirely.
- **A demo-mode detail**: the live app hides the league-name button via `visibility:hidden` (not
  removed — layout space stays reserved) when there's no real league to switch to; matched exactly
  rather than conditionally rendering different text.

Not ported: the league-switcher dropdown (this POC only ever loads one real league at a time, so
there's nothing to switch between) and the chat unread-count badge (no unread tracking exists in
`chat-store.ts`). League Settings and Rules aren't tabs in this POC at all, so the "More" sheet
only lists what's actually real here, not a 1:1 copy of every row the live app's sheet has.

## Account system (`/account`, `/forgot-password`, `/reset-password`)

A real email+password signup with a working password-reset flow, using
[Better Auth](https://better-auth.com) — chosen deliberately over Auth.js/NextAuth after actually
researching current (2026) community consensus rather than defaulting to older training-data
familiarity. Magic-link-only was considered and rejected in favor of traditional password+reset,
per explicit direction.

**This is a separate, forward-looking account system, not a port of anything in the live app.**
`SurvivorDraft` has no email/signup at all today (accounts are commissioner-created,
username+password only) — this is what *this* product's own accounts look like per
`ARCHITECTURE.md`'s Phase 4 roadmap ("self-serve signup/OAuth"). It intentionally doesn't touch
the existing SurvivorDraft-login demo flow (`auth-gate.tsx`/`useLeagueStore`) at all: two
unrelated identity systems coexist in this repo on purpose, and `/account`+`/forgot-password`+
`/reset-password` bypass `AuthGate`'s SurvivorDraft gate entirely so they're reachable regardless
of demo/login state (see `PUBLIC_ROUTES` in `auth-gate.tsx`).

- `src/lib/auth.ts` — server instance. Its own Postgres database (`AUTH_DATABASE_URL`, a plain
  `pg.Pool` — no ORM, consistent with this project's conventions), **not** shared with
  `SurvivorDraft`'s database; that DB's `users` table means something else entirely. Schema
  applied via `npx @better-auth/cli migrate`.
- `src/lib/auth-client.ts` — the React client (`useSession`, `signIn`, `signUp`, `signOut`,
  `requestPasswordReset`, `resetPassword`), same-origin (unlike the SurvivorDraft calls, which
  cross origins over CORS).
- `src/app/api/auth/[...all]/route.ts` — the whole API surface in one Next.js route handler
  (`toNextJsHandler`).
- **No real email sending configured.** Without `RESEND_API_KEY` set, reset/verification emails
  are logged to the server console instead (see `sendAuthEmail` in `auth.ts`) — the entire signup
  → forgot-password → reset flow is fully exercisable locally with zero external dependency, one
  env var away from sending real mail via Resend.

Verified end-to-end against the real database (not just built): signed up a real account,
signed in, requested a reset, completed the reset using the actual token from the logged email
(confirmed it correctly `302`s from the emailed API link to `/reset-password?token=...`), then
confirmed the old password now fails and the new one works. Throwaway test account cleaned up
after.

## Reports tab (`/reports`) and Report an Issue

Port of `renderAdminReports()` and the `#reportModal`/`sendReport()` flow (`public/app.js`) — the
last two pieces from the "not built yet" list. Reports is its own super-admin-gated tab (own store,
`reports-store.ts`, deliberately separate from `admin-store.ts` — matches the live app keeping
Reports as a genuinely separate tab from Admin even though both need the same gate). It's also
the one place in this POC using a real `<table>` instead of the card-grid vocabulary everywhere
else, per the original CSS's own comment: "genuinely tabular data, unlike everything else here."

Report an Issue is a modal (`report-modal.tsx`, triggered from the Sidebar footer and MobileNav's
More sheet) that posts as the real signed-in SurvivorDraft user — `POST /api/reports` requires a
real session server-side, so it's only shown when authenticated.

**A real gating bug, caught by testing with a real account instead of just the seeded default
state**: Admin/Reports/Report-an-Issue were all originally gated on `mode !== 'mock'`, which
incorrectly blocked a real signed-in super-admin who simply has no personal league — `mode` only
flips to `'live'` once a league loads, so a league-less super-admin stays `'mock'` despite being
genuinely authenticated. Fixed by adding `useIsAuthenticated()` (backed by `userId`, which really
does only ever get set via a real login) and gating Admin/Reports on `isSuperAdmin` alone, and
Report an Issue on `useIsAuthenticated()` — this also fixed a related bug where "Log out" would
skip the real `/api/auth/logout` call for that same account, leaving a stale session cookie.

Verified against the real API and a fixture super-admin account: submitted a report through the
actual modal in a real browser, confirmed it appeared in the Reports table, deleted it (both via
the UI's own delete button, which correctly calls `window.confirm()` first exactly like the
original — a Puppeteer test script hit this directly, since headless Chrome auto-dismisses
confirm() with no handler, and via a direct API call to confirm the route itself works).

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
- **`/account`'s UI is functional but minimal** — no email verification, no OAuth providers, no
  "change email" flow. The core signup/signin/reset cycle is real and verified; polish beyond
  that wasn't in scope yet.
- **Buttons/inputs elsewhere still use Tailwind/shadcn defaults**, not measured 1:1 against the
  live app's `.btn`/`input[type=...]` CSS rules the way the sidebar, login screen, and Board grid
  now are — those got a rigorous screenshot-driven pass; the rest didn't yet.
- **Mobile nav's league-switcher dropdown and chat unread badge aren't ported** — see the mobile
  nav section below for why.

## Stack

- Next.js 16 (App Router, Turbopack), TypeScript
- Tailwind CSS v4 + shadcn/ui (`base-nova` style/preset)
- Zustand for state (`src/lib/store.ts`)
- Better Auth for this app's own account system (`src/lib/auth.ts`) — its own Postgres database
  via plain `pg`, no ORM

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

For the `/account` system (separate from the above — see that section), also add to `.env.local`:

```
AUTH_DATABASE_URL=postgres://<user>:<pass>@localhost:5432/<a database just for this>
BETTER_AUTH_SECRET=<any random string>
BETTER_AUTH_URL=http://localhost:<this app's dev port>
```

then apply the schema once: `npx @better-auth/cli migrate`. No email provider needed for local
dev — reset links get logged to the server console (see that section above).
