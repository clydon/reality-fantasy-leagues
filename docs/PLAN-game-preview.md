# A game's preview, on the real screens (the user, 2026-11-18)

> "Still want a game preview ... every game, before creating, you are able to preview the stages: (the starting phase; draft, picks,
> whatever. later stages. quick actions. the game page. the player stat sheets. etc). is that possible? we could use as much real data
> that we have then randomize values so no spoilers exist. thisll be dynamic and show the real ui as it will be created rather than
> duplicate code."

**Status:** P0 (the proof) done 2026-11-18, waiting on the user's pick of A or B (the user, 2026-11-18: "Prove it first, then pick"). It builds on the gameplay explorer (docs/GAMEPLAY-EXPLORER.md), the user's bench decision (plan §3.4 of
docs/PLAN-GAMEPLAY-SCENARIO-EXPLORER.md: "no duplicated response layer, so new screens, API changes and engine updates appear by
themselves"), and Round 2's answer that the preview is the real screens (docs/PLAN-start-a-game-redo.md).

## What a preview is

Before a game exists, Try it plays it forward on the app's own screens, with this season's real cast, faces, groups, episodes and
moments and made-up results, so it spoils nothing and nobody can mistake it for the real season.
- **The stages, as a stepper:** the start (the draft, the first picks or the first questions), each episode's move and its result, a
  stage's change (a new draft at the merge), the finale.
- **At each stage, the screens it touches:** your move (Tonight's quick move, the dock), the game page (standings, the matchup, the
  week), a person's sheet and a cast member's or athlete's sheet with their weekly graphs, the reveal.
- **Your couch, made up around you:** the couch's real names and faces, their moves made up by the engine within its rules (the
  user, 2026-11-18: it's the game you'd play with them). Computer players come in only where the couch has no one else.
- **Said plainly:** "Sample results, not the show's" on every frame; Shuffle gives another season; nothing in it saves.

## What exists

- **The engine half: the explorer's runtime** (`tools/gameplay-bench/explorer/runtime.cjs`). It takes a full spec on a seeded world
  that keeps the names and photos it's given and makes up the results ("missing released-event facts are generated from the seed and
  context once"). It plays lineups, picks, answers, reveals and results through production rules, and names any point to return to
  (checkpoints, forks, replay). Twenty-six capabilities run (head to head, lives, banks, phases, secret roles, a captain…), plus
  sports statistics in seven slices.
- **The screens half: the bench's live tier** (`tools/gameplay-bench/live-db.cjs`). It writes a case into the local database as
  zt-gb- rows and frames the real app pages through the real routes, as each person. That's the user's own rule, and it already
  shows Tonight, Episodes, the hub and the game surfaces for a generated world. But it's for development: the local database, the
  Atlas proxy.
- **The old practice round** (`src/lib/tour/practice.ts` `buildPracticeState`): a throwaway copy of a joined league, for three game
  types, on the classic screens. It shows the idea works on real screens, and the new design doesn't use it.

## The gap, and two ways to close it

The real screens read the real routes, and the routes read the database. A preview in production needs those routes to answer from a
preview world without writing a row anyone else can read.

| | **A. A preview database** | **B. The same builders, in memory** |
|---|---|---|
| How | Every route's database access goes through one pool, so a preview request (`/api/preview/<id>/…`, from the same pages with their fetch prefix swapped) runs the **unchanged route handlers** on a separate, disposable database. The live tier's materializer moves into the app, copies the season's cast and episodes in, and writes the made-up results there. | Each route splits into a load (the database) and a build (pure). A preview loads from the explorer's in-memory state instead, and the builds are the production functions. The pages are unchanged; their fetches go to `/api/preview/<id>/…`. |
| No duplicated code | Yes: the route handlers themselves. | Yes: the builds are the production functions (the runtime's gameView already works this way). |
| Writes | Into the preview database only, deleted when the preview closes or after a day. | None. |
| Speed | Seconds to open (rows written), about a second per stage. | Well under a second per stage, since state is replayed from the seed. |
| Cost and risk | A second database (a Neon branch or another database within Free's limits), a cleanup job, and keeping its copied season fresh. | The work of splitting each route that a previewed screen reads (games, space, episodes, stats, how it works, the draft). |
| First proof | Today, on development: the live tier frames these screens for a world built from Survivor 51's real cast. | After the first routes are split. |

**Recommendation:** prove it on development now with the live tier (a session, no product change), then build **A** for the first
release. It reuses the materializer and every route as they are, and previews are rare (only while making a game), so the second
database stays small. Move to **B** route by route as each gets the split anyway; once every previewed read has one, the preview
database goes.

## What it can't show yet (each said on the frame, never hidden)

- **A live draft:** the runtime seeds who owns whom; it doesn't run the draft room. Until it does, the start shows the teams the draft
  would make, and the draft room is a gap to close (the runtime's acquisition step).
- **Waivers, a postponed game, a week in progress (sports):** the runtime's gaps.
- **A rule the engine doesn't play:** no preview, as no game.

## Steps

- **P0. The proof (development):** the live tier on a world built from Survivor 51's cast and episodes, a Fantasy league from the
  gallery, made-up results: the screens at the start, Episode 9's move, the game page after Episode 10, a castaway's sheet, the
  merge's new draft, the finale. A screenshot story; the user decides the shape before any product work.

  **P0 done (2026-11-18, lane `preview`; the story https://claude.ai/artifact/UHMKK2YhTSFwLurnUFViFk; waiting on the user's A or
  B).** `scripts/dev-test/preview-proof.js` (`record`, then a run; `--dry`, `--at=<stop> --keep`, `down <key>`): the gallery's
  Fantasy league with "A new draft at a stage" on Survivor 51's own page facts (the start route's wizard page, read as a throwaway
  zt-gb couch: next episode 9, the merge still to come), so two Weekly Lineups (draft 5 in private, start 3), Before Merged from
  Episode 9 and Merged from the merge, points added up; the explorer's runtime on a world in the season's 21 castaways, photos, art
  and 13-episode calendar (Episode 9 on the real night), every result made up, the merge made Episode 11; the zt couch's names
  (Alex, Riley, Jordan, Sam) as zt-gb users; the live tier into this lane's database. Frames at 390 as Alex, 25 in the story: the
  start, Episode 9's move, after Episode 10, a castaway's sheet, the merge's draft, the finale. No product change.
  - **On the real routes, agreeing with the runtime:** Alex's Episode 9 lineup (the real Your moves sheet, `PUT
    …/episodes/<ep>/lineups/alex` 200); **the merge's draft made in the real draft room** (Alex starts it and picks and locks on
    screen; the couch lock the engine's teams through `…/draft/blind/lock`; the server's revealed teams equal the runtime's own
    draft), so "the draft room isn't run" is now true only of the start's draft; Alex's reveal of the finale (through 13). The
    bench's route checks (agreement and spoilers, all four people) found nothing; no page errors. Speed: the case opens in 1.6 s,
    a step syncs in 0.5 s.
  - **Recommendation: A for the first release, as above**, with four things the table didn't list: a clock per request beside the
    request's pool (the routes read the server's now; the live tier moves the calendar instead, so the preview shows the wrong
    night: Episode 11 "Wed, Nov 25, 11:46 AM"); a fence on side effects for preview requests (the push-nudge sheet after Save,
    couch tells, notifications, chat); a fuller copy of the season (its own rulebook: Survivor 51 has 37 moments, the format 27;
    bios and properties; tribes; art); and made-up results shaped like the season's (below). B first would need games, space,
    episodes, stats, the cast sheet, lineups, the draft room and the reveal split before their first frame.
  - **Product findings (not fixed; for the design round):** (1) **the finale's reveal ranks an ended stage**: "You're 1st, 4.5
    ahead of Jordan" is the first stage's final table, while the game is 2nd, 1.5 behind (a bug); (2) after the merge Tonight says
    "All set for Ep 12" and the Merged stage shows "SET" for everyone before its draft is made; (3) a game in stages is called
    "Stages" (its page, Tonight, the sheets), its stages "Weekly Lineup", and "Redraft at merged"; (4) Tonight's mini for it reads
    "0 of 0 still in · All safe"; (5) Your moves offers the waiting Merged stage and the overall as tabs; (6) the overall's page at
    the start shows no stages and no lineup due, after results it does; (7) five each from seven at the merge gives four
    near-identical teams (one castaway on all four): the gallery doesn't size a later stage to who'll be left. Items 2, 3 and 5
    overlap Designs needed 33.
  - **Tool findings:** the runtime dealt a game that starts mid-season from the whole cast (every seat began with castaways
    already gone, and shared teams repeated): **fixed** (`runtime-data.cjs` `lateDraft`: from who's still in, each seat in its own
    seeded order; a game starting before anyone has gone is unchanged; 90 of 90 runtime tests). The bench's Publish gives an
    episode one moment: the proof draws each moment at Survivor 51's own rate per castaway still in (about two a night) and mirrors
    its exits per episode, at random people. The world can't carry the season's rulebook (it keeps the format's moments). The
    dress carries names and photos, not tribes or bios. The bench's GIFs are placeholders labelled with zt usernames. No frame says
    "Sample results, not the show's" (P1's screen).
- **The visual story, first build (2026-11-18, after decision 3):** six cards (the season, the draft, each week, the race, the
  merge, the finale) from made-up seasons the engine played headless, typical shown as ticks of 30 seasons, the merge's overlap
  flagged with its fix redrawn in place; through Intent, PFD and Impeccable, one check and one batch of fixes
  (docs/design-round/preview-story-spec.md, -first-view.md). The story: https://claude.ai/artifact/KzNrXUwPap7yTpFsGoueKQ; two
  choices wait on the user there. This is P1's direction; the A-or-B decision now covers only the cards' drill-ins.
- **P1. The preview's own screen** through the design process: the stepper, the screens at each stage, Shuffle, "Sample results",
  leaving back to the game's screen with nothing changed.
- **P2. A, built:** the preview database, the request-scoped pool, the materializer in the app, the cleanup, the spoiler check (no
  real result reaches a preview, nothing from a preview reaches a real read).
- **P3. Breadth:** every gallery base and sport game type previews, or says which gap stops it; a check opens every one.
- **P4. Toward B:** routes split one by one as they're touched; the preview database retires when the last previewed read has its
  split.

## Decided (the user, 2026-11-18)

1. **Prove it first, then pick A or B.** P0 is a development-only screenshot story; the first release's approach waits on it. The
   recommendation after the proof stays A.
2. **Who plays beside you:** the couch's real names, their moves made up by the engine.
3. **What the preview is for (after P0):** someone setting up a game wants to know it plays correctly and as they expect. A tour
   of the app's screens answers "what will it look like", which matters less ("step back and really judge what is most useful for
   a user"). And the answer is **a visual story, not words and paragraphs: quick, intuitive and to the point** ("the solution to
   this problem isnt words and paragraphs, its a visual story, it should be quick. intuitive. and to the point"). The real screens
   become a drill-in from it. A or B waits until that story is designed, since it only decides the drill-in.
4. **The last card's buttons:** "Go back" (to the setup) and "Create this game" (the one yellow): "i think the last button should
   be go back or create this game".
5. **The story belongs to the bench:** "we will want this to be a part of the test bench so when we are brute forcing through
   hundreds of games we can also look at these previews and say 'yes that makes sense and is an accurate representation'". The
   user also asked whether the story is accurate to the played game and follows the game's UI when it changes.

   Where the first build stands on that (2026-11-18):
   - **From the engine, as the app shows them:** teams, each castaway's points each week, who started and who sat, totals,
     places, who went home. They are read from the production game view (`project(game, person).game`) of the explorer
     runtime, which P0 showed agrees with the server (Ep 9's lineup, the merge's draft, the finale).
   - **Restated in the story:** the best and worst lineup of a week (the top and bottom picks by points, added up). That is
     the rule of this game only; a captain or a multiplier would make it wrong. "Alike" and "on every team" are counts over
     the teams, not rules.
   - **Not dynamic:** the data is a file the script writes, not a live run; the six cards are drawn for this one game shape
     (stages and a merge draft) and use none of the game's own components, so a change to the game's screens doesn't reach
     them; the fix redraws the merge only.

   For the bench it needs: (a) the story built from any definition and seed by a bench adapter, cards chosen by what the game
   has (a draft, a weekly move, stages, questions), each card a production read and nothing restated (the lineup's best and
   worst from the engine's own scoring); (b) the cards drawn with the app's own pieces (faces, standings rows, the lineup
   tile) where they exist, so a UI change shows up in them; (c) a bench view of a case's story, and a contact sheet of many
   cases' cards at 390 to scan; (d) a sample of cases checked against the real routes on the live tier, as P0 did, so
   "accurate" is a check, not a claim; (e) the campaign runner for many seasons (30 take about 50 s today).

   **Done the same day (the user: "Yes"):** the cards rebuilt on the game's own components and the production views, the fix
   played whole, the typical counts made with `bestOf` in the page (docs/design-round/preview-story-spec.md, "The rebuild"). Still
   for the bench: (c) to (e) above, and the views read live rather than from the script's file.
6. **A 1:1 view from preview to game:** "I'm still struggling to see the 1 to 1 view from preview to game. Like I said previously
   we want to see the tonight game section, games tab, draft stage, quick actions, game page, etc. to really indicate a 1:1 we can
   use a 'iPhone/phone free screen' where we put the real game screen snapshot in that view." Each card is now a moment shown as
   the real screens in a phone frame, from a season played on the real screens (scripts/dev-test/preview-story-shots.js, the live
   tier); the lines and checks read the same run's views. This is P0's live tier inside the story: for the product, the A-or-B
   decision again decides how a preview gets its screens.

7. **What a preview may show of the real season:** "Show the real results up to where I've watched, and make up only what comes
   after." Up to the viewer's mark, the world carries the season's real results (who went home, the moments); from the next
   episode on, the bench makes them up. Nothing real is shown past what the viewer has seen.
8. **The game's names:** "fix the names where the gallery makes them. But the gallery is the wizard lane's code, so don't change
   it here; the wizard lane will do it, and your screens follow once it's merged." Nothing changes here.

## The bench's previews (the user, 2026-11-18, for the design sweep)

"At some point we'll test every screen of every game through the bench and these previews. What I care about most: the player
always knows what to do. I never want someone to feel lost in the app, or bored because every game seems plain. Each game, within
the app's tone, needs bold soul and character." The sweep is §6B of docs/PLAN-GAMEPLAY-SCENARIO-EXPLORER.md (main worktree): it
judges, in order, that the player knows what to do, that each game has soul, and that the preview tells the truth and gives the
lay of the land. This section builds the preview so the sweep can use it.

### One preview maker, three ways in

- **The core:** `tools/gameplay-bench/preview/` makes a preview of any v2 definition the bench runs (its own cases and seeded
  worlds, or a gallery game on a real season's dress), with no one driving it. It opens the definition in the explorer's runtime,
  materializes it on the live tier (zt-gb- rows, the real routes), plays the season moment by moment, shoots each moment's real
  screens as the viewer at 390, runs the truth checks, and writes `preview.json` (the moments, their screens, the checks, the
  production views the cards read) beside the shots.
- **Callable as the runtime is:** the CLI (`node scripts/gameplay-bench.js preview --file=<definition> --out=<dir>`), HTTP
  (`POST /__atlas/bench/runtime/preview`, the Atlas bench's own router) and the browser transport
  (`window.__GAMEPLAY_EXPLORER__.preview(input, options)`), all calling the same core.
- **Seen:** the story page reads any preview (`/start/preview-story?preview=<id>`), and a sheet shows many side by side at 390
  (`/start/preview-story/sheet`), each its own phone.

### Who moves

- **Everyone's moves, the viewer's too, are the computer players'** (E1, `src/lib/game/bot-logic.js`). On a copy of the game's
  state the seat is made a computer player, E1 decides (a blind draft's lock-in, a lineup, a pool's pick; a sheet's answers once
  E1b lands from `wizard`), and the move is applied as that person's own action through the runtime, then synced. One rule for
  every game, nothing written per game; when E1 grows, every preview's couch plays better. On the screens the couch stay people
  with their real names (decision 2).
- **Until E1b is merged,** a sheet's answers use the bench's own valid move for the kind (a seeded choice among the question's
  options from the projection): one chooser per kind of move, not per game, gone when E1b arrives.
- **Results:** real up to the viewer's mark (decision 7), the bench's seeded publish after it.

### Moments from what each game has

A game's preview leads with what makes it that game. The moments come from the game itself, read from its production views (the
moves they offer: a draft, a lineup, a pick, questions; stages; lives and outs; the finale), never one template filled in:

| The game has | Its moment | The real screens | Tells you |
| --- | --- | --- | --- |
| (every game) | The game | the Games tab, the game page's How it plays | what the game is, how to win |
| a draft | The draft | the draft room as it opens, the teams revealed | what you start with |
| a weekly move (lineup, pick, questions) | Each episode | Tonight's strip (the move, its lock), the quick action it opens | what you do each week, by when |
| results | After an episode | the game page's season, Tonight's game section | where you stand, how points come |
| stages | The stage changes | the new draft or the next stage's page | when the game changes shape |
| lives, a pool | Someone's out | the game page with the out marked | how you lose |
| (every game) | The finale | the game page at the end, the reveal | who wins and why |

The screens are the app's own routes, the same for every game (Tonight, Games, the game page, the draft room, the reveal); the
quick action is whatever Tonight's strip opens. A moment the game doesn't have isn't shown.

### The truth check, widened to what's due

At every moment, by machine:
1. **What's due.** The engine knows what's due for the viewer: `actionItems` (src/lib/game/action-items.js: a draft to lock in, a
   lineup, a pick, a prediction, a waiver) with each one's deadline, plus a sheet's open questions from the projection (the one
   kind actionItems leaves out). Tonight's strip, the Games tab and the game page must say the same: a move due when one is, and
   "all set" only when nothing is.
2. **The words against the season.** Standings shown against the engine's (the game page's season, the reveal's table), and the
   known checks (a "still in" line in a game nobody's knocked out of, your team's numbers against your score).
3. **In plain words on the frame:** "App bug: says 'All set', but your draft is due" (the user: "App differs" wasn't clear).

### Judged by the lay of the land

After a game's preview someone knows **what the game is, what they'll do each week, when moves lock and how to win**. Each has
its moment above; the design round judges the story by whether a first-time viewer can answer all four, and a preview that leaves
one out fails it.

### Cost, and what to share or cut

Measured: one season on the real screens took 113 to 125 s for 13 screens (Alex's moves made by clicking, two draft rooms worked
by hand, a fixed 2.5 s wait on every page, a fresh login five times). The three samples, each as set and with the fix (6 runs),
took 11 to 13 minutes; the 30 headless seasons for what's typical, about 50 s.

| | Now | For the sweep |
| --- | --- | --- |
| Seasons per game | 3, each also with the fix | 1 (Shuffle and fixes on request) |
| Screens | 13, every moment | the game's moments only, about 8 |
| Waiting | 2.5 s after every page | until the page's own ready mark |
| Moves | clicked on the screens | E1's, through the runtime (the routes' writes are api-checks' job) |
| Logins | one per phase | one per case |
| What's typical | 30 seasons in the page's data | 10 seasons, headless, in the campaign runner |
| Workers | one | 4, each case its own zt key on the lane's database |

Expected: about 40 s a game on one worker, so 300 games in under an hour on four. **Share:** a season's world (its cast,
episodes and results) is the same for every game on it, so it's materialized once and each game added to it; a screen two games
draw the same (the same state) is shot once. **Cut:** the fix's run unless a check flags something.

### The first slice, built (2026-11-18)

- **The maker:** `tools/gameplay-bench/preview/` (preview.cjs, players.cjs, clock.cjs), called the same way from the CLI
  (`node --env-file=.env.local scripts/gameplay-bench.js preview --file=<definition> --out=<folder>`), HTTP (`POST
  /__atlas/bench/preview {input, app, id, seasons}`; a named app's database from the worktree list, no port probed) and the
  browser transport (`window.__GAMEPLAY_EXPLORER__.preview(input, options)`). Each made the same Survival pool in 42 s.
- **The three games** (scripts/dev-test/preview-games.js, Survivor 51 with its real results through Episode 8, results after made
  up at the real season's rates): the Fantasy league in 6 moments and 14 screens (88 s), the Prediction sheet in 4 and 7 (71 s),
  the Survival pool in 4 and 8 (54 s), each with 10 made-up seasons for what's typical. Every route check agrees but the spoiler
  oracle's control, which a season without couch chat can't run ("oracle-blind").
- **The truth check:** the due check agrees at every moment of every game; the words checks found four app bugs, all in the
  Fantasy league (Noticed, not fixed: 1 to 4).
- **Learned:** the engine's actionItems and the computer players read the computer's clock (`Date.now()`), so asked on a season
  dated by its real calendar they go stale once the real day passes an airing (at 01:00 UTC the real Episode 9 aired, and the due
  check and every lineup failed). The maker asks them at the season's own clock (clock.cjs). Rounding the live tier's time shift
  (one airtime across previews) was tried and dropped: the app's now has to be the runtime's.
- **Cost, measured:** 54 to 88 s a game, one season, about 8 to 14 screens, 10 headless seasons for what's typical. A page loads
  in 1 to 3 s; the rest is the draft rooms (12 to 14 s each), the season's nights (20 to 35 s) and the route checks (3 to 6 s).
  300 games is about 6 hours on one worker, under 2 on four, before the plan's cuts (sharing a season's world, shooting a screen
  two games draw the same once, a typical-free first pass).

### The first slice

Three games that look nothing alike, each with the truth check: the gallery's **Fantasy league** with a new draft at the merge (a
draft, a weekly lineup, stages), its **Prediction sheet** (questions each episode) and its **Survival pool** (a pick a week, out
when it goes home), on Survivor 51 with its real results through Episode 8. Then the design round for the per-game cards, the
plain-words marks and the side-by-side sheet: Intent, Perception-First Design and Impeccable once each, one check, one round of
fixes, a screenshot story at 390, and a pause.

### Round 5: the app's path, and a draft that waits (2026-11-19)

The user, on the first slice: "are the moments and previews in a logical order? as in shown where they will exist, their overview
sections, then the specifics?", "we should fix the unstarted draft", "we probably should address the other fixes too".
- **The moments** stay in the season's order. **The screens inside each** now run as the app's path (src/new/preview/moments.ts
  PATH): where you meet it (a show tab), what a tap opens, what it leads to; an app bug keeps its place on the path. The story's
  tabs read as the path, joined by the app's chevron; the sheet sets every phone to the same moment and step and names each
  column's screen (docs/design-round/preview-story-spec.md and preview-story-first-view.md, "Round 5").
- **The maker** shoots the draft's Tonight before the draft starts (the runner's Start the draft, or everyone else's wait, against the
  engine's runnerItems), starts the draft with the viewer's own Start when they run the game (else by the runner's route, so any
  viewer works), Tonight before the finale's reveal, and Your team after the first results (the team check reads its numbers). A
  check that the runner's draft room has its Start goes with the draft. `viewerId` makes the same game from anyone's seat: the first
  slice's script adds "fantasy-player" (the second person).
- **The app's fixes** for "Noticed, not fixed" 1 to 4 (below), each held by the bench's checks on the real screens.
- **Cost, measured again:** Fantasy league 90 s (15 screens) as its runner and 90 s as a player, Prediction sheet 68 s (8), Survival
  pool 46 s (8), each with 10 made-up seasons; the path's extra shots cost about a second each.

## Noticed, not fixed

Found by the preview's real screens (2026-11-18). Round 5 (2026-11-19, the user: "we should fix the unstarted draft... we probably
should address the other fixes too") fixed 1 to 4 on this branch; what's left is the wizard lane's or a later step's:
1. ~~**Whoever runs a game isn't told its draft waits for them.**~~ **Fixed:** a draft with no time set is its Commissioner's to start
   (src/lib/game/action-items.js draftStartDue, runnerItems; not in actionItems, so the classic bar and the reminders read what they
   did), one of their moves on the home: the strip on every show tab says "Start the draft · Nobody can pick until you do" (the
   view's one yellow, tag Draft) and opens the draft room; the hub's plate and the game page say the same. Everyone else sees the
   strip quiet with an hourglass, "Waiting for Riley to start the draft" (src/lib/game/draft-soon.ts), never "All set"; a time set
   reads "The draft starts Wed 8 PM". The bench's due check reads runnerItems for a viewer who runs the game, so its separate start
   check went (docs/design-round/draft-start-spec.md, draft-start-first-view.md).
2. ~~**The finale's reveal shows one stage.**~~ **Fixed:** the reveal's standings beat ranks a game in stages by the whole game
   (src/lib/game/episode-view.ts mainRevealTable: a stage's table gives way to its game's, the overall).
3. ~~**Tonight's game section says "0 of 0 still in"**~~ **Fixed:** a game with no team of its own says its points (a game in
   stages: the overall), or "No team yet" before its draft (src/new/show/tonight.tsx yourLine).
4. ~~**Your team's numbers don't add up to your score.**~~ **Fixed:** in a game with a lineup, each castaway's number is what they
   scored for you as a starter, with what they scored on the bench beside it ("+3 benched"), anyone who scored for you and has left
   still listed, and predictions as a row of their own, so the column adds up to your total (src/new/show/game-week.tsx YourTeam).
   The bench's team check now reads the numbers on the screen.
5. **The game's names:** Fantasy league, Stages, Weekly Lineup, "Before Merged" and "Merged", "Redraft at merged" (the gallery's;
   the wizard lane fixes them, decision 8).
6. **A sheet's open answers get no reminder push.** Corrected (2026-11-19): the new design's strip, hub plate and game page already
   say them (src/lib/server/answers.ts questionMoves, read by /api/me/home); what doesn't is the hourly reminder job (db/reminders.js,
   whose REMINDABLE kinds are lineups, picks and predictions) and the classic action bar. A sheet's open questions live in its
   answers, not its league state, and which are open is answers.ts's rule (gameQuestions), TypeScript the job can't load under bare
   node. The fix is to move that rule into a plain module both read, then remind as a lineup does (24 and 2 hours before its lock):
   a backend step of its own, not done here.
7. **The pieces test fails on the gallery** (tests/pieces.test.js, "nothing in scoring reads a league type or compares one by
   name"): src/lib/game/start-gallery/index.js reads a league type. The gallery is the wizard lane's; it fails without this round's
   changes too.
