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

## Open points (not blocking)

- The paid "check for rule changes" call, once the paste flow has proven the prompt.
- Whether "retire an event" is ever actually needed. It's cheap to support but has no real case yet.
- Changing an *existing* mechanic stays a developer task. If real seasons keep producing those, that's
  a signal to extend the change shape, not to loosen decision 1 silently.
