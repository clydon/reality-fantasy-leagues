// Episode facts (docs/PLAN-start-a-game-gpt.md step A13 part 2): facts about an episode itself, not about how anyone did in the
// game, that a question can be settled by: who says the episode's title quote. Every show's research answers them after each
// episode, in a section of their own (episodeFacts, beside F2's format section: db/episode-research.js), each with how sure it is.
// This is what's shared with what reads the answers: the vocabulary, the loose read of an answer (a bad value is repaired and
// reported, never a failed run), what a fact says about an episode once its person is found in the cast (outcomeOf), and how
// reliably research answers a fact on a show, measured from what research returns (ratingOf): the show's own stored episodes
// (episode-facts.ts factMeasures, the server's) added to what the season tapes measured when recorded episodes were asked again
// with the section (fact-measures.json, written by scripts/dev-test/facts-asks.js), so a show research has answered it on before
// is rated from the start and every episode after counts. Our check accepts a question a fact settles only when the fact is
// rated at the bar (BAR); the grader voids an episode research can't say for sure (no points either way), and one whose answer
// can't be picked (the host said it).
//
// The vocabulary, the section's shape, the prompt's words and the bar (reliable only, or usually too) are the user's to approve
// when it merges, as F2's section is (docs/STUDY-format-changes.md, "A13 part 2").
//
// Plain CommonJS, browser-safe, like everything in formats/.

/** How sure research is of a fact: 'high' when a source says it plainly, 'low' when it's pieced together. */
const SURE = ['high', 'low'];
/** Whether the episode's title is a line someone says in it. */
const IS_QUOTE = ['yes', 'no', 'unknown'];
/** How reliably research answers a fact on a show, in a moment's words (rulebook-schema.js OPT.reliability). */
const RELIABILITY = ['reliable', 'usually', 'patchy'];
/** The ratings our check accepts a fact at. The user's to set (reliable only, or usually too): reliable only until then. */
const BAR = ['reliable'];
/** How many of a show's episodes research has to have been asked a fact on before it's rated at all. */
const MEASURED = 6;
/** What the season tapes measured, by show (its slug): each fact's { asked, settled }, and the seasons measured (fact-measures.json). */
// eslint-disable-next-line @typescript-eslint/no-require-imports -- CommonJS on purpose, as everything in formats/
const TAPES = require('./fact-measures.json').shows || {};
/** The seasons of a show the tapes' measure counts (its stored research isn't counted again). Pure. */
const measuredSeasons = (show) => ((TAPES[show] && Array.isArray(TAPES[show].seasons) ? TAPES[show].seasons : []).filter((n) => Number.isInteger(n)));
/** A rate's rating: reliable from 90% of the episodes asked, usually from 70%, else patchy. */
const RATES = [
  [0.9, 'reliable'],
  [0.7, 'usually'],
];

/**
 * The facts research is asked about each episode, by id: what it's about (`label`) and the answers a question it settles takes,
 * by take (who: the person it names; a group answer, the group they were on).
 */
const FACTS = {
  titleQuote: { label: "who says the episode's title quote", takes: { who: ['person', 'group'] } },
};
const FACT_IDS = Object.keys(FACTS);

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const text = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null);
const low = (v) => String(v == null ? '' : v).trim().toLowerCase();

/** `v` as one of `list` (forgiving case; true and false as yes and no), or null. */
function oneOf(v, list) {
  if (v === true && list.includes('yes')) return 'yes';
  if (v === false && list.includes('no')) return 'no';
  const s = low(v);
  return list.includes(s) ? s : null;
}

/**
 * An answer's episode facts, read loosely: missing or not an object is null (not asked: an answer from before they were); each
 * fact missing is null; a value outside its list takes its catch-all ('unknown'; `sure` 'low'), each repair said in `repairs`.
 * Never throws: the section must never fail a research run the rest of which is fine. Pure.
 */
function looseEpisodeFacts(v, repairs = []) {
  if (v == null) return null;
  if (!isObj(v)) {
    repairs.push('episodeFacts was not an object -- read as not answered');
    return null;
  }
  const out = {};
  let tq = v.titleQuote;
  // A13 part 2b: its fields flattened beside it ({ titleQuote: "unknown", line, by, sure }, as a run's answer once came back):
  // read as the fact, its value as isQuote.
  if (typeof tq === 'string' && ['isQuote', 'line', 'by', 'sure'].some((k) => k in v)) {
    repairs.push('episodeFacts: the title quote\'s fields were beside it, not in it -- read as the title quote');
    tq = { isQuote: 'isQuote' in v ? v.isQuote : tq, line: v.line, by: v.by, sure: v.sure };
  }
  if (tq == null) out.titleQuote = null;
  else if (!isObj(tq)) {
    repairs.push('episodeFacts: titleQuote was not an object -- read as not answered');
    out.titleQuote = null;
  } else {
    let isQuote = oneOf(tq.isQuote, IS_QUOTE);
    if (!isQuote) {
      if (tq.isQuote != null) repairs.push(`episodeFacts: titleQuote.isQuote "${tq.isQuote}" isn't one of ${IS_QUOTE.join(', ')} -- recorded as "unknown"`);
      isQuote = 'unknown';
    }
    let sure = oneOf(tq.sure, SURE);
    if (!sure) {
      if (tq.sure != null) repairs.push(`episodeFacts: titleQuote.sure "${tq.sure}" isn't one of ${SURE.join(', ')} -- recorded as "low"`);
      sure = 'low';
    }
    out.titleQuote = { isQuote, line: text(tq.line), by: text(tq.by), sure };
  }
  return out;
}

/** Whether research was sure of a fact's answer (the title is a line or isn't, said plainly): what fillFacts keeps, and what the
 *  facts run (db/facts-research.js) doesn't ask again. */
const sureOf = (f) => isObj(f) && f.sure === 'high' && (f.isQuote === 'no' || (f.isQuote === 'yes' && !!f.by));

/**
 * A second research pass's facts over the first's (db/episode-research.js mergeResearch, filling in): each fact the second's,
 * unless the first was sure of it and the second isn't, or the second says nothing. Pure.
 */
function fillFacts(was, now) {
  const out = { ...(isObj(was) ? was : {}) };
  for (const [k, v] of Object.entries(isObj(now) ? now : {})) {
    if (v == null) continue;
    if (sureOf(out[k]) && !sureOf(v)) continue;
    out[k] = v;
  }
  return out;
}

/** A name as compared (state-logic.js normalizeName's way): accents folded, punctuation a space, case dropped. */
const norm = (name) =>
  String(name == null ? '' : name)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/**
 * Who in `cast` ([{ id, name }]) a name research gave is: exactly the same name (case, accents and punctuation aside), as the prompt
 * asks it to give someone on the list; null for nobody, or more than one. Stricter than Core.findCastawayByName on purpose: someone
 * who isn't in the cast must never be read as a castaway (the host Jeff Probst as a castaway called Jeff; a castaway's sister Kelly as
 * Kelly Wentworth), so a name research shortened is someone it couldn't be sure of, and the episode is void. `loose` (the proof's
 * scoring, against truth written in first names) also takes the one person whose name has every word of it. Pure.
 */
function personIn(cast, name, loose = false) {
  const want = norm(name);
  if (!want) return null;
  const list = Array.isArray(cast) ? cast.filter((c) => c && c.id != null) : [];
  const same = list.filter((c) => norm(c.name) === want);
  if (same.length || !loose) return same.length === 1 ? same[0].id : null;
  const words = want.split(' ');
  const has = list.filter((c) => {
    const t = norm(c.name).split(' ');
    return words.every((w) => t.includes(w));
  });
  return has.length === 1 ? has[0].id : null;
}

/**
 * What a fact says about one episode, from its research's section (looseEpisodeFacts'), its person found in `cast` (personIn):
 *   { state: 'who', who, name }   a person in the cast says it, and research is sure
 *   { state: 'outside', name }    someone who isn't in the cast says it (the host, a family member), and research is sure
 *   { state: 'none' }             the title isn't a line anyone says in the episode, and research is sure
 *   { state: 'unsure', why }      research couldn't say for sure
 * null when the section doesn't have it (asked before the fact was, or not asked). Pure.
 */
function outcomeOf(section, fact, cast) {
  if (!isObj(section) || !FACTS[fact]) return null;
  const f = section[fact];
  if (!isObj(f)) return null;
  if (fact === 'titleQuote') {
    if (f.isQuote === 'no') return f.sure === 'high' ? { state: 'none' } : { state: 'unsure', why: "Research wasn't sure the title is a line from the episode" };
    if (f.isQuote !== 'yes') return { state: 'unsure', why: "Research couldn't say whether the title is a line from the episode" };
    if (!f.by) return { state: 'unsure', why: "Research couldn't say who says the title quote" };
    if (f.sure !== 'high') return { state: 'unsure', why: `Research wasn't sure who says the title quote (it said ${f.by})` };
    const who = personIn(cast, f.by);
    return who != null ? { state: 'who', who, name: f.by } : { state: 'outside', name: f.by };
  }
  return null;
}

/**
 * An episode's outcome while research may still settle it (A13 part 2b): one it wasn't sure of, or didn't say, is 'pending' from the
 * episode's airing (`airAt`, ms) until its final results (`finalAt`, ms: final-results.js, noon the day after it airs, by when every
 * research run of the night has landed, the full runs and the facts run, db/facts-research.js), so a game waits rather than voiding
 * a week the morning's research then settles; after them, or with no time to go by, it stands (void). Research about an episode the
 * clock says hasn't aired (a replay's copy, a test) stands too: live, research only comes after it airs. Any other outcome is as it
 * is. Pure.
 */
function pendingUntil(outcome, finalAt, now, airAt = null) {
  if (!isObj(outcome) || outcome.state !== 'unsure') return outcome;
  if (!Number.isFinite(finalAt) || !Number.isFinite(now) || now >= finalAt) return outcome;
  if (Number.isFinite(airAt) && now < airAt) return outcome;
  return { state: 'pending', why: outcome.why };
}

/**
 * How research answered a fact over a show's stored episodes (`items`: each one's section, null for one asked before the section
 * was, with its season's cast: [{ section, cast }]): { asked, settled }, the episodes it was asked on and the ones it settled a pick
 * on, sure of someone in the cast by their name there (outcomeOf's 'who', as the grader reads it). The title not being a line,
 * someone outside the cast (the host, or a name shortened) and anything research wasn't sure of settle nothing: those weeks are void.
 * Pure.
 */
function measure(items, fact) {
  let asked = 0;
  let settled = 0;
  for (const it of Array.isArray(items) ? items : []) {
    const o = outcomeOf(it && it.section, fact, (it && it.cast) || []);
    if (!o) continue;
    asked += 1;
    if (o.state === 'who') settled += 1;
  }
  return { asked, settled };
}

/** A count as a whole number of episodes (anything else none). */
const count = (v) => (Number.isInteger(v) && v > 0 ? v : 0);

/**
 * What's known of a fact on a show (its slug), for our check (the ctx's facts entry): what the season tapes measured there
 * (TAPES), added to research's own counts on the show's stored episodes (`live`: measure's, the server's). Pure.
 */
function entryFor(show, fact, live) {
  const t = (TAPES[show] && TAPES[show][fact]) || {};
  const l = isObj(live) ? live : {};
  return { asked: count(t.asked) + count(l.asked), settled: count(t.settled) + count(l.settled) };
}

/**
 * How reliably research answers a fact on a show, from what it returned there (`entry`: { asked, settled }, entryFor's): its rate
 * once it has been asked on MEASURED episodes or more, else none. { rating: one of RELIABILITY or null, asked, settled }. Pure.
 */
function ratingOf(entry) {
  const e = isObj(entry) ? entry : {};
  const asked = count(e.asked);
  const settled = Math.min(count(e.settled), asked);
  if (asked < MEASURED) return { rating: null, asked, settled };
  const hit = RATES.find(([at]) => settled / asked >= at);
  return { rating: hit ? hit[1] : 'patchy', asked, settled };
}

/**
 * Why our check refuses a question a fact settles on a show (`entry`: its ctx.facts entry), or null when the fact is rated at the
 * bar. A fact that isn't one of FACTS is the shape's to refuse (schema.js questionProblems). Pure.
 */
function factProblem(fact, entry) {
  const f = FACTS[fact];
  if (!f) return null;
  const r = ratingOf(entry);
  if (r.rating && BAR.includes(r.rating)) return null;
  const what = f.label;
  if (!r.rating) {
    return r.asked
      ? `Research has been asked ${what} on ${r.asked} of this show's episodes, not yet the ${MEASURED} it takes to know it can say: it can't settle it yet`
      : `Research hasn't been asked ${what} on this show yet, so nothing says it can: it can't settle it yet`;
  }
  return `Research said ${what} for sure on ${r.settled} of the ${r.asked} episodes it was asked on this show: not reliably enough to settle it`;
}

module.exports = { SURE, IS_QUOTE, RELIABILITY, BAR, MEASURED, FACTS, FACT_IDS, measuredSeasons, looseEpisodeFacts, sureOf, fillFacts, personIn, outcomeOf, pendingUntil, measure, entryFor, ratingOf, factProblem };
