# A castaway opened from a week: first view (BACKLOG 251)

Perception-First Design, Mode 2, on [the page spec](week-door-spec.md). Phone bottom sheet at 390×844: the sheet's header (crumb,
full name, "Survivor · up to Ep 9", close) ends about 225px down, leaving about 620px of first view.

## The problem

A player reading a person's week sees "Carter +6" and wants the reason. They tap the face. The sheet that rises answers a
different question (who Carter is, his season in the show's terms), so they hold "Episode 9, Weekly Lineup, +6" in their head while
they search two charts and a story for it, and the story carries no points. The question they tapped with goes unanswered.

## Layer by layer

### L0, cognitive load
**Constraint.** Working memory holds 3 to 5 chunks, and the question carried across a tap ("why +6, which week, which game") already
spends three of them.
**Violation.** Today's sheet makes the reader keep those three while they read a bio, a moments chart in a different unit (counts
by band, not points) and a game's season row, then add the parts up themselves.
**R1.** The answer arrives as one closed group the screen holds for them: the episode, the game, the total and its parts, together,
above everything else, with at most five rows of parts before anything folds, and nothing asking to be read before it.
**Citations:** Cowan (2010) for the 3 to 5 chunk ceiling; Sweller (1988) for arithmetic left to the reader as extraneous load.

### L1, first impression
**Constraint.** The opened sheet is judged in its first glance, and the first stage of that judgement is classification: "is this
what I tapped?"
**Violation.** The first fixation today lands on a photo and a bio line, so the glance classifies it as "a profile", not "Carter's
+6", and the reader starts searching.
**R2.** The first fixation lands on the number and the episode they tapped: the block's head repeats "+6" in the same big
condensed number and "Episode 9" in the same caption type as the week they came from, at the top left and right of the content.
**Citations:** Lindgaard et al. (2006) for the 50 ms judgement; Leder et al. (2004) for classification as the stage that fails first.

### L2, processing fluency
**Constraint.** What reads easily reads as true; one vocabulary and one number form across a path keep it easy.
**Violation.** A breakdown in other words than the card's reason ("Won the Immunity challenge" against "Individual immunity win"),
another sign style, or other colours than the chart below would read as a different set of facts.
**R3.** The block speaks the card's language: the moment names are the same strings the card showed (the card's reason is findable
in the list), signed numbers in the app's one form ("+6", "0", "−1.5"), the band marks the season chart uses, and the head laid out
as the week's own head (title left with its line under it, the number right), so the eye recognises the form it just left.
**Citations:** Reber & Schwarz (1999) for fluency as truth; Alter & Oppenheimer (2009) for fluency generalising to trust.

### L3, perception bias
**Constraint.** Trust is perceived before it's argued: a sum that doesn't visibly close is seen as an error in the game, whatever a
footnote says. Readers also predict that a player's points count for the person they came from.
**Violation.** A captain's double or a finale's window applied out of sight leaves the rows adding to 3 under a 6; a bench player's
points in full ink read as counted.
**R4.** The truth is checkable at a glance: every row's points sit in one right-aligned tabular column under the head's number and
add up to it, each factor a row of its own; counted against not counted is told by ink (muted for the bench) as well as words; and
the holder is named, since in a shared draft one castaway's points count differently for each person holding him.
**Citations:** Seckler et al. (2015) for trust as a perceptual output; Clark (2013) for a violated prediction firing attention.

### L4, decision architecture
**Constraint.** After the answer the reader's next move is, in order of likelihood: back to the week (to check the next starter),
the week before or after, what happened that night, the season. The environment should make that order the easy order.
**Violation.** A new block that adds a loud control, or a stepper beside the number, competes with the answer and with the way back.
**R5.** Next steps ranked by likelihood and never louder than the answer: the way back unchanged (the crumb and the phone's back, one
level); the neighbouring weeks as quiet text steps at the block's foot, after the rows are read; the episode's name as the door to
the night (underlined, as the week's own title is); the season by scrolling, its charts marking this episode so the week is found
in it. No yellow, no new primary action.
**Citations:** Thaler & Sunstein (2008) for structuring the easy path; Hick (1952) for each extra visible choice costing decision time.

## Requirements

- **R1.** One closed group first: episode, game, total and its parts together, at most five rows before a fold, nothing before it.
- **R2.** The first fixation lands on the tapped number and episode, in the forms the week used.
- **R3.** The card's words, the app's number form, the chart's colours, the week head's layout.
- **R4.** One tabular column that adds up, factors as rows; counted told by ink and words; the holder named.
- **R5.** Back unchanged; ‹ › quiet at the block's foot; the episode name opens the night; the season charts mark the episode.

## The first view

**Must be in it**, in the order the eye takes:
1. "+6", the big row number, top right of the content (R2).
2. "Episode 9", the caption title, top left, underlined as a door, the game's name beside it in the line under it (R2, R3).
3. "Started for ahaskell" (or the bench's "scored, didn't count"), the line under the title (R4).
4. The scoring rows, biggest first, then factor rows, one tabular column under the "+6" (R1, R4).
5. The muted "Also: … (no points in this game)" line when there is one.
6. "‹ Ep 8" and "Ep 10 ›", quiet, at the block's foot (R5).
7. Who's photo row: the first line of the season, the same as every way in.

**Must not be in it:** a chart or the band key (they belong to the season, below); a second total or sum line (the head's number is
the sum: say it once); a stepper beside the number; yellow; the In the couch's games row's season total.

**Load budget:** the block is one chunk for the eye (a head, its line, a column of rows that close on its number), Who is a second;
the reader holds nothing across the tap.

**Does the block push Who out?** No. Typical weeks have one to four rows, so the block takes about 200px (to about 425px), and Who's
photo row (96px, from about 445px) stays in the first view; Who's holdings line and the season chart move below it. That's right:
the face was the door they tapped, so who Carter is was already recognised; the each-episode chart, today in the first view, answers
the season's question, which comes second here. A week with six or more scoring rows pushes Who's photo out; the rows past five
fold under "N more" (R1) so Who's photo still shows.

## Against the spec's proposals

| Proposal | Holds? |
| --- | --- |
| The block above Who | yes: R1, R2 |
| ‹ › either side of the episode in the head | **no**: R5 (beside the number it competes with the answer); moved to the block's foot |
| Factors as rows with their added points | yes: R4 |
| "How it counted" as its own line | yes, as the line under the title (R3: the week head's form) |
| Moments a game gives nothing for, muted, one line | yes: under R1's five-row budget it costs one line |
| The season charts marking the episode | yes: R5; the spec says it, the build must draw it |
| No door on a moment's row | yes: R5, the rows are the answer, not a step |

## The gap

The spec lets a long week (six or more moments) grow past the first view; R1 needs a fold after five rows. And neither the spec nor
today's sheet makes the season charts mark the episode the reader came from; R5 needs it, or "where is this week in his season" is a
search.

*Initial findings. Ralph Loop a requirement, cite further, switch to analyze / evaluate, or ask any follow-up to dig deeper.*
