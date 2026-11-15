# The Games tab and the draft room, first view: requirements (step 6)

Mode 2 derivation on [the page spec](step6-games-spec.md), at 390 × 844, building on Phase 0's app-wide
[R1–R5](phase0-first-views.md) and step 5's [cast requirements](step5-cast-first-view.md) (the face wall is shared). Today's
frames: `.ui-atlas/stories/step6-games/before/` (the zt couch: `games-alex`, `games-sam`, `games-person-sheet`,
`old-season-games`; the draft couch, `draft/`: `draft-games-alex`, `draft-room-waiting`, `draft-room-up`, `draft-room-teams`,
`draft-room-queue`, `draft-blind`, `sport-room` at 344 athletes; the bench, `bench/`), measures in the `.json` beside each.

## The problem

Someone opens Games to see where they stand in each game and do the one thing a game needs. Today Alex's first view
(`games-alex`) is the bar and control, the strip's yellow move, a row of placing pills, then the Outlast title, its Rules link, a
move card with its own yellow Claim, and the top of a four-row table: 21 controls, 11 type sizes, two yellow fills, and only one
game of three reached; the whole tab is three screens. In a draft (`draft-games-alex`), Outlast's table ranks people by how many
castaways they've drafted ("T3 alex 1") and calls that count points. In the room (`draft-room-up`) the order is said three times
(a ticker, a clock card, a strip of 26-px faces), six faces fit on a screen at three to a row, your own team is a tab away, and a
tap on a face when it isn't your pick does nothing visible. At a sport's size (`sport-room`) it is 338 photo tiles, 37,000 px tall,
behind a row of 32 team chips, with no search.

## L0 · Cognitive load

**Constraint.** Working memory holds three to five chunks, and unattended noise still spends it.

**Violation.** `games-alex`: 21 controls and 11 type sizes in the first view; each game said three times (its pill with a place,
its title, its table's "you" row). `draft-room-up`: four bands above the first face (ticker, clock, order strip, view switch,
tribe chips: five), each a different way of saying whose pick it is or how to filter.

**R1.** The Games tab's first view holds four chunks: the show and your place (the bar with the compact control), what's yours
(the strip), and the games, each a row whose own content is at most three chunks: its name with your place in its unit, its one
action with its state, its mini leaderboard. No pills, no Rules, no move card with faces. Each row compact enough that, with
three games, two whole rows and the head of the third are in the first view (a leaderboard row at most 44 px; four rows plus
the head about 260 px). The draft room's first view holds three chunks above the board: the clock (who's up, picks until yours,
the last pick in one line), your team (its slots), and the view switch; then the board. At most five type sizes in either.

**Citations:** Cowan (2001) for the three-to-five chunk ceiling; Hassin et al. (2009) for unattended noise spending working
memory.

## L1 · First impression

**Constraint.** Meaning is judged in about 50 ms; faces are processed first and fastest.

**Violation.** The Games tab opens on chips and a 26-px display title, not on people; a table's faces are 26-px chips at the
row's end, the least legible size. The draft room's best asset, the castaways, arrives at 6 per screen; at a sport's size the
first 50 ms is a team logo standing in for a person and a row of team names.

**R2.** On the Games tab the first thing under the strip is the first game's name and your place in its own unit, set as the
largest number on the row; the people (a face, a name) are the leaderboard. In the draft room the first thing is a face and a
sentence (who's up), then your slots, then the cast as step 5's face wall (four to a row, a name each, by tribe: about 12 faces
in view when you're not acting, 8 with the confirm bar). On a sport the first element under the clock is search and positions,
then rows with a small headshot; never a wall.

**Citations:** Lindgaard et al. (2006) for the 50 ms judgement; Leder et al. (2004) for perception before classification.

## L2 · Processing fluency

**Constraint.** One form per fact reads as true; a second form costs a re-read and erodes trust.

**Violation.** A game's place appears as a pill, as the table's highlighted row and (on Tonight) as a mini: three forms. A due
move appears as the strip's yellow and the card's yellow Claim in the same view. The order is a ticker, a clock and a strip.
A tribe is a square on a tile and a filled chip in the filter. Outlast's mid-draft "points" are a count of picks.

**R3.** Each fact has one form in a view. The due move's yellow is the strip's when the strip is in view; a row's action is then
outlined, with the state as words ("Due · locks Wed 8 PM"). A game's place is said once, in its row. In the room the order is the
Picks board's alone; the clock says only where you are in it ("3 picks until yours"). A tribe is the wall's square and name,
everywhere. A number on a leaderboard is the game's own unit, and a game that hasn't counted anything shows no ranking at all.
The room's wall, the person sheet and the leaderboard row are the parts the round already made (step 5's wall, step 2b's sheet,
step 2c's table row), not new forms.

**Citations:** Reber and Schwarz (1999) for one form reading as true; Alter and Oppenheimer (2009) for the cost of a second form.

## L3 · Prediction

**Constraint.** People act on prediction and notice only what breaks it.

**Violation.** On the Games tab the game's title is a link with a chevron while the table rows open sheets and the move card
opens a third thing; nothing says which is which. In the room, tapping a face out of turn does nothing but a toast; the star
sits over the photo where a tap on the photo means select.

**R4.** Every row predicts its target: a game's name row (with its chevron) opens the game's page; a person opens their sheet in
that game; the action opens the move. In the room a face tap when you're up selects it (the confirm bar names it); when you're
not, it stars it (the queue), and the clock says so ("Riley's pick · tap to queue"). A sport's search predicts a name or a team
and filters as you type.

**Citations:** Clark (2013) for prediction and its violations; Nisbett and Wilson (1977) for behaviour over stated preference.

## L4 · Decision

**Constraint.** One decision per view, with what decides it beside it; no manufactured urgency.

**Violation.** Two yellow actions compete on the Games tab. In the room, the casual player's decision (take one) shares the view
with the sweat's tools at full weight (ticker, strip, filters), and nothing about a castaway sits beside the choice: the sweat
can't see who's done what, and at a sport's size nothing ranks the 338.

**R5.** The Games tab's one decision is the due move (one tap from the row or the strip). The room's one decision is the pick: one
tap on a face, one on Draft, the confirm bar the only yellow. The sweat's depth sits one tap away and dense where it lives: the
Picks board, the queue, the person sheet from the chosen face (what they've done, at a later stage's draft), and on a sport the
ranking line on every row and a sort. No countdown unless the Commissioner set a timer ("no rush, no timer" stays); no red, no
"hurry". Your team's slots and its "Needs" line sit above the board, so what the team lacks is beside the choice.

**Citations:** Iyengar and Lepper (2000) for one decision at a decision point; Hertwig and Erev (2009) for a choice made from
experience (the queue, the sheet) over description.

## The first views, then

**The Games tab (Alex, three games).** The bar and compact control; the strip (yellow when due); the first game's row: its name
in the game's ink with a chevron, your place as the largest number ("2nd" of 4 · 21 pts), the state and outlined action, four
leaderboard rows of about 40 px; the second row the same; the third game's name at the fold. Must not: pills, Rules, a move card
with faces, a second yellow, faces at the end of leaderboard rows (they're the Last picks fold).

**A game mid-draft (the draft couch).** Its row first: "You're up · Round 2, pick 7", the order as small faces with yours marked,
Draft outlined while the strip holds the yellow. Must not: a leaderboard of pick counts.

**The draft room, you're up.** The bar; the clock (your face, "You're up · Round 2, pick 7", "Jordan took Eric" under it); your
four slots; Available · Picks · Queue; the wall; the confirm bar. Must not: a ticker, an order strip, three-across tiles.

**The draft room, waiting.** The clock (Jordan's face, "Jordan is picking", "You're next" or "3 picks until yours"); your slots;
the switch; the wall with stars. The eye: the face in the clock, the count to yours, your slots, the faces.

**A sport's room.** The clock; your 15 slots folded to a line ("2 of 15 · Needs QB, RB, 2 WR, TE, K, DEF"); the switch; search and
positions; rows. Must not: 32 team chips, photo tiles, a logo as a person.

The eye's order everywhere: who (a face) → where you stand or how long until you act → the one action → the depth.
