// Researched trivia (experimental): once an episode has aired and its recaps are up, the ask-AI bot
// (src/lib/server/ask-bot.ts) writes a few multiple-choice questions about it and the season so far, for
// the round before the next episode. The computed questions (src/lib/game/trivia.ts: who won, who left
// first, who lasted longer) only know what the results record; these know what a close watcher would.
//
// The prompt asks for more than a round needs (QUESTIONS), split between the episode and the season so
// far, so the strict parse below can drop the bad ones and a viewer behind on the season still has some
// (each question says which episode it's about: the spoiler guard's line). Every answer has to be one of
// its own options, copied exactly, with the page that states it; a person's options are names from the
// cast list, matched back to it, so they can show faces; a number's are digits, so they sort.
//
// A second prompt, in a chat of its own (each ask opens a new one), checks what the first wrote: that a page states each
// answer, that no other option could also be right, and that nothing gives away a later episode. Only a question every check
// passes goes live; the rest are kept as dropped, with why (migration 0140 trivia_questions).
//
// The prompts and parses are pure (tests/trivia-research.test.js); castFor and storeTrivia read and write the database, for
// bot research's 'trivia' run (db/bot-research.js), due a day before the next episode airs.
const StateLogic = require("../src/lib/game/state-logic.js");
const Research = require("./episode-research.js");

/** How many questions the prompt asks for: half about the episode, half the season so far. */
const QUESTIONS = 6;
const OPTIONS = 4;
const MAX_QUESTION = 240;
const MAX_OPTION = 80;
const MAX_WHY = 300;

/**
 * The prompt. `cast`: everyone in the season, [{ name, out }] with `out` the episode they left in (null:
 * still in after episode n), so wrong options can be people who were still there.
 */
function buildTriviaPrompt({ showName, season, episode: n, airedAt = null, cast, term = "cast members" }) {
  const when = airedAt ? ` (aired ${airedAt})` : "";
  const half = QUESTIONS / 2;
  const roster = cast.map((c) => `- ${c.name}${c.out != null && c.out <= n ? ` (left in episode ${c.out})` : ""}`);
  const about = n > 1 ? `episodes 1 to ${n}` : "episode 1";
  return [
    `Search the web for ${showName} season ${season}. Episode ${n}${when} is the latest to air; episode ${n + 1} hasn't aired yet.`,
    "Read recaps, wiki pages and articles about these episodes before writing anything.",
    "",
    `Write ${QUESTIONS} multiple-choice trivia questions for fans who have watched every episode up to and including episode ${n}:`,
    n > 1 ? `- ${half} about episode ${n} itself` : `- all ${QUESTIONS} about episode 1`,
    n > 1 ? `- ${half} about the season so far (${about})` : null,
    "",
    "Every question must be:",
    "- Obscure: a detail a close watcher would catch, not the headline. Not just \"Who went home?\" or \"Who won immunity?\". Good: who said a",
    "  memorable line, what a reward was, where an idol or clue was hidden, how a vote split, what someone said about themselves on the show.",
    "- Confidently correct: the answer is stated plainly on a page you found about that episode. If you can't find it stated, pick a",
    "  different question. Never answer from memory, from another season, or from a preview of a later episode.",
    "- One right answer: exactly one option is correct. No \"both\", \"none\" or \"all of the above\", no trick wording, nothing that depends",
    "  on how you count or on opinion (\"the biggest blindside\", \"who cried most\").",
    "- Hard to guess: the wrong options are the same kind of thing as the answer and believable. For a person, choose people who were",
    "  still in the game at that point. For a number, choose numbers close to the real one. All four options are about the same",
    "  length and detail, so the answer doesn't stand out as the longest or most specific.",
    "- Spoiler-free past its episode: a question about episode 3 says nothing about what happened after episode 3, in the question, the",
    `  options or the explanation. Nothing at all about episode ${n + 1} or later.`,
    "\"How many\" questions are welcome (\"How many votes did ... get?\"): their options are four whole numbers.",
    "Mix them: at least one whose options are people from the list below, at least one \"How many\", and no more than two about",
    "something someone said.",
    "",
    `The ${term}, with names exactly as to write them when an option is a person:`,
    ...roster,
    "",
    "Reply with only this JSON, in a ```json code block, and nothing after it:",
    '{"found": true, "questions": [{"episode": 1, "question": "", "options": ["", "", "", ""], "answer": "", "why": "", "source": "https://..."}]}',
    "",
    `- episode: the episode the question is about (1 to ${n}). For a season-so-far question, the latest episode its answer depends on.`,
    `- options: exactly ${OPTIONS} different strings. A person is their name exactly as listed above. A number is digits only ("3").`,
    "- answer: copied exactly from one of the options.",
    "- why: one sentence on what happened, shown after someone answers, at most 30 words.",
    "- source: the URL of the page that states the answer.",
    "- Plain JSON: double quotes, no comments, no trailing commas.",
    `If you can't find recaps of episode ${n} yet, set "found" to false and "questions" to [].`,
  ]
    .filter((l) => l !== null)
    .join("\n");
}

const str = (v) => (typeof v === "string" ? v.trim() : typeof v === "number" && Number.isFinite(v) ? String(v) : "");
const fold = (s) => s.toLowerCase().replace(/\s+/g, " ");

/**
 * One question as answered, checked, or the reason it's dropped. `roster` is { castaways: [{ id, name }] }.
 * `kind`: "cast" (every option a person in the cast, by their roster name), "number" (every option digits,
 * smallest first) or "text".
 */
function checkQuestion(raw, n, roster) {
  if (!raw || typeof raw !== "object") return { drop: "not an object" };
  const episode = Number(raw.episode);
  if (!Number.isInteger(episode) || episode < 1 || episode > n) return { drop: `episode must be 1 to ${n}` };
  const question = str(raw.question);
  if (question.length < 10 || question.length > MAX_QUESTION) return { drop: "question missing or too long" };
  if (!Array.isArray(raw.options) || raw.options.length !== OPTIONS) return { drop: `needs exactly ${OPTIONS} options` };
  let options = raw.options.map(str);
  if (options.some((o) => !o || o.length > MAX_OPTION)) return { drop: "an option is empty or too long" };
  if (new Set(options.map(fold)).size !== OPTIONS) return { drop: "two options are the same" };
  if (options.some((o) => /\b(all|none|both) of (the|these|them)\b|^(both|neither|none|all)$/i.test(o))) return { drop: "an all/none/both option" };
  const at = options.findIndex((o) => fold(o) === fold(str(raw.answer)));
  if (at < 0) return { drop: "answer isn't one of the options" };
  const source = str(raw.source);
  if (!/^https?:\/\/\S+$/.test(source)) return { drop: "no source URL" };
  let kind = "text";
  if (options.every((o) => /^\d+$/.test(o))) kind = "number";
  else {
    const people = options.map((o) => StateLogic.Core.findCastawayByName(roster, o).castaway);
    if (people.every(Boolean)) {
      if (new Set(people.map((p) => p.id)).size !== OPTIONS) return { drop: "two options are the same person" };
      kind = "cast";
      options = people.map((p) => p.name);
    }
  }
  const answer = options[at];
  if (kind === "number") options = [...options].sort((a, b) => Number(a) - Number(b));
  const why = str(raw.why).slice(0, MAX_WHY) || null;
  return { question: { episode, kind, question, options, answer, why, source } };
}

/**
 * The bot's answer: { found, questions, dropped }. Never throws on a bad question (it's dropped, with why);
 * throws only when there's no JSON at all. `castNames`: everyone in the season.
 */
function parseTriviaAnswer(text, n, castNames) {
  const raw = JSON.parse(Research.extractJsonObject(String(text || "")));
  const roster = { castaways: castNames.map((name, i) => ({ id: String(i), name })) };
  const list = Array.isArray(raw.questions) ? raw.questions : [];
  const questions = [];
  const dropped = [];
  const asked = new Set();
  list.slice(0, QUESTIONS * 2).forEach((q, i) => {
    const out = checkQuestion(q, n, roster);
    if (out.question && asked.has(fold(out.question.question))) out.drop = "asked twice";
    if (out.drop) return dropped.push({ index: i, why: out.drop, question: str(q && q.question) || null });
    asked.add(fold(out.question.question));
    questions.push(out.question);
  });
  return { found: raw.found !== false && questions.length > 0, questions, dropped };
}

// ---------- the check ----------

/** The check's prompt: every question as written, numbered from 1, each to be checked against the episode's recaps. */
function buildCheckPrompt({ showName, season, episode: n, questions }) {
  const listed = questions.flatMap((q, i) => [
    `${i + 1}. [Episode ${q.episode}] ${q.question}`,
    `   Options: ${q.options.join(" | ")}`,
    `   Given answer: ${q.answer}`,
    q.why ? `   Explanation: ${q.why}` : null,
    `   Source: ${q.source}`,
    "",
  ]);
  return [
    `These are trivia questions about ${showName} season ${season}, episodes 1 to ${n}. Someone else wrote them; check every one.`,
    "Search the web: open the source given and at least one other recap of the episode each question is about.",
    "",
    ...listed.filter((l) => l !== null),
    "For each question:",
    "- correct: true only if a page you read plainly states the given answer. False if a page says something else, or you can't",
    "  find it stated anywhere.",
    "- onlyOne: true if none of the other options could also be counted right.",
    "- spoilerFree: true if the question, options and explanation say nothing about anything after the episode it's about.",
    "- note: when anything is false, a few words on why (and the right answer, if you found it); else an empty string.",
    "",
    "Reply with only this JSON, in a ```json code block, and nothing after it, one entry per question in the same order:",
    '{"checks": [{"n": 1, "correct": true, "onlyOne": true, "spoilerFree": true, "note": ""}]}',
    "Plain JSON: double quotes, no comments, no trailing commas.",
  ].join("\n");
}

/** The check's answer: one verdict per question (by `n`, from 1), or null for one it didn't check. */
function parseCheckAnswer(text, count) {
  const raw = JSON.parse(Research.extractJsonObject(String(text || "")));
  const out = Array.from({ length: count }, () => null);
  for (const c of Array.isArray(raw.checks) ? raw.checks : []) {
    const n = Number(c && c.n);
    if (!Number.isInteger(n) || n < 1 || n > count || out[n - 1]) continue;
    out[n - 1] = { correct: c.correct === true, onlyOne: c.onlyOne === true, spoilerFree: c.spoilerFree === true, note: str(c.note).slice(0, 200) || null };
  }
  return out;
}

/** Every question the first prompt wrote, live or dropped, with why: the parse's drops, then each check's verdict. */
function judged(parsed, checks) {
  const failed = (v) =>
    !v ? "not checked" : !v.correct ? "the check couldn't confirm the answer" : !v.onlyOne ? "another option could be right" : !v.spoilerFree ? "gives a later episode away" : null;
  return parsed.questions.map((q, i) => {
    const why = failed(checks[i]);
    const note = checks[i] && checks[i].note;
    return { ...q, status: why ? "dropped" : "live", note: why ? (note ? `${why}: ${note}` : why) : null };
  });
}

// ---------- the database ----------

/**
 * Everyone in the season, with the episode each left in through `n` (what the season's results say, accepted or not: it only
 * guides the wrong options), and the show's name and word for its people.
 */
async function castFor(pool, seasonId, n) {
  const { rows: head } = await pool.query(
    "SELECT s.name, s.castaway_term, ss.season_number FROM show_seasons ss JOIN shows s ON s.id = ss.show_id WHERE ss.id = $1",
    [seasonId]
  );
  if (!head[0]) throw new Error("Season not found");
  const [{ rows: cast }, { rows: exits }] = await Promise.all([
    pool.query("SELECT name FROM season_cast WHERE season_id = $1 ORDER BY sort_order ASC, name ASC", [seasonId]),
    pool.query(
      `SELECT castaway_name, min(episode_number) AS out FROM season_decisions
        WHERE season_id = $1 AND kind = 'elimination' AND status <> 'rejected' AND episode_number <= $2 GROUP BY castaway_name`,
      [seasonId, n]
    ),
  ]);
  if (!cast.length) throw new Error("No cast to write trivia about: pull the season's cast first");
  const names = cast.map((c) => c.name);
  const roster = { castaways: names.map((name, i) => ({ id: String(i), name })) };
  const out = new Map();
  for (const e of exits) {
    const { castaway } = StateLogic.Core.findCastawayByName(roster, e.castaway_name);
    if (castaway && !out.has(castaway.name)) out.set(castaway.name, Number(e.out));
  }
  const term = head[0].castaway_term ? `${head[0].castaway_term.toLowerCase()}s` : "cast members";
  return { showName: head[0].name, season: head[0].season_number, term, cast: names.map((name) => ({ name, out: out.get(name) ?? null })) };
}

/** Files a run's questions for the season after episode `n`, replacing any earlier batch for it. Returns how many went live. */
async function storeTrivia(pool, seasonId, n, questions, runId) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM trivia_questions WHERE season_id = $1 AND made_after = $2", [seasonId, n]);
    for (const q of questions) {
      await client.query(
        `INSERT INTO trivia_questions (season_id, made_after, episode, kind, question, options, answer, why, source, status, note, run_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [seasonId, n, q.episode, q.kind, q.question, JSON.stringify(q.options), q.answer, q.why, q.source, q.status, q.note, runId]
      );
    }
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
  return questions.filter((q) => q.status === "live").length;
}

module.exports = { QUESTIONS, OPTIONS, buildTriviaPrompt, parseTriviaAnswer, checkQuestion, buildCheckPrompt, parseCheckAnswer, judged, castFor, storeTrivia };
