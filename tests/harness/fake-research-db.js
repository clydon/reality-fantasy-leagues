// An in-memory stand-in for the handful of tables db/episode-research.js reads and writes, so its
// store-and-stage behaviour can be tested without Postgres (tests/episode-research-cache.test.js, and
// tests/harness/research-store-regression.js, which diffs the pre- and post-change file's writes).
//
// It answers by recognising each query the research path actually issues -- not a SQL engine. A query
// it doesn't recognise throws, so a new query in the code under test fails loudly here rather than
// silently returning nothing.
//
// season_decisions follows db/season-decisions.js's upsert closely enough to matter: the identity
// key, pending-only updates, the confidence upgrade, and the stale-row withdrawal a re-stage does.
const CONF = { low: 1, medium: 2, high: 3 };

function fakeResearchDb({ shows = [], seasons = [], seasonCast = [], leagues = [] } = {}) {
  let nextId = 1;
  const id = (prefix) => `${prefix}-${nextId++}`;
  const db = {
    shows,
    seasons: seasons.map((s) => ({ id: s.id || id("season"), ...s })),
    seasonCast,
    leagues,
    research: [], // { id, show_id, season_number, episode_number, payload, provenance, researched_at }
    decisions: [], // season_decisions rows
    log: [], // every write, in order, for regression diffs
  };

  function query(sql, params = []) {
    const s = sql.replace(/\s+/g, " ").trim();
    const rows = (r) => ({ rows: r, rowCount: r.length });

    if (/^(BEGIN|COMMIT|ROLLBACK)$/.test(s)) return rows([]);
    if (s.startsWith("SELECT pg_advisory_xact_lock")) return rows([{}]);

    if (s.startsWith("SELECT id, name, state FROM leagues WHERE id=$1")) {
      return rows(db.leagues.filter((l) => l.id === params[0]));
    }
    if (s.startsWith("SELECT state FROM leagues WHERE state->'settings'->>'showId' = $1")) {
      return rows(
        db.leagues
          .filter((l) => l.state.settings.showId === params[0] && String(l.state.settings.wikiSeason) === params[1])
          .map((l) => ({ state: l.state }))
      );
    }
    if (s.startsWith("SELECT s.id AS show_id, s.name AS show_name")) {
      const show = db.shows.find((x) => x.slug === params[0]);
      if (!show) return rows([]);
      const season = db.seasons.find((x) => x.show_id === show.id && x.season_number === Number(params[1]));
      return rows([
        {
          show_id: show.id,
          show_name: show.name,
          castaway_term: null,
          // A show's own word for its groups when the scenario gives one (The Challenge's row says "Agency").
          tribe_term: show.tribe_term || null,
          research_domains: [],
          wiki_api_url: null,
          format: show.format,
          season_id: season ? season.id : null,
          season_name: season ? season.name || null : null,
        },
      ]);
    }
    if (s.startsWith("SELECT name FROM season_cast WHERE season_id=$1")) {
      return rows(db.seasonCast.filter((c) => c.season_id === params[0]).map((c) => ({ name: c.name })));
    }
    if (s.startsWith("SELECT id, name, tribe_name FROM season_cast WHERE season_id=$1")) {
      return rows(db.seasonCast.filter((c) => c.season_id === params[0]).map((c, i) => ({ id: `sc-${i}`, name: c.name, tribe_name: null })));
    }
    // Each person's group going into an episode (episode-research.js groupsGoingInto): the cast's, then staged moves.
    if (s.startsWith("SELECT name, tribe_name FROM season_cast WHERE season_id=$1")) {
      return rows(db.seasonCast.filter((c) => c.season_id === params[0]).map((c) => ({ name: c.name, tribe_name: c.tribe_name || null })));
    }
    if (s.startsWith("SELECT castaway_name, COALESCE(applied->>'method', method) AS grp FROM season_decisions")) {
      return rows(
        db.decisions
          .filter((d) => d.season_id === params[0] && d.kind === "group" && d.status !== "rejected" && d.episode_number < params[1])
          .map((d) => ({ castaway_name: d.castaway_name, grp: d.method || null }))
      );
    }
    if (s.startsWith("SELECT payload FROM wiki_extractions")) return rows([]);
    if (s.startsWith("SELECT payload FROM episode_research WHERE show_id=$1 AND season_number=$2 AND episode_number < $3")) {
      return rows(db.research.filter((r) => r.show_id === params[0] && r.season_number === params[1] && r.episode_number < params[2]));
    }
    // The season's format state over time (db/format-timeline.js REPORTS, F3 part 2): each earlier combined answer's format
    // section, `merged` and who it has going home, in order.
    if (s.startsWith("SELECT episode_number, payload->'formatState' AS state, payload->>'merged' AS merged,")) {
      return rows(
        db.research
          .filter((r) => r.show_id === params[0] && r.season_number === params[1] && r.episode_number < params[2])
          .sort((a, b) => a.episode_number - b.episode_number)
          .map((r) => ({
            episode_number: r.episode_number,
            state: r.payload && r.payload.formatState !== undefined ? r.payload.formatState : null,
            merged: r.payload && typeof r.payload.merged === "string" ? r.payload.merged : null,
            left_names: ((r.payload && Array.isArray(r.payload.castaways) ? r.payload.castaways : []).filter((c) => c && typeof c === "object" && c.leftTheGame === "yes").map((c) => c.name)),
          }))
      );
    }
    // How the game was organised going into an episode (episode-research.js formatGoingInto, before F3 part 2): earlier
    // answers' format sections (the regression's before copy still asks it).
    if (s.startsWith("SELECT episode_number, payload->'formatState' AS state FROM episode_research")) {
      return rows(
        db.research
          .filter((r) => r.show_id === params[0] && r.season_number === params[1] && r.episode_number < params[2])
          .filter((r) => r.payload && r.payload.formatState && typeof r.payload.formatState === "object" && !Array.isArray(r.payload.formatState))
          .sort((a, b) => b.episode_number - a.episode_number)
          .map((r) => ({ episode_number: r.episode_number, state: r.payload.formatState }))
      );
    }
    if (s.startsWith("SELECT episode_number, payload->>'episodeTitle' AS title")) {
      return rows(
        db.research
          .filter((r) => r.show_id === params[0] && r.season_number === params[1])
          .map((r) => ({ episode_number: r.episode_number, title: r.payload.episodeTitle ?? null, air_date: r.payload.airDate ?? null, summary: r.payload.summary ?? null }))
      );
    }
    if (s.startsWith("DELETE FROM episode_research WHERE show_id=$1")) {
      const before = db.research.length;
      db.research = db.research.filter((r) => !(r.show_id === params[0] && r.season_number === params[1] && r.episode_number === params[2]));
      db.log.push({ write: "cleared", key: params });
      return { rows: [], rowCount: before - db.research.length };
    }
    if (s.startsWith("DELETE FROM episode_text_chunks")) return rows([]);
    if (s.startsWith("UPDATE season_decisions SET from_research = false WHERE season_id=$1 AND episode_number=$2")) {
      for (const d of db.decisions) {
        if (d.season_id === params[0] && d.episode_number === params[1] && d.status === "pending" && d.from_research) d.from_research = false;
      }
      return rows([]);
    }
    if (s.startsWith("DELETE FROM season_decisions WHERE season_id=$1 AND episode_number=$2")) {
      const before = db.decisions.length;
      db.decisions = db.decisions.filter(
        (d) => !(d.season_id === params[0] && d.episode_number === params[1] && d.status === "pending" && !d.from_wiki && !d.from_research)
      );
      return { rows: [], rowCount: before - db.decisions.length };
    }
    if (s.startsWith("SELECT payload, provenance, researched_at FROM episode_research")) {
      return rows(db.research.filter((r) => r.show_id === params[0] && r.season_number === params[1] && r.episode_number === params[2]));
    }
    if (s.startsWith("SELECT id, version, effective_episode, summary, delta FROM season_rule_changes")) return rows([]);
    // Research asks a season by its own rulebook when it plays by one (db/rulebooks.js seasonResearchRulebook): here no
    // season has a rulebook and the rulebooks switch is off, so the show's format is what's asked.
    if (s.startsWith("SELECT r.id, r.version, r.compiled_source, r.compiled->>'id' AS data_id FROM rulebooks r")) return rows([]);
    if (s.startsWith("SELECT value FROM app_settings WHERE key=$1")) return rows([]);
    if (s.startsWith("SELECT rulebook_live FROM show_seasons WHERE id=$1")) return rows([]);
    if (s.startsWith("SELECT id FROM show_seasons WHERE show_id=$1 AND season_number=$2")) {
      return rows(db.seasons.filter((x) => x.show_id === params[0] && x.season_number === params[1]).map((x) => ({ id: x.id })));
    }
    if (s.startsWith("INSERT INTO show_seasons (show_id, season_number)")) {
      db.log.push({ write: "show_seasons", params });
      if (!db.seasons.some((x) => x.show_id === params[0] && x.season_number === params[1])) {
        db.seasons.push({ id: id("season"), show_id: params[0], season_number: params[1], lazy: true });
      }
      return rows([]);
    }
    if (s.startsWith("INSERT INTO episode_research")) {
      const [showId, season, ep, payload, provenance] = params;
      // researchedAt is a clock reading, not behaviour -- left out of the diffed log.
      const prov = JSON.parse(provenance);
      delete prov.researchedAt;
      db.log.push({ write: "episode_research", key: [showId, season, ep], payload: JSON.parse(payload), provenance: prov });
      let row = db.research.find((r) => r.show_id === showId && r.season_number === season && r.episode_number === ep);
      if (!row) {
        row = { id: id("research"), show_id: showId, season_number: season, episode_number: ep };
        db.research.push(row);
      }
      Object.assign(row, { payload: JSON.parse(payload), provenance: JSON.parse(provenance), researched_at: "2026-10-08T00:00:00.000Z" });
      return rows([{ id: row.id }]);
    }
    if (s.startsWith("SELECT bool_or(post_merge) AS post_merge FROM season_decisions")) return rows([{ post_merge: null }]);
    if (s.startsWith("INSERT INTO season_decisions")) {
      const [seasonId, episode, , kind, name, method, eventType, confidence, , , , researchId, sources, rank] = params;
      db.log.push({ write: "season_decisions", episode, kind, name, method, eventType, confidence });
      const existing = db.decisions.find(
        (d) => d.season_id === seasonId && d.episode_number === episode && d.kind === kind && d.castaway_name === name && d.event_type === eventType
      );
      if (existing) {
        existing.from_research = true;
        existing.research_id = researchId || existing.research_id;
        existing.sources = sources;
        if (existing.status === "pending") {
          existing.method = method;
          if (rank > CONF[existing.confidence]) existing.confidence = confidence;
        }
        return rows([{ id: existing.id, inserted: false }]);
      }
      const row = {
        id: id("decision"),
        season_id: seasonId,
        episode_number: episode,
        kind,
        castaway_name: name,
        method,
        event_type: eventType,
        confidence,
        from_wiki: false,
        from_research: true,
        research_id: researchId,
        sources,
        status: "pending",
      };
      db.decisions.push(row);
      return rows([{ id: row.id, inserted: true }]);
    }
    if (s.startsWith("UPDATE season_decisions SET from_research = false")) {
      const [seasonId, ids, episode] = params;
      for (const d of db.decisions) {
        if (d.season_id === seasonId && d.status === "pending" && d.from_research && !ids.includes(d.id) && (episode == null || d.episode_number === episode)) {
          d.from_research = false;
        }
      }
      return rows([]);
    }
    if (s.startsWith("DELETE FROM season_decisions WHERE season_id=$1 AND status='pending' AND NOT from_wiki AND NOT from_research")) {
      const before = db.decisions.length;
      db.decisions = db.decisions.filter((d) => !(d.season_id === params[0] && d.status === "pending" && !d.from_wiki && !d.from_research));
      const removed = before - db.decisions.length;
      if (removed) db.log.push({ write: "withdrawn", count: removed });
      return { rows: [], rowCount: removed };
    }
    throw new Error("fake-research-db: unexpected query: " + s.slice(0, 160));
  }

  const pool = {
    query: async (sql, params) => query(sql, params),
    connect: async () => ({ query: async (sql, params) => query(sql, params), release() {} }),
  };
  return { db, pool };
}

// db/episode-research.js indexes every stored run for semantic search, which loads a local embedding
// model -- slow, and beside the point here. Swapped for a no-op before the module is first required.
function stubEmbeddings() {
  const path = require.resolve("../../db/embeddings.js");
  const Module = require("module");
  const stub = new Module(path);
  stub.filename = path;
  stub.loaded = true;
  stub.exports = { storeChunksForEpisode: async () => ({ stored: 0 }) };
  require.cache[path] = stub;
}

module.exports = { fakeResearchDb, stubEmbeddings };
