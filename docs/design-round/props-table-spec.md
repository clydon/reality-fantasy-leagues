# Prop sheet round: naming a sports game, and picking a player from a table (Intent's page spec)

The user, 2026-11-23, on their phone in a Commanders 2026 Prop sheet: "G10 and game 10 means nothing to users. Also the player
list needs to be a table. Take inspiration from Yahoo fantasy leagues and what data we can get from our ESPN API." Screenshots:
our sheet (PROP SHEET · GAME 10, "3 questions for Game 10", a 4-wide face grid of the whole roster for "Who throws for the most
yards?") beside Yahoo's Players tab (a sticky player column with headshot, position, team and the next game; scrolling stat
columns; sort by any column; filters for status, the stat window and team).

## 1. Naming a game of a sport

**What's broken.** A sports "episode" is named the way a show's is, with the season's word and its number: "Game 10", "G10",
"Prop sheet · Game 10 started". People don't count their team's games; they name one by who it's against and when ("Monday at
the Bengals", "Week 11"). The number is the database's index, not the person's word.

**The label system** (one function, every surface that names a sports episode reads it; a show's episodes keep "Episode 4"):

| Room | Form | Commanders, game 10 | A baseball team, game 74 |
| --- | --- | --- | --- |
| Long (titles, toasts, sheet subtitles) | `[Week N ]at/vs Opponent` | Week 11 at Bengals | vs Rays, Fri Jun 5 |
| Short (a row's line, the strip) | `at/vs Opponent` | at Bengals | vs Rays |
| Tag (a chip, a ruler cell, was "G10") | `@ABBR` / `ABBR` | @CIN | TB |
| The one coming up, near its day | `Mon at Bengals` | Mon at Bengals | Tonight vs Rays |

- The opponent comes from the episode's linked event (its teams, the season's own team removed); "at" when away, "vs" at home.
  The short team name ("Bengals"), never the full ("Cincinnati Bengals" truncated to "CINCINNATI BEN…" on the strip today).
- The week only where the league plays in weeks (the NFL, college football: ESPN's calendar is weekly). Elsewhere the date.
- A league's season (a slate: "Week 11" already) and a one-game season keep their own names. A playoff game says its round
  ("Wild Card at Bengals").
- Where a number is still needed for order (the season ruler's cells), the tag carries it; the number itself never shows.

**Surfaces it reaches** (from the UI review map): the game page's header and strip, Tonight's rows, the Games tab's cards,
toasts ("Prop sheet started for Week 11 at Bengals"), the question sheet's subtitle and group label, the episode door's cells,
Where you are, chat's "revealed …", reminders and notifications. One helper; each `${word} ${n}` that can be a sport's reads it.

## 2. The player answer: a table

**Job.** Make a good pick in under a minute: see who realistically gets this stat, how each has done, and who's hurt, then tap one.

**Who's in it (the pool).** The question is about one game, so both teams' players. Today a team season's pool is its own team's
roster only, so the likely answer (Joe Burrow) can't be picked and the question shrinks to "which of our QBs". **That's an engine
change** (a game's question draws from that game's two rosters), planned as its own step (Open engine limits); the design assumes it.

**Rows, in rank order.**
1. **The contenders:** everyone on either team with the settling stat this season (PYDS > 0), sorted by its per-game average,
   highest first. For passing yards that's 2 to 5 rows: the starters, then the backups who've thrown.
2. **Everyone else, folded:** "Everyone else · 98" opens the rest, grouped by position, for the long shot (a trick play).
   Never the default view: a lineman never sits beside a quarterback for a passing question.
- Before any game has a stat (Week 1), rows rank by last season's per game (the athlete-history read), the column says "Last season".

**Columns** (a sticky player column, then numbers; three fit at 390 without scrolling):
- **Player** (sticky): headshot 28 px, short name ("J. Burrow"), team abbreviation and position ("CIN · QB"), an injury tag
  (Q, D, O, IR) when the roster has one.
- **The settling stat per game** (YDS/G): highlighted, the default sort.
- **Last game** (its value in their most recent game).
- **Season** (its total so far).
- Scrolling on: the stat's neighbours for that position (passing: CMP%, TD, INT; rushing: CAR, TD; receiving: REC, TGT, TD).
- Any column header sorts. No filters sheet: the pool is already one game's 100 players, and the fold does the filtering.

**Picking.** Tapping a row picks it (a radio: one row, a tick in place of the headshot, the row tinted). Tapping it again takes it
back, as the faces do today. A question that names several (`pick` > 1) takes up to its pick, the count in the line under the question.

**Drill.** The picked row grows one line: "See J. Burrow's season" opens the athlete sheet (his weekly graph, existing drill),
and back returns to the sheet with the pick kept. No separate tap target per row: on a phone one tap must mean one thing.

**States.** Open (the table). Picked (the row ticked, Save names it). Locked: the table stays, everyone's picks shown as faces
in a column ("Picked by"), the settled stat's value in its column and the right row marked. Behind (catch up first): as today.
Hidden scores: the stat columns read "—" until revealed, the pick still works.

**Left out.** Projections (we don't have them; ESPN gives no projections on our reads), trend %, roster %, ownership (a prop sheet
has no rosters). Yahoo's filter sheet (status, stat window, team): the pool is small.

## 3. Drill tree, with verdicts

| Level | Today | Verdict |
| --- | --- | --- |
| Game page header and strip | "Prop sheet · Game 10", "3 questions for Game 10" | **Repaint** (the label system) |
| A "who wins" question | two cards, names truncated | **Repaint**: short team names with each record |
| A player question | 4-wide face grid of the roster | **New display**: the table |
| A player | (none from the grid) | **Keep** the athlete sheet; a new door from the picked row |
| A number or over/under question | stepper, chips | **Keep**: works, not in the user's ask |
| Toasts, rows, chips elsewhere | "Game 10", "G10" | **Repaint** through the one helper |

## Built (2026-11-23, local, not committed) and what's left

Built: `sports/game-names.ts` (each team-season game's long, short and tag names) through `SeasonHeader.gameNames` and
`show-words.ts epName`; the game page model, This week's card and the question sheet use it; Start a game names a one-game game
"Prop sheet · Week 12 vs Chiefs" (`spans.ts kindOf` strips it); `pick-stats.ts` and `StatPicker` (answer-controls.tsx); Who wins?
wraps whole names, the game's listing away side first. Story: `scripts/dev-test/story-props-table.js` →
https://claude.ai/artifact/VYMe7dQCbJHtb1r3164dDv.

The user's revision (2026-11-23): a name carries both teams, away at home ("Chiefs at Bills, Week 12", short "Chiefs at Bills", tag
"KC @ BUF"), since people start games on teams they don't follow; and the table has Yahoo's position chips (All, the question's
own positions first, then QB RB FB WR TE K P DEF and the lines and defense). The label table above is superseded by this.

Correction: a team's season already casts every team it plays, so the opponent's players are in the pool. No engine step needed
(the "Open questions" item below is settled).

Decided and done (the user left both calls to us, 2026-11-23):
- Opponents' numbers: each contender's season line from ESPN (pick-stats.ts: everyone in the game at a position with the stat, one
  call each, cached a day), for someone caught up only; their last game stays ours, blank when ESPN has games we don't hold.
- Existing one-game sports games are renamed on production (scripts/rename-sports-games.js, after the push).
- The season grid's column headers read the opponent ("KC", "@CIN": `epName` "col"); an athlete's answer reads "P. Mahomes".
- Save keeps "Save my answer": the tick in the row shows the pick.

Backlog: 262 (the rest of the sports surfaces still saying "Game N"), 263 (the picked row's door to the athlete sheet).

## Open questions

- Should the pool grow to both teams (the engine step above), or should the question be reworded to "Which Commanders player…"?
  The spec recommends both teams: it's what the question says, and what a fan is betting on.
