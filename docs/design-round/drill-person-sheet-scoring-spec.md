# The castaway sheet, scored by the show: page spec

## The job

One sheet for a person in a show, the same from every way in. Its first read answers "how are they doing?" in the show's own
terms, for someone who only watches as much as for someone who plays: what they did each episode, coloured by what the show's
rulebook says each thing is worth. Below that, for a player, what they're worth in each game; then every kind of thing they've
done, most valuable first, each opening to when it happened and who else has done it.

- **Joanna** (forgets): "Who's Jelly again, and is she doing well?" Her face, still in or out, and a chart that's mostly teal or
  mostly hanging below the line.
- **Andrew** (drives by): "Is she scoring for me?" Her points and place in each of his games, without opening anything.
- **Conor** (tinkers): "She has 4 big moments. When did she get them, who has more, and are they free in my game?" A row opens
  to the episodes it happened in, then the board.

Ways in are unchanged: the Cast tab (the face wall, The numbers), a game page (its team, its cast, a matchup's lines), the draft
room and waivers (their foot carries Draft, Queue or Swap), the stat's board, the stats page's and Tonight's Stats card's rows.

## What a moment is worth

Every kind of moment has the show's points for it, the rulebook's own (Survivor 51, rulebook v3: Won the Immunity challenge +3,
Voted against the majority −0.5). The sheet sorts each kind into one of four bands by those points, measured against the
rulebook's typical moment: the median of the points of every moment it scores, not only those that have happened, so the bands
never move mid-season (src/lib/game/moment-bands.ts):

| Band | Points for one | Drawn |
| --- | --- | --- |
| **Great** | at least 1.5 times the typical moment | the deeper green (Safe Teal on Night), on top of the column |
| **Good** | in between | a lighter green (a mint on Night), over neutral |
| **Neutral** | 0 to half the typical moment (a tight window by design) | a quiet grey, from the line up |
| **Setbacks** | below 0 | Ember, hanging under the line (DESIGN.md: losing points is a down bar) |

- A kind's band is the same in every episode, so every moment of that kind is drawn alike, and its row in Their numbers wears the
  same colour. The key reads the bands top to bottom, as the column stacks them.
- The points are the rulebook's for the moment (the season's, or the couch's own copy of it), not a game's changes to them: a
  game's own points live in that game's row.
- An **amount** (a rulebook moment answered with a number: Below Deck's "Individual charter gratuity share", a judge's score) is
  not a moment: it's never in the chart or the classes. It has its own figure (below).

The classes in the seasons on hand:

| Season | Big | Small | Setbacks | Amounts |
| --- | --- | --- | --- | --- |
| Survivor 51 (to Ep 8) | 5: won immunity, won reward, got an idol, cancelled votes, survived votes | 8: tribe won immunity, zero votes, voted with the majority, 2nd in immunity, went on a journey, chosen for a reward, played an idol, sent to Exile | 2: sat out, voted against the majority | none |
| Survivor 49 (to Ep 13) | 5: won immunity, 2nd in immunity, got an idol, cancelled votes, survived votes | 6: won reward, 3rd in immunity, tribe won immunity, zero votes, voted with the majority, played an idol | 2: sat out, an idol used against them | none |
| The Traitors 5 (to Ep 3) | 1: got a shield | 3: zero votes, survived votes, a Faithful voted out a Faithful | none | none |
| Below Deck (rulebook only) | 1: a romantic development | 5 | 5: complaints, mistakes, safety incidents, reprimands, arguments | the gratuity share |

## The sheet, top to bottom (a competition show)

| # | Block | Holds | Opens |
| --- | --- | --- | --- |
| 1 | **Header** | Full name; "Survivor · up to Ep 7"; the crumb when it's over another level | the way back |
| 2 | **Who** | Unchanged: photo, group swatch and name · properties, the billed bio line, still in or out, started on, a revealed role, what they hold now, the billing's line | |
| 3 | **Their figures** (only with an amount) | Each amount they have by the viewer's mark: their total, its name, their place in the cast, a small strip of it each episode | a figure opens its board |
| 4 | **Each episode** | A column an episode, fitted to the sheet (30 episodes at 390 without scrolling): that episode's moments counted, big ones from the line up, small ones over them, setbacks hanging under; the count over each column (to 14 episodes); the episode they left in live red; a key of the three classes, the same words on every sheet | a column opens that episode in their story |
| 5 | **In the couch's games** (only on a couch) | A row for each of the couch's active games they're in, yours or not (a game that's over by your mark, or archived, drops off): the game's name, their points there, where that places them in that game's cast ("3rd of 18"), who holds or picked them (faces, yours first, one line). A game you don't play is read at your own mark, like any other | a row opens in place: their points there each episode (the game's colour; the weeks they counted for you marked), then its holders, each opening that person in that game |
| 6 | **Their numbers** | Each kind they have, most valuable first (a tie: more of it first): the class mark, the name, its points for one ("+2 each"), the count, where the count ranks ("Most of anyone") | a row opens in place: the season's episodes as a strip, a mark in each it happened (the count where more than one), then a door to the stat's board |
| 7 | **Their story** | Unchanged form, newest first; each moment wears its class mark, so a column's colours can be found in the list it opens | |
| 8 | **Compare with…** | Unchanged | the picker, then the two side by side |

- **Counted by is gone from the sheet.** The chart never changes meaning: it's always the show's moments, classed by the show's
  points. A game's points are in that game's row, which is the selector between games that count differently (each row carries its
  own number, so games that count her the same simply show the same number).
- **The game you came from comes first, opened.** From Weekly Lineup's page the sheet opens with Weekly Lineup's row at the top of
  In your games, showing her points there each episode; from Outlast's page, Outlast's.
- **In the couch's games stays above Their numbers,** so a player's points per game are never under a list of up to fifteen rows.
- **Only the sheet asks for the couch's other games.** The games read sends them on request, read at your mark, so Tonight, the
  Games tab and every move stay about your own games.

## The stat's board

Unchanged in form (place, face, name, count, a bar on one scale, holders in a game, those without it last); its bar wears the
kind's class colour. The stats page's and Tonight's rows draw the same row, so they wear it too. An amount's board ranks the same
way, its totals on one scale.

## By situation

| Situation | The sheet |
| --- | --- |
| watching only (riley on The Traitors; anyone with no game here) | Who, the chart and its key, Their numbers, the story: no In your games, nothing missing from the read |
| a player from the Cast tab (alex) | the same, In your games under the chart: Weekly Lineup, Outlast, Survival Pool, each with her points and place; none open |
| a player from a game page | that game's row first and open |
| from Outlast's page (an exclusive draft) | Outlast's row first and open: "On riley's team", her points there |
| a pick game (Survival Pool) | its row says who picked her and when; no points (a pick game doesn't score castaways) |
| behind at own pace (sam, through Ep 3) | everything to sam's mark: the chart, the classes' points, the ranks, each game's points |
| nothing counted yet | who, and "Their numbers fill in as you watch"; In your games rows with no points yet |
| a long season (Big Brother, Survivor Australia, up to 30) | the chart and every strip fit 390 without scrolling; counts over columns stop past 14 episodes; the axis prints every second or fifth episode, always the one they left |
| a show with an amount (Below Deck) | Their figures under Who: the gratuity share, its place, its strip |
| a sport | out of scope: an athlete's sheet keeps its own parts |

## The drill tree

| Level | Reached from | The casual question | The sweat's question | Data held | Today | Verdict |
| --- | --- | --- | --- | --- | --- | --- |
| The sheet's first read | anywhere | Is she doing well? | What kind of game is she having? | `events` with each kind's points | a chart in counts, a colour per kind, a key as long as its names | **Restructure**: three classes by the show's points, setbacks under the line, one fixed key |
| Counted by | the sheet | | Switch my game | the games that count week by week | a lens over the chart | **Removed**: its job moves to In your games' rows |
| An episode of theirs | a column | What happened that night? | Which moments were the big ones? | `events` by episode | a column opens the story | **Keep**, and the story's moments wear their class marks (**repaint**) |
| Their figures | the sheet | How much did she make? | Who made more? | amounts' totals by episode | nothing: an amount is counted as if it were times | **New display** |
| In your games | the sheet | Is she on my team? | What is she worth in each game, and who holds her? | `cast[].points`, `castWeeks`, `table`, picks | the holder line only (production); a game's points only under its lens | **Restructure**: points and place on every row; the game's weeks in place |
| A game's points by episode | a game row | | Her weeks in this game | `castWeeks` | the lens's chart | **Moved** into the opened row |
| A holder | an opened game row | | | `weeks[].started` | opens that person in that game | **Keep** |
| Their numbers | the sheet | | What's she good at, what's it worth? | `counts`, each kind's points | best rank first, no colour, no worth | **Restructure**: most valuable first, the class mark, points each |
| A kind's episodes | a numbers row | When did she do that? | Is it recent, is it a streak? | `events` by kind | nothing (the board only) | **New display**, in place |
| The stat's board | a numbers row's door | Is that a lot? | Who's 1st; are they free? | `counts` for everyone, holders | the season's colour per kind | **Repaint**: the class colour |
| Compare | Compare with… | | Who's better at X? | | the picker, two side by side | **Keep** |

## Return paths

A row opening in place (a game, a kind) adds no step back and closes with a second tap. The board and a person's sheet open over
the sheet, the crumb naming the way back; Back returns there with the row still open as it was. Close closes every level.

## Spoilers

Every count, class, rank, figure and game's points stops at the viewer's mark. A kind's points are its rulebook's at that mark. A
secret role, and any moment that would give one away, shows only on someone who has left by then.

## Left out, and why

- **A points total by the show's rules** ("14.5 show points"): beside "7.5 in Weekly Lineup" it asks which number is right; the
  classes answer "doing well?" without a second total.
- **A colour per kind** (the season's colours, decided earlier on 2026-11-17): the classes replace it: three colours that mean the
  same on every sheet and every show, and a key that never grows.
- **The kinds they've never had** ("Never: won immunity…"): a long line on a long-running show for a question the board answers.
- **A game's own points for each moment in Their numbers**: the rulebook's are the show's facts; a game's live in its row.

## Open questions

- Are setbacks drawn in red, as first asked, or in Ember, keeping red for someone going home (DESIGN.md's Red Is For Leaving)?
- Is a fourth class wanted, a great moment apart from a good one?
