Method: dual-agent (A: design review · B: detector)

# One episode at a time: Impeccable critique of the built looks

Target: Tonight's progress control while behind, looks A, B and C (`?step=`, src/new/show/step-through.tsx, progress.tsx), on the
real renders at 390 (`.ui-atlas/stories/step-through/frames/`). Run once, beside [the PFD evaluation](step-through-pfd-eval.md).

## Design health (Nielsen, 0 to 4)

| # | Heuristic | A | B | C | Key issue |
| --- | --- | --- | --- | --- | --- |
| 1 | Status | 3 | 3 | 3 | the out run reads at 11 episodes, merges with the ticks at 30; the out ticks carry no numbers |
| 2 | Real world | 4 | 2 | 3 | "Seen Ep 9?" is the streaming habit; B's tiles use four grammars, "All 8" says 8 of what |
| 3 | Control | 3 | 2 | 2 | B's guard for 10 has no "just 9" way out; Undo shows over the recap for 5 s |
| 4 | Consistency | 2 | 2 | 2 | after Not yet the control grows a row under the ruler (breaks R3); two toasts word the mark two ways |
| 5 | Error prevention | 4 | 2 | 2 | A's autopilot Yes claims one; B and C put the over-claim one adjacent tap away |
| 6 | Recognition | 3 | 3 | 3 | A's long line truncates ("Ep 14 to 20 …") |
| 7 | Efficiency | 3 | 2 | 3 | B's "…" isn't a door: 16 to 19 can't be reached from the row |
| 8 | Minimalism | 3 | 2 | 2 | B adds a row; C's leaders cross a label on a long season |
| 9 | Recovery | 2 | 2 | 2 | a wrong mark is fixed only through Where you are |
| 10 | Help | 3 | 3 | 2 | the guard's feed-forward is good; C leans on a hint line |
| | **Total** | **30/40** | **23/40** | **24/40** | |

## Specificity

Authored, mostly: the question in broadcast caps, the couch standing on the season's ruler with the unseen run dashed, the recap's
plate. Generic: the guard (a stock action sheet), B's tiles (a plan picker), C's leader lines on a long season (a chart annotation
laid over the art). Detector: 12 advisory findings, all `design-system-font-size`; one real (a 30 px numeral between the ramp's 26
and 44), eleven are working sizes the app uses hundreds of times that DESIGN.md's ramp doesn't list (a DESIGN.md question, not
this round's). Nothing on colour, radius, blur or layout. Browser overlay skipped: an auth-gated local route, frames captured.

## What's working

- A's line: one proposition, the episode the biggest type in the control, the habitual tap the safe one.
- The guard's range on its own row, worded apart ("I've seen Ep 10 too", "I've seen all 8, up to Ep 20").
- The recap's end offering the next: catching up gets a streaming rhythm; after Not yet the one-step action is back.

## Priority issues, and the fix each got

- **[P1] The question is a hidden door.** Its words open Where you are with no sign: spec fault 1, now on the biggest type. Fix:
  the question is inert; "Through Ep 8 ›" under it is the door, with its chevron.
- **[P1] Back is asked again.** After Ep 9's recap Andrew taps Back (having passed on "I've seen Ep 10 too") and lands on "Seen Ep 10?"
  with Yes under the thumb: a nag that trains autopilot. Fix: Back from a recap whose next you didn't take is Not yet.
- **[P1] Not yet changes the control's form.** Fix: the answers keep the line: "Catching up · Through Ep 8 ›" with **Seen Ep 9**
  (or **Reveal Ep 9**) in Yes's place and **Watch along** in Not yet's, both opening the same guard as before.
- **[P1] The long line truncates.** Fix: "Through Ep 12 · 8 out" (the count B and C already use).
- **[P2] The recap's end puts its primary mid-stack.** Fix: the watcher's end reads like the player's: "I've seen Ep 10 too",
  then **Back** last, as its primary.
- **[P2] B and C's ranged guard has no way to say just the next one.** Fix: a "Just Ep 9" row.
- **[P2] B's gap isn't reachable.** Fix: "…" opens Where you are. B's tiles say "Through 14" and "All 8 out".
- **[P3] On a long season another face covers yours.** Fix: your stack stands in front; the first out tick carries its number.

## Persona red flags

- **Joanna:** A hides the range until the guard (one tap in, by design). The truncated long line hid how much was out (fixed).
- **Andrew:** the repeated Yes trained autopilot (fixed: Back is Not yet). In C, a tap on your own face opens Where
  everyone is.
- **Conor:** B couldn't reach 16 to 19 (fixed); the question's words opened the ledger by surprise (fixed).

## Minor, left open

- The dashed run's weight at 30 episodes (a bright band was suggested).
- Undo lives only in the toast over the recap's first beat.
- The watcher's recap end doesn't say which episode it was.
- The Tonight tab's red count on a played show (outside this round: the tab bar's badge).
- The WatchedSheet's toast says "You're up to Episode 9"; the guard's says "You're through Episode 9".

## Recommendation

A (both assessments): the only look where the autopilot tap is safe and the first view adds no row; the range is one deliberate
tap in, and the recap's next carries a binge. Worth taking from the others: B's "8 out" count for the long line, C's numbered out
run as information on the ruler, not as targets.

Questions skipped: the round pauses at the screenshot story, where the user picks the look.
