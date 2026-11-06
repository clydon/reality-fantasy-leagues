// Who voted for whom, from an episode's research (docs/PLAN-start-a-game-gpt.md step A14 part 3: bounties). A show whose cast votes
// someone out (Survivor's Tribal Council, The Traitors' Round Table) has research answer, for each person, who they voted for (the
// checklist's vote: Survivor's `votedFor`, a compiled rulebook's `<segment>VotedFor`) and how many votes they got
// (`votesReceived`, `<segment>VotesReceived`). The format's own rules say which answers are votes and which ways of leaving they
// cause (the vote built-ins of rules.js: votedForLeaver, votedForLeavers, voteByRole, each with its exitMethod), so nothing here
// names a show.
//
// A record is sure only when research's own answers agree with each other: every name in a vote is on the cast, and each person
// voted out has exactly as many votes naming them as research counted against them (the season tapes, 2026-11-06: Survivor 48 and
// 49 agree on 11 of 13 episodes with a vote-out each, Survivor 50 on 8 of 13, The Traitors 2 to 4 on 3 of 8, 5 of 8 and 4 of 10;
// a double boot asked as one vote each never agrees). A bounty reads only a sure record (its fallback: void, nothing moves that
// episode), and only for whoever the league's own results say went home by a vote.

const VOTE_RULES = { votedForLeaver: 'vote', votedForLeavers: 'votes', voteByRole: 'votes' };
const listOf = (v) => (Array.isArray(v) ? v : v ? [v] : []).filter((x) => typeof x === 'string' && x.trim());

/** The format's votes: [{ key, count, exitMethods }], each answer research gives as a vote, its count's key (null when the
 *  checklist has none) and the ways of leaving a vote there causes. [] for a show nobody votes out. */
function votesOf(format) {
  const data = format && format.data;
  const rules = (data && data.rules && Array.isArray(data.rules.research) && data.rules.research) || [];
  const asked = new Set(((data && data.research && data.research.checklist) || []).map((f) => f && f.key));
  const byKey = new Map();
  for (const r of rules) {
    const field = r && VOTE_RULES[r.builtIn];
    const key = field && r[field];
    if (typeof key !== 'string' || typeof r.exitMethod !== 'string') continue;
    if (!byKey.has(key)) {
      const count = key.replace(/([vV])otedFor$/, (m, v) => `${v}otesReceived`);
      byKey.set(key, { key, count: count !== key && asked.has(count) ? count : null, exitMethods: [] });
    }
    const v = byKey.get(key);
    if (!v.exitMethods.includes(r.exitMethod)) v.exitMethods.push(r.exitMethod);
  }
  return [...byKey.values()];
}

/** Every way of leaving a vote causes on the format. */
function voteExits(format) {
  return [...new Set(votesOf(format).flatMap((v) => v.exitMethods))];
}

/**
 * One episode's record from its research answer (`payload`: { castaways: [{ name, leftTheGame, exitMethod, <vote>, <count> }] }),
 * names to the league's ids by `resolve(name) -> id | null`: { sure, why?, votes: [[voterId, votedForId]], out: [ids] } (`out`:
 * who research says left by a vote), or null when the format has no votes or the answer has no one in it.
 */
function recordOf(payload, format, resolveName) {
  const defs = votesOf(format);
  const known = new Map();
  const resolve = (name) => {
    if (!known.has(name)) known.set(name, resolveName(name));
    return known.get(name);
  };
  const entries = payload && Array.isArray(payload.castaways) ? payload.castaways.filter((c) => c && typeof c.name === 'string') : [];
  if (!defs.length || !entries.length) return null;
  const votes = [];
  const out = [];
  const why = new Set();
  for (const def of defs) {
    const named = new Map();
    for (const c of entries) {
      const by = resolve(c.name);
      for (const name of listOf(c[def.key])) {
        const at = resolve(name);
        if (!by || !at) {
          why.add('A vote names someone who isn\'t on the cast');
          continue;
        }
        votes.push([by, at]);
        named.set(at, (named.get(at) || 0) + 1);
      }
    }
    for (const c of entries) {
      if (c.leftTheGame !== 'yes' || !def.exitMethods.includes(c.exitMethod)) continue;
      const id = resolve(c.name);
      if (!id) {
        why.add('Someone voted out isn\'t on the cast');
        continue;
      }
      if (!out.includes(id)) out.push(id);
      const counted = def.count ? c[def.count] : null;
      if (!Number.isInteger(counted)) why.add('Research didn\'t count the votes against who went home');
      else if (counted !== (named.get(id) || 0)) why.add('The votes research named don\'t add up to the count against who went home');
    }
  }
  const rec = { sure: why.size === 0, votes, out };
  if (why.size) rec.why = [...why][0];
  return rec;
}

module.exports = { votesOf, voteExits, recordOf };
