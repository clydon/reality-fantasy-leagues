# The pieces of a game

A guide for anyone thinking up games for Game Your Show. It says what every piece of a game is, what each one can be set to,
what it goes with, what our check refuses and why, and how a typed idea becomes a game. Read it instead of the code when you
want the bigger picture: the code is `src/lib/game/game-spec/` (the schema, `schema.js`, and its types, `index.d.ts`), and the
field names here (in backticks, after the plain words) are the ones to search for there.

**Keep it current.** Every engine step that adds or changes a piece updates its entry here, in the same commit (the plan's
track C, 2026-11-05). Something marked **planned** isn't built yet; its step is named.

Every example below was run through the engine (2026-11-05, against Survivor 51's, The Challenge 41's or The Traitors 4's
rules): the ones that play give the engine's own sentence for them, and the ones refused give our check's own words.

---

## A game in one look

A game is data, a **spec**: the same object whether it was tapped together on Start a game, pasted in the engine lab, or (once
G1 lands) drafted by the bot from someone's words. The engine scores from it, and the game's sentence, its How it works and its
settings are all read from it. A league carries its spec as `settings.game`.

```jsonc
{
  "spec": 1,           // the version
  "preset": null,      // the preset it started from ("outlast", ...), or null
  "span":   { ... },   // which episodes it plays                      → When it plays
  "pool":   { ... },   // who can be picked                            → Who can be picked
  "get":    { ... },   // how you get what you hold                    → What you hold
  "count":  { ... },   // what of yours counts each episode            → What counts
  "score":  { ... },   // how what counts earns points                 → How it scores
  "rank":   { ... },   // how the table is ordered and who wins        → How you win
  "ask":    [ ... ],   // questions answered before their lock         → Questions
  "closes": "start",   // moves lock when each episode starts; a sport's `daily` or `weekly`: at the day's or week's first start
  "extras": { ... },   // the details nobody asked about               → The extras
  "stages": [ ... ],   // a game in stages instead: 2 to 6 games       → Stages
  "overall": { ... },  //   and how their tables add up
  "card":  { ... }     // a new card each episode (C7), for questions on it and the week's objectives → A new card each week
}
```

Anything a spec leaves out is filled in (`fullSpec`): from its preset while the spec still gets its people the preset's way,
otherwise from the defaults. So `{ "preset": "weekly-lineup", "count": { "start": 2 } }` is a whole Weekly Lineup that starts two.

Three things decide whether a spec is a game (`src/lib/game/game-spec/schema.js`):

- **`specProblems(spec, ctx)`**: what's wrong with it. Its shape, what goes with what, the size limits, and, given the show's
  context (`ctx`: its moments, phases, roles, cast size, couch size), **the data-can-settle rule**: only what data can settle
  scores (below).
- **`specWaitsFor(spec)`**: what it needs that isn't built yet (a value only the sports branch or a later step builds), or,
  when every part is built, a piece with no place in the scoring sequence: "No game plays this way yet: ..." naming the piece
  and why (since C2 part 4: "a pool's picks are its game: questions beside them play in a stage alongside it").
- **`typeOf(spec)`**: the shape the screens name it by, worked out from its pieces: it plays when each piece it names has its
  place in the scoring sequence (C2 part 4, "playing by placement": see "How a game is scored: the sequence"), and is named by
  its lines: an Outlast-style draft (`classic-draft`), a draft scored by moments (`active-roster`), a pool (`pickem`), Weekly
  Calls, Weekly Bingo, a game of questions (`questions`) or a game in stages (`stages`). The screens read that name until R3.

`describeSpec(spec, ctx)` then says the game in plain words: a sentence, How it works (a rule a line) and the details nobody
asked about.

---

## When it plays: the span

Which episodes of the season the game plays. **`span: { from, to }`**.

- `from`: an episode number (1 or later), or a phase of the season's rulebook, `{ "phase": "merged" }`, which waits until the
  data says where that phase starts (the desk confirms it; it's then `{ phase, at }`).
- `to`: an episode number, `null` for the season's end, or a phase it ends before, `{ "phase": "merged" }`.
- Refused: a phase that isn't the season's, its first phase (that starts with Episode 1: start there), an end before the start,
  ending where it starts.
- Example: "from the merge on": `"span": { "from": { "phase": "merged" }, "to": null }` → "...from when Merged starts".
- Goes with everything. A question about the season's end (who wins, the final three, the jury's vote) needs a game that runs to
  it (`to: null`).

## Who can be picked: the pool

**`pool: { of: "cast", where }`**. Today always the cast, `where: { "stillIn": true }` (nobody gone before the game starts) or
`null`. A sport's `{ teams: [...] }` is the sports branch's; a pool of one group, `{ group: id }`, has no step yet.

---

## What you hold: `get`

How each of you gets what you play with. Five ways (`get.by`):

| `get.by` | What you hold | Today |
|---|---|---|
| `draft` | a team of people, for the game (or until you swap them) | plays |
| `pick` | one person, picked fresh each episode | plays |
| `card` | a bingo card, a new one each episode | plays |
| `none` | nothing: you answer questions | plays |
| `squares` | a grid of a team game's two scores' last digits (`grid` 10 or 5), its squares picked (`take: 'pick'`, up to `each`) or dealt at random (`deal`), the digits drawn at the lock (L4 part 2: `sequence/squares.js`) | scored by `squares` alone, nothing counting; the sports branch |

### A draft: `{ by: "draft", each, order, own, ... }`

- `each`: how many each (1 to 10 for a team scored by place; up to 14 for a lineup, starters plus bench).
- `order`: how the draft runs.
  - `snake`: turns, for people nobody else can have (an exclusive draft).
  - `blind`: everyone picks in private, revealed at once (a shared draft).
  - `draw`: names out of a hat, dealt at random when the draft starts, seeded and recorded; exclusive or shared.
  - `auction`: sealed bids from a budget (exclusive only; its shared version is a salary cap).
- `own`: `exclusive` (one team's each) or `shared` (anyone can have the same person). See "Ownership" (each way of holding has
  its own since C4: the draft's here, its group slots' beside them, its waiver moves' on the waivers).
- Refused: a snake that's shared or a blind draft that's exclusive ("An exclusive draft is snake: everyone takes turns for
  castaways nobody else can have"), an auction that's shared.

Beside a draft, optional:

- **Group slots** `groups: { slots, own, swap, fallback, points }`: 1 or 2 more roster slots that each hold a pair or team the
  show forms. A slot opens after the episode that announced the groups and scores from the next, rides with its group while it
  lasts (a group is its exact members: any change ends it) and drops when it changes; when the show re-pairs everyone, or goes
  each for themselves, every slot drops at once. `own` shared (the default) or exclusive (only while the groups on offer cover
  every slot); `swap` whether a slot can change group while its group lasts (default false); `fallback` for an episode whose
  groups aren't sure: `void` (default), `carry-on` (follow the people) or `next-stage`; `points` the members' `mean` (default: the
  slot scores like one more person) or `sum`. Only beside a draft scored by moments ("A group scores what its members do: group
  slots go with a draft scored by moments"). Example on The Challenge 41: `"groups": { "slots": 1 }` → "...plus a slot for a
  pair or team the show forms".
- **A spread** `across: { of: "group", then: "keep" }`: drafted across the show's groups as the data has them when it drafts (one
  from each tribe: no more than ceil(each / groups) from one). A drafted person stays yours wherever they go after (`then:
  keep`). `of: "gender"` is refused: nothing in any show's data says who is a guy or a girl.
- **Prices** `budget: { total, floor, ... }`: everyone's `total` (1 to 1,000) and the lowest price or bid (`floor`).
  - With `order: "auction"`: what someone costs is the winning bid; a team the bids didn't fill is filled at the floor or left
    short (`fallback: fill | short`).
  - With any other order, a **salary cap**: each person's price comes from their points so far by the game's rules, `floor` to
    `ceiling`, and a team's prices together stay within `total`; someone gone home counts as nothing or their last price
    (`gone`: `zero` or `last`). Needs a draft scored by moments (scored by place, everyone still in has the same points).
  - Add `trade: { fee }` for a **stock market**: buy and sell each week at the data's prices; its trades are its waiver windows'
    swaps; rank it by `worth` (cash plus your team at today's prices). The draft's money left over (`left`) is `cash` (to
    trade with), `lost`, or `bids` (bidding on waivers: no step yet).
- **Keepers** `keep: { each, from, cost, fallback }`: a game that continues the couch's game on an earlier season (`from`, its
  league id), each of you keeping up to `each` of your team there who are back. A keeper costs a place on the team, one of a
  snake's earliest rounds (`round`, snake only), or their price (`price`, a salary cap or a market). Someone who names nobody
  keeps their best who are back (`best`) or nobody (`none`).

### A pick: `{ by: "pick", each, repeat, ... }`

People picked fresh each episode, no draft. Two games ride on it, by how the pick scores:

- **The pool** (`score.by: survive`): one person each episode you think survives it. Its `each` is 1 ("A pool's pick is one an
  episode: several each episode are scored by what they do").
- **A pick scored by what they do** (`score.by: moments`, since C5): 1 to 8 people each episode (`each`), each scoring their moments
  in it as a lineup's starters do, by the rulebook's points or only the moments the game names (`score.only`, `score.hits`, below).
  "Each week pick three castaways; only immunity, reward and idols count" is `{ "get": { "by": "pick", "each": 3 }, "count": {
  "pick": true }, "score": { "by": "moments", "only": [...], "hits": "pick" } }`. Picks lock as each episode starts; nobody's
  drafted, so two of you can pick the same person. It ranks by its points, weeks won or head to head (in teams, with a handicap);
  not knocked out or racing yet ("knocking players out, or a race, is a draft's or a game of questions' for now"), and questions
  beside it play in a stage alongside it, as beside a pool. A captain is a lineup's.
- `repeat`: `cycle` (nobody again until you've used everyone still in, never twice running: a pool's default), `never` (nobody twice
  in the game), with `fallback` for a night you've picked everyone still in: `miss` (a missed pick) or `skip` (nothing counts that
  night), or `any` (anyone still in, every episode: a pick scored by moments' default, where picking the same star every week is
  the game).
- `second: { fallback }`: a second pick that counts on a night two or more go home; on a night only one goes, `void` or
  `counts`. Only in a pool whose picks stay in.
- How a pool ranks (`rank.by`): its longest streak (the default), last one standing (with lives), or, since C2 part 4b, its
  **points** (`total`: a right pick's, a second pick's that counted, less what a buyback cost) or **head to head** on them
  (`matchups`). Ranked by its points it can be played in **teams of players** and with a **handicap** too (below), all reading the
  pool's series of totals (`PickEmLogic.series`). Not with lives (they knock players out: "A pool with lives knocks players out, so
  it ranks by its streak or last one standing"), nor mulligans (a wrong pick costs nothing to forgive), nor a right pick worth 0.
  "Most right picks wins our Survival Pool" is `{ preset: "survival-pool", rank: { by: "total" } }`: "A point for each right
  pick. Most points wins."

### A card, or nothing

- `{ by: "card" }`: Weekly Bingo. Each episode a new nine-square card dealt from the episode's bank of squares (written by the
  bot before it airs); you tick squares as you watch; a square counts once it happened (two on the couch saying so; alone, your
  word) and you ticked it; a line counts once you call it and its three squares count.
- `{ by: "none" }`: you hold nothing. A game scored by its answers (Weekly Calls, a game of questions, trivia).

---

## Ownership: exclusive or shared

Whether two of you can hold the same person, **for each way of holding** (C4): the draft (**`get.own`**), its group slots
(**`get.groups.own`**) and each waiver move (**`extras.waivers.own`**: `{ replace, swap }`, a replacement for someone gone home and a
swap for someone still in, each left out the draft's own). Exclusive: only someone on nobody's team (a free agent). Shared: anyone
still in who isn't yours already, even someone on another team, who's on both teams then. The user's second game is an exclusive
draft whose replacements are shared: `"extras": { "waivers": { ..., "replace": "always", "own": { "replace": "shared" } } }` →
"Lose someone? Their replacement can be anyone still in, even a castaway on another team: they're on both teams then."

- **Shared whenever the math says so** (the user's decision, 2026-10-28). An exclusive draft only when the pool covers every
  pick (`covers`: teams × each ≤ who can be drafted), counted where the game drafts and as the pool shrinks.
  - **Where the game first drafts**, our check counts it (with the show's cast and the couch) and refuses one that doesn't
    cover, with the reason: "12 of you × 3 picks is more than the 18 who can be drafted: make it shared, so two of you can have
    the same one". A spread draft's smallest group is counted the same way. A shared team (`extras.seats`) counts as one team.
  - **Where it drafts later** (a later stage, a side draft, a second draft at the merge), nobody can count it ahead: it's counted
    when its draft opens, from who's still in then, and played shared if it no longer covers (`RosterLogic.settleDraftShare`;
    nothing is refused). Exclusive group slots likewise hold only while the groups on offer cover every slot.
  - **Per holding** (C4): an exclusive draft that takes everyone, whose replacements are only someone on nobody's team and where
    nothing ever frees anyone (no swaps, nobody knocked out), never has anyone to replace with: refused where it drafts, "6 of you × 3
    picks takes all 18 who can be drafted, so nobody's ever free to replace someone gone home with: make the replacements shared". As
    the pool shrinks later, a replacement with nobody free waits ("Nobody's free to pick up: your team plays as it is"), as it always
    has. A shared move needs no count.
- A waiver move can be shared beside an exclusive draft, never exclusive beside a shared one ("In a shared draft anyone can be on
  more than one team, so a replacement can be too"), and a stock market buys at its draft's own.
- **Someone two of you hold** (a shared game's, or a shared replacement in an exclusive draft): each scores them by their own
  holding (an Outlast's line by what each earned while theirs, when it multiplies how they joined); one letting them go lets go
  only their own; once they're gone home, each holder is owed a replacement until they make it (every game since the user's
  rule of 2026-11-06; a game made before it keeps the exits it had played as they played out: `settings.perHolderFrom`).
- An exclusive draft can't be open to anyone joining ("its castaways are one team's each, so newcomers ask").
- An exclusive stock market needs someone left over to buy.

---

## What counts each episode: `count`

Of what you hold, what scores. One of:

| `count` | What counts | Goes with |
|---|---|---|
| `{ "all": true }` | your whole team | a draft (Outlast) |
| `{ "start": n }` | the n you start each episode (a lineup); the rest sit on the bench | a draft; 1 to 8 starters, a bench of up to 6 |
| `{ "best": n }` | your best n each episode, worked out for you (best ball, no lineups) | a draft; 1 to 8 |
| `{ "pick": true }` | your pick | a pick |
| `null` | nothing is held | a card, or `none` |

---

## How it scores: `score`

How what counts earns points. **`score.by`**:

| `score.by` | Points from | Goes with |
|---|---|---|
| `place` | how long each of yours lasts: 1, plus 1 for every boot they outlast (Outlast) | a draft where everyone counts (`all`) |
| `moments` | what your people do in each episode, by the show's rulebook | a draft (a lineup, best ball) |
| `survive` | a pick that stays in (`means: staysIn`), or that scores (`scores`, a sport) | a pick |
| `lines` | bingo lines | a card |
| `answers` | right answers to the game's questions | `none` |
| `stages` | a game in stages: its stages' tables (see Stages) | a game in stages only |
| `stats` | a sport's stat keys at the game's table: each holding's stat line in an episode is its moments there (`sequence/stats.js` statMoments), so a lineup's starters, a captain, `times` and best ball's best n take it as they take moments (L3 part 2) | a draft (a lineup, best ball, or everyone drafted counting); with `categories`, its rank compares them (below); a pick each episode by its stats not yet (the sports branch) |
| `squares` | each pay's points (`pays: [{ at: a period's end, 'half' or 'final', points }]`) to whoever holds the square of the two scores' last digits then; an empty square pays nobody or rolls on (`empty`), a period never read pays on the final or nobody (`unread`) (L4 part 2) | `squares`, ranked by the total, nothing beside it; the sports branch |

Each one's own options:

- **`place`**: `reverse: true`, the earlier they go home the more (1, plus 1 for everyone who outlasts them): "Each scores more
  the earlier they go home: the first one out carries you". `multiply`, how a holding joined (below, "Multipliers").
- **`moments`**:
  - `points`: moment id to points, over the rulebook's own; `null` is the rulebook's own.
  - `only` (C5): a list of 1 to 40 of the show's moments: only they count, every other scores nothing. "Only immunity wins and idols
    count" → "Only two moments count: won the immunity challenge and got an idol or advantage."
  - `hits` (C5): each moment that counts is an objective hit, worth a point (with no `only`, every moment the game scores: points
    never weight a hit, they only say which moments count): `every` (every time one happens),
    `pick` (each objective once for each of yours that hit it, however often they do it) or `objective` (each objective once for
    you, however many of yours hit it: credited to the first of them, so not beside a captain, best ball, a multiplier on how a
    holding joined or group slots: "count hits per pick"). Left out, moments score their points as always.
  - `captain: { times }`: one of your starters, named each episode, whose points multiply (more than 1, up to 10). A lineup
    only ("A captain is one of your starters, named each episode").
  - `times: [{ times, episode | from (to) | phase | finale }]`: when points multiply (up to 8 of them; more than 0, not 1, up
    to 10, so half is 0.5): one episode, a run, a phase, or the finale. An episode in two multiplies by both. Example:
    `"times": [{ "times": 2, "finale": true }]` → "Points in the finale count double".
  - `multiply`: how a holding joined (below, "Multipliers").
  - Captain and `times` are **only** on a draft scored by moments today: `{ "by": "place", "captain": ... }` is refused as
    "captain isn't part of a game spec".
- **`survive`**: `points` a right pick; a pool's lives, buyback and mulligans (see "Lives and saves").
- **`lines`**: `points` a line (1 to 100; 1 when it's left out).
- **`answers`**: `parlays` (below, under "How a question's points combine"); `lives` and `livesOn`, and co-op's `saves` (see
  "Lives and saves").

### Multipliers: one piece keyed by a condition (C3)

Every multiplier is one piece: a factor with its times and the condition that says which lines it multiplies (the sequence's
`factorOf`; game-spec `multipliersOf` lists a spec's). The spec says each where its condition lives, so a stored spec reads as
it always did:

| Condition (`on`) | Said as | Multiplies |
|---|---|---|
| `captain` | `score.captain: { times }` | the captain's line, a lineup's |
| `when` | `score.times: [{ times, episode \| from (to) \| phase \| finale }]` | every line in its window |
| `joined` | `score.multiply: [{ joined, times, per?, then? }]` | each holding's line, by how it joined your team (C3) |
| `legs` | `score.parlays: [{ of, times }]` | each leg's line, when every leg is right |
| `rank` | a `confidence` answer | each right pick, by its place from the bottom (its answer's own weight) |

A **streak** (a pool's points growing with it) and **when a holding was picked** (a draft's round) are later.

**How a holding joined: `score.multiply`** (a draft's: a lineup, best ball or an Outlast; up to 3, each way of joining once):

- `joined`: `draft` (drafted, or kept from last season), `pickup` (any mid-season move), `replacement` (a pickup for someone
  gone), `swap` (for someone still in). A pickup is a replacement or a swap, so it isn't said beside them.
- `times`: a number (more than 0, so half is 0.5, up to 10, not 1), or for a pickup, a replacement or a swap a list of 1 to 6 for
  the first, the second and so on (1 allowed in it, not every one).
- `per` (a list's): `team`, your Nth such move (the default), or `slot`, the Nth along the roster spot it fills (a replacement's
  replacement is the second there).
- `then` (a list's): past the list, `repeat` (the last again, the default) or `ratio` (on by its last step: 0.5, 0.25, then
  0.125; on a list that shrinks at the end).
- It multiplies **what each one earns while it's yours** (the user's decision, 2026-11-05): from the episode after the move to
  the one before the move that lets them go. A lineup's moment lines while held. An **Outlast's line becomes what they earn
  while yours**: their place where you let them go (or now) less their place when they joined, so one you drafted and kept has
  their whole place, a pickup the boots they outlast while yours, and someone you let go keeps for you what they earned until
  then. An Outlast without `multiply` keeps today's count (whoever holds someone now has their whole place; someone let go
  counts for nobody).
- Examples: `"multiply": [{ "joined": "pickup", "times": 2 }]` on an Outlast → "Pickups score double." The user's second game,
  `"multiply": [{ "joined": "replacement", "times": [0.5, 0.25] }]` → "Your first replacement scores half, your second a quarter,
  and every one after that a quarter."
- Refused, in our check's words: in reverse ("In reverse, a place is 1 plus everyone who outlasts them, which nobody earns while
  they're yours: a multiplier on how they joined needs Outlast's own order"); beside a stock market ("A stock market's worth is
  its prices, not its points: nothing it holds earns points to multiply"); a way of joining the waivers can't make ("This game
  never replaces anyone: its waivers make no replacements", "This game's waivers make no swaps", "Nobody joins a team after the
  draft in this game: give it waivers that replace or swap"); anything but a draft.

---

## Questions: `ask`

A question is answered before its lock, and data settles it. A game of questions is just questions (`get: none`, `score:
answers`); a draft carries its finale predictions and (since C2 part 4c) questions of its own beside its team, their points a
line of the draft's (below). A question is:

```jsonc
{ "id": "boot", "ask": "Who goes home?", "answer": "person", "points": 2,
  "asked": "each", "settle": { "by": "results", "take": "out" } }
```
→ "everyone answers one question before each episode: who goes home, all season. 2 points for each right answer."

A question is three choices that combine freely, within what each pair allows: **how you answer** × **what settles it** ×
**its window**. Then how its points combine.

Limits: up to 12 questions a game; an `id` is letters, digits, `.`, `_` or `-`, up to 40; `ask` up to 200 characters;
`points` 0 to 100.

### How you answer: `answer`

| `answer` | You give | Its own fields |
|---|---|---|
| `person` | someone (or `pick` of them, each right one scores) | `pick` 1 to 10; `from`: `cast` (still in, the default) or `team` (your own, a draft's) |
| `group` | a tribe, team or couple (or `pick` of them) | `pick` 1 to 10 |
| `yesNo` | yes or no | |
| `number` | a number: the closest wins, ties all score | |
| `overUnder` | over or under a line | `line` (null: the wizard asks) |
| `choice` | one of the options ("0", "1", "2+") | `options`: 2 to 12; a count's are numbers or ranges, a yes or no's are Yes and No |
| `order` | an order (the boot order, a leaderboard) | `pick` 2 to 24; `within` 0 to 5 places still scores |
| `confidence` | a ranking, surest first | `pick` 2 to 24 |
| `chips` | chips spread over people | `chips` 2 to 100 |
| `split` | a vote split ("5-2-1") | |
| `pairs` | for each pair, who outlasts whom | `pairs` 1 to 12, drawn from who's in at the start; asked once |
| `trivia` | the round's trivia questions (the episode before) | asked each episode |
| `calls` | the show's two calls (Weekly Calls) | a game of its own |
| `ticket` | a ticket (C6): the questions you put on it and a stake, `{ legs: [ids], stake }`, each leg your own answer to it | settled by its `legs` (below); `legs: { min, max }`, `pays`; a stake (`wager`) |
| `side` | one of a team game's two sides (sports): its team's id, the faces the server's (`sidesFor`); `draw: true` takes a draw too (soccer's three ways) | settled `final` `winner` (L3 part 2c) |
| `bracket` | a draw's winners round by round, by distance from the final (`{ "7": [...], ..., "1": [the champion] }`), each right pick worth the points, doubling each round (`rounds: 'double'`, the default, or `'same'`) (L4 part 2: `sequence/bracket.js`) | settled `final` `bracket` of a draw (tennis's `MS`, `WS`...); the sports branch |

**One question about each person still in:** `each: "person"` with a `yesNo`, `number`, `overUnder` or `choice` answer, answered
`{ castawayId: answer }`, each settled by that person's own moment or whether they go home or stay. Example: "each couple's
judges' score: over or under 24.5" on Dancing with the Stars.

### What settles it: `settle`

Data settles every question (the user's rule, 2026-10-27: never the couch's word or the maker's call; the exceptions are the
players' own mechanics below, which settle the game, never a fact about the show).

| `settle.by` | `take` | What it reads |
|---|---|---|
| `results` | `out`, `stays`, `winner`, `placed` (with `place`), `top` (with `place`), `order`, `split`, `outlast` | who went home, who won, where they finished, the jury's votes |
| `moment` | `happened`, `count`, `who`, `most`, `first`, `order` | a moment of the rulebook that research answers (`moment`: its id) |
| `points` | `most`, `order` | each person's points by the game's rules in the episode or window |
| `phase` | `starts`, `happened` | a phase of the season (not its first): the episode it starts, or whether it starts in the window |
| `role` | `who`, `end`, `count` | a secret role (The Traitors' Traitor): who held it, who held it at the end, how many |
| `fact` | `who` | an episode fact research answers after each episode (today one: `titleQuote`, who says the episode's title) |
| `trivia` | none | the episode's trivia key (the bot writes a round after each episode) |
| `calls` | none | the show's calls (Weekly Calls) |
| `players` | `majority`, `minority` | the players' own answers: see "The players' own mechanics" |
| `legs` | none | a ticket's legs (C6): `{ by: "legs", of: [the game's question ids] }`, your own answers to them in the window |
| `final` | `winner`, `total`, `margin` (`of`: a card's bout, `main` its main event) | a sport's game at its final (L3 part 2c): who won (extra time and penalties in it; a field's first, a bout's winner), both sides' points, the margin; a game called off, a tie or a bout with no winner is off. `bracket`, a draw's winners round by round, is the sports branch's still (L4 part 2) |
| `stat` | `most`, `least`, `value` (`stat`: a sport's stat key; `of`: a player or a team) | a stat in a sport's game (L3 part 2c): who has the most (a tie, all of them), the fewest, or a value (a team's players' added; asked once over a span, its games' added up) |

A sport's game settles its questions from the server's facts (`facts.games`: each episode's game as of the viewer's mark, its
kept final once it's final; answer-points.ts serverFacts), and its episode has results once its game is final: the server stamps
`ep.gameFinal` on the copy it reads (sports/score.ts stampStats, StateLogic.StatsLogic: never stored), so the reveal, the week's
results, a viewer's mark and a span's end read it as a show's results, and the spoiler view drops it past the mark (L3 part 2c).

Which answers each settle can grade (`SETTLES_FOR` in the schema): a `person` by anything that names people (`results` out,
stays, winner, placed, top; `moment` who, most, first; `role` who, end; `points` most; `fact` who; `players`; a sport's `stat` most, least and `final` winner, a field's first or a
bout's winner); a `side` by `final` winner; a `group` by
`results` out, `moment` who, `fact` who, `players`; a `yesNo` by `moment` happened, `phase` happened, `players`; a `number` by
a count (`moment` count, `role` count, `phase` starts, `moment` first; a sport's `final` total, margin, `stat` value); an `overUnder` by those or `players`; an `order` by
`results`, `moment` or `points` order; `confidence` and `chips` by anything that names people; `split` by `results` split;
`pairs` by `results` outlast; a `choice` by anything (its options matched to the verdict).

What's refused here, and why:

- **The data-can-settle rule** (with the show's `ctx`): a moment that isn't the show's ("isn't one of the show's moments"), or one
  research doesn't answer ("...is the couch's word: research doesn't answer it, so data can't settle it"); a phase that isn't
  the season's; a role the show doesn't have; a group answer on a show whose cast has no groups; a jury vote with no jury; who
  wins on a show nobody wins; trivia on a season whose research writes none; an episode fact research doesn't say reliably on
  that show. A moment someone types that the show doesn't have takes the new-moment path (a feasibility ask, then a question
  research asks each episode), never a made-up rule (the plan's "Our check").
- What's the season's (who wins, where they finish, the jury's split) is asked once, in a game that runs to the season's end.
- Who stays is one episode's: asked each episode. Which episode a phase starts in is asked once. The boot order asked each
  episode needs a window of several.
- An episode fact is asked each episode, about that episode; trivia each episode, about the one before (its key is written
  after that one).

### Its window: `asked`, `every`, `over`, `closes`

When a question is asked and what its answers are about.

- `asked`: `once` (for the game; the default), `each` (every episode it plays), `every` (each run of `every` episodes, 2 to
  10), or `phase` (once a phase of the season).
- `over` (asked each only, 2 to 10): about that episode and the next few, a rolling window ("will an idol be played within the
  next three").
- `closes`: `start` (when its window's first episode starts; the default) or `finale` (asked once, open until the season's last
  episode: only who wins or the final few).
- A late lock for someone who watches later: `extras.lateLock` (below).

### How a question's points combine

On one question:

- `share: "split"`: a pot each window, split between everyone right ("10 points each time, split between everyone right").
- `share: "only"`: a right answer scores only when nobody else has it (for a pick of several, each right pick nobody else named).
- `rollover: true`: a window nobody gets carries its points into the next (not on a question asked once).
- `shrink: { points, per: "episode" | "change" }`: a call that stays open (asked once, closing at the finale) is worth less for
  each episode already started when it was made, or each change made once the game started.
- `wager: n | "total"`: stake up to n of your points (or any you have) on your answer: right, its points and the stake; wrong,
  the stake lost. On one answer only: a yes or no, a choice, an over/under, or one person or group. Since C6 the stake is a line
  of its own beside the question's points, so a wager goes with a share, a rollover or a shrink (the points do what they'd do
  without it; the stake is never shared, carried or shrunk), and a parlay multiplies a staked leg.
- `odds: "even" | "pool"` (C6, money, with a wager): what a right stake pays. `even` (the default): the stake, double or nothing.
  `pool`: the couch's own odds (a tote): the window's wrong stakes are a pot split between the right ones by their stakes, each
  share to the cent; nobody right, every stake comes back. Odds only from data: nobody writes a line. "Stake any of your bank on
  each: right, a share of the wrong stakes; wrong, you lose it."
- `beat: { by: "bot", none }`: played against the bot's own call (see "The players' own mechanics").

**A bank** (C6, money), on the game's score: **`score.bank: { start, out? }`**: everyone starts with `start` points (1 to
10,000), a line of their own before the first episode, and every stake on the game's questions is drawn from it (a fixed stake too:
held to what you have left, less what's still riding on answers to be settled). `out: true`: whoever's on nothing after a night is
out (their answers after it count for nobody), ranked by the total or last one standing; `out: false` (the default, the lane's
call): run out and you can still answer, with nothing to stake. A bank needs a stake on at least one question, ranks by its points
(the total, last one standing, a race past its start, cuts, teams, a handicap), and is a game of questions' (a draft's points are
its team's). Example (the user's first game, its fixed sheet): `{ "score": { "by": "answers", "bank": { "start": 500 } }, "ask":
[{ ..., "wager": "total" }, ...] }` → "Stake any of your bank on each: double or nothing. Everyone starts with a bank of 500
points."

Across questions, on the game's score: **`score.parlays: [{ of: [ids], times }]`** (up to 6): someone right on every leg in the
same window has their points on them multiplied (more than 1, up to 10). Legs: 2 to 4 plain questions asked the same way, each
in one parlay. Example: who goes home and who wins immunity, `times: 3` → "Right on who goes home and who wins immunity
together: triple the points."

**How they combine with each other** (C2 part 4, in the scoring sequence's order: a line's worth, then the multipliers, then the
share):

- **A shrinking call that's shared** plays: each right call at what it was worth when it was made, then shared. Split, each
  one's worth divided between everyone right by their right ones (one right alone keeps what their call is worth; calls worth
  the same split it as a pot); only, the only one right keeps theirs. "Who wins, a point less for each episode you wait, split
  between everyone right" → "It's worth 1 point less for each episode that's started when you make or change it, and it's
  shared: what your call is worth is split between everyone who gets it right."
- **A parlay's leg** can roll over (its window's jackpot, then the parlay), shrink (its call's worth, then the parlay) or pay
  only the only one right (its share, then the parlay: the same either way round). Someone right on every leg has what each leg
  gave them multiplied (a leg where they were right but not alone gave them nothing to multiply).
- **A stake** (C6) goes beside any of them: the stake first in the sequence's order, a line of its own the share, the rollover and
  the shrink never touch (a rollover carries on the points alone: a stake won is no claim on the jackpot). A parlay's staked leg
  has its stake's winnings multiplied with its points (a parlay pays only when every leg is right, so it multiplies a stake won).
  p24's "Stake up to 5 points on who goes home, and the pot's split between everyone who gets it right" →
  `{ ..., "points": 10, "wager": 5, "share": "split" }`: "10 points each time, split between everyone right. Stake up to 5
  points on it: double or nothing."

Still refused, in our check's words:

- A parlay's leg that splits a pot: "... splits a pot: a parlay on a split pot waits on a rule (does it multiply your share, or
  your call before the split?)", a rule question for the user (the plan's Noticed; recommended: your share).
- "A wager is on your own call: not with the bot's."

**A ticket** (C6 part 2, money): a question that's a staked parlay a player builds from the game's other questions, its legs.
`{ "id": "ticket", "answer": "ticket", "points": 0, "asked": "each", "wager": "total", "settle": { "by": "legs", "of": ["boot",
"imm", "idol"] } }`, answered `{ "legs": ["boot", "idol"], "stake": 20 }`: the legs are your own answers to those questions in the
same window (the server refuses a ticket naming one you haven't answered). Every leg you put on it right: your stake won `pays`
times for that many legs (by default each leg doubles what rides on it, even money on each: 3 times for two, 7 for three, 15 for
four); one wrong, or left blank, the stake lost; a leg that doesn't count (off, a void pick) drops out and the ticket rides on the
rest (one left pays once the stake; none left, the stake back). `legs: { min, max }`: how many it takes (2 to as many as it's built
from, up to 6; at least 2 by default); `pays: [for 2, for 3, ...]`, each more than 0 and up to 1,000, never less for more legs. Its
legs: 2 or more of the game's questions, each one answer that's right or wrong (as a parlay's), asked when the ticket is; never
another ticket. Its stake is a wager's (up to a number, or any of your points or bank), at its own payout (no odds), with no points
of its own, nothing shared, carried, shrunk or against the bot; a game of questions' only, never a life's question. "Build a ticket
from who goes home, who wins immunity and an idol found: put two to three of your calls on it and stake any of your bank; all of
them right wins 3 times your stake for two, 7 for three."

### Finale predictions

A draft's two finale questions (`finaleQuestions({ top3, winner, from })`): name your final three and the winner before the
finale, `from: "any"` (the cast) or `"own"` (your team). They come first among a draft's questions (`finaleIn`), as Start a game
makes them, their answers kept in the league's state (`state.finalePredictions`, where classic's finale panel writes them), their
switch and points in their own settings fields.

```jsonc
[{ "id": "top3", "ask": "Who makes the final three?", "answer": "person", "pick": 3, "from": "cast", "points": 1,
   "asked": "once", "closes": "finale", "settle": { "by": "results", "take": "top", "place": 3 } },
 { "id": "winner", "ask": "Who wins?", "answer": "person", "pick": 1, "from": "cast", "points": 3,
   "asked": "once", "closes": "finale", "settle": { "by": "results", "take": "winner" } }]
```
→ "Finale predictions: before the finale, name your final three and the winner. 1 point for each of the three you get, 3
points for the winner."

### A draft's own questions (C2 part 4c)

Any question a game of questions plays can go beside a draft too, after its finale predictions (`draftQuestions`: the ask less
them; `settings.draftQuestions`, a field of their own), and so can a person from your own team (`from: "team"`: a draft has
teams). Their answers are kept as a game of questions' are (`game_answers`, through the same answers route and sheet) and graded
the same way, every way their points combine (a pot split, only the only one right, a rollover, a shrinking call, a fixed stake,
the bot's call, the answer most of you give); their points are a line of the draft's (step 2 of the sequence), so the table, head
to head (its final settling the questions about the whole game, as a game of questions' do), teams of players and a handicap all
count them. Each row carries them as `questions`.

```jsonc
{ "preset": "outlast", "ask": [{ "id": "boot", "ask": "Who goes home?", "answer": "person", "points": 2,
  "asked": "each", "settle": { "by": "results", "take": "out" } }] }
```
→ "An Outlast for Survivor 51: everyone drafts 3, and answers one question before each episode: who goes home, all season. Each
scores by how long they last: the last one standing carries you. 2 points for each right answer." (the tracker's p17)

- Their points round to the cent as a game of questions' do (a pot's share), so an Outlast's total rounds once they're in it.
- Only the server holds the answers and grades them (with what only it knows: the format's groups, the trivia key, an episode's
  facts, the bot's calls), on each copy it reads, and hands the draft's walk their points through each episode and now
  (`AnswerLogic.lines`, `answerLines` on that copy, never stored). A reader not taught yet, without them, scores the questions as
  nothing (the safe fallback): today the classic app's screens and the Episodes page's lines.
- Still refused, in our check's words: "a draft's own questions can't go beside its cuts or a race yet: who's out decides the
  moves you can make, and those are checked without the questions' points" (the league's own writes, a lineup, a waiver claim,
  an exclusive draft's castaways back in the pool, read it as it's stored, which holds no answers' points); "staking any of your
  points beside a draft comes with money (C6): a draft's points are its team's and its questions' together"; "what most of you
  answer to a finale prediction can't settle a draft's own question yet: those answers are kept apart, in the league itself"; "a
  stock market ranks by its worth (cash plus the team at today's prices): questions beside it would only break ties"; the show's
  calls (a game of their own); a late lock (a draft's moves lock as each episode starts); parlays (a draft's score has none: C3's
  multipliers).

## A new card each week: `card`

One generator for each episode's set of questions or objectives (C7). A game's **card** is drawn new each episode, the same for
everyone, and every line of it is settled by data:

```jsonc
"card": { "from": "moments", "each": 4, "of": ["idolFound", "idolPlayed", "votesNegated", "wentOnJourney",
          "learnedOfAdvantage", "advantageTargeted", "rewardWin", "tribeImmunity"] }
```
→ "Each episode's card is the next four of got an idol or advantage, played an idol or advantage, ..., in turn, so it's new each
episode."

- `from`: `moments`, the show's own moments its list names, drawn in turn: Episode 1 the first `each`, Episode 2 the next, round
  and round the list (`drawInTurn`: Weekly Calls' rotation, the same function). The bot writing the week's card is C7's later part.
- `each`: its lines each episode, 1 to 12. `of`: the moments it's drawn from, 1 to 40, at least `each`, none twice; each one the
  show's and one research answers (the data-can-settle rule: "Cried is the couch's word: research doesn't answer it, so data can't
  settle it").
- Nothing is stored: a card drawn from the spec's own list is worked out from the spec and the episode (`cardLines`), so it's the
  same on every read and never changes once someone's answered it.

Two things read it:

- **A question on the card**, `card: true`: asked for each of the card's lines, one question each (`"sheet"` is `sheet.1` to
  `sheet.4`: `askOf`, which everything that answers, grades or reads a game's questions goes through), each settled by its line's
  moment that episode: `{ "by": "moment", "take": "happened" | "count" | "who" | "most" }` with no moment of its own, answered yes
  or no, a count, or who (a person or a group). Asked each episode, in a game of questions. A line is a question like any other: a
  stake on it (from a bank, at even money or the pool's odds), a share; and a ticket built from the card (`"settle": { "by":
  "legs", "of": ["sheet"] }`) takes its lines as legs ("Build a ticket from the card's four lines"). Two questions on one card ask
  each line two ways ("whether it happens" and "who does it"). Refused, each with why: rolled over, against the bot or about each
  person ("each line of the card is a new moment each week"), a parlay of it ("build a ticket from them"), the players' own
  answers about it, a life riding on it, an over/under or a choice (a line or options for every moment), a moment of its own ("the
  card's line says which moment"), beside a draft, and more than 12 questions an episode, each line one.
- **The moments that count each week**, `score.only: "card"`: only the moments on that episode's card count, in a game scored by
  moments (a pick each episode, a lineup, best ball), so each week's objectives are the card's ("Only the moments on each
  episode's card count."). With hits counted (C5), each is an objective.

Today's games as uses of it: a game's own questions are a card that's the same every week (the spec's list); Weekly Calls' moment
call is the show's callable moments drawn in turn (`calls.ts` draws them with `drawInTurn`); trivia's round and bingo's squares are
cards the bot writes and a second ask checks, each episode's in a table of its own (`trivia_questions`, the bingo bank), private
until their lock where they must be, and void (trivia) or not dealt when nothing passed. Fallbacks for a change nobody announced:
a line's moment that didn't happen is a no; who did a moment nobody did is off (no points either way); nothing reads a group, so a
swap or a split changes nothing.

---

## How you win: `rank`

How the table is ordered. **`rank.by`**:

| `rank.by` | Who wins | Goes with |
|---|---|---|
| `total` | the most points | every game (a pool's: a right pick's points, since C2 part 4b; not with lives) |
| `streak` | the longest run of right picks (ties to the total) | a pool |
| `standing` | last one standing: whoever's still in, then whoever went out last | a pool with lives; a draft or a game of questions that knocks players out (cuts, lives) |
| `worth` | cash plus your team at today's prices | a stock market |
| `coop` | everyone wins or loses together, against the show | a game of questions with lives |
| `matchups` | head to head each episode, more points wins it; the standings by wins | a draft, a game of questions or a pool (C2 part 4b: on what each episode's pick earned), with nobody racing, cut or losing a life beside it; a pick scored by moments (C5) |
| `weeks` | weeks won (C5): each episode, whoever added the most points wins it; the most weeks won wins, ties to the points | wherever head to head plays, on the same series of totals and seats (teams of players: each team's), with nobody racing, cut or losing a life beside it |
| `categories`, `roto` | a sport's categories (`score: { by: 'stats', categories }`): head to head by each category won (`categories`; `matchups` on a categories score: whoever wins more of them), or each category ranking everyone, points by rank (`roto`); the scorer `sequence/categories.js` (L4 part 1b). Played since L3 part 2d: head to head each episode on each seat's counted holdings' totals then (its starters, or everyone drafted), the record the categories' (by each, or by most), the categories won breaking a tie, the playoffs a round by most categories, a tie to the better seed (`categoryMatchups`, MatchupLogic); roto over the game so far, the row's total its roto points (RotoLogic); the server hands the sport's stats over beside the lines (`state.statDefs`: Sport.categoryDefs, a rate's parts) | a draft's lineup or everyone drafted, scored by a sport's categories, with nobody racing or cut |

Beside it:

- **A race** `race: { to }` (1 to 1,000): the first to `to` points wins, and the game ends after that episode. A draft or a game
  of questions, ranked by total or standing. "First to 20 points wins: the game ends there."
- **Players knocked out** `cut: [{ at, out, tie, quiet }]` (up to 4), ranked `standing`: `at: { every: n }` (every n episodes,
  the lowest over them: the guillotine), `{ episode: n }` or `{ phase }` (by the total); `out` 1 to 20 or `"half"`; a tie at
  the line `keep` (nobody tied there goes) or `all`; a night nobody goes home `cut` or `skip`. Someone out scores nothing more,
  makes no more moves, and in an exclusive draft their people go back in the pool. A draft or a game of questions ("A pool
  knocks players out with its lives").
- **When one is left** `oneLeft`: `ends` or `plays` (a draft's default ends, a pool's plays), and a pool's (or a game of
  questions') night everyone left goes out together, `allOut: points` (all out, ranked by points), `share` (they share the win)
  or `back` (all back in).
- **Head to head's own** (`matchups`): `playoffs: { teams, from? }` (the top 2 to 8, a round an episode over the game's last
  episodes); `odd: median | bye` (with an odd number of you, who the round robin leaves out plays the median or sits out);
  `quiet`: `skip` or `tie` (a night nobody scores).
- **Teams of players** `teams: { of, made, score, unplaced, names }`: the couch split into 2 to 6 teams, `made: draw` (at random
  at the start, the default) or `choose`; a team's points its members' `mean` (the default) or `sum`; someone on no team goes
  onto the `smallest` or `none`. A draft, a game of questions or a pool (C2 part 4b), ranked by total or head to head; a draft's
  teams also **knocked out** (rank `standing` with its `cut`s on the teams' totals: a cut takes a whole team, everyone on it out
  then, its points frozen and adding nothing after, an exclusive draft's castaways back in the pool; a team nobody still in the
  game is on that episode can't be cut, finish a race or be the one left; one team left ends it unless `oneLeft: "plays"`;
  "Last team standing wins") or **racing** (`race: { to }`: the first team to `to` points ends it after that episode, ranked by
  the teams' points). "Weekly Lineup in two teams, and the team lowest after Episode 6 is out" is `rank: { by: "standing",
  teams: { of: 2 }, cut: [{ at: { episode: 6 }, out: 1 }] }`. Refused: a game of questions' teams knocked out or racing (its walk
  works each night's points out from who's out so far, seat by seat), a pool's teams on its streak or with lives, teams that are the
  show's own groups (`made: "group"`: the show's groups end at a swap, so ride them with a group slot instead).
- **A handicap** `handicap: { points, who: "new", newTo: "couch" | "show" }`: 1 to 50 points an episode for newcomers, by the
  couch's history (the server's, never someone's word). A draft, a game of questions or a pool ranked by its points (C2 part 4b:
  a point an episode in a pool where a right pick is a point is a lot); not co-op or worth, nor a pool on its streak or who's
  still standing (it would only break ties).

- **A week's winner** (`weeks`, C5) `ties`: a week two or more top, `all` (each of them wins it: the default), `split` (they share
  one: half a win each for two) or `none` (nobody does); a week nobody scores in goes to nobody, and nothing after the season's
  finale counts. "Most objectives hit wins the week" is `rank: { by: "weeks" }`: "Each episode, the one with the most points wins it;
  most episodes won wins." Each row carries `weeks: { won, points, last }` (WeekLogic).

---

## Lives and saves

- **A pool** (`score.by: survive`): `lives` 1 to 5 (a wrong pick, or none, costs one; at none you're out; rank `standing`);
  `mulligans` 1 to 3 (your first wrong picks forgiven); `buyback: { times, before, cost }` (someone out before an episode or a
  phase, or any time, is back in from the next episode with one life, `cost` 0 to 20 points off, up to 3 times). Example: "Two
  lives: a wrong pick costs one. One buyback before Merged starts. One wrong pick forgiven. Last one standing wins." A pool with
  lives ranks by its streak or last one standing, never by its points or head to head (C2 part 4b).
- **A game of questions**: `score.lives` 1 to 5, on the questions `livesOn` names (else every question asked each episode about
  that episode alone): "Guess every elimination winner; a wrong guess knocks you out" is `lives: 1`, rank `standing`.
- **Co-op** (`rank.by: coop`): the lives are the couch's together, a night costing one unless enough of you saw it coming,
  `saves`: `one` (one right answer among you, the default), `most` (most of those who answered) or `all`. "Together you have five
  lives: each time none of you gets it right, you lose one. Keep one to the end and you all win."

---

## Stages and format changes

A game in stages is 2 to 6 games, one after another (each played as a league of its own, tied to the game), plus how their
tables add up. **`stages: [{ id, name, game, on?, side?, alongside?, season? }]`**, **`overall: { by, places? }`**.

- Each stage's `game` is any game the engine plays but a game in stages itself (stages don't nest): an Outlast, a lineup, a
  pool, a game of questions, bingo or Weekly Calls.
- Each starts where the one before ends: an episode, or a phase (`{ "phase": "merged" }`). Example: pre-merge and post-merge as
  separate Outlasts → "A game in two stages for Survivor 51: Pre-merge, an Outlast ... until Merged starts ...; then Post-merge,
  an Outlast ... from when Merged starts .... Overall, each stage's points add up."
- **`overall.by`**: `points` (each stage's total added up, the default), `places` (points for where you finish each stage:
  `places` [1st, 2nd, ...], up to 12), or `wins` (stages won).
- **A stage a format change starts** `on: { change, again }`: the kinds of change that count (`teams-formed`, `pairs-formed`,
  `split-into-individuals`, `merge`, `swap`, `newcomer`, `new-phase`, `swap-all`; left out, the "major" ones: teams or pairs
  formed, split into individuals, the merge, a swap that leaves no group as it was), and `again: true` for a new copy at every
  such change (up to 12 copies). Only a change research is sure of moves a game (an unsure one gets the safe fallbacks and is
  flagged); an action from a report later corrected is undone.
- **A side stage** `side: { held }`: plays beside the game's own, a copy for each grouping research is sure has held `held`
  episodes (1 to 6, default 2), from the episode after until it changes (its points kept).
- **Alongside** `alongside: true`: plays at the same time as the game's own (two ways of scoring at once: bingo lines plus
  trivia, a lineup plus a game of questions).
- **Another season** `season: { show, number }`: a later stage plays on another show's season ("one league across Survivor and
  The Traitors").
- **How a change is taken** `extras.changes: { ok, unanswered }`: `ok` is `auto` (by itself, with an undo; the default), `maker`
  (once the maker says so) or `vote` (once the players vote for it); `unanswered: start | carry-on` (nobody answered by the
  stage's first lock).
- **A second draft** `extras.draft.opens: "start"`: a later stage's draft opens once its start is known and the episode before
  has results, so it drafts from who's still in then (an exclusive one no longer covering every pick then plays shared).
- Refused: one stage ("one stage is just a game"), seven or more, stages that overlap ("It starts where the stage before ends ...; to play at the same time, put it after the game's
  own stages with alongside: true"), two stages of
  bingo (or of Weekly Calls) on one season that could play at once.
- Each episode a round of its own is **weeks won** (`rank.by: weeks`, C5), with no stages: "each week its own round, ranked by
  weeks won" plays all season. More than six stages is later (nothing asked for it yet).

---

## Fallbacks: a game keeps playing through a change nobody announced

A live season's format changes without warning (The Challenge's pairs, then teams, then each for themselves; Survivor's swaps;
The Traitors' twists). Every game rides on data, not on the format at the start: a pick or question names people, groups and
moments as the latest data has them, read at each lock. Where a piece can't play as things stand, it follows a fallback its spec
carries from the start, and no game waits for a person:

| Where | The fallback | Options (default first) |
|---|---|---|
| A group question asked each episode, groups not sure | `ask[].fallback` | `void` (no points either way), `carry-on` (follow the people), `next-stage` (a stage's: start the next) |
| A group slot, groups not sure | `get.groups.fallback` | the same |
| A pick that never repeats, everyone used | `get.fallback` | `miss`, `skip` |
| A second pick on a night one goes | `get.second.fallback` | `void`, `counts` |
| An auction's team the bids didn't fill | `get.budget.fallback` | `fill`, `short` |
| Keepers nobody named | `get.keep.fallback` | `best`, `none` |
| A drafted person whose group ends | `get.across.then` | `keep` |
| A window the bot made no call for | `ask[].beat.none` | `plays`, `void` |
| A format change nobody OK'd by the lock | `extras.changes.unanswered` | `start`, `carry-on` |
| A night nobody goes home, at a cut | `rank.cut[].quiet` | `cut`, `skip` |
| An exclusive draft that no longer covers every pick (a later stage) | (by itself) | played shared |
| Head to head with an odd number | `rank.odd` | `median`, `bye` |
| A week two or more top (weeks won) | `rank.ties` | `all`, `split`, `none` |
| A week nobody scores in (a quiet night, a format change voiding it) | (by itself) | won by nobody |
| A pick of several when fewer can be picked (a cycle's blocks, few left) | (by itself) | fewer picks; the rest score nothing |
| A stake on a question that doesn't count (nobody went home, a void pick, a question voided by a change) | (by itself) | every stake back |
| A stake at the pool's odds nobody got right | (by itself) | every stake back |
| A ticket's leg that doesn't count | (by itself) | drops out; the ticket rides on the rest (none left: the stake back) |

(`next-stage` is only for a stage with another after it.) The research behind it: each episode's research says the format's
state at its end (who is with whom, the phase) as data (F2), the engine works out what changed by comparing episodes (F3), and
blind replays prove it (F4: `scripts/dev-test/blind.js`, a taped season replayed as if live). `docs/STUDY-format-changes.md` has
the seasons studied.

---

## The players' own mechanics

Allowed, with guardrails (the user, 2026-10-28): facts about the show are still settled only by data; answers that depend on
each other stay hidden until the lock; what the players decide changes the game, never someone's place on the couch.

- **Match the majority** `settle: { by: "players", take: "majority" | "minority", of?, tie? }`: right is the answer most (or
  fewest) of you gave in the window, to this question or (`of`) another of the game's, answered the same way; a tie `none`
  (nobody's right, the default) or `all`. A game of questions', or (C2 part 4c) a draft's own questions, one answer each, one
  lock for everyone (no late lock).
- **Beat the bot** `beat: { by: "bot", none: "plays" | "void" }`: the bot makes its own call before the lock (kept apart and
  hidden until then); a right answer scores only where the bot's isn't right (each right pick it didn't name; a number only when
  closer than the bot). A person or group, yes or no, number, over/under or choice, settled by what happened; a game of
  questions' own, or (C2 part 4c) a draft's; no wager. The bot's own run that makes the call is A14 part 2b (until then every
  game against it plays its fallback).
- **Vote on a format change** `extras.changes.ok: "vote"` (above).
- **Side bets** `extras.bets: { points }` (1 to 3): Predictions the game's runner grades; one pays out only once two of you
  guessed. Beside a draft.
- **Bingo's honour system** and a talk show's Weekly Calls (the couch's word, `ctx.calls: "couch"`) stay as they are; the bot
  never makes rules like them.
- **Custom moments** (Make it ours, or typed): allowed through the new-moment path (a feasibility ask, then a question research
  asks each episode); the reliability bar is the user's (the Decisions table, "Custom moments").
- Still to build (A14's later parts): bounties (your castaway votes out mine, you steal points: from the results), secret roles
  among the players, the top scorer's twist and a rotating host (choosing among data-settled questions), numbers from a vetted
  outside source (an episode's TVmaze rating, settled once and stored).

---

## The extras

The details nobody asked about: recommended, out of sight, changeable later. **`extras`**:

| Field | What | Goes with |
|---|---|---|
| `waivers` | a draft's mid-season moves: `feel` (casual, balanced, competitive), `replace` (always, whenShort, windows, never: when someone gone home is replaced), `short`, `windows` (`schedule`: everyEpisode, every, manual; `every`; `swaps`), `order` (rolling, leastPoints, mostPoints), `hours` (12, 24, 48 before), `freeAgency`, `autoFill`, `from: { phase }`, `own: { replace, swap }` (C4: where each move comes from, exclusive or shared; see "Ownership") | a draft whose people can come free (not a shared Outlast). Left out, they're off (`fullSpec` fills waivers off: nothing replaced, windows only when opened; a stock market's, a window after every episode); `null` is refused there, since it means no waivers can happen |
| `bets` | side bets, `{ points }` or null | a draft |
| `calls` | a pool's weekly Who goes home? call, counted, not ranked | a pick |
| `draft` | the draft room: `at` (a time with its zone, or null), `timer` (0, 60, 120 seconds), `away` (wait, queue), `opens` (any, start) | a draft (required) |
| `join` | who can join: open, ask, locked, or null (the recommended) | open never with an exclusive draft |
| `hideStarters` | a lineup's starters hidden until the lock | a lineup |
| `lockedDown` | nobody new joins and the rules don't change for the season | every game |
| `lateLock` | `{ hours: 12, 24, 48 or 72 }`: someone who hasn't seen an episode answers until they have, up to that many hours past air time | a game of questions (not the calls) |
| `seats` | `{ people: 2 to 4 }`: a team two or more people share | not bingo or calls (each person's own) |
| `changes` | how a format change is taken (Stages) | a game in stages with a stage a change starts, or a side stage |

---

## Today's games, as specs

The five presets, whole (what `fullSpec` fills in; `extras` shortened):

```jsonc
// Outlast: "An Outlast for Survivor 51: everyone drafts 3, all season. Each scores by how long they last: the last one standing carries you."
{ "preset": "outlast", "span": { "from": 1, "to": null }, "pool": { "of": "cast", "where": { "stillIn": true } },
  "get": { "by": "draft", "each": 3, "order": "snake", "own": "exclusive" }, "count": { "all": true },
  "score": { "by": "place" }, "rank": { "by": "total" }, "ask": [], "closes": "start",
  "extras": { "waivers": <off>, "bets": { "points": 1 }, "draft": { "at": null, "timer": 0, "away": "wait" }, ... } }

// Weekly Lineup: "everyone drafts 5 and starts 3 each episode, all season. Scored by Survivor 51's rules."
{ "preset": "weekly-lineup", ..., "get": { "by": "draft", "each": 5, "order": "blind", "own": "shared" },
  "count": { "start": 3 }, "score": { "by": "moments", "points": null }, "rank": { "by": "total" }, ... }

// Survival Pool: "everyone picks one person to stay in each episode, all season. Longest streak wins."
{ "preset": "survival-pool", ..., "get": { "by": "pick", "each": 1, "repeat": "cycle" }, "count": { "pick": true },
  "score": { "by": "survive", "means": "staysIn", "points": 1 }, "rank": { "by": "streak" }, ... }

// Weekly Calls: "two calls before every episode, all season. Most right by the finale wins."
{ "preset": "weekly-calls", ..., "get": { "by": "none" }, "count": null, "score": { "by": "answers" },
  "rank": { "by": "total" }, "ask": [{ "id": "calls", "answer": "calls", "points": 1, "settle": { "by": "calls" }, "asked": "each", ... }] }

// Weekly Bingo: "a new bingo card every episode, all season. Most lines by the finale wins."
{ "preset": "weekly-bingo", ..., "get": { "by": "card" }, "count": null, "score": { "by": "lines" }, "rank": { "by": "total" } }
```

The shapes a Survivor couch plays, with their extras: an Outlast with finale predictions in `ask` (above), drafted exclusive
with waivers in `extras.waivers`, or drafted shared (`"order": "blind", "own": "shared"`), which has no waivers (nobody's
castaways come free: "Waivers need a draft whose castaways can come free"); a Weekly Lineup; a Survival Pool. And the newer pieces, each
a few fields on top (every one of these plays now):

| The idea | The spec, on top of its base |
|---|---|
| A game of calls, who goes home each episode | `get: none`, `score: answers`, `ask: [boot]` (the question above) |
| Our Outlast, plus a question every week | Outlast, `ask: [boot]` (C2 part 4c: its own questions' points beside its team's) |
| Guillotine | Weekly Lineup, `each: 4`, `rank: { by: "standing", cut: [{ at: { every: 1 } }] }` |
| Head to head with playoffs | Weekly Lineup, `rank: { by: "matchups", playoffs: { teams: 4 } }` |
| A captain who scores double | Weekly Lineup, `score: { by: "moments", points: null, captain: { times: 2 } }` |
| Best ball | Weekly Lineup, `count: { best: 3 }` |
| Reverse Outlast | Outlast, `score: { by: "place", reverse: true }` |
| Names out of a hat | Outlast, `get: { ..., "order": "draw" }` |
| Auction | Outlast, `get: { ..., "order": "auction", "budget": { "total": 100, "floor": 1 } }` |
| Stock market | Weekly Lineup, `budget: { total: 100, floor: 5, ceiling: 25, trade: { fee: 0 } }`, `rank: { by: "worth" }` |
| A pool with lives, a buyback and a mulligan | Survival Pool, `score: { ..., lives: 2, buyback: { times: 1, before: { phase: "merged" }, cost: 0 }, mulligans: 1 }`, `rank: { by: "standing" }` |
| Split the pot | a game of calls, `points: 10, share: "split"` |
| Parlay | two questions, `score: { by: "answers", parlays: [{ of: ["boot", "imm"], times: 3 }] }` |
| Double or nothing | a yes or no with `wager: 5` |
| Co-op on The Traitors | a game of questions, `score: { by: "answers", lives: 5 }`, `rank: { by: "coop" }` |
| A new draft at each major format change | two stages, the second `on: { again: true }` |
| Bingo and trivia at once | two stages, the second `alongside: true` (the tracker's p1) |

---

## How a request becomes a game

```
page + words ──(bot + the engine's manual)──▶ a draft spec ──(our check)──▶ game spec ──(wizard)──▶ a league
```

- **Today**: Start a game's taps build a preset's spec; the engine lab (`/desk/lab`, admins) takes a pasted spec or a tracker row
  and says the verdict, the words and the shape on a real season, and can start it as a test game.
- **The tracker** (`tests/fixtures/engine-capabilities.json`, rendered by `node scripts/engine-capabilities.js` into
  `docs/ENGINE-CAPABILITIES.md`): the dials' values and the requests people would type on a show's page, each with its spec (or
  the step it waits on, or a rule question). A row plays when its spec passes `specProblems` (with its page's show) and
  `specWaitsFor` has nothing; its words are `describeSpec`'s. So the tracker is the engine's progress, and the place to try an
  idea: add a row, run the script, and see whether it plays and how it reads.
- **Our check decides** (the plan's "Our check"): ids only from the show's context pack, numbers only from their words (or
  listed as assumed), defaults ours, and anything that doesn't hold becomes a question or a can't-yet, never a silent fix.
- **The bot drafts** (G1, planned): opened on a show's page, it gets the context pack (the show, the cast, the rulebook's
  moments, the couch) and the engine's manual (from the schema's `VOCAB`: only what plays now), and answers a spec with each part
  marked said, assumed, to ask, or can't yet.

---

## How a game is scored: the sequence

Every game scores as one sequence of six steps, for each of you and each episode (or window) it plays
(`src/lib/game/sequence/`, track C's C2):

1. **Hold**: what of yours counts for that episode. A draft's team as it stood then (a pickup counts from the episode after
   it's made; `heldAt`), a lineup's starters, best ball's whole team, a group slot's group. Someone two of you hold (a shared
   draft's, or since C4 a shared replacement in an exclusive draft) is on each team, each by its own holding. Since C7, the card's
   lines that episode (`cardLines`): the questions on it it asks, and the moments that count.
2. **Score each line**: a line is one holding's points in one episode, from one source (since C5, a pick scored by moments holds
   that episode's picks, each a line as a lineup's starter is). An Outlast's line is a **place**, a
   value rather than points earned while held (whoever holds someone now has their whole place: `placed`, `stillIn`); a
   lineup's are its people's **moments** at the game's points (`momentRaw`; since C5 only the moments `score.only` names, or each an
   objective hit, counted every time, once a holding or once for you: `hits`; since C7 only the moments on that episode's card,
   `onlyAt`), a group slot's its group's (`groupRaw`), a side
   bet's a right guess on a bet with company (`betLines`); finale predictions and a handicap are lines settled on their own.
   In a game of questions a line is an **answer's right ones at what its window is worth** to it (`windowLines`): the
   question's points, a rollover's jackpot in them (what the windows before it left unclaimed: `jackpot`, `carry`), a shrinking
   call's less for each episode late or each change (`shrink`). A **stake** is a line of its own beside them (C6: `stakes`,
   even money or the pool's share of the wrong stakes, added to the points with `plus`), and a **bank's start** a line before the
   first episode. Which answers are right, and how many right ones each has, is
   the grading's (the settles above), never the sequence's. A right call (Weekly Calls) and a bingo line are lines too, counted
   (`tally`). A draft's own questions (since C2 part 4c) are graded the same way, their sum a line of the draft's beside its team's.
3. **Multipliers**: each line times whatever applies to it, in order (`multiply`), each a factor of the one multiplier piece
   keyed by its condition (`factorOf`, since C3): a captain's, then the episode's own (`score.times`), then how the holding
   joined your team (`score.multiply`, from its stint: `stints`); a parlay's on what each of its windows gave you (after the
   window's share, below: the order today's games keep); a line's points on a count of bingo lines (`counted`). With a
   multiplier on how a holding joined, an Outlast's line is what it earns while yours (`earnedWhileHeld`), not its whole place.
   A parlay multiplies a staked leg's stake won with its points (C6).
4. **Combine**: the lines into your total for the episode, all of them or your best n (`best`, `episodeTotal`); and a window's
   answers across all of you: a pot split between everyone right by what each would have earned, only the only one right, by
   answer or by pick (`split`, `only`, `onlyEach`), each at the window's worth or (a shrinking call that's shared, since C2 part
   4) each answer's own. Against the bot, the right ones it didn't name are your lines (the grading's).
5. **The week's result**: what each episode's totals make, once its results are final: a running total (`add`; a count's,
   `through`); a pool's night on your streak and lives (its right picks first, then its wrong ones; a mulligan forgives one, a
   wrong one costs a life, a buyback brings you back, or you're out: `poolNight`, `poolEmptied`), and the night everyone left
   goes out (`allOut`); a race won, a life lost, a bank run out (C6: `knockouts`' `broke`), a cut, one left (`knockouts`, `livesNight`, `cutsAfter`, `lastLeft`); a
   matchup won, the standings and the playoffs (`matchups`, on what each episode added: `grown`); a team's points, its members'
   sum or mean (`teamStep`); co-op's night and its lives together (`saved`, `coop`). A game of questions walks the same
   knockouts as a draft, its totals worked out as the walk goes (someone out takes no share of anyone's points after). Each of
   these walks a **series of totals** (each episode, every side's points through it): a draft's is its one walk's, a game of
   questions' its answers' walk's, a pool's its picks' (since C2 part 4b: `PickEmLogic.series`, each episode the pool has
   decided, a handicap's points added), and teams of players' their members' on it then (`TeamLogic.series`), so head to head,
   teams and a handicap play on a pool, and a draft's cuts and race play on its teams' totals (a team's out every member's). Weeks
   won (C5) reads the same series as head to head: each episode, the side that added the most wins the week (`weeks`).
6. **Rank**: the table in its order (`byTotal`, `byKey`, last one standing's `standingKey`, head to head's `recordKey`), each
   row's total from its parts (`total`); a game in stages' overall from its stages' tables, their points added up (`sum`), their
   places' points, or their wins.

A draft is walked once: its table is the sequence **at now**, and the series the week's results read is the same sequence **at
each episode** once its results are final. They differ only by what's known now and wasn't then: an episode's early results,
a side bet or finale predictions graded before their episode's results are final, and a pickup made since the latest results
(the table counts each at once, the week's results from the next episode).

Rounding (to the cent) is part of the sequence, where each game has always done it: an Outlast's places are whole and never
rounded (with a multiplier on how a holding joined, since C3, each line rounds as it's multiplied, and their sum and the total);
a lineup rounds each person's points as they add up, each line, each episode's total and the running total (a plain
lineup too, since C2 part 2: it rounded its running total after each moment, a cent apart on a half cent, which a sport's
counts can make and a show's halves never do); a game of questions rounds only a split pot's shares inside a window, each line
a parlay multiplies and its sum window by window; counts of calls and lines are whole; a game in stages rounds its overall.

What scores through it now (C2 parts 1 to 3): every draft (an Outlast, a lineup, best ball, group slots, side bets, finale
predictions, a handicap, a stock market's worth), the week's results (a pool's walk, the knockouts, head to head and its
playoffs, teams of players, co-op's night), and what the server scores outside the league's state, handing the sequence its
lines (a game of questions' windows, every way they combine, and its walk: lives, a race, cuts, co-op, head to head and teams
on it, a handicap; Weekly Calls' right calls and bingo's lines, through each episode; a game in stages' overall). What only the
server knows (the format's groups, the trivia key, episode facts, the bot's calls) stays out of the league's state: the server
grades with it and hands over the lines. Each part keeps every game scoring exactly as before unless it says otherwise. Part
4b adds a pool's series of totals (head to head, teams of players and a handicap on a pool ranked by its points) and the week's
result on teams' totals (a draft's teams knocked out or racing); part 4c a draft's own questions, graded as a game of questions'
and handed to the draft's walk as a line through each episode and now (`AnswerLogic.lines`), so its table and everything that
reads its series count them. C3 makes every multiplier one piece keyed by a condition (step 3's `factorOf`: a captain, when, how a
holding joined, a parlay's legs, a confidence ranking's place), and adds how a holding joined: each holding's line times the factor
for the way it joined your team, on what it earns while it's yours (an Outlast's line then too: `stints`, `earnedWhileHeld`). C4
gives each way of holding its own ownership (a replacement or a swap from anyone still in beside an exclusive draft): nothing the
sequence reads changes, only who holds whom. C5 gives a pick each episode its place scored by what they do (step 1 holds that
episode's picks, one or several, and the draft's walk scores them: `ScoringLogic.walk`, `episodeScore`), only some moments and hits
counted (step 2's `momentRaw`), and a week's winner (step 5's `weeks`, on head to head's series and seats: `WeekLogic`). C6 (money)
gives a stake its own line beside a question's points (step 2's `stakes`, even money or the pool; `plus`), so it goes with a share, a
rollover, a shrink and a parlay in the sequence's order (the stake, then the multipliers, then the share), a bank's start a line
before the first episode, and a bank that runs out a knockout (step 5's `broke`). C7 (a new card each week) gives step 1 the card's
lines each episode: a question on the card is a question for each line (graded on its moment that episode, a line like any
question's), and the moments that count are the card's that episode; nothing else in the sequence changes.

**Playing by placement** (C2 part 4): a spec plays when each piece it names has its place in the sequence, not when it matches
one of seven shapes (`schema.js` `noPlace`; `typeOf` names the shape the screens read, from its lines):

| Step | The pieces, and what each needs from the steps before it |
|---|---|
| 1. Hold | a draft (its order with its ownership, a draw, or an auction for castaways nobody else can have) counting its whole team, a lineup or its best few, its waiver moves each exclusive or shared (shared beside an exclusive draft, not beside a stock market); a pick each episode (1 to 8, cycling, never repeating or any: C5); nothing; a bingo card. Beside any of them, a new card each week (C7), read by a game of questions' questions on it or the moments that count |
| 2. Lines | a place, the whole team held; moments, a lineup or best few held, or (C5) a pick each episode held, only some moments or each a hit; a pick staying in (or scoring), one pick held; answers, nothing held, each a question a game of questions plays (or the show's calls alone); bingo lines, a card held. Beside them: a draft's finale predictions and (part 4c) its own questions, each one a draft plays (a game of questions' kind, or a person from your own team), not a stake of any of your points, not beside its cuts or a race, not beside a stock market by its worth |
| 3 and 4. Multipliers, combine | each checked where it's said (`specProblems`): a captain on a lineup, points by when on moments, parlays on a game of questions, how a holding joined on a draft's team (a lineup, best ball or an Outlast not in reverse, not a stock market) whose waivers make that move; best ball's best n; a question's share, rollover, shrink, wager (since C6 beside any of them, at even money or the pool's odds, and as a parlay's leg) and the bot's call (not with a wager), combining in the sequence's order (the stake, a line's worth, the multipliers, the share) |
| 5 and 6. The week's result, rank | weeks won (C5) wherever head to head plays; a pick scored by moments by its points, head to head or weeks won; a running total on any game's (a game of questions' with a bank, C6: its start a line before the first, and out when it runs out, so last one standing too; a pool's by its points with no lives: its series of totals, since C2 part 4b; else its streak or who's still standing); last one standing on a draft's or a game of questions' cuts, or a pool's or a game of questions' lives, and a draft's teams on their cuts (part 4b); a race on a draft's or a game of questions' totals, or a draft's teams'; head to head on a draft's, a game of questions' or a pool's totals, with nobody racing, cut or losing a life; teams of players and a handicap on any of those totals (a draft's teams knocked out or racing; a game of questions' and a pool's by their points or head to head); worth, a stock market's on a lineup; co-op, a game of questions' lives together; the show's calls and bingo lines, most wins |

A piece with no place says which and why ("No game plays this way yet: a pool's picks are its game: questions beside them play
in a stage alongside it"), and every game that played before plays the same way (a corpus of 56,025 specs, every holding,
scoring, ranking and asking crossed: `tests/fixtures/placement-corpus.js`).

## Where it's still a menu

Questions compose (answer × settle × window × combiner × fallback), and so do stages and the ways to win, and since C2 part 4 a
spec plays by each piece's place in the scoring sequence (above), not by one of seven shapes. What doesn't compose yet, each a
tracker row (`docs/ENGINE-CAPABILITIES.md`, p13 to p25) with the step that brings it:

- **Pieces with no place yet** (each refused with why: "No game plays this way yet: ...", or our check's own words):
  - questions beside a pick, a pool or a bingo card (they play in a stage alongside it);
  - a pick scored by moments knocked out or racing (C5 left it: a draft's or a game of questions' for now);
  - a stake of any of your points beside a draft (a draft's points are its team's and its questions' together: a bank, C6, is a
    game of questions').

  (A draft's own questions beyond its finale predictions have their place since C2 part 4c: their answers' lines join the
  draft's.)
- **Combiners still exclusive**: a parlay on a split pot waits on a rule (does it multiply your share, or your call before the
  split?). (A wager beside a share, a rollover, a shrink or a parlay plays since C6.)
- **Multipliers left to come**: a captain, by when, how a holding joined, a parlay's legs and a confidence ranking's places are
  one piece since C3 (above, "Multipliers"); a streak and when a holding was picked are later, a draft's own questions have no
  parlays, and a stake's odds are its own (C6: even money or the pool's).
- **Six stages at most**: each week its own round is weeks won (C5), so only a game of seven real stages waits.
- **A ticket's legs are one window's**: a ticket is built from questions asked when it is, each window its own (a ticket across
  episodes, or a leg that's a pot split, a ranking or a question about each person, isn't built).
- **A card is the show's moments in turn** (C7): the bot writing the week's card (choosing its moments, or a question research
  then answers) is C7's later part; a card's lines ride no parlay, life or question about the players' own answers, and a
  question on it is a game of questions' (not a draft's own).
- **Refused for their own reasons** (not a menu: the sequence wouldn't make them sensible): co-op on a draft (a night needs a
  right or wrong for each of you, which a draft's points don't give), group slots on an Outlast (a group has no place), a pool
  with lives ranked by its points or head to head (its lives knock players out: it ranks by its streak or last one standing), a
  handicap or teams on a pool's streak (a streak is one person's; a handicap would only break ties), anything the data can't
  settle.
- **For now, a draft's only**: teams knocked out and a race between teams (a game of questions' walk works each night's points
  out from who's out so far, seat by seat, so its teams would need that walk on the teams' totals: refused, saying so).
- **For now, not beside a draft's cuts or a race**: a draft's own questions (who's out, and where the game ends, decide the moves
  the league's own writes take, and those read it as stored, without the answers' points only the server's copies hold: refused,
  saying so). Questions beside a stock market ranked by its worth are refused for their own reason (they'd only break ties).

The study of the sequence is in the plan (track C, C1's As built); what's built is under C2's.

## Planned: what track C adds

| Step | The piece | What it opens |
|---|---|---|
| C2 | **One scoring sequence** (built): hold → score each line → multipliers → combine → the week's result → rank (above: parts 1 to 3, every game). A spec plays when each piece it names has its place in the sequence (part 4a: playing by placement, a shrinking call that's shared, a parlay's legs that roll over, shrink or pay only the only one right; part 4b: a pool's series of totals, so a pool by its points, head to head, in teams and with a handicap; a draft's teams knocked out and racing; part 4c: a draft's own questions, a line of their own) | done: what's still refused is listed above, with the step that takes it |
| C3 | **Multipliers on any condition** (built): one piece keyed by a condition, a captain, when, how a holding joined (drafted, a pickup, a replacement or a swap, the Nth per team or per slot), a parlay's legs, a confidence ranking's place | captain, by when, parlay and confidence are uses of it; the user's 1x, 0.5x, 0.25x; an Outlast's pickups counting double while they're yours. A streak and when a holding was picked: later |
| C4 | **Ownership per holding** (built): exclusive or shared for the draft, its group slots and each waiver move (a replacement, a swap), so where a replacement comes from: someone on nobody's team, or anyone still in | an exclusive draft with shared replacements (the user's second game, whole); someone two teams hold, each owed a replacement once they're gone home |
| C5 | **The week as a result** (built): pick 1 to 8 each episode without a draft, scored by what they do; weeks won (each episode a round); only these moments count; hits counted every time, per pick or per objective | the user's third game, whole (tracker row p12, a fixed list of objectives until C7) |
| C6 | **Money** (built): a bank everyone starts with, every stake drawn from it, one that can run out (`score.bank`); a stake's odds, even money or the pool's (`ask[].odds`); a stake as a line of its own, beside a share, a rollover, a shrink or a parlay (part 1); a ticket a player builds, a staked parlay of the legs they choose, the payout growing with the legs (part 2) | the user's first game (its bank, stakes and tickets; its weekly sheet is C7's); p24 |
| C7 | **A new card each week** (part 1 built): one generator for each episode's questions or objectives (`card`), the show's moments in turn from the spec's list, read by questions on it (`card: true`, a ticket from its lines) and the moments that count each week (`score.only: 'card'`); written by the bot and checked, the later part | the user's first game (p10: a sheet written each week, staked from a bank, a ticket from its lines) and third (p12: the week's objectives); Weekly Calls' rotation is its draw |

---

## Thinking up a game

Ask these of any idea. Each is a piece above; the answer is a field.

1. **When do you act, and when does it lock?** Before each episode, once, every few, per phase, until the finale, late. (`asked`,
   `closes`, `span`, `lateLock`)
2. **What do you hold, and from whom?** A team for the season, one pick an episode, a card, nothing. Can two of you have the same
   one? (`get`, `pool`, `own`)
3. **What of it counts each episode?** All of it, a lineup, your best few, the pick. (`count`)
4. **What earns points, and what settles it?** How long they last, what they do (moments), whether a call is right (and by what
   data). If nothing in the data settles it, it isn't a rule yet. (`score`, `settle`)
5. **What changes the points?** A multiplier (a captain, the finale, a parlay), a pot that's split, a call nobody else made, a
   stake, a rollover, a call that shrinks. (`score.*`, `share`, `wager`, `rollover`, `shrink`, `parlays`)
6. **How do you win?** The most points, the longest streak, last one standing, head to head, together against the show, a race,
   in teams. (`rank`)
7. **Does it change shape over the season?** A second draft at the merge, a new stage at a format change, a side game while a
   pair lasts, two games at once. (`stages`)
8. **What if the show changes under it?** Which fallback each piece takes. (Fallbacks)
9. **Does anything depend on the players themselves?** The majority, a vote, the bot as an opponent. (The players' own mechanics)

### The user's three games (2026-11-05), worked through

**1. A bank and a weekly sheet.** *"For show X, have a starting bank of 500 units, have a prediction sheet generated each week
that players can wager on, more wagers multiply scored earnings."*
- Act: before each episode. Hold: nothing (`get: none`). Settle: each line of the sheet by data.
- Points: a stake from a bank of 500: built (C6), `"bank": { "start": 500 }` with `"wager": "total"` on each line of the sheet
  ("Stake any of your bank on each: double or nothing. Everyone starts with a bank of 500 points."). "More wagers multiply": a
  ticket a player builds from the sheet's lines, its payout growing with its legs: built (C6 part 2), a `ticket` question built
  from the sheet's (the spec's own `parlays` take a staked leg too), or the number of wagers multiplying the week (the other
  reading: the lane's default is the ticket). A sheet
  generated each week: built (C7), a card of the show's moments drawn in turn (`"card": { "from": "moments", "each": 4, "of": [...] }`)
  and a question on it (`"card": true`, asked for each line, staked from the bank), beside who goes home, a ticket built from them
  all (`"of": ["boot", "sheet"]`).
- Win: the most units (`total`), or the bank's own end: `out: true`, whoever runs out is out, last one standing (the lane's default:
  a bank at zero plays on).
- Plays now (tracker row p10, since C7): `{ "get": { "by": "none" }, "score": { "by": "answers", "bank": { "start": 500 } }, "card":
  { "from": "moments", "each": 4, "of": [eight of the show's moments] }, "ask": [who goes home, { "id": "sheet", "answer": "yesNo",
  "card": true, "wager": "total", "settle": { "by": "moment", "take": "happened" } }, { "id": "ticket", "answer": "ticket",
  "settle": { "by": "legs", "of": ["boot", "sheet"] } }] }`: "everyone answers five questions before each episode: who goes home
  and whether each of the card's four moments happens".
- Open (settings with the lane's defaults, the user's to overrule): a ticket (the default) or a count of wagers; even money (the
  default) or the pool's odds (`odds: "pool"`; odds written by research aren't built: data-settled rules only); a bank at zero
  plays on (the default) or is out.

**2. An exclusive draft with shared, discounted replacements.** *"Have an exclusive draft initially, these players score 1x
points. If you need to replace one you can pick as if the cast was open and shared but the new player who replaces your lost one
scores 0.5x, if you need to replace another it scores 0.25x. Those multiplications are configurable."*
- Hold: an exclusive draft (`own: exclusive`), with waivers replacing someone gone (`replace: always`).
- Ownership per holding: the draft exclusive, the replacements shared: built (C4), `"own": { "replace": "shared" }` on its waivers.
  A replacement can be anyone still in, even someone on another team, who's on both teams then (each scoring them by their own
  holding).
- A multiplier on how a holding joined: 1x drafted, 0.5x the first replacement, 0.25x the second, configurable: built (C3),
  `"multiply": [{ "joined": "replacement", "times": [0.5, 0.25] }]`, on what each earns while it's yours (an Outlast too).
  Its open questions are settings: after the list, `then` (`repeat`, the default, or `ratio`, which keeps halving); per roster
  slot or per team, `per` (`team` the default); voluntary swaps too, `joined: "pickup"` (or `swap` beside `replacement`).
- Plays now (tracker row p11): `{ "preset": "outlast", "score": { "by": "place", "multiply": [{ "joined": "replacement",
  "times": [0.5, 0.25] }] }, "extras": { "waivers": { ..., "replace": "always", "own": { "replace": "shared" } } } }`.
- Open: the defaults of those three settings are the user's (the lane's: the last repeats, per team, only replacing someone
  gone), and whether a voluntary swap, in a game that has them, comes from anyone still in too (`own.swap`; the lane's default:
  the draft's own, only someone on nobody's team).

**3. Shared objectives each week.** *"Each week everyone has a shared set of objectives (several individual moments). Each player
picks x cast members that they think will achieve as many objectives as possible. Player with most objectives hit wins the week."*
- Act: before each episode. Hold: x people picked fresh each episode, no draft: `get: { by: "pick", each: 3 }` (C5; anyone still
  in, every episode).
- Score: only the week's objectives count, `score.only: "card"` (since C7: each episode's card, the show's moments in turn from the
  maker's list; a fixed list, `score.only: [ids]`, still plays), each a hit
  worth a point, `hits`: `pick` (each objective once for each of your picks that hit it: the lane's default), `objective` (once for
  you, however many of your picks hit it) or `every` (every time).
- Win: the week's winner, the season by weeks won, `rank: { by: "weeks" }` (a tied week: each of them wins it, `ties: "all"`).
- Plays now (tracker row p12): `{ "get": { "by": "pick", "each": 3 }, "count": { "pick": true }, "score": { "by": "moments",
  "only": "card", "hits": "pick" }, "rank": { "by": "weeks" }, "card": { "from": "moments", "each": 5, "of": [ten of the show's
  moments] } }`.
- Open: the defaults are the user's (hits per pick, a tied week to each of them); who writes each week's objectives (built: the
  show's moments in turn from the maker's list; the bot choosing them is C7's later part).

---

## Size limits

| What | Limit |
|---|---|
| A team scored by place (Outlast) | 1 to 10 |
| A lineup | 1 to 8 starters, a bench of up to 6 (14 drafted) |
| Questions a game | 12 |
| A person or group pick | 1 to 10 |
| An order, a confidence ranking | 2 to 24, scoring within 0 to 5 places |
| Chips to spread | 2 to 100 |
| Pairs | 1 to 12 |
| A question's points | 0 to 100 |
| A choice's options | 2 to 12 |
| A window (every, over, a cut's every) | 2 to 10 episodes (a cut, 1 to 10) |
| Parlays | 6, each 2 to 4 legs; multipliers more than 1, up to 10 |
| When points multiply | 8 |
| How a holding joined | 1 to 3; a list of 1 to 6 |
| Stages | 2 to 6, a name up to 40 characters; copies of a stage a change starts, 12 |
| A pick each episode | 1 (a pool); 1 to 8 scored by what they do |
| Only these moments | 1 to 40 |
| A side stage's grouping | held 1 to 6 episodes |
| The overall's points for places | 1 to 12 places |
| Lives | 1 to 5; mulligans 1 to 3; buybacks 1 to 3, cost 0 to 20 |
| Cuts | 4; 1 to 20 out, or half |
| Teams of players | 2 to 6; a name up to 24 characters |
| Playoffs | 2 to 8 teams |
| A handicap | 1 to 50 points an episode |
| A budget | 1 to 1,000; a sealed bid sheet, 40 bids |
| A shared seat | 2 to 4 people |
| Group slots | 1 or 2 |
| Side bets | 1 to 3 points |
| A race | 1 to 1,000 points |
| A bank | 1 to 10,000 to start |
| A ticket | 2 to 6 legs; pays up to 1,000 times its stake |
| A card | 1 to 12 lines an episode, from 1 to 40 moments |

(`tests/game-pieces-doc.test.js` checks this table against the schema's limits, and that every value the schema plays now is
named in this guide.)
