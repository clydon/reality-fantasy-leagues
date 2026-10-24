// The rulebook behind any format (docs/PLAN-rulebooks-implementation.md 4.5): the hand-written blocks for
// Survivor, The Traitors and The Challenge, and for any other format (a stored one research made, or the
// generic fallback) the blocks read back from its data half (rulebook-from-format.js). Each comes with the
// aliases that tie its moments to the event ids and exit methods leagues have recorded.
//
//   rulebookFor(formatId, data?) -> { blocks, aliases, builtIn }
//
// Plain CommonJS, browser-safe, like everything in formats/.
/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS on purpose, see ../index.js */
const survivor = require('./survivor.blocks.js');
const traitors = require('./traitors.blocks.js');
const challenge = require('./challenge.blocks.js');
const { blocksFromFormat } = require('../rulebook-from-format.js');
const { FORMATS, DEFAULT_FORMAT } = require('../index.js');
/* eslint-enable @typescript-eslint/no-require-imports */

const BUILT_IN_BLOCKS = { survivor, traitors, challenge };

// Read back once per data object (a league's state hands the same cached object in on every read).
const derived = new WeakMap();

/**
 * The rulebook for a format id: a built-in's own blocks, else the blocks read from `data` (a stored format's
 * data half), else, for a built-in without hand-written blocks (generic), from its own data. An unknown id
 * with no data is Survivor, as formatFor reads it.
 */
function rulebookFor(formatId, data) {
  if (Object.prototype.hasOwnProperty.call(BUILT_IN_BLOCKS, formatId)) return { ...BUILT_IN_BLOCKS[formatId], builtIn: true };
  const source = data && typeof data === 'object' ? data : FORMATS[formatId] ? FORMATS[formatId].data : null;
  if (!source) return { ...BUILT_IN_BLOCKS[DEFAULT_FORMAT], builtIn: true };
  if (!derived.has(source)) derived.set(source, blocksFromFormat(source));
  return { ...derived.get(source), builtIn: false };
}

module.exports = { BUILT_IN_BLOCKS, rulebookFor };
