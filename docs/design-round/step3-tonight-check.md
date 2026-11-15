# Tonight: the check (step 3)

The built page at 390 × 844, judged once by each skill on real renders: `.ui-atlas/stories/step3-tonight/check/` (show-due,
show-behind on the bench; tonight-alex, watchonly-riley-traitors and story-late-show on the zt couch with real art).

## PFD evaluate

Context: a show's home for people who watch with friends and play games on it; the job is "is anything for me, where's
everyone, how did last time go" (step3-tonight-spec.md). Design system: the app's own Lower Third tokens on Tailwind 4.

| Layer | Score | Against |
| --- | --- | --- |
| L0 Cognitive load | 64 | R1: four chunks pass (show, the control, the strip, Last time's top); type sizes 9 to 11 and 86 to 100 words in view, against 5 and 40 |
| L1 First impression | 80 | R2: the art with the couch's faces at their marks is the anchor; 28 px faces read as people; the strip is the brightest thing when a move is due |
| L2 Fluency | 78 | R3: the strip is one shape on every tab; at most one yellow in all 26 frames; teal gone from the stage bar and the tick marks |
| L3 Prediction | 74 | R4: a push about a lineup finds it in the strip, "results are in" finds Reveal in the control, a watcher finds I watched it; one exception below |
| L4 Decision | 80 | R5: one tap to the move, one to the reveal with "every game" on its button; the ledger opens in place |

Overall (Foundation weighted 1.5): 75.

**Findings**

1. **Major, L0.** Nine to eleven type sizes and up to 100 words in the first view, against R1's five and 40. The counts include the
   tab bar, avatar initials and tick numbers; what's the page's own: the strip's second line (13 px) sits a size off the control's
   (14 px), and the Out plate brings two more (19, 13). Fix: the strip's line at the control's 14 px; leave the Out plate (the
   show's own graphic, round 4 decides it). Words over 40 come mostly from Last time's top entering the view; accept it, since R1
   counted four chunks and Last time is the fourth.
   *Cowan (2001): three to five chunks; the extra sizes cost fluency, not chunks.*
2. **Major, L3.** Two behind on a game at its own pace (`show-behind`), the kept own-pace plate ("Watch Episode 4 · Set · Watch ·
   Reveal") takes the reveal, and the control drops its action, so "where you are" is said twice (the control's "2 behind · Ep 4
   and 5 are out", the plate's "Watch Episode 4"). Fix: none this round (the plate is kept by the spec); it goes to the user as a
   choice: fold the plate's three steps into the control, or keep the plate for own pace.
   *Clark (2013): a second form for the same fact is a prediction error the eye stops on.*
3. **Minor, L2.** With nobody's GIF in yet, Last time shows one dashed "Your GIF" tile in a three-column row, two thirds empty
   (`tonight-alex`, `watchonly-riley-traitors`), which reads as content missing. Fix: with no GIFs at all, one full-width row:
   "Add your GIF for Ep N" and the couch's state in a line.
   *Practitioner observation.*
4. **Minor, L1.** On real art the poster's own lettering ("SURVIVOR") shows faintly behind the ruler's right end. The darker foot
   (fixed before this check) keeps ticks readable; nothing more.

Ethics: nothing hustles. The reveal asks before it plays; the strip's yellow is only a real due move; no streak or count is used
to pull anyone back.

## Impeccable critique

Two isolated assessments: a design review of the renders and source, and the detector on tonight.tsx, progress.tsx, strip.tsx
and show-bar.tsx (the browser overlay skipped: the page needs a signed-in fixture session).

Design health 26/40 (visibility 3, real-world match 3, control 3, consistency 2, error prevention 3, recognition 3, flexibility 2,
minimalism 3, recovery 2, help 2). Authored for this product above the fold (the ruler, the strip, the Out plate are broadcast
graphics no other app would have); below it, the Next and Stats rows and the minis are closer to generic.

Detector: 23 advisory findings, exit 0. 22 font sizes off DESIGN.md's frontmatter ramp (most are app-wide drift: 14 px appears 410
times in src/new; the prose names 14, 17 and 20 the tokens don't), one real: the ledger's 12 px line, under the 13 px floor. One
bounce easing on the tab bar's icon (it predates this round; no reduced-motion guard).

**Priority issues, merged with the PFD findings**

1. Two behind on an own-pace game, the kept plate takes the reveal (PFD 2). To the user, below.
2. Your mark had two doors to one place (the line and Update) beside the ruler's: six targets above the strip.
3. All set said the air time a second time ("Change anything until Mon 12:20 PM" under the control's "Ep 5 · Mon 12:20 PM").
4. The minis said facts twice ("1st of 4" in the line and the state line), game names in their colour put teal on Survival Pool's
   name, and the ledger's scale let one −3 week draw the widest bar while a 0 drew nothing.
5. Sports words: "Nobody left in G 2" on a game; a sport's engine key as a game's name.

## The one batch

- Your mark is one button with a chevron (Update gone); the ruler stays the couch's door.
- The strip's all-set line says "Change anything until it airs"; its second line at the control's 14 px.
- Minis: the standing's repeated state line gone; game names in muted ink with the game's colour as a dot; the ledger's scale at
  least 4 points wide, a 0 as a dot, its line at 13 px.
- Ruler: three faces at a mark, then "+n"; labels an even run (first, every second or fifth, then the last and latest).
- Last time with no GIF from anyone: one full-width "Add your GIF for Ep N" row.
- Sports: no "Nobody left" line.
- A failed read says "Couldn't load this show" with Try again (BACKLOG 85).

Not changed, with why: the countdown inside the last day ("23:59:58") is the app's clock rule everywhere (clock.ts calm); the
type ramp drift is app-wide, a DESIGN.md decision rather than this page's; the tab bar's easing predates the round.

## The confirming look

All 26 frames re-rendered: at most one yellow each, no words over words. Still seen, left open: the NFL mini's name still reads
"ACTIVE-ROSTER" (the engine key's case beat the check); on the zt couch, Alex's strip names the replacement on Episodes but not on
Tonight, captured a minute apart (the pickup appears in Alex's moves partway through the run; likely the waivers read that only
Episodes makes, not the strip).
