# Plan: sports in good shape, technically and in design

> **Status (2026-11-20): Active, Phase 0 and Phase 1 done but 1.1's screens, merged and live** (f1488cf1..ba8f3a8e, deployed
> 2026-11-20; migrations 0308 to 0310 rehearsed on a copy of production first). Written from two audits on 2026-11-19: the
> engine, data and operations, and every screen a sports fan touches.
> Phase 0 confirmed all four inferences, each with a check, and found two bigger gaps; step 1.0 closed both (BACKLOG 220 and 221),
> 1.3 made team defenses people and kept same-named players apart (BACKLOG 145), 1.2 stopped silent zeros and takes corrections,
> 1.4 keeps rosters current (signings, trades), 1.5 reads injuries and byes, 1.6 made the small fixes (BACKLOG 108, 78), and
> 1.1's part 1 puts finals in the standings within the hour; its part 2 counts a week's games as they end; its part 3 counts a
> game being played, its points so far, for anyone shown everything (never an own-pace seat or anyone hiding sports scores).
> Phase 2 under way on branch sports-phase2: 2.1 done (the NFL's season locks at each player's game), 2.2 done (any fantasy
> playoffs end by Week 17, and the default plays a final between the top two then: BACKLOG 226), 2.3 done (lineup slots for every
> team sport, MLB's eligibility from ESPN's positions, computer players drafting and starting legal lineups). 2.7 added: a game's timing on
> through the playoffs, the maker's choice (the user, 2026-11-20).
> Next: the rest of Phase 2 (its calls answered 2026-11-19, own pace for sports added) and 4.1; 1.1's
> part 4 (the screens, on a small live read) is the design round's page 2.
> The user's calls 212–219 are answered ("Decisions", below); BACKLOG 175 still waits.

The user, 2026-11-19: "I want to make sure sports is in a good spot both technically and redesign needs. Make a plan for that."

---

## Where sports stands (2026-11-19)

**The engine is broad, and its tests pass.** Ten sport families read from ESPN (football, basketball, baseball, hockey, soccer,
college, golf, racing, MMA, tennis). Every kind of scoring a fantasy app has is built: points per stat, categories head to head
and roto, places, a match's format, slates, locks by week, day or game, head to head with playoffs, postponed and called-off
games. The 517 sports unit tests all pass (63 s, no database or network). Of Start a game's 48 sports bases, 34 play and 14 say
"Coming".

**But no real couch has played a sports game, and no real season has been replayed through the app.** What exists is proven on
recorded games and generated worlds, not on a season. The audits found these, in order of how soon they'd bite a couch playing an
NFL or NBA season game now:
1. **Results are slow.** Sports' scheduled work runs only inside the once-a-day TV listings job, which runs only when the bot VM
   calls (tv-listings.ts:332). A slate week counts only once every game is final (score.ts:224), so a Sunday reaches the standings
   on Tuesday or Wednesday, and no screen shows anything moving in between.
2. **A failed read becomes a silent zero.** Once a game is old, `saveFinals` stores empty lines for one it couldn't read and never
   asks again (finals.ts:78-90; the update only touches rows whose lines are null). Everyone in it scores 0, and nobody is told.
3. **No team defenses** (confirmed in Phase 0). The NFL default has a DEF slot and box scores score defenses (`def:<team>`,
   football.ts:182), but the cast fill never adds them (nothing in src/lib/server/sports/ mentions one), so the slot has nobody to
   draft.
4. **Same names collide** (BACKLOG 145). A sport's cast is unique by name, and lines match by name: of the NFL's two Josh Allens,
   whoever's team plays first keeps the name.
5. **A dropped player can still count.** With locks at each player's game, `lineupAt` (state-logic.js:4498) skips the
   dropped-player filter, so a released player counts, possibly for two seats (idea 209).
6. **Nothing is read twice or kept current.** No stat corrections (a final is read once), no injuries, no byes, no trades (a traded
   player locks on his old team's game), and new signings never reach a running league.
7. **The NFL default locks every lineup at Thursday's kickoff** (football.json, `closes: 'weekly'`). Locks at each player's game
   are built but aren't the default.
8. **Smaller:** a slate's plain Pick'em is never graded (BACKLOG 108; the gallery's version is safe, the sports start route's
   isn't); lineup slots are enforced for football only (index.ts:149); stale checks (BACKLOG 101, 78, called-off part 4).

**Phase 0 found two that bite before all of these** (2026-11-19, replaying the recorded 2026 NFL season through the app's own
code): a game started on a sports season has nobody to draft, since a game copies only an approved cast and nothing approves a
sport's people (BACKLOG 220); and nobody fits a football lineup slot, since positions are kept as ESPN's names ("Quarterback")
while the slots take its abbreviations ("QB"), so the engine refuses every lineup of real players (BACKLOG 221). The explorer
and the bench set both up by hand (an approved cast, positions as abbreviations), so neither could see them. Step 1.0 fixed
both the same day.

**The design round did sports checks, not sports design.** Steps 2–9 proved that the parts hold at sports scale: the matchup
pairs QB with QB, the draft room searches a 344-player pool, the guide has Sports, and Start a game uses the same screens. Step
10, "Sports in full", never ran, and these were never designed:
1. **The lineup editor** (dock.tsx:450-562): five rows of tall face tiles for a 15-player roster, athletes by first name
   (`first(c.name)`), no position until started, no opponent, kickoff, bye or last line, "Episode N" and "Airtime does", and
   locks by game still TEMP-UI (DN 38).
2. **The live game has no screen.** LiveGame and LiveEvent exist in src/lib/sports/ and no page uses them; the server scores
   finals only, so there's nothing live or provisional to show. Patriots v Lions was recorded live (266 frames) to design on.
3. **A game's night, Tonight's Last time and the reveal** read as a show's ("Nobody went home" at 48 px, "All safe · 3 of 3 still
   in"), with no score or box score anywhere. A sport has no reveal by default, and no push says a matchup was decided (BACKLOG
   100).
4. **The families' own displays** (DN 35–39): categories, roto, a field's places, a card's matches, a slate week by game, and
   "Postponed". The game view (game-view.ts) doesn't carry their data, and a called-off week reads "Counted for nobody".
5. **Waivers at about 300 free agents**: no search, no position filter, empty bars for athletes.
6. **Players and the athlete**: no sortable stat table, no Compare, and the athlete chart scrolls sideways from game 1, which
   breaks at 82 or 162 games.
7. **Event sports can't be found.** Golf, racing, MMA and tennis are filtered out of Add a show's search, and first run finds shows
   only (BACKLOG 43).
8. **About 25 places use a show's words** ("contestant", "each episode", "airtime", "2 a 2PT", "S2026"): BACKLOG 75 and the list
   in Phase 4.0.

**Verdicts per sport, now** (from the technical audit):
- **Single games, pick'em and squares:** ready with caveats for every sport.
- **A season-long league:** not ready for any sport.
- **Event sports** (golf, racing, MMA, tennis): ready with caveats, but they can't be found from Add a show, and at most 10 events
  are saved a run.
- **College:** ESPN's scoreboards list only its default selection, so smaller schools' games may not link.
- **Not supported:** college hockey, boxing, cricket, AFL as a scored sport.

The full audits, with their file and line evidence, are [sports-audit/technical-2026-11-19.md](sports-audit/technical-2026-11-19.md)
and [sports-audit/design-2026-11-19.md](sports-audit/design-2026-11-19.md).

---

## What "a good spot" means (the exit criteria)

1. **Right and on time.** A season-long NFL, NBA or NHL game scores right all season: each final in the standings within an hour,
   corrections taken, no game zeroed silently, the right people (ids, defenses, trades, new signings, injuries), and the locks
   and slots fans expect.
2. **Proven on a real season.** A whole recorded NFL season, and a month of NBA and of MLB, replayed through the real routes with
   a couch of computer players, with zero disagreements against the oracle (Phase 3). This is the gate.
3. **Designed for sports.** Step 10's pages, each approved by the user from a screenshot story on real data. No show words on any
   sports surface, and every sports situation renders at 390 on the real routes.
4. **Played for real.** A real couch plays one sports game start to finish without a manual fix (the pilot, BACKLOG 212).

MLB's season starts in late March 2027: its slots go in with the NBA's and NHL's (Phase 2), and its own month replay can wait
for spring training.

---

## The phases

Sizes: S is under an hour, M about a session, L several sessions. Phases 0–3 are one technical lane and can run beside Start a
game's E3 (a lane of its own, PARALLEL-SESSIONS.md). Phase 4.0 can ship any time. The design round (4.2) starts once Phase 1 and
4.1 are in, so its designs are judged on data that's right.

### Phase 0. Confirm four inferences (done 2026-11-19)

On the local database, with the recorded 2026 NFL season (espn-snapshot.js: 32 teams, about 2,550 people, Weeks 1–9 final with
box scores) as a slate through the stand-in ESPN. The fixture is `scripts/dev-test/nfl-slate-fixture.js`: a process clock
(sim-clock.js), the stand-in answering as ESPN would have at the clock's moment, so a played week can be started, answered and
played again, the daily job run each morning as production runs it, `zt-nfl-` people on a couch, an up and a down. Each check
asserts where its fixing step leaves it, so each fails today and passes once that step lands; each runs in 9–14 s with no app
server.
- **(a) Team defenses: confirmed.** None of the slate's 2,546 people is a team defense. Each final scores both sides' D/ST (30
  lines in Week 9), and they belong to nobody. Nobody can play the default lineup's DEF slot. `check-nfl-defenses.js` (step
  1.3).
- **(b) New players: confirmed, and wider.** A game started through the sports route or the wizard on a sports season gets
  nobody at all. A game copies its people only from an approved cast, at its start (new-game.ts makeLeague: `approvedCastFor`),
  and nothing approves a sport's people, so every draft game says "Add the cast first" (BACKLOG 220). With the cast approved by
  hand, the game keeps who was there at its start. A signing reaches the season's people (a later fill for a team with nobody,
  or the Players tab's read) but never the game. Nor do the teams on a bye the week it started (the Steelers and the Titans, 154
  people). `check-sports-new-players.js` (steps 1.0 and 1.4).
- **(c) Pick'em on a slate: confirmed** (BACKLOG 108). The route's Pick'em asks one "Who wins?" a week with no sides to pick
  from, takes an answer anyway, and never grades it. The gallery's per-game Pick'em, started on the same week as the control,
  grades all 15 games. `check-slate-pickem.js` (step 1.6).
- **(d) Playoff weeks: confirmed.** The default season game has no playoffs: the standings after Week 18 decide it. With a
  final at the end, Top 2 plays it in Week 18, Top 4 in Weeks 17–18 and six teams in 16–18, started at Week 1 or Week 9 alike.
  `check-nfl-playoff-weeks.js` (step 2.2; `--last=17` is BACKLOG 214's recommendation).
- **Noticed: nobody fits a football slot** (BACKLOG 221). A person's position is kept as ESPN's roster names it ("Quarterback":
  espn.ts `readPerson`), and football's slots take its abbreviations ("QB": defaults/football.json via `withLineupSlots`). So
  the engine refuses a lineup of real players ("Sam Darnold has no open slot"), and Best Ball's slots would count nobody. Two
  lines of check-nfl-defenses.js (step 1.0).
- **Noticed: a game the daily job misses for three days is never read again** (BACKLOG 222). The job reads a linked game only
  from three days back (matchup.ts `refreshSportsEvents`), so a weekend with the bot VM down leaves a game unplayed for good and
  its week never completes (step 1.1).
- The stand-in ESPN now names a football box score's tables as ESPN does (`name`), so the recording's finals read
  (fake-espn.js). Its box scores carry no totals, so a D/ST line there is its game alone.

### Phase 1. Data you can trust (about 5–7 sessions)

0. **Games get their people, and the people fit the slots (BACKLOG 220, 221). Done 2026-11-19 (bb35bea6).**
   - *Built:* a sport's season whose every person came from the provider has its cast approved as soon as they're in
     (season-cast.ts `approveSportCast`: by the fill, and at a game's start for a season filled before), so every game started on
     it takes them; each fill's new people (a team linked later, a signing, a team's series filled after the answer) go into
     every game on the season (cast.ts `intoGames`, the desk's `applyApprovedCastToLeagues`). A roster's position is ESPN's
     abbreviation, the sport's key (espn.ts `readRoster`: "QB", not "Quarterback"), and a fill brings an older season's names in
     line. The faces and the draft room read "QB" as designed (seen at 390 on the real NFL pool: the position chips run QB, RB,
     WR, TE, K first). fake-espn.js serves the abbreviation where a roster has one.
   - *Verified:* check-sports-new-players.js passes whole; check-nfl-defenses.js's three BACKLOG 221 lines pass (its three
     team-defense lines wait for 1.3); check-sports-couch.js --api on the dev server (a new line: the series draft's 16 people);
     483 sports unit tests; check-slate.js. The explorer can't test 221: its worlds give positions as keys and read no roster.
   - *Noticed:* every game on a slate now holds all of its ~2,500 people, a Pick'em or Squares game too (a start copies the
     approved cast into any game): Phase 3 measures what that costs. The draft room's position chips list every roster position
     (G, C, LS, P...), not only those a lineup takes (4.3).
1. **Results within the hour, toward live scores.** The user's call on BACKLOG 215 (2026-11-19): yes to the hourly refresh, and
   the goal is further, live scores during games: "minus the moments that the live api cant get, we'll deal with that later". In
   four parts, each its own session and check:
   - **Part 1, finals within the hour. Done 2026-11-19.** `db/sports-refresh.js` runs the sports part of the daily job
     (refreshSportsEvents: slates, rosters once a day, linked games, finals, corrections) as a step of the hourly "Reminders and
     waivers" GitHub Actions job (no new secret; no new Neon wake-up: the job already connects hourly). The daily run stays the
     fallback. Verified by check-sports-hourly.js on the NFL fixture, the job's own script run on the fixture's clock: Monday
     night's game final at 04:45Z, the week counted by the 05:05Z run (20 minutes; the daily job alone, 6.3 hours), a run with
     nothing new asking ESPN nothing; and the script run with only AUTH_DATABASE_URL, as the job has it. It takes effect once the
     branch is on master (GitHub runs the default branch's workflow). jiti is now a dev dependency of its own (it was only
     eslint's and Tailwind's).
   - **Part 2, a week in progress counts as it goes. Done 2026-11-19.** A slate's week counted only once every game was final
     (score.ts stampStats, `done`). Now each game's lines count as it ends: the server stamps a week in progress with its games
     final so far, marked early (`ep.statEarly`; StatsLogic.stamp's `early`). In the engine a week in progress is early results
     (EpisodeLogic.resultsStage 'early', EpisodeLogic.inProgress) without "having results" (hasResults stays false, so lineups,
     this week's choice, waiver weeks and a move's episode go on as before its last game). The scoring walk counts its points in
     the totals and roto, never in the series: head to head (points or categories), a race and a cut wait for its last game,
     a week in progress behind a later one too (a makeup game). The spoiler cut hides it from anyone behind
     (SpoilerLogic.hiddenEpisodes). The explorer's runtime (core-runtime-46), the oracle (`counted`: a week's games final, in or
     not) and the campaign's invariants say the same. Verified: check-sports-week-in-progress.js on the recorded NFL season (four
     seats, head to head, two quarterbacks from Sunday's early games and one from Monday night's each): Sunday evening's hourly
     run has the week early, everyone's total moved by their quarterbacks, every record 0-0 and someone a week behind told
     nothing; after Monday night's final the week is final, each matchup decided, each total moved by its Monday night player
     alone. check-sports-explorer.js, every case (calledoff's control now a game final so far written wrong behind the runtime
     mid-week: the server counts it); the unit suite (2,456); campaigns sport-wip-slates (seed 210, generator 65, chosen for its slates: 6 slate cases, 5 weeks in progress taken, 4 moving a table, no matchup ever decided on one): 114 of 120 on the final code, the six others standing failures that fail the same on master (BACKLOG 224). **What a screen says** about a week in progress
     (resultsStage 'early' is there to read) is part 4's.
     - *A call made on the way (the user may reverse it):* a seat playing at its own pace that's caught up never sees a week in
       progress past its mark (GhostLogic.viewFor), even when the season's guard tells it everything (it holds a live seat there
       too). Otherwise its own-pace game showed Sunday's points and then, once the week was final and the seat was catching up
       to it, took them away again until it watched the week. Before part 2 nothing past a caught-up mark had a line, so the
       question never came up. Found by a campaign (sport-wip-slates, case 111); a unit test holds it.
     - *Found and fixed on the way:* a hider a week behind was told a week in progress (hiddenEpisodes went by hasResults alone),
       caught by the calledoff route case; and the slates case's "next morning" fell on the first game's own Eastern day after
       9 PM Eastern (the server's now is the real one): it's now half an hour past the next Eastern midnight as the server sees it.
     - *Noticed, not fixed:* the same case's "an hour into the first game" step would be the next Eastern day if run between
       midnight and 1 AM Eastern (left: the window is an hour; the check would say FAIL, not pass wrongly).
     - *For part 4:* the game view's "through" (game-view.ts: `latestWithResults`) stays at the last week in while its totals
       take in the week in progress, so a page that says "through Week 8" beside totals with Sunday's games in needs the week's
       stage said (`resultsStage` 'early' on the episode; the season's games route answers nothing of it yet).
   - **Part 3, live points during games. Done 2026-11-19.** A game being played counts its lines so far as part 2's week in
     progress does a game final so far, so a matchup moves play by play (4.1.2's second half, Phase 5's feed brought forward).
     - *Built:* `src/lib/server/sports/live-lines.ts` takes each of a season's games being played (begun within 8 hours, not yet
       kept, not called off; team sports, ESPN's) and reads its lines so far from the live poller (live-proxy.ts, the one thing
       that asks ESPN live: at most once a game every 10 s an instance, however many read), the plays added up as a phone's poller
       adds them (TeamSport.timeline; once ESPN says final, its box score's correction), at most 30 games a read, waiting 2.5 s
       for a new answer before taking the last one kept. score.ts's `leagueGames` split into its database read and a pure
       working-out (`gamesFrom`); `stampStats(state, { live })` keeps the season's rows by its fingerprint (now with each linked
       game's start time in it) and works a live stamp out again only when an answer moves. A live game's lines join its episode as
       a final's do (the week's sum, each game's own for a table scored game by game), the episode early (StatsLogic.stamp's
       `early`: a slate's week, or an episode's one game), the game itself still being played for the grader, so no question
       settles on it and no matchup, race or cut is decided by it. A game whose row still says it's to start (the hourly refresh
       not yet run) counts once the live feed has it on. Never stored: only `readyLeague(id, state, { live: true })` asks, and
       withLeagueLock's writes stay at the finals.
     - *Who gets them (the spoiler rule):* only season-games.ts's reads (the season's games, the read-only copy, the couch's other
       games), and only for a viewer the season shows everything to (no mark: sports live, not hiding sports scores), in a game
       not played at its own pace, from a seat that isn't a late joiner's. Everyone else's copy is built from the finals alone,
       and cut at their mark besides (SpoilerLogic.hiddenEpisodes; GhostLogic.viewFor). Every other read (the classic state route,
       a solo pool's, the desk's) stays at the finals.
     - *Found and fixed on the way:* GhostLogic.viewFor's own-pace cut (part 2's call) held only for a seat with a pace of its
       own; a game made at its own pace before it aired has none until its first results (paceTogether), so its first week in
       progress showed. It's now cut for such a seat too (a unit test beside part 2's). And a check could have reached the real
       ESPN through a read: under `next dev`, apiRoute now passes a check's stand-in (sportsFor's headers) down to live lines
       (sports/request-sports.ts), and a league named "zt-..." is never asked of ESPN.
     - *Verified:* check-sports-live-points.js on the recorded NFL season, with 49ers at Falcons (Week 7, recorded play by play)
       replayed live by the stand-in at the fixture's clock: before kickoff nothing; in the second quarter the week early, each
       replayed player's line the recording's plays as of then (the sport's own reader as the oracle), each total its players'
       points, every record 0-0, one ESPN ask for three reads, a read without live none of it; the fourth quarter's totals moved
       on; the final counted before the hourly job keeps it, still early; the kept final's lines the same as live's at its final.
       Shown none of it: someone hiding sports scores a week behind, and at the week itself (marked seen while it's played), and
       both seats of an own-pace game made before the week aired (whose copy GhostLogic cuts besides). Parts 1 and 2's checks
       (check-sports-hourly.js, check-sports-week-in-progress.js) still pass; the unit suite (2,457); tsc; eslint has only its
       standing errors (BACKLOG 26).
     - *Measured (for HOSTING.md):* on the server, nothing new in Neon (the season's rows are kept by their fingerprint) and one
       ESPN ask a game every 10 s an instance, as the phones' live route already asks. On a phone it depends on how part 4 polls:
       the whole season's games read is 1.35 MB (136 KB gzipped) on the NFL fixture, nearly all of it the season's ~2,500 people,
       and live points add 0.5 KB; asked every 15 s for an NFL game that's ~100 MB a phone. A game's table and matchups alone are
       1.6 KB (0.5 KB gzipped), ~0.3 MB a phone a game. **So part 4 needs a small live read** (the table, the matchups and the
       plays that moved them), never the whole read polled.
     - *A call made on the way (the user may reverse it):* someone hiding sports scores never gets live points, even with their
       mark at the week being played: a mark says what you've watched, and a game still being played isn't watched yet. A game
       over and kept still counts for them at their mark, as part 2 has it.
     - *Noticed, not fixed:* a field's and a card's live calls (golf, racing, MMA, tennis: live-event.ts) aren't read by live
       lines yet (team sports only). The explorer has no game being played, so its runtime and campaigns don't cover live points
       (the check above does). The in-process games read took 0.4-0.5 s with a new answer on the fixture, most of it the read
       itself, not live.
   - **Part 4, the screens:** the design round's page 2 (the live game and a week in progress), through the design process, on a
     small live read (part 3's measure: the whole games read polled every 15 s would be ~100 MB a phone an NFL game).
   - **Later (the user's words):** what the live feed can't give (a defense's points allowed until the final, a stat only the
     box score has) stays on the final's read.
2. **Never zero a game silently; take corrections. Done 2026-11-19 (2621a3e1).**
   - *Built:* migration 0309 (sports_events.read_tries, read_error, checked_at). A final that can't be read is said on its row and
     asked again; two days on it's kept as none so its week can finish (Claude's call: a held week stalls every matchup, a
     flagged zero heals), but flagged: the desk's Inbox lists it ("Scores") and every run after six hours asks again until it
     reads. A kept final is read again 25 hours after it was kept and once more when the next game of a season linking it starts
     within 30 hours (the daily job's reach; 1.1's hourly run can shorten both), past the cache; a changed answer is kept with a
     new `lines_at`, so the tables follow.
   - *Verified:* check-sports-finals.js (a game with no box score retried and its week held, then kept as none, flagged and on the
     desk; a quarterback's yards corrected 335 to 357 and the season game reading 357; the game healed when its box score came
     back); check-finals.js and check-stats-game.js unchanged; unit tests. A DB check rather than sports-final.test.js: saveFinals
     is the database's.
   - *Not seen:* the desk's Inbox row itself (it reuses the Inbox's row and its "Scores" tag); the Players tab's own lines
     (game_lines, stats.ts) aren't re-read for corrections, only the finals the tables score.
3. **People by ESPN id, not name; team defenses (BACKLOG 145). Done 2026-11-19 (7676a520, bc1bf8a3).**
   - *Built:* a team sport names its teams' own people (TeamSport `teamPeople`: football's "<Team> D/ST", `def:<team>`, position
     DEF), and a fill adds them beside each roster with the team's logo. Migration 0308: season_cast unique by name only for
     people with no provider ids, by provider ids for a sport's; every insert names the new target. The engine's import adds a
     row whose namesake is linked to another row; scoring (`peopleOf`) and per-game locks (`stampGameLocks`) find a person by their
     own row; the player log and athlete history take the team, the athlete sheet sends it and finds its person by team, and a
     face's position is the game's own for that person.
   - *Verified:* check-nfl-defenses.js whole (32 defenses, every D/ST line theirs and read as theirs, a full lineup of nine);
     check-sports-same-names.js (the recording's six repeated names, Justin Jefferson's among them: kept, drafted, scored and
     locked apart, a game log by team); every insert form against the new indexes; check-sports-couch.js --api; unit tests (two
     new engine ones). Golden replays not run: the import's new case can't arise for a show's cast.
   - *Left for the design round:* "a repeated name shows its team" on the faces (castName still reads "J. Jefferson" for both;
     the rows already say each one's team): Phase 4.0.
   - *Noticed:* check-new-make-it.js --api fails at its first ask (the stand-in bot gets no cast answer), before the insert this
     step changed (BACKLOG 223).
4. **Rosters stay current. Done 2026-11-19 (b12ea70c).**
   - *Built:* the daily job refills each sports season with a team game near now once a day (cast.ts `refreshRosters`: at most 10
     a run, oldest fill first; rosters cached a day, shared by a league's seasons). A signing is added; someone whose roster is
     another team's now moves team on their row, so their per-game lock follows, and the push brings the new team into every game
     on the season. Not every sports season, only those with a game from three days back to eight ahead.
   - *Verified:* check-sports-new-players.js (the signing in by the daily job alone; a Giants receiver traded to the Lions moved in
     the season and the running game, his lock held by the Lions' Sunday game); the sports checks and unit tests. HOSTING.md has
     the calls.
   - *Left:* someone cut stays in the season and the games (a free agent nobody can sign elsewhere: ESPN lists him nowhere); a
     trade's team is retroactive in a game's own record (a show's starting tribe), harmless for scoring (lines are by game and id).
5. **Injuries and byes (L9 part 2). Done 2026-11-19 (f59bb62c).**
   - *Built:* a roster's injury kept on the person (migration 0310 season_cast.injury: { code, status, date }; Q, D, O, IR, DTD,
     SUSP, PUP, MLB's injured lists, another as ESPN words it), current through every fill and so the daily refresh; a game reads
     it per request (state.castInjuries). A league's slate's week stamps its teams on a bye (ep.byeTeams, sports/locks.ts byesOf)
     once a later week has a game linked, so a week linked halfway names nobody. Neither saved, nothing on a screen yet: 4.1 puts
     them in the game view, 4.2 designs them.
   - *Verified:* check-sports-injuries-byes.js (a Questionable quarterback and a receiver on IR read by castaway, Week 9's byes
     the recording's Steelers and Titans, one healed and one Out a day on, nothing stored); unit tests from a real roster's shape
     (ESPN, 2026-11-19: injuries [{ status, date }]), names made up.
   - *Left:* ESPN's practice squad (a roster status, not an injury: 436 of the NFL's 2,552) isn't marked; the draft room may want
     it (4.3). Computer players don't yet bench an injured or idle player (Phase 2.3's legal lineups).
6. **The small fixes. Done 2026-11-19 (1ae9b833).**
   - *108:* both: the sports route's Pick'em on a slate asks each game (start-games.ts `perGame`), and our check refuses a game's
     final asked of a slate's episode and squares on a slate (`ctx.slate`). check-slate-pickem.js passes; every gallery base
     still plays (sport-gallery-check.js).
   - *Idea 209's residual:* `lineupAt` leaves out anyone let go before each game's start (`letGoAt`, by the move log's times).
   - *78:* the unit suite checks a sports league against its sport (proved: it failed one without, passes with).
   - *The called-off part 4:* part 3's Eastern day-edge guard.
   - *101:* 12 of its 13 stale cases pass with Sports scores too on, and the default has a case; the last (the Players tab's read
     not filling a deleted game's lines back in) stays open in BACKLOG 101.
   - *Verified:* 580 unit tests; check-sports-explorer.js lineup, slates, locks, calledoff; check-sports-couch.js --api; the NFL
     checks. Golden replays not run (a sport's game-by-game lineup, a slate's refusal).

### Phase 2. The rules a season game needs (about 3–4 sessions; the user's calls answered 2026-11-19)

1. **Locks at each player's game for the NFL** (S; BACKLOG 213, yes): football's season default becomes `closes: 'game'`. A lock
   change reruns every check that asserts a lock (HANDOFF's convention), check-lock-in.js and the explorer's lock invariants.
   **Done 2026-11-20 (branch sports-phase2).**
   - *Built:* football.json's season spec closes `game` (the sport's own cadence, `lock` and the defaults' top-level `closes`, stays
     weekly: it's what a week is, not when a lineup locks). Every football base built on the season (head to head, total,
     guillotine, keeper, auction, weeks won) takes it; the other specs and sports are unchanged. Only a game started from now on:
     a game keeps the spec it was started with. The explorer (core-runtime-47) plays it on a world of one game an episode too, as
     the server stamps the rows it writes for one (each episode's game, no holding's team: runtime-sports.cjs `gameLocks`), so its
     NFL situations and design fixtures open on the new default; before, it was a gap there.
   - *Verified:* the unit suite (2,457; a new explorer test: Friday's lineup open on Thursday where the weekly lock had it shut,
     locked an hour into its own game, the lineup set before it standing; sports-spec's rule now says football's season locks by
     the game; the frozen v1 NFL state reproduces with its lock put back as it was made, nothing else moved); every NFL fixture
     check on the new default (defenses, new players, same names, week in progress, live points, hourly, finals, injuries and
     byes, slate Pick'em; the playoff-weeks check still fails, step 2.2's); check-slate.js; check-lock-in.js; check-sports-explorer.js
     (its first full run was cut off by a timeout in `calledoff`; every case ran on 2.2's code, below); a 120-case engine campaign (`.ui-atlas/campaigns/sport-locks-game`, seed 210): 115 pass, no `sport-locks`
     violation, the five others BACKLOG 224's generator kinds; its three cases locking at each game (two slates, one a game an
     episode: `count.cjs`) pass. tsc; eslint has only its standing errors.
   - *Noticed, not fixed:* check-episode-lock.js's "a new pick doesn't go in" and check-sports-couch.js --api's guide line
     (BACKLOG 225) fail the same on master. The slates case of check-sports-explorer.js failed at 00:57 Eastern and passed at 01:00:
     the midnight-hour edge 1.1 part 2 noted, met for real. The lineup editor's locks by game are still TEMP-UI (DN 38), and now
     every NFL season game has them: 4.2's page 1. How it plays says "Each castaway locks when their game starts" (describe.js):
     4.0's words.
2. **Fantasy playoffs end by Week 17** (S; BACKLOG 214, yes), so nobody's title rides on Week 18's rested starters. Phase 0: the
   default has none, and any final lands in Week 18. Done when check-nfl-playoff-weeks.js passes.
   **Done 2026-11-20 (branch sports-phase2).**
   - *Built:* the NFL's own defaults say its fantasy playoffs leave out the regular season's last week (football.json
     `leagues.nfl.playoffs.endsBefore: 1`, read by sports/index.ts `playoffsEndBefore`; a check's `zt-` league reads as the NFL, as
     `sportOf` reads it). On a game whose playoffs sit at the season's end, on a league's regular-season slate, the server stamps
     the last week they may use beside the season's length (air-times.ts stampSeasonLength: `state.playoffsBy`, 17 of 18), and the
     engine places them no later (MatchupLogic.lastOf). The game ends with its final, so Week 18 isn't played: no move is due for
     it. A span that ends earlier still wins; a team's own season and the playoffs' slate carry none; college football and every
     other league leave none out. The explorer stamps the same on a slate (core-runtime-48: runtime-sports.cjs `playoffsBy`).
   - *Verified:* check-nfl-playoff-weeks.js passes (Top 2's final Week 17; Top 4's semifinals 16 and final 17, from Week 1 and from
     Week 9; Top 6's quarterfinals 15, semifinals 16, final 17); unit tests (2,460: the engine's placement, the league lookup, the
     explorer's stamp); tsc; check-sports-explorer.js every case on the real routes (202 checks: head to head on the NFL's season
     and by categories, slates, calledoff and the rest), its one failure `calledoff`'s step 4 at 01:22 Eastern, the same on master:
     its day guard read the scenario's own days, where the server and the runtime read the calendar shifted to now. The guard and
     its rule now read the shifted days, so at that hour it says to run again later (it can't be proven between about midnight and
     the morning, Eastern); the rest of the case passes.
   - *Then BACKLOG 226 (the user's call of 2026-11-20, the recommendation): the default plays a final, and Week 18 never counts.*
     *Built:* the NFL's own season game (football.json `leagues.nfl.specs.season`: the sport's spec with `rank.playoffs: { teams: 2
     }`), so the default is head to head with a final between the top two in Week 17; college football's season is unchanged (its
     last regular weeks are conference championships). A gallery base that ranks another way (Season points, Guillotine, Weekly
     high score) takes none of it: the gallery's `over` now replaces a ranking of another kind whole (start-gallery/sports.js). A
     game scored by players' stats started to the season's end on the NFL's regular season ends at Week 17 (air-times.ts
     `fantasySeasonEnd`: start-spec.ts for the wizard's "The rest of the season", the sports route's default `to`); a maker who
     picks Week 18 keeps it. Pick'em and other games scored by answers still run to Week 18.
     A check's stand-in league ("football/zt-nfl-slate") now reads as its sport's own first league in `defaultsFor` and the
     gallery's `sportStandard`, as `sportOf` reads it, so the recorded NFL season plays the NFL's own games (it had football's
     generic season, with no final); the NBA's, MLB's, NHL's and WNBA's stand-ins get their leagues' own the same way.
     *Verified:* check-nfl-playoff-weeks.js whole (the default's final between the top two in Week 17, its span ending there;
     Season points to the season's end ending at 17, through Week 18 keeping 18; every Top N final by 17); unit tests (2,461: the
     NFL's and college's season ranks, the gallery's three; the frozen v1 NFL state reproduces with its lock and playoffs put
     back); sport-gallery-check.js --all-leagues (495 rows, 371 play, none off); every NFL fixture check on the new default
     (defenses, new players, same names, week in progress, live points, hourly, finals, injuries and byes, slate Pick'em);
     check-slate, check-finals, check-stats-game, check-sports-couch.js --api whole; tsc.
     *Noticed, not fixed:* the sheet's "The rest of the season" line still says "to the season's end" for a stats game on the NFL's
     slate, which now ends at Week 17 (4.0's words). College football's season locks at each player's game too since 2.1 (the
     two share football's season spec; the user decided the NFL's).
3. **Lineup slots for the NBA, MLB and NHL** (M; L9 part 1): `withLineupSlots` for every sport's defaults, with ESPN's positions
   and MLB's two-way players, and computer players setting legal lineups. Verify with the explorer's slot invariant on real-size
   pools, and unit tests per sport.
   **Done 2026-11-20 (branch sports-phase2).**
   - *Found first* (ESPN's real rosters, every team, 2026-11-20): the NBA's and WNBA's list each player as G, F or C only (never
     PG, SG, SF or PF); the NHL's as C, LW, RW, D or G; MLB's as SP, RP, C, 1B... and, in a second field (`positions`), every
     position each has played (Ohtani: P, DH, SP; a utility man up to ten; position players who pitched in a blowout RP and P).
     Neither the NBA's nor the NHL's has that field.
   - *Built:* every sport's standard games carry its defaults' slots (sports/index.ts `withLineupSlots`, and the gallery's own copy,
     start-gallery/sports.js), not a lineup of one slot taking everyone (golf, racing, MMA, tennis: `slotted`). A slot's `takes`
     are positions or position groups ("guards", "batters", "pitchers"), matched as before (the castaway's stamped position, or
     its group, state.statGroups). So a G fills PG, SG, G or Util; five centers don't fit (two C, two Util). Soccer's formation came
     with it (a keeper, 3 defenders, 2 midfielders, a forward, 4 outfield). MLB's eligibility, as data (baseball.json
     `slots.eligible`): a player fills each position his roster lists in his own group (a shortstop listed at 2B fills 2B, a
     reliever listed SP fills SP), and one listed SP from another group (a two-way player) the pitchers' too; never a catcher who
     pitched in a blowout. ESPN's list read (espn.ts readRoster `positions`), the rule applied as the fill writes each person
     (cast.ts, sports/index.ts `eligibleFor`) into season_cast.eligible (migration 0311), kept current by the daily roster
     refresh, stamped per read as state.castEligible (cast-props.ts), never saved, read by SlotLogic.fits and the lineup sheet's
     fits (game-view.ts). Computer players: their draft takes only players some slot takes (no offensive tackles) and keeps a team
     that can fill every slot (SlotLogic.draftKeeps); their lineup sits anyone Out, on injured reserve, an injured list or
     suspended (state.castInjuries), on a bye (ep.byeTeams) or with no game in a lineup locking at each game (ep.holdingGames),
     unless nobody else can fill the slot. Questionable, doubtful and day to day still play.
   - *Verified:* unit tests (tests/sports-slots.test.js: each sport's slots and that every value is one the sport knows; the
     NBA's G, F and C; the NHL's two goalies; MLB's eligibility and the two-way player on a lineup; ESPN's roster read; the cast
     fill writing it; the bots' draft and their sitting someone Out or on a bye); the whole suite (2,468); check-sports-bot-lineups.js
     (new: eight computer players draft the NFL's default season game from the recorded season's 2,425 people through the app's
     own reads; every team fills all nine slots, every Week 9 lineup fits, nobody on a bye starts where the bench could, a starter
     marked Out replaced); sport-gallery-check.js --all-leagues (495 rows, 371 play, none off); check-sports-explorer.js every case (202; its own games count other than the defaults, so no slots there); tsc;
     eslint has only its standing errors.
   - *Left:* MLB's two-way player scores everything wherever he starts (BACKLOG 227, the user's call: Yahoo's two players
     recommended). The NBA's PG and SG take any guard, and the sheet places the best guard in G (228). Bots draft a sport by taste
     within the slots: nothing rates an athlete before the game's own weeks (229). ESPN's eligibility is every position played, with
     no games-at-a-position threshold (Yahoo's 5 starts or 10 games); a utility man fits nearly everywhere. A team with no catcher
     left in the pool plays short. WNBA rosters have 25 centers for the NBA's two C slots a seat. The NBA, MLB and NHL lineup sheets
     weren't seen in a browser: the bench's and the explorer's worlds don't link their people to a season's cast, so slots are off
     there (as football's always were), and no stand-in world of those leagues with a season game exists; the lineup editor is 4.2's
     page 1 (DN 38), with the NFL's.
4. **An IR slot** (S–M, after 1.5): a player marked IR can sit there without costing a roster spot.
   **Done 2026-11-20 (branch sports-phase2).**
   - *Found first* (Yahoo's help pages, 2026-11-20: SLN6489, 6919, 6815, 6785, 6425; ESPN's support article on IR and waivers): every
     league's injured places sit outside the roster's count (the NFL's 2 IR beside its 15; the NBA's 3 IL beside 13; the NHL's 2 IR
     beside 16; MLB's 4 IL beside 23). Who may go there: football's IR, O, PUP and NFI; basketball's Out and Out for season; hockey's
     the NHL's own IR (its IR+, which takes DTD and O, isn't in the default); baseball's injured list. Someone there scores nothing,
     may stay all season, and comes back only into an open spot. Someone healthy left there: Yahoo blocks any add until they're
     activated; ESPN refuses claims until the IR is cleared (a claim already in still goes through).
   - *The calls made (the plan's "strict or lenient as data", Yahoo's and ESPN's rule the default):* the spec's `get.ir: { n, takes,
     healthy }`, `healthy` 'blocks' (the default) or 'stays'; each sport's IR as data in its defaults (`slots.ir`, with its source),
     carried onto each of its games with a draft whose lineup is the sport's (the season's: index.ts withLineupSlots and the
     gallery's copy); the codes ESPN's rosters give (espn.ts injuryOf): the NFL's IR, O, PUP; the NBA's O; the NHL's IR; MLB's IL7,
     IL10, IL15, IL60.
   - *Built:* the engine's IrLogic (state-logic.js). Moves on and off IR are their own log (`midSeason.ir`, each stamped as a
     mid-season move is: the episode, an own-pace seat's mark past it), so someone goes out of the lineup from the episode after the
     latest with results, never out of a week played (BACKLOG 57's rule), and by the move's own time in a lineup locking at each game
     (letGoBefore, letGoAt, carriesInto, teamFor; validateLineup refuses someone on IR). Never someone in a lineup that's locked, or
     whose game has started that day. A seat's open spots are its roster's size less everyone it holds who isn't on IR; a waiver claim's
     pair may drop nobody (`dropId: null`) and free agency an add with no drop goes into one, each as a swap counts. Bringing someone back
     needs room, a drop with it when full (a drop on its own is a logged move of its own: `via: 'ir'`, no add, no swap used). Someone
     healthy on IR blocks the seat's adds (pairProblem, freeAgencyMove, couldSwap) unless the game says 'stays'; "healthy" only on a read
     stamped with the rosters' injuries (cast-props.ts now stamps an empty list for a season nobody's hurt in). A dropped IR player leaves
     IR with the move and comes back with it on Undo (revert); a viewer behind sees no IR move past their mark (redact). The route:
     POST /api/leagues/[id]/ir { action: place | back | drop, castawayId, dropId?, playerId? } (a seat's own; whoever runs the game,
     anyone's). Computer players put anyone listed as the IR takes on it while there's a place, claim the best free agents into the
     spot, and bring someone healthy back at once (dropping whom they rate lowest, him if it's him). The spec's check and words
     (describe.js: "two IR spots beside its roster, for someone listed IR, O or PUP..."), settings `draftIr`.
   - *Verified:* unit tests (tests/sports-ir.test.js: each league's IR and its round trip through the settings; the check; placing,
     the week played keeping him, the lineup refused, the IR full; a locked lineup keeping its starter; the open spot in free agency and
     a claim; the healthy block, back with a drop, the drop alone, 'stays', a copy without injuries; redact and Undo; the bots); the whole
     suite (2,476); check-sports-ir.js (new: on the recorded NFL season, through the route signed in as Ann: a healthy receiver refused,
     one Out on IR and out of her lineup, a free agent into the spot once Week 9 had its results, healthy again blocking her adds, back
     refused with a full roster and then back with a drop; a computer player's starter on injured reserve on its IR at the next read;
     stored with its moves, never the injuries); check-sports-bot-lineups.js, check-sports-injuries-byes.js, sport-gallery-check.js
     --all-leagues (495 rows, 371 play, none off); tsc; eslint has only its standing errors. check-sports-explorer.js every case on the real routes (202, all pass; the NFL default now carrying IR).
   - *Left:* ESPN's rosters don't list NFI (Yahoo takes it), so it isn't in the NFL's list; Yahoo's commissioner options (more IR
     statuses, adding someone hurt straight onto IR) aren't built; the NHL's IR+ isn't. The explorer's worlds have nobody hurt, so its
     profile accepts `get.ir` on a sport's stats game as inert, and IR's moves are its gap (docs/GAMEPLAY-EXPLORER.md). Nothing is on a
     screen: the lineup sheet doesn't show IR or offer the moves, and the claim screens can't make an add with no drop (Designs needed
     43, 4.2's page 1); the route is all there is.
   - *Noticed, not fixed:* a sports season game starts with no waiver swaps at all (its spec has no waivers: windows only when
     whoever runs it opens one by hand; the recommendation is written only from a person's Waivers card, backstage-games.ts), so an open
     IR spot can't be filled until then: for 2.5, which gives the NFL its weekly waivers. The waivers history labels a drop on its own
     or an add into a spot "Swap" (waivers-model.ts txLabel): 4.0's words.
5. **Waivers for daily sports** (M; BACKLOG 219, yes): claims clear each morning for the NBA, NHL and MLB; the NFL's stay weekly.
   (2.4 found a sports season game has no waiver swaps unless someone opens a window by hand: this step gives it its schedule.)
6. **Own pace for a sports game** (M; BACKLOG 218: the user, 2026-11-19, "i want own pace, its an important option for casual
   leagues and solo games"). What's there: a sport's start sheet already offers own, live and strict (live recommended:
   start-game.ts `runs`); the season's guard goes by a person's mark when every seat they hold there is at its own pace; a caught-up
   own-pace seat never sees a week in progress past its mark (1.1 part 2); the explorer plays own-pace sports games and its
   campaigns check them.
   **The rule, tightened (the user, 2026-11-19): a sport's seat at its own pace is never more than one game behind.** "Someone
   watching the Patriots game won't still want to watch last week's game after this week's game is starting." When a game's next
   one starts (a slate's next week: its first game), the one before counts as watched: the seat's mark moves on by itself, as Keep
   up's automatic mark does for a follow (guard.ts, keep-up.ts advanceAuto), and its move for that game closes then at the latest
   (as live's late window closes when the next one airs). For the major league team sports. Two parts still open:
   - **Baseball** is different (the user: doubleheaders). Claude's recommendation, to confirm: by the day, so the games before
     count as watched once a game on a later day starts, and a doubleheader's first game isn't marked watched at the second's
     first pitch.
   - **Individual sports** (tennis, golf, racing, fights): no rule yet (the user doesn't follow them): plain own pace until someone
     who does plays one.
   What it means: nobody's ever a week behind more than one, so head to head, the playoffs and waivers never wait longer than the
   next game's start; and a sports game at own pace starts at the game to come or the one just played, never as a catch-up from
   Week 1 of a season well under way, or a finished season (both would be marked watched at once). Replaying a past season alone is
   a different thing (Watch it as if live's, or a mode of its own), raised with the user, not planned.
   What it needs: (a) an own-pace season game end to end on the NFL fixture (a check): a seat behind told nothing past its mark on
   any read, its week's lineup open until it has watched the week or the next week starts, its reveal moving it a week at a time and
   the next week's start moving it by itself, head to head and the playoffs at own pace, waivers waiting at their sync points (daily
   ones too, item 5); (b) a solo game at its own pace, alone or with computer players, from the game to come; (c) the pace a sheet recommends for a sport: Claude's call, reversible, own for a game played alone or only with
   computer players, live for a league of people, own one tap away; (d) the reveal an own-pace seat moves its mark with, the same
   one BACKLOG 216 gives anyone hiding sports scores (4.2's page 3 designs it); (e) live points (1.1 part 3) and the matchup push
   (217) never past an own-pace seat's mark (live points: done in 1.1 part 3, never sent to an own-pace game at all).
7. **A game through the playoffs** (M–L; the user, 2026-11-20). "When a normal 'season long' game ends (because playoffs start and
   some teams are out) that doesn't mean all games end. Someone doing a game just for a team could extend all the way to the Super
   Bowl, if they wanted it. The game maker has the ability to set the timing to be regular season and the playoffs, and the Super
   Bowl. (This goes generally for all sports with similar formats.)" The default stays the regular season (the fantasy season's
   end for the NFL: 226). Today a game can't: a league's slate is one stage (sports_slates.stage, regular or post), and a team's
   season takes only its regular-season games (find.ts `regularOf`). What it needs: (a) the timing choice on the sheet and in Game
   settings: the regular season (the default), or on through the playoffs to the final (the Super Bowl, the Finals, the World
   Series, the Stanley Cup Final); (b) a league's slate of both stages, its playoff rounds as episodes after the regular season's
   weeks (the playoffs' weeks listed as ESPN's calendar lists them); (c) a team's season that takes its playoff games as they're
   set, and ends when the team is out; (d) the engine's rules across the line: a drafted player whose team is out scores nothing
   and stays held, lineups and waivers go on, the fantasy playoffs placed at the game's own end (a span into the postseason isn't
   capped at Week 17: 2.2's stamp is the regular season's only), and a Pick'em or a pool asks each playoff game; (e) the words
   ("Regular season", "Through the Super Bowl") by sport, through 4.0. Sports with the same shape: the NFL, NBA, NHL, MLB, MLS and
   college football. Checks: the NFL fixture's recording has Weeks 1-9 only, so a playoffs recording (record-espn-slate.js, the
   2026 postseason in January) or a stand-in season with a postseason.

### Phase 3. The gate: a real season, replayed (L, about 2–3 sessions)

Record a whole NFL season (and a month of the NBA and of MLB) with record-espn-slate.js and the finals. Replay a 10–12 seat league
of computer players through the real routes, week by week: the draft, lineups, waivers, trades of team, injuries, a postponed
game, a correction, the playoffs. Compare every week with tools/gameplay-bench/campaign/sports-oracle.cjs, and run
compare-totals.js and blind replays for sports. Measure Neon and Vercel during the run and write the cost line into HOSTING.md,
with each game's state size: since 1.0 every game on a slate holds all of its people (about 2,500 for the NFL), a Pick'em too.

Done when there are zero disagreements. A disagreement is a bug, filed and fixed before the gate counts as passed. The replay
becomes a reusable check (its own `zt-` rows), run before any push that changes sports scoring.

### Phase 4. Design: step 10, "Sports in full"

Every page goes through the design process (DESIGN-PROCESS.md): Intent, then Perception-First Design, then Impeccable, once each;
one check and one batch of fixes; a captioned screenshot story at 390 on real renders, published as an Artifact; then a pause for
the user. "What every round carries" applies in full: data first and side by side (QB against QB), the whole game visible (both
lineups, the league's other matchups), a drill from everything with weekly graphs, the game's scoring only inside the game, and
judged on a real game. Sports keep their own components (the user, 2026-11-17).

**4.0 Words first (M, one Impeccable `clarify` pass, can ship any time).** About 25 places where a sport reads in a show's words.
Each reads `show.words`, the sport's own label, or a neutral phrase:
- How it plays gets the sport's context (game-rules.ts:16, 23, 40), so it says the sport's person word, "each game" or "each
  week", and the stat's name instead of its key ("2 a two-point conversion", not "2 a 2PT"). A field's and a card's stat keys too.
- The season grid's captions; Your moves' subtitle and notes ("Locked for Episode N", "Airtime does", "Out · Ep N"); the week
  sheet ("Yours to change until it airs"); your-move.ts, moves.ts, the strip and the game page's "Locks when it airs" lines; the
  matchup sheet's subtitle; the side-bet empty line; Tonight's StatsCard ("Up to Episode N"); LeagueView's line; the Games tab's
  rows; the Episodes tab's "All safe · N of N still in" and "{game}'s best this episode" for a stats game.
- Waivers' literal "Episode" and "Ep", the waiver pushes, and Settings' push descriptions, worded for both shows and sports.
- The server's refusals ("This episode has started", "active castaways"; state-logic.js:4526, 4892).
- The show bar's "S2026" and "Season 2026" for a season numbered by year.
- The lineup editor's names by `castName`, not `first()` (BACKLOG 88's rule never reached it).
- A name two players share shows its team on a face (step 1.3 kept them apart; castName reads "J. Jefferson" for both).
- GuardChip's "Spoiler protection is off" on a sport's pages: say how sports scores really work and where to change it.
- The late-window words ("Before you start watching") guarded off for a live-only sports game.

Done when no literal "Episode" is left in src/new outside `show.words`, generated NFL, golf and tennis games read with no show
words, and a screens words check exists (check-sports-words.js covers only the GPT's words today). This absorbs BACKLOG 75.

**4.1 What the round needs before it can run (about 2–3 sessions, technical).** Per the "open engine limits" rule, the designs
mustn't shrink around missing data.
1. **The game view carries each family's data:** categories and roto by category (DN 35), a field's standings and a card's bouts
   (DN 36–37), each game's lines in a slate week and who was in at each start (DN 38), called-off status (DN 39), and each
   athlete's opponent, kickoff, bye and injury (after Phase 1.5).
2. **Provisional points** for a week in progress: a slate week's games that are final so far count provisionally (the week stays
   unfinished), so Sunday's matchups move as each game ends. Then a live path: the existing poller's lines (src/lib/sports/live.ts,
   through the server's proxy) run through the game's table, under the spoiler rule (Hide scores, Watch it as if live). (Both
   done on the server: 1.1 parts 2 and 3. Left for the round: a small live read for the screens to poll, and Watch it as if live's
   sync, a later watch's clock.)
3. **Event sports reachable from the UI:** golf, racing, MMA and tennis in Add a show's search, and first run finds teams and
   leagues (BACKLOG 43).
4. **Fixtures to judge on, real where they exist:** an NBA recording, a real golf field (about 150) and a tennis draw, a 162-game
   MLB team season (density), a duplicate-name NFL slate, and a sports case in night-fixture.js, notes-fixture.js, story-waivers.js
   and story-person-sheet.js. Re-render every sports "before" frame on today's code: they all date from 2026-11-14/15, before steps
   3–9 and episode night.

**4.2 The round, one page at a time** (about 6 sessions, each with its story and a pause). Ordered by what a sports couch meets
every week:
1. **The lineup editor and the week at sports scale:** Your moves' Lineup, the week sheet, the matchup rows. An athlete's line and
   the start-or-sit facts (DN 34), a slate week laid out by game with locks at each game replacing the TEMP-UI (DN 38), the lock by
   week or day and a locked lineup you can still open (DN 31), and DN 41's last bullet. Situations: a real NFL pool with a move
   due, a real NFL game due and final, an NBA week in progress, a nine-slot lineup with a bye.
2. **The live game and a week in progress:** the matchup moving, the plays that moved someone, on the game page and Tonight, and
   Watch it as if live's sync. Judged on the Patriots v Lions recording. Needs 4.1's provisional and live points.
3. **A game's night, Tonight's Last time, the reveal and the pushes** (BACKLOG 100): what leads a sport's night instead of "Nobody
   went home", the reveal for anyone hiding sports scores and any seat at its own pace (BACKLOG 216 and 218: results show straight
   away for everyone else), the one push when a matchup is decided (217: "You beat Andrew 112–98", without the score for anyone
   hiding scores or behind at their own pace; nothing for each game), and how a called-off game reads (DN 39's other half).
4. **The family variants of the game page:** categories head to head and roto (DN 35), a field's leaderboard (DN 36), a card's
   matches (DN 37). Each family judged on its own real recording.
5. **Players and the athlete at long seasons:** a sortable stat table, Compare for athletes, the athlete chart at 82 and 162
   games, a stat's leaderboard, and an athlete's game as a box score (the drill tree's deepest levels).
6. **Waivers at 300 free agents** (DN 41): search, positions, recent lines and the bars from box scores.

**4.3 Impeccable only, inside approved designs:** the draft room's leftovers (preseason's empty "so far"; byes and injuries once
read; its position chips listing every roster position, G, C, LS, P, not only those a lineup takes), the team sheet's game sheet
after kickoff, the guide's 34 px wrap, BACKLOG 143's missing sports frames in Start a game.

### Phase 5. Live points on screen (about 2 sessions, after 4.2's page 2 is approved)

Build the approved live game and week in progress on the server-polled feed (never a phone asking ESPN: the user, 2026-11-15).
The cost is Vercel's transfer, about 20 MB and 780 edge requests a phone an NFL game, so the Hobby plan holds about 10–15 couches
watching live. Neon isn't touched by live polling. Done when a recorded live game replays through the real page with the matchup
moving, and HOSTING.md has the measured numbers.

### Phase 6. Later, not part of "a good spot"

FAAB blind bids and trades (L9 parts 3–4); draft rankings from last season and this one so far, then projections from a free
source with no key (BACKLOG 90; never ChatGPT for stats); live calls on a sport (A15, BACKLOG 179); your own moments for sports
(the redo plan's E8; the user wants them for sports, 2026-11-18); the gallery's 14 "Coming" sports bases (E9) and each team's
colour and logo (E10); more providers (BACKLOG 114); AFL, cricket and college hockey; ESPN's college scoreboards beyond its
default selection.

---

## The order, and how it fits the rest

1. **Done 2026-11-20: the merge** (the user: "yes, push it"; ba8f3a8e deployed in about 3½ minutes, production's build log
   applied 0308, 0309 and 0310, no server error in its logs, the hub, Survivor 51's Games tab and Backstage read clean). Rehearsed
   first: on branch merge-sports in rfl-merge (the branch's tip, a fast-forward of master) the unit suite (2,457)
   and `next build` pass, and the rehearsal on a fresh copy of production (Neon `rehearse-sports-2026-11-20`, compute
   ep-rapid-fire-b4msdllq) applied 0308, 0309 and 0310 after 0443 (migrate.js takes any file not yet applied), `[check] all
   good`, rulebooks backfilled, `[game-specs] check: PASS`; the rulebooks check's FAILs are production's own (its edited rulebooks
   against the built-ins; this merge touches no rulebook code). So no two production cast rows share provider ids (0308's new
   index built). The snapshot to roll back to is `pre-sports-2026-11-20` (auto-deletes after 7 days). While the deploy builds,
   the old code's cast inserts fail (its conflict target is 0308's old index): a few minutes, nobody adds a show then.
2. **Now:** Phase 2 (its calls answered 2026-11-19, own pace for sports as 2.6), and Phase 4.1. Phase 4.0 (the words) in any
   free session.
3. **Then:** Phase 3, the gate, and the design round's pages 1 and 3 (they need correct data, not live data).
4. **Then:** 4.1's live path, page 2, Phase 5, and pages 4 to 6.
5. **The pilot** (BACKLOG 212) once Phase 3 passes.

In [PLANS.md](PLANS.md), this plan takes the old "Sports in full" step's place and moves ahead of the stages round, because sports
run all year and the user asked for it now. It doesn't block Start a game's E3; the two lanes touch different code, except for the
lineup editor (dock.tsx), which E3 should leave alone while 4.2's page 1 is open.

**About 20–25 sessions in all:** Phase 0, 1 (done); Phase 1, 5–7; Phase 2, 2–3; Phase 3, 2–3; Phase 4, 9–10; Phase 5, 2.

---

## Decisions for the user

Answered by the user on 2026-11-19 (215 earlier that day, the rest at once: "i agree with all your recs except 218; i want own pace, its an important option for casual leagues and solo games"):
- **212, yes.** The target and the pilot: the NFL first, the NBA and NHL next, MLB by its Opening Day. The couch's first real sports
  game is one of January's NFL playoffs, once Phase 3 passes.
- **213, yes.** The NFL default locks at each player's game, not Thursday's kickoff (Phase 2.1).
- **214, yes.** Fantasy playoffs end by Week 17 (Phase 2.2).
- **215, yes and further.** Results hourly, toward live scores during games (step 1.1).
- **216, yes.** A sport keeps showing results straight away; anyone who turns on "Sports scores too" gets the reveal (4.2 page 3),
  and so does a seat at its own pace (218).
- **217, yes.** One push when your matchup is decided, without the score for anyone hiding sports scores (or behind at their own
  pace), nothing for each game (4.2 page 3).
- **218, own pace: yes, against the recommendation.** "An important option for casual leagues and solo games" (Phase 2.6).
- **219, yes.** Daily waivers for the NBA, NHL and MLB, weekly for the NFL (Phase 2.5).
- **175** still waits: step 10 as its own round, recommended as this plan's Phase 4, ahead of the stages round.
- **226, yes** (the user, 2026-11-20, "i agree with your rec"): the NFL's default season game plays a final between the top two in
  Week 17, and a stats game to the season's end stops at Week 17 (2.2's follow-on). With it, the user's general point: a game's
  timing is the maker's, the regular season by default or on through the playoffs to the final, for every sport of that shape
  (2.7).

## Backlog items this plan carries

43 (4.1), 75 (4.0), 78 and 101 (1.6), 100 (4.2 page 3), 108 (0 and 1.6), 145 (1.3), 175 (Phase 4), 184 (1.1's backstop), 220 and
221 (1.0), 222 (1.1), idea
209's lineup-by-game residual (1.6) and its daily-waivers question (219), and DN 31 and 34–41 (4.2). FAAB, trades and projections
(90) stay in Phase 6.
