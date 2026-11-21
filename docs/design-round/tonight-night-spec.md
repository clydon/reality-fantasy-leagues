# Tonight's games: the night, everyone in it (page spec)

## Three places, three jobs

| Place | Job | Question it answers | Holds games' results? |
| --- | --- | --- | --- |
| **Tonight** | The night | "What happened last episode, to me and to everyone?" and "what's on next?" | Yes, the last episode's, for the games you're in |
| **Games tab** | What you can play | "What can I play, and how do I get in?" | No: your place per game in a line, nothing more |
| **A game's page** | The season | "How's the whole game going?" | Yes, the full table, every week, the graphs |

The Games tab becomes the way into games for everyone on the show: quick games for the next episode first (yours, the couch's
you could join, start one), your season games as one line each, season games you could join, start a season game, your
record. Its leaderboards and Last picks leave it: the night moves to Tonight, the season stays on the game's page. Its full spec
is the next page of this round.

**A quick game** is a game that plays one episode (a span of one: `oneGame`). It is the smallest step into playing: one move, over
the same night, a winner by morning. **A season game** plays more than one episode and is read as a place in a table.

People:
- **Joanna** (forgets) opens Tonight days later: "did anything happen to me?" A glance, no taps.
- **Andrew** (drives by) wants who won and whether his pick survived, then leaves.
- **Conor** (tinkers) opens every card: who started whom, who moved, why.
- **Casey** (only watches) has no games: Tonight is the show with the couch, and one honest way into a game.

## Tonight, top to bottom

| # | Block | Holds | Change |
| --- | --- | --- | --- |
| 1 | The show bar and progress control | as step 3 | none |
| 2 | The strip | as step 3 | none |
| 3 | **Last time · Ep N** | who left, the couch's GIFs, Discuss, Recap | none |
| 4 | **Your night · Ep N** (players only) | a card per season game you're in; then the night's quick games you played; then the night's extras anyone played (bingo, trivia) | **new display** |
| 5 | **Next · Ep N+1** | watch along, watch it together, your bingo card; **quick games for Ep N+1**: yours (their state) and the couch's you're not in (Join) | gains the quick games |
| 6 | Stats | as step 3 | none |

Block 4 is the night as it stands at your mark (`latestSeen`): the same episode Last time names. Waiting for results, early
results and the morning update keep their place above it (AfterEpisode); with early results, block 4's numbers say "so far".

### A season game's card, closed (the glance)

Every card is closed when Tonight opens. Closed, it answers "how did my night go?" in the game's own measure, and shows the
couch in one line.

| Part | Holds | Opens |
| --- | --- | --- |
| Head | The game's colour dot and name | The game's page |
| Your standing | Your place now, how it moved this episode (up 2, down 1, held), of how many | the card |
| Your night | What the episode did for you, in the game's measure: "+4 pts", "Survived · 8 in a row", "Lost Carter · 2 of 3 still in", "Beat Riley 12–9" | the card |
| Your picks that night | Each one a face with its result on it: a lineup's starters with their points, a pool's pick stayed or went home, a team with who left crossed out (up to five faces; more as "+3") | a face: its castaway's sheet |
| The couch line | The night's one piece of news about someone else, when there is one: "Sam's pick went home", "Riley had the night: +11", "Casey lost Ana" | the card |
| Open | "Everyone's night" with a chevron | opens the card in place |

Each fact is said once on the card: "streak 8" or "3 of 3 still in" never appears twice.

**The couch line, which news:** someone's pick went home (a pool), else someone lost a castaway (a team game), else whoever had
the couch's best night when it isn't you (`Square.best`), else nothing (no line rather than filler).

### A season game's card, open

| Part | Holds | Opens |
| --- | --- | --- |
| Your night, in full | The step 3 ledger for a lineup (each starter: face, name, what scored, a bar on one scale; the bench faint); a pool's pick with what happened to them; a team with who left tonight and who's still in | each face: its castaway's sheet |
| Everyone's night | Up to five people (the rule below), in standings order after the episode: place, movement, face, name, their picks as faces with results, their night's change; the couch's best night bright | a person: their sheet in that game at that episode; a face: the castaway |
| See all | "See all 10" when the game has more than five people | the game's episode sheet (Everyone's night, ‹ › through episodes: game-sheets.tsx EpisodeBody) |
| Close | the head's chevron turns back | |

**The five rows:** five people or fewer, everyone. More than five: the top five when you're in them; otherwise the top three,
the person just ahead of you, and you, with a gap mark between the third and the fourth row. You are always in it.

**Head to head:** everyone's night is the episode's matchups (yours first), each as two faces, two scores, the winner bright,
opening the matchup sheet (two lineups on one scale). The standings line stays on the card head ("3–2 · 2nd of 6").

**Order of cards:** games where something happened to you this episode first (a place moved, a castaway lost, a streak ended or
grew, a matchup decided), then the rest, each group in the Games tab's order.

**Many games:** three cards, then one fold row ("4 more games" with each game's place as a chip), opened in place to the rest
of the cards. The section holds its height for any number of games.

### The night's quick games (one-episode games that played Ep N)

One card each, the same card in its quick-game form: the head names the game and "Ep N"; the standing is the result ("Riley
won", "You won", "Tied: you and Riley", "Nobody scored": resultWords), your place under it; your picks that night; open: everyone's
night as above. Past three quick games, they fold to one row ("Ep 9's 5 quick games: you won 2"). Finished quick games older
than Ep N live in the Games tab's record.

### The night's extras (bingo, trivia)

Shown to everyone who follows the show (player or not), when anyone on the couch played them. One card, a line each:

| Extra | The line | Open |
| --- | --- | --- |
| Bingo · Ep N | each player a small three-by-three card (ticked squares filled, counted lines drawn), lines counted; who got a line first named | each person: their card (step 3's Look at their card) |
| Trivia · this week | each player's score as dots (2 of 3); scores only, never answers | your round (play it, when you haven't) |

You appear in each line you played; one you didn't play shows the couch's and nothing for you (no "you missed it"). Call it,
predictions and polls stay off Tonight (the user, 2026-11-09: until a session on extras brings them back).

### Next · Ep N+1: the quick games

Under the next episode's plans, one row per quick game for it:
- **Yours:** the game's name and your move's state ("Answered", "2 to answer", "After you reveal Ep 9"); the strip keeps the yellow.
- **The couch's you're not in:** the game's name in plain words ("Who goes home? One pick"), who's in as faces, when it locks,
  and **Join**. One tap joins and opens your move.

No quick game for Ep N+1 on the couch: no row on Tonight (starting one is the Games tab's). Watching only, with a season game on
the couch still open to join and no quick game: one row for it, its faces and Join.

## Watching only (no games on this show)

Blocks 1, 3, 5 and 6, and the extras' card when the couch played them and you follow the show. No results, standings or picks
from any game you're not in, anywhere on Tonight. The way in is block 5's rows: the couch's quick games for the next episode, or a
season game open to join. They read as part of planning the episode, not a banner, and they ask nothing twice: no dismiss, no
count, no reminder.

## The encouragement, by ease and spirit

- **The smallest step first:** quick games come before season games everywhere a game is offered; their words say what they ask
  ("One pick, done tonight").
- **Friends are the reason:** who's in, as real faces; never a count of strangers, never "people like you".
- **One tap:** Join takes no setup; a quick game's move opens straight after.
- **Honest timing only:** when it locks. No countdown that resets, no "spots left", no "last chance".
- **Celebrate, never scold:** a winner is named on Tonight and in the reveal; nothing says "you missed out", no streak warning,
  skipping costs nothing.
- **Points stay as they are:** couch points already count joining and playing; nothing here adds to them or shows them.

## Motion

What changed animates once, the first time a card scrolls into view after a new episode: your place counts from where it was to
where it is, the movement arrow slides in, the night's bars grow from zero, a bingo line draws through. After that the card is
still on every visit, until the next episode. Nothing else on Tonight moves as it scrolls. With reduced motion, nothing moves.
Which episode a card has played its change for is remembered on the device; forgetting it only plays it once more.

## By situation

| Situation | Block 4 | Block 5 |
| --- | --- | --- |
| Revealed, three games (the zt couch, Ep 6) | three closed cards, the moved ones first | Ep 7's plans |
| One card open (Weekly Lineup) | your ledger, then five rows of everyone | |
| A pool open | everyone's pick, stayed or went home | |
| A team game open (Outlast) | everyone's team, who left tonight crossed out | |
| Head to head | the episode's matchups | |
| Seven games | three cards, then "4 more games" | |
| Ten people, you 10th | 1, 2, 3, gap, 9, 10 (you); See all 10 | |
| A friend behind, own pace | their row: "Hasn't watched Ep 6": no pick or change until their move locks | |
| You behind (two episodes) | as of your mark: Ep 4's night | |
| Quick games played Ep 6, extras played | quick games' cards; the extras' card | |
| A quick game for Ep 7 you're not in | | its row: faces, locks Wed 8:00 PM, Join |
| Watching only | none | the couch's quick game for Ep 7, Join |
| Watching only, nothing to join | none | plans only |
| Early results | numbers marked "so far" | |
| Solo | your cards; everyone's night lists computer players when there are any, else no open | |

## The five lenses and the flavors

- **Own pace:** everything is at your mark (GhostLogic.viewFor); someone behind you is named as not there yet, and their move
  stays hidden until it locks; your own pace moves the block with your reveal.
- **A shared draft:** the same castaway can appear in several rows; each row is that person's.
- **An exclusive draft:** a team game's rows are each person's own team; who left tonight is the news.
- **Stages:** one card per game, its standing the overall; the night is the stage that played (named on the head).
- **Spoilers:** nothing past your mark, a friend's mark never unlocks anything, and no row shows an episode you haven't seen.
- **Secret roles:** a row shows points, never a role or a role's points apart.
- **Competition shows** lead. **Story shows:** no one leaves; the cards are predictions and calls, the extras matter most.
  **Sports** keep their own parts (watchers-and-players): the sports check proves a nine-starter lineup's card holds (the top
  three contributors, then "+6") and leaves the sports card's design to the sports pass.

## The drill tree

| Level | Questions brought to it | Verdict |
| --- | --- | --- |
| Tonight's game section | Did anything happen to me; how did everyone do | **New display**: closed glance, open night |
| A card, open | Who picked what; who moved; why | **New display**: an excerpt of the episode sheet |
| The game's episode sheet (Everyone's night) | Everyone, any episode | **Keep**: it's the full list "See all" opens |
| A person's sheet at that episode | Their night, their season | **Keep**: the drill pass's |
| A castaway's sheet | What they did | **Keep** |
| The matchup sheet | Why the score | **Keep** |
| A bingo card, the calls sheet, trivia | One person's card, the calls, your round | **Keep** |
| The game's page | The whole season | **Keep**; reached by the card's head |

## Data the page needs

| Need | Where it is | Missing |
| --- | --- | --- |
| Everyone's play on Ep N, by kind | `GameView.plays.rows` (pick, held/left, result, points, best), table rows' `weeks` (a lineup's starters) | nothing |
| Each person's place before Ep N | the reveal computes it (`revealIn`: the view at n − 1) | a `was` place on each table row in the games read |
| Who's behind in your games | `GameView.waiting`, the couch's marks | nothing |
| The couch's quick games you're not in, who's in | the couch's games read (`JoinGame`) | the faces of who's in |
| Everyone's bingo for Ep N | per person counts (`EpisodeBingo.people`); one card per read (`?of=`) | everyone's ticked squares and counted lines in one read |
| The couch's trivia scores | the trivia read (`TriviaRound.couch`) | nothing |

## Left off Tonight, and where each went

- "Who scored · Ep 9", a toggle under a mini: the open card's Your night.
- The mini's second line repeating the first ("streak 8" twice, "3 of 3 still in" twice): said once.
- "Ep N's results" under Your games (TonightNights): the night's quick games' cards.
- "For Ep N+1" rows under Your games: block 5.
- The Games tab's leaderboards and Last picks (next page): the open card here and the game's page.

## Open questions

- None owed by the user for this page.
