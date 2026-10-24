# Plan: moving the app onto the new design

Status: **plan, 2026-10-23; updated 2026-10-24** with every mock decision since (the critique refinements,
the Games tab, how results get in, solo, sharing, privacy, and the kinds-of-show and rulebooks round). The
full-site mock (`.impeccable/mocks/site/`, live at `/mock`, decisions in memory `site-mock-decisions`) is
about 80% settled. This plan takes the real app onto it, piece by piece, without losing anything the one
live couch has played. It is the "second-pass drill-down" that `PLAN-couch-and-episode-night.md` asked
for; where the two disagree, this file and the mock win.

**How to use this file.** It's written to be read in parts. Every session reads **Status** (the table just
below), **The approach**, the **Rules for every session**, and then only its own step's section. Each step
ends by updating its Status row and adding an **As built** note under its section (what changed, what was
decided on the way, what the next step should know). That's the continuity between sessions; nothing
else needs re-reading.

## Status

| Step | What | State | Model / effort |
|---|---|---|---|
| 0a | Back up the live leagues | **done** 2026-10-24 (production backup restored and matched) | Opus · medium |
| 0b | Backend foundation (couch, progress, schedule, roles, guard) | **done** 2026-10-24 on the branch (rehearsed on production's data; before it ships: a fresh backup and a Neon branch run, see As built) | Opus · high |
| R1 | Rulebooks phase 1: schema, built-ins as blocks, How it works view model (logic only) | not started | Opus · high |
| R2 | Rulebooks phase 2: the compiler, legacy freeze, engine relaxations | not started | Opus · high |
| R3 | Rulebooks phase 3: `rulebooks` tables, backfill, resolution behind a flag | not started | Opus · high |
| 0c | The new shell, Preview system, fixtures, motion | not started | Opus · high |
| 0d | Hub and show space ported (fixtures behind Preview) | not started | Opus · high |
| 1 | Show space on real leagues: Tonight's move cards, Games tab, How it works | not started | Opus · high |
| 2 | Episodes, staged results, the one reveal, share at the reveal | not started | Opus · high |
| 3 | Cast explorer and stats, server-side spoiler guard | not started | Opus · high |
| 4 | Chat, per couch and show, spoiler-folded | not started | Opus · medium |
| 5 | Backstage I: results (trusted results apply on their own), Recent changes, guards and undo | not started | Opus · high |
| 6a | Backstage II: Simple waivers, members and roles, game settings, Scoring rules (read side) | not started | Opus · high |
| 6b | Community results, disputes, house rulings, admin; rulebooks phases 4–7 | not started | Opus · high |
| 6c | How results get in: copy and paste, One tap, Autopilot (coming soon) | not started | Opus · medium |
| 7 | Draft room and blind draft | not started | Opus · medium |
| — | **Switch the couch to the new design by default** | — | — |
| 8 | Hub I: focus-first hub, More on the couch and its six pages | not started | Opus · high |
| 9 | Couches, sign-up, first run, join, sign-in, solo pools and the practice couch | not started | Opus · high |
| 10 | Watching: Add a show, follow, where you are, Make it a game for every kind; rulebooks phase 8 | not started | Opus · high |
| 11 | TV guide: schedules, all of TV, hide from guide, drops, planned nights | not started | Opus · high |
| 12 | Episode games: Rate it and verdicts, Call it, bingo, polls, trivia | not started | Opus · high |
| 13 | Watch along: pinned reactions, GIFs, together sessions | not started | Opus · high |
| 14 | Streaming shows and the rail | not started | Opus · medium |
| 15 | Notifications by moment, account settings, What your couch sees | not started | Opus · medium |
| C | Cutover: new design for everyone, classic removed, cleanup; rulebooks phase 9 | not started | Opus · high |

Steps 1–7 bring the new design to parity with what the couch plays today; after them the couch switches to
it. Steps 8–15 are new features and can be reordered. Desktop layouts come after step 15 (until then the new
design is a centred phone column on a desktop, like the mock).

**Rulebooks** (`docs/PLAN-admin-shows-rulebooks.md` is the design, `docs/PLAN-rulebooks-implementation.md` the
build; phase numbers are the implementation plan's). R1–R3 are its phases 1–3, logic and data only, built
before the new shell so How it works and Scoring rules are real from the start. None of its classic screens
are built: How it works is drawn in the new design. Phases 4–7 are built inside 6b (the editor is a
rulebook's page under admin Find; Make it ours is the commissioner's Scoring rules), phase 8 in step 10 (the
library and the new-show flow), phase 9 with C.

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
- **Branch:** all code work is on `new-design` (cut from master on 2026-10-24) so the user can test locally
  first. Never merge it or push it without asking. **Production fixes** go on master (or a short `fix/…`
  branch off it), deploy as usual, and are merged into `new-design` straight after, so the port always
  carries them.
- **Migrations on the branch** are numbered from `0100` (master's fixes keep `0066`–`0099`), so the two
  lines never collide and a fresh database applies them in order. Never rename a migration once any
  database has applied it (`db/migrate.js` tracks file names). Every build runs `db/migrate.js`, and
  Preview shares production's `AUTH_DATABASE_URL`, so Vercel builds production only (Ignored Build Step,
  since 2026-10-24). Before the branch is deployed anywhere, Preview gets its own database: a Neon branch
  whose connection string the user pastes in.
- **Hosting limits** (`docs/HOSTING.md`): Neon's Free plan meters what queries send back (5 GB a month) and
  compute hours (100; it sleeps only after 5 idle minutes), and running out of either suspends the database
  until the month resets. Anything polled reads small: league state through
  `src/lib/server/league-states.ts`, versions or counts instead of whole lists (`check-chat-polls.js`), and
  nothing should wake the database on a timer. **A step that adds polling, a scheduled job, stored data or a
  service updates HOSTING.md** (what it uses, the estimate, the Changelog) in the same commit.
- **The repo is public** (since 2026-10-24, `docs/HOSTING.md`): no secrets, no real usernames, names or emails
  in tests and docs (the mock's demo names: alex, riley, jordan, sam), and no screenshots of real data in git.
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
| Games tab (standings, this week's episode games) | selectors, scoreboard | none for standings; episode games in step 12 |
| Cast stats explorer | `season_decisions` (events by episode, per season) | a read endpoint that counts and guards |
| Chat | per league, `reveal` type, reactions, reads | couch/show scope; fold by person's progress |
| Backstage | settings, rulesets, waivers, research, members | game-admin role; Recent changes log; undo for tier 2 |
| Results from everyone | `episode_research` (one row per episode), `season_decisions`, `league_applied_decisions` | a row per submission; Reported / Confirmed / Disputed / Canonical; `fact_disputes`, `league_rulings` |
| How results get in | "Ask ChatGPT for me" (experimental) and the bot's schedule (`PLAN-bot-research.md`) | per couch and show-season unlocks, the three ways, "Free during beta" |
| Rulebooks, How it works, kinds of show | formats (code + `show_formats`), `league_rulesets`, `season_rule_changes` | the rulebooks plan: R1–R3, then 6b, step 10 and C |
| Solo play | computer players (`src/lib/game/bot-logic.js`) | public pools per season, the practice couch |
| Sharing, privacy | none | the share card at the reveal; What your couch sees |
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

**As built (2026-10-24, on `new-design`).**
- `scripts/backup-leagues.js <outDir> [--group=<id>]`: every league and season by default. Reads
  `BACKUP_DATABASE_URL` when set, else `AUTH_DATABASE_URL`, and prints only host and database. One read-only,
  repeatable-read transaction. One file per table, each row as Postgres prints it (`row_to_json`, UTC, in
  primary-key byte order), plus `manifest.json`: rows and a sha256 per table, each league's state md5, the
  migrations applied. Tables: the list above, plus `wiki_proposals` / `wiki_proposal_items` (league data)
  and `wiki_extractions` (782 of the local copy's results point at one). People: everyone the rows point
  at (members, deciders, approvers), with their settings and notification prefs; never `account` or
  `session`. Shared helpers in `scripts/backup-common.js`.
- `scripts/restore-leagues.js <dir> --into=restore_<name> [--drop]`: the local server only, a name starting
  `restore_`. Drops and creates it, makes Better Auth's tables (its `getMigrations` with the username and
  admin plugins: the CLI isn't installed, and `approved` comes from 0058 as in production), runs
  `db/migrate.js`, clears the rows migrations seed, and loads in foreign-key order (the two cycles,
  `league_groups.favorite_league_id` and `leagues.ruleset_id`, filled in afterwards). Then it checks each
  file against its manifest hash, each table read back the same way (or as data, when only the text
  differs), and each league's state hash; prints the diff and exits 1 on any difference. A `--group`
  backup's references to rows it doesn't hold are settled the way deleting those rows would (nulled or
  left out) and reported.
- Proven: the local copy (`--all`: 6 leagues, 27 tables, 1,038 results) restores byte for byte (28 tables since
  master's 0067 added `season_episodes`, which the backup includes).
  `scripts/dev-test/check-backup-restore.js` with `backup-fixture.js` (every table filled, both cycles, a
  league outside the group) passes the `--group` round trip and catches a backup file changed afterwards;
  it found and now guards a bug where a nulled reference dropped its row.
- Left out on purpose: `episode_text_chunks` (embeddings, rebuilt from the wiki), operational logs
  (`reminder_log`, `auto_research_attempts`, `bot_research_runs`, `issue_reports`, `push_subscriptions`),
  and login data. The Neon branch holds everything.
- **Done 2026-10-24:** the user ran the production backup (14:16 UTC, `backups/prod-2026-10-24`, local only: 6
  leagues, 1,135 results, 6 people), and it restored into a scratch database matching exactly: 28 tables and every
  league's state hash, with production's migrations equal to the code's. How it was run, for next time:
- The production backup. The Neon branch `pre-new-design-2026-10-24` exists (made
  2026-10-24, never auto-deletes); rotating the password first was deferred (docs/HOSTING.md has the steps)
  and isn't needed for this. With the connection string Vercel's `AUTH_DATABASE_URL` holds (Neon › Connect,
  Show password; direct, not pooled):
  ```
  $env:BACKUP_DATABASE_URL = "<production connection string>"
  node scripts/backup-leagues.js backups/prod-2026-10-24
  Remove-Item Env:BACKUP_DATABASE_URL
  node scripts/restore-leagues.js backups/prod-2026-10-24 --into=restore_prod
  ```
  The step is done when that restore prints "everything matches". It warns if production has run
  migrations this code hasn't. The backup is a few MB of Neon transfer.
- For the next step: every script in `scripts/` fails eslint's `no-require-imports` (they're CommonJS and
  `scripts/` isn't ignored; pre-existing), and three tests in `tests/tour-commissioner.test.js` already
  fail on master (the tour's draft finds no free agent; untouched here).

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
3. **Schedule.** `season_episodes` already exists (master's 0067, 2026-10-24: `air_at`, `runtime_min`, `note`,
   `source` research/admin, `reported_in`, filled from each episode's research about the next one, read
   through the `season_air_dates` view); 0b extends it (`title`, backfilled weekly rows) rather than making
   it. Also `show_seasons.release ('weekly'|'nightly'|'binge')`, `show_seasons.drop_at`, `shows.kind
   ('competition'|'series'|'talk'|'sport')`, the same four kinds as the rulebook's `kind` (R1's schema). The
   kind is inferred when a show is set up (step 10), never asked; every show today backfills as a competition.
   Backfill weekly air dates from `air_time` + `premiere_date` + the known episode count, where those exist;
   the admin edits the rest (a small admin screen, or the research prompt filling them).
4. **Roles.** `league_memberships.role` gains `'admin'` (Game admin: runs Backstage, can be handed off or
   shared). The "last commissioner can't step down" rule is enforced in the API.
5. **The spoiler guard, server side.** `src/lib/server/guard.ts`: `seenThrough(userId, seasonId)` (from
   `show_follows`, 0 when unknown: fail closed) and `secretFields(format)` (the format definition marks
   secrets, e.g. the Traitors' faction, revealed only once that person has left by your episode). Every
   new read endpoint trims through it; a unit test proves a request can't get past your episode. The same
   module answers what one member shares with another (`shares(viewerId, memberId, what)`): for now only a
   show watched privately is hidden; step 15's What your couch sees adds the levels in this one place.
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

**As built (2026-10-24, on `new-design`).**
- **Migrations 0100–0105**, one per concept, the two backfills in files of their own so they can run again
  (idempotent: `tests/couch-backfill.test.js` runs them in a rolled-back transaction, `restore-leagues.js` after
  restoring a backup from before 0100). 0100 `couches`, `couch_members` (owner / member), `couch_invites`,
  `leagues.couch_id` (no ON DELETE: a couch with games can't be deleted). 0101: each linked group is one couch
  (its name, else show and season), every other league a couch of its own (its name); everyone in its leagues
  is on it; the owner is its maker if on it, else its earliest commissioner, else its earliest member. 0102
  `show_follows`; 0103 fills it: each person's furthest mark per season, no mark = 0, forward only. 0104
  `season_episodes.title`, `show_seasons.release` / `drop_at`, `shows.kind` (all competition). 0105 the
  `admin` role.
- **Changed from the plan: no weekly rows stored.** A guessed date in `season_episodes` would sit over the
  wiki's real one in `season_air_dates`, the clock lineups lock by, and go stale when the premiere moves.
  `src/lib/server/schedule.ts` lists a season's episodes from `episodeAirTime` (research's starts, the wiki,
  weekly), titles from `season_episodes` else the wiki, runtimes from research else the season's
  `episode_minutes`. `episodeAirTime` takes `release` (nightly steps a day, binge drops all at `dropAt`), but
  the classic callers (`air-times.ts`, `db/reminders.js`, `db/waivers.js`, `db/auto-research.js`,
  `db/bot-research.js`, `src/lib/admin-season.ts`) don't pass it, so everything stays weekly as today: pass it
  there before a nightly or binge season goes live (step 14 at the latest).
- **Rehearsed on production's data:** 0a's backup restored at the old schema, then 0100–0105 applied as a
  deploy would: every league on a couch, the live couch one couch with its three leagues and all four members
  (one owner), each person's progress the furthest of their leagues' marks, the backfills a no-op run again.
  `scripts/dev-test/check-foundation-data.js` checks those rules on any database (counts only).
- **Classic keeps it in step**, best effort after each write so nothing classic can fail on it
  (`src/lib/server/couches.ts`, `follows.ts`): a new league is a couch of its own; joining (code, invite, admin)
  puts you on its couch and following its season; leaving or an admin's removal takes you off once you're in
  none of its leagues; deleting a league deletes its couch when that's empty; linking moves the league onto the
  group's couch (one left empty is folded in and goes); unlinking gives it a couch of its own. Both writes in
  `results-seen.ts` and the late-join route move the follow forward. `healCouches` (home, space) repairs a
  league with no couch or a member not on it, which also covers the deploy window (the old code serving for a
  few minutes after the migrations ran). *For step 9:* classic's leave suits implicit couches;
  couch-only members need leaving a game and leaving a couch kept apart.
- **Roles:** `requireLeagueRole` ranks member < admin < commissioner (`roles.ts`); classic routes still ask for
  commissioner, so a Game admin is a member there. `PUT /api/leagues/[leagueId]/members/[userId]/role` and the
  super-admin memberships route refuse to leave a league without a Commissioner. Leaving the league as its last
  commissioner isn't blocked yet (classic has no hand-off screen): 6a's Members page should add it.
- **Guard** (`src/lib/server/guard.ts`): `seenThrough` is the follow's mark, 0 when unknown, except that someone
  with spoiler protection off sees everything on a season where they play an ordinary seat (as `results-seen.ts`:
  late joiners always go by their mark); `throughEpisode` / `withinSeen` drop later and unknown episodes;
  `secretFields` is `role` for a format with `roles` (Traitors) and `withoutSecrets` keeps it only for people
  out by then; `shares` / `visibleFollows` hide a private or unfollowed show. Nobody else's progress is sent.
- **Endpoints:** `GET /api/me/home` (couches with members, what each openly watches and the games; your shows
  with where you are, `upNext`, `latestAired` and your games; `moves` and `backstage` from `due-moves.ts`,
  which `/api/me/actions` now shares), `GET /api/couches/[couchId]`, `GET /api/seasons/[seasonId]/space?couch=`,
  `PUT /api/me/follows/[seasonId]` (`seenThrough` is refused with 409 on a season you play: step 2's reveal
  moves it). Game names come from `league-season.ts` `gameName`. Nothing polls them yet.
- **Backups** include the four tables, a backup of a database without them goes without (`backup-common.js`
  `LATER_TABLES`), and restoring one fills them in from 0101 and 0103. `check-backup-restore.js` covers both.
- **Checks:** `tests/guard.test.js`, `tests/couch-backfill.test.js` (local database, skipped without it), release
  cases in `tests/episode-schedule.test.js`; `scripts/dev-test/new-fixture.js` (a zt couch like the live one,
  a Traitors season followed openly and privately, a league ready to link) and `check-foundation.js` (all of the
  above over HTTP, then the data check). Classic unchanged: `check-chat-polls`, `check-up-next`, `check-reveal`
  at 390 and `check-backup-restore` pass; `npm test` 398 pass, plus the 3 known tour-commissioner failures.
- **Before 0b reaches production** (it ships with the branch, and nothing has been pushed): (1) a fresh backup,
  0a's commands into a new folder (`backups/prod-<date>-pre-0b`), restored with `restore-leagues.js` until it
  prints everything matches; (2) a Neon branch of production (Neon › Branches › New, e.g. `pre-0b-<date>`),
  rehearsed from your own terminal with its connection string (the script refuses production's host):
  ```
  $env:REHEARSE_DATABASE_URL = "<the Neon branch's connection string>"
  node scripts/rehearse-migrations.js
  Remove-Item Env:REHEARSE_DATABASE_URL
  ```
  It applies the migrations to the branch and must end "all good"; (3) then deploy.
- **For R1:** `shows.kind` has R1's four kinds; `secretFields` reads a format's `roles`, so R1's schema should
  keep secret roles findable the same way (or change `secretFields` with it).

## Steps R1–R3: rulebooks, logic and data only

Build from `docs/PLAN-rulebooks-implementation.md` (its sections 3–5 and phases 1–3), with
`docs/PLAN-admin-shows-rulebooks.md` for the design. Changes to those plans' scope:

- **R1 (phase 1) is logic only:** `rulebook-schema.js`, `rulebook-moments.js`, `rulebook-describe.js` (the How
  it works view model), the three built-ins as blocks, `blocksFromFormat` for stored formats. None of phase
  1's classic screens (no `src/components/rulebook/`, no Rulebook tab on the admin season page, no Shows ·
  Rulebooks control, no commissioner view): How it works is drawn in step 1. The schema has the four
  kinds, with a series' two starting points (reality, scripted) and sport as a full kind whose parts say
  Race or Event, not Episode. Done when the describe view models for every built-in and stored format are
  covered by tests and `npm test` is green.
- **R2 (phase 2)** as written: the compiler, the legacy freeze, the engine relaxations; the harness diff for
  unchanged formats is empty.
- **R3 (phase 3)** as written, behind its flag (off): the tables, the backfill, `db/rulebooks.js`,
  resolution through rulebooks. Number the migration after the latest one (the plan's `0060` is taken).
  Take a 0a backup first; run the backfill on the local copy and a Neon branch.

## Step 0c: the new shell

- **Routes** (a route group, `src/app/(new)/`), mirroring the mock's hash routes:
  `/home` (hub), `/show/[seasonId]/[tab]` (tonight · episodes · games · cast · chat; the same five on every
  show, solo drops chat; the mock's route key for Games is still `standings`), `/show/[seasonId]/waivers`,
  `/show/[seasonId]/draft`, `/show/[seasonId]/blind`, `/show/[seasonId]/backstage/[[...page]]`, `/start/[step]`,
  `/join/[code]`, `/settings`, and the new admin (step 6b) on a path of its own until C retires classic
  `/admin` (classic also owns `/waivers`, `/account`, `/setup`: check `src/app/` before naming). How it
  works and More on the couch's pages are pages pushed over the current route, as in the mock. Signed-out
  `/` stays the landing page (already shipped).
- **Opting in.** `user_settings.ui ('classic'|'new')`. The Coming Soon! row becomes **Try the new design**
  (sets it, goes to `/home`); the new design's settings has **Back to the classic design**. When `ui='new'`,
  signed-in `/` redirects to `/home`. The full mock stays at `/mock` for reference.
- **Tokens and primitives.** The mock's tokens are DESIGN.md's Night palette plus a few additions; amend
  DESIGN.md once here (the mock's bends: more than one yellow in the guide, view transitions). Dark first;
  the Studio (light) theme follows in step 15. Primitives: sheet, page, toast, tab bar, show bar, caption
  plate, chip, row, empty state, the guard chip. Reuse what exists in `src/components/ui` where it fits.
  Rules they carry (critique, 2026-10-23/24): **yellow only for what you must do** (optional actions are
  outlines; Weekly Lineup is Lake `#5089c9`; tribes never fill); **one spoiler chip** everywhere,
  "Spoiler-safe · you're on Ep N · Change" (the guard chip; "Live" is not a spoiler word); **calm clocks**
  (more than a day out reads "Wed 8:05 PM · in 5 days"; seconds tick only inside the last day); plates are
  for single moments, never stacked as list items; **Watch along** is the only name for watching together.
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

- Hub, in its two shapes (mock `refine.js` `wireHub`, `couchpages.js`): **grows with you** for a new
  member's first week or a brand-new couch (`?member=new`, `?fresh=1`): status line, Get the couch going,
  Up next, Your shows, the guide, the feed, and a note of what shows up as the couch plays. Then **focus
  first**: a one-line status ("2 moves due · …" or "You're all set"), Up next with a calm time, Who's on
  now, Your shows, the both-watch nudge, the guide (rolls only once you reach it), the streaming rail, The
  couch is watching, the feed (On the couch), and **More on the couch**, one tap each to its own page:
  power rankings, Commercial break (every game), By the numbers, Couch verdicts, Previously on (cold open,
  Last time as the vote-out card, the boot order as faces), Trophy shelf.
- Show space: show bar, the five tabs (Tonight · Episodes · Games · Cast · Chat) and their content, Tonight's
  move cards, the moves dock, sheets for moves, the How it works page.
- Everything else (Backstage, drafts, watch along, first run, settings) is reached from these screens and,
  until its step, opens the mock at that route in a new tab with a "Preview" note.
- Split across two sessions if needed (hub, then show space). Done when every hub section and show tab is
  ported and previewed, and the check script lists them all.

## Steps 1–7: parity with what the couch plays today

Each step: port the area from the mock, wire real data, remove its fixtures and Preview entries, add a check.

1. **Show space on real leagues.** The show space for a season with the couch's leagues. Mock: `show.js`,
   `dock.js`, `episode.js` (`standing`), `refine.js` (`tabTonight`), `gamestab.js`, `rulebook.js` (`howPage`).
   - *Tonight* (option 2C, picked 2026-10-24): the phase as a heading from the clock ("Episode 6 · Wed 8:05
     PM · in 5 days", "On air · Episode 6", "Results"), then **Your moves** as swipeable cards, one per
     required move from `action-items.js` (Set lineup, Pick who comes in, Make my pick): open moves first with
     one yellow button on the first, finished ones as done cards with Change, all done as one "You're set for
     Episode N" card. Then **Extras this week** (predictions, bingo: optional, no counts). No dock on Tonight
     before airtime, never a second Reveal / Final scores button beside the plate, and no commissioner job
     (5B, step 5): `commissioner-items.ts` feeds Backstage and a dot on the show's ⋯ menu.
   - *The moves dock* on the other tabs (needs you → all set → locked at airtime), writing through the
     existing lineup, pick and bet endpoints. Save never locks; airtime does.
   - *Games tab*: your games (place, type) and standings from the selectors, then "This week" episode games
     (fixtures behind Preview until step 12). A show you don't play gets Make it a game / Play it (step 10).
   - *How it works*, for everyone (a row on the Games tab and the show's ⋯): the premise, each episode as a
     rundown, the season as a cell per episode, who's playing, ways out, twists, what scores. Built from R1's
     `rulebook-describe.js` and spoiler-safe through the guard: future phases show by their condition, later
     updates stay hidden.
2. **Episodes, staged results, the reveal.** The Episodes tab; results in stages (waiting → early: who went
   home → final), which needs a stage flag on applied results; one reveal per episode for every game the
   couch has on the season (the group's leagues), reusing `reveal-next` / `results-seen` and writing
   progress through `show_follows`. **Share** at the reveal's last beat: post to the couch, or a story card
   that leaves out who went home by default. Mock: `episode.js`, `stages.js`, `share.js`.
3. **Cast explorer and stats.** `GET /api/seasons/[id]/stats?from=&to=` counting `season_decisions` events
   through the guard; Faces by faction (secret factions never as filters), Rank by full stat names from the
   format, By episode heatmap, the slider capped at your episode, Patterns, Compare, Share, the castaway
   story, the Stats card and tab, By the numbers' sorted pages. Mock: `explorer.js`, `stats.js`, `guard.js`.
4. **Chat.** One chat per couch and show (today's group chat for the season), folded past each reader's
   progress, reactions, the reveal line. Reuse the chat API with a show/couch scope. Mock: `show.js`
   (`tabChat`), `watching.js` (`wChat`).
5. **Backstage I.** Results with Ask an AI (the research flow exists; copy and paste is the free way, 6c adds
   the others), apply to every game, the early "who went home?" quick check, the Recent changes log (a new
   `league_changes` table every write appends to), guards by blast radius with undo for tier 1 and 2.
   **Trusted results apply on their own (option 5B, 2026-10-24):** a commissioner's high-confidence results
   apply without a review, with Show me and Undo; only sources that disagree wait for them. A commissioner
   stays spoiler-safe (Quick check's result stays hidden until they choose) and has no results job on
   Tonight. Mock: `backstage.js`, `askai.js`, `guards.js`, `refine.js` (`bsResults`, `afterBlock`).
6. **Backstage II, results from everyone, and how results get in**, in three parts, each with its own section
   below: **6a** the game's own Backstage pages, **6b** community results and the admin (with rulebooks
   phases 4–7), **6c** the bot tiers.
7. **Draft room and blind draft.** Casual-first: no timer by default, admins pick for someone, the blind
   draft's private picks and reveal. Endpoints exist. Mock: `draft.js`.

**Then the couch switches:** set `ui='new'` for the three members (with their OK), keep classic one tap
away, and watch for a week before step C is even considered.

### Step 6a: Backstage II, the game's own pages

Simple waivers (below; v2's engine exists), members and roles (the new admin role, hand off / share, the
last-commissioner guard), game settings with "Reset to recommended", and **Scoring rules' read side**:
"Following Survivor 51's rulebook", How it works, and this game's points (rulesets exist). **Make it ours**
comes at the end of 6b, because it reuses the editor and the edits built there. Mock: `backstage.js`,
`settings.js`, `waivers.js`, `rulebook.js`.

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

### Step 6b: results from everyone, disputes, house rulings, the admin; rulebooks phases 4–7

**Results settle by community; admin is the exception desk (decided 2026-10-23).** Mock: `community.js`
(Scenarios › Results & admin); checked by `scripts/dev-test/check-site-community.js`.
- *The pattern stays:* facts are shared per season (`season_decisions`, one answer per fact), points are
  local (league rules), and `league_applied_decisions` applies, undoes and re-applies per league, gated by
  reveal. Wiki reads only for Quick check ("who went home"); full results come from the research prompt.
- *What changes in data:* `episode_research` keeps one row per submission (a couch's paste, an Autopilot
  run, Quick check) with who sent it, instead of replacing; a fact's status becomes Reported (1 source) ·
  Confirmed (2 independent sources agree) · Disputed · Canonical (admin, locked), replacing
  pending/accepted/rejected; `results_by` admin/leagues collapses into one mode (every league receives
  shared facts); new `fact_disputes` (who flagged what, why, note, link) and `league_rulings` (house rulings).
- *Unreviewed results don't carry over (user, 2026-10-24).* Results staged but never reviewed (Survivor 51 had
  88 pending) may be wrong, and the user won't review them: only decisions already accepted, as applied to the
  three active leagues, count. Converting statuses leaves pending ones out (they survive only in 0a's backup),
  never mapping them to Reported or showing them in stats. For the same reason Survivor 51's bot research runs only the schedule check (when the next episode airs and how
  long it runs), which stages no results.
- *Anyone fills in results* (couch setting "Who can fill them in": Anyone on the couch, default, or only
  people who run games). Players get a quiet "Full scores need one paste · Fill it in" after early results.
- *Disputes:* "Something wrong?" at the foot of every episode page and a flag on each episode of a
  castaway's story (who → which result or "something's missing" → why, note, optional link). Reported
  facts show "1 source" in stats. A dispute open a day triggers one tie-break run; only a split reaches admin.
- *Corrections* apply to every league on their own with a line in Episodes and a plate on the episode
  ("Episode 3 corrected · Brady's idol removed · you −4"). A commissioner may keep the old result as a
  **house ruling**: previewed, shown to their players on the episode, never leaking into shared stats;
  linked leagues rule together; any cross-couch leaderboard uses true facts.
- *The show changed, community-confirmed* (rulebooks phase 5): when research finds something the rulebook
  doesn't have, the episode page shows "Something the rulebook doesn't have" → It's new / Not new; a second
  couch agreeing adds it from that episode for every couch following the rulebook. Mock: `rulebook.js`.
- *Admin* (profile menu, admins only): **Inbox** (only disputes the community couldn't settle, reports,
  stranded couches; "Nothing needs you" plus a week's self-running numbers), **Find** (one search; every
  entity page has Override with its reach, a Lock and History with undo), **Settings** (research model and
  prompts, Quick check, Confirmed threshold, tie-break run, new-couch defaults, Autopilot trial, What's New).
  Today's `/admin` review queue, cast approval, format approval gate, schedules and per-season wiki and
  bot-research setup are retired at cutover.
- *Admin › Find › a rulebook* (rulebooks phases 4–6): the rulebook's page is the editor (the six blocks,
  card sheets, generated moments). Override per part as **Fix a mistake** or **The show changed from
  episode N**, with its reach (fan-out to leagues and rescore), a Lock, and History with undo. Research asks
  for blocks, Check for changes included.
- *Make it ours* (rulebooks phase 7), on 6a's Scoring rules: the couch's own copy. Choose what counts (turn
  moments off, or add one the couch answers); fixes still reach it; show changes ask first (add it or skip
  it); Follow it again any time. Points were always the couch's.

The largest step: plan on about three sessions (results and disputes; the admin and the rulebook editor;
Make it ours).

### Step 6c: how results get in

Decided 2026-10-24, mock `bot.js`. Per couch and show-season, three ways, all on bot.gameyourshow.com
(`docs/PLAN-bot-research.md`; "Ask ChatGPT for me" and the bot's schedule are built and experimental):
**Copy and paste** (free, always, anyone on the couch), **One tap** ("Ask ChatGPT for me", $1 a season, one
person unlocks it for the whole couch), **Autopilot** (the schedule, $5 a season, $4 after One tap; disabled,
"coming soon"). Who went home (the quick check) is always free, because it keeps a commissioner
spoiler-safe. Every price shows with a "Free during beta" label and nothing is charged. Setting up a show
with "Ask ChatGPT for me" is free (step 10).

## Steps 8–15: beyond parity

8. **Hub I.** 0d's two hub shapes on real data: the status line and Up next (needs-you first, else soonest
   airing, with a calm time), your shows (posters, flip), and More on the couch's six pages, each rebuilt
   bolder (`couchpages.js`): power rankings (a big place, by finishing position, normalised across game
   types), Commercial break (every game: playing, this week, start one), By the numbers (a stat-card deck,
   then every stat sorted; now and then a couch accolade), Previously on (one show at a time: a cold open,
   Last time as the vote-out card, the boot order as faces, Still in by group, episode by episode; a show
   without cast data gets the same frame with the recap as large type), the trophy shelf (only once a
   season has ended: titles, plaques, couch records). Couch verdicts wait for step 12. Mock: `index.html`
   (hub), `hubplus.js`, `fresh.js`, `refine.js`, `couchpages.js`.
9. **Couches, sign-up, first run, join, sign-in, solo.** Start / join / switch couches, invite codes, the
   landing → first run path (shows → where → save your shows → people), joining mid-season by ownership
   rules, sign-in. Google sign-in via Better Auth (needs a Google OAuth app the user creates; Apple needs a
   paid developer account, so later). **Solo** (someone with no couch; mock `solo.js`): the Games tab offers
   both a **public pool** per season ("Survivor 51 · Everyone": Survival Pool and predictions, usernames
   only, no chat) and a **practice couch** against computer players (Easy / Normal / Sharp, on
   `bot-logic.js`). Mock: `landing.js`, `round2.js`, `solo.js`.
10. **Watching, and Make it a game for every kind of show** (with rulebooks phase 8). **Add a show**:
    "Search or add a show", suggestions as you type, and an "Add '<name>' as a new show" block (first run's
    search uses it too). Follow a show (with where you are), watch privately, the show space for a show
    with no game (the same five tabs; Games offers Make it a game / Play it, and a series gets Call it and
    bingo), the both-watch nudge. **Make it a game**: the kind is inferred from the TV listing and
    ChatGPT's answer and shown on the review as one line with Change, never asked first; it leads with
    **"Ask ChatGPT for me", free** (setting up a show is on us), copy and paste behind it; the cast import
    exists. **Start a game offers only games that fit:** a competition gets Survival Pool, Weekly Lineup and
    Outlast; a series gets Weekly Lineup plus episode games; talk, variety or awards gets Weekly Bingo and
    Weekly Calls (played with step 12's bingo and Call it); a sport gets a draft of athletes (draft from the
    whole grid with shared ownership, start some each race; the show says "Race", not "Episode") and
    Survival Pool. Episode games work on every show. Behind it, phase 8's library of starting templates.
    Mock: `watching.js`, `rulebook.js`, `refine.js` (`addShowSheet`).
11. **TV guide.** The guide from `season_episodes` for the couch's shows plus all of TV from a listings
    source (recommended: TVmaze's free schedule API, cached in a `tv_listings` table by a daily job), faded
    with Add / Hide from guide (`guide_hidden`), drop days, planned watch-along nights. Mock: `tvguide.js`.
12. **Episode games.** Rate it and the couch verdict (`episode_ratings`), Call it at couch level, bingo
    (`bingo_cards`, `bingo_marks`), polls, trivia; Commercial break on real data. Weekly Bingo and Weekly
    Calls, the season games for talk shows, are built from these. Mock: `episode.js`, `index.html` sheets,
    `gamestab.js`.
13. **Watch along** (the one name for watching together: live now, planned with "Plan a watch along" and a
    quiet tag, or on your own time). Reactions pinned to runtime (`watch_reactions (season_id, episode,
    runtime_ms, user_id, kind, text, gif)`), shown 30s late, never early; GIFs (a provider key: Tenor or
    GIPHY); together sessions
    (`watch_sessions`, a shared clock and pause for everyone) over polling (every few seconds while open;
    no websockets needed at this group size); screen wake lock. Mock: `index.html` (`openWatch`),
    `watching.js`.
14. **Streaming shows.** Release model binge, drop day in the guide, the streaming rail, planned nights.
    Mock: `streaming.js`.
15. **Notifications and account settings.** Notifications by moment (push exists), spoiler-safe copy, the
    settings page, the Studio light theme, and **What your couch sees** (Account): Everything (default) ·
    Just my games · Only what games need, with a live "what riley sees" preview and Customize toggles;
    per-show Watch privately stays. Enforced in 0b's `shares()`. Mock: `settings.js`, `share.js`.

## Step C: cutover

- `ui='new'` for everyone; classic routes and components removed (the shell `auth-gate.tsx`, the league
  pages under `src/app/` that the new routes replaced, `league-strip`, `action-bar`, and so on: list them
  from the import graph, not memory).
- Contract migrations: drop `league_memberships.results_seen_through` (progress lives in `show_follows`),
  and anything else 0b's expand left behind. **They ship last, in a deploy of their own.** A deploy runs
  `db/migrate.js` before `next build`, while the previous deployment is still serving, so dropping a column
  the old code reads breaks production for those minutes. First the cutover deploy stops reading the old
  columns; once it's live and checked, a later deploy carries the drops, after a fresh 0a backup and a
  Neon branch.
- Rulebooks phase 9: retire `show_formats`, `league_rulesets`, `season_rule_changes` and their old screens
  and routes (archived into a backup table first), and `shows.format` reads. Same two-deploy order.
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
