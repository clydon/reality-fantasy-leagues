// The rulebook library (docs/PLAN-rulebooks-implementation.md decision 2's library, phase 8): researched rulebooks for
// shows with no hand-written rules, each its blocks and its compiled format data together, so nothing researches or
// compiles them again. R3's backfill loads them into the rulebooks table as library entries; step 10's Make it a game
// starts a new show from the nearest one. Every entry is a research draft (`status: 'draft'`) until a person reviews
// it in the editor (step 6b).
//
// Saved by scripts/dev-test/save-rulebook-library.js from a check-rulebook-prompt.js run; tests/rulebook-library.test.js
// keeps each one valid, its compiled data what its blocks compile to, and free of names and results. About 170 KB:
// read it on the server, not in a page's bundle.
/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS on purpose, see ../index.js */
const LIBRARY = {
  'below-deck': require('./below-deck.rulebook.json'),
  'saturday-night-live': require('./saturday-night-live.rulebook.json'),
  scrubs: require('./scrubs.rulebook.json'),
  'the-amazing-race': require('./the-amazing-race.rulebook.json'),
  'the-real-housewives-of-beverly-hills': require('./the-real-housewives-of-beverly-hills.rulebook.json'),
  'world-series': require('./world-series.rulebook.json'),
};
/* eslint-enable @typescript-eslint/no-require-imports */

/** A library entry by id, or null. */
function libraryRulebook(id) {
  return Object.prototype.hasOwnProperty.call(LIBRARY, id) ? LIBRARY[id] : null;
}

module.exports = { LIBRARY, libraryRulebook };
