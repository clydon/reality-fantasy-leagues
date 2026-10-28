# Plan: sports, live (the `sports` branch)

Status: **planned 2026-10-27**, nothing built. Everything here lands on the `sports` branch and is **released at once** (one merge
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
- docs/HOSTING.md gets the numbers when step 2 lands.

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
- The spec's schema is the sports part of the Start-a-game data structure: design it with that plan, not apart from it.

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

0. **Design** (impeccable `shape`, then the mock): the live game, the players list, the sync, one format. The user confirms
   before building.
1. **The framework**: `Sport` and the big four (`Football`, `Baseball`, `Basketball`, `Hockey`), their ESPN readers and reducers,
   the **game spec schema** and each sport's default spec (data), fixtures and tests (the user's two GPT examples among them).
   No UI. Decide here how a sport's Make it a game starts from its default spec instead of asking ChatGPT.
2. **Live**: the phone's poller and `GameClock` (live, synced, snapped), the scorebug and the live box score on the show space;
   fake-espn's replay; HOSTING.md.
3. **Players, organised**: the Players tab rebuilt on the sport's groups, chips and the player sheet.
4. **Scoring**: built-in tables, Game settings to edit them, live points, the couch's play feed.
5. **Formats**: head-to-head, best ball, pick'em each game, categories / roto; lineup locks per sport.
6. **Casual**: squares, brackets, pick a few, live calls.
7. **More of ESPN**: soccer; college and WNBA; golf, racing, MMA, tennis (the field and bout shapes).
8. **Release**: merge `sports` into master at once (migrations checked against a production backup first).

## Open questions (ask when the step comes)

- Head-to-head's schedule over a span (each game? each week?) and playoffs.
- Whether a sport's moves (waivers, trades) follow Weekly Lineup's waivers or need their own rhythm for daily sports.
- What a live call is worth, and how fast they open and close during a game.
- Tennis's draw and how a bracket reads ESPN's.

## Noticed, not fixed

- Boxing, esports and horse racing: no ESPN data (backlog, another free source later).
- Golf, racing, MMA and tennis have no per-play timestamps: a later watch can only be synced by round, session or bout.
