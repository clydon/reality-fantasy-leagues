# Last time's write-up: the check (PFD evaluate, Impeccable critique)

On the built page: real renders at 390×844 from `scripts/dev-test/story-writeup.js` (`.ui-atlas/stories/tonight-writeup/before`
and `/after`, 2026-11-23). Each skill ran once. The fixes went in as one batch, at the end of this page.

## PFD evaluate (Mode 1)

**Context.** *Audience:* a couch member on a phone, opening Tonight hours or days after an episode, either only watching (Casey) or
playing (Andrew, Joanna, Conor). *Intent:* remember the episode, then react, talk, or check their games. It's an impression and
recall surface, not a conversion page. *Positioning:* free, social, mass market. *What's already working:* the Out plates and
the stat plate are broadcast graphics with strong faces. Last time already had the outcome and the reactions, but not the story.
*Meta-level:* n/a.

**Design system.** Tailwind v4 utilities on the app's own tokens (DESIGN.md, Lower Third: `foreground`, `background`, Archivo),
confidence 95. No PFD framework profile matched beyond Tailwind's utility conventions, so it's judged on general principles.

**Heuristic rules.** F-CL-004 (above-fold density): pass for the watcher and the story show (heading, plates or text, the GIF
tile, two doors). At the ceiling for the player (strip, Fill it in, heading, plate, write-up: five blocks). F-PD-001 (progressive
disclosure): pass (three lines, the rest in place). L1-FI-003 (hierarchy): pass. L2-TY-001, L2-TC-001, L2-SP-001: pass (one
family, existing tokens, the block's 12 px rhythm). L4-CT-002 (label specificity): "more" is generic, but it's the platform
convention, and its accessible name is "more of what happened in Ep 2". Pass, with a note.

| Layer | Score | Reasoning | Violations |
| --- | --- | --- | --- |
| Foundation | 82 | 73 px collapsed and 3 lines in every frame (`index.json`), one new control, no new box. The player's first view holds five content blocks, at Cowan's ceiling, but the write-up is the fifth and the lowest-salience. | Minor: the player's first view sits at the 4-5-block ceiling (Cowan 2010). The existing strip and Fill it in plates drive it, not this change. |
| L1 First impression | 84 | The Out plate (white, face, red tag) still takes the first glance in both Survivor frames. The write-up reads second, as body text. With nobody out (the yacht), the write-up leads under the heading without competing with the white "Make it a game" plate below. | None. |
| L2 Fluency | 86 | The same setting as Episodes' "What happened" (15 px, 1.6 leading, foreground at 90%), confirmed side by side in `survivor-watcher.episodes.jpg`. The cut ends on a whole word. "more" and "less" use the app's underlined-link convention ("Fix who went home"). The source markup is gone from every surface (Reber & Schwarz 1999: easy-to-process text is judged truer). | Minor: the underline (`decoration-border`) is faint on Night. The semi-bold, bright weight carries the affordance, so it stays, consistent with the app's other links. |
| L3 Bias | 74 | It matches the social-caption "… more" prediction (Clark 2013), and the plate and the text agree in every frame ("voted out 6–5" under Patt's plate). But nothing guarantees they agree. The write-up is the AI search's and isn't reviewed, while the plates are accepted results. A disagreement would now sit on Tonight for days, not only in the reveal. | Major risk (not observed in the frames): plate and write-up can contradict, and System 1 reads conflict as distrust (Kahneman 2011, via the rubric). |
| L4 Decision | 80 | The block's next moves (GIF, Discuss, Recap) stay below the story that primes them. "more" opens in place and does what it promises (Sincerity passes). There's no second door to Episodes. The player's Your night moves down by exactly the write-up's height (977 → 1062 px). It was already under the fold, and the strip at the top carries what's due. | Minor: a player's results are one more scroll away. |

**Overall:** (82×1.5 + 84 + 86 + 74 + 80) / 5.5 = **81**. No caps apply. The scores sit within 15 points because the component is
small and was derived from these same five requirements. The spread that's left is L3's trust risk, which is the real one.

**Top fixes.** (1) L3: when the write-up and the accepted results disagree, the results must win on screen. Nothing in the UI can
check that cheaply today, so it's listed as open (the recap search could be asked to name who left, and a mismatch held back).
(2) L0/L4: the player's first view is crowded by plates above Last time. That's outside this round, and Tonight's own round
owns it. (3) L2: none needed.

The HTML rebuild of the fixes that PFD's template asks for was not made. This app's process puts fixes into the real component
and shows them in real renders (DESIGN-PROCESS.md), so the fix batch below is the rebuild.

## Impeccable critique

Method: two separate reviewers, a design review and the detector with browser evidence (Impeccable's dual-agent run).

**Detector.** Four advisory findings in `tonight.tsx` (`design-system-font-size`, lines 96, 97, 129 and 230), all in older code,
none in `LastTime` or `WriteUp`. The in-page overlay found nothing inside Last time. Its `bounce-easing` (older keyframes in
new.css) and `kicker-above-heading` (the "Not a game yet" card, the Lower Third's label style) are elsewhere on the page.
Measured: the paragraph at 13.4:1, "more" at 16.4:1, exactly three lines, nothing over its words. The underline was 1.3:1
(nearly invisible), and the buttons' tap areas were 36×24 and 28×24 px.

**Design review.** Nielsen 23/36 (nine scored; help n/a). Strengths: the order (plate, then how, then react) ranks each situation
itself, and the yacht show gains the most; the restraint (the plates still win the first look); the cut never looks broken.
Priority issues:
- **P1 The excerpt is the least useful part.** Write-ups run in story order, so three lines show the setup and the vote sits
  behind "more" (Patt's 6–5 in the real Ep 3). It cut inside names ("Bosun Fraser…").
- **P1 A wrong write-up can't be fixed,** and it now sits under an accepted Out plate. It's saved once and never re-asked or
  edited, and the source line was the only provenance.
- **P2 A 1000-character write-up was saved cut mid-word.**
- **P2 Opening and closing:** a screen reader heard only the cut text; "less" had no context; any tap on the open text closed it,
  and so did selecting a line to copy.
- **P3 "Ep N recap"** now opens with the same plates and paragraph.

## The fix batch (one)

- **The cut** ends on a sentence when one ends in the second half of what fits ("…adjusts to working together… more"), and never
  inside a run of capitalised words.
- **Opening and closing:** tapping the text opens it, and only "less" closes it. A tap that ends a selection does nothing. A
  screen reader hears the whole write-up either way. The buttons say "Show more/less of what happened in Ep N". "less" gets a
  44 px-tall tap area (an `::after` box, no layout change). The underline is the foreground at 35%.
- **A guard on Tonight:** the write-up shows under the Out plates only when it names someone who left (`namesAnyone`; first built as everyone, loosened
  in the bolder round when production's real results showed why: tonight-writeup-bolder.md). Another
  episode's write-up, or one with the wrong person, stays off Tonight (the `guard` frame). It still shows on Episodes and in the
  reveal.
- **The save:** an over-long write-up is kept by whole sentences, else whole words with "…" (`capRecap`). The search is asked
  for the past tense and for no links or sources.
- **Tried and taken back:** asking the search to put the headline first (who left and how). It fixes P1 for new write-ups, but
  the reveal plays "In this episode" before "who went home", so that slide would open by naming who left. It goes to the user as
  a choice, below.

## Open

- **Settled 2026-11-23: option 2** (the user, with the bolder round's pick B). A separate headline column (0456), written by the
  recap search from now on, and by one ask from the summaries for the 25 saved before it (scripts/headlines-once.js).
- *Was:* **For the user, a choice (Tonight against the reveal):** (1) keep story order: three lines of setup, the vote one tap away;
  (2) a separate headline line: the search also writes a one-line headline (a new column), Tonight shows it whole and "more"
  opens the story, and the reveal doesn't change; (3) headline first in the write-up itself: the cheapest, but the reveal's "In
  this episode" opens by naming who left. Recommended: (2).
- **No way to fix a wrong write-up:** no desk edit or clear, no re-ask when results go final, no "Something wrong?". The guard
  covers wrong names, not a wrong vote count.
- **Whether AI-written prose should say so,** now that it sits under accepted results. The product doesn't mark AI-settled
  results either.
- **"Ep N recap"'s label,** now that the recap page opens with the same paragraph (it adds the moments, the reactions and the
  replay).
- **Not rendered:** "Nobody left" under a write-up (ZT Yacht isn't set up enough to say it), Studio (light), 320 px, a sports
  game's recap.

## Noticed, not fixed

- **Episodes never showed a write-up on an episode with results** (every revealed Survivor episode). Only a show with no results
  got one, so a competition show's write-up was reveal-only. Fixed here (`season-episodes.ts`: seen rows carry it), which also
  adds the paragraph to Episodes' "What happened" for those episodes.
- **The reveal's "In this episode" comes before "who went home"** and, in story order, names who left in its last sentence, a
  beat before the Out cards. That's older than this round: the reveal's own order, for its owner.
- **"Nobody left in Ep N."** shows for any show that isn't a sport, a talk show included, where nobody ever leaves.
- **This folder's master is 34 commits behind origin.** None of them touch these files. Pull before committing.
