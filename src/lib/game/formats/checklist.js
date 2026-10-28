// A research checklist as data: what research asks about each person (and about the episode), written
// as a list of field descriptions rather than a hand-written Zod schema, so a format's checklist can be
// stored, cloned, reviewed and -- once docs/PLAN-ai-generated-show-formats.md's phase 3 exists --
// proposed by a model. buildChecklist turns the list back into the same Zod schema the connectors have
// always been handed (db/episode-research.js), field for field.
//
// One field:
//
//   { key: 'votesReceived', type: 'integer', nullable: true, description: 'How many votes...' }
//
//   type        answer      the shared yes / no / unknown enum (research's `Answer`)
//               string      free text
//               integer     a whole number
//               number      any number: an amount that needn't be whole (innings pitched, 6.67)
//               enum        one of `values`
//               exitMethod  one of the format's own exit methods
//               stringList  a list of strings (names, URLs)
//   nullable    may be null (unknown, or doesn't apply)
//   description what the model is asked; becomes the JSON schema's description
//   note        optional: a short phrase for a reviewer when the answer is yes / has a value ("at
//               risk"), or a template of the answer ("{value} votes against"), or false for none. Not
//               part of the schema. A data-only format (custom.js, research-review.js) builds its
//               research notes from it; the hand-written formats write their own notes and don't use it.
//   sentence    optional: the same for semantic search, when it reads differently from the note
//   shown       optional: when the note is said, a condition on the person's answers (rules.js)
//
// Modifiers apply in one fixed order -- type, then nullable, then description -- because that's the
// order every hand-written checklist used, and the JSON schema zod emits depends on it (a description
// given before .nullable() lands on the inner type instead of the field).
//
// Plain CommonJS with no dependencies, like the formats themselves: `z` and `Answer` are handed in.

const TYPES = ['answer', 'string', 'integer', 'number', 'enum', 'exitMethod', 'stringList'];
const FIELD_PROPS = ['key', 'type', 'nullable', 'values', 'description', 'note', 'sentence', 'shown'];

// Fields the shared research code reads by name on every format (validateResearch, itemsFromChecklist,
// printResearch), so every checklist must have them, with these types.
const CORE_FIELDS = {
  name: { type: 'string', nullable: false },
  leftTheGame: { type: 'answer', nullable: false },
  exitMethod: { type: 'exitMethod', nullable: true },
  sources: { type: 'stringList', nullable: false },
  confidence: { type: 'enum', nullable: false, values: ['high', 'medium', 'low'] },
};
// Read by name too, but only when a format asks it: a finalist's jury votes (Survivor).
const OPTIONAL_FIELDS = {
  juryVotesReceived: { type: 'integer', nullable: true },
};

const KEY = /^[a-z][A-Za-z0-9]*$/;

/** Why a list of fields isn't a usable checklist: [] when it is. `reserved` are keys it may not use. */
function fieldProblems(fields, { reserved = [] } = {}) {
  if (!Array.isArray(fields)) return ['fields: not a list'];
  const problems = [];
  const seen = new Set();
  fields.forEach((f, i) => {
    const at = f && typeof f.key === 'string' ? f.key : `field ${i}`;
    if (!f || typeof f !== 'object' || Array.isArray(f)) {
      problems.push(`${at}: not an object`);
      return;
    }
    for (const prop of Object.keys(f)) if (!FIELD_PROPS.includes(prop)) problems.push(`${at}: unknown property "${prop}"`);
    if (typeof f.key !== 'string' || !KEY.test(f.key)) problems.push(`${at}: key must be a camelCase identifier`);
    else if (seen.has(f.key)) problems.push(`${at}: key used twice`);
    else if (reserved.includes(f.key)) problems.push(`${at}: key is reserved`);
    seen.add(f.key);
    if (!TYPES.includes(f.type)) problems.push(`${at}: type must be one of ${TYPES.join(', ')}`);
    if ('nullable' in f && typeof f.nullable !== 'boolean') problems.push(`${at}: nullable must be true or false`);
    if ('description' in f && (typeof f.description !== 'string' || !f.description.trim())) {
      problems.push(`${at}: description must be non-empty text`);
    }
    for (const k of ['note', 'sentence']) {
      if (k in f && f[k] !== false && (typeof f[k] !== 'string' || !f[k].trim())) problems.push(`${at}: ${k} must be non-empty text, or false`);
    }
    if ('shown' in f && (!f.shown || typeof f.shown !== 'object' || Array.isArray(f.shown))) problems.push(`${at}: shown must be a condition`);
    if (f.type === 'enum') {
      const v = f.values;
      if (!Array.isArray(v) || !v.length || !v.every((x) => typeof x === 'string' && x)) problems.push(`${at}: an enum needs a list of values`);
      else if (new Set(v).size !== v.length) problems.push(`${at}: an enum value is listed twice`);
    } else if ('values' in f) {
      problems.push(`${at}: only an enum has values`);
    }
  });
  return problems;
}

/** fieldProblems, plus the fields the shared research code depends on. */
function checklistProblems(fields) {
  const problems = fieldProblems(fields);
  if (problems.length) return problems;
  const byKey = new Map(fields.map((f) => [f.key, f]));
  const check = (key, want, required) => {
    const f = byKey.get(key);
    if (!f) {
      if (required) problems.push(`${key}: missing (the research code reads it on every format)`);
      return;
    }
    if (f.type !== want.type || !!f.nullable !== want.nullable) {
      problems.push(`${key}: must be ${want.nullable ? 'a nullable ' : ''}${want.type}`);
    } else if (want.values && JSON.stringify(f.values) !== JSON.stringify(want.values)) {
      problems.push(`${key}: values must be ${want.values.join(', ')}`);
    }
  };
  for (const [key, want] of Object.entries(CORE_FIELDS)) check(key, want, true);
  for (const [key, want] of Object.entries(OPTIONAL_FIELDS)) check(key, want, false);
  return problems;
}

// One field's Zod schema. `Answer` is returned as-is when there's nothing to add to it, as the
// hand-written episode fields did ({ tribalCouncilHeld: Answer }).
function fieldSchema(f, z, Answer, exitMethods) {
  let s;
  if (f.type === 'answer') s = Answer;
  else if (f.type === 'string') s = z.string();
  else if (f.type === 'integer') s = z.number().int();
  else if (f.type === 'number') s = z.number();
  else if (f.type === 'enum') s = z.enum(f.values);
  else if (f.type === 'exitMethod') s = z.enum(exitMethods);
  else if (f.type === 'stringList') s = z.array(z.string());
  else throw new Error(`checklist field ${f.key}: unknown type ${f.type}`);
  if (f.nullable) s = s.nullable();
  if (f.description != null) s = s.describe(f.description);
  return s;
}

/** The fields as a Zod shape ({ key: schema }), in their listed order. */
function buildShape(fields, z, Answer, exitMethods) {
  const shape = {};
  for (const f of fields) shape[f.key] = fieldSchema(f, z, Answer, exitMethods);
  return shape;
}

/** One person's checklist as a Zod object. */
function buildChecklist(fields, z, Answer, exitMethods) {
  return z.object(buildShape(fields, z, Answer, exitMethods));
}

module.exports = { TYPES, CORE_FIELDS, fieldProblems, checklistProblems, buildShape, buildChecklist };
