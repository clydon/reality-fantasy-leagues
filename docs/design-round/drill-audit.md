# Drill-downs across the app: doors and dead ends (2026-11-16)

The user, 2026-11-16: "we need almost everything to be able to be drilled down; you click into a player and see they are 2nd in
never having someone vote them, but you'd want/expect tapping into that to see a castaway list sorted by never having someone
vote against them". PRODUCT.md principle 12 says the same: a person, cast member, athlete, team, game, score or result on an
overview opens its deeper context directly, and the way back keeps where you were.

**The rule.** Every name, face, number, rank and episode on screen opens the level it names, the same way everywhere: a row that
opens a level ends in a quiet right chevron, a row that opens in place ends in a down chevron, and a row with neither opens
nothing. A castaway always opens the one castaway sheet (`cast-sheet.tsx`), a rank or a stat always opens its board, and every
level is a sheet over the last with the crumb and Back (`game-sheets.tsx` DrillSheets).

**Every cast photo opens their sheet** (the user, 2026-11-17). Where a tap on the photo is already the screen's action (picking in
the draft, a swap in the lineup editor, choosing in Compare's picker or the waivers' picker), the action wins, and the sheet is
reached one of two ways, decided per surface: the photo opens the sheet with the action at its foot (the draft's way: the sheet
carries Draft), or, where speed matters, the photo keeps its action and the row's name opens the sheet.

**Each dead end gets a verdict, not a door by default** (the user, 2026-11-17: "honestly judge if the dead end should be there or
if there's a genuine use case for opening something"). For every row below, the pass names who would tap it and what they'd want
there; it becomes a door only if that answer is real, and otherwise it stays a dead end with that reason written beside it (a door
can add noise, or steal a tap from the surface's own job). Most will want a door; the verdict is still made for each.

## Done in the person-sheet round

- The castaway sheet is one part from every way in (the Cast tab, a game page, the draft room, waivers, the stats page, Tonight's
  Stats card), at the lens you came from (Counted by The show or a game).
- Their numbers: each stat opens its board (everyone ranked, the castaway you came from framed, holders in a game's lens).
- The board's rows, the stats page's rows and Tonight's Stats card's two mini boards open the castaway's sheet.
- A chart column opens that episode in their story; In your games opens in place to the holders, each opening that person's sheet
  in that game; Compare with… opens a picker (the face wall) then the two side by side, in the lens.

## Dead ends left, most likely to be tapped first

From a read-only sweep of `src/new` (file:line as of ff043c48 plus the round's changes; recheck before building).

| # | Surface | What's shown but opens nothing | Where | Should open |
| --- | --- | --- | --- | --- |
| 1 | Matchup sheet | Both heads: the opponent's face, name, record, total; the result square | game-week.tsx ~619-641 | That person's sheet in the game |
| 2 | Tonight's Who scored | Ledger rows: castaway face, name, why, signed bar, points | tonight.tsx ~586-610 | The castaway's sheet (the same rows are doors in the lineup sheet) |
| 3 | Episode page | The Out plate; What happened's winners; "Weekly Lineup's best this episode" | episodes.tsx ~524-585; tonight.tsx ~312-321 (Last time's Out plate) | The castaway's sheet |
| 4 | Standings-shaped lists | The morning sheet's standings; the couch's Rankings and Head to head; "3 behind riley" on the Games tab | reveal.tsx ~989-1008; couch-pages.tsx ~228-352; games.tsx ~346-352 | The person's sheet (in that game), or the couch person sheet |
| 5 | Draft room | Picks board cells and seat heads; your slots; taken tiles (disabled); queue rows; the clock's names | draft.tsx ~260, 480-516, 681, 691-702, 866-872 | The castaway's sheet (taken tiles too, read-only); a seat opens their team |
| 6 | Waivers | Picker rows only select (no way to look before claiming); Everyone's moves; the spot plate's faces | waivers.tsx ~554-567, 849-856, 964-993 | The castaway's sheet with Claim at its foot (as the draft's sheet carries Draft) |
| 7 | Charts and tables | Bars and axes in the compare chart, GameTable cells, PersonSeason cells, the matchup's best-lineup line | game-week.tsx ~1283-1333, 1456-1464, 963-990, 670-686 | That episode (the person's at that week; a cell, that castaway at that week) |
| 8 | Episode headers | The lineup sheet's week title "Episode N" (a door in other games' person sheets) | lineup-sheet.tsx ~253 | The game's episode sheet |
| 9 | The hub | Bands' faces (step 7's known gap); profile rows that are buttons with no handler ("2nd on the couch", "Best finish", "Called it") | bands.tsx ~177; profile.tsx ~58-66 | The person's sheet; each row its game or the calls |
| 10 | Chat and the bets sheet | Sender avatars; side-bet callers | chat.tsx ~332; game-week.tsx ~369-373 | The couch person sheet |
| 11 | Sports | A sport's Players tab before it's a game; team headings; past seasons rows | roster.tsx ~139-161; cast.tsx team headings | The athlete's sheet; a team opens its schedule (sports/team.tsx) |

Inconsistencies found on the way:
- "In your games" opened the game's cast sheet on the Cast tab but the game page from the draft room and waivers: one behaviour
  now (the row opens in place).
- "Episode N" is a door in one person sheet (game-sheets.tsx EpisodeBlock) and plain text in the lineup sheet.
- The episode page (`?page=epN`) is a pushed page on the Episodes tab only, under every sheet (z 70 against a sheet's 81), so no
  sheet can open it today; an episode level that works over sheets is a structural question for the next pass.

## Step 1 done: people in games (2026-11-17, the user: "continue")

Each dead end in rows 1, 4 and 10, with its verdict:

| Where | Who taps it, wanting what | Verdict |
| --- | --- | --- |
| A matchup's two heads (game-week.tsx MatchupBody) | Andrew: who am I playing? Conor: their season and team | **Door**: that person's sheet in the game, at that week |
| Side bets' callers (game-week.tsx Calls) | Who called it, and how they're doing | **Door**: that person's sheet in the game |
| The morning sheet's standings (reveal.tsx MorningSheet) | After the final results: riley passed me, what did riley's week look like? | **Door**: that person's sheet in the game, at that episode, over the morning sheet (useGameDrill); the row ends in › |
| The couch's Power rankings and Head to head (couch-pages.tsx) | Who's this, where are they up to, what do they play? | **Door**: the couch person sheet; the rows end in › |
| Chat's faces (chat.tsx) | Joanna: where's Andrew up to? | **Door**: the couch person sheet (the bubble keeps its own tap) |
| "3 behind riley" on the Games tab (games.tsx) | Riley, in that game | **Stays**: the phrase sits inside the game's row, whose tap opens the game page, where riley's row is one tap away; a door inside a door would steal the row's tap |

Checked by `scripts/dev-test/check-drill-doors.js` on the test couch (chat face, rankings row, head to head row, side bet caller:
each opens its sheet; matchup heads and the morning sheet need a head-to-head game and a due final result, which the test couch
doesn't have, so they're skipped there).

## Recommended order for the next pass

1. People in games: the matchup heads, the standings-shaped lists and chat's avatars open a person (rows 1, 4, 10): one door kind
   that exists already (`person` with `game`).
2. Castaways wherever they appear: Tonight's Who scored, the episode page, the draft room, waivers' picker (rows 2, 3, 5, 6): the
   one castaway sheet, with the surface's action at its foot where it has one (Draft, Claim).
3. Episodes: decide how an episode level opens over a sheet, then charts, tables and headers (rows 7, 8).
4. The hub and sports (rows 9, 11).
