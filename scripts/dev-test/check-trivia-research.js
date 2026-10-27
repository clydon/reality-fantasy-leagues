// Dev-only test bank: researched trivia (db/trivia-research.js) against the real bot. Builds the trivia prompt for a real
// season after episode N (its cast, and who left when), asks the ask-AI bot (real ChatGPT, web search on), parses the answer
// strictly and prints what was kept and what was dropped, with why. Read-only: it writes nothing to the database, so there's
// no up/down. Run it a few times on different episodes to see how often the answer parses and what gets dropped.
//
//   node scripts/dev-test/check-trivia-research.js <outDir> [show=survivor] [season=51] [episode=4] [--prompt-only]
//
// Needs the ask-AI bot (LLM_BROWSER_API_URL/KEY in .env.local) and a season with a staged cast. Takes a minute or two. Saves
// prompt.txt, answer.txt and parsed.json in <outDir>. --prompt-only builds and saves the prompt without asking.
require("dotenv").config({ path: ".env.local", quiet: true });
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
const Research = require("../../db/episode-research.js");
const Trivia = require("../../db/trivia-research.js");

async function ask(prompt) {
  const url = (process.env.LLM_BROWSER_API_URL || "").split(",")[0].trim().replace(/\/+$/, "");
  const key = process.env.LLM_BROWSER_API_KEY;
  if (!url || !key) throw new Error("Set LLM_BROWSER_API_URL and LLM_BROWSER_API_KEY in .env.local");
  const res = await fetch(`${url}/ask`, {
    method: "POST",
    headers: { "User-Agent": "GameYourShow/1.0 (+https://gameyourshow.com)", "Content-Type": "application/json", "X-API-Key": key },
    body: JSON.stringify({ provider: "chatgpt", prompt, search: true, max_wait: 270 }),
    signal: AbortSignal.timeout(285_000),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.response) throw new Error(`The bot didn't answer: ${body.detail || `HTTP ${res.status}`}`);
  return body;
}

/** Everyone in the season, with the episode each left in (through `n`), from what research has recorded. */
async function castOf(pool, show, season, n) {
  const after = await Research.resolveSeasonResearchContext(pool, show, season, n + 1);
  const all = [...after.castNames, ...(after.skippedCast || [])];
  const out = new Map(all.map((name) => [name, null]));
  for (let k = 1; k <= n; k++) {
    const next = await Research.resolveSeasonResearchContext(pool, show, season, k + 1);
    for (const name of next.skippedCast || []) if (out.get(name) === null) out.set(name, k);
  }
  return { ctx: after, cast: all.map((name) => ({ name, out: out.get(name) })) };
}

async function main() {
  const [outDir, show = "survivor", seasonArg = "51", episodeArg = "4"] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  if (!outDir) throw new Error("Usage: check-trivia-research.js <outDir> [show] [season] [episode] [--prompt-only]");
  const season = Number(seasonArg);
  const n = Number(episodeArg);
  fs.mkdirSync(outDir, { recursive: true });
  const pool = new Pool({ connectionString: process.env.AUTH_DATABASE_URL });
  try {
    const { ctx, cast } = await castOf(pool, show, season, n);
    const term = (ctx.terms && ctx.terms.castaways) || "cast members";
    const prompt = Trivia.buildTriviaPrompt({ showName: ctx.showName, season, episode: n, cast, term: term.toLowerCase() });
    fs.writeFileSync(path.join(outDir, "prompt.txt"), prompt);
    console.log(`Prompt: ${path.join(outDir, "prompt.txt")} (${prompt.length} chars, ${cast.length} in the cast)`);
    if (process.argv.includes("--prompt-only")) return;
    const started = Date.now();
    const { response } = await ask(prompt);
    fs.writeFileSync(path.join(outDir, "answer.txt"), response);
    const parsed = Trivia.parseTriviaAnswer(response, n, cast.map((c) => c.name));
    fs.writeFileSync(path.join(outDir, "parsed.json"), JSON.stringify(parsed, null, 2));
    console.log(`Answered in ${Math.round((Date.now() - started) / 1000)}s: ${parsed.questions.length} kept, ${parsed.dropped.length} dropped (found: ${parsed.found})`);
    for (const q of parsed.questions) {
      console.log(`\n[ep ${q.episode}, ${q.kind}] ${q.question}`);
      for (const o of q.options) console.log(`   ${o === q.answer ? "*" : " "} ${o}`);
      if (q.why) console.log(`   why: ${q.why}`);
      console.log(`   source: ${q.source}`);
    }
    for (const d of parsed.dropped) console.log(`\nDROPPED #${d.index} (${d.why}): ${d.question || "(no question)"}`);
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
