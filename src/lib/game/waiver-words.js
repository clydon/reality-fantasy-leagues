// The line a waiver window is described by, with no names: the commissioner's sheet previews it
// ("Players get"), the open window's plate shows it, and the "Waiver window open" push
// (waiver-pushes.js) sends it, so all three say the same words. Plain CommonJS so the server's push
// code can require it beside state-logic.js; the rest of waivers' words are in
// src/components/waivers/waivers-words.ts. Types in waiver-words.d.ts.
// eslint-disable-next-line @typescript-eslint/no-require-imports -- CommonJS on purpose, see above
const StateLogic = require("./state-logic.js");

/** "Swap 1" / "Swap up to 2" / "Swap any": what a window allows, with no names ("" for none). */
function swapPhrase(n, roster) {
  return n <= 0 ? "" : n >= roster ? "Swap any" : n === 1 ? "Swap 1" : `Swap up to ${n}`;
}

/** "Replace who's out · Swap up to 2": what a waiver window allows, with no names. Under "Only when
 *  short", unless the window replaces everyone, only a team that's short replaces: "Replace if short". */
function windowLine(state, period) {
  const W = StateLogic.WaiverLogic;
  const R = StateLogic.rosterSize(state);
  const replaces = W.windowReplaces(state, period);
  const capped = W.replaceRule(state) === "whenShort" && period.replace !== true;
  const replace = !replaces ? "" : capped ? "Replace if short" : "Replace who's out";
  return [replace, swapPhrase(period.swaps || 0, R)].filter(Boolean).join(" · ");
}

module.exports = { swapPhrase, windowLine };
