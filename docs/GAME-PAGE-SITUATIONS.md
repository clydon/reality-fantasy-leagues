# The game page's situations: what its redesign must show, and what the bench produces

Part 4 of the design round's preparation ([the packet](DESIGN-ROUND-PACKET.md), 2026-11-14). The recommended first page is a
generated game's own page with its sheets, piloted on **head to head**: a Survivor Weekly Lineup (draft 3, start 2, a two-seat
playoff, four people) and its sports twin, the NFL's own season game (head to head, a weekly lock, three people). Each situation
below is one the fresh-start brief asks a redesign to show: who is behind, moves due or set, a week in progress, results in,
reveals, sports and shows.

**Open one:** Atlas (`bash scripts/dev-test/restart-atlas.sh`, then `http://127.0.0.1:4400/__atlas/bench`) › Open… › **A first-page
situation**. It opens on the game's own page (Full game) as its viewer, on the real routes (the live tier: zt-gb rows), with every
step that built it in the step bar, so step back and forward walk through how it got there. The viewer switch shows the same moment
as anyone else, each at their own mark.

**What it is:** `tools/gameplay-bench/explorer/situations.cjs`. Each situation is a v2 definition plus the runtime actions that bring
it there, played by the same runtime the page and the CLI run, never a hand-shaped state; results come from the bench's own
Publish (`explorer/publish.cjs`). `tests/gameplay-situations.test.js` holds each to its claims on the projection, so a situation
that stops being what it says fails there. Headless: `node -e "console.log(JSON.stringify(require('./tools/gameplay-bench/explorer/situations.cjs').build('show-due')))" > s.json`, then
`node scripts/gameplay-bench.js execute --file=s.json` takes its `input` (or open the file on the page: Open… › A file).

**Checked on the real page:** `node scripts/dev-test/check-situations-page.js [--only=<regex>]` opens each one from the menu
and checks that it lands on the game page, signed in as its viewer, with nothing scrolling sideways. It keeps a screenshot and
the page's words for the round (`.ui-atlas/situations/<id>.png` and `.txt`). 17 of 17 passed on 2026-11-14. Those words and
screenshots are today's page in each situation: the baseline the redesign starts from. `show-due.png`, for one, shows the
record and the grid but nothing naming this week's opponent (Designs needed item 3).

## The situations

"Before" is what the bench could produce before 2026-11-14's wrap-up: a page-check definition (in `.ui-atlas/explorer-page/`,
written by `check-explorer-page.js`), the recipe form (a points lineup only: no head to head), or nothing. "Now" is the situation's
id in the Open menu.

| Situation | What the redesign must show | Before | Now |
| --- | --- | --- | --- |
| Your lineup is due, everyone caught up | This week's opponent and their record, your record and last result, the lineup to set and by when | Page check's head-to-head definition, stepped by hand; no recipe | `show-due` |
| Your lineup is set, waiting | All set: your starters against your opponent's (theirs hidden until it locks) | No (the recipe's "decision saved" is a points game) | `show-set` |
| Locked: aired, no results yet (live only) | Locked lineups, both shown, results to come | No | `show-locked` |
| Early results: a week in progress | What early results say so far, marked provisional | No | `show-early` |
| Results in, you've watched | Last week decided (who won, by what, which starters scored); the record and standings moved; next opponent | Page check `head to head` (`05h-h2h-week.png`) | `show-results` |
| You're two episodes behind | Nothing past your mark; what's waiting; the way to reveal; your moves for your episode | Recipe "You are two episodes behind" (points game) | `show-behind` |
| Your opponent is behind | Your result against someone who hasn't watched: what you may see, and that they haven't | Recipe "A friend is two episodes behind" (points game) | `show-friend-behind` |
| A quiet night | A week that counts for nobody, said as such | No | `show-quiet` |
| The playoffs, the final next | Seeds, the final to come and who is in it; those out of the playoffs said as such (not OUT) | Page check, played through (`05i-h2h-final.png` is after the final) | `show-playoffs` |
| The season over, a champion | The champion named; final standings, and why a champion outranks a better record | Page check `head to head` (`05i-h2h-final.png`) | `show-champion` |
| Long names | Long names in the opponent line, the table and the grid: nothing that matters cut, no sideways scroll | Recipe labels (points game) | `show-long-names` |
| Solo | Personal progress, no "1st of 1", no opponent | Recipe with one player (points game) | `show-solo` |
| NFL: your lineup is due | Opponent; the lineup by position with each player's game and kickoff; the week's lock | Page check `sports locks` definition | `nfl-due` |
| NFL: results in, told though behind | A live sports game shows results before you've marked it watched (the default); each starter's line | Route check only | `nfl-results-told` |
| NFL: hides scores, a game behind | Nothing past their mark, and that the others can already see it | Route check only | `nfl-hides-behind` |
| NFL: last week's game cancelled | The cancelled game named; a week for nobody; the next lineup open | No (today's slice) | `nfl-cancelled` |
| NBA: a week of three games in progress | The week laid out by game, who's locked now, what's final so far marked provisional | Page check `sports slates` (no week in progress) | `nba-week-in-progress` |

## What the bench still can't produce for this page (recorded, not built)

- **A late joiner** (someone who joined at episode 4 of a game begun at 1). The runtime's own pace marks everyone as catching up
  from the start; a seat that joined mid-season is a gap (the runtime's own-pace model, `GhostLogic.lateJoinOf`).
- **Loading, error and offline states.** Transport faults are a named profile gap (`Transport fault injection is not connected
  yet`). Judge them in the round from the page's own code.
- **The opponent's lineup before and after the lock, as permitted.** Each situation shows it as the server serves it to the
  viewer; whether that's what should be shown is the round's question, not the bench's.
- **Head to head with a cut, or someone knocked out of it.** The engine refuses the pairing in generated games; the out state is
  the page check's `cut` definition (a points game: `cut-page.json`, `05r-cut.png`), Designs needed item 10.
- **Head to head on a field or a card** (golf, tennis): no default plays it. Points games on those are the page check's `sports
  places` and `sports formats` definitions; categories head to head is `sports categories`.
- **Other families as variants** (pools, questions, Outlast, stages): their page-check definitions in `.ui-atlas/explorer-page/`
  (`*-definition.json`, opened with Open… › A file) are the variants to check the design against.
