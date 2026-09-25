# Handoff: where things stand (for a fresh session)

Read this first, then `docs/PLAN-show-formats.md` (the next piece of work), then `README.md` for the
full history. `CLAUDE.md` / `AGENTS.md` hold the standing project rules. `docs/ADDING-A-SHOW-FORMAT.md`
is the reusable playbook for researching and folding in *future* shows — read it before adding a show
beyond Survivor/Traitors/Challenge.

## Next up: show formats

**Plan:** `docs/PLAN-show-formats.md`. Short version: the pipeline is show-agnostic, but the game
vocabulary is hard-coded Survivor. That covers exit methods, scoring events, the merge concept, wiki
extraction prompts and validation, and the research checklist. The plan adds `shows.format`
(`survivor` | `traitors` | `challenge` | `generic`) plus one format definition per format in
`src/lib/game/formats/`. Phases:

1. Move Survivor's rules into `survivor.js` with **no behaviour change**.
2. Add The Traitors.
3. Add The Challenge.
4. Tidy-up.

**Status (2026-09-25):** Phases 1–3 (Survivor, The Traitors, The Challenge) are built on branch
`format-phase1-survivor`. None of it is merged or pushed: the user said to hold off merging for now.
- Migrations 0021 (`shows.format`) and 0022 (role decisions).
- Checks: Survivor is unchanged in the regression harness.
- Real model reads, graded against the wikis' own tables:
  - Traitors US4: 23/23 exits, 5/5 roles.
  - Challenge All Stars 4: 25/25 exits.
  - Cutthroat cast: its three teams, correctly grouped.
- `tsc`, `eslint` and `next build` pass.
- **Not yet run against a database.** The local dev DB is at migration 0015 and lacks `pgvector`,
  which migration 0016 needs.
- The plan's phase entries list what's deferred, and what to do when switching an existing show's
  Rules. The regression and check scripts are session scratch files; they're described in the plan
  but not committed.
- Next is Phase 4 (tidy-up), plus the deferred items: hand-entry of roles, role badges, and team
  changes.

The open questions are all resolved:

1. Roles: **track and score** Traitor/Faithful, hidden until revealed, with mid-season recruitment
   supported (confirmed recurring mechanic, not a one-off).
2. Traitors scoring events confirmed (8, see the plan): shield, survived Round Table, voted out a
   Traitor, recruited as Traitor, Finalist, Winner, Murdered, banished-as-Traitor.
3. Challenge scoring events confirmed (7, see the plan): challenge win, elimination-round win,
   nominated-and-survived, finals placement, Winner, exit-method-as-event, served as captain.
4. Phase 1 go-ahead: given, and Phase 1 is built (see above).

**Wiki ground truth pulled** (via `curl` against each wiki's MediaWiki API — WebFetch tool itself
402s in this environment, but direct API calls work fine, including from this Windows/PowerShell
local session):
- Traitors: `The_Traitors_(US)/New_Blood` (live, US5), `The_Traitors_(US)/Season_4` (completed),
  `The_Traitors_(Australia)/Season_3` (completed, not yet pulled — do this before writing
  `traitors.js` if AU is in scope).
- Challenge: `The_Challenge:_Cutthroat_(2026)` (live), `The_Challenge:_Vets_%26_New_Threats`
  (completed), `The_Challenge:_All_Stars_4` (completed, not yet pulled).
- Key findings: Traitors' real tables are transcluded from per-season `Template:` pages (e.g.
  `Template:US5 Contestant Info`). Survivor's are too, and wiki-sync already resolves them for any
  show. The Challenge's table shape and rules vary season to season and are driven by its prose (the
  `==Format==` section). Full detail is in `docs/PLAN-show-formats.md`.
- Survivor 51: live, in production use.

## What was built recently (all merged to master)

- **Season decisions** (migration 0019, `db/season-decisions.js`, `src/lib/server/season-decisions.ts`).
  - Episode results are staged once per season by both connectors (wiki + research) and decided by a
    super-admin in Admin → Shows & Seasons.
  - Accepted results are applied to every league on the season automatically, through a per-league
    ledger (`league_applied_decisions`), so applying is idempotent and reversible.
  - Catching-up leagues get an episode's results when they reveal it.
  - Commissioners no longer review anything; the old per-league item tables (`wiki_proposal_items`,
    `episode_research_items`) are history only.
- **Episode list + air schedule + auto-research** (migration 0020, `src/lib/game/air-schedule.js`,
  `db/auto-research.js`, `.github/workflows/auto-research.yml`, `src/components/admin/season-episodes.tsx`).
  - Each season has an air schedule: premiere date + time + zone, weekly. The wiki's air dates
    override it, and when there's no premiere date, dates run weekly from the last wiki-dated episode.
  - Aired episodes get Review / Research. The one upcoming episode shows its air time only, and the
    research route refuses unaired episodes.
  - Per-season auto-research (weekday/time/model) runs from an hourly GitHub Action. It only picks up
    slots after it was switched on, and retries a failure after 6h, at most 3 times.
  - "Discard research" appears for an episode researched before it aired.
- **Model picker + cost hints** in the admin UI (`src/lib/ai-cost.ts`).
  - Haiku 4.5 / Sonnet 5 / Opus 5 are selectable for wiki reads and research.
  - Typical-cost hints appear on paid buttons, and each result shows its actual cost.
  - Research asks only about castaways still in the game, and is limited to each show's trusted sites
    (`shows.research_domains`, editable in show Settings), with at most 5 searches and prompt caching.
  - Sites that block Anthropic's crawler (e.g. ew.com) are dropped automatically and the search is
    retried.

## Things the user still needs to do in production

- Discard Survivor 51 episode 2's research (it was run before the episode aired), and set Season 51's
  premiere date.
- GitHub repo secrets for the auto-research workflow: `AUTH_DATABASE_URL`, `ANTHROPIC_API_KEY`, and
  optionally `GEMINI_API_KEY`.
- Confirm `GEMINI_API_KEY` is set in Vercel, so side-bet suggestions can index research.

## Working conventions (from this collaboration)

- **Branch and merge.** Develop on a feature branch. The user tests live, so always fast-forward merge
  to `master` and push once a change is verified, without asking.
- **Before pushing:**
  - Run `npx tsc --noEmit -p .` and `npx eslint src`.
  - If tsc complains about `.next/types`, run `rm -rf .next/types .next/dev/types && npx next typegen`.
- **Migrations** are hand-written SQL in `db/migrations/NNNN_*.sql`. They're applied by
  `node db/migrate.js` (also run on `npm run build`). Use the next free number (0023 at the time of
  writing).
- **`db/*.js`** is plain CommonJS so the CLIs run under bare `node`. TypeScript sees these modules
  through `.d.ts` files next to them and the `@db/*` alias. The same pattern applies to
  `src/lib/game/*.js`.
- **Local dev:**
  - Postgres may need `service postgresql start`.
  - The dev admin is `conor` / `devpass123` (created by `node db/seed-dev-admin.js`).
  - Keep the dev server off except for brief verification.
- **Secrets and commit text:**
  - Never commit secrets. `.env.local` is gitignored.
  - Never ask for or paste the production database URL.
  - Don't put model identifiers in commit messages, beyond the standard attribution trailer.
- **Comments** explain *why*, matching the existing (fairly thorough) comment style.
