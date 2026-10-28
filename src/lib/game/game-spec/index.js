// The game spec: a game as data (docs/PLAN-start-a-game-gpt.md, step A1). The schema, today's five games as presets,
// every league's spec from its settings and back, the spec in words, and what's wrong with one (with the rule that data
// settles everything it scores). Pure, no engine change yet: A2 has state-logic.js play from it. Types in index.d.ts.
//
//   ./schema.js    the schema, VOCAB (who builds each value), PRESETS, fullSpec, typeOf, specProblems, specWaitsFor
//   ./settings.js  specOf(settings), settingsOf(spec), withSpec, ownedFields; OWNED and OUTSIDE
//   ./describe.js  describeSpec: the wizard's sentence, How it works and the details
/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS on purpose, see ./schema.js */
const schema = require('./schema.js');
const settings = require('./settings.js');
const { describeSpec } = require('./describe.js');
/* eslint-enable @typescript-eslint/no-require-imports */

module.exports = { ...schema, ...settings, describeSpec };
