// Reading the bot's answer to the Start-a-game GPT's prompts (docs/PLAN-start-a-game-gpt.md step G1, "Our check"): the JSON in
// it, as rulebook-research.js parseRulebookAnswer reads one (chatter and code fences around it are fine; of several objects the
// last that parses wins), with the repairs a chat's JSON needs (comments, trailing commas, curly quotes), then each part in the
// shape our check reads. Nothing here decides what's a game: a part that isn't the right shape is kept out and noted, and our
// check (check.js) decides the rest. Pure.
//
//   readDraft(answer)  -> { draft: { game, said, assumed, ask, cantYet, about, also, summary, matchup }, notes } (throws: no JSON)
//   readMoment(answer) -> { reliable, why, question, label, nearest } (throws: no JSON)
/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS on purpose, see ../game-spec/schema.js */
const { jsonObjectsIn } = require('../formats/rulebook-research.js');
/* eslint-enable @typescript-eslint/no-require-imports */

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const str = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null);

/** A chat's JSON made parseable: // and /* comments and trailing commas out, curly quotes straight (outside strings only). */
function tidy(s) {
  let out = '';
  // The quote a string opened with: a curly one closes on a curly one too, a straight one only on a straight one (so a curly
  // quote inside an ordinary string stays as written).
  let inString = null;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inString) {
      if (ch === '\\') out += ch + (s[++i] ?? '');
      else if (ch === '"' || (inString === 'curly' && ch === '”')) {
        out += '"';
        inString = null;
      } else out += ch;
      continue;
    }
    if (ch === '"' || ch === '“' || ch === '”') {
      inString = ch === '"' ? 'straight' : 'curly';
      out += '"';
      continue;
    }
    if (ch === '/' && s[i + 1] === '/') {
      while (i < s.length && s[i] !== '\n') i++;
      out += '\n';
      continue;
    }
    if (ch === '/' && s[i + 1] === '*') {
      const end = s.indexOf('*/', i + 2);
      i = end === -1 ? s.length : end + 1;
      continue;
    }
    if (ch === ',') {
      let j = i + 1;
      while (j < s.length && /\s/.test(s[j])) j++;
      if (s[j] === '}' || s[j] === ']') continue;
    }
    out += ch;
  }
  return out;
}

/** The JSON object in an answer: the whole span first, then each object in it, last first; each tidied if it won't parse. */
function objectIn(answer) {
  const s = String(answer || '');
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start === -1 || end <= start) throw new Error("There's no JSON object in the answer.");
  const tries = [s.slice(start, end + 1), ...jsonObjectsIn(s).reverse()];
  const notes = [];
  for (const t of tries) {
    for (const [text, note] of [[t, null], [tidy(t), 'tidied the JSON (comments, trailing commas or curly quotes)']]) {
      try {
        const v = JSON.parse(text);
        if (isObj(v)) {
          if (note) notes.push(note);
          return { value: v, notes };
        }
      } catch {
        // the next way, then
      }
    }
  }
  throw new Error("The answer's JSON doesn't parse.");
}

const SPEC_PARTS = ['spec', 'preset', 'span', 'pool', 'get', 'count', 'score', 'rank', 'ask', 'closes', 'extras', 'stages', 'overall', 'card'];

/** A list of entries: an array of objects, an object of part -> value read as entries, or a string as one. */
function entries(v, asEntry) {
  if (Array.isArray(v)) return v.map((x) => (isObj(x) ? x : typeof x === 'string' ? asEntry(x) : null)).filter(Boolean);
  if (isObj(v)) return Object.entries(v).map(([part, x]) => (isObj(x) ? { part, ...x } : { part, ...asEntry(String(x)) }));
  if (typeof v === 'string' && v.trim()) return [asEntry(v)];
  return [];
}

/**
 * The bot's draft from its answer. A bare spec (no "game", but a spec's parts) is read as the game; `game: null` stays null (not
 * a game). Each list keeps only entries of its shape.
 */
function readDraft(answer) {
  const { value, notes } = objectIn(answer);
  let raw = value;
  if (!('game' in raw) && SPEC_PARTS.some((k) => k !== 'spec' && k in raw)) {
    raw = { game: raw };
    notes.push('the answer was a bare spec: read it as the game');
  }
  const game = raw.game === null ? null : isObj(raw.game) ? raw.game : null;
  if (raw.game !== null && !isObj(raw.game)) notes.push('no game in the answer');
  const said = entries(raw.said, (q) => ({ quote: q }))
    .map((e) => ({ part: str(e.part), quote: str(e.quote) || str(e.words) }))
    .filter((e) => e.quote);
  const assumed = entries(raw.assumed, (w) => ({ why: w }))
    .map((e) => ({ part: str(e.part), value: e.value, why: str(e.why) || '' }))
    .filter((e) => e.part);
  const ask = entries(raw.ask, (q) => ({ question: q }))
    .map((e) => ({ part: str(e.part), question: str(e.question), options: Array.isArray(e.options) ? e.options.map(String).filter((o) => o.trim()).slice(0, 6) : [] }))
    .filter((e) => e.question);
  const cantYet = entries(raw.cantYet ?? raw.cant_yet ?? raw.cantyet, (w) => ({ what: w }))
    .map((e) => ({ what: str(e.what) || str(e.newMoment) || '', why: str(e.why) || '', nearest: str(e.nearest), ...(str(e.newMoment) ? { newMoment: str(e.newMoment) } : {}) }))
    .filter((e) => e.what);
  // A season only as a whole number from 1 ("", 0 or a list is none).
  const n = isObj(raw.about) ? (typeof raw.about.season === 'number' ? raw.about.season : /^\s*\d+\s*$/.test(String(raw.about.season ?? '')) ? Number(raw.about.season) : NaN) : NaN;
  const about = isObj(raw.about) && str(raw.about.show) ? { show: str(raw.about.show), ...(Number.isInteger(n) && n > 0 ? { season: n } : {}) } : null;
  const also = str(raw.also) || (isObj(raw.also) ? str(raw.also.summary) || JSON.stringify(raw.also) : null);
  // G3 part 2: on a team's page, the games their words mean (a matchup ask: the server holds it against the schedule), or null; a
  // bot that put it inside the game (the local bot did, 2026-11-07) is read the same, and the game keeps only its own parts.
  const inGame = game && isObj(game.matchup) ? game.matchup : null;
  if (game && 'matchup' in game) {
    delete game.matchup;
    if (inGame) notes.push('the matchup was inside the game: read it beside it');
  }
  const matchup = isObj(raw.matchup) ? raw.matchup : inGame;
  return { draft: { game, said, assumed, ask, cantYet, about, also, summary: str(raw.summary) || '', matchup }, notes };
}

const RELIABLE = ['high', 'medium', 'low'];

/** The reliability ask's answer: its rating (low when it's anything else), why, whether it's about a person or the episode (G1
 *  part 4: as it says; when it doesn't, a person only when its question asks who), the question and its label. */
function readMoment(answer) {
  const { value } = objectIn(answer);
  const reliable = RELIABLE.includes(String(value.reliable || '').toLowerCase()) ? String(value.reliable).toLowerCase() : 'low';
  const nearest = Array.isArray(value.nearest) ? value.nearest.map(str).filter(Boolean).slice(0, 3) : [];
  const said = String(value.about || '').toLowerCase();
  const about = said === 'episode' || said === 'person' ? said : /\bwho\b/i.test(str(value.question) || '') ? 'person' : 'episode';
  return { reliable, why: str(value.why) || '', about, question: str(value.question) || '', label: str(value.label) || str(value.question) || '', nearest };
}

/** momentsPrompt's answer: one rating for each of `n` moments asked, in order (one missing or unreadable: low, with why). */
function readMoments(answer, n) {
  const text = String(answer || '');
  const start = text.indexOf('[');
  const end = text.lastIndexOf(']');
  let list = [];
  try {
    list = start >= 0 && end > start ? JSON.parse(text.slice(start, end + 1)) : [];
  } catch {
    list = [];
  }
  const out = [];
  for (let i = 0; i < n; i++) {
    const v = Array.isArray(list) && list[i] && typeof list[i] === 'object' ? list[i] : { reliable: 'low', why: "The bot didn't rate it" };
    out.push(readMoment(JSON.stringify(v)));
  }
  return out;
}

module.exports = { readDraft, readMoment, readMoments, tidy, objectIn, SPEC_PARTS };
