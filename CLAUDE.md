@AGENTS.md

# Reality Fantasy Leagues (POC)

Read `README.md` first. This is a proof-of-concept spike validating the React/Next.js direction
recommended in the *separate, source-of-truth* `SurvivorDraft` repo's `docs/ARCHITECTURE.md` — it
is not the live app. `src/lib/game/state-logic.js` is a **verbatim, manually-synced copy** of that
repo's `shared/state-logic.js` (see the provenance comment at its top) — don't diverge its actual
logic here without also back-porting the change, and don't "clean it up" into a different shape
without checking that repo's CLAUDE.md first (it explains why that file is structured the way it
is).

