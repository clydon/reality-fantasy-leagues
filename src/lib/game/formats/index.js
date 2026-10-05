// The format registry: which game rules a show plays by (docs/PLAN-show-formats.md). The database
// only says which format a show uses (shows.format); the rules themselves are code, here.
//
// Plain CommonJS for the same reason state-logic.js is: the browser bundle, the Next routes and the
// bare-node connectors in db/ all read it.
/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS on purpose, see above */
const survivor = require('./survivor.js');
const traitors = require('./traitors.js');
const challenge = require('./challenge.js');
const generic = require('./generic.js');
/* eslint-enable @typescript-eslint/no-require-imports */

const FORMATS = { survivor, traitors, challenge, generic };

// Every show and league predates formats and has played by Survivor's rules, so that's what an absent
// or unknown id means. Reading it this way (rather than backfilling) matters because league rows are
// read straight out of Postgres without migrateLeagueState running on them.
const DEFAULT_FORMAT = 'survivor';

function formatFor(id) {
  return FORMATS[id] || FORMATS[DEFAULT_FORMAT];
}

/** Picker options: [{ id, name }]. */
function formatOptions() {
  return Object.values(FORMATS).map((f) => ({ id: f.id, name: f.name }));
}

module.exports = { FORMATS, DEFAULT_FORMAT, formatFor, formatOptions };
