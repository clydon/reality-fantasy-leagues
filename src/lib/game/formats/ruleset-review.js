// A league's own ruleset (db/league-rulesets.js, docs/PLAN-scoring-rules-as-data.md phase 4): the
// rule-list editor for a FormatData that's already valid (forked from a built-in, an approved
// show_format, or another league's shared ruleset) -- unlike proposal.js's reviewProposal, there's no
// raw chat answer to repair here, just edits to re-validate as they're made.
//
// Shares reviewProposal's "what does a row award, where does a formatProblems message belong" logic
// (awardsOf, locate) so the two screens' rule rows stay the same shape without duplicating it.
//
// Plain CommonJS, like everything in formats/. Pure: never touches the database or the network.
/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS on purpose, see index.js */
const { formatProblems } = require('./define.js');
const { describeRule } = require('./rules.js');
const { awardsOf, locate } = require('./proposal.js');
/* eslint-enable @typescript-eslint/no-require-imports */

// Asked on every format regardless of what a league customises -- never offered as a rule condition,
// same exclusion the editor's ruleFieldProps already applies elsewhere (format-review-screen.tsx).
const CORE_QUESTION_KEYS = ['name', 'leftTheGame', 'exitMethod', 'sources', 'confidence'];

/**
 * data -> { problems, approvable, categories, otherRules, questions, exitMethods, leftoverProblems }.
 * `problems` is `formatProblems(data)` located to a row, same as reviewProposal's. `categories` groups
 * events as `data.eventCategories` already does (not re-derived from a per-event `category` field --
 * a FormatData has no such field, unlike a Proposal row); each event's rules come back as sentences,
 * via `describeRule`, ready for RuleLine (format-review-screen.tsx) to render and edit in place.
 */
function reviewRuleset(data) {
  const research = Array.isArray(data && data.rules && data.rules.research) ? data.rules.research : [];
  const implied = Array.isArray(data && data.rules && data.rules.implied) ? data.rules.implied : [];
  const questionKeys = ((data && data.research && data.research.checklist) || []).map((f) => f.key);
  const problems = formatProblems(data).map((m) => locate(m, questionKeys));
  const at = (prefix) => (x) => x.at === prefix;

  const sentence = (r) => describeRule(r, data);
  const allRules = [
    ...research.map((r, i) => ({ r, at: `rules.research[${i}]` })),
    ...implied.map((r, i) => ({ r, at: `rules.implied[${i}]` })),
  ];
  const rulesFor = (eid) =>
    allRules.filter(({ r }) => awardsOf(r).includes(eid)).map(({ r, at: where }) => ({ at: where, sentence: sentence(r) }));

  const events = Array.isArray(data && data.events) ? data.events : [];
  const categories = (Array.isArray(data && data.eventCategories) ? data.eventCategories : []).map((g) => ({
    label: g.label,
    events: (Array.isArray(g.events) ? g.events : [])
      .map((id) => events.find((e) => e.id === id))
      .filter(Boolean)
      .map((e) => ({
        id: e.id,
        label: e.label,
        implied: !!e.implied,
        rules: rulesFor(e.id),
        problems: problems.filter(at(`events[${e.id}]`)).map((x) => x.message),
      })),
  }));

  const otherRules = allRules
    .filter(({ r }) => !awardsOf(r).some((a) => events.some((e) => e.id === a)))
    .map(({ r, at: where }) => ({ at: where, sentence: sentence(r), problems: problems.filter(at(where)).map((x) => x.message) }));

  const questions = ((data && data.research && data.research.checklist) || [])
    .filter((f) => !CORE_QUESTION_KEYS.includes(f.key))
    .map((f) => ({ key: f.key, type: f.type, values: f.values }));

  const exitMethods = Array.isArray(data && data.exitMethods) ? data.exitMethods : [];
  const categoryOptions = categories.map((g) => g.label);

  const shownAts = new Set([
    ...categories.flatMap((g) => g.events.flatMap((e) => [`events[${e.id}]`, ...e.rules.map((r) => r.at)])),
    ...otherRules.map((r) => r.at),
  ]);
  const leftoverProblems = problems.filter((p) => !shownAts.has(p.at));

  return { problems, approvable: problems.length === 0, categories, otherRules, questions, exitMethods, categoryOptions, leftoverProblems };
}

module.exports = { reviewRuleset };
