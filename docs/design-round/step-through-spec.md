# One episode at a time: page spec (Tonight's progress control, behind)

The user, 2026-11-17, from the real app on Traitors 5 (through Ep 8, Ep 9 and 10 out): "a bit of a UI trap, I can view just
episode 9, the UI forces you to jump to the latest. We definitely need a natural and intuitive way to progress one by one."

## What's wrong today

Behind on an airing show, Tonight's tall progress control asks **"Seen Ep 9 and 10?"** with **Yes** and **Not yet**
(behind-ask.tsx, the user's pick B of 2026-11-15, made for Joanna, who watches live and never tells the app).

| Who | What they've seen | What the control lets them say |
| --- | --- | --- |
| Joanna (forgets) | 9 and 10, live with the couch | Yes: right |
| Andrew (drives by) / the user tonight | 9 only | Yes is a lie (spoils 10); Not yet is a lie (hides 9). **Trapped** |
| Conor (tinkers), catching up | 9 tonight, 10 tomorrow | the same trap, every night of a binge |

Four faults, in order of harm:
1. **The question is a range.** There's no answer for "just 9". The only way is to tap the question's own words (no chevron, no
   look of a button) to open Where you are, find row 9 in the ledger and Save.
2. **Yes skips Ep 9's recap.** On a show you watch, Yes writes `seenThrough: 10` and plays Ep 10's recap only (useSeen's
   `onReveal(to)`); the watcher's reveal answers `next: null`, so Ep 9's who-went-home and the couch's GIFs for it never play.
   (On a show you play the reveal starts at 9 and its end offers Reveal Episode 10, but the words promise "Ep 9 and 10's results
   play next, every game at once".)
3. **Not yet strands you.** After it, the control says "Catching up · through Ep 8 · Ep 9 next · 1 more out" with one button,
   **Watch Ep 9 along**: there's no "I watched Ep 9", so you're back to the hidden door.
4. **Two answers to one question.** Every other tab's compact line already steps one at a time ("Through Ep 8 · 2 behind ·
   **I watched Ep 9**"); only Tonight asks the range.

## The job

When you're behind, **say what you've seen, one episode at a time, and see that episode's recap before the next**, without ever
being shown something past where you are. The one who watched everything (Joanna) still says so in as few taps as today.

The unit is **the next episode**, because that's how people come to the app: they watch one, then open it. A range is the
exception, served by the same control, never forced.

## Situations

| Situation | Who | Today | Must handle |
| --- | --- | --- | --- |
| Watch only, 2 behind (the user's case) | Riley on ZT Traitors, through 1 of 3 | "Seen Ep 2 and 3?" | just 2; both; neither |
| Watch only, 1 behind | Riley, through 2 of 3 | "Seen Ep 3?" | unchanged in words: already one |
| Watch only, many behind (a 30-episode season) | a long season, 6+ out | "Seen Ep 9 to 14?" | the next one; how far; never a row of 15 things |
| Play, 2 behind, results in | Sam on ZT Survivor 51, through 3, results in for 4 and 5 | "Seen Ep 4 and 5?" (yellow: the pick waits on it) | the reveal one at a time, the due move still yellow |
| After Not yet | either | Watch Ep N along only | I watched / Reveal Ep N back as the action |
| Own pace | a game at your pace | the pace plate (no question) | **out**: behind is the point there |
| Live keep-up | a show set to Live | SeenItCard: "Episodes 3 and 4 have aired · Seen them" | **out of this round**: the winner ripples to it (below) |

## Content, in rank order, while behind

1. **The next episode by number, as the question**: "Seen Ep 9?". Numbers and air days only (public); never a title or who left.
2. **The answer for it, one tap**: Yes (or the episode itself, in the looks that make it the target), and Not yet.
3. **What else is out, as context, not a second question**: "Ep 10 is out too", or the out episodes drawn as stops.
4. **The way to say more than one** (Joanna): one tap from the first answer, never on the first view as a rival button to Yes.
5. **Where you are and the couch**: the ruler (your face on 8; theirs on theirs), as today.

## The flow (every look)

1. Behind: the control asks about the **next** episode (or offers the out ones to pick from, look B/C).
2. An answer opens the **spoiler guard** (the 2026-11-15 decision, kept): "Seen Ep 9?", what it opens, any move it closes; its
   one primary is **Yes, Ep 9**; a quiet **I've seen Ep 10 too** (through 10, "all N" when more) is the range; Not yet closes it.
3. **Yes plays Ep 9's recap** (a show you watch: the watcher's beats; a show you play: Ep 9's results, every game). Its mark moves
   to 9, with Undo on a show you watch.
4. **The recap's end offers the next**: "Seen Ep 10 too?" as a quiet button, with **Back to Traitors** as the primary when you
   said just 9; when you said through 10, its next is "Ep 10's recap" with nothing to confirm (it's yours already).
5. **Back on Tonight**: Last time is Ep 9; the control asks "Seen Ep 10?". Caught up: the normal line ("Through Ep 10").
6. **Not yet**: the control stops asking until a newer episode airs (kept on the server, as now), and its action is the one-step
   one: **I watched Ep 9** (or **Reveal Ep 9**) beside **Watch along**, the line "Catching up · through Ep 8 · Ep 9 next".

Taps: just 9 = 2 (answer, Yes) then the recap; both = 2 (answer, I've seen Ep 10 too) then two recaps back to back.
Today: both = 2 and one recap; just 9 = 4 through a door that doesn't look like one.

## The three looks to mock (one structure, three forms of the answer)

| Look | The answer's form | First view | Joanna's "both" | Long season (6+ out) |
| --- | --- | --- | --- | --- |
| **A · The next one** | the line asks "Seen Ep 9?" · "Ep 10 is out too", Yes / Not yet beside it | B's line, one episode named | the guard's I've seen Ep 10 too | unchanged: "Ep 10 to 14 are out too" |
| **B · Pick how far** | the line "Where are you up to?"; under it a row of the out episodes as stops (8 is you, then 9, 10), each "through here" | one stop per episode out, up to 4; then the next 3, "…", the latest | tap 10 | the next three, a gap, the latest |
| **C · Move your face** | the ruler is the answer: the out ticks become stops beside your face; "Tap where you're up to" | the ruler as built, its out run lit | tap 10 | the ruler's zoomed run from your mark to the latest |

All three share steps 2 to 6, so the user picks the form, not the flow.

## Return paths

- The guard's Not yet or a swipe down: nothing moved, back to the same question.
- The recap's close (X, Back, the system back): its episode stays seen (a show you watch: Undo in the toast while it shows).
- Wrong episode said (a show you watch): Where you are (the mark's door) moves it back; Undo straight after.
- A show you play: forward only (as today: a reveal can't be unrevealed).

## Left out, and why

- **Inferring what you've seen** (from when you opened the app, or the couch): a wrong guess spoils or scolds (2026-11-15).
- **A swipe to mark** (as on a to-do list): hidden, and a mis-swipe here spoils.
- **Dropping the guard for a one-step Yes**: the guard is the settled spoiler rule; each look keeps exactly one.
- **The ledger in place of the question**: it stays the full editor (Where you are); the question is the one-tap path.

## Ripple (after the user picks)

- Live keep-up's SeenItCard asks the same range ("Seen them"): it takes the winning form.
- The compact line (other tabs) already steps one at a time: kept, and the guard's I've seen Ep 10 too reaches it too.
- The watcher's recap gains a next (client-side: the next out episode, asked; or the next seen one, played).

## Open questions (for the flow, answered by the mocks)

- Does the range belong on the first view (B, C) or one tap in (A)? A keeps the line Joanna already knows; B and C show the shape.
