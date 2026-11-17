# The castaway sheet, one part, and its doors: page spec

## The job

One sheet for a person in the show (a castaway, a cast member, an athlete), the same wherever they're tapped: who they are,
what they did each episode, where they rank on each thing they've done, what they are in your games, and their story. It opens
at the context you came from (Phase 0 decision 9): the show's own facts from the show's tabs, a game's points from inside that
game. The context is named on the sheet ("Counted by") and can be changed there. Every number, face, episode and game on it opens
the next level down, and the level you came from is one tap back.

People: Joanna opens it to put a face to a name ("who's Jelly again?") and needs it to look like the same thing every time; Andrew
taps a castaway on his team to see if she's scoring; Conor sees "2nd in Zero votes at Tribal Council", taps it to see who's 1st,
and whether that one is free in his game.

Ways in: the Cast tab (the face wall, The numbers, The numbers counted by a game); a game page (Your team, Everyone in this game,
a matchup's lines, the compare's faces); the draft room and waivers (their sheets carry Draft, Queue or Swap at the foot); the stat
board (below); the stats page's and Tonight's Stats card's rows.

## Why the two sheets differ today

They were built in different steps and never merged: the game's castaway sheet in step 2b (`game-sheets.tsx` CastBody), the Cast
tab's in step 5 (`cast.tsx` PersonBody). Step 5's spec says "from a game page at that game (step 2b's cast sheet, unchanged)" and
its story lists the ripple as open ([step5-cast-spec.md](step5-cast-spec.md), "The person sheet"; HANDOFF step 5, "Found, not
fixed").

| Block | From the Cast tab | From a game | Change |
| --- | --- | --- | --- |
| Subtitle | "ZT Survivor · up to Ep 5" | "ZT Survivor · up to Episode 5" | one wording, the show's `ep` |
| Photo | 76 × 96 | none | the photo in both |
| Group | a dot and the name, muted | a filled tag in the tribe's colour (gold for Toka) | the dot and the name in both |
| Chart | moments each episode, counts by kind | points each episode, only where the stats' points are that game's (none in Weekly Lineup on the zt couch) | one chart part, its measure the lens's |
| Their numbers | each stat, its count and rank | none | in both |
| Games | In your games: a row a game; a tap opens a second, different sheet | In this game: the couch's holders with what each got | one section, In your games, its rows opening in place |
| Story | the show's facts, no points | the stats' points, whichever game they're from (Outlast's sheet shows Weekly Lineup's) | points only in a game's lens, and only that game's |
| Compare | Compare with… (picking on the wall) | none | in both, through one picker |

## The sheet, top to bottom (a competition show)

| # | Block | The show's lens | A game's lens | Opens |
| --- | --- | --- | --- | --- |
| 1 | **Header** | Full name; "ZT Survivor · up to Ep 5" | the same | the path back over it when it's a level up (the crumb) |
| 2 | **Who** | Photo; group dot and name · the show's properties (gender, a crew's department) or a sport's position; the billed bio line (hometown · age · job); Still in or "Out · Ep 5 · Voted out"; Started on; a revealed role; what they hold now ("Has a tethered idol · given by Kristin Flickinger Ep 7"); the billing's line about them | the same | |
| 3 | **Counted by** | Only when they're in a game you play that counts people week by week: The show, then each such game | the same control, that game chosen; under it one line, "7.5 pts in Weekly Lineup · 3rd of 18" | switches the lens in place |
| 4 | **Each episode** (the chart) | What they did: counts stacked by kind | Their points at the game's scoring, stacked by kind where the season's stats are that game's, else one colour; the weeks they counted for you marked | a column opens that episode in their story |
| 5 | **In your games** | A row per game they're in: the game, who holds or picked them (faces, yours first), their points there | the same rows; the lens's game open | a row opens in place: its holders as rows (and the lens follows a game that counts week by week); a holder opens that person's sheet in that game |
| 6 | **Their numbers** | Each stat they have, its count, where it ranks ("2nd of 18", "Most, tied with 1") | the same: a stat is a fact in every lens | a row opens the stat's board |
| 7 | **Their story** | Newest first: what was recorded, "1 source", Something wrong | the same, each moment's points at this game's scoring when the season's stats are that game's | |
| 8 | **Compare with…** | | | the picker (the face wall in a sheet), then the two side by side: counts in the show's lens, points at the game's scoring in a game's |

A game that doesn't count people week by week (Outlast's boot order, a survival pool's picks) isn't a lens: from its page the
sheet opens at The show with that game's row open in In your games.

## The stat's board (a new level)

| # | Block | Holds | Opens |
| --- | --- | --- | --- |
| 1 | **Header** | The stat's name ("Zero votes at Tribal Council"); "ZT Survivor · up to Ep 5" | the crumb back |
| 2 | **Everyone with it** | Most first, a row each: place (T for a tie), face, first name, position, "Out · Ep 3" dimmed, the count, a bar on one scale; the castaway you came from marked; in a game's lens, who holds each (faces, yours first and ringed) | a row: that castaway's sheet, over the board |
| 3 | **None so far** | Everyone without it, as rows, last | the same |
| 4 | **Foot** | "See it beside every stat": The numbers on the Cast tab, sorted by it (`?rank=`) | the Cast tab |

The stats page's sections and Tonight's Stats card draw the same rows, and each row opens the castaway's sheet.

## By situation

| Situation | The sheet | The board |
| --- | --- | --- |
| caught up, games on the couch (alex) | The show from Cast; Weekly Lineup from its page; In your games: Weekly Lineup, Outlast, Survival Pool | holders in a game's lens |
| from Outlast (an exclusive draft; not a lens) | The show, Outlast's row open: "On riley's team", 6 pts | |
| behind, at your own pace (sam, through Ep 3) | everything stops at sam's mark | ranks at sam's mark |
| watching only (riley on The Traitors) | no Counted by, no In your games; a role only once they've left | the same rows, no holders |
| nothing counted yet (Ep 1 not seen) | who, and "Their numbers fill in as you watch" | no doors (nothing ranked) |
| stages | Counted by lists each stage's game that counts week by week | |
| a sport (the short check) | the same order: who (headshot, team · position, the season's line), Counted by, Game by game (the AthleteChart), In your games, the season's games, Past seasons | waits: an athlete's season isn't summed per stat yet |

## The drill tree

| Level | Reached from | The casual question | The sweat's question | Data held | Today | Verdict |
| --- | --- | --- | --- | --- | --- | --- |
| A castaway, the show's lens | the Cast tab, the stat board | Who is that, still in? | What have they done, how do they rank? | SeasonStats: `cast[]`, `stats[]`, `events`, `counts` | step 5's sheet | **Restructure** into the one part |
| A castaway, a game's lens | a game page | Are they scoring for me? | What do they score on, week by week; who's had them? | GameView: `cast[].points`, `castWeeks`, `table[].weeks`; SeasonStats when its points are the game's | step 2b's sheet, no photo, chart or numbers | **Restructure**: the same part, the game as its lens |
| Counted by | the sheet | Why are there points here? | Switch my game | the games that count people week by week | the Cast tab's numbers only | **New display**, the Cast tab's control reused |
| Each episode | the sheet | When did they do things? | Their weeks, by kind | `events`, `perEp`, `castWeeks` | two charts, two colour rules | **Repaint**: one chart part, two measures, the season's colour per stat in both |
| An episode of theirs | a chart column | What happened to them that night? | | `events` by episode | a column isn't a door | **New door**: the column opens that episode in their story |
| In your games | the sheet | Is she on my team? | Who holds her, what did each get? | `team`, `weeks[].started`, picks | two forms (rows to a second sheet; holders) | **Restructure**: one section; rows open in place |
| A stat of theirs | Their numbers | Is 1 a lot? | Who's 1st; are they free in my game? | `counts` for everyone | rows aren't doors | **New screen**: the stat's board |
| Two side by side | Compare with… | | Who's better at X? | both lenses' compares | the Cast tab only, picking on the wall | **Restructure**: one picker, in every context |
| Their story | the sheet | What happened? | | `events`, `unsure` | two point rules | **Keep** the form (approved in step 5); one point rule |
| An athlete | a sport's list, a game | How's he doing? | His lines game by game | the game log, past seasons | two sheets (AthleteBody, CastBody's sport branch) | **Restructure** into the same order; the numbers rows wait |

## Return paths

Each level is a sheet over the last. The crumb names the path ("Jelly › Zero votes at Tribal Council ›"), each part a way back.
The phone's back takes the top level down, and Close closes them all. A lens change stays in place and doesn't add a step back. The
board opens with the castaway you came from in view.

## Spoilers

Every count, rank, chart and board stops at the viewer's mark (the server counts to it). A game's lens reads the viewer's own copy
of that game. A secret role shows only on someone who has left by then.

## Left out, and why

- **A stat's points in Their numbers**: the chart and the story carry the game's points; the numbers stay facts in every lens.
- **An episode's page from the sheet**: the episode page is a pushed page on the Episodes tab, under every sheet; the sheet's own
  episode level is the person's story. The app-wide drill pass takes it.
- **A group as a door**: the face wall is grouped by it.
- **A sport's numbers board**: an athlete's season isn't summed per stat on the read (the roster read has the line as words).

## Open questions

- Is the lens wanted on the sheet itself (Counted by switches it in place), or should a game's points live only in that game's
  row under In your games, with the chart always the show's moments?
