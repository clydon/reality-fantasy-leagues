import { tiebreakNext, tiebreakOn, tiebreakQuestions, usualSchedule, type BotScheduleRun } from "@db/bot-research.js";
import { catchUpHeld, holdsWaiting } from "./catch-up";
import { BINGO_BANK_LACK, KINDS, when, type RunKind } from "@/lib/desk-bot-words";
import { phaseCues } from "@db/rulebooks.js";
import { pool } from "./db";
import { SEASON_NAME as seasonName, STRANDED } from "./desk";
import { lackingUsual, scheduleOf } from "./desk-bot";
import { castInboxItems } from "./desk-cast-page";
import { openReports } from "./desk-reports";
import { andList } from "./desk-seats";
import { hasSchedule, seasonSchedules, upNext } from "./schedule";
import { deskNotices } from "./show-changes";
import { signupMode, WAITING } from "./way-in";

// The desk's Inbox (docs/PLAN-new-design.md step 6b part 2; docs/PLAN-desk-parity.md step 2, the mock's desk-inbox.js).
// Needs you is one list, most urgent first, each with its kind and the page that deals with it: a dispute the couches
// couldn't settle (and a phase start to confirm, something new they split on), a couch nobody runs, a season airing with no
// schedule, one whose own schedule has no run of one of our usual's kinds (the research pattern, 2026-10-29: "Survivor 51 has
// no Bingo run", with a one-tap Add), a cast not sent to its games, accounts waiting to get in, reports, a suggested rulebook
// fix, a rulebook nobody else has checked, a show added by name. Dealing with one on its page clears it here, and from the tab's count. Staged
// results never come here (decision 7): results settle by sources, and only disputes reach the desk. Coming up is the week
// as a rundown: each airing season's next episode, when, and how its results come in (Autopilot, ESPN or the couches).
// Classic's To do (admin-home.tsx) listed results to review, casts to approve, formats in draft, reports and airing seasons
// with no schedule, and Coming up with "research N h later"; what the desk leaves behind is in the plan's As built.

export interface InboxItem {
  kind: "split" | "stale" | "phase" | "change" | "stranded" | "schedule" | "usual" | "cast" | "people" | "report" | "suggestion" | "made" | "show" | "catchup" | "sports";
  title: string;
  line: string;
  href: string;
  /** Faces beside it: the first few accounts waiting. */
  faces?: { id: string; name: string; colour: string | null }[];
  /** When it was sent (a report): the screen says how long ago, after the line. */
  at?: string;
  /** A one-tap Add beside it: our usual's runs of a kind, for the season (POST its research { addUsual: kind }). */
  add?: { seasonId: string; kind: RunKind };
}

/** One airing season's next episode this week, and how its results come in. */
export interface ComingUp {
  seasonId: string;
  season: string;
  episode: number;
  /** A sport's event name ("Mexico City Grand Prix"): its listed title gives nothing away. Else null ("Episode 6"). */
  title: string | null;
  airAt: string;
  how: "auto" | "espn" | "talk" | "couch" | "admin";
  line: string;
}

export interface Inbox {
  items: InboxItem[];
  week: { researched: number; confirmed: number; settled: number; rulings: number };
  /** This week's episodes, soonest first. */
  coming: ComingUp[];
  /** Airing seasons with no schedule (so they aren't in Coming up). */
  unscheduled: string[];
}

const WEEK_MS = 7 * 24 * 3600 * 1000;

/** "Wednesday Watchers'", "riley's". */
const poss = (n: string) => (/s$/i.test(n) ? `${n}'` : `${n}'s`);
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * What our bot couldn't settle (docs/PLAN-results-settle.md, the user's 2026-11-20: let the AI settle), one item an episode,
 * the newest question first: a split, or a flag nobody's answer has checked, on an episode whose tie-break run has had its say
 * (it looked and the answers still split), couldn't have it (its tries failed, or the question went stale), or is switched off.
 * While its look is still to come, the episode is the bot's, not the admin's. (It was one item a fact, 30 at most, highest
 * episode number first: a finished season's 202 filled every slot on 2026-11-20 and hid every other show's.)
 */
async function disputes(): Promise<InboxItem[]> {
  const on = await tiebreakOn(pool);
  const questions = await tiebreakQuestions(pool);
  // A result waiting for its second look (reported after final results, out of the games: fact-status.ts) is the desk's too once
  // that look can't come (2026-11-20: Survivor 51 Ep 1's 16, the bot's three tries timed out, and nothing said so).
  const WAITING = "(d.fact_status = 'reported' AND d.status = 'pending')";
  const { rows } = await pool.query<{ season_id: string; episode_number: number; season: string; split: number; waiting: number }>(
    `SELECT d.season_id, d.episode_number, ${seasonName} AS season,
            count(*) FILTER (WHERE NOT ${WAITING})::int AS split, count(*) FILTER (WHERE ${WAITING})::int AS waiting
       FROM season_decisions d JOIN show_seasons ss ON ss.id = d.season_id JOIN shows s ON s.id = ss.show_id
      WHERE d.locked_at IS NULL AND d.fact_status IS NOT NULL
        AND (d.fact_status = 'disputed' OR ${WAITING} OR EXISTS (SELECT 1 FROM fact_disputes x WHERE x.decision_id = d.id AND x.status = 'open'))
      GROUP BY d.season_id, d.episode_number, season`
  );
  const out: { item: InboxItem; newest: number }[] = [];
  const results = (n: number) => (n === 1 ? "a result" : `${n} results`);
  for (const r of rows) {
    const q = questions.find((x) => x.seasonId === r.season_id && x.episode === r.episode_number);
    const next = q ? tiebreakNext(q) : null;
    // The bot's turn: its look is still to come, and not gone stale (three days past due: the bot was down, say).
    if (on && next && next.next.getTime() - next.due.getTime() <= 3 * 24 * 3600 * 1000) continue;
    const looked = !!q?.tries.some((t) => t.ok === true);
    const why = !on
      ? "our bot's second look is switched off"
      : !looked
        ? "our bot couldn't look again"
        : r.split
          ? "our bot looked again and the answers still disagree"
          : "our bot looked again but didn't answer for them";
    // "Survivor 51, Episode 1: 16 results waiting for a second look" / "…: 2 results still split, 4 waiting for a second look".
    const what = r.split && r.waiting ? `${results(r.split)} still split, ${r.waiting} waiting for a second look` : r.waiting ? `${results(r.waiting)} waiting for a second look` : `${results(r.split)} still split`;
    // A split stays as it was in the games; a waiting result is out of them until someone decides.
    const outLine = !r.waiting ? "" : r.split ? `; the ${r.waiting} waiting ${r.waiting === 1 ? "is" : "are"} out of every game` : `, so ${r.waiting === 1 ? "it's" : "they're"} out of every game`;
    out.push({
      newest: q?.newest ? Date.parse(String(q.newest)) : 0,
      item: {
      kind: looked ? "split" : "stale",
      title: `${r.season}, Episode ${r.episode_number}: ${what}`,
      line: `${why.charAt(0).toUpperCase()}${why.slice(1)}${outLine} · decide on the episode's page`,
      href: `/desk/season/${r.season_id}/e/${r.episode_number}`,
      },
    });
  }
  return out
    .sort((a, b) => b.newest - a.newest)
    .slice(0, 20)
    .map((o) => o.item);
}

/** A phase that starts when the show says so (or when N are left), on an airing season, once something says it's begun. */
async function phaseStarts(): Promise<InboxItem[]> {
  const { rows: books } = await pool.query(
    `SELECT r.id, r.season_id, r.blocks, r.phase_starts, ${seasonName} AS season FROM rulebooks r JOIN show_seasons ss ON ss.id = r.season_id JOIN shows s ON s.id = ss.show_id
      WHERE r.owner_kind = 'season' AND r.status = 'in_force' AND ss.status = 'airing'`
  );
  const out: InboxItem[] = [];
  for (const b of books) {
    const open = (b.blocks?.season?.phases ?? []).filter((p: { id: string; starts?: { type: string } }) => p?.starts && p.starts.type !== "episode" && (b.phase_starts ?? {})[p.id] == null);
    if (!open.length) continue;
    const cues = await phaseCues(pool, b.season_id, b.blocks);
    for (const p of open) {
      const c = cues[p.id];
      if (!c) continue;
      const why = c.by === "left" ? `${c.left} left going into Episode ${c.episode}` : `${c.by === "research" ? "Research says" : "The results say"} it began in Episode ${c.episode}`;
      out.push({ kind: "phase", title: `${b.season}: when did ${String(p.name).toLowerCase().startsWith("the ") ? p.name : `the ${p.name}`} start?`, line: `${why} · its segments wait until it's set`, href: `/desk/rulebook/${b.id}` });
    }
  }
  return out;
}

/**
 * A couch with a game people play that nobody runs: its only Commissioner left or deleted their account. A site admin who
 * plays it runs it (classic always let them), so that game isn't stranded. It opens the couch, which hands its games on.
 */
async function strandedCouches(): Promise<InboxItem[]> {
  const { rows } = await pool.query(
    `SELECT c.id, c.name, array_agg(l.name ORDER BY l.name) AS games,
            (SELECT count(*)::int FROM leagues l2 WHERE l2.couch_id = c.id AND l2.deleted_at IS NULL) AS all_games,
            (SELECT count(*)::int FROM couch_members m WHERE m.couch_id = c.id) AS members
       FROM couches c JOIN leagues l ON l.couch_id = c.id
      WHERE l.deleted_at IS NULL AND c.deleted_at IS NULL AND ${STRANDED}
      GROUP BY c.id, c.name ORDER BY c.name LIMIT 20`
  );
  return rows.map((c) => ({
    kind: "stranded" as const,
    title: c.games.length === c.all_games ? `Nobody runs ${poss(c.name)} games` : `Nobody runs ${andList(c.games)} on ${c.name}`,
    line: `Its only Commissioner has gone · ${plural(c.members, "person", "people")} waiting on results`,
    href: `/desk/couch/${c.id}`,
  }));
}

/** How a season's results come in, for Coming up. */
function howResults(s: { bot_on: boolean; schedule: unknown; espn: boolean; kind: string | null; results_by: string }, usual: BotScheduleRun[]): Pick<ComingUp, "how" | "line"> {
  const how = howTheyCome(s, usual);
  // Setup's Who decides results (docs/PLAN-desk-parity.md part 3a): what the desk accepts reaches its games too.
  if (s.results_by !== "admin") return how;
  return how.how === "couch" ? { how: "admin", line: "You decide results · couches' answers count too" } : { how: how.how, line: `${how.line} · you decide too` };
}

function howTheyCome(s: { bot_on: boolean; schedule: unknown; espn: boolean; kind: string | null }, usual: BotScheduleRun[]): Pick<ComingUp, "how" | "line"> {
  if (s.bot_on) {
    const runs = scheduleOf(s.schedule, usual).filter((r) => r.on);
    const quick = runs.some((r) => r.kind === "quick");
    const full = runs.some((r) => r.kind === "full");
    if (quick || full) return { how: "auto", line: `Autopilot: ${quick && full ? "who went home, then full results" : quick ? "who went home after it" : "full results after it"}` };
    if (runs.some((r) => r.kind === "schedule")) return { how: "auto", line: "Autopilot: the schedule check after it" };
  }
  if (s.espn) return { how: "espn", line: "ESPN's results come in on their own" };
  if (s.kind === "talk") return { how: "talk", line: "Couches tick what happened" };
  return { how: "couch", line: "Couches fill in results · no bot" };
}

/**
 * The week, and the airing seasons with no schedule: each game season's next episode in the next seven days (a show set up
 * as a game; a watched-only show's episodes aren't the desk's), and whether its results come in on their own.
 */
async function theWeek(usual: BotScheduleRun[], now = new Date()): Promise<{ coming: ComingUp[]; unscheduled: { id: string; name: string }[] }> {
  const { rows } = await pool.query(
    `SELECT ss.id, ${seasonName} AS name, ss.status, s.kind, ss.bot_research_on AS bot_on, ss.bot_research_schedule AS schedule, ss.results_by,
            EXISTS (SELECT 1 FROM sports_links sl WHERE sl.season_id = ss.id AND sl.provider = 'espn' AND sl.linked > 0) AS espn
       FROM show_seasons ss JOIN shows s ON s.id = ss.show_id
      WHERE s.archived = false AND s.set_up_at IS NOT NULL AND ss.status IN ('airing', 'upcoming')
      ORDER BY s.name, ss.season_number`
  );
  const schedules = await seasonSchedules(rows.map((r) => r.id), now);
  const coming: ComingUp[] = [];
  const unscheduled: { id: string; name: string }[] = [];
  for (const r of rows) {
    const sch = schedules.get(r.id);
    if (!hasSchedule(sch)) {
      if (r.status === "airing") unscheduled.push({ id: r.id, name: r.name });
      continue;
    }
    const next = upNext(sch, now);
    if (!next?.airAt || Date.parse(next.airAt) > now.getTime() + WEEK_MS) continue;
    coming.push({ seasonId: r.id, season: r.name, episode: next.number, title: r.kind === "sport" ? next.title : null, airAt: next.airAt, ...howResults(r, usual) });
  }
  coming.sort((a, b) => Date.parse(a.airAt) - Date.parse(b.airAt));
  return { coming, unscheduled };
}

/** Accounts waiting to get in: one item, the first three faces, opening People › Waiting. */
async function waiting(): Promise<InboxItem[]> {
  const [{ rows }, mode] = await Promise.all([
    pool.query(
      `SELECT u.id, COALESCE(u.username, u.name) AS name, st.colour, count(*) OVER ()::int AS total
         FROM "user" u LEFT JOIN user_settings st ON st.user_id = u.id WHERE ${WAITING} ORDER BY u."createdAt" DESC LIMIT 3`
    ),
    signupMode(),
  ]);
  if (!rows.length) return [];
  const total = rows[0].total as number;
  const names = rows.map((r) => r.name as string);
  return [
    {
      kind: "people",
      title: `${plural(total, "account", "accounts")} waiting to get in`,
      // In "Invites let people in" only strangers wait; in "You let each one in", invited people wait too.
      line: `${andList(total > 3 ? [...names, `${total - 3} more`] : names)} · ${mode === "invites" ? "signed up without an invite" : "waiting for you to let them in"}`,
      href: "/desk/people?f=waiting",
      faces: rows.map((r) => ({ id: r.id, name: r.name, colour: r.colour ?? null })),
    },
  ];
}

/** Only what needs the admin: the community and its couches handle the rest. Most urgent first. */
export async function inbox(now = new Date()): Promise<Inbox> {
  const usual = await usualSchedule(pool);
  const [split, phases, notices, stranded, week, casts, people, reports, lacking] = await Promise.all([
    disputes(),
    phaseStarts(),
    deskNotices(),
    strandedCouches(),
    theWeek(usual, now),
    castInboxItems(),
    waiting(),
    openReports(20),
    lackingUsual(usual),
  ]);
  const items: InboxItem[] = [...split, ...phases];
  // Something new the couches split on, or that couldn't go in on its own (step 6c part 2).
  for (const n of notices) {
    items.push({ kind: "change", title: `${n.season}: something new in Episode ${n.episode}?`, line: `${n.line ?? "The couches split"} · "${n.note.slice(0, 80)}"`, href: n.rulebookId ? `/desk/rulebook/${n.rulebookId}` : `/desk/season/${n.seasonId}` });
  }
  items.push(...stranded);
  // An airing season nothing says the dates of: no reminders, no guide card, no research until it has one.
  for (const s of week.unscheduled) items.push({ kind: "schedule", title: `${s.name} is airing with no schedule`, line: "No reminders, no guide card, and no research until it has one", href: `/desk/season/${s.id}/setup` });
  // A season with its own schedule keeps it exactly, so a kind our usual gained never reached it: no usual run quietly missing.
  for (const l of lacking)
    items.push({
      kind: "usual",
      title: `${l.name} has no ${KINDS[l.kind].named} run: ${l.kind === "bingo" && l.bank ? BINGO_BANK_LACK : KINDS[l.kind].lack}`,
      line: `Our usual has it ${l.usual.map((u) => when(u)).join(", and again ")}`,
      href: `/desk/season/${l.id}/research`,
      add: { seasonId: l.id, kind: l.kind },
    });
  items.push(...casts, ...people);
  // A sports final kept as none because nothing could be read (docs/PLAN-sports-ready.md step 1.2: never zeroed silently), on a
  // season a game plays: it counts for nobody until it reads, and every run asks again (sports/finals.ts).
  const { rows: unread } = await pool.query(
    `SELECT DISTINCT ON (f.provider, f.league, f.event_id) f.name, f.read_error, e.season_id, ${seasonName} AS season
       FROM sports_events f JOIN season_events e ON e.provider = f.provider AND e.league = f.league AND e.event_id = f.event_id
       JOIN show_seasons ss ON ss.id = e.season_id JOIN shows s ON s.id = ss.show_id
      WHERE f.read_error IS NOT NULL AND f.lines IS NOT NULL AND f.final_at > now() - interval '30 days'
        AND EXISTS (SELECT 1 FROM leagues l WHERE l.deleted_at IS NULL AND l.state->'settings'->>'showId' = s.slug AND l.state->'settings'->>'wikiSeason' = ss.season_number::text)
      ORDER BY f.provider, f.league, f.event_id, e.season_id LIMIT 20`
  );
  for (const u of unread)
    items.push({ kind: "sports", title: `${u.season}: ${u.name ?? "a game"} has no stats`, line: `${u.read_error} · counts for nobody until it reads; tried again every few hours`, href: `/desk/season/${u.season_id}` });
  // The catch-up (chunk 6c): an episode whose answer would change scores waits for you, and a catch-up that stopped.
  for (const h of await holdsWaiting())
    items.push({ kind: "catchup", title: `${h.season}: Episode ${h.episode} would change scores`, line: `The catch-up's answer · ${h.games.length === 1 ? "1 game" : `${h.games.length} games`} · Send it or leave it out`, href: `/desk/season/${h.seasonId}/e/${h.episode}` });
  const { rows: stopped } = await pool.query(
    `SELECT c.season_id, c.step, c.message, ${seasonName} AS season FROM season_catchups c JOIN show_seasons ss ON ss.id = c.season_id JOIN shows s ON s.id = ss.show_id WHERE c.stuck_at IS NOT NULL`
  );
  // Held until a rehearsal's answers are loaded (scripts/catch-up-load.js load, or release): nothing catches up until then.
  if (await catchUpHeld()) {
    const { rows: q } = await pool.query("SELECT count(*)::int AS n FROM season_catchups WHERE done_at IS NULL AND stuck_at IS NULL");
    if (q[0].n) items.push({ kind: "catchup", title: `The catch-up is held: ${q[0].n === 1 ? "a season waits" : `${q[0].n} seasons wait`}`, line: "Load the rehearsal's answers (scripts/catch-up-load.js), or release it to ask our bot", href: "/desk" });
  }
  for (const c of stopped)
    items.push({ kind: "catchup", title: `${c.season}: the catch-up stopped`, line: `At ${c.step === "episodes" ? "its episodes" : c.step === "cast" ? "its cast" : "its rulebook"} · ${String(c.message ?? "it failed").slice(0, 100)}`, href: `/desk/season/${c.season_id}/setup` });
  for (const r of reports) items.push({ kind: "report", title: r.title, line: `From ${r.who.name} · ${r.about}`, href: `/desk/report/${r.id}`, at: r.at });
  const { rows: tips } = await pool.query(
    `SELECT g.id, g.note, g.rulebook_id, ${seasonName} AS season, COALESCE(u.username, u.name) AS who
       FROM rulebook_suggestions g JOIN show_seasons ss ON ss.id = g.season_id JOIN shows s ON s.id = ss.show_id LEFT JOIN "user" u ON u.id = g.user_id
      WHERE g.status = 'open' ORDER BY g.created_at LIMIT 20`
  );
  for (const t of tips) {
    items.push({ kind: "suggestion", title: `A fix for ${poss(t.season)} rulebook`, line: `From ${t.who ?? "someone"} · "${String(t.note).slice(0, 80)}"`, href: t.rulebook_id ? `/desk/rulebook/${t.rulebook_id}` : "/desk/find" });
  }
  // A rulebook someone made with Make it a game (step 10 part 2a) that nobody on another couch has checked: every couch plays
  // by it, so the desk looks it over (Take it over). Once another couch checks it, the couches have settled it.
  const { rows: made } = await pool.query(
    `SELECT r.id, ${seasonName} AS season, r.provenance->>'via' AS via, COALESCE(u.username, u.name) AS who
       FROM rulebooks r JOIN show_seasons ss ON ss.id = r.season_id JOIN shows s ON s.id = ss.show_id LEFT JOIN "user" u ON u.id = r.created_by
      WHERE r.owner_kind = 'season' AND r.status <> 'archived' AND r.provenance->>'from' = 'made' AND r.review_status = 'unreviewed'
      ORDER BY r.created_at LIMIT 20`
  );
  for (const m of made) {
    const how = m.via === "template" ? "Made from a template" : m.via === "paste" ? "Made with copy and paste" : "Made with ChatGPT";
    items.push({ kind: "made", title: `${poss(m.season)} rulebook needs a second look`, line: `${how}${m.who ? ` by ${m.who}` : ""} · it needs another couch's Looks right, or yours`, href: `/desk/rulebook/${m.id}` });
  }
  // A show someone added by name (step 10 part 1): not in the TV listings, so nothing's known about it but its name, and it's
  // in everyone's search. The desk looks it over (Looks fine, or archive it). Once it's a game its rulebook is what waits.
  const { rows: named } = await pool.query(
    `SELECT s.id, s.name, COALESCE(u.username, u.name) AS who,
            (SELECT count(*)::int FROM show_follows f JOIN show_seasons ss ON ss.id = f.season_id WHERE ss.show_id = s.id AND f.following) AS following
       FROM shows s LEFT JOIN "user" u ON u.id = s.created_by
      WHERE s.created_by IS NOT NULL AND s.tvmaze_id IS NULL AND s.set_up_at IS NULL AND s.reviewed_at IS NULL AND s.archived = false
      ORDER BY s.created_at LIMIT 20`
  );
  for (const n of named) {
    items.push({ kind: "show", title: `${n.name} was added by name`, line: `By ${n.who ?? "someone"} · ${n.following} following · not in the TV listings: keep it if it's a real show`, href: `/desk/show/${n.id}` });
  }

  const count = async (sql: string) => (await pool.query(sql)).rows[0].n as number;
  const [researched, confirmed, settled, rulings] = await Promise.all([
    count(`SELECT count(DISTINCT (show_id, season_number, episode_number))::int AS n FROM episode_research WHERE source <> 'combined' AND withdrawn_at IS NULL AND researched_at > now() - interval '7 days'`),
    count(`SELECT count(*)::int AS n FROM season_decisions WHERE fact_status = 'confirmed' AND decided_at > now() - interval '7 days'`),
    // Questions settled without the admin: flags an answer settled, and episodes our bot's second look settled.
    count(`SELECT (SELECT count(*) FROM fact_disputes WHERE status IN ('kept', 'upheld', 'checked') AND settled_at > now() - interval '7 days')
               + (SELECT count(*) FROM bot_research_runs WHERE kind = 'tiebreak' AND ok AND started_at > now() - interval '7 days') AS n`),
    count(`SELECT count(DISTINCT decision_id)::int AS n FROM league_rulings WHERE created_at > now() - interval '7 days'`),
  ]);
  return { items, week: { researched, confirmed, settled, rulings }, coming: week.coming, unscheduled: week.unscheduled.map((s) => s.name) };
}
