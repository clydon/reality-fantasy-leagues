import { ensureSeasonRulebook } from "@db/rulebooks.js";
import { isUuid, type SessionUser } from "./auth-helpers";
import { setWhoFills } from "./community-results";
import { pool, HttpError } from "./db";
import { byNewest, deskLines, logDesk, type DeskLine } from "./desk";
import { gameName } from "./league-season";
import { artAutomatic, chooseArt, deskArt, findArtForShow, findArtLater, setArtOff, type DeskArt } from "./show-art";

// Couches, people and shows on the desk (docs/PLAN-new-design.md step 6b part 2; the mock's community.js adminEntity):
// a couch's people, its games and who runs each, who fills in its results (Override), and the games nobody runs (its only
// Commissioner left or deleted their account: the Inbox's couch nobody runs), which its page hands on through Hand on
// (desk-seats.ts handOn, with no `from`: docs/PLAN-desk-parity.md step 2). (A person is desk-people.ts's.) A show's seasons, to go to, who added it (step 10 part 3: a show added by
// name waits in the Inbox until the desk says Looks fine or archives it), and New season.

export interface DeskCouch {
  id: string;
  name: string;
  /** `colour`: the one they chose for their face (null: their id picks one). */
  members: { userId: string; name: string; role: string; colour: string | null }[];
  games: { leagueId: string; name: string; season: string; gameName: string; runners: string[]; players: { userId: string; name: string }[] }[];
  anyone: boolean;
  rulings: number;
  /** Games nobody runs, and who could take each on (people who play it). */
  stranded: { leagueId: string; name: string }[];
  history: DeskLine[];
}

export async function deskCouch(id: string): Promise<DeskCouch> {
  if (!isUuid(id)) throw new HttpError(404, "Couch not found");
  const { rows: c } = await pool.query("SELECT id, name, results_by_anyone FROM couches WHERE id = $1", [id]);
  if (!c.length) throw new HttpError(404, "Couch not found");
  const { rows: members } = await pool.query(
    `SELECT m.user_id, COALESCE(u.username, u.name) AS name, m.role, st.colour FROM couch_members m JOIN "user" u ON u.id = m.user_id
       LEFT JOIN user_settings st ON st.user_id = m.user_id WHERE m.couch_id = $1 ORDER BY m.role DESC, u.username`,
    [id]
  );
  const { rows: leagues } = await pool.query(
    `SELECT l.id, l.name, l.state->'settings'->>'leagueTypeId' AS type, l.state->'settings'->>'showId' AS show, l.state->'settings'->>'wikiSeason' AS season
       FROM leagues l WHERE l.couch_id = $1 AND l.deleted_at IS NULL ORDER BY l.name`,
    [id]
  );
  const { rows: seats } = await pool.query(
    `SELECT m.league_id, m.user_id, m.role, COALESCE(u.username, u.name) AS name, u.role = 'admin' AS site FROM league_memberships m JOIN "user" u ON u.id = m.user_id WHERE m.league_id = ANY($1::uuid[])`,
    [leagues.map((l) => l.id)]
  );
  const { rows: rulings } = await pool.query("SELECT count(DISTINCT decision_id)::int AS n FROM league_rulings WHERE league_id = ANY($1::uuid[])", [leagues.map((l) => l.id)]);
  const games = leagues.map((l) => ({
    leagueId: l.id,
    name: l.name,
    season: [l.show, l.season].filter(Boolean).join(" "),
    gameName: gameName(l.type),
    runners: seats
      .filter((s) => s.league_id === l.id && (s.role === "commissioner" || s.role === "admin" || s.site))
      .map((s) => `${s.name}${s.role === "admin" ? " (Game admin)" : s.role !== "commissioner" ? " (site admin)" : ""}`),
    players: seats.filter((s) => s.league_id === l.id).map((s) => ({ userId: s.user_id, name: s.name })),
  }));
  const { rows: lines } = await pool.query(
    `SELECT ch.text, ch.created_at, COALESCE(u.username, u.name) AS who FROM league_changes ch LEFT JOIN "user" u ON u.id = ch.user_id
      WHERE ch.league_id = ANY($1::uuid[]) AND ch.kind IN ('role', 'settings.fill', 'member') ORDER BY ch.created_at DESC LIMIT 15`,
    [leagues.map((l) => l.id)]
  );
  return {
    id,
    name: c[0].name,
    members: members.map((m) => ({ userId: m.user_id, name: m.name, role: m.role, colour: m.colour ?? null })),
    games,
    anyone: c[0].results_by_anyone,
    rulings: rulings[0].n,
    stranded: games
      .filter((g) => g.players.length && !seats.some((s) => s.league_id === g.leagueId && (s.role === "commissioner" || s.site)))
      .map((g) => ({ leagueId: g.leagueId, name: g.name })),
    history: byNewest([
      ...lines.map((r) => ({ id: null, text: `${r.who ? `${r.who}: ` : ""}${r.text}`, at: r.created_at.toISOString(), who: null, undoable: false, undone: false })),
      ...(await deskLines("couch", id)),
    ]),
  };
}

/** Override who can fill in the couch's results. */
export async function couchFill(user: SessionUser, couchId: string, anyone: unknown): Promise<DeskCouch> {
  if (typeof anyone !== "boolean") throw new HttpError(400, "anyone is true or false");
  const couch = await deskCouch(couchId);
  if (couch.anyone === anyone) return couch;
  await setWhoFills(user.id, couchId, couch.games.map((g) => g.leagueId), anyone);
  await logDesk(pool, {
    entity: "couch",
    entityId: couchId,
    action: "fill",
    text: anyone ? "Overrode who fills in results: anyone on the couch" : "Overrode who fills in results: only people who run games",
    undo: { type: "couchFill", id: couchId, anyone: couch.anyone },
    userId: user.id,
  });
  return deskCouch(couchId);
}

export interface DeskShow {
  id: string;
  name: string;
  format: string | null;
  kind: string | null;
  /** A game for every couch (Make it a game, or set up by the desk); else "Not a game yet". */
  setUp: boolean;
  archived: boolean;
  /** Someone added it (Add a show): who, when, and whether it came from a TV listing (else by name, with no schedule). */
  added: { by: string | null; at: string; listing: boolean } | null;
  /** The desk looked at it (a show added by name waits in the Inbox until then). */
  reviewed: { by: string | null; at: string } | null;
  seasons: { id: string; name: string; status: string | null; number: number; rulebookId: string | null }[];
  /** Its art and the finder's state (show-art.ts): Choose art, Find art and photos, No art or photos. */
  art: DeskArt;
  history: DeskLine[];
}

export async function deskShow(id: string): Promise<DeskShow> {
  if (!isUuid(id)) throw new HttpError(404, "Show not found");
  const { rows } = await pool.query(
    `SELECT s.id, s.name, s.format, s.kind, s.set_up_at, s.archived, s.created_at, s.created_by, s.tvmaze_id, s.reviewed_at,
            COALESCE(a.username, a.name) AS added_by, COALESCE(r.username, r.name) AS reviewed_by
       FROM shows s LEFT JOIN "user" a ON a.id = s.created_by LEFT JOIN "user" r ON r.id = s.reviewed_by WHERE s.id = $1`,
    [id]
  );
  if (!rows.length) throw new HttpError(404, "Show not found");
  const s = rows[0];
  const { rows: seasons } = await pool.query(
    `SELECT ss.id, COALESCE(ss.name, s.name || ' ' || ss.season_number) AS name, ss.status, ss.season_number AS number,
            (SELECT r.id FROM rulebooks r WHERE r.owner_kind = 'season' AND r.season_id = ss.id AND r.status <> 'archived') AS "rulebookId"
       FROM show_seasons ss JOIN shows s ON s.id = ss.show_id WHERE ss.show_id = $1 ORDER BY ss.season_number DESC`,
    [id]
  );
  return {
    id,
    name: s.name,
    format: s.format,
    kind: s.kind,
    setUp: !!s.set_up_at,
    archived: !!s.archived,
    added: s.created_by ? { by: s.added_by, at: s.created_at.toISOString(), listing: s.tvmaze_id != null } : null,
    reviewed: s.reviewed_at ? { by: s.reviewed_by, at: s.reviewed_at.toISOString() } : null,
    seasons,
    art: await deskArt(id),
    history: byNewest(await deskLines("show", id)),
  };
}

/**
 * The desk on a show: Looks fine (a show added by name, looked at), archived (out of everyone's search; its follows and
 * games stay), or a new season (the next number, nothing known about it yet). A set-up show's new season starts as the
 * last season's rulebook (db/rulebooks.js sameAsLastSeason) and plays by it; its cast comes from Backstage as any season's.
 */
export async function deskShowAction(user: SessionUser, id: string, body: { action?: unknown }): Promise<DeskShow & { seasonId?: string }> {
  const show = await deskShow(id);
  if (body.action === "reviewed" || body.action === "archive") {
    const archive = body.action === "archive";
    if (!archive && show.reviewed) throw new HttpError(409, "Looked at already");
    await pool.query("UPDATE shows SET reviewed_at = now(), reviewed_by = $2, archived = CASE WHEN $3 THEN true ELSE archived END, updated_at = now() WHERE id = $1", [id, user.id, archive]);
    await logDesk(pool, {
      entity: "show",
      entityId: id,
      action: String(body.action),
      text: archive ? "Archived: out of everyone's search" : "Looks fine",
      undo: { type: "showReviewed", id, archived: show.archived },
      userId: user.id,
    });
    return deskShow(id);
  }
  if (body.action === "season") {
    const next = Math.max(0, ...show.seasons.map((s) => s.number)) + 1;
    const { rows } = await pool.query(
      `INSERT INTO show_seasons (show_id, season_number, status) VALUES ($1, $2, 'upcoming') ON CONFLICT (show_id, season_number) DO NOTHING RETURNING id`,
      [id, next]
    );
    if (!rows.length) throw new HttpError(409, "That season was added a moment ago");
    const seasonId = rows[0].id as string;
    if (show.setUp) await ensureSeasonRulebook(pool, seasonId);
    await logDesk(pool, { entity: "show", entityId: id, action: "season", text: `Added season ${next}${show.setUp ? ", playing by last season's rulebook" : ""}`, userId: user.id });
    findArtLater({ seasonId });
    return { ...(await deskShow(id)), seasonId };
  }
  // Art (show-art.ts): look now, choose one by hand, back to automatic, or the off switch.
  if (body.action === "findArt") {
    const found = await findArtForShow(id);
    const text = `Looked for art and photos: ${found.art ? "the show's art" : "no show art"}, ${found.seasons} season poster${found.seasons === 1 ? "" : "s"}, ${found.photos} photo${found.photos === 1 ? "" : "s"}`;
    await logDesk(pool, { entity: "show", entityId: id, action: "findArt", text, userId: user.id });
    return deskShow(id);
  }
  if (body.action === "chooseArt") {
    const what = await chooseArt(id, body as Record<string, unknown>).catch((e) => {
      throw new HttpError(400, (e as Error).message);
    });
    await logDesk(pool, { entity: "show", entityId: id, action: "chooseArt", text: `Chose ${what}`, userId: user.id });
    return deskShow(id);
  }
  if (body.action === "artAutomatic") {
    await artAutomatic(id);
    await logDesk(pool, { entity: "show", entityId: id, action: "artAutomatic", text: "Art back to automatic", userId: user.id });
    return deskShow(id);
  }
  if (body.action === "artOff") {
    const off = (body as { off?: unknown }).off === true;
    const { photos } = await setArtOff(id, off);
    const text = off ? `No art or photos: took down the art and ${photos} found photo${photos === 1 ? "" : "s"}` : "Art and photos back on";
    await logDesk(pool, { entity: "show", entityId: id, action: "artOff", text, userId: user.id });
    return deskShow(id);
  }
  throw new HttpError(400, "action is reviewed, archive, season, findArt, chooseArt, artAutomatic or artOff");
}
