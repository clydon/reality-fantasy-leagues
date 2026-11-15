# The game page, step 2c: side by side, and the game's own scoring table

The user's review of 2b, with the structural lens ([DESIGN-PROCESS.md](../DESIGN-PROCESS.md)): a matchup should read across,
your QB against theirs, as fantasy apps do; and a game needs tables in its own scoring, while the show's tabs stay free of any
one game's points (Phase 0's decision 6). Extends [2b's drill tree](step2b-drill-tree.md).

## One part, three lenses: the stat table

| Lens | Where | Rows | Columns | Opens |
| --- | --- | --- | --- | --- |
| The show | Players / Cast (step 5) | Everyone in the show | The show's own facts (still in, challenge wins, votes; a sport's real stats). Never a game's points | A person's story |
| **The game** (2c) | A door under Your team: "Everyone in this game" (and later the draft room and waivers, with a pick or claim action) | Everyone in the pool | Points each week under this game's scoring, pinned total; who has them, or Free | The cast or athlete sheet |
| **The matchup** (2c) | The matchup sheet | Pairs (below) | Each side's player, the slot, each side's points on one scale | The two-player compare |

## The paired matchup

- **A sport:** both lineups ordered by position (QB, RB, WR, TE, then K, DEF); rows pair the same position across, your nth
  RB against their nth RB; whoever is left without a partner pairs as **Flex**. Each row: your player (face, name, position),
  your points, the slot, their points, their player. Your side on the left, always.
- **A show:** slots are interchangeable, so a slot pairing would be invented. Once a week is scored, rows pair by rank (your
  best against their best), the slot column reading "Best", "2nd best". Before results: two lists (before the lock yours and
  their whole team, as 2b; locked, both lineups with each name's season points, labelled "season pts").
- **A sport, locked, no results:** the pairs without points.
- **Encoding:** one pair of colours for yours and theirs everywhere (bone and grey, never a person's face colour); each row's
  higher number bold, the lower muted; bars grow outward from the slot on one scale, and a negative is a short outline pointing
  back toward the slot, never a long bar.
- Each row opens **the compare**: the two players side by side, one chart of their points each week in this game (two series
  on one scale), their totals and who holds each; each player's sheet one tap on.

## The game's scoring table

- The first view: the filter (All, Free, Mine; a sport adds positions and a search), then rows sorted by total; each row a face,
  a name (and position), who has them (faces, or Free), last week, the total. Weeks scroll in from the right, a column each.
- At a sport's size (300+): search and position first, the first 40 rows, then "Show 40 more".
- It reads the game's own scoring: a game whose maker changed the points shows those points, never the show's.

## First views (PFD's rules inside each)

- **Matchup:** the card's head (faces, result, totals), then the pairs: one row per slot, at most nine in view on a sport.
- **Compare:** the two faces and totals, then the chart; the week-by-week numbers under it.
- **Scoring table:** the filter row, then the rows; nothing above the table but its title.

## Spoilers

Every number stops at the viewer's mark (the view's own copy). Others' starters only from the lock.

## Data (reads, no rules)

- Every player's points per week at the game's scoring (`castWeeks`): a show's from each episode's events at the game's points;
  a sport's from each game's stat line at the game's table.
- A sport's weekly lines (BACKLOG 74): who started, the bench, each line's points and its top stats, from the stat lines.

## Built and checked (2026-11-15)

Built in `src/new/show/game-week.tsx` (PairRow, PairedLineups, CompareBody, GameTable) on reads in `src/lib/game/week-view.ts`
(`castWeeks`, `statWeeksOf`); story version 3 (https://claude.ai/artifact/YBQtP9VztyMFaAZMVxDZ1A, section "2c: Compare").

| Reviewer | Verdict | What its one batch fixed |
| --- | --- | --- |
| Impeccable, design review | 24/40 | A locked show no longer pairs; the compare in yours-and-theirs colours, the week you came from tinted; the table opens on the latest week, sorts by any week, tints your rows, says when a search finds nobody |
| Impeccable, detector | Exit 0; 11 of 43 notes real | Holders' initials replaced by names; parts that didn't add up to their totals; the slot label's alignment |
| PFD evaluation | 64 | A negative no longer the longest bar; one pair of colours; numbers labelled with what they count ("41.4 over 2 weeks", "season pts") |

Open, found by the confirming look and not chased: the show's table opens scrolled to the latest week and the first week's
numbers peek half-cut from under the pinned names; a sport's words on the bench ("G 2", "active-roster" in the crumb; BACKLOG 75).
