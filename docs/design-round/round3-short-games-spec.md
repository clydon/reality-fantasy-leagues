# A show's games when short games are frequent: page spec (Round 3, competition shows first)

## The job

**Games** answers "what's on for me": every game still running at your mark, the ones about a single episode grouped under that
episode, then the games that run across many. A game over as far as you've seen leaves the tab for the **archive**, where it is one
line: who won it and your place. **Your record** heads the archive: how you've done across those games, against each person on the
couch and against the computer players.

The tab answers, in this order: what do I play next, and what does each of those still need from me; where do I stand in the games
that run all season; how did the last episode's games end. The archive answers: how am I doing across all of them, against whom,
and what happened in any one of them.

People, on Round 3's busy season (three one-episode games before every episode, about 60 by the finale):
- **Joanna** opens Games from a push ("3 games on Episode 20"), sees the three, answers the one the strip points at, and leaves.
  Today she scrolls past 57 finished games to find them (row 18 of 63; the page is 18,000 px tall).
- **Andrew** glances for his place in the season games and whether he won last night's. Today last night's results are three of 57
  identical-looking finished rows, in no order he'd guess.
- **Conor** opens the archive to see who he beats most and which kind of game he's best at. Today nothing adds them up.

Ways in: the tab bar; the strip and Your moves (a move opens its sheet, as today); a push; Tonight's game section (a game opens its
page; the night's games open the tab at that episode); the reveal's end (the night's games, then the archive).

## The rule that sorts a game

From its span and your mark (`overByMark`, the running read, the archive read; docs/PLAN-start-a-game-redo.md E2):
- **A night's game:** a span of one episode, not over at your mark. Grouped under its episode.
- **A season game:** any other span not over at your mark (the whole season, a stage, Episodes 18 to 22). One row each, as step 6.
- **Starting later:** a game whose first episode is past the next one to air ("Starts with Episode 22"), or waiting for a phase.
- **Finished:** over at your mark. In the archive; the newest episode's also on the tab, once.

A sport reads the same with a game day for an episode: a team's one-game Pick'em is a night's game under "Tonight · Celtics at
Lakers".

## The Games tab, top to bottom (a competition show, caught up, Episode 20 next)

| # | Block | Holds | Opens |
| --- | --- | --- | --- |
| 1 | **The show bar, compact** | as on every tab | Where you are; the reveal |
| 2 | **The strip** | as on every tab | Your moves |
| 3 | **The next episode** ("Episode 20 · Sun 8 PM") | Each of its games as a night row; then the one-night things that aren't games (bingo card, Call it, the couch's polls, trivia), today's This week block folded in | |
| 3a | **A night row** | The game's dot and name ("Prediction Sheet"); your move's state in words ("4 questions · locks Sun 8 PM", "Answered · change until Sun 8 PM"); who's in as faces, each ticked once they've answered (a computer player's face is its robot); the move's button (quiet; the strip holds the yellow) | The name: the game's page. The button: the move |
| 4 | **Running all season** | Step 6's rows, unchanged: your place in the game's own unit, the line that changes, its move, the mini leaderboard, Last picks folded | As step 6 |
| 5 | **Episode 19's results** (the newest episode finished at your mark) | Each of its games as a result row: the dot and name, the winner's face and "Jordan won" (or "You won", "Tied: you and Riley", "Nobody scored"), your place and points ("2nd · 3 pts") | The row: the game's page as it stood |
| 5a | **The archive's door**, closing block 5 | "All finished games · 57"; under it your record in one line ("You've won 19 · 1st on the couch") | The archive |
| 6 | **Starting later** | A quiet row each: the name and "Starts with Episode 22" | The game's page |
| 7 | **Join a game** | as today | The join sheet |
| 8 | **Start a game** | as today, plus **Again for Episode 20** when the last episode's games aren't on the next one yet: the same games, the same people, one tap each (task 10) | The wizard at Episode 20, the game chosen |
| 9 | **How it works** | as today | |

Removed from the tab: every finished game's row (57 of 63 here; the archive's); This week as its own block (block 3 holds it: one
home for what's about the next episode); a leaderboard on a night's game before its episode (four "–" rows say nothing; who has
answered says what's happening).

The tab's size no longer grows with the season: on the busy season it's the next episode's three games, three season games, three
results and the door, at 20 episodes or 30.

## Someone behind (sam, two episodes back: Episode 18 next)

- Block 3 becomes one block per episode ahead of his mark that has a night's game: **Episode 18 · results when you reveal it**
  (three night rows, each "Answered"; nothing about how they ended), **Episode 19** and **Episode 20**.
- The first block is open. Each later one is a single line ("Episode 19 · 3 games · answered") unless it holds a move due, which
  keeps it open (Episode 20's three, still to answer).
- Block 5 is **Episode 17's results**, the newest he's seen. The archive stops at Episode 17.

## The archive (a new screen, pushed over the Games tab)

| # | Block | Holds | Opens |
| --- | --- | --- | --- |
| 1 | **The bar** | Back; "Finished games"; the show and season under it | |
| 2 | **Your record** | Across every finished game at your mark: played, won (a shared win counts, said as shared), and a row per opponent on the couch: you above them, level, them above, as one split bar on one scale ("You 31 · 6 · 20 Riley"); computer players' rows with their robot faces | A kind filter below narrows it |
| 3 | **By kind** | A chip per kind of game played (All · Prediction Sheet 19 · Split the Pot 19 · Match the Majority 19); the record and the list follow the chip | |
| 4 | **By episode**, newest first | An episode heading ("Episode 19 · Nov 15"), then each game that finished on it as a result row (block 5's part); a season game that finished there (the finale) among them | The game's page as it stood |
| 5 | **Older episodes** | A button: "Episodes 11 to 1" (the next page: 20 games at a time, ending on a whole episode) | The next page, under this one |

No endless scroll: each page ends at a button saying what comes next.

## A finished game's page (repaint)

It opens as the game stood at its end (the game page's view at your mark):
- The title card says **Final** and the result in words ("Jordan won · you 2nd of 4", "Tied 1st with Riley", "Nobody scored").
  Today a 1-point tie reads "Tied 1st of 4 · 1 pts · in front".
- A one-episode game drops its season grid (one column) and its weekly graph (one point), as a one-game sports game already does
  (decisions.md, 2026-11-15). Today it shows "The season" with one column and "The next ones stay hidden until they lock".
- **Again for Episode 20** at its foot: the same game on the next episode not yet covered.

## Tonight with many games in a night

Tonight's Your games (step 3) keeps a mini per season game. The night's games join it as two compact parts, never a mini each:
- **Episode 19's results:** block 5's result rows, the same part.
- **Episode 20's games:** one line per game with its move's state ("Answered", "4 questions"). The strip still holds the move.

Today: "Your games · 63", a mini per game, finished ones saying "After the game ended", 12,000 px.

## The reveal with many games in a night

The reveal plays every game at once (one episode, all its games). Its beats, from who went home on:
1. Who went home; the GIFs (as today).
2. **Episode 18's games:** one beat for every one-episode game that ended tonight: a row each, its winner and your result, your
   wins marked; a line under them ("You won 1 of 3 tonight"). Today: a beat per game, each "0 pts on your sheet".
3. Each season game's beat, its own measure (as today).
4. The table that moves (as today).
5. The end: **Again for Episode 21** when the night's games aren't on the next episode yet, beside Close.

## A couch of one, against computer players (daily games)

The same parts. A night row's faces are you and the computer players; the record's rows are against each of them ("You 12 · 2 · 7
Ada"). Again for Episode 20 brings the same computer players at the same level. Starting a game against them is Start a game's
(E1).

## By situation

| Situation | Games tab | Archive | Tonight | Reveal |
| --- | --- | --- | --- | --- |
| a new couch | Start a game first; block 3 holds the next episode's one-night things; no results, no door | not reachable | as today | as today |
| busy, caught up (alex) | Episode 20's three, three season games, Episode 19's results, the door | 57 games, 3 pages | two compact parts | n/a |
| busy, behind (sam) | Episodes 18 (open), 19 (a line), 20 (open: moves due); Episode 17's results | to Episode 17 | Episode 17's results; Episode 18's games waiting | Episode 18's games as one beat |
| 30 episodes (93 games) | the same size as at 20 | 5 pages | the same | the same |
| a couch of one against computer players | the same, robot faces | the record against each computer player | the same | the same |
| a sport's daily games | "Tonight · Celtics at Lakers" as the night's block; results by game day | by game day | the same | the same |
| an old season, all over | no next episode; the last episode's results and the door; Start a game at your own pace (as today) | everything | as today | n/a |

## The drill tree

| Level | Questions brought to it | Holds today | Verdict |
| --- | --- | --- | --- |
| Games tab | What do I play next; where do I stand | Every game you've ever played on the season as a row: 63 rows | **Restructure**: the next episode, the season games, the last results, the door |
| A night's game before its episode | What do I do; has everyone answered | Step 6's row: "—", "nothing counted yet", four "–" rows | **New display**: the night row (who's in, ticked) |
| A season game | My place; my move | Step 6's row | **Keep**: approved in step 6; nothing about short games changes it |
| A finished game, on the tab | Who won; how did I do | Step 6's row, "Final · you won it" with every total "–" | **Restructure**: the result row |
| The archive | How am I doing across them; what happened in that one | Nothing | **New screen** |
| Your record | Who do I beat; at what | Nothing | **New display**: the split bar per opponent, on one scale |
| A kind of game | Which am I best at | Nothing | **New display**: the kind chips over the record and list |
| A finished game's page | How did it end | The running game's page: one-column season grid, "next ones stay hidden" | **Repaint**: Final, the result in words, no grid of one, Again |
| A person, in a finished game | What did they answer | Their sheet in the game (step 2b) | **Keep**: it already shows that episode's answers |
| A person, across the archive | How do I do against Riley, game by game | Nothing | **Not this round**: the record's row says the count; the games behind it are B3's or later (open question 5) |
| Tonight's Your games | What's happening in my games | A mini per game: 63 | **Restructure**: the minis for season games; two compact parts for the night's |
| The reveal's games | How did tonight go | A beat per game | **Restructure**: one beat for the night's games |

## Spoilers

Everything stops at your mark: the running read and the archive are read at it (E2), so a game whose end you haven't seen is a
night row with "results when you reveal it", never a result row. The door's count and your record count only games finished at
your mark. A push about a night's games names the games, never a result.

## Open questions

1. A short game played every episode: one game with a winner each night, or a new game each time? (This design: a new game each
   time, tied together by kind in the archive and the record, with Again one tap. A game that starts its own next copy when the
   episode airs would need an engine step.)
2. Do short games count toward the couch's Power rankings and a profile's best finish?
3. Does every short game tell the couch, or only the first one of a night?
4. A couch of one: its standings as its own best, or its record against the computer players? (This design: the record.)
5. Your record against one person, opened: the games behind the count, in this round or later?
