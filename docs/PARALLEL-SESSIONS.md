# Running sessions in parallel: lanes

For the user, and for any session asked to set up or work in a lane. `docs/PLAN-start-a-game-gpt.md` uses lanes first: its lanes
section says which steps can run at once. The `sports` branch is a lane too.

## What a lane is

A lane is one line of work with its own:
- **folder**: a git worktree (a second checkout of the same repo, sharing its history) on its own **branch**;
- **local database**: a copy of `reality_fantasy_leagues` in the same Docker container (`survivor-draft-pg`), so its migrations
  and test fixtures touch nobody else's (the whole database is about 23 MB, so a copy is instant);
- **dev-server port**: so its browser checks reach its own server;
- **session loop**: `node scripts/session-loop.js` keeps its state in the folder's own `.session-loop/`.

Sessions in different lanes can run at the same time. Within a lane they run one after another, exactly as now. The main folder
stays on master, for the user's own work, merges and production fixes.

## Make a lane

From the main folder, in PowerShell. The engine lane is the example; take each lane's name, branch and port from the plan's
lanes table.

1. **The folder and its branch, from master:** `git worktree add ..\rfl-engine -b engine master`
2. **Its database**, a copy of the local one. The dev server can stay up; `<user>` is the user in `AUTH_DATABASE_URL`.
   - `docker exec survivor-draft-pg createdb -U <user> rfl_engine`
   - `docker exec survivor-draft-pg sh -c "pg_dump -U <user> reality_fantasy_leagues | psql -q -U <user> rfl_engine"`
3. **Its `.env.local`:** copy the main folder's, then change two lines:
   - `AUTH_DATABASE_URL` ends in `/rfl_engine`;
   - `BETTER_AUTH_URL=http://localhost:3002`, because sign-in only works on the port it names.
4. **Install:** `cd ..\rfl-engine; npm install`
5. **Its dev server:** `npm run dev -- -p 3002`.
6. **Its checks:** run `$env:BASE = "http://localhost:3002"` in the lane's terminal first. Every `scripts/dev-test/` check reads
   `BASE`, and reads the database from the `.env.local` of the folder it runs in.

A `scripts/lane.js` could do steps 1–4 in one command (offered 2026-10-27, not built). Step 2 was tried on 2026-10-27 on a
throwaway copy: 1.3 s, all 99 tables, pgvector included.

**What a worktree doesn't have:** anything git ignores. That means the production backups (`backups/`), the mocks
(`.impeccable/mocks/`) and `.env.local`. A lane reaches the backups by full path (e.g. `shadow-leagues.js sync
--from=C:\Users\conor\reality-fantasy-leagues\backups\<backup>`). Design work, which lives in the mocks, stays in the main folder.

## Work in a lane

- **With the user there:** open the lane's folder in its own VS Code window and start Claude in that window, so the session
  works in that worktree.
- **Unattended:** in a terminal in the lane's folder, run `node scripts/session-loop.js --prompt "..."` with the plan step's
  seed prompt. Each lane's loop is separate (`node scripts/session-loop.js status` in that folder).
- **Name the lane in every seed prompt** (its folder, branch, port and plan step), so the session uses its own server and
  database and never edits another lane's files.

## Bring a step home

1. **At the start of each step**, the lane merges master in: `git merge master`.
2. **When the step is done** (its checks pass, and `/code-review` on its diff is clean), the user merges it into master from the
   main folder (`git merge engine`), runs the full check batch there, and pushes. The session loop never pushes or merges.
3. **Shared docs and memories** (HANDOFF.md, BACKLOG.md, the shared memories) are updated at that merge, not mid-step in a lane.

## Remove a lane

- `git worktree remove ..\rfl-engine`
- `git branch -d engine`, once it's merged
- `docker exec survivor-draft-pg dropdb -U <user> rfl_engine`

## Speed-ups inside one session

Not every speed-up needs a lane:
- **Subagents** read and map code in parallel and hand back only the answer; the GPT plan's session used three.
- **A subagent in its own worktree** (`isolation: "worktree"`) can write a self-contained piece without touching the session's
  files.
- **Workflows** fan out many agents with checks between them. They only run when the user asks for one ("use a workflow").
- **`/code-review`** reviews a step's diff before it merges.

## What still waits for the user

However many lanes run, these wait for the user:
- production backups and Neon rehearsals;
- feature flags in production;
- VM deploys;
- switching real games;
- merges and pushes;
- design reviews.

The user's attention is the real limit, so start with two lanes. Lanes also share one usage window: three lanes at xhigh use it
about three times as fast, and each session loop pauses itself near the limit (`--pause-at`).
