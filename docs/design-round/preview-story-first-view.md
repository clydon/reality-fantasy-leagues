# The game preview's story: first-view requirements (Perception-First Design, step 2, Mode 2)

On the page spec (preview-story-spec.md). Rule Zero kept: requirements first, then what satisfies them.

## The problem

The person setting up a game wants to know the season will play the way they imagine before they commit their couch to it. What
stops them: the game exists only as rules in words, and a rule's consequences (teams that come out the same at the merge, a team
that shrinks, a lead that can or can't be overturned) only show up weeks into a real season. Reading rules to predict that is work
they won't do mid-setup, and a description underweights exactly the rare, surprising outcome they need to see.

## The layers

**L0, cognitive load.** Constraint: working memory holds about 3 to 5 chunks, and visual noise spends it even unattended.
Violation risk: the merge card holds 4 teams × 5 faces, the race 4 lines × 5 episodes, plus numbers and words; that's 20+ things.
**R1:** each card answers its one question with **at most four visual groups** in its first view; a team (a row of faces) or a
person's line is one chunk; **no running text**, one short label per card; at most one number in the picture and one "typical"
mark; the frame's own controls (made-up, Shuffle, Close, where you are) in one quiet row.
**Citations:** Cowan (2010) for the 3-5 chunk ceiling; Hassin et al. (2009) for unattended noise spending working memory.

**L1, first impression.** Constraint: the visual judgement forms in about 50 ms and gates everything after it. Violation risk: a
card that opens on a heading or a sentence reads as a document, not a game. **R2:** each card's **first view is its picture**: the
largest thing on screen is the answer (faces for a draft, the strip for a season, lines for a race), the whole card fits a phone's
view without scrolling, the season's real faces and art carry the quality, and "made-up" is perceptible in the first glance
without leading it.
**Citations:** Lindgaard et al. (2006) for the 50 ms judgement; Kurosu & Kashimura (1995) for appeal read as function.

**L2, processing fluency.** Constraint: what's easy to process feels true; inconsistency erodes trust. Violation risk: six cards
each inventing an encoding (a different colour for Alex here and there, time running a different way). **R3:** **one encoding
across every card and the app**: each person one colour and initial, as on the game's own pages; time is one horizontal axis
(Episode 9 at left, 13 at right) in the same place on every card that has time; the two stages are the same two bands everywhere;
a castaway is always the same photo tile; good and bad points in the app's own colours; the app's own type.
**Citations:** Reber & Schwarz (1999) for fluency read as truth; Spence (2011) for coherence across signals.

**L3, perception bias.** Constraint: people run on prediction; a violation fires attention, and one vivid example is
over-generalized. Violation risk: one made-up season read as "what will happen", and a flag lost among equally loud things.
**R4:** the flag is **the only expectation-violating mark on its card** (the castaway on every team singled out across the rows),
and "typical" is shown **as a frequency you can see** (29 of 30 seasons as filled marks) beside the single season, so the vivid
example never stands in for the pattern.
**Citations:** Clark (2013) for prediction error drawing attention; Hertwig & Erev (2009) for rare events underweighted from single
samples and descriptions.

**L4, decision architecture.** Constraint: decisions follow the structure; demonstrated beats described. Violation risk: a flag
that only says "consider changing X", or a story that ends without a decision. **R5:** the fix is **demonstrated on the same
picture** (taking it redraws the rows in place, before and after on one card) and taken in one tap; the last card resolves into
the decision, start this game or go back and change it, with nothing pushing either way; Shuffle shows the variance by doing it.
**Citations:** Hertwig & Erev (2009) for demonstration over description; Thaler & Sunstein (2008) for the easy path being the
chosen one, used here only for the person's own goal.

## R1 to R5 (all must hold)

1. At most four visual groups a card; no running text; one label, one number, one typical mark; controls in one quiet row.
2. The first view is the picture, fits without scrolling, real faces and art; "made-up" perceptible, not leading.
3. One encoding everywhere (person colour and initial, one time axis, the two stage bands, the face tile, the app's type and colours).
4. The flag is the only surprise on its card; typical as a visible frequency beside the one season.
5. The fix shown on the same picture and taken in one tap; the end is the decision; Shuffle demonstrates variance.

## What satisfies them: per card, the first view and the eye's order

The frame (every card): top row, quiet: where you are (six short bars), "Made-up season" chip, Close. Bottom: Shuffle at left,
Next at right (or tap the right half). The card's label sits under the top row, 2 to 4 words in the display face.

| Card | Eye order (first → last) | Must be there | Must not be there |
| ---- | ------------------------ | ------------- | ----------------- |
| The season | the strip (9 → 13, two bands, the merge's draft mark, the crown) → your move marks under it → the winner's face and margin → "1 to check" | the strip as the hero, about half the view | rules, scores per week, other people's moves |
| The draft | your five faces (large) → the couch's three rows (small) → the shared marks | your team at full width; each person's colour on their row | points (nothing has happened), names under the small faces |
| Each week | your five: three lit with their points, two dimmed with theirs → the swing bar (worst … your pick … best) → typical swing | one episode only, the one shown named | every episode at once, the couch's lineups |
| The race | the lines on the shared axis → the merge mark → the leader's endpoint | each line in its person's colour with its initial at the end | a legend box, gridlines beyond the axis |
| The merge | the seven still in → the four rows → the castaway on every team ringed → the 29-of-30 marks → the fix | the flag as the only accent; the fix as a control on the card | an explanation paragraph; a second flag |
| The finale | the crown on the winner → each person's total as two stacked parts (before / after the merge) → margin → typical marks → Start this game / Change it | the two stage parts in the stage bands' colours | a full table of weeks |

## Gap

The spec already orders the cards, but none of it held R4's "typical as a visible frequency": a percentage or a sentence would
pass R1 and fail R4. The marks (30 small ticks, filled for the seasons where it happened) are the non-obvious part, and the same
mark serves every card that has a "typical".

*Initial findings. Ralph Loop a requirement, cite further, switch to analyze / evaluate, or ask any follow-up to dig deeper.*
