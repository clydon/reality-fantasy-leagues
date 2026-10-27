# Plan: sports data from APIs (rosters, photos, stats), ChatGPT last

Status: **steps 1-4 and 6 built** (2026-10-27, not deployed yet): the provider interface, ESPN and its cache, a sport season's
episodes linked to ESPN's games, its players from them, their stats from the games' box scores (the real 2026 World Series
links, its Players tab is both teams' 52 players with ESPN's headshots, and each has so far through your mark and the 2026 regular
season coming in), and a game over a span: just the next one, this series, or through any later episode (As built, below). Step 5
(more providers) waits in the backlog until a gap shows. **First build: ESPN only** (the
user, 2026-10-27): ESPN behind the provider interface, Wikipedia for missing photos, ChatGPT for a roster only when ESPN has none.
Every other source, the chain's tests (1b) and the circuit breaker wait in docs/BACKLOG.md until a gap shows. ChatGPT never fills
in stats: the paused bot-stats code (`BOT_STATS`) is gone; Fill in who's playing still asks our bot, for players only, when ESPN
hasn't got the games.

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

1. **The interface and ESPN** (built 2026-10-27): `src/lib/server/sports/` with the provider interface and its one adapter, ESPN (leagues from ESPN's own
   index, games on a date, rosters with headshots, box scores, season stats), and a cache (rosters a day, a finished game's box score for
   good); a dev check against the real ESPN (`scripts/dev-test/check-sports-data.js`, like check-show-art.js: real calls, no app server).
2. **Linking** (built 2026-10-27): `season_events` (migration), matching episodes to events by date and team names; the World Series as the first real
   case; a check with fake-listings' World Series and a stand-in provider.
3. **Cast** (built 2026-10-27): rosters from linked events, players only, headshots then Wikipedia; Fill in who's playing uses it first.
4. **Stats** (built 2026-10-27): box scores per game, so far summed through the guard, coming in from season stats; the Players tab's lines.
5. **More providers: backlog** (docs/BACKLOG.md, "Sports data beyond ESPN"), when a gap shows.
6. **Spans** (built 2026-10-27; the user's idea) build on the links: a game from the next episode through a chosen one.

## As built

### Steps 1 and 2 (2026-10-27): the provider interface, ESPN, the cache, and linking

- **`src/lib/server/sports/`.** `types.ts` is the interface every provider answers: `leagues()`, `eventsOn`, `roster`, `boxScore`,
  `seasonStats` as planned, plus **`find(text)`**, the provider's own search for teams and leagues, which is how a season's league is
  found with no table of leagues. A league's id is the provider's own handle: ESPN's path (`baseball/mlb`, `australian-football/afl`,
  `soccer/eng.1`, `racing/f1`), read from its search (each hit's sport and league slug) or its index (the refs' slugs). `espn.ts` is
  the adapter; its readers (scoreboard, search, roster, box score, season lines) are pure and tested on trimmed real answers
  (`tests/sports-espn.test.js`). A box score is the provider's tables in its own columns: baseball's batting and pitching, AFL's one
  table; soccer has no `boxscore.players`, so its match sheet (each player's stats on `rosters`) is read as one table per team. An
  event in parts (an F1 weekend) keeps each part's field with places. Season lines are every category ESPN shows by default for that
  year (Yandy Díaz 2026: Career Batting, the regular season, apart from Postseason Batting). `index.ts`'s `sportsProviders()` is the
  chain: ESPN alone, through the cache.
- **The cache** (`cache.ts`, `sports_cache`): Postgres, because a function's memory doesn't outlive its request and Vercel's data cache
  is over its free storage. Answers are stored as read (a World Series box score ~9 KB; ESPN's raw summary ~1 MB is never kept). Keep
  times come from the answer: searches and the index a week, a day's games 3 minutes while one is on, 30 days once the day is two days
  gone and all over, else an hour; a final box score for good; a roster or season line a day. When ESPN doesn't answer, the last answer
  is served (stale beats nothing); a broken cache never breaks a call. The daily listings job prunes rows a week past their time.
- **Linking** (`link.ts`, the pure half `src/lib/game/sports-match.ts`; migration 0148 `sports_links`, `season_events`). The season's
  league: the sides its titles name (`matchupOf`: "Game 1: Tampa Bay Rays at Milwaukee Brewers" → the Rays, the Brewers; a label
  before a colon, brackets and a dash's tail left off) are searched, each team hit a vote for its league (3 for an exact name, 2
  otherwise), the show's own name 1 a hit (a sport of individuals: "Formula 1"); the top four leagues are tried on up to three of the
  season's days (the latest aired first), and the first most of them fit wins. Each episode is then the event on its Eastern day (then
  the day before and after) that fits its title and starts within 36 hours of it: a game between teams when the title names every team
  by any of the provider's names for it ("Rays", "Tampa Bay"), a field's event by the telling words it shares with the title (the
  show's own name and a generic list of words that only say when or join two names never count), the nearest of equal fits. Also: a
  title that names no one ("Game 5") takes that day's game between the season's teams; **a game is one episode's** (a listing that
  moves Game 2 onto Game 3's day doesn't take Game 3's game); a link whose episode moved 36 hours or more from its event is redone;
  an event in parts links the part that started last by the time the episode airs. Each link keeps the event's name, start and teams
  (`[{ id, name }]`, for step 3's cast). Episodes up to a week ahead are linked (tonight's Game 4 was already on ESPN).
- **When it runs.** After the answer when someone adds a sport whose season was just made or read again (`add-show.ts` `linkLater`;
  only with the real TVmaze, so a check's stand-in listings never reach ESPN), and in the daily listings job (`linkSportSeasons`: sport
  seasons on now or finished in the last fortnight with episodes still to link, at most 20 a run). `sports_links.next_at` says when to
  look again: the next day while some are missing, a week on when no provider has the season, an hour on after an outage, else when
  the next episode comes within the week; sooner when the season's listing changes. A show that isn't a sport is never looked at.
- **The first real case, the 2026 World Series** (TVmaze show 20637, season 2026): Games 1-4 linked to ESPN's 401908042-401908045 in
  baseball/mlb, 7 ESPN calls in 1.4 s (three searches, four days' games), and none when linked again. Games 5-7 aren't listed by
  TVmaze yet; they link on the daily run after they are.
- **Checks.** `scripts/dev-test/check-sports-data.js` (the real ESPN, no app server: the World Series' Game 1, the AFL Grand Final,
  the United States Grand Prix, a Premier League day, the Celtics, the cache, `--leagues` for the index; 43 PASS). `check-sports-links.js`
  (on stand-ins: fake-listings' `worldSeries()` made into a season by the app's own `listedSeason`, and the new `fake-espn.js` with
  decoy leagues; 20 PASS), `--real` (the real World Series against the real ESPN) and `--server` (a throwaway `zt_sports` adds the
  World Series through the dev server and its season is linked after the answer). Unit tests: `tests/sports-match.test.js`,
  `tests/sports-espn.test.js`.
- **Found on the way:** ESPN's site host answers 403 to a User-Agent with a URL in it, so ours is a bare `GameYourShow/1.0`.

### Step 3 (2026-10-27): the cast from the linked games

- **`src/lib/server/sports/cast.ts`** (migration 0149: `season_cast.provider_ids`, `cast_fills.via`). The teams in a season's
  `season_events` (their `teams`), in the order they first play, each give their players: the provider's team roster (players
  only: ESPN's coach is apart), else, for a team with no roster (AFL's on ESPN), whoever played for it in the season's linked games
  so far, from their box scores; a team with neither yet is **waiting** for its first game. A field's event (a race) gives the
  field of the part its episode shows, as one group, "Field". Each person is written with the team as their group, the position as
  their role, the provider's headshot and `provider_ids` (`{"espn": "33481"}`, for step 4). It only adds (whoever's missing, by the
  provider's id, else by name) and never removes, and only for a sport nobody's made a game of whose people are none yet or came
  from here: a game's cast, and people our bot or a paste filled in, are never touched. Wikipedia (show-art.ts `fillCastPhotos`,
  now with `only`) is asked only about people it just added without a headshot; initials for anyone it doesn't find. It holds the
  season's fill (`cast_fills`, `via` 'sports') while it runs, as Fill in who's playing's ask does.
- **Headshots at a face's size.** ESPN's full headshots are ~210 KB each (a team's roster megabytes), so the adapter stores them
  through ESPN's own resizer (`espn.ts sizedHeadshot`: a 160 px square crop, ~36 KB), hotlinked like TMDB's and Wikimedia's.
- **When it runs** (`sports/season.ts`, which now holds `linkLater` and the daily job's `linkSportSeasons`, moved from link.ts):
  `followSeason` links a season, then fills in its people. After the answer when someone adds a sport; in the daily listings job
  (it counts the people it adds); and from the Players tab's own read (`rosters.ts rosterOf`): a sport whose people can come from
  its games gets them after the answer (the page polls while it's going, "Getting who's playing"), the first time, when a linked
  game has ended since the last fill (so box-score teams fill in as they play), an hour after the provider didn't answer, or, when
  nobody's linked it yet, by linking it first (once it's due: `sports_links.next_at`). A quiet fill adding to a roster already
  there doesn't show as going.
- **Fill in who's playing** is offered only when the sports data hasn't got the season's games (the card says "ESPN doesn't have
  these games") or didn't answer for them. Its tap asks the sports data first, at once (linking the season again and filling it
  from its games: a few cached calls), and only then our bot, after the answer, as before. Games linked whose teams haven't played
  yet wait for them, never the bot ("The players show up once they've played").
- **Credit.** The Players tab says "Players and headshots from ESPN" under a roster the sports data brought, and Settings ›
  Credits has ESPN ("Game Your Show isn't connected with ESPN").
- **Checks requests can't get wrong.** `sports/index.ts sportsFor(req)`: under `next dev`, a stand-in ESPN named by a request's
  `x-gys-sports` header, and no sports data at all for a request from a check's stand-in world (its `x-gys-listings` or
  `x-gys-bot`), so check-show-words.js and the rest never reach the real ESPN; a stand-in's answers are cached under their own
  keys (`zt-standin:`), never ESPN's own. Production never reads the headers.
- **The real World Series:** 26 Brewers and 26 Rays, every one with ESPN's headshot and id, no manager, in 2 ESPN calls (241 ms).
- **Checks.** `check-sports-links.js` grew step 3 (41 PASS on stand-ins: rosters, a footy season filling from box scores through the
  Players tab's own read and waiting on a team that hasn't played, a race's field, the tap's sports-first fill, a game's cast and a
  bot's left alone); `--real` checks the real World Series' people; `--server` adds it through the dev server, reads the Players
  tab, opens the page at 390 px (both teams, headshots loaded, the credit, nothing wider than the screen; screenshots to
  `--shots`) and Settings › Credits, then on stand-ins (fake listings, an empty ESPN, fake-bot.js) a sport ESPN hasn't got: the
  tab looks for it, then the tap asks the bot. `fake-espn.js` gained box scores, headshots and race fields. check-show-words.js
  (the bot's roster) still passes.

### Step 4 (2026-10-27): stats from the box scores

- **What's stored** (migration 0150): `game_lines`, each player's line in each linked game, keyed by the provider's id for them
  (`season_cast.provider_ids`, so a line is written whether or not they're in the cast yet, and matched at read), in the provider's
  own tables and columns (a hitter's `batting`, a pitcher's `pitching`, both for a two-way player; AFL's one table). Episode 0 is
  coming in, with its `label` ("2026 regular season"; `[]` when the provider has none, so nobody's asked twice).
  `season_events.lines_at`/`lines_final`: a final game's lines are never read again; a redone link resets them, and an episode
  that loses its link loses its lines.
- **The fill** (`src/lib/server/sports/stats.ts statsFromEvents`): each linked game 3 hours after it starts and not final (again at
  most every 10 minutes while it isn't; given up two days on if the provider has nothing): its box score (`sportsProviders()`,
  through the cache), or, for a field's event, each one's place in the part its episode shows from that day's scoreboard (ESPN's
  F1 summary 404s), written as `1st`, `2nd` so a place never adds. Then **coming in** for whoever from the sports data has none:
  the first linked game's season and **stage** (new on `SportsEvent`, from ESPN's season slug: `regular-season`, `post-season`,
  `preseason`; a soccer league's own season slug says none) pick the season (`sports-stats.ts comingInSeason`: a postseason's own
  regular season, else the season before, since a regular season's own line holds the very games shown). `seasonStats` now answers
  the regular season only: ESPN's `postseason-*` categories are left out (Yandy Díaz's postseason line held the World Series'
  games), and its main category is kept (a hitter's batting, a pitcher's pitching). One call a player, 4 at a time, at most 60 a
  run. `stat_fills` (0145) is its hold.
- **When it runs**: from the Players tab's read, after the answer (`rosters.ts`: chained after a cast fill, or alone when
  `statsDue` says a game's over or someone has no coming in; `statsLater`). The page polls every 4 s while it runs and the stats bar
  says it's getting the latest. Not in the daily job: a season nobody opens costs nothing.
- **What adds** (`src/lib/game/sports-stats.ts`, pure, `tests/sports-stats.test.js`): read from the values, never a list. Whole
  numbers add (H, K, D, G, a `+/-`); `x-y` pairs of them add both sides (`H-AB` 0-4, 0-5, 2-4 make 2-13); anything else doesn't
  (AVG, ERA, IP in thirds, a time, a place). A count that's half of a pair column (`H` and `AB` of `H-AB`, `PC` of `PC-ST`) is left
  to the pair; a count of 0 is left out (a pair is kept: 0-4 says something). A table where nothing adds (a race) lists its places
  race by race, the last five.
- **Through the guard**: the read fetches only lines up to your mark (`seenThrough`) plus coming in, so a later game's never reach
  you; `through` is the latest seen game with lines, `newer` the latest past it ("Game 3's stats open once you've seen it", or
  "Games 1-3's ... as you see them" from the start). Coming in shows the main category in the columns the season's box scores show
  (so `GP`, `WAR`, `SO`-vs-`K` drop out): Yandy Díaz's "614 AB · 93 R · 180 H · 22 HR · 85 RBI · 56 BB · .293 AVG · .359 OBP ·
  .446 SLG".
- **Held back until seen** (Noticed in step 3): someone a box score brought in (a team with no roster: AFL's) carries
  `season_cast.shown_from`, the episode that brought them; the Players tab shows them once you've seen it, says "More players show
  up once you've seen Round 2" (or, with nobody shown yet, "The players show up once you've seen Round 1"), and a team that's
  played but is held isn't listed as waiting to play. A race's field is added by name, no longer in the order it finished.
- **The Players tab keeps its two lines**: so far ("Thru Game 2 · 0-9 H-AB · 1 R · 3 K · 39 #P") and coming in, each wrapping
  to two lines at most, a value kept with its label; the stats bar (no ask, no paste: ChatGPT never fills in stats); the credit
  says "Players, headshots and stats from ESPN".
- **ChatGPT's stats code is gone** (plan section 5, Decision 4): `statsPrompt`, `readStats`, `pendingStats`, the ask and paste, their
  route actions and client calls, and their tests. `cast_stats` (0145) is no longer read or written (kept; dropping it is Noticed).
- **The real World Series** (`--real`): Games 1-3 and all 52 players' 2026 regular seasons in 55 ESPN calls (3 box scores, 52
  season lines; 1.2-3.6 s), none on a second run. Yandy Díaz: 0-4 after Game 1, 2-13 through Game 3, .293 coming in (not his .269
  postseason); Nick Martinez's Game 1 start "5 H · 2 R · 2 ER · 5 K · 73-52 PC-ST". 48 of 52 have a so far by Game 3. Storage:
  ~10 KB a game, ~420 bytes a player for coming in (HOSTING.md).
- **Checks.** `check-sports-links.js` (79 PASS on stand-ins: `fake-espn.js` gained season stages, box scores with batting and
  pitching tables, and athletes' season lines with a postseason category to leave out): the three games and seven season lines
  asked and nothing asked again; so far and coming in at marks 0, 1, 3, 4 (H-AB as a pair, IP never summed, someone who first
  played in Game 2 has nothing at Game 1); a live Game 4 read, not again for ten minutes, then final; a game moved off its link
  losing its lines and getting them back; the Players tab's read filling a game in; footy rounds added up and its players held
  back until seen; a race's places. `--real` (above). `--server` (the dev server, 390 px): zt_sports at Game 2 sees "Stats through
  Game 2", Game 3 waiting, Yandy Díaz's two lines, both lines on most players, no line over two rows, the credit, nothing wider
  than the screen (screenshot `players-stats-390.png`). `check-show-words.js`: a roster our bot filled in has no stats at all.
  Unit tests: `tests/sports-stats.test.js` (real Games 1-3 lines), `tests/sports-espn.test.js` (the stage, regular-season lines).

### Step 6 (2026-10-27): a game over a span

- **The smallest version: an end.** A game already started at the next episode to air (`settings.startEpisode`); a span adds its
  last one, `settings.endEpisode` (in the league's state: no migration). Null is today's game, to the season's end. A span that
  starts later (post-merge, just the playoffs) is a game started when it's next, so nothing here picks a later start.
- **The engine** (`state-logic.js`): `endEpisode`, and `inPlay` is now start through end, which already gated a lineup's points,
  a pool's picks, waivers' points and the lineup form ("This game ended with episode N"). `spanView` is the league as its span saw
  it: `SpoilerLogic.viewThrough` at the end, the guard's own trim, so `ScoringLogic.compute` scores every kind of game as it stood
  at its last episode (Outlast's boot order, which reads no episodes, included; a side bet after it doesn't pay). `gameOver` is
  `seasonEnded` or the last episode in. `currentEpisode` is null past the end (no lineup, pick or reminder: `db/reminders.js`
  returns on it). No episode is made past a finished span, no waiver week opens after its last episode (`isWindowEpisode`,
  `due`), and the pool's history and the predictions to-do count its episodes only. `viewFor` itself isn't cut: the season's own
  pages (`season-episodes.ts`, `season-stats.ts`) read your first league's view, and a span mustn't hide the season's results.
- **The choices** (`src/lib/game/spans.ts`, pure; read from the season, for any show): the rest of the season (first, the
  default), just the next one when the listing has it, any later listed episode as the end ("Through"), and, for a season whose
  episodes are linked to games (`season_events`, step 2), "This series": the consecutive linked games between the same teams
  (either way round). `start-game.ts` sends them (`spans`, `ends`), takes `to` (an end the listing has, from the start, else a
  400), sets `endEpisode`, says it in Recent changes ("started Survival Pool for Episode 6") and in Tell the couch's push ("for
  Games 4–6").
- **Where it shows.** Start a game's **How long** (`couch/start-game.tsx`): the presets as choices and a native list for
  "Through", the sheet's title saying the span ("ZT Survivor · Episodes 6–7"). The Games tab leads each span game's line with it
  ("Episodes 6–7 ·", then "Final · Episodes 6–7"), and the line under the tables is the running games' (a finished span game stays
  at its end). The game's rules say it ("It ends with Episode 7: nothing after it scores"); an episode after it reads "After the
  game ended"; the couch's join list says "Episode 6 only." and a finished one refuses ("That game's over"). `Game` (show space,
  home), `GameView` (`to`, `over`) and `JoinGame` carry it.
- **Scored outside the state** (Weekly Calls, Weekly Bingo): `callRights` and `bingoLines` count from its start through its end,
  `endedThrough` takes the end, no call or card is asked for past it (`leagueCalls`, `leagueBingo`, home's `weeklyCallMoves`), and
  Tonight's Call it and bingo come back once your game there has ended. The couch hub and the joins call it over at its end
  (`gameOver`), so the trophy shelf has it.
- **Results pushes**: a span game says nothing about an episode after its last (another game on the season tells them).
- **Checks.** `tests/spans.test.js` (8: the choices and a series from linked games, the engine's end, Outlast/Weekly
  Lineup/Survival Pool scoring stopping there, waivers, game over). `scripts/dev-test/check-spans.js` (33 PASS, the dev server,
  new-fixture's couch, 390 px): How long's choices (and This series from linked games added to the season), refused ends, a
  Survival Pool for just Episode 6 and a Weekly Lineup over Episodes 6–7 started in the sheet, Episode 6 then 7 coming in (each
  over at its end, the pool's table standing still, nobody new joins, the couch hub, home asking nothing), the Games tab before
  and after (screenshots), nothing wider than the screen. `check-new-start-game.js` still passes.

### Step 6, follow-up (2026-10-27): Run it back on the next span, plaques that name it, and its end in Game settings

- **Run it back on the next span** (`spans.ts nextSpan`, pure): from the next episode to air, the next series when the finished
  game was one (its linked games all between the same teams), else the same number of episodes again, as far as the listing
  goes (the next series only partly listed: what's there). The couch hub's Run it back (`start-game.ts runItBack`) offers a span
  game that's over on its own season's next span ("ZT Survivor 51 · Episodes 8–9"), the latest of each kind, until a game of its
  kind has started there since it ended (`Game.start`, new on the show space's games, home's and the joins'); a span on a season
  still airing never gets the next season's offer. `startOptions`'s `again` carries the next span's end (`again.to`) and says
  which it was ("Episodes 6–7"; with the season when it was another season's); the sheet starts on it, titled "ZT Survivor 51 ·
  Episodes 8–9 · the same Weekly Lineup as Episodes 6–7". The Games tab's row is "Run it back · Episodes 8–9" after a finished
  span of yours, on to the next one once that's run back. A span run back onto another season (the next season's offer) runs
  the same rule there.
- **Plaques name the span**: `GameStanding.span` (couch-hub.ts, in the show's own word: "Games 4–6") and `Plaque.span`, under the
  season's label on the trophy shelf; a season's spans newest-ended first. "Ran it back" counts winning the season's previous
  span of the same game too, and its record says "World Series 2026 · Games 1–3 and Games 4–6".
- **Game settings' How long** (`backstage-games.ts`, `backstage/settings.tsx`): every game's span ("Episodes 6–7", or "Episode 6
  to the season's end") and, while it isn't over, an Ends list: the season's end or through any episode still to come, from its
  start, that the listing has (`GameSettings.span.ends`; a game scored outside its state counts what's aired). `endEpisode` is
  one of `SETTING_FIELDS`, so it's a Commissioner's, one batch with Undo and a line in Recent changes ("Changed how long Weekly
  Lineup runs: through Episode 8"), and Lock it down freezes it. Once it's over: "Final · Episodes 6–7", nothing to change (409).
- **Checks.** `tests/spans.test.js` (9: `nextSpan`), `tests/couch-standings.test.js` (spans' plaques, ran it back across spans).
  `check-spans.js` (65 PASS): the end moved to Episode 8 and back by Undo (in the browser, the toast's), refused before its start,
  as a string, past the listing, for a player who doesn't run it, while locked down, and once over; plaques Episode 6 and Episodes
  6–7, later-ended first; the hub's Run it back for each on Episodes 8–9 and Episode 8; the sheet set to Episodes 8–9; running it
  back takes it off the hub and the Games tab's row moves on to the pool's; the trophy shelf at 390 px (screenshots).
  `check-new-start-game.js`, `check-new-hub.js` and `check-new-backstage-ii.js` still pass.

### Noticed, not fixed

- **Spans, step 6** (backlogged: docs/BACKLOG.md item 10): The classic app's catch-up reveal (`RevealLogic.isComplete`) and Backstage's open episodes (`backstage.ts`
  `takes`) don't know the end. A side bet proposed after a span's end goes on a later episode and never pays
  (`BetLogic.addToUpcoming`). How it works' updates say only where a game starts. A game's start can't move (only its end, in
  Game settings). Run it back's "same length again" counts episodes, not air dates (a span over a double-header night is two).
  The start sheet uses the rulebook's word for an episode (`partWord`) and the hub and plaques the show's (`episode_term`); they
  agree on every show here, but a rulebook that says "event" for a show that says "Game" would read both. `check-spans.js` and
  `check-new-start-game.js` print `[push] bingoLine ...
  undefined (reading 'pool')` when they apply results in their own process (a jiti import cycle in `bingo.ts`'s push; not new,
  harmless to the checks).
- **No per-game tap** (section 4's "a tap for each game's line"): the tab keeps its two lines, so a game's own rates (AVG, ERA)
  and a pitcher's innings (IP is in thirds, so it never adds) show only in coming in. A tap with each seen game's line (from
  `game_lines`, up to the mark) is the place for them, if wanted.
- **The hold-back is the Players tab's only**: Calls, polls and other cast pickers (`season-cast.ts`, `polls.ts`, `calls.ts`) list
  everyone in `season_cast`, so an AFL player a box score brought in could show there before you've seen that round. AFL only, today.
- **Coming in is one call a player** (60 a run): fine for a series' two teams, slow for a league-wide cast (an NFL season's ~1,700
  would take ~30 reads of the tab). ESPN may have a by-team stats listing; untested. Pairs with step 3's "a regular season grows
  its cast team by team".
- **Coming in is the provider's main category, its last row**: a two-way player's other category, and a traded player's line for
  his earlier team, are left out (step 3 noticed the first).
- **A live game's lines** show to someone whose mark is on that game (marked seen while it's on): they're its lines so far, read
  again every 10 minutes on a read.
- **`cast_stats`** (0145, our bot's snapshots) is unused since step 4; a later migration can drop it (`stat_fills` is the sports
  fill's hold now).
- **A sport ESPN hasn't got has no stats** (ChatGPT never fills them in, Decision 4): its Players tab shows the bot's roster only.
- **A regular season grows its cast team by team**: a show of one game a week ends up with every team's roster (an NFL season ~1,700
  players). The Players tab would want a team filter, or the cast only the teams in the games you've seen, before that happens.
- **Nothing is ever taken out**: a player traded mid-season stays on his old team, and a roster is read again only when a fill runs
  (a linked game ended, cached a day). Two players with the same name on different teams: the second is left out (season_cast is
  unique by name).
- **Make it a game on a sport whose players came from ESPN** adds the game's cast on top of them (make-game.ts: names already there
  kept, with ESPN's ids). Whether a game starts from the ESPN roster is for the spans work (step 6) or Make it a game to decide.
- **People our bot filled in stay as they are** when the season's games are linked later (never merged by name).
- **Season lines are ESPN's default categories only** (a pitcher's pitching, a hitter's batting): a two-way player's other category
  needs ESPN's `?category=`. Step 4 keeps only the main one for coming in; if it ever matters.
- **College scoreboards** list ESPN's default selection (no `groups`), so not every college game is on them: a college season may link
  only its bigger games. When a college sport comes up.
- **Days are Eastern**: `daysFor` asks the Eastern day, then the day before and after, which covers ESPN (whose days are US days, even
  for the AFL). A provider on another calendar would want its own day (with a second provider).
- `check-show-words.js` builds its own ZT World Series from the stand-in F1 show; it could use fake-listings' `worldSeries()`. Left.

## Decisions (the user: costs stay at zero, 2026-10-27)

1. **No keys.** ESPN, MLB Stats API, NHL's API, Jolpica and OpenF1 need none. CricketData (free signup) only if cricket ever needs more
   than ESPN has. Nothing paid. TheSportsDB is out (free team lists stop at 10 players).
2. **API-Sports**: skipped (free is old seasons only).
3. **ESPN's terms**: unofficial, no published terms for this use. Use it, cache hard, credit ESPN in Credits, and keep the backups ready
   so a block isn't an outage.
4. **ChatGPT**: rosters only, and only for a league no source carries with no games linked; never photos, never stats.
