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
