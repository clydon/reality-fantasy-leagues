// Dev-only: what a run of asks costs against the AI plans' limits (the user, 2026-11-16: "keep track of how many calls we are
// making so we can have accurate estimates of how many shows/episodes we could handle per 5 hour window/per week"). Reads each
// bot's /health (llm-browser-api: Codex's 5-hour and weekly use as a percentage, what's running and queued) every --every
// seconds into a JSON-lines file; `report` turns a file into the change in each and, given how many asks were made, the share
// of a window each ask took. Reads health only: no key, nothing asked.
//
//   node scripts/dev-test/bot-usage.js sample --out=<file.jsonl> [--every=60]      runs until stopped (Ctrl+C or killed)
//   node scripts/dev-test/bot-usage.js report --in=<file.jsonl> [--asks=N]          the change, and per ask with --asks
//
// The bots are .env.local's LLM_BROWSER_API_URL (the VM, then the PC). Codex's limits are the ChatGPT account's: both bots
// report the same account, so the report takes the highest of them. Other use of the account in the same window (production's
// runs on Codex, anyone's Codex) counts too: note it beside the numbers.
require("dotenv").config({ path: ".env.local", quiet: true });
const fs = require("fs");

const args = process.argv.slice(2);
const cmd = args[0];
const opt = (k) => (args.find((a) => a.startsWith(`--${k}=`)) || "").slice(k.length + 3) || null;
const bots = (process.env.LLM_BROWSER_API_URL || "").split(",").map((u) => u.trim().replace(/\/+$/, "")).filter(Boolean);

async function health(url) {
  try {
    const res = await fetch(`${url}/health`, { headers: { "User-Agent": "GameYourShow/1.0" }, signal: AbortSignal.timeout(5000) });
    const h = await res.json();
    const c = (h.limits && h.limits.codex) || {};
    return {
      bot: new URL(url).host,
      fiveHour: c.five_hour ? c.five_hour.used_percent : null,
      fiveHourResets: c.five_hour ? c.five_hour.resets_at : null,
      week: c.week ? c.week.used_percent : null,
      weekResets: c.week ? c.week.resets_at : null,
      held: !!(h.parallel && h.parallel.codex && h.parallel.codex.held),
      running: h.running || {},
      queued: h.queued || {},
    };
  } catch (e) {
    return { bot: new URL(url).host, error: e.message };
  }
}

(async () => {
  if (cmd === "sample") {
    const out = opt("out");
    if (!out) throw new Error("--out=<file.jsonl>");
    const every = Number(opt("every") || 60) * 1000;
    for (;;) {
      const at = new Date().toISOString();
      for (const b of bots) fs.appendFileSync(out, JSON.stringify({ at, ...(await health(b)) }) + "\n");
      await new Promise((r) => setTimeout(r, every));
    }
  }
  if (cmd === "report") {
    const rows = fs.readFileSync(opt("in"), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)).filter((r) => r.fiveHour != null || r.week != null);
    if (!rows.length) return console.log("no samples with Codex limits");
    const byAt = new Map();
    for (const r of rows) {
      const m = byAt.get(r.at) || { at: r.at, fiveHour: -1, week: -1 };
      m.fiveHour = Math.max(m.fiveHour, r.fiveHour ?? -1);
      m.week = Math.max(m.week, r.week ?? -1);
      byAt.set(r.at, m);
    }
    const s = [...byAt.values()].sort((a, b) => a.at.localeCompare(b.at));
    const first = s[0], last = s[s.length - 1];
    // A window that reset during the run starts again from 0: count each rise, not last minus first.
    const rise = (key) => s.slice(1).reduce((t, x, i) => t + Math.max(0, x[key] - s[i][key]), 0);
    const five = rise("fiveHour"), week = rise("week");
    const mins = Math.round((Date.parse(last.at) - Date.parse(first.at)) / 60000);
    console.log(`${s.length} samples over ${mins} min: Codex's 5-hour window ${first.fiveHour}% -> ${last.fiveHour}% (+${five}), the week ${first.week}% -> ${last.week}% (+${week})`);
    const asks = Number(opt("asks") || 0);
    if (asks > 0) {
      console.log(`per ask: ${(five / asks).toFixed(2)}% of a 5-hour window, ${(week / asks).toFixed(2)}% of a week`);
      if (five > 0) console.log(`so about ${Math.floor((100 * asks) / five)} asks fill a 5-hour window, about ${week > 0 ? Math.floor((100 * asks) / week) : "?"} a week`);
    }
  } else if (cmd !== "sample") throw new Error("usage: bot-usage.js sample --out=<file> | report --in=<file> [--asks=N]");
})().catch((e) => {
  console.error(e.message || e);
  process.exitCode = 1;
});
