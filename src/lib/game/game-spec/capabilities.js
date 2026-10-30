// The engine's capabilities (docs/PLAN-start-a-game-gpt.md step A5): the tracker's rows (tests/fixtures/engine-capabilities.json)
// and each one's status, worked out from the engine itself, never written by hand. scripts/engine-capabilities.js writes them
// into docs/ENGINE-CAPABILITIES.md; the engine lab (/desk/lab) shows a row's status on a real season. Pure, plain CommonJS like
// the rest of game-spec.
//
// A row is a dial's value (`dial`, `what`) or a request typed on a show's page (`page`, `words`). It says what it needs:
//   spec     the game, once the schema can say it: ✅ when specProblems (with the page's ctx) and specWaitsFor have nothing
//            against it. A spec that doesn't pass yet needs a `step`.
//   step     the step that brings it (A6..A15, L1..L6, G1, ...): ⏳ until its spec passes.
//   decide   a rule question still open: ❓.
//   planned  false: nobody plans it (🆕).
//   gpt      not a game the engine plays: the GPT asks or refuses (a typo, a show that doesn't exist, two games at once).
// So a row whose step lands turns ✅ by itself once its spec passes, and the git history of the tracker is the progress.
/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS on purpose, see ./schema.js */
const schema = require('./schema.js');
/* eslint-enable @typescript-eslint/no-require-imports */

/** The steps a row can wait on, in the plan's order. */
const STEPS = [
  'A6', 'A7', 'A8', 'A9', 'A10', 'A11', 'A12', 'A13', 'A14', 'A15',
  'L1', 'L2', 'L3', 'L4', 'L5', 'L6',
  'G1', 'G3', 'R1', 'R2', 'R3', 'U0', 'U1',
];

/** How each state reads in the tracker. */
const MARKS = { yes: '✅', step: '⏳', new: '🆕', decide: '❓', gpt: '💬' };
const WORDS = { yes: 'plays now', step: 'its step', new: 'not planned', decide: 'waits on a rule decision', gpt: "the GPT's to ask or refuse" };

/**
 * A row's status: { state: yes | step | new | decide | gpt, step, problems, waits }. `ctx`: what the page's show can settle
 * (game-spec specProblems' ctx), or null to check the shape alone.
 */
function statusOf(row, ctx) {
  const out = { state: 'new', step: row.step || null, problems: [], waits: [] };
  if (row.gpt) return { ...out, state: 'gpt' };
  if (row.spec) {
    out.problems = schema.specProblems(row.spec, ctx || null);
    out.waits = out.problems.length ? [] : schema.specWaitsFor(row.spec);
    if (!out.problems.length && !out.waits.length) return { ...out, state: 'yes' };
  }
  if (row.step) return { ...out, state: 'step' };
  if (row.decide) return { ...out, state: 'decide' };
  return out;
}

/** What's wrong with a row as written (not its status): the tracker's own rules, for its unit test. */
function rowProblems(row) {
  const out = [];
  if (!row || typeof row.id !== 'string' || !row.id) return ['a row has an id'];
  const said = [row.spec ? 'spec' : null, row.step ? 'step' : null, row.decide ? 'decide' : null, row.planned === false ? 'planned' : null, row.gpt ? 'gpt' : null].filter(Boolean);
  if (!said.length) out.push(`${row.id}: says what it needs (a spec, a step, a rule to decide, not planned, or the GPT's)`);
  if (row.step && !STEPS.includes(row.step)) out.push(`${row.id}: "${row.step}" isn't a step of the plan`);
  if (row.gpt && (row.spec || row.step)) out.push(`${row.id}: the GPT's rows have no spec or step`);
  if (!row.dial && !row.words) out.push(`${row.id}: a dial's value or a request's words`);
  if (row.words && !(row.page && (row.page.show || row.page.sport))) out.push(`${row.id}: a request is typed on a show's or a sport's page`);
  // A spec is checked against what a show can settle: never the shape alone, or a row could say it plays when the show's data
  // can't settle it.
  if (row.spec && !(row.page && row.page.rulebook)) out.push(`${row.id}: a spec is checked against a page's rulebook (a built-in, a sample, or a stand-in with checkedAs)`);
  return out;
}

/** Every row of the tracker, each with its `part`: the dials' values (with their `dial`), the worked examples typed on a show's
 *  page, the stretch requests and the words corpus. */
function rowsOf(tracker) {
  const t = tracker || {};
  return [
    ...(t.dials || []).flatMap((d) => (d.values || []).map((v) => ({ ...v, dial: d.id, part: 'dial' }))),
    ...(t.examples || []).map((r) => ({ ...r, part: 'example' })),
    ...(t.stretch || []).map((r) => ({ ...r, part: 'stretch' })),
    ...((t.corpus && t.corpus.requests) || []).map((r) => ({ ...r, part: 'corpus' })),
  ];
}

/** "Survivor 51", "football: NFL", "baseball: Red Sox–Yankees series": the page a row is typed on (or checked against). */
function pageName(p) {
  if (!p) return '';
  if (p.show) return `${p.show}${p.season ? ` ${p.season}` : ''}`;
  const where = p.event || p.league;
  return p.sport ? `${p.sport}${where ? `: ${where}` : ''}` : '';
}

module.exports = { STEPS, MARKS, WORDS, statusOf, rowProblems, rowsOf, pageName };
