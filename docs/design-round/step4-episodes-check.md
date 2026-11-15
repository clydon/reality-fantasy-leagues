# Episodes and the reveal: the check (step 4)

The built pages at 390 × 844, judged once by each skill on real renders: `.ui-atlas/stories/step4-episodes/after/` (the zt
couch with real art: episodes-sam, episodes-alex, episode-page-alex, progress-chooser-sam, where-riley-traitors,
watchonly-riley-episodes, reveal-sam-1..3) and `bench/` (show-behind at its own pace, nfl-results-told, tonight/show-pace-ahead's
reveal beats).

## PFD evaluate

Context: a show's season index and its one showcase, for people watching with friends and playing games on it; the job is
"where am I, is anything waiting, what did I miss" and, in the reveal, "what happened to me in every game"
(step4-episodes-spec.md). Design system: the app's own Lower Third tokens on Tailwind 4 (no framework profile applies).

| Layer | Score | Against |
| --- | --- | --- |
| L0 Cognitive load | 66 | R1: four chunks pass on Episodes (bar with the compact control, the strip, Next, the first group); the reveal once in the first view in every frame. Words 117 to 122 against 60, and 10 to 11 type sizes against 5 |
| L1 First impression | 82 | R2: the reveal opens on the show's art with its name at 60 px; the lineup beat leads with drawn bars; Episodes' brightest thing is the yellow reveal (Sam) or the due strip (Alex) |
| L2 Fluency | 80 | R3: one progress form on every tab (the teal spoiler banner gone); the episode row the same in Episodes and the ledger; Weekly Lineup's scorers labeled as that game's. One exception below |
| L3 Prediction | 80 | R4: a results push lands on "Last time on ZT Survivor · Every game: …"; Episodes says what's waiting; the ledger shows the boundary |
| L4 Decision | 78 | R5: Reveal Ep 4 is one tap and the ledger's Save says "through Ep 2"; the show reveal's end not yet captured in a frame (the census's new reveal-sam-end) |

Overall (Foundation weighted 1.5): 77.

**Findings**

1. **Major, L0.** 117 to 122 words and 10 to 11 type sizes in Episodes' first view (R1: 60 and 5). What's the page's own: each
   row carries three lines (who left, your night, the couch's names), and the names line repeats what the faces show
   ("zt_nd_alex, zt_nd_riley an…" truncated beside three faces). Fix: on a row, the faces and "You're here" only; the names stay
   in the faces' labels and in Where everyone is. *Cowan (2001): the names are a fourth line to read where the faces are one
   chunk.*
2. **Major, L2/R1.** On Alex's Episodes, the open waiver week says the due move a second time ("Outlast waivers · after
   Episode 5 · Due Tue 8:00 PM · replace Carter · Open" under the strip's "Replace Carter · Pick who survives · Due Tue 8:00
   PM"), with "Open" in the chyron line colour a second bright word. Fix: an open week's row says what it is ("Outlast waivers ·
   after Ep 5 · open") without the due time or the coloured word; the strip holds the move. *Clark (2013): a second form of one
   fact is a prediction error.*
3. **Minor, L0.** The ledger on a show with no titles reads "1 · Episode 1": the number twice. Fix: without a title, the date is
   the row's line ("Wed, Oct 14") and the state its second.
4. **Minor, L1.** The lineup beat and the game beats sit at the vertical centre with the top half of the screen empty (the
   reveal's stage centres every beat); on the art-less bench the opener is black. Accept for the beats (the eye starts at the
   kicker, and centred content reads as "a slide"); the art-less opener is the show's own look without art (DESIGN.md).
5. **Minor, L3.** "Last time on" touched the show's name (the overlap check: 30 px line over 60 px at leading .92). Fixed in the
   build (its own line height and a gap) before this check closed; listed so the story shows it.

Ethics: nothing hustles. The reveal says what it covers before it plays; the yellow is only the one reveal or a due move; Save
says what it will do.

## Impeccable critique

Two isolated assessments: a design review of the renders and source (a sub-agent that saw neither the detector nor PFD's
findings), and the detector on episodes.tsx, reveal.tsx, progress.tsx and where.tsx (the browser overlay skipped: the pages need a
signed-in fixture session).

Design health 25/36 (visibility 3, real-world match 3, control 3, consistency 2, error prevention 3, recognition 3, flexibility
2, minimalism 3, recovery n/a, help 3). Specific to this product: the opener over the show's art, the OUT plate, the hidden-row
stripes, "You're here" and the one yellow belong to Lower Third and the couch; the generic parts are the non-lineup beats (white
type on black) and the ledger's bare "Episode N" rows. Strengths: the compact control (the reveal said once), the opener naming
every game before a result, the signed-bar lineup beat.

Detector: 41 advisory findings, exit 0: 40 sizes off DESIGN.md's ramp (app-wide drift, as in step 3), one bounce easing (the
table beat's, which predates this round).

**Priority issues, merged with the PFD findings**

1. The open waiver week said the due move a second time, with "Open" a second bright word (PFD 2; the review's first issue). The
   hidden rows' eyes were in the chyron line colour beside the control's yellow.
2. The ledger didn't reuse the episode row: "Episode 1 · Wed, Oct 14 · Seen", no face, no "Ana out" (the review's second; PFD 3).
   Its rows on a show you watch looked the same as the fixed ones on a show you play.
3. Save was yellow when it would change nothing (the review's third). The watched show's sheet holds eight controls (to the user,
   below).
4. The reveal's opener set its words over the host's torso, mid-screen; the lineup total floated unlabeled; the end had a Close
   and a Back to the show (the review's fourth and fifth).
5. The rows' couch names repeated the faces (PFD 1). The review asked the opposite for Joanna ("Alex and Riley are on 5", a
   verb); PFD owns how much is at once, so its fix is taken, and the review's words go to the user as a choice.

## The one batch

- The open waiver week is a quiet marker ("Outlast waivers · after Episode 5 · Open · replace Carter", a chevron): the strip holds
  the move and its time. The hidden rows' eyes are muted.
- Rows show the couch's faces, and "You're here" on yours; the names are the faces' label.
- The ledger names who left on the episodes you'd seen (their faces, "Ana out"), the date in the second line; without a title or
  a face the date is the line (no "1 · Episode 1"). On a show you watch each row has a tick that fills when it's seen.
- Save is in the yellow only once it would change something.
- The reveal's opener sits at the dark foot of the art (the gradient darker from 56%); the total reads "+4 in Episode 4"; the end
  has no Close beside Back to the show.
- "More to come" has no lone episode number before it.
- Before the check closed: "Last time on" got its own line height (the overlap check), the own-pace end its capital letter.

Not changed, with why: the predictions beat drawn as each question (the reveal's data carries only its title and line); the
own-pace reveal's table (the catch-up reveal doesn't return one); a head-to-head beat with the opponent's lineup (the spec's open
question: a server change); the type-ramp drift and the table's easing (app-wide, predating the round).

## The confirming look

All frames re-rendered (`after/`, `bench/`, `ripple/`): no words over words; one yellow at most in each. Still seen, left open:
Episodes' first view holds 112 to 118 words against R1's 60 (each row's two lines; accepted for a list, listed); the reveal's end
still offers four controls (Add your GIF, Share, Reveal Ep 5, Back), one of them primary; a sport's lineup beat says "in Episode
5" (sports in full is step 10). The ripple (the compact control on Games, Cast and Chat) holds, and shows two repeats left for
their own rounds: the Games tab's "As of Episode 3 · Reveal" card (step 6) and Chat's "Reveal Episode 4" in its fold (step 9).
