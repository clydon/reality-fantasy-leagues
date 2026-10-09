# Roadmap: what's left

Read this first for "what's next," instead of piecing it together from `PLAN-rollout-order.md` plus
the plans it sequences. This doc only tracks remaining work; it doesn't re-explain what's already
shipped (that's `HANDOFF.md`) or restate full design detail for finished phases (that's each
`PLAN-*.md`, left in place — many are cited by code comments as permanent design rationale, not
just task tracking, so they're not going away even once fully implemented).

**Status as of 2026-10-07** (see "Direction" below; earlier status from 2026-10-06 follows): everything through Stage 4 of `PLAN-rollout-order.md` is done, including
self-serve "+ Add it" show research — browser-verified end to end against the local dev server.
Show artwork (`PLAN-new-user-onboarding-flow.md` phase 4) is also done: `shows.art_url` (migration
0051), an Admin Settings field, and the Create-League wizard tile rendering it with the existing
emoji as fallback. Verified by tsc/eslint/tests, a migration apply, and a rolled-back DB write/read
smoke test — not full browser click-through, since the local Playwright session was already locked
by another Chrome instance this session.

Scoring rules as data, phase 2 (storage/API for a commissioner's own per-league ruleset copy) is
also done: `league_rulesets` (migration 0052), `db/league-rulesets.js`, `src/lib/server/league-rulesets.ts`,
`formatForRuleset`, and `/api/leagues/[leagueId]/ruleset[/shared]` — see `docs/PLAN-scoring-rules-as-data.md`'s
"Who owns what" section for the design and the commit for the scoped-down reconciliation with the
already-shipped `show_formats` table (masters were deliberately NOT unified into a new table — see
that commit's message for why). No UI yet, as scoped; phase 4 is what will expose it to a
commissioner. Verified by tsc/eslint/tests (167/167), the format-regression harness (byte-identical
before/after), and an end-to-end fork/edit/share/delete cycle against a disposable league in the
local DB.

**Shipped 2026-10-08, Active Roster results and lineup UX** (commits `7f622ec`, `60f01f9`):
Overview's Latest Episode lists every team's points for the week, each opening to how they earned
them; a new League Scoring Overview section (collapsed, first by default) sets out what everything is
worth; each Scoreboard card has Episode N rows (earlier ones behind "Show all episodes…") above the
renamed Roster section, replacing the emoji episode summary; and the Episode N Starters board gained
Set/Edit lineup → Done, using the same editor as the lineup card. Small follow-ups, none urgent:
- The separate "Your lineup" card (`lineupGrid`) is now redundant with the Starters board's edit mode.
  It's being hidden through Customize Overview for now; once that's settled, drop it from
  `DEFAULT_OVERVIEW_ORDER` or delete it (`LineupEditor` in the same file is shared and must stay).
- `episodeTeamBullets` (`src/lib/game/episode-team-summary.ts`) no longer renders anywhere, only its
  tests use it. Delete it, or find it a new home.

## Remaining work, not blocked

**Direction (decided 2026-10-07): until automated AI research exists, every research step is
copy/paste.** The app builds a prompt, the user runs it in any web-searching chat themselves, and
pastes the answer back. That paid automation, not league counts, is what monetization will gate
(see Blocked). Copy/paste flows so far:
- Show research ("+ Add it", stage 3/4): done.
- Cast research (`PLAN-cast-import-prompt.md`): **done 2026-10-07**, "Import a cast" in League
  Settings, available to every commissioner.

- **Episode research for commissioners, as a compiled-research cache** (`PLAN-episode-research-
  compiled-cache.md`): **built and smoke-tested 2026-10-08 (pieces 1-6)**. See that doc's
  "Implementation notes" for what differs from the plan, and the smoke test's results and fixes.
  Known gap: an admin can't review a self-serve season's staged results from the UI (its Episodes step
  waits on a season cast it will never have). Full design and rationale are in
  that doc now — this entry only summarizes it, and the doc is the one to read before building. In
  short: a read-only cache (`episode_research`/`season_decisions`, already-existing tables, with one
  real fix — a re-research merges into the stored payload per castaway instead of replacing it
  outright) that narrows or skips a commissioner's research prompt for an episode already covered by
  another league's pass; a commissioner's own league applies accepted results directly via
  `StateLogic.applyEliminationsImport`/`applyScoringEventsImport` (already additive/idempotent)
  without waiting on an admin's separate season-wide accept. Confidence stays at today's granularity
  (per castaway per episode, not per question). No confidence decay, cross-league feedback,
  consensus-flipping, or required reason field — deliberately cut; see "Parked" below for the
  dispute/inbox feature that's the better home for catching a wrong answer later. Note: this
  grounding pass found and corrected an error from the 2026-10-07/08 design conversation — there is
  no existing per-league `season_decisions.applied` override; that field is a single, admin-only
  correction applied identically to every league. The plan's per-league apply path is genuinely new,
  not a reuse, and is spelled out there.
  - **Follow-on, not required day one:** cast import (already shipped) bypasses this entirely,
    writing straight into the calling league's state with no shared record — so two leagues on the
    same self-serve season's cast still duplicate that research. Worth retrofitting onto the same
    model once it exists, but not a blocker for shipping episode research first.

- **One cast per season, shared by every league on it** (`PLAN-universal-season-cast.md`): a written
  plan, decided 2026-10-08, not started. The cast (names, photos, starting tribes, never spoiled) is a
  season fact: the first league to enter it, or an admin, creates it, and only an admin changes it after.
  Strictly just cast: results get their own per-season switch (admin-decided, like Survivor 50 today, or
  league-decided), and a league-decided season's Admin Episodes step becomes a curator view. This fixes
  the known gap above (admin can't review a self-serve season), the spelling mismatches between leagues'
  rosters, and the cast-import follow-on above. Data-moving (it links existing rosters to a season cast),
  so Opus. Three open questions at the end of the plan.

- **Format review gap-filling** (`PLAN-format-review-gap-filling.md`): **done 2026-10-08.** An admin
  can add a missing question, event and rule on the format review screen with no raw JSON --
  `addQuestion`/`updateQuestion`/`removeQuestion`, "+ New question…" threaded (optionally) through
  `LeafEditor` and `RuleFields`' field-param dropdown the same way `onCreateEvent` already was, and
  "+ Add rule" both per-event and in "Other rules". `season-rule-check.tsx` is untouched and still
  compiles without passing `onCreateQuestion`, as scoped. Browser-verified end to end against the local
  dev server: a throwaway draft got a new question + new event + a rule connecting them purely through
  the UI, saved with zero problems, approved into a real (throwaway) show, and the approved format's own
  rules engine was run directly against a synthetic answer -- it scored the new event and left the
  format's original rule untouched. Removing a question a rule still reads surfaces a clear problem
  (`answer: no checklist question "..."`), as the plan expected -- deliberately not pre-blocked. tsc/
  eslint/`npm test` (232/232) all clean (only the known pre-existing pickem-pick-grid error). Side
  finding, out of scope here: reopening a draft immediately after "Save as draft" can show the pre-save
  proposal (`FormatReviewScreen`'s state is seeded once from props and never re-synced, racing the
  "admin-format" query's own invalidation-triggered refetch) -- approving straight from an still-open
  screen avoids it and is how the buttons are actually used, so left as a note for later rather than
  fixed here.

- **Season rule changes** (was "season-level delta research", `PLAN-ai-generated-show-formats.md`
  phase 5) — **done 2026-10-06, all five phases; `docs/PLAN-season-rule-changes.md` has the design and
  each phase's proofs.** Admin records mid-season rule changes per season (Rules step in SeasonCard,
  migration 0053); research asks the new questions from the change's episode; each Active Roster
  league's commissioner adopts a change and sets its points in League Settings. Episode research now
  asks a `rulesNote` that flags a possible change. Only follow-up: watch whether `rulesNote` stays
  quiet on ordinary Survivor 51 episodes and tune its wording (`RULES_NOTE`) if not.
- **Scoring rules as data, phases 3–5** — `PLAN-scoring-rules-as-data.md`. Phase 1 (the rule
  model/evaluator) and phase 2 (storage/API) are done; nothing below has shipped yet:
  - **Phase 3 — already satisfied, confirmed during phase 2's research.** The plan lists this as
    "format proposals produce rules in this shape." Stage 3's shipped format-proposal flow already
    produces exactly `rules: { research, implied }` (via `show_formats`, not a `rulesets` row — the
    plan's phase-3 text was written assuming phase 2's table would hold proposals too, before Stage 3
    shipped against `show_formats` instead). Nothing left to build for phase 3 itself.
  - **Phase 4 — rule-list editor, done 2026-10-09.** Admin editing of masters was already substantially
    covered before this phase started: `format-review-screen.tsx` (stage 3/gap-filling) already lets an
    admin edit a `show_formats` row's rules, and built-ins stay code-only by design (`CLAUDE.md`) --
    nothing new needed there. The actual gap, and all this phase built, is the commissioner-facing half:
    - **League Settings > Rules** (`src/components/setup/rules-section.tsx`, mounted in `setup-tab.tsx`
      right after General Settings): read-only rule sentences for every league (reusing the admin's
      `FormatRulesView`), with "Customise this league's rules" for a commissioner forking a private copy
      of whatever the league follows today (built-in or its show's approved format) via the already-shipped
      `POST /api/leagues/:id/ruleset`.
    - **The editable list** (`src/components/setup/league-ruleset-editor.tsx`) reuses
      `format-review-screen.tsx`'s row pieces (`RuleLine`, `CategorySelect`, etc. -- newly exported
      `awardsOf`/`locate` from `proposal.js` so a new pure function, `formats/ruleset-review.js`, could
      drive them from a plain `FormatData` instead of a raw AI proposal) for sentences like "When *left
      the game by* Voted Out → award *Voted out*", editable via the same condition/built-in controls the
      admin screen has. Deliberately narrower: no new-question authoring (a league's own checklist can't
      gain a question research never asks -- research runs once per show, not per league copy), no event/
      question removal, no raw-JSON escape hatch.
    - **No points field.** The first browser pass caught a real bug here: `defaultPoints` edited on an
      event silently never affects a real score, because `state-logic.js`'s normalization unconditionally
      backfills `settings.eventPoints` from the format's defaults on every load, and
      `ActiveRosterLogic.pointsFor` reads that override first -- so once a league has loaded even once
      (i.e. always), the ruleset's own point value is permanently shadowed. Points stay Active Roster
      Settings' job, exactly as the plan said points "doesn't change here"; this screen only edits what
      triggers an event, never what it's worth.
    - **"Update from master"** is the plan's simplified version, not a merge: a client-side diff
      (`rules-section.tsx`'s `diffRulesets`, comparing rule sentences and event sets) against the current
      master's data -- a built-in's is always current code, a `show_format`'s is `settings.showFormatData`
      (kept current by the admin's own push regardless of whether this league forked away) -- shown as
      "here's what changed", with "Replace with the master's current rules" implemented as abandon-then-
      refork from the same parent (loses the commissioner's own edits, stated plainly before confirming).
      Not implemented for a `league_ruleset` parent (another league's shared copy): no live read exists for
      that without the sharing/browse UI this phase deliberately leaves out, same as phase 2 scoped it.
    - **Verified:** tsc/eslint/`npm test` (232/232, only the pre-existing pickem error) all clean; the
      format-regression harness byte-identical before/after (only `proposal.js` changed, by adding two
      exports with no behavior change). Two browser passes against the local dev server with a throwaway
      commissioner account and disposable leagues: the first caught the points-field bug above by recording
      a real Survivor 49 elimination, editing that event's points, and confirming the castaway's score
      didn't move (it should have, for an implied/exit-based rule, which does recompute live); the second,
      after removing the points field, confirmed fork → edit a rule's condition → save → reload persists
      the edit → abandon → reverts, with no console errors. Both left no orphaned test data.
  - **Phase 5 — flowchart editor**, desktop-first. Built with `@xyflow/react` (React Flow): condition
    nodes, award nodes, built-in nodes shown as locked blocks. Loaded only on the editor route
    (`next/dynamic`) so it adds nothing to the player-facing bundle. The list (phase 4) and the
    flowchart edit the same JSON, so neither can drift from the other.
  - Open design risks noted in the plan for later: three-way merge UI for copies (phase 4 started with
    "here's what changed, apply these rules?" as planned, and defers full merge); mid-season lock
    (deferred, `locked_at` hook already in the phase-1 model); sharing UI/trust (deferred to when a browse
    list exists -- phase 4's "Customise" only forks from the league's current master, not from another
    league's shared copy, even though the backend already supports that source).
- **Confetti extended to new trigger points, optional Rive flourish** — the low-risk tail end of the
  old rollout plan's Stage 5, reusing already-proven patterns. No urgency.

## Blocked

- **Monetization gating** — `PLAN-new-user-onboarding-flow.md` phase 5. Reframed 2026-10-07: what
  gets gated is **automated AI research** (show, cast and episode research run by the app instead of
  copy/paste), not mainly a league ceiling. So it needs the automated research path built first, plus a
  pricing decision, which is a product conversation, not a coding task.

## Parked (decided not to build yet, design kept)

- **Player dispute → commissioner/admin inbox.** Explicitly held back 2026-10-08: don't build yet.
  The admin-routing half only makes sense once there's a shared compiled answer whose *source* can be
  wrong, not just one league's own oversight — so this is a natural follow-on to the episode-research
  compiled-cache item above, not something to design or build alongside it. Design notes to carry
  forward when it's picked up:
  - A dispute has two different repair targets, and the eventual design should keep them distinct:
    the commissioner fixes their own league's accepted value (an overlook — only that league changes);
    the admin fixes the shared compiled answer (a source error — every league that inherits it
    benefits).
  - Checked whether this could reuse `src/lib/game/action-items.js` (today's "what's waiting on you"
    action bar, read by `/api/me/actions`). It doesn't fit: that's a pure function recomputed from
    current state, single-player, single-league. A dispute needs to persist (it's an event that
    happened), needs two different viewers with different scopes (one league's commissioner, the admin
    across every league), and needs an open/resolved lifecycle — structurally closer to how
    `wiki_proposals`/`season_decisions` already work (`status`, `resolved_by`, `resolved_at`) than to
    the action bar. It's a third shape, not a reuse of either existing pattern.
  - No new scoring-correction logic is needed. The commissioner already has full edit routes for every
    fact type an episode holds (eliminations, scoring events, roles, group moves — see
    `src/app/api/leagues/[leagueId]/episodes/[epId]/*`). This feature is purely a flag-and-route-to-an-
    inbox layer on top of editing that already exists, not a new way to correct anything.
  - Also considered and explicitly rejected for v1 of the *compiled-research* item above (not this
    one): confidence decay on commissioner override, cross-league disagreement feeding back into the
    shared store's confidence, and auto-flipping the stored answer on reviewer consensus. All cut as
    too much machinery for what the dispute-inbox approach solves more simply and more honestly (a
    real person with real stakes flags it, rather than an algorithm inferring trust from override
    counts).

## Model guidance (unchanged from `PLAN-rollout-order.md`)

- Pattern-following UI/wiring work (confetti extension, rule-list editor once the data model is
  settled) → Sonnet.
- Judgment-heavy design work, or anything where getting it wrong silently corrupts data (the
  episode-research compiled-cache's merge/confidence model, the eventual dispute-inbox split between
  commissioner-local and admin-shared fixes) → Opus.
- Haiku earns its keep only on the most repetitive, lowest-stakes edges of a stage — not as a default.

## Starting a new session on this

1. Fresh session is fine — point it at this file plus `docs/HANDOFF.md`. Don't hand it the whole
   plan-doc history; scope the first prompt to one bullet above.
2. For the scoring-rules phases, also point it at `PLAN-scoring-rules-as-data.md` for the full design
   (this doc only summarizes it).
3. The episode-research compiled-cache item has a plan (`PLAN-episode-research-compiled-cache.md`)
   — read it, not just this doc's summary, before building against it.
4. Set the model with `/model` per the guidance above before starting.
