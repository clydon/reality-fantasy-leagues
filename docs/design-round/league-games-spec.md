# A league's page, Games (sports-couch B1, session 3): the page spec (Intent, step 1)

2026-11-22, the `sports-couch` lane. Intent's `organize`, once. On round 2's play model ([sports-couch-play-spec.md](sports-couch-play-spec.md):
"Games is the play model in three groups: with the couch, rivals, on your own"), the page's frame ([league-page-spec.md](league-page-spec.md))
and the show's Games tab, the launcher, live since 2026-11-21 ([games-launcher-spec.md](games-launcher-spec.md): your games, the
couch's to join, Start one). B1 is a session a tab; this is the third.

## The job

**The way into games in this league: what you play here and what's yours to do, what the couch plays that you could join, and what
you could start, by who it's with.** No results: This week holds the couch's week, Scores the league's, each game's page its
season (the show's Games tab's rule, 2026-11-21).

## What plays today (only these; a tab never promises)

- Your games in the league (home's shows on this league's seasons) and their due moves.
- The couch's games here you're not in (the couch's games read: `JoinGame`), with Join or Ask (the show's JoinButton and sheet).
- **Play this week's games** (one tap: Pick'em on every game still to come; the slate) and **Play the season** (the slate's
  sheet: a season-long league, or pick'em every week).
- **A rivalry's game** (Start a game on that one game) and **a rivalry's every meeting this season** (`StartWhen` `meetings`).
- **A team's season** (Start a game on it: Pick'em on its games, a draft of its players; computer players in any of them).
- Not yet (Phase C, named so the structure leaves room): the rivalry challenge (Winner and margin to one person, sides), a fan's
  call and its record, the season call, a slate of only the couch's games, solo sports play with no couch (C4).

## Structure, in rank order

1. **Your games here** (when any). A row each in the show launcher's form (`LaunchRow`: the name in caps, its length, the people
   in it as faces, then the move in its own words or "Open"), a whole-row link to the move (when due) or the game's page. Due first.
   Your move's words in chyron line: the tab's one yellow, only while a move is due.
2. **With the couch** (not solo). First the couch's games here you could join (a row each with Join, as the show's "Longer games
   to join", four and a fold), then the two starts: Play this week's games (the chyron plate while nothing of yours is due, outlined
   otherwise: the One Chyron Rule, as the old sheet had it) and Play the season (outlined). Play this week's games only while a
   game of the week is still to come.
3. **Rivals** (not solo; only when the couch has rivalries still to come this season). A row each for the next three of the
   couch's rivalry games, yours first (the two marks, "Eagles at Jets", its day and "you vs Riley"), its right an outlined **Start**
   (a game on that one game). A pair that meets twice or more still to come adds one quiet line under its rows: "Every Eagles–Jets
   game · 2 left", starting on their meetings. The rest fold.
4. **Your team** (one row a team you follow here, your team first; "Your teams" for two or more): "Every Eagles game, the rest of
   the season", opening Start a game on the team's season (Pick'em on its games, a draft of its players, computer players). It
   starts on the couch like every start; Start a game's Who's playing decides whether it's you alone with computer players.

**Labels.** Round 2's "On your own" becomes **Your team**: the start is on the couch (Who's playing decides who's in), so "on
your own" would promise what the screen doesn't do. "With the couch" stays (it's who the games are with); "Rivals" stays.

## Situations, in rank order

| # | Who, when | First need |
| --- | --- | --- |
| 1 | Joanna, a pick due in the couch's Pick'em | the move, in words, one tap |
| 2 | Andrew, Wednesday, the couch has no game this week | Play this week's games, one tap |
| 3 | Riley, the Eagles at the Jets next week (his rivalry) | Start a game on it |
| 4 | Sam, the couch plays a season-long league he isn't in | Join (or Ask) |
| 5 | Conor tinkers | every start: the season, a rivalry's meetings, a team's season |
| 6 | Solo (no couch) | his games here; honestly, that starting one needs a couch for now |
| 7 | A spectator (follows the league, no team) | With the couch; no Rivals, no Your team |
| 8 | Off-season | his games (if any); nothing to start, said once |
| 9 | Hiding sports scores | nothing changes: the tab has no results |

## Each surface and its verdict

| Level | Questions (casual · sweat) | Data held | Today | Verdict |
| --- | --- | --- | --- | --- |
| The tab | What do I play here, what can I start? | home, couch games, rivalries, follows | the sheet's rows + two starts | **restructure** (round 2's groups) |
| Your game row | What's due? Who's in? | home moves, couch games' faces | OpenRow | **restructure** to the launcher's row (one row form across Games tabs) |
| A game to join | Who's in, can I still join? | JoinGame | none here | **new display** (the launcher's join row) |
| A rivalry to start on | When, whose? | rivalries (couch-table), the week | This week's card only | **new display** |
| A team's season start | Can I play my team's season? | follows | the team sheet only | **new display** (a row) |
| Start a game (the sheet) | which game, who's playing | the wizard | the handoff | **keep** |
| A game's page (a row's tap) | | | | **keep** |

## The data

No new read, no migration, no engine change: home and its moves, the couch's games read (`/api/couches/<id>/games`, already read by
the show's Games tab), the couch's table read for meetings (This week's, cached), follows, and league-now. HOSTING.md unchanged.

## A flaw, raised (not designed around)

**A solo player can't start a sports game.** Every sports start (the one-tap slate and the handoff to Start a game) needs a couch
and says "Start or join a couch first". Session 1's This week shows a solo player Play this week's games, which then says that: a
dead end. Shows solve solo with a public pool and computer players on no couch; sports don't. This tab shows a solo player his
games and one honest line; This week stops offering the dead end too. The real fix is C4 (solo sports play), or pulling forward its
smallest piece: a sports game with computer players on no couch (a server change in `sports/start.ts` and the handoff). For the user.

## Open for the user

- **Solo sports play:** wait for C4, or pull its smallest piece forward (above).
- **"Your team"** in place of round 2's "On your own" (recommended: the start is on the couch).
