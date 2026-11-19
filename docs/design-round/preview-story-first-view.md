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

## Round 4: a card from any game, and the sheet (PFD Mode 2, 2026-11-18)

**The problem.** (1) Someone deciding whether to make a game has to come away from a few cards knowing what the game is, what
they'll do each week, when moves lock and how to win, from real screens they've never seen. Those screens are dense (ten to twenty
items each) and shown at about 60% scale, so the eye goes wherever the app is loudest, not to the moment's answer. Where the app
contradicts the season, the screen and the card disagree, and nothing says which to believe. (2) Someone sweeping hundreds of games
has to compare like with like across games. If each phone sits at a different point in its story, every comparison means reading
two stories, and a game's bugs and its soul can't be judged at a glance.

**L0 Cognitive load.** Constraint: about four chunks held at once, and visual noise spends that bandwidth even unattended. Violation:
the screen alone exceeds it; the preview's own layer adds a progress bar, a tag, a name, a headline, a check, tabs, a bug line and
controls. **R1: above the phone, the preview's layer holds at most three chunks: the claim, its one second line, and one more slot
(the check, or the bug line of the screen on show, never both at full weight). Inside the phone there is one ringed proof (one
element, or one aligned set such as the ×4 badges). On the sheet, each column carries at most three chunks of its own (the game's
name, what it has in one line, its bug count) and every column shows the same moment, so the comparison has one variable.**
Citations: Cowan (2001) for about four chunks; Hassin et al. (2009) for unattended noise spending working memory.

**L1 First impression.** Constraint: the first glance (about 50 ms) decides where attention goes. Violation: the phone (large, full
of faces and high contrast) and the app's own yellow strip inside it outshine the headline. **R2: the first fixation is the
headline, the largest type on the card outside the phone; the second is the ring, the highest-contrast mark on the phone. The
preview's layer uses no yellow except Create this game on the last card, so the app's own yellow inside the phone keeps its
meaning (your move). On the sheet, the first glance lands on the row of phones at one moment, each named above; bug counts come
second.**
Citations: Lindgaard et al. (2006) for the 50 ms judgment; Leder et al. (2004) for the staged read (perceive, then classify).

**L2 Processing fluency.** Constraint: what is easy to match feels true; one inconsistency costs trust everywhere. Violation: a
card that names the move in its own words beside a screen that names it differently, or a bug mark that paraphrases the screen,
makes the viewer translate. **R3: the claim uses the screen's own term for the move ("Set your lineup" on the screen: the card says
"Start 3 of your 5"); a bug mark quotes the screen's exact words in quotes ("App bug: says 'All set for Ep 9', but your draft is
due"); the preview's frame is identical on every card and every game (same places, sizes and words for the same roles), so the
only differences between games are the games' own screens. On the sheet every column's chrome is identical.**
Citations: Reber & Schwarz (1999) for ease read as truth; Spence (2011) for the elements telling one story.

**L3 Perception bias.** Constraint: people trust what they see over what they're told, and visual coherence carries trust more than
argument does. Violation: an unexplained mismatch between claim and screen reads as the preview being wrong, and the viewer stops
trusting both. **R4: every claim has its proof visible on the screen it opens on (ringed); a card never opens on a screen that
contradicts it; every contradiction is attributed to the app, on the screen that has it ("App bug:"), never left for the viewer to
notice. On the sheet a column with bugs is told apart without reading (its count, its marked tabs).**
Citations: Seckler et al. (2015) for trust as a perceptual output; Clark (2013) for a mismatch firing attention.

**L4 Decision architecture.** Constraint: decisions from experience weigh outcomes as they are; near decisions want concrete terms.
Violation: the lock lives only inside a screen ("Locks when it airs"), the win only in the rules, so the lay of the land has to be
inferred. **R5: each of the four answers is words on its own card, in season order (the game's name and line; the move in the
game's terms; the lock as a concrete day and time; who won, by how much, and how it's won), and the story ends on the decision (Go
back, Create this game) straight after how to win. On the sheet the moment control is the one primary control, and each column's
bugs are listed as plain lines under its phone: the sweep's verdict material, with nothing else to act on.**
Citations: Hertwig & Erev (2009) for decisions from experience; Trope & Liberman (2010) for concrete terms on near actions.

**What satisfies R1 to R5.**
- **The card:** the top bar as now (progress, "Made-up season", the moment's name); the headline (the claim); one second line (the
  lock as "Locks Wed 8:00 PM, when Episode 9 airs", the game's line, the rule of the win); one slot for the check or the open
  screen's bug line; the tabs by the app's names (a bug marked on its tab); the whole phone with one ring; Next naming the next
  moment.
- **The sheet:** a header with the run (games, screens, bugs found), the moment control (The game, The draft, Each episode, After
  the first results, The next stage, The finale), then the row of phones at 390, each headed by the game's name, what it has and
  its bug count, its bugs listed beneath.

**Against what's built (round 3).** The card's headline carries the claim (passes R2), but no card says when moves lock in words
(fails R5); "App differs" doesn't say what's wrong (fails R3). The check sits above the tabs with the bug line below them (two
chunks where R1 allows one).

**The gap.** The lock as words on the Each-episode card, and one moment across every game on the sheet: neither exists yet.

*Initial findings. Ralph Loop a requirement, cite further, switch to analyze / evaluate, or ask any follow-up to dig deeper.*

## Round 5: a moment as the app's path, and the sheet's step (PFD Mode 2)

On [the spec's "Round 5"](preview-story-spec.md). A moment's screens now run in the app's own order: where you meet it, what a tap
opens, what it leads to. The viewer (someone about to make the game, or someone sweeping hundreds) must read the screens as a path,
not as a set of equal views, and must always know which step they're looking at.

**L0, load.** A card already holds a headline, a line, a check, the screens' names, the phone and any bug lines; chevrons add marks,
and three names with chevrons can wrap at 390.
- **R1.** The path reads as one chunk: one row that never wraps, at most three steps named, the step you're on the only filled one.
  The sheet's controls stay within two rows (the moment, the step).
  **Citations:** Cowan (2001) for the chunk ceiling; Hassin et al. (2009) for marks that cost memory unattended.

**L1, first impression.** The first glance at a card gives the gist of what's on the phone. Opened on a deep screen it says "this
screen"; opened on where you meet it, it can look like every other game's Tonight.
- **R2.** The first glance gives both: the place on the phone (step one) and the game's soul in the headline above it, in the game's
  own words. The row of steps shows at a glance that the path goes on (its direction, left to right).
  **Citations:** Lindgaard et al. (2006) for the 50 ms gist; Leder et al. (2004) for gist and classification as separate stages.

**L2, fluency.** A row of equal pills says "pick one"; a path says "this, then this". Chevrons on a segmented control mix the two.
- **R3.** The path in the app's own grammar for going deeper: names in order, the app's chevron between them (its drill rows' own),
  the current step filled. The sheet's step control uses the same words as the card's steps.
  **Citations:** Reber & Schwarz (1999) for fluency as truth; Alter & Oppenheimer (2009) for fluency carried into trust.

**L3, priors.** A sweeper takes the first screen as the important one. If step one is a show tab that looks alike in every game,
they may judge the games alike (the first exemplar anchors).
- **R4.** The sheet says which step every phone is on, in words, so a show tab at step one reads as where, not as the game; each
  column names its screen at that step; the headline (the soul) stays at every step.
  **Citations:** Kahneman (2011) for anchoring on the first exemplar; Clark (2013) for the expected and its violation.

**L4, decision.** Walking the path is the demonstration: moving through the steps is how the viewer learns the app's way.
- **R5.** The next step is the obvious tap beside the current one, and the card's Next keeps moving between moments, never steps:
  the two stay apart. The sheet's step sets every phone at once, held at a game's last step where its path is shorter, with that
  column saying which screen it shows.
  **Citations:** Hertwig & Erev (2009) for experience over description; Trope & Liberman (2010) for concrete near-term words.

**First:** the headline (the soul), then the phone at step one, then the row of steps. **Not there:** steps as equal pills, a
second set of arrows for moving between steps, a step control that hides which step it's on. **How much at once:** the
headline, one line, the steps in one row, the phone.

**The gap:** round 4's "the game's own screen first" fails R2 (the place) and R5 (walking it); a segmented control with chevrons
fails R3. Nothing in the story yet says which step a sheet's phones are on (R4).
