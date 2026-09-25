# Handoff: where things stand (for a fresh session)

Read this first, then `docs/PLAN-show-formats.md` (the next piece of work), then `README.md` for the
full history. `CLAUDE.md` / `AGENTS.md` hold the standing project rules.

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

**Status:** plan written and agreed in principle; no code yet. Waiting on the user for:

1. Whether to track Traitor/Faithful roles (hidden until revealed) and score on them.
2. Confirming the draft Traitors scoring events (see the plan).
3. Confirming the draft Challenge scoring events.
4. Go-ahead to start phase 1. The user was offered it, but hasn't confirmed yet.

**Seasons the user has added / will add** (use these to study wiki structure before writing the
format prompts):
- The Traitors (US) Season 5, "New Blood": https://thetraitors.fandom.com/wiki/The_Traitors_(US)/New_Blood
- The Challenge: Cutthroat (2026): https://thechallenge.fandom.com/wiki/The_Challenge:_Cutthroat_(2026)
- Survivor 51: live, in production use.

The previous cloud session could NOT reach `*.fandom.com` (network policy). A local session should be
able to, e.g. via
`https://thetraitors.fandom.com/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&format=json&titles=The_Traitors_(US)/New_Blood`.
Look at the cast section heading, the per-episode / elimination tables, and where roles and teams
appear. For ground truth, pull a *completed* season of each show before a live one.

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
  `node db/migrate.js` (also run on `npm run build`). Use the next free number (0021 at the time of
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
