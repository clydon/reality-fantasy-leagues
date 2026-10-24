# Plan: rulebooks — implementation (core logic → database → API → UI)

Written 2026-10-16 for a fresh session to build from. **Read first:**

1. `docs/PLAN-admin-shows-rulebooks.md` — the design: why, the decisions, the vocabulary, every editor
   question. This file is the *how*. Where they differ, this file says so and why ("Changed from the
   design plan" below).
2. The clickable mockup: https://claude.ai/artifact/N9fyawYRUfgCJVuUtK9yuE — every screen and sheet
   in this plan exists there. Open it at phone width (the prototype bar's **Phone** toggle) and walk:
   Shows → Survivor → Season 51 → Rulebook → Edit rulebook → each block → each sheet; then the
   prototype bar's **Commissioner**. Its source is the best reference for copy and behaviour; the copy
   in this plan is taken from it.
3. `DESIGN.md` (Lower Third) and `PRODUCT.md`. Every UI element below uses existing components; none
   needs a new visual pattern.

Nothing in this plan is built yet. Phases are ordered so each one ships on its own and leaves the app
working; a phase's "Done when" is its acceptance check.

**Placement changed 2026-10-24.** The phases are now built as part of the new-design port
(`docs/PLAN-new-design.md`, which wins where the two disagree on screens), not in the classic app. Phase 1 is
logic and data only (no `src/components/rulebook/`, no classic Rulebook tab or commissioner view: How it
works is drawn in the new design); phases 4–8 are built inside the new design's screens; the kind of show
is inferred, never asked first (`PLAN-admin-shows-rulebooks.md`, Layer zero). The "Built in" column below
says where each phase goes. The logic, data and API in this file still hold.

---

## 0. Status

| Phase | What | Built in (`PLAN-new-design.md`) | Status |
|---|---|---|---|
| 1 | Schema module, hand-written blocks for the three built-ins, read-only "How the season works" | R1 (logic only; the page is step 1) | **done** 2026-10-24 (logic; `PLAN-new-design.md` R1 As built lists the schema changes) |
| 2 | The compiler, legacy freeze, engine relaxations | R2 | **done** 2026-10-24 (`PLAN-new-design.md` R2 As built). Changed from this plan: a rulebook compiles on top of the format data it was frozen from (`base`), not through `aliases.questions`; `per` scores one result carrying `units` (migration 0106); `number` questions for amounts |
| 3 | Database: `rulebooks`, `rulebook_edits`; migration; resolution through rulebooks | R3 | not started |
| 4 | Admin editor (six blocks, every sheet) on season rulebooks | 6b (admin Find) | not started |
| 5 | Timeline edits: show changed / fix, reach, league fan-out, rescore | 6b | not started |
| 6 | Research: the rulebook prompt, paste-and-review, check for changes | 6b | **logic built** 2026-10-24 (`rulebook-research.js`, tried on 11 shows); Check for changes and the screens are 6b's |
| 7 | Commissioner: read view, Make it ours, own-copy editor, offers and fixes | 6b (on 6a's Scoring rules) | not started |
| 8 | Library, kinds of show, the new-show flow, "Fits these games", first-creator-is-parent | 10 | **library seeded** 2026-10-24: six researched rulebooks in `src/lib/game/formats/library/` |
| 9 | Clean-up: retire `show_formats`, `league_rulesets`, `season_rule_changes`, old screens | C | not started |

Update this table (and `docs/HANDOFF.md`) as phases land.

---

## 1. Where the code is today (read before changing anything)

### The format engine (`src/lib/game/formats/`, plain CommonJS, runs in browser + Next + bare node)

| File | Role today | Fate |
|---|---|---|
| `index.js` | Registry `FORMATS = { survivor, traitors, challenge, generic }`; `formatFor(id, data)` (built-in id wins, else builds a stored format from `data`, else **falls back to Survivor**); `formatForRuleset(data)` (a league copy; never resolves to a built-in) | Kept. Gains `formatForRulebook(compiled, reader)` |
| `define.js` | `defineFormat(data, code)` joins the **data half** (`FormatData`, JSON) and **code half** (wiki read schema/prompt, research reviewer notes, `roleFor`). `formatProblems(data)` validates the data half | Kept; `formatProblems` relaxed (see 4.6) |
| `custom.js` | `buildDataFormat(data)`: a data-only format with a generic code half. **Throws if `data.roles`** (no generic `roleFor` yet) | Gains a generic `roleFor` (4.6) |
| `rules.js` | The rule language: research rules (`{ when:{answer,is}, award }`), implied rules (`whenExit/whenExiled/whenRole`), conditions, `BUILT_INS` (`votedForLeaver`, `votedForLeavers`, `voteByRole`, `caseLeadByRole`, `roleWonEpisode`), episode gating (`fromEpisode`, events' `retiredFrom`), `describeRule` | Kept as the **compile target**. Two small additions (4.6) |
| `checklist.js` | Research checklist as data; `CORE_FIELDS` every checklist must have (`name`, `leftTheGame`, `exitMethod`, `sources`, `confidence`), `OPTIONAL_FIELDS.juryVotesReceived` | Kept; the compiler emits checklists |
| `survivor.js`, `traitors.js`, `challenge.js`, `generic.js` | Built-in formats: data half + hand-written code half (wiki schemas close over each file's own `exitMethods`) | Kept as **readers** (their code halves). Their data halves become frozen legacy compiles (4.5) |
| `season-changes.js` | Additive season deltas layered with gating: `applyChanges`, `withChanges`, `changeProblems` | Superseded by `rulebook-patch.js`; kept until phase 9 for old leagues |
| `proposal.js`, `season-check.js`, `ruleset-review.js` | Research prompt → parse → review for new formats / season checks / league copies | Superseded by `rulebook-research.js` (phase 6); kept until phase 9 |

### How a league resolves its rules (`src/lib/game/state-logic.js`)

- `formatOf(state)` (line ~82): `settings.leagueRulesetData` (a league's own copy) **else**
  `formatFor(settings.showFormat, settings.showFormatData)` — then layers
  `settings.adoptedRuleChanges` via `withChanges`.
- **Game logic never reads the database.** Everything it needs is cached in the league's `state` JSON
  (`leagues.state`), written by the server: `showFormat`/`showFormatData` (db/show-formats.js
  `setLeagueFormat`/`syncLeagueFormat`), `leagueRulesetData` (db/league-rulesets.js `setLeagueRuleset`),
  `seasonRuleChanges`/`adoptedRuleChanges` (db/season-rule-changes.js `syncLeagueChanges`).
- **Event ids are persisted inside league state:** each episode's `scoringEvents[].type` is an event id,
  and `settings.eventPoints` is keyed by event id. Research answers (`episode_research.payload`) are
  keyed by checklist keys. **Renaming an id or a key breaks every league that recorded it.**
- `winnerExitMethod` is read at state-logic lines ~1779, 1955, 1979, 2298, 2392 (season-over, finishers,
  replenish). A rulebook with no winner must be null-safe at every one.
- `postMerge` lives on each episode (`EpisodeLogic.create`); `hasMerge` controls whether the UI offers it.

### Server and database

- Tables: `shows` (`format` TEXT, migration 0021), `show_seasons` (0006 + later columns),
  `show_formats` (0049: stored formats, `status draft|approved`, `proposal`, `data`, `version`),
  `league_rulesets` (0052: league copies with `parent_kind/parent_id/parent_version`; `leagues.ruleset_id`),
  `season_rule_changes` (0053), `season_decisions` (0019), `episode_research` (0014/0015). Latest
  migration: **0059**. Migrations run with `npm run migrate` (`db/migrate.js`).
- Fan-out pattern: `src/lib/server/show-formats.ts` `pushShowFormat` and
  `src/lib/server/season-rule-changes.ts` `pushSeasonRuleChanges` find leagues with
  `state->'settings'->>'showId'` (+ `wikiSeason`) and update each **under its own lock**
  (`withLeagueLock`, `src/lib/server/db.ts`), collecting failures instead of failing the request.
- Season-level resolution: `db/season-rule-changes.js` `seasonFormat(db, seasonId, {formatId, episode})`
  (used by `db/episode-research.js` ~1489 and `db/wiki-sync.js` ~1060); `db/show-formats.js`
  `resolveFormat` (used by `db/embeddings.js`, the decisions route, the shows routes).
- Applying results to leagues: `src/lib/server/season-decisions.ts` `syncLeagueDecisions` /
  `syncSeasonLeagues` — reuse for rescoring.
- No job runner or cron exists; long work runs in the request (chunked, idempotent, failures reported).

### UI today

- Admin: `src/components/admin/` — `shows-pages.tsx` (Shows, Show, Show settings with the Rules
  dropdown), `formats-pages.tsx` (Formats & rules: Researched / Built in), `format-review-screen.tsx`
  (1,714 lines; stored-format review), `format-rules-view.tsx`, `season-frame.tsx` (tabs Episodes ·
  Cast · Rules · Setup), `season-setup.tsx` (`SeasonRulesPage`), `season-rule-check.tsx` (pre-redesign
  UI), `new-show-page.tsx`. Primitives: `admin-ui.tsx` (`AdminPage`, `Section`, `Rows`, `Row`,
  `ActButton`, `StickyBar`, `Segmented`, `Step`, `CopyButton`, `Notice`, `count`).
- League: `src/components/setup/rules-section.tsx` (Scoring & rules), `league-ruleset-editor.tsx`,
  `rule-changes-section.tsx`; primitives `settings-ui.tsx` (`SettingsPage`, `IndexRow`, `ToggleRow`,
  `Stepper`, `StepperRow`, `Field`, `MoreOptions`, `Chip`, `PrimaryButton`, `MoreButton`, `TextSheet`).
- Shared: `src/components/ui/bottom-sheet.tsx` (`BottomSheet`, `SheetAction`),
  `src/components/ui/caption-plate.tsx` (`CaptionPlate`, the caption tag shape).
- Self-serve research: `src/app/api/formats/*` + `src/components/dashboard/research-show-flow.tsx`
  (any signed-in user researches a show; `create-show` always makes a **new** show).
- API client: `src/lib/api.ts` (`getLeagueRuleset`, `forkLeagueRuleset`, `adminListFormats`, …).
- Tests: `node --test "tests/*.test.js"`; regression harness `tests/harness/format-regression.js`
  (prints everything a format drives; diff before/after a refactor). Browser checks:
  `scripts/dev-test/` (`browser.js` headless Chromium helper, `linked-fixture.js`, `check-reveal.js`).

---

## 2. Decisions this plan makes (and changes from the design plan)

1. **Moment ids are camelCase, not dotted.** `formatProblems` requires `/^[a-z][A-Za-z0-9]*$/`. A
   moment id is `${segmentId}${Template}`, e.g. `immunityChallengeWon`. (Design plan said
   `immunity.won`.)
2. **Existing rules are frozen, not recompiled, until someone edits them.** Every rulebook created by
   migration stores `compiled` = today's `FormatData` verbatim and `compiled_source = 'legacy'`. Its
   `blocks` are hand-written (built-ins) or best-effort derived (stored formats) for **display only**.
   The first save from the editor switches it to `compiled_source = 'blocks'` and compiles with an
   **alias map** (new moment id → legacy event id, new question key → legacy checklist key) so every
   recorded event, point and research answer keeps working. Day one, nothing scores differently by
   construction; risk moves to "first edit", which is opt-in and regression-tested.
3. **Leagues keep a cached copy of their compiled rules** (today's proven pattern), not
   hydrate-on-read. State is read in many places (`withLeagueLock`, the state route, push events,
   late-join, bots), and `formatFor` silently falls back to Survivor when data is missing — a missed
   read site would mis-score a league with no error. Instead: settings carry
   `rulebook: { id, version, data }`, refreshed by a chunked, resumable fan-out with a version stamp,
   so a stale league is detectable (`version` behind) and repairable. Revisit hydrate-on-read only if
   fan-out at real scale is too slow (test idea T-40).
4. **A rulebook is base blocks + an ordered list of in-force edits.** Compiling with edits gates each
   added/changed item from its edit's episode (as `season-changes.js` does today), and closes replaced
   items at the episode before. A "Fix a mistake" from episode 1 is folded into the base on approval
   (version bump); a fix from a later episode stays an edit.
5. **Phase start episodes are season data, confirmed by a person.** The rulebook stores
   `phaseStarts: { [phaseId]: episode }`. A phase that starts "at an episode" fills it from the block.
   "When N are left" / "When the show says so" stay unset until research flags it and the admin confirms
   (a To do item). A phase-limited segment's rules don't run while its phase start is unknown — a
   missing result shows up in review, a wrong one silently rescores (same principle as `rules.js`
   gating).
6. **The wiki connector ("reader") is per rulebook, and only three exist.** `reader` ∈ `survivor |
   traitors | challenge | research | league`. The first three reuse the built-in code halves, whose wiki
   schemas close over their own exit methods: the compiler warns when a rulebook on a built-in reader
   has ways out the reader can't see ("The Survivor wiki connector won't report 'Removed for conduct';
   research will"). `research` = generic code half (`custom.js`); `league` = no automatic source.
7. **Two engine additions, kept small:** research rules gain `per: '<integer answer key>'` (for "each
   time" and "per amount" moments; implied rules already have `per`), and rules gain `untilEpisode`
   (for edits that replace an item; events already have `retiredFrom`). A generic `roleFor` lets a
   data-only format have secret roles.
8. **Comebacks of people who left score, but don't re-enter play — yet.** Nothing in `state-logic`
   lets a castaway who left come back into rosters/standings. Phase 8 ships the moment ("Came back
   into the game") and a backlog item for real re-entry; the editor's help says so for that answer.
9. **Feature flag.** `app_settings` key `rulebooks` (Admin → Site, "Rulebooks (new)"): off = today's
   screens; on = the new ones. Data is dual-written from phase 3 so the flag can flip back.

---

## 3. The rulebook data (the single shape the editor, research and the compiler share)

`src/lib/game/formats/rulebook-schema.js` owns this shape. Every enum below is an `OPT` list there,
each option `[value, label, help]` (the mockup's `OPT`, minus its internal first column). The editor
renders labels/help from it; the prompt lists values + help from it; the validator accepts only its
values. **Adding an option there adds it to the editor, the prompt and the validator together.**

```js
Rulebook blocks = {
  schema: 1,
  kind: 'competition' | 'series' | 'talk' | 'event',
  show: 'Survivor',                                   // display name for prompts
  cast: {
    unit: 'people' | 'pairs' | 'panel',
    singular: 'castaway', plural: 'castaways', usualSize: 18,
    groups: null | { type: 'sides' | 'couples' | 'coachTeams', singular: 'tribe', change: 'never' | 'atPhases' | 'often' },
  },
  season: {
    phases: [{ id, name, starts: { type: 'episode' | 'remaining' | 'announced', n? },
               changes: ['groupsEnd'|'groupsReshuffle'|'juryStarts'|'viewersVote'|'arrivals'|'segmentsChange'], summary }],
    finale: { decidedBy: 'juryVote'|'judges'|'viewersVote'|'castVote'|'lastStanding'|'firstToFinish'|'mostPoints'|'groupWins'|'nobody',
              finalists?: 3, summary },
  },
  segments: [{
    id, name,
    decidedBy: 'result' | 'judges' | 'vote' | 'pick' | 'headToHead' | 'nobody',
    voters?:  'cast' | 'viewers' | 'jury' | 'judges' | 'secretGroup',      // vote only
    pickers?: 'onePerson' | 'eachPerson' | 'panel',                        // pick only
    takesPart?: 'everyone' | 'groups' | 'groupsThenEach' | 'atRisk',      // not nobody
    decides?:  'winner' | 'topThree' | 'bestAndWorst' | 'fullOrder' | 'score',  // result/judges/headToHead
    onTheLine?: 'nothing' | 'reward' | 'advantage' | 'safety' | 'atRisk' | 'goingHome',
    often: 'everyEpisode' | 'someEpisodes' | 'onePhase', phase?: '<phase id>' | 'finale',
    momentsOff?: ['<moment id>'],
  }],
  waysOut: [{ id, name, means: 'out' | 'finalist' | 'winner' | 'ending',
              cause: { segment: '<id>' } | 'ownChoice' | 'medical' | 'removed' | 'story' }],
  twists: [
    { id, type: 'secretRole', name, roles: ['Traitor', 'Faithful'], revealed: 'whenTheyLeave'|'atFinale'|'never', canSwitch: 'never'|'recruited', summary },
    { id, type: 'advantage', name, oneIsCalled: 'an idol', gotBy: 'found'|'wonAt'|'given'|'chosenByShow', wonAt?: '<segment id>',
      does: ['keepsSafe'|'cancelsVotes'|'savesSomeone'|'hurtsSomeone'|'extraVote'|'skipsATask'], lasts: 'untilPlayed'|'oneUse'|'oneEpisode', summary },
    { id, type: 'comeback', name, who: 'peopleWhoLeft'|'newPeople', how: 'winHeadToHead'|'viewersVote'|'theShow', summary },
    { id, type: 'sideTrip', name, oneIsCalled: 'a journey', who: 'chosen'|'random'|'won', canGet: ['advantage'|'disadvantage'|'nothing'], summary },
  ],
  customMoments: [{ id, label, question?, during?: { segment: id } | { twist: id },
                    counted: 'yesNo'|'eachTime'|'perUnit', answeredBy: 'research'|'league',
                    reliability: 'reliable'|'usually'|'patchy' }],
  points: { '<moment id>': number | { exclusive, shared } },      // suggested-point overrides
  momentNotes: { '<moment id>': { reliability, answeredBy } },    // research's rating of BUILT moments
  leftOut: ['one sentence each'],
}
```

Stored beside the blocks (rulebook row columns, not part of what research returns): `reader`,
`aliases`, `phaseStarts`, `compiled`, `compiledSource`, `version`.

**Item ids** (`segments[].id`, `waysOut[].id`, …) are camelCase slugs made once from the name
(`camelId` in `proposal.js` does this today) and **never change on rename**: edits, momentsOff,
points overrides and `during` refer to ids.

This closes three gaps found in review of the mockup: built-moment point overrides live in `points`;
research rates built moments in `momentNotes`; a hand-added moment can sit under a twist (`during.twist`).

---

## 4. Core logic (pure CommonJS in `src/lib/game/formats/`) — phases 1–2

Every module: no dependencies outside `formats/`, a header comment in the style of `rules.js`, a
`.d.ts` beside it (as `index.d.ts`), browser-safe.

### 4.1 `rulebook-schema.js` (phase 1)

- `OPT` (every enum above, `[value, label, help]`), `KINDS` (labels per block per kind — the table in
  the design plan's "Layer zero": which blocks hide, what they're called), `DECIDED_TAG`
  (`result: 'Contest'`, `judges: 'Judged'`, `vote: 'Vote'`, `pick: 'Pick'`, `headToHead: 'Head to head'`,
  `nobody: 'No contest'`), `QUESTIONS` (every editor question's text: "Who decides it?", "What's on the
  line?", … — copied from the mockup), `BLOCKS` order.
- `labelOf(key, value)`, `helpOf(key, value)`, `optionsFor(key, ctx)` (e.g. "Which phase?" options from
  the rulebook's phases; "What causes it?" = segments that aren't `nobody` + the fixed causes).
- `blocksProblems(blocks)` → `[{ at: 'segments[tribalCouncil].voters', message }]`: only listed values;
  required answers per `decidedBy` (voters only for vote, decides not for vote/pick/nobody, …); ids
  unique and camelCase; references resolve (`phase`, `wonAt`, `cause.segment`, `during`, `momentsOff`,
  `points` keys); at least one way out with `means: winner` **unless** `kind` is series/talk/event or
  `finale.decidedBy` is `nobody`/`groupWins`. Messages are plain ("Tribal Council: who votes isn't one
  of the choices"), located by `at` so the review screen can put each one on its row.

### 4.2 `rulebook-moments.js` (phase 1) — what each answer builds

`momentsFor(blocks) → [{ id, label, from: { segment|twist|wayOut|finale|custom: id }, defaultPoints,
question?, rule, auto? }]`. The mockup's `generate`/`generateTwist` are the reference. Templates
(`{n}` = the item's name, `{seg}` its id, `{Group}` the cast's group word):

| Source | Condition | Moment id | Label | Default pts | How it's known |
|---|---|---|---|---|---|
| segment result/judges/headToHead | decides winner/topThree/bestAndWorst | `{seg}Won` | Won the {n} | 2 | question yes/no |
| | decides topThree | `{seg}Second`, `{seg}Third` | 2nd / 3rd in the {n} | 1, 0.5 | question |
| | decides bestAndWorst | `{seg}Best`, `{seg}Worst` | Among the best / worst at the {n} | 1, −1 | question |
| | decides fullOrder | `{seg}First`, `{seg}Last` | First / Last in the {n} | 2, −1 | question |
| | decides score | `{seg}PerPoint` | Each point at the {n} | 0.1 | integer question, `per` |
| | headToHead, onTheLine ≠ goingHome | `{seg}Lost` | Lost the {n} | −1 | question |
| | takesPart groups/groupsThenEach and cast has groups | `{seg}GroupWon` | {Group} won the {n} | 1 | question (group) |
| segment vote, voters cast | | `{seg}ZeroVotes`, `{seg}SurvivedVotes`, `{seg}VotedWithMajority`, `{seg}VotedAgainstMajority` | Zero votes at {n} · Received votes at {n} and survived · Voted with the majority · Voted against the majority | 0.5, 1, 0.5, 0 | `{seg}VotedFor` string + `{seg}VotesReceived` integer; `votedForLeaver` built-in |
| segment vote, viewers/jury/judges | | `{seg}Bottom`, `{seg}Saved` | In the bottom at {n} · Saved at {n} | −1, 1 | question |
| segment vote, secretGroup | | `{seg}TargetedSurvived` | Targeted at {n} and survived | 1 | question |
| segment pick | | `{seg}Picked`, `{seg}PickedFirst`, `{seg}NotPicked` | Picked / Picked first / Not picked at the {n} | 1, 2, −1 | question |
| segment any | onTheLine advantage | `{seg}EarnedAdvantage` | Earned an advantage at the {n} | 2 | question |
| | onTheLine reward (name lacks "reward") | `{seg}SharedReward` | Shared the reward from the {n} | 0.5 | question |
| | onTheLine atRisk | `{seg}AtRisk` | Put at risk at the {n} | −0.5 | question |
| segment nobody | | — | (nothing; customMoments during it) | | |
| way out | each | `{way}` | its name | means out −3 · finalist 2 · winner 5 · ending 3 | **implied** `whenExit` (auto) |
| finale juryVote | | `finaleJuryVote`, `finaleNoJuryVotes` | Each jury vote received · Finalist with no jury votes | 0.5, −2 | implied, `per: 'juryVotes'` |
| secretRole | for each vote segment (cast, goingHome) | `{twist}{Other}Caught{Secret}At{seg}` etc. | As a {other}, voted out a {secret} at {n} · As a {secret}, voted out a {other} at {n} | 3, 1 | `voteByRole` built-in |
| | canSwitch recruited | `{twist}Recruited`, `{twist}TurnedDown` | Recruited as a {secret} · Turned down the offer | 3, 1 | role fact (`whenRole`) / question |
| | revealed atFinale | `{twist}MadeFinale` | Reached the finale as a {secret} | 3 | implied exit + role |
| advantage | always | `{twist}Got`, `{twist}Played` | Got {one} · Played {one} | 2, 1 | question |
| | does cancelsVotes / keepsSafe / savesSomeone / hurtsSomeone / extraVote / skipsATask | `{twist}CancelledVotes` … | Played {one} that cancelled votes · Saved by {one} · Used {one} to save someone · Had {one} used against them · Cast an extra vote · Skipped a task with {one} | 2, 2, 1, −1, 1, 1 | question |
| | lasts untilPlayed | `{twist}WentHomeHolding` | Went home holding {one} | −1 | implied exit + question |
| comeback | who peopleWhoLeft | `{twist}CameBack`, `{twist}SentHomeAgain` | Came back into the game · Sent home again | 2, −1 | question (see decision 8) |
| | who newPeople | `{twist}Arrived` | Arrived partway through | 0 | question |
| | how winHeadToHead | `{twist}WonWayBack` | Won their way back | 3 | question |
| sideTrip | always | `{twist}Went` | Went on {one} | 1 | question (or `stage: 'exiled'` for Survivor alias) |
| | canGet advantage / disadvantage | `{twist}CameBackWithAdvantage`, `{twist}LostSomething` | Came back from {one} with an advantage · Lost something on {one} | 2, −1 | question |
| custom moment | | `{custom}` | its label | as set | question built from `counted` (below) |

Questions are generated in the mockup's words (`questionFor`): yesNo "This episode, who {label}{ at the
{segment}}?"; eachTime "…how many times did each person: {label}…?"; perUnit "…how much for each
person: {label}…?"; talk shows "Did it happen tonight: {label}?". A custom moment's `question`
overrides. `momentsOff` removes a built moment; `points` overrides its default.

### 4.3 `rulebook-compile.js` (phase 2) — blocks → `FormatData`

`compileRulebook(blocks, { edits = [], phaseStarts = {}, aliases = {}, reader }) → { data, problems,
warnings }`. Steps, in order (each a small exported function so tests can hit it alone):

1. **Apply edits** (`rulebook-patch.js` `applyEdits`): returns the merged blocks plus, per item, the
   episode range it's in force for.
2. **Terms / groups:** `terms = { castaway: cap(cast.singular), tribe: cap(groups.singular || 'Group') }`;
   `hasGroups = !!cast.groups`; `hasMerge = phases.some(p => p.changes.includes('groupsEnd'))`.
3. **Exits:** `exitMethods = waysOut.map(w => w.name)` + `'Other'`; `winnerExitMethod` = the
   `means: winner` way's name, or **null**; `endgameExitMethods` = finalist + winner + ending names.
4. **Moments → events:** `momentsFor(blocks)` minus `momentsOff`; `defaultPoints` from `points`
   overrides; `implied: true` for way-out/finale moments. Ids through `aliases.events`.
5. **Categories:** one per segment (label = its name), one per twist, `leaving` ("Leaving the game":
   out ways), `endgame` ("Endgame": finish ways + finale moments), `other` ("Other moments": custom
   moments with no `during`). Matches today's category model; Points groups render from it.
6. **Recap:** headline wins = each segment whose `onTheLine` is safety or reward → its `Won` (and
   `GroupWon` as `tribeEvents`).
7. **Checklist:** `CORE_FIELDS` + one field per question-backed moment (`answer` / `integer` /
   `string`), keys through `aliases.questions`; `juryVotesReceived` when the finale is a jury vote;
   episode field `phaseStarted` (enum of announced/remaining phase ids) when any phase isn't
   episode-fixed — research's per-episode flag for decision 5.
8. **Rules:** research rules from each moment's `rule`; implied rules for ways out and finale; gating:
   a moment from a phase-limited segment gets `fromEpisode`/`untilEpisode` from `phaseStarts` (and is
   omitted while unknown); a moment from an edit gets its edit's range.
9. **Roles:** a `secretRole` twist → `roles: { default: roles[1], values: roles }`.
10. **Wiki + research halves:** `reader` built-in → the family's `wiki` data (section names, eventTypes
    filtered to moments that exist) and a **warning** for each way out the family's code can't see;
    otherwise generic. `research.searchHint` from the kind and show; `claims` = the yes/no questions.
11. **Validate:** `formatProblems(data)` (relaxed, 4.6) — any problem here is a compiler bug, not a
    user error, and fails tests.

`formatForRulebook(compiled, reader)` in `index.js`: built-in reader → `defineFormat(compiled,
FORMATS[reader].code)`; else `buildDataFormat(compiled)`. Memoised per `compiled` object (WeakMap),
like `formatForRuleset`.

### 4.4 `rulebook-patch.js` (phase 5)

An edit = `{ id, kind: 'showChanged' | 'fix' | 'league', fromEpisode, ops: [...], summary, version }`.
An op is `{ op: 'add' | 'update' | 'remove', block: 'segments' | 'waysOut' | 'twists' |
'customMoments' | 'phases' | 'cast' | 'finale' | 'points' | 'momentsOff', id?, value? }`.
`applyEdits(base, edits)` applies in-force edits in `fromEpisode` order (ties: approval order) and
returns `{ blocks, ranges: { '<block>:<id>': { from, until } } }`; `editProblems(base, edit)` locates
problems per op (an `update` of a missing id, a `remove` that orphans a `during`, …).
`diffBlocks(a, b)` produces ops from two block versions (what the editor sends on Save).

Example: what "Check for changes" sends back (the design plan described it in one sentence):

```json
{ "fromEpisode": 8, "kind": "showChanged", "summary": "A new advantage, Block a Vote, from the merge.",
  "ops": [
    { "op": "add", "block": "twists", "value": { "id": "blockAVote", "type": "advantage", "name": "Block a Vote",
      "oneIsCalled": "a Block a Vote", "gotBy": "found", "does": ["hurtsSomeone"], "lasts": "oneUse",
      "summary": "Played at Tribal to take away someone's vote." } },
    { "op": "update", "block": "segments", "id": "rewardChallenge", "value": { "often": "onePhase", "phase": "tribes" } },
    { "op": "remove", "block": "customMoments", "id": "sentToExile" }
  ],
  "leftOut": [] }
```

### 4.5 Built-ins as blocks, and the legacy freeze (phases 1–2)

- `src/lib/game/formats/blocks/survivor.blocks.js`, `traitors.blocks.js`, `challenge.blocks.js`:
  hand-written blocks (the mockup's sample data for Survivor/Traitors is the starting point) plus each
  one's **alias map** (`aliases.events`: e.g. `immunityChallengeWon → individualImmunity`,
  `tribalCouncilZeroVotes → zeroVotesSafe`, `votedOut → votedOut`; `aliases.questions`: new keys →
  the checklist keys in `survivor.js`). Where a built-in event has no template (e.g. Survivor
  `satOut`, `learnedOfAdvantage`, `chosenForReward`), it becomes a **custom moment** with an explicit
  id, so nothing is lost.
- `blocksFromFormat(data)` (best effort, for stored formats in migration): segments from
  `eventCategories` (a category → a `nobody` segment whose events become custom moments `during` it),
  ways out from `exitMethods`, `kind: 'competition'`. Display-only until edited.
- **The freeze:** a migrated rulebook's `compiled` is the exact current `FormatData`. Phase-2 tests
  prove `compileRulebook(survivorBlocks, { aliases })` scores the harness fixtures identically to the
  frozen data (same awarded event ids and points per castaway per episode) — not byte-identical text.

### 4.6 Engine relaxations outside the new files (phase 2)

- `define.js formatProblems`: `winnerExitMethod` may be `null` (then `endgameExitMethods` need not
  include it); `exitMethods` may be just `['Other']` (talk shows). Every other check stays.
- `state-logic.js`: every `winnerExitMethod` read null-safe (season-over detection without a winner =
  the last episode in the rulebook, or never for open-ended talk/series seasons);
  `formatOf` checks `settings.rulebook` first: `formatForRulebook(settings.rulebook.data,
  settings.rulebook.reader)`, then the existing chain (kept for leagues not yet migrated).
- `rules.js`: research rules accept `per: '<integer answer key>'` (validate it names an integer
  question; award once per unit); every rule accepts `untilEpisode` (checked like `fromEpisode`).
- `custom.js`: a generic `roleFor` (role from the person's `role` answer, revealed per `revealed`) so a
  data-only format can carry `roles`; remove the throw.

### 4.7 `rulebook-describe.js` (phase 1) — view models for the UI

Pure functions the React components render, so admin and commissioner pages share wording:
`whoLine(blocks)` ("18 castaways, in tribes. Tribes change at set points."), `segmentLine(segment,
blocks)` ("Every episode · the cast votes · sends someone home"; stake phrases: nothing → "nothing on
the line", reward → "for a reward", advantage → "for an advantage", safety → "for safety", atRisk →
"puts someone at risk", goingHome → "sends someone home"), `phaseBar(blocks, phaseStarts, aired)`,
`startText(phase)` ("From episode 8", "When 12 are left", "When the show says so"), `waysSummary`,
`twistSummary`, `pointGroups(compiled, blocks)` (groups in category order, with `auto` / `league
answers` / `asked` flags), `blockSummaries(blocks)` (the editor index's one-liners),
`resultsLine(reader)` ("Results come from the Survivor wiki connector, then research.", …).

### 4.8 `rulebook-fits.js` (phase 8)

`gamesFor(blocks, compiled)` → `[{ type, fits, needs }]` for the game types: Active Roster (a cast and
≥5 moments, not talk), Classic (an `out` way and a `winner` way), Eliminator Pool (a segment
`goingHome` every episode), and placeholders Bingo/Live react/Predictions/Quiz (future library). Used by
the rulebook page and the new-league flow.

### 4.9 `rulebook-research.js` (phase 6)

`buildRulebookPrompt({ show, kind, wikiUrl, template, seasons })` — generated from `OPT` (every field,
its values, each value's help), the three rules (only listed values · the show's own names · `leftOut`
instead of forcing), and the nearest template's blocks as the starting skeleton. **The full shape, not
truncated** (the mockup cuts at 40 lines; the real prompt must not). `parseRulebookAnswer(text)`
(tolerates chatter around the JSON, like `parseProposal`). `reviewRulebook(blocks)` → `{ blocks,
problems (located), warnings, leftOut, approvable }` — bad rows are kept with their problem, never
dropped. `buildCheckPrompt({ blocks, edits, airedThrough, flags })` and `reviewCheck(answer, base)`
for "Check for changes" (returns an edit, 4.4).

---

## 5. Database — phase 3

### 5.1 Migration `0060_rulebooks.sql`

```sql
CREATE TABLE rulebooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'competition' CHECK (kind IN ('competition','series','talk','event')),
  owner_kind TEXT NOT NULL CHECK (owner_kind IN ('library','season','league')),
  season_id UUID REFERENCES show_seasons(id) ON DELETE CASCADE,
  league_id UUID REFERENCES leagues(id) ON DELETE CASCADE,
  is_template BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','in_force','archived')),
  parent_kind TEXT NOT NULL DEFAULT 'none' CHECK (parent_kind IN ('none','rulebook','builtin','show_format','league_ruleset')),
  parent_id TEXT,
  parent_version INT,
  reader TEXT NOT NULL DEFAULT 'research' CHECK (reader IN ('survivor','traitors','challenge','research','league')),
  blocks JSONB NOT NULL,
  compiled JSONB,                       -- FormatData; null while a draft has problems
  compiled_source TEXT NOT NULL DEFAULT 'blocks' CHECK (compiled_source IN ('blocks','legacy')),
  aliases JSONB NOT NULL DEFAULT '{}'::jsonb,
  phase_starts JSONB NOT NULL DEFAULT '{}'::jsonb,
  version INT NOT NULL DEFAULT 1,
  visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('private','shared')),
  review_status TEXT NOT NULL DEFAULT 'unreviewed' CHECK (review_status IN ('unreviewed','approved')),
  created_by TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  approved_by TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT rulebooks_owner_shape CHECK (
    (owner_kind = 'library' AND season_id IS NULL AND league_id IS NULL) OR
    (owner_kind = 'season'  AND season_id IS NOT NULL AND league_id IS NULL) OR
    (owner_kind = 'league'  AND league_id IS NOT NULL)
  )
);
CREATE UNIQUE INDEX rulebooks_one_per_season ON rulebooks(season_id) WHERE owner_kind = 'season' AND status <> 'archived';
CREATE INDEX rulebooks_parent ON rulebooks(parent_kind, parent_id);
CREATE INDEX rulebooks_templates ON rulebooks(kind) WHERE is_template;

CREATE TABLE rulebook_edits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rulebook_id UUID NOT NULL REFERENCES rulebooks(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('show_changed','fix','league')),
  from_episode INT NOT NULL CHECK (from_episode >= 1),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','in_force','no_change','withdrawn')),
  ops JSONB NOT NULL DEFAULT '[]'::jsonb,
  summary TEXT,
  reach TEXT NOT NULL DEFAULT 'everyone' CHECK (reach IN ('everyone','following')),
  source TEXT NOT NULL DEFAULT 'admin' CHECK (source IN ('admin','research_check','migration','commissioner')),
  proposal JSONB,                       -- the pasted research answer, row by row, for review
  checked_through INT,
  base_version INT NOT NULL,
  version INT NOT NULL DEFAULT 1,
  created_by TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  approved_by TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX rulebook_edits_by_book ON rulebook_edits(rulebook_id, status, from_episode);

-- Own-copy leagues are offered "the show changed" edits (fixes reach them automatically).
CREATE TABLE rulebook_offers (
  league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  edit_id UUID NOT NULL REFERENCES rulebook_edits(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'offered' CHECK (status IN ('offered','adopted','declined')),
  decided_by TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  decided_at TIMESTAMPTZ,
  PRIMARY KEY (league_id, edit_id)
);

-- A fan-out run, so a push to thousands of leagues is resumable and its failures are visible.
CREATE TABLE rulebook_pushes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rulebook_id UUID NOT NULL REFERENCES rulebooks(id) ON DELETE CASCADE,
  version INT NOT NULL,
  rescore_from INT,                     -- set for a fix: rescore each league from this episode
  total INT NOT NULL DEFAULT 0, done INT NOT NULL DEFAULT 0,
  failed JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running','done','failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE show_seasons ADD COLUMN rulebook_id UUID REFERENCES rulebooks(id) ON DELETE SET NULL;
ALTER TABLE shows ADD COLUMN kind TEXT NOT NULL DEFAULT 'competition' CHECK (kind IN ('competition','series','talk','event'));
ALTER TABLE shows ADD COLUMN new_season_from TEXT NOT NULL DEFAULT 'latest';   -- 'latest' | 'rulebook:<uuid>' | 'scratch'
ALTER TABLE leagues ADD COLUMN rulebook_id UUID REFERENCES rulebooks(id) ON DELETE SET NULL; -- own copy only
```

Purely additive: `shows.format`, `show_formats`, `league_rulesets`, `leagues.ruleset_id`,
`season_rule_changes` are untouched and keep working with the flag off.

### 5.2 Backfill: `db/backfill-rulebooks.js` (idempotent, `--dry-run`, run once per environment)

1. Library templates: one row per built-in (`is_template`, `owner_kind library`, `status in_force`,
   `parent_kind builtin`, blocks from `blocks/*.blocks.js`, `compiled` = `FORMATS[id].data`,
   `compiled_source legacy`, `aliases` from the blocks file, `reader` = the id). One per approved
   `show_formats` row (`parent_kind show_format`, blocks via `blocksFromFormat`, `compiled` = `data`,
   `reader research`).
2. Season rulebooks: for each `show_seasons` row: parent = the show's format's template; `blocks` and
   `compiled` copied; then each approved `season_rule_changes` row becomes a `rulebook_edits` row
   (`source migration`, `kind show_changed`, `from_episode` = effective episode, `ops` translated from
   its delta — events → customMoments, exit methods → waysOut, retire → `momentsOff` op).
   `show_seasons.rulebook_id` set. `phase_starts` from `tribes_from_episode`/merge data where known.
3. League rulebooks: each `league_rulesets` row → `owner_kind league`, `parent_kind league_ruleset` →
   re-pointed at the season rulebook it was forked from where resolvable; `leagues.rulebook_id` set.
4. Writes nothing into league state; phase 3's sync does that (5.4).
5. Prints a report: rows created per kind, and any season whose show format couldn't be resolved.

### 5.3 `db/rulebooks.js` (+ `.d.ts`)

`getRulebook`, `listLibrary({ templatesOnly })`, `seasonRulebook(db, seasonId)`,
`rulebookForLeague(db, settings)` (own copy → season's → null), `createRulebook`, `copyRulebook(db,
fromId, { ownerKind, seasonId|leagueId, userId })` (sets parent + parent_version), `saveBlocks(db, id,
blocks, userId)` (validates, compiles, bumps version, `compiled_source blocks`), `setPhaseStart`,
`lineage(db, id)` (parent chain for the lineage line, children counts: seasons, leagues following, own
copies), `leaguesUsing(db, id)` (following = leagues on the season without `rulebook_id`; own copies),
`compiledFor(db, id, { throughEpisode })` (blocks + in-force edits → compile; cached by `(id, version)`
in-process LRU).

`db/rulebook-edits.js`: `listEdits`, `createEdit` (from editor diff or research check), `saveEdit`,
`approveEdit` (fix from 1 → fold into base; bump version; start a push), `withdrawEdit`,
`recordNoChange`, `researchFlags` (moved from `season-rule-changes.js`: `rulesNote` + `phaseStarted`
answers newer than the last check).

### 5.4 Resolution switch-over (behind the flag)

- `db/season-rule-changes.js seasonFormat` → when the season has a `rulebook_id`, return
  `formatForRulebook(compiledFor(...))`; else today's path. Callers (`episode-research.js`,
  `wiki-sync.js`) unchanged. `db/embeddings.js` and the decisions route switch from `resolveFormat`
  to `seasonFormat`.
- `syncLeagueRulebook(db, settings)` (new, in `db/rulebooks.js`): sets `settings.rulebook = { id,
  version, reader, data, source: 'season' | 'own' }` from the league's own copy or its season's
  rulebook; leaves `showFormat`/`showFormatData` in place for rollback. Called from the league
  settings route when the show/season changes (beside `syncLeagueFormat`), on league create, and by
  the fan-out.
- `src/lib/server/rulebook-push.ts` `pushRulebook(rulebookId, { rescoreFrom })`: creates a
  `rulebook_pushes` row, walks leagues in chunks of 50 under `withLeagueLock` (as
  `pushSeasonRuleChanges` does), updates `done`/`failed` as it goes, and on a fix runs
  `syncLeagueDecisions` for the league from `rescoreFrom`. Resumable: re-running picks up leagues whose
  `settings.rulebook.version` is behind. The admin page shows progress and failures.

---

## 6. API routes — phases 3–8

All admin routes `requireAdmin`; league routes check commissioner as the existing ruleset routes do.
Request/response types in `src/lib/game/types.ts` (`Rulebook`, `RulebookSummary`, `RulebookEdit`,
`RulebookBlocks`, `RulebookReview`, `RulebookPush`), client calls in `src/lib/api.ts`.

| Route | Method | Does |
|---|---|---|
| `/api/admin/rulebooks` | GET | Library: templates (by kind), drafts, in use (with lineage counts) |
| `/api/admin/rulebooks` | POST | New rulebook: `{ from: 'template', id } \| { from: 'scratch', kind } \| { from: 'research', answer }` |
| `/api/admin/rulebooks/[id]` | GET | Rulebook + compiled + edits + lineage + leagues using + latest push |
| `/api/admin/rulebooks/[id]` | PATCH | Save blocks as a **draft** (validate, never push) |
| `/api/admin/rulebooks/[id]/save` | POST | `{ kind: 'showChanged'\|'fix', fromEpisode, reach, ops }` → creates and approves an edit, starts a push; returns `{ edit, push }` |
| `/api/admin/rulebooks/[id]/template` | POST | Save as template (copy to library) |
| `/api/admin/rulebooks/[id]/phase-starts` | PUT | `{ phaseId, episode }` (confirm a flagged phase start) |
| `/api/admin/rulebooks/[id]/prompt` | GET | The research prompt (full) |
| `/api/admin/rulebooks/[id]/review` | POST | `{ answer }` → `RulebookReview` (parse + located problems + leftOut), no write |
| `/api/admin/rulebooks/[id]/edits` | GET/POST | List; record a research check (`{ answer }` → draft edit or no_change) |
| `/api/admin/rulebooks/[id]/edits/[editId]` | GET/PATCH/DELETE | Review/save/withdraw a draft edit |
| `/api/admin/rulebooks/[id]/edits/[editId]/approve` | POST | Approve → push |
| `/api/admin/rulebooks/[id]/pushes/[pushId]` | GET/POST | Progress; POST resumes |
| `/api/admin/seasons/[id]/rulebook` | GET/POST | The season's rulebook; POST `{ from: 'latest'\|'rulebook', id? }` sets one up |
| `/api/admin/shows` | POST | Gains `kind` and `start` (`research`/`template:id`/`scratch`) for the new-show flow |
| `/api/admin/shows/[id]` | PATCH | Gains `kind`, `newSeasonFrom`; `format` ignored when the flag is on |
| `/api/leagues/[leagueId]/rulebook` | GET | The league's rulebook view: compiled, blocks, timeline (spoiler-gated server-side too), own-copy flag, offers |
| `/api/leagues/[leagueId]/rulebook` | POST | **Make it ours** (copy season rulebook → own) |
| `/api/leagues/[leagueId]/rulebook` | PATCH | Save own copy (`{ ops, fromEpisode }`) |
| `/api/leagues/[leagueId]/rulebook` | DELETE | Go back to following the season |
| `/api/leagues/[leagueId]/rulebook/offers/[editId]` | POST | `{ action: 'adopt'\|'decline' }` |
| `/api/formats/*` (self-serve) | — | Phase 8: researches a **rulebook** instead of a format; creating a show also creates its first season's rulebook with `created_by` = the user (decision 4 of the design plan) |

Old routes (`/api/admin/formats/*`, `/api/admin/seasons/[id]/rule-changes/*`,
`/api/leagues/[leagueId]/ruleset*`, `/rule-changes`) stay until phase 9.

---

## 7. UI — every screen, element and behaviour (phases 1, 4–8)

Components live in `src/components/rulebook/` (shared by admin and commissioner) unless noted. Copy is
the mockup's; the vocabulary table in the design plan is binding ("segment", "moment", "way out",
"advantage", "comeback", "side trip", "viewers", "Fix a mistake" / "The show changed").

### 7.0 Behaviour rules every screen follows (from testing the mockup at 360/390px)

- **Never lose your place.** Choosing an answer updates state without remounting the page or the
  sheet: keep components keyed by stable ids; no `key` that changes per edit; the sheet body's scroll
  and the page's scroll survive every tap. Test T-60.
- **Typing never re-renders the sheet.** Text inputs are uncontrolled-with-ref or debounce into the
  draft store; dependent text (sheet title, the question preview, the cast summary line) updates in
  place. A full re-render on blur swallowed the next tap in the mockup.
- **44px minimum** for every answer chip, card and button; a moment's on/off is its whole 48px row
  (a `switch` role on the row), not a 26px toggle.
- **Sheet footers are one row:** Cancel (34%) and the action (rest) side by side, like the reveal
  sheet. Remove sits last inside the sheet body as red text with an ✕. Sheets with nothing to confirm
  (pickers, "As data") keep one full-width Cancel.
- **Open on what you came to change:** an existing segment's "Who decides it?" is one line (tag +
  answer + help + **Change**); the six cards open only on Change. Add flows ask the deciding question
  first, then open the sheet collapsed.
- **Headers hold at 360px:** the mobile header's side cells are `minmax(0,1fr)`; the back label
  ellipsizes before the title; the title caps at `min(200px, 46vw)`. Phase names wrap.
- **One yellow per screen** (DESIGN.md One Chyron Rule): the sticky bar's primary action, or a sheet's
  Done. Chosen answers use the You fill (`bg-foreground text-background`), never chyron.
- **Spoilers:** anything describing a change from an episode (timeline details, research flags) hides
  behind "Show episode results" in admin (`useShowSpoilers`) and behind the league's reveal for players.

### 7.1 Shared building blocks (`src/components/rulebook/`)

| Component | What it renders |
|---|---|
| `ask.tsx` | `AskChips` (single or multi, from an `OPT` key; selected option's help under it, help only when set), `AskCards` (the six "Who decides it?" cards), `DecidedLine` (the collapsed one-line version with Change) |
| `how-the-season-works.tsx` | The read view, rows: **Kind of show** (You-fill chip + blurb), block 1 (`whoLine`), block 2 (phase bar: proportional segments, aired part muted, the finale a solid block; names wrap; under it one line per phase "Name (start): summary" and the finale), block 3 (the segments as caption plates: quiet tag = `DECIDED_TAG`, white plate with the name in condensed caps and `segmentLine`; "sends someone home" in live red), block 4 (two chip rows: Out / Finish — series: Leave / End; winner chip in the You fill with a crown), block 5 (twist name + type chip + summary), **Fits these games** (chips; non-fitting struck through and dimmed, tooltip "Needs …", and the line "Leagues pick a game and a length…"). Hidden blocks per kind are omitted. Label column 132px on desktop, stacked on phones |
| `points-list.tsx` | Groups (condensed caps label + type chip), 48px rows: label, `auto` / `league answers` tags, a chyron-line dot when a league changed it from the suggestion, the value in 22px condensed tabular (zero muted). First two groups, then "Show N more groups" (all on the Points block page) |
| `lineage.tsx` | Chain chips (template › season 49 › season 50 › **season 51** in the You fill) and the line "Started from **Season 50**. **212 leagues** follow it, **9** play their own copy. Results come from …". League variant: "Following Survivor 51's rulebook. Updates reach this league on their own; your points stay yours." / "Your own copy, from Survivor 51's rulebook. Fixes from the admin still reach it. Show changes are offered to you first." |
| `timeline.tsx` | Rows: episode number (condensed, "EP" caption; "NEXT —" for a draft), title ("In force from the premiere", "The show changed", "Fixed a mistake", "Your edit"), detail line; Draft chip in gold; a draft row has **Check**. Hidden rows: eye-off + "Details hidden" (admin) / "Hidden until you reveal episode 8" (league) |
| `use-rulebook-draft.ts` | Zustand store: the draft blocks, `dirty: [{ block, what }]` (plain-language: "edited Tribal Council", "added “Cried at Tribal”"), `open sheet` state, undo of the last change. Survives navigation between block pages; cleared on Save or explicit discard |

### 7.2 Admin: Shows (`shows-pages.tsx` rewritten)

- Header "Shows", sub "N shows · N leagues". **Segmented: Shows · Rulebooks** (Rulebooks = 7.9).
- Rows: show name; detail "{Kind} · {status line}" ("Competition · Season 51 airing · 3 results to
  review"); chyron-line dot when a season needs you. Archived and empty shows fold under "Archived and
  empty (N)".
- Sticky bar: "Any kind of show: a competition, a series, talk and variety, or a live event." + chyron
  **New show** → 7.10.

### 7.3 Admin: a show

- Header: show name; sub "N seasons · new seasons start from the latest season's rulebook"; ⋯ → sheet:
  Settings · Archive show ("Hide it from the show picker. Its leagues keep working.") · Delete show (red).
- **Seasons** section, aside **Add a season**: rows with the season number (28px condensed muted lead),
  "Season 51" (+ needs-you dot), detail two lines: status line ("Airing · ep 7 of 14 · 3 results to
  review") and "Rulebook: From Season 50 · 2 updates". Long histories fold: "47 older seasons".
- Row: **Show settings** (icon) "Names, art, the wiki connector, and what new seasons start from".
- **Add a season** sheet: Season (number, 110px) + Status (Upcoming/Airing/Completed) side by side;
  Wiki page (url, hint "Paste it from your browser. The connector reads the cast and results from it.");
  **Rulebook starts from** (select: Season N's rulebook (default) · A template from the library · Build
  from scratch; hint "A copy. Editing it never changes Season N."). Footer: Cancel · **Add season N**.
  Toast: "Added Season 52, its rulebook copied from Season 51. Next: pull its cast."
- **Show settings** page: Names (People are called / Groups are called — these now edit the season
  rulebooks' `cast.singular/plural`? **No**: show-level terms stay the default for new rulebooks; each
  rulebook owns its own), Kind of show (chips, with "Changes which blocks new seasons' rulebooks have"),
  **New seasons start from** (Latest season's rulebook · A rulebook from the library (picker) · Build
  from scratch), Art (unchanged), Connector (unchanged: wiki API, cast heading, research sites), Danger
  zone. The old **Rules** dropdown is removed when the flag is on.

### 7.4 Admin: a season (`season-frame.tsx`)

- Tabs **Episodes · Cast ✓ · Rulebook · Setup**; route `/admin/seasons/[id]/rulebook` (old `/rules`
  redirects). Header sub: "Airing · ep 7 of 14 · 212 leagues".
- **Rulebook tab**, top to bottom: toast slot; `lineage`; **How the season works**; **Points** (aside
  "N moments · suggested points"; lede "Segments, ways out and twists make these. Each game scores them
  its own way. Leagues set their own points." — talk: "Everything that can happen on the show. Each game
  uses them its own way: a bingo square, a live call, a pick."); **Timeline** (aside toggle
  "Show episode results" / "Hide results"); **Check for changes** button (→ 7.8). A push in progress
  shows a quiet plate: "Updating leagues: 140 of 221" with failures listed after ("Couldn't update 2
  leagues — Retry").
- A phase start awaiting confirmation shows a chyron plate above How the season works: tag "Confirm",
  "Did the merge start in episode 8?", buttons **Yes, episode 8** / **Pick another** (also a To do item).
- Sticky bar: "Edits reach the 212 leagues that follow it." + chyron **Edit rulebook**.
- A season with no rulebook (new self-serve show, or before backfill): an empty state "This season has
  no rulebook yet" with **Copy Season 50's** / **Start from a template** / **Research it**.

### 7.5 The editor (admin season rulebook, library rulebook, or a league's own copy)

Route `/admin/rulebooks/[id]/edit` (`/edit/[block]` for block pages); league:
`/setup/rules/edit` and `/setup/rules/edit/[block]`.

- **Index:** title "Edit rulebook", sub the rulebook name (league: "Tuesday Tribal's own copy"), back to
  the season/rulebook page. Lede: You-fill kind chip + "The first five blocks describe the show.
  {Points} is built from them." Rows (60px, icon square, name, one-line summary, chyron-line dot when
  that block has unsaved edits):
  - users · Who's playing — "18 castaways, in tribes. Tribes change at set points."
  - calendar-range · The season — "3 phases · a jury votes at the end"
  - clapperboard · Each episode — "5 segments: Reward challenge, Immunity challenge, …"
  - door-open · Ways out — "5 ways out · 2 ways to finish"
  - sparkles · Twists — "Idols & advantages · Journeys and Exile" / "None yet"
  - calculator · Points — "36 moments, 1 added by hand"
  (Block names per kind from `KINDS`; hidden blocks omitted.)
- **Advanced** (disclosure, remembers open/closed): **Results come from** (select with human labels:
  "The Survivor wiki connector, then research" · "Research only" · "The league answers"; hint repeats
  the choice in a sentence); rows **As data** ("This rulebook as the JSON research sends back and the
  engine reads" → sheet with the JSON in a scrollable mono block), **The research prompt** ("What a chat
  is asked, built from the same questions as this editor" → sheet with the full prompt + chyron **Copy
  the prompt**), **What didn't fit** ("Nothing. Research lists anything it couldn't describe here." or
  the `leftOut` sentences + compiler warnings like the reader warning in decision 6), **Rules as the
  engine reads them** (read-only compiled rules via `describeRule`, for developers).
- Sticky bar: "No unsaved edits." / "3 unsaved edits" (desktop adds ": edited Tribal Council, added …
  and N more") + chyron **Save** (disabled with nothing to save) → 7.7.
- Leaving with unsaved edits: confirm sheet "Leave without saving? Your 3 edits are kept until you
  close the app." (draft store persists for the session).

### 7.6 Block pages and their sheets

Each block page: title (block name), sub, a lede that says what the block is, its rows, its **Add**
button, and a sticky bar with a one-line count + **Done** (back to the index). Every Add opens the same
sheet used to edit.

**Who's playing** (a page of questions, no sheet): live summary plate on top (`whoLine`, updates as
you answer); *Who's in the cast?* (People · Pairs · A panel, help under the chosen one); *One of them is
called* / *More than one* side by side (hint "Used everywhere in the app, and to find the cast on a
wiki."); *How many, usually?* (number, 120px, hint "A check on cast lists. Each season sets its own.");
*Are they split into groups?* (No · Yes, into sides · Yes, into couples · Yes, into coaches' teams); when
grouped: *One group is called* (240px) and *Do the groups change?* (Never · At set points · All the
time; help "A swap, the merge. You set when, under How the season runs.").

**The season:** lede "A phase is a stretch of the season that plays differently, like the merge." (+
"This show runs the same way all season, so it has one." when there's one); rows per phase (name;
"From episode 8 · groups end, a jury starts"); a **Finale** row (crown icon; "A jury votes · 3 reach
it"); **Add a phase**.
- *Phase sheet:* What's it called? (placeholder "Merged, Casa Amor, Live shows"); When does it start?
  (At an episode · When this many are left · When the show says so — help "Research flags the episode
  it happens and you confirm it. It's never guessed."); then **Episode** or **People left** (number)
  unless announced; What changes? (multi, checkmark on chosen: Groups end · Groups are reshuffled · A
  jury starts · Viewers start voting · New people arrive · Different segments run — help on the last:
  "Set which, on each segment's How often."); In a sentence (hint "Shown to players under How the season
  works."). Remove (not on the only phase). Title updates as you type; detail = start text.
- *Finale sheet:* How is it decided? (nine answers); How many reach it? (hidden for Nobody wins / A
  group wins); In a sentence.

**Each episode:** lede "The regular parts of an episode. Each one's answers decide what scores, so
there's nothing to write by hand." Rows are caption plates (tag + name + `segmentLine` + chevron);
**Add a segment** → *Add a segment* sheet ("Who decides it?" six cards) → the segment sheet.
- *Segment sheet:* What's it called? (hint "The show's own name for it."); Who decides it?
  (`DecidedLine` with Change → six cards); Who votes? (vote) / Who picks? (pick); Who takes part? (not
  nobody); What does it decide? (result/judges/headToHead); What's on the line? (not nobody; help on
  "Sends someone home": "Who goes is a way out; set it under Ways out."); How often? + Which phase?;
  **What it scores**: the built moments as 48px rows with points and an on/off (row = switch; off rows
  struck through), hint "Built from the answers above. Switch off anything this show doesn't do.";
  hand-added moments under it with an "added" tag; **Add a moment to it**; nobody segments show
  "Nothing's decided, so nothing scores on its own. Add what can happen in it below." Remove last.

**Ways out** (series: **Comings and goings**): lede "Each one scores on its own when someone leaves or
finishes that way." Rows: name, "{meaning} · {cause}", points (24px condensed); **Add a way out** /
**Add a coming or going**.
- *Way sheet:* What's it called? (placeholder "Voted out, Fired, Tapped out"); What does it mean?
  (They're out · They reached the end · They won · An ending, help on ending); What causes it? (each
  segment that decides something, then Their own choice · Medical · Removed by the show · The story);
  Suggested points (stepper ±0.5, hint "Scored once, when it happens.").

**Twists:** lede "Anything that bends the usual episode. Each twist makes its own moments." Rows: name +
type chip + summary. **Add a twist** → *Add a twist* (four cards with examples) → twist sheet:
- common: What's it called? (placeholder per type), In a sentence; then per type (questions in 3);
  advantage's What does it do? carries the hint "This only decides what's worth scoring. Nothing is
  simulated: research reports what actually happened."; comeback "People who left" carries "Scores the
  comeback; putting them back into rosters comes later." (decision 8); **What it scores** (built list,
  live). Remove last.

**Points:** lede "Most of these are built from the other blocks. If research missed something, add it
here: it's filed in the right block, so research knows when to ask about it." **Add a moment** (above
the list, so it's reachable) → *Add a moment* router ("Where does it belong?": Something that happens ·
A way to leave or finish · A twist · A whole new segment, each with one example line); the full
points list; tapping a row opens the *moment sheet*.
- *Moment sheet (built or added):* the source line ("Built from Tribal Council." / "Scored on its own,
  from how they left." / "Research asks: “This episode, who got in a fight?”"); Suggested points
  stepper; for a research-rated built moment, its reliability ("Patchy reporting" in gold) and **Let the
  league answer it** toggle (writes `momentNotes`); an added moment has **Edit this moment**.
- *Custom moment sheet:* What happens? (placeholder "Got in a fight, Cried on camera", hint "Write it
  the way a recap would."); Where does it happen? (Anywhere · each segment · each twist); How is it
  counted? (Once an episode · Each time it happens · Per amount); Who answers it? (Research · The
  league); How reliably do recaps report it? (research only); the live preview plate "Research asks:
  “…”" / "The league is asked: “…”" (updates as you type, never re-renders the sheet); Suggested points
  (label adapts: "…, each time" / "…, per amount"). Remove last.

### 7.7 Save (admin) — "What kind of edit?"

Sheet: two radio cards — **The show changed** ("A new twist or rule from an episode on. Earlier episodes
keep their scores.") and **Fix a mistake** ("The rulebook was wrong. Scores are recalculated from the
episode you choose."); **From episode** stepper (default: next episode for a change, 1 for a fix);
for a fix, **Who gets it?** (Every league · Only leagues following it); an impact box ("**212 leagues**
following it get this from episode 9, at the suggested points. The **9** with their own copy are offered
it." / "Reaches **221 leagues**, including the 9 with their own copy. Their scores are recalculated; each
league sees the fix once it has revealed that episode."). Footer Cancel · **Save the change** / **Save
the fix**. After: back to the season's Rulebook tab, toast "Saved. 212 leagues following it get this
from episode 9; 9 own copies are offered it." and the push progress plate. A draft-only rulebook
(library, not yet in force) skips this sheet: Save just saves.

League own copy: "Save your edits" — "Only this league plays by your copy. From episode 7; episodes
already revealed keep their scores." Footer Cancel · **Save**.

### 7.8 Research: paste-and-review (phase 6) — the screen the mockup lacks

Route `/admin/rulebooks/[id]/review` (new rulebook from research, and the self-serve flow reuses it);
"Check for changes" uses the same screen for an edit.
- **Steps** (`Step` component, chyron on the current step): 1 **Copy the question** (CopyButton,
  chyron until something's pasted; "Paste it into any AI chat with web search."), 2 **Paste the
  answer** (textarea, 16px), **Review it**.
- **Verdict panel** (night panel, like today's format review): one bold line ("Ready to use. Nothing
  needs fixing." / "3 things to fix before it can be used."), counts ("6 segments · 7 ways out · 2
  twists · 38 moments"), then one row per problem (red alert icon, where it is — "Tribal Council · Who
  votes" — and the message), each opening the sheet for that item with the bad answer highlighted.
- **What didn't fit** (if `leftOut`): each sentence with **Add as a moment** (opens the custom moment
  sheet prefilled) or **Dismiss**.
- **Patchy reporting** list: built moments research rated patchy, each with a "Let the league answer
  it" toggle.
- Below: the full **How the season works** read view of what was pasted, so the admin reads the result
  as players will.
- For a check: the ops as plain rows ("+ New advantage: Block a Vote", "~ Reward challenge: now only
  before the merge", "− Sent to Exile"), the **From episode** field, and "Nothing changed" recorded as
  `no_change` ("Checked through episode 7. Nothing new.").
- Sticky bar: **Save draft** · chyron **Use it** (new rulebook) / **Review the edit** (check → 7.7).

### 7.9 Admin: Rulebooks library (`/admin/rulebooks`, the Shows segmented control's second tab)

- **Start from** section (aside "9 templates, 8 proposed"; lede "A template is a finished rulebook
  with the show's names left blank. New ones come from rulebooks that work: any approved rulebook can
  be saved as one."): grouped by kind (icon + kind name), cards (name in condensed caps, examples
  "+N more", decided-by tag chips); proposed ones dashed with a "Proposed" chip and a toast "It earns a
  template once two real shows share its shape."
- **Drafts:** researched drafts ("Researched 12 Oct · 3 things to check before it can be used"),
  scratch drafts, and **commissioner-made rulebooks** ("First made for a league, now Season 17's
  rulebook · take it over to edit it here" → **Take it over** sets `approved_by` and review_status).
- **In use:** every season rulebook with "From {parent} · N leagues follow it · N own copies".
- Sticky: chyron **New show**.
- A library rulebook page (`/admin/rulebooks/[id]`): lineage, How the season works, Points, "Used by"
  list, ⋯ (Edit · Save as template · Delete when unused).

### 7.10 New show — full-screen flow (DESIGN.md "Full-screen flow"), `/admin/shows/new`

No tab bar/sidebar; header ✕ (step 1) or back, "New show", "N of 3"; 4px segments (chyron to the
current step); sticky full-width 52px chyron button.
1. **What kind of show is it?** Four option cards (icon square, name in 20px condensed caps, blurb,
   italic "Like …"): A competition (trophy) · A series (tv) · Talk, variety or awards (message) · A live
   sport or event (zap). Chosen = white plate, 3px chyron outline, tick. **Next**.
2. **How do you want to start?** Research it ("Copy a prompt into any AI chat with web search and paste
   the answer back. It answers the same questions you'd answer by hand.") · Start from {each built
   template of that kind} ("Plays like …") · Build from scratch ("A handful of questions per block.
   Points fill themselves in."). **Next**.
3. **Name it:** Show (placeholder per kind); One person/regular is called + One group is called (side
   by side); an info box "**Fits these games:** Active Roster, Classic, … (From the template; it updates
   as you edit.) **Results come from:** …". **Create show** → the show with its first season and
   rulebook (research → the review screen 7.8; template → the season's Rulebook tab, toast "Created.
   Its rulebook is a copy of the template. Review it, then add a season."; scratch → the editor).

The self-serve research flow (`research-show-flow.tsx`) gets the same three steps for signed-in users;
its result is a show whose first season's rulebook is theirs (first-creator-is-parent).

### 7.11 Commissioner: Rulebook (`/setup/rules`, renamed in League Settings to "Rulebook")

- Header "Rulebook", back "League Settings", ⋯. Lineage (league variant). **How the season works**
  (same component). **Points** (or Moments) aside "Only starters score" (per league type); lede "Your
  league's points. Tap one to change it."; rows tappable → moment sheet with **Points in this league**
  stepper and "Suggested: +3" when changed. **Updates** aside "Revealed through ep 6": the timeline,
  league-gated.
- A segment row tapped (not own copy) → read sheet: `segmentLine`, "What it scores in this league",
  hint "Want it to work differently here? Make the rulebook yours from the page's ⋯."
- ⋯ sheet: **Make it ours** ("An editable copy for this league only") or, when owned, Edit your copy ·
  Go back to following Survivor 51 (red); Use suggested points.
- **Make it ours** sheet: "This league gets its own copy of Survivor 51's rulebook to edit. Nothing
  changes for any other league, or for the season's rulebook." Info box: "**Still reaches you:** fixes
  from the admin, when the rulebook was wrong. **Offered first:** changes when the show itself changes.
  You choose whether to take them." Footer Cancel · **Make it ours**.
- Owned: sticky "Your copy. Only this league plays by it." + chyron **Edit rulebook** (→ 7.5–7.6, same
  editor, league save 7.7).
- **Offers:** a "show changed" edit not yet decided shows as a caption plate at the top (tag "Update",
  "Survivor 51's rulebook changed from episode 8", **See it** → sheet listing the ops in plain rows, the
  suggested points for new moments (editable steppers), **Take it** / **Not now**). Also a chyron dot on
  League Settings' Rulebook row (commissioner to-do).
- **A fix that reached an own copy and overrode the league's edit:** a quiet plate "The admin fixed
  Tribal Council. It replaced your change from episode 4." with **See what changed**.

### 7.12 The new-league flow and league type

When picking a show/season, the league-type step marks types that don't fit (`rulebook-fits.js`):
dimmed card, "Doesn't fit {show}: needs people leaving one by one, and a winner." Only fitting types are
selectable. (Bingo/Live react/etc. appear when the game-type library exists.)

### 7.13 Admin To do additions (`admin-home.tsx`)

New "Needs you" rows: **Confirm a phase start** ("Survivor 51: did the merge start in episode 8?"),
**Rules check suggested** (research flagged something new — today's flag, now pointing at Check for
changes), **Draft edit to review**, **League updates failed** (a push with failures, Retry),
**Commissioner rulebook to look at** (a self-serve rulebook a season now follows).

---

## 8. Phases, in order, with what "done" means

**Phase 1 — schema, built-in blocks, read-only view (no DB, no engine change).**
`rulebook-schema.js`, `rulebook-moments.js`, `rulebook-describe.js`, `blocks/{survivor,traitors,
challenge}.blocks.js`; `src/components/rulebook/{how-the-season-works,points-list,lineage}.tsx`; the
season page's Rules tab becomes **Rulebook** showing How the season works (built-ins from their blocks;
stored formats via `blocksFromFormat`), the existing points, and today's rule-check status as the
timeline; the commissioner's Scoring & rules shows How the season works on top. Shows · Rulebooks
segmented control (Rulebooks = today's Formats page for now), status lines, jargon pass.
*Done when:* every built-in and stored format renders How the season works at 360/390/desktop in both
themes; no scoring code touched; `npm test` green.

**Phase 2 — compiler + engine relaxations.** `rulebook-compile.js`, `formatForRulebook`, the 4.6
changes, alias maps. *Done when:* the compiled built-ins score the harness fixtures identically to the
frozen data (T-10…T-14); every option combination compiles without `formatProblems` (T-20); the
harness diff for unchanged formats is empty.

**Phase 3 — database and resolution (flag off by default).** Migration 0060, backfill script,
`db/rulebooks.js`, `syncLeagueRulebook`, `pushRulebook`, `seasonFormat` switch, `formatOf` reads
`settings.rulebook`. *Done when:* backfill on a copy of prod data creates a rulebook per season with
`compiled` deep-equal to the season's current format; with the flag on, every `zt-` fixture league
scores exactly as with it off (T-30); flipping the flag back restores the old path.

**Phase 4 — the admin editor.** Everything in 7.5–7.6 and 7.7's "draft-only" save; saving a season
rulebook creates an edit (kind chosen in 7.7 lands in phase 5; until then only library drafts and
season rulebooks with no leagues are editable). *Done when:* every sheet in the mockup exists with its
copy and passes the 7.0 rules (T-60…T-66).

**Phase 5 — edits, reach, fan-out, rescore.** `rulebook-patch.js`, `rulebook_edits`, 7.7, the push
plate, the timeline from edits, offers for own copies. *Done when:* a show-changed edit from episode 8
reaches following leagues without changing episodes 1–7 (T-32); a fix from episode 1 rescored 2,000
`zt-` leagues with progress and resumability (T-40); a failed league can be retried.

**Phase 6 — research.** `rulebook-research.js`, prompt route, 7.8 (new rulebook + check for changes),
`phaseStarted` flag + To do. *Done when:* fake answers round-trip (T-50…T-53).

**Phase 7 — commissioner.** 7.11 on the new model; migrate `league_rulesets` users. *Done when:* make
it ours → edit → save → only that league changes; a fix still reaches it; going back restores
following (T-34).

**Phase 8 — library, kinds, new-show flow, fits, first-creator-is-parent.** 7.9, 7.10, 7.12, 7.13,
self-serve flow, Below Deck/late-night style rulebooks compile (no winner, no ways out). *Done when:* a
series and a talk rulebook can be created end to end and a league made on each with a fitting type.

**Phase 9 — clean-up.** Remove old screens/routes/tables after one release with the flag on by
default; drop `shows.format` reads; a final migration archives `show_formats`, `league_rulesets`,
`season_rule_changes` into a backup table.

---

## 9. Risks and how this plan handles them

| Risk | Handling |
|---|---|
| Renamed event ids/keys break recorded scores | Legacy freeze (decision 2) + alias maps + T-11 |
| A league reads rules without data and silently becomes Survivor | Cached data stays in state (decision 3); `formatOf` logs and the state route flags a league whose `settings.rulebook.version` is behind; T-31 |
| Fan-out to thousands of leagues times out | Chunked, resumable `rulebook_pushes`; T-40 |
| A built-in wiki read can't see a new way out | Compiler warning shown in "What didn't fit"; research still covers it (decision 6) |
| Phase-limited rules mis-fire before a phase start is known | Gated off until confirmed (decision 5); To do item |
| Spoilers via the timeline or offers | Server-side gating in the league rulebook route + client gating; T-35 |
| Admin edits a rulebook while a push runs | Push stamps `version`; a newer push supersedes; leagues end on the latest version |
| The editor loses work on a phone | Draft store per session; leave-without-saving confirm; T-62 |

---

## 10. Testing ideas (loose, for later; numbered so phases can cite them)

Unit (`node --test`), in `tests/`:
- **T-10** `compileRulebook(survivorBlocks)` produces events whose ids (after aliases) equal
  `survivor.js`'s ids exactly; same for Traitors, Challenge.
- **T-11** Golden scoring: for the harness fixtures, frozen vs compiled award the same events and
  points per castaway per episode (Active Roster and Classic).
- **T-12** Each template row in 4.2 has a test: answers in → moment ids, labels, default points out.
- **T-13** `momentsOff` removes exactly that moment; `points` overrides change defaultPoints only.
- **T-14** Alias collision: two new ids aliasing one legacy id is a compile problem.
- **T-20** Exhaustive-ish: every combination of a segment's answers (decidedBy × voters/pickers ×
  takesPart × decides × onTheLine × often) compiles and passes `formatProblems`.
- **T-21** Kinds: a series with only an "ending" way, a talk show with no ways out, an event with no
  winner all compile; `winnerExitMethod` null; state-logic season-over doesn't throw (T-21b: run
  `EpisodeLogic` through 10 episodes on each).
- **T-22** `blocksProblems` locates each bad value at the right `at` path; messages are plain English
  (snapshot the strings).
- **T-23** Patch: add/update/remove per block; `applyEdits` ordering; `untilEpisode` closes replaced
  items; editing an id another item refers to is a located problem.
- **T-24** Phase gating: a onePhase segment's rules don't run before its phase start, do after,
  don't run at all while unknown.
- **T-25** `per` research rules: "each time" awards N times; non-integer answers award nothing.
- **T-26** Generic `roleFor`: a data-only rulebook with a secret role awards role-aware vote moments
  like Traitors' hand-written ones on the same fixture.

Harness:
- **T-15** Run `tests/harness/format-regression.js` before phase 2 and after; diff must be empty for
  every format not migrated to blocks.
- **T-16** Extend the harness with a "rulebook" section: the ten mockup sample rulebooks (Survivor,
  Traitors, Bake Off, DWTS, Amazing Race, Love Island, Below Deck, Harry Potter, late night, X Games)
  as fixtures; print compiled data and a scored fixture episode for each.

Database / server (`scripts/dev-test/`, all rows keyed `zt-`, with `up`/`down`):
- **T-30** `rulebook-fixture.js up --leagues 20 --type activeRoster`: zt- show, season, leagues; flag
  on vs off produce identical standings.
- **T-31** A league with `settings.rulebook` removed: the state route reports it stale; push repairs it.
- **T-32** Show-changed edit from ep 8 on a league that has revealed ep 9: ep 1–7 unchanged, ep 8–9
  rescored only for the new moment.
- **T-33** Fix from ep 1 with reach "following" doesn't touch own copies; "everyone" does, and the
  override notice appears.
- **T-34** Make it ours → edit → save; the season rulebook and other leagues unchanged; go back.
- **T-35** Spoilers: a league revealed through ep 6 can't fetch ep-8 edit details from the API.
- **T-36** Backfill dry-run on a prod snapshot: counts, and `compiled` deep-equal per season.
- **T-40** Scale: `rulebook-fixture.js up --leagues 2000`; time a push; kill it mid-way; resume; all
  leagues end on the latest version; failures recorded.

Research:
- **T-50** `buildRulebookPrompt` contains every `OPT` value and help (snapshot); the template skeleton
  for the chosen kind.
- **T-51** Fake answers: valid; one bad enum; missing ids; chatter around JSON; a `leftOut` item —
  `reviewRulebook` keeps every row and locates every problem.
- **T-52** Check-for-changes fake answer (the 4.4 example) → a draft edit with three ops; "nothing
  changed" → no_change with checked_through.
- **T-53** Real-model smoke (manual, paid, occasional): run the prompt for Survivor, Love Island,
  Below Deck in a web chat; paste; count problems; keep the answers as fixtures.

Browser (`scripts/dev-test/browser.js`; at 360, 390 and 1440; both themes):
- **T-60** Scroll kept: open the segment sheet, scroll to the bottom, tap an answer — sheet scrollTop
  within 60px of before; same for a page (the mockup's `probe.js` logic).
- **T-61** Typing: type in a sheet's name, tap a chip without blurring first — the chip registers and
  the text is kept.
- **T-62** Leave the editor with unsaved edits → confirm; come back → draft restored.
- **T-63** Tap targets: every `.choice`/option ≥44px tall; moment rows ≥48px.
- **T-64** No horizontal overflow at 360 on every rulebook screen (the mockup's overflow check).
- **T-65** Header at 360 with the longest show name: back label ellipsized, title intact.
- **T-66** One chyron fill per screen (count elements with the chyron background).
- **T-67** Every sheet in 7.6 reachable from its Add button and from editing a row; every Remove works.
- **T-68** Keyboard on a real phone (manual): sheets with inputs stay usable with the keyboard open
  (iOS especially); swipe-down dismiss; landscape.

UX checks (manual, with the user):
- **T-70** Someone who's never seen the app adds Love Island from scratch using only the editor; note
  every hesitation.
- **T-71** A commissioner reads How the season works for Traitors and explains the game back.
- **T-72** Compare research quality with and without the template skeleton for two new shows.

---

## 11. Open questions (carry into the build; none block phase 1–3)

From the design plan, still open: rescore notifications in a league (alert strip vs recap line) and
their spoiler interaction; own copy vs fix wording; per-episode-only shows (Forged in Fire) and the
league picker; library browsing for commissioners; who answers league-level moments by default
(commissioner + player flag recommended); whether awards nights need their own kind.

New here:
- Show-level terms vs rulebook terms: this plan makes the rulebook own `cast.singular/plural`, with
  the show's terms only the default for new rulebooks. Confirm.
- `/admin/rulebooks` as its own route (with the Shows segmented control linking to it) vs a query
  param on `/admin/shows`. This plan uses its own route for deep links from To do.
- Whether "Fix a mistake" from episode N > 1 should also fold into the base (simpler timeline) — this
  plan keeps it as an edit so the timeline shows it.
