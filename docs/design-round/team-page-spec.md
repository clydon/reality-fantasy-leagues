# A team's page (sports-couch B2): the page spec (Intent, step 1)

2026-11-22, the `sports-couch` lane. Intent's `organize`, once. On round 1's line ("A team's page (restructure of the team sheet).
A full page rather than a sheet over a season page. The team's plate, record, Follow with the couch's faces; the live or next game;
then Schedule as a sports app shows it: results and coming games together, by month, the bye named, W/L with scores (behind Hide
scores when it's on), the season so far folded to its form strip. Daily sports get a Month view (a calendar) beside List, with
series, homestands and road trips grouped and playable as one": [sports-space-spec.md](sports-space-spec.md)), round 1's first-view
R3 ("one game row everywhere") and BACKLOG 254 (m) (the shared game row on a team's schedule), step 2.8's approved Start a game on
rows ([sports-scope-spec.md](sports-scope-spec.md), decisions.md 2026-11-21), and Standings' note that "a team's record by week,
graphed" belongs here ([league-standings-spec.md](league-standings-spec.md)). C2 adds the fan card later; this page leaves its place.

## What's wrong today (before frames: `.ui-atlas/stories/team-page/before/`)

1. **A sheet titled "A team"** over whatever opened it (a league's page, the guide, a cast list). The team's name is the second
   thing; the sheet can't be linked, shared or come back to, and Back closes it rather than going where you were.
2. **Eight W/L tiles** are the only picture of a season: no margins, no order beyond the last eight, no bye, nothing to compare.
3. **The schedule is three different lists**: Coming up (five, then months folded), the rival filter's meetings, and Earlier
   (folded, newest first). A game's result and a game to come never sit in one list; a month shows only what's left of it.
4. **The game rows aren't the app's game row.** A league's Scores and the hub's strip draw the scorebug; the team sheet draws its own
   GameRow, with its own spoiler handling (an eye on every hidden row).
5. **A daily sport's 82 or 162 games** become "Coming up · 41" then a column of folded months: no calendar, nothing grouped (a
   homestand, a road trip, a series), nothing that says "they're away for two weeks".
6. **The rival chips** filter the lists below them from above Start a game on's rows, so a filter and a start read as one group.

## The job

**Everything about one team in one place: is it on, when's the next one, how's the season going, and a game on any of it.** A
team's page is where a fan lands from a league's table, a scorebug, a cast list's team or search. A league's page answers "what's
the couch doing in this league"; this answers "what's my team doing", the conventional team page of every sports app (name, now,
schedule), with the couch on it (who follows them) and Play.

## Where it lives

- **`/league/<sport>/<code>/team/<id>`** (routes.ts `paths.team`), depth 2: up is the league's This week; Back goes where you came
  from (the app's rule). A full page with its own bar (Back, Follow), no league tab bar (it isn't a tab: the league's tabs are one
  Back away).
- **Every door that opened the sheet opens the page:** This week's table rows, Standings' "Open the Eagles ›", the guide's Sports,
  a cast list's team heading, a roster's team, search's team row and Add's team step (the sheet closes, the page opens: as B1 made
  Add's league pick open the league's page). `openSports({ kind: "team" })` goes; the game sheet (`kind: "game"`) stays a sheet
  (B4 redesigns it) and its "Back to the team" becomes plain close (the page is under it).

## Structure, in rank order

1. **The bar:** Back, Follow (A3's toggle, quiet fill when on). Under it **the team's plate** (the lower third: the colour's tag,
   the name, never "A team"), and its small line: the league, the record and the place where the standings read has it ("NFL ·
   7–3 · 1st NFC East"; football's own words: the standings' group name). Then **who follows them** on the couch (faces and one
   line, today's words, and Make them your team where it applies), the fan card's place (C2) right under it.
2. **Now:** the game on now, else the next game, as **the shared scorebug** (wide: both teams named, the status column: the clock,
   or the day, time, network and the line in words). A tap opens the game's sheet. Before kickoff, **Play the next game** under
   it, the one yellow (one tap: Pick'em on it, the couch told after Undo: unchanged). While a game is on, the bug is live and Play
   moves to the game after it. No game left: one line ("Season over · their last game Jan 4"), and next season's first game when
   ESPN lists it.
3. **The season:** the record and streak in words ("7–3 · won 2"), then **a bar per game in date order**: up for a win, down for a
   loss, the height its margin, a tie a tick on the line, the bye a gap with "Bye" under it, games to come as faint ticks so the
   season's length reads (football's 17; a daily sport's 82 or 162 as hairline bars). This is the team's record by week, graphed
   (Standings' note) and the drill-down's weekly graph (the round's frame). One tap on a bar opens that game's sheet (a 44 px
   target where the bars are wide enough; a daily sport's are read, not tapped: the schedule holds the games).
4. **Start a game on** (step 2.8's rows, kept): The next game · Their season · a series still to finish (up to four). Quiet rows.
5. **The schedule:** one list of the whole season, results and games to come together, in date order, by month.
   - **Against** (a filter, inside the schedule's head, not above Start): All games, then the couch's teams they play, then More
     (every opponent). Choosing one filters the list to their meetings and puts "Every Giants game · 2 left" (2.8's meetings
     scope) at its top. Today's rival chips move here.
   - **Opens on the current month**, whole (this month's results and this month's games to come); later months open; **earlier
     months folded** under one row ("Earlier · Sep–Oct · 8 games"), since the season graphic above already tells them. A month
     with more than about 16 games after the next month (a daily sport) folds to its heading and count.
   - **A row is the shared game row from the team's side** (see "The game row" below): day and date, the opponent's mark, "vs
     Giants" / "at Giants", the status column (W 24–17 or L, the time and network, Live with the clock).
   - **The bye:** a row in its week's place, "Bye · Week 10" (football: a week of the league's calendar the team doesn't play,
     between its first and last game).
   - **A daily sport's runs:** three or more home games in a row are a **homestand**, three or more away a **road trip**: a thin
     heading inside the month ("Road trip · 5 games · Dec 2–9"), and, while any of it is to come, "Start a game on it" on that
     heading (2.8's `games` scope on those games). **A series** (consecutive
     games against one opponent: baseball's, hockey's back-to-backs) joins its rows with a bracket line; the opponent named once.
   - **List · Month** (a daily sport only): Month is a calendar of the month (seven columns, Monday first), each game day a cell
     with the opponent's mark, home cells filled, away outlined (so a road trip reads as a run of outlines), today ringed, a result
     as a small W or L under the mark (behind Hide scores); ‹ › moves months; a cell opens the game's sheet. List stays the
     default (round 1's PFD: a month grid alone fails at 30 small cells).
6. **Under the list:** "From ESPN".

## The game row (254 m)

Round 1's R3 asks for one game row everywhere. The page uses the shared scorebug twice, in its two forms:
- **Now** uses it whole (two teams named): the game is the subject, and it's the same bug as the hub's strip and Scores.
- **The schedule** uses its **one-side form**: the same component, status column, spoiler rule and tokens, but one team line (the
  opponent), because the page's team is the subject of every row. Repeating "EAGLES" on 17 rows (or the Sixers on 82) says one
  thing 17 times (the frame's "say each thing once") and doubles the list's height.

This is the one call here the rules don't settle (R3 says one row; the busy test says don't repeat): **for the user**, below.

## Situations, in rank order

| # | Who, when | First need |
| --- | --- | --- |
| 1 | Andrew, Sunday, his team on now | the live bug, its score (unless hidden) |
| 2 | Joanna, midweek: "when do they play?" | the next game's day and time; Play it in one tap |
| 3 | Conor tinkers: form, margins, who's next, where they stand | the season graphic, the place on the plate line, the schedule ahead |
| 4 | Riley opens Sam's Cowboys (a couch rival) | who follows them, their next game, Against: Jets (their meetings) |
| 5 | Hides sports scores | no record, place, bars or results until asked: one Show the season |
| 6 | Watching one of their games as if live | that game held ("Started", its own ask) even after Show the season |
| 7 | Not followed, from search | Follow in the bar; who on the couch follows them |
| 8 | Solo | no couch faces; Play shows only what can start (a sports start needs a couch: as B1's Games, C4 later) |
| 9 | A daily sport mid-season (82 or 162) | today's or the next game; the month; Month view; trips grouped |
| 10 | Off-season | last season's graphic and results, "Season over"; next season's first game if listed |
| 11 | Playoffs | the playoff games in the list with ESPN's note ("Wild Card"); the graphic marks where the playoffs start |
| 12 | A postponed game | its row "Postponed", its makeup a row of its own (ESPN lists it) |
| 13 | Loading, failed, no such team | a skeleton; Try again; "No such team in the NFL" |

## Each surface and its verdict

| Level | Questions (casual · sweat) | Data held | Today | Verdict |
| --- | --- | --- | --- | --- |
| The page | Is it on? When next? · the whole season | team schedule, couch follows | a sheet "A team" | **new screen** (a page with its address) |
| Plate and its line | Who, how good · where they stand | schedule (record), standings read (place) | plate + "ZTCF · 5–5" | **restructure** (the place added; the name the title) |
| Who follows | Who on the couch? · | couch teams | faces + line | **keep** (A3's words, approved) |
| Now | Is it on, the score? · the line, the network | schedule game; week game for clock/line | LiveNow plate | **new display**: the shared scorebug |
| Play the next game | Play it | start | yellow plate | **keep** |
| The season | How are they doing? · margins, streak, the shape of it | finals' scores | 8 W/L tiles | **new display** (a bar a game, by margin) |
| Start a game on | Bigger games | scopes (2.8) | rows | **keep** (approved 2026-11-21) |
| Rival chips | vs the Giants? | opponents | chips above Start | **restructure** into the schedule's Against |
| The schedule | When's the next one? · results, the bye, trips | the schedule | Coming up + Earlier, apart | **restructure** (one list by month, results inline) |
| A schedule row | the opponent, result or time | schedule game | GameRow | **repaint** to the shared row's one-side form |
| Month view | What's this month look like? · trips | the schedule | none | **new display** (a daily sport only) |
| A game | Score, Play | game | game sheet | **keep** (B4 redesigns it) |
| An athlete, the roster | · | rosters | none here | **left out** (Phase 4.2's athlete page) |
| The fan card | Since when, his calls | none yet | none | **new display**, C2 (its place kept) |

## Hide sports scores, and watching as if live

Every result here goes through `useGameScore` / `showScore`: the live bug's score, the record and place on the plate line, the
season's bars and streak, each row's result. With Hide sports scores on (or before it's known: 254 k), the plate line says the
league alone; the season block is a held row (its game count, "Results are hidden", **Show the season**: for the visit, a key of
its own like Standings', moving no mark); rows that have begun say "Played" with the day, no result, no per-row eye (one reveal a
page). A game being watched as if live stays "Started" with its own ask on its row and on the bug, Show the season or not.

## Return paths

- Back: where you came from (a league's tab, the hub, the guide, a cast list), else up to the league's This week.
- The game sheet over the page: closing it returns to the page at its scroll.
- Start a game on → the start handoff (a sheet over the page) → the started game's page; Back returns here.
- The league: the plate line's league name is a link up to the league's page (This week).

## The data

No new external read, no migration, no engine change. The team's schedule read (`/api/sports/schedule`, cached); the league's
standings read for the place (B1's, cached 15 minutes: only when the page is open, one per league); league-now's `weeks` for the
bye (football); the league's week read for the now game's clock and line where the schedule doesn't carry them (the bug's own
polling while it's on screen). HOSTING.md: one line under "A league's page" that a team's page reads the same cached answers.

## Left out, and why

- **A roster and athletes:** the athlete page is PLAN-sports-ready Phase 4.2's; the team page gets a Players row then.
- **Team stats against the league** (yards a game, ranks): not read today; a later new read, worth it only with the athlete pages.
- **News, injuries, odds history:** not ours (the sports pages show what the couch plays and watches; news is ESPN's app).
- **Event sports** (golf, racing, tennis): no team; their own pages later.
- **The fan card:** C2's; its place is kept under who follows them.

## Open for the user

- **The schedule's row:** the shared scorebug's one-side form (recommended: the team is every row's subject, half the height) or
  the two-team bug as on Scores (R3 to the letter, the team named on every row).
