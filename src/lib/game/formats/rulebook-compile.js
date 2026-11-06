// A rulebook's blocks compiled to the engine's format data (docs/PLAN-rulebooks-implementation.md 4.3): the
// FormatData every league, the research pipeline and scoring already run on. The blocks say what can happen;
// this writes the events, categories, research checklist and rules that make it score.
//
//   compileRulebook(blocks, { aliases?, id?, reader?, base?, phaseStarts? }) -> { data, problems, warnings }
//   formatForRulebook(data, reader?) -> the runtime format (index.js)
//
// FROM THE BLOCKS. Each moment is an event (its id through `aliases.events`, so a built-in's recorded events
// keep their ids), with its tags (what it says about someone's place in the game, which the computer players and the
// Safety ranking read: rulebook-moments.js, moment-tags.js); each way out an exit method (through `aliases.exits`); each question a moment asks a
// checklist field, and a yes-or-no one a research rule. A count scores once per unit (rules.js `per`): a whole
// number for "each time", any number for an amount that needn't be whole (innings pitched). A way out is an
// implied rule, and so is a jury finale. A vote by the cast adds who was there, how many votes each got and who
// each voted for, and scores the majority through the votedForLeaver built-in. A secret role (one per
// rulebook) adds the role questions, records the roles research reports, and scores votes by role through
// voteByRole. A talk show's moments are about the night, not a person, so they're episode-level answers
// (episode games score them, step 12), with nothing awarded to anyone.
//
// A SHOW'S OWN CONDITIONS (docs/PLAN-start-a-game-gpt.md S1). A moment can carry more than its own question
// (rulebook-moments.js): other answers that score it too (`also`: a group's win that counts as winning), that must
// be yes (`needs`: votes cancelled by an advantage they played) or mustn't be (`unless`: zero votes at a vote their
// group's win skipped; chosen for a reward they didn't win), and a number's own test (`ask.when`: came 2nd). Every
// question a condition reads is asked. A side trip away from the group is the episode's exile record, and scores
// from it; a finalist way out the winner reached too awards them as well. Whoever left isn't scored for how they
// voted, as they aren't for votes against them.
//
// THE QUESTIONS' KEYS AND WORDS. `aliases.questions` maps a question these blocks build to the key stored answers
// already use ("tribalCouncilAttended" -> "attendedTribal"), beside the event and exit maps, so research answered
// before keeps reading. The rulebook's `research` block can give a question research's own words, say a yes needs
// no source, ask questions besides that score nothing (each with a type and its words), and set the search hint. It
// also says how each answer reads to a reviewer (`note`, `sentence`, `shown`: research-review.js). Every show but a talk
// show or a sport is asked an anything-else question (`notableTwist`), where research also says what its sources disagree
// on, as every built-in is. On a base, the base's questions keep the base's words and search hint (the legacy freeze asks what
// it always asked).
//
// RESEARCH'S CHECKS (docs/PLAN-start-a-game-gpt.md S2). Answers that contradict each other are caught from the blocks'
// structure, for any show: a vote by the cast checks votes against someone who wasn't there, everyone at it on zero
// (cleared), and the votes against people against the people voting; asked whether it was held (`<segment>Held`, a
// question asked besides), it clears attendance when it wasn't; skipped by a group's win, it clears that group's
// attendance (and research fills in a missed group move, `groupVotes`). Winning a segment that keeps you safe and going
// home by a vote, finishing 1st and not winning, and votes cancelled by an advantage nobody played are reported. The
// research block's `checks` give a check its own words, its own condition, or switch it off, and add checks of their
// own (a condition on one person's answers); one that reads a question these blocks don't ask is left out, with a
// warning. On a base, the base's checks stay (a built-in's code half has its own).
//
// ON TOP OF THE DATA IT WAS FROZEN FROM. A rulebook migrated from a format (decision 2's legacy freeze: a
// built-in's data half, or a stored format's) compiles with that data as its `base`, and a built-in `reader`
// brings its family's. Every event the blocks still build keeps the base's own rules, questions, label and
// place, so recorded answers and events mean what they always did, and the reader's code half (which reads
// its family's questions by name) keeps working. Only what the blocks add is compiled from them; what they
// drop takes its rules with it. Unedited, a built-in compiles to its own scoring exactly
// (tests/rulebook-golden.test.js).
//
// PHASE GATING. A moment from a segment held in one phase of the season (`often: 'onePhase'`) only scores while
// that phase runs: from its start (the block's episode, or `phaseStarts`, the season's confirmed starts) to the
// episode before the next phase's. While its start isn't known nothing in it scores (decision 5: a missing
// result shows up in review, a wrong one silently rescores), and research is asked, episode by episode, whether
// it began (`phaseStarted`). A finale-only segment isn't gated: the finale isn't a phase with a start, and
// nothing in it can happen earlier.
//
// `problems` is formatProblems' verdict, plus two moments landing on one event id: for valid blocks it should
// be empty, and anything there is a compiler bug. `warnings` are what someone reading the rulebook should know.
//
// Plain CommonJS, browser-safe, like everything in formats/.
/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS on purpose, see index.js */
const Formats = require('./index.js');
const { formatProblems } = require('./define.js');
const { BUILT_INS } = require('./rules.js');
const { formatIdFor } = require('./proposal.js');
const { kindOf, partWord, blockLabel, cap, camelId } = require('./rulebook-schema.js');
const { momentsFor, the } = require('./rulebook-moments.js');
const { checksProblems, renamePlaceholders, renameAnswers } = require('./research-review.js');
/* eslint-enable @typescript-eslint/no-require-imports */

const list = (v) => (Array.isArray(v) ? v : []);
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const lowerFirst = (s) => (s ? s.charAt(0).toLowerCase() + s.slice(1) : '');
const up = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');
const yes = (answer) => ({ answer, is: 'yes' });
const notYes = (answer) => ({ answer, isNot: 'yes' });

const VOTE_SUFFIXES = ['ZeroVotes', 'SurvivedVotes', 'VotedWithMajority', 'VotedAgainstMajority'];
const FINISH = ['finalist', 'winner', 'ending'];

/** Each phase's episodes: { [phaseId]: { from, until } }, until null while open, the whole entry null while its start is unknown. */
function phaseRanges(blocks, phaseStarts = {}) {
  const phases = list(blocks && blocks.season && blocks.season.phases);
  const starts = phases.map((p) => {
    if (Number.isInteger(phaseStarts[p.id]) && phaseStarts[p.id] >= 1) return phaseStarts[p.id];
    return p.starts && p.starts.type === 'episode' && Number.isInteger(p.starts.n) ? p.starts.n : null;
  });
  const ranges = {};
  phases.forEach((p, i) => {
    const from = starts[i];
    // A later phase whose start is known ends this one before it, even past one whose start isn't.
    const later = starts.slice(i + 1).filter((n) => n != null && n > (from || 0));
    ranges[p.id] = from == null ? null : { from, until: later.length ? Math.min(...later) - 1 : null };
  });
  return ranges;
}

function compileRulebook(blocks, { aliases = {}, id, reader, base, phaseStarts = {} } = {}) {
  const b = blocks || {};
  const legacy = base || (Formats.BUILT_IN_READERS.includes(reader) ? Formats.FORMATS[reader].data : null);
  const warnings = [];
  const problems = [];
  const kind = kindOf(b);
  const talk = kind === 'talk';
  const part = partWord(b).singular;
  const ev = (mid) => (aliases.events && aliases.events[mid]) || mid;
  const exitName = (w) => (aliases.exits && aliases.exits[w.id]) || w.name;
  // A question's key as stored answers have it, and the conditions on it.
  const qk = (key) => (aliases.questions && aliases.questions[key]) || key;
  const Y = (key) => yes(qk(key));
  const N = (key) => notYes(qk(key));
  // How research asks, from the rulebook's own research block: a question's words, and whether a yes needs a source.
  const said = isObj(b.research) && isObj(b.research.questions) ? b.research.questions : {};
  const wordsOf = (key) => (isObj(said[key]) && typeof said[key].words === 'string' && said[key].words.trim() ? said[key].words : null);
  // How an answer reads to a reviewer, in the research block's words: its placeholders and condition on the stored keys.
  const reviewWords = (key) => {
    const q = isObj(said[key]) ? said[key] : {};
    const out = {};
    for (const k of ['note', 'sentence']) if (q[k] === false || (typeof q[k] === 'string' && q[k].trim())) out[k] = q[k] === false ? false : renamePlaceholders(q[k], qk);
    if (isObj(q.shown)) out.shown = renameAnswers(q.shown, qk);
    return out;
  };
  const segs = list(b.segments);
  const segById = new Map(segs.map((s) => [s.id, s]));
  const twists = list(b.twists);
  const moments = momentsFor(b);
  const legacyEvents = new Map(legacy ? legacy.events.map((e) => [e.id, e]) : []);
  // An event the base already scores keeps the base's own rules and questions.
  const covered = (eid) => legacyEvents.has(eid);

  // ---------- who, and how they leave ----------
  const groups = b.cast && b.cast.groups;
  const terms = { castaway: cap((b.cast && b.cast.singular) || 'contestant'), tribe: cap((groups && groups.singular) || 'group') };
  const ways = list(b.waysOut);
  const wayOf = new Map(ways.map((w) => [w.id, w]));
  const exitWays = ways.filter((w) => w.means !== 'outForOne');
  // The base's order first (its pickers and research schema list them that way), anything new after.
  const inOrder = (names) => (legacy ? [...legacy.exitMethods.filter((x) => names.includes(x)), ...names.filter((x) => !legacy.exitMethods.includes(x))] : names);
  const compiledExits = [...new Set(exitWays.map(exitName))];
  const exitMethods = [...inOrder(compiledExits).filter((x) => x !== 'Other'), 'Other'];
  const winner = exitWays.find((w) => w.means === 'winner');
  const winners = [...new Set(exitWays.filter((w) => w.means === 'winner').map(exitName))];
  const endgameExitMethods = inOrder([...new Set(exitWays.filter((w) => FINISH.includes(w.means)).map(exitName))]);
  if (legacy && Formats.BUILT_IN_READERS.includes(reader)) {
    for (const x of compiledExits) if (!legacy.exitMethods.includes(x)) warnings.push(`The ${legacy.name} wiki connector won't report "${x}"; research will`);
  }

  // ---------- events ----------
  const secretTwists = twists.filter((t) => t.type === 'secretRole' && list(t.roles).length >= 2);
  const secret = secretTwists[0] || null;
  for (const t of secretTwists.slice(1)) warnings.push(`${t.name}: a rulebook has one secret role, so it's left out`);
  // Known from how someone left, the finale's jury votes, or a role recorded as a fact: the engine derives them.
  const roleFact = (m) => !!secret && m.from.twist === secret.id && !m.ask && (m.id === `${secret.id}Recruited` || m.id === `${secret.id}MadeFinale`);
  const roleVote = (m) => !!secret && m.from.twist === secret.id && !m.ask && !roleFact(m);
  const isImplied = (m) => (m.from.wayOut && wayOf.get(m.from.wayOut).means !== 'outForOne') || !!m.from.finale || roleFact(m) || !!m.exile;
  const fromBlocks = [];
  const seenIds = new Map();
  for (const m of moments) {
    const eid = ev(m.id);
    if (seenIds.has(eid)) {
      problems.push(`events: ${m.id} and ${seenIds.get(eid)} are both ${eid}`);
      continue;
    }
    seenIds.set(eid, m.id);
    // Its tags always, [] for none: only data from before tags reads the built-ins' by id (index.js momentTags), never a moment
    // added by hand whose id happens to be one of theirs.
    fromBlocks.push({ id: eid, label: m.label, defaultPoints: m.defaultPoints, ...(isImplied(m) ? { implied: true } : {}), tags: m.tags || [] });
  }
  const pts = new Map(fromBlocks.map((e) => [e.id, e.defaultPoints]));
  const events = legacy
    ? [...legacy.events.filter((e) => pts.has(e.id)).map((e) => ({ ...e, defaultPoints: pts.get(e.id) })), ...fromBlocks.filter((e) => !covered(e.id))]
    : fromBlocks;
  const built = new Set(events.map((e) => e.id));
  // The moment each event came from (its first, after a collision).
  const momentOf = new Map();
  for (const m of moments) if (!momentOf.has(ev(m.id))) momentOf.set(ev(m.id), m);

  // Two ways out recorded as one exit, each scoring on its own: both would score whenever it happens.
  const byExit = new Map();
  for (const w of exitWays) {
    const name = exitName(w);
    if (byExit.has(name) && !covered(ev(w.id)) && !covered(ev(byExit.get(name).id))) {
      warnings.push(`${byExit.get(name).name} and ${w.name} are both recorded as "${name}", so leaving that way scores both`);
    }
    if (!byExit.has(name)) byExit.set(name, w);
  }

  // ---------- phases ----------
  const ranges = phaseRanges(b, phaseStarts);
  const phaseById = new Map(list(b.season && b.season.phases).map((p) => [p.id, p]));
  const waiting = new Set();
  // The gate a moment's research rules carry: {} for none, null while its phase's start isn't known.
  const gateOf = (m) => {
    const seg = m && m.from.segment ? segById.get(m.from.segment) : null;
    if (!seg || seg.often !== 'onePhase' || !seg.phase || !(seg.phase in ranges)) return {};
    const r = ranges[seg.phase];
    if (!r) {
      if (!waiting.has(seg.phase)) warnings.push(`${seg.name}: nothing in it scores until when ${phaseById.get(seg.phase).name} starts is confirmed`);
      waiting.add(seg.phase);
      return null;
    }
    return { ...(r.from > 1 ? { fromEpisode: r.from } : {}), ...(r.until != null ? { untilEpisode: r.until } : {}) };
  };

  // ---------- the checklist and the rules ----------
  const fields = [];
  const episodeFields = [];
  const fieldKeys = new Set(legacy ? [...legacy.research.checklist, ...legacy.research.episodeFields].map((f) => f.key) : []);
  // Yes-or-no questions whose yes needs no source behind it (left out of the claims).
  const unsourced = new Set();
  // The blocks' own keys asked here (a research block's words for any other are a warning).
  const asked = new Set(['name', 'leftTheGame', 'exitMethod', 'sources', 'confidence']);
  // `f.key` is the blocks' own; it's asked under its stored key, in research's words where the rulebook gives them.
  const field = (f, into = fields) => {
    const key = qk(f.key);
    asked.add(f.key);
    if (fieldKeys.has(key)) return;
    fieldKeys.add(key);
    if (isObj(said[f.key]) && said[f.key].needsSource === false) unsourced.add(key);
    const words = wordsOf(f.key);
    into.push({ ...f, key, ...(words ? { description: words } : {}), ...(into === fields ? reviewWords(f.key) : {}) });
  };
  // A whole ask a condition reads ({ key, type, question, label }), as a checklist question.
  const askField = (a) =>
    a.type === 'answer'
      ? { key: a.key, type: 'answer', description: `${a.label}, this ${part}: yes, no, or unknown.`, note: lowerFirst(a.label) }
      : { key: a.key, type: a.type, nullable: true, description: a.question, ...(a.label ? { note: lowerFirst(a.label) } : {}) };
  // The questions conditions read that no moment of their own asks (a group's win switched off, say): asked at the end.
  const referenced = [];
  const research = [];
  const implied = [];
  // Moments scored from a question the rulebook already asks (customMoments[].uses).
  const scoredFrom = [];
  const gated = (rule, m) => {
    const g = gateOf(m);
    if (g) research.push({ ...rule, ...g });
  };
  const countText = (m) =>
    m.ask.type === 'number'
      ? `${m.ask.question} This person's amount as a number, with a decimal for part of one (6⅔ is 6.67, never a shorthand like 6.2); 0 if none, null if unknown.`
      : `${m.ask.question} This person's number; 0 if none, null if unknown.`;

  for (const m of moments) {
    const award = ev(m.id);
    if (momentOf.get(award) !== m || covered(award)) continue; // a collision, or the base's own rules (below)
    const seg = m.from.segment ? segById.get(m.from.segment) : null;
    if (talk) {
      // Episode-level: did it happen tonight?
      if (m.ask) field({ key: m.ask.key, type: m.ask.type, ...(m.ask.type === 'answer' ? {} : { nullable: true }), description: m.ask.question, note: lowerFirst(m.label) }, episodeFields);
      continue;
    }
    if (seg && seg.decidedBy === 'vote' && seg.voters === 'cast' && !m.custom && VOTE_SUFFIXES.some((x) => m.id === `${seg.id}${x}`)) continue; // below, per segment
    if (roleFact(m) || roleVote(m)) continue; // below, with the secret role
    if (m.from.wayOut && wayOf.get(m.from.wayOut).means !== 'outForOne') {
      const w = wayOf.get(m.from.wayOut);
      // Reaching the end, when the winner reached it too: everyone at the end scores it (Survivor's finalists).
      const exits = w.means === 'finalist' && w.winnerToo === true ? [...new Set([exitName(w), ...winners])] : [exitName(w)];
      implied.push({ whenExit: exits.length > 1 ? exits : exits[0], award });
      continue;
    }
    if (m.from.finale) {
      if (!endgameExitMethods.length) {
        warnings.push(`${m.label}: no way out reaches the end, so nothing awards it`);
        continue;
      }
      if (m.id === 'finaleJuryVote') implied.push({ whenExit: endgameExitMethods, award, per: 'juryVotes' });
      if (m.id === 'finaleNoJuryVotes') implied.push({ whenExit: endgameExitMethods, when: { fact: 'juryVotes', equals: 0 }, award });
      continue;
    }
    if (!m.ask) {
      warnings.push(`${m.label}: nothing says how it's known, so nothing awards it`);
      continue;
    }
    if (m.uses) {
      scoredFrom.push(m); // a question something else asks: only its rule, once every question is in (below)
      continue;
    }
    // Its own question first: yes or no, a number with its own test (came 2nd), or a count scored per unit.
    let own;
    let per = null;
    if (m.ask.type === 'answer') {
      // Won as a group first, then alone, with the group's win asked as well: this question is about winning it alone.
      // (With the group's win switched off and not counted as winning, the plain question covers both, as it always did.)
      const alone = !!groups && !!seg && seg.takesPart === 'groupsThenEach' && m.id === `${seg.id}Won` &&
        (list(m.also).length > 0 || moments.some((x) => x.id === `${seg.id}GroupWon`));
      field({ key: m.ask.key, type: 'answer', description: `${m.label}${alone ? ` on their own, not as part of a ${groups.singular}` : ''}, this ${part}: yes, no, or unknown.`, note: lowerFirst(m.label) });
      own = Y(m.ask.key);
    } else if ((m.ask.type === 'integer' || m.ask.type === 'number') && m.ask.when) {
      field(askField(m.ask));
      own = { answer: qk(m.ask.key), ...m.ask.when };
    } else if (m.ask.type === 'integer' || m.ask.type === 'number') {
      field({ key: m.ask.key, type: m.ask.type, nullable: true, description: countText(m), note: lowerFirst(m.label) });
      own = { answer: qk(m.ask.key), greaterThan: 0 };
      per = qk(m.ask.key);
    } else continue;
    // Then the answers that score it too, must be yes as well, or mustn't be.
    const also = list(m.also);
    for (const a of also) field(askField(a));
    referenced.push(...list(m.needs), ...list(m.unless));
    const test = also.length ? { any: [own, ...also.map((a) => Y(a.key))] } : own;
    const conds = [...list(m.needs).map((a) => Y(a.key)), test, ...list(m.unless).map((a) => N(a.key))];
    const when = conds.length > 1 ? { all: conds } : test;
    if (m.exile && legacy && legacy.rules.implied.some((r) => 'whenExiled' in r && built.has(r.award))) {
      // The base already scores the episode's exile record, which doesn't say which trip it was: one would score as both.
      warnings.push(`${m.label}: the base already scores being sent away, so nothing awards it`);
    } else if (m.exile) {
      // Recorded as the episode's exile, and scored from that record: taking it out takes the moment with it.
      gated({ when, stage: 'exiled' }, m);
      implied.push({ whenExiled: true, award });
    } else gated({ when, award, ...(per ? { per } : {}) }, m);
  }

  // A vote by the cast: who was there, the votes against each, and who each voted for.
  const voteFields = (s) => {
    field({ key: `${s.id}Attended`, type: 'answer', description: `Was this person at ${s.name} this ${part}, able to be voted for?`, note: `at ${s.name}` });
    field({ key: `${s.id}VotesReceived`, type: 'integer', nullable: true, description: `How many votes this person got at ${s.name}: 0 if they were there and got none, null if they weren't there.`, note: `votes at ${s.name}` });
    field({ key: `${s.id}VotedFor`, type: 'string', nullable: true, description: `Who this person voted for at ${s.name}, their full name as in the list; null if they didn't vote.`, note: `voted for at ${s.name}` });
  };
  const fresh = (mid) => built.has(ev(mid)) && !covered(ev(mid)) && momentOf.get(ev(mid)) && momentOf.get(ev(mid)).id === mid;
  const causedBy = (s) => [...new Set(exitWays.filter((w) => w.cause && typeof w.cause === 'object' && w.cause.segment === s.id).map(exitName))];
  for (const s of segs.filter((x) => !talk && x.decidedBy === 'vote' && x.voters === 'cast')) {
    const has = (x) => fresh(`${s.id}${x}`);
    if (!VOTE_SUFFIXES.some(has)) continue;
    voteFields(s);
    const at = { from: { segment: s.id } };
    // Whoever left this episode scores none of the vote's moments.
    const stayed = N('leftTheGame');
    if (has('ZeroVotes')) {
      // Not someone whose group's win skipped the vote: they were never at it (a wrong "attended" is what scores here).
      const skipped = list(momentOf.get(ev(`${s.id}ZeroVotes`)).unless);
      referenced.push(...skipped);
      gated({ when: { all: [Y(`${s.id}Attended`), { answer: qk(`${s.id}VotesReceived`), equals: 0 }, ...skipped.map((a) => N(a.key)), stayed] }, award: ev(`${s.id}ZeroVotes`) }, at);
    }
    if (has('SurvivedVotes')) gated({ when: { all: [{ answer: qk(`${s.id}VotesReceived`), greaterThan: 0 }, stayed] }, award: ev(`${s.id}SurvivedVotes`) }, at);
    if (has('VotedWithMajority') && has('VotedAgainstMajority')) {
      const out = causedBy(s);
      if (out.length) {
        for (const exitMethod of out) gated({ when: stayed, builtIn: 'votedForLeaver', vote: qk(`${s.id}VotedFor`), exitMethod, award: ev(`${s.id}VotedWithMajority`), otherwise: ev(`${s.id}VotedAgainstMajority`) }, at);
      } else warnings.push(`${s.name}: no way out says it sends someone home, so voting with the majority can't be told`);
    }
  }

  // ---------- the secret role ----------
  let roles = null;
  if (secret) {
    const [secretRole, other] = secret.roles;
    const recruits = secret.canSwitch === 'recruited';
    const recruitedValue = `Recruited ${secretRole}`;
    roles = legacy && legacy.roles
      ? legacy.roles
      : { default: other, values: [secretRole, ...(recruits ? [recruitedValue] : [])], ...(recruits ? { becomes: { [recruitedValue]: secretRole } } : {}) };
    const own = roles !== (legacy && legacy.roles);
    const word = up(camelId(secretRole));
    const isKey = `is${word}`;
    const becameKey = `became${word}`;
    const recruitedKey = `recruitedAs${word}`;
    const fact = (suffix) => fresh(`${secret.id}${suffix}`);
    const voteMoments = moments.filter((m) => roleVote(m) && fresh(m.id));
    if (own) {
      // The role questions, and the roles they record: someone a role from the start, or recruited into it.
      field({ key: isKey, type: 'answer', description: `Was this person a ${secretRole} at this ${part}'s vote (or, with no vote, by the end of it)? Recaps tell the audience who they are. 'no' for a ${other}.`, note: `a ${secretRole}` });
      field({ key: becameKey, type: 'answer', description: `Did they START playing as a ${secretRole} in THIS ${part}, chosen by the show${recruits ? ` (not recruited by other ${secretRole}s)` : ''}? 'no' if they already were one.`, note: `became a ${secretRole}` });
      if (recruits) field({ key: recruitedKey, type: 'answer', description: `Were they recruited as a ${secretRole} in THIS ${part}?`, note: `recruited as a ${secretRole}` });
      research.push({ when: recruits ? { all: [Y(becameKey), N(recruitedKey)] } : Y(becameKey), stage: 'role', role: secretRole });
      if (recruits) research.push({ when: Y(recruitedKey), stage: 'role', role: recruitedValue });
    }
    // Votes by role: a vote for someone who left, scored by what the voter and the person voted out were.
    const isRole = { any: [Y(isKey), Y(becameKey), ...(recruits ? [Y(recruitedKey)] : [])] };
    const notRole = { answer: qk(isKey), is: 'no' };
    for (const s of segs.filter((x) => x.decidedBy === 'vote' && x.voters === 'cast' && x.onTheLine === 'goingHome')) {
      const caught = voteMoments.find((m) => m.id === `${secret.id}CaughtAt${up(s.id)}`);
      const fooled = voteMoments.find((m) => m.id === `${secret.id}FooledAt${up(s.id)}`);
      if (!caught && !fooled) continue;
      if (!fieldKeys.has(qk(isKey))) {
        warnings.push(`${s.name}: votes by role need the ${secretRole} questions, which this rulebook's base doesn't ask`);
        continue;
      }
      const out = causedBy(s);
      if (!out.length) {
        warnings.push(`${s.name}: no way out says it sends someone home, so votes by role can't be told`);
        continue;
      }
      voteFields(s);
      for (const exitMethod of out) {
        gated({
          builtIn: 'voteByRole', votes: qk(`${s.id}VotedFor`), exitMethod, isRole, notRole,
          ...(caught ? { otherOnRole: ev(caught.id) } : {}), ...(fooled ? { roleOnOther: ev(fooled.id) } : {}),
        }, { from: { segment: s.id } });
      }
    }
    if (fact('Recruited')) {
      if (roles.values.includes(recruitedValue)) implied.push({ whenRole: recruitedValue, award: ev(`${secret.id}Recruited`) });
      else warnings.push(`Recruited as a ${secretRole}: the base records no recruitment, so nothing awards it`);
    }
    if (fact('MadeFinale')) {
      if (endgameExitMethods.length) implied.push({ whenExit: endgameExitMethods, when: { fact: 'role', is: secretRole }, award: ev(`${secret.id}MadeFinale`) });
      else warnings.push(`Reached the finale as a ${secretRole}: no way out reaches the end, so nothing awards it`);
    }
  }
  if (finaleNeedsJury(b) && moments.some((m) => m.from.finale && fresh(m.id))) {
    field({ key: 'juryVotesReceived', type: 'integer', nullable: true, description: 'Finalists only: how many jury votes they received. Null for everyone else.' });
  }
  // Every question a condition reads is asked, even one no moment of its own asks any more.
  for (const a of referenced) field(askField(a));

  // ---------- the base's own rules, for what it still scores ----------
  if (legacy) {
    const exits = new Set(exitMethods);
    const keepRoles = !!roles && roles === legacy.roles;
    const mentionsRole = (r) => JSON.stringify(r.when || {}).includes('"fact":"role"');
    const lost = new Set();
    const keep = (rule) => {
      const r = { ...rule };
      if ('whenExit' in r) {
        const methods = (Array.isArray(r.whenExit) ? r.whenExit : [r.whenExit]).filter((x) => exits.has(x));
        if (!methods.length) return null;
        r.whenExit = Array.isArray(r.whenExit) ? methods : methods[0];
      }
      if ('whenRole' in r && !(keepRoles && roles.values.includes(r.whenRole))) return null;
      if (mentionsRole(r) && !keepRoles) return null;
      if (r.stage === 'role') return keepRoles && roles.values.includes(r.role) ? r : null;
      if (r.stage) return r;
      if (r.builtIn) {
        const spec = BUILT_INS[r.builtIn];
        for (const [name, p] of Object.entries(spec.params)) {
          if (r[name] === undefined) continue;
          if (p.type === 'exitMethod' && !exits.has(r[name])) return null;
          if (p.type === 'role' && !keepRoles) return null;
          if (p.type === 'event' && !built.has(r[name])) {
            if (!p.optional) return null;
            delete r[name];
          }
        }
        if (spec.oneOf && !spec.oneOf.some((k) => r[k] !== undefined)) return null;
        return r;
      }
      return built.has(r.award) ? r : null;
    };
    const eventsOf = (r) => (r.builtIn ? Object.entries(BUILT_INS[r.builtIn].params).filter(([, p]) => p.type === 'event').map(([k]) => r[k]) : [r.award]).filter(Boolean);
    const carried = (rules, into) => {
      const out = [];
      for (const rule of rules) {
        const r = keep(rule);
        if (!r) {
          for (const e of eventsOf(rule)) if (built.has(e)) lost.add(e);
          continue;
        }
        // A rule for an event from a segment held in one phase runs only while that phase does, like the blocks' own.
        const first = eventsOf(r)[0];
        const g = into === research && first ? gateOf(momentOf.get(first)) : {};
        if (g) out.push({ ...r, ...g });
      }
      return out;
    };
    research.unshift(...carried(legacy.rules.research, research));
    implied.unshift(...carried(legacy.rules.implied, implied));
    for (const e of lost) {
      const still = [...research, ...implied].some((r) => eventsOf(r).includes(e));
      if (!still) warnings.push(`${events.find((x) => x.id === e).label}: its rule also needed something this rulebook no longer has, so nothing awards it`);
    }
  }

  if (waiting.size) {
    const ids = [...waiting];
    field({
      key: 'phaseStarted', type: 'enum', values: ids, nullable: true,
      description: `Did one of these parts of the season begin in THIS ${part}? ${ids.map((p) => `${p}: ${phaseById.get(p).name}${phaseById.get(p).summary ? ` (${phaseById.get(p).summary})` : ''}`).join('; ')}. Null if none did.`,
    }, episodeFields);
  }

  // The questions research asks besides, which score nothing of their own (what was found, anything else notable, whether
  // a vote was held): before the moments scored from a question, so one can be.
  for (const [key, q] of Object.entries(said)) {
    if (!isObj(q) || !q.type) continue;
    if (asked.has(key)) {
      if (!legacy) warnings.push(`How research asks "${key}": this rulebook already asks it, so its type isn't used`);
      continue;
    }
    field({ key, type: q.type, ...(q.type === 'answer' ? {} : { nullable: true }) }, q.of === 'episode' ? episodeFields : fields);
  }
  // Somewhere for anything else that happened to someone, and for what the sources disagree on (the research prompt says
  // so when the checklist has it, db/episode-research.js buildPrompt), as every built-in has: unless the rulebook asks it
  // itself (a question asked besides, above). Not on a base (its own questions stay), nor a talk show's (about the night),
  // nor a sport's (its results come from its data, and a roster is long).
  if (!legacy && !talk && kind !== 'sport' && !fieldKeys.has(qk('notableTwist'))) {
    field({
      key: 'notableTwist', type: 'string', nullable: true, note: '{value}',
      description: `Any other notable, checkable thing that happened to this person this ${part}, in one short phrase. Null if nothing.`,
    });
  }

  // A moment scored from a question the rulebook already asks (docs/PLAN-maker-scoring.md: "−0.5 a vote received at the Round
  // Table" on roundTableVotesReceived): no question of its own, only its rule on that question's answer. The question has to
  // be asked here, and of the kind it counts: yes or no for once an episode, a number for each time or per amount.
  for (const m of scoredFrom) {
    const key = qk(m.ask.key);
    const f = fields.find((x) => x.key === key) || (legacy ? legacy.research.checklist.find((x) => x.key === key) : null);
    const counts = f && (f.type === 'integer' || f.type === 'number');
    if (!f) problems.push(`${m.label}: it's scored from "${m.ask.key}", which this rulebook doesn't ask`);
    else if (m.ask.type === 'answer' ? f.type !== 'answer' : !counts) problems.push(`${m.label}: "${m.ask.key}" isn't ${m.ask.type === 'answer' ? 'a yes-or-no question' : 'a number'}`);
    else {
      // Not for whoever won the segment it's during (exceptWinners), as for a moment with a question of its own.
      const unless = list(m.unless);
      for (const a of unless) field(askField(a));
      const test = m.ask.type === 'answer' ? yes(key) : { answer: key, greaterThan: 0 };
      const when = unless.length ? { all: [test, ...unless.map((a) => N(a.key))] } : test;
      gated({ when, award: ev(m.id), ...(m.ask.type === 'answer' ? {} : { per: key }) }, m);
    }
  }

  // Words for a question these blocks don't ask (its moment taken out, say) are kept but not used. On a base, the base's
  // own questions keep the base's words, so nothing is said.
  if (!legacy) for (const key of Object.keys(said)) if (!asked.has(key)) warnings.push(`How research asks "${key}": this rulebook doesn't ask it, so its words aren't used`);

  // ---------- research's checks ----------
  // The contradictions the blocks' structure can tell, in its order, then the research block's own (the header); and
  // who was at each vote one group goes to at a time (its skippers stay away), for research's missed group moves.
  function researchChecks() {
    const out = [];
    const votes = [];
    const perPerson = new Set();
    const asks = (key) => fields.some((f) => f.key === qk(key));
    const asksEpisode = (key) => episodeFields.some((f) => f.key === qk(key) && f.type === 'answer');
    const exitIs = (names) => (names.length === 1 ? { answer: 'exitMethod', is: names[0] } : { any: names.map((n) => ({ answer: 'exitMethod', is: n })) });
    const castVotes = segs.filter((s) => !talk && s.decidedBy === 'vote' && s.voters === 'cast');
    const byVote = [...new Set(castVotes.flatMap((s) => causedBy(s)))];
    const group = (groups && groups.singular) || 'group';
    // Two sent home by a vote is two votes the same night (a double boot), and the checklist has one vote and one win a person
    // a part: the first vote's safe winner can go home at the second, and everyone there votes twice. So the checks that need
    // one vote are an episode's, made only on a night with one ({ value: 'votedOut' }; `perPerson`: a rulebook's own
    // condition for one says who it flags).
    const votedOut = (ways) => ({ count: { all: [Y('leftTheGame'), exitIs(ways)] } });
    const oneVote = { not: { value: 'votedOut', greaterThan: 1 } };
    for (const s of segs) {
      if (talk) break;
      const won = `${s.id}Won`;
      // Safe for winning it, yet voted out.
      if (s.onTheLine === 'safety' && asks(won) && byVote.length) {
        perPerson.add(`${s.id}WonVotedOut`);
        out.push({
          id: `${s.id}WonVotedOut`, of: 'episode', values: { votedOut: votedOut(byVote) }, when: oneVote,
          who: { all: [Y(won), Y('leftTheGame'), exitIs(byVote)] }, each: true, say: `{name}: went home ({exitMethod}) despite winning ${the(s.name)}`,
        });
      }
      // A finishing place of 1 is a win.
      if (s.decides === 'topThree' && s.places === 'place' && asks(`${s.id}Place`) && asks(won)) {
        out.push({ id: `${s.id}FirstNotWon`, when: { all: [{ answer: qk(`${s.id}Place`), equals: 1 }, N(won)] }, say: `{name}: finished 1st in ${the(s.name)} but isn't marked as winning it` });
      }
      if (!castVotes.includes(s) || !asks(`${s.id}Attended`)) continue;
      const [A, V, F] = ['Attended', 'VotesReceived', 'VotedFor'].map((x) => qk(`${s.id}${x}`));
      const at = { answer: A, is: 'yes' };
      out.push({ id: `${s.id}VotesWhileAway`, when: { all: [{ answer: A, is: 'no' }, { answer: V, greaterThan: 0 }] }, say: `{name}: {${V}} votes against someone who wasn't at ${s.name}` });
      if (asksEpisode(`${s.id}Held`)) {
        out.push({
          id: `${s.id}NotHeld`, of: 'episode', values: { attending: { count: at } },
          when: { all: [{ episode: qk(`${s.id}Held`), is: 'no' }, { value: 'attending', greaterThan: 0 }] }, who: at, set: { [A]: 'no', [V]: null },
          say: `No ${s.name} this ${part}, but some people were marked as attending it (cleared)`,
        });
      }
      // A group whose win skips the vote was never at it, and the rest go one group at a time.
      const by = s.skippedBy ? segById.get(s.skippedBy) : null;
      if (by) votes.push({ id: `${s.id}GroupMove`, attended: A, say: `{name} was at {group}'s ${s.name} but was still on {was}: added a move to {group} (reject it in review if that's wrong)` });
      if (by && asks(`${by.id}GroupWon`)) {
        out.push({
          id: `${s.id}SkippedBy`, of: 'episode', who: { all: [at, Y(`${by.id}GroupWon`)] }, each: true, set: { [A]: 'unknown' },
          say: `{name}: marked as at ${s.name}, but in the ${group} that won ${the(by.name)} (cleared to unknown)`,
        });
      }
      // A real vote puts votes on someone: everyone there on zero means the counts weren't found, not that all were safe.
      out.push({
        id: `${s.id}NoVotesFound`, of: 'episode',
        values: { attending: { count: at }, attendingWithVotes: { count: { all: [at, { not: { answer: V, equals: 0 } }] } }, anyVotes: { count: { answer: V, greaterThan: 0 } } },
        when: { all: [{ value: 'attending', greaterThan: 0 }, { value: 'attendingWithVotes', equals: 0 }, { value: 'anyVotes', equals: 0 }] }, who: at, set: { [V]: null },
        say: `Everyone at ${s.name} was given zero votes, so the vote counts look missing (cleared, nobody marked safe)`,
      });
      // Votes against people should roughly match the people voting: only reported (revotes, extra votes and idols differ), and
      // on a night with one of its votes (on two, everyone there votes twice).
      const one = causedBy(s).length ? { votedOut: votedOut(causedBy(s)) } : null;
      out.push({
        id: `${s.id}VoteCount`, of: 'episode', values: { voters: { count: { all: [at, { answer: F, present: true }] } }, against: { sum: V }, ...one },
        when: { all: [{ value: 'voters', greaterThan: 0 }, { value: 'against', greaterThan: 0 }, { not: { value: 'against', equals: { value: 'voters' } } }, ...(one ? [oneVote] : [])] },
        say: `{against} votes counted against people, but {voters} people at ${s.name} are recorded voting: check who was there`,
      });
    }
    for (const t of twists) {
      const [C, P] = [`${t.id}VotesCancelled`, `${t.id}Played`];
      if (t.type === 'advantage' && t.cancelled === 'count' && asks(C) && asks(P)) {
        out.push({ id: `${t.id}CancelledUnplayed`, when: { all: [{ answer: qk(C), greaterThan: 0 }, N(P)] }, say: `{name}: votes cancelled by ${t.oneIsCalled || 'an advantage'} they aren't marked as playing` });
      }
    }
    // The research block's: words, a condition or off for one of these, and checks of its own.
    const own = isObj(b.research) && isObj(b.research.checks) ? b.research.checks : {};
    const derived = new Set([...out, ...votes].map((k) => k.id));
    const groupVotes = votes
      .filter((v) => !(isObj(own[v.id]) && own[v.id].off === true))
      .map(({ id, attended, say }) => ({ attended, say: isObj(own[id]) && typeof own[id].words === 'string' && own[id].words.trim() ? own[id].words : say }));
    const shaped = (id, c, base) => {
      const k = { ...(base || { id }) };
      if (typeof c.words === 'string' && c.words.trim()) k.say = renamePlaceholders(c.words, qk);
      if (isObj(c.when) && perPerson.has(id)) k.who = renameAnswers(c.when, qk);
      else if (isObj(c.when)) k.when = renameAnswers(c.when, qk);
      if (isObj(c.set)) k.set = Object.fromEntries(Object.entries(c.set).map(([key, v]) => [qk(key), v]));
      return k;
    };
    const all = [];
    for (const k of out) {
      const c = isObj(own[k.id]) ? own[k.id] : null;
      if (c && c.off === true) continue;
      all.push(c ? shaped(k.id, c, k) : k);
    }
    for (const [id, c] of Object.entries(own)) {
      if (derived.has(id) || !isObj(c) || c.off === true) continue;
      if (!isObj(c.when) || !(typeof c.words === 'string' && c.words.trim())) {
        warnings.push(`How research checks "${id}": this rulebook makes no such check, and a check of its own needs its condition and words`);
        continue;
      }
      all.push(shaped(id, c));
    }
    // One that reads a question these blocks don't ask (its moment taken out, say) is left out.
    const asked = { research: { checklist, episodeFields }, exitMethods };
    const why = (bad) => bad[0].replace(/^research\.checks\[[^\]]+\]\.?\s*:?\s*/, '');
    const checks = [];
    for (const k of all) {
      const bad = checksProblems([k], asked);
      if (!bad.length) checks.push(k);
      else if (!own[k.id]) problems.push(...bad);
      else {
        // The rulebook's own words or condition for one of these read a question it doesn't ask: the compiler's own, if that's still sound.
        const mine = derived.has(k.id) ? out.find((x) => x.id === k.id) : null;
        const fallback = mine && !checksProblems([mine], asked).length;
        if (fallback) checks.push(mine);
        warnings.push(`How research checks "${k.id}": ${why(bad)}, so ${fallback ? "it's checked as the blocks make it" : "it's left out"}`);
      }
    }
    return { checks, groupVotes };
  }

  const core = (key) => ['sources', 'confidence'].includes(key);
  // The questions every checklist has, in research's words where the rulebook gives them.
  const say = (key, words) => wordsOf(key) || words;
  const checklist = legacy
    ? [...legacy.research.checklist.filter((f) => !core(f.key)), ...fields, ...legacy.research.checklist.filter((f) => core(f.key))]
    : [
      { key: 'name', type: 'string', description: say('name', `The ${terms.castaway.toLowerCase()}'s full name, exactly as given in the list you were sent.`) },
      { key: 'leftTheGame', type: 'answer', description: say('leftTheGame', talk ? `Did this person leave the show for good in THIS ${part}?` : `Did this person leave the game permanently in THIS ${part}?`) },
      { key: 'exitMethod', type: 'exitMethod', nullable: true, description: say('exitMethod', 'How they left, if they left. Null if they did not leave.') },
      ...fields,
      { key: 'sources', type: 'stringList', description: say('sources', "URLs you actually read that support the answers above for THIS person. Empty only if every answer is 'unknown'.") },
      {
        key: 'confidence', type: 'enum', values: ['high', 'medium', 'low'],
        description: say('confidence', 'high: a source states it plainly. medium: a source implies it. low: pieced together or a single weak source.'),
      },
    ];
  const newClaims = fields.filter((f) => f.type === 'answer' && !unsourced.has(f.key)).map((f) => f.key);
  const { checks, groupVotes } = legacy ? { checks: legacy.research.checks || null, groupVotes: legacy.research.groupVotes || null } : researchChecks();

  // ---------- how it's grouped and headlined ----------
  const categories = legacy ? legacy.eventCategories.map((c) => ({ ...c, events: c.events.filter((e) => built.has(e)) })).filter((c) => c.events.length) : [];
  const catFor = new Map();
  const usedCat = new Set(categories.map((c) => c.id));
  // What the blocks add to the base's leaving and endgame goes in its own groups of those.
  for (const c of categories) if (c.id === 'leaving' || c.id === 'endgame') catFor.set(c.id, c);
  const category = (key, label) => {
    if (!catFor.has(key)) {
      let cid = camelId(key) || 'group';
      for (let i = 2; usedCat.has(cid); i++) cid = `${camelId(key)}${i}`;
      usedCat.add(cid);
      const c = { id: cid, label, events: [] };
      catFor.set(key, c);
      categories.push(c);
    }
    return catFor.get(key);
  };
  const twistName = (tid) => (twists.find((t) => t.id === tid) || {}).name || 'Twists';
  const grouped = new Set(categories.flatMap((c) => c.events));
  for (const m of moments) {
    const eid = ev(m.id);
    if (!built.has(eid) || grouped.has(eid)) continue;
    grouped.add(eid);
    let c;
    if (m.from.segment) c = category(`segment ${m.from.segment}`, segById.get(m.from.segment).name);
    else if (m.from.twist) c = category(`twist ${m.from.twist}`, twistName(m.from.twist));
    else if (m.from.wayOut) c = ['out', 'outForOne'].includes(wayOf.get(m.from.wayOut).means)
      ? category('leaving', blockLabel(b, 'waysOut') || 'Leaving the game')
      : category('endgame', 'Endgame');
    else if (m.from.finale) c = category('endgame', 'Endgame');
    else c = category('other', talk ? 'What can happen' : 'Other moments');
    c.events.push(eid);
  }
  const recap = [];
  for (const r of legacy ? legacy.recap : []) {
    const { tribeEvents, ...entry } = r;
    entry.events = r.events.filter((e) => built.has(e));
    const tribe = list(tribeEvents).filter((e) => built.has(e));
    if (entry.events.length) recap.push(tribe.length ? { ...entry, tribeEvents: tribe } : entry);
  }
  for (const s of segs.filter((x) => x.onTheLine === 'safety' || x.onTheLine === 'reward')) {
    const won = moments.find((m) => m.id === `${s.id}Won`);
    const group = moments.find((m) => m.id === `${s.id}GroupWon`);
    const ids = [won, group].filter((m) => m && built.has(ev(m.id)) && !covered(ev(m.id))).map((m) => ev(m.id));
    if (!ids.length) continue;
    // A group's win counted as winning it is the tribe's own headline before the merge, as a group's win is.
    const tribe = group && ids.includes(ev(group.id)) ? [ev(group.id)] : won && list(won.also).length && ids.includes(ev(won.id)) ? [ev(won.id)] : null;
    recap.push({ label: s.name, events: [...new Set(ids)], ...(tribe ? { tribeEvents: tribe } : {}) });
  }

  const name = b.show || (legacy && legacy.name) || 'A show';
  const data = {
    id: (legacy && legacy.id) || id || formatIdFor(name),
    name,
    exitMethods,
    terms,
    winnerExitMethod: winner ? exitName(winner) : null,
    endgameExitMethods,
    events,
    eventCategories: categories,
    recap,
    hasMerge: list(b.season && b.season.phases).some((p) => list(p.changes).includes('groupsEnd')),
    hasGroups: !!groups,
    ...(roles ? { roles } : {}),
    wiki: legacy
      ? { ...legacy.wiki, eventTypes: legacy.wiki.eventTypes.filter((e) => built.has(e)) }
      : {
        version: 1,
        voteSections: [],
        guideSections: [],
        missingVotesNote: 'no vote or elimination table found: who left will come from research',
        missingGuideNote: 'no episode guide found: who left will come from research',
        eventTypes: [],
        routineEliminations: 1,
      },
    research: {
      checklist,
      episodeFields: legacy ? [...legacy.research.episodeFields, ...episodeFields] : episodeFields,
      searchHint: legacy ? legacy.research.searchHint : ownHint(b) || searchHint(b, part),
      claims: legacy ? [...legacy.research.claims, ...newClaims] : ['leftTheGame', ...newClaims],
      ...(checks && (legacy || checks.length) ? { checks } : {}),
      ...(groupVotes && groupVotes.length ? { groupVotes } : {}),
    },
    rules: { research, implied },
  };
  problems.push(...formatProblems(data));
  return { data, problems, warnings };
}

/** The rulebook's own search hint for research, when it gives one: its lines. */
function ownHint(b) {
  const h = isObj(b.research) ? b.research.searchHint : null;
  return Array.isArray(h) && h.length && h.every((l) => typeof l === 'string') ? [...h] : null;
}

function finaleNeedsJury(b) {
  const f = b.season && b.season.finale;
  return !!f && f.decidedBy === 'juryVote' && kindOf(b) !== 'talk';
}

function searchHint(b, part) {
  const names = list(b.segments).filter((s) => s.decidedBy !== 'nobody').map((s) => s.name);
  if (kindOf(b) === 'talk') {
    return [`Search for this ${part}'s recap and reviews: who hosted, who performed, and what happened in it.`, 'Then answer the episode questions, and the checklist for every person above.'];
  }
  return [
    `Search for this ${part}'s recap and any reporting on ${names.length ? `${names.join(', ')}, ` : ''}what happened to each person, and who left.`,
    'Then answer the checklist for every person above.',
  ];
}

module.exports = { compileRulebook, phaseRanges, formatForRulebook: Formats.formatForRulebook };
