// A season's own added moments (docs/PLAN-start-a-game-gpt.md step G1 part 4): a moment the show's research didn't answer, typed
// to the GPT ("did someone cry?"), rated by the feasibility ask (game-words prompt.js momentPrompt) at the bar, and added to the
// season's rulebook as a moment research answers after every episode from the one after it was added. It's a moment added by hand
// (rulebook-moments.js customMoments) with `addedFrom`, the first episode research asks it about, answered by research and worth 0
// in the rulebook's own points: no game scores it but one that names it, so a game already playing is untouched.
//
// Research asks it in two places, as episode facts are (db/facts-research.js): the full run's checklist (the rulebook compiles it
// in, a yes, no or unknown for each person) and, for what that left unknown, a short ask of its own after it (db/moments-research.js,
// bot research's 'moments' run), filed into the stored answer as a second pass fills in: a yes or no already there is never
// replaced. An episode research still can't settle is void for a question on it (answers.js: no points either way), and one
// before `addedFrom` was never asked.
//
// This is what's shared by what reads them: the season's added moments from its blocks, how a stored answer stands on one (yes,
// with who; no; unsure), and the run's answer filed into a stored answer. Plain CommonJS, browser-safe, like everything in formats/.

/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS on purpose, as everything in formats/ */
const { questionFor } = require('./rulebook-moments.js');
/* eslint-enable @typescript-eslint/no-require-imports */

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const list = (v) => (Array.isArray(v) ? v : []);
const text = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null);

/** How many moments a season can have added (each one is asked after every episode). */
const MAX_ADDED = 12;

/**
 * A season's added moments, from its rulebook's blocks: each moment added by hand with `addedFrom`, answered by research, yes or
 * no for each person. [{ id, label, question, from }], in the blocks' order, its question its own or the one the rulebook asks it
 * by (rulebook-moments.js questionFor), so the short ask and the full run's checklist ask the same thing. Pure.
 */
function addedOf(blocks) {
  return list(isObj(blocks) ? blocks.customMoments : null)
    .filter((m) => isObj(m) && text(m.id) && Number.isInteger(m.addedFrom) && m.addedFrom >= 1 && m.answeredBy === 'research' && m.counted === 'yesNo' && !m.uses)
    .map((m) => ({ id: m.id, label: m.label, question: text(m.question) || questionFor({ label: m.label, counted: 'yesNo' }, blocks), from: m.addedFrom }));
}

/** A person's answer to a yes-or-no question, as research stores it: 'yes', 'no', or null (unknown, missing, anything else). */
const said = (v) => (v === 'yes' || v === true ? 'yes' : v === 'no' || v === false ? 'no' : null);

/**
 * How a stored answer's people (`castaways`: [{ name, [key]: 'yes' | 'no' | 'unknown' }]) stand on one moment: { state: 'yes',
 * who: [names] } once anyone's is yes; { state: 'no' } when everyone's is no; else { state: 'unsure' } (research couldn't say, or
 * wasn't asked). `among`, names: only these people count (who was in the episode); left out, everyone the answer lists. Pure.
 */
function standingOf(castaways, key, among = null) {
  const keep = among ? new Set(among) : null;
  const people = list(castaways).filter((c) => isObj(c) && text(c.name) && (!keep || keep.has(c.name)));
  const who = people.filter((c) => said(c[key]) === 'yes').map((c) => c.name);
  if (who.length) return { state: 'yes', who };
  if (people.length && people.every((c) => said(c[key]) === 'no')) return { state: 'no' };
  return { state: 'unsure' };
}

/** The added moments (addedOf's) a stored answer about episode `n` leaves unsure: the ones the moments run asks. Pure. */
function unsureIn(castaways, moments, n) {
  return list(moments).filter((m) => Number.isInteger(n) && n >= m.from && standingOf(castaways, m.id).state === 'unsure');
}

/**
 * The run's answers (`answers`: { [id]: { happened: 'yes' | 'no' | 'unknown', who: [names], sure: 'high' | 'low' } }) filed into a
 * stored answer's people: a sure yes is a yes for each person it names (found by their exact name) and a no for everyone else; a
 * sure no is a no for everyone; anything else changes nothing. Only a person whose answer isn't yes or no already changes (a
 * second pass fills in, never over what research said), and a yes whose people research already said no for changes nothing (it
 * disagrees with research: left unsure, never turned into everyone's no). -> { castaways (a copy), changed: [ids] }. Pure.
 */
function fillMoments(castaways, answers) {
  const out = list(castaways).map((c) => (isObj(c) ? { ...c } : c));
  const changed = new Set();
  for (const [id, a] of Object.entries(isObj(answers) ? answers : {})) {
    if (!isObj(a) || a.sure !== 'high') continue;
    if (a.happened !== 'yes' && a.happened !== 'no') continue;
    const names = new Set(list(a.who).filter((n) => typeof n === 'string'));
    // A yes that names nobody on the list can't say who, and one that names only people research said no for disagrees with it:
    // either changes nothing.
    if (a.happened === 'yes' && !out.some((c) => isObj(c) && names.has(c.name) && said(c[id]) !== 'no')) continue;
    for (const c of out) {
      if (!isObj(c) || !text(c.name) || said(c[id]) !== null) continue;
      c[id] = a.happened === 'yes' && names.has(c.name) ? 'yes' : 'no';
      changed.add(id);
    }
  }
  return { castaways: out, changed: [...changed] };
}

module.exports = { MAX_ADDED, addedOf, standingOf, unsureIn, fillMoments };
