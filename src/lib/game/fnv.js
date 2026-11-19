// FNV-1a over a string, as an unsigned 32-bit number: the one hash that computer players' tastes and guesses (bot-logic.js,
// calls.ts), a waiver's fill (state-logic.js) and a game's fingerprint (game-rules.ts) share. It was four hand copies, which could
// drift apart silently (the branch review before the wizard lane's merge, 2026-11-19). Every copy computed exactly this, so nothing
// stored or seeded from it changes.
function fnv1a(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193) >>> 0;
  return h;
}

/** FNV-1a scaled to [0, 1). */
function fnvUnit(text) {
  return fnv1a(text) / 4294967296;
}

module.exports = { fnv1a, fnvUnit };
