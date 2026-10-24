// What's still Preview in the new design (docs/PLAN-new-design.md, "The Preview system"), per step, and whether that
// agrees with the plan. Fails when:
//   - a step marked **done** in the plan's Status table still has entries in src/new/preview.ts, or fixture modules
//     in src/new/fixtures/ whose `export const STEP = "..."` is that step (each step deletes its own);
//   - an entry in the registry is used nowhere (its id appears in no file under src/new or src/app/(new)).
// A <Preview id> naming an entry that isn't registered doesn't type-check (PreviewId), so tsc catches that one.
//
//   node scripts/dev-test/check-preview.js
//
// No server, no database. Run it at the end of every step (the plan's "Done means"); at step C the registry and the
// fixtures folder are empty, and both go.
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..", "..");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(root, "src") } });
const { PREVIEWS } = jiti("../../src/new/preview.ts");

let failures = 0;
const fail = (msg) => {
  console.log("FAIL  " + msg);
  failures++;
};

// The plan's Status table: | step | what | state | model |; a step is done when its state says **done**.
const plan = fs.readFileSync(path.join(root, "docs", "PLAN-new-design.md"), "utf8");
const done = new Set();
for (const line of plan.split(/\r?\n/)) {
  const m = /^\|\s*([0-9]+[a-z]?|R[0-9]|C)\s*\|[^|]*\|\s*([^|]*)\|/.exec(line);
  if (m && /\*\*done\*\*/.test(m[2])) done.add(m[1]);
}

// Every source file of the new design.
function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(tsx?|css)$/.test(e.name)) out.push(p);
  }
  return out;
}
const registry = path.join(root, "src", "new", "preview.ts");
const sources = [...walk(path.join(root, "src", "new")), ...walk(path.join(root, "src", "app", "(new)"))].filter((f) => f !== registry);
const text = sources.map((f) => fs.readFileSync(f, "utf8")).join("\n");

// Registry entries, by step.
const byStep = new Map();
for (const [id, entry] of Object.entries(PREVIEWS)) {
  if (!byStep.has(entry.step)) byStep.set(entry.step, []);
  byStep.get(entry.step).push(id);
  if (!text.includes(`"${id}"`)) fail(`${id} is registered but used nowhere: delete it from src/new/preview.ts`);
}

// Fixture modules, by the step that deletes them.
const fixtureDir = path.join(root, "src", "new", "fixtures");
const fixtures = new Map();
for (const f of fs.existsSync(fixtureDir) ? walk(fixtureDir) : []) {
  const m = /^export const STEP = "([^"]+)"/m.exec(fs.readFileSync(f, "utf8"));
  if (!m) continue; // index.ts: the convention, no data
  if (!fixtures.has(m[1])) fixtures.set(m[1], []);
  fixtures.get(m[1]).push(path.relative(fixtureDir, f).replace(/\\/g, "/"));
}

const steps = [...new Set([...byStep.keys(), ...fixtures.keys()])].sort((a, b) => parseFloat(a) - parseFloat(b) || a.localeCompare(b));
console.log(`Still Preview, by the step that makes it real (${Object.keys(PREVIEWS).length} entries):`);
for (const step of steps) {
  const ids = byStep.get(step) ?? [];
  const fx = fixtures.get(step) ?? [];
  console.log(`  ${step.padEnd(3)} ${ids.join(", ")}${fx.length ? `${ids.length ? "; " : ""}fixtures: ${fx.join(", ")}` : ""}`);
  if (done.has(step)) fail(`step ${step} is marked done in the plan's Status but still has ${[...ids, ...fx].join(", ")}`);
}
if (!steps.length) console.log("  nothing: the registry and fixtures are empty (step C deletes them)");
console.log(`Done in the plan: ${[...done].join(", ") || "none"}`);
console.log(failures ? `\n${failures} failed` : "\nall passed");
process.exitCode = failures ? 1 : 0;
