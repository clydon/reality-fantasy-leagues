# A castaway opened from a week: page spec (BACKLOG 251)

## The job

A castaway's sheet opened from inside a week answers the question the week raised: how did they get that number? "Carter +6"
on ahaskell's Episode 9 opens Carter's sheet on Episode 9 in that game: each thing he did with what it was worth there, adding up
to the +6, whose lineup it counted for, and the night one tap away. His season follows, as it is today. The user, 2026-11-22: "I
see Carter scored 6 this week, I want to see how he gained all those points ... in the context I think it should be assumed I
want to see his week."

- **Joanna** (forgets): "Why did Carter get so many?" The first thing under his name says it: "Individual immunity win +6".
- **Andrew** (drives by): "Did my bench outscore my starters?" A bench player's week says "scored, didn't count" beside the number.
- **Conor** (tinkers): "Was that the captain's double, or the finale's?" Every factor is a row of its own, so the rows add up to
  the total, and ‹ › steps to his other weeks without leaving the sheet.

It stays one castaway sheet from every way in (the user, 2026-11-16): the week is a block the sheet leads with when a door hands
it one, never a second kind of sheet.

## Which doors hand a week

A door hands a week when it sits inside one episode of one game that scores people week by week (Weekly Lineup, best ball, a
head-to-head lineup, a captain's lineup, a sport's stats). It hands the game, the episode and, where there is one, the holder:
the person whose lineup the castaway was in that week.

| Door | Game | Episode | Holder |
| --- | --- | --- | --- |
| A person's week: a Started face | the game | the week shown | that person |
| A person's week: a Bench row | the game | the week shown | that person |
| A person's season table: a number | the game | its column | that person |
| A matchup's lines (head to head), each side | the game | the matchup's week | that side's person |
| An episode's plays (everyone's that week): a castaway in a row | the game | the episode | that row's person |
| Everyone in this game: a number | the game | its column | none |
| A compare: a week's column | the game | that week | none |
| The episode page: a game's best this episode | that game | the episode | none |

Doors with an episode but no game that scores people weekly (a pick pool's pick, an Outlast row, Tonight's Last time, the episode
page's who left and What happened) hand the episode only: the sheet lands on that episode of their story, lit, as the season
table's numbers land today. Doors with no week (the Cast tab's wall, Your team, the draft room, waivers, a stat's board) open the
sheet as they do today.

## The week block

Directly under the sheet's header (the crumb, the full name, "Survivor · up to Ep 9"), above Who. In rank order:

| # | Holds | Opens |
| --- | --- | --- |
| 1 | **The head:** the episode, named as the story names it ("Episode 9"), with ‹ › either side when they have other weeks in this game; the game's name; the week's total for them, in the big row number (+6, 0, −1.5) | the episode opens the night (the Episodes page's body as a level); ‹ › swap the block to the week before or after, in place (no new level, no history entry) |
| 2 | **How it counted:** one line. With a holder: "Started for ahaskell" / "Started for you" / "On ahaskell's bench: scored, didn't count" / "Counted for you: one of your best 3" (best ball) / "Not in your best 3: didn't count". Without one: "Their points in Weekly Lineup" | |
| 3 | **What scored:** each moment that scored in this game that episode, a row each: the moment's band mark (the season chart's colour for it), its name as the rulebook says it, "×2" when it happened twice, its points at this game's scoring. Biggest first, setbacks last | |
| 4 | **What multiplied it:** each factor that applied, a row each, its added points at the end so the rows add up: "Captain ×2", "Finale: double points", "Joined mid-season ×0.5" | |
| 5 | **What didn't score here:** the moments this game gives nothing for (the show's own story has them), muted, one line: "Also: Voted with the majority (no points in this game)" | |
| 6 | **Nothing scored:** "Nothing that scores in this game", then 5 if there is anything; out before that episode: "Already out" | |

The block draws a hairline under itself; Who and the rest follow unchanged. The season chart and the game's row in In the couch's
games mark the block's episode, so the eye can find the week in the season.

An athlete's week (the round's sports check) is the same block on the athlete's sheet: the head names the week as the game does
("Week 9"), and What scored is each stat line with its count, in the sport's own words, at the game's table ("245 passing yards
+9.8", "1 interception −2").

## Situations

| Situation | The block |
| --- | --- |
| Started, scored (Carter +6) | head +6; "Started for ahaskell"; the moments |
| Started, nothing (Cristian 0) | head 0, muted; "Started for ahaskell"; "Nothing that scores in this game"; the unscored moments, if any |
| On the bench | head in muted ink; "On ahaskell's bench: scored, didn't count"; the moments |
| Captain | the moments at their own points, then "Captain ×2 +3" |
| An episode window (a finale's double) | the moments, then "Finale: double points +3" |
| Best ball | "Counted: one of their best 3" or "Not in their best 3: didn't count" |
| Went home that episode | the moments, then their exit as the story says it ("Voted out"), in live red |
| No holder (Everyone in this game, a compare, the episode page) | "Their points in Weekly Lineup"; the moments; factors that belong to a seat (a captain) left out |
| Your own week | "Started for you" |
| Someone you play against, before your mark | nothing new: the game's weeks stop at your mark, so no door hands a week past it |
| A game you don't play (the couch's others) | the same, its weeks at your mark |
| 30-episode season | ‹ › and the head hold; the block's height doesn't depend on the season's length |
| A sport, a slate week | the stat lines added up across the week's games, as the game's table counts them |

## Drill tree

| Level | Today | Verdict | Why |
| --- | --- | --- | --- |
| A person's week, its Started cards | a face, name, points, the biggest reason | **keep** | the card is the glance; the tap now explains it whole, so the card doesn't need to |
| A Started face or Bench row, tapped | the castaway's season, the week lost | **restructure** (the door hands the week and holder) | the question came from the week |
| A matchup's line, an episode's plays, Everyone's and the compare's numbers, the episode page's best scorers | the castaway's season (the last three scroll to the story) | **restructure** (the door hands its week) | same question, same answer, every way in |
| The castaway sheet, handed a week in a game that scores weekly | none | **new display** (the week block) | the game's arithmetic for one person, one episode exists nowhere on screen today |
| The castaway sheet, handed an episode in any other game or none | lands on that episode of the story, lit | **keep** | no game arithmetic to explain; the story entry is that night in the show's own terms |
| The week block's episode | none | **new door** to the night | what else happened that night is the next question |
| The week block's ‹ › | none | **new control** | "and last week?" without three taps back |
| The week block's rows | none | **no door** | a moment's board ("who else won immunity") is already a tap away in Their numbers |
| The season below | as today | **keep** | the user likes reaching the season from here; it is untouched |

## Left out, and why

- **A chart in the block.** The season's charts sit one scroll below; a second chart for one episode says less than its rows.
- **Other games' points for the same week.** The block is the game the door came from; the castaway's other games are In the
  couch's games, unchanged.
- **Points on the Started cards.** Three narrow columns can't hold a breakdown at 390 without growing tall and uneven; the card
  keeps its one reason, and the tap answers.
- **Predictions and group slots.** They're the person's week, not the castaway's: they stay on the person's week pane.
- **The story's duplicate.** The block holds the game's arithmetic; the story keeps that night in the show's terms. The block's
  episode is not repeated as a lit story entry.

## Open questions

- Does the block push Who out of the first phone view, and is that right? (Perception-First Design's question.)
