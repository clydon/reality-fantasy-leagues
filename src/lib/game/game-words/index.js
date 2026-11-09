// The Start-a-game GPT's words to a spec (docs/PLAN-start-a-game-gpt.md step G1): the engine's manual (manual.js, generated from
// the spec's VOCAB), the context pack (pack.js), the prompts (prompt.js), reading the bot's answer (read.js) and our check
// (check.js). Pure, plain CommonJS like game-spec; the server's side is src/lib/server/game-words.ts.
/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS on purpose, see ../game-spec/schema.js */
const manual = require('./manual.js');
const pack = require('./pack.js');
const prompt = require('./prompt.js');
const read = require('./read.js');
const check = require('./check.js');
const made = require('./made.js');
/* eslint-enable @typescript-eslint/no-require-imports */

/**
 * The bot's answer to the game: read, then our check. An answer with no JSON in it is 'unreadable' (the wizard says the bot didn't
 * answer as asked, and the words can be asked again), never a throw.
 */
function checkAnswer(answer, opts = {}) {
  let read;
  try {
    read = readDraft(answer);
  } catch (e) {
    return { state: 'unreadable', why: e instanceof Error ? e.message : String(e), notes: [] };
  }
  return { ...check.checkDraft(read.draft, opts), notes: read.notes, botSummary: read.draft.summary, ...(read.draft.matchup ? { matchup: read.draft.matchup } : {}) };
}

const { readDraft } = read;

module.exports = { ...manual, ...pack, ...prompt, ...read, ...check, ...made, checkAnswer };
