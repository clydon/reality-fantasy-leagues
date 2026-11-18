# One episode at a time: PFD evaluation of the built looks

Mode 1 on the real renders at 390 (`.ui-atlas/stories/step-through/frames/`: four situations × before, A, B, C, and the flows),
scored against [the first-view requirements](step-through-first-view.md). One control in its page, not a landing page: L1 reads
"hero and CTA" as the control's line and its answer, L3's social proof as the couch's faces on the ruler.

**Context.** Audience: someone behind on an airing show (watching only, or playing). Intent: say how far you've watched, exactly,
and see that episode next; nothing past your mark. What's already working: the show's art, the Lower Third type, the ruler with
the couch on it. Design system: the app's own (DESIGN.md, Lower Third / Night), Tailwind v4 utilities; confidence 95.

## Scores

| | L0 load | L1 first view | L2 fluency | L3 bias | L4 decision | Overall |
| --- | --- | --- | --- | --- | --- | --- |
| **Before** (as built) | 45 | 70 | 55 | 35 | 25 (critical) | **46** |
| **A · The next one** | 82 | 74 | 80 | 84 | 82 | **81** |
| **B · Pick how far** | 66 | 72 | 74 | 68 | 80 | **72** |
| **C · Move your face** | 70 | 76 | 62 | 66 | 72 | **70** |

Overall = (L0 × 1.5 + L1 + L2 + L3 + L4) / 5.5.

### Before
- **L4 critical:** for Andrew (saw only 9) no visible next step exists; "just 9" is four taps through an unmarked door, "both" is
  two: an asymmetry that favours the spoiling answer (Thaler & Sunstein 2008). Not yet ends with Watch Ep 9 along alone.
- **L3 major:** autopilot's Yes claims two episodes; the confirm ("Seen up to Ep 10?") is confirmed on the same autopilot, and
  the recap then plays Ep 10, not 9 (watch-2-before.yes-play-reveal) (Kahneman 2011).
- **L2 major:** three wordings for one act (this line, the compact line's "I watched Ep 9", the guard's "Seen up to") (Reber &
  Schwarz 1999).

### A · The next one
- Strengths: one proposition ("SEEN EP 9?"), the episode in the world's caption caps; Yes claims one; the guard holds the range
  on its own row ("I've seen Ep 10 too"); the recap is Ep 9's and its end offers Ep 10; after it Tonight asks "Seen Ep 10?";
  after Not yet, I watched Ep 9 is back. Every truth is 2 taps.
- **Minor (L0, L2):** on a long season the line truncates: "Through Ep 12 · Ep 14 to 20 …" (watch-long-a).
- **Minor (L1):** the dashed out run sits under the faces and reads only on a second look; the question carries "how many" alone.
- **Minor (L0):** the watcher's recap end stacks three full buttons (Add your GIF, Back, I've seen Ep 10 too).

### B · Pick how far
- Strengths: the out run *is* the answer, labelled with what a tap means ("Seen it", "Seen both", "All 8"); the guard names the
  range plainly ("Seen Ep 9 and 10?", "Yes, through Ep 10").
- **Major (L0):** a new row of 2 to 5 tiles under the line (+56 px; Last time moves down the same), up to six targets in the
  long case (Cowan 2010).
- **Major (L3):** "Seen both" sits one tap from the first view at near-equal weight; the plate/outline difference helps but a
  thumb on autopilot can land on it. The guard is the only catch.
- **Minor (L2):** tiles say "Up to 14" where the guard and the mark say "through".

### C · Move your face
- Strengths: no words to parse; the ruler becomes the answer; stops fan out with leader lines on a 30-episode season and stay
  thumb-sized (watch-long-c).
- **Major (L2):** the act is never named before the guard: the line is an instruction ("Tap where you're up to") and the stops
  are bare numbers.
- **Major (L1):** the authored moment (your face walking to the stop) doesn't read: the face re-mounts at a friend's mark instead
  of walking, and the frame was shot after the guard opened (watch-2-c.first-walk).
- **Minor (L4):** the ruler's tap no longer opens Where everyone is from the track; only its own line does.

## One batch of fixes (applied before the story)

1. A: the line's long-season copy: "Through Ep 12 · 7 more out" (fits; L0, L2).
2. C: your face is its own element on the ruler, so it walks to the stop; friends at that mark lift one face; the walk is shot
   mid-way (L1).
3. C: the line names the act: "Tap the last one you've seen" (L2).
4. B: tiles say "Through 14" (the mark's and the guard's word) (L2).

Left open, listed in the story: the dashed run's weight (A's L1 minor); the recap end's three buttons (A's L0 minor); B's extra row
and C's changed ruler door (each look's cost, for the user to weigh).

## Top 3 by impact

1. A as the structure (all of R1 to R5 at once); +35 overall over today.
2. The shared flow's recap of the episode you said (not the latest) and the recap's next: fixes Before's L3 and L4 in every look.
3. After Not yet, the one-step action back: removes Before's L4 dead end.

> *Initial findings. Ralph Loop a layer score, cite further, switch to solve / analyze, or ask any follow-up to dig deeper.*
