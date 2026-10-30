import { publicMediaSrc } from "@/lib/game/selectors";
import { coversFact, type FactStatus } from "@/lib/game/fact-status";
import { seasonFormat } from "@db/season-rule-changes.js";
import { isUuid, type SessionUser } from "./auth-helpers";
import { settleNow } from "./community-results";
import { pool, HttpError } from "./db";
import { byNewest, deskLines, logDesk, readable, type DeskLine } from "./desk";
import { syncSeasonLeagues } from "./season-decisions";

// A fact on the desk (docs/PLAN-new-design.md step 6b part 2; the mock's community.js adminFact): what each source said,
// and the people who flagged it, where it counts, and the admin's decision. Deciding makes it canonical and locked
// (status accepted or rejected), so no later answer moves it: every league follows on its own (the season sync), a
// house ruling keeps its own, and the flags on it are answered. Editing it is deciding it happened as the admin says
// (an override, `applied`). A community fact can be reopened: unlocked, and settled again from its sources.

export interface DeskSource {
  who: string;
  couch: string | null;
  source: string;
  at: string;
  /** How it said they left (an elimination), when it differs from the fact's. */
  method: string | null;
}

export interface DeskFact {
  id: string;
  season: { id: string; name: string };
  episode: number;
  kind: string;
  name: string;
  photo: string | null;
  label: string;
  method: string;
  eventType: string;
  status: FactStatus;
  live: boolean;
  locked: { by: string | null; at: string } | null;
  /** Sent by someone (it has sources): it can be reopened and settled again. */
  community: boolean;
  /** The admin's correction, when they edited it. */
  applied: { castawayName?: string; method?: string; eventType?: string } | null;
  yes: DeskSource[];
  no: DeskSource[];
  flags: { who: string; reason: string; note: string; link: string | null; status: string; at: string }[];
  leagues: number;
  rulings: number;
  /** For editing it: the season's cast and the show's ways out and moments. */
  choices: { cast: string[]; methods: string[]; events: { id: string; label: string }[]; groups: string[] };
  history: DeskLine[];
}

const REASON: Record<string, string> = { "didnt-happen": "Didn't happen", "wrong-person": "Wrong person", "wrong-episode": "Wrong episode", other: "Something else", missing: "Something's missing" };
const SOURCE: Record<string, string> = { paste: "pasted the results", quick: "checked who went home", hand: "entered it by hand", bot: "asked our bot (One tap)", autopilot: "Autopilot", tiebreak: "a tie-break run" };

/** One fact, everything the desk needs to decide it. */
export async function deskFact(id: string): Promise<DeskFact> {
  if (!isUuid(id)) throw new HttpError(404, "Fact not found");
  const { rows } = await pool.query(
    `SELECT d.*, ss.show_id, ss.season_number, COALESCE(ss.name, s.name || ' ' || ss.season_number) AS season_name, s.slug,
            COALESCE(lu.username, lu.name) AS locked_name, sc.photo_url
       FROM season_decisions d JOIN show_seasons ss ON ss.id = d.season_id JOIN shows s ON s.id = ss.show_id
       LEFT JOIN "user" lu ON lu.id = d.locked_by
       LEFT JOIN season_cast sc ON sc.season_id = d.season_id AND sc.name = COALESCE(d.applied->>'castawayName', d.castaway_name)
      WHERE d.id = $1`,
    [id]
  );
  if (!rows.length) throw new HttpError(404, "Fact not found");
  const d = rows[0];
  const format = await seasonFormat(pool, d.season_id, { episode: d.episode_number });
  const eventType = d.applied?.eventType || d.event_type;
  const method = d.applied?.method ?? d.method;
  const label =
    d.kind === "event"
      ? (format.data.events.find((e: { id: string; label: string }) => e.id === eventType)?.label ?? readable(eventType))
      : d.kind === "noexit"
        ? "Nobody went home"
        : method || d.kind;

  const { rows: subs } = await pool.query(
    `SELECT er.id, er.source, er.researched_at, er.covers, COALESCE(u.username, u.name) AS who, c.name AS couch, f.method AS said, f.research_id IS NOT NULL AS yes
       FROM episode_research er LEFT JOIN "user" u ON u.id = er.submitted_by LEFT JOIN couches c ON c.id = er.couch_id
       LEFT JOIN fact_sources f ON f.research_id = er.id AND f.decision_id = $1
      WHERE er.show_id = $2 AND er.season_number = $3 AND er.episode_number = $4 AND er.source <> 'combined' AND er.withdrawn_at IS NULL
      ORDER BY er.researched_at`,
    [id, d.show_id, d.season_number, d.episode_number]
  );
  const name = d.applied?.castawayName || d.castaway_name;
  const speaks = (s: (typeof subs)[number]) => s.yes || (!!s.covers && coversFact(s.covers, { kind: d.kind, castawayName: name }));
  const source = (s: (typeof subs)[number]): DeskSource => ({
    who: s.who ?? SOURCE[s.source] ?? "The bot",
    couch: s.couch,
    source: SOURCE[s.source] ?? s.source,
    at: s.researched_at.toISOString(),
    method: s.yes && d.kind !== "event" && s.said && s.said !== method ? s.said : null,
  });
  const { rows: flags } = await pool.query(
    `SELECT x.reason, x.note, x.link, x.status, x.created_at, COALESCE(u.username, u.name) AS who
       FROM fact_disputes x LEFT JOIN "user" u ON u.id = x.user_id WHERE x.decision_id = $1 ORDER BY x.created_at`,
    [id]
  );
  const { rows: counts } = await pool.query(
    `SELECT (SELECT count(*)::int FROM leagues l WHERE l.state->'settings'->>'showId' = $1 AND l.state->'settings'->>'wikiSeason' = $2::text) AS leagues,
            (SELECT count(*)::int FROM league_rulings r WHERE r.decision_id = $3) AS rulings`,
    [d.slug, String(d.season_number), id]
  );
  const [{ rows: cast }, groups] = await Promise.all([
    pool.query("SELECT name FROM season_cast WHERE season_id = $1 ORDER BY sort_order, name", [d.season_id]),
    seasonGroups(d.season_id),
  ]);
  const status = (d.fact_status ?? (d.status === "accepted" ? "canonical" : d.status === "rejected" ? "removed" : "reported")) as FactStatus;
  const locked = d.locked_at || (d.fact_status === null && d.status !== "pending") ? { by: d.locked_name, at: (d.locked_at ?? d.decided_at ?? d.created_at).toISOString() } : null;

  // History: each answer and flag as it came, then the desk's own lines.
  const lines: DeskLine[] = [
    ...subs.filter(speaks).map((s) => ({ id: null, text: `${s.who ?? SOURCE[s.source] ?? "The bot"} ${s.yes ? "said it happened" : "said it didn't"}${s.couch ? ` · ${s.couch}` : ""}`, at: s.researched_at.toISOString(), who: null, undoable: false, undone: false })),
    ...flags.map((f) => ({ id: null, text: `${f.who ?? "Someone"} flagged it: ${REASON[f.reason] ?? f.reason}${f.status !== "open" ? ` · ${f.status}` : ""}`, at: f.created_at.toISOString(), who: null, undoable: false, undone: false })),
    ...(await deskLines("fact", id)),
  ];
  return {
    id,
    season: { id: d.season_id, name: d.season_name },
    episode: d.episode_number,
    kind: d.kind,
    name: d.kind === "noexit" ? "" : name,
    photo: publicMediaSrc(d.photo_url),
    label,
    method,
    eventType,
    status,
    live: d.status === "accepted",
    locked,
    community: subs.some((s) => s.yes),
    applied: d.applied,
    yes: subs.filter((s) => s.yes).map(source),
    no: subs.filter((s) => !s.yes && speaks(s)).map(source),
    flags: flags.map((f) => ({ who: f.who ?? "Someone", reason: REASON[f.reason] ?? f.reason, note: f.note, link: f.link, status: f.status, at: f.created_at.toISOString() })),
    leagues: counts[0].leagues,
    rulings: counts[0].rulings,
    choices: {
      cast: cast.map((c) => c.name),
      methods: format.data.exitMethods,
      events: format.data.events.filter((e: { implied?: boolean }) => !e.implied).map((e: { id: string; label: string }) => ({ id: e.id, label: e.label })),
      groups,
    },
    history: byNewest(lines),
  };
}

/** A season's groups (tribes, teams), for correcting a move: the cast's starting ones, then any its moves name. */
export async function seasonGroups(seasonId: string): Promise<string[]> {
  const { rows } = await pool.query<{ name: string }>(
    `SELECT name FROM (
       SELECT tribe_name AS name, 0 AS o FROM season_cast WHERE season_id = $1 AND COALESCE(tribe_name, '') <> ''
       UNION SELECT COALESCE(applied->>'method', method), 1 FROM season_decisions
        WHERE season_id = $1 AND kind = 'group' AND status = 'accepted' AND COALESCE(applied->>'method', method) <> ''
     ) g GROUP BY name ORDER BY min(o), name`,
    [seasonId]
  );
  return rows.map((r) => r.name);
}

export type Before = { status: string; fact_status: string | null; locked_at: string | null; locked_by: string | null; applied: unknown; decided_at: string | null; decided_by: string | null };

/**
 * The admin decides a fact: `yes` (it happened) or `no` (it didn't) makes it canonical and locked; `edit` decides it
 * happened as given; `reopen` unlocks a community fact and settles it again from its sources. Every league on the
 * season follows (the sync, with a correction line where it came out); the flags on it are answered.
 */
export async function decideFact(user: SessionUser, id: string, body: { decide?: unknown; edit?: { castawayName?: unknown; method?: unknown; eventType?: unknown }; reopen?: unknown }): Promise<DeskFact & { changeId: string }> {
  const fact = await deskFact(id);
  const { rows } = await pool.query("SELECT status, fact_status, locked_at, locked_by, applied, decided_at, decided_by, kind FROM season_decisions WHERE id = $1", [id]);
  const before: Before = rows[0];
  const lockSql = "locked_at = now(), locked_by = $2, decided_at = clock_timestamp(), decided_by = $2";
  let text: string;
  let flagsTo: "kept" | "upheld" | null = null;
  if (body.reopen === true) {
    if (!fact.community) throw new HttpError(409, "An admin decided this before results were shared: there are no sources to settle it again from. Decide it instead.");
    await pool.query("UPDATE season_decisions SET locked_at = NULL, locked_by = NULL, applied = NULL, fact_status = 'reported' WHERE id = $1", [id]);
    text = "Reopened: settled again from its sources";
  } else if (body.decide === "yes" || body.decide === "no") {
    const yes = body.decide === "yes";
    await pool.query(
      `UPDATE season_decisions SET status = $3, fact_status = $4, ${lockSql} WHERE id = $1`,
      [id, user.id, yes ? "accepted" : "rejected", yes ? "canonical" : "removed"]
    );
    text = yes ? "Decided: it happened · canonical, locked" : "Decided: it didn't happen · removed for everyone, locked";
    flagsTo = yes ? "kept" : "upheld";
  } else if (body.edit && typeof body.edit === "object") {
    if (fact.kind === "noexit") throw new HttpError(400, "Nobody went home has nothing to edit: it happened or it didn't.");
    const e = body.edit;
    const castawayName = typeof e.castawayName === "string" && e.castawayName.trim() ? e.castawayName.trim() : fact.name;
    if (!fact.choices.cast.some((c) => c === castawayName)) throw new HttpError(400, `${castawayName} isn't in this season's cast`);
    const applied: Record<string, string> = { castawayName };
    if (fact.kind === "elimination") {
      const m = typeof e.method === "string" && e.method.trim() ? e.method.trim() : fact.method;
      if (!fact.choices.methods.includes(m)) throw new HttpError(400, `"${m}" isn't a way to leave this show`);
      applied.method = m;
    } else if (fact.kind === "event") {
      const t = typeof e.eventType === "string" && e.eventType.trim() ? e.eventType.trim() : fact.eventType;
      if (!fact.choices.events.some((x) => x.id === t)) throw new HttpError(400, `"${t}" isn't a moment on this show`);
      applied.eventType = t;
    } else if (fact.kind === "group") {
      // A move to the group they went to (Survivor 51's Episode 3 had Carter "to Savu", the tribe he left).
      const g = typeof e.method === "string" && e.method.trim() ? e.method.trim() : fact.method;
      if (!fact.choices.groups.includes(g)) throw new HttpError(400, `"${g}" isn't one of ${fact.season.name}'s groups`);
      applied.method = g;
    }
    await pool.query(`UPDATE season_decisions SET applied = $3::jsonb, status = 'accepted', fact_status = 'canonical', ${lockSql} WHERE id = $1`, [id, user.id, JSON.stringify(applied)]);
    text = `Overrode it: ${castawayName}${applied.method ? ` · ${applied.method}` : ""}${applied.eventType ? ` · ${readable(applied.eventType)}` : ""} · canonical, locked`;
    flagsTo = "upheld";
  } else throw new HttpError(400, "decide yes or no, edit, or reopen");

  if (flagsTo) await pool.query("UPDATE fact_disputes SET status = $2, settled_at = now() WHERE decision_id = $1 AND status = 'open'", [id, flagsTo]);
  const changeId = await logDesk(pool, { entity: "fact", entityId: id, action: body.reopen ? "reopen" : body.edit ? "edit" : "decide", text, before, undo: { type: "fact", before }, userId: user.id });
  if (body.reopen === true) await settleNow(fact.season.id, fact.episode);
  await syncSeasonLeagues(fact.season.id, user.id);
  // The change's id, for a toast's Undo (an episode's page decides from its rows).
  return { ...(await deskFact(id)), changeId };
}

/** Puts a fact back the way it was before the desk's change (History's Undo), then every league follows. */
export async function restoreFact(id: string, before: Before, userId: string): Promise<void> {
  const at = await putBack(id, before);
  if (!before.locked_at && before.fact_status) await settleNow(at.season_id, at.episode_number);
  await syncSeasonLeagues(at.season_id, userId);
}

/** Puts several facts of one season back (Accept all's Undo, an episode's page), then every league follows once. */
export async function restoreFacts(list: { id: string; before: Before }[], userId: string): Promise<void> {
  const settled = new Map<string, { season_id: string; episode_number: number }>();
  let season: string | null = null;
  for (const { id, before } of list) {
    const at = await putBack(id, before).catch((e) => (e instanceof HttpError && e.status === 404 ? null : Promise.reject(e)));
    if (!at) continue;
    season = at.season_id;
    if (!before.locked_at && before.fact_status) settled.set(`${at.season_id}:${at.episode_number}`, at);
  }
  for (const at of settled.values()) await settleNow(at.season_id, at.episode_number);
  if (season) await syncSeasonLeagues(season, userId);
}

async function putBack(id: string, before: Before): Promise<{ season_id: string; episode_number: number }> {
  const { rows } = await pool.query(
    `UPDATE season_decisions SET status = $2, fact_status = $3, locked_at = $4, locked_by = $5, applied = $6::jsonb, decided_at = COALESCE($7, decided_at), decided_by = $8
      WHERE id = $1 RETURNING season_id, episode_number`,
    [id, before.status, before.fact_status, before.locked_at, before.locked_by, before.applied == null ? null : JSON.stringify(before.applied), before.decided_at, before.decided_by]
  );
  if (!rows.length) throw new HttpError(404, "Fact not found");
  // Its decided_at moved with the desk's change; the leagues compare it, so a fresh one makes them take it again.
  await pool.query("UPDATE season_decisions SET decided_at = clock_timestamp() WHERE id = $1", [id]);
  return rows[0];
}
