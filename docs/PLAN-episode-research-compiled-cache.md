# Plan: episode research for commissioners, as a compiled-research cache

Builds on `docs/PLAN-cast-import-prompt.md` (the paste-first pattern, the "reuse the apply logic,
don't rebuild it" discipline) and the existing episode-research pipeline (`db/episode-research.js`,
`db/migrations/0014`/`0015`/`0019`). Grounded in a fresh read of that code on 2026-10-08, not just
the design conversation that preceded it — several pieces assumed missing in that conversation
already exist and just need a second caller.

## The problem

Episode research today only reaches a league two ways: an admin runs it in Admin > Shows & Seasons
(`PasteImportPanel` in `season-episodes.tsx`, `requireSuperAdmin`), or the season is on a wiki
connector that pulls it automatically. Neither covers a league on a self-serve researched show
(`docs/PLAN-ai-generated-show-formats.md`) that no admin happens to be covering — its commissioner
has no way to get episode results in at all beyond typing them in by hand, episode after episode.

And even where an admin *is* researching a season, nothing shares that work the other direction: if
this became commissioner-facing naively, two leagues on the same season would each run their own
full research pass on the same episode, duplicating a chat session every week for no reason — the
same cast, the same episode, the same questions, answered twice.

## Decided (from a 2026-10-07/08 design conversation, corrected against the real code)

- **It's a read-only cache, not an authority.** Compiled answers only ever narrow or skip a
  *prompt*. No league's state changes because of what's in the shared store — only because that
  league's own commissioner chose to apply it. This was the key property the design conversation
  converged on, and it holds: nobody's accept decides anything for a league they don't run.
- **Reuse the existing storage, don't build new tables.** `episode_research` (the raw checklist,
  per show+season+episode) and `season_decisions` (positive findings, decided once per season,
  currently admin-only) already do almost everything "compiled research" was imagined to need:
  `season_decisions`' upsert (`db/season-decisions.js`'s `stageDecisions`) already merges sensibly —
  a pending row's confidence is only *upgraded*, never silently downgraded, by a later re-stage. The
  one real gap: `episode_research`'s payload is *replaced* wholesale on a re-research (`0014`'s own
  design), not merged per castaway. That matters here specifically because the next bullet sends
  *partial* payloads on purpose — a naive overwrite would erase everyone else's already-good answers.
- **Confidence stays at today's granularity: one value per castaway per episode, not per
  question.** `src/lib/game/formats/checklist.js`'s `CORE_FIELDS.confidence` already confirms this —
  it covers a castaway's whole entry, not each answer separately. Going finer was explored in
  conversation and dropped; it's a bigger schema change than this feature needs, since "skip this
  person, we already know about them" is the actual cost lever, not "skip this one field."
- **Deliberately left out, to keep this light:** no confidence decay from a commissioner's
  correction, no cross-league feedback loop, no consensus-flipping a stored answer, no required
  reason field on a correction. These were designed in conversation and explicitly cut — see
  `docs/ROADMAP.md`'s "Parked" section for the player-dispute/inbox feature that's the better home
  for catching a genuinely wrong answer later (a real person with stakes flags it, rather than an
  algorithm inferring trust from disagreement counts).
- **A commissioner's own league gets results without waiting on an admin.** This is the one place
  the original conversation's "reuses `season_decisions.applied`" claim was wrong and needs
  correcting: that field is a *single*, admin-only correction applied identically to every league
  (`0019`'s whole design) — there is no existing per-league accept path for episode decisions.
  `StateLogic.applyEliminationsImport`/`applyScoringEventsImport` *are* exactly that path, though —
  already additive and idempotent, already built for this shape, just currently reachable only
  through the commissioner-proposal flow a wiki connector feeds (`wiki-proposals/[id]/route.ts`).
  This plan gives a commissioner a second way to reach them: review whatever's staged in
  `season_decisions` for their league's episode (from any source — their own research, another
  league's, or an admin's) and apply the accepted ones straight into their own league.
- **The admin's existing season-wide accept is untouched.** `season_decisions.status` and
  `syncLeagueDecisions` keep working exactly as they do today, admin-only. A commissioner's per-league
  apply is a second, independent path into the same league — not a replacement. The two can't
  double-score each other: `applyEliminationsImport` already skips a castaway already eliminated,
  and `applyScoringEventsImport` already skips a (castaway, episode, type) already recorded. Whichever
  path reaches a league first wins; the other is a no-op.
- **An uncatalogued season gets a `show_seasons` row created lazily, not admin-gated.** League Info
  already lets a league pick a free-typed season number with no catalog row at all ("No catalogued
  seasons for this show: keep a free-text number so a league isn't [blocked]" —
  `league-info-section.tsx`). Episode research's staging (`stageResearchDecisions` →
  `decisions.seasonIdFor`) hard-requires a `show_seasons` row to exist, so the first commissioner to
  research such a season needs one created on the spot. This has a useful side effect: it's the
  first concrete step toward "admin sees league-by-league research" (`docs/ROADMAP.md`'s Parked
  section) — a self-serve season a commissioner researches becomes visible in the admin catalog from
  that point on, with no new UI needed for that part.
- **Cast stays out of scope here.** `season_cast` still isn't populated by this plan — a
  commissioner on a self-serve show still needs the cast entered first, by hand or via
  `docs/PLAN-cast-import-prompt.md`'s "Import a cast", which itself doesn't write to `season_cast`
  either. Retrofitting cast import onto the same shared-cache idea is a noted follow-on in
  `docs/ROADMAP.md`, not part of this plan.

## The pieces

1. **The `episode_research` merge fix**, in `db/episode-research.js`'s storage path (wherever a run's
   payload is written — currently a plain upsert per `0014`'s "replace, don't accumulate" comment).
   On a re-research, merge the new payload's `castaways` entries into whatever's already stored for
   that (show, season, episode), by name: a castaway missing from the new pass keeps their stored
   entry untouched; a castaway present in both keeps the higher-confidence entry (ties keep the
   newer one, since it's presumably more current). This is the one behavior change everything else
   here depends on, because piece 3 sends intentionally partial payloads.
2. **`researchFromPasteForLeague(pool, leagueId, episodeNumber, notes, opts)`**, a sibling of the
   existing `researchFromPaste`, same body, but resolving context through
   `resolveResearchContext(pool, leagueId, episodeNumber)` instead of
   `resolveSeasonResearchContext(pool, showSlug, season, episodeNumber)` — the league-based resolver
   already falls back to the league's own `state.castaways` when `season_cast` is empty, which is
   exactly what a self-serve show with no admin-approved cast needs and the season-based resolver
   explicitly doesn't support ("no league to borrow a roster from"). Before resolving, ensure the
   season's `show_seasons` row exists (`INSERT ... ON CONFLICT DO NOTHING` keyed on `(show_id,
   season_number)`, reusing `catalogEntry`'s existing lookup to know if it's missing).
3. **The coverage check**, used before building a prompt: read the stored `episode_research` payload
   (if any) for the league's (show, season, episode). For each of the league's current castaways,
   classify as fully-covered (an entry exists with confidence medium/high) or needs-asking (no
   entry, or low confidence). All fully covered → no prompt at all, go straight to piece 4's review.
   Otherwise → build the paste prompt (`buildPastePrompt`) with `ctx.castNames` narrowed to just the
   needs-asking list, so the researcher is only asked about people genuinely missing or shaky.
4. **A commissioner-facing review + apply step.** Lists what's currently staged in `season_decisions`
   for the league's season and episode (any source, any status — a prior pass by this league, another
   league, or an admin), editable the same way `cast-import-section.tsx`'s review rows are. On
   confirm, applies the accepted rows to this league only, via a new small server helper (mirrors
   `src/lib/server/cast-import.ts`) that shapes them into `StateLogic.applyEliminationsImport`'s and
   `applyScoringEventsImport`'s existing `{ episodes: [...] }` proposal shape — no new StateLogic
   function, these already exist and are already additive/idempotent.
5. **New routes**, commissioner-gated (`requireLeagueRole(..., "commissioner")`), under
   `/api/leagues/[leagueId]/episodes/[epId]/research`:
   - `GET` (or a `POST` that also runs piece 3): the coverage summary and, if needed, the prompt.
   - `POST .../apply`, `withLeagueLock`-wrapped: paste → `researchFromPasteForLeague` → piece 4's
     apply, in one request, same "both land together or not at all" discipline `cast-import`'s route
     already uses.
6. **UI**: a per-episode panel (Episodes tab), same shape as `PasteImportPanel` but commissioner-
   worded, leading with the coverage summary before anything else — "already fully researched, just
   review" / "10 of 12 answered, 2 missing" / "fully answered, 2 low-confidence" — so a commissioner
   sees immediately whether they need to do anything at all.

## Order of work

1. The `episode_research` merge fix, with tests proving it doesn't regress today's admin research
   path (a full re-research of an already-fully-covered episode should still behave exactly as now).
2. `researchFromPasteForLeague` + lazy `show_seasons` creation, tested against a self-serve show with
   no catalog season row and no `season_cast` at all.
3. The coverage check and narrowed prompt, tested for all three states: fully covered, partially
   covered, fully covered but low-confidence.
4. The per-league apply path (piece 4), tested for idempotency specifically: apply a decision
   directly to a league, then run the existing admin season-wide accept/sync over the same decision,
   confirm nothing double-applies.
5. Routes, then UI.
6. **Smoke test, by hand:** two leagues on the same uncatalogued self-serve season. Commissioner A
   researches episode 1 (a real, partial paste); commissioner B opens the research panel for the same
   episode and sees it already (partly or fully) covered, with a narrower or absent prompt; confirm
   both leagues can independently apply/correct what they see without affecting each other.
7. Gates per `docs/HANDOFF.md`: `npx tsc --noEmit -p .`, `npx eslint src`, `npm test`.

## Risks

- **The merge fix touches code every existing admin research path depends on.** It needs the same
  regression discipline the repo already uses for format changes (`tests/harness/format-regression.js`
  is the pattern to follow or extend) — not just new tests for the new narrowed-payload case, but
  proof the existing full-payload case is unchanged.
- **Two independent application paths into one league (a commissioner's direct apply, and an admin's
  later season-wide accept) must not double-score.** This relies on `applyEliminationsImport` and
  `applyScoringEventsImport`'s existing idempotency (status-already-eliminated skip; (episode, type,
  castaway) already-recorded skip) — call this out explicitly in review and test it directly, rather
  than trust it by inspection.
- **Lazily creating a `show_seasons` row outside admin control is new.** Check Admin > Shows &
  Seasons' own listing/sync code for any assumption that every row there was admin-created or
  admin-reviewed before this ships — a lazily-created row should look unremarkable to it, not break
  an invariant.
- **Season cast is still a separate, unsolved gap.** A self-serve season with no cast entered yet
  (by hand or via cast import) can't be researched meaningfully — `resolveResearchContext` falls back
  to the league's own castaways, so an empty roster means an empty checklist. Not a blocker for this
  plan (the commissioner just needs to add the cast first, same as today), but worth noting since it's
  the same underlying gap `docs/ROADMAP.md` already flags for cast import.

## Implementation notes (2026-10-08)

Built in the plan's order. Where it differs from the text above, and why:

- **The merge is opt-in (`storeResearch`'s `opts.merge`), set only by the per-league path.** Applied to
  every re-research, "keep the more confident entry" would change the admin path: a full re-research
  that lowers someone's confidence would no longer replace them, and someone a newer read shows was
  already out would linger in the payload and keep their staged decisions. The admin, CLI and
  auto-research paths replace exactly as before. Proof: `tests/harness/research-store-regression.js`
  (before/after diff of every write on fixed admin scenarios -- byte-identical against the pre-change
  file, and mutation-checked: forcing the merge on the admin path makes it differ).
- **Staging runs over the MERGED payload, not the partial run.** `stageDecisions` withdraws any pending
  research decision for the episode that its run no longer reports, so staging a narrowed run alone
  would withdraw every other league's pending rows. Covered (and mutation-checked) in
  `tests/episode-research-cache.test.js`.
- **The league path is JSON-paste only.** A prose paste costs a structuring call on the site's
  Anthropic key; that stays an admin choice. JSON is parsed free.
- **A partial run only answers for who it asked.** Anything else the chat volunteers is dropped
  before the merge, so it can't replace a stored answer nobody asked to replace.
- **Two requests, not one.** Paste (`POST .../research`) writes only the shared cache; apply
  (`POST .../research/apply`) is the one league write, in one `withLeagueLock`. Piece 4's review sits
  between them, so they can't be one request. Apply takes staged row ids plus corrections; the kind
  and episode always come from `season_decisions`, and corrections are held to the league's format.
- **Apply covers every staged kind** (elimination, event, exiled, role, group), not just the two import
  functions: exile/roles/tribe moves have none, so they use the same per-person idempotency
  `syncLeagueDecisions` does.
- **Catching-up leagues can't research or apply past their reveal pointer** -- results there arrive on
  reveal, the same gate the season sync uses.
- **Double-scoring is tested directly** (`tests/episode-research-apply.test.js`) against the real
  `syncLeagueDecisions`, both orders: commissioner first then admin accept (the sync records the
  results as `preexisting`, adds nothing, and a later admin reject leaves them), and admin first then
  commissioner (a no-op). One consequence worth knowing: if the admin accepts first and LATER rejects,
  the sync undoes that result in every league, including one whose commissioner "applied" it after --
  their apply was a no-op, so there's nothing of theirs to keep.
- **Lazy `show_seasons` rows**, checked against Admin > Shows & Seasons: a lazily-created row is just a
  season with a number and column defaults (status `completed`, no wiki, no schedule, auto-research
  off) -- the same as an admin adding one with only a number, and every listing/sync/air-time reader
  tolerates that. One real knock-on, fixed: League Info swapped its free-text Season box for a
  dropdown as soon as a show had ANY catalogued season, so a second league on another season number
  would have lost its value. The dropdown now keeps an off-catalog pick and offers "Another season…".
  **Not covered by "no new UI needed":** the season lists and opens fine in Admin, but its Episodes
  step reads "Approve the cast first", and a self-serve season never has a season cast (each league
  keeps its own). So an admin can't review or accept its staged decisions from the UI -- only through
  the API the review buttons call. Left as is: commissioners apply per league, and the admin view of
  league-by-league research is the parked follow-on in `docs/ROADMAP.md`.

### Smoke test (2026-10-08), against the local dev server

Two throwaway commissioners, each with a league on a throwaway self-serve show (an approved copy of the
stored Love Island (UK) format, created by commissioner A) at season 11, which had no `show_seasons`
row. League A typed the cast as the wiki spells it ("Jess White"), league B shorter ("Jess"). The
pasted answers were real: Love Island UK series 11 episode 1 (3 June 2024), sourced from Wikipedia and
recaps. Driven through the real panel in a headless browser (phone width), with the database checked
after each step; fixtures torn down afterwards, with no orphans left.

1. A opened episode 1: "Not researched yet", prompt for all 13. A pasted a partial answer (11 of 13,
   two of them low confidence). The season row was created, with column defaults; 22 decisions were
   staged; neither league changed.
2. B opened the same episode: "9 of 13 answered, 2 missing, 2 low-confidence", the prompt narrowed to
   those 4 in B's own spellings, and the staged rows resolved to B's names. B pasted its answer for the
   4: A's 9 entries were kept untouched, the 2 low ones were upgraded, the 2 missing were added, and
   nothing pending was withdrawn (25 staged).
3. Each applied independently, correcting differently: A applied the 11 "coupled up" rows and left
   out the format's wrong "entered as bombshell" rows; B kept only Joey's bombshell row. Each apply
   changed only its own league; every decision stayed `pending`.
4. A reopened, opted into B's two new rows (B's "Patsy" resolved to A's "Patsy Field"), and applied
   them. Both leagues then held the same 13 results, reached by different routes.
5. Admin's season-wide path through its own endpoints: reject the 12 wrong rows, accept the 13 others,
   sync. Each league's ledger filed all 13 as `preexisting`, and nothing was added. A second
   accept+sync did nothing. A later admin reject of Joey's row "undid" it in the ledger, but both
   leagues kept it, because it was preexisting.

What it found, all fixed:

- **A paste that left anyone out was refused outright** ("don't cover the cast, so nothing was saved"),
  so a real partial paste could never happen on the league path. On the merge path, someone left out
  loses nothing (they keep what's stored, or stay "missing" for the next pass), so there it's now a
  note ("no answers for 2 islanders, still to research: …"). It's still refused when NOBODY asked about
  was answered, which usually means wrong names. The admin path is unchanged: its store replaces, so a
  gap there would erase people.
- **The filter for who was asked matched more loosely than the validation reported.** "Jess" for
  "Jess White" was reported as "dropped" but merged anyway. Both now match the name as asked, in any
  case (the prompt says to keep every name exactly as written).
- **The league prompt ended by pointing at the admin box** ("Paste research notes" with "Structured
  (JSON)" ticked). It now names the commissioner's "Research this episode" box.
- **Rows a commissioner left out came back ticked** after applying, under an "Apply N" button, so
  reopening the panel later (say, to pick up another league's new rows) invited re-applying what
  they'd turned down. Nothing records a league's "no", and the shared rows aren't theirs to reject.
  So once any of the episode's research is in the league, rows start unticked, with a line saying why.

Not fixed, noted: the stored Love Island format's `enteredVilla` rule awards "Entered as bombshell" to
every original islander too (a format-data problem, not this feature's; reviewing caught it). The admin
sync's response counts preexisting results as "applied" (its ledger rows), which is existing behaviour.
