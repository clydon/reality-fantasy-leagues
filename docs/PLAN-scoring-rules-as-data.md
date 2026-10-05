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
{ "whenExit": "Sole Survivor", "award": "finalist", "awardPer": "juryVotes", "perAward": "juryVote" }

// Staging something other than an event (Survivor exile, Traitors roles).
{ "when": { "answer": "exiled", "is": "yes" }, "stage": "exiled" }

// Logic too intricate for boxes: a named function from a fixed, code-side library.
{ "builtIn": "votedWithMajority" }
```

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
