import { after } from "next/server";
import { showWords } from "@/lib/game/show-words";
import { askBot, askBotStatus } from "./ask-bot";
import { isUuid, type SessionUser } from "./auth-helpers";
import { pool, HttpError } from "./db";
import { LEAGUE_SEASON_JOIN } from "./league-season";

// Fill in who's playing (db/migrations/0144): a sport's people, for its Players tab (show/roster.tsx). TV listings only list a
// sport's broadcasters, so one ask (our bot after the response, as Fill in what happened asks: episode-recaps.ts; else a pasted
// answer to the same prompt) gives each team's roster, its manager and coaches, and the officials. They're written as the season's
// cast (season_cast: the team its group, what they do its role), and only to a sport nobody's made a game of that has no cast yet:
// a game's cast is Make it a game's and the desk's, and this never touches one. A roster isn't a spoiler (who's on a team is known
// before a game), so the tab shows it to anyone on the show.

const ASK_STALE_MS = 6 * 60_000;
const BUDGET_MS = 280_000;
const MAX_PEOPLE = 250;

type Queryable = { query: typeof pool.query };

export interface RosterGroup {
  name: string;
  people: { name: string; role: string | null; photoUrl: string | null }[];
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
    `One group per team, with its ${people} on the current roster (each one's role is their position), then its manager or head coach and its coaches (role "Manager", "Pitching coach" and so on). If the event has officials (umpires, referees), add a group named "Officials" with each one's role. A sport of individuals has one group named "Field" with every competitor.`,
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
  const asking = canFill && !!fill[0]?.asking_at && Date.now() - new Date(fill[0].asking_at).getTime() < ASK_STALE_MS;
  const available = canFill ? (await askBotStatus({ bot })).available : false;
  return { groups, canFill, asking, message: asking ? null : (fill[0]?.message ?? null), available };
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
  const done = (message: string | null, filled: number | null) =>
    pool.query("UPDATE cast_fills SET asking_at = NULL, message = $2, filled = $3, updated_at = now() WHERE season_id = $1", [seasonId, message, filled]);
  try {
    const { answer } = await askBot(rosterPrompt(await seasonOf(seasonId)), { bot, budgetMs: BUDGET_MS });
    const groups = readRoster(answer);
    if (!groups.length) throw new Error("ChatGPT didn't find who's playing. Try again, or paste an answer.");
    await done(null, await saveRoster(seasonId, groups));
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
  return { ...(await rosterOf(user, seasonId)), filled };
}
