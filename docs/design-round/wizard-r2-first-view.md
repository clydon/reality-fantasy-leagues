# Start a game, the gallery: first-view requirements (Round 2, Perception-First Design, Mode 2)

## The problem

Someone on a couch wants to turn what they watch into a game for everyone, usually on a phone around an episode, often in passing.
What stops them: the space of games is enormous (56 bases on a show, 71 settings, 215 values), and a phone shows about 640 px of a
sheet at once; they can't tell how a game plays until friends are already in it, when a wrong guess costs a season; and they choose
for people who aren't there, so the cost of a game that asks too much, or locks someone out, lands on someone else (Joanna, who
rarely starts games and must never fall behind). Andrew wants one tap; Conor wants every piece.

Measured on Round 1b's version 7 (low-fi, `.ui-atlas/stories/wizard-r1/gallery/g1-first.png`, `g4-base.png`): the gallery's first
view holds a three-line head, a ready card with the screen's only yellow, the field, ten chips, three community squares with likes
and lengths, a category heading and three squares, about fourteen separate things; every Fantasy square carries the same icon and
the same "SEASON". The base's screen says its length five times in four forms (the strip, Starts and Ends, a sentence, four chips,
the Start bar's line), and Start, the strongest thing on it, comes before When moves lock and the preview, both below the fold.

## Layer by layer

### Cognitive load (L0)

**Constraint:** working memory holds about three to five chunks at once, and visual noise spends it even when nobody looks at it.

**Violation:** fourteen things compete in the gallery's first view; a word repeated on every square ("SEASON") and an icon repeated
across a category are read and discarded at a cost; the base's screen asks the eye to reconcile the same length in four forms.

**R1. Each screen's first view holds at most four chunks competing for the eye, and nothing repeated that carries no difference.**
A chunk is one thing to read or decide: a group of like squares counts once. A mark the same on every item is dropped or made
quiet; only what differs is loud.

**Citations:** Cowan (2001) for the three-to-five chunk ceiling; Hassin et al. (2009) for unattended noise spending working memory.

### First impression (L1)

**Constraint:** a screen is judged in about 50 ms, through perception, then implicit integration, then classification, before any
reading.

**Violation:** the first thing the eye lands on is a yellow Start on a game not yet chosen; identical placeholder icons read as
empty slots, so the screen classifies as "a form" or "loading", not "a shelf of games".

**R2. In the first 50 ms the gallery must classify as a shelf of distinct games for this show, and a base's screen as one game.**
Each base's square has its own icon, a distinct silhouette in one colour; at least four squares show in the gallery's first view; the
screen's heaviest weight is the games, never a commit button on a game nobody has chosen.

**Citations:** Lindgaard et al. (2006) for the 50 ms judgment; Leder et al. (2004) for perception and classification before
evaluation.

### Processing fluency (L2)

**Constraint:** what is easy to process feels true and trustworthy; every element telling one story raises it, and inconsistency
erodes it.

**Violation:** the length has four forms on one screen; chips wrap onto two lines; a row, a chip and a square can each mean "a
choice" in different places.

**R3. One fact, one form per screen, and one visual grammar across the three screens.** A square is always a choice of game or
change; a row is always a setting that opens; chips are always one pick among a few; white fill is always "chosen"; a dashed edge is
always "can't be had", with why; yellow is always Start, and only once. The base's first view says the length once (the strip with
its chosen chip); the Start bar echoes it as the commitment, nothing else does.

**Citations:** Reber & Schwarz (1999) for ease of processing read as truth; Alter & Oppenheimer (2009) for fluency carrying into
confidence and trust.

### Perception bias (L3)

**Constraint:** people decide on autopilot from what they predict and rationalise afterwards; a prediction that matches passes
unexamined, and a mismatch is only noticed when it bites.

**Violation:** a starter predicts a game from its name ("a fantasy league: draft and done") and never reads what everyone does
each week, or whom the lock would cost; the mismatch shows up in week three, on someone else.

**R4. Before Start, with no reading required, the base's first view must show the two things people mispredict: what each person
does each week, and whether anyone on this couch would miss moves.** The first is the effort line in the first view; the second is
the lock line naming a friend only when it costs them. Defaults are the ones safe for the least engaged player (When you've watched
it for a show's game).

**Citations:** Clark (2013) for prediction passing unexamined until violated; Nisbett & Wilson (1977) for stated reasons diverging
from what drove the choice.

### Decision architecture (L4)

**Constraint:** decisions from description underweight what rarely comes up; experience corrects them. Language should match
how near the commitment is. Fewer options help at decision points, not in browse or expert workspaces.

**Violation:** Start comes before the experience; the preview, the only thing that turns description into experience, is below the
fold; "ask them first", the social path for a choice made for others, is a small link.

**R5. The trail runs understand, then stretch, then try, then commit, with commit always one tap away.** On a base's screen the
preview is in the first view as the experience offer; Start is docked at the foot (one tap for Andrew) and says the concrete
commitment ("Episode 9 to the finale · picks by Wed 8 PM"); Ask them first sits beside it as a peer choice. Density follows the
place: the gallery is a browse surface (rich is fine); a base's first view is a decision point (sparse); its rows below are the
expert workspace (rich for Conor).

**Citations:** Hertwig & Erev (2009) for experience over description; Trope & Liberman (2010) for concrete words on near commitments.

## The requirements

| | Requirement |
|---|---|
| R1 | At most four chunks compete in each first view; nothing repeated that carries no difference |
| R2 | The gallery classifies in 50 ms as a shelf of distinct games, a base's screen as one game; at least four squares in view; no commit button outweighs the games |
| R3 | One fact, one form per screen; one visual grammar (square, row, chips, white, dashed, one yellow) across the three screens |
| R4 | Effort and who it costs are visible on a base's first view without reading; safe defaults |
| R5 | Understand, stretch, try, commit; the preview in the first view; Start docked and concrete; Ask them first a peer |

Lower layers win a conflict: where R5's preview and R1's four chunks compete, the preview takes a chunk and the second plain sentence
goes below the fold.

## What satisfies all five

### The gallery's first view (390 × 844, the sheet open)

In the order the eye takes:
1. **Where I am:** Start a game, and the show on one line under it ("Survivor 51 · for ZT Survivor 51"). One chunk with the field.
2. **The field:** "Find a game, or describe one". For whoever arrives with a name in mind (route knowledge); the shelf is for
   whoever doesn't.
3. **Ready games, collapsed, as one row:** the next episode's ready-made game with its Start, and "22 more ready games" opening the
   section. The ready line and the collapsed Community section are one chunk, because the ready game is one of them. Its Start is an
   outline (ink), not yellow: nothing on the gallery is a must.
4. **The chips:** one sideways row (Community, Fantasy, Pools, Predictions, Betting, Head to head, Play along, Party, Just you, Big
   season); they say what's on the page and jump to it.
5. **The shelf:** the first category's heading (name and its plain line on one line) and its squares two across, at least four in
   view.

**A square** has three elements: its own icon, its known name, its plain line (two lines at most); and a length mark in its corner,
quiet when it's the season (small, muted) and loud when it differs ("1 EPISODE", "PLAYOFFS"), so the exceptions find the eye and a
column of "Season" doesn't. No likes, counts or badges on a base's square.

**Not in the first view:** community squares, likes, the second category, Describe your game, Surprise me.

### A base's screen, first view

In the order the eye takes:
1. **The game:** All games (back), its name, and its first plain sentence; the second sentence below the fold.
2. **What everyone does:** one line with a weekly-effort mark ("A lineup each episode", "Nothing to do each week"): R4's first fact.
3. **How long:** the strip on one line, the stretch filled, stages named over it, "now" on the current one; under it the chips in
   one sideways row, the chosen one white. Starts and Ends live behind Pick episodes.
4. **When moves lock:** one closed line, naming someone only when it costs them a move, with the one-tap fix: R4's second fact.
5. **Preview how it plays:** an outlined row with what it is and how long it takes ("Try it on the real screens · about a minute").
6. **The Start bar, docked:** the commitment line, Start (the one yellow), "or ask them first" as a peer beside who Start tells.

**Not in the first view:** popular changes, the rows, More changes, community games of its kind.

### A change's first view

In the order the eye takes: the row's name; its squares (three across when they fit, at most six in view), the chosen one white, a
dashed one saying why in six words or fewer; the chosen one's controls directly under it (not at the foot), at most three before
More options; Done docked. A worked example appears only where numbers meet (a bet, a ticket, lives and buybacks, a multiplier).

### Load limits for every screen

- At most four chunks in a first view; at most one yellow, and only for Start.
- A square: three elements and a corner mark. A control group: three before More options.
- Chips: one sideways row, never wrapped.
- A dashed reason: six words or fewer on the square; the engine's whole reason one tap away.

## Round 1b's version 7 against R1 to R5

| | R1 | R2 | R3 | R4 | R5 |
|---|---|---|---|---|---|
| The gallery (g1) | fails: about 14 things; "SEASON" on every square | fails: one icon per category; the yellow Start outweighs the shelf | passes | n/a | passes: the ready game is one tap |
| A base's screen (g4) | fails: the length's four forms | passes | fails: the length five times | half: the effort line is in view; the lock line isn't | fails: Start before the preview; the preview below the fold |
| A change (g12 to g19) | passes | passes | passes | n/a | passes |

## The gap

What no version satisfied: the ready game folded into the collapsed Community row (one chunk where version 7 spent two); a length
mark that's quiet when it's the season and loud when it isn't (version 7 made fifty identical words, so the user's "Im not sure how
obvious the game length is" was answered in a way that hides the exceptions); and the preview promoted into the base's first view,
with Start docked rather than leading, so the experience comes before the commitment for whoever wants it and costs Andrew nothing.

> *Initial findings. Ralph Loop a requirement, cite further, switch to analyze / evaluate, or ask any follow-up to dig deeper.*
