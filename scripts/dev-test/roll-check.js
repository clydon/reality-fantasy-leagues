// Dev-only: G4's rolls on every taped season (docs/PLAN-start-a-game-gpt.md step G4, src/lib/game/game-spec/roll.js). For each
// season on tape that this database has loaded (`tapes.js load`), thousands of seeds rolled on its page at its premiere (blind.js
// rollPage: the engine lab's own rules for the season, a couch of four, the whole cast in, every episode to air) with the
// tracker's weights, each checked again by our check on those rules (specProblems, specWaitsFor, a place in the scoring
// sequence), its short form within its caps, and its words free of undefined or NaN. Prints, a line a season, how many passed,
// how many distinct games, and how often each base, way to win and twist came up; exits 1 on any roll that failed. Writes nothing
// (no league is made: blind.js run --rolls=N plays rolls to the end).
//
//   node scripts/dev-test/roll-check.js [<show> <season>] [--n=2000] [--seed=1]
//
// Needs this lane's .env.local (a local database) and its migrations; no dev server. A few seconds a season.
"use strict";
require("dotenv").config({ path: ".env.local", quiet: true });
const Blind = require("./blind.js");
const G = require("../../src/lib/game/game-spec/index.js");
const Roll = require("../../src/lib/game/game-spec/roll.js");
const { SHORT_TITLE, SHORT_LINE } = require("../../src/lib/game/game-spec/describe.js");

/** Every season on tape (the tapes' folders), as [show, season]. */
function taped() {
  const fs = require("fs");
  const path = require("path");
  const dir = process.env.TAPES_DIR || path.join(require("os").homedir(), "rfl-tapes");
  const out = [];
  for (const show of fs.readdirSync(dir)) {
    if (["replays", "words"].includes(show) || !fs.statSync(path.join(dir, show)).isDirectory()) continue;
    for (const n of fs.readdirSync(path.join(dir, show))) if (/^\d+$/.test(n)) out.push([show, Number(n)]);
  }
  return out;
}

const tally = (m, k) => m.set(k, (m.get(k) || 0) + 1);
const top = (m) => [...m].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(", ");

async function check(show, season, n, from, weights) {
  const { pool } = Blind.app();
  const { rows } = await pool.query("SELECT ss.id FROM show_seasons ss JOIN shows s ON s.id = ss.show_id WHERE s.slug = $1 AND ss.season_number = $2 AND s.set_up_at IS NOT NULL ORDER BY ss.created_at LIMIT 1", [show, season]);
  if (!rows.length) return { show, season, loaded: false };
  const page = await Blind.rollPage(rows[0].id);
  const bad = [];
  const games = new Set();
  const bases = new Map();
  const wins = new Map();
  const twists = new Map();
  let tries = 0;
  for (let seed = from; seed < from + n; seed++) {
    const r = Roll.rollSpec(page, {}, seed, { weights });
    tries += r.tries;
    const problems = r.ok ? [...G.specProblems(r.spec, page.ctx), ...G.specWaitsFor(r.spec)].map((x) => x.problem) : [r.why];
    if (r.ok && !G.typeOf(r.spec)) problems.push("no place in the scoring sequence");
    const s = r.describe && r.describe.short;
    if (r.ok && !(s && s.title.length <= SHORT_TITLE && s.line.length <= SHORT_LINE)) problems.push(`short form over its caps: ${s && s.title} | ${s && s.line}`);
    if (r.ok && /undefined|NaN/.test(`${s.title} ${s.line} ${r.describe.sentence}`)) problems.push(`words: ${s.title} | ${s.line}`);
    if (problems.length) bad.push({ seed, problems });
    games.add(JSON.stringify(r.spec));
    tally(bases, r.base);
    tally(wins, r.win);
    r.twists.forEach((t) => tally(twists, t));
  }
  return { show, season, loaded: true, n, bad, games: games.size, tries: tries / n, bases, wins, twists };
}

async function main() {
  const argv = process.argv.slice(2);
  const flags = Object.fromEntries(argv.filter((a) => a.startsWith("--")).map((a) => { const [k, v] = a.slice(2).split("="); return [k, v === undefined ? true : v]; }));
  const rest = argv.filter((a) => !a.startsWith("--"));
  const list = rest.length ? [[rest[0], Number(rest[1])]] : taped();
  const n = Number(flags.n) || 2000;
  const from = Number(flags.seed) || 1;
  const weights = Blind.rollWeights();
  let failed = 0;
  for (const [show, season] of list) {
    const x = await check(show, season, n, from, weights);
    if (!x.loaded) {
      console.log(`${show} ${season}: not loaded here (tapes.js load ${show} ${season})`);
      continue;
    }
    failed += x.bad.length;
    console.log(`${show} ${season}: ${x.n - x.bad.length} of ${x.n} rolls pass, ${x.games} distinct games, ${x.tries.toFixed(2)} tries a roll`);
    console.log(`  bases: ${top(x.bases)}\n  wins: ${top(x.wins)}\n  twists: ${top(x.twists)}`);
    for (const b of x.bad.slice(0, 8)) console.log(`  ! seed ${b.seed}: ${b.problems.slice(0, 2).join("; ")}`);
  }
  process.exitCode = failed ? 1 : 0;
}

if (require.main === module) {
  main()
    .then(async () => {
      await Blind.app().pool.end().catch(() => {});
      process.exit(process.exitCode || 0);
    })
    .catch(async (e) => {
      console.error(e && e.stack ? e.stack : e);
      await Blind.app().pool.end().catch(() => {});
      process.exit(1);
    });
}
