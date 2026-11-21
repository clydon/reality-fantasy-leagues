# Settings, Round 3b: the build brief (Impeccable `shape`)

> **Status (2026-11-21): Round 3b, step 3 of the design process.** Impeccable's shape on Intent's spec
> ([settings-r3b-spec.md](settings-r3b-spec.md)) and PFD's first views ([settings-r3b-first-view.md](settings-r3b-first-view.md)).
> Discovery is answered by the user's Round 0–3a decisions; the user confirms at the screenshot story, not mid-round. Assumptions
> are marked.

1. **Job and audience.** Operate mode, two audiences. **A runner** (Commissioner or Helper) changing a game that's under way: the
   lock, a timing, a rule's reach, a forgotten move, a computer player, then going back to the game sure of who it touched and how
   to take it back. **A player** told that the rules changed under them, and asked (when the game votes) whether it counts back.
2. **Outcome and proof.** At 390 on the zt_nd couch (alex runs three games, riley helps on Lineup League, jordan plays): the lock
   row names its state by effect and offers only reachable states (two before airtime, three after, none with results in), each
   saving with an Undo that still works after a reload; How it plays' five new lines are real controls with "from when" in them;
   every Undo on the page is the server's (the lock, late moves, questions, freeze, computer players); the strip shows a runner's
   real job under a player's own move, never a second yellow; a vote appears as a player's move and its sheet shows both
   answers' consequences; a runner sets Joanna's missing lineup from her sheet without seeing anything private.
3. **Direction.**
   - **Visual authority:** DESIGN.md's Lower Third as built, and 3a's grammar reused, not redrawn: `SettingLine` (value first,
     opened in place), `Choice` (chosen with a tick), `Stepper`, `SwitchRow`, the person sheet, the toast's Undo, the strip's plate.
     No new component shape; a new piece composes these.
   - **Thesis: every change says who, from when, and how back.** The from-when sits inside the choice ("From Ep 7 on"), the who in
     the toast and the change line ("riley locked Ep 6 for everyone"), the how-back is one Undo that the server keeps.
   - **Focal moments:** the lock row after airtime (three effects, plain); the vote sheet (two equal answers, their standings
     consequence, "for now" named).
   - **Soul, not sterile:** the show's own words (Ep/Week, castaways, the moment's own name and its points) in every value; the
     vote names the castaway it moves ("+5 to Carter's holders for Ep 3") rather than "points may change".
4. **Scope.**
   - **Changed:** `src/new/backstage/game-settings.tsx` (the lock row, the new lines, Freeze's Undo), `settings.tsx` (`LockRow`
     becomes the state choice; `SheetQuestions` and pace use typed undos), `waivers.tsx` (Timing real), `computer-players.tsx`
     (Undo, restorable take-out), `src/new/manage/people.tsx` (missing moves on a person's sheet), `jobs.tsx` (the shared jobs read),
     `src/new/show/strip.tsx` (a runner's line under the plate; the vote move), the start gallery's Weekly Lineup default (164).
   - **New:** a vote sheet (`src/new/show/rule-vote.tsx`), composed from `Choice` cards in Round 2's sheet.
   - **Server:** typed undos (`lock`, `pace`, `questions`, `bots`) in change-log.ts and league-changes.ts; `lockWrite` taking a
     state (`auto | early | everyone | closed`); `SETTING_FIELDS` gaining `hideStarters`, `endPhase`, `newMoments`, `benchFill`;
     waiver timing writes; one `runnerJobs` read; the per-game moment gate in `ActiveRosterLogic.pointsFor` with its record on
     rulebook sync; the vote over `stage_change_votes`; the bench fill in `carriedLineup`; the lineup and pick routes open to a
     Helper.
   - **Untouched:** the desk (Round 5), Start a game beyond 164's default, the draft room, the reveal's layout (it gains one
     "filled for you" line), 3a's structure and order.
   - **Anti-goals:** a mode word in a value ("Auto", "Override"); a toggle whose sides mean different things at different times;
     a second yellow in a view; a pre-picked vote; a runner seeing a player's private pick; an Undo that only re-sends; a
     dead Undo past its window; any existing league's totals moving because this shipped.
5. **States and ranges.** Before airtime / after / results in / a sport that locks by game (no row) / own pace (no row); a runner
   who also plays (their own move first) / a Helper / a player (nothing runner-only); a vote open (not voted, voted, tallied),
   settled by a majority, by the most at airtime, by the Commissioner's tie-break, by nobody (default holds); a new moment on a
   known format (next) and a new show (start); one, three and 12 players; a moment's name to 40 characters; an empty starter slot
   filled and not (the setting off); a computer player added, levelled, taken out and brought back.
6. **Interaction and layout.**
   - The lock row is a `SettingLine` above How it plays: icon (open or locked), "Ep 6's lineups", the state in words; opened in
     place, its states as `Choice` cards with one line of effect each; the row's icon takes the lock colour only when the state
     differs from the game's rule.
   - The new How it plays lines sit below Who can join, in Intent's order; each choice card carries its from-when.
   - The vote sheet: the moment's name and points as its head; two `Choice` cards, equal, neither pre-ticked, each with its
     consequence; a quiet "For now: From Ep 8. Nobody voting keeps it." line; after voting, the tally and Change my vote.
   - The strip: a runner's job is one quiet line inside the plate's foot, "You run Lineup League · jordan asked to join", its
     action as the plate's quiet link; a vote is a move like a lineup, in the yellow only when it's the most urgent.
   - Undo: every save's toast offers Undo when the server returned a batch; the change line's Undo calls the same route.
7. **Constraints and open decisions.**
   - *Assumed:* the lock's after-airtime words: Open to whoever hasn't watched · Open to everyone · Locked for everyone.
   - *Assumed:* claims-close steps 6 · 12 · 24 · 48 h; the vote closes when the next episode airs.
   - *Assumed:* existing games' new-moment rule: from the next episode on known formats (Survivor 51), changing no existing
     totals (only moments added after the ship carry a gate).
   - **Open for the user (named on the story with a recommendation):** a vote binds or advises; new points for a moment a game
     had (from the start, as built, or by the game's rule as an engine step); the default by show.
   - Builders must not invent: a general vote on any setting; a lock job on every episode night; a missing move as a strip job.
