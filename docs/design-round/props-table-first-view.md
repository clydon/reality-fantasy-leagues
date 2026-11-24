# Prop sheet round: first-view requirements (Perception-First Design, Mode 2)

On [the spec](props-table-spec.md). The phone is 390 × 844, dark.

## The problem

A fan opens the prop sheet a few hours before kickoff to answer "Who throws for the most yards?". To answer it, they need to know
which game it's about and which players are real candidates. Today the game is named by an index ("Game 10"), and the candidates
are hidden among 50 equal faces with no numbers, so the pick is a guess or a memory test.

## The layers

**Foundation (attention and context).** Constraint: someone arrives with one question in mind ("what am I answering, about which
game?") and spends the first second confirming it. Violation: "Game 10" needs translating ("which one is that?"), and a truncated
"CINCINNATI BEN…" doesn't answer it either.
**R1: the game is named the way people say it, the opponent first ("Week 11 at Bengals"), in the header and the strip, uncut.**
Citations: Kahneman (2011) for System 1 recognition beating recall; Norman (2013) for matching the user's model, not the system's.

**L1 (preattentive: what pops).** Constraint: in under 250 ms the eye goes to the single highest-contrast element. Violation: a
grid of 4 × 13 equal photos has no figure, so the eye wanders across shirts. Requirement: one column carries the highlight (the
settling stat, YDS/G), its top value the brightest number. Headshots shrink to 28 px marks, not the figure.
**R2: one highlighted column (the stat that settles the question), the top row's number the strongest element below the question.**
Citations: Treisman & Gelade (1980) for a single feature popping out; Wolfe (1994) for guided search toward one salient feature.

**L2 (gestalt: grouping and order).** Constraint: rows read as a ranked list only if alignment and spacing make them one group
in one order. Violation: the grid's wrapping order (left to right, then down) means nothing. Requirement: one row per player,
numbers right-aligned in columns, the contenders as one block, a clear break before "Everyone else" (folded).
**R3: contenders as one ranked, aligned block (2 to 5 rows) and everyone else folded behind one labelled row.**
Citations: Wertheimer (1923) for proximity and similarity grouping; Tufte (1983) for aligned comparison of numbers.

**L3 (cognitive load and decision).** Constraint: working memory holds about four items, and choice falls apart when the options
are many and equal. Violation: 52 faces for a question with about 3 real answers. Requirement: the first view shows at most
5 rows and 3 number columns (YDS/G, Last, Season); further columns are scrolled to, never in the first view. The injury tag sits
beside the name, where the decision happens.
**R4: no more than 5 rows and 3 number columns in the first view. Injury status is shown inline. Nothing else competes (no filters or trend %).**
Citations: Cowan (2001) for about four chunks; Iyengar & Lepper (2000) for choice overload.

**L4 (trust and commitment).** Constraint: someone commits when they can see what they've chosen and that it's kept. Violation: a
face outline is a faint signal, and the "started" toast (with Undo) after a tap reads as something irreversible. Requirement:
the picked row is unmistakable (a tick and a tint, the name repeated on Save: "Save: J. Burrow"), and taking it back is the same tap.
**R5: the pick is shown in the row and on the Save button by name, and can be undone by tapping it again.**
Citations: Nielsen (1994) for visibility of system status and user control; Fogg (2003) for credibility from transparent feedback.

## R1 to R5 (all non-negotiable)

1. The game is named by its opponent (and week), uncut.
2. One highlighted settling column.
3. A ranked contenders block; the rest folded.
4. At most 5 rows × 3 numbers in the first view; injury inline.
5. The pick is named in its row and on Save; the same tap undoes it.

## The first view, in the order the eye takes it

1. The question, "Who throws for the most yards?", and "+1".
2. The YDS/G column's top number (the largest number on the screen), then down the column.
3. The names beside the numbers (with team and position, so "CIN · QB" says it's the other side's).
4. The fold row, "Everyone else · 98", read last and not demanding.

**Must not be in the first view:** the full roster, column-sort controls drawn as buttons (the header is the control), filters,
any copy explaining the table.

**Casual fan versus the sweat.** Joanna reads the top row and taps it (two seconds). Conor scrolls the columns, sorts by Last game,
opens the athlete sheet. The same table serves both, because the default sort is the answer to the casual fan's question.

## Testing the existing proposals

- **The current face grid:** fails R2, R3 and R4; meets R5 partly.
- **The spec's table:** meets R1 to R5 if the first view holds 5 rows or fewer. A question with more contenders (receiving yards:
  8 or more players with REC) must cap at 5 and fold the rest into "More contenders · 4" above "Everyone else".

## The gap

The spec didn't cap the contenders. It does now (the fold above). Also, R1 for "Who wins?": the two sides as short names with
each team's record ("Commanders 6–4", "Bengals 5–5"), so the comparison reads without truncation.

> *Initial findings. Ralph Loop a requirement, cite further, switch to analyze / evaluate, or ask any follow-up to dig deeper.*
