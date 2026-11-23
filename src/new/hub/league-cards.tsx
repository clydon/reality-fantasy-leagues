"use client";

// The league's band in Your shows (docs/PLAN-sports-couch.md A2, then docs/design-round/league-art-spec.md and -first-view.md: the
// user, 2026-11-23, "Sports need to have the same static height as shows. They also need artwork."): a league you follow (alone, or
// by following a team in it: A3), or play a game in, is one band among the show bands, after every show, by the league's name (the
// user, 2026-11-22: "sports last, then sorted by league, then alphabetical on team name"). It is a show band's frame slot for slot,
// so the list reads as one kind of thing: 126 px always, the league's art (league-art.ts artInUse: yours, else the couch's, else its
// sport's first) under the
// same left-dark fade, its name and week top left, one line under them, the show band's signs top right (Best, the games mark with
// its due dot), and its season as a ruler along the foot with the couch's teams standing at now (marks by team name, yours ringed,
// as your face is on a show's ruler). Off-season there's no season to place: the line says when it's back and the marks stand at
// the foot's left.
//
// No live score, no red: live is the scores strip's job, and this band never repeats what the strip says (a game's time, score or
// due move). The line is what the couch has going: your games, else the couch's, else whose team leads the couch's by record (never
// for anyone hiding scores: a record is a result), else who follows them. A tap opens the league's page (screens/league-page.tsx).
//
// Its order reads only the clock, never a game's state, so where a band sits gives nothing away to someone hiding scores.

import { useMemo, type ReactNode } from "react";
import { useCouchTeams, useLeagueArt, useLeaguesNow, useMySportsGames, useSportsWeek, useYourTeams, type Couch, type CouchHub, type CouchTeam, type Home, type WeekGame } from "../data";
import { ordinal } from "../games";
import { TeamMark } from "../sports/parts";
import { begun, seenBefore, useHideSports, useNow, useShownScores } from "../sports/scores";
import { FRESH_MS } from "@/lib/sports/strip";
import { useNav } from "../nav";
import { paths } from "../routes";
import { ShowArt } from "../ui/show-bar";
import { GamesMark } from "./games-mark";
import type { LeagueNow } from "@/lib/sports/league-now";
import { artInUse, rulerOf, type LeagueArt, type SeasonRuler } from "@/lib/sports/league-art";
import { teamKeyOf } from "@/lib/sports/team-badge";

const HR = 3600_000;
/** A game this long after its start may still be on: the band's next game is the earliest that may be (by the clock alone). */
const ON_FOR = 3.5 * HR;
const MARKS = 4;
/** A mark's size and the gap between two (TeamMark `xs`; 6 px so two rings never touch: A2's check). */
const MARK = 26;
const GAP = 6;
/** The ruler's width at 390 (the band's 358 less its 12 px insides), for keeping the cluster and the ends' numbers apart. */
const RULER = 334;

const localDay = (at: number) => new Date(at).toLocaleDateString("en-CA");
/** "Eagles", "Eagles and Jets", "you, Riley and 2 more" (as the hub's namesOf; kept here so sections.tsx can import this file). */
const namesOf = (who: string[]) => (who.length <= 2 ? who.join(" and ") : `${who.slice(0, 2).join(", ")} and ${who.length - 2} more`);

export interface LeagueCardData {
  league: string;
  name: string;
  /** Its sports seasons a game of yours or the couch's is on (they leave the posters for the band). */
  seasons: string[];
  now: LeagueNow | null;
  /** The couch's teams in it (yours alone, solo), by team name. */
  teams: CouchTeam[];
  line: string | null;
  due: boolean;
  /** You play a game here (the games mark, as a show band's). */
  plays: boolean;
  /** Your best place in a game here, for the Best tag (as a show band's); null with no place yet. */
  best: number | null;
  /** On no couch (the solo hub): the teams are yours alone. */
  solo: boolean;
  /** Its next game's start (ms), for its place among the bands; Infinity when there's none to see. */
  at: number;
  /** The art it wears for you (league-art.ts). */
  art: LeagueArt;
  /** Its season along the foot; null off-season. */
  ruler: SeasonRuler | null;
}

/** "7-3" or "5-3-1" as a share of games won (a tie counts half), or null. */
function winShare(record: string | null | undefined): number | null {
  const m = /^(\d+)-(\d+)(?:-(\d+))?$/.exec(record ?? "");
  if (!m) return null;
  const [w, l, t] = [Number(m[1]), Number(m[2]), Number(m[3] ?? 0)];
  return w + l + t ? (w + t / 2) / (w + l + t) : null;
}

/**
 * Your leagues' bands: each league a team of yours is in, or a sports season of a game of yours is in; null until everything they
 * read has come (so they arrive at once, in their places and their art, rather than jumping as each read lands).
 */
export function useLeagueCards(home: Home, couch: Couch | null, hub: CouchHub | undefined): LeagueCardData[] | null {
  const now = useNow();
  const hide = useHideSports();
  const shownNow = useShownScores();
  // Each league's art: yours, else the couch's (its owner's, else its first member's to choose), else the league's own.
  const artQ = useLeagueArt(couch?.id ?? null);
  const couchTeamsQ = useCouchTeams(couch?.id ?? null);
  const ownTeamsQ = useYourTeams(!couch);
  const mineQ = useMySportsGames(true);
  const me = home.user;
  const teams: CouchTeam[] | undefined = useMemo(
    () => (couch ? couchTeamsQ.data?.teams : ownTeamsQ.data?.teams.map((t) => ({ ...t, followers: [{ id: me.id, name: me.name }], you: true, plays: false }))),
    [couch, couchTeamsQ.data, ownTeamsQ.data, me.id, me.name]
  );
  const seasons = mineQ.data?.seasons;
  const leagueOf = useMemo(() => new Map((seasons ?? []).map((s) => [s.seasonId, s.league])), [seasons]);
  // Your sports seasons (a game of yours is on each), by league.
  const played = home.shows.filter((s) => s.show.kind === "sport" && s.games.some((g) => !g.archived) && leagueOf.has(s.seasonId));
  // The leagues you follow (A3: following a team follows its league, and a league can be followed alone; unfollowing one takes its
  // band off though its teams stay followed), and each a game of yours is in.
  const couchLeagues = couchTeamsQ.data?.leagues;
  const followed = couch ? (couchLeagues ?? []).filter((l) => l.you).map((l) => l.league) : (ownTeamsQ.data?.leagues ?? []);
  const leagues = [...new Set([...followed, ...played.map((s) => leagueOf.get(s.seasonId)!)])].sort();
  // The same week the scores strip reads (from yesterday, its leagues), so it's one read between them.
  const stripLeagues = [...new Set([...(teams ?? []).filter((t) => t.you).map((t) => t.league), ...(mineQ.data?.games ?? []).map((g) => g.league)])];
  const also = [...new Set([...stripLeagues, ...leagues])];
  const any = leagues.length > 0;
  const firstQ = useSportsWeek(localDay(now - 24 * HR), also, any);
  const nows = useLeaguesNow(leagues);
  // A league whose teams have no game left in the first week (a bye, the week's end): the week after (the strip's own later read).
  const firstGames = useMemo(() => (firstQ.data?.days ?? []).flatMap((d) => d.games), [firstQ.data]);
  const onCard = (g: WeekGame) => g.sides.some((x) => (teams ?? []).some((t) => t.league === g.league && t.id === x.id));
  const upcoming = (g: WeekGame) => !!g.at && !(g.called && g.called !== "suspended") && Date.parse(g.at) > now - ON_FOR;
  const needLater = any && !!firstQ.data && leagues.some((l) => !firstGames.some((g) => g.league === l && onCard(g) && upcoming(g)));
  const laterQ = useSportsWeek(localDay(now + 6 * 24 * HR), also, needLater);

  // The art's read too, so a band never lands in one art and swaps to yours.
  const ready =
    artQ.isFetched &&
    (couch ? couchTeamsQ.isFetched : ownTeamsQ.isFetched) &&
    mineQ.isFetched &&
    (!any || (firstQ.isFetched && (!needLater || laterQ.isFetched) && nows.every((q) => q.isFetched)));
  if (!ready || !teams) return null;
  const games = [...firstGames, ...(laterQ.data?.days ?? []).flatMap((d) => d.games)];
  const today = localDay(now);

  return leagues.map((league, i): LeagueCardData => {
    const nowOf = nows[i]?.data ?? null;
    const mine = teams.filter((t) => t.league === league);
    // By team name (the user, 2026-11-22: alphabetical on team name; yours stay ringed).
    const ranked = [...mine].sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
    const leagueGames = games.filter((g) => g.league === league);
    const name = nowOf?.leagueName ?? leagueGames[0]?.leagueName ?? league.split("/").pop()!.toUpperCase();
    const seasonIds = new Set([...leagueOf].filter(([, l]) => l === league).map(([id]) => id));
    // Its next game: the couch's teams' or a game you play's, else the league's own; by the clock alone (see the file's head).
    const relevant = leagueGames.filter((g) => upcoming(g) && (onCard(g) || (mineQ.data?.games ?? []).some((m) => m.event === g.id)));
    const next = (relevant.length ? relevant : leagueGames.filter(upcoming)).map((g) => Date.parse(g.at!)).sort((a, b) => a - b)[0];

    // What the couch has going in it, the first that holds. Your place is the Best tag's, as on a show's band, so the line never
    // says it twice.
    let line: string | null = null;
    const yours = couch
      ? (hub?.games ?? []).filter((g) => seasonIds.has(g.seasonId) && !g.ended)
      : home.shows.filter((s) => seasonIds.has(s.seasonId)).flatMap((s) => s.games.filter((g) => !g.archived).map((g) => ({ ...g, rank: null as string | null, of: 0 })));
    const yourIds = new Set(yours.map((g) => g.leagueId));
    const due = home.moves.some((m) => yourIds.has(m.leagueId));
    const places = yours.map((g) => (g.rank ? Number(g.rank.replace(/^T/, "")) : Infinity)).filter(Number.isFinite);
    const best = places.length ? Math.min(...places) : null;
    if (yours.length === 1) {
      const g = yours[0];
      // A sport's game goes by its own name, as the hub's feed names it, not its type's; one separator (the check).
      line = g.of > 1 ? `${g.name} · ${g.of} playing` : g.name;
    } else if (yours.length > 1) line = `${yours.length} games`;
    const theirs = line ? [] : (couch?.games ?? []).filter((g) => g.seasonId && seasonIds.has(g.seasonId) && !g.archived && !g.yourRole);
    if (!line && theirs.length) line = theirs.length === 1 ? `The couch plays ${theirs[0].name}` : `The couch plays ${theirs.length} games here`;
    // A record is a result, and the latest game's result is in it: none while a game of theirs from the last 36 hours is unseen
    // (the strip's final asks before it shows: the 2026-11-15 rule), or one is on.
    const unseen = leagueGames.some((g) => onCard(g) && g.at && begun(g, now) && now - Date.parse(g.at) < FRESH_MS && !shownNow.has(g.id) && !seenBefore(g.id));
    if (!line && !hide && !unseen && mine.length) {
      // Each team's record from its latest game read (a record is a result: never for anyone hiding scores).
      const rec = new Map<string, string>();
      for (const g of [...leagueGames].sort((a, b) => (a.at ?? "").localeCompare(b.at ?? "")))
        for (const x of g.sides) if (x.record && mine.some((t) => t.id === x.id)) rec.set(x.id, x.record);
      // Only when every one of them is known: a leader among some would be wrong.
      if (mine.every((t) => winShare(rec.get(t.id)) != null)) {
        const top = Math.max(...mine.map((t) => winShare(rec.get(t.id))!));
        const leaders = ranked.filter((t) => winShare(rec.get(t.id)) === top);
        const r = rec.get(leaders[0].id)!;
        line =
          mine.length === 1
            ? `${leaders[0].short} are ${r}`
            : `${namesOf(leaders.map((t) => t.short))} lead ${couch ? "the couch's" : "your"} teams, ${r}`;
      }
    }
    if (!line && couch) {
      // Its teams' fans and the league's own (A3: a league followed with no team counts).
      const leagueFans = couchLeagues?.find((l) => l.league === league)?.followers ?? [];
      const fans = [...new Map([...ranked.flatMap((t) => t.followers), ...leagueFans].map((f) => [f.id, f.id === me.id ? "you" : f.name])).entries()];
      const names = [...fans.filter(([id]) => id === me.id), ...fans.filter(([id]) => id !== me.id)].map(([, n]) => n);
      // You alone says nothing the marks don't.
      if (names.length > 1) line = `Followed by ${namesOf(names)}`;
    }
    if (!line) line = couch ? "No games on the couch yet" : "No games yet";
    return {
      league,
      name,
      seasons: [...seasonIds],
      now: nowOf,
      teams: ranked,
      line,
      due,
      plays: yours.length > 0,
      best,
      solo: !couch,
      at: next ?? Infinity,
      art: artInUse(league, artQ.data, me).art,
      ruler: rulerOf(nowOf, today),
    };
  });
}

/** "Mar 26" of "2027-03-26". */
const backDay = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString([], { month: "short", day: "numeric" });

/**
 * One league's band (126 px, as a show's). `preview`: the league's settings page shows your band as it'll look in Your shows (the
 * art you're choosing on it), so there it's a picture of the band, not a way in.
 */
export function LeagueCard({ card, preview }: { card: LeagueCardData; preview?: boolean }) {
  const { league, name, now, teams, line, due, plays, best, solo, art, ruler } = card;
  const nav = useNav();
  const off = !!now && !now.on;
  const week = off ? null : (now?.week ?? now?.season ?? null);
  const back = off && now?.back ? backDay(now.back) : null;
  const words = off ? ["Off-season", back ? `back ${back}` : null].filter(Boolean).join(" · ") : line;
  // Yours first into the four places, then the couch's others; the four by name (the check: alphabetical first put the Lions,
  // yours, into "+1" while four of others' teams showed).
  const shown = [...teams.filter((t) => t.you), ...teams.filter((t) => !t.you)].slice(0, MARKS).sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  const more = teams.length - shown.length;

  const yoursFirst = teams.filter((t) => t.you).map((t) => t.short);
  const others = teams.filter((t) => !t.you).map((t) => t.short);
  const teamWords = teams.length ? `${solo ? "Your teams" : "The couch's teams"}: ${[...yoursFirst.map((t) => (solo ? t : `${t}, yours`)), ...others].join("; ")}.` : null;
  // The ruler in words: a week of so many, the playoffs' stage, or a season placed by its days.
  const rulerWords = !ruler
    ? null
    : /^\d+$/.test(ruler.label)
      ? `Week ${ruler.label} of ${ruler.end}.`
      : ruler.label
        ? `${ruler.label}.`
        : /^\d+$/.test(ruler.end)
          ? `The regular season's ${ruler.end} weeks are done.`
          : `The season runs ${ruler.start} to ${ruler.end}.`;
  const label = [
    `${name}${off ? ", off-season" : week ? `, ${week}` : ""}${off && back ? `, back ${back}` : ""}.`,
    teamWords,
    !off && line && `${line}.`,
    best != null && `Your best place, ${ordinal(best)}.`,
    due && "A move of yours is due.",
    rulerWords,
    preview ? null : "Opens the league.",
  ]
    .filter(Boolean)
    .join(" ");

  const marks = (
    <>
      {shown.map((t) => (
        <span
          key={t.id}
          data-league-mark={t.you ? "you" : t.short}
          // Yours ringed, as your face is on a show's ruler; lifted off the art as faces are.
          className={`rounded-[2px] shadow-[0_2px_6px_rgba(0,0,0,.5)] ${t.you ? "outline-[1.5px] outline-offset-1 outline-foreground" : ""}`}
        >
          <TeamMark abbr={t.abbreviation ?? t.short} color={t.color} size="xs" team={teamKeyOf(t.league, t.id)} />
        </span>
      ))}
      {more > 0 && <span className="type-num pl-0.5 text-[13px] font-bold text-white/75 [text-shadow:0_1px_4px_rgba(0,0,0,.8)]">+{more}</span>}
    </>
  );

  const inner = (
    <>
      <ShowArt seasonId={`league-${league}`} artUrl={art.src} name={name} position={art.position} bare className="absolute inset-0 -z-[2] size-full" />
      {/* The show band's own fade, so a league's words sit on the same dark as a show's. */}
      <span aria-hidden className="absolute inset-0 -z-[1] bg-[linear-gradient(90deg,rgba(16,14,21,.94)_0%,rgba(16,14,21,.8)_55%,rgba(16,14,21,.45)_100%)]" />
      <span className="flex items-start gap-2 px-3 pt-2.5">
        <span className="min-w-0 flex-1">
          {/* A long name ("NCAA Men's Basketball") gives way before the week does its share (A2's check: it overflowed). */}
          <span className="flex min-w-0 items-baseline gap-2">
            <b className="type-caption min-w-0 shrink truncate text-[22px] leading-none">{name}</b>
            {week && <span className="type-caption min-w-0 shrink-[4] truncate text-[15px] leading-none tracking-[0.02em] text-white/60">{week}</span>}
          </span>
          {words && (
            <span data-league-line className="mt-1 block truncate text-[13px] font-semibold text-white/75">
              {words}
            </span>
          )}
        </span>
        {best != null && (
          <span data-league-best className="type-caption flex-none bg-plate py-1 pl-2 pr-3 text-[13px] text-plate-foreground [clip-path:polygon(0_0,100%_0,calc(100%_-_7px)_100%,0_100%)]">
            Best {ordinal(best)}
          </span>
        )}
        {plays && <GamesMark due={due} className="relative -mr-1 -mt-0.5 flex-none" />}
      </span>
      {ruler ? <Ruler ruler={ruler} marks={marks} count={shown.length} more={more > 0} /> : teams.length > 0 && <span className="absolute bottom-3 left-3 flex items-end gap-1.5">{marks}</span>}
    </>
  );

  // A column from the top: a button centres what's in it, and a show's band (a link) doesn't, so the name sits where a show's does.
  const frame = "dark relative isolate flex h-[126px] w-full flex-col justify-start overflow-hidden rounded-[4px] bg-card text-left text-white";
  if (preview)
    return (
      // A span: the settings page draws it inside a choice's button.
      <span data-league-card={league} data-league-preview data-league-off={off || undefined} data-art={art.id} role="img" aria-label={label} className={frame}>
        {inner}
      </span>
    );
  return (
    <button
      type="button"
      data-league-card={league}
      data-league-off={off || undefined}
      data-due={due || undefined}
      data-art={art.id}
      // Its page (docs/PLAN-sports-couch.md B1), on This week.
      onClick={() => nav.push(paths.league(league))}
      aria-label={label}
      // The band is Night in both themes (its art's own dark), so its focus ring is the band's foreground, inside its edge: an
      // outline, which paints over the art (an inset shadow paints under it: the check found no ring at all).
      className={`nd-press ${frame} focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-foreground`}
    >
      {inner}
    </button>
  );
}

/**
 * The season along a band's foot, a show's ruler's geometry: the played part solid, the rest faint, the couch's teams standing at now
 * with now's name under them (the week's number, a day, the playoffs' stage), the ends named unless the teams stand over one.
 */
function Ruler({ ruler, marks, count, more }: { ruler: SeasonRuler; marks: ReactNode; count: number; more: boolean }) {
  const pct = ruler.at * 100;
  // The cluster's width (marks, gaps and "+N"), centred on now but kept inside the ruler. It stands above the line; the numbers sit
  // under it, so only now's number can meet an end's.
  const w = count * MARK + Math.max(0, count - 1) * GAP + (more ? 26 : 0);
  // Now's number keeps to the ruler: at an end it lines up with that end rather than hanging off it. Widths by the 12 px figures'
  // ~7 px a character, 8 px apart at least.
  const textW = (s: string) => s.length * 7;
  const x = ruler.at * RULER;
  const lw = textW(ruler.label);
  const align = x - lw / 2 < 0 ? "left" : x + lw / 2 > RULER ? "right" : "centre";
  const [l0, l1] = align === "left" ? [0, lw] : align === "right" ? [RULER - lw, RULER] : [x - lw / 2, x + lw / 2];
  const nearStart = !!ruler.label && l0 < textW(ruler.start) + 8;
  const nearEnd = !!ruler.label && l1 > RULER - textW(ruler.end) - 8;
  return (
    <span aria-hidden className="absolute inset-x-3 bottom-2 block h-[52px]" data-league-ruler={ruler.label}>
      <span className="absolute inset-x-0 bottom-[14px] h-[3px] rounded-full bg-white/20" />
      <span className="absolute left-0 bottom-[14px] h-[3px] rounded-full bg-white/80" style={{ width: `${pct}%` }} />
      {!nearStart && <small className="type-num absolute bottom-0 left-0 text-[12px] leading-none text-white/55">{ruler.start}</small>}
      {!nearEnd && <small className="type-num absolute bottom-0 right-0 text-[12px] leading-none text-white/55">{ruler.end}</small>}
      {count > 0 && (
        <span className="absolute bottom-[19px] flex items-end gap-1.5" style={{ left: `clamp(0px, calc(${pct}% - ${w / 2}px), calc(100% - ${w}px))` }}>
          {marks}
        </span>
      )}
      {ruler.label && (
        <small
          className={`type-num absolute bottom-0 whitespace-nowrap text-[12px] leading-none text-white ${align === "centre" ? "-translate-x-1/2" : ""}`}
          style={align === "right" ? { right: 0 } : align === "left" ? { left: 0 } : { left: `${pct}%` }}
        >
          {ruler.label}
        </small>
      )}
    </span>
  );
}
