# Waivers v2: one claim type, replacement rules, waiver windows, smart defaults

**Status:** planned 2026-10-16; phase 1 (engine) built and committed (not pushed) 2026-10-16, see "As built:
phase 1". Phase 2's design picked 2026-10-16 ("Phase 2: picked design"); build it next. Builds on mid-season waivers
([PLAN-midseason-waivers.md](PLAN-midseason-waivers.md), shipped 2026-10-16); read that first for the
week, the clock, free agency, spoilers and privacy, which this keeps unchanged.

## Why

What the user ran into in their own leagues on 2026-10-16:

1. **"Pickups" didn't say what it did.** In Weekly Start/Bench (Active Roster) it only refills to one
   more than "Pick up when down to" (default: starting spots − 1): down to 2 of 5, you get 1.
2. **Fantasy football works differently by default**: a lost player is a free drop, there's one waiver
   order, nobody gets priority for being unlucky.
3. **Some leagues want the opposite.** Losing castaways early should hurt (in a shared league waiver
   order can't punish anyone, so the only lever is how many replacements a team gets), and "Last
   Survivor Standing" (Classic) wants nothing until the merge, then a full rebuild the commissioner opens.
4. **Add/drops only came on a fixed clock** (every N episodes), never when the commissioner wanted.

Decided with the user: keep it grounded. Three window schedules (every episode, every X episodes,
manual only), a few plain settings, and **good defaults worked out by the app** so most commissioners
never touch them. A Casual/Competitive switch nudges those defaults. No named styles, no
phase-detection schedules (considered and dropped as too much to explain).

## Vocabulary (what a person reads)

| Say | Meaning |
|---|---|
| **Claim** | "Add X, drop Y", ranked. The only kind there is |
| **Replace** | Drop a castaway who's out of the game for a free agent. The points they earned stay |
| **Swap** | Drop a castaway still in the game for a free agent. Their points go with them |
| **Waiver window** | When swaps are allowed (and, if the league says so, replacements) |
| **Waiver order**, **free agency**, **Process now**, **Undo last waiver run**, **Nudge** | as today |

"Pickup" and "Add/drop" leave player-facing copy; code keeps the `replenish`/`trade` log types.
"Trade" stays reserved for manager-to-manager trades (not planned).

## The settings

Three, on Waivers settings and in the create wizard, all prefilled by the recommendation below.

### When a castaway is voted out (`replaceRule`)

| Value | Label | Rule |
|---|---|---|
| `always` | **Replace them** | Every loss can be replaced, after any episode. |
| `whenShort` | **Only when short** (+ N stepper) | After any episode, but only back up to N + 1 still in the game. Today's Active Roster rule (`replenishAt`), now for Classic too. |
| `windows` | **Only in waiver windows** | Every loss can be replaced, but only when a waiver window opens. Until then the team plays short. |
| `never` | **Don't replace** | Out is out. |

The hint gives this league's numbers ("Down to 2 of 5: you'd replace 3 / 1 / 3 at the next window / 0").

### Waiver windows (`waiverWindows`)

- **Open** (`schedule`): **Every episode** · **Every X episodes** (`every`, stepper ≥ 2) · **Manual only**
  (the commissioner opens each one; see Commissioner).
- **Swaps per window** (`swaps`): 0 · 1 · 2 … **Whole team** (= roster size). 0 makes windows
  replacement-only (with `windows`).

Replacements under `always`/`whenShort` don't wait for a window: after every episode a waiver week
runs for them (as today), and it's also a window when the schedule says so. Under `windows`/`never`
only windows open.

### Casual · Balanced · Competitive (`waiverFeel`)

A three-way switch above the settings. Balanced is the recommendation; the other two move the
defaults one step (table below). Touching a setting afterwards keeps the switch where it is; the
recommendation card then says "Customized".

## Defaults: the recommendation

`WaiverLogic.recommend({ C, T, R, S, E, start, shared, type, feel })`, a pure function. Inputs are
things setup already knows: cast size `C`, teams `T`, roster size `R`, starting spots `S` (Classic:
`S = R`), episodes `E`, the league's first episode `start`, ownership, league type. Eliminator Pool has
no waivers: nothing to compute.

### Replacements

**Exclusive:** supply vs demand. About half the cast (and so half of every roster, and half the free
agents) is gone by the merge, so free agents per drafted spot is

```
s = C / (T·R) − 1
```

| `s` | `replaceRule` |
|---|---|
| ≥ 1 | `always` |
| 0.3 – 1 | `whenShort`, N = S − 1 |
| 0 – 0.3 | `windows` |
| ≤ 0 | `never` |

**Shared:** supply never runs out; the risk is everyone holding the same front-runners. Always
`whenShort`, N = S − 1. (Classic shared: no waivers, as today.)

**Classic:** one step stricter than the table (its scoring is about outlasting).

### Windows

- **Active Roster:** every X episodes, X = how often a typical team loses someone:
  ```
  r = (C − 3) / (E − 1)                    // eliminations per episode, ~1.25 for 18 castaways / 13 episodes
  X = clamp(round(C / (R · r)), 2, 4)      // roster 5 → 3, roster 4 → 4, roster 3 → 4
  ```
  1 swap per window.
- **Classic:** manual only. The commissioner sheet suggests Whole team (the merge rebuild).
- **Exclusive with `s ≤ 0`:** manual only, 0 swaps (nothing to claim).

Processing 24h; 48h when `T > 6`. Rolling waiver order. Free agency on. Auto-fill on.

### Casual · Competitive

| | Casual (forgiving, low effort) | Competitive (consequence, active) |
|---|---|---|
| `replaceRule` | one step more generous (`never → windows → whenShort → always`) | one step stricter |
| Every X | X + 1 | X − 1 (min: every episode) |
| Processing | 48h | 24h (12h if `T ≤ 4`) |
| Waiver order | least points first | rolling |
| Unclaimed replacements at airtime | auto-filled | **not filled**: miss the deadline, play short (`autoFill`) |

### Feasibility (setup)

`T·R ≤ C` or the draft can't fill; Active Roster exclusive also needs `T·S ≤ C − T`. Failing → the
wizard says so and offers shared ownership, a smaller roster, or Eliminator Pool (the "12 teams,
exclusive Active Roster" case).

### Worked examples (C = 18, E = 13) — each one a test

| League | Numbers | Balanced |
|---|---|---|
| Classic, 4 × 3, exclusive (**Last Survivor Standing**) | s = 0.5 → whenShort → Classic: `windows` | Only in waiver windows; manual only (open Whole team after the merge) |
| Active Roster, 3 × (3+2), shared (**Weekly Start/Bench**) | shared → whenShort (2); X = 3 | Only when short (2); every 3 episodes, 1 swap (= what it has today) |
| Active Roster, 3 × (3+2), exclusive | s = 0.2 → `windows`; X = 3 | Only in waiver windows; every 3 episodes, 1 swap |
| Active Roster, 4 × (3+1), exclusive | s = 0.125 → `windows`; X = 4 | Only in waiver windows; every 4 episodes, 1 swap |
| Active Roster, 3 × 4, exclusive, **24** castaways | s = 1 → `always`; X = 4 | Replace them; every 4 episodes, 1 swap |
| Active Roster, 12 × (3+2), shared | whenShort (2); X = 3; T > 6 | Only when short (2); every 3 episodes, 1 swap; 48h |
| Active Roster, 12 × anything, exclusive | T·S = 36 > C − T | Not feasible: shared offered |

Thresholds (0.3, 1, the clamp) are first guesses: tune after a season.

## Claims and processing

### The claim

Ranked pairs `[{ addId, dropId }]`, as in fantasy football. The same add may appear in several pairs.
`checkClaim` per pair: the drop is yours and
- **out** (a replacement): allowed this week by `replaceRule` (`windows`: only in a window), and within
  `replacementsOwed` (all unreplaced losses; `whenShort`'s count; 0 for `never`); or
- **in** (a swap): this week is a window, within `swaps − swapsMade`.

Up to `owed + swaps + 2` pairs (two spare).

### Processing

One frozen waiver order; **no replacement priority** (replacements and swaps share the order). In
**rounds**: everyone's first pair that can still go through, in order; then everyone's next; until
nobody has one. A pair can't go through when its add was taken, its drop already went, or the week's
limit for its kind is used. Exclusive: someone dropped in the run waits for free agency (as today).
Rolling: anyone with a successful claim goes to the back once. Outcomes keep their why, per round.

### Free agency

Unchanged, except a move is the same pair (dropId now required), against the same limits.

### Close (airtime)

With `autoFill` on, replaceable losses still unfilled are filled as today (random free agent / most
points), only after a real free agency (8f85285). Under `windows`, only at a window's close. Swaps are
never automatic.

## Commissioner: Open a waiver window

- From Commissioner tools, after an episode's results, until that week processes. Sheet: **Swaps this
  window** (0 … Whole team; default the league's `swaps`, Whole team for Classic) and when it processes.
- A week already open for that episode becomes a window; none open → one opens now (normal clock:
  `waiverProcessHours` before the next episode, or halfway if that's past).
- Change or turn off before processing: pairs no longer allowed are removed, their owners pushed.
  Already processed or closed → refused ("open one after the next episode").
- Works on every schedule (an extra window, or more swaps on a scheduled one).
- Copy never names the merge or what happened: the window can exist before a viewer has revealed it.

## Data model

```js
settings.replaceRule: 'always' | 'whenShort' | 'windows' | 'never'
settings.replenishAt                         // kept: whenShort's N
settings.waiverWindows: { schedule: 'everyEpisode' | 'every' | 'manual', every: number, swaps: number }
settings.waiverFeel: 'casual' | 'balanced' | 'competitive'
settings.autoFill: boolean                   // default true
WaiverPeriod += { window: boolean /* replaces addDrop */, swaps: number, openedBy?: 'commissioner' }
```

`replenishEnabled`, `tradeEnabled`, `swapEvery`, `addDrop` are read for one release, then removed.

**Backfill** (migrateLeagueState + a migration), so every league keeps doing exactly what it does:
- `replenishEnabled` off → `never`; on + Active Roster → `whenShort` with its `replenishAt` (or default);
  on + Classic → `always`.
- `tradeEnabled` on → `{ schedule: swapEvery === 1 ? 'everyEpisode' : 'every', every: swapEvery, swaps: 1 }`;
  off → `{ schedule: 'manual', every: 3, swaps: 1 }`.
- `waiverFeel: 'balanced'`, `autoFill: true`.
- Open periods: `window = addDrop`, `swaps = addDrop ? 1 : 0`.

`waiver_claims` (migration 0063): add `pairs JSONB NOT NULL DEFAULT '[]'`, backfilled from
`pickup_ids` (each paired with the owed loss, oldest first) and `drop_id`/`add_ids`; old columns dropped
a release later. Only `src/lib/server/waivers.js` reads the table.

New leagues start on the recommendation. Existing leagues keep their settings; the recommendation card
shows on their Waivers settings for the commissioner to accept if they want. For the user's leagues:
Last Survivor Standing → Only in waiver windows + Manual only; Weekly Start/Bench already matches.

## Server

- `PUT claims` `{ playerId?, pairs }` (old shape accepted for one release).
- `POST free-agency` `{ playerId?, addId, dropId }`.
- `POST waivers/window` `{ swaps }` (commissioner): open / change; `swaps: null` turns it off.
- `WaiverLogic`: `recommend`, `replacementsOwed`, `checkClaim`, `process` (rounds over pairs),
  `freeAgencyMove`, `close` (+ `autoFill`), `openWindow`, `due()` honouring the schedule and rule.
  `Bots.waiverClaim` returns pairs.
- Pushes: "Waiver window open: up to N swaps by <processAt>" to the rotation; trimmed-claim notices.
  No names.

## Must be configurable: the user's scenarios

Whatever the UI ends up looking like, each of these has to be reachable from Waivers settings (and the
check fixture covers each):

| Scenario | Settings |
|---|---|
| **Merge rebuild** (Last Survivor Standing): no replacements or swaps during the season; after the merge the commissioner opens one window where everyone can redo their whole team: replace every castaway who's out *and* swap any still in | Only in waiver windows · Manual only · the commissioner opens a window with **Whole team** swaps |
| **Early losses cost you** (shared leagues): replacements only to keep a lineup, never the bench | Only when short (N = starting spots − 1) |
| **Replace, but only every X episodes** | Only in waiver windows · Every X episodes · swaps 0 (or 1+ to allow swaps too) |
| **Fantasy football**: replace any loss right away, regular swaps | Replace them · Every X episodes (or every episode) · 1 swap |
| **Commissioner decides when**, any league | Manual only, plus Open a waiver window whenever |

## UI: what people see

Indicative only: the screens get mocked out with options (impeccable) before building phase 2. What
follows is the content each screen has to carry, not its layout.

The formula, `s`, X and the setting keys never appear on screen. People see what it means for them,
in their league's numbers, as plain answers to questions they'd actually ask. Mobile-first at 390px.

### A player, any week

The question is "what can I do right now, and by when?" The Waivers page answers it in one line at the
top, then the team:

```
REPLACE PATT · SWAP 1                    by Tue 8:05 PM
You can replace 1 castaway who's out and swap 1 still in.

YOUR TEAM
  Kristin   Toka        in      [Swap]
  Mike      Toka        in      [Swap]
  Patt                  out     [Replace]
  Jenna                 out     replaced by Lewis
```

- Tapping **Replace** or **Swap** opens the free agents, ranked by the player: "Add X, drop Patt".
  The claim list underneath reads as sentences, in order: "1. Add Sharonda, drop Patt".
- When there's nothing to do, the line says why and when that changes, never a bare "No moves":
  "Nothing to do this week. Next waiver window: after episode 7." /
  "Patt can be replaced at the next waiver window (after episode 7)." /
  "You're down to 3 in the game, enough for your lineup. Replacements start when you're down to 2."
- The existing alert card ("REPLACE PATT BY TUE 8:05 PM") keeps working, now saying "swap" when it
  is a window and the player has no loss.
- Results read like a sentence: "You got Sharonda (your 1st choice) for Patt." / "Lewis went to
  riley, ahead of you in waiver order. You got your 2nd choice, Rob."

### A player learning the rules

How waivers work (the rules sheet) is three short answers for *this* league, not the settings:
- **When someone of yours is voted out:** "You can replace them after any episode." / "...only when
  you're down to 2 still in." / "...at the next waiver window." / "They stay on your team; there are no
  replacements."
- **Swapping someone still in:** "Once every 3 episodes, 1 swap: next after episode 7." / "When the
  commissioner opens a waiver window." / "Every episode."
- **Who gets a contested free agent:** "Waiver order: whoever's been quietest goes first." (as today)

### A commissioner setting up a league

In the create wizard, one card after teams and roster size, not a form:

```
WAIVERS                                       Casual · [Balanced] · Competitive
With 4 teams of 3 there are about 6 free agents.
• Castaways voted out stay on the team until a waiver window.
• You open waiver windows yourself, e.g. a full rebuild after the merge.
                                                             [Change]
```

The switch rewrites the bullets live, so the commissioner sees what Casual or Competitive means
("Missed claims aren't filled for you") instead of reading a definition. **Change** shows the three
settings. When teams × roster doesn't fit the cast: "4 teams of 5 needs 20 castaways; this season has
18. Try shared ownership or smaller teams." with buttons for each.

### A commissioner, mid-season

- **Waivers settings:** the same card at the top (bullets for how it's set now; if it differs from the
  recommendation, "Recommended for your league: …" with Apply), then the three settings. Each hint is in
  numbers: "Down to 2 of 5: replace 3 / 1 / 3 at the next window / 0". Under the schedule, "Next
  window: after episode 7".
- **Open a waiver window** (Commissioner tools, shown once an episode has results): a sheet asking
  "How many castaways can each player swap?" (1 … Whole team) and saying when claims process.
  Afterwards the Waivers page shows "Waiver window open · up to 3 swaps · processes Tue 8:05 PM" with
  Change and Turn off.

### Elsewhere

Results, league explainer and tour steps take the new words (Replace, Swap, Waiver window).
What's New entry drafted for the user to approve.

## Phases

1. **Engine:** settings + backfill, `recommend()` (a test per worked example), `replaceRule`, schedules,
   `autoFill`, pairs, rounds, free agency, close, `openWindow`, 0063, routes, bots;
   `tests/waivers.test.js` reworked; `scripts/dev-test/check-waivers.js` extended on a `zt-` fixture
   (each replace rule, each schedule, contested pairs, a Whole-team window, turning one off).
   *Done when:* `npm test` and the check pass.
2. **UI:** first mock options with impeccable for the user to pick from; then settings + card + switch, wizard, claim screen, commissioner sheet, copy everywhere;
   browser-checked at 390px.
3. **Pushes, What's New, docs** (HANDOFF; a pointer from PLAN-midseason-waivers to here).

## As built: phase 1 (2026-10-16, not committed)

| Piece | Where |
|---|---|
| Settings, backfill, recommend(), replacement rules, windows, pairs, rounds, free agency, auto-fill, Open a waiver window | `src/lib/game/state-logic.js` `WaiverLogic` (+ `.d.ts`; types in `types.ts`) |
| Old switches move the v2 settings and v2 writes keep them in step; `waiverRecommendation` applies recommend() | `WaiverLogic.updateSetting`, called first by `RosterLogic.updateSettings` |
| Backfill on read | `migrateLeagueState` → `WaiverLogic.backfill` |
| Migration | `db/migrations/0063_waivers_v2.sql` (applied locally): `waiver_claims.pairs`, settings, weeks' `window`/`swaps` |
| Claims as pairs (old rows converted on read), Open a waiver window with trimming | `src/lib/server/waivers.js` `rowToClaim`, `saveClaim`, `openWindow` |
| Routes | `PUT claims` takes `{ pairs }`; `POST free-agency` takes a drop of either kind; new `POST waivers/window` `{ swaps }` (`api.openWaiverWindow`) |
| Computer players' claims as pairs | `bot-logic.js` `waiverClaim` |
| Hourly job's league query | `db/waivers.js` (v2 keys, and any week still running) |

**Calls made while building:**
- **The pre-v2 API keeps working for one release**, so the phase-2 screens run unchanged until phase 2
  replaces them: `pickupsOwed` (= `replacementsOwed` in the running week), `isAddDropEpisode`,
  `addDropUsed`, `maxPickupClaims`, `period.addDrop` (written as `swaps > 0`), the claim shape
  `{ pickupIds, dropId, addIds }` (accepted, saved by part as before, and returned beside `pairs` by
  GET /waivers), and the old switches (`replenishEnabled`, `tradeEnabled`, `swapEvery`) both ways.
  Result rows keep `kind: 'pickup'` (a replacement) / `'addDrop'` (a swap); new `round`.
- **Backfill, Add/drops off → 0 swaps** (the plan said 1): with 1, every league with both switches off
  would read as "the commissioner opens windows" and get a Waivers tab. Waivers are on when
  `replaceRule ≠ never` or windows allow swaps, or while a window the commissioner opened runs; so
  never + manual + 0 swaps is "off", and Open a waiver window works there too.
- **The claim limit counts different adds** (owed + swaps left + 2), not pairs, since the same add may
  appear in several pairs. A sanity cap of 60 pairs.
- **A pre-v2 pickup list converts as each add paired with every loss it could replace, oldest first**
  (0063's SQL and `pairsOf` agree): rounds then take them exactly as the old pickups did. Which loss a
  replacement drops is the pair's; how many go through is the week's limit, checked in processing.
- **Why a pair didn't go:** `ahead` / `yours` / `gone`, told on the result for the same drop (and
  `choice` is its rank among that drop's adds). A pair skipped because its drop already went, or its
  kind's limit is used, is silent: nothing was lost.
- **Turning a window off** keeps the week as a plain one if replacements run weekly; otherwise the week
  closes on the spot (`turnedOff`) rather than being deleted, so the schedule doesn't open it again;
  its claims go. Lowering swaps trims nothing (processing caps it); turning off trims the swaps out.
- **`whenShort` for Classic:** N = roster − 1 (the open question's suggestion). The count is capped at
  actual losses (the old Active Roster rule could ask for more than there were to replace).
- **`waiverFeel` alone only records the switch;** `updateSettings('waiverRecommendation', feel)` writes the
  whole recommendation. `recommendFor(state)` reads the cast as of the league's first episode; the
  season's episode count isn't in league state, so it takes `{ episodes }` (default: the schedule, ≥ 13).
- **Not done here:** new leagues don't start on the recommendation yet (the wizard, phase 2, applies it;
  until then a new league is off, as today). Trimmed-claim and "window open" pushes are phase 3
  (`openWindow` returns who was trimmed). Existing leagues keep their settings, so Last Survivor
  Standing still reads as Replace them + every 3 episodes + 1 swap (its open episode-4 week is a window)
  until its commissioner applies the recommendation.
- **"Claim for" with pairs replaces the player's whole claim**, swaps the commissioner can't see
  included. The pre-v2 shape still saves by part. Phase 2 should decide (e.g. send only replacement
  pairs, merged server-side).

**Verified:** `tests/waivers.test.js` 32/32 (each worked example; every rule and schedule; rounds;
contested pairs; the whole-team window; Open/change/turn off; auto-fill off; backfill and the old
switches). `npm test` 342/343 (the known `status-plate.test.js` "before the draft"). `check-waivers.js`
78/78 against the dev server with `waivers-fixture.js up --scenarios` (one league per "Must be
configurable" row, plus Don't replace + every episode), including an old claim row read as pairs and
0063's SQL making the same pairs (in a rolled-back transaction). `check-waivers-alerts.js` passes;
`check-waivers-ui.js` all four phases at 390px, no page errors (it now dismisses What's new before the
free-agency tap). `tsc` and lint clean (apart from the repo's `require()` rule).

**Worked example to check:** "Active Roster, 3 × 4, exclusive, 24 castaways" says X = 4, but the formula
gives 3 at E = 13 (r = 21/12 = 1.75; 24 / (4 · 1.75) = 3.4). The test asserts the formula; change the
table or the formula.

## Phase 2: picked design (2026-10-16)

Mocked with impeccable, picked and polished with the user: the "Waivers v2 options" canvas,
https://claude.ai/artifact/KEsHGXFXjsDeuWe65JWZZz. Build from the boards titled "(picked, polished)" and
the ones beside them; the other options there (1B, 1C, 2B, 2C, 3A, 3C) were not picked. The mocks use
Last Survivor Standing (Classic 4 × 3, 6 free agents) and S51 faces; every number on them came from
`recommend()`. This section is the spec; the canvas shows the layout.

Guiding rule from the user: **if it needs a lot of words, the UX isn't intuitive; fewer taps is less
intimidating.** Short labels, no explainer paragraphs, no sums on screen. Anything big beyond this spec:
check with the user first.

### Words (replace the plan's earlier wording where they differ)

| Was | Now |
|---|---|
| Claims process / Waivers process (settings, hints) | **Claim deadline** ("1 day before"); players read "Due Tue 8:05 PM" |
| Replace them / Only when short / Only in waiver windows / Don't replace | **Replace right away** · **Only when short** · **Wait for a waiver window** · **No replacements** |
| Manual only / You open them | **You decide** (settings); players: "Your commissioner opens waiver windows" |
| Swaps per window 0 · 1 · 2 · Whole team | a −/+ counter: **None · 1 · 2 … · All** |
| Fill missed replacements | **Auto-fill**: "No claim in? They get the top free agent." |
| Waiver order (to players) | "you're 3rd in line"; results "Josie got Maggie first, so Lewis stays." |
| "Redo your whole team" | never: it reads as if they *have* to. Use "Swap any" + "Optional" |

### 1A · Waivers settings (League Settings › Waivers)

- **Suggested card** (night panel): "SUGGESTED" + "4 teams of 3 · 6 free agents"; the Casual · Balanced ·
  Competitive switch (You-fill segmented); four short bullets with small icons that the switch rewrites live
  (Balanced: "Lose someone? They wait for a waiver window." / "You open waiver windows, like after the
  merge." / "Get a free agent, go to the back of the line." / "Claims are due a day before each episode.");
  then **Apply Balanced settings** (chyron, follows the switch) with "Or set your own below." small and
  muted under it. Once applied: a teal tick, "Your league is on Balanced." Touching a setting below
  un-applies (the card offers it again).
- **When someone's voted out**: four radio rows (title + a few words), the suggested one tagged
  "Suggested" (chyron-line outline badge).
- **Waiver windows**: one muted line ("When players can swap someone still in. Swapped castaways take their
  points with them."), a segmented Every episode · Every 3 · You decide, then **Swaps each** with the −/+
  counter and "Next window: after Episode 9" / "Set when you open one" under it.
- **Timing**: Claim deadline, Waiver order (Rolling), Free agency (Until airtime) as value rows, then the
  **Auto-fill** toggle. "Preview what players see" (chyron-line link) opens the rules sheet.
- **The create wizard** uses the same card (canvas: "Create wizard"), plus the "4 teams of 5 needs 20
  castaways; this season has 18. Try one of these:" state with Share the cast / Teams of 4 / Eliminator Pool.

### 2A · The claim screen (/waivers, a player in a window)

- **Plate**: chyron "Window" tag, "REPLACE PATT · SWAP 1", "Due Tue 8:05 PM · you're 3rd in line". No
  sentence under it.
- **Your team**: heading with **Swaps allowed [1]** (a You-fill number badge) on its line; 62px rows
  (photo, name, points) with an outlined **Swap** on each castaway still in and **Replace** on one who's out
  (greyed photo, live "Out" chip, "Keeps his 9 pts").
- **Your claims, grouped by spot**, so it's clear you get one per spot and the rest are backups:
  "REPLACING PATT · You get 1": 1 Sharonda "First choice", 2 Rob "If Sharonda's taken";
  "SWAP · 1 ALLOWED · You get 1": 1 "Maggie for Lewis · First choice · his 11 pts go", 2 "Kilby for Mike ·
  Only if Maggie's taken". Each group ends with "+ Add a backup" (chyron-line). Rows have a grip (drag to
  reorder; its sheet has Remove). Footer: "Then free agency until airtime."
- **Picker** (Replace/Swap → free agents): "Tap your first choice, then any backups. You get one." Then
  **Research's own controls**: the window segmented control (Season · Last 5 · Last 3 · Last ep) and its
  "RANKED BY Points ▾" header that ranks by any scoring rule (e.g. Won immunity: tiles read "3 times · 15
  pts"). No A–Z. Tiles as today, numbered 1, 2… in pick order. Confirm bar: "For Patt · backup Rob" /
  SHARONDA / **Save**.
- Engine mapping: the groups are the ranked pairs in order (each replacement group, then the swap group);
  within a group the rank is the pair order. (Open decision 3 below.)

### 2A, shared ownership (nobody can lose a free agent to anyone)

Same look, much less: no ranking, no backups, no place in line, no claims section. Plate "REPLACE PATT ·
SWAP 1 / Due Tue 8:05 PM · you get who you pick"; Swaps allowed badge; tap Replace → picker ("Pick one.",
same Research controls, a tick instead of a number) → Save; the row becomes "Sharonda for Patt · Joins your
team Tue 8:05 PM" with **Change**.

### 3B · Open a waiver window (commissioner sheet)

Title **OPEN A WAIVER WINDOW**, "After Episode 7 · claims due Tue 8:05 PM". Two controls:
- **Replace castaways who are out**: a toggle (You fill when on, not chyron), hint "Each gets a free agent.
  Their points stay." / "Out castaways stay on the team."
- **Swap castaways still in**: −/+ counter None · 1 · 2 … · All, hint "Up to 2 each. Their points go too."
  / "Any of them…" / "Nobody still in can move."
- **Players get**: a live preview plate (quiet tag, so Open window stays the one yellow) with **no names**:
  "REPLACE WHO'S OUT · SWAP UP TO 2" / "Swap 1" / "Swap any", detail "Optional · due Tue 8:05 PM". The same
  line is the push. Nothing chosen: a dashed "Nothing to claim yet" and Open window disabled.
- Buttons: Not now · **Open window**. Afterwards the Waivers page leads with "WAIVER WINDOW OPEN / Replace
  who's out · Swap any · due Tue 8:05 PM" with Change and Turn off, then Commissioner tools (claims in 2 of
  4, Claim for, Nudge, Process now).
- The toggle is new against phase 1's `openWindow({ swaps })`: replacements in a window follow `replaceRule`
  today. The sheet needs a per-window "replacements on/off" (e.g. `WaiverPeriod.replace`), defaulting to
  what the rule allows.

### The Waivers tab in a quiet week (no window, nothing owed)

Quiet plate "NOTHING TO DO THIS WEEK" ("Next swap window: after Episode 9" / "Your commissioner opens
waiver windows"), then **When moves happen**: a Replace lane and a Swap lane over episode columns.
- **A pattern, not a calendar** (the season's length isn't known): ten columns from two before the latest
  episode, sliding along the season, fading out on the right. Past columns dimmed; a chyron-line mark under
  the latest.
- Scheduled: solid where moves are open (hatched for "only if you're short"). Commissioner opens: past
  columns solid where a window was opened, the future one dashed bar "When your commissioner opens one".
- A legend with only the swatches used, one plain sentence, then Free agency and Past waivers rows.
- The other weeks' top lines are on the canvas's "The top line in other weeks" board.

### Decisions still open (ask the user)

1. **Auto-fill default.** The user asked for it off by default; `recommend()` turns it on for Casual and
   Balanced. The mock has it on for Casual only.
2. **Shared pickups: at the deadline or instant?** The mock waits ("Joins your team Tue 8:05 PM"); instant
   is quicker but shows who's out before everyone has revealed.
3. **Grouping 2A by spot** drops ranking one free agent across two spots (Sharonda for Patt, else for Mike)
   and always tries replacements before swaps.
4. **Classic's "Only when short"** with teams of 3 (N = 2) behaves exactly like Replace right away, so
   Casual reads the same as today. Hide it for Classic, or change its N.

### Also done with the design

The caption tag's edge (every tag + plate in the app) now meets its plate on one straight diagonal: a
fixed slant (`tag-cut` / `tag-tuck`, `--tag-slant`) instead of 84% of the tag's width over a 10px tuck,
and the plate colour under the whole strip (`globals.css`, DESIGN.md → Shapes). Mocks use the same.

## Open questions

- `whenShort`'s N for Classic, which has no starting spots: R − 1? (Built that way.)
- Large shared leagues may want fewer swap windows (everyone chasing last week's winner); left at X for
  now, revisit with real leagues.
- Manager-to-manager trades: not planned.
