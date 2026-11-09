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
    - **No made-for games, no betting-game role, no scoring themes on the rail**: G5 isn't built, so Start from is the engine's own
      kinds that fit the rulebook (rulebook-fits), each rolled for the stretch. Different scoring cycles engine-made ways from the
      season's own rulebook (No points lost, Big moments only: the user's call, 2026-11-09) until G5's themes. (G5, then the wizard
      reads its ideas.)
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

44. **Own pace on a live game with no limit** (the user, 2026-11-09, backlogged: "the former is simplier"). A person set to
    play at their own pace on a live game keeps their moves open until they mark the episode watched, even past the next
    episode's airtime, so they can fall more than a week behind. What's built first stops at the next airtime
    (docs/PLAN-own-pace-games.md, "One person at their own pace on a live game"). Needs: their copy more than one episode behind
    on a live game (the catch-up loop allows it), the game's other weekly windows (waivers, matchups) waiting on them or not, and
    what the couch sees meanwhile. (After the capped version, if asked.)

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
