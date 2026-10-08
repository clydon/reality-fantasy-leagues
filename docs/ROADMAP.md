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

## Remaining work, not blocked

**Direction (decided 2026-10-07): until automated AI research exists, every research step is
copy/paste.** The app builds a prompt, the user runs it in any web-searching chat themselves, and
pastes the answer back. That paid automation, not league counts, is what monetization will gate
(see Blocked). Copy/paste flows so far:
- Show research ("+ Add it", stage 3/4): done.
- Cast research (`PLAN-cast-import-prompt.md`): **done 2026-10-07**, "Import a cast" in League
  Settings, available to every commissioner.

- **Episode research for commissioners, as a compiled-research cache** (`PLAN-episode-research-
  compiled-cache.md`): **plan written 2026-10-08, not started.** Full design and rationale are in
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

- **Format review gap-filling** (`PLAN-format-review-gap-filling.md`): a written plan, not started.
  Lets an admin add a missing question, event and rule on the format review screen with no raw JSON.
  UI only, no storage or route changes. Small; it pairs naturally with scoring-rules phase 4 below,
  since both are rule editing, and doing it first gives phase 4 the add-question/add-rule plumbing.

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
  - **Phase 4 — rule-list editor**, desktop-first. Admin edits masters with a version bump on save;
    commissioner gets "Customise this league's rules" (copy) and "Update from master" (merge newer
    version); rows read as sentences ("When *won individual immunity* is *yes* → award *Individual
    immunity win*"). Depended on by phase 5.
  - **Phase 5 — flowchart editor**, desktop-first. Built with `@xyflow/react` (React Flow): condition
    nodes, award nodes, built-in nodes shown as locked blocks. Loaded only on the editor route
    (`next/dynamic`) so it adds nothing to the player-facing bundle. The list (phase 4) and the
    flowchart edit the same JSON, so neither can drift from the other.
  - Open design risks noted in the plan for later: three-way merge UI for copies (phase 4 can start
    with "here's what changed, apply these rules?" and defer full merge); mid-season lock (deferred,
    `locked_at` hook already in the phase-1 model); sharing UI/trust (deferred to when a browse list
    exists).
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
