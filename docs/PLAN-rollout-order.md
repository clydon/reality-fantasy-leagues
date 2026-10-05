# Plan: rollout order and model guide

Ties together `docs/PLAN-ai-generated-show-formats.md` (the features plan), `docs/PLAN-new-user-onboarding-flow.md`
(the UI/UX plan), and `reports/Mobile React animation library picks.md` (the animation/UI-library research,
which proposed the first version of this ordering). This doc exists to answer one question for whoever —
or whichever Claude session — picks this work up next: what to build first, and which model to build it with.

## Order

| Stage | What | Why here |
|---|---|---|
| **0 — Foundation** | Install Motion (`LazyMotion`/`m` convention); ship `generic.js` for real | Both independent, both cheap, both set conventions/close existing gaps before anything else builds on them |
| **1 — Visible front door** | Onboarding plan phases 1–2: LoginScreen showcase strip + Create-League steps 1–2, using only the 3 existing formats, built animated from the start | Zero dependency on the AI pipeline — ships something real and branded fast while the harder work is still in progress |
| **2 — The hard architectural unlock** | Show-formats plan phase 2: migrate `survivor`/`traitors`/`challenge` into the new data shape, proven byte-identical via the regression harness | The one genuinely risky piece in either plan — do it in isolation, fully proven, before anything depends on it |
| **3 — The AI research-propose-review flow** | Show-formats plan phase 3, admin-only first | Needs stage 2's data model to exist; apply the animation report's staged-reveal polish here too |
| **4 — Merge the two plans** | Onboarding phase 3 ("+ Add it" tile) + show-formats phase 4 (catalog-trust default) | Literally the same seam from two angles — do them together |
| **5 — Polish & extend** | Confetti extended to new trigger points, show artwork, season-level deltas, optional Rive flourish | Low-risk, reuses proven patterns, no urgency |
| **6 — Monetization gating** | Onboarding phase 5 | Blocked on a pricing decision that hasn't been made yet — that's a product conversation, not a coding task, so it's last regardless of engineering readiness |

**Added 2026-10-05:** `docs/PLAN-scoring-rules-as-data.md` (scoring logic as data, editable as a rule
list or a flowchart). Its phase 1 slots in between stages 2 and 3, since stage 3's proposed formats
need scoring that isn't code. That phase is Opus work, proven with the regression harness like stage 2.
Its editor phases (rule list, then flowchart) come after stage 4.

## Model per stage

- **Stage 0, 1, 4, 5 — Sonnet.** Well-specified, pattern-following work: reusing existing component patterns,
  wiring, asset/config changes, extending an already-working confetti call site to new triggers. Most of the
  total work falls here. A few of the most mechanical bits in stage 5 (show artwork plumbing, simple gating
  checks once stage 6's pricing model exists) are fine on Haiku to save cost.
- **Stage 2 — Opus, no exceptions.** The one spot in either plan explicitly flagged as the real engineering
  risk: proving a refactor is byte-identical against three live, scoring-critical formats via regression
  harness, plus the checklist-schema-as-data prototype. Get this wrong and real leagues' scoring silently
  breaks. Don't delegate the verification step either.
- **Stage 3 — split it.** The prompt-generation logic and the new review-screen's data model (turning
  `docs/PROMPT-stat-research.md`'s methodology into a real product flow) is new, judgment-heavy design —
  Opus. The UI construction, since it reuses the existing `PasteImportPanel`/episode-decisions patterns
  almost verbatim, is Sonnet work once that design is settled.
- **Stage 6 — the pricing decision itself isn't a coding task.** That's another round of brainstorming.
  Once it's decided, the gating code is Sonnet/Haiku-level.
- **Rule of thumb for anything not on this list:** if getting it wrong would be expensive to notice (silent
  data corruption, an unverified refactor, genuinely ambiguous product judgment) → Opus. If it's "build this
  UI/wire this up following a pattern that already exists" → Sonnet. Haiku earns its keep on the most
  repetitive, lowest-stakes edges of a stage, not as a default.

## Starting a new session on this

1. Fresh session, not a continuation of the research/planning conversation this came out of — the actual
   coding doesn't need that history, just the files referenced here.
2. Point it at this file, plus `docs/HANDOFF.md` (the standing fresh-session read-first convention),
   `docs/PLAN-ai-generated-show-formats.md`, and `docs/PLAN-new-user-onboarding-flow.md`.
3. Set the model with `/model` — Sonnet 5, low effort, for Stage 0 (installing Motion and shipping
   `generic.js` are both pattern-following, low-ambiguity work, so this matches the guidance above exactly).
4. Scope the first prompt to Stage 0 only — don't hand it the whole roadmap and hope. Something like:
   *"Read docs/PLAN-rollout-order.md, then implement Stage 0: install Motion with the LazyMotion/m
   convention, and ship a real generic.js format per docs/PLAN-ai-generated-show-formats.md's phase 1."*
5. Re-run `/model` to step up to Opus before Stage 2 (the format-data migration) — that's the one stage
   this plan explicitly flags as needing it, and stepping down again after it's verified is fine.
