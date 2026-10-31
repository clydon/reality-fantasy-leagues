// The weekly usage cap for the session loops (the user, 2026-10-31: "pause all lanes at 75%", to keep the rest of the week
// for their own work until the weekly reset). The week is Claude's seven-day usage window, as the loops last saw it (each
// session's rate-limit events land in its lane's .session-loop/state.json while it runs); every session counts toward it,
// the user's own included, so between two lanes' sessions it can read a little low.
//   - From the cap less MARGIN (about one session at xhigh) no session starts: `session-loop.js` stops before its next one,
//     `lane.js start` refuses (--over-cap to start anyway), and `lane.js keep` restarts nothing and asks a running loop to
//     stop after its session (its STOP file), so the step under way finishes near the cap.
//   - At the cap, `lane.js keep` pauses a loop still running (its PAUSE file, the word "usage-cap" in it): the session stops
//     where it is and is kept, and once the window resets the keeper takes its PAUSE away again and the session carries on.
// The cap is the main folder's .session-loop/usage-cap.json ({ "weekly": 0.75 }), gitignored, so it changes without a
// commit; with no file it's 0.9, the loop's old stop, with no margin.
//
//   node scripts/usage-cap.js            the cap, the week as the loops last saw it, and whether a session may start now
//   node scripts/usage-cap.js set 75     set the cap (a percentage, or a fraction: 0.75)
//   node scripts/usage-cap.js off        take the cap file away (back to 0.9)
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const MARGIN = 0.02;
const DEFAULT = 0.9;
const PAUSE_MARK = "usage-cap";

const git = (...a) => execFileSync("git", a, { cwd: __dirname, encoding: "utf8" }).trim();
/** The main folder (the repository's own worktree), from any worktree's scripts folder. */
const mainDir = () => path.resolve(git("rev-parse", "--path-format=absolute", "--git-common-dir"), "..");
const capFile = () => path.join(mainDir(), ".session-loop", "usage-cap.json");

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

/** The seven-day window as the loops last saw it: the fullest reading of a window not yet reset, or null. */
function weekNow() {
  let best = null;
  for (const dir of loopDirs()) {
    try {
      const w = JSON.parse(fs.readFileSync(path.join(dir, "state.json"), "utf8")).limits?.unifiedWindows?.seven_day;
      if (w && w.resetsAt * 1000 > Date.now() && (!best || w.utilization > best.utilization)) best = w;
    } catch {
      /* no loop has run there */
    }
  }
  return best;
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

module.exports = { MARGIN, PAUSE_MARK, capOf, weekNow, check, pausedForCap, loopDirs };

if (require.main === module) {
  const [cmd, value] = process.argv.slice(2);
  if (cmd === "set") {
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
