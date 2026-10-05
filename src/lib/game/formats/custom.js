// Data-only formats: a show's rules built from its data half alone, with a default code half, so a
// format nobody hand-wrote -- one an admin approved from a research proposal
// (docs/PLAN-stage-3-format-proposals.md) and stored in the database -- runs everywhere a built-in one
// does. Its scoring is already data (rules.js); what this supplies is the rest of the code half:
//
//   wiki      generic's read (who left, and how), with this format's own exit methods. The proposal
//             path is research-first, so a stored format carries no show-specific table vocabulary.
//   research  entryProblems: none beyond what validateResearch checks on every format (an exit method
//             on someone who didn't leave, a claim with no source). notes/sentences: built from the
//             checklist -- each question's `note` (checklist.js) for a yes, the number for a count, the
//             text for a text answer.
//
// No secret roles: a role mechanic is exactly what a proposal flags for a developer instead.
//
// Plain CommonJS, like everything in formats/.
/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS on purpose, see index.js */
const { defineFormat } = require('./define.js');
const { CORE_FIELDS } = require('./checklist.js');
/* eslint-enable @typescript-eslint/no-require-imports */

const words = (key) => String(key).replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase();
const listOf = (v) => (Array.isArray(v) ? v : v ? [v] : []).filter(Boolean);

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
  for (const f of data.research.checklist) {
    if (f.key in CORE_FIELDS) continue;
    const v = c[f.key];
    const label = f.note || words(f.key);
    if (f.type === 'answer') {
      if (v === 'yes') out.push(label);
    } else if (f.type === 'integer') {
      if (typeof v === 'number' && v > 0) out.push(`${label}: ${v}`);
    } else if (f.type === 'stringList') {
      if (listOf(v).length) out.push(`${label}: ${listOf(v).join(', ')}`);
    } else if (typeof v === 'string' && v.trim()) {
      out.push(`${label}: ${v}`);
    }
  }
  return out;
}

function researchCode(data) {
  return {
    entryProblems: () => [],
    notes: (c) => phrases(data, c, false),
    sentences: (c) => phrases(data, c, true),
  };
}

/** A runtime format from a data half alone (throws, like defineFormat, if the data isn't usable). */
function buildDataFormat(data) {
  if (data && data.roles) throw new Error(`format ${data.id}: a data-only format can't have secret roles yet`);
  return defineFormat(data, { wiki: wikiCode(data), research: researchCode(data) });
}

module.exports = { buildDataFormat };
