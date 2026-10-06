# Roadmap: what's left

Read this first for "what's next," instead of piecing it together from `PLAN-rollout-order.md` plus
the plans it sequences. This doc only tracks remaining work; it doesn't re-explain what's already
shipped (that's `HANDOFF.md`) or restate full design detail for finished phases (that's each
`PLAN-*.md`, left in place — many are cited by code comments as permanent design rationale, not
just task tracking, so they're not going away even once fully implemented).

**Status as of 2026-10-06:** everything through Stage 4 of `PLAN-rollout-order.md` is done, including
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

- **Season rule changes** (was "season-level delta research", `PLAN-ai-generated-show-formats.md`
  phase 5) — **designed and confirmed 2026-10-06; `docs/PLAN-season-rule-changes.md` is now the
  source of truth.** Mid-season (or start-of-season) rule/mechanic changes stored as additive,
  episode-gated changes on a season (`season_rule_changes`), reviewed from a Rules row in SeasonCard
  that never blocks Episodes. Each running league's commissioner adopts a change and sets its points.
  Episode research gains a `rulesNote` flag that prompts a re-check. Five phases; **phases 1 (pure
  core), 2 (storage, season wiring, admin API; migration 0053) 3 (the admin Rules row and
  review screen in SeasonCard) and 4 (the commissioner adopt card in League Settings) done
  2026-10-06**; phase 5 (the research flag, `rulesNote`) is next.
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

- **Monetization gating** — `PLAN-new-user-onboarding-flow.md` phase 5 (multi-league ceiling,
  AI-credit upsell on "+ Add it"). Waiting on a pricing decision — a product conversation, not a
  coding task — so it's last regardless of engineering readiness.

## Model guidance (unchanged from `PLAN-rollout-order.md`)

- Pattern-following UI/wiring work (confetti extension, rule-list editor once the data model is
  settled) → Sonnet.
- Judgment-heavy design work, or anything where getting it wrong silently corrupts data
  (season-level delta research's prompt/review design) → Opus.
- Haiku earns its keep only on the most repetitive, lowest-stakes edges of a stage — not as a default.

## Starting a new session on this

1. Fresh session is fine — point it at this file plus `docs/HANDOFF.md`. Don't hand it the whole
   plan-doc history; scope the first prompt to one bullet above.
2. For the scoring-rules phases, also point it at `PLAN-scoring-rules-as-data.md` for the full design
   (this doc only summarizes it).
3. Set the model with `/model` per the guidance above before starting.
