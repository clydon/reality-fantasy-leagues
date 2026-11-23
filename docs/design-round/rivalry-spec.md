# Rivalries (sports-couch C1): the page spec (Intent, step 1)

2026-11-22, the `sports-couch` lane. Intent's `journey`, once. On round 2's model ([sports-couch-play-spec.md](sports-couch-play-spec.md),
journey 2, "a rivalry"; its first-view and shape briefs), the plan's defaults (PLAN-sports-couch.md: "A rivalry's quick game is
Winner and margin; sides are public, margins hidden until kickoff; a rivalry found sends no push (only a challenge does); one push
when it's decided"), and what B1 and B4 already built: This week's rivalry card (two people over their teams and records, Start a
game on it), Rivalries this season (each fan's record, next two and last two), and the game sheet's "Pick a side" line on Pick'em.

## What's wrong today (before frames: `.ui-atlas/stories/rivalry/before/`)

1. **The rivalry is a picture, not a game.** This week's card names Andrew's Giants and Riley's Eagles, then offers "Start a game
   on it": the gallery's Pick'em, a game like any other, with nothing of the two people in it. Round 2's whole point (the couch
   plays as fans; the group chat lights up when two friends' teams meet) has no move.
2. **A spectator has no way in.** Sam doesn't follow either team; the card asks nothing of him. In the group chat he'd say "I'm
   with Andrew" in one line.
3. **Nobody hears they've been called out.** A challenge is the one thing round 2 lets reach a phone; today there's no challenge.
4. **The result is a score, not a story.** After the final the card shows 19–11; who called it, who sided with whom and how the
   friendship's record moved aren't said.
5. **The record is this season's only.** "Andrew 2–0" resets when the season does; the friendship's score is kept for years.

## The job

**When two couch members' teams meet: say so, let the two fans call it against each other in a tap or two, let everyone else take
a side in one tap, and settle it as a story (who called it, who was with whom, the friendship's record).** Found, never made:
nobody sets a rivalry up.

## The model: one rivalry game a meeting, started by the first tap

A rivalry is a game on the couch, **one per meeting**, named by its two people ("Andrew vs Riley"), started quietly by whoever acts
on the card first. It asks two questions of the real game:
- **Who wins?** Everyone's answer is public as it's made (the side). A point if right.
- **By how many?** Hidden from everyone until kickoff (so nobody copies it). A point for the closest.

The two fans are its duel: each makes **a call** (winner and margin; their own team chosen, changeable). Anyone else **picks a
side** (the winner only; a margin if they want it, from the sheet). It's Winner and margin (the gallery's `sp-margin`, played today)
with one engine change: the winner question's answers show as they're given (`shown: "picked"`).

Why one game started by the first tap, rather than a challenge that makes the game: the spectator's tap and the fan's call are the
same act (a pick on this game), and a card that waits for a fan to act first gives Sam nothing to do (R4 in round 2's first view).
The game starts with **no "started a game" push**: only the challenge reaches a phone.

**The duel's winner:** more points between the two (a point for the winner, a point for the closer margin); level, a tie. Sides
settle as right or wrong. The game's own page keeps its table for anyone who wants it.

## Where it lives

- **This week's rivalry card** (B1's, restructured): the place. One card a rivalry this week (on now, then next, then just played;
  two at most, the rest in Rivalries this season).
- **Your call** (a sheet, from the card): a fan's call, and the challenged fan's answer to it.
- **Pick a side** (on the card itself): two outlined buttons, one tap; a margin only on the sheet.
- **The push** (the challenge): "Andrew made his call on Giants at Eagles" into the card with Your call open
  (`/league/<sport>/<code>/week?call=<event>`).
- **Rivalries this season** (B1's, kept with one change): the record line carries every season since the two fans both followed
  ("Andrew 3–1 · since 2026"), and each meeting still to come with a game on it says how many picked sides.
- **The game's own page** (generated from its spec): **keep**, with the engine change's one consequence reviewed: sides show before
  the lock there too (docs/UI-REVIEW-MAP.md).
- **The game sheet** (B4): keep. In a rivalry the rivalry game is on the couch, so it shows under On the couch with Join; Pick'em's
  "Pick a side" line stays.

## The card, in rank order (before kickoff)

1. **The head:** the swords mark, "This week's rivalry", its day and time at the right (B1's).
2. **The two sides**, away over home, each one line of team (mark, name) and one line of person (face, name, team record); at the
   right **their call**: "Called" (the margin hidden: "Giants by ?"), or "No call yet". You on your own side say "You".
3. **The sides**, one line: the faces who picked each side, left with left, right with right, and the count ("3 with Andrew · 1
   with Riley"). Before anyone has: no line.
4. **The one action for you**, by who you are:
   - **A fan with no call yet:** "Make your call" (the yellow; it opens Your call). Challenged (the other fan has called): "Your
     call: Riley called Eagles" over the same button.
   - **A fan who has called:** "Change your call" (a quiet text button) and "Riley gets one notification" said once, when the call
     was sent.
   - **Anyone else:** **Pick a side**: two outlined buttons, each the team's mark and name. Picked: that button a quiet fill with
     a check ("With Andrew"), the other still tappable until kickoff.
5. **Other games on it** (a text link): B4's sheet (Squares, a draft). Today's "Start a game on it" outline goes: the rivalry game
   is the game on it.

## Your call (the sheet)

1. Title: "Your call". Under it the matchup and when ("Giants at Eagles · Sun 1:00 PM").
2. **Who wins:** two tiles, your team chosen.
3. **By how many:** a stepper (1 to 50, starting at 3; a sport's typical margin: football 3, basketball 5, baseball and hockey and
   soccer 1), with the number big.
4. If the other fan has called: "Riley called Eagles · margin hidden until kickoff".
5. **The send:** "Make your call" (the yellow). Under it, plainly: "Riley gets one notification. Sides are public; margins stay
   hidden until kickoff." Already called: "Save your call" and nothing about notifications.
6. **Not this time** (plain text, only when challenged): closes the sheet; the card's yellow steps down to "Make your call" outlined
   for that person.
A spectator's sheet (from "Add a margin" under their side): the same, without the notification line.

## Once it's on

The calls open: each side's call in full ("Giants by 6"), the live score at the right (through hiding), the sides frozen, no
actions but Other games on it.

## Once it's over (the result)

1. **The result line** under the head, in names: "Andrew called it: Giants by 6, 2 off" (or "Riley called the winner; Andrew was
   closer", or "Neither called it", or "A tie: both had the winner and were as close").
2. Each side's call with **right or off by N**; the losing side muted (B1's).
3. **The sides**, each face with a check or not.
4. **The record**, one line: "Andrew leads Riley 2–0 this season" (and "3–1 since 2026" once there's more than one season).
5. Hidden (Hide sports scores): no score, no result line, no checks; the calls and sides stay (they're picks, not results); the
   page's one Show records shows it (B1's rule).

## Situations, in rank order

| # | Who, when | First need |
| --- | --- | --- |
| 1 | Sam (no team) opens This week, Wednesday | Giants at Eagles is Andrew vs Riley; Pick a side, one tap |
| 2 | Andrew, a fan, no calls yet | Make your call; it tells Riley, once |
| 3 | Riley, challenged (the push) | Andrew's call (no margin), his own call two taps away; Not this time is plain |
| 4 | Both called; Joanna and you picked sides | the faces on each side; nothing due |
| 5 | On now | both calls in full; the live score |
| 6 | Over | who called it, who was right, the record moved |
| 7 | Hiding sports scores, over | calls and sides; no score or result; Show records |
| 8 | Two fans of one team (you and Sam on the Patriots vs Jets' fan) | the whose-team fan makes the call; Sam picks a side like anyone |
| 9 | Two rivalries this week | two cards; a third in Rivalries this season |
| 10 | No rivalry this week | no card (B1's) |
| 11 | Solo, or a couch of one fan | no rivalries |
| 12 | Postponed | the card says Postponed; no actions; calls kept for the makeup |
| 13 | A big couch (10+) | sides show four faces then a count |
| 14 | Loading, the read failed | the card without its sides and actions; one line, Try again |

## Each surface and its verdict

| Level | Questions (casual · sweat) | Data held | Today | Verdict |
| --- | --- | --- | --- | --- |
| The rivalry card | Who's against whom; what can I do? | couch table, week game, (new) the rivalry game's picks | people + Start a game | **restructure** (calls, sides, one action) |
| Your call | Who wins, by how much; who's told? | the game's two questions | none | **new screen** (a sheet) |
| Sides | Who's with whom? | the winner answers, public | none | **new display** |
| The result | Who called it? | final + calls | the score | **new display** |
| The record | Who leads the friendship? | meetings since both followed | this season's | **restructure** (across seasons) |
| Rivalries this season | What's coming, what happened | meetings, records | rows | **keep** (+ the sides count, the record's seasons): its rows already read as standings |
| The game's page | (inside the game) | its spec | generated | **keep**, reviewed for sides shown before the lock |
| The game sheet (B4) | | | On the couch, Join | **keep** |

## Hide sports scores, and watching as if live

Before kickoff nothing is hidden (no result yet). After kickoff the calls and sides show (picks made before anything happened); the
score, the result line, the checks and the record wait for the page's Show records. Someone watching the game as if live sees what
the strip lets them (the score's own rule).

## Return paths

- Pick a side: in place, the button turns over; a failure says "Didn't save · Try again" on the card.
- Your call: over the page; Make your call closes it and the card shows "Called"; Close keeps nothing.
- The push: the league's This week with Your call open; closing leaves the card.
- The rivalry game in Tonight or the Games tab: its own page (the generated game page).

## The data

- **The rivalry game:** started by `POST /api/sports/rivalry` { league, event, side, margin? } (join and answer in one; the game
  started on the first tap, on the home team's season that one game, as Play the next game does: start.ts), no "started" push; the
  first fan's call sends the other fan one `invite` push. `GET /api/sports/rivalry?league=&couch=` gives this week's rivalry games on
  the couch: each fan's call (the side, the margin only once begun), every side picked (person and side), yours.
- **The engine:** a question's `shown: "picked"`: its answers leave the server as they're given (answers.ts), never the margin's.
  Our check takes it only on a side answer. One change, reviewed per docs/UI-REVIEW-MAP.md.
- **The record across seasons:** each pair's meetings since the later of their two follows (the follow's date), read from the teams'
  schedules for each season since (none extra in 2026: one season).

## Left out, and why

- **The result push** ("Andrew called it"): BACKLOG 217 is the push for every sports game decided; built once, as its own step,
  it covers the rivalry too (the general control, not a one-off).
- **Stakes** (the loser wears the winner's colours): C6.
- **Back or Fade a lone fan's call, the victory lap:** C2, C3.
- **A rivalry as a series** (daily sports): a meeting is a game here; a series' three meetings are three rivalry games. Round 2's
  series framing waits for daily sports' own pass (their seasons start later).
- **Other game types for the duel** (Just the winner, a draft, a prop sheet): Other games on it (B4's sheet) holds them; the duel
  stays one kind so the card can read it.

## Open for the user

- **Who can call a margin:** everyone (the sheet's "Add a margin") or only the two fans. Recommended: everyone may, a side is the
  default; the duel is judged between the two fans alone.
