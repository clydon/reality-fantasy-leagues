# The lone fan (sports-couch C2): the page spec (Intent, step 1)

2026-11-22, the `sports-couch` lane. Intent's `journey`, once. On round 2's model ([sports-couch-play-spec.md](sports-couch-play-spec.md),
journey 1, "Andrew, the only Giants fan"; its first-view and shape briefs), the plan's defaults (PLAN-sports-couch.md: "A lone fan's
call is Back or Fade, one tap; his calls keep a record"), C1's approved rivalry (the card, `shown: 'picked'`, one game a meeting
started by the first tap), and what B2 and B4 built: the team's page (its head left room: "the fan card (C2) goes under") and the game
sheet.

## What's wrong today (before frames: `.ui-atlas/stories/lone-fan/before/`)

1. **A lone fan has nothing to do with his team's game.** Jordan is the couch's only Giants fan. This week, Giants vs Bears is a row in
   the couch's teams ("Sun 1:00 PM vs Bears"); the only move is Play the next game on the team's page, a Pick'em like any other that
   says nothing about Jordan. Round 2: "a lone fan shows off through watching and the games he makes."
2. **The couch can't play Jordan.** Nobody else follows the Giants, so nothing on the page asks them anything. In the group chat
   they'd say "no chance" and fade him. The couch's running game ("fading Andrew") has no move.
3. **Being right leaves no mark.** A fan who calls his team's games well has no record anywhere; the team's page says whose team it
   is and nothing about him.
4. **The games he makes on his team are hidden.** A couch game on the Giants shows on a game's sheet (B4) but not on the Giants' page.
5. **Watching is invisible.** On a Sunday nobody can see who's actually watching the game; the thread is there, the people aren't.

## The job

**When a couch member's team plays (and it isn't a rivalry): let the fan call it in one tap, let anyone else back or fade the call in
one tap, keep the fan's record of calls, show the fan off on his team's page, and let anyone say they're watching.** Found, never
made: the call waits on the page; nobody sets anything up.

## The model: a fan's call, one game a meeting, started by the call

A fan's call is a game on the couch, **one per game of a couch team's that isn't a rivalry**, named by its fan ("Jordan's call"),
started quietly by the fan's call. It asks one question of the real game, **who wins?**, Pick'em on one game (the gallery's, plays
today), with C1's `shown: 'picked'`: every answer is public as it's given. No margin: the call is one tap.

- **The call** is a fan's pick (a follower of one of the two teams). Usually his own team; calling against it is allowed and said
  ("Jordan called the Bears").
- **Back** is the call's side, **Fade** is the other: anyone else's pick, framed by the call. Stored as a side (a team), so a call
  that moved would turn every back into a fade: **a call stands once anyone backs or fades it** (until then the fan can change it).
- **A co-fan** (two fans of one team) sees the call like anyone and backs or fades it; whoever calls first makes the call.
- **No push.** A call is news, not a move (round 2's rule for rivalries found). Nothing reaches a phone.
- **Scored** as Pick'em: a point if right. The game's own page keeps its table.

Why a game a meeting (as C1), not a standing season game: a back is a one-off ("no chance, Jordan"), and a season game would make every
backer's next week a due move. Each call's game ends with its game.

## The calls record

**A fan's calls:** every call of theirs this season, on their team's game, in a fan's call or a rivalry (a rivalry call is a call),
right or wrong once final ("Jordan's calls 7–1"; an NFL tie counts as neither). **The couch on his calls:** how backing and fading
him has gone ("Backing Jordan 5–2 · fading him 2–6"). Both are results: hidden for anyone hiding sports scores until they show the
page's records.

## Watching marks

**I'm watching** is a mark on one game, by one person, on their couch: one tap on the game's sheet once it's within the hour or on.
It puts their face on the game's row on This week and on the sheet, until the game is final. Presence, like a show's watch along:
shown only for someone who shares When I'm watching (Settings › What your couch sees: `share_where`), only on that couch, never to
anyone else. No push. Stored server-side (a phone that marks it should show it to the couch): a new table, a row a person and game.

## Where it lives

- **This week's calls** (new, a card under the rivalries): one row per game of a couch team's this week that isn't a rivalry: on now,
  then to come, then just played; the rows the viewer can act on first. A spectator sees only games that have a call; the fan sees his
  own uncalled game ("Your call") too.
- **The fan card** (new, the team's page, under the head): whose team it is on the couch, the calls record with each call as a tick
  by week (a designed display: the drill's weekly graph), the couch on his calls, and this week's call row.
- **Games on the team** (new, the team's page, after Start a game on): the couch's games that cover this team's next game, by their
  maker ("Jordan's Pick'em"), with Join or Open. The fan's call and rivalry games are left out (the call row is them).
- **The couch's teams** (B1's table): **keep**, with one change: a team's game line says "Jordan's call, above" when this week's calls
  holds it, as a rivalry's row says "Rivalry, above" (a game appears once: round 2's R1). Watchers' faces on a game on now.
- **The game sheet** (B4): **add** I'm watching and who's watching (once within the hour or on); the call game is under On the couch
  like any (Join opens the card's choice, not a Join sheet: see below).
- **The fan's call game's page** (generated from its spec): **keep**, reviewed for C1's sides shown before the lock (UI-REVIEW-MAP).

## A call row, in rank order (before kickoff)

1. **The game:** the fan's team mark, "Giants vs Bears", the day and time at the right.
2. **The call:** the fan's face and name, the side ("Jordan called Giants"), his calls record ("calls 7–1", through hiding).
3. **The backing**, one line when anyone has: the faces who backed on the left, who faded on the right, the count in words ("2 back · 1
   fades").
4. **The one action for you:**
   - **The fan, no call yet:** "Your call" and two buttons, each the team's mark and name; your team first and filled (the page's
     one yellow when it's free, else outlined). One tap makes the call. Under it, once: "The couch can back or fade it".
   - **The fan, called:** "You called Giants" and, until anyone backs or fades, "Change" (a quiet text button); after, "It's backed:
     your call stands".
   - **Anyone else:** **Back Jordan** and **Fade Jordan**, two outlined buttons side by side, each with its team's mark. Picked: that
     button a quiet fill with a check ("Backing Jordan"), the other still tappable; tap again to clear, until kickoff.

## Once it's on, and over

On: the score at the right (through hiding), the backing frozen, no actions. Over: the result in names, the caption type's one line
("Jordan called it", "Jordan missed it"); the backing line's checks on the right side; the record moved. Hidden (hiding scores): the
call and the backing stay (picks made before anything happened); the score, the result, the checks and the records wait for Show
records (B1's one reveal).

## The fan card (team's page), in rank order

1. **Whose team it is:** the fan's face and name, "Jordan's team on the couch" (yours: "Your team on the couch"), since when it was
   followed ("since Sep").
2. **The calls record**, big in the number type ("7–1"), and the season's calls as ticks, one a week, oldest first: a right call
   teal, a wrong one outlined, a week with no call a gap, this week's open call a hollow tick. Read across like the form ticks.
3. **The couch on his calls** ("Backing Jordan 5–2 · fading him 2–6"), when anyone has.
4. **This week's call row** (the same row as This week's, the game already named by the page: its first line drops).
Two fans of one team: the card is whose team it is (fanOf), with the other fan's record in one line under it ("Casey's calls 3–1").
Nobody on the couch follows the team: no card (the head's line already says so).

## Situations, in rank order

| # | Who, when | First need |
| --- | --- | --- |
| 1 | Jordan (the Giants' lone fan), midweek, no call | Your call, one tap, his team first |
| 2 | Sam (Cowboys fan, no stake in the Giants) | Jordan called Giants; Back or Fade, one tap |
| 3 | Jordan after Sam faded him | "It's backed: your call stands"; who faded him |
| 4 | Two lone fans' games this week (Jordan's Giants, Sam's Cowboys) | two rows, each viewer's own first |
| 5 | A rivalry and calls the same week | the rivalry card, then the calls card; the table says each once |
| 6 | On now, someone marked watching | the score; watchers' faces on the row and the sheet |
| 7 | Over | who called it, who read him right, the record moved |
| 8 | Hiding sports scores, over | the call and backing, no result or records; Show records |
| 9 | The Giants' page, as Jordan and as Sam | the fan card: record, ticks, the couch on his calls, the call row |
| 10 | No call yet, as a spectator | no row (nothing to back) |
| 11 | Solo (no couch) | no calls, no card (C4 is solo play) |
| 12 | Postponed | the row says Postponed; no actions; the call kept |
| 13 | Loading, the read failed | the card's rows without actions; one line, Try again |

## Each surface and its verdict

| Level | Questions (casual · sweat) | Data held | Today | Verdict |
| --- | --- | --- | --- | --- |
| This week's calls | What's Jordan saying; can I fade him? | couch teams, week games, (new) call games' picks | none | **new display** (a card of rows) |
| The call row | Who called what; who's with him? | the call game's picks, public | none | **new display** |
| The couch's teams | Where's my team; what's on? | records, form, week game | rows | **keep** (+ "call, above"; watchers on now) |
| The team's page head | Whose team is it? | follows, record | plate + faces | **keep** |
| The fan card | Is he any good at this? · how has fading him gone? | (new) calls across the season, finals | none | **new display** (record, ticks by week) |
| Games on the team | What can I join on the Giants? | couch games, game seasons | B4's sheet only | **new display** (a list) |
| The game sheet | Who's watching? | (new) watching marks | none | **restructure** (+ I'm watching) |
| The call game's page | (inside the game) | its spec | generated | **keep** |

## Return paths

- A call, a back, a fade: in place; the button turns over at once (optimistic); a failure says "Didn't save · Try again" on the row.
- A call row's game words open B4's sheet for the game; the fan card's ticks are read, not tapped.
- I'm watching: in place on the sheet; the sheet's thread link sits beside it.
- The call game in Tonight or the Games tab: its own generated page.

## The data

- **The call game:** started by `POST /api/sports/calls?couch=` { league, event, team, side | null } (join and answer in one; the game
  started on the first call by a fan of one of the two teams, on the home team's season that one game, as C1's rivalry: start.ts
  `game: "call"`), no push. A pick by anyone not a fan before there's a call is refused; a fan's change once anyone else has picked is
  refused ("Your call stands").
- **The read:** `GET /api/sports/calls?couch=&league=` this season's call and rivalry games on the couch in the league: each game's
  event, its picks (person and side, public: Pick'em's only answer and a rivalry's side; never a rivalry's margin), and its final's
  winner once final (sports_events). The page works out the records (src/lib/sports/fan-call.ts, pure).
- **The engine:** none new. A call game is told from a rivalry by its spec (one side question shown as picked, no margin).
- **Watching:** `GET/POST /api/sports/watching?couch=&league=` (a migration: `sports_watching`). HOSTING.md first.

## Left out, and why

- **The victory lap** after a right call: C3.
- **Solo calls** (no couch, or picks kept private until the lock): C4. A fan's call here is public by design (backing needs it).
- **A push or a feed line for a call:** a call is news on the page, not a move; revisit after a real Sunday (BACKLOG).
- **A margin on a call:** the call is one tap; the margin duel is the rivalry's.
- **The hub's league card and scores strip** showing a call: they read one quiet line (round 3's settled card); a call there is later.
- **Daily sports' series framing:** a call is per game, as C1's rivalry.

## Open for the user

- **A call stands once backed.** Recommended (backs are stored as teams; a moved call would flip them). The other way: the fan can
  change it until kickoff and everyone's backing follows, which needs the backs stored as "with" or "against" the call.
