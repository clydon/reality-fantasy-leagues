# Plan: the maker edits a made game's scoring, and episodes are looked up again for what's new

Status: **planned 2026-10-27, not started.** Decisions are the user's (2026-10-27); file references are from a code map made
the same day (check them before relying on a line number).

## Why

A show someone adds and makes a game (Make it a game, `src/lib/server/make-game.ts` confirmMake) now gets its results looked
up episode by episode (research-asks.ts, the roll call), so its Players tab has points and stats before anyone starts a
game. The person who made it should be able to shape that scoring: change what each moment is worth, and add moments,
like The Traitors' "votes received at the Round Table" scored per vote. Then the episodes already looked up should catch
up: only what's new, or everything again.

## Decisions (the user's, 2026-10-27)

- **Who:** whoever made the show a game (and site admins), **until a game is played on the season.** Once one is, the
  scoring is every game's: changes go through what exists already (the desk, a couch's Make it ours, Something off?
  suggestions), so nobody's game changes under them. The editor then reads as the rules, with that line.
- **Where:** a **Scoring page in the show** (phone-first), reached from How it works and the Players tab, not the desk's
  full editor (episode parts, phases, fix vs show changed stay the desk's).
- **Re-running:** after a new question, the maker chooses **just the new question(s)** (faster; nothing already counted
  changes) **or everything again** (the whole episode, merged field by field).

## Three kinds of edit, cheapest first

1. **A moment's points.** The stored answers are read again under the new points (`restageSeason`): the Players tab
   changes at once. No research.
2. **A new moment scored from an answer already asked.** The Traitors 5's researched rules already ask
   `roundTableVotesReceived` (integer) every episode (and `roundTableVotedFor`, the missions, shields, recruitment...);
   "−0.5 a vote received" is a new moment on that existing question. Read again from the stored answers: no research.
   **This needs a schema change** (step 2): today a custom moment always asks its own new question.
3. **A new moment with a new question.** Nothing stored answers it, so the episodes already looked up are asked again:
   just the new question(s), or everything.

## What's there today (the map)

- **Editors.** The desk's (`src/lib/server/desk-rulebooks.ts` saveRulebook 236: diff → `fix` via applyOps + saveChain, or
  `show_changed` as a rulebook_edits row; then pushRulebook and `restageSeason`; UI `src/new/desk/rulebook.tsx`:
  PointsSheet 882, a stepper per moment −20..20 by 0.5; CustomSheet 933 edits label, during, counted
  yesNo/eachTime/perUnit, answeredBy, reliability, **not `question`**). Admins only (`requireDesk`). Backstage › Scoring
  rules (`ours.ts`) is a couch's own copy, needs a game: nothing for a season nobody plays. How it works has no editing.
- **Rulebook model.** `rulebooks` (0107) + `rulebook_edits`; `db/rulebooks.js` saveChain 302 (validate, compileChain,
  version + 1), compileRow 213 keeps `compiled.id` (`made-<slug>`) stable. Blocks: `customMoments: [{ id, label,
  question?, during?, counted, answeredBy, reliability? }]`, `points: { id: n }` (rulebook-schema.js; every points key a
  real moment). `momentsFor` (rulebook-moments.js 187) gives each moment `ask: { key, type, question }`; a custom
  moment's key is its own id (customMoment 172). compileRulebook turns each ask into a checklist field and a rule
  (answer → `{ when yes, award }`; integer/number → `{ when > 0, award, per: key }`).
- **Research reads a stale copy (bug).** `buildPasteImportPrompt` → `catalogEntry` reads `shows.format` →
  `show_formats` `made-<slug>`, written only by confirmMake; `saveChain` updates `rulebooks.compiled` alone. After an
  edit the prompt wouldn't ask the new question, and the bot's filing (`botSend.full` researchItems with the run's format)
  would read the old rules. (`restageSeason` and `seasonFormat` do read the rulebook: made seasons have rulebook_live.)
- **Stats read the base blocks (bug).** `season-stats.ts` seasonFactsFor's no-game branch uses `row.blocks`, not
  `blocksAt(base, inForceEdits)`: a moment added by an edit gets no stat column (cast-stats.ts statDefs reads
  momentsFor(book.blocks)). Points come from `compiled` (fresh each request): a points change shows at once.
- **Merging.** `researchFromPaste` with `merge` + `fill` (`mergeResearchPayload` 1444, fillEntry 1501): field by field,
  an empty value never overwrites, a later "no" doesn't erase an earlier "yes"; it changes the `combined` row only. The
  run's own answers (`submitted`) are what `botSend.full` files.
- **Filing a partial answer would remove facts (trap).** `botSend.full` files with `covers { people, kinds: null }`: an
  answer that asked only the new question would count against every fact it didn't report (`fact-status.ts` settleFact,
  one voice per sender: the newest `bot:autopilot`), and they'd be removed.
- **Re-asking a done episode isn't possible.** `research_asks` (0152, one per season + episode) asks only missing and
  failed episodes (`askResults`).
- **Who made it.** `rulebooks.created_by` and `provenance.by` (confirmMake), `show_setups.done_by`, `shows.created_by`
  (who added the show, not necessarily who made it a game). No helper gives the maker rights today.

## Design

### Who may edit

`canEditScoring(user, seasonId)` (new, `src/lib/server/maker-scoring.ts`): the season's in-force rulebook is
`owner_kind 'season'`, its `created_by` is the user (or the user is a site admin), it isn't locked (`locked_at`), and no
game is played on the season (no non-deleted league on it: the same test as research-asks.ts `researchable`). Answers
`{ editable, why }` so the page can say why not ("A game's being played on it, so its scoring is every game's").

### Research reads the season's rulebook (step 1, a fix)

When a season plays by its own rulebook (`rulebook_live`), research builds its question and files its answers from that
rulebook as it is now (`seasonRulebookFormat`, db/rulebooks.js 414), not the stored `show_formats` copy: in `catalogEntry`
/ `seasonFormatFor` (db/episode-research.js 1136, 1247) and wherever `botSend.full` takes `r.format`. Keep `show_formats`
in step for anything else that reads it: `saveChain` (or the scoring save) writes the compiled data there too for a
`made-` format. And season-stats.ts reads `blocksAt(base, inForceEdits)` for its book.

### A moment can score an answer already asked (step 2)

`customMoments[].uses?: <question key>`: the moment's ask is that existing question (rulebook-moments.js customMoment:
`ask.key = m.uses`, its type from the question), so compile adds a rule on that field and no new checklist field.
Validation: `uses` must be a question the rulebook asks (a checklist field from momentsFor/segments), and `counted` must
fit its type (yesNo on an answer, eachTime/perUnit on an integer/number). The Scoring page lists those questions in
plain words ("How many votes they received at the Round Table").

### Saving (step 3)

`GET /api/seasons/[seasonId]/scoring`: `{ editable, why, moments: [{ id, label, part, points, counted, from: rule|custom,
question }], questions: [{ key, words, type }] (answers already asked, to score from), episodesResearched: n }`.
`POST`: `{ points: { id: n }, add: [{ label, counted, points, uses? | question? }], remove: [ids] }` (custom moments only).
Builds the new blocks from `blocksAt(...)` now, saves as a **fix** (from the premiere: the desk's fix path, saveChain, with
`provenance.editedBy`), keeps the `made-` show_formats row in step, then `restageSeason(seasonId, 1)`. Answers which new
moments ask a **new** question (none for points or `uses`), so the page can offer the re-run.

### Looking episodes up again (step 5)

- `research_asks` (migration 0154): `mode TEXT` ('full' | 'missing'), `fields JSONB` (the new questions' keys for
  'missing'). `askResults(user, seasonId, { again: 'missing' | 'full', fields })` re-asks done episodes too (resets the row:
  asked_at now, done/ok/found cleared, mode/fields set), in episode order, the same queue and roll call.
- `runJob` for an asked run with `fields`: the prompt is the core fields (checklist.js CORE_FIELDS: name, leftTheGame,
  exitMethod, sources, confidence) plus those keys only (`buildPasteImportPrompt(..., { only: fields })`, a cut-down
  checklist through formatForRulebook / buildDataFormat), then `researchFromPaste` with merge + fill.
- **Filing:** after a fill-merge, file the **merged** episode answer (the `combined` row's payload) as the bot's answer,
  not the run's own: the same `bot:autopilot` voice, newer, carrying every fact it had plus the new ones, so nothing is
  counted against and removed. (Full re-runs do the same.) The alternative, covers scoped by event type, touches
  fact-status's rules for everyone: avoid.
- The roll call says which: "Ep 3 · The new question" / "Ep 3 · Everything again".

### The Scoring page (step 4)

A page over the show (`/show/[seasonId]/scoring`, like backstage's pages), from How it works ("Edit scoring", the maker
only) and the Players tab's Points ("Change the points"). Phone-first, DESIGN.md's Lower Third:

- The moments grouped by part (rulebook-describe.js pointGroups), each a row with its points on a stepper (−20..20 by
  0.5), a custom one removable.
- **Add a moment** (a bottom sheet): its name; how it counts (yes or no / each time / per one: per vote); **score it
  from** an answer already asked (the list, in plain words) or **a new question** (its words); its points.
- **Save**: a toast, the Players tab recounting at once. With a new question, a sheet: "Episodes 1–7 were looked up
  before this question. Look them up again: **Just the new question** (about a minute each; nothing else changes) ·
  **Everything again** (2–4 minutes each) · Not now". It queues the asks; the results card's roll call shows them.
- Not the maker, or a game's started: the page reads as the rules, with why.

## Steps

1. **Research and stats read the rules as they are** (the two fixes above), with a check that an edit's new question
   reaches the prompt and its moment gets a stat column. Ships on its own.
2. **`uses`: a moment on an answer already asked** (schema, moments, compile, validation, unit tests).
3. **Scoring read/save** (`maker-scoring.ts`, the route, permission, fix save, restage), API-tested.
4. **The Scoring page** and its entry points, browser-checked at 390 on Night and Studio.
5. **Look them up again** (0154, missing/full asks, the cut-down prompt, merged filing, the re-run sheet, the roll call's
   words), with the check that a just-the-new-question run removes nothing.
6. Docs: DESIGN.md (the Scoring page), HANDOFF, BACKLOG (what's left).

## Checks (scripts/dev-test/check-maker-scoring.js, on check-research-asks.js's fixture: zt_ra_ people, ZT Castle Game on
the researched Traitors rulebook)

- The maker raises "Won the Mission" 2 → 5: the Players tab's points change with no bot run.
- Adds "−0.5 a vote received at the Round Table" from the existing question: points and a stat column, no bot run.
- Adds a new question ("Cried at the Round Table", yes/no): the re-run sheet; Just the new question: the stand-in bot
  gets a prompt with the core fields and that key only; every earlier fact still counts; the new one counts.
- Everything again: the full prompt, merged.
- Someone else (follower, not maker): read-only, 403 on save. A league on the season: read-only with why.

## As built (2026-10-27: steps 1–6, not committed)

- **No `fields` column.** 0154 adds only `research_asks.mode`; "missing" works out what to ask when it runs (the stored
  answer's keys against the checklist: episode-research.js `unaskedKeys`), so a question added while a re-run is queued comes
  too, an episode with nothing new is done without asking ("Nothing new to ask"), and one with no stored answers of this
  checklist gets the whole checklist. `onlyFormat` cuts the checklist to the core fields and those keys, with no episode
  questions, groups, merge or side bets; the answer is read with that schema (anything else it says is dropped) and filled in;
  with no stored answers to add to it refuses rather than stand alone (`storeMergedResearch` `onto`).
- **Filing replaces, too.** Filing the merged answer wasn't enough: fact-status holds back any fact an answer covering that
  person didn't report, and the bot's earlier answers were never asked the new question, so its results stayed pending. A
  re-asked episode's answer is filed with `replaces` (community-results.ts `submit`): the bot's earlier answers for the
  episode are withdrawn in the same transaction. A person's own earlier answer would still hold it back (BACKLOG 19).
- **Which episodes:** the page's `behind` is the looked-up episodes with no answer to a question a moment added by hand asks
  (not being asked now); "full" asks every looked-up episode. An ask waiting or running keeps its turn (everything again wins
  over just what's new); a done or given-up one starts over.
- **GET answers null** for a season with no rulebook of its own (the Players tab asks of every show; a 404 there logged an
  error on every non-made show).
- **The roll call** says "The new question · …" / "Everything again · …" in the plate's line (the tag stays "Ep 3").

## Open, for later

- Edits after a game starts (couch-level Make it ours exists; season-level stays the desk's).
- Whether another couch's "Looks right to us" check resets when the maker edits (rulebook-checks.ts).
- The bot's time: a full re-run of a 12-episode season is ~30-45 minutes of the one bot; just the new question is shorter.
