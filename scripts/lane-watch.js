// The lanes, watched for the main session (docs/PARALLEL-SESSIONS.md): what each lane's loop finished and every screenshot its
// sessions looked at, plus anything that stopped (a lane's loop, the keeper, the season tapes' recorder), so a main session
// can relay them as they happen and keep the lanes going overnight.
//
//   node scripts/lane-watch.js [--max-hours=3] [--every=60] [--quiet=4]   watch: polls every --every seconds and exits as soon
//        as there's something to say (printed), or after --max-hours with a HEARTBEAT; a main session runs it in the
//        background and runs it again after reading what it printed. New screenshots wait until none has come for --quiet
//        minutes, so a session's batch arrives together.
//   node scripts/lane-watch.js status      each lane now (running or not, its step, its last finished step); says nothing new
//   node scripts/lane-watch.js reset       forgets what's been said: the next watch starts from now
//
// What it prints, a block per event:
//   STEP <lane> | <step> | done <time> | $<cost> | next: <step or none> | log: <path>, then the session's final message
//        (its hand-off block left out), indented
//   SHOTS <lane> | <session> | <n> new, then each screenshot's full path, indented
//   KEEPER <a new line of .session-loop/keeper.log> (its "running" lines left out)
//   STOPPED <lane> | ... a lane whose loop was running and hasn't been for 15 minutes, with why (state.json: waiting for
//        the user, done, the weekly limit, a step handed off)
//   TAPES ... the recorder stopped, or its last three questions failed
//   HEARTBEAT ... nothing to say for --max-hours: each lane's state, one line each
//
// It remembers what it has said in .session-loop/lane-watch.json (this folder's, gitignored), so nothing is said twice and
// nothing is missed between two watches; the first watch starts from now. Windows only (the process list); reads files,
// writes only its own state file, and starts or stops nothing.
const fs = require("fs");
const path = require("path");
const { execFileSync, spawnSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const STATE = path.join(ROOT, ".session-loop", "lane-watch.json");
const KEEPER_LOG = path.join(ROOT, ".session-loop", "keeper.log");
const TAPES_JOURNAL = path.join(process.env.TAPES_DIR || path.join(require("os").homedir(), "rfl-tapes"), "journal.log");
const IMAGE = /\.(png|jpe?g|webp|gif)$/i;
const STOPPED_MIN = 15;

const args = process.argv.slice(2);
const flag = (name, dflt) => {
  const a = args.find((x) => x.startsWith(`--${name}=`));
  return a ? Number(a.split("=")[1]) : dflt;
};
const readJson = (f) => {
  try {
    return JSON.parse(fs.readFileSync(f, "utf8"));
  } catch {
    return null;
  }
};
const when = (iso) => (iso ? new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "?");

/** The worktrees beside this folder whose folder has a session loop's state: [{ name (its branch), dir }]. */
function lanes() {
  const out = execFileSync("git", ["-C", ROOT, "worktree", "list", "--porcelain"], { encoding: "utf8" });
  return out
    .split(/\r?\n\r?\n/)
    .map((block) => ({ dir: (block.match(/^worktree (.*)$/m) || [])[1], branch: (block.match(/^branch refs\/heads\/(.*)$/m) || [])[1] }))
    .filter((w) => w.dir && path.resolve(w.dir) !== path.resolve(ROOT) && fs.existsSync(path.join(w.dir, ".session-loop", "state.json")))
    .map((w) => ({ name: w.branch || path.basename(w.dir), dir: path.normalize(w.dir) }));
}

/** The command lines of the session loops and season-tapes recorders running now (with their parents'), lower case. */
function processes() {
  const r = spawnSync(
    "powershell.exe",
    ["-NoProfile", "-Command", "Get-CimInstance Win32_Process | Where-Object { $_.Name -in 'node.exe','powershell.exe','claude.exe' } | Select-Object ProcessId,ParentProcessId,Name,CommandLine | ConvertTo-Json -Compress"],
    { encoding: "utf8" },
  );
  if (r.status !== 0 || !r.stdout.trim()) return null;
  const all = [].concat(JSON.parse(r.stdout));
  const byId = new Map(all.map((p) => [p.ProcessId, p]));
  const norm = (s) => (s || "").replace(/\//g, "\\").toLowerCase();
  const line = (p) => `${norm(p.CommandLine)} ${norm(byId.get(p.ParentProcessId)?.CommandLine)}`;
  return {
    loops: all.filter((p) => (p.Name === "node.exe" && /session-loop\.js/.test(p.CommandLine || "")) || (p.Name === "claude.exe" && /protocol\.md/.test(p.CommandLine || ""))).map(line),
    keeper: all.some((p) => p.Name === "node.exe" && /lane\.js"?\s+keep\b/.test(p.CommandLine || "")),
    tapes: all.some((p) => p.Name === "node.exe" && /tapes\.js"?\s+record\b/.test(p.CommandLine || "")),
  };
}

/** A finished session's final message, its hand-off block left out (from the .jsonl beside its .txt log). */
function summaryOf(lane, entry) {
  const jsonl = path.join(lane.dir, String(entry.log || "").replace(/\.txt$/, ".jsonl"));
  let result = null;
  try {
    for (const line of fs.readFileSync(jsonl, "utf8").split(/\r?\n/)) {
      if (!line.includes('"type":"result"')) continue;
      try {
        const o = JSON.parse(line);
        if (o.type === "result") result = o;
      } catch {
        /* a partial line */
      }
    }
  } catch {
    return "(no log to read)";
  }
  const text = String(result?.result || "").replace(/```session-loop[\s\S]*$/, "").replace(/```\s*$/, "").trim();
  return text.length > 3000 ? `${text.slice(0, 3000)}…` : text || "(no final message)";
}

/** Every image under a lane's .session-loop/screens/, as paths relative to the lane. */
function screenshots(lane) {
  const dir = path.join(lane.dir, ".session-loop", "screens");
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const s of fs.readdirSync(dir)) {
    const sd = path.join(dir, s);
    if (!fs.statSync(sd).isDirectory()) continue;
    for (const f of fs.readdirSync(sd)) if (IMAGE.test(f)) out.push(path.join(".session-loop", "screens", s, f));
  }
  return out.sort();
}

/** Why a lane with no loop running isn't running, from its state.json (as the keeper words it). */
function whyStopped(state) {
  const week = state?.limits?.unifiedWindows?.seven_day;
  if (state?.pending?.question) return `waiting for you (${state.pending.name}): ${String(state.pending.question).split("\n")[0].slice(0, 200)}`;
  if (state?.pending) return `stopped partway through ${state.pending.name}`;
  if (!state?.next) return "done: nothing handed off";
  if (week && week.utilization >= 0.9 && week.resetsAt * 1000 > Date.now()) return `the weekly usage window is ${Math.round(week.utilization * 100)}% used, until ${new Date(week.resetsAt * 1000).toLocaleString()}`;
  return `stopped with ${state.next.name} handed off`;
}

function keeperLines() {
  try {
    return fs.readFileSync(KEEPER_LOG, "utf8").split(/\r?\n/).filter(Boolean);
  } catch {
    return [];
  }
}

function journalTail(n) {
  try {
    return fs.readFileSync(TAPES_JOURNAL, "utf8").split(/\r?\n/).filter(Boolean).slice(-n);
  } catch {
    return [];
  }
}

/** The state as of now, every lane's history, screenshots and keeper lines counted as said. */
function fresh() {
  const s = { lanes: {}, keeperLines: keeperLines().length, tapesRunning: null, tapesFailing: false };
  for (const l of lanes()) {
    const st = readJson(path.join(l.dir, ".session-loop", "state.json")) || {};
    s.lanes[l.name] = { history: (st.history || []).length, shots: screenshots(l), lastRunningAt: null, stopSaid: false };
  }
  return s;
}

/** One look: the events since the state, and the state after them. Pure but for reading the files and the process list. */
function look(state, now) {
  const events = [];
  const shots = [];
  const procs = processes();
  for (const l of lanes()) {
    const mem = (state.lanes[l.name] ||= { history: 0, shots: [], lastRunningAt: null, stopSaid: false });
    const st = readJson(path.join(l.dir, ".session-loop", "state.json")) || {};
    const history = st.history || [];
    for (const e of history.slice(mem.history)) {
      events.push(
        `STEP ${l.name} | ${e.name} | done ${when(e.at)} | $${Number(e.cost || 0).toFixed(2)} | next: ${st.next?.name || st.pending?.name || "none"} | log: ${path.join(l.dir, e.log || "")}\n` +
          summaryOf(l, e)
            .split("\n")
            .map((x) => `    ${x}`)
            .join("\n"),
      );
    }
    mem.history = history.length;
    const seen = new Set(mem.shots);
    const added = screenshots(l).filter((f) => !seen.has(f));
    if (added.length) shots.push({ lane: l, files: added });
    if (procs) {
      const running = procs.loops.some((c) => c.includes(`${l.dir.toLowerCase()}\\`));
      if (running) {
        mem.lastRunningAt = now;
        mem.stopSaid = false;
      } else if (mem.lastRunningAt && !mem.stopSaid && now - mem.lastRunningAt >= STOPPED_MIN * 60_000) {
        events.push(`STOPPED ${l.name} | no loop for ${Math.round((now - mem.lastRunningAt) / 60_000)} min | ${whyStopped(st)}`);
        mem.stopSaid = true;
      }
    }
  }
  const kl = keeperLines();
  for (const line of kl.slice(state.keeperLines)) if (!/:\s+running$/.test(line)) events.push(`KEEPER ${line}`);
  state.keeperLines = kl.length;
  if (procs) {
    if (state.keeperRunning && !procs.keeper) events.push("KEEPER the keeper (lane.js keep) isn't running any more");
    state.keeperRunning = procs.keeper;
    if (state.tapesRunning && !procs.tapes) events.push(`TAPES the recorder stopped; its journal ends:\n${journalTail(3).map((x) => `    ${x}`).join("\n")}`);
    state.tapesRunning = procs.tapes;
  }
  const tail = journalTail(3).filter((x) => !/^\S+\s+--/.test(x));
  const failing = tail.length === 3 && tail.every((x) => /\b(failed|GAVE UP|LIMITED)\b/.test(x));
  if (failing && !state.tapesFailing) events.push(`TAPES its last three questions failed:\n${tail.map((x) => `    ${x}`).join("\n")}`);
  state.tapesFailing = failing;
  return { events, shots };
}

function status() {
  const procs = processes();
  for (const l of lanes()) {
    const st = readJson(path.join(l.dir, ".session-loop", "state.json")) || {};
    const last = (st.history || []).slice(-1)[0];
    const running = procs ? procs.loops.some((c) => c.includes(`${l.dir.toLowerCase()}\\`)) : null;
    console.log(
      `${l.name.padEnd(14)} ${running ? "running " : running === false ? "stopped " : "?       "} ${running ? `now: ${st.pending?.name || "?"}` : whyStopped(st)}${last ? ` · last done: ${last.name} (${when(last.at)})` : ""}`,
    );
  }
  if (procs) console.log(`keeper ${procs.keeper ? "running" : "not running"} · tapes recorder ${procs.tapes ? "running" : "not running"}`);
}

async function watch() {
  const every = flag("every", 60) * 1000;
  const until = Date.now() + flag("max-hours", 3) * 3600_000;
  const quiet = flag("quiet", 4) * 60_000;
  let state = readJson(STATE);
  if (!state) {
    state = fresh();
    fs.mkdirSync(path.dirname(STATE), { recursive: true });
    fs.writeFileSync(STATE, JSON.stringify(state, null, 2));
  }
  const pending = new Map(); // lane name -> { lane, files: Set, lastAt }
  for (;;) {
    const now = Date.now();
    const { events, shots } = look(state, now);
    for (const s of shots) {
      const p = pending.get(s.lane.name) || { lane: s.lane, files: new Set(), lastAt: now };
      for (const f of s.files) if (!p.files.has(f)) {
        p.files.add(f);
        p.lastAt = now;
      }
      pending.set(s.lane.name, p);
    }
    const shotsDue = [...pending.values()].some((p) => now - p.lastAt >= quiet);
    if (events.length || (pending.size && (shotsDue || now >= until))) {
      const out = [...events];
      for (const p of pending.values()) {
        const bySession = new Map();
        for (const f of [...p.files].sort()) {
          const session = f.split(/[\\/]/)[2];
          bySession.set(session, [...(bySession.get(session) || []), f]);
        }
        for (const [session, files] of bySession) out.push(`SHOTS ${p.lane.name} | ${session} | ${files.length} new\n${files.map((f) => `    ${path.join(p.lane.dir, f)}`).join("\n")}`);
        state.lanes[p.lane.name].shots = [...new Set([...state.lanes[p.lane.name].shots, ...p.files])];
      }
      fs.writeFileSync(STATE, JSON.stringify(state, null, 2));
      console.log(out.join("\n\n"));
      return;
    }
    fs.writeFileSync(STATE, JSON.stringify(state, null, 2));
    if (now >= until) {
      console.log("HEARTBEAT nothing new; the lanes now:");
      status();
      return;
    }
    await new Promise((r) => setTimeout(r, every));
  }
}

if (require.main === module) {
  const cmd = args.find((a) => !a.startsWith("--"));
  if (cmd === "status") status();
  else if (cmd === "reset") {
    fs.rmSync(STATE, { force: true });
    console.log("Forgotten: the next watch starts from now.");
  } else
    watch().catch((e) => {
      console.error(e && e.stack ? e.stack : e);
      process.exit(1);
    });
}
