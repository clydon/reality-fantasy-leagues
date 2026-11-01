// The weekly usage cap for the session loops (the user, 2026-10-31: "pause all lanes at 75%", to keep the rest of the week
// for their own work until the weekly reset). The week is Claude's seven-day usage window: the fullest reading of it the
// loops have (each session's rate-limit events land in its lane's .session-loop/state.json while it runs) or a probe took.
// Every session counts toward it, the user's own included, so the loops' readings go stale while only the user works: on
// 2026-11-01 they still said 66% when a probe found 88%. So `lane.js start` probes first, and `keep` before a restart.
//   - From the cap less MARGIN (about one session at xhigh) no session starts: `session-loop.js` stops before its next one,
//     `lane.js start` refuses (--over-cap to start anyway), and `lane.js keep` restarts nothing and asks a running loop to
//     stop after its session (its STOP file), so the step under way finishes near the cap.
//   - At the cap, `lane.js keep` pauses a loop still running (its PAUSE file, the word "usage-cap" in it): the session stops
//     where it is and is kept, and once the window resets the keeper takes its PAUSE away again and the session carries on.
// The cap is the main folder's .session-loop/usage-cap.json ({ "weekly": 0.75 }), gitignored, so it changes without a
// commit; with no file it's 0.9, the loop's old stop, with no margin.
//
//   node scripts/usage-cap.js            the cap, the week as last read, and whether a session may start now
//   node scripts/usage-cap.js probe      read the week now (a one-line Haiku ask, under a cent) and keep the reading in the
//                                        main folder's .session-loop/usage-week.json
//   node scripts/usage-cap.js set 75     set the cap (a percentage, or a fraction: 0.75)
//   node scripts/usage-cap.js off        take the cap file away (back to 0.9)
const fs = require("fs");
const path = require("path");
const { execFileSync, spawnSync } = require("child_process");

const MARGIN = 0.02;
const DEFAULT = 0.9;
const PAUSE_MARK = "usage-cap";

const git = (...a) => execFileSync("git", a, { cwd: __dirname, encoding: "utf8" }).trim();
/** The main folder (the repository's own worktree), from any worktree's scripts folder. */
const mainDir = () => path.resolve(git("rev-parse", "--path-format=absolute", "--git-common-dir"), "..");
const capFile = () => path.join(mainDir(), ".session-loop", "usage-cap.json");
const readingFile = () => path.join(mainDir(), ".session-loop", "usage-week.json");

/** { weekly, stopAt, set }: the cap and where sessions stop starting. */
function capOf() {
  try {
    const c = JSON.parse(fs.readFileSync(capFile(), "utf8"));
    if (c.weekly > 0 && c.weekly <= 1) return { weekly: c.weekly, stopAt: Math.max(0, c.weekly - MARGIN), set: c.set ?? null };
  } catch {
    /* no cap file */
  }
  return { weekly: DEFAULT, stopAt: DEFAULT, set: null };
}

/** Every worktree's .session-loop folder (the main folder's included). */
function loopDirs() {
  return git("worktree", "list", "--porcelain")
    .split(/\r?\n/)
    .filter((l) => l.startsWith("worktree "))
    .map((l) => path.join(path.resolve(l.slice(9)), ".session-loop"));
}

/** The seven-day window: the fullest reading of a window not yet reset (the loops' and the last probe's), or null. */
function weekNow() {
  let best = null;
  for (const file of [...loopDirs().map((dir) => path.join(dir, "state.json")), readingFile()]) {
    try {
      const w = JSON.parse(fs.readFileSync(file, "utf8")).limits?.unifiedWindows?.seven_day;
      if (w && w.resetsAt * 1000 > Date.now() && (!best || w.utilization > best.utilization)) best = w;
    } catch {
      /* no loop has run there, or no probe yet */
    }
  }
  return best;
}

/** Reads the week now: a one-line Haiku ask whose rate-limit event carries it, kept as { limits } in usage-week.json (the
 *  shape of a loop's state.json). The seven-day reading, or null when the ask gave none (it's then left as it was). */
function probe() {
  const r = spawnSync("claude", ["-p", "--model", "haiku", "--output-format", "stream-json", "--verbose"], {
    input: "Reply with the single word OK.",
    encoding: "utf8",
    timeout: 120_000,
    windowsHide: true,
  });
  let info = null;
  for (const line of String(r.stdout || "").split(/\r?\n/)) {
    try {
      const e = JSON.parse(line);
      if (e.type === "rate_limit_event" && e.rate_limit_info?.unifiedWindows) info = e.rate_limit_info;
    } catch {
      /* not an event */
    }
  }
  if (!info) return null;
  fs.mkdirSync(path.dirname(readingFile()), { recursive: true });
  fs.writeFileSync(readingFile(), `${JSON.stringify({ limits: { ...info, at: new Date().toISOString() } }, null, 2)}\n`);
  return info.unifiedWindows.seven_day ?? null;
}

const pct = (x) => `${Math.round(x * 100)}%`;
const until = (w) => new Date(w.resetsAt * 1000).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

/** { cap, week, stop (no session starts), pause (running ones pause), line (in words) }. */
function check() {
  const cap = capOf();
  const week = weekNow();
  const u = week ? week.utilization : 0;
  const stop = !!week && u >= cap.stopAt;
  const pause = !!week && u >= cap.weekly;
  const line = week
    ? `the week is ${pct(u)} used (sessions stop starting at ${pct(cap.stopAt)}, the cap is ${pct(cap.weekly)}; it resets ${until(week)})`
    : `no reading of this week yet (the cap is ${pct(cap.weekly)})`;
  return { cap, week, stop, pause, line };
}

/** Whether a loop folder's PAUSE was written by a keeper for the cap (so only those are taken away at the reset). */
const pausedForCap = (dir) => {
  try {
    return fs.readFileSync(path.join(dir, "PAUSE"), "utf8").startsWith(PAUSE_MARK);
  } catch {
    return false;
  }
};

module.exports = { MARGIN, PAUSE_MARK, capOf, weekNow, probe, check, pausedForCap, loopDirs };

if (require.main === module) {
  const [cmd, value] = process.argv.slice(2);
  if (cmd === "probe") {
    if (!probe()) console.log("The probe got no usage reading (claude signed out, or no rate-limit event): the last reading stands.");
  } else if (cmd === "set") {
    let weekly = Number(value);
    if (weekly > 1) weekly /= 100;
    if (!(weekly > 0 && weekly <= 1)) throw new Error("set <percentage>, e.g. set 75");
    fs.mkdirSync(path.dirname(capFile()), { recursive: true });
    fs.writeFileSync(capFile(), `${JSON.stringify({ weekly, set: new Date().toISOString() }, null, 2)}\n`);
  } else if (cmd === "off") fs.rmSync(capFile(), { force: true });
  else if (cmd) throw new Error("usage-cap.js [set <percentage> | off]");
  const c = check();
  console.log(`${c.line}\n${c.pause ? "Past the cap: running loops pause." : c.stop ? "No session starts now." : "Sessions may start."}`);
}
