// What a rulebook's answers build: its moments, the things that can happen and score
// (docs/PLAN-rulebooks-implementation.md 4.2, the mockup's generate / generateTwist / questionFor). A
// segment's answers build its moments, and so do twists, ways out and the finale; moments added by hand
// come on top. Nobody writes a rule: R2's compiler turns these into the engine's events and rules.
//
//   momentsFor(blocks) -> [{ id, label, from, defaultPoints, ask?, auto?, custom?, answeredBy, reliability?, tags?, off? }]
//
//   from          where it comes from: { segment } | { twist } | { wayOut } | { finale: true }, plus { custom }
//                 for a moment added by hand (with its segment or twist when it happens during one)
//   ask           what research asks to know it: { key, type: 'answer' | 'integer' | 'number' | 'string', question }.
//                 Several moments can share one question (a vote's "who got votes"). A count of times is an
//                 integer; an amount that needn't be whole (innings pitched, a judge's score) a number.
//                 Either scores per unit (rulebook-compile.js, rules.js `per`), unless the ask says `when`:
//                 the test its number passes to score once ({ equals: 2 }: came 2nd; { greaterThan: 0 }).
//   also          yes-or-no asks that score it too, any one of them (a group's win that counts as winning it)
//   needs         asks that must be yes as well (votes cancelled by an advantage they played)
//   unless        asks that mustn't be yes (zero votes at a vote their group's win skipped; a reward's winners)
//                 Each of these is a whole ask, { key, type, question, label }, which research is asked too.
//   exile         a side trip that takes them away from their group: recorded as the episode's exile, and
//                 scored from that record (the engine's ep.exiled)
//   auto          known without asking about it: from how someone left, a role, or other answers
//   tags          what it says about someone's place in the game (moment-tags.js), from the structure that builds it
//                 (derivedTags), or the rulebook's own for it (momentNotes[id].tags; [] for none)
//   off           only with { includeOff: true }: built, but switched off (momentsOff, or a couch's own copy's
//                 momentNotes[id].off: Make it ours, step 6b part 3)
//
// Ids are `${itemId}${Template}` ("immunityChallengeWon"), or the item's own id for a way out and a moment
// added by hand, so they never change when something is renamed. Suggested points come from the template
// unless the rulebook's `points` overrides them. Plain CommonJS, browser-safe, like everything here.
/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS on purpose, see index.js */
const { kindOf, partWord, cap, hasGroupWin, winsOf } = require('./rulebook-schema.js');
/* eslint-enable @typescript-eslint/no-require-imports */

const list = (v) => (Array.isArray(v) ? v : []);
// "Won the Immunity challenge" -> "won the Immunity challenge": a label inside a question.
const lc = (s) => (s && !/^[A-Z]{2}/.test(s) ? s.charAt(0).toLowerCase() + s.slice(1) : s || '');
// "the Immunity challenge", and "the race" for a segment the show calls "The race".
const the = (name) => `the ${String(name || '').replace(/^the\s+/i, '')}`;
// An item's id inside a moment id: "tribalCouncil" -> "TribalCouncil".
const up = (id) => (id ? id.charAt(0).toUpperCase() + id.slice(1) : '');

const WAY_POINTS = { out: -3, finalist: 2, winner: 5, ending: 3, outForOne: -2 };

/** The research question for a moment, in the mockup's words; a moment added by hand can bring its own. */
function questionFor(moment, blocks) {
  if (moment.question) return moment.question;
  const label = lc(moment.label);
  if (kindOf(blocks) === 'talk') return `Did it happen tonight: ${label}?`;
  const part = partWord(blocks).singular;
  const where = moment.where ? ` at ${the(moment.where)}` : '';
  if (moment.counted === 'eachTime') return `This ${part}, how many times did each person: ${label}${where}?`;
  if (moment.counted === 'perUnit') return `This ${part}, how much for each person: ${label}${where}?`;
  return `This ${part}, who ${label}${where}?`;
}

// A yes-or-no question about each person. A built moment's label isn't always a verb ("2nd in the Immunity
// challenge"), so each template says how to ask who: "came 2nd in the Immunity challenge".
function askWho(blocks, label, who) {
  if (kindOf(blocks) === 'talk') return `Did it happen tonight: ${lc(label)}?`;
  return `This ${partWord(blocks).singular}, who ${who || lc(label)}?`;
}

// The yes-or-no asks a segment's winners are known by: winning it alone, and being in the group that won it.
function wonAskOf(s, blocks) {
  if (!winsOf(s)) return null;
  const label = `Won ${the(s.name)}`;
  return { key: `${s.id}Won`, type: 'answer', question: askWho(blocks, label), label };
}
function groupAskOf(s, blocks) {
  if (!hasGroupWin(s, blocks)) return null;
  const g = blocks.cast.groups.singular;
  const label = `${cap(g)} won ${the(s.name)}`;
  return { key: `${s.id}GroupWon`, type: 'answer', question: askWho(blocks, label, `was in the ${g} that won ${the(s.name)}`), label };
}

function segmentMoments(s, blocks) {
  const out = [];
  const n = s.name;
  const part = partWord(blocks).singular;
  const make = (suffix, label, points, ask) => out.push({ id: `${s.id}${suffix}`, label, from: { segment: s.id }, defaultPoints: points, ask });
  const yes = (suffix, label, points, who) => make(suffix, label, points, { key: `${s.id}${suffix}`, type: 'answer', question: askWho(blocks, label, who) });
  if (s.decidedBy === 'nobody') return out;

  if (['result', 'judges', 'headToHead'].includes(s.decidedBy)) {
    const d = s.decides;
    const groupAsk = groupAskOf(s, blocks);
    // A group's win that counts as winning it: one moment, scored on either answer (Survivor's reward).
    const folded = !!groupAsk && s.groupWin === 'won' && winsOf(s);
    const wonAsk = wonAskOf(s, blocks);
    if (wonAsk) {
      make('Won', wonAsk.label, 2, { key: wonAsk.key, type: 'answer', question: wonAsk.question });
      if (folded) out[out.length - 1].also = [groupAsk];
    }
    if (d === 'topThree' && s.places === 'place') {
      // One number for each person, read as 2nd and 3rd (Survivor's individual challenge finish).
      const place = {
        key: `${s.id}Place`, type: 'integer', label: `Finishing place in ${the(n)}`,
        question: `This ${part}, where each person finished in ${the(n)}: 1 for the winner, 2 for the runner-up, 3 for third, only when a source gives the order. Null if they finished lower or it isn't reported.`,
      };
      make('Second', `2nd in ${the(n)}`, 1, { ...place, when: { equals: 2 } });
      make('Third', `3rd in ${the(n)}`, 0.5, { ...place, when: { equals: 3 } });
    } else if (d === 'topThree') {
      yes('Second', `2nd in ${the(n)}`, 1, `came 2nd in ${the(n)}`);
      yes('Third', `3rd in ${the(n)}`, 0.5, `came 3rd in ${the(n)}`);
    }
    if (d === 'bestAndWorst') {
      yes('Best', `Among the best at ${the(n)}`, 1, `was among the best at ${the(n)}`);
      yes('Worst', `Among the worst at ${the(n)}`, -1, `was among the worst at ${the(n)}`);
    }
    if (d === 'fullOrder') {
      yes('First', `First in ${the(n)}`, 2, `finished first in ${the(n)}`);
      yes('Last', `Last in ${the(n)}`, -1, `finished last in ${the(n)}`);
    }
    if (d === 'score') make('PerPoint', `Each point at ${the(n)}`, 0.1, { key: `${s.id}Score`, type: 'number', question: `This ${part}, what did each person score at ${the(n)}?` });
    if (s.decidedBy === 'headToHead' && s.onTheLine !== 'goingHome') yes('Lost', `Lost ${the(n)}`, -1);
    if (groupAsk && !folded) make('GroupWon', groupAsk.label, 1, { key: groupAsk.key, type: 'answer', question: groupAsk.question });
  } else if (s.decidedBy === 'vote') {
    if (s.voters === 'cast') {
      const votes = { key: `${s.id}VotesReceived`, type: 'integer', question: `This ${part}, how many votes did each person get at ${n}?` };
      const votedFor = { key: `${s.id}VotedFor`, type: 'string', question: `This ${part}, who did each person vote for at ${n}?` };
      make('ZeroVotes', `Zero votes at ${n}`, 0.5, votes);
      // A group whose win skips the vote was never at it, so it isn't safe there with zero votes (Survivor's tribe immunity).
      const skips = s.skippedBy ? groupAskOf(list(blocks.segments).find((x) => x.id === s.skippedBy), blocks) : null;
      if (skips) out[out.length - 1].unless = [skips];
      make('SurvivedVotes', `Received votes at ${n} and survived`, 1, votes);
      make('VotedWithMajority', 'Voted with the majority', 0.5, votedFor);
      make('VotedAgainstMajority', 'Voted against the majority', 0, votedFor);
    } else if (s.voters === 'secretGroup') {
      yes('TargetedSurvived', `Targeted at ${n} and survived`, 1, `was targeted at ${n} and survived`);
    } else {
      yes('Bottom', `In the bottom at ${n}`, -1, `was in the bottom at ${n}`);
      yes('Saved', `Saved at ${n}`, 1, `was saved at ${n}`);
    }
  } else if (s.decidedBy === 'pick') {
    yes('Picked', `Picked at ${the(n)}`, 1, `was picked at ${the(n)}`);
    yes('PickedFirst', `Picked first at ${the(n)}`, 2, `was picked first at ${the(n)}`);
    yes('NotPicked', `Not picked at ${the(n)}`, -1, `wasn't picked at ${the(n)}`);
  }

  if (s.onTheLine === 'advantage') yes('EarnedAdvantage', `Earned an advantage at ${the(n)}`, 2);
  if (s.onTheLine === 'reward' && !/reward/i.test(n)) yes('SharedReward', `Shared the reward from ${the(n)}`, 0.5);
  if (s.onTheLine === 'atRisk') yes('AtRisk', `Put at risk at ${the(n)}`, -0.5, `was put at risk at ${the(n)}`);
  return out;
}

function twistMoments(t, blocks) {
  const out = [];
  const make = (suffix, label, points, ask) => out.push({ id: `${t.id}${suffix}`, label, from: { twist: t.id }, defaultPoints: points, ...(ask ? { ask } : { auto: true }) });
  const yes = (suffix, label, points, who) => make(suffix, label, points, { key: `${t.id}${suffix}`, type: 'answer', question: askWho(blocks, label, who) });
  const one = t.oneIsCalled || 'one';
  if (t.type === 'secretRole') {
    const [secret, other] = list(t.roles);
    if (secret && other) {
      // Role-aware votes, for every vote by the cast that sends someone home: known from who voted for whom and
      // the roles the show revealed (today's voteByRole), so nothing more is asked.
      for (const s of list(blocks.segments).filter((x) => x.decidedBy === 'vote' && x.voters === 'cast' && x.onTheLine === 'goingHome')) {
        make(`CaughtAt${up(s.id)}`, `As a ${other}, voted out a ${secret} at ${s.name}`, 3);
        make(`FooledAt${up(s.id)}`, `As a ${secret}, voted out a ${other} at ${s.name}`, 1);
      }
    }
    if (secret && t.canSwitch === 'recruited') {
      make('Recruited', `Recruited as a ${secret}`, 3);
      yes('TurnedDown', 'Turned down the offer', 1, `turned down the offer to become a ${secret}`);
    }
    if (secret && t.revealed === 'atFinale') make('MadeFinale', `Reached the finale as a ${secret}`, 3);
  } else if (t.type === 'advantage') {
    const does = list(t.does);
    yes('Got', `Got ${one}`, 2);
    // Played one: a moment, and what votes it cancelled can need.
    const played = { key: `${t.id}Played`, type: 'answer', question: askWho(blocks, `Played ${one}`), label: `Played ${one}` };
    make('Played', played.label, 1, { key: played.key, type: 'answer', question: played.question });
    if (does.includes('cancelsVotes') && t.cancelled === 'count') {
      // How many votes it cancelled, for whoever played one: it scores once it cancelled any (Survivor's votes nullified).
      make('CancelledVotes', `Played ${one} that cancelled votes`, 2, {
        key: `${t.id}VotesCancelled`, type: 'integer', label: `Votes cancelled by ${one} they played`, when: { greaterThan: 0 },
        question: `This ${partWord(blocks).singular}, if each person played ${one}, how many votes it cancelled: 0 if none. Null if they played nothing or it isn't reported.`,
      });
      out[out.length - 1].needs = [played];
    } else if (does.includes('cancelsVotes')) yes('CancelledVotes', `Played ${one} that cancelled votes`, 2);
    if (does.includes('keepsSafe')) yes('SavedBy', `Saved by ${one}`, 2, `was saved by ${one}`);
    if (does.includes('savesSomeone')) yes('SavedSomeone', `Used ${one} to save someone`, 1);
    if (does.includes('hurtsSomeone')) yes('UsedAgainst', `Had ${one} used against them`, -1);
    if (does.includes('extraVote')) yes('ExtraVote', 'Cast an extra vote', 1);
    if (does.includes('skipsATask')) yes('SkippedTask', `Skipped a task with ${one}`, 1);
    if (t.lasts === 'untilPlayed') yes('WentHomeHolding', `Went home holding ${one}`, -1);
  } else if (t.type === 'comeback') {
    if (t.who === 'peopleWhoLeft') {
      // Scores, but doesn't put them back into play yet (the implementation plan's decision 8).
      yes('CameBack', 'Came back into the game', 2);
      yes('SentHomeAgain', 'Sent home again', -1, 'was sent home again');
    } else yes('Arrived', 'Arrived partway through', 0);
    if (t.how === 'winHeadToHead') yes('WonWayBack', 'Won their way back', 3);
  } else if (t.type === 'sideTrip') {
    const canGet = list(t.canGet);
    if (t.away === 'yes') {
      // Away from their group while still in the game: the episode records it, and that record scores (Exile Island).
      yes('Went', `Sent to ${one}`, 1, `was sent to ${one}`);
      out[out.length - 1].exile = true;
    } else yes('Went', `Went on ${one}`, 1);
    if (canGet.includes('advantage')) yes('CameBackWithAdvantage', `Came back from ${one} with an advantage`, 2);
    if (canGet.includes('disadvantage')) yes('LostSomething', `Lost something on ${one}`, -1);
  }
  return out;
}

function wayMoments(w, blocks) {
  if (w.means === 'outForOne') {
    // Only this race or event: not a way out of the season, so research is asked.
    const question = `This ${partWord(blocks).singular}, who's down as "${w.name}"?`;
    return [{ id: w.id, label: w.name, from: { wayOut: w.id }, defaultPoints: WAY_POINTS.outForOne, ask: { key: w.id, type: 'answer', question } }];
  }
  return [{ id: w.id, label: w.name, from: { wayOut: w.id }, defaultPoints: WAY_POINTS[w.means] ?? 0, auto: true }];
}

function finaleMoments(blocks) {
  const f = blocks.season && blocks.season.finale;
  if (!f || f.decidedBy !== 'juryVote') return [];
  return [
    { id: 'finaleJuryVote', label: 'Each jury vote received', from: { finale: true }, defaultPoints: 0.5, auto: true },
    { id: 'finaleNoJuryVotes', label: 'Finalist with no jury votes', from: { finale: true }, defaultPoints: -2, auto: true },
  ];
}

function customMoment(m, blocks) {
  const seg = m.during && m.during.segment ? list(blocks.segments).find((s) => s.id === m.during.segment) : null;
  const twist = m.during && m.during.twist ? list(blocks.twists).find((t) => t.id === m.during.twist) : null;
  const from = { custom: m.id, ...(seg ? { segment: seg.id } : twist ? { twist: twist.id } : {}) };
  const type = m.counted === 'yesNo' ? 'answer' : m.counted === 'perUnit' ? 'number' : 'integer';
  // A segment is a place in the episode ("at the Reward challenge"); a twist isn't, so it adds nothing to the question.
  const question = questionFor({ label: m.label, question: m.question, counted: m.counted, where: seg ? seg.name : null }, blocks);
  // `uses`: scored from a question the rulebook already asks (its key), rather than one of its own (rulebook-compile.js).
  const key = typeof m.uses === 'string' && m.uses ? m.uses : m.id;
  // Not for whoever won the segment it happens during, alone or in the group that won (chosen to join a reward).
  const winners = m.exceptWinners === true && seg ? [wonAskOf(seg, blocks), groupAskOf(seg, blocks)].filter(Boolean) : [];
  return {
    id: m.id, label: m.label, from, defaultPoints: 0, custom: true, ask: { key, type, question }, answeredBy: m.answeredBy,
    ...(key !== m.id ? { uses: key } : {}), ...(m.reliability ? { reliability: m.reliability } : {}), ...(winners.length ? { unless: winners } : {}),
  };
}

/**
 * What a built moment says about someone's place in the game (moment-tags.js), from the structure that builds it: a vote
 * that sends someone home or puts them at risk (votes against them survived, none against them, voted with the majority,
 * targeted there and survived, in the bottom), being put at risk, winning safety, and protection carried into a later vote
 * (an advantage that keeps them safe or cancels votes and lasts past the episode: got one, played one, the votes it
 * cancelled). Null for the rest, and for a moment added by hand: the rulebook can give any moment its own
 * (momentNotes[id].tags).
 */
function derivedTags(m, blocks) {
  if (m.custom) return null;
  const is = (item, suffix) => m.id === `${item.id}${suffix}`;
  const seg = m.from.segment ? list(blocks.segments).find((s) => s.id === m.from.segment) : null;
  if (seg) {
    if (seg.decidedBy === 'vote' && (seg.onTheLine === 'goingHome' || seg.onTheLine === 'atRisk')) {
      if (is(seg, 'ZeroVotes')) return ['safe', 'safety'];
      if (is(seg, 'SurvivedVotes')) return ['danger', 'safety'];
      if (is(seg, 'VotedWithMajority')) return ['safe'];
      if (is(seg, 'TargetedSurvived') || is(seg, 'Bottom')) return ['danger'];
    }
    if (seg.onTheLine === 'safety' && is(seg, 'Won')) return ['threat', 'safety'];
    if (seg.onTheLine === 'atRisk' && is(seg, 'AtRisk')) return ['danger'];
    return null;
  }
  const twist = m.from.twist ? list(blocks.twists).find((t) => t.id === m.from.twist) : null;
  if (twist && twist.type === 'advantage' && twist.lasts !== 'oneEpisode' && list(twist.does).some((d) => d === 'keepsSafe' || d === 'cancelsVotes')) {
    if (is(twist, 'Got')) return ['protectionGained'];
    if (is(twist, 'Played') || is(twist, 'CancelledVotes')) return ['protectionUsed'];
  }
  return null;
}

/**
 * Every moment the rulebook builds, in the order a points page lists them: each segment's, then the moments
 * added by hand during it; each twist's, then its own added ones; the ways out; the finale's; then the moments
 * added by hand anywhere. `includeOff` keeps the ones switched off (momentsOff), marked `off`.
 */
function momentsFor(blocks, { includeOff = false } = {}) {
  if (!blocks || typeof blocks !== 'object') return [];
  const customs = list(blocks.customMoments);
  const during = (key, id) => customs.filter((m) => m.during && m.during[key] === id).map((m) => customMoment(m, blocks));
  const offFrom = (item) => new Set(list(item && item.momentsOff));
  const all = [];
  for (const s of list(blocks.segments)) {
    const off = offFrom(s);
    all.push(...segmentMoments(s, blocks).map((m) => (off.has(m.id) ? { ...m, off: true } : m)), ...during('segment', s.id));
  }
  for (const t of list(blocks.twists)) {
    const off = offFrom(t);
    all.push(...twistMoments(t, blocks).map((m) => (off.has(m.id) ? { ...m, off: true } : m)), ...during('twist', t.id));
  }
  for (const w of list(blocks.waysOut)) all.push(...wayMoments(w, blocks));
  const finaleOff = offFrom(blocks.season && blocks.season.finale);
  all.push(...finaleMoments(blocks).map((m) => (finaleOff.has(m.id) ? { ...m, off: true } : m)));
  all.push(...customs.filter((m) => !m.during).map((m) => customMoment(m, blocks)));

  const points = (blocks.points && typeof blocks.points === 'object' && blocks.points) || {};
  const notes = (blocks.momentNotes && typeof blocks.momentNotes === 'object' && blocks.momentNotes) || {};
  const kind = kindOf(blocks);
  // Switched off where it's built, or by a note (a couch's own copy chooses what counts whatever builds it).
  const isOff = (m) => !!m.off || !!(notes[m.id] && notes[m.id].off);
  return all
    .filter((m) => includeOff || !isOff(m))
    .map((m) => (isOff(m) && !m.off ? { ...m, off: true } : m))
    .map((m) => {
      const note = notes[m.id] || {};
      // Who answers: a moment added by hand says; a built one is research's unless research rated it otherwise.
      // A talk show's moments are the league's to call as it watches (the design plan's layer zero).
      const answeredBy = m.answeredBy || note.answeredBy || (m.auto ? undefined : kind === 'talk' ? 'league' : 'research');
      const reliability = m.reliability || note.reliability;
      // The rulebook's own say for this moment ([] for none), else what its structure says.
      const tags = Array.isArray(note.tags) ? note.tags : derivedTags(m, blocks);
      return {
        ...m,
        defaultPoints: Object.prototype.hasOwnProperty.call(points, m.id) ? points[m.id] : m.defaultPoints,
        ...(answeredBy ? { answeredBy } : {}),
        ...(reliability ? { reliability } : {}),
        ...(tags ? { tags: [...tags] } : {}),
      };
    });
}

module.exports = { momentsFor, questionFor, the, WAY_POINTS };
