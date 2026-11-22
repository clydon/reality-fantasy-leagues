# A league's page, Scores (sports-couch B1, session 2): the check

2026-11-22, the `sports-couch` lane. DESIGN-PROCESS.md step 4: PFD evaluate and Impeccable critique on the built tab, once each (two
independent reviewers, neither shown the other's read nor the build's conclusions), then one batch of fixes and one confirming look.
Frames: real renders at 390 × 844, `.ui-atlas/stories/league-scores/after/` (`scripts/dev-test/story-league-page.js`). Story: https://claude.ai/artifact/SChZpFJzYWthMNrxmr5Whm.

## Found in the build, before the check

- **A spoiler leak, fixed:** with Hide sports scores on, a live game showed its score. Before the profile read answers, "hide" reads
  as off; the live row's "watching it here is seeing it" then marked the game seen, so it stayed shown once the setting arrived.
  The shared scorebug now marks nothing seen until the setting is known (`useHideSportsKnown`, scores.tsx), which covers the hub's
  strip too, and Scores draws no row until then. A brief open flash elsewhere before the profile loads is BACKLOG 254 (k).

## Scores

- **PFD evaluate:** Foundation 80, L1 82, L2 72, L3 68, L4 66; overall **74**, no caps, nothing critical. It now reads as a
  scoreboard at a glance; five and a half rows fit under the switcher; the hidden frames give nothing away (kickoff order, Started,
  no red rule).
- **Impeccable critique** (a single-context run: the reviewer couldn't spawn the skill's two isolated reviewers): Nielsen
  **25/40**. Contrast passes in both themes; focus is visible everywhere; touch targets pass. Detector: 14 advisory font sizes off
  the ramp (12, 14, 17, 18 px), none real; it missed two under the 12 px floor (the line and AM/PM).

## The one batch

- **Show scores asks first** (Impeccable P1: one tap showed a whole week, moved your watch marks, with no way back): a sheet, "Show
  Week 12's scores?", Show all N or Keep hiding, saying what it moves and that a game's eye watches it as if live instead.
- **The couch's games say their day** (Impeccable P1: "2:39 PM" with no day, the couch's group having no day headings): a row
  outside a day heading in a week shows its day, date and time; a final there its weekday.
- **One yellow** (both): the chosen chip's rule is foreground, not chyron; the due move's dot is the content's only yellow.
- **This week › at the switcher's end** (both): pinned inside the sticky switcher, not a line of its own that scrolled away.
- **Now's chip lit only while chosen** (Impeccable P3, PFD's "two answers to which week").
- **An empty day says so and points on** (both): a past day "No games on Sat Nov 21", a future one "No games listed … yet", each
  with the next chip ("Sun Nov 22 ›").
- **Off-season said once** (both): the bar says when it's back; the tab says "No ZTCM games until the season starts."
- **12 px floor at full width** (Impeccable): the status column is 78 px wide on Scores, so the line and AM/PM are 12 px; the
  strip's 208 px bug keeps its approved sizes.

## Disagreements, settled by the rules

- **The yellow chip rule:** PFD left it to the user; Impeccable (its question: how it looks) said foreground; the user's one-yellow
  rule settles it. Foreground.
- **The header's "Week 12" while viewing Week 11** (PFD: two answers): the bar is the league's now on every tab (B1 session 1,
  approved); the chips carry the chosen week, and now's chip no longer looks chosen. Kept.

## Kept from approved work, and why

- **The eye in its outlined box, the possession triangle, faces after the name** (PFD advice): A1's approved scorebug (BACKLOG 253
  b, the user's 2026-11-22 call); the row is that bug by design (R3).
- **The ask sheet's explanation** (both: hard to parse): A1's approved sheet, moved, not redesigned; BACKLOG 254 (l).

## A deviation from the spec, for the user

- **A daily sport's chips are its game days, not a Monday-to-Sunday seven with arrows** (PFD L4 flagged it against the spec). The
  shape changed it: seven chips and two arrows in 358 px are 38 px each, under the 44 px floor, and a day without games could be
  chosen. ESPN's calendar lists game days, so every chip has games; the scroller is the same control as football's weeks.

## Open after the confirming look (not chased)

- A stand-in game shows "Started 4:45 AM": the fixture's clock (`at(-2.6 days)`), not the app.
