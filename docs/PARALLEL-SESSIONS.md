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

## Make a lane: `scripts/lane.js`

From the main folder: `node scripts/lane.js new <name> --port <n> [--branch <b>]`. The script's header lists every command:
- `new` and `setup` make a lane;
- `list` shows them all;
- `check` boots a lane's server and reads from its database;
- `dev` runs a lane's dev server;
- `start` opens a window running a lane's session loop;
- `keep` watches lanes' loops and starts one again when it stops with a hand-off still to run (overnight, below);
- `sync` merges master into a lane;
- `remove` takes a lane out;
- `memory` links a lane's Claude memory.

Made on 2026-10-27:
- **survivor** (`../rfl-survivor`, branch `survivor-data`, port 3001)
- **engine** (`../rfl-engine`, port 3002)
- **sports** (the existing worktree, port 3004)

Each one passed `check`. On 2026-10-28: **playtest** (`../rfl-playtest`, port 3005; docs/PLAN-playtests.md), whose
`.env.local` lists only the local bot, since it records from it all night; and **desk** (`../rfl-desk`, port 3003; the
build of docs/PLAN-desk-parity.md, from the weekly reset), whose `.env.local` lists no bot at all: its checks use the stand-in.

**Claude's memory is shared.** Claude's docs say auto memory is one folder per repo, shared by its worktrees. As a
safeguard, in case a version keys it by the folder a session runs in, `setup` links the lane's folder in `~/.claude/projects`
to the main one's memory. Every lane reads and writes the same notes, and `remove` takes out the link, never the notes.

**What Claude Code itself offers, and why lanes don't use it** (from its docs, checked 2026-10-27):
- `claude --worktree <name>` makes a worktree under `.claude/worktrees/`, but on a branch from GitHub's master, not the local
  one, and without this project's database, port or `.env.local`.
- The VS Code extension opens several conversations at once (Command Palette › "Claude Code: Open in New Tab" or "Open in New
  Window"). Each one works in the folder its window has open: open a lane's folder in its own window to talk to a session
  there, and trust the folder when VS Code asks.
- The desktop app has split views and a per-session worktree switch, with the same gaps as `--worktree`.
- Cloud sessions clone GitHub, so they can't reach the local database.
- **On Windows, "don't ask again" approvals stay with the folder they were given in**, so a lane's interactive sessions may ask
  for permissions the main folder already has. The loop's sessions run in auto mode without prompts.

What `new` does, by hand, for the engine lane (take each lane's name, branch and port from the plan's lanes table):

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

It also links `.models/` (the embedding model) to the main folder's, adds `BASE` to `.env.local` for the checks, and links
the memory. The database copy takes about a second (all 99 tables, pgvector included) and `npm ci` about 50 s.

**What a worktree doesn't have:** anything git ignores. That means the production backups (`backups/`), the mocks
(`.impeccable/mocks/`) and `.env.local`. A lane reaches the backups by full path (e.g. `shadow-leagues.js sync
--from=C:\Users\conor\reality-fantasy-leagues\backups\<backup>`). Design work, which lives in the mocks, stays in the main folder.
A lane that builds to the mock reads it there by full path, read only, and shoots its scenarios with
`shoot-mock-scenarios.js --mock=C:\Users\conor\reality-fantasy-leagues\.impeccable\mocks\site`.

## Work in a lane

- **With the user there:** open the lane's folder in its own VS Code window and start Claude in that window, so the session
  works in that worktree.
- **Unattended:** `node scripts/lane.js start <name> --prompt "<the step's seed prompt>"` opens a window running the session
  loop in that lane, at Opus / xhigh (`--effort high`, say, for less; `keep` restarts a lane at the effort it ran at) and at
  most 3 sessions (`--max-sessions`). Each lane's loop is separate: in its window,
  `p` pauses, `s` stops after the session, `q` quits; from anywhere, `node scripts/session-loop.js status` in the lane's
  folder. A session stops for the user where it needs them (its question shows in that window); the loop never merges or
  pushes.
- **Name the lane in every seed prompt** (its folder, branch, port and plan step), so the session uses its own server and
  database and never edits another lane's files.
- **Overnight:** a loop stops after `--max-sessions`, even with a hand-off waiting. `node scripts/lane.js keep survivor engine
  playtest --max-sessions 4` runs in a window of its own and starts any of them again from its hand-off (at most `--restarts`
  times, 4 by default), checking every 5 minutes. It leaves a lane alone that's waiting for the user, was stopped partway or
  is done, and its log is the main folder's `.session-loop/keeper.log`. The loops wait out the 5-hour window themselves, and
  the keeper waits out the weekly one. First used 2026-10-28, when the user went to sleep with three lanes running.
- **The usage cap** (the user, 2026-10-31: "pause all lanes at 75%", the rest of the week kept for their own work until the
  weekly reset): `scripts/usage-cap.js` reads the main folder's `.session-loop/usage-cap.json` (`node scripts/usage-cap.js
  set 75`, or `off`; with no file it's 90%). Two points under the cap no session starts (`session-loop.js` stops, `lane.js
  start` refuses without `--over-cap`, a keeper restarts nothing and writes a running loop's `STOP`, so its step finishes);
  at the cap a keeper pauses a loop still running (its `PAUSE`, marked `usage-cap`) and takes that pause away once the week
  resets, so the session carries on. The week is the loops' own reading (each session's rate-limit events, in its
  `state.json`); the user's sessions count too, so between lanes' sessions it can read low. Only a keeper started on this
  code enforces it on a loop already running; `lane-watch.js` says CAP as the week crosses each line.
- **Relaying the lanes** (the user's ask, 2026-10-30): the main session runs `node scripts/lane-watch.js` in the background.
  It exits as soon as a lane finishes a step (with the session's final message), its sessions look at new screenshots, a
  loop stops and stays stopped, the keeper says something, or the tapes recorder stops. The session relays what it printed
  (screenshots sent as files) and runs it again. `lane-watch.js status` shows every lane at a glance.
- **Steering a running lane:** write the direction in the lane's `.session-loop/notes.md` (gitignored, like the rest of that
  folder). Before every session (a resumed one too) the loop writes `protocol.md`, which the session starts with, as its
  hand-off rules and then that file, so a note reaches the lane's next session and outlives the keeper starting the loop
  again. A loop runs its own folder's `scripts/session-loop.js`, so sync a stopped lane (`lane.js sync <name>`) before
  starting it again; a loop started before that change (2026-10-28) wrote `protocol.md` once, when it started, so for it
  append the note to `protocol.md` as well. That's how the engine lost seven evening notes on 2026-10-28: they were only in
  `protocol.md` when the keeper restarted its loop at 9:32 PM. Put lasting direction in master's plan too, for the lane to sync.
- **Keep the PC awake.** The laptop sleeps after an hour idle on power, and nothing a lane runs asks it to stay up. The
  keeper holds it awake while it runs: it opens `scripts/keep-awake.ps1` minimized (a "Keep awake" window, `-WhilePid` its
  own process), which ends when the keeper's window is closed. Without a keeper, an unattended night needs keep-awake.ps1 in
  a window of its own (`-Until "<date> 12:00"` to end it by itself). It changes no setting, and closing the window ends it.
  The lid stays open: a closed lid still sleeps the laptop. On 2026-10-28 the night's window had ended at noon, and the PC
  slept from 4:12 to 5:49 PM while both lanes waited out a usage limit: the lanes, the bot and the recorder all stood
  still until a key woke it.

## Bring a step home

1. **Between steps**, the lane takes master in: `node scripts/lane.js sync <name>`. A lane's own session runs it at a step's
   start when its seed says so (the engine's and the desk's do); merges into master stay the user's.
2. **When the step is done** (its checks pass, and `/code-review` on its diff is clean), the user merges it into master from the
   main folder (`git merge engine`), runs the full check batch there, and pushes. The session loop never pushes or merges.
3. **Shared docs and memories** (HANDOFF.md, BACKLOG.md, the shared memories) are updated at that merge, not mid-step in a lane.

## Remove a lane

`node scripts/lane.js remove <name> --yes` takes out the worktree, its database and its links (the model's and the memory's;
never what they point to). The branch stays: `git branch -d <branch>` once it's merged.

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
