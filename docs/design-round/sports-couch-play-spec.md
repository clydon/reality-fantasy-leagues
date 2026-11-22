# How a couch plays sports: the journey spec (Intent, step 1)

> **Superseded in part (2026-11-22):** the league card's content is round 3's ([hub-scorebug-shape.md](hub-scorebug-shape.md)):
> your team's game moves to the scores strip under the guide, and the card keeps one quiet line. Everything else here stands,
> with the user's answers in [PLAN-sports-couch.md](../PLAN-sports-couch.md).

Idea round 2, 2026-11-22. The user, on round 1 ([sports-space-spec.md](sports-space-spec.md)): "the my shows NFL [card should]
basically be a mini hub … if you watch any team … you'd get their high level (Patriots > NFL, Yankees > MLB) and then clicking
into that will show what teams the couch watches/follows. The schedule, and maybe an option for a game for the league or game …
How do you think people would actually want to play this and have it be social and engaging … Andrew might follow the Giants and
be the only one to like the Giants in our couch, how can he show off that via watching/games he makes. A lot of sports could be
solo games. Or hey you are playing a rival (other couch members' team) here's a quick easy game you can play." Intent's
`journey`, once. Settled by the user: no separate sports hub; the league card on Your shows is the way in (round 1's A).

## What sports fans on a couch actually do

Before any screen: how friends already play sports with each other, with no app.
- **They wear a team.** "I'm a Giants guy" is identity, not a setting. It's said once and remembered by everyone.
- **They care about a friend's game because it's the friend's.** Nobody else on the couch follows the Giants, but everyone knows
  when Andrew's playing, and half of them root against him for fun.
- **Rivalries find them.** When two friends' teams meet, the group chat lights up days before: trash talk, a call, a friendly
  stake. After, the winner gloats and the loser hears about it until the rematch. The score of the friendship is kept for years.
- **The office pool is the weekly habit.** Pick'em every week, standings in the group chat, a winner at the end.
- **Plenty of fans play alone.** They call their team's games in their head ("we win this by a field goal") and keep a private
  sense of how often they're right.
- **Watching together is half of it**, even apart: texting the big play, a GIF at the final whistle.

So the social engine of sports is **allegiance**, where a show's is a shared story. The design follows from that.

## The play model: five ways in, from no effort to a season

| Way in | Effort | What it is | The engine |
| --- | --- | --- | --- |
| **Being a fan** | none | Follow a team and you're on the couch's map: your face on your team, your team's games on everyone's week, your team ranked against the couch's other teams, your rivalries kept | **New views** over follows, finals and records; no game |
| **One tap** | a tap | Pick a side in a rivalry; back or fade a fan's call; mark that you're watching; a GIF after the result | Pick'em on one game (plays), framed as sides; **new**: sides and calls as framing, watching for sports, the victory lap post |
| **A quick game** | a minute | The rivalry duel: Winner and margin on the one game; Game-night draft; Prop sheet; Squares for a big night | **Plays today** (Winner and margin, Game-night draft, Prop sheet, Squares) |
| **The couch's season** | a pick a game, weekly | Pick'em on the couch's games (only games a couch member's team plays), or on every game; Head-to-head pick'em | Pick'em and Head-to-head pick'em **play**; **new**: a slate of only the couch's games; Survivor pool is **coming** |
| **On your own** | a tap a game | Call your team's games all season (Pick'em on a team's games), a season call, a draft of your team's players; computer players if you want opponents | **Plays today** (Pick'em on a team's games, Winner and margin, Pick a few, a team's season draft, computer players); **new**: the season call |

The rule under all five: **the default game is the one people already play in their heads.** "Who wins, and by how much" is
Winner and margin; "I'm with Andrew" is a Pick'em pick; "the office pool" is Pick'em. Nothing to learn first.

## The way in: the league card, and the league's page

**The card (Your shows).** One per league you follow, directly or through a team (Patriots → NFL, Yankees → MLB). It reads the
couch, not only you:
1. its header: the league, the week, and the couch's teams as a row of marks;
2. your team's game, as the shared row, your face on your side;
3. the couch's headline in one line: a rivalry this week ("Sun 1:00 · Giants at Eagles · Andrew vs Riley"), else the couch's
   next game;
4. your games in one line, with the due dot.
Off-season, a card is one quiet line ("MLB · off-season · Yankees"), sorted to the bottom.

**The page (tap the card): This week · Scores · Games · Standings · Chat.** "This week" is the mini hub the user described:
1. the strip: your one due move (the one yellow);
2. **the rivalry**, when two couch members' teams meet: the two fans and their records, who's with whom, Pick a side, the duel;
3. **the couch's teams, ranked by record**: each team with its fans' faces, its form, its record and this week's game. This is
   also the couch's schedule, so a game appears once;
4. **rivalries this season**: the couch's head-to-head record, played and still to come;
5. your games on the league, and the room's latest line;
6. the rest of the league's games, one tap to Scores.
Scores is round 1's scoreboard. Games is the play model in three groups: with the couch, rivals, on your own. Standings is the
league's table (data not read yet). Chat is the room plus a thread per game.

## Journey 1: Andrew, the only Giants fan (a habit, not a quest)

Andrew drives by (the round frame's persona): a move must be a tap. The journey repeats weekly, so it's shaped as introduction,
development, twist and settling (kishōtenketsu), not a quest.
1. **He follows the Giants** (search, one tap). The NFL card appears on his hub. On everyone's NFL page the Giants join the couch's
   teams with his face: *Andrew's Giants*. Nobody else had to follow them.
2. **Every week his game is on everyone's page.** "Giants · Andrew · at Eagles, Sun 1:00 PM". The couch knows when he's on.
3. **He makes his call** from his card or the Giants' row: winner and margin, one tap with the Giants already chosen. The couch can
   **Back** him or **Fade** him with one tap each. His calls keep a record ("Andrew's calls: 7–1"). Fading Andrew becomes the
   couch's running game, played by people who don't care about the Giants but care about Andrew.
4. **He makes games on his team**: "Call every Giants game" (Pick'em on a team's games) open to the couch, or a Game-night draft
   on Thursday's game. They show on the Giants' page as *Andrew's games*, with Join.
5. **He watches.** Marking a game as watching puts his face on its row and opens its thread.
6. **The twist: a rivalry.** When the Giants meet Riley's Eagles, the lone fan has a rival and the couch takes sides (journey 2).
7. **He takes a victory lap.** After a win, one prompt: "Giants won. Take a victory lap?" A GIF and a line go to the couch's feed
   and the NFL room. Nobody hiding sports scores sees it until they've seen the result.
8. **His season shows on the Giants' page**: his fan card (since when, calls, his season call against the couch's calls on his
   team), the rivalries he's won, and the schedule with each rivalry marked.

**What he shows off with:** his team ranked on the couch (the Giants lead it at 4–2–1 going into Week 9), his calls record, his
rivalry wins, his victory laps, the games he runs. None of it needs anyone else to follow the Giants.

## Journey 2: a rivalry (Giants at Eagles, Week 9: Andrew vs Riley)

1. **Found, not made.** When the week's schedule is set, the app sees two couch fans' teams meeting. Everyone's NFL card says so in
   one line; the page leads with it. No push for this: it's news, not a move.
2. **A challenge, in one sheet.** Either fan taps Make it a game: Winner and margin is chosen (a point for the winner, a point for
   the closer margin), with Just the winner, Game-night draft and Prop sheet beside it. Their own team is already picked. Two
   options under it: the couch can pick a side (on), and a stake (off): the loser's face wears the winner's colours on the couch
   for a week, only if both say yes. Challenge Andrew sends **one** notification (an invite: invites always reach).
3. **Accepted in one tap.** Andrew's notification opens his call with the Giants chosen and a margin of 3; Accept is the yellow;
   Not this time is plain.
4. **The couch picks sides.** Sam, Joanna and you see Pick a side: one tap on Giants or Eagles. Sides are public as they're
   picked (that's the fun); margins stay hidden until kickoff (so nobody copies the margin).
5. **Game day.** The row shows the fans on each side, who's watching, and the thread. Live points wait on the sports plan's Phase 5.
6. **The result** (real: Giants 19, Eagles 11). Andrew had the winner and the closer margin (Giants by 6, off by 2; Riley had Eagles
   by 3). The couch's sides settle (Sam and you with Andrew, right; Joanna with Riley). The rivalry record moves: Andrew 2–0 in the
   couch's rivalries this season. One push to each player when it's decided (the sports plan's 217: no score for anyone hiding
   scores). Andrew gets the victory lap prompt. A stake, if set, starts.
7. **The rematch** is already on the page: Week 18, Eagles at Giants.

The couch's real rivalry calendar for 2026, from the schedule: Week 1 Giants beat Cowboys 28–20 (Andrew over Joanna); Week 6
Patriots beat Jets 26–19 (you over Sam); Week 7 Cowboys beat Eagles 38–21 (Joanna over Riley); Week 9 Giants at Eagles; Week 12
Eagles at Cowboys on Thanksgiving (Riley vs Joanna); Week 16 Patriots at Jets (you vs Sam); Week 17 Giants at Cowboys (Andrew vs
Joanna); Week 18 Eagles at Giants (Riley vs Andrew).

## Journey 3: on your own (you and the Patriots)

1. The first time you open your team's game, its sheet offers **Your call**: who wins (and by how much, if you like). One tap
   starts a standing solo game, Pick'em on the Patriots' games, with no setup screen. Each later game asks again from the card.
2. Your record builds: "Your Patriots calls: 6–2". The couch sees the record if Privacy allows; the picks stay yours until each
   game locks.
3. More if you want it: a season call ("Patriots finish 11–6", new), a draft of Patriots players for the season (a team's season,
   its players only: plays), computer players as opponents (plays). Any solo game can be opened to the couch later.

## Journey 4: the couch's weekly game

1. **Recommended default: Pick'em on the couch's games**, only games a couch member's team plays (Week 9: four games). Every pick
   is also a side in a friend's game, so the pool and the fandom are one thing. Every game, Head-to-head pick'em and (when it
   plays) Survivor pool are the sweats' options in the same place.
2. Due on Your moves and the strip like any game; standings as a ladder of faces; the week's winner in the feed; the season's on
   the trophy shelf.
3. A homer pick is part of the fun: picking against your own team gets noticed ("Riley picked against the Eagles").

## The week's rhythm (NFL)

Mon–Tue: last week settles; the couch's table and rivalries move; this week's rivalries appear; picks open. Wed–Thu: calls,
challenges, sides, trash talk; Thursday night locks first. Sunday: watching, threads, the result moments. Sunday night–Monday:
victory laps, the pool's winner, the table. Daily sports (NBA, NHL, MLB) run the same model by **series**: a rivalry is a series
(Yankees at Red Sox, three games), a fan's call is for the series, and the card shows this series rather than this game. Event
sports (golf, F1, UFC) are followed by a person rather than a team: later.

## Edge cases the screens must hold

- **Two fans of one team** share its row (both faces); they're teammates in its rivalries.
- **A fan of two teams in a league:** one is "my team" (the first followed; changed from the team's page) for the couch's table and
  rivalries; the others still show their games.
- **Someone with no team:** a spectator. Sides, backing and fading are made for them; nothing asks them to pick a team.
- **Hiding sports scores:** finals, the table's records, the rivalry record, victory laps and the pool hold back until they show
  the week (the sports reveal, the plan's 4.2 page 3).
- **A big couch (10+):** sides show faces then a count; the table lists teams, not people.
- **No rivalry this week:** the page leads with your team's game; the rivalry section isn't drawn.
- **Off-season:** the card is a line; the page shows last season's table and when the next one starts.

## Not this

No money, ever (points, never money). No countdowns or "last chance" pressure. No streak guilt. One prompt per rivalry and one
per win, each easy to ignore with plain words ("Not this time", never shaming copy). A stake is cosmetic and needs both fans' yes.

## What's new (none of it is built)

A league follow and "my team" per league; the couch's table (records from ESPN's standings, not read yet); rivalry detection and
the couch's rivalry record (from finals and follows); sides and back-or-fade as framing over Pick'em on one game; a challenge (an
invite to one person); watching marks for sports; the victory lap post; the season call; the stake; a slate of only the couch's
games. What plays today: Pick'em (a team's games, a slate), Winner and margin, Head-to-head pick'em, Game-night draft, Prop sheet,
Pick a few, Squares, a team's season draft, computer players.

## Measures (light)

Of fans who follow a team: the share who make a call or pick a side in a week; rivalry games where three or more of the couch take
part; solo calls per fan per week; who returns on game day. Counter-measures: notification opt-outs and muted couches after a
rivalry week, and "Not this time" rates on challenges.
