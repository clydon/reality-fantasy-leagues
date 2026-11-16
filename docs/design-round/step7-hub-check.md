# The hub and the TV guide: the check (step 7)

The built pages at 390 × 844, judged once by each skill on real renders: `.ui-atlas/stories/step7-hub/after/` (census-app.js on
the zt couch with show art: hub-alex (a move due), hub-sam (two behind, results waiting), hub-casey, hub-riley, hub-solo (no
couch, solo-fixture.js), hub-new-couch, hub-person-sheet, hub-guide (the guide page from On TV), hub-guide-tomorrow (a crawl card
opening its day), hub-guide-alltv, hub-guide-foot) and `after/sports/` (story-hub-sports.js, a live game day: the ZT Eagles on now
at the Jets, Pick'em on their next game). Before frames under `before/` and `before/sports/`.

## PFD evaluate

Context: the hub's job is "is anything waiting for me, on which show; when's my next episode; where is everyone; what are my
shows", and the guide's "what's on now, tonight and this week" (step7-hub-spec.md). Design system: the app's own Lower Third
tokens on Tailwind 4.

| Layer | Score | Against |
| --- | --- | --- |
| L0 Cognitive load | 76 | R1: the first view is the plate, On TV, your people and the head of your shows (four chunks; seven before), the move said once, its time once (three times before); 2.7 screens (3.5). But 13 type sizes in view against R1's six (the bar's, the plate's five, the crawl's, the faces'), and On TV's bug breaks "On TV" over two lines when its live dot shows |
| L1 First impression | 80 | R2: the plate's art first with nothing above it but the bar; On TV is art (the crawl's cards), so the row reads as TV. With no art (`sports-hub`, `hub-solo`) the plate is a grey slab whose faint fallback name sits behind the real one; on a long sports name the two collide |
| L2 Fluency | 79 | R3: the plate's move is the strip's object (tag "Ep 6", "Pick who survives", "0 of 4 picked"); the faces' marks are the ruler's ("Ep 5"); one yellow in the hub's view. In the guide, "On now" is said twice for one card (the gutter and the card's tag) |
| L3 Prediction | 70 | R4: On TV sits under the plate and its drift waits; nothing pulses but a live dot. On a game day (`sports-hub`) On TV's live dot is the live TV show's, while the couch team's game that's on now isn't in the crawl at all: "what's on" misses the one thing the sports fan opened it for |
| L4 Decision | 75 | R5: the plate opens the move's sheet in one tap (two before), Reveal opens the reveal, a crawl card opens the guide on its day (`hub-guide-tomorrow`). The guide's Sports keeps its old row of day columns cut at 390, without the week's cells |

Overall (Foundation weighted 1.5): 76.

**Findings**

1. **Major, L3/R4.** On a game day the crawl leaves out the couch team's game that's on now (`sports-hub`: the Eagles 14–10 at the
   Jets, in the guide's Sports, nowhere on the hub). Fix: a couch team's game on now (or today) leads the crawl as a card of its
   own, its two marks and the score (or "Started 7:15" with scores hidden), opening the guide on Sports. *Clark (2013): the way in
   sets the prediction; a miss is a prediction error.*
2. **Major, L1/L2.** A show with no art draws its name faintly as the art, behind the plate's own 44 px name; a long sports name
   ("Cowboys at Eagles, Nov 17", `sports-hub`) wraps to two lines and the faint copy sits under "Tue 7:18 PM · in 2 days": words over
   words. Fix: no faint name behind the plate's own (the plate already says it), and the name at 34 px past 14 characters (DESIGN.md's
   title card rule). *Reber and Schwarz (1999): a clash of signals costs fluency.*
3. **Major, L0.** On TV's bug wraps to "ON / TV" when the live dot is beside it (`hub-alex`), a three-line bug whose dot floats.
   Fix: the dot before the words, the bug wide enough for "On TV" on one line.
4. **Major, L4/R5.** The guide's Sports is the old reel of day columns cut at 390 (`sports-guide-sports`), with no week cells: a
   different way to read a week on the same page. Fix: the same seven cells, and the day's games full width under them.
5. **Minor, L2.** "On now" twice for one airing in the rundown (`hub-guide`: the gutter in red and the card's tag). Fix: the
   gutter says the start time, the card says On now.
6. **Minor, L3.** Sam's plate says "Reveal the results · Every game at once" (`hub-sam`), but his pick waiting after the reveal is
   gone from the first view (before: "1 move due"). Fix: "then 1 move" counts every due move on that show.
7. **Minor, L1.** A brand-new couch's Get the couch going pushes On TV and your people below the first view and brings a second
   yellow (its "1") into it (`hub-new-couch`). Fix: Get the couch going under your people, its numbers quiet.
8. **Minor, L2.** A couch named after its show reads "ZT Survivor 51 / ZT Survivor 51" in your people's label (`hub-alex`). Fix:
   the show's line only when it differs from the couch's name.
9. **Minor, L2.** The week's live dot sits on "TODAY" (`hub-guide`). Fix: the dot above the label's line, in the cell's corner
   clear of the words.

Ethics: nothing hurries; the only motion is the crawl (held, slow, still with reduced motion) and a live dot for what's truly on.
Who's set is a count, not faces nudging the one who hasn't picked.

## Impeccable critique

(Below, from a reviewer that saw neither PFD's findings nor this session's reasoning.)

The full review is [step7-hub-critique.md](step7-hub-critique.md). Design health 27/40 (visibility 3, real-world match 3, control 3,
consistency 2, error prevention 3, recognition 3, flexibility 3, minimalism 3, recovery 2, help 2). Strengths: one next thing
instead of a status line and a plate saying the move twice; all four sections in hub-alex's first view; the faces' episode marks;
the guide's rundown (a time gutter, the Now line, two shows at one time side by side). Detector: 50 advisories, all font sizes off
DESIGN.md's ramp, no anti-pattern rules. Its three questions (which element keeps endless motion; due in yellow everywhere; the
fix pass's scope) go to the story, the first as a choice; the second is fixed (it's DESIGN.md's rule already), the third is this
batch.

## The one batch

From both reviews, at once:
- **The crawl on a game day** (PFD 1): the couch's teams' games today lead it (`useTeamsToday`, `SportsMini`: two marks and the
  score, "Started" with scores hidden, the time before), opening the guide on Sports. Read only when the couch follows or plays a
  team (one /api/sports/couch read; the week only then).
- **The art-less plate** (PFD 2, critique 1): `ShowArt bare` (no faint name behind the real one); the name at 34 px past 14
  letters; the season line left out when it repeats the name; a sport's one-letter "G" as the word ("Game 1"); no mark of 0.
- **The plate's words** (critique 2): "Couch: 0 of 4 picked"; other moves never in the title, one line under the plate ("1 more
  move", "2 more moves · ZT Survivor"), 44 px tall; the reveal's line counts every due move on the show and says "You're 2 behind"
  (PFD 6, Joanna).
- **On TV's bug** (PFD 3, critique 7): 98 px, "On TV" on one line, the dot before it.
- **The guide** (PFD 4, 5, 9; critique 3, 4, 6): the switch at 15 px and 44 px tall, the row's whole width, Add a show in the
  page's bar (`PushedPage end`); card details, chips, Next up and the Now line at 13 px, faces at 18 px; the gutter says the time
  and the card says On now; the week's live dot beside its art squares; a card's live dot still under reduced motion; Sports as the
  same seven cells and the day full width (sports/guide.tsx).
- **Due is yellow** (critique 5): posters' and guide cards' due dots in the chyron line, never red.
- **A new couch** (PFD 7, critique 8): Get the couch going under your people, hairline rows, ink numbers, no yellow.
- **Your people** (PFD 8): the show's line only when it isn't the couch's name.
- **Targets**: Watch along and the more-moves line 44 px; the rail's + 44 px.

Not fixed, to the story's Open: endless motion (the user's decision 7 asked for it; a named choice); type sizes against DESIGN.md's
ramp (app-wide); the guide's 12 px day art, empty foot and half-width rail card; a key for what a face's mark counts; the posters'
names over art that carries its own title; feed numbers wrapping.

## The confirming look

census-app.js `--up --only='^hub'` (now reporting words over words), story-hub-sports.js, check-hub-next.js: all pass. Still seen,
listed open, not chased: a sports show named with its date wraps at 34 px; the solo hub's art-less crawl card puts its faint letter
under the time chip (OVERLAP); "ZT Survivor" over "Open" is a poster's hidden back face (a false positive, before too).
