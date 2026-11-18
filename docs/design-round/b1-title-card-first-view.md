# The game page's title card: first-view requirements (B1, chunk 7)

Mode 2 derivation on [the page spec](b1-title-card-spec.md), at 390 × 844, reconciled with step 2's [R1–R5](step2-game-page-first-view.md)
and Phase 0's [app-wide R1–R5](phase0-first-views.md). Heights are computed from today's classes (game-page.tsx, game-week.tsx,
parts.tsx `TitleCard`), not measured on a render: Impeccable confirms them on the first build.

**The problem.** Someone opens a game: the maker a second after Start, a friend from the couch's push, Joanna after a week away.
The name in caps over the art returns (the user's call), and the risk is the old one: a 64 px title took a quarter of the view and
pushed "who I play, my move, by when" down. The card must be the page's identity without becoming its news or taking the week's height.

## L0 · Cognitive load
**Constraint.** Working memory holds three to five chunks; unattended noise spends it.
**Violation.** The spec stacks bar, kicker, name, sentence, stage line, week block, side bets and season: eight things above the
season's first rows. The bar showing the name while the card shows it too is one fact twice. Today's header already holds eight
type sizes (11, 13, 14, 15, 19, 20, 22, 26); the card adds two more (40–48, 16).
**R1.** The bar and the card are **one chunk** (where am I, which game); the first view still holds four: that chunk, this week with
the move, one secondary row, the season's first rows. The name is on screen once. The first view uses **five type sizes at most**:
display (the card's name), heading (the matchup's names), body 15 (state, records, the sentence, the last result), small 13, micro
11 caps (the kicker, the bar's kicker, positions). Today's 14, 19, 20 and 22 snap to one of these.
**Citations:** Cowan (2001) for the chunk ceiling; Hassin et al. (2009) for unattended noise spending working memory.

## L1 · First impression
**Constraint.** Meaning and appeal are judged in about 50 ms, before reading; the largest high-contrast thing at the top wins it.
**Violation.** Step 2's R2 said "the art is backdrop to the faces, never a title card". The user's decision overrides that: the 50
ms read is now the name over the art. The risk is that it's the *only* thing in that read, and the faces start below it.
**R2.** The card and the matchup are **one surface**: the art runs unbroken behind both (spec #5), and the faces (56 px) start in
the top third, **≤ 290 px from the top in every situation**, so the first glance holds "this game" and "you vs Bo" together. The
name over the art holds ≥ 3:1 against its worst pixel; 15 px text over the art's tail under the week block ≥ 4.5:1.
**Citations:** Lindgaard et al. (2006) for the 50 ms gate; Kurosu & Kashimura (1995) for appeal read as working.

## L2 · Processing fluency
**Constraint.** What's easy to process is judged truer; signals must tell one story, and the same thing must look the same.
**Violation.** The continuity the user wants is an L2 effect, and it fails on any difference between the setup card and the page's
card: tone, size for the same name, position under the bar, or a kicker in another form from the bar's.
**R3.** The page's card is the setup card's **same object**: same caps face, the same size for the same name, its name's top at the
same y under the bar on the maker's arrival, and the same art treatment on both screens (either both grayscale or both colour;
only a mismatch fails). The kicker uses the bar's kicker form (11 caps), so on scroll the bar takes the name in the form it had.
The name matches the push and the Games tab row word for word.
**Citations:** Reber & Schwarz (1999) for fluency read as truth; Spence (2011) for coherence across signals.

## L3 · Perception bias
**Constraint.** People run on prediction: what matches is skipped on autopilot, a mismatch draws attention.
**Violation.** None in the spec's core; it's a strength. A card that never changes is learned and skipped by the second visit, so
the eye goes straight to the week block, the one place that changes (step 2's R4). Anything that varies on the card (a place, a
badge, "Final") would break that and spend the eye on the wrong block. A sentence repeated every visit is skipped the same way.
**R4.** The card carries **no state**, ever, and **no yellow**: a show or team colour near the accent's hue is used only darkened
or as a wash, never as a filled field, so yellow still means "due for you". Saturated art never sits under the move plate.
**Citations:** Clark (2013) for prediction match and violation; Benway & Lane (1998) for repeated, banner-like text going unseen.

## L4 · Decision architecture
**Constraint.** Make the right choice the easiest; show rather than describe; match words to how near the commitment is.
**Violation.** The sentence describes the game; the move shows the next step. Both are right on a first visit only if the move is
in view beside the description. The toast with Undo after Start sits at the screen's foot, where a tall card could push the move.
**R5.** The move (or the reveal, or the state line when nothing's due) **ends above the fold in every situation**, and **≤ 664 px**
(Safari's visible height at 390 × 844 with its toolbars) in the due situations; the toast never covers it. The card is not a control.
**Citations:** Hertwig & Erev (2009) for showing over describing; Trope & Liberman (2010) for concrete words at near commitments.

## The height budget at 390 × 844 (from the classes)
| Block | Height | From |
| --- | --- | --- |
| The bar | 56 | `h-14` |
| The card, lean | 84 (one line at 48), 110 (two at 40), 130 (three at 34) | pt 12 + kicker ~18 + 41/34/29 a line (leading .86) + pb 12 |
| The sentence | + 52 (two lines at 15, mt 8); at most two lines at 390 | |
| Stage line | + 48 | `Stages`, xs plate 44 + mt 4 |
| Week block, show, due, mid-season | 335 (label 28, faces 167, move 72, last 64, pb 4) + header gaps 20 | game-week.tsx |
| Week block, show, set / behind | 362 / 336 | state 53; change link 46 / reveal 84 |
| Week block, sport (nine starters), due | 433 | sides 127, starters + theirs 85, state 53, move 72, last 64 |
| Side bets row | 60 | `min-h-[56px]` + mt |

**Caps.** Bar + lean card ≤ 140 (one line) / ≤ 166 (two). Bar + card with the sentence ≤ 220 (only before your first move, when the
week block is short). Checks: a show, due, lean: faces at 188, move ends ~415, side bets ends ~555, the season's rows start in view. A sport,
due, two-line name with the sentence: faces at 266, move ends ~591 (inside 664); side bets and the season fall below 844.
**When the season's first rows would leave the view, give way in this order:** the name steps down a size → the sentence goes →
the side bets row folds to a line in the card (step 2's rule) → the season starts below the fold. The move never moves.

## The name's size
48 when it fits one line at 358 px (beside a sport's marks, the width left); 40 when it wraps to two; 34 at three; never an
ellipsis. Step by **measured lines**, not the setup's `name.length > 12` (it misjudges narrow and wide letters). Only one display
size appears on the page at a time, so the steps don't count against the five.

## The first view by situation, in the eye's order
| Situation | In view, top to bottom | Never in view |
| --- | --- | --- |
| Just started | Name (+ sentence) → your face / "Draft your team", when it opens, who it waits for → season header | Rules; "new game" banner; confetti |
| Maker's arrival | As above, the name at the setup's y and size; toast at the foot, clear of the move | The toast over the move; a second "made" signal |
| Move due | Name → You vs Bo, records → **Set your lineup** · lock once → last result → side bets → season | The lock twice; state on the card |
| Move set | Name → You vs Bo → "You're set" + starters → last result → season | Any yellow, card or art |
| Stages | Whole game's name → stage line → stage's matchup and move → overall line | The stage's name as the card's |
| Sport | League/team kicker, name, team marks → matchup → nine starters in one row → move | Letter tiles; a yellow team field; "Ep" |
| Story show | Name → the first open call and its control → "2 open · 1 settled" | Settled calls first; the sentence after your first call |
| Finished | Name unchanged → champion → your finish → final standings | "Final" or a place on the card; yellow |
| Someone behind | Name unchanged → "You're up to Ep 3" → Ep 4 matchup, no score → **Reveal Ep 4** | A still from past your mark; any score |
| Long name | Two or three lines at the stepped size; faces still ≤ 290 | An ellipsis in the card; the sentence pushing the move |
| No art | Card on the show's colour (darkened if near yellow); a sport on its team's with its marks | Grey slabs; a yellow field |

## The spec's open questions, perception's view
1. **Art: grayscale or colour.** Perception needs only R3 (both screens the same) and R4 (no saturated hue under the move). Both
   options meet them if the page's wash under the week block stays near-neutral. Grayscale on both is the cheaper way to R4;
   colour on both (changing the setup card) also passes. **The user's call**; the one failing option is a mismatch.
2. **The sentence's life.** Perception backs **until your first move**: a constant paragraph is skipped by the second visit and
   costs ~52 px every time. Open for Intent/the user: someone who only watches never moves, so it would never go for them.
3. **The name in the bar.** Perception backs **once** (empty centre while the card shows, the name on scroll): twice in the first
   view is one fact said twice. The user's choice if they value the bar reading the same at every scroll.

## Against the spec
The spec passes R1–R5 with three changes, perception's to make: **the name steps down before the sentence goes** (stepping saves
7–14 px a line and costs nothing; dropping the sentence takes a friend's only introduction on their first visit); **the
sentence at body 15, not the setup's 16** (a sixth size for 1 px); **step by measured lines**. Outside perception, as advice: cap
the sentence at two lines at 390 (Intent's words), and decide the watcher's sentence.

**The gap.** Step 2's R2 ("never a title card") is superseded by the user's decision, not met: the 50 ms read is now identity. R2
here keeps the situation in the same glance (faces ≤ 290 px); whether people read past a big name on a busy night only the built
page's check (step 4's PFD evaluate) can answer.

> *Initial findings. Ralph Loop a requirement, cite further, switch to analyze / evaluate, or ask any follow-up to dig deeper.*
