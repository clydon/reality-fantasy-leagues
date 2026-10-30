// How a rulebook reads to people (docs/PLAN-rulebooks-implementation.md 4.7): the view models the new
// design's screens render, so How it works, Backstage › Scoring rules and the admin's rulebook page all say
// it the same way. Pure: the screens draw what these return.
//
//   howItWorks(blocks, opts) -> the How it works page (docs/PLAN-new-design.md step 1; the site mock's
//   rulebook.js howPage): the kind of show and its premise; each episode as a rundown; the season as a cell per
//   episode with its phases; who's playing; ways out; twists; what scores; updates; where it came from.
//
// It's spoiler-safe given how far the reader has seen (`seen`, from src/lib/server/guard.ts seenThrough):
// a phase that hasn't started by then shows only its condition ("When about 12 remain"), never the episode it
// started; an update from a later episode is only counted ("1 update from Episode 8"); a moment a rule change
// adds from a later episode isn't listed, and one it retires later still is. Nothing here reads results.
//
// The smaller pieces (decidedLine, whoLine, startText, pointGroups, blockSummaries...) are exported for the
// admin's and the commissioner's pages. Plain CommonJS, browser-safe, like everything in formats/.
/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS on purpose, see index.js */
const { KINDS, labelOf, kindOf, partWord, blockLabel, cap, pluralOf } = require('./rulebook-schema.js');
const { momentsFor } = require('./rulebook-moments.js');
const { gamesFor } = require('./rulebook-fits.js');
/* eslint-enable @typescript-eslint/no-require-imports */

const list = (v) => (Array.isArray(v) ? v : []);
const seenOf = (v) => (v === Infinity ? Infinity : Number.isInteger(v) && v > 0 ? v : 0);

/** "Decided by a vote", "Each team chooses", "Head to head"... the rundown's tag for who decides a segment; null for nobody. */
function decidedLine(segment, blocks) {
  const s = segment || {};
  if (s.decidedBy === 'result') return s.decides === 'fullOrder' ? 'First to last' : s.decides === 'score' ? 'Scored' : 'Won in a challenge';
  if (s.decidedBy === 'judges') return 'Judged';
  if (s.decidedBy === 'headToHead') return 'Head to head';
  if (s.decidedBy === 'vote') {
    return { cast: 'Decided by a vote', viewers: 'Viewers vote', jury: 'A jury votes', judges: 'The judges vote', secretGroup: 'A secret vote' }[s.voters] || 'A vote';
  }
  if (s.decidedBy === 'pick') {
    const one = (blocks && blocks.cast && blocks.cast.singular) || 'person';
    return { onePerson: 'Someone picks', eachPerson: `Each ${one} chooses`, panel: 'A panel picks' }[s.pickers] || 'A pick';
  }
  return null;
}

const STAKES = { goingHome: 'Going home', safety: 'Safety', reward: 'Reward', advantage: 'Advantage', atRisk: 'At risk', points: 'Points' };
/** What's on the line, as the rundown's chip: { key, label }, or null for nothing. */
function stakeOf(segment) {
  const k = segment && segment.onTheLine;
  return STAKES[k] ? { key: k, label: STAKES[k] } : null;
}

const phaseName = (blocks, id) => (id === 'finale' ? 'Finale' : (list(blocks.season && blocks.season.phases).find((p) => p.id === id) || {}).name || 'One phase');
/** How often, when it isn't every episode: "Some episodes", "Merged only", "Finale only". */
function oftenLine(segment, blocks) {
  if (!segment || segment.often === 'everyEpisode') return null;
  if (segment.often === 'onePhase') return `${phaseName(blocks, segment.phase)} only`;
  return labelOf('often', segment.often);
}

const STAKE_PHRASE = { nothing: 'nothing on the line', reward: 'for a reward', advantage: 'for an advantage', safety: 'for safety', atRisk: 'puts someone at risk', goingHome: 'sends someone home', points: 'for points' };
/** The admin's one-liner for a segment: "Every episode · the cast votes · sends someone home". */
function segmentLine(segment, blocks) {
  const s = segment || {};
  const who = s.decidedBy === 'vote' ? `${lowerFirst(labelOf('voters', s.voters))} votes` : s.decidedBy === 'pick' ? `${lowerFirst(labelOf('pickers', s.pickers))} picks` : lowerFirst(decidedLine(s, blocks) || 'nothing decided');
  return [oftenLine(s, blocks) || 'Every episode', who, STAKE_PHRASE[s.onTheLine || 'nothing']].join(' · ');
}
function lowerFirst(s) {
  return s ? s.charAt(0).toLowerCase() + s.slice(1) : '';
}

/** A phase's first episode, when it's known: fixed by the rulebook, or confirmed for this season (phaseStarts). */
function phaseStart(phase, phaseStarts) {
  if (phase && phase.starts && phase.starts.type === 'episode') return phase.starts.n;
  const n = phaseStarts && phase ? phaseStarts[phase.id] : undefined;
  return Number.isInteger(n) && n >= 1 ? n : null;
}

/**
 * When a phase starts, said safely: "From Episode 8" once the reader has seen it start (or when the rulebook
 * fixes it in advance), else its condition: "When about 12 remain", "When the show says so".
 */
function startText(phase, blocks, { phaseStarts, seen } = {}) {
  const unit = cap(partWord(blocks).singular);
  const start = phaseStart(phase, phaseStarts);
  const fixed = phase && phase.starts && phase.starts.type === 'episode';
  if (start !== null && (fixed || start <= Math.max(1, seenOf(seen)))) return `From ${unit} ${start}`;
  if (phase && phase.starts && phase.starts.type === 'remaining' && Number.isInteger(phase.starts.n)) return `When about ${phase.starts.n} remain`;
  return 'When the show says so';
}

const groupsWord = (blocks) => {
  const g = blocks && blocks.cast && blocks.cast.groups;
  return g ? pluralOf(g.singular) : null;
};

/** "18 castaways, in tribes." (with `count`, the season's real cast size, over the usual one). */
function whoLine(blocks, count) {
  const cast = (blocks && blocks.cast) || {};
  const n = Number.isInteger(count) ? count : Number.isInteger(cast.usualSize) && cast.usualSize > 0 ? cast.usualSize : null;
  const g = groupsWord(blocks);
  return `${n !== null ? `${n} ` : ''}${n === null ? cap(cast.plural || '') : cast.plural || ''}${g ? `, in ${g}` : ''}.`;
}

/** How the groups change: "Tribes change at set points. Tribes end when Merged begins." Null without groups. */
function groupsLine(blocks) {
  const g = blocks && blocks.cast && blocks.cast.groups;
  if (!g) return null;
  const word = cap(pluralOf(g.singular));
  const ends = list(blocks.season && blocks.season.phases).find((p) => list(p.changes).includes('groupsEnd'));
  const change = { atPhases: `${word} change at set points.`, often: `${word} change all the time.` }[g.change] || '';
  return [change, ends ? `${word} end when ${ends.name} begins.` : ''].filter(Boolean).join(' ') || null;
}

/** The finale in a sentence: its own, else one made from how it's decided. Null when the rulebook doesn't say. */
function finaleLine(blocks) {
  const f = blocks && blocks.season && blocks.season.finale;
  if (!f || !f.decidedBy) return null;
  if (f.summary) return f.summary;
  const part = partWord(blocks).singular;
  const final = Number.isInteger(f.finalists) ? `the final ${f.finalists}` : 'the finalists';
  const group = (blocks.cast && blocks.cast.groups && blocks.cast.groups.singular) || 'group';
  return {
    juryVote: `A jury votes for the winner from ${final}.`,
    judges: `The judges choose the winner from ${final}.`,
    viewersVote: `Viewers vote for the winner from ${final}.`,
    castVote: 'The cast votes to decide how it ends.',
    lastStanding: 'The last one standing wins.',
    firstToFinish: 'The first to the finish wins.',
    mostPoints: `Most points after the last ${part} wins.`,
    groupWins: `A ${group} wins, and everyone in it scores.`,
    nobody: 'No winner: the season just ends.',
  }[f.decidedBy];
}

/** A twist in a sentence: its own, else one made from its answers. */
function twistLine(twist) {
  const t = twist || {};
  if (t.summary) return t.summary;
  const join = (xs) => xs.map((x, i) => (i ? lowerFirst(x) : x)).join(', ');
  if (t.type === 'secretRole') return `${list(t.roles).join(' and ')}. Revealed ${lowerFirst(labelOf('revealed', t.revealed))}.`;
  if (t.type === 'advantage') return `${cap(t.oneIsCalled || 'One')}: ${lowerFirst(labelOf('gotBy', t.gotBy))}. ${join(list(t.does).map((d) => labelOf('does', d)))}.`.replace(/\. \.$/, '.');
  if (t.type === 'comeback') return `${labelOf('comebackWho', t.who)}: ${lowerFirst(labelOf('comebackHow', t.how))}.`;
  if (t.type === 'sideTrip') return `${cap(t.oneIsCalled || 'One')}: ${lowerFirst(labelOf('tripWho', t.who))}.`;
  return '';
}

// ---------- points ----------

const pointsOf = (v, ownership) => (v && typeof v === 'object' ? v[ownership === 'shared' ? 'shared' : 'exclusive'] : v);

// The episode a rule change starts awarding an event from: when every rule that awards it is gated
// (season-changes.js stamps fromEpisode on what a change adds). Null when it scores from the start.
function startsFrom(eventId, compiled) {
  const rules = [...list(compiled.rules && compiled.rules.research), ...list(compiled.rules && compiled.rules.implied)].filter((r) => r.award === eventId);
  if (!rules.length || !rules.every((r) => Number.isInteger(r.fromEpisode))) return null;
  return Math.min(...rules.map((r) => r.fromEpisode));
}

/**
 * What scores, in groups. With `compiled` (the format data the league or season plays by) it lists that
 * catalog in its own category order with its own points; without, the moments the blocks build, grouped by
 * where they come from. `points` is a league's own values (settings.eventPoints) over the suggested ones,
 * `ownership` picks a shared-or-exclusive default, and `seen` keeps later changes out (see the header).
 * Each item: { id, label, points, auto, league }: auto = known without asking (how they left, a role),
 * league = the league answers it.
 */
function pointGroups(blocks, { compiled, aliases, points, ownership, seen } = {}) {
  const s = seenOf(seen);
  const moments = momentsFor(blocks);
  const legacy = (m) => (aliases && aliases.events && aliases.events[m.id]) || m.id;
  const leagueAnswers = new Set(moments.filter((m) => m.answeredBy === 'league').map(legacy));
  const value = (id, def) => (points && Number.isFinite(points[id]) ? points[id] : pointsOf(def, ownership));
  if (compiled && Array.isArray(compiled.events)) {
    const byId = new Map(compiled.events.map((e) => [e.id, e]));
    // The moment each event is (its first, as the compiler has it), through the rulebook's aliases.
    const momentOf = new Map();
    for (const m of moments) if (!momentOf.has(legacy(m))) momentOf.set(legacy(m), m.id);
    return list(compiled.eventCategories)
      .map((c) => ({
        id: c.id,
        label: c.label,
        items: list(c.events)
          .map((id) => byId.get(id))
          .filter((e) => e && !(Number.isInteger(e.retiredFrom) && e.retiredFrom <= Math.max(1, s)))
          .filter((e) => {
            const from = startsFrom(e.id, compiled);
            return from === null || from <= s;
          })
          .map((e) => ({
            id: e.id, momentId: momentOf.get(e.id) ?? e.id, label: e.label, points: value(e.id, e.defaultPoints), defaultPoints: e.defaultPoints,
            auto: !!e.implied, league: leagueAnswers.has(e.id),
          })),
      }))
      .filter((g) => g.items.length);
  }
  const groups = [];
  const into = (id, label, m) => {
    let g = groups.find((x) => x.id === id);
    if (!g) groups.push((g = { id, label, items: [] }));
    g.items.push({ id: m.id, momentId: m.id, label: m.label, points: value(m.id, m.defaultPoints), defaultPoints: m.defaultPoints, auto: !!m.auto, league: m.answeredBy === 'league' });
  };
  const segName = (id) => (list(blocks.segments).find((x) => x.id === id) || {}).name;
  const twistName = (id) => (list(blocks.twists).find((x) => x.id === id) || {}).name;
  for (const m of moments) {
    if (m.from.segment) into(m.from.segment, segName(m.from.segment), m);
    else if (m.from.twist) into(m.from.twist, twistName(m.from.twist), m);
    else if (m.from.wayOut || m.from.finale) into('waysOut', blockLabel(blocks, 'waysOut') || 'Ways out', m);
    else into('other', kindOf(blocks) === 'talk' ? 'What can happen' : 'Other moments', m);
  }
  return groups;
}

// ---------- updates ----------

const UPDATE_TITLES = { fix: 'Fixed a mistake', showChanged: 'The show changed' };
const UPDATE_TAGS = { fix: 'Fix', showChanged: 'New' };

/**
 * The rulebook's timeline for a reader at `seen`: [{ episode, kind, title, detail }] in, { shown, hidden } out.
 * Where it started always shows; an update from a later episode is only counted ("1 update from Episode 8 ·
 * It shows once you've seen it").
 */
function updatesFor(blocks, updates, seen) {
  const s = seenOf(seen);
  const unit = cap(partWord(blocks).singular);
  const all = list(updates)
    .filter((u) => u && Number.isInteger(u.episode))
    .slice()
    .sort((a, b) => a.episode - b.episode);
  const view = (u) => ({
    episode: u.episode,
    kind: u.kind,
    title:
      u.title ||
      (u.kind === 'start'
        ? u.episode <= 1 ? 'In force from the premiere' : `In force from ${unit} ${u.episode}`
        : u.kind === 'end' ? `Ends with ${unit} ${u.episode}` : UPDATE_TITLES[u.kind] || 'Updated'),
    detail: u.detail || '',
    tag: UPDATE_TAGS[u.kind] || null,
  });
  // Where a game starts and ends are its own settings, not news from the show: always shown.
  const always = (u) => u.kind === 'start' || u.kind === 'end';
  const shown = all.filter((u) => always(u) || u.episode <= s).map(view);
  const later = all.filter((u) => !(always(u) || u.episode <= s));
  const hidden = later.length
    ? { count: later.length, from: later[0].episode, title: `${later.length} update${later.length > 1 ? 's' : ''} from ${unit} ${later[0].episode}`, detail: "It shows once you've seen it" }
    : null;
  return { shown, hidden };
}

// ---------- the page ----------

/**
 * The How it works page's view model. opts:
 *   seen          the last episode the reader may be told about (guard.ts seenThrough; Infinity = everything)
 *   episodeCount  the season's length, when known: the season strip is a cell per episode
 *   phaseStarts   { phaseId: episode } confirmed for this season
 *   castCount     the season's real cast size, over the usual one
 *   compiled, aliases, points, ownership   what scores (pointGroups)
 *   updates       the timeline (updatesFor); lineage: where it came from, in a line
 */
function howItWorks(blocks, opts = {}) {
  const b = blocks || {};
  const kind = kindOf(b);
  const K = KINDS[kind];
  const part = partWord(b);
  const unit = cap(part.singular);
  const seen = seenOf(opts.seen);
  const total = Number.isInteger(opts.episodeCount) && opts.episodeCount > 0 ? opts.episodeCount : null;
  const you = total === null ? (seen === Infinity ? null : seen) : Math.min(seen, total);
  const start = kind === 'series' && b.start ? labelOf('start', b.start) : null;

  const phases = list(b.season && b.season.phases).map((p) => {
    const at = phaseStart(p, opts.phaseStarts);
    return { id: p.id, name: p.name, when: startText(p, b, opts), started: at !== null && at <= Math.max(1, seen), summary: p.summary || null };
  });
  const finale = b.season && b.season.finale;
  // The finale closes the strip, unless the rulebook already has a phase for it.
  if (finale && finale.decidedBy && finale.decidedBy !== 'nobody' && !phases.some((p) => p.id === 'finale' || /\bfinale\b/i.test(p.name || ''))) {
    phases.push({ id: 'finale', name: 'Finale', when: total ? `${unit} ${total}` : `The last ${part.singular}`, started: total !== null && you !== null && you >= total, summary: null, finale: true });
  }

  const waysLabel = blockLabel(b, 'waysOut');
  const ways = list(b.waysOut);
  const twistsLabel = blockLabel(b, 'twists');
  const pointsLabel = blockLabel(b, 'points');
  const noPoints = kind === 'talk';
  const groups = pointGroups(b, opts);

  return {
    kind: { key: kind, name: K.name, start, line: start ? `${K.name} · ${start}` : K.name },
    show: b.show || null,
    tagline: b.tagline || null,
    premise: b.premise || null,
    jump: [
      { key: 'rundown', label: blockLabel(b, 'segments') },
      { key: 'season', label: blockLabel(b, 'season') },
      { key: 'who', label: blockLabel(b, 'cast') },
      { key: 'points', label: pointsLabel },
    ],
    rundown: {
      label: blockLabel(b, 'segments'),
      segments: list(b.segments).map((s, i) => ({
        n: i + 1, id: s.id, name: s.name, summary: s.summary || null, decided: decidedLine(s, b), often: oftenLine(s, b), stake: stakeOf(s),
      })),
    },
    season: {
      label: blockLabel(b, 'season'),
      unit,
      total,
      you,
      cells: total === null ? [] : Array.from({ length: total }, (_, i) => ({ n: i + 1, seen: you !== null && i + 1 <= you, next: you !== null && i + 1 === you + 1, finale: i + 1 === total })),
      phases,
      finale: finaleLine(b),
    },
    who: {
      label: blockLabel(b, 'cast'),
      count: Number.isInteger(opts.castCount) ? opts.castCount : (b.cast && b.cast.usualSize) || null,
      line: whoLine(b, opts.castCount),
      groups: groupsLine(b),
    },
    waysOut: waysLabel && (ways.length || finaleLine(b))
      ? {
          label: waysLabel,
          out: ways.filter((w) => w.means === 'out' || w.means === 'outForOne').map((w) => ({ id: w.id, name: w.name, means: w.means })),
          finish: ways.filter((w) => !['out', 'outForOne'].includes(w.means)).map((w) => ({ id: w.id, name: w.name, means: w.means })),
          end: finaleLine(b),
        }
      : null,
    twists: twistsLabel && list(b.twists).length
      ? { label: twistsLabel, items: list(b.twists).map((t) => ({ id: t.id, name: t.name, type: t.type, typeLabel: labelOf('twistType', t.type), line: twistLine(t) })) }
      : null,
    points: {
      label: pointsLabel,
      // A talk show's moments fill bingo cards and weekly calls: no points.
      aside: noPoints ? 'For bingo and calls' : opts.points ? "This game's points" : 'Suggested · each couch can change them',
      noPoints,
      groups: noPoints ? groups.map((g) => ({ ...g, items: g.items.map((i) => Object.fromEntries(Object.entries(i).filter(([k]) => k !== 'points'))) })) : groups,
    },
    updates: updatesFor(b, opts.updates, seen),
    lineage: opts.lineage || null,
    results: K.results,
    // The season games this rulebook can feed (rulebook-fits.js): the kind's, less any its rules can't.
    games: gamesFor(b, opts.compiled).filter((g) => g.fits).map((g) => ({ key: g.key, name: g.name })),
  };
}

/** The editor index's one-liners, per block the kind shows: [{ block, label, summary }]. */
function blockSummaries(blocks) {
  const b = blocks || {};
  const out = [];
  const add = (block, summary) => {
    const label = blockLabel(b, block);
    if (label) out.push({ block, label, summary });
  };
  add('cast', whoLine(b).replace(/\.$/, ''));
  add('season', [...list(b.season && b.season.phases).map((p) => (p.starts && p.starts.type === 'episode' ? p.name : `${p.name} (${lowerFirst(startText(p, b))})`)), ...(b.season && b.season.finale ? ['Finale'] : [])].join(' › '));
  add('segments', list(b.segments).map((s) => s.name).join(', ') || 'None');
  add('waysOut', list(b.waysOut).map((w) => w.name).join(', ') || 'None');
  add('twists', list(b.twists).map((t) => t.name).join(', ') || 'None');
  const n = momentsFor(b).length;
  add('points', kindOf(b) === 'talk' ? `${n} moment${n === 1 ? '' : 's'}` : `${n} moment${n === 1 ? '' : 's'}, suggested points`);
  return out;
}

module.exports = {
  howItWorks, pointGroups, updatesFor, blockSummaries,
  decidedLine, stakeOf, oftenLine, segmentLine, startText, phaseStart, whoLine, groupsLine, finaleLine, twistLine,
};
