# Plan: sports on the couch (the hub's scores strip, a league's page, playing as a couch, lines)

> **Status (2026-11-22): Settled, not started.** The user's calls are in; start at step A1. Lines are Phase D, detailed in
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

**A2. The league card in Your shows** (S–M). 72 px, among the show bands, sorted by its next game like shows by their next
episode; the league, the week, the couch's teams as marks, one muted line of what the couch has going (never what the strip
already says); off-season, one line. Until B1 lands, a tap opens today's league sheet (`openSports({ kind: "league" })`).

**A3. Follow a league** (S, a migration). A league follow (a `league_follows` table, or a league-wide row beside `team_follows`:
decide in the step) from search's league card and the league's page; "my team" per league.

### Phase B: the league's page and finding sports (round 1, with round 2's This week)

**B1. The league's page** (L, a session a tab): **This week** (the strip's due move, the rivalry, the couch's teams by record,
rivalries this season, your games, the room, the rest of the league), **Scores** (a week or day switcher, the shared game row),
**Games** (with the couch, rivals, on your own), **Standings** (ESPN's standings: a new read), **Chat** (the league's room and a
thread per game: chat is per season today). Records for the table come from the scoreboard's records or the standings read.

**B2. A team's page** (M): a full page instead of today's sheet (src/new/sports/team.tsx): the live or next game, Up next with
Play, the schedule by month with results and the bye, Month view for daily sports with series, homestands and trips grouped,
and (C2) the fan card.

**B3. Search** (M): "Add a show or team" with All, Shows, Sports; a team's, a matchup's and a league's card first for a strong
sports match (src/new/sports/search.tsx, src/new/watching/sheets.tsx); event sports in results (dropped today); first run uses
the same search (BACKLOG 43).

**B4. A game's sheet with Play** (M): every game row opens one sheet; before kickoff its job is Play (Pick'em chosen, the other
types beside it, bigger sizes a row down, "already on the couch" first so nobody starts a duplicate).

### Phase C: playing as a couch (round 2)

- **C1. Rivalries** (L): found from follows and the schedule; the rivalry card; the challenge (Winner and margin, an invite to one
  person); sides as public picks; margins hidden until kickoff; the result; the couch's rivalry record across seasons.
- **C2. The lone fan** (M): a fan's call with Back and Fade (Pick'em on one game, framed); his calls record; the fan card and his
  games on the team's page; watching marks for sports.
- **C3. The victory lap** (S–M): one prompt after a win; a GIF and a line to the couch's feed and the league's room; held for
  anyone hiding scores.
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

## Not in this plan

Live points during a game (PLAN-sports-ready Phase 5); the pages inside a game (its Phase 4); event sports' own pages and bugs
(golf's leaderboard slice, tennis's set score: after B1); athlete search; any paid data.
