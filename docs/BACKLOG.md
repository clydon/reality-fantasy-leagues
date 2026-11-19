# Backlog

Everything open that isn't a step in a plan. **Cleaned 2026-11-19:** every item was checked against the code and git, and
anything done, superseded or not worth doing was closed. The big multi-step work is in [PLANS.md](PLANS.md); what's live
and in flight is in [HANDOFF.md](HANDOFF.md).

**How this file works**
- **Numbers are permanent.** Code, tests and commits cite "BACKLOG 57", so a number never changes and is never reused. A new
  item takes the next free number: **the next is 224.**
- **Closing an item:** delete it here and add one line under "Closed since the cleanup" at the end: the number, done or
  dropped, and the commit or the reason. Numbers closed in the cleanup itself are listed, with their full old text, in
  [archive/BACKLOG-2026-11-19.md](archive/BACKLOG-2026-11-19.md).
- **Sizes:** S is under an hour, M about a session, L several sessions. "Waiting on you" items give the question and Claude's
  recommended answer.
- UI gaps the gameplay explorer finds stay on its plan's "Designs needed" list (DN numbers, in
  [PLAN-GAMEPLAY-SCENARIO-EXPLORER.md](PLAN-GAMEPLAY-SCENARIO-EXPLORER.md) §6A). Items here point at them.
- Nothing merges or deploys on a Wednesday (Survivor 51's night).

---

## Dated

Survivor 51's Ep 10 airs Wed 2026-11-25. Its finale is Wed 2026-12-16.

**111. Tonight's "Seen Ep N?" forgets a Not yet.** *Before Ep 10.* Someone catching up answers Not yet, but a reload asks
again, and so does a second phone. The answer should hold until a new episode airs. Trace the save (`watching.follow` with
`notYet`, follows.ts) and the read (`show.notYet` from the space route, progress.tsx:137). Done when
scripts/dev-test/check-strip-settle.js passes every case. [S–M · tonight]

**39. The sign-in database pool can crash a server instance.** *Before Ep 10.* Better Auth's pool (src/lib/auth.ts:7) has
no `on("error")` handler, so an idle connection Neon drops can take the process down. The app's own pool got that guard in
1905e7d2 after the same crash. Give Better Auth the app's guarded pool (or add the handler), and set
`advanced.database.validateSchema: false` to stop the cold-start schema check. Done when a deploy's live look shows no
"[Better Auth] Could not validate" line and no first-load 500. Adding `sslmode=verify-full` to the connection strings in Vercel
and GitHub, which quiets pg's warning, is the user's. [S · hosting]

**110. Watch Ep 10's night, the first with episode night.** *Thu 2026-11-26.* Look C, Lock in and carried lineups went live
2026-11-19 (7cfb1bb5). The morning after, check production: did anyone hit a refused move after Lock in, did Undo work, and did
the after-airtime reminder go only to people who hadn't watched? Count the `reminder_log` rows with window `'late'` for
Episodes 9 and 10, and read the push as someone who never asked for it would. A production read, so ask first. Write down what
was seen. (Takes in the old 65.) [S · tonight]

**115. Tell Survival Pool players the finale rule.** *Before Dec 16.* "Only the winner survives the finale" has been live since
2026-10-31, but no pool's How it plays says so. Add one line in describe.js for a survival game whose span reaches the finale,
and show it on the finale's pick. Proposed words: "In the finale only the winner survives, so pick who you think wins." The
words go through impeccable's clarify and need the user's OK. Done with tests/describe updated. [S · game page]

**116. The finale through research: the winner and the places.** *Before Dec 16.* On every taped finale, research's "did they
leave the game permanently in THIS episode?" left the winner and the finalists in the game (survivor.js:333,
rulebook-compile.js:669). Survivor 51's results are the admin's, so the desk can add the winner by hand, but a paste or One tap
would leave the season with no winner. Change the question for a finale (or add "how they finished" for endgame exits), order a
night's endgame exits by place (`decision-apply.ts orderPlacementsByEpisode`), and mark a finale with no scoring moments final.
Prove it with blind.js on the taped finales (Survivor 49, Traitors 4, Challenge 41, Dancing with the Stars 34), then walk
Survivor 51's finale path once on the desk. (PLAYTEST-REPORT findings 1, 8, 17, 20 and 21.) [M · research]

---

## Now: small and ready

Grouped so each group is about one session. Take them in any order.

### Fix the stale and flaky checks

**223. check-new-make-it.js --api fails at its first ask.** On the sports-phase0 branch (2026-11-19) its stand-in bot gives no
cast answer for ZT Yacht Life ("ChatGPT didn't answer ... no answer for cast"), so Make it a game stops at "needs cast" and every
line after it fails. Not from step 1.3 (it fails before the cast insert that step changed). Find whether fake-bot.js's cast kind or
the listing's crew path moved, and bring the check up to date. [S · checks]

**70. Bring the stale checks up to date.** These checks fail on the live code, so they've stopped protecting anything. One
commit each:
- check-new-show.js: drop "the prediction is an extra this week" (Tonight removed that row on purpose, ff74e563), count yellow
  buttons rather than every `.bg-chyron`, and delete the dead rows behind `const more = false` in tonight.tsx.
- check-start-a-game.js:161: expect a start from any aired episode to be taken (an own-pace start).
- check-new-shell.js: give the `zt-pt-survivor` fixture art the app serves.
- check-new-hub (wait for `[data-stat-deck]` before reading the deck), check-new-way-in, check-new-stats, check-where-everyone,
  check-new-reveal, check-gif-reactions, check-game-page ("Close didn't shut them all"), check-group-slots (five old FAILs from
  Episode 6 on), check-desk-shows ("Show 5 more"), check-new-desk's rulebook section, check-new-listings' art race and
  check-new-studio's reels.
- check-new-tour (phase J), and run it once as a solo account: if the reveal step lights Up next with nothing to tap, light the
  made-up reveal's button or skip the step.
- check-new-episode-games: talk-fixture.js dates its show by the database's UTC day, so part 2 fails in the evening, Eastern.
  Date it by the Eastern day, and run it before and after 8 PM Eastern.
- check-sports-explorer.js `--case=calledoff` part 4 needs the Eastern day-edge guard part 3 has.
- check-episode-lock.js's "a new pick doesn't go in": look at it as a possible lock bug before changing the check.
- the checks the wizard's B1–B4 left stale (the redo plan's merge note lists them), and the Atlas hub cases re-recorded on a zt
  account that exists.
- a lock file in new-fixture.js `up`, so a second check says "another check is running".

Done when each passes twice in a row on master, or its failure is filed here as a product bug. A check that can't be saved is
deleted. [M · checks]

**30. check-sheet-back.js hangs about one run in four.** The guide case's `page.close()` sometimes never returns. Race each
close against a short timeout (or leave pages to `browser.close()`). Done when ten runs in a row finish. [S · checks]

**98. check-sheet-back.js's TV guide case is stale.** It opens the guide the way it worked before step 7's hub and times out
on `[data-guide-sheet]`. Open it the current way (src/new/hub/guide.tsx). Done when all 14 cases pass. [S · checks]

**99. check-new-draft.js is stale since step 6.** It waits for the removed `[data-ticker]` and assumes a tile tap picks; a tap
now opens the castaway's sheet. Point it at the turn line and pick through the sheet's foot. Done when the whole check passes,
the blind draft included. [S · checks]

**101. check-sports-links.js's mark cases are stale.** Since U1, a sport shows results straight away unless "Sports scores too"
is on. Turn that on for the viewer in those 13 cases, and add one case for the default. Part of [PLAN-sports-ready.md](PLAN-sports-ready.md), step 1.6. [S · checks]

**91. check-new-backstage-ii.js waits a fixed 1.5 s after a feel's Undo.** Poll the league's state for
`waiverFeel === "balanced"` for up to about 8 s instead. If it still fails, look at `backstage.undo` for a feel. Done when five
runs pass. [S · checks]

**117. Run the two checks that were never run.** check-new-watching.js (the season picker, add by number) and
check-backstage-remind.js (the Reminders card, the four-hour limit) came from cloud sessions and have no record of a run,
though their features are live. Run each once on the dev server, fix what fails, and record it. [S · checks]

**78. The unit suite checks a sport's league without its sport.** tests/game-spec.test.js's local-database pass checks each
league's spec without its season's context, so a league scored by a sport's stats (the NBA's lineup of ten) fails, though the
server accepts it. Load the season's sport context (as capabilities.js does) and pass it to `specProblems` in `roundTrip`.
[S · checks]

### Small engine and server fixes

**49. Hits counted once: the season grid doesn't add up to the standings.** In `ActiveRosterLogic.combines`, return true when
`score.hits` is `'pick'` or `'objective'`, so `teamEpisodeBreakdown` takes the engine's path. Done when
`.ui-atlas/campaigns/parlays-probe/repro-6.json` agrees, `known:hits-grid-plain` is zero, and compare-totals.js on a fresh
backup moves no league. Part of [PLAN-sports-ready.md](PLAN-sports-ready.md), step 1.6. [S · engine]

**71. Waivers keep going after a game is over.** `WaiverLogic.openWindow` refuses after the season ends, but not after the
game does (a first stage that ends at the merge, a span that has ended). `replacementsOwed` still owes replacements then, and
counts an endgame exit (a finalist) as a loss to replace. Refuse ("This game is over"), owe nothing once `gameOver`, and hide
Backstage's Open a window. Check with `.ui-atlas/repro-late-week.json`, and add the Traitors 4 quick-exits replay to
tests/waivers.test.js. (Takes in PLAYTEST-REPORT finding 15.) [S · waivers]

**59. A held waiver week still shows its old time.** After Undo, a week is held until Run now or the next episode airs, but
Backstage and the players' waivers screen still show its old `due`. Send no `due` for a held week (backstage-games.ts,
waiver-view.ts) and say "On hold until you run it, or Episode N airs". Also, the "forget to pick" line promises "whoever's free
with the most points" on every game. Only a game scored by moments fills that way, so elsewhere say "someone who's free". Check
with `check-explorer-page.js --only="commissioner's waiver window"`. [S · waivers]

**66. Your moves' "Reveal Episode N" does nothing on a game's page.** `RevealFirst` (dock.tsx) opens the reveal in place, but
only the show's tabs mount it. On `/show/<season>/game/<league>` the address changes and nothing shows. Make it a link to
`paths.reveal(seasonId, n)`, as the started gate's "I've watched it" is. Check at 390 from a game page with a reveal due.
[S · reveal]

**118. A still-in Traitor's role can show in a league's views.** The episode view and the reveal's lineup "why" don't filter
out events that give away a still-in player's secret role; episode-results.ts already does. Apply `secretEvents`
(cast-stats.ts) in `episode-view.ts scorersIn` and the reveal's "why", with a test on a Traitors fixture. [S · reveal]

**119. League state written outside the league lock.** Some writers update `leagues.state` without `withLeagueLock`:
end-game.ts, join-league.ts, db/link-season-cast.js, db/game-specs.js, db/rulebooks.js and db/waivers.js. Each should read the
row `FOR UPDATE` in the same transaction, or go through the lock. Done when each is confirmed or fixed, and check-new-desk's
"every league renames him" passes ten runs in a row. [S–M · engine]

**26. Two lint errors.** `npx eslint src` fails `react-hooks/immutability` at src/components/ui/use-sheet-swipe.ts:40 (`reset`
writes the scrim ref's style, in a hook every new-design sheet uses), and the purity rule at game-page.tsx:147 (`Date.now()` in
render). Write the style through the element, and take `now` from the page's clock. Done when eslint is clean and the sheet
swipe still works. [S · cleanup]

**37. Couch points: a backup gap and two ties.** scripts/backup-common.js leaves out `user_days`, so a restore loses everyone's
days opened: add it to the people tables. Tonight's Stat of the week (`statBoard(...)[0]`) and the hub's Most-watched show take
the first of a tie: use `leadWorthNaming` (couch-standings.ts:445), as By the numbers does. [S · couch]

**64. The engine lab shows a retired spec part.** `when.ownLock` in tests/fixtures/engine-capabilities.json still shows
`extras.lateLock`, which nothing has read since the pace took over. Point the row at the game's pace, or drop it. [S · engine]

**120. Delete two pieces of dead code.** src/lib/game/episode-team-summary.ts and its test (nothing imports it), and the unused
`UpNext` component in src/new/show/up-next.tsx (no callers since d91c6807; keep `upNextEpisode`, `askWatched`, `WatchedSheet`
and `AskSheet` if they're used), with check-tonight-up-next.js retired or repointed. tsc, eslint and the unit suite clean.
[S · cleanup]

### Small UI fixes (one Impeccable polish pass)

**51. Outlast in reverse says "Fewest points wins".** The most points still win. Drop the note at game-page/model.ts:427, or say
what reverse means ("the earlier yours go home, the more they bank"), through impeccable's clarify. The same as DN-22's first
half. [S · game page]

**121. The own-pace finish plate reads final too early.** pace-plate.tsx's FinishPlate shows "3rd of 4" as final while friends
are still behind, and "1st of 1" for someone alone. Say "Currently 3rd of 4" until everyone has finished. Alone (no computer
players), show the game's own measure instead of a rank. Check on night-fixture's own-pace case. [S · game page]

**20. Backstage › Members names two games of a kind alike.** When two games share a `gameName`, use each game's own `name` in
members.tsx's `roleLine`, its game list and the Computer players heads, as games.tsx's `twin` does. [S · desk]

**102. Previously on says "Nothing to recap yet" while Home loads.** Opened cold from `/home?page=previously`. Pass whether Home
has loaded into `PreviouslyOn` (couch-pages.tsx), and show a skeleton until it has. [S · hub]

**35. The welcome page's "Nothing on" is too faint.** landing-page.tsx:519 colours the guide's empty day `var(--field)`, under
3:1. Use the muted text colour. [S · tour]

**95. Two table leftovers from The numbers.** The Cast tab's show lens (`NumbersTable`, cast.tsx) should name people through
`castName` with a clash count, so two Kristins read "Kristin C." and "Kristin F.". Your sheet's season table (`PersonSeason`,
game-week.tsx) needs GameTable's `gutter` cover beside the pinned cells. Check at 390 on a 14-episode season. [S · cast]

**96. Person-sheet leftovers.** (1) `inkOn` (game-week.tsx:28-34) reads `hsl()` numbers as RGB, so a week tag on a light show
colour gets white text at 2.6:1. (2) Pass `onFlag` to the game page's `DrillSheets`, so Something wrong works there. (3) Give
the drill's castaway, stat, pick and compare levels an error state instead of a pulse that never ends. (4) A hairline or short
fade under the sheet header (ui/sheet.tsx). [S · cast]

**104. Bounce easings DESIGN.md forbids.** `cubic-bezier(.34, 1.45, .64, 1)` appears in new.css (nd-dock-in, nd-vote-in,
nd-pip-land, nd-stamp, nd-line), show-bar.tsx:199, reveal.tsx:1063 (the standings reorder) and toast.tsx:54. Replace each with an
ease-out after checking what it moves, and leave swipe-pager.tsx's finger-driven spring alone. Done when `1.45` appears only in
the landing pages. [S · craft]

**105. The shared sheet's Back and Close are 40 px.** The stepper's ‹ › are 40 × 36. Make all four 44 px (`size-11`, the same
icon), and check that a long title still fits at 390. [S · craft]

**34. The optional button's edge is too faint, app-wide.** `Btn`'s optional tone (src/new/ui/parts.tsx:19) uses the faint
`outline-input` edge (1.2–1.6:1). Move it to `outline-edge`, the Control Edge token Settings already uses, at least 44 px tall.
A visible change everywhere, so show the user a before/after at 390 in Night and Studio first, then look at the other
`outline-input` uses on controls. [S–M · craft]

**122. Small UI fixes found in the cleanup.** Each is S:
- The Games tab says "Start your best three" for every lineup game: `games.tsx:54 lineOf` should read the game's slots.
- A library rulebook's Delete (desk/rulebook.tsx:184) is mid-page and instant. Move it to the end, with the hold to confirm
  that every other desk Delete uses.
- Backstage for a Game admin: hide Competitive mode's dimmed switch, and title the game's ⋯ sheet with its name, not its type.
- The gallery's first view says "Community and saved" twice: keep the row and drop the matching chip.
- At your own pace with exclusive teams and waivers, the At your own pace card adds "and for waivers" to its line about
  waiting together (bold-sheet.tsx `PLAIN_LOCK.own`).
- Chat's fold over a show someone only watches offers only "Show them anyway (may spoil)". Add "Seen Ep N?" first, through
  step-through.tsx's guard.
- The waivers How sheet asks "Someone of yours voted out?" on every show: use the show's word for leaving. Mark a deadline
  inside 24 hours with `--plate-line` (waivers.tsx:637, DESIGN.md:373).
- The stat board's "Nobody" chip under "Who has them in" reads as "nobody has them" (cast-sheet.tsx:1061): rename it (for
  example "Just the show"). Check Outlast's open row for a repeated "On riley's team".
- Your shows' poster says "Fri" for an episode weeks away (sections.tsx:471): past six days, show the date.
- No text under 11 px in src/new (21 `text-[10px]`, among them Home's game chips at sections.tsx:786 and :793). Ties read "T1"
  on Stats as elsewhere. ShowArt's fallback fits the Episodes tile. Toasts sit clear of first run's Back.

### The Designs-needed words batch

**123. Words for twelve Designs-needed items.** One words pass through impeccable's clarify, on the explorer plan's DN 5 (a
co-op game's lives on the first screen), 6 (a shared question's split), 9 (the rider on a question the couch settles), 11 (phase
names, never an id like "Redraft at merged"; this fixes describe.js's `phaseWord` too), 16 (a rollover's total), 18 (Weekly Calls'
rule by the show's kind), 19 (confidence picks' worth), 22 (Outlast in reverse, with 51), 23 (who chose the top scorer's twist;
delete the stale "No screen yet" comments on the twist and group-slots routes), 24 (the captain on past weeks), 25 (a draft
spread across tribes) and 29 (a pool that skips a night). Also, an Outlast that starts after Episode 1 says in How it works that
everyone starts with the points of those already out. Done when each DN entry is marked done with its commit. [M · game page]

### Production check-ups (ask first: a short session on the desk and in the user's Chrome)

**124. Production look-ups.** Each is a read, then a small fix if one is needed:
- Survivor 51's run schedule on the desk: does it write bingo squares a day before each episode? If not, add bingo.
- The bot VM's `/opt/llm-browser-api/server.py`: does it have the JobQueue and honour `priority: "now"`, so a Describe ask jumps
  research's queue? Correct HOSTING.md:1342 either way, and deploy it with the user's OK if it's missing.
- Vercel › Usage: is Functions Storage still over its 10 GB (14.52 GB on 2026-10-24), and is it old deployments? Trim retention
  if so. Is an unread `ANTHROPIC_API_KEY` still in Vercel's environment (GitHub's secrets no longer have it)?
- Neon on the Launch plan: its usage numbers, and delete rehearsal branches past their 7 days. Write the dated numbers into
  HOSTING.md's Limits table.
- Below Deck 13's Cast page: about 10 crew, or the whole run's 40? If 40, Ask our bot and Send.
- The Traitors 5: run Cast › Not a group, so no board shows who the Traitors are, and set The Traitors (US) cast word to
  Player/Players.
- Seats whose name differs from their account's (one existed in the 2026-10 copy): run `profile.ts renameSeats` for them once.
- Which KLIPY key production has. If it's a test key, request the production key before a second couch joins.

[S · hosting]

---

## Next: worth doing, about a session each

### Engine and rules

**48. A team game with a cut ends at Episode 1 when nobody's on a team yet.** `Seq.lastLeft` counts "none left" as "one left",
so a teams game with a cut, started at own pace on an aired season, ends at once. Skip nights no team plays. The assumed rule is
that such a night counts for nobody: say so in the step, and the user can overrule it. Done when
`.ui-atlas/campaigns/parlays-200/repro-185.json` plays on and `known:teams-none-left` is zero. [S–M · engine]

**67. A draft that opens mid-season when someone's behind (the user's 67-A).**
- **A private draft:** each person drafts when they reach the stage, from who was in when it started (`GhostLogic.teamAt`).
- **A draft with turns, in a live game:** the next episode's lock is the deadline. A seat that hasn't picked gets picks made for
  it, hidden until they've watched.
- **At own pace:** it waits, says who it's waiting on, and whoever runs the game can go on without them.

Design the moment a stage's draft opens along with it: a strip item on Tonight and one push, spoiler-safe, with the deadline.
First drive the draft room as explorer actions (the explorer plan's Next), then lift the refusal at start-game.ts:190. The same
as DN-33's "next stage's draft". [L · engine]

**108. A slate's Pick'em is never graded** (confirmed in Phase 0, 2026-11-19). On a slate (a week of several games) the server
keeps no single game per week (`score.ts leagueGames`). The sports route's Pick'em (`POST /api/sports/start` { league, slate,
game: 'pickem' }) asks one "Who wins?" a week with no sides to pick from, takes an answer anyway and never grades it, while the
gallery's per-game Pick'em grades the same week. Plain final or stat questions, squares and survival pools on a slate are likely
the same. Either ask each game (`each: 'game'`) or refuse single-game questions on a slate. Done when
scripts/dev-test/check-slate-pickem.js passes. This goes before the redo plan's E9. Part of
[PLAN-sports-ready.md](PLAN-sports-ready.md), step 1.6. [M · sports]

**125. An open episode's call can change after a rulebook edit.** Once an episode's first call is made, store its two moments
with it (or on the episode), and have calls.ts read them back before working them out from the rulebook. Done when a
mid-episode rulebook edit leaves an open call unchanged. [S · engine]

**126. Computer players' bingo cards and calls aren't stored.** Store a bot's card and calls when each episode is graded (a
migration), so a later edit to the bank or the cast can't change its past nights. A review finding from the wizard merge.
[S–M · engine]

**127. Start a game allows Outlast setups that can't work.** An exclusive Outlast with more people than castaways still in runs
out of castaways mid-draft (start-game.ts:650): refuse it, or switch to shared ownership. An Outlast over a span too short for
anyone to lose a castaway ends in a mass tie: warn, or don't offer it. Check the gallery's How long options. (PLAYTEST-REPORT
findings 3 and 4.) [S · wizard]

**28. Survivor 51's games apart: two fixes left.**
- **Make every game match compares by person, not value.** decision-apply.ts:94 and :109 call any existing move or role for
  that person "preexisting", whatever its value. Compare the value, and add a check-match-season.js case where a game holds the
  wrong tribe.
- **Research misses second-place tribe wins.** Reword survivor.js's `wonTribeImmunity` and `wonTribeReward` to "a tribe that
  won (first or second, when more than one wins)", before the next season with tribes.

"Who decides results" is under Waiting on you (168). [S–M · research]

**128. A game of guesses can't double the finale.** A draft can take `score.times` (points multiplied in named episodes); a game
of questions can't. Add it, with its words, the gallery's "Finale counts double" and a tracker row. [S · engine]

**129. Undoing a cut in starters doesn't put trimmed lineups back.** When a game's starter count goes down, lineups are trimmed.
Undo restores the count but not the starters it trimmed. Keep them in the change's undo record. [S · engine]

**130. A shared-team game at your own pace runs its waivers on the season as it stands.** A seat that's behind and swaps someone
has the move logged at the league's latest episode, so its unplayed weeks can field someone it let go. Decide between logging
the move at the seat's own episode (as `letGoBefore` reads it) and holding swaps until the seat catches up. Then add a case to
the own-pace tests. [M · engine]

**131. At your own pace, answers that depend on each other may settle early.** A question settled by the players' own answers
(match the majority, split the pot, only unique answers) seems to settle for whoever reveals first, on the answers in so far:
answers.js `playersVerdict` (:555-575) has no wait for own pace. Write a test that proves it first. If it does, hold the
verdict, saying "Settles when Joanna reaches Episode 3", until every human seat has reached the episode. [M · engine]

**132. "Pick from one tribe" still shows as Coming.** The engine can't limit a pool to one group as it stood at the game's start.
Build `pool.where.group` in PoolLogic (read through `viewThrough`, so a later swap doesn't change who was eligible), describe it,
and turn the gallery's option on. [M · engine]

### Game page, Tonight and the reveal

**46. Head to head: what's still missing.** The game page round built this week's matchup, the champion, no OUT marks, quiet
weeks explained and the playoff cut line. What's left: the playoffs as a bracket, round by round; playoff rounds marked in the
season grid; a shared week shown as half a win; and the Games tab's head-to-head glance (with 133). Run check-explorer-page.js's
head-to-head step first, build what's missing through impeccable, then mark DN-3 done. [M · game page]

**40. The engine's words, checked over every spec.** describe.js leaks a phase id when a season's words have no name for it
(`phaseWord`, describe.js:100) and may run sentences together. Add a check that runs `describeSpec` over every corpus spec and
flags a phase id, a doubled heading or a sentence with no break, and fix what it finds. In the same pass (impeccable's clarify),
fix the words left from Rounds 1–2 and G1: "1 moment", a card's lines counted as lines, a phase-to-phase span keeping its start,
no "0 points" where a ticket pays, a one-moment draft said as "Only crying scores", and a fitted draft size explained. Pin each
case in tests/describe. [M · game page]

**133. Episode night: the glance shapes left.** Build the Games tab's remaining glance shapes from strip-night-spec.md's table:
head to head, a question sheet, bingo, Weekly Calls, best ball and a draft, each one row that opens in place. Give Round 3's
night row (whats-on.tsx `NightRow`) who you started, not just whether you're in. Done when night-fixture.js `--extra=6` shows
every type in its shape and seven games stay near 3,140 px. [M · games tab]

**134. Reveal beats that need data the reveal doesn't carry.** Add to `revealIn` (episode-view.ts): the opponent's starters and
points in a head-to-head week, once locked, drawn as two lineups on one scale; the predictions beat question by question; and the
own-pace reveal's before-and-after standings table. Make the episode page's lineup the same signed bars as the reveal. Show the
reveal in one place, the progress control, not again in the Games tab's card and Chat's fold. Check with story-reveal-plates.js.
[M · reveal]

**103. One episode at a time's leftovers.** (1) One phrase for where you are: "You're up to" against "You're through". (2) Name
the episode, with its air date, at the recap's end and in "I've seen Ep 10 too". (3) A home for a mark's Undo beyond the first
beat's toast. (4) The ruler's dashed run readable at 30 episodes. (5) No red count on a played show; red is for leaving. (6) Seed
couch GIFs in step-fixture.js so the recap's GIF slot can be seen filled. [S–M · episodes]

**135. What the drill pass left.** A game's points in its page header; the castaway sheet's header the same from every way in;
"Who has them in" hidden when nobody does; more than one holder line on Outlast's row. The Compare flow and the next pass's order
are under Waiting on you (169). [M · game page]

**136. One count of what's due, everywhere it's shown.** Add a step to a night-fixture check: for one seat at one time, compare
/api/me/home's due moves with each show's moves on Tonight's strip and the Games tab's rows. Cover a waiver owed before airtime,
a draft turn, a late lineup and two games of one kind. Done when a mismatch fails the check. [S · tonight]

**137. The waiver result offers the empty slot.** On the ran week's "You got Rob" plate (waivers.tsx), when the move left a gap
in the open episode's lineup, add one button, "Start Rob in Carter's place", hidden once the lineup is set. [S · waivers]

**138. The blind draft room has no "Needs" line.** In a game with needs, the blind draft room should say what your team still
needs ("Needs: 1 Interior"), as the snake room does (`DraftGame.needs`). Also add a needs game mid-waivers to a fixture, so the
waivers page's "Needs: 1 Deck · Out · Ep 5" is seen once at 390. [S · cast]

### Design rounds from the explorer's Designs needed

Each is one round through the design process, ending in a screenshot story and a pause.

**139. Answers that settle.** DN-2, 17 and 7 together: season-long and whole-game answers once they settle (a Season calls block,
the finale reveal leading with who won, a knocked-out player's answers). Then 14 (parlays), 15 (multipliers), 12 (bounties), 13
(teams' own standings), 20 (the weekly card's words), 4 (when only some moments count) and 8 (large stakes). [L · game page]

**140. Waivers.** DN-31 (what you're still owed), 32 (what a held week is doing, and Backstage on an own-pace game with exclusive
teams) and 41 (a swap open beside the replacement; a carried lineup's empty slot). A week with nobody free says so instead of
"Any swaps this week?". [M · waivers]

**141. A game in stages.** DN-33 (what each stage gave each seat, a waiting stage that says "Starts at the merge", the next
stage's draft opening) and DN-40 (head to head in stages: your record in the current stage, the next opponent, the overall by
places). Also P0's product findings that Round 5 didn't cover, on the `preview` branch: Tonight and the Merged stage saying SET
before its draft, Your moves tabs for a waiting stage, and a later stage's team sized to who's left. After `preview` merges.
[L · game page]

### Start a game

**142. Gallery bases in each show's own words.** Build each base's plain line from the show's rulebook (its moments, its groups,
its way out), not a noun swap of Survivor's. Check on Below Deck 13, The Traitors and a sport. Done when no base on a
non-Survivor show mentions tribes, Tribal or castaways. [M · wizard]

**143. Start a game and title card polish.** The Start bar stays one line when someone's behind (the lock's name and the fix,
with the cost a tap away). The step line truncates on long sports names. The show bar's faint backdrop title doesn't run under
Home. The bold pass's six craft issues still open (wizard-r2b-critique.md) are fixed, and its three unshot situations (MLB, a
slate week, a behind starter) are shot. On the title card: Start's toast stays off the title, the setup sentence stays until the
first result, and the week block's seven type sizes come onto DESIGN.md's ramp. One Impeccable pass, checked at 390. [M · wizard]

**144. Made-for games: what's left.** Check each hook against its spec at make time (lives, length, what scores), and drop or
rewrite one that disagrees. Make a season's library by itself after its setup research (one queued desk run), not only from the
desk's button. Then a sport's season. Done when a newly set-up season has a library without a tap. [M · wizard]

### Sports

**222. A game the daily job misses for three days is never read again.** The daily job reads a linked game only from three days
back (matchup.ts `refreshSportsEvents`), so a game whose day the job skipped for three days (the bot VM down over a long
weekend) stays "to play" for good, and its slate week never completes. Read every linked game that's started and isn't final,
however old, within the run's caps. Found in Phase 0; with [PLAN-sports-ready.md](PLAN-sports-ready.md) step 1.1 and 184's
backstop. [S · sports]

**75. A sport's game speaks in a show's words.** How it plays ("contestant", "Before each episode"), the grid's caption, the
lineup sheet ("Airtime does", "Airs Sun"), the server's refusals ("active castaways") and stats shown as keys ("2 a 2PT"). Across
src/new and the push copy (db/push-core.js, db/reminders.js), any literal "Episode" should read `show.words`. The show bar says
"2026", not "S2026", for a season numbered by year. Done when generated NFL, golf and tennis games read with no show words. Most
of this needs no design, so it can go before Sports in full. Part of [PLAN-sports-ready.md](PLAN-sports-ready.md), step 4.0. [M · sports]

**100. A sport's episode page reads as a show's.** EpisodeBody shows an empty Out and "Nobody went home". For a sport, it should
lead with the game: the score (behind Hide scores), the box score's best, and "game" rather than "episode". Designed in Sports in
full (PLANS.md). Part of [PLAN-sports-ready.md](PLAN-sports-ready.md), step 4.2, page 3. [M · sports]

**43. First run finds teams and leagues, not only shows.** first-run.tsx searches shows only, while Add a show already offers
teams and leagues (`useTeamSearch`, `SportsResults`). Give first run the same, so "Giants" offers the team. Part of [PLAN-sports-ready.md](PLAN-sports-ready.md), step 4.1. [S · sports]

### Research and the desk

**92. Backstage says "All clear" above "Results · Episode 8 · 5 waiting".** Needs you lists waiting results only for episodes
not yet final, but the Results row counts them on a final one too (backstage.ts L384-412, show-pages.tsx `resultsLine`). Look at
what those rows are on a backup. List them as a job if they still need someone, or stop counting leftovers that can't change a
score. [S · desk]

**146. What cast research got wrong.** Store the billed name without a quoted nickname, keeping the nickname as an alias for
matching, and show the nickname first only when the show bills them that way. Show one row per person on the desk's cast review
when details and bio both change. Watch for a property that comes back blank on the first ask. [S · research]

**147. Research asks for a "rules note" every episode, and only classic shows it.** `rulesNote` (db/episode-research.js:152,
db/bot-research.js:1063) is read only by classic's rule-changes route. Compare Survivor 51's stored notes with F2's format section
for the same episodes. If the section covers them, drop rulesNote from the schema and prompt; if not, show it on the desk's
rulebook page beside Check for changes. A prompt change is the user's OK. [S · research]

**148. Adding a show from the listings lands on an archived show.** `add-show.ts showForListing` should skip `archived` rows, as
adding by name does. Add a case to check-desk-shows.js. [S · desk]

**149. A premiere gets no bingo squares.** The bot's bingo run for a premiere is timed a day before it airs, but `planRuns` only
plans for seasons already airing (bot-research.js:897), so a premiere's card is empty unless someone ran Write squares now. Let
planRuns include a season whose first episode airs within the run's lead time. [S · research]

### Notifications

**150. A sheet's open answers get no reminder.** Move the rule for which questions are open (answers.ts `gameQuestions`) into a
plain module that both the server and db/reminders.js can load. Then remind about a sheet's open questions as for a lineup, 24
and 2 hours before its lock, with a unit test on the job's due list. [M · notifications]

### Cleanup

**24. Remove the wiki read's leftovers.** db/wiki-sync.js has no callers, and the formats' `wiki` sections feed only it and the
regression harness's "wiki validate". Delete them (check `roles` first), along with the `wikiReview` notification type
(moments.js:35). Done when rulebook-golden and the unit suite pass unchanged. The wiki tables go with step C (45). [M · cleanup]

**36. Remove the test couch's backend.** Nothing has reached it since 2026-10-31: /api/test-couch, test-couch.ts,
test-players.ts, the engine lab's "your test couch", the desk's test-couch marks and Act as's `from: "test-couch"`. Keep
src/lib/game/shadow.ts. Drop the tables later, in a deploy of their own, after a backup. [M · cleanup]

### Docs and tooling

**151. Regenerate CORE-GAME-CATALOG.md from the new gallery.** scripts/core-game-catalog.js reads the retired wizard's library.
Teach it src/lib/game/start-gallery, then regenerate. In the same pass, fix GAME-PIECES.md's stale lines: a parlay on a split pot
plays since 8efea239, "Planned: what track C adds" becomes "What track C added", and lineup slots (`count.slots`) get described.
tests/game-pieces-doc.test.js keeps passing. [S · docs]

**152. Triage the GPT plan's Noticed lists once.** PLAN-start-a-game-gpt.md's many Noticed lists are history now. Move anything
still true and still wanted here, then mark the sections as history. [M · docs]

**153. An index for docs/design-round.** A README with one row per round (its status and commit, its story, and the paper still
worth reading), noting that the papers' open questions were answered in decisions.md. This is the "living board"
DESIGN-ROUND-PACKET.md promised. [S · docs]

**154. HOSTING.md is behind.** Add changelog entries for the 2026-11-19 wizard merge (saved games, the practice leagues deleted,
computer players in every game, E2's reads) and for episode night (the lock-in route, no new table). Mark the cast-props entry
live. Remove "no screen calls it yet" from the by-team and slate sections. Drop the practice couch's description. Make the Neon
plan the same in the stack table, the Limits table and Cost by size. [S · docs]

---

## Waiting on you

Each one names the question and Claude's recommendation. "Yes to all the recommendations" is a fine answer; Claude records it
and builds.

### Soon: these unblock work that's ready

- **155. The game preview's Round 5.** Branch `preview` (17 commits, 55 behind master, about 11 conflict hunks) holds P0, the
  visual story, the bench's preview maker and Round 5's four real-app fixes. Approve Round 5? *Recommended: yes, after a
  screenshot story rendered on the branch rebased onto master, so it shows look C's strip. Then merge, not on a Wednesday.*
- **156. The local game writer: merge it, and which way on?** Branch `writer` (10 commits, docs and dev scripts only) merges
  cleanly. W4 found that a tuned 0.8B model is fast enough for a free VM, but right only about half the time when sure; no model
  reached the 95% bar. *Recommended: merge it, then way 3: the words reader (100% right when sure) plus "Did you mean", with the
  bot keeping the rest, so no server needs hosting.*
- **52. The top scorer's twist at your own pace.** The first seat to play chooses before the others have played the deciding
  episode. Always play the fallback in an own-pace game, or wait until every seat has played? *Recommended: always the
  fallback. It's what the code's own comment intends, and it adds no waiting state.*
- **157. Backstage's lock row: three named states.** For an episode that has started: open to whoever hasn't watched (the
  game's rule), open to everyone, or locked for everyone (which stores `ep.lineupsLocked`). The row also says when someone has
  locked themselves in. *Recommended: yes.*
- **158. Episode night's two open questions.** Q3: on a night with one live game and one strict, does the strip speak for the
  open game and leave the locked one to its tab? *Recommended: yes.* Q4: past four season games, does each Games tab card shrink
  to your place, the gap and the move, with the leaderboard a tap away? *Recommended: yes when a couch reaches five; measure
  with night-fixture.js `--extra=6`.*
- **159. Every door into the reveal asks "Watched all of Episode N?" first.** Tonight's progress control and Up next ask. The
  dock's "Reveal Episode N first", Episodes' hidden rows, the solo pool and Chat's fold don't. The user put this on hold on
  2026-11-02. *Recommended: pick it up: one WatchedSheet in the signed-in layout that those doors go through, built with 122's
  Chat fold line.*
- **94. How "pick as many as you think" scores.** The engine has neither a pair answer nor a pick-many answer (the redo plan's
  E3, then Guess who hooks up, 112). *Recommended: right picks score and wrong ones cost the same, so picking everyone can't win;
  "nobody" is an allowed answer.*
- **160. Stages that take turns all season (s45).** Bingo one episode, a draft the next, repeating. A `turns` piece, or more
  stages? *Recommended: the turns piece. A league per episode is the slow path E2 just removed.*
- **161. Randomize in the new wizard.** "Surprise me" opens a random base with its defaults: no twists, no locks, no Roll
  again. *Recommended: yes, small. Surprise me rolls a whole game with `rollSpec` and offers Roll again; locks wait until someone
  asks.*
- **162. Short games: rankings, telling the couch, a person's record.** *Recommended: short games count toward the record but
  not Power rankings or best finish; only the night's first short game tells the couch; and the record against one person (the
  archive's `RecordRow`, a dead end today) opens later, as a door to the games you both played.*
- **163. Finished games on a castaway's sheet.** Since B3 the sheet and the Cast tab show only running games. *Recommended: an
  "Earlier games" fold that reads the archive a page at a time.*
- **164. A drafted Weekly Lineup starts with replacements on.** Today the presets start with none (schema.js `NO_WAIVERS`).
  *Recommended: yes, "Whenever one goes home". Joanna won't find Backstage, and classic did this.*
- **165. An empty starting slot fills from the bench by itself.** When a starter goes home and the seat doesn't change their
  lineup. *Recommended: yes, as a game setting that starts on (the bench in draft order, then anyone still in), and the reveal
  says "filled for you".*
- **166. Whoever runs a game can set a missing move for someone.** A lineup or a pool pick, from Backstage › Members, as waivers'
  Pick for them does. *Recommended: yes for a Game admin, logged in Recent changes, never showing their picks back.*
- **1. Where a late joiner starts in an Outlast.** They draft only from who's still in, so they skip everyone else's early
  losses, and the new design shows a join at once. *Recommended: on the game's lowest score at their start episode, then scoring
  normally. Measure the effect first with a late seat in the explorer's Outlast case.*
- **167. Whose points the show's own views use.** The show's stats read whichever game's rulebook copy the server picks
  (season-stats.ts `seasonFactsFor`), so one couch's custom points can colour the Players tab. *Recommended: always the season's
  rulebook for the show, and each game's own copy only in that game's rows.*
- **168. "Who decides results" no longer changes anything.** Every desk accept locks, and a locked result reaches every game
  either way, yet Setup still offers the choice and the episode page says "nothing reaches the games until you accept it".
  *Recommended: fold it into one behaviour, keep "sources that agree", and fix the two lines.*
- **169. The drill pass: the Compare flow, the order, and a game's points on a castaway's sheet.** *Recommended: when a sheet is
  opened from a game, its head carries that game's points and place in one line; then the castaway sheet's one header (135);
  hold the Compare change until someone misses it.*
- **170. Cast properties' two assumed choices.** Does Below Deck's crew list the Bridge first? *Recommended: yes.* Does the
  sheet credit where its facts came from? *Recommended: no, keep it clean.*
- **171. The gallery's icons.** The tiles use vector pictograms (gallery-bold/icons.tsx). *Recommended: keep them, and
  regenerate only if the image server works again (107).*
- **106. DESIGN.md's type ramp.** It leaves out 14 px (483 uses), 12 (114), 17 (106) and 20 (65), so Impeccable flags them.
  *Recommended: name them in the ramp with a role each. Moving 768 uses would change the look everywhere for nothing.*
- **38. The tour's network key art.** The welcome's three posters are network key art in a public repo with no confirmed rights
  (PRODUCT.md:72). *Recommended: swap them for the player's own shows' art, falling back to the art-less placeholder.*
- **172. A shuffled bank of questions (C9), its rules.** Decided 2026-11-19 on the `writer` branch only. *Recommended: a deck
  (no line again until the bank is used up), out `CARD_OUT_HOURS` before the episode like the bot's, no peeking or rerolling,
  and one bank may mix answer kinds.*
- **173. Rename the "Secret Traitors" base.** It shares The Traitors' name. *Recommended: yes, to a name for the mechanic, such
  as "The mole".*
- **174. The explorer's coverage ledger.** It has never held a record. *Recommended: retire the ledger workflow (the design
  rounds' stories and decisions.md are the review record), keep the matrix for finding specimens, and rebuild its specimens from
  the Start a game gallery.*
- **175. Sports in full: its own round, or inside the design sweep?** *Recommended: its own round, as
  [PLAN-sports-ready.md](PLAN-sports-ready.md)'s Phase 4, ahead of the stages round (141), once that plan's Phase 1 is in.*
- **176. Try Start a game on three people who've never seen it.** Two tasks each (a named game and a vague one), on a phone,
  before the next wizard change. *The user picks the people.*

### Sports: the calls [PLAN-sports-ready.md](PLAN-sports-ready.md) needs

- **212. The target, and the couch's first real sports game.** *Recommended: the NFL first, the NBA and NHL next, MLB by its
  Opening Day (late March 2027). The pilot is one of January's NFL playoffs, played by the couch once the plan's Phase 3 (a whole
  recorded season replayed with zero disagreements) passes. A season-long NFL league waits for next September.*
- **213. The NFL's default lock.** Today every lineup locks at Thursday's kickoff. *Recommended: lock each player at his own
  game's start, as every fantasy app does (built, `closes: 'game'`); a lock by the week stays an option.*
- **214. Fantasy playoffs end by Week 17.** *Recommended: yes, so nobody's title rides on Week 18's rested starters.* Phase 0
  found the default has no playoffs at all (the standings after Week 18 decide it), and a final at the end always lands in Week
  18; check-nfl-playoff-weeks.js asserts the recommendation.
- **215. Sports results every hour.** Sports scores reach the standings once a day, when the bot VM calls. *Recommended: a sports
  refresh in the existing hourly GitHub job (free on the public repo; no new Neon wake-up), more often only right after a game
  ends, with BACKLOG 184's Vercel cron as the backstop.*
- **216. Does a sport get a reveal by default?** Today a sport shows results straight away and has no reveal. *Recommended: keep
  that, and give anyone who turns on "Sports scores too" the reveal; the design round's page 3 designs it.*
- **217. What's pushed when a sports game or matchup ends?** Nothing is today. *Recommended: one push when your matchup is
  decided ("You beat Andrew 112–98"), worded without the score for anyone hiding sports scores, and nothing for each game.*
- **218. Can a sports season game run at your own pace?** *Recommended: not now. Sports season games are live; a past game is
  watched with "Watch it as if live", and own pace for sports waits until someone asks.*
- **219. A daily sport's waivers: daily or weekly?** *Recommended: daily for the NBA, NHL and MLB (claims clear each morning, as
  Yahoo's do), weekly for the NFL.*

### When we get there: plan-level calls

- **45. When to remove the classic app (the new design's step C).** Classic still ships: its pages, Settings › "Back to the
  classic design", and the classic league routes. One of them, `GET /api/leagues/{id}/state`, hands any member the whole league
  (every result and others' open side-bet guesses), whatever their mark. Waiting on step C: that route, rulebooks phase 9, the
  wiki tables and What's New's popup. *Recommended: after Survivor 51's finale, in two deploys, never on a Wednesday. First count
  the accounts still on classic.*
- **177. S3: Survivor 51 off the built-in reader.** Points come from rulebook v3, but research still reads through the built-in
  Survivor reader (`BUILT_IN_READERS`). *Recommended: switch after the finale, proven on the shadow leagues and golden replays,
  then delete the built-in readers and run Survivor 52 on research alone.*
- **178. R3: the old type code goes.** `LEAGUE_TYPES` is in 8 files and `getLeagueType` in 53. *Recommended: yes, one
  engine-lane session scoped to the new app's readers; classic's files keep it until step C.*
- **179. A15: live calls on the episode's clock.** *Recommended: the next design round after E3, on the 2026-11-08 answers,
  without a fresh concept session.*
- **180. The format-change defaults.** Side drafts, next-stage fallbacks, votes on a change, void when research is unsure: the
  lanes built recommended defaults (F1–F4's and A10–A12's Noticed). *Recommended: accept them as built, and revisit one when a
  real game meets that change.*
- **181. Which rule a preset meets.** *Recommended: close it as (a): every game, a ready-made one included, meets the same check
  as a typed one, which the built wizard already does.*
- **182. What a season with no admin trusts.** Before any bot-only season has real players. *Recommended: the tie-break run on
  for seasons that aren't the admin's; sources counted by couch, not person; who left taken from the quick check unless a
  tie-break overrules it; the bot asking in a fresh chat each time; the desk able to withdraw a bot answer. Measure each rule on
  the season tapes first (PLAYTEST-REPORT findings 2, 3, 6 and 22).*

### Accounts and hosting (only the user can do these)

- **107. The image server's key.** The nano-banana server starts with the literal text `${GEMINI_API_KEY}` (confirmed
  2026-11-19), and the Google account behind the key has an unpaid balance. *Settle the billing, then set GEMINI_API_KEY as a
  Windows user environment variable, so Claude Code expands it at launch.*
- **183. Rotate the Neon password.** Unrotated since it was pasted into a chat on 2026-10-18. *Recommended: yes, any day but a
  Wednesday, following HOSTING.md's steps (Neon, Vercel, the Actions secret, redeploy).*
- **184. A Vercel daily cron as a backstop for the listings job.** There's no `vercel.json`, so TV listings move only when the
  bot's VM calls. *Recommended: yes (Hobby allows a daily cron; about 0.6 CU-hours a month), noted in HOSTING.md.*
- **16. The bot's fallback on the PC.** Production asks the VM first, then bot-home (the PC), but the PC's bot isn't a startup
  task and its tunnel isn't kept running. *Recommended: drop the PC fallback, keep the VM, add a second free VM if episode nights
  back up, and make HOSTING.md say what's running.*
- **185. Account recovery, Google sign-in and the tie-break run.** Username accounts have no email, Continue with Google is
  built but off, and the desk's tie-break run is off. *Recommended: leave all three until a second couch; make the Google OAuth
  client before strangers sign up. The desk's Reset password covers the couch.*
- **186. Housekeeping.** Drop the paused ghost-faces stash (`stash@{0}`, moot since the ghost account went). Delete four local
  branches whose changes are on master: check-fix, docs-fix, fix-status-plate-dst, merge-engine. Prune the worktrees of merged
  lanes by hand, never with node_modules junctioned to main (the memory "Junctioned worktree + next"). *Recommended: yes.*

---

## Tracked in a plan

Kept here so their numbers still lead somewhere.
- **84.** A head-to-head game in stages ranks its overall by places (the user's call, 2026-11-14): the redo plan's E3.
- **112.** A new game type, Guess who hooks up (formerly the second 92): the redo plan's E3, after 94's answer kinds.
- **113.** AI access and money: free, the do-it-yourself link, paid, and ads (formerly the second 93): tabled by the user,
  2026-11-16, in [PLAN-ai-access.md](PLAN-ai-access.md).
- **114.** Sports data beyond ESPN (formerly 9 in the old design section): PLAN-sports-data.md step 5, when a gap shows.
- **32.** Watch-along sync by microphone: an idea that waits on A15 (179).

---

## Ideas (not planned)

Kept so they aren't lost. Each waits for a reason to pick it up.
- **5.** Email reminders for players without push (Resend, once per episode). First count how many have no push.
- **6.** Survivor's default points for "learned of an idol/advantage" (0 today). After the finale, compare the bot's answers with
  the recaps.
- **7.** Check Survivor's exclusive-draft points with mock drafts, as Traitors' ownership.py did.
- **11.** Cache show art in the installed app (a cache-first rule in public/sw.js for posters).
- **15, 17, 18, 19.** Research re-ask edges: the episodes after a gap that Try again filled aren't asked again (15); an episode
  is asked questions from later rule changes (17); a rulebook edit records the whole points block, so a later base fix is undone
  from the edit on (18); re-asking's plate cuts off at 390, and a re-ask during a run misses the new question (19).
- **21.** Session loop guards: a pid lock so one worktree can't run two loops.
- **22.** What's New in the new design. Paused by the user since 2026-10-27; classic's popup goes with step C.
- **27.** View as: about 35 server reads (couch chat's moderator, a couch owner's rights) still answer as the admin.
- **33.** Pick games' sheets over time: a Survival Pool's sheet stepping through episodes as Weekly Lineup's does.
- **90.** A sport's draft ranked by projections (find a source first; never ChatGPT for stats).
- **93.** A public library of games people made. The gallery's "Community and saved" leaves its place.
- **97.** A scan for near-twin components (tabled by the user, 2026-11-17): each pair goes to the user, never merged
  automatically.
- **187.** Desk leftovers, fixed when the file is next touched: results-ways.ts using desk-bot.ts `scheduleOf`;
  episode-results.ts no longer querying `rulings`; "in your games" for a ruling kept in only some games; the final push saying
  what changed since the early results.
- **188.** Show names by one rule: dropping "(US)" and "The" the same way in where.ts, start-game.ts and the labels.
- **189.** A show someone only follows: each new episode's "what happened" fills by itself, and a push when an episode ends for
  someone keeping up live.
- **190.** Points changes that start from an episode, and scoring presets. Park until a couch asks.
- **191.** "Extend a day" on a waiver week.
- **192.** Couch records: Called it most, and Biggest comeback.
- **193.** Episode games and bingo: trivia graded per answer on the server; a bingo square marked "It didn't happen"; a flag's
  reason; "Keep it anyway" for a square two people flagged; "didn't notice" stored with the card, not the phone; the writer
  leaning on this show's own recent finales.
- **194.** First run's picks surviving an emailed link opened on another phone.
- **195.** Polish lists for watch along, TV listings, streaming drops and notifications, in PLAN-new-design.md's Noticed
  (archived as history): take one when its area is next touched.
- **196.** Studio, a light theme with personality, as its own design round. Not until someone asks for light.
- **197.** Desktop layouts, the desk first.
- **198.** "Tick all" for held results in Backstage.
- **199.** A schema tidy for the next migration that's going out anyway: `season_air_dates` refuses writes; drop the unread
  `cast_stats` and `user_settings.share_ratings`.
- **200.** When research names someone who isn't in the cast (a mid-season arrival), the desk's Inbox gets an item to add them.
- **201.** Public show pages for signed-out visitors, as a way in.
- **202.** Telling a league when a rulebook fix changes past scores ("Immunity is worth 3 now, from Episode 1").
- **203.** A move set while its episode is on air says so on the couch's view ("Set during the airing, 8:41 PM").
- **204.** A long season's charts by the show's rounds (Big Brother's weeks), with the first such show.
- **205.** An effort tag on each gallery base ("Draft once, then watch"), if the blind test (176) shows people pick by effort.
- **206.** A player's dispute ("Something's wrong") landing in the desk's Inbox. Revisit with a second couch.
- **207.** Talk-show and live-event kinds, and the watch-party wants (reactions at a timestamp, keep the screen awake).
- **208.** Own-pace edges: head to head's order counts a waiting matchup its W–L leaves out; a pool with lives closes joining at
  the first person out; the finish plate's "Start another".
- **209.** Sports edges: a lineup that locks game by game reads its own timed log (`lineupAt`, state-logic.js:4498) and
  still counts someone let go mid-week (69's residual; PLAN-sports-ready.md step 1.6); a traded player stays on his old team (step 1.4); "coming in" is one ESPN call a player; two-way players'
  other lines; AFL's hold-back; college scoreboards; bot-filled people never merged with ESPN's; a daily sport's waivers daily
  or weekly (now BACKLOG 219); golf, races and fight cards found from Add a show.
- **210.** Research edges: results for a show nobody plays are bot-only; a repeatable What scores check against the real bot; a
  commissioner's What scores saving a later moment into the copy's base; another couch's "Looks right to us" after a maker's
  edit; the quick check using the rulebook's research checks.
- **211.** Cast properties edges: an auction and a late joiner's pick ignore a team's needs; "promoted" or "demoted" for a job
  change.

---

## Decided against

Don't re-propose these without new information.
- **An AI draft, lineup or pick advisor for players ("Coach").** Pay-to-win inside a friend group, and a live-research advisor
  on an airing season risks leaking a real result dressed up as a lean. Any "skip the effort" feature for players stays
  retrospective (recaps, shareable cards), never touching a decision in progress.
- **"Survived the episode" points.** Everyone earns it, so there's little signal.
- **"Made the merge" and "made the jury" points.** Skipped.
- **"Vote cancelled by an idol" (−0.5), "Shot in the Dark played and safe" (+1), "played an idol for someone else" (+1).**
  Offered, not chosen.
- **"Each vote against you."** It clashes with "+1 survived votes".
- **Chat in spoiler protection.** Someone reading chat is choosing to risk spoilers.
- **Tags on chat messages saying which game they're about.** One conversation, no tags.

(Three entries were removed in the cleanup because later work overturned them: the notification bell was built 2026-10-26;
the guided tour became the first-time tour; and confessionals and blindsides are now offered as moments, since research no
longer depends on the wiki.)

---

## Closed since the cleanup

One line each: the number, done or dropped, and the commit or the reason.
- **145** done (bc1bf8a3, branch sports-phase0, migration 0308): two players who share a name are two people, kept, drafted,
  scored and locked apart; check-sports-same-names.js. Showing the team beside a repeated name moved to the plan's Phase 4.0.
- **220** done (bb35bea6, branch sports-phase0): a sport's people are approved as they're filled and go into every game on the
  season; check-sports-new-players.js.
- **221** done (bb35bea6): a roster's position is ESPN's abbreviation, so football's slots take real players;
  check-nfl-defenses.js's BACKLOG 221 lines.
