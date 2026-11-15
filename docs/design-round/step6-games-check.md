# The Games tab and the draft room: the check (step 6)

The built pages at 390 × 844, judged once by each skill on real renders: `.ui-atlas/stories/step6-games/after/` (the zt couch with
real photos and art: games-alex, games-sam, games-person-sheet, old-season-games), `after/draft/` (story-draft.js on
draft-fixture.js mid-draft with Survivor 51's photos: draft-games-alex, draft-room-waiting, draft-room-up, draft-room-teams (the
Picks board), draft-room-queue, draft-blind; and Gridiron, 344 real NFL athletes: sport-room, sport-room-search, sport-games) and
`after/bench/` (show-due, show-results, xw-waivers-open, staged-merged, show-solo, nfl-real-pool-due on the Games tab).

## PFD evaluate

Context: a show's list of your games, and the room where a team is drafted; the job is "where am I in each game, what does each
need, how does everyone stand" and "whose pick, how long until mine, who's left" (step6-games-spec.md). Design system: the app's
own Lower Third tokens on Tailwind 4.

| Layer | Score | Against |
| --- | --- | --- |
| L0 Cognitive load | 74 | R1: the Games tab's view is the bar, the strip and the first row (three chunks), 18 controls (21 before), 10 type sizes (11); but one game and the head of the second fit, not two and the head of a third. The room: three chunks above the board (clock, your team, the switch), against five bands before |
| L1 First impression | 84 | R2: each row opens on the game's name and your place as its one big number; the room opens on a face and a sentence, then your slots, then the wall at 8 to 12 faces (6 before); the sport room opens on search and positions, rows, no logos as people at tile size |
| L2 Fluency | 82 | R3: one yellow per view (the strip on the tab, the confirm bar in the room; the card's yellow Claim gone); the order said once (the Picks board), the clock only where you are in it; a tribe as the wall's square everywhere; no ranking before anything counts |
| L3 Prediction | 76 | R4: a row's name and chevron open the game, a person their sheet, the action its move. A face tapped out of turn now stars it, but nothing on screen says so before the tap |
| L4 Decision | 79 | R5: one decision per view; the Picks board and queue one tap away; the sport list's position filter. The sport list is ordered by team, not by worth, so the sweat has no ranking to draft from |

Overall (Foundation weighted 1.5): 79.

**Findings**

1. **Major, L0/R1.** On the Games tab a row runs about 380 px (head, place, move, four 44-px rows, the fold): the first view holds
   one game and the second's name (`games-alex`, `games-sam`), so "where am I in each" takes a scroll. Fix: 38-px leaderboard rows,
   the place block and move line tightened, so the second game's place reaches the first view. *Cowan (2001): what isn't in view
   costs a held chunk.*
2. **Major, L4/R5.** The sport room lists 338 athletes by team, alphabetically (`sport-room`: Chase Brown, the Bengals' defense,
   Dohnte Meyers): nothing ranks them and the position chips run in no order (RB, DEF, WR, PK, QB, TE). Fix: the pool's own
   order, best first (the season's list), and positions in the sport's order. *Iyengar and Lepper (2000): a default carries the
   decision.*
3. **Major, L3/R4.** A tap on a face when it isn't your pick stars it (R4), but the room never says so (`draft-room-waiting`). Fix:
   one quiet line under the switch while you're waiting with nothing queued: "Tap a face to queue them for your turn." *Clark
   (2013): an unannounced result is a prediction error.*
4. **Minor, L0.** A sport's 15 slots draw two rows of dashed boxes above the list (`sport-room`), pushing the first athlete down a
   third of the view. Fix: past eight slots, the filled faces and a count ("2 of 15"), no empty boxes.
5. **Minor, L4.** The blind draft puts whoever runs the game's "Pick for riley / jordan / sam" (three buttons) above your own slots
   (`draft-blind`): a Commissioner's rare tool at the casual player's decision point. Fix: under the wall.
6. **Minor, L0.** "Show taken" stands alone on a 50-px line above the wall (`draft-room-up`). Fix: on the first tribe's line.
7. **Minor, L2.** A finished season's row still says "4 behind jordan" (`old-season-games`): it should say the season is over and
   who won. Fix: "Final · riley won it".

Ethics: no countdown unless the Commissioner set a timer ("no timer" said plainly); nothing in red; the waiting player is told how
far away their turn is, not hurried.

## Impeccable critique

A design review of the renders and source by a sub-agent that saw neither PFD's findings nor this session's reasoning (it ran
Assessment A itself and the detector through a sub-agent of its own), on the first renders; the bench frames weren't in yet.

Design health 27/40 (visibility 3, real-world match 2, control 3, consistency 2, error prevention 3, recognition 3, flexibility
3, minimalism 3, recovery 2, help 3). Strengths: each game card leads with the place as one big number with "of 4 · 21 pts · 2
ahead of jordan", one yellow fill per view; the clock answers the waiting question ("4 picks until yours"), the Picks board's
snake grid outlines the live cell, your slots fill as you draft; the person sheet's weekly bars (step 2b's, reached from a row).

Detector: 25 advisories, exit 0, all sizes off DESIGN.md's ramp (12 in games.tsx, 13 in draft.tsx), mostly the ramp's own
omissions (12, 14, 17, 18, 20 px, which its component specs use); real: two 10 px badges, the 52 px "is set" headings, the 34 px
place number.

**Priority issues, merged with the PFD findings**

1. The strip said "Your turn to draft · Lock in your draft picks · Lock when it airs" while a snake turn is due now
   (draft-games-alex, sport-games).
2. TV words on a sport's Games tab: "an episode's in", "Each episode, the season" (sport-games).
3. The sport list has nothing to rank by (team order, positions in no order) (PFD 2).
4. Two pick notations in one clock: "Round 2 · pick 7" and "jordan took Eric · R2·2".
5. The blind room's faces read "You / Picking / Picking / Picking" with no names; its icon an open eye on the private state.
6. An empty search ignores the position chosen ("Nobody free matches 'allen'" with QB on), and offers no way out.
7. Minors: a finished season's foot still says standings move when you reveal; "Show taken" alone on a line (PFD 6).

## The one batch

- **The strip** (strip.tsx): a draft turn leads its titles and its line says "Your pick now", not a lock.
- **The Games tab** (games.tsx): leaderboard rows at 38 px, the place block and the move line tightened (R1); a finished season's
  row says "Final · riley won it" and its foot "Final standings"; the foot and How it works say the show's own word (a game, not an
  episode); the Computer badge at 11 px.
- **The room** (draft.tsx): the last pick in one form ("jordan took Eric with pick 6"); "Tap a face to queue them for your turn"
  under the switch while you wait with nothing queued (PFD 3); "Show taken" on the first tribe's line; past eight slots, the faces
  drafted and the count, no empty boxes (PFD 4); the blind room names each person over In or Picking, its icon a shut eye, and
  "Pick for …" moved under the wall (PFD 5).
- **The sport list**: the pool's own order, best first (draft-view.ts gives each face its `rank` in the season's list), positions
  in the sport's order (QB, RB, WR, TE, K, DEF), and an empty search names the position with "Search every position".

Not changed, with why: the type-ramp drift is app-wide (steps 3 to 5); the 52 px "is set" headings are the done screen's
existing display size; a sport row's stat line waits on box-score lines the fixture doesn't write (a preseason pool has none);
"Call it for Episode 1" on a sport's This week is the shared row's wording (step 10, sports in full); the strip's "EP 5" tag on a
move for Ep 6 is step 3's strip (listed); the finished season's "Getting ready · Episodes 0/13" pill predates this round (listed).

## The confirming look

All frames re-rendered (`after/`, `after/draft/`, `after/bench/`; `games-alex-last` with Last picks open): no words over words; one
yellow at most in each view. Holding: the second game's place now in Alex's first view; "Final · riley won it" on a finished
season; the strip's "Your pick now"; one pick notation ("You took Prescott with pick 6"); names over In or Picking in the blind
room; the sport list best first (Burrow, Smith-Njigba, Gibbs) with positions QB, RB, WR, TE, K, DEF; "2 of 15" folded to the
faces drafted; "Tap a player to queue them for your turn". Still seen, left open: How it works on a sport still says "Each
episode" (the batch's word swap didn't take there); a sport's draft row on the Games tab still draws its 15 empty slots (the
room's fold, not the row's); a head-to-head move line truncates ("last week's stands in til…"); the castaway's sheet from the
draft (the drill tree's new screen) isn't built; the dev server's own "N" badge sits over the confirm bar's words in the frames
(dev only).

## After the user's review (2026-11-15)

The user: a tap on a castaway in the draft should open their sheet; "Sports it's important to get historical stats"; fix the other
open items. Built: a tap opens the person's sheet (draft.tsx `DraftFaceSheet`: step 5's person sheet on a show, the athlete's sheet
on a sport) with the draft's actions at its foot (Draft in yellow only when it's your pick, Queue; Add to your team in the blind
draft); when you're up the tap also selects them, so the confirm bar still offers Draft once it's closed. An athlete's sheet has
Past seasons (cast.tsx `PastSeasons`): the last three regular seasons from ESPN (src/lib/server/sports/history.ts,
`/api/seasons/[id]/athlete-history`), the main category drawn by its key stat and tabled, the rest a tap open; asked when a sheet
opens and cached a day in sports_cache. Also fixed: How it works on a sport says "Each game" (the word swap's pattern had been
written with backspace characters), a sport's draft row folds its slots to "1 of 15", a move's line wraps to two lines, and a
castaway's story says "Nothing yet" before the premiere. Frames: `after/draft/draft-sheet`, `sport-sheet`, `sport-sheet-past`
(story-draft.js; draft-fixture.js `--sport` now gives each real athlete its ESPN id and the season an NFL slate). Story version 2.
