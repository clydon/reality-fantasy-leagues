# The victory lap (sports-couch C3): first-view requirements (Perception-First Design, step 2)

Mode 2 derivation on [victory-lap-spec.md](victory-lap-spec.md), once, bottom-up, for This week's lap card, the lap sheet, the game
sheet's final with its Victory laps, the room's lap message and the hub feed's lap row, at 390 × 844. This week's first view: the
league's bar (about 130 px), the move strip when one is due (about 70), then a rivalry card when there is one (about 320) or This week's
calls (C2, about 100 a row). The game sheet's: its title (about 64), the scorebug (76), the couch line (24), then the thread link.

## The problem

Jordan's Giants just won. He wants to tell the couch, the way he would in the group chat, in the time it takes to find a GIF; the couch
wants to see him do it, but only once they know the result. What's in the way today: the win and the room are four screens apart,
nothing marks a GIF as a victory lap, and the couch's feed never shows the room.

## The layers

**Foundation, load.** Constraint: about four chunks at once (Cowan 2001); unattended content still spends working memory (Hassin et al.
2009). Violation: a lap card carrying the score, the call, the rivalry, the record, a GIF preview and two buttons would push this week's
rivalry and calls out of the first view on the very week they matter most; a sheet that shows the picker, the line, the where-it-goes
words and the couch's laps at once is a form, not a moment.
- **R1. The lap card is three groups (the result, what else it settled, the ask) in at most 120 px, so the next card (rivalry or calls)
  still starts in the first view under a due strip. One card, the newest open win. The lap sheet is two steps in one sheet: the picker
  alone, then the chosen GIF, the line and Post; never both at once. A feed row or room message is one lap: the words, the GIF, the line.**
- **Citations:** Cowan (2001) for the limit; Hassin et al. (2009) for noise spending working memory unattended.

**L1, the first glance.** Constraint: one colour that means act pops out (Treisman & Gelade 1980); a face and a familiar mark are found
before words (Lindgaard et al. 2006). Violation: a yellow Take a victory lap would sit beside the due strip's yellow and turn an optional
gloat into a chore; a card with no team mark reads as any notice.
- **R2. The card is never yellow: the yellow stays the due move's. Its signal is the team's mark beside "Giants won" in the display
  (caption) type, the one display line on the card; Take a victory lap is the ink button (high contrast, not the chyron); Not this time
  is plain text. In the lap sheet, Post it is the sheet's one yellow (the sheet is its own view). On the feed and in the room the lap's
  face leads, then the GIF.**
- **Citations:** Treisman & Gelade (1980) for a single feature popping out; Lindgaard et al. (2006) for the first impression.

**L2, fluency.** Constraint: one form read many times becomes effortless (Reber & Schwarz 1999); a familiar part trusted in one place
carries its trust to the next (Alter & Oppenheimer 2009). Violation: a new GIF tile, a new result style and a new tag for each surface.
- **R3. One language for a lap everywhere: the result in the call row's result type ("Giants won", like "Jordan called it"), the score
  in the number type from the team's side ("24–17"), the GIF in React with a GIF's `GifTile` (the picture whole, the name on its strip
  under it), and one "Victory lap" tag (the same on the room message, the feed row and the sheet's laps). The picker is React with a
  GIF's own `GifPicker`.**
- **Citations:** Reber & Schwarz (1999) for fluency; Alter & Oppenheimer (2009) for fluency carrying into trust.

**L3, what people predict.** Constraint: people act on what they predict will happen next (Clark 2013); a fan's search for a win GIF
starts with the team's name. Two predictions decide whether he posts: who sees it, and whether it spoils anyone. Violation: an empty
search box; a Post with no word on where it goes; a hiding friend left to guess why there's a GIF about a game they haven't watched.
- **R4. The picker opens already searching "<team> win". Before Post, one line says where it goes and that it waits for anyone hiding
  scores ("To the NFL room and On the couch · waits for anyone hiding scores"). For a viewer hiding scores, nothing about a lap is drawn
  (not a placeholder, not a count): absence predicts nothing. The words are a fan's: "Take a victory lap", "took a victory lap", "Not
  this time".**
- **Citations:** Clark (2013) for prediction; Seckler et al. (2015) for trust from coherence.

**L4, the decision.** Constraint: near action wants concrete, near words (Trope & Liberman 2010); defaults carry the decision when effort
is the cost (Johnson & Goldstein 2003). Violation: a confirm step before Not this time; the keyboard rising over the GIF when the line
field takes focus; a line required.
- **R5. Two taps to post from the sheet (a GIF, then Post); the line is optional and never focused by itself (no keyboard over the
  GIF). Not this time is one tap, no confirm, and ends the ask on every phone. Posted shows the lap as the couch will see it, with Take
  it back beside it (recovery over prevention).**
- **Citations:** Trope & Liberman (2010) for near-action wording; Johnson & Goldstein (2003) for defaults deciding under effort.

## R1–R5

All five hold together: a three-group card that leaves the week's cards in view (R1), not yellow, its signal the team's mark and the
display line (R2), one lap language from the existing GIF parts (R3), predictable search and audience, absence for the hider (R4), two
taps and no confirmations (R5).

## First views, in the eye's order

- **This week, Jordan after the win:** the strip if due · **the lap card**: the Giants' mark, "Giants won" in the caption type, "24–17
  vs Bears", "You called it", [Take a victory lap] in ink, Not this time · the calls card (his row: "You called it") · the table.
- **The lap sheet, step 1:** "Victory lap" · "Giants 24–17 Bears · Sun" · the search ("Giants win") · the grid.
- **The lap sheet, step 2:** the GIF wide with "You" · Pick another · "Add a line (optional)" · where it goes · Post it (yellow).
- **The game sheet, final, Jordan:** the bug · the couch line · the prompt (its card form, without the score: the bug has it) · the
  thread link · Victory laps (below the fold is fine).
- **The game sheet, final, Sam:** the bug · the couch line · the thread link · **Victory laps**: Jordan's GIF with his name strip, his line.
- **The hub, Sam:** On the couch: "**Jordan** took a victory lap" · the Giants' mark, "Giants 24–17 Bears · NFL" · the GIF (150 px wide,
  the feed's GIF size) · the line.
- **The room's thread:** Jordan's bubble: the tag and the result · the GIF · the line.

Must not be in the first view: a yellow on the card; a lap, a count or a placeholder for anyone hiding; the picker and the line at once;
the keyboard over the GIF; the score said twice on the game sheet.

## The spec's proposals against R1–R5

- The lap card under the move strip, above the rivalry: R1 passes only at 120 px or less (it pushes the rivalry down by its height).
- Take a victory lap as the card's action: passes R2 as ink, **fails as yellow**.
- The lap sheet as picker, then line and Post: R1, R5 pass.
- The prompt on the game sheet repeating "Giants won 24–17": **fails R1** (the bug says the score). The sheet's prompt drops the score.
- Not this time leaving a quiet link on the sheet: R5 passes (one tap ends the ask; the link isn't an ask).
- Nothing drawn for a hider: R4 passes.

## The gap

The spec doesn't say what the card shows **when a co-fan has already lapped** (two fans of the winning team): the ask stays (it's theirs
too), and one line names it ("Casey took one"), so the second lap is a reply, not a duplicate (R3: it reads as the couch's language). And
it doesn't say how a **posted lap confirms on return to This week**: the card leaves with the sheet's Done; the room line further down
names the lap. Enough: the sheet's posted state is the confirmation (R5), and a lingering card would be a fourth group (R1).

> *Initial findings. Ralph Loop a requirement, cite further, switch to analyze / evaluate, or ask any follow-up to dig deeper.*
