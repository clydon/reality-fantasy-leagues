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
