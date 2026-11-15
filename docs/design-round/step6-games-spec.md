# The Games tab and the draft room: page spec (step 6, competition shows first)

## The job

**Games** is where you play this show: every game you're in, how everyone stands in each, and the one thing each needs from
you. It answers, in this order: where am I in each game (in that game's own measure, never summed); what does each one need
from me, and by when; how does everyone else stand, and what did they pick. Tonight's minis answer "this week, for me" (step 3);
the Games tab answers "the table, for everyone" (Phase 0 decision 4: one row per game with a mini leaderboard, last picks one tap
open, the reason the tab was kept on 2026-11-08).

**The draft room** is where a team is made: whose pick it is, how long until yours, who's left, and your team as it fills. It
answers: am I up (and if not, how many picks until I am); who's still free and who should I take; what does my team still need;
what has everyone taken.

People: Joanna opens Games from a push ("You're up in the Couch Cup draft"), sees "You're up", taps a face, taps Draft, and leaves;
Andrew glances at Games for his place in each game and leaves; Conor opens the room ten minutes before his pick, stars four
castaways, reads the picks board for who's hoarding a tribe, and in a sports draft searches "RB" and sorts by last season.

Ways in: the tab bar ("Games"); the strip and Your moves (a due draft turn opens the room); a push; Tonight's game mini (opens the
game's page); the show's ⋯ menu (Draft room, Blind draft).

## The Games tab, top to bottom (a competition show, caught up mid-season)

| # | Block | Holds | Opens |
| --- | --- | --- | --- |
| 1 | **The show bar, compact** | as on every tab (step 4) | Where you are; the reveal |
| 2 | **The strip** | as on every tab | Your moves |
| 3 | **A game's row**, one per game, in the order they need you (due first, then by start) | Its name (the game's real name; its couch name only when two of a kind); your place in the game's own measure ("2nd of 4 · 21 pts", "5–2 · 1st", "T1 · streak 5"); for head to head, this week's opponent in a line ("Ep 6 · vs Riley 3–2"); its one action as a quiet button, yellow only when due ("Pick · locks Wed 8 PM"); the mini leaderboard | The name: the game's page. The action: the move (Your moves on that game, or the draft room) |
| 3a | **The mini leaderboard**, inside the row | Every player when there are five or fewer, else the top three and you with "and 6 more"; each a place, a face, a name, the total in the game's unit; you on the secondary fill | A person: their sheet in that game (useGameDrill, step 2b) |
| 3b | **Last picks · Ep 5**, a fold under the leaderboard | Each person's faces for the last episode you've seen, in place: Survival Pool their pick (gone grey if they went home), Weekly Lineup their starters and the week's points, a team game (Outlast) their team with who's still in | A face: that cast member's sheet in that game |
| 4 | **Join a game** (games on the couch you're not in) | as today | The join sheet |
| 5 | **One night each** (bingo, Call it, sheets, polls, trivia) | as today, its own group | Each one's sheet |
| 6 | **Start a game** | as today, last of the games' things | The wizard |
| 7 | **Practice** | as today | |
| 8 | A line at the foot | "Standings as of Ep 5, where you are. They move when you reveal." | |

Removed: the pill row (it repeated each game's place, and the rows now fit in a view or two); each game's full table (the game
page's "Everyone in this game", step 2c); Rules on each game (the game page's How it works); the As-of plate (the compact control
and the strip say a reveal waits, Phase 0 decision 3; step 4 listed it open); the move card's faces (the row's action names the
move; the faces are the move's own sheet).

## A game in its draft (the row's other form)

While a game drafts, its row has no leaderboard (nobody has points; ranking by how many each has drafted, today's "T3 alex 1", is
wrong) and becomes the draft's state:

| Draft | The row holds | Action |
| --- | --- | --- |
| Not started | "Draft · not started" or "Draft · Sun 8 PM"; the order as faces | Open the draft room |
| Snake, you're up | "You're up · Round 2, pick 7" | **Draft** (yellow) |
| Snake, someone else | "Jordan is picking · you're next" or "3 picks until yours"; the last pick in a line ("Jordan took Eric") | Open the draft room (quiet) |
| Blind, you haven't locked | "Pick 4 in private · 2 of 4 in" | **Pick** (yellow) |
| Blind, you're locked | "Locked in · waiting for Sam" | Change (quiet) |
| Done | the leaderboard as above, once the first episode counts; until then "Drafted · your team" with the team's faces | The game's page |

## The draft room (a snake draft, each castaway on one team)

| # | Block | Holds |
| --- | --- | --- |
| 1 | **The bar** | Close; the game's name and "Draft · Round 2 of 4"; Draft settings (whoever runs it) |
| 2 | **The clock** | Who's up, as a face and a sentence: "You're up" (round and pick, the timer only when there is one) or "Jordan is picking" with **how many picks until yours** ("You're next", "3 picks until yours"); the last pick in one line under it ("Jordan took Eric · R2·2", "by Alex" when made for someone); whoever runs the game's Nudge and Pick for them when a turn drags |
| 3 | **Your team** | Your slots in a row (taken faces, dashed for open), and room for one line under them for what the team still needs: "Needs: 1 Interior" (docs/PLAN-cast-properties.md, after the round), a sport's open positions ("Needs: QB, RB, 2 WR") |
| 4 | **The view switch** | Available (count) · Picks · Queue (count) |
| 5 | **Available** (competition) | The cast as a face wall, four to a row by tribe (step 5's wall: a name each, a tribe square), a star on each to queue; taken ones hidden unless "Show taken" |
| 5s | **Available** (sport) | Search first (a name, a team), positions (All, QB, RB, WR, TE, K, DEF), sort (the default ranking; last season's points where known); rows of 40 with Show more: a headshot, the name, "WR · Seahawks", the line that ranks them, a star |
| 6 | **Picks** | The draft board: a column per person in the order, a row per round, each cell the face taken (the snake's direction shown by the order of the cells), the next empty cell on the clock marked; replaces the ticker, the order strip and Teams |
| 7 | **Queue** | Your stars in order, each "still free" or "taken by Riley", Draft from it when you're up |
| 8 | **The confirm bar** (only when you're acting) | The face you tapped and **Draft Aaliyah** (yellow); "Tap a castaway" until one is |

A castaway's tile tap selects them (when you're up) or opens nothing (when you're not: it says whose pick it is). Their sheet (step
5's person sheet: their season so far, their numbers) opens from a long press or the selected face in the confirm bar: before the
season it is who they are; at a later stage's draft it is what they've done.

Removed: the ticker of recent picks (the clock's one line and the Picks board say it); the order strip of 26-px faces (the clock
says how far you are; the board shows the order); Teams as its own view (the Picks board's columns are the teams).

## The blind draft (castaways on several teams), the waiting room, and done

- **Blind:** the clock says "Pick 4 in private · nobody sees until everyone's in", then who's in as faces (in, or picking); your
  slots; the face wall; the confirm bar's Lock in. Keep, with the shared parts (the clock, the slots, the wall): it already does
  one thing, pick N and lock, with nothing to wait on.
- **Before the start:** the clock as "Starts Sun 8 PM" or "Not started"; the order; the wall to star; the Commissioner's Start
  and Pick a time. Keep.
- **Done:** "Couch Cup is set", the Picks board as the teams, Go to the show. Repaint: the board is the teams.

## By situation

| Situation | Games tab | Draft room |
| --- | --- | --- |
| caught up, three games (Alex) | three rows: the due one first (yellow action), two quiet; leaderboards of four | n/a |
| a move due, behind on the show (Sam) | standings as of his mark; the line at the foot says so | n/a |
| a snake draft on, you're up | the draft row first, Draft in yellow | "You're up", your slots, the wall, the confirm bar |
| a snake draft on, someone else up | the draft row: "3 picks until yours" | the clock counts down picks; star to queue |
| a blind draft on | "Pick 4 in private · 2 of 4 in" | the slots, the wall, Lock in |
| before any draft | "Draft · Sun 8 PM", the order | the order, the wall, Start |
| watching only | Play it (as today) | n/a |
| solo | your public pool and practice (as today) | n/a |
| stages | one row per game; its current stage named in the row ("The merge · Week 2"); a stage's draft is that stage's room | the stage's draft from who's still in |
| an old season, all over | each row's champion and your final place | n/a |
| own pace | each row at your mark; a late joiner's draft from the pool at the game's start | the pool as of the game's start |

**A sport (the short check, 344 athletes, 15 rounds).** The tab's rows are the same part; a sport's row says its record. The room
is the same frame with the sport's Available: search, positions and rows, never a wall of 344 photos (today: 338 tiles, 37,000 px).
The Picks board at 15 rounds × 4 scrolls down, faces in cells; "Needs" lists open positions from the lineup's slots.

## The drill tree

| Level | Questions brought to it | Holds today | Verdict |
| --- | --- | --- | --- |
| Games tab | Where am I in each; what's due | Pills, then every game's full table, rules and move card: 3 screens for 3 games | **Restructure**: one row per game, due first |
| A game's row | My place; what to do | Big title, Rules, a move card with faces, the table | **Restructure**: name, place in its unit, opponent, one action |
| Its leaderboard | Who leads; how far am I | The full table with faces and points | **New display**: a mini leaderboard (five or fewer, else top three and you) |
| Last picks | What did everyone pick | Faces at the end of every table row, always on | **New display**: a fold, Ep N, per game type |
| A person | Their season in this game | Their sheet in the game (step 2b) | **Keep**: built in step 2b |
| A game mid-draft | Am I up; how long | A move card over a table ranked by picks drafted | **Restructure**: the draft row |
| The draft room | Whose turn; when's mine; who's left | Ticker, clock, order strip, three views, 3-across tiles | **Restructure**: clock with picks-until-yours, your team, the wall, Picks board |
| The board of who's free | Who's best for me | 3-across 4:5 tiles (6 per screen), no info past tribe | **Repaint** (competition: step 5's wall), **new display** (sport: search and rows) |
| The picks so far | Who took whom; whose team is what | The ticker and Teams rows | **New display**: the Picks board, a column per person, a row per round |
| A castaway in the draft | Who is this; what have they done | Nothing (a tap selects) | **New screen**: the person sheet from the selected face |
| Your queue | Who's next on my list | A list with Draft | **Keep**: it works; counts what's still free |
| The blind draft | Pick N; lock | Clock, who's in, slots, 3-across tiles, Lock in | **Repaint** with the shared parts |
| Draft settings | Time, timer, order | A sheet | **Keep**: a Commissioner's tool, already one sheet |
| Done | The teams | "is set" and team rows | **Repaint**: the Picks board as the teams |

## Spoilers

The tab's standings and last picks stop at your mark (the games read is the viewer's copy). A draft that opens past results you
haven't revealed asks you to reveal first (as today: who's left would say who went home). A later stage's draft shows only who's
still in as far as you've seen.

## Open questions

- A draft row's yellow and the strip's: both are the same due move, one per view (Phase 0 decision 8). The strip owns the yellow
  when both are in the first view; is the row's Draft then quiet?
