// Pieces built and checked but off (VOCAB 'later' until the user says yes), for the tests and records that keep their built code
// checked: [VOCAB key, value]. A14 part 7's outside number (the user said no to TVmaze's ratings as a source, 2026-11-07:
// docs/PLAN-start-a-game-gpt.md, A14 part 7b). Turning one on changes the schema module in this process only (each test file
// is its own). A piece turned on for good comes out of the list.
const BUILT_OFF = [["ask.settle", "outside"]];

/** An engine's game-spec (index.js) with every BUILT_OFF piece on, for good in this process. */
function builtOn(G) {
  for (const [key, v] of BUILT_OFF) if (G.VOCAB[key] && v in G.VOCAB[key]) G.VOCAB[key][v] = "now";
  return G;
}

/** `fn` (sync or async) with every BUILT_OFF piece on, each put back as it was after. */
function withBuilt(G, fn) {
  return async (...args) => {
    const was = BUILT_OFF.filter(([key, v]) => G.VOCAB[key] && v in G.VOCAB[key]).map(([key, v]) => [key, v, G.VOCAB[key][v]]);
    builtOn(G);
    try { return await fn(...args); } finally { for (const [key, v, x] of was) G.VOCAB[key][v] = x; }
  };
}

module.exports = { BUILT_OFF, builtOn, withBuilt };
