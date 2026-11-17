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
- "Episode N" is a door in one person sheet (game-sheets.tsx EpisodeBlock) and plain text in the lineup sheet. One door since
  step 3.
- The episode page (`?page=epN`) is a pushed page on the Episodes tab only, under every sheet (z 70 against a sheet's 81), so no
  sheet can open it today; an episode level that works over sheets is a structural question for the next pass. Settled in step 3:
  the night, the page's own body, comes up as a level.
- The castaway sheet's header differs by the way in (noticed in step 2b): the draft's and waivers' own sheets put the tribe under
  the name ("Jelly", "Blue"); a level of the drill (a move's castaway, Tonight, the episode page) puts the show and how far it's
  seen ("Rob", "Survivor · up to Ep 3") under the crumb. The body is the same part. One header for every way in, the crumb only
  where there's a path behind it, is for the polish after the drill pass.

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

## Step 2a done: castaways on Tonight and the episode page (2026-11-17)

| Where | Who taps it, wanting what | Verdict |
| --- | --- | --- |
| Tonight's Last time: who left (tonight.tsx LastTime) | Joanna: who's that, how did they go? | **Door**: the castaway's sheet; the plate ends in › |
| Tonight's Who scored rows (tonight.tsx Ledger) | Andrew: why did Eric score 1? | **Door**: the castaway's sheet, that game first and open |
| An episode's page: who left (episodes.tsx EpisodeBody) | As Last time | **Door**: the castaway's sheet |
| The same page's What happened | Who won it? | **Door** for a person (the sheet finds them by first name when only one has it); **stays** for a tribe, a group's label (the face wall is grouped by it) |
| The same page's best this episode | Why did Jenna score 4.5? | **Door**: the castaway's sheet, that game first and open |

## Step 2b done: the draft room and waivers (2026-11-17)

| Where | Who taps it, wanting what | Verdict |
| --- | --- | --- |
| The room's taken tiles, with Show taken on (draft.tsx WallTile) | Conor: who did sam take, and are they any good? | **Door**: the castaway's sheet, read-only, its foot saying who has them ("Taken by sam", "On your team"); the tile was disabled |
| Your slots under the clock (YourSlots) | Andrew: who have I got so far? | **Door**: the castaway's sheet ("On your team") |
| The Picks board's cells (PicksRow), in the room and once the draft is done | Who went where; is riley's pick any good? | **Door**: the castaway's sheet ("Taken by riley" in the room, "On riley's team" when it's done) |
| The Picks board's seat heads | That person's team | **Stays**: the column under the head is their team |
| The clock's face and name (ClockCard), the order before the start (OrderList) | Who's up, who's next? | **Stays**: the clock says it in a sentence, and a person's picks are their column on the Picks board |
| Your queue's rows | Look again before drafting from your list | **Door**: the face and name open the sheet, Queue and Draft at its foot when you're up; the row's own Draft keeps its one tap |
| The blind draft's slots (BlindRoom) | Who did I pick; should I swap them out? | **Door**: the sheet with Take them out at its foot, as the wall's tiles already open it with Add; a tap on a slot took them out at once before |
| The blind draft's reveal (BlindReveal) | | **Stays**: a moment that plays once; the same teams are doors on the Picks board after it |
| Waivers' spot plate (SpotPlate: who's out, who comes in) | Sam: is Jelly really gone; who's my pick again? | **Door**: the castaway's sheet, Swap at its foot only for someone on your team who can still be swapped |
| The claim picker's rows (PickSheet) | Conor: look before claiming | **Door on the photo**: their sheet over the picker, the row's tap at its foot (Pick, Add as a backup, Take out), then back on the picker to save; the rest of the row keeps selecting, so a pick and its backups in order stay one tap each |
| Everyone's moves; a quiet week's Last time (MovesList) | Who did Kim get, and what's Kim's team now? | **Door**: the castaway someone got opens their sheet in the game; the person opens their season in the game |
| The run's slides (WaiverRunScreen's Everyone's moves) | | **Stays**: a moment told in slides; the same moves are doors on the waivers page after it |
| Waivers' picking order (Order) | Who picks ahead of me? | **Stays**: the line answers it; a person's team isn't what it's for |

Checked by `check-drill-doors.js`'s draft and waivers sets on their own fixtures (draft-fixture.js mid-draft with alex up, then
with every pick in; waivers-fixture.js open, processed and idle as Sam), each door with its back, and the picker's Pick choosing
the row without saving: 24 pass. The whole check: 41 pass, 3 skipped (the test couch has no head to head, no due final result
and no person in Episode 5's What happened).

## Step 3 done: episodes (2026-11-17)

**An episode over a sheet.** A sheet can't open the Episodes tab's page (a pushed page sits under every sheet), so the episode
comes up as a level of its own: the night, the page's own body (`episodes.tsx` EpisodeNight, one part, which the page renders too)
in a sheet over whatever's open, ‹ › through the episodes you've seen, back one level at a time. Its jumps (a game's line, Discuss,
Replay) leave the sheets, as any jump from a sheet does (sheet-history.ts: a push to another page takes the sheets' entries). A
game's episode stays that game's own level (everyone's plays that night). The body loads when a night first opens (next/dynamic):
imported outright, the Episodes tab's imports loop back to game-sheets.tsx, and games.tsx read one of its exports before it was set
(the hub's rankings broke on it; games.tsx now reads it when called).

| Where | Who taps it, wanting what | Verdict |
| --- | --- | --- |
| A castaway's story, each "Episode N" (cast.tsx StoryBody) | Joanna: she was voted out in Ep 4; what happened? | **Door**: the night, over their sheet; the heading ends in › |
| The castaway sheet's status ("Out · Ep 4 · Voted out", "Sole Survivor · Ep 13") | The night they left | **Door**: the night; the status ends in › |
| The castaway sheet's other charts: a game's weeks (In the couch's games, opened) and a stat's strip (Their numbers, opened) | Why did she score 4 in Ep 3? | **Door, in place**: that episode of their story, as the season chart's columns already did |
| A person's season in a lineup game (game-week.tsx PersonSeason): a week's heading | Andrew: my lineup that week | **Door, in place**: the lineup above turns to that week and comes into view, the week shown lit; head to head, the heading is part of that week's matchup door |
| The same table's numbers, and the game table's (GameTable) | Why did Jenna score 4 that week? | **Door**: the castaway's sheet at that episode of their story; the game table's headings keep sorting (that table's job) |
| A compare's chart and its table (CompareBody: a matchup's pair, a castaway's Compare with… in a game) | How did they do that week? | **Door, in place**: the heads read that week; a head then opens that castaway at it |
| A matchup's "Best lineup … Jenna for Kyle" | Would Jenna really have been better? | **Door**: the two side by side that week; the line ends in › |
| The lineup sheet's title for a played week (row 8) | Everyone's lineups that week | **Door**: the game's episode level, as every other game's title already was; a week still to play **stays** (nothing to see yet) |
| Chat's landmark for an episode you've seen | Joanna, mid-chat: who went home in Ep 5? | **Door**: the episode's page (a jump: its back says Chat, its Discuss comes back); one not seen stays a divider |

**Stays**, from a sweep of every episode named on a player's screen:
- A sheet's own title (the game's episode level, a matchup's week) and a task sheet's title or line (Call it · Episode 6, Fill in
  Episode 5, the bets' and questions' subtitles, Something wrong in Episode 4?): the episode says what the sheet is for, and a door
  there would pull you off the task.
- An episode not yet aired, on air or not yet seen (Tonight's Next and On tonight, the Episodes tab's next, waiting and
  still-to-air rows, a lineup's week to come, a grid's or strip's next column): nothing to open before it's yours to see.
- A section's title whose rows are doors (Tonight's Last time, which ends in "Ep 5 recap ›"; the game page's week games; Tonight's
  After the episode, whose plate is the reveal).
- Moments that play once (the reveal, a watch-along, the waiver run's slides; a tap moves them on) and marks or ranges (Up to
  Episode 7, Episodes 1–7, Thru Ep 5): a mark is where someone is, not an episode.
- The Games tab's "Ep 6 · vs Max" inside a game's row, which opens the game page (as "3 behind riley").

Left for step 4: the hub's Previously on (its episode rows open the Episodes list, not the episode; the story so far's faces) and a
sport's game log ("Ep 4 · vs DAL").

Checked by `check-drill-doors.js`'s couch set, each door with its back (a change in place: nothing opened, and one back still
takes the sheet it's in): 16 pass, a matchup's best lineup skipped (no head to head on the test couch). The whole check, all three
fixtures: 57 pass, 4 skipped.

## Step 4a done: the hub (2026-11-17)

| Where | Who taps it, wanting what | Verdict |
| --- | --- | --- |
| The bands' faces on the ruler (bands.tsx) | Where's Andrew up to? | **Stays**: the band's tap is the show, and its faces are 24 px marks on a ruler, overlapping, so a door there would steal the band's tap and miss as often as it hit; where they are is the face's place on the ruler, and their sheet is a tap away in the show's Where everyone is and the hub's On the couch |
| The profile's place on the couch | How do I stand? | **Door**: the Power rankings; a page can't open over a sheet, so the sheet closes in the same tap and back lands on Home |
| The profile's best finish | That game | **Door**: the game's page |
| The profile's Called it | Who called more than me? | **Door**: By the numbers (Called it most) |
| The profile's figures (Titles, Couch points, Seasons played) | | **Stays**: the rows under them open where each is compared |
| A row with nothing behind it (Settings' Signed in as and email) | | Now a plain row, not a button that did nothing (ui/parts.tsx Row) |
| Previously on: Last time, The story so far's faces, Still in | Joanna: who's that again? | **Door**: their sheet over the page, through the show's own drill (useShow, loaded with the page) |
| Previously on: Last time when nobody left, Episode by episode | What happened that night? | **Door**: the night over the page (they opened the Episodes list, not the episode they name) |

Checked by `check-drill-doors.js`'s couch set: the profile's place and Called it (the page up, the sheet gone, back on Home) and
Previously on's four doors with their backs pass; the best finish is skipped (nobody's season has ended on the test couch).

## The phone's back through the doors (the user, 2026-11-17: "consistent and natural throughout the app")

One rule, from `src/new/ui/sheet-history.ts`: each level that opens over the page is a sheet with its own history entry, so the
phone's back takes down the top level alone and lands where you were, as you left it; a level over a level steps down one at a
time (a caller's sheet, then Side bets, then the game page); a sheet closed by its ×, a swipe or a tap outside takes its entry
with it, so the next back is never a dead press; a pushed page (an episode's, Power rankings) closes after the sheets over it. A
row that opens in place (Their numbers' episodes, a game's weeks, Who scored) isn't a level: back doesn't fold it, it takes the
sheet it's in. `check-drill-doors.js` presses back after every door (one level each, the page still there; twice where a sheet
sits under the door's), and `check-sheet-back.js` covers sheets in general. Noticed: that check's TV guide case is stale since
the hub's step 7 redesign (it waits for a guide sheet the card no longer opens that way); BACKLOG 98.

## Recommended order for the next pass

1. People in games: the matchup heads, the standings-shaped lists and chat's avatars open a person (rows 1, 4, 10): one door kind
   that exists already (`person` with `game`).
2. Castaways wherever they appear: Tonight's Who scored, the episode page, the draft room, waivers' picker (rows 2, 3, 5, 6): the
   one castaway sheet, with the surface's action at its foot where it has one (Draft, Pick). Done (steps 2a and 2b).
3. Episodes: decide how an episode level opens over a sheet, then charts, tables and headers (rows 7, 8). Done (step 3).
4. The hub and sports (rows 9, 11).
