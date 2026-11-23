# Solo (sports-couch C4): first-view requirements (Perception-First Design, step 2)

2026-11-23. `/perception-first-design:solve` (Mode 2), once, on [solo-fan-spec.md](solo-fan-spec.md). At 390 × 844, the Lower Third system
(dark, the number type, one yellow a view). The casual path is Joanna's (forgets) and Andrew's (drives by); the sweat's is Conor's
(tinkers).

## 1. The problem

Alex follows the Lions and is on no couch. He opens his team's page (or the league's) with one loose intent, "what's on with my team",
and the page hands him a refusal ("needs a couch"). What he'd do in his head (call Sunday's game, keep score of how often he's right,
say where the season ends up) has nowhere to land, so he reads the score and leaves. Nothing brings him back next week.

## 2. Layer by layer

**L0, cognitive load.** Constraint: 3 to 5 chunks at once, and noise is paid for unattended (Cowan 2010; Hassin et al. 2009). Violation
risk: the spec adds four parts (fan card, call row, season call row, More) to a page that already holds the head, the scorebug, the
season's bars and the schedule; drawn as panels each, the first view becomes six chunks with no lead. An empty fan card ("No calls yet")
is a chunk that says nothing.
**R1. The team page's first view holds three chunks: who (the head, with the calls record folded into it as one band once there is
one), the game (the scorebug), and its call. The season call, More and everything else start below the first view. Nothing is drawn
empty: no fan band before the first call.**
**Citations:** Cowan (2010) for the 3 to 5 chunk ceiling; Hassin et al. (2009) for unattended noise spending working memory.

**L1, first impression.** Constraint: the page is judged in about 50 ms, and the first fixation goes to the highest-contrast mark
(Lindgaard et al. 2006). Violation risk: three new buttons (call, season call, a draft) competing in yellow, or the season call shouting
on a week the game's call is due.
**R2. One yellow a view: the uncalled game's call (your team's button), and only while it's yours to make. A made call turns to the ink
fill with its check, so a page with nothing due has no yellow at all. The season call and More are never yellow on a page.**
**Citations:** Lindgaard et al. (2006) for the 50 ms judgement; Leder et al. (2004) for perception before classification.

**L2, processing fluency.** Constraint: consistency reads as truth; a part that looks new must mean something new (Reber & Schwarz 1999;
Alter & Oppenheimer 2009). Violation risk: a solo call row or record drawn differently from C2's couch call, so the same act looks like two
features; a season record written "4 wins left" while every other record on the page reads "8–2–1".
**R3. The solo call row, record and ticks are C2's parts with the couch's words removed (same team-mark buttons, same "Your call", same
ticks, same record type). Every season figure is a record in the table's form ("12–4–1"), never a count of wins left except as the
stepper's working.**
**Citations:** Reber & Schwarz (1999) for fluency read as truth; Alter & Oppenheimer (2009) for fluency's reach into trust and liking.

**L3, perception bias.** Constraint: people act on prediction and notice violations (Clark 2013); what they say they want (a "game") isn't
what they do (a call). Violation: today's "Your call, above" with nothing above is a prediction broken on the first screen; a call that
says "Start a game" asks a solo fan to think about setup he never wanted.
**R4. A call never says "game", "start" or "Pick'em": it's a call, and making it is the whole act. The standing game's name ("Your Lions
calls") shows only where games are listed (Games, Your moves). No line points at something that isn't drawn ("above" only when it is).**
**Citations:** Clark (2013) for prediction errors drawing attention; Nisbett & Wilson (1977) for stated vs. enacted behaviour.

**L4, decision architecture.** Constraint: make the right choice the easy one, and demonstrate a commitment's result before it's made
(Hertwig & Erev 2009); match words to commitment distance (Trope & Liberman 2010). Violation risk: the season call is a once-a-season
commitment; a bare number input asks the fan to do the record arithmetic and hides that it can't be changed.
**R5. The casual path is one tap where he already is (the call on the team page and on This week, the row's own buttons). The season
call shows its result as he sets it (the record it makes, big, changing with the stepper, starting from the record's pace) and says it's
one call a season, pinned to today, before its one button. The draft row names who he plays ("you and computer players") before he taps.
On Games the couch line is last and quiet: solo play is the page, not a consolation.**
**Citations:** Hertwig & Erev (2009) for demonstrated over described outcomes; Trope & Liberman (2010) for near actions in concrete words.

## 3. R1 to R5

R1 three chunks, nothing empty · R2 one yellow, only while due · R3 C2's parts, records in one form · R4 a call, not a game; no broken
pointers · R5 one tap where he is, the season call's result shown before commit, opponents named.

## 4. The first views

**The team's page, solo (first view top to bottom):** the head (name, league, record and place) · the fan band once there's a call ("Your
team since Sep · calls 6–2" and the ticks, one band, ≤ 64 px) · the scorebug · Your call (two team buttons, yours first, the yellow), its
first-time line under. **Below:** the season call row · More on the Lions (A draft of Lions players · you and computer players; Every Lions
game) · "Playing with friends? Start a couch · Join one" (quiet) · the season's bars and schedule as today.
Called: "You called Lions" with Change, no yellow anywhere.

**The season call sheet:** the team and record now ("Lions 8–2–1 · 6 left") · the stepper and the record it makes, big ("12–4–1"), the
number type · one line: "One call a season, pinned to today's record" · Call it (the sheet's yellow).

**This week, solo:** the bar · Your calls (a row a game of your teams' this week, uncalled first, the first uncalled one's button the
yellow) · Your teams (the table: "Your call, above" now true; once called, "You called Lions") · the rest of the week.

**Games, solo:** Your games here (your calls, season calls and drafts; due first) · Your team ("Every Lions game", into the wizard where
computer players are offered) · the couch line last, small.

**The five-second test:** the team page answers "who do I think wins Sunday?" with a tap; This week answers "anything to do?" with the
same tap; the season sheet answers "where do we end up?" by showing it.

## 5. The spec, tested

- R1: the spec's empty fan card ("No calls yet. Call their next game below.") fails: drop it; the call row's first-time line carries that
  job. The fan card as its own panel fails the three-chunk budget: fold it into the head as one band.
- R2: passes (the spec makes the call the page's yellow and the season call outlined).
- R3: passes (C2's row and card reused).
- R4: the spec's More rows say "Every Lions game" (a game listing, fine below the fold); the call row says no game words: passes.
- R5: the season call's "needs 4 of 6 · has 1" is the sweat's line; keep it under the called record, smaller, below the first view: passes.

## 6. The gap

Joanna's return. Nothing on the page brings her back next Sunday; only the standing game's move does (Your moves, the strip). **Its move
words must read as the call** ("Call Lions vs Bears"), not the engine's generic pick line, or the one prompt she gets says nothing about
her team. To check in the build; if the move text is the engine's, it's a finding for the check.

*Initial findings. Ralph Loop a requirement, cite further, switch to analyze / evaluate, or ask any follow-up to dig deeper.*
