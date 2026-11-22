# A league's page, Standings (sports-couch B1, session 4): the page spec (Intent, step 1)

2026-11-22, the `sports-couch` lane. Intent's `organize`, once. On round 1's line ("Standings: the league's table by division or
conference; your teams marked. Needs ESPN standings, not read today": [sports-space-spec.md](sports-space-spec.md)), round 2's
("Standings is the league's table": [sports-couch-play-spec.md](sports-couch-play-spec.md)), the page's frame
([league-page-spec.md](league-page-spec.md)) and the tabs built before it (This week, Scores, Games). B1 is a session a tab; this is
the fourth. Chat is the fifth.

## The job

**Where every team in the league stands, read the way the league itself decides it, with the couch's teams found at a glance.**
This week already answers "how are the couch's teams doing against each other" (its table ranks only the couch's teams). Standings
answers the league's question: is my team leading its division, where would it be seeded, who's in the hunt. It's the one tab that
is all results, so Hide sports scores holds the whole tab, not row by row.

## What ESPN gives (verified 2026-11-22, `site.api.espn.com/apis/v2/sports/<league>/standings?level=3`)

One read answers both levels: the league's top groups (the NFL's AFC and NFC, MLB's American and National Leagues, the NBA's and
NHL's East and West) with their divisions under them; a league of one level (the WNBA's and MLS's conferences, a college sport's
conferences, a soccer league's one table) has its groups as the only level. Each team: its record (W-L, W-L-T, hockey's W-L-OTL),
its seed in its top group (the league's own order, tiebreaks applied: 1-16 in each NFL conference), games behind, points (hockey,
soccer), point differential, streak, last ten, home and road, against its division and its conference, and for soccer its rank and
a note per qualification place ("Champions League", a colour). A playoff race late in a season carries clinch letters (MLB: x, y,
e). ESPN lists a division's teams unordered (the NBA's Atlantic came 14th seed first): the order is ours, by seed (soccer by rank).
Not given: how many teams make the playoffs, so no playoff line except where ESPN marks it (a clinch letter, a soccer note).
Out of season it answers last season's final table.

## Structure, in rank order

1. **The view switch** (only for a league of two levels): **Division · Conference** (MLB: Division · League; the words from the
   league's own groups). Opens on the level the league's fans read: its divisions, except basketball's conferences (its divisions
   decide nothing about seeding). Kept for the visit per league.
2. **The couch's groups first.** Each group (a division, a conference, the table) a heading with its name, then its teams in the
   league's order. The groups that hold a couch team come first (yours first, then the couch's by how many fans), then the rest in
   the league's own order. Nothing is folded: a table is for scanning, and the NFL's eight divisions are 32 rows.
3. **A team's row:** its place in the group (in Conference, its seed), its mark and short name, the couch's faces on it (yours
   first), its record, and the one or two numbers that sport ranks by (below). Your team's row raised (the standings row "you"); a
   couch team's carries its faces only. Clinched and out, where ESPN says, in words ("In", "Out"), never letters.
4. **The row opens in place** (one at a time): the splits the sweat reads (home, road, division, conference, last ten, points for
   and against, streak, whichever the sport has) and **Open the Eagles ›** to the team's sheet (its schedule and form). A second
   tap closes it.
5. **Under the last group:** soccer's places key (each note's colour and words, only the notes the table uses), and "From ESPN, as
   of 2:14 PM".

**The columns, by sport** (the sport's own vocabulary, in `src/lib/sports/standings.ts`; the rule stays data: the numbers are
ESPN's): football W-L(-T) · PCT · DIFF; basketball and baseball W-L · PCT · GB; hockey W-L-OTL · PTS; soccer P · GD · PTS. A
column ESPN didn't give for a league isn't drawn.

## Situations, in rank order

| # | Who, when | First need |
| --- | --- | --- |
| 1 | Andrew, Sunday night: "are the Giants still leading the East?" | his division first, his row raised, the record |
| 2 | Riley, in the race: "where would the Eagles be seeded?" | Conference, one tap: the seed in the place column |
| 3 | Conor tinkers: tiebreaks, division records, last ten | the row's splits, in place |
| 4 | Joanna forgets and hides sports scores | nothing shown until she asks; one Show the standings |
| 5 | Watching a game as if live (a recording) in this league | held, said why, Show anyway |
| 6 | A spectator (follows the league, no team) | the table in the league's order, no couch groups first |
| 7 | Solo | his teams marked, his groups first |
| 8 | Off-season | last season's final table, said so |
| 9 | A daily sport mid-season (NBA, NHL) | Conference for the NBA, Division for the NHL; GB or PTS |
| 10 | Soccer | the one table by rank, its places key |
| 11 | College (12-32 conferences, 130-360 teams) | the couch's conferences first, the rest after |
| 12 | Loading, failed, none (a league ESPN has no table for) | a skeleton; Try again; one honest line |

## Each surface and its verdict

| Level | Questions (casual · sweat) | Data held | Today | Verdict |
| --- | --- | --- | --- | --- |
| The tab | Where's my team? · the whole race | ESPN's standings (new read) | none | **new screen** (data first) |
| The view switch | Division or seeds? | both levels in one read | none | **new display** |
| A group | Who leads? | entries, ordered by seed | none | **new display** (standings rows) |
| A team's row | Record, place · GB, PTS | entry stats, couch follows | This week's TeamRow (couch only) | **new display** on This week's row form (one line) |
| The row's splits | · home, road, div, conf, L10, PF/PA | entry stats | none | **new display** (in place) |
| The team's sheet (Open ›) | schedule, form | team schedule | the sheet | **keep** (B2 makes it a page; a team's record by week graphed lives there) |
| A week's results that moved the table | · | Scores has them | Scores tab | **keep** (one tab away; not repeated) |

## Hide sports scores, and watching as if live

The whole tab is results (every record, every place, the order itself). With Hide sports scores on, the tab shows the groups' names
and nothing else under one plate: "Standings carry every result so far" and **Show the standings** (for the visit; it isn't a
game's Show the score, so it moves no mark). With a game in this league being watched as if live and not yet watched, the same
plate says which game and **Show anyway**. Before Hide sports scores is known, nothing draws (BACKLOG 254 k). Off, the tab shows
straight away (the sports pages' rule, B1 decision 2).

## The data

**One new read** (HOSTING.md first): `GET /api/sports/league/standings?league=`, ESPN's standings read into our shape (a few KB:
each group, each team's id, place, seed and a dozen stats; college ~40 KB), kept in `sports_cache` 15 minutes (an hour for a
league of more than 100 teams: college's answer is 2.6-6 MB raw), edge-kept five minutes, open signed out and the same for
everyone (no person in it); the couch's faces join on the phone. Teams' colours from the league's team list (already cached a
week). No migration, no engine change.

## Left out, and why

- **A playoff line** where ESPN doesn't mark one: how many make it isn't in the data, and a hand-kept count per league is curation
  (the "universal, not curated" rule). Seeds in Conference say it; clinch words say it late in a season. For the user (below).
- **A team's place week by week, graphed:** ESPN's standings are now-only; a team's record by week is in its schedule, and that
  graph belongs on the team's page (B2).
- **Every column at once** (ESPN's wide table): at 390 it scrolls sideways and hides the team; the row's splits carry them.
- **Event sports** (golf, racing): their standings are a different read; with their own pages.

## Open for the user

- **The playoff line:** leave it to seeds and ESPN's clinch marks (recommended: data, not a table we keep), or keep a small count
  of playoff places per league.
- **Basketball opens on Conference**, everything else on Division (recommended: what each league's fans read).
