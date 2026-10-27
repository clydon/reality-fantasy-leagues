# Plan: moving the app onto the new design

Status: **plan, 2026-10-23; updated 2026-10-24** with every mock decision since (the critique refinements,
the Games tab, how results get in, solo, sharing, privacy, and the kinds-of-show and rulebooks round). The
full-site mock (`.impeccable/mocks/site/`, live at `/mock`, decisions in memory `site-mock-decisions`) is
about 80% settled. This plan takes the real app onto it, piece by piece, without losing anything the one
live couch has played. It is the "second-pass drill-down" that `PLAN-couch-and-episode-night.md` asked
for; where the two disagree, this file and the mock win.

**How to use this file.** It's written to be read in parts. Every session reads **Status** (the table just
below), **The approach**, the **Rules for every session**, **Noticed, not fixed** (what earlier steps saw and left
for a later one), and then only its own step's section. Each step ends by updating its Status row, adding an
**As built** note under its section (what changed, what was decided on the way, what the next step should know)
and bringing Noticed, not fixed up to date. That's the continuity between sessions; nothing else needs re-reading.

## Status

| Step | What | State | Model / effort |
|---|---|---|---|
| 0a | Back up the live leagues | **done** 2026-10-24 (production backup restored and matched) | Opus · medium |
| 0b | Backend foundation (couch, progress, schedule, roles, guard) | **done** 2026-10-24 on the branch (rehearsed on production's data; before it ships: a fresh backup and a Neon branch run, see As built) | Opus · high |
| R1 | Rulebooks phase 1: schema, built-ins as blocks, How it works view model (logic only) | **done** 2026-10-24 on the branch | Opus · high |
| R2 | Rulebooks phase 2: the compiler, legacy freeze, engine relaxations | **done** 2026-10-24 on the branch (migration 0106 ships with 0b's) | Opus · high |
| R3 | Rulebooks phase 3: `rulebooks` tables, backfill, resolution behind a flag | **done** 2026-10-24 on the branch (migration 0107 ships with 0b's; the flag stays off) | Opus · high |
| 0c | The new shell, Preview system, fixtures, motion | **done** 2026-10-24 on the branch (migration 0108 ships with 0b's) | Opus · high |
| 0d | Hub and show space ported (fixtures behind Preview) | **done** 2026-10-24 on the branch (the hub, then the show space) | Opus · high |
| 1 | Show space on real leagues: Tonight's move cards, Games tab, How it works | **done** 2026-10-24 on the branch (no migration) | Opus · high |
| 2 | Episodes, staged results, the one reveal, share at the reveal | **done** 2026-10-24 on the branch (migration 0109 ships with 0b's) | Opus · high |
| 3 | Cast explorer and stats, server-side spoiler guard | **done** 2026-10-24 on the branch (no migration) | Opus · high |
| 4 | Chat, per couch and show, spoiler-folded | **done** 2026-10-24 on the branch (migration 0110 ships with 0b's) | Opus · medium |
| 5 | Backstage I: results (trusted results apply on their own), Recent changes, guards and undo | **done** 2026-10-25 on the branch (migration 0111 ships with 0b's) | Opus · high |
| 6a | Backstage II: Simple waivers, members and roles, game settings, Scoring rules (read side) | **done** 2026-10-25 on the branch (no migration) | Opus · high |
| 6b | Community results, disputes, house rulings, admin; rulebooks phases 4–7 | **done** 2026-10-25 on the branch, in three parts: results from everyone and disputes (migration 0112), the admin's desk and the rulebook editor (0113), Make it ours (0114); all ship with 0b's | Opus · high |
| 6c | How results get in: copy and paste, One tap, Autopilot (coming soon) | **done** 2026-10-25 on the branch, in two parts: how results get in (One tap, the ways, the bot's runs as sources, quick checks that wait; migration 0115) and settling without the admin (the tie-break run behind a desk switch that's off, "nobody went home", show changes the couches confirm, the desk's bot Settings; 0116); both ship with 0b's | Opus · xhigh |
| 7 | Draft room and blind draft | **done** 2026-10-25 on the branch (migration 0117 ships with 0b's) | Opus · xhigh |
| 8 | Hub I: focus-first hub, More on the couch and its six pages | **done** 2026-10-25 on the branch (migration 0118 ships with 0b's) | Opus · xhigh |
| 9 | Couches, sign-up, first run, join, sign-in, solo pools and the practice couch | **done** 2026-10-25 on the branch, in three parts: couches and joining their games (migration 0119), the way in (landing, first run, the invite signed out, sign-in, Google behind config; no migration), solo (public pools per season, the practice couch, the solo hub; migration 0120); 0119 and 0120 ship with 0b's | Opus · xhigh |
| 10 | Watching: Add a show, follow, where you are, Make it a game for every kind; rulebooks phase 8 | **done** 2026-10-26 on the branch, in three parts (part 2 split in two): watching (migration 0121; TV listings from TVmaze on demand), Make it a game to a set-up show with its rulebook and cast (0122), Start a game that fits and archive or delete a game (0123), rulebooks phase 8: the library, the desk's New show, Fits these games, Take it over and Looks right to us (0124); all ship with 0b's | Opus · xhigh |
| 11 | TV guide: schedules, all of TV, hide from guide, drops, planned nights | **done** 2026-10-26 on the branch, in three parts: the guide on the couch's shows and Hide from guide (migration 0125), all of TV in the guide and the daily listings job on the bot clock's calls (0126), planned nights (0127); all ship with 0b's | Opus · xhigh |
| 12 | Episode games: Rate it and verdicts, Call it, bingo, polls, trivia | **done** 2026-10-26 on the branch, in three parts: Rate it and couch verdicts (migration 0128), Call it, polls and Weekly Calls (0129), bingo, trivia and Weekly Bingo (0130); all ship with 0b's | Opus · xhigh |
| 13 | Watch along: pinned reactions, GIFs, together sessions | **done** 2026-10-26 on the branch, in three parts: watch along on your own time (reactions pinned to runtime, GIFs behind config; migration 0131), who's on now and the live airing (each open watch along's clock kept on the server; 0132), together sessions and planned nights (one clock for everyone in a planned night's watch along, Up next's planned night, a shared start's own time, bingo ticks and the two accolades; 0133); all ship with 0b's | Opus · xhigh |
| 14 | Streaming shows and the rail | **done** 2026-10-26 on the branch, in two parts: streaming on the couch (the release model, the rail, the show space; no migration), the fold by progress, first to finish and daily streaming off Also on (migration 0134, which ships with 0b's) | Opus · high |
| 15 | Notifications by moment, account settings, What your couch sees | **done** 2026-10-26 on the branch, in four parts: your settings and your profile (migration 0135), notifications by moment (0136), what your couch sees (0137), Studio and the rest (the light theme and Match phone, Earlier messages, Lock it down; 0138); all ship with 0b's. The Preview registry and `src/new/fixtures/` hold nothing. Then a polish before the merge (contrast, the quiet toast, Undo while locked down, a deleted chat anchor; no migration) | Opus · xhigh |
| — | **Merge, deploy and switch the couch to the new design** | after 15 (the user, 2026-10-25): backup, Neon rehearsal, merge, `ui='new'` for the couch | — |
| C | Cutover: new design for everyone, classic removed, cleanup; rulebooks phase 9 | not started | Opus · xhigh |

Steps 1–7 bring the new design to parity with what the couch plays today (done 2026-10-25). Steps 8–15 are new
features and can be reordered. **The user decided (2026-10-25) to finish steps 8–15 on the branch before anything
merges:** then one merge and deploy (with the backup and Neon rehearsal of every branch migration), then the couch
switches, then a week's watch, then C. Desktop layouts come after step 15 (until then the new
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
   replaces the Coming Soon! link). The couch keeps playing in classic until the branch ships after step 15 (the
   user's call, 2026-10-25: all of steps 8–15 first, then one merge), then flips.
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
- **Noticed, not fixed** (the list below): at the start, read it for anything your step touches and fix it if the
  step is the right place (or say why not); at the end, add anything you noticed and left alone, with the step
  that could take it, and take out what you fixed.
- **End**: update Status and your step's As built; recommend whether to start a fresh session and give a
  seed prompt with model and effort (memory: new-session-handoff).

## Noticed, not fixed

Behaviour a session saw and left alone because it wasn't that step's to change. Each says what happens, where, and
the step that could take it (a guess: any later step that touches it may). Fixed ones come out, with a line in that
step's As built.

- **The guide's Competitions (2026-10-27, tv-listings.ts competitionOf, migration 0147) is a guess from TVmaze's blurb**: about
  1 in 15 wrong (a makeover show that "crowns" the ugliest house), and a competition whose blurb never says so is missed (Love Is
  Blind, Fear Factor). Exact would be asking once per new reality show (our bot, "Is X a competition?", kept per listing), or a
  "Not a competition / Is one" on a listing's sheet that two people settle, as results are. A show set up here is already exact.
- **Checks that share new-fixture.js can't run at once (2026-10-27)**: check-bingo-bank.js and the check-new-* checks all bring
  up and take down the same zt_nd_ people, so two at a time sign each other out and delete each other's seasons mid-run (seen as
  "Not logged in", or the bot clock planning nothing). Run them one at a time; a lock file in new-fixture.js `up` would make it
  say so.
- **check-new-listings' "nothing asked of the listings" step (2026-10-27) can catch show art's lookup**: adding ZT Old Listing
  finds its art after the answer (show-art.ts, `/shows/:id?embed=seasons`), which can land in the step's 2-second window after
  the bot clock's call. The step could ignore `/shows/` lookups, or wait for the art first.
- **Show words (2026-10-27, lib/game/show-words.ts, migration 0142) reach the show's tabs and the screens of a show you watch**:
  the show bar, Tonight's head, the spoiler chip, Episodes (Schedule), the Cast tab's empty state, Where you are, Seen it, the
  hub's Up next. Still "Episode" (about 130 more): the game screens (the moves dock, Your moves, reveal, Backstage, waivers,
  bingo, calls, rate, remind, watch along, something wrong), couch pages, the guide, the desk, and notifications and pushes.
  Any step on those can take them by reading `show.words`. Also: a season numbered by year shows "S2026" in the show bar's
  title ("2026" would read better), and the desk has no field for the episode word yet (an admin can't correct "Event").
- **Bot-powered sports stats are paused (2026-10-27, the user's call; `BOT_STATS` in rosters.ts)** and Fill in who's playing asks for
  players only. Sports data moves to APIs first, ChatGPT last: docs/PLAN-sports-data.md has the research and the steps. What follows in
  the next entry about stats asks is moot until that plan's step 4.
- **Players' photos and stats (2026-10-27, rosters.ts, show-art.ts, migration 0145) left these alone.** (1) Stats come only when
  someone taps (Fill in / Update stats) or straight after a roster's filled in; nothing updates them by itself when a game ends (the
  bot clock could, a few hours after each episode, as recaps could). (2) A big roster takes several bot asks (batches of 25, two parts,
  one retry for misses): ~5-9 minutes for a World Series on our bot, over two or three taps of Update stats. (3) ChatGPT's numbers
  aren't checked against anything; a wrong line can be fixed only by asking again (nothing edits one by hand yet). (4) The F1
  shortcut in show-art.ts (Jolpica's field) is the one sport-specific path left; search by team now works for everyone, so it could go.
  (5) Stats only on a sport's roster; a reality show nobody's made a game of still has no stats until research.
- **Fill in who's playing (2026-10-27, rosters.ts, migration 0144) left these alone.** (1) Sports only: a show that isn't a sport
  still gets its cast from Make it a game (or its listing, for a series or talk show); the same one-question fill could offer
  a not-yet-a-game competition's cast too. (2) No photos: the photo finder (show-art.ts) looks in TMDB and TVmaze credits, which for a
  sport are the broadcasters; a free source of player photos would be its own step. (3) A roster is filled once; a mid-season trade or
  call-up isn't picked up (a "Refresh who's playing" could ask again and add who's new). (4) The stats read (season-stats.ts) still
  says castaways and tribe for a show nobody's set up, from shows.format defaulting to survivor; it isn't shown on a sport's roster,
  but anything that reads it for an unset show says the wrong words. (5) check-show-words.js once logged React's "state update on a
  component that hasn't mounted yet" (1 run in 8, not reproduced since); it now prints the screen a console error happens on.
- **Fill in what happened (2026-10-27, episode-recaps.ts, migration 0143) left these alone.** (1) It's a tap: nothing fills in a new
  episode by itself when it airs; a bot clock run a few hours after each episode of a followed, unresearched show could (the
  schedule's pattern, db/bot-research.js). (2) Recaps show on a show you only watch (Episodes' aired rows); a show you play has
  research, and its episode page doesn't show a recap. (3) A sport's players still have no source (the Players tab says so); Make
  it a game's cast question is the only way in. (4) Recaps feed nothing else yet (stats, trivia, the guide).
- **"All set" beyond the hub's Up next** (2026-10-27: Up next's All set plate came out, the user's call: a line that asks nothing
  of you is noise, and it showed on a show with no game too). Two cousins stay, both with something to tap: Tonight's Your moves
  card "You're set for Episode N" (show/tonight.tsx YourMoves, with Change) and the moves dock "All set for Episode N" (show/dock.tsx,
  with Edit). If the user wants those quieter too, the dock could drop to a plain Edit and Your moves could go when nothing's open;
  the next step on a show's Tonight could take it.
- **Keeping up (2026-10-27, keep-up.ts, migration 0141) left these alone.** (1) Live's "Seen it?" is only on the show's Tonight: no
  push and no hub card when an episode ends; a push ("Episode 4 is over. Seen it?") through push-core.js, keyed once per person
  per episode, is the natural next piece, with a hub row for it. (2) Adding a show where nothing has aired skips the where step
  (watching/sheets.tsx pickSeason), so Live can't be picked while adding it; the where sheet offers it afterwards. (3) First
  run's and an invite's steppers (welcome/first-run.tsx, invite.tsx) don't show each step's episode and date yet, nor I'm up
  to date. (4) Live and Move along by itself are off on a season you play (your games' reveals move it), so making a game on
  a show you keep up live with quietly ends Live there; the where sheet says the reveals move it. (5) The stepper's titles follow
  titledFor except a sport's (its titles are the matchups); a sport whose listing titles give a result away would show it.
  Any later step on the hub, notifications or first run could take (1) to (3).
- **check-new-episode-games fails its talk-show part late in the evening** (seen 2026-10-26 at 9:30 PM EDT, with or without
  the reminder ask's changes, `--api` too): "the talk show's Episode 4: both calls wait for the couch to say" gets no verdicts, then
  a TypeError at `personIn`. The part moves the talk show by whole days, so it reads as a date-in-UTC-versus-local slip (after 8 PM
  Eastern it's tomorrow in UTC). The check or `talk-fixture.js` could take it; run it in the daytime meanwhile.
- **Traitors 5's cast stores the faction as its tribe** (step 3; the tool is 6b part 2's, doing it is the user's call). Its
  `season_cast.tribe_name` is "Traitor" for the two original Traitors and "Faithful" for everyone else, and the one league on
  that season in the local copy (production's, 2026-10-16) has tribes named Traitor and Faithful, so classic's boards and
  anything showing that league's tribes tell who the Traitors are. The stats ignore a group named for a role (cast-stats.ts).
  The desk's season page now says so and has Not a group for each (off the cast and out of the league, undoable); left
  alone on the local copy and production until the user does it there.
- **The league views still show role-revealing results** (step 3; for 6b or whichever step next touches a Traitors league).
  Steps 1–2's views read a league as it holds its results: a still-in Traitor's "As a Traitor, voted out a fellow Traitor"
  lifts their points on an episode's top scorers (`episode-view.ts scorersIn`) and names itself in a Weekly Lineup reveal's
  "why". `cast-stats.ts secretEvents` says which results give a role away, so those views could leave them out the same way.
- **A seat named before keeps its name** (step 15 part 1; for the merge-and-switch step or C). Saving your name in Settings renames your
  seat in every league you play, so one name wins from then on; a seat whose name differs from its account's username today (one in
  production's copy, every one in new-fixture.js: "alex" for zt_nd_alex) keeps it until its person saves their name. A one-off at the switch
  could run `profile.ts renameSeats` for everyone whose seat differs.
- **Stored lines keep the old name** (step 15 part 1; for a later polish). A new name reaches everything read by account and re-signs your
  messages, but lines written once as text keep the name they were written with: a chat reveal line ("riley revealed episode 4") and Recent
  changes' texts ("Made zt_nd_jordan a Game admin").
- **No email can be added or changed** (step 15 part 1; for C or a later step). Your account shows your email, but a username-only account
  can't add one (for resetting a password) and nobody can change theirs: Better Auth's update refuses an email, and changing one needs a
  verification flow (`changeEmail` and its emailed link) the new design doesn't have. Link Google is the other way in.
- **Classic's profile renames nothing** (step 15 part 1; for C). Classic's Account settings still edits a Display name and Username
  separately, and saving there doesn't rename seats or re-sign messages (only the new design's profile does). Classic retires at C.
- **No tour in the new design** (step 15 part 1; for C or a later step). The mock's Help has Take the tour again ("5 minutes on a practice
  season"); classic's guided tour is classic's, so Settings has How each game works and Report a problem only. The practice couch (step 9
  part 3) is the nearest thing.
- **Classic's research isn't a source** (step 6b part 1; for C). Backstage's answers, a player's Fill it in, One tap and
  (since 6c) the bot's scheduled runs are submissions that settle facts for every couch; classic's commissioner research
  panel, the admin's research and paste in Admin › Shows, and the wiki still stage pending results the old way, so they're
  never a source and never apply on their own. The desk's decisions are canonical (part 2), as classic's accept and reject
  are; classic's research screens retire at cutover.
- **The tie-break run is off** (step 6c part 2; the user's call). Built behind the desk's Settings switch, off by default:
  switched on, it reaches every season with shared results, Survivor 51 included (whose bot otherwise runs only the
  schedule check). Until it's on, a flag waits for someone to Check it again, and a flag nothing checked for a day, and any
  split, reaches the admin's Inbox.
- **One person, one source** (step 6b part 1; for a later step). Sources are counted by person, so two accounts on one couch
  pasting the same wrong answer confirm it for every couch. House rulings take away a couch's reason to, the admin can
  decide it (part 2), and Settings' Confirmed needs can ask for 3 or 4; counting couches instead of people is still open.
- **A confirmed show change is the bot's reading of a note** (step 6c part 2; for 10 or later). When couches agree an episode
  brought something new, our bot turns research's one-sentence note into rulebook items, and only its additions go in, from
  that episode, for every couch following the rulebook (Undo is the desk's; Lock holds it back). Its wording and points are
  the bot's guess until the desk edits them; a split goes to the desk rather than to a tie-break check (the mock's).
  Research's note comes from any full answer (a paste, One tap, the bot's runs); classic's research panel and Admin pastes
  only reach the combined row, which the card doesn't read.
- **Points are for the whole season** (step 6b part 3; for step 10 or later). The mock's Scoring rules saves points "From
  Episode 6" or "Rescore the season"; the engine keeps one number per moment (`settings.eventPoints`, read by ~20 places,
  classic's screens among them, none with the episode to hand), so a change always scores the season again. Points by
  episode would need that history. Its Casual / Standard / Competitive presets aren't built either.
- **The rulebooks flag's off-walk takes copies out too** (step 6b part 3; for C). `scripts/rulebooks-flag.js off` tells every
  league `on: false`, so a couch's own copy stops playing until its next change re-syncs it. Fine for an emergency switch;
  at cutover the flag goes and so does the walk.
- **The desk's Settings is still short** (step 6b part 2, 6c part 2; for C). The tie-break switch and Autopilot's trial (each
  season's bot schedule) are there now; the research model and prompts and What's New aren't (not small: classic's `/admin`
  still has them until cutover), nor a season's episode length (classic's Setup). A person's page only looks (no reset,
  remove or make admin) for the same reason.
- **Undo leaves what another answer also says** (step 6b part 1; for a later polish). Taking your answer back keeps any
  result another source still reports (it's still a source's word), but the toast says only "Undone"; it could say "3
  results still stand: another answer reports them".
- **"Nobody went home" never applies on its own** (step 6c part 2; for a later polish). A quick check that says nobody left
  always waits for It's right, however many sources it has (a check run too early can find nothing and say so); entered by
  hand, or in a full answer, it applies like any result. Two couches' quick checks saying nobody could confirm it instead.
- **Not in Recent changes yet** (step 5; for 9 and 6b). Logged: every classic results route, settings, roles, players,
  the cast and tribes, waivers (process, undo, window), the catch-up reveal, lineup locks, the draft's start, order,
  settings and take-back, a draft pick or lock-in made for someone and a waiver claim sent for someone (step 7), the
  finale's results, prediction questions, rule changes, scoring rules, renaming, linking and moves made for someone else.
  Since step 9 every join made in the new design is logged (and a let-in); not yet: classic's join by code and its late-join start (for C), the hourly waiver job's own
  processing (a run it made is still taken back from Backstage › Waivers' Last run, which logs that) and a super-admin's
  membership edits in classic's `/admin` (the desk's Hand it on is logged). Classic's screens don't show the log (only the new design does) and its own Undo buttons don't
  mark lines undone.
- **Backstage's setup jobs** (step 5; the draft's since 7, inviting since 9; for C). Needs you has results jobs, "Schedule the
  Outlast draft" (step 7), "Invite people to <game>" and join requests (step 9); classic's other commissioner items (Add the
  cast, a catch-up league's next reveal: `commissioner-items.ts`, the home's `backstage`) link to classic pages. Since step 10
  part 2a a show made a game gets its season's cast with it, so Add the cast only comes up for a season with none (a set-up
  show's later season, which since part 3 plays by last season's rulebook); a catch-up league's next reveal is classic's
  RevealLogic catch-up mode (for C).
- **No "Extend a day"** (step 6a; for 6b or later). The mock's Backstage › Waivers has it; the engine has no way to move a
  week's deadline (a window's `processAt` is worked out from the schedule). Small: an override on the period.
- **No quick-check switch for a couch** (step 6c part 1; for when Autopilot ships, the user's call; 6c part 2 left it). The mock's
  Quick check card has a switch ("Our bot checks who went home about 5 minutes after the episode, and keeps checking until
  it's sure. Always free."). The bot's schedule is per season and an admin's (Survivor 51 runs only the schedule check, the
  user's decision), so a couch switching it on would add runs for every couch on the season; not built. Backstage says
  "Autopilot · On for this season" when an admin's schedule has a quick or full run.
- **One tap's answers may not be independent** (step 6c part 1; for the bot, the user's call). Two couches tapping One tap for
  one episode are two sources (counted by who tapped, like two pastes), but the bot's one signed-out ChatGPT profile
  carries earlier chats (memory ask-ai-bot's context leak), so its second answer may lean on its first. Temporary chats per
  request in llm-browser-api's server.py would fix it; it's a change on the VM. The full answer's episode check
  (`pasteEpisodeMismatch`) fails a One tap answer about another episode; a quick answer has no such check (its names must
  be someone still in, and it needs two sources to apply on its own).
- **Nobody can undo the bot's own answer** (step 6c part 1; for C or a later desk step; 6c part 2 left it). An Autopilot answer has no
  couch, so no couch gets its line or its Undo (like another couch's answer); a wrong one is flagged ("Something wrong?") and
  settled by the next answer, or decided on the desk. The desk could offer "withdraw this answer" on a result's page.
- **The pick timer needs someone in the room** (step 7, as designed). There's no job: when a turn's time runs out, a phone with
  the draft room open asks the server, which checks the clock and picks from their queue if the game says so. With nobody in
  the room, the pick waits until someone opens it (whoever's on the clock is pushed when their turn starts, and can be
  nudged). A turn with no timer reads as "hasn't picked yet" after 3 minutes, when Nudge and Pick for them come up.
- **The draft's points are the game's** (step 7; for a later polish). A draft after episodes have scored (a late league) shows
  each castaway's points as this game counts them (`castOf`), where the Cast tab and waivers count the season's facts.
  Drafts before the premiere (every one so far) show tribes instead. Since step 9 part 3 a practice couch started
  mid-season is such a draft: an Outlast practice shows every castaway still in at the same "7 pts so far" (the boot order
  before the game's own start), which says nothing; the season's facts, or nothing before `startEpisode`, would.
- **No "Biggest comeback" record** (step 8; for a later polish). The mock's trophy shelf has it ("8th to 1st · Traitors
  4"); it needs each finished game's standings episode by episode (a table per episode, read once a season ends and kept),
  which nothing keeps. The records are most titles, ran it back, longest pool streak and best average finish.
- **Couch accolades are what today's data can say** (step 8; ratings' since step 12 part 1, the watch along's since step 13 part 3, first to
  finish since 14 part 2; for a later polish). The mock's By the numbers also has Called it most from calls (since step 12 part 2:
  `calls.ts callRights` per season, as the profile's "Called it" still counts only league predictions). `couch-standings.ts accoladesOf` is
  where it'd go (the ratings' are `ratings.ts ratingAccolades`: taste twins, the contrarian, never misses a rating; most reactions, most watch
  alongs and first to finish are `accoladesOf`'s).
- **A rating can't be taken back** (step 12 part 1; for a later polish). Rating an episode again changes your stars, and a take can
  be removed, but nothing removes the rating itself (`episode_ratings` has no delete). A "Clear my rating" on the sheet would be
  one DELETE.
- **A talk show's calls are only the couch's say** (step 12 part 2; part 3 added bingo; for a later step). A talk show's moments
  ("The host sings") have no results, so its calls and bingo squares wait for two on the couch to say what happened (alone on the
  show, your own say); since part 3 a bingo tick from someone who's seen the episode is a say. Research still answers them the next
  morning (the rulebook compiles them as episode questions, KINDS.talk's "ChatGPT checks the next morning"), but nothing reads those
  answers.
- **An episode's moment call follows the rulebook as it is** (step 12 part 2; for a later polish). Which moment an episode asks
  about is worked out from the season's rulebook each time it's read, so a rulebook edit while calls are open (a desk fix, a show
  change) can swap an open episode's moment: calls made on the old one are kept and still count (they're stored by their moment),
  but the sheet no longer shows them. Keeping each episode's questions once its first call is made would hold them still.
- **A tick only ever says yes** (step 12 part 3; for a later polish). On a talk show a bingo square settles when two on the couch
  tick it or say so (alone on the show, your own tick); nothing says a moment didn't happen except the two Call it moments' "It
  didn't", so a square that didn't happen stays "still settling" (its lines never count, rightly), and one only you noticed waits for
  someone else on the couch who follows the show, even one not playing Weekly Bingo. A seen card's unticked squares could count as
  "didn't happen" after a day, or the card could offer "It didn't" on a square.
- **Trivia's answers ride with its questions** (step 12 part 3; for a later polish). A round is graded on the server, but its answers
  reach the phone with the questions so the sheet can show right and wrong at once; someone reading them in the browser's tools
  would win the week. Checking each answer as it's tapped (a request each) would keep them on the server.
- **Your trivia reads a dozen seasons' facts** (step 12 part 3; for a later polish or paid hosting). `/api/me/trivia` (Commercial
  break, the solo hub's On your own, kept 60 s) works out the round on up to six of your shows until three have one, each from the
  stats facts of up to two seasons (HOSTING.md). A round kept per person, show and week (it's the same all week unless your marks
  move) would make it one read.
- **Predictions guess their chips from their words** (step 12 part 2; for C). A prediction has no options of its own (classic's
  propose has none), so "Who …?" gets the cast still in and "Will …?" Yes / No (`game-view.ts predictionKind`); "Which tribe wins?"
  or a question about someone already out gets words. A propose flow in the new design could let its proposer choose.
- **The sheet's taste twin comes from the hub** (step 12 part 1; for a later polish). "You agree with the couch · taste twin:
  riley" names the twin only when the couch's hub was read in this visit (it reads the cached `/api/couches/[id]/hub`); opened
  straight from a show, the sheet says "You agree with the couch".
- **Classic's join code still makes a hidden ghost** (step 9; for C). Joining with a game's own code in classic makes a late
  joiner the game can't see until its commissioner adds them, whatever its Who can join says (only Nobody new closes it,
  through classic's switch, kept in step). The new design's joins are seen at once; such a ghost stays out of the couch chat.
- **An episode page can't open from a link** (step 8; for a later polish). Previously on's rows and Last time open the show's
  Episodes tab, a tap short of the episode: an episode page is a pushed page opened by a tap on Episodes, not from its URL
  (`?page=ep4` alone doesn't render it). Letting the page read its episode from the URL would let the hub, the feed and
  pushes go straight there.
- **Fewer starters trims lineups** (step 6a). Lowering Who scores each week keeps the first starters of a lineup already set
  for the next episode; Undo puts the number back, not the trimmed starters (the lineup then reads "not set", so it's asked
  for again).
- **Letting someone in is still classic's** (step 9 part 2; for C or a desk step). With Who gets in at You let each one in, a
  waiting account is approved from classic's Admin › Users; the desk only counts them ("1 waiting"). An Inbox row with Let in
  would do it in the new design.
- **An emailed link opened on another phone loses first run's picks** (step 9 part 2; for a later polish). The shows picked
  before the account wait on the phone that picked them until the account signs in there; opening the confirmation link in
  another browser (a mail app's own, say) signs in without them, and they're added later from Add a show (step 10). Holding
  them on the server against the new account (a short-lived row keyed by the sign-up) would carry them anywhere.
- **The reset link opens classic's page** (step 9 part 2; for C). Forgot password's email links to classic's
  `/reset-password`, which then offers classic's sign-in; C gives it a new-design screen.
- **A public pool is one league's state** (step 9 part 3; for growth, the user's call on paid hosting). Every player's picks
  and calls sit in one row, read whole by anyone's next read after any pick (~2 KB a player), so a pool stops at 100
  ("The pool is full"; HOSTING.md). Past that, picks and calls in a table of their own (a row per person and episode) and
  the board as a SQL read of the top ten and you; or a second pool for the season.
- **Solo games are for competitions** (step 9 part 3; since 10 part 2b any set-up competition, a player-made one too; for a later
  step). A series, talk show or sport gets no public pool or practice couch ("Solo games come to this kind of show later"): a
  sport's pool would survive by scoring (`poolSurvive 'scores'`, as a couch's does) and its practice couch would draft the field
  shared, but the bots (`bot-logic.js`) and the pool's Who goes home? call assume someone leaves each episode.
- **Only solo players are offered them** (step 9 part 3, the mock's; for a later step). The pool's card and the practice
  couch's are on the solo hub and on a show's Games tab when you're solo (`show.solo`: no couch, or a couch of one).
  Someone on a couch can't find them (the API would let them), though a pool or practice couch they joined while solo
  stays with their games on that show. Commercial break or the Games tab could offer the pool to everyone. **Since
  2026-10-27 the practice couch is offered to everyone** (the Games tab's Practice block, `solo.tsx CouchPractice`), and any
  couch game can have computer players (Start a game, Backstage › Members: `computer-players.ts`; HANDOFF has it); the pool
  is still solo-only.
- **A practice couch is in classic's list** (step 9 part 3; for C). Classic's league menu shows it as an ordinary league with
  computer players (classic plays bots), where it works, though it says nothing about being practice; the public pool is
  left out of classic's list. C removes the list.
- **A show added by name has no schedule until it airs in the US listings** (step 10 part 1; since 11 part 2 the daily job links it;
  for a desk step). A show the listings don't have is a name and an empty first season: no episodes or air times, so where you are
  can't be set and nothing's "up next". The daily listings job links it once the next eight days' schedule has one show of that
  name (its empty season then takes the listing's); one that never turns up there (a show abroad, a streaming show under another
  name) stays a name until the desk can fill it in or link it (Find › the show has no tool for either yet).
- **The review can't be edited** (step 10 part 2a; part 3 left it; for a later step). Make it a game's review changes only the
  kind; a wrong part, way out or points needs the desk's rulebook editor after it's set up (Fix a mistake) or a couch's Make it
  ours. The desk's New show lands on that editor straight after Looks right (part 3); a player's review could offer the
  editor's parts to its maker before Looks right (the mock has none either).
- **Every made show's phases wait for the desk** (step 10 part 3; for a later desk step). A rulebook from Make it a game whose
  phases start "when the show says so" (a Below Deck-like answer has two) puts a "when did X start?" in the Inbox for each,
  once its season is airing: every show players make adds Inbox rows, and the phase's segments wait meanwhile. The couches
  could confirm a phase start as they confirm a show change (step 6c part 2), leaving only a split for the desk.
- **A reality series from its listing gets no skeleton** (step 10 part 3, as part 2a chose; for a later step). The listings call
  every reality show "Reality", which Make it a game guesses is a competition, so templateFor's by-kind series template (the
  newest the desk saved, else Below Deck's) only reaches a show the listings call Documentary or Scripted, or one of a
  template's family by name (ZT Yacht Life Riviera from ZT Yacht Life). Asking ChatGPT the kind first, or a second ask once
  its answer says "series", would give a reality series its skeleton.
- **The stored format doesn't follow the rulebook** (step 10 part 2a; for C). A made show's rules are also its `show_formats` row
  (so classic's paths read them), written once at Looks right. The season plays by its rulebook (`rulebook_live`), whose later
  edits (a show change, a desk fix) don't reach that row; only something reading the show's format the old way would see the
  first version. C retires `show_formats` (rulebooks phase 9).
- **Anyone can start someone else's attempt over** (step 10 part 2a; for a later polish). One attempt per season is shared, so
  whoever opens it can Change the kind, paste over it or Start over while it's open (not while our bot asks), and Looks right
  is anyone's too. Low stakes (it's only a draft until set up, and five a day each), but the starter could be the only one to
  start it over for a day.
- **A made season's cast is the desk's** (step 10 part 2a; for a later step). It's approved and finished at Looks right
  (`cast_locked_at`), so someone missing from ChatGPT's or the listing's cast is added by the desk (Find › the season), not a
  commissioner; a photo ChatGPT couldn't find is a letter. A "someone's missing" flag like Something wrong? would reach the desk.
- **A sport says Episode outside Start a game** (step 10 part 2b; for part 3 or a later polish). The rulebook's `parts` ("race",
  "game") reaches Start a game's sheet, its lines and its push; the show space still says Episode everywhere else (the Episodes
  tab, Tonight, the dock, the reveal: the mock's rbVocab renames them all). The season header could carry the rulebook's part
  word for the shell's tab label and the screens' "Episode N".
- **Classic doesn't know a game is archived** (step 10 part 2b; for C). Classic's league list still shows an archived game as
  playing and its commissioner screens still take results by hand into it (the league routes don't read `settings.archivedAt`);
  the season sync, moves, waivers and reminders do skip it. A deleted game is out of classic's list (its memberships are in
  the restore line), though its old URL still reads for a site admin.
- **A deleted game's chat stays where it moved** (step 10 part 2b; for a later polish). Deleting moves what was said in the game
  to the couch's next game on the season (or the couch's own conversation), so nobody loses it; restoring the game doesn't move
  it back (the couch reads one conversation either way; classic's chat for the restored game starts empty).
- **A new game on a season whose results live only in leagues** (step 10 part 2b; for C). A game started mid-season gets the
  season's shared results (an admin's accepted ones on an `admin` season, sourced ones on a `leagues` season) as history, so on
  a `leagues` season whose earlier results were entered in each league by classic's research (none on the local copy: Survivor
  51 and Traitors 5 are `admin`), its cast would show people already out as still in. The check sets its fixture season to
  `admin`, as production's live seasons are.
- **One night per couch and episode** (step 11 part 3; for a later polish). Two people wanting different nights for the same episode can't
  both plan it (one going per couch and episode): the second sees the first and says I'm in. (Since step 13 part 3 a shared start can be
  any day and time, so the one night can be the one that suits.)
- **Watching together needs a planned night** (step 13 part 3; for a later polish). There's no "watch together" from someone on now: their
  mark on your bar and Catch up put you in step once, but each of you keeps your own clock. Planning a shared start a few minutes from now
  (Another time) is the way to one clock today; On now or the near line could offer "Watch together" (a night planned there and then, with
  them invited).
- **Everyone in a together session can move it** (step 13 part 3, as the mock has it: "anyone can pause for everyone"). Nothing stops one
  person tapping +10s or Set the time for all; whoever did it is named on the plate under the clock. A night's planner keeping the clock
  would be a setting nothing reads yet.
- **Call it skips a streaming season after its drop** (step 14 part 1; for a later polish). Call it asks about the next episode to air
  and closes at its airtime; once every episode is out there's nothing to air, so a streaming season gets no calls (the mock's "Call it
  before Episode 4"). A call that closes at each person's own mark (before you watch it) would bring it back, graded as now.
- **The fold by progress trusts the mark** (step 14 part 2; for a later polish). On a season watched at your own pace a message folds by how
  far its author had marked when they wrote (or the episode they had open in a watch along in the last three hours), so someone who watches
  Episode 5 on the service without the app and talks about it before marking it seen writes "at 4", and it shows to someone else on 4. The
  composer could ask "You're on Episode 4: seen 5?" when someone on a drop posts, or a message could carry the episode it's about. Someone
  who sees results straight away (on a season they play) writes with no mark, so their messages fold by airtime there.
- **First to finish starts with 0134** (step 14 part 2; as designed). `show_follows.finished_at` is kept from now on, so someone who reached
  a season's end before has no time and isn't counted (nothing backfills it: on production no one follows a streaming season yet; they
  come with step 10's Add a show). Where you are is your word: setting it to the last episode counts as finishing.
- **The desk can't make a season a streaming drop** (step 14 part 1; for a later desk step). Only a listing makes a season `binge`
  (listing.ts `releaseOf`: three or more regular episodes on one day); a season the desk makes, or a show added by name, is weekly, and
  the desk's season page has no release or drop time to set.
- **Where you are says "Premieres" before a drop** (step 14 part 1; for a later polish). The where sheet's line for a streaming season
  still to drop is way-in.ts `whereLabel`'s "Premieres Oct 29", not "All 8 drop Thu 9:00 PM" (the mock's quickAdd).
- **A drop never takes Up next** (step 14 part 1, as the mock's heroPick; for a later polish if the couch wants it). Even on its night a
  streaming drop leaves Up next to weekly shows (only a move or results it needs of you put it there); the guide's drop card, the rail's
  "Drops Thu 9:00 PM" and the show's drop plate carry it. Up next could take a drop due within the day.
- **Network times are the East's** (step 11 part 2; for a later polish). TVmaze's US schedule gives a network show's Eastern airing,
  and Also on shows that moment in the phone's zone, so on the West Coast an 8 PM network show reads 5 PM, though most networks
  air it at 8 PM Pacific on tape delay (a live event doesn't). Shows here are right (a season's air time is in its own zone);
  only the listings are Eastern, and TVmaze has no Pacific schedule. A rule by network type (broadcast tape-delayed, cable and
  sports live) would get most of it.
- **"The most watched" is TVmaze's popularity** (step 11 part 2, as designed). Also on's few are the evening's highest TVmaze
  `weight` (how many people follow a show there, worldwide), not ratings; nothing better is free.
- **The job's changes aren't in the desk's History** (step 11 part 2; for a later desk step). A season the listings job makes (a
  listed show's next season), a season it reads again and a show it links by name aren't logged anywhere a person sees: the desk's
  show page shows the result, not when it happened or why. Nor can the desk unlink a show linked to the wrong listing (Add a
  show's linking by name has the same gap); the job only links when one listing of that name and country airs that week.
- **No backstop if the VM stops calling** (step 11 part 2; the user's call). The listings job runs only on the bot clock's calls;
  with the VM down, Also on empties within the week and listing seasons stop moving on. A Vercel daily cron on
  `/api/cron/listings?run=1` is one file (`vercel.json`), about 0.6 CU-hours a month: written up in HOSTING.md, not set up.
- **A watch along's clock is the watcher's word** (step 13 part 1, as designed). The couch's reactions are held 30 s behind the moment
  the phone says its clock is at, and never past what has aired since airtime; End, +10s or Set the time move it on, and the server
  sends what was said up to there, as where you are on Episodes is yours to say. Nothing past your next episode leaves the server.
  Since part 2 the same goes for who's on now: "40s ahead" is two phones' word, and Catch up moves yours to theirs. Since part 3 a
  together session's clock is everyone's in it, and what they say there comes through it without the 30 s: one person's word for all.
- **Joining the live airing from airtime is a guess** (step 13 part 2; for a later polish). With nobody on the couch watching it live,
  Join the live airing starts the clock 70% of the way from airtime (`LIVE_SHOW_SHARE`: US TV runs 13 to 18 minutes of ads an hour),
  behind the show for most, so the couch's reactions come late rather than early; a show with fewer ads (premium cable, a live final)
  starts further behind, until +10s or Set the time. A share per network or show, or the first on the couch to tap Live on TV at
  airtime setting it for the rest (they already do once they're on: Join follows them), would get closer.
- **A watch along behind another app drops out** (step 13 part 2, as designed). Its heartbeat comes only from an open, visible watch
  along (nothing polls from a hidden tab), so someone streaming on the same phone, the watch along behind the player, leaves who's on
  now 45 s later and comes back when they return to it; a paused one stops saying it's open after ten minutes. The screen-on lock is
  there to keep it in front.
- **The desk's castaway Override is sometimes not in every league when the check reads it** (seen in step 13 part 2; for a desk step or
  a later polish). `check-new-desk.js`'s "every league renames him (no one added)" failed in two runs of four on 2026-10-26 and passed
  in the others, with nothing of the desk's changed. `overrideCastaway` awaits `applyApprovedCastToLeagues` before it answers, so the
  likelier cause is another write to the same league state racing it (a read that tidies a league and saves it back outside
  `withLeagueLock`, from a page the check has open); worth a look at whatever writes `leagues.state` without the lock. Missed twice in a
  row on 2026-10-26 (step 15 part 1's batch, then alone), then passed; since then a miss prints each zt league's Erics (and whether each
  is linked to the season's cast), which should say which league and why.
- **Two phones, one session** (step 13 part 2; for a later polish). Your own watch along of an episode on a couch is one session, so
  the same person with it open on two phones has one clock on the server, whichever wrote last; the couch sees one of them. In a together
  session (part 3) you're one person in it either way: closing it on one phone leaves it, so the other stops hearing it and its next tap
  says to open it again.
- **What you said is taken back only from the stream** (step 13 part 1; for a later polish). The × is on your own lines while they're
  among the six shown; once they've scrolled away, or you've closed it, nothing lists what you said on an episode.
- **The watch along's length is the slot's** (step 13 part 1; for a later polish). The bar and the automatic End come from the
  schedule's episode length (Survivor 51's 90 minutes, ads included), so streaming without ads the bar never fills and End is yours to
  tap. A show's running time without ads isn't kept anywhere.
- **Nobody can hide a reaction** (step 13 part 1; for a later step). Comments and GIFs (GIPHY's PG-13 at most) reach the couch as
  said; there's no report or hide, as in chat, beyond taking back your own.
- **Answers to a plan push nobody** (step 11 part 3; step 15 part 2 left it; for a later polish). Whoever planned a watch along sees
  I'm in and Can't make it on its plate, not in a notification (a push for every answer would be noise); a summary the morning of the
  night could say who's in.
- **Classic's league invites can't be answered in the new design** (step 15 part 2; for C). Inviting someone by name to a game (classic's
  commissioner screens) is answered on classic's Dashboard; its push now opens the hub for someone on the new design, which has nowhere to
  accept it. The new design's way in is a couch code; C retires classic's invites or gives them a row in Needs you.
- **Quiet on episode nights is quiet until you catch up** (step 15 part 2, the mock's "Catch up when you reveal"; for a later polish).
  Quiet means a message folded for you isn't pushed, and the fold is the chat's (chat-fold.ts): someone several episodes behind on a show
  gets no chat pushes for it until they've caught up, not only on the night. Every message pushes the folded ones (who, never what).
- **The bell doesn't say which couch** (step 15 part 2; for a later polish). It lists all your notices together, newest first, with the
  show's art: someone on two couches that both watch a show can't tell which couch a poll or a planned night was on. A couch's name on
  the row (only when you're on more than one) would.
- **A real phone's push service is untried** (step 15 part 2; the user's, after the merge). The check turns notifications on through a
  stand-in PushManager whose subscription is fake-push.js's (no check may reach Google's or Apple's push service); the new design's Turn on
  runs the same push-client code classic's Account settings does, which works on the couch's phones today. After the merge, someone turns
  them on from Settings on a real phone (an installed iPhone app, an Android phone) and sees a push arrive.
- **A shared mark can lag for someone who sees results straight away** (step 15 part 3; for a later polish). Where I am shares a
  person's follow mark ("On Episode 2", "3 ahead"). With Hide scores off they may never reveal, so it can trail what they've watched
  until a reveal, a watch along's End or a rating moves it. Taking the latest episode they watched along, as the fold's author mark
  does (chat.ts authorMark), would close most of the gap.
- **Old reveal lines stay in classic's chat** (step 15 part 3; for C). Turning Where I am off stops new reveal lines and hides the old
  ones in the new design's chat and feed, but classic's league chat still shows the ones written before (it reads chat as it always
  has). They go with classic at C.
- **An open Chat tab keeps its fold after someone changes what they share** (step 15 part 3; for a later polish). The chat's version
  doesn't count people's switches, so a Chat tab already open keeps folding a message by its author's mark until something else
  changes (a new message or reaction, an episode airing); opening it again reads it fresh. The authors' Where I am in the version
  would.
- **Seen it all comes after this week's play** (step 15 part 3; for a later polish). Trivia offers an earlier season to mark under your
  score (or when there's nothing to ask), so the round it then deals is Play again, just for fun, until Monday's. Offering it before the
  first question would make it this week's round; first run could ask about finished seasons too.
- **A rail chip's line is cut short by a long name** (step 15 part 3; for a later polish). "riley Ep 6 · +1" fits the 244 px chip; a
  long username ("zt_nd_riley Ep 6 · …") loses the "+1" (the faces beside it still say how many). Most names are short.
- **Posters are TVmaze's medium image** (step 10 part 1; for a later polish). 210 by 295, soft in the tall show bar; TVmaze's
  other size is the upload itself, often over a megabyte. A resized copy we keep (or Vercel's image optimisation, which has
  limits of its own) would sharpen it.
- **Classic's late-joiner switch doesn't know Lock it down** (step 15 part 4; for C). Classic's Let people join late reads
  `GhostLogic.allowed`, so it shows off while a game is locked down, and switching it on there changes nothing until Lock it down is
  off in the new design. Classic retires at C.
- **Studio is plain** (the user, 2026-10-26, during the polish before the merge; for a design step of its own after the merge, the
  user's call). Studio is classic's light tokens (a cool grey-white page, near-white cards), and the design's signature goes flat on it:
  the white caption plate is a white box on a white page and yellow only a small fill, so only the show art has any character. The
  user agrees a light mode is needed but wants one with personality. Recommended (Claude's, not yet decided): mock two or three light
  directions in the site mock to pick from, e.g. a "daytime set" (a warm paper ground, the tab bar and top bars kept Night as a
  broadcast frame, ink plates with white type on light, bolder yellow fills), then port the winner as tokens scoped to the new design
  (`(new)/new.css`; globals.css `:root` is classic's light mode too). Not blocking: everyone starts on Night (memory studio-too-plain).
- **The audit sees a reel's first screenful** (seen in the polish before the merge; for whoever next touches check-new-studio). The
  sweep skips what's off screen in a sideways reel (rightly: it can't judge what isn't drawn), so the landing's Traitors card (dark ink
  on its red, 2.9:1) was never audited until the sweep gained the landing's reel scrolled to its end. The hub's guide reel, the
  streaming rail and a show's game chips are still audited only as far as they show at 390; a row per reel scrolled to its end would
  cover them.
- **Classic's white on live red** (seen in the polish before the merge; for C). Classic's draft board marks and waiver badge draw white
  on `--live` (3.4:1 on Night's coral, whose ink is `--live-foreground`); the new design's tab badge now uses the ink. Classic retires
  at C.
- **The archetype critique's layout findings** (2026-10-26, `/impeccable critique`, its snapshot local in `.impeccable/critique/`; for
  after the first blind testers, `docs/ARCHETYPES.md`). The hub runs 11 sections with airtime four times on its first screen and the
  move to make at 19px under a 44px show name; show tabs spend 236px on chrome before content and the dock covers rows; Tonight's
  moves are a sideways carousel (the second a 36px sliver); yellow is on 9 things in the lineup sheet and red marks "needs you" (tab
  badges, the poster dot); Rules, the desk's Library and Backstage results put one-line items in boxes. Its three directions to mock
  side by side first: the hub as one action then rows, Tonight as a checklist, the lineup as a picture (field over bench).
- **The behind-watcher's pick** (the same critique; the user's call). A pool pick that waits on revealing the last episode turns its
  button into "Reveal Episode N" with no why and no way to skip the week (`show/tonight.tsx` YourMoves), and the Tonight tab's red
  badge counts that reveal as a move (`screens/show-space.tsx`).
- **No one can make a weekly move for someone** (the same critique; the user's call). Draft and waivers have "Pick for them"; Weekly
  Lineup, Survival Pool picks and predictions have no screen for it, and the routes let a commissioner, not a Game admin, do it (the
  episode picks and lineups routes; a pick is already logged to Recent changes).
- **Bounce easing against DESIGN.md's "no bounce"** (the critique's detector; the user's call, likely carried from the mock): the
  reveal's standings reorder (`show/reveal.tsx`), the tab bar's icon lift (`ui/show-bar.tsx`), the toast (`ui/toast.tsx`), four in
  `new.css` (`.nd-dock`, `.nd-vote`, `nd-stamp`, `.nd-line`) and the landing's `--spring`.
- **Small things the critique saw** (any step touching them): Episodes passes `text-[13px]` to `ShowArt` but its own 30px wins, so a
  show without art overflows its 96×60 tile (`show/episodes.tsx`); 10px text under the 11px floor on the hub posters' game chips
  (`hub/sections.tsx`) and Games' "You" badge (`show/games.tsx`, `show/solo.tsx`); Stats shows a tie as 1 and 2 where everything else
  says T1 (`show/stats.tsx`); a toast covers first run's Back and, after joining, the wordmark.

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

**As built, R1 (2026-10-24, on `new-design`).** Logic only, nothing existing touched (no format, engine or
scoring file changed). All in `src/lib/game/formats/`, plain CommonJS with `.d.ts` beside each:
- `rulebook-schema.js`: every answer as an `OPT` list `[value, label, help]` (the rulebook mockup's words), the
  four kinds in `KINDS` (block headings, null where a kind hides one; the part word; where results come from;
  which games fit), the editor's `QUESTIONS`, `labelOf` / `optionsFor` / `partWord` / `blockLabel`, and
  `blocksProblems`, which locates each problem on its row (`segments[tribalCouncil].voters`) in plain words.
- `rulebook-moments.js`: `momentsFor(blocks)`, the implementation plan's template table, each moment with its
  research question (`ask`) or `auto` when nothing need be asked; `questionFor`.
- `blocks/survivor|traitors|challenge.blocks.js`: the built-ins by hand, with `aliases.events` (moment → the event
  id leagues recorded) and `aliases.exits` (way out → the exit method castaways carry). Each builds every one of
  its format's events exactly once (tested). `rulebook-from-format.js` reads any other format back as blocks
  (generic and the stored ones: categories with something asked become segments nobody decides, exits become
  ways out, nothing guessed: no finale). `blocks/index.js` `rulebookFor(formatId, data)` picks.
- `rulebook-describe.js`: `howItWorks(blocks, { seen, episodeCount, phaseStarts, compiled, points, updates, ... })`,
  the mock's How it works page section by section, spoiler-safe through `seen` (a phase not yet reached shows only
  its condition, later updates are counted, a later rule change's moments wait for their episode); and the pieces
  (`decidedLine`, `whoLine`, `startText`, `pointGroups`, `blockSummaries`, ...). With `compiled` (the format data a
  league plays by) What scores is that catalog with its real points, so it can't disagree with scoring.
- **Changed from the implementation plan's section 3** (decided 2026-10-24 or needed to cover the shows): `kind`
  is competition / series / talk / **sport** (not "event"), a series has `start` (reality / scripted), `parts`
  names a sport's race and the rundown's own heading ("Each leg"); `tagline`, `premise` and a segment `summary`
  for How it works; `onTheLine: points` (a sport's standings); a way out can mean `outForOne` (did not finish:
  out of one race, not the season); `momentsOff` on twists and the finale too; ways out carry `aliases.exits`.
  Moments carry `ask` / `auto`, not rules: R2's compiler writes the rules (and its golden tests prove them).
  Every template has its own question ("who came 2nd in ..."), because the plan's "who {label}?" only reads right
  for labels that start with a verb; the built-ins' hand-added moments bring their own questions.
- Tests: `tests/rulebooks.test.js` (21: options, kinds, validation messages, every template, the built-ins' and
  every stored format's coverage, How it works for every built-in and stored format, spoiler gating, every kind's
  words) on `tests/fixtures/rulebook-samples.js` (Below Deck, Pluribus, SNL, Formula 1, The Amazing Race) and
  `tests/fixtures/stored-formats.json` (`scripts/dev-test/export-stored-formats.js` refreshes it). `npm test`:
  419 pass, plus the 3 known tour-commissioner failures.
- **The research prompt, built early (user, 2026-10-24: "test that the prompt we generate for the show's rules
  outputs what we expect").** Phase 6's logic, `rulebook-research.js`: `buildRulebookPrompt` (generated from the
  schema, every choice and its help, ~13k characters), `parseRulebookAnswer`, `reviewRulebook`. Tried on real
  shows through ChatGPT with `scripts/dev-test/check-rulebook-prompt.js` (this PC's bot, so the VM stays free;
  answers cached in its out folder, `--again` re-asks). What the runs taught, and what changed because of it:
  - **Spoilers.** An airing season's first answer named castaways and said who found what and who left by
    episode 5, and pinned the swap to its episode. A rulebook is read before anyone has watched, so: the prompt's
    first rule is no names and no results; the review makes a cast member's name a problem (the season's cast
    from `season_cast`) and a sentence about an episode a warning; when phases actually started comes back as
    `phaseStarts`, beside the blocks (season data for a person to confirm), and a phase it reports a start for
    becomes "when the show says so" in the blocks. After that: no names, no episode statements.
  - **One season's story instead of the format.** Every one-off event became a twist (11 for Survivor 50: Blood
    Moon, a coin flip, fan votes, fire-making). The prompt now says what segments, twists and ways out are and
    aren't (one-time events and ties go in a summary or leftOut; similar advantages are one twist; a final duel is
    a finale-only segment; the deciding vote is the finale; every way out, even unused). Survivor went to 2-3 twists
    with fire-making as a finale-only segment.
  - **Repeats.** Answers added moments the segments already build ("Voted with the majority"), which would score
    twice. The prompt lists what each answer builds; the review leaves out a repeat (word-set match) and says so.
  - **Tidied without changing meaning:** ids from names, references by name, answers that don't go with who decides
    a segment, the finale's jury vote given as a segment, a "remaining" phase with no number, a first phase that
    doesn't start at episode 1. Flagged: a segment that sends someone home with no way out it causes.
  - **Per show** (most recent season unless noted): Survivor 50 and 51 match ours (kind, tribes changing at set
    points, reward / immunity / Tribal Council, a jury finale; immunity is "who wins", ours keeps the top three for
    the legacy events). The Amazing Race matches our sample (pairs, the Pit Stop in finishing order, first to the
    finish, U-Turn / Express Pass / Yield), but used `outForOne` for a non-elimination leg, so it's now a problem
    outside a sport. The Challenge described that season's teams ("Permanent Teams" as an advantage, a group-wins
    finale). Real Housewives of Beverly Hills: a reality series, no winner, a good set of moments (got in an argument,
    walked out). Below Deck matches our sample, with better ways out. The World Series (2025 and 2026 Game 2) is a
    sport with "game" as its word and good player-stat moments, no result guessed for the 2026 game, but innings as
    segments and winning as a "withdrawal": the prompt now has sport guidance. Scrubs: a scripted series, but its
    segments were themes and its moments judgement calls, with no comings and goings: the prompt now has scripted
    guidance. A one-game league (the World Series' Game 2) is a game's length, not a rulebook (the design plan's
    open "lengths" item): the rulebook is the World Series.
- **The compiler's core, built early** to check episode research end to end (user, 2026-10-24: "check a handful of
  episode research of each show"): `rulebook-compile.js` `compileRulebook(blocks, { aliases })` → FormatData (events
  from moments; exit methods from ways out; the checklist from each moment's question; research rules for yes/no and
  counts; implied rules for ways out and a jury finale; a cast vote's attendance, votes and majority through
  `votedForLeaver`; a talk show's moments as episode-level answers) and `formatForRulebook` (a data-only format).
  `formatProblems` (define.js) now takes `winnerExitMethod: null`. Every built-in, sample, stored-format and researched
  rulebook compiles clean; the built-ins to their own event ids and exit methods. **Left for R2:** the golden scoring
  tests against the frozen built-ins; `per` on research rules (a count scores once for now); secret roles (custom.js's
  generic `roleFor`); phase gating from `phaseStarts`; `formatForRulebook` with the built-in readers; state-logic
  null-safe for a winnerless format before any league plays one.
- **Episode research from a researched rulebook, end to end** (`scripts/dev-test/check-episode-research.js`: compile,
  the cast, then ~3 episodes per show through the app's own JSON paste prompt, parse, validation and staging). 28
  episodes on 9 shows came back usable (nothing fatal, everyone covered): Survivor 50/51 (51's exits match our accepted
  results), Amazing Race, The Challenge, Real Housewives, Below Deck, Scrubs, SNL 51/52 (episode-level answers, right
  hosts and dates). What it taught:
  - **Ask only about who's still in** (decided with the user): late episodes asked about everyone were weak (8 of 28
    sourced, 544 unknowns). `rulebook-roster.js` `whoToAsk` decides by the rulebook: gone after a way out that means out
    or a finish, never after `outForOne` (a sport asks about everyone), kept while a comeback from people who left
    exists; `asksArrivals` when people arrive mid-season (research must then ask who's new, 6b). Drop people only on a
    **confirmed** exit: production's `stillInGame` drops on any earlier research answer, reviewed or not, so one wrong
    "left" silently loses a person's later moments.
    Re-run narrowed: Survivor 51's episode 5 asked 17 of 21 (the 4 gone by accepted results) and came back with 30
    unknowns, not 93, and without the wrong "Jenna Doore left" (she was still asked about: her episode 4 exit isn't
    accepted). Survivor 50's episode 13, the finale, asked the 5 still in (19 skipped by ChatGPT's exit list) and came back
    with 113 unknowns: "unknown" where a plain "no" fit, and no final-five vote. The same whole-cast prompt had come
    back with 550 unknowns once and 0 the next time, so one answer per setting can't measure completeness. Narrowing's
    sure gain is that nobody gone gets a moment or "leaves" again. Completeness needs a second ask when unknowns run
    high: Research again's field-by-field merge, run by itself on the bot path. Nothing scores the jurors themselves,
    so a finale loses nothing by skipping them.
  - **The bot leaks context between requests.** Asked for the 2026 World Series cast, ChatGPT returned Survivor 50's
    (an earlier request in the run) with Survivor sources, and the episodes followed it. It happened again on the
    re-run, this time with Survivor 51's cast, the request just before it. The bot uses one persistent
    signed-out profile; recommended: temporary chats (`?temporary-chat=true`) per request, and the app checking an answer
    is about what it asked (cast sources, an episode's title and air date against the schedule: the paste path's
    episode-mismatch check, on the bot path too). Not changed yet: waiting on the user.
  - **A sport's cast needs its own words:** the cast prompt ("as the show credits them", "season 2025") came back empty
    for the World Series; "both teams' rosters" is the harness's stopgap. Step 10's cast import needs it per kind.
    The re-run's 2025 cast came back as both teams' real 52-man rosters. Game 1 then researched all 52, sourced.
  - **A sport's stats break the whole answer:** innings pitched came back as 6.2 (baseball's 6⅔), and the compiler
    types every count as an integer, so the 2025 World Series' game 2 didn't parse. R2: a count that isn't whole (a
    `number` type, or the prompt asking in outs). And one person missing one field fails the whole answer, which
    `parseJsonAnswer` could treat as unknown instead (a production fix, like the doubled answer below).
  - **Production's paste parser breaks on a doubled answer** (a draft, then a correction): `extractJsonObject` reads first
    `{` to last `}`. The rulebook parser takes the last complete object (`jsonObjectsIn`); the classic paste path should
    too (a master fix).
  - **Rulebook quality shows up in scoring:** ChatGPT split Survivor's immunity into two segments, so one win scored
    twice; near-repeats ("Survived Tribal Council despite receiving votes") slipped past the review. The prompt now asks
    for one segment for a contest won as a group then alone, and the repeat check stems words.
- **The library** (user, 2026-10-24: "transfer the rules of new shows so we don't have to compile it again"):
  `src/lib/game/formats/library/`, one researched rulebook per new show (The Amazing Race, The Real Housewives of
  Beverly Hills, Below Deck, the World Series, Scrubs, Saturday Night Live), each its blocks and compiled data with
  where it came from, all research drafts. `tests/rulebook-library.test.js` keeps each valid, its compiled data what
  its blocks compile to, and free of names and results; `scripts/dev-test/save-rulebook-library.js` saves or refreshes
  them (refusing problems, and any cast member's name with `--cast`). **R3's backfill loads them** into `rulebooks` as
  library entries; step 10 starts new shows from them.
- For R2: aliases cover events and exits; question keys aren't aliased yet (the compiler maps them to the legacy
  checklist, where its golden tests can prove each one). Survivor's legacy `finalist` event also goes to the
  winner, The Traitors' and The Challenge's don't: the compiler needs to follow each.

**As built, R2 (2026-10-24, on `new-design`).** Rulebooks phase 2 is done: the compiler, the legacy freeze proved by golden
tests, and the engine relaxations, plus the six items R1 left. `npm test` is 450 pass plus the 3 known tour-commissioner
failures; type check and `src/` lint are clean. The format harness (T-15) shows no behaviour change; only `rules.js`'s
function-source hashes moved.
- **The legacy freeze, by construction: a rulebook compiles on top of the data it was frozen from.** Survivor's frozen rules
  aren't the templates': a reward from either reward answer, 2nd and 3rd from an integer finishing place, zero votes
  excluding a tribe immunity winner. So the plan's `aliases.questions` (renaming question keys) couldn't reproduce them,
  and a built-in reader's code half reads its family's own question keys by name. `compileRulebook(blocks, { aliases,
  reader, base, phaseStarts })`: a built-in `reader` brings its family's data as the `base` (a stored format passes its
  data). Every event the blocks still build keeps the base's label, rules, questions, group, recap entry and wiki event
  type; its points come from the blocks (the three built-ins' blocks now carry `points`, their formats' own). What the
  blocks add compiles from the templates. What they drop takes its rules with it, with a warning when a base rule needed
  it: a built-in rule loses a dropped optional role event, or goes when a required one is gone. `rulebookFor` now returns
  `reader` (and `base` for a stored format). `aliases.questions` is dropped from the plan.
- **Golden tests** (`tests/rulebook-golden.test.js`, T-10/T-11): each compiled built-in equals its format key for key (not
  `terms`: the rulebook owns its cast words); the harness's research answers (now shared, `tests/harness/research-fixtures.js`)
  stage the same results with the same review and notes; every exit method, jury count and role implies the same events;
  demo leagues of all three types score the same played by `settings.showFormat` or by `settings.rulebook`. Every stored
  format compiles back onto its own data the same way, except that a way out it scored nothing for becomes a 0-point moment
  (`blocksFromFormat` now gives it 0, not the template's 2).
- **`formatForRulebook(data, reader)`** (index.js, re-exported by rulebook-compile.js): a built-in reader's code half over the
  data, its `roleFor` only when the data has roles (the generic one when the family has none); anything else is a data-only
  format. Built once per data and reader. **`formatOf` reads `settings.rulebook` (`{ data, reader }`) first.** Nothing writes it
  yet; R3's flag decides when the server does.
- **`per` on research rules: one result carrying `units`, not N results.** Staging keeps one row per person, episode and event
  (the unique index), so the count rides on that row the way a finalist's jury votes do. Migration **0106**
  (`season_decisions.units` NUMERIC), staged by `db/season-decisions.js`; a re-read moves a pending count, never a decided
  one. It's applied by `season-decisions.ts` (a count filled in or corrected after the accept follows, like jury votes) and by
  the commissioner's apply, landing on `episode.scoringEvents[].units`. `ActiveRosterLogic.eventPoints` (points times units)
  and `setEventUnits`; all 13 per-event point reads in the classic UI and bots use `eventPoints`, and castaway stats count
  units. Only the admin's review shows "× 3"; classic event rows show the multiplied points without it (the new design
  draws its own). `rules.js` validates `per` (a count question) and reads it as "once per home run".
- **Counts that aren't whole:** a `number` checklist type. "Each time" is an integer; "how much" (`perUnit`) and a segment's
  score are numbers, asked "with a decimal for part of one (6⅔ is 6.67, never a shorthand like 6.2)". The World Series'
  innings pitched now parse.
- **Secret roles:** `custom.js` has a generic `roleFor` (a recorded value is the role it names unless `roles.becomes` maps it:
  "Recruited Traitor" makes a Traitor). The compiler writes the role questions (`isTraitor`, `becameTraitor`,
  `recruitedAsTraitor`, the same keys traitors.js uses), the role stage rules, `voteByRole` for every cast vote that sends
  someone home, once per way out it causes (`voteByRole`'s four role events are now each optional, at least one needed),
  recruitment from the recorded role, and reaching the finale as the secret role. On the same Round Table it catches and
  fools the same people as traitors.js (T-26).
- **Phase gating:** `phaseRanges`; a one-phase segment's rules run from its phase's start to the episode before the next known
  start (`rules.js` gained `untilEpisode`). Until its start is known they don't run at all, the compiler warns, and research
  gets an episode question `phaseStarted`. A finale-only segment isn't gated. The Real Housewives' reunion now waits.
- **state-logic with no winner:** `isWinnerExit`, `seasonWinner`, `seasonEnded`, `finaleEpisodeOf`. A winnerless season is over
  once nobody is left (everyone gone, by an ending or a way out); a talk show runs on. Before this, a null winner matched
  every castaway still in (their `exitMethod` is null), so a winnerless league would have read as over from the start.
  Four classic components use the helpers; `rules.js`'s finale fact and `roleWonEpisode` too. T-21 plays every kind ten episodes.
- **Tests and checks added:** `tests/rulebook-compile.test.js` (counts, roles, gating, every segment combination: 2,232 compile
  clean, every kind through ten episodes, readers, edits on a base, alias collisions), the units case in
  `tests/episode-research-apply.test.js`, and **`scripts/dev-test/check-decision-units.js run`** (real SQL on the local
  database: staged with its count, moved while pending, held once decided, carried and scored by a zt league; PASS ×6).
  `save-rulebook-library.js --recompile` refreshes the library after a compiler change (done: five entries). Browser smoke
  at 390: Overview and Episodes on the results fixture, the waivers claim screen; the touched screens render.
- **For the user to review:** Below Deck's researched "individual charter gratuity share" is an amount at 1 point, so it now
  scores per dollar. Its 6b review should make it worth about 0, or a yes/no.
- **Before 0106 reaches production:** it ships with 0b's migrations, so the same fresh backup and Neon branch rehearsal covers it.
- **For R3:** write `settings.rulebook = { id, version, data, reader }`. The backfill stores `compiled` = the frozen format data,
  and keeps that frozen data as the `base` for every compile from blocks. Don't base a recompile on the previous compile: a
  moment whose question changed would keep its old rule. Store `phaseStarts` beside the blocks. Not done: an edited question
  on a moment the base still scores keeps the base's question (by design: re-asking it differently means a new moment), and
  the "× n" in classic event rows.

**As built, R3 (2026-10-24, on `new-design`).** Rulebooks phase 3: the tables, the backfill, `db/rulebooks.js`, and
`settings.rulebook = { id, version, data, reader }` written into leagues behind the `rulebooks` flag, which is off. Nothing
scores differently with it on (proved on zt leagues of every kind and, read-only, on the local copy's real leagues), and
off it touches nothing but one small flag read.
- **Migration 0107** (`rulebooks`, `rulebook_edits`, `show_seasons.rulebook_id`, `leagues.rulebook_id`). Changed from the
  implementation plan's 5.1: `kind` is the schema's `sport`, not `event`; a `base` column (the data a rulebook was frozen from,
  never moved: every compile from blocks starts from it, R2's ask) and `provenance` (where it came from, and `editedAt` once saved
  from the editor); `parent_kind 'library'` for an entry of `formats/library/`; unique indexes for one live rulebook per league
  and one library row per source (so the backfill and the lazy paths can't make two); `rulebook_edits.legacy_id`, the season
  change it was copied from (no FK: that table goes in C). Left for their phases: `rulebook_offers` and `rulebook_pushes` (5 and
  7, in 6b), `shows.kind` and `new_season_from` (8, step 10).
- **`db/rulebooks.js`** (+ `.d.ts`): the plan's `getRulebook`, `listLibrary`, `seasonRulebook`, `rulebookForLeague`,
  `createRulebook`, `copyRulebook`, `saveBlocks` (validates, compiles on `base` with its aliases, reader and phase starts, refuses
  located problems, version on, `compiled_source 'blocks'`), `setPhaseStart` (recompiles one from blocks), `lineage`,
  `leaguesUsing`, `compiledFor` (cached by id and version; `throughEpisode` waits for phase 5's edits). And what keeps
  rulebooks honest until the editors make them the source: `ensureTemplate`, `ensureSeasonRulebook` and `ensureLeagueRulebook`
  make one if missing and bring an **unedited** one (`legacy`) up to its source when it moved (a stored format re-approved, a
  show switched format, a commissioner's copy edited or given up), version on; anything saved from blocks is never touched.
  **`syncLeagueRulebook`** writes a legacy rulebook into a league only when its data and reader are exactly what the league
  plays by without it (`legacyBase`, formatOf's own choice), else the league stays on the old path and the result says why (a
  stale cache, no season in the catalog). Adopted season changes still layer on top in formatOf. The flag is read every time
  (one row), so a flip is seen at once.
- **The backfill** (`db/backfill-rulebooks.js [--dry-run]`, a rolled-back transaction for the dry run; idempotent): templates for
  the four built-ins and each approved stored format, the six library drafts, a rulebook per season (each checked against the
  format its research reads), approved and withdrawn season changes as `rulebook_edits` (ops where blocks can say it, the delta
  kept whole in `proposal`), own-copy leagues. **Run on the local copy:** 9 templates, 6 drafts, 5 seasons, all the same as their
  formats; a second run changed nothing. There are no season changes or own copies in that data, so those paths are proved on
  the fixture. Phase starts: only a clean switch in accepted results counts as a confirmed merge (decision 5), because real
  results mix the flag: Survivor 49 has tribe immunity marked post-merge in episode 8. So Survivor 44's merge is 6; 49's and 51's
  are left for a person to confirm (6b), and the backfill says so.
- **The flag:** `app_settings 'rulebooks'`; **`scripts/rulebooks-flag.js status | check | on | off`**. `check` writes nothing:
  each league synced in a rolled-back transaction and compared (standings, every episode's events and points, the season's
  end, the catalog), each season's rulebook against its research format. On the local copy: the five real leagues on a season
  would get their season's rulebook and score the same; the sixth has no show. `on` runs the backfill first (refusing if a
  season doesn't match), sets the flag, then walks every league under its row lock without running waivers or bots, saving only
  what changed; `off` takes `settings.rulebook` out again. No admin switch yet (6b). **`scripts/rehearse-migrations.js` now also
  runs the backfill and `check` on the Neon branch** (tried end to end on the local database), so 0b's rehearsal covers 0107.
- **Wired** (each a no-op with the flag off): the settings route on a show or season change; `pushShowFormat` (the show's
  season rulebooks first, then each league under its lock); the league ruleset fork, edit and give-up. **`rulebook` is now
  `SERVER_OWNED` in the settings route:** since R2's formatOf read `settings.rulebook`, a commissioner could have set any rules
  through the generic setter on the branch. `seasonFormat` reads the season's rulebook with the flag on
  (`seasonRulebookFormat`: an unedited one only for the format it was frozen from). Not switched: `db/embeddings.js` and the
  decision route still `resolveFormat` (the same rules while every rulebook is legacy; 6b switches them when edits differ).
- **Tests:** `tests/rulebooks-db.test.js` (5: key-order-free comparison, `legacyBase`, the clean-switch merge, flag off touches
  nothing, a delta as ops); **`scripts/dev-test/rulebook-fixture.js`** (zt leagues on Survivor, Traitors, Challenge and a stored
  format, every league type, an own copy, an adopted season change, a league from before formats, a stale cache, a season not in
  the catalog; `--copies` for scale) and **`check-rulebook-flag.js run`** (43 PASS: the backfill, the flag on and every league
  scoring the same, the stale league refused, research's format, a wrong rulebook caught, a format re-approved, an own copy edited
  and given up, unedited blocks scoring the same and a real edit playing, phase starts, lineage, a copy, the flag off leaving each
  league exactly as it was). The app's routes checked against the running dev server (the refusal, a season change, fork, edit,
  give up). `npm test` 455 pass plus the 3 known tour-commissioner failures; type check clean; `src/` lint has one error, in
  `use-sheet-swipe.ts`, from 2026-10-17, not this step.
- **Hosting:** ~30 KB of storage per season's rulebook; with the flag on every league's state carries its rules (+5-14 KB), and
  HOSTING.md has the lever if that matters (no `data` for an unedited built-in).
- **For 6b:** season_rule_changes is still what research applies and leagues adopt; the copied edits wait for phase 5's
  `rulebook-patch.js`. Rulebooks aren't in `backup-leagues.js` yet: fine while every one is legacy (the backfill re-makes them),
  but add `rulebooks` and `rulebook_edits` (both FK cycles: leagues and show_seasons point at them) once one can be edited. The fan-out
  is a CLI; 6b's admin switch and edit pushes need `rulebook_pushes`. Confirm Survivor 49's and 51's merges. A show on `generic`
  reads with the research code half, not generic's own: the same scoring, possibly other prompts (no show uses it).
- **Before 0107 reaches production:** it ships with 0b's and 0106, under the same fresh backup and Neon branch rehearsal, which
  now runs the backfill. Production's backfill can wait: with the flag off nothing reads the tables, and `rulebooks-flag.js on`
  runs it first.

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

**As built (2026-10-24, on `new-design`).**
- **Routes** (`src/app/(new)/`, listed in `src/new/routes.ts`): `(in)/` checks the session on the server (none:
  `/sign-in`; not approved: classic's `/`) and holds `/home`, `/settings` and `/show/[seasonId]/...`; `/start/[step]`
  and `/join/[code]` sit outside it, open signed out, for step 9. **The Games tab's route key is `games`** (the mock's
  was `standings`). `/show/[seasonId]` goes to Tonight; the five tabs share `(tabs)/layout.tsx` (show bar and tab
  bar); `backstage/[[...page]]` (results, waivers, rules, members, settings, history), `waivers`, `draft` and `blind`
  are pushed over the show without them. AuthGate passes the new routes straight through and doesn't boot classic
  on them (no `/api/me`, no league state); switching designs is always a full load.
- **Opting in:** migration 0108 `user_settings.ui` ('classic' | 'new'), read and written by `/api/me/settings`;
  classic's More sheet and sidebar menu say **Try the new design** (Coming Soon!, which opened /mock, is gone; /mock
  is now Settings › The full design); the new Settings has **Back to the classic design**. A signed-in `/` goes to
  `/home` by a `next.config.ts` redirect on the `gys_ui` cookie plus a session cookie, before anything renders (a
  `redirect()` in classic's `Home` page threw React's dev-only "negative time stamp" error). A device without the
  cookie gets there through AuthGate: `/api/me` now returns `ui` and sets the cookie (`src/lib/server/ui-choice.ts`).
- **Tokens:** the Night tokens exactly as classic's `.dark` has them, forced (the shell puts `dark` on `<html>`), so
  the new design uses classic's utilities and adds no token names. `src/app/(new)/new.css` holds only the phone
  column (390px, the #0b0a0f desktop backdrop, `.nd-fixed-x` for anything fixed) and the motion. DESIGN.md has a new
  section, "The new design", with the rules the primitives carry and the mock's bends.
- **Primitives** (`src/new/ui/`): `Sheet` (Base UI and classic's swipe, the mock's shape), `PushedPage` +
  `usePushedPage` (`?page=`, the back gesture closes it, rendered into `<body>`), `toast` (with Undo), `Preview`,
  `TopBar` / `PageHeader` / `Avatar` / `Wordmark`, `ShowBar` (tall on Tonight, compact and sticky elsewhere),
  `TabBar` (tabs replace the history entry: back from any tab leaves the show), `ShowArt`, `Btn` (must / optional /
  ink), `Row`, `SectionHead`, `Chip`, `EmptyState`, `GuardChip`, classic's `CaptionPlate` re-exported, and `Flip` for
  step 3's re-sorts (unused yet).
- **Real data in the shells** (all free): your name; your couches (the hub shows the one picked on this device,
  else the busiest); your shows as cards with their art; the show bar (art, season, a calm clock from the schedule,
  the ⋯ menu); the couch line; Tonight's badge (moves due in this couch's games); Backstage for whoever runs a game
  here; the guard chip's episode. A show opens with the current couch if it plays it, else the busiest couch that
  does; with only you on the couch there's no Chat tab. `src/new/data.ts`, `useShow` in `screens/show-space.tsx`.
- **Motion, and two React behaviours it had to work around** (`src/new/nav.tsx`, `new.css`). The screen that moves
  is the view transition's root snapshot, because pages scroll the document (naming a page's own element morphs it
  from wherever it was scrolled to); `html[data-nav]` says which way; the show bar, tab bar and tab marker are named
  during a tab move and the show's art on a channel change. (1) React cancels the root's part of a transition unless
  `<html>` has an inline `view-transition-name`, so the shell sets `root` (the check asserts the root moves, so a
  React upgrade that changes this shows up). (2) React applies a popstate to a page it still has synchronously, so
  the browser can restore the scroll, and a synchronous update never animates: the browser's own back (a gesture,
  Android's back) isn't animated, as Next's guide says (iOS animates its swipe anyway), while the in-app Back buttons
  (`nav.back`) run their own `document.startViewTransition` around `history.back()`, naming the art by hand for the
  channel change. Also: closing a Base UI sheet runs a `flushSync`, which cancels a transition, so a sheet row that
  navigates leaves the sheet open and it slides away with the screen. On a desktop the root is the whole window, so
  pushes and pops are the tabs' short nudge there.
- **Preview** (`src/new/preview.ts`, 28 entries): `<Preview id>` takes its step from the registry (so ids type-check)
  rather than a `step` prop; `tag={false}` for an icon button. 0d's entries are the placeholders for the rest of the
  hub (`hub.sections`) and each show tab (`show.<tab>`, `show.how-it-works`); the others belong to the step that
  builds that screen. `src/new/fixtures/` has the convention (`export const STEP = "..."` per module) and no data
  yet: 0d ports the mock's.
- **Checks:** `tests/new-nav.test.js` (the routes, every kind of move, calm clocks); `scripts/dev-test/check-new-shell.js
  <outDir> [--width=390|1280] [--reduce] [--keep]` (in a browser on new-fixture.js: opting in both ways and the
  cookie, every kind of move with the animations that ran, the root included, the badge, the guard chip, How it
  works covering the screen, back to classic), passing at 390, 1280 and reduced motion; `scripts/dev-test/
  check-preview.js`. Classic unchanged: `check-up-next`, `check-reveal` (plays to its last beat), `check-chat-polls`;
  `npm test` 462 pass plus the 3 known tour-commissioner failures. Type-check and lint clean.
- **For 0d:** replace `hub.sections` and each `show.<tab>` placeholder with the ported sections, each behind its own
  Preview entry tagged with the step that makes it real, data in `src/new/fixtures/<area>.ts`. Any card that should
  grow into the show is a `NavLink channel` holding `ShowArt morph`, and only one element per season may carry it at
  a time (check-new-shell counts one card per show). A `notFound()` under the new routes shows Next's plain 404;
  a `src/app/(new)/not-found.tsx` would fit the design. Migration 0108 ships with 0b's (same rehearsal).

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

**As built, part 1: the hub (2026-10-24, on `new-design`).** The show space is the next session.
- **`/home` in both shapes** (`src/new/screens/home.tsx`, sections in `src/new/hub/`). *Focus first:* the status
  line, Up next, On now, Your shows, You both watch, the guide, Streaming on the couch, The couch is watching, On the
  couch (the feed), More on the couch, New league / Join a couch. *Grows with you* (your first week on the couch, by
  `couch_members.joined_at`, which `/api/me/home` now returns, or a couch with no games yet): the status line, Get
  the couch going (a brand-new couch only), Up next, Your shows, the guide, the feed, "More shows up as the couch
  plays", the foot. `?hub=focus|grow|new` shows a shape (new = a brand-new couch) for a look.
- **Real, no Preview:** the status line (your moves from `/api/me/home`, worded "your Survivor lineup locks Wed 8:05
  PM", tapping to that show); Up next (the show on soonest, its art, season, episode, a calm clock, and the plate with
  your move for it in yellow, or "All set" in teal); Your shows (art, season and night, the games by name once each,
  a red dot when a move is due); More on the couch's six rows. **On fixtures, behind `<Preview>`,** each tagged with
  the step that makes it real: who's set and Watch along on Up next (1, 13), On now (13), Add a show (10), the nudge
  (10), the guide (11), the streaming rail (14), The couch is watching (10), the feed (8), the six pages (8), the
  profile's numbers (8), the couch switcher (9), Get the couch going (9), the grow note (8), the foot (9).
  `src/new/fixtures/`: people.ts (the demo people and the mock's pictures, served from `public/mock/showcase`), hub,
  guide, watching, streaming, watch-along, moves, couches.
- **The couch moved off the hub** as in the mock (2026-10-23): the avatar opens your profile (Sheet): the couch line
  (switcher, step 9), your numbers, and **Settings**. More on the couch's pages are `PushedPage`s (`?page=rankings`
  and so on, "‹ Home"); `PushedPage` takes a `back` label now.
- **The channel change grows the card you tapped**, not one fixed card: the hub shows a show in several places
  (Up next and its poster), and React's `<ViewTransition name>` allows one element per name, so `ShowArt` no longer
  carries one. A `NavLink channel` names the tapped card's art (or that of the card around it, `data-art-scope`, as
  Up next's title and plate do); new.css names the show bar's art while `data-nav` is `channel`; coming back,
  NavMotion's layout effect names the hub's art for that show (the first on screen) inside the transition. All one
  name, `nd-art`.
- **Changed from the mock:** the streaming rail's ＋ and Commercial break's optional pieces aren't yellow (yellow only
  for what you must do; the guide's Today and Up next's move are); the poster has no "best 1st" badge or flip side
  (standings are step 1); the guide stops rolling at its end rather than looping. The Preview tag now sits on the
  dashed line like a legend, so it never covers what it marks.
- **Checks:** `scripts/dev-test/check-new-hub.js <outDir> [--width=390] [--keep]` (every shape, the profile, the six
  pages opening and closing, every `hub.*` registry entry rendering, Up next's art growing into the show bar, nothing
  wider than the screen); `check-new-shell.js` updated for the hub (profile sheet, `nd-art`); `check-preview.js`
  lists 21 hub entries across steps 1, 8, 9, 10, 11, 13, 14 and 15.
- **For part 2 (the show space):** the tab placeholders are still `show.<tab>` and `show.how-it-works` on step 0d.
  Mock: `show.js`, `dock.js`, `episode.js` (`standing`), `refine.js` (`tabTonight`, the swipeable move cards and
  Extras), `gamestab.js`, `explorer.js` (Cast), `rulebook.js` (`howPage`). Moves fixtures go in `fixtures/moves.ts`
  (step 1). `useShow(seasonId)` has the frame's data; `DemoAvatar` / `Faces` in `hub/sections.tsx` draw fixture people.

**As built, part 2: the show space (2026-10-24, on `new-design`).** 0d is done: no `0d` entries are left in the registry.
- **The five tabs** (`src/new/show/`, mounted by `TabScreen` in `screens/show-space.tsx`; the frame also mounts the dock, the
  "Your moves" sheet and How it works, so every tab shares them). *Tonight*: the phase heading, Your moves, Extras this
  week, Watch along, Your games, Stats. *Episodes*: this week's episode, then every episode (each opens its page,
  `?page=ep4`) with the waiver window's row. *Games*: a pill per game, each game's table (a row opens that person's sheet,
  Rules each game in plain words), How it works' row, This week, Start a game; a show you don't play gets **Play it** in
  place of the tables. *Cast*: the explorer, Faces / Rank / By episode, one episode slider, Ranked by and Beside it as
  native dropdowns, Patterns, Compare two, Share, a castaway's story; `?rank=<stat>` opens Rank (Tonight's Stats card
  links there). *Chat*: the day lines, bubbles, the reveal line, the composer above the tab bar.
- **Real, no Preview:** Tonight's heading from the schedule ("Episode 6 · Tue 8:00 PM · in 3 days", "On air · Episode 6
  · Locked at 8:00 PM", "Season over"); **Your moves' cards**, one per required move due in this couch's games here as the
  home lists them (`/api/me/home`, actionItems: lineup, pickup, pick, draftTurn, blindDraft; `src/new/show/moves.ts`
  words them), the first with the one yellow button, swipeable with dots, "You're set for Episode N" (with Change) when
  none, "Your moves are locked" once it's on; predictions due as Extras rows; **the dock**'s state and words (Set with
  "1 open slot · no pick · 2 calls", Edit when all set, Locked on air; on Episodes, Games and Cast, on Tonight only once
  it's on, never on Chat; it holds still during tab moves as `nd-dock`); the show's art, name and air times wherever they
  appear; How it works' row. `useShow` now returns `moves` (this couch's, soonest first); the tab badge still counts them all.
- **On fixtures behind Preview**, each tagged with its step: the moves sheet (`show.moves`, 1: lineup tiles, pool grid,
  predictions, the Outlast team; Save says Coming soon), your places and the tables (`show.your-games`, `show.standings`, 1),
  How it works (`show.how-it-works`, 1), who's set (`hub.upnext-progress`, 1), every episode and its page (`show.episodes`,
  `show.episode`, 2), the cast and stats (`show.cast`, `show.stats`, 3), chat (`show.chat`, 4), the waiver row
  (`show.waivers`, 6a), Play it and Start a game (`show.make-it-a-game`, `show.start-game`, 10), the episode games and
  bingo (`show.episode-games`, 12), Watch along (`show.watch-along`, 13). Fixtures: `cast.ts` (Survivor 51 through
  Episode 4 from the showcase export: tribes, exits, points per episode, recorded events; its STEP is 3, the last step
  that reads it), `standings.ts`, `moves.ts`, `how-it-works.ts` (1), `episodes.ts` (2), `chat.ts` (4), `episode-games.ts` (12).
- **How it works is R1's view model already**: `fixtures/how-it-works.ts` is `howItWorks()` (formats/rulebook-describe.js)
  on the built-in Survivor rulebook, seen through Episode 4, with the mock's updates (Episode 8's counted, not told).
  The page (`show/how-it-works.tsx`) draws the `HowItWorks` type, so step 1 only swaps the source for an endpoint that
  runs the same function on the season's rulebook through the guard. Its "Who's playing" faces come from the cast fixture.
- **`<Preview>` can be looked around now** (`ui/preview.tsx`): a control marked `data-try` works inside one (it only
  changes what the fixture shows: a view, a segment, a fixture sheet, a tab), a Preview inside another answers for its
  own part, and a sheet or page opened from one isn't covered by it (React carries events up through portals), so it
  wraps its own fixture. Everything else still toasts "Coming soon".
- **Shared now:** `src/new/games.ts` (each season game's colour and line, `ordinal`; the hub's fixture uses it too),
  `BtnLink` (a Btn that goes somewhere), `timeOf` / `dayOf` in clock.ts, `show/parts.tsx` (Block, Face, IconBox).
- **Changed from the mock:** no commissioner job on Tonight (5B, the plan's step 1); not yellow, by the yellow rule:
  1st places, the explorer's slider, rank bars and "Your team" tag, Stat of the week's tag; ties read T3 (the mock said
  T4); the move cards don't show done ones yet (the home lists only what's due: step 1 adds them), so all done is the one
  "You're set" card, with Change; the sheet's episode words avoid a number ("Who survives this episode?") because its
  fixture and the real schedule disagree.
- **Checks:** `scripts/dev-test/check-new-show.js <outDir> [--width=390] [--keep]` (39 PASS at 390 and 1280: the heading,
  one card per required move and one yellow, no dock on Tonight before airtime or on Chat, the sheet's segments switch
  and Save toasts, the dock's word, an episode page opens and back closes it, the dock holds still across a tab move,
  a standings row's sheet, Rules, How it works from Games and its jump bar, Faces / Rank / By episode, a re-sort runs
  Flip, `?rank=`, Play it on a show alex doesn't play, every `show.*` entry renders, nothing overflows, no page errors).
  `check-new-shell.js`, `check-new-hub.js` and `check-preview.js` pass; `npm test` 462 pass plus the 3 known
  tour-commissioner failures; type-check clean, lint as before (the one `use-sheet-swipe.ts` error predates the branch).
- **For step 1:** delete `fixtures/moves.ts`, `standings.ts` and `how-it-works.ts` and the entries `show.moves`,
  `show.your-games`, `show.standings`, `show.how-it-works`, `hub.upnext-progress`; the sheet writes through the lineup,
  pick and bet endpoints (its tabs should be the games you play here, not all four); done cards need what you've already
  set this episode; the dock's faces (your starters, your pick) come with it. The tables come from the selectors, Rules
  from each league's settings. The cast fixture stays for steps 2 and 3, so step 1's real sheet needs the season's cast.

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

**Then the couch switches** (after steps 8–15, the user decided on 2026-10-25): set `ui='new'` for the three members
(with their OK), keep classic one tap away, and watch for a week before step C is even considered.

### As built, step 1 (2026-10-24, on `new-design`)

The show space plays on real leagues. No migration; nothing polled or scheduled (HOSTING.md's Changelog has the reads).
- **Your games on a show:** `GET /api/seasons/[id]/games?couch=` (`src/lib/server/season-games.ts`), one `GameView` per
  game you play there (`src/lib/game/game-view.ts`, pure): your moves for the next episode (the lineup: slots, need,
  starters, roster, carried, locked; the pick: open, available, blocked and why, streak; open predictions with your
  guess), the table (rank with T for ties, total, last week or the streak now, the team, the last lineup, picks), the
  cast (photo, group, out, where they finished, points as the game counts them), each game's rules in plain words
  from its settings (`src/lib/game/game-rules.ts`), who's set this week, `revealFirst` and `catchingUp`. `useShow`
  carries it as `show.play`.
- **The guard:** each game is built from `GhostLogic.viewFor` at your season mark (`guard.ts seenThrough`); a late
  joiner catching up plays from their league mark if it's earlier. Someone else's pick shows only once it's decided.
  Behind on results (sam in the fixture), the sheet's Weekly Lineup and Survival Pool tabs say "Reveal Episode N
  first" (who went home decides who you can start or pick): its button is `show.reveal`, step 2's.
- **Writes** go through the classic routes (lineups PUT, picks PUT, predictions POST, and DELETE to change a guess:
  classic has no edit), asked `?quiet` so they answer `{ ok: true }` and never the league's whole state
  (`stateResponse` in `api-route.ts`; classic is unchanged). Then the home and every show's games read again.
- **Your moves sheet:** a tab per game you play here (two of one game: by league name), Predictions (every game's,
  free text: real bets have no options, so the mock's chips became a field), Outlast's team; a dot on what's still
  to do; one Save writes what changed, says "All set. Change anything until Tue 8:00 PM." or "Saved. Something's still
  open.", and a failed write says why. A waiver pickup shows as "Out · replace" tiles and a Replace row in that game's
  tab (Weekly Lineup or Outlast), to the Waivers page (6a).
- **Tonight:** open cards from the home's moves (as in 0d), then **done cards** (Your lineup is in, Survival Pool: Brady,
  each with Change at its game's tab); with nothing open, "You're set for Episode N" leads them. The row starts back at
  the first card whenever its cards change. Your games: real places and lines.
- **The dock's faces:** your starters and your pick (round), from the first Weekly Lineup and Survival Pool here.
- **Games:** a real table per game (pills with your place, Rules from settings, a person's sheet: Survival Pool's picks
  with how each went, Weekly Lineup's season, last episode, a week, last lineup and team, Outlast's team with points
  and finishes); "Through Episode N. Standings move when you reveal."
- **How it works:** `GET /api/seasons/[id]/how-it-works?couch=` (`src/lib/server/how-it-works.ts`): R1's `howItWorks()` on
  the rulebook the couch's game here plays by (a game you play first, Weekly Lineup first, for its points: "This
  game's points"), from your copy of that league (a rule change past your episode isn't in it; the game's adopted
  changes are passed as updates, so a later one is only counted); else the season's rulebook row, else its show's
  format ("Suggested"). Phase starts from the rulebook row, else `knownPhaseStarts`. Who's playing: the league's
  faces in their starting groups, or the season cast without groups (tribes can be held back). Read when the page
  opens (and by the Games tab's row, for its line). "Something off? Suggest a fix" is `show.suggest-fix` (6b).
- **Who's set:** `/api/me/home` shows now carry `progress` per weekly game (`progressOf`); the hub's Up next shows the
  current couch's (lineups before picks), faces dimmed until set; the Episodes tab says "4 of 4 lineups set · 1 of 4
  picked".
- **`src/lib/server/league-read.ts` `readyLeague`:** what a league read does first (the next episode, a bot's move, a
  waiver step due), moved out of classic's `/state` so the new design's reads keep leagues moving too.
- **Fixtures and Preview:** deleted `fixtures/moves.ts`, `standings.ts`, `how-it-works.ts` and the entries `show.moves`,
  `show.your-games`, `show.standings`, `show.how-it-works`, `hub.upnext-progress`; added `show.reveal` (2) and
  `show.suggest-fix` (6b). What Cast and an episode page still borrowed moved to their own fixtures (`cast.ts`
  `YOUR_TEAM`, step 3; `episodes.ts` `YOUR_PICKS`, step 2). `new-fixture.js` now has Survivor 51's real faces from the
  showcase, and its placements count up from the first out (they were the wrong way round).
- **Checks:** `check-new-show.js` (69 PASS at 390 and at 1280): set-up through the real routes (`?quiet` answers `{ ok }`), a
  card per move, the sheet's tabs, a lineup, a pick and a guess saved and read back from the database and `/games`,
  done cards, Change replacing a lineup and a guess (one each), the dock's faces, who's set, the real tables and rules,
  How it works (real faces, a show nobody plays), the hub's who's set, and sam's guard (nothing past Episode 3, reveal
  first). `tests/game-view.test.js` (6). `check-new-shell.js` (How it works is `[data-how]` now), `check-new-hub.js` and
  `check-preview.js` pass; `npm test` 468 pass plus the 3 known tour-commissioner failures; type-check clean, lint as
  before.
- **Noticed, left as is:** four things, now in Noticed, not fixed (near the top): told a move is due while behind on
  results (fixed in step 2), the dock's clock for a waiver pickup, predictions as a text field, two names for one person.
- **For step 2:** `show.reveal` (the sheet's Reveal first) and the Episodes tab; `GameView.revealFirst` per game says what
  each still hides; `through` is each game's standings episode.

### As built, step 2 (2026-10-24, on `new-design`)

Episodes, results in stages and the one reveal are real. Migration **0109** (`show_follows.early_seen`) ships with 0b's.
- **The stage** (engine, additive): an episode's `resultsStage: "early"` while only who went home is in; absent means
  final (every episode from before, and anything entered by hand). `StateLogic.resultsStage(ep)` (null / early / final)
  and `setResultsStage`; a viewer's copy (`SpoilerLogic.viewThrough`) drops it from episodes they haven't revealed.
  Full results mark an episode final: `applyResearchDecisions` (a league's research apply) when it applies scoring
  moments, and `syncLeagueDecisions` for each accepted scoring decision. Nothing marks one early yet (Noticed).
- **Reads and the reveal** (`src/lib/server/season-episodes.ts`, on the pure `src/lib/game/episode-view.ts`):
  `GET /api/seasons/[id]/episodes?couch=` (each episode you've seen with who went home, what happened, the top scorers and
  your line per game; hidden ones only as "results are in" and their stage; the one that's finished airing with nothing
  in; `reveal`, `waiting`, `final` (the morning update), still in, still to air; a show you don't play: the season's
  accepted eliminations up to your mark). `POST /api/seasons/[id]/reveal { episode, couch }`: one reveal for every league
  of yours on the season (any couch: where you are is yours), through `src/lib/server/reveal.ts` `markRevealed`, which is
  classic's results-seen logic moved out of its route (linked leagues together, one chat line per chat, a late joiner a
  week at a time; `show_follows` moves with each mark); then the beats from this couch's games: who went home, what
  happened, your lineup, your other games and predictions, and the table before and after (Weekly Lineup once final,
  else the pool's streaks, else Outlast). An episode already revealed answers again (its final scores). Revealing an early
  episode sets `early_seen`; a final reveal clears it once that episode is final too. `src/lib/server/season-games.ts`
  `gamesHere` is the shared loader (your games, their ready states, your marks) for /games, /episodes and the reveal.
- **The reveal screen** (`src/new/show/reveal.tsx`, `?page=reveal`, back closes it): the opener ("Previously on the
  couch", or "Final scores are in" for the morning update), What happened (when the format's recap has wins), the vote
  card(s), Your Weekly Lineup (each starter's points and why, the total, "so far" when early), Your other games (the
  streak from → to, Outlast's losses, predictions), the table moving into place with "You're tied 2nd with riley and sam."
  Skip jumps to the last beat; Reveal Episode N+1 when there's more. **Share your night**: the card (show art, the couch's
  name, Up to / Still / Down to, the line) leaves out who went home until "Say who went home" is on; Post to the couch is a
  chat message in the first game's chat (the linked group's; step 4 makes it the couch's); Share image draws the card on a
  canvas (1080 × 1350 PNG) for the phone's share sheet, or downloads it.
- **By stage, everywhere:** Tonight leads with Results are in (the one yellow; a move waiting on the results reads "After
  you reveal Episode 5 · closes Wed 8:00 PM" with Reveal as its button, which was step 1's Noticed item), Waiting for
  results with the stage bar (Aired · Early results · Final scores), or the morning update (teal: good news, not a duty);
  after a reveal, the episode's recap (out plate, Your night) until the next one airs. The show bar ("Ep 5 results are
  in", "Ep 6 just aired"), Tonight's badge (+1), the dock (Reveal, just aired, Final scores · See), Games ("As of Episode 4 ·
  Reveal to update every table"), the moves sheet's Reveal first (real now) and Episodes (the plate, hidden and waiting
  rows, seen rows leading with your Weekly Lineup line, a real episode page) all follow the same data.
- **Fixtures and Preview:** deleted `fixtures/episodes.ts` and the entries `show.episodes`, `show.episode`, `show.reveal`.
  The waiver row's data moved to `fixtures/waivers.ts` (step 6a). Cast (3) and Chat (4) keep their fixtures.
- **Changed from the mock:** no "riley and sam have revealed" line (the guard shares nobody's progress); the morning update
  replays the reveal rather than a so-far → final sheet; the stage bar's first step says when it aired; the reveal marks
  your leagues on another couch too (one person, one place in a season).
- **Checks:** `scripts/dev-test/check-new-reveal.js <outDir> [--width=390] [--keep]` (44 PASS at 390, 44 at 1280: results
  in on Tonight, Episodes, Games, the dock and the show bar; the beats; every league's mark, `show_follows` and the chat
  lines; share without and with who went home, the card as a PNG, a post with no spoiler; the recap after; early → the
  pool's table and `early_seen` → final → the morning update and its clearing; waiting; sam's guard). `check-new-show.js`
  (69 at 390 and 69 at 1280; the episode page is `[data-episode-page]`), `check-new-shell.js` (46; its clock check reads "in N days" now, since past midnight UTC the fixture's day is a day ahead of the browser's), `check-new-hub.js`
  (21) and `check-preview.js` pass, and so do classic's `check-foundation.js` and `check-waivers.js` (results-seen now goes through `reveal.ts`); `tests/episode-view.test.js` (5); `npm test` 473 pass plus the 3 known
  tour-commissioner failures; type-check clean, lint as before.
- **Noticed, left as is:** five things, now in Noticed, not fixed: nothing makes early results yet, the morning update
  replays the reveal, who's revealed isn't shown, the hub doesn't say results are in, a show you don't play has only who
  went home.
- **For step 3:** `episode-view.ts` `outsOf` and `episodesSeen` read from your copy at your mark; the stats endpoint can
  follow `season-episodes.ts`'s shape (your games' views, else the season's accepted decisions up to your mark).

### As built, step 3 (2026-10-24, on `new-design`)

The cast explorer and its stats are real, for anyone on a show, playing or not. No migration; nothing polled or scheduled
(HOSTING.md's Changelog has the reads).
- **`GET /api/seasons/[id]/stats?from=&to=&couch=`** (`src/lib/server/season-stats.ts`): counted from the season's **accepted**
  results (`season_decisions`; never pending ones) up to where you are (`guard.ts seenThrough`), the range clamped to it. The
  pure half is `src/lib/game/cast-stats.ts`: `seasonFacts` applies the decisions to an empty league holding the season's
  cast, through `src/lib/game/decision-apply.ts` (the classic sync's `applyDecision`, `undoDetail` and
  `orderPlacementsByEpisode`, moved out of `season-decisions.ts` unchanged so both apply a result the same way), so the
  engine scores them, implied events included (voted out, jury votes); `castStats` gives each castaway's events and points
  per episode over the range, the stats by their **full names from the rulebook** (its moments' labels, the ones How it
  works uses; the ways out are left to Faces), `featured` (the Stats card's order: something from your latest episode with
  one clear leader on two or more), and **Patterns** from the rulebook's shape rather than one show's names (a group win by
  group, people voted out who had survived votes before, how many who got an advantage are still in). Points are the
  couch's game here, picked as How it works picks it (a Weekly Lineup you play first: its points and ownership;
  `pointsFrom` names it), else the season's rulebook's suggested points. A season with no accepted results (its
  commissioners enter them) counts from that game's own results as you've seen them. The season's decisions are kept per
  server and season while unchanged (one row checks: a count and an md5 the database works out), and only the columns a result needs.
- **The guard, secrets included:** a show with a secret role has no groups unless its format has real ones, and never one
  named for a role (Traitors 5's cast carries the faction as its tribe: Noticed); a role is told only for someone who has
  left by your episode, and so is any result that gives one away (`secretEvents`: whatever a rule awards by testing a role
  or a role answer, whatever's named for one, and the secret role's own moments: "As a Traitor, voted out a fellow Traitor",
  "Considered for murder", which only happens to a Faithful). A role is never a filter.
- **Cast** (`src/new/show/cast.tsx`): Faces by the groups people are on now (else Still in), then Out ("Out · Ep 2 ·
  Traitor" once told); Rank by any stat by its full name with Beside it, Patterns, Compare two (every stat over the range)
  and Share this (posts "ZT Survivor 51 stats · ranked by points · Episodes 1–5" to the couch's chat when you play here,
  else the phone's share sheet with a link that reopens the view: `?rank=&from=&to=`); By episode's heatmap from points per
  episode. The slider stops at where you are, and a new range asks the server again (the last range's numbers stay up
  meanwhile). A face's story is the season so far: their group ("started on" after a swap), a role or "stays secret until
  they leave", each episode's results, how they left and the points. Your team is your games' teams. Empty states for
  nothing seen yet and no cast yet.
- **Tonight's Stats card and the stats page** (`src/new/show/stats.tsx`): the stat of the week (opens the page at it), two
  short boards, All N stats. The page (`?page=stats&stat=`, the "sorted pages"): the spoiler chip, See everyone ranked by
  this (into Rank), the stat you came for with everyone who has it, every other stat's top five (a heading re-sorts by it).
- **By the numbers** (the hub's page, `hub/couch-pages.tsx`): its cast stats are real: stat cards for each show you follow
  (leaders on two or more, a show at a time, five at most) and every stat by show, each opening that show's stats page over
  the hub (`&season=`), back to By the numbers. Only the couch accolade card is still Preview (`hub.numbers`, now titled
  Couch accolades, step 8).
- **A show you don't play** has What happened on its episodes now, from the same facts (`episode-view.ts`
  `seasonEpisodesSeen`): step 2's Noticed item.
- `usePushedPage(key, owns)` has `showWith({ … })` for a page's own query params (`stat`, `season`), dropped when it closes.
- **Fixtures and Preview:** deleted `fixtures/cast.ts` and the entries `show.cast` and `show.stats`; of By the numbers,
  `fixtures/hub.ts` keeps only `COUCH_ACCOLADES`. `new-fixture.js`: three starting tribes; the zt Survivor's cast approved
  and its accepted results the lineup league's own (results by leagues, so nothing syncs from them); the zt Traitors gets a
  made-up cast whose faction rides as its tribe, and results through 3 (two Traitors, one banished in 2, the other's
  role-revealing result in 2).
- **Changed from the mock:** the stats are the rulebook's moments ("Zero votes at Tribal Council", not "Never written down"),
  one per moment (no "Most votes against" adding two together), each counted in "times" (a count of units, like innings,
  has no word); Share posts to the chat (the mock's feed is step 8); a show you don't play has no Stats tab of its own,
  since Cast is the explorer for everyone (as the mock's explorer.js decided).
- **Checks:** `scripts/dev-test/check-new-stats.js <outDir> [--width=390] [--keep]` (56 PASS at 390: every count against the
  database's own rows, points against `/games`, ranges and clamping, sam's guard, the Traitors' secret role for riley,
  jordan and casey, a couch you're not on, a show you don't play's episodes, a result accepted since counted on the next read; the Cast tab's views, story, Rank, a pattern, the slider asking again, Compare,
  Share into the chat, `?rank=&from=&to=`; the Stats card, the stats page and its link into Rank; By the numbers and its stats
  page over the hub; sam's slider; the Traitors' Cast). `tests/cast-stats.test.js` (4: facts score as the league they came
  from, ranges, nothing past your mark, the Traitors' secrets). `check-new-show.js` (Cast on real stats), `check-new-reveal.js`,
  `check-new-shell.js`, `check-new-hub.js` and `check-preview.js` pass; so do classic's `check-decision-units.js` and
  `check-tribe-swap.js` (the moved `applyDecision`); `npm test` 477 pass plus the 3 known tour-commissioner failures;
  type-check clean, lint as before.
- **Noticed, left as is:** four things, now in Noticed, not fixed: Traitors 5's cast stores the faction as its tribe (and one
  league on the local copy shows it), the league views still show role-revealing results, "Points" doesn't say whose, and a
  season whose commissioners enter results has no shared stats. Fixed from that list: a show you don't play has only who went
  home (step 2's).
- **For step 4:** Share this and the reveal's Post to the couch write to the first game's chat (the linked group's); step 4
  makes them the couch's.

### As built, step 4 (2026-10-24, on `new-design`)

One chat per couch and show is real. Migration **0110** ships with 0b's (same rehearsal).
- **The scope** (`src/lib/server/couch-chat.ts`): a couch's chat about a season is every message in the couch's games on it
  (`league_id`: classic's linked-group chat, so both designs show the same conversation) plus what was said where the couch
  has no game yet. Migration 0110 makes `chat_messages.league_id` nullable and adds `couch_id` and `season_id` (set only on
  those, with a check that a message has one or the other), and `couch_chat_reads`. Posting goes into the couch's first
  game on the show, so classic shows it and pushes it as before; a show the couch only watches gets the couch and season.
- **The fold, on the server** (`src/lib/game/chat-fold.ts`, pure): once an episode you haven't seen has aired, everyone
  else's messages from its airtime on are sent with no words or reactions (who and when only); your own and the reveal
  lines show. Classic's rule (`SpoilerLogic.chatWindow`) on the season's schedule (`schedule.ts`, kept a minute per server),
  so a watch-only show folds the same way, by your follow's mark. **Show them** (`&unfold=<latest>`) unfolds through the
  episode that was latest when you tapped; what's said once the next one airs folds again. The fold says who the chat's
  own reveal lines say has revealed it.
- **Routes** (`/api/seasons/[id]/chat?couch=`): GET (`&v=` answers `{ unchanged }`, an md5 worked out in the database, as
  classic's; `&unfold=`), POST, `/read` (the couch's mark and classic's `chat_reads` for its games there), `/unread`
  (the badge's count, `&reveal=N` adding who has revealed N), `/[messageId]` PATCH and DELETE, `/[messageId]/react`.
  Your own message, or anyone's for whoever runs a game here or owns the couch; a reveal line only by them; a message in
  another couch's chat is 404. A late joiner catching up (or a ghost) is out of the chat, as classic. A site admin
  who isn't on the couch reads it and can't post.
- **Shared with classic** (`src/lib/server/chat.ts`): `messageText`, `authorName`, `toggleReaction`, `editMessage`,
  `mayChange`; classic's league routes use them and answer as before. **Fixed in classic:** its react route never checked
  that the message was in the league's chat (any member could react to any message id); it does now.
- **The Chat tab** (`src/new/show/chat.tsx`, the mock's tabChat and wChat): day lines, runs of one person (the name and time
  in the first bubble, the face beside the last), yours in bone, reveal lines as "riley revealed Episode 5", reactions under
  the bubble, a message's sheet (six quick reactions, any emoji behind +, Copy, Edit, Delete), the composer above the tab
  bar (grows to five lines, Enter sends, lifted over the keyboard by the visual viewport), opening at the newest and
  following new ones unless you've scrolled up. **One fold** where the first folded message was: "5 messages since Episode
  4 aired", "riley and jordan have revealed it" (else "From jordan. They unfold when you've seen it."), Reveal Episode N
  (when you play) and Show them, both outlines. Polls every 5 s while open (not in a background tab); reading it clears the
  badge here and in classic. "Message the Survivor 51 couch", or "Message the couch about The Traitors 5" on a show the
  couch only watches.
- **The badge and Tonight:** a show space polls the Chat tab's count every 30 s (the open chat's own poll replaces it).
  Tonight's Results are in says "riley and jordan have revealed · chat is folded for you" from the chat's reveal lines: step
  2's Noticed item (who's revealed isn't shown), without sending anyone's progress the chat doesn't already say.
- **Share this (Cast) and the reveal's Post to the couch** write to the couch's chat about the show (`postToCouch(seasonId,
  couchId, text)`), from anyone on a couch with others there, playing or not; on your own, Share this opens the phone's share
  sheet and the reveal's share has only Share image.
- **Backups** take the couch's own chat and `couch_chat_reads` (`backup-common.js` `LATER_TABLES` since 0110; a `--group`
  backup takes the couch's chat about the group's seasons); `backup-fixture.js` has both and `check-backup-restore.js`
  passes, its before-0b copy now without couch chat too.
- **Fixtures and Preview:** deleted `fixtures/chat.ts` and the entry `show.chat`. `new-fixture.js` now seeds the couch's chat,
  timed around episodes 4 and 5 across the three leagues (riley, jordan and sam, their reveal lines, reactions), and a chat
  on the zt Traitors the couch watches without a game; none of it is alex's (`CHAT`, `TRAITORS_CHAT` exported).
- **Changed from the mock:** the fold has its two buttons and names who has revealed (the mock's was one line, "4 messages
  after Episode 5 aired · reveal or tap to show"); bubbles carry the time beside the name; the send button is grey (yellow is
  for what you must do).
- **Checks:** `scripts/dev-test/check-new-chat.js <outDir> [--width=390] [--keep]` (52 PASS at 390 and at 1280:
  one conversation from three leagues, `?v=`, a couch you're not on; sam's fold with no words sent, his own and the reveal
  lines, who has revealed, `&unfold=5` and `&unfold=4`; the badge, reads moving both marks, classic's badge agreeing; a post
  into the first game and classic showing it, editing, removing, reactions, a message from another couch here and in
  classic's react route; the Traitors' watch-only chat for riley, jordan and alex and a post there with no league; in the
  browser: the tab with no Preview, days, reveal lines, opening at the newest above the composer, the badge on Tonight and
  gone on Chat, reading on open, Enter sends, the poll's `{ unchanged }`, a reaction and an edit from the sheet; sam's
  Tonight line, his fold and Show them; riley's Traitors chat). `tests/chat-fold.test.js` (4). `check-new-show.js`, `check-new-reveal.js`, `check-new-stats.js` and `check-new-shell.js` pass at 390 and 1280 (69, 44, 56 and 46/47), `check-new-hub.js` and `check-preview.js` pass; so do classic's `check-chat-polls.js --ui` (its routes now share `chat.ts`), `check-backup-restore.js` and `check-decision-units.js`; `npm test` 481 pass plus the 3 known tour-commissioner failures; type-check clean, lint as before.
- **Noticed, left as is:** five things, now in Noticed, not fixed: chat pushes are still classic's, a couch with two unlinked
  games on one season, the fold goes by airtime, late joiners have no couch chat, only the newest 300 messages. Fixed from
  that list: who's revealed isn't shown (step 2's), on Tonight and in the chat.
- **For step 5:** nothing in chat needs changing for Backstage; a results change the couch should hear about could be a
  reveal-style line in the couch's chat (`couch-chat.ts`), beside Recent changes' own log.

### As built, step 5 (2026-10-25, on `new-design`)

Backstage I is real: results with Ask an AI, applied to every game, trusted ones on their own (5B), Recent changes, and
guards with undo for tiers 1 and 2. Migration **0111** (`league_changes`) ships with 0b's (same rehearsal).
- **Recent changes** (`league_changes`, 0111): one row per league per change, a `batch` per action (results applied to three
  games are one line), who (`user_id`), `kind`, `tier`, the episode, the line everyone reads (`text`, naming nobody who went
  home), `detail`, and `undo` with `undo_until` (the next episode's airtime, else a week). Written by
  `src/lib/server/change-log.ts` in the same transaction as the change, inside a savepoint so a line that can't be written
  never takes the write down: `withLeagueLock(leagueId, mutator, change)` takes an optional third argument, a spec or a
  function of the league before and after the mutation (not the bots' moves or the waiver clock around it).
  `resultsChange` diffs the episode (`src/lib/game/results-changes.ts` `resultsDiff`: eliminations, scoring events, roles,
  groups, exiles added and removed, and the stage before), so **every results write carries its exact undo**, Backstage's
  and classic's alike; `settingsChange` (tier 1, undoable unless the field does more than set a value: show, season, the
  reveal pointer, the waiver suggestion); `setLeagueRole` takes a hook run in its own transaction (`roleChange`, tier 1,
  undoable); `forPlayerChange` logs a move made for someone else's seat and nothing for your own (tier 0); `logChange` for
  writes outside the lock (scoring rules, renaming, linking). Read and undone by `src/lib/server/league-changes.ts`:
  `GET /api/seasons/[id]/changes?couch=` (anyone on the couch; a line per batch, newest first, `undoable` for whoever runs
  every game it touched) and `POST /api/seasons/[id]/changes/[batch]/undo?couch=` (each league under its lock, the row marked
  undone in the same transaction; refused once the next episode has aired, and for results unless it's the newest change
  to that episode: undo the later one first).
- **Classic's writes log too:** every results route (eliminations, scoring events, roles, groups, an episode's edit or
  delete, research apply, a wiki proposal), settings, roles, players (add, edit, remove, a late joiner let in or moved),
  the cast and tribes (`leagueCastWrite` logs each cast change once), waivers (process, undo, window), the catch-up reveal,
  lineup locks, the draft's start, order and take-back, the finale's results, prediction questions, the season's rule
  changes, scoring rules, renaming, linking and unlinking, and lineups, picks and predictions made for someone else. What
  isn't yet is in Noticed, not fixed.
- **Results** (`src/lib/server/backstage.ts`, for whoever runs a game on the couch's season: Commissioner or Game admin;
  a player gets 403, someone off the couch 404): `GET /api/seasons/[id]/backstage?couch=[&episode=][&show=1]` (the open
  episodes, aired and not final in your games, each one's stage; Needs you; the newest who-went-home and full-results
  batches; how many staged results wait; no names until `show=1`, which is Show me: who went home, what applied, what waits,
  and who's still in for entering it yourself), `GET .../backstage/prompt?kind=quick|full` (the quick check is the bot's
  own question, `buildQuickPrompt`, over who's still in; the full one is research's paste prompt, `leagueResearchStatus`),
  `POST .../backstage/results` (an answer pasted back) and `POST .../backstage/apply` (results you chose; `preview: true`
  is the tier-2 dry run). Applying goes through `decision-apply.ts` `applyDecision` into every game you run here that can
  take the episode (a league catching up gets it when it reveals it), one league at a time under its lock, one batch,
  classic's results push for eliminations. Who went home marks the episode early (when nothing else is in); any scoring
  moment marks it final.
- **Option 5B, what applies on its own** (`results-changes.ts`, pure): a quick check applies when it found the episode,
  everyone it names is still in, it says how they left in the show's words and at least two sources agree (`quickVerdict`;
  otherwise it waits with a reason that names nobody: one source, a name we don't know, how they left, nobody left). Full
  results are staged for the season as before (shared, `researchFromPasteForLeague`), then the staged results not in your
  games split by `trustRows`: high confidence, about someone the merged research didn't contradict itself on, and for who
  went home, agreeing with whoever's already out in that episode. The trusted ones apply on their own; the rest wait to be
  ticked. Nothing is shown: the answer says how many, the screen keeps names behind Show me.
- **The screens** (the mock's backstage.js, askai.js, guards.js, refine.js's 5B): Backstage's home has **Needs you** (who
  went home in Episode N, its full scores, N results waiting; else "You're all caught up" with the next airtime) and the
  index (Results' and Recent changes' rows say where things stand; the other four are 6a's, still Preview). **Results**
  (`src/new/backstage/results.tsx`, `?ep=`): Episode N: who went home (the quick check: Ask an AI, or "Watched it? Enter who
  went home yourself"; then a plate with a blurred stand-in, "Applied on its own · Sources agreed · nothing shown to you",
  Show me and Undo; after Show me, Not right), How results get in (Preview, 6c), Full scores (Fill in Episode N, the batch
  that applied with its Undo, what waits with Show me and tick rows). **Ask an AI** (`src/new/backstage/ask-ai.tsx`): the
  three-step track, Open in ChatGPT (the question parked at /b/<code>; Grok the other choice, remembered on the device),
  Another AI? Copy the question, a spoiler note, Paste the answer (clipboard) with its own check ("Looks right: one person ·
  2 sources", "answers for 18 people"), Use this answer; a 409 (another episode's answer) asks "It's right, use it". The link
  text is shared with classic now (`src/lib/ai-brief.ts`). **Guards** (`src/new/ui/guards.tsx`): tier 2's sheet, the
  server's dry run of what changes ("Cristian Chavez out · Outlast: riley loses them", "jordan · Weekly Lineup ▼ 3rd, -3",
  "Everyone · Outlast +2 each", "alex · Survival Pool streak ends"), then confirm, with the undo note; tier 1 is the toast's
  Undo (ui/toast.tsx had it). **Recent changes** (`src/new/backstage/changes.tsx`): "Visible to the couch", a line per
  change (who, when, "moved standings", which games), Undo where you may, "Undone by …" after. The show's ⋯ menu has a dot
  while Backstage needs you (its Backstage row says what) and Recent changes for everyone; Tonight still has no
  commissioner job.
- **Backups** take `league_changes` (`backup-common.js`, a `LATER_TABLES` entry since 0111); `backup-fixture.js` has a line.
- **Fixtures and Preview:** step 5 had no fixture file; deleted the entries `backstage.needs`, `backstage.results`,
  `backstage.history`; added `backstage.results-ways` (6c: How results get in).
- **Changed from the mock:** the quick check has no on/off switch (nothing runs on its own until 6c's bot: here it's one
  question you paste, and when its sources agree it applies without showing you); Needs you's job opens Results at its
  episode; Recent changes strikes through an undone line and says who undid it; the preview folds identical lines ("Everyone
  · Outlast +2 each"); the ⋯ menu's Backstage row names the job.
- **Checks:** `scripts/dev-test/check-new-backstage.js <outDir> [--width=390] [--keep]` (66 PASS at 390 and at 1280).
  `tests/results-changes.test.js` (6: the diff and its undo, a removal, the quick verdict, trust, the preview).
  `check-new-chat.js`, `check-new-show.js`, `check-new-reveal.js`, `check-new-stats.js`, `check-new-shell.js` and
  `check-new-hub.js` pass at 390 (52, 69, 44, 56, 46, 21), and `check-preview.js`; so do classic's checks on the routes that
  now log (`check-waivers.js` 85, `check-foundation.js` with its role route, `check-research-again.js`, `check-decision-units.js`,
  `check-tribe-swap.js`) and `check-backup-restore.js`; `npm test` 487 pass plus the 3 known tour-commissioner failures;
  type-check clean; lint clean in `src` (repo-wide, the new check and test add only the `require()` findings every dev-test
  script and test already has).
- **Noticed, left as is:** seven things, now in Noticed, not fixed: Backstage's results don't reach the shared stats, an
  undone result the admin has accepted since stays out, only Backstage's own paste applies on its own, a quick check that
  waits isn't kept, "nobody went home" can't be marked, what isn't in Recent changes yet, Backstage's setup jobs. Fixed from
  that list: nothing made early results (the bot's half stays, for 6c).
- **For step 6a:** the Members, Settings and Waivers pages' writes already log through the classic routes (settings and
  roles with Undo: `POST .../changes/[batch]/undo` takes them back); their toasts can carry it (`toast(text, { undo })`) and
  tier 3's hold to confirm is still to build (`ui/guards.tsx` is where it goes). Leaving a league as its last commissioner
  isn't blocked yet (0b's As built).

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

### As built, step 6a (2026-10-25, on `new-design`)

Backstage II is real: Simple waivers for players and whoever runs the game, Members & roles, Game settings and Scoring
rules' read side, with tier 3's hold to confirm. No migration, nothing polled or scheduled (HOSTING.md's Changelog).
- **Engine deltas** (`state-logic.js` `WaiverLogic.recommend`): every feel now sets "lowest score first" (`leastPoints`) and
  the fallback pick (`autoFill`) is on for Casual and Balanced, off for Competitive. No running league was changed: a feel
  only applies when whoever runs the game picks it (on the local copy none of the couch's leagues sat on a suggestion, so
  classic's "Customized" label doesn't move for them). The plan's open question (may a player spend an optional swap on
  someone out under No replacements?) is still open: the engine is unchanged there.
- **The player's Waivers** (`src/lib/game/waiver-view.ts`, pure; `GET /api/seasons/[id]/waivers?couch=`,
  `src/lib/server/season-waivers.ts`): per game with waivers, the week from your copy at your mark (a week opened by an
  episode you haven't revealed is only "Reveal Episode N first"), who of yours to replace, your swaps, your team (still in
  first) and who's free with the Cast tab's points and one positive tag (the season's facts, `seasonFactsFor`, so Outlast
  shows real numbers too), your own picks a spot at a time (`readOwnClaim`, yours alone), the picking order (exclusive
  games), the fallback, the last run in picking order with why, free agency's moves, and How it works (three answers and
  the When moves happen lanes, `waiverHow`). Writes go through classic's `/waivers/claims` (`{ spot }`) and
  `/waivers/free-agency`, which now answer `?quiet` with `{ ok }`.
- **The Waivers page** (`src/new/show/waivers.tsx`, `/show/[id]/waivers?game=`): Due and its calm clock, "Replace Carter"
  (yellow) and "Optional · 1 free swap" chips, your whole team with every button Swap (yellow on who's out), a set spot as
  "Sharonda comes in" with its backups and Change, the fallback line, picking order as faces, How waivers work here, and a
  bottom bar that keeps score. One picker for every swap with the Cast tab's own controls (its `EpisodeSlider` and
  `Select`, now exported): ranked by any stat, filtered by group, your pick yellow, backups outlined (exclusive games only,
  behind Choose backups), Clear my pick / Keep X. After the run: what you got, everyone's moves, Free agency (a sheet: who
  comes in, then who goes), Past waivers and Watch the run again. A chip per game with waivers.
- **The run plays like an episode:** Tonight's "Waivers ran" plate (until you've watched it, per device) opens the run's
  reveal (`?page=waivers-run&wv=`: Waivers ran, you got, why not your first choice, everyone's moves, free agency is open);
  Episodes has a row between the two episodes (open: to the Waivers page; run: "You got X for Y · N moves", to its own page
  in picking order, `?page=waivers-ran`). The Games tab's Rules sheet carries the waiver answers and lanes under a game's
  rules (How it works for the league).
- **Backstage › Waivers** (`src/lib/server/backstage-games.ts`, `/api/seasons/[id]/backstage/waivers`; a Game admin's too):
  the week as a plate (what it allows, with no names), Change / Turn off, Open a waiver window (three presets and Something
  else; the couch is pushed as before; Undo on the toast when it opened a fresh week), who's picked (never what), Run now
  (tier 2: a preview of how many picks are in, what happens to anyone who forgot, and free agency, nothing private; then a
  line in Recent changes whose Undo takes the run back while free agency is open, `WaiverRunUndo`), the last run (its moves
  only once you've revealed its episode) with Undo (a run the hourly job made is taken back directly, and logged), Waivers
  settings (one choice of feel applied on tap with the toast's Undo; Fine-tune: the rule, windows and swaps, timing, the
  fallback; a Commissioner's) and What players see.
- **Game settings** (`/backstage/settings`): Weekly Lineup's starters (after the draft the team's size is fixed, so a starter
  comes off the bench; fewer starters trim a lineup already set for the next episode), the bench and Outlast's team
  (steppers before the draft, "Set at the draft" after), Who can join (Anyone on the couch / Nobody new: classic's late
  joiners), each with a dot when changed and Reset to recommended (3 and 2, open); every change one batch with the toast's
  Undo (`settingsSetChange`, a `SettingsSetUndo` of every field it moved). Replacing people who leave links to Waivers.
- **Scoring rules, the read side** (`/backstage/rules`): "Following the Survivor rulebook" (the season's rulebook row when the
  rulebooks flag is on, else the format), How it works over the page, and each game's points: Weekly Lineup by moment (R1's
  `pointGroups` with the game's own points), Outlast and Survival Pool in words (`gameRules`).
- **Members & roles** (`src/lib/server/backstage-members.ts`, `/backstage/members`, `PUT .../members/[userId]`, `POST
  .../members/[userId]/remove`, `POST /api/seasons/[id]/leave`): who runs what (a game's sheet: a switch each, on = Game
  admin; a Commissioner stays one until they hand it on), players named by their seat with their role in each game, a
  member's sheet (Commissioner / Game admin / Player for every game of theirs you run, one batch with Undo). The last
  Commissioner can't step down or leave: refused before anyone holds, in the API (409), and now in classic's `/leave` too
  (0b's As built). **Tier 3** (`ui/guards.tsx` `HoldSheet`): a sentence saying what happens, a button held for 1.4 s (a tap
  does nothing; Space or Enter held works too), "Restorable for 30 days from Recent changes". Taking someone out, or leaving
  yourself (your own sheet, or the show's ⋯ menu for anyone who plays), does what classic's leave does in each game (before
  the draft the seat goes; after it, it's disabled and keeps its team and points) and logs a `MemberUndo` open for 30 days
  (`ChangeSpec.undoUntil`), which restores the seat (reclaimed, or a new one), the role and the mark. Invite is `show.invite`
  (step 9).
- **Recent changes** (`change-log.ts`, `league-changes.ts`): three new undo kinds (`settingsSet`, `waivers`, `member`), a batch
  for `roleChange`, and `undoUntil` per change.
- **Fixed from Noticed, not fixed:** the dock's clock when only a waiver pickup is due (it says the soonest deadline: "Due Tue
  8:00 PM · in 2 days"), and "Points" doesn't say whose (the Cast tab's Rank by points says "Points as Lineup League counts
  them", else "as the rulebook suggests them"; `check-new-stats.js` checks it, 57 PASS).
- **Fixtures and Preview:** deleted `fixtures/waivers.ts` and the entries `show.waivers`, `backstage.waivers`, `backstage.rules`,
  `backstage.members`, `backstage.settings`; added `backstage.make-it-ours` (6b: Make it ours, and changing the points) and
  `backstage.end-game` (10: archive or delete a game).
- **Changed from the mock:** Run now isn't yellow (the week runs on its own when it's due) and its preview says how many picks
  are in rather than who gets whom (picks are private until they run, the commissioner included); no "Extend a day", "Claim
  for them", join request or "Lock it down" (Noticed); Who can join has two choices; Members names people by their seat.
- **Checks:** `scripts/dev-test/check-new-backstage-ii.js <outDir> [--width=390] [--keep]` (116 PASS at 390 and at 1280).
  `tests/waiver-view.test.js` (6); `tests/waivers.test.js`' recommend tests follow the new feels.
- **Noticed, left as is:** seven things, now in Noticed, not fixed: who can join is on or off, no Claim for them, no Extend a
  day, no Lock it down, taking someone out takes them off the couch, the run's seen mark is per device, fewer starters trim
  lineups.
- **For step 6b:** Make it ours and changing the points go on Scoring rules (`src/new/backstage/rules.tsx`, the
  `backstage.make-it-ours` Preview); a points change that rescores the season is tier 2 (`GuardSheet`'s `body` takes any
  preview). `HoldSheet` is there for anything else that's hard to undo.

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

### As built, step 6b part 1 (2026-10-25, on `new-design`): results from everyone and disputes

Every answer anyone sends is a source of its own, shared with every couch on the season; a fact's status follows its
sources and flags; what's trusted reaches every league through the season sync; a correction comes out everywhere with a
line; a house ruling keeps the old result in one couch's games. Migration **0112** ships with 0b's (same rehearsal).
- **Data (0112, additive):** `episode_research` keeps one row per submission (`source` paste / quick / hand / bot /
  autopilot / tiebreak, `submitted_by`, `couch_id`, `covers` = who and what it answered for, `withdrawn_at`) beside the
  per-episode combined row (`source = 'combined'`: what every prompt narrows on and classic reads; the unique index is now
  partial on it, and every reader filters to it). `season_decisions.fact_status` (reported / confirmed / disputed /
  canonical / removed) with `locked_at`/`locked_by`; the old `status` stays the switch for "in every league" (accepted =
  live), so classic, the stats and the sync read it unchanged. Conversion: accepted → canonical (locked), rejected →
  removed (locked), **pending left with no status: never carried, shown, counted or applied** (local copy: 800 canonical,
  238 pending untouched; a newer full answer for an episode withdraws its old unreviewed rows, as classic's restaging always
  did). New `fact_sources` (which submission said yes, and how), `fact_disputes` (who flagged what, why, note, link; open →
  kept / upheld / checked), `league_rulings` (a league's kept version of a corrected fact), `couches.results_by_anyone` (Who
  can fill them in, default anyone). Classic's admin accept and reject dual-write canonical and removed. Backups take the
  three tables (`backup-common.js` LATER_TABLES since 0112; `backup-fixture.js` has a row in each).
- **Settling** (`src/lib/game/fact-status.ts`, pure; `tests/fact-status.test.js`, 9): sources are counted by who sent them
  (a person, or `bot:<run>`), each one's newest answer that covers the fact; an answer is against a fact when it answered for
  that person and kind and didn't report it (who went home answers only for eliminations, a ticked result only for itself).
  Reported = one source and nobody against; confirmed = more for than against; removed = nothing left supporting it, or more
  against; disputed = a split, or a flag no answer has checked yet. Flags are one voice together (they tip a split, never
  outvote the sources) and close as kept or upheld when a later answer settles them. Live: canonical and confirmed; reported
  only when trusted (a high-confidence source and no answer for the episode saying otherwise, which keeps step 5's rule that a
  full answer's second boot waits); disputed keeps what it had ("nothing changes until it's settled"). Methods go by majority
  (an elimination's, a tribe move's); a tie keeps the fact's own.
- **Sending** (`src/lib/server/community-results.ts`): `submit` files the row, upserts the facts (adopting a never-reviewed
  row, leaving an admin's decision locked), adds its sources and settles the episode under an advisory lock; `sendResults`
  then runs the season sync for every league on the season. All of Backstage's paths go through it (`backstage.ts`): the
  quick check (when trusted), entered by hand and "It's right" (`hand`, covering everyone still in), the full paste (now always
  asked about everyone: stored research settles nobody, since each answer is a source; the paste's own parsed answer is its
  row, the combined row is merged as before) and ticking a waiting result (a `hand` vouch: confident, so it applies
  everywhere, where step 5 applied it to the couch's games only). Waiting = reported or disputed and not live.
- **One mode** (`season-decisions.ts`): the sync runs for every season. On an admin season it pushes everything accepted, as
  before; on a `results_by = 'leagues'` season only facts someone submitted (what an admin only curated there stays out, as it
  always did). It marks each episode it changed: final once a scoring moment is in or someone sent the full answer, early
  while only who went home is. The answer's own couch gets one Recent changes line (results.quick / results.full) whose Undo
  (`{ type: "submission" }`) withdraws the answer and syncs again, for whoever runs every game it touched or whoever sent it;
  other couches get no line for an arrival. A **correction** (something a league had, taken out or changed) leaves a
  `results.correction` line in every league it reached ("Episode N corrected"; the facts and each player's points in
  `detail`; no undo). Undo's newest-first rule now skips lines with no Undo of their own.
- **Fixed from Noticed, not fixed:** Backstage's results reach the shared stats; an undone result an admin has accepted
  since stays in (the admin's decision is locked, so withdrawing the answer leaves it); any couch's paste applies on its own
  for every couch on the season (the bot's half is 6c's); a season whose commissioners enter results gets shared stats from
  whatever anyone sends.
- **Anyone fills in:** `fillScope` lets a player send the full results when the couch allows it and they've seen the episode
  (who went home stays with whoever runs the games). Tonight's quiet "Full scores need one paste · Fill it in" (the episodes
  read's `fill`: a player who has seen an episode with only its early results) opens the same Ask an AI sheet ("Thanks! Every
  game on the couch is scored"). Backstage › Results' Full scores: Who can fill them in (a sheet, the toast's Undo, a
  `settings.fill` line) and each recent episode "filled in by riley · Confirmed · 2 sources agree" ("filled in on another
  couch", unnamed, when it wasn't this one).
- **"Something wrong?"** (`flagResult`, `POST /api/seasons/[id]/disputes`; `src/new/show/something-wrong.tsx`): at the foot
  of every episode page, and a ⋯ on each episode of a castaway's story (the Cast tab, whose story now marks "1 source" or
  "Disputed" from the stats read's `unsure`): one sheet in three steps, who (faces with how many results) → which result
  (each with "1 source", "2 sources agree", "you flagged this") or Something's missing → why (Didn't happen / Wrong person /
  Wrong episode / Something else, a note, a link) → Send ("Sent. 1 other flagged this too."). Only once you've seen the
  episode (403 before); one open flag per person per result. `GET /api/seasons/[id]/results/[n]` (`episode-results.ts`)
  serves the episode's facts with their status, leaving out secret roles and role-revealing results for anyone still in.
  Backstage's Needs you asks "A result in Episode N is disputed · one more answer settles it" (no names, so whether or not
  you've watched); Results has a "Check it again" card (Ask an AI about everyone) and Flags from your couch.
- **Corrections and house rulings** (`src/lib/server/rulings.ts`): the Episodes tab's "Episode N corrected" row and the
  episode's Corrected plate ("Eric · Reward win, taken out · Lineup League: you −1.5"); Backstage's Corrections with Keep our
  old result (tier 2, `POST .../backstage/rulings` with `preview`: the result itself, each game's moves and "Your players · See
  the ruling on Episode N"; then one `results.ruling` batch whose Undo drops it) and Drop the ruling (`DELETE`). A ruling
  covers every game of yours the correction reached (linked games together); the sync applies its `keeps` in place of the
  shared fact there; the shared facts and stats never see it; the episode says "House ruling (alex)".
- **Fixtures and Preview:** none added or removed (`show.suggest-fix` is How it works' rulebook fix, part 2;
  `backstage.make-it-ours` is part 3).
- **Changed from the mock:** a player is asked to fill in only once they've seen the episode (the answer says everything);
  a flag settles by the next answer from anyone (6c's tie-break run would send it on its own); "You'll hear how it went" is
  the flag's status in Backstage and on the episode, not a notification (step 15); the Corrected plate says what changed and
  your points, not how many sources and flags agreed; Recent changes says a correction is "From the shared check".
- **Before it ships:** besides 0b's rehearsal, 0112 swaps `episode_research`'s unique index for a partial one, so between the
  migration and the new code serving, an older deploy's research upsert fails (minutes, on a rare action: bot research only
  checks schedules).
- **Checks:** `scripts/dev-test/check-new-community.js <outDir> [--width=390] [--keep]` (82 PASS at 390): two couches on one
  season, the quick check reaching both, a player filling in from Tonight, the couch's setting, flags from the episode page and
  the API, the other couch's check (kept, upheld, split), the correction everywhere, a house ruling and dropping it, the
  sender's Undo, the never-reviewed result never surfacing (and no real season's pending result given a status), the
  screens. `tests/fact-status.test.js`; `tests/episode-research-apply.test.js`'s fake client knows the sync's new queries.

### As built, step 6b part 2 (2026-10-25, on `new-design`): the admin's desk and the rulebook editor

The admin is the exception desk, from the profile menu: an Inbox of only what the couches couldn't settle, one Find over
everything with a page each (Override, Lock, History with undo), and Settings. A rulebook's page is its editor, and a
change saves as Fix a mistake or The show changed. Migration **0113** ships with 0b's (same rehearsal).
- **Data (0113, additive):** `admin_changes` (every desk change: what, its before, and how to undo it; History reads it),
  `rulebooks.locked_at/locked_by`, `season_cast.locked_at`, `show_seasons.rulebook_live` (one season's leagues play by its
  rulebook while the global `rulebooks` flag stays off; `db/rulebooks.js` `seasonLive`), `rulebook_suggestions`. Backups
  now take `rulebooks` and `rulebook_edits` (left out while every rulebook was a legacy mirror; R3's note) and both new
  tables (`backup-common.js` LATER_TABLES; `backup-fixture.js` has a row in each, and a season's and a league's rulebook
  for the two new key cycles). The restore's cycle-breaker now picks only a table that's in a cycle (it used to defer any
  stuck table: `chat_messages` broke its scope check) and a column no CHECK reads first (`rulebooks_owner_shape` needs a
  season's `season_id`, so `show_seasons.rulebook_id` fills in afterwards). A full local backup restores and matches.
- **The desk** (`/desk`, `/desk/find`, `/desk/settings`, `/desk/<fact|season|castaway|couch|person|show|rulebook>/<id>`;
  `src/new/desk/`; `/api/desk/*`, `src/lib/server/desk*.ts`): site admins only (`user.role = 'admin'`; everyone else gets
  403 and "The desk is for site admins"). The profile menu has an Admin row, "N need you", for them (the Inbox is read when
  the sheet opens). **Inbox:** a disputed result no answer is waiting on (a split), a flag a day old that nothing checked
  (where 6c's tie-break run would go first), a couch whose games have players and no Commissioner (a site admin who plays
  one runs it, as in classic), a phase that starts "when the show says so" or "when N are left" on an airing season with
  no confirmed start, and suggested fixes; then the week's self-running numbers. **Find:** shows, seasons and their
  rulebooks, cast, couches, people and results; empty, what's airing.
- **A result:** who said it happened and who didn't (each answer that spoke for that person: who, which couch, how), the
  flags, where it counts; It happened / It didn't happen (previewed, then canonical or removed and locked: every league on
  the season follows, its flags close as kept or upheld), "Something else: edit the fact" (who, how they left, which
  moment: an override in `applied`, canonical), Reopen (a result someone sent: unlocked and settled again from its
  sources), and History's Undo (the row as it was, settled again). Classic's admin accept and reject still dual-write.
- **A season and its cast:** the rulebook (live or not), the groups (one named like a secret role says it gives the role
  away), the cast and each episode's results. **Not a group** takes a faction-as-tribe off the season's cast and out of
  every league on it (each league's tribe removed, with a Recent changes line saying why), previewed; Undo puts it back on
  the same people. A castaway's Override (name, group, photo) writes the season cast and runs the cast sync, so a rename
  reaches every league in place (castaways linked to the season cast, which every real league's are); Lock stops a
  commissioner's cast entry changing them while their game is still making the season's cast (`season-cast-write.ts`).
- **A couch:** its games and who runs each; a game nobody runs is handed to someone who plays it (Commissioner, with a
  Recent changes line); Override who fills in its results. A person's and a show's pages are for looking up.
- **Settings:** Confirmed needs (2 to 4 sources, `app_settings.confirm_at`, read by the settling; changing it settles every
  community result again and syncs only seasons where something moved: canonical ones are never touched), who fills in
  results on new couches (`new_couch_fill`, read by `couches.ts` when a couch is made), where rulebooks are on, History.
- **The rulebook editor** (rulebooks phases 4–6; `src/new/desk/rulebook.tsx`, `desk-rulebooks.ts`): the parts as they read
  now, each opening its own questions and choices from `rulebook-schema.js` (what kind, who's playing, the season's phases
  and finale, each episode's segments with the moments they make switched on or off, ways out with their points, twists by
  type, what scores with its suggested points and added moments), so the editor, the research prompt and the validator
  can't drift. Changes collect as a draft with what's wrong (`blocksProblems`) and what changed (`opLines`) in a bar at the
  foot; Save asks: **Fix a mistake** (folded into the base blocks, and every answer pasted for the season is read again
  with it, `restageSeason`, so every couch is rescored from the start; house rulings keep theirs) or **The show changed**
  from episode N (2 or later, and not before the last change: a `rulebook_edits` row compiled in from N by
  `rulebook-patch.js` `mergeAtEpisode`, so earlier episodes keep their moments and rules). **Leagues play by it** switches
  the season's leagues onto the rulebook (each through `syncLeagueRulebook` under its lock; an unedited one scores the same,
  R3's proof) and back; once on, every save reaches them (as it saves, a league at a time: no `rulebook_pushes` table,
  which R3 expected, since a season has a handful of leagues). Confirm when a phase started (from the Inbox), Read it (How it
  works, all of it), **Check for changes** (R2's rulebook prompt with this rulebook as the starting point; the pasted answer
  reviewed, what it would change listed, Use these changes puts them in the draft), suggested fixes (Fixed it, Dismiss),
  Lock, the Timeline, History with undo (a fix's blocks back; a show change withdrawn), Save as a starting point (a library
  copy with every change folded in). `rulebook-patch.js` (diff, apply, the rulebook at an episode, a change's lines, the
  merge; `tests/rulebook-patch.test.js`, 5) and `db/rulebooks.js` `saveChain` (base and changes compiled as one).
- **How it works** reads the rulebook as it stood at your episode: a change from a later one is counted on the timeline,
  never told, and what it added isn't on the page yet. "Something off? Suggest a fix" is real (what it's about, what's off,
  Send: to the Inbox); `show.suggest-fix` left the Preview registry.
- **Fixed on the way:** `reviewRulebook` left out a custom moment whose words a built one's contain, so checking a
  rulebook again would have offered to delete moments it deliberately has (Survivor's "Learned of an idol or advantage
  privately", five of the Traitors'); `keep` (the rulebook's own moments) stops that, and every season rulebook now comes
  back from the review unchanged. `settleEverything` touched canonical results' episodes and synced every season; it now
  settles only community results and syncs where something moved. A suggestion with no couch stored an empty id.
- **Fixed from Noticed, not fixed:** a split now lands in the Inbox; Traitors 5's faction-as-tribe has its tool (the data
  itself is the user's call, below).
- **Changed from the mock:** a suggested fix goes to the admin (the mock: "if another couch agrees, it's fixed for
  everyone"; community-confirmed changes are noticed below), so Lock's line says couches suggest and you change; Settings
  has no research model, prompts, Autopilot trial or What's New yet (6c and later); a part's Override is the part's own
  editor, and the change's kind is asked once, at Save.
- **Local copy:** the Inbox lists Survivor 51's couch and S49 Active Roster as having no one running them, because the
  copy has no site admin account (their creator's Commissioner seats went with it). On production, open the Inbox once the
  branch ships: a real couch listed there is handed on from its page.
- **Checks:** `scripts/dev-test/check-new-desk.js <outDir> [--width=390] [--keep]` (100 PASS at 390): a commissioner
  refused; jordan's Suggest a fix; the Inbox from the profile menu (a split, a stranded couch, a phase, the suggestion); a
  result decided, undone, removed, reopened, edited; Find, a castaway's Override, Undo and Lock; handing a game on; the
  Traitors' Not a group with its preview and undo; the rulebook's phase, a fix and a show change in the editor, Leagues
  play by it, How it works counting a later change, a fix reaching the games, the change undone, Check for changes, a
  suggestion, Lock, a starting point; Settings; every real league and result as it was; the screens. It makes its own zt
  admin, links the fixture's castaways to the season cast (as real leagues are) and puts back the two settings it changes.
  `tests/rulebook-research.test.js` (keep), `tests/rulebooks-db.test.js` (the season's switch is read).

### As built, step 6b part 3 (2026-10-25, on `new-design`): Make it ours

A couch can make its season's rulebook its own from Backstage › Scoring rules: choose what counts, add moments the couch
answers, take or skip the show's changes, change the points, and follow the season's rulebook again any time. The desk's
fixes and show changes reach the copies, and a correction that adds can now be refused. Migration **0114** ships with 0b's.
- **The copy** (`src/lib/server/ours.ts`): one per couch and season, for the couch's games there that you run as a
  Commissioner (a game on a classic ruleset copy keeps it, and says so). It's a league-owned rulebook (0107) whose
  provenance says `ours`, owned by the first of those games and pointed at by each (`leagues.rulebook_id`), copied with the
  season's in-force show changes and compiled from its blocks (R3: an unedited one scores exactly the same). Those games
  play by it whether or not their season's leagues are on rulebooks (`db/rulebooks.js` `oursOf`; `syncLeagueRulebook` is
  on for a league with one), which is what makes it useful to the real couch today. `pushShowFormat` no longer passes the
  global flag when it's off, which stripped a season switched on in part 2 as well as a copy (fixed). Rules are a
  Commissioner's: a Game admin sees the page, can't change it, and can't undo its lines.
- **What counts:** every moment the rulebook counts, bar ways out (how people leave the game) and the couch's own,
  grouped by the part that builds it; switching one off is `momentNotes[id].off` on the copy (one map, whatever builds the
  moment; the validator lets an off note name a moment a later show change brings). It leaves the compiled rules, so it
  isn't asked and, by a new engine rule, a game playing by a rulebook scores a moment its rules don't have as 0, so the
  results stay and switching it back counts them again. Previewed (each game's moves), then a line with Undo.
- **A moment the couch answers** (Add a moment: what happens, once an episode or every time, suggested points −5 to +5):
  a custom moment answered by the league, on the copy. On each episode's page, once you've seen it, "Your couch's moments"
  lets anyone who plays here tick who did it (tapped again for each time); whoever runs the games settles it alone,
  otherwise two people agreeing do (`src/lib/game/couch-answers.ts`, `tests/couch-answers.test.js`; migration 0114
  `couch_answers`; `src/lib/server/couch-answers.ts`, `GET/POST /api/seasons/[id]/couch-moments/[n]`). What's settled goes
  into every game on the copy as that moment's results (scoring events marked `couch`, replaced as answers change), with
  a line in Recent changes; nothing reaches another couch or the shared stats. Taking the moment out is previewed. A couch
  event scores nothing once its game's rules don't have it (after Follow it again), so Undo brings it back as it was.
- **The show's changes ask first:** the desk's The show changed on a season's rulebook reaches each copy as a draft edit;
  Scoring rules shows it once you've seen its episode ("1 update from Episode 6 · It shows once you've seen it" before,
  and it can't be answered then), with Add it (previewed; in force from its episode) or Skip. The desk withdrawing it
  withdraws it from the copies (out of their games if it was added). The desk's **Fix a mistake** reaches every copy as
  it is: its ops on the copy's base where they still apply, the suggested points and notes key by key, so the couch's own
  choices stay; each game gets a line.
- **Change the points** (Weekly Lineup, a Commissioner's): steppers on each moment, "N moments changed · For the whole
  season", the preview, one line with Undo (`pointsWrite`; points aren't a plain setting, so they have their own line). The
  engine keeps one number per moment, so the season is always scored again (below).
- **Follow it again:** previewed with what goes back (moments you turned off count again, your own moments go, points
  stay as you set them) and each game's moves; the copy is archived, the games follow the season's rulebook if its leagues
  are on it, else their show's rules. Undo brings the copy back.
- **A correction that adds** (from Noticed): a result someone sent (it has sources: the shared check, or the desk deciding
  one) that comes into an episode a game already had final results for now leaves a `results.correction` line ("added");
  one an admin enters by hand (classic's Accept, a fact at a time) is still results coming in, not a correction; Backstage › Results' card says "Added: Ori ·
  Found an idol" and offers "Don't count it in our games", a house ruling whose `keeps.absent` the sync honours (previewed
  through the ledger's own undo). The episode page says it doesn't count in your games.
- **Also:** Scoring rules reads a rulebook as it stood at your episode (it read the base, missing a show change); GuardSheet
  takes a `head` said before the moves.
- **Fixed from Noticed, not fixed:** a couch's own copy now gets the desk's changes; a correction that adds can be refused.
- **Fixtures and Preview:** `backstage.make-it-ours` is gone (check-new-backstage-ii opens the real sheet).
- **Changed from the mock:** no Casual / Standard / Competitive presets and no "From Episode 6" for points (Noticed); the
  couch's answers settle on the episode page, not "after each episode" in a prompt; a moment the rulebook itself switches
  off isn't in What counts (it can't be switched on there).
- **Checks:** `scripts/dev-test/check-new-ours.js <outDir> [--width=390] [--keep]` (89 PASS at 390): following, Make it ours
  in the browser (one copy, three games, couch B untouched, every table the same), what counts with its preview and Undo,
  a moment the couch answers (one waits, sam refused, two agree, a runner settles, the games count it in couch A only),
  the desk's show changes asking first (one hidden until seen) and its fix reaching the copy, Change the points with Undo,
  Follow it again (every table as at the start) and its Undo, refusing a correction that adds, nothing real moved, the
  screens. `backup-common.js` and `backup-fixture.js` take `couch_answers`.

### Step 6c: how results get in

Decided 2026-10-24, mock `bot.js`. Per couch and show-season, three ways, all on bot.gameyourshow.com
(`docs/PLAN-bot-research.md`; "Ask ChatGPT for me" and the bot's schedule are built and experimental):
**Copy and paste** (free, always, anyone on the couch), **One tap** ("Ask ChatGPT for me", $1 a season, one
person unlocks it for the whole couch), **Autopilot** (the schedule, $5 a season, $4 after One tap; disabled,
"coming soon"). Who went home (the quick check) is always free, because it keeps a commissioner
spoiler-safe. Every price shows with a "Free during beta" label and nothing is charged. Setting up a show
with "Ask ChatGPT for me" is free (step 10).

Two parts (decided 2026-10-25): part 1 is the three ways, One tap and the bot's runs as sources, and keeping a quick check
that waits; part 2 is the Noticed items left for 6c: the tie-break run (a scheduled bot run, so its switch is the user's
for Survivor 51), "nobody went home", the show changes the couches confirm, and the desk's Settings for the bot.

### As built, step 6c part 1 (2026-10-25, on `new-design`): how results get in

Results get in three ways per couch and season: copy and paste (free, always), One tap (our bot asks ChatGPT for the couch,
unlocked once for the whole couch, free during beta) and Autopilot (coming soon; on when an admin runs the bot's schedule
for the season). The bot's answers are sources like anyone's, and a quick check that can't be sure is kept until someone
checks it. Migration **0115** ships with 0b's (same rehearsal).
- **Data (0115, additive):** `results_plans` (couch, season, plan `tap`, who unlocked it, `charged_cents` 0 in beta);
  `bot_research_runs.couch_id` / `asked_by` (a One tap is a run, slot `tap`); `quick_waits` (an answer about who went home
  that waits: the season, episode, couch (null: the bot's own), who sent it, how (`paste` / `tap` / `autopilot`), the parsed
  answer, the doubt; closed as right, not-right or replaced). Backups take `results_plans` (`backup-common.js`,
  `backup-leagues.js`, `backup-fixture.js`); waits and runs aren't kept (what was asked, not what was played).
- **One tap** (`src/lib/server/results-ways.ts`; `GET/POST /api/seasons/[id]/backstage/ways`, `POST/GET .../backstage/ask`):
  who went home is free for whoever runs a game; the full results need One tap unlocked for the couch (whoever may fill in
  results can unlock it: a line in Recent changes on each of the couch's games, nothing to undo). The POST answers at once
  with a run and the bot is asked after the response (`next/server` `after`, within the route's 300 s); a run for the same
  episode already going (from any couch: results are shared) is joined, so the bot is asked once. The answer goes through
  `pasteResults(..., { via: "tap" })`: a submission with source `bot` counted as whoever tapped (their voice, like their
  paste), applying what's trusted to every league on the season, one line with Undo in the couch's Recent changes. A full
  answer that reads like another episode's, a bot that doesn't answer, or one that can't be read fails the run with a
  reason. Nothing in a run's outcome names anyone (`PasteResult` lost its names: Show me has them).
- **The sheet** (`src/new/backstage/ask-ai.tsx`): while our bot answers its health check (`askBotStatus`, cached 20 s), Ask an
  AI leads with "Ask ChatGPT for me" (the mock's plate with the chyron bolt; "Free: our bot asks and sends the answer" for
  who went home; "$1 this season" and "Free during beta · Unlock it once for <season> and anyone on the couch can use it"
  while the full results are locked) and "Copy and paste it yourself · Free, always" one row below, which is step 5's
  three-step flow. Tapping it (unlocking first when locked) shows ChatGPT searching (a spinner and a moving bar, still under
  reduced motion; "you can close this, it carries on"); the sheet polls the run and, when it's done, closes with the same
  toasts as a paste. A sheet opened while a run is going joins it ("riley asked", or "Asked from another couch"). A bot
  that's down: the sheet is copy and paste as before. Tonight's Fill it in gets the same.
- **How results get in** (Backstage › Results, replacing the `backstage.results-ways` Preview): the three ways with their
  prices ($1 a season; Autopilot $5, $4 with One tap), "Free during beta", the one in use marked (copy and paste "How you do
  it now"; One tap "Unlocked for this season by alex"; Autopilot "On for this season" with what the bot checks, else
  "Coming soon" and a toast), the unlock sheet (the mock's: $1 for the whole season, nothing charged, Unlock for <season>).
  A card whose pass is being asked says "ChatGPT is looking it up" (the ways poll every 4 s while a run is going).
- **The bot's scheduled runs are sources** (`src/lib/server/bot-results.ts`, `db/bot-research.js` `runJob`'s injected `send`,
  passed by the cron route and classic Admin's Run now): a quick check that can be trusted (`quickVerdict`) and every full
  run are submissions with source `autopilot` and nobody behind them (one voice, `bot:autopilot`: a later run's answer
  replaces an earlier one's), reaching every league on the season; no couch gets an arrival line, only corrections. A full
  run's answer is checked against the episode first (`checkEpisode`: one about another episode is a failed try). Full
  scores say "filled in by our bot" (`fillState`'s `bot`). Survivor 51's schedule is unchanged (only the schedule check),
  so nothing new runs on production; the user decides any quick or full runs.
- **A quick check that waits is kept** (`src/lib/server/quick-waits.ts`): pasted or One tap, it waits on that couch; the bot's
  scheduled one on every couch with a game on the season, and counts as a failed try so the bot asks again (the quick
  check's retry pace). Backstage's read carries `episode.wait` (the doubt, how many sources, who sent it, no names) while
  nobody's who-went-home is in, and `shown.wait` (the names, their faces and how they left) with Show me; Needs you says
  "An answer waits". It's right and Not right send `wait: { id, right }` with the apply, which closes it; a newer answer
  replaces it; "couldn't find it yet" isn't kept.
- **Also:** `restageSeason` re-reads only full answers (a quick one, the bot's now included, says only who went home); the
  desk names a One tap source "asked our bot (One tap)"; `sendResults` says how many leagues it changed (`leagues`).
- **Fixed from Noticed, not fixed:** the bot's quick check applies (the bot's runs are sources); a quick check that waits is kept
  and shown in Backstage.
- **Fixtures and Preview:** `backstage.results-ways` is gone; no fixtures added.
- **Changed from the mock:** One tap's done state applies the answer the way a paste does (5B: what the sources agree on applies
  on its own and nothing is shown) instead of showing the answer with "Use this answer", so a commissioner who hasn't watched
  stays spoiler-safe; the Quick check card has no switch for the bot (Noticed); the ways list is buttons with radio dots, as
  the mock's, but only One tap's (unlock) and Autopilot's (coming soon) do anything.
- **Testing seam:** a dev server takes the bot from a request's `x-gys-bot` header (`ask-bot.ts` `botFor`: `next dev` only, a
  loopback address only), so a check asks its own stand-in (`scripts/dev-test/fake-bot.js`) instead of ChatGPT or
  production's VM; `browser.js`' `api()` takes `headers`.
- **Checks:** `scripts/dev-test/check-new-results-ways.js <outDir> [--width=390] [--keep]` (89 PASS at 390): the ways, a bot
  that's down, One tap for who went home (joined, applied everywhere, a source by whoever tapped, Undo), waits kept (One tap
  and pasted; It's right, Not right, not found), the browser (How results get in, the unlock sheet, the One tap sheet, searching,
  applied, a wait, the full results locked, copy and paste, unlocking with one tap), the full results (couch B still locked,
  sam refused, a bot that fails), jordan's Fill it in with One tap, and the bot's schedule (an unsure quick check waits on
  every couch and is retried, the sure retry and the full run reach every league, "filled in by our bot"). Its test clock
  sits near the real one (the season is moved so Episode 6 ended six minutes ago): retries count from when a try really
  started. `check-new-backstage.js` (67) and `check-new-community.js` (82) tap "Copy and paste it yourself" when One tap is
  offered, and step 5's unsure answers are now kept.

### As built, step 6c part 2 (2026-10-25, on `new-design`): settling without the admin

What part 1 left for 6c: the tie-break run, "nobody went home", the show changes the couches confirm, and the desk's
Settings for the bot. Migration **0116** ships with 0b's (same rehearsal). Survivor 51's schedule is unchanged (only the
schedule check), and the tie-break switch is off, so nothing new runs on production when this ships.
- **Data (0116, additive):** `season_decisions.kind` takes `noexit` (no castaway: `castaway_name ''`; the shape CHECK has a
  row for it); `bot_research_runs.kind` takes `tiebreak` and `rulebook`; `rulebook_edits.source` takes `community`;
  `rulebook_notices` (one per season episode whose research said the show changed: research's note, its status open /
  checking / added / not_new / desk, the edit it made, the bot's run) and `rulebook_notice_votes` (one per person, with
  their couch). Neither new table is backed up (like `quick_waits` and the bot's runs: what was said about a note; what it
  added is kept in `rulebook_edits`, which is).
- **Nobody went home:** a shared fact of its own. The engine's "has results" counts the league episode's `noExit` mark
  (`EpisodeLogic.hasResults`, `setNoExit`; cleared with the spoiler hiding), so the episode is early with nobody out;
  `decision-apply.ts` applies it and its ledger undoes it; `resultsDiff`/`undoResults` record and restore it; the preview
  says "Nobody went home in Episode N". Settling (`fact-status.ts coversFact`): any answer about who went home speaks to
  it, so a quick check or hand entry naming someone counts against it, and saying nobody went home (it covers
  `["elimination", "noexit"]`) counts against whoever someone else said left. A full answer that names nobody out reports
  it (`community-results.ts withNobodyOut`, for a show with ways out: the paste, One tap, the bot's runs, and the season's
  re-read). Backstage's by-hand sheet has "Nobody went home" (`Chosen.nobody`), and It's right works for a quick check
  that says nobody left (a "nobody" answer still always waits: two sources aren't enough to trust it on its own). The
  desk, corrections and the episode's results name it "Nobody went home" (no face, no edit). The Survival Pool decides an
  episode once nobody went home too (`PickEmLogic.decided`, `pool-view.ts`, `action-items.js`: every pick survives).
- **The tie-break run** (`db/bot-research.js` `tiebreakNext` / `tiebreakQuestions` / `planTiebreaks`): when an episode has
  a result disputed (sources split) or a flag no answer has come in since, the bot asks the episode's full research once
  more, a day after the question opened (the oldest flag since the newest answer; for a split, the answer that split it),
  as a source of its own (`tiebreak`, nobody's: `bot-results.ts`), with a full run's retries (three, 20 minutes apart,
  counted from when the question opened). A split a tie-break already answered stays the admin's; a flag raised after it
  gets one of its own. It's planned with the scheduled runs in `planRuns`, so the cron route's `next` tells the VM's
  clock when one is due and nothing else wakes the database; every season is covered, whatever its schedule, behind the
  desk's switch (`app_settings 'tiebreak'`, **off by default**: switching it on reaches Survivor 51 too, the user's call).
  A flag (production only) and the switch tell the clock at once (`desk-bot.ts nudgeBotClock`, `tellBotClock`).
  Backstage's question card says "If nobody checks it, our bot does Mon 1:50 PM", and the Inbox holds a split or stale flag
  back while its tie-break is still to come ("the sources split, the tie-break run too" once it has had its say).
- **Show changes the couches confirm** (`src/lib/server/show-changes.ts`, `GET/POST /api/seasons/[id]/show-changes/[n]`,
  `src/new/show/show-change.tsx`; the mock's rulebook.js rbNewCard): when an answer for an episode carries research's
  `rulesNote`, its page shows "Something the rulebook doesn't have" to anyone who plays on a couch there and has seen it:
  It's new / Not new. Voices are counted by couch (its newest answer; a couch whose own research said so counts as saying
  it's new, and so does our bot's research, as one voice). Confirmed needs of them (the desk's number, 2) and more than say
  it isn't: our bot works out what to add, after the response (the rulebook prompt with the season's rulebook as it is and
  the note, `buildRulebookPrompt`'s new `change`; reviewed, and only what it **adds** is kept: a twist, a way out, a
  segment or a moment), saved as The show changed from that episode (a `community` edit, compiled, pushed to the leagues
  following it, couches with their own copy asked first, answers re-read from that episode), with a line and Undo in the
  rulebook's History; the card polls every 4 s while it's added and then says "It's in the rulebook now". More saying it
  isn't: put away. A split, a locked rulebook, a change before a later one, or anything the bot can't add: the Inbox
  ("something new in Episode N?"), and the rulebook's page has It's in now / Not new. A notice whose edit the desk withdraws
  goes from the page. Lock's line on the rulebook page now says what it holds back.
- **The desk's Settings** (`src/lib/server/desk-bot.ts`, `desk.ts`): Tie-break run (a sheet: on or off, what each means, and
  the airing seasons it reaches), and **Autopilot trial**: the seasons whose bot schedule is on and what each checks.
  A season's page has its schedule (`GET/POST /api/desk/seasons/[id]` `{ bot }`): the bot on or off, each run on or off
  (its own, and the usual ones it hasn't got, added when switched on), its latest runs; each change a History line with
  Undo, the same columns classic's Admin › season › Setup edits. Research model and prompts aren't here (Noticed).
- **Fixed from Noticed, not fixed:** no tie-break run; "nobody went home" can't be marked; show changes aren't
  community-confirmed; the desk's Settings had nothing for the bot.
- **Fixtures and Preview:** none added or removed.
- **Changed from the mock:** the mock's "a tie-break check runs tomorrow" for a show change the couches split on is the
  desk's instead; the mock's card says what the change is ("a Block a Vote advantage"), ours quotes research's note; a
  "nobody went home" quick check always waits for It's right.
- **Checks:** `scripts/dev-test/check-new-settling.js <outDir> [--width=390] [--keep]` (96 PASS at 390): nobody went home by
  hand in the browser (the preview, every league, Show me, Undo) and It's right on a quick check that says so; a split with
  casey's full answer and the Inbox while the switch is off; the tie-break (the switch is the desk's, the clock's `next`, the
  Inbox holding back, three failed tries then the desk's, a new answer opening it again, the run settling it with a
  correction line, a later flag's own); the show change (sam refused, jordan's Not new in the browser, the split in the
  Inbox, alex's It's new and the bot adding only the twist, the History's Undo, a locked rulebook sent to the desk and put
  away there, two couches saying Not new); the desk's Settings and a season's schedule in the browser; every real league
  unchanged. It stops if another local season has bot research on or a question open (the tie-break plans every season).
  `fake-bot.js` knows the rulebook prompt (kind `rulebook`). `tests/bot-research.test.js` (`tiebreakNext`),
  `tests/fact-status.test.js` and `tests/results-changes.test.js` (nobody went home).

### As built, step 7 (2026-10-25, on `new-design`)

The draft room and the blind draft are real, on the leagues' own drafts, which ends parity. Migration **0117**
(`draft_queues`) ships with 0b's (same rehearsal). The couch's real leagues were never touched (their drafts are done).
- **Engine** (`state-logic.js`): a turn-based draft keeps its own log (`draftLog`: the pick number, who, whom, `by` when
  someone made it for them, `auto` when the timer did), stamps when the turn on the clock began (`draftTurnAt`; a start by
  hand also `draftStartedAt`), and each pick clears a nudge (`draftNudge`, one a turn). `draftToCurrentTurn(s, id, { by,
  auto })`; a take-back drops its entry. Settings `draftTimer` (0 off, 120, 60) and `draftAway` (wait, queue). Classic's
  picks log the same way; a draft from before the log shows its picks without names.
- **The view** (`src/lib/game/draft-view.ts`, pure): each game with a draft, for one viewer at their mark: snake or blind, the
  phase (waiting, live, done), the seats in order, the cast by tribe (points once an episode has scored), every pick's
  owner, the picks with who made them for someone, the clock (since, when the timer runs out, nudged), owners, teams, your
  queue, Undo last pick's availability; for a blind draft who's locked in and your own picks back to you, and nobody's
  team before the reveal. A late draft past results you haven't revealed asks you to reveal them first.
- **The writes** (`src/lib/server/draft.ts`) are shared by classic's league routes (`/draft/pick`, `/draft/force-start`,
  `/draft/blind/lock[/id]`) and the new `GET/POST /api/seasons/[id]/draft` (`season-draft.ts`; POST pick, lock, unlock, queue,
  start, order, settings, undoLast, nudge, expire, answering `{ ok, batch }` and never the league). A Game admin can pick
  and lock in for someone (classic too); Start, the order, the settings and Undo last pick are a Commissioner's. A pick made
  for someone is a line in Recent changes with Undo while it's still the draft's last (`DraftPickUndo`), a lock-in for
  someone a line naming no picks, and Start, the order, the settings (with Undo) and Undo last pick lines too. A pick meant
  for an earlier turn, a castaway someone has and someone else's turn are refused with the reason (classic's pick used to
  do nothing). Your queue lives in `draft_queues`, read for your own seat only (like `blind_draft_picks`), and is backed up
  with the league.
- **The pick timer has no job.** When a turn's time runs out, a phone in the room posts `expire`; the server checks the clock
  and, with "Pick from their queue", drafts their first still free (a line nobody made, with Undo); otherwise the draft
  waits. Whoever runs the game then sees "sam hasn't picked yet · Time's up" (or, with no timer, after 3 minutes) with Nudge
  (one push, once a turn) and Pick for sam. Polled while open (HOSTING.md): 4 s live, 15 s waiting, not once done.
- **The screens** (`src/new/show/draft.tsx`, `/show/[id]/draft?game=` and `/blind?game=`): the draft room (the ticker of recent
  picks with "by alex", the clock card that pulses yellow on your turn, the order as faces, Available / Teams / Your queue,
  tribe chips and Show taken, stars, the confirm bar, "Helping riley? Pick for them" and its for-bar, Draft settings: the
  start time, the pick timer, what happens when it runs out, Shuffle and Undo last pick), before the start (the order with
  Shuffle, Pick a time, Start the draft now, the cast to star), Draft complete ("Couch Cup is set", how many picks were made
  for someone else, the teams rising in), and the blind draft (who's in, your slots, Lock in, Change, Pick for someone left,
  then the teams turning over, once per device). Tonight's cards and the dock go to the room with `?game=` (a draft due first
  makes the dock's button "Draft"), and the ⋯ menu's Draft room and Blind draft rows show only for games with that kind of
  draft, with where each stands (read when the menu opens).
- **Backstage:** "Schedule the Outlast draft" in Needs you (a Commissioner's, until the draft has a time or starts), to the
  draft room. **Pick for them** in Backstage › Waivers beside anyone without picks in: their week as they'd see it (their
  spots and who's free, never their picks; your own mark guards it), one spot sent for them (`claimView`, `claimFor` through
  `saveClaim { spot }`), a line naming nobody picked. Classic's claim for someone is open to Game admins and logged too.
- **Fixed from Noticed, not fixed:** a draft pick made for someone wasn't logged; no Claim for them; Backstage's setup jobs
  (the draft's; the rest wait for 9 and 10); the commissioner tour's test (it predated the tour's rebuild on Survivor 51: the
  league starts with no cast and `stageResults` takes the episode; rewritten, and its "opens Episode 2" dropped, since the
  tour's own schedule opens it).
- **Fixtures and Preview:** deleted the entries `show.draft` and `show.blind` and the placeholder page (`ShowPageScreen`); no
  fixtures were step 7's.
- **Changed from the mock:** Pick for X sits on the clock card only once a turn drags on, with a quiet "Helping X? Pick for
  them" under it before that (whoever runs the game can always pick); the away rules are two (Wait for them, recommended;
  Pick from their queue) and show only with a timer; the blind draft's "Reveal now (admin)" is Pick for sam (it locks in for
  whoever's left; nothing reveals without everyone); the screens before the start aren't in the mock; picks show the overall
  pick number ("Round 2 · pick 7").
- **Checks:** `scripts/dev-test/check-new-draft.js <outDir> [--width=390] [--keep]` (90 PASS at 390) on the new
  `draft-fixture.js` (a zt couch about to draft: Outlast's turn-based draft in the mock's order and Weekly Lineup's blind
  draft, 4 each, neither scheduled) and new-fixture.js for Pick for them. `tests/draft-view.test.js` (7);
  `tests/tour-commissioner.test.js` passes again (527 of 527); `check-backup-restore.js` covers `draft_queues`.
- **Noticed, left as is:** pushes open classic's pages (worth settling before the couch switches), the pick timer needs
  someone in the room, the draft's points are the game's.
- **The switch:** steps 1–7 are done. Switching the couch means the branch reaches production: a fresh backup and the Neon
  branch rehearsal of every branch migration (0b's As built: the user's terminal), merging `new-design` into master and
  deploying, then `ui='new'` for the three members, classic one tap away, and a week's watch before step C. **Asked on
  2026-10-25, the user chose to carry on: steps 8–15 are finished on the branch first, then one merge and the switch.**

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

### As built, step 8 (2026-10-25, on `new-design`)

The hub is on real data: the status line, Up next, your shows, the feed, your numbers and More on the couch's pages.
Migration **0118** (`show_follows.early_night`) ships with 0b's (same rehearsal). Nothing polls or runs on a schedule
(HOSTING.md: the hub's open is now two reads).
- **Results lead** (from Noticed): `/api/me/home` shows carry `results` (pure `src/lib/game/results-due.ts`: `stageAcross`,
  `latestIn`, `resultsDue`, shared with `season-episodes.ts` so both agree): the next episode to reveal and its stage, and
  the morning update's episode. The status line leads with "Results are in · Survivor Episode 5 · 2 moves due" (yellow
  dot), then moves due, then "Final scores are in" (teal), then You're all set. **Up next is needs-you first**: a show
  with results to reveal (its plate "Reveal · Episode 5 results are in", the one yellow, tapping to the show's Tonight,
  which leads with the reveal; a reveal is chosen there, never from the hub), then the show your soonest move is for,
  then on now, then the soonest airing with its calm time; the morning update's plate is teal.
- **The morning update** (from Noticed): revealing an episode early keeps your first Weekly Lineup's night on
  `show_follows.early_night` (the total, your starters' points, the table) beside `early_seen`; once its final scores land,
  Tonight's Morning update plate and the dock's See open a **sheet** (`MorningSheet` in `show/reveal.tsx`, the mock's
  stages.js finalUpdate) instead of the reveal again: "So far last night 0 › Final +1", Added this morning (each starter
  whose points rose, with why), the Weekly Lineup table moving from that night to final (`SeasonReveal.soFar`; the
  reveal's table takes its before from the early night). Opening it is seeing them: it asks the reveal again, which
  clears both columns. Classic's reveals still never set either.
- **The couch's numbers**: `GET /api/couches/[id]/hub` (`src/lib/server/couch-hub.ts`) reads every game on the couch as you
  may see it (`GhostLogic.viewFor` at your mark on its season, so a place, title or streak is never past where you are,
  and a season ends for you only once you've seen it end; a game nobody's scored yet as far as you've seen doesn't count),
  then pure `src/lib/game/couch-standings.ts`: **power rankings** (each game gives its players `placePoints`: 10 for first
  down to 1 for last, normalised to the field, ties sharing the better place, so every game type weighs the same; a running
  game counts where it stands; This year by the season's premiere year; who moved, against each game one episode back;
  only people on the couch are ranked, computer players take places), **head to head** (every game you both play: above,
  below, level), the **trophy shelf** (only once a season the couch played has ended: titles incl. shared firsts, a plaque
  per finished game with who won and by how much on points, Ran it back when the same person won the show's previous
  season of that game on the couch, records: most titles, ran it back, longest pool streak, best average finish), **your
  numbers** and **couch accolades** (most shows on their list, the most-watched show, called it most, says the most this
  month, on a streak: only shared follows, each only when it says something). Plus `games` (each of your games on the couch
  with your place and whether it's ended) and **the feed**: the newest 40 messages of the couch's chats (each season's fold
  on the server, as the chat folds: others' words since an episode you haven't seen aired are left out; reveal lines show,
  as in chat; nothing for a late joiner catching up in that season's games), who joined a couch that was already going (not
  its founders, not you) and who started watching something openly they don't play, newest 8.
- **The hub's screens** (`src/new/hub/`): the status line and Up next (`sections.tsx`, with `data-status`/`data-upnext`);
  **posters** ordered soonest airing first, each with your best place ("Best 1st", finished seasons too) and a corner that
  flips it (a 3D turn, transform only) to your games there with your place in each and Open; **On the couch** (messages
  with their reactions, revealed, joined, started watching; each opens that show's chat or Tonight; "Open chat");
  **More on the couch** rows only once they have something (rankings after a scored episode, Previously on once you've
  started a show, the trophy shelf once a season has ended) with live lines ("You lead the couch this year", "You're 2nd ·
  12 back of riley", "3 games you're in · join any", "1 title · 3 seasons played"); the pages (`couch-pages.tsx`):
  rankings (the big place, This year / All-time / Head to head, bars by show), Commercial break (You're playing: your
  running games with your place, or yellow "Due Tue" with the move; This week only and Start a game stay Preview),
  By the numbers (a couch accolade or two in the deck, a different pair each day, and every accolade under On the couch),
  Previously on (one show at a time from its `/episodes` and `/stats`, both guarded: the cold open with "Up to Episode 5 ·
  nothing past it", Last time as the vote-out card, the boot order as faces, still in by group, a secret faction as one
  "Factions stay secret" group, episode by episode; a show without cast data gets its last episode as large type), the
  trophy shelf (titles as the big number, plaques, records with who holds them). The **profile** has your numbers on this
  couch (titles, this year's ranking points, seasons played, your best show, your place, best finish, predictions called).
  The **grow note** turns each promise into a way to its page once it's there.
- **Fixtures and Preview:** deleted `fixtures/hub.ts` and the entries `hub.profile`, `hub.feed`, `hub.grow-note`,
  `hub.rankings`, `hub.break`, `hub.numbers`, `hub.previously`, `hub.trophies`. `hub.verdicts` moved to step 12 (its
  fixture to `fixtures/verdicts.ts`, STEP 12, with the taste twin); new `hub.taste-twin` (12, the profile's line),
  `hub.episode-games` (12, Commercial break's This week only; `HUB_THIS_WEEK` in `fixtures/episode-games.ts`) and
  `hub.start-game` (10). Previously on's Watch along button reuses `hub.watch-along` (13).
- **Changed from the mock:** the mock's posters no longer flip (a tap opens the show; its rear face is left over), so the
  flip is the corner cue's and the rest of the poster opens the show; 1st places aren't yellow (the yellow rule); the
  rankings' arrows compare each game one episode back (the mock's were made up); "Biggest comeback" isn't a record (it needs
  the standings' history: Noticed); couch accolades are the ones the couch's data can say today (taste twins, reactions,
  ratings and watch alongs wait for steps 12-13: Noticed); the feed has no "is typing" line and its reactions only show
  (tap opens the chat); the profile's third number is Seasons played (Agree with the couch needs ratings); Previously on's
  rows open the show's Episodes tab (an episode page can't open from a link yet: Noticed).
- **Checks:** `scripts/dev-test/check-new-hub.js <outDir> [--width=390] [--keep]` (75 PASS at 390) on new-fixture.js plus the
  new **`hub-fixture.js`** (ZT Survivor 49 and 50 finished on the couch: riley won both Outlasts, alex Survival Pool 50):
  rankings recomputed from each season's own `/games` tables (all-time, this year, head to head), the trophy shelf and
  records, your games and numbers, accolades (jordan's private follow left out), the feed's fold (the Traitors for alex,
  Episode 4 on for sam), sam's rankings at his mark, the home's results, a 404 off the couch; then the browser: every shape,
  the status line and Up next a week behind, posters' best place and flip, the feed, every row and page with real data, the
  profile, the grow note's links, every `hub.*` entry still rendering, the channel change. `check-new-reveal.js` now holds
  Episode 5's scoring back at the early stage and checks `early_night` and the morning update's sheet (49 PASS);
  `check-new-shell.js` taps a Preview that's still one; `check-new-stats.js`' By the numbers has no Preview left.
  `tests/couch-standings.test.js` (5: place points, rankings and moves, the trophy shelf and records, accolades,
  results due). The hub check passes at 1280 too; and the rest pass: check-new-show (69), -shell (46), -stats (57), -chat
  (52), -backstage (67), -backstage-ii (116), -community (82), -desk (100), -ours (89), -results-ways (89), -settling (96),
  -draft (90), check-foundation and check-preview; `npm test` 532 of 532; type-check clean, lint as before.
- **Noticed, left as is:** five things, now in Noticed, not fixed: Biggest comeback, the accolades that need later steps,
  Commercial break lists only your games, your numbers are per couch, an episode page can't open from a link.
- **For step 9:** the couch switcher (`hub.couch-switcher`), Get the couch going and the foot are still Preview; the hub
  read is per couch (`useCouchHub(couch.id)`), so switching couches is switching that id. Joining a game from Commercial
  break (Noticed) belongs with the join flow.

### Step 9, in three parts

1. **Couches and joining their games** (done, below): start / join / switch / leave a couch, invite codes, the couch
   switcher, a couch's details, Get the couch going and the foot, the invite page for someone signed in, Settings' couches,
   Invite from a show and from Backstage, joining a game mid-season by its Who can join (open / Ask me first / Nobody new),
   requests in Backstage, live starts and catching up, and the Noticed items that were 9's.
2. **The way in** (done, below): the landing page, first run (shows, where you are, save your shows, your people: `start.steps`), the
   invite page signed out (`join.couch`: the couch first, then an account, then where you are), the real sign-in screen,
   and Google sign-in through Better Auth behind config (no client id: no button; the user creates the OAuth app).
   Mock: `landing.js`, `round2.js`.
3. **Solo** (done, below): the public pools per season ("Survivor 51 · Everyone": Survival Pool and predictions, usernames
   only, no chat) and the practice couch against computer players (Easy / Normal / Sharp, `bot-logic.js`). Mock: `solo.js`.

### As built, step 9 part 1 (2026-10-25, on `new-design`): couches and joining their games

Migration **0119** (ships with 0b's, same rehearsal): `couch_members.via` ('game' | 'couch') and `game_join_requests`.
Nothing polls and nothing runs on a schedule (HOSTING.md).
- **Being on a couch** (`couches.ts`): someone is on a couch because they play one of its games (`via 'game'`: 0101's
  backfill, classic's joins, healCouches) or in its own right (`via 'couch'`: they started it, joined it with a code, or
  were taken out of its games in the new design). Classic's leave still takes a 'game' member off once they're in none of
  its games (`pruneMembers` only touches 'game' members); the new design's Leave these games and Backstage's Take out keep
  them on it (`stayedOnCouch`, from Noticed: "the mock says they stay on the couch"); a league deleted in classic takes its
  couch only when it has no games and nobody on it. Leaving the couch is its own action.
- **`src/lib/server/couch-joins.ts`** (`/api/couches`, `/api/couches/join`, `/api/couches/invite/[code]`,
  `/api/couches/[id]/invite|leave|games|games/[leagueId]|requests/[requestId]`): start a couch (a name up to 40, you own
  it, at most 25 couches each), your own invite code per couch (six characters from 32 with no I, O, 0 or 1; "riley saved
  you a seat" is whoever's code it is), what a code opens on (open signed out: the couch, its faces, its running seasons'
  games and who may join each; nothing about results), joining with a code (a couch's invite, or any of its games' classic
  join codes), leaving (tier 3: out of its games too through 6a's `takeOut`, each restorable from Recent changes for 30
  days; never as a game's last Commissioner; the owner's role passes on; a couch with nobody and no games goes).
- **Who can join** (engine, `GhostLogic.joinMode`, `settings.joinMode`): open (anyone on the couch), ask (Ask me first) or
  locked (Nobody new). Recommended by ownership: castaways on several teams, or no teams at all (Survival Pool), are open;
  exclusive ones ask (an exclusive game can't be open). Classic's late-joiner switch stays in step (locked = off) and its
  off wins. Backstage › Game settings has the three (two for exclusive), saved at once with Undo (from Noticed: "Who can
  join is on or off").
- **Joining a game** (`joinGame`): before a game's underway, classic's join (into the draft); coming back to a seat you
  left, your seat (classic's reclaim). Underway: shared games start live (the next episode) or catch up from the first;
  exclusive ones start live with a team of free agents only (`GhostLogic.begin(..., { freeAgents })`). The new player is a
  late joiner made visible at once (`GhostLogic.convert`: on the couch, joining isn't hiding). Catching up, the league
  mark is the episode before the start; live, it stays at where you are (you reveal the rest as anyone behind does, so a
  live join never moves your mark). The join sheet warns that a live start shows who's still in when you're behind.
  Recent changes logs every join and let-in (from Noticed: "invites and late-join starts").
- **Ask me first**: a request (`game_join_requests`, one open per person and game, take it back any time) reaches whoever
  runs the game as a Backstage Needs you row (Let in, or decline quietly) and a push; a let-in is theirs to use once (they
  then pick where they start and their team themselves) and pushes them. Backstage's Needs you also has "Invite people to
  <game>" for a game with fewer than two players before its draft (from Noticed: "Backstage's setup jobs").
- **Catching up** (`GameView.catchUp`, `POST /api/seasons/[id]/catchup`, `catchUpReveal`): Tonight's strip ("Catching
  up · Episode 2 of 5"), a sheet with your move for that episode (Your moves, at that game) and "I've watched it · Reveal
  Episode N" (one episode, in that game, which moves your linked games in step), what happened, then the next. Catching-up
  games are left out of the season's "Results are in" (hub and show) so there's one way to each episode, and Tonight's
  plate gives way to the strip when they're in step.
- **The couch chat** lets in a late joiner the games can see (`hiddenFromGroup`; the fold keeps it spoiler-safe); only a
  hidden ghost (classic's join) stays out; the hub's feed follows (from Noticed: "Late joiners have no couch chat").
- **Screens** (`src/new/couch/`): `couch-sheets.tsx` (one host in the signed-in layout, `openCouchSheet` from anywhere: the
  switcher, a couch's details with its members, your code on a plate with Copy and Send the link, seasons together and
  Leave, Start a couch, Join a couch's six code boxes, the leave hold) and `join-game.tsx` (each game's row with Join / Ask
  to join / Asked · Take back / Locked / Open, the join sheet: where you start, then Pick your team; the catch-up strip and
  sheet). The profile's couch line opens the switcher (and "No couch yet" with none); Get the couch going (Invite more
  people with your code; Start a game and Add the other shows stay Preview for step 10) and the foot (Join a couch real,
  New league Preview for 10); Commercial break's Join a game (from Noticed: it listed only your games); a show's Games tab
  lists the couch's games there you're not in; the show's ⋯ Invite to this show; Members & roles' Invite; Settings' Your
  couches; `/join/[code]` (signed in: Join the couch, then its games; signed out: the couch and its games, the account step
  still Preview for part 2). The home read now carries each couch's seasons (the switcher's "ZT Survivor 51 · 5 people").
- **Fixtures and Preview:** deleted `fixtures/couches.ts` and the entries `hub.couch-switcher`, `hub.get-going`,
  `hub.foot`, `settings.couches`, `show.invite`. Left for part 2: `start.steps`, `join.couch`.
- **Changed from the mock:** the switcher's couch details are a sheet of their own (the mock's couchSheet) with Leave at
  its foot; "Run it back" (Seasons together) is step 10's Start a game, so it isn't there; a new couch's code shows after
  Start (the code is made by the server); the code plate copies the code and Send the link shares `/join/CODE`; Join on the
  invite page is the one yellow (joining is the page's point), on Commercial break it's an outline (optional); joining
  the couch is a tap on the invite page, not automatic on opening it; "Asked" has Take back; the seasons-together dot isn't
  yellow (the yellow rule).
- **Decided:** your numbers on the profile stay per couch, and the switcher switches them (Noticed asked); a couch-only
  member is in the couch chat; leaving a couch takes you out of its games (a couch member with games elsewhere on it would
  otherwise be a player nobody on the couch can see).
- **Checks:** `scripts/dev-test/check-new-couches.js <outDir> [--width=390] [--keep] [--api]` (114 PASS at 390, on
  new-fixture.js plus newcomers zt_nd_kat and zt_nd_lee): codes, the invite signed out, joining a couch, Who can join and
  its settings, Ask me first through Let in, a live exclusive join with free agents, catching up in Survival Pool with the
  classic pick route and the catch-up reveal, the couch chat, starting and leaving couches, Backstage's Take out keeping
  jordan on the couch; then the browser (the couch line and switcher, details, the guarded leave, starting a couch and Get
  the couch going, the code boxes, Backstage's request and Let in, Game settings' Who can join with Undo, Members' and the
  show's Invite, Settings' couches and leaving one, lee's invite page, joining Weekly Lineup live with a team, kat's
  catch-up strip and reveal, Commercial break's Join a game, the invite page signed out). `tests/late-joiners.test.js`
  (+3: join modes, Survival Pool open, an exclusive join from free agents seen at once). `backup-fixture.js` has a
  request and a couch-only member; backups take `game_join_requests`.
  The rest pass on a restarted dev server: check-new-show (69), -shell (46), -hub (75), -reveal (49), -stats (57), -chat (52),
  -backstage (67), -backstage-ii (116), -community (82), -desk (100), -ours (89), -results-ways (89), -settling (96), -draft (90),
  check-foundation, check-preview and check-backup-restore; `npm test` 535 of 535; type-check and lint (src) clean. check-new-hub
  now finds Get the couch going as a real section, and check-new-show waits for Chat's composer (a cold route compiles on first
  use). The long-running dev server had kept stale compiles of step 6c's modules (settling failed while a fresh compile was
  right): `touch next.config.ts` restarts it cleanly (memory testing-bank). Two one-line refactors in `decision-apply.ts` and
  `results-changes.ts`, made while finding that, are kept (no change in behaviour).

### As built, step 9 part 2 (2026-10-25, on `new-design`): the way in

No migration; nothing polls or runs on a schedule (HOSTING.md: the catalog read, cached at the edge; the Google OAuth client
is a service once the user makes it). New: `src/lib/server/way-in.ts`, `src/lib/signups.ts`, `src/new/way-in.ts` (pure),
`src/new/welcome/` (landing, first-run, sign-in, invite, account, hooks, welcome.css), `/api/catalog`, `/api/me/first-run`.
- **Where the new front door lives (decided):** the landing is **`/welcome`** and sign-in **`/signin`**, both new-design
  routes (`NEW_DESIGN_PREFIXES`, so AuthGate leaves them alone). Classic's signed-out `"/"` landing and its `/sign-in` stay the
  front door until step C (C points them here); `/welcome` is `noindex` until then. next.config's redirect of `"/"` is
  unchanged. The signed-in layout now sends someone with no session to `/signin` (was classic's `/sign-in`) and an account
  early access hasn't let in to `/start/4` (was classic's pending screen). The new design's Sign out lands on `/welcome`
  (`logOutTo`).
- **The landing** (`landing.tsx` + `welcome.css`, the mock's landing.js and landing.css ported, tokens mapped to Night): the
  hero (rolling show name, Start free, Join with a code, the cast wall), the ticker and six sections (three taps, ways to
  play, the couch and watch along, spoiler-safe with Survivor 49's race behind Reveal, any show, free and questions), the
  last call and the footer. Faces and numbers from classic's `showcase.json`. Step 1's show tiles are the catalog's first
  three shows: a tap starts first run with that season picked (`startWith`). Join with a code opens the code sheet, then
  `/join/CODE`. Signed in (a session cookie), the top offers Open the app instead of Sign in and Start free.
- **First run** (`first-run.tsx`, `/start/1..4`): 1 the wall (the catalog's seasons on now or coming up) and Search any show
  (**covers every season in the catalog: the curated shows' seasons, finished ones included; anything else is step 10's Add
  a show**, shown as the Preview `start.add-show` when nothing matches); 2 where you are, a stepper each capped at what's
  aired ("Seen through Episode 3 of 5", "Caught up through Episode 5"), a season not on yet "Premieres Nov 4" with no
  stepper, everything starting at Haven't started; 3 Save your shows = the account (Better Auth's username plugin: a
  username, an email if you like, a password; Continue with Google only when it's set up); 4 your people: Start a couch and
  Join a friend's couch (part 1's `NewCouchSheet` / `JoinCouchSheet`, now exported) or Just me for now (the hub; solo is part
  3). The picks wait on the device (`localStorage gys.firstRun`, a week) through making the account, a Google round trip or
  an emailed link, then `POST /api/me/first-run` follows each openly with where you are (never past what's aired) and makes
  the new design the one the account opens on (with this device's `gys_ui` cookie). Signed in already, step 3 is skipped.
- **Who gets in (the user's call, 2026-10-25: the branch ships with invites letting people in):** since 0058 every new
  account waits for a site admin, so the way in would have ended "You're on the list" for everyone new. It's now the desk's
  **People › Who gets in** (`app_settings 'signups'`, `src/lib/signups.ts`): **You let each one in** (approve: early access
  as it was), **Invites let people in** (**the default: what an unset key means**, marked Recommended; joining a couch with
  its code lets a waiting account in, in the join's transaction; anyone else waits; a value that's none of the three reads as
  approve) and
  **Anyone gets in** (open: let in as the account's made, by auth.ts's create hook), with the waiting count, History and
  Undo. A waiting account may save its own first-run shows and nothing else (`requireAuth` refuses the rest);
  `/api/couches/join` takes a session and refuses a waiting account unless invites let it in. It sees "You're on the list"
  at `/start/4` (with Join a friend's couch when invites let people in) and on an invite.
- **The invite signed out** (`invite.tsx`, the `join.couch` Preview made real): the couch first (part 1's page), then Join
  opens Make an account ("Free. Then you're on ZT Survivor 51."), then "Where are you in ZT Survivor 51?" (each running
  season of the couch, starting at Haven't started), then it saves those follows and joins the couch, and the page shows its
  games to join. Google or an emailed link comes back with `?welcome=1`, which carries on from where you are. Not let in:
  "You're on the list: once you're in, open this invite again". "Already have an account? Sign in" goes to
  `/signin?next=/join/CODE`.
- **Sign-in** (`sign-in.tsx`): username or email and password (`signInWithIdentifier`), mistakes in plain words, then on to
  `?next=` (`safeNext`: only this site's paths, never `/api` or another host) or the design the account opens on (GET
  /api/me), or the list for a waiting account; signed in already, Open the app or Sign in as someone else. **Forgot
  password** is Better Auth's `requestPasswordReset` (the link opens classic's `/reset-password`): emailed through Resend when
  `RESEND_API_KEY` is set (production), written to the server's console in local dev (as auth.ts always did), and on a
  deployment without the key the sheet says plainly that it can't send email and to ask the site admin. A username-only
  account has no email: ask the admin, as classic says.
- **Google, behind config:** auth.ts adds the provider only when `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are both set
  (`prompt: select_account`), and the screens get `googleOn()` from the server: no keys, no button. Better Auth's callback is
  `BETTER_AUTH_URL` + `/api/auth/callback/google` (checked: with placeholder keys in a scratch process it builds Google's URL
  with that redirect URI and the email/profile/openid scopes), so the OAuth client (a Web application) registers
  `http://localhost:3000/api/auth/callback/google` and `https://www.gameyourshow.com/api/auth/callback/google` as redirect URIs
  and `http://localhost:3000` and `https://www.gameyourshow.com` as JavaScript origins (production's `BETTER_AUTH_URL` must be
  the www host; the apex 308s there), and its keys go in `.env.local` and in Vercel's Production environment variables. Tokens
  are encrypted (`account.encryptOAuthTokens`). The create
  hook now keeps a provider's verified email (it forced every real email unverified, which would have made a Google sign-up
  wait for our own verification email). A verified Google email that matches a verified account signs into it (Better Auth's
  default linking). A Google account has no username: the username sheet asks for one on `/start` and `/join` (closing it
  keeps Google's name). Apple needs a paid developer account, so there's no Apple button.
- **Changed from the mock:** no Apple button; the email is optional (classic's sign-up rules; an email has to be confirmed
  before the account signs in, so "Check your email" sits between step 3 and step 4); the landing's game cards use Survivor
  49 (finished) where the mock used Survivor 51's points and survivors, so the front door never says how an airing season is
  going; the invite's where-you-are starts at Haven't started (the mock started it caught up: one tap from a spoiler); the
  wall has only what's on now or coming up (two seasons on the local copy), finished seasons are found by searching; a show
  tile on the landing picks its season.
- **Fixtures and Preview:** removed `start.steps` and `join.couch`; new `start.add-show` (step 10).
- **Checks:** `scripts/dev-test/check-new-way-in.js <outDir> [--width=390] [--keep] [--api]` (85 PASS at 390; on new-fixture.js
  plus its own curated "ZT Way In" show, seasons 7 airing and 8 coming up, and the desk's `zt_nd_desk`; sign-ups are
  `zt_nd_wi_` usernames with `@example.invalid` emails or a username alone; refuses a RESEND_API_KEY; puts Who gets in back):
  the catalog signed out, every Who gets in mode through the desk's API, a waiting account's first-run save and refusals, an
  email sign-up's verification, then in the browser the landing, first run both ways (a username ending on the list and
  joining from there; an email, verified, signed in, saved, Start a couch), sign-in (a wrong password, Forgot password, ?next=,
  Open the app), the invite signed out (waiting, then let in) and the desk's setting. `tests/way-in.test.js` (7: stored picks,
  saves capped at what's aired, where-you-are words, usernames from an email, safeNext, routes, who gets in).
  `check-new-couches.js` now expects the invite's real Join signed out, and `check-new-shell.js` picks a show before first
  run's Next. The rest pass, one at a time: check-new-couches (114), -hub (75), -shell (46), -show (69), -reveal (49), -stats
  (57), -chat (52), -backstage (67), -backstage-ii (116), -community (82), -desk (100), -ours (89), -results-ways (89),
  -settling (96), -draft (90), check-foundation, check-preview and check-backup-restore; `npm test` 542 of 542; type-check and
  lint (src) clean.

### As built, step 9 part 3 (2026-10-25, on `new-design`): solo

Migration **0120** (ships with 0b's, same rehearsal): `leagues.solo` ('public' | 'practice', NULL for every couch's game) and
`leagues.solo_season_id`, a CHECK that a solo game has no couch, and two unique indexes (one pool per season; one practice
couch per person and season). Nothing polls and nothing runs on a schedule (HOSTING.md: a pool's size and what reading it
costs). New: `src/lib/server/solo.ts`, `src/lib/game/practice.ts` (pure), `/api/me/solo`, `/api/seasons/[id]/pool`,
`/api/seasons/[id]/practice`, `src/new/show/solo.tsx`, `src/new/hub/solo-hub.tsx`.
- **How a public pool is stored (decided):** a season's pool ("Survivor 51 · Everyone") is an ordinary league **owned by no
  couch** (`couch_id` NULL, `solo = 'public'`, `created_by` NULL), made by the first person to tap Join (`INSERT ... ON
  CONFLICT` against the per-season index, so two first taps make one). It's Survival Pool (`pickem`) with `settings.calls`
  on and `startEpisode` the next episode to air when it's made. Its seats are accounts' usernames, every seat a member's:
  nobody runs it. Joining (`joinPool`) adds a seat seen at once, starting at the episode whose pick is still open (its own
  `lateJoin.startEpisode`, so earlier episodes are history, not missed picks; never catching up, which would let anyone look
  results up and pick past them); leaving takes the seat and its picks away (`removePlayer`, under the league lock), and
  joining again starts from the next episode. A pool holds **100** (`POOL_CAP`; "The pool is full").
- **How it scores:** through the engine and the season's shared results, as every game does. The season sync already
  reaches every league on a season (`syncSeasonLeagues`), so what any couch sends, the bot's runs and the desk's decisions
  arrive in the pool with everyone else's games; the reveal (`revealSeason`, through `gamesHere`) marks it with the rest of
  your games on the show. Ranked as every Survival Pool is (the longest streak, then right picks).
- **Predictions = Who goes home?** (the mock's "One tap a week on who goes home"): real predictions are free-text bets a
  Commissioner grades, and a pool has nobody to grade, so the engine gained a call beside the pick (`PickEmLogic.setCall /
  callFor / callHistory`, `episode.calls`, behind `settings.calls`): anyone still in, closed at airtime with the pick, right
  when that person left in that episode (not the winner), graded from the same results, shown as "N called" beside the
  streak and never counted in it. Couches' Survival Pools have it off. `game-view.ts` carries it as the `call` move.
- **What someone behind sees (spoiler-safe on the server):** the pool is one of their games, read like any through
  `gamesHere` → `gameView` at their mark (`guard.ts seenThrough`): the board stops at their episode, nobody they haven't
  seen leave is out, and with results in past their mark the pick and call wait behind "Episode 4 is in · Reveal"
  (`revealFirst`). Joining while behind says so first ("its picks show who's still in", as part 1's live join warns).
  Nobody else's pick or call is sent before it's decided (the table's rule), and a stranger's decided picks don't show on
  the Games tab's table either (a name and a streak). The game view now has `from` (the first episode it counts for you),
  so a standing ("top 20%", "You're 2nd") shows only once one of its episodes is decided.
- **How big its reads stay:** what reaches the browser is the top ten, you and either side of you (`poolTop`, POOL_TOP 10),
  `players` (the field's size) and who's picked as a count (`weekProgress(..., { counts })`: nobody named). What it reads
  from Neon is the whole state (~2 KB a player), fetched again by anyone's next read after any pick changes it: hence the
  cap (HOSTING.md). Past 100 the picks would move into a table of their own.
- **No chat, usernames only, out of classic:** a pool has no couch, so no couch chat; classic's chat routes answer nothing
  and refuse a message (`late-join.ts outOfChat`); classic's league list leaves it out (`/api/me`, which would otherwise
  read its whole state on every load); its classic join code is refused (`joinLeague`: a pool joins from its show, a
  practice couch is its maker's); nobody is pushed when someone joins. Its players get the usual results pushes.
- **The practice couch:** `startPractice` makes a league on no couch (`solo = 'practice'`, `created_by` you), Weekly Lineup
  or Outlast, you and three computer players (`BOT_NAMES` Ada, Max, Ivy; `player.automated`, `botLevel` casual / solid /
  sharp for Easy / Normal / Sharp, all three the same), added before the season's results arrive so nobody's a late joiner;
  exclusive ownership (a turn-based draft) with teams fitted to who's still in (`practiceTeams`: Weekly Lineup 3 starting
  and 2 on the bench when there's room, fewer late in a season; Outlast up to four; refused under teams of two);
  `startEpisode` the next to air; the draft order shuffled and the draft open at once, so the bots before you have picked
  by the time the draft room opens (`paths.showPage(..., "draft")?game=`, step 7's room). **The bots take their turns**
  where they always have: inside every league write (`withLeagueLock` → `bots.ts runBots`: your pick, the season sync's
  results, the waiver clock) and on a read with a move waiting (`readyLeague`), so they draft as you do and set each
  episode's lineup once results land; no job. You're a member of it, not its Commissioner (it has no Backstage: nothing to
  run). End it from its sheet (the league goes). Never counted toward a couch (rankings, trophies and the feed read
  couches' games).
- **Where they show (`show-space.ts games({ withSolo })`):** your solo games are yours wherever you look at the season: the
  show space with a couch lists them after the couch's games (moves, the dock, Tonight, the reveal, the draft room), never
  in a couch's own reads. `healCouches` leaves them on no couch (it would have made each one a couch). The Games tab's
  tables show the pool as "Everyone · N people" and the practice couch's computer players tagged Computer.
- **The solo hub** (`/home` with no couch, `data-hub="solo"`; first run's "Just me for now" lands here): Welcome, Watching
  solo (opens Start a couch), the status line and Up next when something's due or airing, the guide (Preview, 11), Your
  shows, **Play on your own** (each followed season's pool, two at most, soonest first, then your practice couch or one to
  start, with a show choice when several can: real), **On your own** (Watch along Preview 13, trivia Preview 12, Who's
  scoring → the show's Cast tab: real), **Better with friends** (the three season games, each a sheet with Start a couch)
  and the foot (Join a couch). A show's **Games tab when you're solo** has On your own (the pool's card and the practice
  couch's) under the tables, no Start a game, and the pool's page (`?page=pool`, pushed: Everyone and Join; once in, your
  streak and standing, Your pick, Who goes home?, the board, Leave the pool).
- **Changed from the mock:** the pool's predictions are one Who goes home? a week (the mock's sheet was step 12's
  predictSheet); Better with friends lists the three season games (Weekly Bingo and Weekly Calls come with step 12); the
  hub keeps the status line and Up next when something's due (the mock's solo hub had neither, and a pool pick due needs a
  way there); the practice sheet's game lines don't promise team sizes (they depend on who's left); Join on the pool's page
  and Start the draft are the one yellow (each is its page's point); the computer players' level reads Easy / Normal /
  Sharp in the new design, casual / solid / sharp in the engine and classic (unchanged).
- **What's left of solo for later steps:** the guide (11) and Add a show (10) on the solo hub; Watch along (13); trivia,
  Rate it and Call it (12, also the solo Tonight's "Just for you", which isn't built: a solo player's Tonight is the
  ordinary one, with the pool's pick and the practice couch's lineup as move cards); Weekly Bingo and Weekly Calls in
  Better with friends (12); pools and practice couches for other kinds of show (10). Noticed, not fixed has the rest.
- **Checks:** `scripts/dev-test/check-new-solo.js <outDir> [--width=390] [--keep] [--api]` (92 PASS at 390) on the new
  **`solo-fixture.js`** (a curated "ZT Solo" show, slug zt-so-solo, created_by NULL: season 51 airing with who went home in
  1-5 decided by an admin, season 50 finished; zt_so_alex, riley and jordan on Episode 5, sam on 3; `addExit` for the next
  episode; `down` also removes every solo game on its seasons). It runs the season sync in its own process through jiti,
  with `next-after-stub.js` standing in for next/server's `after()` (no request scope in a script). Covers the solo read,
  the pool's making, joins, the pick and call, privacy, classic's guards, sam behind, the practice draft with the bots,
  Episode 6's results scoring both, leaving, a full pool, a finished season, Outlast practice sizes, ending; then the
  browser (the solo hub, Start a couch and Better with friends' sheets, the pool's page with a pick and a call, the Games
  tab, ending a practice and starting an Outlast one into its draft room, jordan joining again, sam's reveal first) and
  every real league's state unchanged. `tests/solo.test.js` (4: calls, the pool's table, poolTop, practiceTeams).
  The rest pass, one at a time: check-new-way-in (85), -couches (114), -hub (75), -draft (90), -settling (96), -results-ways
  (89), -ours (89), -desk (100), -community (82), -backstage (67), -backstage-ii (116), -show (69), -shell (46), -reveal
  (49), -stats (57), -chat (52), check-foundation, check-preview and check-backup-restore; `npm test` 546 of 546;
  type-check clean, lint (src) as before (one classic error in `use-sheet-swipe.ts`, untouched). Someone on no couch now
  gets the solo hub where they got the grow hub with Get the couch going; no check depended on that.

### Step 10, in three parts

Too big for one session (written 2026-10-25, at its start). Each part ends with its As built, its Preview entries out and
the checks passing; step 10 is marked done after part 3.

1. **Watching** (Add a show, follow, where you are, watch privately, the show space for a show with no game, the both-watch
   nudge, The couch is watching). **Add a show** ("Search or add a show", suggestions as you type, the "Add '<name>' as a new
   show" block) from the hub's Add a show poster, Get the couch going's second step, the solo hub and first run's search
   (`start.add-show`). Suggestions are the catalog (every show's seasons, not only the curated ones: Noticed's "First run
   lists the curated shows only") plus **TV listings from TVmaze's show search**, asked on demand through a small proxy
   (step 11's daily schedule job is still 11's; this part only looks a show up when someone searches or adds it). Adding a
   show nobody has made one of before makes it from its listing (its art, kind guessed from the listing's type, the current
   season and its episodes' air times as `season_episodes` rows, "Not a game yet"), or by name alone when the listings don't
   have it; a show already here (by its TVmaze id, else its name) is followed, never made twice. Then where you are (capped
   at what's aired), watch privately (the ⋯ menu, a line on Tonight), Remove from my shows, Add to my shows on a show you
   don't follow. The show space for a show with no game of yours: the same tabs, Tonight with Add to my shows or where you
   are, Who's watching (the couch's people who watch it openly; never how far), and the Make it a game / Play it plate
   (still Preview: part 2). The hub's **You both watch** nudge (once per show, Not now remembered) and **The couch is
   watching** (weekly shows the couch watches, Add to my shows asking where you are and staying on the hub). Preview out:
   `hub.add-show`, `hub.nudge`, `hub.couch-watching`, `show.where`, `start.add-show` (and `fixtures/watching.ts`). Check:
   `check-new-watching.js` with a stand-in for TVmaze.
2. **Make it a game** for every kind of show: the kind inferred from the listing and ChatGPT's answer, shown on the review
   as one line with Change (a series picks reality or scripted there); "Ask ChatGPT for me" free (our bot, setting up a
   show is on us) with copy and paste behind it; the answer becomes the season's rulebook (the rulebook prompt with the
   nearest template as its skeleton; the repeat-moment check made strict, from Noticed) and its cast (the cast import, from
   Noticed's "Backstage's setup jobs"); the show set up for every couch, its first maker the parent. **Start a game that
   fits** (`rulebook-fits.js gamesFor`): a competition gets Survival Pool, Weekly Lineup and Outlast; a series Weekly Lineup;
   talk Weekly Bingo and Weekly Calls (shown, started with step 12); a sport the draft of athletes (shared ownership, start
   some each race; "Race", not "Episode") and Survival Pool; linked to the couch's other games on the season (Noticed: "A
   couch with two unlinked games"), Tell the couch. Get the couch going's Start a game (Noticed: it names your soonest show),
   the hub's foot and Commercial break's Start a game, the nudge's button, Run it back, pools and practice couches for any
   set-up competition (Noticed: "Solo games are for curated competition shows"). **Archive or delete a game** (Backstage ›
   Game settings: archive keeps it on the trophy shelf and stops scoring; delete is tier 3, restorable 30 days). Preview
   out: `hub.start-game`, `show.make-it-a-game`, `show.start-game`, `backstage.end-game`.

   **Part 2 in two (split 2026-10-25, at its start; too big for one session):**
   - **2a, Make it a game → a set-up show.** The Make it a game page (Ask ChatGPT for me through our bot, free; Copy and
     paste it yourself behind it; the review with the kind as one line and Change, the cast, each episode, what scores, where
     results come from, the games that fit), from the Games tab's plate, Tonight's and the ⋯ menu. The rulebook prompt with
     the nearest template as its skeleton (the same show's other season, else a library rulebook or built-in by name, else by
     kind), the repeat-moment check made strict (Noticed), the cast from TVmaze's `/shows/:id/cast` for a series or talk
     show and from ChatGPT's cast prompt otherwise (Noticed: "Backstage's setup jobs", the cast import). Looks right sets
     the show up for everyone: the season's rulebook from blocks (its maker its creator, new until checked), the season on
     its rulebook (`rulebook_live`), the approved season cast, `shows.set_up_at` and its kind. Preview out:
     `show.make-it-a-game`.
   - **2b, Start a game that fits, and archive or delete a game.** Everything else above: `rulebook-fits.js gamesFor`, Start
     a game per kind (the sport's draft of athletes and "Race"), linked to the couch's games on the season, Tell the couch,
     every entry point (the Games tab and Tonight's plate, the ⋯ menu, the hub's nudge, Get the couch going, the hub's foot,
     Commercial break, Run it back), pools and practice couches for any set-up competition, archive or delete. Preview out:
     `hub.start-game`, `show.start-game`, `backstage.end-game`.
3. **Rulebooks phase 8: the library and the new-show flow** (`PLAN-rulebooks-implementation.md` 7.9, 7.10, 7.12, 7.13 on the
   desk): the library of starting templates by kind (Save as template, the proposed ones dashed until two real shows share
   a shape), the desk's own New show flow, "Fits these games" on a rulebook's page, a player-made rulebook the desk can take
   over (first creator is parent), the desk Inbox's new kinds; a series and a talk rulebook made end to end, each with a
   game of a fitting type. Marks step 10 done.

### As built, step 10 part 1 (2026-10-25, on `new-design`): watching

Migration **0121** (ships with 0b's, same rehearsal): `shows.set_up_at` (NULL = "Not a game yet"; every show made before,
and any made through the old routes, is set up), `shows.tvmaze_id` (one show per listing) and `shows.listing`,
`show_seasons.listing_id` and `listing_fetched_at`, `season_episodes.source` may be 'listing', `show_follows.nudge_off_at`.
Nothing polls and nothing runs on a schedule; **the TVmaze API is a new service** (HOSTING.md). New: `src/lib/game/listing.ts`
(pure), `src/lib/server/listings.ts`, `src/lib/server/add-show.ts`, `/api/listings/search`, `/api/listings/[tvmazeId]`,
`POST /api/me/shows`, `src/new/watching/` (search.tsx, where.tsx, sheets.tsx with `openWatching`, mounted in the signed-in
layout beside the couch sheets).
- **TV listings (decided: TVmaze, asked on demand).** Add a show's suggestions as you type come from TVmaze's show search
  through our proxy (`/api/listings/search?q=`, asked once typing pauses for 300 ms, kept at the edge an hour per query, no
  database read; a minute and `unavailable` when TVmaze doesn't answer), and one listing's season with how much has aired
  through `/api/listings/[id]` (for where you are before adding). Adding a show reads its seasons and one season's episodes
  from TVmaze. Step 11's daily schedule job (all of TV, kept current) is still 11's. A dev server can be pointed at a
  check's stand-in with the `x-gys-listings` header (`listingsFor`, `next dev` and loopback only, like 6c's `x-gys-bot`).
- **Adding a show** (`add-show.ts`, `POST /api/me/shows` with `{ listing }` or `{ name }` and where you are): the show is
  found by its TVmaze id, else by name and country (`sameShow`: a name that doesn't say its country is American, so "Love
  Island USA" is the American "Love Island" and "The Traitors (US)" isn't the BBC's; the show here gains the link and keeps
  its name and art), else made from the listing: its name, TVmaze's medium poster, the kind guessed from its type (Reality
  and Game Show a competition, Scripted / Animation / Documentary / News a series, Talk / Variety / Award / Panel talk,
  Sports a sport; part 2's review shows it with Change), terms by kind (Contestant / Cast member / Athlete), its adder as
  `created_by`, not set up. Its season: the listing's on now, else next, else latest (`pickSeason`); a show already here
  follows its own season of that number, else its own on now (an admin's numbering wins), else one made from the listing
  (status and dates, episode count, weekly or a streaming drop when every episode lands on one day, the air time and the
  network country's zone, and every regular episode's start as a `'listing'` row: specials left out). A season that was
  already here keeps its schedule (the couch's lineups lock by it); a season made from its listing is read again when
  someone adds it a day after the last read, never over a row research reported on or an admin set. By name, when the
  listings don't have it: a show of that name already here is followed, else one is made with a first season and nothing
  known. Then it's followed openly with where you are, capped at what's aired (only followed, on a season you play). At most
  10 new shows per person a day; an account still waiting to get in can't add shows (403), and its first run saves listing
  shows but nothing by name. With the listings down, a show already here is still followed and a new one waits (503).
- **The catalog lists every show's seasons now** (from Noticed: "First run lists the curated shows only"), each with
  `ready`, `curated`, `tvmazeId`, `network` and `country`; first run's wall and the landing's show tiles are only the curated
  shows set up as games; classic's show picker (`/api/shows`) leaves out shows that aren't a game yet, so no classic league
  can start on one.
- **Add a show** (the mock's refine.js addShowSheet; `hub.add-show` made real): "Search or add a show"; before you type, art
  cards of what the couch watches that you don't, then what's on now; as you type, the shows here (On your list, Ready, Not a
  game yet; a show that's here and watched by someone on the couch says so, with its network when the listing has one) and
  the listings that aren't (Not a game yet, or Latest season for a show here by name whose seasons have all finished; a
  listing is hidden once a show made from it is here); "Add '<name>' as a new show" when nothing's called that (added by
  name); "Looking in the TV listings…" and the listings-down line; "TV listings from TVmaze" (the licence's credit). A tap asks
  where you are when anything has aired (from the catalog, or the listing's season) and adds it; the sheet stays open, back
  on the search. From the hub's Add a show poster (the solo hub's too) and Get the couch going's second step.
- **First run's search** (`start.add-show` made real): the same results; a listing or a name is picked as `tv:<id>` /
  `name:<name>` with its name and art kept on the device (`way-in.ts` `extra`), shown on the wall as picked, asked where you
  are from its listing on step 2 (a name has nothing to set), and made by `POST /api/me/first-run` once there's an account.
  Fixed on the way: for someone signed in, step 2's Next saved and then bounced back to step 1 (clearing the picks raced the
  navigation).
- **Where you are, follow, watch privately** (`show.where` made real): the one spoiler chip's Change opens the where sheet
  everywhere (a stepper from Haven't started to what's aired; on a season you play it says where you are moves with your
  reveals: `space.you.plays`); the show's ⋯ menu has Watch privately (a switch), Where you are and Remove from my shows
  (where you are is kept), or Add to my shows on a show you don't follow; How it works only for a show that's a game.
- **A show with no game of yours** (the same tabs): Tonight leads with Add to my shows (who on the couch watches it) or the
  spoiler chip and "Watching privately: the couch doesn't see this on your list"; Who's watching (you, then the couch's open
  followers and players: "Watches it" / "Plays Outlast", never how far); the play plate (Play it for a show that's set up,
  Make it a game for one that isn't: still Preview, part 2's). The couch line says who watches it and "Not a game yet".
  Episodes lists every aired episode of a show you only watch, newest first: "You've seen it" with its title, "Not seen
  yet" with only its number (a title can give an episode away), from a new `aired` row.
- **The hub**: **You both watch** (`nudgeShow`: a show you follow that someone else on the couch openly watches, airing or
  coming up, with no game on the couch or of yours, not answered before; the most people, then the soonest; Not now is
  `nudgeOff`, remembered; its button opens the show's Games tab, where Start a game / Make it a game are part 2's) and **The
  couch is watching** (`couchWatching`: weekly shows others on the couch follow openly, the ones not on your list first, not
  a show the couch plays (Your shows has it) nor a streaming drop (step 14's rail); Add to my shows asks where you are and
  stays on the hub). Both in the focus hub and the grows-with-you hub (a new couch is where games start). The home read
  carries `couchShows` and each show's `nudgeOff`; season headers carry `ready` and `release`.
- **Fixtures and Preview:** deleted `fixtures/watching.ts` and the entries `hub.add-show`, `hub.nudge`, `hub.couch-watching`,
  `show.where`, `start.add-show`. Left for part 2: `hub.start-game`, `show.make-it-a-game`, `show.start-game`,
  `backstage.end-game`.
- **Changed from the mock:** nobody's progress anywhere ("caught up", "On Episode 5", "2 ahead", "riley · Ep 13": 0b's guard
  sends nobody else's progress; step 15's What your couch sees could choose to share it: Noticed), so Who's watching says what
  each plays instead; no Rate it / Call it rows on Tonight (step 12; the existing Extras' bingo Preview stays); "Add '<name>'
  as a new show" adds by name, since the listings' shows are the rows above it; suggestions are the couch's shows and the
  catalog's on-now ones; posters are TVmaze's medium image; the follow card says the couch will see it (rating is 12's); the
  Watch privately switch is in the ⋯ menu as the mock has it, plus the line on Tonight.
- **Spoiler-safe titles:** a listing has a title for every episode, and one that's aired can give it away, so the space's
  schedule, its Up next and the home's (`schedule.ts titledFor`) send a title only for an episode you've seen.
- **Checks:** `scripts/dev-test/check-new-watching.js <outDir> [--width=390] [--keep] [--api]` (114 PASS at 390) on
  new-fixture.js plus the new **`fake-listings.js`** (a stand-in TVmaze: ZT Love Shack in the US and the UK, ZT Traitors, a
  streaming drop, an ended talk show; ids 990001 and up): the proxy, adding from a listing, made once, the UK show apart, a
  show here linked by name with its schedule untouched, the drop, an ended show, by name, refusals and the listings down, the
  daily cap, a day-old season read again (research's row kept), the catalog, the nudge's follow rules, the space, first
  run's save (a waiting account's too); then the browser (The couch is watching and its Add, the nudge and Not now, Add a show
  with suggestions, search, by name and a listing's where you are, a show with no game and its menu, Episodes' aired rows, a
  show alex doesn't follow, a newcomer's first run with a listing and a name). `tests/listing.test.js` (7) and
  `tests/way-in.test.js` (+1, the extra picks). `browser.js open({ headers })`; new-fixture's down also removes shows zt_nd
  people added. check-new-way-in now runs first run's search against an empty stand-in listing and expects the Add block, and
  expects the catalog's new fields and a player's own show (off the wall); check-new-shell taps the guide's Preview;
  check-new-stats counts a watch-only show's seen episodes (its aired ones are listed too now). The rest pass, one at a time:
  check-new-way-in (85), -shell (46), -solo (92), -couches (114), -hub (75), -draft (90), -settling (96), -results-ways (89),
  -ours (89), -desk (100; its "every league renames him" read failed once in the batch and passed on its own: it reads the
  leagues right after the toast), -community (82), -backstage (67), -backstage-ii (116), -show (69), -reveal (49), -stats
  (57), -chat (52), check-foundation, check-preview and check-backup-restore; `npm test` 554 of 554; type-check clean, lint
  (src) as before (one old warning in `episode-results.ts`).
- **For part 2:** the nudge's button, the Games tab's play plate and Tonight's lead to Make it a game / Start a game
  (`show.make-it-a-game`, `show.start-game`); a show made here has `shows.listing` (its TVmaze type, network, country) and a
  guessed `shows.kind` for the review's one line; `set_up_at` is what Make it a game sets; the listings proxy and
  `fake-listings.js` are there to reuse (TVmaze's `/shows/:id/cast` could seed the cast import).

### As built, step 10 part 2a (2026-10-25, on `new-design`): Make it a game

Part 2 was split at its start (above: 2a, Make it a game to a set-up show; 2b, Start a game that fits and archive or delete).
Migration **0122** (ships with 0b's, same rehearsal): `show_setups`, one attempt per season at setting its show up (shared by
everyone who opens it; ChatGPT's two answers kept as text, the kind chosen with Change, the stage, who finished it). One new
poll while our bot asks, nothing on a schedule (HOSTING.md). New: `src/lib/game/make-game.ts` (pure), `src/lib/server/make-game.ts`,
`GET/POST /api/seasons/[id]/make`, `src/new/show/make-game.tsx`; `listings.ts showCast`; `ask-bot.ts` asks take a `budgetMs`.
- **The page** (the mock's rulebook.js makeGame, `?page=make`, pushed over the show) from the Games tab's and Tonight's plate
  (`data-play-it="make"`, its words by the listing's kind, solo players too while nobody's set it up) and the ⋯ menu's Make
  it a game (Start a game stays there as Preview for a show that's set up). **Ask ChatGPT for me** (free; only while our bot
  answers its health check) leads, **Copy and paste it yourself** behind it. Asking shows what's found a line at a time ("5
  crew members · How an episode runs: 6 parts · N things that score · A series · reality"), you can leave, and a second tap
  (anyone's, any couch) joins the ask in flight; the one who started it is named only to their own couch. Copy and paste is
  two steps through Ask an AI's sheet (now `AskAiPasteSheet`, the same body with any question: `AskAiQuestion`): how it
  works, then who's in it (skipped when the listing has the cast), then Check what it found.
- **The two questions.** How it works is R6's rulebook prompt with **the nearest rulebook as its skeleton** (`templateFor`: one we
  have by the show's name, e.g. Below Deck Mediterranean starts from Below Deck's, Survivor anything from Survivor's; else by the
  listing's kind: a scripted series from Scrubs', a reality series (Documentary) from Below Deck's, talk from SNL's; **none**
  for a show the listings call Reality, which can be a competition or a series, nor for a sport: a wrong-shaped skeleton costs
  more than none). Who's in it is the cast prompt (`cast-prompt.js`) read against the answer's terms and groups, except a
  **series or talk show with a TV listing, whose cast is TVmaze's** `/shows/:id/cast` (`castFromListing`: a scripted series'
  characters, who plays them as the line; else the people, their role as the line). Our bot asks after the response
  (`after()`): both questions in one request when 90 s are left for the second, else it pauses at "who's in it" and the open
  page carries on (`continue`).
- **The review** is worked out from the answers each time it's read: the kind ChatGPT said (else the listing's guess), unless
  someone chose another; `withKind` empties what the kind hides (a talk show's ways out and twists) and adds a way to win
  when it becomes a competition without one, so **Change loses nothing ChatGPT found** (changing back restores it); a name in
  the rulebook is taken out (`scrubNames`: the sentence, or the item); what doesn't fit is left out and listed (`salvage`: a
  moment, twist, way out or part of an episode with a problem; a way out keeps its name without a dropped part as its cause);
  what can't be (the cast's shape, the season) says "This answer can't be used" with Ask again / Start over. One line for the
  kind with Change (the four kinds, our guess marked, a series picks Reality or Scripted), the cast (six, +N more), each
  episode, what scores (six), where results come from, the games that fit (R1's `howItWorks` view: its `games`), and See how
  the whole season works (How it works on the answers, `?page=make-how`, at your episode: a phase the season reached isn't
  told early). The kinds that need a cast (all but talk) can't be set up without one.
- **Looks right** sets the show up for every couch, in one transaction: the season's rulebook from the blocks (`created_by` the
  maker, `review_status` unreviewed, `provenance.from` 'made' with how and from which template; its parent the template's
  library row; the season's old auto-made rulebook archived), **`show_seasons.rulebook_live`** (its leagues play by it), the
  season's cast approved and finished (`cast_locked_at`: the desk changes it from there), the compiled rules as the show's
  **stored format too** (`show_formats` `made-<slug>`, `shows.format`) so every older reader of a show's format reads the same
  rules, and `shows.set_up_at`, its kind and its words (castaway/tribe terms); the attempt is kept as who set it up, and the
  desk's History has a line. A second Looks right is refused. How it works then says "Made with ChatGPT by alex · new until
  another couch checks it". Classic's show picker lists the show (set up), and the Games tab's plate becomes Play it (Start a
  game: 2b, Preview).
- **Limits:** five attempts per person a day; our bot's asks are the One tap kind (HOSTING.md's Bot capacity).
- **From Noticed:** the repeat-moment check is strict now (`rulebook-research.js`: word counts, so "As a Faithful, voted out a
  Faithful" isn't "…voted out a Traitor", and a longer label naming a role or group isn't a repeat; tested on the Traitors'
  blocks); Backstage's setup job "Add the cast" is done for a show made a game (its cast is set up with it; Noticed keeps the rest).
- **Changed from the mock:** "Looks right · make it a game" (the mock's "pick a game" opens Start a game, 2b's); You can play
  lists the season games only (the mock adds "plus bingo and calls every episode": step 12); the review's lede says "From
  ChatGPT's answer and the TV listing"; nothing says how many are already out (the guard). Solo players get the plate too.
- **Checks:** `scripts/dev-test/check-new-make-it.js <outDir> [--width=390] [--keep] [--api]` (81 PASS at 390) on new-fixture.js
  with `fake-listings.js` (new: `/shows/:id/cast`, ZT Yacht Life 990011 a reality series with its crew, ZT Grand Prix 990012 a
  sport with nobody listed; casts on ZT Drop Show and ZT Old Show) and `fake-bot.js` (kinds `setup` and `cast`; `rulebook` is
  still the show-change prompt): refusals before an answer, the skeleton chosen, asking/joining/polling, the review, Change
  both ways, Looks right in the database, a sport's two questions, carrying on, a failed ask, the bot down, copy and paste with
  a name taken out and a moment left out, an unusable answer, a talk show, five a day; then the browser (from the Games tab
  with the bot, the kind sheet, How it works, Looks right; copy and paste from Tonight; the ⋯ menu). `tests/make-game.test.js`
  (5) and `tests/rulebook-research.test.js` (+1). new-fixture's down also removes `made-zt-%` stored formats. check-new-watching
  and check-new-show now expect the real plate; check-new-draft opens the finished draft room waiting for `load` (it failed at
  HEAD too: Noticed's "The catalog is read on every signed-in page"). The rest pass, one at a time: check-new-watching (114),
  -show (69), -solo (92), -way-in (85), -couches (114), -hub (75), -draft (90), -settling (96), -results-ways (89), -ours (89),
  -desk (100), -community (82), -backstage (67), -backstage-ii (116), -shell (46), -reveal (49), -stats (57), -chat (52),
  check-foundation, check-preview and check-backup-restore; `npm test` 560 of 560; type-check clean; lint (src) as before (an
  old error in classic's `use-sheet-swipe.ts`, untouched since master's league tabs, and the old warning in `episode-results.ts`).
- **For 2b:** the plate's Play it, the Done view and the ⋯ menu still have Start a game as Preview (`show.start-game`); a made
  season's rulebook is `rulebook_live` and its show's stored format is the same rules, so a league started on it (2b) plays by
  them through `syncLeagueRulebook` (call it when a game is made) and `syncLeagueFormat`; `shows.kind` is the chosen kind (and
  the rulebook's `blocks.start` the series' starting point) for `gamesFor`; the sport's "Race" is the rulebook's `parts`.

### As built, step 10 part 2b (2026-10-25, on `new-design`): Start a game that fits, archive or delete a game

Migration **0123** (ships with 0b's, same rehearsal): `leagues.deleted_at` and `deleted_by`. Nothing polls and nothing runs on
a schedule (HOSTING.md). New: `src/lib/game/formats/rulebook-fits.js` (+ `.d.ts`), `src/lib/server/new-game.ts` (the league
maker solo.ts used, now shared), `start-game.ts`, `end-game.ts`, `GET/POST /api/seasons/[id]/start`, `GET/POST
/api/seasons/[id]/backstage/end`, `src/new/couch/start-game.tsx` (`openStartGame`, its sheets mounted in the signed-in layout).
- **What fits** (`rulebook-fits.js gamesFor(blocks, compiled)`, PLAN-rulebooks-implementation 4.8 and 7.12): Weekly Lineup needs
  a cast and 5+ moments (never talk); Outlast a competition with a way out and a winner (a `winner` way, or the compiled rules'
  `winnerExitMethod`); Survival Pool a competition where a segment that runs every episode sends someone home (or causes a way
  out: The Amazing Race's pit stop), or a sport with a cast and something that scores (a pick survives a race by scoring in
  it); talk gets Weekly Bingo and Weekly Calls, fitting but `soon: '12'` (no league type yet). Each kind's own games first, in
  `KINDS.games` order (the first recommended when there's a choice). `noFitLine` is the mock's RB_NOFIT (talk: drafts need a
  cast that scores week to week; a series: Survival Pool and Outlast need someone knocked out; a sport: Outlast; anything else
  says what's missing) and `gameLine` the mock's rbGameLine in the show's words (the rulebook's cast plural and `parts`: "Draft
  five drivers, start three each race", "Draft the crew members…", "Draft the characters…"). How it works' games (and so Make it
  a game's review) are now `gamesFor`'s fitting ones.
- **Start a game** (`start-game.ts`; the mock's rulebook.js newGameW): anyone on the couch, on a set-up show, from the next
  episode to air (1 before the premiere). Refused with a reason when the show isn't a game yet ("Make ZT Old Show a game first")
  or every episode has aired (then `next`: the show's next set-up season, for Run it back). The new league (new-game.ts
  `makeLeague`, as solo's: show, type, season, rule changes, rulebook, approved cast, shared results) is the starter's (its
  Commissioner), on the couch, named after the game ("Weekly Lineup 2" when the couch has one of that name here). A sport's
  Weekly Lineup is shared ownership (the draft of athletes is step 7's blind draft: everyone picks from the whole field) and its
  Survival Pool sets `settings.poolSurvive 'scores'`; an Outlast's team size is fitted to who's still in and the couch's size.
  **Linked** into the couch's group on the season (classic's link rule, `linkProblem`), so one reveal and one chat (from
  Noticed: "A couch with two unlinked games", fixed). **Its rules:** the couch's own copy when it made the season's rulebook its
  own (`leagues.rulebook_id` set at insert, Make it ours), else the season's rulebook through `syncLeagueRulebook`; on a made
  show the league's `showFormat` is the stored `made-<slug>` and its `settings.rulebook.data.id` the same (checked). **Tell the
  couch** (on by default): one push to everyone else on the couch (the `invite` setting, to the show's Games tab); always a
  `game.start` line in Recent changes, which the hub's feed reads ("riley started a Weekly Lineup · tap to join", to the Games
  tab). Everyone else joins as step 9's joins do.
- **Engine:** `PickEmLogic.decided(ep, state)` (and `pickEmDecided(ep, state)`): a pool that survives by scoring is decided once
  its scores are in, and a pick is right when it scored (`scored`: positive points in that episode); `GhostLogic.isUnderway`
  counts results only from the league's `startEpisode`, so a game started mid-season takes newcomers into its draft until it
  has a result of its own; an archived game (`settings.archivedAt`) has no action items or commissioner items, no waiver step,
  and `syncLeagueDecisions` leaves it as it stood.
- **Run it back** (the same game on the show's next season, with its name and settings: `AGAIN_KEEPS`, never its people or
  results): the trophy shelf's Run it back rows (`couchHub.again`: a finished game of yours whose show's next season is set up,
  still to finish, and has no game of that kind on the couch) and a finished season's Games tab ("Run it back · Survivor 52",
  from `StartOptions.next`). The sheet says "Run it back · Survivor 52 · the same Outlast as Survivor 50".
- **Every entry point** opens the one sheet: the Games tab's Start a game row and Play it's button, Tonight's Your games tile, the
  show's ⋯ menu, Make it a game's Done view, the hub's nudge (Make it a game opens the show's `?page=make` for a show that isn't
  set up), Get the couch going's first step (it names the show now: the soonest set-up one of yours with no game on the couch,
  e.g. "Survival Pool needs no draft: ZT Survivor 51 can start with Episode 6 on Wednesday"; Noticed fixed), the hub's foot
  ("Start a game", was "New league") and Commercial break's card (both Pick the show first: your shows still to finish; one
  that isn't a game yet goes to Make it a game). With no couch the sheet offers Start a couch.
- **Solo games for any set-up competition** (Noticed: "Solo games are for curated competition shows", fixed): `soloBlocked`
  reads `shows.set_up_at`, so a competition a player made a game gets a public pool and practice couches. Other kinds still
  have none ("Solo games come to this kind of show later").
- **Archive or delete a game** (`end-game.ts`; Backstage › Game settings' folded "Archive or delete a game", the mock's
  details.danger; a Commissioner's): **Archive** is tier 1 (a `settingsSet` change, Undo on the toast and in Recent changes):
  `settings.archivedAt`/`archivedBy`; it stays on the couch with its table as it stood, marked Archived on the Games tab with
  Bring it back for its Commissioner; it counts as ended for the trophy shelf and joins (`ended`); the season sync, moves due,
  waivers, reminders and Backstage skip it (`backstageScope` leaves archived games out unless asked). Bringing it back (Undo, or
  Bring it back) syncs what came in meanwhile. **Delete** is tier 3 (a hold, "Archive it instead" offered first): its people's
  memberships (whole rows) and its group go into the line's `GameUndo`, `deleted_at` set, out of the group, anyone on the couch
  only for it kept on the couch (`via 'couch'`), the chat it held moved to the couch's next game here (or the couch's own
  conversation), so nobody loses what was said. Recent changes keeps a deleted game's lines for 30 days ("restorable until Nov
  24"); its Commissioners (`GameUndo.commissioners`) restore it there (seats, group, and the results that came in). After 30 days
  it's removed for good the next time anyone deletes a game (`purgeDeleted`; no job). `games()` leaves deleted games out; the
  season sync, the waiver job and the reminders leave out both.
- **Changed from the mock:** F1's own pages (Draft your drivers, Your drivers with Starting/Bench, the race pool's sheet) aren't
  built: a sport plays on the same screens as any Weekly Lineup and Survival Pool (the blind draft, the dock's lineup, Your moves'
  pick); Tonight's "Your game" job is the real moves and Backstage's Needs you (Schedule the draft, Invite people); the old
  newGameSheet's "One night only" choices (bingo night, prediction round, a watch along) are steps 12 and 13, not in Start a
  game; a talk show's two games show as coming soon with no Tell the couch; "the couch plays one already" was tried on each
  game's line and dropped (noise). "Race" is the sport's word in Start a game (its subtitle, lines and push) only (Noticed).
- **Not built:** Lock it down (Noticed keeps it).
- **Checks:** `scripts/dev-test/check-new-start-game.js <outDir> [--width=390] [--keep] [--api]` (75 PASS at 390) on new-fixture.js +
  hub-fixture.js, `fake-listings.js` (plus ZT Late Night, a running talk show the check adds) and `fake-bot.js`, making ZT Yacht
  Life, ZT Grand Prix, ZT Love Shack and ZT Late Night games through Make it a game first: what fits each kind, refusals, jordan's
  Weekly Lineup (linked, from Episode 6, three told, the feed and Recent changes lines, alex joining into its draft), a second
  one's name, a series and a sport on their rulebooks and stored formats, the sport's shared draft and scoring pool, the couch's
  own rules reaching a new game, pools and practice on a player-made competition, Run it back (the shelf, an over season, its
  name and team size), archive (only its Commissioner; Episode 6 reaching the rest through the season sync, then Undo bringing it
  in), delete (the hold's sentence, out of the group, restorable only by whoever ran it, gone after 30 days); then the browser
  (the Games tab's sheet and Start it, Pick the show and a sport's sheet, the nudge, a talk show from the ⋯ menu, Make it a game's
  Done, Backstage's Archive with Undo and Delete with the hold, Recent changes' restore, Commercial break, the feed's line).
  `tests/start-game.test.js` (8). new-fixture's down also removes games zt_nd people started (named like any game).
  Updated for what changed: check-new-make-it (as a competition, ZT Yacht Life now fits only Weekly Lineup: nobody goes home each
  charter and nobody wins), check-new-watching (the nudge's Make it a game opens the make page), check-new-hub (Commercial break's
  Start a game is real), check-new-backstage-ii (Game settings' Archive or delete). The rest pass, one at a time: check-new-make-it
  (81), -watching (114), -solo (92), -way-in (85), -couches (114), -hub (75), -draft (90), -settling (96), -results-ways (89), -ours
  (89), -desk (100; its "every league renames him" read failed once in the batch and passed on its own, as before), -community
  (82), -backstage (67), -backstage-ii (116), -show (69), -shell (46), -reveal (49), -stats (57), -chat (52), check-foundation,
  check-preview and check-backup-restore; `npm test` 568 of 568; type-check clean; lint (src) as before (the old error in classic's
  `use-sheet-swipe.ts` and the old warning in `episode-results.ts`).
- **For part 3:** "Fits these games" on a rulebook's page (7.12's new-league flow is this sheet) is `gamesFor(blocks, compiled)`
  with its `needs`; the library's rulebooks all answer it (tests/start-game.test.js); a new show from the desk's flow becomes
  startable the moment `shows.set_up_at` is set and its season has a rulebook.

### As built, step 10 part 3 (2026-10-26, on `new-design`): the library and the new-show flow

Rulebooks phase 8, which finishes step 10. Migration **0124** (ships with 0b's, same rehearsal): `rulebook_checks` (one row
per couch that says a made rulebook looks right), `shows.reviewed_at`/`reviewed_by`, and wider checks on
`rulebooks.review_status` (+ `checked`, `reviewed`), `show_setups.via` (+ `template`) and `admin_changes.entity` (+ `show`).
Nothing polls and nothing runs on a schedule (HOSTING.md). New: `src/lib/game/formats/rulebook-shapes.js` (+ `.d.ts`),
`src/lib/server/desk-library.ts`, `templates.ts`, `rulebook-checks.ts`, `GET/POST /api/desk/library`, `POST /api/desk/shows`,
`POST /api/desk/shows/[id]`, `POST /api/seasons/[id]/rulebook/check`, `src/new/desk/library.tsx` and `new-show.tsx` at
`/desk/library` and `/desk/new` (pages a level down, from Find's two new tiles).
- **The library** (PLAN-rulebooks-implementation 7.9): **Start from**, the templates by kind (the built-ins' and stored
  formats' mirrors, a starting point the desk saved, a shape's), each with the shows it plays like and who decides its
  segments (no tags for a competition mirror, whose blocks are read back from its format and say "nobody" everywhere); the
  design plan's eight **proposed shapes** (`rulebook-shapes.js SHAPES`: brackets and duels, auditions to live shows, game
  show, docuseries, awards night, season and playoffs, tournament bracket, race series, each a test over the blocks) dashed,
  "No show here plays like it yet" or "ZT Rally plays like it · one more and it earns its place", until **two real shows**
  here fit one (each show's newest season rulebook, never a show with a template of its own: The Challenge is a duel every
  episode but has its own), then **Earned** with **Make it a template** (saved from one of them, named for the shape, its
  examples kept so a show like them finds it); **Made by players** (New, Checked); **Drafts** (the researched files, and any
  template taken off); **In use** (every season's rulebook: where it came from, leagues following it, own copies). Sticky
  New show.
- **Save as a starting point** (a season rulebook's page) is `desk-library.ts saveTemplate` now: the rulebook as it reads
  now, every change folded in, the show's name and tagline left blank, named for its show (`provenance.shows`); it opens the
  template's page. A library rulebook's page has "A starting point for new shows" (on or off), Delete while nothing's made
  from it (a built-in's or stored format's mirror stays), the shape it was saved as, and the editor as for any rulebook (a
  fix on a library rulebook changes only it). Every library change is in its History with Undo.
- **Make it a game's templateFor reads the library** (`make-game.ts templateFor(show, library)`, fed by `templates.ts`): the
  same show's other season first (one made or edited from blocks), then a template the desk saved for the show's family
  (`familyOf`/`sameFamily`: no country, edition or leading "The"; "Below Deck" and "Below Deck Mediterranean" are one), ours
  by name, a stored format's mirror of that family (Big Brother Canada starts from Big Brother US), then by kind for a series
  or a talk show (the newest the desk saved, a series by its start, else ours); still none by kind for a competition or a
  sport.
- **Fits these games** on every rulebook's page (`gamesFor` with each game's `needs`): fits, with step 12, or "Doesn't fit:
  needs …", and the shape a season's rulebook plays like.
- **A player-made rulebook** (7.9's "commissioner-made" ones; first creator is parent): the desk's page says "A player made
  it", how and by whom, the couches that checked it, and **Take it over** (`review_status` 'reviewed', `approved_by` and
  `approved_at`; its creator stays the first maker; History's Undo puts it back). **Looks right to us** (Noticed's "New until
  another couch checks it, and nothing checks it", fixed): on How it works, someone on another couch (never the maker or the
  maker's couch) checks it, once per couch, and it reads "checked by another couch" for everyone (`review_status`
  'checked'). How it works says "Made with ChatGPT by alex · new until another couch checks it", then "· checked by another
  couch", then nothing more once the desk took it over; the desk's own reads "Made from the ZT Yacht Life rulebook".
- **The desk's New show** (7.10, with the kind inferred on the review rather than asked first, layer zero): 1, which show
  (one here: a season to set up, or New season; a TV listing, made as Add a show makes it without following it or counting
  against a day's ten; or a name); 2, how to start: Ask ChatGPT for me or copy and paste (the make page, as for anyone), or a
  starting point (the desk's saved ones first, the show's kind first). **make-game.ts's template path** (`POST /make {
  action: "template" }`, the desk's only) answers how the show works with the template's blocks named for the show
  (`derivedFrom: "rulebook:<id>"`), then the cast is asked for, pasted or read from the listing as for any answer. The review,
  Change and Looks right are the make page's (`?from=desk`), and Looks right comes back to the rulebook's page on the desk. A
  site admin's made rulebook is checked as it's made ('reviewed', approved by its maker), its parent the template; their
  attempts aren't capped at five a day; Make it a game's Done view links "Its rulebook on the desk" for them.
- **A set-up show's next season** (Noticed, fixed): `db/rulebooks.js ensureSeasonRulebook` gives a made show's season with no
  rulebook of its own a copy of the newest other season's (every change folded in, compiled for itself, `rulebook_live`,
  `provenance.sameAsLastSeason`) the first time anything reads it (Start a game, the desk, a game's sync). The show's desk
  page has **New season** (the next number; a set-up show's plays by last season's rulebook, one that isn't a game yet goes to
  New show's second step). Its cast is still Backstage's Add the cast.
- **Fixed on the way:** since 2a a made show's stored format (`made-<slug>`) became an approved library template, of the wrong
  kind, whenever its season's rulebook was ensured (branch only); `ensureSeasonRulebook` and the backfill leave made formats
  out now (`madeFormat`), and new-fixture's down removes old mirrors and anything saved from zt shows.
- **The Inbox's new kinds** (7.13; Noticed's "Anyone let in can make shows", fixed for shows added by name): **Rulebook**
  ("ZT Yacht Life 2: a new rulebook · Made with ChatGPT by alex · nobody on another couch has checked it", until another couch
  checks it or the desk takes it over) and **Show** ("ZT Mystery Hour: added by name · By alex · not in the TV listings · 1
  following"; the show's page has Looks fine and Archive it, each undoable; a show the desk adds by name itself has been looked
  at). Find also finds library rulebooks by name.
- **Backups** hold `rulebook_checks` (step 0a's scripts: `backup-common.js`, its slice in `backup-leagues.js`, a row in
  `backup-fixture.js`; `check-backup-restore.js` passes).
- **End to end:** a series (ZT Harbour Crew from the desk's ZT Yacht Life template, its crew from the listing; alex's Weekly
  Lineup plays by its rulebook) and a talk show (ZT Night Desk through our bot: Fits these games says Weekly Bingo and Weekly
  Calls, with step 12, and How it works and Start a game agree).
- **Changed from the plan:** the library is a page from Find, not a fourth tab; New show asks which show and how to start,
  never the kind; the review is the show space's make page, not a desk screen of its own; a commissioner's rulebook is a
  player's (rulebooks are made per season now); a shape earns its place by two real shows passing a test over their blocks,
  and the desk picks which one's rulebook becomes the template.
- **Checks:** `scripts/dev-test/check-new-library.js <outDir> [--width=390] [--keep] [--api]` (91 PASS at 390) on
  new-fixture.js, its own `zt_nd_desk`, `fake-listings.js` (plus ZT Rally and ZT Speedway, race series; ZT Harbour Crew, ZT
  Coast Guard and ZT Yacht Life Riviera, reality series; ZT Night Desk, a talk show, added by the check) and `fake-bot.js`:
  the library and its 403, a made rulebook in the Inbox and the library, Looks right to us (casey's couch; alex's refused),
  Take it over and its Undo, Fits these games, Save as a starting point and a fix on it, templateFor (the Riviera prompt
  starts from it), on and off, New show from a listing to the template to Looks right, a series and a talk show end to end, a
  set-up show's next season, a show added by name (Looks fine, Undo, Archive), the Race series shape from proposed to earned,
  and every real league and earlier rulebook unchanged; then the browser as the desk and as casey. `tests/rulebook-shapes.test.js`
  (3). Fixed on the way for
  check-new-desk: the fixture's own shows (made by a zt user, no listing) read as shows added by name, so the Inbox's Show kind
  is only for a show that isn't a game yet. The rest pass, one at a time: check-new-start-game (75), -make-it (81), -watching
  (114), -solo (92), -way-in (85), -couches (114), -hub (75), -draft (90), -settling (96), -results-ways (89), -ours (89),
  -desk (100 on its own; its "every league renames him" failed once in the batch, as before), -community (82), -backstage
  (67), -backstage-ii (116), -show (69), -shell (46), -reveal (49), -stats (57), -chat (52), check-foundation, check-preview
  and check-backup-restore; `npm test` 571 of 571; type-check clean; lint (src) as before (the old error in classic's
  `use-sheet-swipe.ts` and the old warning in `episode-results.ts`).

### Step 11, in three parts

Too big for one session (written 2026-10-26, at its start). Each part ends with its As built, its Preview entries out and the
checks passing; step 11 is marked done after part 3.

1. **The guide on the couch's shows, and Hide from guide.** "This week on the couch" (the mock's index.html guideDays and card,
   tvguide.js) made real for your shows and the couch's: seven days from today in the phone's own time zone (Today, or Tonight
   after 5 PM, with the Now line; Tomorrow; then the weekday), each episode from its season's schedule (`schedule.ts`:
   research's starts, the listings' `season_episodes` rows, else weekly from the premiere), never a title or a result. Your
   shows full, one you watch but don't play dashed, a couch show you don't follow faded a step more; faces of who on the couch
   watches it; a dot when one of your moves is due for it; On now while it airs; Same time when two start together; "Nothing
   tonight · Next up"; a streaming season dropping this week as one card ("All 8 drop"). A card opens the show; a couch show
   you don't follow opens its sheet (Add to my shows, Hide from guide, Open the show). **Hide from guide** (migration 0125
   `guide_hidden`: a person's hidden shows, by show or by listing): "N hidden" under the guide and its sheet with Show again;
   your own shows can't be hidden. The home read carries each show's week. From Noticed: the catalog read on every signed-in
   page (read only when Add a show opens). Backups take `guide_hidden`. Preview: `hub.guide` narrows to its Also on half
   (`hub.all-of-tv`, part 2). Check: `check-new-guide.js` on a new `guide-fixture.js`.
2. **All of TV, and the daily job.** `tv_listings` (migration 0126): eight days of the US schedule and streaming drops in
   English from TVmaze's `/schedule` and `/schedule/web` (no news), refreshed once a day by a job that rides on the bot
   clock's calls (`/api/cron/bot-research` with CRON_SECRET: the VM already calls it at least every six hours, and each call
   wakes Neon anyway; the refresh runs after the response, at most once a day, never in a call that ran a bot job), plus
   `/api/cron/listings` (CRON_SECRET) for checks and a run by hand. The same job keeps listing seasons current (Noticed: "A
   season made from its listing goes stale", through TVmaze's `/updates/shows`), makes a listed show's next season when the
   listings announce it (Noticed: "A listed show's next season isn't offered"; a set-up show's plays by last season's rulebook,
   step 10 part 3), and links a show added by name to a listing in the week's schedule with the same name (Noticed: "A show
   added by name has no schedule"). The guide's **Also on**: what else is on that evening, shorter and faded, the most watched
   few per day and "N more on TV" (the evening in a sheet), each with Add to my shows (Add a show's listing path) and Hide from
   guide, read from `/api/listings/week` (the same for everyone, cached at the edge an hour). fake-listings.js learns
   `/schedule`, `/schedule/web` and `/updates/shows`. HOSTING.md: the job, the table, the read. Preview out: `hub.all-of-tv`.
3. **Planned nights.** Plan a watch along (the mock's watching.js inviteWatch and streaming.js plans): the live airing or a
   shared start, for the next episode or another, inviting people on the couch (migration 0127 `watch_plans`,
   `watch_plan_people`), from the show's Tonight and ⋯ menu and a guide card's sheet; the guide tags the airing ("Watch
   along") or shows the night as a card of its own; I'm in / Can't make it, Cancel; a push to those invited and a line on the
   hub's feed. Watch along itself stays step 13 (its Join and Open stay Preview). Backups take the plans. Marks step 11 done.

### As built, step 11 part 1 (2026-10-26, on `new-design`): the guide on the couch's shows, and Hide from guide

Migration **0125** (ships with 0b's, same rehearsal): `guide_hidden`, a person's hidden shows (a show here, with its listing's
id when it has one, or a TV listing nobody has made a show of). Nothing polls and nothing runs on a schedule (HOSTING.md). New:
`src/lib/game/guide.ts` (pure), `src/lib/server/guide.ts`, `POST /api/me/guide/hidden`; `src/new/hub/guide.tsx` rewritten.
- **The week** (the mock's guideDays and card): the home read gives each of your shows and the couch's a `week` (`guide.ts
  weekOf`): the episodes airing from a day and a bit back to eight days on, when each starts and how long it runs, never a title
  (a listing carries one for every episode). The phone lays them out (`guideWeek`, in its own time zone, by calendar day, so the
  US clock change on Nov 1 doesn't move a day): Today (Tonight after 5 PM) with the Now line above the first thing still on,
  Tomorrow, then the weekday; shows starting at the same moment in one Same time group (yours first, then the couch's); a double
  episode, or a streaming season's whole drop, as one card ("All 8 drop": a binge season's episodes share its `drop_at`); On now
  while it airs; the due dot on the episode one of your moves is for; faces of who on the couch watches it (its people's open
  follows, so a private follow is on nobody else's guide); "Nothing today · Next up" (the next thing this week) when today's
  empty, else "Nothing on". The fade ladder: yours in full, one you watch without a game dashed, a couch show you don't follow
  dashed and faded. A card of yours opens the show (its art grows into the show bar); a couch show's opens its sheet: when, who on
  the couch watches it, Add to my shows (where you are, then it's yours), Hide from guide, Open the show. A show without art
  shows its first letter, faint. The minute moves on in the browser (the Now line, On now); nothing is read again. The solo hub's
  guide is "This week", your shows only.
- **Hide from guide** (tvguide.js): a couch show you don't follow (from part 2, a listing too), by any of its seasons: every
  season of the show, and its listing; your own shows (watched or played, any season) are refused (409). The toast has Undo; the
  foot's "N hidden" (its own line) opens Hidden from your guide with Show again. The home read carries `guideHidden`, and a hide
  writes the answer into the cached home (`useSetGuideHidden`), so nothing is read again. The foot says what dashed and faded
  mean, each only when the week has one.
- **From Noticed:** the catalog is read only once Add a show opens (`useCatalog(enabled)`), not on every signed-in page.
- **Backups** hold `guide_hidden`, sliced to the group's people and to its shows or listings (a restored row never points at a
  show the backup doesn't hold); `backup-fixture.js` has a row of each.
- **Fixtures and Preview:** `fixtures/guide.ts` is only Also on now (`ALSO_ON`, by day); `hub.guide` became `hub.all-of-tv`
  (part 2), drawn in each day's column under the real cards, its tag on the first.
- **Changed from the mock:** a card of yours opens the show, not an episode sheet (its Tonight says the same and more); "Dashed:
  not playing yet" and "Faded: not on your shows" both show when the week has both (tvguide.js swapped one for the other); a
  drop's tag isn't yellow (the yellow rule, as 0d's port had it); the hidden count is a line of its own; faces are the account's
  initials (Noticed's two names, step 15).
- **Checks:** `scripts/dev-test/check-new-guide.js <outDir> [--width=390] [--keep] [--api]` (58 PASS at 390) on new-fixture.js
  plus the new **`guide-fixture.js`** (ZT Late Show nightly, which alex and riley watch; ZT Live Now on the air, alex's private
  follow; ZT Drop Show, all eight in two days, riley's and jordan's; ZT Same Night, alex's, starting with the couch's Traitors):
  the week's data (no titles, the drop at one moment, Same time), privacy (alex's private show nowhere in riley's home, jordan's
  private Traitors not in alex's), Hide from guide's rules (a couch show, own shows refused, bad requests, a listing, a listing
  that's a show here, Show again), then the browser as alex (seven days, the Now line above On now, Same time yours first, All 8
  drop, the due dot, dashed and faded, the legend, the hub not reading the catalog until Add a show opens, Also on's Preview, the
  couch show's sheet, Hide with Undo, 1 hidden and Show again, Add to my shows from the guide, a card opening its show) and as
  casey (hiding the Late Show leaves Nothing today · Next up). `tests/guide.test.js` (6, the clock change included).
  check-new-hub and check-new-shell look for `hub.all-of-tv` now (and check-new-shell finds the show's poster on Your shows, not
  any link holding its art: the guide's card is one too). The check passes at 1280 too; and the rest pass, one at a time:
  check-new-library (91), -start-game (75), -make-it (81), -watching (114), -solo (92), -way-in (85), -couches (114), -hub (75),
  -draft (90), -settling (96), -results-ways (89), -ours (89), -desk (100), -community (82), -backstage (67), -backstage-ii
  (116), -show (69), -shell (46), -reveal (49), -stats (57), -chat (52), check-foundation, check-preview and
  check-backup-restore; `npm test` 577 of 577; type-check clean; lint (src) as before (the old error in classic's
  `use-sheet-swipe.ts` and the old warning in `episode-results.ts`).
- **Noticed, left as is:** two, now in Noticed, not fixed: after midnight is the next day, and the guide says Paused under
  reduced motion. Taken out: the catalog read on every signed-in page (fixed, above).
- **For part 2:** Also on is `AlsoOn` in guide.tsx, from `ALSO_ON`; the real one comes from the listings read, less your shows
  and the couch's (every season header now carries `show.tvmazeId`) and what's hidden (`guideHidden`'s listing rows;
  `guide.hideListing` and the endpoint's `{ tvmazeId, name }` are there). The foot's legend and "N hidden" already count
  listings.

### As built, step 11 part 2 (2026-10-26, on `new-design`): all of TV, and the daily listings job

Migration **0126** (ships with 0b's, same rehearsal): `tv_listings`, a row per evening airing or streaming drop for the week
(the episode's TVmaze id, the day it was listed under, the show's id, name, type, network, country, art and popularity, when it
starts and runs, its season and number, whether it's a drop; never a title). **Not in the backups:** it's TV data fetched again
every day, not anyone's choice, so `backup-common.js`, `backup-leagues.js`' slices and `backup-fixture.js` are unchanged (a
person's hidden listing is `guide_hidden`, which is backed up). Nothing polls and nothing wakes the database on its own
(HOSTING.md). New: `src/lib/game/tv-listings.ts` (pure), `src/lib/server/tv-listings.ts` (the job and the read),
`src/lib/server/cron.ts` (`requireCron`, now shared by both cron routes), `/api/cron/listings`, `/api/listings/week`;
`listings.ts` gains `scheduleDay`, `webScheduleDay` and `updatedShows`; add-show.ts exports `listedSeason` and `termsOf`.
- **The job** (`refreshListings`): once an Eastern day, after the answer of a bot clock call that ran no bot job (`after()` in
  `/api/cron/bot-research`, whose answer gains `listings: true` when it queued it; the VM is unchanged and ignores the field).
  The day is claimed in one statement on `app_settings 'listings'` (one run at a time; a run that failed or stopped is tried
  again an hour on, at the clock's next call), and the row keeps the last run (days read, rows, seasons read again and made,
  shows linked, errors). Each part goes on if another fails; a day TVmaze didn't answer keeps its old rows. Calls to TVmaze
  itself are spaced 0.7 s apart. `/api/cron/listings` (CRON_SECRET): GET its status, `?run=1` runs it only if today's run hasn't
  happened (a backstop cron's call: written up in HOSTING.md, not set up), POST runs it now (409 while one runs). Both cron
  routes reach a check's stand-in through `x-gys-listings`, as the proxy does.
- **What it keeps** (`scheduleRows`): eight days (today in the East and the seven after) of `/schedule?country=US` and
  `/schedule/web`: the evening (an air time from 5 PM to 3 AM where it airs: daytime is never shown) and streaming drops (no air
  time), never the news; streaming only in English on a US or worldwide service (a UK or New Zealand service's shows can't be
  watched here: a refinement of "streaming in English only"). An episode on a network and its streaming service at once is one
  row (the network's). Measured on a real day (2026-10-27): 55 rows of TVmaze's 203 entries, 12 of them drops. Days before
  yesterday go.
- **Listing seasons kept current** (from Noticed, "A season made from its listing goes stale"): every run moves a listing season's
  status on by date (no TVmaze call), and a show TVmaze's `/updates/shows` says changed since the last upkeep (only shows with a
  season made from a listing; at most 40 a run) has its seasons still going, or finished within a fortnight, read again with
  add-show's `listedSeason`, which never writes over research's or an admin's rows. It asks `since=day`, or `week` when the last
  upkeep (`keptAt` on the run) was over 23 hours ago (runs are once an Eastern day on six-hourly calls, so up to ~30 hours
  apart), and keeps only shows changed since an hour before it.
- **A listed show's next season** (from Noticed, "A listed show's next season isn't offered"): when a changed show's newest season
  here came from its listing and the listing has a later season with a premiere date, the job makes it (Add a show then offers
  it like any season here); a set-up show's plays by last season's rulebook (`ensureSeasonRulebook`, as the desk's New season
  does). Seasons that come from the desk (the newest has no listing) are left to the desk.
- **Linked by name** (from Noticed, "A show added by name has no schedule", which stays open for shows that never air here):
  a show here with no listing whose name matches exactly one show in the week's schedules (`sameShow`: same name, same country;
  any show of the day but the news, daytime too) gains the link (`tvmaze_id`, the listing, its art if it had none, and its kind
  and terms while it isn't a game yet). A show added by name also gives its one empty season (no premiere, air time or episodes)
  to the listing's: its number (unless a game is on it: leagues name a season by number) and every episode's air time.
  **Decided on the way:** this links an admin's shows too (only the link, never their seasons), as Add a show's
  `showForListing` already did on demand: otherwise a show set up before the listings (Survivor) has no TVmaze id, and Also on
  would list it again under its own card. Also on also leaves out a listing named like one of your shows that has no link yet.
- **The read** (`/api/listings/week`, `listingsWeek`): from yesterday on, a show's episodes starting together as one airing
  (`weekListings`: a drop's, a double episode), the same for everyone, `s-maxage=3600` at the edge; read once a visit by the
  hub (`useListingsWeek`, an hour in the browser).
- **Also on** (the mock's tvguide.js; `AlsoOn` in guide.tsx on `alsoOn`): each guide day's evening (from 5 PM to the day's end at
  3 AM, a drop all day), less your shows, the couch's and what you've hidden (by listing, or by name for a show with no link
  yet); today without what's over. The three most watched (TVmaze's weight) in time order, faded a step more than a couch show,
  each with its time (a drop's "Streaming") and a line ("S35 · ABC", "Netflix · 3 episodes", "Special · NBC"; a daily show's
  year-numbered season left out); "N more on TV" opens the evening (**Tonight on TV**, Tomorrow, the weekday: every listing,
  drops first then by time, each with Add to my shows and Hide from guide). A card opens the listing's sheet (the mock's
  tvShowSheet: when, "Nobody on the couch watches it yet" (on the solo hub "it joins your guide"), Add to my shows, Hide from guide). **Add to my shows** opens the new
  `listing` watching sheet: where you are, read from the listing's season (`/api/listings/[id]`), then `POST /api/me/shows
  { listing }`, as Add a show does; the show then leaves Also on and joins your guide. **Hide** is `guide.hideListing` with
  Undo, counted in "N hidden" and back with Show again. A day with only listings says "On TV" and drops its "Nothing on" (Next
  up stays). The foot credits TVmaze (CC BY-SA), as do both sheets. Never a title: the read has none.
- **After midnight is the night before's** (from Noticed): the guide's days now run from 3 AM to 3 AM (`DAY_STARTS_AT`,
  `startOfLocalDay`, `addLocalDays`, `eveningAt`), so a 12:35 AM talk show sits at the bottom of the night before, and at 1:30
  AM today is still last night ("Tonight", its date). A drop at 1 AM moves to the night before too; one at 3 AM (midnight
  Pacific, Netflix's) stays on its day.
- **Fixtures and Preview:** deleted `fixtures/guide.ts` and `hub.all-of-tv`; step 11 has no Preview entries left.
- **Changed from the mock:** the most watched few and "N more on TV" with the evening in a sheet (the mock listed every listing
  under each day, from a handful of fixtures); a drop's tag reads "Streaming"; the evening sheet is new; the credit line in the
  foot.
- **Checks:** `scripts/dev-test/check-new-listings.js <outDir> [--width=390] [--keep] [--api]` (75 PASS at 390) on new-fixture.js,
  guide-fixture.js, `fake-listings.js` (now with `/schedule`, `/schedule/web`, `/updates/shows` worked out from its shows, and
  `oneNight` for a show airing at a given moment) and `fake-bot.js`: the job never in a call that ran a bot job (a ZT season's
  quick check made due), then queued by a call with nothing due and once a day, the cron route (the secret, status, by hand, 409
  while running, `?run=1`, the listings down), the upkeep's window (the week's changes first, then the day's; a show changed
  before the last upkeep not read again; `tv.changedAt` in the stand-in), what's kept and left out, no titles in the table or the read, the edge cache, a
  drop as one airing, a changed season read again (research's row kept, status by date), a show not changed not asked about,
  a next season made (with a rulebook for a game), linking by name (a show added by name takes the listing's season; a show with
  a schedule and the couch's Traitors only gain the link); then the browser as alex (tomorrow's Also on, his and the couch's
  shows left out, the drop's day, the credit, a listing's sheet, Hide with Undo, the evening sheet with 12:35 AM last, hiding
  there and Show again, Add to my shows from it, the show added by name on his guide at its listing's time). It puts back any
  real `tv_listings` rows and `app_settings 'listings'`, and refuses to call the bot clock when a real season could have a bot
  job due (as check-new-settling). `tests/tv-listings.test.js` (6) and `tests/guide.test.js` (7: the 3 AM day). check-new-guide
  (57) finds no Preview in the guide and knows Tonight runs to 3 AM; check-new-hub looks for no `hub.all-of-tv` and opens each
  hub shape waiting for `load`, not network idle (the week's read is stale-while-revalidate, so the browser answers from its
  cache and refreshes it in the background, a request Playwright never sees finish; harmless for people: a week up to an hour
  old, refreshed quietly); check-new-shell taps Up next's Watch along Preview instead (in both hub shapes). The rest pass, one
  at a time: check-new-library (91), -start-game (75), -make-it (81), -watching (114), -solo (92), -way-in (85), -couches (114),
  -hub (75), -draft (90), -settling (96), -results-ways (89), -ours (89), -desk (100), -community (82), -backstage (67),
  -backstage-ii (116), -show (69), -shell (46), -reveal (49), -stats (57), -chat (52), check-foundation, check-preview and
  check-backup-restore; `npm test` 584 of 584; type-check clean; lint (src) as before (the old error in classic's
  `use-sheet-swipe.ts` and the old warning in `episode-results.ts`). Seen at 390 in the browser: Also on under tomorrow, the
  listing's sheet, the evening sheet, where you are from a listing, the added show on the guide (the mock's tvguide.js layout).
- **Noticed, left as is:** five, now in Noticed, not fixed: network times are the East's, "the most watched" is TVmaze's
  popularity, daily streaming shows are on every day, the job's changes aren't in the desk's History, and no backstop if the VM
  stops calling. Taken out: a season made from its listing goes stale, a listed show's next season isn't offered, after
  midnight is the next day (all fixed, above); a show added by name has no schedule narrowed to shows that never air here.
- **For part 3:** a guide card of yours opens the show (part 1), so planning a night from the guide lives on the couch show's
  sheet (`CouchShowSheet`) and a listing's (`ListingSheet`, which would need the show added first), besides the show's Tonight and
  ⋯ menu. Migration 0127 is next. Nothing in step 11 is Preview now, so check-preview passes either way.
- **Later, 2026-10-27 (on master; migration 0147): the guide's switch, Competitions, and the roll.** The user asked for three
  things. (1) **The roll** (`useRoll`): a tap no longer stops it; it's Paused for 4 s only when you move it yourself (a touch that
  goes further across than down, past 8 px; a sideways wheel or trackpad; anything else that moves it from where the roll put it,
  like a fling's glide; keyboard focus), and Rolling/Paused now says so while it waits. (2) **The switch**, quiet in the foot
  beside Add a show: **Couch** (My shows, solo) · **Competitions** · **All TV**, per phone (`gys.guideTv` in localStorage, held for
  the visit when the phone won't keep it), All TV to begin with; Couch drops Also on and its credit, Competitions keeps only
  listings that are competitions. It shows only once there are listings, and the notes (legend, credit, N hidden) go under it.
  (3) **Which listings are competitions** (`competitionOf` in tv-listings.ts, `tv_listings.competition`, written by the daily
  job): a reality or game show whose TVmaze blurb says what a competition does (compete, contestants, eliminations, a prize,
  crowned, judges, voted out, a winner, a cash figure), and not a game show that's a quiz (questions, trivia, puzzles). TVmaze
  can't say it (Survivor and Below Deck are both "Reality", The Traitors a "Game Show"; its genres don't help), so it reads the
  blurb, which nothing kept before. Measured on 158 reality and game shows in ten days of real schedules: 46 in, three wrongly
  (House Shock, Million Dollar Nannies, Ugliest House in America), and a few competitions missed that never say so (Love Is
  Blind, Fear Factor: House of Fear, Lock Upp). A show set up here goes by its own kind instead, on read (`listingsWeek` joins
  `shows` on the listing: Below Deck is a series however its blurb reads). Rows written before 0147 say false until the job's
  next daily run rewrites the week. **Checks:** `tests/tv-listings.test.js` (8); check-new-guide's roll on a phone with motion (a
  tap and a swipe up the page leave it rolling, a swipe across and a sideways wheel pause it, it rolls on); check-new-listings'
  switch (blurbs in `fake-listings.js` `oneNight`'s new `summary`; the couch's Traitors a competition by its kind), and its read
  gains `competition`. check-new-guide all passed; check-new-listings passed but for one timing step (Noticed, not fixed). Seen
  at 390 and 360 in both themes. Not in What's New yet (the user approves those).
  **The same day, after the user tried it:** Competitions was empty on production because the week's rows were written before
  0147 (all false; only Survivor, by its kind, and it's the couch's). The job's run now carries a version (`RUN_V` 2 in
  server tv-listings.ts): a run from before it is due again on its own day, so the clock's next call (its check-in every few
  hours) rewrites the week. And, the user's calls: **Couch is the default** (a phone that picked another keeps it); the foot
  loses its legend and the TVmaze credit (the credit stays on a listing's and the evening's sheets, and Add a show's); the
  dashed edge for a show you watch without playing is gone, and instead a **white controller** sits top right on any card whose
  season has a game going (yours or the couch's, not archived: `GuideShow.games`), a move due its red dot. check-new-guide and
  check-new-listings follow (Couch first, Competitions kept over a reload), check-new-plans taps All TV for its listing.

### As built, step 11 part 3 (2026-10-26, on `new-design`): planned nights

Migration **0127** (ships with 0b's, same rehearsal): `watch_plans` (a couch's night for one episode of a season: the live airing
or a shared start, when, who planned it, `cancelled_at` for Undo; one going per couch, season and episode, by a partial unique
index) and `watch_plan_people` (who's asked and what they said: invited, in or out; `invited` false for whoever planned it and
for anyone who joined on their own). Nothing polls and nothing runs on a schedule (HOSTING.md). New: `src/lib/server/watch-plans.ts`,
`GET/POST /api/seasons/[id]/plans?couch=`, `POST /api/plans/[id]`, `src/new/couch/watch-plans.tsx` (`openPlan`, `PlanSheets` in
the signed-in layout, `PlanPlates`, `PlanInvite`); `src/lib/game/guide.ts` gains `GuidePlan`, `withPlans` and `guideWeek`'s plans.
- **Planning** (the mock's watching.js inviteWatch and streaming.js's): which episode (from your next one, so someone behind gets
  aired ones; six at most, in a sideways row, "planned" on one the couch has, which when picked shows that night to say you're
  in), how (the live airing, only for an episode still to air and never a streaming drop; or a shared start: one of four days from
  when it's out and 8 to 10 PM, nothing before it's out or already past, 9 PM by default), who (everyone else on the couch; those
  who watch it openly or play it here invited by default, the rest "new to it"), Send invites. The server checks the same and more
  (on the couch, inviting people on it and not yourself, within two months, the episode has a time) and answers 409 for a second
  night for the same episode. **One push to each person invited** ("alex planned a watch along" · "ZT Survivor 51 · Episode 6 ·
  the live airing, Thu 8:00 PM EDT. Are you in?", in the show's own zone; push-core's `invite` setting), opening the show's Tonight.
- **A plan** carries when (the live airing's time read from the schedule each time, so a moved airing moves it), which episode and
  who's in, never a title or a result; the couch it's on sees it (planning a show you watch privately is your choice to show it).
  The home read carries your couches' nights still to come (`plans`); every write answers with them, put into the cached home
  (`useSetPlans`), and the hub's feed and the plan sheet's read go again.
- **I'm in / Can't make it** (`{ answer }`): anyone on the couch, invited or not (joining it); whoever planned it is in, and calls
  it off instead. **Call it off** (`{ cancel: true }`, whoever planned it; tier 1): the toast's Undo (`{ cancel: false }`) brings it
  back with everyone's answers, refused once someone has planned that episode since. A night that's over leaves the home and
  can't be answered.
- **Where it shows.** Tonight, under the Watch along card: a plate for each of the couch's nights on this show (the mock's w-plan:
  "Episode 6 · Thu 8:00 PM", the live airing · who's in; I'm in for whoever hasn't said, Open for whoever's in, Preview: Watch
  along is step 13's), then Plan a watch along (the mock's w-inv) while your next episode has none. The ⋯ menu's Plan a watch along
  (any episode). The plan's sheet (a plate's tap, a guide card): when, everyone and their answer, I'm in / Can't make it, Call it
  off, Open the watch along (Preview), Open the show. **The guide:** a night planned for an airing tags its card ("Watch along",
  a solid teal edge: the mock's b-together); any other (a shared start, or a show that isn't on your guide) is a card of its own at
  its time ("Watch along · Ep 1", "you + 2" or "riley + jordan" with who's in: the mock's b-plan) that opens the plan, tied as its
  show is, not faded while you're in it; a night you can't make is left off, and so is one for a show you've hidden unless you're
  in it. A couch show's sheet shows its nights (I'm in) and plans one for that episode; a TV listing's sheet plans one once it's
  your show (Add to my shows' where you are, then the plan sheet: `openWatching`'s new `then`). **The hub's feed:** "alex planned a
  watch along · Survivor 51 · Ep 6 · the live airing · Thu 8:00 PM · 3 going", opening the show; a called-off night leaves it.
- **Backups** hold both tables, sliced to the group's couches and seasons (`backup-common.js`, `backup-leagues.js`);
  `backup-fixture.js` has a night with two people in it.
- **Fixtures and Preview:** none added or taken out (step 11 had none left); a plate's Open and the sheet's Open the watch along
  are `show.watch-along` (13). check-preview passes with step 11 done.
- **Changed from the mock:** the episode is a choice (the mock's was the next airing); a shared start has days (the mock's for a
  weekly show had times on the airing's day only); I'm in on the plate, where the mock had only Open or Join (Join is Watch along's,
  step 13); one night per couch and episode (the mock kept one per show); an aired episode's line ("Episode 4 has aired · one
  shared start").
- **Checks:** `scripts/dev-test/check-new-plans.js <outDir> [--width=390] [--keep] [--api]` (102 PASS at 390) on new-fixture.js,
  guide-fixture.js and fake-listings.js (its own listing tomorrow at 9 PM, also put into `tv_listings` and taken out): what can be
  planned, the refusals, the home's plans for whoever planned, the invited, someone not invited and another couch, answers, the
  feed's line, a moved airing, Call it off and Undo (refused once someone planned it since), a night that's over; then the browser
  as alex (Tonight's plate, the ⋯ menu's sheet, a shared start's day and time, Call it off with the toast's Undo, the guide's tag
  and a night as a card of its own, I'm in from it, a couch show's sheet, a listing's Plan a watch along), riley's I'm in on an
  invite's plate, and casey (another couch) seeing none of it. `tests/guide.test.js` (9: a plan tags its airing or is a card of
  its own, a plan on now). The rest pass, one at a time: check-new-listings (75), -guide (57), -library (91), -start-game (75), -make-it (81), -watching (114),
  -solo (92), -way-in (85), -couches (114), -hub (75), -draft (90), -settling (96), -results-ways (89), -ours (89), -desk (100,
  after `touch next.config.ts`: a stale compile failed its "every league renames him" in the batch and once alone), -community
  (82), -backstage (67), -backstage-ii (116), -show (69), -shell (46), -reveal (49), -stats (57), -chat (52), check-foundation,
  check-preview (step 11 done) and check-backup-restore; `npm test` 586 of 586; type-check clean; lint (src) as before (the
  old error in classic's `use-sheet-swipe.ts` and the old warning in `episode-results.ts`). Seen at 390 in the browser: Tonight's
  plates, the plan sheet (planned, live, a shared start), the plan's sheet, the guide's tag and plan card, the couch show's and
  the listing's sheets, the feed, riley's invite.
- **Noticed, left as is:** four, now in Noticed, not fixed: a called-off night tells nobody, a plan's push says the show's time
  zone, a shared start is an evening on four days (and one night per episode), and Up next doesn't mention a planned night; Tell
  the couch uses the invite setting now covers a night's invites too.
- **Step 11 is done.** For step 12: Commercial break, Tonight's Extras and the Games tab still carry step 12's Previews
  (`hub.episode-games`, `show.episode-games`, `hub.verdicts`, `hub.taste-twin`); Noticed has its items (predictions as chips, the
  pool's Who goes home? as a per-person call, couch accolades from ratings). Migration 0128 is next.

### Step 12, in three parts

Too big for one session (written 2026-10-26, at its start). Each part ends with its As built, its Preview entries and fixtures
out and the checks passing; step 12 is marked done after part 3. One check grows with the parts:
`scripts/dev-test/check-new-episode-games.js`.

1. **Rate it, couch verdicts and the taste twin.** `episode_ratings` (migration 0128): one to five stars and an optional one-line
   take per person and episode, only for an episode that's aired and that you've seen (your mark). Rate it on Tonight (Extras,
   for the latest episode you've seen; a show you only watch too), each episode you've seen on Episodes (the couch's score and
   yours), the episode page, and the rate sheet (the mock's rateSheet and rate5: the stars, then the couch verdict with everyone's
   stars and takes, "You agree with the couch" or the contrarian's line). Solo, the verdict is everyone on Game Your Show's
   (the mock's soloTonight). On the hub: Couch verdicts made real (the mock's couchpages.js verdictsPage: per show you've started,
   the latest episode you've seen, the big score, everyone's stars, a take on a plate, the score by episode), your taste twin
   and Agree with the couch on the profile, and the couch accolades ratings can say (taste twins, the contrarian, never misses a
   rating; from Noticed). Spoiler-safe: a rating, a take or a verdict about an episode only for someone who's seen it, and only
   from people on the couch who share that show. Preview out: `hub.verdicts`, `hub.taste-twin` (and `fixtures/verdicts.ts`).
2. **Call it and polls.** Call it at couch level (the mock's callSheet and predictSheet): a call per person and episode (who goes
   home, and the show's other one-tap calls), private until airtime, graded from the season's shared results, with the public
   pool's Who goes home? read as the same call (Noticed: "the pool's Who goes home? is the pool's own"); a prediction's options
   as chips (a cast pick, yes / no: Noticed's "Predictions are a text field"); polls anyone on the couch starts for an episode
   (the mock's pollSheet and banishSheet), votes hidden until the poll closes; **Weekly Calls**, the talk-show season game built
   from Call it (`rulebook-fits.js` stops saying `soon` for it).
3. **Bingo and trivia, and Commercial break's episode games.** `bingo_cards` and `bingo_marks` (a card per person and episode from
   the show's moments, marks while you watch, lines; a mark only for someone who's seen the episode), trivia (questions from a
   finished season's facts: the mock's triviaSheet), Commercial break's This week only, the Games tab's This week and Tonight's
   bingo row on real data, the solo hub's trivia, and **Weekly Bingo** (the talk show's other season game). Preview out:
   `hub.episode-games`, `show.episode-games` (and `fixtures/episode-games.ts`). Marks step 12 done.

### As built, step 12 part 1 (2026-10-26, on `new-design`): Rate it, couch verdicts and the taste twin

Migration **0128** (ships with 0b's, same rehearsal): `episode_ratings` (a person's one to five stars and optional one-line take,
140 characters at most, per season and episode). Nothing polls and nothing runs on a schedule (HOSTING.md). New:
`src/lib/game/ratings.ts` (pure: the average, you against the couch, the taste twin, agreeing with the couch, the accolades),
`src/lib/server/ratings.ts`, `GET/POST /api/seasons/[id]/ratings/[n]?couch=`, `GET /api/couches/[id]/verdicts`,
`src/new/show/rate.tsx` (`openRate`, `RateSheets` in the signed-in layout, `RateRow`, `VerdictMark`, `rateLabel`); `guard.ts`
gains `seenThroughAll` (every season's mark in one query).
- **A rating (decided):** a person's, not a couch's (as where you are is): one per episode, counted on every couch they're on;
  whole stars, 1 to 5 (the mock's taps; its half stars were made up); a take is optional, tidied, 140 characters, `""` takes it
  away and stars alone keep it. Only for an episode you've seen (your mark: 403 otherwise), and with spoiler protection off
  (results straight away) only one that's aired (409). Rating again changes it; nothing removes it (Noticed).
- **Whose verdict:** the couch's when someone else is on it: the average of everyone on it who rated the episode and follows the
  show openly (guard.ts visibleFollows), you included. On no couch or a couch of one (`show.solo`) it's everyone on Game Your
  Show's, a number only: strangers' names and takes never leave the server. A private watcher's stars count for nobody else,
  not even in everyone's average (on an app this size a count could say who). Beside a couch's verdict, everyone's is a quiet
  line once more than the couch has rated it.
- **Spoiler-safe on the server:** a rating, a take or a verdict about an episode only for someone who's seen it. The sheet's read
  is 403 past your mark; the Episodes read carries a verdict only on rows you've seen (`EpisodeRow.verdict`; `seasonVerdicts`
  reads nothing past your mark); Couch verdicts shows each show at the latest episode you've seen and that's aired; the hub's
  taste and accolades count only episodes within your mark on each season (in the check, sam on 3 sees the couch's taste twins
  "on 3 of 3 episodes" where alex sees "3 of 5"). A rating says you've seen that episode, as a reveal line in chat does; step
  15's What your couch sees ("Only what games need") could hide ratings.
- **The rate sheet** (the mock's watching.js rateSheet, episode.js rate5 and the watch along's rate-it, one sheet opened with
  `openRate`): "How was Episode 5?", "Survivor 51 · then the couch verdict"; five stars (a tap saves; they move at once); before
  you rate, "3 on the couch rated it · tap your stars to see the couch verdict" (the verdict waits for your stars here, as the
  mock's rate5 said, so nobody's anchored; Episodes and Couch verdicts show it without, as the mock's later pages do); then the
  verdict on a plate rising into place (the mock's .verdict: the Couch verdict tag, the average, "from 3 on the couch", one line:
  "You agree with the couch · taste twin: riley" within a star of everyone else's average, "Spicy. You're the contrarian this
  week" a star and a half or more off, "You're the first on the couch to rate it"; everyone's stars as faces; the takes, others'
  first; everyone on Game Your Show), your one-line take with Post, and Done (Not now before you rate). Solo: Everyone's verdict,
  "from 3 on Game Your Show", "You agree with everyone" or "Spicy. Everyone else saw it differently".
- **Where it opens:** Tonight's Extras this week, for the latest episode you've seen that's aired, on a show you follow or play
  ("Rate Episode 5 · Two seconds, then the couch verdict", then "You gave Episode 5 ★★★★ · The couch says ★ 3.7 · from 3",
  Rated; solo, "then see how everyone rated it"); Episodes, where each episode you've seen carries the couch's ★ and "you 4" (on
  a show you only watch with no results, the row opens Rate it, and says Rate while nobody has); the episode page's How was it?;
  Couch verdicts' Rate Episode N and its faces.
- **The hub:** **Couch verdicts** is real (`useCouchVerdicts`, read when the page opens): each show you follow and have started,
  the ones the couch rated lately first, six at most, at the latest episode you've seen: the big score, "★ couch rating · from 3"
  (or Nobody's rated it yet), Rate Episode N until you have, everyone's stars, a take on a plate (the newest someone else wrote,
  else yours), the score episode by episode (the last eight); then the footnote, your taste twin and the couch's contrarian. Its
  row on More on the couch says "How the couch rated N shows". The hub's read (`couch-hub.ts`, `couchTaste`) gains `taste`: your
  **taste twin** (the person on the couch closest to you on average, three or more episodes in common and a star apart at most:
  "The same stars on 6 of 8 episodes", or "Within a star on 7 of 8 episodes" when under half are the same), **Agree with the
  couch** (how many of your rated episodes were within a star of everyone else's average, over three or more that someone else
  rated too) and how many shows have a verdict; and three **accolades** for By the numbers (from Noticed): Taste twins (the
  couch's closest pair, ¾ of a star apart at most), The contrarian (a star or more off everyone else on average, over episodes
  three or more rated) and Never misses a rating (four or more of one show's episodes in a row). Its ratings come from Neon
  compactly: one row per person and season, the episodes and stars as one short string ("1:4,2:5"). The **profile**: Agree with
  the couch takes Seasons played's place once there's enough to say (the mock's third number), and Taste twin: riley is a row.
- **Fixtures and Preview:** deleted `fixtures/verdicts.ts` and the entries `hub.verdicts` and `hub.taste-twin`. `hub.episode-games`
  and `show.episode-games` (`fixtures/episode-games.ts`) are parts 2 and 3's.
- **Backups** take `episode_ratings` (the group's people's ratings on its seasons, sliced as their follows are; `backup-common.js`,
  `backup-leagues.js`); `backup-fixture.js` has two.
- **Changed from the mock:** whole stars; the sheet doesn't close itself after a tap (it has a take now, and Done); Rate it on a
  show you only watch sits in Extras this week as on a show you play (the mock's watch-only Tonight had an "Every episode · Skip
  any, no deadlines" block with it and Call it: part 2 can put Call it beside it); the verdict waits for your stars on the sheet
  only; everyone's stars are the avatars' initials (Noticed); the solo verdict is everyone's with no names or takes; the bars run
  from one star to five (the mock's from three); the twin's line counts the same stars or within a star (the mock's "within half
  a star" needs half stars).
- **Checks:** `scripts/dev-test/check-new-episode-games.js <outDir> [--width=390] [--keep] [--api]` (92 PASS at 390) on
  new-fixture.js plus solo-fixture.js, the check that grows with step 12's parts: the refusals (an episode past your mark, stars,
  takes, a season or couch that isn't yours, results-straight-away still only what's aired), takes kept and taken away, each
  verdict (the couch's, another couch's, everyone's with no couch, a private watcher's stars and take counted nowhere), the
  Episodes read (alex's, sam's behind), the hub's taste and accolades (alex's, sam's within his mark, riley's), Couch verdicts
  (alex's, sam's, riley's two shows), solo; then the browser as alex (Tonight's row, the sheet, three stars and a take, Episodes'
  marks, the episode page, the hub's row and Couch verdicts, the profile, By the numbers), sam (Rate Episode 3, the verdict
  waiting for his stars, nothing about 4 or 5), riley (the Traitors, a show she only watches) and zt_so_alex (solo, everyone's
  verdict). `tests/ratings.test.js` (5). Updated: check-new-hub (Couch verdicts real). The rest pass, one at a time: check-new-plans (102),
  -listings (75), -guide (57), -library (91), -start-game (75), -make-it (81), -watching (114), -solo (92), -way-in (85), -couches
  (114), -hub (75), -draft (90), -settling (96), -results-ways (89), -ours (89), -desk (100, after `touch next.config.ts`: a stale
  compile failed its "every league renames him" in the batch, as in step 11 part 3), -community (82), -backstage (67),
  -backstage-ii (116), -show (69), -shell (46), -reveal (49), -stats (57), -chat (52), check-foundation, check-preview and
  check-backup-restore; `npm test` 591 of 591; type-check clean; lint (src) as before (the old error in classic's
  `use-sheet-swipe.ts` and the old warning in `episode-results.ts`). Seen at 390 in the browser: Tonight's row, the rate sheet
  (before and after rating, a take, solo's), Episodes' marks, the episode page, Couch verdicts, the profile and By the numbers.
- **Noticed, left as is:** three, now in Noticed, not fixed: a rating can't be taken back, the verdict's faces are initials, and
  the sheet's taste twin comes from the hub's read. Couch accolades from ratings came out of Noticed's accolades item.
- **For part 2:** Call it and polls. The rate sheet's host (`openRate`/`RateSheets`) is the pattern for the call sheet; Extras this
  week is where Call it's row sits beside Rate it (on a show you only watch too); rows keyed (person, season, episode) and read
  through `seenThrough` are how a call can be kept per person; the hub's `taste`/accolades shape is where a "called it" accolade
  from calls would join. Watch along's end (step 13: "How was Episode N?" with a take) should open `openRate` rather than build a
  second rating.

### As built, step 12 part 2 (2026-10-26, on `new-design`): Call it, polls and Weekly Calls

Migration **0129** (ships with 0b's, same rehearsal): `episode_calls` (a person's call per season, episode and question),
`episode_call_says` (what someone who's seen a talk show's episode says happened), `couch_polls` and `couch_poll_votes`. Nothing
polls and nothing runs on a schedule (HOSTING.md). New: `src/lib/game/calls.ts` (pure: `callQuestions` and `callMoments` from a
rulebook, `verdictOf`, `isRight`, `settleSays`, `tallyCalls`), `src/lib/server/calls.ts` (`GET/POST /api/seasons/[id]/calls/[n]?couch=`,
`episodeFacts`, `callRights`, `leagueCalls`, `callsMade`, `weeklyCallMoves`), `src/lib/server/polls.ts` (`GET/POST
/api/seasons/[id]/polls?couch=`, `POST /api/polls/[id]`, `GET /api/couches/[id]/this-week`), `src/new/show/calls.tsx` (`openCall`,
`CallSheets` in (in)/layout, `CallRow`, `CallResultRow`, `CallResults`), `src/new/show/polls.tsx` (`openPoll`, `PollSheets`,
`PollRow`, `StartPollRow`), `scripts/dev-test/talk-fixture.js`. Engine: a league type `weekly-calls` (NoDraftStrategy, a
CallsScoringStrategy that leaves everyone at 0, `hasCalls`); PickEmLogic's own call storage is gone (`callsOn` stays).
- **The calls (decided):** two one-tap calls an episode, the same for everyone, from the season's rulebook (its own, else its
  format's blocks; never a couch's Make it ours copy). **Who goes home?** (everyone still in going into it, as faces) where a segment
  sends someone home every episode (rulebook-fits.js `goingHomeEachEpisode`, Survival Pool's rule, now exported), then yes-or-no
  moments: "Anyone this episode? · Played an idol or advantage", a talk show's "Tonight? · The host sings". The moment goes round
  the show's most callable ones episode by episode: a twist's first (idols, shields, journeys, U-Turns), else what the rulebook
  added for the show, else a segment that doesn't run every episode; never one research can't answer (the couch's own), a way out,
  or one that gives a secret role away. A show nobody leaves (a series, a sport, a talk show) gets two moments. Stored as `out`
  (a season_cast id) and `m:<moment>` (yes or no; the moment's event id, as the season's results record it through the
  rulebook's aliases, or a talk show's moment id).
- **Private until airtime, spoiler-safe on the server:** calls are open for the next episode to air (the schedule) until it
  starts, changeable until then (`null` takes one back). Before airtime nobody else's call leaves the server, only how many on the
  couch have called it. Calling needs the episode before it seen (the faces say who's still in: sam on 3 is `behind`, gets no
  faces and a 403 to call), except on a talk show, whose calls give nothing away. After airtime the couch's calls and how they
  went reach only someone who's seen the episode; your own are always yours. The couch is its people who follow the show openly,
  as for ratings (a private watcher's calls count for nobody else); solo or on a couch of one, the calls are just yours.
- **Graded from the season's shared results, never stored:** Who goes home? settles once who went home is in (early results: an
  accepted elimination, never the winner's exit), and "Nobody went home" (a noexit fact, or full results with nobody out) calls it
  off; a moment settles once every result is in (an accepted moment that episode, or someone's full answer covering it: the season
  sync's own rule for final), yes when anyone did it. A talk show's moments have no results: whoever's seen it says what happened,
  and two on the couch agreeing settles it (more saying so than not); with nobody else on the couch following the show, your own
  say does (Noticed: research's answers aren't read).
- **A public pool's Who goes home? is the same call** (Noticed's "the pool's Who goes home? is the pool's own" is out): the pool's
  call is your `out` Call it for its pick's episode (`callPool` writes episode_calls against the season's cast: the castaway's
  seasonCastId, else its name), read back as one of the pool's castaways (`leagueCalls`, `game-view.ts poolCallOf`); its board's
  "N called" is right `out` calls through your mark. Called from the pool, it shows in Call it, and the other way round. (No pool
  had calls outside the branch.)
- **Predictions as chips** (Noticed's "Predictions are a text field" is out): a prediction has no options of its own, so its
  words say what it asks (`game-view.ts predictionKind`): "Who …?", "Which castaway …?" get everyone still in as chips (first
  names; the full name is the guess saved); "Will / Does / Is …?" without an "or" gets Yes and No; anything else keeps its field. A
  guess in words already made stays as a chip. Classic's routes and grading are unchanged.
- **Polls:** anyone on the couch who's seen the episode before the next starts one about it: a question (3-80 characters) and the
  cast still in (faces) or 2-4 options of their own; three open at most per show and episode; only whoever started it takes it
  down. Open until the episode airs (following the schedule if the airing moves); before then you see your vote and how many have
  voted; after it, each option's share, who chose it and how many you're with, for whoever has seen the episode (else "see it
  first"). Only the couch's people who've seen the episode before it see it at all. Nobody is pushed (Noticed).
- **Weekly Calls is startable:** rulebook-fits.js gives it the type `weekly-calls` and no `soon` (Weekly Bingo keeps `'12'`); an
  ordinary league on the couch (Start a game, joins, archive, Backstage), whose table counts each player's right calls from its
  start through your mark (`callRights` on its couch, the hub's rankings too) and is through the latest show that's aired and
  you've seen. Its move is the next show's calls (`weeklyCallMoves` on the home: "Make this week's two calls" until both are made;
  Tonight's card and done card, and the dock, open Call it); never "fill in the results" or "Add the cast" (it has neither:
  action-items.js and commissioner-items.ts skip it); out of classic's league list. Its colour is the mock's predictions pink
  (the mock's yellow is for what you must do); Better with friends lists it.
- **Where it shows:** Tonight's Extras: Call it for the next episode (unless Weekly Calls asks for it as a move), the couch's open
  polls, and "Episode 6: you called 2 of 2" for the latest you've seen (a talk show's "What happened? Say"); the Games tab's This
  week: Call it, the polls and Start a poll (bingo and trivia stay Preview); the episode page's Call it; Commercial break's This
  week only (a Call it card per followed show with an episode this week, the couch's polls). The call sheet (the mock's callSheet
  and predictSheet in one): faces and Yes / No, "N on the couch have called it", Lock in my calls (the one yellow; Save my calls to
  change them), the toast saying until when; after, a score plate, who went home, your call and the couch's with ✓ and ✗.
- **Fixed on the way:** a talk show you play Weekly Calls on lists its aired episodes (season-episodes.ts counts only games with
  results of their own as playing); the cast stats crashed on a rulebook whose aliases are `{}` (the library's, so a desk show made
  from a template): `cast-stats.ts` reads them as optional now.
- **Fixtures and Preview:** `fixtures/episode-games.ts` narrowed to bingo and trivia; `hub.episode-games` and `show.episode-games`
  say "Bingo and trivia" now (part 3's).
- **Backups** take all four tables (the group's people's calls and says on its seasons; its couches' polls and their votes);
  `backup-fixture.js` has a row in each.
- **Changed from the mock:** Call it is one sheet for every kind of show (the mock had predictSheet for a competition and
  callSheet for the rest); a show that isn't a game gets no calls (the mock's Below Deck asked "Big twist this week? / Better than
  last week?", which nothing could settle); Who goes home? offers everyone still in as faces (the mock: four names); a poll's
  results wait for it to close (the mock showed them on voting) and a poll is about the next episode.
- **Checks:** `scripts/dev-test/check-new-episode-games.js` grew part 2 (203 PASS at 390, with part 1's) on new-fixture.js,
  solo-fixture.js and the new **`talk-fixture.js`** (ZT Talk Tonight, a talk show set up as a game): Call it before and after
  airtime (the refusals, sam behind, private until it airs, early then final results settling it, the couch's calls, sam and casey
  told nothing), polls (start, refusals, hidden votes, three at most, take it down, closed results, waiting for sam), Commercial
  break's This week only, predictions' chips, Weekly Calls (start, join, its move, the couch saying what happened, its table and
  the hub, no results or cast to-dos, out of classic's list), the pool's call; then the browser as alex (Tonight's Call it and
  sheet, the Predictions tab's chips, This week, a vote changed, Start a poll, Commercial break, the talk show's card and sheet;
  after the episode, Tonight's result row and sheet, the poll's results, the talk show's results and Weekly Calls' table).
  `tests/calls.test.js` (7). Updated for this part: check-new-show (Yes / No chips), check-new-solo (calls in Call it's table),
  check-new-start-game and check-new-library (Weekly Calls startable), tests/start-game and tests/solo. The rest pass, one at a
  time: check-new-plans (102), -listings (75), -guide (57), -library (91), -start-game (75), -make-it (81), -watching (114, after
  one run's browser closed mid-screenshot), -solo (92), -way-in (85), -couches (114), -hub (75), -draft (90), -settling (96),
  -results-ways (89), -ours (89), -desk (100), -community (82), -backstage (67), -backstage-ii (116), -show (69), -shell (46),
  -reveal (49), -stats (57), -chat (52), check-foundation, check-preview and check-backup-restore; `npm test` 598 of 598;
  type-check clean; lint (src) as before (the old error in classic's `use-sheet-swipe.ts` and the old warning in
  `episode-results.ts`). Seen at 390 in the browser: the call sheet before and after, Tonight's rows, the Predictions tab's chips,
  This week, the poll sheets (vote, start, results), Commercial break's cards, the talk show's Tonight, sheet and table.
- **Noticed, left as is:** six, now in Noticed, not fixed: a talk show's calls are only the couch's say, an episode's moment call
  follows the rulebook as it is, polls don't notify, Weekly Calls never finishes, its table's footnote says "reveal", and
  predictions guess their chips from their words; Couch accolades now names Called it most. Out of Noticed: predictions as a text
  field and the pool's own Who goes home?.
- **For part 3:** bingo and trivia, Commercial break's and the Games tab's last Previews (`fixtures/episode-games.ts`), Weekly
  Bingo (`rulebook-fits.js` SOON, a league type beside `weekly-calls`, `leagueCalls`'s shape for its table), and Weekly Calls'
  ending with the season (Noticed). A bingo mark on a talk show's moment could count as that person's say (`episode_call_says`).

### As built, step 12 part 3 (2026-10-26, on `new-design`): bingo, trivia and Weekly Bingo

Migration **0130** (ships with 0b's, same rehearsal): `bingo_cards` (a person's card per season and episode, its nine squares as
JSON, kept from its first tick), `bingo_marks` (a tick per square) and `trivia_plays` (a person's play per show and week: score,
questions, answers). Nothing polls and nothing runs on a schedule (HOSTING.md). New: `src/lib/game/seeded.ts` (a repeatable
shuffle), `src/lib/game/bingo.ts` (pure: `bingoMoments`, `dealCard`, `countLines`, `firstLineAt`, `truthOf`),
`src/lib/game/trivia.ts` (pure: `triviaRound`, `scoreRound`, `weekOf`), `src/lib/server/bingo.ts` (`GET/POST
/api/seasons/[id]/bingo/[n]?couch=`, `bingoLines`, `bingoMove`, `weekBingo`, `leagueBingo`), `src/lib/server/trivia.ts` (`GET/POST
/api/seasons/[id]/trivia?couch=`, `GET /api/me/trivia?couch=`), `src/new/show/bingo.tsx` (`openBingo`, `BingoSheets` in
(in)/layout, `BingoRow`, `BingoResults`, `bingoEpisode`), `src/new/show/trivia.tsx` (`openTrivia`, `TriviaSheets`, `TriviaRow`), the
mock's stamp, line, banner and shake in new.css. Engine: a league type `weekly-bingo` (NoDraftStrategy, CallsScoringStrategy,
`hasBingo`). calls.ts gains `saysOn` (the says that count, bingo ticks among them), `endedThrough`, and exports its scope helpers.
- **The card (decided):** three by three, the centre free, eight of the show's moments (the ones Call it goes round, all of them:
  `callMoments`, what research answers or on a talk show what the couch says; never a way out, a secret role's or the couch's
  own), dealt per person and episode from a seed, so everyone's differs. A show with fewer than eight moments gets free squares in
  the gaps, never a whole line of them (the SNL sample's six: three free); under four, no bingo ("not enough of the show's
  moments"). Kept as it was dealt from your first tick (a rulebook change can't reshuffle it); before that it's dealt each read and
  nothing is stored. The mock's 5×5 had made-up squares ("Jeff says dig deep") nothing could settle; no show here has 24 moments.
- **Ticks:** from the episode's airtime on (before it the card is ready to look at, "Ticks open Sun 8:00 PM"), on any square but
  the free one, ticked and unticked as long as you like; a card for the next episode to air or any that's aired. Three in a row
  (down, across, corner to corner) is a line, and the sheet says Bingo! on your ticks at once.
- **What counts:** a square counts once you ticked it and it happened: the season's results say so once every result for the
  episode is in (`episodeFacts`' events, the calls' own rule for a moment), or on a talk show the couch does (calls.ts
  `settleSays`: two agreeing and more than say otherwise; alone on the show, your own). **A tick from someone who has seen the
  episode is their say that it happened**: `saysOn` reads `episode_call_says` and the ticks together, so bingo settles a talk
  show's calls too (half of Noticed's "A talk show's calls are only the couch's say"), and a say of your own on the moment wins
  over your tick. A tick never says something didn't happen (Noticed). A line counts once its three squares do; a square that
  didn't happen spoils its lines; one that happened that you didn't tick isn't yours (dashed on the card). Lines are worked out
  every read, never stored.
- **Spoiler-safe on the server:** the squares are moments, never a name or anything about an episode, so your own card shows for
  any episode that's aired or is next, and your ticks are yours. Nobody else's card, tick or line, and nothing settled about a
  square, leaves the server until you've seen the episode (guard.ts seenThrough): before, only how many on the couch have ticked a
  square ("2 more on the couch are playing"). The couch is its people who follow the show openly, as for ratings and calls; solo or
  on a couch of one, just your card. Who got a line first: the earliest line finished (its last tick) that still stands or waits.
- **Tell the couch:** with a line, on a couch, the sheet offers a chat message from you ("Bingo! 1 line on ZT Survivor 51 Episode
  7"), folded for anyone who hasn't seen the episode as chat is. The mock posted it by itself; here it's a button.
- **Where bingo shows:** Tonight's Extras ("Your bingo card · Ready for Sunday · ticks open at airtime" for the next episode,
  "Episode 6 bingo · tap squares as it happens" for an aired one you haven't seen, and "Episode 6 bingo: 1 line · You got a line
  first" for the latest you've seen once you ticked it); while the episode's on, a Tonight block ("On air") with your card above
  Your moves (the mock's during phase); the Games tab's This week; Commercial break's This week only (each show's card for its
  next episode); the episode page's Bingo.
- **Weekly Bingo is startable:** `rulebook-fits.js` gives it `weekly-bingo`, and `SOON` is empty (every game that fits starts); a
  talk show recommends it first (KINDS.talk's order). An ordinary league on the couch, its table each player's lines from its start
  through the latest show that's aired and you've seen (`leagueBingo`, as Weekly Calls), the hub's rankings counting them; nothing
  due before a show (no home move: Your moves shows "Your card for Episode 6 · Opens Sun 11:30 PM · tap squares as it happens ·
  Open my card", with a card's icon rather than a tick); never "fill in the results" or "Add the cast"; out of classic's list. Its
  colour is the mock's purple; Better with friends lists it; its rules say how a square counts.
- **A talk game ends with its season (from Noticed):** Weekly Calls and Weekly Bingo are over once the season's last episode (its
  episode count) is within what's aired and you've seen (`endedThrough`): the hub puts them on the trophy shelf with Run it back,
  and the couch's games list takes nobody new; a season with no episode count runs on. Their Games tab footnote says "Standings
  move as you watch and the couch says what happened" (from Noticed).
- **Trivia (decided):** three questions a week (from Monday, UTC) about a show, the same for everyone who's seen the same: who won,
  who left first, who scored the most points, who did a moment most ("Who did this most in ZT Survivor 50? · Won the Immunity
  challenge"), who lasted longer of two, who scored more of two; four faces (two for A or B), never a tie. Only from the show's
  newest season that's over, seen to its end and that someone left (the stats' own facts at your mark: `seasonFactsFor`,
  `castStats`, the couch's game's points), and the season you're on as far as you've seen it (only who left first and who lasted
  longer of two who've both left). Named for the season its questions are about ("ZT Survivor 50 trivia · 3 questions from the real
  season", "ZT Solo 51 trivia · 2 questions so far"). Graded on the server against the round as it stands for you; the week's first
  play is kept and Play again is for fun; the couch's scores this week beside yours ("You beat riley's 1", "Level with riley",
  "riley still holds the couch record"); nobody sees more than a score.
- **Where trivia shows:** the Games tab's This week (a row), Commercial break's This week only (a card per show with a round, three
  at most: "3 questions · riley got 1", "You got 3 of 3"), the solo hub's On your own (this week's round on one of your shows).
- **Fixed on the way:** Start a game's dot for Weekly Calls was the mock's yellow (only for what you must do); both talk games take
  their colours from games.ts now.
- **Fixtures and Preview:** deleted `fixtures/episode-games.ts` and the entries `hub.episode-games` and `show.episode-games`.
- **Backups** take all three tables (the group's people's cards and ticks on its seasons, their trivia plays on its seasons'
  shows); `backup-fixture.js` has a card with two ticks and a play.
- **Changed from the mock:** 3×3 cards of the show's moments, so squares can be settled (above); Tell the couch a button; before
  you've seen an episode, how many on the couch are playing rather than "sam has 3 · riley has 2" (others' ticks wait for your
  mark); trivia from the facts we have (the mock's "most points in Survivor 49" and "first voted out of Survivor 51" are among
  them), its "Posted to the couch chat" left out.
- **Checks:** `scripts/dev-test/check-new-episode-games.js` grew part 3 (285 PASS at 390, with parts 1 and 2) on the same fixtures plus
  hub-fixture.js (ZT Survivor 49 and 50, finished): a card for the next episode (its moments and no names, dealt the same twice,
  each person's own, nothing to tick or keep before airtime), ticks and lines on an aired episode against its results, the couch's
  cards and who got a line first only for someone who's seen it (sam on 3 and casey: a count), the refusals; the talk show's ticks
  agreeing, a tick settling a call, a say of your own winning; Weekly Bingo (start, join, nothing due, its card ready then open,
  lines once both have seen it, the hub), both talk games ending with a five-episode season and running on in a longer one; trivia
  (Survivor 50 for alex, 49 for sam who hasn't finished 50, 51 so far for casey, riley's first play kept, the refusals);
  Commercial break; then the browser as alex (Tonight's rows, the seen and ready sheets, the episode page, This week, trivia to
  3/3, Commercial break, the talk show's Weekly Bingo card and table, Episode 7 put on air: Tonight's card, a line, Bingo!, Tell
  the couch) and zt_so_alex (the solo hub's trivia). `tests/bingo.test.js` (5), `tests/trivia.test.js` (5). Updated for this part:
  check-new-hub (Commercial break has no Preview), check-new-start-game and check-new-library (Weekly Bingo startable),
  tests/start-game. The rest pass, one at a time: check-new-plans (102), -listings (75), -guide (57), -library (91), -start-game
  (75), -make-it (81), -watching (114), -solo (92), -way-in (85), -couches (114), -hub (75), -draft (90), -settling (96),
  -results-ways (89), -ours (89), -desk (100), -community (82), -backstage (67), -backstage-ii (116), -show (69), -shell (46),
  -reveal (49), -stats (57), -chat (52), check-foundation, check-preview (step 12 done, nothing of it on Preview) and
  check-backup-restore; `npm test` 608 of 608; type-check clean; lint (src) as before (the old error in classic's
  `use-sheet-swipe.ts` and the old warning in `episode-results.ts`). Seen at 390 in the browser: the bingo sheet (ready, ticking
  with Bingo! and Tell the couch, seen with the couch's cards), Tonight's rows and its on-air block, the episode page's Bingo, This
  week, the trivia sheet (a question, the score), Commercial break's cards, the talk show's Weekly Bingo card and table, the solo
  hub's trivia.
- **Noticed, left as is:** six, now in Noticed, not fixed: a tick only ever says yes, trivia's answers ride with its questions, your
  trivia reads a dozen seasons' facts, bingo doesn't notify, bingo in a watch along, and a past season counts for trivia only if
  it's marked. Out of Noticed: Weekly Calls never finishing and its table's "reveal" footnote; "A talk show's calls are only the
  couch's say" now counts bingo ticks.
- **For step 13:** Watch along should carry your bingo card (the mock's "your bingo card and lineup come with you": `openBingo` for
  its episode, and the Tonight block's row), and could show the couch's ticks live to whoever's watching the same episode together
  (they've all reached that moment; Noticed); its end's "How was Episode N?" opens `openRate`. Call it closes at airtime, so a
  watch along has nothing of Call it's to carry but how it went once you've seen it.

### Step 13, in three parts

Too big for one session (written 2026-10-26, at its start). Each part ends with its As built, its Preview entries and fixtures
out and the checks passing; step 13 is marked done after part 3. One check grows with the parts:
`scripts/dev-test/check-new-watch-along.js`.

1. **Watch along on your own time: reactions pinned to runtime.** `watch_reactions` (migration 0131: season, episode, runtime_ms,
   user, the couch it was said to, kind, text, gif): a comment, one of four quick reactions or a GIF, said at a moment of an
   episode. The watch along screen (the mock's index.html openWatch and watching.js's wrap of it): a clock you start when your
   episode starts (Streaming, or Live on TV with Ad break), Pause, −10 s and +10 s, Set the time, End; the couch's reactions
   arriving 30 s after their moment as you reach it, never before (the server sends only what's at least 30 s behind your
   position, and nothing about an episode past your next one), the stream of comments, reactions floating up, pins on the
   progress bar for what you've passed; the screen kept on (wake lock); your bingo card from it (`openBingo`); its end, "How was
   Episode N?" (I've seen it on a show you watch, Reveal your scores on one you play, then `openRate`). GIFs from GIPHY behind
   config (Tenor's API closed on 2026-06-30): no `GIPHY_API_KEY`, no GIF button. It polls only while it's open and its clock runs,
   reading the reactions since the runtime it has. Where it opens: Tonight's Watch along card (who on the couch left reactions
   there and how many), Up next's Watch along, Previously on's, the solo hub's. Preview out: `show.watch-along` and
   `hub.watch-along`; a planned night's Open becomes `show.watch-together` (part 3's).
2. **Who's on now, and the live airing.** `watch_sessions` (migration 0132): each open watch along keeps its clock on the server
   (written when it starts, pauses or moves, and a heartbeat while it's open), so the couch sees who's watching right now: the
   watch along's "riley is watching now · 40s ahead" with her mark on the bar, Tonight's card, the hub's On now strip (Preview
   `hub.on-now` and `fixtures/watch-along.ts` out); the live airing's clock from airtime ("Join the live airing"), and catching
   your clock up to someone's. Only the couch's people who share the show see it, never a private watcher.
3. **Together sessions and planned nights.** A shared clock and pause for everyone (a session several people are in: whoever
   pauses pauses it for all, its version polled every few seconds while open), a planned night's Open and Join starting or joining
   it (the live airing's clock, or "3, 2, 1" for a shared start; late arrivals watch along after), Up next's planned night
   ("Watch along · 3 going" with Join: from Noticed), a shared start's own time (from Noticed), the couch's bingo ticks to whoever's
   watching that episode together (from Noticed), and the couch accolades most reactions and most watch alongs (from Noticed).
   Preview out: `show.watch-together`. Marks step 13 done.

### As built, step 13 part 1 (2026-10-26, on `new-design`): watch along on your own time

Migration **0131** (ships with 0b's, same rehearsal): `watch_reactions` (season, episode, `runtime_ms`, user, the couch it was said
to or none, `kind`, `text`, `gif`). **One new poll, only while a watch along's clock runs** (HOSTING.md); nothing on a schedule, no
pushes. New: `src/lib/game/watch-along.ts` (pure: `watchEpisode`, `mayWatch`, `othersThrough`, the clock `clockAt`/`runClock`/
`stopClock`/`moveClock`, `runtimeText`/`parseRuntime`, `cleanGif`/`giphyUrl`, `leftLine`), `src/lib/server/watch-along.ts`
(`GET /api/seasons/[id]/watch?couch=` Tonight's card; `GET/POST /api/seasons/[id]/watch/[n]?couch=&at=&since=&open=1`; `DELETE
.../watch/[n]/[reactionId]`), `src/lib/server/gifs.ts` + `GET /api/gifs?q=`, `src/new/show/watch-along.tsx` (`WatchAlongCard`,
`WatchAlongPage` in the show space's frame, `useOpenWatch`), `paths.watch(seasonId, ep?)`, the layer's motion in new.css.
- **A reaction (decided):** a comment (one line, 200 characters), one of the mock's four quick reactions (fire, laugh, side-eye,
  iconic) or a GIF, pinned to where your clock is in the episode and said **to the couch you're watching with** (as chat is per couch
  and show; on no couch it's yours alone, and on a couch of one it waits for whoever joins). Only the couch's people who follow the
  show openly are heard (a private watcher's, or someone's who doesn't follow it, stay theirs; guard.ts visibleFollows' rule), and
  only on that couch: ZT Extra never hears what the main couch said. Yours can be taken back (the × on your line). At most 12 in ten
  seconds and 1,500 an episode.
- **Spoiler-safe on the server:** you watch along an episode you've seen or your next one (`mayWatch`: 403 past it), once it's
  aired; the next to air opens as "soon" with nothing in it (409 for saying anything). The couch's reactions reach you only once
  your clock is **30 s past their moment** (`othersThrough`: at 1:29.999 riley's 1:00 isn't sent, at 1:30 it is), and never past
  what has aired since airtime (a clock ahead of a live airing is held to it); your own come back at once. The clock is the watcher's
  word (Noticed). A reaction says what that person was watching, as a rating says they've seen it.
- **The watch along** (the mock's index.html openWatch, wrapped by watching.js): a layer over the show space (`?page=watch&ep=N`,
  so the hub and a link open it), rising like a curtain. The start: the show's art, "Watch Episode 4 with the couch" (solo "your
  way"), Streaming, no ads / Live on TV, Pick up at 23:10 when you've been here before (kept per episode in the browser), who left
  reactions; before airtime the choices wait ("Opens Thu 8:00 PM"). Then the clock (it follows the episode; Pause; Live TV's Ad
  break holds it), the bar with a pin for each comment and GIF you've passed, "Comments and reactions arrive 30 s after the moment,
  never before it" (and, alone or watching privately, that what you say stays yours), the stream of the last six comments and GIFs
  (yours in yellow, with ×), quick reactions floating up with who sent them, the bar of four reactions and GIF, −10s / Pause / Ad
  break, +10s / Set the time / End, and "Say something at 12:03". **Screen stays on** (the Wake Lock API while it's open, taken again
  when the tab comes back; the chip only when it's held). **Bingo** opens your card for the episode over it. It reads what was said
  in the 90 s before your clock when it opens or jumps, then every 5 s what's new since, only while the clock runs and the tab is in
  front.
- **The end** (End, or the clock reaching the episode's length): "How was Episode N?" On a show you only watch, five stars: a tap
  marks it seen (where you are) if it wasn't, rates it and opens Rate it's sheet with the verdict (`openRate`, as step 12 part 1 asked).
  On one you play and haven't revealed: Reveal your scores (the one yellow) when its results are in, else "Your scores come with the
  results"; rating waits for the reveal. Back to Tonight; Keep watching.
- **Where it opens:** Tonight's Watch along card (real now): your next episode, "riley and jordan left 5 reactions · they show up as
  you reach them" (a count and names, never what), "Be the first" with none, "Live · Thu 8:00 PM" before it airs; **while it's on air
  the card leads Tonight** (the mock's during phase: "On air · Episode 6", above Tonight's bingo and Your moves). The hub's Up next
  Watch along, Previously on's "Watch along · Episode 6" and the solo hub's On your own tile (your first show with an episode out you
  haven't seen, else what's on next) open the show with it (`paths.watch`).
- **GIFs** are GIPHY's, behind config like Continue with Google (Tenor's API, the plan's other choice, closed on 2026-06-30): no
  `GIPHY_API_KEY`, no GIF button and `/api/gifs` 404s. The picker (Send a GIF: trending, then search as you type, "Powered by
  GIPHY", PG-13 at most) asks our server, which asks GIPHY (edge-cached an hour per search); a GIF reaction keeps only GIPHY's own
  link (`giphyUrl`: https on media*.giphy.com or i.giphy.com), never another site's. **For the user:** make a GIPHY developer account
  (developers.giphy.com › Create an App › API), copy its key, add `GIPHY_API_KEY` to Vercel (Production) and to `.env.local` for
  local; never commit it. It starts as a beta key (100 calls an hour, plenty for a few couches with the edge cache); GIPHY's
  production key is applied for from its dashboard when that's not enough.
- **Fixtures and Preview:** `show.watch-along` and `hub.watch-along` are gone (Tonight, Up next, Previously on, the solo hub are
  real); a planned night's Open and its sheet's Open the watch along are `show.watch-together` (part 3: one clock for everyone in
  it). `hub.on-now` and `fixtures/watch-along.ts` are part 2's.
- **Backups** take `watch_reactions` (what the group's couches said on its seasons, and its people's own with no couch;
  `backup-common.js`, `backup-leagues.js`); `backup-fixture.js` has a comment, a GIF and a quick reaction.
- **Changed from the mock:** no "At the opening credits" (nothing says when a show's credits run; Set the time instead, minutes and
  seconds); the cast stickers are gone (watching.js had already swapped them for GIFs); the near line "riley is watching now · 40s
  ahead" and her face on the bar are part 2's; Live on TV starts at 0:00 (Noticed); the end's stars save through Rate it and open its
  sheet rather than drawing the verdict on the end screen; on a show you play you reveal before you rate.
- **Checks:** `scripts/dev-test/check-new-watch-along.js <outDir> [--width=390] [--keep] [--api]` (117 PASS at 390) on
  new-fixture.js and solo-fixture.js, with the new **`fake-gifs.js`** (a GIPHY stand-in: trending, search, its own SVG pictures,
  reached with `x-gys-gifs` under `next dev` from a loopback address; the check refuses a `GIPHY_API_KEY`): the card, every refusal,
  30 s late and never early to the millisecond, your own at once, what's new since a runtime, the pins and count, another couch, no
  couch, a private watcher, someone not following, taking one back, too many at once, Episode 6 on air (live, nothing past what's
  aired, sam behind), GIFs with and without; then the browser as sam (the card, the start, the wake lock (a stand-in records the
  request: headless Chromium refuses the real one), Set the time, riley's comments 30 s late with their pins, her fire floating up on
  a poll, a laugh, a comment, a GIF from the picker, taking one back, Pause, −10s, Bingo, End with Reveal your scores, Close letting
  the screen go, Pick up at), riley (no GIFs: no button; the Traitors, a show she only watches: four stars mark Episode 3 seen and
  open the verdict), alex (Episode 6 on air leading Tonight, Live TV, Ad break, saying something, riley's 4:00 at 4:40, Up next's and
  Previously on's Watch along) and zt_so_sam (the solo hub's tile, alone). `tests/watch-along.test.js` (7). Updated: check-new-shell
  (its Preview tap is the bell now), check-new-plans (a plate's Open is `show.watch-together`), check-new-show (`show.watch-together`
  only shows on a planned night, which check-new-plans covers). The rest pass, one at a time: check-new-episode-games (285), -plans
  (102), -listings (75), -guide (57), -library (91), -start-game (75), -make-it (81), -watching (114), -solo (92), -way-in (85),
  -couches (114), -hub (75), -draft (90), -settling (96), -results-ways (89), -ours (89), -desk (100), -community (82), -backstage
  (67), -backstage-ii (116), -show (69), -shell (46), -reveal (49), -stats (57), -chat (52), check-foundation, check-preview (step 13
  in progress: `hub.on-now`, `show.watch-together` and `fixtures/watch-along.ts` left) and check-backup-restore; `npm test` 615 of
  615; type-check clean; lint (src) as before (the old error in classic's `use-sheet-swipe.ts` and the old warning in
  `episode-results.ts`). Seen at 390 in the browser: Tonight's card (aired, and leading Tonight on air), the start (and Pick up at),
  the watch along running (comments, a GIF, the stream), the GIF sheet, Bingo over it, the end (Reveal your scores; stars on a show
  you only watch, then the verdict), Live TV with Ad break, Previously on's button, the solo hub's tile and the watch along alone.
- **Noticed, left as is:** five, now in Noticed, not fixed: a watch along's clock is the watcher's word, Live on TV starts at 0:00,
  what you said is taken back only from the stream, the watch along's length is the slot's, and nobody can hide a reaction. Bingo in a
  watch along, Up next's planned night, a shared start's days and the accolades now say part 3.
- **For part 2:** who's on now and the live airing. The watch along's poll (`watchApi.read`, every `POLL_MS` while the clock runs) is
  where presence can ride (an answer could carry who's watching that episode now) rather than a second poll; `Clock` and its
  run/stop/move are what a session keeps on the server; Live on TV's start (`start("live", 0)`) is where "Join the live airing" goes;
  the card's live line (`WatchAlongCard`) and the hub's `OnNow` (sections.tsx, on `fixtures/watch-along.ts`) wait for it.

### As built, step 13 part 2 (2026-10-26, on `new-design`): who's on now and the live airing

Migration **0132** (ships with 0b's, same rehearsal): `watch_sessions` (season, episode, the couch it's watched with or none, who
started it, `together` (always false until part 3), `mode`, the clock: `clock_ms` and `running_since` (the server's time; NULL while
paused or in an ad break, `ad` saying which), `version`) and `watch_session_people` (session, person, `joined_at`, `seen_at` (the
heartbeat), `left_at`). Your own watch along of an episode on a couch is one session (`watch_sessions_own`, a partial unique index on
who, season, episode and couch where not together): opening it again carries on in it. **No new poll and nothing on a schedule**
(HOSTING.md): presence rides on the reads part 1 already makes, plus a paused watch along's beat. New: `src/lib/server/
watch-sessions.ts` (the SQL: `writeOwnSession`, `leaveOwnSession`, `beatOwnSession`, `watchersOn`), `POST /api/seasons/[id]/watch/
[n]/session?couch=` (`sessionWrite`), `GET /api/couches/[id]/now` (`couchOnNow`), the pure side in `src/lib/game/watch-along.ts`
(`PRESENT_MS` 45 s, `BEAT_MS` 20 s, `PAUSED_BEAT_FOR_MS` ten minutes, `BEAT_WRITE_MS` 15 s, `LIVE_SHOW_SHARE` 0.7, `Watcher`,
`watcherAt`, `offsetText`, `liveClock`, `nowLine`), `useOnNow` and `watchApi.session`/`leave` in data.ts. The card, the read and a
session write each answer with `now`: the rest of the couch's open watch alongs (the card's on the season, the others' on the episode).
- **The clock on the server:** written when it starts, pauses, goes to an ad break or moves (±10s, Set the time, Catch up, Streaming /
  Live TV), 300 ms after the last tap so a few taps are one write; the server keeps where it stood and since when by its own clock, so
  anyone's is read where it has got to. **The heartbeat:** the running watch along's 5 s read carries `beat=1` and writes it only when
  the last is 15 s old (most polls just look); paused or in an ad break, a beat every 20 s for ten minutes, then nothing (you drop out
  until it runs again); coming back to the tab, or the page back from the browser's cache, beats at once. Closing it, End, or the page
  going away (`pagehide`, a keepalive fetch) leaves at once; a hidden tab or a phone asleep drops out 45 s after its last heartbeat,
  worked out when read (nothing sweeps them). A poll still on its way as you close never brings you back; only a beat does. Alone (no
  couch) nothing's kept.
- **What it reveals, and to whom (decided):** presence is progress ("riley is watching Episode 7 now" says how far she is, and her
  clock where she is in it), so it follows the reactions' rule: only someone who follows the show openly (never a private watcher's,
  nor someone's who doesn't follow it), only on the couch they opened it on (ZT Extra never sees the main couch's), never alone, never
  yourself, each person once (their freshest session), and shown to the rest of that couch's people (a site admin looking in sees
  none). That includes people on the couch who don't follow the show: the hub's On now and The couch is watching are how a couch finds
  shows, as the mock has them. It says which episode and where their clock is, never what happens in it; nothing else about an episode
  past your mark leaves the server (the read and a session are refused past your next episode, as in part 1). It's the one exception to
  "nobody's progress" (Noticed) until step 15's When I'm watching can turn it off (Noticed).
- **In the watch along:** "riley is watching now · 43s ahead" under the bar (the mock's .near line), "paused, 1:20 behind", "in an ad
  break", "with you" within 3 s, "riley and sam are watching now · riley 40s ahead" with several (the one furthest ahead leads); each
  one's mark on the bar (their square, up to four, moving on between reads); **Catch up** once someone's 5 s or more ahead (your
  clock to theirs, written too). The start: "riley is on now · 1 watched earlier" with their faces (the mock's crowd line).
- **The live airing:** while your episode is on air, the start leads with **Join the live airing**: the clock of someone on the couch
  watching it live (running or in an ad break, the one furthest behind, never past what's aired: "In step with riley · 4:42 in"), else
  from airtime, 70% of the way ("About 7:23 in, from airtime · a touch behind, to be safe": US TV runs 13 to 18 minutes of ads an hour,
  so that's a little behind the show for most; behind is safe, ahead would bring the couch's reactions early; Noticed). It starts on
  Live TV, in an ad break if theirs is. Live on TV reads "Live on TV, from the start" then (a recording, or from the top). "Live on TV
  starts at 0:00" is out of Noticed.
- **Tonight:** the Watch along card says who's on its episode now ("riley and sam are watching · your bingo card comes with you" on air,
  as the mock's during card; "riley is watching now · join in: what they say shows up as you reach it" else), and Who's watching (a
  show you don't play) has "Watching now · Episode 7": both from the card's one read when the show opens (not polled). The start reads
  the card again as it opens, so its line and the live clock are fresh.
- **The hub:** **On now** is real (`hub.on-now` and `fixtures/watch-along.ts` gone): the first of the couch's people watching along (on
  one of your shows first), "riley is watching Survivor", "Live · Episode 6 · and 1 more · Watch along ›"; on your show it opens your
  watch along of it (their episode when you're that far, else your next: never past it), on one you don't follow "Have a look" opens
  the show. **The couch is watching** marks a show someone's on ("riley is on" on its picture, "riley · now" by her name: the mock's
  watching.js). One read when the hub opens (`/api/couches/[id]/now`, kept 30 s; coming back to the tab after that reads it again): no
  poll. Nobody on, nothing there.
- **Changed from the mock:** On now's "Watch along ›" moved under the name (the mock's one row cut the show's name off at 390, "riley
  is watching Be…"); a show's Who's watching says only "Watching now · Episode 7" (no "2 ahead": other progress stays unsent).
- **Shaped for part 3:** a session is the clock and people are in it (`watch_session_people`), `together` and `version` are there for one
  clock anyone in it can pause (its version polled), and `watchersOn` reads people, not sessions, so several in one session each show.
- **Backups leave sessions out (decided):** a session is a clock and a heartbeat, nobody's choice, true for a minute; a restore bringing
  old ones back would show nobody (their heartbeats are old) and the next watch along writes its own. If part 3's "most watch alongs"
  counts sessions (one own row per person, episode and couch is a fair count), it adds them to the backups then.
- **Checks:** `check-new-watch-along.js` grows with part 2 (180 PASS at 390): the clock kept as it starts, pauses, goes to an ad break and
  closes (one session, its version moving on); who's on it in the read, the card and On now, each clock where it has got to; leaving at
  once, a beat bringing it back, a heartbeat 50 s old dropping out with no job, a late poll not bringing it back; the poll writing its
  heartbeat only every 15 s or so; never yourself, another couch, a private watcher or someone not following; once each, their
  freshest; the live airing; the refusals; then two browsers at once (riley's mark on sam's bar, "riley is watching now · 43s ahead",
  Catch up, her pause and her closing reaching his line on his next poll), Join the live airing from airtime for alex and in step with
  alex for riley, the hub's On now (Live · Episode 6) opening a watch along to join her, and riley on the Traitors (On now's Have a look,
  The couch is watching's "riley is on"). `check-new-hub.js` asserts On now is real (a session for riley shows the strip; none, none).
  `tests/watch-along.test.js` (9: the offsets, `liveClock`). Fixed on the way: part 1's "a clock ahead of the airing" assertion
  allowed only under 10:00, but the schedule keeps airtime to the minute, so it failed whenever the check ran past the 30 s mark.
  The rest pass, one at a time: check-new-episode-games (285), -plans (102), -listings (75), -guide (57), -library (91), -start-game
  (75), -make-it (81), -watching (114), -solo (92), -way-in (85), -couches (114), -hub (77), -draft (90), -settling (96), -results-ways
  (89), -ours (89), -desk (100; one of its assertions misses now and then, Noticed), -community (82), -backstage (67), -backstage-ii
  (116), -show (69), -shell (46), -reveal (49), -stats (57), -chat (52), check-foundation, check-preview (step 13 in progress:
  `show.watch-together` left) and check-backup-restore; `npm test` 617 of 617; type-check clean; lint (src) as before (the old error in
  classic's `use-sheet-swipe.ts` and the old warning in `episode-results.ts`). Seen at 390 in the browser: riley's mark on sam's bar with
  "43s ahead" and Catch up, a paused riley with sam on hers, the start's "riley is on now · 1 watched earlier", Join the live airing
  from airtime and in step with alex, the hub's On now, and The couch is watching's "riley is on".
- **Noticed, left as is:** five, now in Noticed, not fixed: who's on now can't be turned off (15), joining the live airing from airtime
  is a guess, a watch along behind another app drops out, two phones share one session, and check-new-desk's castaway Override
  sometimes not in every league when it's read. "Live on TV starts at 0:00" is fixed.
- **For part 3:** together sessions. A session with `together` true is several people's: `writeOwnSession` has a sibling that lets
  anyone in it move the clock (bumping `version`), joining puts a person row in it (and leaves your own), the watch along polls its
  version every few seconds while open (the plan's), the near line says "watching together", and a planned night's Open/Join
  (`show.watch-together`, `couch/watch-plans.tsx`) starts or joins one (the live airing's clock is `liveClock`; a shared start's "3, 2,
  1"). Up next's planned night, a shared start's own time, bingo ticks to whoever's watching together and the two accolades are in
  Noticed with part 3's name on them.

### As built, step 13 part 3 (2026-10-26, on `new-design`): together sessions and planned nights

Migration **0133** (ships with 0b's, same rehearsal): `watch_sessions` gains `plan_id` (a planned night's; one together session a
night by a partial unique index; it goes with its night), `changed_by`, `change` and `changed_at` (who last did what to the clock), and
a check that a together session is a night's, on a couch. **One new poll, only while a together watch along is open and in front**
(HOSTING.md); nothing on a schedule, no pushes. New: the together half of `src/lib/server/watch-sessions.ts` (`togetherOf`,
`togetherVersion`, `joinTogether`, `moveTogether`, `beatTogether`, `leaveTogether`), `togetherRead`/`togetherWrite` and the read's
`together`/`sv` in `src/lib/server/watch-along.ts`, `GET/POST /api/seasons/[id]/watch/[n]/together?couch=`, `planById` (shared) and
`inPlan` in watch-plans.ts, the pure side in `src/lib/game/watch-along.ts` (`TOGETHER_POLL_MS` 3 s, `TOGETHER_SLOW_AFTER_MS` ten
minutes, `TOGETHER_SLOW_MS` 30 s, `TOGETHER_STOP_AFTER_MS` an hour, `COUNTDOWN_MS` 5 s, `START_EARLY_MS` 15 minutes, `TogetherChange`,
`changeLine`, `adoptClock`), `togetherApi` and `useRefreshBingo` in data.ts, `useOpenTogether` and `TogetherStart` in watch-along.tsx,
`paths.watch(seasonId, ep, plan)`.
- **A together session (decided)** is a planned night's watch along (`?page=watch&ep=N&plan=<id>`), on the night's couch, for anyone on
  it who may watch that episode along (mayWatch: 403 past your next; 404 for another couch or episode; 409 once it's called off). Every
  together session comes from a planned night (Noticed); since a shared start can now be any day and time (below), watching together
  soon is planning a night a few minutes off.
- **Opening it is joining it, once it's due** (the live airing from its airtime, a shared start from 15 minutes before its time): you're
  in it, in the night ("I'm in", `inPlan`), and out of your own watch along of that episode on the couch (and any other together one of
  it there). Opened earlier, its start says when it opens, and joins you then if you're still on it. Whoever opens it first makes it: the
  live airing's runs at once on `liveClock` (someone on the couch watching it live, else 70% from airtime), a shared start waits for
  someone in it to start it.
- **One clock for everyone in it:** anyone in it starts it (a shared start's **"3, 2, 1"**: `running_since` five seconds ahead, so every
  phone counts down to the same moment, and everyone on the start is pulled into the countdown), pauses or resumes it, moves it (±10s, Set
  the time), or starts an ad break and ends it, for all: one write 300 ms after the last tap (a start at once), its version bumped, who and
  what kept. The others' watch alongs pick it up on their next look (3 s) and their clocks follow it (one within 1.5 s of the session's is
  left alone, so a look doesn't nudge it for nothing). A pause or an ad break stays on a plate under the clock (the mock's: "riley paused
  for everyone · Resume for everyone", "You paused for everyone", "riley started an ad break for everyone · Back to the show"); a start,
  resume, move or end of an ad break shows there for six seconds. Pause and Resume say "for everyone"; Catch up isn't offered (everyone in
  it is in step), and the marks on the bar are everyone else on the couch. Starting a shared start more than 15 minutes early is refused
  (409), and so is moving a clock you're not in or have left.
- **Leaving:** Close, End or the page going away leaves it (a keepalive request); its clock carries on for the rest. The last one out stops
  it where it is ("It stopped when everyone left"), so opening it again picks up there. A late arrival's start says who's watching and
  offers **Join them · 12:31 in** or **From the start, on your own** (your own watch along: what they said shows up as you reach it), the
  mock's "late arrivals watch along after"; Keep watching on the end joins it again.
- **The poll (HOSTING.md):** while you're in one and it's in front, every 3 s. While its clock runs, the reactions read carries
  `together=<id>&sv=<version>` (so that read comes every 3 s instead of 5); stopped, `GET .../together?plan=&v=` answers `{ version }` from
  one small query (`togetherLook`: you're in it, on this couch's episode, the night not called off) until it moves, then the session in full
  with every check. It's the heartbeat too (written every 15 s, as part 2's). Ten still minutes and it asks every 30 s; after an hour, nothing
  until a tap or coming back to the tab. A start opened before the night's due doesn't poll.
- **What the people in it say (decided; changed from the mock):** what someone in the session says while in it (since it began) reaches
  the rest of them through their clock, at once (a look's wait), not 30 s late. It's one clock, so it's never ahead of anyone in it, and
  watching together half a minute behind each other's words isn't watching together. Everyone else's, and what they said on their own time
  before it began, is 30 s late as ever, and a private watcher's words stay theirs here too (FROM_COUCH). The screen says "What the people
  here say shows up as you reach it; the rest of the couch's, 30 s after the moment".
- **Bingo (from Noticed):** your card for the episode shows the people here in your together session (who share the show) and the moments
  they've ticked since it began: their face on the same moment of your card and "Watching together · riley ticked 3" (`EpisodeBingo.together`,
  bingo.ts `togetherTicks`). They're at your moment, so it's never ahead of you; ticks from before it began (someone who'd seen it) stay
  theirs. A tick moves the session's version on (its `ticks`), so an open card in the others' watch alongs reads again: no poll of its own.
- **What it reveals, and to whom (decided):** who's in a night's watch along (names, here or not), its clock and its last change go to the
  couch's people who may watch that episode along, when they open it. A night's people and answers are the couch's to see already, and
  joining is your choice as saying I'm in is, so someone watching the show privately who joins is shown in it (to the couch, by their own
  hand); On now and the near line keep part 2's rule (open followers only). Never what happens in the episode, and nothing about an episode
  past your next leaves the server.
- **Where it opens:** a planned night's plate on Tonight (Open, for whoever's in; `show.watch-together` is gone, and with it step 13's last
  Preview), the plan's sheet (Open the watch along), the hub's **Up next** (from Noticed: a night the couch planned on its show that you can
  watch, in Watch along's place: "Watch along · 3 going · Ep 6 · Thu 8:00 PM · the live airing" with **Join** (you're in, and once it's
  due, its watch along) or **Open**), and a link.
- **A shared start's own time (from Noticed):** the plan sheet's Day row ends with **Another day** (a date from when the episode's out to
  two months on) and Start at with **Another time** (any time of day); a moment gone by, or past two months, says so and Send waits.
- **Couch accolades (from Noticed):** By the numbers' **Most reactions this month** (reactions said to the couch in the last 30 days, five
  at least) and **Most watch alongs** (episodes watched along on the couch in 30 days whose clock ran a minute, two at least: "9 this
  month"), each only on shows that person follows openly, counted, never which (couch-hub.ts `accoladesFor`, couch-standings.ts
  `accoladesOf`).
- **Backups still leave sessions out (decided):** a session is a clock and a heartbeat; the one lasting thing read from them is Most watch
  alongs' last 30 days, so a restore costs at most a month of one accolade, and old sessions brought back would show nobody. A together
  session goes with its night (`plan_id` cascades from `watch_plans`, which is backed up), so a restore that replaces a group's nights
  clears their sessions.
- **Changed from the mock:** the people in it hear each other at once (above); a late arrival gets a start of their own (Join them, or from
  the start on your own); Pause "for everyone" on two lines (one didn't fit at 390); the plate under the clock also says an ad break; the
  "3, 2, 1" is five seconds, so a look every 3 s reaches everyone in time to see it.
- **Checks:** `check-new-watch-along.js` grows with part 3 (276 PASS at 390; 162 of them the API half): a night before anyone's opened it,
  the refusals (off the couch, another couch, another episode, not a plan, called off, the live airing before it airs, behind, a shared
  start an hour early, a clock you're not in or have left), opening it (one session, both in it, your own closed, "I'm in"), the look (a
  few bytes while the version's the same), the "3, 2, 1", a move, a pause and resume, an ad break and back, each for everyone with who did
  it; riley's 2:10 reaching sam at 2:11 together while what she said before it began, and anyone else's, still waits 30 s; bingo ticks
  (sam's on riley's card, not one from before it began, nobody's for jordan, the session moving on); leaving (on for the rest, the last one
  out stops it, opening it again picks up there); On now; the live airing's night (70% from airtime, alex in step, his ad break for
  everyone, sam refused); By the numbers. Then three browsers at once on Episode 4: sam opens his plate's Open (Watching together, Start at
  the same time), riley says I'm in on her plate and opens it, jordan joins from the hub's Up next ("Watch along · 2 going"); sam's "3, 2,
  1" pulls them both in and their clocks run together; riley pauses for everyone (sam's and jordan's stop, the plate names her), jordan
  resumes it from the plate; riley's comment reaches sam within a look or two; sam's tick shows on riley's open card; riley closes it and
  sam's line says so; alex, late, says I'm in on the plan's sheet and joins them where it is. `check-new-plans.js` (the plate's Open is the
  night's watch along; a shared start five days after it airs at 2:30 PM, a day gone by refused; 104) and `check-new-show.js` (no Preview
  left elsewhere) updated. `tests/watch-along.test.js` (11: the change lines, adopting the session's clock). The rest pass, one at a time:
  check-new-episode-games (285), -listings (75), -guide (57), -library (91), -start-game (75), -make-it (81), -watching (114), -solo (92),
  -way-in (85), -couches (114), -hub (77), -draft (90), -settling (96), -results-ways (89), -ours (89), -desk (100 alone; in the batch its
  castaway Override assertion missed once, as Noticed has it), -community (82), -backstage (67), -backstage-ii (116), -show (69), -shell
  (46), -reveal (49), -stats (57), -chat (52), check-foundation, check-preview (step 13 done, nothing of it left) and check-backup-restore;
  `npm test` 619 of 619; type-check clean; lint (src) as before (the old error in classic's `use-sheet-swipe.ts` and the old warning in
  `episode-results.ts`). Seen at 390 in the browser: the together start (waiting, who's here, a late arrival's), the countdown, three in it,
  the pause plate, bingo with sam's tick on riley's card, Up next's planned night, the plan sheet's own day and time, and By the numbers'
  two new accolades.
- **Noticed, left as is:** watching together needs a planned night, and everyone in a together session can move it (both in Noticed, not
  fixed). From Noticed, fixed: Up next's planned night, a shared start's own time (its "one night per episode" half stays), bingo in a
  watch along, and the accolades most reactions and most watch alongs; two phones in one session and who's on now's off switch now say
  what part 3 adds.
- **Step 13 is done.** For step 14 (streaming shows and the rail): a streaming season's nights are always a shared start (watch-plans.ts),
  so a binge night's watch along is a together session like any other; the fold still goes by airtime (Noticed), and daily streaming shows
  are still in every day's Also on (Noticed). Migration 0134 is next.

### Step 14, in two parts

Too big for one session (written 2026-10-26, at its start). Each part ends with its As built and the checks passing; step 14 is marked
done after part 2.

1. **Streaming on the couch** (the mock's streaming.js and streaming.css; no migration). **The release model end to end:** a season that
   drops every episode at once (`show_seasons.release 'binge'`, `drop_at`) is never "on air" (schedule.ts `upNext`: before the drop its
   Episode 1 is up next, after it nothing is, so no On now, no live watch along, no live airing to plan), and never takes the hub's Up
   next unless one of its moves or results needs you (the mock's heroPick). Every season header carries `dropAt` and the listing's
   `network` (the service). **The rail** under the guide (both hub shapes; the solo hub's "Streaming", your shows only): your shows in
   progress first (Continue · Ep 4, your own progress bar), then new drops (a week after), then the couch's planned nights, then the
   couch's most watched (by how many on the couch stream it), then upcoming drops (Drops Fri 9:00 PM); See all N past three (a sheet of
   every chip); a ＋ on anything not on your shows (where you are, then it's yours, staying on the hub); a chip opens the show. It holds
   streaming seasons and **finished seasons someone's watching at their own pace** (completed, and no game on it on the couch: the mock's
   The Wire), which leave The couch is watching (weekly shows only). Who's on a chip: faces of who on the couch streams it openly and
   "riley + 2", or "riley is on now" from the hub's On now read (the one progress the guard lets out), never how far anyone is (Noticed:
   nobody's progress). **The show space:** the bar says "Drops in 2 days" or "All 8 episodes · Netflix", the couch line a dashed
   "Streaming"; before the drop Tonight leads with the drop plate (All 8 episodes at once · Drops Wed 9:00 PM · the countdown · the
   service and who's waiting) and "Plan a watch along for the premiere"; after it, the phase head is your next episode at your own pace
   ("You finished it" at the end), Who's watching says "at their own pace"; Episodes says "All 8 out · Netflix" or "All 8 drop Wed" and
   lists the episodes still to drop as one line. **Planned nights:** a streaming season's are a shared start (watch-plans.ts already), so
   its watch along is a together session; the rail tags a chip with the couch's next night. Preview `hub.streaming` and the fixtures
   `streaming.ts` and `people.ts` go. Check: `check-new-streaming.js` on a new `streaming-fixture.js`; `tests/streaming.test.js`.
2. **The fold by progress, first to finish, streaming off Also on** (migration 0134). From Noticed: the chat's fold on a season watched at
   its own pace goes by **the author's own mark when they wrote** (a message's `author_seen`, kept from now on; the airtime fold stays for
   weekly seasons and for messages from before it), so a binge drop no longer folds everything until you finish. **First to finish** in
   By the numbers (who reached a streaming season's last episode first, from a `show_follows.finished_at` kept from now on), shown only
   to people who've finished it themselves, so it says nothing their own finale's verdict doesn't already (the guard: nobody's
   progress). **Daily streaming shows** (one new streaming episode a day) leave the guide's Also on; a whole season's drop stays as its
   drop day. Marks step 14 done.

### As built, step 14 part 1 (2026-10-26, on `new-design`): streaming on the couch

No migration, no new read, poll, job or stored row (HOSTING.md). New: `src/lib/game/streaming.ts` (pure: `ownPace`, `railItems`,
`whoLine`), `src/new/hub/streaming.tsx` (`StreamingRail`, `useRail`, `streamShows`), `tests/streaming.test.js`,
`scripts/dev-test/streaming-fixture.js`, `scripts/dev-test/check-new-streaming.js`.
- **The release model** (`schedule.ts upNext`): a season that drops every episode at once (`release 'binge'`) is never on the air.
  Before its drop, Episode 1 is up next (at the drop, `live: false`); from the drop on nothing is. Before this, a drop's first hour
  read as "On air · Episode 1" everywhere: the show bar, Tonight, a live watch along, On now's `live`. The guide's card is never On now
  either (`guide.ts`: any streaming card, a one-episode one too). Every season header carries its drop (`dropAt`) and its listing's
  service (`show.network`, from `shows.listing->>'network'`; null without a listing).
- **The rail** (the mock's streaming.js railShows / railChip / allStreamingSheet), under the guide in both hub shapes (the solo hub's
  "Streaming", your shows only). It holds seasons **watched at your own pace** (`ownPace`): a streaming drop, or **a finished season
  nobody plays a game on here** (decided: the mock's The Wire; completed, no game of yours or the couch's on it, so the couch's
  finished Survivor seasons stay the trophy shelf's), each one on your shows or streamed openly by someone else on the couch. Order:
  yours in progress (Continue · Ep 4, the yellow tag and your own progress bar), new drops for a week (New · all 6 out), the couch's
  planned nights (Watch along · Sat 9:00 PM: its next night you haven't said no to), the couch's most watched (by how many stream it,
  unfinished first; tag the service, "Streaming", or "All 13 episodes"), upcoming drops (Drops Thu 9:00 PM). A finished one of yours
  nobody else streams leaves it (Your shows still has it); "You finished it" while the couch still streams it. Who's on a chip: the faces
  of who on the couch streams it openly, whoever's watching along now first, and "riley is on now" (the hub's On now read, the one
  progress the guard lets out), "1 waiting" before a drop, "riley + 2", or "Just you so far". "Your own pace" with three or fewer,
  else See all N (a sheet of every chip, full width). A chip opens the show (its art grows into the show bar); one not on your shows
  has a ＋: where you are (the where sheet, as The couch is watching's Add), then it's yours, and you stay on the hub. A couch show
  you've hidden from the guide is off the rail too (decided: the same "not for me"; your own shows can't be hidden).
- **The hub** around it: Up next never takes a streaming season's countdown (the mock's heroPick), only something it needs of you (a
  move, results) puts one there; a poster's line is the drop day ("Season 1 · drops Thu") or the service ("Season 2 · Apple TV+"); The
  couch is watching leaves seasons watched at your own pace to the rail (weekly shows only).
- **The show space** (the mock's streaming.js wBar, wTonight, wEpisodes, inviteWatch): `ShowData` gains `streaming`, `dropAt` and
  `ownPace` (show-space.tsx, with `episodesOf` and `allOut`). The bar says "Drops in 3 days" (a clock inside the last day), then "All 8
  episodes · HBO Max" (a finished season at your own pace too); the couch line a dashed "Streaming". Before the drop Tonight leads with
  **the drop plate** (All 8 episodes at once · Drops Thu 9:00 PM · the countdown · the service and who on the couch is waiting for it)
  in place of the phase head, no Watch along card (nothing to open yet), and "Plan a watch along for the premiere". After it, the phase
  head is "Episode 4 · Your own pace", "You finished it · All 8 episodes" or (not yours) "All 6 episodes are out"; the Watch along card
  leads Tonight ("Episode 4 · your own pace"); Plan a watch along says a shared start ("Pick a time, start at the same moment, anyone
  can pause"), and isn't offered once you've finished; Who's watching's aside is "at their own pace"; the follow card says "sam is
  streaming this · All 6 episodes are out. Add it to watch along with their reactions, at your own pace" (before a drop: "All 8 episodes
  drop Thu 9:00 PM. Add it and it's on your list, ready"). Episodes: "All 10 out · Apple TV+" (before: "All 8 drop Thu", the drop as the
  list's one line, no "This week" block), a season you watch without a game from Episode 1 down, without the same drop time on every
  row. The ⋯ menu's Plan a watch along: "Pick a time and start together".
- **Planned nights** were already a shared start for a streaming season (watch-plans.ts, step 11 part 3), so a binge night's watch along
  is a together session like any other (13 part 3). The plan sheet now says "It drops Thu 9:00 PM · one shared start" before the drop
  ("It's streaming" after it) and an episode chip's "out" for "aired".
- **Fixtures and Preview:** `hub.streaming` and the fixtures `streaming.ts` and `people.ts` are gone; `src/new/fixtures/` holds only
  its index. What's left in the Preview registry is step 15's.
- **Changed from the mock:** nobody's progress anywhere (the guard): a chip says "riley + 1", not "riley Ep 6 · +1"; Who's watching
  keeps "Watches it" (no "Ep 6 of 10" bars or "3 ahead"); Episodes doesn't say "2 on the couch watched"; the drop plate says who's
  "waiting for it" (they follow it), not who's "starting it then". The drop plate's tag is the plate's ink, not yellow (the yellow rule:
  the Continue tag stays the mock's yellow, your next episode being yours to watch). Rate it and Call it are Tonight's Extras as on any
  show, not a block of their own ("Every episode"); Call it doesn't come for a streaming season after its drop (Noticed). The solo hub
  has the rail too.
- **Checks:** `scripts/dev-test/check-new-streaming.js <outDir> [--width=390] [--keep] [--api]` (80 PASS at 390 and at 1280) on
  new-fixture.js, the new **`streaming-fixture.js`** (ZT Severed alex is on 3 of, ZT Fresh Drop sam's two days old, ZT Old Wire a
  finished weekly season jordan watches with his planned night, ZT Done Binge alex finished and riley streams, ZT Coming Soon dropping in
  three days, ZT Alone Binge alex finished alone, ZT Secret Stream sam's private one; plus riley's planned night on Severed) and
  solo-fixture.js: the headers' drop and service, never on the air (a drop five minutes old included), the plan sheet with no live
  airing, privacy (sam's private one, casey's other couch, no progress in the members), On now on a streaming season; then the browser
  as alex (the rail's order, ranks, tags, who-lines, ＋ only on what isn't his, no Preview, Up next, posters, The couch is watching, the
  guide's drop card, See all, each show space, the plan sheet, Episodes, the ＋ to the where sheet staying on the hub, a chip opening its
  show, the drop arriving), sam (his private one), casey and zt_so_alex (the solo hub's Streaming). `tests/streaming.test.js` (7) and
  `tests/guide.test.js` (10: a streaming card is never On now). The rest pass, one at a time: check-new-watch-along (276),
  -episode-games (285), -plans (104), -listings (75), -guide (57), -library (91), -start-game (75), -make-it (81), -watching (114), -solo
  (92), -way-in (85), -couches (114), -hub (77), -draft (90), -settling (96), -results-ways (89), -ours (89), -desk (100), -community (82),
  -backstage (67), -backstage-ii (116), -show (69), -shell (46), -reveal (49), -stats (57), -chat (52), check-foundation, check-preview
  (only step 15's Previews left) and check-backup-restore; `npm test` 627 of 627; type-check clean; lint (src) as before (the old error
  in classic's `use-sheet-swipe.ts` and the old warning in `episode-results.ts`). Seen at 390 in the browser: the rail and See all, the
  drop plate, each kind of Tonight, the plan sheet before a drop, Episodes before and after a drop, the ＋'s where sheet, the solo hub's
  Streaming.
- **Noticed, left as is:** four, now in Noticed, not fixed: Call it skips a streaming season after its drop, the desk can't make a season
  a streaming drop, where you are says "Premieres" before a drop, and a drop never takes Up next. Nobody's progress on a show you watch
  now says the rail keeps to it; the fold, Also on's daily streaming shows and first to finish are part 2's.
- **For part 2:** the fold (chat-fold.ts `foldFor`/`isFolded`, couch-chat.ts; classic's chat routes share `src/lib/server/chat.ts`, so
  a message's author mark is written in one place), first to finish (couch-standings.ts `accoladesOf`, couch-hub.ts `accoladesFor`;
  `show_follows` has no time of reaching an episode yet), and Also on's streaming listings (tv-listings.ts `alsoOn`/`scheduleRows`).
  `ownPace` (src/lib/game/streaming.ts) says which seasons fold by progress. Migration 0134 is next.

### As built, step 14 part 2 (2026-10-26, on `new-design`): the fold by progress, first to finish, daily streaming off Also on

Migration **0134** (ships with 0b's, same rehearsal): `chat_messages.author_seen` and `show_follows.finished_at`. **Backups:** both
columns go in with their tables (backup-common.js reads each table's columns as they are, and a backup from before simply hasn't got
them, restoring as NULL: the airtime fold and no finish time, which is what the database had then). No new poll, job or table; a message's
post reads a little more and the hub's read one small query more (HOSTING.md). Step 14 is done.
- **The fold by progress** (chat-fold.ts, from Noticed "The fold goes by airtime"): on a season watched at its own pace a message keeps
  its author's mark when they wrote it, and it's folded for you while that's past where you are (or what you've unfolded through: `Fold`
  gains `mark`); a message with no mark folds by airtime as before. So on a drop, what someone on Episode 3 says shows to everyone on 3 or
  further, and what someone on 9 says folds for them until they're on 9. **When a message keeps a mark** (`marksAuthor`, decided at
  writing): on `ownPace` seasons (a drop, or a finished season with no game in this conversation: a game's chat is a game here), but a
  finished weekly season only once a week has passed since its last episode aired (decided: in its finale week people talk about what
  they saw on the night whatever their marks say, so those messages keep folding by airtime for good). Weekly seasons and every message
  from before 0134 have none. **The mark** (`chat.ts authorMark`): the guard's `seenThrough`, or the episode the author had open in a watch
  along in the last three hours when that's further (decided: someone watching Episode 4 along talks about it before End marks it seen);
  none for someone who sees results straight away (Infinity says nothing). **Written in one place**: `chat.ts insertMessage`, which
  classic's league chat route and `couch-chat.ts postCouchChat` both post through (classic's route answered as before). The mark is
  never sent: `MESSAGE_COLUMNS` leaves it out, the couch chat reads it beside them only to fold, and the hub's feed (`feedFor`) folds the
  same way. The Chat tab's fold says "2 messages from further along · From riley and jordan. They unfold as you catch up." when every
  folded message is folded by its mark (`fold.byMark`), else "since Episode N aired" as before; Show them works the same (through the
  latest out: on a drop, everything).
- **First to finish** (the mock's hubplus.js "First to finish · jordan · Severance, in 4 days"): `show_follows.finished_at`, kept by
  follows.ts, the one place `seen_through` is written (`followLeagueProgress` for a game's reveal, classic's too; `setFollow` for where
  you are, a watch along's End and rating an episode): set when the mark first reaches the season's `episode_count`, cleared when where
  you are moves back from it. By the numbers (`couch-hub.ts accoladesFor`, `couch-standings.ts accoladesOf`): the newest of the couch's
  first finishes on streaming seasons (`release 'binge'`), counting you and whoever follows it openly (never a private watcher, to anyone
  but themselves), only on seasons **you've finished yourself** (your follow's mark at the end) and two or more of those watch (a first
  among one isn't). "ZT Done Binge, in 5 days" (from the drop; "in a day" under a day and a half). Shown in the deck now and then and in
  On the couch's list, like every couch accolade.
- **Daily streaming shows leave Also on** (tv-listings.ts `dailyStreaming`, from Noticed "Daily streaming shows are on every day"): a show
  whose streaming episodes come one at a time on four or more different days of the week's listings (a twice-weekly one is at most three
  of the nine days the read holds); its single-episode drops are left out of every day's Also on, the few and the evening sheet. A whole
  season's drop (several episodes at once) stays as its drop day, a weekly streaming show stays. Decided in the browser, on the week's
  read: the job and `tv_listings` are unchanged.
- **Changed from the mock:** the fold has its words for a drop ("from further along") where the mock had one fold by airtime; First to
  finish says the account's name, as every accolade does (Noticed: two names for one person).
- **Checks:** `check-new-streaming.js` grew part 2 (114 PASS at 390, from 80): 0134's columns; marks kept on Severed (riley 6, jordan 9,
  sam 0, alex 3) and Old Wire, none on Survivor's weekly season or through classic's route there; alex on 3 has riley's and jordan's folded
  with no words, sam's and his own shown, the mark never sent (couch chat or classic's read); riley on 6 only jordan's; jordan nothing;
  Show them through 6 and through 10; a message with no mark folding by airtime (byMark false); a watch along on Episode 5 stamping 5; the
  hub's feed folding the same; finished_at set, cleared going back, set again, and kept by a game's reveal; First to finish for alex (his
  Done Binge, in 5 days), none for riley, jordan's Severed (in 20 days) not shown to alex until he finishes it too, sam's private earlier
  finish counted only for himself; in the browser at 390, Severed's Chat tab ("2 messages from further along", Show them) and By the
  numbers' First to finish. `streaming-fixture.js` gives its finishes a `finished_at`. `check-new-listings.js` adds a daily streaming soap
  (fake-listings.js `daily`), the evening's most watched, kept in `tv_listings` and on no day of Also on (77 PASS, from 75). Unit tests:
  `tests/chat-fold.test.js` (7: the fold by progress, Show them, when a message keeps a mark), `tests/tv-listings.test.js` (7: daily
  streaming), `tests/couch-standings.test.js` (6: first to finish). The rest pass, one at a time: check-new-watch-along (276),
  -episode-games (285), -plans (104), -guide (57), -library (91), -start-game (75), -make-it (81), -watching (114), -solo (92), -way-in
  (85), -couches (114), -hub (77), -draft (90), -settling (96), -results-ways (89), -ours (89), -desk (100; its castaway Override
  assertion missed once in the batch and passed alone, as Noticed says), -community (82), -backstage (67), -backstage-ii (116), -show
  (69), -shell (46), -reveal (49), -stats (57), -chat (52), check-foundation, check-preview (step 14 done; only step 15's Previews left)
  and check-backup-restore; classic's `check-chat-polls.js --ui` (its route posts through `insertMessage` now); `npm test` 632 of 632;
  type-check clean; lint (src) as before (the old error in classic's `use-sheet-swipe.ts` and the old warning in `episode-results.ts`).
  Seen at 390 in the browser: Severed's Chat tab folded from further along and shown, By the numbers' First to finish.
- **Noticed, left as is:** two, now in Noticed, not fixed: the fold by progress trusts the mark, and first to finish starts with 0134.
  Taken out: the fold goes by airtime and daily streaming shows are on every day (both fixed, above); couch accolades and nobody's
  progress brought up to date.
- **For step 15:** What your couch sees (share.js) is where First to finish and the fold by progress would answer to a sharing level
  (both say something about how far someone is); `watchersOn` is still where When I'm watching would apply. Chat pushes are still
  classic's (`couch-chat.ts postCouchChat`, now posting through `chat.ts insertMessage`). Migration 0135 is next.

### Step 15, in four parts

Too big for one session (written 2026-10-26, at its start). It's the last step before the one merge (the user, 2026-10-25). Each
part ends with its As built and the checks passing; step 15 is marked done after part 4. Migrations from 0135. The Preview registry's
`settings.account` is split in three (`settings.notifications` 2, `settings.sharing` 3, `settings.appearance` 4) so each part takes out
what it makes real; at the end `src/new/preview.ts` and `src/new/fixtures/` hold nothing.

1. **Your settings and your profile** (migration 0135; the mock's settings.js). `/settings` real in the mock's order: the me card (your
   face, your name, your couches) with **Edit**, the profile sheet: your name (your username, the name your couch sees, checked as
   sign-up checks it), your colour (the palette), your picture (chosen on the phone, cropped square and shrunk in the browser, kept on
   our side; Remove). **Keeping you spoiler-free** (Hide scores until I reveal: the account's `show_results_immediately` turned round),
   **Your AI for results** (ChatGPT · Grok · Ask each time · I'll copy and paste, per account; every Ask an AI sheet follows it),
   **Your couches** (each couch's sheet gains Rename and Hand it on for whoever started it, and New code, retiring yours: from Noticed),
   **Help** (How each game works, Report a problem), **Your account** (your sign-in name and email, Change password, Link Google once
   it's set up: from Noticed), the new design (back to classic, sign out). **One name and one face** (from Noticed: two names for one
   person, the verdict's faces are initials): saving your name renames your seat in every league you play and signs your old messages
   with it, and every face in the new design is your colour and picture (your couches' people carry them on the home read; one picture
   read per person and version, kept by the browser). What we notify you about, What your couch sees and Appearance stay Preview;
   `settings.profile` goes. Check: `check-new-settings.js`.
2. **Notifications by moment.** The mock's moments (Lineup reminders, Early results are in, Final scores are in, Invites and join
   requests, Couch chat: Every message · Quiet on episode nights · Never) over every push both designs send, and the ones Noticed asked
   for: the couch chat everywhere (a show the couch only watches, people on the couch who aren't in its games: `postCouchChat`), a poll,
   a bingo line, a flag settled, a night called off (once its Undo has passed), Tell the couch's own moments (from Noticed: Tell the
   couch uses the invite setting). Each push's words are what the guard lets out for its reader, its times in the reader's own zone (kept
   from the phone), and it opens the design the reader is on (from Noticed: pushes open classic's pages, join pushes open the new
   design). **The bell** (`hub.notifications`): what's happened on your couch since you last looked, the same moments kept as a list
   whatever your pushes say; a show's Notifications in its ⋯ menu (`show.notifications`: that show's moments on or off). Tonight's
   Waivers ran seen per account (from Noticed: the run's seen mark is per device). `settings.notifications`, `hub.notifications` and
   `show.notifications` go. No real push from a check: a stand-in push service.
3. **What your couch sees** (the mock's share.js). Everything (recommended) · Just my games · Only what games need, Customize (Where I am
   in each show, When I'm watching, My episode ratings, My watch along reactions), and "What riley sees about you" from what each level
   lets out. Enforced in guard.ts's rule 3 (`shares`): Where I am lets the couch see how far you are (from Noticed: nobody's progress on a
   show you watch: Who's watching, the rail, The couch is watching), When I'm watching gates who's on now (`watchersOn`; from Noticed:
   who's on now can't be turned off), ratings and reactions gate the verdict and the watch along's stream, and First to finish and the
   fold by progress answer to Where I am. From Noticed too: a finished season marked seen to the end (a past season counts for trivia
   only if it's marked). `settings.sharing` goes.
4. **Studio, and the rest.** The Studio light theme and Match phone (Appearance), every screen looked at in both; from Noticed: the
   newest 300 messages (Earlier messages), Lock it down. `settings.appearance` goes, the registry and the fixtures hold nothing, step 15
   is done, and the merge-and-deploy step is the user's (the backup, the Neon rehearsal of every branch migration, the merge, `ui='new'`
   for the couch).

### As built, step 15 part 1 (2026-10-26, on `new-design`): your settings and your profile

Migration **0135** (ships with 0b's, same rehearsal): `user_settings.colour` (a palette hex, checked) and `user_settings.ai`
('chatgpt' | 'grok' | 'ask' | 'copy'), both backed up with `user_settings`; and `user_pictures` (one small picture a person, under 100
KB), **not backed up** (decided: a face, not the game; its owner can choose it again). Nothing polls, runs on a schedule or pushes
(HOSTING.md). New: `src/lib/people.ts` (pure: `PALETTE`, `colourOf`, `pictureUrl`), `src/lib/server/profile.ts`
(`readProfile`, `saveSettings`, `rename`, `renameSeats`, `savePicture`, `pictureOf`), `GET/PUT /api/me/profile`, `PUT/DELETE
/api/me/picture`, `GET /api/people/[id]/picture?v=`, `POST /api/couches/[id]` (rename, handOn), `POST /api/couches/[id]/invite` (a new
code), `src/new/settings/` (settings.tsx, sheets.tsx), `scripts/dev-test/check-new-settings.js`, `tests/people.test.js`.
- **Settings** (`/settings`, the mock's settings.js accountRoute in its order): the me card (your face, your name, "On ZT Extra and ZT
  Survivor 51 · since ZT Survivor 51", Edit), What we notify you about (Preview, part 2), **Keeping you spoiler-free** (Hide scores until
  I reveal: the account's `show_results_immediately` turned round, so it's the guard's own setting, with Undo), What your couch sees
  (Preview, part 3), **Your AI for results** (ChatGPT recommended · Grok · Ask each time · I'll copy and paste), Appearance (Preview, part
  4), Your couches (as step 9 had them), **Help** (How each game works: each season game in a few plain lines, `games.ts HOW_EACH_GAME`, the
  game's own Rules sheet's sentences without one game's numbers; Report a problem into classic's `issue_reports`), **Your account** (signed
  in as, your email, Change password through Better Auth's `changePassword`, Link Google once it's set up), the classic design and the
  mock, Sign out. A switch or a choice saves as it's tapped; the switches are bone, not the mock's yellow (the yellow rule).
- **The profile sheet** (the me card's Edit): your picture (chosen on the phone, its middle square drawn 256 by 256 into a canvas and sent
  as a JPEG: the photo itself never leaves the phone; Change or Remove it), your name (Better Auth's username plugin checks it as sign-up
  does and keeps it lower case; "That name's taken" under the field), your colour (eight: DESIGN.md's chart set and two more, with Undo).
- **One name** (from Noticed, two names for one person): your username is the name your couch sees (step 9 part 2 decided so), so saving a
  new one sets the username and the account's name, renames your seat in every league you play (a league write each, only where it
  differs and nobody else in that league already goes by it: a seat whoever runs the game named, a computer player) and re-signs your
  messages. Everything the new design reads by account (chat, Recent changes, filled in by, rankings, accolades, the feed, couch lines)
  already said the username; the tables and draft said the seat, so after a save they all agree. A seat named before keeps its old name
  until its person saves theirs (Noticed).
- **One face** (from Noticed, the verdict's faces are initials): `Avatar` (and the guide's and rail's tiny faces, `TinyFace`) draws a
  person's picture, else their initial on their chosen colour, else their id's colour as before (`colourOf` keeps every face's old colour
  for anyone who hasn't chosen). The faces come with the home read (`usePerson` only watches the cached home: you and everyone on your
  couches), so no new read; someone outside your couches (a public pool's table) is an initial. A picture is read only by someone on a
  couch with its person (or themselves, or a site admin), and the browser keeps each version for good.
- **Your AI** (the mock's AI.pref): every Ask an AI sheet leads with your choice: Open in ChatGPT or Grok, both side by side (Ask each
  time), or Copy the question first with the apps as the rows under it (I'll copy and paste). It was remembered per device
  (localStorage) before; now it's the account's, and "Use Grok instead" switches only that sheet.
- **The couch** (from Noticed, no couch rename or hand-off, invite codes never expire): whoever runs a couch (its owner, now labelled "Runs
  it", not "Started it", since it can be handed on) renames it (Undo) and hands it on (the new owner joins in their own right; whoever ran
  each game still does); anyone on it gets a new code, which retires theirs (it stops opening the couch; asked first, naming the code).
  Codes still don't time out on their own (decided: a new code is the way to stop one).
- **Google** (from Noticed, a username-only account can't add Google later): Link Google (`authClient.linkSocial`) with `accountLinking:
  { allowDifferentEmails: true }` in auth.ts, which only applies to linking from inside a signed-in account (a username-only account has no
  real email to match). Not tried against Google: there's no OAuth app yet, so the row doesn't show (the user's, Waiting).
- **Fixtures and Preview:** `settings.profile` is gone; `settings.account` is split into `settings.notifications` (part 2),
  `settings.sharing` (part 3) and `settings.appearance` (part 4), which are the page's only Preview left (with `hub.notifications` and
  `show.notifications`, part 2's).
- **Changed from the mock:** one spoiler switch, not two (the mock's "No results in notifications" is part 2's to decide: a push's words
  are the guard's, and this switch is the guard's); no Take the tour again (the new design has no tour: Noticed); Your account is new
  (the mock had no password or email); "since" is the first season you played.
- **Checks:** `scripts/dev-test/check-new-settings.js <outDir> [--width=390] [--keep] [--api]` (110 PASS at 390, 59 of them the API half)
  on new-fixture.js: the profile and its refusals, colours on everyone's home, Hide scores as the guard's setting, a new name (taken, too
  short, punctuation; lower case; seats in three leagues, not the pool where riley's seat had the name; messages re-signed; riley's table;
  signing in with it), pictures (kinds, size, couch-mates only, cache headers, removed), the couch (rename, hand on and back, refusals, a
  new code retiring the old one only); then the browser as alex (the page's order and its three Previews, Hide scores' Undo, each AI choice
  leading Backstage's Ask an AI sheet, the profile sheet's colour with Undo, a picture shrunk to a 256-pixel JPEG and on the hub's top, a
  taken name then a new one, the couch's sheet: a new code, Rename with Undo, Hand it on; How each game works; Report a problem kept; Change
  password refused then changed and back) and riley (alex's picture on his face, no Rename). `browser.js api()` gains `raw()` for a body
  that isn't JSON; new-fixture's down also deletes zt people's `issue_reports`. `tests/people.test.js` (3). Seen at 390: Settings, the
  profile sheet before and after a picture, each Ask an AI lead, the couch's sheet and its new code, Hand it on, How each game works, Change
  password, riley's couch sheet. The rest pass, one at a time: check-new-streaming (114; its "nobody's progress in the home read" now
  expects each member's face too), -watch-along (276), -episode-games (285), -plans (104), -listings (77), -guide (57), -library (91),
  -start-game (75), -make-it (81), -watching (114), -solo (92), -way-in (85), -couches (114), -hub (77), -draft (90), -settling (96),
  -results-ways (89), -ours (89), -desk (100; its castaway Override assertion missed in the batch and once alone, then passed: Noticed's
  flake, which now prints each league's Erics when it misses), -community (82), -backstage (67), -backstage-ii (116), -show (69), -shell
  (46), -reveal (49), -stats (57), -chat (52), check-foundation, check-preview and check-backup-restore; `npm test` 635 of 635; type-check
  clean; lint (src) as before (the old error in classic's `use-sheet-swipe.ts` and the old warning in `episode-results.ts`).
- **Noticed, left as is:** five, now in Noticed, not fixed: a seat named before keeps its name, stored lines keep the old name, no email
  added or changed, classic's profile renames nothing, no tour. Taken out: two names for one person, the verdict's faces are initials, no
  couch rename or hand-off, invite codes never expire, a username-only account can't add Google later (all above).
- **For part 2:** push-core.js' `NOTIFICATION_TYPES` and `notification_prefs` are where the moments go; `push-events.ts` builds each push's
  words (classic's spoiler split is `splitBySpoilerProtection`, which part 2 replaces with the guard's words per reader); the settings
  page's `settings.notifications` Preview is where its section goes, and the account's AI and spoiler switch show how a setting saves
  (`profileApi.save`, `useAfterProfile`). Migration 0136 is next.

### As built, step 15 part 2 (2026-10-26, on `new-design`): notifications by moment

Migration **0136** (ships with 0b's, same rehearsal): `notifications` (the bell: a notice per person, worded for them, with `spoils` and
`safe` for one that names a result, and a `key` that makes it once per person; **not backed up**, decided: notices, not the game),
`waiver_runs_seen` (**not backed up**: a seen mark), and `user_settings.tz` / `.notes_read_at`, `notification_prefs.chat` / `.shows`,
`fact_disputes.told_at` (backfilled as told for every flag already settled, so nobody hears about an old one), all backed up with their
tables. Nothing polls or runs on a schedule (HOSTING.md). New: `src/lib/moments.js` (+ `.d.ts`; pure, required by push-core.js under
bare node and imported by the new design), `src/lib/server/notify-prefs.ts`, `GET/POST /api/me/notifications`, `GET/PUT
/api/seasons/[id]/notifications`, `POST /api/seasons/[id]/waivers` (`{ seen }`), `src/new/settings/notify.tsx` and `controls.tsx`
(SwitchRow and Choice moved out of settings.tsx), `src/new/hub/notes.tsx`, `src/new/show/notify-sheet.tsx`,
`scripts/dev-test/fake-push.js`, `scripts/dev-test/check-new-notify.js`, `tests/notify.test.js`.
- **One sender** (`push-core.js sendPush`, still CommonJS for the hourly jobs) for every push of both designs and the jobs. Its `message`
  may be a function of the reader (`{ userId, ui, tz, chat }`), which is where push-events.ts lets the guard decide each reader's words
  (`guard.ts seenThrough`); classic's `splitBySpoilerProtection` is gone. It keeps a notice in the bell for everyone it's for, whatever
  their switches (a `key` someone already has: neither kept nor pushed again), then pushes only where the reader's switches let it
  (`moments.js pushAllowed`: the type, its moment for this show, `anyOf`), opening the design the reader is on (`next` for the new design,
  `url` for classic: `user_settings.ui`). The new design's own moments (`NEW_ONLY`: a poll, a night planned or called off, a game started,
  a bingo line, a flag settled) aren't pushed to someone on classic, whose screens can't open them (they're kept in the bell for the day
  they switch). Chat is never kept (the Chat tab has its count). In development only, a loopback http endpoint is delivered over plain
  http (`loopback`: fake-push.js; web-push speaks only https), and `/api/me/push-subscriptions` takes one.
- **The moments** (the mock's; `moments.js MOMENTS`) are classic's types grouped: Lineup reminders (reminder, waiverReminder, draftTurn,
  waivers), Early results are in (episodeResults), Final scores are in (finalScores, new; betResult; flagSettled), Invites and join
  requests (invite, memberJoined, couchJoined), and two the mock didn't have, for what Noticed asked to push: On the couch (gameStarted,
  planned, planOff, poll, newBet, bingoLine) and Backstage (resultsDue, wikiReview; shown to whoever runs a game); then Couch chat. A moment
  is on while any of its types is; switching it writes all of them in `notification_prefs.disabled`, as classic's switches always have, so
  the two designs agree (classic's list leaves out NEW_ONLY). Couch chat: Every message, Quiet on episode nights (recommended, and the
  default in both designs: NULL), Never (= classic's chat type off). **Changed from the mock:** draft turns and waivers ride on Lineup
  reminders (the mock had no row for them), predictions graded and flags settled on Final scores, and the two rows above are new.
- **Decided: one spoiler switch.** The mock's second, "No results in notifications", isn't built: a push's words are the guard's for its
  reader, so with Hide scores until I reveal on (part 1's switch) a push says "Episode 6 results are in", never who went home, and with it
  off it names them, as the app does. A second switch could only say "names in the app, none in pushes"; Settings' line under the moments
  says how it works.
- **Results by stage, once per person** (`notifyEpisodeResults`): keys `results:<season>:<n>` (early, or both when the results arrive
  final at once, pushed if either moment is on) and `final:<season>:<n>`, so three linked games, and another couch's game on the season,
  are one notice per person and stage. The season sync offers an episode only when its stage changed (a correction isn't news); classic's
  own result routes still call it per elimination (the keys make it once). Seen: "Episode 6: Cristian Chavez went home", "Final scores the
  morning after." / "See where you stand."; not seen: "Episode 6 results are in · Reveal when you've watched." The waiver line ("Waivers
  process Tue 5:00 PM PDT.") in the reader's zone.
- **The couch chat everywhere** (`notifyCouchChat`, from both designs' post routes; Noticed's chat pushes are still classic's): the
  conversation's readers are its games' players (and classic's linked group) and, on the new design, anyone on the couch who follows the
  show, a show the couch only watches included. Each is worded by the chat's own fold (`chat-fold.ts isFolded` at their mark): folded, "alex
  sent a message. It may be about Episode 4: catch up when you reveal." (by mark: "from further along"), never the text; on Quiet a folded
  message isn't pushed. One notification per conversation on a device. Classic readers hear only their games' chat, and not while catching
  up there.
- **New pushes** (Noticed's): a **poll** (`notifyPoll`: the couch's followers who may see it, seen the episode before); a **bingo line**
  (`bingo.ts bingoLinesOn`: after the sync, for the episodes it touched, and after a tick, any card's on a talk show; its owner and the
  couch-mates with a card on the episode, only once they've seen it and only if the owner follows openly; a key per owner); a **flag
  settled** (`season-decisions.ts tellSettledFlags` claims `told_at` after every sync: upheld "You were right about Episode 6", kept "…'s
  result stands", a missing one "was checked again"); **someone joining your couch** (`notifyCouchJoined`); **Tell the couch** as its own
  `gameStarted`, a **planned night** as `planned` (each reader's time: "Sat 5:00 PM PDT"), and a **night called off**
  (`notifyPlanOff`: the request's own after() waits 8 s, past the toast's 5 s Undo, then tells whoever was invited or in, only if it's still
  off at the same moment).
- **Times in the reader's zone**: `user_settings.tz` kept from the new design's home read (`?tz=`) and classic's `/api/me?tz=`, written
  only when it changes (never while viewing as someone); waiver pushes, the results' waiver line and plan pushes say it, else the season's
  zone. **Links by design**: every push has `next` (the draft room with `?game=`, Waivers, Tonight, Games, Chat, Episodes, Backstage's
  Results or Members, Settings, the hub) beside classic's `url`.
- **The bell** (the hub's top bar, `hub/notes.tsx`): a dot and "Notifications: N new" from the home read's `notes.unread` (one indexed
  count; never polled); tapped, it reads `/api/me/notifications` (up to 50 from the last 30 days, with the show's art; each row through the
  guard again, so one past your mark now reads its safe words), marks them read once the list is in (the new ones keep their mark while
  it's open: the plan's "read when it opens", so the mock's Mark all read isn't there), and a row opens where it's about. A notice older than
  30 days goes when a newer one is written for that person.
- **A show's Notifications** (its ⋯ menu, `show/notify-sheet.tsx`): the six moments a show can have, on or off for that show (every
  season of it: `notification_prefs.shows`), with Undo; one that's off in Settings shows off and says so; chat's row says Settings' choice.
- **Settings' What we notify you about** (`settings/notify.tsx`): this phone (can't / add to Home Screen first on iPhone / blocked / off /
  on, with Turn on and Turn off through classic's push-client; `enablePushOnThisDevice` now registers the service worker when nothing has,
  so Turn on no longer waits forever on a dev server), the moments with Undo, Couch chat's three, and a line on what a push may say.
- **Tonight's "Waivers ran" seen per account** (from Noticed): `waiver_runs_seen`, the waivers read's `seen`, and the run's Done says so
  (`useMarkRunSeen`: the plate goes at once here, and on another phone at its next read).
- **Fixtures and Preview:** `settings.notifications`, `hub.notifications` and `show.notifications` are gone; `settings.sharing` (part 3) and
  `settings.appearance` (part 4) are the registry's last two.
- **Checks:** `scripts/dev-test/check-new-notify.js <outDir> [--width=390] [--keep] [--api]` (126 PASS at 390, 94 the API half)
  on new-fixture.js with **fake-push.js** (a loopback stand-in push service: a P-256 key pair and auth secret per subscription, the dev
  server's encrypted, VAPID-signed request decrypted with web-push's http_ece, a forgotten one answered 410): time zones kept, the moments
  and classic's switches agreeing, a show's own, the chat in both designs (folded, Quiet, Never, watch-only, a show's chat off), a waiver
  run's push and the plate seen on a second phone, results early and final once per person for three games and worded by the guard, a
  show's moment and classic's own switch off with the bell keeping it, the bell read back through the guard, a poll, a game started, a
  night planned in two zones and called off (and Undone in time), kat joining, a flag settled on the desk, a bingo line, the bell's count
  and list and 30-day pruning; then the browser as alex (Settings' section, this phone turned on through a stand-in PushManager and a test
  push reaching it, a moment and Couch chat with Undo, a Preview tap, the bell's dot, list and read, a row opening the poll's show, a
  show's Notifications with Undo). `tests/notify.test.js` (5: the moments over the types, and the sender's per-reader words, bell, keys,
  design links and NEW_ONLY). Updated: check-new-settings (two Previews left), check-new-shell (the bell opens Notifications; the Preview
  tap moved to check-new-notify). The rest pass, one at a time: check-new-settings (110), -streaming (114), -watch-along (276), -episode-games (285), -plans (104),
  -listings (77), -guide (57), -library (91), -start-game (75), -make-it (81), -watching (114), -solo (92), -way-in (85), -couches (114),
  -hub (77), -draft (90), -settling (96), -results-ways (89), -ours (89), -desk (100), -community (82), -backstage (67), -backstage-ii
  (116), -show (69), -shell (46), -reveal (49), -stats (57), -chat (52), classic's check-chat-polls --ui (its chat route changed),
  check-foundation, check-preview and check-backup-restore; `npm test` 640 of 640; type-check clean; lint (src) as before (the old error
  in classic's `use-sheet-swipe.ts` and the old warning in `episode-results.ts`). Seen at 390: Settings' section before and after Turn on,
  the hub's bell and its list, a show's Notifications.
- **Noticed, left as is:** five, now in Noticed, not fixed: answers to a plan push nobody, classic's league invites can't be answered in
  the new design, Quiet on episode nights is quiet until you catch up, the bell doesn't say which couch, a real phone's push service is
  untried. Taken out: chat pushes are still classic's, flags don't notify, polls don't notify, bingo doesn't notify, the run's seen mark is
  per device, pushes open classic's pages, join pushes open the new design, Tell the couch uses the invite setting, a called-off night
  tells nobody, a plan's push says the show's time zone (all above).
- **For part 3 (What your couch sees):** share.js's levels go in `guard.ts shares` (rule 3); the notices that say what someone did
  ("riley got a bingo line", "riley started a poll", someone joining) should answer to it too (push-events.ts builds each from who did it,
  so a `shares` check per reader fits in the words function), and Settings' `settings.sharing` Preview is where its section goes. Its
  Noticed: nobody's progress on a show you watch, who's on now can't be turned off, a past season counts for trivia only if it's marked.
  Migration 0137 is next.

### As built, step 15 part 3 (2026-10-26, on `new-design`): what your couch sees

Migration **0137** (ships with 0b's, same rehearsal): four booleans on `user_settings`, `share_where`, `share_now`, `share_ratings`,
`share_reactions`, NOT NULL and on by default (the mock's Everything, recommended), **backed up** with `user_settings` (decided: a privacy
choice has to survive a restore; one that lost it would show what someone chose to hide). Nothing polls, runs on a schedule or pushes
(HOSTING.md). New: `src/lib/sharing.ts` (pure: the switches, `SHARE_PRESETS`, `presetOf`, `sharingFrom`, the words, `whereWords`),
`src/new/settings/sharing.tsx`, `follows.ts markSeenToEnd`, `trivia.ts seenAllOf` (POST `{ seen }` on the trivia route),
`scripts/dev-test/check-new-sharing.js`.
- **The guard's rule 3** (`guard.ts`): `shares(viewer, member, { kind, seasonId })` and its SQL twin `sharesSql(kind, who, season)`, with
  `switchOn` and `followsOpenly` under them and `sharingOf(userIds)` for a batch. A kind is `play` (a show followed openly: your games),
  or one of the switches, each also asking its column. A show watched privately is never shared, whatever the level. Your own always is.
- **Where I am** (what you watch and how far you are): `followsOf` (show-space.ts, behind the home read, the space read, plans' default
  invites, Start a game's Tell the couch line and By the numbers' shows) leaves out the follows of anyone who doesn't share it and carries
  each shared follow's mark. The home read's members get `at` (season to mark, only for what they watch openly); the space's people get
  `seen`. Shown as the mock has it: **Who's watching** ("Plays Outlast · Caught up", "On Episode 5", "Not started"; at your own pace "Ep 6
  of 10" with a bar, and "3 ahead" beside anyone further than you), **The couch is watching** ("riley · Ep 2", "· caught up", "· now"),
  the **rail** ("riley · Ep 6", "riley Ep 6 · +1", "· finished"). Also answering to it: **First to finish** (couch-hub.ts: someone who
  doesn't share it isn't counted), the **fold by progress** (chat.ts `AUTHOR_SEEN`: a message's `author_seen` is used only while its
  author shares Where I am, else it folds by airtime, saying nothing about how far they were; read that way by the Chat tab, the hub's
  feed and the chat push's words, decided at read time so turning it off covers what you wrote before), **reveal lines** (reveal.ts writes
  none while it's off; chat.ts `REVEAL_SHARED` hides old ones in the new design's chat, its "who's revealed it" and the feed) and the
  feed's "started watching". Your games still show under every level: Who's watching lists a player as one ("Plays Outlast"), without
  how far.
- **When I'm watching**: `watchersOn` (watch-sessions.ts: the hub's On now, the Watch along card, a running watch along's others on the
  bar) and By the numbers' most watch alongs. A together session still shows who's in it (step 13 part 3's decision stands).
- **My episode ratings**: ratings.ts `OPEN` is `sharesSql("ratings")`, so the couch verdict, its people, the taste twin, everyone's
  average and the rating accolades leave out someone who keeps theirs. **My watch along reactions**: the watch along's stream, its pins,
  the card's count and By the numbers' most reactions. In a together session what the people in it say reaches the rest of them whatever
  this says (they're in the room, as being in it shows them); everyone watching afterwards gets only what's shared.
- **The notices that say what someone did**: the chat push's words go through the share-aware mark (above: "riley sent a message. It may be
  about Episode 4", never "from further along" for someone not sharing it); a bingo line about someone else is checked per reader in the
  words function (`shares(reader, owner, { kind: "play" })`, which bingo.ts's precomputed flag was). **Decided:** a poll, Tell the couch,
  a planned night and someone joining name their person under every level, as the screens do: each is something you post or do on the
  couch yourself, like a chat message, not something about your watching.
- **Settings' What your couch sees** (the mock's share.js privHTML, after Keeping you spoiler-free): Everything (Recommended) · Just my
  games · Only what games need, each with its line; **What riley sees about you** (someone else on the couch you're on), one line a
  switch from your own data where you have it ("zt_nd_alex is on Episode 3 of ZT Severed 2", "... is watching ZT Severed 2 now", "... rated
  ZT Survivor 51 Episode 4 ★5", "... left 6 reactions on ..."; only shows you follow openly), else what it would share, and Hidden with an
  eye for what the level keeps back; **Customize** (Using the choice above / Your own mix) with the four switches and the mock's note about
  picks and Watch privately. A level or a switch saves as it's tapped, with Undo; a mix that matches no level is your own (no ring on).
  The profile read carries `sharing: { on, lines }`; PUT `/api/me/profile { sharing: { preset } | { where?, now?, ratings?, reactions? } }`.
  **Changed from the mock:** the switches carry a line each (the mock had titles only), and the toast names the switch.
- **Trivia's Seen it all** (from Noticed, a past season counts for trivia only if it's marked): the round carries `past`, the show's
  seasons that are over with accepted results here, not seen to the end and not played (your games' reveals move those), newest first, a
  few. Under your score (or Nothing to ask yet), **Seen an earlier season?** marks one in two taps (Seen it all, then "Yes, all 13"):
  `markSeenToEnd` sets your mark at its last episode without following it (it doesn't join your shows), and the round it deals can ask
  about it. Refused on a season not over (409), another show's (400), one you play (409). The sheet starts a dealt round fresh (keyed on
  its questions).
- **Fixtures and Preview:** `settings.sharing` is gone; `settings.appearance` (part 4) is the registry's last entry.
- **Default for existing accounts:** everyone starts on Everything (the columns' default, the mock's recommended level), so after the switch
  the couch will see each other's progress and who's on now unless they choose otherwise in Settings (said in HANDOFF).
- **Checks:** `scripts/dev-test/check-new-sharing.js <outDir> [--width=390] [--keep] [--api]` (87 PASS at 390, 61 the API half) on
  new-fixture.js, streaming-fixture.js and hub-fixture.js, with fake-push.js: the columns; the profile's sharing and lines, refusals, a
  level, a switch over it; Where I am on the home read, the space, couch shows, the feed, reveal lines read and not written, First to
  finish, the fold by progress and its push's words, a private follow never shown; When I'm watching on On now and the card; ratings in
  the verdict and its average; reactions in the stream and its count; Seen it all and its refusals; then the browser as alex (the section,
  Just my games with its Hidden lines, Customize's own mix and Undo, Severed's Who's watching with "Ep 6 of 10", "3 ahead" and bars, the
  rail's "· +1", The couch is watching's "riley · Ep 2") and casey (Seen an earlier season?, Yes, all 13, the new round). Updated:
  check-new-streaming (members carry `at`; Fresh Drop's chip says "sam · Ep 2"), check-new-settings and check-new-notify (one Preview
  left: Appearance), `tests/guard.test.js` (visibleFollows with the switches, sharesSql per kind, the levels and what a save may send),
  `tests/streaming.test.js` (the chip's progress). The rest pass, one at a time: check-new-notify (126), -settings (110), -streaming (114), -watch-along (276), -episode-games (285), -plans (104), -listings (77), -guide (57), -library (91), -start-game (75), -make-it (81), -watching (114), -solo (92), -way-in (85), -couches (114), -hub (77), -draft (90), -settling (96), -results-ways (89), -ours (89), -desk (100; its castaway Override assertion missed in the batch, then passed alone: Noticed's flake), -community (82), -backstage (67), -backstage-ii (116), -show (69), -shell (46), -reveal (49), -stats (57), -chat (52), classic's check-chat-polls --ui (reveal lines are written there), check-foundation, check-preview and check-backup-restore; `npm test` 642 of 642; type-check clean; lint (src) as before (the old error in classic's `use-sheet-swipe.ts` and the old warning in `episode-results.ts`). Seen at 390: the section on Everything and on a mix, Severed's Who's
  watching, the rail, The couch is watching, trivia's Seen it all before and after.
- **Noticed, left as is:** five, now in Noticed, not fixed: a shared mark can lag for someone who sees results straight away, old reveal
  lines stay in classic's chat, an open Chat tab keeps its fold after someone changes what they share, Seen it all comes after this week's
  play, a rail chip's line is cut short by a long name. Taken out: nobody's progress on a show you watch, who's on now can't be turned off,
  a past season counts for trivia only if it's marked (all above).
- **For part 4 (Studio and the rest):** `settings.appearance` is the registry's last entry (the Studio light theme and Match phone);
  from Noticed: only the newest 300 messages (Earlier messages), no Lock it down. At its end `src/new/preview.ts` and `src/new/fixtures/`
  hold nothing, step 15's Status row says it's done, and the merge-and-deploy step is the user's.

### As built, step 15 part 4 (2026-10-26, on `new-design`): Studio and the rest

Migration **0138** (ships with 0b's, same rehearsal): `user_settings.theme`, NOT NULL, 'night' by default (the new design until now),
checked to 'night' | 'studio' | 'phone'; **backed up** with `user_settings` like the account's other choices. Lock it down needs no
migration (`settings.lockedDown`, a league setting in its state). Nothing new polls, runs on a schedule or pushes (HOSTING.md). New:
`src/lib/appearance.ts` (pure: the themes, the cookie, the grounds), `src/lib/server/appearance.ts` (the account's theme, the device's
cookie), `src/new/appearance.tsx` (the browser side), `src/new/settings/appearance.tsx`, `tests/appearance.test.js`,
`scripts/dev-test/check-new-studio.js`. With this part, step 15 is done and **the Preview registry and `src/new/fixtures/` hold
nothing**: `PREVIEWS` is an empty object and the fixtures folder only its convention file. **Decided:** `<Preview>`, the registry,
`fixtures/index.ts` and `check-preview.js` stay until step C deletes them, as The approach says, so a later step (desktop layouts) that
ports a piece before its data is real can still mark it; `check-preview.js` passes with nothing in it.
- **Appearance** (the mock's settings.js `.segm`, after Your AI for results): Night · Studio · Match phone, a segmented control of three
  44 px buttons, with the chosen one's line ("Light, for daytime", and on Match phone "Studio now" or "Night now"), "Every phone you sign
  in on follows it." A tap draws it at once (the cookie, `<html>`, the bars' colour), saves it to the account (PUT `/api/me/profile {
  theme }`), Undo puts the last one back. **Per account, before first paint:** the account's choice is the truth and the `gys_theme`
  cookie each device's copy (not httpOnly: the boot script reads it). The root layout's boot script (`theme-script.ts`) now knows the
  new design's routes: there it reads the cookie (Night without one, or for anything it doesn't know) and puts `dark` and
  `data-nd-theme` on `<html>` while the HTML is parsed, so nothing flashes; everywhere else it's classic's per-browser choice as before.
  The `(new)` layout's `generateViewport` reads the same cookie for the browser's bars (two media queries on Match phone). The cookie is
  written by every answer that reads the account's choice when the device's differs: the profile's read and save, the home read and GET
  /api/me (which the new design's sign-in asks before it goes in, so the first screen after signing in is right); a device that still
  has another theme catches up when the home read says otherwise (`ThemeSync`, once). Match phone follows the phone as it changes
  (`matchMedia`), with no reload. An admin viewing as someone keeps their own device's theme. The emoji picker follows it too.
- **Studio across the new design:** the tokens are classic's Studio (globals.css `:root`), already DESIGN.md's; the new design forced
  Night by putting `dark` on its column, which is gone (the shell's `nd` div carries no theme). Every screen was looked at in both
  themes (`check-new-studio.js`, below). What changed: the chrome that had Night's colours written in (the tab bar `bg-panel-menu/94`,
  page and pushed-page headers and the draft room's `bg-background/92`, the sheets' scrim `var(--scrim)`, the chat composer and the
  bottom bars of Waivers, Scoring rules, the rulebook editor and the library `bg-background/95`, the draft ticker `bg-panel-menu`); the
  phone column's backdrop and edge per theme (new.css `--nd-backdrop`, `--nd-edge`); yellow as a line (the yellow rule): selection rings
  on photos, chosen plates and focus borders now `chyron-line` (amber on Studio), a ruled plate's kicker `text-plate-line`; the landing's
  top bar, hints and two dark-only gradients to tokens, and its Outlast card's out row; **game colours as text** (`games.ts gameInk`,
  `inkOf`): the colour itself on Night, mixed with the ink (62% of it, new.css `--nd-ink-mix`) on Studio, where Outlast's orange and
  Survival Pool's teal were under 2.5:1 (now 4.7:1 or better), used for the game names on Tonight, Episodes and Commercial break, the
  landing's kickers and the spoiler chip's green; dimmed rows (`--nd-dim`: 0.6 on Night as before, 0.75 on Studio) for a knocked-out
  castaway, an undone change and episodes still to air; won plaques gold as `accent-2`; the hidden toast now hides (its shadow showed at
  the top of a Studio screen). **Decided, Night in both themes** (they carry `dark text-foreground`, so their tokens are Night's): what
  sits on a show's art (the show bar, Tonight's tall header with its compact bar a dark band over the page, the hub's Up next, How it
  works' header, the pool's header, an invite's header), the watch along (a player's screen: you're watching TV), the reveal and the
  waivers run (the broadcast's own moments), the blind draft's reveal, and the landing's phone in a watch along. Posters, guide cards
  and photo tiles already had white type on their own scrims. Unchanged on Night (the check shows it).
- **Earlier messages** (from Noticed): the couch chat's read sends the newest 300 and `more` (one row past them); GET
  `?before=<message>` (`couch-chat.ts readEarlierChat`) the 100 before it, oldest first, folded exactly as the rest (the same
  `foldFor`/`isFolded`, so nothing past someone's mark leaves the server), refused (404) for a message that isn't this conversation's;
  `?since=<message>` everything from it on (at most 1,000) with `more` from one EXISTS. The Chat tab: Earlier messages at the top while
  there are more; a tap shows the page at once, keeps your place, and from then on the 5 s poll asks `since` the earliest message
  you've loaded, so one read stays the conversation (reactions and edits on older messages keep up) and nothing slides away as new ones
  come in. Unfolding (Show them) reads it all again unfolded. Classic's chat still sends its newest 300 (it retires at C).
- **Lock it down** (from Noticed; the mock's settings.js "Competitive mode"): Backstage › Game settings ends with Competitive mode,
  one switch for every game you run here as a Commissioner ("No late joins, no catch-up, rules frozen for the season. Off is best for
  most groups."), on when they all are; one batch in Recent changes for the couch to see ("Locked the game down for the season: nobody
  new joins, the rules are frozen"), Undo on the toast ("Competitive mode on" / "Back to casual"); a Game admin sees it as it stands.
  PATCH `/backstage/settings { lockDown }`. Engine: `GhostLogic.lockedDown`, and `allowed` (which both designs' join paths and
  `joinMode` ask) is false while it's on, without touching `allowLateJoiners` or `joinMode`, so turning it off leaves Who can join as it
  was. **No late joins:** joining is refused ("This game is locked down for the season: nobody new joins"), Let in on a request made
  before is refused (decline still works), the couch's games read says `lockedDown` and the join sheets say "Locked down for the season by
  alex (competitive)". **No catch-up:** nobody new can start one; **decided:** someone already catching up when it's switched on finishes
  (they joined under casual rules, and stopping them would strand their seat). **Rules frozen:** Game settings' lineup size and Who can
  join (and their Reset) are shown as they stand and refused (409), the points refused, and every Scoring rules action (Make it ours,
  Follow it again, what counts, the couch's own moments, a show change's Add it or Skip) refused while any game here is locked down, with
  a "Frozen for the season" plate on the page; waivers stay a Game admin's to run (they're the week's business, not the rules), and the
  desk's fixes and show changes still reach couches that follow the season's rulebook (they're the show's own rules).
- **Fixtures and Preview:** `settings.appearance` is gone; nothing is registered (above). The hub's and the show's checks, which look
  for every `hub.*` and `show.*` entry, have none to find.
- **Checks:** `scripts/dev-test/check-new-studio.js <outDir> [--width=390] [--keep] [--api] [--themes=night,studio] [--only=<re>]`
  (new; 364 PASS at 390, Night and Studio) on new-fixture.js, draft-fixture.js and a desk admin of its own: the column and the profile's theme, a bad one
  refused, the cookie on save (not httpOnly, a year), the home read and /api/me writing it only when a device's differs; the server's
  HTML carrying the boot script and the bars for each theme; **first paint** with every app script blocked (nothing hydrates) drawn in
  Studio; Settings' Appearance (Studio at once and saved, Undo, Match phone following the phone light and dark without a reload, a
  reload keeping it, a second device catching up); then **the sweep**: 34 screens (signed out with an invite, both hub shapes, the profile sheet and
  the bell, a show's five tabs, Your moves, an episode page, stats, the chat and a message's sheet, the watch along, Waivers, Backstage's
  seven pages, a show the couch only watches, sam's reveal, the draft room, Settings, the desk's three) in Night and in Studio, each
  screenshotted and audited from the pixels: a text-free screenshot gives what each line of text sits on (its own fill, a card, a show's
  art), so the **yellow rule** (no yellow text, icon, border or outline on a light ground) and **3:1** fail, and 3-4.5:1 is listed as
  LOW. Extended: `check-new-chat.js` (Earlier messages: 520 more said after Episode 4 aired, the 300 and `more`, a page of 100 in order,
  folded for sam as the rest with nothing of it in the answer, refusals, `since`; in the browser the tap, the place kept, the poll asking
  `since`; 65 PASS, 13 new), `check-new-backstage-ii.js` (Lock it down: a Game admin refused, one batch for three games, nobody new, the
  settings, points and Make it ours refused, the frozen Scoring rules page, off with "Back to casual" and Undo; 134 PASS, 18 new),
  `tests/appearance.test.js` (the boot script in a stand-in page for each route and cookie, the cookie's reading, gameInk, the engine's
  lock), and `check-new-settings`, `check-new-notify`, `check-new-sharing` (no Preview left in Settings). The rest pass, one at a time
  (the batch, `gys15b/batch.sh`, now starts with check-new-studio): check-new-sharing (87), -notify (125), -settings (110; its colour
  toast missed once in the batch while the colour saved, then passed alone: Noticed), -streaming (114), -watch-along (276),
  -episode-games (285), -plans (104), -listings (77), -guide (57), -library (91), -start-game (75), -make-it (81), -watching (114),
  -solo (92), -way-in (85), -couches (114), -hub (77), -draft (90), -settling (96), -results-ways (89), -ours (89), -desk (100),
  -community (82), -backstage (67), -show (69), -shell (46), -reveal (49), -stats (57), classic's check-chat-polls --ui, check-foundation,
  check-preview (nothing registered, step 15 done) and check-backup-restore; `npm test` 647 of 647; type-check clean; lint (src) as before
  (the old error in classic's `use-sheet-swipe.ts` and the old warning in `episode-results.ts`). Seen at 390 in both themes: every
  screen of the sweep, Settings' Appearance on each choice, the Chat tab before and after Earlier messages, Game settings locked down
  and the frozen Scoring rules.
- **Noticed, left as is:** six, now in Noticed, not fixed: some small text between 3:1 and 4.5:1, an undo can change a locked-down
  game's settings, classic's late-joiner switch doesn't know Lock it down, a refusal's toast carries the check mark, check-new-settings'
  colour toast can miss in a batch, Earlier messages and a deleted first message. Taken out: only the newest 300 messages, no Lock it down (both above).
- **Step 15 is done, and with it every step before the merge.** What follows is the user's: the merge-and-deploy step (HANDOFF's Next
  says what to run, in order: a fresh backup, the Neon rehearsal of every branch migration 0100-0138, the merge and push, then `ui='new'`
  for the couch), a week's watch, then C. Desktop layouts come after (until then the new design is the phone column on a desktop).

### As built, polish before the merge (2026-10-26, on `new-design`)

The five things step 15 part 4 left in Noticed, a nit, and one more from Noticed's later polishes. No migration; nothing new reads,
polls, runs or is stored (HOSTING.md unchanged).
- **Small text under 4.5:1** (from Noticed): every LOW line `check-new-studio.js --themes=night,studio` printed, and the same patterns
  where the sweep doesn't reach. Token or opacity changes; Night looks as it did except where it was LOW too. The tab bar's badge
  count is `text-live-foreground` (Night's coral takes the dark ink, 5.4:1; Studio's red keeps white). A row dimmed by `--nd-dim`
  with muted words under it was quietened twice (3.4-3.5:1 in both themes): its second lines are foreground at 85% now (5.0:1 in
  both, still under the title): Episodes' "Episodes 6 to 13", and, which the sweep never showed, a knocked-out castaway's "Out ·
  Episode 3" (Your moves, a game's team) and an undone line's details (Recent changes, the desk's History). The good colour as small
  text on its own tint (Waivers' "Individual immunity win", Add a show's "On your list") is `text-(--nd-good)`, new.css's
  `--nd-good`: itself on Night, mixed with the ink on Studio as `gameInk` is (3.9 to 7:1). The landing's guide cards take the ink
  their colour wants (caption-plate's `colourTag`: The Traitors' red takes white; it was 2.9:1, under the fail line, but off screen
  in the reel, so the sweep never drew it) and their time and episode lines are at 90% (4.5:1 or better). The check now prints every
  LOW line (it printed four a screen) and gains two rows: the landing's guide reel scrolled to its end, and a quiet toast.
- **Undo while locked down** (from Noticed): `league-changes.ts undoBatch` refuses (409, `FROZEN`) an undo of a settings line that
  touches Game settings' fields or the points (`backstage-games.ts FROZEN_FIELDS`) while that game is locked down, and of a
  rulebook line (Make it ours, what counts, a moment of the couch's, a show change taken or skipped) while any game here is; asked
  before anything is put back, so a batch across three games is refused whole, and again under each game's lock. Lock it down's own
  line (Undo is how it comes off), waivers' settings and an archive aren't frozen.
- **A quiet toast** (from Noticed): `toast.quiet(text)` (ui/toast.tsx): the plate with the quiet tag (the design's informational tone)
  and an info mark instead of the green tick, up 4 s instead of 2.6 (reasons run longer); `data-toast="done" | "quiet"` on the plate.
  Every caught error shown as it is, and each refusal or failure said in words ("Only a Commissioner changes these", "Bench someone
  first", "The draft hasn't started…", "Couldn't copy here", "Not sent: …", "Coming soon: …"), across 51 files; confirmations keep the
  tick.
- **check-new-settings' colour toast** (from Noticed): it waits up to 30 s for the saved row, then for the toast.
- **A deleted first message** (from Noticed): the Chat tab sends the anchor message's time with it (`&since=<id>&at=`, and `&before=`
  with `&at=` for Earlier messages), and `couch-chat.ts anchorOf` places a message deleted meanwhile by that time, so the read goes on
  from the next one (and Earlier messages reads the ones before where it was); without a time, a message that isn't there is as before
  (the newest 300, or 404). The tab stops showing the page it held once the `since` read itself is in (react-query's
  `isPlaceholderData`), not only when that read starts at the same message, so the deleted one goes. The time is to the millisecond:
  a message written in the same millisecond just before it can come along with the read.
- **The nit:** `couch-chat.ts`'s rows are typed (`MessageRow`, `pool.query<MessageRow>`), with no `as never`.
- **The guide says Paused under reduced motion** (from Noticed, "for a later polish"): with reduced motion the guide never rolls, so
  its status (Rolling / Paused, now `data-guide-roll`) isn't shown (welcome/hooks.ts `useReducedMotion`, which follows the phone).
- **Checks:** check-new-chat (72 PASS, 7 new: the anchor deleted through the real route while alex's chat is read back, `since` and
  `before` with its time, 404 without, the open page dropping it and keeping the rest, its poll still asking with the time),
  check-new-backstage-ii (141, 7 new: a points change before the lock; Undo of it and of Reset to recommended refused while locked,
  the values kept; the Recent changes page's Undo saying why in the quiet toast; Make it ours' refusal quiet too; the points change
  undone once it's off), check-new-settings (111), check-new-guide (59, 2 new: no status under reduced motion, back with motion),
  check-new-studio (394 at 390, Night and Studio: no LOW line left in either theme). All of them pass in one batch, one at a time
  (`gys15b/batch.sh`): check-new-studio (394), -sharing (87), -notify (125), -settings (111), -streaming (114), -watch-along (276),
  -episode-games (285), -plans (104), -listings (77), -guide (59), -library (91), -start-game (75), -make-it (81), -watching (114),
  -solo (92), -way-in (85), -couches (114), -hub (77), -draft (90), -settling (96), -results-ways (89), -ours (89), -desk (100; its
  castaway Override flake didn't show), -community (82), -backstage (67), -backstage-ii (141), -show (69), -shell (46), -reveal (49),
  -stats (57), -chat (72), classic's check-chat-polls --ui, check-foundation, check-preview and check-backup-restore.
  `npm test` 647 of 647; type-check clean; lint (src) as before (the old error in classic's `use-sheet-swipe.ts` and the old warning in
  `episode-results.ts`). Seen at 390 in both themes: the sweep's screens, the quiet toast (the draft room, Recent changes), Episodes'
  still-to-air row, Waivers' tag, the landing's guide cards, the tab badge.
- **Noticed, left as is:** three, now in Noticed, not fixed: Studio is plain (the user's note during this session: a design step of its
  own), the audit sees a reel's first screenful, classic's white on live red. Taken out: some small text between 3:1 and 4.5:1, an undo
  can change a locked-down game's settings, a refusal's toast carries the check mark, check-new-settings' colour toast can miss in a
  batch, Earlier messages and a deleted first message, the guide says Paused under reduced motion. Left for later, as not small: Where
  you are says "Premieres" before a drop (needs the drop and its count in the where sheet's data).
- **Next:** the user's merge-and-deploy step (HANDOFF's Next, unchanged: a fresh backup, the Neon rehearsal of 0100-0138, the merge and
  push, `ui='new'` for the couch).

### As built, the archetype critique's fixes before the merge (2026-10-26, on `new-design`)

An `/impeccable critique` of the whole new design against the friend group's archetypes (`docs/ARCHETYPES.md`: the Fan Who Forgets,
the Picture-First Partner, the Drive-By…) scored 22/40; its P0 was that reminders never reach the people who need them. The user chose
to fix the P0 and the confirmed bugs before the merge, the layout work after the first blind testers. No migration; nothing new polls,
runs or is stored on the server (HOSTING.md: the reminder ask's cached read of your profile, only while this phone isn't on).
- **Settings says when no reminder reaches you** (`settings/notify.tsx`): the moment switches show your saved choice (on by default),
  which read as "reminders are coming" with this phone off. With no phone of yours getting them (this one not on, `notify.devices` 0), a
  line above them says "None of these reach you yet" and what starts them for this phone's state (turn on, add to the Home Screen,
  allow in the browser, or this browser can't). The phone's state moved up to the section (`usePhone` in `NotifySection`).
- **The dock goes where Tonight's card goes**: a lead move Tonight takes to its own page (a waiver pick, as well as a draft turn or
  blind picks) opens that page from the dock's Set; a waiver pick used to open Your moves on the Weekly Lineup tab (`tabOf` never
  returns Outlast). Tonight's waiver card now carries `?game=` like the drafts and the Episodes row, so both land on the right game.
- **Up next's "who's set" is for the move on its plate** (`hub/sections.tsx UpNext`): "0 of 4 picked" beside a pick, where it said
  "4 of 4 lineups set"; with no count for that game (a waiver pick), the old order (a lineup's before a pick's).
- **The bell says what's still due**: its line says "Nothing new" (not "All caught up"), and a row above the list says the moves due in
  the status line's words, opening that show (`hub/notes.tsx DueRow`, `moveLine` exported from sections.tsx).
- **Checks:** check-new-notify (129: no line while another phone gets them, the line with none, gone once turned on; the bell's due
  row against the home read), check-new-backstage-ii (142: the dock's Set opens Waivers at Outlast), check-new-show (69: Up next's
  count for the lead move), check-new-hub (77) and check-new-studio's hub and Settings, all at 390; type-check and lint clean.
- **The reminder ask, option B** (the user's pick from `.impeccable/mocks/reminders/index.html`; `show/remind.tsx`). Right after a save
  in Your moves (lineups, picks, predictions: what `db/reminders.js` reminds about), a sheet, Want a nudge?, showing the notification
  itself on a drawn lock screen: next week's 2-hours-before reminder, worded as `db/reminders.js` words it ("Pool Party: episode 7 airs in
  about 2 hours · Make your episode 7 pick", and the 24-hours one under it), its clock two hours before airtime a calendar week on (a week
  can cross a clock change). Turn on (bone, not yellow: it's optional) turns this phone on there and then; Not now. It asks only while no
  phone of yours gets notifications (this phone's push state from `usePhone`, now exported from `settings/notify.tsx`, and the profile's
  `notify.devices` 0), only on a season with an airtime (no schedule, no reminders), never on the way in, and once per phone: "asked" is
  kept on the device per account (`localStorage` `gys.remind.<userId>`; no backend). **On an iPhone outside the installed app** the same
  sheet shows Add to Home Screen as three pictures with a numbered line under each (Tap Share · Add to Home Screen · Open it from there)
  and Got it; opened from the Home Screen, the next save asks again with Turn on (an installed iPhone app keeps its own storage, so it
  would anyway). **The row**: after Not now or Got it, a quiet outlined row right under Tonight's episode heading ("Get a nudge before it
  locks? · The day before, and 2 hours before", Turn on, ×) until it's turned on or closed; on the iPhone its Turn on shows the pictures
  again. **After a miss**: when the last episode you've seen has a move of yours that never came in (no Survival Pool pick, or nobody
  started; a new `missed` flag on the episode's game lines, `episode-view.ts nightIn`), the row comes back once, "Episode 6's pick slipped
  by · Want a nudge before Episode 7 locks?", at most once a week, and × closes it for that miss. Blocked or unsupported browsers aren't
  asked (Settings says why). The profile is read for it only while this phone isn't on (HOSTING.md); nothing new is stored on the server.
  - **Not the mock's B exactly:** the "slipped by" row shows for a miss whether or not the sheet had asked before (the mock had it only
    after a Not now). Someone who never saves never sees the sheet, and they're the one a miss tells most; it's still once, after the
    reveal, and only while nothing reaches them. Say if it should wait for a Not now.
  - **The pictures are placeholder art** (`public/remind/add-to-home-screen.svg`, drawn like the mock's frames): replace that file with
    the generated image, or drop in a PNG and change `ADD_TO_HOME_ART` in `remind.tsx`. Generate it from the mock's image prompt **without
    the labels** (the sheet writes them, so they stay readable at 390): three equal square panels side by side, 372 × 120 or any multiple.
  - **Not built here:** the avatar labelled "You" (the mock's last item, separate from B), and asking after a waiver claim or a Call it
    (no reminder covers Call it; waiver reminders do, a follow-up if wanted).
- **The archetypes' paths, walked at 390** (`docs/ARCHETYPES.md`). The Fan Who Forgets: saves on Tonight, "All set", then the sheet with
  the very notification they'd get and one Turn on; Not now leaves the row on Tonight's first screen; a missed pick brings it back once,
  saying so without blame. The Picture-First Partner on an iPhone: three pictures and three short lines, no paragraph; Got it, then the
  row's Turn on shows them again; from the Home Screen, Turn on works. Noticed, not fixed: the row lives on Tonight, not the hub, where
  everyone lands (the hub's layout work after the blind testers could carry it); a Partner whose moves someone beside them makes is never
  asked on their own phone; iPadOS reports itself as a Mac, so an iPad in Safari reads as "can't" and isn't asked (as Settings already
  reads it).
- **Checks:** check-new-show (the Fan Who Forgets' first save: the sheet and its picture's words and clock, Not now's row under the
  heading and outlined, no second ask, × for good, the slipped-by row once after his Episode 5 pick is taken out), check-new-notify (his
  other phone on: no ask; an iPhone in Safari: the pictures load, numbered lines, no Turn on, Got it's row, its Turn on shows them again;
  opened from the Home Screen: asked again, Turn on subscribes that phone, a test push reaches it, the row goes, Settings agrees),
  all at 390, check-new-show 81 and check-new-notify 143 passing; check-new-chat passes too (it saves in Your moves). Both checks
  wait for Your moves itself to close now, since the ask's sheet can open as it goes. check-new-episode-games' browser part runs
  through its save; its talk-show part fails in the evening with or without this change (Noticed, not fixed). Type-check and lint
  clean.
- **Next:** the merge-and-deploy step as above.

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
- The front door (step 9 part 2): signed out, `"/"` becomes the new landing (`/welcome`, or move it to `"/"`) and classic's
  `/sign-in` and `/account` send people to `/signin` and `/start/1`; take `/welcome`'s `noindex` off and give it the FAQ
  JSON-LD and canonical classic's landing has; move `showcase.json` out of `src/components/landing/` before classic's landing
  goes; the reset link's page (`/reset-password`, classic's) gets a new-design screen.
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
