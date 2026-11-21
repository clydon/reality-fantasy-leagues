# How a sport's game scope is offered: first-view requirements (PFD solve, step 2)

On [the page spec](sports-scope-spec.md). Mode 2 derivation, once. 390 × 844, a sheet over the show.

## 1. The problem

A fan on their team's sheet wants a game "on the Bills". They can't tell which way in gives the whole season and which gives one game,
and once inside Start a game nothing tells them that a draft draws only Bills, or that eight of them can't each draft ten from the
Bills, until Start fails.

## 2. Layers, bottom-up

**L0, load.** *Constraint:* about 3 to 5 chunks at once; noise costs working memory even unattended (Cowan 2001; Hassin et al. 2009).
*Violation:* four ways in spread across four forms (a plate, a card, chips with a sentence link, rows lower down), each a separate
thing to parse. *R1:* the scopes **must** read as one group of like rows under one label, each row exactly two lines (the scope; then
games · whose players), at most three rows before a rival is picked. Whose players **must** appear only where a game picks players
or the scope decides them, never on Pick'em or the yellow plate.
**Citations:** Cowan (2001) for the 3 to 5 chunk ceiling; Hassin et al. (2009) for unattended clutter's cost.

**L1, first impression.** *Constraint:* the first glance sets the job (Lindgaard et al. 2006). *Violation:* none on the yellow; but
the outlined Start a game… card reads as a second primary. *R2:* the first phone view of the team's sheet **must** hold the team, the
yellow plate and the label and first row of "Start a game on…"; the yellow stays the only filled block. On a game's screen, the
whose-players line **must** be inside the first view (above How long), since it's what a draft is.
**Citations:** Lindgaard et al. (2006) for the 50 ms gate.

**L2, fluency.** *Constraint:* what's easy to process feels true; one fact said one way (Reber & Schwarz 1999; Alter & Oppenheimer
2009). *Violation:* the base's sentence says "from the two teams" beside marks HOU and BUF on a season of the Bills alone: two signals
disagree, so neither is trusted. *R3:* the sentence, the marks, the whose-players line and the size warning **must** say the same
teams in the same words ("Bills players only", "Dolphins and Bills players"), and the count **must** be a plain number, not a
fraction or a stat key. One phrase pattern across both surfaces.
**Citations:** Reber & Schwarz (1999) for fluency as truth; Spence (2011) for cross-signal coherence.

**L3, what they respond to.** *Constraint:* people act on prediction and autopilot; a violated prediction is what draws attention
(Clark 2013; Kahneman 2011). *Violation:* "The rest of the season" on the card, "Just Game 10" on arrival: the prediction breaks after
the commitment, where it costs most. *R4:* each row **must** open exactly what its title says (the season opens on the season), and
the whose-players line **must** change in place when How long changes, so the cause (length) and effect (pool) are seen together.
**Citations:** Clark (2013) for prediction error; Kahneman (2011) for System 1 commitment.

**L4, the decision.** *Constraint:* the right choice should be the easy one; show the consequence rather than describe it (Hertwig &
Erev 2009). *Violation:* the too-small pool is a refusal after Start, described in a toast. *R5:* the warning **must** sit in the
Start bar, before the tap, in numbers ("8 of you × 10 each is more than the Bills' 74 players"), with one fix as a tap ("Make it
shared"), and Start disabled until it fits. No urgency, no blame.
**Citations:** Hertwig & Erev (2009) for demonstrate over describe; Thaler & Sunstein (2008) for the easy right choice.

## 3. Requirements

R1 one group of two-line rows, whose players only where it matters · R2 yellow alone, first scope row and the whose-players line in
the first view · R3 one phrase pattern across sentence, marks, line, warning · R4 every row opens what it says, the line follows How
long · R5 the size problem before Start, in numbers, with a one-tap fix.

## 4. The solution that meets all five

- **Team's sheet first view (eye order):** the team plate → the yellow Play the next game → "START A GAME ON" label → rows: *The next
  game* ("vs Dolphins · tomorrow · a draft, squares or props") and *Their season* ("9 games left · Bills players only"). The rival chips
  and Coming up are below the fold; a picked rival's row lands in the same group. Row lines ≤ 44 characters at 15 px (one line at
  390).
- **Game screen first view (eye order):** the name → the sentence (now saying "from the Bills" / "from the two teams") → **whose
  players: marks + "Bills players only · 74"** → the effort line → How long. One line, muted weight, the marks as the visual anchor.
- **Start bar:** warning above Start, one sentence plus "Make it shared"; Start greyed with the reason only when there's no fix.

## 5. Proposals tested

- The spec's whose-players phrase on the next-game row ("both teams' players") fails R1's length (it pushes the line to two lines at
  390 with the opponent and day). **Change:** that row says the opponent and day and what kinds of game; the two teams are self-evident
  from "vs Dolphins". Whose players stays on the season, rival and series rows, where it's the difference.
- The spec's rival row "Every Dolphins game" passes all five.

## 6. The gap

Counting the players at all: on a season just made the page has none yet, so R5 can't be met until they arrive. The screen must say it's
getting them (not "0 players") and run the check when they land.
