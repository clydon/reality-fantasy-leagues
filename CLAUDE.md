@AGENTS.md

# Reality Fantasy Leagues

Read `README.md` first for full architecture/history. This started as a proof-of-concept spike
validating the React/Next.js direction recommended in the separate `SurvivorDraft` repo's
`docs/ARCHITECTURE.md`, but **it has since become the real product** — it now has its own
standalone backend (Next.js API routes under `src/app/api/*`, its own Postgres database) and makes
**zero calls to the live SurvivorDraft server**. `src/lib/game/state-logic.js` **forked** from
SurvivorDraft's `shared/state-logic.js` (no longer a verbatim/synced copy — see the provenance
comment at its top) and is this app's own real game-logic engine now, not just a mock-mode
stand-in. Do not re-introduce a dependency on the SurvivorDraft repo (its Express server, CORS,
`NEXT_PUBLIC_API_BASE`) without explicit direction — that dependency was deliberately removed.

Identity is Better Auth (`src/lib/auth.ts`) with the `username` and `admin` plugins — the one real
account system for everything (league access, admin, all of it). There is no other login.

If you're picking this up in a fresh session: read `docs/HANDOFF.md` first (current state, what's next,
what's waiting on the user). Also check for a `docs/PLAN-*.md` file describing
in-flight feature work before assuming something is undesigned — one may already exist with a
concrete plan, routes, and schema ready to execute against.

