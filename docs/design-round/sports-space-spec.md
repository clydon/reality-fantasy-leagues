# Sports as a place you follow: the page spec (Intent, step 1)

> **Superseded in part (2026-11-22):** the hub's league card and live games are round 3's
> ([hub-scorebug-shape.md](hub-scorebug-shape.md)): Your shows keeps its name, the card is 72 px and quiet, and live games sit in
> the scores strip under the guide. The plan is [PLAN-sports-couch.md](../PLAN-sports-couch.md).

An idea round, 2026-11-21, asked by the user: "followed teams or leagues don't show up on my shows on the hub. Maybe it should?
… Adding a sports game that is airing feels clunky. When searching for a show or team we should have something that more
resembles a schedule, a calendar … Searching for sports, teams or others … should know that we are doing sports and should serve
results differently. Some people might want to follow the NFL in general and have a quick way to enter that from the hub. Then they
can chat openly about the entire league, watch scores, or create games (likely one-off or series games). It acts differently from
shows because it is. I'm fine taking heavy inspiration from other sports apps." Intent's `organize`, once. Nothing here is built;
the story is idea mocks plus today's real frames.

## The job

**A fan opens the app and is one tap from their league and teams: what's on, what happened, what the couch is saying, and a game
on any of it.** Five surfaces share it: the hub's Your shows, a league's own space, a team's page, Add's search, and starting a
game on one game.

## The model underneath (why it's a restructure, not a repaint)

A show is a season of episodes you watch in order, at your pace. A sport is a calendar: a league runs weeks or days of games, a
team has a schedule, and a game is an event that's on, coming or final. Today the app bends sports into the show model:
- adding a game makes a one-game "season" (`makeMatchup`), which lands on Your shows as a poster with a one-episode timeline;
- a league is a sheet (LeagueView) and a season of it is a show ("NFL 2026") with weeks as episodes;
- a followed team (team_follows) has no place of its own: it only feeds the hub's Games band and the guide's Sports;
- nothing follows a league.

The proposal keeps the engine's seasons and matchups as they are and changes what people see: **the league is the thing on your
list; teams and games live inside it; your games sit on top of its games.**

## What's wrong today (the before frames, real renders: 2026-11-16 hub and guide, 2026-11-21 team sheet)

1. **Follow has no payoff where people look.** Following the Eagles adds nothing to Your shows. Their game appears only in the hub's
   Games band when it's this week, and in the guide's Sports tab.
2. **One game becomes a show.** "Cowboys at Eagles, Nov 17" sits on Your shows beside Survivor 51, with an episode timeline of 1.
   Three games make three posters.
3. **The same game in three places.** The Games band, the game's poster and On TV can all show the Eagles' game at once.
4. **Starting a game on something airing takes four steps** through a show-shaped sheet: Add a show, type the team, the team step,
   then Play the next game or Start a game on. The team sheet opens over a page titled "ZT National Football League 2026" and is
   titled "A team".
5. **Search treats a team like a TV listing.** Teams come back as text rows ("Philadelphia Eagles · NFL · Next: Sun 1:00 PM vs
   Steelers"); a league row says "Every game, week by week"; golf, racing, MMA and tennis are dropped.
6. **No league space.** No scores page for the league, no league-wide chat, no standings, no week to browse back or forward.

## Situations and lenses

- **Andrew drives by:** on Sunday he wants the Eagles' score and the couch's Pick'em in one look, and a game on Thanksgiving's
  Eagles at Cowboys in two taps.
- **Joanna forgets:** a friend says "we're doing the NFL thing"; she taps NFL on her hub and is in the right place, with what's due
  named in plain words.
- **Conor tinkers:** wants the week's whole slate, last week's results, standings, the Eagles' schedule to plan a series game, and
  the couch's chat about the league, each one tap from the league.
- **Hides sports scores:** every final reads "Final · Show score" until they tap; live scores aren't on the hub card; the league
  chat folds messages from a game's thread until they've seen it (open question).
- **Daily sports (NBA, NHL, MLB):** a day switcher, not a week; a team's schedule as a month calendar where 80 to 162 games make a
  list too long; series, homestands and road trips are natural units for a game.
- **Event sports (golf, racing, MMA, tennis):** a league's Scores becomes "This week's event" (a field's leaderboard, a race, a
  card); out of this round's mocks, named so the structure leaves room.
- **Flavor:** sports only. Shows keep hub → show → Tonight / Episodes / Games / Players / Chat.

## The structure

**The hub's Your shows (restructure).** One card per league you follow, directly or through a team, beside your shows in the same
list, ordered with them by what's on soonest. A league card is one chunk: your team's game (live, next or last), your games on that
league in one line, and the rest of today in one line. The one-game posters go: a game you play lives in its league's card and its
Games tab. A league with nothing this week shrinks to one line (its next game). The add row reads "Add a show or team".
- *Alternative B, a favourites rail:* a row of league and team marks under Up next (theScore and ESPN do this), Your shows stays
  shows. Faster to scan, but it's a second overview section (product principle 7) and a league with nothing today is only a mark.

**A league's space (new screen).** Its own page like a show's, from the hub card, search, or any team mark. Tabs:
1. **Scores** (default): a week switcher for weekly sports, a day strip for daily ones; your teams first, then live, then later
   today, then the rest of the week by day. Each game row is the shared game row.
2. **Games:** your games and the couch's on this league (join), then **Start a game on** by size: one game, this week's games, a
   series or rivalry, a team's season, the whole season, the playoffs.
3. **Standings:** the league's table by division or conference; your teams marked. (Needs ESPN standings, not read today.)
4. **Players:** the league's athletes, sortable, as the sports plan's Phase 4.2 page 5 designs.
5. **Chat:** the couch's room for the league, with a thread per game (the game row's chat count opens it).

**A team's page (restructure of the team sheet).** A full page rather than a sheet over a season page. The team's plate, record,
Follow with the couch's faces; the live or next game; then **Schedule** as a sports app shows it: results and coming games together,
by month, the bye named, W/L with scores (behind Hide scores when it's on), the season so far folded to its form strip. Daily
sports get a **Month** view (a calendar) beside List, with series, homestands and road trips grouped and playable as one.

**Add's search (restructure).** The sheet becomes "Add a show or team" with a scope switch (All · Shows · Sports). Before typing,
Sports shows the leagues as tiles and what's on now across them. Typing a strong sports query (a team, two teams, a league) puts a
**rich card first**: a team's plate with its live or next game and Follow; two teams' matchup with their next meeting and Play this
game; a league's card with Follow and Open. Weaker matches and shows follow as rows.

**Play this game (new sheet, replaces the steps).** Any game row that hasn't started has Play; it opens one sheet on that game: the
matchup, the game types as tiles with Pick'em chosen, bigger sizes as rows (both teams' Thanksgiving, their series, the team's
season, the week), the couch line, and Start. It adds nothing to Your shows: the game lives in its league.

## The drill tree

| Level | Questions (casual · sweat) | Data held | Today | Verdict |
| --- | --- | --- | --- | --- |
| Hub league card | Is my team on? Am I winning my pick'em? · What else is live? | couch teams, week, your games | Games band + one-game posters | **new display** |
| League space, Scores | What's on, what's the score? · the whole slate, last week | `useSportsWeek`, events | LeagueView sheet (this week only) | **new screen** |
| League space, Games | What's ours here? Start one · every size | leagues, scopes (2.8) | Start a game on (team sheet) | **restructure** |
| League space, Standings | Where are we? · tiebreaks | not read | none | **new screen** (data first) |
| League space, Chat | What's everyone saying? | season chat | per season | **restructure** (league room + game threads) |
| Team page | When's the next game? · the whole schedule, form | `espn.schedule`, form | team sheet | **restructure** |
| One game | Score, who's watching, play | event, box score | game sheet | **keep** (opens from the row) |
| Athlete | How's he doing? · weekly line | stat lines | athlete sheet | **keep** here (Phase 4.2 page 5) |

## Left out, and why

- **Event sports' own Scores** (a leaderboard, a card): the structure leaves room; designed with Phase 4.2 page 4.
- **Athlete search:** no athlete index exists; a later search row.
- **Live scores on screen:** Phase 5. The mocks show them because a Sunday needs them; the live path decides when they're real.
- **The matchup seasons themselves:** kept in the engine; only how they're shown changes.
