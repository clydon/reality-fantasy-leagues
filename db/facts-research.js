// Episode facts' own short run (docs/PLAN-start-a-game-gpt.md step A13 part 2b; what it found is in
// docs/STUDY-format-changes.md, "A13 part 2b"). The full research asks every show's episode facts in a section of its own
// (db/episode-research.js episodeFacts: who says the episode's title quote, and how sure), and what it's sure of is right, but it
// reads recaps, which seldom say who said a title: sure on half of Survivor 49's episodes and none of the other shows' in A13 part
// 2's proof. The same question asked on its own, a short prompt with the episode's title and the cast list, settled every one of
// Survivor 49's unsure weeks. So bot research has a 'facts' run (db/bot-research.js), due after the morning's full run: it reads
// the episode's stored answer (episode_research, source 'combined'), asks only the facts its section left unsure (none: nothing is
// asked), and files the answer into that stored answer as a second pass fills in (episode-facts.js fillFacts: a sure answer is
// never replaced by an unsure one). An episode with no stored answer yet is a failed try, asked again. A game's question a fact
// settles reads the stored answer on each read (src/lib/server/episode-facts.ts), so what the run settles is graded at once.
//
// The prompt's words, like the section's, are the user's to approve when it merges, as F2's format section is.
//
// The prompt and parse are pure (tests/facts-research.test.js); factsFor and storeFacts read and write the database.
const Facts = require("../src/lib/game/formats/episode-facts.js");
const Research = require("./episode-research.js");

const isObj = (v) => !!v && typeof v === "object" && !Array.isArray(v);
const str = (v) => (typeof v === "string" && v.trim() ? v.trim() : null);

/** What the prompt asks of each fact, by id: how to look for it, and its JSON with what each field takes. */
const ASKS = {
  titleQuote: {
    look: [
      "Many shows title each episode with a line someone says in it, often a short, ordinary-sounding phrase from a confessional or a",
      "conversation. Search for who says this episode's title: recaps, episode stats pages and the episode's own page often say \"the",
      "episode title was said by ...\" (search for the title with \"title quote\" or \"said by\"). Answer from pages you read, not memory.",
    ],
    json: '"titleQuote": {"isQuote": "yes", "line": "", "by": "", "sure": "high"}',
    fields: [
      "- isQuote: \"yes\", \"no\" or \"unknown\". \"no\" only if a source shows the title isn't a line from the episode (a theme night, a pun, a",
      "  name nobody says in it); \"unknown\" if you can't tell.",
      "- line: the line as it's said, with the title's words in it. Null unless isQuote is \"yes\".",
      "- by: who says it: a name from the list exactly as written there; for someone who isn't on it (the host, a family member, someone",
      "  who already left the game), their name as the show gives it. Null unless a source says who.",
      "- sure: \"high\" only if a source says plainly who says it; \"low\" if you're piecing it together or going from memory.",
    ],
  },
};

/** The facts of an episode's section research wasn't sure of (missing counts as not sure): the ones the run asks. Pure. */
const unsureIn = (section) => Facts.FACT_IDS.filter((id) => !Facts.sureOf(isObj(section) ? section[id] : null));

/**
 * The run's prompt: the episode (its title when known, else find it), the facts asked (`facts`, ids of Facts.FACTS: those its
 * section left unsure), the names research was asked about (`cast`, as the full run listed them), and the JSON to answer in. Pure.
 */
function buildFactsPrompt({ showName, season, episode, title = null, cast = [], term = "cast members", facts = Facts.FACT_IDS }) {
  const asked = facts.filter((id) => ASKS[id]);
  return [
    `${showName} season ${season}, episode ${episode}${title ? `, titled "${title}"` : ""}.`,
    title ? null : "Find the episode's title first: the network's episode page or a recap gives it.",
    "",
    ...asked.flatMap((id) => [...ASKS[id].look, ""]),
    `The ${term} in this episode (use their names exactly as written):`,
    ...cast.map((name, i) => `${i + 1}. ${name}`),
    "",
    "Reply with only this JSON, in a ```json code block:",
    `{"episodeTitle": "", "episodeFacts": {${asked.map((id) => ASKS[id].json).join(", ")}}}`,
    ...asked.flatMap((id) => ASKS[id].fields),
  ]
    .filter((l) => l !== null)
    .join("\n");
}

/**
 * The run's answer, read loosely as the section is (episode-facts.js looseEpisodeFacts: a bad value repaired and said in
 * `repairs`): the section's shape ({ episodeFacts: { titleQuote } }), or a fact on its own ({ titleQuote }, or its fields at the
 * top, as the focus experiment's prompt answered). Only the facts asked (`facts`) are kept. { found, episodeFacts, episodeTitle,
 * repairs }; throws only when there's no JSON at all. Pure.
 */
function parseFactsAnswer(text, facts = Facts.FACT_IDS) {
  const raw = JSON.parse(Research.extractJsonObject(String(text || "")));
  const repairs = [];
  let section = null;
  if (isObj(raw.episodeFacts)) section = raw.episodeFacts;
  // A fact at the top, an object or its fields flattened beside it (looseEpisodeFacts reads both).
  else if (Facts.FACT_IDS.some((id) => id in raw)) section = raw;
  else if ("isQuote" in raw) section = { titleQuote: raw };
  const read = Facts.looseEpisodeFacts(section, repairs);
  const out = {};
  for (const id of facts) if (read && read[id]) out[id] = read[id];
  const found = Object.keys(out).length > 0;
  return { found, episodeFacts: found ? out : null, episodeTitle: str(raw.episodeTitle), repairs };
}

/** A title as compared: case, accents, quotes and punctuation aside. */
const titleKey = (t) =>
  String(t || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
/** Whether an answer's title is the episode's (either unknown: nothing to go on, so it is). Pure. */
const sameTitle = (asked, said) => !titleKey(asked) || !titleKey(said) || titleKey(asked) === titleKey(said);

/** What a run's answer said, in a line for the desk's runs: "Title quote: Jawan Pitts, sure", "Title quote: still not sure". Pure. */
function factsLine(section) {
  const tq = isObj(section) ? section.titleQuote : null;
  if (!isObj(tq)) return "No episode facts in the answer";
  if (!Facts.sureOf(tq)) return `Title quote: still not sure${tq.by ? ` (it said ${tq.by})` : ""}`;
  return tq.isQuote === "no" ? "Title quote: the title isn't a line from it, sure" : `Title quote: ${tq.by}, sure`;
}

/** A show's word for its cast, many of them, for the prompt: its own plural (0429), else its word with an s, else "cast members". */
const termOf = ({ castaway_term: one, castaway_plural: many }) =>
  str(many) ? String(many).trim().toLowerCase() : str(one) ? `${String(one).trim().toLowerCase()}s` : "cast members";

/**
 * What a facts run about episode `n` of a season reads: its show and season, whether research has stored its answer (`stored`),
 * the episode's title (research's, else the listings'), the names research was asked about (the stored answer's people, else the
 * season's cast), its section as read, and the facts left to ask (`ask`: those it isn't sure of).
 */
async function factsFor(pool, seasonId, n) {
  const { rows } = await pool.query(
    `SELECT s.name, s.castaway_term, s.castaway_plural, ss.show_id, ss.season_number, er.id AS research_id, er.payload->'episodeFacts' AS facts,
            er.payload->>'episodeTitle' AS title, se.title AS listed,
            (SELECT array_agg(c->>'name') FROM jsonb_array_elements(CASE WHEN jsonb_typeof(er.payload->'castaways') = 'array' THEN er.payload->'castaways' ELSE '[]'::jsonb END) c
              WHERE c->>'name' IS NOT NULL) AS asked,
            (SELECT array_agg(sc.name ORDER BY sc.sort_order, sc.name) FROM season_cast sc WHERE sc.season_id = ss.id) AS cast_names
       FROM show_seasons ss JOIN shows s ON s.id = ss.show_id
       LEFT JOIN episode_research er ON er.show_id = ss.show_id AND er.season_number = ss.season_number AND er.episode_number = $2 AND er.source = 'combined'
       LEFT JOIN season_episodes se ON se.season_id = ss.id AND se.number = $2
      WHERE ss.id = $1`,
    [seasonId, n]
  );
  const r = rows[0];
  if (!r) throw new Error("Season not found");
  const section = Facts.looseEpisodeFacts(r.facts);
  return {
    showName: r.name,
    season: r.season_number,
    showId: r.show_id,
    episode: n,
    term: termOf(r),
    stored: !!r.research_id,
    title: str(r.title) || str(r.listed),
    cast: (r.asked && r.asked.length ? r.asked : r.cast_names) || [],
    section,
    ask: unsureIn(section),
  };
}

/**
 * Files a run's facts into the episode's stored answer, as a second pass fills in (fillFacts: each fact the run's, unless the
 * stored one was sure and the run's isn't), under the lock a research store takes (episode-research.js storeMergedResearch), so a
 * full run landing at the same moment can't lose it. Its provenance says when (`note`, as `factsRun`). Null when the episode has no
 * stored answer; else { changed, episodeFacts } (unchanged: nothing written). The row's researched_at stays the full run's.
 */
async function storeFacts(pool, { showId, season, episode }, facts, note = {}) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`episode_research:${showId}:${season}:${episode}`]);
    const { rows } = await client.query(
      "SELECT id, payload->'episodeFacts' AS facts FROM episode_research WHERE show_id=$1 AND season_number=$2 AND episode_number=$3 AND source = 'combined' FOR UPDATE",
      [showId, season, episode]
    );
    if (!rows[0]) {
      await client.query("ROLLBACK");
      return null;
    }
    const was = Facts.looseEpisodeFacts(rows[0].facts) || {};
    const now = Facts.fillFacts(was, facts);
    const changed = JSON.stringify(now) !== JSON.stringify(was);
    if (changed) {
      await client.query(
        `UPDATE episode_research SET payload = jsonb_set(payload, '{episodeFacts}', $2::jsonb),
                provenance = COALESCE(provenance, '{}'::jsonb) || jsonb_build_object('factsRun', $3::jsonb)
          WHERE id = $1`,
        [rows[0].id, JSON.stringify(now), JSON.stringify(note)]
      );
    }
    await client.query("COMMIT");
    return { changed, episodeFacts: now };
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

module.exports = { ASKS, unsureIn, termOf, sameTitle, buildFactsPrompt, parseFactsAnswer, factsLine, factsFor, storeFacts };
