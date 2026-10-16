# Mid-season waivers: private claims, processed at once, then free agency

**Status:** planned 2026-10-16; phase 1 (the engine: claims storage, processing, free agency, spoiler
redaction, fixtures), phase 2 (the UI), phase 3 (pushes, the hourly job, Nudge, alerts) and phase 4
(every league on waivers, live rounds deleted) built 2026-10-16, not committed. Phase 5 (docs) not started.
**Design:** the "Mid-Season Moves" canvas, https://claude.ai/artifact/374Ha1KqK45HdbQR1ftcpk (14 phone
boards: a week of waivers as a player; rules, settings and the commissioner; alerts, the reveal and
Active Roster). Decided 2026-10-16.

## Why

Pickups and Swap today are live rounds: the commissioner starts one, then each player acts on their own
turn, one at a time. Players didn't know when pickups or swaps happen, and one person who didn't take
their turn stalled the whole league. Fantasy football solved this long ago with **waivers**: everyone
makes private, ranked claims; they all process at once in waiver order; then whoever's left is first
come, first served until the games start.

## Vocabulary (what a person reads)

Terms fantasy football players already know. Code, routes and settings keys keep their old names where
they exist (`replenish`, `trade`).

| Say | Not | Meaning |
|---|---|---|
| **Waivers** | Mid-Season, Pickups/Swap round | The tab/page, and the week's window for claims |
| **Claim** | pick, request | A private, ranked request for a free agent |
| **Pickup** | Replenish | Replacing a castaway of yours who left the game |
| **Add/drop** | Swap, Trade | Dropping one of yours still in the game for a free agent (optional) |
| **Waiver order**, **rolling waivers** | priority | Who wins a contested claim; a successful claim sends you to the back |
| **Free agency** | | After waivers process: first come, first served until the episode airs |
| **Transactions** | history, log | Every completed pickup and add/drop |
| **Process now**, **Undo last waiver run**, **Nudge** | | Commissioner tools |

"Trade" means manager-to-manager in fantasy football; there are no trades here ("Not yet").

## The week

```
Episode N airs ─► results applied ─► WAIVERS OPEN (private claims) ─► WAIVERS PROCESS ─► FREE AGENCY ─► Episode N+1 airs
   (Wed 8pm)        (usually Thu)       change claims any time         (Tue 8pm, 24h      first come,      free agency
                                                                        before N+1)       instant          closes
```

- **Waivers open automatically** the first time episode N has results (any way they arrive: the
  episode editor, research apply, admin-decided season results, a catch-up reveal). Every week while
  Pickups are on, even a week where nobody is owed one: a waiver week that only appeared when someone
  lost a castaway would say someone did. With Pickups off, only add/drop weeks open.
- **Claims process** `waiverProcessHours` (12, 24 or 48; default 24) before episode N+1 airs.
- **Free agency** runs from processing until N+1 airs, then the week **closes**.
- **No air schedule** (a league not on a catalog season) or **a catch-up league**: claims process
  `waiverProcessHours` after waivers opened; free agency runs until the next episode's results arrive
  (in catch-up, when the commissioner unlocks it).
- **Results arrived late:** if processing time would already be past when waivers open, it's halfway
  between opening and airtime. If N+1 already aired when N's results land, it's the no-schedule rule.
- **Results of a later episode arrive while a week is still open or in free agency** (catch-up, a late
  commissioner): that week processes (if it hadn't) and closes on the spot, then the new week opens.
  Processing then uses the cast as it stands.
- **The finale:** no waivers once nobody is left in the game.

## The rules

### Pickups (one per castaway of yours who leaves)

- **Classic:** one for each castaway of yours eliminated (not the winner) that hasn't been replaced.
- **Active Roster:** only once your roster is down to `replenishAt` still in the game, and only back up
  to one more than that (today's `replenishNeed`).
- **Claims:** up to 3, ranked (owed 2+: up to owed + 2). You get the first one still free when waivers
  process. A pickup replaces your oldest unreplaced loss: their points come off, the pickup counts in
  full (today's replenish scoring, unchanged).
- **Unfilled:** choose from who's left in free agency. Still unfilled when the episode airs: one is
  assigned automatically, so nobody is ever a castaway short. Classic: a free agent at random
  (deterministic per week and player, so re-running never changes it). Active Roster: the free agent
  with the most points. If no free agent is left at all, the slot stays empty.

### Add/drops (optional, on add/drop weeks)

- **Add/drop weeks** are after every `swapEvery` episodes of the league's own season (default 3: after
  3, 6, 9, 12), now for Classic as well as Active Roster.
- **One per add/drop week,** by waiver claim or in free agency: drop one castaway still in the game and
  add a free agent. The claim is one drop plus up to 3 ranked adds. Whoever you drop goes straight into
  free agency, and their points go with them (today's swap scoring).

### Processing (all at once)

1. The waiver order is frozen at the start of the run: rolling (default) or standings
   (`replenishOrderBy`: `rolling`, `leastPoints`, `mostPoints`).
2. **Pickups first,** in waiver order. Each player gets their first claim still free. Someone owed 2+
   takes one per round (everyone's first, then everyone's second).
3. **Then add/drops,** in the same frozen order. A pickup always beats an add/drop: a castaway taken by
   anyone's pickup is gone for every add/drop claim. If your own pickup landed someone in your add/drop
   list, that claim moves on to your next choice.
4. **Rolling waivers:** everyone whose claim went through drops to the back, keeping their relative
   order; everyone else moves up. A quiet week moves you up. Free agency never changes the order.
5. Every outcome is recorded with **why**: got their Nth choice; wanted X but someone ahead (or a pickup)
   got there first; no claim by the deadline; skipped this week.

Shared-ownership leagues (Active Roster's default) have no contested claims, since everyone may add
anyone still in who isn't already theirs; order only sequences the run.

### Reveal-gated (spoilers)

Whether you're owed a pickup says one of yours left, so everything about a waiver week is hidden from
someone who hasn't revealed its episode:

- **No claims or free-agency moves** until you've revealed episode N (the server refuses).
- **Your copy of the league** (`SpoilerLogic.viewThrough`) undoes every transaction from episodes you
  haven't revealed, puts the waiver order back to how it stood before them, and blanks those weeks'
  "who has claims in" and results. What's left: the week exists, and when it processes.
- **Didn't reveal in time:** any pickup you're owed is assigned automatically at airtime; no add/drop,
  and you move up the waiver order.
- Pushes (phase 3) never name anyone to a player who hasn't revealed.

Today's live rounds have this leak (a pickup made after episode 3 shows to someone who hasn't revealed
it); the redaction covers their log entries too.

### Claims are private

Nobody sees anyone else's claims, the commissioner included. Who has claims in is public (the waiver
order list shows it). Once a week processes, every transaction and why is public.

### Commissioner

Nothing to start or end. While waivers are open: **Process now** (runs every claim that's in and opens
free agency early), **Nudge** a player (phase 3), **Claim for** a player (they can't see the claim's
contents either, just that it's in), and **Undo last waiver run** while free agency is still open: every
castaway goes back (free-agency moves of that week too), the order is restored, and claims reopen, held
until Process now or, at the latest, airtime.

## Data model

### League state (public; `state.midSeason.waivers`)

```js
midSeason.waivers = { periods: [WaiverPeriod] }   // oldest first; one per waiver week
WaiverPeriod = {
  id, episode,                 // the episode whose results opened it
  openedAt, processAt, closesAt,  // ISO; closesAt null = until the next episode's results
  phase: 'open' | 'processed' | 'closed',
  addDrop: boolean,            // an add/drop week
  hold?: true,                 // after an undo: no scheduled processing
  claimsIn: [playerId],        // public mirror of waiver_claims: who has a claim saved
  run: null | { at, by: 'schedule'|'commissioner', orderBefore, orderAfter, results: [WaiverResult] },
  autoFills: [txId],           // pickups assigned at close
}
WaiverResult = { playerId, kind: 'pickup'|'addDrop', outcome: 'got'|'missed'|'noClaim'|'skipped',
                 castawayId?, droppedCastawayId?, choice?, passed: [{ castawayId, reason, byPlayerId? }] }
```

Transactions stay in `midSeason.log` (types `replenish` = Pickup, `trade` = Add/drop), so Transactions,
`originalDraftPicks` and the late-joiner rewind keep working. New fields: `via` (`waivers`,
`freeAgency`, `auto`), `periodId`, and `prev` (the castaway fields the move overwrote, only the keys
it had, so it can be undone exactly even after a trip through JSON).

### Claims (private; `waiver_claims`, db/migrations/0060)

Same reasoning as `blind_draft_picks` (0004): `state` is returned wholesale by every route, so claims
live outside it and can't leak through a route that forgets to redact. One row per (league, period,
player): `pickup_ids`, `drop_id`, `add_ids`, `updated_by`. Rows are deleted when the week closes
(kept through free agency so Undo can reopen them). Only `src/lib/server/waivers.js` reads them.

### Settings

| Key | Default | |
|---|---|---|
| ~~`midSeasonMode`~~ | | Phases 1–3's switch; removed in phase 4 (0061 deletes it), waivers are the only mode |
| `replenishEnabled` | false | Pickups (unchanged) |
| `tradeEnabled` | false | Add/drops (unchanged) |
| `swapEvery` | 3 | Add/drops every N episodes, now for Classic too |
| `waiverProcessHours` | 24 | 12, 24 or 48 |
| `replenishOrderBy` | `rolling` | Waiver order |
| `freeAgencyEnabled` | true | Off: waivers only; unfilled pickups are assigned at airtime |

## Server

- **The clock** is lazy, like air times and bots: `syncWaivers` runs inside `withLeagueLock` before and
  after every mutation (so a claim saved after processing time is refused, and results that just landed
  open the week), and `GET .../state` takes the lock when `WaiverLogic.due()` says a step is waiting.
  Phase 3 adds the hourly job so processing (and its push) happens on time with nobody looking.
- **Computer players** make their claims at processing time (`Bots.waiverClaim`), from the same
  ratings their old turns used.
- **Routes** (phase 1), all under `/api/leagues/[leagueId]/waivers`:
  - `GET` → `{ period, claim }`: the open week and **your own** claim (never anyone else's).
  - `PUT claims` `{ playerId?, pickupIds, dropId, addIds }`: save (empty = withdraw). `playerId` is the
    commissioner claiming for someone.
  - `POST free-agency` `{ playerId?, addId, dropId? }`: no `dropId` fills a pickup; with one, it's the
    week's add/drop.
  - `POST process`, `POST undo`: commissioner.

Late joiners (ghosts) sit waivers out, as they sit out rounds today (`inLeagueRotation`), and their
rewind drops waiver weeks after their mark.

## Phases

1. **Engine (built).** `WaiverLogic` (pure), `waiver_claims`, `src/lib/server/waivers.js`, the routes,
   the lazy clock, spoiler redaction, bot claims, tests and fixtures. Behind `midSeasonMode: 'waivers'`,
   so no league changes until it's switched on.
   *Done when:* `npm test` passes `tests/waivers.test.js`; `scripts/dev-test/check-waivers.js` passes
   against the dev server (claims private, processing, free agency, undo, redaction, refusals).
2. **Player and commissioner UI.** The canvas's boards 1–10 and 13: Waivers page (open, claims saved,
   processed, free agency, between weeks, not revealed), the pickup and add/drop claim pickers, How
   waivers work sheet, League Settings › Waivers, commissioner tools, the results page's apply line, the
   reveal's last beat. Tab slot: Classic/Eliminator have a fifth slot; Active Roster folds Waivers into
   Research (open question below). *Done when:* every board checked at 390px in both modes with
   `waivers-fixture.js`.
3. **Pushes and the clock job.** Board 11: the results push's extra line, 6h-before reminders (owed a
   pickup with no claim; not revealed), "Waivers processed" (no names if not revealed), Nudge, the alert
   strip item and Overview's status plate. `db/waivers.js` hourly, after reminders, using the same
   `waivers.js`.
4. **Switch every league over.** Default `midSeasonMode` to waivers, migrate the three leagues on
   Pickups/Swap (finish or cancel any open round first), delete the live-round routes, panels, bot turns
   and the `midSeasonTurn` push. What's New entry (the user approves it).
5. **Docs.** DESIGN.md, the User Manual doc, HANDOFF.

## As built: phase 1 (2026-10-16, not committed)

| Piece | Where |
|---|---|
| Rules, clock, processing, free agency, close, undo, redaction (pure) | `src/lib/game/state-logic.js` `WaiverLogic` |
| One place pickups and add/drops are written, logged and undone (live rounds use it too) | `MidSeasonLogic.applyPickup` / `applyAddDrop` / `revert` |
| Spoiler view | `SpoilerLogic.viewThrough` calls `WaiverLogic.redact`; `GhostLogic.rewindTo` drops later weeks |
| Computer players' claims | `src/lib/game/bot-logic.js` `waiverClaim` |
| Private claims table | `db/migrations/0060_waiver_claims.sql` (applied locally) |
| Claims I/O, the clock, Process now | `src/lib/server/waivers.js` (CommonJS, `.d.ts` beside it) |
| Lazy clock | `withLeagueLock` (`db.ts`) syncs before and after every mutation; `GET .../state` takes the lock when `WaiverLogic.due()` |
| Who a request acts for, the reveal gate | `src/lib/server/waiver-actor.ts` |
| Routes | `src/app/api/leagues/[leagueId]/waivers/` (`route.ts` GET, `claims` PUT, `free-agency`, `process`, `undo`) |
| Client calls (for phase 2) | `src/lib/api.ts`: `getWaiverClaim`, `saveWaiverClaim`, `freeAgencyMove`, `processWaivers`, `undoWaiverRun` |
| Types | `types.ts`: `WaiverPeriod`, `WaiverRun`, `WaiverResult`, `WaiverPass`, `WaiverClaim`; settings keys |

**Verified:** `tests/waivers.test.js` (16 cases, the canvas's week among them); `npm test` otherwise
unchanged (its one failure, `status-plate.test.js` "before the draft", fails on master too).
`scripts/dev-test/check-waivers.js` passes all 34 checks against the dev server. A load with a week's
processing time past processed it on schedule and stored it. `tsc` clean; lint clean apart from the
`require()` rule every CommonJS script and test in the repo trips.

**Test bank:** `scripts/dev-test/waivers-fixture.js` (`up --phase=open|claimed|processed|idle`,
`--airs-in=H`; `down`), the check above, and `api()` in `browser.js` (the API as a signed-in user, no
browser), for any API-level check.

**Calls made while building:**
- Pickup claims cap at owed + 2 (3 when owed one); the add/drop claim is one drop and up to 3 adds.
- Owed 2+ pickups take one per round in the frozen order (everyone's first, then second), not a snake.
- A castaway dropped in the run can't be added until free agency, even by a later claim in the run.
  Exclusive leagues only (changed in phase 2): in a shared league someone else's drop has no bearing on
  whether you may add them, so shared claims always land.
- Claims are refused (409 "Reveal episode N first") for yourself until you've revealed; the commissioner
  claiming for someone isn't held to that player's mark. GET /waivers holds your own claim back too.
- Free agency's "someone got there first" is a 409, so phase 2 can say it plainly.
- The spoiler redaction also takes back **live-round** pickups and swaps from unrevealed episodes (the
  leak noted above). That changes what an unrevealed player in S49 Active Roster sees: their copy now
  shows rosters from before those moves, which is the point.

**For phase 2 to know:** the reveal's exit beat reads ownership from the "after" copy, so once a pickup
has processed, the castaway who left no longer shows as yours there (true of live rounds before this
too). The canvas's last beat ("Your move · Pickup · Replace Jelly") wants the departed castaway's
`formerOwnerId`, or the "before" copy.

## As built: phase 2 (2026-10-16, not committed)

| Piece | Where |
|---|---|
| The viewer's week, your private claim (`useMyClaim`), times, outcomes in words, shared helpers | `src/components/waivers/waivers-model.ts` |
| Week strip, order list, claim rows, transactions, a run's results and the order after | `src/components/waivers/waivers-ui.tsx` |
| The Waivers page: open (board 1), claims in (4), processed (5), not revealed (6), between weeks (8) | `src/components/waivers/waivers-board.tsx` |
| Pickup (2), add/drop (3) and free agency (5b) pickers, `?for=` for the commissioner | `src/components/waivers/claim-pickers.tsx` |
| How waivers work (7), written from the league's settings | `src/components/waivers/rules-sheet.tsx` |
| League Settings › Waivers (9) | `src/components/waivers/waivers-settings.tsx`, `/setup/waivers` |
| Commissioner tools (10): Process now, who has claims in, Claim for, Undo last waiver run | `src/components/waivers/commissioner-tools.tsx` |
| Active Roster's way in (13): the week, your claims, Waivers and lineup rows at the top of Research | `src/components/waivers/research-waivers.tsx` |
| A past week's results ("All of Episode 3's waivers, and why") | `src/components/waivers/week-results.tsx` |
| Routes: `/waivers/...` (Classic), `/research/waivers/...` (Active Roster); a wrong one redirects | `src/app/waivers/`, `src/app/research/waivers/`, `waivers-route.tsx` |
| The reveal's last beat (12): "Your move" | `reveal-moment.tsx` `moveBeat` |
| The results page's apply line (10) | `episode-results-page.tsx` via `applyOpensWaivers` |

**Calls made while building:**
- **Tab bar** (the user's call): Classic's Mid-Season slot becomes Waivers. Active Roster keeps its bar;
  Waivers lives inside Research (`/research/waivers`, backs up to Research), and the Research tab
  carries the "needs you" mark. The desktop sidebar does the same. A standalone Waivers tab (with
  Episodes and Lineup merged) is still on the table: every waiver link comes from `waiversBase()`, so
  moving them is that function and one tab entry.
- The tab mark means only a pickup you owe with no claim in (or unfilled in free agency), never just
  "waivers are open" (they're open most weeks). `waiversBadge` in `selectors.ts`.
- **Claims save by part** (`waivers.js` `saveClaim`): a save without `pickupIds` keeps the saved pickup
  list, one without `dropId`/`addIds` keeps the add/drop. The two pickers each save their own part, and
  "Claim for Dee" never wipes an add/drop Dee made that the commissioner can't see.
- **Shared ownership** shows no waiver order, no ranked backups (a pickup picks exactly who you're owed,
  an add/drop one add), no "1st choice" and no rank numbers in results: nothing can be lost to anyone.
  Same rules underneath; the order still rolls, invisibly. Settings hides Waiver order for shared.
- The reveal's exit cards read whose a castaway was as of just before their episode (the phase 1 note
  below), so a processed pickup can't hide that the one who left was yours.
- Finale predictions, which lived on Mid-Season, are at the foot of the Waivers page. `/mid-season`
  sends a waivers league to its Waivers page; the old "Pickups are due · Start" commissioner item is off
  for waivers leagues; "How this league works" describes waivers when they're on.
- "Later" on the reveal's last beat goes to the episode's recap (the reveal's usual end), not Waivers.
- Not built (phase 3): Nudge, the pushes, the alert strip item and Overview's status plate (board 11).
  There's still no switch in League Settings to move a league onto waivers (phase 4); the fixture sets
  `midSeasonMode`.

**Verified:** `scripts/dev-test/check-waivers-ui.js` (every board, both leagues, as the commissioner,
Sam and Josie, each phase, 390px, Night and Studio): saving a pickup claim through the picker, the
rules sheet, Claim for, the reveal to its last beat (Josie's add/drop week; Sam's pickup), and a
free-agency add/drop tapped through. `check-waivers.js` 36/36 (two new: saving by part).
`tests/waivers.test.js` 17/17 (new: shared drop-then-add). `npm test` otherwise unchanged. `tsc` and
lint clean.

**Known, not from this work:** the confirm bar above the tab bar is clipped to the content width by the
shell's `overflow-x-clip` wrapper (the draft's bar too). The fixture's Active Roster league shows a
"Set your Episode 13 lineup" alert and a Draft tab (its draft isn't recorded as complete).

## As built: phase 3 (2026-10-16, not committed)

| Piece | Where |
|---|---|
| Every waiver push: who hears what when a week processes, the 6h reminders, Nudge's wording, the results push's line | `src/lib/server/waiver-pushes.js` (CommonJS, `.d.ts` beside it) |
| "Waivers processed" from a request (lazy clock, Process now): a before/after snapshot, sent after commit | `withLeagueLock` (`db.ts`) via `justProcessed` / `sendProcessed` |
| The hourly job: the clock for leagues nobody's loading, then the reminders | `db/waivers.js` (`--dry`); a step after reminders.js in `.github/workflows/auto-research.yml` |
| Results push: "… Waivers process Tue 8:00 PM EDT." | `push-events.ts` `notifyEpisodeResults` |
| Nudge | `POST /api/leagues/[leagueId]/waivers/nudge`, `api.nudgeWaivers`, `push-events.ts` `notifyWaiverNudge`, the button in `commissioner-tools.tsx` |
| Notification types | `push-core.js`: `waivers` (processed) and `waiverReminder` (6h reminders and nudges), on by default |
| Alert strip's pickup item ("Replace Jelly by Tue 8 PM · claim up to 3") | `action-items.js` `waiverItems` (kind `pickup`, with `by` and `detail`); `action-bar.tsx` formats `by` in the viewer's zone |
| Overview's status plate (Waivers / Add/drop / FA) | `status-plate.ts` `waiverPlate` |
| Overview, after ("You got Rob and Maggie") | `latest-episode-card.tsx` `YourWaiversPlate` |
| Where waiver pages live, shared by client, pushes and plates | `action-items.js` `waiversHref` (`waiversBase` now calls it) |

**Calls made while building:**
- **Who hears "Waivers processed":** everyone who hasn't revealed, every week, the same words with no names
  (so even being sent one says nothing). Someone who has revealed only when the week touched them: who
  they got, that their claim missed, that a pickup is still theirs to make, or (add/drop weeks with free
  agency) that their add/drop is unused. A quiet week sends them nothing.
- **Announced once, by whoever processed it:** `withLeagueLock` compares the running week before and after
  (`snapshot` / `justProcessed`) and sends after commit via `after()`; the job does the same for the ones
  it processes. A week that processes and closes in one go (a later episode's results) isn't announced.
- **Reveal state for pushes and `/api/me/actions`:** the member's mark; "show results immediately" counts
  as everything; **no mark yet counts as nothing revealed** (the safe way round). `/api/me/actions` now
  passes `null` for opted-out members, so their pickup item shows.
- **Times in pushes** are the season's zone with its abbreviation ("Tue 8:00 PM EDT"): a push can't know
  the reader's zone. The alert strip formats `by` on the device, in the viewer's own.
- **Nudge:** commissioner only, while waivers are open, to a person (not a computer player) with an account
  and no claim in, once per player per week. Who's been nudged is on the week (`nudged`, public, so the
  button says so after a reload) and taken out of a viewer's copy for an unrevealed week, since it hints at
  who owes a pickup. The push is worded for what the player may know: reveal first / a pickup to claim /
  add/drops are open.
- **Status plate:** only when you have something in the week but owe nothing unclaimed (that's the alert):
  your claim is in ("4 of 5 in", computer players counted as in, as in Commissioner tools); an add/drop week
  with no claim; free agency with your add/drop unused. A week you can't claim anything in says nothing.
- **Overview, after:** also a quiet "Your claim missed" plate (with why) when your claims didn't land; the
  canvas only drew the success.
- The job stamps air times itself (`db/waivers.js` `stampAirTimes`, `air-times.ts`'s rule on seasons loaded
  once), as `db/reminders.js` does: `air-times.ts` is TypeScript the job can't require.
- `push-core.d.ts` was missing `resultsDue` from `NotificationType`; added with the two new types.
- Not built: no push when a pickup is assigned automatically at airtime (the canvas has none).

**Verified:** `tests/waiver-pushes.test.js` (9 cases: who hears what, once-only announcement, the 6h
reminders and their log, the job end to end and `--dry` against a fake pool, the alert item, the status
plates, `nudged` redaction). `scripts/dev-test/check-waivers-alerts.js` 19/19 against the dev server and
database (Nudge's refusals, the alert item via `/api/me/actions`, the job's reminders and processing with
its clock moved, scoped to the fixture's leagues by `runWaivers({ leagueIds })`). `check-waivers.js` still
36/36. `check-waivers-ui.js` now shoots Overview for everyone at every phase and taps Nudge: checked at
390px in Studio (all phases, both leagues) and Night (processed). `npm test` otherwise unchanged (the
known `status-plate.test.js` "before the draft" failure). `tsc` and lint clean.

## As built: phase 4 (2026-10-16, not committed)

Waivers are the only mode: `WaiverLogic.enabled` is Pickups or Add/drops on, nothing else.

| Gone | Where it was |
|---|---|
| `ReplenishLogic`, `TradeLogic`, `MidSeasonLogic.swapWindow` / `usedPriority`, their flat aliases, `midSeason.replenish` / `.trade` / `.lastSwapAfterEpisode`, `settings.midSeasonMode`, `ReplenishTurn` / `TradeState` | `state-logic.js` (+ `.d.ts`, `types.ts`) |
| `/api/leagues/[id]/replenish/*`, `/trade/*` and their `api.ts` calls | routes |
| `mid-season-tab`, `replenish-panel`, `trade-panel`, `transaction-history`; League Settings › Swaps & pickups (`/setup/pickups`, `general-settings-section.tsx`) | components (`finale-panel.tsx` stays, used by the Waivers page) |
| Bots' replenish/swap turns (`waiverClaim` is all) | `bot-logic.js` |
| The `midSeasonTurn` push, alert item, tab badge (`midseasonBadge`), status plate turn, "Pickups are due · Start" / "Swap window is open" commissioner items | `push-core.js`, `push-events.ts`, `action-items.js`, `selectors.ts`, `status-plate.ts`, `commissioner-items.ts` |

**Calls made while building:**
- **The setting:** rather than default `midSeasonMode` to `'waivers'`, the key is gone (0061 deletes it); `db/waivers.js` now
  takes every league with Pickups or Add/drops on.
- **Migration** (`db/migrations/0061_waivers_for_every_league.sql`, applied locally): drops the round keys from every league.
  An open pickup round's unused turns were never spent (a loss is only marked replaced when its pickup is made), so they
  carry into the first waiver week. A swap round's remaining turns lapse; `WaiverLogic.addDropUsed` counts a live-round
  swap after the same episode (no `periodId`), and `checkClaim` now refuses an add/drop claim once it's used, so nobody
  swaps twice in a switched-over window. The first week opens by itself on the next load/write or the hourly job.
  Locally: S49 Active Roster's finished round closed (season over, no week); Weekly Start/Bench opens a pickup +
  add/drop week after Episode 4; Last Survivor Standing a pickup week after Episode 3 (Episode 4 aired without results,
  so it processes 24h after opening and free agency runs until those results). Production gets 0061 on deploy (build runs migrate).
- `/mid-season` stays, as a redirect to the league's Waivers page, for old links and pushes; the sidebar/tab bar/league
  swipe use `/waivers`. Stale `midSeasonTurn` keys in `notification_prefs.disabled` are harmless (read per type).
- **The guided tour** now teaches a claim: after Episode 1 is revealed waivers open (`rise-and-fall.ts` `openWaivers`),
  Research leads with the week, you claim from the pickup picker (lit row `waivers-pickup`), and the tour processes it at
  once (`processWaivers`); Episode 2's results close the week. Mock mode (no server) keeps claims in memory
  (`src/lib/mock-claims.ts`, read by `useMyClaim`), and free agency works in mock mode too. The reveal's "Your move" beat
  is left out while touring: its Claim button would skip the Scoreboard and Chat steps.
- The explainer card for an add/drop-only league no longer says waivers open after every episode; the episode editor's
  "already used in a pickup round" warning says "already replaced by a pickup".

**Verified:** `npm test` 327/328 (the known `status-plate.test.js` "before the draft"); live-round tests rewritten as
waiver tests (`mid-season-active-roster.test.js`, now with the switch-over rule), plus `bots`, `tour-season`, `waivers`,
`demo-active-roster`. `check-waivers.js` and `check-waivers-alerts.js` pass with the fixture no longer setting a mode;
`check-waivers-ui.js` all phases at 390px, no page errors; `docs/ux-baseline/scripts/tour.js --player-only` end to end;
`view-as.js` on Weekly Start/Bench (`/research/waivers`) and Last Survivor Standing (`/mid-season` lands on Waivers).
`tsc` and lint clean.

## Open questions

- **Standalone Waivers tab?** The user may prefer merging Episodes with Lineup/Pick and giving Waivers
  its own tab in Active Roster too. Both bars are mocked on the canvas ("14 · Tab bar: two options").
- **Shared leagues: wait or instant?** Nothing can be contested in a shared league, so pickups could
  happen the moment you choose. Kept waiting for now (one rhythm for every league); the user decides.
- Ghosts converted mid-season can be owed pickups from before they joined the rotation; they join the
  next waiver week like anyone (no special case built).

## Testing ideas

- Two players claim the same free agent: the higher in waiver order gets them, the other their next.
- A pickup beats an add/drop even from lower in the order; your own pickup skips your add/drop claim on.
- Rolling order after a run: movers to the back in their relative order (the canvas's Results board).
- Free agency: instant, first come; just-dropped castaways available; order unchanged; one add/drop.
- Unfilled pickups at airtime: random (Classic) / most points (Active Roster); deterministic.
- Unrevealed viewer: no claims allowed; their copy shows the pre-run roster and order, no names.
- Undo: ownership, flags and order restored exactly; claims reopen; held until Process now.
- Results removed while open: the week is withdrawn. Later results while open: process, close, open.
