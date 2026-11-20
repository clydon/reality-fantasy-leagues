# Plan: sports in good shape, technically and in design

> **Status (2026-11-19): Active, Phase 0 and Phase 1 done but 1.1's live parts** (branch sports-phase0, not merged; migrations
> 0308 to 0310 to rehearse). Written from two audits that day: the engine, data and operations, and every screen a sports fan touches.
> Phase 0 confirmed all four inferences, each with a check, and found two bigger gaps; step 1.0 closed both (BACKLOG 220 and 221),
> 1.3 made team defenses people and kept same-named players apart (BACKLOG 145), 1.2 stopped silent zeros and takes corrections,
> 1.4 keeps rosters current (signings, trades), 1.5 reads injuries and byes, 1.6 made the small fixes (BACKLOG 108, 78), and
> 1.1's part 1 puts finals in the standings within the hour. Next: 1.1's parts 2 and 3 toward live scores, Phase 2 (the user's
> calls 213, 214, 219) and 4.1.
> The decisions it needs are BACKLOG 175 and 212–219 ("Waiting on you").

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
   - **Part 2, a week in progress counts as it goes.** A slate's week counts only once every game is final (score.ts stampStats,
     `done`): count each final game provisionally (its lines in, the week marked unfinished: no matchup won or lost until its
     last game), so Sunday's matchups move as each game ends. Engine and server; the game view says the week is in progress
     (4.1.2's first half). Check: the fixture's week with some games final, the matchups moving per game.
   - **Part 3, live points during games.** The server's live poller (src/lib/server/sports/live-proxy.ts, already polling ESPN
     for phones at most once a game every 15 s) gives each game's lines so far; run them through the game's table under the
     spoiler rule (Hide scores, Watch it as if live), so a matchup moves play by play (4.1.2's second half, Phase 5's feed
     brought forward). Measure Vercel's transfer (Phase 5's estimate: about 20 MB and 780 edge requests a phone an NFL game).
   - **Part 4, the screens:** the design round's page 2 (the live game and a week in progress), through the design process.
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

### Phase 2. The rules a season game needs (about 2–3 sessions; needs the user's calls)

1. **Locks at each player's game for the NFL** (S; BACKLOG 213): football's season default becomes `closes: 'game'`. A lock
   change reruns every check that asserts a lock (HANDOFF's convention), check-lock-in.js and the explorer's lock invariants.
2. **Fantasy playoffs end by Week 17** (S; BACKLOG 214), so nobody's title rides on Week 18's rested starters. Phase 0: the
   default has none, and any final lands in Week 18. Done when check-nfl-playoff-weeks.js passes.
3. **Lineup slots for the NBA, MLB and NHL** (M; L9 part 1): `withLineupSlots` for every sport's defaults, with ESPN's positions
   and MLB's two-way players, and computer players setting legal lineups. Verify with the explorer's slot invariant on real-size
   pools, and unit tests per sport.
4. **An IR slot** (S–M, after 1.5): a player marked IR can sit there without costing a roster spot.
5. **Waivers for daily sports** (M; BACKLOG 219): claims that clear daily for the NBA, NHL and MLB if the user says so.

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
   through the server's proxy) run through the game's table, under the spoiler rule (Hide scores, Watch it as if live).
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
   went home", whether a sport has a reveal (BACKLOG 216), what's pushed when a matchup is decided (217), and how a called-off game
   reads (DN 39's other half).
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

1. **Now, beside the Survivor 51 work:** 1.1's parts 2 and 3 toward live scores (part 1 done), then Phase 2 once the user's calls
   are in. Phase 4.0 (the words) in any free session.
2. **Then:** Phase 2 (once the user has made the calls), and Phase 4.1.
3. **Then:** Phase 3, the gate, and the design round's pages 1 and 3 (they need correct data, not live data).
4. **Then:** 4.1's live path, page 2, Phase 5, and pages 4 to 6.
5. **The pilot** (BACKLOG 212) once Phase 3 passes.

In [PLANS.md](PLANS.md), this plan takes the old "Sports in full" step's place and moves ahead of the stages round, because sports
run all year and the user asked for it now. It doesn't block Start a game's E3; the two lanes touch different code, except for the
lineup editor (dock.tsx), which E3 should leave alone while 4.2's page 1 is open.

**About 20–25 sessions in all:** Phase 0, 1 (done); Phase 1, 5–7; Phase 2, 2–3; Phase 3, 2–3; Phase 4, 9–10; Phase 5, 2.

---

## Decisions for the user

Each is in BACKLOG's "Waiting on you" with Claude's recommendation:
- **212.** The target and the pilot: the NFL first, the NBA and NHL next, MLB by its Opening Day. The couch's first real sports game
  is one of January's NFL playoffs, once Phase 3 passes.
- **213.** The NFL default locks at each player's game, not Thursday's kickoff.
- **214.** Fantasy playoffs end by Week 17.
- **215.** Sports results refresh hourly from the hourly GitHub job.
- **216.** Does a sport get a reveal by default?
- **217.** What's pushed when a sports game or matchup ends?
- **218.** Can a sports season game run at your own pace?
- **219.** A daily sport's waivers: daily or weekly?
- **175.** Step 10 as its own round. The recommendation is now "yes, as this plan's Phase 4, ahead of the stages round".

## Backlog items this plan carries

43 (4.1), 75 (4.0), 78 and 101 (1.6), 100 (4.2 page 3), 108 (0 and 1.6), 145 (1.3), 175 (Phase 4), 184 (1.1's backstop), 220 and
221 (1.0), 222 (1.1), idea
209's lineup-by-game residual (1.6) and its daily-waivers question (219), and DN 31 and 34–41 (4.2). FAAB, trades and projections
(90) stay in Phase 6.
