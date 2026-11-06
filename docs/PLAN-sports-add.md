# Plan: adding sports by team (Add a show)

## The ask (the user, 2026-11-01)

While trying the first-time tour, whose demo adds "Sunday Night Football": "Sunday night football is not how someone would add a
game, they'd likely search a team's name. Then we show them their schedule. Or if we said both the team and the opponent in any
order. And we might want a series, like if the yankees play a 3 game series with a particular team. This will certainly involve
UI changes and an API call with ESPN and somehow use it in conjunction with what we have for searching normal shows."

## What exists (read 2026-11-01)

**Master:**
- **ESPN** (`src/lib/server/sports/espn.ts`, cached in `sports_cache`): `find(text)` is ESPN's own search (`search/v2`). It returns
  teams and leagues, each with its league path, but no logo, and only the linking calls it. There are also scoreboards
  (`eventsOn`), rosters, box scores and season stats. ESPN has no key and no stated limits; the cache keeps the calls few.
- **A sport is only ever a TV listing** (TVmaze, `shows.kind = 'sport'`): Sunday Night Football, the World Series. Each episode is
  linked to its ESPN game up to 8 days ahead (`season_events`, `link.ts`, `sports-match.ts matchupOf`, which splits a title on
  at, vs or @).
- **Add a show's search** (`src/new/watching/search.tsx useShowSearch`): the catalog, filtered in the browser, then the TV
  listings (`/api/listings/search`, edge-cached). Its rows come in two kinds, `season` and `listing`.

**The `sports` branch** (track L's L1 part 3, `bbfebb26`, no route and no UI):
- `espn.schedule(league, team, { season, type })`: a team's ESPN schedule.
- `src/lib/sports/matchup.ts`: `pickMatchup` picks the games for one game, a series against someone, or a team's next few, and
  `matchupName` names them ("Red Sox at Yankees, Sep 29 – Oct 1").
- `src/lib/server/sports/matchup.ts`: `makeMatchup` makes the picked games a season of their league's show, one episode per game,
  linked at once. Everyone who asks for the same games shares it (keyed by their ESPN ids), and its cast comes from the rosters.
- Migration 0300: `sports_events` (each game's final and line, refreshed by the daily job), `sports_matchups` (1 to 30 games) and
  `shows.sports_league`.

**Gaps:**
- Nothing calls them yet.
- ESPN's search has no logos and ranks the college Eagles beside Philadelphia's.
- "Cowboys Eagles", with no at or vs, doesn't split into two teams.
- `matchupSeason` sets no `episode_count`, so the guide invents a weekly episode after the last game (`schedule.ts`). It sets no
  runtime either (every card is 60 minutes), and its seasons read "NBA 3" rather than their matchup.
- A whole MLB, NBA or NHL season is more than the 30-game cap.

## The design

**One search box.** Add a show's search finds teams too, beside shows:

1. **Teams.** When the words name a team, a group above Shows reads "[logo] New York Yankees · MLB · Next: Fri vs Red Sox".
   - Matched on our side against each league's team list, read from ESPN's `/teams` and cached for a week (names, nicknames,
     cities, abbreviations, logos, colours). So "yanks", "NYY" and "new york y" all find them.
   - ESPN's search is the fallback for leagues without a list.
   - Pro teams come first; a college team when the words say so ("Boston College") or no pro team fits.
2. **Two teams, in any order** ("cowboys eagles", "eagles at cowboys", "yankees red sox"): one **Matchup** row, "[logo][logo]
   Eagles at Cowboys · NFL · Sun, Nov 9, 8:20 PM". It shows their next meeting, or their next series.
3. **Shows**, as today. Sunday Night Football is still found as a show.

**A team's schedule.** Tapping a team opens its coming games in the sheet, a step like Where are you:
- **Series first where the sport plays them** (MLB, NBA, NHL): consecutive games against one opponent read "vs Red Sox · 3 games ·
  Fri–Sun", with **Add the series** and each game under it to add alone. The NFL lists one game a week.
- **Order and length:** the next first and a few weeks of games, then More. Finished games aren't listed: they're results, not
  something to watch.
- **No games coming:** "Back Mar 26" when ESPN lists next season's opener, else "No games coming up".

**A matchup** (two teams) opens their meetings this season the same way.

**Adding** makes or finds the matchup's season (`makeMatchup`: shared by its games) and follows it. Where are you isn't asked,
since nothing has aired. The games land on Your shows and on the couch's TV guide on their days.
- The season reads as its matchup ("Eagles at Cowboys, Nov 9"; a series "Red Sox at Yankees, Sep 29 – Oct 1"), with its game count
  as `episode_count` and the sport's runtime.
- Start a game works on it as on any season when its league's show is set up as a game. Otherwise it's "Not a game yet", as a
  listing is: to check, and set up the leagues the couch watches through the desk if they aren't.

**The tour's demo** adds a game by team instead of by TVmaze ids (BACKLOG 38). It types a team with a game this week (from the
league's scoreboard), taps the team, then taps its next game, each tap shown as today.

## Later, not in this plan

- **Follow a team:** every game of its season landing as it comes. That needs more than 30 games, a rolling window or a follow of
  the team itself.
- **College lists in full** (ESPN's scoreboards list only its default selection of games).
- **Events that aren't team against team** (golf, racing, tennis, fights: a tournament, a race, a card).

## Steps

1. **Bring over L1 part 3's pieces** from `sports`: the schedule, the matchup, migration 0300 and the daily refresh. Keep them
   unchanged, so L6's merge stays clean. Fix the three gotchas (`episode_count`, runtimes, the season's name) here and on `sports`
   both, with the sports lane told through its notes.
2. **Team lists and the search route**, `/api/sports/search?q=`: teams and a matchup, edge-cached, with two teams found in any
   order. Tests on the words: "yanks", "NYY", "cowboys eagles", "eagles at cowboys", and "Eagles" → Philadelphia first.
3. **The schedule route and the add.**
   - The route: a team's coming games, grouped into series.
   - The add: `POST /api/me/shows` with a matchup, which makes it and follows it, under the 10-new-shows-a-day cap.
4. **The UI.**
   - Add a show's Team and Matchup rows: two more `SearchRow` kinds. Update everything that assumes two kinds: `exact`, `Step`,
     `pick`, the subtitle, the tour demo's row lookup, and first run's search.
   - The team's schedule step, with Add the series and Add.
   - Your shows and the guide checked with an added game and an added series, at 390 first.
5. **The tour's demo by team.**
6. **Checks.**
   - A reusable `scripts/dev-test/check-add-team.js` on `fake-espn.js` (recorded schedules), with `zt-` rows that clean up after
     themselves.
   - The regressions: watching, guide, hub and tour.
   - HOSTING.md for the new calls: a league's team list a week, a team's schedule per look, both cached.

**Where:** a new lane from master. The sports lane keeps track L; its notes say these pieces reach master early.
