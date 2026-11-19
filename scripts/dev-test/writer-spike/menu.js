// The writer spike's menu (the reader spike: how far a reader with no generative AI gets at turning a typed request into a game).
// The Start-a-game gallery's catalog (src/lib/game/start-gallery) is a closed menu that reaches every value the engine plays, so
// "words to a game" is choosing from it: a base, its changes, and their controls' values. This file lays that menu out as data a
// reader can match against: every base (name, square line, two sentences, effort, length), every change (its row, name, line,
// the kinds of game it's offered on), every control's options (value, label, sub-line), every numeric slot (a stepper's range, a
// chip's options and its "other" range), the question kinds Add a question offers and their own controls; and, per page, the
// moments research answers (id and label), the stages still to come, the properties and the cast's names.
//
// Needs: nothing but the repo (no database, no network). CommonJS, like the catalog.
//
//   const M = require("./menu.js");  M.menu()  M.pageMenu(pg)  M.slotsFor(changeId)  M.optionLabel(changeId, controlId, value)
//   node scripts/dev-test/writer-spike/menu.js            print the menu's size and a sample of each part
//   node scripts/dev-test/writer-spike/menu.js --all      print every entry
//
// Reimplemented here (the catalog doesn't export them): nothing; this only reads the catalog's exports.
/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS on purpose, like the catalog (src/lib/game/start-gallery) */
const path = require("path");
const ROOT = path.join(__dirname, "..", "..", "..");
const C = require(path.join(ROOT, "src", "lib", "game", "start-gallery", "index.js"));

const isObj = (v) => !!v && typeof v === "object" && !Array.isArray(v);
const isNum = (v) => typeof v === "number" && Number.isFinite(v);
const ROWNAME = Object.fromEntries(C.ROWS.map((r) => [r.id, r.name]));

/** A base as the reader sees it: its words, its kind of game, and whether it can be made now. */
function baseEntry(b, sport) {
  const cat = C.CATS.find((c) => c.id === b.cat) || {};
  const state = sport ? "sport" : b.coming ? "coming" : !b.spec ? "needs" : "ready";
  return {
    id: b.id, cat: b.cat, catName: cat.name || b.cat, also: b.also || null, name: b.name, plain: b.plain, about: b.about,
    effort: b.effort, len: b.len, sport: !!sport, coming: b.coming || null, needs: b.needs || null, moment: !!b.moment,
    state, kind: b.spec ? C.kindOf(C.expand(b.spec)) : null,
    doc: `${b.name}. ${b.plain}. ${b.about}`,
  };
}

/** A control's options as [{ value, label, sub }], its numeric slot when it holds a number. */
function controlEntry(change, k) {
  const options = (k.options || []).map(([value, label, sub]) => ({ value, label, sub: sub || null }));
  const numeric = k.kind === "stepper" || (k.kind === "chips" && (options.some((o) => isNum(o.value)) || isObj(k.other)));
  const slot = numeric
    ? {
        min: k.kind === "stepper" ? k.range[0] : k.other ? k.other.min : Math.min(...options.filter((o) => isNum(o.value)).map((o) => o.value)),
        max: k.kind === "stepper" ? k.range[1] : k.other ? k.other.max : Math.max(...options.filter((o) => isNum(o.value)).map((o) => o.value)),
        step: k.kind === "stepper" ? 1 : (k.other && k.other.step) || 1,
        words: options.filter((o) => !isNum(o.value)).map((o) => o.value),
      }
    : null;
  return { change, id: k.id, key: `${change}.${k.id}`, label: k.label, kind: k.kind, vocab: k.vocab || null, options, def: k.def, more: !!k.more, slot };
}

/** A change as the reader sees it: its row, words, the kinds of game it's offered on, its controls. */
function changeEntry(c) {
  return {
    id: c.id, row: c.row, rowName: ROWNAME[c.row] || c.row, name: c.name, line: c.line, icon: c.icon, kinds: c.kinds || null,
    coming: c.coming || null, sheet: c.sheet || null, start: c.start || null, sport: !!c.sport, needs: c.needs || null,
    always: !c.apply && !c.sheet && !c.start && !c.coming,
    controls: (c.controls || []).map((k) => controlEntry(c.id, k)),
    doc: `${c.name}: ${c.line}`,
  };
}

let MENU = null;
/** The page-independent menu: bases, changes, their controls and numeric slots, the question kinds and their controls. */
function menu() {
  if (MENU) return MENU;
  const bases = [...C.BASES.map((b) => baseEntry(b, false)), ...C.SPORT.map((b) => baseEntry(b, true))];
  const changes = C.CHANGES.map(changeEntry);
  const controls = changes.flatMap((c) => c.controls);
  const options = controls.flatMap((k) => k.options.map((o) => ({ change: k.change, control: k.id, ...o })));
  const slots = controls.filter((k) => k.slot);
  const questions = C.QUESTION_KINDS.map((q) => ({ ...q, doc: q.name }));
  const questionControls = C.QUESTION_CONTROLS.map((k) => controlEntry("q", k));
  MENU = { bases, changes, controls, options, slots, questions, questionControls, cats: C.CATS, rows: C.ROWS };
  return MENU;
}

/** What a page adds to the menu: its moments (what research answers), the stages still to come, properties, the cast's names. */
function pageMenu(pg) {
  const moments = ((pg && pg.moments) || []).map((m) => ({ id: m.id, label: m.label || m.id }));
  const cast = (pg && Array.isArray(pg.cast) ? pg.cast : []).map((c) => (typeof c === "string" ? c : c.name)).filter(Boolean);
  const groups = [...new Set((pg && Array.isArray(pg.cast) ? pg.cast : []).map((c) => c && c.group).filter(Boolean))];
  return {
    moments,
    later: (pg && pg.later) || [],
    phases: (pg && pg.phases) || [],
    properties: (pg && pg.properties) || [],
    cast,
    groups,
    show: (pg && pg.show) || "",
    couch: pg ? pg.couch : null,
  };
}

const baseOf = (id) => menu().bases.find((b) => b.id === id) || null;
const changeOf = (id) => menu().changes.find((c) => c.id === id) || null;
const controlOf = (change, id) => (change === "q" ? menu().questionControls : (changeOf(change) || { controls: [] }).controls).find((k) => k.id === id) || null;
const slotsFor = (change) => menu().slots.filter((k) => k.change === change);
const optionLabel = (change, control, value) => {
  const k = controlOf(change, control);
  const o = k && k.options.find((x) => String(x.value) === String(value));
  return o ? o.label : String(value);
};

/** Whether a value fits a control: one of its options, or a number in its slot's range (a chip's "other" too). */
function valueFits(k, v) {
  if (!k) return false;
  if (k.kind === "switch") return typeof v === "boolean";
  if (k.kind === "text") return typeof v === "string" && v.length <= (k.max || 40);
  if (k.kind === "checklist") return Array.isArray(v) && v.every((x) => k.options.some((o) => o.value === x));
  if (k.options.some((o) => String(o.value) === String(v))) return true;
  if (k.slot && isNum(v)) return v >= k.slot.min && v <= k.slot.max && (k.slot.step < 1 ? Math.abs(v / k.slot.step - Math.round(v / k.slot.step)) < 1e-9 : true);
  return false;
}

module.exports = { menu, pageMenu, baseOf, changeOf, controlOf, slotsFor, optionLabel, valueFits, ROWNAME };

if (require.main === module) {
  const m = menu();
  const all = process.argv.includes("--all");
  const n = (xs) => (all ? xs : xs.slice(0, 6));
  console.log(`bases ${m.bases.length} (ready ${m.bases.filter((b) => b.state === "ready").length}, coming ${m.bases.filter((b) => b.state === "coming").length}, needs ${m.bases.filter((b) => b.state === "needs").length}, sport ${m.bases.filter((b) => b.sport).length}); changes ${m.changes.length}; controls ${m.controls.length}; options ${m.options.length}; numeric slots ${m.slots.length}; question kinds ${m.questions.length}; question controls ${m.questionControls.length}`);
  for (const b of n(m.bases)) console.log(`  base ${b.id} [${b.cat}, ${b.kind || b.state}] ${b.name}: ${b.plain}`);
  for (const c of n(m.changes)) console.log(`  change ${c.id} [${c.rowName}${c.kinds ? `, ${c.kinds.join("/")}` : ""}${c.coming ? `, coming ${c.coming}` : ""}] ${c.name}: ${c.line}`);
  for (const k of n(m.slots)) console.log(`  slot ${k.key} "${k.label}" ${k.slot.min}..${k.slot.max}${k.options.length ? ` (${k.options.map((o) => o.label).join(", ")})` : ""}`);
  for (const q of n(m.questions)) console.log(`  question ${q.id}: ${q.name} (${q.answer}, ${q.settle.by}:${q.settle.take || ""})`);
}
