# Add a show or team: the check and its one batch (step 4)

The built sheet at 390 (story-search.js's frames in `.ui-atlas/stories/search/after/`), checked once by PFD's `evaluate` (against
[search-first-view.md](search-first-view.md)) and Impeccable's `critique` (a design review and the detector, run apart), by a fresh
agent that hadn't seen the build's reasoning. Its full findings: [search-check-findings.md](search-check-findings.md). Every finding
below was fixed in one batch, or is listed as kept or open.

Before the check, the build's own first look fixed: the card's title truncating ("PHILADELPHIA …": now the short name over its city),
the card inset off the rows' edge, the tiles with no surface, "You follow them" repeating Following, the stand-in world's leagues all
"In season" (the frame now reads real ESPN), "golf" opening on ten listings (a sport's own word now leads with its tours), listings
uncapped above the teams (five when sports rows follow).

## PFD evaluate (once)

Foundation 80 · L1 78 · L2 76 · L3 62 · L4 80 · overall 76.

| # | Severity | Finding | Fix (one batch) |
| --- | --- | --- | --- |
| P1 | Major | "bear" got no card: "bear" against "Bears" scored under 96, so five listings led and the Bears came sixth (mixed). | teams.ts `teamScore`: one or many of a team's short name is the name (96); a test. The Bears' card now leads, The Bear first among shows under it. |
| P2 | Major | ESPN failing was invisible: the failed frame looked like no match, and offered "Add as a new show" (failed). | The search retries once, not three times; "Teams didn't load · Try again"; "Looking for teams…" while it looks; Add by name waits for sports. |
| P3 | Major | The field and scopes moved between queries and on a scope tap (100 px on "giants" → Sports). | `Sheet tall`: the search sheet holds its full height; the field and scopes stick to its top. |
| P4 | Minor | The league card said "NFL" twice and its line was cut. | Its full name as the title (when it fits), its week as the line; the couch's follows on the line under. ("4 on now" is open: no live count is read here.) |
| P5 | Minor | The day three ways ("Thu", "Sun, Nov 29", "Their next meeting · Thu"). | One form in search: "Today", "Tomorrow", else "Thu, Nov 26". |
| P6 | Minor | Tour and league tiles read as poster-less listings; "FORM" for Formula 1. | A mark map (F1, PGA, DPWT, LIV, UFC…), initials otherwise. (A distinct mark shape: kept, see below.) |
| P7 | Minor | Under a matchup, "More teams" repeated the card's own teams. | "The teams" under a matchup. |
| P8 | Minor | Before typing, All's posters had no group name. | "Shows to add". |
| P9 | Minor | First run's picked team was a bare grey tile; "save" alone on a line. | The tile in the team's colour; "A team to follow". |
| P10 | Minor | Studio's scrim barely dims the hub behind the sheet. | Open: every sheet's scrim, not this sheet's. |
| P11 | Cosmetic | "TV listings from TVmaze" on views with no listings. | Only when listings (or the shows to add) are on screen. |
| P12 | Cosmetic | First run's scorebug has no records. | Kept: signed out, the league's week (where records come from) isn't read; the bug says the rest. |

## Impeccable critique (once: a design review and the detector, run apart)

**Design review:** Nielsen 25/40 (status 2, real world 3, control 3, consistency 3, prevention 2, recognition 3, flexibility 3,
minimalism 3, recovery 1, help 2). **Detector:** exit 0, 36 advisory font-size notes, all but one the house 12 and 14 px sizes
DESIGN.md's ramp doesn't list (DESIGN.md's to update); the one drift (a poster title at 18 px) is the old SuggestionCard's. The
overlap scan: one hit, a poster-less show's faded name under its title (the old SuggestionCard's, before this round).

| # | Severity | Finding | Fix (one batch) |
| --- | --- | --- | --- |
| C1 | Major | Nothing showed sports loading or failing; Add by name didn't wait. | As P2. |
| C2 | Major | "bear" got no card. | As P1. |
| C3 | Major | The layout moved under the thumb. | As P3; the card's place holds a pulse while its schedule reads. |
| C4 | Minor | The card has no panel (the shape brief said one). | Kept: the sheet is the card colour, so the brief's panel drew nothing; a raised panel would be a second fill around the scorebug's own. The card is flush with the rows, the bug its only fill; the shape brief is updated. |
| C5 | Minor | Tiles cut at four letters; tours under "Leagues"; "its page and games come later" on every row. | The mark map; a "Tours" caption with "Their own pages and games come later." said once. |
| C6 | Minor | League words not each league's own ("Week 5" for the NBA; "Off-season" without a date; Boston College as its baseball team in November). | Open: the words are the league card's (LeagueNow, A2), one change for every surface; a college school's in-season sport is a search-wide change. |
| C7 | Minor | "More shows" couldn't fold; the field scrolled away. | "Fewer shows" / "Fewer teams" fold back; the field sticks. |
| C8 | Minor | First run's matchup Pick picked only the first team. | Pick picks (and unpicks) both. |
| C9 | Minor | The poster-less overlap. | Open: SuggestionCard's, before this round (it's in the before frames too). |
| C10 | Cosmetic | "More teams" under a matchup; "Thu". | As P7 and P5. |
| C11 | Cosmetic | "Playing is optional." doesn't help search; Studio's live line faint. | The subtitle is "Shows, teams and leagues."; the live line is the scorebug's (A1's), kept. |

## The confirming look

One re-shoot of every frame (23 now: the check's missing three added, a card another couch member follows, Sports with no match, and
sports still looking): all pass, no yellow fill in search (one on the game's sheet, its Start), one overlap (C9, before this round).
Still showing, listed and not chased: on first run's picked-team tile the mark sits on its own colour; the stand-in team's city reads
"ZT" (the stand-in's names). `npm test`: 2,611 pass; tsc and ESLint clean; check-sports-couch.js: 128 pass, no failures (it stops at
BACKLOG 252's stale gallery step, as at B2 and B4).
