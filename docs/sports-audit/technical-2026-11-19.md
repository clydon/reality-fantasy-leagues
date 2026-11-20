> **The technical audit behind [PLAN-sports-ready.md](../PLAN-sports-ready.md), 2026-11-19.** Read-only, against origin/master 7cfb1bb5. File and line references are as of that commit. Kept as the plan's evidence; the plan is what to act on.

# Sports: technical audit (engine, data, operations, tests)

Audited 2026-11-19 on branch `docs-cleanup` (= origin/master 7cfb1bb5 plus docs, dc462ad2). Read-only: no dev server, build,
migration, browser check or database write. Ran the sports unit tests and one offline catalog check (no DB, no network).
"Built" means the code and its tests exist; it does not mean a real couch has played it. **No real couch has played a sports game
in production** (HANDOFF.md "Who uses it": one couch, Survivor 51's three games), and no golden, blind or tape replay covers a
sport (`scripts/dev-test/golden.js`, `tapes.js` and `compare-totals.js` have no sports mentions; `blind.js`'s two hits are
unrelated SQL).

Items marked **(verify)** are inferences from code I could not confirm without running the app; each has a one-step check in §7.

---

## 1. What exists

### 1.1 Sports and leagues

`src/lib/sports/index.ts:57` registers every sport class; `sportOf(league)` maps an ESPN path to one.

| Family | Leagues the app reads | Class | Notes |
|---|---|---|---|
| Football | `football/nfl`, `football/college-football` | `Football`, `CollegeFootball` | Plays are text, parsed by regex (`football.ts:803`, `:1094`) |
| Basketball | `basketball/nba`, `basketball/wnba`, `basketball/mens-college-basketball`, `basketball/womens-college-basketball` | `Basketball`, `CollegeBasketball` (halves vs quarters) | |
| Baseball | `baseball/mlb`, `baseball/college-baseball` | `Baseball`, `CollegeBaseball` | |
| Hockey | `hockey/nhl` | `Hockey` | College hockey isn't readable from ESPN (GPT plan L5) |
| Soccer | every ESPN soccer league (`soccer/*`) | `Soccer` | FPL scoring by position |
| Golf | `golf/pga`, `lpga`, `eur`, `liv`, `champions-tour`, `ntw`, Olympics | `Golf` (FieldSport) | Not TGL's match play |
| Racing | `racing/f1`, `nascar-premier`, `nascar-secondary`, `nascar-truck`, `irl` | `Racing` (FieldSport) | |
| MMA | every ESPN promotion (`mma/ufc`, `pfl`, `lfa`…) | `MMA` (BoutSport) | Only the UFC has statistics and timed plays |
| Tennis | `tennis/atp`, `tennis/wta` | `Tennis` (BoutSport) | Draws over days |

Not supported: college hockey, boxing, cricket, AFL as a scored sport (AFL links and fills rosters from box scores via the generic
provider, but `sportOf` has no AFL class, so no stats scoring), esports, horse racing. BACKLOG 114 (more providers) is idea-level.

### 1.2 Data read per sport (all from ESPN; `src/lib/server/sports/espn.ts`)

| Data | How | Sports |
|---|---|---|
| Schedule / day scoreboard | `eventsOn` (day), team `schedule`, league calendar + month scoreboards (slates) | all |
| Rosters (players only, position, headshot, ESPN id) | `readRoster` (`espn.ts:313`), one call a team, cached a day | team sports; a field's entry list for golf/racing; AFL from box scores |
| Box score at the final | `readBoxScore` (`espn.ts:334`) and each sport's reducer into stat keys (`final.ts`, `sports_events.lines`) | all team sports; fields/cards via their feed calls (`eventFinal`, `espn.ts:426`) |
| "Coming in" season line | `readSeasonStats` (`espn.ts:382`), one call a player, 60 a run | team sports (regular season only, main category only) |
| Athlete history (3 seasons) | `/api/seasons/[id]/athlete-history` (HOSTING.md) | team sports |
| Odds (over/under line) | scoreboard / summary `pickcenter` | team sports |
| Live | `/api/sports/live/{site|core|web}/…` proxy (`live-proxy.ts`), polled by `live.ts` / `live-event.ts` | all; **no screen uses it** (PLANS.md step 6, HANDOFF) |
| Injuries / status | **not read anywhere** (grep for injur/IR/questionable in `src/lib/server/sports`, `src/lib/sports` finds only play-text noise filters) | none |
| Transactions / trades | **not read** | none |
| Projections / rankings | **not read** (BACKLOG 90) | none |

### 1.3 Game types (Start a game's catalog, `src/lib/game/start-gallery/sports.json`)

I ran `node scripts/dev-test/sport-gallery-check.js` (offline, pure: our check against each family's page context with real-size
pools). Result: **181 rows: 138 play, 38 coming, 5 need a page fact (keepers need last season's game), 0 off; ALL PASS.**

| Family (core league) | Play | Coming | Coming (examples, from `coming`/`gap`) |
|---|---|---|---|
| Football (NFL) | 26 | 8 | Dynasty (no rookie flag), Salary cap (no prices), Against the spread (no spread kept), Survivor pool (one team a week), Score predictor, First scorer (no play order), Live calls (A15), college bracket |
| Basketball (NBA) | 24 | 5 | Dynasty, Salary cap, Score predictor, First scorer, Live calls (+ March Madness bracket per league) |
| Baseball (MLB) | 25 | 5 | Dynasty, Salary cap, Beat the Streak (pick scored by a stat), Score predictor, Live calls |
| Hockey (NHL) | 24 | 6 | as basketball plus one |
| Soccer (EPL) | 21 | 8 | Last man standing, Knockout bracket (cup rounds), Salary cap, Score predictor, First goalscorer, Live calls |
| Golf (PGA) | 6 | 2 | One and done, Tiered pool |
| Racing (F1) | 5 | 2 | One and done, Budget fantasy (pools fitted: 8 seats x 7 > 22 drivers, so 2 each) |
| MMA (UFC) | 3 | 2 | Fight card pick'em (a pick per bout), Method of victory |
| Tennis (ATP) | 4 | 0 | |

"Play" means the spec passes our check on a stand-in page; it is not evidence of a real season played.

### 1.4 Scoring kinds, and the capability table

Scoring kinds built in the engine (GPT plan track L, "As built" sections; explorer slices in docs/GAMEPLAY-EXPLORER.md §1041-1696):
points per stat (`score.by: 'stats'`, `sequence/stats.js`), by position (soccer), by place (golf/racing), by a bout's format
(tennis), categories H2H and roto (`MatchupLogic`, `categoryParts`), head to head with playoffs (A11; `MatchupLogic.playoffsFrom`),
best ball, slates (several games an episode, L8, migration 0304), locks `start` / `daily` / `weekly` / `game` (`src/lib/sports/locks.ts`,
`air-times.ts stampSportLocks`), pick'em / pick a few / props / over-under (sports settles, L1 part 4b), squares, brackets (tennis
draws, a league's playoffs slate), postponed / cancelled / suspended / moved games (L3 part 3b, migration 0306).

Legend: **B** built, **P** partial, **M** missing. "Real" = played on real data by a couch (none have).

| Capability | NFL | NBA | MLB | NHL | Soccer | College FB/BB | Golf | Racing | MMA | Tennis |
|---|---|---|---|---|---|---|---|---|---|---|
| Schedule + linking | B | B | B | B | B | P (scoreboards are ESPN's default selection: bigger games only, PLAN-sports-data Noticed) | B | B | B | B |
| Rosters / cast | P (no D/ST people, verify; same-name drop) | P (same names) | P (two-way's other line) | P | B | P | B (field) | B (field) | B | B |
| Box score → stat keys | B (2 recorded games) | B (1) | B (2) | B (2) | B | B | B | B | B | B |
| Coming-in stats | P (last season only on a mid-season start) | P | P | P | P | P | — | — | — | — |
| Finals saved | B, once a day (§2) | B | B | B | B | B | B (≤10 events a run) | B (≤10) | B (≤10) | B (≤10) |
| Stat corrections after final | M | M | M | M | M | M | M | M | M | M |
| Points per stat | B | B | B | B | B (by position) | B | B (by place) | B (by place) | B (by format) | B (by format) |
| Categories H2H / roto | B | B | B | B | — | B | — | — | — | — |
| Head to head + playoffs | B (engine), no real season | B | B | B | B | B | B | B | B | B |
| Slate (week/day/round) | B | B | B | B | B (rounds) | B | P (tour season = an event an episode, L8 Noticed) | P | P | P |
| Lock by week / day | B (default weekly = **Thursday kickoff**) | B (daily) | B | B | B | B | — | — | — | — |
| Lock at each player's game | B (`closes:'game'`, not the default) | B | B | B | B | B | — | — | — | — |
| Lineup slots enforced | B (cast properties chunk 5, bd1999aa) | M (defaults hold PG…Util; `withLineupSlots` is football-only, `index.ts:149`) | M | M | M | P (college FB shares football's) | — | — | — | — |
| Pick'em on a slate | P (gallery's `each:'game'` grades; defaults' plain `pickem` on the rail doesn't: BACKLOG 108) | P | P | P | P | P | — | — | — | — |
| Postponed / cancelled / week in progress | B (explorer last slice; BACKLOG 81 fixed 2b1212ef) | B | B (recorded rainouts) | B | B | B | — | — | — | — |
| Live points on screen | M | M | M | M | M | M | M | M | M | M |
| Injuries / IR | M | M | M | M | M | M | — | — | — | — |
| Recorded test fixtures | B | B | B | P (no regular-season slate, no team schedule) | B | B | B | B | B | B |

---

## 2. The data pipeline

### 2.1 Providers and the cache
- `src/lib/server/sports/index.ts sportsProviders()`: ESPN alone, through `cache.ts` (`sports_cache` in Neon). Stand-in ESPN via
  `x-gys-sports` header only under `next dev`. User-Agent is bare `GameYourShow/1.0` (`espn.ts:22`; ESPN 403s a UA with a URL).
- `answerOf` (`espn.ts:400`): 8 s timeout (`TIMEOUT_MS`, `:23`), 404/400 → null ("none"), other non-2xx, timeout or non-JSON →
  `SportsUnavailable`. No retries; callers stop their run and try next time.
- Cache keep times (PLAN-sports-data As built; HOSTING.md): searches/index a week, a day's games 3 min while one's on, an hour
  otherwise, 30 days when the day is 2+ days gone; final box score for good; rosters and season lines a day; a stale answer is
  served when ESPN fails. Pruned by the daily listings job (`pruneSportsCache`).

### 2.2 Who fetches what, when
There is **no sports schedule of its own**. Everything time-driven runs inside the **daily listings job**
(`src/lib/server/tv-listings.ts:332-345`), which runs **at most once an Eastern day**, in `after()` of the bot VM's call to
`/api/cron/bot-research` (`route.ts:81-82`, `maxDuration` 300) when `listingsDue()` (`tv-listings.ts:77`), or by hand
(`/api/cron/listings`). There is no `vercel.json` (no Vercel cron). The job's own comment: runs are "up to ~30 hours apart"
(`tv-listings.ts:154`). Its sports part:
1. `linkSportSeasons` (TV-listing sport seasons, ≤20 a run, `season.ts:62`).
2. `refreshSportsEvents` (`matchup.ts:249`): `syncSlates` (every slate's days from 3 back to 8 ahead; links new games, moves
   moved ones, appends playoff episodes), then each linked game 3 days back to 8 ahead that isn't final, read from its day's
   scoreboard (≤40 days a run) and stored (`storeEvents`: state, score, final, odds, `called`); moved games looked up on the
   team's schedule (≤10); matchup seasons' status; then `saveFinals` (`finals.ts:43`): each game final with no lines yet, its
   summary read once and reduced to `sports_events.lines/people/shape` (≤60 a run, ≤10 fields/cards).

On-demand paths: Add / search / schedule / start routes (`/api/sports/*`), the Players tab read (`rosters.ts:243-259`: cast fill
when a linked game has ended since the last fill, then `statsFromEvents` for `game_lines`, the Players tab's own table), the
athlete sheet's history.

**Consequence: a game counts for standings only after the next daily run.** `score.ts statusOf` (`score.ts:87`) treats a game as
final only when `sports_events.final` and its `lines` are both kept; `final` is written only by `storeEvents`, which only the daily
job, slate sync and matchup making call (grep: `matchup.ts:93,290,347`, `slate.ts:110,427`). The Players tab's stats fill can't
mark it final (its `saveFinals({ only })` still requires `f.final`, `finals.ts:56`). A slate week is stamped only when every game
is over (`score.ts:224`, `done`). So for an NFL week (Thu → Mon) nothing moves on the server until the run after Monday night's
game: **Tuesday at the earliest, possibly Wednesday morning**. No live points are shown anywhere.

### 2.3 What lands in Postgres
| Table (migration) | What | Size (HOSTING.md / plan measurements) |
|---|---|---|
| `sports_cache` (0148) | trimmed ESPN answers | box score ~9-10 KB; team lists ~340 KB total; NBA calendar ~10 KB |
| `sports_links`, `season_events` (0148, 0304) | a season's link state; each episode's game(s) | ~250-300 B a link |
| `season_cast.provider_ids` (0149) | ESPN athlete id per person | ~250 B a person; a league slate 450-1,700 people (120-450 KB) |
| `game_lines` (0150) | Players tab lines per game + coming in | ~320 B a player a game; ~420 B a player coming in |
| `sports_events` (0300-0302, 0306) | each game's facts, kept final counts | ~430 B + 3-7 KB lines (NBA 3, NFL 5, NHL 5); golf ~29 KB, Grand Slam ~240 KB |
| `sports_matchups` (0300), `sports_slates` (0304) | shared seasons | ~200 B each |
| `team_follows`, `user_settings.hide_sports_scores` (0307), `sports_recordings` (0438) | per-person | tiny |

Rows per season: an NFL slate ~272 games (~190 KB events), an MLB slate ~2,430 games (~1.7 MB), an NBA slate ~1,230 games.
Not backed up (re-asked). Leagues never store lines: each read stamps them (`stampStats`, fingerprint per instance,
`score.ts:306-320`).

### 2.4 The live poller
`live-proxy.ts` (commit e7be0c68, 2026-11-15): allow-listed live addresses only; summary trimmed (198 KB → 19 KB gzipped for an NFL
game); `s-maxage=15` with stale-while-revalidate (5 min once over or not begun); per instance at most one ESPN ask per address per
10 s, one at a time; stale answer on failure; nothing in Neon. Tests: `tests/sports-live-proxy.test.js` (5). Phones poll every
15 s while visible (`live.ts`). Unused by any screen today.

### 2.5 Rate limits and failure modes
- ESPN publishes no limits or terms (HOSTING.md stack table). Asked little; live is one ask per game per 15 s per edge region.
- **ESPN down:** cached answers served stale; `saveFinals` stops the run (`finals.ts:73-76`, `break`) and the daily job retries
  the next day (or an hour later if the run failed, `listingsDue`).
- **ESPN changes its shape (the dangerous one):** a reader that throws or returns null leaves the game unsaved; once the final is
  2 days old it is **kept as none**: `kept = null` → `lines = '{}'` written (`finals.ts:78-90`), `lines IS NULL` never true again,
  and `statusOf` reads `{}` as final (an empty object is truthy) → every holding scores **0 for that game, permanently and
  silently**. The same give-up exists in the Players tab fill (`stats.ts:205`, "Nothing from the provider two days on").
  Errors are only `console.error`/`run.errors` in `app_settings 'listings'`; nothing alerts.
- Football's kicker distances, D/ST safeties/blocks and 2-pt plays are parsed from play text by regex (`football.ts:803,1094`);
  a wording change zeros those stats. Only the recorded games test them.

### 2.6 Corrections, injuries, trades, time
- **Stat corrections: none.** A final is read once and "never asked again" (`finals.ts:7-12, 88`: `WHERE … lines IS NULL`); the
  box-score cache keeps a final "for good"; the stamp fingerprint assumes a final never changes (`score.ts:311`). NFL official
  corrections (midweek) and MLB scorer changes are never applied; the stamp would not pick a rewrite up anyway.
- **Injuries/status:** not read (§1.2). No IR, no Q/D/O, no "out" warning on a lineup.
- **Trades:** a person's team is `season_cast.tribe_name`, written once and never updated (`cast.ts` "only adds, never removes";
  `saveCast` skips anyone already there by name or id). `air-times.ts stampGameLocks` (`:112-118`) uses it for a holding's game
  under `closes:'game'`, so a traded player locks on his old team's game. Stats still land on the right game (lines are keyed by
  event and ESPN id), so the visible failure is the lock and the team label.
- **New players** (signings, call-ups): a slate stays castable (`castable`, `cast.ts:119`), and the Players tab read refills from
  rosters after any game ends, but a slate sync only refills when a team has nobody (`slate.ts:430`, `teamsWithNobody`). Leagues get
  their castaways from the approved cast at start (`new-game.ts:79`, `approvedCastFor`); sports cast fills never call
  `applyApprovedCastToLeagues` (only `desk-cast*.ts` do). **(verify)** whether a player added after a game starts can be claimed.
- **Time zones / DST:** game starts are ESPN's UTC instants. Days and weeks are Eastern (`locks.ts LOCK_ZONE`, Tue-Mon week,
  `WEEK_FROM = 2`), slate days by Eastern day (`slate.ts dayOf`). `tests/dst.test.js:91` covers daily/weekly/slate locks across the
  clock change. Edges: an overseas game (MLB's Tokyo/Seoul openers at ~6 AM ET) becomes the Eastern day's first start and locks a
  daily lineup at dawn; a Pacific game after midnight ET falls on the next Eastern day.

---

## 3. Correctness risks, ranked by how likely they bite a couch playing an NFL or NBA season game now

1. **Standings don't move until the day after, and an NFL week not until Tuesday or Wednesday** (§2.2). Certain on every week.
   What they see: Sunday night, every matchup 0-0; Monday, still 0-0 (the week isn't "done"); Tuesday or Wednesday morning, the
   result. No live points, no provisional week. Sleeper/ESPN users will read it as broken.
2. **The NFL season default locks every lineup at Thursday night's kickoff.** `football.json` season `closes: 'weekly'`; on a slate
   the week locks at its first game (`locks.ts` slate branch). Certain. What they see: "Locked" on Friday for a Sunday game;
   Yahoo/ESPN lock each player at his own kickoff. `closes:'game'` is built and tested (explorer seventh slice) but not the default
   (a rule change: needs the user's OK).
3. **NFL D/ST slot can't be filled (verify).** The stored final scores a team defense as person `def:<teamId>` ("Eagles D/ST",
   `football.ts:373`), but cast fills add only ESPN roster players (`cast.ts rosterFromEvents`) and nothing in `src/lib/server`
   creates a `def:` person (grep). `score.ts peopleOf` then keys D/ST lines to nobody (`espn:def:…`). The default lineup has a DEF
   slot (`football.json` slots), enforced since chunk 5. What they see: no defenses to draft; the DEF slot empty or the draft
   short. The explorer cannot catch this: its generator makes 32 DEF athletes itself (`runtime-sports.cjs:80`).
4. **A stat-reader failure zeroes a game forever** (§2.5). Likely across a season (ESPN tweaks text and shapes; football's play
   parsing is regex). What they see: a player who scored 25 shows 0 for that week, never fixed; no alert to the admin.
5. **Same-name players (BACKLOG 145).** `season_cast` unique by `lower(name)` (`cast.ts:173` `ON CONFLICT (season_id, lower(name))
   DO NOTHING`); cast fills team by team in the order teams first play, so **whichever same-named player's team plays first wins**
   and the other is undraftable. Lines map by name twice more: `score.ts peopleOf` (league castaway by name, first wins) and
   `air-times.ts:113` (team by name). `player-log?name=`. Likely on a league-wide NFL or NBA slate of 450-1,700 people.
6. **Lineup-by-game counts a dropped player (idea 209, 69's residual).** `ActiveRosterLogic.lineupAt` (`state-logic.js:4498-4503`)
   returns the logged ids raw; `lineupFor`'s `letGoBefore` filter (BACKLOG 69's fix, 1e3cca2e) isn't applied. Only with
   `closes:'game'` (the NBA's daily lineups inside a week, or an NFL league switched to per-game locks). What they see: the old
   owner still scores a player released mid-week, and if someone claims him, both seats score him.
7. **Stat corrections never applied** (§2.6). Certain to differ from ESPN/Yahoo by small amounts most NFL weeks; occasionally
   flips a close matchup. Nobody can fix it in-app.
8. **Pick'em on a slate never graded (BACKLOG 108).** The sports rail's slate list includes the defaults' plain `pickem`
   (`start-games.ts:22`, `SLATE`), which has no `each:'game'`; `score.ts` keeps no single game per slate episode (`setGame` returns
   to `out.slate` only), so its answers never settle. The wizard's gallery is safe (sport-gallery-check asserts `each:'game'`), but
   `POST /api/sports/start` with `{ league, slate, game: 'pickem' }` reaches it. Squares on a slate never pay either.
9. **Other sports' lineup slots aren't enforced.** NBA/MLB/NHL defaults list PG…Util, C…P etc., but `withLineupSlots` applies to
   football only (`index.ts:149`). An NBA lineup of ten centers is legal; bots and people are not held to positions.
10. **Traded players** lock on the old team's game and show the old team (§2.6). Weekly in-season trades make this a few players
    a week league-wide, more at the deadline.
11. **Players added mid-season may never reach a running league** (verify, §2.6): a waiver pool missing call-ups and signings.
12. **Bye weeks and injuries are invisible.** Nothing reads injuries; nothing marks a bye (the schedule has it: a holding with no
    game in the episode). What they see: starting a player who's out or on bye, scoring 0, no warning, no IR slot.
13. **A drafting couch mid-season sees only last season.** A slate links games only 3 days back (`slate.ts:27`, `BACK_DAYS`), and
    coming in is the season before (`sports-stats.ts:118`). A draft today for the NFL or NBA has no 2026-27 stats and no rankings.
14. **The VM is a single point of failure for all sports results** (BACKLOG 184, §5).
15. **Daily-job caps under load.** `saveFinals` ≤60 games a run, ≤40 scoreboard days, ≤10 fields/cards. NFL + NBA + NHL is ~30
    games a day (fits); a college-football Saturday slate (~60-80 FBS games) spills a day each time. Fields/cards: ≤10 a run.
16. **Postponed slate games**: built and checked (explorer last slice; BACKLOG 81 fixed 2b1212ef). An NFL postponement is rare;
    a week waits for the makeup only if ESPN keeps it in the same week (its episode by day). Low risk.
17. **Weekly playoffs placement:** head-to-head playoffs sit at the season's end by the slate's episode count
    (`air-times.ts stampSeasonLength`). Whether an NFL slate's Week 18 is a fantasy playoff week (Yahoo and ESPN end at Week 17) is
    unverified. Low, but it decides a title.

Docs drift noticed: AGENTS.md says "a week in progress and a postponed game remain gaps" in the explorer; GAMEPLAY-EXPLORER.md's
last slice (2026-11-14, afdf5f9b) built both. `check-teams.js` and `check-team-tab.js` (named in the brief) are about teams of
players and the waivers UI, not sports.

---

## 4. Tests and checks

### 4.1 Unit tests (run 2026-11-19)
`node --test tests/sports-*.test.js tests/scoring-categories.test.js tests/game-words-sports.test.js
tests/gameplay-explorer-sports.test.js tests/gameplay-bench-sports.test.js`: **517 tests, 517 pass, 0 fail, 0 skipped, 63 s.** No
test touches a database or the network (fetch is stubbed in `sports-final.test.js:172-218`). Largest files: explorer sports (46
top-level `test(` blocks), sports-hook (25), scoring-categories (21), football (15).

What they cover: every sport's reader and reducer on recorded games (reduced box score = ESPN's own), stat keys and derived stats,
scoring sequence per kind, categories/roto, slates, locks (and DST), settles, squares, brackets, playoffs, live poller in virtual
time, the live proxy, find/search, team page, called-off, spec checks, the explorer runtime against an independent oracle
(`campaign/sports-oracle.cjs`).

What they don't: anything on the server's database paths (`saveFinals` give-up, `castFromEvents`, `syncSlate`, `stampStats`,
`peopleOf`'s name join, `stampGameLocks`), roster answers with injuries, a corrected final, a real D/ST in a real cast, same-name
players, a traded player, a season-long run.

### 4.2 Offline catalog check
`sport-gallery-check.js`: 181 rows, ALL PASS (§1.3).

### 4.3 dev-test checks (not run: they need the dev server or database)
| Check | Covers | State |
|---|---|---|
| `check-sports-data.js` | real ESPN: World Series, AFL, US GP, EPL, Celtics, cache (43 PASS when written) | real network; last touched 2026-10-27 |
| `check-sports-links.js` | linking, cast, stats fill on stand-ins; `--real`, `--server` | **stale: BACKLOG 101** (13 mark cases predate "sports are live") |
| `check-slate.js` | L8 slates on fake-espn, no app server | last touched 2026-11-06; not re-run after later lock/called-off work (no record) |
| `check-sports-couch.js` | U1: search, team sheet, follow, start, guide, Sports scores too, 390 px | real routes, stand-in ESPN |
| `check-sports-explorer.js` | real routes vs runtime: tables, live, sweep, control, correction, lineup, slates, calledoff | **calledoff part 4 needs the Eastern day-edge guard** (BACKLOG "Now", line 78) |
| `check-live-clock.js`, `check-live-event.js`, `check-espn-browser.js` | pollers on recordings / in a browser | live-event needs recordings in %TEMP% |
| `check-sport-reduce.js` | real ESPN: reduce = box score on many games | real network |
| `check-sports-words.js`, `story-sport-daily.js`, `check-gameplay-bench-sports.js` | GPT words, Round 3 daily games, bench | |
| `tests/game-spec.test.js` local-DB pass | **BACKLOG 78**: checks sports leagues' specs without their sport context (a false failure for the NBA lineup of ten) | stale |

### 4.4 Recorded ESPN fixtures (`tests/fixtures/espn/`, 59 files, 6.9 MB)
| Sport | Games (summary/board) | Schedules / calendars | Teams | Missing |
|---|---|---|---|---|
| NFL | 2 (401872958, 401873017) | team schedule, league 2026, playoffs 2026 | yes | roster, injuries, in-progress, a correction, a bye week's slate |
| NBA | 1 (401909093) | team schedule, league 2027, playoffs 2026 | yes | as NFL; only one game |
| MLB | 2 | 2 team schedules, called-off, league, playoffs | yes | roster, injuries, a doubleheader, a two-way line |
| NHL | 2 | playoffs only | yes | **regular-season league slate, team schedule** |
| WNBA / NCAAM / NCAAW / CFB / college baseball | 1 / 2 / 2 / 2 / 3 | — | CFB, NCAAM | schedules |
| Soccer | EPL, MLS, DFB, WC x2 | EPL league + teams | EPL | |
| Golf / racing / MMA / tennis | PGA 2, LPGA 1 / F1 2, NASCAR 1, IndyCar 1 / UFC 4, PFL 1, Cage Warriors 1 / ATP 3, WTA 1 | — | — | |

Live in-game recordings exist only in ignored folders (`.ui-atlas/fixtures/espn-live/`, `%TEMP%/rfl-espn-live/`), not in tests.

### 4.5 The explorer's sports program (docs/GAMEPLAY-EXPLORER.md §1041-1696)
Covered, each with unit tests, a generator, invariants recounted from box scores, positive controls and real-route checks: points
total (slice 1), daily/weekly locks and head to head (2), categories and roto (3), by place (4), by position (5), by a match's format
(6), slates and lock at each game's start (7), called off and a week in progress (last). Pilots: real-size pools (NFL 344, NBA 330,
MLB 430, NHL 380) and the NFL season with waivers (`nfl-waivers-open`). Campaigns 200 of 200 each.

Not covered: **questions on sports** (pick'em, squares, brackets: "Profile: stats only on a sport context … no questions"), lineup
slots (the explorer's generator deals positions but the profile doesn't enforce slots), real cast shapes (D/ST, same names,
trades), corrections, injuries, playoffs on a real season length, and **any real-season data**: worlds are generated.

---

## 5. Operations and cost

From HOSTING.md (measurements 2026-10-28 to 11-15; prices of 2026-10-24/28). Today ~$1/month plus Neon Launch ~$5.

**An NFL Sunday today (no live screen):** nothing polls ESPN; the only load is people's ordinary league polls (every 15 s while a
page is open; each sports league read adds one 32-byte fingerprint query, `score.ts:306`). Neon compute follows hours awake:
1 PM to midnight ET ≈ 11 h x 0.25 CU ≈ 2.75 CU-h ≈ $0.29 a Sunday at $0.106/CU-h, less if the app is already awake. A season
of Sundays + TNF + MNF ≈ 18 x 18 h ≈ 80 CU-h upper bound ≈ $8.50 for the season. Storage trivial (an NFL slate ~2 MB all in).

**With the live screen (planned, PLANS.md step 6):** per phone per NFL game ~20 MB of Vercel transfer and ~780 CDN requests
(240 an hour x 3.25 h); ESPN and function invocations ~240 an hour per game per edge region, whoever watches. A couch of 6
watching 2 games each on a Sunday: ~240 MB, ~9,400 CDN requests, ~1,600 invocations. A month of Sundays and prime-time games:
~1-1.5 GB and ~50K requests a couch. **Headroom on Hobby** (1M invocations, 1M CDN requests; 92K and 168K used at the last snapshot,
2026-10-24): roughly 10-15 couches watching live before requests matter; transfer depends on Hobby's Fast Data Transfer
allowance, which HOSTING.md says to check (BACKLOG 154 says HOSTING.md is behind for 11-16 to 11-19). MLB is twice the bytes
(~40 MB a game a phone). Neon is unaffected by live (nothing stored).

**A few couches each playing a season-long NFL game, no live screen:** cost is dominated by Neon awake hours (+$2-4 a month) and
the daily job's ESPN calls (shared per league, not per couch: a slate is shared by everyone who adds it, `sports_slates`).
Coming-in fills are 60 players a Players-tab read (an NFL slate's ~1,700 need ~30 reads).

**Jobs that only run when the bot VM calls:** all of sports' scheduled work (linking, slate sync, finals, stat counts, cache
prune) rides the daily listings job, triggered only by the VM's `/api/cron/bot-research` (`route.ts:81`) or a manual
`/api/cron/listings`. **So BACKLOG 184's backstop is a sports dependency too**: if the VM stops, no sports game ever goes final.
The GitHub Actions hourly job (`reminders-waivers.yml`: `db/reminders.js`, `db/waivers.js`) already wakes Neon hourly and could
carry a sports finals step at no new wake.

---

## 6. What a real season-long fantasy game still lacks (vs Sleeper, ESPN, Yahoo)

| Expectation | State | Evidence |
|---|---|---|
| Lineup slots, NFL | **Built** | cast properties chunk 5 (bd1999aa), `index.ts withLineupSlots` |
| Lineup slots, NBA/MLB/NHL/soccer | **Missing** (data only) | defaults' `slots`; enforcement football-only |
| Superflex / 3 WR / 2 flex variants | Partial (slots are data; describe/G1 words not checked) | L9 part 1 text |
| Team D/ST as draftable | **Missing on real data (verify)** | §3 item 3 |
| Lock at each player's kickoff | Built, **not default** for NFL | `closes:'game'`; football.json `weekly` |
| Live scoring | **Missing on screen**; poller and proxy built | PLANS.md step 6 |
| Results within minutes of the final | **Missing** (next daily run) | §2.2 |
| Stat corrections | **Missing** | `finals.ts` once only |
| Injury status (Q/D/O), news | **Missing** | nothing reads it |
| IR slots | **Missing** (L9 part 2) | GPT plan L9 |
| Bye week awareness | **Missing** | no code |
| Waivers | Built for shows (C4), proven on an NFL real-size pool in the explorer pilot; never run on a real sports season; daily vs weekly for daily sports undecided (idea 209) | GAMEPLAY-EXPLORER.md §1697 |
| Free agency | Built (C4) | |
| FAAB bids | **Missing** (L9 part 3) | |
| Trades (+ review, deadline) | **Missing** (L9 part 4) | |
| Draft: snake, auction, keepers | Built (keepers need last season's game) | gallery `sp-keeper` needs |
| Draft rankings / projections / ADP | **Missing** (BACKLOG 90) | |
| Draft room | Built (design round step 6) | |
| Head to head, playoffs | Built (engine); Week 18 handling unverified | A11 |
| Categories / roto | Built | L3 part 2d |
| Dynasty / rookie draft, salary cap | Coming (no rookie flag, no prices) | gallery `gap` |
| Same-name players | **Broken** (BACKLOG 145) | §3 item 5 |
| Trades in the real league move a player's team | **Missing** | §2.6 |

---

## 7. Verdicts and the shortest path

### 7.1 Verdict per sport (for a real couch, now)
| Sport | Single-game / pick'em / squares on one team's games | A league's slate (season-long fantasy) |
|---|---|---|
| **NFL** | Ready with caveats (results next day; no live view) | **Not ready**: D/ST (verify), Thursday lock default, Tue/Wed results, same names, no byes/injuries, no corrections |
| **NBA** | Ready with caveats | **Not ready**: slots unenforced, lineup-by-game residual (209), traded players, next-day results, same names |
| **MLB** | Off-season (2027 starts in March); caveats as NBA | **Not ready**: as NBA, plus two-way players' second line, 40 MB/game live |
| **NHL** | Ready with caveats | **Not ready**: as NBA; thinnest fixtures (no regular-season slate recording) |
| Soccer | Ready with caveats | Not ready (slots, results next day) |
| College FB/BB | Caveats: ESPN's default scoreboards miss smaller games | Not ready (caps on a Saturday slate) |
| Golf, racing, MMA, tennis | Ready with caveats (≤10 events a run; "Add a show" can't find events, idea 209) | n/a (tour seasons partial) |

### 7.2 The shortest path to "NFL, NBA and MLB are solid"
Ordered by what bites first; each step a session or less unless sized otherwise.

0. **Verify the four inferences (S).** On the local DB with the stand-in or a recorded slate: (a) after adding the NFL slate,
   `SELECT count(*) FROM season_cast WHERE role = 'DEF'` (D/ST people); (b) add a roster player after a slate game starts and see
   whether a running league can claim him; (c) start `pickem` from `/api/sports/start` on a slate and grade a week (BACKLOG 108);
   (d) the NFL slate's head-to-head playoff weeks. *Done:* each confirmed or struck, with a check left in `scripts/dev-test/`.
1. **Results the same night (S-M).** Move sports' scheduled work out of the once-a-day listings job: a `db/sports-refresh.js`
   (`refreshSportsEvents` + `saveFinals`) in the existing hourly GitHub Actions job (no new Neon wake), more often only when a
   linked game ended in the last few hours; keep the daily run as the fallback; then BACKLOG 184's Vercel daily cron as the
   backstop for both. *Done:* a game is final in standings within an hour of ESPN's final. *Verify:* `check-slate.js` with
   fake-espn and a fake clock; HOSTING.md updated with the calls.
2. **Never zero a game silently; take corrections (S-M).** `saveFinals`: a reader error or empty answer is retried, not kept as
   `{}`; a game kept empty is flagged to the desk. Re-read each final once more at +24 h and again before the next week's first
   lock (NFL corrections land midweek), rewrite `lines` with a new `lines_at` when they differ, and make the stamp fingerprint
   include `lines_at`. *Done:* a recorded final plus an edited copy updates the table. *Verify:* unit tests on `finals.ts` with a
   stub DB or a dev-test case; `sports-final.test.js` extended.
3. **People by ESPN id, not name (M; BACKLOG 145).** Unique by (season, provider id) for sports casts; league castaways linked by
   `seasonCastId`/provider id in `score.ts peopleOf`, `air-times.ts stampGameLocks`, `player-log`, `cast.ts saveCast`; the team
   beside a repeated name. Add team defenses as people (`def:<teamId>`, position DEF) if step 0 confirms. *Done:* an NFL slate
   fixture keeps both same-named players and 32 D/STs, each drafted and scored. *Verify:* a recorded-slate dev check, the explorer's
   real-size pool fed from a real roster.
4. **Rosters stay current (S-M).** Daily roster refresh for slate seasons updates `tribe_name` (trades), adds signings and pushes
   new people into running leagues' pools; a traded player's lock follows his new team. *Done:* a fixture trade and a signing.
5. **The small engine fixes (S each).** BACKLOG 108 (refuse single-game questions and squares on a slate in `specProblems`, or give
   the rail's `pickem` `each:'game'`); idea 209's `lineupAt` applying `letGoBefore`; BACKLOG 101, 78 and the calledoff part 4 check
   fixes. *Verify:* unit tests plus `check-slate.js`, `check-sports-explorer.js`.
6. **Defaults players expect (S, the user's OK).** NFL season `closes: 'game'`; fantasy playoffs ending Week 17. *Verify:*
   `check-lock-in.js`-style lock checks and the explorer's lock invariants (HANDOFF: a lock change reruns every airtime-lock check).
7. **Slots for NBA, MLB, NHL (M; L9 part 1).** Generalise `withLineupSlots` to every sport's defaults with ESPN positions (and MLB's
   two-way players); bots set legal lineups. *Verify:* the explorer's slot invariant on real-size pools; unit tests per sport.
8. **Injuries, byes, IR (M; L9 part 2).** Read ESPN's roster injury status in the daily refresh; mark Q/D/O/IR and byes (no game in
   the episode) on the lineup; IR slot. *Verify:* recorded roster fixtures with injuries; a bye-week slate fixture.
9. **A week in progress, then live (M then L).** Stamp a slate week's games final so far as provisional (the engine keeps the week
   un-final), so Sunday's matchups move as each game ends; then the live screen on the existing proxy (design step 10).
10. **A real-season replay (L).** Record a whole NFL season (and an NBA and MLB month) with `record-espn-slate.js` and finals;
    replay a 10-12 seat league with bots through the real routes week by week (draft, lineups, waivers, playoffs), compared with
    `sports-oracle.cjs`. Measure Neon/Vercel. *Done:* zero disagreements, a cost line in HOSTING.md. This is the gate for "solid".
11. **Draft help (M; BACKLOG 90).** At least rank by last season plus this season so far (data already kept; link a mid-season
    slate's past games, not just 3 days back); a projections source only if free and keyless (the user's rule: never ChatGPT).
12. **Later (L each): FAAB and trades** (L9 parts 3-4).

NFL is "solid" after 0-6 and 10 (plus 8 for injuries). NBA and NHL need 7 too. MLB can wait for the 2027 season, but its slots
(7) and two-way players should go in the same pass.
