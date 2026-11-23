# Plan: sports on the couch (the hub's scores strip, a league's page, playing as a couch, lines)

> **Status (2026-11-22): A1-A3 and B1 (This week, Scores, Games, Standings, Chat) merged and live (56127b49, pushed 2026-11-22;
> migrations 0313 and 0314 rehearsed on a copy of production, the snapshot `pre-sports-couch-2026-11-22` keeps 7 days). Next:
> BACKLOG 254's leftovers, then B2, B3 and B4 apart (How the sessions go from here).** The user's calls are in. Lines are Phase D, detailed in
> [PLAN-sports-lines.md](PLAN-sports-lines.md). March Madness (E1) is dated: working by Fri 2027-02-26.

## Read first

- **The three idea rounds** (hand-built mocks, real ESPN data where it exists):
  - Round 1, a league's space and search: https://claude.ai/artifact/CQp4o6W7aLfhDaQvTP2cMx ([design-round/sports-space-spec.md](design-round/sports-space-spec.md), `-first-view.md`, `-shape.md`).
  - Round 2, how a couch plays: https://claude.ai/artifact/GbokCQCZT2EovpTbzCPXtX ([design-round/sports-couch-play-spec.md](design-round/sports-couch-play-spec.md), `-first-view.md`, `-shape.md`).
  - Round 3, the hub's scores strip and the quieter league card: https://claude.ai/artifact/KSFYVgvbnZx5T5HE8gqiCF ([design-round/hub-scorebug-shape.md](design-round/hub-scorebug-shape.md)).
- [PLAN-sports-lines.md](PLAN-sports-lines.md) for lines (what ESPN has, verified 2026-11-22), and [PLAN-sports-ready.md](PLAN-sports-ready.md):
  its Phase 4 designs the pages inside a game, and Phase 5 brings live points. This plan is the rest of the app around them.
- [DESIGN-PROCESS.md](DESIGN-PROCESS.md): every page here still goes Intent, PFD, Impeccable, one check, a screenshot story from
  real renders at 390, then the user's review. The rounds above are ideas, not approvals of built screens.

## Settled by the user

1. **No separate sports hub.** A league card on Your shows is the way in (Patriots → NFL, Yankees → MLB), and it opens the league's
   page: "what teams the couch watches/follows, the schedule, and maybe an option for a game for the league or game" (2026-11-21).
2. **Your shows keeps its name** (2026-11-22): not "Your shows & sports".
3. **The league card is shorter and a smidge subtler** (2026-11-22): 72 px, no live score, no red (round 3).
4. **Your followed games, live and upcoming, sit in a strip right below the guide bar, never taller than it** (88 px),
   swipeable, with a sign there's more, as a bold sports-app scorebug (2026-11-22; round 3's design).
5. **The couch plays as fans** (2026-11-21): a lone fan shows off through watching and the games he makes; many play solo; a
   rivalry between two couch members' teams gets a quick, easy game (round 2's model).
6. **Lines come from ESPN only. No paid API, ever** (2026-11-22). Where ESPN has no line, the app makes its own from stats.
7. **Line games, all in** (2026-11-22): against the spread with upset points, player lines (higher or lower), futures pools, and
   rivalry stakes. Points, never money.
8. **The couch's default weekly NFL game is Pick'em on only the couch's games** (2026-11-22); every game stays one row away.
9. **March Madness is on the calendar** for Selection Sunday 2027 (2026-11-22).

## Defaults adopted (the recommendations the user didn't overrule; change any at review)

- The strip's tile says **Scores** ("Games" already means the games you play); a final stays until seen, at most 36 hours; a
  coming-up bug shows the line in words ("LAC by 3"); up to two couch faces a side.
- A league's This week leads with **the couch's teams ranked by record** (ties count half).
- A rivalry's quick game is **Winner and margin**; sides are public, margins hidden until kickoff; a rivalry found sends no push
  (only a challenge does); one push when it's decided, with no score for anyone hiding scores (PLAN-sports-ready's 217).
- A lone fan's call is **Back or Fade**, one tap; his calls keep a record; a **victory lap** is one prompt after a win.
- Solo calls show the couch your record (Privacy can turn it off), never a pick before its lock.
- **My team** per league is the first team you followed in it, changeable on the team's page.
- An against-the-spread **slate pool keeps one line for the week** (Wednesday noon ET for the NFL); a single game's question keeps
  today's rule (the line it opens with).
- Prices show as **words and points**, never American odds; DraftKings is credited in Settings › Credits only; no sportsbook links.
- A stake is **cosmetic only** (the loser's face wears the winner's colours on the couch for a week) and needs both fans' yes.

## The steps

Work in a lane of its own (docs/PARALLEL-SESSIONS.md): other sessions work on master. Each step: the design process for its
screens, a reusable check under scripts/dev-test/ on the stand-in ESPN (`fake-espn.js`, `zt-` rows), HOSTING.md before any new
call, docs/UI-REVIEW-MAP.md for any engine change, and a pause for the user after its story.

### Phase A: the hub (start here)

**A1. The scores strip** (M, 1–2 sessions). The design is round 3's ([hub-scorebug-shape.md](design-round/hub-scorebug-shape.md)):
the build session runs Impeccable's build and critique on it, then the check and the story.
- **Where:** a new `ScoresStrip` (src/new/hub/) right after `OnTvRow` in `Middle` (src/new/screens/home.tsx) and in `SoloHub`
  (src/new/hub/solo-hub.tsx). Remove `Scoreboard` from `ShowBands` (src/new/hub/bands.tsx:64; its selection logic and
  ScoreCard's ask sheet, Show the score or Watch it as if live, move into the strip). Drop the sports cards from On TV's reel
  (`useTeamsToday` and `SportsMini`, src/new/hub/guide.tsx:718 and :747) so a game appears once.
- **Which games:** your teams' games, games you play (Scoreboard's `seasonOf` and `due`), your team's rivalries; today the
  Scoreboard takes any couch team's live game, which narrows to yours. Order: live, just finished, today's by kickoff, then
  each of your teams' next game.
- **Data:** each side's record and the network on `WeekGame` (ESPN's scoreboard `competitors[].records[0].summary`,
  `broadcasts[].names`; src/lib/server/sports/espn.ts and the week's route); the line in words from `sports_events.odds`
  (`details`, `spread`); football's possession and down and distance on the live read (src/lib/sports/live.ts: the summary's
  `header.competitions[0].competitors[].possession` and the current drive's last play's `end.downDistanceText`). The recorded
  Patriots–Lions game (.ui-atlas/fixtures/espn-live/football-nfl-401873053, 266 frames) has both: build and test on it.
- **States:** live, coming up today, a later day (a bye week's next game), final, hidden (Hide sports scores), watching as if
  live, your pick (the chyron underline), a pick due (the chyron dot), one game, many games (the tile's count and the peek),
  none (no strip), the solo hub.
- **Checks:** scripts/dev-test/story-hub-sports.js grows the strip's states; check-sports-couch.js and check-new-hub follow the
  Scoreboard's move; no words over words (story-situations.js's rule).
- **Later, by sport (A1b):** baseball's inning, outs and bases; hockey's power play; soccer's minute and red cards; each its own
  situation read, as its season starts (MLB by Opening Day).

**A1's build notes (2026-11-22, lane `sports-couch`, port 3019; not merged).** Story: https://claude.ai/artifact/YBP1Xv93MfsfJSQXiY7VLq.
**Approved as built** (the user, 2026-11-22), the build's calls standing: hidden games say "Started", a final asks before showing
its score, and records in the score slot, the possession triangle and "LAC by 3" stay as the brief has them (BACKLOG 253 b,
decided; docs/design-round/decisions.md).
- **Where:** `src/new/hub/scores-strip.tsx` (the strip, the scorebug, the ask sheet moved from the Scoreboard, the tile's sheet of
  every game by league), after `OnTvRow` in `Middle` and in `SoloHub`. The Scoreboard and ScoreCard are gone from bands.tsx;
  `useTeamsToday` and `SportsMini` from guide.tsx, and On TV's reel also drops a sport season's own cards (a game you play was
  there twice).
- **Which games:** `src/lib/sports/strip.ts` (pure; tests/sports-strip.test.js): your teams' games and the games you play; live,
  then just finished, then today's by kickoff, then each team's (or season's) next only when it has nothing on the strip yet. A
  rivalry is your team's game with a couch face on the other side; the couch's other teams' games left. A hidden game that has
  begun is one bucket, "started", sorted by kickoff with the live ones, so its place gives nothing away. Finals leave after 36 hours,
  or once seen on an earlier visit (`noteSeen`/`seenBefore` in sports/scores.tsx: this phone's localStorage; watching a game live
  on the strip counts as seeing it). A team with nothing left this week (a bye) makes the strip read the week after.
- **Data:** ESPN's scoreboard now gives each side's record (`Competitor.record`), the networks and the live clock
  (`SportsEvent.networks`, `.clock`; espn.ts); `WeekGame` carries `record`, `network`, `line` (words: matchup.ts `lineWords`, "LAC by
  3", never the book) and `clock`. The line is read from the scoreboard's odds, the same source `sports_events.odds` is filled from.
  `src/lib/sports/situation.ts` reads where a game stands from its summary (score, period, clock, football's possession and down);
  `LiveGame.situation` keeps it (live.ts). Tested on eight answers of the recorded Patriots–Lions game
  (tests/fixtures/espn-situations/nfl-401873053.json; tests/sports-situation.test.js).
- **New reads** (HOSTING.md, "The hub's scores strip"): `GET /api/sports/now?league=&event=` (~200 bytes, through the live route's
  poller, edge-kept 15 s; polled every 15 s per live game only for someone shown it live) and `GET /api/sports/mine` (your games by
  ESPN id with your pick: three small reads, src/lib/server/sports/mine.ts). No migration, no engine change.
- **Decided in the build:** hidden says "Started" and its time, never the clock or FINAL, and the tile drops its live count (the
  2026-11-09 rule over the brief); a final asks first even with hiding off (the 2026-11-15 rule), its sheet saying "You haven't seen
  how it ended"; the bug is 208 × 72 with a 66 px status column (the line needed the room); the tile carries "N due" while any move
  is due, and its chevron says it opens every game.
- **The check (once):** PFD evaluate and Impeccable critique on the frames; one batch fixed: the Show/Watching chip covered the
  faces (now an icon in the score slot, the status column saying Started or Watching), no focus ring (inset rings on the tile and
  bugs), fragments at the swiped end (a spacer lets the last bug snap flush), a later day lost AM/PM, the tile had no tap cue, live
  red text under 4.5:1 (the words now foreground, the dot red), 10.5 px text (12 px floor), the slab's edge invisible on Studio
  (from the foreground now), the faces missing from the spoken label, a game with no time. Kept from the brief: records in the score
  slot, the possession triangle, the line in words (BACKLOG 253 b).
- **Checks:** `scripts/dev-test/story-hub-sports.js` shoots every state (`--only=`, `--before` for the old code on another port,
  Studio, solo, overlaps); check-sports-couch.js checks the week's new fields, the small live read, your games, and the strip on the
  hub (88 px after On TV, no Scoreboard, hidden says Started and asks, shown is live with its ball and down); check-new-hub.js checks
  no strip without teams. Both checks fail later on steps that fail on master too (BACKLOG 252). fake-espn.js events take `records`,
  `network` and `clock` (with a summary of a game on). tsc and `npm test` pass; ESLint's only errors are master's (game-page.tsx,
  lineup-sheet.tsx `Date.now` in render).

**A2. The league card in Your shows** (S–M). 72 px, among the show bands, sorted by its next game like shows by their next
episode; the league, the week, the couch's teams as marks, one muted line of what the couch has going (never what the strip
already says); off-season, one line. Until B1 lands, a tap opens today's league sheet (`openSports({ kind: "league" })`).

**A2's build notes (2026-11-22, lane `sports-couch`, port 3019; not merged).** Story: https://claude.ai/artifact/XixM9yKB4CeHeANg5zcZg9.
**Approved as built** (the user, 2026-11-22), the build's calls standing (docs/design-round/decisions.md).
The check: [design-round/hub-league-card-check.md](design-round/hub-league-card-check.md).
- **Where:** `src/new/hub/league-cards.tsx` (`useLeagueCards`, `LeagueCard`). In `ShowBands` (bands.tsx) the cards sort among the
  show bands by next game against next episode (a stable sort: shows first on a tie, an off-season card last); the rows wait for
  the cards' reads so nothing jumps. The solo hub's Your shows is a poster shelf that swipes, so its cards sit above it
  (sections.tsx `YourShows`), and a sports season a card holds leaves the posters, as it left the bands.
- **Which leagues:** each league with a team you follow (the couch's teams read, or your own follows solo), and each league a game
  of yours is in. The marks are the couch's teams there (yours first, ringed; four, then "+N"; `TeamMark` size `xs`, 26 px, its
  edge from the foreground).
- **The line, the first that holds:** your games there (one: its name and your place, else how many play; several: how many and
  your best); the couch's games you're not in; who leads the couch's teams by record (never for anyone hiding scores, and never
  while one of their games from the last 36 hours is unseen or on: a record carries the latest result); who follows them (two or
  more); "No games on the couch yet" (solo: "No games yet"). The due dot is any move of yours due in a game there.
- **Its place:** the next start of a game of the couch's teams or a game you play there (else the league's next), by the clock
  alone (a game counts until 3.5 hours after its start), never a game's state, so it gives nothing away to someone hiding scores.
- **The week:** `GET /api/sports/league/now?league=` (src/lib/sports/league-now.ts `nowOf`, pure, tests/sports-league-now.test.js;
  the server's `leagueNow` reads the league's calendar slate.ts already caches a day): football's own week ("Week 12", "Wild Card"),
  a daily sport's Monday-to-Sunday week, "Playoffs" for a daily sport's playoffs, nothing for a soccer league (its season instead);
  off-season with the day it's back when ESPN lists the next season. `/api/sports/mine` also returns `seasons` (each sport season of
  your games and your couches', with its league). HOSTING.md: "The league card in Your shows". No migration, no engine change.
- **The tap:** today's league sheet (`openSports({ kind: "league" })`), which now leads with **Your games** in that league (the due
  move in its own words, opening the move); while a move is due, Play this week's games steps down to an outline (the One Chyron
  Rule). B1's This week replaces this.
- **The check (once):** PFD evaluate (71: the due dot's scent and the line's words) and Impeccable critique (dual-agent: 20/32;
  the reflow, the chevron, touching rings, a navy mark at 1.02:1, a long league name overflowing); one batch fixed (see the check
  doc). Kept from the brief: the week as quiet caps, the off-season line's words, A1's focus ring.
- **Checks:** check-sports-couch.js (the league-now reads, `mine`'s seasons, the card on the hub at 72 px among the bands with its
  week and your ringed mark, no score or red, the off-season line at 48 px, the tap opening the sheet with your games first);
  its world gains a stand-in baseball league in its off-season and calendars around now (`calendarsAround`, `MB`). Its A1 step
  "scores hidden… no score" no longer mistakes a kickoff time ("10:01 AM") for the score. story-hub-sports.js shoots
  `<world>-cards` and each card at twice the size for every world, `many-league` (the tap), a new `one` world (one league, the
  record line), and the solo world on solo-fixture.js's zt_so_alex (BACKLOG 254 f). tsc and `npm test` pass (2,573); ESLint's
  errors are master's (game-page.tsx, lineup-sheet.tsx, use-sheet-swipe.ts, format-timeline.js). The check still stops at
  BACKLOG 252's Start a game step, as on master.
- **Leftovers:** BACKLOG 254.

**A3. Follow a league** (S, a migration). A league follow (a `league_follows` table, or a league-wide row beside `team_follows`:
decide in the step) from search's league card and the league's page; "my team" per league.

**A3's build notes (2026-11-22, lane `sports-couch`, port 3019; not merged).** **Approved as built** (the user, 2026-11-22), Following's quiet look kept everywhere (BACKLOG 254 i). Story:
https://claude.ai/artifact/FJGQbCjxmyTgSqkEKWmtd3. The design: [league-follow-spec.md](design-round/league-follow-spec.md) (Intent), `-first-view.md` (PFD), `-shape.md`
(Impeccable), `-check.md` (the check and its one batch).
- **Decided in the step: a `league_follows` table** (migration 0313, hand-written, additive; **run only on the lane's local
  database**), not a league-wide row in `team_follows`: that table's key and its name, short and colour are a team's, and every
  reader of it (the couch's teams, the strip, the guide, the cards) takes its rows as teams. **Your team** is `team_follows.my_team`
  (a partial unique index: one a league). The migration carries every league someone follows a team in over as a league follow
  and makes each person's first team there theirs, so no card moves.
- **The rules** (team-follows.ts): following a team follows its league and, if none is, makes it your team there; unfollowing your
  team passes it to the next you followed there; a league follows alone (a team sport's that its provider lists: `listedLeague`,
  find.ts; else 404); unfollowing a league takes its card off and leaves its teams followed; a game you play keeps its league's
  card either way. `GET /api/sports/follow` answers `{ teams (each with myTeam), leagues }`; POST `{ league, follow }` a league,
  `{ league, team, follow }` a team, `{ league, team, myTeam: true }` your team (409 unless followed). `/api/sports/couch` adds
  `leagues` (who on the couch follows each) and each follower's `myTeam`. No new external read (HOSTING.md unchanged).
- **The screens:** `FollowToggle`, `FollowFaces` and `useLeagueFollow` (src/new/sports/follow.tsx, one toggle everywhere); search's
  league row with Follow in the chevron's slot (search.tsx `LeagueRow`); the league sheet's follow row first, its line naming why
  it's on your shows (sheets.tsx `LeagueFollowRow`); the team sheet's "Your NFL team" and "Make the Lions your team" only with two
  or more teams followed in the league (team.tsx); the league cards from your league follows and your games (league-cards.tsx),
  your team first among yours, "Followed by" counting the league's own followers.
- **The check (once):** PFD 73 (L3 58: the sheet's line cut at its cause; "them" ambiguous); Impeccable dual-agent 26/36, 19
  advisory font-size findings (3 carried over into this change). One batch: the line wraps to two lines; "Make the Lions your
  team" with a focus ring; Following a quiet fill with a check, one width either way (the team sheet's too); one voice for the
  toasts. Kept: no chevron on the search row (PFD's R1), "Follow" for a league, 14 px on the toggle.
- **Checks:** check-sports-couch.js `leagueFollowChecks` (API: 11) and `leagueFollowBrowser` (390: 12), all passing; the run
  still stops at BACKLOG 252's Start a game step, as on master. Its guide step waits for the guide's button, not a quiet network
  (BACKLOG 254 g). story-hub-sports.js's `follow` world (and `--before`). tsc clean, `npm test` 2,573 pass, ESLint clean on the
  changed files.
- **Noticed and fixed:** on no couch, the team sheet never showed Following (it read followers from the couch only).
- **Leftovers:** BACKLOG 254 (g)–(i).

### Phase B: the league's page and finding sports (round 1, with round 2's This week)

**B1. The league's page** (L, a session a tab): **This week** (the strip's due move, the rivalry, the couch's teams by record,
rivalries this season, your games, the room, the rest of the league), **Scores** (a week or day switcher, the shared game row),
**Games** (with the couch, rivals, on your own), **Standings** (ESPN's standings: a new read), **Chat** (the league's room and a
thread per game: chat is per season today). Records for the table come from the scoreboard's records or the standings read.

**B1's build notes, session 1: the page and This week (2026-11-22, lane `sports-couch`, port 3019; not merged; no migration).**
Story: https://claude.ai/artifact/Nksn54s8dmHHRPYMxuJJ9c. **Approved as built** (the user, 2026-11-22, taking the four recommendations: decisions.md). The design:
[league-page-spec.md](design-round/league-page-spec.md) (Intent), `-first-view.md` (PFD), `-shape.md` (Impeccable), `-check.md`.
- **Where:** `/league/<sport>/<code>/<tab>` (routes.ts `paths.league`, `LEAGUE_TABS`, depth 1, up to the hub, tabs sideways;
  src/app/(new)/(in)/league/); `src/new/screens/league-page.tsx` (`LeagueFrame`: the bar without art, Home, the name, its week and
  season or Off-season, A3's Follow; the tab bar; `LeagueTabScreen`). The league card, search's league row and Add's league pick open
  it; the sheet's `league` kind and `LeagueView` are gone (A3's follow line with them: the bar keeps the toggle). sheets.tsx keeps
  the parts: `useLeagueGames`, `LeagueGameRows`, `useLeagueWeek`, `LeagueStart`, `LeagueDays`.
- **Tabs now:** This week, Scores (the week by day, the sheet's list), Games (your games, Play this week's games, Play the season).
  Standings and Chat join when built (the user's call 1 in the story).
- **This week:** your due move (the show strip's plate, the one yellow); this week's rivalry (two couch members' teams meeting, fans
  differing: on now, else next, else just played; opens the game; Start a game on it before kickoff); the couch's teams (solo: yours)
  ranked by record, a tie counting half, each row its fans' faces, last five, and this week's game ("Rivalry, above" for the
  rivalry's two, Bye, Off-season); rivalries this season (each fan's record, next two and last two, All N); your games here (the
  move muted) and Play this week's games outlined; the rest of the week, one row into Scores. Hide sports scores: no number, the
  table yours first then by fans, one Show records (every result on the page through `showScore`).
- **Data:** league-now answers its week's `from` and `to` (a daily sport's plain Monday to Sunday; tests/sports-league-now.test.js);
  `GET /api/sports/league/teams?league=&teams=` (league-teams.ts; at most 16 teams; edge ten minutes): each team's record, last five
  and meetings among them from the schedules a team's sheet reads; `src/lib/sports/couch-table.ts` ranks them and finds the
  rivalries (pure; tests/sports-couch-table.test.js). HOSTING.md: "A league's page, This week".
- **Checks:** `scripts/dev-test/story-league-page.js` (worlds: gameday, midweek, hidden, lone, none, solo, daily, off, studio; a
  season of finals behind Week 12 on the stand-in); check-sports-couch.js `leaguePageChecks` (API) and the card → page → Scores →
  bar Follow steps (browser), all passing; the run still stops at BACKLOG 252's Start a game step, as on master. tsc clean, `npm
  test` 2,580 pass, ESLint clean on the changed files.
- **Open:** the check doc's three (the move's "· 1 question" break, off-season's empty Play heading, xs marks cutting 4-letter codes).
- **Next sessions:** Scores (a week or day switcher, the shared game row), Games, Standings (a new read), Chat (a league room).

**B1's build notes, session 2: Scores (2026-11-22, lane `sports-couch`, port 3019; not merged; no migration).** Story: https://claude.ai/artifact/SChZpFJzYWthMNrxmr5Whm. **Approved as built** (the user, 2026-11-22, taking the three
recommendations: decisions.md). The design: [league-scores-spec.md](design-round/league-scores-spec.md) (Intent), `-first-view.md` (PFD), `-shape.md`
(Impeccable), `-check.md` (the check and its one batch). BACKLOG 254 (j) fixed first.
- **Where:** `src/new/screens/league-scores.tsx` (`LeagueScores`: the switcher, then the list); the shared game row is A1's scorebug,
  moved to `src/new/sports/scorebug.tsx` (`Scorebug`, `AskSheet`, `bugStateOf`) and drawn by the hub's strip and Scores alike: full
  width (`wide`) it names the teams, its status column 78 px; `grouped` (under a day heading) says only the time; `finalsOpen` shows
  a final's score unless hidden (B1's decision 2); `pollOnScreen` asks a live row's clock only while it's on screen. LeagueFrame
  measures its bar into `--league-bar` so the switcher sticks under it.
- **The switcher:** football's every week and playoff week (chips: "Week 12" over its dates, now's "This week"), a daily sport's (and
  soccer's) game days (chips: weekday over date, "Today"); opens on now with the chip before it showing; the chosen chip's rule in
  the foreground (one yellow a view); away from now, "This week ›" (or "Today ›") pinned at its end. A daily sport's chips are its
  game days, not the spec's Monday-to-Sunday seven with arrows (38 px chips): the user's call in the story.
- **The list:** the couch's games first (solo: your teams'; a game you play too), each saying its day when it isn't under one; then
  every other game a day at a time; kickoff order everywhere. Hiding: Started and the eye per row (A1's ask), and one Show scores
  for the chosen week that asks first (Show all N or Keep hiding). Empty, failed, off-season and loading states.
- **Data:** league-now answers `weeks` (football) and `days` (a daily sport's game days) (tests/sports-league-now.test.js); the week
  read takes `only=1` (that league alone) and `to` (up to 14 days), and This week moved to it; a week with a game on is edge-kept a
  minute. HOSTING.md: "A league's page, Scores". No migration, no engine change.
- **Found and fixed in the build:** a live game's score could leak to someone hiding scores (the profile read's moment; the
  scorebug no longer marks a game seen before the setting is known: `useHideSportsKnown`, scores.tsx; the hub's strip too).
- **Checks:** story-league-page.js shoots Scores in every world (`--only=scores`; a fuller Sunday of stand-in teams; a daily
  calendar of every day); check-sports-couch.js's leaguePageChecks (league-now's weeks and days, the one-league week read) and the
  browser's Scores steps (opens on now, the live bug at full width with its score, the week before's final, This week back).
  tsc clean; `npm test` 2,580 of 2,581 (the one, gameplay-matrix's gates test, a timing flake under load: passes alone); ESLint
  clean on the changed files.
- **Leftovers:** BACKLOG 254 (k)–(n).

**B1's build notes, session 3: Games (2026-11-22, lane `sports-couch`, port 3019; not merged; no migration).** Story: https://claude.ai/artifact/4ncmkRanywVoPbH6N7pTjh. **Approved as built** (the user, 2026-11-22, taking both
recommendations: decisions.md). The design: [league-games-spec.md](design-round/league-games-spec.md) (Intent), `-first-view.md` (PFD), `-shape.md`
(Impeccable), `-check.md` (the check and its one batch).
- **Where:** `src/new/screens/league-games.tsx` (`LeagueGames`), round 2's groups: **Your games here** (the show launcher's
  `LaunchRow`, due first, the move in chyron line, else "All set"; faces from the couch's games read), **With the couch** (its games
  here to join with the show's Join button and sheet, four and a fold; then Play this week's games, the plate while nothing of
  yours is due, and Play the season, as quiet rows otherwise: `LeagueStart rows`), **Rivals** (the couch's rivalry games still to
  come, yours first, "You vs Riley · Sun 1:00 PM", a quiet Start on that one game; a pair's every meeting a line under it:
  `StartWhen` meetings), **Your team** (each team you follow here, your team first: "Every Eagles game", Start a game on its season).
  "Your team", not round 2's "On your own": every start is on the couch (the user's call, 2026-11-22).
- **Solo:** a sports start needs a couch today, so `LeagueStart` draws nothing without one (This week's dead-end start went too)
  and Games says so, with Start a couch · Join one. Solo sports play waits for C4 (the user, 2026-11-22: nothing interim that C4 would make obsolete).
- **Data:** no new read: home, the couch's games read, `/api/sports/mine`'s seasons (which couch games are this league's), the
  couch's table read for meetings. No migration, no engine change; HOSTING.md unchanged.
- **Checks:** story-league-page.js `--only=games` (Riley's Pick'em to join in the gameday world; every world's Games; solo's This
  week); check-sports-couch.js's browser Games steps (the couch's starts, your team's season handing off, no results), passing.
  Fixed in that check: A1's "scores hidden" step read a kickoff's minutes ("Started 2:10 PM") as the score 10, failing only at
  some times of day; the app was right. tsc clean; ESLint clean on the changed files.
- **Leftovers:** BACKLOG 254 (o)–(p).

**B1's build notes, session 4: Standings, with BACKLOG 254 (k) (2026-11-22, lane `sports-couch`, port 3019; not merged; no
migration; one new ESPN read).** Story: https://claude.ai/artifact/9ydPz541VZbpKE5u8sZXvY. **The four recommendations taken** on the user's "Continue" (decisions.md; open to change): the faces under the name, no playoff line of our own, basketball on Conference, Night's chosen view outlined. The design:
[league-standings-spec.md](design-round/league-standings-spec.md) (Intent), `-first-view.md` (PFD), `-shape.md` (Impeccable),
`-check.md` (the check and its one batch).
- **254 (k) first:** `useHideSports` (sports/scores.tsx) reads as on until the profile answers, so every sports screen holds a result
  by itself (the hub's strip, the team sheet, a league's page); check-sports-couch.js holds the profile back eight seconds and finds
  no score on the strip and no record on a league's table meanwhile.
- **Where:** `src/new/screens/league-standings.tsx` (`LeagueStandings`), the fourth tab (`LEAGUE_TABS`, routes.ts; This week ·
  Scores · Games · Standings). `src/lib/sports/standings.ts` (pure; tests/sports-standings.test.js on trimmed real answers in
  tests/fixtures/espn-standings/): the shape, each sport's columns (its vocabulary: the numbers are ESPN's), a group in the
  league's own order (by seed: ESPN lists a division unordered; soccer by rank), the two views and their words (Division ·
  Conference, MLB's League; basketball opens on Conference), games behind by conference counted from its leader, the couch's
  groups first (yours, then by fans; nothing inside a group moves), soccer's places key.
- **The tab:** the switch (two-level leagues only; the chosen one inverted; kept per league for the visit), then each group: its
  name, column heads ("Div", "Seed" or "#", then the sport's), one-line rows (place, mark, name, up to two faces, the numbers, a
  chevron) with what qualifies a team on a line under its name (by conference "1st East" for each division leader; In or Out where
  ESPN marks a clinch; a soccer place's name on its first row). Your team's row raised. A row opens its splits in place (home,
  road, division, conference, last ten, points for and against, streak: whichever the sport has) and "Open the Eagles ›" (the
  team's sheet). Switching to Conference brings your row into view. Out of season: "Final standings · 2026". Under the table:
  soccer's key, "From ESPN · as of 4:15 PM".
- **Held as one:** the whole tab is results, so Hide sports scores (or a game in the league watched as if live, named) shows only
  the first group's name and one outlined Show the standings (Show anyway), a key of its own in showScore's set that moves no
  season's mark; before the setting is known, the skeleton.
- **Data:** `GET /api/sports/league/standings?league=` (route; league-standings.ts joins the teams' colours from the league's team
  list); the provider's `standings(league)` (types.ts; espn.ts `readStandings` on `apis/v2/sports/<league>/standings?level=3`),
  cached 15 minutes (an hour past 100 teams: cache.ts). HOSTING.md: "A league's page, Standings". No migration, no engine change.
- **Checks:** story-league-page.js `--only=standings` (the stand-in's worlds; its table counted from its own finals: fake-espn.js
  `standings`) and the real tables (`--only=real`: the couch following real teams for the shoot, unfollowed after);
  check-sports-couch.js's standings read (API) and the tab on screen (your row and record, a row's splits, the team's sheet, the
  whole table held while hiding). tsc clean; `npm test` 2,588 pass; ESLint clean on the changed files.
- **Left open:** the longest names still cut ("Comman…"); a soccer place's words under a long name; the team sheet's "A team"
  title (B2).

**B1's build notes, session 5: Chat (2026-11-22, lane `sports-couch`, port 3019; not merged; **migration 0314, run only on the
lane's local database**; no new external read).** Story: https://claude.ai/artifact/9mPL5VhwWxUYVyfXzEs8yi. **Approved as built** (the user, 2026-11-22, taking the three recommendations: decisions.md). The design:
[league-chat-spec.md](design-round/league-chat-spec.md) (Intent), `-first-view.md` (PFD), `-shape.md` (Impeccable), `-check.md`.
- **The room:** one per couch per league, a message about one real game carrying it (its thread). Migration 0314 (additive):
  `chat_messages.sports_league` (with `couch_id`; season and league_id null), `sports_event`, `sports_event_at`,
  `sports_event_name`; the place check admits a room; `league_chat_reads` for the badge. `src/lib/server/league-chat.ts` (scope,
  read with a `v` fingerprint, earlier, post, read mark, unread); reactions, edits and deletes are chat.ts's. Routes under
  `/api/sports/league/chat` (`?league=&couch=`; `[messageId]`, `/react`, `/read`, `/unread`). A push to the couch's members who
  follow the league (`notifyLeagueChat`, push-events.ts), a thread's words held back from anyone hiding scores or watching that
  game as if live. The couch hub's feed leaves room rows out (no season to fold by). HOSTING.md: "A league's page, Chat".
- **The tab:** `src/new/screens/league-chat.tsx`, the fifth (`LEAGUE_TABS`), its unread count on the tab. The show Chat's message,
  composer and sheet reused (show/chat.tsx exports them; `Line` takes a `tag`, `Composer` an `above`). The threads row (All and up
  to three games, live first, "+N"; the chosen in ink; a hidden game "· Started"); a run's game where the talk turns to it; for a
  hider, the thread's talk since kickoff one compact fold per game with Show the score (showScore); the About chip over the
  composer while a couch game is on (×, "+ About" back), the placeholder naming where it goes; a short stream by the composer;
  solo: "Chat is for a couch" with Start a couch · Join one. A hidden game is "on" by the clock alone (the check's leak).
- **Checks:** story-league-page.js `--only=chat` (seeded through the real routes); check-sports-couch.js `roomChecks` (API) and
  the browser's Chat steps (the room, the thread's chip and About; hidden: the fold, Show the score). tsc clean; `npm test` 2,588
  pass; ESLint clean on the changed files.
- **Leftovers:** BACKLOG 254 (q)–(s): a game row's chat count and This week's room line after the merge; two places to talk about
  one game, decided to stay apart until a real Sunday's been watched.

**B2. A team's page** (M): a full page instead of today's sheet (src/new/sports/team.tsx): the live or next game, Up next with
Play, the schedule by month with results and the bye, Month view for daily sports with series, homestands and trips grouped,
and (C2) the fan card.

**B2's build notes (2026-11-22, lane `sports-couch`, port 3019; not merged; no migration, no new external read, no engine change).**
Story: https://claude.ai/artifact/GxZgu7KEX38h59Y2Kyq46g. **Waiting on the user's review.** The design:
[team-page-spec.md](design-round/team-page-spec.md) (Intent), `-first-view.md` (PFD), `-shape.md` (Impeccable), `-check.md` (the
check and its one batch). With BACKLOG 254 (m)'s team half.
- **Where:** `/league/<sport>/<code>/team/<id>` (routes.ts `paths.team`, depth 2, up to the league's This week; `?against=` opens
  the schedule on their meetings); `src/new/screens/team-page.tsx` (`TeamPageScreen`). The sheet is gone: `openSports({ kind:
  "team" })` now pushes the page (sheets.tsx), so every old door (This week's rows, Standings' Open, the guide, cast and roster team
  doors, scorebugs' teams) opens it; Add's team pick and a matchup close Add and push it. team.tsx keeps `StartWhen`, `asRow`,
  `versus` and the game's sheet (`GameView`, B4's); its "Back to the team" went (the page is under it).
- **The page:** a bar (Back: where you came from, else up; Follow); the lower third with the league, record and place ("1st in ZTN
  East", the standings read's; only once a final this season is in); the couch's faces and A3's line (yours alone draws no
  sentence); the game on now or next as the shared scorebug (wide, grouped: its day in the caption over it) and Play the next game
  ("Pick'em vs Giants · Nov 29 4:25 PM · tells the couch"); the season as a bar a game by margin (wins up in good teal, losses down,
  a bye named, games to come as ticks, the playoffs' start dashed, a live dot; `src/lib/sports/team-season.ts`, pure,
  tests/sports-team-season.test.js), held behind Show the season (`season:<league>/<team>`, moving no mark) while hiding; Start a
  game on (2.8's rows, one series and only within two weeks); the schedule: Against chips (All, the couch's teams, All opponents),
  months with Earlier folded and counted, the bye a row, each row the scorebug's one-side form (date, opponent, the bug's status
  column), a series joined, a daily sport's homestands and road trips with Start a game on it, List · Month (a calendar, home
  filled, away outlined). A season not begun says so in one line; no games, one line. ESPN's unset times say TBD.
- **Checks:** `scripts/dev-test/story-team-page.js` (worlds gameday, midweek, hidden, daily, off, studio, solo, failed, and real
  ESPN: the Eagles, the Knicks, the Yankees; `--before` shot the old sheet); the stand-in world now shared with the league story
  (`league-story-world.js`). check-sports-couch.js moved to the page (Standings' Open → the page → Back; search's team → the page,
  hidden: the bug Started, the season held, no result in the schedule, one yellow; Show the score; Show the season; Start a game on's
  The next game → the gallery, which also replaces BACKLOG 252's dead `[data-more="start"]` step). Fixed there too: five regexes
  whose `\b` had become backspace characters (they tested nothing). The older stories that opened the sheet point at the page
  (story-sports-scope.js, story-start-wizard.js, story-hub-sports.js, check-drill-doors.js): not re-run.
- **The rows, decided** (the user, 2026-11-22, decisions.md): the one-team form, with the couch on it: a rival's row names whose
  team it is (a face and the name: many have no photo), a game you play carries the bug's controller (its dot while a pick is due),
  and the room's talk is a count under the row into its thread. The story's gameday world seeds a Pick'em and the thread's talk.
- **Open for the user:** the strip's bars read, not tapped; a 162-game strip's density. **Noticed, not fixed:** the game's sheet still says "A GAME" and "It's over." (B4); the scorebug's records use
  hyphens and "8:20PM" (A1's, every surface at once if changed).

**B3. Search** (M): "Add a show or team" with All, Shows, Sports; a team's, a matchup's and a league's card first for a strong
sports match (src/new/sports/search.tsx, src/new/watching/sheets.tsx); event sports in results (dropped today); first run uses
the same search (BACKLOG 43).

**B3's build notes (2026-11-22, lane `sports-couch`, port 3019; not committed; no migration, no new external read, no engine change).**
Story: https://claude.ai/artifact/1ocBH869YU9C7LfigoRE7s. **Approved as built** (the user's "Continue", 2026-11-22: decisions.md; tours listed only). The design: [search-spec.md](design-round/search-spec.md)
(Intent), `-first-view.md` (PFD), `-shape.md` (Impeccable), `-check.md` (the check and its one batch; `-check-findings.md`, the
checking agent's full findings).
- **Where:** Add's sheet (watching/sheets.tsx `AddShowSheet`, "Add a show or team"; the hub's row and poster say so; the guide keeps
  "Add a show" and opens on Shows: `openWatching({ kind: "add", scope })`) and first run's search (welcome/first-run.tsx). One
  set of parts in src/new/sports/search.tsx (`SportsCard`, `SportsRows`, `LeagueTiles`, `CouchFollows`, `useRankedSports`) and
  watching/search.tsx (`ShowGroups`, `ScopeSwitch`); the ranking is pure, src/lib/sports/search-rank.ts (tests/sports-search-rank.test.js).
- **The rules:** a show here leads its words; else one card for a clear sports meaning (a matchup; among the top-scored teams the
  couch's, else the one pro team in season, else the one pro team; else a league named exactly), then shows (TV listings as their own
  group, three under a card, five above sports rows), then teams (the couch's, in season, pro, college past two folded), leagues,
  tours (golf, F1, the UFC: listed, no action, "Their own pages and games come later" once), Add by name (only once sports answered).
  A sport's own word with no team ("golf") puts its tours first. teams.ts `teamScore`: one or many of a short name is the name ("bear").
- **The card:** a team's short name over its city and league, the couch line (others only), Follow (`useTeamFollow`, lifted from the
  team page into sports/follow.tsx), its game on now or next as `GameBug` (B4's; now with `onOpened`, closing Add as the game's sheet
  opens); a matchup's next meeting as the bug (into B4's sheet); a league's week and Follow. `Sheet tall` holds the search's height;
  the field and scopes stick. Sports search retries once, then "Teams didn't load · Try again"; "Looking for teams…" meanwhile.
- **First run (BACKLOG 43):** the same card and rows with Pick (a matchup picks both); picks kept on the device (way-in.ts
  `FirstRunPicks.teams`), a wall tile in the team's colour, step 2 skipped with no shows, followed at the save (POST /api/me/first-run
  `teams`, server way-in.ts through `setTeamFollow`/`setLeagueFollow`).
- **Checks:** `scripts/dev-test/story-search.js` (23 situations; real ESPN and the stand-in couch; `--before` shot the old sheet).
  check-sports-couch.js updated (a league named exactly is a card; the guide's Add switches to All): 128 pass, no failures (stops at
  BACKLOG 252). `npm test` 2,611 pass; tsc and ESLint clean.
- **Noticed, not fixed:** the league week words are LeagueNow's,
  shared (the NBA's "Week 5"); Studio's sheet scrim is faint for every sheet; SuggestionCard's poster-less name overlaps its title;
  first run's picked-team mark sits on its own colour.

**B4. A game's sheet with Play** (M): every game row opens one sheet; before kickoff its job is Play (Pick'em chosen, the other
types beside it, bigger sizes a row down, "already on the couch" first so nobody starts a duplicate).

**B4's build notes (2026-11-22, lane `sports-couch`, port 3019; not committed; no migration; one small new read of ours, no ESPN).**
Story: https://claude.ai/artifact/BqzTDp21SuBUZ7raWkf7Qx. **Approved as built** (the user, 2026-11-22: decisions.md). The design: [game-sheet-spec.md](design-round/game-sheet-spec.md) (Intent),
`-first-view.md` (PFD), `-shape.md` (Impeccable), `-check.md` (the check and its one batch).
- **Where:** the game's sheet every game row opens (`openSports({ kind: "game" })`, sheets.tsx): titled by the matchup ("Cowboys at
  Giants"), `GameView` in src/new/sports/team.tsx. The team page's scorebug moved to `src/new/sports/game-bug.tsx` (`GameBug`) so
  both draw one.
- **Before kickoff:** the day; the shared scorebug; the couch line in names ("Your Eagles at Riley's Jets"); **On the couch**: the
  couch's games that cover this game (Riley's Pick'em, who's in; a longer game says "this game counts in it"), with **Join** as the
  one yellow under its row when it's the chosen kind (PFD's R5: the duplicate is never the default); **Play** (or "Or start your
  own"): the sport's one-game types as tiles (Pick'em, Pick a few, A draft, Squares; a radio group; chosen, an ink outline and a
  check), and one decision: Start the chosen type ("Picks lock at kickoff, Sun 4:25 PM · You have 10 seconds to undo, then the
  couch is told"), or Start another under Join; Pick'em says "Pick a side" in a rivalry; **Go bigger**: their series, every game
  left of the team's season, this week's games; **More options** (Start a game's screens). Solo: "Start a couch" is the yellow.
- **After kickoff:** the score through hiding (the bug's ask), the couch line, the couch's games on it (Open), the thread link
  ("3 messages in its thread", or "Talk about it"), "Picks closed at kickoff." only when a couch game covers it.
- **Data:** `GET /api/sports/game/seasons?league=&event=` (season_events: the seasons a real game is in and its episode in each; the
  same for everyone, edge-kept a minute); the sheet matches the couch's games read to it. HOSTING.md: "A game's sheet".
- **Checks:** `scripts/dev-test/story-game-sheet.js` (pre, pre-none, types, bigger, rivalry, live, live-hidden, final, daily, solo,
  studio, real-nfl; `--before` shot the old sheet). check-sports-couch.js: 128 pass, no failures (the same stale gallery step as
  B2, BACKLOG 252). `npm test` 2,599 pass; tsc and ESLint clean on the app files.
- **Open for the user:** the day alone under the title (the time stays in the bug); the line in ESPN's short form ("NYG by 3"),
  the scorebug's since A1. **Noticed, not fixed:** a couch game row repeats its maker on its second line; "is the couch's game
  the same kind" matches by the game's name (Pick'em, Squares): a game named otherwise isn't matched.

### Phase C: playing as a couch (round 2)

- **C1. Rivalries** (L): found from follows and the schedule; the rivalry card; the challenge (Winner and margin, an invite to one
  person); sides as public picks; margins hidden until kickoff; the result; the couch's rivalry record across seasons.
**C1's build notes (2026-11-22, lane `sports-couch`, port 3019; not committed; no migration, no new ESPN read; one engine change).**
Story: https://claude.ai/artifact/7nq5aqBuq4o2Eh5YnsfAt7. **Approved as built** (the user, 2026-11-22, taking the three recommendations:
decisions.md). The design:
[rivalry-spec.md](design-round/rivalry-spec.md) (Intent), `-first-view.md` (PFD), `-shape.md` (Impeccable), `-check.md` (the check
and its one batch).
- **The model:** one game a meeting, "<fan> vs <fan>", Winner and margin with its winner shown as it's picked
  (`src/lib/sports/rivalry.ts` RIVALRY_SPEC; pure, tests/sports-rivalry.test.js), started by the first tap on the card (a fan's call
  or anyone's side) on the team's season, that game only (start.ts takes `game: "rivalry"`, never on the rail), with no "started"
  push. A game is a rivalry's by its spec, so nothing new is stored. The two fans make calls; anyone else picks a side, a margin
  optional (once a side is picked the rest is never a move: answers.ts `summaryOf`). The duel: a point for the winner, a point for
  the closest margin among everyone who called one; the fan with more wins, level is a tie.
- **The engine change:** a question's `shown: 'picked'` (schema.js: only on a side): its answers leave the server as they're given
  (answers.ts: `people` before the lock, nothing settled; `QuestionView.shown`). Reviewed per UI-REVIEW-MAP's "who sees others'
  moves": the game page lists the sides before the lock and says so in its count line; a side answer now says its team's name
  (questions.tsx `answerWords`: it said the team's id, on every one-game Pick'em after the lock too); the person sheet keeps answers
  until the lock (BACKLOG 255 b).
- **Where:** `src/new/sports/rivalry.tsx` (`RivalryCard`, `CallSheet`), on This week (league-page.tsx): a card for each of this
  week's rivalries, two at most, on now then next then the last played (a final no longer vanishes behind the next rivalry); one
  yellow a page (the move strip's, else the first card you're a fan in). The challenge push (`notifyRivalryCall`, push-events.ts,
  the invite kind) opens `/league/<sport>/<code>/week?call=<event>` with Your call open. The pair's record on the card
  (couch-table.ts `pairRecord`), this season; follow dates now ride on the couch's teams read (`Follower.since`) for the record
  across seasons (BACKLOG 255 c).
- **Data:** `GET/POST /api/sports/rivalry?couch=` (src/lib/server/sports/rivalry.ts: the couch's rivalry games and every pick,
  margins only once begun or your own; a pick joins you and answers, under an advisory lock a couch and game). HOSTING.md,
  "Rivalries".
- **Checks:** `scripts/dev-test/story-rivalry.js` (16 frames and 13 checks on the stand-in: the call starts the game, one push to the
  rival, his margin hidden from the other fan, sides public, a pick after kickoff refused, hiding holds the result; `--before` shot
  the old card). `npm test` 2,619 pass; tsc clean; ESLint clean on the changed files. check-sports-couch.js not re-run (its This week
  steps read the card's `data-rivalry`, unchanged).
- **Decided** (the user): anyone may add a margin; the record across seasons from September 2027 (BACKLOG 255 c); the decided push
  is BACKLOG 217's. **Noticed, not fixed:** BACKLOG 255 (a) a one-game matchup listed home first on the game page.

- **C2. The lone fan** (M): a fan's call with Back and Fade (Pick'em on one game, framed); his calls record; the fan card and his
  games on the team's page; watching marks for sports.
**C2's build notes (2026-11-22, lane `sports-couch`, port 3019; migration 0451; no new ESPN read; no engine change).**
Story: https://claude.ai/artifact/QXySaFvezheqFjLXPKY6zS. **Approved as built** (the user, 2026-11-23, taking the recommendations:
decisions.md): a call stands once backed; Play the next game keeps its yellow after a call. The design: [lone-fan-spec.md](design-round/lone-fan-spec.md)
(Intent), `-first-view.md` (PFD), `-shape.md` (Impeccable), `-check.md` (the check and its one batch).
- **The model:** a fan's call is one game a game of a couch team's that isn't a rivalry, Pick'em on that one game with its picks public
  (`src/lib/sports/fan-call.ts` CALL_SPEC: C1's `shown: 'picked'`, no margin; pure, tests/sports-fan-call.test.js), started by a fan's
  call (a follower on the couch of either team: start.ts `game: "call"`), with no push. Anyone else backs (the call's side) or fades (the
  other); a call stands once anyone has. A game is a call's or a rivalry's by its spec (`pickedKindOf`: a margin makes it a rivalry), so
  nothing new is stored for it. **The calls record:** every pick of a fan's on their team's game, in a call or a rivalry, right or wrong
  once final; the couch on a fan's calls (backing and fading him, right or wrong).
- **Where:** `src/new/sports/fan-call.tsx`. This week's calls (`CallsCard`, under the rivalries, league-page.tsx): a row a couch team's
  game with a call, or yours to make; yours to act on first, three, then folded; the couch's table says "Jordan's call, above". The
  team's page (team-page.tsx): the fan card under the head (whose team, since when, the record big, a tick a game, the couch on his
  calls); the next game's call row under the scorebug (`CallRow bare`), Play the next game outlined while your own call is the yellow;
  "Games on the <team>": the couch's games on its next game, by their maker, with Join or Open. The game sheet (team.tsx `GameView`):
  I'm watching from the hour before until it's over, who's watching beside it (`WatchingRow`); watchers' faces on This week's row.
- **Data:** `GET/POST /api/sports/calls?couch=&league=&teams=` (src/lib/server/sports/calls.ts: the couch's call and rivalry games this
  season with their winner picks, and finals from the asked teams' cached schedules; a pick joins and answers under an advisory lock);
  `GET/POST /api/sports/watching?couch=&league=` (src/lib/server/sports/watching.ts; migration 0451 `sports_watching`: shown only on that
  couch and only for someone sharing When I'm watching). HOSTING.md, "A fan's call" and "I'm watching".
- **Also fixed (C1's too):** joining a game of public picks (a rivalry's side, a back or fade) sent its members "New league member":
  join-league.ts no longer announces a joiner there. The couch's games list carries `picked` (couch-joins.ts), so the game sheet names a
  call or rivalry game once and sends its action to the card ("Back or fade", "Pick a side").
- **Checks:** `scripts/dev-test/story-lone-fan.js` (16 frames and 15 checks on the stand-in, with a season of made-up calls: the call
  starts the game with no push, a back before a call refused, the call stands once backed, a back after kickoff refused, the record,
  two watching and one hidden once she stops sharing, hiding holds the result; `--before` shot today's pages). story-rivalry.js re-run: 13
  pass. `npm test` 2,624 pass; tsc clean; ESLint clean on the changed files. UI-REVIEW-MAP: no engine change (the spec reuses C1's
  `shown: 'picked'`; the call game's own page is C1's reviewed one-game sides).
- **Noticed, not fixed:** BACKLOG 256.
- **C3. The victory lap** (S–M): one prompt after a win; a GIF and a line to the couch's feed and the league's room; held for
  anyone hiding scores.
**C3's build notes (2026-11-23, lane `sports-couch`, port 3019; not committed; migration 0452; no new ESPN read; no engine change).**
Story: https://claude.ai/artifact/9vvuad5i6GPUmx9jxzTK48. **Approved as built** (the user, 2026-11-23, taking both
recommendations: decisions.md): no push for a lap; "You called it" stays on both the lap card and the call row. The design: [victory-lap-spec.md](design-round/victory-lap-spec.md) (Intent),
`-first-view.md` (PFD), `-shape.md` (Impeccable), `-check.md` (the check and its one batch).
- **The model:** a lap is one a fan a win: every follower on the couch of the team that won, from the final until the team plays again,
  answered once (posted, or Not this time, kept so the prompt ends on every phone). A GIF (KLIPY's picker, starting on "<team> win") and
  a line (optional; the line alone with GIFs off). It wears the final that earned it (the team's side, kept with the lap), lands in the
  game's thread in the league's room with no push, and on the couch's feed. Nothing of it (the prompt included) for anyone hiding scores
  who hasn't shown the game. Take it back deletes the room message, and the lap with it.
- **Where:** `src/new/sports/lap.tsx`. This week's lap card under the move strip (the ink button, never the page's yellow; 120 px): the
  team's mark, "Giants won", the score, "vs Bears" or "at Riley's Jets", "You called it" when the fan's call or rivalry pick was right.
  The lap sheet: the picker, then the GIF big, the line and Post it, then posted with Take it back. The game's sheet once final: the ask
  under the couch line (after Not this time, a quiet "Take a victory lap") and **Victory laps** (each GIF with its name strip and line).
  The room's lap message (show/chat.tsx `Line` takes a `lap` head: the tag and the result over the GIF, the line under it). The hub's
  feed: a `lap` row opening the game's thread, held on the phone for a hider. This week's room line says "took a victory lap".
- **Data:** `GET/POST/DELETE /api/sports/laps?couch=` (src/lib/server/sports/laps.ts: open laps from the teams' cached schedules as C2's
  calls read finals; the posts through league-chat.ts `postRoom`, now with `quiet` and a lap's line beside its GIF); the room's read
  carries a message's `lap`; couch-hub.ts adds a `lap` feed kind. Migration 0452 `sports_laps`. HOSTING.md, "A victory lap".
- **Checks:** `scripts/dev-test/story-victory-lap.js` (16 frames and 21 checks on the stand-in ESPN and KLIPY: the card, no yellow,
  120 px, the picker's search, the lap in the room with its final, no push, a non-fan refused, Sam's sheet, room and feed, nothing for
  Casey hiding until Show records, the rivalry's "at riley's Jets", Not this time kept, the sheet's quiet link, nothing for the loser,
  Take it back; `--before` shot the old pages). fake-gifs.js takes `extra` tiles. check-sports-couch.js's cleanup removes laps.
  story-lone-fan.js re-run: 15 pass. `npm test` 2,624 pass; tsc clean; ESLint clean on the changed files. UI-REVIEW-MAP: no engine
  change.
- **Noticed, not fixed:** BACKLOG 257.
- **C4. Solo** (M): your team's calls (Pick'em on a team's games, started by your first call, no setup screen); the season call
  (a new long prediction); a team draft with computer players (plays today).
- **C5. The couch's games** (M): a slate of only the games a couch member's team plays, the default weekly Pick'em, offered first.
- **C6. Rivalry stakes** (S–M): cosmetic, both fans agree, shown on faces for a week.

### Phase D: lines (PLAN-sports-lines.md's steps 1–6; ESPN only)

D1 read the whole line (S; any time: small, and it sharpens A1's line); D2 fresher reads (S–M); D3 against the spread and upset
points (M, a migration); D4 player lines, a real prop sheet, and props as projections for draft rankings (BACKLOG 90) and computer
players (229) (M–L); D5 futures pools and the season call against the book (M); D6 our own lines from stats (M).

### Phase E: March Madness (dated)

**E1. College's tournament as a playoffs slate** (M–L), so the gallery's March Madness bracket plays (src/lib/game/start-gallery/
sports.json: "L4: college's tournament as a playoffs slate", the tracker's w056), men's and women's. **Working by Fri 2027-02-26**,
two weeks before Selection Sunday in mid-March, checked on a recording of the 2026 tournament (record one first). Its own lane;
it waits on nothing above.

## Order

A1 → A2 → A3 with B1 → B2, B3, B4 → C1–C6 → D2–D6. D1 can go any time. E1 runs in parallel and must land by its date.

**How the sessions go from here** (Claude's call, the user's ask, 2026-11-22). Steps share a prompt when nothing decided at one
review could change the other; they stay apart when that review shapes the next, or when a step adds a migration, a new external
read, an engine change or anything production. One full design round fills most of a session: two fit, a third runs thin.
1. **B1 Standings + BACKLOG 254 (k)** (one prompt: (k) is small and won't go stale).
2. **B1 Chat** alone (a league room: chat is per season today, likely a migration).
3. **Merge the lane** after B1, its own prompt, on the user's word (migration 0313; master moves on meanwhile).
4. **B2** and **B4** apart (each M, each redesigning a sheet in use); **B3** alone.

## Not in this plan

Live points during a game (PLAN-sports-ready Phase 5); the pages inside a game (its Phase 4); event sports' own pages and bugs
(golf's leaderboard slice, tennis's set score: after B1); athlete search; any paid data.
