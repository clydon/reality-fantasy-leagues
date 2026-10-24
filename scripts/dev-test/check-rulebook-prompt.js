// Dev-only check: does the rulebook research prompt (src/lib/game/formats/rulebook-research.js) get back what
// we expect? Sends it for each show to ChatGPT through the ask-AI bot (llm-browser-api: this PC's by default, so
// production's VM stays free), one at a time, then reviews each answer against the schema and writes:
//
//   <outDir>/<show>/prompt.txt          what was sent
//   <outDir>/<show>/answer.txt          what came back
//   <outDir>/<show>/blocks.json         the reviewed blocks
//   <outDir>/<show>/review.txt          How it works as text, problems, tidy-ups, what didn't fit, and a diff
//                                       against our own rulebook for the show when we have one
//   <outDir>/summary.txt                one line per show
//
//   node scripts/dev-test/check-rulebook-prompt.js <outDir> [show ...] [--bot=local|vm] [--template] [--again]
//
// Shows are the presets below (default: all); `--list` prints them. --template sends the nearest rulebook we
// have as a starting point (the implementation plan's T-72 compares with and without). An answer already in
// <outDir> is reused unless --again. Needs LLM_BROWSER_API_URL and LLM_BROWSER_API_KEY in .env.local, and the
// bot running (llm-browser-api; ~1-2 minutes an answer). Writes nothing to the database.
require("dotenv").config({ path: ".env.local", quiet: true });
const fs = require("fs");
const path = require("path");
const R = require("../../src/lib/game/formats/rulebook-research.js");
const D = require("../../src/lib/game/formats/rulebook-describe.js");
const { momentsFor } = require("../../src/lib/game/formats/rulebook-moments.js");
const { BUILT_IN_BLOCKS } = require("../../src/lib/game/formats/blocks/index.js");
const SAMPLES = require("../../tests/fixtures/rulebook-samples.js");

// Each show to try: what to ask, and our own rulebook for it, when we have one, to compare with.
const PRESETS = {
  "survivor-50": { show: "Survivor", season: "Season 50", expect: BUILT_IN_BLOCKS.survivor.blocks },
  "survivor-51": { show: "Survivor", season: "Season 51, airing now", airing: true, expect: BUILT_IN_BLOCKS.survivor.blocks, cast: ["survivor", 51] },
  "amazing-race": { show: "The Amazing Race", season: "its most recent season", expect: SAMPLES.amazingRace },
  "the-challenge": { show: "The Challenge", season: "its most recent season", expect: BUILT_IN_BLOCKS.challenge.blocks },
  "real-housewives": { show: "The Real Housewives of Beverly Hills", season: "its most recent season" },
  "below-deck": { show: "Below Deck", season: "its most recent season", expect: SAMPLES.belowDeck },
  "world-series-2025-game-2": { show: "the World Series", season: "Game 2 of the 2025 World Series" },
  "world-series-2026-game-2": { show: "the World Series", season: "Game 2 of the 2026 World Series, which hasn't happened yet or is about to", airing: true },
  scrubs: { show: "Scrubs", season: "its most recent season" },
  "snl-51": { show: "Saturday Night Live", season: "Season 51", expect: SAMPLES.snl },
  "snl-52": { show: "Saturday Night Live", season: "Season 52, airing now", airing: true, expect: SAMPLES.snl },
};
// The nearest rulebook we have, for --template: by kind, as the show's own preset says it'd be.
const TEMPLATES = {
  "amazing-race": BUILT_IN_BLOCKS.survivor.blocks, "the-challenge": BUILT_IN_BLOCKS.survivor.blocks, "real-housewives": SAMPLES.belowDeck,
  "below-deck": SAMPLES.pluribus, "world-series-2025-game-2": SAMPLES.formula1, "world-series-2026-game-2": SAMPLES.formula1,
  scrubs: SAMPLES.pluribus, "snl-51": SAMPLES.formula1, "snl-52": SAMPLES.formula1,
};

const args = process.argv.slice(2);
const flag = (name) => args.find((a) => a.startsWith(`--${name}=`))?.split("=")[1] ?? (args.includes(`--${name}`) ? true : null);
if (args.includes("--list")) {
  for (const [k, p] of Object.entries(PRESETS)) console.log(`${k.padEnd(26)} ${p.show}, ${p.season}${p.expect ? "  (compared with ours)" : ""}`);
  process.exit(0);
}
const outDir = args.find((a) => !a.startsWith("--"));
if (!outDir) throw new Error("usage: node scripts/dev-test/check-rulebook-prompt.js <outDir> [show ...] [--bot=local|vm] [--template] [--again] | --list");
const wanted = args.filter((a) => !a.startsWith("--") && a !== outDir);
for (const w of wanted) if (!PRESETS[w]) throw new Error(`no preset "${w}" (--list shows them)`);
const shows = wanted.length ? wanted : Object.keys(PRESETS);

const UA = { "User-Agent": "GameYourShow/1.0 (+https://gameyourshow.com)" };

// The season's cast, for the spoiler check, when the local database has it (read only; [] otherwise).
async function castNames(cast) {
  const url = process.env.AUTH_DATABASE_URL || "";
  if (!cast || !/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(url)) return [];
  const { Pool } = require("pg");
  const pool = new Pool({ connectionString: url });
  try {
    const { rows } = await pool.query(
      "SELECT sc.name FROM season_cast sc JOIN show_seasons ss ON ss.id = sc.season_id JOIN shows s ON s.id = ss.show_id WHERE s.slug = $1 AND ss.season_number = $2",
      cast
    );
    return rows.map((r) => r.name);
  } catch {
    return [];
  } finally {
    await pool.end();
  }
}
function botUrl() {
  const urls = (process.env.LLM_BROWSER_API_URL || "").split(",").map((u) => u.trim().replace(/\/+$/, "")).filter(Boolean);
  if (!urls.length || !process.env.LLM_BROWSER_API_KEY) throw new Error("LLM_BROWSER_API_URL and LLM_BROWSER_API_KEY must be in .env.local");
  const local = urls.find((u) => /127\.0\.0\.1|localhost/.test(u));
  const which = flag("bot") || "local";
  if (which === "local" && local) return local;
  return urls.find((u) => u !== local) || urls[0];
}

async function ask(url, prompt) {
  const res = await fetch(`${url}/ask`, {
    method: "POST",
    headers: { ...UA, "Content-Type": "application/json", "X-API-Key": process.env.LLM_BROWSER_API_KEY },
    body: JSON.stringify({ provider: "chatgpt", prompt, search: true, max_wait: 420 }),
    signal: AbortSignal.timeout(450_000),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.response) throw new Error(body.detail || `HTTP ${res.status}`);
  return { answer: body.response, seconds: body.seconds || 0 };
}

// ---------- how an answer reads ----------

const fmt = (v) => (typeof v === "number" ? `${v > 0 ? "+" : ""}${v}` : v && typeof v === "object" ? `${v.exclusive}/${v.shared}` : "");
function asText(blocks) {
  const v = D.howItWorks(blocks, { seen: Infinity });
  const out = [];
  out.push(`${(blocks.show || "?").toUpperCase()} · ${v.kind.line}${v.tagline ? ` · ${v.tagline}` : ""}`, v.premise || "(no premise)", "");
  out.push(`${v.rundown.label}:`);
  for (const s of v.rundown.segments) out.push(`  ${s.n}. ${s.name}${[s.decided, s.often, s.stake && `[${s.stake.label}]`].filter(Boolean).map((x) => ` · ${x}`).join("")}${s.summary ? `\n     ${s.summary}` : ""}`);
  out.push("", `${v.season.label}:`, ...v.season.phases.map((p) => `  ${p.name}: ${p.when}${p.summary ? ` · ${p.summary}` : ""}`));
  if (v.season.finale) out.push(`  Ends: ${v.season.finale}`);
  out.push("", `${v.who.label}: ${v.who.line}${v.who.groups ? ` ${v.who.groups}` : ""}`);
  if (v.waysOut) out.push("", `${v.waysOut.label}: ${[...v.waysOut.out, ...v.waysOut.finish].map((w) => `${w.name} (${w.means})`).join(", ") || "none"}`);
  if (v.twists) out.push("", `${v.twists.label}:`, ...v.twists.items.map((t) => `  ${t.name} (${t.typeLabel}): ${t.line}`));
  const n = v.points.groups.reduce((a, g) => a + g.items.length, 0);
  out.push("", `${v.points.label} (${n}):`);
  for (const g of v.points.groups) out.push(`  ${g.label}: ${g.items.map((i) => `${i.label}${"points" in i ? ` ${fmt(i.points)}` : ""}${i.auto ? " (auto)" : i.league ? " (league)" : ""}`).join(" · ")}`);
  return out.join("\n");
}

// ---------- compared with ours ----------

const norm = (s) => String(s || "").toLowerCase().replace(/^the\s+/, "").replace(/[^a-z0-9]+/g, " ").trim().replace(/s$/, "");
function compare(expect, got) {
  const lines = [];
  const same = (what, a, b) => lines.push(`${JSON.stringify(a) === JSON.stringify(b) ? "  same " : "  DIFF "} ${what}: ours ${JSON.stringify(a)} · theirs ${JSON.stringify(b)}`);
  same("kind", expect.kind, got.kind);
  if (expect.kind === "series") same("start", expect.start, got.start);
  same("cast unit", expect.cast?.unit, got.cast?.unit);
  same("groups", expect.cast?.groups && [expect.cast.groups.type, expect.cast.groups.change], got.cast?.groups && [got.cast.groups.type, got.cast.groups.change]);
  same("phases", (expect.season?.phases || []).map((p) => p.starts?.type), (got.season?.phases || []).map((p) => p.starts?.type));
  same("finale", expect.season?.finale?.decidedBy ?? null, got.season?.finale?.decidedBy ?? null);
  const segs = new Map((got.segments || []).map((s) => [norm(s.name), s]));
  const keys = ["decidedBy", "voters", "pickers", "decides", "onTheLine", "often"];
  for (const s of expect.segments || []) {
    const g = segs.get(norm(s.name)) || [...segs.values()].find((x) => norm(x.name).includes(norm(s.name)) || norm(s.name).includes(norm(x.name)));
    if (!g) { lines.push(`  MISS  segment ${s.name}`); continue; }
    segs.delete(norm(g.name));
    const a = keys.filter((k) => s[k] !== undefined).map((k) => `${k}=${s[k]}`);
    const b = keys.filter((k) => g[k] !== undefined).map((k) => `${k}=${g[k]}`);
    lines.push(`${a.join(" ") === b.join(" ") ? "  same " : "  DIFF "} segment ${s.name}: ours ${a.join(" ")} · theirs ${b.join(" ")}`);
  }
  for (const g of segs.values()) lines.push(`  EXTRA segment ${g.name}: ${keys.filter((k) => g[k] !== undefined).map((k) => `${k}=${g[k]}`).join(" ")}`);
  const ways = (b) => (b.waysOut || []).map((w) => `${norm(w.name)}:${w.means}`).sort();
  same("ways out", ways(expect), ways(got));
  same("twists", (expect.twists || []).map((t) => t.type).sort(), (got.twists || []).map((t) => t.type).sort());
  return lines.join("\n");
}

// ---------- run ----------

(async () => {
  const url = botUrl();
  console.log(`[rulebook-prompt] ${shows.length} show(s) through ${new URL(url).host}${flag("template") ? ", with a starting rulebook" : ""} -> ${outDir}`);
  const summary = [];
  for (const key of shows) {
    const p = PRESETS[key];
    const dir = path.join(outDir, key);
    fs.mkdirSync(dir, { recursive: true });
    const template = flag("template") ? TEMPLATES[key] || null : null;
    const prompt = R.buildRulebookPrompt({ show: p.show, season: p.season, airing: !!p.airing, template });
    fs.writeFileSync(path.join(dir, "prompt.txt"), prompt, "utf8");
    const answerFile = path.join(dir, "answer.txt");
    let answer;
    let seconds = 0;
    if (fs.existsSync(answerFile) && !flag("again")) answer = fs.readFileSync(answerFile, "utf8");
    else {
      process.stdout.write(`  ${key}: asking... `);
      try {
        ({ answer, seconds } = await ask(url, prompt));
      } catch (e) {
        console.log(`failed: ${e.message}`);
        summary.push(`${key.padEnd(26)} FAILED: ${e.message}`);
        continue;
      }
      fs.writeFileSync(answerFile, answer, "utf8");
      console.log(`${Math.round(seconds)}s`);
    }
    let review;
    try {
      review = R.reviewRulebook(R.parseRulebookAnswer(answer), { castNames: await castNames(p.cast) });
    } catch (e) {
      fs.writeFileSync(path.join(dir, "review.txt"), `The answer didn't parse: ${e.message}\n`, "utf8");
      summary.push(`${key.padEnd(26)} DIDN'T PARSE: ${e.message}`);
      continue;
    }
    fs.writeFileSync(path.join(dir, "blocks.json"), JSON.stringify(review.blocks, null, 2), "utf8");
    const text = [
      asText(review.blocks),
      "",
      `Phases started (season data, not the rulebook): ${JSON.stringify(review.phaseStarts)}`,
      `Problems (${review.problems.length}):`, ...review.problems.map((x) => `  ${x.at}: ${x.message}`),
      `Tidied (${review.warnings.length}):`, ...review.warnings.map((x) => `  ${x.at}: ${x.message}`),
      `Didn't fit (${review.leftOut.length}):`, ...review.leftOut.map((x) => `  ${x}`),
      ...(p.expect ? ["", "Compared with our rulebook:", compare(p.expect, review.blocks)] : []),
    ].join("\n");
    fs.writeFileSync(path.join(dir, "review.txt"), `${text}\n`, "utf8");
    const b = review.blocks;
    const named = review.problems.filter((x) => /^Names /.test(x.message)).length;
    const episodes = review.warnings.filter((x) => /happened in an episode/.test(x.message)).length;
    const repeats = review.warnings.filter((x) => /already built/.test(x.message)).length;
    summary.push(
      `${key.padEnd(26)} ${String(b.kind).padEnd(11)} ${String((b.segments || []).length).padStart(2)} segments  ${String((b.waysOut || []).length).padStart(2)} ways out  ${String((b.twists || []).length).padStart(2)} twists  ${String(momentsFor(b).length).padStart(3)} moments  ${String(review.problems.length).padStart(2)} problems (${named} names)  ${episodes} about an episode  ${repeats} repeats  ${review.leftOut.length} didn't fit`
    );
  }
  fs.writeFileSync(path.join(outDir, "summary.txt"), `${summary.join("\n")}\n`, "utf8");
  console.log(summary.join("\n"));
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
