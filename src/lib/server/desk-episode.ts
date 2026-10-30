import { publicMediaSrc } from "@/lib/game/selectors";
import type { FactStatus } from "@/lib/game/fact-status";
import { buildPasteImportPrompt, researchFromPaste, researchItems } from "@db/episode-research.js";
import { seasonFormat } from "@db/season-rule-changes.js";
import { isUuid, type SessionUser } from "./auth-helpers";
import { confirmAt, sendResults, settleNow, settleWhatIf, withNobodyOut, withdrawResults, type SubmittedFact } from "./community-results";
import { pool, HttpError } from "./db";
import { SEASON_NAME, logDesk, readable, type DeskLine } from "./desk";
import { bankBrief } from "./desk-bingo";
import { seasonBot } from "./desk-bot";
import { mdIn, plural, whenAt, timeIn } from "./desk-dates";
import { andList } from "./desk-seats";
import { finalResultsAt } from "@/lib/game/final-results.js";
import { seasonGroups, type Before } from "./desk-facts";
import { seenThrough } from "./guard";
import { LEAGUE_SEASON_JOIN } from "./league-season";
import { DEFAULT_RUNTIME_MIN, seasonSchedules } from "./schedule";
import { gamesApart, matchSeasonGames, syncSeasonLeagues, type GameApart } from "./season-decisions";

// An episode's page on the desk (docs/PLAN-desk-parity.md step 4, part 4b; the mock's desk-research.js rsEpPage): its lower
// third (Early, Final or Waiting, and who went home), its Results read from the new design's shared facts (fact-status.ts:
// not classic's staged rows), its Answers (every submission a source: a couch's paste or quick check, One tap, our bot's
// runs, the desk's own paste), its trivia and bingo, History, and Clear its results last.
//
//   Not in the games yet   a reported fact that isn't in every game (one source, and it wasn't sure), or a name nobody in
//                          the cast has: Accept (canonical, locked: desk-facts.ts decideFact), Reject, Correct (Who?), or
//                          Accept all (tier 2: what moves said first).
//   Disputed               to its fact page (the sources split, or a player's flag no answer has checked).
//   In every game          grouped by result; each one can be corrected, taken out (tier 2) or unlocked.
//   Answers                each a source; Take it back withdraws it (tier 2: what only it reported leaves every game).
//   Paste an answer        the plain Ask an AI (buildPasteImportPrompt's question), previewed (settleWhatIf), then filed as
//                          a submission of the desk's own (community-results.ts sendResults), as a couch's paste is.
//   Clear                  tier 3, everything (classic's scope=everything); or only what's waiting (tier 1, with Undo).
//
// Its History lines are the season's ('season', action 'episode', `after.episode`), beside each answer as it came in and
// each of its facts' own desk lines.

export type FactState = "wait" | "disputed" | "live" | "canon" | "gone";

export interface EpisodeFact {
  id: string;
  kind: string;
  /** The castaway (as corrected), or '' for "Nobody went home". */
  name: string;
  photo: string | null;
  /** "Voted Out", "Found an idol", "Nobody went home". */
  label: string;
  state: FactState;
  /** Nobody in the cast has this name: say who before it goes in. */
  unknown: boolean;
  /** The cast name it most likely is. */
  guess: string | null;
  /** Why it's where it is, in a line. */
  why: string;
  /** How many sources say so (one each). */
  sources: number;
  /** The answers that reported it. */
  by: string[];
  /** Canonical or removed by an admin: who ("you" for the viewer). */
  decidedBy: string | null;
  /** What it said before an admin corrected it. */
  corrected: string | null;
  /** It came from someone's answer (it can be unlocked and settled again from them). */
  community: boolean;
}

export interface EpisodeAnswer {
  id: string;
  kind: "quick" | "paste" | "hand" | "bot";
  /** Who sent it (their face), or null for our bot's own. */
  person: { id: string; name: string } | null;
  title: string;
  line: string;
  /** What it says about itself, for its sheet. */
  detail: string;
  /** The results it reports that aren't out of every game, and those only it reports. */
  mine: string[];
  only: string[];
}

export interface TriviaQuestion {
  id: string;
  question: string;
  answer: string;
  /** Why it's out of trivia ("its check dropped it: ..."), or null while it's asked. */
  out: string | null;
  /** Out by a site admin's flag: Put it back undoes that. */
  byAdmin: boolean;
}

export interface DeskEpisode {
  season: { id: string; name: string; show: { id: string; name: string } };
  n: number;
  aired: boolean;
  /** The lower third: its tag, and its line under the title. */
  tag: "Early" | "Final" | "Waiting" | "Tonight" | "Coming up";
  date: string;
  /** "Thien An voted out", or null (none yet, or nobody named). */
  wentHome: string | null;
  meta: string;
  /** Not aired: when it ends, for "Results come in after it ends at 9:05 PM". */
  endsAt: string | null;
  /** Players' final results (12:00 noon the day after it airs, final-results.js): "Fri, 12:00 PM", and whether that's passed. */
  finalAt: { when: string; passed: boolean } | null;
  /** The viewer has seen it (Hide names starts off), by their mark like any page. */
  seen: boolean;
  /** Who decides results: "admin" (nothing reaches the games until accepted) or "leagues" (sources agreeing). */
  resultsBy: "admin" | "leagues";
  confirmAt: number;
  games: number;
  facts: EpisodeFact[];
  answers: EpisodeAnswer[];
  /** For Correct: the cast still in for the episode (photos), and the show's ways out and moments. */
  choices: { cast: { name: string; photo: string | null }[]; methods: string[]; events: { id: string; label: string }[]; groups: string[] };
  trivia: TriviaQuestion[];
  /** Its trivia run is on the season's schedule. */
  triviaOn: boolean;
  /** Its own bingo squares on new cards, or null: none of its own (part 4c: the row opens its bank). */
  bingo: number | null;
  /** Who wrote them, and when: "Our bot, Run now by alex · Yesterday, 8:13 PM". */
  bingoBy: string | null;
  /** The games whose results for it aren't the season's (season-decisions.ts gamesApart): Make every game match. */
  apart: GameApart[];
  history: DeskLine[];
}

interface SeasonRow {
  id: string;
  name: string;
  show_id: string;
  show_name: string;
  slug: string;
  season_number: number;
  results_by: "admin" | "leagues";
  air_tz: string | null;
}

async function seasonRow(id: string): Promise<SeasonRow> {
  if (!isUuid(id)) throw new HttpError(404, "Season not found");
  const { rows } = await pool.query<SeasonRow>(
    `SELECT ss.id, ${SEASON_NAME} AS name, ss.show_id, s.name AS show_name, s.slug, ss.season_number, ss.results_by, ss.air_tz
       FROM show_seasons ss JOIN shows s ON s.id = ss.show_id WHERE ss.id = $1`,
    [id]
  );
  if (!rows.length) throw new HttpError(404, "Season not found");
  return rows[0];
}

const episodeOf = (n: unknown): number => {
  const e = Number(n);
  if (!Number.isInteger(e) || e < 1 || e > 1000) throw new HttpError(404, "No such episode");
  return e;
};

/** How far apart two names are (edits), for "Linnea, maybe?". */
function distance(a: string, b: string): number {
  const d = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = d[0];
    d[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const t = d[j];
      d[j] = Math.min(d[j] + 1, d[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = t;
    }
  }
  return d[b.length];
}

/** The cast name a stranger's most likely is: the closest first or full name, near enough to be a misspelling. */
export function guessName(name: string, cast: string[]): string | null {
  const n = name.trim().toLowerCase();
  let best: { name: string; d: number } | null = null;
  for (const c of cast) {
    const full = c.toLowerCase();
    const d = Math.min(distance(n, full), distance(n, full.split(" ")[0]));
    if (!best || d < best.d) best = { name: c, d };
  }
  return best && best.d <= Math.max(2, Math.floor(n.length / 3)) ? best.name : null;
}

/** Each episode's results waiting and disputed, and how many answers it has: Research's Not in the games yet, the season's rows.
 *  Waiting is the page's own rule (deskEpisode's `state`): reported and not in the games, or a name nobody in the cast has. */
export async function episodeCounts(seasonId: string): Promise<Map<number, { waiting: number; unknown: number; disputed: number; answers: number; live: number }>> {
  const { rows } = await pool.query(
    `WITH names AS (SELECT lower(name) AS name FROM season_cast WHERE season_id = $1),
          f AS (SELECT d.episode_number AS n, d.status, d.fact_status, d.locked_at IS NULL AS open,
                       d.kind <> 'noexit' AND EXISTS (SELECT 1 FROM names) AND lower(COALESCE(d.applied->>'castawayName', d.castaway_name)) NOT IN (SELECT name FROM names) AS stranger
                  FROM season_decisions d WHERE d.season_id = $1 AND (d.fact_status IS NOT NULL OR d.status <> 'pending'))
     SELECT n,
            count(*) FILTER (WHERE fact_status IS NOT NULL AND open AND ((fact_status = 'reported' AND status = 'pending') OR (stranger AND fact_status IN ('reported', 'confirmed'))))::int AS waiting,
            count(*) FILTER (WHERE fact_status IS NOT NULL AND open AND stranger AND fact_status IN ('reported', 'confirmed'))::int AS unknown,
            count(*) FILTER (WHERE fact_status = 'disputed' AND open)::int AS disputed,
            count(*) FILTER (WHERE status = 'accepted')::int AS live
       FROM f GROUP BY n`,
    [seasonId]
  );
  const { rows: subs } = await pool.query(
    `SELECT er.episode_number AS n, count(*)::int AS answers FROM episode_research er JOIN show_seasons ss ON ss.show_id = er.show_id AND ss.season_number = er.season_number
      WHERE ss.id = $1 AND er.source <> 'combined' AND er.withdrawn_at IS NULL GROUP BY 1`,
    [seasonId]
  );
  const out = new Map<number, { waiting: number; unknown: number; disputed: number; answers: number; live: number }>();
  for (const r of rows) out.set(r.n, { waiting: r.waiting, unknown: r.unknown, disputed: r.disputed, answers: 0, live: r.live });
  for (const s of subs) out.set(s.n, { ...(out.get(s.n) ?? { waiting: 0, unknown: 0, disputed: 0, live: 0 }), answers: s.answers });
  return out;
}

/** Research's Not in the games yet: the aired episodes with results waiting, newest first, with what kind. */
export async function waitingEpisodes(seasonId: string): Promise<{ n: number; count: number; line: string }[]> {
  const counts = await episodeCounts(seasonId);
  return [...counts]
    .filter(([, c]) => c.waiting > 0)
    .sort((a, b) => b[0] - a[0])
    .map(([n, c]) => ({
      n,
      count: c.waiting,
      line: [c.waiting - c.unknown && `${c.waiting - c.unknown} one source wasn't sure of`, c.unknown && `${c.unknown} not in the cast`].filter(Boolean).join(" · "),
    }));
}

/** The season page's Episodes (the mock's rsEpLine): the next one, then each aired one, newest first, with how its results stand. */
export async function episodeRows(seasonId: string, now = new Date()): Promise<{ n: number; line: string }[]> {
  const [schedule, counts] = await Promise.all([seasonSchedules([seasonId], now).then((m) => m.get(seasonId)), episodeCounts(seasonId)]);
  const tz = schedule?.airTz || "America/New_York";
  const eps = (schedule?.episodes ?? []).filter((e) => e.airAt && (!schedule?.episodeCount || e.number <= schedule.episodeCount));
  const aired = eps.filter((e) => Date.parse(e.airAt!) <= now.getTime()).reverse();
  const next = eps.find((e) => Date.parse(e.airAt!) > now.getTime());
  const line = (n: number, at: Date) => {
    const c = counts.get(n);
    return `Aired ${mdIn(at, tz, now)} · ${!c || (!c.answers && !c.live) ? "no results yet" : c.waiting ? `${c.waiting} not in the games yet` : c.disputed ? `${c.disputed} disputed` : "in every game"}`;
  };
  // An episode with results but no date (a season with no schedule): still listed, by its results.
  const dated = new Set(eps.map((e) => e.number));
  const undated = [...counts.keys()].filter((n) => !dated.has(n)).sort((a, b) => b - a);
  return [
    ...(next ? [{ n: next.number, line: `${cap(whenAt(new Date(next.airAt!), tz, now))} · next` }] : []),
    ...aired.map((e) => ({ n: e.number, line: line(e.number, new Date(e.airAt!)) })),
    ...undated.map((n) => {
      const c = counts.get(n)!;
      return { n, line: c.waiting ? `${c.waiting} not in the games yet` : c.disputed ? `${c.disputed} disputed` : c.live ? "in every game" : "no results yet" };
    }),
  ];
}

const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

/** "Couch Council · " or "". */
const couchOf = (c: string | null) => (c ? `${c} · ` : "");
const secs = (s: number) => (s < 60 ? `${Math.round(s)} seconds` : `${Math.floor(s / 60)} min ${Math.round(s % 60)} s`);

interface SubRow {
  id: string;
  source: string;
  researched_at: Date;
  who: string | null;
  submitted_by: string | null;
  couch: string | null;
  slot: string | null;
  seconds: number | null;
  asked_by: string | null;
  asked_name: string | null;
}

/** An answer as the page lists it (the mock's rsATitle and rsALine). */
function answerOf(s: SubRow, me: string, tz: string, now: Date, facts: number): Omit<EpisodeAnswer, "mine" | "only" | "person"> {
  const at = whenAt(s.researched_at, tz, now);
  const who = s.submitted_by === me ? "you" : (s.who ?? "someone");
  const results = plural(facts, "result");
  if (s.source === "quick")
    return { id: s.id, kind: "quick", title: `Who went home, from ${who}`, line: `${couchOf(s.couch)}their quick check · ${at}`, detail: `${s.couch ? `${s.couch}'s` : "A"} quick check: who went home, nothing else.` };
  if (s.source === "paste")
    return {
      id: s.id,
      kind: "paste",
      title: who === "you" ? "You pasted an answer" : `${who} pasted an answer`,
      line: `${couchOf(s.couch)}${results} · ${at}`,
      detail: `${s.couch ? `From ${s.couch}: an` : "An"} AI's answer, pasted.`,
    };
  if (s.source === "hand") return { id: s.id, kind: "hand", title: `${cap(who)} filled it in`, line: `${couchOf(s.couch)}by hand · ${results} · ${at}`, detail: "Entered by hand, result by result." };
  const took = s.seconds ? ` It took ${secs(s.seconds)}.` : "";
  if (s.source === "bot")
    return { id: s.id, kind: "bot", title: `Our bot, for ${s.couch ?? "a couch"}`, line: `One tap, by ${who} · ${results} · ${at}`, detail: `One tap for ${s.couch ?? "a couch"}, asked by ${who}. ChatGPT answered.${took}` };
  if (s.source === "tiebreak") return { id: s.id, kind: "bot", title: "Our bot, a tie-break", line: `A tie-break run · ${results} · ${at}`, detail: `The tie-break run: the results asked again when a split stood for a day.${took}` };
  const now_ = s.slot === "now";
  const by = s.asked_by ? (s.asked_by === me ? "you" : s.asked_name) : null;
  return {
    id: s.id,
    kind: "bot",
    title: "Our bot",
    line: `${now_ ? `Run now${by ? `, by ${by}` : ""}` : "On its schedule"} · ${results} · ${at}`,
    detail: `${now_ ? `Run now${by ? `, by ${by}` : ""}.` : "On its schedule."} ChatGPT answered.${took}`,
  };
}

/** One episode's desk page. */
export async function deskEpisode(user: SessionUser, id: string, nIn: unknown, now = new Date()): Promise<DeskEpisode> {
  const s = await seasonRow(id);
  const n = episodeOf(nIn);
  const tz = s.air_tz || "America/New_York";
  const [schedule, format, need, seen, bot, { rows: facts }, { rows: subs }, { rows: cast }, { rows: trivia }, bingo, { rows: games }] = await Promise.all([
    seasonSchedules([id], now).then((m) => m.get(id)),
    seasonFormat(pool, id, { episode: n }),
    confirmAt(),
    seenThrough(user.id, id),
    seasonBot(id),
    pool.query(
      `SELECT d.id, d.kind, d.castaway_name, d.method, d.event_type, d.applied, d.status, d.fact_status, d.locked_at, d.locked_by,
              COALESCE(lu.username, lu.name) AS locked_name, d.created_at
         FROM season_decisions d LEFT JOIN "user" lu ON lu.id = d.locked_by
        WHERE d.season_id = $1 AND d.episode_number = $2 AND (d.fact_status IS NOT NULL OR d.status <> 'pending')
        ORDER BY (d.kind = 'elimination') DESC, d.created_at`,
      [id, n]
    ),
    pool.query<SubRow>(
      `SELECT er.id, er.source, er.researched_at, er.submitted_by, COALESCE(u.username, u.name) AS who, c.name AS couch,
              r.slot, r.seconds, q.asked_by, q.asked_name
         FROM episode_research er LEFT JOIN "user" u ON u.id = er.submitted_by LEFT JOIN couches c ON c.id = er.couch_id
         LEFT JOIN LATERAL (SELECT b.id, b.slot, b.seconds FROM bot_research_runs b WHERE b.season_id = $4 AND b.result->>'submission' = er.id::text LIMIT 1) r ON true
         LEFT JOIN LATERAL (SELECT dr.asked_by, COALESCE(au.username, au.name) AS asked_name FROM desk_runs dr JOIN "user" au ON au.id = dr.asked_by WHERE dr.run_id = r.id LIMIT 1) q ON true
        WHERE er.show_id = $1 AND er.season_number = $2 AND er.episode_number = $3 AND er.source <> 'combined' AND er.withdrawn_at IS NULL
        ORDER BY er.researched_at`,
      [s.show_id, s.season_number, n, id]
    ),
    // Who was still in for it (Correct it's choices): nobody an earlier episode put out.
    pool.query(
      `SELECT c.name, c.photo_url, EXISTS (SELECT 1 FROM season_decisions d WHERE d.season_id = c.season_id AND d.kind = 'elimination' AND d.status = 'accepted'
                AND d.episode_number < $2 AND lower(COALESCE(d.applied->>'castawayName', d.castaway_name)) = lower(c.name)) AS out
         FROM season_cast c WHERE c.season_id = $1 ORDER BY c.sort_order, c.name`,
      [id, n]
    ),
    pool.query(
      `SELECT q.id, q.question, q.answer, q.status, q.note,
              (SELECT count(*)::int FROM trivia_flags f WHERE f.question_id = q.id) AS flags,
              EXISTS (SELECT 1 FROM trivia_flags f JOIN "user" u ON u.id = f.user_id WHERE f.question_id = q.id AND u.role = 'admin') AS by_admin
         FROM trivia_questions q WHERE q.season_id = $1 AND q.made_after = $2 ORDER BY q.created_at, q.id`,
      [id, n]
    ),
    bankBrief(user, id, n, tz, now),
    // The games the season sync reaches (season-decisions.ts syncSeasonLeagues): not deleted, not archived.
    pool.query(
      `SELECT count(*)::int AS n FROM leagues l ${LEAGUE_SEASON_JOIN}
        WHERE ss.id = $1 AND l.deleted_at IS NULL AND COALESCE(l.state->'settings'->>'archivedAt', '') = ''`,
      [id]
    ),
  ]);
  const ep = schedule?.episodes.find((e) => e.number === n) ?? null;
  if (!ep && schedule?.episodeCount && n > schedule.episodeCount && !facts.length && !subs.length) throw new HttpError(404, `${s.name} has ${schedule.episodeCount} episodes`);
  const airAt = ep?.airAt ? new Date(ep.airAt) : null;
  // With no air time to go on it's taken as aired, as classic's research was: only a known time in the future refuses.
  const aired = airAt ? airAt.getTime() <= now.getTime() : true;

  const ids = facts.map((f) => f.id);
  const [{ rows: sources }, { rows: flags }, history] = await Promise.all([
    ids.length
      ? pool.query("SELECT decision_id, research_id, confidence FROM fact_sources WHERE decision_id = ANY($1::uuid[])", [ids])
      : Promise.resolve({ rows: [] as { decision_id: string; research_id: string; confidence: string }[] }),
    ids.length
      ? pool.query("SELECT decision_id, reason FROM fact_disputes WHERE decision_id = ANY($1::uuid[]) AND status = 'open' ORDER BY created_at", [ids])
      : Promise.resolve({ rows: [] as { decision_id: string; reason: string }[] }),
    episodeHistory(s, n, ids, user.id),
  ]);
  const castNames = cast.map((c) => c.name as string);
  const castLower = new Set(castNames.map((c) => c.toLowerCase()));
  const photo = new Map(cast.map((c) => [String(c.name).toLowerCase(), publicMediaSrc(c.photo_url)]));
  const subById = new Map(subs.map((x) => [x.id, x]));
  const keyOf = (x: SubRow) => x.submitted_by ?? `bot:${x.source}`;
  const events = format.data.events as { id: string; label: string; implied?: boolean }[];

  const view: EpisodeFact[] = facts.map((f) => {
    const name = f.kind === "noexit" ? "" : f.applied?.castawayName || f.castaway_name;
    const method = f.applied?.method ?? f.method;
    const eventType = f.applied?.eventType || f.event_type;
    const label = f.kind === "event" ? (events.find((e) => e.id === eventType)?.label ?? readable(eventType)) : f.kind === "noexit" ? "Nobody went home" : method || readable(f.kind);
    const said = sources.filter((x) => x.decision_id === f.id && subById.has(x.research_id));
    const by = said.map((x) => x.research_id);
    const yes = new Set(said.map((x) => keyOf(subById.get(x.research_id)!))).size;
    const unknown = f.kind !== "noexit" && castNames.length > 0 && !castLower.has(name.toLowerCase());
    const status = (f.fact_status ?? (f.status === "accepted" ? "canonical" : "removed")) as FactStatus;
    const locked = !!f.locked_at || (f.fact_status === null && f.status !== "pending");
    const state: FactState =
      status === "disputed" && !locked
        ? "disputed"
        : !locked && unknown && (status === "reported" || status === "confirmed")
          ? "wait"
          : f.status === "accepted"
            ? status === "canonical" ? "canon" : "live"
            : f.status === "rejected" || status === "removed"
              ? "gone"
              : "wait";
    const names = [...new Set(said.map((x) => subById.get(x.research_id)!).map((x) => (x.submitted_by === user.id ? "yours" : x.who ? `${x.who}'s` : x.source === "quick" ? "a quick check" : "our bot's")))];
    const sure = said.some((x) => x.confidence === "high");
    const decidedBy = locked ? (f.locked_by === user.id ? "you" : (f.locked_name ?? "an admin")) : null;
    const flag = flags.find((x) => x.decision_id === f.id);
    const guess = unknown ? guessName(name, castNames) : null;
    const why =
      state === "wait"
        ? unknown
          ? `Nobody called ${name} is in the cast.${guess ? ` ${guess}, maybe?` : ""}`
          : `${yes <= 1 ? "One source" : `${yes} sources`}${names.length ? ` (${names.join(", ")})` : ""}, ${sure ? `waiting for ${need} to agree` : yes <= 1 ? "and it wasn't sure" : "and none was sure"}`
        : state === "disputed"
          ? flag
            ? `Flagged: ${FLAG[flag.reason] ?? flag.reason}. It stays as it was until an answer checks it`
            : "The sources split. It stays as it was until it's settled"
          : state === "canon"
            ? `${decidedBy === "you" ? "You" : cap(decidedBy ?? "an admin")} decided${f.applied ? `: corrected from ${f.castaway_name}${f.kind === "event" && f.applied.eventType && f.applied.eventType !== f.event_type ? ` · ${events.find((e) => e.id === f.event_type)?.label ?? readable(f.event_type)}` : ""}` : ""}. Locked: answers can't change it`
            : state === "gone"
              ? locked
                ? `${decidedBy === "you" ? "You" : cap(decidedBy ?? "an admin")} took it out. Locked: answers can't put it back`
                : "Out of every game: more answers said it didn't happen than did"
              : yes >= 2
                ? `${yes} sources agree`
                : "1 source, sure of it";
    return {
      id: f.id,
      kind: f.kind,
      name,
      photo: name ? (photo.get(name.toLowerCase()) ?? null) : null,
      label,
      state,
      unknown,
      guess,
      why,
      sources: yes,
      by,
      decidedBy,
      corrected: f.applied ? f.castaway_name : null,
      community: said.length > 0,
    };
  });

  const counted = (x: SubRow) => sources.filter((y) => y.research_id === x.id && view.find((f) => f.id === y.decision_id)?.kind !== "noexit").length;
  const answers: EpisodeAnswer[] = subs.map((x) => {
    const mine = view.filter((f) => f.state !== "gone" && f.by.includes(x.id)).map((f) => f.id);
    const only = mine.filter((fid) => {
      const f = view.find((y) => y.id === fid)!;
      return new Set(f.by.map((b) => keyOf(subById.get(b)!))).size === 1;
    });
    return { ...answerOf(x, user.id, tz, now, counted(x)), person: x.submitted_by ? { id: x.submitted_by, name: x.who ?? "?" } : null, mine, only };
  });

  const live = view.filter((f) => f.state === "live" || f.state === "canon");
  const waiting = view.filter((f) => f.state === "wait");
  const disputed = view.filter((f) => f.state === "disputed");
  const outs = live.filter((f) => f.kind === "elimination");
  const nobody = live.find((f) => f.kind === "noexit");
  const wentHome = outs.length ? `${outs.map((f) => f.name.split(" ")[0]).join(" and ")} ${outs[0].label.toLowerCase()}` : nobody ? "Nobody went home" : null;
  const today = airAt && mdIn(airAt, tz, now) === mdIn(now, tz, now);
  const endsAt = airAt && !aired ? timeIn(new Date(airAt.getTime() + (ep?.runtimeMin ?? DEFAULT_RUNTIME_MIN) * 60_000), tz) : null;
  return {
    season: { id, name: s.name, show: { id: s.show_id, name: s.show_name } },
    n,
    aired,
    tag: !aired ? (today ? "Tonight" : "Coming up") : !subs.length ? "Waiting" : subs.some((x) => x.source !== "quick") ? "Final" : "Early",
    date: airAt ? (aired ? mdIn(airAt, tz, now) : cap(whenAt(airAt, tz, now))) : "No date yet",
    wentHome,
    meta: subs.length
      ? [`${plural(live.length, "result")} in every game`, waiting.length && `${waiting.length} not yet`, disputed.length && `${disputed.length} disputed`, `from ${plural(subs.length, "answer")}`].filter(Boolean).join(" · ")
      : "No answers yet",
    endsAt,
    finalAt: ((f) => (f ? { when: whenAt(f, tz, now), passed: f.getTime() <= now.getTime() } : null))(airAt ? finalResultsAt(airAt, tz) : null),
    seen: seen >= n,
    apart: aired ? await gamesApart(id, n) : [],
    resultsBy: s.results_by === "admin" ? "admin" : "leagues",
    confirmAt: need,
    games: games[0].n,
    facts: view,
    answers,
    choices: {
      cast: cast.filter((c) => !c.out).map((c) => ({ name: c.name, photo: publicMediaSrc(c.photo_url) })),
      methods: format.data.exitMethods,
      events: events.filter((e) => !e.implied).map((e) => ({ id: e.id, label: e.label })),
      groups: await seasonGroups(id),
    },
    trivia: trivia.map((q) => ({
      id: q.id,
      question: q.question,
      answer: q.answer,
      out: q.status === "dropped" ? `its check dropped it${q.note ? `: ${q.note}` : ""}` : q.by_admin ? "taken out by an admin" : q.flags >= 2 ? 'two "Wrong?" flags from players' : null,
      byAdmin: q.status !== "dropped" && q.by_admin,
    })),
    triviaOn: bot.on && (bot.episodes[n] ?? bot.schedule).some((r) => r.kind === "trivia" && r.on),
    bingo: bingo?.squares ?? null,
    bingoBy: bingo?.line ?? null,
    history,
  };
}

const FLAG: Record<string, string> = { "didnt-happen": "it didn't happen", "wrong-person": "wrong person", "wrong-episode": "wrong episode", other: "something else", missing: "something's missing" };

/** The episode's History: each answer as it came in, the desk's lines about it, and its facts' own desk lines. */
async function episodeHistory(s: SeasonRow, n: number, factIds: string[], meId: string): Promise<DeskLine[]> {
  const [{ rows: subs }, { rows: lines }] = await Promise.all([
    pool.query(
      `SELECT er.id, er.source, er.researched_at, er.submitted_by, COALESCE(u.username, u.name) AS who, c.name AS couch,
              (SELECT count(*)::int FROM fact_sources f WHERE f.research_id = er.id) AS facts
         FROM episode_research er LEFT JOIN "user" u ON u.id = er.submitted_by LEFT JOIN couches c ON c.id = er.couch_id
        WHERE er.show_id = $1 AND er.season_number = $2 AND er.episode_number = $3 AND er.source <> 'combined'`,
      [s.show_id, s.season_number, n]
    ),
    pool.query(
      `SELECT c.id, c.text, c.created_at, c.undo IS NOT NULL AND c.undone_at IS NULL AS undoable, c.undone_at IS NOT NULL AS undone, COALESCE(u.username, u.name) AS who
         FROM admin_changes c LEFT JOIN "user" u ON u.id = c.user_id
        WHERE (c.entity = 'season' AND c.entity_id = $1 AND c.action = 'episode' AND c.after->>'episode' = $2)
           OR (c.entity = 'fact' AND c.entity_id = ANY($3::text[]))
        ORDER BY c.created_at DESC LIMIT 60`,
      [s.id, String(n), factIds]
    ),
  ]);
  const said = (x: (typeof subs)[number]) => {
    const who = x.submitted_by === meId ? "You" : (x.who ?? (x.source === "tiebreak" ? "A tie-break run" : "Our bot"));
    const where = x.couch ? ` (${x.couch})` : "";
    if (x.source === "quick") return `Who went home, from ${who}${where}`;
    if (x.source === "paste") return `${who} pasted an answer${where}: ${plural(x.facts, "result")}`;
    if (x.source === "hand") return `${who} filled it in by hand${where}: ${plural(x.facts, "result")}`;
    if (x.source === "bot") return `Our bot, One tap for ${x.couch ?? "a couch"}: ${plural(x.facts, "result")}`;
    return `${x.source === "tiebreak" ? "A tie-break run" : "Our bot"}: ${plural(x.facts, "result")}`;
  };
  const all: DeskLine[] = [
    ...subs.map((x) => ({ id: null, text: said(x), at: x.researched_at.toISOString(), who: null, undoable: false, undone: false })),
    ...lines.map((r) => ({ id: r.id, text: r.text, at: r.created_at.toISOString(), who: r.who, undoable: r.undoable, undone: r.undone })),
  ];
  return all.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
}

const logEpisode = (user: SessionUser, seasonId: string, n: number, text: string, undo: Record<string, unknown> | null, before?: unknown) =>
  logDesk(pool, { entity: "season", entityId: seasonId, action: "episode", text, before, after: { episode: n }, undo, userId: user.id });

/** The facts an episode's page would say are waiting now (Accept all, Clear only what's waiting). */
async function waitingFacts(user: SessionUser, id: string, n: number, seen: unknown): Promise<EpisodeFact[]> {
  if (!Array.isArray(seen)) throw new HttpError(400, "Which results? Send the ones you saw");
  return (await deskEpisode(user, id, n)).facts.filter((f) => f.state === "wait" && seen.includes(f.id));
}

/** Accept all (tier 2): every waiting result with a name in the cast goes into every game, canonical and locked as decided. */
export async function acceptAll(user: SessionUser, id: string, nIn: unknown, seen: unknown): Promise<{ changeId: string; text: string; accepted: number }> {
  const n = episodeOf(nIn);
  // Only the ones its sheet showed: one that came in since waits for the next look.
  const take = (await waitingFacts(user, id, n, seen)).filter((f) => !f.unknown);
  if (!take.length) throw new HttpError(409, "Nothing is waiting with a name in the cast");
  const { rows: befores } = await pool.query<Before & { id: string }>(
    "SELECT id, status, fact_status, locked_at, locked_by, applied, decided_at, decided_by FROM season_decisions WHERE id = ANY($1::uuid[])",
    [take.map((f) => f.id)]
  );
  await pool.query(
    `UPDATE season_decisions SET status = 'accepted', fact_status = 'canonical', locked_at = now(), locked_by = $2, decided_at = clock_timestamp(), decided_by = $2
      WHERE id = ANY($1::uuid[])`,
    [take.map((f) => f.id), user.id]
  );
  await pool.query("UPDATE fact_disputes SET status = 'kept', settled_at = now() WHERE decision_id = ANY($1::uuid[]) AND status = 'open'", [take.map((f) => f.id)]);
  const text = `Episode ${n}: ${plural(take.length, "result")} accepted, by you`;
  const changeId = await logEpisode(user, id, n, text, { type: "facts", list: befores.map(({ id: fid, ...before }) => ({ id: fid, before })) });
  await syncSeasonLeagues(id, user.id);
  return { changeId, text: `Accepted ${take.length} · in every game as each player reveals Episode ${n}`, accepted: take.length };
}

/**
 * Make every game match (tier 3, no Undo: a game's own results aren't kept anywhere to put back): each game on the season
 * takes out its own results for the episode, the ones the season doesn't have, and brings in any of the season's it's
 * missing (season-decisions.ts matchSeasonGames). Each game it changed gets an "Episode N corrected" line.
 */
export async function matchGames(user: SessionUser, id: string, nIn: unknown): Promise<{ changeId: string; text: string }> {
  await seasonRow(id);
  const n = episodeOf(nIn);
  const apart = await gamesApart(id, n);
  if (!apart.length) throw new HttpError(409, `Every game has the season's results for Episode ${n} already`);
  const out = await matchSeasonGames(id, [n], user.id);
  const failed = out.filter((r) => r.error);
  const taken = apart.reduce((t, g) => t + g.own.length, 0);
  const added = apart.reduce((t, g) => t + g.missing, 0);
  const text = `Episode ${n}: every game matches the season${[taken && `${plural(taken, "result")} of games' own out`, added && `${plural(added, "missing result")} in`].filter(Boolean).map((t) => ` · ${t}`).join("")}${failed.length ? ` · ${andList(failed.map((r) => r.leagueName))} couldn't be changed` : ""}`;
  const changeId = await logEpisode(user, id, n, text, null, { apart });
  return { changeId, text };
}

/** One line of what a change moves, for its sheet: a result (its face) or a thing (an icon's name). */
export interface MoveLine {
  /** One result (names hidden, the page says these as a count). */
  result?: boolean;
  face: { name: string; photo: string | null } | null;
  /** A group's colour, drawn in place of a face (Not a <group>, docs/PLAN-desk-parity.md part 5b). */
  swatch?: string;
  icon: "check" | "plus" | "x" | "people" | "poll" | "split" | "grid" | "repeat" | "user" | null;
  label: string;
  change: string;
}

const factName = (f: EpisodeFact) => (f.kind === "noexit" ? "Nobody went home" : `${f.name} · ${f.label}`);

/** Take it back (tier 2): an answer stops counting, and what it alone held up leaves every game. `preview`: what moves, nothing written. */
export async function takeBack(user: SessionUser, id: string, nIn: unknown, researchId: unknown, preview: boolean): Promise<{ lines: MoveLine[]; out: number; stay: number } | { changeId: string; text: string }> {
  const n = episodeOf(nIn);
  const page = await deskEpisode(user, id, n);
  const a = page.answers.find((x) => x.id === researchId);
  if (!a) throw new HttpError(404, "That answer isn't on this episode any more");
  if (preview) {
    const { now, then } = await settleWhatIf(id, n, { without: a.id });
    const mine = page.facts.filter((f) => a.mine.includes(f.id));
    const out = mine.filter((f) => f.state === "live" && now.get(f.id)?.live && then.get(f.id) && !then.get(f.id)!.live);
    // Waiting or disputed on it alone: they go.
    const drop = mine.filter((f) => (f.state === "wait" || f.state === "disputed") && then.get(f.id)?.status === "removed");
    const stay = mine.length - out.length - drop.length;
    return {
      out: out.length,
      stay,
      lines: [
        ...out.map((f) => ({ result: true, face: f.kind === "noexit" ? null : { name: f.name, photo: f.photo }, icon: f.kind === "noexit" ? ("x" as const) : null, label: factName(f), change: "Out of every game" })),
        ...(drop.length ? [{ face: null, icon: "x" as const, label: plural(drop.length, "result"), change: "Gone: nothing else says so" }] : []),
        ...(stay > 0 ? [{ face: null, icon: "check" as const, label: plural(stay, "result"), change: "Stay, on one source fewer" }] : []),
        { face: null, icon: "people", label: `Its ${plural(page.games, "game")}`, change: "Scored again as each reveals it" },
      ],
    };
  }
  await withdrawResults(a.id, null, user.id);
  const text = `${a.title}: taken back, by you`;
  const changeId = await logEpisode(user, id, n, text, { type: "answer", researchId: a.id, back: true });
  return { changeId, text: "Taken back · what only it reported is out of every game" };
}

/** An answer counts again (Take it back's Undo), or stops counting (a paste's Undo); the episode settles and every league follows. */
export async function restoreAnswer(researchId: string, back: boolean, userId: string): Promise<void> {
  if (!back) {
    await withdrawResults(researchId, null, userId);
    return;
  }
  const { rows } = await pool.query(
    `SELECT er.episode_number, ss.id AS season_id FROM episode_research er JOIN show_seasons ss ON ss.show_id = er.show_id AND ss.season_number = er.season_number WHERE er.id = $1`,
    [researchId]
  );
  if (!rows.length) throw new HttpError(404, "That answer isn't here any more");
  await settleNow(rows[0].season_id, rows[0].episode_number, async (client) => {
    await client.query("UPDATE episode_research SET withdrawn_at = NULL WHERE id = $1", [researchId]);
  });
  await syncSeasonLeagues(rows[0].season_id, userId);
}

/** The question Paste an answer copies (the plain Ask an AI: the season's checklist for the episode, as JSON). */
export async function episodeQuestion(id: string, nIn: unknown): Promise<{ prompt: string | null; task: string }> {
  const s = await seasonRow(id);
  const n = episodeOf(nIn);
  try {
    const q = await buildPasteImportPrompt(pool, s.slug, s.season_number, n, { structured: true });
    return { prompt: q.prompt, task: `researching what happened in ${s.name} episode ${n}` };
  } catch (e) {
    throw new HttpError(400, e instanceof Error ? e.message : "Couldn't build the question");
  }
}

/** Reads a pasted answer the way our bot's is read (structured JSON, checked against the episode), as the facts it reports. */
async function readPaste(s: SeasonRow, n: number, answer: unknown, confirmed: boolean, dry: boolean) {
  if (typeof answer !== "string" || !answer.trim()) throw new HttpError(400, "Paste the AI's answer first.");
  const { rows: prior } = await pool.query("SELECT 1 FROM episode_research WHERE show_id = $1 AND season_number = $2 AND episode_number = $3 AND source = 'combined'", [
    s.show_id,
    s.season_number,
    n,
  ]);
  // A second answer fills in field by field rather than replacing what's stored (as our bot's runs do).
  const again = prior.length > 0;
  let run;
  try {
    run = await researchFromPaste(pool, s.slug, s.season_number, n, answer, { structured: true, merge: again, fill: again, dry, checkEpisode: !confirmed });
  } catch (e) {
    // Not refused: the sheet asks whether it really is this episode, then sends the same answer with `confirmed`.
    if (e instanceof Error && (e as Error & { code?: string }).code === "EPISODE_MISMATCH") throw new HttpError(409, e.message);
    throw new HttpError(400, e instanceof Error ? e.message : "That answer couldn't be read.");
  }
  const items = await researchItems(pool, s.id, run, run.submitted);
  const facts: SubmittedFact[] = withNobodyOut(
    items.map((i) => ({ kind: i.kind, castawayName: i.name, method: i.method, eventType: i.eventType, units: i.units, juryVotes: i.juryVotes, postMerge: i.postMerge, confidence: i.confidence, sources: i.sources })),
    run.format as { exitMethods?: string[] }
  );
  return { run, facts };
}

/**
 * Paste an answer: `preview` reads it and says what it would add (nothing written); else it's filed as a submission of the
 * desk's own (source 'paste', nobody's couch), the episode settles, and every league follows. A tier 2 change: its Undo
 * takes it back.
 */
export async function pasteAnswer(
  user: SessionUser,
  id: string,
  nIn: unknown,
  body: { answer?: unknown; preview?: unknown; confirmed?: unknown }
): Promise<{ lines: MoveLine[]; results: number; gain: number } | { changeId: string; text: string }> {
  const s = await seasonRow(id);
  const n = episodeOf(nIn);
  const page = await deskEpisode(user, id, n);
  if (!page.aired) throw new HttpError(400, `Episode ${n} hasn't aired yet`);
  const { run, facts } = await readPaste(s, n, body.answer, body.confirmed === true, body.preview === true);
  const covers = { people: run.castNames, kinds: null };
  if (body.preview === true) {
    const { now, then, added } = await settleWhatIf(id, n, { add: { key: user.id, covers, facts } });
    const byId = new Map(page.facts.map((f) => [f.id, f]));
    const agree = added.filter((a) => a.existing && now.get(a.existing)?.live && a.then.live).length;
    const gain = added.filter((a) => a.then.live && !(a.existing && now.get(a.existing)?.live));
    const split = [...then].filter(([fid, w]) => w.status === "disputed" && now.get(fid)?.status !== "disputed").length;
    const waits = added.filter((a) => !a.then.live && a.then.status !== "disputed" && a.then.status !== "removed").length;
    const named = (a: (typeof added)[number]) => {
      const f = a.existing ? byId.get(a.existing) : null;
      if (f) return { face: f.kind === "noexit" ? null : { name: f.name, photo: f.photo }, label: factName(f) };
      const label = a.fact.kind === "event" ? (page.choices.events.find((e) => e.id === a.fact.eventType)?.label ?? readable(a.fact.eventType ?? "")) : a.fact.kind === "noexit" ? "Nobody went home" : a.fact.method || readable(a.fact.kind);
      const photo = page.choices.cast.find((c) => c.name.toLowerCase() === a.fact.castawayName.toLowerCase())?.photo ?? null;
      return { face: a.fact.kind === "noexit" ? null : { name: a.fact.castawayName, photo }, label: a.fact.kind === "noexit" ? label : `${a.fact.castawayName} · ${label}` };
    };
    const reported = added.filter((a) => a.fact.kind !== "noexit").length;
    return {
      results: reported,
      gain: gain.length,
      lines: [
        { face: null, icon: "check", label: plural(reported, "result"), change: `${agree} agree with what's in` },
        ...gain.map((a) => ({ ...named(a), result: true, icon: a.fact.kind === "noexit" ? ("plus" as const) : null, change: a.existing ? "Confirmed: into every game" : "New: into every game" })),
        ...(waits ? [{ face: null, icon: "plus" as const, label: plural(waits, "result"), change: "Not in the games yet" }] : []),
        ...(split ? [{ face: null, icon: "split" as const, label: plural(split, "result"), change: "Disputed: stay as they were" }] : []),
        { face: null, icon: "people", label: `Its ${plural(page.games, "game")}`, change: gain.length ? "As each player reveals it" : "Nothing new to score" },
      ],
    };
  }
  const { pastedNotes, ...provenance } = run.provenance as unknown as Record<string, unknown>;
  const sent = await sendResults(
    { seasonId: id, episode: n, source: "paste", userId: user.id, couchId: null, covers, facts, payload: run.submitted, provenance: { ...provenance, via: "desk", pasted: typeof pastedNotes === "string" ? pastedNotes.length : null } },
    { kind: "results.full", text: (count) => `Episode ${n}'s results: ${count} from the desk`, detail: { own: true, via: "desk" } }
  );
  const reported = facts.filter((f) => f.kind !== "noexit").length;
  const text = `You pasted an answer: ${plural(reported, "result")}`;
  const changeId = await logEpisode(user, id, n, text, { type: "answer", researchId: sent.researchId, back: false });
  return { changeId, text: sent.settled.live.length ? `Added · ${plural(sent.settled.live.length, "result")} into every game` : "Added as a source" };
}

/** Trivia's Take it out (an admin's flag: nobody is asked it) or Put it back (the admins' flags go). Tier 1. */
export async function setTriviaOut(user: SessionUser, id: string, nIn: unknown, questionId: unknown, out: boolean): Promise<{ changeId: string; text: string }> {
  const n = episodeOf(nIn);
  if (typeof questionId !== "string" || !isUuid(questionId)) throw new HttpError(400, "Which question?");
  const { rows } = await pool.query("SELECT question FROM trivia_questions WHERE id = $1 AND season_id = $2 AND made_after = $3", [questionId, id, n]);
  if (!rows.length) throw new HttpError(404, "That question isn't on this episode");
  await writeTriviaOut(user.id, questionId, out);
  const q = rows[0].question.length > 60 ? `${rows[0].question.slice(0, 57)}…` : rows[0].question;
  const changeId = await logEpisode(user, id, n, `Trivia: "${q}" ${out ? "taken out" : "put back"}, by you`, { type: "trivia", id: questionId, out: !out });
  return { changeId, text: out ? "Taken out · nobody is asked it" : "Back in trivia" };
}

export async function writeTriviaOut(userId: string, questionId: string, out: boolean): Promise<void> {
  if (out) await pool.query("INSERT INTO trivia_flags (question_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", [questionId, userId]);
  else await pool.query(`DELETE FROM trivia_flags f USING "user" u WHERE u.id = f.user_id AND f.question_id = $1 AND u.role = 'admin'`, [questionId]);
}

/**
 * Clear Episode N's results. `waiting` (tier 1, Undo): the results not in the games go; what's in them stays. `everything`
 * (tier 3, classic's scope=everything): every answer and result, accepted ones too, comes out of every game first (each
 * league undoes exactly what it was given), then goes, with what was stored for the episode; couches can fill it in again.
 */
export async function clearEpisode(user: SessionUser, id: string, nIn: unknown, scope: unknown, seen?: unknown): Promise<{ changeId: string | null; text: string }> {
  const s = await seasonRow(id);
  const n = episodeOf(nIn);
  if (scope === "waiting") {
    const take = await waitingFacts(user, id, n, seen);
    if (!take.length) throw new HttpError(409, "Nothing is waiting");
    const ids = take.map((f) => f.id);
    const snap = await snapshot(ids);
    // A stranger's name can be in the games (one sure source): every league lets go of it first, while its record of what it
    // was given is still there (it goes with the row). The Undo puts the rows back as they were, and syncs again.
    const { rowCount } = await pool.query("UPDATE season_decisions SET status = 'rejected', decided_at = clock_timestamp() WHERE id = ANY($1::uuid[]) AND status = 'accepted'", [ids]);
    if (rowCount) await syncSeasonLeagues(id, user.id);
    await pool.query("DELETE FROM season_decisions WHERE id = ANY($1::uuid[])", [ids]);
    const changeId = await logEpisode(user, id, n, `Episode ${n}: ${plural(take.length, "waiting result")} cleared, by you`, { type: "cleared", snapshot: snap });
    return { changeId, text: `Cleared ${plural(take.length, "waiting result")}` };
  }
  if (scope !== "everything") throw new HttpError(400, "Clear what's waiting, or everything");
  const { rows: had } = await pool.query(
    `SELECT (SELECT count(*)::int FROM episode_research WHERE show_id = $1 AND season_number = $2 AND episode_number = $3 AND source <> 'combined' AND withdrawn_at IS NULL) AS answers,
            (SELECT count(*)::int FROM season_decisions WHERE season_id = $4 AND episode_number = $3) AS results`,
    [s.show_id, s.season_number, n, id]
  );
  if (!had[0].answers && !had[0].results) throw new HttpError(409, "Nothing to clear");
  const { rowCount } = await pool.query(
    `UPDATE season_decisions SET status = 'rejected', decided_at = clock_timestamp(), decided_by = $3, fact_status = 'removed', locked_at = now(), locked_by = $3
      WHERE season_id = $1 AND episode_number = $2 AND status = 'accepted'`,
    [id, n, user.id]
  );
  if (rowCount) await syncSeasonLeagues(id, user.id);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM season_decisions WHERE season_id = $1 AND episode_number = $2", [id, n]);
    await client.query("DELETE FROM fact_disputes WHERE season_id = $1 AND episode_number = $2", [id, n]);
    await client.query("DELETE FROM quick_waits WHERE season_id = $1 AND episode_number = $2", [id, n]);
    await client.query("DELETE FROM auto_research_attempts WHERE season_id = $1 AND episode_number = $2", [id, n]);
    // The cached wiki read too, so classic's pull (until step 8) reads it fresh rather than staging the old version again.
    await client.query(
      `UPDATE wiki_extractions SET payload = jsonb_set(payload, '{episodes}', COALESCE(
         (SELECT jsonb_agg(e) FROM jsonb_array_elements(payload->'episodes') e WHERE (e->>'number')::int <> $3), '[]'::jsonb))
        WHERE show_id = $1 AND season_number = $2 AND kind = 'episodes'`,
      [s.show_id, s.season_number, n]
    );
    await client.query("DELETE FROM episode_text_chunks WHERE show_id = $1 AND season_number = $2 AND episode_number = $3", [s.show_id, s.season_number, n]);
    await client.query("DELETE FROM episode_research WHERE show_id = $1 AND season_number = $2 AND episode_number = $3", [s.show_id, s.season_number, n]);
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
  await logEpisode(user, id, n, `Episode ${n} cleared, by you: ${plural(had[0].answers, "answer")} and ${plural(had[0].results, "result")}`, null);
  return { changeId: null, text: `Episode ${n}'s results are cleared from every game` };
}

/** The rows a waiting clear deletes, to put back on its Undo: the facts, their sources and their flags. */
async function snapshot(ids: string[]) {
  const [{ rows: decisions }, { rows: sources }, { rows: flags }] = await Promise.all([
    pool.query("SELECT to_jsonb(d) AS r FROM season_decisions d WHERE id = ANY($1::uuid[])", [ids]),
    pool.query("SELECT to_jsonb(f) AS r FROM fact_sources f WHERE decision_id = ANY($1::uuid[])", [ids]),
    pool.query("SELECT to_jsonb(x) AS r FROM fact_disputes x WHERE decision_id = ANY($1::uuid[])", [ids]),
  ]);
  return { decisions: decisions.map((r) => r.r), sources: sources.map((r) => r.r), flags: flags.map((r) => r.r) };
}

/** A waiting clear's Undo: its rows back as they were, then the episode settles again and every league follows. */
export async function restoreCleared(snap: { decisions: Record<string, unknown>[]; sources: unknown[]; flags: unknown[] }, userId: string): Promise<void> {
  const first = snap.decisions[0];
  if (!first) return;
  const seasonId = String(first.season_id);
  const episode = Number(first.episode_number);
  await settleNow(seasonId, episode, async (client) => {
    for (const r of snap.decisions) {
      const { rowCount } = await client.query("INSERT INTO season_decisions SELECT * FROM jsonb_populate_record(NULL::season_decisions, $1::jsonb) ON CONFLICT DO NOTHING", [JSON.stringify(r)]);
      if (!rowCount) throw new HttpError(409, "A result like one of these has come in since: decide it from the episode's page");
    }
    // A source whose answer has gone since (taken back and cleared) stays gone.
    for (const r of snap.sources)
      await client.query(
        "INSERT INTO fact_sources SELECT r.* FROM jsonb_populate_record(NULL::fact_sources, $1::jsonb) r WHERE EXISTS (SELECT 1 FROM episode_research e WHERE e.id = r.research_id) ON CONFLICT DO NOTHING",
        [JSON.stringify(r)]
      );
    for (const r of snap.flags) await client.query("INSERT INTO fact_disputes SELECT * FROM jsonb_populate_record(NULL::fact_disputes, $1::jsonb) ON CONFLICT DO NOTHING", [JSON.stringify(r)]);
  });
  await syncSeasonLeagues(seasonId, userId);
}
