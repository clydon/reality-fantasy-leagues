# Plan: sports data from APIs (rosters, photos, stats), ChatGPT last

Status: **planned, not built** (2026-10-27). Bot-powered stats are paused (`BOT_STATS = false` in `src/lib/server/rosters.ts`);
Fill in who's playing still asks our bot, now for players only. This plan replaces both with sports-data APIs.

## Why

Asking our bot for a whole roster's numbers was slow (5-9 minutes for a World Series, over several taps), patchy (ChatGPT drops
people from long answers) and fragile (a run timed out with nothing). Sports already have structured, free data. ChatGPT stays as the
last resort, for rosters only.

## What the user asked for

- Coverage: every US major league and minor league, then the first-world international majors (soccer's top leagues, cricket, AFL,
  rugby, F1...).
- An API drives the cast (players only: no coaches, staff or officials) and the stats; a backup source when the first is down or rate
  limited; ChatGPT only third.
- Stats that fit each sport (a hitter's and a pitcher's line, an AFL player's disposals and goals, a driver's finishing place).
- Universal, not curated (memory: universal-not-curated): no hand-kept table of sports or stat columns. Provider adapters are fine;
  what a sport's stats are comes from the provider's own data.
- Comes next, in a later session: a game over a **defined span** (a 3-game series, just the World Series, just the NBA playoffs, just
  post-merge Survivor, a single game). Nothing here should assume a whole season.

## What was checked (2026-10-27, live calls)

| Source | Key | Coverage seen | What it gives | Catch |
|---|---|---|---|---|
| **ESPN** (`site.api.espn.com`, `site.web.api.espn.com`) | none | MLB, NFL, NBA, NHL, WNBA, MLS, Premier League, AFL, Rugby World Cup, F1, NCAA football and baseball, NBA G League, cricket (IPL, World Cup, Test Championship). No AHL, no minor-league baseball | Teams; rosters grouped by position with **headshots** (coaches separate); scoreboards by date (the 2026 World Series games, with ESPN event ids); per-game **box scores with the sport's own columns** (MLB batting `H-AB AB R H RBI HR BB K #P AVG OBP SLG`, pitching `IP H R ER BB K HR PC-ST ERA PC`; AFL `D G B T M FF FA ...`) and officials; athlete season stats by year (Yandy Díaz 2026 regular season: 154 GP, 180 H, 22 HR, 85 RBI; a separate postseason row) | Unofficial and undocumented: can change without notice, no stated rate limit or terms. Cache hard, call little, and keep the backups |
| **MLB Stats API** (`statsapi.mlb.com/api/v1`) | none | MLB plus Triple-A (11), Double-A (12), High-A (13), Single-A (14), Rookie (16), Winter (17), Independent (23), KBO (32), NPB (31) | Teams by sport, rosters, box scores, player stats | Copyright MLB Advanced Media; no formal docs; personal and analytical use is the comfortable zone |
| **API-Sports** (api-sports.io: football, basketball, baseball, hockey, rugby, AFL, F1, NFL, ...) | yes | Broad international | Fixtures, rosters, player stats | **Free plan is old seasons only** (a real free key got baseball 2022-2024 and was refused 2025; the pricing page says free plans are season-limited). Useful only paid (~$15-19/month per sport, 7,500 requests a day) |
| **TheSportsDB** | free test key; Patreon key for v2 | Very broad, international | Teams, players with photos (cut-outs), events | Stats thin; free key caps results per query |
| **CricketData.org** (was CricAPI) | yes, free | Cricket | Squads, scorecards, player stats | 100 hits a day |
| **Jolpica** (Ergast's successor), **OpenF1** | none | F1 | Fields, results, laps | Jolpica already used for F1 photos (show-art.ts) |
| **NHL** (`api-web.nhle.com`) | none | NHL | Rosters, box scores | Not probed yet |

Sources: [Zuplo's ESPN hidden API guide](https://zuplo.com/blog/2024/10/01/espn-hidden-api-guide),
[sportsapis.dev on ESPN](https://sportsapis.dev/espn-api), [MLB Stats API listing](https://freeapihub.com/apis/mlb-stats-api),
[Teamarr's MLB Stats provider notes](https://www.mintlify.com/Pharaoh-Labs/teamarr/reference/provider-mlbstats),
[API-Football pricing](https://www.api-football.com/pricing), [a free API-Baseball key's season limit](https://github.com/ainaraomakaseare-coder/my-app/pull/29),
[CricketData listing](https://freeapihub.com/apis/cricketdata-api), [TheSportsDB listing](https://freeapihub.com/apis/thesportsdb-api).

## The design

### 1. Providers, in order, behind one interface

`src/lib/server/sports/` with one adapter per provider, each answering the same few questions:

- `leagues()`: which leagues it has (discovered from the provider where it can say so, e.g. ESPN's sports and leagues index; never a
  table we keep);
- `eventsOn(league, date)`: the games on a day, with team names;
- `roster(league, team)`: players, positions, headshots, the provider's athlete ids;
- `boxScore(league, event)`: each player's line in that game, **with the provider's own column labels** (that's the per-sport
  relevance, for free);
- `seasonStats(league, athlete)`: a player's line for a season (coming in).

A chain tries them in order per call: **ESPN → the league's own free API** (MLB Stats API for any baseball level, NHL's, Jolpica or
OpenF1 for F1, CricketData for cricket) **→ TheSportsDB → ChatGPT** (rosters only, as now). A provider that errors, times out or
answers 429 is skipped for a while (a small circuit breaker), and the next answers. Every answer is cached (rosters a day, a finished
game's box score for good, a live one a few minutes), so a season costs a handful of calls, not one per person per visit.

### 2. Linking a season to the provider's games, universally

A sport's episodes are already listed with titles and air times ("Game 1: Tampa Bay Rays at Milwaukee Brewers", Oct 23). For each
episode, ask the providers' scoreboards for that date and pick the event whose two team names both appear in the title (or, for a
sport of individuals, whose event name matches: "Bahrain Grand Prix"). Store the link: a new `season_events` (season, episode number,
provider, league, event id). No sport table: the listing's own titles and dates do the matching. When nothing matches (a show that's a
sport but not a league's games), the season keeps today's path.

This is also what the **span** work needs: a game over a span is a set of episodes, each already tied to its event.

### 3. Cast from the linked events

The teams in a season's linked events give its roster: each team's players from the chain (players only), each with the provider's
athlete id and headshot. Written to `season_cast` (team as group, position as role) plus a new `provider_ids` (provider to athlete id)
so stats can find them. Photos: the provider's headshot first, Wikipedia (show-art.ts, by team) for anyone without one.

### 4. Stats from box scores, spoiler-safe by construction

- **Each game:** every player's box-score line, stored per episode (`cast_stats` with `through` = that episode, items = the provider's
  labels and values). A finished game's line never changes.
- **So far:** the games you've seen, added up for the columns that add (counts like H, HR, K, goals, disposals; "x-y" pairs like H-AB
  add both sides). Rates (AVG, ERA, strike rates) aren't summed; they show from a game's own line or the season line. Which columns
  add is read from the values themselves (whole numbers add; decimals and percentages don't), not from a list.
- **Coming in:** the season line from `seasonStats` (the regular season, never a spoiler).
- **Through the guard:** only the games up to your mark, exactly as today's `statsFor` does with snapshots.

The Players tab keeps today's look: a line for the games you've seen ("Series · 3-11 · 1 HR · 2 RBI"), a line for coming in, and a tap
for each game's line.

### 5. What happens to today's code

- `rosters.ts`: Fill in who's playing becomes "from the sports data first"; the bot ask stays as the third fallback, players only.
- `BOT_STATS` stays off; the stats prompt code can go once box scores are in.
- `episode-recaps.ts`: for a linked sport, a game's recap can come from its box score (the final score, who won) before asking our bot.
- `show-art.ts`: the F1 shortcut (Jolpica) becomes just the F1 provider's headshots.

## Steps (each its own session)

1. **Providers and the chain**: the interface, ESPN and MLB Stats API adapters, the circuit breaker and cache; a dev check against
   the real services (`scripts/dev-test/check-sports-data.js`, like check-show-art.js: real calls, no app server).
2. **Linking**: `season_events` (migration), matching episodes to events by date and team names; the World Series as the first real
   case; a check with fake-listings' World Series and a stand-in provider.
3. **Cast**: rosters from linked events, players only, headshots then Wikipedia; Fill in who's playing uses it first.
4. **Stats**: box scores per game, so far summed through the guard, coming in from season stats; the Players tab's lines.
5. **More providers**: NHL, Jolpica or OpenF1, CricketData (key), TheSportsDB (key), each behind the chain; minor-league baseball via
   MLB Stats API sport ids.
6. **Spans** (the user's next idea) build on the links.

## Decisions for the user

1. **Keys to sign up for** (free): CricketData.org (cricket depth), TheSportsDB (a Patreon key widens it, $9/month, optional). Put them
   in `.env.local` and Vercel as `CRICKETDATA_KEY`, `THESPORTSDB_KEY`.
2. **API-Sports**: only worth it paid (~$15-19/month per sport); free is old seasons. Recommendation: skip for now; ESPN plus the
   leagues' own APIs cover the ask.
3. **ESPN's terms**: unofficial, no published terms for this use. Recommendation: use it, cache hard, credit ESPN in Credits, and keep
   the backups ready so a block isn't an outage.
