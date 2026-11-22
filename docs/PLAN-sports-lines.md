# Plan: sports lines (spreads, totals, moneylines, props, futures) and the games they make

> **Status (2026-11-22): Settled, not started.** Phase D of [PLAN-sports-couch.md](PLAN-sports-couch.md). ESPN only: no paid
> API, ever (the user). The answered calls are at the end. Sources checked live on 2026-11-22.

## The ask (the user, 2026-11-22)

"We should definitely consider how we can pull up to date over under, spreads, etc data so we can create games from those.
Including any common game types that only apply to sports and certain sports."

## What the app does today (read 2026-11-22)

- **One line per game, four fields.** `readOdds` (src/lib/sports/matchup.ts:52) keeps the provider, `details` ("PHI -4.5"), the
  total and the spread, from the scoreboard's `competitions[0].odds[0]` before a game or the summary's `pickcenter[0]` after.
  Stored in `sports_events.odds` (JSONB, migration 0300) with `odds_at`, read once a day with the scoreboard (the 2026-11-06
  decision in PLAN-start-a-game-gpt.md: "the daily odds read is enough").
- **The line a question opens with is kept for good** (`question_lines`, migration 0306; src/lib/server/question-lines.ts): per
  league, question and game; "Line coming" until one is read. Only totals are kept.
- **What uses it:** Over / under, Over/under pick'em, Prop sheet (its total), Same-game parlay, Betting pool. The spread is read
  and never used. Moneylines aren't read.
- **What waits on more:** Against the spread (Coming: no spread is kept, and a side is graded by who won outright), Tiered pool
  (golf: no odds per golfer), Salary cap and Budget fantasy (no prices), and BACKLOG 90 (a sport's draft ranked by projections:
  "find a source first"), which BACKLOG 229's computer players also need.

## What ESPN has (checked live, 2026-11-22: NFL Week 11, NBA, NHL, the Premier League)

All free, no key, the same hosts the app already uses, and one book: **DraftKings** (provider id 100).

| Where | What it holds | Seen today |
| --- | --- | --- |
| Scoreboard, `competitions[0].odds[0]` | The spread, total and moneyline, each with its **opening and current** value and price; favourite and underdog, and whether the favourite has changed since the open; soccer's draw. Dropped once a game is over. | Dolphins at Bills: Bills by 16.5 (opened 11.5), total 44.5 (opened 47.5), Bills -1580 (opened -600). Leeds v Coventry: draw +320, total 2.5 goals. NHL: the 1.5 puck line. |
| Core API, `…/events/{id}/competitions/{id}/odds` | The same, open and current, with keys for who won against the spread and the moneyline (`spreadWinner`, `moneylineWinner`), and a link to the props. | Keys present before kickoff; values after a game not yet seen. |
| Core API, `…/odds/100/propBets` | **Player and team props**, each with its line, its opening line and when it last changed. | **1,604 for one NFL game:** passing, rushing and receiving yards, receptions, tackles, milestone ladders (60+, 80+), first, last and anytime touchdown scorer, team totals, each quarter's and half's spread and total, "Will there be overtime?". **874 for one NBA game:** points, rebounds, assists and their combinations, threes, double-double, triple-double, first basket. Scorer markets came without prices in this read. |
| Core API, `…/seasons/2026/futures` | Season markets, a price per team or player. | **23 NFL markets:** Super Bowl, each conference and division, to make the playoffs, most wins, MVP and the other awards, the passing, rushing and receiving yards leaders. No win totals. |
| Core API, `…/odds/100/history/0/movement` | Line history. | Empty for the game read. |

**Not verified yet:** golf and UFC (their events were over), MLB (off-season), college. **Caveats:** unofficial and undocumented,
one book, can change without notice (as for all of ESPN in HOSTING.md). The answers carry DraftKings bet-slip links with tracking:
never shown, never followed, stripped on read.

## Other sources (web search, 2026-11-22; vendor pages: confirm on each official site before relying)

- **The Odds API:** 500 free credits a month; paid plans reported at about $30, $59 and $249 a month; a request costs a credit per
  market per region; props through its per-game endpoint on paid plans. Many books, so a consensus line.
- **Aggregators** (SportsGameOdds, reported $99 a month with a trial; OddsPapi and others): more books and markets, paid.
- **Prediction markets:** Kalshi's market data is public without a key (its quick-start docs). Its sports coverage and terms for
  showing prices in an app are unverified.
- **Enterprise** (Sportradar, SportsDataIO): licensed, priced for businesses.

**Settled (the user, 2026-11-22): ESPN only, and no paid API, ever.** Where ESPN has no line, or stops answering, the app makes its
own from stats (step 6). The sources above stay as a record of what was looked at, not as options.

## How fresh

A line matters at three moments: when someone sees it (a game's sheet, a pick), when a question opens (kept for good: unchanged),
and at the close (the sweat's "did you beat the closing line").
- **Reads:** a league's scoreboard (one call covers all its games) once a day for the next 7 days (today), **hourly** from 48 hours
  before a game, and **every 15 minutes** in its last 3 hours, but only for games a league has an open question on (injuries and
  weather move spreads and players' lines). Props: only for games a props game uses, on the same clock, two calls an NFL game.
  Futures: once a day.
- **Storage:** the whole line fits the existing JSONB (no migration). Props: only the markets a league's game uses (tens of rows a
  game, not 1,600). Futures: one row a market a day.
- **Rules first:** HOSTING.md gets the new calls before they ship (the 2026-10-28 source rule: free, vetted, settled once and stored).

## Rules: a line is information, never a bet

- Points, never money. No sportsbook links, logos or "bet" words on game screens; "Lines from DraftKings via ESPN" in Settings ›
  Credits, like the stats' credit.
- Plain words: "Bills by 16.5", "the total: 44.5 points", favourite and underdog in words. Prices appear only where a game scores
  by them, and then as points ("an upset here pays 9").
- No urgency: no "line moving, act now", no boosts. A moved line is shown as a fact, quietly, if at all.
- Spoilers: before kickoff a line gives nothing away. Who covered is a result, so it follows Hide sports scores.

## The games lines make

| Game | Sports | Needs | Status |
| --- | --- | --- | --- |
| **Against the spread** (pick'em where the favourite must win by more than the spread) | NFL, college football, NBA; MLB's run line, the NHL's puck line | the spread kept, then cover and push graded | Coming → step 3 |
| **Upset pick'em** (a right pick earns its odds in points, so an underdog pays more) | every team sport, MMA, tennis | the moneyline | New |
| **Over / under** on a game, every game, in a parlay | all | the total | Plays |
| **Player lines** (higher or lower on a few players' lines; all right earns a bonus) | NFL, NBA, MLB, NHL, soccer | props | New |
| **A real prop sheet** (a QB's yards, anytime touchdown, first basket) | NFL, NBA, NHL, soccer | props; a first scorer also needs the order of scoring plays | Prop sheet plays with the total; real props are new |
| **Futures pool** (Super Bowl, divisions, MVP), priced when you pick | NFL verified; NBA and others to check | futures | New |
| **Season call against the book** (round 2's season call, beside "to make the playoffs") | NFL | futures | New |
| **Tiered pool** (a majors pool: one golfer from each tier, favourites to long shots) | golf | each golfer's odds (unverified) or world ranking | Coming |
| **Salary cap / budget fantasy** (prices from projected points) | team sports, F1 | props as projections, or our own stats | Coming |
| **Draft rankings** for people and computer players (BACKLOG 90, 229) | team sports | props as projections | New |
| **The couch's line** (the middle of the couch's calls, beside the book's) | all | the couch's calls | New (round 2) |
| Confidence pool, with each game's line shown as help | NFL | the spread, shown only | Plays |

## Sports-only game types that need no line, by sport

Everything in Start a game's sports gallery (48 types; 34 play), plus what's common and missing (**new**):
- **Football:** Pick'em, Confidence, Head-to-head pick'em, Squares, Winner and margin, Prop sheet, the bracket, every fantasy kind
  (play). Survivor pool, Score predictor, First scorer (Coming; ESPN's summary lists scoring plays, which could settle the first
  scorer). **New:** an anytime-touchdown pool (a scorer a week, never twice), Monday night's total as a pool's tiebreaker, college
  bowl season as a confidence slate (to check).
- **Basketball:** categories and roto, the bracket, Squares (play). **March Madness bracket** (Coming: "college's tournament as a
  playoffs slate"; Selection Sunday is mid-March 2027, the biggest office pool there is). **New:** series length ("in 6").
- **Baseball:** Home run pool (plays), Beat the Streak (Coming). **New:** no run in the first inning (from the box score's first
  inning), a series call ("take 2 of 3").
- **Hockey:** Scorer pool (plays). **New:** series length.
- **Soccer:** Pick'em with draws (plays). Score predictor (soccer's most-played game), Last man standing, Knockout bracket (Coming).
  **New:** a World Cup or tournament sweepstake (teams drawn at random), both teams to score.
- **Golf:** Pick the winner, Pick three, Podium, Best ball, Tournament draft (play). One and done, Tiered pool (Coming). **New:**
  two golfers head to head.
- **Racing:** Pick the winner, Podium (play). Budget fantasy (Coming). **New:** teammates head to head.
- **MMA:** Fight card pick'em, Method of victory (Coming). **New:** the round it ends in.
- **Tennis:** Draw bracket, Pick the winner (play). **New:** the set score ("3–1").

## Steps

1. **Read the whole line** (S). `readOdds` keeps the moneyline (home, away, draw), the spread and total with their prices, open
   and current, and the favourite; a plain-words formatter. No migration. Checks on recorded answers (today's NFL and Premier
   League scoreboards into tests/fixtures/espn/).
2. **Fresher reads** (S–M). The hourly job reads a league's scoreboard for games in the next 48 hours, and every 15 minutes in the
   last 3 for games with an open question. HOSTING.md first.
3. **Against the spread and Upset pick'em** (M). `question_lines` keeps a kind (total, spread, moneyline): a migration. Grading
   for a cover, a push and a moneyline's points. Unblocks Against the spread, the run line and the puck line.
4. **Player lines** (M–L). Props read for games a props game uses; ESPN's prop names mapped to the stat keys box scores already
   keep; a Player lines game; the Prop sheet's real props. The same lines rank drafts (BACKLOG 90) and computer players (229).
5. **Futures** (M). Read daily; a futures pool; round 2's season call against the book; golf's tiers once golf odds are verified.
6. **Our own lines** (M). Where no book has one (a small college game, a lower league, a player without a prop): a line from the
   season's averages, labelled "our line".
7. ~~A second provider~~ **Dropped** (the user, 2026-11-22: no paid API, ever). Step 6 is the fallback.

Each step: a check on recorded answers through `fake-espn.js` with `zt-` rows, HOSTING.md, and every screen it reaches
(docs/UI-REVIEW-MAP.md). The games' screens go through the design process like any page.

## Decisions (answered 2026-11-22)

1. **Source:** ESPN only; no paid API, ever (the user).
2. **Line games:** against the spread with upset points, player lines (higher or lower, points-only, no payout language), futures
   pools, and rivalry stakes, all in (the user).
3. **A week's pool line:** a fixed weekly line for an against-the-spread slate pool (Wednesday noon ET for the NFL); a single
   game's question keeps today's rule (adopted default).
4. **Prices on screen:** words and points only, never American odds (adopted default).
5. **March Madness:** scheduled (the user): [PLAN-sports-couch.md](PLAN-sports-couch.md) E1, working by Fri 2027-02-26.
6. **Naming the book:** "DraftKings via ESPN" in Credits only (adopted default).
