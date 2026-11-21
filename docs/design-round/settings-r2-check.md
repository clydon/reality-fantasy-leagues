# Settings, Round 2: the check, the fixes and what's open

> **Status (2026-11-21): Round 2, step 4 of the design process.** One check by two independent reviewers on the built screens
> (frames: `.ui-atlas/stories/settings-r2/after/`, from `scripts/dev-test/story-settings.js --only=^r2-`; today's in `before/`), one
> batch of fixes, one confirming look by each. Nothing was chased past that (DESIGN-PROCESS.md, "Bounded: no loops"). The reviewers'
> full reports are local: `.ui-atlas/stories/settings-r2/check-pfd.md` and `check-impeccable.md`.

## The scores

| Reviewer | The check | After the fixes | The bar |
| --- | --- | --- | --- |
| Perception-First Design, `evaluate` | 79 / 100 (L0 84, L1 74, L2 82, L3 72, L4 80) | **82** (L0 84, L1 76, L2 84, L3 81, L4 85); R1, R3, R4, R5 pass; R2 fails on one point (below) | 80 |
| Impeccable, `critique` | 31 / 40 | **33 / 40** | 32 |

Today's screens scored about 57 (PFD) and 24/40 (Impeccable).

## What the check found, and the fix

| Finding (both reviewers unless marked) | Fix |
| --- | --- |
| A show's Notifications row read "On here · off on this phone": on and off at once, leading with the opposite of what happens | The phone's fact first: "Off on this phone · this show's are on" (Round 1's rule) |
| The ⋯'s pointer to the gear was a grey line at the sheet's foot with a 12 px gear (PFD) | A real last row, "Your settings for this show", with the gear's icon, opening the page |
| One game, two names: its ⋯ said the game's type ("Weekly Lineup"), its page and the hold its name ("Lineup League") | The ⋯ is titled with the game's name, its type under it; the hold and the toast use the name |
| The row "Episodes you've watched" opened a sheet titled "Where you are" (PFD) | The sheet has the row's name |
| "Out, not seen" under rows like "Bea out", where "out" means someone left (PFD) | "Aired · not seen yet" |
| Where you are, opened from the settings page, said "Change it in the show's settings, under the gear" (Impeccable) | Opened from the page, it doesn't point back there |
| The page head: four labels for two facts, over an empty band when a show has no art; the name at 30 px, off the type ramp (Impeccable) | One whose-label (the bar's "Your settings"); the name at 44; no band without art |
| Two rows with the same eye icon | When results show here has the spoiler shield |
| Mute's "Until the next episode" gave a date, not a time | Day and time ("until Tue 8 PM"); any mute ending within the week reads that way |
| Single words alone on a value's last line (Impeccable) | A value's last two words stay together |
| The owner's confirm button wrapped (Impeccable) | "Make them the owner" (it still wraps at 390 with "Keep it" beside it: open, below) |
| The couch card dropped who owns it (Impeccable) | "4 people · you own it" |
| The story's muted frame read "until Tue 12:44 AM" (a fixture seeding a raw time, not the app) | The frame mutes through the real sheet: "Muted until Tue 8 PM" |

## Open (the confirming look still found these)

1. **The red Leave or Remove row shows in the first view** on every show page (about 500 px down; the page has five or six rows). PFD's R2
   wants red below the first view; the plan's rule 7 says "deleting comes last, in red". A choice for you (below), not chased.
2. **A player's ledger says "Results in · hidden"** where a follower's says "Aired · not seen yet" (PFD). Kept: for a player the results
   are in and waiting for a reveal, which is a different fact. Both sheets' last line still says "where you are".
3. **The runner's ⋯ has eight rows** with two finished drafts, and Backstage's white plate stays bright with nothing due (PFD, minor).
   Backstage and the drafts are Round 3's.
4. **"Make them the owner" still wraps** beside "Keep it" (Impeccable, P3).
5. **Not in the frames:** a sport whose scores show live, a 30-episode season (the ledger opens at your boundary; no 30-episode
   fixture yet), acting as someone, the Undo toasts (in check-settings-r2.js and the checks, not the story), Add a show's Hide it from
   my couch (it needs the fake listings), the nudge's Don't suggest it, and the hub's couch name for someone solo (none: solo has no
   couch).

## Choices for the user (the rules didn't settle them)

1. **Where the red Leave/Remove sits.** Built: last, after a gap, in red (rule 7), which on a short page is inside the first view. Or:
   drawn quiet (a plain label; only the hold or the Undo carries the red), which satisfies PFD's R2 and keeps it last. Impeccable
   prefers either over padding the page.
2. **When results show here: three choices or two.** Built: three ("Your default (after you've watched)", "After I've watched",
   "Straight away"), so a pin survives a later change of your default. Or two, with "your default" as a tag on one: simpler for Joanna.
3. **A show with no art.** Built: no band, just the name (Impeccable's call, in its lane). Noted because it drops the art band for the
   many researched shows that have none; an initials plate is the other way.
