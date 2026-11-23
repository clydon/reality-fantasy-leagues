# Add a show or team: the check (sports-couch B3, step 4)

The built search at 390 (story-search.js's frames in `.ui-atlas/stories/search/after/`: empty, empty-sports, team-zt, team-hidden,
team, matchup, league, ambiguous, show, mixed, event-golf, event-f1, none, scope-sports, more-shows, flow-game, failed, firstrun,
firstrun-wall, studio), checked once by PFD's `evaluate` (against [search-first-view.md](search-first-view.md) R1-R5) and once by
Impeccable's `critique` (a design review and the detector, run as two separate agents). Neither saw the other's output. Settled
things (one yellow and none in search, the scorebug's look, the game's sheet, Follow's toggle, tours with no action, faces with
names) are not findings.

## PFD evaluate (once)

Foundation 80 · L1 78 · L2 76 · L3 62 · L4 80 · overall 76. No caps apply.

What passes: the first views hold at most four chunks (a card, then three rows, then More); "From the TV listings" names the group
once instead of ten chips (R1). Marks and the bug's fixed right column read as sports before a word is read; the card is about
150 px, under R2's 190 (R2). The bug, Follow and the game words ("Thu 4:30 PM at Cowboys", "Season starts Mar 25") match the rest
of the app (R3). Eagles, Giants (New York in season, San Francisco a row), NFL, Eagles at Cowboys, Survivor and golf each put the
likeliest meaning first, and the entries name teams (R4). One way in, at most one reversible action per result, no yellow, tours
not tappable (R5).

| # | Severity | Layer, req. | Finding (frame) | Fix |
| --- | --- | --- | --- | --- |
| P1 | Major | L3, R4 | "bear" gets no Bears card: five TV listings (The Bear, Breaking Bear, Little Bear, Bossy Bear, Paddington Bear) come first and Chicago Bears is the sixth result, at the fold (mixed). Spec situation 6 wants the Bears' card. The cause: the card needs a team score of 96 or more, and "bear" against "Bears" scores lower. The same will happen for giant, eagle, jet and bill. | In the scoring, treat a singular or plural form of a pro team's short name as an exact match, so the card fires and The Bear leads Shows directly under it. |
| P2 | Major | L3, R4 (the gap) | With ESPN not answering, the sports part is simply missing: "zt eagles" shows only Add by name, the same picture as "zzqx" (failed vs none). The code has "Teams didn't load · Try again", but the query retries three times by default (about 7 s), and SportsRows draws nothing while it waits. So for those seconds the screen says "this app doesn't do sports", which is the trust R4 exists to earn. | One retry at most for the sports search, then "Teams didn't load · Try again" in the sports place. Show a one-line placeholder while it's looking. Re-shoot the frame once the failure has landed. |
| P3 | Major | L3 (prediction) | The sheet sizes to its results, so the field and the scopes move as you type and when you tap a scope. Between queries the field's top sits anywhere from about 186 to 543 px (team vs failed). Tapping Sports on "giants" moved the tab row itself down 100 px (ambiguous vs scope-sports). A control that moves under the thumb breaks the prediction every later tap relies on. | Once the sheet is searching, open it at a fixed height (near full height) so the field and the scopes never move. |
| P4 | Minor | L2, R3 | The league card says "NFL" twice (the tile and the name), and its line cuts off at "Week 11 · National Football L…". The spec's "4 on now" and the couch's follower count are missing (league). | Line: "Week 11 · 4 on now · Sam follows it" (faces with names). Drop the full name, or give it to the tile's accessible name. |
| P5 | Minor | L2, R3 | The day is written three ways: "NEXT GAME · THU" (team), "NEXT GAME · SUN, NOV 29" (ambiguous), and "Their next meeting · Thu" (matchup), where the spec says "Thu Nov 26". On a Sunday, a bare "Thu" makes the reader work out which Thursday. | Always write the day and the date ("Thu, Nov 26"), the form ambiguous already uses. |
| P6 | Minor | L1, R2 | The tour and league tiles are grey squares of caps letters, the same look as a TV listing with no poster ("G Golf Central" directly under "PGA / DPW / LIV"), so tours and listings blur before they're read (event-golf). Formula 1's tile reads "FORM" (event-f1). | A short-name map for tiles (F1, DPWT, LIV, UFC). Give leagues and tours a mark that differs from the no-poster tile (the league's own clipped mark shape, like the team marks). |
| P7 | Minor | L0, R1 | Under the matchup card, "More teams" lists the card's own two teams, so "More" promises something new and repeats instead (matchup). | Head them "The teams" (each opens its page), or "More teams" only when there are others. |
| P8 | Minor | L3, R4 | Before typing, All shows three posters with no group name: ZT Traitors 5 has "zt_nd_riley watches", while Survivor 51 and The Traitors 5 say nothing of why they're there. The teams group under it is named (empty). | Name the posters' group ("Your couch watches", and "Ready to add" for the rest), the way "Your couch follows" is named. |
| P9 | Minor | L1 | On first run's wall, the picked team's tile is a small mark on a bare grey panel among full-bleed posters, and "followed when you save" wraps to leave "save" alone on a line (firstrun-wall). The shape brief asked for the tile in the team's colour. | Fill the tile with the team's colour, show the mark larger, and shorten the line to "A team · followed on save". |
| P10 | Minor | L4 | In Studio, the scrim barely dims the hub: its dark hero card and the yellow "EP 6 / Pick who survives" plate sit at near full strength above the sheet, a second call to action next to search (studio). | Give Studio's scrim the dimming Night's has. |
| P11 | Cosmetic | L0 | "TV listings from TVmaze" shows on views with no listings at all (empty-sports, scope-sports, team-zt). | Show the credit only when TV listings are on screen. |
| P12 | Cosmetic | L2, R3 | First run's bug has no records (3-7, 5-6) where Add's does (firstrun vs team). It's probably the signed-out default of hiding scores, but the line ("DAL by 8.5") still shows. | Confirm it's on purpose. If so, leave it; if not, draw first run's bug the way Add draws it. |

**Not covered by any frame:** the couch line with another member following the card's team (team-zt is the viewer's own team, so
it shows Following and no line), the loading placeholder, and Sports' "No team or league by that name".

## Impeccable critique (once: a design review and the detector, run apart)

**Design review:** the parts are authored for this product, not generic: the clipped team marks, the shared bug with its right
column, the caps captions, the honest tour line. "From the TV listings" replacing ten chips is the round's best cut in load. Nielsen
**25/40** (status 2, real world 3, control 3, consistency 3, error prevention 2, recognition 3, flexibility 3, minimalism 3,
recovery 1, help 2): acceptable, held back by the invisible sports states.

**Detector:** exit 0. 36 advisory `design-system-font-size` notes, nothing else:
- 14px ×15 and 12px ×13, both house sizes (14px is used 572 times across src/new). These are false positives: DESIGN.md's ramp is
  out of date, not this code.
- 20px ×6, 46px ×2 and 17px ×1 are on other first-run screens, out of scope.
- One real drift: the poster tile title at 18px (watching/search.tsx:190), where caption-md is 19.

The frames' overlap scan found one hit: on a show with no poster, the faded name behind the poster collides with its title (empty).

| # | Severity | Finding (frame) | Fix |
| --- | --- | --- | --- |
| C1 | Major | Nothing shows that sports is loading or has failed (failed; and every query before ESPN answers). SportsRows returns nothing until there's data, "failed" waits out the default retries, and Add by name doesn't wait for sports. So a fan whose team is slow to come back is offered "Add 'zt eagles' as a new show", and might add their team as a TV show. | While the words are 2+ characters, always draw a sports slot: a one-row pulse, "Looking for teams…". Fail fast (one retry, about a 3 s cap) to "Teams didn't load · Try again". Hold Add by name until sports has answered or failed. |
| C2 | Major | "bear" misses spec situation 6: no card, Paddington and friends first, Chicago Bears sixth (mixed). The singular and plural form every team name has. | Score a singular or plural stem of a team's short name as exact. Failing that, when there's no card but there is an in-season pro team, cap the listings at three and put Teams first. |
| C3 | Major | The layout moves under the thumb. The sheet sizes to its content, so the field jumps between queries (team, league, matchup, failed, event-f1). Within one query, the card lands after the 300 ms pause plus the fetch: it inserts above what you're reading, and the listings drop from ten to three. | Pin the sheet at full height once typing starts. Hold the card's place with the shape brief's 120 px pulse when the words could be sports. Or draw once both sources answer, within about 400 ms. |
| C4 | Minor | The card has no panel (`CARD = "mt-4"`, sports/search.tsx:104). The header, a caption and the bug float on the sheet, so the result reads as a heading plus a separate scorebug, not one result with two tap zones (team, ambiguous, matchup). | Build the shape brief's panel (`bg-card`, 4 px corners) holding the header, the couch line and the bug. |
| C5 | Minor | The league card and the tour rows look unfinished. "NFL / NFL", a cut-off line, and no "on now" or couch count (league). `LeagueTile` cuts names at four letters, giving "FORM" and "DP W" (event-f1, event-golf). The tours sit under "Leagues", and "its page and games come later" is said on every row (event-golf). | A short-name map for tiles. League line "Week 11 · 4 on now". Tours under their own "Tours" caption that says "pages come later" once, each row's line giving what's next ("RSM Classic · Thu"). |
| C6 | Minor | League state words aren't each league's own (empty-sports, ambiguous, team). "Week 5" means nothing for the NBA or NHL. MLB's "Off-season" drops the spec's "back Mar 26". The Premier League's "In season" says nothing. College rows give no season words, and Boston College shows as its baseball team in November. | Each league's own words ("Matchweek 12", "8 on today", "Off-season · back Mar 26"). In-season leagues first. A college school resolves to its in-season sport. |
| C7 | Minor | "More shows" opens with no way to fold it, and once open, the field and the scopes scroll out of view (more-shows). | Add a "Fewer shows" fold at the list's end, and keep the field and the scopes pinned at the sheet's top while it scrolls. |
| C8 | Minor | First run draws search differently from Add. The bug drops the records (firstrun vs team). Teams get a Pick pill while shows are picked by tapping the row. In code, Pick on a first-run matchup card picks only the first team, and doesn't say which (sports/search.tsx:231). | Draw the same bug in both. A matchup card in first run picks both teams ("Pick both"), or offers no Pick and leaves it to the team rows. |
| C9 | Minor | On a show with no poster, the faded name behind the poster wraps and collides with the title over it (empty; the overlap scan's one hit). It's from before this round, but any show added by name will hit it. | Hold the faded name to one line (clip it, or show only its initial, as the listings' "G" tile does). |
| C10 | Cosmetic | "More teams" heads the matchup's own two teams (matchup). "Next game · Thu" is ambiguous on a Sunday (team, matchup). | "The teams"; "Thu, Nov 26". |
| C11 | Cosmetic | The subtitle "Playing is optional." doesn't help anyone search, least of all on first run under "Find a show or team" (firstrun). In Studio, the live red rule over the bug is faint against the light grey (studio). | Drop the subtitle in search, or use it to say what search finds ("Shows, teams and leagues"). Use Studio's live red token at full strength for the rule. |

**Kept, with the reason:**
- **No "You follow them" line on team-zt:** the Following toggle already says it, and the code leaves the line out on purpose.
- **The scope switch's 48 px** (A asked whether it earns its place): the spec keeps it, for browsing sports before typing (Sports'
  league tiles) and for the reader who sees the wrong kind first. It's quiet text tabs, as R1 asked.

## What to fix first (both checks agree)

1. **Make sports' loading and failure visible**, and hold Add by name until sports answers (P2, C1).
2. **Singular and plural team names count as exact** ("bear", "giant", "jet") (P1, C2).
3. **A fixed-height sheet while searching**, with the card's place held (P3, C3).

The Minors after that, in one batch: the league card's line and tile names, the dates, "The teams", the posters' group name, the
card panel, the native state words, the fold, and first run's parity.

*Process notes:* PFD's HTML rebuild and its insight log, and the critique's snapshot in `.impeccable/critique/`, were left out to
keep this check to one findings file. Critique's questions to the user were skipped: this ran as a sub-agent, and the caller
relays to the user.
