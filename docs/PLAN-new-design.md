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
| — | **Switch the couch to the new design by default** | — | — |
| 8 | Hub I: focus-first hub, More on the couch and its six pages | not started | Opus · xhigh |
| 9 | Couches, sign-up, first run, join, sign-in, solo pools and the practice couch | not started | Opus · xhigh |
| 10 | Watching: Add a show, follow, where you are, Make it a game for every kind; rulebooks phase 8 | not started | Opus · xhigh |
| 11 | TV guide: schedules, all of TV, hide from guide, drops, planned nights | not started | Opus · xhigh |
| 12 | Episode games: Rate it and verdicts, Call it, bingo, polls, trivia | not started | Opus · xhigh |
| 13 | Watch along: pinned reactions, GIFs, together sessions | not started | Opus · xhigh |
| 14 | Streaming shows and the rail | not started | Opus · xhigh |
| 15 | Notifications by moment, account settings, What your couch sees | not started | Opus · xhigh |
| C | Cutover: new design for everyone, classic removed, cleanup; rulebooks phase 9 | not started | Opus · xhigh |

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
- **Noticed, not fixed** (the list below): at the start, read it for anything your step touches and fix it if the
  step is the right place (or say why not); at the end, add anything you noticed and left alone, with the step
  that could take it, and take out what you fixed.
- **End**: update Status and your step's As built; recommend whether to start a fresh session and give a
  seed prompt with model and effort (memory: new-session-handoff).

## Noticed, not fixed

Behaviour a session saw and left alone because it wasn't that step's to change. Each says what happens, where, and
the step that could take it (a guess: any later step that touches it may). Fixed ones come out, with a line in that
step's As built.

- **Predictions are a text field** (step 1; for 12). Real predictions are free-text questions with free-text guesses
  (`Bet` has no options), so the sheet's Predictions tab has a field where the mock has chips. Step 12's Call it and
  polls could give a prediction options (a cast pick, yes / no) and bring the chips back.
- **The morning update replays the reveal** (step 2; for 8 or later). Final scores after an early reveal open the
  episode's reveal again (who went home included), where the mock's sheet shows "so far +14 → final +22": nobody keeps
  what the early reveal showed. Keeping the early total on `show_follows` (beside `early_seen`) would allow the delta.
  Step 5 made early results real (Backstage's quick check), so this now happens for real; it's the reveal's to change,
  not Backstage's.
- **The hub doesn't say results are in** (step 2; for 8). Up next keeps showing the next episode; the show bar, Tonight,
  Episodes, Games and the dock say Results are in. The hub's status line and Up next could lead with the reveal.
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
- **Two names for one person** (step 1; for 15). The tables and who's set show a league's player name (alex), the couch
  line the account's (zt_nd_alex in the fixture), so a face can carry two initials. Step 15's profile (name, picture,
  colour) is the place to make one name win everywhere. Chat signs a message with the account's username, as classic
  always has (zt_nd_riley next to the fixture's seeded "riley"); so do Recent changes' lines ("Made zt_nd_jordan a Game
  admin") and 6b's "filled in by zt_nd_jordan", flags and house rulings, while 6a's Members page uses the seat's name.
- **Chat pushes are still classic's** (step 4; for 15). A message in a game's chat pushes that game's players, linking to
  classic's `/chat` (also for someone on the new design); a show the couch only watches pushes nobody, and nor does anyone
  on the couch who isn't in the games. `couch-chat.ts postCouchChat` is where step 15's notifications by moment would go.
- **A couch with two unlinked games on one season** (step 4; for 9 or 10, once a couch can start one). The new design shows
  the couch one conversation (both games' chats) and posts into the first; classic shows each game's chat on its own, so
  someone only in the second game wouldn't see what was posted from the new design. Linking them (or posting where you
  play) would settle it. Today every couch has one linked group per season, so it can't happen yet.
- **The fold goes by airtime** (step 4; for 14). Everything others said since an episode you haven't seen started airing
  is folded, which is right for weekly and nightly shows; a binge drop folds everything after the drop until you finish.
  Step 14's streaming shows could fold by the author's own progress at the time (what episode they were on) instead.
- **Late joiners have no couch chat** (step 4; for 9). Kept from classic: someone catching up, or a ghost the league can't
  see yet, gets "Chat opens later". The fold would keep them spoiler-safe now, but posting would show them to a league
  that can't see them; step 9's join flow is where a couch member who isn't in the games yet joins the talk.
- **Only the newest 300 messages** (step 4; for 13 or 15), as classic: nothing loads earlier ones.
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
- **The repeat-moment check is loose** (R2's `reviewRulebook`; for step 10's new-show flow). A custom moment whose words are
  all in a built one's is left out as a repeat, so a first research of the Traitors would drop "As a Faithful, voted out a
  Faithful" (it reads as "…voted out a Traitor at Round Table"). Check for changes keeps the rulebook's own moments
  (part 2); a new show has none to keep. Telling the roles apart (a differing noun) would fix it.
- **The desk's Settings is still short** (step 6b part 2, 6c part 2; for C). The tie-break switch and Autopilot's trial (each
  season's bot schedule) are there now; the research model and prompts and What's New aren't (not small: classic's `/admin`
  still has them until cutover), nor a season's episode length (classic's Setup). A person's page only looks (no reset,
  remove or make admin) for the same reason.
- **Undo leaves what another answer also says** (step 6b part 1; for a later polish). Taking your answer back keeps any
  result another source still reports (it's still a source's word), but the toast says only "Undone"; it could say "3
  results still stand: another answer reports them".
- **Flags don't notify** (step 6b part 1; for 15). "You'll hear how it went" is the flag's status: Backstage's Flags from your
  couch (for whoever runs a game) and "you flagged this" on the episode's sheet. A push when a flag settles belongs with
  notifications by moment.
- **"Nobody went home" never applies on its own** (step 6c part 2; for a later polish). A quick check that says nobody left
  always waits for It's right, however many sources it has (a check run too early can find nothing and say so); entered by
  hand, or in a full answer, it applies like any result. Two couches' quick checks saying nobody could confirm it instead.
- **Not in Recent changes yet** (step 5; for 9 and 6b). Logged: every classic results route, settings, roles, players,
  the cast and tribes, waivers (process, undo, window), the catch-up reveal, lineup locks, the draft's start, order,
  settings and take-back, a draft pick or lock-in made for someone and a waiver claim sent for someone (step 7), the
  finale's results, prediction questions, rule changes, scoring rules, renaming, linking and moves made for someone else.
  Not yet: invites and late-join starts (step 9's join flow: 6a's Members has no invite of its own), the hourly waiver job's own
  processing (a run it made is still taken back from Backstage › Waivers' Last run, which logs that) and a super-admin's
  membership edits in classic's `/admin` (the desk's Hand it on is logged). Classic's screens don't show the log (only the new design does) and its own Undo buttons don't
  mark lines undone.
- **Backstage's setup jobs** (step 5; the draft's since 7; the rest for 9 and 10). Needs you has results jobs and "Schedule
  the Outlast draft" (step 7); classic's other commissioner items (Add the cast, Invite players, a catch-up league's next
  reveal: `commissioner-items.ts`, the home's `backstage`) link to classic pages, so they wait for the pages that fix them
  (step 9's invites and join, step 10's cast import).
- **Who can join is on or off** (step 6a; for 9). The mock's "Ask me first" and its join requests ("kat asked to join
  Weekly Lineup · Let in") don't exist anywhere: Game settings' Who can join is classic's late joiners, Anyone on the couch
  or Nobody new. Step 9's join flow is where a request would come from.
- **No "Extend a day"** (step 6a; for 6b or later). The mock's Backstage › Waivers has it; the engine has no way to move a
  week's deadline (a window's `processAt` is worked out from the schedule). Small: an override on the period.
- **No "Lock it down"** (step 6a; for 10 or later). The mock's Game settings has a competitive switch (no late joins, no
  catch-up, rules frozen); only the first means anything in the engine today (Who can join).
- **Taking someone out takes them off the couch** (step 6a; for 9). The mock says "they stay on the couch"; the couch's
  members are worked out from its leagues (`couches.ts` `pruneMembers`), so someone with no other game there leaves it.
  Restoring them (Recent changes) puts them back on it.
- **The run's "seen" mark is per device** (step 6a; for 15). Tonight's "Waivers ran" plate goes once you've watched the run
  here (localStorage), so another phone shows it again until the week ends.
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
- **Pushes open classic's pages** (step 4 for chat, step 7 for the draft; before the couch switches, or 15). "You're on the
  clock", a draft Nudge, results and chat pushes link to classic's routes (`/draft?league=`, `/chat`, ...), so someone on the
  new design lands in classic from a notification. Before the couch switches, a push should open the new design for people
  on it: classic's routes could send someone with `ui='new'` to the show (and the draft room, with its `?game=`).
- **The pick timer needs someone in the room** (step 7, as designed). There's no job: when a turn's time runs out, a phone with
  the draft room open asks the server, which checks the clock and picks from their queue if the game says so. With nobody in
  the room, the pick waits until someone opens it (whoever's on the clock is pushed when their turn starts, and can be
  nudged). A turn with no timer reads as "hasn't picked yet" after 3 minutes, when Nudge and Pick for them come up.
- **The draft's points are the game's** (step 7; for a later polish). A draft after episodes have scored (a late league) shows
  each castaway's points as this game counts them (`castOf`), where the Cast tab and waivers count the season's facts.
  Drafts before the premiere (every one so far) show tribes instead.
- **Fewer starters trims lineups** (step 6a). Lowering Who scores each week keeps the first starters of a lineup already set
  for the next episode; Undo puts the number back, not the trimmed starters (the lineup then reads "not set", so it's asked
  for again).

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

**Then the couch switches:** set `ui='new'` for the three members (with their OK), keep classic one tap
away, and watch for a week before step C is even considered.

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
- **The switch (needs the user's OK):** steps 1–7 are done. Switching the couch means the branch reaches production: a fresh
  backup and the Neon branch rehearsal of 0100–0117 (0b's As built: the user's terminal), merging `new-design` into master
  and deploying, then `ui='new'` for the three members, classic one tap away, and a week's watch before step C.

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
