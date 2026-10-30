# Plan: sports, live (the `sports` branch)

**Folded into master's `docs/PLAN-start-a-game-gpt.md` on 2026-10-28** (the user's ask), as track L in "Live sports in the
same engine": that's the plan now, and its order wins. The formats are built once, as the engine's pieces (A8, A9, A11, A15),
with L bringing each sport's data to them; the screens wait for its UI track (U0, U1); the steps here are renumbered there
(0 → U0, 1 → L1, 2 → L2, 4 → L3, 5 and 6 → L4, 7 → L5, 8 → L6; 3, the Players tab, → U). This file keeps the details.

Status: **L5 part 2b, college football, built 2026-10-30** (`src/lib/sports/college-football.ts`: the home crews' play text on
Football's vocabulary, what the NCAA counts otherwise; As built under track L in `docs/PLAN-start-a-game-gpt.md`), after **L5 part 2a,
college basketball and the WNBA**, and **L5 part 1, soccer, built 2026-10-28** (`src/lib/sports/soccer.ts`: every soccer league ESPN carries, read from its
match sheets, key events and commentary; As built under track L in `docs/PLAN-start-a-game-gpt.md`), after **L2, the live clock, built 2026-10-28** (`GameClock` and the phone's poller, `src/lib/sports/clock.ts` and `live.ts`;
fake-espn's replay; As built under track L in `docs/PLAN-start-a-game-gpt.md`), after **L1** (below). **Planned 2026-10-27; L1 part 1 built 2026-10-28** (the framework and baseball, in `src/lib/sports/`), **and part 2:
basketball, hockey and football** (the NFL; college football later, in L5): their As built is under track L in `docs/PLAN-start-a-game-gpt.md`. Everything here lands on the `sports` branch and is **released at once** (one merge
into master) once it's hammered into shape. Builds on `docs/PLAN-sports-data.md` (ESPN as the provider, the cache, linking a
season's episodes to games, the cast from rosters, box-score stats once final, spans), which is live on master.

## What the user asked for (2026-10-27)

- **Live.** Unlike shows, sports are watched as they happen: stats should come in live, or the app is static. Players list
  organised (team, position...). Light inspiration from the MLB app (scorebug, box score by team, lineup/bench/bullpen, leader
  boards with stat chips), Yahoo Fantasy (scoring types: head-to-head points, categories, roto, season points, elimination,
  best ball, survival, pick'em) and Yahoo Sports (play-by-play feed, stat leaders, standings).
- **Built in per sport is fine.** "It's hard to abstract rules for every sport, so I'm okay with a lot of stuff built into the
  app for each sport", but **good OOP**, so each sport is easy to test and change. (This replaces "universal, not curated" for
  sports only; shows stay universal.)
- **No new infrastructure stress.** Nothing that forces a paid plan (Neon, Vercel): do it efficiently.
- **Impeccable** for the UI, the app's own flavour (the Lower Third design), bold choices that make organising and fast workflow
  a pleasure.

Decisions (the user's answers):

| Question | Decision |
|---|---|
| Spoilers | **Live by default.** Watching later syncs like the watch along: the game's stats replay in step with your TV, minutes, hours or days later. |
| Syncing a later watch | **Both ways:** Start when you press play (pause, ±30s nudges), and "Tap the last play you saw" snaps your clock to that play. |
| Sports | **Everything ESPN offers**, as far as it goes (stretch). Boxing, esports and horse racing aren't in ESPN's API: **left out** (backlog). |
| Formats | Head-to-head matchups, best ball, pick'em each game, categories / roto, and casual ones: **Squares, Brackets, Pick a few, Live calls**. Weekly Lineup and Survival Pool stay. |
| Scoring | **Built in per sport** (a standard table, like Yahoo's), **editable** by the commissioner in Game settings. |
| Lineup locks | **Per sport, like Yahoo:** daily for NBA, NHL, MLB; weekly for NFL and college football; per event for golf, racing, fights. |

## What ESPN gives (checked 2026-10-27, live calls)

`site.api.espn.com` answers browsers directly (`Access-Control-Allow-Origin: *`) and caches 3-9 s (`Cache-Control: max-age`).

| Sport | Live data | Every play timestamped (`wallclock`) | Shape |
|---|---|---|---|
| NFL, college football | summary: box score (passing, rushing, receiving...), drives → plays | yes (180/180) | team, box + plays |
| MLB (college: thin) | summary: box score, plays, `situation` (outs, runners) | yes (311/311) | team, box + plays |
| NBA, WNBA, college basketball | summary: box score, plays | yes (482/482) | team, box + plays |
| NHL | summary: box score (forwards, defense, goalies), plays | yes (280/280) | team, box + plays |
| Soccer (Premier League, MLS, Champions League, World Cup) | summary: `rosters` with per-player stats, `keyEvents` (goals, cards, subs), commentary | yes (31/31 key events) | team, box + key events |
| Golf (PGA, LIV) | scoreboard: the leaderboard, scores by round (`linescores`) | no | field |
| F1, NASCAR, IndyCar | scoreboard: each session's finishing order | no | field, in parts |
| UFC / MMA | scoreboard: the card, each bout's two fighters and winner | no | bouts |
| Tennis (ATP, WTA) | scoreboard: matches in `groupings` (not read yet) | no | bouts, a draw |
| Boxing, esports, horse racing | not in the site API (400) | - | out |

So "live and replayable" is exact for the team sports (every play has its real time), round-by-round for golf, and
bout-by-bout or session-by-session for the rest.

### What the Start-a-game GPT needs from ESPN (found 2026-10-27, from that plan's mapping)

- **Games straight from ESPN's schedule.** Today a sport's games exist only as a TV listing's episodes (`season_events` needs a
  `season_episodes` row, migration 0148) and link only 8 days ahead (`link.ts` `AHEAD_MS`). So a regular-season series, or a
  game on local TV, has nothing to link to, and "the upcoming Red Sox–Yankees series" or "the 76ers home opener" can't be made.
  - ESPN's team schedule can be the source: `site.api.espn.com/apis/site/v2/sports/<sport>/<league>/teams/<team>/schedule`, the
    same shape for every sport. Checked: the 76ers' 2026-27 has 80 games, with dates, home or away, and status.
  - Proposed: a matchup (one game, a series, a team's next few games) becomes a season of its own, made from the schedule and
    shared by every couch that plays it (keyed by its ESPN event ids). Its cast is the teams' rosters, its episodes the games.
- **Finals stored.** Each game's final score and winner, for questions settled by the final. They're in `BoxScore.teams[]` and
  `Competitor`, but today only in `sports_cache`.
- **Odds.** The scoreboard lists a line for upcoming games in `competitions[0].odds[0]` (DraftKings via ESPN; checked for Oct 28:
  `details` "PHI -4.5", `overUnder` 237.5). It's the over/under's default line.
- **Total bases.** ESPN's per-player batting has no 2B, 3B or TB (its labels are `H-AB AB R H RBI HR BB K #P AVG OBP SLG`; only
  the team totals have them). The plays do, so `Baseball`'s reducer counts them: single 1, double 2, triple 3, home run 4.

## How live stays free

- **Phones ask ESPN themselves.** While a linked game is on and the screen is open (and visible), the phone polls ESPN's summary
  (every ~15 s; ESPN caches it anyway). Live points are worked out **on the phone**, from the box score and plays, the game's
  scoring and the lineups the page already has. **Nothing reaches our server or Neon while a game is live**: no new wakers, no
  new writes, no Vercel invocations. Watchers cost ESPN, not us.
- **Final is saved once**, as today (step 4: the box score once final, `game_lines`). The live view is provisional; the saved
  final box score is the truth (standings, trophies, results for people who never watched live).
- **A later watch** fetches the finished game's summary once (every play, timestamped) and replays it against your clock, all on
  the phone.
- **Fallback** if ESPN ever stops answering browsers: one Vercel route that forwards the summary, cached at the CDN for 15 s
  (`s-maxage`), so everyone watching a game shares one call. Still nothing in Neon.
- docs/HOSTING.md gets the numbers when step 2 lands. **Landed (L2, 2026-10-28):** `src/lib/sports/live.ts` is the poller
  (15 s ±10% while on and visible, waiting for the start, doubling to 5 minutes while ESPN fails, stopping at the final). ESPN
  answers a browser's request with `Access-Control-Allow-Origin: *` and `max-age` 1-7 s, no ETag; its CDN refuses a headless
  browser's user agent (a 403), so the real-browser check is a person's (the one-liner in
  `scripts/dev-test/check-espn-browser.js`). A phone's data: an estimated 15-30 MB a game at 15 s (the whole summary each
  time, 45-80 KB over the wire by the end).

## The design: classes

Pure code in `src/lib/sports/` (shared by the server, the phone and the tests), separate from the provider's I/O
(`src/lib/server/sports/`, which stays: linking, rosters, final box scores).

- **`Sport`** (abstract): what a sport is. Its id and leagues; **positions** and how they group (batters / pitchers; forwards /
  defense / goalies), **roster slots** per format; **stat groups and categories** (each stat's key, label, short label, higher
  or lower is better); its **default scoring** (stat → points); its word for a period (inning, quarter, period, half, round, lap);
  its **lineup lock** cadence; and its **readers**: ESPN's box score and plays into the shapes below. One subclass per sport
  (`Baseball`, `Basketball`, `Football`, `Hockey`, `Soccer`, `Golf`, `Racing`, `MMA`, `Tennis`), grouped by shape:
  - `TeamSport`: a box score and timestamped plays (football, baseball, basketball, hockey, soccer);
  - `FieldSport`: a field of competitors and a leaderboard (golf, racing);
  - `BoutSport`: one-on-one bouts, a card or a draw (MMA, tennis).
- **`Play`**: one moment with its `wallclock`, period and clock, text, the people in it, and its **stat deltas** (a single: +1 H
  for the batter, +1 H allowed for the pitcher). `Sport.reduce(plays)` gives the box score at any moment, so **the live view and a
  later watch are one code path**: `stateAt(t)`, the plays up to time `t`.
- **`GameClock`**: where you are in a game. `live` (t = now), `synced` (started at, paused, nudged: the watch along's clock) or
  `snapped` (the last play you tapped). Kept per person on their phone (and in `show_follows` only when they choose to share it).
- **`Scoring`**: reads the game spec's table (the sport's default spec, plus the game's edits); `points(lines)` for a player,
  `breakdown()` for "why +7". No scoring value lives in code (see Rules as data).
- **Formats** as classes over the same pieces: `HeadToHead`, `BestBall`, `PickEm`, `Categories` / `Roto`, `Squares`, `Bracket`,
  `PickAFew`, `LiveCalls`, and today's Weekly Lineup and Survival Pool on sports.
- **Tests**: recorded ESPN summaries per sport in `tests/fixtures/espn/` (one finished game each, trimmed), unit tests per sport
  (the reader, the reducer: the reduced box score at the end equals ESPN's own box score), and `scripts/dev-test/fake-espn.js`
  extended to **replay a recorded game in real time** (or 60x), so a live screen can be checked without a game on.

## Rules as data (lines up with the "Start a game GPT" direction)

The user's standing requirement (2026-10-27, from the Start-a-game-GPT notes another session is planning): **no built-in game
rules**; the engine runs on structure, which is what lets "type the game you want, our bot fills in the structure, a wizard asks
the rest" work. That and "built in per sport is fine" fit together like this:

- **Built in (code):** a sport's **vocabulary and readers**: its stat keys, positions and groups, periods, how ESPN's box score
  and plays read into `Play`s and lines. That's knowledge of the sport, not rules of a game. It is what a game's data refers to.
- **Data (a game spec):** everything a game *is*: its format and that format's parameters, the span (a series, one game: built,
  `settings.startEpisode` / `endEpisode`), roster size and slots (by the sport's position groups), lineup locks, and the scoring
  table (stat key → points). A sport's defaults (Yahoo-like standard scoring, slots, locks) are **default specs, stored as
  data**, never `if (sport === ...)` in a format. Formats read specs only.
- So the user's examples become specs the bot can write: "draft 3 players each for the Red Sox–Yankees series, 5 per home run,
  1 per total base" = format draft, span the series, roster 3, scoring `{ HR: 5, TB: 1 }`; "for the 76ers home opener, predict
  the winner, top scorer and over/under total points" = format predictions, span one game, three questions over the sport's
  stats. Both are test fixtures for the spec's schema (step 1).
- **The spec's schema is `docs/PLAN-start-a-game-gpt.md`'s** (on master: its step A1, read by the engine from its A2). This
  branch doesn't define its own: it merges master in once A2 is there, and builds the parts the schema marks as this branch's:
  - `score.by: "stats"` (points per stat key);
  - `count.best` (best ball);
  - `rank` by matchups, categories or roto;
  - `get.by: "squares"`;
  - `closes` daily or weekly;
  - the sports settles for a question: `final` (winner, total, margin) and `stat` (most, least, value).

  Pick'em each game, brackets and live calls are questions (the engine's `ask`, its step A4) using those settles. Each sport's
  default spec is a preset, stored as data. (Lined up 2026-10-27, from the GPT plan's mapping of the code.)

## The screens (designed first, with impeccable, in the site mock)

Phone first (390), the show space's flavour. To design in step 0, not decided here:
- **Scorebug**: the score, inning or quarter, outs or clock, on the show space during a game; your sync state on it.
- **Live box score** by team, your couch's players lit with their points ticking; the period-by-period line.
- **The couch's play feed**: only the plays that move someone's score ("Simpson doubles: +2 riley").
- **Players, organised**: by team, then lineup / bench / bullpen (or the sport's groups); position chips to filter, stat chips
  to sort (a leader board); a player sheet with their game log and season line.
- **Matchup**: you against them, live; standings over the span.
- **Sync**: Start / pause / nudge, and Tap the last play you saw.
- The formats' own: a squares grid, a bracket, a pick-a-few card, live calls.

## Steps (each its own session, Opus at xhigh)

This branch is the **Sports lane** in `docs/PLAN-start-a-game-gpt.md`'s lanes: its own database (`rfl_sports`), port 3004 and
migration numbers 0300–0399. The setup is `docs/PARALLEL-SESSIONS.md`, on master. Steps 0 and 2 can run any time; steps 1 and
4–6 wait until the GPT plan's A2 (the engine reading specs) is on master and merged in here.

0. **Design** (impeccable `shape`, then the mock): the live game, the players list, the sync, one format. The user confirms
   before building. Any time: nothing in it waits on the engine.
1. **The framework**: `Sport` and the big four (`Football`, `Baseball`, `Basketball`, `Hockey`), their ESPN readers and reducers,
   the sports parts of the **game spec** (the schema is the GPT plan's A1; merge master in once its A2 lands) and each sport's
   default spec (data), fixtures and tests (the user's two GPT examples among them). Also games straight from ESPN's schedule,
   and finals and odds stored (the section above). No UI. Decide here how a sport's Make it a game starts from its default spec
   instead of asking ChatGPT.
2. **Live**: the phone's poller and `GameClock` (live, synced, snapped), the scorebug and the live box score on the show space;
   fake-espn's replay; HOSTING.md. Any time: it's display only, and points come in step 4.
3. **Players, organised**: the Players tab rebuilt on the sport's groups, chips and the player sheet.
4. **Scoring**: built-in tables, Game settings to edit them, live points, the couch's play feed. Scored from box scores and plays
   through the spec (`score.by: "stats"`), replacing today's ChatGPT research of sports moments.
5. **Formats**: head-to-head, best ball, pick'em each game, categories / roto; lineup locks per sport. Pick'em is the engine's
   `ask` with the sports settles.
6. **Casual**: squares, brackets, pick a few, live calls. Brackets and live calls are the engine's `ask` too.
7. **More of ESPN**: soccer; college and WNBA; golf, racing, MMA, tennis (the field and bout shapes).
8. **Release**: merge `sports` into master at once (migrations checked against a production backup first). Then the GPT plan's
   G3, on master, teaches the GPT these formats.

## Open questions (ask when the step comes)

- Head-to-head's schedule over a span (each game? each week?) and playoffs.
- Whether a sport's moves (waivers, trades) follow Weekly Lineup's waivers or need their own rhythm for daily sports.
- What a live call is worth, and how fast they open and close during a game.
- Tennis's draw and how a bracket reads ESPN's.

## Noticed, not fixed

- Boxing, esports and horse racing: no ESPN data (backlog, another free source later).
- Golf, racing, MMA and tennis have no per-play timestamps: a later watch can only be synced by round, session or bout.
