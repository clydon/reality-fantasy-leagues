# When the engine changes: which screens to review

Every engine capability shows up on several screens. When one is added or changed, find its kind below and review each screen
listed for it, at 390 px, on a real game of that kind (a competition show first; a sport too when the capability plays there).
Then:

- update the screen's registry where it has one (Tonight: `seen` in `src/lib/game/night-rows.ts`; the game page: its grammar);
- add a frame to the story of whatever round the change belongs to;
- write anything left unreviewed in BACKLOG.md, naming the screen.

The checks marked **fails** stop a build or a test run until the screen has a design. The rest depend on this map being read.

The [gameplay coverage matrix](GAMEPLAY-COVERAGE.md) is the long-form ledger of capability by surface, and
[ENGINE-CAPABILITIES.md](ENGINE-CAPABILITIES.md) is what plays now. This page is the short list of where to look.

## The screens a game reaches

| Screen | What of a game it shows | Code |
| --- | --- | --- |
| Game page | The whole game: its main block, the season grid, the table, How it plays | `src/new/show/game-page.tsx`, `src/lib/game/game-page/` |
| Tonight's night | The last episode, a row each (closed and open), by main block | `src/new/show/night.tsx`, `src/lib/game/night-rows.ts` |
| Tonight's next episode | One-episode games to play or join | `src/new/show/whats-on.tsx` (NightRow), `night.tsx` (JoinRows) |
| The strip and Your moves | What's yours to set and by when | `src/new/show/strip.tsx`, `your-move.ts`, `moves.ts` |
| Games tab | Each game's row, the archive and your record | `src/new/show/games.tsx`, `whats-on.tsx` |
| Drill sheets | A person, an episode (everyone's night), a matchup, a compare, a castaway | `src/new/show/game-sheets.tsx`, `game-week.tsx`, `cast-sheet.tsx` |
| The reveal | An episode's beats across every game | `src/new/show/reveal.tsx`, `src/lib/game/episode-view.ts` (revealIn) |
| Episodes | An episode's page and each game's line for it | `src/new/show/episodes.tsx` |
| Start a game, Game settings | The gallery, a base's screen, the preview, the settings | `src/new/couch/gallery-bold/`, `src/lib/game/start-gallery/` |
| How it plays (words) | The game in sentences | `src/lib/game/game-spec/describe.js`, `src/lib/game/game-words/` |
| Join and catch up | Joining late, own-pace catch-up | `src/new/couch/join-game.tsx`, `src/new/show/pace-plate.tsx` |
| Notifications | The one line a push says | `src/lib/server/push-events.ts` |

## By kind of engine change

| The engine change | Review | Check |
| --- | --- | --- |
| **A new main block** (a new way a game is about: a rank, a way to get, a scoring heart) | Game page main block; Tonight's row and open (add it to `NIGHT_ROWS`); Games tab row; drill sheets (the episode block by kind); the reveal's beat; Start a game's base screen and preview; How it plays | **fails**: tsc (`NIGHT_ROWS` is a `Record<MainBlock, …>`); `tests/night-rows.test.js`; `tests/game-page.test.js` |
| **A new dial value** (a twist, a scoring rule, a lock, a pace) | Game page places (its grammar); How it plays; Game settings; Tonight's change or line if it changes what an episode does; the reveal if it has a moment | **fails**: `tests/game-page.test.js` (a dial value with no place is a hole) |
| **A new square or block kind** (`GridKind`, `BlockKind` in `game-plays.ts`) | The season grid; the person sheet's strip and episode block; the episode sheet; Tonight's faces and change (`picksOf`, `changeOf` in `night.tsx`) | by hand |
| **A new move** (a pick, a lineup, answers, a claim, a draft turn) | The strip and Your moves; the Games tab row's glance; Tonight's next-episode rows; notifications; the catch-up sheet | by hand |
| **Pace, locks or spoilers** (who sees what when, own pace, live only) | The progress control; the reveal; Tonight's night at your mark (rows for whoever hasn't watched); every drill sheet; notifications' words | by hand; `tests/dst.test.js` for times |
| **Who sees others' moves** (privacy, secret roles, lock-time reveals) | Tonight's everyone rows and news line; the game page's table; the episode and matchup sheets; waivers' everyone's moves | by hand |
| **Spans and stages** (a game over some episodes, a game in stages) | Tonight's length words and its groups (one-episode first, then soonest to end); the Games tab's grouping and archive; the game page's stages | by hand |
| **Results kept outside a game's state** (bingo, calls, trivia, answers) | Last time's Bingo and trivia expander (the moments that hit, who got bingo; each question, its answer, who got it right); the episode page; the reveal | by hand |
| **A sport's capability** | The sport's own parts (sports keep their own components); the same rows above where a sport's game reaches them | by hand; the sport's checks |

## Tonight's row, by main block

What each kind of game shows, closed and open, is declared in `src/lib/game/night-rows.ts`. Its `seen` field names the story frames
where that kind was checked on a real game, and is null where it's designed but not yet seen:

| Main block | Faces | Change | Second line | Your place | Open |
| --- | --- | --- | --- | --- | --- |
| together (co-op) | your plays | lives lost or none | lives left | none | everyone |
| race | your plays | points | distance to the target | yes | everyone |
| matchup, categories | your plays | W/L and score | who you played, your record | yes | the episode's matchups |
| worth | your plays | points | your total | yes | everyone |
| week (weeks won) | your plays | "Won the week", else points | weeks won | yes | everyone |
| board, card | none | points (a card: lines) | your total | yes | everyone |
| objectives, team, picks | your plays | points (a team: All safe or Lost) | your total | yes | everyone |
| ladder (a pool) | your pick | stayed or went home | your streak | yes | everyone |
| slate, ballot (questions) | none | points | your total | yes | everyone |
| stages | your plays | points | the stage that played, the overall | yes | everyone |

One-episode games that played the episode lead with who won. Bingo and trivia aren't games (every episode has them, for everyone
who follows the show): they're one quiet expander in Last time.
