# Settings, Round 3a: the build brief (Impeccable `shape`)

> **Status (2026-11-21): Round 3a, step 3 of the design process.** Impeccable's shape on Intent's spec
> ([settings-r3-spec.md](settings-r3-spec.md)) and PFD's first views ([settings-r3-first-view.md](settings-r3-first-view.md)).
> Discovery is answered by the user's Round 0–2 decisions; the user confirms at the screenshot story, not mid-round. Assumptions
> are marked.

1. **Job and audience.** Operate mode. Someone who runs a game (a Commissioner, or a Helper with the lock, waivers and who's in),
   holding one game in mind: act on tonight's lock or a request, check or change how it plays, take one person out, rename it, end
   it. They do one thing and go back to the game.
2. **Outcome and proof.** At 390 on the zt_nd couch (alex runs three games; riley helps on Lineup League; jordan plays) and the
   solo/casual and busy-season fixtures: the game's gear opens Manage this game for that game with the head, the one job (if
   any) and How it plays' first rows in the first view; a job on the strip lands on the page with that job open; the show's ⋯ has
   Games you run here, no Backstage; rename, remove one person from one game, and Bring it back (everything archived) all work;
   no route 404s from an old Backstage link.
3. **Direction.**
   - **Visual authority:** DESIGN.md's Lower Third as built, and Rounds 1–2's settings grammar reused, not redrawn: `PageSection`,
     `Row`/`OpenRow`, `SwitchRow`, `Choice`, `Fold`, the inline ask, `HoldSheet`, Round 2's 44 px name head. The game-settings rows
     already built for Round 4 (`LockRow`, `LineupControl`, `JoinControl`, `HowLong`, `SheetQuestions`, `EndGames`) move in as the
     page's How it plays; Backstage's waiver settings sheet, `ComputerPlayers` and the points list are re-homed, not rewritten.
   - **Thesis: the game carries its own running.** The page is the game's, so its head is the game's name in the condensed display
     face over "Weekly Lineup · ZT Survivor 51", the same head Round 2 gave a show's settings. Under it, one strip-grammar job
     block (the house yellow tag, the act's button) only while there's a job; otherwise How it plays leads.
   - **Focal moment:** on an episode night, the lock's job block: "Ep 6's lineups · Open · lock themselves at 8 PM" with Lock now.
     On any other day, How it plays' first row.
   - **Soul, not sterile:** the show's own words (Ep/Week/Game from show-words) in every value; people's faces in Who's playing;
     the change lines in the voice the history already uses ("riley locked Ep 6 early"). No new colour; the yellow is the job's.
   - **The gear:** the same lucide `Settings` glyph and 44 px button as the show's bar, left of the ⋯, only for a runner.
4. **Scope.**
   - New: `src/new/manage/manage-page.tsx` (the page, `?page=manage&game=<id>`, `usePushedPage`), `src/new/manage/person-sheet.tsx`,
     `src/new/manage/games-you-run.tsx` (the ⋯'s sheet), client calls in `src/new/settings/api.ts` (rename, remove from one game).
   - Changed: `src/new/show/game-page.tsx` (the bar's gear, the ⋯'s first row), `src/new/show/games.tsx` (the card's Manage link),
     `src/new/show/strip.tsx` (runner jobs open the page at the job; the draft plate no longer leads to Backstage),
     `src/new/screens/show-space.tsx` (Games you run here replaces Backstage's row and plate), `src/new/show/episodes.tsx` (Fix who
     went home and house rulings, runners only), the backstage routes (redirects), Backstage's words where pieces move.
   - Server: `src/lib/server/backstage-members.ts` (remove one person from one game), a rename route, team size before the draft,
     the fallback pick's default.
   - Untouched: the draft room's insides (its gear links back), the desk, Start a game, 3b's parts.
   - **Anti-goals:** a second card style; a dashboard of every game; red in a first view; a modal for anything but the holds; a
     dead control shown to a Helper (hide it, or show the value with no chevron); two yellow blocks on one view.
5. **States and ranges.** Commissioner / Helper / player (no door); episode night with the lock open / locked early / reopened /
   a day with no episode; own pace (no lock); a sport (lock by day or week); a staged game (How long by phase); before the draft /
   mid-draft / after; a join request waiting; a waiver window open; finished / archived (Bring it back); one game / three / 57
   finished. Names to 30 characters; 12 people; computer players at three levels.
6. **Interaction and layout.**
   - A pushed page; its Back names where it came from (the game, Games tab, the show). Arriving from a job (`&job=lock|join|draft|
     waivers`) scrolls to the job and opens it.
   - Rows open in place under themselves, one at a time; a fixed row says why in its value line and has no chevron.
   - Saving by reach: at once with Undo and a change line (rename, roles, join, the preset); held with a sentence (Remove from this
     game, Take out a computer player, Delete); today's toasts kept where Undo isn't real yet (3b).
   - Who's playing: 60 px rows with faces; a person opens a sheet (Round 2's sheet grammar) showing only what's yours.
   - Games you run here: a sheet; running games one row each with their state; Finished folded with a count; held height.
   - Stop this game: last, after a gap, quiet (Round 2's pick): Archive · Delete, the hold carrying the red.
7. **Constraints and open decisions.**
   - *Assumed:* the role words are Commissioner · Helper · Player; Helper powers are today's Game admin's (the lock, waivers' week,
     computer players, join requests).
   - *Assumed:* Remove from this game and Rename are the Commissioner's; a Helper's sheet shows Pick for them only.
   - *Assumed:* the runner's job tag on the strip reads "You run it"; at most one runner job shows, then "+N more in games you run".
   - *Assumed:* Recent changes on the show's ⋯ keeps its name until Round 4's words sweep ("Changes in these games" proposed).
   - Builders must not invent: a cross-show list of games; roles set across games at once; A15's controls; a vote.
