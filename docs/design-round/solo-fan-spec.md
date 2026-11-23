# Solo (sports-couch C4): the page spec (Intent, step 1)

2026-11-23, the `sports-couch` lane. Intent's `journey`, once. On round 2's journey 3 ([sports-couch-play-spec.md](sports-couch-play-spec.md),
"On your own (you and the Patriots)"), the plan's C4 ("your team's calls: Pick'em on a team's games, started by your first call, no setup
screen; the season call, a new long prediction; a team draft with computer players"), the user's B1 call (2026-11-22: solo sports play
waits for C4, nothing interim), and what C2 built: the call row, the fan card, the calls record (`src/lib/sports/fan-call.ts`).

## What's wrong today (before frames: `.ui-atlas/stories/solo-fan/before/`)

1. **A fan with no couch can't play his own team.** Alex follows the Lions and the Eagles and is on no couch. The league's Games tab is a
   dead end: "You don't play a game in ZTCF yet. Starting a sports game needs a couch for now", then Start a couch · Join one. The team's
   page says the same under the scorebug. Round 2: "plenty of fans play alone: they call their team's games in their head and keep a
   private sense of how often they're right." The app has no place for that.
2. **This week points at nothing.** The Lions' row says "Your call, above" and nothing is above it (C2's table line, drawn with no couch's
   calls card). A broken promise on the first screen a solo fan opens.
3. **Being right leaves no mark** for a solo fan: no record, no fan card (it's the couch's).
4. **There's no long call.** "We finish 11–6" is the most common thing a fan says in September and again at the bye; nothing holds it.
5. **Computer players can't be reached.** The engine seats them in drafts, pools and questions (E1), but every sports start needs a couch,
   so the one way a solo fan could have opponents is closed.

## The job

**For a fan on no couch: call his team's next game in one tap, every week, and keep his record; call the season ("Lions finish 12–4–1")
once, pinned to when he said it; and start a draft of his team's players against computer players. All found on his team's page and the
league's page, with no setup screen.** For a fan on a couch, one piece of this is new: the season call (his calls stay C2's, public).

## The model

**Your calls** (solo): one standing game a fan a team, **"Your Lions calls"**, Pick'em on the team's games (the gallery's Pick'em, plays
today) from the game first called to the end of the regular season, started by the first call with no setup screen and no push. Each
later game asks again on the same row. Picks are private (it's yours alone). Changeable until kickoff. Scored as Pick'em (a point if
right); its own generated page keeps its table. Why standing, not C2's one game a meeting: nobody backs a solo call, so there's no reason
to split it, and a standing game puts next week's call on Your moves and the strip, the solo fan's only weekly prompt.

**The season call** (everyone who follows a team): one game a fan a team a season, **"Your Lions season call"**, one question asked once:
how many of the team's games left does it win. The page frames it as the season's record: the record now plus the call ("8–2–1 now · 6
left · call 4 → 12–4–1"). It can be made any week a game is left (the game starts then, from the next game), and once made it's final:
it's pinned to the record it was made at, kept and shown ("called at 8–2–1"), because a call at 2–1 and a call at 10–5 aren't the same
brag. (In the engine the question closes at the span's first kickoff; nothing reopens it.) Settled when the last regular-season game is final: right if the wins are exact; otherwise "off by 1".
**The engine change:** a new settle, `{ by: 'final', take: 'wins', of: <team> }`, a number answer asked once: how many of the span's games
`of` wins (a tie isn't a win; a game called off counts nothing), final once every game of the span is. General, not a one-off: "how many
of these games do the Bills win" works on any span (a series, a rival's meetings, a slate's team) and is D5's futures pool's base.

**A draft with computer players** (plays today): Start a game on the team's season through today's wizard (the gallery's A draft and Best
Ball on a team's games), on no couch: "Just you" with computer players. Nothing new in the wizard; the handoff stops refusing a solo fan.

**Your own games**: any of these on no couch is the fan's own (a new kind beside a public pool's and the retired practice couch's:
`leagues.solo = 'own'`), so the couch-healing read never wraps it in a made-up couch. Listed where his games are listed (the league's
Games tab, Your moves, the strip). Opening one to a couch later is left out (below).

## Where it lives

- **The team's page** (B2's, solo): the head (keep); **your fan card, solo** (new, C2's card with the couch's words gone: "Your team since
  Sep", the record big, a tick a game, this week's call row); the scorebug (keep); **Your call row** under it (new for solo: C2's row in
  its "Your call" state, your team first, the page's one yellow) in place of "Starting a sports game needs a couch"; **the season call
  row** (new, everyone); **More on the Lions** (new for solo): "A draft of Lions players · you and computer players", "Every Lions game",
  each into the wizard; then a quiet "Playing with friends? Start a couch · Join one".
- **This week** (B1's, solo): **your calls card** (new for solo: a row for each of your teams' games this week, yours to call first) above
  Your teams; the table's "Your call, above" now true.
- **Games** (B1's, solo): **Your games here** (keep: now lists your own games, due first); **Your team** (new for solo, the couch's group:
  "Every Lions game" into the wizard, computer players offered there); the couch line under it, quiet, not the page's message.
- **The season call sheet** (new): the record now, the games left, a stepper for the wins left, the season's record it makes, one call a
  season, Call it.
- **The fan card, on a couch** (C2's): **add** your season call row under the record (your own; the couch's season calls are left out).
- **Your calls' and season call's own game pages** (generated from their specs): **keep**, reviewed for the new settle (UI-REVIEW-MAP).
- **The wizard** (no couch, a sport): **keep**, reviewed: no couch words, computer players reachable.

## Your call row (solo), in rank order

1. **The game**: your team's mark, "Lions vs Bears", the day and time at the right (on the team's page the game's already named: drops).
2. **The action**: "Your call", two buttons, each the team's mark and name, your team first and filled (the page's yellow, else outlined).
   One tap calls it. Under it once, the first time only: "Your record starts here · change it until kickoff".
3. **Called**: "You called Lions", Change (a quiet text button) until kickoff.
4. **On**: the score at the right, the call frozen. **Over**: "You called it" / "You missed it", the record moved.

## The fan card (solo), in rank order

1. **Whose**: "Your team" and since when ("since Sep").
2. **The record**, big in the number type ("6–2"), the season's games as ticks (C2's: right teal, wrong a muted fill, no call a gap, this
   week's open call hollow).
3. **The season call row** (below).
4. Nothing about a couch. Empty: "No calls yet. Call their next game below."

## The season call row, in rank order

- **None yet:** "The season" and "8–2–1 now · 6 left", a button "Call the season" (outlined; never the yellow while a game's call is due).
- **Called, open:** "You called 12–4–1", "at 8–2–1 · Week 12", and the season so far against it, read across ("needs 4 of 6 · has 1").
- **Settled:** "You called 12–4–1 · finished 11–5–1", "Off by 1" or "Spot on".
- **Locked before it could be made** (the season's over, or no game left): no row.

## The season call sheet, in rank order

1. The team and the record now, big ("Lions 8–2–1").
2. The call: a stepper for the wins left, 0 to the games left, starting at the pace the record keeps (round of wins so far × left / played),
   and the season's record it makes, big ("12–4–1").
3. What it means: "One call a season, pinned to today's record."
4. Call it (the sheet's one yellow). Back closes it; nothing's saved until Call it.

## Situations, in rank order

| # | Who, when | First need |
| --- | --- | --- |
| 1 | Alex (no couch, Lions fan), midweek, no call yet, team page | Your call, one tap, his team first (the yellow) |
| 2 | Alex after calling | "You called Lions", Change; the season call row offered |
| 3 | Alex, This week | his call rows first; the table's "above" true |
| 4 | Alex in Week 12 with a record (made-up season) | the fan card: 6–2, ticks; the call row |
| 5 | The season call sheet | the record now, the stepper, the record it makes, one call a season |
| 6 | Called, a game later | "You called 12–4–1 at 8–2–1"; needs 4 of 6, has 1 |
| 7 | Over (a game) | "You called it", the record moved |
| 8 | Settled (the season) | "Off by 1" |
| 9 | Games (solo) | your games (due first), Your team starts, the couch line quiet |
| 10 | The wizard from "A draft of Lions players" | the draft with computer players, no couch words |
| 11 | Hiding sports scores (solo) | the call stays; the result, record and ticks wait for Show records |
| 12 | A couch fan's team page | C2's card with his season call row |
| 13 | Two teams followed | a row each on This week; each team page its own card |
| 14 | Season over / no game left | no call row, no season call row; the record stays |
| 15 | Postponed | the row says Postponed; no actions; the call kept |
| 16 | The read failed | the rows without actions; one line, Try again |

## Each surface and its verdict

| Level | Questions (casual · sweat) | Data held | Today | Verdict |
| --- | --- | --- | --- | --- |
| Team page, solo | Can I play my team? · how good am I at calling them? | schedule, record | a "needs a couch" line | **restructure** (fan card, call row, season row, More) |
| Your call row | Who do I think wins? | (new) own calls game | none | **new display** (C2's row, solo state) |
| Fan card, solo | Am I any good? | (new) own picks, finals | none | **new display** (C2's card, solo words) |
| Season call row / sheet | Where will we finish? · how did my call age? | standings record, schedule, (new) season call | none | **new display** |
| This week, solo | What's my team doing; my call? | week games, (new) own calls | table only (broken "above") | **restructure** (+ calls card) |
| Games, solo | What do I play here; can I start one? | own games, follows | dead end | **restructure** (+ Your team) |
| Fan card, couch | (C2's) + my season call | (new) season call | C2's | **keep** + a row |
| Own games' pages | (inside the game) | specs | generated | **keep** (reviewed) |
| The wizard, solo | Who'm I playing against? | bots (E1) | refused before reaching it | **keep** (reviewed) |

## Return paths

- A call, a change: in place, the button turns over at once; a failure says "Didn't save · Try again" on the row.
- The season call: the sheet closes on Call it, the row says it at once; Back keeps nothing.
- More's rows and Your team's: the wizard, its Back returns to the page.
- An own game on Your games here or Your moves: its own generated page.

## The data

- `GET /api/sports/own?league=`: your own calls and season-call games in the league: each calls game's picks (yours) by game with its
  final's winner (C2's `CallGame` shape, so the record, ticks and row reuse fan-call.ts), and each season call (team, wins called, the
  record it was made at, games left then, locked, wins so far, settled).
- `POST /api/sports/own` `{ league, team, event, side }` (your calls: the standing game found or started on the team's season, then
  answered) or `{ league, team, wins }` (the season call: started and answered under one lock; refused once a call stands). No push.
- Start a game with no couch on a sport's season (`startSport` and the wizard's start): the game is your own (`solo = 'own'`); a migration
  widens leagues.solo's check. HOSTING.md: no new external read (finals and records are the cached schedules' and standings').

## Left out, and why

- **Opening a solo game to a couch later** ("any solo game can be opened to the couch", round 2): a game move between couches is its own
  step; BACKLOG.
- **A solo record carried onto a couch** (his own calls counted in C2's record once he joins one): needs Privacy's "show my record";
  BACKLOG with the plan's default ("Solo calls show the couch your record, Privacy can turn it off").
- **The couch seeing each other's season calls** on the fan card: social, and the next obvious step; held to keep C4 solo (open, below).
- **Computer players in your calls** (Pick'em with bots, which plays): your calls are your record against the schedule; opponents live
  in the draft.
- **A margin on a call, ties in the season call**: one tap; a tie is too rare to call.
- **The hub's solo page** showing a call: your calls game is on Your moves and the strip like any game; nothing new there.
- **Daily sports**: a call is per game; a season call for an NBA team (82 games) works the same, the stepper's range just longer.

## Open for the user

- **The couch's season calls.** Recommended next (not in C4): a fan card on a couch lists each fan's season call once it's locked
  ("Andrew: Giants 12–5, called at 2–1"). Or include it now, at the cost of a couch read of everyone's own games.
- **A season call is final once made.** The build follows the other way, the engine's: it can change until the next kickoff (on its own
  game page), then it's pinned; no game is played before that, so the pin is still today's record (found in the check).
