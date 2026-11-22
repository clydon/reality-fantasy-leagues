# A league's page, This week (sports-couch B1): the check

2026-11-22, the `sports-couch` lane. DESIGN-PROCESS.md step 4: PFD evaluate and Impeccable critique on the built page, once each (two
independent reviewers, neither shown the other's read), then one batch of fixes and one confirming look. Frames: real renders at
390 × 844, `.ui-atlas/stories/league-page/after/` (`scripts/dev-test/story-league-page.js`). Story:
https://claude.ai/artifact/Nksn54s8dmHHRPYMxuJJ9c.

## Scores

- **PFD evaluate:** Foundation 78, L1 70, L2 66, L3 72, L4 60; overall **70**, no caps. Top: a suggestion (Play this week's games) as
  the page's heaviest thing when nothing's due; none's dead end; the leader's place in yellow; two reveal controls while hidden; the
  empty rank column; solo's raised rows; capitalised handles; the move breaking inside its brackets; the due move said twice.
- **Impeccable critique:** Nielsen **27/40**. Detector: 14 advisory (one deliberate bounce ease matching the show's tab bar; 13 font
  sizes off the ramp, the app's usual 14 px). Contrast: Night passes; Studio's W tick 3.85:1. Focus: tab links, All N and the old
  parts had none of their own. Top: a failed week read showing every team's Bye; neither rivalry opening its game; a finished
  rivalry's score not in the "over" order; solo's wording and rows; none's dead end.

## The one batch

Play this week's games outlined on This week and Play the season left to Games; the rivalry and the season's rows open their game;
winner first in a finished rivalry's score; a failed week read says so with Try again; none links on to Scores; solo's rows plain and
no "tells the couch"; the leader's place bold foreground; no rank column when nothing's ranked; the due move muted under Your games;
only "you" capitalised; Show records outlined; focus rings on the tabs, the rivalry, its rows and All N; Studio's W tick solid teal;
a daily sport's rivalry rows keep "+N more this week"; the move's "(1 question)" as "· 1 question".

## Disagreements, settled by the rules

- **Yellow Play with nothing due:** PFD outline, Impeccable promote. The spec's "the page never invents a yellow" and PFD's first-view
  rule (its question) settle it: outlined.
- **Show the score on the rivalry beside Show records:** Impeccable keep both, PFD one. How much is in the first view is PFD's: one,
  Show records.
- **"Played" for an old hidden game:** PFD's suggestion; the user's 2026-11-09 rule ("Started", never final) wins.

## Open after the confirming look (not chased)

- The move strip breaks as "Fill in your sheet / · 1 question".
- Off-season leaves an empty "Play" heading.
- The season rows' overlapped xs marks cut four-letter codes (fixture codes; real ones are two or three letters).
