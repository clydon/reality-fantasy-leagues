// The format registry: which game rules a show plays by (docs/PLAN-show-formats.md). The database
// only says which format a show uses (shows.format); the rules themselves are here, each format a
// data half and a code half put together by define.js (docs/PLAN-ai-generated-show-formats.md).
//
// Plain CommonJS for the same reason state-logic.js is: the browser bundle, the Next routes and the
// bare-node connectors in db/ all read it.
/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS on purpose, see above */
const survivor = require('./survivor.js');
const traitors = require('./traitors.js');
const challenge = require('./challenge.js');
const generic = require('./generic.js');
const { formatProblems } = require('./define.js');
const { buildDataFormat } = require('./custom.js');
/* eslint-enable @typescript-eslint/no-require-imports */

const FORMATS = { survivor, traitors, challenge, generic };

// Every show and league predates formats and has played by Survivor's rules, so that's what an absent
// or unknown id means. Reading it this way (rather than backfilling) matters because league rows are
// read straight out of Postgres without migrateLeagueState running on them.
const DEFAULT_FORMAT = 'survivor';

// Stored formats (docs/PLAN-stage-3-format-proposals.md) built once per data object: a league's state
// hands the same cached object in on every read.
const built = new WeakMap();

function isBuiltInFormat(id) {
  return Object.prototype.hasOwnProperty.call(FORMATS, id);
}

/**
 * The rules for format `id`. A built-in id is always the built-in. Any other id is a stored format, and
 * resolves from `data` -- its data half, cached alongside the id (a league's settings.showFormatData, a
 * show's show_formats row) -- when that's given and is for the same id. Otherwise, as ever, the default.
 */
function formatFor(id, data) {
  if (isBuiltInFormat(id)) return FORMATS[id];
  if (id && data && typeof data === 'object' && data.id === id) {
    let format = built.get(data);
    if (!format) {
      format = buildDataFormat(data);
      built.set(data, format);
    }
    return format;
  }
  return FORMATS[DEFAULT_FORMAT];
}

/** Picker options: [{ id, name }]. */
function formatOptions() {
  return Object.values(FORMATS).map((f) => ({ id: f.id, name: f.name }));
}

// A league's own ruleset copy (db/league-rulesets.js): its data always wins, even when data.id
// matches a built-in's id -- a customised copy of Survivor's rules must never resolve back to the
// hardcoded Survivor object, which is exactly what formatFor's isBuiltInFormat shortcut would do
// (it checks `id` before ever looking at `data`). So this skips that shortcut entirely.
const builtForRuleset = new WeakMap();
function formatForRuleset(data) {
  let format = builtForRuleset.get(data);
  if (!format) {
    format = buildDataFormat(data);
    builtForRuleset.set(data, format);
  }
  return format;
}

module.exports = { FORMATS, DEFAULT_FORMAT, formatFor, formatForRuleset, isBuiltInFormat, formatOptions, formatProblems };
