# Plan: stage 3, research → propose → review a new show's format (admin-only)

Stage 3 of `docs/PLAN-rollout-order.md` and phase 3 of `docs/PLAN-ai-generated-show-formats.md`. It builds
on stage 2 (formats as data, `src/lib/game/formats/define.js`) and phase 1 of
`docs/PLAN-scoring-rules-as-data.md` (scoring as rules, `formats/rules.js`). The goal is that an admin can
get a show nobody hand-wrote into the app without a developer: research it, review a proposed format,
approve it, and run a season on it.

## Decided (2026-10-05)

- **Paste first, paid later.** The app builds a prompt the admin copies into any web-searching chat
  (free), and the JSON answer is pasted back, the same way as episode research's "Paste research" today.
  A paid "research it for me" button comes once real answers show how big a proposal is, so it can carry
  a cost estimate. The plan lists that cost as unknown.
- **Flagged mechanics don't block approval.** When research finds something the rules language and the
  built-in library can't express, the proposal says so. Approve creates the format with everything that
  fits. The flagged mechanic is left out and kept on the format as a visible note with research's
  write-up, ready for a developer to add a built-in.
- **Admin-only.** Self-serve (the "+ Add it" tile) and the catalog-trust question are stage 4.

## The pieces

| Piece | Where | Who |
|---|---|---|
| The proposal: its shape, the prompt, parsing, repair | `src/lib/game/formats/proposal.js` | Opus (this plan) |
| The review model: proposal → format data, problems per row, rules as sentences | `formats/proposal.js`, `formats/rules.js` (`describeRule`) | Opus |
| Data-only formats: a format built from data alone, with a default code half | `formats/custom.js`, `formatFor(id, data)` | Opus |
| Storage: drafts and approved formats | migration `show_formats`, admin API routes | Opus |
| Resolution: every place a format is looked up can see a stored one | the 15 `formatFor` call sites, league `settings.showFormatData` | Opus |
| The screens: research panel, review screen, approve | `src/components/admin/` | Sonnet, from this plan |

The first three are pure functions (plain CommonJS, browser-safe, no zod), so the review screen can
recompute problems live as the admin edits, and the server re-derives the same result on save.

## The proposal (what the chat returns)

One JSON object. Every list is checked item by item, and a bad item is kept with its problem rather than
failing the whole proposal, so one wrong row never throws away a long research answer.

```jsonc
{
  "show": { "name": "Love Island (UK)", "castawayTerm": "Islander", "tribeTerm": "Couple", "hasMerge": false, "hasGroups": true },
  "seasonsChecked": ["Series 5", "Series 9", "Series 11"],
  "exitMethods": [
    { "name": "Dumped", "kind": "out", "meaning": "Voted out by the public or the other Islanders" },
    { "name": "Finalist", "kind": "finalist", "meaning": "Reached the final without winning" },
    { "name": "Winner", "kind": "winner", "meaning": "Won the series" }
  ],
  // Per-person questions research will answer every episode: primitives, not conclusions.
  "questions": [
    { "key": "atRisk", "type": "answer", "question": "Were they in the bottom, at risk of being dumped?",
      "note": "at risk", "tier": "A", "where": "every recap names the bottom couples" }
  ],
  "events": [
    { "id": "survivedDumping", "label": "At risk of dumping and survived", "category": "Dumpings",
      "points": 2, "tier": "A", "why": "Recaps always name who was at risk", "headline": false }
  ],
  // The scoring, in formats/rules.js's language. Events an implied rule awards are marked implied.
  "rules": { "research": [ /* ... */ ], "implied": [ /* ... */ ] },
  "notTrackable": [{ "fact": "Who fancies whom", "why": "Speculation; recaps disagree" }],
  "flagged": [{ "name": "Casa Amor", "what": "...", "whyCode": "...", "findings": "..." }],
  "domains": [{ "domain": "itv.com", "why": "The broadcaster's own episode recaps" }],
  "sources": ["https://..."]
}
```

- **Tiers** adapt `docs/PROMPT-stat-research.md` to research read from recaps, not wiki tables:
  - **A**: stated plainly every episode (a table, or every recap says it);
  - **B**: worked out from other answers (counting, comparing);
  - **C**: reported often but not always, or only in some seasons;
  - **D**: rarely, or only as speculation.

  A question or event at tier D belongs in `notTrackable`. The conversion moves it there and says so.
  A tier C item is kept but marked on the review screen.
- **Filled in by the conversion, never by the chat:**
  - the core checklist fields the research code reads (`name`, `leftTheGame`, `exitMethod`, `sources`,
    `confidence`);
  - an `Other` exit method;
  - the winner and endgame exits, from each exit's `kind`;
  - `implied` on events, from which list awards them;
  - categories, in first-seen order;
  - the recap (the events marked `headline`);
  - claims (every yes/no question);
  - the search hint;
  - the wiki half, as generic's (exits only, since this path is research-first).
- **Points** are one number per event. Exclusive/shared splits are an admin edit on the review screen.
- **Repairs** are logged, not silent: an id that isn't camelCase is rebuilt from its label, and an unknown
  key is dropped. Each repair shows on the review screen.

## The review model

`reviewProposal(proposal, { id })` returns everything the screen shows and everything approval needs:

- `data`: the format's data half, built from every usable row.
- `problems`: `{ at, message }`, where `at` names a row (`events[3]`, `questions[atRisk]`,
  `rules.research[2]`) or `format`. They come from the row checks plus `formatProblems` on the built data,
  mapped back to the row they're about.
- `approvable`: no problems.
- `categories`: the events grouped as League Settings groups them. Each row carries its points, tier, why,
  implied flag, problems, and the rules that award it as sentences (`describeRule`: "When *at risk* is
  *yes* and *left the game* isn't *yes* → *At risk of dumping and survived*").
- **Warnings** (not problems): an event no rule awards (it can still be added by hand), a question no rule
  reads (asked, never scored), tier C items, repairs.
- `notTrackable`, `flagged`, `domains` (each pre-checked when it matches a known-reputable pattern, never
  applied automatically) and `sources`, passed through for display.

The screen edits the proposal itself (rows), never the derived data, so nothing can drift. Approval
re-derives on the server and refuses unless `approvable`.

## Data-only formats

`buildDataFormat(data)` (`formats/custom.js`) is `defineFormat(data, defaultCode(data))`:

- **The wiki read** is generic's, with the format's own exit methods in its enum.
- **Research's `notes`/`sentences`** come from the checklist: a yes/no question's `note` ("at risk"), a
  number above 0 ("2 dumping votes"), a text or list answer. The checklist gains an optional `note`
  property for this. The built-in formats don't use it, so their schemas are unchanged.
- **`entryProblems`** is the generic check that an exit method needs `leftTheGame` yes.
- **No roles in v1.** A secret-role mechanic is exactly what `flagged` is for.

`formatFor(id, data)`: a built-in id resolves as today. Any other id resolves `data` when it's given and
its id matches, memoised per data object, otherwise as today (the default format).

## Storage and resolution

- **Migration `show_formats`** (next free number):
  - `id` (text, the format id, a slug unique against the built-ins), `name`, and `status`
    (`draft` / `approved`);
  - `proposal` (jsonb, the editable proposal) and `data` (jsonb, set on approval);
  - `version`, `created_by`, `approved_by`, timestamps.
  - `shows.format` keeps holding an id, with no foreign key, because built-ins aren't rows.
- **Leagues cache the data:** `settings.showFormatData` sits next to `settings.showFormat`, only for a
  stored format. It's written wherever `showFormat` is: league creation and the settings route, and the
  admin show PATCH push. `formatOf(state)` passes it to `formatFor`. Like `showFormat` today, this means
  `StateLogic` never needs a database.
- **Server call sites** select the stored data alongside `shows.format` (a `LEFT JOIN show_formats`) and
  pass it: `wiki-sync`, `episode-research`, `embeddings`, the decisions route, the shows routes and the
  demo builder. Admin client components get `formatData` in the payloads they already fetch.
- **Built-in ids can't be shadowed.** Saving a stored format with a built-in id is refused.
- **API (super-admin):**
  - `GET /api/admin/formats/prompt` (the paste prompt, from a show name, wiki URL and terms);
  - `POST /api/admin/formats` (parse a pasted answer into a draft, returning its review);
  - `PATCH /api/admin/formats/[id]` (save edited rows);
  - `POST /api/admin/formats/[id]/approve` (re-derive, refuse unless approvable, store `data`, create the
    show or switch an existing one to it, and push to its leagues);
  - `DELETE` (a draft only).
- **Editing an approved format** bumps its version and pushes the new data to every league on a show using
  it. That's the same push as a format change today, and the same rescoring caveat as
  `PLAN-scoring-rules-as-data.md`.

## Order of work

1. **Pure core (Opus):** `describeRule`, `custom.js` + `formatFor(id, data)`, `proposal.js` (prompt,
   parse, repair, review), with tests, including a full proposal run end to end through research. The
   harness must stay byte-identical: this touches `formatFor` and `define.js`.

   **DONE (2026-10-05).**
   - **New files:** `formats/proposal.js`, `formats/custom.js` and `tests/format-proposal.test.js`.
     `describeRule`/`describeCondition` live in `rules.js`, `formatFor(id, data)` and `isBuiltInFormat`
     in `index.js`, and the checklist's optional `note` in `checklist.js`.
   - **The test proposal** is a sloppy Love Island answer: a non-camelCase key and id, a core field the
     chat shouldn't have asked, a tier-D question, points written as text, and an exit that scores
     nothing.
     - It's repaired out loud, and each repair and warning is listed.
     - It becomes data that passes `formatProblems`.
     - It runs through the paste prompt, every provider dialect, parse, validation, staging (including
       `votedForLeaver` with its own params), reviewer notes from each question's `note`, implied
       events, and the wiki schema's exit enum.
     - Broken rows put each problem on its own row: a rule reading a missing question, an event
       awarded by both lists, bad points, a bad type, no winner.
   - **The prompt** leaves out the built-ins that need secret roles, and says secret roles go in
     `flagged`.
   - **Gates:** the harness is byte-identical to its post-phase-1 output. tsc is clean, `eslint src` has
     only the known pickem error, and `npm test` is 154/154.
2. **Storage and resolution (Opus):** the migration, `settings.showFormatData`, every call site, and the
   API routes, with tests.

   **DONE (2026-10-05).**
   - **Storage:** migration `0049_show_formats.sql`. It's purely additive, with checks for the id shape
     and "approved has data". `db/show-formats.js` is the one server path from a format id to rules
     (`resolveFormat`, `formatDataFor`, `isPlayableFormat`, `formatOptions` with terms). It also holds
     the draft/approve/save/delete logic and the league cache (`setLeagueFormat`, `syncLeagueFormat`).
     `src/lib/server/show-formats.ts` has `pushShowFormat(slug)`, which re-caches every league on a
     show under its own lock.
   - **Resolution:**
     - `StateLogic.formatOf` reads `settings.showFormatData`.
     - The league settings route caches it with `showId`, and refuses requests that try to set
       `showFormat` or `showFormatData`. Those were writable before through its generic setter.
     - The server sites now resolve through `resolveFormat`: research (catalog entry, re-staging), the
       wiki read (context, re-staging), embeddings, the decision route, and the shows list, create and
       PATCH routes. A built-in makes no query.
     - Admin client sites read the server's `formatOptions` (name and terms) and `formatData`: the
       shows section's pickers, placeholders, switch confirmation and research notes, and the season
       episodes review.
     - The demo builder only serves built-in demo shows, so it's unchanged.
   - **API (super-admin):**
     - `GET/POST /api/admin/formats`, `GET /api/admin/formats/prompt`, and
       `GET/PATCH/DELETE /api/admin/formats/[id]`;
     - `POST /api/admin/formats/[id]/approve`, which takes `{ createShow }` or `{ showId }`, plus the
       ticked `domains`.
     - The client methods are `api.adminListFormats` … `api.adminDeleteFormat`, and the types are
       `StoredFormat`, `StoredFormatSummary` and `FormatOption` in `types.ts`, plus `Review` in
       `formats/proposal.d.ts`.
     - **For the screens:** save and approve answer 409 with `{ format, error }` when an approved edit
       or an approval is refused, but `localFetch` keeps only `error`. So re-fetch the format to show
       its problems, or better, show `review.problems` live from `reviewProposal` (browser-safe) so
       the button is disabled before it's ever clicked.
   - **Verified:**
     - **Against the local database** (healthy; see HANDOFF), on one client inside a rolled-back
       transaction: draft from pasted text, free ids (`love-island-uk-2`, `survivor-2` since a
       built-in id is never taken), approve, picker option with terms, a show + season + cast + league
       caching the data and scoring by it through JSON, switching back to a built-in dropping the
       data, the research paste prompt asking the stored checklist, an approved edit refused when
       invalid and bumping the version when valid, an invalid draft refused approval, delete refused
       in use, and both table checks.
     - **The three real leagues** (local copies of WUYXVU, T9FUMY, B999RR) score byte-identically with
       the previous commit's code and the new code: every episode's events, defaults and scores.
     - **The format harness** is byte-identical.
     - **Gates:** tsc clean, `eslint src` only the known pickem error, `npm test` 157/157
       (`tests/show-formats.test.js` is new).
     - **The dev server** compiles every new route; each answers 401 when not signed in, and the
       client chunk carries the new `formatOf`.
     - **Not exercised:** the HTTP routes signed in. The logic they call is checked against the
       database above; the routes are thin glue. The first signed-in run is step 3's.
3. **Screens (Sonnet):** Admin → Shows → "Research a new show":
   - the prompt panel, reusing `PasteImportPanel`'s copy/paste pattern;
   - the review screen: rows grouped like Active Roster Settings, inline edits, tier chips, problems
     at their row, a collapsed "Not reliably trackable" list, a flagged-mechanic callout and domain
     checkboxes;
   - "Save as draft" and "Approve & create show", with the animation report's staged reveal for the
     review rows.

   **DONE (2026-10-05), browser-verified by the user end to end.**
   - **New files:** `src/components/admin/format-research-panel.tsx` (the name/wiki/terms/seasons
     inputs, `api.adminFormatPrompt`, copy, and the paste box that calls `api.adminCreateFormat`),
     `src/components/admin/format-review-screen.tsx` (the review screen for one stored format),
     `src/components/admin/format-rules-view.tsx` (read-only display of a format's events/rules/
     questions/exits, used for built-ins), and `src/components/admin/formats-panel.tsx` (the "Research
     a new show" entry, the stored-formats list with Open/Delete). `shows-section.tsx` mounts
     `<FormatsPanel />` next to "+ Add a show", and each show's Settings got a "view rules" /
     "view/edit rules" link next to its Rules picker (read-only `FormatRulesView` for a built-in;
     `FormatReviewScreen` itself, fetched live, for a stored format — same editor either way a stored
     format is opened, rather than a second, read-only, staler view of the same data).
   - **The review screen** recomputes `reviewProposal(proposal, { id })` live in the browser on every
     edit, so problems/warnings/sentences update as you type and "Approve" is disabled while
     `problems.length` is nonzero. Inline edits: an event's label/points/category (category is a
     picker over existing categories, not free text, to stop "Vote" and "Votes" silently becoming two
     groups), and a question's type. Edits are matched back to their row in the proposal by
     re-deriving the same camelCase id `proposal.js` would (`effectiveEventId`/`effectiveQuestionKey`),
     since the chat's raw id may have needed repairing.
   - **Rule editing, added after real use surfaced that inline label/points/category edits weren't
     enough to fix what a chat actually gets wrong** (a bad built-in param, a type mismatch, two rules
     awarding the same event): each rule row gets controls scoped to that one rule, not a block of raw
     JSON —
     - a dropdown for every param that names something else in the format (an event, with a "+ New
       event…" option that creates a placeholder on the spot; an exit method; a question);
     - a condition editor (question / test / value rows) for a `when`, or a flat AND of them — the
       shape almost every rule actually uses; a checkbox row for `whenExit`;
     - a "Built-in" dropdown to switch which built-in a rule uses (or to a plain condition rule),
       carrying over only the params the old and new shapes share by name;
     - "remove" to drop just that one rule (the event keeps the rest of its rules; dropped to a
       warning, not a problem) and a last-resort "edit as raw JSON" for what the above doesn't cover
       (a built-in's `condition`-type params, `any`/`not`/nested conditions).
     - A problem a rule itself causes (not its row) is attributed back to it (`problemsForAt`), a
       leftover-problems catch-all guards anything that still isn't shown anywhere, and the bottom
       "N problems to fix" line lists each one's `at` and message rather than just a count — the first
       version of all of this only showed a bare count, which made a stale-looking re-appearance of a
       problem undiagnosable without reading the code.
   - Categories (Active-Roster-style grouping), tier chips (C styled cautionary), the implied marker,
     rules-as-sentences, per-row problems/warnings, the questions list, exit methods, a collapsed "Not
     reliably trackable", flagged-mechanic callouts ("approving doesn't add this"), and domain
     checkboxes (pre-checked from `preChecked`, never auto-applied) are all there.
   - "Save as draft" / "Save changes" (label depends on `status`) call `adminSaveFormat`. "Approve &
     create show" and "Use for an existing show" **save first, then approve** — `adminApproveFormat`
     re-derives from what's stored on the server, not from the browser's in-progress edits, so
     approving without saving first would approve the format as it stood before the session's edits.
     A 409 on either call shows the server's `error` and re-fetches the format. Every successful
     save/approve collapses the review screen back to the list.
   - Animation: `m`/`AnimatePresence` from `@/components/motion`, a small staggered fade-in on the
     event rows only.
   - **New built-in, found necessary by real use, not anticipated by the plan:** `votedForLeavers`
     (`formats/rules.js`) — same as `votedForLeaver` but reads a `stringList` field and awards if *any*
     named person left, no roles needed. A chat's first Love Island draft tried to force a
     multi-name vote into `votedForLeaver` (which only reads one name), which would have silently
     dropped votes for more than one person if "fixed" by shrinking the question to `string` --
     recurring across shows (Survivor's extra-vote advantages are the same shape), so it's a built-in
     addition, not a one-off. Proven byte-identical against the four shipped formats
     (`tests/harness/format-regression.js`, none of which use it) and covered by a new test in
     `tests/scoring-rules.test.js`.
   - **Verified by the user, live, signed in:** two full passes of generate prompt → paste → review →
     fix real problems (a built-in param mismatch, a type mismatch, a duplicate award) → save → approve
     & create a show → edit the approved format → delete the test show and format.
   - **Gates:** `npx tsc --noEmit -p .` clean; `npx eslint src` only the known pre-existing pickem
     error; `npm test` 158/158; the format harness byte-identical throughout.

## Risks

- **A chat writing rules in our language.** That's the point, but it will get some wrong. The row checks
  and `formatProblems` catch every reference error with a reason, and the review screen is where they get
  fixed — confirmed by step 3's real drafts, which hit a built-in param mismatch, a type mismatch and a
  duplicate award, each fixed on the review screen without leaving the app. Watch the first few real
  answers and tighten the prompt; `votedForLeavers` already came out of doing exactly that.
- **Resolution misses a call site.** It silently falls back to Survivor's rules. Step 2 greps every
  `formatFor` and adds a test that a stored format resolves in league state and in research.
- **The default notes are plainer** than the hand-written formats'. That's fine for a reviewer, and a
  question's `note` makes them readable.
