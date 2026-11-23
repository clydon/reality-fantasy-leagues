# The lone fan (sports-couch C2): first-view requirements (Perception-First Design, step 2)

Mode 2 derivation on [lone-fan-spec.md](lone-fan-spec.md), once, bottom-up, for This week's calls card (and where it sits) and the
team page's fan card at 390 × 844. This week's first view: the league's bar (about 130 px), the move strip when one is due (about
70), a rivalry card when there is one (about 320 fresh). The team page's: its bar (56), the plate and follow line (about 120), then Now
(the scorebug, about 76, and Play the next game, the page's yellow, about 64).

## The problem

Jordan is the couch's only Giants fan. He wants to say, in a tap, that the Giants win Sunday, and to be known for being right; the rest
of the couch wants to say, in a tap, whether he's right. What's in the way today: nothing on either page is about him. His game is a
line in a table, his team's page shows his face and nothing he's done, and the only move is a generic Pick'em.

## The layers

**Foundation, load.** Constraint: about four chunks at once (Cowan 2001); unattended noise still spends working memory (Hassin et al.
2009). Violation: a row per couch team (five), each with a game, a fan, a call, a record, faces either side, counts and two buttons,
would be thirty chunks; the fan card adds a record, ticks, a couch line and the call again.
- **R1. A call row is three groups: the game with the call in one line pair (the fan's face, name and side over the game and its
  time), the backing (faces and counts, one line, only once someone's picked), and one action row for you. At most 120 px before
  kickoff with no backing, 150 with it. The calls card shows the rows you can act on first, three rows at most, then "+N more calls"
  (the house's held height: many games, one row each, the rest folded). A spectator sees no row for a game with no call.**
- **Citations:** Cowan (2001) for the limit; Hassin et al. (2009) for noise spending working memory unattended.

**L1, the first glance.** Constraint: faces are found before words (Lindgaard et al. 2006); one colour that means act pops out
(Treisman & Gelade 1980). Violation: two yellows (the rivalry's call and Jordan's call, or Jordan's call and the team page's Play the
next game) split the eye; Back and Fade as two loud buttons on every row would make the card a wall of buttons.
- **R2. The fan's face and name lead each row; the call's side is the row's bold word. One yellow a view: the move strip's, else the
  first rivalry card you're a fan in, else your own uncalled call (your team's button); everything else outlined. Back and Fade are
  two outlined buttons with their team's marks. On the team page the fan's own call is the yellow and Play the next game steps down
  to outlined (the call is a Pick'em on that same game: two yellows for one game would ask the same thing twice); for anyone else
  Play the next game keeps the yellow and Back and Fade are outlined.**
- **Citations:** Lindgaard et al. (2006) for the first impression; Treisman & Gelade (1980) for a single feature popping out.

**L2, fluency.** Constraint: one form read many times becomes effortless (Reber & Schwarz 1999); a game said twice costs a re-read
(round 2's R1: a game appears once). Violation: the calls card naming Giants vs Bears and the couch's table naming it again; the fan
card naming the game the scorebug just named.
- **R3. The call row is the rivalry card's language: the face line with the side in bold, the sides line (faces left and right, the
  split rule, the counts in words) for backing and fading, the same quiet fill with a check for a picked button. A game in the calls
  card is "Jordan's call, above" in the couch's table. On the team page the call row goes in Now, under the scorebug (the game named
  once, by the bug), not in the fan card; the fan card holds who and how good: whose team, the record, the ticks, the couch's line.
  The ticks read as the table's form ticks: a right call the good teal, a wrong one outlined, one a week.**
- **Citations:** Reber & Schwarz (1999) for fluency; Alter & Oppenheimer (2009) for fluency carrying into trust.

**L3, what people predict.** Constraint: people predict from the group chat (Clark 2013): "Jordan says Giants" then "no chance";
"backing" and "fading" are the words fans already use. A spectator with no stake predicts nothing asked of them. Violation: "Pick a
side" on a lone fan's game would read as a rivalry; a record without its count of calls reads as a percentage.
- **R4. The words are the fans': "Jordan called Giants", "Back Jordan", "Fade Jordan", "Backing Jordan" when picked. The record is
  won–lost in the number type ("7–1"), never a percentage. The fan's own row says what the couch can do with it ("The couch can back
  or fade it") once, before the call. After a back or fade, the fan reads that his call stands, so a missing Change isn't a mystery.**
- **Citations:** Clark (2013) for prediction; Seckler et al. (2015) for trust from coherence.

**L4, the decision.** Constraint: near action wants concrete, near words (Trope & Liberman 2010); show, don't describe (Hertwig & Erev
2009). Violation: a sheet to make a one-word call; a confirmation for a back.
- **R5. Every move is one tap in place, no sheet: the call (a team's button), a back, a fade; tapping a picked button again clears it.
  The fan's team is the first button. Nothing confirms; the button turns over at once. A watching mark is one tap on the game's sheet.**
- **Citations:** Trope & Liberman (2010) for near-action wording; Hertwig & Erev (2009) for experience over description.

## R1–R5

All five hold together: three-group rows of the rivalry's language (R1, R3), faces first with one yellow (R2), the fans' words (R4),
one tap in place (R5).

## First views, in the eye's order

- **This week, a call week (Jordan, no rivalry of his):** the strip if due · the rivalry card(s) · **This week's calls**: his row
  first ("Your call · Giants vs Bears · Sun 1:00 PM", Giants filled yellow, Bears outlined, "The couch can back or fade it"), then
  Sam's call row (Back Sam · Fade Sam) · the couch's teams (Giants: "Your call, above").
- **This week, a spectator (Sam on Jordan's call):** the rivalry card · the calls card: his own uncalled row first (he's a fan too)
  or Jordan's row with Back Jordan · Fade Jordan.
- **The Giants' page as Jordan:** the plate and follow line · **the fan card**: face, "Your team on the couch · since Sep", "Your
  calls 7–1" big, the ticks · Now: the scorebug, then the call row (his call yellow), Play the next game outlined.
- **The Giants' page as Sam:** the plate · the fan card (Jordan's, with "Backing Jordan 5–2 · fading him 2–6") · Now: the bug, the call
  row with Back Jordan · Fade Jordan, Play the next game yellow.

The calls card's first view (no backing yet): its head (36) · a row (game and call 52, action 48: 100) · a second row (100). Under
300 px: the couch's table still starts in view when there's no rivalry.

Must not be in the first view: two yellows; a sheet for a call; a result, check or record for anyone hiding; a row for a game nobody
called (for a spectator); the same game twice.

## The spec's proposals against R1–R5

- The calls card under the rivalries, above the couch's table: R1 and R3 pass (moves above the map, as the rivalry is).
- The call row inside the fan card: **fails R3** (the game named twice, under the plate and in the bug). Moved to Now, under the bug.
- Play the next game kept yellow beside the fan's call: **fails R2**. It steps down for the fan.
- Back and Fade as two outlined buttons with marks: R2, R4, R5 pass.
- A call stands once backed: R4 needs the words for it ("It's backed: your call stands").
- The fan card's ticks by week: R3 passes as the form ticks' language.

## The gap

The spec doesn't say what the **calls card is called** (R4: the fans' word). "This week's calls" names it; a week of one call reads
"Jordan's call" as the head? No: the head stays "This week's calls", so the card is findable week to week (fluency). And it doesn't say
what the fan sees when **both his team's game and a rival's call** are due: his own row first, always (R1: rows you can act on first).

> *Initial findings. Ralph Loop a requirement, cite further, switch to analyze / evaluate, or ask any follow-up to dig deeper.*
