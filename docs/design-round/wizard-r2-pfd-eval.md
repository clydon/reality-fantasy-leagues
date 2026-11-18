# Start a game, the gallery as built: Perception-First Design evaluation (Round 2's check)

Real renders at 390 × 844 on the real Survivor 51 (Episode 8 aired, 9 tonight), `.ui-atlas/stories/wizard-r2/after/`: g1-first, b1-outlast
(and its whole sheet), c1-compete, d2-result; judged against [wizard-r2-first-view.md](wizard-r2-first-view.md) R1 to R5.

## Context

- **Audience:** whoever starts games for a couch, on a phone, often in passing (Andrew), choosing for people who aren't there
  (Joanna); a tinkerer who wants every piece (Conor). They know their show; most don't know game names beyond "fantasy league".
- **Intent:** find a game by what it is, see how it plays, start it without a costly surprise for anyone. Operate, not persuade.
- **Positioning:** free, mass-market, inside an app already in use; the decision is a commitment for a group, cheap in money,
  expensive in goodwill.
- **What's already working:** the game catalog checked by the engine on the season's real page (50 of 56 bases play; a draft fitted
  to the 10 still in); the one yellow kept for Start; Lower Third's plates, condensed caps and hairlines; the show's art behind the
  sheet; dashed choices that say why.

## Design system

Tailwind v4 utilities over the app's own Lower Third tokens (`bg-card`, `bg-secondary`, `type-caption`, `bg-chyron`, `border-edge`),
Base UI's dialog for the sheet. Confidence 95.

## Foundation (L0): 76/100 (pass)

- **Reasoning:** the gallery's first view holds four groups (the field, the ready block, the chips, the first shelf with four
  squares); a square carries an icon, a quiet length, a name and a line. The base's first view holds the sentence, what everyone
  does, the strip with its chips and the lock line, plus the fitted note when a draft was fitted: five chunks on Outlast.
- **Violations:** (minor) the fitted note is a fifth chunk on a fitted base's first view (R1), Cowan (2001); (minor) "More changes"
  wraps its own label onto two lines beside its list, a stutter in the row rhythm.
- **Strengths:** the community folded into one block with the ready game; length marks quiet unless they differ; the base's rows
  below the fold (the expert workspace), its first view sparse.
- **Fixes:** fold the fitted note into the effort line (one chunk); keep "More changes" on one line, its list under it.

## Layer 1, first impression: 78/100 (pass)

- **Reasoning:** in 50 ms the gallery reads as a shelf of distinct games (one pictogram per base, names in the condensed caps);
  nothing on it is yellow, so the shelf carries the weight. A base's screen reads as one game, its name the title.
- **Violations:** (minor) the pictograms sit at 40 px in a 171 px square, a small identity cue for the largest surface; the stand-in
  vectors are uneven in weight (the bank and the pot read busier than the busts), Lindgaard et al. (2006).
- **Strengths:** the show's own art behind the sheet; the Start bar's yellow appears only once a game is chosen.
- **Fixes:** the nano-banana set replaces the stand-ins once the Gemini billing is restored (the user's style: solid pictograms).

## Layer 2, processing fluency: 72/100 (pass)

- **Reasoning:** one grammar holds: squares choose, rows open, chips pick one, bone is chosen, dashed can't be had, yellow is Start.
- **Violations:** (major) one stage has two names on one screen: the strip labels its run "Merged" while its chips say "Till the
  merge" and "From the merge" (R3: one fact, one form), Reber & Schwarz (1999); (minor) "Start" is an outline on the ready row and
  yellow on a base's screen: the same word, two weights. The outline is R2's call (no commit outweighs the shelf) and stays.
- **Strengths:** length said once on the base's screen (the strip with its chip), echoed only by Start's line.
- **Fixes:** a later stage's run in the strip reads its start name ("From the merge"), the first stage its own name with "now".

## Layer 3, perception bias: 74/100 (pass)

- **Reasoning:** R4 holds on Outlast: what everyone does is in view with its weekly mark, and riley is named, closed, with the one-tap
  fix. The fitted note is honest ("so it's 2 each, not 3").
- **Violations:** (major) the square still promises the base's default ("Pick 3, then cheer for them to last") when this season can
  only seat two each: the first prediction is wrong and the screen has to correct it, Clark (2013); (minor) an all-yours draft
  defaults to When the next one airs, which costs riley a move; the user decided that default (BACKLOG 68), so it stays, and the
  warning with its fix is what carries R4 here.
- **Fixes:** a fitted base's square says the fitted number ("Pick 2, then cheer for them to last").

## Layer 4, decision architecture: 70/100 (pass)

- **Reasoning:** the trail runs understand, stretch, try, commit: Try it sits on the effort line in the first view, Start is docked
  with a concrete line ("Episode 9 to the finale · picks by tonight 8 PM").
- **Violations:** (major) Describe's result ends on "Open it to change more" with no Start, though the interview's point is a game
  ready in one turn, Hertwig & Erev (2009); (major) "or ask them first" is an underlined phrase in the small line under Start, not
  the peer R5 asked for: for a choice made for others, asking is half the decision, Trope & Liberman (2010); (minor) Try it and
  the lock fix are 36 to 40 px tall, under the app's 44 px target.
- **Strengths:** Undo on every changed row; dashed choices say why in six words; Done docked on a change.
- **Fixes:** Start on Describe's result beside Open it to change more; Ask them first as an outlined control on the line under
  Start, beside who Start tells; 44 px for Try it and the fix.

## Caps, cross-layer, overall

No critical violation, so no cap. Cross-layer: the fitted game is one fact said three ways (the square's 3, the note's 2, the Your
team row), the backend's fitting surfacing as a contradiction (l018's shape): fixing the square and folding the note removes it at
L0, L2 and L3 at once. **Overall: (76 × 1.5 + 78 + 72 + 74 + 70) / 5.5 = 74.** The spread is narrow because the build was derived
from these same requirements; it sits in the "good" anchor's range.

## Top three fixes

1. **One fact, one form for the fitted draft and the stages** (L0, L2, L3): the square says the fitted number; the note folds into
   the effort line; a later stage's run reads its start name.
2. **Describe ends on Start; Ask them first becomes a peer control** (L4).
3. **44 px targets** for Try it and the lock's fix; "More changes" on one line (L0, L4).

> *Initial findings. Ralph Loop a layer score, cite further, switch to solve / analyze, or ask any follow-up to dig deeper.*
