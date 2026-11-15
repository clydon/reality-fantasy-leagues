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

## 2026-11-15 · Census frames wait for Archivo; the "missing condensed font at 390" was one capture run, not a bug
- Decided by: Claude (from a re-run)
- Why: the census's 22:49–22:50 batch (bench-show-*) caught the dev server mid-recompile and shot the fallback face at every size;
  the 22:38 and 23:31 batches and the bench's own check are condensed, a probe at 390 through an Atlas frame and on :3000 loads
  Archivo at 62% stretch, and the same capture re-run renders condensed. census-app.js now waits for the face and fails without it.
- Rejected: changing the font loading (nothing in the app or the bench drops it).
- Rests on: scripts/dev-test/census-app.js capture(); .ui-atlas/stories/phase0/census/ timestamps.

## 2026-11-15 · Step 2's page spec: This week leads, the season grid stays, a matchup sheet is the grid's door
- Decided by: Claude (default, inside decisions 3, 5 and the lineup component)
- Why: R4's prediction for head to head is "who I play and my lineup"; the grid is the user's liked season view and already holds
  the record; a square's natural question is "what happened that week", which is the matchup, not the person.
- Rejected: a separate standings table beside the grid (the same fact twice); keeping the You section's full week-by-week body on
  the page (it's the person sheet, one tap away).
- Rests on: docs/design-round/step2-game-page-spec.md; phase0-first-views.md R1–R5.

## 2026-11-15 · An opponent's lineup and others' side-bet calls show at the lock
- Decided by: Claude (default; asked in the spec's open questions for calls)
- Why: the game already says "Nobody sees it before then" of a lineup; a call is the same kind of secret until the episode starts.
- Rejected: showing calls as they're made (copying is easy and the bet loses its point).
- Rests on: the lineup's own words on today's page ("Yours to change until it airs. Nobody sees it before then.").

## 2026-11-15 · Impeccable's critique questions go into the screenshot story, not a stop before fixing
- Decided by: Claude (from the user's process)
- Why: DESIGN-PROCESS.md runs the check once, fixes once, then the story and a pause; the critique's own "ask before acting" would
  add a second stop inside the round.
- Rejected: asking the critique's questions mid-round.
- Rests on: docs/DESIGN-PROCESS.md, "Bounded: no loops" and "What wins when they disagree" (the user's process beats a skill).

## 2026-11-15 · The game page's first build: decisions inside the round
- Decided by: Claude (defaults; each listed in the story's open items where the user may disagree)
- The move's plate appears only while it's due; a set lineup is one plain "Change your lineup" line; the lock is said once.
- A lineup that locks when its episode airs says "Locks when it airs" (the week's label carries the time).
- Own pace: the card offers "I've watched Ep N · Reveal" for the game itself (the own-pace plate's catch-up reveal); otherwise the
  show's one reveal on Tonight (B66: the reveal can't open over a game's page yet, so the page pushes Tonight's).
- Head to head never shows OUT: missing the playoffs is said in words, seeds and the champion sit under the record.
- The odd one out's opponent reads "The middle score", not "The median".
- The season grid's names are first names (long names cut there before).
- The opponent's lineup and others' side-bet calls show at the lock; the commissioner's bets to settle come first in the sheet.
- Rejected: a separate standings table (the grid already ranks with the record); a VS graphic (2026-11-12's direction: data, not
  theatre).
- Rests on: docs/design-round/step2-game-page-spec.md; step2-game-page-first-view.md (R1, R4).

## 2026-11-15 · Side bets' post and grade routes answer { ok } when asked quietly
- Decided by: Claude (a fix found building the round)
- Why: both answered with the league's whole state even under ?quiet, which carries results the poster may not have revealed (the
  new app's writes ask quietly for exactly this reason, data.ts send()).
- Rejected: leaving them (a spoiler in the network response).
- Rests on: src/lib/server/api-route.ts stateResponse; the bets and predictions routes.

## 2026-11-15 · Step 2b: the structural lens on the game page's drill tree
- Decided by: the user ("go", after asking for the bench, the league's other games and weekly graphs at every level, and that
  rounds never be only a repaint); the verdicts per level by Claude, in docs/design-round/step2b-drill-tree.md
- Why: step 2 kept everything under the matchup sheet as it was without asking whether that was enough.
- What: the league's other games on the page; a matchup's both full teams (theirs unsplit before the lock, since a split gives the
  lineup away); bench cost named as the swap, shows only (a sport's slots would make a plain top-N wrong); a person's season as
  one table (data round 3's C); a cast member's points each episode by what scored; an athlete's main stats game by game; an
  episode's games once.
- Rejected: "left on the bench" as the sum of the bench's positive scores (it overstated the cost: Di's +4 was 0.5); a second
  list of the same results on an episode's sheet.
- Rests on: docs/DESIGN-PROCESS.md "Not a repaint"; the 2b check (Impeccable 26/40, PFD 56) and its one batch.

## 2026-11-15 · Ship in clusters, review page by page (recommended, awaiting the user)
- Decided by: Claude (recommendation, asked by the user; not yet answered)
- Why: the pages share parts, so approving one alone means re-deciding them in context, and a half-new app shows two forms of one
  fact a tap apart. Cluster 1 = the game page, Tonight's game section and strip, the Games tab rows; cluster 2 = Episodes, the
  reveal, Players / Cast; cluster 3 = the rest. A ripple check each round; an optional per-account preview switch.
- Rejected: pushing each page when it's approved; drafting many pages before any review.
