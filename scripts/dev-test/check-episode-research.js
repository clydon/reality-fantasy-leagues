// Dev-only check: does a researched rulebook drive episode research that comes back usable? For each show, takes
// the rulebook check-rulebook-prompt.js got back (its blocks.json), compiles it (rulebook-compile.js), gets the
// season's cast (the local database, else ChatGPT with the cast prompt), then researches a few episodes with the
// app's own paste prompt in its JSON form (db/episode-research.js buildPastePrompt), through the ask-AI bot, and
// runs each answer through the same parse, validation and staging the app uses: what would reach review.
//
//   node scripts/dev-test/check-episode-research.js <rulebookDir> <outDir> [show ...] [--episodes=1,5] [--bot=local|vm] [--again]
//
// Each episode asks only about the people still in the game, by the rulebook (rulebook-roster.js whoToAsk), as the
// app does: who left and when comes from the season's accepted results where the local database has them, else from
// asking ChatGPT once per show (a stand-in for confirmed results; cached). --full-cast asks about everyone instead.
//
// Writes <outDir>/<show>/cast.json, ep<N>-prompt.txt, ep<N>-answer.txt, ep<N>-review.txt (coverage, who left,
// what each person scored, problems) and <outDir>/summary.txt. Shows and their episodes are rulebook-shows.js's
// presets. Answers are cached; --again re-asks. Reads the local database for a cast it has; writes nothing.
require("dotenv").config({ path: ".env.local", quiet: true });
const fs = require("fs");
const path = require("path");
const ER = require("../../db/episode-research.js");
const { termsFor } = require("../../db/wiki-sync.js");
const { compileRulebook, formatForRulebook } = require("../../src/lib/game/formats/rulebook-compile.js");
const { buildCastPrompt, parseCastImport } = require("../../src/lib/game/formats/cast-prompt.js");
const { jsonObjectsIn } = require("../../src/lib/game/formats/rulebook-research.js");
const { whoToAsk } = require("../../src/lib/game/formats/rulebook-roster.js");
const { PRESETS, botUrl, askBot, localCast, localExits } = require("./rulebook-shows");

const args = process.argv.slice(2);
const flag = (name) => args.find((a) => a.startsWith(`--${name}=`))?.split("=")[1] ?? (args.includes(`--${name}`) ? true : null);
const [rulebookDir, outDir] = args.filter((a) => !a.startsWith("--"));
if (!rulebookDir || !outDir) throw new Error("usage: node scripts/dev-test/check-episode-research.js <rulebookDir> <outDir> [show ...] [--episodes=1,5] [--bot=local|vm] [--again]");
const wanted = args.filter((a) => !a.startsWith("--")).slice(2);
for (const w of wanted) if (!PRESETS[w]) throw new Error(`no preset "${w}"`);
const shows = wanted.length ? wanted : Object.keys(PRESETS);
const only = flag("episodes") ? String(flag("episodes")).split(",").map(Number) : null;

async function cached(file, make) {
  if (fs.existsSync(file) && !flag("again")) return fs.readFileSync(file, "utf8");
  const text = await make();
  fs.writeFileSync(file, text, "utf8");
  return text;
}

async function castFor(url, key, p, format, dir) {
  const fromDb = await localCast(p.cast);
  if (fromDb.length) return { names: fromDb, from: "the local database" };
  const prompt = buildCastPrompt(format, { seasonName: p.episodes.castLabel || `season ${p.episodes.season}`, showName: p.show });
  const answer = await cached(path.join(dir, "cast-answer.txt"), async () => {
    process.stdout.write(`  ${key}: asking for the cast... `);
    const { answer: a, seconds } = await askBot(url, prompt);
    console.log(`${Math.round(seconds)}s`);
    return a;
  });
  const parsed = parseCastImport(answer, format);
  const names = (parsed.castaways || []).filter((c) => c.name && !(c.problems || []).length).map((c) => c.name);
  return { names, from: "ChatGPT's cast answer", repairs: parsed.repairs || [] };
}

// When each person left and how, for the questions' list: accepted results first, then ChatGPT for the rest.
async function exitsFor(url, key, p, blocks, names, dir) {
  const exits = await localExits(p.cast);
  const missing = names.filter((n) => !exits[n]);
  if (missing.length) {
    const ways = (blocks.waysOut || []).map((w) => w.name);
    const prompt = [
      `${p.show} season ${p.episodes.season}. For each person below, say when they left the game for good and how. Search the web; don't answer from memory.`,
      "",
      ...names.map((n, i) => `${i + 1}. ${n}`),
      "",
      "Answer with ONE JSON object and nothing after it:",
      JSON.stringify({ people: [{ name: "exactly as listed", leftInEpisode: "the episode number they left in, or null if they haven't left (or the season hasn't got there yet)", howTheyLeft: `one of ${ways.map((w) => JSON.stringify(w)).join(", ") || '"Left"'}, or null` }] }, null, 1),
    ].join("\n");
    const answer = await cached(path.join(dir, "exits-answer.txt"), async () => {
      process.stdout.write(`  ${key}: asking who left when... `);
      const { answer: a, seconds } = await askBot(url, prompt);
      console.log(`${Math.round(seconds)}s`);
      return a;
    });
    const objects = jsonObjectsIn(answer);
    let people = [];
    try {
      people = JSON.parse(objects[objects.length - 1] || "{}").people || [];
    } catch {
      // nothing usable: everyone is asked about
    }
    for (const r of people) {
      const name = names.find((n) => n.toLowerCase() === String(r.name || "").trim().toLowerCase());
      if (name && !exits[name] && Number.isInteger(r.leftInEpisode)) exits[name] = { episode: r.leftInEpisode, how: r.howTheyLeft || null, from: "ChatGPT" };
    }
  }
  return exits;
}

// What a way out means, by its name (a way the rulebook doesn't have: out for good, or for one race in a sport).
function meansOf(blocks, how) {
  const w = (blocks.waysOut || []).find((x) => String(x.name).toLowerCase() === String(how || "").toLowerCase());
  return w ? w.means : blocks.kind === "sport" ? "outForOne" : "out";
}

(async () => {
  const url = botUrl(flag("bot") || "local");
  console.log(`[episode-research] ${shows.length} show(s) through ${new URL(url).host} -> ${outDir}`);
  const summary = [];
  for (const key of shows) {
    const p = PRESETS[key];
    const dir = path.join(outDir, key);
    fs.mkdirSync(dir, { recursive: true });
    const blocksFile = path.join(rulebookDir, key, "blocks.json");
    if (!fs.existsSync(blocksFile)) {
      summary.push(`${key.padEnd(26)} no rulebook in ${rulebookDir} (run check-rulebook-prompt.js first)`);
      continue;
    }
    const blocks = JSON.parse(fs.readFileSync(blocksFile, "utf8"));
    const { data, problems: compileProblems, warnings } = compileRulebook(blocks);
    if (compileProblems.length) {
      summary.push(`${key.padEnd(26)} didn't compile: ${compileProblems.join("; ")}`);
      continue;
    }
    const format = formatForRulebook(data);
    const terms = termsFor({ castaway_term: data.terms.castaway, tribe_term: data.terms.tribe }).terms;
    let cast;
    try {
      cast = await castFor(url, key, p, format, dir);
    } catch (e) {
      summary.push(`${key.padEnd(26)} no cast: ${e.message}`);
      continue;
    }
    fs.writeFileSync(path.join(dir, "cast.json"), JSON.stringify(cast, null, 2), "utf8");
    if (!cast.names.length) {
      summary.push(`${key.padEnd(26)} no cast came back`);
      continue;
    }
    let exits = {};
    if (!flag("full-cast")) {
      try {
        exits = await exitsFor(url, key, p, blocks, cast.names, dir);
      } catch (e) {
        console.log(`  ${key}: who left when didn't come back (${e.message}); asking about everyone`);
      }
    }
    fs.writeFileSync(path.join(dir, "exits.json"), JSON.stringify(exits, null, 2), "utf8");
    const people = cast.names.map((name) => ({ name, left: exits[name] ? { episode: exits[name].episode, means: meansOf(blocks, exits[name].how) } : null }));
    for (const n of (only || p.episodes.numbers)) {
      const roster = whoToAsk(blocks, people, n);
      const asking = roster.ask;
      const ctx = { showName: p.show, season: p.episodes.season, episodeNumber: n, castNames: asking, castGroups: {}, terms, domains: [], format };
      const prompt = ER.buildPastePrompt(ctx, [], { structured: true, pasteBack: "Send the JSON only." });
      fs.writeFileSync(path.join(dir, `ep${n}-prompt.txt`), prompt, "utf8");
      let answer;
      try {
        answer = await cached(path.join(dir, `ep${n}-answer.txt`), async () => {
          process.stdout.write(`  ${key} episode ${n}: asking... `);
          const { answer: a, seconds } = await askBot(url, prompt);
          console.log(`${Math.round(seconds)}s`);
          return a;
        });
      } catch (e) {
        console.log(`failed: ${e.message}`);
        summary.push(`${key.padEnd(26)} ep ${String(n).padStart(2)}  FAILED: ${e.message}`);
        continue;
      }
      const out = [
        `${p.show} season ${p.episodes.season}, episode ${n}: asked about ${asking.length} of ${cast.names.length} people (${cast.from})`,
        ...(roster.skipped.length ? [`Not asked, already gone: ${roster.skipped.map((x) => `${x.name} (${x.why})`).join(", ")}`] : []),
        ...(roster.asksArrivals ? ["This rulebook has arrivals: a new person mid-season isn't asked about yet (6b adds \"who's new\")."] : []),
        "",
      ];
      let line;
      try {
        // The app's paste path reads from the first { to the last }; a chat that sends a draft and then a
        // correction breaks that, so the last complete object is used here, and the review says so.
        const objects = jsonObjectsIn(answer);
        if (objects.length > 1) out.push(`Note: the answer had ${objects.length} JSON objects; the app's paste path would fail on it. Used the last.`, "");
        const parsed = ER.parseJsonAnswer(objects.length > 1 ? objects[objects.length - 1] : ER.extractJsonObject(answer), ER.researchSchemaFor(format, false), "The answer");
        const v = ER.validateResearch(parsed, asking, terms, format);
        const items = ER.candidatesFor(parsed, format, n);
        const label = new Map(data.events.map((e) => [e.id, e.label]));
        const left = items.filter((i) => i.kind === "elimination");
        out.push(`Title: ${parsed.episodeTitle || "?"} · aired ${parsed.airDate || "?"}`, `Summary: ${parsed.summary || ""}`, "");
        if (data.research.episodeFields.length) {
          out.push("The episode:", ...data.research.episodeFields.map((f) => `  ${f.note || f.key}: ${JSON.stringify(parsed[f.key])}`), "");
        }
        out.push(`Left: ${left.map((i) => `${i.castawayName} (${i.method})`).join(", ") || "nobody"}`, "", "Scored:");
        const byPerson = new Map();
        for (const i of items.filter((x) => x.kind === "event")) byPerson.set(i.castawayName, [...(byPerson.get(i.castawayName) || []), label.get(i.eventType) || i.eventType]);
        for (const [who, what] of byPerson) out.push(`  ${who}: ${what.join(" · ")}`);
        if (!byPerson.size) out.push("  nobody");
        out.push("", `Counts: ${JSON.stringify(v.counts)}`, `Fatal (${v.fatal.length}):`, ...v.fatal.map((x) => `  ${x}`), `Problems (${v.problems.length}):`, ...v.problems.map((x) => `  ${x}`));
        if (parsed.repairs && parsed.repairs.length) out.push(`Repaired (${parsed.repairs.length}):`, ...parsed.repairs.map((x) => `  ${x}`));
        if (warnings.length) out.push("", "Compiler notes:", ...warnings.map((x) => `  ${x}`));
        const events = items.filter((x) => x.kind === "event").length;
        line = `${key.padEnd(26)} ep ${String(n).padStart(2)}  ${v.fatal.length ? "FATAL" : "ok   "}  ${String(v.counts.castaways).padStart(2)}/${asking.length} asked of ${cast.names.length}  ${String(v.counts.sourced).padStart(2)} sourced  ${String(v.counts.unknowns).padStart(3)} unknowns  left: ${left.map((i) => i.castawayName).join(", ") || "nobody"}  ${events} results  ${v.problems.length} problems`;
      } catch (e) {
        out.push(`Didn't parse: ${e.message}`);
        line = `${key.padEnd(26)} ep ${String(n).padStart(2)}  DIDN'T PARSE: ${e.message.slice(0, 120)}`;
      }
      fs.writeFileSync(path.join(dir, `ep${n}-review.txt`), `${out.join("\n")}\n`, "utf8");
      summary.push(line);
    }
  }
  fs.writeFileSync(path.join(outDir, "summary.txt"), `${summary.join("\n")}\n`, "utf8");
  console.log(summary.join("\n"));
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
