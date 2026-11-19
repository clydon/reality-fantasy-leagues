# The pieces a game's page can't play yet: page spec (Round 5, for B2)

## The job

A game's page lets each person make every move their game asks and see each of its twists count: what they chose, what it did,
and what they have left. Seven pieces the wizard can make are named on the page today but can't be made there or never show what
they did (the explorer plan's Designs needed 10, 21, 24, 26, 27, 28 and 30). Each gets the same three places the page already has
for a lineup or a pick:

- **Made:** in Your moves (the sheet the page's strip opens), beside the move it belongs to.
- **Counted:** on a person's sheet, in the episode it counted in, and as a mark on the season grid where the grid can hold it.
- **Left:** what the piece still allows (lives, mulligans, a buy-back, a budget, a captain carried), said where the move is made.

People:
- **Conor** tinkers. He names a captain every week, reads his sheet after each episode to see what the armband earned, and checks
  what everyone paid at the auction.
- **Joanna** forgets. Her lineup carries from week to week, so her captain must carry too, and the page must say plainly when
  there's no captain or her second pick is still open.
- **Andrew** drives by. He opens the page once an episode: where does he stand, is he still in, and was his pick forgiven.

## The seven pieces

| # | Piece | Made (Your moves) | Counted (a person's sheet; the grid) | Left |
| --- | --- | --- | --- | --- |
| 1 | **A captain** (DN 24) | The lineup's starters; under them one line, **Captain**, choosing one of the starters. The captain's tile is tagged Captain. Carried with the lineup until changed; benching the captain clears it, and the line says "No captain" | The week: the captain's row first, tagged ×2, its points as doubled ("+11 · ×2"). The grid: unchanged (its square is the week's total) | "Captain carries to Episode 4 unless you change it" |
| 2 | **A pool's second pick** (DN 27) | The pick sheet takes two: **Your pick**, then **Second pick**, never the same person, the second optional. Its rule beside it: "Counts if two or more go home" | The episode: both picks, the second marked "Counted" or "Didn't count: one went home", each right or wrong. The grid: the night's outcome (a wrong second makes the night wrong), with a small second face when one counted | Nothing (a second pick is per night) |
| 3 | **Group slots** (DN 28) | The lineup's slot under the starters: what it holds now (the group, its people's faces, "riding" or "dropped: re-paired after Ep 2"), and, when it's open, the groups on offer going into the episode, each with its people and, in an exclusive game, who holds them. The page's in-place picker stays the strip's first move when a slot is empty | The week: the slot's row after the starters, its group and points ("Finley & Cameron · mean of 2 · +1.5"), or why it scored nothing ("Void: they didn't play as a pair"). The grid: unchanged | "Riding until the show re-pairs them" |
| 4 | **An auction's prices** (DN 30) | (The draft room's: unchanged) | Your team (the page) and anyone's team on their sheet: each castaway's price ("Won at 12", "Filled at 1"), the team's total ("Spent 87 of 100") | What's left of the budget, where the game spends again (a salary cap's room, as today) |
| 5 | **Beat the bot** (DN 21) | The questions, as today; the rider in the rule's words: "2 points if you're right and the bot said something else" | Each settled answer on a person's sheet: the bot's call under it ("The bot said Cameron too: nothing" or "The bot said No: you beat it"). The page: one line under the grid, **Against the bot**, each person's beat and beaten on one scale, and the bot's own right calls | Nothing |
| 6 | **Knocked out** (DN 10, with DN 7's out state) | Nothing: no lineup or pick is offered once you're out (BACKLOG 47), and Your moves doesn't list the game | The hero says your finish ("Cut after Episode 1 · 4th of 4 · 2 pts") and what's still yours: the standings play on, your people still in the show. The grid keeps you below the cut line, dim | "Your 2 pts stand. Ann, Bo and Cy play on" |
| 7 | **A pool's lives, mulligans and buy-back** (DN 26; a skipped night, DN 29, is one more mark of the same set) | The pick sheet's line under its title: "1 life left · 1 mulligan left · buy back once for 3" (only the parts the pool has) | The episode: the night in words ("Wrong, forgiven: your streak carried on", "Wrong: out of lives, bought back in for 3 points", "Skipped: nobody left you hadn't picked"). The grid: a forgiven pick and a bought-back night marked apart from a plain wrong; a skipped night apart from a miss | The same line, and the hero's "Out since Ep N" as today when the lives are gone |

**How it plays** says each piece in the game's own steps where it doesn't yet: "Name one starter your captain: they score double"
(it's in the summary only today).

## By situation

| Situation | What changes |
| --- | --- |
| Your move open, nothing named yet (a first week) | The captain line reads "No captain yet"; a second pick reads "Second pick · optional"; an open slot reads "Pick a group" |
| Your move carried (Joanna) | The captain carried with the lineup; the line says so. A second pick never carries (it's per night) |
| Catching up (own pace) | Each piece at your own episode, as the lineup and pick are today. Nothing past your mark: another seat's captain, second pick or slot shows only from its lock, the bot's call only once the question is closed for you |
| Exclusive game | A slot's groups say who holds them; an auction's prices are each team's own |
| A sport's lineup | The captain line works with a lineup's slots (QB, RB): the starters by name and position. A lineup that locks game by game has no captain (the engine refuses one) |
| Knocked out of a pool | The hero's "Out since Ep N" (today's), with the night's words on the sheet ("Wrong: out of lives"); buy back where it's still open, as today |
| A 30-episode season | The grid's marks fit a square at 30 columns: one glyph each, no words in the square |
| Someone else's sheet | Their captain, slot, prices, second pick and bot line, from the lock; their moves before the lock stay hidden as today |

## The drill tree

| Level | Questions brought to it | Holds today | Verdict |
| --- | --- | --- | --- |
| Your moves › a lineup | Who starts; who's my captain; what's in my slot | Starters and bench as tiles | **Restructure**: a Captain line and the slot under the tiles; the captain's tile tagged |
| Your moves › a pick | Who survives; my second pick; what I have left | One pick from a grid | **Restructure**: two named places to fill, the pool's parts as a line |
| The page's hero | Am I still in; what's my move | The move's strip; a pool's out | **Repaint**: the out state for any game you're knocked out of, your finish in it |
| The season grid | How did each night go | A square a night | **Repaint**: marks for forgiven, bought back, skipped and a counted second; the cut line kept |
| Under the grid | How does the couch do against the bot | Nothing | **New display**: Against the bot, each person's beat and beaten on one scale |
| Your team (the page) | Who's mine; what they cost | Name, status, points | **Repaint**: each one's price; the total spent |
| A person's week (a lineup) | What scored; what the captain and the slot did | Started and bench with points | **Restructure**: the captain first, ×2; the slot's row after the starters |
| A person's episode (a pool) | Was I right; did the second count; was it forgiven | One pick, right or wrong | **Restructure**: both picks, the night's outcome in words |
| A person's answers | Was I right; did the bot say it too | The answer, what was right, the points | **Repaint**: the bot's call under each settled answer |
| How it plays | What are the rules | Steps; the captain only in the summary | **Repaint**: the captain's step |

## Spoilers

Every piece reads the viewer's own copy at their mark (the page's rule). A captain, a second pick and a slot are moves: another
seat's show from the lock, never before. The bot's call shows once the question is closed for you (the questions route's rule). A
forgiven or bought-back night is a result: it shows only once you've seen that episode.

## Out of scope

- The draft room's bidding (an auction's sealed bids are the draft room's design).
- Side bets, season-long answers once settled, and the other Designs needed items: their own round.
- Changing a captain or a slot after the lock (the engine refuses it).

## Open questions

1. When nobody is named captain, should the page name one for you (the top scorer of your starters) rather than let the double go
   unused?
