# Backlog

What's open, newest thinking first. **Decided against** and **done** are kept below so a later
session doesn't re-propose them. Context for everything here is in `docs/HANDOFF.md`.

Last updated 2026-10-27.

## Open: needs design or a decision first

1. ~~**Members joining a started league**~~ **Built 2026-10-11 as late joiners** (`docs/PLAN-late-joiners.md`);
   the notes below are kept for history. **Deferred (user, 2026-10-11): Classic fairness.**
   Classic scores how far each pick lasts, and a late joiner drafts only from who's still in, so they
   can't hold an early boot and tend to out-score day-one drafters once a commissioner adds them. Not
   urgent: late joiners are hidden (ghosts) by default. Options in `docs/PLAN-late-joiners.md`.
   History (from feedback #10/#31): before this, they just appeared in standings, and after a commissioner "activates" them there's no defined path.
   - Can an activated member draft? Should there be a starting-points adjustment?
   - Should it vary by league type or ownership (Classic draft / Active Roster / Eliminator Pool;
     shared vs exclusive)?
   - Possibly a commissioner-set starting score.
   - Brainstorm before building. It's also an onboarding problem: a late joiner should always have a
     clear next step in the action bar.
2. **"How this league works" cards.** A dismissible card per league type on Overview (rules, what
   scores, when lineups lock), reachable again from a "?". Proposed as the answer to "people don't
   know what to do" without a guided tour.
3. **"You're all set" confirmation.** The user's idea: a green bar saying "you're all set" that
   disappears after 5 seconds, shown when nothing is due. They asked to test the app first before
   deciding. Pairs with #2.
4. **Combined leaderboard across linked leagues.** One standings view across the three linked
   leagues (a "decathlon"). Offered, not decided.
5. **Email reminders as a fallback** for players without push. Reuse `db/reminders.js` and the app's
   existing Resend email; same once-per-episode rule. Only worth it if reminders prove valuable.
6. **"Learned about someone's idol/advantage" points.** It's tracked at 0 now. After a few
   researched episodes, compare research's answers with the episodes in Admin's review. Then 0.5 if
   reliable, 0.25 if mixed, or keep at 0. Avoid ≥1 unless very accurate.
7. **Test Survivor's shared vs exclusive values.** Traitors' split was tested with mock exclusive
   leagues (`docs/RESEARCH-traitors-scoring-values.md` §3.7: owning the winner decided 80% of
   leagues, 70% after the split). Survivor's split was reasoned, never tested. Not a quick retrofit:
   the Survivor study ran on the survivoR spreadsheet with scripts that weren't kept, so it needs that
   event mapping rebuilt first (`docs/RESEARCH-scoring-values.md` §2 and §9 describe it). The
   Traitors `ownership.py` shows the mock-draft method to copy.
8. **Local dev DB repair** (see HANDOFF): re-apply 0017–0024 (minus 0016/0023, which need
   pgvector), then 0033–0040. Needs the user's go-ahead.

9. **Sports data beyond ESPN** (2026-10-27; docs/PLAN-sports-data.md). The first build is ESPN only. Add these behind the same
   provider interface when a gap shows, each checked live already (the plan's table has the details):
   - MLB Stats API (no key): every minor-league level, plus KBO and NPB, with headshots. ESPN has no minor-league baseball.
   - NHL's API (no key; not probed yet); the AHL (ESPN doesn't have it; no free source found yet).
   - The Premier League's fantasy API (no key): its players' official headshots (ESPN's soccer has few; Wikipedia covers most meanwhile).
   - OpenLigaDB (no key): German soccer backup. Jolpica / OpenF1 (no key): F1.
   - With a second source: the chain's tests (the plan's 1b: a roster holding the players its box scores show, and so on), remembering
     the winner per league (`sports_picks`), and a circuit breaker for a source that's down or rate limited.
   - Only if a test keeps failing (free signups): CricketData, football-data.org. Not used: TheSportsDB (free team lists stop at 10
     players), API-Sports (free is old seasons only), FotMob (didn't answer).

10. **Games over a span: what's still open** (2026-10-27; docs/PLAN-sports-data.md step 6, its As built and follow-up). Planned
    since 2026-10-27 as step A3 of docs/PLAN-start-a-game-gpt.md (a later start, and the rest of this list). Built: a
    game from the next episode through a chosen one, Run it back on the next span, plaques that name it, and its end in Game
    settings. Open:
   - **Moving its start.** Only the end moves (Game settings' How long). A start that moves before its first episode airs would
     cover "post-merge" or "just the playoffs" without waiting to start the game then.
   - **Side bets after the end.** One proposed after a span's last episode goes on a later episode and never pays
     (`BetLogic.addToUpcoming`): it should be refused, or not offered.
   - **One word for an episode.** The start sheet says the rulebook's (`partWord`), the hub, plaques and Game settings the
     show's (`episode_term`). They agree on every show today; a rulebook saying "event" for a show saying "Game" would read both.
   - **Run it back's "same length again" counts episodes, not nights**: a span over a double-header night is two.
   - **Places that don't know the end yet:** the classic app's catch-up reveal (`RevealLogic.isComplete`, `revealNext`),
     Backstage's open episodes (`backstage.ts` `takes`), and How it works' updates (they say only where a game starts).

32. **Watch-along sync by microphone (an idea, not planned: the user, 2026-10-30).** Passive sync for watching together:
    live watchers opt in to the microphone and their audio becomes the baseline; everyone watching later syncs to it
    automatically, the mic listening until the episode's set length ends. Only a small signature is stored, never audio (a
    sparse audio fingerprint, roughly 15-60 KB per hour of broadcast, once per episode; nothing per viewer). Anchored to the
    live broadcast's clock, so a later viewer sees what the couch did up to the same moment, and ads simply don't match.
    Known limits: a web app's microphone stops when the phone locks or the app is in the background (true background
    listening needs a native app); headphones leave nothing to hear (fall back to "tap the last moment you saw"); it must be
    opt-in, show that it's listening, and get a legal check on consent before launch. **When:** if the user picks it up, with
    the watch along (A15 in docs/PLAN-start-a-game-gpt.md); its first step would be a test with two phones on one clip.

## Open: small or polish

8. **League swipe tuning.** Everything is a constant at the top of `league-swipe.tsx`: DEAD_ZONE
   18px, GAP 32px, EDGE 28px, settle at 30% of the width or a flick. Watch for jank on older phones,
   since both neighbours' pages are pre-rendered. The fallback idea was a lighter peek (name + first
   card).
9. **Notification test copy** in `push-core.js` `sample` messages: review the wording when there's a
   moment.
10. **Predictions lock?** A player asked whether predictions should close when the episode starts.
    The user decided to keep them open for now ("a bit of nuance in what should be allowed").
    Revisit if it causes disputes.
11. **Keep show art and cast photos for the installed app (added 2026-10-26).** Today the browser's own cache holds them:
    TMDB and TVmaze send a year's `max-age`; Wikimedia sends none, only ETag/Last-Modified, so browsers recheck it cheaply.
    No service lookups happen on a page load: the finder (`src/lib/server/show-art.ts`) stores URLs once. The gap is the
    installed PWA. Phones evict that cache under storage pressure (iOS readily), and offline nothing shows, because
    `public/sw.js` deliberately caches only the offline page.
    - **The fix:** a cache-first rule in `sw.js` for images from `image.tmdb.org`, `static.tvmaze.com` and
      `upload.wikimedia.org` only, in its own cache with an entry cap (oldest out), and nothing else changed.
    - **The catch:** TMDB sends no CORS header, so its responses are opaque, and Chrome counts each opaque cached response
      as ~7 MB of quota. Keep the cap small (~100), or load those images with `crossOrigin` if TMDB's host allows it
      (check first).
    - **Not localStorage:** text only, ~5 MB.
    - **When:** only if offline start-up with art matters, or players notice posters reloading on start-up.
12. **The phone's back doesn't close an open sheet (noticed 2026-10-27, building the phone's back).** The new design's
    sheets (`src/new/ui/sheet.tsx`, Base UI's Dialog) close on Escape, a scrim tap or a swipe down, but Android's back
    goes to the history: it moves the page underneath, and a sheet mounted in `(in)/layout.tsx` (the couch's, Start a
    game, Rate it…) can stay open over the new page. A native app closes the sheet first.
    - **The fix:** a close watcher while a sheet is open (`new CloseWatcher()`, its `onclose` closing the sheet,
      destroyed when it closes). It's opened by a tap, so it gets a group of its own above the phone's-back watcher
      (`src/components/phone-back.tsx`, which drops its own watcher on that tap anyway). Classic's More sheet already
      closes on back (a history entry, `mobile-nav.tsx`).
    - **Check:** extend `scripts/dev-test/check-phone-back.js`: open a sheet, Escape, the sheet closes and the path stays.
13. ~~**The Cast tab hides a set-up cast until results come in**~~ **Built 2026-10-27:** with nothing counted the Cast tab
    shows the faces (no numbers) and a line; and Fill in what happened now looks up each episode's results too, for a show
    made a game that nobody plays (`src/lib/server/research-asks.ts`, migration 0152; check:
    `scripts/dev-test/check-research-asks.js`).
14. **Making a game drops the cast's starting roles (noticed 2026-10-27, Traitors 5).** The cast answer's `startingRole`
    (the season's two starting Traitors) is parsed by `cast-prompt.js`, but `confirmMake`
    (`src/lib/server/make-game.ts`) writes only name, group and photo, so `season_cast.role` stays null. `toCastRoles`
    exists for a league's import. Decide whether a confirmed starting role belongs on the season's cast (spoiler-guarded
    from episode 1) or should come in as an episode-1 `role` result.
15. **Results looked up one episode at a time: a gap isn't asked around (noticed 2026-10-27, building research asks).** Each
    episode's question lists who's still in by the results so far (`db/episode-research.js` stillInGame). When one episode
    isn't found (two tries, then given up), the next ones still go, so their questions can include someone who actually
    left in the missing one; Try again fills the gap later, but the episodes after it aren't asked again.
    - **The fix, if it shows:** when a given-up episode is filled in by Try again, ask again (merge) the asked episodes
      after it, or hold a season's later asks while one before them is given up. `src/lib/server/research-asks.ts`,
      `db/bot-research.js` planAsks. (Who went home now goes first for every episode, so the questions after a missing
      one usually know who left in it; only one whose who-went-home also failed leaves the gap.)
19. **Looking episodes up again: what step 5 left (noticed 2026-10-27, PLAN-maker-scoring step 5).**
    - **Only the bot's own earlier answers are replaced.** A fact is held back while any answer covering that person didn't
      report it (fact-status.ts settleFact `contradicted`), so a person's pasted answer from before a question was added
      still holds that question's results back (they stay pending). Made games are researched by the bot, so it hasn't
      come up. The fix would be covers that say which questions an answer was asked (touches everyone's settling).
    - **A re-ask while that episode's run is going** keeps the run's mode, and that run's prompt was already built: the new
      question isn't in it. It shows as behind again once the run lands, and Look them up again asks it.
    - **Behind counts only the questions of moments added by hand** (`behindOf`); a missing re-run asks whatever the stored
      answers lack, which can be more.
    - **The roll call's line is cut off at 390** while asked again ("The new question · Our bot picks it up within …"): the
      caption plate is one line. Could drop the stage line when asked again, or let the plate wrap.
    - **The replaced answers' Recent changes lines** (their Undo) do nothing once withdrawn.
18. **A rulebook edit keeps the points block whole (noticed 2026-10-27, PLAN-maker-scoring step 3).** `diffBlocks` records a
    points change as `{ op: "set", block: "points", value: <every moment's points> }`, so a "the show changed" edit from
    Episode N carries a snapshot of all the points: a later fix to the base's points (the desk's, or the maker's) is put
    back to the snapshot from N on. maker-scoring.ts refuses points changes and new moments (409, with why) on a season with
    such an edit; the desk's fix path has the same gap.
    - **The fix:** record points per moment in edits (set and unset by id) and apply them that way, keeping old whole-block
      edits working; then the maker's refusal can go.
17. **A question added from a later episode is asked of earlier ones too (noticed 2026-10-27, PLAN-maker-scoring step 1).**
    Research now asks a season by its rulebook as it is (db/episode-research.js catalogEntry → seasonRulebookFormat), whose
    compiled checklist is every question across its edits (rulebook-patch.js mergeAtEpisode unions them; only the rules
    carry when each starts). So an episode before a "the show changed" edit is asked its new question too; filing ignores
    the answer there (check-maker-scoring.js shows nothing counts), so it costs only a longer question. The maker's edits are
    fixes from the premiere, so only the desk's and the couches' show-changed edits do this.
    - **The fix, if it matters:** compile the blocks at that episode (blocksAt) for the prompt's checklist, cached by
      rulebook version and episode.
16. **The bot's fallback on the PC isn't kept running (noticed 2026-10-27, deploying the bot's progress).** The PC's
    llm-browser-api was started by hand (no scheduled task or startup item, though `deploy/windows-startup.ps1` makes
    one), and `bot-home.gameyourshow.com` has no tunnel running, so production's fallback behind the VM answers nothing.
    - **The fix:** run `deploy/windows-startup.ps1` once on the PC, and start its tunnel (deploy/README.md, "Your PC as
      the fallback"); the user's call, since it keeps their PC busy with the bot.
20. **Members' role line names two games of a kind alike (noticed 2026-10-27, building computer players for anyone).**
    Backstage › Members' `roleLine` (`src/new/backstage/members.tsx`) words each game by `gameName`, so a couch with Outlast
    and Outlast 2 reads "Player in Outlast · Commissioner in Outlast". The Computer players section has the same habit
    (it heads each game by `gameName`).
    - **The fix:** use the game's own name (`name`) when two games here share a `gameName`, as games.tsx's `twin` does.
21. **The session loop: two gaps (noticed 2026-10-28, checking the lanes after a usage reset).**
    - **Nothing stops a second loop in one lane's folder.** When the keeper starts a lane again, it opens a new window,
      and the old one stays open saying "Stopped after N sessions. Run it again to carry on." Running it again there
      starts a second loop on the same worktree and session. The keeper checks first; a person at the old window doesn't.
      The fix: session-loop.js writes `.session-loop/loop.pid` and refuses to start while that process is alive.
    - **The 90% pause is only checked before a session.** A session that's already running carries on to the 5-hour
      limit: on 2026-10-28 both lanes ran the window to 100% at 3:48 PM, so the user's own sessions were blocked until
      5:40. The fix, if that matters while the user works: pause the running session (the loop's own pause) when a
      rate-limit event shows the window past `--pause-at`, and resume it after the reset. Overnight, running to 100% is
      what the user wants.
    - Either reaches a lane only after a sync and a restart of its loop (lanes run their branch's copy).
22. **What's New has no place in the new design (noticed 2026-10-28, approving the desk's step 7).** The popup
    (`whats-new-modal.tsx`) shows only in classic, so once the couch is on the new design a published release reaches
    nobody. The desk's build moves releases into the database and drafts them on the desk (PLAN-desk-parity.md, decision
    8); where a player sees them in the new design is player-facing design work, mocked first.
    - **When:** before What's New's pause ends (the user's call; nothing is announced meanwhile).
23. **Done 2026-10-29: players' lineup, pick and prediction reminders go for every airing season** (the user's call).
    `db/reminders.js` sent them only for seasons with `auto_research` on (paid research's old default), which nothing could
    turn on after step 8, so none went. Now they go for every live airing season, as the commissioners' morning-after
    nudge does, and each person's own "Reminders before an episode" switch still decides. PLAN-desk-parity.md Noticed co.
24. **The formats' `wiki` sections outlived the wiki read (noticed 2026-10-29, the desk's step 8).** `castNote`, the
    episode schema, `derivedEvents`, `rejectEvent` and `roles` are read only by `validateEpisodes` and its regression
    harness now. PLAN-desk-parity.md Noticed cp.
    - **When:** the engine lane, as it moves formats onto specs: clear them out or keep them.
25. **The site's Anthropic key has nothing left to do (2026-10-29, cleaning up after the desk's step 8).** A paste is only
    ever read as JSON now, never by a paid model (`pastedRun`; one that isn't JSON is refused with a clear message): the
    user's rule, since our prompts always answer in JSON and nobody pasting should be able to spend the site's key. The last
    way a paste reached paid Claude was classic admin's "Structured" tick box, which step 8 removed. The paid search
    providers (episode-research.js `PROVIDERS`: anthropic, gemini, grok; `providerFor` defaults to anthropic) are reachable
    only from local scripts. GitHub's `ANTHROPIC_API_KEY` Actions secret was deleted 2026-10-29; there was no
    `GEMINI_API_KEY` on GitHub or Vercel.
    **Done for production 2026-10-29:** the user removed `ANTHROPIC_API_KEY` from Vercel, so nothing deployed holds a paid
    key. The key itself stays active for local research (the user's call), and so do the paid providers, for local scripts
    only.
26. **Small things the app fixes left (noticed 2026-10-29, the desk lane's four fixes, 03e12bdc).**
    - `npx eslint src` has one error: src/components/ui/use-sheet-swipe.ts:36 (from d4bf8730).
    - The research run sheet's "its air time plus 1 hr" names the season's length even when the rail's episode has its own.
    - `results-ways.ts` reads the season's schedule itself rather than desk-bot.ts `scheduleOf`, so it misses an episode's
      own runs and our usual.
    - check-desk-research changes our usual (app-wide) between its "Make this our usual" and the Undo: another check reading
      our usual at that moment would see it.
    - The final-results push's "has seen it" is show_follows' mark or seeing everything, not the guard's full seenThrough
      (keep-up's auto, late joiners); it only picks the push's words and link.
    - The push doesn't say what changed since the early results: the data has that only per Weekly Lineup seat (the morning
      update shows it).
    - Since corrections folded into a closed section (b5766d89), the results API's `rulings` field is read only by checks:
      one `league_rulings` query per episode page open that nothing shows.
    - A house ruling's count and plate say "in your games" for the couch's games as a whole, so one kept in only some of
      them reads as all (the lookup is per decision, not per game). Pre-existing wording.
    - **When:** whichever session next touches sheets, the desk's Research page, results-ways, the push or corrections.
27. **View as: what it doesn't cover yet (noticed 2026-10-29, building View as: src/lib/server/view-as.ts).** A site admin
    viewing as a player or a commissioner loses site admin everywhere (requireSession). As a player, each game reads as a
    member's through requireLeagueRole and show-space.ts `games()` (the home, show spaces, Backstage), which covers what the
    screens draw. About 35 other server reads take a league or couch role straight from the database (couch-chat's
    moderator, a couch owner's rights, couch-joins' "only whoever runs the game answers"), so a few commissioner powers may
    still answer there. It's not a security gap: the lens only takes power away. As a commissioner it's your own role in
    each game, not a commissioner everywhere.
    - Seen while checking it: `GET /api/leagues/<id>/ruleset/shared` answers 500 for any commissioner on the local DB,
      lens or not (check-view-as.js only asks that it isn't refused).
    - **When:** if a player's view shows a commissioner tool, route that read through the lens, then fix the 500.
28. **Survivor 51's games apart (found 2026-10-29; fixed in season-decisions.ts, check-match-season.js).** Switching S51 to
    "Sources that agree" took all of Episodes 1-3 (122 results, decided by hand on classic's admin, no source) out of the
    couch's three games; the test couch's copies kept them (no ledger). Episodes 4-5 were never season results: each game took
    them through classic's per-game "apply research" (src/lib/episode-results.ts, /api/leagues/[id]/episodes/[epId]/research/
    apply), and Weekly Start/Bench's Episode 5 got four more than the other two. Fixed: a result you decided reaches every
    game on either setting; only a game's newest episode is news (no push for an old one coming back); the desk's episode
    page lists games that don't match the season and Make every game match (only kinds the season has settled for the
    episode come out, so a tribe swap research missed stays). Done in production the same evening: Episode 1's Make every
    game match put Episodes 1-3 back; full research for Episodes 4 and 5 (Episode 4 twice); decided on the desk, checked
    against recaps, what the bot missed (Toka's six Episode 4 reward wins as second place, Carter's Episode 4 move to Toka,
    Maggie's Episode 5 journey); Episode 5 matched (38 of the games' own out: Devin's and Lewis's "zero votes", three
    "learned of an advantage", Weekly Start/Bench's four contradictions). All six S51 games the same for Episodes 1-6. Left:
    - "Who decides results" now changes nothing the games get (every desk accept locks, and a locked result reaches them on
      either setting): fold it into one, or give it a meaning. The episode page's "You decide its results: nothing reaches the
      games until you accept it" note and Coming up's "you decide too" line still read as if it did. The user's call.
    - Classic's per-game "apply research" still writes one game only, for a league opened in the classic design: retire it,
      or send it through the season, or games drift apart again.
    - The test couch's games have no ledger (copied wholesale), so a season correction never takes anything back out of them.
    - Make every game match has no Undo (a game's own results aren't kept anywhere): its line in History says what it did.
    - Done 2026-10-29: S51's Episode 3 said Carter moved to Savu (the tribe he left: he started on Savu and joined Toka in
      the accidental mutiny). The desk's Correct now changes a move's group ("Moved to", 0765e8d7, check-correct-group.js),
      and Episode 3 is Carter to Toka in the couch's three games. The test couch's copies still say Savu (no ledger, above).
    - Make every game match compares a tribe move, a role or who went home by person only, not by its value (applyDecision
      calls any move a person already has "already there"): a game whose move names another tribe reads as matching. Compare
      the value too, and take the game's own version out where it differs.
    - The bot misses a second-place tribe's wins (Episode 4's Toka reward, as Episode 6's Savu immunity before) and a journey
      (Episode 5's Maggie); two runs count as one source, so a miss the second run fixes still waits for a second source.
      Worth a line in the full-results prompt about every tribe that won something, first place or not.
    - **When:** the next session on results or the desk; the first is the user's call.

29. **Things the engine merge noticed and left (2026-10-30, the A1-A11 part 5b merge, df527fe6).**
    - `tapes.js load below-deck 12` fails on a database where Below Deck 12 is already set up (a production copy: rfl-merge's):
      the tape's answers are parsed against that season's rulebook, which asks `notableTwist` of every crew member, and the
      tape's first episode leaves it out. The engine lane's database loaded it before that rulebook. Either load parses
      against the tape's own rules, or the rulebook's field is optional. **When:** the playtest lane's next session.
    - `check-questions.js`'s browser half hadn't run since A9 (the engine lane ran its `--api` half): its This week row
      check didn't wait for the Games read (fixed in the merge, 555e6c1e). The engine's other browser checks may want a run
      on a cold dev server too. **When:** the engine lane, at R or U1.
    - **Survivor 51's Episode 7 said Wed 7:00 PM ET** (fixed 2026-10-30, the merge's live check): research of Episode 6 filed
      its start as `20:00-04:00`, daylight time's offset, for a night after the clocks go back (Sunday 2026-11-01), and an exact
      start wins over the season's 8 PM America/New_York, so lineups would have locked an hour early. `Air.exactInZone` now
      reads an offset that is the zone's other one as the announced time in the season's zone (`nextEpisodeFrom`, which the
      full research and the schedule check both file through), both prompts ask for the offset in force on that date, and
      `tests/dst.test.js` covers every schedule edge a clock change touches. In production, the desk's Run now of the
      schedule check refiled it: "Episode 7: Wed, Nov 4, 8:00 PM EST, 90 min"; the hub says Wed 8:00 PM.
    - **Backstage and an episode's results answered 500 for Survivor 51's couch from 2026-10-29 to 10-30** (fixed at the merge's
      live check): Make every game match records a game's own result it took out as `own:<kind>:<id>` (season-decisions.ts),
      and `couchCorrections` read every correction's id as a season decision's uuid. It reads only decision ids now, and such a
      correction offers no ruling to keep (`keepable`); `check-match-season.js` reads both after Make every game match.

30. **check-sheet-back.js hangs about one run in four (noticed 2026-10-30, checking the show's ⋯ menu before its merge).** After
    the hub's guide case ("back again goes where the hub came from": a back to /settings that loads the page in full), its
    `page.close()` never returns, and Playwright's close has no timeout, so the check sits until it's killed. `DEBUG=pw:api`
    shows `page.close started` with nothing after it. It happens on master's code without the menu change too (c10b4258's
    `src/new`), so it's the check or Chromium, not the app; every run that gets past it passes all 27 cases. Close the case's
    page with a timeout (or leave it to `browser.close()` at the end), and look at why the close hangs (a back-forward-cache
    restore? the service worker?). **When:** whoever next runs or extends check-sheet-back.

31. **Desk rows didn't open their sheets on a mouse click from Claude in Chrome (noticed 2026-10-30, setting Survivor 51's
    episode count to 13 in production).** On the desk's season Setup page at desktop width, Episodes and When it airs did
    nothing when clicked (by element and by coordinate, three tries), with no console error; the page was hydrated and the
    row's React onClick was there, and `element.click()` from the page opened the sheet at once (the stepper and Save then
    worked as normal). Sign in's button clicked fine the same way. Either the extension's clicks don't reach `nd-press` rows
    (a gesture layer, phone-back.tsx's edge swipe, or the press style?) or a real desktop mouse can't open them either: try a
    real mouse on the desk first. **When:** the next desk or nd-press change; until then a Chrome session opens a row with
    `document.querySelector('[data-desk-row="<name>"]').click()`.

33. **Things the Games tab's "what everyone's doing" left (noticed 2026-10-30, building it on games-insight; the 2026-10-30
    mock).** (a) A game with group slots (A10) or best ball gets weeks too, but its sheet and episode view show castaways where
    a slot holds a group: the generated game pages (track V) should draw a slot's group. (b) Survival Pool's sheet could step
    through episodes the way Weekly Lineup's does (picks are decided per episode; who's still pickable is public), and
    Outlast's could say what each castaway's points would be if they won. (c) `use-sheet-swipe.ts` has a lint error on master
    (`react-hooks/immutability`, writing the scrim ref's style in `reset`); the sideways-drag guard added here didn't cause it.
    (d) Arriving on Games from a game's line waits for the tab's slide and the tables to settle (about a second and a half),
    since a glide started earlier is cut short; a page that renders its tables at once would land sooner. **When:** (a, b)
    track V's blocks; (c) the next change to that hook; (d) if anyone finds the wait long.

34. **Settings' controls under the floor (noticed 2026-10-31, the /impeccable critique of the Settings redesign mocks).** In
    the app today (`src/new/settings/controls.tsx`, `Btn`): outlined buttons (Edit, Turn on/off) are 40px tall, under the
    44px target; their edge (`outline-input`, Field Line), an unselected radio ring and an off switch's track are 1.2-1.6:1
    against the ground, under WCAG 1.4.11's 3:1 (the knob still shows on/off). **Done in Settings 2026-10-31** (the
    redesign, option D): a Control Edge token (`--edge`: Night #75708a, Studio #7a748a; DESIGN.md), 44px outlined buttons,
    the radio ring and the off switch's track (controls.tsx, shared with a show's Notifications sheet). **Left:** `Btn`'s
    optional tone app-wide is still `outline-input` (40-52px, faint edge on every screen); moving it to `outline-edge` is a
    look change everywhere. **When:** a polish pass over the whole app, checked in Night and Studio.

35. **The welcome page's "Nothing on" is too faint (noticed 2026-10-31, check-new-studio.js while checking the Settings
    redesign).** `src/components/landing/landing-page.tsx` (its TV guide's empty day) colours it `var(--field)`: 1.37:1 on
    Night, 1.89:1 on Studio, under 3:1. It only shows on a day with nothing on, so the check fails some days and not others.
    **When:** the next change to the landing page (muted text instead of the field line).

36. **The test couch's backend is dormant (2026-10-31, the user: delete the test players and the switcher).** Production's test
    couch was removed through its own Remove (`DELETE /api/test-couch`: its 3 games, couch and 4 test players), and Settings' Test
    couch fold and the profile menu's test-player switches are gone, with check-test-couch.js. What's left, unreachable from any
    screen: `/api/test-couch`, `src/lib/server/test-couch.ts` and `test-players.ts`, the `test_couches`/`test_players` tables, the
    engine lab's "your test couch" option (engine-lab.ts), the desk's test-couch marks (desk-couches.ts) and Act as them's
    `from: "test-couch"` (desk-person-actions.ts, `api.actAsTestPlayer`). `src/lib/game/shadow.ts` is shared with the local shadow
    leagues and stays. **When:** step C's cleanup (a migration drops the two tables).

37. **What Couch points left (noticed 2026-10-31, building Couch points and By the numbers' ties).**
    - **Done the same day (the user: yes): the moves kept in a game's state count** (src/lib/game/couch-moves.ts): a pool pick an
      episode, the player's own draft picks (before the draft log, what an exclusive draft gave them), a lineup that's their first
      or brings someone in, at the episode's airtime (never before the game was made: a catch-up game plays old episodes now).
      **Left:** a lineup change that only benches someone isn't told apart from carrying it forward (which only drops people),
      so it doesn't count; a public pool's "Who goes home?" calls (`episodes[].calls`) don't count as moves.
    - **Tonight's Stats card has the same tie** (`src/new/show/stats.tsx` StatsCard and StatRows): Stat of the week takes
      `statBoard(d, key)[0]`, and the short boards number a tie 1, 2, 3. `leadWorthNaming` (couch-standings.ts) is the rule to
      reuse. **When:** the next change to Tonight's stats.
    - **Most-watched show picks one show on a tie** (accoladesOf `watched`); leadWorthNaming could decide it too.
    - **`user_days` isn't in the backup** (like `user_last_seen`): a restore loses who opened the app which days (a point a day).
    - **A day is Eastern's** for the chat cap, the days opened and the year (as desk-couches.ts counts a month); a couch elsewhere
      would want its own zone.
    - **Couch points count what someone did whatever What your couch sees says** (reactions, watch alongs): only totals show,
      never what or when. A private follow is left out (the hub's rule for follows).
    - **Done 2026-11-01 (with the tour's fixes): `tests/watch-along.test.js` failed on master** ("what a reaction may carry"):
      the KLIPY change (1c7cedc1) renamed `giphyUrl` to `gifUrl` and left its test. It calls `gifUrl` now, with a KLIPY host and
      a look-alike one.
    - **check-new-hub's grow note** asked `isVisible` the instant the address changed and failed twice in a row on a busy
      machine; it now waits for the page to slide in.
38. **What the first-time tour left (noticed 2026-10-31, building it on branch `tour`; docs/PLAN-first-time-tour.md).**
    - **Nothing reads `tour_reached` yet** (the furthest step an account got to, kept with `tour_seen_at`): a line on the desk's
      person page, or a count of who skipped where, would say whether the tour's too long. **When:** the next desk people change.
    - **The three show pictures in `public/tour/`** (Survivor, The Traitors, Pluribus) are the site mock's art, with the same
      open question as /mock (PRODUCT.md: network key art has no confirmed usage rights). If that's settled against, the
      examples can take the player's own shows' art (the home read has it) or the art-less placeholder.
    - **Turn on is two colours across the app:** the reminder sheet's and the tour's are the bone ink button (yellow is for what
      you must do), Settings' "this phone" plate is yellow. The tour follows the sheet. **When:** the next reminders change.
    - **new-fixture.js's shows carry art the home read never shows** (it takes the season's `art_url` first, and the fixture's
      seasons have none), so screenshots of the fixture's Home are art-less unless the seasons get it.
    - **A player on several couches** gets the tour on the couch Home opens with; nothing in it says how to switch couches
      (the profile sheet does). Left out on purpose: the simpler the better.
    - **check-new-hub's "and one in the deck, never a tied one" can fail on a cold server** (seen once shipping the tour, on
      a lane's first run; 106 of 106 straight after): it reads By the numbers' deck 700 ms after the accolades list shows, and
      the deck waits for every show's stats read (the skeleton until then). It should wait for `[data-stat-deck]`, or for the
      skeleton to go. **When:** the next change to check-new-hub.
    - **Version 2's practice shows in production:** done 2026-11-01 for The Amazing Race 39 (the desk's New show, then Make it a
      game with the bot); The Challenge has no current season (42 ended 2026-10-28). **When:** its next season, make it a game
      the same way, or the tour skips it.
    - **The Amazing Race 39's make review said "Who's playing · 26 teams"**: they're 26 racers in 13 pairs. The bot's cast says
      `unit: "teams"` while its faces are people, and the pairs aren't grouped (`who.groups` empty), so a Survival Pool or Outlast
      on it picks a racer, not a team. Approved as drafted (the tour's Prediction Sheet doesn't pick racers). **When:** before the
      couch starts a pick game on The Amazing Race, or the next change to the make review (it could notice a unit that doesn't
      match its faces).
    - **The desk's New show keeps the admin as the show's adder** (`shows.created_by`), so its seasons aren't "curated" and first
      run's wall leaves them out (The Amazing Race 39 is one). If a show the desk adds should be on the wall, New show could
      leave `created_by` empty. **When:** the next desk shows change.
    - **The guide's foot takes two lines at 390 since Sports joined its filters** (version 3: Couch · Competitions · All TV ·
      Sports, then Add a show wrapped under them). Fine as it stands; if the foot should stay one line, Add a show could shrink to
      its icon there, or Sports go once sports are added by team (docs/PLAN-sports-add.md). **When:** that plan's UI step.
    - **Left from the tour's critique (2026-11-01, 26/40; PLAN-first-time-tour.md version 3, The critique):**
      - **Keyboard and screen readers can't do the steps with a real tap.** Home is inert under the tour, Tap it only shakes, and
        Enter works only on the tour root. The dismissed welcome card also stays a modal dialog whose buttons can still be tabbed
        to (welcome.tsx:21-28). Fix: Tap it moves focus to the lit thing (un-inert only it) and announces it; the welcome unmounts
        once dismissed. **When:** the user's call ("not a big deal to me" for now).
      - **No resume after a reload or iOS killing the app.** The tour starts over at 1/10 when it's next asked for: keep the step
        in sessionStorage and offer "Pick up at 6/10?".
      - **The solo reveal step lights Up next with no Reveal on it** (the made-up reveal has no card of its own).
      - **The welcome card's "Welcome to" kicker** is banned by the impeccable craft floor; the user approved it in the mock.
      - **Outside the tour:** the reveal's standings reorder has a bounce easing (reveal.tsx:465, "No bounce" in DESIGN.md), and
        Home's 10 px game chips and "Not on your list" tag (hub/sections.tsx:456, :671) are under the 11 px floor.
      - **When:** the next tour change, or the next polish pass on Home and the reveal.
    - **A poster for a premiere weeks away says only its weekday** ("Season 1 · Fri" for HBO's Harry Potter on Dec 25, seen in the
      tour's demo): Your shows' poster takes `day()` of the next episode however far off. A date past a week ("Dec 25") would read
      better, for every show coming back. **When:** the next Your shows change.
    - **Done 2026-11-01: `tests/watch-along.test.js`** (`W.giphyUrl is not a function`): a quick rename after all (item 37).
    - **The guide's week is as tall as its fullest night** (seen 2026-11-01 with the tour check's long shelf: four shows on one
      Monday made every night's column about 700 px, mostly empty, at 390). The tour keeps the guide's filters in sight now
      (PLAN-first-time-tour.md, "Trying it again"); the guide itself could show a night's first few cards and "N more", as All TV
      does. **When:** the next guide change.
    - **The tour's demo leans on two TV listings by id** (HBO's Harry Potter 68803 and Saturday Night Live 361, in tour/plan.ts;
      SNL took the NFL's weekly game's place on 2026-11-01, sports not being set up yet). If TVmaze renumbers, the demo passes
      that show over (its row never comes) and says what it did add. Off its season SNL has no night in the guide that week.
      **When:** SNL's summer break (June to September), see what the guide step shows without it.



39. **Production's log noise at start-up (noticed 2026-11-06, the C2 merge's live look).** Right after the deploy, one fresh
    server instance logged `[Better Auth]: Could not validate the database schema. Check your database connection.` on
    Backstage › Scoring rules: Better Auth's background schema check, run as an instance starts, couldn't reach the
    database at that moment. It blocks nothing (the page loaded fine when opened again, nothing logged). Seen again a minute
    after the next deploy (12:41 PM, Backstage › Results): it looks like every deploy's first instances. If it keeps
    showing up on cold starts, `advanced: { database: { validateSchema: false } }` in `src/lib/auth.ts` skips the check
    (`checksSchema` in @better-auth/core reads it) and saves a database round trip on every cold start. Also at error
    level in the same logs: pg's "SSL modes 'prefer', 'require', and 'verify-ca' are treated as aliases for 'verify-full'"
    warning on each instance's first connection; `sslmode=verify-full` in the connection string silences it (a change to
    the Vercel and GitHub secrets: the user's). For any session: small.

40. **What U1 step 1 left (noticed 2026-11-08, building the generated game page; branch `u1-game-page`).**
    - **Left by U1 step 2b (2026-11-09, the person and cast sheets and the season grid):**
      - **Calls don't keep the minute they were made** (`episode_calls` has no time; `CallPerson`): the calls block shows each call
        and whether it was right, not when. Live calls (A15) will want it. (A15.)
      - **A game of questions' season-long questions** (asked once) aren't an episode's, so its squares don't add up to its total when
        it has them (the total does count them). A column for "the season" or the settling episode. (U1, small.)
      - **Co-op's square is the episode's points**, not each one's right or wrong that night; the Lives row carries the couch's.
        (U1, small.)
      - **A game in stages shows its overall only** (names and totals); each stage's grid is on its own page. A column a stage, each
        that stage's total, would let the parent show the season. (U1.)
      - **"team" and "picks" games' episode block** (a whole-team draft scored by moments; picks scored by what they do) show the team
        as it stands, not who was held or picked that episode: the view carries neither per episode for others. (U1.)
      - **The step 1 hero's twist marks moved or went**: a captain's C badge and the Out badge on held faces were the big graphic's;
        bounty and budget lines were on the couch's rows (`Standing.sub`). The grid has no room for a line; they could ride the person
        sheet's header. Hearts, slots and your role moved under You. (U1, small.)
      - **Long names truncate in the grid's 84px name column** (the test replay's usernames); real couches' first names fit. A two-line
        name or initials past a width. (Any time, small.)
      - **The generic person sheet steps episodes by tapping the strip**, not today's swipe pager (a lineup keeps the swipe). (U1.)
    - ~~Twists without their state on the page, the couch's rows, a single question's strip~~: **done in U1 step 2**
      (2026-11-08). Still from the spec alone (9 places): best ones counted, one owner each, a joined multiplier, no repeats
      (used), the draw's order, naming a captain, a host's card, a second pick, one from each group. Each wants its state on
      the view (game-twists.ts) when a step needs it.
    - **No screen names a captain** (U1 step 2): the engine has `setActiveRosterCaptain` and the lineup route takes it, but the
      new design's lineup (Your moves) has no captain control, so a game with a captain shows its C badge only once one is named.
      A tap-twice on a starter (the U0 mock's) in the lineup sheet. (U1, small.)
    - **An auction's spend isn't on the page** (U1 step 2): a cap's room and a market's cash are; an auction's `spent` after it
      settles isn't read. (U1, small.)
    - **A game in stages** shows the stage strip and its overall points, not the current stage's own main block (each stage is
      a league of its own); **its stage plates now open each stage's page and its title takes the current stage's air time (U1
      step 2)**; the hero still shows the overall, not the current stage's own main block. (U1.)
    - **The show's colour on the title plate's tag** falls back to the chart colour when the art can't be read in a canvas
      (another site's picture without CORS: `tune-in.tsx colourOf`), as the tune-in does. (Any time, small.)
    - **The bracket control** pairs a later round from your own picks before it, in order; the server checks it
      (`bracketProblem`), but a draw whose later matches aren't in the first round's order would pair differently. (With a real
      tennis draw, U1's sports screens.)
    - **The engine's words read wrong on the page** (the finish review, 2026-11-08): describe.js leaks a phase's id ("Redraft at
      merged", "until merged starts"), repeats "Before the merge:" over three rules and states the draft twice on Stages; a
      chips question's rule runs two sentences together ("...who wins immunity Spread ten chips: 1 point..."); "Answer one
      question:" ends in a colon that leads into the next numbered rule. The census proves no holes, not that words read: a
      check for words that read wrong over every spec's describe. (The engine lane, with describe.js's sport-words ask.)
    - **A person's colour can be Gold** (#e0b23a, the palette's, `src/lib/people.ts`): beside a yellow strip it reads as a near
      second yellow (the finish review). It's their identity colour across the app, so not recoloured on one page. **Decided
      (the user, 2026-11-08): Gold is fine**, it stays.
    - **Not touched:** the dock and the Your moves sheet have no way to a game's page; the Games tab's launcher (U0); the four
      show themes (the user: a later step); Studio (the new design is Night only until step 15).

41. ~~The Games tab check's two sheet-swipe failures~~ **Resolved in U1 step 2b (2026-11-09):** the check's "short drag" moved
    10px every ~16ms, about 0.6px/ms, over the pager's flick speed (0.4px/ms) whenever the events landed quickly, so it was a flick
    and the next swipe failed after it; the pager was right. The drag is slow now (3px a step); 61 of 61 on every run since.

42. **What U1's Start a game left (noticed 2026-11-09, building the wizard; lane `start`, branch `start-a-game`).**
    - **Today's list still serves three starts** (the user's call, 2026-11-09): Run it back, a season that's aired (at your own pace:
      Starts' where you are and from the top) and a sport's season (`start-game.tsx StartRouter`). The wizard could take the first two
      as options in When it runs; a sport's is U0's "Start a game on a team", with the sports screens. (U1, next.) **A sport's league
      season goes to Start a game on a team since U1's sports slice (2026-11-09); a sport's TV listing keeps the list.**
    - **The user wants Start a game the same everywhere** (2026-11-09: "doesnt seem like the 'start a game' button is universal
      across the app. for instance the challenge s42 still has the old whereas survivor 51 has the new"): a season with no episode
      left to air that the app knows of (Challenge 42's: the `ownPace` rule in `start-game.ts`) gets today's list. So the next Start a
      game step takes the aired season (at your own pace) and Run it back into the wizard first.
    - **Computer players for every game** (the user, 2026-11-09: "can we include the option to have bots play (so if youre a single
      player you have someone to play the game against?)"). The wizard offers them (None to 3, How sharp) only for a draft or a
      Survival Pool without questions (`start-wizard.tsx` botsFit; the list's `BOT_GAMES`; the server's `botsPlay`): they can't
      answer questions, calls or a card yet. Two parts: computer players that play every kind (an answer for each of the sixteen
      kinds, beyond the engine's `botCall` and `botCard`; the engine lane), then the wizard offering them up front when you're the
      only one on the couch (through impeccable; a solo couch's default to be decided). (Engine lane, then U1.)
      **Reframed by the user (2026-11-09): solo first, then a simple bot**; every game at your own pace through the wizard
      before either (docs/PLAN-own-pace-games.md, the two sections of 2026-11-09).
    - **The drafter reads "a bingo sheet" literally** (the user's typed game on Challenge 42, 2026-11-09: 9 wacky "which player will
      ..." squares, a 200-point bank, a wager on each, all 9 answered): it went to Weekly Bingo's card (no stake per square) and
      refused new moments ("only moments already in the research list"). The engine plays it as nine `person` questions with a
      bank and a wager each (WAGERS takes person); the wacky moments are the questions' own words, which research answers. A worked
      example in the manual and a prompt line (a sheet of who-will squares with a stake each is questions, not a card; new moments
      become questions). Prompt changes are the user's at the merge. (The engine lane, with G1's typed games.)
      Its "Can't count yet" also shows raw spec paths to people ("Closest: card.of.", "Closest: ask[0]."): say them in words.
      **Approved by the user (2026-11-09), ahead of the merge.** Where: a fourth `teach` row in
      tests/fixtures/engine-capabilities.json `examples` (manual.js `workedFor` shows four; p12, p27 and p28 today), its words the
      user's, its spec nine `person` asks with a bank and a wager each (p10/p28's bank shape); the prompt line in
      game-words/prompt.js; the raw path at start-wizard.tsx:1929 (`x.nearest`); check with `check-game-words.js --real --only=<id>`.
      **Done 2026-11-09:** two prompt rules (build the closest game that plays; made-up moments one newMoment each), worked
      example p31, Closest in words. The local bot now drafts the game (nine person questions, a bank of 200, a wager each) with
      its moments as new-moment offers. Left: it asks "How many points?" once per question (eight times); one ask for them all. (Fixed
      the same night: f7af4fad, 47473365.) **Still open (the user's 9:18 PM try):** the game is right (nine questions, the bank, a
      wager each, the page's moments), but inventing moments rides on the drafter's adherence: one try made eight of its own, the next
      none and wrote "the system cannot invent"; no Add offer showed either time. Next: when the words ask for invented moments, a
      separate ask (the creative quick change's, `BUTTONS.creative`, for as many as asked) feeding the reliability ask and the Add
      offers, so it never depends on the drafter (the user's own suggestion).
    - **No betting-game role, no scoring themes on the rail**: G5's made-for games are on the rail since 2026-11-09 (made from the
      desk's Setup; the plan's G5 "Built" bullet says what's left), beside the engine's own kinds that fit the rulebook. Different scoring cycles engine-made ways from the
      season's own rulebook (No points lost, Big moments only: the user's call, 2026-11-09) until G5's themes. (G5, then the wizard
      reads its ideas.)
    - **An aired season at your own pace opens the wizard** (the user, 2026-11-09, for Challenge 42's made-for games): startFromSpec
      does start-game.ts's own-pace parts (the mark, GhostLogic.paceAll, Bots.paceTeams, the bingo bank). Not looked at in a browser:
      When it runs' Tonight word and the footer's "before <day>" read an aired episode's time. (U1, small.)
    - **No ad, no Premium**: Free's wait has no ad until an ad network is chosen (the user, 2026-11-09); every ask is the slow bot's
      wait (about 40 seconds). The fast AI and the paywall's screens aren't designed. (When a network and a paid model are chosen.)
    - **Two prompt changes, OK'd by the user at the merge (2026-11-09)**: the button's words (`game-words/prompt.js` BUTTONS.creative, the
      wording from U0's Settled bullet) and several new moments rated in one ask (`momentsPrompt`, `readMoments`). The stand-in bot
      answers both in `check-start-a-game.js`; neither has been asked of the real bot. (This step's merge.)
    - **Your call's choices that only our AI can make** (a question the bot asked, or "Which game?") go back to it as a typed change:
      another wait and one of the day's ten. A number our check filled in shows as the one choice. Changing it locally, where the
      engine can (a preset's parts, a number), would skip the wait. (U1, small.)
    - **A moment added for a game goes to the season**, so every couch's research asks it (G1 part 4's design), worth nothing in games
      that don't name it; Undo on the toast drops it from this game only. A couch on its own copy of the rules is refused (the
      server's words shown). (As designed; revisit if couches want private moments.)
    - **"Add a moment of your own" asks our AI first** (its rating, about 40 seconds) where the board added it at once: a moment
      research can't answer reliably is never added (Decisions, "Custom moments"). The board's instant add was the mock's. (As built.)
    - **What scores is one list** (counting, then not counting): the rulebook's moments carry no group (Challenges, Tribal Council...),
      the engine's ask from round F. (The engine lane.)
    - **Tell the couch differs between the two sheets**: the wizard tells only those who watch the show or play it there (U1's note),
      the list still tells everyone on the couch. (With the list's last starts, above.)
    - **The rail's Prediction Sheet** keeps the live game's name where the board said "Predictions". (Any time, the user's word.)
    - **Tonight's tab says the day when it isn't tonight** ("Thursday", "Just Thursday"); "Tonight" only on the night. Custom's
      Episodes view has no ≈ marker for a phase nobody can date (the board's merge line had a guessed episode); Stages carries the
      phases. A season with more than 13 episodes scrolls its cells sideways. (U1, small.)
    - **check-new-tour.js fails before its Start a game step**: the Add a show practice's Show me finish no longer names the show it
      added ("Nothing was saved: it was all practice..."), so the check times out at step 5's second close; stepped past that (a
      throwaway copy), it stops again at step 7 (`[data-guide-tv-soon]` isn't on the guide). Not this branch's: nothing here touches
      `watching/`, `tour/` or the guide (not run on master to prove it). Its Start a game step's selectors now name the wizard's
      (`[data-start-game="predictions"]`, `[data-start-describe]`); the practice's Start a game in the wizard runs in
      `check-start-a-game.js` instead (Next through the tour to step 9). Bring check-new-tour.js up to date. (The tour's owner, small.)
    - **Left from impeccable's critique (2026-11-09, 28/40 before the fixes; dual-agent):** the steps' screens change the game's
      kind (Before it starts lists every game) where the critique would keep kind changes to the rail and Every game, and Tell the
      couch is on by default two screens below Start it: both the settled board's; **decided (the user, 2026-11-09): both stay**. The question wording
      ("who'll be the one: voted against the majority") and How it plays' stitched sentence are describe.js's (the engine lane,
      with BACKLOG 40's words). 14px and 17px type sit off DESIGN.md's ramp here as across the app (about 355 and 70 uses): add the
      steps to DESIGN.md or snap them, app-wide. The sheet's Close and back are 40px (`ui/sheet.tsx`, every sheet). The game's
      name shows on the card and in the footer (the board's), and the first screen holds about 22 choices. (The user's calls, then
      U1 small.)
    - **Episode types and rounds** (Big Brother's weeks, a recoupling night) stay tabled, as in U0.
    - **Not checked on Studio** (the new design is Night only until step 15).

43. **What U1's sports slice left (noticed 2026-11-09, building sports on the couch; the sports lane, branch `sports`).**
    - **First run's search finds shows only** (`welcome/first-run.tsx`): teams and leagues are in Add a show's box, not first run's.
      The tour's demo still adds by TVmaze ids (BACKLOG 38). (U1 small, with the tour's demo by team.)
    - **A tour's or a promotion's league** (golf's, F1's, the UFC's: an event an episode) isn't offered: the search shows only leagues
      a slate can be made of. Their season (L8's Noticed) comes first. (Track L, then U1.)
    - **The quick changes stay dashed, "Coming for sports"**: rollSpec can't roll on a sport's page (every base fails its fit there:
      roll.js), so More competitive, More casual, Different scoring and Surprise me wait for it. (The engine lane's ask, U0's.)
    - **The engine's words for a sport**: gameShort and describeSpec aren't given the show's word for an episode, so the page says
      the line through `inShowWords` ("Episodes 1–3" made "Games 1–3"); the game card's short line says "Game 1" where the board
      wanted its date; "Airs Wed 9:22 AM" on a game's Starts plate (model.ts). (The engine lane: describe.js with `part`; U1 small.)
    - **Played through in the check: Pick'em only.** Squares, a series draft, Pick a few and a season's Pick'em start and their pages
      draw; taking squares and the draw, the draft itself and Pick a few's grading are the engine lane's own checks (L4), not walked
      on the phone here. (U1, a check-sports-couch.js part.)
    - **A final with no box score grades two days late**: score.ts's stamp fingerprint moves when a game's lines are kept, so a final
      ESPN has no box for waits for saveFinals' two-day fallback before a Pick'em on it grades. ESPN has a box for every team game it
      lists, so only the stand-in shows it. (Track L, if a real game ever does.)
    - **Classic's league read** (`/api/leagues/[id]/state`, results-seen.ts) goes by Hide scores for a sport's league too, not by
      Sports scores too: only classic reads it. (Classic, or step C's removal.)
    - **A player's game log matches by name**, as the season's cast and lines are (two players of one name: L8's Noticed).
    - **The mock's Watch along now and Plan a watch along** on a team's and a game's sheets aren't built (the watch along is out of
      this slice). Nor is L9 (lineup slots, FAAB, trades: the engine lane's).
    - **The guide's Sports reads the pro leagues and the couch's teams' leagues**, a week from today in the East; no other college or
      soccer league's games are counted until someone on the couch follows one of its teams.

44. **Own pace on a live game with no limit** (**closed 2026-11-14: this is own pace**, the game's setting "When you've watched
    it", chosen when a game starts: docs/PLAN-own-pace-games.md "Pace is the game's setting"; BACKLOG 63 and 64). As asked: the
    user, 2026-11-09, backlogged: "the former is simplier". A person set to
    play at their own pace on a live game keeps their moves open until they mark the episode watched, even past the next
    episode's airtime, so they can fall more than a week behind. What's built first stops at the next airtime
    (docs/PLAN-own-pace-games.md, "One person at their own pace on a live game"). Needs: their copy more than one episode behind
    on a live game (the catch-up loop allows it), the game's other weekly windows (waivers, matchups) waiting on them or not, and
    what the couch sees meanwhile. (After the capped version, if asked.)
45. **The classic league state route hands any member the whole league** (noticed 2026-11-12 by the gameplay explorer's
    API checks; the user: "backlog this"). `GET /api/leagues/{id}/state` (the classic app's, ported from SurvivorDraft) returns
    the full league state to any member: results past their own mark, and others' guesses on side bets still open (verified
    for someone one episode behind). The bet and grade routes also answer with full state, even with `?quiet`. The new app
    doesn't read these answers, so nothing shows on screen, but anyone calling the API directly would see spoilers. Likely fix:
    answer with the member's own view (GhostLogic.viewFor at their mark; others' unlocked choices removed), or retire the route
    once nothing classic reads it. Check first what still calls it (classic screens, the desk, scripts). Proof: the explorer's
    API tier reports it as `known:classic-state-spoiler` (docs/GAMEPLAY-EXPLORER.md); once fixed, that count drops to zero.
46. **PRIORITY: head to head's missing screens** (noticed 2026-11-12 by the gameplay explorer; the user: "Head to head gaps have
    big gap. Prioritize them in the backlog once we get around"). First in the batched design round
    (docs/PLAN-GAMEPLAY-SCENARIO-EXPLORER.md, "Designs needed" item 3). Head to head is the most common ranking in generated games
    (146 specimens), and the new app shows almost none of what makes it head to head:
    - who you play this week (`matchups.next`, in every game view, read nowhere);
    - the playoffs: no bracket and no champion named; the losing finalist marked OUT like those who missed them; the final's
      square unmarked in the regular-season grid; a champion with a worse record ranked above a better one with no reason shown;
    - quiet nights (counted for nobody) as unexplained dashes; with weeks won, a shared week's half point looks like a whole win.

    The engine and routes already return all of it (agreement checked by the explorer's API tier). Design through Impeccable
    (phone first), then build, then prove it with the explorer's head-to-head step (scripts/dev-test/check-explorer-page.js).
47. **Someone knocked out of a draft is still asked for a lineup** (found 2026-11-13 by the gameplay explorer, races and cuts).
    In a cut game (the lowest out every N episodes), the person cut sees "Set your Episode N lineup · Change until …" as their
    move while the grid marks them OUT. Saving it is refused by the server (`validateLineup`: KnockoutLogic.moveProblem). After a
    race is won, everyone sees it. Cause: `lineupOf` in src/lib/game/game-view.ts builds the move without asking
    `KnockoutLogic.moveProblem(view, me, ep.number)`. The fix is small (no move, or one marked out, once moveProblem says so),
    but what the page shows instead is a design question (plan "Designs needed" item 10). Proof: the explorer page check's
    cut step prints a NOTE while it happens (scripts/dev-test/check-explorer-page.js; `.ui-atlas/explorer-page/cut-page.json`).
48. **A team game with a cut ends at its first episode when nobody is on a team yet** (found 2026-11-13 by the gameplay
    explorer's campaigns, parlays run). In teams of players drawn at random with a cut (the lowest team out every N episodes), an
    own-pace game whose seats are all catching up when it starts draws nobody onto a team then (`TeamLogic.drawn` deals only seats
    there and caught up); each joins a team from the first episode still open once caught up. That's the normal case on a season
    that has aired, since starting a game sets everyone's mark to the episode before its start. But the teams' knockout walk
    (`KnockoutLogic.teamWalk` → `Seq.knockouts`) counts a team "left" only on nights someone plays for it, so at episode 1 no team
    is left, and "one left ends it" (`lastLeft`: one *or none*) ends the game there. Everyone who catches up then joins a game that
    is over: their teams list nobody (the game view's members are as of the night after the walk ended), and every later move is
    refused as after the game's end. Likely fix: zero sides playing shouldn't end it (`lastLeft` only when one side is left and
    others have played), or the walk starts at the first night a team plays. A rule question first: what should a night count
    for when no team plays yet? Proof: the explorer's engine tier reports it as `known:teams-none-left` (counted apart from
    failures); reproduce with `.ui-atlas/campaigns/parlays-200/repro-185.json`.
49. **Hits counted once each: the season grid and the week don't add up to the standings** (found 2026-11-13 by the gameplay
    explorer's multipliers check). In a draft scored by moments that counts hits once each (`score.hits: 'objective'`, each
    moment once for you however many of your starters hit it; or `'pick'`, once for each starter), the standings count it
    rightly (`ActiveRosterLogic.episodeScore` → `Seq.momentRaw`), but the season grid's squares and the week's lines come from
    `teamEpisodeBreakdown`'s plain path, which adds up every hit. Example: a four-person game where two starters both placed
    third in a challenge: the square says 4, the standings count 3; over the season the grid adds to 13 against a total of 12.
    A game with a multiplier, captain or best ball takes the engine's path (`ActiveRosterLogic.combines`) and agrees, so the
    likely fix is small: `combines` is also true for hits counted `'pick'` or `'objective'`. Proof: the explorer's engine tier
    reports it as `known:hits-grid-plain` (counted apart from failures: the multipliers check's twin without times shows it);
    reproduce with `.ui-atlas/campaigns/parlays-probe/repro-6.json` (it shows with no steps, from the generated history).
50. **Retracted (2026-11-13): not a product bug.** It said a game that ends early (a race won, a co-op couch's last life) settles its
    whole-game questions on the sheet at the season's end, past the game's. That was the gameplay explorer's own runtime, which
    graded the sheet on the viewer's copy uncut. The server grades on the copy carrying its walk, cut at the game's end
    (answer-points.ts `walked`: spanView of withWalk), so the sheet and the table agree. The API tier found it
    (`once-earned-disagree`, a co-op couch out of lives); the runtime now does the same (core-runtime-16), pinned by the unit test
    "a game that ends early settles its whole-game questions at its end".
51. **Outlast in reverse: the game page says "Fewest points wins"; the most points win** (found 2026-11-13 by the gameplay explorer,
    Outlast in reverse). In reverse a castaway earns the cast's size + 1 less their place, so the earlier yours go home the MORE you
    score, and the standings rank the most points first (the real routes and the runtime agree). But the generated game page adds the
    note "Fewest points wins" under the season grid whenever the table is reversed (src/lib/game/game-page/model.ts, `has(page, "table",
    "reverse")`), right beside "1st of 2 · 19 pts" for the higher score. Likely fix: drop the note, or say what reverse means ("The
    earlier yours go home, the more you score"); How it plays already says it right. Proof: the explorer page check's reverse step
    (`--only="Outlast in reverse"`, words in `.ui-atlas/explorer-page/outlast-reverse-page.json`).
52. **Own pace: the top scorer's twist is chosen before everyone has played the episode that decides it** (found 2026-11-13 by the
    gameplay explorer, the top scorer's twist; confirmed on the real routes). The engine's own comment says a league at its own pace
    (its seats at different weeks, so nobody's the top scorer for all of them) files nothing and plays the fallback. But the check is
    `RevealLogic.isCatchingUp(state)`, the league-wide reveal mode, not seats at their own pace (`GhostLogic`). So in an own-pace
    game, episode 4's twist was filed as Ann's choice once its choice closed, while Bo (through episode 2) and Cy (through 1) hadn't
    played episode 3, the one that decides who chooses. When Bo played it at his own pace he tied Ann on it, but a filed twist
    stands: the twist was chosen by someone who wasn't the top scorer once everyone had played. Likely fix: in an own-pace game, play
    the fallback (as the comment says), or wait to file until every seat has played the deciding episode. A rule question first.
    Proof: the explorer's engine tier reports it as `known:twist-own-pace`; reproduce with `.ui-atlas/campaigns/twist-200` case
    94 (materialized at step 8, the server's twist route files the same choice).
53. **A survival pool's page: mulligans left counted backwards, and "You can buy back in" for someone out with none left** (found
    2026-11-13 by the gameplay explorer, a pool's mulligans and buyback; FIXED 2026-11-13, pushed 2026-11-14). `game-twists.ts`
    took the history's `mulligans` as the number used (`of - mulligans`), but the engine's tally counts the ones left, so a pool with
    one showed "0 mulligans left" before any wrong pick and "1 mulligan left" after it was used. And `buyBack` was true for anyone out
    while the buyback's deadline stood, though a buyback is automatic (the night the lives run out): someone out had none left or was
    past its deadline that night, so the Out card's "You can buy back in: it's in Your moves" pointed at a move that doesn't exist.
    Fixed: mulligans left are the history's own; `buyBack` needs a buyback still left and in time for the night they went out. Proof:
    the explorer's `pool-riders` invariant (each control fails 8 of 8 and 2 of 5 rider cases on the old lines) and the runtime unit
    test "a survival pool's mulligans and buyback".
54. **Group slots on a finale played in pairs: void unless research says the pairs split** (a question; found 2026-11-13 by the
    gameplay explorer, group slots). The format timeline compares each episode's groups with the last. A finale where everyone goes
    home leaves no groups at its end; if research's answer lists no change, the timeline finds a split into individuals the answer
    doesn't state, marks the episode's report unsure, and every slot held that night is void (fallback 'void'), so the finale's
    slot points never count. Whether a report emptied by exits alone should read as sure (everyone gone is no split), or research
    should be asked to say it, is a rule question. Proof: `.ui-atlas/campaigns/groups-200` case 177 (before the explorer's world
    learned to state the split).
    **Decided 2026-11-14 (the user, taking Claude's recommendation): Count them: a finale emptied by exits isn't a split into individuals, so the slots held that night count (not void).** **Built 2026-11-15** (the rule-fixes session, engine lane): `format-timeline.js` buildTimeline reads a night whose exits leave nobody who went into it still in as no split and no merge, whatever research says, so it is sure and its slots score; a night that empties the groups but leaves someone in still needs the split stated. The explorer's world no longer states a split on such a night, so campaigns exercise it. Proof: `format-timeline.test.js` "BACKLOG 54", the 60-case campaign `rulefix-60` (all pass). `check-group-slots.js` has no finale; its five FAILs (the lock at Episode 6 onward) fail the same on the code before this step: noticed, not fixed (the next session touching group slots takes it).
55. **A pool's skipped night reads "No pick · missed"** (found 2026-11-13 by the gameplay explorer, a pool that skips a night
    you've used everyone). In a pool that never repeats with `get.fallback: 'skip'`, a night you'd already picked everyone still in
    counts nothing (no life lost, the streak holds), but the person sheet (`src/new/show/game-sheets.tsx`, both "No pick · missed"
    lines) calls any night with no pick a miss, and the square says "Waiting". The table's pick rows can't tell them apart either
    (`{ castawayId: null, correct: null }` for a skip; the history row's `skipped` isn't carried). Likely fix: carry `skipped` on
    the table's picks and the plays square, and say "Skipped: you'd picked everyone still in". Proof: the explorer's page step
    `--only="never repeats"` (`skip-pool-page.json`).
56. **Own pace with exclusive teams: Run now, Open a window and Undo act on the season as it stands, not on everyone's episode**
    (**fixed 2026-11-14**, the user's decision that day: "sure A"; pushed 2026-11-14). All three act on the copy at
    everyone's episode and fold back (`waivers.js handOn`, `processNow`, `openWindow`, the new `undoRun` and `currentWeek`,
    used by the classic door, Backstage › Waivers and Recent changes' Undo), and the paced clock leaves a week held by an Undo
    alone (`syncPaced`). A window with nobody on an episode yet is refused: "Open a waiver window once everyone has watched an
    episode". The explorer's mirror follows (`runtime-waivers.cjs`, runtime `core-runtime-29`), its known finding is a failure
    now (`waivers-by-hand`), and the proof's NOTE lines are PASS/FAIL lines: `check-waiver-commissioner.js --case=paced`,
    `paced-claim`, `paced-time`, `paced-window`, `paced-undo` (both doors). Rarer than first said: the wizard's standard games
    all share their teams (BACKLOG 68's note), so an exclusive game at its own pace comes from Surprise me, a described game, a
    made-for game or the older list on an aired season. As found:
    (found 2026-11-13 by the gameplay explorer, the commissioner's waiver actions; confirmed on the real routes, both the
    Backstage door and the classic one). In a game at its own pace with exclusive teams, a waiver week runs on a copy of the league
    as it stood at the episode everyone has reached (`waivers.js` `pacedCopy`, sync point 2), and a claim is checked on that copy.
    But `processNow`, `openWindow` and the undo take the league itself, which holds the whole season's results. With everyone on
    episode 1 of a season aired through 4:
    - **Run now gives away what nobody has seen.** The run counts a replacement for a seat whose only loss is in episode 4, and
      everyone's waivers screen then says "Bo · No pick in". A claim for someone who goes home in episode 2 is passed over as
      "gone". Left to its own time the same claim goes through (it runs on the copy).
    - **Open a window does nothing.** With no week running it opens one on the season's last episode with results, and the paced
      clock cancels it in the same write. The answer still says a window opened (`fresh: true`), the toast says so, and the couch
      is pushed "Waiver window open".
    - **Undo is undone at once.** The run is taken back and the week held, but the paced clock runs a week as soon as everyone
      owed has a claim in, hold or not, so it has run again by the time the write ends. The toast says "Waiver run undone".

    Likely fix: run all three on the paced copy and fold it back, as `saveClaim` does, and have `syncPaced` respect `hold`.
    Proof: `node scripts/dev-test/check-waiver-commissioner.js --case=paced-claim` (and `paced-window`, `paced-undo`): each prints
    a `NOTE BACKLOG 56` line from the server's own state, and `paced-time` shows the same claim going through at the week's own
    time. The explorer's engine tier counts it as `known:waivers-own-pace-by-hand`.
57. **A lineup game with replacements: replacing a starter rewrites the weeks already played** (**fixed 2026-11-14**, the user's
    decision that day: "definitely address this"; pushed 2026-11-14). A carried lineup reads who the seat held FOR THAT
    EPISODE, from the move log (`ActiveRosterLogic.heldFor` → `Seq.heldAt`, the read best ball's team already used), where it
    read who the seat holds now. Nothing is stored and nothing migrated: it's a read rule, so every path has it (own pace, a live
    game's late window, a viewer's copy). A bounty follows (it reads the same lineup): what counted that night stays. A seat at
    its own pace that moves while AHEAD of the move's episode (exclusive teams: a waiver week runs at everyone's episode) keeps
    its own mark on the log entry (`seen`), and the move counts for its lineups from after that: never back into a week it had
    played. Proof: `tests/active-roster-lineups.test.js` (seven cases); `check-waiver-commissioner.js --case=carried` (Bo's
    total stays 10 where it fell to 8.5; a FAIL now if it moves); the explorer's known finding is a failure now
    (`carried-lineup-rewritten`, per seat: a week a seat hasn't played is still its to change); 222 recorded reads in
    `tests/fixtures/scoring-shapes.json` moved, each the fix itself (the fixture's header says which).
    **It wasn't only own pace:** it needs an episode with no lineup stored for a seat, which a live game has whenever the seat
    had no lineup in the week before (and older leagues have throughout). Of the 14 leagues on the local database one moves with
    the fix: a Survivor 49 Weekly Lineup (a seat saved one lineup for Episode 1, rode it through Episode 6, and replaced a
    starter after Episode 10; weeks 2 to 6 then lost that starter's points, 9 in all: second by 4 became first by 5).
    **That league is local only** (the user, 2026-11-14: "pretty sure survivor 49 doesnt exist"; right: production's backup of
    2026-10-30 has ten leagues, none on Survivor 49), and **no production league's totals move** (that backup, and a fresh one taken
    2026-11-14: ten leagues, scored by the live engine and the fixed one; the couch's Survivor 51 lineup has 6 moves logged). The check is kept for any scoring change: `node scripts/dev-test/compare-totals.js --backup=<dir>` (a backup
    made by `scripts/backup-leagues.js`; no database, no connection string) or `--db` (local only). **Before a push:** run it on
    the fresh backup the push routine takes. As found:
    (found 2026-11-13 by the
    gameplay explorer; confirmed on the real routes). A lineup not saved for an episode is the last one saved, carried forward, and
    worked out when it's read from who the seat still holds (`ActiveRosterLogic.lineupFor` → `carriedLineup` → `carriesInto`).
    Nothing stamps it when the episode is played. In a live game each episode is created after the last and gets its lineups
    copied in then (`carryForwardLineups`), so this doesn't arise. In a game at its own pace on an aired season every episode is
    there from the start, so every week after the one a lineup was saved for is carried. When the seat later drops one of those
    starters (a replacement or a swap, on waivers or in free agency), every carried week loses them: their points for weeks
    already played go, and so does a bounty on them. Seen two ways:
    - Bo saved one lineup for episode 1, revealed through 4, and replaced a starter who went home: his total on the real games
      route went from 10 to 8.5 with no new results.
    - On a lineup with a bounty and shared teams, replacing a voted-out starter took Bo out of the bounty he owed on them and left
      him collecting it from the other seat who still held them (0 and 0 became +2 and −2), and someone a week behind saw the old
      numbers until they revealed the week of the replacement.
    - (2026-11-13, later, in the runtime only: the same engine code, not run on the routes.) It also rewrites a week the seat
      itself hasn't reached. Cy, up to Episode 1, never saved an Episode 2 lineup; Episode 3's waiver week closed and filled two
      of the starters he'd carried; his Episode 2 lineup went from four starters to two and that week's bounty lines changed for
      everyone who had already seen it (`.ui-atlas/stages-repro-73.json`: one clock step).

    Likely fix: keep the lineup that counted when the episode is played (on the reveal at own pace, at the lock in a live game), or
    have a carried lineup read who the seat held then. A rule question first only for the bounty (who owes it once they're
    replaced). Proof: `node scripts/dev-test/check-waiver-commissioner.js --case=carried` prints a `NOTE BACKLOG 57` line with the
    lineups and totals before and after; the engine tier counts it as `known:carried-lineup-rewritten`
    (`.ui-atlas/campaigns/commish-probe2` case 51 for the bounty).
58. **A window opened a little more than a day before the next episode runs within minutes** (a question; noticed 2026-11-13 by
    the gameplay explorer). A week's claims run a set number of hours before the next episode airs (24), or halfway between
    opening and airtime when it opens later than that (`WaiverLogic.schedule`). That suits a week that opens when results come in.
    A window opened by hand 23 hours before airtime runs 11½ hours later; one opened 24 hours and 5 minutes before runs 5 minutes
    later, and one opened at exactly 24 hours runs in the same write. The same happens to a week opened by results that arrive
    just before that mark. Whether a window opened by hand should always leave a minimum time to claim (half the time left, say)
    is a rule question. Proof: `.ui-atlas/campaigns/commish-200` case 2, step 1 (and `commish-probe2` case 1, step 8): a window
    opened exactly a day ahead is processed in the step that opened it.
    **Decided 2026-11-14 (the user, taking Claude's recommendation): A window opened by hand always leaves a minimum time to claim (about half the time left before the next episode, and at least a few hours), so it can't run before anyone has seen it.** **Built 2026-11-15** (the rule-fixes session, engine lane): `WaiverLogic.schedule` gives a window opened by hand (`period.byHandAt`: opened, made a window, or opened again by whoever runs the game) at least half the time left before the next episode and at least `MIN_CLAIM_HOURS` (3, my reading of "a few"), never past its airtime; a window changed keeps its time; a week the clock opened keeps its own. Proof: `waivers.test.js` "A window opened by hand leaves time to claim"; the campaign invariant `waivers-by-hand` now fails a window by hand that runs in its own step or under three hours; `check-waiver-commissioner.js` all cases (174 of 174 agree). **Left alone:** a week the clock opens because results arrived just before the mark still runs within minutes (the decision covers windows by hand only).
59. **After Undo, the new app still says when the week will run; it won't** (found 2026-11-13 by the gameplay explorer, the
    commissioner's waiver actions). An undone week is held: it runs on Run now, or when the next episode airs
    (`WaiverLogic.undo` sets `hold`). Classic's plate says "Claims are on hold" (`status-plate.ts`). The new app's two reads give
    the old time whatever the hold (`waiver-view.ts` and `backstage-games.ts`: `due: current.processAt`), so Backstage reads
    "Waiver window open · due Sat 7:22 AM" and "Run now · Or on its own, Sat 7:22 AM", and players are told the same deadline.
    Likely fix: no `due` on a held week, and the words "On hold until you run it, or Episode 2 airs". Two smaller things on the
    same screen: Run now's preview says anyone who forgot "gets whoever's free with the most points", which is a lineup game's
    rule (any other game fills with a free agent picked by a fixed draw, `WaiverLogic.autoPick`); and after a window is turned off
    on a game with no waivers of its own, the screen offers "Open a waiver window" again, which the server refuses for that
    episode with "This episode's waivers have processed" (nothing processed: it was turned off). Proof: the explorer's page step
    `--only="commissioner's waiver window"` (`backstage-waivers-page.json`, screenshots `05zza-backstage-undone` and
    `05zzb-backstage-off`).

60. **A later stage's private draft can't be locked in when fewer are still in than a team takes** (**fixed 2026-11-14**, the
    user's decision that day: 60-A; uncommitted, not pushed). A sheet names everyone left to pick when that's fewer than a team
    takes (`BlindDraftLogic.sheetSize`, read by `validateSubmission`: "Only 5 are left to pick: pick all 5"), as a lineup takes
    fewer starters late in a season and a late joiner's team takes everyone left. The sheet on the phone counts the same way
    (`src/new/show/draft.tsx`: "Only 5 left to pick: choose all 5", five slots, the lock live at five). With shared teams everyone
    then holds the same people: a Weekly Lineup stage still plays (who you start is yours), an Outlast stage is a dead heat,
    which the user accepted over a draft nobody can finish. Proof: `tests/short-draft.test.js`; on the real routes and in a
    browser at 390, `check-stages-explorer.js --case=short` (12 checks: a sheet of four refused, each seat locks in all five, the
    reveal's teams the runtime's). As found:
    (found 2026-11-13 by the
    gameplay explorer, stages; confirmed on the real routes). A game in stages' later stage drafts as it starts, from who's
    still in then (`extras.draft.opens: 'start'`). A private draft's sheet must name exactly `each` castaways still in
    (`BlindDraftLogic.validateSubmission`: "Pick exactly 6 castaways"), and nothing checks a later stage's team size against
    the cast when the game is made (its pool is unknown until it opens: `engine-lab.ts` `makeStages` writes it with no
    pool). So "6 each from the merge" on a season with 5 left at the merge opens a draft nobody can lock in: every sheet is
    refused, the stage never has teams, and it counts nothing in the overall. The same after the 9:10 PM fallback: an
    exclusive snake that no longer fits is played shared, but a team can still be bigger than who's left. Likely fix: a
    sheet of everyone still in when fewer than a team are left (as a lineup needs fewer starters late in a season), or the
    stage's team size capped as its draft opens, with a line in Recent changes. Proof:
    `node scripts/dev-test/check-stages-explorer.js --case=short`.

61. **Someone behind is shown the next stage's start and their team** (**fixed 2026-11-14**, the user's decision that day: 61-A;
    uncommitted, not pushed). A viewer's copy doesn't say where a game starts or ends by a phase of the season until they've
    watched up to it: the start once they've seen the episode before it, the end once they've seen that episode
    (`SpoilerLogic.spanAhead` and `unsettle`, inside `viewThrough`). Until then the copy is as everyone's stood before the merge
    was known: the game waiting for its phase, and nobody on a team from a draft that opened at that start (no pick, no lineup
    for an episode of it, no move). A game in stages' own summary of its stages is cut the same way (`StageLogic.cutWalk` with the
    game's stages: a start or end the game fixes at an episode stays, one the season's results set doesn't), and the game view's
    end comes from the viewer's copy (`game-view.ts`). Proof: `tests/span-spoilers.test.js` (five); on the real routes
    `check-stages-explorer.js --case=overall` (its NOTE is four checks now: someone two episodes behind is shown neither later
    stage as started, and neither first stage says where it ends); the route checks' known finding is a failure now
    (`later-stage-past-mark`). **Left:** such a stage's card still says "Reveal Episode 3 first" to someone behind, as every game
    of theirs on the season does (it names their next reveal, not the merge); Backstage's How long isn't cut for whoever runs a
    game and is behind (Backstage shows the season as it stands). As found:
    (found 2026-11-13 by the gameplay explorer, stages;
    confirmed on the real routes). A stage's league holds where it starts and ends (its span, settled when the merge is
    confirmed) and its teams (drafted as it starts, only from who's still in). Neither is an episode's results, so a viewer's
    copy cut at their mark still has them. Cy, who has seen through Episode 2 of a season whose merge came in Episode 3, is
    shown on `/games`: the first stage "ends with Episode 3", the Merged stage "starts with Episode 4", their Merged team
    (three people who are therefore still in after Episode 3) and "Set your Episode 4 lineup" behind "reveal Episode 3
    first". That says when the merge came (the very thing "When does the merge start?" asks) and who survived it. The
    overall itself is right at every mark (it counts a stage only through what they've seen). The production game view
    does the same for a game outside stages that runs from or until the merge: its start ("from Episode 4") or end appears
    once the merge is confirmed, whoever is looking (seen in the explorer's projection; not checked on the route). Likely fix: a viewer's copy keeps a span's phase end unsettled, and a later stage as not started (no team, no
    lineup), until they've seen the episode before it starts. The route checks count it apart
    (`known:later-stage-past-mark`). Proof: `node scripts/dev-test/check-stages-explorer.js --case=overall` (its NOTE line).

62. **An Outlast stage that starts mid-season starts everyone on points** (a question; noticed 2026-11-13 by the gameplay
    explorer, stages). Outlast scores each holding 1 plus every boot it has outlasted, counted over the whole season
    (`EliminationOrderScoringStrategy`), whenever the game started. So an Outlast "from the merge" (a stage, or a game of
    its own) shows every team on (boots so far + 1) × its size before it has played an episode: 16 each for teams of four
    after three boots. The game in stages' overall counts a stage only once one of its episodes has results, so the Merged
    stage's own page says 16 while the overall counts none of it; a week later all of it lands at once (16, 16, 10 becomes
    36, 36, 29), and the later stage outweighs the earlier one for good. Nobody's rank moves by the head start itself
    (everyone gets the same), but is it what "separate games, plus an overall winner" should mean? One option: a stage's
    Outlast counts boots from its own start. Proof: `node scripts/dev-test/check-stages-explorer.js --case=overall` (its
    second NOTE line).
    **Decided 2026-11-14 (the user, taking Claude's recommendation): A stage's Outlast counts boots from the stage's own start: a new stage starts everyone level.** **Built 2026-11-15** (the rule-fixes session, engine lane): a stage's own league says it is one (`settings.stageOf`, written by `engine-lab.ts` makeStages and `change-stages.ts` makeCopy, and by the runtime), and its Outlast's places don't count the boots before its start (`EliminationOrderScoringStrategy.baseOf`, the sequence's `mark.base`; never in reverse, where a place is already the cast less them). Proof: `stages.test.js` "BACKLOG 62", `check-stages-explorer.js --case=overall` (the NOTE is now a check: the Merged stage level before its first episode; 121 of 121). **Left alone:** a game of its own that starts later ("from the merge") still counts the whole season, as the decision named stages only (production has a live Outlast from Episode 2); stage leagues the engine lab made locally before this carry no marker and keep counting the whole season (production has no stage leagues, so no migration).

63. **Own pace on a season that's still airing: a choice when a game starts, and the default** (the user's decision, 2026-11-13;
    step 2 of "Pace is the game's setting" in docs/PLAN-own-pace-games.md). Step 1 is built (pace is the game's setting: live
    for everyone by default, strict as a choice, the per-person switch gone, stages following their game). Step 2 waits on one
    decision of the user's: a game at its own pace has each seat pick its own team, so making it the default would take away the
    shared-team blind draft revealed together. **Decided 2026-11-13** (the plan's "Step 2: the user's decisions"): the draft
    stays together, own pace keeps waiting all season, and the pace family is fixed at the start. **Built 2026-11-13** (the plan's
    "As built: … step 2"; pushed 2026-11-14): `paceTogether`, `settlePace`, the late window between airtime and results, the
    start's `pace`, the wizard's When moves lock, `check-own-pace-start.js`. Left: the explorer's late moves as actions; a start
    with a phase at its own pace (waits on BACKLOG 67); and 56 and 57 before it's pushed (they're on the default path now).

64. **Four rules about moving late, one setting** (found 2026-11-13 while moving own pace to the game; **decided the same day**, the
    user going with the recommendation: the game's pace is the rule, the episode's lock override the one exception, the late lock in
    hours retired into the pace, BACKLOG 44 becomes own pace). **Built 2026-11-14** (pushed 2026-11-14; the plan's "As built:
    the late lock retired"): nothing reads `extras.lateLock` (`AnswerLogic.closed`, `lateEpisode`), nothing describes or offers it
    (`describe.js`'s rule line and its "Watching late" setting, the drafter's manual, the game page's "Late lock" tag), a spec that
    carries one still validates and round-trips; the trivia sheet holds a round's key until the round locks for that person by
    the game's pace (`trivia-key.ts heldFromSheet`); a hand lock on the episode beats the late window (the one exception);
    BACKLOG 44 closed. **A correction:** I wrote on 2026-11-13 that someone could read the key and still answer. They can't score
    from it: a question played in the sheet can't be answered in the game after (`playedInSheet`). What the hold prevents is
    someone spending their own round by accident. Left: the engine lab's row "Your own lock when you watch late"
    (`tests/fixtures/engine-capabilities.json` `when.ownLock`) still shows the retired spec part as its example; point it at the
    pace when the lab can show how a game is run. The lock row's override words could say who they apply to ("locked for
    everyone" / "open to everyone, watched or not"): a words pass. As found: a
    Commissioner can now meet four separate things that all decide whether a move is taken after airtime: the game's pace (When
    moves lock: until you've watched, or at airtime), the episode's lock override on the same screen ("open past its start, on
    the honour system", for everyone, whether they've watched or not), a game of questions' late lock in hours
    (`extras.lateLock`: until you've seen it, up to 12 to 72 hours), and BACKLOG 44's no-limit version. They were built at
    different times for the same need. Likely shape: the game's pace is the rule; the episode override stays as the one-off
    exception it is, worded against the rule ("locked early" / "open to everyone past its start"); the late lock in hours
    becomes a cap on the game's pace, or goes.

65. **The after-airtime reminder now goes to everyone who's behind** (a consequence to watch, 2026-11-13). It was written for one
    switched person: "episode 6 has aired: set your lineup before you watch it", once an episode. With live for all, each person
    in a live game who hasn't watched and hasn't set gets it. Probably right (it's the nudge the late window needs), but look at
    it after the first episode night: how many go out, and whether the words read well to someone who never asked for it.

66. **The reveal doesn't open over a game's own page** (found 2026-11-13, building the honour note). From Your moves opened on a
    game's own page (`/show/<season>/game/<league>`), opening the reveal in place changes the address to `?page=reveal` and shows
    nothing. The new "I've watched it" link works around it by going to Tonight with the reveal open (`paths.reveal`). Your
    moves' older "Reveal Episode N first" button makes the same in-place call (`RevealFirst`: `openReveal`), so it very likely
    does nothing there too (not run separately). Likely fix: the same link, or find why the reveal's page isn't read on that route.

67. **A draft that opens mid-season, and someone who's behind** (**decided 2026-11-14: 67-A**, the recommendation below; built so
    far: its first half through BACKLOG 61 and 60, someone behind isn't shown the stage or a team until they've watched up to
    it, and a sheet takes everyone left when that's fewer than a team. **To build:** a private draft that doesn't wait for
    someone behind (each person drafts when they get there, from who was still in when the stage started: today the reveal waits
    for every seat's lock, or whoever runs the game picks for them); a draft with turns' deadline and picks made for a seat that
    hasn't picked, hidden from them until they've watched; at its own pace, the wait that says who it's waiting on and the
    Commissioner's go-ahead. The turn-based parts want the draft room driven as explorer actions first, to prove them.) As
    recommended: (a recommendation, 2026-11-13; the user asked for an honest view and
    hasn't decided). Neither "that's on you, take what's left" nor "X is behind, wait?" as a prompt: the first makes someone
    choose among people whose survival they haven't seen, the second is a new waiting-and-voting state on every shared moment,
    which is the thing that would send us back through every generated game. Let the game's pace answer it, with pieces the
    engine mostly has:
    - **A private draft (shared teams): nobody waits and nothing runs out.** Each person drafts when they get there, from who was
      still in when the stage started (what a late joiner's team already does: `GhostLogic.teamAt`, which also takes everyone
      left when that's fewer than a team: BACKLOG 60). Until they've watched up to it they aren't shown the stage as started, or
      a team (BACKLOG 61).
    - **A draft with turns (exclusive teams), live game:** it has a deadline, the next episode's lock. A seat that hasn't picked
      by then gets its picks made for it, hidden from them until they've watched.
    - **A draft with turns, game at its own pace:** it waits for everyone, says who it's waiting on, and whoever runs the game can
      go on without them (their picks made for them). The same shape as waivers' Run now.
    No vote, no new prompt: one deadline, one auto-pick, one Commissioner's override. It stays inside the draft and the stage's
    settle, away from scoring, and the gameplay explorer can prove it once the draft room is driven as actions.

68. **Exclusive teams at your own pace: nobody new after the draft** (**built 2026-11-14**, the user's decision that day: C, and
    "an explanation, not a lock"; pushed 2026-11-14). Start a game starts a game whose castaways are one team's each on
    **When the next one airs** (`StartOptions.runs.exclusive`, the wizard's `paceRec`), with own pace still a choice, and says
    what it closes where it's chosen: "Nobody can join once the draft starts." The join row says why it's locked ("Players own
    their castaways and play at their own pace, so nobody joins once the draft has started", where it said someone had closed
    it), and before the draft "Anyone on the couch can join until the draft starts. You'll draft with everyone." Backstage ›
    Game settings shows Who can join as the game's own rule, with nothing to choose (the two buttons there did nothing:
    `joining.fixed`). Check: `check-own-pace-start.js` (16 more on the routes, 10 on the screens at 390).
    **Smaller than first said:** the wizard's standard games all share their teams, Outlast included (`roll.js`: its Outlast is
    exclusive only when the cast covers everyone's teams, and then for some seeds; the rail's own seed gives shared). An
    exclusive game comes from Surprise me, a described game, a made-for game, or the older list. As noticed:
    (noticed 2026-11-13, step 2 of "Pace is the game's
    setting"). `GhostLogic.joinMode` gives an exclusive game at its own pace "open until the draft starts, then locked" (sync
    point 1, decided 2026-11-06 for a season that had aired). Own pace is now the default on a season still airing, where a live
    exclusive game is "Ask me first" and a late joiner takes free agents. So a friend who turns up in week 2 can't be let into
    the couch's default Outlast. Options: leave it (say so on the join sheet); let whoever runs it let someone in with free
    agents as of the newcomer's own episode (the late joiner's path, which `viewFor` already hides from people behind); or make
    exclusive games default to When the next one airs. A question for the user.

69. **A lineup stored for a week keeps a starter the seat let go before it** (**fixed 2026-11-14**, the user that day: "ill take
    your suggestion for 69"; pushed 2026-11-14). A lineup set for an episode leaves out whoever the move log says its seat
    let go before that episode (`ActiveRosterLogic.letGoBefore`, read in `lineupFor`): a gap to fill, as a carried lineup
    leaves, and the one brought in waits on the bench (ESPN's and Yahoo's way; the gap makes the lineup a move that's due). A
    read rule, as 57's, not the write first sketched below: nothing saved is rewritten, so taking the move back brings them back
    with no bookkeeping, a viewer who hasn't seen the move still sees them (no gap to give it away), and it's the same on a
    paced copy. Only the log lets someone go: a roster changed by hand leaves a saved lineup as it was, as before. A week already
    played can't change by it (a move counts from the episode after it, and from after its seat's own mark when the seat was
    ahead). Proof: `tests/active-roster-lineups.test.js` (seven cases); `check-waiver-commissioner.js --case=saved` on the real
    routes, both doors (Bo's Episode 2 lineup counts one starter with a slot to fill after his swap runs, both again after
    Undo, on the server's state and on his games route); `tests/fixtures/scoring-shapes.json` didn't move; no production
    league's totals move (`compare-totals.js`). **Left:** a sport's lineup that locks game by game reads its own timed log
    (`lineupAt`), which this doesn't touch: someone let go mid-week there still counts for games that start after. And the
    waivers' result could offer the new holding the empty slot in one tap (docs/UX-IDEAS.md). As found:
    (found 2026-11-14 while fixing BACKLOG 57; the
    engine, not run on the routes; a question for the user). The mirror of 57. A lineup saved for an episode is never touched by
    a later move, so a seat that swaps a starter out before that episode airs still fields them: they score for a team that no
    longer holds them (in an exclusive game, for two teams if someone else picks them up), and the new holding sits on the bench
    until the seat saves a lineup again (which then refuses the old starter: "isn't on your roster"). A live game stores every
    seat's next lineup as the episode is made (`carryForwardLineups`), so this is the usual path there for a swap of someone
    still in; a replacement for someone who went home is fine (they aren't copied in). A carried lineup, since 57's fix, leaves a
    gap instead: the two paths now disagree. **Not seen in real data** (the local copy of production: 4 lineup games, 3 moves, 0
    cases; `mirror-count` was a one-off read). Likely fix: when a move lets a holding go, take them out of that seat's stored
    lineups for episodes after the move's that haven't been played (a gap to fill, as a carried one has), and put them back on
    Undo. A rule question too: should the one brought in take the slot? (ESPN and Yahoo leave it empty.) Not built: it changes
    how a live game's lineup reads after a swap, which is the user's call.

70. **Five check lines that fail on the code that's live, found shipping the pace work** (2026-11-14; each run against
    origin/master's code too, `bf50bbb9`, in `rfl-merge` on its own port and database: the same lines fail there, so none came
    with the push). Checks that fail for old reasons hide new ones; each needs its line made true or the product looked at:
    - `check-new-show.js` "the prediction is an extra this week": Tonight no longer shows the open prediction's row ("Closes at
      airtime · <game>", `tonight.tsx` `ExtraRow`) on the fixture's couch. **Look at this one first: it may be a real gap on
      Tonight**, not a stale line (not looked into: it's live either way).
    - `check-new-show.js` "one yellow button: the first card's" and "yellow only on what's still due": they count every
      `.bg-chyron` on Tonight, and the GIF row's badge is one since 2026-11-02. The check should count buttons.
    - `check-start-a-game.js` "a start the listing doesn't have": a spec from Episode 4 is taken (200), where it expected a
      refusal. Since `ca22b870` (2026-11-09) a start on any episode that's aired is a game at its own pace
      (`start-game.ts` `paced`: any aired episode, though the sheet offers only where you are and the top). Decide which is
      right: tighten the server to those two, or make the line expect it.
    - `check-new-shell.js` "no page errors": a 404 for `/__study/assets/survivor-49.jpg`. Local data only: a playtest fixture
      show (`zt-pt-survivor`) whose art points at a design study's file, served by the atlas alone. No such row in production's
      backup. The fixture's art should be a file the app serves.
    **When:** the first two with the game UI/UX overhaul's Tonight (docs/UX-IDEAS.md); the prediction row before then if it's
    real; the last two with the next change to those checks.

71. **A waiver window opens by hand on a game that's over** (found 2026-11-14 by the gameplay explorer, a stage that had ended).
    `WaiverLogic.openWindow` refuses once the season is over, but not once the game is (a span's last episode played: a first
    stage after the merge). The window opens on the game's last episode, claims are taken and run, and the teams change in a
    game whose table is frozen where it ended. Nothing scores by it; it's a control that does nothing useful and reads as if it
    did. The clock's own weeks already stop there (`WaiverLogic.due`: "a game over a span opens no week after its last
    episode"). Likely fix: the same refusal by hand ("This game is over"). Proof: `.ui-atlas/repro-late-week.json` (five steps).

72. **A sport's Players tab answered with a server error for anyone told results straight away** (**fixed 2026-11-14**, found
    that day by the gameplay explorer's sports step and its route sweep). On a sport's season the spoiler guard tells everyone
    everything by default (`guard.ts`: "sports are live"; Account settings' "Sports scores too" is off), and "everything" is an
    infinity. `rosters.ts statsFor` passed it to a query as an episode number: `invalid input syntax for type integer:
    "Infinity"`, a 500 from `GET /api/seasons/{id}/roster` on every read, for everyone with default settings (only someone who
    hid sports scores, or played only at their own pace there, got an answer). Production has no sport's season yet (the backup
    of 2026-11-14: six shows, none a sport), so nobody met it. The fix: the query reads up to the largest episode number when the
    mark is everything. Proof: `node scripts/dev-test/check-sports-explorer.js --case=sweep` (all 67 read routes under a season
    and a league, as someone told everything and as someone who hides scores: no server error). **Noticed on the way:** the dev
    server kept serving the old module after the file changed, until the route file itself changed; a check that still fails
    after a server fix may be reading a stale server.
73. **`GET /api/leagues/{id}/ruleset/shared` fails for every league** (found 2026-11-14 by the same sweep; not a sport's):
    `error: operator does not exist: uuid <> text` in `db/league-rulesets.js listShared` (`excludeLeagueId`). Its own header
    says nothing links to it yet (a future copy-browsing screen), so nobody can reach it from the app. Fix when that screen is
    built, or cast the id; the sweep counts it as known so a fix shows.
74. **A game scored by a sport's stats: what each athlete has scored** (found 2026-11-14 on the real lineup sheet).
    - **Fixed that day:** every athlete read "0 pts" on the lineup sheet's tiles and in the cast (`game-view.ts castOf` added up a
      show's moments, and a sport has none). An athlete's points are their stat lines' at the game's table now
      (`StatsLogic.scored`), as far as the viewer is told. Unit test in `tests/gameplay-explorer-sports.test.js`.
    - **Still wrong, the same root (the screens' week and athlete breakdowns read a show's scoring events):** "Your sheet" has
      no week by week for a stats game (`weeksOf` and `teamEpisodeBreakdown`: a seat's weeks come back empty, though the
      season grid and the table are right); a person's sheet, an athlete's sheet and the waivers' free agents
      (`waiver-view.ts`) show no stat line. These need the athlete's line shown (which stats, how many, what each paid), which
      is a design: **Designs needed item 35**, and BACKLOG 43's sports screens.
75. **A sport's game speaks in a show's words in places** (recorded 2026-11-14 from the real page, sheet and routes of a
    generated NFL game; `.ui-atlas/explorer-page/sports-page.json`). The page's own words follow the show's row ("Game 3",
    "Your Game 3 lineup"), but:
    - How it plays: "once someone picks a contestant", "Before each episode, start two", and the table as its keys in the order
      the database keeps them: "2 a 2PT, -1 an INT, 10 a PA0, 4 a PTD ..." (never "4 a passing touchdown"; the spec's own
      order, passing yards first, is lost once the league is saved);
    - the season grid's caption: "Each square is that episode's points";
    - the lineup sheet: "Episode 3 · change anything until ...", "Saving doesn't lock anything. Airtime does.", "Airs Sun";
      tiles show a first name and no position (AVERY, not a quarterback);
    - what the server says when it refuses a lineup: "At most 2 active castaways", "This episode has started -- lineups are locked";
    - the Episodes tab's line for the game: "All safe · 3 of 3 still in after this episode";
    - How it works for the season: a show's rulebook ("Ways out: Eliminated, Quit, Removed", "Won a challenge/competition"),
      "13 contestants."; the season's stats: "contestants", nothing through the games played;
    - "Spoiler protection is off: you see results as they come" on every sports page, for someone who turned nothing off (the
      setting for a sport is "Sports scores too");
    - a field's game (found 2026-11-14, points by place, `sports-places-page.json`): How it plays names its places by key ("by
      POS: 25 for 1st ... by SPR: 8 for 1st ... by QUAL: 10 for 1st", never "for finishing 1st", "in the sprint", "in
      qualifying") and its counts too ("15 an ALB, 5 a BFR, 3 a BS3", never "an albatross", "a bogey-free round", "a run of three
      birdies"); F1's team lists each driver as "Still in"; the sheet calls a golfer a contestant and an event an episode;
    - tennis (found the same day, points by a match's format, `sports-tennis-page.json`): "30 an MP, -3 an SL, 14 a WRET1" and
      "scheduled for 5: 5 a W, 2.5 a CS ..." (five what: never "in a best-of-five match", "a set lost", "a win when the other
      player retires in the first set").
    **How sure:** the league was written by the explorer with the generic format and no rulebook, so the words that come from a
    league's format ("contestant") may read right on a league made through Start a game once its show is set up; the keys, the
    grid's caption, the sheet's "Episode" and "Airtime", the refusals and the Episodes line come from code that has no sport's
    words to use. Confirm on a league made the real way when the sports screens are reviewed (BACKLOG 43). Nothing here scores
    wrong.

76. **A lineup locked by its week said "Locked at airtime"** (**fixed 2026-11-14**, found that day on the real page by the
    explorer's second sports slice). A sport's game that locks by the day or the week locks a lineup when the first game of its
    day or week starts, which can be days before its own. For such a lineup the game's strip read "Locked at airtime · scores
    hidden until you reveal" (nothing had aired, and there was nothing to reveal), Your sheet's week said "Yours to change until
    it airs. Nobody sees it before then." (it couldn't be changed), and the server refused a change with "This episode has
    started -- lineups are locked". Now the view says which lock it was (`game-view.ts` `LineupMove.lockedBy`: 'day', 'week' or
    null), the strip reads "Locked when the week's first game began", the week "Locked when the week's first game began. It
    plays as it stands.", and the refusal "This week's lineups are locked -- its first game has started" (the day's likewise).
    Words through the impeccable skill's clarify pass (the one fact, no action left, what happens next). Proof: unit tests
    (`your-move.test.js`, `gameplay-explorer-sports.test.js`), the real route (`check-sports-explorer.js --case=locks`) and the
    real page (`check-explorer-page.js --only="sports locks:"`). **Left for the sports screens (BACKLOG 43):** the lineup sheet
    itself can't be opened for a locked week to see it, the page doesn't say when the lock fell or when the next lineup opens,
    and with several games in a week next week's lineup can't be set until this week's are played.

77. **Head to head by a sport's categories drew a points game's page** (**fixed 2026-11-14**, found that day on the real page by
    the explorer's third sports slice). The NBA's own categories game showed a season grid of zeros, "0" for every seat under
    PTS and "2nd of 3 · 0 pts" for you: nobody's record anywhere, though the record is how the game is ranked. The page's
    grammar already asked for a record table (`rank.by: categories`: table 'wl'); three places only knew 'matchups'
    (`game-plays.ts`, the grid's kind; `game-page/model.ts`, a row's value, its unit and the big graphic). It reads as head to
    head does now: each week W, L or T with the categories each side won, the records ("13–3–2") under "W–L", and your last
    week ("Game 2 final: you beat Bo · you're 12–6, 2nd"). Roto keeps its points table. Proof: a unit test in
    `gameplay-explorer-sports.test.js` and the real page (`check-explorer-page.js --only="sports categories:"`). **Left for the
    sports screens (Designs needed item 35):** none of the categories themselves is shown anywhere, and roto's season grid
    shows each week as 0.

78. **The unit suite's read of every local league checks a sport's league without its sport** (found 2026-11-14). "every league in
    the local database round-trips through its spec" (`tests/game-spec.test.js`) checks each league's spec with no context, and a
    sport's own sizes need the sport's (the NBA's lineup of ten: "A lineup starts 1 to 8"). It failed `npm test` when the
    browser check left a generated NBA league up (the check closes its last case now, so it passes); a real sports league on a
    local database would fail it the same way, though the server, which checks with the season's context, takes it. Fix when
    one exists locally: check a league scored by a sport's stats with its season's sport context, or leave such a league's
    sizes to the server's check.

79. **A field's season game asks for a lineup with nothing to decide** (found 2026-11-14 on the real page by the explorer's
    fourth sports slice, points by place; `.ui-atlas/explorer-page/sports-places-page.json`, screenshot `05zzs`; the sixth
    found tennis's the same, `sports-tennis-page.json`). The app's own defaults for golf's season (every tour) draft six and
    start six, F1's and NASCAR's five of five and six of six, and a card's (tennis's, MMA's) six of six: no bench (`src/lib/sports/defaults/*.json`, "start 6 bench 0"). The page still says "SET YOUR GAME 3 LINEUP · Change
    until ..." (the game's strip, as for any move still to make; Tonight's dock not looked at), and the sheet says "Start 6 of your 6. Tap to start or bench. Your last
    lineup carries over unless you change it." Tapping benches a golfer, so the only thing the control can do is lose points.
    **Why it matters:** a move that's always due and always pointless teaches everyone (Joanna first) to ignore the dock, and
    the one thing a field game does want each week (who's playing the event at all) isn't asked. **The decision (the user's):**
    give a field's season a bench (draft eight, start six: who you start is then a real weekly call, as in real fantasy golf,
    where not every golfer plays every event), or make such a lineup no move at all (all set, every holding counted, as the
    short game is). Nothing scores wrong. Not fixed: it's the game's design, not a fault in the code.
    **Decided (the user, 2026-11-14): give them a bench** (the example given: draft eight, start six), so who you start is a
    real weekly call. To build: each such season's defaults (`src/lib/sports/defaults/*.json`: golf's tours, F1's, NASCAR's three,
    IndyCar's, tennis's, MMA's) draft about two more than start; new games only, nobody's existing league changes.
    **Built 2026-11-14** (branch explorer-sports): the six season specs draft two more than they start (golf's tours 8 for 6,
    NASCAR's three series and IndyCar's 8 for 6, F1's 7 for 5, tennis's and MMA's 8 for 6) and each league's standard bench
    (`slots.bench`) is 2, so the page's sizes say the same; their `about` lines say "start six each ...". Only the defaults a new
    game starts from: a league keeps the spec it was made with. Golf's best ball still drafts six (its best four count; not a
    season game). Proof: `check-sports-explorer.js --case=tables` on all 18 such pairs (95 of 95: tables, grids and privacy agree),
    `tests/sports-spec.test.js` and `sports-categories.test.js` updated for the new sizes.

80. **A lineup that locks game by game told a live player they were catching up** (**fixed 2026-11-14**, TEMP-UI; found that day
    on the real page by the explorer's seventh sports slice, a slate locking at each game's start; `sports-slate-page.json`,
    screenshots `05zzz` to `05zzz3`). A sport's week of several games where each player locks when their own team's game starts
    (closes 'game') stays open after the week's first game. An hour in, the Your moves sheet said "Episode 3 · change it until you
    reveal it" and "Saving doesn't lock anything. Revealing the episode does." to a live player (both false: nothing about a reveal
    locks it), Your sheet's week said "Yours to change until it airs", and nothing marked who was locked: the only sign was a
    refused save ("Not saved: Avery Alvarez's game has started: they stay in your lineup until the day's over"). Now the view says
    the lineup locks game by game (`game-view.ts` `LineupMove.eachGame`: who is locked now, the week's last start), and the sheet's
    subtitle, footer and Your Move's line say so ("change anyone until their game starts", "Each player locks when their game
    starts.", "Each player locks at their game · all by ..."), a locked player's tile reads "Locked · game on", and tapping it
    explains instead of building a save the server refuses; Your sheet's week, which said "Airs Sat 6:36 PM" of a week begun an
    hour before, says "Under way · all locked by Sun 6:36 PM". Words through the impeccable skill's clarify pass. Proof:
    `your-move.test.js`, the real page (`check-explorer-page.js --only="sports slates:"`). **Left for the sports screens
    (Designs needed item 38):** when each player plays this week, and what each game did.

81. **A slate week whose first game is postponed still locks at that game's start** (found 2026-11-14 on the real routes by the
    explorer's last sports slice, a game called off: `node scripts/dev-test/check-sports-explorer.js --case=calledoff`, part 5,
    its NOTE). A league's slate (a week of several games) locking by the day or the week: `air-times.ts` stamps the week's lock
    at its first game *played* (`sportLocks`, `PLAYED`: "one called off locks nothing"), but the week's own air time is its first
    game's start, postponed or not (`slate.ts` sets `season_episodes.air_at` to the earliest of its linked games' starts), and the
    engine takes a stamped lock only when it is earlier than the air time (`state-logic.js` `closedForPlay`). So when the week's
    first game is postponed, everyone's lineup still locks at that game's scheduled start, hours before anything is played (in the
    check: the second game three hours later; on a real NBA or NHL week, a day). Server and runtime agree; the code's own comment
    says otherwise. **Why it matters:** a rained-out opener locks a week of lineups early, the night people set them. **To fix**
    (small, the engine lane's): read a slate week's lock from `locksAt` whenever one is stamped (or have `slate.ts` leave a game
    called off out of the episode's air time). Then `check-sports-explorer.js --case=calledoff`'s NOTE turns into a pass, and the
    campaign invariant `sport-locks` (`campaign/case.cjs`, which restates today's rule: a slate week at its air time) changes with
    it. Not fixed: found the day before the design round; nothing scores wrong.
    **Decided 2026-11-14 (the user, taking Claude's recommendation): Fix it: a slate week whose first game is postponed locks at its first game played.** **Built 2026-11-15** (the rule-fixes session, engine lane): `closedForPlay` takes the stamped lock (`ep.locksAt`, the first game played) whenever it's there, later than the air time too; the lineup's "Locks …" and "Change until …" read that lock (`LineupMove.locksAt`). The campaign invariant `sport-locks` restates it (a slate week at its first game played). Proof: `sports-hook.test.js`, `check-sports-explorer.js --case=calledoff` part 5 (the NOTE is two checks now: open an hour past the postponed game, locked at the second's start; on the code before, the NOTE printed). **Noticed, not fixed:** that case's part 4 ("benching E … still refused by both") fails around midnight Eastern on the code before this step too: its holding lock lasts to the end of the game's Eastern day and the part has no day-edge guard, unlike part 3 (the next sports session takes it).
82. **A playoff in a stage that ends at the merge is placed after its final was played as an ordinary week** (a question; found
    2026-11-14 building the design round's staged pilot, confirmed on the real routes: `node scripts/dev-test/check-stages-explorer.js
    --case=h2h`, its NOTE). Head to head on a stage that ends at a phase (`span.to: { phase: 'merged' }`) places its playoff by the
    stage's end (`MatchupLogic.lastOf`: the span's end), and that end is known only once the merge episode's results confirm it. So
    before those results everyone is shown the merge episode as an ordinary matchup (Ann against Bo, no round) and sets a lineup
    for it; after them, that week *was* the final (Bo against Cy, Bo champion), and Ann's matchup that week is gone from her record.
    Server and runtime agree (the engine's own rule). No generated specimen has one (no staged game is head to head at all): the
    staged pilot puts its playoff in the merged stage only. **The question:** refuse a playoff on a stage whose end is a phase (the
    engine's `specProblems`), place it by a fixed episode only, or play the stage's playoffs in the next stage's first weeks? The
    runtime and the generator play it as the engine does now (`stage-matchups` allows it: the final is the stage's end).
    **Decided 2026-11-14 (the user, taking Claude's recommendation): Refuse playoffs on a stage whose end is a phase (the engine's specProblems): a matchup is never rewritten into a final after it was played. A staged game puts its playoff in its last stage.** **Built 2026-11-15** (the rule-fixes session, engine lane): `specProblems` refuses playoffs on a game or a stage that ends when a phase starts, on a stage the next one's format change or 'next-stage' fallback ends, and on a stage copied at every change (`on.again`); words through the impeccable skill's clarify pass: "Playoffs need a set last episode: this ends when a phase starts, so a week already played could become its final. End it at an episode, or put the playoffs in the last stage". Roll's redraft drops them there; the explorer's generator (proof-family-64) puts a staged playoff on the last stage only, and `stage-matchups` fails one on a stage that ends at a phase. Proof: `stages.test.js` "BACKLOG 82", `check-stages-explorer.js --case=h2h`.
83. **At its own pace with exclusive teams, a waiver week runs the moment everyone owed a replacement has claimed** (a question;
    found 2026-11-14 building the pilot with an exclusive draft and waivers; the server's own rule: `waivers.js` `syncPaced`, "settles
    as soon as everyone owed a replacement has a claim in", proven on the real routes by `check-waiver-commissioner.js
    --case=paced-undo`). With swaps in the week, anyone who isn't owed a replacement and hasn't claimed yet loses their swap the
    moment the last owed person claims, hours before the week's own time: in the situation `xw-waivers-run`, Ann's claim at
    1 PM ran a week due at half past midnight. Bo's swap went in because he claimed first; had he waited, he'd have had none. The
    page says nothing of it ("Set your Episode 5 lineup"). **The question:** keep running at once (and say so on the waivers
    screen), wait for the week's time when the window has swaps, or wait until everyone has revealed the week's episode?
    **Decided 2026-11-14 (the user, taking Claude's recommendation): When the window has swaps, the week waits for its set time; it runs early only when nobody could still use a swap. Own pace never costs someone a swap because of someone else's timing.** **Built 2026-11-15** (the rule-fixes session, engine lane): `WaiverLogic.runsEarly` (the server's `syncPaced` and the runtime's call it): before its time only once everyone owed has a claim in and nobody who could still swap (swaps left, someone to drop, a free agent) hasn't claimed. The situation `xw-waivers-run` now runs at its time. Proof: `waivers.test.js` "At its own pace a week runs before its time", `check-waiver-commissioner.js --case=paced-swaps` (new: open after Ann's claim, run after Bo's, both doors).
84. **The overall of a game in head-to-head stages adds points, while each stage says most wins wins** (a question; found
    2026-11-14 on the staged pilot's real page, `.ui-atlas/situations/staged-merged.txt`). The overall by points
    (`overall: { by: 'points' }`, the only overall the runtime connects) adds each stage's table total, which for head to head is
    the points a seat scored, not its record. How it plays says both: "Overall, each stage's points add up" and, for the stages,
    "Each episode you play one of the others head to head: more points wins it. Most wins at the end wins." So a seat that won
    every matchup can finish the overall behind one that lost them all but scored more. Server and runtime agree. **The question:**
    is points the overall a head-to-head game in stages should have (then the page has to say so), or should it be wins (an overall
    by stages won, or by places, both still gaps in the runtime: their own proof)?
    **Decided 2026-11-14 (the user, taking Claude's recommendation): The overall of a game in head-to-head stages goes by places (each stage's finish), not points; until the runtime and engine have an overall by places, the page says plainly that the overall is points.** **Interim built 2026-11-15** (the rule-fixes session, engine lane): beside head-to-head stages an overall by points reads "Overall, it's points, not wins: what you score in each stage adds up." (`describe.js`; words through the impeccable skill's clarify pass). Proof: `stages.test.js` "BACKLOG 84". **What's left:** the engine already plays an overall by places (`StageLogic`), but the explorer runtime connects only points (`runtime-profile.cjs`: "by places or stages won needs its own proof"). Next: an oracle for the overall by places over head-to-head stages and its route check, then make places what such a game gets (the default in `fullStaged`, Roll's redraft, the generator and the staged pilot), and the interim words go.
85. **A failed read on Tonight never says so** (found 2026-11-14 by the design round's Phase 0 census, the Atlas's
    `tonight.error` fault case: `.ui-atlas/stories/phase0/census/atlas-tonight.error.jpg`). Fifteen seconds after the read fails
    the page still shows its loading skeleton: no message, no retry. Seen through the Atlas's injected fault only; the app's own
    error path wasn't traced. **Who takes it:** the Tonight round (the design order's step 3), or a small fix before it.
86. **The reveal's opener doesn't use the show's art** (found 2026-11-15 by the census with the fixtures dressed in art:
    `.ui-atlas/stories/phase0/census/reveal-sam-1.jpg`). "Previously on the couch" is type on black even when the show and the
    season have art set, though the brief asks for a visual "last time on" recap. **Who takes it:** the Episodes and reveal round
    (the design order's step 4).

87. **Settling a side bet after an episode can flip a head-to-head week already shown as decided** (**built 2026-11-15**, see "As built" at its end; **decided 2026-11-15** by the
   user, to build: side bets count in the matchup and **the AI settles them** with the episode's final results, from the
   research that already answers every open bet (db/episode-research.js openBetsFor; today it only suggests, bets/[betId]/
   suggested-answer, and the commissioner taps). **The commissioner can challenge an AI call and change it**; their answer wins
   and the page says it was changed and by whom. My reading, for the user to correct: a bet the research couldn't answer stays
   open for the commissioner and counts for nothing until settled; a week is final once its final results are in, as results
   are now. Also found: the new game page's Settle sheet never shows the AI's answer. The question as it was asked: found 2026-11-15
   by the design round's step 2, the `show-side-bets` situation on the real routes). A Weekly Lineup's week counts the lineup's
   points plus that episode's side bets (game-view.ts LineupWeek.total), and head to head compares those totals. Bets are settled
   by hand after the results, so a matchup reads one way at the reveal and another once someone settles: in the situation, Cy's
   +2 for a right call turned Bo's Episode 4 win into a tie (Bo 3-1 to 2-1-1, Cy 0-4 to 0-3-1), days after everyone had seen it.
   Options: (a) side bets stay out of the matchup's score and count only toward points for (the tie-break); (b) they count, and a
   week stays open until its bets are settled (the page says "waiting on side bets"); (c) as now, and the page says when a week
   changed after the fact. The test the rule answers have used: what a player would call fair without reading the rules. Waits on
   the user; the engine lane builds whichever.
   **As built (2026-11-15, branch `explorer-sports`, not pushed):** every season sync (src/lib/server/season-decisions.ts, which
   every way results arrive ends in) settles each episode's bets once its final results are in, from the research's stored
   answers (src/lib/server/bet-settle.ts; the engine's rule is BetLogic.settleByAI). It marks the calls only when the answer is
   high or medium confidence and every call was among the guesses the research was shown (a league catching up when it ran isn't
   asked); otherwise the AI's answer is kept on the bet (`bet.ai`) and shown, already chosen, in the Settle box of whoever runs the
   game. A mark by hand records who made it (`bet.settledBy`); the AI never settles that bet again. The page says "Settled by the
   AI: Yes. <why>", "Changed by Ann. The AI said Quinn." or "Settled by Ann"; a player sees "Waiting on whoever runs the game: the
   AI wasn't sure"; on early results, "Settled with the final results". A copy for someone behind leaves the AI's answer out.
   No push of its own (the final results' push covers it). Production's 2026-11-14 backup has no unmarked bet on a finished
   episode, so the deploy moves no past week. Checks: tests/bet-settle.test.js, scripts/dev-test/check-bet-settle.js (real SQL
   and the real sync), the situations `show-bets-settled` and `show-bets-waiting` (runtime core-runtime-44: the aiSettle action).
88. **The draft room and the waivers sheets name athletes by first name, with no position** (**fixed 2026-11-15**: both read the
   season's roster on the phone through one hook, src/new/sports/faces.ts useCastNames, and name every cast member through
   `castName`, with the position on the lines beside it; a show's cast keeps its first names. Seen at 390 on `nfl-waivers-open`
   (story-situations.js's waivers sequence); the draft room isn't rendered on a sport (no situation drafts one). Noticed 2026-11-15 by the game
   page's readiness step, not fixed there). The game page and its sheets now say an athlete's surname and a defense's nickname
   (`castName`, src/new/show/moves.ts, Designs needed 42), because their faces carry a position from the season's roster
   (src/new/sports/faces.ts useWithRoles). The draft (src/new/show/draft.tsx) and waivers (src/new/show/waivers.tsx) sheets
   read their own faces, which carry none, so a sport's draft says "Jordan", "A.J." and "New" (the Patriots' defense). Fix:
   give those faces their roles the same way and pass them through `castName`; the waiver line on the game page already
   looks them up. For the sports round; no show is affected.
89. **Cast properties: what a show sorts its people by, researched for every show and usable in a game's rules** (noticed
   2026-11-15 by the design round's step 5, Players / Cast; widened the same day by the user: "games around Below Deck depend on
   this: draft one deck team member, one interior", "draft two men two women", "one person from each tribe", "one veteran and one
   newbie"). Today the cast prompt (src/lib/game/formats/cast-prompt.js) asks only a name, a photo, a starting group (when the
   rulebook says the cast is split) and a secret role (The Traitors); only a sport's roster fills season_cast.role; the Below
   Deck rulebook names no departments; the engine filters a pool by a sport's position or one group (PoolLogic) but has no
   "one of each" composition rule. The direction (not yet planned in detail):
   - the rulebook declares the show's properties (name in the show's words, values or free text, fixed or changing, public or
     secret), asked universally by its research, never hard-coded per show;
   - the cast prompt asks each person for those, from the show's own billing and coverage, "not stated" allowed, never
     guessed (gender only as the show presents its cast, more than two values allowed);
   - a changing property (tribe, department, a promotion, a firing) is a dated, spoiler-guarded fact, like a tribe swap;
   - one engine rule: N where a property has a value, or one from each value, shared with a sport's lineup positions;
   - the cast tab shows the main property under each name (step 5 built the line from season_cast.role) and groups or filters
     by any; a secret property never shows or rules until revealed.
   - bios (the user, 2026-11-15, after step 6's draft sheets): what the show bills for each person (hometown, age, occupation, a
     line), researched with the cast and shown on the person sheet, so a draft before the premiere says who someone is (the
     plan's "Bios", chunks 2 and 3).
   Planned 2026-11-15: docs/PLAN-cast-properties.md (seven chunks; its four questions decided the same day). **Waits until the
   design round is done** (the user, 2026-11-15); the round's draft room, waivers, lineup sheet and cast tab leave room for it.

90. **A sport's draft ranks by projections: preseason and current values per athlete** (the user, 2026-11-15, reviewing the
   design round's step 6: "we might want to get sports players pre season and current projections... once we have it, it
   probably should be the default sorting in drafts"). Today a sport's draft list (src/new/show/draft.tsx DraftList, step 6)
   ranks by the pool's own order (season_cast.sort_order: the roster's order, best first only where the roster was recorded that
   way) and shows a "so far" line only once box scores exist, so a preseason draft has nothing to rank by. Open: whether ESPN's
   feeds carry projections (a player's projected season or week, or an ADP), or another API is needed (docs/PLAN-sports-data.md:
   APIs first, never ChatGPT for stats); how often a current projection refreshes (docs/HOSTING.md's limits). Once it exists:
   the draft list's default sort, a line on each row ("Proj 212 pts"), and the same in waivers' free agents and the lineup
   sheet. Later feature; not planned.
91. **Backstage › Waivers › settings: the toast's Undo may not put a feel back** (noticed 2026-11-16 readying the design round
   to merge; live on master, since src/new/backstage/waivers.tsx is the same there). scripts/dev-test/check-new-backstage-ii.js
   taps Casual on Weekly Lineup's waiver settings, then the toast's Undo: the game stays on `waiverFeel: "casual"`,
   `replaceRule: "always"` (expected balanced, whenShort). The Undo calls `backstage.undo(batch)` with the batch the settings
   write returns (`SettingsSheet` write → `onUndo`); either the write returns no batch for a feel, the undo doesn't restore those
   keys, or the check's 1.5 s wait is short. **The same check passed it on a rerun the same day** (147 of 147), so most likely the
   wait: flaky, not broken. Not investigated further. Who takes it: a Backstage step (the settings track, design round
   step 12) or a small fix session.
92. **Backstage says "All clear" above "Results · Episode 8 · 5 waiting for you"** (noticed 2026-11-16 in the live look after the
   design round's push, on the real couch's Survivor 51; not touched by that push). Needs you reads "You're all caught up · Next:
   Episode 9 airs Wed", while the Results row counts five waiting. Either they count different things (the desk's queue against the
   game's own unaccepted answers) and the words should say so, or one is wrong. Who takes it: the settings track (design round
   step 12), or a small fix session.
92. **A new game type: Guess who hooks up** (the user, 2026-11-16: an idea to explore eventually, not planned). Each player
   makes X picks, each pick a pair of cast members they think will hook up; one person can be in more than one pair. Settling it
   is the existing custom-moment path: the maker adds "hooked up" as the season's own moment, the feasibility ask rates whether
   research can answer it from recaps, and research then asks it every episode (the user: the engine should take user-defined
   questions into its research patterns; ENGINE-CAPABILITIES w048's "the new-moment path"). What's missing is the answer: a pair
   of people (item 94). Also open: when picks lock (before the season, or each episode), the points (each pair right; more for a
   pair nobody else picked?), and the shows it fits (Love Island, Too Hot to Handle, Below Deck, The Challenge). Keep the words
   tasteful: what the show itself shows.
93. **A public library of games people made** (the user, 2026-11-16: an idea to explore eventually, not planned). Games people
   make can be saved to a public collection. Making a game, you can browse it, upvote or downvote a game, and start from one and
   change it; the change makes your own copy, never altering the saved game. At a game's end its players could be asked whether
   they liked the game type, and the maker offered "Publish your game? 3 players said they liked it." Open: what's published (the
   game's rules only, never its couch, people, picks or results; a show-specific game versus one that works on any show of its
   kind), the maker's name or not, moderation (names and words someone typed, reports), ranking (votes, plays, likes at the end),
   and how it meets Made-for games (G5's season library from the desk's Setup) and Randomize.
   Belongs with the wizard's redesign (design round step 12): browsing the library is a third door beside typing a game and
   Randomize.
94. **Two answer kinds the engine doesn't have: a pair of people, and pick as many as you think** (the user, 2026-11-16: "that's
   big"). Today a question's answer is one person, a fixed few, yes or no, a number, a choice, a ranking, chips or a wager
   (ENGINE-CAPABILITIES "How you answer"). Missing:
   - **A pair** (or a group): an answer about two people together, each settled by a moment that names both (a hookup, a
     showmance, an alliance, who voted for whom, a duo in a challenge). Item 92 needs it; so does any "who with whom" question.
     Research would record the moment with both names (today a moment is about one person, or a group the format forms).
   - **Pick as many as you think**, each person settled on their own: "pick everyone you think will have an on-camera
     confessional this episode", "everyone who cries", "everyone who gets a rose". Open: the scoring, since picking everyone
     must not win (right ones score, wrong ones cost; or scored against the count; or a cap), and a "nobody" answer.
   Both reach every place an answer goes: the spec's check and words (describe.js), the question sheet and its pickers, the
   bots, the explorer's runtime and oracle, and the GPT's drafts. Add them to the capability tracker
   (tests/fixtures/engine-capabilities.json) when planned.
95. **Two things noticed polishing The numbers' game lens, left alone** (2026-11-16, the GameTable change: first names, holders
   as faces, the pinned columns on the ground; story frames in .ui-atlas/stories/numbers-holders/, `scripts/dev-test/story-numbers.js`):
   - **The show lens names by `c.first` with no clash rule.** NumbersTable (src/new/show/cast.tsx), the other lens of the same
     section, would show two Kristins as "Kristin" twice; the game lens now reads "Kristin C." and "Kristin F." (castName). The
     show's own stats carry no game, so it needs the clash count over `d.cast`.
   - **Your sheet's season table (PersonSeason, game-week.tsx) still lets weeks scroll past its pinned PTS into the gutter** on a
     season longer than the sheet's width (the bug GameTable had: its pinned cells stick inside the scroller's padding and nothing
     covers the 16px beside them). Its opening scroll and even widths are fixed (the shared useOpenOnLatest); the gutter cover
     (GameTable's `gutter` spans) isn't applied there. Also not rendered: a sport's game table (a position beside the faces caps
     them at three slots), only reasoned.
   Who takes them: a small polish session, or the stat table's next round.

96. **Noticed in the person-sheet round, left alone** (2026-11-16; docs/design-round/drill-person-sheet-check.md, "Open"):
   - **A week's tag on the game page can take white ink on a light colour** (2.6:1: "EP 6" on the show's hsl orange). game-week.tsx
     `inkOn` reads only hex; tune-in.tsx `colourOf` hands it `hsl(31 68% 56%)`, whose numbers it takes as red, green and blue.
     Read as hsl it's light (luminance about 0.36) and wants plate ink. Found by Impeccable's detector in the page.
   - **Something wrong is offered only from the Cast tab's drill**: the game page's DrillSheets passes no `onFlag`, so a
     castaway's sheet over a game has no ⋯ on its story.
   - **A failed stats read leaves the drill's castaway, stat, pick and compare levels pulsing**: they check `!stats.data`, never
     the error (the Cast tab itself says "Couldn't load the cast").
   - **The sheet's header slices text as content scrolls under it** (ui/sheet.tsx, every sheet): a hairline or a short fade under
     the header.
   - **Holdings and a property's changes are told in a castaway's story but not counted in the chart's "moments"**, so a column
     says 2 over three story lines.
   - **FIXED 2026-11-17 (the user: "fix backlog 96"):** `selectors.ts finishOf` (the format's end-of-game exits: the winner's, a
     finalist's) sets the season stats' `finish`; `src/new/show/finish.ts goneHome` decides every grey and red on the sheet, the
     face wall (a Finalists group, the winner first), the rank view, boards, the story and the hub's recap; a game's own faces grey on
     `knocked`, not `left`; a game sheet's row says Won or Finalist. tests/finish.test.js. Was:
     **A season's winner is styled as eliminated** (found 2026-11-17 on the real Survivor 49): Savannah, the Sole Survivor, gets a
     greyed photo, "Out · Ep 13 · Sole survivor", Episode 13 in live red and "Ep 13: went home" under the chart. The finale's exits
     ("Sole Survivor", "Lost Final Tribal (Jury Vote)", "Lost Fire-Making") are stored as eliminations, so every face and chart reads
     them as leaving (DESIGN.md: Live Red is for someone going home). A wrong fact on screen, so fix it any time; it touches faces
     everywhere (the wall, boards, the sheet). The data to fix it from exists: each rulebook way out has a `means` ('winner',
     'finalist', 'out'…), and an exit's method matches its way (by `aliases.exits` or name), so cast-stats.ts can say who won or
     reached the end without matching words (both checks of the scored sheet ranked it first, 2026-11-17).
   Who takes them: the inkOn fix any time (a wrong colour on screen); the rest the app-wide drill pass (docs/design-round/drill-audit.md).

97. **A scan for near-twin components (TABLED, the user, 2026-11-17)**. The two castaway sheets that stumped a relative were two
    parts built in different rounds that drifted apart (step 2b's game sheet, step 5's Cast tab sheet, cast properties added to
    one). Scan `src/new` for others like it: parts that show the same thing, or nearly, in two places (a person, a ranked list, a
    week's points, a face strip) and could be one part, or at least look and behave as one. **Not automatic:** each pair goes to
    the user with what differs and why it might, and the user decides "make them one", "make them match" or "leave them".
    **Who:** a later session, when the user picks it up.

93. **AI access and money: free, the DIY link, paid, and ads (TABLED, the user, 2026-11-16)** (number 93: explorer-sports' 92
    may land first). The structure, what we pay and could earn at today's size, 300 and 1,000 people, the "ask only the
    difference" rule for shared research, the DIY link only ChatGPT reads once, our own GPT posting answers back, and a
    brainstorm for staying free with a convenience barrier: docs/PLAN-ai-access.md (its Status says where it was left and when
    to revisit). **Who:** the user decides the six open choices; then a design round for the mocks.

98. **check-sheet-back.js's TV guide case is stale** (noticed 2026-11-17 in the drill pass): it waits for the hub's guide sheet
    (`[data-guide-sheet]`) the way the guide opened before step 7's redesign (2026-11-16) and times out; the other 13 cases pass,
    stacked sheets included. Who takes it: the next session that touches the hub or the back checks.
99. **check-new-draft.js is stale since the design round's step 6** (noticed 2026-11-17 in the drill pass's step 2b): it waits for
    the room's old ticker (`[data-ticker]`, gone with the one clock in d4e4684c, 2026-11-15) and fails there, after 23 passes; its
    tile taps further on (Pick for riley's confirm bar, the blind draft's four taps) also predate a tap opening the castaway's
    sheet, so each needs the sheet's foot (Draft, Add to your team). Step 2b pointed its queue step at the row's Draft
    (`data-queue-draft`), the row holding a door too. The room's doors themselves are covered by check-drill-doors.js's draft set.
    Who takes it: the next session that touches the draft room or its checks.

100. **A sport's episode page reads as a show's** (noticed 2026-11-17 in the drill pass's step 4b): a game's page on the Episodes tab
    (episodes.tsx EpisodeBody, the night) says "Nobody went home this episode" under an empty Out, for a sport whose episodes are
    games; it should lead with the game itself (the score behind Hide scores, the box score's best), and its words with the show's
    (a game, not an episode). Step 4b sends an athlete's log to the game's sheet instead. Who takes it: the sports track.

101. **check-sports-links.js's mark cases are stale since U1's sports scores** (noticed 2026-11-17 in the drill pass's step 4b): a
    sport's results show straight away unless someone hides sports scores (U1, d7a6d216, 2026-11-09), but 13 of its cases still expect
    people and stats held back by the viewer's mark ("held back until you've seen it", "at Game 0: no so far", "through Game 1");
    they fail the same with and without step 4b's roster and log changes, and its linking and people cases pass. They'd hold for
    someone with Hide sports scores on. Who takes it: the sports track, with the check's next change.

## Decided against (don't re-propose without new information)

- **An AI draft/lineup/pick advisor for players** ("Coach"): rejected. Feels like pay-to-win inside
  a friend group, and worse, a live-research advisor working off an airing season risks leaking a
  real result dressed up as a statistical lean — directly against the spoiler protection
  (`SpoilerLogic`, the results-in reveal gate, catch-up mode) the rest of the app is built around.
  Any future "skip the effort" feature for players, not just commissioners, should stay retrospective
  (season recaps, shareable cards) rather than touching an in-progress decision.
- **A guided onboarding tour / coachmarks:** revived 2026-10-10 as a scripted mock-mode season; see
  `docs/PLAN-guided-tour.md` (which answers the staleness concern).
- **A notification bell/inbox:** the action bar already lists everything actionable, and a bell
  would mostly repeat it. Revisit only if people ask for "what did I miss" history.
- **"Survived the episode" points:** skipped. It's a baseline everyone earns, so not much signal.
- **"Made the merge" / "made the jury" points:** skipped.
- **"Vote cancelled by an idol" (−0.5), "Shot in the Dark played and safe" (+1) and "played an idol
  for someone else" (+1):** offered, not chosen.
- **"Each vote against you":** clashes with the existing "+1 survived votes".
- **Confessional counts, "big moves", blindsides:** not on the wiki, so research would guess.
- **Chat in spoiler protection:** someone reading chat is choosing to risk spoilers.
- **Tags on chat messages saying which league they're about:** one conversation, no tags.

## Done (2026-10-01/02)

From the original feedback triage, all done:

- **Bugs:**
  - league dropdown flash
  - sidebar overflow
  - click-outside closing the league menu
  - catch-up "reveal episode 14" after the finale
  - draft order sorting
  - missing original draft picks
  - Research missing pre-league episodes
  - mobile theme picker cut off
  - Scoreboard roster detail
- **Tweaks:**
  - wider sidebar
  - no post-merge checkbox
  - episodes collapsed by default
  - bets → predictions
  - Research defaults
  - hex colour input
- **Design:**
  - lighter dark mode and dark logo
  - theme picker in Account
  - Wiki Connector trimmed
- **Features:**
  - season results card with confetti
  - top-3 players per episode
  - spoiler protection
  - notification tests
  - lineup redesign and scoring chart
  - goat penalty
  - action bar
  - starters carry over
  - Overview Board as this week's starters
  - invites in the bar
  - episode reminders

Since then:

- **Scoring:**
  - endgame jury votes
  - fire-making +2/−1
  - chosen for a reward
  - the advantage-knowledge category, tracked at 0
  - predictions capped at 1–3
  - scoring categories in the chart and League Settings
- **Locks:** lineups and picks lock at air time.
- **Starters board:** live starters, with an optional "hide until it airs" (grey "?" squares).
- **Scoreboard:** bars as a centre-line chart (gains up/losses down, benched outlines), per-event
  breakdown lines, one legend per page.
- **Linked leagues:** shared chat, one reveal for all, reveal lines in chat, automated chat lines
  retired.
- **League swipe** with a live peek and a rolling title.
- **What's New:**
  - one-time popup with stacking releases
  - Admin preview
  - the More/sidebar link with "See older releases"
  - "Show me" links
- **Admin:**
  - spoiler-free review and research
  - auto-research "N hours after air"
- **Notifications nudge** in the action bar.
- **Chat:** fills the screen and stays above the keyboard; correct unread badge.
- **Mobile fixes:**
  - More-sheet links
  - swipe-down to close
  - tab bar painting on the season-complete page
- **Demo seasons:** fixed for all of the above.
