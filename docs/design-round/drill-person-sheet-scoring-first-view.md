# The castaway sheet scored by the show, first view: requirements

Mode 2 derivation on [the page spec](drill-person-sheet-scoring-spec.md), at 390 × 844 (a sheet of about 743 px), building on
[the last round's R1–R5](drill-person-sheet-first-view.md). This round replaces that round's colour rule (one colour per kind for
the season) and drops its lens (Counted by): the chart is always the show's moments, and a game's points live in its row.
Today's frames: `.ui-atlas/stories/person-sheet/before/` (production: `real-cast-sheet` is Survivor 51's Sharonda from the Cast
tab, `game-sheet` the test couch's Jelly from Weekly Lineup's page).

## The problem

Someone taps a castaway to find out how she's doing. Production's Cast tab sheet draws her season in four colours that name kinds
of moment ("Tribe won the Immunity challenge", "Zero votes at Tribal Council", "Won the Reward challenge", "Everything else"): to
learn whether she's doing well, a viewer has to read four names, map four colours, and judge the mix themselves. Its games say who
holds her but not what she's worth there. From a game page, production's sheet says her points in that one game but nothing about
her season. The redesign adds a value code (three classes by the show's points): a new code costs learning, so the first glance
has to work before the code is learned, and each place the code appears has to read as the same code.

## L0 · Cognitive load

**Constraint.** Working memory holds three to five chunks, and noise that isn't attended still spends it.

**Violation.** Production's key is four colour-name pairs of three to six words each; holding the mapping while scanning seven
columns spends every chunk on decoding before any judgement. Each row of Their numbers adds a fourth read in this round (the class
mark, the name, the count, the rank, and now the worth): fifteen such rows on Survivor 51 is sixty reads, and the first view holds
five or six of them. The player's first view from a game page now holds two charts (the show's moments and the game's points),
two measures of one season.

**R1.** The chart's key costs one chunk: three classes in fixed words, in the stack's order (big from the line up, small over
them, setbacks under), the same on every sheet and every show, and no other colours in the chart. A Their numbers row reads as two
things at a glance (its mark and name; its count); the worth and the rank are the muted second line. The first view holds at most
four blocks: who, the season drawn with its key, then In your games for a player or the top of Their numbers for a watcher, and
the figures only on a show with amounts. The game's weeks in an opened row are part of that row, not a fifth block.

**Citations:** Cowan (2001) for the three-to-five chunk ceiling; Hassin et al. (2009) for unattended noise spending working memory.

## L1 · First impression

**Constraint.** Appeal and meaning are judged in about 50 ms; colourfulness and complexity drive that judgement; up reads as good
and down as bad before anything is read.

**Violation.** Production's chart is a four-hue stack whose hues carry identity, not value: its 50 ms read is "busy", and "is she
doing well?" isn't answerable before reading. The game page's sheet opens without her face.

**R2.** The first glance answers "doing well?" without a word read: the chart's mass above the line against what hangs below it,
and the share of the good-news colour in it. Value is coded twice, by position (setbacks under the line) and by colour, so a
colour-blind eye or a glance in poor light gets the same answer. Her face stays the anchor, in the same place from every way in
(the last round's R2). A figure (an amount) is set smaller than her name, so on Below Deck the first fixation is still her face,
then the figure.

**Citations:** Lindgaard et al. (2006) for the 50 ms judgement; Reinecke et al. (2013) for colourfulness and complexity in first
impressions; Lakoff and Johnson (1980) for up as good and down as bad.

## L2 · Processing fluency

**Constraint.** What's easy to process feels true; one form per fact; small colour differences cost the most to tell apart.

**Violation.** The value code appears in four places (the chart, Their numbers' rows, the story, the board's bars). If its mark
takes the group's form (a 10 px square beside a name, as the tribe's swatch is drawn in Who), a teal class beside a moment's name
and a teal-ish tribe beside a group's name read as one code. Signed numbers appear in two formats today ("+7.5" on a game's rows,
"7.5 pts" on its sheet). The two chevrons in production mean different things in different places: ⌄ opens in place on the Cast
tab's games, › opens a new sheet in the same list's neighbours.

**R3.** One form per fact. The class mark takes the chart's own form (a short bar in the class colour), never the group's square,
so the mark reads as a piece of the chart. A worth is always signed the same way ("+2", "−0.5", "+7.5"). Two door marks, each
with one meaning everywhere: ⌄ opens in place (turning over once open) and › opens a level over the sheet; a row with neither
opens nothing. The three classes' colours stay at least ΔE 12 apart for colour-blind eyes on the night ground.

**Citations:** Reber and Schwarz (1999) for ease of processing read as truth; Bujack et al. (2022) for colour difference costing
most when small.

## L3 · Perception bias

**Constraint.** People predict before they look: a match passes on autopilot, a mismatch fires attention and reads as an error.

**Violation.** A list of counts predicts an order by count; Their numbers ordered by worth shows counts of 1, 4, 2, 1: without the
worth in sight, the order reads as random. In this app red has one learned meaning (someone went home, the episode number under
their last column): a red bar predicts "out" on a castaway who sat out a challenge. A game's number predicts "her points for me";
a rulebook worth beside it ("+2 each") predicts the same scoring, and a game whose maker changed the points then contradicts it.

**R4.** Every order shows its key where it's used: each row of Their numbers carries its worth, the classes sit together in the
stack's order, and the caption says the order. No colour borrows a meaning the app already gave another: red stays "went home",
yellow "due", teal "good news" (big moments take teal because that meaning agrees). A game's number sits beside its game's name;
the rows' worth is labelled as the show's.

**Citations:** Clark (2013) for predictive processing; Nisbett and Wilson (1977) for acting on the glance and explaining after.

## L4 · Decision architecture

**Constraint.** People follow the easiest trail; show, don't describe; option density fits the context.

**Violation.** From a game page, production answers Andrew at the top ("· 7.5 pts in this game") but leaves the season out; this
round's sheet puts the season first, so his answer moves down. Conor's trail to the board was one tap (a numbers row); opening the
row in place now adds one.

**R5.** Each person's question is answered at a fixed depth. Joanna's (who, still in, doing well) and Andrew's (her points and
place in this game) are in the first view without a tap, from every way in: the game you came from sits first in In your games,
open, its points and place on the row inside the first view. Conor's is two taps: a numbers row opens in place below itself (the
row stays under the thumb), and the door to the board sits directly under the strip it opened. The opened game row's weeks are
drawn on the show chart's own episode columns, so "her season counted by this game" is shown, not described.

**Citations:** Thaler and Sunstein (2008) for choice architecture; Hertwig and Erev (2009) for experience over description.

## R1–R5

1. The key costs one chunk (three fixed classes, no other chart colours); a row reads as two things; at most four blocks first.
2. "Doing well?" is answered by the glance: mass above against below the line, and the teal share, coded by position and colour.
3. One form per fact: the class mark is a piece of bar; one signed format; ⌄ opens in place, › opens a level, nothing else does.
4. Every order shows its key (each row's worth); no colour borrows another's meaning (red stays "went home").
5. Joanna and Andrew answered with no tap from every way in; Conor's board two taps away, its door under the strip.

## The first views

**A watcher's** (Survivor 51's Sharonda from the Cast tab, Ep 7; the sheet of about 743 px):
1. The name, "Survivor · up to Ep 7".
2. Who: her face at the left (76 × 96), the group, the bio line, Still in, Started on, what she holds.
3. Each episode: seven columns fitted to the width, mostly grey with teal at the line and two setbacks hanging under it; "14
   moments so far" in the caption; the key on one line under it.
4. Their numbers: "Most valuable first" at the head, the first rows in view: the big moments, then the small.

**A player's from Weekly Lineup's page** (the test couch's Jelly, Ep 5):
1. The crumb (Weekly Lineup ›), the name, "ZT Survivor · up to Ep 5".
2. Who, as above.
3. Each episode, as above.
4. In your games: Weekly Lineup first and open: "+7.5 · 3rd of 18" on the row; her points each episode on the chart's own columns;
   its holders begin at or under the fold.

**Measures for the check:** her face within the first 300 px; the key one line, two at most with "went home"; no colour in the
chart but the three classes and the went-home red on the axis; the opened game row's number above 600 px from a game page; a
watcher's first numbers row in view; every numbers row showing its worth; ⌄ only on rows that open in place, › only on rows that
open a level; no words over words.

## Proposals tested

| Proposal | R1 | R2 | R3 | R4 | R5 |
| --- | --- | --- | --- | --- | --- |
| Production's Cast tab sheet | fails: a key of names | fails: hues of identity | passes | fails: games without points | fails: Andrew taps away |
| Production's game sheet | passes | fails: no face | fails: a filled gold tag | passes | fails for Joanna: no season |
| The spec's structure, setbacks in red as first asked | passes | passes | passes | fails: red predicts "went home" | passes |
| The spec's structure, setbacks in Ember | passes | passes | passes | passes | passes, with the weeks on the chart's columns |
| 1+ (the last round's recommendation) | passes | passes | passes | passes | passes for players; a watcher's sheet has no value read |

## The gap

No proposal so far draws a game's weeks as the same season counted another way: on the show chart's own columns, under it, shorter
and in the game's colour, so the second chart reads as a row's detail and the two measures line up episode by episode (R1, R5).
And the class mark needs a form of its own, a piece of bar, kept apart from the group's square (R3).

*Initial findings. Ralph Loop a requirement, cite further, switch to analyze / evaluate, or ask any follow-up to dig deeper.*
