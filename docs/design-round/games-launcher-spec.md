# The Games tab: the way into games (page spec)

## The job

**Games** answers "what can I play, and how do I get in?" for everyone on the show: someone in five games, someone in none. It
holds no game's results. Tonight holds the last episode (docs/design-round/tonight-night-spec.md, "Three places, three jobs"); a
game's page holds the season. Here each game you play is one row (its name, how long it runs, who you've got for the next
episode, your place), and every other row is a way in: a game to join, a game to start, your record of finished ones.

The smallest step comes first everywhere: one-episode games before longer ones, joining before starting.

People:
- **Joanna** (forgets) opens Games from the tab bar on the night: "is there anything to play tonight?" The first block answers:
  the next episode's one-episode games, hers with their state and the couch's with Join.
- **Andrew** (drives by) wants to see that his games are set and leave: each row says who he's got and whether it's set.
- **Conor** (tinkers) starts games: Start one sits in the first block (one-episode) and after the longer games (a season game),
  and Again restarts last week's one-episode games in a tap.
- **Casey** (only watches) has no games: the page is the couch's games to join, one row each with who's in as faces, then Start one.

Ways in: the tab bar; Tonight's "n more on the Games tab" under its Join rows; a game's line elsewhere (?game=<id>, which now lands
on that game's row); the hub.

## Top to bottom (a competition show, caught up, mid-season)

| # | Block | Holds | Opens |
| --- | --- | --- | --- |
| 1 | The show bar and the strip | as on every tab | Where you are; Your moves |
| 2 | **For Ep N+1** (your next episode) | the episode's one-episode games: **yours** first (its state, its move), then **the couch's you're not in** (who's in, when it locks, Join); then **Start a one-episode game**, with **Again** for last episode's kinds not on again yet; then the episode's extras as one quiet fold (bingo, trivia, Call it, polls, sheets) | a game's row: its move (the button) or its page (the name); Join's sheet; Start a game on a one-episode game (`length: "next"`) |
| 3 | **Your longer games** | each game you play that runs more than one episode, a row each, soonest to end first, a game starting later last | the game's page (mid-draft: the draft room) |
| 4 | **Longer games to join** | the couch's games over more than one episode you're not in and could join or ask to join, a row each | Join's sheet, or Ask |
| 5 | **Start a longer game** | one dashed row; over a finished season, at your own pace and Run it back (as today) | Start a game |
| 6 | **Your record** | one row: finished games (a count), your firsts and where that puts you on the couch | the finished games' page (as today: the record by opponent and kind, every finished game by episode) |
| 7 | How it works | as today | its page |

A block with nothing in it isn't drawn, except block 2's Start row, which is there whenever the next episode can still take a game.

### A one-episode game's row (block 2)

| Part | Yours | The couch's, not yours |
| --- | --- | --- |
| First line | the game's own name ("Who goes home?"), never its base's or its episode's (2026-11-21 decision) | the same |
| Second line | who's in as small faces, you first and ringed, then "You're in" and your move's state ("Picked · change before you watch", "2 to answer · locks Wed 8 PM", "After you reveal Ep 6") | who's in as faces, then what it asks and when it locks ("One pick · locks Wed 8 PM") |
| Right | its move as an outlined button (Pick, Answer, Change), nothing once it's locked | Join (outlined), Ask, or nothing (locked) |

### A longer game's row (block 3), one per game, about 60 px

| Part | Holds |
| --- | --- |
| First line | the game's name in caps and its length in the show's words ("Season · 7 left", "Eps 4–9 · 3 left", "Starts Ep 9"): Tonight's row's first line |
| Second line | who you've got for the next episode as small faces in the game's own shape (a lineup's starters, a pick, a team with who's out greyed, a claim's in and out; none for a game of questions, a card or a board), then the move's state in a few words ("Set: Cristian, Danny and Devin", "Set your Episode 7 lineup", "You're up · Round 2, pick 7"); a due move's words in the foreground, an empty place dashed |
| Right | your place in the game's own measure ("2nd", with "of 4" under it); head to head the record ("5–2"); co-op none (its lives are the second line's); nothing before anything has counted |

One target: the whole row opens the game's page (mid-draft, the draft room). The move itself stays the strip's and Your moves'
(Phase 0 decision 8: one yellow a view), and the game's page has it.

**Order:** soonest to end first, a game to the season's end after them, games starting later last (Tonight's order, so a game sits
in the same place on both tabs).

**Many games:** five rows, or four and one fold row naming the rest ("3 more games · All set · Blindside Lineup · …"), opened in
place. A game whose move is due never folds.

### A longer game to join's row (block 4)

The game's name in caps (its couch name when two games of its kind are on the couch, as a longer game's row says it) and its length
("Season", "Eps 9–13"); who's in as faces leading the second line, then what joining means in a few words ("start from Ep 7",
"start where you are"); on the right Join, or Ask (Asked once asked, with Take back in its sheet).
A game nobody new can join isn't listed: there's nothing to do with it here, and it's on the couch's page.

## By situation

| Situation | Block 2 (For Ep N+1) | Block 3 (Your longer games) | Block 4 | Block 6 |
| --- | --- | --- | --- | --- |
| Caught up, three games, a one-episode game of yours and one to join (jordan, the zt couch, Ep 6 revealed) | Who goes home? (yours, Pick), Who survives? (riley and sam in, Join), Start one, the extras' fold | three rows, soonest to end first, Merge Lineup ("Starts Ep 9") last | Second Chance Pool, Join | Your record: 1 finished |
| Watching only (casey) | the couch's one-episode game for Ep 7 with Join; Start one | none | every longer game open to join | none until they've finished one |
| Watching only, nothing to join, nothing on | Start one (the Play it plate stays the empty state for a show nobody's set up) | none | none | none |
| Seven games (busy) | as above | four rows and "3 more" | | |
| Behind (sam, two episodes back) | his next episode (Ep 5): its one-episode games; an aired episode waiting on his reveal folds to one line, as today | his place at his mark | | as far as he's seen |
| A draft on, you're up (draft couch) | | the draft's row: "You're up · R2 pick 7", the due dot; opens the room | | |
| A draft not started | | "Draft · Sun 8 PM" or "Draft · not started" | | |
| A sport (Gridiron, 15 rounds) | | the same row; the second line's faces cap at four, then "+11" | | |
| Many one-episode games (three an episode for 20 episodes) | the next episode's three, then Start one and Again | the season's longer games | | 57 finished, 12 firsts |
| A finished season | none (Start a longer game offers own pace and Run it back) | none: a finished game is the record's | none | the record |
| Solo | your games; your public pool and practice as today | | none | |
| Read-only (the desk's Open it) | unchanged: the one game's table | | | |

## Every kind of game (docs/UI-REVIEW-MAP.md, "Games tab")

A longer game's row is the same part for all fifteen main blocks; what changes is its second line's faces and its right-hand
measure, both read from the game's main block (`NIGHT_ROWS[main].faces` and `.place`, src/lib/game/night-rows.ts):

| Main block | Second line's faces | Right |
| --- | --- | --- |
| together (co-op) | your plays | none; the second line ends with the lives left |
| race, worth, week, objectives, team, picks, stages | your plays | your place |
| matchup, categories | your plays | your record, "vs riley" on the second line |
| ladder (a pool) | your pick | your place |
| board, card, slate, ballot | none | your place |

A one-episode game's row is one part for every kind: who's in, its state, its button.

## The drill tree

| Level | Questions brought to it | Holds today | Verdict |
| --- | --- | --- | --- |
| The Games tab | What can I play; am I set | By episode, the night's games; Running: every game's row with a leaderboard, its glance and Last picks; Ep N's results; Starting later; Also on the couch; How it works; Start a game | **Restructure**: one-episode games first, your longer games one row each, then the ways in |
| A one-episode game of yours | Am I in; is it done | a night row: name, button, faces, state | **Keep** its parts, under the episode's heading |
| A one-episode game to join | Who's in; when does it lock | in "Also on the couch", a 110 px card naming its base game | **Restructure**: block 2's row, its own name, faces, Join |
| A longer game | My place; am I set | a card about 300 px: name, place line, glance, leaderboard, Last picks | **Restructure**: one row, about 60 px |
| Its leaderboard and Last picks | How does everyone stand | in the row | **Removed**: Tonight's open row and the game's page |
| The glance's face plates | Who have I got | the glance opened in place | **Removed**: the row's faces; the plates are the game page's and Your moves' |
| A game mid-draft | Am I up | the draft line: big words, slots, Open | **Restructure**: the row's second line, the room one tap |
| A longer game to join | What's joining like | the same 110 px card | **Restructure**: block 4's row |
| Start a game | Start one | one dashed row, last | **Restructure**: two, the one-episode one first in block 2 |
| Ep N's results and Again | What finished | the newest episode's result rows, Again chips | **Moved**: the results are Tonight's (its one-episode group); Again joins block 2's Start |
| Your record | How often do I win | a line under the results | **Keep** as block 6's row; the finished games' page **keep** |
| Join's sheet | What happens if I join | a sheet | **Keep** |
| The game's page, the draft room | | | **Keep** |

## Data the page needs

| Need | Where it is | Missing |
| --- | --- | --- |
| Your games, at your mark | `show.play` (GameView) | nothing |
| Your next move per game, its faces | `yourMove`, Glance's `glanceShape` (games.tsx) | nothing |
| The couch's games you're not in, who's in, how to join | `useCouchGames` (JoinGame: faces, span, mode, ownPace) | nothing |
| When a one-episode game locks | its sheet's `closesAt`, else the episode's air time | nothing |
| Your record | the archive's record (`tally`) | nothing |
| Kinds to start again | the archive's newest page (AgainLine) | nothing |

## Left out, and where each went

- Each game's mini leaderboard and Last picks: Tonight's open row (the last episode, everyone) and the game's page (the season).
- The glance's opened plates: the game's page and Your moves.
- "Ep N's results": Tonight's one-episode group; older ones in the record.
- A game nobody new can join: the couch's page.
- The Shared or Exclusive tag on a game to join: Join's sheet says what joining takes.

## Open questions

- None owed by the user for this page. BACKLOG 239 (one-episode or quick game) stays open: the page says "one-episode game",
  Tonight's words.
