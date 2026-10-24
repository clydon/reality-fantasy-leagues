// A rulebook's blocks: the one shape the editor edits, research returns and the compiler reads
// (docs/PLAN-rulebooks-implementation.md section 3; the design is docs/PLAN-admin-shows-rulebooks.md). A
// rulebook says what a show is and what can happen in it, in six blocks, each a short list of items with
// fixed answers. Nobody writes a rule: the answers build the moments (rulebook-moments.js), and R2's
// compiler turns those into the engine's FormatData.
//
//   { schema: 1, kind, start?, show?, tagline?, premise?, parts?, derivedFrom?,
//     cast:     { unit, singular, plural, usualSize?, groups: null | { type, singular, change } },
//     season:   { phases: [{ id, name, starts: { type, n? }, changes: [], summary? }], finale?: { decidedBy, finalists?, summary? } },
//     segments: [{ id, name, summary?, decidedBy, voters?, pickers?, takesPart?, decides?, onTheLine?, often, phase?, momentsOff? }],
//     waysOut:  [{ id, name, means, cause?: { segment } | ownChoice | medical | removed | story }],
//     twists:   [{ id, type, name, summary?, ...that type's answers }],
//     customMoments: [{ id, label, question?, during?: { segment } | { twist }, counted, answeredBy, reliability? }],
//     points:   { [momentId]: number | { exclusive, shared } },   suggested-point overrides
//     momentNotes: { [momentId]: { reliability?, answeredBy? } }, research's rating of a built moment
//     leftOut:  ['anything that didn't fit, one sentence each'] }
//
// Every answer with fixed choices is an OPT list here, each option [value, label, help]: the editor shows
// the label and help, the research prompt lists the values with the same help, and blocksProblems accepts
// only listed values. Add an option here and it reaches all three. The options and their words come from
// the rulebook mockup (the plan's link) and the site mock's rulebook.js, which decided on 2026-10-24: four
// kinds of show, inferred and never asked first; a series has two starting points (reality, scripted); a
// sport is a full kind whose parts can say Race or Event.
//
// Item ids are camelCase, made once from the name (camelId) and never changed on rename: edits,
// momentsOff, points and `during` refer to them. Plain CommonJS with no dependencies outside formats/,
// browser-safe, like everything here.
/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS on purpose, see index.js */
const { camelId } = require('./proposal.js');
/* eslint-enable @typescript-eslint/no-require-imports */

const SCHEMA_VERSION = 1;

// ---------- the choices ----------

const OPT = {
  kind: [
    ['competition', 'A competition', 'People get knocked out until someone wins.'],
    ['series', 'A series', "The same cast every week, and nobody's playing to win."],
    ['talk', 'Talk, variety or awards', 'A host, guests and bits. Nobody leaves and nobody wins.'],
    ['sport', 'A sport or live event', 'Athletes or teams compete, and results come in as it happens.'],
  ],
  // A series' starting point: it changes only defaults and words, never the blocks or the games.
  start: [
    ['reality', 'Reality', 'Real people, filmed as it happens: Below Deck, Real Housewives.'],
    ['scripted', 'Scripted', 'A story with characters: Scrubs, Harry Potter, Pluribus.'],
  ],
  unit: [
    ['people', 'People', 'One person each.'],
    ['pairs', 'Pairs', 'Two people who play as one, like a celebrity and a pro.'],
    ['panel', 'A panel', 'They judge or invest rather than compete, like the Sharks.'],
  ],
  // 'none' is how the editor offers "No"; the data says it as groups: null.
  groupType: [
    ['none', 'No', ''],
    ['sides', 'Yes, into sides', 'Tribes, teams, houses, departments.'],
    ['couples', 'Yes, into couples', 'Pairs that form and break up.'],
    ['coachTeams', "Yes, into coaches' teams", 'Each coach or mentor picks their own.'],
  ],
  groupChange: [
    ['never', 'Never', ''],
    ['atPhases', 'At set points', 'A swap, the merge. You set when, under The season.'],
    ['often', 'All the time', 'Every recoupling or draft.'],
  ],
  startType: [
    ['episode', 'At an episode', ''],
    ['remaining', 'When this many are left', ''],
    ['announced', 'When the show says so', "Research flags the episode it happens and someone confirms it. It's never guessed."],
  ],
  changes: [
    ['groupsEnd', 'Groups end', ''],
    ['groupsReshuffle', 'Groups are reshuffled', ''],
    ['juryStarts', 'A jury starts', ''],
    ['viewersVote', 'Viewers start voting', ''],
    ['arrivals', 'New people arrive', ''],
    ['segmentsChange', 'Different segments run', "Set which, on each segment's How often."],
  ],
  finale: [
    ['juryVote', 'A jury votes', ''],
    ['judges', 'Judges decide', ''],
    ['viewersVote', 'Viewers vote', ''],
    ['castVote', 'The cast votes', ''],
    ['lastStanding', 'Last one standing', ''],
    ['firstToFinish', 'First to the finish', ''],
    ['mostPoints', 'Most points', ''],
    ['groupWins', 'A group wins', 'Everyone in it scores.'],
    ['nobody', 'Nobody wins', 'The season just ends.'],
  ],
  decidedBy: [
    ['result', 'The result', 'A race, a test, a game. Whoever does best wins.'],
    ['judges', 'Judges', 'A panel rates them: best, worst, or a score.'],
    ['vote', 'A vote', 'The cast, viewers or a jury vote.'],
    ['pick', 'Someone picks', 'One person or side chooses: roses, nominations, chair turns.'],
    ['headToHead', 'Head to head', "Two face off. One stays, one doesn't."],
    ['nobody', 'Nobody', "A regular part of the show. Nothing's decided; what happens in it can score."],
  ],
  voters: [
    ['cast', 'The cast', ''],
    ['viewers', 'Viewers', ''],
    ['jury', 'A jury', "People already out, like Survivor's jury."],
    ['judges', 'The judges', ''],
    ['secretGroup', 'A secret group', 'Only people with a secret role, like the Traitors.'],
  ],
  pickers: [
    ['onePerson', 'One person', 'The lead, the Head of Household, a coach.'],
    ['eachPerson', 'Each of them', 'Everyone picks someone.'],
    ['panel', 'A panel', ''],
  ],
  takesPart: [
    ['everyone', 'Everyone', ''],
    ['groups', 'Groups', ''],
    ['groupsThenEach', 'Groups, then each person', 'In groups at first, on their own after a phase like the merge.'],
    ['atRisk', 'Only those at risk', ''],
  ],
  decides: [
    ['winner', 'Who wins', ''],
    ['topThree', 'The top three', ''],
    ['bestAndWorst', 'Best and worst', ''],
    ['fullOrder', 'The full order', 'First to last, like a race.'],
    ['score', 'A score', 'Points, money, time, days lasted.'],
  ],
  onTheLine: [
    ['nothing', 'Nothing', ''],
    ['reward', 'A reward', ''],
    ['advantage', 'An advantage', ''],
    ['safety', 'Safety', "The winner can't go home this episode."],
    ['atRisk', 'Puts someone at risk', ''],
    ['goingHome', 'Sends someone home', 'Who goes is a way out; set it under Ways out.'],
    ['points', 'Points in the standings', "The show's own points or standings, like championship points."],
  ],
  often: [
    ['everyEpisode', 'Every episode', ''],
    ['someEpisodes', 'Some episodes', ''],
    ['onePhase', 'Only in one phase', ''],
  ],
  means: [
    ['out', "They're out", ''],
    ['finalist', 'They reached the end', 'A finalist or runner-up.'],
    ['winner', 'They won', ''],
    ['ending', 'An ending', 'For shows without one winner: Married, Finished the season.'],
    ['outForOne', 'Out for this one only', 'Did not finish, sat out: they miss this race or event and are back for the next.'],
  ],
  // The fixed causes; a way out can also be caused by one of the rulebook's segments ({ segment: id }).
  cause: [
    ['ownChoice', 'Their own choice', ''],
    ['medical', 'Medical', ''],
    ['removed', 'Removed by the show', ''],
    ['story', 'The story', 'For scripted shows: written out, killed off.'],
  ],
  twistType: [
    ['secretRole', 'A secret role', 'Traitors, the Mole, a catfish.'],
    ['advantage', 'An advantage', 'Idols, Head of Household, a Golden Buzzer, an Express Pass.'],
    ['comeback', 'Comebacks and arrivals', 'Last Chance Kitchen, Redemption Island, bombshells, new hires.'],
    ['sideTrip', 'A side trip', 'Journeys, Exile Island, Casa Amor.'],
  ],
  revealed: [
    ['whenTheyLeave', 'When they leave', ''],
    ['atFinale', 'At the finale', ''],
    ['never', 'Viewers know; the cast never finds out', ''],
  ],
  canSwitch: [
    ['never', 'No', ''],
    ['recruited', 'Yes, they can be recruited', ''],
  ],
  gotBy: [
    ['found', 'They find it', ''],
    ['wonAt', 'They win it in a segment', ''],
    ['given', 'Someone gives it to them', ''],
    ['chosenByShow', 'The show hands it out', ''],
  ],
  does: [
    ['keepsSafe', 'Keeps them safe', ''],
    ['cancelsVotes', 'Cancels votes', ''],
    ['savesSomeone', 'Saves someone else', ''],
    ['hurtsSomeone', 'Hurts someone else', ''],
    ['extraVote', 'An extra vote', ''],
    ['skipsATask', 'Skips a task', ''],
  ],
  lasts: [
    ['untilPlayed', "Until it's played", ''],
    ['oneUse', 'One use', ''],
    ['oneEpisode', 'One episode', ''],
  ],
  comebackWho: [
    ['peopleWhoLeft', 'People who left', ''],
    ['newPeople', 'New people', ''],
  ],
  comebackHow: [
    ['winHeadToHead', 'They win their way back', ''],
    ['viewersVote', 'Viewers vote them back', ''],
    ['theShow', 'The show brings them in', ''],
  ],
  tripWho: [
    ['chosen', 'Someone chooses them', ''],
    ['random', 'Random', ''],
    ['won', 'They win it', ''],
  ],
  canGet: [
    ['advantage', 'An advantage', ''],
    ['disadvantage', 'A disadvantage, like losing their vote', ''],
    ['nothing', 'Nothing', ''],
  ],
  counted: [
    ['yesNo', 'Once an episode', 'Did it happen? Yes or no.'],
    ['eachTime', 'Each time it happens', ''],
    ['perUnit', 'Per amount', 'Each $1,000, each point, each day.'],
  ],
  answeredBy: [
    ['research', 'Research', 'Answered the morning after, from recaps.'],
    ['league', 'The league', "For things recaps won't mention. Someone in the league says when it happens."],
  ],
  reliability: [
    ['reliable', 'Reliably', ''],
    ['usually', 'Usually', ''],
    ['patchy', 'Patchily', 'Recaps often skip it. Better answered by the league.'],
  ],
};

const valuesOf = (key) => (OPT[key] || []).map((o) => o[0]);
const optionOf = (key, value) => (OPT[key] || []).find((o) => o[0] === value) || null;
/** The label people see for a stored value ("goingHome" -> "Sends someone home"); the value itself if unknown. */
function labelOf(key, value) {
  const o = optionOf(key, value);
  return o ? o[1] : value == null ? '' : String(value);
}
/** An option's help text, '' when it has none. */
function helpOf(key, value) {
  const o = optionOf(key, value);
  return o ? o[2] : '';
}

// ---------- the kinds of show ----------

// What each kind calls the six blocks (null: the kind hides that block), the word for one part of the
// season (a sport's race or event), where results come from by default, and which season games fit.
const BLOCKS = ['cast', 'season', 'segments', 'waysOut', 'twists', 'points'];
const KINDS = {
  competition: {
    like: 'Survivor, The Amazing Race, Bake Off',
    labels: { cast: "Who's playing", season: 'The season', segments: 'Each episode', waysOut: 'Ways out', twists: 'Twists', points: 'What scores' },
    part: ['episode', 'episodes'],
    results: 'Who went home minutes after the episode, everything else from ChatGPT that night.',
    games: ['survivalPool', 'weeklyLineup', 'outlast'],
  },
  series: {
    like: 'Below Deck, Real Housewives, Pluribus',
    labels: { cast: 'The cast', season: 'The season', segments: 'Each episode', waysOut: 'Comings and goings', twists: 'Twists', points: 'What scores' },
    part: ['episode', 'episodes'],
    results: 'ChatGPT the morning after, and the couch answers anything it misses.',
    games: ['weeklyLineup'],
  },
  talk: {
    like: 'Saturday Night Live, late-night shows, the Oscars',
    labels: { cast: 'Regulars', season: 'The season', segments: 'Each show', waysOut: null, twists: null, points: 'Moments' },
    part: ['episode', 'episodes'],
    results: 'The couch says what happened as it watches; ChatGPT checks the next morning.',
    games: ['weeklyBingo', 'weeklyCalls'],
  },
  sport: {
    like: 'Formula 1, the Olympics, a tournament',
    labels: { cast: "Who's competing", season: 'The schedule', segments: 'Each event', waysOut: 'Withdrawals', twists: null, points: 'What scores' },
    part: ['event', 'events'],
    results: 'Results minutes after the finish, from ChatGPT.',
    games: ['weeklyLineup', 'survivalPool'],
  },
};
for (const [k, v] of Object.entries(KINDS)) Object.assign(v, { name: labelOf('kind', k), blurb: helpOf('kind', k) });

// The season games, by the keys KINDS.games uses (src/lib/server/league-season.ts names the leagues' types).
const GAME_LABELS = { survivalPool: 'Survival Pool', weeklyLineup: 'Weekly Lineup', outlast: 'Outlast', weeklyBingo: 'Weekly Bingo', weeklyCalls: 'Weekly Calls' };

// A segment's plate tag: never a noun to choose, the answer to "Who decides it?".
const DECIDED_TAG = { result: 'Contest', judges: 'Judged', vote: 'Vote', pick: 'Pick', headToHead: 'Head to head', nobody: 'No contest' };

// The editor's questions, word for word (the design plan's "Every question, and its answers").
const QUESTIONS = {
  kind: { kind: 'What kind of show is it?', start: 'Where does it start from?' },
  cast: {
    unit: "Who's in the cast?", singular: 'One of them is called', plural: 'More than one', usualSize: 'How many, usually?',
    groups: 'Are they split into groups?', groupSingular: 'One group is called', groupChange: 'Do the groups change?',
  },
  phase: { name: "What's it called?", starts: 'When does it start?', episode: 'Which episode?', remaining: 'How many are left?', changes: 'What changes?', summary: 'In a sentence' },
  finale: { decidedBy: 'How is it decided?', finalists: 'How many reach it?', summary: 'In a sentence' },
  segment: {
    name: "What's it called?", summary: 'In a sentence', decidedBy: 'Who decides it?', voters: 'Who votes?', pickers: 'Who picks?',
    takesPart: 'Who takes part?', decides: 'What does it decide?', onTheLine: "What's on the line?", often: 'How often?', phase: 'Which phase?',
    moments: 'What it scores', addMoment: 'Add a moment to it',
  },
  wayOut: { name: "What's it called?", means: 'What does it mean?', cause: 'What causes it?', points: 'Suggested points' },
  twist: {
    type: 'What kind of twist?', name: "What's it called?", summary: 'In a sentence',
    roles: 'What are the roles?', revealed: 'When is it revealed?', canSwitch: 'Can someone switch?',
    oneIsCalled: "What's one called?", gotBy: 'How do they get it?', wonAt: 'Which segment?', does: 'What does it do?', lasts: 'How long does it last?',
    comebackWho: 'Who comes in?', comebackHow: 'How?', tripWho: 'Who goes?', canGet: 'What can they come back with?',
  },
  moment: {
    label: 'What happens?', during: 'Where does it happen?', counted: 'How is it counted?', answeredBy: 'Who answers it?',
    reliability: 'How reliably do recaps report it?', points: 'Suggested points',
  },
};

// Each twist type's own answers: field -> the OPT list it takes, and whether it's a list of them.
const TWIST_FIELDS = {
  secretRole: { revealed: 'revealed', canSwitch: 'canSwitch' },
  advantage: { gotBy: 'gotBy', does: ['does'], lasts: 'lasts' },
  comeback: { who: 'comebackWho', how: 'comebackHow' },
  sideTrip: { who: 'tripWho', canGet: ['canGet'] },
};

// ---------- small helpers the other rulebook modules share ----------

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const isText = (v) => typeof v === 'string' && v.trim() !== '';
const ID = /^[a-z][A-Za-z0-9]*$/;
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');
const list = (v) => (Array.isArray(v) ? v : []);
const kindOf = (blocks) => (KINDS[blocks && blocks.kind] ? blocks.kind : 'competition');

/** "castaway" -> "castaways", "celebrity" -> "celebrities", "crew member" -> "crew members". */
function pluralOf(word) {
  const w = String(word || '');
  if (/[^aeiou]y$/i.test(w)) return `${w.slice(0, -1)}ies`;
  if (/(s|x|z|ch|sh)$/i.test(w)) return `${w}es`;
  return `${w}s`;
}

/** What one part of the season is called: { singular, plural } ("episode", or a sport's "race"). */
function partWord(blocks) {
  const p = blocks && blocks.parts;
  const [s, pl] = KINDS[kindOf(blocks)].part;
  return { singular: (p && isText(p.singular) && p.singular.trim().toLowerCase()) || s, plural: (p && isText(p.plural) && p.plural.trim().toLowerCase()) || pl };
}

/** A block's heading for this rulebook's kind ("Each episode", a sport's "Each event"), or null when the kind hides it. */
function blockLabel(blocks, block) {
  const label = KINDS[kindOf(blocks)].labels[block];
  if (label === undefined) return null;
  // The rundown's heading can be the show's own ("Each leg", "Each race weekend").
  if (block === 'segments' && label && blocks && blocks.parts && isText(blocks.parts.label)) return blocks.parts.label.trim();
  return label;
}

/** The choices for a question that depend on the rulebook itself, as [value, label, help]. */
function optionsFor(key, blocks) {
  const segs = list(blocks && blocks.segments);
  const phases = list(blocks && blocks.season && blocks.season.phases);
  if (key === 'phase') return [...phases.map((p) => [p.id, p.name, '']), ['finale', 'The finale', '']];
  if (key === 'cause') return [...segs.filter((s) => s.decidedBy !== 'nobody').map((s) => [s.id, s.name, '']), ...OPT.cause];
  if (key === 'wonAt') return segs.filter((s) => s.decidedBy !== 'nobody').map((s) => [s.id, s.name, '']);
  if (key === 'during') return [['anywhere', 'Anywhere', ''], ...segs.map((s) => [s.id, s.name, '']), ...list(blocks && blocks.twists).map((t) => [t.id, t.name, ''])];
  return OPT[key] || [];
}

// ---------- validation ----------

const loc = (block, item, field) => `${block}${item ? `[${item}]` : ''}${field ? `.${field}` : ''}`;

/**
 * Why these blocks aren't a usable rulebook: [] when they are. Each problem is { at, message }: `at` names
 * the row and field ("segments[tribalCouncil].voters") so a review can put it on its row, and the message is
 * plain ("Tribal Council: who votes isn't one of the choices"). Only listed values pass; each answer is
 * asked for only where it applies; ids are unique camelCase; every reference resolves.
 */
function blocksProblems(blocks) {
  const p = [];
  const add = (at, message) => p.push({ at, message });
  if (!isObj(blocks)) return [{ at: 'rulebook', message: "It isn't a rulebook" }];
  const oneOf = (at, name, key, value, what) => {
    if (!valuesOf(key).includes(value)) add(at, `${name}: ${what} isn't one of the choices`);
  };
  const someOf = (at, name, key, value, what) => {
    if (!Array.isArray(value)) return add(at, `${name}: ${what} should be a list`);
    for (const v of value) if (!valuesOf(key).includes(v)) add(at, `${name}: ${what} has "${v}", which isn't one of the choices`);
  };

  if (blocks.schema !== SCHEMA_VERSION) add('schema', `The rulebook's schema should be ${SCHEMA_VERSION}`);
  oneOf('kind', 'The rulebook', 'kind', blocks.kind, 'the kind of show');
  if (blocks.kind === 'series') oneOf('start', 'The rulebook', 'start', blocks.start, 'where a series starts from');
  else if (blocks.start !== undefined) add('start', 'Only a series has a starting point');
  for (const f of ['show', 'tagline', 'premise', 'derivedFrom']) if (blocks[f] !== undefined && typeof blocks[f] !== 'string') add(f, `The rulebook: ${f} should be text`);
  if (blocks.parts !== undefined) {
    if (!isObj(blocks.parts) || !isText(blocks.parts.singular) || !isText(blocks.parts.plural)) add('parts', 'What one part is called needs a word for one and for more than one');
    else if (blocks.parts.label !== undefined && !isText(blocks.parts.label)) add('parts.label', "The rundown's heading should be text");
  }

  // Ids: unique across every item, camelCase. Moments made from them stay unique that way.
  const ids = new Map();
  const claim = (id, at, name) => {
    if (!isText(id) || !ID.test(id)) return add(`${at}.id`, `${name || 'An item'}: its id should be camelCase letters and digits`);
    if (ids.has(id)) add(`${at}.id`, `${name || id}: another item already has the id "${id}"`);
    else ids.set(id, at);
  };

  // 1. Who's playing.
  const cast = blocks.cast;
  if (!isObj(cast)) add('cast', "Who's playing isn't filled in");
  else {
    oneOf('cast.unit', "Who's playing", 'unit', cast.unit, "who's in the cast");
    if (!isText(cast.singular)) add('cast.singular', "Who's playing: what one of them is called is missing");
    if (!isText(cast.plural)) add('cast.plural', "Who's playing: what more than one are called is missing");
    if (cast.usualSize !== undefined && !(Number.isInteger(cast.usualSize) && cast.usualSize >= 0)) add('cast.usualSize', "Who's playing: how many should be a whole number");
    if (cast.groups !== null && cast.groups !== undefined) {
      const g = cast.groups;
      if (!isObj(g)) add('cast.groups', "Who's playing: the groups aren't filled in");
      else {
        if (g.type === 'none' || !valuesOf('groupType').includes(g.type)) add('cast.groups.type', "Who's playing: what they're split into isn't one of the choices");
        if (!isText(g.singular)) add('cast.groups.singular', "Who's playing: what one group is called is missing");
        oneOf('cast.groups.change', "Who's playing", 'groupChange', g.change, 'whether the groups change');
      }
    }
  }

  // 2. The season: phases, then the finale.
  const season = isObj(blocks.season) ? blocks.season : null;
  if (!season) add('season', "The season isn't filled in");
  const phases = list(season && season.phases);
  if (season && !Array.isArray(season.phases)) add('season.phases', 'The season: the phases should be a list');
  const phaseIds = new Set();
  for (const [i, ph] of phases.entries()) {
    const at = loc('season.phases', isObj(ph) && ph.id ? ph.id : String(i));
    if (!isObj(ph)) { add(at, 'A phase is empty'); continue; }
    const name = isText(ph.name) ? ph.name : 'A phase';
    claim(ph.id, at, name);
    phaseIds.add(ph.id);
    if (!isText(ph.name)) add(`${at}.name`, 'A phase has no name');
    if (!isObj(ph.starts)) add(`${at}.starts`, `${name}: when it starts isn't set`);
    else {
      oneOf(`${at}.starts.type`, name, 'startType', ph.starts.type, 'when it starts');
      const needsN = ph.starts.type === 'episode' || ph.starts.type === 'remaining';
      if (needsN && !(Number.isInteger(ph.starts.n) && ph.starts.n >= 1)) add(`${at}.starts.n`, `${name}: ${ph.starts.type === 'episode' ? 'which episode' : 'how many are left'} should be a whole number from 1`);
      if (!needsN && ph.starts.n !== undefined) add(`${at}.starts.n`, `${name}: a number only goes with "at an episode" or "when this many are left"`);
    }
    if (ph.changes !== undefined) someOf(`${at}.changes`, name, 'changes', ph.changes, 'what changes');
    if (ph.summary !== undefined && typeof ph.summary !== 'string') add(`${at}.summary`, `${name}: the sentence should be text`);
  }
  const finale = season && season.finale;
  if (finale !== undefined && finale !== null) {
    if (!isObj(finale)) add('season.finale', "The finale isn't filled in");
    else {
      oneOf('season.finale.decidedBy', 'The finale', 'finale', finale.decidedBy, 'how it is decided');
      if (finale.finalists !== undefined && !(Number.isInteger(finale.finalists) && finale.finalists >= 1)) add('season.finale.finalists', 'The finale: how many reach it should be a whole number from 1');
      if (finale.summary !== undefined && typeof finale.summary !== 'string') add('season.finale.summary', 'The finale: the sentence should be text');
    }
  }

  // 3. Each episode.
  const segs = list(blocks.segments);
  if (!Array.isArray(blocks.segments)) add('segments', 'The segments should be a list');
  const segIds = new Set();
  for (const [i, s] of segs.entries()) {
    const at = loc('segments', isObj(s) && s.id ? s.id : String(i));
    if (!isObj(s)) { add(at, 'A segment is empty'); continue; }
    const name = isText(s.name) ? s.name : 'A segment';
    claim(s.id, at, name);
    segIds.add(s.id);
    if (!isText(s.name)) add(`${at}.name`, 'A segment has no name');
    if (s.summary !== undefined && typeof s.summary !== 'string') add(`${at}.summary`, `${name}: the sentence should be text`);
    oneOf(`${at}.decidedBy`, name, 'decidedBy', s.decidedBy, 'who decides it');
    const only = (field, when, what) => {
      if (when) return oneOf(`${at}.${field}`, name, field, s[field], what);
      if (s[field] !== undefined) add(`${at}.${field}`, `${name}: ${what} doesn't go with ${labelOf('decidedBy', s.decidedBy).toLowerCase() || 'this'}`);
    };
    only('voters', s.decidedBy === 'vote', 'who votes');
    only('pickers', s.decidedBy === 'pick', 'who picks');
    only('decides', ['result', 'judges', 'headToHead'].includes(s.decidedBy), 'what it decides');
    only('takesPart', s.decidedBy !== 'nobody' && valuesOf('decidedBy').includes(s.decidedBy), 'who takes part');
    if (s.onTheLine !== undefined) oneOf(`${at}.onTheLine`, name, 'onTheLine', s.onTheLine, "what's on the line");
    oneOf(`${at}.often`, name, 'often', s.often, 'how often');
    if (s.often === 'onePhase') {
      if (s.phase !== 'finale' && !phaseIds.has(s.phase)) add(`${at}.phase`, `${name}: which phase isn't one of the season's`);
    } else if (s.phase !== undefined) add(`${at}.phase`, `${name}: a phase only goes with "only in one phase"`);
    if (s.momentsOff !== undefined && !Array.isArray(s.momentsOff)) add(`${at}.momentsOff`, `${name}: the moments turned off should be a list`);
  }

  // 4. Ways out.
  const ways = list(blocks.waysOut);
  if (!Array.isArray(blocks.waysOut)) add('waysOut', 'The ways out should be a list');
  for (const [i, w] of ways.entries()) {
    const at = loc('waysOut', isObj(w) && w.id ? w.id : String(i));
    if (!isObj(w)) { add(at, 'A way out is empty'); continue; }
    const name = isText(w.name) ? w.name : 'A way out';
    claim(w.id, at, name);
    if (!isText(w.name)) add(`${at}.name`, 'A way out has no name');
    oneOf(`${at}.means`, name, 'means', w.means, 'what it means');
    if (w.means === 'outForOne' && blocks.kind !== 'sport') add(`${at}.means`, `${name}: out for one race or event only goes with a sport or live event`);
    if (w.cause !== undefined) {
      if (isObj(w.cause)) {
        if (!segIds.has(w.cause.segment)) add(`${at}.cause`, `${name}: what causes it isn't one of the segments`);
      } else oneOf(`${at}.cause`, name, 'cause', w.cause, 'what causes it');
    }
  }

  // 5. Twists.
  const twists = list(blocks.twists);
  if (blocks.twists !== undefined && !Array.isArray(blocks.twists)) add('twists', 'The twists should be a list');
  const twistIds = new Set();
  for (const [i, t] of twists.entries()) {
    const at = loc('twists', isObj(t) && t.id ? t.id : String(i));
    if (!isObj(t)) { add(at, 'A twist is empty'); continue; }
    const name = isText(t.name) ? t.name : 'A twist';
    claim(t.id, at, name);
    twistIds.add(t.id);
    if (!isText(t.name)) add(`${at}.name`, 'A twist has no name');
    if (t.summary !== undefined && typeof t.summary !== 'string') add(`${at}.summary`, `${name}: the sentence should be text`);
    oneOf(`${at}.type`, name, 'twistType', t.type, 'what kind of twist it is');
    for (const [field, key] of Object.entries(TWIST_FIELDS[t.type] || {})) {
      if (Array.isArray(key)) someOf(`${at}.${field}`, name, key[0], t[field], QUESTIONS.twist[key[0]].replace(/\?$/, '').toLowerCase());
      else oneOf(`${at}.${field}`, name, key, t[field], (QUESTIONS.twist[key] || field).replace(/\?$/, '').toLowerCase());
    }
    if (t.type === 'secretRole' && !(Array.isArray(t.roles) && t.roles.length >= 2 && t.roles.every(isText))) {
      add(`${at}.roles`, `${name}: the roles should be at least two names, the secret one first`);
    }
    if ((t.type === 'advantage' || t.type === 'sideTrip') && !isText(t.oneIsCalled)) add(`${at}.oneIsCalled`, `${name}: what one is called is missing`);
    if (t.type === 'advantage' && t.gotBy === 'wonAt' && !segIds.has(t.wonAt)) add(`${at}.wonAt`, `${name}: which segment it's won in isn't one of the segments`);
    if (t.wonAt !== undefined && t.gotBy !== 'wonAt') add(`${at}.wonAt`, `${name}: a segment only goes with "they win it in a segment"`);
  }

  // Moments added by hand.
  const customs = list(blocks.customMoments);
  if (blocks.customMoments !== undefined && !Array.isArray(blocks.customMoments)) add('customMoments', 'The moments added by hand should be a list');
  for (const [i, m] of customs.entries()) {
    const at = loc('customMoments', isObj(m) && m.id ? m.id : String(i));
    if (!isObj(m)) { add(at, 'A moment is empty'); continue; }
    const name = isText(m.label) ? m.label : 'A moment';
    claim(m.id, at, name);
    if (!isText(m.label)) add(`${at}.label`, 'A moment has no description');
    if (m.question !== undefined && !isText(m.question)) add(`${at}.question`, `${name}: the question should be text`);
    if (m.during !== undefined && m.during !== null) {
      const ok = isObj(m.during) && ((m.during.segment !== undefined && segIds.has(m.during.segment)) || (m.during.twist !== undefined && twistIds.has(m.during.twist)));
      if (!ok) add(`${at}.during`, `${name}: where it happens isn't one of the segments or twists`);
    }
    oneOf(`${at}.counted`, name, 'counted', m.counted, 'how it is counted');
    oneOf(`${at}.answeredBy`, name, 'answeredBy', m.answeredBy, 'who answers it');
    if (m.reliability !== undefined) oneOf(`${at}.reliability`, name, 'reliability', m.reliability, 'how reliably recaps report it');
  }

  // What the kind hides isn't there.
  const labels = KINDS[kindOf(blocks)].labels;
  if (!labels.waysOut && ways.length) add('waysOut', `${KINDS[kindOf(blocks)].name} has no ways out`);
  if (!labels.twists && twists.length) add('twists', `${KINDS[kindOf(blocks)].name} has no twists`);

  // A competition crowns someone, unless nobody wins or a group does.
  const fin = isObj(finale) ? finale.decidedBy : undefined;
  if (kindOf(blocks) === 'competition' && !['nobody', 'groupWins'].includes(fin) && !ways.some((w) => isObj(w) && w.means === 'winner')) {
    add('waysOut', 'A competition needs a way out that means they won, unless nobody wins or a group does');
  }

  // Overrides and notes name moments that exist; momentsOff names moments its segment builds. Checked
  // against the moments these blocks build (rulebook-moments.js), loaded here to keep the two in step.
  if (!p.length) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- CommonJS, and circular at load time
    const { momentsFor } = require('./rulebook-moments.js');
    const all = momentsFor(blocks, { includeOff: true });
    const known = new Set(all.map((m) => m.id));
    for (const s of segs) {
      const own = new Set(all.filter((m) => m.from.segment === s.id && !m.custom).map((m) => m.id));
      for (const id of list(s.momentsOff)) if (!own.has(id)) add(`${loc('segments', s.id)}.momentsOff`, `${s.name}: "${id}" isn't one of the moments it builds`);
    }
    for (const t of twists) {
      const own = new Set(all.filter((m) => m.from.twist === t.id && !m.custom).map((m) => m.id));
      for (const id of list(t.momentsOff)) if (!own.has(id)) add(`${loc('twists', t.id)}.momentsOff`, `${t.name}: "${id}" isn't one of the moments it builds`);
    }
    if (isObj(finale)) {
      const own = new Set(all.filter((m) => m.from.finale).map((m) => m.id));
      for (const id of list(finale.momentsOff)) if (!own.has(id)) add('season.finale.momentsOff', `The finale: "${id}" isn't one of the moments it builds`);
    }
    for (const field of ['points', 'momentNotes']) {
      const o = blocks[field];
      if (o === undefined) continue;
      if (!isObj(o)) { add(field, `${field} should be a map of moments`); continue; }
      for (const [id, v] of Object.entries(o)) {
        if (!known.has(id)) add(`${field}.${id}`, `"${id}" isn't one of this rulebook's moments`);
        else if (field === 'points' && !(Number.isFinite(v) || (isObj(v) && Number.isFinite(v.exclusive) && Number.isFinite(v.shared)))) add(`${field}.${id}`, `${id}: points should be a number`);
      }
    }
  }
  if (blocks.leftOut !== undefined && !(Array.isArray(blocks.leftOut) && blocks.leftOut.every((s) => typeof s === 'string'))) add('leftOut', 'What didn\'t fit should be a list of sentences');
  return p;
}

module.exports = {
  SCHEMA_VERSION, OPT, KINDS, BLOCKS, GAME_LABELS, DECIDED_TAG, QUESTIONS, TWIST_FIELDS,
  labelOf, helpOf, valuesOf, optionsFor, partWord, blockLabel, blocksProblems, kindOf, camelId, cap, pluralOf,
};
