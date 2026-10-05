# Plan: scoring rules as data, editable as a list or a flowchart

Builds on stage 2 of `docs/PLAN-rollout-order.md`, which split every format into a plain-JSON data
half and a code half (`src/lib/game/formats/define.js`; details under phase 2 in
`docs/PLAN-ai-generated-show-formats.md`). This plan moves most of the remaining code half — the
**scoring logic** — into data too, so that:

- AI-proposed formats (stage 3) can carry their own scoring without a developer, and
- admins and commissioners can see and change how a show scores, as a rule list or a flowchart.

The flowchart editor is the visible feature. The rules-as-data model underneath it is the real work,
and it comes first.

## What the scoring logic is today

Two pieces of code per format decide what scores. Both are functions, so neither can be edited,
stored or proposed:

| Piece | What it does | Example |
|---|---|---|
| `research.items(entry, add, ctx)` | turns one person's checklist answers into staged results (events, roles, exile) | `wonIndividualImmunity === "yes"` → `individualImmunity` |
| `impliedEvents(ep, ctx)` | derives events from facts the league already holds (exits, roles, exile) on every read | exit `Voted Out` → `votedOut`; a finalist gets one `juryVote` per jury vote |

`wiki.derivedEvents` (Round Table / Elimination-chart outcomes) is the same idea for the wiki read.
Point values are already data (`events[].defaultPoints`, overridden per league in
`settings.eventPoints`). That part of scoring is already editable and doesn't change here.

## Who owns what (decided 2026-10-05)

- **Masters belong to admins.** Each show format's rules are a master ruleset that only admins edit.
  The built-in formats are seeded as masters from today's code.
- **Commissioners create; they never modify a master.** A commissioner can make their own ruleset,
  starting from a copy of the master or from scratch, and use it in their league. The master has no
  league-level write path at all. Enforce that in the API, not just by hiding buttons.
- **A league uses either the master as-is, or its own copy.**
  - On the master: picks up admin fixes automatically.
  - On a copy: keeps it until the commissioner chooses to pull in the newer master.
- **Masters are versioned.** A copy records the master version it came from, so the UI can say
  "based on Survivor rules v3; v4 is out" and offer to merge.
- **One gate for everyone.** A commissioner's ruleset passes the same `formatProblems` checks as an
  admin's. A bad edit only ever affects the league using that copy.
- **Mid-season edits stay open for now (decided 2026-10-05).** A commissioner can edit their league's
  copy at any point in the season; every change is logged and shown to players. The app is early, so
  flexibility wins. A lock may come later: keep it a single nullable field (`locked_at` on the
  ruleset) checked in one place in the save route, so turning it on later is a small change, not a
  redesign.
- **Sharing with other leagues: backend now, UI later (decided 2026-10-05).** Sharing rulesets builds
  a community feel, so the storage and API support it from the start, with no UI yet:
  - A ruleset has a `visibility` (`private` by default, or `shared`).
  - Another league can use a shared ruleset by copying it. The copy's `parent_id` points at it, the
    same way a copy of a master does, so attribution ("based on Dana's Survivor rules") and "a newer
    version is out" come for free.
  - The owner can keep editing a shared ruleset. Leagues using a copy don't change until they choose
    to pull in the newer version. Nobody but the owner can modify it.
  - A `review_status` (`unreviewed` / `approved`) is stored but not yet enforced. It's the hook for
    the catalog-trust question in `docs/PLAN-ai-generated-show-formats.md` once a public browse list
    exists.

## The rule model

A rule is "when this is true, award this". It's small on purpose: a rules language that grows
variables and loops becomes a programming language with a worse editor.

```jsonc
// The simple case: most of Challenge and Generic, and much of Survivor.
{ "when": { "answer": "wonIndividualImmunity", "is": "yes" }, "award": "individualImmunity" }

// Conditions combine with all / any / not.
{ "when": { "all": [{ "answer": "wasNominated", "is": "yes" }, { "not": { "answer": "leftTheGame", "is": "yes" } }] },
  "award": "nominatedSurvived" }

// Numbers compare.
{ "when": { "answer": "individualChallengeFinish", "equals": 2 }, "award": "challengeRunnerUp" }

// From a fact the league holds (impliedEvents), not from research answers.
{ "whenExit": "Voted Out", "award": "votedOut" }
{ "whenExit": ["Lost Final Tribal (Jury Vote)", "Sole Survivor"], "award": "juryVote", "per": "juryVotes" }
{ "whenExit": "Winner", "when": { "fact": "role", "is": "Traitor" }, "award": "wonAsTraitor" }
{ "whenRole": "Recruited Traitor", "award": "recruited" }

// Staging something other than an event (Survivor exile, Traitors roles).
{ "when": { "answer": "exiled", "is": "yes" }, "stage": "exiled" }

// Logic too intricate for boxes: a named function from a fixed, code-side library, with its own params.
{ "when": { "answer": "leftTheGame", "isNot": "yes" }, "builtIn": "votedForLeaver", "vote": "votedFor",
  "exitMethod": "Voted Out", "award": "votedWithMajority", "otherwise": "votedAgainstMajority" }
```

(These are the shapes phase 1 built. `src/lib/game/formats/rules.js`'s header is the full reference.)

- **Conditions:** `answer` with `is` / `isNot` / `equals` / `greaterThan` / `present`, combined with
  `all` / `any` / `not`. Each one references a checklist field, so `formatProblems` can check it
  exists and has the right type, the same way it already checks `claims`.
- **Built-in rules:** the hard cases stay as named, read-only functions in a code library. These are
  the rules that look at other people's answers (voted with the majority) or at roles on both sides
  of an event (the Traitors vote and case-lead events). The editor shows each as one fixed node,
  with a plain-language description, that can be switched on or off but not opened up. This keeps
  the model honest instead of bending everything into boxes.
- **Order and duplicates:** keep today's rules: results are staged in rule order and deduplicated by
  (person, kind, event).

## Storage and how leagues read it

- **A new `rulesets` table:**
  - `id`, `format`, `name`, `data` (jsonb), `version`, `created_by`, `created_at`, `updated_at`.
  - `kind`: `master` (admin-owned) or `league` (commissioner-owned). `league_id` is set only for a
    league ruleset.
  - `parent_id` and `parent_version`: what it was copied from. This works whether the parent is a
    master or another league's shared ruleset.
  - `visibility` (`private` / `shared`), `review_status` (`unreviewed` / `approved`), `locked_at`
    (nullable, unused for now).
  - Masters are seeded from the code formats' `data`.
- **API rules, enforced server-side:**
  - Only admins write masters.
  - Only a league's commissioners write that league's ruleset.
  - Anyone in a league can read the ruleset it uses.
  - Any commissioner can read a `shared` ruleset and copy it into their own league.
  - Copying never moves or changes the source.
- **League state caches its resolved ruleset** under `settings`, the same pattern `showFormat`
  already uses (set when a show is picked, pushed to every league on the show when an admin changes
  its format). That way the client-side `StateLogic` still scores without a database call.
  - When an admin saves a master, push it to every league following that master.
  - Leagues on a copy are left alone.
- **Rescoring:** scoring is recomputed from stored facts on every read, so changing a rule rescores
  past episodes for that league. That's the right behaviour, but it should be visible: log the change
  in the league, and tell players something like "Scoring rules changed by the commissioner".

## Phases

1. **Rule model, proven against the shipped formats.** Same discipline as stage 2:
   - Prototype the evaluator in isolation.
   - Rewrite each format's `items` and `impliedEvents` as rules plus built-ins.
   - Prove it byte-identical with `tests/harness/format-regression.js`.
   - The harness answers "how much fits": count which rules became data and which needed a built-in,
     per format.
   - Opus-level work, like stage 2.

   **DONE (2026-10-05).** No database, API or UI change, and nothing for players.
   - **Shape.** A format's data half now carries `rules: { research: [...], implied: [...] }`.
     `src/lib/game/formats/rules.js` is the evaluator, the validation and the built-in library: plain
     CommonJS, no dependencies. `defineFormat` builds `research.items` and `impliedEvents` from the
     rules, still named `researchItems`/`impliedEvents`, so every caller is unchanged. Code can no
     longer supply either one, and `defineFormat` throws if it tries. A format with no implied rules
     gets no `impliedEvents`, which is the absence state-logic already checks for.
     `wiki.derivedEvents` stays code, as planned.
   - **The language as built**, beyond the sketch above:
     - **Research conditions** test checklist answers. `is`/`isNot` are exact matches, `equals` is a
       strict number match, `greaterThan` is only ever true for a number, and `present: true|false`
       means a non-empty text or list (blanks don't count).
     - **Implied triggers** are `whenExit` (a method or a list), `whenExiled: true` and `whenRole`.
     - **Exit facts.** An exit rule's `when` reads three facts: `juryVotes`, `role` (the leaver's
       role as of the episode) and `finale` (`yes` when the episode crowns a winner). `per: 'juryVotes'`
       awards once per vote, and only when the count is a known whole number.
     - **Stages** are `stage: 'exiled'` and `stage: 'role'`, with `role`.
     - **Built-in rules** take their own params. They can also carry a `when` gate, plus `whenExit` for
       an implied one.
   - **Order** is unchanged from the hand-written functions. Results come out in rule order and are
     not deduplicated in the evaluator (staging still dedupes by person, kind and event). Implied
     rules go fact by fact: each exit through every exit rule in order. Exits, exiles and roles are
     taken in the order their first rule appears, which is exile first for Survivor and roles last
     for Traitors.
   - **Validation.** `formatProblems` now runs `rulesProblems`, with a reason for each problem:
     - a checklist question, event, exit method, role or built-in that doesn't exist;
     - a test that doesn't fit the question's type (`greaterThan` on a yes/no) or a value it can't
       have (`is: 'maybe'`);
     - a research rule awarding an `implied` event, or an implied rule awarding one that isn't;
     - a built-in in the wrong list, or a built-in param missing or of the wrong type;
     - a misused `per`, `when`, `stage` or trigger;
     - unknown keys.
   - **The built-in library (4):**
     - `votedForLeaver` (Survivor's voted with / against the majority);
     - `voteByRole` and `caseLeadByRole` (Traitors' Round Table vote and case-lead outcomes, by what
       both sides were);
     - `roleWonEpisode` (Traitors' "fooled to the end": a Faithful finalist in a finale a Traitor won).

     None is show-specific. Each takes its fields, exit method, roles and events as params, and
     "has the role" / "doesn't" are themselves research conditions. Each has a `describe` text for the
     editor's fixed node.
   - **How much fits.** 65 of 69 rules (94%) are plain data. `tests/scoring-rules.test.js` pins these
     numbers.

     | Format | Research rules | Implied rules | Plain data | Built-ins used |
     |---|---|---|---|---|
     | Survivor | 18 (17 data + 1) | 9 (all data) | 26 of 27 | `votedForLeaver` |
     | The Traitors | 16 (14 data + 2) | 10 (9 data + 1) | 23 of 26 | `voteByRole`, `caseLeadByRole`, `roleWonEpisode` |
     | The Challenge | 4 (all data) | 6 (all data) | 10 of 10 | none |
     | Generic | 2 (all data) | 4 (all data) | 6 of 6 | none |

     Some things that looked like they'd need code are plain data:
     - Traitors' "a Faithful who survived the night" gate (`not` any Traitor answer, and stayed);
     - its finale/Traitor/Faithful split of banishments;
     - Survivor's whole endgame (finalist, a point per jury vote, the goat, the winner's bonus).

     The built-ins are exactly the cross-person cases the plan predicted.
   - **Verified** the same way as stage 2.
     - **Baselines first.** The harness was run twice and was identical; tsc, `eslint src` (the one
       existing `pickem-pick-grid.tsx` error) and `npm test` (139/139) were captured too.
     - **Harness gaps closed before the refactor.** V8 block coverage showed the harness never reached
       several branches: Survivor's `chosenForReward`, Traitors' murder-danger block, unknown-role
       votes, a Traitor winning (`fooledToTheEnd`, `wonAsTraitor`, `banishedAsTraitor`), and the
       fallback name match used when no `ctx` is passed. Its fixtures were extended and the baseline
       re-taken, at 100% block coverage of every `items`/`impliedEvents` and their helpers. Mutation
       testing later found five more gaps, and the baseline was re-taken from the original code again
       with fixtures for them:
       - a cancelled-votes count of exactly 1;
       - two results from one person, which pins their order;
       - a Traitor leading the case against a Faithful;
       - blank names in a list;
       - role answers that disagree.
     - **Prototype, in isolation.** Each format's rules ran through `rules.js` against the
       hand-written functions on about 212,000 cases: a deterministic pairwise sweep of every checklist
       field's values (including wrong types), plus random entries, payloads, every `ctx` shape and
       random episodes. There were 0 mismatches, and every catalog event, the exile stage and both role
       stages were produced.
     - **Mutation-tested the proof.** 392 single mutations: flipped tests, nudged numbers, `all`↔`any`,
       dropped `not`/`when`/`per`, wrong events, exit methods and roles, deleted rules, and every
       adjacent swap. 367 were caught. All 25 survivors are swaps of rules that can never both fire
       for one person or exit (`equals 0` vs `greaterThan 0`, different exit methods, the three
       mutually exclusive Banished rules), so their order doesn't matter.
     - **Migrated, then diffed.** The harness output (39,248 lines) is byte-identical in every
       behaviour section. Only the "function sources" hashes of the eight rebuilt functions differ
       (`research.items` and `impliedEvents` for each format), and they now share one source.
     - **Mutation-tested the harness against the migrated code.** 42 mutations to rule data, the
       built-ins and the evaluator's own source; all 42 change the output.
     - **The other gates.** tsc and `eslint src` match the baseline exactly. `npm test` went from
       139/139 to 148/148 with the new `tests/scoring-rules.test.js`. It covers each test and
       combinator, order and stages, every built-in, implied facts and order, 47 refused rules
       each with its reason, the pinned counts, and a hypothetical AI-proposed Love Island format
       (its own rules, plus `votedForLeaver` with its own params) run end to end through paste, parse,
       validation, staging and implied events. `tests/checklist-schema.test.js`'s Big Brother format
       moved its `items` to rules.
     - **The browser bundle.** The user's `next dev` serves the client chunk with `rules.js` and the
       rule data, and none of the old helpers. `next build` was not run, because the dev server was up.
   - **Two deliberate differences**, neither reachable by any caller: Survivor's old `items` threw on a
     `null` ctx and now treats it like no ctx, and a missing `ctx.roleOf` reads as an unknown role
     instead of throwing.
   - **Left for phase 2 and later:**
     - **Storage.** The rules live in each format's data. Phase 2's masters can be seeded straight from
       `formatFor(id).data.rules`.
     - **League copies.** For a league scoring by its own copy, state-logic needs to build
       `impliedEvents` from the league's cached rules instead of `formatFor`. `impliedEventsFrom(rules,
       data)` and `researchItemsFrom(rules)` are exported for exactly that.
     - **Rescoring is immediate.** Implied events are recomputed on every read, so a rule change
       rescores past episodes at once (as the plan intends). Research rules only apply when research is
       next staged.
     - **Still code:** research's `entryProblems`, `notes` and `sentences`. A proposed format (stage 3)
       still needs a default for its reviewer notes; generating them from the checklist descriptions
       would be the obvious one.
2. **Storage and API.** The `rulesets` table and migration, with masters seeded from code. Leagues
   reference and cache a ruleset, and an admin save pushes to the leagues following that master.
   Sharing is backend-only: `visibility`, copy-from-shared and `parent_id` lineage, each with tests.
   There's no UI yet beyond what exists.
3. **Stage 3 of the rollout** (research → propose → review) proposes rules in this shape. This is
   where the model first meets a show nobody hand-wrote.
4. **Rule-list editor**, desktop-first:
   - Admin: edit masters, with a version bump on save.
   - Commissioner: "Customise this league's rules" makes a copy, and "Update from master" merges a
     newer version.
   - Rows read as sentences ("When *won individual immunity* is *yes* → award *Individual immunity
     win*"). Most rules are one step, and a list is the fastest way to read and edit them.
5. **Flowchart view** over the same data, desktop-first. If it works on mobile, fine, but it isn't
   designed for it:
   - Built with `@xyflow/react` (React Flow): condition nodes, award nodes, and built-in nodes shown
     as locked blocks.
   - Load it only on the editor route (`next/dynamic`), so it adds nothing to the player-facing bundle.
   - The list and the flowchart edit the same JSON, so neither can drift from the other.

## Risks and open points

- **Expressiveness creep.** Every "just one more operator" request pushes this toward a programming
  language. The built-in library is the pressure valve: an unusual rule becomes a new named built-in,
  reviewed like code, not a new language feature.
- **Merging copies.** A three-way merge (old master → new master vs old master → the copy) is the
  hardest UI here. Phase 4 can start with "here's what changed in the master; apply these rules?"
  and leave a full merge for later.
- **Mid-season lock (later).** Edits stay open for now. Revisit once real leagues have used it; the
  `locked_at` field is the hook.
- **Sharing UI and trust (later).** The backend is built in phase 2. A browse list of shared rulesets
  needs a decision on whether `review_status` gates it, the same catalog-trust question as in
  `docs/PLAN-ai-generated-show-formats.md`.
- **The wiki read's `derivedEvents`** is left as code in phase 1. It could move to the same model
  later if it fits.
