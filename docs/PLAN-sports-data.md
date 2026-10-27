# Plan: sports data from APIs (rosters, photos, stats), ChatGPT last

Status: **planned, not built** (2026-10-27). **First build: ESPN only** (the user, 2026-10-27): ESPN behind the provider interface,
Wikipedia for missing photos, ChatGPT for a roster only when ESPN has none. Every other source, the chain's tests (1b) and the circuit
breaker wait in docs/BACKLOG.md until a gap shows. Bot-powered stats are paused (`BOT_STATS = false` in `src/lib/server/rosters.ts`);
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
| **TheSportsDB** | public free key `123`, no signup | Very broad, international | Player search by name with a photo | **Not used** (the user, 2026-10-27): free team lists stop at 10 players, so it can't be a roster source, and it isn't worth a source just for photos |
| **CricketData.org** (was CricAPI) | yes, free signup | Cricket | Squads, scorecards, player stats | 100 hits a day; not needed to start (ESPN has the big cricket competitions) |
| **Jolpica** (Ergast's successor), **OpenF1** | none | F1 | Fields, results, laps | Jolpica already used for F1 photos (show-art.ts) |
| **NHL** (`api-web.nhle.com`) | none | NHL | Rosters, box scores | Not probed yet |
| **Premier League's fantasy API** (`fantasy.premierleague.com/api/bootstrap-static/`) | none | Premier League only | All 669 players and 20 teams; official headshots (`resources.premierleague.com/premierleague/photos/players/250x250/p{code}.png`, returned an image); goals, assists, minutes, clean sheets, saves, cards | Unofficial, like ESPN; one league |
| **OpenLigaDB** (`api.openligadb.de`) | none | German leagues (Bundesliga: 18 teams) | Teams, matches, goals | No player photos; thin on players |
| **football-data.org** | free signup | 12 competitions | Fixtures, squads | Needs a key (refused without); squads have no photos. Not needed |
| **FotMob** | none (unofficial) | Broad | | Its league endpoint answered 404: out |

Sources: [Zuplo's ESPN hidden API guide](https://zuplo.com/blog/2024/10/01/espn-hidden-api-guide),
[sportsapis.dev on ESPN](https://sportsapis.dev/espn-api), [MLB Stats API listing](https://freeapihub.com/apis/mlb-stats-api),
[Teamarr's MLB Stats provider notes](https://www.mintlify.com/Pharaoh-Labs/teamarr/reference/provider-mlbstats),
[API-Football pricing](https://www.api-football.com/pricing), [a free API-Baseball key's season limit](https://github.com/ainaraomakaseare-coder/my-app/pull/29),
[CricketData listing](https://freeapihub.com/apis/cricketdata-api), [TheSportsDB listing](https://freeapihub.com/apis/thesportsdb-api).

### Rosters and photos, checked (2026-10-27)

- ESPN rosters: MLB (Rays) 26 players, 26 headshots; NBA 18 of 18. Premier League 29 players but only 3 headshots. AFL's team roster
  came back empty, but AFL box scores list every player who played (Josh Ward's 25 disposals), so a roster can come from the linked
  games' box scores.
- MLB Stats API: a Triple-A roster (Toledo, 22) and its headshots at `img.mlbstatic.com/mlb-photos/image/upload/w_213,q_100/v1/people/{id}/headshot/67/current`
  (returned an image).
- Soccer: ESPN's match sheets list each team's squad with per-player stats (appearances, goals, saves, cards, fouls...), but few
  headshots (Premier League: 2 of 20 on a match sheet). Photos there come from the Premier League's own API for that league, and
  Wikipedia (show-art.ts, by name and team) for the rest. TheSportsDB was checked and left out.

So rosters and photos need no ChatGPT for anything a provider has: ChatGPT only for a league no source carries, and only when there
are no linked games to read players from.

## The design

### 1. Providers, in order, behind one interface (first build: ESPN alone behind it)

`src/lib/server/sports/` with one adapter per provider, each answering the same few questions:

- `leagues()`: which leagues it has (discovered from the provider where it can say so, e.g. ESPN's sports and leagues index; never a
  table we keep);
- `eventsOn(league, date)`: the games on a day, with team names;
- `roster(league, team)`: players, positions, headshots, the provider's athlete ids;
- `boxScore(league, event)`: each player's line in that game, **with the provider's own column labels** (that's the per-sport
  relevance, for free);
- `seasonStats(league, athlete)`: a player's line for a season (coming in).

A chain tries them in order per call: **ESPN → the league's own free API** (MLB Stats API for any baseball level, NHL's, Jolpica or
OpenF1 for F1, the Premier League's for its photos, OpenLigaDB for German soccer) **→ ChatGPT** (rosters only, and only when nothing
else has the league: section 3). Which one a league ends up on is decided by section 1b's tests, not by hand. A provider that errors, times out or
answers 429 is skipped for a while (a small circuit breaker), and the next answers. Every answer is cached (rosters a day, a finished
game's box score for good, a live one a few minutes), so a season costs a handful of calls, not one per person per visit.

### 1b. Which source, decided by the data (no table of leagues) (backlog: only matters with a second source)

For each league and each need (roster, photos, box scores, season stats), the chain tries sources in order and keeps the first whose
answer passes a test made from the data itself:

- **Roster**: it includes at least 90% of the players who appear in that team's linked box scores (before any game: at least as many
  players as the league's other teams' rosters have, from the same source).
- **Photos**: per person, not per league: the roster source's headshot, then the next source that has one for that person (the
  Premier League's own API, for its players), then Wikipedia, then initials.
- **Box score**: both teams have player lines.
- **Season stats**: most players with box-score lines have one.

The winner is remembered per league and need (`sports_picks`: league, need, source, score, checked_at) so the next call goes straight
to it, and checked again weekly or as soon as a call to it fails. A source that only covers some leagues (the Premier League's API, MLB
Stats API's levels) says which from its own data, so nothing here lists leagues by hand.

### 2. Linking a season to the provider's games, universally

A sport's episodes are already listed with titles and air times ("Game 1: Tampa Bay Rays at Milwaukee Brewers", Oct 23). For each
episode, ask the providers' scoreboards for that date and pick the event whose two team names both appear in the title (or, for a
sport of individuals, whose event name matches: "Bahrain Grand Prix"). Store the link: a new `season_events` (season, episode number,
provider, league, event id). No sport table: the listing's own titles and dates do the matching. When nothing matches (a show that's a
sport but not a league's games), the season keeps today's path.

This is also what the **span** work needs: a game over a span is a set of episodes, each already tied to its event.

### 3. Cast from the linked events (no ChatGPT unless nothing else has it)

The teams in a season's linked events give its roster: each team's players from the chain (players only), each with the provider's
athlete id and headshot. Written to `season_cast` (team as group, position as role) plus a new `provider_ids` (provider to athlete id)
so stats can find them.

- **Roster**, first that answers: the provider's team roster (ESPN, the league's own API) → the players in the linked games' box scores
  (AFL, where ESPN's roster is empty) → ChatGPT only when no provider carries the league and no games are linked.
- **Photos**, per person, first that has one: the provider's headshot (ESPN, MLB's) → another source's (the Premier League's, for its
  players) → Wikipedia by name and team → initials. Never ChatGPT.
- It happens on its own once the season's games are linked (no tap); Fill in who's playing stays only for the ChatGPT case.

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

1. **The interface and ESPN**: `src/lib/server/sports/` with the provider interface and its one adapter, ESPN (leagues from ESPN's own
   index, games on a date, rosters with headshots, box scores, season stats), and a cache (rosters a day, a finished game's box score for
   good); a dev check against the real ESPN (`scripts/dev-test/check-sports-data.js`, like check-show-art.js: real calls, no app server).
2. **Linking**: `season_events` (migration), matching episodes to events by date and team names; the World Series as the first real
   case; a check with fake-listings' World Series and a stand-in provider.
3. **Cast**: rosters from linked events, players only, headshots then Wikipedia; Fill in who's playing uses it first.
4. **Stats**: box scores per game, so far summed through the guard, coming in from season stats; the Players tab's lines.
5. **More providers: backlog** (docs/BACKLOG.md, "Sports data beyond ESPN"), when a gap shows.
6. **Spans** (the user's next idea) build on the links.

## Decisions (the user: costs stay at zero, 2026-10-27)

1. **No keys.** ESPN, MLB Stats API, NHL's API, Jolpica and OpenF1 need none. CricketData (free signup) only if cricket ever needs more
   than ESPN has. Nothing paid. TheSportsDB is out (free team lists stop at 10 players).
2. **API-Sports**: skipped (free is old seasons only).
3. **ESPN's terms**: unofficial, no published terms for this use. Use it, cache hard, credit ESPN in Credits, and keep the backups ready
   so a block isn't an outage.
4. **ChatGPT**: rosters only, and only for a league no source carries with no games linked; never photos, never stats.
