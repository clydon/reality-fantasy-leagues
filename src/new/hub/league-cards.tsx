"use client";

// The league card in Your shows (docs/PLAN-sports-couch.md A2; the shape: docs/design-round/hub-scorebug-shape.md, "The league
// card in Your shows"): a league you follow (alone, or by following a team in it: A3), or play a game in, is one 72 px card among the show bands, sorted by
// its next game the way a show sorts by its next episode. No art, no live score, no red: live is the scores strip's job, and this
// card never repeats what the strip says (a game's time, score or due move). It says the league, its week, the couch's teams as
// marks (yours first, ringed as your face is on a band) and one muted line of what the couch has going in it: your games and your
// place, else the couch's games, else whose team leads the couch's by record (never for anyone hiding scores: a record is a
// result), else who follows them. Off-season it's one quiet line. A tap opens the league's sheet (sports/sheets.tsx; its page is
// B1's).
//
// Its order reads only the clock, never a game's state, so where a card sits gives nothing away to someone hiding scores.

import { useMemo } from "react";
import { useCouchTeams, useLeaguesNow, useMySportsGames, useSportsWeek, useYourTeams, type Couch, type CouchHub, type CouchTeam, type Home, type WeekGame } from "../data";
import { ordinal } from "../games";
import { TeamMark } from "../sports/parts";
import { begun, seenBefore, useHideSports, useNow, useShownScores } from "../sports/scores";
import { FRESH_MS } from "@/lib/sports/strip";
import { openSports } from "../sports/sheets";
import type { LeagueNow } from "@/lib/sports/league-now";

const HR = 3600_000;
/** A game this long after its start may still be on: the card's next game is the earliest that may be (by the clock alone). */
const ON_FOR = 3.5 * HR;
const MARKS = 4;

const localDay = (at: number) => new Date(at).toLocaleDateString("en-CA");
/** "Eagles", "Eagles and Jets", "you, Riley and 2 more" (as the hub's namesOf; kept here so sections.tsx can import this file). */
const namesOf = (who: string[]) => (who.length <= 2 ? who.join(" and ") : `${who.slice(0, 2).join(", ")} and ${who.length - 2} more`);

export interface LeagueCardData {
  league: string;
  name: string;
  /** Its sports seasons a game of yours or the couch's is on (they leave the posters for the card). */
  seasons: string[];
  now: LeagueNow | null;
  /** The couch's teams in it (yours alone, solo), yours first. */
  teams: CouchTeam[];
  line: string | null;
  due: boolean;
  /** On no couch (the solo hub): the teams are yours alone. */
  solo: boolean;
  /** Its next game's start (ms), for its place among the bands; Infinity when there's none to see. */
  at: number;
}

/** "7-3" or "5-3-1" as a share of games won (a tie counts half), or null. */
function winShare(record: string | null | undefined): number | null {
  const m = /^(\d+)-(\d+)(?:-(\d+))?$/.exec(record ?? "");
  if (!m) return null;
  const [w, l, t] = [Number(m[1]), Number(m[2]), Number(m[3] ?? 0)];
  return w + l + t ? (w + t / 2) / (w + l + t) : null;
}

/** A place as a sentence says it: "2nd", "tied 2nd". */
const placeWords = (rank: string) => (rank.startsWith("T") ? `tied ${ordinal(Number(rank.slice(1)))}` : ordinal(Number(rank)));

/**
 * Your leagues' cards: each league a team of yours is in, or a sports season of a game of yours is in; null until everything they
 * read has come (so they arrive at once, in their places, rather than jumping as each read lands).
 */
export function useLeagueCards(home: Home, couch: Couch | null, hub: CouchHub | undefined): LeagueCardData[] | null {
  const now = useNow();
  const hide = useHideSports();
  const shownNow = useShownScores();
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
  // card off though its teams stay followed), and each a game of yours is in.
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

  const ready = (couch ? couchTeamsQ.isFetched : ownTeamsQ.isFetched) && mineQ.isFetched && (!any || (firstQ.isFetched && (!needLater || laterQ.isFetched) && nows.every((q) => q.isFetched)));
  if (!ready || !teams) return null;
  const games = [...firstGames, ...(laterQ.data?.days ?? []).flatMap((d) => d.games)];

  return leagues.map((league, i): LeagueCardData => {
    const nowOf = nows[i]?.data ?? null;
    const mine = teams.filter((t) => t.league === league);
    // Yours first, your team in the league first among them (A3), then the most followed.
    const ranked = [...mine].sort((a, b) => +b.you - +a.you || +(b.you && b.myTeam) - +(a.you && a.myTeam) || b.followers.length - a.followers.length || a.short.localeCompare(b.short));
    const leagueGames = games.filter((g) => g.league === league);
    const name = nowOf?.leagueName ?? leagueGames[0]?.leagueName ?? league.split("/").pop()!.toUpperCase();
    const seasonIds = new Set([...leagueOf].filter(([, l]) => l === league).map(([id]) => id));
    // Its next game: the couch's teams' or a game you play's, else the league's own; by the clock alone (see the file's head).
    const relevant = leagueGames.filter((g) => upcoming(g) && (onCard(g) || (mineQ.data?.games ?? []).some((m) => m.event === g.id)));
    const next = (relevant.length ? relevant : leagueGames.filter(upcoming)).map((g) => Date.parse(g.at!)).sort((a, b) => a - b)[0];

    // What the couch has going in it, the first that holds.
    let line: string | null = null;
    const yours = couch
      ? (hub?.games ?? []).filter((g) => seasonIds.has(g.seasonId) && !g.ended)
      : home.shows.filter((s) => seasonIds.has(s.seasonId)).flatMap((s) => s.games.filter((g) => !g.archived).map((g) => ({ ...g, rank: null as string | null, of: 0 })));
    const yourIds = new Set(yours.map((g) => g.leagueId));
    const due = home.moves.some((m) => yourIds.has(m.leagueId));
    if (yours.length === 1) {
      const g = yours[0];
      // A sport's game goes by its own name, as the hub's feed names it, not its type's; one separator (the check).
      line = g.rank ? `${g.name} · you're ${placeWords(g.rank)} of ${g.of}` : g.of > 1 ? `${g.name} · ${g.of} playing` : g.name;
    } else if (yours.length > 1) {
      const best = yours.map((g) => (g.rank ? Number(g.rank.replace(/^T/, "")) : Infinity)).sort((a, b) => a - b)[0];
      line = `${yours.length} games${Number.isFinite(best) ? ` · your best ${ordinal(best)}` : ""}`;
    }
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
    return { league, name, seasons: [...seasonIds], now: nowOf, teams: ranked, line, due, solo: !couch, at: next ?? Infinity };
  });
}

/** One league's card (72 px; off-season, one 48 px line). */
export function LeagueCard({ card }: { card: LeagueCardData }) {
  const { league, name, now, teams, line, due, solo } = card;
  const open = () => openSports({ kind: "league", league, leagueName: name });
  const yoursFirst = teams.filter((t) => t.you).map((t) => t.short);
  const others = teams.filter((t) => !t.you).map((t) => t.short);
  const teamWords = teams.length ? `${solo ? "Your teams" : "The couch's teams"}: ${[...yoursFirst.map((t) => (solo ? t : `${t}, yours`)), ...others].join("; ")}.` : null;
  const said = (...parts: (string | null | false)[]) => parts.filter(Boolean).join(" ");
  if (now && !now.on) {
    const back = now.back ? new Date(`${now.back}T12:00:00`).toLocaleDateString([], { month: "short", day: "numeric" }) : null;
    const who = teams.length ? namesOf(teams.map((t) => t.short)) : null;
    const rest = ["Off-season", who, back ? `back ${back}` : null].filter(Boolean).join(" · ");
    return (
      <button
        type="button"
        data-league-card={league}
        data-league-off
        onClick={open}
        aria-label={said(`${name}, off-season${back ? `, back ${back}` : ""}.`, teamWords, "Opens the league.")}
        className="nd-press flex h-12 w-full items-center gap-2 rounded-[4px] bg-card px-3.5 text-left focus-visible:outline-none focus-visible:shadow-[inset_0_0_0_2px_var(--foreground)]"
      >
        {/* A long league name ("NCAA Men's Basketball") gives way before the line does (the check: it overflowed). */}
        <b className="type-caption min-w-0 max-w-[60%] flex-none truncate text-[19px] leading-none">{name}</b>
        <span data-league-line className="min-w-0 flex-1 truncate text-[13.5px] text-muted-foreground">
          {rest}
        </span>
      </button>
    );
  }
  const week = now?.week ?? now?.season ?? null;
  const shown = teams.slice(0, MARKS);
  const more = teams.length - shown.length;
  return (
    <button
      type="button"
      data-league-card={league}
      data-due={due || undefined}
      onClick={open}
      aria-label={said(`${name}${week ? `, ${week}` : ""}.`, teamWords, line && `${line}.`, due && "A move of yours is due.", "Opens the league.")}
      className="nd-press flex h-[72px] w-full flex-col justify-center gap-[7px] rounded-[4px] bg-card px-3.5 text-left focus-visible:outline-none focus-visible:shadow-[inset_0_0_0_2px_var(--foreground)]"
    >
      {/* No chevron: a band opens on the same tap with none (the check). A long name gives way before the marks, the week first. */}
      <span className="flex h-[26px] min-w-0 items-center gap-2">
        <b className="type-caption min-w-0 shrink truncate text-[22px] leading-none">{name}</b>
        {week && <span className="type-caption min-w-0 shrink-[4] truncate pt-px text-[15px] leading-none tracking-[0.02em] text-muted-foreground">{week}</span>}
        {/* Yours ringed, as your face is on a band; 6 px apart so two rings never touch (the check: they read as one block). */}
        <span className="ml-auto flex flex-none items-center gap-1.5" aria-hidden>
          {shown.map((t) => (
            <span key={t.id} data-league-mark={t.you ? "you" : t.short} className={t.you ? "rounded-[2px] outline-[1.5px] outline-offset-1 outline-foreground" : ""}>
              <TeamMark abbr={t.abbreviation ?? t.short} color={t.color} size="xs" />
            </span>
          ))}
          {more > 0 && <span className="type-num text-[13px] font-bold text-muted-foreground">+{more}</span>}
        </span>
      </span>
      <span data-league-line className="flex min-w-0 items-center gap-1.5 text-[13.5px] leading-tight text-muted-foreground">
        {due && <i data-league-due className="size-2 flex-none rounded-full bg-chyron-line" aria-hidden />}
        <span className="min-w-0 truncate">{line}</span>
      </span>
    </button>
  );
}
