import { after } from "next/server";
import { showWords } from "@/lib/game/show-words";
import { askBot, askBotStatus } from "./ask-bot";
import { isUuid, type SessionUser } from "./auth-helpers";
import { pool, HttpError } from "./db";
import { seenThrough } from "./guard";
import { LEAGUE_SEASON_JOIN } from "./league-season";
import { latestEnded, seasonSchedules } from "./schedule";
import { fillCastPhotos } from "./show-art";

// Fill in who's playing (db/migrations/0144): a sport's people, for its Players tab (show/roster.tsx). TV listings only list a
// sport's broadcasters, so one ask (our bot after the response, as Fill in what happened asks: episode-recaps.ts; else a pasted
// answer to the same prompt) gives each team's roster, its manager and coaches, and the officials. They're written as the season's
// cast (season_cast: the team its group, what they do its role), and only to a sport nobody's made a game of that has no cast yet:
// a game's cast is Make it a game's and the desk's, and this never touches one. A roster isn't a spoiler (who's on a team is known
// before a game), so the tab shows it to anyone on the show.
//
// Stats are paused (BOT_STATS, 2026-10-27): asking our bot for a whole roster's numbers was slow and unreliable, and the plan is a
// sports-data API first, others behind it, ChatGPT last (docs/PLAN-sports-data.md). Until then nothing asks for stats; what's
// stored still shows, and the code below is what an API's numbers will reuse.
//
// Stats (db/migrations/0145): each person's numbers as snapshots. Coming in (`through` 0: the regular season, a career, whatever
// came before) always shows; this season or series through episode N shows only up to where you are, the newest snapshot at or
// before your mark (guard.ts). One question asks for both, in whatever columns the sport's box scores use (the answer chooses them;
// nothing here knows a sport), and Update stats asks again once a newer episode has ended, adding its snapshot. The first fill asks
// for them straight after the roster and its photos, while the request has time.

const ASK_STALE_MS = 6 * 60_000;
const BUDGET_MS = 280_000;
const MAX_PEOPLE = 250;

type Queryable = { query: typeof pool.query };

export interface StatItem {
  label: string;
  value: string;
}

export interface RosterGroup {
  name: string;
  /** `comingIn`: before this began; `soFar`: through the snapshot shown (RosterStats.through). Either can be missing. */
  people: { name: string; role: string | null; photoUrl: string | null; stats?: { comingIn: StatItem[] | null; soFar: StatItem[] | null } }[];
}

export interface RosterStats {
  /** What coming in covers ("2026 regular season"), when there are any. */
  comingInLabel: string | null;
  /** The snapshot shown: this season or series through this episode (null: none, or none you've seen yet). */
  through: number | null;
  /** A newer snapshot, past where you are: it opens once you've seen that episode. */
  newer: number | null;
  /** Stats can be asked for: none yet, or an episode has ended since the newest snapshot. */
  canAsk: boolean;
  asking: boolean;
  message: string | null;
}

export interface Roster {
  groups: RosterGroup[];
  /** It can be filled in here: a sport nobody's made a game of, with no one yet. */
  canFill: boolean;
  /** Our bot is asking now. */
  asking: boolean;
  /** Why the last ask didn't work, when it didn't. */
  message: string | null;
  /** Our bot answers right now (else it's copy and paste). */
  available: boolean;
  stats: RosterStats;
}

interface Season {
  show: string;
  seasonLabel: string;
  kind: string;
  ready: boolean;
  words: ReturnType<typeof showWords>;
  /** Its episodes' listing titles ("Game 1: Tampa Bay Rays at Milwaukee Brewers"): who's playing, as the listings say it. */
  titles: string[];
  people: number;
}

async function seasonOf(seasonId: string, db: Queryable = pool): Promise<Season> {
  const [{ rows }, { rows: titles }, { rows: count }] = await Promise.all([
    db.query(
      `SELECT s.name, s.kind, s.castaway_term, s.episode_term, s.set_up_at IS NOT NULL AS ready, ss.season_number, ss.name AS season_name
         FROM show_seasons ss JOIN shows s ON s.id = ss.show_id WHERE ss.id = $1`,
      [seasonId]
    ),
    db.query("SELECT title FROM season_episodes WHERE season_id = $1 AND title IS NOT NULL ORDER BY number LIMIT 12", [seasonId]),
    db.query("SELECT count(*)::int AS n FROM season_cast WHERE season_id = $1", [seasonId]),
  ]);
  const r = rows[0];
  if (!r) throw new HttpError(404, "Season not found");
  return {
    show: (r.name as string).replace(/\s*\([^)]*\)\s*$/, "").trim() || r.name,
    seasonLabel: r.season_name || (r.season_number ? `season ${r.season_number}` : "this season"),
    kind: r.kind,
    ready: !!r.ready,
    words: showWords({ castaway: r.castaway_term, episode: r.episode_term }),
    titles: titles.map((t) => t.title as string),
    people: count[0].n as number,
  };
}

const fillable = (s: Season) => s.kind === "sport" && !s.ready && s.people === 0;

/** The question: each team's roster, its staff, and the officials, as JSON. */
export function rosterPrompt(s: Season): string {
  const people = s.words.people.toLowerCase();
  return [
    `Search the web for who's taking part in ${s.show} (${s.seasonLabel}). Answer with JSON only, in this shape:`,
    `{"groups": [{"name": "the team's name", "people": [{"name": "Full Name", "role": "what they do"}]}]}`,
    `One group per team, with its ${people} on the current roster and nobody else (no coaches, staff or officials); each one's role is their position. A sport of individuals has one group named "Field" with every competitor.`,
    `Use real names as the official rosters give them, nobody twice, and leave out anyone you can't confirm.`,
    ...(s.titles.length ? [``, `The TV listings for it:`, ...s.titles.map((t) => `- ${t}`)] : []),
  ].join("\n");
}

const clip = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().replace(/\s+/g, " ").slice(0, max) : null);

/** The groups in an answer: its JSON (fenced or not), names trimmed, nobody twice, at most MAX_PEOPLE in all. */
export function readRoster(answer: string): RosterGroup[] {
  const text = answer.replace(/```(?:json)?/gi, "");
  const from = text.indexOf("{");
  const to = text.lastIndexOf("}");
  if (from < 0 || to <= from) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(text.slice(from, to + 1));
  } catch {
    return [];
  }
  const list = (parsed as { groups?: unknown })?.groups;
  if (!Array.isArray(list)) return [];
  const seen = new Set<string>();
  const out: RosterGroup[] = [];
  let n = 0;
  for (const g of list) {
    const name = clip((g as { name?: unknown })?.name, 60);
    const people = (g as { people?: unknown })?.people;
    if (!name || !Array.isArray(people)) continue;
    const group: RosterGroup = { name, people: [] };
    for (const p of people) {
      const who = clip((p as { name?: unknown })?.name, 120);
      if (!who || seen.has(who.toLowerCase()) || n >= MAX_PEOPLE) continue;
      seen.add(who.toLowerCase());
      group.people.push({ name: who, role: clip((p as { role?: unknown })?.role, 60), photoUrl: null });
      n++;
    }
    if (group.people.length) out.push(group);
  }
  return out;
}

/** Write the roster as the season's cast, only while it has none (whoever got there first wins). Answers how many. */
async function saveRoster(seasonId: string, groups: RosterGroup[]): Promise<number> {
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    await c.query("SELECT id FROM show_seasons WHERE id = $1 FOR UPDATE", [seasonId]);
    const s = await seasonOf(seasonId, c);
    if (!fillable(s)) {
      await c.query("ROLLBACK");
      return 0;
    }
    let i = 0;
    for (const g of groups) {
      for (const p of g.people) {
        await c.query(
          "INSERT INTO season_cast (season_id, name, tribe_name, role, sort_order) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (season_id, lower(name)) DO NOTHING",
          [seasonId, p.name, g.name, p.role, i++]
        );
      }
    }
    await c.query("COMMIT");
    return i;
  } catch (e) {
    await c.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    c.release();
  }
}

/** Someone who follows the season or plays it. */
async function mayFill(userId: string, seasonId: string): Promise<void> {
  if (!isUuid(seasonId)) throw new HttpError(404, "Season not found");
  const { rows } = await pool.query(
    `SELECT EXISTS (SELECT 1 FROM show_follows WHERE user_id = $1 AND season_id = $2 AND following)
         OR EXISTS (SELECT 1 FROM league_memberships m JOIN leagues l ON l.id = m.league_id ${LEAGUE_SEASON_JOIN} WHERE m.user_id = $1 AND ss.id = $2) AS ok`,
    [userId, seasonId]
  );
  if (!rows[0]?.ok) throw new HttpError(403, "Add it to your shows first");
}

/** The roster by team, in the order it was given, and whether (and how) it can be filled in. */
export async function rosterOf(user: SessionUser, seasonId: string, bot?: string): Promise<Roster> {
  if (!isUuid(seasonId)) throw new HttpError(404, "Season not found");
  const [s, { rows: cast }, { rows: fill }] = await Promise.all([
    seasonOf(seasonId),
    pool.query("SELECT name, tribe_name, role, photo_url FROM season_cast WHERE season_id = $1 ORDER BY sort_order, name", [seasonId]),
    pool.query("SELECT asking_at, message FROM cast_fills WHERE season_id = $1", [seasonId]),
  ]);
  const groups: RosterGroup[] = [];
  for (const r of cast) {
    const name = (r.tribe_name as string | null) ?? s.words.people;
    let g = groups.find((x) => x.name === name);
    if (!g) groups.push((g = { name, people: [] }));
    g.people.push({ name: r.name, role: r.role ?? null, photoUrl: r.photo_url ?? null });
  }
  const canFill = fillable(s);
  // Still asking once the roster's saved: its photos (and then its stats) follow in the same ask.
  const asking = !!fill[0]?.asking_at && Date.now() - new Date(fill[0].asking_at).getTime() < ASK_STALE_MS;
  const stats = await statsFor(user.id, seasonId, s, groups);
  const available = canFill || stats.canAsk ? (await askBotStatus({ bot })).available : false;
  return { groups, canFill, asking, message: asking ? null : (fill[0]?.message ?? null), available, stats };
}

async function fillableFor(user: SessionUser, seasonId: string): Promise<Season> {
  await mayFill(user.id, seasonId);
  const s = await seasonOf(seasonId);
  if (s.kind !== "sport") throw new HttpError(409, "Only a sport's players are filled in here; Make it a game finds a show's cast");
  if (s.ready) throw new HttpError(409, "It's a game: its cast is set up with it");
  if (s.people) throw new HttpError(409, `Its ${s.words.people.toLowerCase()} are in already`);
  return s;
}

/** The prompt to copy, for copy and paste. */
export async function rosterPromptFor(user: SessionUser, seasonId: string): Promise<{ prompt: string }> {
  return { prompt: rosterPrompt(await fillableFor(user, seasonId)) };
}

/** Ask our bot, after this answers (one ask a season at a time: one already going is joined). */
export async function askRoster(user: SessionUser, seasonId: string, bot?: string): Promise<Roster> {
  await fillableFor(user, seasonId);
  if (!(await askBotStatus({ bot })).available) throw new HttpError(503, "Our bot isn't answering right now. Copy and paste works.");
  const { rowCount } = await pool.query(
    `INSERT INTO cast_fills (season_id, asking_at, asked_by, message) VALUES ($1, now(), $2, NULL)
     ON CONFLICT (season_id) DO UPDATE SET asking_at = now(), asked_by = $2, message = NULL, updated_at = now()
      WHERE cast_fills.asking_at IS NULL OR cast_fills.asking_at < now() - make_interval(secs => $3)`,
    [seasonId, user.id, ASK_STALE_MS / 1000]
  );
  if (rowCount) after(() => runAsk(seasonId, bot));
  return rosterOf(user, seasonId, bot);
}

async function runAsk(seasonId: string, bot?: string): Promise<void> {
  const t0 = Date.now();
  const done = (message: string | null, filled: number | null) =>
    pool.query("UPDATE cast_fills SET asking_at = NULL, message = $2, filled = $3, updated_at = now() WHERE season_id = $1", [seasonId, message, filled]);
  try {
    const { answer } = await askBot(rosterPrompt(await seasonOf(seasonId)), { bot, budgetMs: BUDGET_MS });
    const groups = readRoster(answer);
    if (!groups.length) throw new Error("ChatGPT didn't find who's playing. Try again, or paste an answer.");
    const filled = await saveRoster(seasonId, groups);
    // Their photos from Wikipedia before the ask counts as done, so the roster arrives with them (show-art.ts, by team).
    if (filled) await fillCastPhotos(seasonId, undefined, { roster: true }).catch((e) => console.error("[rosters] photos", seasonId, e));
    // Their stats next, while this request has time (else Players offers Fill in stats). Taken before this ask lets go, so the
    // page, polling while either asks, never sees a moment with neither.
    const left = BUDGET_MS - (Date.now() - t0);
    const stats = BOT_STATS && !!filled && left > STATS_NEEDS_MS && (await lockStats(seasonId, null));
    await done(null, filled);
    if (stats) await runStats(seasonId, bot, left - 10_000);
  } catch (e) {
    await done((e instanceof Error ? e.message : "ChatGPT didn't answer").slice(0, 300), null).catch((err) => console.error("[rosters] couldn't record", seasonId, err));
  }
}

/** Copy and paste: the answer to the prompt, read and saved now. */
export async function pasteRoster(user: SessionUser, seasonId: string, answer: unknown): Promise<Roster & { filled: number }> {
  await fillableFor(user, seasonId);
  const text = typeof answer === "string" ? answer.trim() : "";
  if (!text) throw new HttpError(400, "Paste the AI's whole answer");
  if (text.length > 200_000) throw new HttpError(400, "That's too long to be the answer");
  const groups = readRoster(text);
  if (!groups.length) throw new HttpError(400, "That answer has no one in it. Paste the AI's whole answer, JSON and all.");
  const filled = await saveRoster(seasonId, groups);
  // Their photos from Wikipedia, after this answers (they show the next time the tab reads the roster).
  if (filled) after(() => fillCastPhotos(seasonId, undefined, { roster: true }).then(() => undefined, (e) => console.error("[rosters] photos", seasonId, e)));
  return { ...(await rosterOf(user, seasonId)), filled };
}

// ---------- stats (0145) ----------

/** Our bot asking for stats: off until sports-data APIs lead (see the header). */
const BOT_STATS = false;

/** How long a stats ask needs, at least, to be worth starting after the roster in the same request. */
const STATS_NEEDS_MS = 120_000;

/** Whether a sport's stats can be asked for: a sport nobody's made a game of, with its roster in. */
const statsAskable = (s: Season) => BOT_STATS && s.kind === "sport" && !s.ready && s.people > 0;

export type StatsPart = "comingIn" | "soFar";

/**
 * The question: each person's numbers coming in, and through the latest episode that's ended, as JSON. `parts` asks for one of the
 * two alone: our bot asks them one at a time (both for a whole roster at once is more than one answer holds); copy and paste asks
 * for both.
 */
export function statsPrompt(
  s: Season,
  people: { name: string; group: string | null; role: string | null }[],
  ended: { number: number; title: string | null } | null,
  parts: StatsPart[] = ["comingIn", "soFar"]
): string {
  const ep = s.words.episode;
  const soFar = !!ended && parts.includes("soFar");
  const comingIn = parts.includes("comingIn");
  const shape = [
    comingIn ? `"comingIn": {"label": "what these cover, like '2026 regular season'", "people": [{"name": "Full Name", "stats": [{"label": "AVG", "value": ".312"}]}]}` : null,
    soFar ? `"soFar": {"through": ${ended!.number}, "people": [{"name": "Full Name", "stats": [{"label": "AVG", "value": ".312"}]}]}` : null,
  ].filter(Boolean);
  return [
    `Search the web for the stats of these people in ${s.show} (${s.seasonLabel}). Answer with JSON only, in this shape:`,
    `{${shape.join(",\n ")}}`,
    comingIn ? `"comingIn" is each one's numbers from before this began: the regular season, a career, qualifying, whatever this sport counts.` : null,
    soFar
      ? `"soFar" is their numbers in it so far, through ${ep} ${ended!.number}${ended!.title ? ` ("${ended!.title}")` : ""}, the latest one played; "through" is ${ended!.number}.`
      : comingIn && !ended
        ? `Nothing has been played yet, so there's no "soFar".`
        : null,
    `Use the columns this sport's box scores and stat sheets use, at most 5 for each person, and the same columns for everyone in the same role (every hitter's alike, every pitcher's alike). Write values the way stat sheets do (".312", "3.45", "12"). Leave out coaches and officials, and anyone you can't find numbers for. Use each name exactly as it's written below.`,
    ``,
    `The people:`,
    ...people.map((p) => `- ${p.name}${p.group || p.role ? ` (${[p.group, p.role].filter(Boolean).join(", ")})` : ""}`),
  ]
    .filter((l) => l !== null)
    .join("\n");
}

const clipItems = (v: unknown): StatItem[] | null => {
  if (!Array.isArray(v)) return null;
  const out: StatItem[] = [];
  for (const i of v) {
    const label = clip((i as { label?: unknown })?.label, 14);
    const raw = (i as { value?: unknown })?.value;
    const value = typeof raw === "number" ? String(raw) : clip(raw, 14);
    if (label && value && out.length < 6) out.push({ label, value });
  }
  return out.length ? out : null;
};

export interface StatsRead {
  comingIn: { label: string | null; people: Map<string, StatItem[]> };
  soFar: { through: number; people: Map<string, StatItem[]> } | null;
}

/** The snapshots in an answer, by its shape alone: coming in (with its label) and so far (through an episode no later than the one
 *  asked about), each person matched to a roster name. */
export function readStats(answer: string, names: string[], ended: number): StatsRead {
  const empty: StatsRead = { comingIn: { label: null, people: new Map() }, soFar: null };
  const text = answer.replace(/```(?:json)?/gi, "");
  const from = text.indexOf("{");
  const to = text.lastIndexOf("}");
  if (from < 0 || to <= from) return empty;
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(text.slice(from, to + 1));
  } catch {
    return empty;
  }
  const byName = new Map(names.map((n) => [n.toLowerCase(), n]));
  const peopleOf = (block: unknown) => {
    const out = new Map<string, StatItem[]>();
    const list = (block as { people?: unknown })?.people;
    if (!Array.isArray(list)) return out;
    for (const p of list) {
      const name = byName.get(String((p as { name?: unknown })?.name ?? "").trim().toLowerCase());
      const items = clipItems((p as { stats?: unknown })?.stats);
      if (name && items) out.set(name, items);
    }
    return out;
  };
  const so = parsed.soFar as { through?: unknown } | undefined;
  const through = Number(so?.through);
  return {
    comingIn: { label: clip((parsed.comingIn as { label?: unknown })?.label, 80), people: peopleOf(parsed.comingIn) },
    soFar: ended > 0 && so ? { through: Number.isInteger(through) && through >= 1 && through <= ended ? through : ended, people: peopleOf(so) } : null,
  };
}

/** Who was asked about in one question, for one snapshot: anyone the answer left out is kept as asked with nothing (items [], how
 *  many times in `label`), and asked once more, in a smaller question of just the misses (a long answer drops people); a second
 *  miss is final for that snapshot (a coach, an official, a player who hasn't played). */
interface Asked {
  through: number;
  names: string[];
}

/** Write the snapshots (a snapshot asked again is replaced), and `asked`'s people the answer had nothing for. Answers how many
 *  people got numbers. */
async function saveStats(seasonId: string, read: StatsRead, asked?: Asked): Promise<number> {
  const rows: { name: string; through: number; label: string | null; items: StatItem[] }[] = [
    ...[...read.comingIn.people].map(([name, items]) => ({ name, through: 0, label: read.comingIn.label, items })),
    ...(read.soFar ? [...read.soFar.people].map(([name, items]) => ({ name, through: read.soFar!.through, label: null, items })) : []),
  ];
  for (const r of rows) {
    await pool.query(
      `INSERT INTO cast_stats (season_id, name, through, label, items) VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (season_id, lower(name), through) DO UPDATE SET label = EXCLUDED.label, items = EXCLUDED.items, updated_at = now()`,
      [seasonId, r.name, r.through, r.label, JSON.stringify(r.items)]
    );
  }
  const found = new Set(rows.filter((r) => asked && r.through === asked.through).map((r) => r.name.toLowerCase()));
  for (const name of asked?.names ?? []) {
    if (found.has(name.toLowerCase())) continue;
    await pool.query(
      `INSERT INTO cast_stats (season_id, name, through, label, items) VALUES ($1, $2, $3, '1', '[]')
       ON CONFLICT (season_id, lower(name), through) DO UPDATE SET label = (COALESCE(NULLIF(cast_stats.label, ''), '0')::int + 1)::text, updated_at = now()
        WHERE cast_stats.items = '[]'::jsonb AND cast_stats.label ~ '^[0-9]+$'`,
      [seasonId, name, asked!.through]
    );
  }
  return new Set(rows.map((r) => r.name)).size;
}

/** A cast_stats row as pendingStats reads it: its misses when it's "asked, nothing", else null. */
const missesOf = (r: { name: unknown; through: unknown; label: unknown; items: unknown }) => ({
  name: r.name as string,
  through: r.through as number,
  misses: Array.isArray(r.items) && !r.items.length ? Number(r.label) || 1 : null,
});

/** How many people one question asks about: a whole roster's numbers are more than one answer holds. */
const STATS_BATCH = 25;

/** A miss is final the second time (saveStats). */
const MISSES = 2;

/**
 * Who's still to be asked about: for the latest episode that's ended (so far) and for coming in, everyone with no numbers yet who
 * hasn't been missed twice. `misses`: how many times an answer left them out (null: they have numbers).
 */
export function pendingStats(
  names: string[],
  rows: { name: string; through: number; misses?: number | null }[],
  ended: number | null
): { part: StatsPart; through: number; names: string[] }[] {
  const has = new Set(rows.filter((r) => r.misses == null || r.misses >= MISSES).map((r) => `${r.name.toLowerCase()}/${r.through}`));
  const out: { part: StatsPart; through: number; names: string[] }[] = [];
  if (ended) {
    const n = names.filter((x) => !has.has(`${x.toLowerCase()}/${ended}`));
    if (n.length) out.push({ part: "soFar", through: ended, names: n });
  }
  const c = names.filter((x) => !has.has(`${x.toLowerCase()}/0`));
  if (c.length) out.push({ part: "comingIn", through: 0, names: c });
  return out;
}

/** The latest episode that's ended, with its listing title. */
async function endedOf(seasonId: string): Promise<{ number: number; title: string | null } | null> {
  const schedule = (await seasonSchedules([seasonId])).get(seasonId);
  const n = latestEnded(schedule);
  return n ? { number: n, title: schedule?.episodes.find((e) => e.number === n)?.title ?? null } : null;
}

/** Each person's stats as you may see them (coming in; so far only up to your mark), onto the roster's groups, and the tab's line. */
async function statsFor(userId: string, seasonId: string, s: Season, groups: RosterGroup[]): Promise<RosterStats> {
  const [{ rows }, { rows: fill }, mark, ended] = await Promise.all([
    pool.query("SELECT name, through, label, items FROM cast_stats WHERE season_id = $1", [seasonId]),
    pool.query("SELECT asking_at, message FROM stat_fills WHERE season_id = $1", [seasonId]),
    seenThrough(userId, seasonId),
    endedOf(seasonId),
  ]);
  const filledRows = rows.filter((r) => Array.isArray(r.items) && r.items.length);
  const snapshots = [...new Set(filledRows.map((r) => r.through as number).filter((t) => t > 0))].sort((a, b) => a - b);
  const through = snapshots.filter((t) => t <= mark).pop() ?? null;
  const newest = snapshots.at(-1) ?? null;
  const at = (name: string, t: number | null) =>
    t == null ? null : ((filledRows.find((r) => r.through === t && (r.name as string).toLowerCase() === name.toLowerCase())?.items as StatItem[] | undefined) ?? null);
  for (const g of groups) {
    for (const p of g.people) {
      const comingIn = at(p.name, 0);
      const soFar = at(p.name, through);
      if (comingIn || soFar) p.stats = { comingIn, soFar };
    }
  }
  const asking = !!fill[0]?.asking_at && Date.now() - new Date(fill[0].asking_at).getTime() < ASK_STALE_MS;
  const pending = pendingStats(groups.flatMap((g) => g.people.map((p) => p.name)), rows.map(missesOf), ended?.number ?? null);
  return {
    comingInLabel: (filledRows.find((r) => r.through === 0 && r.label)?.label as string | undefined) ?? null,
    through,
    newer: newest != null && newest > (through ?? 0) ? newest : null,
    canAsk: statsAskable(s) && !asking && pending.length > 0,
    asking,
    message: asking ? null : (fill[0]?.message ?? null),
  };
}

/** Take the season's stats ask (one at a time); false when one's already going. */
async function lockStats(seasonId: string, userId: string | null): Promise<boolean> {
  const { rowCount } = await pool.query(
    `INSERT INTO stat_fills (season_id, asking_at, asked_by, message) VALUES ($1, now(), $2, NULL)
     ON CONFLICT (season_id) DO UPDATE SET asking_at = now(), asked_by = $2, message = NULL, updated_at = now()
      WHERE stat_fills.asking_at IS NULL OR stat_fills.asking_at < now() - make_interval(secs => $3)`,
    [seasonId, userId, ASK_STALE_MS / 1000]
  );
  return (rowCount ?? 0) > 0;
}

async function statsQuestion(seasonId: string) {
  const [s, { rows }, ended] = await Promise.all([
    seasonOf(seasonId),
    pool.query("SELECT name, tribe_name, role FROM season_cast WHERE season_id = $1 ORDER BY sort_order", [seasonId]),
    endedOf(seasonId),
  ]);
  const people = rows.map((r) => ({ name: r.name as string, group: (r.tribe_name as string | null) ?? null, role: (r.role as string | null) ?? null }));
  return { s, people, ended, prompt: statsPrompt(s, people, ended) };
}

async function runStats(seasonId: string, bot: string | undefined, budgetMs: number): Promise<void> {
  const t0 = Date.now();
  const done = (message: string | null, through: number | null) =>
    pool.query("UPDATE stat_fills SET asking_at = NULL, message = $2, through = $3, updated_at = now() WHERE season_id = $1", [seasonId, message, through]);
  try {
    const q = await statsQuestion(seasonId);
    const names = q.people.map((p) => p.name);
    const ended = q.ended?.number ?? null;
    // Who's still to be asked about, a batch at a time: so far first (what's newest), then coming in (it never changes). What's
    // left when time runs out is Update stats' to finish.
    let saved = 0;
    let asked = 0;
    for (;;) {
      const left = budgetMs - (Date.now() - t0);
      if (left < 45_000) break;
      const { rows } = await pool.query("SELECT name, through, label, items FROM cast_stats WHERE season_id = $1", [seasonId]);
      const next = pendingStats(names, rows.map(missesOf), ended)[0];
      if (!next) break;
      const batch = next.names.slice(0, STATS_BATCH);
      const people = q.people.filter((p) => batch.includes(p.name));
      const { answer } = await askBot(statsPrompt(q.s, people, q.ended, [next.part]), { bot, budgetMs: left - 5_000 });
      const read = readStats(answer, batch, ended ?? 0);
      asked++;
      const one: StatsRead =
        next.part === "soFar"
          ? { comingIn: { label: null, people: new Map() }, soFar: read.soFar ? { through: next.through, people: read.soFar.people } : null }
          : { ...read, soFar: null };
      saved += await saveStats(seasonId, one, { through: next.through, names: batch });
    }
    if (asked && !saved) throw new Error("ChatGPT didn't find any stats. Try again, or paste an answer.");
    await done(null, ended ?? 0);
  } catch (e) {
    await done((e instanceof Error ? e.message : "ChatGPT didn't answer").slice(0, 300), null).catch((err) => console.error("[rosters] couldn't record stats", seasonId, err));
  }
}

async function statsAskableFor(user: SessionUser, seasonId: string): Promise<void> {
  await mayFill(user.id, seasonId);
  const s = await seasonOf(seasonId);
  if (!BOT_STATS) throw new HttpError(409, "Stats are on their way from sports data sources");
  if (!statsAskable(s)) throw new HttpError(409, s.people ? "Its stats come with the game" : `Fill in its ${s.words.people.toLowerCase()} first`);
}

/** The stats prompt to copy, for copy and paste. */
export async function statsPromptFor(user: SessionUser, seasonId: string): Promise<{ prompt: string }> {
  await statsAskableFor(user, seasonId);
  return { prompt: (await statsQuestion(seasonId)).prompt };
}

/** Ask our bot for the stats, after this answers (coming in, and through the latest episode that's ended). */
export async function askStats(user: SessionUser, seasonId: string, bot?: string): Promise<Roster> {
  await statsAskableFor(user, seasonId);
  if (!(await askBotStatus({ bot })).available) throw new HttpError(503, "Our bot isn't answering right now. Copy and paste works.");
  if (await lockStats(seasonId, user.id)) after(() => runStats(seasonId, bot, BUDGET_MS));
  return rosterOf(user, seasonId, bot);
}

/** Copy and paste: the stats answer, read and saved now. */
export async function pasteStats(user: SessionUser, seasonId: string, answer: unknown): Promise<Roster & { filled: number }> {
  await statsAskableFor(user, seasonId);
  const text = typeof answer === "string" ? answer.trim() : "";
  if (!text) throw new HttpError(400, "Paste the AI's whole answer");
  if (text.length > 200_000) throw new HttpError(400, "That's too long to be the answer");
  const q = await statsQuestion(seasonId);
  const filled = await saveStats(seasonId, readStats(text, q.people.map((p) => p.name), q.ended?.number ?? 0));
  if (!filled) throw new HttpError(400, "That answer has no stats for anyone here. Paste the AI's whole answer, JSON and all.");
  return { ...(await rosterOf(user, seasonId)), filled };
}
