# Settings, Round 3b: the check, the fixes, what's open

> **Status (2026-11-21): Round 3b, the check and its one batch of fixes** (docs/DESIGN-PROCESS.md). Two independent reviewers
> scored the built screens at 390 against [settings-r3b-spec.md](settings-r3b-spec.md), [-first-view.md](settings-r3b-first-view.md)
> and [-shape.md](settings-r3b-shape.md); their full reports are local (`.ui-atlas/stories/settings-r3b/check-pfd.md`,
> `check-impeccable.md`). Frames: `.ui-atlas/stories/settings-r3b/after/` (story-settings.js `--only=^r3b-`).

## The scores

| Reviewer | Before (3a's page on 3b's job) | Built | After the fixes (their estimate) | Bar |
| --- | --- | --- | --- | --- |
| Perception-First Design (evaluate) | 61 | **70** | about 76 | 80 |
| Impeccable (critique) | 24 / 40 | **28 / 40** | not re-scored | 32 |

No second review was run (the process's bound). The one confirming look at the refreshed frames found the fixes in place and one
capture slip (a frame that left the lock on for the frames after it), fixed in the capture script. Both reviewers rated the lock
row the round's strongest piece; both put the vote's framing first.

## What they found, and the one batch of fixes

1. **The vote sheet leaned to the default** ("Nobody could have planned for it."; "Not now" the heaviest button). The question
   now names both answers equally ("Should it count in the Eps already played, or only from Ep 6 on?"); leaving is a quiet text
   button. Manage's "From the next episode" card lost "nobody could plan for it" too.
2. **The strip's vote line cut its own question and had no deadline.** It leads with the question ("From the start? 'Won the
   Immunity challenge'"), wraps instead of cutting, and its caption says "by Mon 12:13 PM".
3. **The Commissioner's two bare buttons could settle an open vote in one tap.** They're tick cards now ("Count it from the
   start" / "Keep it from Ep 6", each saying what it does), under "Your call", and only where the call is the Commissioner's: a
   tie, or a moment the game's rule placed. Never over an open vote.
4. **Manage said "Recommended: from the start" on Survivor 51, a known format** (the default read "the show's first season here",
   and the local fixture has one Survivor season). The default now reads the show's format: Survivor's and The Traitors' count
   from the next episode; The Challenge's (seasons differ) and a show in its first season here from the start. A line under the
   choices says why.
5. **The lock's tint read as the house yellow** (two yellow marks in one view with an open waiver window). A state set by hand now
   carries the page's quiet "By hand" tag; the icon stays neutral.
6. **"4 haven't set a pick" over 3 rows:** the count included the runner. Their own missing move is the strip's, so it's left out.
7. **The runner line named the game twice** ("You run Lineup League" over "…join Weekly Lineup"): the title is the job alone
   ("zt_nd_casey asked to join"), and it wraps instead of cutting.
8. **Who goes first was a segmented row** among tick cards: tick cards now, each saying what it does.

## Not changed, and why

- **How long's Ends is a native select** (PFD 5): it's Round 4's control, used for Starts too; 3b added the phase options to it.
  A select is the phone's own picker for a long list of episodes. Round 4's ripple can revisit it.
- **The "Changed" chip** (PFD 5): 3a's SettingLine tag, used on every line that differs from Recommended.

## Still open, noticed

- **"Filled for you" isn't said anywhere yet** (BACKLOG 165's reveal line). The engine names who the bench filled
  (`ActiveRosterLogic.filledFor`); the reveal and the person's lineup don't show it. Next session on the reveal.
- **The lock's runner door on the night plate** (the spec's "Lineups lock 8 PM · You run it: Lock now"): not built. Manage this
  game's lock row is two taps from the game's gear. Left for the user's call on the story.
- **Others' lineups (A15's hideStarters):** left out. The new app never shows others' lineups before the lock, whatever the
  setting says, so the control would do nothing.
- **A moment's points changed mid-season** count from the start, as today (open question 2 on the story).
- **Not in any frame:** a vote voted and settled (the server check covers them), Undo after a reload (the server check),
  Locked for good.
