// A bracket question's pieces (docs/PLAN-start-a-game-gpt.md track L, L4 part 2; a question's `answer: 'bracket'` settled
// `{ by: 'final', take: 'bracket', of: <a draw> }`, game-spec schema.js): pick the winners of every round of a draw before it starts
// (tennis's: a card's bouts, each with its draw and how many rounds it is from the final, Bout.place), each right pick earning the
// question's points, doubling round by round where it says so (ESPN's Tournament Challenge: 10, 20, 40...). An answer is each
// round's winners by its distance from the final ({ "7": [64 ids], ..., "1": [the champion] }); a pick is right when they won a
// match of that round. A consistent bracket's picks for a round are each from their own match's half, so counting a round's right
// picks is the same as grading it match by match. Pure and plain CommonJS, like the sequence beside it: answers.js grades with it,
// and the engine's hook checks an answer with it.

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

/** L8 part 1's engine items, part 2: the draw a league's playoffs are (src/lib/sports/playoffs.ts: a playoffs slate's series, each a
 *  bout of it with its round's distance from the final), as a bracket question names it (`of`). */
const PLAYOFFS = 'playoffs';

/**
 * A draw as a card's facts have it (SportsGameFacts.bouts: each bout's sides, winner, `class` and `fromFinal`), `cls` the draw (the
 * sport's position key: tennis's "MS"): { first, entrants, matches, winners, over }. `first` its first round's distance from the
 * final (7 for a Grand Slam's 128, null when the card has none of it); `entrants` each one's round they enter in (a seed with a bye
 * the second); `matches` each round's pairs as listed so far; `winners` each round's winners so far; `over` its final won.
 * Qualifying and a group stage aren't the bracket (no distance from the final).
 */
function bracketOf(bouts, cls) {
  const out = { first: null, entrants: {}, matches: {}, winners: {}, over: false };
  for (const b of Object.values(isObj(bouts) ? bouts : {})) {
    if (!isObj(b) || b.class !== cls || !Number.isInteger(b.fromFinal) || b.fromFinal < 1) continue;
    const k = b.fromFinal;
    out.first = Math.max(out.first || 0, k);
    const sides = (Array.isArray(b.sides) ? b.sides : []).filter((x) => typeof x === 'string' && x);
    for (const id of sides) out.entrants[id] = Math.max(out.entrants[id] || 0, k);
    if (sides.length === 2) (out.matches[k] = out.matches[k] || []).push(sides);
    if (b.winner && b.outcome === 'win') {
      (out.winners[k] = out.winners[k] || []).push(b.winner);
      if (k === 1) out.over = true;
    }
  }
  return out;
}

/** A round's most picks: its matches in a full draw (the final's one, the semifinals' two). */
const slotsOf = (k) => 2 ** (k - 1);

/**
 * What's wrong with a bracket answer, or null. Each round's picks by its distance from the final, a list of names, each once, no
 * more than the round has matches; with the draw (`field`, bracketOf's: who's in it, its matches so far), each pick someone in the
 * draw, a round's winners among the round before's or entering there (a bye), and never both sides of one match.
 */
function bracketProblem(value, field) {
  if (!isObj(value) || !Object.keys(value).length) return 'Pick the winners: { round: [names] }, the final 1, the semifinals 2';
  const first = field && Number.isInteger(field.first) ? field.first : null;
  for (const [key, list] of Object.entries(value)) {
    const k = Number(key);
    if (!Number.isInteger(k) || k < 1 || (first !== null && k > first)) return first !== null ? `The rounds are 1 (the final) to ${first}` : 'A round is 1 (the final), 2 (the semifinals) and on';
    if (!Array.isArray(list) || list.some((x) => typeof x !== 'string' || !x)) return 'Each round is a list of names';
    if (new Set(list).size !== list.length) return 'Name each one once a round';
    if (list.length > slotsOf(k)) return `Round ${k} has ${slotsOf(k)} ${slotsOf(k) === 1 ? 'winner' : 'winners'} at most`;
    if (!field) continue;
    for (const id of list) {
      const enters = field.entrants[id];
      if (!enters) return "Pick only who's in the draw";
      const before = Array.isArray(value[k + 1]) ? value[k + 1] : [];
      if (enters < k) return 'A round is won only by someone in it';
      if (enters > k && !before.includes(id)) return 'A round is won by one of the round before\'s winners you picked';
    }
    for (const [a, b] of field.matches[k] || []) if (list.includes(a) && list.includes(b)) return 'Pick one winner of each match';
  }
  return null;
}

/** What a round's right pick is worth: the question's points, doubling each round from the first (`rounds: 'same'`, never). */
function roundWorth(q, k, first) {
  const pts = typeof q.points === 'number' ? q.points : 0;
  return q.rounds === 'same' ? pts : pts * 2 ** Math.max(0, first - k);
}

/** What one answer earns on a draw (bracketOf's): each round's right picks at that round's worth. */
function bracketPoints(q, field, answer) {
  if (!isObj(answer) || !field || !Number.isInteger(field.first)) return 0;
  let n = 0;
  for (const [key, list] of Object.entries(answer)) {
    const k = Number(key);
    const won = new Set(field.winners[k] || []);
    if (!Number.isInteger(k) || !Array.isArray(list)) continue;
    n += new Set(list.filter((id) => won.has(id))).size * roundWorth(q, k, field.first);
  }
  return n;
}

module.exports = { PLAYOFFS, bracketOf, bracketProblem, bracketPoints, roundWorth };
