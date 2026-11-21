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

## 2026-11-15 · Step 2c: one stat table, three lenses; matchups read across
- Decided by: the user (asked for side by side, QB against QB, and game-scoped scoring tables, then "yes run 2c now"); the
  pairing rules and encoding by Claude, in docs/design-round/step2c-compare-and-scoring.md
- Why: a matchup is read slot against slot in every fantasy app; a game's points belong inside the game, never on the show's
  tabs (Phase 0's decision 6).
- What: a sport pairs by position, the leftovers as Flex; a show pairs by rank only once scored ("Best", "2nd best"), two lists
  before; a pair opens the compare; the game's scoring table under Your team; yours and theirs in one pair of colours, a
  negative as a short outline.
- Rejected: pairing a show by slot (its slots are interchangeable, so the pairs would be invented); pairing a locked show by
  season points (a ranking nobody played); person colours on the compare (a third meaning for the same colour).
- Rests on: the 2c check (Impeccable 24/40, PFD 64) and its one batch.

## 2026-11-15 · Designs are judged on real people too: a real dress for the bench, and a real game
- Decided by: the user ("so I can see what a real game would look like"; "We could do the Patriots Lions game going on now");
  how, by Claude
- Why: generated names and letter faces hid real problems (athletes read by first name, a defense by the first word of its
  name, long real names cut off).
- What: `?dress=real` swaps a world's people for a real season's (Survivor 51's castaways and art from the local database; NFL
  athletes and headshots from the ESPN recording), keeping the bench's events; two real-game situations score one NFL game by its
  real box score, read by the app's own storedGame.
- Rejected: starting a real game in the app on Patriots vs Lions (the app refuses a game already under way, "picks closed at
  the start", and has no test clock); a live, in-progress view (no screen shows one: the live poller isn't on a page, and the
  bench lists a week in progress as a gap); Survivor 51's real results in the dressed worlds (the situations need their own
  states: a champion, a tie, someone behind).
- Rests on: docs/GAME-PAGE-SITUATIONS.md "On real people"; the story's "On a real game".

## 2026-11-15 · A game live is asked by the app, not the phone
- Decided by: the user ("make sure it's polled by the app, not the client, that way we can control polling as to not get rate
  limited"); the route's shape by Claude, the plan's own fallback
- Why: one place decides how often ESPN is asked, whatever the number watching, and ESPN sees our server only.
- What: `/api/sports/live/{site|core|web}/<ESPN's path>` (live-proxy.ts): live addresses only, a summary cut to what's read, 15 s
  at the edge, at most one ask per address every 10 s per instance, the last answer while ESPN fails; the pollers ask it by default.
- Rejected: a server process polling every live game (Vercel runs no always-on process, and its cron is daily on Hobby); keeping
  the answers in Neon (a write every few seconds a game: the transfer the chat polls once used up); phones asking ESPN (the
  user's call).
- Cost: Vercel's transfer, ~20 MB a phone an NFL game (HOSTING.md, Live games).
- Not yet: a screen showing a game live. It's a new display (a scorebug, the matchup with points moving, the plays that moved
  someone), for the design round; Patriots vs Lions was recorded live through the route to design it on.

## 2026-11-15 · The user's intent for every round, written down before a new session takes over
- Decided by: the user (asked that their intentions be recorded)
- What: data compared side by side; the whole game visible (benches, the league's other matchups); drill-downs with weekly
  graphs at every level; a game's scoring only inside the game; designs judged on a real game.
- Rests on: docs/DESIGN-PROCESS.md "What every round carries", quoting the user.

## 2026-11-15 · The game page as built through step 2c is approved; next, ready it to merge
- Decided by: the user ("We kept progressing and getting better so the latest drafts are best")
- What: steps 2, 2b and 2c as built (story version 4), with the real-game findings to fix. Next is a readiness step, not more design:
  fix Designs needed 42's ship blockers, sweep every game type on the new page (it draws every game, not only head to head), bring
  in master, the full checks once, then ask before the push.
- Recommended by Claude, not yet answered: ship the game page on its own (not waiting for Tonight's round), on a Monday or
  Tuesday, never an S51 Wednesday night.

## 2026-11-15 · Ready to merge: the ship blockers fixed inside the approved design
- Decided by: Claude (defaults inside the approved page; the user asked for these fixes and "no new design")
- Names: a cast member's or athlete's name where room is short goes through one rule (`castName`, src/new/show/moves.ts): a
  show's cast by first name; an athlete (a face with a sport's position) by surname, as fantasy reads a matchup ("Love vs
  Maye", "St. Brown", "Harrison Jr."); a team's defense by its nickname ("Patriots D/ST": its name is the team's, so the first
  word read "New" or "Green"); an initial only where two in the game would read the same ("S. Brown", "Mike P."). An athlete's
  own sheet is titled with their whole name. The couch's people stay first names.
- A one-game game (a team's next game: a span of one week) leads with its game: before it, no records ("0–0" says nothing);
  after it, the card is the result (both sides, the score, "Bo won by 1.7", "G 1 · Final"), never "Season over", a place, a
  bye or a line repeating the result; a game of two drops its season grid of one column, and the matchup sheet its records.
- A finished head to head with no champion (no playoffs) reads as your place, not as a matchup against "A bye".
- "Last week's stands in" only when one does: the view's `carried` now means a lineup actually carries in (a first week, or a
  lineup whose every starter has gone, carries none), and the lineup sheet's notes follow it.
- Both week-by-week tables (the game's scoring table and a person's season) open on their latest weeks with the leftmost one
  whole beside the pinned names, and the last whole before the pinned total.
- Found by the sweep and fixed the same way (Impeccable `clarify` for the words): How it plays leads with the game's line ("All
  season · Draft 3, start 2 · Only 2 moments count"), which the title card carried and the page had lost, so a game where only
  some moments count never said so; the card's standing line counts in the game's own measure ("3rd of 3 · 0 weeks won", lines,
  calls right), not always points; a staged game shows you in the stage being played again (the page had dropped the You
  section for every staged game); a compare chart's values go to its table when two side by side would collide.
- "Long names running over numbers" was the overlap report, not the page: a truncated name's text box runs on past its ellipsis
  unseen. The report (scripts/dev-test/overlaps.js, shared by the story's capture and check-game-page.js) now cuts each word to
  what clips it, its own box included, and counts a pinned bar or column as a layer of its own.
- Rejected: changing `ActiveRosterLogic.lineupIsCarried` (the engine's "not set for this episode", which other callers read);
  surnames for a show's cast (a show's people are known by first name); hiding a one-game game's grid when more than two play
  (it's their standings then).
- Rests on: Designs needed 42; the 2c story's open items; tests/game-week.test.js.

## 2026-11-15 · Side bets: the AI settles them, the commissioner can challenge; faces lose gold and teal
- Decided by: the user (after Claude's first recommendation, keeping bets out of matchups, rested on "a player settles them";
  the user pointed out the AI answers them, and the code showed it answers but only suggests)
- Side bets (BACKLOG 87): they count in a head-to-head week; the AI settles each with the episode's final results (the research
  already answers every open bet); the commissioner can challenge a call and change it, their answer wins, and the page says it
  was changed and by whom. A bet the research couldn't answer stays open for the commissioner and counts for nothing until
  settled (Claude's default). A week is final once its final results are in.
- Faces: gold and teal leave the default people palette, so gold only ever means due for you and teal a win; a person who has
  either gets the nearest hue left.
- Rejected: keeping bets out of matchups (bets lose their bite in head to head, and the reason, a player settling, mostly
  doesn't hold with the AI answering); a week waiting on a person to settle (the couch's habits leave weeks open); counting
  bets as now and flagging a flipped week.
- Rests on: bets/[betId]/suggested-answer/route.ts; db/episode-research.js openBetsFor; the fairness test the rule answers use.

## 2026-11-15 · Gold and teal out of the people palette: built
- Decided by: the user (the decision above); the slots by Claude
- What: the palette a face can be chosen from is six (Orchid, Ember, Lake, Rose, Sage, Bone; src/lib/people.ts). Someone who
  chose teal wears Lake and gold Ember, the nearest hues left, mapped when read (no migration: the stored hex stays, and the
  settings sheet shows the replacement as chosen). A face nobody chose keeps its slot by id, so only the teal and gold slots
  move: teal's to Sage, gold's to Ember.
- Rejected: teal's default slot to Lake, its nearest hue (Lake already has a slot; twice would leave four colours among faces
  nobody chose, and more of a couch sharing one); Bone as a default (it reads as the You fill); re-hashing every id over the six
  left (everyone's face would change).
- Not touched: the classic engine's player and tribe colours (state-logic.js PALETTE), which the new design's faces don't read.
- Rests on: tests/people.test.js; DESIGN.md "People colours".

## 2026-11-15 · Step 3's page spec: the progress control holds the reveal, the strip holds the moves
- Decided by: Claude (default, inside Phase 0's decisions 2 and 3)
- Why: decision 2's strip opens Your moves and decision 3's control is where you are; a reveal is a change to where you are, so it
  belongs to the control, and the strip then says the same kind of thing on every tab. The yellow follows the existing rule: the
  reveal is yellow only while nothing is due.
- Rejected: the strip carrying the reveal too (on Tonight it would say the reveal twice in one view, beside the control); a
  separate Up next plate (a fourth place for progress, Phase 0's R3 failure).
- Rests on: docs/design-round/step3-tonight-spec.md; phase0-first-views.md (Tonight, R3).

## 2026-11-15 · Couch pace on Tonight: data round 3's shared episode axis (A), compact
- Decided by: Claude (default: no choice was recorded for the pace component)
- Why: the brief asks for "the viewer, other viewers, latest released episode and current/next airing on a common scale"; A is that
  scale, and compact it fits the show bar where the numbered faces sit today.
- Rejected: B, the viewing matrix (a row a person: too tall for the bar; it suits the where sheet); C, the release timeline (a
  calendar scale reads poorly for a weekly show at 390).
- Rests on: docs/show-soul-review/tonight-data-round3-2026-11-12.md; APP-REVIEW-DESIGN-BRIEF.md "Component direction".

## 2026-11-15 · The Update episode popup's redesign waits; Tonight opens today's Where you are sheet
- Decided by: Claude (default, scope)
- Why: no popup option from data round 3 was chosen, and the popup is shared with the hub and Episodes; Tonight only needs a door to it.
- Rejected: building option A (the episode ledger) inside this round without the user's choice.
- Rests on: docs/show-soul-review/tonight-data-round3-2026-11-12.md.

## 2026-11-15 · Side bets settled by the AI: built
- Decided by: the user (the decision above); the defaults below by Claude, words through Impeccable's `clarify`
- The AI settles a bet only when it's sure: an answer of high or medium confidence, and every call on the bet among the guesses
  the research was shown. Otherwise its answer is kept and shown to whoever runs the game, already chosen in the Settle box ("The
  AI's answer: Yes, but it wasn't sure enough to settle it." and its reason); to a player, "Waiting on whoever runs the game: the
  AI wasn't sure".
- The challenge is the marks themselves: whoever runs the game taps one to change it ("Wrong? Tap a mark to change it."). The page
  says "Settled by the AI: Yes. <its one-line reason>", "Changed by Ann. The AI said Quinn." (you, when it was you), or "Settled by
  Ann" where the AI didn't. Changed back to the AI's marks, it reads as the AI's again.
- Once a person has marked a bet, the AI never settles it again; a later, surer answer can still settle one it left open.
- On early results a bet reads "Settled with the final results": the week isn't final until then, as results aren't.
- Rejected: settling low-confidence answers (the research's own "pieced together, or judged from a name alone"); a push per
  settled bet (the final results' push is the moment); a Recent changes line per AI settle (the commissioner's marks have none).
- Rests on: tests/bet-settle.test.js; scripts/dev-test/check-bet-settle.js; the situations show-bets-settled and show-bets-waiting.

## 2026-11-15 · Step 3's check: one batch, and the own-pace plate goes to the user
- Decided by: Claude (the process: one check, one batch, one confirming look)
- What: the batch in docs/design-round/step3-tonight-check.md, "The one batch". The own-pace plate taking the reveal two behind
  (PFD's finding 2, the critique's first issue) is not fixed: the spec kept the plate this round, so folding it into the control is
  a choice for the user, not another pass.
- Rejected: changing the clock's countdown inside the last day (the app's rule everywhere); snapping every size to DESIGN.md's ramp
  (app-wide drift, a DESIGN.md decision).
- Rests on: docs/design-round/step3-tonight-check.md.

## 2026-11-15 · The behind question: three looks mocked, B recommended (awaiting the user)
- Decided by: Claude (recommendation; the user asked for mocks because they don't want it to crowd the screen)
- Why: someone behind has either watched and not told the app (Joanna, the user's real case) or is catching up; the app can't tell, so it asks once with both answers one tap. B (the question is the control's line, Yes and Not yet beside it) adds nothing and takes 60 px away; A keeps today's height; C (a chip opening a sheet) costs Joanna a tap and a list.
- Rejected: inferring the answer (a wrong guess spoils or scolds); signals only order the answers.
- Rests on: the story https://claude.ai/artifact/2fSx1kXCBdjnTopGoXkwn2; src/new/show/behind-ask.tsx (TEMP-UI, ?ask=a|b|c).
- Also fixed: the reveal holds the yellow when every due move waits on it (watchAction primary), the step 3 story's first open bug.

## 2026-11-15 · Tonight's four choices and the behind question, decided
- Decided by: the user ("I like your recommendation with B. Let's pick yours then continue"), taking Claude's recommendations
- The behind question: B, built (behind-ask.tsx, progress.tsx; the switch and looks A and C removed). Not yet is kept on the
  device for now; it belongs with your mark on the server (a second phone asks again).
- The own-pace plate: folded into the control. Not built yet: its reveal is a game's own catch-up reveal (couches.catchUp),
  not the show's, so folding it changes the own-pace flow; the next session's first job.
- B3, "You're all set": the strip's lasting quiet "All set for Ep N", plus a one-off settle moment when the last due move is
  saved (strip.tsx, new.css .nd-settle). Built.
- The strip on the other tabs scrolls away with the content (as built).
- Data round 3: the shared episode axis A (as built) for the couch's pace; the episode ledger A as the "where are you up to"
  sheet, built in step 4 (it's shared with Episodes).
- Also: a sports game named by its type key reads by the type's name (GAME_NAMES: "Weekly Lineup", not "ACTIVE-ROSTER").
- Rests on: https://claude.ai/artifact/2fSx1kXCBdjnTopGoXkwn2; scripts/dev-test/check-strip-settle.js (all pass).

## 2026-11-15 · The own-pace plate folded into the control; Not yet on the server; Alex's strip timing found and fixed
- Decided by: the user (fold, and Not yet on the server: "Tonight's four choices", above); how, by Claude through Impeccable alone
  (a small change inside the approved step 3 spec, DESIGN-PROCESS.md "When not to use them")
- The fold: a game at its own pace on an aired episode (pace-plate.tsx `catchingUpIn`) has its move in the strip ("Set your
  lineup · Ep 4 · Before you reveal it", yellow; then "All set for Ep 4 · Change it until you reveal") and its reveal in the
  progress control ("Reveal Ep 4", with the gap small under it past one ahead: "2 ahead of Bo"; yellow once the move is in and
  nothing else is due). Revealing without the move asks once in a sheet (Set your lineup first / Reveal anyway). Several games on
  one episode reveal together (one catch-up call each) and the result sheet lists each. The plate's "Bo is on Ep 3" line is gone:
  the ruler says it. Plates stay for what isn't the weekly loop: drafting together, picking your team, a waiver moment (its "Go on
  anyway" is now the control's reveal), how you finished. Caught up on a season still airing, the result sheet says so ("Ep 6 is
  next, as it airs") instead of "See how you finished", a wrong fact the fold made common.
- Not yet: `show_follows.not_yet` (Live's column, the same meaning), returned as `you.notYet`; saying it alone never follows a
  show. A second phone doesn't ask again (check-strip-settle.js).
- Alex's strip: not a server timing. A league read does what's come due (league-read.ts readyLeague: the waiver week opening), and
  the home read the strip uses runs beside the games read, so a first visit missed the replacement until the home's next read.
  Fixed: once a visit, a games read landing after the home's reads the home again (show-space.tsx). Episodes' read wasn't special.
- The bench gained the catch-up route (runtime-session.cjs: the engine's reveal of the viewer's next episode) and two
  situations, `show-behind-unset` and `show-pace-ahead`.
- Rejected: the steps bar (Pick · Watch · Reveal) on the art (a fourth line on the show bar; the strip and the control already
  are the steps); asking "Seen Ep 4 and 5?" at your own pace (behind is the point there).

## 2026-11-15 · Step 4, Episodes and the reveal: built, waiting on the user's review
- Decided by: Claude, through the three skills in order (Intent's spec, PFD's first view, Impeccable's shape and build), one check
  (PFD evaluate 77; Impeccable critique 25/36 and the detector), one batch, one confirming look
- What: the compact progress control on every tab but Tonight (it replaced the spoiler line and the bar's chip); Episodes as one
  list (next episode as its top row with the couch's readiness, then Waiting for you, Out, not seen, Seen, still to air; no reveal
  plate, no Reveal on a row); an episode's page led by who left, its top scorers under their game, Replay at the foot; Where you
  are as data round 3's episode ledger A; the reveal opening on the show's art ("Last time on", every game named first), a beat
  per game, a lineup as signed bars, the couch's GIFs a beat only with GIFs, one primary at the end; a game at your own pace's
  reveal full screen (PaceRevealScreen) instead of a sheet.
- One departure from the spec, Impeccable's: the waiting episodes stay a row each (each carries the couch's faces at its own
  mark), the reveal still said once.
- A disagreement settled by the rules: PFD (how much at once) took the couch's names off the rows; Impeccable's review asked for
  a verb line ("Alex and Riley are on 5"). PFD's built; the other is a named choice in the story.
- Rejected: a sticky compact line (a fifth of the screen at every scroll); folding the waiting rows into one (loses whose faces
  are where); a server change for the predictions beat's questions, the own-pace table and a head-to-head opponent's lineup
  (listed open).
- Rests on: docs/design-round/step4-episodes-spec.md, -first-view.md, -shape.md, -check.md; the story
  https://claude.ai/artifact/2mg9HG2CVittvFQjNgLE3Y (frames in .ui-atlas/stories/step4-episodes/).

## 2026-11-15 · Step 4's two choices, decided
- Decided by: the user ("I'll take your recommendations"), taking Claude's recommendations
- Names on the episode rows' faces: off, as built (PFD's call): the faces, and "You're here" on yours; names in the faces' label
  and Where everyone is. Rejected: the verb line ("Alex and Riley are on 5").
- Where you are's eight controls on a show you watch: unchanged this round; it goes to the separate track (settings and
  following), where Keep me live and I'm up to date are reconsidered.
- Rests on: the story https://claude.ai/artifact/2mg9HG2CVittvFQjNgLE3Y, "Open".

## 2026-11-15 · Step 5, Players / Cast: built, waiting on the user's review
- Decided by: Claude, through the three skills in order (Intent's spec, PFD's first view, Impeccable's shape and build), one check
  (PFD evaluate 78; Impeccable critique 26/40, a reviewer that saw neither PFD's findings nor the session's reasoning, in one
  context, and the detector), one batch, one confirming look
- What: the cast tab is the show's own facts (Phase 0 decision 6): a face wall first (four to a row, by tribe, names only, who's
  out at the foot in boot order); The numbers under it, one table with every stat a column (counts, fullest first, a tap sorts),
  the range folded to a line; Counted by switches the table to a game you play (step 2c's game table in place, named at its head);
  one person sheet (Phase 0 decision 9) with their weekly graph (counts stacked by kind, one colour per stat for the season), their
  numbers ranked, In your games (each opens their sheet in that game), their story without points, Compare with...; a sport is a
  list (search and positions first, rows by team, 40 at a time) with the athlete's sheet.
- The user, during the check: positions and roles ("NFL WR, QB; Survivor tribes; Below Deck interior, chief stew, second stew"):
  season_cast.role rides on the stats read as `position` and shows under each name on the wall, the table and the sheet; the
  department is the group. crew-fixture.js shows it; no TV cast records a crew role yet (BACKLOG 89).
- Rejected: Faces / Rank / By episode as three modes (one page: faces, then the table); a points heatmap on the show's tab (By
  episode is the game lens's weeks and the person's chart); "Your team" tags on faces (a team is a game's; a named choice in the
  story); per-person chart colours (a key learned on one face broke on the next).
- Also fixed: the game page's cast sheet drew another game's points as its chart (Outlast "6 pts" over Weekly Lineup's "+7.5");
  it draws the chart only where the stats' points are that game's. Its story and tribe tag wait for the game page's ripple.
- Rests on: docs/design-round/step5-cast-spec.md, -first-view.md, -shape.md, -check.md; the story
  https://claude.ai/artifact/Jg8uWeG44uL5eTNCv7e5Y7 (frames in .ui-atlas/stories/step5-cast/).

## 2026-11-15 · Step 6, the Games tab and the draft room: built, waiting on the user's review
- Decided by: Claude, through the three skills in order (Intent's spec, PFD's first view, Impeccable's shape and build), one check
  (PFD evaluate 79; Impeccable critique 27/40, a reviewer that saw neither PFD's findings nor the session's reasoning, and the
  detector), one batch, one confirming look
- What: the Games tab as one row per game, the due one first (Phase 0 decision 4): the name opening the game's page, your place as
  the row's one big number in the game's own unit with the gap or this week's opponent, its move as a quiet line (a dot when due;
  the strip keeps the yellow fill), a mini leaderboard (five or fewer, else the top three and you), Last picks folded; a game
  mid-draft as the draft's line and your slots, never a ranking of pick counts. The draft room: one clock (who's up, picks until
  yours, the last pick in a line), your team's slots with a line kept for cast properties' "Needs", Available as step 5's wall
  four to a row (a sport's searchable list, the pool best first), Picks (a draft board: a column per person, a row per round) in
  place of the ticker, the order strip and Teams, the queue; a tap queues when it isn't your pick. The strip says "Your pick now"
  for a draft turn.
- Rejected: the pill row (it repeated each place); each game's full table on the tab (the game page's); Rules per game (the game
  page's How it works); the As-of plate (the control says it once); a yellow on the row's move beside the strip's (one per view).
- Rests on: docs/design-round/step6-games-spec.md, -first-view.md, -shape.md, -check.md; the story
  https://claude.ai/artifact/4wj5fu4EvWmGBbLBotYx5i (frames in
  .ui-atlas/stories/step6-games/; scripts/dev-test/story-draft.js and draft-fixture.js --live --sport, new).

## 2026-11-15 · A tap in the draft opens their sheet; an athlete's shows past seasons
- Decided by: the user ("Tapping a castaway in the draft... I say it should. Sports it's important to get historical stats")
- What: a tap on a castaway or athlete in the draft room opens their sheet (step 5's person sheet; the athlete's sheet), Draft and
  Queue at its foot; when you're up it also selects them for the confirm bar. An athlete's sheet adds their last three seasons from
  ESPN, on demand, cached a day (sports/history.ts).
- Rejected: a long press for the sheet (the spec's first idea: hidden, and the user asked for a tap); tap-to-select with the sheet
  a second step (the sheet is where the sweat decides, and it carries Draft, so the casual path stays two taps).
- Rests on: docs/design-round/step6-games-check.md, "After the user's review"; the story https://claude.ai/artifact/4wj5fu4EvWmGBbLBotYx5i
  version 2.

## 2026-11-15 · Step 6's two choices, decided
- Decided by: the user ("I agree with both recs"), taking Claude's recommendations
- Row order on the Games tab: what's due first, as built (the strip points at the move, and the row it lands on is the first).
  Rejected: a fixed order as the games started.
- Last picks: folded under each leaderboard, as built (one tap, in place, every row at once). Rejected: always shown.
- Rests on: the story https://claude.ai/artifact/4wj5fu4EvWmGBbLBotYx5i, "Open".

## 2026-11-15 · Step 7, the hub and the TV guide: built, waiting on the user's review
- Decided by: Claude, through the three skills in order (Intent's spec, PFD's first view, Impeccable's shape and build), one check
  (PFD evaluate 76; Impeccable critique 27/40, a reviewer that saw neither PFD's findings nor the session's reasoning, and the
  detector), one batch, one confirming look
- What: the hub's first view is the next thing (one plate on the show's art: the time once, the move, the reveal or All set on
  a caption plate, the move opening its editor in one tap through `?moves=` or its own page; other moves one line under it), On TV
  (Phase 0 decision 7: a channel bug and a crawl of this week's cards, drifting once the plate has landed, going round, held under a
  finger; on a game day the couch's teams' games lead it), your people (each face's episode on the next thing's show), then your
  shows. The guide is its own page (`?page=guide&day=`): the switch, seven day cells, the day as a rundown with a time gutter and
  the Now line, Also on, At your own pace (the streaming rail, moved from the hub); Sports in the same cells.
- PFD settled the spec's open question: On TV under the plate (above, its motion would take the first look from the due move and
  push the art down).
- Rejected: the status line beside the plate (the move said twice); On now as its own row (its show is the crawl's card, its
  person a face's dot); the guide inline; who's set as a second row of faces (a count, "Couch: 0 of 4 picked"); "1 more" in the
  plate's title (the critique: it read as a count of castaways to pick); red for a due dot (red is live or out).
- Rests on: docs/design-round/step7-hub-spec.md, -first-view.md, -shape.md, -check.md, step7-hub-critique.md; the story
  https://claude.ai/artifact/HxS3nW2FiH2xoDtvHBAF8x (frames in .ui-atlas/stories/step7-hub/; scripts/dev-test/check-hub-next.js
  and story-hub-sports.js new, census-app.js's hub situations and overlap report).

## 2026-11-15 · The hub: Bands (leaning), with the user's notes built
- Decided by: the user ("I think I like bands"), with notes; how, by Claude through Impeccable
- What: Bands (hub/looks.tsx `look=bands`, still behind the switch) with: each face's episode number on the line under it; away
  (behind the latest aired and not on the app since it aired: the home read's `away`, a list of season ids, never a time) as a
  faded face with a dotted trail to the latest episode; the teams you follow among Your shows (their game on now, last and next);
  a game finished in the last 36 h keeps its score behind Show the score, with Watch as if live (reads "Started" until "I've
  watched it"; per phone for now); a rivalry (two couch teams meeting this week, followed by different people, no game on it) as
  the first band with Start a game on it. On the couch drops "revealed" lines and shows four with Show more. The guide gets a
  marquee (tonight's line-up crawling between chyron rules) and the day as a channel grid (rows per show, half hours across, the
  Now line).
- Open for the user: the recent-final rule change (a sport's results showed straight away unless hidden), recordings on the
  server, whether "away" as a hint is fine.
- Rests on: the story https://claude.ai/artifact/HxS3nW2FiH2xoDtvHBAF8x version 5.

## 2026-11-15 · Sports on the hub as a scoreboard, not bands
- Decided by: the user ("the game block is cluttered, I don't think the title needs players... could get cluttered and populated
  fast... a swipe navigation"); how, by Claude through Impeccable
- What: one swipeable row of game cards in Bands (`Scoreboard`/`ScoreCard`, hub/looks.tsx), a fixed height however many games,
  the next card peeking, a count at its head. A card is the matchup alone, the couch's faces on the side each follows, at most one
  action (Start a game on a rivalry; Show score or Watch as if live on a game just finished; I've watched it on a recording). Order:
  on now, just finished, a move of yours due, rivalries, each of your teams' next game. TV shows keep their bands.
- Rejected: a band per team and per rivalry (v5: tall, names said three times, grows with every team).
- Rests on: the story https://claude.ai/artifact/HxS3nW2FiH2xoDtvHBAF8x version 6.

## 2026-11-15 · Compact game cards, a game's plate on one line, team marks of our own
- Decided by: the user (the games pushed shows out of view; the plate's three lines; team colours; "use the city name abbreviated
  and have our icon square stylized with their colors" to keep clear of league logos); how, by Claude through Impeccable
- What: score cards about 100 px tall (a status line with the one action as a chip; a line per team: mark, name, followers,
  score); a sports game's plate (UpNext) as the matchup with both marks on one line at 26 px, the date once in the time line, the
  two teams' colours behind it with no art, no "Game 1" (hub/sports-day.ts shares the game lookup with the scoreboard); TeamMark
  everywhere is the league's short city code on the team's colour with the Lower Third's cut corner, never a logo.
- Rests on: the story https://claude.ai/artifact/HxS3nW2FiH2xoDtvHBAF8x version 7.

## 2026-11-15 · The guide is what moves; the hub's On TV row is still
- Decided by: the user ("I did not mean the widget on the hub to be animated, I meant the TV guide once we click into it"; "I do
  not like the yellow marquee"; "maybe we are overthinking this and it's good as is, but we just need animation and swiping
  between days"; the switch's order "my shows, competitions, sports, all TV")
- What: On TV on the hub is still (no crawl, no pulsing dot; its cards swipe by hand). This supersedes the part of Phase 0's
  decision 7 that asked for the hub's row to be animated: the row stays near the top and noticeable, the guide carries the motion.
  The marquee is removed. The guide's days are pages (SwipePager); the channel grid fits the screen (today from just before now, any
  other day its evening), shows aired tonight drop out; the day lands with an overshoot, its blocks settle in turn (nd-rise), the
  Now line draws down (new.css nd-now-draw); reduced motion stills all of it. The switch: My shows · Competitions · Sports · All TV.
- Rejected: a brainstorm's bigger directions (a guide channel with a preview window, a split-flap departures board, the evening as
  a sky), the user's call: the grid is right as it is.
- Rests on: the story https://claude.ai/artifact/HxS3nW2FiH2xoDtvHBAF8x version 9; scripts/dev-test/story-motion.js.

## 2026-11-15 · The guide is the rundown, a day a page; the hub's way in is a button
- Decided by: the user ("let's go back to this, but we can swipe on the page to go to the next day; At your own pace must display
  on the page; if there are too many entries we indicate there's more by a show being semi cut off and faded at the bottom";
  "Guide > is a bit too subtle"); how, by Claude through Impeccable
- What: each day is DayRundown in a SwipePager page; the day's list has a height of max(232 px, 100svh − 470 px) so At your own
  pace stays in the first view, scrolls inside, and fades out at its foot while there's more (a top fade once scrolled); today
  opens at the Now line; native link and image dragging off in the pages so a mouse drag turns the day. On the hub, On TV's bug says
  "Guide" on a white plate, and its row ends with The whole week. The channel grid, its drift and the marquee are removed.
- Rejected: the channel grid (a day with a morning and an evening show had no readable scale).
- Rests on: the story https://claude.ai/artifact/HxS3nW2FiH2xoDtvHBAF8x version 10.

## 2026-11-15 · The guide's rail stays put; only the page and the day bar move; Guide is an outlined button
- Decided by: the user ("keep At your own pace on the bottom; the only thing that animates a transition is the main section and
  the day bar"; the white "Guide" button "a little ugly, use Impeccable"); the button's look by Claude through Impeccable
- What: every day's page has the list's full height, so At your own pace holds its place (the same position across four days);
  the day bar's white highlight slides with the pager (driven by its onMove, following the finger); the rundown's rows no longer
  rise in turn. "Guide" on the hub is the system's secondary control (an outline at the control edge, bone words, an arrow).
- Rejected: the white plate for Guide (the plate is the due move's; a link wearing it competes); chyron-line link text (yellow
  beside the move's yellow on the same view).
- Rests on: the story https://claude.ai/artifact/HxS3nW2FiH2xoDtvHBAF8x (published version 10, labelled "v11").

## 2026-11-15 · Bands is the hub; the look switch and the other looks are gone
- Decided by: the user ("I agree, do that with the other four and the full build")
- What: hub/bands.tsx is the real hub's Your shows on the couch hubs (focus and first-week shapes); hub/looks.tsx, the admin look
  switch, the couch's face row (`CouchRow`), On now, the posters on a couch's hub, the marquee and the channel grid are deleted.
  The solo hub keeps its posters (they turn over to your games; the tour's Flip step runs only there).
- Rejected: Your week, the couch first, Previously on · Next time (the user's pick of Bands, story version 5 on).
- Rests on: the story https://claude.ai/artifact/HxS3nW2FiH2xoDtvHBAF8x.

## 2026-11-15 · A just-finished sports score waits behind a tap for 36 hours
- Decided by: the user (agreed with the recommendation)
- What: a game of one of your teams (or one you're watching as if live) finished less than 36 hours from its start shows "Final"
  with no score on the scoreboard until you choose; past that its score shows as any other's, unless Hide sports scores is on.
  This changes the rule that a sport's results show straight away: only on the hub's scoreboard and only for your teams' games.
- Rejected: showing the final at once (the user's missed Patriots game); hiding every final (the scoreboard then says nothing).

## 2026-11-15 · Watch it as if live is kept with the account, and asked for by a tap
- Decided by: the user ("I'd see the game and tap on it, then, still not wanting any spoilers, have the option prompted to me to
  watch live")
- What: a tap on a hidden final opens a sheet named for the matchup: Watch it as if live (a `sports_recordings` row, migration
  0438) or Show the score (this session). A game you're watching says Watching on its card, Started everywhere (useGameScore hides
  a recorded game on every surface, the team sheet included, which closes the leak the per-phone version had), and its tap asks
  I've watched it (the row deleted, the score shown) or Keep hiding.
- Rejected: two chips on the card itself (a mis-tap shows the score); keeping it per phone (another device spoils it).

## 2026-11-15 · Away stays a hint; the plate's art is still; "Your team" tags are off
- Decided by: the user (agreed with the three recommendations)
- What: someone away (behind, and not on since the latest aired) is faded with a dotted trail to the latest episode, never a
  "last seen" time; the plate's art no longer pans (`nd-kenburns` off UpNext); step 5's face wall carries no "Your team" tag.
- Rejected: a last-seen time (a fact about someone they didn't choose to share); the slow pan (motion on a hub that should be
  still); a quiet "Your team" mark on the wall (the game's own pages say it).

## 2026-11-16 · Step 8, notifications then waivers: built, waiting on the user's review
- Decided by: Claude, through the three skills in order (Intent's spec, PFD's first view, Impeccable's shape and build), one check
  (PFD evaluate 73; Impeccable critique 27/40, a reviewer that saw neither PFD's findings nor the session's reasoning, and the
  detector), one batch, one confirming look
- What: one grammar for every push (the news first, number first; where it's from, then what to do; a tap on the thing), one
  reminder per person, show and episode; the bell as New and Earlier by time, an icon per kind, done reminders gone, no due row;
  waivers led by the move on the strip's plate, the best three free under it with points by episode on one scale and a one-tap
  claim, the sticky foot and the seconds countdown gone.
- PFD settled the spec's two open questions: the bell by time only (show groups inside New and Earlier would be four headings and
  break newest first); Who's free on the page as three options under the move (five would push Your team out of the first view).
- Kept against the critique: the show's name first in every bell row (PFD's question: where the show is said).
- Rejected: a countdown ticking seconds (a casino's pressure); yellow for "new" in the bell; the show's art on every bell row;
  a claim that silently drops its backups (Switch opens the picker instead).
- Rests on: docs/design-round/step8-notify-spec.md, -first-view.md, -shape.md, -check.md, -critique.md, -pfd-eval.md; the story https://claude.ai/artifact/3TnbLJWK2aXzCByi9qfeyP
  (frames in .ui-atlas/stories/step8-notify/ and step8-waivers/; scripts/dev-test/notes-fixture.js and story-waivers.js new).

## 2026-11-16 · Waivers: who's leaving on the plate, Swap opens the picker; no options on the page
- Decided by: the user ("at a glance I didn't see the All 4 free, also it's not clear at first who I'm replacing because the picture
  of Carter isn't there... I'd rather the Swap button exist and it bring up Who comes in for Carter; the same for waivers through a
  week"), agreed by Claude; how, through Impeccable
- What: an owed spot is a plate with who's leaving by face, "Replace Carter", "Out · Ep 5 · by Wed 8:00 PM · in 2 days" and Swap (the
  page's one yellow) opening the picker; once claimed, the incoming face with the leaver small at its corner and Change. Your team
  shows their place as a blank slot (dashed, "Open spot · Carter's · out Ep 5"; claimed, the incoming face faded,
  "Rob, coming in": the user, "a visual blank team slot is the better UX"); a swap week has no Who's free; the ran week's Free agency is one button into its list.
- Supersedes: PFD's settling of the spec's open question (the three best free on the page, one tap to claim) and the critique's
  Switch fix. The bars stay, in Your team and the picker.
- Rejected: options on the page (they read as the whole choice; the person leaving wasn't shown).
- Rests on: the story https://claude.ai/artifact/3TnbLJWK2aXzCByi9qfeyP version 2.

## 2026-11-16 · Step 9, Chat (a light review): built, waiting on the user's review
- Decided by: Claude, through the three skills in order (Intent's spec, PFD's first view, Impeccable's look and build), one check
  (PFD evaluate 76; Impeccable critique 27/40, unanchored), one batch, one confirming look
- What: days, with each episode's airing as a landmark in the stream (the episode chip: "Ep 5 · aired 8:00 PM"), only where talk
  follows it; one reveal line per episode carrying its day; the fold led by Reveal Ep N, "Show them anyway (may spoil Ep N)" a quiet
  link; day dividers quieter; "Message the couch"; your own reaction not yellow.
- Rejected: one reveal line per person (a third of the view was chrome); the stream by episode alone (a conversation is in time);
  a sticky progress control (the landmarks carry where you are).
- Rests on: docs/design-round/step9-chat-spec.md, -first-view.md, -check.md, -critique.md, -pfd-eval.md; the story https://claude.ai/artifact/Dpc8fXXdpnHw5vJkhAvNnc (frames in
  .ui-atlas/stories/step9-chat/).

## 2026-11-16 · The castaway sheet is one part with a lens, Counted by, on the sheet
- Decided by: Claude (default, inside Phase 0 decision 9; asked in the spec's open questions)
- Why: the user stumbled showing a relative the app: a castaway from the Cast tab and the same castaway from a game page read as
  two different things (step 2b's sheet and step 5's, never merged). One sheet with the context named ("Counted by Weekly Lineup")
  explains the only real difference, a game's points, and reuses the Cast tab's own control for it.
- Rejected: two sheets kept and restyled alike (the stumble was structural, not a colour); the game's points only inside its row
  under In your games (the game page's player would scroll past the show's moments to reach the chart step 2b gave them first).
- Rests on: docs/design-round/drill-person-sheet-spec.md; the before frames in .ui-atlas/stories/person-sheet/before.

## 2026-11-16 · A stat on a sheet opens its board; the board lists everyone, those without it last
- Decided by: Claude (default, from the user's example: "2nd in never having someone vote them … tapping into that to see a
  castaway list sorted by" it)
- Why: the user asked for a castaway list sorted by the stat; everyone without it are part of that list's answer ("who never
  did?"), so they stay, last.
- Rejected: opening the Cast tab's table sorted by the stat (leaves the game you're in, and the table's other columns bury the
  one asked about; the board links to it instead); the stats page as the level (a pushed page sits under every sheet).
- Rests on: docs/design-round/drill-person-sheet-spec.md, "The stat's board".

## 2026-11-16 · Compare with… opens one picker everywhere
- Decided by: Claude (default)
- Why: a game page's sheet stack has no face wall to pick from; one picker (the wall in a sheet) works from every context, so the
  button does the same thing everywhere.
- Rejected: the Cast tab's picking mode on the wall kept beside a picker elsewhere (the same button, two flows).
- Rests on: docs/design-round/drill-person-sheet-spec.md, block 8.

## 2026-11-16 · The one sheet keeps the bio, what they hold and their properties; the stacked chart stays
- Decided by: the user, mid-round, from production's Cast tab sheet (Sharonda Cox at Episode 7): "there's a bit of beauty in the
  stacked bar chart here. but i could be convinced against it. what i cant be convinced against is the bio, what they hold, and
  properties on this view"
- What: the who block carries the cast-properties work (live since 2026-11-16, master 4ab2e026) in every context, a game's lens
  included: the group and the show's properties, the billed bio line, still in or out, what they hold now, the billing's line.
  The stacked chart stays (one chart part, a stat one colour for the season, in both lenses).
- Also: the round's branch had been cut from the master before cast properties; it was brought up to origin/master (ff043c48)
  and the round's work put back on top (one conflict, cast.tsx: the property chips and the wall's filter kept, the old picking
  mode gone). The local database took migrations 0439-0441.
- Rests on: the user's screenshot; .ui-atlas/stories/person-sheet/before/real-cast-sheet.jpg (the same view, rendered).

## 2026-11-16 · The person-sheet round: built, waiting on the user's review
- Decided by: Claude, through the three skills in order (Intent's spec and drill tree, PFD's first view, Impeccable's shape and
  build), one check (Impeccable critique 27/40, dual-agent: an unanchored review and the detector in the page; PFD evaluate 72), one
  batch, one confirming look (two slips of the batch fixed in it, listed in the check)
- What: one castaway sheet from every way in, at the context you came from (Counted by), the bio, holdings and properties on it
  everywhere; every number on it a door (a stat to its board, a chart column to the story's episode, a game row in place to its
  holders, a holder to their sheet in that game); the stats page's and Tonight's Stats card's ranked rows open the sheet.
- Rejected: a game's points only inside its row (the lens explains the points the relative stumbled on); 17 rows of nothing under
  a rare stat's leader (a face grid once they outnumber); "Rank of 21" over a count (the count first, its rank in words); a filled
  bone plate for a chosen lens (raised and outlined: it outshone the face); Free in a shared game.
- Open for the user: which three stats take the chart's colours; the lens on the sheet; the Compare flow (wall picking to a picker
  sheet); the next pass's order (drill-audit.md).
- Rests on: docs/design-round/drill-person-sheet-*.md, drill-audit.md; the story https://claude.ai/artifact/P42w4GSchZfx7SHwf4Uxsn
  (frames in .ui-atlas/stories/person-sheet/).

## 2026-11-17 · The chart's colours: the three most frequent stats, the one that separates castaways, the rest grey
- Decided by: the user ("3 most frequent, 1 that differs the most, the rest"; worked out from the season's numbers for now, a
  show-specific order maybe later); the measure, the colours and the order by Claude, from the real Survivor 51
- What: `src/new/show/season-colours.ts`. The three most frequent stats take Lake, Ember and Orchid in the rulebook's order (not by
  rank: at Survivor 51's Ep 7 and Ep 8 the same three swap ranks, and a stat changing colour as you watch is the rank-painting the
  dataviz rules forbid); then the stat castaways' counts are most spread out on (standard deviation of each castaway's count) takes
  Sky; everything else is Slate. The stack's 1px gap between kinds is 2px, at each segment's far end so a bar stays on its zero
  line. On the real Survivor 51 the fourth is "Voted with the majority" at Ep 7 and at Ep 8.
- Rejected: ratio measures of "differs" (coefficient of variation, Gini): on the real season both pick a stat one castaway has
  ("Chosen to join a reward", "2nd in the Immunity challenge"), a colour spent on one face of 21; the rate per episode played
  (it picks "Played an idol" on the strength of a castaway out early); Safe Teal for the fourth (in the chart set, but teal means
  good news, and a stat's colour carries no verdict); Sage (deutan ΔE 2.5 from Ember) and Rose (tritan 2.2); the control edge's
  grey for the rest (ΔE 10.5 from Orchid in normal vision, below the floor of 15).
- Known: Orchid and Lake stay close for deutan eyes (4.8, in the design system's chart set); Ember sits between them in the stack,
  the 2px gap separates kinds, and the key names each.
- Rests on: scripts/dev-test/season-colours.js on the real Survivor 51 through Ep 7 and Ep 8 (story-person-sheet.js --dump-stats);
  the dataviz validator; tests/season-colours.test.js.

## 2026-11-17 · Every cast photo opens their sheet; each dead end gets a verdict, not a door by default
- Decided by: the user ("every cast photo opens their stats"; "honestly judge if the dead end should be there or if there's a
  genuine use case for opening something")
- What: the drill pass's rules, in drill-audit.md: a photo whose tap is the screen's action keeps it (the sheet carries the action
  at its foot, or the name opens it); every dead end in the audit is judged, a door only where someone would really want one.
- Rests on: docs/design-round/drill-audit.md.

## 2026-11-17 · The castaway chart's options, rendered for the user's pick (the key, then the form)
- Decided by: waiting on the user. Rendered at their request, on real seasons (Survivor 51 at Ep 7, Survivor 49 through the
  finale, The Traitors (US) S5 at Ep 3) and the test couch (a player's first views; a made-up stretch to 30 episodes).
- The user's constraints, all standing: seasons up to 30 episodes (Big Brother, Survivor Australia); sports excluded (they get their
  own components); nothing may push a player's points in each game out of the first view; the sheet is as useful to someone who only
  watches (moments) as to someone who plays (points), and points get a selector of your games where they count differently.
- The options: today's stacked chart; 1, the moment grid (a row for each kind, a dot in each episode it happened, in Their numbers'
  place, fitting 30 episodes, folding after five kinds); 2, bars against the cast; C, the colours on Their numbers' rows; 1+, Points
  for a player (a plate a game with its points, games counting the same sharing one) and What they did (the grid) for everyone,
  replacing Counted by and In your games. Recommended: 1+. The key's three earlier options (one kind a line, two columns, rows) are
  superseded by the choice of form.
- Open: for a long season, a column per round (Big Brother by week, about 13) as the season picker's round 7 already decided for
  the wizard, before falling back to 30 narrow columns.
- Rests on: https://claude.ai/artifact/L81dqjRLHL9a86bAdLWi7Q (frames in .ui-atlas/stories/person-sheet/charts/); the options run
  behind a TEMP switch in src/new/show/cast-sheet.tsx (`keyVariant`, localStorage gys_keyv; story-person-sheet.js --key-variant).

## 2026-11-17 · The castaway sheet is scored by the show: three classes of moment by the rulebook's points
- Decided by: the user ("take a step back… modify what is on production today": the chart coloured by standard scoring, negative,
  0 to 1 neutral, 1.5 and up good; Their numbers ordered by those points and coloured the same; a tap shows when it happened;
  amounts such as tips or points scored shown in their own way at the top; every game's place and points); the rest of the
  structure by Claude in the page spec, default while the user hasn't answered
- What: `docs/design-round/drill-person-sheet-scoring-spec.md`. A kind's class comes from its points for one at the viewer's mark:
  more than 1, a big moment; 0 to 1, a small moment; below 0, a setback (drawn under the line). The points are the rulebook's for
  the moment (the engine's suggested points, the season's or the couch's own copy), not a game's own changes, which live in that
  game's row. An amount (a moment the rulebook asks for as a number, with no test) is a figure of its own, never a moment.
  Counted by leaves the sheet (the chart never changes meaning); In your games stays above Their numbers (the user's earlier
  constraint: a player's points per game never pushed out of the first view), each row with the castaway's points and place there
  whether or not they're yours, the game you came from first and open.
- Rejected: the season's colour per kind (decided earlier today): three classes mean the same on every sheet and show, and the key
  never grows with the names; a show-points total (beside a game's points it asks which is right); 1.25 left between the classes
  (more than 1 is big, so the user's 1.5-and-up holds for every rulebook in half points).
- Rests on: the rulebooks on hand (Survivor 51 and 49, The Traitors 5, Below Deck's draft); the dataviz validator on the sheet's
  ground: Night Safe Teal #35b5a5, the edge grey #75708a, Ember #f2804b (colour-blind ΔE 12.5, normal 19.3, all 3:1 on #221f2c);
  Studio #0b7568, #8e889c, #b4541c (9.5, 17.0, all 3:1).
- Open: setbacks in Ember (DESIGN.md's Red Is For Leaving: "losing points is not an elimination; use… a down chart bar") or in red
  as first asked (Night #f2545b also passes: colour-blind ΔE 8.1 from the grey). Rendered both ways for the user.

## 2026-11-17 · The scored sheet's check, fixed in one batch: one scale, one rank form
- Decided by: Claude, from the round's one check (docs/design-round/drill-person-sheet-scoring-pfd-eval.md, 74/100;
  drill-person-sheet-scoring-critique.md, 28/40)
- What: every chart on its season's busiest episode (a game's weeks on that game's whole cast) so a quiet castaway looks quiet;
  small moments drawn at half the bar's width at first, then back to the full width (the user: "the gray is not matching up");
  the count over a column is what's over the line (a setback's count under its bar
  stacked on the episode number, so it went); one rank form, "T10 of 21", as the games' rows say it; Their numbers headed "By the
  show's points"; "See all 21" inside the opened row; every chart and strip spanning the sheet's measured width; classes said to
  screen readers; the amount figure at 22 px; `--nd-amount` for its bars (Bone; #7d7566 on Studio); the board's framed row back on
  its rails (`w-full` beat its wider width).
- Left open: the winner styled as voted out (BACKLOG 96: a data fix for every surface); a game's points about 630 px down from its
  page (the header could carry them: the user's call); Outlast's row opening to one holder line; "Who has them in: Nobody".
- Rests on: https://claude.ai/artifact/2JSLEE5VNek5qmRgpY9Sq2 (frames in .ui-atlas/stories/person-sheet/score/).

## 2026-11-17 · The castaway sheet lists the couch's active games, yours or not
- Decided by: the user ("I meant couch games that are still active"), answering the spec's open question
- What: every game on the couch that has the castaway and isn't over by the viewer's mark or archived (the game view's `over` and
  `archived`), each with their points and place there; a game the viewer doesn't play is read at the viewer's own mark (the
  read-only path season-games.ts already has), asked for by the sheet alone so the shared games read's other users don't change.
  The section's label follows: "In the couch's games".
- Rejected: only the viewer's games (the first reading); finished games kept (a finished game's points are history, not "now").
- Open: a fourth class for great moments (the user: "unless we want a fourth value to distinct good from great").

## 2026-11-17 · The scored chart stacks its classes with no gap
- Decided by: the user ("make sure there's no gap between neutral gray and green")
- What: `Columns` takes `gap` (2px by default, kept for the season-colour stacks); the scored chart passes 0. Teal, grey and Ember
  are far enough apart without it (colour-blind ΔE 12.5 at the closest pair).
- Open, proposed to the user: bands from each rulebook's own spread (its typical moment, the median of its scoring moments' points):
  setback below 0; neutral up to half the typical moment; good; great from 1.5 times it (a brighter mint #8fe6d8 over Safe Teal:
  a darker "good" teal fails against the grey for colour-blind eyes, ΔE 3.5). Tested on the nine rulebooks on hand.

## 2026-11-17 · The scored sheet is built: four bands from each rulebook's typical moment, the couch's active games
- Decided by: the user ("lets build and implement!", on the four bands; "order of the stack matters, setback on bottom, then
  neutral, good, great on top")
- What: `src/lib/game/moment-bands.ts` (`typicalOf`, `bandOf`, with tests): setback below 0; neutral up to half the typical moment;
  great from 1.5 times it; good between. `cast-stats.ts` sends `typical` (the median of the points of every moment the rulebook
  scores, not its ways out nor an amount) and each stat's `points`. The chart stacks neutral, good, great from the line up, setbacks
  under it; the key reads Great, Good, Neutral, Setbacks. Tokens `--nd-band-great/-good/-neutral/-setback` (Night #8fe6d8,
  Safe Teal, #75708a, Ember; Studio #06463f, #0b7568, #8e889c, #b4541c), `--nd-amount`. In the couch's games: `couchOthers` in
  season-games.ts behind the games read's `?others=1` (the sheet alone asks, `useCouchOthers`), games over or archived dropping off,
  two games of one kind named apart. The TEMP options (keyVariant and every variant) and the season-colour rule
  (season-colours.ts, its test and script) are gone; Counted by left the castaway sheet (the board's Who has them in and the
  athlete's sheet keep LensControl). The test couch gained `new-fixture.js sideGame` (story-person-sheet.js `--side-game`).
- Rejected: a fixed line at 1 point (rulebooks pay on different scales: Survivor 49's rewards +1, 51's +2); the top value as the
  anchor (one big finale moment would squash the bands); great at twice the typical moment (Survivor's immunity win would be only
  good, Dancing with the Stars would have no great); red setbacks.
- Rests on: https://claude.ai/artifact/2JSLEE5VNek5qmRgpY9Sq2 (version 3; frames in .ui-atlas/stories/person-sheet/final/);
  unit tests 2420/2420; check-game-page.js on the test couch (4 games, 0 failing).

## 2026-11-17 · Great is the deeper green, good the lighter one
- Decided by: the user ("dark green should be great, and light green is good")
- What: on Night great is Safe Teal (#35b5a5) and good the mint (#8fe6d8), the reverse of the build; Studio already had the deeper
  teal for great (#06463f over Safe Teal #0b7568). The same four colours, so the validator's all-pairs result stands.

## 2026-11-17 · A season's winner and finalists keep their colour everywhere (BACKLOG 96)
- Decided by: the user ("fix backlog 96")
- What: who finished comes from the format's end-of-game exits (`selectors.ts finishOf`: the winner's exit "won", any other
  end-of-game exit "final"), the same rule a game's view already used for `knocked`; the season stats carry it as `finish`.
  `src/new/show/finish.ts goneHome` decides every grey and red: the castaway sheet (the photo, "Sole Survivor · Ep 13" in the
  good-news colour or "Finalist · Ep 13 · …", no red episode and no "went home"), the face wall (a Finalists group, the winner
  first, before Out), the rank view, boards, the story's last line and the hub's recap. A game's own faces grey on `knocked`
  instead of `left`, and a game sheet's row says Won or Finalist.
- Rests on: tests/finish.test.js; the real Survivor 49 (Savannah, Sage, Sophi) in https://claude.ai/artifact/2JSLEE5VNek5qmRgpY9Sq2
  (version 4); check-game-page.js on the test couch.

## 2026-11-17 · The draft room and waivers open the castaway's sheet, the screen's action at its foot (the drill pass, step 2b)
- Decided by: the user ("continue with 2b", under the two rules: every cast photo opens their sheet; each dead end gets an honest
  verdict); each verdict by Claude, default, in docs/design-round/drill-audit.md
- What: in the draft room, taken tiles (read-only), your slots, the Picks board's cells (in the room and once it's done) and the
  queue's rows open the castaway's sheet (DraftFaceSheet), its foot saying who has them or carrying Queue and Draft; in waivers,
  the spot plate's faces, the claim picker's photos, and Everyone's moves (the castaway someone got; the person, their season in
  the game). Seat heads, the clock, the order, the blind reveal, the run's slides and the picking order stay dead ends.
- Why: the picker is a list worked down in order (a pick, then backups), so its row keeps its one tap and the photo is the door,
  the rule's photo, with the row's tap at the sheet's foot (Pick, Add as a backup, Take out) for whoever looked first.
- Rejected: the whole picker row opening the sheet, the draft's way (a tap more for every pick and backup); the name opening it,
  the rule's other way (the name is where a thumb lands to pick).
- Rests on: scripts/dev-test/check-drill-doors.js, its draft and waivers sets (24 pass); the story, version 3.

## 2026-11-17 · A blind draft's slot opens the sheet instead of taking them out on one tap
- Decided by: Claude, default, under the user's rule (every cast photo opens their sheet)
- What: a filled slot in the blind draft opens the castaway's sheet with Take them out at its foot, as a wall tile opens it with
  Add to your team.
- Why: the slot was the one photo on the screen that did something else, and a stray tap took a pick off.
- Rejected: keeping the one-tap removal (one tap faster, but a tap on a face would mean two things on one screen).

## 2026-11-17 · An episode opens over a sheet as the night itself: the Episodes tab's page, one part, as a level
- Decided by: Claude, default, from the rules the user set for the drill pass (every episode on screen opens the level it names;
  every level is a sheet over the last, back one at a time; the castaway sheet's precedent, one part from every way in)
- What: a castaway's story ("Episode 4 ›") and their status ("Out · Ep 4 · Voted out ›") open the night: the episode page's own
  body (episodes.tsx EpisodeNight, which the page renders too) in a sheet over whatever's open, ‹ › through the episodes you've
  seen. Its jumps (a game's line, Discuss, Replay) leave the sheets as any jump from a sheet does. A game's episode stays that
  game's own level (everyone's plays that night).
- Why: a pushed page sits under every sheet (z 70 against 81), so the page can't open from one; the body as a level keeps the
  stack, and back steps down one level.
- Rejected: lifting the pushed page over the sheets (pages under sheets is the layering every back relies on, and the page lives
  on the Episodes tab alone); a night sheet of its own (a near twin of the page, BACKLOG 97's worry); closing the sheets and going to
  the Episodes tab (back would land without them); leaving the story's episodes dead ends (they name the episode).
- Rests on: docs/design-round/drill-audit.md, step 3; check-drill-doors.js story-night and status-night.

## 2026-11-17 · A game's weeks and numbers open their week in place, or that castaway at that episode
- Decided by: Claude, default (the drill audit's rows 7 and 8)
- What: a week's heading in a person's season turns the lineup above to it; a compare's week (chart or table) turns its heads to
  it; a number in a person's season or the game table opens the castaway's sheet at that episode of their story; a matchup's
  best lineup opens the two side by side that week; a lineup's played-week title opens everyone's plays that week, as other
  games' titles already do. The castaway sheet's game weeks and stat strips open their story in place, as its chart already did.
- Why: the week is already on the sheet you're in (the lineup above, the heads), so it changes there and back still takes the
  sheet; a castaway's number asks why, and their story that episode answers it.
- Rejected: a week heading opening the game's episode level (everyone's plays) from a person's own season (the question there is
  their week); the game table's headings opening anything but their sort (sorting by a week is that table's job).
- Rests on: check-drill-doors.js lineup-title, season-cell, season-week, table-cell, compare-week, strip-story.

## 2026-11-17 · Chat's landmark for an episode you've seen opens the episode's page
- Decided by: Claude, default
- What: the landmark's chip ("Ep 5 ›") is a link to the episode's page on the Episodes tab, whose back says Chat and whose Discuss
  comes back; an episode you haven't seen stays a plain divider.
- Why: mid-chat ("who went home again?") is when the page is wanted, and the divider has no tap of its own to lose.
- Rejected: leaving it a divider (the page is a tab away, but the episode is named right there).
- Rests on: check-drill-doors.js chat-episode.

## 2026-11-17 · The hub: the profile's numbers open where they're compared; Previously on opens its faces and nights
- Decided by: Claude, default, under the user's two rules for the drill pass
- What: on the profile, your place opens the Power rankings, your best finish its game's page, Called it By the numbers (the sheet
  closes in the same tap; back lands on Home). Previously on loads its show's own drill (useShow): its faces open their sheet and
  its episodes the night, as levels over the page. A Row with nothing behind it is a plain row. The bands' faces stay part of the
  band's link.
- Why: a page can't open over a sheet, and the profile's other rows (your best show, Admin, Settings) already leave it; Previously
  on is a page, so levels open over it and back returns to it.
- Rejected: the rankings as a sheet over the profile (a near twin of the page); the bands' faces as doors (24 px marks inside the
  band's own link: a door there steals the band's tap and misses).
- Rests on: check-drill-doors.js profile-place, profile-called, po-last, po-gone, po-still, po-episode.

## 2026-11-17 · Sports: an athlete opens their sheet, a team its sheet, a game in an athlete's log that game's sheet
- Decided by: Claude, default, under the user's two rules for the drill pass
- What: a sport's Players tab's rows open the athlete's sheet; its team headings and a sport's Cast tab's open the team's sheet
  (the roster read now carries each team's id, from its games' sides); an athlete's game log opens that game's sheet (the log now
  carries each game's event). Past seasons and the athlete chart stay.
- Why: a sports fan's levels are the athlete, the team and the game, and each already has its sheet; the night (the episode's page)
  reads as a show's for a game ("Nobody went home this episode"), so a game opens its own sheet instead.
- Rejected: the night for a game in the log (the page's wording is a show's, BACKLOG 100); a past season's row opening anything
  (nothing sits under it in the app).
- Rests on: check-drill-doors.js's sports set (roster-person, roster-team, athlete-log, cast-team) on a stand-in ESPN.

## 2026-11-17 · Start a game's Round 1 tries four structures: the menu, the sentence, the interview, the slip
- Decided by: Claude, default (the plan listed five models, none decided)
- What: A starts from ready games (made-for first) filtered by length chips that never hide a game; B is the game as one sentence whose clauses are its controls; C asks who's playing, what it asks of everyone, then how long; D builds from what you do, then legs like a bet slip. Describe a game and Surprise me ride in all four.
- Why: the four answer the open structural questions differently (the order: how long, all at once, effort, what; the doors; how depth is reached), so the pick settles them.
- Rejected: Describe first as a fifth direction (the measure is taps; it waits about 40 s on a bot capped at 10 asks a day; Joanna and Andrew won't type).
- Rests on: docs/PLAN-start-a-game-redo.md Round 1; docs/design-round/wizard-r1-spec.md.

## 2026-11-17 · Start a game labels a game's pieces by the person's question, in twelve groups and four layers
- Decided by: Claude, default
- What: What you do · How long · How you win (the game's three parts) · Your team · The questions · What scores · Bets · Twists · Over the season (Add to it) · Who's playing · When moves lock · The details. Each piece has one home.
- Why: the schema's eight groups follow where a piece sits in a spec, not the question a person is answering; the four layers keep the first view to the game itself.
- Rejected: the schema's groups as labels ("What settles it" is the engine's question, answered by the question a person picks).
- Rests on: docs/GAME-PIECES.md "Thinking up a game"; docs/design-round/wizard-r1-prep.md §1.

## 2026-11-17 · The bot you play against is a seat in Who's playing, never the same control as Beat the bot
- Decided by: Claude, default
- What: Me and the bot sits with the couch and Just me; Beat the bot stays a rule a question can have, under Twists.
- Why: the plan's E1 makes the bot a seat that answers as a person does; Beat the bot is the AI's call as a bar, a different game.
- Rejected: one "Play the bot" control for both (task 5 and Beat the bot would read the same and play differently).
- Rests on: docs/PLAN-start-a-game-redo.md, "Decided for this plan".

## 2026-11-17 · A piece the engine can't make yet shows where it would live, saying it's coming
- Decided by: Claude, default
- What: live calls (A15), 2-on-1 (C8) and a pair of people as an answer (E3) appear in their group, dashed, with what they wait for; nothing starts with them.
- Why: task 9 needs a place, and a hidden piece can't be found later; a dashed one says what it needs (the user's U0 rule for what can't be chosen).
- Rejected: hiding them until built.
- Rests on: docs/PLAN-start-a-game-redo.md task 9; the user's "picks only flow down" (U0, 2026-11-07).

## 2026-11-17 · The hub's Start a game asks which show first, unless the couch has only one
- Decided by: Claude, default
- What: from the hub, a short list of the couch's shows (the next to air first); one show skips it.
- Why: today's hub start opens the wizard on whichever show airs next (story-start-wizard.js hub-pick: the crew show), so someone wanting Survivor has to back out.
- Rejected: today's behaviour.
- Rests on: .ui-atlas/stories/wizard-r1/before/hub-pick.jpg.

## 2026-11-17 · One episode at a time: three looks mocked, A recommended (awaiting the user)
- Decided by: Claude (recommendation; the user, from Traitors 5 in the real app: "I can view just episode 9, the UI forces you to jump to the latest. We definitely need a natural and intuitive way to progress one by one")
- What: the behind question names one episode ("Seen Ep 9?"); the range is one deliberate tap in. Three forms mocked behind ?step=a|b|c (TEMP-UI, src/new/show/step-through.tsx): A the next one, B pick how far (tiles), C move your face (the ruler's stops). Shared by all three: the guard names one episode with the range on its own row; Yes plays that episode's recap (not the latest's); the recap's end offers the next; Back from it is Not yet; after Not yet the line keeps its shape (Seen Ep 9 / Watch along); the question is no longer a door ("Through Ep 8 ›" is).
- Why: the range question had no answer for "just 9" (both answers false for the commonest state), its Yes played Ep 10's recap and skipped 9's, and Not yet left no way to say Ep 9 was seen. A is the only look whose autopilot tap can't spoil and it adds nothing to the first view (PFD 81, critique 30/40; B 72 and 23, C 70 and 24).
- Rejected: B and C as the default (each makes every out episode an equal target, the over-claim one tap from the first view); inferring what was seen (the 2026-11-15 rule).
- Rests on: the story https://claude.ai/artifact/9xESHEqUcnNQHqauR6mnyD; docs/design-round/step-through-{spec,first-view,shape,pfd-eval,critique}.md; scripts/dev-test/story-step-through.js and step-fixture.js.

## 2026-11-17 · Every direction's ready games come from one game library
- Decided by: the user (a game library with common built-in games, 2026-11-17, with BACKLOG 93); its shape Claude's default
- What: the library holds the built-in games (the eight kinds, and built-in games that leave a part open), the season's made-for games, and later games other couches publish, shown as coming until built. A's list is the library; B, C and D open it from Another game, I know the game and Every ready game.
- Why: one source for ready games keeps them the same in every direction and gives BACKLOG 93 its place now.
- Rejected: the library as a fourth door beside the directions' own (it would be a second list of the same games).
- Rests on: docs/BACKLOG.md 93; docs/PLAN-start-a-game-redo.md "One game library".

## 2026-11-17 · Built-in games can leave the moment open: Who does it most? and the one-moment draft
- Decided by: Claude, default (for the user's end goal: who cries the most, guessed or drafted)
- What: two built-in games whose moment the starter picks; the engine checks the game once it's filled (both play on Survivor 51 with crying added).
- Why: the silly-moment game should be found by what it is ("who does it most"), with the moment as its one choice.
- Rejected: reaching it only through a question's settings or Describe (the measure is taps; the moment is the point of the game).
- Rests on: .impeccable/mocks/wizard-r1 engine checks (questions settled by moment most; a draft scored by one moment).

## 2026-11-17 · One moment picker wherever a game names a moment, saying what adding one does
- Decided by: Claude, default
- What: the season's suggested moments (proposed: rated when the season is set up, so one tap adds one), the show's own, or something typed for our AI to check (about 40 seconds). Before adding, it says the moment becomes the season's for every couch, counts from the next episode, and scores only in games that name it.
- Why: added moments are the season's rulebook's (G1 part 4), so the reach and the start are facts the starter should know before choosing.
- Rejected: typing only (a wait every time, and nothing to start from for someone with no word in mind).
- Rests on: src/lib/server/added-moments.ts; docs/GAME-PIECES.md "Custom moments".

## 2026-11-17 · Start a game: the four Round 1 directions are set aside for the user's gallery of bases
- Decided by: the user ("not of these work … I don't see a simple way to do head to head or teams or betting"; their direction: a big scrollable page of every base a person would name, as squares with monocolor icons, sorted by human categories, then drill-down modifiers)
- What: the gallery (56 bases on a show, 13 on a sport, nine categories, search, tonight's game as one line above), a base's screen (ready-made versions, popular changes as one-tap squares, four headline rows: how long, who's playing, compete, bets; More changes for the rest), drill-downs as squares. A base is an entry point: head to head, teams and betting are bases (three taps) and changes on any game (two taps from its screen).
- Why: a person thinks "a head-to-head league", "teams", "a betting pool" as the game itself; the four hid them under change layers.
- Rejected: A the menu, B the sentence, C the interview, D the slip (the user's verdict).
- Rests on: docs/design-round/wizard-r1b-gallery.md; https://claude.ai/artifact/LWAkJjLjdvZNLCpMXHxRDL.

## 2026-11-17 · The gallery's own calls, each the user's to change
- Decided by: Claude, default
- What: tonight's game kept as one line above the gallery; nine categories with short chip labels and counts; a base in two categories where a person would look in both; what each base asks of everyone printed under its name; bases a show can't play left off its page, bases still to build dashed "Coming"; popular changes from the tracker's usage with that base; made-for games inside their base as "Ready-made for Survivor 51"; icons one placeholder per category until nano-banana.
- Why: the user's structure settles the page; these fill what it leaves open, each chosen for the eleven tasks (Out of a hat findable as "Nothing to do" for Joanna's starter; the one tap for tonight from U0).
- Rejected: made-for games as a category of their own (a second list of the same kinds); listing every base on every show (bases a show can't settle would only refuse).
- Rests on: docs/design-round/wizard-r1b-gallery.md "Calls made here".

## 2026-11-17 · One episode at a time: A, with Up to… and air dates (built behind ?step=a; awaiting the word to ship)
- Decided by: the user ("I like A but we can do one more additional control": a button on the Yes row to set the episode manually, then "a recap of episodes X-Y or skip to latest which will just show Y"; and air dates, "because a real watcher isn't always counting episodes")
- What: the guard's Yes row gains **Up to…**, opening a picker in the sheet (the episode ledger's rows from the first one out, each with its air date; EpisodeLedger takes `from`); a later pick asks **Recap Ep 9 to 12** (each recap in turn, via the recap's next) or **Skip to Ep 12** (its own only; on a show you play the reveal moves every game there). It replaces round 1's "I've seen Ep 10 too" row and "Somewhere in between?" link. Air dates: "Aired Nov 7 · 2 out" under the question, "aired Sat, Nov 7" on the guard, a date on every picker row, "Ep 9 aired Nov 7" after Not yet (the weekday inside the last week, the date before, as clock.ts's airedAt).
- Rests on: the story https://claude.ai/artifact/9xESHEqUcnNQHqauR6mnyD (version 2); src/new/show/step-through.tsx.

## 2026-11-17 · A change opens into its own controls, each held to the engine's range, with an example where numbers meet
- Decided by: the user ("Each modifier can expose ui inputs. Like betting certainly has many possible inputs and controls"); the control kinds Claude's default
- What: choosing a change's square opens its controls underneath: chips with Other… for numbers (the entry held to the engine's range and saying it), segmented choices whose words carry the consequence, steppers for small whole numbers, checklists for which-ones, switches only for a true on or off; rare controls under More options; every control on its default; an example card working the numbers through for bets, tickets, lives and buybacks, replacements and multipliers.
- Why: the engine's numbers are the real list of what a change can set (GAME-PIECES "Size limits"); showing a bet worked through beats describing it (PFD's demonstrate, don't describe).
- Rejected: sliders for amounts (imprecise on a phone, and the ranges run to 10,000); every control shown at once (the casual starter never needs most of them).
- Rests on: docs/design-round/wizard-r1b-gallery.md "Each change's controls"; frames g12 to g19.

## 2026-11-17 · One episode at a time shipped: A, Up to…, air dates, your GIF slot on each recap's end, and Live's card
- Decided by: the user ("Okay implement this commit and push to master"), on Claude's take for GIFs: "your own slot in the couch's GIF row" on each recap's end, never a pop-up, a list to work through or a push
- What: the switch and looks B and C are gone; behind on an airing show, Tonight asks "Seen Ep 9?" with "Aired Nov 7 · 2 out" (step-through.tsx), the guard has Up to… (the picker, then Recap or Skip), after Not yet the line keeps its shape, Back from a recap is Not yet. Each recap's end has the couch's GIFs for that episode with your slot first (react.tsx EpisodeGifStrip, the same strip as Tonight's Last time, four across there), replacing the plain Add your GIF; Recap Ep 9 to 12 ends each episode on its own slot, Skip to 12 only 12's. Live keep-up's card ("Episodes 9 and 10 have aired") answers with Seen Ep 9, opening the same guard, its "Seen some of them?" link gone.
- Rejected: a GIF pop-up after each episode, a "react to all four" list at a catch-up's end, a push or streak for GIFs (Joanna should never feel hustled).
- Rests on: the story https://claude.ai/artifact/9xESHEqUcnNQHqauR6mnyD (version 3); scripts/dev-test/check-step-through.js (30 PASS).

## 2026-11-17 · Every game previews how it plays in four cards, the third replaying an episode the viewer has seen with the game's points
- Decided by: the user asked for a short preview ("a season could possibly be ruined if friends join and they start only to find out the game doesn't play as they thought it would"); four cards and the replay are Claude's default
- Why: a real episode scored the game's way moves the decision from description to experience (PFD L4, Hertwig & Erev 2009); cards made from describeSpec and the engine's scoring can't promise a game the engine won't play; the viewer's own last-seen episode keeps it spoiler-free.
- Rejected: a rules page (it describes); a practice round (longer than short); a made-up example everywhere (kept only where nothing real can be shown).
- Rests on: docs/design-round/wizard-r1b-gallery.md "Version 3"; frames g21 to g24.

## 2026-11-17 · Ask the couch first sends the game and its preview to the couch before it starts
- Decided by: Claude's default, from the user's worry about friends joining a game that plays differently than they thought
- Why: the people who'll play see the same preview and say they're in before anything is set; the maker can still change the rules until the start.
- Rejected: a vote that starts the game by itself (the maker decides when); a button beside Start (no room for a long game's name).
- Rests on: frame g25; the poll sheet's rows (src/new/show/polls.tsx).

## 2026-11-17 · Describe your game is the search field and the gallery's last row, and our AI's one turn interviews with its answers ready
- Decided by: the user ("a subtle 'GPT you game' … if it's possible for the got to essentially interview you in plain language that'd be huge"); one turn with ready answers is Claude's default
- Why: the bot takes about 40 seconds and asks are limited to ten a day, so an answer has to apply without another turn; our engine checks each answer's change with the rest.
- Rejected: a Describe button in the first view (not subtle); a chat that asks our AI again on every answer (minutes a game, and the asks run out).
- Rests on: frames g26, g27; src/new/couch/start-wizard.tsx AskResult ("Your call" sends a non-default answer back to our AI today).

## 2026-11-17 · Community games lead the gallery, our made-for games among them, and a community game's screen puts the engine's account before the maker's words
- Decided by: the user ("the 'community game section', which is assume would also have our made for games. We can just pretend the games that were generated are community too"); the screen's order is Claude's default
- Why: a ready game is the fastest start; made-for hooks are AI-written, and one of Survivor 51's 22 contradicts its rules (The Safety Net: "one life"; the game has two).
- Rejected: community as a tenth category (it isn't a kind of game); the maker's words first (they can be wrong).
- Rests on: frames g1, g28, g29; pages/s51.json wizard.made against describeSpec.

## 2026-11-17 · Each square says what its game is in everyday words, and Start a game's words say "guess"
- Decided by: the user ("descriptions that people who aren't used to the terminology could look at and read"); the square's line and "guess" are Claude's default
- Why: Best ball, Guillotine and Parlay mean nothing to someone new, and "call" reads as a phone call.
- Rejected: keeping what each asks of everyone as the square's line (it says how, not what); a glossary (one more place to look).
- Rests on: .impeccable/mocks/wizard-r1/bases.js WORDS, each written from the engine's rules for that game on Survivor 51.

## 2026-11-17 · A game's length shows in its square's corner, first on its screen as a strip of the season, and on Start's line
- Decided by: the user ("Im not sure how obvious the game length is"); the places and the strip are Claude's default
- Why: length is the commitment, and version 2 had it as a row near the bottom; the strip shows the episodes with their dates and a finale whose date isn't out; a length the engine won't take is dashed with its reason.
- Rejected: a length filter over the whole gallery (a step before every game, and the one-tap game already covers the next episode).
- Rests on: frames g4, g20, g24; bases.js lens (the engine's verdicts at three lengths).

## 2026-11-17 · The preview's replay falls back to an earlier season's episode, then to an example from the show's own moments
- Decided by: the user ("won't always work, new shows or the first time a show has been added to the app"); the order is Claude's default
- Why: only card 3 needs results; an episode the viewer has seen is the strongest demonstration, and an example built from the show's own moments and points still shows how points come in when nothing real can.
- Rejected: hiding card 3 when there's nothing to replay (the scoring is what people misjudge); the real cast in made-up events (read as something that happened).
- Rests on: docs/design-round/wizard-r1b-gallery.md "Version 4"; frames g23, g33; Below Deck 13 locally (six episodes out, no accepted results).

## 2026-11-17 · A game's length starts and ends at the show's own stages as well as at episodes
- Decided by: the user ("if the stages are know that should be a length option for both start and ending"); the strip by stage and the stage-made chips are Claude's default
- Why: shows split their seasons differently (Survivor 51 two stages, Below Deck 13 three, The Challenge 42 one), and the engine plays a span from or to a phase; fixed "till the merge" chips only fit Survivor.
- Rejected: version 3's fixed chips; a stage only as an end.
- Rests on: frames g30, g31; schema.js span (A3, A12 part 1); our check on both seasons.

## 2026-11-17 · Every game says how it can run, live or at your own pace, with the reason when only one works
- Decided by: the user ("a 'own pace possible' or 'live only' warning … if some games can only be played in a a certain way"); the row under How long is Claude's default
- Why: how a game runs decides whether someone who watches late can play, so it belongs beside its length; today's rules already say which starts allow which (paceAsked, PACED, DN 33).
- Rejected: a tag on every square (most games allow both on a season still airing); leaving it to Backstage after the start (a game that starts live stays live).
- Rests on: frames g4, g20, g30, g31, g32; src/lib/server/start-game.ts paceAsked and PACED; docs/PLAN-own-pace-games.md.

## 2026-11-17 · The preview runs on the real screens as the practice round, offered before the game exists, with Next always there
- Decided by: the user ("Could the preview also include what real screen would look like? Interactive maybe?"); using the practice round, and optional doing, are Claude's default
- Why: the real screens are what everyone will use all season, so recognizing them before the start removes surprises; the practice round already plays a throwaway copy on them with nothing saved; Next always there keeps it short for whoever only skims.
- Rejected: a separate demo built for the preview (two things to keep true); steps that move on only when you do the thing (the tour's rule, too long for a preview).
- Rests on: docs/design-round/wizard-r1b-gallery.md "Version 5"; frames g34 to g37; docs/PLAN-practice-round.md; src/lib/tour/practice.ts.

## 2026-11-17 · Made-up results in the preview use the real cast under the red Made-up results tag
- Decided by: the practice round's rule (the user, 2026-10-11); it replaces version 4's made-up names (Claude's default then)
- Why: the real screens show the real cast, and the shipped practice round already pairs real cast and rules with made-up results, tagged, never the real next boot first.
- Rejected: made-up names (version 4; the screens wouldn't look like the game).
- Rests on: docs/PLAN-practice-round.md "On this league"; frame g33.

## 2026-11-17 · Start a game keeps today's When moves lock, opened to show where the couch is and what each choice means for the people behind
- Decided by: the user (own pace "both that and a show that's airing but people watching at their own pace (couple episodes behind, watches the next day, etc)"); keeping the shipped control and showing the couch's marks are Claude's default
- Why: the shipped control already covers a day late (the next one airs) and a couple behind (when you've watched it), with the user's recommendation (2026-11-13) and BACKLOG 68's; what it lacked was who on this couch it affects and where a game syncs.
- Rejected: version 4's invented "How it runs" pair with Live first (it contradicted the shipped words and the recommended default); a warning only on aired seasons.
- Rests on: docs/design-round/wizard-r1b-gallery.md "Version 6"; frames g38 to g40; src/new/couch/start-wizard.tsx Pace; docs/PLAN-own-pace-games.md.

## 2026-11-17 · Closed, When moves lock names someone only when the setting would cost them a move, with the fix as one tap
- Decided by: the user ("I'm happy"), on Claude's recommendation for casual players
- Why: casual starters stay on the defaults and don't open settings, so a cost to a friend has to show closed; naming people every time turns the line into wallpaper; a name lands faster than a rule; a one-tap fix ("Wait for riley") beats a menu.
- Rejected: always naming who's behind (wallpaper); naming them only once opened (the starter who never opens it never learns riley's cut off).
- Rests on: docs/design-round/wizard-r1b-gallery.md "Version 6" (the closed state's table); frames g41, g42, g4, g30.

## 2026-11-17 · Community games are a collapsed section, first in the gallery, made for this season leading, each with a length badge
- Decided by: the user ("I think the community games should be a collapsed section. Then yes, #1 made for this season"), and their question "Would it be useful for the community games to have a length badge: stage, one episode, full season?" answered yes
- Why: the first view's job is the bases; a ready game made on this season's own stages is checked and always there, where likes start empty; length is the commitment, so a community row says it in the squares' words.
- Rejected: most liked first; community squares open in the first view (version 3).
- Rests on: docs/design-round/wizard-r2-spec.md section 1.

## 2026-11-17 · The bases keep their known names, each with its plain line
- Decided by: the user (Round 2's question: "Known names")
- Why: Outlast, Best ball and Survival pool are what players and the app already call them; the square's plain line teaches a newcomer, and search finds plain words too.
- Rejected: plain names ("Draft & watch"); a plain name with the known one as a tag (busier squares).
- Rests on: .impeccable/mocks/wizard-r1/bases.js WORDS, now src/lib/game/start-gallery/bases.json.

## 2026-11-17 · Start a game says "guess"; the game pages keep "call"
- Decided by: the user (Round 2's question: "Guess")
- Why: everyone knows "guess", and "call" reads as a phone call to someone new; where people already play, "call" stays (Weekly Calls, Called it).
- Rejected: "call" everywhere; "guess" everywhere this round.
- Rests on: docs/design-round/wizard-r1b-gallery.md "Plain words".

## 2026-11-17 · On a season that's finished airing, the gallery opens up: every game at your own pace, the engine opening what it can't yet
- Decided by: the user ("I want to push back that that is the technical limit and we should open it up much more of what's possible")
- Why: the user's own direction of 2026-11-09 ("the wizard for everything … the same limitless options"); start-game.ts PACED (the pool, Outlast, the lineup) marks what has its catch-up loop, not what a game can be.
- Rejected: leaving them off with a line; off entirely; dashed in place.
- Rests on: docs/PLAN-own-pace-games.md "Every game at your own pace, through the wizard"; src/lib/server/start-game.ts PACED; the plan's engine step E6.

## 2026-11-17 · A stage carries a short start name, from research, for How long's chips and the engine's words
- Decided by: the user (Round 2's question: "A short start name")
- Why: "Until Merged" names a state, not an event; "Till the merge" is what people say; research already names each stage, so one more word per stage is cheap, and the desk can correct it.
- Rejected: research's names as they are; generic words ("stage 2").
- Rests on: docs/design-round/wizard-r2-spec.md section 4; the rulebook's phases (a field to add, with research's ask and a catch-up).

## 2026-11-17 · The preview is the real screens: the practice round before the game exists; friends are offered it, never opened into it
- Decided by: the user (Round 2's questions: "Real screens are the preview"; "Offer it, don't open it")
- Why: the real screens are what everyone uses all season; the cards described them. A preview that opens by itself stands between a friend and the game.
- Rejected: version 3's four cards as the preview (cards first, then the real screens); opening it once on a friend's first visit.
- Rests on: docs/design-round/wizard-r2-spec.md section 6; docs/PLAN-practice-round.md.

## 2026-11-17 · Our AI's reply carries each answer's change, so the interview's taps apply at once
- Decided by: the user (Round 2's question: "Reply carries changes")
- Why: one turn is about 40 seconds and ten asks a day; an answer that asks again costs both.
- Rejected: today's way (a different answer is another ask); no interview (marked rows instead).
- Rests on: src/new/couch/start-wizard.tsx AskResult; BACKLOG 42's second part.

## 2026-11-17 · Any couch shares a game to the community once it has started, its rules only
- Decided by: the user (Round 2's question: "Any couch, once started")
- Why: a game that's been played is worth sharing; who played and how they did stay the couch's.
- Rejected: sharing from Start a game before it's played; only our made-for games for now.
- Rests on: docs/design-round/wizard-r2-spec.md section 9; BACKLOG 93.

## 2026-11-17 · A base's screen names its rows by the person's question: How you win, not Compete
- Decided by: Claude, default
- Why: the rows are questions a person asks (Who's playing, How long, How you win); "Compete" was the one verb among them. Round 1's taxonomy decision labels pieces by the person's question.
- Rejected: "Compete" (versions 2 to 7).
- Rests on: decisions.md 2026-11-17 "Start a game labels a game's pieces by the person's question".

## 2026-11-17 · Surprise me stays, as the gallery's last row beside Describe your game
- Decided by: Claude, default
- Why: Randomize is one of Create a game's two shortcuts (G4, live); the gallery's versions left it out without a decision.
- Rejected: dropping it; a button in the first view (it competes with the bases).
- Rests on: src/lib/game/game-spec/roll.js; memory randomize-a-game.

## 2026-11-17 · The gallery's structure is one data module that the screens render and the coverage table walks
- Decided by: Claude, default
- Why: a coverage table typed by hand drifts from the screens; one catalog (src/lib/game/start-gallery) names every change's controls and the engine values each sets, so the table proves each value by making that game and passing our check (209 of the 210 values the engine plays now; TVmaze's ratings left out on the user's no).
- Rejected: a hand-written table; a screen per base.
- Rests on: scripts/dev-test/gallery-coverage.js; docs/design-round/wizard-r2-coverage.md.

## 2026-11-18 · A base's draft is fitted to who's left, and every surface says the fitted number
- Decided by: Claude, default (found on the real Survivor 51: 10 still in for a couch of 4, so 3 each by turns doesn't fit and the engine refused Outlast and every all-yours draft)
- Why: the gallery hid Outlast, the most named base; roll.js's own Outlast already fits its picks to who's left (exclusiveFits). The square, the screen's sentence and what everyone does say "2" (PFD's check: the earliest surface states the fitted number, not a note on a later one).
- Rejected: leaving such bases off the season's gallery; making them shared silently; a note only on the base's screen.
- Rests on: src/lib/game/start-gallery fitCouch; docs/design-round/wizard-r2-pfd-eval.md L3.

## 2026-11-18 · Try it sits on the line that says what everyone does; the ready game is the collapsed community section's face
- Decided by: Claude, from Perception-First Design's requirements (R1, R5)
- Why: the preview has to be in a base's first view whatever else is there (a fitted note, a warning), and it is what you'd try; the ready game is one of the community's, so one block holds both (a chunk saved).
- Rejected: version 3's full-width Preview row under When moves lock (below the fold when the lock warns); the ready line and the community section as two blocks.
- Rests on: docs/design-round/wizard-r2-first-view.md; frames b1-outlast, g1-first.

## 2026-11-18 · A square's length is quiet when it's the season and a bone badge when it isn't; lengths are offered most wanted first
- Decided by: Claude, from PFD's gap and the user's U0 rule ("tonight, then the whole season, then a stage, then a span")
- Why: "Season" printed on forty squares hid the one-episode games the user wanted to see at a glance; the chosen length has to be in view without scrolling the chips.
- Rejected: the same word on every square (version 3); stage chips before the season.
- Rests on: docs/design-round/wizard-r2-first-view.md "The gap"; src/new/couch/gallery/model.ts lengthsOf.

## 2026-11-18 · Ask the couch first is a control beside who Start tells, and Describe's result ends on Start
- Decided by: Claude, from PFD's evaluation (L4)
- Why: for a choice made for others, asking is half the decision, so it gets a 44 px control, not an underlined phrase; the interview's point is a game ready in one turn.
- Rejected: version 3's link under Start; a result that only opens the game's screen.
- Rests on: docs/design-round/wizard-r2-pfd-eval.md.

## 2026-11-18 · A base written in Survivor's words reads in the season's nouns, and a Survivor-only sentence leaves on other shows
- Decided by: Claude, default (Round 2 only; each show's own words are the build's)
- Why: Below Deck 13 and The Challenge 42 read "castaways", "immunity" and "an idol" from words written for Survivor 51; the engine's own sentence for the season is a tap away (Every rule).
- Rejected: Survivor's words on every show; writing 56 bases' words per show by hand in this round.
- Rests on: frames bd2-base, c42-base; the plan's "A show's gallery builds each base from its own answerable moments and results" (B1).

## 2026-11-18 · Trivia's category is Bingo & trivia ("A card while it's on, a quiz after"), and Live calls moves to Predictions
- Decided by: the user's note ("Should Trivia really belong in 'play along?' ... Maybe its just the name of the category"), the name and the move Claude's
- Why: trivia is a quiz on the episode before, so "Play along · While it's on" misdescribed it; a category named for what's in it is found by name (someone looking for trivia reads "trivia"). Live calls is a guess about what happens, a sibling of The show's calls; a sport's live calls moved with it.
- Rejected: a broader name keeping all four ("Episode games", "Quick games": they say less and overlap Pools); moving Trivia alone to Predictions (a quiz on what happened isn't a guess about what will).
- Rests on: src/lib/game/start-gallery/bases.json (category `quiz`); frames n8-quiz, n9-predict (.ui-atlas/stories/wizard-r2-notes).

## 2026-11-18 · Any game can be saved with one heart beside Start; the section is Community and saved games
- Decided by: the user's note ("a way to favorite games so you can repeat it easily. Rename the 21 more ready games, into Community and Saved Games. Have an icon so its not so subtle of a button"); where the heart sits and what it keeps are Claude's
- Why: one place on every game's screen (left of Start, as a wishlist heart sits beside a buy button) keeps saving where the decision is; the square stays outlined and only the heart fills, so Start stays the one heavy fill. A saved game is its recipe (its base and rules, dates left out, the length it was saved with), so it opens on any season from the next episode; the toast says where it went. The section's row is an icon tile, its name and its count ("1 saved · 22 made for Survivor 51"), the gallery's one grammar for a row that opens; it stays open or closed as the person left it.
- Rejected: a heart in the sheet's header (the shared sheet); a Save button on the Start bar's second row (crowded at 390); opening the section by itself when there are saves (Round 2's first view).
- Rests on: src/new/couch/gallery/saved.ts, parts.tsx SaveHeart; frames n1 to n11.

## 2026-11-18 · A ready game's heart is its save: likes and saves are one count
- Decided by: Claude, default (the one most likely to be overturned)
- Why: a like that kept the game nowhere did nothing for the person tapping it; one heart, one meaning ("I want this one again"), and the count says how many saved it.
- Rejected: a separate like and save on every ready game (two controls, two counts).
- Rests on: frames n6-list, n7-cgame.

## 2026-11-18 · A saved game is a snapshot; changing it and tapping the heart saves another
- Decided by: Claude, default (TEMP: this browser's localStorage until the build keeps saves on the account)
- Why: the simplest rule that never loses a saved game; "Save changes" to one in place is the build's question.
- Rejected: updating the saved game in place silently.
- Rests on: src/new/couch/gallery/saved.ts keyOf.

## 2026-11-18 · A game's words take its own draft size
- Decided by: Claude (found on the saved Outlast: 2 each reopened saying "picking three")
- Why: the words came from the base and its fitted note, so a size changed by a control, or a saved game, read the base's number; now they read the game's (sizeFit), and the fitted note shows only while the fitted size stands.
- Rejected: storing the fitted note with each saved game.
- Rests on: src/new/couch/gallery/model.ts sizeFit; frames n3-heart, n11-repeat.

## 2026-11-18 · The bold pass is built beside Round 2, behind its own switch, to keep or revert
- Decided by: the user ("At the end i can tell you if this pass is something we should carry over or revert back"); the way is Claude's
- Why: both can be tried in the app on the same seasons (`?start=gallery` and `?start=bold`), and reverting is deleting `src/new/couch/gallery-bold/` and its switch line; Round 2's files were snapshotted (.ui-atlas/snapshots/gallery-r2-notes-2026-11-18/).
- Rejected: editing Round 2 in place (no side-by-side; a revert needs the snapshot).
- Rests on: docs/design-round/wizard-r2b-spec.md.

## 2026-11-18 · Each category leads with its best-known game drawn with the season's own people and moments
- Decided by: Claude, from Intent's spec and PFD's R2 and R4 (the user's "bold, has character & soul")
- Why: a game is recognised by what playing it looks like before its name is read; the faces still in (as far as you've seen: the Cast tab's read), the next episode's real questions, a bingo card of the season's own moments, the couch paired off or two of them masked, one worked bet, the season in its stages. One composition per tile keeps the first view at five chunks.
- Rejected: faces on every square (busy); decorative art or slogans (the 2026-11-12 direction: expressive data, not decoration).
- Rests on: src/new/couch/gallery-bold/leads.tsx; frames g1-first, y1 to y7.

## 2026-11-18 · A game's screen opens as its own page will look, and changes by goal come back (Make it…)
- Decided by: Claude; the ladders are the user's settled U0 quick changes (2026-11-08)
- Why: the title card (its name over the show's art) is the first impression of the game once started; More competitive, More casual and Different scoring name their next step before the tap and undo on the toast. They repeat the rules' changes by goal, as the user allowed ("it's okay to repeat yourself in the UI").
- Rejected: Round 2's Popular changes (unnamed as steps); hiding half the rules under More changes (every rule is now a line, its value first).
- Rests on: src/new/couch/gallery-bold/ladders.ts, parts.tsx TitleCard, MakeIt, RuleLine; frames y8 to y11, y14.

## 2026-11-18 · Every base carries what fans call it, sits on every shelf they'd look on, and one name means one thing
- Decided by: Claude, from the user's "ensure all game types are possible and intuitive to create" and the writer spike's collisions
- Why: "eliminator", "best ball", "props" find their game; Survival pool sits in Just you too, Bingo in Party, Beat the bot in Predictions; Prop sheet is Prop bets, Parlay ticket is Parlay (the change's own word), A new sheet each episode is A new card each episode.
- Rejected: renaming in the shared catalog now (Round 2 stays as it was for the comparison; the names move into the catalog if the pass is kept).
- Rests on: src/new/couch/gallery-bold/known.ts; frame y13-aka.

## 2026-11-18 · Your own moments on every game's screen, shows and sports alike
- Decided by: the user ("i do want sports to include custom moments... fan ran on field, or overturned ABS calls"); the screen is Claude's
- Why: the results (a show's research, ESPN's box score) miss the oddities fans love; a moment in a few words, its points, and who settles it (the couch, whoever sees it taps it and the others confirm, or research for what recaps report), with each world's own suggestions.
- Rejected: custom moments for shows only; a separate sports screen for them.
- Rests on: src/new/couch/gallery-bold/own-moments.tsx; frame y12-own. The engine step (a couch-settled moment in a sport's game) is the plan's.

## 2026-11-18 · A sport's Start a game is the same gallery and screens as a show's
- Decided by: the user ("the sport create a game should at least feel and navigate just like the show even if its technincally different")
- Why: one way to make a game, learned once; the sport's own games, words and character come through the same parts (a sport adapter, not a separate design).
- Rejected: today's separate sport sheet as the sports path.
- Rests on: docs/design-round/wizard-r2b-spec.md §4.

## 2026-11-18 · The bold pass's check (PFD 62/100, Impeccable 26/40), fixed in one batch
- Decided by: Claude, from both checks' findings (docs/design-round/wizard-r2b-pfd-eval.md, wizard-r2b-critique.md)
- Why: the lock's cost moves to the Start bar (it had slipped below the fold); sports carry the teams' marks and speak sports; a team's page shows every game type, the ones for another page dashed with where; Make it… steps between a sport's own game types; focus rings; no invented counts; one surface for lead tiles and squares.
- Rejected: hiding a sport's season-long games on a team's page (a fan looking for fantasy football found nothing).
- Rests on: frames in .ui-atlas/stories/wizard-r2b/after; the story https://claude.ai/artifact/7xMs5C3w67EL9c9yXD9ZBF.

## 2026-11-18 · A made-for game's heart shows only your own save until couches share
- Decided by: Claude, from both checks (the counts were made up)
- Why: an invented number is a false signal; the one-heart rule stands (a ready game's heart is its save), and the count comes back with the community.
- Rejected: keeping made-up counts with a footnote.
- Rests on: the earlier entry "A ready game's heart is its save" (its count part is paused).

## 2026-11-18 · Starting a game is three named steps, and every view says its step and its job
- Decided by: the user ("make sure each step thru the Create a Game process is clear to the user so they know what part of the game create they are at"); the three steps and the words are Claude's
- Why: Choose a game, Set it up, Start, as a step line in every view's head (DESIGN.md's progress segments in chyron-line); each view headed by its question or job, with a first line saying what it's for.
- Rejected: a separate screen per decision (more taps for someone driving by; the one setup screen stays); section chips on the setup screen (busy).
- Rests on: docs/design-round/wizard-r2c-steps.md; the check docs/design-round/wizard-r2c-check.md (PFD 68/100, Impeccable 29/40).

## 2026-11-18 · Each decision is a question, its answer, and its options as cards; chosen is the flow's white plate everywhere
- Decided by: Claude, from PFD's R2 and R3 and DESIGN.md's full-screen flow
- Why: How long was a 15 px label over form boxes and a chip row cut off at the edge; now "How long?" at section size, a season timeline with the stretch as one band, and every length as a card; When do moves lock shows where the couch is and each way as a card naming who it would cost (choosing the card is the fix, no separate screen).
- Rejected: Round 2's chips; the bone fill for chosen in some places and a plate in others.
- Rests on: src/new/couch/gallery-bold/parts.tsx StepLine, QuestionHead, OptionCard, Timeline.

## 2026-11-18 · The bold pass and Round 2c are the direction; the build comes next
- Decided by: the user ("i think i agree with the direct and ready to start")
- Why: the gallery's lead tiles, a game's own page, Make it…, sports through the same screens, and the three named steps.
- Rejected: reverting to Round 2's gallery (kept as `?start=gallery` only until the build replaces both).
- Rests on: the stories https://claude.ai/artifact/7xMs5C3w67EL9c9yXD9ZBF and https://claude.ai/artifact/RwNsSV5pJz8Q7FuDFvTDUt.

## 2026-11-18 · The practice couch is hidden until computer players play every game
- Decided by: the user ("that was a misinterpretation of what i actually wanted: the ability to play any game against a bot and/or add bots to a game so you can have real players and bots. not saying we should delete that outright, but maybe hide it for now")
- Why: what they want is computer players in every kind of game, alone or beside real people (the plan's E1); today they play drafts and survival pools only (src/lib/game/computer-players.ts), and the practice couch was a narrow stand-in. `PRACTICE_COUCH = false` in src/new/show/solo.tsx hides its entry points (a show's Games tab, the hub's Play on your own); the code stays, and practice games already started still show in their owners' lists.
- Rejected: deleting the feature.
- Rests on: docs/PLAN-start-a-game-redo.md E1.

## 2026-11-18 · How moves lock is two plain cards on every game: Together, or At your own pace
- Decided by: the user ("Always two plain cards", after "if im still confused im CERTAIN people like joanna would be confused" about the three ways); the cards' words are Claude's
- Why: the three ways were named by their mechanism (When you've watched it, When the next one airs, At airtime). The two cards say what the couch does: Together, everyone's move for each episode locks when it airs, and whoever is behind is named with what it costs them; At your own pace, your move locks when you start watching, nobody is cut off, and the standings sit at different episodes for different people. A draft where each castaway is one person's adds that the draft is together first and no one new can join once it starts. The Start bar and Ready to start use the same two names.
- Rejected: asking only when someone is behind (the recommendation; it hid the choice from a couch that's caught up); always at your own pace; keeping "at airtime" in Start a game (a game the engine would start strict starts Together; the engine's strict pace stays for games that use it); a Recommended tag.
- Rests on: src/new/couch/gallery-bold/bold-sheet.tsx PLAIN_LOCK; the story https://claude.ai/artifact/RwNsSV5pJz8Q7FuDFvTDUt (version 2, its first section).

## 2026-11-18 · The card that starts chosen stays as it was: Together for a draft of each person's own castaways, at your own pace for every other game
- Decided by: Claude, default (the user's earlier call for drafts, BACKLOG 68; the user found the question about it confusing as worded and answered the cards instead)
- Why: a draft of exclusive teams has to be together at least once, and Together keeps its standings in step; everything else waits for each person by default. Whoever Together would cost is named on its card and in the Start bar, with At your own pace one tap away.
- Rejected: starting every draft at your own pace once someone is two behind ("follow the couch"), not chosen while the question was unclear.
- Rests on: src/new/couch/gallery/model.ts lockOf (runs.exclusive, runs.recommended).

## 2026-11-18 · The game preview is proved first, then A or B is picked; the couch's real names play beside you
- Decided by: the user ("Prove it first, then pick"; "My couch's names")
- Why: P0, a development-only screenshot story of a Survivor 51 Fantasy league on the real screens with made-up results, shows the shape before any product work; a preview with the couch's own names is the game you'd actually play with them, their moves made up by the engine.
- Rejected: committing to A (a preview database) or B (routes split into load and build) before seeing the proof; computer players in every seat.
- Rests on: docs/PLAN-game-preview.md.

## 2026-11-18 · Your own moments in a draft: about a player, whoever has that player scores; about the game, a yes or no call everyone answers
- Decided by: the user ("Player's owner, else a call")
- Why: a batter's overturned call belongs to the batter, so the moment scores whoever drafted that batter; a fan on the field belongs to nobody's player, so it becomes a call answered before the episode or game, and right calls score.
- Rejected: player moments only in drafts; everyone on the couch scoring it; a side tally beside the standings.
- Rests on: docs/PLAN-start-a-game-redo.md E8.

## 2026-11-18 · The game's title card comes back on the started game's page
- Decided by: the user ("Bring it back on the game page")
- Why: the setup screen opens on the game's name over the show's art, and the game page opening the same way makes making a game and playing it feel continuous.
- Rejected: keeping the title card on the setup screen only.
- Rests on: docs/PLAN-start-a-game-redo.md B1.

## 2026-11-18 · The local game writer is built for a remote server production can call, sized like a free VM
- Decided by: the user ("i want this ability to parse plain language into a game to be able to eventually be run on a remote server so it can work directly on prod. if that means setting up something locally first, so be it. but remember the free servers/vm will be much lower spec than my laptop 4090")
- Why: production can't depend on a PC that sleeps; a model is chosen by its accuracy and its speed on a few CPU cores, and the 4090 only trains and tests it. W4 may install a runtime and download two or three small models on the PC.
- Rejected: serving from the PC; free hosted model APIs (rate limits, training on what's sent).
- Rests on: docs/PLAN-local-game-writer.md W4, W5.

## 2026-11-18 · Typed games stay in AI access's kind C split, even once the writer is instant
- Decided by: the user ("Yes, keep the direction")
- Why: the 2026-11-08 direction stands: free with a short ad, or paid and fast; how the split looks when the answer takes a second is W6's to design.
- Rejected: making typed games free once they're instant (the recommendation); deciding later.
- Rests on: docs/PLAN-local-game-writer.md; docs/PLAN-ai-access.md.

## 2026-11-18 · B1: what doesn't play yet is held back in Start a game, each behind a named flag
- Decided by: Claude, from the plan's rule ("Whatever a piece lacks to be played is built before that piece reaches people")
- Why: Try it (no preview yet: the preview lane's P0), Ask the couch first (no such post exists), your own moments (E8) and a season's suggested moments (E5) were drawn and approved in the bold pass but make nothing real; shown, they'd promise what Start can't deliver. `src/new/couch/gallery-bold/flags.ts` names each with the step that turns it on.
- Rejected: shipping them as they were (a preview that previews nothing, a post nobody receives); deleting them (the design is approved).
- Rests on: docs/PLAN-start-a-game-redo.md B1 chunk 2.

## 2026-11-18 · B1: Start opens the game's own page; a ready game and our AI's open Ready to start first
- Decided by: Claude, from the plan ("The game page opens on the game's title card, as its setup screen does")
- Why: a game's screen already is the setup, so its Start starts (Undo on the toast, as before); a game chosen with one tap from the gallery (the ready game, Describe's Start it) hasn't been seen yet, so Ready to start shows it with its own Start bar.
- Rejected: Start always landing on the Games tab (today's wizard); starting the ready game on its first tap.
- Rests on: gallery-bold/bold-sheet.tsx startGame; check-start-a-game.js.

## 2026-11-18 · B1: Run it back reopens the old game on its own screen; a team's Next game opens every game on that one game
- Decided by: Claude
- Why: Run it back is "the same game again", so its rules come back as a game you can still change (`againSpec`), on the next stretch; from a team, what was picked on its sheet (the next game, a rival, a run) becomes the season added and the length every game opens on.
- Rejected: Run it back starting at once with no screen; a team's games opening on the whole season whatever was picked.
- Rests on: start-spec.ts wizardOptions againSpec; sports/start-handoff.tsx.

## 2026-11-18 · B1: the tour's practice opens on the Prediction sheet's screen, one path, Start shakes
- Decided by: Claude, from the tour's own step ("Make a Prediction Sheet") and the user's earlier asks for the practice (2026-11-01: one path; "scroll down then shake Start it")
- Why: the practice is about how a game starts, not choosing among fifty; Back still shows the whole gallery.
- Rejected: the practice on the whole gallery; keeping the old list for the tour alone.
- Rests on: check-new-tour.js (passing).

## 2026-11-18 · B1: a question's settings open under it, and a game of questions shows its other ways to ask
- Decided by: Claude, found by the coverage drive (wizard-coverage.js): eleven question settings and the new card each episode had no way to tap there in the bold pass
- Why: the same grammar as a change (tap it, its controls open under it); "More ways to ask" holds the play row's changes a questions game's headline row skipped.
- Rejected: leaving those values reachable only through Describe.
- Rests on: gallery-bold/bold-sheet.tsx QuestionsBody, QuestionsMore.

## 2026-11-18 · B1: a base carries to every show by the show's own moments
- Decided by: Claude, the plan's noticed item ("a base checked on Survivor 51 doesn't carry to every show")
- Why: a question about a moment the show doesn't have (Survivor's immunity on The Traitors) leaves the base, with a ticket's legs that pointed at it; The Traitors 5 and The Challenge 42 each gain playable bases (the Prediction sheet among them).
- Rejected: writing each base per show by hand.
- Rests on: src/lib/game/start-gallery/index.js fitMoments.

## 2026-11-18 · B1: the game page's title card is the game's identity, never its news, and gives way before the move
- Decided by: the user's call ("Bring it back on the game page"); the shape from Intent's spec and PFD's requirements (docs/design-round/b1-title-card-spec.md, -first-view.md); the defaults on their three open questions are Claude's, offered to the user in the story
- Why: the setup screen's card (the game's own name in condensed caps over the show's art) opens the started game's page, so making and playing read as one; a kicker (the show and season), the name stepping 48, 40, 34 px by measured lines, and the engine's plain sentence while nothing has scored for you yet. It shows no state, so it can't spoil; the week block keeps the news and the move stays above the fold (measured: a due move ends by 423 px at 390 × 844).
- Rejected: the 64 px title the page had before step 2 (a quarter of the first view); the type's name ("Weekly Lineup") over the game's own ("Fantasy league").
- Rests on: src/new/show/game-title.tsx; scripts/dev-test/story-game-title.js.

## 2026-11-18 · The title card's art is in colour on both screens; the sentence stays until something scores; the name shows once
- Decided by: the user ("1. color. 2: your call. 3: your call."), on the story https://claude.ai/artifact/XR92umAKtd2gSFt1H7Grtd; 2 and 3 Claude's, keeping what was built
- Why: colour was the user's call for the game page (2026-11-08), so the setup card now matches it and the greyscale switch is gone. The sentence until the game has scored for you: each person meets the game once (for the couch's others it is the introduction), then the card is lean and the week block is higher on every later visit. The name once: the card names the game in the first view, and the bar that stays takes the name only after the card scrolls away, so the name never shows twice (PFD's R1).
- Rejected: greyscale on both (the setup card's first drawing); the sentence on every visit (a line above the week in every situation); the name in the bar always.
- Rests on: src/new/ui/title-card.ts, show/game-title.tsx; DESIGN.md's Title card and Show Art.

## 2026-11-18 · Round 3: the Games tab holds what's on, by episode; finished games go to an archive with your record
- Decided by: Claude, through the three skills in order (Intent's spec, PFD's first view, Impeccable's shape and build), one check (PFD evaluate 75; Impeccable critique 25/40 from a reviewer that saw neither PFD's findings nor the session's reasoning, with the detector), one batch, one confirming look; built behind ?games=r3 (TEMP-UI) for the user's review
- Why: on a season of three one-episode games an episode, the tab was 63 rows and 18,168 px (26,241 at 30 episodes), the next episode's games at row 18 between finished ones; one game per episode is a chunk of three, and the past is a different question (how am I doing) from the present (what do I play next).
- What: a block per episode ahead of your mark holding its one-episode games as night rows (who's in as faces, you outlined, your move's state, Answer), an aired episode waiting only on your reveal folded to a line; the season's games as step 6's rows under Running; the newest finished episode's results (one result row: the winners' faces, "Jordan won", "Tied: you and Riley", "All 4 tied", "Nobody scored"; your place, teal for a first) closed by the door to the archive with your record's line; Starting later. The archive (pushed over the tab): firsts of played (alone · shared), each opponent as one split bar on one scale (you ahead · level · them ahead, each count in its part), kind chips with each kind's firsts, then each episode's results with its air date, 20 games a page ending on a whole episode, the next page's episodes named on its button. A game's kind is its own name without an episode it was named for (spans.ts kindOf), not the engine's type. Tonight: a mini per season game, then the newest episode's results and the next episode's games one line each. The reveal: one beat for the one-episode games that ended that night (12 beats to 10 on the busy fixture). A finished one-episode game's page: the result in words, no strip or grid of one column.
- Rejected: a row per finished game at any weight (the before); a leaderboard on a game before its episode ("—", four "–" rows); This week as its own block (folded into the next episode's block as one line); a beat per game in the reveal; the engine's type as a game's label (a pot, a majority and a sheet all read "Prediction Sheet").
- Rests on: docs/design-round/round3-short-games-spec.md, -first-view.md, -shape.md, -pfd-eval.md, -critique.md; scripts/dev-test/story-short-games.js; short-games-fixture.js `open` and `bots`.

## 2026-11-18 · Words fixed everywhere on the way: a tie is never "in front", one point is "1 pt"
- Decided by: Claude (found by Round 3's frames and its critique)
- Why: "Tied 1st of 4 · 1 pts · in front" said a tie led and misspelt the unit; both are words, not design.
- Rests on: this-week.ts (the standing card), game-sheets.tsx totalWords.

## 2026-11-18 · Round 3 approved; the season games keep their moves in their own rows
- Decided by: the user ("I'll go with you recommendation. I'm liking the mock ups you made. Continue here"), on the story https://claude.ai/artifact/LMc46gkHTVcWgWCKCmPMT2
- Why: a move is said once, in its game's row; the strip at the top gathers every move for the episode in one tap.
- Rejected: the critique's one-line rows for the season games' moves inside the next episode's block (the move said twice).
- Rests on: docs/design-round/round3-short-games-critique.md (finding 2); the story's Open section.

## 2026-11-18 · B3: Round 3 is everyone's; the space reads the games that are on; Again is Run it back on the next episode
- Decided by: Claude, building the approved design (the user: "Continue here")
- Why: the switch only existed for review. A season of short games read whole on every visit is the slowness E2 measured; the archive holds the rest.
- What: no ?games=r3; the space's games read asks running=1, which leaves out a finished game with an end of its own (season-long games and stages stay, over or not: Tonight's own-pace plate, a game's stages and Run it back on the next season read them); a finished game's page reads that game alone (?only=). Again, in the results (one button a kind not already on again) and on a finished game's page, opens Start a game on the game's screen at the next episode still to come. Bingo, calls, trivia and polls fold into the next-to-air block, or stand alone when nothing airs next.
- Rejected: keeping step 6's every-game list for anyone; Run it back on a span read from the full games read (it reads finished games the running read no longer carries).
- Rests on: docs/PLAN-start-a-game-redo.md B3; scripts/dev-test/check-whats-on.js; the story's version 2, https://claude.ai/artifact/LMc46gkHTVcWgWCKCmPMT2.

## 2026-11-18 · A team's one-game games live on the team's season; a one-episode game's clashing name says its episode
- Decided by: the user ("I want your recs to the question you ask. Then continue"), taking Claude's recommendation
- Why: a show's short games add up because they share a season; one season per sports game meant a team's daily games never shared a Games tab, an archive or a record. A counter ("Predictions 2") would split one kind in the archive's chips.
- What: Play the next game (one game, from a team) starts on the team's season, that game only; a run, a rival's meetings and the whole season are unchanged; a game the team's season can't hold keeps its matchup. A one-episode game whose name is taken is named by its episode ("Predictions · Game 2").
- Rejected: a whole league's season for one team's games (too broad for a couch following one team); one season per game (today's: no archive or record for a sport).
- Rests on: src/lib/server/sports/start.ts teamSeasonFor; src/lib/server/start-spec.ts; check-sports-couch.js; story-sport-daily.js.

## 2026-11-19 · Round 4: Game settings is a list; each game's settings are its own page, in Start a game's grammar
- Decided by: Claude, through the three skills in order (Intent's spec, PFD's first view, Impeccable's shape and build), one check (PFD evaluate 79; Impeccable critique 27/40 from a reviewer that saw neither PFD's findings nor the session's reasoning), one batch, one confirming look; built behind ?settings=r4 (TEMP-UI) for the user's review
- Why: the page stacked every control of every game (3,385 px for three games, past 65,000 px on a season of short games), spoke of how moves lock in the engine's words rather than Start a game's, and had no way in from the game.
- What: a row per game you run (its type, when this episode's lock falls, how moves lock, who joins), a night's and finished games folded; each game's settings a page pushed over the game (its ⋯ menu) or the list: the title card, this episode's lock with its action in words, the rules as value-first lines opened one at a time (a fixed one with its reason), How moves lock as Together or At your own pace with Together's late moves, Archive or delete named for the game. A Game admin reads it with one notice and the lock live.
- Rejected: every game's settings stacked (today's); Start a game's yellow chosen ring (the chyron stays for what's due); a padlock for fixed rules (it's this episode's lock's mark); the AUTO switch (it named the mode, not the action).
- Rests on: docs/design-round/round4-game-settings-spec.md, -first-view.md, -shape.md, -pfd-eval.md, -critique.md; scripts/dev-test/story-game-settings.js.

## 2026-11-19 · Round 4 approved and built (B4): a Game admin keeps the page; Archive all on the Finished fold; who's playing stays on Members
- Decided by: the user ("I'll take you recs, then continue here"), taking Claude's three recommendations on Round 4's story
- Why: a Game admin's one job (the lock) lives on the game's own page, read only otherwise; a season of short games leaves dozens finished, one tap clears them with one Undo; Members already removes people, and a second place would drift.
- Rejected: the lock alone on the game page for a Game admin; archiving finished games one at a time only; a players list in each game's settings.
- Rests on: https://claude.ai/artifact/WMc3vd96GAJwaZTHLQKevh; docs/PLAN-start-a-game-redo.md B4.

## 2026-11-19 · A one-episode game always says its episode in its name
- Decided by: Claude (the code review of the team-season change)
- Why: the first of a kind kept a bare name while the next said "· Game 5", so the archive mixed both and the first row never said which night it was.
- What: "Prediction sheet · Episode 20", "Predictions · Game 3" from either start path; a typed name is kept, the episode added only when the couch already uses it; held to 60 characters with the suffix whole.
- Rejected: the episode only on a clash (the first bare); a counter ("Predictions 2").
- Rests on: src/lib/server/start-game.ts gameName; src/lib/game/spans.ts kindOf.

## 2026-11-19 · Round 5 (B2): each play piece made in Your moves, counted on a person's sheet, what's left said where it's made
- Decided by: Claude, through the three skills in order (Intent's spec, PFD's first view, Impeccable's shape and build) and one check (PFD evaluate and an isolated Impeccable critique), for the user's review
- Why: seven pieces the wizard can make (a captain, a pool's second pick, group slots, an auction, beat the bot, a cut, a pool's lives) were named on a game's page and couldn't be made there or never showed what they did (the explorer plan's Designs needed 10, 21, 24, 26, 27, 28, 30).
- What: a Captain row under a lineup's starters; a pick sheet's two places; a lineup's slot rows with the groups on offer opened in place; prices on a team; the bot's call under each settled answer and Against the bot under the grid; a knocked-out person's finish in the strip with no move; the pool's night marks on the grid with a key, and what's left above the pick.
- Rejected: a captain named by a second tap on a tile (a tile tap already starts or benches); a second pick as a second tap on the faces; a section of its own per piece on a person's sheet (each piece's row joins the week's list).
- Rests on: docs/design-round/round5-play-pieces-spec.md, -first-view.md, -shape.md, -pfd-eval.md, -critique.md; scripts/dev-test/play-pieces-fixture.js, story-play-pieces.js, check-play-pieces.js.

## 2026-11-19 · Nobody is named captain for you: the captain carries with the lineup, and a benched captain leaves none
- Decided by: Claude (default), while the user hasn't answered Round 5's open question
- Why: the rule says "name nobody and your last captain keeps it, while they're starting"; naming one for you would be a move nobody made.
- Rejected: the top-scoring starter named automatically when there's none.
- Rests on: src/lib/game/game-spec/describe.js (the captain's rule); docs/design-round/round5-play-pieces-spec.md, Open questions.

## 2026-11-19 · Against the bot counts three outcomes: beat it, level (both right, nobody scores), it won
- Decided by: Claude, on both of Round 5's checks (PFD V-L4-001, the critique's finding 2), overturning its own default (beaten as the engine counted it, matching included)
- Why: a window you and the bot both got right was counted as the bot beating you, so the line disagreed with your sheet ("The bot said Cameron too, so it doesn't score").
- What: the server's bot line (answer-points.ts botLine) and the explorer runtime's copy count `level` apart from `beaten`; the block says each in words.
- Rejected: keeping beaten as it was and explaining the tie in words.
- Rests on: docs/design-round/round5-play-pieces-pfd-eval.md, -critique.md; tests/beat-bot.test.js.

## 2026-11-19 · A pool's second pick takes its own tap; a tap after the pick still changes the pick
- Decided by: Claude, on the critique's finding 4 (PFD's R4: the same gesture never does two things)
- Why: the sheet moved the next tap to the second place by itself, so changing your mind made a second pick, which can end a streak and use a castaway up.
- Rejected: the next tap filling the second on its own.
- Rests on: docs/design-round/round5-play-pieces-critique.md.

## 2026-11-19 · Someone knocked out of a draft has no lineup or pick offered (BACKLOG 47), for everyone at once
- Decided by: Claude
- Why: the server refuses the move, so offering it was a bug; the view's no-move and the strip's finish aren't behind Round 5's switch.
- Rests on: src/lib/game/game-view.ts lineupOf, pickOf; src/lib/game/game-page/model.ts stripOf.

## 2026-11-19 · Round 5 approved and built (B2): no captain named for you; a second pick its own tap; out keeps the finish; held groups show
- Decided by: the user ("ill take your recs"), taking Claude's four recommendations on Round 5's story
- Why: naming a captain for you would be a move nobody made; a tap that quietly becomes a second pick can end a streak; a knocked-out person's game is the finish and what they still watch; an exclusive game's held group refused after you've chosen is worse than shown before the lock.
- Rejected: the top starter named captain automatically; the next face tap filling the second pick; a knocked-out person keeping side bets; held groups hidden until the lock.
- Rests on: https://claude.ai/artifact/YFe6VFPpA4vDAU7tn95zdj; docs/PLAN-start-a-game-redo.md B2.

## 2026-11-19 · A parlay on a split pot multiplies your share (E3, tracker row p25)
- Decided by: the user, taking Claude's recommendation
- Why: the pot is everyone's; a parlay rewards what you got from it, so the others' shares stay as they were.
- Rejected: your call counted twice before the split (it grows your slice of a pot everyone else shares too).
- Rests on: src/lib/game/game-spec/schema.js parlayProblems; tests/parlay-legs.test.js.

## 2026-11-19 · Every Outlast counts boots from its own start, a game of its own's too, applied to existing games (E3, BACKLOG 62)
- Decided by: the user ("Count from its own start", then "Apply to every game" when shown the one existing league it moves)
- Why: a mid-season Outlast is a separate game; everyone starts level instead of with the boots before it as a head start.
- What: one league on the production copy (a Survivor 51 Outlast from Episode 2) shows each seat 3 fewer points, the order unchanged.
- Rejected: new games only (a migration marking existing ones to keep counting the whole season).
- Rests on: src/lib/game/state-logic.js EliminationOrderScoringStrategy.baseOf; tests/stages.test.js; scripts/dev-test/compare-totals.js --db.

## 2026-11-19 · C8 (2-on-1 head to head): a tie for all three; wins then points; no playoffs; four or five play the round robin; who's alone first drawn at random; the pair averaged
- Decided by: the user, answering C8's seven questions (six recommendations taken; "who's alone first" drawn at random instead of the join order)
- Why: the same rules as head to head where they fit; a random first turn so no one is alone first just for joining first.
- Rejected: the one alone or the pair taking a tie; points first; a final between the top two; two on two or one against the rest for four or five; the join order; the pair's lower or higher score.
- Rests on: docs/PLAN-start-a-game-gpt.md C8; docs/PLAN-start-a-game-redo.md E3.

## 2026-11-18 · In the late window the strip says the moves are open: "Before you watch it" when something's missing, "All set for Ep 9 · Change it before you watch" when it's all in
- Decided by: Claude (default, until the user reviews the story)
- Why: the live and own paces keep a move open until you watch; the strip said "Locked for Ep 9" through the airing (strip.tsx returned the locked state before reading the moves), and "Lock when it airs" after it. "Before you watch" is the user's own words for the window ("edit my lineup before watching") and carries the honour rule in the sentence.
- Rejected: "Open until you watch" (a state without the rule); "Still open" (says nothing about until when); keeping "Locked" with an unlocked sheet behind it.
- Rests on: docs/design-round/strip-night-spec.md; docs/PLAN-own-pace-games.md "Pace is the game's setting".

## 2026-11-18 · "Scores stay hidden until you reveal" leaves the strip; a strict or hand-locked episode's strip shows who you've got instead
- Decided by: Claude (default)
- Why: during the airing no scores exist, and once they do the progress control's Seen Ep 9? / Reveal Ep 9 says what's waiting (each fact once); who you started is the question people bring to a locked episode.
- Rejected: keeping the reassurance line.
- Rests on: docs/design-round/strip-night-spec.md, "Left out".

## 2026-11-18 · The honour note's "I've watched it" shows only once the episode's results are in
- Decided by: Claude (default)
- Why: before results the reveal it opens has nothing to show (a dead end); the words ("Watching now, or seen it already? Leave it as it is") carry the rule until then, and once results are in the progress control's Seen Ep 9? is the same way out.
- Rejected: a self-lock behind it (a new rule).
- Rests on: docs/design-round/strip-night-spec.md, "Your moves, opened in the window"; src/new/show/reveal.tsx Broadcast.

## 2026-11-18 · Nobody watching live may read the late window as theirs
- Decided by: the user ("We also don't want someone who's watching live to be mistaken that they can make moves because that would be cheating")
- Why: during the airing most people opening the app are watching it; a strip saying "Change it before you watch" over an open lineup reads to someone mid-episode as permission.
- Rejected: words alone as the guard (the round's first draft).
- Rests on: docs/design-round/strip-night-spec.md, "Watching live isn't 'before you watch'".

## 2026-11-18 · In the window Your moves asks "Have you started watching Ep 9?" before it opens the moves; I'm watching locks them
- Decided by: Claude (default, until the user reviews the story)
- Why: the user's rule above needs the honour system at the moment of change, as a deliberate answer, not a line to miss; Not yet keeps the window for whoever hasn't started; I'm watching (and starting Watch along) settles it for whoever has. The words move from the episode to the moment: "Locks when you start watching", "Before you start watching".
- Rejected: closing the window for everyone at airtime (takes the late window from people who watch later, the reason it exists); inferring watching from bingo ticks or chat during the airing (a surprise lock from a signal the person didn't mean); a confirm only on Save (the moves would already look open).
- Rests on: docs/design-round/strip-night-spec.md; the engine step (a seat's own lock for an episode) is planned there, simulated in the story.

## 2026-11-18 · Look C for the episode-night strip, with a Lock in button in its first row
- Decided by: the user ("I honestly disagree, C i think is best because it give you not only a way in to set each missing or desired-edit per game but it also helps the 'at a glance' who do i have set question. Maybe in that first row on the right side of the banner theres a Lock In button to essentially say, 'I made my picks, Im about to watch'")
- Why: a row a game is both the way in to each move and the answer to "who do I have"; Lock in turns the honour system into one deliberate action where the moves are.
- Rejected: B, the checks' pick (faces on the strip, one tap to the sheet); its first-view saving is kept by collapsing C to B's strip once you've locked in.
- Rests on: docs/design-round/strip-night-check.md (C's costs: the first view, a second shape on other tabs, truncation; the refinement answers each).

## 2026-11-18 · The Games tab shows who you've got at a glance, as face plates
- Decided by: the user ("I feel like our discussion exposes that we have no at a glance view. Which could certainly be added in the games tab. For instance we mention Thien but never show her face plate. We don't see our lineup here either.")
- Why: each game's card named the move ("Your Episode 9 pick: Thien", "Your Episode 9 lineup") without the people in it; the card is where a game is read at a glance, all week.
- Rejected: words only (today); the 28 x 36 tiles of the older move card (too small to know a face).

## 2026-11-18 · The Games tab's plates are the pool sheet's face plates, four to a row, the bench and a pick's stake in the last cells
- Decided by: Claude (default, until the user reviews the story)
- Why: the pool sheet's plate (a white caption plate, the face, the first name in condensed caps) is the app's own "face plate", so a pick looks the same where it's made and where it's read; a lineup's starters carry their points, its bench sits beside them in words; a pick's empty cells say what it puts on the line ("Streak 4 → 5 if Cristian survives"), the sweat's number beside the decision; an empty place is dashed, as in the sheets. The whole move opens Your moves, as its line did.
- Rejected: a plate opening the castaway's sheet (Product Principle 12 would have it; a second target inside the move, left for the build); the lineup sheet's dark photo tiles (a sheet for choosing, not reading).
- Rests on: docs/design-round/strip-night-spec.md, "At a glance on the Games tab".

## 2026-11-18 · Each game type has its own glance, and nothing grows past a row until asked
- Decided by: the user ("different game types should have different at a glance views (for situations where an in-table at a glance isn't possible, we could consider a collapsible/expandable section or a quick pop up)"; "the UI should consider a large starting lineup")
- Why: a lineup, a pick, a claim and a team are different objects; a sport's nine starters can't sit in a card the way a show's three do.

## 2026-11-18 · One row of four, gaps first, "+N" opens the rest in place; an empty big lineup is one dashed line naming its slots
- Decided by: Claude (default, until the user reviews the story)
- Why: a card stays a glance at any lineup size; what's missing never hides behind "+N"; opening in place keeps you on the Games tab (a pop-up is kept for a glance that isn't faces: a prediction sheet's answers, a bingo card, which open their own sheets); nine empty boxes say less than "9 open · QB, WR, WR, RB, RB, TE, W/R/T, K, DEF". Plates are tagged by slot where the game has slots and open the castaway's or athlete's sheet (Product Principle 12); the move's words open Your moves.
- Rejected: wrapping every starter into rows (a nine-man lineup is three rows on every visit); a pop-up for the faces (a second layer to see who you've got); hiding gaps behind "+N".
- Rests on: docs/design-round/strip-night-spec.md, "At a glance on the Games tab".

## 2026-11-18 · However many games are going: Tonight's plate holds three rows, a game card's glance is one row
- Decided by: the user ("We want to keep the vertical real estate in check. Because who's to know how many games could be going on in a given moment"); the shapes below by Claude (default, until the user reviews the story's version 5)
- Why: version 4 drew every game in full, so the views grew with the couch: with seven games Tonight's plate ran under the tab bar and the Games tab grew by about 1,000 px (3,257 to 4,263). Now the plate shows its head and at most three rows (past three games, the two that need you first and one fold row: a face a game, "All set" or "N to set", opened in place); each card's glance is the move's own row (three small tiles, who they are once set, the verb as text, as Tonight's rows say it), 3,285 px for seven games; its tiles open the plates in place. Three games look as they did. The one-line strip elsewhere keeps its faces only up to three games and drops them on the Games tab, whose cards show who.
- Rejected: version 4's plates in every card (about 130 px a game); a pop-up for the glance (an extra layer for the common question, "who did I start?"); folding the games that need you (they lead, and the head counts them all); the outlined button in the glance's row (it took the names' room: four lines a row at 390).
- Rests on: docs/design-round/strip-night-spec.md, "However many games are going"; night-fixture.js --extra=4; the story's version 5.

## 2026-11-19 · The episode night's heights stay as built: Tonight's plate a head and three rows (past three games, two and a fold), a game card's glance one row
- Decided by: the user, taking Claude's recommendation ("i want your recs for all three, then continue")
- Why: three rows fit the real night (a lineup, a pick, a claim) with no fold; the fold only comes past three games; the glance costs about 4 px a card (seven games on Round 3's tab: 3,108 px without it, 3,136 with it). The tab's length is its leaderboards, a separate question.
- Rejected: two rows (it folds an ordinary Wednesday).
- Rests on: docs/design-round/strip-night-spec.md, "However many games are going"; the story's version 6.

## 2026-11-19 · A full lineup carried in from last week is set while the window is open: no yellow, no reminder; only something missing is due
- Decided by: the user, taking Claude's recommendation (every check had said the same)
- Why: a carried full lineup is a real lineup that scores; calling it due from airtime made the yellow and the after-airtime reminder a weekly false alarm for everyone who watches later, which teaches Joanna to ignore the yellow the week something is missing. A starter gone, an empty slot or no pick stays due.
- Rejected: due from airtime (the own-pace rule of 2026-11-14, written for the one seat a Commissioner switched to its own pace).
- Rests on: src/lib/server/due-moves.ts, db/reminders.js, src/new/show/your-move.ts; tests/own-pace.test.js, tests/your-move.test.js; check-lock-in.js --moves=kept.

## 2026-11-19 · Lock in is a real lock: a seat's mark on the episode in each game (ep.lockedIn), closing its window as watching would, set in every game of the person's on the season; Undo within a minute only
- Decided by: the user (build it), its shape by Claude (default)
- Why: Lock in carries the honour system and the user's rule that nobody watching live changes a move by mistake. A browser-only lock didn't follow you to another device and the server still took a change. In the league state the mark closes the window wherever the engine reads it (GhostLogic.lateWindow: the move routes' lateMark, a question's answers, Weekly Calls' own copy in calls.ts), with no migration. The toast's Undo is a mis-tap's, never a change of heart mid-episode, so the server allows it for a minute.
- Rejected: a column beside the watch mark (show_follows or league_memberships: every caller of the window would have to read it, and a migration); unlocking any time (a lock you can lift isn't one); locking at airtime for everyone (takes the window from people who watch later).
- Rests on: StateLogic.GhostLogic.lockIn, unlockIn, lockedInFor; GameView.watching; /api/seasons/[seasonId]/lock-in; scripts/dev-test/check-lock-in.js.

## 2026-11-19 · Look C is the app: the ?strip switch, looks A and B, the ?carried simulation and Your moves' honour note are gone
- Decided by: the user's pick (2026-11-18), built
- Why: C with Lock in was the pick; the started gate ("Have you started watching?") replaced the honour note in C, so it could no longer show.
- Rejected: keeping the switch (two apps to keep right).
- Rests on: src/new/show/strip-night.ts, strip.tsx, dock.tsx.

## 2026-11-20 · The settings overhaul: every cut and addition approved, Backstage retired
- Decided by: the user, on the proposals page ("Settings proposals: yes to your recommendations, except yes to A5. Let's talk about
  C8."). Then C8: "We've pretty consistently been using ChatGPT, so i think we should drop grok and just have the chatgpt link".
- Why: the audit found settings in about 25 places, filed by when they were built rather than by what they're about. Many no longer
  earn a control, and things people expect are missing.
- What:
  - C1–C49 as proposed, with C8 going further: Grok and the AI setting go.
  - Additions A3, A5–A9, A11, A13–A17 and A19–A20; A1–A2 wait on BACKLOG 185.
  - Backstage retired, so each game has Manage this game.
- Rests on: docs/PLAN-settings-overhaul.md; docs/design-round/settings-audit.md; https://claude.ai/artifact/3VjAovJaVsBkfZcLEqoY4V.

## 2026-11-20 · Settings, Round 0: homes by subject, one gear on every bar, the four names
- Decided by: the user, taking the recommendations on Round 0's story ("I agree shape 1 is probably best"; the gear; "Use all
  four"). The reviewers had split on the first two.
- Why: Shape 1 won or tied every situation's taps and passed all five of PFD's first-view requirements. Its weakest point was
  getting in (four homes, four doors), and one gear fixes that.
- What:
  - **Homes:** every setting lives on its subject: Your settings, This show, This couch, This game.
  - **Your settings' first view:** groups with their values, not questions, plus a "Your shows, couches and games" row that opens
    each home.
  - **The way in:** one gear on every bar opens that thing's own settings page. The ⋯ keeps only things to do.
  - **Names:** Manage this game (a show's list: Games you run); Helper for the Game admin; waivers' presets Relaxed · Standard ·
    Strict; Skip possible spoilers for Quiet nights.
  - **Round 1's bar on the built screens:** PFD 80 or more, Impeccable 32 or more out of 40.
- Rejected:
  - **One Settings with tabs (Shape 2).** You choose a scope before any setting, and a show and a couch were told apart by one
    word.
  - **Questions first (Shape 3).** From inside a show or a game it still needs the doors. Questions can be added on top later if
    people get lost.
  - **Another grey-box pass.** Polish belongs to the built screens.
- Rests on: docs/design-round/settings-r0-spec.md, -first-view.md, -shape.md, -names.md; scripts/dev-test/story-settings.js; the story
  https://claude.ai/artifact/UkbTP7G4f7uQhVqp32UMNm.

## 2026-11-20 · Settings, Round 1: a switch that can't ring reads Off; Not now stays; mute by the next episode in Round 2; quiet rows
- Decided by: the user, on Round 1's story ("Your picks on all four, and fix the sheet's ring too").
- Why: the check's two reviewers split on the first, and the other three weren't settled by the rules (docs/design-round/settings-r1-check.md).
- What:
  - **A switch that can't ring right now reads Off,** read-only, its line saying why: on Notifications while no phone gets them
    ("Chosen · comes once notifications are on"), and on a muted show's quieted kinds ("Quiet while it's muted · back when you
    unmute"). Reminders stay On on a muted show: they still come.
  - **Not now on the plate stays as Settings D has it:** gone on that phone for good; Notifications' row still says Off.
  - **Mute gets "Until the next episode" as its first choice in Round 2,** with the show's own page (the clock's three stay).
  - **Your settings stays quiet below your name:** no caption plate for the identity; the plate's yellow stays the page's one signal.
  - **The shared sheet focuses itself when it opens,** not its Close button (the keyboard keeps the first control), so a sheet opened
    from a link shows no yellow ring on Close.
- Rests on: docs/design-round/settings-r1-spec.md, -first-view.md, -shape.md, -check.md; the story https://claude.ai/artifact/97sfST4Ut41ib5HUHJPpjH.

## 2026-11-21 · Settings, Round 2: leaving drawn quiet; three results choices; no art, no band
- Decided by: the user, on Round 2's story ("I'll go with your recs").
- Why: the rules didn't settle these three (docs/design-round/settings-r2-check.md): PFD wants no red in the first view, and a short
  page puts the last row there.
- What:
  - **Leave all my games here, Remove from my shows and a game's Leave this game are drawn quiet,** still last after a gap: a plain
    label and a muted icon. The hold (or the Undo's toast) carries the red, so red means only the dangerous step.
  - **When results show here keeps three choices** (your default, after I've watched, straight away), so a choice pinned on one show
    survives a later change of the default. It sits in a fold most people never open.
  - **A show with no art gets no band:** just its name, at 44 px. No initials plate.
- Rests on: docs/design-round/settings-r2-spec.md, -first-view.md, -shape.md, -check.md; the story https://claude.ai/artifact/YMCNuwKciTJuGD91Q9XYrd.
## 2026-11-21 · A sport's game scope on the team's page: Start a game on's rows, each saying how many games and whose players
- Decided by: the user, taking Claude's recommendation (the story: https://claude.ai/artifact/MzFTpBSjZpDdcpMnyrpsYJ)
- Why: the team's four ways in looked like four kinds of thing, and Start a game… promised the season but opened on the next game. As one group of rows (The next game; Their season, "N games left · Bills players only"; a series; a picked rival's Every <rival> game) the scopes read as siblings under the one yellow, and Their season opens on the season.
- Rejected: "The Bills' season" as the row's title (the team's name sits in its line, the title stays short); whose players on the yellow plate or Pick'em (they pick no players).
- Rests on: src/new/sports/team.tsx; docs/design-round/sports-scope-spec.md, sports-scope-first-view.md, sports-scope-shape.md.

## 2026-11-21 · A draft says whose players it draws from, and one too big for its scope is caught before Start with Make it shared
- Decided by: the user, taking Claude's recommendation
- Why: a team's season draws only that team's players (2.8), so the screen says it ("Draft from: Bills players only · 74", following How long) and our check counts the scoped pool. Shared (drafted blind) always fits and keeps the size the maker chose.
- Rejected: "Draft N each" as the fix (changes the size; everyone's players stay their own, but it doesn't always fit a position-limited lineup either); the server's refusal after Start (the old way).
- Rests on: src/new/couch/gallery-bold/whose.ts, bold-sheet.tsx (the Start bar's warning), leads.tsx; src/lib/server/start-spec.ts (`wizard.scope`).

## 2026-11-21 · Settings, Round 3a: the gear stays; the waiver window's week moves onto Manage this game now
- Decided by: the user, on 3a's story (https://claude.ai/artifact/53oCgbQkJdW1e6RARGWP73): "keep the gear; move the waiver window's
  week onto Manage this game now".
- Why: the rules didn't settle either (docs/design-round/settings-r3-check.md). The gear: Round 0 chose one gear on every bar, and a
  game's only settings are its runner's. The week: PFD's leftover (findings 1, 2 and 6) was that the job and Replacing people who
  leave both left for a Waivers page sorted by game, with its own settings.
- What:
  - **The gear** on a game's bar opens Manage this game for whoever runs it, as built. No separate key.
  - **The open week is a job that opens in place** on the game's Manage this game: who's picked (never what), Pick for them, Run
    now, and the window's Change or Turn it off.
  - **Replacing people who leave opens in place** like the page's other lines: this week (Open a waiver window), the last run with
    Undo, how waivers work (the feel and Fine-tune, the Commissioner's; a Helper reads it as a value), and What players see. Its
    value names how windows come ("When your team is short · every 3 episodes").
  - **Pick for them is on a person's sheet** in Who's playing while a window is open, for a Helper too. A Helper's row is a door
    only then.
  - **Backstage's Waivers page is gone.** Its old address lands on Games you run, and the API is unchanged.
- Rejected: a key for "you run this" on a game's bar, with the gear only for your own settings; leaving the week for 3b.
- Rests on: src/new/backstage/waivers.tsx (WaiverJob, WaiverRule), game-settings.tsx, manage/people.tsx, manage/choice.tsx.

## 2026-11-21 · Tonight is the night, the Games tab is what you can play, a game's page is the season
- Decided by: the user ("Tonight is essentially a what happened last time tab"; "maybe this calls for the games tab to be more of a game launcher"), with Claude's split by time, which the user took ("Start")
- What: Tonight's games section shows the last episode for everyone in each game you play (a card a game, closed to your night, open to everyone's); someone who only watches sees no game's results there, only the couch's quick games for the next episode (or a season game open to join) to Join; the Games tab becomes the way into games (quick games first, your season games one line each, games to join, start one, your record) and loses its leaderboards and Last picks; the full season stays on each game's page.
- Why: the Games tab's rows and Tonight's opened cards would show the same leaderboard and picks twice; split by time, each place has one job, and someone with no games gets a place built to bring them in.
- Rejected: both tabs keeping a leaderboard and last picks (they'd drift apart); Tonight showing a watcher the couch's results as a teaser (the user: it won't show results or standings if they are not in it).
- Supersedes: Phase 0's decision 4 (2026-11-14: the Games tab kept for leaderboards and last picks) and Round 3's "what's on for me" as the Games tab's job (2026-11-18), once the Games tab's page is built.
- Rests on: docs/design-round/tonight-night-spec.md.

## 2026-11-21 · Everyone's night shows five people: the top three, the one just ahead of you, and you
- Decided by: Claude, default (the user proposed the top four and you, then left the call open: "I'm open to anything that makes sense")
- What: five or fewer, everyone; you in the top five, the top five; otherwise the top three, the person just ahead of you and you, with a gap mark; See all opens the game's episode sheet.
- Why: the person you can pass next is the comparison that moves you (today's "12 behind" line says the same); the fourth place means little to someone tenth.
- Rejected: the top four and you (the user's first idea: keeps a fourth leader the person tenth can't reach); the Games tab's top three and you (four rows, no one to chase).
- Rests on: docs/design-round/tonight-night-spec.md, "The five rows".

## 2026-11-21 · A one-episode game is called a quick game
- Decided by: Claude, default
- What: "quick game" in the app's words wherever one-episode games are offered or listed; a season game is "a season game" only where the two are set side by side.
- Why: it says what makes it easy (one move, over the same night), which is the ease the user wants to encourage; "one-episode game" and "night's game" are the code's words.
- Rejected: "one-episode game" (accurate, heavy); "Tonight's game" (clashes with the Tonight tab); "mini game" (reads as a toy).
- Rests on: docs/design-round/tonight-night-spec.md, "Three places, three jobs".

## 2026-11-21 · Quick games are encouraged by ease and spirit only
- Decided by: the user ("incentivize people just via the ease and spirit of the app"); its rules by Claude
- What: quick games come first wherever games are offered; who's in shown as real faces; one-tap Join; only real lock times; winners named, nobody scolded; no dismiss, count or reminder on a watcher's Join row (it's a listing, asked once); couch points unchanged and unshown.
- Why: friends playing is the pull; pressure would make Joanna feel hustled (the round's frame: never a casino's pressure tactics).
- Rejected: streaks or rewards for playing quick games; "you missed out" lines; a banner inviting a watcher to play.
- Rests on: docs/design-round/tonight-night-spec.md, "The encouragement, by ease and spirit".

## 2026-11-21 · Tonight's motion is what changed, once per episode
- Decided by: Claude, default (the user: "open to animations as you scroll sections or components into view")
- What: a card's change (place, arrow, bars, a bingo line) plays the first time it scrolls into view after a new episode, then stays still; nothing else moves on scroll; none with reduced motion.
- Why: motion that carries the news is read; motion on every card at every visit slows reading and repeats the reveal's moment.
- Rejected: every block fading or rising in as it scrolls (decoration, every visit).
- Rests on: docs/design-round/tonight-night-spec.md, "Motion".

## 2026-11-21 · Tonight's night shows bingo and trivia, not Call it
- Decided by: Claude, default, from the user's 2026-11-09 decision (Call it, predictions, polls and how your calls went stay off Tonight until a session on extras brings them back)
- What: the night's extras card holds the couch's bingo cards for the episode and this week's trivia scores, for whoever played; Call it stays off.
- Why: the user asked for everyone's trivia and bingo; Call it was switched off on Tonight by the user's own decision, which this round doesn't reopen.
- Rejected: Call it as a third line (the extras' general control, but reopening a settled decision without the user).
- Rests on: src/new/show/tonight.tsx NextEpisode (`more = false`); docs/design-round/tonight-night-spec.md.

## 2026-11-21 · A one-episode game is named by itself everywhere it's offered
- Decided by: Claude, from the check (both reviewers: "Join Survival Pool" on a "Who survives?" row, beside a Survival Pool you play)
- What: a quick game's card, Tonight's Join row and the join sheet say its own name without the episode it was named for ("Who survives?"); the sheet says it plays that episode only.
- Why: the base game's name made two games read as one, and a player already in the season pool would skip the Join or join the wrong thing.
- Rejected: the base game's name (what the sheet said before), the name with its episode (the block already names it).
- Rests on: docs/design-round/tonight-night-check.md.

## 2026-11-21 · The check: PFD 63/100, Impeccable 26/40; one batch fixed, five things left open
- Decided by: Claude, through the process (one check, one batch)
- What: the batch and what's left are in docs/design-round/tonight-night-check.md; the ledger's bars and a results line in the top strip go to the user as choices.
- Why: the rules settle the rest; those two touch an approved component and a settled order.
- Rests on: docs/design-round/tonight-night-check.md.

## 2026-11-21 · Tonight's night is one row a game, about 64 px; who scored and why is a tap deeper
- Decided by: the user ("The games section of tonight take up WAY too much vertical real estate"); the row's form by Claude through Impeccable
- What: each game a row (place and movement left; name, small faces with their marks and the news in the middle; the change right), opening everyone's night in place, each person a one-line row with their picks inline; the ledger (who scored and why) left Tonight for the person's sheet, one tap from your row; quick games, bingo and trivia a row each; four rows, then a fold. The closed section went from about 1,000 px to 424 px on the zt couch (three games, a quick game, bingo, trivia).
- Why: a card of about 185 px a game ran the section past a screen for three games; the glance needs a row, the detail is on demand.
- Rejected: trimming the cards' spacing (still a screen for three games); keeping the ledger in the open state (about 280 px more, and your detail is on your sheet).
- Rests on: docs/design-round/tonight-night-spec.md; the story's version 2.

## 2026-11-21 · Tonight's rows are led by the game; one-episode games first, each led by who won
- Decided by: the user ("too much emphasis on the place you're within the game. There should be more on the game name and length (so shorter and one episode games are first) ... a one episode game should maybe have its own subsection and show the winner"); the form by Claude through Impeccable
- What: the section in two groups, "One-episode games" (each led by who won it, with the couch's bingo and trivia led by who got a line first and who scored best) then "Longer games" soonest to end first; a longer game's row leads with its name in caps and its length ("Season · 7 left", "Eps 4–9 · 3 left"), the night's change on the right with your place small under it; "So far" once on the heading.
- Why: Tonight answers which game and how long first; your place is the game page's lead. One-episode games are the low-commitment way in, so they lead and say who won.
- Rejected: a game's place as the row's big number (version 2); "quick game" as the group's name (the user's words are "one episode games").
- Rests on: docs/design-round/tonight-night-spec.md; the story's version 3.

## 2026-11-21 · Tonight has a row for every kind of game, and every engine change names the screens it reaches
- Decided by: the user ("make sure there's a tonight one row designed for every game type ... if a new engine capability is added or modified, we need to have a record of all UI areas that need to be reviewed"); the registry and map by Claude
- What: src/lib/game/night-rows.ts declares each of the 15 main blocks' Tonight row (faces, change, second line, place, open), a Record over MainBlock so a new block fails tsc, with tests/night-rows.test.js reading the grammar's list; night.tsx reads it. docs/UI-REVIEW-MAP.md lists every screen each kind of engine change reaches and which checks fail; AGENTS.md points every session to it.
- Why: the row was generic past the three kinds the couch plays; a new capability would have fallen back silently.
- Rejected: a design per game base (56 bases share 15 main blocks); relying on the gameplay coverage matrix alone (its ledger has never been used, and it doesn't fail anything).
- Rests on: docs/UI-REVIEW-MAP.md; src/lib/game/night-rows.ts; the story's per-pattern frames.

## 2026-11-21 · Bingo and trivia are Last time's quiet expander, not games; trivia shows who got each question right
- Decided by: the user ("the bingo and trivia that always occurs can be toned down. Just an expander ... the moments that hit and who got bingo ... trivia should show questions and answers and who got it right ... it's actually just a every episode occurring feature")
- What: out of Your night's one-episode group; one row in Last time ("Bingo and trivia", who got bingo and your trivia score), opening to the moments that hit and who got bingo, then each question, its answer and who got it right. Trivia's answers show only once you've played the round. The trivia read now carries which questions each couch member got right once you've played (never their wrong answer); bingo's read carries the moments that hit across the couch's cards.
- Why: bingo and trivia come with every episode for everyone who follows the show; set out as game rows with winners, they read as games someone started.
- Supersedes: trivia's "someone else on the couch sees only your score" (src/lib/server/trivia.ts), now a score plus which questions they got right.
- Rejected: per-person bingo cards as glyphs and trivia dots in the games group (version 3).
- Rests on: docs/design-round/tonight-night-spec.md, "Bingo and trivia: Last time's, not games".

## 2026-11-21 · Tonight's night approved as version 5
- Decided by: the user ("Looks good!", on the story's version 5)
- What: Tonight's games section as built on branch tonight-night through 18e313d9: one row a game led by its name and length, one-episode games first led by who won, the longer games soonest to end first, every kind of game's row (night-rows.ts), everyone's night in place, the Join row in the next episode's block, Bingo and trivia as Last time's expander. Still open: BACKLOG 239 (one-episode or quick game) and the round's two choices (a results line in the top strip; the ledger off Tonight).
- Next: the Games tab as the way into games (the spec's "Three places, three jobs"), in a fresh session.
- Rests on: the story https://claude.ai/artifact/1y8nHXhkub2XuSiMwwWykp (version 5); docs/design-round/tonight-night-*.md.

## 2026-11-21 · Tonight's night ships with the Games tab, not before
- Decided by: the user ("We'll wait for the games tab")
- What: branch tonight-night isn't merged or pushed until the Games tab's round (the way into games) is built and approved; then both go together.
- Why: the two pages split one job between them (Tonight the night, the Games tab what you can play); alone, Tonight would repeat the Games tab's leaderboards and Last picks.
- Rejected: shipping Tonight alone before Ep 10 (Claude's recommendation: the couch would have seen it after Ep 10).

## 2026-11-21 · The Games tab is the way into games: the next episode's one-episode games, your longer games a row each, games to join, Start, your record
- Decided by: the user's split (2026-11-21, "Three places, three jobs"); the page's order and rows by Claude through Intent, PFD and Impeccable
- What: For Ep N (yours, then the couch's with Join, then Start a one-episode game with Again, then the episode's extras folded); Your longer games, a row each (Tonight's row: name and length, who you've got for the next episode as small faces, your place), soonest to end first, five or four and a fold; Longer games to join; Start a longer game; your record as one row to the finished games' page. Someone who only watches gets the same page without their own games.
- Why: the smallest step first, and one place for each fact: the night is Tonight's, the season the game's page's.
- Rejected: keeping each game's leaderboard and Last picks (Tonight's open row and the game's page hold them); the newest episode's results on the tab (Tonight's one-episode group).
- Supersedes: step 6's Games tab (2026-11-15: a row with a mini leaderboard and Last picks) and Round 3's "what's on" order (2026-11-18), as the decision above said it would.
- Rests on: docs/design-round/games-launcher-spec.md, -first-view.md, -shape.md.

## 2026-11-21 · Who you've got stays on the Games tab as the row's faces; the glance's opened plates leave
- Decided by: Claude, from two settled decisions (2026-11-18: "The Games tab shows who you've got at a glance, as face plates"; 2026-11-21: "your place per game in a line, nothing more")
- What: a longer game's second line shows your next episode's people in the game's own shape (glanceShape: starters, a pick, a team with who's out greyed, a claim) at 22 px, four then "+n", with the move's words; the plates that opened in place go (the game's page and Your moves have them).
- Why: both decisions hold: who you've got is seen at a glance, and the row stays one line's height.
- Rejected: dropping the faces (the 2026-11-18 decision's reason: "we mention Thien but never show her face plate"); keeping the plates opening in place (a row grows past a row).
- Rests on: docs/design-round/games-launcher-spec.md, "A longer game's row".

## 2026-11-21 · A longer game's whole row opens its page; its move stays the strip's
- Decided by: Claude, through PFD (R4: one target a row) and Phase 0 decision 8 (one yellow a view)
- What: the row is one link (the game's page; mid-draft, the draft room); a due move shows the strip's small dot and its words. One-episode games keep their button (the move is the whole game).
- Why: step 6's card had four look-alike targets; the strip and Your moves are where a move is made.
- Rejected: an outlined button on each longer row (a second target, and Pick, Set and Draft side by side on every row).
- Rests on: docs/design-round/games-launcher-first-view.md, L3.

## 2026-11-21 · A game nobody new can join isn't listed on the Games tab
- Decided by: Claude, default
- What: Longer games to join lists the couch's games you could join or ask to (Join, Ask, Asked); one that's locked to newcomers is left to the couch's page.
- Why: a row with nothing to do is a dead end on a page whose job is the way in.
- Rejected: a Locked row (today's): it reads as an offer that refuses.
- Rests on: docs/design-round/games-launcher-spec.md, "A longer game to join's row".

## 2026-11-21 · The Games tab's check: PFD 71/100, Impeccable 26/40; one batch fixed; two choices to the user
- Decided by: Claude, through the process (one check, one batch)
- What: the batch and what's left are in docs/design-round/games-launcher-check.md; the strip's words beside a one-episode game of the same verb (BACKLOG 240) and Tonight's next-episode rows taking this tab's form (BACKLOG 241) go to the user.
- Why: the rules settle the rest; those two touch approved components (the strip, Tonight's night).
- Rejected: dropping the kind dot (Impeccable's advice; it's Tonight's row's grammar, so the due dot went instead, PFD's call on what's noticed first).
- Rests on: docs/design-round/games-launcher-check.md; the story https://claude.ai/artifact/5D9STJ6R4jFVgtkKEdCdpx.

## 2026-11-21 · The stat of the week sits in Last time, a step under who left
- Decided by: the user ("we had a cool little section that included stat of the week. Should that be moved up?"; Claude's recommendation, taken)
- What: the stat of the week's plate moves from the bottom Stats card into Last time, under who left and above the GIFs, its title a step under the Out plate's (18 px against 19) so who left leads; the two leader boards and All N stats stay at the bottom.
- Why: it's picked from your latest episode (cast-stats.ts featured: a stat with a clear leader that moved in it), so it's what happened last time, for watchers and players alike.
- Rejected: moving the whole Stats block up (it would push the games down for the boards' sake).

## 2026-11-21 · The strip names a pick's game when another pick game is on for the episode (BACKLOG 240)
- Decided by: the user ("i agree with your recs"), on the Games tab's check
- What: a pick's strip words become "Survival Pool: pick who survives" (the name the Games tab's row gives it) when another pick game covers that episode, yours or the couch's; a one-episode game's own pick says its name ("Who goes home?"). Alone, a pick keeps "Pick who survives". src/new/show/pick-words.ts; tests/strip-pick-words.test.js.
- Why: "Pick who survives" over a one-episode game called "Who survives?" that you're not in read as that game (both reviewers: Joanna taps the wrong one).
- Rejected: renaming one-episode games away from the pick's verb (they're named by whoever starts them).
- Rests on: docs/design-round/games-launcher-check.md.

## 2026-11-21 · Tonight's next-episode rows take the Games tab's form (BACKLOG 241)
- Decided by: the user ("i agree with your recs")
- What: Next · Ep N+1 lists your one-episode games as the Games tab's QuickRow (You're in, who's in, your move's state and its button) and the couch's to join as its join row (faces first, what it asks, Join or Ask); Round 3's night row is gone.
- Why: one game looks and works the same on both tabs (PFD's L2: one form per fact).
- Rejected: Tonight's rows staying as they were (two forms of one game, one with a button and one without).
- Supersedes: the Next block's rows in the 2026-11-21 "Tonight's night approved as version 5" entry.
- Rests on: docs/design-round/games-launcher-spec.md, "A one-episode game's row".

## 2026-11-21 · "One-episode game" is the app's word; "quick game" was the round's shorthand (BACKLOG 239)
- Decided by: the user ("i agree with your recs")
- What: wherever a person reads it, a game over one episode is a "one-episode game" (Tonight's group, the Games tab's Start row); "quick game" stays only as the docs' and code's shorthand.
- Why: it's what the user called them.
- Supersedes: "A one-episode game is called a quick game" (2026-11-21).
- Rests on: BACKLOG 239.

## 2026-11-21 · The Games tab as the way into games approved, with Tonight's night; both merge together
- Decided by: the user ("Approve continue here", on the story's version 2)
- What: the Games tab as built on branch tonight-night through 29b5fd30 (the next episode's one-episode games first, your longer games a row each, longer games to join, Start, your record; the strip's pick words; Tonight's next rows in this tab's form), merged to master with Tonight's night (approved as version 5).
- Rests on: the story https://claude.ai/artifact/5D9STJ6R4jFVgtkKEdCdpx (version 2); docs/design-round/games-launcher-*.md.

## 2026-11-21 · Settings, Round 3b: changing a game once it's under way, as built
- Decided by: the user, on 3b's story (https://claude.ai/artifact/SCCquWVBtn7qhotipLmcyx): "Agree with your recs" (all four).
- What:
  1. **The players' vote on a moment added mid-season decides** (more than half; else the most votes when the next episode airs;
     nobody voting keeps the default; a tie is the Commissioner's call). It doesn't advise.
  2. **New points for a moment a game already had count from the start**, as today, and the players are told. Points kept by
     episode stays a possible engine step, not planned.
  3. **The default for a moment added mid-season reads the show's format:** Survivor's and The Traitors' from the next episode
     (so Survivor 51's three games, for any moment added from now on); The Challenge's and a show's first season here from the
     start. Nothing already scored moves.
  4. **No Lock now on episode night's plate for runners:** the lock stays on Manage this game, two taps from the game's gear.
- Rests on: docs/design-round/settings-r3b-spec.md, -first-view.md, -shape.md, -check.md; src/new/manage/moments.tsx,
  src/lib/server/moment-votes.ts, db/rulebooks.js recordAddedMoments, state-logic.js momentFrom.
