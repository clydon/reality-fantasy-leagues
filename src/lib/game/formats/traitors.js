// The Traitors format. See survivor.js for the shape every format has, and docs/PLAN-show-formats.md
// for the confirmed catalog and the wiki investigation this is built on (US4 completed, US5 live).
//
// Two things set it apart from Survivor:
//
//   * ROLES. Everyone is a Faithful unless made a Traitor -- chosen at the start, or recruited later.
//     A role is recorded as a per-episode fact (episode.roles, like exile), so it reaches a league
//     through the same reveal-gated decisions as everything else: a league catching up doesn't learn
//     who the Traitors are before it reaches the episode that showed it.
//
//   * IMPLIED EVENTS. Being murdered, reaching the end, winning, being caught as a Traitor and being
//     recruited are all facts the league already holds as an exit or a role. They score through
//     impliedEvents rather than as separately reviewed events, so correcting an exit (Banished ->
//     Murdered) can't leave a stale event behind. Such events are marked `implied` and can't be
//     added by hand.

// eslint-disable-next-line @typescript-eslint/no-require-imports -- CommonJS on purpose, see index.js
const { defineFormat } = require('./define.js');

const exitMethods = ['Banished', 'Murdered', 'Left the game', 'Finalist', 'Winner', 'Other'];

// Role values a decision can record. Both mean "is a Traitor from this episode on"; the second is
// also the recruited event.
const ORIGINAL = 'Traitor';
const RECRUITED = 'Recruited Traitor';

// Point values, balanced as a set over 20 finished English-language seasons (US, UK, AU, CA, NZ, IE)
// -- the evidence and the variants tried are in docs/RESEARCH-traitors-scoring-values.md. The aims:
//   * Voting out a Traitor is the clearest sign of good play (people who do it go furthest), so it and
//     its Traitor mirror carry the most weight among the weekly events.
//   * A Traitor's season should be worth about what a Faithful's is. Traitors can't catch Traitors and
//     are never murdered, so without turnedOnTraitor and zeroVotes they scored a fifth of a Faithful.
//   * Shields are mostly luck (past shields don't predict the next) and some missions hand out a dozen,
//     so they're worth 2, half a Traitor catch.
//   * In an exclusive league one team owns the eventual winner outright, and owning them already
//     decides most leagues (they last longest and pile up the Traitor vote events), so those events are lower there: in mock drafts the owner's chance falls from 80% to 70%.
//   * The win itself is kept small in every league (6): at 20 it decided which team won a shared
//     league in a quarter of mock seasons, on one episode.
// Everything is on a x2 scale so the smallest step is 0.5 -- doubling changes no standings.
// Every value is a default: a league's own settings override it, and 0 switches a category off.
// Murdered stays 0: it usually means the Traitors saw you as a threat, and nobody can see it coming
// to bench you. Being banished either way, or walking out, costs points.
const events = [
  // --- Missions ---
  { id: 'shieldWon', label: 'Won a shield or immunity', defaultPoints: 2 },
  { id: 'wonPower', label: 'Won a mission power (Dagger, Seer...)', defaultPoints: 4 },
  { id: 'missionStandout', label: 'Credited with carrying a mission', defaultPoints: 2 },
  // Tracked, not scored: a shield given away is generosity or a Traitor's tell, and the data can't say which.
  { id: 'gaveShield', label: 'Gave their shield to someone else', defaultPoints: 0 },
  { id: 'missionBlunder', label: 'Blamed for a mission failure or lost money', defaultPoints: -1 },
  // --- Murder & the Turret ---
  { id: 'shieldSavedThem', label: 'Chosen for murder but saved by a shield', defaultPoints: 4 },
  { id: 'onMurderShortlist', label: 'On the murder shortlist and survived the night', defaultPoints: 1 },
  // Lower than a formal shortlist: recaps report the turret's options most weeks, so it's frequent.
  { id: 'consideredForMurder', label: 'Considered for murder by the Traitors and survived', defaultPoints: 0.5 },
  { id: 'declinedRecruitment', label: "Turned down the Traitors' offer", defaultPoints: 2 },
  { id: 'recruited', label: 'Recruited as a Traitor', defaultPoints: 4, implied: true },
  { id: 'murdered', label: 'Murdered', defaultPoints: 0, implied: true },
  // --- Round Table ---
  // Every banishment vote and every case that led to one scores by what the voter (or leader) and the
  // banished person were (banishmentVoteEvent, caseLeadEvent), so each side is credited for its own job.
  // Voting out a Faithful is good Traitor play, but for a Faithful it's 0, not a penalty: the average
  // Faithful casts 2 such votes a season, and penalising them made every measure worse. LEADING that
  // case is one person's deliberate push, so misleading the table does cost a little.
  { id: 'votedOutTraitor', label: 'As a Faithful, voted for a Traitor who was banished', defaultPoints: 4 },
  { id: 'turnedOnTraitor', label: 'As a Traitor, voted out a fellow Traitor', defaultPoints: { exclusive: 3, shared: 4 } },
  { id: 'traitorVotedOutFaithful', label: 'As a Traitor, voted for a Faithful who was banished', defaultPoints: { exclusive: 0.5, shared: 1 } },
  { id: 'votedOutFaithful', label: 'As a Faithful, voted for a Faithful who was banished', defaultPoints: 0 },
  { id: 'ledCaseAgainstTraitor', label: 'As a Faithful, led the case that banished a Traitor', defaultPoints: 2 },
  { id: 'ledCaseAgainstPartner', label: 'As a Traitor, led the case that banished a fellow Traitor', defaultPoints: 2 },
  { id: 'framedFaithful', label: 'As a Traitor, led the case that banished a Faithful', defaultPoints: 2 },
  { id: 'ledCaseAgainstFaithful', label: 'As a Faithful, led the case that banished a Faithful', defaultPoints: -1 },
  { id: 'accusedAtRoundTable', label: 'Accused at the Round Table and survived it', defaultPoints: 1 },
  { id: 'survivedRoundTable', label: 'Received banishment votes but survived', defaultPoints: 1 },
  { id: 'zeroVotes', label: 'At the Round Table, zero votes against', defaultPoints: 1 },
  { id: 'banishedAsFaithful', label: 'Banished as a Faithful', defaultPoints: -6, implied: true },
  { id: 'banishedAsTraitor', label: 'Banished as a Traitor (caught)', defaultPoints: -6, implied: true },
  // --- Leaving and the end ---
  { id: 'leftGame', label: 'Left the game', defaultPoints: -10, implied: true },
  { id: 'finalist', label: 'Reached the end as a Finalist', defaultPoints: 4, implied: true },
  // A Faithful who reached the end only to lose the pot to a Traitor. In 20 seasons that's every
  // finalist who didn't win (when the Faithfuls win, everyone left shares it), so without this the
  // finalist points were, in practice, points for being fooled. Nets a fooled finalist +2.
  { id: 'fooledToTheEnd', label: 'Finalist who lost to a Traitor (fooled to the end)', defaultPoints: -2, implied: true },
  // Banished in the finale (the last Round Table or the Fire of Truth) instead of the usual -6:
  // reaching the final handful is an achievement, the same reasoning as Survivor's lost fire-making.
  { id: 'banishedInFinale', label: 'Banished in the finale', defaultPoints: -2, implied: true },
  { id: 'seasonWinner', label: 'Won the season', defaultPoints: 6, implied: true },
  // On top of the win: Traitors won 12 of the 20 seasons studied, but rarely without a fight, and
  // usually alone. Smaller in an exclusive league, where one team owns the winner outright.
  { id: 'wonAsTraitor', label: 'Won the season as a Traitor (bonus)', defaultPoints: 2, implied: true },
];

// Events that follow from what an episode already records. `ctx.roleOf(castawayId, n)` is the role
// someone held as of episode n.
function impliedEvents(ep, ctx) {
  const out = [];
  const exits = ep.events || [];
  const role = (el) => ctx.roleOf(el.castawayId, ep.number);
  // The finale is the episode that crowns someone.
  const winners = exits.filter((el) => el.method === 'Winner');
  const traitorWon = winners.some((el) => role(el) === 'Traitor');
  for (const el of exits) {
    if (el.method === 'Murdered') out.push({ type: 'murdered', castawayId: el.castawayId });
    if (el.method === 'Finalist') {
      out.push({ type: 'finalist', castawayId: el.castawayId });
      if (traitorWon && role(el) !== 'Traitor') out.push({ type: 'fooledToTheEnd', castawayId: el.castawayId });
    }
    if (el.method === 'Winner') {
      out.push({ type: 'seasonWinner', castawayId: el.castawayId });
      if (role(el) === 'Traitor') out.push({ type: 'wonAsTraitor', castawayId: el.castawayId });
    }
    if (el.method === 'Banished') {
      const type = winners.length ? 'banishedInFinale' : role(el) === 'Traitor' ? 'banishedAsTraitor' : 'banishedAsFaithful';
      out.push({ type, castawayId: el.castawayId });
    }
    if (el.method === 'Left the game') out.push({ type: 'leftGame', castawayId: el.castawayId });
  }
  for (const r of ep.roles || []) {
    if (r.role === RECRUITED) out.push({ type: 'recruited', castawayId: r.castawayId });
  }
  return out;
}

// ---------- wiki (db/wiki-sync.js) ----------
// A season page carries two tables, both transcluded from per-season templates:
//   == Contestants ==    Template:US5 Contestant Info -- one row per person: Faction ("Traitor",
//                        "Traitor (from Episode 3)"), Result, Exit Episode, Finish. Clean; the source
//                        for exits and roles.
//   == Voting History == Template:US5 Voting History -- one column per Round Table (an episode can
//                        have several), a row per person, with who they voted for and cell classes
//                        for shields, immunity, the murder shortlist and so on. Messy; the source for
//                        votes and shields.

// Only shields are read as events. Round Table outcomes are derived from the votes (derivedEvents),
// and everything in `events` marked implied comes from exits and roles.
const wikiEventTypes = ['shieldWon'];

function episodesSchema(z) {
  const person = z.string().describe("The person's FULL name, as the Contestants table gives it.");
  return z.object({
    originalTraitors: z
      .array(z.object({ name: person }))
      .describe(
        "The Traitors chosen at the start of the season: everyone whose Faction is plain 'Traitor'. Not " +
          "anyone recruited later (their Faction reads 'Traitor (from Episode N)')."
      ),
    episodes: z.array(
      z.object({
        number: z.number().int().describe("Episode number, starting at 1."),
        title: z.string().nullable().describe("Episode title if given, without wiki link markup."),
        airDate: z.string().nullable().describe("Air date exactly as printed. Null if absent."),
        eliminations: z
          .array(
            z.object({
              name: person,
              method: z
                .enum(exitMethods)
                .describe(
                  "From the Contestants table's Result column: Banished -> Banished; Murdered -> Murdered; " +
                    "left, withdrew or was removed -> Left the game; Finalist or Runner-up -> Finalist; " +
                    "Winner -> Winner. Use Other only if none of these fit."
                ),
            })
          )
          .describe(
            "Everyone whose Exit Episode in the Contestants table is THIS episode, with their Result. " +
              "A murder and a banishment in the same episode are both listed; the finale usually has " +
              "several. Someone with no Result yet is still in the game -- leave them out."
          ),
        recruited: z
          .array(z.object({ name: person }))
          .describe(
            "Anyone who became a Traitor in THIS episode: their Faction reads 'Traitor (from Episode N)' " +
              "with N equal to this episode. Empty otherwise."
          ),
        roundTables: z
          .array(
            z.object({
              banished: z
                .string()
                .nullable()
                .describe("FULL name of the person banished at this Round Table, from the Banishment row. Null if nobody was."),
              votes: z
                .array(z.object({ voter: person, votedFor: person }))
                .describe(
                  "One entry per person who cast a vote at this Round Table: the row's person and the " +
                    "name in their cell. Skip cells that aren't a vote (No Vote, Banish Again, End Game, " +
                    "Murdered, blank)."
                ),
            })
          )
          .describe(
            "Each Round Table in this episode, in order -- one per Voting History column whose header is " +
              "this episode. An episode can have more than one (a 'Banish Again' round) or none."
          ),
        events: z
          .array(
            z.object({
              type: z.enum(wikiEventTypes),
              name: person,
              confidence: z
                .enum(["high", "low"])
                .describe("'high' only when a cell states it directly. 'low' for anything inferred."),
            })
          )
          .describe(
            "shieldWon: someone whose Voting History cell in this episode's column is marked Shielded " +
              "({{c|shield|...}}) or Immune ({{c|immune|...}}). Once per person per episode. Omit rather " +
              "than guess."
          ),
      })
    ),
  });
}

function episodesPrompt(terms) {
  return {
    system:
      "You extract structured data from MediaWiki wikitext about a season of The Traitors. Report only " +
      "what the wikitext actually states. Never infer, complete or correct anything from outside " +
      "knowledge of the show -- if a field isn't in the text, return null, and if you cannot tell whether " +
      "something happened, omit it rather than guessing.\n\n" +
      "The text contains more than one table, each marked with an HTML comment naming the template it " +
      `came from. The Contestants table has one row per ${terms.castaway}: Faction, Result, Exit Episode ` +
      "and Finish. It is the authority for who left, how, in which episode, and who was a Traitor. The " +
      "Voting History table has a column per Round Table and a row per person, and is the authority for " +
      "votes and shields. A season still airing has blank Result and Exit Episode cells for everyone " +
      "still in the game.\n\n" +
      "Voting History cells use {{c|<class>|<text>|<colspan>|<rowspan>}}. The column headers are episode " +
      "numbers, and one episode can span several columns: work out which episode each cell belongs to " +
      "from the header row's colspans before reporting it. Classes: shield = Shielded, immune = Immune " +
      "from banishment, trial = on the Traitors' murder shortlist, dagger = used a Dagger (their vote " +
      "counted twice -- still one vote entry), murder = Murdered, banf/bant = the Banishment row's " +
      "banished Faithful / Traitor, traitor/recruit = the person's row marker for an original / recruited " +
      "Traitor, ryes = accepted a recruitment offer, novote/na/notingame = nothing to report.\n\n" +
      "The Voting History uses short names ('Rob R', 'Yam Yam'). Always report the FULL name from the " +
      "Contestants table for every person, including voters and the people they voted for.",
    user:
      "Extract the per-episode record for this season: who left each episode and how, who became a " +
      "Traitor, each Round Table's votes and banishment, and who held a shield or immunity.",
  };
}

// A vote for the banished person, by what the voter and the banished person were. Shared by the wiki
// read and research so both score a vote the same way. Either role unknown: no event, never a guess.
function banishmentVoteEvent(voterIsTraitor, banishedIsTraitor) {
  return roleOutcome(voterIsTraitor, banishedIsTraitor, {
    traitorOnTraitor: 'turnedOnTraitor', faithfulOnTraitor: 'votedOutTraitor',
    traitorOnFaithful: 'traitorVotedOutFaithful', faithfulOnFaithful: 'votedOutFaithful',
  });
}

// The same four outcomes for whoever led the case (research's accusedBy) against the banished person.
function caseLeadEvent(leaderIsTraitor, banishedIsTraitor) {
  return roleOutcome(leaderIsTraitor, banishedIsTraitor, {
    traitorOnTraitor: 'ledCaseAgainstPartner', faithfulOnTraitor: 'ledCaseAgainstTraitor',
    traitorOnFaithful: 'framedFaithful', faithfulOnFaithful: 'ledCaseAgainstFaithful',
  });
}

function roleOutcome(actorIsTraitor, banishedIsTraitor, types) {
  if (typeof actorIsTraitor !== 'boolean' || typeof banishedIsTraitor !== 'boolean') return null;
  if (actorIsTraitor) return banishedIsTraitor ? types.traitorOnTraitor : types.traitorOnFaithful;
  return banishedIsTraitor ? types.faithfulOnTraitor : types.faithfulOnFaithful;
}

// Round Table outcomes, derived from the extracted votes rather than asked for, so they're only as
// wrong as the vote read itself. `same(a, b)` compares two names by who they resolve to.
function derivedEvents(ep, extracted, same) {
  const out = [];
  const traitors = [
    ...(extracted.originalTraitors || []).map((t) => t.name),
    ...(extracted.episodes || []).filter((e) => e.number <= ep.number).flatMap((e) => (e.recruited || []).map((r) => r.name)),
  ];
  const isTraitor = (name) => traitors.some((t) => same(t, name));
  const leftThisEpisode = (ep.eliminations || []).map((el) => el.name);
  const left = (name) => leftThisEpisode.some((n) => same(n, name));
  const survived = [];
  const voters = [];
  const targeted = [];
  for (const rt of ep.roundTables || []) {
    for (const v of rt.votes || []) {
      if (v.voter && !voters.some((n) => same(n, v.voter))) voters.push(v.voter);
      const target = v.votedFor;
      if (target) targeted.push(target);
      if (!target || (rt.banished && same(target, rt.banished))) continue;
      if (left(target) || survived.some((n) => same(n, target))) continue;
      survived.push(target);
    }
    if (rt.banished) {
      for (const v of rt.votes || []) {
        if (!v.votedFor || !same(v.votedFor, rt.banished)) continue;
        const type = banishmentVoteEvent(isTraitor(v.voter), isTraitor(rt.banished));
        if (type) out.push({ type, name: v.voter, confidence: 'low' });
      }
    }
  }
  for (const name of survived) out.push({ type: 'survivedRoundTable', name, confidence: 'low' });
  for (const name of voters) {
    if (!left(name) && !targeted.some((t) => same(t, name))) out.push({ type: 'zeroVotes', name, confidence: 'low' });
  }
  return out;
}

// Role facts from the read: originals at episode 1, recruits at the episode they turned.
function wikiRoles(extracted) {
  return [
    ...(extracted.originalTraitors || []).map((t) => ({ episode: 1, name: t.name, role: ORIGINAL })),
    ...(extracted.episodes || []).flatMap((e) => (e.recruited || []).map((r) => ({ episode: e.number, name: r.name, role: RECRUITED }))),
  ];
}

// ---------- research (db/episode-research.js) ----------
// The main source for this show: trusted recap sites, read through the research call or the copy-paste
// prompt. docs/RESEARCH-traitors-events.md has which facts recaps report reliably and why. As with the
// wiki, the checklist asks for what the recaps SAY (who voted for whom, who accused whom, who's a
// Traitor), and the Round Table outcomes are worked out in code (researchItems), not asked for.

const checklist = [
  { key: 'name', type: 'string', description: "The contestant's full name, exactly as given in the list you were sent." },

  // --- leaving the game ---
  {
    key: 'leftTheGame', type: 'answer',
    description:
      "Did this person leave the game permanently in THIS episode (murdered, banished, left, or the " +
      "finale)?",
  },
  {
    key: 'exitMethod', type: 'exitMethod', nullable: true,
    description: "How they left, if they left. Null if they did not leave.",
  },

  // --- roles ---
  {
    key: 'isTraitor', type: 'answer',
    description:
      "Was this person a Traitor at this episode's Round Table (or, with no Round Table, by the end of " +
      "the episode)? Recaps tell the audience who the Traitors are, including anyone recruited. 'no' " +
      "for a Faithful.",
  },
  {
    key: 'becameTraitor', type: 'answer',
    description:
      "Did they START playing as a Traitor in THIS episode by being chosen by the host, or by entering " +
      "the game as a Traitor? Not someone recruited by the other Traitors (that's recruitedAsTraitor), " +
      "and 'no' for someone who was already a Traitor before this episode.",
  },
  {
    key: 'recruitedAsTraitor', type: 'answer',
    description: "Did they become a Traitor this episode by accepting a recruitment offer or an ultimatum?",
  },
  {
    key: 'declinedRecruitment', type: 'answer',
    description: "Did they turn DOWN a recruitment offer from the Traitors this episode and stay a Faithful?",
  },

  // --- the Round Table ---
  { key: 'attendedRoundTable', type: 'answer', description: "Did they attend a Round Table this episode?" },
  {
    key: 'votesReceived', type: 'integer', nullable: true,
    description:
      "How many banishment votes were cast against them this episode. 0 if they attended and got none. " +
      "Only when a source gives the count or every vote; null if it only gives the winning margin, or " +
      "no Round Table.",
  },
  {
    key: 'votedFor', type: 'stringList', nullable: true,
    description:
      "Everyone they voted to banish this episode, one per banishment vote in order (a finale can have " +
      "several: the Round Table, then each Banish Again). If there was a revote, their vote in the " +
      "FINAL round. Empty if they didn't vote. Only votes a source attributes to them. Each written " +
      "exactly as that person's name appears in the list you were sent. Null if unknown.",
  },
  {
    key: 'accusedBy', type: 'stringList', nullable: true,
    description:
      "Who made a case against them AT the Round Table this episode: named them as a suspect and argued " +
      "for it. Not castle gossip away from the table, and not just a vote cast without saying why. " +
      "Empty if nobody did. Each written exactly as that person's name appears in the list you were " +
      "sent. Null if unknown.",
  },

  // --- missions ---
  {
    key: 'wonShield', type: 'answer',
    description:
      "Did they hold a shield, immunity or an antidote protecting them from murder this episode -- won " +
      "in the mission, given to them by another player, or passed to them in a chain of safety?",
  },
  {
    key: 'gaveShield', type: 'answer',
    description: "Did they give a shield they had won or controlled to SOMEONE ELSE this episode?",
  },
  {
    key: 'wonPower', type: 'answer',
    description: "Did they win a special power in a mission this episode (the Dagger, the Seer, or a new one)?",
  },
  { key: 'powerName', type: 'string', nullable: true, description: "The power they won, in the show's own words. Null if none." },
  {
    key: 'missionStandout', type: 'answer',
    description:
      "Does a source credit them with carrying this episode's mission (the key player behind its " +
      "success)? Only what a recap says, not your judgement.",
  },
  {
    key: 'missionBlunder', type: 'answer',
    description:
      "Does a source blame them for a mission failure or lost money this episode (eliminated first, " +
      "quit early, a wrong answer that cost the pot)? Only what a recap says, not your judgement.",
  },

  // --- murder ---
  {
    key: 'onMurderShortlist', type: 'answer',
    description:
      "Were they on a formal murder shortlist or at-risk pool the show named this episode (the " +
      "Traitors' shortlist, the coffins, the cage, the people left unprotected)? Not just anyone " +
      "without a shield.",
  },
  {
    key: 'consideredForMurder', type: 'answer',
    description:
      "Was this person, a Faithful, reported as one of the options the Traitors discussed murdering " +
      "this episode, apart from any formal shortlist? Only when a recap names them.",
  },
  {
    key: 'shieldSavedThem', type: 'answer',
    description: "Did the Traitors choose to murder them this episode, only for a shield to block it?",
  },
  {
    key: 'notableTwist', type: 'string', nullable: true,
    description:
      "Any other notable, checkable thing that happened to this person this episode, in one short " +
      "phrase. Null if nothing.",
  },

  // --- provenance, per person ---
  {
    key: 'sources', type: 'stringList',
    description:
      "URLs you actually read that support the answers above for THIS person. Empty only if every " +
      "answer is 'unknown'.",
  },
  {
    key: 'confidence', type: 'enum', values: ['high', 'medium', 'low'],
    description:
      "high: a source states it plainly. medium: a source implies it. low: pieced together or a single " +
      "weak source.",
  },
];

const episodeFields = [
  { key: 'roundTableHeld', type: 'answer' },
  { key: 'murderHappened', type: 'answer' },
];

const researchSearchHint = [
  "Search for this episode's recaps. Look for: who was murdered and banished, and whether they were",
  "Traitors; who voted for whom and who made the case against whom at the Round Table; the mission,",
  "who held shields, and who the recaps credit or blame for it; any murder shortlist and who the",
  "Traitors considered murdering; and any recruitment. Then answer the checklist for every person above.",
  "",
  "An event belongs to the episode where its outcome is REVEALED. A vote that ends on a cliffhanger",
  "belongs to the episode that shows who was banished; a recruitment offered at the end of one episode",
  "and accepted in the next belongs to the next; a shortlist whose murder is revealed next episode",
  "belongs to the next.",
];

// A list answer as a list. A research run from before votedFor took several names stored it as one.
const listOf = (v) => (Array.isArray(v) ? v : v ? [v] : []).filter(Boolean);

// What research says someone was, from any answer that settles it: true, false or null (unknown).
function traitorAnswer(entry) {
  if (entry.isTraitor === "yes" || entry.recruitedAsTraitor === "yes" || entry.becameTraitor === "yes") return true;
  if (entry.isTraitor === "no") return false;
  return null;
}

function researchEntryProblems(entry) {
  const problems = [];
  const n = entry.name;
  if (entry.attendedRoundTable === "no" && Number.isInteger(entry.votesReceived) && entry.votesReceived > 0) {
    problems.push(`${n}: ${entry.votesReceived} votes against someone who didn't attend the Round Table`);
  }
  if (entry.attendedRoundTable === "no" && listOf(entry.votedFor).length) {
    problems.push(`${n}: a vote from someone who didn't attend the Round Table`);
  }
  if (entry.wonShield === "yes" && entry.exitMethod === "Murdered") {
    problems.push(`${n}: murdered despite holding a shield`);
  }
  if (entry.shieldSavedThem === "yes" && entry.wonShield !== "yes") {
    problems.push(`${n}: saved by a shield they aren't marked as holding`);
  }
  if (entry.isTraitor === "yes") {
    for (const k of ["onMurderShortlist", "consideredForMurder", "shieldSavedThem"]) {
      if (entry[k] === "yes") problems.push(`${n}: ${k} for a Traitor (not scored)`);
    }
  }
  if (entry.becameTraitor === "yes" && entry.recruitedAsTraitor === "yes") {
    problems.push(`${n}: both chosen as a Traitor and recruited -- it's one or the other`);
  }
  if (entry.declinedRecruitment === "yes" && entry.recruitedAsTraitor === "yes") {
    problems.push(`${n}: both turned down and accepted recruitment`);
  }
  if (entry.missionStandout === "yes" && entry.missionBlunder === "yes") {
    problems.push(`${n}: both carried and blamed for the mission`);
  }
  if (entry.wonPower === "yes" && !entry.powerName) {
    problems.push(`${n}: won a power but didn't say which`);
  }
  return problems;
}

const researchClaims = [
  "leftTheGame", "wonShield", "becameTraitor", "recruitedAsTraitor", "declinedRecruitment", "gaveShield", "wonPower",
  "missionStandout", "missionBlunder", "onMurderShortlist", "consideredForMurder", "shieldSavedThem",
];

// Exits aren't staged from here (episode-research.js stages the elimination itself), so neither are
// the events they imply. The Round Table outcomes need everyone's answers: `ctx.payload` is the whole
// episode, and `ctx.same(a, b)` compares names by who they resolve to.
function researchItems(entry, add, ctx) {
  const traitor = traitorAnswer(entry);
  const stayed = entry.leftTheGame !== "yes";
  const everyone = (ctx && ctx.payload && ctx.payload.castaways) || [];
  const same = (ctx && ctx.same) || ((a, b) => String(a).trim().toLowerCase() === String(b).trim().toLowerCase());

  if (entry.becameTraitor === "yes" && entry.recruitedAsTraitor !== "yes") add("role", "", ORIGINAL);
  if (entry.recruitedAsTraitor === "yes") add("role", "", RECRUITED);
  if (entry.declinedRecruitment === "yes") add("event", "declinedRecruitment");

  if (entry.wonShield === "yes") add("event", "shieldWon");
  if (entry.gaveShield === "yes") add("event", "gaveShield");
  if (entry.wonPower === "yes") add("event", "wonPower");
  if (entry.missionStandout === "yes") add("event", "missionStandout");
  if (entry.missionBlunder === "yes") add("event", "missionBlunder");

  // Danger from the Traitors only means something for a Faithful who lived through the night.
  if (traitor !== true && stayed) {
    if (entry.shieldSavedThem === "yes") add("event", "shieldSavedThem");
    if (entry.onMurderShortlist === "yes") add("event", "onMurderShortlist");
    else if (entry.consideredForMurder === "yes") add("event", "consideredForMurder");
  }

  if (typeof entry.votesReceived === "number" && entry.votesReceived > 0 && stayed) add("event", "survivedRoundTable");
  if (entry.attendedRoundTable === "yes" && entry.votesReceived === 0 && stayed) add("event", "zeroVotes");
  if (listOf(entry.accusedBy).length && stayed) add("event", "accusedAtRoundTable");

  const banished = everyone.filter((c) => c.leftTheGame === "yes" && c.exitMethod === "Banished");
  for (const target of listOf(entry.votedFor)) {
    const b = banished.find((c) => same(c.name, target));
    const type = b && banishmentVoteEvent(traitor, traitorAnswer(b));
    if (type) add("event", type);
  }
  for (const b of banished) {
    if (!listOf(b.accusedBy).some((a) => same(a, entry.name))) continue;
    const type = caseLeadEvent(traitor, traitorAnswer(b));
    if (type) add("event", type);
  }
}

// One person's answers as short phrases for a reviewer, listing only what happened.
function researchNotes(c) {
  const notes = [];
  const votes = listOf(c.votedFor);
  const accusers = listOf(c.accusedBy);
  if (c.leftTheGame === "yes") notes.push(`OUT — ${c.exitMethod || "method unknown"}`);
  if (c.isTraitor === "yes") notes.push("Traitor");
  if (c.becameTraitor === "yes") notes.push("chosen as a Traitor");
  if (c.recruitedAsTraitor === "yes") notes.push("became a Traitor");
  if (c.declinedRecruitment === "yes") notes.push("turned down recruitment");
  if (typeof c.votesReceived === "number" && c.votesReceived > 0) notes.push(`${c.votesReceived} vote${c.votesReceived === 1 ? "" : "s"} against`);
  if (votes.length) notes.push(`voted ${votes.join(", then ")}`);
  if (accusers.length) notes.push(`accused by ${accusers.join(", ")}`);
  if (c.wonShield === "yes") notes.push("shield / immunity");
  if (c.gaveShield === "yes") notes.push("gave a shield away");
  if (c.wonPower === "yes") notes.push(`won ${c.powerName || "a power"}`);
  if (c.missionStandout === "yes") notes.push("carried the mission");
  if (c.missionBlunder === "yes") notes.push("blamed for the mission");
  if (c.onMurderShortlist === "yes") notes.push("on the murder shortlist");
  if (c.consideredForMurder === "yes") notes.push("considered for murder");
  if (c.shieldSavedThem === "yes") notes.push("shield blocked a murder");
  if (c.notableTwist) notes.push(c.notableTwist);
  return notes;
}

// The same, as sentences, for semantic search (db/embeddings.js).
function researchSentences(c) {
  const notes = [];
  const votes = listOf(c.votedFor);
  const accusers = listOf(c.accusedBy);
  if (c.leftTheGame === "yes") notes.push(`left the game (${c.exitMethod || "method unknown"})`);
  if (c.becameTraitor === "yes") notes.push("was chosen as a Traitor");
  if (c.recruitedAsTraitor === "yes") notes.push("became a Traitor");
  if (c.declinedRecruitment === "yes") notes.push("turned down the Traitors' recruitment offer");
  if (typeof c.votesReceived === "number" && c.votesReceived > 0) notes.push(`received ${c.votesReceived} vote(s) at the Round Table`);
  if (votes.length) notes.push(`voted for ${votes.join(", then ")}`);
  if (accusers.length) notes.push(`was accused at the Round Table by ${accusers.join(", ")}`);
  if (c.wonShield === "yes") notes.push("won a shield or immunity");
  if (c.gaveShield === "yes") notes.push("gave their shield to someone else");
  if (c.wonPower === "yes") notes.push(`won ${c.powerName || "a mission power"}`);
  if (c.missionStandout === "yes") notes.push("carried the mission");
  if (c.missionBlunder === "yes") notes.push("was blamed for a mission failure");
  if (c.onMurderShortlist === "yes") notes.push("was on the murder shortlist");
  if (c.consideredForMurder === "yes") notes.push("was considered for murder by the Traitors");
  if (c.shieldSavedThem === "yes") notes.push("was saved from murder by a shield");
  if (c.notableTwist) notes.push(c.notableTwist);
  return notes;
}

// The data half (see define.js): plain JSON that a database row could hold.
const data = {
  id: 'traitors',
  name: 'The Traitors',
  exitMethods,
  // What a new show on these rules calls its people and groups, until an admin says otherwise.
  terms: { castaway: 'Contestant', tribe: 'Team' },
  winnerExitMethod: 'Winner',
  // Exits that mean reaching the end, not being knocked out: shown as finishers, never dimmed as out.
  endgameExitMethods: ['Finalist', 'Winner'],
  events,
  // Groups for "How starters score" (active-roster-lineup-grid.tsx), in this order.
  eventCategories: [
    { id: 'missions', label: 'Missions', events: ['shieldWon', 'wonPower', 'missionStandout', 'gaveShield', 'missionBlunder'] },
    { id: 'turret', label: 'Murder & the Turret', events: ['shieldSavedThem', 'onMurderShortlist', 'consideredForMurder', 'recruited', 'declinedRecruitment', 'murdered'] },
    {
      id: 'roundTable',
      label: 'Round Table',
      events: [
        'votedOutTraitor', 'turnedOnTraitor', 'traitorVotedOutFaithful', 'votedOutFaithful',
        'ledCaseAgainstTraitor', 'ledCaseAgainstPartner', 'framedFaithful', 'ledCaseAgainstFaithful',
        'accusedAtRoundTable', 'survivedRoundTable', 'zeroVotes', 'banishedAsFaithful', 'banishedAsTraitor',
      ],
    },
    { id: 'leaving', label: 'Leaving the game', events: ['leftGame'] },
    { id: 'endgame', label: 'Endgame', events: ['seasonWinner', 'wonAsTraitor', 'finalist', 'fooledToTheEnd', 'banishedInFinale'] },
  ],
  // An episode's headline wins, at the top of its Recap (episode-recap.tsx).
  recap: [{ label: 'Shield', events: ['shieldWon'] }],
  hasMerge: false,
  hasGroups: false,
  roles: {
    // What everyone is until a role decision says otherwise.
    default: 'Faithful',
    values: [ORIGINAL, RECRUITED],
  },
  wiki: {
    voteSections: ["Voting History", "Vote History", "Voting"],
    // The "guide" half here is the Contestants table: exits, results and factions.
    guideSections: ["Contestants", "Contestant Info", "Cast", "Players"],
    missingVotesNote: "no voting table found -- shields and Round Table votes will be missing",
    missingGuideNote: "no contestants table found -- exits and Traitors will be missing",
    // Faction is a secret role, not a grouping -- read as one it would hand every league the list of
    // Traitors as "tribes" the moment the cast is approved.
    castNote:
      "The Faction column (Traitor / Faithful) is a secret role, NOT a group: never report it as a tribe " +
      "or as anyone's tribeName. This show has no groups unless the table has a separate team column.",
    eventTypes: wikiEventTypes,
    // A murder and a banishment is an ordinary episode here, so only flag more than that.
    routineEliminations: 2,
  },
  research: {
    checklist,
    episodeFields,
    searchHint: researchSearchHint,
    claims: researchClaims,
  },
};

module.exports = defineFormat(data, {
  impliedEvents,
  roles: {
    // Which role a recorded value makes someone.
    roleFor: () => 'Traitor',
  },
  wiki: {
    episodesSchema,
    episodesPrompt,
    rejectEvent: () => null,
    derivedEvents,
    roles: wikiRoles,
  },
  research: {
    entryProblems: researchEntryProblems,
    items: researchItems,
    notes: researchNotes,
    sentences: researchSentences,
  },
});
