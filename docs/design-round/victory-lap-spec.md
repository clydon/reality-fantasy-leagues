# The victory lap (sports-couch C3): the page spec (Intent, step 1)

2026-11-23, the `sports-couch` lane. Intent's `journey`, once. On round 2's model ([sports-couch-play-spec.md](sports-couch-play-spec.md),
journey 1 step 7: "After a win, one prompt: 'Giants won. Take a victory lap?' A GIF and a line go to the couch's feed and the NFL room.
Nobody hiding sports scores sees it until they've seen the result"), the plan's default ("a victory lap is one prompt after a win"),
the rule in round 2's "Not this" ("one prompt per win, easy to ignore with plain words"), and what C1 and C2 built: the rivalry's and
the call's results in names ("Jordan called it"), the league's room with a thread a game (B1 session 5), the game sheet (B4), and the
episode GIF reactions' parts (`GifPicker`, `GifTile`: src/new/ui/gif-sheet.tsx, src/new/show/react.tsx).

## What's wrong today (before frames: `.ui-atlas/stories/victory-lap/before/`)

1. **A win leaves the fan nothing to do.** The Giants win; Jordan's call row says "Jordan called it" and the table's record moves. In
   the group chat he'd post a GIF within a minute. Here the only way is to open Chat, find the game's thread, tap GIF, search: four
   screens, and nothing in it says it's a win.
2. **The couch hears nothing of it.** The hub's On the couch leaves the league rooms out (B1 session 5's settled rule), so a GIF in the
   room never reaches anyone who isn't already in the NFL room.
3. **Showing off has no shape.** Round 2: "What he shows off with: … his victory laps." A GIF in a thread is any GIF; nothing marks it as
   the fan's moment, with the result that earned it.

## The job

**When a couch member's team wins, offer that fan one easy-to-ignore prompt to take a victory lap (a GIF and a line, two taps) that
lands as a marked moment in the game's thread in the league's room and on the couch's feed, carrying the result that earned it; and
keep all of it from anyone who hasn't seen the result.** Found, never pushed at the fan: the prompt waits where the win is shown.

## The model: a lap, one a fan a win

- **Who:** every follower of the winning team on the couch (a co-fan gets their own). Not a backer who read the call right, not a
  spectator: allegiance is the engine (round 2), and one prompt per win keeps it rare.
- **When:** from the final until the team plays again (the NFL: its next week; a daily sport: the next game), or answered. No countdown,
  no "last chance".
- **What:** a GIF (KLIPY's picker, searching the team's name and "win" to start) and a line (optional, a sentence). With GIFs off here,
  the line alone (then required).
- **Carries the result:** "Giants 24–17 Bears", with what else it settled for that fan: "called it" (their call right, C2), "beat Riley"
  (their rivalry, C1). Drawn from the final, never typed.
- **Answered once:** posted, or **Not this time**; either ends the prompt on every phone (kept on the server). Not this time leaves a
  quiet "Take a victory lap" on the game's sheet until the window closes, in case they change their mind.
- **No push.** A lap is a moment to find, not a buzz after every win (the room's chat push is skipped for it). Open for the user below.
- **Taken back:** from the posted sheet ("Take it back") or by deleting the message in the room, as any message; the lap goes with it.
- **Solo (no couch):** none (there's no couch to tell; C4 is solo play).

## Hiding sports scores

A lap says who won. **For anyone hiding sports scores who hasn't shown that game (or is watching it as if live), no lap exists**: not a
placeholder, not a count, not "Andrew posted". It appears once they've shown the game (its Show the score, or This week's Show records).
The room's thread already folds what's written after kickoff; the feed and the sheet do the same on the phone (the room line's rule:
league-page.tsx `RoomLine`). **The fan's own prompt is a result too**: hiding scores, they get it once they've shown the game.

## Where it lives

| Surface | Who | What |
| --- | --- | --- |
| **This week** (new: a lap card, under the move strip) | the winning fan, while open and shown | "Giants won 24–17" over what else it settled, Take a victory lap, Not this time |
| **The game's sheet, final** (restructure) | the fan: the prompt; everyone: the laps | the prompt under the couch line; then **Victory laps**: each lap's GIF with its name strip and line |
| **The lap sheet** (new) | the fan | the result; the GIF picker; then the line and Post; then posted, with where it went |
| **The room's thread** (new display: a lap message) | the couch | the lap marked as one: "Victory lap" tag, the result, the GIF, the line |
| **On the couch** (the hub's feed; new kind) | the couch | "Andrew took a victory lap", the result and the league, the GIF, the line; opens the game's thread |
| **This week's room line** (keep, words) | the couch | "Andrew took a victory lap" in place of "sent a GIF" |

Not on the team's page: its Now shows the next game, not the last (B2); a lap there would name a game the page has moved past.
Not on the hub's scores strip: the final's bug opens the game's sheet, where the prompt is (one tap; the strip stays scores).

## The lap card (This week), in rank order

1. **The result, the fan's way round:** the team's mark, "Giants won", the score from their side ("24–17 vs Bears").
2. **What else it settled for you**, one line, only when true: "You called it · you beat Riley". Nothing when neither.
3. **The ask:** "Take a victory lap" (opens the lap sheet) and "Not this time" (plain, ends it).
One card, the newest open win (a daily sport's second win in a week replaces the first). It's not a due move: never the page's yellow.

## The lap sheet, in rank order

Titled "Victory lap", its subtitle the result ("Giants 24–17 Bears · Sun").
1. **Pick a GIF:** the picker, already searching "Giants win" (any search after). One tap picks.
2. **Then:** the chosen GIF big with "You" on its strip, "Pick another" beside it; a line field ("Add a line (optional)"); where it goes,
   once ("To the NFL room's Giants vs Bears thread and On the couch · held for anyone hiding scores until they've seen it"); **Post it**.
3. **Posted:** the lap as the couch will see it; "Posted" and Take it back; Done.
Fails: "Didn't post · Try again" under Post, the GIF and line kept.

## The lap in the room and on the feed

- **Room message:** the author's usual bubble with a small "Victory lap" tag and the result ("Giants 24–17 Bears") above the GIF, the line
  under it. Reactions, delete: as any message. In the game's thread (it's always after kickoff, so the thread's fold holds it).
- **Feed row:** the face, "**Andrew** took a victory lap"; the team's mark and the result with the league ("Giants 24–17 Bears · NFL"); the
  GIF; the line. Tap: the game's thread in the room. One row a lap; the feed's own four-then-more fold.

## Situations, in rank order

| # | Who, when | First need |
| --- | --- | --- |
| 1 | Jordan (the Giants' lone fan) after a Giants win, his call right, This week | the lap card leads; two taps to post |
| 2 | Jordan from the hub: the scores strip's final, the game's sheet | the prompt on the sheet |
| 3 | Jordan picking: the sheet with the picker, then the line and Post | GIF first, the line optional |
| 4 | Jordan posted | the lap as the couch sees it; Take it back |
| 5 | Sam (no stake) after: the hub feed, the room's thread, the game's sheet | Jordan's lap, with the result that earned it |
| 6 | Casey hiding sports scores | no lap anywhere; after Show the score, it's there |
| 7 | A rivalry win (Alex beat Riley) | "You beat Riley" on the card; "beat Riley" on the lap |
| 8 | The losing fan (Riley) | nothing (no prompt, no consolation) |
| 9 | Jordan said Not this time | the card gone; the sheet's quiet "Take a victory lap" |
| 10 | Two fans of the winning team | each their own prompt; both laps on the sheet |
| 11 | Jordan hiding scores himself | no prompt until he shows the game |
| 12 | A tie, a loss, postponed | no prompt |
| 13 | GIFs not set up | the line alone |
| 14 | Studio (light) | the card and the sheet in Studio |

## Each surface and its verdict (the drill tree)

| Level | Questions (casual · sweat) | Data held | Today | Verdict |
| --- | --- | --- | --- | --- |
| This week | Did we win? can I gloat? | finals, follows | the call row's result | **new display** (the lap card, fan only) |
| The lap sheet | Which GIF says it? | KLIPY search | none for sports | **new screen** (built from React with a GIF's parts) |
| The game's sheet, final | What happened; who's gloating? | final, laps | score, thread link | **restructure** (+ prompt, + Victory laps) |
| The room's thread | What's the couch saying about the game? | messages | GIF messages | **new display** (a lap message) |
| On the couch (hub) | What's the couch up to? | chat, starts, plans | leaves rooms out | **new display** (a lap row) |
| This week's room line | What was said last? | the room's newest | "sent a GIF" | **keep** (the words change) |
| The team's page | | | Now: the next game | **keep** (a lap names a game it's moved past) |

## Return paths

- The card's Take a victory lap: the lap sheet over This week; closing it returns there, the card unchanged until posted.
- Posted, Done: back where it opened; the card is gone, the room line names the lap.
- Not this time: in place, the card gone (optimistic; "Didn't save · Try again" if the server refuses).
- The feed row: the room's thread for the game; Back returns to the hub.

## The data

- **A migration:** `sports_laps` (couch, league, event, team, user, its room message, skipped, the score and opponent at the final; one a
  person a game a couch). HOSTING.md first: one small table, no new external read.
- `GET /api/sports/laps?couch=&league=&teams=` your open laps (each couch team of yours whose last final is a win you haven't answered,
  from the cached schedules as C2's calls read: no new kind of ESPN call) and the couch's laps in the league this season.
  `POST` { league, event, team, gif?, line? } posts (the room message without its push, and the lap); { …, skip: true } is Not this time;
  `DELETE` takes it back. Refused for a team you don't follow, a game that isn't its win, or after it plays again.
- The room's read carries a message's lap (`lap`: team, result); the hub's feed a `lap` kind with the game and its start (for the phone's
  hold).

## Left out, and why

- **A lap for a right back or fade**, or for winning the couch's weekly pool: one prompt per win, allegiance first (revisit after a real
  Sunday: BACKLOG).
- **Laps on the fan card** ("3 victory laps this season"): the fan card is about calls; a count of GIFs isn't data worth the space yet.
- **A stake's colours** after a rivalry: C6.
- **Auto-opening the sheet** on the final (as React with a GIF opens after I watched it): there's no "I watched it" moment for a game, and
  an unasked sheet is pressure.
- **Suggested lines** ("Never in doubt"): the fan's own words or none; a canned slogan is the decoration the 2026-11-12 direction refuses.

## Open for the user

Decided (the user, 2026-11-23, "Agree with recs"): no push, as recommended.

- **No push for a lap.** Recommended (a moment found, not a buzz after every win; the room's chat push skipped for it). The other way:
  the room's usual chat push ("Jordan took a victory lap in Bears at Giants"), held back for anyone hiding scores as room pushes are.
