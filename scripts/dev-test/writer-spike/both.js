// The writer spike's cascade: the words reader first (words.js, no model, a few milliseconds); the meaning reader (meaning.js,
// the local bge-small model) only when words is unsure. Sure when whichever answered is sure. When both are unsure it keeps the
// words reader's best guess (for the harness's best-guess F1) and both readers' reasons.
//
// Needs: what meaning.js needs (the local model in .models/), only for requests the words reader is unsure of. CommonJS.
//   const B = require("./both.js");  await B.read(text, pg)   await B.edit(text, current, pg)
/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS on purpose, like the catalog (src/lib/game/start-gallery) */
const W = require("./words.js");
const R = require("./meaning.js");

async function read(text, pg) {
  const w = W.read(text, pg);
  if (w.sure) return { ...w, by: "words" };
  const m = await R.read(text, pg);
  if (m.sure) return { ...m, by: "meaning", why: [] };
  return { ...w, sure: false, by: "neither", why: [...w.why.map((x) => `words: ${x}`), ...m.why.map((x) => `meaning: ${x}`)], meaning: m };
}

async function edit(text, current, pg) {
  const w = W.edit(text, current, pg);
  if (w.sure) return { ...w, by: "words" };
  const m = await R.edit(text, current, pg);
  if (m.sure) return { ...m, by: "meaning", why: [] };
  return { ...w, sure: false, by: "neither", why: [...w.why.map((x) => `words: ${x}`), ...m.why.map((x) => `meaning: ${x}`)] };
}

module.exports = { read, edit };
