# Notifications and waivers: the check (step 8)

One check, one batch of fixes, one confirming look ([DESIGN-PROCESS.md](../DESIGN-PROCESS.md)). The reviews:
[PFD evaluate](step8-notify-pfd-eval.md), 73/100 (L0 76, L1 70, L2 66, L3 74, L4 78); [Impeccable critique](step8-notify-critique.md),
27/40, run by a reviewer that saw neither PFD's findings nor the session's reasoning, with the detector (27 advisory font-size
notes, no bans). Frames: `.ui-atlas/stories/step8-notify/{before,after}/` (census-app.js `--only='bell|waivers|notify'`, on
notes-fixture.js) and `.ui-atlas/stories/step8-waivers/{before,after}/` (story-waivers.js, waivers-fixture.js's week).

## Fixed in the batch

| Finding | From | Fix |
| --- | --- | --- |
| The bell's dot is about 4 px of white, the only cue for someone who drives by | PFD major | 12 px with the ground's ring, still not the live colour |
| The ran week says its result three times (a count headline, two cards, the same rows in Everyone's moves) | both | The plate says "You got Maggie and Patt" and for whom; the cards go |
| The weekly bars don't compare: 5 px, no baseline, at a different place in each section, zero as dashes, gone in the picker once a range is set | both | 7 px bars in one 76 px column on a baseline at the same place on every row (an empty slot where a row has no button), the latest episode full and the rest a step back, the aside saying which episodes, "No points yet" and no bars when nobody has any, kept with a range |
| A swap-only week shows nobody who's free | PFD major | Who's free (the best three, read only) under the plate |
| The game switch is two controls (pills, or a ⇆ chip in the bar that isn't a switch) | both | The bar names the game plainly, no switch icon; two games: the pills only |
| One decision, five doors, and Bring in on a claimed page drops its backups silently | critique P1 | The owed plate isn't a door (the three and All N free are); once claimed, each row says Switch and opens the picker with the backups in view; the sheet's foot the same |
| The picker's chosen row in yellow beside the yellow Save | critique P2 | The chosen row and its tag in the foreground; Save stays the one yellow |
| "1 free swap" said twice on a swap-only week | critique minor | The team's aside only on a week that also owes a replacement |
| Free agency says "nothing left to move" beside "All 5 free" | PFD minor | "See who's free (5)" when you can't move |
| The bell's error has no retry | critique minor | Try again |
| (the confirming look) long names truncated by the new bar column | this batch | Names wrap to two lines |

## Kept, with the reason

- **The show's name first in every bell row** (critique P2: "ZT Survivor 51 ·" opens 7 of 8 bodies). PFD settled the bell's
  grouping as time only with the show named once per row, first in its body; where the show is said is the first-view question
  PFD owns. Shorter labels (the show without its season) are a words change for later.
- **No new count in the bell's head** (PFD minor): the New heading says it, R1's own rule.
- **"Rows that need a decision don't lead New"** (PFD minor): they do; the join request is New's first row in hub-bell.

## Open (listed in the story, not chased)

- A deadline inside 24 hours isn't amber on the plate (DESIGN.md's rule); the How sheet says "voted out", Survivor's word, and its
  grid legend explains one of three cell states; picking order wraps to two lines at five players; an avatar's colour differs
  between fixtures (the fixtures', not the page's).
- Push words: "8:00 PM" where the spec wrote "8 PM", and the season label ("ZT Survivor 51") where it wrote the short name.
- A push's landing isn't shown in a frame (the routes are pinned by the unit tests: `?moves=`, the game page, the run).
- Riley's quiet week shows only the plate and the order: that fixture has no past run, so Last time has nothing to show.

## Sports (the short check)

- **The push holds.** A reminder says the season's own word for an episode (shows.episode_term through `shortEp`: "Wk 12 locks
  in about 2 hours", tests/remind-moves.test.js); the hourly job sends one per person, show and episode, so a slate week with
  several games of yours is one push. No score is pushed.
- **The bell holds.** Rows are worded by the same grammar; an icon per kind, nothing per show.
- **Waivers at sports scale, judged from the code, not rendered** (no sports waiver fixture exists yet): Who comes in ranks a few
  hundred free athletes by the game's points and shows three, which holds; but the bars read show results (`perEp`, from
  season_decisions), so an athlete's bars are empty until they read the sport's weekly line (the box scores step 6's
  AthleteChart draws). The picker's Show filter groups by team; a sport needs position (step 6's ranked list has it). Waiver
  pushes still say "Ep" for a sport. Listed for step 10, Sports in full.

## Also found, not touched by this step

- tests/tour-steps.test.js fails twice (the tour's beats after step 7's hub); step 7 changed src/new/tour/steps.ts without the
  test.
- The long checks, run once after the batch: check-new-notify.js 130 passed, 6 failed: one was this step's (a waivers-ran push now
  opens the run itself, as the spec says; the check's expectation updated), four are the BINGO card's (code this step didn't touch),
  and one more of those; check-new-backstage-ii.js stops at its 10th check waiting for the moves dock (`.nd-dock`), which step 3's
  strip removed, so its waiver assertions (updated here for the plate) haven't run in a browser. Unit tests: 2377 passed, the two
  tour-steps failures above.

