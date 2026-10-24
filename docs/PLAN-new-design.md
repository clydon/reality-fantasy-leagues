# Plan: moving the app onto the new design

Status: **plan, 2026-10-23.** The full-site mock (`.impeccable/mocks/site/`, live at `/mock`, decisions in memory
`site-mock-decisions`) is about 80% settled. This plan takes the real app onto it, piece by piece, without
losing anything the one live couch has played. It is the "second-pass drill-down" that
`PLAN-couch-and-episode-night.md` asked for; where the two disagree, this file and the mock win.

**How to use this file.** It's written to be read in parts. Every session reads **Status** (the table just
below), **The approach**, the **Rules for every session**, and then only its own step's section. Each step
ends by updating its Status row and adding an **As built** note under its section (what changed, what was
decided on the way, what the next step should know). That's the continuity between sessions; nothing
else needs re-reading.

## Status

| Step | What | State | Model / effort |
|---|---|---|---|
| 0a | Back up the live leagues | not started | Opus · medium |
| 0b | Backend foundation (couch, progress, schedule, roles, guard) | not started | Opus · high |
| 0c | The new shell, Preview system, fixtures, motion | not started | Opus · high |
| 0d | Hub and show space ported (fixtures behind Preview) | not started | Opus · high |
| 1 | Show space on real leagues: Tonight, moves dock, Standings | not started | Opus · high |
| 2 | Episodes, staged results, the one reveal | not started | Opus · high |
| 3 | Cast explorer and stats, server-side spoiler guard | not started | Opus · high |
| 4 | Chat, per couch and show, spoiler-folded | not started | Opus · medium |
| 5 | Backstage I: results, Recent changes, guards and undo | not started | Opus · high |
| 6 | Backstage II: waivers, rules, members and roles, settings | not started | Opus · high |
| 7 | Draft room and blind draft | not started | Opus · medium |
| — | **Switch the couch to the new design by default** | — | — |
| 8 | Hub I: Up next, your shows, Previously on, By the numbers, rankings, trophies | not started | Opus · high |
| 9 | Couches, sign-up, first run, join, sign-in | not started | Opus · high |
| 10 | Watching: follow a show, where you are, no-game show space, Make it a game | not started | Opus · high |
| 11 | TV guide: schedules, all of TV, hide from guide, drops, planned nights | not started | Opus · high |
| 12 | Episode games: Rate it and verdicts, Call it, bingo, polls, trivia | not started | Opus · high |
| 13 | Watch along: pinned reactions, GIFs, together sessions | not started | Opus · high |
| 14 | Streaming shows and the rail | not started | Opus · medium |
| 15 | Notifications by moment, account settings | not started | Opus · medium |
| C | Cutover: new design for everyone, classic removed, cleanup | not started | Opus · high |

Steps 1–7 bring the new design to parity with what the couch plays today; after them the couch switches to
it. Steps 8–15 are new features and can be reordered. Desktop layouts come after step 15 (until then the new
design is a centred phone column on a desktop, like the mock).

## The approach (and why)

The user's instinct, agreed with three adjustments:

1. **One database, no transfer.** The new design is a new set of screens over the **same** data and the same
   game engine. Picks, drafts, lineups, waivers, scoring rules and results all stay where they are
   (`leagues.state`, `waiver_claims`, `blind_draft_picks`, `league_rulesets`, `season_decisions`, chat), and
   both designs read and write them. There's nothing to "transfer over eventually", so nothing can be lost
   in a transfer. Every migration is **additive** until cutover (new tables and columns, old ones still
   written: expand, then contract in step C). The backup in 0a is insurance, not a migration path.
2. **The classic app keeps running beside the new one.** The couch is mid-season; their game must never
   break. The new design lives in its own routes, opted into per account ("Try the new design", which
   replaces the Coming Soon! link). The couch keeps playing in classic until step 7 lands, then flips.
3. **The engine is kept, the screens are rebuilt.** `src/lib/game/` (state-logic.js, selectors, view models,
   action items, waivers) and the league-scoped API (`/api/leagues/[leagueId]/...`: drafts, lineups, picks,
   bets, waivers, research, reveal, chat) are UI-independent and stay. The mock's vanilla JS is **not**
   embedded; each area is ported to React components, using the mock as the reference.

**The Preview system** (the "mock overlay"): any part of a new screen that isn't on real data yet renders
from fixtures and is wrapped in `<Preview step="8">`, which draws a quiet dashed outline and a small
"Preview" tag, and turns its taps into a "Coming soon" toast. A registry (`src/new/preview.ts`) lists every
previewed piece with the step that will make it real. Each step deletes its fixtures and registry entries.
At step C the registry and `src/new/fixtures/` must be empty, and are deleted. That's the minimal cleanup:
one folder and one component.

**Backend work is split:** the cross-cutting foundations (couch, per-person progress, episode schedule,
roles, the spoiler guard) come first in 0b, because every screen needs them and getting them wrong is
expensive later. Feature-specific tables (ratings, bingo, watch-along reactions, listings) are built in
their own step, against the screen that needs them, so nothing is designed speculatively.

## Rules for every session

- **Start**: read `docs/HANDOFF.md` (top), this file's Status, The approach, these rules, and your step. Then
  look at the mock for your area only: `node scripts/dev-test/shoot-site.js <out> "#/route" [--scroll]` for
  screenshots, and grep the area's mock file for its functions (the mock's layout of files is in memory
  `site-mock-decisions`). Don't read the whole mock.
- **Never touch the couch's real leagues** from a test or script. Tests use `zt-` fixtures with up/down
  (CLAUDE.md, `scripts/dev-test/`). The local database is a copy of production from 2026-10-16.
- **Migrations are additive** until step C. Test each on a local copy before it ships (deploys run
  `db/migrate.js` automatically). Before any migration reaches production, take a fresh backup (0a's
  script) or a Neon branch.
- **Spoilers are guarded on the server** for anything the new design reads (step 0b's guard), not just
  hidden in the UI.
- **Port faithfully, then improve.** Match the mock's layout, copy and motion; if something doesn't survive
  real data, fix it and note it in As built. Read the relevant `node_modules/next/dist/docs/` guide before
  writing Next-specific code (AGENTS.md); Next is 16.3.
- **Done means:** real data, the area's fixtures and Preview entries removed, a check script added or
  extended in `scripts/dev-test/` and passing, type-check and lint clean, checked at 390px in a real
  browser (memory: always-verify-locally), committed. Pushing to production: ask the user.
- **End**: update Status and your step's As built; recommend whether to start a fresh session and give a
  seed prompt with model and effort (memory: new-session-handoff).

## What exists, what's needed

| New design needs | Exists today | Gap |
|---|---|---|
| Season games (Outlast, Weekly Lineup, Survival Pool) | engine + league API, all three types | display names only (`leagueTypeId` unchanged) |
| Moves (lineup, pick, predictions) | `/episodes/[epId]/lineups`, `/picks`, `/bets` | none for writes; the dock is new UI |
| Results in stages, the reveal | research + apply, `reveal-next`, `results-seen` | "early results" stage flag; one reveal per episode across a couch's leagues |
| Standings | selectors, scoreboard | none |
| Cast stats explorer | `season_decisions` (events by episode, per season) | a read endpoint that counts and guards |
| Chat | per league, `reveal` type, reactions, reads | couch/show scope; fold by person's progress |
| Backstage | settings, rulesets, waivers, research, members | game-admin role; Recent changes log; undo for tier 2 |
| Draft room, blind draft | full | none |
| Couch | `league_groups` links leagues on one season | lasting couch: members, name, invite code, many seasons and shows |
| Where you are | per league membership (`results_seen_through`) | per person per show season |
| Following / watching a show | none (implied by leagues) | follow list, watch privately, hide from guide |
| Episode schedule, the guide | `show_seasons.air_time` (Survivor 51 only), `air-schedule.js` | per-episode air dates, release model (weekly / nightly / binge), drops, TV listings |
| Episode games | league bets (predictions) | ratings, bingo, polls, trivia, couch-level Call it |
| Watch along | none | reactions pinned to runtime, together sessions |
| Power rankings, trophies, superlatives | finished leagues exist | computed views |
| Social sign-in | Better Auth (username) | Google (and Apple) providers |

## Step 0a: back up the live leagues

Goal: a complete, restorable copy of everything the couch has played, before anything changes.

- `scripts/backup-leagues.js <outDir> [--group=<id>|--all]`, reading `DATABASE_URL`-style env for the target
  (the user runs it against production; Claude never handles the production string; the password pasted
  on 2026-10-18 should be rotated first). Writes one JSON file per table slice:
  - league level: `leagues` (with `state`), `league_memberships`, `league_groups`, `league_invites`,
    `league_rulesets`, `waiver_claims`, `blind_draft_picks`, `episode_team_notes`, `league_applied_decisions`,
    `chat_messages`, `chat_reactions`, `chat_reads`;
  - season level, for their seasons: `show_seasons`, `shows`, `show_formats`, `season_cast`,
    `season_cast_changes`, `season_decisions`, `season_rule_changes`, `episode_research`,
    `episode_research_items`;
  - the members' `user`, `user_settings`, `notification_prefs` rows (no sessions, no passwords).
- `scripts/restore-leagues.js <dir> --into=<local db>`: restores into a scratch local database and prints a
  diff of counts and each league's `state` hash against the backup. Prove the round trip once.
- Also recommend a Neon branch of production named `pre-new-design-<date>` (the user creates it in the Neon
  console: instant and free).
- `backups/` is gitignored. Done when a restore of a production backup into a scratch database matches.

## Step 0b: backend foundation

All additive; the classic app keeps working untouched. One migration file per concept.

1. **Couches.** `couches (id, name, created_by, created_at)`, `couch_members (couch_id, user_id, role
   'owner'|'member', joined_at)`, `couch_invites (code unique, couch_id, created_by, expires_at null)`, and
   `leagues.couch_id`. `league_groups` stays: it still links a season's leagues for one reveal and one chat.
   Backfill: every `league_groups` row becomes a couch (members = the union of its leagues' memberships;
   name = the group name or the show and season); each ungrouped league gets its own couch. The live couch
   becomes one couch with three leagues. New leagues get a couch in the create flow (classic: implicit, one
   per league; new design: chosen).
2. **Per-person progress and following.** `show_follows (user_id, season_id, seen_through int not null
   default 0, following bool, private bool, created_at, updated_at)`. Backfill from
   `league_memberships.results_seen_through` (the max across a person's leagues on a season). **Dual-write**:
   the classic `results-seen` endpoint also updates `show_follows`, and the new design writes both, so the
   two designs never disagree. `league_memberships.results_seen_through` is dropped at step C.
3. **Schedule.** `season_episodes (season_id, number, air_at timestamptz, runtime_min, title)` and
   `show_seasons.release ('weekly'|'nightly'|'binge')`, `show_seasons.drop_at`, `shows.kind
   ('competition'|'series')`. Backfill weekly air dates from `air_time` + `premiere_date` + the known episode
   count, where those exist; the admin edits the rest (a small admin screen, or the research prompt filling
   them).
4. **Roles.** `league_memberships.role` gains `'admin'` (Game admin: runs Backstage, can be handed off or
   shared). The "last commissioner can't step down" rule is enforced in the API.
5. **The spoiler guard, server side.** `src/lib/server/guard.ts`: `seenThrough(userId, seasonId)` (from
   `show_follows`, 0 when unknown: fail closed) and `secretFields(format)` (the format definition marks
   secrets, e.g. the Traitors' faction, revealed only once that person has left by your episode). Every
   new read endpoint trims through it; a unit test proves a request can't get past your episode.
6. **Read endpoints for the new design** (thin, composed from what exists):
   - `GET /api/me/home`: your couches, your follows with progress, your leagues grouped by season, due moves
     (from `action-items.js`), each couch member's follows (for the guide's faces).
   - `GET /api/couches/[id]` and `GET /api/seasons/[id]/space?couch=`: a show space's header, games, members.
   - `PUT /api/me/follows/[seasonId]` (where you are, follow, private).
- Tests: `tests/guard.test.js`, `tests/couch-backfill.test.js` (backfill on a fixture); `scripts/dev-test/
  new-fixture.js` (a `zt-` couch with three linked leagues on Survivor 51 like the live one, up/down).
- Done when migrations run clean on the local copy and a Neon branch, the classic app passes its existing
  checks unchanged, and the backfill gives the live couch one couch with three leagues and the right
  progress for each member.

## Step 0c: the new shell

- **Routes** (a route group, `src/app/(new)/`), mirroring the mock's hash routes:
  `/home` (hub), `/show/[seasonId]/[tab]` (tonight · episodes · standings · cast · chat),
  `/show/[seasonId]/draft`, `/show/[seasonId]/blind`, `/show/[seasonId]/backstage/[[...page]]`, `/start/[step]`,
  `/join/[code]`, `/settings`. Signed-out `/` stays the landing page (already shipped).
- **Opting in.** `user_settings.ui ('classic'|'new')`. The Coming Soon! row becomes **Try the new design**
  (sets it, goes to `/home`); the new design's settings has **Back to the classic design**. When `ui='new'`,
  signed-in `/` redirects to `/home`. The full mock stays at `/mock` for reference.
- **Tokens and primitives.** The mock's tokens are DESIGN.md's Night palette plus a few additions; amend
  DESIGN.md once here (the mock's bends: more than one yellow in the guide, view transitions). Dark first;
  the Studio (light) theme follows in step 15. Primitives: sheet, page, toast, tab bar, show bar, caption
  plate, chip, row, empty state, the guard chip. Reuse what exists in `src/components/ui` where it fits.
- **Motion.** Port `nav.js`'s rules with React `<ViewTransition>` (read
  `node_modules/next/dist/docs/01-app/02-guides/view-transitions.md` first): channel change (hub card art →
  show header), push / pop by depth, tabs sideways with the header and tab bar still, explorer re-sorts.
  Transform and opacity only; reduced motion crossfades. No confetti (user, 2026-10-23).
- **Preview system.** `src/new/preview.ts` (registry: key → step), `<Preview step>` (dashed outline, a small
  "Preview" tag, taps toast "Coming soon"), and `src/new/fixtures/` (the mock's data ported to typed
  modules). `scripts/dev-test/check-preview.js` lists what's still previewed per step and fails if a step
  marked done in Status still has entries.
- Done when an opted-in account lands on `/home` and moves through empty route shells with the motion
  working, at 390px and on desktop, and classic is unchanged.

## Step 0d: hub and show space, ported

Port the mock's hub and show space screens to React, on fixtures, all behind `<Preview>`, so the new design
is browsable end to end (the "mock in the foreground"). Real data only where it's already free: your name,
your couch's members, your leagues listed as shows, the show header (art, season, countdown).

- Hub: greeting, couch line, Who's on now, the guide, streaming rail, Up next, your shows, Previously on,
  couch verdicts, couch is watching, On the couch, Commercial break, By the numbers, trophy shelf.
- Show space: show bar, the five tabs and their content, the moves dock, sheets for moves.
- Everything else (Backstage, drafts, watch along, first run, settings) is reached from these screens and,
  until its step, opens the mock at that route in a new tab with a "Preview" note.
- Split across two sessions if needed (hub, then show space). Done when every hub section and show tab is
  ported and previewed, and the check script lists them all.

## Steps 1–7: parity with what the couch plays today

Each step: port the area from the mock, wire real data, remove its fixtures and Preview entries, add a check.

1. **Show space on real leagues.** The show space for a season with the couch's leagues: game cards (place,
   type), Tonight's checklist from `action-items.js` / `commissioner-items.ts` (each row opens the move),
   the moves dock (needs you → all set → locked at airtime) writing through the existing lineup, pick and
   bet endpoints, and Standings from the selectors. Mock: `show.js`, `dock.js`, `episode.js` (`standing`).
2. **Episodes, staged results, the reveal.** The Episodes tab; results in stages (waiting → early: who went
   home → final), which needs a stage flag on applied results; one reveal per episode for every game the
   couch has on the season (the group's leagues), reusing `reveal-next` / `results-seen` and writing
   progress through `show_follows`. Mock: `episode.js`, `stages.js`.
3. **Cast explorer and stats.** `GET /api/seasons/[id]/stats?from=&to=` counting `season_decisions` events
   through the guard; Faces by faction (secret factions never as filters), Rank by full stat names from the
   format, By episode heatmap, the slider capped at your episode, Patterns, Compare, Share, the castaway
   story, the Stats card and tab, By the numbers' sorted pages. Mock: `explorer.js`, `stats.js`, `guard.js`.
4. **Chat.** One chat per couch and show (today's group chat for the season), folded past each reader's
   progress, reactions, the reveal line. Reuse the chat API with a show/couch scope. Mock: `show.js`
   (`tabChat`), `watching.js` (`wChat`).
5. **Backstage I.** Results with Ask an AI (the research flow exists), apply to every game, the early
   "who went home?" one-tap, the Recent changes log (a new `league_changes` table every write appends to),
   guards by blast radius with undo for tier 1 and 2. Mock: `backstage.js`, `askai.js`, `guards.js`.
6. **Backstage II.** Waivers (v2 exists), scoring rules (rulesets exist), members and roles (the new admin
   role, hand off / share, last-commissioner guard), game settings with "Reset to recommended". Mock:
   `backstage.js`, `settings.js`.
   **Waivers: the Simple design was picked (2026-10-23).** Mock: `waivers.js` (`?waivers=simple`, the default),
   compared with the old v2 port on `waivers-options.html`; checked by `scripts/dev-test/check-site-waivers.js`.
   - *Player:* a Waivers page pushed in from the moves dock and Tonight. "Replace Jenna" chips (yellow: needed)
     and "Optional · 1 free swap" (uncolored); your whole team with one quiet positive tag each; every button
     says **Swap** (yellow on whoever's out); a set swap reads "Sharonda comes in" (Backup: Devin) with Change.
     Nothing is chosen for you: the most-points pick is only the fallback if you forget, and the page says so.
     Picking order as four faces, lowest score first. A bottom bar keeps score ("Jenna's spot is open" → "2
     swaps in"). One picker for every swap, using the Cast tab's own controls (episode slider, Ranked by and
     Show dropdowns); your pick yellow, backups outlined and marked Backup. No points copy anywhere.
   - *Results:* the run plays like an episode (a "Waivers ran" plate on Tonight opens a reveal), then sits in
     Episodes as "Waivers · after Episode N" between the two episodes, with its own page in picking order.
   - *How it works:* three answers for the league plus the "When moves happen" lanes (Replace / Swap).
   - *Commissioner:* settings are one choice of feel (Casual / Balanced / Competitive, applied on tap) with the
     rest under Fine-tune; Open a waiver window is three presets (Replace who's out · Replace + 1 swap · Swap
     anyone) and no "Players get" preview.
   - *Engine deltas to make:* the fallback pick (today's `autoFill`) on for Casual and Balanced, off for
     Competitive; waiver order "lowest score first" in place of rolling for these leagues (confirm before
     changing a running league); the free swap and optional swaps map onto `replaceRule` + `waiverWindows.swaps`
     unchanged. Open question: under "No replacements", may a player spend an optional swap on someone out?
7. **Draft room and blind draft.** Casual-first: no timer by default, admins pick for someone, the blind
   draft's private picks and reveal. Endpoints exist. Mock: `draft.js`.

**Then the couch switches:** set `ui='new'` for the three members (with their OK), keep classic one tap
away, and watch for a week before step C is even considered.

## Steps 8–15: beyond parity

8. **Hub I.** Up next (needs-you first, else soonest airing), your shows (posters, flip), Previously on
   (recaps from results through your episode), By the numbers (stats cards opening sorted pages, an
   occasional couch accolade), power rankings (by finishing position, normalised across game types), the
   trophy shelf (only once a season has ended), Commercial break as every game. Couch verdicts wait for
   step 12. Mock: `index.html` (hub), `hubplus.js`, `fresh.js`.
9. **Couches, sign-up, first run, join, sign-in.** Start / join / switch couches, invite codes, the landing →
   first run path (shows → where → save your shows → people), joining mid-season by ownership rules,
   sign-in. Google sign-in via Better Auth (needs a Google OAuth app the user creates; Apple needs a paid
   developer account, so later). Mock: `landing.js`, `round2.js`.
10. **Watching.** Follow a show (with where you are), watch privately, the show space for a show with no
    game (series: Tonight · Episodes · Cast · Chat; competition: plus Standings), Make it a game (the cast
    import exists), the both-watch nudge. Mock: `watching.js`.
11. **TV guide.** The guide from `season_episodes` for the couch's shows plus all of TV from a listings
    source (recommended: TVmaze's free schedule API, cached in a `tv_listings` table by a daily job), faded
    with Add / Hide from guide (`guide_hidden`), drop days, planned watch-along nights. Mock: `tvguide.js`.
12. **Episode games.** Rate it and the couch verdict (`episode_ratings`), Call it at couch level, bingo
    (`bingo_cards`, `bingo_marks`), polls, trivia; Commercial break on real data. Mock: `episode.js`,
    `index.html` sheets.
13. **Watch along.** Reactions pinned to runtime (`watch_reactions (season_id, episode, runtime_ms, user_id,
    kind, text, gif)`), shown 30s late, never early; GIFs (a provider key: Tenor or GIPHY); together sessions
    (`watch_sessions`, a shared clock and pause for everyone) over polling (every few seconds while open;
    no websockets needed at this group size); screen wake lock. Mock: `index.html` (`openWatch`),
    `watching.js`.
14. **Streaming shows.** Release model binge, drop day in the guide, the streaming rail, planned nights.
    Mock: `streaming.js`.
15. **Notifications and account settings.** Notifications by moment (push exists), spoiler-safe copy, the
    settings page, the Studio light theme. Mock: `settings.js`.

## Step C: cutover

- `ui='new'` for everyone; classic routes and components removed (the shell `auth-gate.tsx`, the league
  pages under `src/app/` that the new routes replaced, `league-strip`, `action-bar`, and so on: list them
  from the import graph, not memory).
- Contract migrations: drop `league_memberships.results_seen_through` (progress lives in `show_follows`),
  and anything else 0b's expand left behind.
- `src/new/preview.ts` and `src/new/fixtures/` must already be empty; delete them, `<Preview>`, and
  `check-preview.js`.
- DESIGN.md, README, HANDOFF and the User Manual doc updated; a What's New entry (user approves the copy).

## Open decisions (recommendations first)

1. **How the couch opts in:** a per-account setting (recommended) vs a separate URL.
2. **Couch vs `league_groups`:** new couch tables, with `league_groups` kept for one season's linked leagues
   (recommended), vs folding groups into couches.
3. **Realtime for watch along and chat:** polling (recommended; the 30s late bias makes it plenty) vs a
   hosted realtime service later if groups get big.
4. **TV listings source:** TVmaze (free, no key; recommended) vs TMDB (key) vs admin-entered only.
5. **Social sign-in:** Google first (the user creates the OAuth app); Apple when there's a developer account.
6. **GIFs:** Tenor or GIPHY (both need a key; check their terms for a mock-to-production move).
7. **Light theme:** dark first, Studio in step 15 (recommended).
8. **The mock's source:** `.impeccable/mocks/site/` is gitignored and only on one machine; `public/mock/site/`
   is a committed copy. Recommended: treat the committed copy as the source (or commit the source) so the
   reference survives a lost laptop.

## Risks

- **Breaking the live game.** Mitigated by additive migrations, dual-write progress, classic untouched until
  step C, tests only on `zt-` fixtures, and a backup before each migration that ships.
- **Scope creep in parity steps.** Steps 1–7 port and wire; new ideas go to 8–15 or BACKLOG.md.
- **Porting drift.** The mock stays at `/mock`; each step screenshots its area before and after.
- **Session context.** This file's Status and As built notes carry it; keep them short and current.
