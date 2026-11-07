// A season's added moments' own short ask (docs/PLAN-start-a-game-gpt.md step G1 part 4; formats/added-moments.js says what an
// added moment is). The full run asks each added moment in its checklist (a yes, no or unknown for each person, compiled in from
// the season's rulebook), but it reads recaps for everything at once, and a moment nobody's research covered before (did someone
// cry?) is the kind it answers "unknown". So the full run itself (db/bot-research.js runJob, both of an episode's full runs), once
// its answer is stored and before it's sent, asks the added moments that answer left unsure (none: nothing is asked) in one short
// prompt with the cast list (askUnsure), and files the answer into the stored answer as a second pass fills in (added-moments.js
// fillMoments: a yes or no research gave is never replaced) and into what it sends, so the leagues get it with the rest. No run
// kind of its own: an episode with no stored answer has nothing to fill, and the next full run asks again. What it still can't
// settle is void for a game's question on it (answers.js).
//
// The prompt's words are the user's to approve when it merges, as the facts run's are.
//
// The prompt and parse are pure (tests/added-moments.test.js); aboutEpisode and storeMoments read and write the database.
const Added = require("../src/lib/game/formats/added-moments.js");
// The answer read as the GPT's is: the whole span, else the last object that parses (a chat that corrects itself writes two).
const { objectIn } = require("../src/lib/game/game-words/read.js");
const FactsRun = require("./facts-research.js");

const isObj = (v) => !!v && typeof v === "object" && !Array.isArray(v);
const str = (v) => (typeof v === "string" && v.trim() ? v.trim() : null);
const HAPPENED = ["yes", "no", "unknown"];

/** The answer's JSON: its fenced blocks last first (a chat that stops and starts again writes a cut-off one, then the whole), else
 *  objectIn on all of it. Throws when nothing parses. */
function answerObject(text) {
  const blocks = [...String(text || "").matchAll(/```(?:json)?\s*([\s\S]*?)```/g)].map((m) => m[1]).reverse();
  for (const b of blocks) {
    try {
      return objectIn(b).value;
    } catch {
      // the one before it, then
    }
  }
  return objectIn(text).value;
}

/** A moment's question for the prompt: addedOf's (its own, or the rulebook's questionFor), else its label as a who. */
const questionOf = (m) => str(m.question) || `This episode, who ${String(m.label || m.id).replace(/^./, (c) => c.toLowerCase())}?`;
/** The longest the short ask may take (it holds the full run's results back from the leagues while it asks). */
const ASK_MS = 150_000;

/**
 * The run's prompt: the episode (its title when known), each moment asked (`moments`: added-moments.js addedOf's, those the stored
 * answer left unsure), the names research was asked about (`cast`), and the JSON to answer in. Pure.
 */
function buildMomentsPrompt({ showName, season, episode, title = null, cast = [], term = "cast members", moments = [] }) {
  return [
    `${showName} season ${season}, episode ${episode}${title ? `, titled "${title}"` : ""}.`,
    "",
    "Search the web for recaps of this episode (two or more if you can: the network's, entertainment sites', fan sites') and answer each",
    "question below from what they say happened in this episode, not from memory or other episodes.",
    "",
    "The questions:",
    ...moments.map((m, i) => `${i + 1}. ${m.id}: ${questionOf(m)}`),
    "",
    `The ${term} in this episode (use their names exactly as written):`,
    ...cast.map((name, i) => `${i + 1}. ${name}`),
    "",
    "Reply with only this JSON, in a ```json code block, one entry for each question by its id:",
    `{"episodeTitle": "", "moments": {${moments.map((m) => `"${m.id}": {"happened": "unknown", "who": [], "sure": "low", "source": null}`).join(", ")}}}`,
    "- happened: \"yes\" if a source says it happened to someone in this episode; \"no\" only if the recaps cover the episode in detail and it",
    "  plainly didn't happen; \"unknown\" if you can't tell from what's written (a recap not mentioning something isn't a no).",
    "- who: the names from the list it happened to, exactly as written; [] unless happened is \"yes\".",
    "- sure: \"high\" only if a source you read says it plainly; \"low\" if you're piecing it together or going from memory.",
    "- source: the URL of the page that says it, or null.",
  ].join("\n");
}

/**
 * The run's answer, read loosely: { moments: { [id]: { happened, who, sure, source } } }, or the entries at the top. Only the
 * moments asked (`ids`) are kept; a bad value is read as unknown (and said in `repairs`), a name not on the list (`cast`) is left
 * out (said too). { found, moments, episodeTitle, repairs }; throws only when there's no JSON at all. Pure.
 */
function parseMomentsAnswer(text, ids = [], cast = []) {
  const raw = answerObject(text);
  const section = isObj(raw.moments) ? raw.moments : raw;
  const names = new Map(cast.map((n) => [String(n).trim().toLowerCase(), n]));
  const repairs = [];
  const out = {};
  for (const id of ids) {
    const a = section[id];
    if (!isObj(a)) continue;
    let happened = typeof a.happened === "string" ? a.happened.trim().toLowerCase() : a.happened === true ? "yes" : a.happened === false ? "no" : null;
    if (!HAPPENED.includes(happened)) {
      repairs.push(`${id}: happened "${a.happened}" read as unknown`);
      happened = "unknown";
    }
    const who = [];
    for (const n of Array.isArray(a.who) ? a.who : typeof a.who === "string" && a.who.trim() ? [a.who] : []) {
      const found = names.size ? names.get(String(n).trim().toLowerCase()) : str(n);
      if (found) {
        if (!who.includes(found)) who.push(found);
      } else repairs.push(`${id}: "${n}" isn't on the list`);
    }
    const sure = a.sure === "high" ? "high" : "low";
    out[id] = { happened, who: happened === "yes" ? who : [], sure, source: str(a.source) };
  }
  const found = Object.keys(out).length > 0;
  return { found, moments: found ? out : null, episodeTitle: str(raw.episodeTitle), repairs };
}

/** What a run's answer said, in a line for the desk's runs: "Cried: Jawan Pitts, sure · Blindsided: still not sure". Pure. */
function momentsLine(moments, labels = {}) {
  const parts = Object.entries(isObj(moments) ? moments : {}).map(([id, a]) => {
    const label = labels[id] || id;
    if (!isObj(a) || a.sure !== "high" || a.happened === "unknown") return `${label}: still not sure`;
    return a.happened === "no" ? `${label}: no, sure` : `${label}: ${a.who.length ? a.who.join(", ") : "nobody named"}, sure`;
  });
  return parts.length ? parts.join(" · ") : "No added moments in the answer";
}

/**
 * What a moments run about episode `n` of a season reads: its show and season, whether research has stored its answer (`stored`),
 * the episode's title, the names research was asked about, the season's added moments (`moments`, from its rulebook as of now)
 * and those to ask (`ask`: from their episode on, the ones the stored answer leaves unsure).
 */
async function aboutEpisode(pool, seasonId, n) {
  const { rows } = await pool.query(
    `SELECT s.name, s.castaway_term, s.castaway_plural, ss.show_id, ss.season_number, r.blocks, er.id AS research_id,
            er.payload->'castaways' AS castaways, er.payload->>'episodeTitle' AS title, se.title AS listed,
            (SELECT array_agg(sc.name ORDER BY sc.sort_order, sc.name) FROM season_cast sc WHERE sc.season_id = ss.id) AS cast_names
       FROM show_seasons ss JOIN shows s ON s.id = ss.show_id
       LEFT JOIN rulebooks r ON r.id = ss.rulebook_id
       LEFT JOIN episode_research er ON er.show_id = ss.show_id AND er.season_number = ss.season_number AND er.episode_number = $2 AND er.source = 'combined'
       LEFT JOIN season_episodes se ON se.season_id = ss.id AND se.number = $2
      WHERE ss.id = $1`,
    [seasonId, n]
  );
  const r = rows[0];
  if (!r) throw new Error("Season not found");
  const moments = Added.addedOf(r.blocks);
  const castaways = Array.isArray(r.castaways) ? r.castaways : [];
  const asked = castaways.map((c) => c && c.name).filter((x) => typeof x === "string" && x);
  return {
    showName: r.name,
    season: r.season_number,
    showId: r.show_id,
    episode: n,
    term: FactsRun.termOf(r),
    stored: !!r.research_id,
    title: str(r.title) || str(r.listed),
    cast: asked.length ? asked : r.cast_names || [],
    moments,
    ask: r.research_id ? Added.unsureIn(castaways, moments, n) : moments.filter((m) => n >= m.from),
  };
}

/**
 * Files a run's answers into the episode's stored answer (fillMoments: only a person research left unsure changes), under the lock
 * a research store takes (episode-research.js storeMergedResearch), so a full run landing at the same moment can't lose it. Its
 * provenance says when (`note`, as `momentsRun`). Null when the episode has no stored answer; else { changed: [ids] } (none:
 * nothing written). The row's researched_at stays the full run's.
 */
async function storeMoments(pool, { showId, season, episode }, answers, note = {}) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`episode_research:${showId}:${season}:${episode}`]);
    const { rows } = await client.query(
      "SELECT id, payload->'castaways' AS castaways FROM episode_research WHERE show_id=$1 AND season_number=$2 AND episode_number=$3 AND source = 'combined' FOR UPDATE",
      [showId, season, episode]
    );
    if (!rows[0]) {
      await client.query("ROLLBACK");
      return null;
    }
    const { castaways, changed } = Added.fillMoments(rows[0].castaways, answers);
    if (changed.length) {
      await client.query(
        `UPDATE episode_research SET payload = jsonb_set(payload, '{castaways}', $2::jsonb),
                provenance = COALESCE(provenance, '{}'::jsonb) || jsonb_build_object('momentsRun', $3::jsonb)
          WHERE id = $1`,
        [rows[0].id, JSON.stringify(castaways), JSON.stringify({ ...note, changed })]
      );
    }
    await client.query("COMMIT");
    return { changed };
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

/**
 * The full run's second pass for a season's added moments (bot-research.js runJob, once the full run's answer is stored and before
 * it's sent): the added moments that answer still leaves unsure, asked on their own (`ask`: the run's bot), filed into the stored
 * answer (storeMoments) and into the run's own answer (`run.submitted`, and `run.payload` a merged re-ask sends), so the leagues get
 * them with the rest. Null when there's nothing to ask (no stored answer, no added moments, none unsure); else { asked, line,
 * changed, repairs }. Never throws for the bot's answer: what it can't read is said in `line` and nothing is filed.
 */
async function askUnsure(pool, season, episode, ask, run) {
  const about = await aboutEpisode(pool, season.id, episode);
  if (!about.stored || !about.ask.length) return null;
  const ids = about.ask.map((m) => m.id);
  const labels = Object.fromEntries(about.ask.map((m) => [m.id, m.label]));
  const { answer } = await ask(buildMomentsPrompt({ ...about, moments: about.ask }), { budgetMs: ASK_MS });
  let parsed;
  try {
    parsed = parseMomentsAnswer(answer, ids, about.cast);
  } catch {
    return { asked: ids, line: "Added moments: no JSON in the answer", changed: [], repairs: [] };
  }
  if (!parsed.found) return { asked: ids, line: "Added moments: none in the answer", changed: [], repairs: parsed.repairs };
  if (!FactsRun.sameTitle(about.title, parsed.episodeTitle)) return { asked: ids, line: `Added moments: the answer was about "${parsed.episodeTitle}"`, changed: [], repairs: parsed.repairs };
  const filed = await storeMoments(pool, { showId: season.show_id, season: season.season_number, episode }, parsed.moments, { at: new Date().toISOString(), asked: ids });
  for (const key of ["submitted", "payload"]) {
    const p = run && run[key];
    if (isObj(p) && Array.isArray(p.castaways)) p.castaways = Added.fillMoments(p.castaways, parsed.moments).castaways;
  }
  return { asked: ids, line: momentsLine(parsed.moments, labels), changed: filed ? filed.changed : [], repairs: parsed.repairs };
}

module.exports = { ASK_MS, questionOf, buildMomentsPrompt, parseMomentsAnswer, momentsLine, aboutEpisode, storeMoments, askUnsure };
