# Tonight: page spec (step 3, competition shows first)

## The job

Your next episode and what to do about it, then the last one with your couch. Tonight answers three things for one show, in
this order: where you are against the season and your people (watched through, what's next, who's ahead), what's yours to do
(a move due, or a reveal waiting, or nothing), and how the last episode went (the episode itself, the couch's reactions, each of
your games). One primary action at a time.

People: Joanna opens a show after a week away and reads the top for "is anything for me"; Andrew taps the one bright thing and
leaves; Conor scrolls to the games for the numbers.

The ways in set the prediction ([R4](phase0-first-views.md)): from the hub's plate or a poster ("what's on with this show"), from
a push ("Your lineup locks tonight", "Episode 5 results are in"), and from the tab bar while already inside the show. Each lands on
the top of Tonight, so the first view answers whichever of them was asked.

## Two parts every show tab shares

Tonight's round settles Phase 0's decisions 2 and 3 as parts of the show, not of one tab.

**The progress control** (decision 3) is the show's one statement of where you are. It replaces the show bar's chip ("Ep 6 · in 4
days"), the couch line and its numbered faces, Up next's plate, Seen it?, and the spoiler line on the other tabs.

| Holds | Opens |
| --- | --- |
| Your mark in words: "Through Ep 5", "Not started", "Through Ep 3 · 2 behind", "You finished it" | Where you are (update your mark: the existing sheet, `openWhere`) |
| What's next, once: "Ep 6 · Wed 8:00 PM · in 4 days", "Ep 6 · on air now", "Ep 6 and 7 are out", "Ep 5 results are in" | |
| The couch on one episode scale: the aired run, the next airing marked, each person's face at their mark (you ringed), the latest aired | Where everyone is (the couch's sheet, each person a row that opens their own sheet) |
| This person's one watching action, when there is one now: **Reveal Ep 5** (every game at once), **I watched it**, **Watch along** (only once the episode is out or on air) | The reveal; the watched ask; Watch along |

On Tonight it sits in the tall show bar over the art. On the other tabs it is the compact bar's line: your mark and the one action
("Through Ep 4 · Reveal Ep 5"), no scale. A friend's mark never unlocks their game data (the brief).

**The strip** (decision 2) is the show's one statement of what's yours to set. It sits directly under the show bar on every tab,
in the same place, and replaces the dock and Tonight's carousel of move cards.

| State | The strip says | Opens |
| --- | --- | --- |
| A move due | "Set your lineup · pick for the pool" and "for Ep 6 · first locks Wed 8:00 PM"; the one yellow | Your moves on the first due move's tab (a draft turn: the draft room) |
| A due move waits on a reveal | "Your lineup for Ep 6 · after you reveal Ep 5"; plain (the reveal holds the yellow) | Your moves |
| All set | "All set for Ep 6 · change until Wed 8:00 PM", a tick; plain | Your moves, showing what you set |
| Locked (on air) | "Locked for Ep 6 · scores stay hidden until you reveal"; plain | Your moves, read-only |
| Nothing to set (no game here, the season over, your games over) | nothing: the strip isn't there | |

Each move in Your moves names its game and episode and has a door to that game's page (packet item 45).

## Tonight, top to bottom

| # | Block | Holds | Opens |
| --- | --- | --- | --- |
| 1 | **The show bar** | Back, the show's art, its name and season, the menu; the progress control at its foot | as above |
| 2 | **The strip** | as above | Your moves |
| 3 | **Last time · Ep N** | The last episode you've watched, once it has aired: who left (faces and how), the couch's reactions (each person's GIF as a face and its picture; yours, or "No GIF from you yet" with Add one), and the two doors, **Discuss Ep N** (the chat, at that episode, with its count) and **Ep N recap** (the episode's page) | A face: the cast sheet; a GIF: the reactions sheet; the doors |
| 4 | **Your games** | One mini per game (below), each an excerpt of its game page's This week card, in the game's own measure; never a sum across games | The mini: the game's page; a mini's lineup row: the matchup sheet on that week |
| 5 | **Ep N+1** (the next episode) | Only what plans it while it's days away: Watch along (opens at airtime), Watch it together (plan with the couch), your bingo card | Each its sheet |
| 6 | **Stats** | The show's own facts through your mark (stat of the week, two leaders) | All stats |

What's after an episode, before you've revealed it, lives in the progress control (results in: Reveal Ep 5) and in Last time's
place: **Waiting for results** with its three stages (aired, early, final) while they're on their way, and the morning update once
final scores land after an early reveal.

### A game's mini

The mini is the game page's This week card at a glance's distance ([step 2](step2-game-page-spec.md)): who you play or where you
stand, the last result, and your lineup's contributions one tap open. The data round's lineup component A (the expandable ledger)
is its surface; B (two lineups on one points scale) is the matchup sheet it opens.

| Game | The mini's line | The line under it | Expanded (the ledger) |
| --- | --- | --- | --- |
| Head to head | "Ep 6 · You 1–2–1 vs Cy 0–4" (faces) | "Ep 5 · Lost to Di −3 to 0" | Your starters for the last episode with each one's points, then theirs; the bench's cost when it cost the week |
| Points (lineup, best ball) | "2nd of 4 · 3 behind Bo" | "Ep 5 · +6 · best week 9" | Your starters' points for the last episode |
| Survival pool, pick'em | "Survived · streak 5" or "Out at Ep 4" | "Ep 5 · you picked Ori" | Who everyone picked, once it's aired |
| Outlast | "1st · 2 of 3 still in" | "Ep 5 · lost Carter" | Your team, still in and out |
| Questions, calls, bingo | "3 right of 5" / "1 line" | "Ep 5" | Each answer and whether it was right |
| Solo | "12 pts so far · best week 6" | the last episode's points | your starters' points |

A mini whose game has a move due says it in its own line ("Your lineup isn't set"); the strip still holds the yellow. A game you
haven't revealed past shows nothing past your mark.

## By situation

The first view is the show bar and the strip; then Last time or what replaces it.

| Situation | Progress control | Strip | Under it |
| --- | --- | --- | --- |
| `show-due` · lineup due, caught up | Through Ep 4 · Ep 5 · Sun 8:00 PM · in 2 days; the couch at 4 | **Set your lineup for Ep 5** · locks Sun 8:00 PM | Last time · Ep 4; Your games (vs Bo); Ep 5's plans |
| `show-set` · set, waiting | as above | All set for Ep 5 | as above |
| `show-locked` · on air, live only | Ep 5 · on air now · **Watch along** | Locked for Ep 5 | Last time · Ep 4; Your games (both lineups locked) |
| `show-results` · revealed | Through Ep 5 · Ep 6 · Mon 8:25 AM | **Set your lineup for Ep 6** | Last time · Ep 5 (who left, GIFs); Your games (Ep 5's result, Ep 6's opponent) |
| `show-early` · early results, revealed | Through Ep 5 · final scores at noon tomorrow | per the moves | Last time · Ep 5, its games marked early |
| `show-behind` · two behind | Through Ep 3 · 2 behind · **Reveal Ep 4** | Your lineup for Ep 6 · after you reveal Ep 4 | Last time · Ep 3; Your games as of Ep 3 |
| `show-friend-behind` | the opponent's face behind yours on the scale | per the moves | Your games: "Bo hasn't watched Ep 4 yet" |
| waiting for results (just aired) | Ep 5 just aired | per the moves | Waiting for results (the stages) in Last time's place |
| watching only, behind | Through Ep 3 · Ep 4 and 5 are out · **I watched it** | none | Last time · Ep 3; Ep 4's watch along; no Your games (a quiet "Play a game on this show" lives on the Games tab) |
| several games, a loss to replace (the zt couch) | Through Ep 5 | **Replace Carter · set your lineup** | Your games: Outlast, Weekly Lineup, Survival Pool |
| own pace | Through Ep 3 of 13 · **Watch Ep 4** or **Reveal Ep 4** | the pick for Ep 4, before you watch it | Last time · Ep 3 |
| solo | your mark, no faces | per the moves | Your games, no couch reactions |
| a streaming drop, before it | Drops Fri · in 3 days · all 8 at once | none | the drop's countdown in Last time's place |

## The drill tree

| Level | Questions brought to it | Holds today | Verdict |
| --- | --- | --- | --- |
| Tonight | Is anything for me; where's everyone; how did last week go | Eleven blocks over 4–5 screens: phase heading, move carousel, Up next, Last time, Stats, Extras, Watch along card, plan invite, Your games tiles | **Restructure**: six blocks, two of them shared parts |
| The progress control | How far am I; what's next; who's ahead | A header chip, the couch line's numbered faces, Up next's plate, the phase heading | **New display**: one episode scale for you and the couch |
| Where everyone is | Who's where, who's watching now | The where sheet (a list by mark) | **Keep**: it is already the fuller pace view the brief asks for, and each row opens the person |
| A person | What they watch, how far | The person sheet | **Keep**: the round 5 shared person part decides it |
| The strip and Your moves | What's due, by when, set it | The dock, Tonight's carousel, the sheet | **Restructure**: one strip; the sheet stays and gains a door to each game's page |
| Last time | What happened, what did my couch think | "Episode 5" with an OUT plate and "Your night" lines; GIFs in Extras | **Restructure**: the episode, its reactions and its talk together; each game's result moves to the minis |
| A game's mini | Did I win; who next; why | A tile with a place and a line, separate from "Your night" | **New display**: the matchup or standing, the result, the lineup ledger on expand |
| The matchup sheet, the game page | Why the score | Step 2's | **Keep**: approved 2026-11-15 |
| An episode's page | Everything that happened | Episodes tab | **Keep**: the Episodes round (step 4) |
| The reveal | Catch up across every game | The full-screen reveal | **Keep**: the Episodes and reveal round |

## Left off Tonight, and where each went

- The phase heading ("EPISODE 6 · Wed 8:00 PM · in 4 days"): the progress control says the next episode once.
- The header chip: the progress control.
- The move carousel and its numbered cards: the strip and Your moves.
- Up next's plate and its "You're 2 behind" tag: the progress control's action and its words.
- "Your night" lines under Last time: the game minis.
- The Your games tiles and Standings link: the minis; standings are the game page's.
- Start a game: the Games tab (Phase 0: never in Tonight's first view; a game's start lives with the games).
- Extras' GIF row: Last time; its bingo card: the next episode's block.
- The big Watch along card on art: the progress control's action once the episode is out; the next episode's block before.
- The dock on every other tab: the strip.
- The spoiler line on Episodes, Games, the people and Chat: the compact progress control.

## Kept as they are this round

Each keeps its place under the strip and is listed so nothing is lost: the own-pace plates and catch-up strips (their pick,
watch, reveal order is the own-pace lens's own round), the waivers-ran plate, Fill it in, the reminder ask, and a show you don't
follow's Add to my shows card. A failed read says so with Try again (BACKLOG 85).

## Open questions

- On the other tabs, does the strip stay put when you scroll (sticky under the bar), or scroll away with the content?
- B3 asked for "You're all set" that disappears after five seconds; the strip keeps it as a quiet line instead. Is a lasting line
  what was meant?
