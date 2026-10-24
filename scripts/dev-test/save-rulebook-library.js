// Dev-only: saves researched rulebooks into the rulebook library (src/lib/game/formats/library/), blocks and compiled
// format data together, so nobody has to research or compile them again. R3's backfill loads the library into the
// rulebooks table; step 10 starts new shows from it. Each entry is a research draft until a person reviews it.
//
//   node scripts/dev-test/save-rulebook-library.js <rulebookDir> <show>[=<id>] ... [--cast=<episodeDir>] [--date=YYYY-MM-DD]
//   node scripts/dev-test/save-rulebook-library.js --recompile [<id> ...]
//
// --recompile refreshes saved entries' compiled data from their own blocks (all of them, or the ids given), after a
// compiler change made on purpose: tests/rulebook-library.test.js fails until it's run. Nothing else in an entry changes.
//
// <rulebookDir> is a check-rulebook-prompt.js out folder (its <show>/blocks.json and answer). --cast points at a
// check-episode-research.js out folder: each show's cast.json is checked against the rulebook, and a rulebook that
// names anyone in it isn't saved (a rulebook is read before anyone's watched). Refuses a rulebook with problems.
const fs = require("fs");
const path = require("path");
const R = require("../../src/lib/game/formats/rulebook-research.js");
const { compileRulebook } = require("../../src/lib/game/formats/rulebook-compile.js");
const { PRESETS } = require("./rulebook-shows");

const args = process.argv.slice(2);
const flag = (name) => args.find((a) => a.startsWith(`--${name}=`))?.split("=")[1] ?? null;
const [dir, ...picks] = args.filter((a) => !a.startsWith("--"));
if (!args.includes("--recompile") && (!dir || !picks.length)) throw new Error("usage: node scripts/dev-test/save-rulebook-library.js <rulebookDir> <show>[=<id>] ... [--cast=<episodeDir>] [--date=YYYY-MM-DD]");
const LIBRARY = path.join(__dirname, "..", "..", "src", "lib", "game", "formats", "library");
const date = flag("date") || new Date().toISOString().slice(0, 10);

if (args.includes("--recompile")) {
  const ids = args.filter((a) => !a.startsWith("--"));
  for (const file of fs.readdirSync(LIBRARY).filter((f) => f.endsWith(".rulebook.json"))) {
    const full = path.join(LIBRARY, file);
    const entry = JSON.parse(fs.readFileSync(full, "utf8"));
    if (ids.length && !ids.includes(entry.id)) continue;
    const { data, problems } = compileRulebook(entry.blocks, { id: entry.id });
    if (problems.length) {
      console.log(`${entry.id}: not refreshed, it doesn't compile: ${problems.join("; ")}`);
      process.exitCode = 1;
      continue;
    }
    const changed = JSON.stringify(entry.compiled) !== JSON.stringify(data);
    if (changed) fs.writeFileSync(full, `${JSON.stringify({ ...entry, compiled: data }, null, 2)}\n`, "utf8");
    console.log(`${entry.id}: ${changed ? "refreshed" : "already current"}`);
  }
  process.exit();
}

for (const pick of picks) {
  const [key, wantedId] = pick.split("=");
  const preset = PRESETS[key];
  if (!preset) throw new Error(`no preset "${key}"`);
  const answer = fs.readFileSync(path.join(dir, key, "answer.txt"), "utf8");
  const castFile = flag("cast") && path.join(flag("cast"), key, "cast.json");
  const castNames = castFile && fs.existsSync(castFile) ? JSON.parse(fs.readFileSync(castFile, "utf8")).names : [];
  const review = R.reviewRulebook(R.parseRulebookAnswer(answer), { castNames });
  if (review.problems.length) {
    console.log(`${key}: not saved, ${review.problems.length} problem(s): ${review.problems.map((p) => `${p.at}: ${p.message}`).join("; ")}`);
    process.exitCode = 1;
    continue;
  }
  const { data, problems } = compileRulebook(review.blocks, wantedId ? { id: wantedId } : {});
  if (problems.length) {
    console.log(`${key}: not saved, it doesn't compile: ${problems.join("; ")}`);
    process.exitCode = 1;
    continue;
  }
  const entry = {
    id: data.id,
    show: review.blocks.show || preset.show,
    status: "draft",
    researched: {
      for: [preset.show, preset.season].filter(Boolean).join(", "),
      on: date,
      by: "ChatGPT with web search, through the ask-AI bot (scripts/dev-test/check-rulebook-prompt.js)",
      castChecked: castNames.length > 0,
    },
    leftOut: review.leftOut,
    blocks: review.blocks,
    compiled: data,
  };
  fs.mkdirSync(LIBRARY, { recursive: true });
  const file = path.join(LIBRARY, `${data.id}.rulebook.json`);
  fs.writeFileSync(file, `${JSON.stringify(entry, null, 2)}\n`, "utf8");
  console.log(`${key}: saved ${path.relative(process.cwd(), file)} (${data.events.length} moments${castNames.length ? `, checked against ${castNames.length} cast names` : ", cast not checked"})`);
}
