# A league's page, This week (sports-couch B1): the page spec (Intent, step 1)

2026-11-22, the `sports-couch` lane. Intent's `organize`, once. On the idea rounds' structure (round 1's
[sports-space-spec.md](sports-space-spec.md), "A league's space"; round 2's [sports-couch-play-spec.md](sports-couch-play-spec.md),
"The page"), the user's calls in [PLAN-sports-couch.md](../PLAN-sports-couch.md), and what A1–A3 built. B1 is "a session a tab":
this session builds the page's frame and its first tab, **This week**.

## The job

**A fan taps their league's card and sees the couch in that league this week: whose teams are playing whom, how they stand
against each other, and the one thing that's theirs to do.** The league itself (every score, the standings) is a tab away. What
makes this page ours and not ESPN's is the couch: faces on teams, friends' teams ranked against each other, rivalries kept.

## Where it lives (the structure)

- **A page, not a sheet.** `/league/<sport>/<code>/<tab>` (`/league/football/nfl/week`), depth 1 like a show space, up to the
  hub. Every door that opened the league's sheet opens it: the league card in Your shows, search's league row. Today's sheet goes.
- **The bar:** Home on the left; the league's name in caps with its week and season under it ("Week 12 · 2026"); A3's Follow toggle
  on the right (a show's bar keeps its follow state there too). No art: leagues have none (our marks, never logos).
- **The tabs, in order:** This week · Scores · Games · Standings · Chat, as the show space's five (round 1 and 2's order, Scores
  second because it's the league's own front page). Tab moves slide by order and replace history, as a show's do.
- **This session:** This week is designed and built. Scores and Games carry today's league sheet, split (Scores: the week day by
  day, `WeekRow`; Games: your games here and the two ways to start one), so nothing the sheet did is lost while their sessions come.
  **Standings and Chat stay off the tab bar until they're built** (a tab that says "coming soon" is a promise, not a place):
  Standings needs ESPN's standings (a new read), Chat a league room (chat is per season today). Open for the user: see the end.

## Situations, in rank order

| # | Who, when | What they need first |
| --- | --- | --- |
| 1 | Andrew, Sunday 1:40 PM, his Giants on at Riley's Eagles | the rivalry's state (on now, the score if he may see it), then where the couch's teams stand |
| 2 | Joanna, Wednesday, told "we're doing the NFL thing" | the due move named in plain words, one tap |
| 3 | Anyone, midweek | this week's rivalry (who meets whom, when), the couch's table, their games here |
| 4 | Conor tinkers | the table's records and form, every rivalry this season, the rest of the league one tap away |
| 5 | Hiding sports scores | the same page with no result in it (no records, form, scores, rivalry results) and one place to show them |
| 6 | Only one couch team in the league (Andrew, the lone Giants fan) | his team on the couch's table with his face; no rivalry section |
| 7 | A league followed with no couch team (a spectator) | the rest of the league leads; a line saying nobody here follows a team yet |
| 8 | Solo (on no couch) | "Your teams" in place of the couch's, no rivalries (they need two fans) |
| 9 | A team on a bye | its row says Bye, never an empty slot |
| 10 | A daily sport (the NBA, a Monday-to-Sunday week) | a team's row shows its next game this week and how many more |
| 11 | Off-season (MLB in November) | that it's the off-season and when it's back; the couch's teams without records |
| 12 | A big couch (10+) | faces then a count on each row; the table lists teams, not people |

## This week, in rank order

1. **Your move, when one's due** (situations 2, 3): one strip at the top, the page's one yellow, the move in its own words ("Make
   your picks · Pick'em on Week 12", the move's text), opening the move. Two or more: the first, and "+1 more" in it, opening Your
   games. Only moves in this league's games. Not drawn when nothing's due: the page never invents a yellow.
2. **The rivalry this week** (situations 1, 3), when two couch members' teams meet and the fans differ: the two people over their
   teams (mark, name, record), the game's day and time (or Started/On now/Final as the score rule allows, with the score when it
   may show), and one outlined way in, **Start a game on it** (today's Start a game on that one game; Winner and margin and
   sides are C1's). Two this week: the next one here, the other under Rivalries this season. No VS slab (2026-11-12).
3. **The couch's teams, ranked by record** (every situation): each team one row of at most two lines: rank, mark, name, its
   fans' faces (yours first), the record (ties half, as standings count) on line one; the last five results as form ticks and
   this week's game ("Sun 1:00 PM at Eagles", "Bye", "On now", "Final 19–11") on line two. A team plays once on this page: here,
   never again in a schedule list (round 2's R1). Your team is found by your face. Tap: the team's sheet (B2 makes it a page).
4. **Rivalries this season** (situation 4): each meeting between two couch members' teams this season, played (who won, the score
   when it may show, the winning fan) and to come (when); the couch's rivalry record by fan at the head ("Andrew 2–0"). The next
   two to come and the last two played; the rest fold under "All N".
5. **Your games here** (situations 2, 4): each game of yours in this league, its due move in its words, as the sheet's rows;
   then the sheet's **Play this week's games** (Pick'em on every game still to come), outlined while a move is due.
6. **The rest of the league:** one row, "The rest of Week 12 · 13 games", opening Scores.

**Left out of This week, and why.** The room's latest line (round 2's item 5): there's no league room until Chat's session; a
season's chat line here would be a different room. Sides, Back or Fade, a fan's calls, the challenge, the victory lap and stakes
are Phase C's. The line (A1's "LAC by 3") is the strip's and Scores', not the table's. Live points are PLAN-sports-ready Phase 5.

## The score rule here

This is a sports page you opened, so it follows the sports screens' rule (`useGameScore`, the team sheet's): with Hide sports
scores off, results show; on, none do. Every result here (a record, a form tick, a score, a rivalry's winner, the table's order)
is a result, so with hiding on: the table lists the couch's teams yours first and then by fans, with no records, form or results;
the rivalry says Started; and the table's head offers **Show records**, which shows every result on the page for the visit (each
game through `showScore`). The hub's 36-hour ask (A1) is the hub's: it's where results arrive unasked.

## Each surface and its verdict

| Level | Questions (casual · sweat) | Data held | Today | Verdict |
| --- | --- | --- | --- | --- |
| The page's frame | Where am I? Follow? · its tabs | league-now, follows | the league sheet | **new screen** |
| This week | Is my team on? Who's playing whom? What's mine? · the couch's table, rivalries | the week's games, the couch's teams, your games | the sheet (week list) | **new display** |
| The rivalry | When, who's with whom, the score · the fans' records | the week's game, follows, records | none | **new display** |
| The couch's table | Where does my team stand on the couch? · form, records | team schedules (a new read across teams) | league card's one line | **new display** |
| Rivalries this season | Who's winning the couch's rivalries? · every meeting | team schedules | none | **new display** |
| Your games here | What's mine, what's due? | home moves, sport seasons | the sheet's rows | **keep** (they're the sheet's approved rows) |
| A team (tap a row) | When's the next game? · schedule | team schedule | team sheet | **keep** this session (B2's page) |
| A game (tap the rivalry) | Score, play | team schedule | game sheet | **keep** (B4's sheet) |
| Scores, Games tabs | the week, start a game | the week | the sheet's parts | **keep** for now, moved (their sessions) |

## The data (what's new)

- **A league's week by its dates:** league-now gains the week's first and last day (`from`, `to`), so This week reads the league's
  own week (football's Thursday to Monday as ESPN cuts it, a daily sport's Monday to Sunday) through the existing week read.
- **The couch's table:** one new read, `GET /api/sports/league/teams?league=&teams=`, the same for everyone (edge-kept like a
  team's schedule): for each team its record (regular season finals, ties counted), its last five results, and the meetings among
  the asked teams this season. Built from the team schedules the team sheet already reads (cached), pure where it can be
  (`src/lib/sports/couch-table.ts`, tested). The phone joins it with the couch's follows (who follows which team) and hides what
  the score rule hides. HOSTING.md gets its entry.
- No migration, no engine change (UI-REVIEW-MAP doesn't apply).

## Open for the user

- **Standings and Chat off the tab bar until built** (three tabs now, five by B1's end), or all five now with the unbuilt two
  saying when they come. Recommended: off until built.
- **The score rule here is the sports pages'** (results show unless you hide scores), not the hub's 36-hour ask.
