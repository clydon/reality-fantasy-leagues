// Runs the project's work one Claude Code session after another, unattended: each session does one step (or one part of
// a step that's multipart by design or turns out too big), ends with the seed prompt it would have handed you, and the
// next session starts from it. It stops only where a session would have paused to ask you something; you answer in this
// terminal and that same session carries on. You can pause it at any moment and resume the same session later.
//
//   node scripts/session-loop.js                     carry on (a paused or waiting session first, else the last hand-off)
//   node scripts/session-loop.js --prompt "..."      start from this prompt   (or --prompt-file <path>)
//     --model opus --effort high                     for the first session (later ones use what each hand-off says)
//     --max-sessions 5                               stop after this many (default 20)
//     --budget-usd 40                                a cap per session (claude --max-budget-usd)
//     --pause-at 0.9                                 before a session, wait while the 5-hour usage window is this full
//                                                    (default 0.9; 1 turns it off)
//     --permission-mode auto                         auto (default) | acceptEdits | bypassPermissions | ...
//     --thinking                                     show thinking too
//     --dry-run                                      print what would run, run nothing
//
//   From another terminal:  node scripts/session-loop.js pause | resume | stop | status
//
// While a session runs, in this terminal:  p  pause now   ·   s  stop after this session   ·   q (or Ctrl+C)  quit now.
// Pausing ends the running session where it is (its tool calls stop too) and keeps it: Enter resumes the same session,
// or type a message to send it instead. Quitting keeps it the same way: the next run offers to resume it. `pause` from
// another terminal (a .session-loop/PAUSE file) pauses the same way and `resume` lets it go on. A session that runs into
// a usage limit pauses itself and resumes when the limit resets (a weekly limit stops the loop and says when).
//
// Output: each session's messages and a line per tool call print here as they happen; the raw events go to
// .session-loop/logs/<time>-<name>.jsonl and a readable copy to the .txt beside it (gitignored). Every session is saved,
// so `claude --resume <id>` opens one in the usual app (its id is in its header line).
//
// How a session hands off: it's started with --append-system-prompt-file .session-loop/protocol.md (written here), so it
// ends its final message with a ```session-loop block: {"status":"next","prompt":...,"model":...,"effort":...},
// {"status":"needs_input","question":...} or {"status":"done","reason":...}. AskUserQuestion is switched off (nobody's
// there to answer mid-session) and pushing or merging is refused, whatever a prompt says: the loop never ships anything.
// Needs the `claude` CLI on PATH, signed in. Windows, macOS and Linux.
const fs = require("fs");
const path = require("path");
const readline = require("readline");
const { spawn, spawnSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
// SESSION_LOOP_DIR: somewhere else for its state and logs (a test run, a second loop).
const DIR = process.env.SESSION_LOOP_DIR ? path.resolve(process.env.SESSION_LOOP_DIR) : path.join(ROOT, ".session-loop");
const LOGS = path.join(DIR, "logs");
const STATE = path.join(DIR, "state.json");
const PROTOCOL = path.join(DIR, "protocol.md");
const STOP = path.join(DIR, "STOP");
const PAUSE = path.join(DIR, "PAUSE");

const EFFORTS = ["low", "medium", "high", "xhigh", "max"];
// Never from the loop, whatever a prompt says: shipping is the user's call (CLAUDE.md, the plan's Rules).
const DENIED = ["AskUserQuestion", "Bash(git push:*)", "Bash(git merge:*)", "PowerShell(git push:*)", "PowerShell(git merge:*)"];
const CARRY_ON =
  "Carry on where you left off. You were stopped mid-task (paused by the user, or by a usage limit), possibly in the middle of a command or an edit: check `git status` and anything that was running before going on.";

const PROTOCOL_TEXT = `# Running in the session loop

This session was started by scripts/session-loop.js, which runs this project's work one session after another without
the user at the keyboard. They read your output as it happens or later, so write your messages as you normally would.
They can pause you at any moment and resume this same session later.

- Work through the task in the prompt to its natural stopping point: the end of the step, or the end of a part when the
  step is multipart by design or turns out too big for one session. Finish it properly, as the prompt and the project's
  rules say (checks passing, docs and memory updated, committed on the branch).
- Decide what you'd normally decide yourself, with sensible defaults, and say what you decided in your final message.
  Stop for the user only where you'd normally pause to ask them: a decision that's genuinely theirs, anything
  outward-facing or hard to reverse (pushing, merging, deploying, production data), a permission you were refused, or
  something broken you can't fix. Pushing and merging are refused in this mode anyway.
- You can't ask mid-session: AskUserQuestion isn't available. To ask, finish what you safely can, then end with a
  needs_input block; the user's answer comes back into this same session as the next message.
- End your final message with exactly one block, as the last thing in it:

\`\`\`session-loop
{"status": "next", "name": "Step 6c", "model": "opus", "effort": "medium", "prompt": "<the full seed prompt for the next session>"}
\`\`\`

  - "next": this session's work is done and committed. \`prompt\` is the seed prompt you'd have given the user for a fresh
    session (the same one you'd write anyway: the branch, what to read, what to cover, what to keep passing, what not to
    do), \`name\` a short label for it, and \`model\` / \`effort\` the ones you recommend for it.
  - "needs_input": {"status": "needs_input", "question": "<what you need from the user, with your recommendation>"}.
  - "done": {"status": "done", "reason": "<why there's nothing left to start>"}.

  The block is one line of valid JSON: escape newlines in strings as \\n.
`;

// ---- state and the commands for another terminal ----

const readState = () => {
  try {
    return { next: null, pending: null, history: [], limits: null, ...JSON.parse(fs.readFileSync(STATE, "utf8")) };
  } catch {
    return { next: null, pending: null, history: [], limits: null };
  }
};
const writeState = (s) => fs.writeFileSync(STATE, JSON.stringify(s, null, 2));

function command(cmd) {
  fs.mkdirSync(DIR, { recursive: true });
  if (cmd === "pause") {
    fs.writeFileSync(PAUSE, new Date().toISOString());
    console.log("Pausing: the running session stops in a moment and waits. `node scripts/session-loop.js resume` lets it go on.");
  } else if (cmd === "resume") {
    if (fs.existsSync(PAUSE)) fs.rmSync(PAUSE);
    console.log("Resuming (if the loop is running). If it isn't, start it again: node scripts/session-loop.js");
  } else if (cmd === "stop") {
    fs.writeFileSync(STOP, new Date().toISOString());
    console.log("The loop stops after the session that's running.");
  } else {
    const s = readState();
    const total = s.history.reduce((t, h) => t + (h.cost || 0), 0);
    console.log(`Sessions run: ${s.history.length} · $${total.toFixed(2)}`);
    for (const h of s.history.slice(-5)) console.log(`  ${h.at.slice(0, 16).replace("T", " ")}  ${h.name}  $${(h.cost || 0).toFixed(2)}  ${h.sessionId ?? ""}`);
    if (s.pending) console.log(`Waiting: ${s.pending.name} (${s.pending.sessionId}) · ${s.pending.paused ? "paused" : s.pending.question ? "has a question for you" : "stopped"}`);
    if (s.next) console.log(`Next: ${s.next.name} · ${s.next.model} · ${s.next.effort}`);
    if (s.limits) console.log(`Usage: ${limitLine(s.limits)}`);
    if (fs.existsSync(PAUSE)) console.log("PAUSE is set: the loop is paused.");
    if (fs.existsSync(STOP)) console.log("STOP is set: the loop stops after the current session.");
  }
}

// ---- output ----

const tty = process.stdout.isTTY;
const paint = (code) => (s) => (tty ? `\x1b[${code}m${s}\x1b[0m` : s);
const dim = paint("2");
const bold = paint("1");
const red = paint("31");
const green = paint("32");
const yellow = paint("33");
const clock = (d = new Date()) => d.toTimeString().slice(0, 5);
const oneLine = (s, n = 110) => {
  const t = String(s ?? "").replace(/\s+/g, " ").trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
};
const pct = (u) => `${Math.round((u || 0) * 100)}%`;
const limitLine = (l) => {
  const w = l.unifiedWindows || {};
  return [w.five_hour && `5-hour ${pct(w.five_hour.utilization)}`, w.seven_day && `weekly ${pct(w.seven_day.utilization)}`].filter(Boolean).join(" · ") || l.status || "";
};
const inMinutes = (ts) => Math.max(0, Math.round((ts * 1000 - Date.now()) / 60000));

/** A tool call in one line: what it touches, not its whole input. */
function toolLine(name, input = {}) {
  const file = input.file_path || input.notebook_path || input.path;
  const what =
    input.description ||
    (file && path.relative(ROOT, String(file)).replace(/\\/g, "/")) ||
    input.command ||
    input.pattern ||
    input.query ||
    input.prompt ||
    input.url ||
    input.skill ||
    "";
  return `${name}${what ? `: ${oneLine(what)}` : ""}`;
}

// ---- keys while a session runs: p pause, s stop after this one, q / Ctrl+C quit ----

// byFile: the pause came from a PAUSE file (`pause` in another terminal), so `resume` removing it lets it go on.
const ctl = { pause: false, byFile: false, stopAfter: false, quit: false, child: null, keys: false };

function onKey(_str, key = {}) {
  if (!key) return;
  if (key.ctrl && key.name === "c") key = { name: "q" };
  if (key.name === "p" && !ctl.pause) {
    ctl.pause = true;
    ctl.byFile = !!key.byFile;
    console.log(yellow(`\n[${clock()}] Pausing: stopping the session where it is…`));
    killTree(ctl.child);
  } else if (key.name === "s") {
    ctl.stopAfter = !ctl.stopAfter;
    console.log(yellow(ctl.stopAfter ? `\n[${clock()}] The loop stops after this session (s again to undo).` : `\n[${clock()}] It carries on after this session.`));
  } else if (key.name === "q") {
    ctl.quit = true;
    console.log(yellow(`\n[${clock()}] Quitting: stopping the session where it is (the next run offers to resume it)…`));
    killTree(ctl.child);
  }
}

function keysOn() {
  if (!process.stdin.isTTY || ctl.keys) return;
  readline.emitKeypressEvents(process.stdin);
  process.stdin.setRawMode(true);
  process.stdin.on("keypress", onKey);
  process.stdin.resume();
  ctl.keys = true;
}
function keysOff() {
  if (!ctl.keys) return;
  process.stdin.off("keypress", onKey);
  process.stdin.setRawMode(false);
  process.stdin.pause();
  ctl.keys = false;
}

/** The session and everything it started (a check script, a background shell), so a pause leaves nothing running. */
function killTree(child) {
  if (!child || child.exitCode !== null) return;
  if (process.platform === "win32") spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
  else {
    try {
      process.kill(-child.pid, "SIGTERM");
    } catch {
      child.kill("SIGTERM");
    }
  }
}

/** A line typed in this terminal (keys off while it's asked). `until`: also resolve with null once it says so. */
function ask(question, { until } = {}) {
  keysOff();
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    let done = false;
    const finish = (v) => {
      if (done) return;
      done = true;
      clearInterval(timer);
      rl.close();
      resolve(v);
    };
    const timer = until ? setInterval(() => until() && (console.log(""), finish(null)), 1500) : null;
    rl.on("SIGINT", () => finish("q"));
    rl.question(question, (answer) => finish(answer.trim()));
  });
}

// ---- one session ----

/**
 * Runs `claude -p` with the prompt on stdin (a new session, or `resume`d), printing it as it goes and logging every
 * event. Resolves { sessionId, result, cost, error, paused, quit, limit }.
 */
function runSession({ prompt, model, effort, name, resume, opts, logBase, onLimits, onSession }) {
  const cli = ["-p", "--output-format", "stream-json", "--verbose", "--permission-mode", opts.permissionMode, "--permission-prompts", "none"];
  cli.push("--append-system-prompt-file", PROTOCOL, "--disallowedTools", ...DENIED);
  if (model) cli.push("--model", model);
  if (effort) cli.push("--effort", effort);
  if (opts.budget) cli.push("--max-budget-usd", String(opts.budget));
  if (resume) cli.push("--resume", resume);
  else if (name) cli.push("--name", name);
  if (opts.dryRun) {
    console.log(dim(`claude ${cli.map((x) => (/\s/.test(x) ? JSON.stringify(x) : x)).join(" ")}  < prompt (${prompt.length} chars)`));
    return Promise.resolve({ sessionId: null, result: '```session-loop\n{"status":"done","reason":"dry run"}\n```', cost: 0, error: null });
  }

  const raw = fs.createWriteStream(`${logBase}.jsonl`, { flags: "a" });
  const text = fs.createWriteStream(`${logBase}.txt`, { flags: "a" });
  const say = (line, plain = line) => {
    console.log(line);
    text.write(`${plain}\n`);
  };
  say(dim(`\n> ${oneLine(prompt, 400)}\n`), `\n> ${prompt}\n`);

  return new Promise((resolve) => {
    const child = spawn("claude", cli, { cwd: ROOT, stdio: ["pipe", "pipe", "pipe"], windowsHide: true, detached: process.platform !== "win32" });
    ctl.child = child;
    keysOn();
    let sessionId = resume ?? null;
    let final = null;
    let limited = null;
    let errText = "";
    child.stdin.end(prompt);
    child.stderr.on("data", (d) => (errText += d));
    // `pause` / `stop` from another terminal.
    const files = setInterval(() => {
      if (fs.existsSync(PAUSE) && !ctl.pause) onKey("p", { name: "p", byFile: true });
      if (fs.existsSync(STOP) && !ctl.stopAfter) {
        ctl.stopAfter = true;
        console.log(yellow(`\n[${clock()}] STOP set: the loop stops after this session.`));
      }
    }, 1500);
    const lines = readline.createInterface({ input: child.stdout });
    lines.on("line", (line) => {
      raw.write(`${line}\n`);
      let e;
      try {
        e = JSON.parse(line);
      } catch {
        return;
      }
      if (e.type === "rate_limit_event" && e.rate_limit_info) {
        onLimits(e.rate_limit_info);
        if (e.rate_limit_info.status !== "allowed") limited = e.rate_limit_info;
      } else if (e.type === "system" && e.subtype === "init") {
        sessionId = e.session_id;
        onSession(sessionId);
        say(dim(`[${clock()}] session ${sessionId} · ${e.model ?? model ?? ""}${effort ? ` · ${effort}` : ""}   (p pause · s stop after this · q quit)`));
      } else if (e.type === "assistant") {
        for (const c of e.message?.content ?? []) {
          if (c.type === "text" && c.text.trim()) say(`\n${c.text.trim()}\n`);
          else if (c.type === "thinking" && opts.thinking && c.thinking) say(dim(c.thinking.trim()));
          else if (c.type === "tool_use") say(dim(`[${clock()}]   ▸ ${toolLine(c.name, c.input)}`));
        }
      } else if (e.type === "user") {
        for (const c of e.message?.content ?? []) {
          if (c.type !== "tool_result" || !c.is_error) continue;
          const body = Array.isArray(c.content) ? c.content.map((x) => x.text ?? "").join(" ") : c.content;
          say(red(`            ✗ ${oneLine(body)}`), `            ✗ ${oneLine(body)}`);
        }
      } else if (e.type === "result") {
        final = e;
      }
    });
    child.on("close", (code) => {
      clearInterval(files);
      ctl.child = null;
      raw.end();
      const cost = final?.total_cost_usd ?? 0;
      const mins = final?.duration_ms ? Math.round(final.duration_ms / 60000) : null;
      const paused = ctl.pause || ctl.quit;
      say(dim(`[${clock()}] ${paused ? "stopped" : "ended"}${mins != null ? ` after ${mins} min` : ""} · $${cost.toFixed(2)} · ${final?.num_turns ?? "?"} turns`));
      text.end();
      const failed = final?.is_error || (code !== 0 && !paused);
      const why = oneLine(final?.result || errText || `claude exited with ${code}`, 300);
      // A usage limit: the CLI said so in its stream, or its error says so.
      const limit = failed && (limited || /usage limit|rate limit|limit reached|resets? at/i.test(why)) ? (limited ?? { resetsAt: null }) : null;
      resolve({
        sessionId: final?.session_id ?? sessionId,
        result: final?.result ?? "",
        cost,
        error: failed && !limit ? why : null,
        paused: ctl.pause && !ctl.quit,
        quit: ctl.quit,
        limit,
      });
    });
  });
}

/** The hand-off at the end of a session's final message: the last ```session-loop block, parsed. */
function handOff(result) {
  const blocks = [...String(result).matchAll(/```session-loop\s*\n([\s\S]*?)\n\s*```/g)];
  if (!blocks.length) return null;
  try {
    const h = JSON.parse(blocks[blocks.length - 1][1].trim());
    return h && typeof h === "object" && ["next", "needs_input", "done"].includes(h.status) ? h : null;
  } catch {
    return null;
  }
}

const devServerUp = async () => {
  try {
    const r = await fetch("http://localhost:3000/", { signal: AbortSignal.timeout(4000) });
    return r.status < 500;
  } catch {
    return false;
  }
};

/** Waits until `ts` (epoch seconds), saying so; Enter goes now, q quits. Resolves "go" or "quit". */
async function waitUntil(ts, why) {
  const at = ts ? new Date(ts * 1000) : null;
  console.log(yellow(`\n${why}${at ? ` Waiting until ${clock(at)} (${inMinutes(ts)} min).` : " Waiting 30 min."}`));
  const end = at ? at.getTime() + 60_000 : Date.now() + 30 * 60_000;
  const answer = await ask(dim("Enter to try now, q to quit: "), { until: () => Date.now() >= end });
  return answer === "q" ? "quit" : "go";
}

// ---- the loop ----

function args() {
  const a = process.argv.slice(2);
  const val = (name) => {
    const i = a.indexOf(name);
    return i >= 0 ? a[i + 1] : undefined;
  };
  const o = {
    prompt: val("--prompt"),
    promptFile: val("--prompt-file"),
    model: val("--model"),
    effort: val("--effort"),
    maxSessions: Number(val("--max-sessions") ?? 20),
    budget: val("--budget-usd"),
    pauseAt: Number(val("--pause-at") ?? 0.9),
    permissionMode: val("--permission-mode") ?? "auto",
    thinking: a.includes("--thinking"),
    dryRun: a.includes("--dry-run"),
  };
  if (o.promptFile) o.prompt = fs.readFileSync(o.promptFile, "utf8");
  if (o.effort && !EFFORTS.includes(o.effort)) throw new Error(`--effort is one of ${EFFORTS.join(", ")}`);
  return o;
}

async function main() {
  const opts = args();
  fs.mkdirSync(LOGS, { recursive: true });
  fs.writeFileSync(PROTOCOL, PROTOCOL_TEXT);
  if (fs.existsSync(PAUSE)) fs.rmSync(PAUSE); // starting the loop is resuming it
  const state = readState();
  const saveLimits = (l) => {
    state.limits = { ...l, at: new Date().toISOString() };
    writeState(state);
  };

  // What runs first: a prompt you gave, a session left paused or waiting on you, or the last hand-off.
  let run = null;
  if (opts.prompt) run = { prompt: opts.prompt, model: opts.model ?? "opus", effort: opts.effort ?? "high", name: "From --prompt" };
  else if (state.pending) {
    const p = state.pending;
    console.log(yellow(`\n${p.question ? "A session is waiting for you" : "A session was stopped partway"}: ${p.name} (${p.sessionId})`));
    if (p.question) console.log(`\n${p.question}\n`);
    const answer = await ask(p.question ? "Your answer (blank to stop): " : 'Enter to resume it, type a message to send it instead, or "skip" to start the next one: ');
    if (answer === "q" || (p.question && !answer)) return;
    if (!p.question && answer.toLowerCase() === "skip") state.pending = null;
    else run = { name: p.name, model: p.model, effort: p.effort, resume: p.sessionId, prompt: answer || CARRY_ON };
  }
  if (!run && state.next) run = { ...state.next, model: opts.model ?? state.next.model, effort: opts.effort ?? state.next.effort };
  if (!run) {
    console.log('Nothing to run: pass --prompt "..." or --prompt-file <path> (the seed prompt a session handed you).');
    return;
  }
  writeState(state);

  for (let n = 1; n <= opts.maxSessions; n++) {
    // `pause` sent between sessions: hold before starting the next one.
    if (fs.existsSync(PAUSE) && !run.resume) {
      console.log(yellow(`\n━━ Paused before ${run.name} ━━`));
      const answer = await ask("Enter (or `resume` in another terminal) to start it, q to quit: ", { until: () => !fs.existsSync(PAUSE) });
      if (fs.existsSync(PAUSE)) fs.rmSync(PAUSE);
      if (answer === "q") break;
    }
    if (fs.existsSync(STOP) || ctl.stopAfter) {
      if (fs.existsSync(STOP)) fs.rmSync(STOP);
      console.log(yellow("\nStopping before the next session, as asked. Run the loop again to carry on."));
      break;
    }
    // Before starting: wait while the 5-hour window is nearly used up; a weekly limit stops the loop.
    const w = state.limits?.unifiedWindows ?? {};
    if (!run.resume && w.seven_day && w.seven_day.utilization >= Math.min(opts.pauseAt, 0.98) && w.seven_day.resetsAt * 1000 > Date.now()) {
      console.log(yellow(`\nThe weekly usage window is ${pct(w.seven_day.utilization)} used, until ${new Date(w.seven_day.resetsAt * 1000).toLocaleString()}. Stopping; run the loop again then.`));
      break;
    }
    if (!run.resume && w.five_hour && w.five_hour.utilization >= opts.pauseAt && w.five_hour.resetsAt * 1000 > Date.now()) {
      if ((await waitUntil(w.five_hour.resetsAt, `The 5-hour usage window is ${pct(w.five_hour.utilization)} used.`)) === "quit") break;
      state.limits = null;
    }
    if (!opts.dryRun && !(await devServerUp())) console.log(yellow("The dev server isn't answering on :3000. A session will start it if it needs to (or `npm run dev` in another terminal)."));

    const name = run.name || `Session ${n}`;
    const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const logBase = path.join(LOGS, `${stamp}-${name.replace(/[^\w.-]+/g, "-").slice(0, 40)}`);
    console.log(bold(`\n━━ ${name} · ${run.model ?? "default model"}${run.effort ? ` · ${run.effort}` : ""}${run.resume ? " · resumed" : ""} ━━`));
    if (state.limits) console.log(dim(`Usage: ${limitLine(state.limits)}`));
    // Saved as stopped partway as soon as it has an id, so a crash or a closed terminal leaves it to resume too.
    const out = await runSession({
      ...run,
      opts,
      logBase,
      onLimits: saveLimits,
      onSession: (id) => {
        state.pending = { sessionId: id, name, model: run.model, effort: run.effort, paused: true };
        writeState(state);
      },
    });
    keysOff();
    state.history.push({ name, sessionId: out.sessionId, at: new Date().toISOString(), cost: out.cost, log: path.relative(ROOT, `${logBase}.txt`) });
    const total = state.history.reduce((t, h) => t + (h.cost || 0), 0);
    const keep = (extra = {}) => {
      state.pending = { sessionId: out.sessionId, name, model: run.model, effort: run.effort, ...extra };
      writeState(state);
    };

    // Stopped partway: by you (p, q, `pause`), or by a usage limit.
    if (out.quit) {
      keep({ paused: true });
      console.log(yellow(`\nQuit. Run the loop again to resume ${out.sessionId} where it stopped.`));
      return;
    }
    if (out.paused || out.limit) {
      keep({ paused: true });
      ctl.pause = false;
      let message = CARRY_ON;
      if (out.limit) {
        const weekly = out.limit.rateLimitType === "seven_day";
        if (weekly) {
          console.log(yellow(`\nHit the weekly usage limit${out.limit.resetsAt ? `, until ${new Date(out.limit.resetsAt * 1000).toLocaleString()}` : ""}. Run the loop again then: it resumes this session.`));
          return;
        }
        if ((await waitUntil(out.limit.resetsAt, "Hit a usage limit: this session resumes when it resets.")) === "quit") return;
      } else {
        if (tty) process.stdout.write("\x07");
        console.log(yellow(`\n━━ Paused: ${name} ━━   ${dim(`(claude --resume ${out.sessionId} opens it in the app)`)}`));
        const byFile = ctl.byFile;
        const answer = await ask(`Enter${byFile ? " (or `resume` in another terminal)" : ""} to resume, type a message to send it instead, or q to quit: `, {
          until: () => byFile && !fs.existsSync(PAUSE),
        });
        if (fs.existsSync(PAUSE)) fs.rmSync(PAUSE);
        if (answer === "q") {
          console.log(yellow(`Quit. Run the loop again to resume ${out.sessionId}.`));
          return;
        }
        if (answer) message = answer;
      }
      run = { ...run, resume: out.sessionId, prompt: message, name };
      n--; // the same session, carried on
      continue;
    }

    const h = out.error ? null : handOff(out.result);
    if (h?.status === "next" && typeof h.prompt === "string" && h.prompt.trim()) {
      if (h.prompt.trim() === String(run.prompt).trim()) {
        keep({ question: "The session handed off the same prompt it was given, so the loop stopped rather than repeat it. Read its last message, then answer to steer it." });
        console.log(red("\nThe hand-off repeats this session's own prompt: stopping. Run the loop again to answer it."));
        return;
      }
      run = { prompt: h.prompt, model: h.model || run.model, effort: EFFORTS.includes(h.effort) ? h.effort : run.effort, name: h.name || `Session ${n + 1}` };
      state.next = run;
      state.pending = null;
      writeState(state);
      console.log(green(`\n→ Next: ${run.name} · ${run.model} · ${run.effort}   (so far $${total.toFixed(2)})`));
      continue;
    }
    if (h?.status === "done") {
      state.next = null;
      state.pending = null;
      writeState(state);
      console.log(green(`\nDone: ${h.reason ?? "nothing left to start"}   (total $${total.toFixed(2)})`));
      return;
    }

    // It needs you: a question, an error, or no hand-off at all.
    const question = h?.status === "needs_input" ? String(h.question ?? "It needs your input.") : out.error ? `It stopped with an error: ${out.error}` : "It ended without a hand-off block. Read its last message above.";
    keep({ question });
    if (tty) process.stdout.write("\x07");
    console.log(yellow(`\n━━ ${name} needs you ━━`));
    console.log(`\n${question}\n`);
    console.log(dim(`Session ${out.sessionId} · or answer in the app: claude --resume ${out.sessionId}`));
    const answer = await ask("Your answer, to carry on in the same session (blank to stop): ");
    if (!answer || answer === "q") {
      console.log(dim("Stopped. Run the loop again to answer."));
      return;
    }
    run = { ...run, resume: out.sessionId, prompt: answer, name };
  }
  console.log(yellow(`\nStopped after ${opts.maxSessions} sessions (--max-sessions). Run it again to carry on.`));
}

// Ctrl+C outside a session (at a prompt): quit; during one, the key handler quits after saving it.
process.on("SIGINT", () => {
  if (ctl.child) return onKey("", { name: "q" });
  keysOff();
  process.exit(130);
});

const cmd = process.argv[2];
if (["pause", "resume", "stop", "status"].includes(cmd)) command(cmd);
else
  main()
    .catch((e) => {
      console.error(red(e.stack || String(e)));
      process.exitCode = 1;
    })
    .finally(() => {
      keysOff();
      if (!process.exitCode) process.exit(0);
    });
