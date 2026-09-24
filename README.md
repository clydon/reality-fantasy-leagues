# Reality Fantasy Leagues — Next.js proof of concept

**This is a proof-of-concept spike, not the live app.** The live, actively-used Survivor Fantasy
Engine is the `SurvivorDraft` repo (vanilla JS/Express/Postgres) — see that repo's `CLAUDE.md`
and `docs/ARCHITECTURE.md`/`docs/HANDOFF.md` for full context on why this repo exists and what
it's validating.

## What this validates

Per `SurvivorDraft/docs/ARCHITECTURE.md`'s Phase 1 recommendation: React + Next.js (App Router) +
Tailwind CSS + shadcn/ui + Zustand, with the **Overview tab ported first** as a self-contained
validation case before committing to a full port of the live app. **All seven of the live app's
tabs are ported** (Overview, Draft, Episodes, Mid-Season, Scoreboard, Chat, Admin), with real
routing/navigation between them, plus an eighth (**League Settings**, `/setup` — see that section
below) that goes beyond a straight port: this repo is now moving past pure visual-parity
validation toward being the real product, per this session's direction (see "League types and
shows" below for the biggest example of that shift).

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
just by re-reading the code.

A later pass (see "Shared UI components" below) closed the remaining gap this section used to
flag — button/input/select styling everywhere, not just the sidebar/login/Board grid — against
`styles.css`'s `.btn`/`input[type=...]` rules exactly.

Ported so far: the full Overview tab — Side Bets section (propose a bet, guess, commissioner
grading, delete), the three dashboard cards (Latest Episode, Season Status, Standings), and the
post-draft Board grid (castaways by tribe, with cast photos, ownership, elimination medals) — using the live app's
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
order (reorder via ↑↓ buttons, which hide rather than render disabled at the ends of the list;
drag-and-drop itself isn't ported, but the live app's own touch-device fallback already *is* this,
so nothing loses its accessible equivalent), the
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
- **A real emoji picker ([`emoji-picker-react`](https://www.npmjs.com/package/emoji-picker-react)),
  not the live app's emoji-mart.** An initial pass used a fixed 5-emoji palette as a stand-in,
  since emoji-mart is explicitly called out in the original code as unable to fit the declarative
  render model (`new EmojiMart.Picker(...)` builds a real DOM node imperatively) — it's the one
  part of the live UI that was never a template-string render to begin with. `emoji-picker-react`
  solves that directly (a normal React component), so the fixed palette was replaced with it. No
  store/API changes needed — `toggleReaction`/`react()` already accepted any emoji string.

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

The league-switcher dropdown mentioned as missing here originally (this POC only ever loaded one
real league at a time) was added in a later pass — see "League switcher" below. The chat
unread-count badge mentioned as missing here originally was added in the Notifications pass, see
that section below. Rules isn't a tab in this POC at all, so the "More" sheet only lists what's
actually real here, not a 1:1 copy of every row the live app's sheet has.

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

## Notifications (`use-league-poll.ts`)

Port of `pollForNotifications()` (public/app.js) — but this one got real discussion first rather
than a straight port, since it's the one feature whose whole job is "poll and diff," and the
right tool for that deserved actual research (see the exchange in this repo's history) rather
than defaulting to whatever was already named in `ARCHITECTURE.md` or reflexively re-implementing
`setInterval` by hand.

**Chosen: TanStack Query** as the polling mechanism (`refetchInterval`, automatic pause while the
tab is hidden, request dedup) — matches `ARCHITECTURE.md`'s existing naming. The actual
transition-detection logic ("a bet now needs your guess," "it just became your turn") is a direct
port regardless of which library does the scheduling; no data-fetching library hands you that for
free, it's just diffing the current poll against the last one.

- `src/lib/use-league-poll.ts` — the main 15s poll, mounted once in `AuthGate`. Two `useQuery`s:
  one for league state (drives the Notifications banner + the Mid-Season nav badge, patching only
  `state.midSeason` on each tick rather than the whole state object, exactly like the original's
  own reasoning: a background poll landing mid-edit elsewhere, e.g. a half-filled Episode form,
  shouldn't clobber it), one for the chat-unread badge (skipped while actually on `/chat`, where
  `ChatTab`'s own faster 5s poll keeps it current instead).
- `src/lib/notifications-store.ts` — the resulting notification list (capped at 20, newest
  first) and the your-turn transition flag the diffing needs across polls.
- Chat itself also gained real polling in this same pass (it had none before — see the earlier
  gap note that used to be here): `ChatTab` polls every 5s while mounted, matching the live app's
  own `loadChatMessages` interval.
- Nav badges added throughout: Sidebar's per-tab counts, the Mid-Season "Your Turn"/"Active"
  badge (`midseasonBadge()` in `selectors.ts` — ported from `computeMidseasonBadge()`, including
  its "Your Turn" only when it's genuinely your own turn, never just because a viewer *can* act on
  it" principle), and the mobile top bar's chat-icon unread count + bottom bar's 4th-slot "!" badge.

**A real bug found via TanStack Query's own strictness, not by inspection**: a `queryFn` may not
resolve to `undefined` — `chat-store.ts`'s `load()`/`pollUnread()` both did in their early-return
branches, which silently surfaced as a Next.js dev-overlay error ("Query data cannot be
undefined... Affected query key: chat-unread-poll") caught during verification, not by reading
the code. Fixed by having both return a real value; the actual result still lives in the store as
before.

Verified against the real API and the fixture league, not just the mock dataset: advanced the
fixture league's real draft turn and left a real unguessed bet in place via direct API calls, then
loaded the app in an actual browser (desktop and mobile) and confirmed the Notifications banner,
Side Bets' "needs your guess" tag, the Season Status card, and every nav badge (Sidebar, mobile
top-bar chat icon, mobile bottom-bar Draft slot) all reflected that real state correctly — and
confirmed the dev-overlay error was gone after the fix.

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

## League types and shows (`state-logic.js`'s `LEAGUE_TYPES`/`SHOWS`)

The first real step past pure visual-parity validation: introducing a genuine **strategy pattern**
for how a league plays, not just another settings toggle. `LEAGUE_TYPES` now has two entries —
`'classic-draft'` (the snake draft + elimination-order scoring the live app already has) and
`'pickem'` (see "Pick'em" below) — without `DraftLogic`/`ScoringLogic` turning into a pile of
`if(leagueType===...)` special cases. The goal beyond these two is further league types with
entirely different mechanics still (hidden picks revealed at a point in the season is next; see
`docs/PLAN-league-types-and-wiki-connector.md`).

**`src/lib/game/state-logic.js` now forks from the live app's `shared/state-logic.js`** rather
than staying a verbatim copy (see that file's own top comment for the updated provenance note) —
the live repo is untouched by any of this, and there's no sync in either direction anymore. This
was a deliberate call: the live vanilla-JS app has no concept of league types and never will, so
continuing to pretend this file is "the same file, just copied" stopped being true or useful.

- `DraftLogic` and `ScoringLogic` are **thin dispatchers**: they read `state.settings.leagueTypeId`,
  look it up in `LEAGUE_TYPES`, and delegate every method to that entry's
  `draftStrategy`/`scoringStrategy`. `SnakeDraftStrategy`/`EliminationOrderScoringStrategy`
  (classic-draft) and `NoDraftStrategy`/`PickEmScoringStrategy` (pickem) are the two registered
  pairs today — the classic-draft pair renamed straight from the old `DraftLogic`/`ScoringLogic`
  bodies with zero logic changes, so every pre-existing league behaves identically to before this
  split (verified with a fixture script exercising add-player, draft turn/pick/undo, scoring, and
  old-state migration through the new dispatch path — see "Castaway ownership" below for the same
  treatment applied again for the `ownerIds` refactor).
- `SHOWS` is a second, smaller registry (today: Survivor only) for display/terminology metadata —
  not wired to any behavior yet, but the natural home for a future per-show config (e.g. where to
  source episode data from — see "Future: auto-sourcing episode data" below).
- `settings.leagueTypeId`/`settings.showId` are defaulted for new leagues, backfilled via
  `Migrations.migrateLeagueState` for old ones.
- Every `LEAGUE_TYPES` entry now also carries `hasRoster`/`hasWeeklyPicks`, orthogonal to the
  three `supports*` flags below: those three are about which MID-SEASON mechanics apply to an
  *existing* roster, while `hasRoster` is about whether a roster (and therefore a draft, the Draft
  tab, the Overview Board grid) exists at all, and `hasWeeklyPicks` is about whether this league
  type owes the frontend a per-episode pick UI (the Episode Card's "Your Pick" section — see
  "Pick'em" below). classic-draft is `hasRoster:true, hasWeeklyPicks:false`; pickem is the
  opposite. Sidebar/mobile-nav both read `hasRoster` to hide the Draft/Mid-Season tabs for a
  league type that has neither.
- Mid-Season's three panels (`mid-season-tab.tsx`) are gated on the active league type's
  `supportsReplenish`/`supportsTrade`/`supportsFinalePredictions` flags — all three are `true` for
  classic-draft and `false` for pickem, so no special-casing is needed in `mid-season-tab.tsx`
  itself, but the whole tab is now ALSO gated on `hasRoster` (pickem has no roster at all, so the
  tab would otherwise render nothing but its own static intro panel) with its own friendly message
  if the route is visited directly by URL despite being hidden from nav.

**Deliberately not done for classic-draft/pickem**: `ReplenishLogic`/`TradeLogic` still have their
own inline snake-round-reversal logic rather than being forced through `SnakeDraftStrategy` —
they're mid-season features of the current league type, not an independently-varying axis on
their own; if a future league type needs different replenish/trade behavior, give them the same
dispatcher treatment then.

### Castaway ownership is `ownerIds: string[]`, not a scalar owner

Castaway ownership is `castaway.ownerIds: string[]` for **every** league type, not
`ownerId: string | null`. Exclusive-ownership leagues (`'classic-draft'`, today's only shipped
type) are simply the case where the array never exceeds length 1 — that invariant is enforced by
the draft strategy, not by the data shape. The alternative, bolting a second parallel field onto
castaways for shared-ownership league types, would mean every ownership-aware call site branches on
league mode forever; one representation avoids that.

Read/write it through `Core`: `ownersOf`, `ownedCastawayIds`, `isOwnedBy` for reads,
`setOwner` (exclusive-mode convenience — clears then sets one owner, or clears entirely when passed
`null`) and `addOwner`/`removeOwner` (shared-mode primitives) for writes. **Writes always go
through those helpers** — that's where the one-owner-max invariant lives. Plain array reads
(`c.ownerIds[0]`, `c.ownerIds.includes(id)`) are fine where the caller already holds the castaway
object, which is what the UI call sites do.

Two things deliberately stayed as they were:

- `formerOwnerId` is still a single id. It's history/display only (the grayed-out `formerRoster` on
  the Scoreboard), never summed into a score, so it didn't need widening for this step.
- `freeAgents`/`activeOwnedCount` remain **exclusive-mode-only** helpers. A shared-ownership league
  has no concept of a free agent — nothing is ever removed from availability, so every pick offers
  the full cast every time. Shared-mode draft/roster UI just won't call them.

**The migration trap, and why `db/migrations/0003_castaway_owner_ids.sql` exists.** Ownership lives
inside the `leagues.state` JSONB column rather than in real columns, which makes it tempting to
call this a zero-migration change. It isn't: `withLeagueLock` (and every other
`SELECT state FROM leagues`) hands the stored JSON straight to the game logic **without** running
`Migrations.migrateLeagueState` — that only runs on backup import. So a code-only rename would have
left every existing league carrying an `ownerId` the new code never reads: empty rosters, and every
player's locked points silently reset to 0. Hence the one-time SQL conversion, which is idempotent
and preserves cast order. `Migrations.migrateLeagueState` folds the scalar into the array too, for
the separate case of importing an old JSON backup.

**Verified as a pure refactor**, not eyeballed: a fixture script drove a full Classic Draft league
(draft with undo/re-pick, owned *and* unowned eliminations, placement renumbering, side bets,
replenish, trade including the drop-someone-else's-castaway no-op, post-draft late-joiner activate,
disable/reclaim, finale, `removePlayer` releasing ownership) against the pre- and post-refactor
`state-logic.js` and diffed the two logs — byte-identical across all 33 recorded steps, the sole
intentional difference being the field name itself. A second pass then ran the same ground through
the real API and Postgres (16 checks) to confirm the array survives the JSONB round-trip.

**Future: auto-sourcing episode data.** Not built, but the direction this is headed: periodically
having an LLM fetch and structure per-show, per-season data (contestants, episode-by-episode
eliminations/exits — a source like the Survivor Fandom wiki has everything needed) and cache it,
rather than paying an AI-request cost per user action. `SHOWS`' per-show metadata is the natural
attachment point for that once it's built.

### Pick'em — a second `LEAGUE_TYPES` entry with no roster at all

Each episode, every player picks one still-active castaway they think survives; a correct pick
scores `settings.pickemCorrectPoints` (default 1 — this was never explicitly confirmed in the
design conversation this plan comes from, flagged in `docs/PLAN-league-types-and-wiki-connector.md`
and in `defaultState`'s own comment; change the default if the real answer turns out to be
something else). Picking the same castaway as the immediately-previous episode is rejected.

**Investigated before building, per the plan's own instruction**: could this be a thin wrapper
around the existing per-episode bet/prediction infrastructure (`BetLogic`) instead of new schema?
No — `BetLogic`'s guesses are free-text and manually graded by the commissioner, need company
(≥2 guessers) to pay out, and accumulate a list of guesses per bet rather than one-per-player. A
pickem pick is a specific castaway reference, auto-graded from `ep.events`, scored solo, and
carries a no-repeat-previous-episode business rule with no equivalent in `BetLogic` — different
enough on every axis that reusing it would mean bending its semantics rather than sharing them.
Built as its own class instead: `PickEmLogic` (`episode.picks: {playerId, castawayId}[]`, upserted
in place — see that class's own comment for the full reasoning) plus `PickEmScoringStrategy`
(reuses `ScoreRow.locked` as pickem's generic "core score" slot rather than widening the shared
`ScoreRow` shape for a second league type). Exactly the shape this file's own top comment already
warned a weekly pick'em league wouldn't fit (`DraftStrategy`) — so it isn't behind that dispatch;
`NoDraftStrategy` is registered as pickem's `draftStrategy` purely as an inert stand-in so
`DraftLogic`'s dispatch (and anything that calls through it) has something safe to call instead of
crashing, not as a real implementation.

**A real correctness bug caught during this build, not after**: the first version of
`PickEmScoringStrategy.compute` scored a pick as soon as it was submitted, before the episode it
was for had even happened — nothing in a future episode's `ep.events` yet to contradict a pick, so
every pending pick silently read as "correct." Fixed by skipping any episode with zero elimination
events logged (the same "hasn't happened yet" heuristic `EpisodeLogic.ensureUpcoming` already uses
elsewhere in this file), both in the scoring strategy and in `pickem-rows.ts`'s
`PlayerPickRow.correct` (which now reports `null`/"Pending" for those instead of a wrong verdict).

**No hidden-state design needed here** — unlike Feature A's blind draft (not yet built; see the
plan doc), the plan never asks for pickem picks to be hidden from other players before an episode
airs, so they live in the ordinary broadcast `state` like everything else, no new persistence
primitive required.

**Frontend**: the pick UI lives in `EpisodeCard` (`episode-pick-row.tsx`'s `EpisodePicksSection`,
gated on `leagueType.hasWeeklyPicks`) rather than a new top-level tab or page — Pick'em's weekly
action is inherently per-episode, and Episodes already has an established per-episode home for
player-submitted content (Side Bets), so this follows that same shape instead of inventing a
parallel one. Same self-or-commissioner-on-anyone's-behalf permission model as bet predictions.
Scoreboard gets its own row component (`PickEmLeaderboardRow`) rather than reusing
`LeaderboardRow` as-is — "Boot Order"/roster-detail language describes classic-draft's scoring
specifically and doesn't apply here. A second league type also exposed two latent gaps in
existing, previously-unreachable code, both fixed as part of this feature rather than left for
later: the League Type picker in League Info (`league-info-section.tsx`) was only ever "locked"
because `LEAGUE_TYPES` had exactly one entry — real now, so its lock condition needed broadening
from "draft started" (permanently false for pickem) to "any episode exists," or a pickem league
with weeks of history could still switch to classic-draft and silently orphan its data; and
`GeneralSettingsSection`/`PlayersSection`'s roster-size fields are now gated on `hasRoster` rather
than always shown.

**Verification**: a fixture script (matching the plan's own bullet almost line for line) drives
3-4 players through several episodes, checking scoring on both an eliminated and a survived pick,
that repicking last episode's castaway is rejected, that repicking an earlier non-consecutive
castaway is allowed, that two players can pick the same castaway (no cross-player exclusivity),
that a late joiner starts active immediately (no fair-turn-order concept to have missed, unlike
classic-draft), and old-save migration backfilling `episode.picks`/`settings.pickemCorrectPoints`.
A second pass ran the same ground through the real API and Postgres (9 checks) to confirm the new
routes and the JSONB round-trip.

### Shared ownership + blind draft (`settings.ownershipMode`)

Classic Draft runs one of two draft mechanics, paired to `settings.ownershipMode` (commissioner-set
in League Info, locked once the season is underway):

- **`exclusive`** (default, every pre-existing league) — today's `SnakeDraftStrategy`, unchanged.
- **`shared`** — `BlindDraftStrategy`: every player submits their whole set of picks privately, and
  nothing is revealed until *every* eligible player has locked in, at which point all picks reveal
  at once and the same castaway can end up on several rosters. This is what step 1's `ownerIds`
  array was for.

Both live under the same `'classic-draft'` league type; `getLeagueType(state)` applies the override
(see `CLASSIC_DRAFT_SHARED`), so call sites keep reading `getLeagueType(state)` and never need to
know `ownershipMode` exists.

**Unrevealed picks are NOT in `state` — they're in their own table, and that's the whole design.**
This was the one genuinely load-bearing decision in the feature. `state` is broadcast wholesale:
`GET .../state` and every mutation route return the entire JSONB blob to any league member, so picks
kept in it would be readable from anyone's Network tab before the reveal — the UI never rendering
them is irrelevant. The two options were a redaction layer (filter state per requester) or a
separate persistence path. **The deciding factor was failure mode, not effort:** redaction makes
every one of ~40 state-returning routes fail *open* — miss one, or add a route later without knowing
blind draft exists, and every player's picks leak silently. A separate table fails *closed*: routes
that serialize `state` cannot leak what was never in it, and exposing the picks takes deliberately
writing a route that does. For a privacy invariant that has to survive future edits by people who've
never heard of this feature, enforcing it by *where the data lives* beats enforcing it by
*remembering to filter*.

That splits the mechanic along its real seam:

- **Public, in `state`** — `state.blindDraft.lockedPlayerIds` (who has locked in, driving the
  "waiting on N players" UI) and `revealedAt`. Who has committed isn't secret.
- **Private, in `blind_draft_picks`** (`db/migrations/0004_blind_draft_picks.sql`) — *what* they
  picked. Everything touching that table lives in `src/lib/server/blind-draft.ts`, so there's one
  file to audit. Rows are deleted at reveal, since `ownerIds` is the durable record by then.

`state.blindDraft.lockedPlayerIds` is a published *mirror* of the table, rewritten from it wholesale
inside the same transaction on every lock/unlock — the table stays the source of truth, and the
"is everyone in?" decision is made against the table, never against the cached field.

**Reveal atomicity.** `withLeagueLock` grew a second mutator argument, the transaction's own
`client` (every other caller ignores it). Blind draft needs it because the insert, the "is everyone
in now?" read, and the reveal write all have to happen under the same `SELECT ... FOR UPDATE` row
lock — otherwise two players locking in at the same instant could both see "still waiting" (draft
never reveals) or both trigger the reveal (ownership applied twice).

**Deadlock avoidance.** The reveal waits only on players who *can* lock in:
`BlindDraftLogic.eligiblePlayers` excludes disabled seats (a departed player could otherwise stall
the draft forever) and inactive ones. A seat deleted outright has its submission dropped in the same
transaction; a seat merely *disabled* keeps any picks it already locked in, matching how a disabled
seat's roster and points are deliberately preserved elsewhere.

**One deliberate exception to this app's permission model.** Everywhere else, a commissioner can act
on anyone's behalf. Here they may **submit** for a player (someone has to be able to unblock a draft
stalled on an absent player) but may **not read** anyone else's submission, not even as super-admin —
the commissioner is normally also a player, so reading picks pre-reveal would hand one player perfect
information and defeat the mechanic. Submitting for someone is a visible, requested act; reading
their picks would be silent.

**Replenish and Swap availability is two independent things**, and `replenishAvailable(state)` /
`tradeAvailable(state)` in `state-logic.js` are the single place both are asked about (the
Mid-Season panels, the General Settings toggles and the `start` routes all go through them, so the
UI can't offer a round the route would refuse):

1. **Capability** — `supportsReplenish`/`supportsTrade` on the league type. Shared ownership sets
   both false, because each is a free-agent mechanic and shared mode has no free agents — nothing is
   ever removed from availability. Left on they'd be live buttons that silently accomplish nothing
   (`ReplenishLogic.assign`/`TradeLogic.swap` both refuse a castaway that already has an owner, and
   in shared mode every castaway does). This isn't the commissioner's call; it just doesn't mean
   anything there. A shared-mode replenish *could* instead mean "add any still-active castaway", but
   that's a design question the plan doesn't answer, so it's left out rather than guessed at.
2. **Choice** — `settings.replenishEnabled`/`settings.tradeEnabled`, commissioner toggles in General
   Settings, **both default off**. They're optional mid-season mechanics, not something every league
   runs. Both `start` routes enforce this server-side too, so the setting isn't UI-only. Old saves
   backfill to off like a new league, *except* where a round is already in flight — backfilling
   those to off would strand it with no UI left to finish or cancel it.

**Ripple this exposed in existing UI**, all fixed here: `SeasonStatusCard` rendered "?'s turn to
draft (pick undefined)" for a live blind draft (there is no turn — `currentTurn` is `null` until the
reveal); Mid-Season's static intro panel described mechanics that no longer exist; the Board grid and
the Castaways settings list showed only `ownerIds[0]` and so hid co-owners; Draft Results' Undraft
button is hidden in shared mode (it only receives a castawayId, so with several owners there's no
way to say which one to strip). The Draft tab swaps the turn-based
DraftOrder/Status/FreeAgents trio for a single `BlindDraftPanel`. `use-league-poll` now also syncs
the *whole* state when the blind-draft signature changes — the reveal rewrites ownership across many
castaways, which the deliberately-narrow `midSeason`-only patch can't carry; it's event-driven, not
the every-15s full overwrite that patch exists to avoid.

**Verification.** 48 pure-logic checks (mode pairing, turn semantics, eligibility/deadlock,
submission validation, multi-owner reveal, idempotence, and scoring where a shared castaway's
placement must count for *every* owner without double-counting) plus 23 through the real API and
Postgres. The headline one is a direct **leak test**: after a player locks in, each submitted
castaway id must appear *exactly once* in the served state blob — its own record in
`state.castaways` — and nowhere else; if the picks were stored in state under any key, or applied to
`ownerIds` early, the count would be higher. It also confirms reading another player's picks 403s,
that the reveal doesn't fire at 1-of-3 or 2-of-3 but does on the third, and that a contested castaway
lands on all three rosters. Exclusive mode was re-diffed byte-for-byte against its pre-change
baseline across all 33 fixture steps, and the existing exclusive (16) and Pick'em (9) API suites
were re-run green, since `withLeagueLock`'s signature and the player-delete route both changed.

### Active Roster — event scoring with a weekly lineup lock

The third `LEAGUE_TYPES` entry. You draft a roster exactly as in Classic Draft (same
`ownershipMode` pairing — snake for exclusive, blind for shared — and the same Replenish/Swap, all
reused unchanged), but each episode you field only part of it, and points come from what your
**active** castaways did that week rather than from elimination placement.

**`activeSlots`/`benchSlots` replace `teamSize` here, and roster size is derived, not
configured twice.** `rosterSize(state)` returns `activeSlots + benchSlots` for this league type
and `teamSize` for the others, and every draft mechanic asks through it. Keeping `teamSize` as
an independent number alongside the slots would let a commissioner set 3 against 3+2 slots and
produce a roster that can never fill its lineup, so the General Settings roster-size field is hidden
for this type.

**The plan's field name for the event log had to change, and it's the one correction worth knowing
about.** It specified `episode.events: [{type, castawayId}]` — but `episode.events` already
exists and already means **eliminations** (`{castawayId, method}`). It drives
`placementOrder`, it's what `EpisodeLogic.remove` walks to un-eliminate castaways, and it's the
"has this episode happened yet" signal for both `EpisodeLogic.ensureUpcoming` and Pick'em's
scoring. Writing an "immunity win" into it would have made Pick'em score that castaway as voted out
and made episode deletion try to un-eliminate them. They're genuinely different things — a
structural season fact versus a point-earning occurrence — so scoring events live in
`episode.scoringEvents` and eliminations keep `episode.events` untouched.

**The weekly lineup lock, and why retroactivity is impossible rather than merely avoided.** Lineups
are stored **per episode** (`episode.lineups[playerId]`), never as one mutable "current active
set" with snapshots copied off it. Last week's lineup lives on last week's episode object, so
editing this week's cannot reach back and change what last week scored — there is no single current
set for the snapshots to drift away from. Scoring reads each episode's own `lineups`, so a benched
castaway scores nothing by construction: "benched" just means "not in this episode's lineup", and
there's no separate bench list to keep in sync.

`episode.lineupsLocked` is a **separate, explicit commissioner action**, deliberately *not* derived
from whether the episode has eliminations logged yet (the heuristic used elsewhere for "has this
episode happened"). Deriving it would be backwards: the lock is meant to land *before* the episode
airs — you commit your lineup without knowing the outcome — while eliminations are entered *after*,
so a derived lock would leave a window in which someone could rewrite their lineup already knowing
what happened. The commissioner can reopen a lock, since locking a week early otherwise has no way
back.

New episodes **carry the previous episode's lineup forward** so players adjust rather than retype
each week, filtered to what they still own — a castaway lost to Replenish or Swap since then isn't
theirs to field. Newly replenished castaways **start benched** with no special code: they simply
aren't in any lineup until someone puts them there.

**Event catalog + configurable points.** `ACTIVE_ROSTER_EVENTS` in `state-logic.js` holds the
v1 set (individual immunity, tribe immunity, reward, idol/advantage found, idol/advantage played,
safe at Tribal with zero votes). Adding an entry there automatically gives it a settings input and
makes it selectable in the entry UI. `settings.eventPoints` overrides per league and falls back to
the catalog default, so **0 means "switched off"** rather than "unset" — which is why `pointsFor`
tests for a number instead of using `||`.

**Manual entry is the primary path and stays that way.** Every event type is commissioner-enterable
by hand from day one; the wiki connector (Feature D, investigated but unbuilt) is designed to
*propose* events into this same log for confirmation, not to replace the entry UI. Nothing here is
gated on connector coverage.

Scoreboard gets a third row component (`ActiveRosterLeaderboardRow`): "Boot Order" and a roster
list of placements describe exactly what this type doesn't score on, so the breakdown is which
events actually paid out, with the roster disclosure noting that being on the roster isn't enough.

**Verification.** 51 pure-logic checks and 18 through the real API and Postgres. The ones that
matter most: an active castaway's event scores while a benched one's doesn't; **rewriting a later
episode's lineup leaves an earlier episode's snapshot byte-identical** (asserted both in memory and
over HTTP); the same castaway's event scores in the episode they were active and not in the one they
were benched; the lock is not derived from eliminations existing; scoring events and eliminations
stay in separate fields with neither leaking into the other; replenished castaways start benched;
and trade behaves identically to Classic Draft's. Classic Draft's own fixture was re-diffed
byte-for-byte, and the blind-draft and Pick'em suites re-run green.

## League Settings tab (`src/components/setup/*`, route `/setup`)

Port of the live app's `renderSetup()` — the last major tab left unported, and the biggest single
tab the live app has. Same section boundaries as the original, one component per section: League
Info (name, draft schedule — hidden for a league type with no draft — plus the League Type/Show
pickers from `LEAGUE_TYPES`/`SHOWS` above, populated from the real registry; League Type is now
genuinely selectable since a second entry exists, locked once canManage is false or the season is
underway, Show still locked until a second entry exists too), Players (color/name edit, remove,
activate a post-draft late joiner — the roster-count badge and activation flow are hidden for a
league type with no roster), Tribes, Castaways, General Settings (hidden entirely for a league
type with no roster — every field there is a roster concept: roster size, the opt-in
Replenish/Swap toggles, and replenish order, itself shown only once Replenish is on),
Side-Bet/Finale settings (the latter gated on `supportsFinalePredictions`, same flag Mid-Season's
panel checks), Pick'em Settings (a single field, points per correct pick — gated on
`hasWeeklyPicks`, see "Pick'em" above), Active Roster Settings
(slots plus one point input per event type, generated from `ACTIVE_ROSTER_EVENTS` — gated on
`hasActiveRoster`), Backup (Export always works — pure client-side JSON
download of `state`, works identically in both modes; Import/Reset are live-only, Reset
additionally requires super-admin, matching the live app's server-side re-check beyond the route's
own commissioner gate), Invites (live-only, any member — see the Dashboard/invites section below),
and Leave League (live-only; afterward you land in your next league, or on the Dashboard if that
was your last).

Whole tab is visible to everyone; every field disables itself via `useCanManage()` rather than the
tab being gated, matching the live app's own "viewable by everyone, only commissioner edits" model
and banner text.

Every new `src/lib/api.ts` function (rename, settings, player/tribe/castaway CRUD, activate,
import, reset, leave) hits an **already-existing** SurvivorDraft backend route
(`server/routes/roster.js`, `server/routes/leagues.js`) — no backend changes anywhere in this
work. Verified against the real API and a throwaway fixture league/user, not just mock mode:
rename, both new settings fields, add/update/remove player/tribe/castaway, and confirmed reset is
correctly rejected (403) for a plain commissioner.

Also surfaced that `playerAccounts` (which player each account is linked to) was already being
fetched by `api.leagueState()` and thrown away — now wired into `useLeagueStore` so the Players
section can actually show it.

## League switcher (`src/components/league-switcher.tsx`)

The static league-name display in both `Sidebar` and `MobileNav`'s top bar becomes a real dropdown
listing every league the signed-in user belongs to — data that was already being fetched
(`GET /api/auth/me`) by `AuthGate`'s `loadFirstLeague` and discarded after picking `leagues[0]`.
Needed now that testing a second league (to try a future league type against, once one exists) is
an actual workflow, not just a hypothetical.

Each row shows the league's name, the user's role, and a league-type badge. `/api/auth/me` doesn't
return per-league settings, so the badge is resolved **lazily** — one `api.leagueState()` call per
not-yet-seen league, fired on first open rather than upfront. Fine at friend-group scale (a
handful of leagues per user); not built to scale further than that, and it doesn't need to be for
this app's actual audience. The lazy-fetch-and-cache logic is shared between the desktop and
mobile call sites via a `useLeagueTypeBadges` hook, so the two don't duplicate the async logic
while keeping their layouts as genuinely separate components (per this repo's existing mobile-
chrome convention — see the Mobile nav chrome section above).

`useLeagueStore` gained `leagues`/`setLeagues`/`switchLeague(id)` (the last calls
`api.leagueState` then the same load sequence `loadFirstLeague` already uses). `useMock()` now
also clears `leagues` for consistency, alongside the identity fields it already cleared — "switch
to demo data" is a full reset to anonymous, not a preview while staying signed in.

Verified against two real fixture leagues under one fixture user, through the actual login UI and
a live browser session: both leagues list with correct type badges, and switching leagues
correctly swaps the sidebar league name and the underlying store state.

## Dashboard, league invites, seat reclaim, admin users table

Built from `docs/PLAN-dashboard-admin-reclaim-invites.md`.

- **Dashboard** (`src/components/dashboard/dashboard.tsx`, also at `/dashboard`) — a signed-in user
  with zero leagues now gets a full-page join-by-code / create / pending-invites screen instead of
  demo data. `AuthGate` renders it with no Sidebar/MobileNav chrome; a leagueless super-admin can
  still reach `/admin` and `/reports` in the normal shell. Both league switchers gained a
  "+ Join or create a league" row that goes to `/dashboard`. The unauthenticated "Take a Tour" path
  is unchanged. `useLeagueStore` gained `clearLeague()` (drop the loaded league but keep identity,
  unlike `useMock()`) and a one-off `flash` message shown above the current tab.
- **Invites** (`league_invites`, `db/migrations/0002_invites.sql`) — any member (not just the
  commissioner) invites by username or email from League Settings. The identifier is stored as
  typed and matched case-insensitively against `"user".username`/`email` at read time, so inviting
  someone who hasn't signed up yet works. Routes: `GET/POST /api/leagues/[leagueId]/invites`,
  `DELETE .../invites/[id]` (sender or commissioner), `GET /api/me/invites`,
  `POST /api/invites/[id]/accept|decline` (server re-checks the invite is addressed to the caller).
- **Seat reclaim** — `RosterLogic.disablePlayer` now records `formerName` and
  `disabledFromUserId`; `reclaimPlayer` undoes the rename. Join-by-code and accept-invite share
  `src/lib/server/join-league.ts`'s `joinLeague()`, which reuses a disabled seat matched by account
  id (never by name) and returns `reclaimed: true` so the UI can say "Welcome back". It also runs
  as one locked transaction now; the old join route did an unlocked read-modify-write.
  **Limitation:** only self-serve Leave is reclaimable in practice. Admin account deletion records
  `disabledFromUserId` too, but that account id is gone for good, and re-signing up makes a new id.
  Admin "Delete Player" deliberately records no account id, so that seat stays kicked.
- **Admin users table** — sortable columns (username, email, created, last login), where last login
  is the newest Better Auth `session.createdAt` (no new column). A per-row Edit modal
  (`admin/user-edit-modal.tsx`) handles username/email (`PATCH /api/admin/users/[userId]` →
  `auth.api.adminUpdateUser`), password reset, per-league role/remove, and account deletion.
  The PATCH route checks username uniqueness itself and only sends a changed username, because
  the username plugin's update hook compares "taken" against the *admin's* session id rather than
  the target user's.

Verified with a throwaway script against the real dev server and database (58 checks covering
all four features, including authorization edges), plus a Puppeteer screenshot pass.

## Bet card & Side Bets redesign (`overview/bet-card.tsx`, `overview/side-bets-section.tsx`, `episodes/episode-bet-row.tsx`)

The one visual-parity call this repo made on purpose in the *other* direction: the live app's
bet-card controls were always bespoke, one-off classes (`.btn-cancel`/`.btn-submit`/
`.bet-guess-form input`/`.new-bet-form input`), never a variant of the shared `.btn`/
`input[type=...]` rule — so there was no existing CSS to port for a "matches the original" version
of shared components here. Asked to design something better long-term instead of preserving that
one-off styling, landed on:

- **`Badge`** (`src/components/ui/badge.tsx`, previously defined but unused anywhere in the app)
  for the "NEEDS YOUR GUESS" corner tag, the needs-your-guess count pill, the correct/incorrect
  result pills, and player-name pills — these were already pill-shaped in the live app's own CSS
  (`.bet-corner-tag`, `.guess-row .result`), confirmed by reading `styles.css` directly rather than
  assuming, so `Badge` was the right existing primitive for the job.
- A new **`Button` `size="xs"`** and **`Input`/`Select` `size="sm"`**, sized for a dense card grid
  — new design, not a port, chosen over adopting `ui/card.tsx` (also previously unused; its
  `ring-1 ring-foreground/10` shadcn convention doesn't match this app's actual established
  border-based card language, repeated by hand in ~15 files — using it here would have introduced
  a *third* visual language rather than converging toward one).
- Circular avatar-initial elements (creator/guesser color circles) stay plain `<div>`s, not
  `Badge` — the live app's own `.avatar-pill` is a fixed 20×20 circle, not a text pill, so `Badge`'s
  pill shape doesn't fit that job even though the name suggests it should.

Caught a real type error while wiring the new `size` prop into `Input`/`Select`: `<input>`/
`<select>` already have a native `size` HTML attribute (typed as `number` in React's DOM types),
so `size?: "default" | "sm"` needs `Omit<..., "size">` first or the intersection silently collapses
every prop on the component to `never` — caught by `npm run build`, not by inspection.

## Shared UI components (`src/components/ui/button.tsx`, `input.tsx`, `select.tsx`, `textarea.tsx`)

A visual-fidelity pass converting every hand-rolled `<button>`/`<input>`/`<select>` across the app
(Draft, Episodes, Mid-Season, Admin, Account, Login, Chat, Report an Issue) to four shared
components, each measured 1:1 against `public/styles.css` rather than left at Tailwind/shadcn
defaults:

- `button.tsx` — rewritten from shadcn's default variant set to match `.btn`/`.btn.secondary`/
  `.btn.danger`/`.btn.small` exactly (`default`/`secondary`/`destructive` variants, `default`/`sm`
  sizes only — shadcn's `outline`/`ghost`/`link` variants and `xs`/`lg`/icon sizes were unused
  across the whole app, confirmed by grep before removing them).
- `input.tsx`/`select.tsx` — ported from the live app's single shared
  `input[type=...],select{...}` rule (same padding/border/focus-ring values for both, since the
  original scopes them together).
- `textarea.tsx` — ported from `.modal-box select,.modal-box textarea`, the only place the live
  app uses a textarea at all (the report modal) — slightly larger padding/font than `input.tsx`,
  matching that scoped rule rather than reusing Input's values.

**Deliberately left bespoke at the time**, because the live app itself styles these differently
from `.btn`/`input[type=...]`:
- `bet-card.tsx`/`side-bets-section.tsx`'s guess/propose forms — the original scopes these to
  `.bet-guess-form input`, `.new-bet-form input`, `.btn-cancel`/`.btn-submit`, distinct classes
  from `.btn`, confirmed by reading `renderBetCard()`/`renderBonusBetsSection()` in `public/app.js`
  directly rather than assuming. Since this repo is no longer strictly chasing 1:1 visual parity
  with the live app (see "League types and shows" below), a later pass *did* rebuild these on
  shared components anyway — not the ones ported from the live app's CSS, but new ones designed
  for the job. See "Bet card & Side Bets redesign" below.
- The ✏️/✕ icon-toggle buttons throughout (episode edit toggle, chat message edit/delete) — still
  map to the live app's `.icon-btn` pattern, which has no shared component yet. Still bespoke.
- Chat message bubble controls (edit/save/cancel, reactions) — styled contextually against the
  message bubble's own `bg-primary`/`bg-secondary` background, not the standard card-background
  input/button styling `input.tsx`/`button.tsx` assume. Still bespoke.

Verified: `npm run build` + `npm run lint` clean, then Puppeteer screenshots of Episodes (expanded
card, both eliminations and side-bets forms), Draft (order ↑↓ buttons, Draft Results), and
Mid-Season (Replenish/Swap/Finale selects) in mock mode, confirming the rendered padding/borders/
focus states now match the live app rather than approximating it.

## Design tokens

The terracotta/cream palette from the live app's `public/styles.css` `:root` block is ported 1:1
into `src/app/globals.css`'s `:root` (mapped onto shadcn's semantic color slots — `--primary` is
the terracotta accent, `--background`/`--card`/`--border`/etc. follow the live app's
`--bg`/`--panel`/`--border`), plus a few extra `--color-*` theme entries (`panel-menu`, `accent-2`,
`good`) for tokens that don't have a natural shadcn slot. Same IBM Plex Sans / IBM Plex Mono
typefaces via `next/font/google`. This is meant to be a translation of the existing look, not a
redesign — see `ARCHITECTURE.md`'s styling rationale.

## Wiki connector (`db/wiki-sync.js`, `wiki_proposals`)

Pulls a season's cast off survivor.fandom.com and files it as a **pending proposal** for the
commissioner to confirm. Phase one of Feature D in
`docs/PLAN-league-types-and-wiki-connector.md`; the per-episode event half is not built yet.

**Nothing is ever applied automatically.** `db/wiki-sync.js` writes to the `wiki_proposals`
table, never to league state. Applying is a separate commissioner action in League Settings, which
is the whole point of the design and matters more than usual here because extraction is LLM-based.

**Shape of a run** (`node db/wiki-sync.js cast <leagueId> [--dry]`):

1. Read `settings.wikiSeason` (commissioner-set; the script refuses to guess).
2. Fetch `Survivor <N>` wikitext via the MediaWiki Action API, keeping the revision id.
3. Slice the `==Castaways==` section **deterministically** before the model sees it — a fixed
   cut can't drop a row the way asking the model to find the section might, and it keeps the
   extraction to ~1-2K tokens.
4. Extract with Claude using **structured outputs** (`messages.parse` + a Zod schema), so a
   response that doesn't fit the shape doesn't come back at all.
5. **Re-validate the content** against the league's own state (below).
6. Resolve photo filenames to real CDN URLs in one batched `imageinfo` call — deterministic, no
   model involved, so there's no chance of an invented image URL. Best-effort: anything unresolved
   just gets no photo, which `CastawayAvatar` already handles. (This composes with the
   deliberate choice of `<img>` over `next/image` — see "Cast photos" below — since these
   are arbitrary external hosts.)
7. File one pending proposal, with provenance.

**Shape-valid is not the same as correct, so validation is a separate layer.** The schema can't tell
you whether the model invented a tribe. `validateCast` rejects the entire run — rather than
filing a partly-trusted proposal someone might rubber-stamp — on duplicates, empty or implausibly
long names, no tribes at all, or a cast size outside 4-40. A castaway pointing at a tribe that isn't
in the extracted tribe list keeps the castaway and drops the unbacked link, reported as a note.

**Every proposal records provenance** — page titles, wiki revision ids, model, timestamp — shown in
the review UI. LLM extraction isn't reproducible from its inputs, so without this a commissioner
reviewing a proposal later has no way to tell what the model actually read.

**Applying is additive only**, matched on name case-insensitively (`RosterLogic.applyCastImport`).
Anything already in the league is left exactly as it is. The second reason is the load-bearing one:
overwriting would mean deleting and recreating castaways, which changes their ids — and ids are what
`ownerIds`, `episode.events`, `episode.picks`, `episode.lineups` and
`episode.scoringEvents` all reference. Replacing a drafted cast would silently orphan every one
of those.

**At most one pending proposal per league per kind** (a partial unique index), so a scheduled run
that fires twice before anyone reviews replaces its own earlier suggestion instead of stacking
duplicates. Rejected proposals are kept as resolved rows rather than deleted, so a rejected
suggestion doesn't reappear looking new on the next run.

**Choices made here were the user's, against my recommendation, and are worth knowing:** LLM
extraction rather than a deterministic wikitext parser (the investigation found the templates are
structured enough to parse, and footnote *anchors* — unlike their numbers — are stable across
seasons), and a scheduled script rather than an on-demand button. The strict schema, the separate
content-validation layer, and stored provenance all exist to blunt the non-determinism that choice
brings. Model is `claude-opus-5`; at ~1-2K input and ~1K output tokens a run costs on the
order of a cent, so model choice isn't the cost lever at this size.

**Verified** in three parts. Everything that doesn't need a credential (26 checks): the real
MediaWiki fetch and revision id, deterministic section slicing and its bounds, batched photo
resolution including files that don't exist, every validation guard (each fatal case and the
drop-the-unbacked-tribe case), the schema rejecting malformed shapes, and apply-into-state
preserving existing ids and photos. The review half through the real API and Postgres (18 checks):
pending listing, provenance round-trip, replace-not-stack, additive apply, re-apply adding nothing,
double-apply → 400, reject kept as history, cross-league apply → 404, and cascade delete with the
league.

**And, once a workspace-scoped key with credit was available: the model call itself, checked
against ground truth derived independently from the same wikitext (not from the model's own
output).** Ground truth was 18 castaways and their exact tribe assignments, read directly out of
the `==Castaways==` wikitext with a regex, before any extraction ran. A real `--dry` run against
`Survivor 44` matched it exactly: 18/18 names verbatim, all 18 tribe assignments correct, all 18
photos resolved to real `static.wikia.nocookie.net` URLs, zero invented castaways. A real
(non-dry) run was then taken through the full loop — filed, listed, applied via the real
`POST .../wiki-proposals/:id` route — landing in league state additively (39 = 21 seed + 18
imported) with tribes and photos correctly linked. Two things surfaced only by running against a
real key, both fixed: an org-scoped key needs a `anthropic-workspace-id` header (now
`ANTHROPIC_WORKSPACE_ID`, with an error message naming the fix instead of a raw 400), and API
errors now surface Anthropic's own message instead of the SDK's, which prefixes the status and
then embeds the whole raw JSON body.

## Cast photos (`public/photos/`, `components/castaway-avatar.tsx`)

The live app's cast photos are ported now (copied from `SurvivorDraft/public/photos`): 24 for the
demo/mock season at `photos/<key>.jpg` and 21 for the default seed cast at
`photos/s51/<name>.jpg`. Both sets were already referenced by code in this repo -- `defaultState()`
and `mock-state.ts` have always written those exact `photoUrl` values -- so nothing needed
renaming; the files simply weren't here, and no component rendered them.

**`CastawayAvatar` replaced six copies of the same initials block.** The live app repeats
`c.photoUrl ? <img ... object-fit:cover> : initials(c.name)` at every avatar site; this repo had
the initials half of that duplicated across the Board grid, Free Agents, Draft Results, the blind
draft picker, and both Trade grids. One component now takes the container classes from the caller, so
each site keeps its own size and shape (64px rounded square on the Board, 44px circles in the
pickers, 20px inline in Draft Results) and its own initials styling as the fallback.

**Two things needed care beyond copying files:**

- **Stored `photoUrl` values are relative without a leading slash** (`photos/s51/ana.jpg`),
  which works in the live app because it's a single page served at `/`. This app has real routes,
  so that same value on `/draft` would resolve to `/draft/photos/...` and 404.
  `castawayPhotoSrc()` normalizes it, while passing through anything with a scheme, a
  protocol-relative `//`, or an existing leading slash -- the Photo URL field in League Settings
  accepts arbitrary external URLs and those must not be mangled.
- **A `photoUrl` can point at nothing** (a hand-added castaway, a typo in that field, a dead
  external link), so the avatar falls back to initials on load error rather than showing a broken
  image icon.

A plain `<img>` rather than `next/image`, deliberately: that same Photo URL field accepts
arbitrary external hosts, and `next/image` rejects remote hosts not whitelisted in
`next.config` -- it would break exactly the case the field exists for, in exchange for
optimisation these small fixed-size avatars don't need.

**Verified** by computing every `photoUrl` the code actually generates and checking each resolves
to a real file (45/45), then creating a real league through the API and fetching all 21 of its
castaway photos over HTTP as genuine images, plus confirming a missing path 404s so the fallback
path is real. `castawayPhotoSrc` has its own 11-case check covering the relative, absolute,
protocol-relative, data-URI and empty forms. Not visually confirmed in a browser -- no browser
tooling was available in this session.

## Not done yet (intentionally, for this POC's scope)

- **`/account`'s UI is functional but minimal, and deliberately staying that way for now** — no
  email verification, no OAuth providers, no "change email" flow. Explicit direction: this needs
  to work out of the box for a friends-only launch with zero paid external services, which the
  current setup already satisfies (no `RESEND_API_KEY` needed — see that section above), so email
  verification/OAuth stay deprioritized rather than being a gap to close.

## Stack

- Next.js 16 (App Router, Turbopack), TypeScript
- Tailwind CSS v4 + shadcn/ui (`base-nova` style/preset)
- Zustand for state (`src/lib/store.ts`)
- Better Auth for this app's own account system (`src/lib/auth.ts`) — its own Postgres database
  via plain `pg`, no ORM
- TanStack Query for interval polling (Notifications, Chat — `use-league-poll.ts`)
- `emoji-picker-react` for Chat's reaction picker

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
