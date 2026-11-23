# Add a show or team: search (sports-couch B3): the page spec (Intent, step 1)

2026-11-22, the `sports-couch` lane. Intent's `organize`, once. On round 1's search ("The sheet becomes "Add a show or team" with a
scope switch (All · Shows · Sports). Before typing, Sports shows the leagues as tiles and what's on now across them. Typing a strong
sports query (a team, two teams, a league) puts a rich card first … Weaker matches and shows follow as rows":
[sports-space-spec.md](sports-space-spec.md); its first-view R4: "every entry names sports"), the plan's B3 ("event sports in
results (dropped today); first run uses the same search (BACKLOG 43)"), and what's built since: a team's page (B2), a game's sheet
with Play (B4), a league's page (B1), Follow as a quiet fill with a check (A3).

## What's wrong today (before frames: `.ui-atlas/stories/search/before/`, real ESPN and the stand-in couch)

1. **A TV listing beats the team you meant.** "eagles" lists ten TV listings first (a 2019 Swedish show named "Eagles" counts as an
   exact match, which turns sports off the top), and the Philadelphia Eagles come eleventh. "giants" the same, and when the teams
   do come, the San Francisco Giants (off-season, "Next: Thu, Mar 25 12:00 AM", ESPN's unset time) come before the New York Giants
   playing Sunday.
2. **"nfl" lists ten shows named NFL** and the league itself last, above "Add "nfl" as a new show".
3. **Golf, Formula 1 and the UFC find nothing of sports**: their leagues are found and then dropped.
4. **A team is a text row.** The Eagles on now at the Jets read "ZTCF · Started 7:36 PM at Jets": no score story, no sign the couch
   follows them, no Follow, nothing to start; the row opens their page, which is the only clue there's more.
5. **The entry says shows.** "Add a show", "Search or add a show", "Everything on TV": a fan doesn't try a team there (round 1's R4).
6. **First run finds shows only** (BACKLOG 43): a new sports fan's "eagles" offers a Swedish drama.
7. **Before typing there's nothing of sports**: the couch's shows you don't have, never the couch's teams.

## The job

**Find what you mean (a show, a team, two teams, a league) and land where it lives in one tap, with the one thing it invites:
add a show with where you are, follow a team or league, play a game on it.** Search ends when you're on the show's Where are you,
a team's page, a league's page, or a game's sheet. It never becomes a second place to browse sports: the league's page is that.

## Where it lives

- **One sheet, "Add a show or team"**, opened from the hub's Your shows (its dashed row, renamed "Add a show or team") and the
  shelf's poster; the guide's header keeps "Add a show" (it's the TV guide, and its narrow bar) and opens the sheet on **Shows**.
- **First run's search is the same search** (BACKLOG 43): the same results and ranking, with the step's verb (Pick) for its actions.
- A result's tap closes the sheet and pushes the place (a team's page, a league's page), or opens the game's sheet over the screen
  (a matchup), or moves to the show's Where are you inside the sheet (shows, as today). Back from a pushed page returns to the hub,
  not to the sheet (the sheet is a picker, not a page; today's rule).

## The taxonomy: what a result is

| Kind | From | Opens | Its own action |
| --- | --- | --- | --- |
| Show here (Ready, on your list, the couch watches) | the catalog | Where are you (in the sheet) | (the row is the action) |
| TV listing ("Not a game yet") | TVmaze | Where are you | (the row) |
| A team | the leagues' lists, ESPN's search | the team's page | Follow |
| A matchup (two teams named) | the same | their next meeting's game sheet (B4: Play) | (the card is the action) |
| A league (team sport) | the lists' names, ESPN | the league's page | Follow |
| An event sport's tour (golf, F1, the UFC, tennis) | ESPN's search | nothing yet (its page comes with event sports) | none (see Open) |
| By name | the words | Add by name | (the row) |

**Strong** means one clear meaning: a matchup; one team at the top score that is a pro team (or, among ties, the only one in
season, or the only one someone on the couch follows); a league named exactly (score 100). A strong sports meaning gets a card;
everything else is a row.

## Scopes: All · Shows · Sports

A segmented switch under the field (three, never more). All is the default; the guide opens on Shows. It filters, it never
changes ranking within a kind, and it survives typing (the words stay when the scope changes, and the scope stays when the words
change). It's for a reader who sees the wrong kind first and for browsing sports before typing; most searches never touch it.
- **All**: the strong card (if any), then Shows, then Teams, then Leagues, then Add by name.
- **Shows**: today's results exactly (shows, listings, Add by name).
- **Sports**: the card, Teams, Leagues (event sports too); never Add by name (a show by name).

## Structure, in rank order

### Before typing

- **All:** (1) **Your couch watches**: the couch's shows you don't have, as today's poster tiles (four at most); (2) **Your couch
  follows**: the couch's teams you don't follow, a row each (a team mark, the team, "Riley's team" with Riley's face; three at
  most), Follow on the row. Nothing at all: one line, "Type any show, team or league."
- **Sports:** (1) **Leagues**: the major leagues as tiles, two to a row (NFL, NBA, MLB, NHL, college football, men's college
  basketball, MLS, Premier League; yours followed first and marked with the check), each with today's state from its calendar
  ("Week 12", "Off-season · back Mar 26"); a tile opens the league's page; (2) **Your couch follows** (as All).
- **Shows:** (1) as All's first group; nothing: "Type any show: what's here, and everything in the TV listings."

### Typing (All)

1. **The card**, only for a strong sports meaning:
   - **A team:** its mark, name and league (and its record once a final's in: hidden while hiding sports scores), the couch line
     ("Riley and Sam follow them", faces with names; "You follow them"), its game on now or next as **the shared scorebug** (R3:
     the same bug the strip, Scores and the team's page draw, through its spoiler ask), and **Follow** (the quiet toggle). The card
     opens the team's page; the bug opens that game's sheet (B4), where Play is.
   - **A matchup:** both teams' marks and names, their next meeting as the scorebug, "Their next meeting · Thu Nov 26", and the
     couch line when one side is a couch member's. The card opens the game's sheet (Play, Join if the couch already has a game on
     it). No meeting left: "No meetings left this season", and it opens the first team's page on their meetings (today's `against`).
   - **A league:** its mark and name, its state today ("Week 12 · 4 on now", "Off-season · back Mar 26"), how many on the couch
     follow it, and **Follow**. The card opens the league's page.
2. **Shows**: the catalog's first (here, Ready, on your list), then TV listings, five at most under a card, ten without one;
   "More shows" for the rest. A TV listing never outranks a strong sports meaning; a show here always does (a "Survivor" search is
   never about a team).
3. **Teams**: the rest, a row each (mark, name, league and its next game in words, never a score), the couch's teams first, then in
   season, then pro before college. College teams sharing the words ("Boston College Eagles" in baseball and basketball) fold under
   "More teams named Eagles · 11".
4. **Leagues**: team sports' leagues a row each with Follow (A3's row); event sports' tours a row each, said honestly (Open).
5. **Add by name** (today's), only when nothing here is the words exactly.

### Typing (first run, signed out)

The same ranking and card. Its action is **Pick** (the step's word, as a show tile's check): a team picked goes on the wall as a
team tile with the check, waits on the device with the shows, skips step 2 (Where are you is a show's), and is followed when the
account is made (saveFirstRun takes `teams` beside `follows`). No couch line (no couch yet). A league picked the same way.

## Situations, in rank order

| # | Who, when | First need |
| --- | --- | --- |
| 1 | Andrew types "eagles" on Sunday | the Eagles' card first: on now at the Jets (or Started, hidden), Follow |
| 2 | Conor types "eagles cowboys" for Thanksgiving | the matchup card; one tap to the game's sheet with Play |
| 3 | Joanna types "nfl" | the league's card first, Follow; the shows named NFL after |
| 4 | "giants" in November | the New York Giants (in season) as the card; San Francisco's a row with "Season starts Mar 26" |
| 5 | "survivor" | Survivor 51 first, as today; no sports group at all when nothing of sports matches |
| 6 | "bear": a show and a team | the Bears' card (strong), then The Bear first among shows, directly under it |
| 7 | "golf", "formula 1" | the tours, said honestly; shows named Golf after |
| 8 | Hiding sports scores | the card's bug says Started and asks (the bug's own ask); no record on the card |
| 9 | A new person in first run types "eagles" | the same card, Pick |
| 10 | Opening Add with nothing typed, on Sports | the leagues as tiles with today's state; the couch's teams |
| 11 | No match ("zzqx") | Add by name, and a line: "No team or league by that name either" only in Sports |
| 12 | ESPN not answering | shows as normal; the sports part says "Teams didn't load" with Try again, never a blank |

## The drill tree

| Level | Questions (casual · sweat) | Data held | Today | Verdict |
| --- | --- | --- | --- | --- |
| The sheet, empty | What can I add? · which leagues are on | couch shows, couch teams, leagues' calendars | couch shows only | **restructure** (Sports' tiles, the couch's teams) |
| A strong team | Is it them? Are they on? · their record | search hit, the team's schedule (B2's read), couch follows | a text row | **new display** (the card, the shared bug) |
| A matchup | When do they play? Play it | their next meeting | a text row ("Eagles v Cowboys") | **new display** (the card into B4's sheet) |
| A league | Is it the one? Follow it | the hit, LeagueNow | a row at the bottom | **new display** (the card), row kept for weaker |
| Other teams | Which Giants? | hits with next games | rows | **repaint** (season-aware words, college folded) |
| Event tours | Can I play golf? | hits (dropped) | nothing | **new** (an honest row) |
| Shows | as today | catalog, TVmaze | rows | **keep**: Add a show's rows and Where are you were designed in step 10 and work; only their rank against sports changes |
| A team's page, a league's page, a game's sheet | | | B2, B1, B4 | **keep** (approved this week) |

## Left out, and why

- **Athletes and cast in search**: no athlete index (the plan's "not in this plan"); a later group.
- **Recent searches**: Add is used a few times a season; not worth the clutter.
- **Live scores in rows**: rows never score (a row is no place for a score: today's rule); only the card's bug, through its ask.
- **A search page of its own**: the sheet ends at a place; browsing sports is the league's page.

## Open (for the user)

- **Event sports' tours: listed only, or Follow now?** Nothing in the app can open a tour yet (no page, no games from the hub). The
  spec lists them with "Its page comes later" and no action (the no-interim-builds rule). Follow now would put a league card on
  Your shows that opens nothing yet.
