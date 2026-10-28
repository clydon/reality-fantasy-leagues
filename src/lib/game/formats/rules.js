// Scoring rules as data (docs/PLAN-scoring-rules-as-data.md): what turns research answers and recorded
// facts into scoring events, written as a list of "when this is true, award this" rules rather than a
// function, so a format's scoring can be stored, reviewed, edited as a list or a flowchart, and one day
// proposed by a model for a show nobody hand-wrote. A format's data half carries them as
//
//   rules: { research: [ ...rules ], implied: [ ...rules ] }
//
// and defineFormat (define.js) builds the two functions callers have always called from them:
// research.items (one person's checklist answers -> staged results) and impliedEvents (an episode's
// exits, exiles and roles -> events, on every read).
//
// RESEARCH RULES -- one person's answers (`answer` is a checklist field's key):
//
//   { when: { answer: 'wonIndividualImmunity', is: 'yes' }, award: 'individualImmunity' }
//   { when: { answer: 'exiled', is: 'yes' }, stage: 'exiled' }               an exile fact, not an event
//   { when: { answer: 'recruitedAsTraitor', is: 'yes' }, stage: 'role', role: 'Recruited Traitor' }
//   { when: { answer: 'homeRuns', greaterThan: 0 }, award: 'homeRun', per: 'homeRuns' }
//
//   `per` scores once per unit of a count: the result carries the answer as its `units` (3 home runs, or
//   6.67 innings for a `number` question), and its points are multiplied by them. One result, not three:
//   staging keeps one row per person and event (db/episode-research.js candidatesFor), so the count rides
//   on it, the way a finalist's jury votes ride on their exit. An answer that isn't a count of the
//   question's type (a fraction for a whole-number question, nothing, 0) awards nothing.
//
// IMPLIED RULES -- facts the league already holds, so a corrected exit re-scores on its own:
//
//   { whenExit: 'Voted Out', award: 'votedOut' }                              whenExit: a method or a list
//   { whenExit: [...finalists], award: 'juryVote', per: 'juryVotes' }        once per jury vote received
//   { whenExit: 'Winner', when: { fact: 'role', is: 'Traitor' }, award: 'wonAsTraitor' }
//   { whenExiled: true, award: 'wentToExile' }
//   { whenRole: 'Recruited Traitor', award: 'recruited' }
//
//   An exit rule's `when` reads facts about that exit: `juryVotes` (a whole number), `role` (the
//   leaver's role as of the episode) and `finale` ('yes' when the episode crowns a winner; never, for a
//   format nobody wins: winnerExitMethod null).
//
// CONDITIONS -- a leaf names one answer (or fact) and one test: is / isNot (exact match), equals
// (a number), greaterThan (a number; only ever true for a number), present (true/false: a non-empty
// text or list). Leaves combine with { all: [...] }, { any: [...] } and { not: ... }.
//
// BUILT-INS -- { builtIn: '<name>', ...params } (with an optional `when` gate, and an exit rule's
// `whenExit`): the cases that look across people or at roles on both sides of an event, kept as named
// read-only functions here (BUILT_INS) rather than bent into conditions. A new unusual rule becomes a
// new built-in, reviewed like code -- never a new language feature.
//
// ORDER -- results come out in rule order, one person (or one exit) at a time, exactly as the
// functions these replaced produced them, and are NOT deduplicated here: the staging code dedupes by
// (person, kind, event) (db/episode-research.js candidatesFor). Implied rules are applied fact by fact;
// exits, exiles and roles are taken in the order their first rule appears.
//
// EPISODE GATING -- a season's rule changes (season-changes.js, docs/PLAN-season-rule-changes.md) add
// rules that only apply from the episode the change takes effect, and can retire an event from one:
//
//   { when: { answer: 'sentAway', is: 'yes' }, award: 'sentAway', fromEpisode: 8 }
//   events: [{ id: 'journey', ..., retiredFrom: 8 }]                   nothing awards it from episode 8
//
// A rule can also stop: `untilEpisode` is the last episode it runs for (a compiled rulebook's moments
// from a segment held in one phase of the season, rulebook-compile.js, and an edit that replaces an item).
//
// Both are checked against the episode the answers or facts are for, so a change can never reach back
// into an episode before it, even when that episode is researched again or re-derived on a read. With
// no episode to check against, a gated rule doesn't run and a retired event isn't awarded: a missing
// award shows up in review, a retroactive one silently rescores a league. A format with neither (every
// format's own rules) behaves exactly as it did.
//
// rulesProblems says why a set of rules isn't usable, each with a reason, as formatProblems does for
// the rest of a format. Plain CommonJS with no dependencies, like everything in formats/.

const ANSWERS = ['yes', 'no', 'unknown'];
const OPS = ['is', 'isNot', 'equals', 'greaterThan', 'present'];
const COMBINATORS = ['all', 'any', 'not'];
const TRIGGERS = ['whenExit', 'whenExiled', 'whenRole'];
const STAGES = ['exiled', 'role'];

// What each test can be applied to. `text` covers string, enum and exitMethod (and role names);
// `flag` is a yes/no fact.
const OPS_FOR = {
  answer: ['is', 'isNot'],
  string: ['is', 'isNot', 'present'],
  enum: ['is', 'isNot', 'present'],
  exitMethod: ['is', 'isNot', 'present'],
  integer: ['equals', 'greaterThan'],
  number: ['equals', 'greaterThan'],
  stringList: ['present'],
  role: ['is', 'isNot'],
  flag: ['is', 'isNot'],
};

// Facts an exit rule's conditions can read, with the type each test checks against.
const EXIT_FACTS = {
  juryVotes: { type: 'integer', describe: 'jury votes received (a finalist)' },
  role: { type: 'role', describe: "the leaver's role as of the episode" },
  finale: { type: 'flag', describe: 'the episode crowns a winner' },
};

// A list answer as a list: one given as a single string (a research run from before the field took
// several) counts as one, and blanks don't count.
const listOf = (v) => (Array.isArray(v) ? v : v ? [v] : []).filter(Boolean);
// The checklist question types a count can be read from (`per`), and how many units an answer is: a
// whole number above 0 for an integer question, any number above 0 for a number one; else none.
const COUNT_TYPES = ['integer', 'number'];
const unitsOf = (v, type) => ((type === 'integer' ? Number.isInteger(v) : Number.isFinite(v)) && v > 0 ? v : null);
// Whether exit method `m` crowns the winner. A format nobody wins has none, and a null method (someone
// still in the game) never did.
const isWinnerExit = (m, winnerExitMethod) => winnerExitMethod != null && m === winnerExitMethod;
// How names compare when the caller doesn't supply its own match.
const sameName = (a, b) => String(a).trim().toLowerCase() === String(b).trim().toLowerCase();

function test(cond, read) {
  if ('all' in cond) return cond.all.every((c) => test(c, read));
  if ('any' in cond) return cond.any.some((c) => test(c, read));
  if ('not' in cond) return !test(cond.not, read);
  const v = read(cond);
  if ('is' in cond) return v === cond.is;
  if ('isNot' in cond) return v !== cond.isNot;
  if ('equals' in cond) return v === cond.equals;
  if ('greaterThan' in cond) return typeof v === 'number' && v > cond.greaterThan;
  return (listOf(v).length > 0) === cond.present;
}
const answers = (entry) => (leaf) => entry[leaf.answer];

// ---------- the built-in library ----------
//
// Each one: where it runs, the params a rule gives it (validated by rulesProblems), a description for
// the editor (a fixed node that can be switched on or off, but not opened up), and `run`, which returns
// the event ids to award. Param types: `event`, `exitMethod`, `role`, `condition` (a research
// condition, tested against whoever the built-in is looking at), and `field` (a checklist key of one
// of `fieldTypes`).

// true / false / null (unknown) for "has the role", from the rule's isRole and notRole conditions:
// isRole wins when both hold.
const sideOf = (rule, entry) => (test(rule.isRole, answers(entry)) ? true : test(rule.notRole, answers(entry)) ? false : null);

// The event for an actor and a target by role; nothing when either side is unknown, never a guess, and
// nothing for a pairing the rule leaves out.
function byRole(rule, actor, target) {
  if (actor === null || target === null) return null;
  if (actor) return target ? rule.roleOnRole : rule.roleOnOther;
  return target ? rule.otherOnRole : rule.otherOnOther;
}

// Everyone whose answers say they left this episode by `exitMethod`.
const leavers = (env, exitMethod) => env.everyone.filter((c) => c.leftTheGame === 'yes' && c.exitMethod === exitMethod);

// The four pairings are each optional (a compiled rulebook scores only some: a Faithful catching a
// Traitor, a Traitor fooling the table), but a rule needs at least one (`oneOf`).
const ROLE_PARAMS = {
  exitMethod: { type: 'exitMethod' },
  isRole: { type: 'condition' },
  notRole: { type: 'condition' },
  roleOnRole: { type: 'event', optional: true },
  otherOnRole: { type: 'event', optional: true },
  roleOnOther: { type: 'event', optional: true },
  otherOnOther: { type: 'event', optional: true },
};
const ROLE_EVENTS = ['roleOnRole', 'otherOnRole', 'roleOnOther', 'otherOnOther'];

const BUILT_INS = {
  votedForLeaver: {
    context: 'research',
    params: { vote: { type: 'field', fieldTypes: ['string'] }, exitMethod: { type: 'exitMethod' }, award: { type: 'event' }, otherwise: { type: 'event' } },
    describe:
      'Voted for someone who left this episode by {exitMethod}: {award}. Voted for someone else at an ' +
      'episode where someone did: {otherwise}. Reads everyone\'s answers to find who left.',
    run(entry, env, rule) {
      const vote = entry[rule.vote];
      if (!vote) return [];
      const out = leavers(env, rule.exitMethod).map((c) => c.name);
      if (out.some((n) => env.same(n, vote))) return [rule.award];
      return out.length ? [rule.otherwise] : [];
    },
  },
  // Same idea as votedForLeaver, for a mechanic votedForLeaver can't express: naming more than one
  // person (an extra vote, a vote nullified and redone, two couples voting as one) with no secret
  // roles involved. Recurring across shows -- Survivor's extra-vote advantages are the same shape --
  // so it's a built-in, not a one-off fix for a single format.
  votedForLeavers: {
    context: 'research',
    params: { votes: { type: 'field', fieldTypes: ['stringList', 'string'] }, exitMethod: { type: 'exitMethod' }, award: { type: 'event' }, otherwise: { type: 'event' } },
    describe:
      'Named anyone who left this episode by {exitMethod} among their votes: {award}. Named only people who stayed, at an ' +
      'episode where someone did: {otherwise}. Reads everyone\'s answers to find who left.',
    run(entry, env, rule) {
      const votes = listOf(entry[rule.votes]);
      if (!votes.length) return [];
      const out = leavers(env, rule.exitMethod).map((c) => c.name);
      if (votes.some((v) => out.some((n) => env.same(n, v)))) return [rule.award];
      return out.length ? [rule.otherwise] : [];
    },
  },
  voteByRole: {
    context: 'research',
    params: { votes: { type: 'field', fieldTypes: ['string', 'stringList'] }, ...ROLE_PARAMS },
    oneOf: ROLE_EVENTS,
    describe:
      'Each vote for someone who left this episode by {exitMethod} scores by what the voter and the ' +
      'person voted for were: has the role (isRole) or not (notRole). Either unknown: nothing.',
    run(entry, env, rule) {
      const actor = sideOf(rule, entry);
      const left = leavers(env, rule.exitMethod);
      const ids = [];
      for (const target of listOf(entry[rule.votes])) {
        const b = left.find((c) => env.same(c.name, target));
        const type = b && byRole(rule, actor, sideOf(rule, b));
        if (type) ids.push(type);
      }
      return ids;
    },
  },
  caseLeadByRole: {
    context: 'research',
    params: { accusations: { type: 'field', fieldTypes: ['string', 'stringList'] }, ...ROLE_PARAMS },
    oneOf: ROLE_EVENTS,
    describe:
      'Named in {accusations} by someone who left this episode by {exitMethod} (led the case against ' +
      'them): scores by what the accuser and the person who left were. Either unknown: nothing.',
    run(entry, env, rule) {
      const actor = sideOf(rule, entry);
      const ids = [];
      for (const b of leavers(env, rule.exitMethod)) {
        if (!listOf(b[rule.accusations]).some((a) => env.same(a, entry.name))) continue;
        const type = byRole(rule, actor, sideOf(rule, b));
        if (type) ids.push(type);
      }
      return ids;
    },
  },
  roleWonEpisode: {
    context: 'implied',
    params: { role: { type: 'role' }, award: { type: 'event' } },
    describe: 'Someone with the role {role} was crowned the winner this episode: {award}.',
    run(el, ep, env, rule) {
      return env.exits.some((x) => isWinnerExit(x.method, env.winnerExitMethod) && env.roleOf(x) === rule.role) ? [rule.award] : [];
    },
  },
};

// ---------- building the functions ----------

function triggerOf(rule) {
  return TRIGGERS.find((t) => t in rule);
}
const methodsOf = (rule) => (Array.isArray(rule.whenExit) ? rule.whenExit : [rule.whenExit]);

// Whether a rule applies at episode `n` (see EPISODE GATING above).
const ruleRuns = (rule, n) =>
  (!('fromEpisode' in rule) || (Number.isInteger(n) && n >= rule.fromEpisode)) &&
  (!('untilEpisode' in rule) || (Number.isInteger(n) && n <= rule.untilEpisode));
const isGated = (rule) => 'fromEpisode' in rule || 'untilEpisode' in rule;

// Whether event `id` can be awarded at episode `n`: everything but what's retired by then. Null when
// nothing is retired, so a format without retirements does no extra work.
function awardableAt(data) {
  const retired = new Map();
  for (const e of (data && Array.isArray(data.events) ? data.events : [])) if (e && Number.isInteger(e.retiredFrom)) retired.set(e.id, e.retiredFrom);
  if (!retired.size) return null;
  return (id, n) => !retired.has(id) || (Number.isInteger(n) && n < retired.get(id));
}

/** research.items from a format's research rules: (entry, add, ctx) -> calls add, in rule order. */
function researchItemsFrom(rules, data) {
  const awardable = awardableAt(data);
  const typeOf = new Map();
  for (const f of (data && data.research && Array.isArray(data.research.checklist) ? data.research.checklist : [])) if (f) typeOf.set(f.key, f.type);
  return function researchItems(entry, add, ctx) {
    const c = ctx || {};
    // `ctx.payload` is the whole episode's answers; `ctx.same(a, b)` compares names by who they are;
    // `ctx.episode` is the episode number the answers are for (see EPISODE GATING).
    const env = { everyone: (c.payload && c.payload.castaways) || [], same: c.same || sameName };
    const n = c.episode;
    // `units` only for a `per` rule's count, so every other result is exactly what it always was.
    const give = (id, units) => (units == null ? add('event', id) : add('event', id, '', units));
    const award = awardable ? (id, units) => { if (awardable(id, n)) give(id, units); } : give;
    for (const rule of rules) {
      if (!ruleRuns(rule, n)) continue;
      if (rule.when && !test(rule.when, answers(entry))) continue;
      if (rule.builtIn) for (const id of BUILT_INS[rule.builtIn].run(entry, env, rule)) award(id);
      // eventType stays '' for an exile, to satisfy episode_research_items_shape; a role's value rides
      // as the item's method.
      else if (rule.stage === 'exiled') add('exiled', '');
      else if (rule.stage === 'role') add('role', '', rule.role);
      else if (rule.per) {
        const units = unitsOf(entry[rule.per], typeOf.get(rule.per));
        if (units != null) award(rule.award, units);
      } else award(rule.award);
    }
  };
}

/** impliedEvents from a format's implied rules: (ep, ctx) -> [{ type, castawayId }]. */
function impliedEventsFrom(rules, data) {
  const { winnerExitMethod } = data;
  const awardable = awardableAt(data);
  const gated = rules.some(isGated);
  const order = [];
  for (const r of rules) if (!order.includes(triggerOf(r))) order.push(triggerOf(r));
  const of = (trigger, n) => rules.filter((r) => triggerOf(r) === trigger && (!gated || ruleRuns(r, n)));
  const all = { whenExit: of('whenExit'), whenExiled: of('whenExiled'), whenRole: of('whenRole') };
  return function impliedEvents(ep, ctx) {
    const out = [];
    // Only rules a change added are gated; without any, every episode reads the same lists.
    const byTrigger = gated ? { whenExit: of('whenExit', ep.number), whenExiled: of('whenExiled', ep.number), whenRole: of('whenRole', ep.number) } : all;
    const exits = ep.events || [];
    // `ctx.roleOf(castawayId, n)` is the role someone held as of episode n.
    const env = { exits, winnerExitMethod, roleOf: (el) => (ctx && ctx.roleOf ? ctx.roleOf(el.castawayId, ep.number) : undefined) };
    for (const trigger of order) {
      if (trigger === 'whenExiled') {
        for (const x of ep.exiled || []) for (const r of byTrigger.whenExiled) out.push({ type: r.award, castawayId: x.castawayId });
      } else if (trigger === 'whenRole') {
        for (const x of ep.roles || []) {
          for (const r of byTrigger.whenRole) if (x.role === r.whenRole) out.push({ type: r.award, castawayId: x.castawayId });
        }
      } else {
        for (const el of exits) {
          const facts = (leaf) =>
            leaf.fact === 'juryVotes' ? el.juryVotes
              : leaf.fact === 'role' ? env.roleOf(el)
                : exits.some((x) => isWinnerExit(x.method, winnerExitMethod)) ? 'yes' : 'no';
          for (const r of byTrigger.whenExit) {
            if (!methodsOf(r).includes(el.method)) continue;
            if (r.when && !test(r.when, facts)) continue;
            const ids = r.builtIn ? BUILT_INS[r.builtIn].run(el, ep, env, r) : [r.award];
            // `per`: once per unit of a count fact, and only once the count is known.
            const times = r.per ? (Number.isInteger(el[r.per]) ? el[r.per] : 0) : 1;
            for (const type of ids) for (let i = 0; i < times; i++) out.push({ type, castawayId: el.castawayId });
          }
        }
      }
    }
    return awardable ? out.filter((ev) => awardable(ev.type, ep.number)) : out;
  };
}

// ---------- validation ----------

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const quote = (v) => JSON.stringify(v);

/**
 * Why a format's rules aren't usable: [] when they are. `data` is the whole data half, since rules
 * refer to its checklist, exit methods, events and roles. Every problem names where it is and why.
 */
function rulesProblems(rules, data) {
  if (!isObj(rules)) return ['rules: an object with research and implied lists'];
  const p = [];
  for (const k of Object.keys(rules)) if (!['research', 'implied'].includes(k)) p.push(`rules: unknown key "${k}"`);
  const fields = new Map();
  const research = data && isObj(data.research) ? data.research : {};
  for (const f of Array.isArray(research.checklist) ? research.checklist : []) if (f && typeof f.key === 'string') fields.set(f.key, f);
  const events = new Map();
  for (const e of Array.isArray(data && data.events) ? data.events : []) if (e && typeof e.id === 'string') events.set(e.id, e);
  const ctx = {
    fields,
    events,
    exitMethods: Array.isArray(data && data.exitMethods) ? data.exitMethods : [],
    roles: data && isObj(data.roles) ? data.roles : null,
  };
  for (const list of ['research', 'implied']) {
    if (!Array.isArray(rules[list])) {
      p.push(`rules.${list}: a list of rules`);
      continue;
    }
    rules[list].forEach((rule, i) => p.push(...ruleProblems(rule, list, ctx).map((m) => `rules.${list}[${i}]: ${m}`)));
  }
  return p;
}

function ruleProblems(rule, list, ctx) {
  if (!isObj(rule)) return ['not an object'];
  const p = [];
  const trigger = triggerOf(rule);
  if (list === 'research') {
    if (trigger) p.push(`${trigger} belongs in the implied rules, which read recorded facts rather than answers`);
  } else {
    const triggers = TRIGGERS.filter((t) => t in rule);
    if (triggers.length !== 1) p.push(`needs exactly one of ${TRIGGERS.join(', ')} (what fact it follows from)`);
  }
  // Triggers are always "allowed" here: a misplaced one is already reported above, once.
  const allowed = ['when', 'fromEpisode', 'untilEpisode', ...TRIGGERS];
  const episodeNumber = (k) => !(k in rule) || (Number.isInteger(rule[k]) && rule[k] >= 1);
  if (!episodeNumber('fromEpisode')) p.push('fromEpisode: an episode number from 1');
  if (!episodeNumber('untilEpisode')) p.push('untilEpisode: an episode number from 1');
  else if ('untilEpisode' in rule && episodeNumber('fromEpisode') && rule.untilEpisode < (rule.fromEpisode || 1)) p.push('untilEpisode: before its fromEpisode');
  if (rule.builtIn !== undefined) {
    const b = BUILT_INS[rule.builtIn];
    allowed.push('builtIn');
    if (!b) p.push(`builtIn: no built-in called ${quote(rule.builtIn)} (there are: ${Object.keys(BUILT_INS).join(', ')})`);
    else if (b.context !== list) p.push(`builtIn: ${rule.builtIn} is for the ${b.context} rules`);
    else {
      allowed.push(...Object.keys(b.params));
      for (const [name, spec] of Object.entries(b.params)) p.push(...paramProblems(rule, name, spec, list, ctx));
      if (b.oneOf && !b.oneOf.some((k) => rule[k] !== undefined)) p.push(`${rule.builtIn}: needs at least one of ${b.oneOf.join(', ')}`);
      if (list === 'implied' && trigger !== 'whenExit') p.push('builtIn: an implied built-in runs per exit, so it needs whenExit');
    }
    if ('stage' in rule) p.push('stage: a built-in only awards events');
  } else if (list === 'research') {
    if ('stage' in rule) {
      allowed.push('stage');
      if ('award' in rule) p.push('award and stage: one or the other');
      if (!STAGES.includes(rule.stage)) p.push(`stage: one of ${STAGES.join(', ')}`);
      if (rule.stage === 'role') {
        allowed.push('role');
        if (!ctx.roles) p.push("stage: this format has no roles to stage");
        else if (!ctx.roles.values.includes(rule.role)) p.push(`role: ${quote(rule.role)} isn't one of the format's role values (${ctx.roles.values.join(', ')})`);
      }
    } else {
      allowed.push('award', 'per');
      p.push(...eventProblems(rule.award, 'award', list, ctx));
      if ('per' in rule) {
        const f = ctx.fields.get(rule.per);
        if (!f) p.push(`per: no checklist question ${quote(rule.per)}`);
        else if (!COUNT_TYPES.includes(f.type)) p.push(`per: ${rule.per} is ${f.type}; a count is ${COUNT_TYPES.join(' or ')}`);
      }
    }
    if (!('when' in rule)) p.push('when: missing (a research rule must say which answers it follows from)');
  } else {
    allowed.push('award');
    p.push(...eventProblems(rule.award, 'award', list, ctx));
  }
  if (list === 'implied') {
    if (trigger === 'whenExit') {
      allowed.push('per');
      const methods = methodsOf(rule);
      if (!methods.length || !methods.every((m) => typeof m === 'string')) p.push('whenExit: an exit method or a non-empty list of them');
      for (const m of methods) if (typeof m === 'string' && !ctx.exitMethods.includes(m)) p.push(`whenExit: ${quote(m)} isn't one of the format's exit methods`);
      if ('per' in rule && !(EXIT_FACTS[rule.per] && EXIT_FACTS[rule.per].type === 'integer')) {
        p.push(`per: must be a whole-number exit fact (${Object.keys(EXIT_FACTS).filter((k) => EXIT_FACTS[k].type === 'integer').join(', ')})`);
      }
    } else if (trigger === 'whenExiled') {
      if (rule.whenExiled !== true) p.push('whenExiled: true');
      if ('when' in rule) p.push('when: only an exit rule has facts to test');
    } else if (trigger === 'whenRole') {
      if (!ctx.roles) p.push('whenRole: this format has no roles');
      else if (!ctx.roles.values.includes(rule.whenRole)) p.push(`whenRole: ${quote(rule.whenRole)} isn't one of the format's role values (${ctx.roles.values.join(', ')})`);
      if ('when' in rule) p.push('when: only an exit rule has facts to test');
    }
  }
  if ('when' in rule) p.push(...conditionProblems(rule.when, list, ctx).map((m) => `when: ${m}`));
  for (const k of Object.keys(rule)) if (!allowed.includes(k)) p.push(`unknown key "${k}"`);
  return p;
}

// An awarded event must exist, and be the right kind: research finds events that are reviewed one by
// one; an implied rule's events follow from facts and are marked `implied` (so nobody can also add
// them by hand, and they can't count twice).
function eventProblems(id, at, list, ctx) {
  if (typeof id !== 'string') return [`${at}: an event id`];
  const e = ctx.events.get(id);
  if (!e) return [`${at}: no event ${quote(id)} in the catalog`];
  if (list === 'research' && e.implied) return [`${at}: ${id} is implied (it follows from exits, exile or roles), so research can't award it`];
  if (list === 'implied' && !e.implied) return [`${at}: ${id} isn't marked implied, so it could also be added by hand and count twice`];
  return [];
}

function paramProblems(rule, name, spec, list, ctx) {
  const v = rule[name];
  if (v === undefined) return spec.optional ? [] : [`${name}: missing (${rule.builtIn} needs it)`];
  if (spec.type === 'event') return eventProblems(v, name, list, ctx);
  if (spec.type === 'exitMethod') return ctx.exitMethods.includes(v) ? [] : [`${name}: ${quote(v)} isn't one of the format's exit methods`];
  if (spec.type === 'role') return roleNameProblems(v, name, ctx);
  if (spec.type === 'condition') return conditionProblems(v, 'research', ctx).map((m) => `${name}: ${m}`);
  const f = ctx.fields.get(v);
  if (!f) return [`${name}: no checklist question ${quote(v)}`];
  if (!spec.fieldTypes.includes(f.type)) return [`${name}: ${v} is ${f.type}; ${rule.builtIn} reads ${spec.fieldTypes.join(' or ')}`];
  return [];
}

// A role someone can hold: the format's default (Faithful) or one of its role values.
function roleNameProblems(v, at, ctx) {
  if (!ctx.roles) return [`${at}: this format has no roles`];
  const names = [ctx.roles.default, ...ctx.roles.values];
  return names.includes(v) ? [] : [`${at}: ${quote(v)} isn't a role in this format (${names.join(', ')})`];
}

function conditionProblems(cond, list, ctx) {
  if (!isObj(cond)) return ['a condition must be an object'];
  const keys = Object.keys(cond);
  const combinator = COMBINATORS.filter((k) => k in cond);
  if (combinator.length) {
    if (keys.length !== 1) return [`${combinator[0]} must be alone in its condition (found ${keys.join(', ')})`];
    const k = combinator[0];
    if (k === 'not') return conditionProblems(cond.not, list, ctx).map((m) => `not: ${m}`);
    if (!Array.isArray(cond[k]) || !cond[k].length) return [`${k}: a non-empty list of conditions`];
    return cond[k].flatMap((c, i) => conditionProblems(c, list, ctx).map((m) => `${k}[${i}]: ${m}`));
  }
  const subject = list === 'research' ? 'answer' : 'fact';
  const other = list === 'research' ? 'fact' : 'answer';
  if (other in cond) {
    return [list === 'research' ? 'fact: only an exit rule reads facts; a research rule reads answers' : 'answer: an implied rule reads recorded facts, not research answers'];
  }
  const ops = OPS.filter((k) => k in cond);
  const p = [];
  if (!(subject in cond)) p.push(`${subject}: missing (${list === 'research' ? 'which checklist question it reads' : `which fact: ${Object.keys(EXIT_FACTS).join(', ')}`})`);
  if (ops.length !== 1) p.push(`needs exactly one test: ${OPS.join(', ')}`);
  for (const k of keys) if (k !== subject && !OPS.includes(k)) p.push(`unknown key "${k}"`);
  if (p.length) return p;
  const op = ops[0];
  const value = cond[op];

  let type;
  let accepts;
  const name = cond[subject];
  if (list === 'research') {
    const f = ctx.fields.get(name);
    if (!f) return [`answer: no checklist question ${quote(name)}`];
    type = f.type;
    if (type === 'answer') accepts = ANSWERS;
    else if (type === 'enum') accepts = f.values;
    else if (type === 'exitMethod') accepts = ctx.exitMethods;
  } else {
    const fact = EXIT_FACTS[name];
    if (!fact) return [`fact: no exit fact ${quote(name)} (there are: ${Object.keys(EXIT_FACTS).join(', ')})`];
    type = fact.type;
    if (type === 'flag') accepts = ['yes', 'no'];
    if (type === 'role') {
      if (!ctx.roles) return ['fact: this format has no roles'];
      accepts = [ctx.roles.default, ...ctx.roles.values];
    }
  }
  if (!OPS_FOR[type].includes(op)) return [`${op}: ${quote(name)} is ${type === 'flag' ? 'yes/no' : type}, which takes ${OPS_FOR[type].join(' / ')}`];
  if (op === 'present') return typeof value === 'boolean' ? [] : ['present: true or false'];
  if (op === 'equals' || op === 'greaterThan') return Number.isFinite(value) ? [] : [`${op}: a number`];
  if (typeof value !== 'string') return [`${op}: a text value`];
  if (accepts && !accepts.includes(value)) return [`${op}: ${quote(value)} isn't a possible value of ${name} (${accepts.join(', ')})`];
  return [];
}

// ---------- rules as sentences ----------
//
// For people, not machines: the review screen (docs/PLAN-stage-3-format-proposals.md) and the rule-list
// editor (PLAN-scoring-rules-as-data.md phase 4) read a rule as one line. `data` supplies event labels;
// a question reads as its key in words ("wonChallenge" -> "won challenge").

const words = (key) => String(key).replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase();
const FACT_WORDS = { juryVotes: 'jury votes', role: 'their role', finale: "it's the finale" };

function describeCondition(cond, nested = false) {
  if (!isObj(cond)) return '?';
  const group = (parts, joiner) => {
    const text = parts.map((c) => describeCondition(c, true)).join(joiner);
    return nested && parts.length > 1 ? `(${text})` : text;
  };
  if ('all' in cond) return group(cond.all || [], ' and ');
  if ('any' in cond) return group(cond.any || [], ' or ');
  if ('not' in cond) return `not ${describeCondition(cond.not, true)}`;
  if (cond.fact === 'finale' && ('is' in cond || 'isNot' in cond)) {
    return (cond.is === 'yes' || cond.isNot === 'no') ? "it's the finale" : "it isn't the finale";
  }
  const name = cond.answer !== undefined ? words(cond.answer) : FACT_WORDS[cond.fact] || words(cond.fact);
  if ('is' in cond) return `${name} is ${cond.is}`;
  if ('isNot' in cond) return `${name} isn't ${cond.isNot}`;
  if ('equals' in cond) return `${name} is ${cond.equals}`;
  if ('greaterThan' in cond) return `${name} is more than ${cond.greaterThan}`;
  if ('present' in cond) return cond.present ? `${name} is given` : `${name} is empty`;
  return name;
}

/** One rule as a sentence: "When won challenge is yes → Won a challenge". */
function describeRule(rule, data) {
  if (!isObj(rule)) return '?';
  // A gated rule says when it runs; every other rule reads exactly as before.
  if ('fromEpisode' in rule || 'untilEpisode' in rule) {
    const { fromEpisode, untilEpisode, ...rest } = rule;
    const when = untilEpisode == null ? `from episode ${fromEpisode}`
      : fromEpisode == null ? `until episode ${untilEpisode}`
        : `episodes ${fromEpisode} to ${untilEpisode}`;
    return `${describeRule(rest, data)} (${when})`;
  }
  const label = (id) => {
    const e = data && Array.isArray(data.events) ? data.events.find((x) => x && x.id === id) : null;
    return e && e.label ? e.label : String(id);
  };
  const methods = 'whenExit' in rule ? methodsOf(rule).join(' or ') : null;
  const conditions = [];
  if (methods) conditions.push(`someone leaves by ${methods}`);
  if ('whenExiled' in rule) conditions.push('someone is exiled');
  if ('whenRole' in rule) conditions.push(`someone becomes ${rule.whenRole}`);
  if (rule.when) conditions.push(describeCondition(rule.when));
  const when = conditions.length ? `When ${conditions.join(', and ')}` : 'Always';
  if (rule.builtIn) {
    const b = BUILT_INS[rule.builtIn];
    if (!b) return `${when}: ${rule.builtIn} (unknown built-in)`;
    const text = b.describe.replace(/\{(\w+)\}/g, (_, k) => {
      const spec = b.params[k];
      if (!spec) return k;
      if (spec.type === 'event') return label(rule[k]);
      if (spec.type === 'field') return words(rule[k]);
      return String(rule[k]);
    });
    return `${when}: ${text}`;
  }
  if (rule.stage === 'exiled') return `${when} → record that they were exiled`;
  if (rule.stage === 'role') return `${when} → record their role as ${rule.role}`;
  const per = rule.per === 'juryVotes' ? ', once per jury vote' : rule.per ? `, once per ${words(rule.per)}` : '';
  return `${when} → ${label(rule.award)}${per}`;
}

/** How a list of rules splits between plain data and built-ins: { data, builtIn, builtIns: [names] }. */
function ruleCounts(rules) {
  const list = Array.isArray(rules) ? rules : [];
  const builtIns = list.filter((r) => r && r.builtIn).map((r) => r.builtIn);
  return { data: list.length - builtIns.length, builtIn: builtIns.length, builtIns };
}

/**
 * Why `cond` isn't a usable condition on one person's answers (`data`'s checklist): [] when it is. Research's checks and
 * reviewer words read answers the same way a research rule does (research-review.js).
 */
function answerConditionProblems(cond, data) {
  const fields = new Map();
  const research = data && isObj(data.research) ? data.research : {};
  for (const f of Array.isArray(research.checklist) ? research.checklist : []) if (f && typeof f.key === 'string') fields.set(f.key, f);
  return conditionProblems(cond, 'research', { fields, events: new Map(), exitMethods: Array.isArray(data && data.exitMethods) ? data.exitMethods : [], roles: null });
}

module.exports = {
  BUILT_INS, EXIT_FACTS, COUNT_TYPES, OPS, OPS_FOR, researchItemsFrom, impliedEventsFrom, rulesProblems, ruleCounts, describeRule, describeCondition, listOf,
  isWinnerExit, test, answerConditionProblems, words,
};
