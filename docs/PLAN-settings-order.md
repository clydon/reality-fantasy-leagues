# Plan: League Settings and Create a league, in the order the arithmetic runs (2026-10-17)

Built, uncommitted. Check: `node scripts/dev-test/results-fixture.js up` then
`node scripts/dev-test/check-settings.js <outDir> [width] [--dark] [--type=active-roster|classic-draft|pickem]`
(throwaway `zt-settings` leagues, deleted afterwards; `--keep` to look, `down` to clean up).

## The idea

Waivers depend on ownership (shared vs exclusive), the cast size and the number of teams, none of which
a new league knows yet. So nothing asks about waivers up front. They take the Balanced suggestion
provisionally (`waiverFit`) and are fitted to the real league when the draft starts (`WaiverLogic.refit`,
now run for any suggestion applied before the draft, not only ones given a team count). Touching a waiver
setting by hand takes the league off the suggestion, as before.

The settings that decide how many teams the cast can feed sit together, in the order the sum runs:
ownership, then roster (or starters and bench), then the fit line ("21 castaways: room for 7 teams of 3.
2 players so far take 6, leaving 15 free for waivers"), then the draft date.

## What changed

- **Create a league, step 3:** name, then "How are teams drafted?" (Exclusive / Shared, default from the
  type, with a line on what the season's cast can feed), then when the draft is. The "How many teams?" and
  waivers block and the "doesn't fit" gate are gone (`wizard-waivers.tsx` deleted). Create still sets the
  silent suggestion.
- **Settings index** (`setup-tab.tsx`): grouped. Before the draft: *Get ready* (Players & invites, Castaways
  & tribes, Teams & draft), *How it scores* (Scoring & rules, Predictions, Waivers), *League* (League basics,
  Linked leagues, Backup). Once the draft is running: *How it scores* first, then *Players & teams*.
- **Teams & draft** (`/setup/teams`, new): ownership (a segmented choice, no longer behind "More options"),
  roster size or starters and bench, the fit line, draft date, hide-starters. Replaces the Lineups page
  (`/setup/lineups` redirects) and takes ownership, draft date and roster size out of League setup.
- **League basics** (`/setup/league`, was League setup): name, show, season, type, results; Starts-at behind
  More options. All locked once the league is underway.
- **Waivers page:** before the draft, a "Nothing to set yet" note instead of a suggestion worked out for
  whoever has joined so far; the index row says "Set for you when the draft starts".
- **Castaways & tribes** (was Tribes & castaways): people first, tribes after; the import leads (open) when
  the cast is empty. A new commissioner to-do, "Add the cast", puts a dot on its row.
- **Cast import hides the starting tribes:** held until episode 1 by default (the checkbox "The starting
  tribes were announced before the premiere" is unticked), so the review shows no tribe fields and no
  question has to be answered before Import. Ticking it shows them to fix and makes them public. The
  creating commissioner's cast list says "Tribe held until episode N" instead of naming it.
- Draft-date to-do now links to Teams & draft. The stale hint that shared leagues have no pickups or swaps
  is gone.

## Create a show (self-serve, from "My show isn't here")

Check: `node scripts/dev-test/check-create-show.js <outDir> [width] [--dark]` (types a name, pastes a
proposal, shoots the review, deletes the draft; approves nothing).

- **The research panel** (`format-research-panel.tsx`) now follows Admin's New show page: the show's name
  is the one thing to type, the prompt builds itself once typing settles (no "Build prompt" tap), then
  1 Copy the research prompt, 2 Paste what it found (Paste / Clear + the box), and a sticky "Review the
  rules". Wiki page, what the show calls its people and groups, and seasons to check are folded under "Help
  the research (optional)". Fields are the settings pages' 48px, 16px ones, not the old small dashed box.
- **The review's Approve is a sticky bar** in the create flow too (it used to sit after the whole list of
  rules). `StickyBar` falls back to 0 when there's no tab bar, and the create flow zeroes `--tabbar-h` for
  the research and review so the bar sits on the screen's bottom.
- Admin's New show page already had this shape and is unchanged.

## Open / next

- **The commissioner tour is not updated** (the user's call: settings first). It still points at the
  create flow's `create-waivers` block (gone), `ownership` on `/setup/league` (now `/setup/teams`), the
  "Tribes & castaways" wording, and its waivers steps (they now run on a league whose waivers fit at the
  draft). `check-commissioner-tour.js` will need the same pass. Three `tour-commissioner` unit tests already
  failed before this work.
- The tour's show steps (`add-build` is gone; `add-built` now fires when the prompt is ready, which in the tour
  is at once because the name is pre-filled; the button that was "Create draft" is "Review the rules").
- What's New: not added (needs the user's approval).
