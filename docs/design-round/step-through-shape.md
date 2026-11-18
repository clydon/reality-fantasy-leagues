# One episode at a time: shape (Impeccable)

On [the spec](step-through-spec.md) and [the first-view requirements](step-through-first-view.md). Mode: **Operate** (a task on the
show's own page). Visual authority: the committed Lower Third world (DESIGN.md), Night over the show's art; nothing new invented.

- **Job and audience.** Someone opening Tonight behind on an airing show says how far they've watched, one episode at a time, and
  sees that episode's recap before the next. Joanna (saw all, forgot), Andrew (saw one), Conor (bingeing).
- **Outcome and proof.** One answer per true state, each ≤ 2 taps (R1, R5); autopilot's tap claims only the next episode (R4); the
  out run reads at a glance (R2). Proof on real renders: ZT Traitors on the show's own art, the couch's faces on the ruler.
- **Direction.** One structure, three forms of the answer, all inside the control's existing footprint (no new row taller than the
  line it replaces):
  - **A · The next one.** The line becomes the question about one episode: "Seen **Ep 9**?" with the number in the condensed caps
    the world uses for numbers, "Through Ep 8 · Ep 10 out too" under it, Yes and Not yet beside it. The ruler draws your seen
    run solid and the out run dashed bright, so "two out" is seen.
  - **B · Pick how far.** "Where are you up to?" with Not yet beside it; under it the out episodes as a run of caption-plate
    stops on the track from your mark: the next one a white plate ("Seen it"), the rest outlined ("…too"), each ≥ 52 px; more
    than four out: the next three, a gap, the latest. A stop means "through here".
  - **C · Move your face.** The ruler is the answer: "Tap where you're up to" as the line, the out ticks raised into numbered
    stops over the track beside your face (fanned out at your face, with leader lines to their ticks, when ticks sit closer
    than a thumb); the picked stop's face walks there (the round's one authored motion) before the guard.
- **Shared flow (all three).** The guard sheet names one episode ("Seen Ep 9?", primary **Yes, Ep 9**), the range as its quiet
  second row ("I've seen Ep 10 too" / "…up to Ep 14"), "Set where you are" when it's more than two; Yes on a show you watch moves
  the mark to that episode (Undo) and plays **that** episode's recap; the recap's end offers the next ("Seen Ep 10 too?" quiet,
  Back primary; "Ep 10's recap" primary when you've said it). After Not yet the control keeps its form with **I watched Ep 9** /
  **Reveal Ep 9** beside Watch along.
- **Yellow.** Unchanged rule: the answer is yellow only when the reveal holds the view's one yellow (a due move waits on it);
  the out run is white, never yellow (it would be a second yellow next to a yellow Yes).
- **States and ranges.** 1, 2 and 6+ out (a 30-episode season); a show you play (results in) and one you watch; after Not yet;
  the guard; the recap's end. Long names don't apply (numbers only, never titles past your mark).
- **Scope.** A TEMP-UI switch, `?step=a|b|c` (kept for the visit in sessionStorage); without it the app is as built. No server
  change. The compact line on other tabs is untouched (already one at a time).
