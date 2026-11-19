# Start a game: four directions (the redo's Round 1, low-fi)

Frames: `.ui-atlas/stories/wizard-r1/directions/` (made by `.impeccable/mocks/wizard-r1/make-frames.js`; the before by
`scripts/dev-test/story-start-wizard.js`). Every game and line in them is the engine's, on the real pages (Survivor 51, Below Deck 13,
The Challenge 42) and ESPN's 76ers schedule. The structure is `wizard-r1-spec.md`'s, the first views `wizard-r1-first-view.md`'s.

## The four

- **A · The menu.** Length as headed tabs with counts (Tonight 12 · To the merge 17 · The season 20), a list whose rows are the
  game's plate collapsed, the recommended one open with its first week. Change it opens the parts; Add to it holds the rest.
- **B · The sentence.** The game is one sentence; each underlined clause is its own control. A clause that no longer fits is marked
  where it is and Start waits; nothing moves by itself. "+ Add a rule" ends the sentence.
- **C · The interview.** Tonight's game first (one tap), then the couch's questions, each answered as games: who's playing, what
  everyone does each episode, how long. "Here's your game", then "Anything else?" with the twists most asked for it.
- **D · The slip.** Ready slips and "what does everyone do?" up top, the slip docked at the foot holding the game; each choice adds
  a leg, "More legs" holds the rest. The busiest first view, the fewest taps.

All four share the plate (one way of saying a game), the catalog (grouped as the spec's taxonomy, offering only what fits), Who's
playing (the couch, just me, me and the bot), "coming" for live calls, 2-on-1 and a pair as an answer, and task 10's frame.

## The game library, in each

Ready games come from one library (the user's addition, 2026-11-17; BACKLOG 93 for its public part): the common built-in games, two
of them leaving the moment open for you (Who does it most?, the one-moment draft), the season's made-for games, and other couches'
published games, shown as coming [l-library]. A's list is the library, grouped by length; B opens it from Another game, C from "I
know the game", D from "Every ready game". The moment picker [m-moment] is one control in all four: the season's suggested moments
(rated when the season is set up, so one tap adds one), the show's own, or something typed for our AI to check [m-check].

## The eleven tasks

Taps from the way in (the show's Games tab, a team's sheet, a finished game) to Start, Start counted. Typing and the AI's wait are
said apart. Today's counts are on the built wizard (`wizard-r1-prep.md` §2).

| # | Task | Today | A | B | C | D |
|---|---|---|---|---|---|---|
| 1 | Quick, tonight | 2 | 2 | 2 | 2 | 2 |
| 2 | Outlast, the rest of the season | 5, shared only; not offered on the real Survivor 51 | 4 | 6 | 5 | 5 |
| 3 | Easy for Joanna | 4 (the pool, "least effort") | 7 | 8 | 5 | 6 |
| 4 | Lineup + captain + redraft at the merge + side bets | can't (no stages) | 8 | 10 | 7 | 7 |
| 5 | Just me, against the bot | can't (no bot for questions) | 5 | 4 | 5 | 4 |
| 6 | 76ers' next home game: winner, top scorer, total | can't (no added questions) | 9 | 8 | 7 | 5 |
| 7 | Nine "who does it" lines, a bank of 200, a stake on each | Describe only | 12 | 10 | 11 | 7 |
| 8 | Below Deck: who gets fired, who hooks up | Describe only | 8 + typing, ~40 s | 7 + typing, ~40 s | 8 + typing, ~40 s | 6 + typing, ~40 s |
| 9 | Call who goes home at minute 30 (its place) | no place | 3 | 2 | 2 | 3 |
| 10 | The same game next episode | 2 (the older list) | 2 | 2 | 2 | 2 |
| 11a | Who cries the most this season (guess it) | Describe only | 6 | 6 | 6 | 6 |
| 11b | The Cry Draft (only crying scores) | Describe only | 6 | 6 | 7 | 6 |
| | **All eleven (12 rows)** | 3 of 11 by taps | **72** | **71** | **67** | **59** |
| | The casual five (1, 2, 3, 5, 10) | | 20 | 22 | 19 | 19 |
| | The builds (4, 6, 7, 8) | | 37 | 35 | 33 | 25 |
| | The silly-moment pair (11a, 11b) | | 12 | 12 | 13 | 12 |
| | Targets in the first view (today 18) | | 8 | 11 | 8 | 11 |

Side bets are on in every lineup (the preset's), so no direction spends a tap on them in task 4; the plate shows them as on. Task
11 picks crying from the season's suggested moments (one tap); typing a moment the suggestions don't have adds one tap (Add, once
it's checked), the typing and our AI's wait of about 40 seconds. Crying counts from Episode 9: research asks a new moment from the
next episode on.

**The paths** (frame ids in brackets):

- **A.** 1: Start [a1]. 2: The season, Outlast, Start [a3]. 3: The season, Outlast, Change it, Your team, Yes, Start [a4, a5]. 4: The
  season (the classic lineup opens), Change it, Add to it, Captain, New draft at the merge, Done, Start [a6]. 5: Change it, Who's
  playing, Me and the bot, Start. 6: Pick…, Sat vs Bucks, Change it, The questions, Top scorer, The total, Done, Start [a7]. 7:
  Prediction Sheet, Change it, The questions, A new card, 9, Done, Add to it, A bank, 200, Done, Start. 8: Change it, The questions,
  Who gets fired, the field (typed), Add, Done, Start [a8]. 9: Change it, Add to it: "Live calls · coming" [a6]. 10: Again, Start [x].
- **B.** 1: Start [b1]. 2: the "answers 3 questions" clause, Outlast; the length clause is marked [b3]; tap it, the rest of the season,
  Start. 3: as 2, then the team clause, Yes, Start. 4: the clause, Set a lineup, the length clause, the season, + Add a rule, Captain,
  New draft at the merge, Done, Start [b4, b5]. 5: "the couch", Me and the bot, Start. 6: "the next game", Sat vs Bucks, "who wins",
  Top scorer, The total, Done, Start [b7]. 7: the questions clause, A new card, 9, Done, + Add a rule, A bank, 200, Done, Start [b6]. 8:
  the questions clause, Who gets fired, the field (typed), Add, Done, Start. 9: + Add a rule: live calls coming [b4]. 10: as all.
- **C.** 1: Start [c1]. 2: I know the game, Outlast, The rest of the season, Start [c3]. 3: The couch, Nothing: draft once, The rest of
  the season, Start (the interview makes it a draft in private: nobody waits on turns) [c2, c3, c4]. 4: The couch, Set a lineup, The
  season, Captain, New draft at the merge (both "Anything else?" replies), Start. 5: Me and the bot, A few calls, Tonight, Start [c1].
  6: The couch, Call a few things about a game, Sat vs Bucks, Top scorer, The total, Start [c7]. 7: The couch, A few calls, From the
  top, More…, A new card, 9, A bank, 200, Done, Start [c5]. 8: The couch, A few calls, Tonight, Who gets fired, the field (typed), Add,
  Start [c6]. 9: The couch: "Call it live · coming" [c2]. 10: as all.
- **D.** 1: Start [d1]. 2: Draft a team, Just watch, The season, Start [d2]. 3: as 2 with "Same castaway on two teams? Yes" [d2]. 4:
  Draft a team, Set a lineup, The season, + Captain, + New draft at the merge, Start [d3, d4]. 5: the slip's "the couch", Me and the
  bot, Start. 6: Sat vs Bucks, Top scorer, The total, Start (the team's slip arrives as Pick'em) [d7]. 7: Answer questions, A new card,
  9, A bank, 200, Start [d5]. 8: Answer questions, Who gets fired, the field (typed), Add, Start [d6]. 9: Answer questions, More legs:
  live calls coming [d3]. 10: as all.
- **Task 11, each.** A: The season, Who does it most? in the Built in group, its open part, Cries, Start [a9, m-moment, t11a]; the
  one-moment draft the same. B: Another game, Who does it most? [l-library], its open clause, Cries, Start [b8, t11a]; the draft the
  same. C: The couch, One call for the season, Who does something the most, Cries, Start [c8, t11a]; the draft: The couch, Nothing:
  draft once, The season, "Only one thing counts", Cries, Start. D: Answer questions, + Who does something the most, Cries, The
  season, Start [d8, t11a]; the draft: Draft a team, scored by one thing only, Cries, The season, Start [t11b].

**Likely wrong turns** (the counts assume a person who goes the shortest way; these are where they won't):

- **A.** Task 2 looks under Tonight first (the default tab); the dashed foot row sends them to The season. Task 6 starts on "Next
  game" (the away game at Orlando) unless the date is read. Tasks 7 and 8 split one idea across two places (Change it › The
  questions, then Add to it › Bets).
- **B.** A first-timer may not read underlined words as buttons; the marked clause (task 2) can read as an error. Long sentences
  for twisty games (tasks 4 and 7) fail a five-second look.
- **C.** Task 2 needs "I know the game" seen (a small link under the interview); otherwise the interview's three answers reach Outlast
  one tap later. Changing an early answer asks the later ones again (picks flow down), so Conor will feel the steps.
- **Task 11, all four.** Someone who doesn't know "moment" means a thing that happens on the show looks for "crying" by name: the
  library's search ("cries") and the picker's suggestions carry it, and a game that names a moment the show doesn't track says so in
  plain words before it's added.
- **D.** Task 3's starter must turn "easy for Joanna" into mechanics ("Draft a team, just watch, in private"); nothing asks it as
  effort. Three zones in the first view; the docked slip covers the list. A slip's look must not bring a sportsbook's pressure.

## Coverage: every group by taps, in each

Every group of the spec's taxonomy is reachable by taps in all four, since they share the catalog and the parts; what differs is
how deep each sits. Taps from the first view to the group's choices:

| Group | A · menu | B · sentence | C · interview | D · slip |
|---|---|---|---|---|
| What you do | another row (1), or Change it (2) | its clause (1) | I know the game (1), or the 2nd question (2) | the first chips (1) |
| How long | the tabs (1) | its clause (1) | the 3rd question (3) | a leg (2) |
| How you win | Change it (2) | its clause (1) | Change any part (~4) | a leg (2) |
| Your team | Change it (2) | its clause (1) | Change any part (~4) | legs (2) |
| The questions | Change it (2) | its clause (1) | which calls (3), More… (~5) | legs (2) |
| What scores | Add to it (3) | + Add a rule (2) | More… (~5) | More legs (3) |
| Bets | Add to it (3) | + Add a rule (2) | More… (~5) | legs (2) |
| Twists | Add to it (3) | + Add a rule (2) | Anything else (~4) | a leg (2) |
| Over the season | Add to it (3) | + Add a rule (2) | Anything else (~4) | More legs (3) |
| Who's playing | Change it (2) | its clause (1) | the first question (1) | the slip (1) |
| When moves lock | Change it (2) | its clause (1) | Change any part (~4) | the slip (1) |
| The details | Change it (2) | + Add a rule (2) | Change any part (~5) | the slip (2) |

**Six hard requests from the tracker**, taps from the first view to Start (approximate: the screens drawn plus the parts they share):

| Request | A | B | C | D |
|---|---|---|---|---|
| p11 · all-yours Outlast, replacements from anyone at half then a quarter | 9 | 9 | 8 | 7 |
| p10 · a bank of 500, the AI's card of four, who goes home, a ticket from them | 13 | 11 | 12 | 9 |
| s39 · pre- and post-merge Outlasts, most stages won | 8 | 9 | 7 | 6 |
| s24 · two secret Traitors among you (The Traitors 5) | 8 | 9 | 6 | 6 |
| s62 · an NFL season league, head to head, a lineup locked at each game | 3 | 5 | 4 | 3 |
| p29 · 2-on-1 for a couch of three | coming, in How you win | coming | coming | coming |

## Against the first-view requirements (as drawn)

| | R1 one decision, few targets | R2 reads as a game | R3 one way of saying it | R4 right default, nothing moved or missing | R5 first week, one Start, the palette in one place |
|---|---|---|---|---|---|
| A | holds (8) | holds | holds: rows are the plate collapsed | holds: the dashed foot row | holds |
| B | 11 targets (the clauses) | holds: the name over the sentence | strongest | strongest: the marked clause | holds |
| C | holds (8) | holds: answers are games | holds | holds: tonight's game on top | holds; the palette is More… at the end of the interview |
| D | 11 to 18 targets | holds | holds: the slip is the game | holds | holds |

## A recommendation

**C's front with D's slip as its game screen.** C keeps the first view calm and asks the couch's questions in the couch's words
(who's playing, what everyone does, how long), which is where Joanna's starter, Andrew and task 5 win; D wins every build (tasks 4,
6, 7, 8 and the hard requests) because a slip shows the whole game while legs are added. Joined, "Here's your game" becomes a slip:
the interview's answers are its first legs, and "Anything else?" is "Add a leg". Projected, the casual five stay at C's 19 and the
builds come near D's 25 (task 7: about 9).

The other honest picks: **A** if the made-for library should lead (U0's D, which the user liked, with nothing hidden); **B** if one
rendering matters most and discoverability can be taught once.

## Open questions

- Which order: how long first (A), all at once (B), who and effort first (C), what first (D)?
- One door or two: tonight's game above everything (A, C, D), or the game itself as the only thing (B)?
- Is a one-episode game played every night one game or a new one each time (Round 3)? Task 10 is drawn as a new game.
