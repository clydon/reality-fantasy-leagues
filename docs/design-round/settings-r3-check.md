# Settings, Round 3a: the check, the fixes, what's open

> **Status (2026-11-21): Round 3a, the check and its one batch of fixes** (docs/DESIGN-PROCESS.md). Two independent reviewers
> scored the built screens at 390 against [settings-r3-spec.md](settings-r3-spec.md), [-first-view.md](settings-r3-first-view.md)
> and [-shape.md](settings-r3-shape.md); their full reports are local (`.ui-atlas/stories/settings-r3/check-pfd.md`,
> `check-impeccable.md`).

## The scores

| Reviewer | Today (Backstage, game settings) | Built | After the fixes | Bar |
| --- | --- | --- | --- | --- |
| Perception-First Design (evaluate) | 52 | 68 | **74** | 80 |
| Impeccable (critique) | about 25 / 40 | 29 / 40 | **32 / 40** | 32 |

The confirming look found one slip of the fixes, fixed with it (not a second pass): riley's page ended on an empty "This game"
heading (Rename and Stop are the Commissioner's), and the waiver job's yellow "Open" read as a status ("See picks" now).
Impeccable meets its bar. PFD is short of it, and what it still marks down is one piece, the second choice below.

## What both found, and the one batch of fixes

1. **Replacing people who leave contradicted itself** ("When someone's out" over "When your team is short"): its value is now the
   rule alone.
2. **An open waiver window never reached the game's page:** it's a job at the top now ("Waivers are open · due …", Open).
3. **Lines led back into Backstage-style screens:** Waivers opened from a game says "Manage this game" on Back and "You run this";
   its tabs name games by their own names. (The page itself is still Waivers; moving its week's actions in place is 3b's.)
4. **One icon for different things:** the rulebook, Recent changes and Rename have their own pictograms.
5. **The show's ⋯ named games by type,** the list a tap later by name: it names them ("Couch Cup, Lineup League and Pool Party").
6. **Games you run described settings, not state,** and cut off: each row is the type and the next dated thing.
7. **A second Archive or delete on Games you run:** gone; it only shows "Archived · N" to bring one back, when there's one.
8. **Manage this game was third in the game's ⋯:** first now.
9. **The page's foot broke up:** Recent changes joined This season's rules; Rename and Stop sit under one "This game" label.
10. **Freeze reached three games with a small caption:** the caption and the toast name them.
11. **A Helper's view:** her role line says "join requests" (Who can join stays the Commissioner's); Freeze reads as a value at full
    contrast with whose it is, not a dimmed switch; Who's playing's rows aren't doors to an empty sheet.
12. **Small words:** the hold says "Their seat stops playing" (not "hard to undo" over "Restorable for 30 days"); Player says
    "Sets their own team; runs nothing"; the chosen role carries a tick.

## Not changed, and why

- **The lock card isn't yellow on the fixture's day:** Ep 6 airs in three days, so it isn't due; yellow is for a due job (it is on
  an episode night). Kept.
- **Pick for them in a person's sheet:** it lives in the waiver window's page, which the new job opens; putting it in the sheet
  too is 3b, with Waivers' actions moving in place.
- **A person's colour differs between Manage and Waivers** (waivers.tsx passes `userId ?? playerId`): Waivers' own, pre-existing;
  noted for Round 4's ripple.
- **Off-scale type sizes (12, 14, 17 px)** the detector flagged are the incumbent rows' (SettingLine, EndGames), not new.

## Choices for the user (the story: https://claude.ai/artifact/53oCgbQkJdW1e6RARGWP73)

**2. The waiver window's week: on the game's page now, or in 3b.** PFD's leftover: the job and Replacing people who leave still
open the separate Waivers page (a tab for the other game, its own settings). Moving the week onto the game (who's picked, Pick for
them, Run now, the settings in place) closes most of what's left (PFD findings 1, 2 and 6). Recommended: now, before 3a merges.

**1. The game's gear runs the game; the show's gear is your own settings.** Both reviewers noticed the gear means "settings of this
thing" on a game (for whoever runs it) and "your settings" on a show. Kept as built: Round 0 decided one gear on every bar, and a
game's only settings are its runner's. The other way: a key for "you run this" on a game's bar, the gear only for your own.

## The user's picks, built (2026-11-21)

The user kept the gear (choice 1, as built) and moved the week now (choice 2). Recorded in decisions.md.
- **Built:**
  - The open week is a job on Manage this game that opens in place: who's picked, Pick for them, Run now, and Change or Turn it off.
  - Replacing people who leave opens in place: this week (Open a waiver window), the last run with Undo, the feel and Fine-tune (a
    Helper reads them as a value), and What players see. Its value says how windows come ("every 3 episodes").
  - Pick for them is on a person's sheet while a window is open, for a Helper too.
  - Backstage's Waivers page is gone. Its old address lands on Games you run.
  - The waiver choices use the page's own chosen-with-a-tick card (`manage/choice.tsx`, shared with How moves lock).
- **What it closes:** PFD's finding 1 (both doors left for a page sorted by game), the rest of 2 ("every 3 episodes" now on the
  line), and 6 (Pick for them on the sheet). No second review was run: the change is PFD's own smallest fix, and the one bounded
  look at the frames (`.ui-atlas/stories/settings-r3/after-week/`) found nothing to fix.
- **Still open, noticed:**
  - Games you run and the show's ⋯ still don't show that waivers are due (PFD 4's rest). Left for 3b's runner's jobs on the strip,
    BACKLOG 157.
  - Couch Cup's job says what the window allows ("Replace who's out"), while its line says the rule ("Whenever one goes home"):
    two facts, not one fact named twice. Kept.
