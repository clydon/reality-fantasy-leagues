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
