# The design round's decision log

## 2026-11-14 · Phase 0's census renders today's app on the zt_nd couch, the Atlas's recorded couch and the bench's sports situations
- Decided by: Claude (default)
- Why: real renders at 390 of every surface in the situations the brief names, with fixtures that clean up after themselves
  (`scripts/dev-test/census-app.js`); the Atlas adds the recorded couch's art and its derived states; the bench adds a sports show,
  since no sports season lives in the local database.
- Rejected: a production backup copy (real people's data, and no gain for structure); hand-built mock states (the brief's rule).
- Rests on: docs/APP-REVIEW-DESIGN-BRIEF.md "Data, assets and reuse"; docs/DESIGN-PROCESS.md "The screenshot story".

## 2026-11-14 · The story flavor is grey-box only in Phase 0
- Decided by: Claude (default)
- Why: no story-show world exists in the bench and no story show in the local database; the guide fixture's talk show and series
  render, but with no game and no moments, so they show watching only.
- Rejected: inventing a story show's moments for the frames.
- Rests on: docs/DESIGN-ROUND-PACKET.md, "What the bench needs for the frame".

## 2026-11-14 · The "Castaways" tab on the guide fixture's talk show is a fixture artifact
- Decided by: Claude (from source)
- Why: the fixture inserts shows without terms; a talk show added through Add a show gets "Cast member" and the tab "Cast"
  (`termsOf` in src/lib/server/add-show.ts).
- Rejected: listing it as a product slip.
- Rests on: scripts/dev-test/guide-fixture.js line 37; src/lib/game/show-words.ts.

## 2026-11-15 · The zt fixtures can wear show art, opt-in; the census wears it by default
- Decided by: the user ("start now", on the recommendation to load fixture art first)
- Why: art-less fixtures made every frame plainer than production, which skews the identity question and every "soul" judgement.
- How: `scripts/dev-test/fixture-art.js` borrows the local database's real Survivor and Traitors art (show and season posters) and
  points the guide's talk show, series and same-night show at the project's generated atmospheres; the Drop Show stays bare as the
  no-art case. `--art` on new-, hub- and guide-fixture; census-app.js uses it unless `--no-art`.
- Rejected: on by default for every fixture (checks that assert on today's art-less pages would move); generating new art (the
  existing generated set covers the kinds).
- Rests on: docs/VISUAL-ASSETS.md; the shows table's existing art URLs.

## 2026-11-15 · A real NFL season, recorded once from ESPN, stands in for sports at real size
- Decided by: the user ("start now", after the recommendation and its one network step were named)
- Why: the bench's sports worlds had 49 generated athletes with letter tiles; the design round's sports check needs hundreds of
  real-looking athletes with positions, teams, headshots and real lines.
- How: `scripts/dev-test/espn-snapshot.js record` (about 190 calls, sequential, the app's own User-Agent) into
  `.ui-atlas/fixtures/espn/` (ignored: real names and headshot URLs stay off the public repo), in fake-espn.js's input shape;
  `check` reads it back through the app's own ESPN client. `tools/gameplay-bench/explorer/sports-roster.cjs` deals a pool by the
  bench's real-size shares. Wiring it into runtime-sports.cjs waits for the parallel bench session's commit (its files are in flight).
- Rejected: generated names at real size alone (the parallel session's `pool: 'real'` covers scale; real names, teams and headshots
  test what generated ones can't: long names, real photos, real position spreads).
- Rests on: docs/DESIGN-ROUND-PACKET.md "What the bench needs for the frame"; src/lib/server/sports/espn.ts.

## 2026-11-14 · Phase 0's check is the lay-of-the-land and busy tests on the census and the grey boxes
- Decided by: Claude (default)
- Why: PFD evaluate and Impeccable critique judge a built page; Phase 0 builds no page, only grey boxes of structure.
- Rejected: running both on grey boxes (they'd judge craft that isn't there yet).
- Rests on: docs/DESIGN-PROCESS.md step 4.

## 2026-11-14 · Phase 0's nine decisions, as recommended, with conditions
- Decided by: the user (taking Claude's recommendations, given in the session that wrote the packet)
- 1 Identity: keep "Lower Third" and reopen its density.
- 2 Quick moves: one strip in the same place on every show tab, opening Your moves; the dock and Tonight's carousel go. The strip says "All set for Ep N" when nothing is due: this supersedes the dock rule of 2026-10-31 ("never all set"), as the brief of 2026-11-11 asks.
- 3 Progress: one control per show replaces the header chip and every spoiler banner. It keeps a quiet "spoiler-safe through Ep N" inside it, and keeps a person's watched progress apart from each game's reveal (the brief).
- 4 Games tab: one row per game with a mini leaderboard, and each game's last picks (what everyone picked) one tap open, so the reason the tab was kept on 2026-11-08 (leaderboards and last picks) survives.
- 5 Game page: lead with this week (who you play, or your place and gap); the title moves into the bar; the setting chips go, and the rules they named stay findable in How it works.
- 6 Players / Cast: a different form per flavor (faces, a searchable list, characters), tied together by one person sheet.
- 7 TV guide: its own place, opened from an "On TV" row near the top of the hub that is really animated and noticeable (the brief: a tiny or static entry isn't enough).
- 8 Yellow fill only for what's due for you, one per view; the thin yellow chyron line stays as identity (line, not fill).
- 9 One person sheet, opening at the context you came from.

## 2026-11-14 · Two more shared parts: a reaction (GIF) and a chart
- Decided by: the user (taking Claude's recommendation)
- Why: GIF reactions are the user's model of easy, fun social and appear on Tonight, Episodes, Chat, the reveal and watch along; "fun data visuals for nerds" had no part, so each page would invent its own graph. The chart part is a grammar (axes, colours, labels, motion), not one chart type.

## 2026-11-14 · The owed decisions
- Decided by: the user (taking Claude's recommendations)
- Lineup component (data round 3): A (the expandable ledger) on the surface, B (two lineups on one shared points scale, the why of a week) one tap in; C (the matrix and trend) deeper, on the season view.
- Side bets: posting and settling are part of the game page round (on by default in Weekly Lineup; today you can guess but not post or settle).
- Rule questions (behaviour, not design; recorded in BACKLOG as decided, built by a rule-fixes session beside the rounds): B81 fixed; B54 counts; B58 a minimum time to claim; B62 counts from the stage's start; DN 32 a window turned off can reopen; B82 no playoffs on a stage that ends at a phase; B83 waits for the week's time when the window has swaps; B84 the overall by places (until then the page says points).
- BACKLOG 85 and 86 are fixes folded into the rounds that redesign Tonight, and Episodes and the reveal.
- The test behind the rule answers: what a player would call fair without reading the rules.
