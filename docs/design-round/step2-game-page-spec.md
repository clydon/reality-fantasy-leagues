# The game page: page spec (step 2, head to head first)

## The job

One game, this week: who you play, your move and by when, and where you stand in the season. Why a score is what it is sits one
tap in, on the thing that shows it. One primary action at a time: the move that's due for you (set a lineup, replace a player,
reveal), or none.

People (the couch's archetypes, as in [the first views](phase0-first-views.md)): Joanna opens it after a week away and reads the top
for "is anything for me"; Andrew taps the one bright thing and leaves; Conor goes three levels down for the numbers.

The way in sets the prediction ([R4](phase0-first-views.md)): a head-to-head game predicts "who I play and my lineup". A Games-tab
row, a Tonight mini, the strip's Your moves header and a notification all land here, so the top of the page answers what each of
them said in one line.

## The overview, top to bottom

| # | Block | Holds | Opens |
| --- | --- | --- | --- |
| 1 | **The bar** | Back (to where you came from), the game's name on one line, a menu (How it plays, your sheet, and Backstage for whoever runs it) | Back pops history (back goes where you came from); the menu items open their sheets |
| 2 | **This week** (the matchup) | The episode and its air time once; you and your opponent, each a face, a name and a record; the state line (table below); your move as the page's one primary button when one is due; each side's starters as faces (yours always, theirs once locked) | The card opens the matchup sheet for that week; a face opens the cast sheet; the move opens Your moves on this game's tab, the waivers screen, or the reveal |
| 3 | **Last week** | One line inside This week's card when a result is in and you've seen it: "Ep 3 · Lost to Bo · 3–9" | The matchup sheet for that week |
| 4 | **Side bets** | One row for the episode the move is for: how many, how many you've called, Post one; after the episode, whether they're settled; for whoever runs the game, how many wait to be settled | The side bets sheet |
| 5 | **The season** | The season grid (a row a person: place, face, name, a square a week, the record), the playoff line and seeds, the tie-break said where it decides an order | A square opens that week's matchup; a name opens that person's sheet; an episode number opens the episode sheet |
| 6 | **Your team** | Your castaways (or players), each a face, a status (still in, out at Ep 4) and season points; in an exclusive draft, that they're yours alone | A face opens the cast sheet; "Week by week" opens your sheet |
| 7 | **How it plays** | The first three rules, led by what the setting chips used to say (a blind draft, one owner each, waivers, playoffs), then All N rules | The rules sheet |

Engine state appears only where it changes what you do now. Left off the overview, each with where it went:

- the 48 to 64 px title over the art: the name moves into the bar (decision 5); the show's art stays as the This week card's
  backdrop, the page's one recognizable anchor beside the faces ([R2](phase0-first-views.md));
- the setting chips (BLIND DRAFT, WAIVERS, ONE OWNER EACH): How it plays, first lines (decision 5);
- the spoiler line and Change: one quiet "Through Ep 3" in the bar's menu and the matchup sheet's foot, opening Where you are
  (decision 3; the progress control itself is Tonight's round);
- the You header and the full week-by-week body under it: your sheet, one tap from Your team and the menu;
- the date plate ("EP 4 · SUN 11:26 PM · All season · Draft 3, start 2 · Head to head, playoffs"): the time lives once, in This
  week; the rest is How it plays.

## This week, by situation

Each row is the card's content in rank order. "The move" is the one primary button; everything else on the card is plain.

| Situation | This week's card | The move | Below it |
| --- | --- | --- | --- |
| `show-due` · lineup due, caught up | Ep 4 · Sun 8:00 PM; You 1–1–1 vs Bo 2–1; "Your lineup isn't set · last week's stands in till then"; Last week line | **Set your lineup** · locks Sun 8:00 PM | Side bets row; the season |
| `show-set` · set, waiting | Ep 4 · Sun 8:00 PM; You vs Bo with records; "You're set"; your starters' faces; Bo's side "Shows when it locks" | none (Change lineup is a plain link) | Side bets row |
| `show-locked` · aired, no results (live only) | Ep 5 · Locked; both lineups' faces; "Results when they're in" | none | Side bets: everyone's calls now showing |
| `show-early` · early results | Ep 5; You 4 vs Bo 2 **so far**, marked early; "Final at noon tomorrow can still change it" | none | |
| `show-results` · results in, watched | Next week first: Ep 6, You 2–2–1 vs Di 3–1–1; Last week line "Ep 5 · Beat Cy · 6–2" | **Set your lineup** | The season moved |
| `show-behind` · two behind | "You're up to Ep 3. Ep 4 and 5 are waiting"; your Ep 4 matchup (You vs Bo) with nothing past your mark | **Reveal Ep 4** (every game at once, said once beside it) | The season as of Ep 3 |
| `show-friend-behind` · opponent behind | Your result against Bo; "Bo hasn't watched Ep 4 yet" | per the week | |
| `show-quiet` · a quiet night | Last week line "Ep 4 · Counted for nobody: no points scored · record unchanged"; the grid's square for it a dash with the same words in its key | per the week | |
| `show-playoffs` · the final next | "The final · Ep 7"; Bo (1) vs Di (2) with seeds; for someone out: "You missed the playoffs · 3rd · 1–2–3" | Set your lineup only for those still playing; others none | The grid with the playoff line; out of the playoffs said as such, never OUT |
| `show-champion` · the season over | "Di won the season"; the final's score; your finish "You finished 3rd · 1–2–3" | none | Final standings, the champion first and why (won the final) |
| `show-long-names` | Names wrap to two lines in the card; never truncated where they identify a side | per the week | |
| `show-solo` · solo, points | No opponent: "Ep 4 · 12 points so far, best week 6"; your starters | **Set your lineup** | Your season as a chart; no "1st of 1" |
| `xw-waivers-open` · a loss to replace | "Blake went home. You're owed a replacement"; Ep 5 vs Bo beside it; "Bo has a claim in" (never what) | **Replace Blake** · claims close Sun 10:57 AM | Your team with Blake "Out · Ep 4"; anything unclaimed is filled when the week closes (the waivers screen says it) |
| `xw-claims-in` · claims in, waiting | "Your claim is in: Rowan first, then Quinn"; "Claims run Sun 10:57 AM" | none (Change claim is plain) | |
| `xw-waivers-run` · ran when you claimed | "You got Quinn. Rowan went to Bo, ahead of you in the order"; "It ran as soon as everyone owed one had claimed" | **Set your lineup** | Your team with Quinn new |
| `staged-before-merge` | Stage line: "Before the merge" (now) · "Merged" (with the merge: a new draft, a fresh record); this stage's matchup and records | **Set your lineup** (the stage's: never "All set" while a stage has a move) | The stage's season; the overall as one line "Overall: 4th · 5 pts (points from both stages)" opening the overall table |
| `staged-merged` | "Before the merge: final · you went 1–2"; the merged stage's first matchup at 0–0 | the merged stage's move (its draft or lineup) | The merged stage's season; the first stage's table one tap away |
| `staged-champion` | The merged stage's champion; the overall winner, and that it can differ (points, not wins) | none | The overall table; each stage's table one tap away |

## The matchup sheet (B, one tap in)

Opened from This week's card, the Last week line, or a grid square. One week, two lineups:

1. The week (‹ Ep 4 ›, swiping or arrows to the next and last week played), the result or state, each side's total.
2. Both lineups on one shared signed points scale (data round 3, B): each starter a face, a name, the points as a bar from zero
   (negatives to the left), and the top reasons ("Won immunity +2"). A sport adds position, team and opponent on each row.
3. Bench, didn't count: collapsed, the same scale.
4. Side bets' points for that week, when any.
5. The foot: "Through Ep 4" (your mark), quiet.

Before the lock the opponent's side reads "Shows when it locks" and the sheet shows yours alone. Before you've watched an
episode, the sheet stops at your mark: a week you haven't seen offers Reveal instead of a score. A face opens the cast sheet over
it; Back returns to the same week and the same scroll.

## Side bets: posting, calling, settling

The side bets sheet, for one episode (the move's, or the one just played until it's settled):

- **Open bets**, each: the question, its worth ("2 pts"), who posted it, how many have called it, and your call (chips for who or
  yes/no, words otherwise) with Save. A call can be changed until the episode airs.
- **Post a side bet** (anyone playing): the question, its worth (1, 2, 3 or 5; anything else typed), Post. It lands for everyone
  with a push ("Bo posted a side bet for Ep 4"). Whoever posted it can take it down until two people have called it.
- **After the lock**: everyone's calls show beside the question.
- **After the episode**, for whoever runs the game: **Settle**: tap what happened among the calls made (or type it); each matching
  call is marked right, the rest wrong, one confirm. A call can be re-marked by tapping it. Everyone else sees "Waiting to be
  settled" until then.
- **Settled**: who called it, the points each got; a bet with fewer than two calls pays nothing and says so.

## The flows and their return paths

| Flow | From | Steps | Returns to |
| --- | --- | --- | --- |
| Set your lineup | This week's move | Your moves opens on this game's tab; tap starters; Save | The page, same scroll; the card says "You're set" |
| Look at a week | This week, Last week, a square | The matchup sheet; a face; Back | The same week in the sheet; closing returns to the page |
| Replace a player (exclusive) | This week's move | The waivers screen: free agents, rank claims, Save | The page; the card says "Your claim is in" |
| Reveal | This week's move when behind | The reveal (every game) | The page at your new mark |
| Post a side bet | The side bets row | The sheet; Post a side bet; question, worth, Post | The sheet with it listed; the row's count goes up |
| Settle | The side bets row (whoever runs it) | Settle on a bet; tap what happened; confirm | The sheet, settled; the row says settled |
| A stage | The stage line | That stage's page (a game of its own) | Back to the overall page |

An unsaved choice survives a trip to a deeper sheet and back (a lineup half set, a side bet half typed); closing the sheet or
leaving the page discards it.

## The five lenses

- **Own pace**: every number stops at your mark; an opponent behind is said on the card ("Bo hasn't watched Ep 4 yet"); your
  waits are said up front (a draft or waiver week that waits for everyone).
- **A shared draft**: nothing about scarcity; the roster doesn't say who else has a castaway.
- **An exclusive draft**: Your team says yours alone; a loss is a move (Replace Blake); someone else's claim shows as "has a claim
  in", never what; the order that decided a claim is said once, after it ran.
- **Stages**: the stage line under the bar; the overall page leads with the stage being played now; a stage's move is the overall's
  move.
- **Spoilers**: nothing past your mark at any layer; an opponent's lineup and others' side-bet calls show at the lock; results
  only once you've watched (a show) or as they come (a live sport, unless you hide scores).

## The sports check: the NFL's real-size pool

The same parts at nine starters and 344 players:

- This week: "Week 3" not "Ep 3"; the lock is the week's first kickoff, said once.
- The matchup sheet: nine rows a side with position, team and opponent; the shared scale holds at 9 against 9.
- Your team: fifteen players grouped by position, a face where the league has one, else the team's mark; never letter tiles at
  this size.
- Side bets: the same; "Will the Bills score 30?" is a yes or no.
- No spoiler banner: "results show as they come" is said once, in the progress control's place.

## Open questions

- Should others' calls on a side bet show before the episode airs?
- When the bot's research has an answer for a side bet, should Settle offer it first?
