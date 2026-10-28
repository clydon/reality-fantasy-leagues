// Data-only formats: a show's rules built from its data half alone, with a default code half, so a
// format nobody hand-wrote -- one an admin approved from a research proposal
// (docs/PLAN-stage-3-format-proposals.md) and stored in the database -- runs everywhere a built-in one
// does. Its scoring is already data (rules.js); what this supplies is the rest of the code half:
//
//   wiki      generic's read (who left, and how), with this format's own exit methods. The proposal
//             path is research-first, so a stored format carries no show-specific table vocabulary.
//   research  entryProblems / episodeProblems: the data's own checks (research.checks, research-review.js),
//             beyond what validateResearch checks on every format (an exit method on someone who didn't
//             leave, a claim with no source). notes/sentences: built from the checklist -- each question's
//             own words (`note`, `sentence`, `shown`), else its note for a yes, the number for a count, the
//             text for a text answer.
//   roles     roleFor, when the data has secret roles (a compiled rulebook's secret-role twist,
//             rulebook-compile.js): a recorded value is the role it names, unless `roles.becomes` maps it
//             to another ("Recruited Traitor" makes someone a Traitor, and is also what scores the
//             recruitment). A research proposal still flags a role mechanic for a developer instead.
//
// Plain CommonJS, like everything in formats/.
/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS on purpose, see index.js */
const { defineFormat } = require('./define.js');
const { phrasesOf, personProblems, episodeProblems } = require('./research-review.js');
/* eslint-enable @typescript-eslint/no-require-imports */

function wikiCode(data) {
  const exits = data.exitMethods;
  return {
    episodesSchema(z) {
      return z.object({
        episodes: z.array(
          z.object({
            number: z.number().int().describe('Episode number, starting at 1.'),
            title: z.string().nullable().describe('Episode title, if given. Null if absent.'),
            airDate: z.string().nullable().describe('Air date exactly as printed. Null if absent.'),
            eliminations: z
              .array(
                z.object({
                  name: z.string().describe("The person's FULL name."),
                  method: z.enum(exits).describe(`How they left: one of ${exits.join(', ')}. Use Other only if none fit.`),
                })
              )
              .describe('Everyone who left the game PERMANENTLY in THIS episode, in the order they left.'),
            events: z.array(z.object({ type: z.enum(['placeholder']), name: z.string() })).describe('Unused for this format.'),
          })
        ),
      });
    },
    episodesPrompt() {
      return {
        system:
          `You extract structured data from wiki or recap text about a season of ${data.name}. Report only ` +
          "what the text actually states. Never infer, complete or correct anything from outside knowledge " +
          "of the show -- if a field isn't in the text, return null, and if you cannot tell whether someone " +
          'left this episode, omit them rather than guessing.',
        user: 'Extract the per-episode record for this season: who left each episode and how.',
      };
    },
    rejectEvent: () => null,
  };
}

// One person's answers as phrases, listing only what happened. `sentence` is the slightly fuller form
// semantic search reads (db/embeddings.js).
function phrases(data, c, sentence) {
  const out = [];
  if (c.leftTheGame === 'yes') out.push(sentence ? `left the game (${c.exitMethod || 'method unknown'})` : `OUT — ${c.exitMethod || 'method unknown'}`);
  out.push(...phrasesOf(data.research.checklist, c, { sentence }));
  return out;
}

function researchCode(data) {
  const checks = data.research.checks || [];
  return {
    entryProblems: (entry) => personProblems(checks, entry),
    episodeProblems: (payload) => episodeProblems(checks, payload),
    notes: (c) => phrases(data, c, false),
    sentences: (c) => phrases(data, c, true),
  };
}

function rolesCode(data) {
  const becomes = data.roles.becomes || {};
  return { roleFor: (value) => (Object.prototype.hasOwnProperty.call(becomes, value) ? becomes[value] : value) };
}

/** A runtime format from a data half alone (throws, like defineFormat, if the data isn't usable). */
function buildDataFormat(data) {
  const code = { wiki: wikiCode(data), research: researchCode(data) };
  if (data && data.roles) code.roles = rolesCode(data);
  const format = defineFormat(data, code);
  // Its code half is built FROM its data, so changed data (a season rule change) rebuilds through here
  // rather than reusing code that closed over the old data.
  Object.defineProperty(format, 'dataOnly', { value: true, enumerable: false });
  return format;
}

module.exports = { buildDataFormat, rolesCode };
