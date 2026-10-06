# Plan: season rule changes (mid-season rule/mechanic checkpoints)

Phase 5 of `docs/PLAN-ai-generated-show-formats.md` ("season-level delta research"), designed
2026-10-06 and confirmed by the user the same day. That plan's text (its pipeline step 3 and the
"season-to-season rule variance" table row) was the starting point. It was written before any real
case existed, and several of its assumptions didn't survive contact with the code; see "What the
original text got wrong".

## The problem

A show's rules can change partway through a season: a new twist, a new advantage type, a new way to
leave the game. Today a show's format is fixed for its whole run. The only way to add something is to
edit the format itself, and that changes it for every season of the show. This plan adds a way to
detect such a change, store it as a **season-scoped change layered on the show's base rules**, review
it, and let each league's commissioner decide whether their league scores it.

The same mechanism covers the start-of-season case the original text described ("add a season →
research what's different", e.g. Challenge-style per-season rule variance). That's simply a change
effective from episode 1.

## What the original text got wrong (checked against the code)

- **"One more step between cast approval and episode review."** `SeasonCard`
  (`src/components/admin/shows-section.tsx`) has two steps, and step 2 (Episodes) runs for the whole
  season. A mid-season change surfaces while step 2 is in progress. So the rules check is a row that's
  **available at any time once the cast is approved, and it never blocks Episodes**.
- **Exile Island as the motivating example.** It was already hand-added to the *base* Survivor format
  (the `exiled` checklist field, `EpisodeLogic.addExiled`, `wentToExile` at 0 points in
  `formats/survivor.js`). That's the evidence for this feature: a season-specific mechanic had to be
  patched into every season's rules. It isn't a case to design against, and nothing here researches
  what any specific twist's mechanics are.
- **"Reviewed the same row-by-row way."** This one holds. The review reuses the Stage 3 row editors.
- **Unstated, but load-bearing:**
  - A league scores with one `formatOf(state)` for the whole season.
  - Implied events are re-derived on every read.
  - `ActiveRosterLogic.addEvent` returns null for an event type the league's format doesn't have.
    Decision-apply then records it as "skipped".
  - `defineFormat` keeps `data` but not the code half, so a built-in (Survivor) can't be rebuilt from
    data plus a change through `buildDataFormat` without losing its wiki read and reviewer notes.

## Decisions (confirmed 2026-10-06)

1. **Changes are additive only.** A change can:
   - add events and categories
   - add checklist questions
   - add research and implied rules
   - add exit methods
   - retire an existing event from episode N

   It cannot edit an existing event's points or rules. Point values already belong to each league's
   settings. A change to how an *existing* mechanic works is flagged for a developer, the same as
   Stage 3's flagged mechanics.
2. **In a league that's already running, the commissioner decides.** A change doesn't silently start
   scoring in a running league. Its commissioner adopts it and sets the points for its new events, with
   the admin's suggested values pre-filled. A league created after the change was approved starts with
   it adopted at the suggested values.
3. **Leagues on their own ruleset copy** (`league_rulesets`, scoring-rules phase 2) get the same adopt
   flow. An adopted change layers on top of the copy. Anything that clashes with the copy (an id it
   already uses) is skipped for that league and reported in the adopt screen.
4. **Spoilers:** a league catching up only sees a change, including the commissioner's adopt prompt,
   once it's revealed up to the episode before the change takes effect. This is client-side, the same
   trade-off `SpoilerLogic` already makes.
5. **Research raises the flag.** Episode research gains one shared episode-level question asking
   whether anything happened that the checklist doesn't cover. A non-empty answer surfaces on the
   season's Rules row as a prompt to run a rules check. Running the check itself stays a deliberate
   admin action.

## Design

### Two levels: the season and the league

- **Season level (shared by every league on the season):** research and the wiki read use the base
  format plus every *approved* change effective by that episode. That's what makes research ask the new
  questions and stage the new event types as season decisions.
- **League level (scoring):** a league plays by its base (show format, or its own copy) plus only the
  changes its commissioner *adopted*, each frozen at the version they adopted.

A decision whose event type the league hasn't adopted is skipped, exactly as today. Adopting re-runs
decision-apply for that league, so the skipped ones land then. Declining leaves them skipped.

### Storage: `season_rule_changes` (migration 0053)

| column | |
|---|---|
| `id` | uuid |
| `season_id` | → `show_seasons` |
| `effective_episode` | int, ≥ 1 |
| `status` | `draft` / `approved` / `no_change` (a recorded "checked through episode N, nothing new") / `withdrawn` |
| `proposal` | jsonb: the chat's answer, row by row, with tiers, sources and flagged mechanics. What the admin edits |
| `delta` | jsonb: derived from the proposal and validated. Set on approval |
| `base_format`, `base_version` | what the check was run against |
| `checked_through` | the last aired episode the research covered |
| `version` | bumped when an approved change is edited |
| `created_by`, `approved_by`, timestamps | |

A season can have several changes, applied in `effective_episode` order (ties by approval time).
Purely additive: no existing row is read or changed.

### The change's shape (`delta`)

Pure data, the same vocabulary as a format's data half:

```
{ addEvents: [...], addCategories: [...], addQuestions: [...], addExitMethods: [...],
  addRules: { research: [...], implied: [...] }, retireEvents: ["eventId", ...] }
```

Each added event carries the admin's **suggested** points. Commissioners see these as defaults.

### Layering at read time (`src/lib/game/formats/season-changes.js`, pure)

- `defineFormat` also keeps the code half, as a non-enumerable `code` (beside `data`), so any format
  can be rebuilt from changed data plus its own code.
- `withChanges(format, changes)` does three things:
  1. Merges each change into a copy of `format.data`.
  2. Validates the result with `formatProblems` and refuses on clashes.
  3. Rebuilds the format with `defineFormat(mergedData, format.code)`, memoised per changes array.

  Built-in reviewer notes don't know the new questions, so notes for questions a change added come
  from `custom.js`'s generic `phrases`, appended after the base format's own notes.
- **Episode gating.** Every rule a change adds gets `fromEpisode: effective_episode`, and `rules.js`
  skips it for earlier episodes. A retired event gets `untilEpisode`. Gating covers implied rules
  (re-derived on every read) and research rules (an old episode can be re-researched). So nothing
  before the effective episode can change, by construction.
- **`formatOf(state)`** becomes: base (`leagueRulesetData`, else `showFormat`/`showFormatData`), then
  `withChanges` over `settings.adoptedRuleChanges`.
- **Season level:** `db/show-formats.js` gains `resolveSeasonFormat(db, seasonId, episode)`.
  `db/episode-research.js` and `db/wiki-sync.js` switch from resolving by show to resolving by season
  (and episode).

### What a league caches (game logic can't read the database)

- `settings.seasonRuleChanges`: every approved change for the league's season (`id`, `version`,
  `effectiveEpisode`, `delta`). It's what the adopt prompt offers.
- `settings.adoptedRuleChanges`: `[{ id, version, effectiveEpisode, delta }]`, a frozen snapshot per
  adopted change. It's what scoring reads. An admin edit after adoption shows up as "updated, review
  again" and never changes a league silently.
- The settings route refuses client writes to both, as it already does for `showFormatData`. Adopting
  and declining go through their own route.

### Admin flow (SeasonCard)

- A **Rules** row sits between Cast and Episodes. It's unlocked once the cast is approved and never
  blocks anything. Its status reads, for example, "Survivor rules · no changes (checked through ep 7)",
  or "1 change from ep 8", or "Research on ep 8 mentioned something new — check rules".
- **"Check for rule changes"** works paste-first, like Stage 3. The prompt carries:
  - the base rules
  - changes already approved
  - the episodes aired so far
  - any research flags

  It asks only what's new or different, in the delta shape. "Nothing changed" is a valid answer and is
  recorded as `no_change`. A paid call can come later, the same split as Stage 3.
- **Review.** The draft opens in a review screen built from `format-review-screen.tsx`'s row editors,
  covering added events, questions, rules and exit methods, plus retirements. It also has the
  effective-episode field (pre-filled from the answer) and flagged mechanics shown as a callout.
- **Approve:**
  1. The server re-derives the change and validates the merged format.
  2. It caches the change in every league on the season.
  3. Leagues created later start with it adopted (decision 2).
- Editing an approved change bumps its version and re-pushes. Withdrawing removes it from
  `seasonRuleChanges`. Leagues that adopted it keep their snapshot until their commissioner removes it.
  Withdrawing never rescores a league behind its commissioner's back.

### Commissioner flow (League Settings)

- **"Rules changed from episode N"** card. It appears once the league can see it (decision 4) and lists
  the new events with suggested points as editable inputs, the new exit methods, retirements, and any
  clash with the league's own copy.
- **Adopt** writes the snapshot plus the chosen points into `settings.eventPoints`, then re-runs
  decision-apply for the league. **Decline** hides the card. It can still be adopted later from League
  Settings.
- Player-facing copy: none required. Points and categories show up in "How starters score" once a
  change is adopted. Any What's New entry is held for approval as usual.

### Research flag (decision 5)

- One episode-level field joins the research answer for *every* format: `rulesNote` (string or
  null). It asks: "Did this episode introduce or explain a game mechanic, twist, advantage or rule that
  the checklist above doesn't ask about, and that's new for this season? Describe it in a sentence, or
  null."
- It lives in `db/episode-research.js`'s shared episode-level schema, not in format data. That means:
  - no format changes
  - it's reserved in `EPISODE_RESERVED`/`EPISODE_KEYS`
  - it's in the paste prompt and skeleton too
- It's stored with the episode's research. A non-empty note shows on the Rules row until a rules check
  covering that episode is recorded, or the admin dismisses it.
- **Expected harness diff:** the research schema/prompt sections change for every format by exactly
  this field, and nothing else.
- **Risk:** noise. The wording has to exclude recurring mechanics the checklist already covers. Tune it
  against real research answers before trusting it.

## Phases

1. **Pure core.**
   - `defineFormat` keeps `code`.
   - `season-changes.js` (shape, validation, merge, gating).
   - `fromEpisode`/`untilEpisode` in `rules.js`.
   - `formatOf` layers adopted changes.
   - Tests.
   - **Proof:** the format-regression harness is byte-identical with no changes. The three real leagues
     in the local DB (WUYXVU, T9FUMY, B999RR) score identically before and after. With a test change
     from episode N, scores differ only from episode N on.
2. **Storage and season wiring.**
   - Migration 0053 and `db/season-rule-changes.js`.
   - `resolveSeasonFormat`; research and wiki-sync resolve by season.
   - Admin API: prompt / draft / save / approve / no-change / withdraw.
   - Pushing changes to leagues' caches.
   - Auto-adopt for leagues created later.
3. **Admin UI.** The Rules row and the review screen.
4. **Commissioner adopt flow.** Settings card, adopt/decline route, re-running decision-apply on
   adopt, and spoiler gating.
5. **Research flag.** The `rulesNote` field, the expected harness diff, and the surfacing on the Rules
   row.

Phases 1–2 are where getting it wrong would silently corrupt scoring, so they get the harness and
real-league proofs. Phases 3–5 are UI on a settled model.

### Phase 1: done (2026-10-06)

- **What was built:**
  - `formats/season-changes.js` (`changeProblems`, `applyChanges`, `withChanges`), exported from
    `formats/index.js`.
  - `fromEpisode` and `retiredFrom` gating in `rules.js`. `describeRule` appends "(from episode N)".
  - `defineFormat` keeps the code half as a non-enumerable `code`. `buildDataFormat` marks its results
    `dataOnly`, and `custom.js` exports `questionPhrases`.
  - `formatOf` layers `settings.adoptedRuleChanges`. If a change no longer fits, it falls back to the
    base and logs, rather than breaking the league.
  - `addEvent` refuses a retired event from its retirement episode on.
  - The settings route treats `seasonRuleChanges`/`adoptedRuleChanges` as server-owned.
  - `tests/season-changes.test.js`: 12 tests, mutation-checked. Removing either gate fails them.
- **Proofs:**
  - The format-regression harness is byte-identical apart from the source hashes of the two generated
    functions (`impliedEvents`, `research.items`), which changed because their source did, as in
    phase 2 of the formats plan.
  - The three real leagues in the local DB produce identical scores and per-episode events before and
    after.
  - With a test change adopted from episode 2: episode 1 is identical in all three leagues, and
    episode 2 gains the new event. The local copies only have 3 episodes, so N=2 was the only
    informative split.
  - tsc is clean, eslint shows only the known `pickem-pick-grid.tsx` error, and `npm test` is 179/179.
- **For phase 2 to respect:**
  - A gated research rule only runs when `ctx.episode` is passed. It fails closed, so
    `db/episode-research.js`'s `itemsFromChecklist` must start passing the episode number, or added
    rules will silently never stage.
  - Survivor already has a category with id `twists` (Journeys & Exile). An added category with an
    existing id is skipped, and its events join the existing one. The review screen should show that
    rather than let it surprise anyone.

### Phase 2: done (2026-10-06)

- **What was built:**
  - Migration 0053 `season_rule_changes`.
  - `formats/season-check.js` (+ `.d.ts`), the season counterpart of `proposal.js`:
    - `buildCheckPrompt` lists the season's rules as they stand, the changes already approved, and
      any research flags.
    - `parseCheck` reads the pasted answer.
    - `reviewCheck` builds the delta and every problem at its row.
    - An event names its category by label or id. An existing category is reused, which settles the
      `twists` point above.
  - `db/season-rule-changes.js` (+ `.d.ts`): `seasonFormat`, `checkPrompt`, `recordCheck`,
    `saveChange`, `approveChange`, `withdrawChange`, `deleteChange` and `syncLeagueChanges`.
  - `src/lib/server/season-rule-changes.ts` (`pushSeasonRuleChanges`).
  - Admin routes under `/api/admin/seasons/[id]/rule-changes`: list and record, `/prompt`, and
    `/[changeId]` with GET/PATCH/DELETE, `/approve` and `/withdraw`.
- **Wiring:**
  - Research resolves its format by season and episode (`contextFrom`), records `ruleChanges` in
    provenance, and passes the episode into staging (`candidatesFor(payload, format, episode)`).
  - Re-staging and the wiki read resolve through `seasonFormat`.
  - The research and decisions routes return `ruleChanges`, and the admin episode review layers them
    on for labels and notes.
  - The settings route syncs a league's changes when its show or season is set, *before* applying
    the season's decisions. It adopts everything only when the season actually changed, so re-saving
    the same season can't undo a commissioner's choice.
- **Decided along the way:**
  - A "nothing changed" answer is recorded straight away as `no_change`. There's nothing to review,
    and it's how the season row will know a check was done.
  - A draft is reviewed against the season's rules *without* itself, so editing an approved change
    doesn't clash with its own additions.
  - Anything the merge would skip counts as a blocking problem at the season level, because the base
    is the master. Only a league's own copy treats skips as normal.
  - A change can't add a second winner: exit kinds are `out` or `finalist`.
  - **Eliminations reach every league whether or not it adopted a change.** `addElimination` doesn't
    validate the method, so a new exit method's elimination still lands, and a league that hasn't
    adopted the change just doesn't score it. That's the right split: who left is a fact, and how it
    scores is the league's choice.
- **Known limits, left as they are:**
  - A built-in format's hand-written wiki read doesn't learn exit methods a change adds. Research
    does.
  - An episode researched *before* a change was approved keeps its cached answers, which don't include
    the new questions. The admin re-researches it ("Research again"); nothing silently spends money.
- **Proofs:**
  - The format-regression harness is byte-identical to phase 1's output.
  - `tests/season-check.test.js` adds 8 tests, so `npm test` is 187/187. tsc is clean, and eslint
    shows only the known `pickem-pick-grid.tsx` error.
  - A rolled-back end-to-end script against the local DB passed 10/10 steps:
    - no_change recording
    - draft and approve
    - the prompt
    - per-episode season format
    - research context and provenance
    - staging the new event as a season decision, including re-staging
    - league sync, offered vs adopt-on-arrival
    - edit bumps the version, an invalid edit is refused, an approved change can't be deleted, and
      withdrawing works

    It's a scratch script, not committed.
  - All six new routes compile on the dev server and return 401 unauthenticated. They haven't been
    exercised signed in. Phase 3's screens are what will do that, in the browser.

### Phase 3: done (2026-10-06)

- **What was built:** `src/components/admin/season-rule-check.tsx`.
  - `SeasonRules` is SeasonCard's new step 2, "Rules", between Cast and Episodes (now step 3). It's
    unlocked once the cast is approved and blocks nothing. Its status line reads one of:
    - "N changes to review below"
    - "Research on ep N mentioned something new — check the rules"
    - "1 change in force (from ep 3) · checked through ep 3"

    It gets a ✓ when the latest check covers every aired episode and nothing is waiting. Research
    flags are listed under it.
  - The copy/paste check panel works like Stage 3's research panel. A "nothing changed" answer is
    recorded and reported in a line.
  - The list shows each recorded check, with review/view-edit, withdraw (through the app's confirm
    dialog) and delete. Only the latest no-change record is kept on screen.
  - The review screen (`RuleChangeEditor`) re-runs `reviewCheck` live against `baseData`, which is
    the season's rules without this change; `getChange` now returns it. It covers:
    - the effective episode and the summary commissioners will see
    - new events (label, suggested points, category, remove) with their rules (`RuleLine`, the
      Stage 3 editor)
    - other rules, questions (type, remove), exits and retirements (remove)
    - flagged items, not-trackable items and sources

    Approve saves first, then approves, like Stage 3.
  - Stage 3's row pieces (`RuleLine`, `Notes`, `TierChip`, `CategorySelect`, `ruleAtPath`, the
    effective-id helpers) are now exported from `format-review-screen.tsx` and reused rather than
    copied.
- **A bug the browser found:** approving returned a 500 even though the change *was* approved,
  because pushing to one league threw after the approval had already committed.
  - The trigger was a malformed test league (my fixture), but the flaw was real: one bad league
    turned a success into an error the admin would retry.
  - `pushSeasonRuleChanges` now catches failures per league and returns `{ updated, failed }`. The
    routes return `leaguesFailed`, and the UI adds "Couldn't update X — they catch up on the next
    change to this season's rules." The sync is idempotent, so that catch-up really happens.
- **Verified in a browser:** an isolated headless Chromium (the MCP browser was locked again)
  against the local dev server, using a throwaway show, season, league and super-admin account, all
  deleted afterwards with no orphaned rows. Covered:
  - row status, the research flag, and the prompt including that flag
  - pasting an answer and the review rendering every section
  - Approve: "in force from episode 3, offered to 1 league", and the row ticking
  - the league's `seasonRuleChanges` set while `adoptedRuleChanges` stays empty
  - at 390px wide: the view/edit layout with no horizontal overflow, and withdraw through the
    confirm dialog

  After a withdraw, episode 3's research flag shows again. That's deliberate: the change that
  answered it was taken back.
- tsc is clean, eslint shows only the known `pickem-pick-grid.tsx` error, `npm test` is 187/187, and
  the harness is unchanged.

### Phase 4: done (2026-10-06)

- **What was built:**
  - `StateLogic.RuleChangeLogic` (pure): `pending`, `adoptedStatus` (current / updated / withdrawn),
    `fit` (what a league's own copy would leave out), `suggestedPoints`, `adopt` (with this league's
    points), `decline` and `remove`.
    - Declining is remembered per version in the new server-owned `settings.declinedRuleChanges`, so
      an admin's later edit is offered again.
    - `remove` takes back the change's snapshot, its events' recorded results and their point values.
  - Route `POST /api/leagues/[leagueId]/rule-changes` (commissioner) with `{ changeId, action, points }`.
    - It refreshes the offered list first, so it never adopts an edited or withdrawn version.
    - Adopting re-runs `syncLeagueDecisions`, so results that were skipped while the league lacked the
      events land then.
    - Removing deletes those events' ledger entries, so adopting again brings them back.
  - `src/components/setup/rule-changes-section.tsx`, "Rule changes this season" in League Settings,
    right after League Scoring.
    - The commissioner gets a card per pending change: the summary, each new event with the suggested
      points filled in and editable, new exits, retirements and anything left out. Buttons: Adopt /
      Not for this league, or for an update: Use the update / Keep the version we have.
    - Everyone sees the list of changes scored in this league, with updated/withdrawn notes. The
      commissioner can "Stop scoring it" (with a confirmation).
    - It appears only in Active Roster leagues. Other league types score by who leaves, which reaches
      every league regardless.
  - **Spoiler gate:** `SpoilerLogic.viewThrough` leaves offered and adopted changes out of the viewer's
    copy until they've seen the change's effective episode. The plan said "the episode before"; it's
    the episode itself, because the twist airs in it. Scores can't differ, since everything a change
    does is gated to that episode.
- **Proofs:**
  - `tests/season-changes.test.js` gained 5 tests; `npm test` is 192/192.
  - The three real local leagues score identically to phase 1's baseline, and the harness is
    unchanged. tsc is clean; eslint shows only the known error.
  - Verified in a browser (isolated headless Chromium, local dev server) with a throwaway show, season
    and league, an approved change from episode 3, an accepted episode 3 result using its new event,
    and a test commissioner account. All of it was removed afterwards with no orphaned rows.
    - Seen through 2: the section doesn't appear. Seen through 3: the card shows a suggested 1.5.
    - Adopting at 2 points: the league holds the change at version 1, points 2, Ada's episode 3 event
      and its ledger entry. Before adopting, it had neither; the result had been skipped.
    - The adopted event shows up in League Scoring under its new category.
    - At 390px: "Stop scoring it" through the confirm dialog clears the event, points and ledger, and
      the card is offered again. Adopting again brings the event back. No horizontal overflow, no page
      errors.
- **Left for later:** no What's New entry. The only person who sees the card is a commissioner, and
  any player-facing note waits for your approval as usual.

### Phase 5: done (2026-10-06). The plan is complete.

- **What was built:**
  - `rulesNote` (a nullable string) is in `db/episode-research.js`'s shared episode-level schema,
    `researchSchemaFor`, so every format asks it with no format's data touched. It's reserved in
    `define.js`'s `EPISODE_RESERVED` and `proposal.js`'s `EPISODE_KEYS`, so no format can define its
    own.
  - The wording (`RULES_NOTE`) is aimed at avoiding noise. It asks only about a change to *how the
    game is played* that's new this season. It names what doesn't count: anything the checklist
    already asks, the show's usual twists, and what happened to one person (that's `notableTwist`'s
    job, per person). And it says null is the normal answer.
  - The JSON paste skeleton picks it up from the schema (`rulesNote: null`), and the prose paste
    prompt asks for a "Rules note:" line. A pasted answer that leaves it out reads as null, the only
    missing key `validateLeniently` excuses, so an optional flag can't become a new way for a paste to
    fail.
  - The admin's research result shows it under the episode summary, behind "Show episode results",
    the same as the summary. The season's Rules row (phase 3) lists it.
  - Found while doing this: the Rules row showed research notes and change summaries regardless of
    "Show episode results". Both now say "details hidden" until it's ticked, the hover tooltip
    included. Episode numbers and counts stay visible, since they reveal nothing.
- **Proofs:**
  - **Expected harness diff:** 784 lines, all in research schemas and paste prompts. To show it's
    nothing *but* `rulesNote`, a scratch script resolved every `$ref` (zod renumbers its shared
    `$defs` when a field is added, which is most of the raw diff), removed `rulesNote`, and compared
    against `HEAD`. All 4 formats × with/without bets × 4 provider dialects came out byte-identical.
  - `tests/season-check.test.js` gained 3 tests, so `npm test` is 195/195. The three real local leagues
    still score identically to phase 1's baseline. tsc is clean; eslint shows only the known error.
  - Browser check: with "Show episode results" off, the Rules row shows "Episode 3: details hidden…".
    Ticked, it shows the note. Throwaway data and account were removed afterwards.
- **For you to watch:** whether the wording is quiet enough on real episodes. Research on Survivor 51's
  coming episodes will start filling `rulesNote`. A note on an ordinary week means the wording needs
  tightening (it's one constant, `RULES_NOTE`). A real twist with no note means the opposite.

## Open points (not blocking)

- The paid "check for rule changes" call, once the paste flow has proven the prompt.
- Whether "retire an event" is ever actually needed. It's cheap to support but has no real case yet.
- Changing an *existing* mechanic stays a developer task. If real seasons keep producing those, that's
  a signal to extend the change shape, not to loosen decision 1 silently.
