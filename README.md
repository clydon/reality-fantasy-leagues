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
- `SHOWS` **is no longer a registry** — shows and their seasons moved into Postgres and are managed
  by a super-admin in the Admin tab (see "Shows & seasons catalog" below). What's left in
  `state-logic.js` is only the bootstrap default for a new league's `settings.showId`. League types
  stayed in code because a league type *is* code (a draft strategy plus a scoring strategy); a show
  is data, and needing a deploy to add one was the wrong shape.
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

## Guided first-time setup and per-show terminology

Three problems that only showed up once a second show existed, and all three had the same root
cause: the app assumed Survivor.

**A new league arrived pre-loaded with the wrong show's cast.** `defaultState()` seeded
`SEED_CASTAWAYS` — 21 Survivor 51 names with `photos/s51/...` URLs — so a Traitors league opened with
21 strangers in it that the commissioner had to delete by hand. A real league's cast comes from the
commissioner or the wiki connector, so a new league now starts **empty**. `SEED_CASTAWAYS` stays
exported as sample data, but nothing applies it; the demo league (`buildMockSeasonState`) has always
built its own cast and is unaffected. Note that `POST /:id/reset` goes through `defaultState()` too,
so a reset now leaves an empty league rather than a Survivor-51 one — the honest meaning of "reset".

**Creating a league dropped you on Overview**, which for a league with no show, no season and no cast
has nothing to show. Creation now lands on `/setup`. Joining an existing league still goes to
Overview, where the interesting thing is.

**Five questions have to come first**, in this order: name, show, season, league type, ownership. Two
of them are expensive to get wrong — league type and ownership both lock the moment a draft runs or an
episode is logged — and the rest of the tab depends on them (there's no point entering a cast before
the season is known, and the Pick'em / Active Roster / finale panels are each specific to a league
type nobody has chosen yet). So `SetupTab` hides everything below League Info, and League Info
becomes a short wizard: a checklist, one question revealed at a time, and a button that ends the
guide.

The ordering and done-ness live in **`SetupLogic`** in `state-logic.js`, not in the component, so
they're testable without React and so the reveal, the checklist and the gate all share one definition
of "answered".

- `settings.showId` is now `null` on a new league instead of `'survivor'` — nobody has chosen yet,
  and pretending otherwise is what made "pick your show" invisible. `settings.wikiSeason` was already
  null.
- `leagueTypeId` and `ownershipMode` keep working defaults, because `getLeagueType()` and every
  strategy lookup must resolve to something from the first render. Their steps are flagged
  `defaulted`, so the checklist shows `(Classic Snake Draft, default)` rather than a tick that would
  claim a human chose it. Confirming setup is what turns those into real decisions.
- **`settings.setupComplete` is `false` only on leagues created after this shipped.** Every league
  that predates it has no such key, and `SetupLogic.isComplete` treats anything that isn't an
  explicit `false` as complete — so no migration, and no established league gets sent back through
  setup just because it never set a `wikiSeason`.
- Changing the show clears the season, because a season number belongs to a show: `44` means Survivor
  44, not Traitors 44.
- The connector now **refuses** a league with no show rather than falling back to `'survivor'`. That
  fallback was a wrong answer that looked like a working one — it's how a Traitors league ends up
  fetching Survivor's wiki. Same for a `showId` whose catalog row has been deleted, and for a show
  with no wiki API endpoint.

**Per-show terminology is now actually read.** `shows.castaway_term`/`tribe_term` have existed since
the hardcoded `SHOWS` registry and became editable with the admin catalog, but *nothing read them* —
so a Traitors league still said "castaway" and "tribe" in every label, dropdown, confirm dialog and
hint. `src/lib/use-show-terms.ts` is what reads them: `useShowTerms()` returns
`{Castaway, Castaways, castaway, castaways, Tribe, Tribes, tribe, tribes}` for the loaded league's
show, and ~25 components use it instead of hardcoded words.

- Terms come from the **catalog**, not copied into league state, so editing them in Admin takes effect
  everywhere at once rather than only in leagues created afterwards. The cost is that the first paint
  uses Survivor's defaults and swaps when the query resolves; one shared `queryKey` plus a long
  `staleTime` keeps that to once per session, and the Show/Season pickers share the same fetch.
- Both a singular and a plural are derived from whatever was typed, **in either direction**. That's
  not hypothetical: the field is labelled as a singular and the first person to use it typed
  `Contestants`, which a naive pluralizer turns into "Contestantses". `-ss/-us/-is/-sh/-ch/-x/-z` are
  excluded from the already-plural test because those endings belong to singulars (Class, Bus, Iris).
- Terminology is editable after creation now, in the expanded show row in Admin — getting it wrong
  shouldn't mean recreating the show and orphaning its leagues.

**Verified** with 43 checks: `SetupLogic`'s ordering as pure logic (the five steps in order, one
revealed at a time, the ownership step dropping out for a rosterless league type, `defaulted` flags,
each step's reported value, a cleared season re-opening its step, and a pre-guided-setup league never
being gated), then the same walk through the real API and Postgres (empty cast and null show both
returned *and* persisted as JSONB, the creator still added as first player, each answer saved,
confirmation persisted, season cleared on a show change, and the connector refusing a league with no
show). The pre-existing suites were re-run green after being updated to build their own casts —
48/23/51 on the pure blind-draft/Pick'em/Active-Roster fixtures, 18/23/9/18 on their API suites, 35/35
on shows — and the exclusive-draft byte-diff baseline is identical apart from the two intended
`settings` lines once random ids are normalized (the fixture now builds its cast explicitly so it runs
against both the old and new `state-logic.js`, which is the only way that diff means anything).

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

## Shows & seasons catalog (Admin tab, `shows`/`show_seasons`)

Shows used to be a hardcoded registry in `state-logic.js` with exactly one entry, so adding a
second show meant a code change and a deploy. They're database rows now, managed by a super-admin
in the Admin tab: a show, and under it any number of seasons.

**Why shows moved but league types didn't.** A league type is *code* — a draft strategy paired with
a scoring strategy — so it can only ever be one of the things that have been written, and
`LEAGUE_TYPES` stays in `state-logic.js`. A show is *data*. Keeping it in code meant a
deploy to add one, for no benefit.

**`state-logic.js` deliberately cannot read these tables.** That file is a fork of one the
live app loads straight into a browser with no bundler, and its freedom from any DB dependency is
load-bearing. So the catalog is consumed by the UI over `/api/shows`, and what remains in
`SHOWS` is only the bootstrap default for a new league's `settings.showId`.

**No league-state migration was needed**, because leagues reference the catalog by *value*, not by
foreign key: `settings.showId` holds the show's `slug` and `settings.wikiSeason` a
season number. Existing leagues already held `'survivor'`, which is exactly what the migration
seeds. It also means a show row can be renamed or rebuilt without orphaning a league — which is why
the slug is derived once on creation and then never editable, while the display `name` is.

**The wiki URL is the friendly input.** The MediaWiki Action API needs two separate things: an API
endpoint and a page title. Rather than ask an admin to understand that, a season takes the URL from
the browser address bar (`https://survivor.fandom.com/wiki/Survivor_44`) and
`src/lib/server/wiki-url.ts` derives both from it. The raw URL is stored alongside the derived
title so it stays visible and checkable, and the title is independently editable for a wiki whose
URL scheme and canonical page title differ. A URL that doesn't parse is **refused at the route**
rather than stored, because the alternative is the connector failing later with a far less obvious
message. Adding a season to a show that has no API endpoint yet backfills it from that URL.

**Fields, and what each is actually for:**

| Field | Why it exists |
|---|---|
| show `name` / `slug` | Display label vs. the immutable identity leagues reference |
| `castaway_term` / `tribe_term` | Existed in the old registry and in the `Show` type but was never read *at all* until the terminology work below — the whole UI said "castaway"/"tribe" regardless. Editable after creation too, and they also drive which wiki section the connector looks for |
| `cast_section_heading` | Added in `0007`. Override for the wikitext section holding the cast, for a wiki that calls it something the candidate list can't guess. NULL — the normal case — means infer it from `castaway_term` |
| `wiki_api_url` | Per show, since different shows live on different wikis — this is what made a single hardcoded endpoint in the connector wrong |
| season `wiki_page_title` / `wiki_url` | The connector's actual target, plus the input it was derived from |
| `status` (upcoming/airing/completed) | Lets the connector skip seasons not worth fetching, and the Season picker mark what's live |
| `cast_size` | Closes a real gap: League Settings' shared-ownership nudge compares players x roster size against the cast, and before this it had nothing to compare against until someone had typed the whole cast in. It can now be specific from the moment a season is picked |
| `premiere_date` / `finale_date` | Season framing, and a basis for "currently airing" |
| show `archived` | Retire a show without deleting it |

**Archive vs. delete is an informed choice, not a guess.** The admin list shows how many leagues
reference each show, and deleting one that's still in use is **refused with a 409** that names the
count and points at archiving instead — deleting would leave those leagues pointing at a slug that
resolves to nothing. Archiving hides a show from the commissioner picker while every league already
on it keeps working. Deleting a *season* only warns (it reports how many leagues referenced it),
because a league survives that fine — the connector just falls back to guessing a page title.

**Two read surfaces, deliberately.** `/api/shows` is commissioner-facing: any signed-in user,
non-archived shows only, and none of the admin-only fields (no `wiki_api_url`, no
`league_count`) — asserted in the tests, since managing the catalog is a super-admin job but
*choosing* from it is an ordinary commissioner one. `/api/admin/shows` returns everything.

**Connector wiring.** `db/wiki-sync.js` resolves the page title and API endpoint from the
catalog by (show slug, season number). With no catalogued season it falls back to the old
`<Show> <N>` guess and **says** it's guessing, rather than hard-failing — a league set up before
the catalog existed still works. Provenance now records the show slug and API endpoint too: with a
multi-show catalog, "season 44" alone no longer identifies what was read.

**Verified** with 29 checks through the real API and Postgres: the seeded Survivor row and its
season, both read surfaces (including that the commissioner one doesn't leak admin fields), slug
derivation, duplicate show → 409, duplicate season → 409, empty name and season 0 → 400, URL → page
title derivation, a non-wiki URL refused, API-endpoint backfill, status/cast-size edits, overriding
a derived title, archive hiding a show from the commissioner catalog but not the admin one, delete
refused while leagues use it, delete allowed once unused, and both routes requiring auth. Plus the
connector resolving a real title from the catalog and falling back with a warning when
uncatalogued, and 13 cases over the URL parser (Fandom, a non-Fandom host, percent-encoded and
colon-bearing titles, `index.php?title=`, a copied `#anchor`, and six shapes that must
return null rather than a guess).

## Wiki connector (`db/wiki-sync.js`, `wiki_proposals`)

Pulls a season's cast, and its per-episode results, off the show's wiki. Nothing it reads is ever
applied on its own: the **cast** is staged for an admin to review and approve once per season (see
"Cast approval is the admin's" below), and **per-episode results** are filed as pending decisions
for each league's commissioner to confirm. Both phases of Feature D in
`docs/PLAN-league-types-and-wiki-connector.md` are built:

    node db/wiki-sync.js cast <leagueId>       # the season's cast and starting groups
    node db/wiki-sync.js episodes <leagueId>   # per-episode eliminations + Active Roster events
    node db/wiki-sync.js <command> <leagueId> --dry   # extract and print, write nothing

**Nothing is ever applied automatically.** `db/wiki-sync.js` writes to `season_cast` (staged, for
admin review) and `wiki_proposal_items` (pending, for commissioner review), never straight to league
state. A human approving is the whole point of the design and matters more than usual here because
extraction is LLM-based.

**Shape of a run** (`node db/wiki-sync.js cast <leagueId> [--dry]`):

1. Read `settings.showId` and `settings.wikiSeason` (commissioner-set; the script refuses to guess
   either, and refuses outright rather than assuming Survivor — see below).
2. Resolve the page title and wiki API endpoint from the catalog, then fetch the wikitext via the
   MediaWiki Action API, keeping the revision id.
3. Find and slice the cast section **deterministically** before the model sees it — a fixed cut
   can't drop a row the way asking the model to find the section might, and it keeps the extraction
   small. Which heading, and what to do when the section is pure transclusion, are both per-show
   questions; see "Making the connector work for a second show" below.
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
long names, or a cast size outside 4-40. A castaway pointing at a tribe that isn't in the extracted
tribe list keeps the castaway and drops the unbacked link, reported as a note. "No tribes at all" used
to be fatal too, on the assumption that every show divides its cast into groups; that's true of
Survivor and not true in general, and refusing the run leaves the commissioner with nothing to look at
instead of a cast list with no groupings — so it's a note now. Nothing is applied without their
confirmation regardless, which is where a genuinely wrong extraction gets caught.

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

### Photo URLs: cutting Fandom's revision suffix (db/migrations/0012)

MediaWiki's `imageinfo` API returns a file's URL in a revision form:

    https://static.wikia.nocookie.net/survivor/images/5/57/S51_aaliyah_t.png/revision/latest?cb=20260904163427

which does **not** load from another site. Every imported castaway fell back to initials, and because
`CastawayAvatar` degrades to initials on error rather than showing a broken image, it looked like the
photos simply hadn't been found. The canonical path above it — the same URL up to the extension —
always loads.

Cut in two places, on purpose. `normalizePhotoUrl` in `db/wiki-sync.js` handles the import path, at
the one point wiki file URLs enter the app. `castawayPhotoSrc` in `src/lib/game/selectors.ts` handles
the other way one gets in: somebody pasting an image address into League Settings' Photo URL field,
which is the obvious thing to do with a wiki page open — that copy is scoped to wikia/fandom hosts so
it can't mangle an unrelated URL containing `/revision/`. They're two small copies rather than a
shared helper because state-logic and its selectors deliberately have no dependency on anything under
`db/`.

`0012` cleans what was already written, in all three places such a URL can be sitting: `season_cast`,
each league's own `state.castaways[].photoUrl`, and the cached extraction's `payload.photos` — that
last one matters because the cache is keyed on wiki revision ids, so an unchanged season would
otherwise keep handing the old URLs to the next staging run without ever re-reading the wiki.

### Cast approval is the admin's, not each commissioner's (`season_cast`, db/migrations/0011)

A cast is a fact about the show — the same 18 people for every league playing the season. Episode
results are not: each league reviews them against its own roster and scoring. The connector used to
treat both the same way, filing a per-league `wiki_proposals` row and waiting for every commissioner
to press Apply, and that was wrong in two ways that showed up immediately in use:

- the admin who imports a season the moment they catalogue it **couldn't finish the job** — the cast
  sat unapplied inside leagues they don't run;
- a commissioner who pulled cast and then episodes, in the right order, hit *"no castaways in this
  league yet"*, because pulling the cast had filed a proposal rather than applied one, and nothing
  said that was a separate step.

So the cast moved up a level. `stageSeasonCast` writes what the model extracted into `season_cast`
(one row per person: name, starting tribe, photo, sort order), keyed to the catalogued season rather
than to any league. **Admin → Shows & Seasons → Cast** shows exactly what a league would receive —
the photo, the name, the tribe — with two edits that reviewing actually needs:

- **Clear all tribes**, because the starting division is itself premiere-night information: a league
  catching up from episode 0 shouldn't be handed it with the cast.
- **Remove a row**, for whatever the extraction shouldn't have picked up.

**Approve** is the one button that reaches leagues. It marks the season reviewed and applies the
cast to every league already tracking it; a league that picks that season *later* gets it from the
settings route instead (`src/lib/server/season-cast.ts` owns both paths). Both go through
`StateLogic.applyCastImport`, which is additive and idempotent — a league that entered its cast by
hand keeps exactly what it had and gains only whoever was missing, and re-approving adds nobody
twice.

Staging is additive too, which is what makes a re-pull safe: rows already there are left alone, so
an admin's cleared tribes and corrections survive the connector reading the page again. Only a
genuinely new person un-approves the season — a cast that changed since it was last looked at needs
looking at — so an unchanged nightly re-read can't quietly withdraw a cast leagues are playing with.

The commissioner-side proposal list still exists and still applies a `cast` proposal, because a
league that ran the connector before this change can have one sitting pending. Nothing files new
ones.

### Matching a wiki name to a castaway (`Core.findCastawayByName`)

The wiki's cast table gives a full name (`Kimberly "Kilby" Kilbourne`, `Thiên An Nguyen`) while its
vote grid and episode guide use whatever the show calls that person on screen (`Kilby`, `Thien An`).
The matcher used to try two things — the exact name, then, only for a single word, first names — so
a nickname that isn't the first name, a two-word short name, and any name whose accents differ
between the two tables all failed outright. Worse, one unmatched name failed the **whole** import:
a single inferred zero-votes-safe was enough to throw away that episode's eliminations and leave the
commissioner with *"failed validation, nothing filed"*.

Both halves changed. Matching now runs in tiers, most exact first, and a tier that matches more than
one person still **refuses** rather than guessing (two castaways really can share a short name):

1. the same name ignoring case, accents and punctuation;
2. every word of the wanted name appears in theirs — `Kilby` in `Kimberly "Kilby" Kilbourne`,
   `Thien An` in `Thiên An Nguyen`, `Matt` in `Matt Blankinship`. Still strict in the way that
   matters: `Matt Blankinship` can't match a different Matt, because both words have to be there;
3. the reverse, for when the grid is fuller than the cast list (`Thien An Nguyen` → `Thien An`);
4. prefixes of three letters or more, for shortenings the tiers above miss.

And an unmatched name is **no longer fatal**. The decision that couldn't be resolved is dropped and
named; everything that did resolve still files. The names come back as their own list (not buried in
a summary string), so the Episodes panel reports them as what they are — "3 results named someone
this league doesn't have and were skipped" — instead of a failure that looks like a success or a
success that looks like a failure.

### Catch-up mode (a league that starts mid-season plays from episode 0)

The connector reads a **whole season** at once, which is wrong for a league that forms in week 4:
its first sync would hand the commissioner every elimination to date before anyone has drafted.
Catch-up mode lets that league play episode 1 as though it were airing tonight.

One integer does it — `settings.revealedThroughEpisode` (`StateLogic.RevealLogic`):

- `null` — **live**. No gate. Every league behaved this way before this existed, and an absent
  setting reads as null, so there was no migration and no existing league changed behaviour.
- `0..n` — **catching up**. Episodes 1..n are visible; n+1 and beyond do not exist as far as this
  league is concerned. `0` is the starting line.

**It derives, it doesn't snapshot** — that was the design decision, and it went against the way the
feature was first described (store a copy of cast + episode data per episode, taken as the season
aired). Snapshots only work for a season somebody was already tracking before it premiered, which
is exactly the case this feature *isn't* for, and there turned out to be nothing spoiler-bearing to
snapshot that isn't already keyed by episode: the episode extraction carries an episode number on
every decision, and the cast extraction reads only name, original tribe and photo — all
pre-premiere facts, since it never looks at the wiki's Finish column. So the gate is applied to the
one shared season extraction instead. One model call still serves a caught-up league and a live
league on the same season, and the feature works on any season, tracked early or not.
Full reasoning in `docs/PLAN-spoiler-free-catch-up.md`.

**Enforced in three places**, each covering something the others can't:

1. `fanOutEpisodes` (`db/wiki-sync.js`) never *writes* an item past the gate — so a hidden episode
   also can't trigger the "results ready to review" push, which would name it.
2. `GET /wiki-items` never *serves* one — which covers a league that synced first and switched into
   catch-up mode afterwards, whose table already holds the whole season.
3. `POST /api/leagues/:id/reveal-next` is the only thing that moves the pointer, and only forward.

**Two steps per episode, not one**, and keeping them apart is the point. **Open episode N** creates
the episode card so bets can be proposed and guessed and picks made — nothing is known about how it
went. **Reveal episode N results** then makes the connector's results for it reviewable. The first
version only had Reveal, which quietly made it impossible to play an episode at all: you can't bet
on an episode that doesn't exist, so the only way to get a card was to reveal its results first —
exactly backwards for a league whose whole reason for catching up is to play each episode before it
knows the answer.

**Revealing** raises the pointer by one and re-runs the league-scoped fan-out against the season's
**cached** extraction — no wiki read, no model call, the same cheap half a nightly run does per
league. It makes the episode reviewable, not true: the commissioner still accepts, corrects or
rejects each decision. Re-running is safe because `wiki_proposal_items`' identity index leaves
already-decided rows alone, so an accepted item stays accepted and a rejected one stays rejected.
There's no un-reveal — by the time anyone wants one the room has seen the episode, and may have
scored it.

The UI never says how much more the wiki knows. "3 more episodes are ready" is itself the spoiler:
it tells a league how far the season has run, and a short remaining count says the finale is close.
The Episodes panel talks only about the episode being revealed next; Overview carries a "catching
up, played through episode N" marker so the standings don't look inexplicably early; the mode is
picked in guided setup (once a season is chosen) and locks once anything has been revealed.

**Also fixed here, and worth knowing on its own:** the wiki's cast table is ordered **by finish** on
most season pages — first boot at the top, winner at the bottom — so importing it in table order
handed every league the season's placement order in the cast list itself. `fanOutCast` now files the
cast grouped by starting tribe, then alphabetically. That applies to every league, catch-up or not.

**Verified** in two parts, no credential needed for either (the connector's expensive half is
untouched). Twelve logic checks: an absent setting reading as live, a new league defaulting to live,
pointer 0 hiding everything, `1..n` visible and `n+1` not, `revealNext` refusing in live mode,
`updateSettings` normalizing `"3"`/`2.7`/`-5`/`""`/`"banana"`/`null` rather than storing them, the
guided-setup step appearing only once a season is picked, the fan-out writing exactly episodes
`[1,2,3,4]` / `[]` / `[1,2]` / `[1,2,3,4]` at pointers `null`/`0`/`2`/`4`, and a cast extraction in
wiki finish order coming out tribe-grouped and alphabetical. Twelve more through the real routes and
Postgres, against a seeded four-episode extraction: the settings route storing the pointer, an item
filed *before* catch-up was enabled disappearing from `/wiki-items`, reveal returning pointer 1 and
serving only episode 1, nothing past the gate reaching the table at all, accepting a revealed item
still applying it to league state, a second reveal adding exactly episode 2, an accepted item not
returning as pending, switching back to live serving everything again, and `reveal-next` 400ing in
live mode. Then the whole loop in a browser: picking catch-up in League Settings, revealing episode
1 from the Episodes tab, and the Overview marker.

### Running it on demand (Admin → Shows & Seasons)

Every season row in the admin catalog has **Pull cast** and **Pull episodes** buttons
(`POST /api/admin/seasons/:id/sync` → `runForSeason` in `db/wiki-sync.js`), so a super-admin can run
the connector for one season without waiting for the nightly job or reaching for a shell.

The unit is a **season**, not a league, for the same reason the nightly job groups by season: the
expensive half of a run — fetch, then extract — is season-scoped and cached in `wiki_extractions`
keyed on wiki revision ids, and the row an admin is looking at here *is* a season. One click reads
the wiki once and fans the result out to every league tracking that season; the response reports a
line per league, and one league failing (no cast imported yet, a name matching nobody) is reported
against that league rather than failing the others. A season no league tracks still primes the
extraction cache.

It changes nothing about what gets written: a cast pull stages the season's cast for review right
there in the admin UI, an episodes pull files per-decision items on each league's Episodes tab.

This route is slow by nature (a wiki read, then an LLM extraction: seconds for a cast, up to a
couple of minutes for a full season of episodes), so it sets `maxDuration = 300` and the UI shows a
pending state. A cut-off extraction is never filed and nothing is cached until it completes, so a
timeout costs the model call and nothing else. It needs `ANTHROPIC_API_KEY` in the **app's** own
environment, not just in the workflow's repository secrets — without one the connector says so
before it calls anything.

**Choices made here were the user's, against my recommendation, and are worth knowing:** LLM
extraction rather than a deterministic wikitext parser (the investigation found the templates are
structured enough to parse, and footnote *anchors* — unlike their numbers — are stable across
seasons), and a scheduled script rather than an on-demand button (the per-season buttons above were
added later, on request — the schedule is still what runs unattended). The strict schema, the separate
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

### Making the connector work for a second show

Pointing the connector at a Traitors season failed with `No ==Castaways== section found` on a page that
plainly had a cast section. Three separate Survivor assumptions were in the way.

**1. The heading was matched as a literal string.** `indexOf("==Castaways==")` misses
`== Contestants ==` twice over — a different word *and* padded with spaces. Headings are now matched
with a regex (`^(={2,6})\s*title\s*\1$`, any level), and the section runs to the next heading of the
**same or shallower** level rather than the next `==` of any kind, so a cast table split into
`===Tribe A===` / `===Tribe B===` subsections no longer gets truncated.

Which heading to look for is derived, not hardcoded: the show's own `castaway_term`, pluralized, then
singular, then the words wikis reach for regardless of show (`Castaways`, `Contestants`, `Cast`,
`Cast Members`, `Houseguests`, `Players`, `Competitors`). Survivor's "Castaways", Traitors'
"Contestants" and Big Brother's "Houseguests" all fall out of a term an admin has already entered for
the UI's sake, so the common case needs no configuration at all. `shows.cast_section_heading`
(migration `0007`) is the escape hatch for a wiki that calls it something unguessable — same reasoning
as `wiki_page_title` being independently editable rather than always derived. When nothing matches, the
error now names both what was looked for and **what headings the page actually has**, which is what
makes it fixable; the old message named neither.

**2. The section was pure transclusion.** The Traitors Contestants section is literally
`{{US5 Contestant History}}` + `{{US5 Contestant Info}}` — the cast table lives on
`Template:US5 Contestant Info`. So fixing the heading alone would have changed the error, not the
outcome. `expandTranscludedTables` follows transclusions one level deep and appends any whose wikitext
contains a table (`{|`), each labelled with an HTML comment naming where it came from. That `{|` test is
what keeps inline formatting templates out of the prompt — `{{c|faithful|...}}` and `{{s|...}}` resolve
to coloured spans, carry no rows, and would cost tokens for nothing. Provenance now records **every**
page read, not just the season page: with transclusion the season page's own revision id no longer pins
what was extracted. This is the same shape the original investigation found for Survivor's vote and
episode tables (`{{S44votetable}}`), so it's built generically rather than for one show — and phase two
needs it.

**3. The prompt and the validation messages spoke Survivor.** Both now take the show's vocabulary, so a
Traitors run asks for "every contestant and the starting factions" and the schema describes "the
distinct starting groups the cast is divided into … tribes, factions, teams, houses". The wikitext is
the authority either way; this only stops the prompt from describing a table using a word that appears
nowhere in it. The system prompt also warns that some tables arrive transcluded and that a person
appearing in more than one must be returned once.

**Verified** with 27 pure checks (heading parsing and padding, subsection retention, stopping at the
right level, candidate derivation and ordering for three shows, override precedence and dedup, the
plural/singular pair in both directions, the transclusion name scan skipping parser functions and magic
words) — of which 10 run against the **real** Traitors and Survivor wikis, asserting that the Traitors
section is bare transclusion before expansion and has a table after, that the expansion names its pages
and revision ids, that the inline `{{c}}` span template is *not* fetched as a page, and that Survivor's
inline path is untouched.

**Then the model call itself, against independently-derived ground truth.** Ground truth for
`The Traitors (US)/New Blood` was read straight out of `Template:US5 Contestant Info` with a regex over
the bolded `'''[[Name]]'''` cells — 22 contestants, and a Faction column of 20 Faithful / 2 Traitor —
before any extraction ran. A real `--dry` run matched it **exactly**: 22/22 names, zero invented, zero
missing, both factions, the right 2 people marked Traitor, and 22/22 photos resolved to real
`static.wikia.nocookie.net` URLs. The catalogued `cast_size` of 22 agrees. `Survivor 44` was re-run as a
regression and is unchanged — 18 castaways, 3 tribes, 18 photos, no transclusion needed.

One thing worth knowing for a Traitors league that already exists: apply is additive by design, so
importing 22 contestants into a league that still holds the old 21-name Survivor seed leaves 43. New
leagues start empty (see "Guided first-time setup" above); an existing one needs those 21 removed, or a
super-admin reset.

### Per-episode import (phase 2): `node db/wiki-sync.js episodes <leagueId>`

The other half of Feature D: who left each episode and how, plus the Active Roster event log. It reuses
every piece built for the Traitors fix — section finding and transclusion following are exactly what
gets at these tables, since `==Voting History==` and `==Season Summary==` are both bare transclusions
of `Template:S<N>votetable` and `Template:S<N>epguide`.

**One model call, two proposals.** The model sees both tables at once because it needs both —
eliminations and exit methods come from the guide's Finish column and the vote grid's terminal cells,
while immunity and reward wins are only in the guide. But the results are filed as *separate*
proposals, `eliminations` and `scoringEvents`, because they don't deserve the same trust and a
commissioner should be able to take one without the other:

| | Source | Trust |
|---|---|---|
| `eliminations` | Finish column, plus the vote grid's terminal `{{tribebox&#124;status&#124;…}}` markers | High — a direct read of a well-formed column |
| `scoringEvents` | Immunity/reward columns, footnote markers, vote arithmetic | Low — inference over rowspan-heavy cells |

Each event also carries its **own** `confidence`, and the review UI badges the low-confidence count
(`"N to verify"`) rather than presenting 185 events as equally solid. That's the plan's own
recommendation — "auto-suggested + high confidence for exit method; auto-suggested + lower confidence …
for immunity/reward winners and idol plays/zero-vote safes" — made concrete.

**`idolFound` is absent from the schema's enum, not filtered out of the results.** The investigation
found idol *finds* appear in neither template (they live in per-episode prose recaps, if anywhere), so
the connector has no source for them. Leaving the value out of the enum makes it structurally
impossible for the model to emit one; validation can't be the guard for something that should never be
representable.

**Names are the hard part, and the wiki is inconsistent about them.** The cast table prints full names
("Bruce Perreault"); the episode guide and the vote grid's captions print first names only ("Bruce").
An import keyed on exact names would match nothing at all from those two. `Core.findCastawayByName`
resolves an exact full name first, then falls back to a unique first-name match — and **reports
ambiguity instead of resolving it**, because picking one of two people named Sarah is the kind of quiet
guess that lands wrong data in a scored league. A wrong *full* name is never retried loosely against
first names, since that's a real mismatch rather than a shorthand. The prompt separately tells the model
to prefer the `link=` target inside a cell's image markup, which carries the full name even where the
caption doesn't.

The resolver lives in `state-logic.js` and the connector requires it, so extraction-time validation and
apply-time lookup use the **same** rule. Two copies would be two chances for a proposal to validate and
then fail to apply.

**Payloads reference episodes by NUMBER and castaways by NAME, never by id** — same reasoning as cast
import. A proposal can sit pending while the league changes; a stale id applies silently wrong, where a
stale name simply fails to resolve and gets reported.

**Applying creates missing episodes**, filling any gap before the target so `postMerge` and Active
Roster lineup carry-forward both inherit from the right predecessor, and it applies episodes in
**ascending order** because `addElimination` assigns `placementOrder` sequentially — applying episode 7
before episode 3 would invert the finishing order. Both apply paths are additive and idempotent:
anything already recorded is reported as skipped, never rewritten, so a hand-entered exit method
survives an import that disagrees with it.

Episode creation itself moved into one `EpisodeLogic.create`, used by `add()`, `ensureUpcoming()` and
the import. The episode literal used to be spelled out in the first two, so a new per-episode field had
to be remembered in three places. Two new optional fields come along: `title` and `airDate`, which the
guide gives for free — and the Episode Card renders them, rather than storing data nothing surfaces.

**Content validation, beyond the schema.** `validateEpisodes` refuses the whole run on an unresolvable
or ambiguous name, the same person eliminated twice, a duplicate or implausible episode number, or an
empty extraction. Three checks are notes rather than refusals, because the commissioner can judge them
and refusing would leave them nothing to look at: `postMerge` disagreeing with the extracted merge
episode (corrected to match), `zeroVotesSafe` for someone eliminated that same episode (dropped), and
`individualImmunity` in a pre-merge episode (dropped). An unrecognised `confidence` value defaults to
`low` — never silently `high`.

`episodes` refuses to run before a cast exists, naming the command to run first, rather than spending a
model call to discover that no name can resolve.

**Streaming, not a plain `parse()` call.** The SDK refuses a non-streaming request whose `max_tokens`
implies it could exceed its 10-minute limit, which the episode extraction does — output scales with
episodes × people, and a full season came back at ~18K output tokens. `messages.stream()` +
`finalMessage()` still carries `parsed_output`, so structured outputs work unchanged. A
`stop_reason: "max_tokens"` now fails the run explicitly, because a truncated season would otherwise
look exactly like a season that had fewer episodes.

**Verified** in two parts.

73 pure checks with no DB, network or model: name resolution (full names, first names, the real
Matt/Matthew pair, shared-first-name ambiguity reported rather than guessed, a wrong full name not
retried loosely); both apply paths (placement order following episode order rather than payload order,
gap filling, `postMerge` only on the named episode, double eliminations in one episode, a hand-entered
elimination surviving untouched, re-applying leaving state byte-identical, an unknown event type
refused); and every `validateEpisodes` guard, fatal and non-fatal, including that the connector's exit
methods match `state-logic.js`'s `EXIT_METHODS` exactly and that the schema rejects `idolFound`
structurally.

Then 46 end-to-end checks against `Survivor 44` — real wiki, real model, real proposals, real apply
route, real Postgres — compared with **ground truth derived independently from the same wikitext by
regex, before the model ran**: the 18-name elimination order read off the vote table's `link=` targets,
and the Finish column's labels. The extraction matched exactly, on **two separate runs**:

- 18/18 eliminations, correct order, zero invented names — and the order matched again after applying,
  read back out of persisted `placementOrder`.
- Both "messier cases" the plan asked about typed correctly: Bruce's medevac → `Medically Evacuated`,
  Matthew's quit → `Quit`. All 12 plain "Nth Voted Out" → `Voted Out`. The winner → `Sole Survivor`.
- The final four, where the wiki's own wording needs interpreting rather than reading, also came out
  right: Carson → `Lost Fire-Making` (which is only stated in a footnote), Carolyn and Heidi →
  `Lost Final Tribal (Jury Vote)`.
- Merge identified as episode 6, which is what the vote grid's header colspans actually say.
- Provenance named all three pages with the exact revision ids the ground-truth fetch saw.
- Apply, double-apply → 400, re-run not stacking pending duplicates, applied rows kept as history, and
  a fresh proposal re-applied recording nothing new and leaving placement order unchanged.

**What the two runs also showed, honestly: the low-confidence half is not stable.** Eliminations were
identical both times. Scoring events were not — 189 events with 132 marked low-confidence on one run,
185 with 175 on the other. The counts per type moved too (`zeroVotesSafe` 52 vs 50). Every event still
passed the structural checks (real castaway, catalogued type, `individualImmunity` post-merge only), and
the `zeroVotesSafe` guard caught genuine nonsense on **both** runs — someone marked safe-with-no-votes
in the same episode they were eliminated, a different person each time. That is the review queue
earning its place, and it's the concrete argument for the confidence badge: the eliminations proposal is
close to rubber-stampable, the events one is a draft to check.

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

then apply Better Auth's own tables once: `npx @better-auth/cli migrate`. No email provider needed
for local dev — reset links get logged to the server console (see that section above).

**This app's own schema applies itself.** `npm run build` runs `node db/migrate.js` before
`next build`, so every deploy brings the database up to date with the code being deployed. That
wasn't always true, and the day it wasn't cost a feature: `0011_season_cast.sql` shipped to
production unapplied and the admin's Cast button answered `relation "season_cast" does not exist`.
The runner is idempotent (each file recorded in `schema_migrations`, applied once), takes a Postgres
advisory lock so two concurrent deploys can't race, **skips with a warning and exits 0** when
`AUTH_DATABASE_URL` isn't set (a build with no database configured is legitimate), and **fails the
build** when a migration errors — shipping code whose schema didn't apply is the thing worth
preventing. `npm run migrate` runs it on its own.
