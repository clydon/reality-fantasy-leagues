// Lanes: lines of work that run side by side (docs/PARALLEL-SESSIONS.md has the why and the rules). A lane is a git
// worktree beside this folder, on its own branch, with its own copy of the local database, its own dev-server port and its
// own session loop, so sessions in different lanes never share a file in flight, a database or a server.
//
//   node scripts/lane.js new <name> --port 3002 [--branch engine]
//                          ../rfl-<name> on a new branch from master (the branch defaults to the name), then `setup`
//   node scripts/lane.js setup <name> --port 3004
//                          for a worktree that exists (the sports one): the local database copied into rfl_<name>, its
//                          .env.local (this folder's, with the database, sign-in's port and the checks' BASE changed),
//                          .models/ linked to this folder's (the embedding model), then npm ci
//   node scripts/lane.js list                  every worktree: folder, branch, port, database, ahead/behind master, dirty
//   node scripts/lane.js check <name>          starts its dev server on its port (unless one answers there already), reads
//                                              the catalog (a database read) and the landing page, then stops what it started
//   node scripts/lane.js dev [<name>]          its dev server on its port, in this terminal (no name: this folder's lane)
//   node scripts/lane.js start <name> [--prompt-file <path> | --prompt "..."] [--max-sessions 3]
//                          a new window running the session loop in that lane at Opus / xhigh, to watch, pause (p) or stop
//                          (s); with no prompt it carries on from the lane's last hand-off
//   node scripts/lane.js sync <name>           merges master into the lane's branch (the loop's sessions can't merge);
//                                              refuses while the lane has uncommitted changes
//   node scripts/lane.js remove <name> --yes   takes the worktree out and drops its database; the branch stays (git branch
//                                              -d it once it's merged)
//   node scripts/lane.js memory <name>         links the lane's Claude memory to this folder's (setup does it too):
//                                              Claude keeps memory per folder (~/.claude/projects/<folder>/memory), so a
//                                              lane's sessions would otherwise start with none of this project's notes
//
// <name> is a lane's branch or its folder's name (engine, rfl-engine, sports). `new` and `setup` run from the main folder
// (the one on master): they copy its .env.local and its database, and only from a database on localhost. The copy runs
// inside the local Postgres container (survivor-draft-pg, or LANE_PG_CONTAINER) as the user in AUTH_DATABASE_URL.
// `start` opens a PowerShell window on Windows; elsewhere it prints the command to run.
const fs = require("fs");
const os = require("os");
const path = require("path");
const http = require("http");
const { spawn, spawnSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const CONTAINER = process.env.LANE_PG_CONTAINER || "survivor-draft-pg";
const WIN = process.platform === "win32";

const args = process.argv.slice(2);
const [cmd, nameArg] = [args[0], args[1] && !args[1].startsWith("--") ? args[1] : undefined];
const val = (flag) => {
  const i = args.indexOf(flag);
  return i > 0 ? args[i + 1] : undefined;
};
const has = (flag) => args.includes(flag);
const fail = (msg) => {
  console.error(`lane: ${msg}`);
  process.exit(1);
};

function run(command, argv, opts = {}) {
  const r = spawnSync(command, argv, { encoding: "utf8", ...opts });
  if (r.error) fail(`${command} ${argv.join(" ")}: ${r.error.message}`);
  if (r.status !== 0 && !opts.allowFail) fail(`${command} ${argv.join(" ")} failed:\n${(r.stderr || r.stdout || "").trim()}`);
  return r;
}
const git = (cwd, ...a) => run("git", a, { cwd }).stdout.trim();

// ---- .env.local, read and changed line by line (CRLF kept as it is) ----

const envValue = (text, key) => {
  const m = text.match(new RegExp(`^${key}=([^\\r\\n]*)`, "m"));
  return m ? m[1].trim().replace(/^"(.*)"$/, "$1") : null;
};
function setEnv(text, key, value) {
  const re = new RegExp(`^${key}=([^\\r\\n]*)`, "m");
  const m = text.match(re);
  if (m) return text.replace(re, `${key}=${/^"/.test(m[1].trim()) ? `"${value}"` : value}`);
  const nl = text.includes("\r\n") ? "\r\n" : "\n";
  return `${text.replace(/\s*$/, "")}${nl}${key}=${value}${nl}`;
}
const readEnv = (dir) => (fs.existsSync(path.join(dir, ".env.local")) ? fs.readFileSync(path.join(dir, ".env.local"), "utf8") : null);
const portOf = (env) => {
  const url = env && envValue(env, "BETTER_AUTH_URL");
  return url ? Number(new URL(url).port || 80) : null;
};
const dbOf = (env) => {
  const url = env && envValue(env, "AUTH_DATABASE_URL");
  return url ? new URL(url) : null;
};

// ---- worktrees ----

function worktrees() {
  const main = path.resolve(git(ROOT, "rev-parse", "--path-format=absolute", "--git-common-dir"), "..");
  return git(ROOT, "worktree", "list", "--porcelain")
    .split(/\r?\n\r?\n/)
    .filter(Boolean)
    .map((block) => {
      const line = (k) => (block.match(new RegExp(`^${k} (.*)$`, "m")) || [])[1];
      const dir = path.resolve(line("worktree"));
      const branch = (line("branch") || "").replace("refs/heads/", "") || null;
      return { dir, branch, main: dir.toLowerCase() === main.toLowerCase() };
    });
}
function laneOf(name) {
  const all = worktrees().filter((w) => !w.main);
  const base = (w) => path.basename(w.dir);
  const hit =
    all.find((w) => w.branch === name) ||
    all.find((w) => base(w) === name) ||
    all.find((w) => base(w) === `rfl-${name}`) ||
    all.find((w) => base(w).endsWith(`-${name}`));
  if (!hit) fail(`no lane called "${name}" (node scripts/lane.js list)`);
  return hit;
}
const dirty = (dir) => git(dir, "status", "--porcelain").split(/\r?\n/).filter(Boolean).length;
const dbName = (name) => `rfl_${name.replace(/[^a-z0-9]+/gi, "_").toLowerCase()}`;

// ---- the database copy, inside the container ----

function psql(user, db, sql) {
  return run("docker", ["exec", CONTAINER, "psql", "-U", user, "-d", db, "-Atc", sql]).stdout.trim();
}
function copyDatabase(user, from, to) {
  if (psql(user, from, `select count(*) from pg_database where datname = '${to}'`) !== "0")
    fail(`database ${to} exists already (drop it, or remove the lane that has it)`);
  run("docker", ["exec", CONTAINER, "createdb", "-U", user, to]);
  const r = run("docker", ["exec", CONTAINER, "sh", "-c", `pg_dump -U ${user} ${from} | psql -q -v ON_ERROR_STOP=1 -U ${user} ${to}`], { allowFail: true });
  if (r.status !== 0) {
    run("docker", ["exec", CONTAINER, "dropdb", "-U", user, to], { allowFail: true });
    fail(`copying ${from} into ${to} failed (dropped it again):\n${(r.stderr || "").trim()}`);
  }
  // A pg_dump that fails inside the pipe doesn't fail the pipe (the container's sh has no pipefail): compare the tables.
  const count = (db) => psql(user, db, "select count(*) from information_schema.tables where table_schema = 'public'");
  const [want, got] = [count(from), count(to)];
  if (want !== got) {
    run("docker", ["exec", CONTAINER, "dropdb", "-U", user, to], { allowFail: true });
    fail(`the copy has ${got} tables, ${from} has ${want} (dropped it again)`);
  }
  console.log(`  database ${to}: a copy of ${from} (${got} tables)`);
}

// ---- Claude's memory, shared ----

// Claude names a project's folder in ~/.claude/projects after the folder it runs in, every character that isn't a letter
// or digit a dash (Windows ignores the case). One link per lane, to this folder's memory, so every lane reads and writes
// the same notes. Only ever a link: removing it never touches the notes.
const PROJECTS = path.join(os.homedir(), ".claude", "projects");
const memoryOf = (dir) => path.join(PROJECTS, dir.replace(/[^A-Za-z0-9]/g, "-"), "memory");
function shareMemory(dir) {
  const mine = memoryOf(ROOT);
  if (!fs.existsSync(mine) || fs.lstatSync(mine).isSymbolicLink()) return console.log("  memory: this folder has none to share");
  const link = memoryOf(dir);
  if (fs.existsSync(link)) {
    const same = fs.lstatSync(link).isSymbolicLink() && path.resolve(fs.readlinkSync(link)).toLowerCase() === path.resolve(mine).toLowerCase();
    return console.log(same ? "  memory: shared already" : `  memory: ${link} exists and isn't a link to this folder's: left as it is`);
  }
  fs.mkdirSync(path.dirname(link), { recursive: true });
  fs.symlinkSync(mine, link, "junction");
  console.log("  memory: linked to the main folder's (Claude's notes for this project)");
}
function unshareMemory(dir) {
  const link = memoryOf(dir);
  if (fs.existsSync(link) && fs.lstatSync(link).isSymbolicLink()) fs.unlinkSync(link);
}

// ---- commands ----

function checkPort(port, dir) {
  if (!port || !Number.isInteger(port) || port < 1024) fail("--port <number> is needed (3001 and up; 3000 is the main folder's)");
  const taken = worktrees().filter((w) => w.dir !== dir).map((w) => portOf(readEnv(w.dir)) ?? (w.main ? 3000 : null));
  if (taken.includes(port)) fail(`port ${port} is another lane's`);
}

function setup(lane, name, port) {
  checkPort(port, lane.dir);
  const env = readEnv(ROOT);
  if (!env) fail("this folder has no .env.local to copy");
  const db = dbOf(env);
  if (!db || !["localhost", "127.0.0.1"].includes(db.hostname)) fail("AUTH_DATABASE_URL isn't a localhost database: refusing to copy it");
  if (readEnv(lane.dir)) fail(`${lane.dir} has a .env.local already: it's set up`);
  const to = dbName(name);
  copyDatabase(decodeURIComponent(db.username), db.pathname.slice(1), to);

  const url = envValue(env, "AUTH_DATABASE_URL").replace(/(\/\/[^/]+\/)[^?\s"]+/, `$1${to}`);
  let next = setEnv(env, "AUTH_DATABASE_URL", url);
  next = setEnv(next, "BETTER_AUTH_URL", `http://localhost:${port}`);
  next = setEnv(next, "BASE", `http://localhost:${port}`);
  fs.writeFileSync(path.join(lane.dir, ".env.local"), next);
  console.log(`  .env.local: database ${to}, sign-in and checks on port ${port}`);

  shareMemory(lane.dir);
  const models = path.join(ROOT, ".models");
  if (fs.existsSync(models) && !fs.existsSync(path.join(lane.dir, ".models"))) {
    fs.symlinkSync(models, path.join(lane.dir, ".models"), "junction");
    console.log("  .models: linked to the main folder's (the embedding model)");
  }
  console.log("  npm ci (a few minutes)...");
  const r = spawnSync("npm ci --no-audit --no-fund", { cwd: lane.dir, shell: true, stdio: "inherit" });
  if (r.status !== 0) fail("npm ci failed: run it again in the lane's folder");
  console.log(`\nLane ${name} is ready: ${lane.dir} (branch ${lane.branch}, port ${port}, database ${to}).`);
  console.log(`Check it: node scripts/lane.js check ${name}`);
}

function list() {
  const rows = worktrees().map((w) => {
    const env = readEnv(w.dir);
    const db = dbOf(env);
    let ahead = "";
    if (w.branch && w.branch !== "master") {
      const [behind, on] = git(ROOT, "rev-list", "--left-right", "--count", `master...${w.branch}`).split(/\s+/);
      ahead = `${on} ahead, ${behind} behind master`;
    }
    const n = fs.existsSync(w.dir) ? dirty(w.dir) : 0;
    return [path.basename(w.dir), w.branch || "(detached)", w.main ? "3000" : String(portOf(env) ?? "not set up"), db ? db.pathname.slice(1) : "-", w.main ? "main" : ahead, n ? `${n} uncommitted` : "clean"];
  });
  const widths = rows[0].map((_, i) => Math.max(...rows.map((r) => r[i].length)));
  for (const r of rows) console.log(r.map((c, i) => c.padEnd(widths[i])).join("  "));
}

function answers(port, route, ms = 8000) {
  return new Promise((resolve) => {
    const req = http.get({ host: "localhost", port, path: route, timeout: ms }, (res) => {
      res.resume();
      resolve(res.statusCode);
    });
    req.on("timeout", () => req.destroy());
    req.on("error", () => resolve(null));
  });
}
const killTree = (child) => {
  if (WIN) spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
  else process.kill(-child.pid, "SIGTERM");
};

async function check(lane) {
  const port = portOf(readEnv(lane.dir));
  if (!port) fail(`${lane.dir} isn't set up (node scripts/lane.js setup <name> --port <n>)`);
  let child = null;
  if ((await answers(port, "/api/catalog", 3000)) === null) {
    console.log(`starting its dev server on ${port}...`);
    child = spawn(`npm run dev -- -p ${port}`, { cwd: lane.dir, shell: true, detached: !WIN, stdio: "ignore" });
  }
  const until = Date.now() + 240000;
  let catalog = null;
  while (Date.now() < until && catalog !== 200) {
    catalog = await answers(port, "/api/catalog", 60000);
    if (catalog !== 200) await new Promise((r) => setTimeout(r, 3000));
  }
  const landing = catalog === 200 ? await answers(port, "/", 60000) : null;
  if (child) killTree(child);
  const ok = catalog === 200 && landing !== null && landing < 400;
  console.log(`${ok ? "PASS" : "FAIL"} ${path.basename(lane.dir)} on ${port}: /api/catalog ${catalog ?? "no answer"}, / ${landing ?? "no answer"}`);
  if (!ok) process.exit(1);
}

function dev(lane) {
  const dir = lane ? lane.dir : process.cwd();
  const port = portOf(readEnv(dir));
  if (!port) fail(`${dir} has no BETTER_AUTH_URL port in its .env.local`);
  spawnSync(`npm run dev -- -p ${port}`, { cwd: dir, shell: true, stdio: "inherit" });
}

function start(lane, name) {
  const loopDir = path.join(lane.dir, ".session-loop");
  fs.mkdirSync(loopDir, { recursive: true });
  const max = Number(val("--max-sessions") ?? 3);
  const loop = ["scripts/session-loop.js", "--model", "opus", "--effort", "xhigh", "--max-sessions", String(max)];
  if (val("--prompt-file")) loop.push("--prompt-file", path.resolve(val("--prompt-file")));
  else if (val("--prompt")) {
    const file = path.join(loopDir, `seed-${Date.now()}.md`);
    fs.writeFileSync(file, val("--prompt"));
    loop.push("--prompt-file", file);
  }
  const quote = (s) => (/^[\w./:\\-]+$/.test(s) ? s : `'${s.replace(/'/g, "''")}'`);
  const line = `node ${loop.map(quote).join(" ")}`;
  if (!WIN) {
    console.log(`In a new terminal:\n  cd ${lane.dir}\n  ${line}`);
    return;
  }
  const ps1 = path.join(loopDir, "lane-window.ps1");
  fs.writeFileSync(
    ps1,
    [
      `$Host.UI.RawUI.WindowTitle = 'Lane ${name}: session loop'`,
      `Set-Location -LiteralPath '${lane.dir.replace(/'/g, "''")}'`,
      `Write-Host 'Lane ${name} (${lane.branch}). Keys while a session runs: p pause, s stop after it, q quit.'`,
      line,
    ].join("\r\n"),
  );
  spawn("cmd.exe", ["/c", "start", `Lane ${name}`, "powershell.exe", "-NoExit", "-ExecutionPolicy", "Bypass", "-File", ps1], {
    detached: true,
    stdio: "ignore",
  }).unref();
  console.log(`Opened a window for lane ${name}, running: ${line}`);
}

function sync(lane) {
  const n = dirty(lane.dir);
  if (n) fail(`${path.basename(lane.dir)} has ${n} uncommitted changes: commit them (or let its session finish) first`);
  const r = run("git", ["merge", "master", "--no-edit"], { cwd: lane.dir, allowFail: true });
  console.log((r.stdout || r.stderr).trim());
  if (r.status !== 0) fail("the merge stopped (conflicts?): resolve them in the lane's folder, or `git merge --abort` there");
}

function remove(lane) {
  if (!has("--yes")) fail("this takes the worktree out and drops its database: add --yes");
  const n = dirty(lane.dir);
  if (n && !has("--force")) fail(`${path.basename(lane.dir)} has ${n} uncommitted changes (--force to throw them away)`);
  const db = dbOf(readEnv(lane.dir));
  const models = path.join(lane.dir, ".models");
  if (fs.existsSync(models) && fs.lstatSync(models).isSymbolicLink()) fs.unlinkSync(models); // the link, never the model
  unshareMemory(lane.dir); // the link, never the notes
  run("git", ["worktree", "remove", ...(n ? ["--force"] : []), lane.dir], { cwd: ROOT });
  if (db && ["localhost", "127.0.0.1"].includes(db.hostname) && db.pathname.slice(1).startsWith("rfl_"))
    run("docker", ["exec", CONTAINER, "dropdb", "-U", decodeURIComponent(db.username), "--if-exists", db.pathname.slice(1)]);
  console.log(`Removed ${lane.dir}${db ? ` and database ${db.pathname.slice(1)}` : ""}. The branch ${lane.branch} stays.`);
}

(async () => {
  if (cmd === "new") {
    if (!nameArg) fail("new <name> --port <n> [--branch <b>]");
    const branch = val("--branch") || nameArg;
    const dir = path.join(path.dirname(ROOT), `rfl-${nameArg}`);
    if (fs.existsSync(dir)) fail(`${dir} exists already`);
    checkPort(Number(val("--port")), dir);
    git(ROOT, "worktree", "add", dir, "-b", branch, "master");
    console.log(`  worktree ${dir} on a new branch ${branch}, from master`);
    setup({ dir, branch }, nameArg, Number(val("--port")));
  } else if (cmd === "setup") setup(laneOf(nameArg), nameArg, Number(val("--port")));
  else if (cmd === "list") list();
  else if (cmd === "check") await check(laneOf(nameArg));
  else if (cmd === "dev") dev(nameArg ? laneOf(nameArg) : null);
  else if (cmd === "start") start(laneOf(nameArg), nameArg);
  else if (cmd === "sync") sync(laneOf(nameArg));
  else if (cmd === "remove") remove(laneOf(nameArg));
  else if (cmd === "memory") shareMemory(laneOf(nameArg).dir);
  else {
    console.log(fs.readFileSync(__filename, "utf8").split("\nconst fs")[0].replace(/^\/\/ ?/gm, ""));
    process.exit(cmd ? 1 : 0);
  }
})();
