# Plan: sports in good shape, technically and in design

> **Status (2026-11-19): Active.** Written from two audits that day: the engine, data and operations, and every screen a sports
> fan touches. Nothing here is built yet. The decisions it needs are BACKLOG 175 and 212–219 ("Waiting on you").

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
3. **No team defenses.** The NFL default has a DEF slot and box scores score defenses (`def:<team>`, football.ts:182), but the
   cast fill never adds them (nothing in src/lib/server/sports/ mentions one), so the slot likely has nobody to draft.
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

### Phase 0. Confirm four inferences (S, one session)

On the local database, with a recorded NFL slate:
- (a) after adding the slate, whether any D/ST people exist (`season_cast` with position DEF);
- (b) whether a player added to the roster after a slate game starts can reach a running league;
- (c) whether `pickem` started from `/api/sports/start` on a slate grades a week (BACKLOG 108);
- (d) the NFL slate's head-to-head playoff weeks.

Done when each is confirmed or struck, with a dev-test check left in scripts/dev-test/ (built for reuse: `zt-` rows, an up and a
down).

### Phase 1. Data you can trust (about 4–6 sessions)

1. **Results within the hour (S–M).** A `db/sports-refresh.js` (`refreshSportsEvents` and `saveFinals`) in the existing hourly
   GitHub Actions job (no new Neon wake-up; Actions are free on the public repo), asked more often only when a linked game ended
   in the last few hours. The daily run stays as the fallback, and BACKLOG 184's Vercel daily cron backs up both. Done when a game
   is in the standings within an hour of ESPN's final. Verify with check-slate.js on fake-espn and a fake clock. HOSTING.md gets
   the calls and their cost. *Needs BACKLOG 215.*
2. **Never zero a game silently; take corrections (S–M).** A read error or an empty answer is retried, not stored as `{}`. A game
   still empty after its retries is flagged on the desk. Each final is read again at +24 hours and before the next week's first
   lock (NFL corrections land midweek), and rewritten with a new `lines_at` when it differs. The stamp fingerprint includes
   `lines_at`, so the tables follow. Done when a recorded final plus an edited copy of it updates the table. Verify with
   sports-final.test.js extended.
3. **People by ESPN id, not name (M; BACKLOG 145).** A sport's cast is unique by (season, provider id). League castaways link by id
   in score.ts `peopleOf`, air-times.ts `stampGameLocks`, the player log and cast.ts `saveCast`. The UI's name-keyed reads go too
   (faces.ts, `usePlayerLog`, AthleteSheet, the rows), and a repeated name shows its team. Add team defenses as people
   (`def:<team>`, position DEF) if Phase 0 confirms they're missing. Done when an NFL slate fixture keeps both Josh Allens and all
   32 defenses, each drafted and scored.
4. **Rosters stay current (S–M).** A daily roster refresh for slate seasons: a trade updates the player's team (and his lock
   follows the new team's game), a signing is added, and new people reach running leagues' pools. Done with a fixture trade and a
   fixture signing.
5. **Injuries and byes (M; L9 part 2).** Read ESPN's roster injury status in the daily refresh (Q, D, O, IR) and mark byes (no
   game in the week). They're facts the lineup editor and the draft room show (Phase 4.2). Verify with recorded roster fixtures
   carrying injuries, and a bye-week slate.
6. **The small fixes (S each).** BACKLOG 108 (give the rail's pickem `each: 'game'`, or refuse single-game questions and squares on
   a slate in `specProblems`); `lineupAt` applying `letGoBefore` for locks at each game (idea 209's residual); BACKLOG 101, 78 and
   check-sports-explorer.js's called-off part 4. Verify with unit tests, check-slate.js and check-sports-explorer.js.

### Phase 2. The rules a season game needs (about 2–3 sessions; needs the user's calls)

1. **Locks at each player's game for the NFL** (S; BACKLOG 213): football's season default becomes `closes: 'game'`. A lock
   change reruns every check that asserts a lock (HANDOFF's convention), check-lock-in.js and the explorer's lock invariants.
2. **Fantasy playoffs end by Week 17** (S; BACKLOG 214), so nobody's title rides on Week 18's rested starters.
3. **Lineup slots for the NBA, MLB and NHL** (M; L9 part 1): `withLineupSlots` for every sport's defaults, with ESPN's positions
   and MLB's two-way players, and computer players setting legal lineups. Verify with the explorer's slot invariant on real-size
   pools, and unit tests per sport.
4. **An IR slot** (S–M, after 1.5): a player marked IR can sit there without costing a roster spot.
5. **Waivers for daily sports** (M; BACKLOG 219): claims that clear daily for the NBA, NHL and MLB if the user says so.

### Phase 3. The gate: a real season, replayed (L, about 2–3 sessions)

Record a whole NFL season (and a month of the NBA and of MLB) with record-espn-slate.js and the finals. Replay a 10–12 seat league
of computer players through the real routes, week by week: the draft, lineups, waivers, trades of team, injuries, a postponed
game, a correction, the playoffs. Compare every week with tools/gameplay-bench/campaign/sports-oracle.cjs, and run
compare-totals.js and blind replays for sports. Measure Neon and Vercel during the run and write the cost line into HOSTING.md.

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
read), the team sheet's game sheet after kickoff, the guide's 34 px wrap, BACKLOG 143's missing sports frames in Start a game.

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

1. **Now, beside the Survivor 51 work:** Phase 0, then Phase 1, as a sports lane. Phase 4.0 (the words) in any free session.
2. **Then:** Phase 2 (once the user has made the calls), and Phase 4.1.
3. **Then:** Phase 3, the gate, and the design round's pages 1 and 3 (they need correct data, not live data).
4. **Then:** 4.1's live path, page 2, Phase 5, and pages 4 to 6.
5. **The pilot** (BACKLOG 212) once Phase 3 passes.

In [PLANS.md](PLANS.md), this plan takes the old "Sports in full" step's place and moves ahead of the stages round, because sports
run all year and the user asked for it now. It doesn't block Start a game's E3; the two lanes touch different code, except for the
lineup editor (dock.tsx), which E3 should leave alone while 4.2's page 1 is open.

**About 20–25 sessions in all:** Phase 0, 1; Phase 1, 4–6; Phase 2, 2–3; Phase 3, 2–3; Phase 4, 9–10; Phase 5, 2.

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

43 (4.1), 75 (4.0), 78 and 101 (1.6), 100 (4.2 page 3), 108 (0 and 1.6), 145 (1.3), 175 (Phase 4), 184 (1.1's backstop), idea
209's lineup-by-game residual (1.6) and its daily-waivers question (219), and DN 31 and 34–41 (4.2). FAAB, trades and projections
(90) stay in Phase 6.
