// Semantic search over episode research's free text (db/episode-research.js), backing a "suggested
// answer" for side bets (BetLogic in src/lib/game/state-logic.js). See db/migrations/0016 for why
// this is a search index and episode_research_items (0015) is a mapper, not the other way round: a
// side bet's question is arbitrary prose ("Will Jenna find an idol?") with no structured field to
// match against, unlike the fixed checklist -- that's the shape semantic search is actually for.
//
// Three design choices carry this file:
//
//   1. STORE ONLY WHAT'S WORTH FINDING. A castaway nothing happened to gets no chunk at all (see
//      chunksFromResearch below) -- a chunk that just says "nothing notable" still scores some
//      nonzero similarity against any query and would sit in the results for zero information.
//
//   2. NEVER FABRICATE AN ANSWER. This never asks a model to answer the bet -- it returns the most
//      similar chunk of REAL research text, verbatim, with a numeric confidence and the episode it
//      came from. If nothing scores high enough, it says so instead of guessing. Same rule the
//      checklist's three-valued answers follow: an honest "can't tell" beats a plausible-looking
//      wrong answer, because a human is about to act on it.
//
//   3. ASYMMETRIC EMBEDDINGS. Gemini's embedding model takes a `taskType` that measurably improves
//      retrieval when the thing being embedded and the thing being searched for are different kinds
//      of text (a short question vs. a descriptive sentence) -- RETRIEVAL_DOCUMENT for what gets
//      stored, RETRIEVAL_QUERY for what gets searched with. Getting this backwards doesn't error, it
//      just quietly retrieves worse, so it's worth being deliberate about which is which.
//
// Cost: one batchEmbedContents call per episode's research (a handful of chunks, one HTTP round
// trip), plus one embedContent call per bet a commissioner actually opens for grading. Both are
// embedding calls, not generation -- on the free tier of the same key that's blocked from Search
// grounding, embedding requests returned 200 in testing (measured, not assumed): grounding and
// embeddings are billed separately, so the grounding quota wall documented in db/episode-research.js
// does not apply here.

require("dotenv").config({ path: ".env.local", quiet: true });

const GEMINI_API_BASE = process.env.GEMINI_API_BASE || "https://generativelanguage.googleapis.com/v1beta";
const EMBED_MODEL = process.env.EMBED_MODEL || "gemini-embedding-001";
const DIMENSIONS = 768;

// Calibrated against a small hand-built set of realistic Survivor sentences (five chunks, five
// queries -- see the PR that introduced this file for the raw numbers), not a rigorous statistical
// sample. Genuinely relevant matches scored 0.71-0.75; a deliberately off-topic query's BEST match
// still scored ~0.55, which is this model's noise floor for short sentences, not zero -- so a naive
// "similarity > 0" check would confidently return nonsense. These thresholds sit safely above that
// floor and below the observed relevant range, but they are a starting point, not a proof: revisit
// once there's real grading history to check them against (does a "low confidence" answer actually
// tend to be wrong more often than a "high confidence" one?).
const CONFIDENCE_THRESHOLDS = { high: 0.7, medium: 0.62 };

function confidenceFor(similarity) {
  if (similarity >= CONFIDENCE_THRESHOLDS.high) return "high";
  if (similarity >= CONFIDENCE_THRESHOLDS.medium) return "medium";
  return null; // below the floor: "can't determine confidently" territory, not a real answer.
}

function embedKey() {
  return process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
}

// One HTTP shape, matching db/episode-research.js's postJson -- duplicated rather than imported
// because that function isn't exported (it's a private helper there) and this is a three-line
// fetch, not worth threading a new export through a file this one doesn't otherwise depend on.
async function embedApi(path, body) {
  const key = embedKey();
  if (!key) {
    throw new Error(
      "No embedding credentials found. Set GEMINI_API_KEY (or GOOGLE_API_KEY) in .env.local -- " +
        "semantic search over research needs an embedding model, same key the research provider uses."
    );
  }
  let res;
  try {
    res = await fetch(`${GEMINI_API_BASE}/models/${EMBED_MODEL}:${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify(body),
    });
  } catch (e) {
    throw new Error(`Embeddings: could not reach the API (${e.message}).`);
  }
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* left null -- the raw text below is the better error */
  }
  if (!res.ok) {
    const message = (json && json.error && json.error.message) || text.slice(0, 300);
    throw new Error(`Embeddings HTTP ${res.status}: ${message}`);
  }
  return json;
}

/** Embeds one or more texts in a single request. `taskType` is `RETRIEVAL_DOCUMENT` for text being
 * stored, `RETRIEVAL_QUERY` for text being searched with -- see the file header on why that split
 * matters. Returns one 768-dim vector per input text, in the same order. */
async function embedTexts(texts, taskType) {
  if (!texts.length) return [];
  const json = await embedApi("batchEmbedContents", {
    requests: texts.map((text) => ({
      model: `models/${EMBED_MODEL}`,
      content: { parts: [{ text }] },
      outputDimensionality: DIMENSIONS,
      taskType,
    })),
  });
  if (!json.embeddings || json.embeddings.length !== texts.length) {
    throw new Error("Embeddings: the API returned a different number of vectors than texts sent.");
  }
  return json.embeddings.map((e) => e.values);
}

// One short, human-readable line per notable thing a checklist entry reports -- deliberately the
// same vocabulary as the admin panel's own notesFor() (shows-section.tsx), so a chunk reads like the
// facts a reviewer already sees, not a re-description of them. Kept as its own copy rather than
// shared: that one is a client component (JSX, browser-only), this is a plain CommonJS module a
// route handler calls server-side -- same reasoning as wiki-sync.js duplicating
// plural()/singular() instead of importing the TS version.
function notesFor(c) {
  const notes = [];
  if (c.leftTheGame === "yes") notes.push(`left the game (${c.exitMethod || "method unknown"})`);
  if (typeof c.votesReceived === "number" && c.votesReceived > 0) notes.push(`received ${c.votesReceived} vote(s) at Tribal`);
  if (c.votedFor) notes.push(`voted for ${c.votedFor}`);
  if (c.wonIndividualImmunity === "yes") notes.push("won individual immunity");
  if (c.wonTribeImmunity === "yes") notes.push("was on the tribe that won immunity");
  if (c.wonIndividualReward === "yes") notes.push("won individual reward");
  if (c.wonTribeReward === "yes") notes.push("was on the tribe that won reward");
  if (c.satOutOfChallenge === "yes") notes.push("sat out a challenge");
  if (c.foundAdvantage === "yes") notes.push(`found ${c.advantageFoundName || "an advantage"}`);
  if (c.playedAdvantage === "yes") notes.push(`played ${c.advantagePlayedName || "an advantage"}`);
  if (c.advantageUsedAgainstThem === "yes") notes.push("had an advantage used against them");
  if (c.exiled === "yes") notes.push("was exiled");
  if (c.notableTwist) notes.push(c.notableTwist);
  return notes;
}

/** Turns one episode's research payload into the chunks worth embedding: one episode-level summary,
 * plus one per castaway who has something notable on their checklist -- see the file header on why
 * an empty note is worse than no chunk at all. */
function chunksFromResearch(payload) {
  const chunks = [];
  const summaryText = [payload.episodeTitle, payload.summary].filter(Boolean).join(": ");
  if (summaryText) chunks.push({ castawayName: null, chunkType: "summary", text: summaryText });
  for (const entry of payload.castaways || []) {
    const notes = notesFor(entry);
    if (!notes.length) continue;
    chunks.push({ castawayName: entry.name, chunkType: "castaway_note", text: `${entry.name}: ${notes.join("; ")}.` });
  }
  return chunks;
}

/** Embeds and stores one episode's chunks. Replaces existing rows for the same
 * (show, season, episode, chunk_type, castaway) rather than accumulating -- a re-research (--force)
 * re-embeds cleanly rather than leaving stale chunks behind to compete in search. */
async function storeChunksForEpisode(pool, { showId, season, episodeNumber }, payload) {
  const chunks = chunksFromResearch(payload);
  if (!chunks.length) return { stored: 0 };

  const vectors = await embedTexts(chunks.map((c) => c.text), "RETRIEVAL_DOCUMENT");
  for (let i = 0; i < chunks.length; i++) {
    await pool.query(
      `INSERT INTO episode_text_chunks (show_id, season_number, episode_number, castaway_name, chunk_type, text, embedding, model)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (show_id, season_number, episode_number, chunk_type, COALESCE(castaway_name, ''))
       DO UPDATE SET text = EXCLUDED.text, embedding = EXCLUDED.embedding, model = EXCLUDED.model, created_at = now()`,
      [showId, season, episodeNumber, chunks[i].castawayName, chunks[i].chunkType, chunks[i].text, `[${vectors[i].join(",")}]`, EMBED_MODEL]
    );
  }
  return { stored: chunks.length };
}

/**
 * Semantic search, scoped to one episode: embeds `query` and returns the closest stored chunks by
 * cosine similarity, best first. Returns `{ hasResearch, matches }` -- `hasResearch` is false only
 * when this episode has no chunks at all (nobody has researched it yet), which is a different, more
 * useful answer than "found nothing relevant" for a caller deciding what to tell a commissioner.
 */
async function searchChunks(pool, { showId, season, episodeNumber, query, limit = 3 }) {
  const { rows: any } = await pool.query(
    "SELECT 1 FROM episode_text_chunks WHERE show_id=$1 AND season_number=$2 AND episode_number=$3 LIMIT 1",
    [showId, season, episodeNumber]
  );
  if (!any.length) return { hasResearch: false, matches: [] };

  const [queryVector] = await embedTexts([query], "RETRIEVAL_QUERY");
  const { rows } = await pool.query(
    `SELECT castaway_name AS "castawayName", chunk_type AS "chunkType", text,
            1 - (embedding <=> $4::vector) AS similarity
       FROM episode_text_chunks
      WHERE show_id=$1 AND season_number=$2 AND episode_number=$3
      ORDER BY embedding <=> $4::vector
      LIMIT $5`,
    [showId, season, episodeNumber, `[${queryVector.join(",")}]`, limit]
  );
  return {
    hasResearch: true,
    matches: rows.map((r) => ({ ...r, similarity: Number(r.similarity), confidence: confidenceFor(Number(r.similarity)) })),
  };
}

/**
 * The one call a "suggested answer" route needs: searches for `question`, and reports the single
 * best match with a confidence label, or explains why there isn't one -- 'no-research' (nobody has
 * researched this episode) vs. 'unconfident' (there's research, but nothing matched well enough to
 * trust). Never returns an answer without also returning what backs it, and never returns a
 * confidence label for a match that didn't clear the floor -- see confidenceFor.
 */
async function suggestAnswer(pool, { showId, season, episodeNumber, question }) {
  const { hasResearch, matches } = await searchChunks(pool, { showId, season, episodeNumber, query: question, limit: 1 });
  if (!hasResearch) return { status: "no-research", answer: null, confidence: null, castawayName: null, similarity: null };
  const top = matches[0];
  if (!top || !top.confidence) {
    return {
      status: "unconfident",
      answer: null,
      confidence: null,
      castawayName: top ? top.castawayName : null,
      similarity: top ? top.similarity : null,
    };
  }
  return { status: "ok", answer: top.text, confidence: top.confidence, castawayName: top.castawayName, similarity: top.similarity };
}

module.exports = {
  embedTexts,
  chunksFromResearch,
  notesFor,
  storeChunksForEpisode,
  searchChunks,
  suggestAnswer,
  confidenceFor,
  CONFIDENCE_THRESHOLDS,
  EMBED_MODEL,
  DIMENSIONS,
};
