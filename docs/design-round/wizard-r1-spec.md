# Start a game: page spec (the redo's Round 1, the structure every direction shares)

## The job

**Start a game** turns "let's make a game of this" into a game the couch can play, in as many taps as the starter's certainty
needs: one when they don't mind which, a few when they have a game in mind, as many as they like when they're building something
of their own. Before anything starts, the starter sees the whole game in plain words, what everyone does in its first week with
real days and times, and who will be told. It answers, in this order: what game is this; what does everyone have to do, and by
when; how is it won; how long does it run; and only then, everything else a game can be.

Every game the engine makes is reachable by taps (`wizard-r1-prep.md` §1: the eight groups of the schema's 215 values, the
numbers beside them, who plays and the pace). Describe a game (our AI, about 40 seconds) and Surprise me (an instant roll) reach
the same game faster; neither is the only way to any piece.

## Who arrives, and with what

The starter is usually whoever organizes the couch. What they carry decides the path:

| They arrive with | Who | What they need first | The ten tasks |
|---|---|---|---|
| Nothing in mind, little time | Andrew (drives by) | a good game already chosen, one tap to start it | 1, 5, 10 |
| A game by name | anyone who's played one before | that game, found in one look, set to the right length | 2 |
| A constraint about the couch | whoever starts for a group with Joanna in it | games sorted by what they ask of everyone each week | 3 |
| A game of their own | Conor (tinkers) | every piece reachable, each change said where it happens, nothing undone silently | 4, 7 |
| Words | anyone who'd rather type | the field, then the same game screen the taps reach | 6 and 7 as typed |
| A live moment | anyone watching along | a place for it, saying it's coming | 9 |
| A sport's game | anyone on a team's sheet | the team's games as the length, the sport's own questions | 6 |
| A show nobody's voted off of | a story show's fan | questions and moments, never "who goes home" when nobody does | 8 |

Joanna rarely starts games; she is the constraint the starter designs for (a game she'll finish asks one small move a week or
none). Behind every path: the friend-group archetypes (`docs/ARCHETYPES.md`).

## Ways in, and what each already knows

| Way in | Known on arrival | Opens on |
|---|---|---|
| A show's Games tab (the most common) | the show, the season's state, the couch | the show's start, recommended game chosen |
| The hub's Start a game | the couch | which show (the couch's shows, the next to air first; skipped when there's only one) |
| A team's sheet, a league's week | the sport, the team or slate, its schedule | the team's start: its next game as the length |
| Run it back (the trophy shelf, a finished game) | the game, its settings, the next season or span | that game on its new span, ready to start |
| Again, on a finished short game (task 10) | the game | that game on the next episode, ready to start |
| A season that's aired | the season, the starter's mark | at your own pace from where they are (or from the top) |
| Make it a game's Done | a show just set up | the show's start |
| Tonight, when nothing's on for the next episode | the show, the next episode | the show's start on tonight |

**The game library** is where every direction's ready games come from, whatever the way in: the common built-in games (the
eight kinds, and built-in games that leave a part open for the starter, such as "Who does it most?" and the one-moment draft), the
season's made-for games, and later the games people publish (BACKLOG 93: browse, vote, start from one and change your own copy). The
public part is shown as coming until it's built.

## A game, in people's words: the taxonomy

The schema groups pieces by where they sit in a spec; a person groups them by the question they're answering. The wizard's labels
are the person's. Each piece has one home; where a piece reads naturally in two places, the second holds a line pointing to the
first.

| Label (a show's words) | What's under it | The spec |
|---|---|---|
| **What you do** | draft a team once · set a lineup each episode · your best ones count · pick one who stays · pick a few who score · answer a few questions · tick a bingo card · make the show's calls (sport: pick winners · pick a few players · draft players · squares) | `get`, `count`, the base |
| **How long** | tonight · the rest of the season · a stage (until the merge, from the merge) · episodes picked like dates; a sport: next game · rest of season · against a rival · pick games · this week's slate | `span`, a sport's `closes` |
| **How you win** | most points · head to head (playoffs) · last one standing (cuts, lives) · longest streak · most weeks won · first to a target · together against the show · in teams · most worth (a market); a sport: categories, roto | `rank`, `score.lives`, co-op |
| **Your team** (games with a draft) | how many · how many play · shared or all yours · how the draft runs (turns, in private, out of a hat, bids) · one from each tribe (or department, or position) · replacements · prices and a cap · buy and sell · keepers · a slot for a pair or team · a captain | `get.*`, `count`, `extras.waivers`, `score.captain` |
| **The questions** (games of questions) | which questions (who goes home, who wins, who does a moment, does it happen, how many, an order, a vote split, pairs, trivia, an episode fact; a sport: who wins, top scorer, the total, the margin) · how each is answered · when each is asked (each episode, once, every few, each phase, open until the finale) · a card new each week (in turn, the AI's, a host's) | `ask[]`, `card` |
| **What scores** | the show's points or a named way to score · only some moments · each moment an objective · points that double (the finale, an episode, a phase) · in reverse · what each question is worth | `score.*`, `ask[].points` |
| **Bets** (points, never money) | a stake on a call · a bank to bet from · double or nothing or the couch's odds · split the pot · a lone right answer · a rollover · a parlay · a ticket · side bets | `wager`, `bank`, `odds`, `share`, `rollover`, `shrink`, `parlays`, `ticket`, `extras.bets` |
| **Twists** | bounties on the vote · secret Traitors among you · the top scorer picks a twist · a host writes the card · beat the bot's call · match the majority · a head start for newcomers · finale picks | the players' own mechanics, `rank.handicap`, finale questions |
| **Over the season** | a new draft at the merge · halves · a season of mini-games · two games at once · a new draft when the format changes · a side game while a pair lasts · into another show | `stages`, `overall`, `on`, `side`, `alongside`, `season` |
| **Who's playing** | the couch · just me · me and the bot · teams of players · two people sharing a team · who can join | seats, `rank.teams`, `extras.seats`, `extras.join` |
| **When moves lock** | when you've watched it (own pace) · when the next one airs · at airtime | the game's pace |
| **The details** | the draft's time and timer · waivers (when, how often, in what order) · starters hidden until the lock · nobody new after the start · a tied week · a quiet night · what happens if the show changes format | `extras.*`, the fallbacks, the small rank settings |

**Four layers**, deepest last:

1. **The game**: its name, its sentence, its three big answers as tappable parts (What you do · How long · How you win), what
   everyone does in the first week, who's playing and who's told, Start it.
2. **A part changed**: tapping any part opens its choices in place of the game, the current one marked; back returns to the game
   with the change marked where it landed.
3. **Add to it**: Your team, The questions, What scores, Bets, Twists, Over the season, each offering only what goes with this
   game, and saying of what doesn't what it needs ("Head to head needs two or more of you").
4. **The details**: recommended, out of sight, every one changeable here and later in Backstage › Game settings.

**A moment is picked the same way wherever a game names one** (a question's "who does it", what scores, a card's lines, bingo's
squares, when points double): the show's moments research answers; the season's suggested ones; or something the show doesn't
track, typed. A typed moment goes to our AI (about 40 seconds: do recaps report it?), and once added it's one of the season's
moments for every couch, worth nothing until a game names it, asked by research from the next episode on. The picker says all
three before it's added.

**Flavors share the taxonomy and swap the nouns.** The episode word is the season's own (episode, game, race, week); the cast
word is the show's (castaway, crew member, athlete, queen); a face's qualifier is its group (tribe, department, position). A
sport leads with lists and a team's schedule, never a wall of faces. A story show leads with questions and moments, and offers
nothing that needs someone going home unless its results say who does.

## The structure the directions vary

Three things are open, and the directions take different answers to them so the pick settles them.

**The order of the questions.**
- *How long first*: U0's order and today's build. It fits tonight's quick game; it failed on 2026-11-14 when Outlast vanished
  under "Friday", and on the real Survivor 51 it drops Outlast and the pool (`wizard-r1-prep.md` §2).
- *What first*: the user's words in U0's round 2 ("picking the game then how to win"); a game then lists the lengths it can run,
  the rest shown with what they need. Tonight needs its own shortcut.
- *What it asks of everyone first*: UX-IDEAS' "ask by effort"; it narrows eight kinds to one or two for someone with no game in
  mind, and costs the named game one extra answer.
- *All at once*: the game as one sentence, every part pre-answered and each tappable; no order to get wrong, and nothing hidden
  behind an earlier answer.

**Doors.** One way in with a recommended game already chosen (today's footer and "Change" work, per UX-IDEAS); or two doors, a
ready game and making your own; or a front question.

**How depth is reached.** Tapping a part of the game; a catalog of pieces added like legs on a bet slip; or "anything else?"
questions one at a time.

The directions are these four:

| Direction | Order | Doors | Depth | Made-for games live |
|---|---|---|---|---|
| **A · The menu** | how long as filter chips that never hide a game, then the game | one list, the recommended game first | tap a part; Add to it | first in the list, with the classics after |
| **B · The sentence** | all at once | one sentence, pre-answered | each clause is its own control; "+ add a rule" ends the sentence | as sentences to start from |
| **C · The interview** | who's playing → what it asks of everyone → how long → the game | tonight's game (one tap) beside "Help me pick" | "Anything else?" one question at a time, then the parts | as the interview's answers |
| **D · The slip** | what you do first, then legs | ready slips beside "Build a slip" | a catalog of legs, each changing the slip's total | as ready slips |

Describe a game was a candidate model of its own; it rides in all four instead: it can't be the main path when the measure is
taps, it waits about 40 seconds on a capped bot (10 asks a day), and Joanna and Andrew won't type.

## What every direction does

- **One thing first.** The first view's job is the game about to start (or, before one is chosen, the one choice that picks it);
  PFD sets the first view.
- **The game reads whole before Start**: its name, a one-line sentence in the engine's own words (`describeSpec` short form), its
  parts, what each person does in the first week with the real days and times ("Wed 8 PM: everyone's three answers lock · Thu
  noon: results"), what it asks of everyone each week, who's playing, who's told, the pace.
- **Picks only flow down.** A later choice never changes an earlier one. A choice that can't go with what's above is shown, says
  what it needs, and leaves the earlier choice alone; tapping it says how to get there (the user's U0 rule).
- **Every change is said where it lands**: the part that changed is marked ("Changed: captain scores double"), with Undo on it;
  never a toast alone.
- **Shared or all yours is asked for every game with a team**: "Can two of you have the same castaway?" Yes: drafted in private,
  anyone can join later. No: a draft with turns, waivers for whoever's left, nobody new once it starts at your own pace.
- **What each game asks of everyone** is on every game, from its spec: "Draft once, then just watch" · "One pick an episode" ·
  "Three answers an episode" · "Set a lineup each episode" · "Tick a card while you watch".
- **Lengths say why**: a game shows every length, the ones it can't run with what they need ("Outlast needs 4 or more episodes").
  A season whose length nobody knows runs "to the end", never to its last listed episode.
- **Who's playing**: the couch by default, everyone on it free to join; Just me; Me and the bot (a seat that answers as a person
  does, at random or by the points so far: E1). A game that can't score alone (head to head, a split pot, weeks won, teams, match
  the majority, a lone right answer) says so for a couch of one and offers the bot.
- **The bot as a seat is never the same thing as "Beat the bot"**: the seat plays the game; Beat the bot is a rule on a question.
- **Not built yet, shown as coming**: live calls (A15), 2-on-1 head to head (C8), a pair of people as an answer (E3): shown where
  they'd live, saying what they wait for, never offered as working. A piece the engine plays whose play screen isn't built yet (a
  captain, a pool's second pick, an auction's spend, a pool's mulligans: Designs needed 24, 27, 30, 26) is built before the wizard
  offers it to people (the plan's decision); the mocks show it as offered.
- **The game library** opens from each direction's own door (A's list is the library; B's Another game, C's I know the game and D's
  Every ready game open it), with the built-in, the made-for and, coming, other couches' games.
- **The moment picker** is one control wherever a moment goes, and a moment the show doesn't track is added in place (task 11).
- **The shortcuts**: Describe a game (its result opens on the same game screen, what it heard marked as theirs, what it chose as
  ours, what can't count yet with an offer) and Surprise me (the same screen, Roll again and Back, Keep this part on each part).
- **Start it** holds Tell the couch for a 10-second Undo; the footer says what happens next in the game's words.

## By situation

| Situation | What changes |
|---|---|
| Before the premiere, or until Episode 2 airs | the default length is the season, after the premiere ("Include the premiere" a tap away) |
| Mid-season | the default is tonight (the next episode); the season is "the rest of the season" |
| A season nobody knows the length of | "to the end", never "Episodes 9–10"; counts read "9+" |
| A season that's aired | at your own pace, from where you are or from the top; the draft together, then each at their own pace |
| A couch of one | Just me; the bot offered where a game needs company |
| Run it back, Again | the game ready on its new span; Start it in one tap, every part still changeable |
| A sport (a team) | the length is the team's games; the sport's questions and games; lists, search, positions |
| A story show | questions about moments; a moment the show lacks takes the new-moment path (our AI rates whether recaps report it) |
| The bot away, or today's 10 asks used | Describe says so and points to the taps; nothing else depends on it |

## The five lenses

- **Own pace**: the pace is a part of the game, defaulted by the season (own pace for a show on an episode still to air; live for a
  sport); where it waits is said ("syncs at the draft and at waivers").
- **A shared draft**: "Yes, the same castaway can be on two teams": drafted in private, revealed together.
- **An exclusive draft**: turns, an order, who's left, waivers; counted against the couch ("4 of you × 3 is 12 of the 21").
- **Stages**: Over the season holds them; a staged game's sentence names each stage and how the overall adds up.
- **Spoilers**: the cast and the moments are as the starter has seen them; nobody gone past their mark is shown gone; made-for
  games' names and hooks speak of the season's structure, never its results.

## The drill tree, and back

| Level | Opens from | Back lands on |
|---|---|---|
| The show's start | a way in | where it was opened |
| The game | a game picked, a sentence's default, the interview's answer, a slip | the list, the sentence, the interview's last answer, the slip, with the game kept |
| A part's choices | a part of the game | the game, the change marked |
| Add to it (a group) | the game | the game |
| A piece's own settings (a stake's size, a captain's times) | a piece | its group |
| The details | the game | the game |
| Describe's wait and result | the shortcut | the game it was started from, unchanged until the result is used |
| How it plays (every rule) | the game | the game |

Closing the sheet keeps the unfinished game for the session; opening Start a game again offers it first ("Continue: Weekly Lineup,
redrafted").

## The ten tasks: what each needs from the structure

| # | Needs | A good path is |
|---|---|---|
| 1 | the recommended one-episode game for the next episode, with its first night | 1 tap from the show's start (2 from the hub) |
| 2 | Outlast found by name, on the rest of the season, all yours | 2 to 4 taps |
| 3 | games ranked by what they ask of everyone | 3 to 4 taps, with no game she'd fall behind in |
| 4 | a lineup, a captain, a new draft at the merge, side bets | under 12 taps, every change marked, no dead end |
| 5 | Just me, a one-episode game, the bot as the other player | 3 to 4 taps |
| 6 | the team's next home game, three questions the sport's data settles | under 8 taps |
| 7 | nine "who does it" lines a week, a bank of 200, a stake on each (an aired season, own pace) | under 12 taps |
| 8 | "who gets fired" on a show nobody's voted off of; "who hooks up" as a new moment; the pair shown as coming | under 10 taps, the AI's wait said |
| 9 | the live call's place, saying it's coming | found in 2 to 3 taps; nothing started |
| 10 | the same game on the next episode | 1 tap from the finished game, 2 from the show's start |
| 11 | a season game about crying (a moment the show doesn't track): guess who does it most, or draft three and only it scores | under 8 taps either way, the moment added where it's picked, its cost and reach said before it's added |

## Left out, and why

- **Live calls** themselves: A15 is the next round; this one leaves their place.
- **The Games tab and the archive** of finished short games: Round 3. Task 10 starts from a finished game wherever it sits then.
- **Changing a game later** (Backstage › Game settings): Round 4.
- **The look**: Impeccable's, in the next step; these are low-fi structures.
- **Picking the show** inside the wizard beyond a list: the hub's choice of show is the existing search and lists.
- **Ads in the AI's wait**: none until an ad network is chosen (the user's call, 2026-11-09).

## Open questions

- Which order wins: how long, what, what it asks of everyone, or all at once? (The pick answers it.)
- Is a short game played every episode one game with a winner each night, or a new game each time? (Round 3's question; task 10
  is drawn as a new game on the next episode.)
- Does Tell the couch stay on by default for a one-episode game that may run every night?
