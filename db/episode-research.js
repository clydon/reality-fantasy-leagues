// Episode research: asking a model a fixed CHECKLIST about every castaway, with WEB SEARCH, instead
// of parsing the wiki's tables.
//
// This is the second of two sources, deliberately kept separate from db/wiki-sync.js rather than
// folded into it (db/migrations/0014 explains the split). The tables are the better source for what
// they hold; this exists for everything they don't hold -- idol finds, sit-outs, advantages played,
// twists -- which is tier D in docs/RESEARCH-extractable-stats.md and which the table connector
// correctly reports nothing about. Those are the moments a fantasy league most wants to score.
//
// Four design choices carry the whole thing:
//
//   1. A CHECKLIST, NOT AN EXTRACTION. Every castaway gets an entry whether or not anything happened
//      to them. Coverage is then structural: a missing person is a missing array element, which
//      validation catches, instead of an absence nobody can see. That is the bug this repo has hit
//      twice -- a castaway who took votes and survived produced no "event", so she silently
//      disappeared from review.
//
//   2. THREE-VALUED ANSWERS. Every categorical answer is yes / no / unknown. "No" means the research
//      looked and it didn't happen; "unknown" means it couldn't be established. Collapsing those two
//      into false is what turns a gap in the sources into a confident wrong answer, and it is what a
//      reviewer most needs to be able to see.
//
//   3. SOURCES ON EVERY ANSWER. A web search is not reproducible -- run it tomorrow and it reads
//      different pages -- so unlike a wiki extraction there is no revision id to point at. Each
//      castaway's entry carries the URLs it was drawn from, and the run records every page the
//      search actually read. Nothing here is scored until a human confirms it; the sources are what
//      they check against, so they are load-bearing, not metadata.
//
//   4. THE SEARCH PROVIDER IS SWAPPABLE. Anthropic, Gemini and Grok all sell a model that can search
//      the live web, and which of them is best at finding a recap of last night's episode is an
//      empirical question nobody here has answered yet -- so it is a config value, not a code
//      decision. The checklist, the prompt, the validation and the cache are shared; only the ~40
//      lines that phrase the request differ per provider. Cross-checking two providers against the
//      same episode is then a flag, which is the cheapest quality measurement available.
//
// Cost, honestly: search results enter the context as input tokens, so this is dearer per episode
// than the table extraction (roughly $0.10-0.40 against ~$0.25 for a whole season of tables, at
// claude-opus-5 rates). It buys facts that are not otherwise obtainable, and it is per-episode, so a
// season in progress costs one episode's research a week rather than a re-read of everything.
//
//   node db/episode-research.js <leagueId> <episode> [--dry] [--force] [--provider=x] [--model=y]
//
// --dry prints the checklist and writes nothing, which is how to judge quality before trusting it.

require("dotenv").config({ path: ".env.local", quiet: true });
const { Pool } = require("pg");
const Anthropic = require("@anthropic-ai/sdk");
const decisions = require("./season-decisions.js");
const { zodOutputFormat } = require("@anthropic-ai/sdk/helpers/zod");
const { z } = require("zod");
const { termsFor } = require("./wiki-sync.js");
const StateLogic = require("../src/lib/game/state-logic.js");
// The show's game rules (docs/PLAN-show-formats.md): what the checklist asks, which contradictions to
// flag, and which answers become which results are the format's. The run, the providers, the
// coverage rules and the cache are the same for every format.
const Formats = require("../src/lib/game/formats/index.js");
const Review = require("../src/lib/game/formats/research-review.js");
const ShowFormats = require("./show-formats.js");
// A season's approved rule changes (docs/PLAN-season-rule-changes.md): research asks what the season's
// rules ask by the episode it's researching, not just what the show's format asks.
const SeasonRuleChanges = require("./season-rule-changes.js");
const Rulebooks = require("./rulebooks.js");
const embeddings = require("./embeddings.js");
const Air = require("../src/lib/game/air-schedule.js");
// The format section (F2): how the game is organised at each episode's end, its vocabulary and our reading of it.
const FormatStates = require("../src/lib/game/formats/format-state.js");
// The format's state over time (F3): what the context reads of it (the groups going in, the newcomers still in, the season's
// word for its groups), built on read from the season's stored research.
const Timeline = require("../src/lib/game/formats/format-timeline.js");
const FormatTimelines = require("./format-timeline.js");

// ---------- the checklist ----------
// Deliberately three-valued. `unknown` is not a failure state, it is the honest answer when the
// sources don't say, and it is the difference between "this didn't happen" and "we couldn't tell".
const Answer = z.enum(["yes", "no", "unknown"]);

// The whole answer for one episode: a few episode-level fields, then one checklist entry per person.
// The checklist itself is the format's (format.research.checklistSchema); its exit methods are a hard
// enum for the same reason wiki-sync.js's are -- the value is written onto castaway.exitMethod.
//
// `withBets` adds the leagues' open side bets (see openBetsFor). Only then: a run with no bets to
// answer asks exactly what it always has.
//
// `rulesNote` is every format's, not any one format's data: research's own flag that the show may have
// changed how it's played this season (docs/PLAN-season-rule-changes.md). A non-empty one shows on the
// season's Rules row in Admin as the cue to run "check for rule changes"; nothing else reads it, and it
// never scores. Its wording is the whole design -- see RULES_NOTE.
//
// Group changes and the merge are every grouped format's too, asked here rather than in each format's
// checklist. They used to come only from the wiki's tables; since that read was retired (cast only),
// research is their one source, so one paste covers a swap episode without a second prompt.
//
// `formatState` (F2, docs/STUDY-format-changes.md) is every show's: how the game is organised at the END of
// the episode (who is grouped with whom, how it was played, its phase) and what changed in it, as data. Since
// F3 each person's group move is worked out from it (FormatStates.movesFromState, in validateResearch), so
// beside it `newGroup` asks only for someone who moved and then went home in the same episode, whom the
// groups at the end can't hold; a pass about some of the cast, which leaves the section out (a
// commissioner's paste, formatForAsking), asks it of everyone as before. F2's proof: newGroup named a new
// tribe for 7 of the 27 people who changed one, and partners' names as groups on The Challenge; the section
// had every tribe right. `merged` stays asked beside it (it was right, the phase cues read it, and the
// timeline crosses it with the state's merge). A cut-down ask (onlyFormat) leaves the section out, as it
// does the groups and the merge.
// `word`: the season's word for its groups when the timeline says it (F3 part 2, the context's groupWord: tribe or team);
// the format's own without it.
function researchSchemaFor(format, withBets = false, word = null) {
  const group = (word || (format.terms && format.terms.tribe) || "tribe").toLowerCase();
  let entry = format.research.checklistSchema(z, Answer);
  if (format.hasGroups) entry = entry.extend({ newGroup: z.string().nullable().describe(asksFormat(format) ? leftFromText(group) : newGroupText(group)) });
  return z.object({
    episodeTitle: z.string().nullable(),
    airDate: z.string().nullable().describe("As printed on the source, e.g. 'March 5, 2026'."),
    nextEpisode: NextEpisode,
    summary: z.string().describe("Two or three sentences on what happened this episode, for a human reviewer to orient on."),
    ...format.research.episodeFields(z, Answer),
    ...(format.hasMerge ? { merged: Answer.describe(mergedText(group)) } : {}),
    rulesNote: z.string().nullable().describe(RULES_NOTE),
    ...(asksFormat(format) ? { formatState: FormatState } : {}),
    sourcesRead: SourcesRead,
    castaways: z
      .array(entry)
      .describe("EXACTLY ONE ENTRY PER CASTAWAY in the list you were sent, in that same order, including anyone nothing happened to."),
    ...(withBets ? { betAnswers: BetAnswers } : {}),
  });
}

// Just some of the checklist (docs/PLAN-maker-scoring.md step 5): a question added after episodes were looked up is asked of
// those episodes alone, merged into their stored answers. The core fields every answer has (formats/checklist.js CORE_FIELDS)
// stay, so who's who and how sure still come with it; the episode's own questions, groups and the merge aren't asked again.
const { CORE_FIELDS } = require("../src/lib/game/formats/checklist.js");

/** The per-person questions a format asks, besides the core ones every answer has. Pure. */
function checklistKeys(format) {
  return Object.keys(format.research.checklistSchema(z, Answer).shape).filter((k) => !(k in CORE_FIELDS));
}

/**
 * Of a format's questions, the ones a stored episode answer has nothing for (asked before the question was added), that
 * something scores from: one asked besides (what was found, anything else notable) isn't worth asking an episode again for.
 * Pure.
 */
function unaskedKeys(format, payload) {
  const have = new Set(((payload && payload.castaways) || []).flatMap((c) => (c && typeof c === "object" ? Object.keys(c) : [])));
  const rules = format.data ? JSON.stringify(format.data.rules || {}) : null;
  return checklistKeys(format).filter((k) => !have.has(k) && (rules === null || rules.includes(JSON.stringify(k))));
}

/** The format asking only `keys` (and the core fields) of each person. Pure. */
function onlyFormat(format, keys) {
  const want = new Set([...Object.keys(CORE_FIELDS), ...keys]);
  const checklistSchema = (zz, A) => {
    const entry = format.research.checklistSchema(zz, A);
    return entry.pick(Object.fromEntries(Object.keys(entry.shape).filter((k) => want.has(k)).map((k) => [k, true])));
  };
  return { ...format, hasGroups: false, hasMerge: false, asksFormat: false, research: { ...format.research, checklistSchema, episodeFields: () => ({}) } };
}

/** Whether research asks a format the format section (every format does, but a cut-down ask: onlyFormat). */
const asksFormat = (format) => !!format && format.asksFormat !== false;

/**
 * The format to ask some of the cast with: the format section is about the whole cast (who is with whom), so a pass asked
 * about only some of them (a commissioner's paste for whoever the stored answers don't settle) leaves it out, and the stored
 * section stays as the whole-cast pass said it.
 */
function formatForAsking(ctx, asking) {
  return asking.length < ctx.castNames.length ? { ...ctx.format, asksFormat: false } : ctx.format;
}

/** A group's word in the plural: tribes, teams, agencies (not "agencys"), matches. */
function plural(word) {
  const w = String(word);
  if (/[^aeiou]y$/i.test(w)) return w.slice(0, -1) + "ies";
  if (/(s|x|z|ch|sh)$/i.test(w)) return w + "es";
  return w + "s";
}

const newGroupText = (group) =>
  `Only if their ${group} CHANGED in this episode -- a swap, a re-division into new ${plural(group)}, a ${group} ` +
  `dissolved, or the merge: the ${group} they are on at the END of this episode, exactly as the show names ` +
  `it (the merged ${group}'s name at the merge). Compare against the ${group} shown next to their name in ` +
  `the list you were sent. Null if they are still on that ${group}. Someone who moved and then left the ` +
  `game in this same episode (swapped, then voted out) still moved: give the ${group} they left from.`;

// Beside the format section (F3): its groups at the end say everyone else's group, so newGroup is only for whoever they
// can't hold.
const leftFromText = (group) =>
  `Only for someone who moved to another ${group} in this episode AND went home in it (swapped, then voted out): the ` +
  `${group} they went home from, exactly as the show names it. Null for everyone else: who is with whom at the end ` +
  `goes in formatState.`;

const mergedText = (group) =>
  `Is the game merged by the end of this episode -- the ${plural(group)} have become one group, in this episode ` +
  `or an earlier one? 'yes' from the merge episode on.`;

// The format section's words (F2). Every show's, in the same words: the groups are "tribes, teams or pairs" and
// the season's own names for them, never a format's built-in term for its groups (The Challenge's "agency",
// which F1 found the prompt asking about on seasons played in pairs). The study's proposals, for the user to
// approve when F2 merges: docs/STUDY-format-changes.md.
const KIND_WORDS =
  "'teams-formed' (people now play as teams or tribes, after playing some other way), 'pairs-formed' (people now " +
  "play in pairs, after playing some other way), 'split-into-individuals' (the groups ended: everyone for " +
  "themselves), 'merge' (the groups became one), 'swap' (people moved between groups of the same kind: a few of " +
  "them, or every group drawn again, as when the pairs are re-drawn), 'newcomer' (someone new " +
  "joined the game), 'new-phase' (the season moved into a stage of its own: a final, a new part of the game), " +
  "'twist' (a rule changed how the game is played, not who is with whom), 'role' (someone's secret role changed)";

const FormatState = z
  .object({
    playedAs: z
      .enum(FormatStates.PLAYED_AS)
      .describe(
        "How THIS episode's main challenge or vote treated people: 'everyone' (all together, as one), 'tribes', 'teams', " +
          "'pairs', 'individuals' (each for themselves), 'mixed' (more than one of these), 'none' (no game was played: a " +
          "reunion, a recap), or 'unknown'."
      ),
    phase: z
      .string()
      .nullable()
      .describe("The show's own name for the stage the game is in at the end of this episode ('pre-merge', 'the final'), or null if it has none."),
    groups: z
      .array(
        z.object({
          name: z.string().nullable().describe("The group's name as the show gives it (a tribe's or a team's), or null (pairs usually have none)."),
          members: z.array(z.string()).describe("Everyone in it, by the names in the list (a newcomer by their full name)."),
        })
      )
      .nullable()
      .describe(
        "Who is grouped with whom at the END of this episode, going INTO the next one: every tribe, team or pair the show " +
          "has now. A re-pairing or a swap at the episode's end counts; one the show only announced for later doesn't yet. " +
          "An empty list if everyone now plays for themselves (or as one group); null only if your sources don't say who " +
          "is with whom."
      ),
    alone: z
      .array(z.string())
      .describe("Anyone still in the game who is in none of those groups at the end of this episode (unpaired, sitting out). Empty if there's nobody, or no groups."),
    newcomers: z
      .array(
        z.object({
          name: z.string().describe("Their full name."),
          replaces: z.string().nullable().describe("Who they came in for, by the name in the list, or null."),
          group: z.string().nullable().describe("The group they joined (its name, or a member's name), or null."),
        })
      )
      .describe("Anyone who joined the game in this episode and isn't in the list (an alternate, a returning player). Empty if nobody did."),
    wentHomeAs: z
      .enum(FormatStates.WENT_HOME_AS)
      .describe("How people left the game this episode: 'individuals' (each on their own), 'groups' (a whole pair or team went home together), 'nobody', or 'unknown'."),
    changes: z
      .array(
        z.object({
          kind: z.enum(FormatStates.KINDS).describe(`What kind of change: ${KIND_WORDS}.`),
          when: z
            .enum(FormatStates.WHEN)
            .nullable()
            .describe("When in this episode it came in: 'start', 'mid' (partway through), or 'end' (after the elimination, going into the next one)."),
          from: z
            .number()
            .int()
            .nullable()
            .describe("The episode it takes effect from: this episode's number for a change at its start or partway through, the next one's for a change at its end, a later one's if the show announced it ahead."),
          what: z.string().describe("One sentence on what changed."),
          sure: z
            .enum(FormatStates.SURE)
            .describe("'high' if a source says it plainly (for a grouping change, who is now with whom); 'low' if it's pieced together or the sources don't say who is with whom."),
        })
      )
      .describe(
        "Every change this episode made to who is grouped with whom or to how the game is played, each once (a change " +
          "announced here for a later episode too). Empty if nothing changed, as in most episodes. Not someone going home " +
          "(that's in their entry), unless it changed the groups."
      ),
  })
  .nullable()
  .describe("How the game is organised at the end of this episode, and what changed in it: see HOW THE GAME IS ORGANISED above. Fill in every field.");

// The NEXT episode's schedule, from this one's "next time" preview or the network's listings: a week off for
// a holiday, a double or extra-long episode, a new night. recordNextEpisode files it in season_episodes
// (0067), and every air time follows it: lineup locks, reminders, the bot's checks.
const NextEpisode = z
  .object({
    airsAt: z
      .string()
      .nullable()
      .describe(
        "When the NEXT episode starts, ISO 8601 with the UTC offset of the time zone it's announced in, as it is on that date (after a clock change, the new one): " +
          "'2026-11-05T20:00:00-05:00' for 8 PM Eastern on November 5. If the show takes a week off, the date " +
          "of the next one that does air. Null if it hasn't been announced, or this was the finale."
      ),
    minutes: z
      .number()
      .nullable()
      .describe("How long the next episode runs, ads included, in minutes: 60, 90, or 120 for a two-hour episode. Null if not announced."),
    note: z
      .string()
      .nullable()
      .describe("Anything unusual about it, in a few words ('after a week off for Thanksgiving', 'two-hour finale'). Null if nothing."),
  })
  .describe("When the NEXT episode airs, from this episode's 'next time' preview or the network's announced schedule.");

// Every page read for the episode with its own dates, as the page shows them. Not used to score: it's
// the record of how soon after airing recaps appear (and get corrected), to learn when research is
// worth running for a show.
const SourcesRead = z
  .array(
    z.object({
      url: z.string(),
      published: z
        .string()
        .nullable()
        .describe(
          "When the page says it was first published, as precisely as it shows: ISO 8601 with time and timezone " +
            "if shown ('2026-10-15T09:12:00-04:00'), else just the date ('2026-10-15'). Null if it shows none."
        ),
      updated: z.string().nullable().describe("When the page says it was last updated, the same way. Null if it shows none."),
    })
  )
  .describe("Every article or page you read for this episode, once each, with the dates the page itself shows.");

// Worded against noise above all: a note that fires every week ("someone found an idol!") would teach
// the admin to ignore the Rules row, which is worse than no flag. So it asks only about the GAME's
// rules changing, names what doesn't count (anything the checklist asks; the show's usual twists;
// what happened to one person, which belongs in their entry), and says null is the normal answer.
const RULES_NOTE =
  "Only if this episode introduced a change to HOW THE GAME IS PLAYED that is new this season: a new " +
  "twist, a new kind of advantage or power, a new way to leave the game or to be safe, or a rule the show " +
  "announced works differently from before. If so, one sentence on what it is and how it works, as the " +
  "episode showed it. Null otherwise -- including for anything the per-person checklist already asks " +
  "about, for the show's usual twists and advantages, and for what happened to one person (that goes in " +
  "their entry). Most episodes: null.";

// One answer per side bet the prompt listed. Answered from the same pages as the checklist, so a
// bet costs a few output tokens on a call that's being made anyway -- no request of its own.
const BetAnswers = z
  .array(
    z.object({
      bet: z.number().int().describe("The bet's number from the list you were sent."),
      answer: z
        .string()
        .nullable()
        .describe("The short answer as the question asks for it: 'yes', 'no', a name, a number. Null if your sources don't settle it."),
      correctGuesses: z
        .array(z.string())
        .describe("Which of the listed guesses are right, copied exactly as listed. Empty if none are, or if the answer is null."),
      evidence: z
        .string()
        .nullable()
        .describe("One short sentence from or about your sources that settles it. Null if the answer is null."),
      sources: z.array(z.string()).describe("URLs you read that support the answer."),
      confidence: z
        .enum(["high", "medium", "low"])
        .describe("high: a source states it plainly. medium: a source implies it. low: pieced together, or judged from a name alone."),
    })
  )
  .describe("EXACTLY ONE ENTRY PER BET in the list you were sent, in that order.");

// ---------- the prompt ----------
// The instruction that matters most is the one about not answering from memory. The entire reason to
// pay for search is that the model's own recall of a season -- especially one currently airing -- is
// unverifiable and, for anything past its training cutoff, absent. An answer drawn from memory looks
// exactly like an answer drawn from a source, which is the failure this whole design is trying to
// avoid.
//
// Provider-neutral on purpose: it says "search" and never names a tool, because the three providers
// expose search as three different mechanisms (a server tool, a grounding flag, a search parameter)
// and none of them needs to be told what its own search is called.
function buildPrompt({ showName, season, episodeNumber, castNames, castGroups = {}, formatGoingIn = null, groupWord = null, terms, domains = [], format, bets = [] }) {
  // The season's word for its groups when the timeline says it (F3 part 2: the context's), else the show's own.
  const group = String(groupWord || terms.tribe || "tribe").toLowerCase();
  const groupOf = (n) => (format.hasGroups && castGroups[n] ? castGroups[n] : null);
  const anyGroups = castNames.some(groupOf);
  // Where a chat puts what it couldn't settle: the anything-else question (notableTwist), when this ask has one (a
  // rulebook asks it only if its research block does; a re-ask of a few questions, onlyFormat, may leave it out).
  const anythingElse = "notableTwist" in format.research.checklistSchema(z, z.enum(["yes", "no", "unknown"])).shape;
  const system = [
    `You research reality-TV episodes and answer a fixed checklist about every ${terms.castaway} still in the game.`,
    "",
    "RULES, in order of importance:",
    "1. SEARCH. Do not answer from memory. Every 'yes' and every number must come from a page you",
    "   actually read in this conversation. If your own recollection disagrees with what you find,",
    "   the sources win.",
    "2. 'unknown' IS A CORRECT ANSWER. Use 'no' when the sources cover this episode and the thing did",
    "   not happen. Use 'unknown' when you could not establish it either way. Never guess to fill the",
    "   checklist -- a wrong 'yes' costs more than an honest 'unknown', because a human has to review",
    "   every answer and a confident wrong one is the hardest to catch.",
    "3. EVERY PERSON GETS AN ENTRY, in the order given, including people nothing happened to. Do not",
    "   omit anyone, do not add anyone who is not on the list, and do not rename anyone.",
    "4. Cite the URLs you actually read, per person.",
    "",
    "Recaps disagree with each other and with fan wikis. Where they conflict, prefer the most",
    `specific and most recent source, lower the confidence${anythingElse ? ", and say so in notableTwist" : ""}.`,
  ].join("\n");

  const user = [
    `${showName} season ${season}, episode ${episodeNumber}.`,
    "",
    `Research what happened in this episode and fill in the checklist for each of these ${castNames.length} ${terms.castaways}:`,
    "",
    ...castNames.map((n, i) => `${i + 1}. ${n}` + (groupOf(n) ? ` -- ${groupOf(n)}` : "")),
    "",
    // Who is with whom, and any change to it, is the format section's (below) wherever it's asked: each person's new group
    // is worked out from it (F3), and newGroup is only for whoever moved and went home the same night.
    ...(anyGroups && labelsOnly(castNames, groupOf, format, formatGoingIn)
      ? [
          // F3 part 2: the groups after the names are our records' (the cast list's, staged moves'), and none of them is one
          // the timeline has going in (The Challenge's Vets and New Threats beside its pairs): only a label.
          "The group after each name is the one our records give them going INTO this episode, which may be only a label the",
          "show gives them (like Vets and New Threats); who plays with whom going in is below. If people moved between tribes or",
          "teams in this episode, say so in formatState below; someone who moved and then went home in this same episode: the tribe",
          "or team they went home from, in newGroup.",
          "",
        ]
      : anyGroups
      ? [
          `The ${group} after each name is the one they were on going INTO this episode, as far as we know.`,
          ...(asksFormat(format)
            ? [
                `If ${plural(group)} were swapped, re-divided, dissolved or merged in this episode, say so in formatState below;`,
                `someone who moved and then went home in this same episode: the ${group} they went home from, in newGroup.`,
              ]
            : [
                `If ${plural(group)} were swapped, re-divided, dissolved or merged in this episode, give each person's new`,
                `${group} in newGroup -- that is the only place a ${group} change is recorded${anythingElse ? ", so don't leave it in" : "."}`,
                ...(anythingElse ? ["notableTwist alone."] : []),
              ]),
          "",
        ]
      : format.hasGroups && !asksFormat(format)
        ? [`If ${plural(group)} were swapped, re-divided, dissolved or merged in this episode, give each person's new ${group} in newGroup.`, ""]
        : []),
    ...(asksFormat(format) ? formatLines({ episodeNumber, castNames, formatGoingIn, labelled: anyGroups, anythingElse }) : []),
    ...format.research.searchHint,
    // Where to look FIRST, not a fence: the search tool isn't restricted to these (see searchToolFor).
    ...(domains.length
      ? ["", `Start with these trusted sites: ${domains.join(", ")}. If they don't settle something, search anywhere else that covers this episode.`]
      : []),
    "Two or three good pages are enough -- don't keep searching once the episode is covered.",
    ...betLines(bets),
  ].join("\n");

  return { system, user };
}

// Whether the groups after the names are only a label (F3 part 2): the format section is asked, the timeline knows the groups
// going in are pairs (The Challenge's, beside its Vets and New Threats), and none of the names' groups is one of them by name
// (said any way: FormatStates.tribeKey). Tribes going in, named or not, are the names' own (Survivor's words stay). Pure.
function labelsOnly(castNames, groupOf, format, formatGoingIn) {
  const groups = formatGoingIn && formatGoingIn.state && formatGoingIn.state.groups;
  if (!asksFormat(format) || !Array.isArray(groups) || !FormatStates.isPairs(groups.filter((g) => g && g.members && g.members.length > 1))) return false;
  const named = new Set(groups.filter((g) => g && g.name).map((g) => FormatStates.tribeKey(g.name)));
  return !castNames.some((n) => groupOf(n) && named.has(FormatStates.tribeKey(groupOf(n))));
}

// The format section's own part of the prompt (F2): the groups going in, as far as we know (the timeline's state going
// into the episode since F3 part 2, `formatGoingIn`: { episode, state, newcomers, sure }; only who's still on the list,
// plus anyone who came in since), so the answer is a comparison and not a guess, then what to say. Without one, it says what the
// names' groups above are (the cast list's, which may be how people play or only a label: Vets and New
// Threats) or that there are none. Pure.
function formatLines({ episodeNumber, castNames, formatGoingIn = null, labelled = false, anythingElse = true }) {
  const lines = ["HOW THE GAME IS ORGANISED (formatState): answer it once, for the whole cast."];
  const state = formatGoingIn && formatGoingIn.state;
  if (state && Array.isArray(state.groups)) {
    const asked = new Set(castNames.map((n) => n.toLowerCase()));
    // Someone not on the list is gone, unless they came in after the cast was made (a newcomer is never on it).
    const newSince = new Set((formatGoingIn.newcomers || []).map((n) => n.toLowerCase()));
    const still = (m) => asked.has(m.toLowerCase()) || newSince.has(m.toLowerCase());
    const groups = state.groups.map((g) => ({ name: g.name, members: g.members.filter(still) })).filter((g) => g.members.length);
    const alone = [...(state.alone || []).filter(still), ...groups.filter((g) => g.members.length === 1).map((g) => g.members[0])];
    const shown = groups.filter((g) => g.members.length > 1);
    const asOf = formatGoingIn.episode === episodeNumber - 1 ? "the end of the last episode" : `the end of episode ${formatGoingIn.episode}`;
    const how = state.playedAs && !["unknown", "none", "mixed"].includes(state.playedAs) ? `, playing as ${state.playedAs}` : "";
    lines.push(
      shown.length
        ? `Going into this episode, as far as we know (as of ${asOf}${how}${state.phase ? `, in "${state.phase}"` : ""}), people were grouped like this:`
        : `Going into this episode, as far as we know (as of ${asOf}${state.phase ? `, in "${state.phase}"` : ""}), nobody was in a group: everyone played for themselves.`
    );
    for (const g of shown) lines.push(`  - ${g.name ? `${g.name}: ` : ""}${g.members.join(g.members.length === 2 && !g.name ? " & " : ", ")}`);
    if (shown.length && alone.length) lines.push(`  On their own: ${alone.join(", ")}.`);
    // F3 part 2: the timeline says when what's known going in isn't sure (an answer that contradicted itself, a change one side
    // alone saw, nothing known since an earlier episode).
    if (formatGoingIn.sure === false) lines.push("We aren't sure of these: an earlier answer may have them wrong, so check them against what you find.");
    lines.push("Compare with what you find, and say how it stands at the END of this episode, going into the next one.");
  } else if (labelled) {
    lines.push(
      "We don't have how people were grouped going into this episode. The group after each name above is the cast list's:",
      "it may be how people play (a tribe, a team) or only a label the show gives them (like Vets and New Threats). Here,",
      "say how people actually play: who is grouped with whom at the END of this episode, going into the next one."
    );
  } else {
    lines.push("We have no groups on record for this season. If people play in tribes, teams or pairs, say who is with whom at the END of this episode, going into the next one; if everyone plays for themselves, say so.");
  }
  lines.push(
    "Each change this episode made to who is grouped with whom (teams formed, a swap or the pairs drawn again, a merge, everyone",
    "for themselves) or to how the game is played (a new phase, a twist, someone's role) goes in formatState.changes, with",
    `when it came in and the episode it takes effect from (episode ${episodeNumber} for a change at its start or partway through,`,
    `episode ${episodeNumber + 1} for one at its end). That is where a change of format is recorded${anythingElse ? " (as well as anything above that asks about it), so don't leave it in notableTwist alone" : ""}.`,
    ""
  );
  return lines;
}

// The side bets league members made about this episode, for the model to settle from the same
// sources. The rules above still apply: from pages read, not memory; null when they don't say.
function betLines(bets) {
  if (!bets.length) return [];
  return [
    "",
    "Also settle these side bets that league members made about this episode. Answer each from the",
    "pages you read, not from memory. A bet can ask about something that did NOT happen (\"Will an idol",
    "be played?\") -- if your sources cover the episode and it didn't happen, the answer is 'no'. For",
    "questions about a person (\"Was a woman voted out?\"), use how your sources refer to them (their",
    "pronouns); if you can only go by their name, say so in the evidence and use low confidence. Then",
    "say which of the listed guesses are right -- a guess that means the same as the answer counts",
    "(\"guy\" for \"a man\"). Use null for the answer when the sources don't settle it.",
    "",
    ...bets.map((b, i) => `Bet ${i + 1}: ${b.label}` + (b.guesses.length ? `\n   Guesses: ${b.guesses.map((g) => JSON.stringify(g)).join(", ")}` : "")),
  ];
}

// What the second pass is told when a provider can't search and answer in one call. It gets no
// search of its own, so it can only reorganise what the first pass found -- it cannot quietly
// introduce facts.
const STRUCTURE_SYSTEM =
  "Convert the research notes into the required structure. Use only what the notes contain; do not " +
  "add facts, do not fill gaps from your own knowledge, and answer 'unknown' where the notes are silent.";

// ---------- providers ----------
//
// A provider is four things:
//
//   id, defaultModel   -- what to call it and what to run if nobody said.
//   credentialError()  -- null when it can run, else the sentence telling the user which key to set.
//   combined(req)      -- search AND answer in the schema, in one call. Optional: a provider that
//                         can't do both at once throws CombinationUnsupported and the runner falls
//                         back. One call is strictly better when it works -- the model structures
//                         what it read rather than what it later wrote down about what it read.
//   search(req) + structure(req) -- the two-call fallback.
//
// Each returns the same three things, so everything above and below this section is provider-blind:
// `parsed` (schema-valid answers), `usage` ({input_tokens, output_tokens}), and `pagesRead` (the URLs
// the search actually fetched, taken off the response rather than from what the model claims).

class CombinationUnsupported extends Error {}

// Some sites block Anthropic's crawler, and a search restricted to one of them is refused outright
// ("The following domains are not accessible to our user agent: ['ew.com']"). Not worth failing a
// run over: runResearch drops the named sites and asks again.
class DomainsBlocked extends Error {
  constructor(domains, message) {
    super(message);
    this.domains = domains;
  }
}
function blockedDomainsIn(err) {
  const m = /domains are not accessible[^[]*\[([^\]]*)\]/i.exec((err && err.message) || "");
  if (!m) return null;
  const list = m[1].split(",").map((d) => d.trim().replace(/^['"]|['"]$/g, "")).filter(Boolean);
  return list.length ? list : null;
}

function providerFor(name) {
  const id = (name || process.env.RESEARCH_PROVIDER || "anthropic").toLowerCase();
  const provider = PROVIDERS[id];
  if (!provider) {
    throw new Error(`Unknown research provider "${id}". Supported: ${Object.keys(PROVIDERS).join(", ")}.`);
  }
  return provider;
}

// One HTTP shape for the two REST providers. Deliberately not an SDK each: both are a single POST,
// and a dependency per provider would be three times the supply chain for the same request.
async function postJson(url, headers, body, label) {
  let res;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(body),
    });
  } catch (e) {
    throw new Error(`${label}: could not reach the API (${e.message}).`);
  }
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* left null on purpose -- the raw text is the better error below */
  }
  if (!res.ok) {
    const message = (json && ((json.error && (json.error.message || json.error)) || json.message)) || text.slice(0, 500);
    const err = new Error(`${label} HTTP ${res.status}: ${typeof message === "string" ? message : JSON.stringify(message)}`);
    err.status = res.status;
    err.body = json;
    throw err;
  }
  if (!json) throw new Error(`${label}: the API returned something that isn't JSON.`);
  return json;
}

// A provider rejecting "search plus a response schema, together" is the one error worth retrying
// differently, and it arrives as a 400 whose wording differs per vendor -- so match on the shape of
// the complaint, not on an error code that doesn't exist.
function looksLikeCombinationRejection(err) {
  if (err && err.status !== 400) return false;
  return /response_?(mime_?type|schema|format)|output_config|structured|json.?mode|tool|function.?calling|grounding|google_?search|search_parameters/i.test(
    (err && err.message) || ""
  );
}

function parseJsonAnswer(text, schema, label) {
  if (!text || !text.trim()) throw new Error(`${label}: the model returned no text to parse.`);
  // Models that are told "JSON only" still occasionally wrap it in a fence. Cheap to undo, and the
  // alternative is throwing away an otherwise good answer.
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  let raw;
  try {
    raw = JSON.parse(cleaned);
  } catch (e) {
    // Chat UIs' copy buttons sometimes escape Markdown characters ("\[", "\_", "\*"). A backslash before
    // anything but a real JSON escape can't be meant, so drop it and try once more. Pairs are read left
    // to right, so a genuine "\\" stays a backslash.
    try {
      raw = JSON.parse(unescapeMarkdown(cleaned));
    } catch {
      throw new Error(`${label}: the model's answer wasn't valid JSON (${e.message}).`);
    }
  }
  return validateLeniently(raw, schema, label);
}

function unescapeMarkdown(text) {
  return text.replace(/\\(.)/gs, (pair, ch) => ('"\\/bfnrtu'.includes(ch) ? pair : ch));
}

// A value outside one of the checklist's fixed lists -- an exit method the show's rules don't have
// ("Murdered" for a Survivor-rules season), a stray yes/no answer -- used to reject the WHOLE run,
// throwing away every other person's answers with it. Instead, that one field takes its list's own
// catch-all ("Other" for how someone left, "unknown" for a yes/no) and the original is kept in
// `repairs`, which the run reports as a problem for the reviewer. Anything else still fails.
function validateLeniently(raw, schema, label) {
  const repairs = [];
  // The rules note (RULES_NOTE) is a flag, not an answer anything scores: a chat that leaves it out
  // has said "nothing new", which is null. Failing a whole paste over it would make research worse to
  // protect a field that's null nearly every week. Nothing else missing is excused.
  if (raw && typeof raw === "object" && !Array.isArray(raw) && !("rulesNote" in raw)) raw.rulesNote = null;
  // The next episode's schedule (NextEpisode) is a bonus the same way: an answer from an older prompt has no
  // such field, and a chat may fill it oddly. Missing or malformed, it's "not announced", never a failed run.
  if (raw && typeof raw === "object" && !Array.isArray(raw)) raw.nextEpisode = looseNextEpisode(raw.nextEpisode);
  // The format section (F2) too: an answer from before it was asked has none (null), and a value outside one of its
  // lists is repaired and reported (formats/format-state.js), so it never fails a run whose checklist is fine.
  if (raw && typeof raw === "object" && !Array.isArray(raw) && schema.shape && schema.shape.formatState) {
    raw.formatState = FormatStates.looseFormatState(raw.formatState, repairs);
  }
  // A person's group move, from an answer to a prompt that didn't ask it (a paste of an older skeleton): none said, null.
  const person = schema.shape && schema.shape.castaways && schema.shape.castaways.element;
  if (person && person.shape && person.shape.newGroup && raw && Array.isArray(raw.castaways)) {
    for (const c of raw.castaways) if (c && typeof c === "object" && !("newGroup" in c)) c.newGroup = null;
  }
  for (let attempt = 0; attempt < 5; attempt++) {
    const result = schema.safeParse(raw);
    if (result.success) {
      if (repairs.length) result.data.repairs = repairs;
      return result.data;
    }
    // One name where the checklist asks for a list of them ("votedFor": "Rob" for ["Rob"]) is the
    // same answer, so it's wrapped rather than failing the run.
    const lists = result.error.issues.filter((i) => i.code === "invalid_type" && i.expected === "array");
    const wrappable = lists.filter((i) => typeof valueAt(raw, i.path) === "string");
    for (const issue of wrappable) {
      const parent = valueAt(raw, issue.path.slice(0, -1));
      const field = issue.path[issue.path.length - 1];
      repairs.push(`${whoAt(raw, issue.path)}${field} "${parent[field]}" was one name, not a list -- read as a list of one`);
      parent[field] = [parent[field]];
    }
    if (wrappable.length) continue;
    const fixable = result.error.issues.filter((i) => i.code === "invalid_value" && Array.isArray(i.values));
    if (!fixable.length) {
      const first = result.error.issues[0];
      throw new Error(`${label}: the answer didn't match the checklist schema at ${(first.path || []).join(".") || "(root)"}: ${first.message}`);
    }
    for (const issue of fixable) {
      const fallback = issue.values.includes("Other") ? "Other" : issue.values.includes("unknown") ? "unknown" : null;
      if (!fallback) {
        throw new Error(`${label}: the answer didn't match the checklist schema at ${issue.path.join(".")}: ${issue.message}`);
      }
      const parent = valueAt(raw, issue.path.slice(0, -1));
      const field = issue.path[issue.path.length - 1];
      repairs.push(`${whoAt(raw, issue.path)}${field} "${parent[field]}" isn't one of this show's options -- recorded as "${fallback}"`);
      parent[field] = fallback;
    }
  }
  throw new Error(`${label}: the answer didn't match the checklist schema.`);
}

function looseNextEpisode(v) {
  const o = v && typeof v === "object" && !Array.isArray(v) ? v : {};
  const text = (x) => (typeof x === "string" && x.trim() ? x.trim() : null);
  const n = typeof o.minutes === "number" ? o.minutes : typeof o.minutes === "string" ? Number.parseFloat(o.minutes) : NaN;
  return { airsAt: text(o.airsAt), minutes: Number.isFinite(n) ? n : null, note: text(o.note) };
}

const valueAt = (raw, path) => path.reduce((node, key) => (node == null ? node : node[key]), raw);
const whoAt = (raw, path) => (path[0] === "castaways" && raw.castaways[path[1]] ? `${raw.castaways[path[1]].name}: ` : "");

// The SDK's zodOutputFormat, with its all-or-nothing parse swapped for validateLeniently. Same JSON
// schema sent to the API, so the model is still held to the lists; this only decides what happens
// when it strays from one.
function lenientOutputFormat(schema) {
  const format = zodOutputFormat(schema);
  return {
    ...format,
    parse: (content) => {
      let raw;
      try {
        raw = JSON.parse(content);
      } catch (e) {
        throw new Error(`Failed to parse structured output as JSON: ${e.message}`);
      }
      return validateLeniently(raw, schema, "Research");
    },
  };
}

// ---- JSON Schema, in the two dialects the REST providers accept ----
// Both are subsets of JSON Schema with their own holes, and zod's output is a superset of both, so
// each gets a sanitizer rather than a hand-written schema -- one checklist definition stays the
// single source of truth no matter who is asked.
function jsonSchemaFor(schema, dialect) {
  const json = z.toJSONSchema(schema, { io: "output" });
  return dialect === "gemini" ? geminiSchema(json) : strictSchema(json);
}

// Gemini takes an OpenAPI 3.0 subset: no additionalProperties, no numeric bounds, and null is a
// `nullable` flag rather than a member of a type union.
function geminiSchema(node) {
  if (Array.isArray(node)) return node.map(geminiSchema);
  if (!node || typeof node !== "object") return node;

  const out = {};
  let nullable = false;
  for (const [key, value] of Object.entries(node)) {
    if (key === "$schema" || key === "additionalProperties" || key === "minimum" || key === "maximum") continue;
    if (key === "exclusiveMinimum" || key === "exclusiveMaximum") continue;
    if (key === "type" && Array.isArray(value)) {
      const real = value.filter((t) => t !== "null");
      if (real.length !== value.length) nullable = true;
      out.type = real[0] || "string";
      continue;
    }
    if (key === "anyOf" && Array.isArray(value)) {
      const real = value.filter((v) => !(v && v.type === "null"));
      if (real.length !== value.length) nullable = true;
      // `x or null` is the only union the checklist uses, so collapsing it to the one real branch is
      // lossless here -- and it is the only form Gemini reliably accepts.
      if (real.length === 1) {
        Object.assign(out, geminiSchema(real[0]));
        continue;
      }
      out.anyOf = real.map(geminiSchema);
      continue;
    }
    out[key] = geminiSchema(value);
  }
  if (nullable) out.nullable = true;
  // Gemini does not guarantee key order from `properties` alone, and the checklist reads far better
  // to a human reviewer in the order it was declared.
  if (out.type === "object" && out.properties) out.propertyOrdering = Object.keys(out.properties);
  return out;
}

// OpenAI-compatible strict mode (what Grok implements): every property required and
// additionalProperties:false -- which zod already emits -- but no validation keywords beyond the
// structural ones.
function strictSchema(node) {
  if (Array.isArray(node)) return node.map(strictSchema);
  if (!node || typeof node !== "object") return node;
  const out = {};
  for (const [key, value] of Object.entries(node)) {
    if (key === "$schema" || key === "minimum" || key === "maximum") continue;
    if (key === "exclusiveMinimum" || key === "exclusiveMaximum" || key === "format") continue;
    out[key] = strictSchema(value);
  }
  return out;
}

// ---- Anthropic ----
// The models an admin may pick for research (Admin > Shows & Seasons). Cheapest first.
const RESEARCH_MODELS = ["claude-haiku-4-5", "claude-sonnet-5", "claude-opus-5"];

// Eight searches, not twelve: the prompt points at the trusted sites first, so a handful of queries
// usually finds the recap, with a few to spare for going wider when those don't settle something.
// Every search both costs a fee and pours its results into the context as input tokens -- the
// biggest share of a research call's cost.
const MAX_SEARCHES = 8;

// The search tool depends on the model generation: web_search_20260209 (dynamic filtering) is for
// Opus/Sonnet 4.6 and later; Haiku 4.5 only has the basic variant. The dynamic variant runs code
// execution internally, which is why code_execution must NOT also be declared.
function searchToolFor(model, domains) {
  const type = model === "claude-haiku-4-5" ? "web_search_20250305" : "web_search_20260209";
  // No allowed_domains: the show's trusted sites (shows.research_domains) are named in the prompt as
  // where to start, but a hard restriction left gaps the model could see how to fill and wasn't
  // allowed to. `domains` stays in the signature for the providers' call shape.
  void domains;
  return { type, name: "web_search", max_uses: MAX_SEARCHES };
}
const SEARCH_TOOL = searchToolFor("claude-opus-5", null); // kept for callers that inspect the default

// Haiku 4.5 predates adaptive thinking and the effort setting; sending either is a 400. The others
// run at medium effort -- effort is the main lever on thinking (output) tokens, and a checklist
// against fetched pages doesn't need the default "high".
function anthropicModelParams(model) {
  if (model === "claude-haiku-4-5") return { thinking: null, effort: null };
  return { thinking: { type: "adaptive" }, effort: "medium" };
}

const anthropicProvider = {
  id: "anthropic",
  defaultModel: "claude-opus-5",
  credentialError() {
    if (process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN) return null;
    return "Set ANTHROPIC_API_KEY in .env.local (or run `ant auth login`).";
  },
  async combined({ system, user, schema, model, domains }) {
    const client = anthropicClient();
    try {
      const response = await client.messages
        .stream({
          ...anthropicBase(model, system, user, lenientOutputFormat(schema)),
          tools: [searchToolFor(model, domains)],
        })
        .finalMessage();
      return {
        parsed: anthropicParsed(response),
        usage: anthropicUsage(response),
        pagesRead: anthropicPages(response),
        queries: anthropicQueries(response),
      };
    } catch (err) {
      const blocked = blockedDomainsIn(err);
      if (blocked) throw new DomainsBlocked(blocked, err.message);
      const rejected =
        err instanceof Anthropic.BadRequestError && /output_config|format|tool/i.test(err.message || "");
      if (rejected) throw new CombinationUnsupported(err.message);
      throw anthropicError(err);
    }
  },
  async search({ system, user, model, domains }) {
    const client = anthropicClient();
    try {
      const response = await client.messages
        .stream({ ...anthropicBase(model, system, user, null), tools: [searchToolFor(model, domains)] })
        .finalMessage();
      return {
        text: response.content.filter((b) => b.type === "text").map((b) => b.text).join("\n"),
        usage: anthropicUsage(response),
        pagesRead: anthropicPages(response),
        queries: anthropicQueries(response),
      };
    } catch (err) {
      const blocked = blockedDomainsIn(err);
      if (blocked) throw new DomainsBlocked(blocked, err.message);
      throw anthropicError(err);
    }
  },
  async structure({ notes, schema, model }) {
    const client = anthropicClient();
    try {
      const response = await client.messages
        .stream(anthropicBase(model, STRUCTURE_SYSTEM, notes, lenientOutputFormat(schema)))
        .finalMessage();
      return { parsed: anthropicParsed(response), usage: anthropicUsage(response) };
    } catch (err) {
      throw anthropicError(err);
    }
  },
};

function anthropicClient() {
  const workspaceId = process.env.ANTHROPIC_WORKSPACE_ID;
  return new Anthropic(workspaceId ? { defaultHeaders: { "anthropic-workspace-id": workspaceId } } : {});
}

function anthropicBase(model, system, user, format) {
  const { thinking, effort } = anthropicModelParams(model);
  const output_config = { ...(format ? { format } : {}), ...(effort ? { effort } : {}) };
  return {
    model,
    max_tokens: 32000,
    ...(thinking ? { thinking } : {}),
    // Caches the stable prefix (tools + instructions). Small saving on a one-off; it's what a
    // "Research again" minutes later benefits from.
    cache_control: { type: "ephemeral" },
    system,
    messages: [{ role: "user", content: user }],
    ...(Object.keys(output_config).length ? { output_config } : {}),
  };
}

function anthropicParsed(response) {
  if (response.stop_reason === "max_tokens") {
    throw new Error("The research hit its output limit and was cut off, so it is incomplete -- nothing saved.");
  }
  if (response.stop_reason === "refusal") {
    throw new Error(`The model declined this request (${response.stop_details && response.stop_details.category}).`);
  }
  if (!response.parsed_output) throw new Error("The model returned a response that did not match the checklist schema.");
  return response.parsed_output;
}

function anthropicUsage(response) {
  const u = response.usage || {};
  return {
    input_tokens: u.input_tokens || 0,
    output_tokens: u.output_tokens || 0,
    // Billed separately from tokens ($10 per 1,000) -- carried so the admin panel can show a real cost.
    web_search_requests: (u.server_tool_use && u.server_tool_use.web_search_requests) || 0,
    cache_read_input_tokens: u.cache_read_input_tokens || 0,
    cache_creation_input_tokens: u.cache_creation_input_tokens || 0,
  };
}

function anthropicPages(response) {
  const urls = [];
  for (const block of response.content || []) {
    if (block.type !== "web_search_tool_result") continue;
    // An errored search returns an OBJECT here, not a list -- branch before indexing.
    const results = Array.isArray(block.content) ? block.content : [];
    for (const r of results) if (r && r.url && !urls.includes(r.url)) urls.push(r.url);
  }
  return urls;
}

function anthropicQueries(response) {
  const queries = [];
  for (const block of response.content || []) {
    if (block.type === "server_tool_use" && block.name === "web_search" && block.input && block.input.query) {
      if (!queries.includes(block.input.query)) queries.push(block.input.query);
    }
  }
  return queries;
}

function anthropicError(err) {
  if (err instanceof CombinationUnsupported) return err;
  if (err instanceof Anthropic.AuthenticationError) return new Error("Anthropic rejected the credentials (check ANTHROPIC_API_KEY).");
  if (err instanceof Anthropic.RateLimitError) return new Error("Rate limited by the Anthropic API -- try again shortly.");
  if (err instanceof Anthropic.APIError) {
    const message = (err.error && err.error.error && err.error.error.message) || err.message || "unknown error";
    return new Error(`Anthropic API error ${err.status}: ${message}`);
  }
  return err;
}

// ---- Gemini ----
// Google Search grounding, over the REST API. Historically Gemini refused a response schema and a
// tool in the same request; if that is still true here the runner sees CombinationUnsupported and
// takes the two-call path, which costs a second call and loses nothing else.
const GEMINI_BASE = process.env.GEMINI_API_BASE || "https://generativelanguage.googleapis.com/v1beta";

const geminiProvider = {
  id: "gemini",
  // An alias, not a pinned id, unlike the Anthropic model above. Google retires pinned ids out from
  // under existing code -- `gemini-2.5-flash` already answers 404 with "no longer available to new
  // users" on a fresh key -- so a pin here is a time bomb, and --model / RESEARCH_MODEL is how to
  // pin one deliberately when a run has to be reproducible.
  defaultModel: "gemini-pro-latest",
  credentialError() {
    if (geminiKey()) return null;
    return "Set GEMINI_API_KEY (or GOOGLE_API_KEY) in .env.local.";
  },
  async combined({ system, user, schema, model }) {
    let json;
    try {
      json = await geminiCall(model, {
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: user }] }],
        tools: [{ google_search: {} }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: jsonSchemaFor(schema, "gemini"),
        },
      });
    } catch (err) {
      if (looksLikeCombinationRejection(err)) throw new CombinationUnsupported(err.message);
      throw err;
    }
    return {
      parsed: parseJsonAnswer(geminiText(json), schema, "Gemini"),
      usage: geminiUsage(json),
      pagesRead: geminiPages(json),
      queries: geminiQueries(json),
    };
  },
  async search({ system, user, model }) {
    const json = await geminiCall(model, {
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: user }] }],
      tools: [{ google_search: {} }],
    });
    return {
      text: geminiText(json),
      usage: geminiUsage(json),
      pagesRead: geminiPages(json),
      queries: geminiQueries(json),
    };
  },
  async structure({ notes, schema, model }) {
    const json = await geminiCall(model, {
      systemInstruction: { parts: [{ text: STRUCTURE_SYSTEM }] },
      contents: [{ role: "user", parts: [{ text: notes }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: jsonSchemaFor(schema, "gemini"),
      },
    });
    return { parsed: parseJsonAnswer(geminiText(json), schema, "Gemini"), usage: geminiUsage(json) };
  },
};

function geminiKey() {
  return process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
}

async function geminiCall(model, body) {
  try {
    // The key goes in a header, not the query string, so it can't end up in a log line or a proxy's
    // access log the way ?key= does.
    return await postJson(
      `${GEMINI_BASE}/models/${encodeURIComponent(model)}:generateContent`,
      { "x-goog-api-key": geminiKey() },
      body,
      "Gemini"
    );
  } catch (err) {
    throw geminiHint(err, body);
  }
}

// Two failures that are certain to be hit and that Google's own message doesn't explain. Measured,
// not guessed: on a free-tier key, plain generation and structured output both return 200 while
// anything carrying google_search returns 429 with "limit: 0" -- grounding simply has no free quota,
// which reads like rate limiting and isn't.
function geminiHint(err, body) {
  const searched = !!(body && body.tools);
  // The hint goes FIRST and the vendor's own text after it. Google's quota error is a wall that
  // repeats itself four times, so an explanation appended to the end is an explanation nobody reads
  // -- which was exactly how it looked in the admin UI before this.
  const lead = (hint) => new Error(`${hint}\n\nGoogle said: ${dedupeLines(err.message)}`);
  if (err.status === 429 && searched) {
    return lead(
      "Google Search grounding has NO free-tier quota: a key on a project without billing is refused " +
        "every grounded request, while ungrounded ones succeed -- so this reads like rate limiting " +
        "and isn't. Enable billing on this key's Google Cloud project, or switch the research " +
        "provider to anthropic or grok."
    );
  }
  if (err.status === 503) return lead("That is Google's capacity, not this request. Retry, or pick another model.");
  if (err.status === 404 && /no longer available/i.test(err.message)) {
    return lead('Google has retired that model id. Pick a current one, or leave the model unset to use the "latest" alias.');
  }
  return err;
}

// Google repeats the same quota line once per metric and once per model, so the same sentence can
// appear four times in one message. Identical lines add nothing to a reader.
function dedupeLines(message) {
  const seen = new Set();
  return String(message)
    .split(/\s*\*\s+|\n/)
    .map((line) => line.trim())
    .filter((line) => line && !seen.has(line) && seen.add(line) !== undefined)
    .join(" · ");
}

function geminiCandidate(json) {
  const candidate = (json.candidates || [])[0];
  if (!candidate) {
    const blocked = json.promptFeedback && json.promptFeedback.blockReason;
    throw new Error(blocked ? `Gemini blocked the request (${blocked}).` : "Gemini returned no candidates.");
  }
  if (candidate.finishReason && candidate.finishReason !== "STOP") {
    throw new Error(`Gemini stopped early (${candidate.finishReason}), so the research is incomplete -- nothing saved.`);
  }
  return candidate;
}

function geminiText(json) {
  const parts = (geminiCandidate(json).content || {}).parts || [];
  // Thinking arrives as parts flagged `thought`. They are not the answer, and concatenating them
  // into it is how a perfectly good JSON response turns into a parse error.
  return parts.filter((p) => p && p.text && !p.thought).map((p) => p.text).join("");
}

function geminiPages(json) {
  const urls = [];
  const meta = geminiCandidate(json).groundingMetadata || {};
  for (const chunk of meta.groundingChunks || []) {
    const uri = chunk && chunk.web && chunk.web.uri;
    if (uri && !urls.includes(uri)) urls.push(uri);
  }
  return urls;
}

function geminiQueries(json) {
  const meta = geminiCandidate(json).groundingMetadata || {};
  return meta.webSearchQueries || [];
}

function geminiUsage(json) {
  const u = json.usageMetadata || {};
  return {
    input_tokens: u.promptTokenCount || 0,
    output_tokens: (u.candidatesTokenCount || 0) + (u.thoughtsTokenCount || 0),
  };
}

// ---- Grok ----
// xAI's Live Search, over their OpenAI-compatible endpoint. `mode: "on"` rather than "auto" because
// the whole point of this call is that it searched -- letting the model decide it already knows is
// exactly the failure the prompt's first rule exists to prevent.
const XAI_BASE = process.env.XAI_API_BASE || "https://api.x.ai/v1";
const GROK_SEARCH = { mode: "on", return_citations: true, max_search_results: 12 };

const grokProvider = {
  id: "grok",
  defaultModel: "grok-4",
  credentialError() {
    if (process.env.XAI_API_KEY || process.env.GROK_API_KEY) return null;
    return "Set XAI_API_KEY in .env.local.";
  },
  async combined({ system, user, schema, model }) {
    let json;
    try {
      json = await grokCall({
        model,
        messages: grokMessages(system, user),
        search_parameters: GROK_SEARCH,
        response_format: grokFormat(schema),
      });
    } catch (err) {
      if (looksLikeCombinationRejection(err)) throw new CombinationUnsupported(err.message);
      throw err;
    }
    return {
      parsed: parseJsonAnswer(grokText(json), schema, "Grok"),
      usage: grokUsage(json),
      pagesRead: grokPages(json),
      queries: [],
    };
  },
  async search({ system, user, model }) {
    const json = await grokCall({ model, messages: grokMessages(system, user), search_parameters: GROK_SEARCH });
    return { text: grokText(json), usage: grokUsage(json), pagesRead: grokPages(json), queries: [] };
  },
  async structure({ notes, schema, model }) {
    const json = await grokCall({
      model,
      messages: grokMessages(STRUCTURE_SYSTEM, notes),
      response_format: grokFormat(schema),
    });
    return { parsed: parseJsonAnswer(grokText(json), schema, "Grok"), usage: grokUsage(json) };
  },
};

function grokMessages(system, user) {
  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}

function grokFormat(schema) {
  return {
    type: "json_schema",
    json_schema: { name: "episode_research", strict: true, schema: jsonSchemaFor(schema, "strict") },
  };
}

function grokCall(body) {
  const key = process.env.XAI_API_KEY || process.env.GROK_API_KEY;
  return postJson(`${XAI_BASE}/chat/completions`, { authorization: `Bearer ${key}` }, body, "Grok");
}

function grokChoice(json) {
  const choice = (json.choices || [])[0];
  if (!choice) throw new Error("Grok returned no choices.");
  if (choice.finish_reason === "length") {
    throw new Error("The research hit its output limit and was cut off, so it is incomplete -- nothing saved.");
  }
  return choice;
}

function grokText(json) {
  return (grokChoice(json).message || {}).content || "";
}

function grokPages(json) {
  // Citations have moved between the response root and the message in this API's lifetime; read
  // both rather than silently record no sources for a run that had them.
  const found = json.citations || (grokChoice(json).message || {}).citations || [];
  const urls = [];
  for (const c of found) {
    const url = typeof c === "string" ? c : c && c.url;
    if (url && !urls.includes(url)) urls.push(url);
  }
  return urls;
}

function grokUsage(json) {
  const u = json.usage || {};
  return { input_tokens: u.prompt_tokens || 0, output_tokens: u.completion_tokens || 0 };
}

const PROVIDERS = { anthropic: anthropicProvider, gemini: geminiProvider, grok: grokProvider };

// Checked before anything is read or asked, because "you have no key for this provider" is a
// two-second fix and finding it out after the DB work reads like the run got further than it did.
function requireCredentials(provider) {
  const problem = provider.credentialError();
  if (!problem) return;
  throw new Error(
    `No credentials for the "${provider.id}" research provider. ${problem}\n` +
      "This researcher uses a web-searching model, so it cannot run without one. " +
      `The other providers are: ${Object.keys(PROVIDERS).filter((p) => p !== provider.id).join(", ")} ` +
      "(set RESEARCH_PROVIDER, or pass --provider= on the CLI)."
  );
}

// ---------- the call ----------
// Search and a schema-valid answer in ONE request is what we want from every provider, because the
// model that read the pages is the one filling in the checklist. Where that combination is refused
// we search, then structure the notes -- a second call, and a small loss of fidelity, but never a
// failed run.
async function runResearch(req) {
  let domains = req.domains || [];
  const blocked = [];
  // Twice is enough: the refusal lists every blocked site at once.
  for (let attempt = 0; ; attempt++) {
    try {
      const out = await researchOnce({ ...req, domains });
      return { ...out, domains, blockedDomains: blocked };
    } catch (err) {
      if (!(err instanceof DomainsBlocked) || attempt >= 2) throw err;
      blocked.push(...err.domains);
      domains = domains.filter((d) => !err.domains.includes(d));
      console.log(`[research] ${err.domains.join(", ")} block the search crawler -- retrying without them`);
      if (!domains.length) throw new Error(`Every research site blocks Anthropic's search (${blocked.join(", ")}). Edit the show's research sites in Settings.`);
    }
  }
}

async function researchOnce({ system, user, schema, provider, model, domains }) {
  requireCredentials(provider);

  if (provider.combined) {
    try {
      const out = await provider.combined({ system, user, schema, model, domains });
      return { ...out, passes: 1 };
    } catch (err) {
      if (!(err instanceof CombinationUnsupported)) throw err;
      console.log(`[research] ${provider.id} won't search and answer in a schema at once -- falling back to two calls`);
    }
  }

  const searched = await provider.search({ system, user, model, domains });
  if (!searched.text.trim()) throw new Error(`${provider.id} searched but wrote nothing to structure.`);
  const structured = await provider.structure({ notes: searched.text, schema, model });
  return {
    parsed: structured.parsed,
    usage: sumUsage(searched.usage, structured.usage),
    pagesRead: searched.pagesRead,
    queries: searched.queries || [],
    passes: 2,
  };
}

function sumUsage(a, b) {
  const out = {};
  for (const k of new Set([...Object.keys(a || {}), ...Object.keys(b || {})])) out[k] = ((a || {})[k] || 0) + ((b || {})[k] || 0);
  return out;
}

// ---------- validation ----------
// The schema guarantees shape; this guards content, same division of labour as wiki-sync.js. The
// checks that matter are about COVERAGE and about answers contradicting themselves -- a checklist
// whose whole promise is "everyone is accounted for" has to be held to it.
// `opts.partial` (the per-league paste, which merges): someone left unanswered is a note, not a refusal --
// they keep whatever's stored, and the next pass is asked about just them. Still fatal if NOBODY asked
// about was answered, which is far likelier to be wrong names than a real answer.
function validateResearch(parsed, castNames, terms, format, opts = {}) {
  const problems = [];
  const fatal = [];
  const byName = new Map();

  for (const entry of parsed.castaways || []) {
    const name = String((entry && entry.name) || "").trim();
    if (!name) { fatal.push(`an entry had no name`); continue; }
    if (byName.has(name.toLowerCase())) { problems.push(`${name} answered twice (kept the first)`); continue; }
    byName.set(name.toLowerCase(), entry);
  }

  // Coverage, in both directions.
  const missing = castNames.filter((n) => !byName.has(n.toLowerCase()));
  const extra = [...byName.values()]
    .map((e) => e.name)
    .filter((n) => !castNames.some((c) => c.toLowerCase() === n.trim().toLowerCase()));
  if (missing.length && opts.partial && missing.length < castNames.length) {
    problems.push(`no answers for ${missing.length} ${terms.castaways}, still to research: ${missing.join(", ")}`);
  } else if (missing.length) fatal.push(`no answers for ${missing.length} ${terms.castaways}: ${missing.join(", ")}`);
  if (extra.length) problems.push(`answers for ${extra.length} ${terms.castaways} who aren't in the cast, dropped: ${extra.join(", ")}`);

  // Self-contradictions. Each is cheap to check and each would otherwise reach a reviewer as a
  // plausible-looking pair of answers.
  for (const entry of byName.values()) {
    if (entry.leftTheGame === "yes" && !entry.exitMethod) {
      problems.push(`${entry.name}: left the game but no exit method given`);
    }
    if (entry.leftTheGame !== "yes" && entry.exitMethod) {
      problems.push(`${entry.name}: an exit method on someone who didn't leave (ignored)`);
      entry.exitMethod = null;
    }
    // A "new" group that's the one they went in on isn't a move: models restate it rather than null it.
    if (typeof entry.newGroup === "string") {
      const now = entry.newGroup.trim();
      const before = opts.groups && opts.groups[castNames.find((n) => n.toLowerCase() === String(entry.name).trim().toLowerCase())];
      entry.newGroup = now && !(before && before.trim().toLowerCase() === now.toLowerCase()) ? now : null;
    }
    problems.push(...format.research.entryProblems(entry));
    // The rule the whole design rests on: a positive claim with nothing behind it.
    const claims = format.research.claims.filter((k) => entry[k] === "yes");
    if (claims.length && (!entry.sources || !entry.sources.length)) {
      problems.push(`${entry.name}: claims ${claims.join(", ")} with no source cited`);
    }
  }

  // Checks across the whole cast (formats/define.js episodeProblems), after the per-person ones.
  if (format.research.episodeProblems) problems.push(...format.research.episodeProblems(parsed));
  // The format section (F2): its names made the list's own, and what doesn't add up, for the reviewer. Never fatal. Then each
  // person's group move worked out from it (F3), before the Tribal check reads the moves.
  let fromState = null;
  if (parsed && parsed.formatState) {
    const asked = (name) => castNames.find((n) => n.toLowerCase() === String(name || "").trim().toLowerCase()) || null;
    const roster = { castaways: castNames.map((name, i) => ({ id: String(i), name })) };
    const resolve = (name) => {
      const exact = asked(name);
      if (exact) return exact;
      const { castaway } = StateLogic.Core.findCastawayByName(roster, name);
      return castaway ? castNames[Number(castaway.id)] : null;
    };
    const goingIn = opts.formatGoingIn && opts.formatGoingIn.state;
    // Anyone an earlier answer said came in isn't on the cast list (F3 adds them), but is still in the game.
    const newcomers = (opts.formatGoingIn && opts.formatGoingIn.newcomers) || [];
    problems.push(...FormatStates.formatStateProblems(parsed.formatState, { resolve, entries: [...byName.values()], goingIn, newcomers, episode: opts.episode || null }));
    problems.push(...newGroupDisagreements(parsed.formatState, [...byName.values()]));
    if (format.hasGroups) fromState = applyStateMoves([...byName.values()], parsed.formatState, opts.groups);
    // F3 part 2: someone new isn't on the list until the next episode's research asks about them (the timeline has them), and
    // reaches a game only once a person adds them to its cast: the cue, for whoever reviews this.
    for (const x of parsed.formatState.newcomers || []) {
      if (!x || !x.name || asked(x.name)) continue;
      problems.push(
        `formatState: ${x.name} came in this episode${x.replaces ? ` (for ${x.replaces})` : ""} and isn't in the cast: research asks about them from the next episode, and their results reach a game once they're added to its cast`
      );
    }
  } else if (format.hasGroups && opts.storedState && Array.isArray(opts.storedState.groups)) {
    // A pass about some of the cast leaves the section out (formatForAsking): the stored one is the whole cast's, so its moves
    // speak for whoever it places among those asked again, as a full pass's would (F3 part 1's Noticed).
    fromState = applyStateMoves([...byName.values()], opts.storedState, opts.groups);
  }
  problems.push(...tribalGroupProblems(parsed, castNames, format, opts.groups, fromState));

  const answered = [...byName.values()];
  const counts = {
    castaways: answered.length,
    unknowns: answered.reduce((n, e) => n + Object.values(e).filter((v) => v === "unknown").length, 0),
    lowConfidence: answered.filter((e) => e.confidence === "low").length,
    sourced: answered.filter((e) => e.sources && e.sources.length).length,
  };
  return { entries: answered, problems, fatal, counts };
}

// Each person's group move from the format section (F3; FormatStates.movesFromState), worked out once, here, with the same
// groups going in the review shows (a league's own cast too), and stored as newGroup, which staging reads. The section speaks
// for everyone it places on a named tribe or team, moved or not, over any newGroup the answer has; anyone else (someone who
// moved and went home the same night, whom the groups at the end can't hold; a section that doesn't say) keeps what the
// answer said. Returns { placed: who it spoke for (lower case), atEnd: whether its grouping change came at the episode's
// end, so the groups at a vote before it were the ones going in }, for the Tribal check. In place.
function applyStateMoves(entries, state, goingIn) {
  const moves = FormatStates.movesFromState(state, goingIn || {});
  const low = (s) => String(s || "").trim().toLowerCase();
  const byName = new Map([...moves].map(([name, group]) => [low(name), group]));
  for (const e of entries) if (e && byName.has(low(e.name))) e.newGroup = byName.get(low(e.name));
  const grouping = ((state && state.changes) || []).filter((c) => c && FormatStates.GROUPING_KINDS.includes(c.kind) && c.kind !== "newcomer");
  return { placed: new Set(byName.keys()), atEnd: grouping.length > 0 && grouping.every((c) => c.when === "end") };
}

// A person's newGroup (an older prompt's, a paste's) against the format section's group for them, when that group has a
// name: the same answer said twice, so a difference is worth a reviewer's look (the section's wins). Pure.
function newGroupDisagreements(state, entries) {
  if (!state || !Array.isArray(state.groups)) return [];
  const named = new Map(state.groups.filter((g) => g.name).flatMap((g) => g.members.map((m) => [m.toLowerCase(), g.name])));
  return entries
    .filter((e) => typeof e.newGroup === "string" && e.newGroup.trim() && named.has(String(e.name).trim().toLowerCase()))
    .filter((e) => FormatStates.tribeKey(named.get(String(e.name).trim().toLowerCase())) !== FormatStates.tribeKey(e.newGroup))
    .map((e) => `${e.name}: newGroup says ${e.newGroup.trim()}, but formatState has them on ${named.get(String(e.name).trim().toLowerCase())}`);
}

// Before the groups end, a vote one group goes to at a time (the format's research.groupVotes: Survivor's
// Tribal, which the tribe that wins immunity skips) is one group's: someone there whose group (after this
// episode's moves) isn't the others' is most likely a missed move -- a swapped castaway voted out the same
// night, whose move a chat leaves out because they're gone. The move is filled in, so it stages as a group
// change the reviewer can reject, and reported in the vote's own words. Only where the format has groups
// and the answers say who attended.
// `fromState` (applyStateMoves, F3): whoever the format section placed is never moved by this check (their group at the end
// is the section's), and when its change came at the episode's end, everyone was still on the group they went in on at the
// vote.
function tribalGroupProblems(parsed, castNames, format, groups, fromState = null) {
  const votes = (format.data && format.data.research && format.data.research.groupVotes) || [];
  if (!format.hasGroups || !groups || !votes.length || (parsed && parsed.merged === "yes")) return [];
  return votes.flatMap((vote) => missedMoves(parsed, castNames, vote, groups, fromState));
}

function missedMoves(parsed, castNames, vote, groups, fromState) {
  const asked = (name) => castNames.find((n) => n.toLowerCase() === String(name || "").trim().toLowerCase());
  const placed = (fromState && fromState.placed) || new Set();
  const atVote = (c) => (fromState && fromState.atEnd ? null : typeof c.newGroup === "string" && c.newGroup.trim()) || groups[asked(c.name)] || null;
  const at = ((parsed && parsed.castaways) || [])
    .filter((c) => c[vote.attended] === "yes")
    .map((c) => ({ entry: c, name: c.name, group: atVote(c), placed: placed.has(String(c.name || "").trim().toLowerCase()) }))
    .filter((c) => c.group);
  if (at.length < 3) return [];
  const counts = new Map();
  for (const c of at) counts.set(c.group.toLowerCase(), (counts.get(c.group.toLowerCase()) || 0) + 1);
  const [top, n] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  // Two groups at Tribal in anything like equal numbers is a joint Tribal, not a missed move: only a
  // clear majority (4 of 5, say) is one tribe's Tribal with someone left off.
  if (n < at.length * 0.75) return [];
  const tribe = at.find((c) => c.group.toLowerCase() === top).group;
  return at
    .filter((c) => c.group.toLowerCase() !== top && !c.placed)
    .map((c) => {
      c.entry.newGroup = tribe;
      return Review.fill(vote.say, (key) => ({ name: c.name, group: tribe, was: c.group })[key]);
    });
}

// ---------- who to ask about ----------
// Research is SEASON data -- keyed on (show, season, episode), reviewed once, true for every league
// playing it -- exactly like the cast is (db/migrations/0011). So the season is the real unit, and
// there are two ways in:
//
//   by season  -- what Admin > Shows & Seasons calls. The staged cast is the cast, full stop.
//   by league  -- what the CLI takes, because a league id is what a developer has to hand. It reads
//                 the show and season off league state and then falls back to the league's own
//                 roster if the season has no staged cast, which is the one thing the admin path
//                 can't do (there is no league to fall back to).

async function catalogEntry(pool, showSlug, season, label) {
  const { rows } = await pool.query(
    `SELECT s.id AS show_id, s.name AS show_name, s.castaway_term, s.tribe_term,
            s.research_domains, s.wiki_api_url, s.format,
            ss.id AS season_id, ss.name AS season_name
       FROM shows s LEFT JOIN show_seasons ss ON ss.show_id = s.id AND ss.season_number = $2
      WHERE s.slug = $1`,
    [showSlug, season]
  );
  if (!rows.length) {
    throw new Error(
      `${label} points at show "${showSlug}", which isn't in the catalog. ` +
        "Re-add it in Admin > Shows & Seasons, or pick a different show in League Settings."
    );
  }
  // A show on a stored format (db/show-formats.js) carries its data, for contextFrom's formatFor.
  rows[0].format_data = await ShowFormats.formatDataFor(pool, rows[0].format);
  // A season playing by its own rulebook is asked by that rulebook as it is now (an edit's new question included), not
  // the stored format copied from it when it was made (docs/PLAN-maker-scoring.md step 1), as seasonFormat reads it. Which
  // rulebook asks is recorded with what research stores, and stored answers are matched by it (askedAlike).
  const asking = await Rulebooks.seasonResearchRulebook(pool, rows[0].season_id, { formatId: rows[0].format });
  rows[0].rulebook_format = asking.format;
  rows[0].rulebook_asking = asking.rulebook;
  // ...and the season's approved rule changes, which contextFrom layers on by episode.
  rows[0].rule_changes = await SeasonRuleChanges.approvedChanges(pool, rows[0].season_id);
  return rows[0];
}

// Each person's group going INTO this episode, by name: their starting group, then the latest group
// move from an earlier episode that nobody rejected (accepted, or still pending -- a swap staged last
// week and not yet reviewed is still the best guess). Shown next to each name in the prompt so a swap
// episode is noticed and answered against something. A league with no staged cast reads its own state.
async function groupsGoingInto(pool, seasonId, episodeNumber, league = null) {
  const out = {};
  if (league) {
    const state = league.state || {};
    const tribeName = new Map((state.tribes || []).map((t) => [t.id, t.name]));
    const before = [...(state.episodes || [])].filter((e) => e.number < episodeNumber).sort((a, b) => a.number - b.number);
    for (const c of state.castaways || []) {
      let id = c.startTribeId !== undefined ? c.startTribeId : c.tribeId;
      for (const e of before) for (const g of e.groups || []) if (g.castawayId === c.id) id = g.tribeId;
      if (c.name) out[c.name] = (id && tribeName.get(id)) || null;
    }
    return out;
  }
  if (!seasonId) return out;
  const { rows: cast } = await pool.query("SELECT name, tribe_name FROM season_cast WHERE season_id=$1", [seasonId]);
  for (const r of cast) out[r.name] = r.tribe_name || null;
  const { rows: moves } = await pool.query(
    `SELECT castaway_name, COALESCE(applied->>'method', method) AS grp
       FROM season_decisions
      WHERE season_id=$1 AND kind='group' AND status <> 'rejected' AND episode_number < $2
      ORDER BY episode_number, created_at`,
    [seasonId, episodeNumber]
  );
  for (const m of moves) out[m.castaway_name] = m.grp || null;
  return out;
}

async function stagedCastNames(pool, seasonId) {
  if (!seasonId) return [];
  const { rows } = await pool.query(
    "SELECT name FROM season_cast WHERE season_id=$1 ORDER BY sort_order ASC, name ASC",
    [seasonId]
  );
  return rows.map((c) => c.name);
}

// The sites research may search: the show's own list (shows.research_domains, editable in its
// Settings), or by default its wiki plus a few general TV recap sites.
function domainsFor(entry) {
  if (entry.research_domains && entry.research_domains.length) return entry.research_domains;
  let wikiHost = null;
  try {
    wikiHost = entry.wiki_api_url ? new URL(entry.wiki_api_url).hostname.replace(/^www\./, "") : null;
  } catch {
    /* a malformed URL just means no wiki domain in the default list */
  }
  // Not ew.com: it blocks Anthropic's crawler.
  return [wikiHost, "tvline.com", "parade.com"].filter(Boolean);
}

// Only ask about people still in the game at this episode. Asking about the whole cast every week
// spends output tokens (the checklist is one entry per person) on people who can't have done
// anything. Who's gone is taken from what this season already knows -- eliminations in the cached
// wiki extraction, and "left the game" in earlier episodes' research -- matched by name the same
// forgiving way everything else here matches names.
async function stillInGame(pool, showId, season, episodeNumber, castNames) {
  const gone = new Set();
  const { rows: ext } = await pool.query(
    "SELECT payload FROM wiki_extractions WHERE show_id=$1 AND season_number=$2 AND kind='episodes'",
    [showId, season]
  );
  for (const ep of (ext[0] && ext[0].payload && ext[0].payload.episodes) || []) {
    if (ep.number < episodeNumber) for (const el of ep.eliminations || []) gone.add(el.name);
  }
  const { rows: prior } = await pool.query(
    "SELECT payload FROM episode_research WHERE show_id=$1 AND season_number=$2 AND episode_number < $3 AND source = 'combined'",
    [showId, season, episodeNumber]
  );
  for (const r of prior) for (const c of (r.payload && r.payload.castaways) || []) if (c.leftTheGame === "yes") gone.add(c.name);

  const roster = { castaways: castNames.map((name, i) => ({ id: String(i), name })) };
  const goneIdx = new Set();
  for (const name of gone) {
    const { castaway } = StateLogic.Core.findCastawayByName(roster, name);
    if (castaway) goneIdx.add(castaway.id);
  }
  return {
    active: castNames.filter((_, i) => !goneIdx.has(String(i))),
    skipped: castNames.filter((_, i) => goneIdx.has(String(i))),
  };
}

// The season's rules at this episode: the show's format plus every approved change in effect by then
// (db/season-rule-changes.js). A change that no longer fits the format (the show was switched since) is
// left out rather than stopping research; the season's Rules row is where that gets noticed.
function seasonFormatFor(entry, episodeNumber) {
  const base = entry.rulebook_format || Formats.formatFor(entry.format, entry.format_data);
  const changes = (entry.rule_changes || []).filter((c) => c.effectiveEpisode <= episodeNumber);
  try {
    return { format: Formats.withChanges(base, changes), changes };
  } catch (e) {
    console.log(`[research] ! season rule changes not applied: ${e.message}`);
    return { format: base, changes: [] };
  }
}

function contextFrom(entry, showSlug, season, episodeNumber, castNames, castFrom, skippedCast = []) {
  const { format, changes } = seasonFormatFor(entry, episodeNumber);
  return {
    domains: domainsFor(entry),
    skippedCast,
    showId: entry.show_id,
    showSlug,
    showName: entry.show_name,
    season: Number(season),
    seasonId: entry.season_id || null,
    seasonName: entry.season_name || null,
    episodeNumber,
    castNames,
    castFrom,
    terms: termsFor(entry).terms,
    format,
    // The season's rulebook when it's what asks (or an unedited mirror of the format that does), recorded in provenance.
    rulebook: entry.rulebook_asking || null,
    // Which season rule changes the checklist included, recorded in provenance.
    ruleChanges: changes.map((c) => ({ id: c.id, version: c.version })),
  };
}

async function resolveSeasonResearchContext(pool, showSlug, season, episodeNumber) {
  const entry = await catalogEntry(pool, showSlug, season, `Season ${showSlug} ${season}`);
  const castNames = await stagedCastNames(pool, entry.season_id);
  if (!castNames.length) {
    // No league fallback here on purpose: the admin path has no league to borrow a roster from, and
    // researching a season whose cast nobody has staged would ask about nobody.
    throw new Error(
      `No cast to ask about for ${entry.show_name} season ${season}. Pull the season's cast first -- ` +
        "the checklist is one question per person, so it needs the list of people."
    );
  }
  const { active, skipped } = await stillInGame(pool, entry.show_id, season, episodeNumber, castNames);
  const [castGroups, timeline] = await Promise.all([
    groupsGoingInto(pool, entry.season_id, episodeNumber),
    FormatTimelines.seasonFormatTimeline(pool, { showId: entry.show_id, season, cast: castNames, before: episodeNumber }),
  ]);
  return fromTimeline(contextFrom(entry, showSlug, season, episodeNumber, active, "season", skipped), castNames, castGroups, timeline);
}

// What the context reads of the format's state over time (F3 part 2; the timeline of the episodes before this one, from the
// season's stored research): the groups going in (formatGoingIntoFrom), the season's word for its groups when the timeline
// says it (Timeline.groupWord: tribe or team, else null and the show's own word stands; the prompt's lines beside the section
// and newGroup's), and the newcomers still in, asked about like anyone after the cast
// (Timeline.newcomersIn: not on the season's cast, which a person adds them to; `cast` is everyone research could ask about,
// so someone already on it is never asked twice).
function fromTimeline(ctx, cast, castGroups, timeline) {
  const newcomers = Timeline.newcomersIn(timeline, ctx.episodeNumber, cast);
  return {
    ...ctx,
    castNames: [...ctx.castNames, ...newcomers],
    newcomers,
    castGroups,
    formatGoingIn: formatGoingIntoFrom(timeline, ctx.episodeNumber),
    groupWord: Timeline.groupWord(timeline, ctx.episodeNumber),
  };
}

// How the game was organised going INTO this episode, as far as research knows (F2; since F3 part 2 the timeline's
// goingInto): who is with whom at the end of the latest earlier episode that said it, less anyone who went home since, as
// { episode (the answer that said it), state: { playedAs, phase, groups, alone } (that answer's), newcomers (everyone an earlier
// answer said came in), sure, why }, or null when no earlier answer says. The prompt shows it so the answer compares rather
// than guesses (formatLines, which says when it isn't sure), and the checks read it (a whole pair went home). Pure.
function formatGoingIntoFrom(timeline, episodeNumber) {
  const g = Timeline.goingInto(timeline, episodeNumber);
  if (!g.known) return null;
  const e = Timeline.at(timeline, g.asOf);
  const said = e && e.carried ? Timeline.at(timeline, e.carried) || e : e;
  const newcomers = [...new Set(((timeline && timeline.newcomers) || []).filter((x) => x.episode < episodeNumber).map((x) => x.name))];
  return {
    episode: said ? said.episode : g.asOf,
    state: { playedAs: said ? said.playedAs : null, phase: said ? said.phase : null, groups: g.groups.map((x) => ({ name: x.name, members: x.members.slice() })), alone: g.alone.slice() },
    newcomers,
    sure: g.sure,
    why: g.why,
  };
}

/** The same from the database: the timeline of the episodes before `episodeNumber`. `cast`: the names research asks about. */
async function formatGoingInto(pool, showId, season, episodeNumber, cast = []) {
  if (!showId) return null;
  return formatGoingIntoFrom(await FormatTimelines.seasonFormatTimeline(pool, { showId, season, cast, before: episodeNumber }), episodeNumber);
}

async function resolveResearchContext(pool, leagueId, episodeNumber) {
  const { rows } = await pool.query("SELECT id, name, state FROM leagues WHERE id=$1", [leagueId]);
  if (!rows.length) throw new Error(`No league with id ${leagueId}`);
  const league = rows[0];
  const settings = (league.state && league.state.settings) || {};
  const showSlug = settings.showId;
  const season = settings.wikiSeason;
  if (!showSlug || !season) {
    throw new Error(
      `League "${league.name}" has no show and season set. Set them in League Settings first -- ` +
        "this won't guess which season you mean."
    );
  }

  const entry = await catalogEntry(pool, showSlug, season, `League "${league.name}"`);
  let castFrom = "season";
  let castNames = await stagedCastNames(pool, entry.season_id);
  if (!castNames.length) {
    castFrom = "league";
    castNames = ((league.state && league.state.castaways) || []).map((c) => c.name).filter(Boolean);
  }
  if (!castNames.length) {
    throw new Error(
      `No cast to ask about for ${entry.show_name} season ${season}. Pull and approve the season's ` +
        "cast in Admin > Shows & Seasons first, or enter the cast in the league."
    );
  }
  const { active, skipped } = await stillInGame(pool, entry.show_id, season, episodeNumber, castNames);
  const [castGroups, timeline] = await Promise.all([
    groupsGoingInto(pool, entry.season_id, episodeNumber, castFrom === "league" ? league : null),
    FormatTimelines.seasonFormatTimeline(pool, { showId: entry.show_id, season, cast: castNames, before: episodeNumber }),
  ]);
  return { league, ...fromTimeline(contextFrom(entry, showSlug, season, episodeNumber, active, castFrom, skipped), castNames, castGroups, timeline) };
}

// ---------- side bets ----------
// Research also settles the leagues' side bets for the episode it researches, in the same request
// (see betLines) -- so a bet costs a few output tokens, not a call of its own.
//
// Which bets: every league playing this season LIVE, only bets nobody has graded yet (a commissioner
// who already decided one doesn't need asking), deduplicated by wording so the same question from two
// leagues is asked once, with both leagues' guesses. Capped so a busy season can't balloon the prompt.
//
// Catching-up leagues are left out on purpose: their bets are made long after the episode aired and
// was researched, so answering them would mean re-running research whenever one of them bets -- an
// unpredictable spend. Their commissioners grade by hand.
const MAX_BETS = 30;

// How a bet's wording is matched to its answer later (the suggested-answer route): case, spacing and
// trailing punctuation don't make it a different question.
function betKey(label) {
  return String(label || "").toLowerCase().replace(/\s+/g, " ").replace(/[\s?.!]+$/, "").trim();
}

async function openBetsFor(pool, showSlug, season, episodeNumber) {
  const { rows } = await pool.query(
    "SELECT state FROM leagues WHERE state->'settings'->>'showId' = $1 AND state->'settings'->>'wikiSeason' = $2",
    [showSlug, String(season)]
  );
  const byKey = new Map();
  for (const { state } of rows) {
    if (StateLogic.RevealLogic.isCatchingUp(state)) continue;
    const ep = ((state && state.episodes) || []).find((e) => e.number === episodeNumber);
    for (const bet of (ep && ep.bets) || []) {
      const graded = (bet.predictions || []).some((p) => p.correct === true || p.correct === false);
      const key = betKey(bet.label);
      if (graded || !key) continue;
      if (!byKey.has(key)) byKey.set(key, { label: String(bet.label).trim(), guesses: [] });
      const entry = byKey.get(key);
      for (const p of bet.predictions || []) {
        const guess = String(p.guess || "").trim();
        if (guess && !entry.guesses.some((g) => g.toLowerCase() === guess.toLowerCase())) entry.guesses.push(guess);
      }
    }
  }
  return [...byKey.values()].slice(0, MAX_BETS);
}

// The model's bet answers, tied back to the bets' own wording (it answers by number) and held to the
// guesses actually listed -- a "correct guess" nobody made is dropped rather than trusted.
function betAnswersFrom(parsed, bets) {
  return (parsed.betAnswers || [])
    .filter((a) => Number.isInteger(a.bet) && a.bet >= 1 && a.bet <= bets.length)
    .map((a) => {
      const bet = bets[a.bet - 1];
      const listed = (g) => bet.guesses.find((x) => x.toLowerCase() === String(g).trim().toLowerCase());
      return {
        question: bet.label,
        guesses: bet.guesses,
        answer: a.answer == null || String(a.answer).trim() === "" ? null : String(a.answer).trim(),
        correctGuesses: a.answer == null ? [] : (a.correctGuesses || []).map(listed).filter(Boolean),
        evidence: a.evidence || null,
        sources: a.sources || [],
        confidence: a.confidence || "low",
      };
    });
}

/**
 * The research answer to one side bet, looked up by its wording, or null when this episode's research
 * didn't settle that bet (no research yet, or the bet was made after it ran).
 */
async function storedBetAnswer(pool, { showId, season, episodeNumber, label }) {
  const { rows } = await pool.query(
    "SELECT payload, researched_at FROM episode_research WHERE show_id=$1 AND season_number=$2 AND episode_number=$3 AND source = 'combined'",
    [showId, season, episodeNumber]
  );
  if (!rows.length) return { researched: false, answer: null };
  const key = betKey(label);
  const found = ((rows[0].payload && rows[0].payload.betAnswers) || []).find((a) => betKey(a.question) === key) || null;
  return { researched: true, researchedAt: rows[0].researched_at, answer: found };
}

// ---------- the cache (db/migrations/0014) ----------
// Keyed on (show, season, episode) and NOT on anything about the sources, unlike wiki_extractions:
// there is no revision id for "the internet as it was last Thursday", so the only honest cache rule
// is "we already researched this episode once; ask again only if you say so".

/**
 * Whether stored answers were asked by what asks now (`ctx`: its format and the rulebook asking, contextFrom), so they
 * answer its questions: asked by the same rulebook (recorded since docs/PLAN-start-a-game-gpt.md S2), whatever its format
 * is called now, so a season's rulebook moved onto new rules with its question map keeps its answers; or by the same format
 * (research from before formats recorded none, and was all asked under the default). A rulebook frozen from one format is
 * never rewritten as another's (db/rulebooks.js ensureSeasonRulebook makes that one anew), so the same rulebook is the same
 * questions.
 */
function askedAlike(provenance, ctx) {
  const p = provenance || {};
  if (p.rulebook && ctx.rulebook && p.rulebook.id === ctx.rulebook.id) return true;
  return (p.format || Formats.DEFAULT_FORMAT) === ctx.format.id;
}

async function cachedResearch(pool, ctx, episodeNumber, opts) {
  if (opts.force) return null;
  const { rows } = await pool.query(
    `SELECT id, payload, provenance, researched_at FROM episode_research
      WHERE show_id=$1 AND season_number=$2 AND episode_number=$3 AND source = 'combined'`,
    [ctx.showId, ctx.season, episodeNumber]
  );
  if (!rows.length) return null;
  // Answers another rulebook asked (the season's rules were made again, or the show was switched since) don't answer this one.
  if (!askedAlike(rows[0].provenance, ctx)) return null;
  console.log(
    `[research] episode ${episodeNumber} was researched ${new Date(rows[0].researched_at).toISOString()} ` +
      "-- reusing it (no model call). Pass --force to research it again."
  );
  return { ...rows[0], cached: true };
}

// One run's answers folded into what's already stored for the episode -- for a PARTIAL run, one asked
// only about the people the stored answers didn't settle (docs/PLAN-episode-research-compiled-cache.md).
// Replacing wholesale, as a full run does, would erase everyone that run deliberately didn't ask about.
//
//   - Someone the new run didn't answer for keeps their stored entry, untouched.
//   - Someone in both keeps the more confident entry; a tie goes to the new one (it's more recent).
//     A replaced entry keeps the stored spelling of the name, so the same person from two leagues'
//     rosters ("Jon" / "Jon Lovett") stays one entry -- and one season decision -- not two.
//   - Episode-level answers are the new run's, except where it had nothing (null / "unknown") and
//     the stored ones did. Side-bet answers are merged by question, the new run's winning.
//
//
// `fill`: a SECOND full pass (a commissioner's "research again": another model, or the first pass was
// too early), merged field by field instead of entry by entry -- see fillEntry.
//
// Answers to another format's checklist don't merge with this one's (see cachedResearch): the new
// run's payload is returned as-is. Pure, so it's tested without a database.
function mergeResearchPayload(stored, incoming, { fill = false } = {}) {
  if (!stored || !Array.isArray(stored.castaways)) return { payload: incoming, kept: [], replaced: [], added: [], disagreements: [] };
  const disagreements = [];
  const castaways = stored.castaways.map((c) => ({ ...c }));
  const roster = { castaways: castaways.map((c, i) => ({ id: String(i), name: c.name })) };
  const kept = new Set(castaways.map((c) => c.name));
  const replaced = [];
  const added = [];
  for (const entry of incoming.castaways || []) {
    const { castaway } = StateLogic.Core.findCastawayByName(roster, entry.name);
    if (!castaway) {
      castaways.push(entry);
      added.push(entry.name);
      continue;
    }
    const i = Number(castaway.id);
    const was = castaways[i];
    kept.delete(was.name);
    if (fill) {
      const filled = fillEntry(was, entry);
      castaways[i] = filled.entry;
      disagreements.push(...filled.disagreements);
      replaced.push(was.name);
    } else if ((CONFIDENCE_RANK[entry.confidence] || 0) >= (CONFIDENCE_RANK[was.confidence] || 0)) {
      castaways[i] = { ...entry, name: was.name };
      replaced.push(was.name);
    }
  }

  const payload = { ...stored };
  for (const [key, value] of Object.entries(incoming)) {
    if (key === "castaways" || key === "betAnswers") continue;
    // Pages read are pooled across runs, by URL, the newer run's dates winning.
    if (key === "sourcesRead") {
      const byUrl = new Map();
      for (const src of [...(stored.sourcesRead || []), ...(value || [])]) if (src && src.url) byUrl.set(src.url, src);
      payload.sourcesRead = [...byUrl.values()];
      continue;
    }
    // The format section, a second pass filling in what the first couldn't tell, field by field (fillFormatState).
    if (key === "formatState" && fill && value && stored.formatState) {
      payload.formatState = fillFormatState(stored.formatState, value);
      continue;
    }
    const empty = value == null || value === "unknown";
    if (!empty || stored[key] == null) payload[key] = value;
  }
  payload.castaways = castaways;
  if (incoming.betAnswers || stored.betAnswers) {
    const byQuestion = new Map();
    for (const a of [...(stored.betAnswers || []), ...(incoming.betAnswers || [])]) byQuestion.set(betKey(a.question), a);
    payload.betAnswers = [...byQuestion.values()];
  }
  return { payload, kept: [...kept], replaced, added, disagreements };
}

// One person's two passes, field by field. A pass that couldn't tell ("unknown", null, empty) never
// erases one that could, and otherwise the later pass wins -- research run too early says "no" or
// "unknown" about what hadn't been reported yet. The one exception: a later "no" doesn't silently erase
// an earlier "yes". Two passes disagreeing about whether something happened is the reviewer's call, so
// the "yes" is kept (it stages a result they can untick) and the disagreement is reported. Sources are
// pooled, and the confidence is the better of the two. The stored spelling of the name is kept.
function fillEntry(was, now) {
  const out = { ...was };
  const disagreements = [];
  const empty = (v) => v == null || v === "unknown" || v === "" || (Array.isArray(v) && !v.length);
  for (const [key, value] of Object.entries(now)) {
    if (key === "name") continue;
    if (key === "sources") {
      out.sources = [...new Set([...(was.sources || []), ...(value || [])])];
      continue;
    }
    if (key === "confidence") {
      if ((CONFIDENCE_RANK[value] || 0) > (CONFIDENCE_RANK[was.confidence] || 0)) out.confidence = value;
      continue;
    }
    if (empty(value)) continue;
    if (was[key] === "yes" && value === "no") {
      // The checklist key in words ("foundAdvantage" -> "found advantage"): it's read by a commissioner.
      const what = key.replace(/([A-Z])/g, " $1").toLowerCase();
      disagreements.push(`${was.name}: the first research said yes to "${what}", this one says no. Kept as yes; untick it below if it's wrong.`);
      continue;
    }
    out[key] = value;
  }
  return { entry: out, disagreements };
}

// The format section's two passes (F2), as fillEntry does a person's: the later pass wins where it could tell, and one
// that couldn't (unknown, null, nothing listed) never erases one that could. An empty list of groups is an answer
// (everyone for themselves), so it replaces; null (not known) doesn't. Pure.
function fillFormatState(was, now) {
  const out = { ...was };
  for (const [key, value] of Object.entries(now)) {
    if (key === "groups" || key === "alone") continue;
    if (value == null || value === "unknown" || (Array.isArray(value) && !value.length)) continue;
    out[key] = value;
  }
  // Who is with whom and who's on their own are one answer: a pass that knows the groups says both.
  if (Array.isArray(now.groups)) {
    out.groups = now.groups;
    out.alone = Array.isArray(now.alone) ? now.alone : [];
  }
  return out;
}

const CONFIDENCE_RANK = { low: 1, medium: 2, high: 3 };

// `opts.merge`: fold this run into what's stored (mergeResearchPayload) instead of replacing it --
// only the per-league path sets it, because only it sends partial runs. Every other caller (the admin
// research and paste paths, the CLI, auto-research) replaces exactly as before: a full run is meant to
// be the whole answer, including dropping someone a later read shows was already out.
async function storeResearch(pool, ctx, payload, provenance, opts) {
  if (opts.dry) {
    console.log("[research] --dry: nothing written");
    return { id: null, payload, provenance, cached: false };
  }
  // Whatever this run says about the next episode goes to the season's schedule either way (0067).
  const next = payload && payload.nextEpisode;
  if (opts.merge) {
    const stored = await storeMergedResearch(pool, ctx, payload, provenance, { fill: !!opts.fill, onto: Array.isArray(opts.only) });
    await recordNextEpisode(pool, ctx, next);
    return stored;
  }
  const { rows } = await pool.query(
    `INSERT INTO episode_research (show_id, season_number, episode_number, payload, provenance)
     VALUES ($1,$2,$3,$4::jsonb,$5::jsonb)
     ON CONFLICT (show_id, season_number, episode_number) WHERE source = 'combined'
     DO UPDATE SET payload=EXCLUDED.payload, provenance=EXCLUDED.provenance, researched_at=now()
     RETURNING id`,
    [ctx.showId, ctx.season, ctx.episodeNumber, JSON.stringify(payload), JSON.stringify(provenance)]
  );
  await recordNextEpisode(pool, ctx, next);
  return { id: rows[0].id, payload, provenance, cached: false };
}

/**
 * The next episode's schedule from one episode's research, cleaned up, or null when it says nothing usable.
 * Pure. `airsAt` must name a real start later than `now` and within 60 days (research of an old episode
 * names a next one that has already aired, and the wiki has those): with a UTC offset as asked, or else read
 * in the season's zone, and a bare date takes the season's usual start time. `minutes` must be 10 to 300.
 */
function nextEpisodeFrom(next, { tz = "America/New_York", airTime = Air.DEFAULT_AIR_TIME, now = new Date() } = {}) {
  if (!next || typeof next !== "object") return null;
  const raw = typeof next.airsAt === "string" ? next.airsAt.trim() : "";
  // An offset from before the clocks change is read as the announced time in the season's zone (Air.exactInZone).
  let at = Air.exactInZone(raw, tz);
  if (!at) {
    const m = /^(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}:\d{2}))?/.exec(raw);
    if (m) at = Air.zonedToUtc(m[1], m[2] || String(airTime).slice(0, 5), tz);
  }
  const t = at && !Number.isNaN(at.getTime()) ? at.getTime() : null;
  const airAt = t !== null && t > now.getTime() && t < now.getTime() + 60 * 24 * 3600 * 1000 ? new Date(t) : null;
  const n = Number(next.minutes);
  const minutes = next.minutes != null && Number.isFinite(n) && n >= 10 && n <= 300 ? Math.round(n) : null;
  const note = typeof next.note === "string" && next.note.trim() ? next.note.trim().slice(0, 200) : null;
  if (!airAt && minutes === null) return null;
  return { airAt, minutes, note };
}

/**
 * Files what one episode's research says about the next (episode + 1) in season_episodes (0067), where the
 * season_air_dates view lays it over the wiki's dates. A field the answer leaves out keeps what's there, and
 * a schedule an admin set by hand is never overwritten. Best effort: a failure is logged, never thrown, so it
 * can't cost the research it came with.
 */
async function recordNextEpisode(pool, ctx, next) {
  // Nothing said about the next episode (most answers before 0067, a finale): not even a lookup.
  if (!next || (typeof next.airsAt !== "string" && next.minutes == null)) return null;
  try {
    const { rows } = await pool.query(
      "SELECT id, air_tz, to_char(air_time, 'HH24:MI') AS air_time FROM show_seasons WHERE show_id=$1 AND season_number=$2",
      [ctx.showId, ctx.season]
    );
    if (!rows.length) return null;
    const clean = nextEpisodeFrom(next, { tz: rows[0].air_tz || undefined, airTime: rows[0].air_time || undefined });
    if (!clean) return null;
    const written = await pool.query(
      `INSERT INTO season_episodes (season_id, number, air_at, runtime_min, note, source, reported_in, updated_at)
       VALUES ($1, $2, $3, $4, $5, 'research', $6, now())
       ON CONFLICT (season_id, number) DO UPDATE SET
         air_at = COALESCE(EXCLUDED.air_at, season_episodes.air_at),
         runtime_min = COALESCE(EXCLUDED.runtime_min, season_episodes.runtime_min),
         note = COALESCE(EXCLUDED.note, season_episodes.note),
         reported_in = EXCLUDED.reported_in,
         updated_at = now()
       WHERE season_episodes.source <> 'admin'`,
      [rows[0].id, ctx.episodeNumber + 1, clean.airAt, clean.minutes, clean.note, ctx.episodeNumber]
    );
    if (!written.rowCount) {
      console.log(`[research] episode ${ctx.episodeNumber + 1}: kept the schedule an admin set`);
      return null;
    }
    console.log(
      `[research] episode ${ctx.episodeNumber + 1} of ${ctx.showName || ctx.showSlug || "the show"} season ${ctx.season}: ` +
        `${clean.airAt ? clean.airAt.toISOString() : "time not given"}, ${clean.minutes ?? "?"} min${clean.note ? ` (${clean.note})` : ""}`
    );
    return clean;
  } catch (e) {
    console.error(`[research] couldn't record the next episode: ${e instanceof Error ? e.message : e}`);
    return null;
  }
}

// Read, merge and write under one lock on the episode's key, so two leagues pasting the same episode
// at once can't each merge into the same old copy and have the second write drop the first's answers.
// (An advisory lock rather than FOR UPDATE: the first paste for an episode has no row yet to lock.)
async function storeMergedResearch(pool, ctx, payload, provenance, mergeOpts = {}) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`episode_research:${ctx.showId}:${ctx.season}:${ctx.episodeNumber}`]);
    const { rows: prior } = await client.query(
      "SELECT payload, provenance, researched_at FROM episode_research WHERE show_id=$1 AND season_number=$2 AND episode_number=$3 AND source = 'combined'",
      [ctx.showId, ctx.season, ctx.episodeNumber]
    );
    const sameFormat = prior.length && askedAlike(prior[0].provenance, ctx);
    // Just some questions' answers, alone, would stand for the whole episode.
    if (mergeOpts.onto && !sameFormat) throw new Error("There are no stored answers for this episode to add the new questions to.");
    const merged = mergeResearchPayload(sameFormat ? prior[0].payload : null, payload, mergeOpts);
    const fullProvenance = {
      ...provenance,
      // Whose answers this row now holds besides this run's, for a reviewer reading it later.
      ...(sameFormat
        ? {
            mergedInto: {
              researchedAt: prior[0].researched_at,
              provider: prior[0].provenance && prior[0].provenance.provider,
              castKept: merged.kept,
            },
          }
        : {}),
    };
    const { rows } = await client.query(
      `INSERT INTO episode_research (show_id, season_number, episode_number, payload, provenance)
       VALUES ($1,$2,$3,$4::jsonb,$5::jsonb)
       ON CONFLICT (show_id, season_number, episode_number) WHERE source = 'combined'
       DO UPDATE SET payload=EXCLUDED.payload, provenance=EXCLUDED.provenance, researched_at=now()
       RETURNING id`,
      [ctx.showId, ctx.season, ctx.episodeNumber, JSON.stringify(merged.payload), JSON.stringify(fullProvenance)]
    );
    await client.query("COMMIT");
    return { id: rows[0].id, payload: merged.payload, provenance: fullProvenance, cached: false, merged };
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

// ---------- staging: turning answered checklists into season decisions ----------
//
// Research stages into the same season_decisions table as the wiki connector (db/migrations/0019),
// for an admin to decide once for every league. A fact both sources report lands on one row, marked
// as coming from both.

// One "yes" answer -> one item CANDIDATE. Only 'yes' ever produces one: 'no' is a fact worth
// recording but not a scoring event, and 'unknown' must never silently become one -- collapsing that
// distinction is exactly the failure the three-valued schema exists to prevent (see the top of this
// file). Which answers imply which results is the format's (format.research.items).
// `payload` is the whole episode's answers: some results depend on other people's (who went home
// decides who "voted with the majority"). Names are compared by who they resolve to among the
// checklist's own people, so "Nicole" matches "Nicole Mazullo".
// `episode` is the episode the answers are for: rules a season change added only apply from its
// effective episode, and with no episode they don't apply at all (formats/rules.js EPISODE GATING).
function itemsFromChecklist(entry, format, payload, episode) {
  const roster = { castaways: ((payload && payload.castaways) || []).map((c, i) => ({ id: String(i), name: c.name })) };
  const who = (name) => {
    const { castaway } = StateLogic.Core.findCastawayByName(roster, name);
    return castaway ? castaway.id : String(name || "").trim().toLowerCase();
  };
  const ctx = { payload, same: (a, b) => who(a) === who(b), episode };
  const items = [];
  // `method` is only for a role (the role value); an event's identity is its eventType. `units` only for a
  // count (a rule's `per`: 3 home runs), which rides on the one item.
  const add = (kind, eventType, method = "", units) =>
    items.push({
      castawayName: entry.name, kind, eventType, method, confidence: entry.confidence, sources: entry.sources || [],
      ...(units != null ? { units } : {}),
    });
  // Leaving the game is the one result every format shares. It used to come only from the wiki's
  // tables (research was an add-on), so research -- and a paste, which is research -- never staged
  // an elimination: the person who went home was simply missing from review.
  if (entry.leftTheGame === "yes" && entry.exitMethod) {
    add("elimination", "", entry.exitMethod);
    // A finalist's jury votes ride on their elimination (Survivor scores each one; see
    // formats/survivor.js impliedEvents). Absent for anyone else, and from formats that don't ask.
    if (Number.isInteger(entry.juryVotesReceived)) items[items.length - 1].juryVotes = entry.juryVotesReceived;
  }
  // A group move (a swap, a new tribe, the merge), staged exactly as the wiki's were: method is the
  // group's name. validateResearch already nulled one that just repeats the group they went in on.
  if (format.hasGroups && typeof entry.newGroup === "string" && entry.newGroup.trim()) add("group", "", entry.newGroup.trim());
  format.research.items(entry, add, ctx);
  return items;
}

// All the candidates for one episode's research, deduplicated by (name, kind, eventType) -- the same
// identity the unique index enforces, which is also what collapses two answers that imply the same
// result (Survivor's individual and tribe reward both mean rewardWin). Computed once because the
// answers are identical for every league on the season; only the reveal gate below varies per league.
function candidatesFor(payload, format, episode) {
  const byKey = new Map();
  for (const entry of payload.castaways || []) {
    for (const item of itemsFromChecklist(entry, format, payload, episode)) {
      const key = `${item.castawayName.toLowerCase()}|${item.kind}|${item.eventType}`;
      if (!byKey.has(key)) byKey.set(key, item);
    }
  }
  // Staging order is placement order for a multi-exit episode (created_at is the tiebreak), and the
  // checklist runs in cast order -- so the winner goes last, as a finale's placements require.
  const winner = format.winnerExitMethod;
  const isWin = (i) => i.kind === "elimination" && i.method === winner;
  return [...byKey.values()].sort((a, b) => Number(isWin(a)) - Number(isWin(b)));
}

/**
 * Stages one research run's "yes" answers as pending season decisions. Names are the season cast's
 * own (research is asked about exactly those names), mapped through the same forgiving match anyway
 * in case the model reworded one. Post-merge isn't something research asks about, so it's borrowed
 * from whatever the wiki already staged for that episode.
 */
async function stageResearchDecisions(pool, run, opts = {}) {
  const seasonId = run.seasonId || (await decisions.seasonIdFor(pool, run.showId, run.season));
  if (!seasonId) throw new Error(`${run.showSlug} season ${run.season} isn't in the catalog.`);
  const items = await researchItems(pool, seasonId, run, run.payload);
  if (opts.dry || !run.id) return { inserted: 0, updated: 0, withdrawn: 0, total: items.length, dry: true };
  const r = await decisions.stageDecisions(pool, seasonId, items, "research", run.id, { episode: run.episodeNumber });
  return { ...r, total: items.length };
}

/**
 * The results one set of answers implies, as stageDecisions takes them: what stageResearchDecisions stages for the
 * combined answers, and what one submission reports (step 6b: a paste's own answers, src/lib/server/community-results.ts).
 */
async function researchItems(pool, seasonId, run, payload) {
  const castState = await decisions.seasonCastState(pool, seasonId);
  const { rows: merge } = await pool.query(
    "SELECT bool_or(post_merge) AS post_merge FROM season_decisions WHERE season_id=$1 AND episode_number=$2 AND from_wiki",
    [seasonId, run.episodeNumber]
  );
  // Research answers it itself now (`merged`); a wiki-staged flag from before that is still honoured.
  const postMerge = (payload && payload.merged === "yes") || !!(merge[0] && merge[0].post_merge);
  // Someone answered for under their own name whom the cast's forgiving match would make someone else who has an entry of their
  // own (a newcomer "Joy" beside "Joy Jones", F3 part 2) keeps their own name: two people, two rows.
  const own = new Set(((payload && payload.castaways) || []).map((c) => String((c && c.name) || "").trim().toLowerCase()));
  const nameOf = (name) => {
    const canon = decisions.canonicalName(castState, name);
    return canon.toLowerCase() !== String(name).trim().toLowerCase() && own.has(canon.toLowerCase()) ? name : canon;
  };
  return candidatesFor(payload, run.format, run.episodeNumber).map((c) => ({
    episode: run.episodeNumber,
    postMerge,
    kind: c.kind,
    name: nameOf(c.castawayName),
    method: c.method || "",
    eventType: c.eventType,
    juryVotes: Number.isInteger(c.juryVotes) ? c.juryVotes : null,
    units: c.units != null ? c.units : null,
    confidence: c.confidence,
    sources: c.sources,
  }));
}

// The rules stored answers were asked by, which is what their shape follows, with the season's rule changes in effect by
// that episode: the rulebook that asked them when it's no longer the season's (`current`: the season's rulebook id; its
// rules were made again since), else the season's by the format they were asked under.
async function askedFormat(pool, seasonId, current, r) {
  const p = r.provenance || {};
  const then = p.rulebook && p.rulebook.id !== current ? await Rulebooks.compiledFor(pool, p.rulebook.id) : null;
  if (!then) return SeasonRuleChanges.seasonFormat(pool, seasonId, { formatId: p.format || r.format, episode: r.episode_number });
  const base = Formats.formatForRulebook(then.data, then.reader);
  try {
    return Formats.withChanges(base, await SeasonRuleChanges.approvedChanges(pool, seasonId, { throughEpisode: r.episode_number }));
  } catch (e) {
    console.log(`[research] ! season rule changes not applied: ${e.message}`);
    return base;
  }
}

/** Re-stages every episode already researched for a season, from the stored answers -- no search,
 * no model call. The research counterpart of wiki-sync's stageCachedSeasonEpisodes. */
async function stageCachedSeasonResearch(pool, seasonId) {
  const { rows } = await pool.query(
    `SELECT er.id, er.episode_number, er.payload, er.provenance, s.id AS show_id, s.slug, s.format, ss.season_number
       FROM show_seasons ss
       JOIN shows s ON s.id = ss.show_id
       JOIN episode_research er ON er.show_id = s.id AND er.season_number = ss.season_number AND er.source = 'combined'
      WHERE ss.id = $1
      ORDER BY er.episode_number`,
    [seasonId]
  );
  const { rows: season } = await pool.query("SELECT rulebook_id FROM show_seasons WHERE id=$1", [seasonId]);
  const current = season[0] ? season[0].rulebook_id : null;
  let inserted = 0;
  for (const r of rows) {
    const out = await stageResearchDecisions(pool, {
      id: r.id,
      seasonId,
      showId: r.show_id,
      showSlug: r.slug,
      season: r.season_number,
      episodeNumber: r.episode_number,
      payload: r.payload,
      format: await askedFormat(pool, seasonId, current, r),
    });
    inserted += out.inserted;
  }
  return { episodes: rows.length, inserted };
}

// ---------- the run ----------
/** Admin > Shows & Seasons: research one episode of one catalogued season, and stage the answered
 * checklist as season decisions for the admin to review alongside the wiki's -- the same table and
 * the same review, so nothing reaches a league until an admin accepts it. */
async function researchSeasonEpisode(pool, showSlug, season, episodeNumber, opts = {}) {
  requireEpisodeNumber(episodeNumber);
  const result = await runFor(pool, await resolveSeasonResearchContext(pool, showSlug, season, episodeNumber), opts);
  return { ...result, decisions: await stageResearchDecisions(pool, result, opts) };
}

/** The CLI's way in: a league id, which is what a developer has to hand -- it names the season. The
 * answers are staged for the whole season, like the admin path. */
async function researchEpisode(pool, leagueId, episodeNumber, opts = {}) {
  requireEpisodeNumber(episodeNumber);
  const result = await runFor(pool, await resolveResearchContext(pool, leagueId, episodeNumber), opts);
  return { ...result, decisions: await stageResearchDecisions(pool, result, opts) };
}

function requireEpisodeNumber(episodeNumber) {
  if (!Number.isInteger(episodeNumber) || episodeNumber < 1) {
    throw new Error(`Episode number must be a positive whole number, got "${episodeNumber}".`);
  }
}

// ---------- manual / paste import ----------
// A second way in, for an admin who'd rather spend a normal chat-with-search session of their own
// (a ChatGPT/Claude/Gemini web tab, no API key, no per-search fee) than pay this file's own
// search-and-structure call. Two pieces:
//
//   buildPastePrompt  -- the exact same system+user instructions runFor sends itself (same rules,
//                        same cast list, same "cite it or it didn't happen"), joined into one
//                        paste-able message, since a consumer chat UI is one box, not a system/user
//                        pair. Whatever comes back -- prose, bullets, even a stray table -- is fine
//                        input to the next piece, on purpose: making an outside chat match a strict
//                        JSON schema is the one thing that's genuinely unreliable across providers.
//
//   researchFromPaste -- takes whatever the admin pastes back as free-text "notes" and fits it to the
//                        schema with ONE cheap, non-search call: literally the same structure() an
//                        Anthropic two-pass fallback already uses when a search provider can't answer
//                        in a schema directly (STRUCTURE_SYSTEM: "use only what the notes contain; do
//                        not add facts, do not fill gaps from your own knowledge"). No search tool, no
//                        search fee -- a haiku-tier structuring call instead of an opus-tier
//                        search-and-answer one. From there it's the identical pipeline a real search
//                        run goes through: validateResearch (coverage, self-contradictions, "a claim
//                        with no source cited" still flagged exactly the same way), storeResearch,
//                        stageResearchDecisions. Nothing about the review an admin does afterward
//                        knows or cares which path produced the checklist.
// Two answer styles. "text" (prose, parsed by one cheap model call) is the forgiving default. "json"
// asks the outside chat for the checklist's exact shape and is parsed directly -- no model call at
// all, so it's free -- at the price of a chat occasionally getting the shape wrong, which surfaces as
// a clear "fix this and paste again" error rather than a silent charge.
// `pasteBack` replaces the last line (where to paste the answer) -- the admin panel's box by default.
function buildPastePrompt(ctx, bets, { structured = false, pasteBack = null } = {}) {
  const { system, user } = buildPrompt({ ...ctx, bets });
  const closing = structured
    ? [
        "Answer with ONE JSON object and nothing else -- no commentary before or after it. It must match",
        "this JSON Schema exactly:",
        "",
        JSON.stringify(jsonSchemaFor(researchSchemaFor(ctx.format, bets.length > 0, ctx.groupWord), "strict"), null, 1),
        "",
        "Start from this skeleton: it already has one entry per person, in the right order, with every",
        "answer set to its 'don't know' value. Change only what your sources establish, keep every name",
        "exactly as written, and fill in `sources` with the URLs you actually read.",
        "",
        JSON.stringify(pasteSkeleton(ctx, bets), null, 2),
        "",
        pasteBack || "Paste the JSON back into Game Your Show's \"Paste research notes\" box with \"Structured (JSON)\" ticked.",
      ]
    : [
        "Answer in plain prose or bullet points, one section per person, in the order given -- not JSON,",
        "not a table. Say plainly when you don't know something rather than guessing.",
        "",
        "Start with the episode's title, air date and a two- or three-sentence summary. Then when the NEXT",
        "episode airs (its date, start time with the time zone, and length), from this episode's preview or the",
        "network's schedule, and anything unusual: a week off, a two-hour episode. List every page you",
        "read with the date it says it was published (and last updated, if it says), with the time if shown.",
        "Then one line,",
        `"Rules note:", answering this: ${RULES_NOTE.replace(/\bNull\b/g, "None")}`,
        ...(asksFormat(ctx.format) ? proseFormat() : []),
        "Then, for EACH person, cover every one of these (say \"no\" or \"not reported\" rather than skipping one):",
        ...proseChecklist(ctx.format, ctx.groupWord),
        "",
        "Paste your whole answer back into Game Your Show's \"Paste research notes\" box for this episode.",
      ];
  return system + "\n\n" + user + "\n\n" + closing.join("\n");
}

// The per-person checklist as plain questions, for the prose prompt. Read off the same schema the
// answer is structured into, so a question added to a show's checklist is asked here too -- a
// structuring pass can't score what the chat never mentioned.
function proseChecklist(format, word = null) {
  const person = jsonSchemaFor(researchSchemaFor(format, false, word), "strict").properties.castaways.items.properties;
  return Object.entries(person)
    .filter(([key]) => !["name", "sources", "confidence"].includes(key))
    .map(([key, node]) => {
      const readable = key.replace(/([A-Z])/g, " $1").toLowerCase();
      const text = node.description ? node.description.replace(/\bNull\b/g, "None") : readable.charAt(0).toUpperCase() + readable.slice(1) + "?";
      return `  - ${text}`;
    })
    .concat(["  - The URLs you read for this person."]);
}

// The format section as plain questions, for the prose prompt: read off the same schema, as proseChecklist is.
function proseFormat() {
  const node = FormatState.unwrap ? FormatState.unwrap() : FormatState;
  const each =
    ` Each one with its kind (${KIND_WORDS}), when it came in (start, mid or end), the episode it takes effect from, ` +
    "one sentence on what it is, and how sure you are (high or low).";
  return ["Then a section \"How the game is organised:\", answering each of these:"].concat(
    Object.entries(node.shape).map(([key, field]) => `  - ${key}: ${String(field.description || key).replace(/\bnull\b/g, "none")}${key === "changes" ? each : ""}`)
  );
}

// A filled-in example of the answer, built from the same schema the answer is validated against, so it
// can't drift from it: every person still in the game, every open bet, every answer at its most
// non-committal value ("unknown", then "low" confidence, then null). A chat edits a skeleton far more
// reliably than it writes a schema out from scratch.
function pasteSkeleton(ctx, bets) {
  const json = jsonSchemaFor(researchSchemaFor(ctx.format, bets.length > 0, ctx.groupWord), "strict");
  const out = skeletonValue(json);
  // The format section is null only for an answer from before it was asked: the skeleton shows its fields, each at its
  // don't-know value (who is with whom: null, not known).
  if (json.properties.formatState) {
    const node = json.properties.formatState;
    out.formatState = skeletonValue((node.anyOf || node.oneOf || []).find((v) => v && v.type !== "null") || node);
  }
  const entry = json.properties.castaways.items;
  out.castaways = ctx.castNames.map((name) => ({ ...skeletonValue(entry), name }));
  if (json.properties.betAnswers) {
    const betEntry = json.properties.betAnswers.items;
    out.betAnswers = bets.map((_, i) => ({ ...skeletonValue(betEntry), bet: i + 1 }));
  }
  return out;
}

function skeletonValue(node) {
  if (!node || typeof node !== "object") return null;
  const variants = node.anyOf || node.oneOf;
  const nullable =
    (Array.isArray(node.type) && node.type.includes("null")) || (variants || []).some((v) => v && v.type === "null");
  if (variants) {
    const real = variants.find((v) => v && v.type !== "null");
    return nullable ? null : skeletonValue(real);
  }
  if (Array.isArray(node.enum)) {
    if (node.enum.includes("unknown")) return "unknown";
    if (node.enum.includes("low")) return "low";
    return nullable ? null : node.enum[0];
  }
  if (nullable) return null;
  const type = Array.isArray(node.type) ? node.type[0] : node.type;
  if (type === "object") {
    const obj = {};
    for (const [key, child] of Object.entries(node.properties || {})) obj[key] = skeletonValue(child);
    return obj;
  }
  if (type === "array") return [];
  if (type === "string") return "";
  if (type === "number" || type === "integer") return 0;
  if (type === "boolean") return false;
  return null;
}

// Chat UIs wrap JSON in a code fence, or say "Here's the JSON:" first, however firmly told not to.
// Everything from the first `{` to the last `}` is the object; anything else is chatter.
function extractJsonObject(text) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) {
    throw new Error("There's no JSON in what was pasted: paste the AI's whole reply to the prompt (it starts with {).");
  }
  return text.slice(start, end + 1);
}

/**
 * Season-scoped: builds the paste prompt for one episode, the same way researchSeasonEpisode resolves
 * its context (staged cast, who's still in the game, the season's open side bets). Read-only -- no
 * model call, nothing written; it only assembles text for the admin to copy.
 */
//
// `opts.only: "missing"` asks only what the episode's stored answers have nothing for (a question added since: unaskedKeys),
// answering `only`, the keys asked, for researchFromPaste's own `only`: [] when there's nothing to ask (and no prompt), null
// when there are no stored answers of this checklist to add to (the whole checklist, as without it).
async function buildPasteImportPrompt(pool, showSlug, season, episodeNumber, opts = {}) {
  requireEpisodeNumber(episodeNumber);
  const ctx = await resolveSeasonResearchContext(pool, showSlug, season, episodeNumber);
  let only = null;
  if (opts.only === "missing") {
    const stored = await storedResearchFor(pool, ctx);
    if (stored && askedAlike(stored.provenance, ctx)) {
      only = unaskedKeys(ctx.format, stored.payload);
      if (!only.length) return { prompt: null, castCount: ctx.castNames.length, betCount: 0, only };
    }
  }
  const bets = only ? [] : await openBetsFor(pool, ctx.showSlug, ctx.season, episodeNumber);
  return {
    // Always the JSON prompt: a paste is only ever read as JSON (pastedRun).
    prompt: buildPastePrompt(only ? { ...ctx, format: onlyFormat(ctx.format, only) } : ctx, bets, { structured: true }),
    castCount: ctx.castNames.length,
    betCount: bets.length,
    only,
  };
}

/**
 * The manual counterpart to researchSeasonEpisode: an admin pastes back whatever their own
 * web-searching chat produced for buildPastePrompt's prompt, and it's fit to the schema by one cheap,
 * non-search call instead of a real search-and-answer call. Staged into the exact same
 * episode_research row and season_decisions review a real research run produces -- a pasted episode
 * and a searched one are interchangeable from here on, including which one a later re-run overwrites.
 */
//
// `opts.only`: the keys a cut-down prompt asked (buildPasteImportPrompt's `only`): the answer is read for just those (anything
// else it says is dropped) and filled into the stored answers, which it needs: with none of this checklist stored it refuses.
async function researchFromPaste(pool, showSlug, season, episodeNumber, notes, opts = {}) {
  requireEpisodeNumber(episodeNumber);
  const trimmed = requireNotes(notes);
  const ctx = await resolveSeasonResearchContext(pool, showSlug, season, episodeNumber);
  return pastedRun(pool, ctx, episodeNumber, trimmed, opts);
}

function requireNotes(notes) {
  const trimmed = (notes || "").trim();
  if (!trimmed) throw new Error("Paste the notes your own research produced -- nothing was pasted.");
  return trimmed;
}

// ---------- per league: the compiled-research cache (docs/PLAN-episode-research-compiled-cache.md) ----------
// A commissioner's way in, for a league no admin is researching. The stored episode_research row is a
// shared, read-only cache: what any league (or an admin) already found for an episode narrows the next
// league's prompt to just the people it didn't settle, and nobody's answers change any league but their
// own -- applying is each commissioner's separate, per-league step (src/lib/server/episode-research-apply.ts).

// Who the stored answers already settle, among the people this league's checklist would ask about.
// One confidence per person per episode (formats/checklist.js's CORE_FIELDS.confidence), so a person is
// settled or not as a whole: medium or high is settled; low or no entry at all is asked again. Stored
// answers another rulebook asked settle nobody (askedAlike: `ctx` is what asks now). Pure.
function researchCoverage(stored, castNames, ctx) {
  const usable = !!stored && !!stored.payload && askedAlike(stored.provenance, ctx);
  const entries = usable ? stored.payload.castaways || [] : [];
  const roster = { castaways: entries.map((c, i) => ({ id: String(i), name: c.name })) };
  const covered = [];
  const lowConfidence = [];
  const missing = [];
  for (const name of castNames) {
    const { castaway } = StateLogic.Core.findCastawayByName(roster, name);
    const entry = castaway ? entries[Number(castaway.id)] : null;
    if (!entry) missing.push(name);
    else if (entry.confidence === "low") lowConfidence.push(name);
    else covered.push(name);
  }
  return {
    researched: !!usable,
    researchedAt: usable ? stored.researched_at || null : null,
    total: castNames.length,
    covered,
    lowConfidence,
    missing,
    needsAsking: [...missing, ...lowConfidence],
  };
}

async function storedResearchFor(pool, ctx) {
  const { rows } = await pool.query(
    "SELECT payload, provenance, researched_at FROM episode_research WHERE show_id=$1 AND season_number=$2 AND episode_number=$3 AND source = 'combined'",
    [ctx.showId, ctx.season, ctx.episodeNumber]
  );
  return rows[0] || null;
}

// A league can be on a season nobody catalogued (League Info takes a free-typed number), but staging
// files decisions against a show_seasons row -- so the first league to research such a season creates
// it, with nothing but its number. Everything else on the row keeps its column default, the same as an
// admin adding a season with only a number; Admin > Shows & Seasons lists it like any other from then on.
async function ensureSeasonRow(pool, ctx) {
  if (ctx.seasonId) return ctx.seasonId;
  await pool.query(
    "INSERT INTO show_seasons (show_id, season_number) VALUES ($1,$2) ON CONFLICT (show_id, season_number) DO NOTHING",
    [ctx.showId, ctx.season]
  );
  const id = await decisions.seasonIdFor(pool, ctx.showId, ctx.season);
  if (!id) throw new Error(`Couldn't add ${ctx.showName} season ${ctx.season} to the catalog.`);
  console.log(`[research] ${ctx.showName} season ${ctx.season} wasn't catalogued -- added it, for its research to be staged against`);
  return id;
}

/**
 * The league's view of one episode's research, for the commissioner panel: who the stored answers
 * already settle, and -- if anyone's left -- the paste prompt narrowed to just them. Read-only: no model
 * call, nothing written, and no season row created (a league only gets one when it actually stages).
 */
// `opts.again`: the prompt asks about EVERYONE still in, however much the stored answers settle -- a
// second pass to fill gaps (another model; or the first was run before the recaps were out).
async function leagueResearchStatus(pool, leagueId, episodeNumber, opts = {}) {
  requireEpisodeNumber(episodeNumber);
  const ctx = await resolveResearchContext(pool, leagueId, episodeNumber);
  const coverage = researchCoverage(await storedResearchFor(pool, ctx), ctx.castNames, ctx);
  const again = !!opts.again && coverage.researched;
  const asking = again ? ctx.castNames : coverage.needsAsking;
  if (!asking.length) return { ctx, coverage, prompt: null, betCount: 0, again: false };
  const bets = await openBetsFor(pool, ctx.showSlug, ctx.season, episodeNumber);
  // The league path is JSON-only: a prose paste is structured by a model call on the site's own key,
  // which is an admin's call to make, not every commissioner's.
  const prompt = buildPastePrompt({ ...ctx, castNames: asking, format: formatForAsking(ctx, asking) }, bets, {
    structured: true,
    // The commissioner's panel (episode-research-panel.tsx), not the admin one: no "Structured" tick box there.
    pasteBack: "Paste the JSON back into Game Your Show's \"Research this episode\" box for this episode.",
  });
  return { ctx, coverage, prompt, betCount: bets.length, again };
}

/**
 * researchFromPaste's per-league sibling: the same pipeline, but resolved through the league (so a
 * season with no staged cast asks about the league's own castaways), asked only about the people the
 * stored answers don't settle, and merged into those answers rather than replacing them. Stages into
 * season_decisions like any other run -- applying any of it to a league is a separate step.
 */
async function researchFromPasteForLeague(pool, leagueId, episodeNumber, notes, opts = {}) {
  requireEpisodeNumber(episodeNumber);
  const trimmed = requireNotes(notes);
  const ctx = await resolveResearchContext(pool, leagueId, episodeNumber);
  const stored = await storedResearchFor(pool, ctx);
  const coverage = researchCoverage(stored, ctx.castNames, ctx);
  // `opts.again`: the answer to leagueResearchStatus's everyone-again prompt, filled in field by field.
  const again = !!opts.again && coverage.researched;
  if (!again && !coverage.needsAsking.length) {
    throw new Error(`Episode ${episodeNumber} is already researched for everyone in this league — there's nothing to paste, just review it.`);
  }
  const seasonId = await ensureSeasonRow(pool, ctx);
  const asking = again ? ctx.castNames : coverage.needsAsking;
  const asked = { ...ctx, seasonId, castNames: asking, format: formatForAsking(ctx, asking) };
  const run = await pastedRun(pool, asked, episodeNumber, trimmed, {
    ...opts,
    structured: true,
    merge: true,
    fill: again,
    // Checked against what the league and the stored research know of every episode, unless the
    // commissioner has already been asked and said yes (`opts.confirmed`).
    checkEpisode: !opts.confirmed,
    leagueEpisodes: (ctx.league && ctx.league.state && ctx.league.state.episodes) || [],
    // A pass about some of the cast asks no format section: the stored one (the whole cast's) says their moves (F3 part 2).
    storedState: stored && stored.payload && askedAlike(stored.provenance, ctx) ? stored.payload.formatState || null : null,
  });
  return { ...run, coverage };
}

// ---------- is this paste for THIS episode? ----------
// Pasting last week's answer into this week's box is easy to do and hard to see: the same names, the
// same layout, and the answer is accepted. The chat does echo the episode's title, air date and a
// summary though, so a paste that carries ANOTHER episode's is caught here, before it's stored (a
// stored one is shared with every league on the season). Only a nudge: a confirmed paste goes through.

const normText = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

// A printed air date ("March 5, 2026") as a whole day count, or null if it isn't one we can read.
function dayNumber(printed) {
  const d = Air.parseAirDate(printed);
  if (!d) return null;
  const [y, m, day] = d.split("-").map(Number);
  return Date.UTC(y, m - 1, day) / 86400000;
}

// Within a day: two sources can print the same night a day apart (a time zone), but two episodes are
// a week apart.
const sameDay = (a, b) => Math.abs(a - b) <= 1;

/** A season's episodes with when each airs (season_episodes), as pasteEpisodeMismatch reads a league's: [{ number, airsAt }]. */
async function scheduledEpisodes(pool, seasonId) {
  if (!seasonId) return [];
  const { rows } = await pool.query("SELECT number, air_at FROM season_episodes WHERE season_id = $1 AND air_at IS NOT NULL", [seasonId]);
  return rows.map((r) => ({ number: r.number, airsAt: new Date(r.air_at).toISOString() }));
}

/**
 * Whether a parsed answer reads like another episode's results rather than `episodeNumber`'s.
 *   siblings        -- [{ episode_number, title, air_date, summary }]: what stored research says of each episode
 *   leagueEpisodes  -- the league's episodes (number, title, airDate: as the wiki printed them)
 * Returns { episode, message } or null. `episode` is the one it looks like (null when the paste is only
 * dated off from this one's own). A paste with no title, date or summary can't be told, so passes. Pure.
 */
function pasteEpisodeMismatch(parsed, episodeNumber, { siblings = [], leagueEpisodes = [] } = {}) {
  const facts = new Map();
  const of = (n) => {
    if (!facts.has(n)) facts.set(n, { titles: new Set(), summaries: new Set(), days: [], printed: null, stored: false });
    return facts.get(n);
  };
  const know = (n, title, printed, summary) => {
    const f = of(n);
    if (normText(title)) f.titles.add(normText(title));
    if (normText(summary).length >= 30) f.summaries.add(normText(summary));
    const day = dayNumber(printed);
    if (day !== null) {
      f.days.push(day);
      f.printed = f.printed || printed;
    }
  };
  for (const s of siblings) {
    know(s.episode_number, s.title, s.air_date, s.summary);
    of(s.episode_number).stored = true;
  }
  // Printed dates only: ep.airsAt is a weekly estimate, which a week off the air would put a week out
  // for every episode after it.
  for (const e of leagueEpisodes) know(e.number, e.title, e.airDate, null);

  const title = normText(parsed.episodeTitle);
  const summary = normText(parsed.summary);
  const day = dayNumber(parsed.airDate);
  const own = of(episodeNumber);
  // A date that fits this episode settles it: whatever another episode holds, a paste dated for this
  // one is this one's (the other may itself be a paste that went to the wrong place). The estimated
  // schedule counts here, in this episode's favour only: it can confirm a date, but being off proves nothing.
  const estimate = (leagueEpisodes.find((e) => e.number === episodeNumber) || {}).airsAt;
  const estimated = estimate && !Number.isNaN(Date.parse(estimate)) ? Math.floor(Date.parse(estimate) / 86400000) : null;
  const ownDay = day !== null && (own.days.some((d) => sameDay(d, day)) || (estimated !== null && sameDay(estimated, day)));
  if (ownDay) return null;

  const others = [...facts.keys()].filter((n) => n !== episodeNumber).sort((a, b) => Math.abs(a - episodeNumber) - Math.abs(b - episodeNumber));
  for (const n of others) {
    const f = facts.get(n);
    let reason = null;
    if (title && f.titles.has(title) && !own.titles.has(title)) reason = `its title, "${parsed.episodeTitle}", is episode ${n}'s`;
    else if (summary.length >= 30 && f.summaries.has(summary) && !own.summaries.has(summary)) reason = `its summary is word for word episode ${n}'s`;
    else if (day !== null && f.days.some((d) => sameDay(d, day))) reason = `it's dated ${parsed.airDate}, the day episode ${n} aired`;
    if (reason) {
      // A paste saved in the wrong episode earlier is the usual cause: say where to look.
      const hint = f.stored ? ` If episode ${n} holds a paste that was meant for another episode, clear it there first.` : "";
      return { episode: n, message: `This looks like episode ${n}'s results, not episode ${episodeNumber}'s: ${reason}.${hint}` };
    }
  }
  // A date well off this episode's own, and not another's we know: a weaker sign, but worth a look.
  if (day !== null && own.days.length && !own.days.some((d) => Math.abs(d - day) <= 4)) {
    return {
      episode: null,
      message: `This may not be episode ${episodeNumber}'s results: they're dated ${parsed.airDate}, but episode ${episodeNumber} is dated ${own.printed || "another day"}.`,
    };
  }
  return null;
}

// What stored research says of each episode of the season, for pasteEpisodeMismatch.
async function siblingEpisodeFacts(pool, ctx) {
  const { rows } = await pool.query(
    "SELECT episode_number, payload->>'episodeTitle' AS title, payload->>'airDate' AS air_date, payload->>'summary' AS summary FROM episode_research WHERE show_id=$1 AND season_number=$2 AND source = 'combined'",
    [ctx.showId, ctx.season]
  );
  return rows;
}

/**
 * Takes a commissioner's pasted research for one episode back out: the shared stored answers (and their
 * search chunks) and every staged result that only research proposed, so the episode asks its question
 * afresh. Results an admin has decided, or the wiki also reported, stay. Changes no league -- what a
 * league has already applied stays applied.
 */
async function clearLeagueResearch(pool, leagueId, episodeNumber) {
  requireEpisodeNumber(episodeNumber);
  const ctx = await resolveResearchContext(pool, leagueId, episodeNumber);
  const key = [ctx.showId, ctx.season, episodeNumber];
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // The same lock a merging paste takes, so a clear can't land in the middle of one.
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`episode_research:${ctx.showId}:${ctx.season}:${episodeNumber}`]);
    const gone = await client.query("DELETE FROM episode_research WHERE show_id=$1 AND season_number=$2 AND episode_number=$3 AND source = 'combined'", key);
    await client.query("DELETE FROM episode_text_chunks WHERE show_id=$1 AND season_number=$2 AND episode_number=$3", key);
    let withdrawn = 0;
    if (ctx.seasonId) {
      await client.query(
        "UPDATE season_decisions SET from_research = false WHERE season_id=$1 AND episode_number=$2 AND status='pending' AND from_research AND fact_status IS NULL",
        [ctx.seasonId, episodeNumber]
      );
      const del = await client.query(
        "DELETE FROM season_decisions WHERE season_id=$1 AND episode_number=$2 AND status='pending' AND NOT from_wiki AND NOT from_research AND fact_status IS NULL",
        [ctx.seasonId, episodeNumber]
      );
      withdrawn = del.rowCount;
    }
    await client.query("COMMIT");
    return { cleared: gone.rowCount > 0, withdrawn };
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

// The body both paste paths share: structure (or parse) the paste, hold it to the checklist, store it,
// index it, stage it. `opts.merge` (the league path) folds it into the stored answers -- and then the
// MERGED answers are what's indexed and staged: staging withdraws a pending research decision its run
// no longer reports, so staging a partial run alone would withdraw everyone it didn't ask about.
async function pastedRun(pool, ctx, episodeNumber, trimmed, opts) {
  const only = Array.isArray(opts.only) ? opts.only : null;
  const bets = only ? [] : await openBetsFor(pool, ctx.showSlug, ctx.season, episodeNumber);
  const schema = researchSchemaFor(only ? onlyFormat(ctx.format, only) : ctx.format, bets.length > 0, ctx.groupWord);

  // Always the pasted JSON, parsed directly: no model, no credentials, no cost. Every paste prompt asks for JSON, and a
  // paste that isn't is refused and pasted again, never handed to a paid model to tidy (decision 9: no paid research;
  // whoever pastes can't spend the site's key). validateLeniently (via parseJsonAnswer) still repairs an out-of-list
  // value to its catch-all and reports it.
  console.log(
    `[research] ${ctx.showName} season ${ctx.season} episode ${episodeNumber}: parsing ${trimmed.length} ` +
      `pasted char(s) of JSON for ${ctx.castNames.length} ${ctx.terms.castaways} (no model call)`
  );
  const parsed = parseJsonAnswer(extractJsonObject(trimmed), schema, "The pasted JSON");
  const usage = { input_tokens: 0, output_tokens: 0 };
  if (bets.length) parsed.betAnswers = betAnswersFrom(parsed, bets);

  if (opts.checkEpisode) {
    const mismatch = pasteEpisodeMismatch(parsed, episodeNumber, {
      siblings: await siblingEpisodeFacts(pool, ctx),
      // No league's episodes (the bot's runs, a season's own): the season's schedule says when each aired, so an answer
      // dated the night this one aired is this one's, even when another aired the same night (a double episode).
      leagueEpisodes: opts.leagueEpisodes ?? (await scheduledEpisodes(pool, ctx.seasonId)),
    });
    // `code` lets the route tell it from a bad paste: it asks the commissioner to confirm rather than refusing.
    if (mismatch) throw Object.assign(new Error(mismatch.message), { code: "EPISODE_MISMATCH", episode: mismatch.episode });
  }

  const review = validateResearch(parsed, ctx.castNames, ctx.terms, ctx.format, {
    partial: !!opts.merge,
    groups: ctx.castGroups,
    formatGoingIn: ctx.formatGoingIn,
    episode: episodeNumber,
    storedState: asksFormat(ctx.format) ? null : opts.storedState || null,
  });
  review.problems.unshift(...(parsed.repairs || []));
  for (const problem of review.problems) console.log(`[research] ! ${problem}`);
  if (review.fatal.length) {
    throw new Error(
      `The pasted notes don't cover the cast, so nothing was saved:\n  ${review.fatal.join("\n  ")}\n` +
        "Check the notes name everyone on the list, using the names this league uses."
    );
  }

  const provenance = {
    provider: "paste",
    // Who pasted: the ask-AI bot (db/bot-research.js) rather than a person.
    ...(opts.via ? { via: opts.via } : {}),
    // No model touched the paste; naming one would make the UI price a call that never happened.
    model: null,
    pasteMode: "json",
    passes: 0,
    researchedAt: new Date().toISOString(),
    showSlug: ctx.showSlug,
    seasonNumber: ctx.season,
    episodeNumber,
    format: ctx.format.id,
    ...(ctx.rulebook ? { rulebook: ctx.rulebook } : {}),
    ruleChanges: ctx.ruleChanges || [],
    castFrom: ctx.castFrom,
    castAsked: ctx.castNames,
    castSkipped: ctx.skippedCast || [],
    domains: [],
    domainsBlocked: [],
    queries: [],
    pagesRead: [],
    usage,
    problems: review.problems,
    betsAsked: bets.map((b) => b.label),
    // What was actually pasted, so a reviewer can see what the structuring pass was given -- there's
    // no revision id or page URL list to point at instead, the way a search run has.
    pastedNotes: trimmed.length > 20000 ? trimmed.slice(0, 20000) + "… (truncated)" : trimmed,
  };
  // A partial run only answers for who it asked: anything else the chat volunteered would otherwise be
  // merged over a stored answer nobody asked to replace. Matched the way validateResearch matches (the
  // name as asked, any case), so what it reported as dropped really is dropped.
  if (opts.merge) {
    const asked = new Set(ctx.castNames.map((n) => n.toLowerCase()));
    parsed.castaways = (parsed.castaways || []).filter((c) => asked.has(String((c && c.name) || "").trim().toLowerCase()));
  }
  const stored = await storeResearch(pool, ctx, parsed, provenance, opts);
  const payload = stored.payload;

  if (!opts.dry && stored.id) {
    try {
      const { stored: chunkCount } = await embeddings.storeChunksForEpisode(pool, ctx, payload);
      console.log(`[research] embedded ${chunkCount} chunk(s) for semantic search`);
    } catch (e) {
      console.log(`[research] ! could not embed for semantic search (side-bet suggestions won't see this episode): ${e.message}`);
    }
  }

  // A second pass that contradicts the first on whether something happened: the reviewer decides.
  if (stored.merged && stored.merged.disagreements && stored.merged.disagreements.length) review.problems.push(...stored.merged.disagreements);
  // `submitted`: this paste's own answers, before they were folded into the stored ones (step 6b keeps each as a source).
  const result = { ...ctx, ...review, payload, submitted: parsed, provenance: stored.provenance, cached: false, id: stored.id, merged: stored.merged || null };
  return { ...result, decisions: await stageResearchDecisions(pool, result, opts) };
}

async function runFor(pool, ctx, opts) {
  const episodeNumber = ctx.episodeNumber;
  const provider = providerFor(opts.provider);
  const model = opts.model || process.env.RESEARCH_MODEL || provider.defaultModel;

  const cached = await cachedResearch(pool, ctx, episodeNumber, opts);
  if (cached) {
    const review = validateResearch(cached.payload, ctx.castNames, ctx.terms, ctx.format, { groups: ctx.castGroups, formatGoingIn: ctx.formatGoingIn, episode: episodeNumber });
    // `id` matters even on a cache hit: staging needs a research_id to file decisions against, and
    // re-staging a cached episode must not require paying for the search again.
    return { ...ctx, ...review, payload: cached.payload, provenance: cached.provenance, cached: true, id: cached.id };
  }

  // After the cache, deliberately: re-reading research somebody already paid for shouldn't need a key.
  requireCredentials(provider);
  console.log(
    `[research] ${ctx.showName} season ${ctx.season} episode ${episodeNumber}: ` +
      `${ctx.castNames.length} ${ctx.terms.castaways} (from the ${ctx.castFrom}), via ${provider.id}/${model}`
  );
  // The leagues' open side bets on this episode ride along in the same request (see openBetsFor).
  const bets = await openBetsFor(pool, ctx.showSlug, ctx.season, episodeNumber);
  if (bets.length) console.log(`[research] also settling ${bets.length} open side bet(s) from the season's leagues`);
  const { system, user } = buildPrompt({ ...ctx, bets });
  const out = await runResearch({ system, user, schema: researchSchemaFor(ctx.format, bets.length > 0, ctx.groupWord), provider, model, domains: ctx.domains });
  console.log(
    `[research] tokens: ${out.usage.input_tokens} in / ${out.usage.output_tokens} out` +
      ` (${out.passes} call${out.passes === 1 ? "" : "s"}), ${out.pagesRead.length} page(s) read`
  );
  // Stored with the bets' own wording (the model answered by number), for the suggested-answer route.
  if (bets.length) out.parsed.betAnswers = betAnswersFrom(out.parsed, bets);

  const review = validateResearch(out.parsed, ctx.castNames, ctx.terms, ctx.format, { groups: ctx.castGroups, formatGoingIn: ctx.formatGoingIn, episode: episodeNumber });
  // Answers that strayed outside a fixed list and were set to its catch-all (validateLeniently).
  review.problems.unshift(...(out.parsed.repairs || []));
  for (const problem of review.problems) console.log(`[research] ! ${problem}`);
  if (review.fatal.length) {
    throw new Error(
      `The research isn't usable, so nothing was saved:\n  ${review.fatal.join("\n  ")}\n` +
        "Re-run it (--force) or try another provider; a partial checklist is worse than none, because " +
        "a reviewer can't see who is missing from it."
    );
  }

  // Everything needed to judge the answer later: who was asked, who answered, and every page the
  // search actually fetched. This is the substitute for a revision id -- see migration 0014.
  const provenance = {
    provider: provider.id,
    model,
    passes: out.passes,
    researchedAt: new Date().toISOString(),
    showSlug: ctx.showSlug,
    seasonNumber: ctx.season,
    episodeNumber,
    // Whose checklist this answers -- see askedAlike.
    format: ctx.format.id,
    ...(ctx.rulebook ? { rulebook: ctx.rulebook } : {}),
    ruleChanges: ctx.ruleChanges || [],
    castFrom: ctx.castFrom,
    castAsked: ctx.castNames,
    // Already out before this episode, so not asked about (see stillInGame).
    castSkipped: ctx.skippedCast || [],
    domains: out.domains,
    // Sites that refused the crawler this run -- worth removing from the show's list in Settings.
    domainsBlocked: out.blockedDomains,
    queries: out.queries || [],
    pagesRead: out.pagesRead,
    usage: out.usage,
    problems: review.problems,
    // The side bets this run was asked to settle (see openBetsFor).
    betsAsked: bets.map((b) => b.label),
  };
  const stored = await storeResearch(pool, ctx, out.parsed, provenance, opts);

  // Semantic search (db/embeddings.js) over the same answer, best-effort. Deliberately not fatal to
  // this run: the checklist itself is already stored and is the valuable part, and an embedding
  // hiccup (the model failing to load, a transient error) shouldn't undo a successful research
  // run over a feature that only backs side-bet suggestions. --dry skips it, same as storeResearch
  // itself -- there is nothing durable yet to search against.
  if (!opts.dry && stored.id) {
    try {
      const { stored: chunkCount } = await embeddings.storeChunksForEpisode(pool, ctx, out.parsed);
      console.log(`[research] embedded ${chunkCount} chunk(s) for semantic search`);
    } catch (e) {
      console.log(`[research] ! could not embed for semantic search (side-bet suggestions won't see this episode): ${e.message}`);
    }
  }

  return { ...ctx, ...review, payload: out.parsed, provenance, cached: false, id: stored.id };
}

// What a human actually reads before deciding whether to trust any of this. Only the lines with
// something on them -- a checklist where most answers are "no" is mostly noise on a terminal.
function printResearch(result) {
  const { payload, counts, terms, format } = result;
  console.log(`\n${payload.episodeTitle || "(untitled episode)"}${payload.airDate ? ` -- ${payload.airDate}` : ""}`);
  console.log(payload.summary);
  // The format's episode-level questions (Survivor: tribalCouncilHeld).
  for (const key of Object.keys(format.research.episodeFields(z, Answer))) console.log(`${key}: ${payload[key]}`);
  if (payload.rulesNote) console.log(`rules note: ${payload.rulesNote}`);
  console.log("");

  for (const e of result.entries) {
    const notes = format.research.notes(e);
    if (!notes.length) continue;
    console.log(`  ${e.name} [${e.confidence}] -- ${notes.join("; ")}`);
  }

  const quiet = result.entries.length - result.entries.filter((e) => e.sources && e.sources.length).length;
  console.log(
    `\n${counts.castaways} ${terms.castaways}, ${counts.unknowns} unknown answer(s), ` +
      `${counts.lowConfidence} low-confidence, ${quiet} with no source cited.`
  );
  console.log(`pages read: ${(result.provenance.pagesRead || []).join("\n            ") || "(none recorded)"}`);
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const flags = args.filter((a) => a.startsWith("--"));
  const [leagueId, episode] = args.filter((a) => !a.startsWith("--"));
  const valueOf = (name) => {
    const hit = flags.find((f) => f.startsWith(`--${name}=`));
    return hit ? hit.slice(name.length + 3) : undefined;
  };
  const opts = {
    dry: flags.includes("--dry"),
    force: flags.includes("--force"),
    provider: valueOf("provider"),
    model: valueOf("model"),
  };

  if (!leagueId || !episode) {
    console.error(
      "usage: node db/episode-research.js <leagueId> <episode> [--dry] [--force]\n" +
        `                                  [--provider=${Object.keys(PROVIDERS).join("|")}] [--model=...]\n` +
        "\n" +
        "Asks a web-searching model a fixed checklist about every castaway still in the game.\n" +
        "--dry researches and prints without writing, which is how to judge a provider before trusting it."
    );
    process.exitCode = 1;
  } else {
    const pool = new Pool({ connectionString: process.env.AUTH_DATABASE_URL });
    researchEpisode(pool, leagueId, Number(episode), opts)
      .then(printResearch)
      .catch((e) => {
        console.error("[research] " + e.message);
        process.exitCode = 1;
      })
      .finally(() => pool.end());
  }
}

module.exports = {
  researchSchemaFor,
  formatLines,
  formatGoingInto,
  formatGoingIntoFrom,
  fromTimeline,
  formatForAsking,
  plural,
  checklistKeys,
  unaskedKeys,
  onlyFormat,
  buildPrompt,
  betKey,
  openBetsFor,
  betAnswersFrom,
  storedBetAnswer,
  validateResearch,
  researchEpisode,
  researchSeasonEpisode,
  buildPastePrompt,
  pasteSkeleton,
  extractJsonObject,
  buildPasteImportPrompt,
  researchFromPaste,
  researchFromPasteForLeague,
  clearLeagueResearch,
  pasteEpisodeMismatch,
  leagueResearchStatus,
  researchCoverage,
  mergeResearchPayload,
  storeResearch,
  nextEpisodeFrom,
  recordNextEpisode,
  ensureSeasonRow,
  printResearch,
  resolveResearchContext,
  resolveSeasonResearchContext,
  itemsFromChecklist,
  candidatesFor,
  stageResearchDecisions,
  researchItems,
  stageCachedSeasonResearch,
  runResearch,
  providerFor,
  jsonSchemaFor,
  geminiSchema,
  strictSchema,
  parseJsonAnswer,
  looksLikeCombinationRejection,
  dedupeLines,
  CombinationUnsupported,
  PROVIDERS,
  SEARCH_TOOL,
  RESEARCH_MODELS,
  MAX_SEARCHES,
  STRUCTURE_SYSTEM,
};
