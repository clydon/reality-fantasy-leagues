# A league's page, Games (sports-couch B1, session 3): the check

2026-11-22, the `sports-couch` lane. DESIGN-PROCESS.md step 4: PFD evaluate and Impeccable critique on the built tab, once each (two
independent reviewers, neither shown the other's read), then one batch of fixes and one confirming look. Frames: real renders at
390 × 844, `.ui-atlas/stories/league-games/after/` (`scripts/dev-test/story-league-page.js --only=games`). Story: https://claude.ai/artifact/4ncmkRanywVoPbH6N7pTjh.

## Found in the build, before the check

- **A solo player's This week offered a start that dead-ended** (B1 session 1's Play this week's games answered "Start or join a
  couch first"). A sports start needs a couch today, so `LeagueStart` draws nothing without one, and This week's Play heading goes
  with it (it sat over nothing once the start left).
- The move's "(1 question)" in brackets on your game's row: " · 1 question", as the strip says it.

## Scores

- **PFD evaluate:** Foundation 60, L1 68, L2 72, L3 58, L4 64; overall **64**. One yellow per view everywhere; no results; the
  solo and off-season lines honest; the rival handoff keeps its game.
- **Impeccable critique** (single-context): Nielsen **26/40**. Contrast passes in both themes; every target 44 px or more.
  Detector: 6 advisory 14 px sizes off the ramp (the app's usual 14 px).

## The one batch

- **Starts as quiet rows on Games** (both; PFD's R1/R2: eight actions in gameday's first view, the two outlined boxes heavier than
  your due move): Play this week's games and Play the season are rows with a chevron unless this week's is the plate
  (`LeagueStart rows`). This week keeps its approved outlined form.
- **A rival's Start a quiet text button with a chevron** (both: three outlined Starts outweighed Join and looked unlike it).
- **"You" first on a rival's line, the date after** (both: a long name cut "you" off).
- **The plate's line stops at the count** (both: "· tells the couch" wrapped it to three lines; the toast says the couch hears).
- **"N playing" on a game to join** (Impeccable: the row said "in", its sheet "playing").
- **Solo's line gets its next step:** Start a couch · Join one (both, advice: the line was a dead end; making a couch works today).
- **Every meeting's line aligned with the rival names** (Impeccable: 8 px short).

## Kept, and why

- **The focus ring** (Impeccable: weak on Start): the app's convention (`outline-2` foreground) on every page; a house-wide change
  if it changes.
- **11 px in the team marks** (Impeccable): TeamMark's approved size (A1–A3); the user's call if the 12 px floor should reach marks.
- **Folds that don't close** (Impeccable): the show launcher's folds behave the same; one rule for both.
- **Studio's amber for the due move** (PFD): DESIGN.md's chyron line on Studio, deliberately amber (yellow as text disappears on a
  light ground).

## Open after the confirming look (not chased)

- **The join sheet speaks show words on a sports game** ("It plays Episode 12 only: make your pick before you watch it"; both
  reviewers). It's the show's approved join sheet; sports words there are BACKLOG 254 (o).
- **Two games named alike:** yours and the one to join are both "Predictions · Game 12" (the engine's names, BACKLOG 254 a).
- **A game you're in with nothing due** ("All set") has no frame: the stand-in world has none.
