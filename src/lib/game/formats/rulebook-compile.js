// A rulebook's blocks compiled to the engine's format data (docs/PLAN-rulebooks-implementation.md 4.3): the
// FormatData every league, the research pipeline and scoring already run on. The blocks say what can happen;
// this writes the events, categories, research checklist and rules that make it score.
//
//   compileRulebook(blocks, { aliases?, id?, reader?, base?, phaseStarts? }) -> { data, problems, warnings }
//   formatForRulebook(data, reader?) -> the runtime format (index.js)
//
// FROM THE BLOCKS. Each moment is an event (its id through `aliases.events`, so a built-in's recorded events
// keep their ids); each way out an exit method (through `aliases.exits`); each question a moment asks a
// checklist field, and a yes-or-no one a research rule. A count scores once per unit (rules.js `per`): a whole
// number for "each time", any number for an amount that needn't be whole (innings pitched). A way out is an
// implied rule, and so is a jury finale. A vote by the cast adds who was there, how many votes each got and who
// each voted for, and scores the majority through the votedForLeaver built-in. A secret role (one per
// rulebook) adds the role questions, records the roles research reports, and scores votes by role through
// voteByRole. A talk show's moments are about the night, not a person, so they're episode-level answers
// (episode games score them, step 12), with nothing awarded to anyone.
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
const { momentsFor } = require('./rulebook-moments.js');
/* eslint-enable @typescript-eslint/no-require-imports */

const list = (v) => (Array.isArray(v) ? v : []);
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
  const isImplied = (m) => (m.from.wayOut && wayOf.get(m.from.wayOut).means !== 'outForOne') || !!m.from.finale || roleFact(m);
  const fromBlocks = [];
  const seenIds = new Map();
  for (const m of moments) {
    const eid = ev(m.id);
    if (seenIds.has(eid)) {
      problems.push(`events: ${m.id} and ${seenIds.get(eid)} are both ${eid}`);
      continue;
    }
    seenIds.set(eid, m.id);
    fromBlocks.push({ id: eid, label: m.label, defaultPoints: m.defaultPoints, ...(isImplied(m) ? { implied: true } : {}) });
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
  const field = (f, into = fields) => {
    if (fieldKeys.has(f.key)) return;
    fieldKeys.add(f.key);
    into.push(f);
  };
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
      implied.push({ whenExit: exitName(wayOf.get(m.from.wayOut)), award });
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
    if (m.ask.type === 'answer') {
      field({ key: m.ask.key, type: 'answer', description: `${m.label}, this ${part}: yes, no, or unknown.`, note: lowerFirst(m.label) });
      gated({ when: yes(m.ask.key), award }, m);
    } else if (m.ask.type === 'integer' || m.ask.type === 'number') {
      field({ key: m.ask.key, type: m.ask.type, nullable: true, description: countText(m), note: lowerFirst(m.label) });
      gated({ when: { answer: m.ask.key, greaterThan: 0 }, award, per: m.ask.key }, m);
    }
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
    const stayed = notYes('leftTheGame');
    if (has('ZeroVotes')) gated({ when: { all: [yes(`${s.id}Attended`), { answer: `${s.id}VotesReceived`, equals: 0 }, stayed] }, award: ev(`${s.id}ZeroVotes`) }, at);
    if (has('SurvivedVotes')) gated({ when: { all: [{ answer: `${s.id}VotesReceived`, greaterThan: 0 }, stayed] }, award: ev(`${s.id}SurvivedVotes`) }, at);
    if (has('VotedWithMajority') && has('VotedAgainstMajority')) {
      const out = causedBy(s);
      if (out.length) {
        for (const exitMethod of out) gated({ builtIn: 'votedForLeaver', vote: `${s.id}VotedFor`, exitMethod, award: ev(`${s.id}VotedWithMajority`), otherwise: ev(`${s.id}VotedAgainstMajority`) }, at);
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
      research.push({ when: recruits ? { all: [yes(becameKey), notYes(recruitedKey)] } : yes(becameKey), stage: 'role', role: secretRole });
      if (recruits) research.push({ when: yes(recruitedKey), stage: 'role', role: recruitedValue });
    }
    // Votes by role: a vote for someone who left, scored by what the voter and the person voted out were.
    const isRole = { any: [yes(isKey), yes(becameKey), ...(recruits ? [yes(recruitedKey)] : [])] };
    const notRole = { answer: isKey, is: 'no' };
    for (const s of segs.filter((x) => x.decidedBy === 'vote' && x.voters === 'cast' && x.onTheLine === 'goingHome')) {
      const caught = voteMoments.find((m) => m.id === `${secret.id}CaughtAt${up(s.id)}`);
      const fooled = voteMoments.find((m) => m.id === `${secret.id}FooledAt${up(s.id)}`);
      if (!caught && !fooled) continue;
      if (!fieldKeys.has(isKey)) {
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
          builtIn: 'voteByRole', votes: `${s.id}VotedFor`, exitMethod, isRole, notRole,
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

  // A moment scored from a question the rulebook already asks (docs/PLAN-maker-scoring.md: "−0.5 a vote received at the Round
  // Table" on roundTableVotesReceived): no question of its own, only its rule on that question's answer. The question has to
  // be asked here, and of the kind it counts: yes or no for once an episode, a number for each time or per amount.
  for (const m of scoredFrom) {
    const f = fields.find((x) => x.key === m.ask.key) || (legacy ? legacy.research.checklist.find((x) => x.key === m.ask.key) : null);
    const counts = f && (f.type === 'integer' || f.type === 'number');
    if (!f) problems.push(`${m.label}: it's scored from "${m.ask.key}", which this rulebook doesn't ask`);
    else if (m.ask.type === 'answer' ? f.type !== 'answer' : !counts) problems.push(`${m.label}: "${m.ask.key}" isn't ${m.ask.type === 'answer' ? 'a yes-or-no question' : 'a number'}`);
    else if (m.ask.type === 'answer') gated({ when: yes(m.ask.key), award: ev(m.id) }, m);
    else gated({ when: { answer: m.ask.key, greaterThan: 0 }, award: ev(m.id), per: m.ask.key }, m);
  }

  const core = (key) => ['sources', 'confidence'].includes(key);
  const checklist = legacy
    ? [...legacy.research.checklist.filter((f) => !core(f.key)), ...fields, ...legacy.research.checklist.filter((f) => core(f.key))]
    : [
      { key: 'name', type: 'string', description: `The ${terms.castaway.toLowerCase()}'s full name, exactly as given in the list you were sent.` },
      { key: 'leftTheGame', type: 'answer', description: talk ? `Did this person leave the show for good in THIS ${part}?` : `Did this person leave the game permanently in THIS ${part}?` },
      { key: 'exitMethod', type: 'exitMethod', nullable: true, description: 'How they left, if they left. Null if they did not leave.' },
      ...fields,
      { key: 'sources', type: 'stringList', description: "URLs you actually read that support the answers above for THIS person. Empty only if every answer is 'unknown'." },
      {
        key: 'confidence', type: 'enum', values: ['high', 'medium', 'low'],
        description: 'high: a source states it plainly. medium: a source implies it. low: pieced together or a single weak source.',
      },
    ];
  const newClaims = fields.filter((f) => f.type === 'answer').map((f) => f.key);

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
    const tribe = group && ids.includes(ev(group.id)) ? [ev(group.id)] : null;
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
      searchHint: legacy ? legacy.research.searchHint : searchHint(b, part),
      claims: legacy ? [...legacy.research.claims, ...newClaims] : ['leftTheGame', ...newClaims],
    },
    rules: { research, implied },
  };
  problems.push(...formatProblems(data));
  return { data, problems, warnings };
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
