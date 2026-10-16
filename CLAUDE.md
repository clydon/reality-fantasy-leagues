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


## Testing: build for reuse

Browser checks and fixtures live in `scripts/dev-test/` (see its scripts' header comments: headless browser helper, linked-league fixture, reveal check). Look there before writing a new test setup, and reuse or extend what exists.

When you write a test, script or fixture for a check, design it to be reusable: parameterize it (width, league type, episode), key any DB rows on a `zt-` prefix with an `up`/`down` pair so it cleans up after itself, and put it in `scripts/dev-test/` with a header comment saying what it needs and how to run it. If a one-off really is one-off, say so rather than leaving it half-reusable. Never touch real accounts or leagues from a test.
