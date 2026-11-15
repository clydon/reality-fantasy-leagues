# Players / Cast: page spec (step 5, competition shows first)

## The job

**Cast** is who's in the show and what they've done in it: the show's own facts, never one game's points unless a game is
chosen (Phase 0 decision 6; the user, 2026-11-15: "the main show's tab shouldn't have scoring from a particular game"). It
answers, in this order: who's still in and who's left (the boot story, by tribe); what has each of them done (the show's numbers,
compared on one table); and, for anyone you tap, their season episode by episode, drawn week by week.

People: Joanna opens it to put a face to a name she heard in the episode ("who's Jelly again?"); Andrew glances at who's left;
Conor sorts the table by immunity wins, opens two people side by side, and switches the table to his Weekly Lineup's points before
setting his lineup.

Ways in: the tab bar ("Castaways", "Players", "Cast"); a face anywhere on the show (the episode page's OUT plate, Tonight's Last
time) opens the same person sheet; the stats page's `?rank=` opens the table sorted by that stat.

## The three lenses, and where each lives

| Lens | Holds | Where |
| --- | --- | --- |
| **The show** (this round) | Still in, out and how, tribe; each stat the rulebook records, as counts ("Won the Immunity challenge 2") | The tab, by default |
| **A game** | That game's points each week, who holds each person, Free | The tab once a game is chosen: the game's scoring table from step 2c (GameTable), the same part as the game page's "Everyone in this game" |
| **The matchup** | Two sides' players on one scale | The game page only (step 2c) |

A game is chosen with a **Counted by** control at the head of the numbers: "The show" first, then each game you play that counts
people week by week (a lineup, best ball). Choosing one never changes the faces above it.

## Cast, top to bottom (a competition show)

| # | Block | Holds | Opens |
| --- | --- | --- | --- |
| 1 | **The show bar, compact** | as on every tab (step 4) | Where you are; the reveal |
| 2 | **The strip** | as on every tab | Your moves |
| 3 | **Still in, by tribe** | Each tribe's name in its colour and its count; its faces, a name each. No points, no "Your team" | The person sheet |
| 4 | **Out** | Newest out first: each face dimmed, "Ep 5 · Voted out" (and a revealed role) | The person sheet |
| 5 | **The numbers** | Counted by (The show / each game); the episode range; the one pattern the server found ("0 of 4 voted out had received votes before", a tap sorts by it); then the table: a row per person (face, name, out dimmed), a column per stat the show has recorded, counts, a tap on a column sorts by it; Compare two | A row: the person sheet. With a game chosen: step 2c's game table in place |
| 6 | Under it | How it scores (the rulebook), Something wrong | |

Removed: the Faces / Rank / By episode switch (one page now: faces, then the table); "Points as Weekly Lineup counts them"
(the game lens says it by being chosen); the points heatmap (By episode is the game lens's week columns, and the person's chart);
"Beside it" (the table shows every stat at once); Share as a button (the table's range link stays in the person sheet's menu).

## The person sheet (one sheet, Phase 0 decision 9)

From Cast it opens at the show; from a game page at that game (step 2b's cast sheet, unchanged). Top to bottom:

| # | Block | Holds |
| --- | --- | --- |
| 1 | **Who** | Photo, full name, tribe tag in its colour, "Still in" or "Out · Ep 5 · Voted out", a revealed role |
| 2 | **Each episode** (the weekly graph) | One column per episode up to your mark: what they did, stacked by kind (their three most frequent, then the rest), as counts; the episode they left marked; a key under it |
| 3 | **Their numbers** | Each stat they have, its count, and where that puts them in the cast ("most of anyone", "2nd of 14") |
| 4 | **In your games** | One row per game where someone on the couch holds or picked them: the game's name and who ("On your team and Riley's"); a tap opens their sheet in that game (its points, step 2b) |
| 5 | **Their story** | Episode by episode, newest first: what was recorded, no points; "1 source" and Something wrong as today |
| 6 | **Compare** | "Compare with…": pick a second face; the two side by side on every stat and one chart of both |

## By situation

| Situation | Still in / Out | The numbers | The sheet |
| --- | --- | --- | --- |
| caught up, a game on the couch (Alex) | 3 tribes, 5 out | Counted by: The show · Lineup League; the show's 17 stats | the show; In your games: Lineup League, Outlast |
| watching only (Riley, Traitors) | still in, out; roles only once they've left | The show only (no chooser) | the show; no In your games |
| nothing counted yet (Ep 1 not seen) | the faces alone | "Their numbers fill in as you watch, never past the episode you're on" | who, and their story's empty line |
| behind, at your own pace | everything stops at your mark | to your mark | to your mark |
| exclusive draft and waivers | as above | the game lens shows who holds each, and Free | In your games: one holder |
| stages | as above | Counted by lists each stage's game | one row per stage game |

**A sport (the short check, at 344 athletes).** Faces don't scale (Phase 0's flavor table): the same page is a list. Search and
positions first (All, QB, RB, WR, TE, K, DEF), then rows by team (face, name, position, the season's line "so far" from the box
scores), 40 at a time with Show more; nobody is "Still in". Counted by and the person sheet are the same parts: the athlete's
sheet draws their games week by week (the AthleteChart) over their game log.

## The drill tree

| Level | Questions brought to it | Holds today | Verdict |
| --- | --- | --- | --- |
| Cast | Who's left; who's doing what | Three modes, a slider and a dropdown before the first face; a game's points on every tile (Riley, watching, sees "3 pts") | **Restructure**: faces first with the show's facts, then one table; a game only when chosen |
| Faces | Who is that; still in? | 3-wide photo tiles, points, "Your team" | **Repaint**: names and out lines; no points or team tags |
| Rank | Who's done the most of X | One stat at a time, a second "beside it", points by default | **New display**: one table, every stat a column, sorted by a tap |
| By episode | When did they score | A points heatmap (one game's points) | **Restructure**: the game lens's week columns; the person's chart |
| A cast member | Their season; how they compare | A text story with points per moment | **New display**: the weekly graph of what they did, their numbers ranked, In your games, the story without points |
| Compare two | Who's better at X | Two columns of numbers | **Keep**, opened from the sheet; one chart of both added |
| The game lens | Who scores in my game | The game page's table only | **Keep** (step 2c), reached from Cast too |
| A sport's players | Find a player; how's he doing | 344 photo tiles, no search | **Restructure**: search, positions, rows |

## Spoilers

Every count and every chart stops at the viewer's mark (the server counts to it). A secret role shows only on someone who has
left by then. The game lens is the viewer's own copy of that game. The faces' groups are the tribes as far as you've seen.

## Open questions

- "Your team" on a face in the show lens: the tags go (a team is a game's, and two games can hold different teams); is a quiet
  "yours" wanted back on the faces?
