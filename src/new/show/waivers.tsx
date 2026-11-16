"use client";

import { createContext, useCallback, useContext, useState, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { ArrowLeftRight, ArrowRight, Calendar, Check, ChevronRight, CircleHelp, Play, Plus, RefreshCw, Zap } from "lucide-react";
import { airTime, calm, ticks } from "../clock";
import { useSeasonStats, useSeasonWaivers, waivers as write, type WaiverFace, type WaiverMove, type WaiverRunView, type WaiverWeek } from "../data";
import { gameColour, gameInk, ordinal } from "../games";
import { NavLink, useNav } from "../nav";
import { paths } from "../routes";
import { isTabOf, useShow, type ShowData } from "../screens/show-space";
import { Avatar, useNow } from "../ui/bars";
import { usePushedPage, PushedPage } from "../ui/page";
import { Btn, BtnLink, EmptyState, SectionHead } from "../ui/parts";
import { Sheet } from "../ui/sheet";
import { ShowBar } from "../ui/show-bar";
import { toast } from "../ui/toast";
import { AthleteBody, CastSheetBody, EpisodeSlider, Select } from "./cast";
import { first } from "./moves";
import { useCastNames } from "../sports/faces";
import { Face, IconBox } from "./parts";

// Simple waivers, the player's side (the mock's waivers.js "simple", picked 2026-10-23; docs/PLAN-new-design.md step 6a):
// a page pushed over the show from the moves dock, Tonight and Episodes. "Replace Jenna" (yellow: you need to) and
// "Optional · 1 free swap" (uncoloured), your whole team with one quiet positive tag each, and every button says Swap
// (yellow on whoever's out). One picker for every swap, with the Cast tab's own controls; your pick yellow, backups
// outlined. Nothing is chosen for you: the most points left only comes in if you forget, and the page says so. Picking
// order as faces, lowest score first. Saving a spot writes your private claim through the league route the classic app
// uses (/waivers/claims, a spot at a time); the run plays like an episode (a reveal, then a page of its own in picking
// order), then free agency until airtime. No points copy: what someone scored stays in past weeks.

const names = (list: string[]) => (list.length > 1 ? `${list.slice(0, -1).join(", ")} and ${list[list.length - 1]}` : (list[0] ?? ""));

// A cast member's name where room is short (BACKLOG 88): an athlete by surname, a defense by its nickname, as the game page names
// them (sports/faces.ts useCastNames, the season's roster read on the phone); a show's cast by first name, as before. Each of the
// file's doors (the episode row, the plate, the overlays, the screen) provides it.
type Namer = (n: string | null | undefined) => string;
const NO_CAST: { name: string }[] = [];
const CastNames = createContext<Namer>((n) => (n ? first(n) : ""));
/** Their position ("WR"), a sport's only. */
const CastRoles = createContext<(n: string | null | undefined) => string | null>(() => null);
function Names({ seasonId, children }: { seasonId: string; children: ReactNode }) {
  const show = useShow(seasonId);
  const names = useCastNames(seasonId, show.header?.show.kind === "sport", NO_CAST);
  return (
    <CastNames.Provider value={names.name}>
      <CastRoles.Provider value={names.role}>{children}</CastRoles.Provider>
    </CastNames.Provider>
  );
}

/** Which game's waivers the page shows: `?game=`, else the first with something to do. */
function pickGame(weeks: WaiverWeek[], asked: string | null): WaiverWeek | null {
  return weeks.find((w) => w.leagueId === asked) ?? weeks.find((w) => w.stage === "open" && (w.replace.length || w.swapsLeft)) ?? weeks.find((w) => w.stage !== "none") ?? weeks[0] ?? null;
}

/** After a waiver write: the waivers, your moves and the games read again. */
function useAfterWaivers() {
  const client = useQueryClient();
  return () =>
    Promise.all([
      client.invalidateQueries({ queryKey: ["new-design", "waivers"] }),
      client.invalidateQueries({ queryKey: ["new-design", "home"] }),
      client.invalidateQueries({ queryKey: ["new-design", "games"] }),
      client.invalidateQueries({ queryKey: ["new-design", "bs2"] }),
    ]);
}

// ---- the run's "seen" mark: your account's (step 15 part 2; it was per device), so Tonight's "Waivers ran" plate goes on every
// phone once you've watched it on one. The waivers read says which runs you've seen; watching one says so, the plate going at once. ----

/** Whether you've watched a game's run, from the waivers read's `seen` ("<leagueId>:<periodId>"). */
const runSeen = (seen: string[] | undefined, leagueId: string, periodId: string) => !!seen?.includes(`${leagueId}:${periodId}`);

/** You've watched a run: every waivers read here knows at once, and the server keeps it for your other phones. */
function useMarkRunSeen(seasonId: string) {
  const qc = useQueryClient();
  return useCallback(
    (leagueId: string, periodId: string) => {
      const key = `${leagueId}:${periodId}`;
      qc.setQueriesData<{ games: WaiverWeek[]; seen: string[] }>({ queryKey: ["new-design", "waivers", seasonId] }, (d) =>
        d && !d.seen.includes(key) ? { ...d, seen: [...d.seen, key] } : d
      );
      write.seen(seasonId, leagueId, periodId).catch(() => {
        // Not kept: the plate comes back on the next read, which is all that's lost.
      });
    },
    [qc, seasonId]
  );
}

/** A run you haven't watched yet, in a week still going: Tonight's "Waivers ran" plate. */
export function unseenRun(weeks: WaiverWeek[] | undefined, seen: string[] | undefined): WaiverWeek | null {
  return weeks?.find((w) => w.run && w.period?.id === w.run.periodId && w.stage === "processed" && !runSeen(seen, w.leagueId, w.run.periodId)) ?? null;
}

/** Whether you play a game here that can have waivers (Outlast, Weekly Lineup), so it's worth asking. */
export const playsWaivers = (show: ShowData) => show.games.some((g) => g.yourRole && (g.gameType === "classic-draft" || g.gameType === "active-roster"));

/** The moves a run made: who got whom, and free agency's since. */
export const movesIn = (run: WaiverRunView) => run.moves.filter((m) => m.outcome === "got").length + run.freeAgency.length;

/** A run's moves by player, you first, then in the run's order (picking order, where there is one): each player's moves made,
 *  and whoever made none. */
function byPlayer(run: WaiverRunView) {
  const made = [...run.moves.filter((m) => m.outcome === "got" && m.add), ...run.freeAgency.filter((m) => m.add)];
  const players: { playerId: string; name: string; userId: string | null; you: boolean; moves: WaiverMove[] }[] = [];
  for (const m of made) {
    const p = players.find((x) => x.playerId === m.playerId);
    if (p) p.moves.push(m);
    else players.push({ playerId: m.playerId, name: m.name, userId: m.userId, you: m.you, moves: [m] });
  }
  players.sort((a, b) => Number(b.you) - Number(a.you));
  const none = run.moves.filter((m) => m.outcome !== "got" && !players.some((p) => p.playerId === m.playerId));
  const missed = none.filter((m, i) => none.findIndex((x) => x.playerId === m.playerId) === i);
  return { players, missed };
}

/** A player's moves in a line: "You got Ori for Carter"; several, "You got Jelly, Carter and Thien" (the faces say for whom). */
const gotLine = (p: { you: boolean; name: string; moves: WaiverMove[] }, nm: Namer) => {
  const one = p.moves.length === 1 ? p.moves[0] : null;
  return `${p.you ? "You" : p.name} got ${one ? `${nm(one.add!.name)}${one.drop ? ` for ${nm(one.drop.name)}` : ""}` : names(p.moves.map((m) => nm(m.add!.name)))}`;
};

/**
 * Episodes' row for a waiver week, just above the episode that opened it (2026-10-31, the user: every week's moves where they
 * happened, at a glance, then a page of its own). A run: the game's label in its colour, what you got as a headline, your swaps as
 * faces (who left, faded, then who came in), everyone else in a line. A week still open: what's due, to the Waivers page.
 */
export function WaiverEpisodeRow(props: { seasonId: string; week: WaiverWeek; run: WaiverRunView | null; many: boolean }) {
  return (
    <Names seasonId={props.seasonId}>
      <WaiverEpisodeRowBody {...props} />
    </Names>
  );
}

function WaiverEpisodeRowBody({ seasonId, week, run, many }: { seasonId: string; week: WaiverWeek; run: WaiverRunView | null; many: boolean }) {
  const nm = useContext(CastNames);
  const ran = usePushedPage("waivers-ran", ["wv", "run"]);
  const label = many ? `${week.gameName} waivers` : "Waivers";
  if (run) {
    const { players } = byPlayer(run);
    const lead = players[0];
    const rest = players.slice(1);
    const count = movesIn(run);
    return (
      <button
        type="button"
        data-wv-ep="ran"
        data-wv-episode={run.episode}
        onClick={() => ran.showWith({ wv: week.leagueId, run: run.periodId })}
        className="nd-press flex w-full items-start gap-3 border-t border-border py-3 text-left"
      >
        <span className="grid w-7 flex-none place-items-center pt-0.5 text-muted-foreground">
          <ArrowLeftRight className="size-5" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-2">
            <span className="type-caption truncate text-[13px] tracking-[0.04em]" style={{ color: gameInk(week.gameName) }}>
              {label} <span className="text-muted-foreground">· after Ep {run.episode}</span>
            </span>
            <small className="flex-none text-[13px] text-muted-foreground">
              {count} {count === 1 ? "move" : "moves"}
            </small>
          </span>
          {lead && <b className="mt-1 block text-base font-semibold leading-snug">{gotLine(lead, nm)}</b>}
          {lead && (
            <span className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2" aria-hidden>
              {lead.moves.slice(0, 4).map((m) => (
                <span key={`${m.drop?.id}-${m.add!.id}`} className="flex items-center gap-1">
                  {m.drop && <Face src={m.drop.photo} name={m.drop.name} className="size-[26px] rounded-[2px] text-[11px] opacity-50 grayscale" />}
                  {m.drop && <ArrowRight className="size-3 text-muted-foreground" />}
                  <Face src={m.add!.photo} name={m.add!.name} className="size-[30px] rounded-[2px] text-xs" />
                </span>
              ))}
              {lead.moves.length > 4 && <span className="text-[13px] font-semibold text-muted-foreground">+{lead.moves.length - 4}</span>}
            </span>
          )}
          {rest.length > 0 && <small className="mt-2 line-clamp-2 block text-[13px] leading-snug text-muted-foreground">{rest.map((x) => gotLine(x, nm)).join(" · ")}</small>}
        </span>
        <ChevronRight className="mt-0.5 size-5 flex-none text-muted-foreground" aria-hidden />
      </button>
    );
  }
  return (
    <NavLink
      data-wv-ep="open"
      href={`${paths.showPage(seasonId, "waivers")}?game=${week.leagueId}`}
      // Step 4's check: a marker in the season's list, quiet; the strip says the move and when it's due (each fact once).
      className="nd-press flex min-h-[60px] w-full items-center gap-3 border-t border-border text-left"
    >
      <span className="grid w-7 place-items-center text-muted-foreground">
        <ArrowLeftRight className="size-5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <b className="block text-base font-semibold">
          {label} · after Episode {week.period?.episode}
        </b>
        <small className="mt-0.5 block text-[13px] text-muted-foreground">
          Open · {week.replace.length ? `replace ${names(week.replace.map((id) => nm(week.team.find((f) => f.id === id)?.name ?? "someone")))}` : "optional swaps"}
        </small>
      </span>
      <ChevronRight className="size-5 flex-none text-muted-foreground" aria-hidden />
    </NavLink>
  );
}

/** Tonight's "Waivers ran" plate (the mock's tabTonight): a run you haven't watched, while its week is still going. */
export function WaiversRanPlate(props: { seasonId: string; show: ShowData }) {
  return (
    <Names seasonId={props.seasonId}>
      <WaiversRanPlateBody {...props} />
    </Names>
  );
}

function WaiversRanPlateBody({ seasonId, show }: { seasonId: string; show: ShowData }) {
  const wv = useSeasonWaivers(seasonId, show.couch?.id ?? null, playsWaivers(show));
  const replay = usePushedPage("waivers-run", ["wv"]);
  const week = unseenRun(wv.data?.games, wv.data?.seen);
  if (!week?.run) return null;
  const mine = week.run.moves.find((m) => m.you && m.outcome === "got" && m.add);
  return (
    <section className="mt-[18px] px-4">
      <button
        type="button"
        data-wv-plate
        onClick={() => replay.showWith({ wv: week.leagueId })}
        className="nd-press flex min-h-14 w-full items-stretch overflow-hidden rounded-[3px] bg-plate text-left text-plate-foreground shadow-plate"
      >
        <span className="type-caption -mr-[13px] flex items-center whitespace-nowrap bg-good py-0 pl-[11px] pr-[22px] text-sm tracking-[0.04em] text-good-foreground [clip-path:polygon(0_0,100%_0,calc(100%_-_13px)_100%,0_100%)]">
          Waivers
        </span>
        <span className="flex flex-1 flex-col justify-center gap-[3px] py-[7px] pl-5 pr-2.5">
          <span className="type-caption text-[19px]">Waivers ran</span>
          <span className="text-[13px] text-plate-muted">
            {mine ? "See who you got" : "See who got who"} · {week.gameName} · after Episode {week.run.episode}
          </span>
        </span>
        <span className="grid place-items-center px-3">
          <ChevronRight className="size-5" aria-hidden />
        </span>
      </button>
    </section>
  );
}

/** The run's reveal and page over a show's tabs (Tonight's plate, Episodes' row): the same waivers read, shared. */
export function WaiverOverlays(props: { seasonId: string; show: ShowData }) {
  return (
    <Names seasonId={props.seasonId}>
      <WaiverOverlaysBody {...props} />
    </Names>
  );
}

function WaiverOverlaysBody({ seasonId, show }: { seasonId: string; show: ShowData }) {
  const wv = useSeasonWaivers(seasonId, show.couch?.id ?? null, playsWaivers(show));
  return (
    <>
      <WaiverRunScreen seasonId={seasonId} weeks={wv.data?.games ?? null} />
      <WaiverRunPage weeks={wv.data?.games ?? null} />
    </>
  );
}

// ---------- the page ----------

export function WaiversScreen(props: { seasonId: string }) {
  return (
    <Names seasonId={props.seasonId}>
      <WaiversScreenBody {...props} />
    </Names>
  );
}

function WaiversScreenBody({ seasonId }: { seasonId: string }) {
  const show = useShow(seasonId);
  const nav = useNav();
  const couchId = show.couch?.id ?? null;
  const data = useSeasonWaivers(seasonId, couchId, !!show.home);
  const asked = useSearchParams().get("game");
  const [game, setGame] = useState<string | null>(asked);
  const week = data.data ? pickGame(data.data.games, game) : null;
  const name = show.header?.show.name ?? "Show";
  const back = { label: name.replace(/^The /, ""), onClick: () => nav.back(paths.show(seasonId), isTabOf(seasonId)) };

  return (
    <>
      {show.header ? (
        <ShowBar
          show={{ seasonId, name, seasonNumber: show.header.seasonNumber, artUrl: show.header.show.artUrl, backdropUrl: show.header.show.backdropUrl }}
          back={back}
          status={
            week && (data.data?.games.length ?? 0) < 2 ? (
              <>
                {week.gameName}
              </>
            ) : null
          }
          title="Waivers"
        />
      ) : (
        <div className="h-24 animate-pulse bg-card" aria-busy />
      )}
      {data.error ? (
        <EmptyState icon={ArrowLeftRight} title="Couldn't load waivers" line={(data.error as Error).message} />
      ) : !data.data ? (
        <div aria-busy className="mx-4 mt-6 h-72 animate-pulse rounded-[4px] bg-card" />
      ) : !week ? (
        <EmptyState icon={ArrowLeftRight} title="No waivers here" line="None of your games on this show replaces people or swaps them." />
      ) : (
        <>
          {data.data.games.length > 1 && (
            <div className="flex gap-2 overflow-x-auto px-4 pt-4 [scrollbar-width:none]" role="group" aria-label="Game">
              {data.data.games.map((g) => (
                <button
                  key={g.leagueId}
                  type="button"
                  data-wv-game={g.gameName}
                  aria-pressed={g.leagueId === week.leagueId}
                  onClick={() => setGame(g.leagueId)}
                  className={`flex h-9 flex-none items-center gap-2 rounded-[2px] px-3 text-sm font-semibold ${g.leagueId === week.leagueId ? "bg-foreground text-background" : "bg-secondary"}`}
                >
                  <i className="size-2.5 rounded-full" style={{ background: gameColour(g.gameName) }} aria-hidden />
                  {g.gameName}
                </button>
              ))}
            </div>
          )}
          <Week key={week.leagueId} seasonId={seasonId} show={show} week={week} />
        </>
      )}
      <WaiverRunScreen seasonId={seasonId} weeks={data.data?.games ?? null} />
      <WaiverRunPage weeks={data.data?.games ?? null} />
    </>
  );
}

function Week({ seasonId, show, week }: { seasonId: string; show: ShowData; week: WaiverWeek }) {
  const [how, setHow] = useState(false);
  const ran = usePushedPage("waivers-ran", ["wv", "run"]);
  const replay = usePushedPage("waivers-run", ["wv"]);
  // Past waivers: the latest week anyone moved in (a quiet week says nothing), else the latest.
  const past = [...week.runs].reverse().find((r) => movesIn(r) > 0) ?? week.run;
  const pastMoves = past ? movesIn(past) : 0;
  const rows = (
    <section className="mt-[26px] px-4">
      {week.run && (
        <>
          <button type="button" data-wv-past onClick={() => ran.showWith({ wv: week.leagueId, run: past?.periodId ?? "" })} className="nd-press flex min-h-[60px] w-full items-center gap-3 border-t border-border py-2 text-left">
            <IconBox icon={Calendar} />
            <span className="min-w-0 flex-1">
              <b className="block text-[15px] font-semibold">Past waivers</b>
              <small className="block text-[13px] text-muted-foreground">
                After Episode {past?.episode} · {pastMoves} {pastMoves === 1 ? "move" : "moves"}
              </small>
            </span>
            <ChevronRight className="size-5 text-muted-foreground" aria-hidden />
          </button>
          <button type="button" data-wv-replay onClick={() => replay.showWith({ wv: week.leagueId })} className="nd-press flex min-h-[60px] w-full items-center gap-3 border-t border-border py-2 text-left">
            <IconBox icon={Play} />
            <span className="min-w-0 flex-1">
              <b className="block text-[15px] font-semibold">Watch the run again</b>
              <small className="block text-[13px] text-muted-foreground">The way it played when it came in</small>
            </span>
            <ChevronRight className="size-5 text-muted-foreground" aria-hidden />
          </button>
        </>
      )}
      <button type="button" data-wv-how onClick={() => setHow(true)} className="nd-press flex min-h-[60px] w-full items-center gap-3 border-t border-border py-2 text-left">
        <IconBox icon={CircleHelp} />
        <span className="min-w-0 flex-1">
          <b className="block text-[15px] font-semibold">How waivers work here</b>
          <small className="block text-[13px] text-muted-foreground">When moves happen, who picks first</small>
        </span>
        <ChevronRight className="size-5 text-muted-foreground" aria-hidden />
      </button>
    </section>
  );
  return (
    <>
      {week.revealFirst ? (
        <EmptyState
          icon={ArrowLeftRight}
          title={`Reveal Episode ${week.revealFirst} first`}
          line="Who you can replace this week would give away who went home."
          action={
            <BtnLink tone="must" wide href={`${paths.show(seasonId, "tonight")}?page=reveal&ep=${week.revealFirst}`}>
              Reveal Ep {week.revealFirst}
            </BtnLink>
          }
        />
      ) : week.stage === "open" && (week.replace.length || week.swapsAllowed) ? (
        <OpenWeek seasonId={seasonId} show={show} week={week} />
      ) : week.stage === "processed" ? (
        <RanWeek week={week} />
      ) : (
        <Quiet week={week} />
      )}
      {!week.revealFirst && rows}
      <WaiversHow open={how} onOpenChange={setHow} how={week.how} gameName={week.gameName} />
      <div className="h-28" />
    </>
  );
}

/** How far off a deadline is, said once and calmly (step 8: no countdown ticking seconds): "in 2 days", "tomorrow", "in 6 hours",
 *  "in 40 min", "now". */
function stated(t: number, now: number): string {
  if (!ticks(t, now)) return calm(t, now);
  const m = Math.max(0, Math.round((t - now) / 60_000));
  if (m < 1) return "now";
  if (m < 60) return `in ${m} min`;
  const h = Math.round(m / 60);
  return h === 1 ? "in an hour" : `in ${h} hours`;
}

/** Each person's points by episode, the season's stats read (the picker's), and how far they count. */
function useEpisodePoints(seasonId: string, couchId: string | null) {
  const stats = useSeasonStats(seasonId, couchId);
  const d = stats.data;
  const by = new Map((d?.cast ?? []).map((c) => [c.name, c]));
  const through = d?.through ?? 0;
  /** Their last eight episodes' points (null once they were out). */
  const weeks = (name: string): (number | null)[] => {
    const c = by.get(name);
    if (!c || !through) return [];
    return c.perEp.slice(Math.max(0, through - 8), through);
  };
  return { through, weeks, points: (f: WaiverFace) => by.get(f.name)?.points ?? f.points };
}

/** One person's points by episode as bars, on the scale every row on the page shares, in one column at the same place on every
 *  row so they compare down the page: the latest episode full, the ones before it a step back, a baseline under them all. */
function WeekBars({ values, max }: { values: (number | null)[]; max: number }) {
  const said = values.map((v) => (v == null ? "out" : String(Math.round(v * 10) / 10))).join(", ");
  return (
    <span role={values.length ? "img" : undefined} aria-label={values.length ? `Points by episode: ${said}` : undefined} data-week-bars className="flex h-[26px] w-[76px] flex-none items-end justify-end gap-[3px] border-b border-border">
      {values.map((v, i) => (
        <i
          key={i}
          className={`block w-[7px] rounded-t-[1px] ${v == null ? "" : v < 0 ? "bg-live" : i === values.length - 1 ? "bg-foreground" : "bg-foreground/55"}`}
          style={{ height: v == null || v === 0 ? 0 : v < 0 ? 3 : Math.max(3, Math.round((v / max) * 24)) }}
        />
      ))}
    </span>
  );
}

/** The bars' section aside: which episodes they show, or that nobody has points yet (then the bars stay out). */
function barsAside(through: number, any: boolean): string {
  if (!any) return "No points yet";
  const from = Math.max(1, through - 7);
  return from === through ? `Points, Ep ${through}` : `Points by episode, ${from}–${through}`;
}

/** A person on the page: their face and name open their sheet; their line; their weeks; one action at the right. */
function PersonRow({ f, line, bars, action, onOpen }: { f: WaiverFace; line: ReactNode; bars: ReactNode; action?: ReactNode; onOpen: () => void }) {
  return (
    <div data-wv-row={f.name} className="flex min-h-[64px] items-center gap-3 border-t border-border py-2 first:border-t-0">
      <button type="button" data-wv-open={f.name} onClick={onOpen} className="nd-press flex min-w-0 flex-1 items-center gap-3 text-left">
        <Face src={f.photo} name={f.name} out={f.out != null} className="size-12 flex-none rounded-[3px]" />
        <span className="min-w-0 flex-1">
          {/* A long name wraps to two lines rather than losing its surname to the bars' column. */}
          <b className="line-clamp-2 block text-[16px] leading-tight">{f.name}</b>
          <small className="mt-0.5 block truncate text-[13px] text-muted-foreground">{line}</small>
        </span>
        {bars}
      </button>
      {action}
    </div>
  );
}

/** The week's move, the strip's object (a caption plate with its tag): yellow while it's owed, the quiet panel once it's in. */
function MovePlate({ due, tag, title, line, onTap, done }: { due: boolean; tag: ReactNode; title: string; line: string; onTap?: () => void; done?: boolean }) {
  const body = (
    <>
      <span
        className={`type-caption -mr-[13px] flex flex-none items-center gap-1.5 whitespace-nowrap py-0 pl-[11px] pr-[22px] text-[15px] tracking-[0.04em] [clip-path:polygon(0_0,100%_0,calc(100%_-_13px)_100%,0_100%)] ${
          due ? "bg-chyron text-chyron-foreground" : "bg-secondary text-foreground"
        }`}
      >
        {done && <Check className="size-4 text-good" strokeWidth={3} aria-hidden />}
        {tag}
      </span>
      <span className="flex min-w-0 flex-1 flex-col justify-center gap-[3px] py-2.5 pl-5 pr-1">
        <b data-wv-head className="text-[18px] font-bold leading-tight">
          {title}
        </b>
        <small className={`text-[14px] leading-tight ${due ? "text-plate-muted" : "text-muted-foreground"}`}>{line}</small>
      </span>
      {onTap && (
        <span className="grid flex-none place-items-center px-2.5">
          <ChevronRight className={`size-5 ${due ? "" : "text-muted-foreground"}`} aria-hidden />
        </span>
      )}
    </>
  );
  const cls = `flex min-h-[64px] w-full items-stretch overflow-hidden rounded-[3px] text-left ${due ? "bg-plate text-plate-foreground shadow-plate" : "bg-card text-foreground outline-1 -outline-offset-1 outline-border"}`;
  return onTap ? (
    <button type="button" data-wv-plate={due ? "due" : "set"} onClick={onTap} className={`nd-press ${cls}`}>
      {body}
    </button>
  ) : (
    <div data-wv-plate={due ? "due" : "set"} className={cls}>
      {body}
    </div>
  );
}

/** Their sheet (step 5's person sheet, an athlete's on a sport), with the week's action at its foot. */
function WaiverFaceSheet({ seasonId, show, face, onClose, foot }: { seasonId: string; show: ShowData; face: WaiverFace | null; onClose: () => void; foot: ReactNode }) {
  const role = useContext(CastRoles);
  const nav = useNav();
  const [last, setLast] = useState(face);
  if (face && face !== last) setLast(face);
  const f = face ?? last;
  const onGame = (g: { leagueId: string }) => nav.push(paths.gamePage(seasonId, g.leagueId));
  const sport = show.header?.show.kind === "sport";
  return (
    <Sheet open={!!face} onOpenChange={(o) => !o && onClose()} title={f?.name ?? ""} subtitle={f ? [role(f.name), f.group?.name].filter(Boolean).join(" · ") || undefined : undefined} foot={f ? foot : undefined}>
      {f && (
        <div data-wv-sheet={f.id}>
          {sport ? (
            <AthleteBody seasonId={seasonId} show={show} p={{ name: f.name, role: role(f.name), photoUrl: f.photo, team: f.group?.name ?? "", line: null }} onGame={onGame} />
          ) : (
            <CastSheetBody seasonId={seasonId} show={show} name={f.name} onGame={onGame} />
          )}
        </div>
      )}
    </Sheet>
  );
}

/**
 * An owed spot, as the page's move (the user, 2026-11-16: "it's not clear at first who I'm replacing because the picture of Carter
 * isn't there... I'd rather the Swap button exist and it bring up Who comes in for Carter"): who's leaving, by face, the deadline
 * once, and Swap (the page's one yellow) opening the picker. Once claimed, the quiet panel: who's leaving, who comes in, Change.
 */
function SpotPlate({ out, add, line, onSwap }: { out: WaiverFace; add: WaiverFace | null; line: string; onSwap: () => void }) {
  const nm = useContext(CastNames);
  const due = !add;
  return (
    <div
      data-wv-plate={due ? "due" : "set"}
      data-wv-spot={out.name}
      className={`flex min-h-[76px] items-center gap-3 rounded-[3px] py-2.5 pl-2.5 pr-3 ${due ? "bg-plate text-plate-foreground shadow-plate" : "bg-card text-foreground outline-1 -outline-offset-1 outline-border"}`}
    >
      {add ? (
        // Claimed: who comes in, with who's leaving small and faded at its corner (room for the words beside them).
        <span className="relative flex-none pb-2 pr-2">
          <Face src={add.photo} name={add.name} className="size-14 rounded-[3px]" />
          <Face src={out.photo} name={out.name} out className="absolute bottom-0 right-0 size-7 rounded-[2px] outline-2 outline-card" />
        </span>
      ) : (
        <Face src={out.photo} name={out.name} out className="size-14 flex-none rounded-[3px]" />
      )}
      <span className="min-w-0 flex-1">
        <b data-wv-head className="block text-[17px] font-bold leading-tight">
          {add ? `${nm(add.name)} comes in for ${nm(out.name)}` : `Replace ${nm(out.name)}`}
        </b>
        <small className={`mt-0.5 block text-[13.5px] leading-snug ${due ? "text-plate-muted" : "text-muted-foreground"}`}>{line}</small>
      </span>
      <Btn tone={due ? "must" : "optional"} data-swap={out.name} className="h-11 min-w-[84px] flex-none px-3.5" onClick={onSwap}>
        {due ? "Swap" : "Change"}
      </Btn>
    </div>
  );
}

/** An owed spot in Your team: a blank slot (dashed), the team's shape kept; once claimed, who's coming in, faded till it runs.
 *  No button: the plate's Swap is the move (a tap here opens the same picker). */
function SlotRow({ out, add, until, onTap }: { out: WaiverFace; add: WaiverFace | null; until: string | null; onTap: () => void }) {
  const nm = useContext(CastNames);
  return (
    <button type="button" data-wv-slot={out.name} onClick={onTap} className="nd-press flex min-h-[64px] w-full items-center gap-3 border-t border-border py-2 text-left first:border-t-0">
      <span className="grid size-12 flex-none place-items-center overflow-hidden rounded-[3px] outline-[1.5px] -outline-offset-[1.5px] outline-dashed outline-muted-foreground/60">
        {add ? <Face src={add.photo} name={add.name} className="size-full opacity-55" /> : <Plus className="size-5 text-muted-foreground" aria-hidden />}
      </span>
      <span className="min-w-0 flex-1">
        <b className={`block text-[16px] leading-tight ${add ? "" : "text-muted-foreground"}`}>{add ? `${nm(add.name)}, coming in` : "Open spot"}</b>
        <small className="mt-0.5 block truncate text-[13px] text-muted-foreground">{add ? `for ${nm(out.name)}${until ? ` · from ${until}` : ""}` : `${nm(out.name)}'s · out Ep ${out.out ?? "?"}`}</small>
      </span>
    </button>
  );
}

function OpenWeek({ seasonId, show, week }: { seasonId: string; show: ShowData; week: WaiverWeek }) {
  const nm = useContext(CastNames);
  const role = useContext(CastRoles);
  const [picking, setPicking] = useState<string | null>(null);
  const [looking, setLooking] = useState<WaiverFace | null>(null);
  const now = useNow(false);
  const pts = useEpisodePoints(seasonId, show.couch?.id ?? null);
  const spots = new Map(week.spots.map((s) => [s.dropId, s.addIds]));
  const byId = new Map([...week.team, ...week.free].map((f) => [f.id, f]));
  const picked = (id: string) => (spots.get(id)?.length ?? 0) > 0;
  const open = week.replace.filter((id) => !picked(id));
  const swapSpots = week.spots.filter((s) => !week.outIds.includes(s.dropId));
  const left = Math.max(0, week.swapsLeft - swapSpots.length);
  const total = week.spots.length;
  const nameOf = (id: string) => nm(byId.get(id)?.name ?? "someone");
  const due = week.period?.due ? Date.parse(week.period.due) : null;
  const until = due != null ? airTime(due) : null;
  const episode = week.period?.episode ?? null;
  // Your team: whoever's on a plate above is a blank slot here, the team's shape kept (the user, 2026-11-16).
  const team = week.team;
  const max = Math.max(1, ...team.flatMap((f) => pts.weeks(f.name).map((v) => v ?? 0)));
  const anyPoints = team.some((f) => pts.weeks(f.name).some((v) => (v ?? 0) !== 0));
  const bars = (f: WaiverFace) => (anyPoints ? <WeekBars values={pts.weeks(f.name)} max={max} /> : null);
  const pointsLine = (f: WaiverFace) => [role(f.name), f.group?.name, `${Math.round(pts.points(f) * 10) / 10} pts`].filter(Boolean).join(" · ");
  const fallback = week.fallback ? "Forget, and whoever's free with the most points comes in." : "Forget, and the spot stays empty.";

  return (
    <>
      <section data-wv-week="open" className="mt-4 flex flex-col gap-2 px-3">
        {week.replace.length ? (
          week.replace.map((id) => {
            const out = byId.get(id);
            if (!out) return null;
            const adds = spots.get(id) ?? [];
            const add = adds[0] ? (byId.get(adds[0]) ?? null) : null;
            const line = add
              ? [adds.length > 1 ? `Backup${adds.length > 2 ? "s" : ""}: ${adds.slice(1).map(nameOf).join(", ")}` : week.shared ? null : "If taken, the best one left", until ? `change until ${until}` : null].filter(Boolean).join(" · ")
              : [week.needs, `Out · Ep ${out.out ?? episode}`, until ? `by ${until}` : null, due != null ? stated(due, now) : null].filter(Boolean).join(" · ");
            return <SpotPlate key={id} out={out} add={add} line={line} onSwap={() => setPicking(id)} />;
          })
        ) : total ? (
          <MovePlate due={false} done tag={episode ? `Ep ${episode}` : "In"} title={`${total} swap${total === 1 ? "" : "s"} in`} line={until ? `Change anything until ${until}` : "Change anything until they run"} />
        ) : (
          <MovePlate due={false} tag={episode ? `Ep ${episode}` : "Swaps"} title={`Any swaps? ${left} free this week`} line={until ? `Optional · until ${until}` : "Optional"} />
        )}
        {open.length > 0 && (
          <p data-wv-fallback className="flex items-start gap-2 px-1 pt-1 text-[14px] leading-snug text-muted-foreground">
            <Zap className="mt-0.5 size-4 flex-none" aria-hidden />
            {fallback}
          </p>
        )}
      </section>

      {team.length > 0 && (
        <section className="mt-[22px] px-4">
          <SectionHead title="Your team" aside={anyPoints ? barsAside(pts.through, true) : left && week.replace.length ? `${left} free swap${left === 1 ? "" : "s"}` : undefined} flush />
          <div className="flex flex-col">
            {team.map((f) => {
              const adds = spots.get(f.id) ?? [];
              if (week.replace.includes(f.id)) {
                const add = adds[0] ? (byId.get(adds[0]) ?? null) : null;
                return <SlotRow key={f.id} out={f} add={add} until={until} onTap={() => setPicking(f.id)} />;
              }
              const out = f.out != null;
              const going = adds.length > 0 && !out;
              return (
                <div key={f.id}>
                  <PersonRow
                    f={f}
                    line={out ? <span className="font-semibold text-live">Out · Ep {f.out}</span> : pointsLine(f)}
                    bars={out ? null : bars(f)}
                    onOpen={() => setLooking(f)}
                    action={
                      going ? (
                        <span className="type-caption w-[88px] flex-none text-center text-[13px] tracking-[0.06em] text-muted-foreground">Going</span>
                      ) : !out && left > 0 ? (
                        <Btn data-swap={f.name} className="h-10 min-w-[88px] flex-none px-3 text-[14px]" onClick={() => setPicking(f.id)}>
                          Swap
                        </Btn>
                      ) : (
                        // The bar column stays where the other rows put it.
                        <span className="w-[88px] flex-none" aria-hidden />
                      )
                    }
                  />
                  {going && (
                    <button type="button" data-wv-in={f.name} onClick={() => setPicking(f.id)} className="nd-press mb-2 flex w-full items-center gap-2.5 rounded-[3px] bg-card p-2 text-left">
                      <Face src={byId.get(adds[0])?.photo ?? null} name={byId.get(adds[0])?.name} className="size-10 flex-none rounded-[3px]" />
                      <span className="min-w-0 flex-1">
                        <b className="block text-[15px]">{nm(byId.get(adds[0])?.name ?? "someone")} comes in</b>
                        <small className="block text-[13px] text-muted-foreground">
                          Optional swap{adds.length > 1 ? ` · backup${adds.length > 2 ? "s" : ""}: ${adds.slice(1).map(nameOf).join(", ")}` : ""}
                        </small>
                      </span>
                      <span className="text-[14px] font-bold">Change</span>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      <Order week={week} due={week.period?.due ?? null} />

      {picking && (
        <PickSheet
          seasonId={seasonId}
          couchId={show.couch?.id ?? null}
          week={week}
          drop={byId.get(picking)!}
          taken={week.spots.filter((s) => s.dropId !== picking).map((s) => s.addIds[0])}
          onClose={() => setPicking(null)}
        />
      )}
      <WaiverFaceSheet
        seasonId={seasonId}
        show={show}
        face={looking}
        onClose={() => setLooking(null)}
        foot={(() => {
          const f = looking;
          if (!f || f.out != null || left <= 0 || spots.get(f.id)?.length) return null;
          return (
            <Btn
              wide
              data-wv-sheet-swap
              onClick={() => {
                setLooking(null);
                setPicking(f.id);
              }}
            >
              Swap {nm(f.name)}
            </Btn>
          );
        })()}
      />
    </>
  );
}

/** Picking order (exclusive games: in a shared one nobody can take anyone from you): one line of faces, you marked, its rule. */
function Order({ week, due }: { week: WaiverWeek; due: string | null }) {
  if (week.shared || !week.order.length) return null;
  const rule = week.orderBy === "leastPoints" ? "Lowest score picks first" : week.orderBy === "mostPoints" ? "Highest score picks first" : "Picking order rolls each week";
  return (
    <section data-wv-order className="mt-[22px] px-4">
      <SectionHead title="Picking order" flush />
      <ol className="flex flex-wrap gap-1.5">
        {week.order.map((p, i) => (
          <li key={p.playerId} data-you={p.you || undefined} className={`flex h-9 items-center gap-1.5 rounded-[3px] pl-1.5 pr-2.5 text-[14px] ${p.you ? "bg-foreground font-bold text-background" : "bg-card"}`}>
            <span className={`type-num w-3.5 text-center text-[14px] ${p.you ? "" : "text-muted-foreground"}`}>{i + 1}</span>
            <Avatar id={p.userId ?? p.playerId} name={p.name} size={24} />
            {p.you ? "You" : p.name}
          </li>
        ))}
      </ol>
      <p className="mt-2 text-[14px] leading-snug text-muted-foreground">
        {rule} · claims stay private until {due ? airTime(Date.parse(due)) : "they run"}
      </p>
    </section>
  );
}

function Quiet({ week }: { week: WaiverWeek }) {
  const next = week.how.lanes.episodes.find((n, i) => n > week.how.lanes.now && (week.how.lanes.swap[i] || week.how.lanes.replace[i]));
  // Last time: the latest week anyone moved in, so a quiet week still shows the game moving.
  const last = [...week.runs].reverse().find((r) => movesIn(r) > 0) ?? null;
  return (
    <>
      <section data-wv-week="quiet" className="mt-4 px-3">
        <MovePlate
          due={false}
          tag="This week"
          title={next ? `Nothing to do until after Ep ${next}` : "Nothing to do this week"}
          line={week.nobodyFree ? "Nobody's free to pick up: your team plays as it is" : week.how.starts ? `${week.how.starts}. Your team plays as it is till then` : "Your team plays as it is"}
        />
      </section>
      {last && (
        <section data-wv-last className="mt-[22px] px-4">
          <SectionHead title="Last time" aside={`After Ep ${last.episode}`} flush />
          <MovesList moves={[...last.moves.filter((m) => m.outcome === "got"), ...last.freeAgency.filter((m) => m.add)]} shared={week.shared} />
        </section>
      )}
      <Order week={week} due={null} />
    </>
  );
}

// ---------- after the run: who you got, everyone's moves, free agency ----------

function moveLine(m: WaiverMove, shared: boolean, nm: Namer): { title: string; line: string } {
  const who = m.you ? "You" : m.name;
  if (m.outcome !== "got" || !m.add) return { title: `${who}: no change`, line: m.why };
  return { title: `${who} got ${nm(m.add.name)}`, line: `for ${m.drop ? nm(m.drop.name) : "a spot"}${shared ? "" : ` · ${m.why}`}` };
}

function RanWeek({ week }: { week: WaiverWeek }) {
  const nm = useContext(CastNames);
  const [fa, setFa] = useState(false);
  const [faPick, setFaPick] = useState<WaiverFace | null>(null);
  const can = week.freeAgency && (week.replace.length > 0 || week.swapsLeft > 0);
  const run = week.run;
  const mine = run?.moves.filter((m) => m.you && m.outcome === "got" && m.add) ?? [];
  const missed = run?.moves.filter((m) => m.you && m.outcome !== "got") ?? [];
  const until = week.period?.until ?? null;
  return (
    <>
      <section data-wv-week="ran" className="mt-4 px-3">
        {/* The week's result on the move's plate (step 8: every state of the week leads with the same object). */}
        <MovePlate
          due={false}
          done={mine.length > 0}
          tag="Ran"
          title={mine.length ? `You got ${names(mine.map((m) => nm(m.add!.name)))}` : "No change for you"}
          line={mine.length ? `${names(mine.map((m) => `${nm(m.add!.name)} for ${m.drop ? nm(m.drop.name) : "a spot"}`))} · waivers ran after Ep ${run?.episode ?? week.period?.episode}` : `Waivers ran after Ep ${run?.episode ?? week.period?.episode}`}
        />
      </section>
      <section className="px-4">
        {missed.map((m, i) => (
          <p key={i} className="mt-2 text-[15px] leading-snug text-muted-foreground">
            {m.why}.
          </p>
        ))}
      </section>
      {run && run.moves.some((m) => m.outcome === "got") && (
        <section className="mt-[26px] px-4">
          <SectionHead title="Everyone's moves" aside={week.shared ? undefined : "In picking order"} flush />
          <MovesList moves={run.moves.filter((m) => m.outcome === "got")} shared={week.shared} />
        </section>
      )}
      {/* Free agency while it's open: one button into its list, where the choice is made (the user, 2026-11-16). */}
      {week.freeAgency && (
        <section data-wv-fa-now className="mt-[26px] px-4">
          <SectionHead title="Free agency" aside={until ? `Until ${airTime(Date.parse(until))}` : undefined} flush />
          <p className="-mt-1 text-[14px] leading-snug text-muted-foreground">
            {week.free.length} free · first come, first served{can ? "" : " · nothing left to move this week"}
          </p>
          <Btn data-wv-fa wide className="mt-3" onClick={() => { setFaPick(null); setFa(true); }}>
            {can ? "Pick someone up" : "See who's free"}
          </Btn>
        </section>
      )}
      <FreeAgencySheet key={faPick?.id ?? "all"} open={fa} onOpenChange={setFa} week={week} pick={faPick} />
    </>
  );
}

function MovesList({ moves, shared, numbered }: { moves: WaiverMove[]; shared: boolean; numbered?: boolean }) {
  const nm = useContext(CastNames);
  return (
    <ul className="flex flex-col">
      {moves.map((m, i) => {
        const t = moveLine(m, shared, nm);
        return (
          <li key={`${m.playerId}-${m.add?.id ?? i}`} data-wv-move={m.name} className={`flex min-h-[56px] items-center gap-2.5 border-t border-border py-2 first:border-t-0 ${m.you ? "font-semibold" : ""}`}>
            {numbered && <span className="type-num w-5 text-center text-[18px] text-muted-foreground">{i + 1}</span>}
            <Avatar id={m.userId ?? m.playerId} name={m.name} size={30} />
            {m.add && <Face src={m.add.photo} name={m.add.name} className="size-9 flex-none rounded-[3px]" />}
            <span className="min-w-0 flex-1">
              <b className="block text-[15px]">{t.title}</b>
              <small className="block text-[13px] text-muted-foreground">{t.line}</small>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

// ---------- the picker: one sheet for any swap, with the Cast tab's controls ----------

function PickSheet({
  seasonId,
  couchId,
  week,
  drop,
  taken,
  onClose,
}: {
  seasonId: string;
  couchId: string | null;
  week: WaiverWeek;
  drop: WaiverFace;
  taken: string[];
  onClose: () => void;
}) {
  const nm = useContext(CastNames);
  const role = useContext(CastRoles);
  const current = week.spots.find((s) => s.dropId === drop.id)?.addIds ?? [];
  const [list, setList] = useState<string[]>(current);
  const [own, setOwn] = useState(current.length > 1);
  const [range, setRange] = useState<[number, number] | null>(null);
  const [stat, setStat] = useState("points");
  const [group, setGroup] = useState("all");
  const [busy, setBusy] = useState(false);
  const full = useSeasonStats(seasonId, couchId);
  const ranged = useSeasonStats(seasonId, couchId, range, !!range);
  const after = useAfterWaivers();
  const out = drop.out != null;
  const d = (range && ranged.data) || full.data;
  const byName = new Map((d?.cast ?? []).map((c) => [c.name, c]));
  const value = (f: WaiverFace) => {
    const c = byName.get(f.name);
    return stat === "points" ? (c?.points ?? f.points) : (c?.counts[stat] ?? 0);
  };
  const unit = stat === "points" ? "pts" : (d?.stats.find((s) => s.key === stat)?.unit ?? "");
  const pool = week.free.filter((f) => !taken.includes(f.id));
  const groups = [...new Set(pool.map((f) => f.group?.name).filter((g): g is string => !!g))].sort();
  const rows = pool.filter((f) => group === "all" || f.group?.name === group).sort((a, b) => value(b) - value(a) || b.points - a.points);
  const max = Math.max(1, ...rows.map(value));
  const through = full.data?.through ?? 0;
  const weeksOf = (f: WaiverFace) => {
    const c = byName.get(f.name);
    return c ? c.perEp.slice(-8) : [];
  };
  const weekMax = Math.max(1, ...rows.flatMap((f) => weeksOf(f).map((v) => v ?? 0)));
  const due = week.period?.due ? airTime(Date.parse(week.period.due)) : null;
  const tap = (id: string) => {
    const k = list.indexOf(id);
    if (!own || week.shared) setList(k >= 0 ? [] : [id]);
    else setList(k >= 0 ? list.filter((x) => x !== id) : [...list, id]);
  };
  const save = async (adds: string[]) => {
    setBusy(true);
    try {
      await write.pick(week.leagueId, drop.id, adds);
      await after();
      const add = pool.find((f) => f.id === adds[0]);
      toast(
        adds.length
          ? `${nm(add?.name ?? "They")} comes in for ${nm(drop.name)}${week.shared ? "" : `, unless someone ahead of you takes ${nm(add?.name ?? "them")} first`}`
          : out
            ? `Cleared${week.fallback ? `. Forget, and ${nm(drop.name)}'s spot gets the most points left` : ""}`
            : `${nm(drop.name)} stays`
      );
      onClose();
    } catch (e) {
      toast.quiet((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet
      open
      onOpenChange={(o) => !o && onClose()}
      title={`Who comes in for ${nm(drop.name)}?`}
      subtitle={`${out ? `Replaces ${nm(drop.name)}` : `Optional swap · ${nm(drop.name)} goes back to free agents`}${due ? ` · due ${due}` : ""}`}
    >
      <div data-wv-picker>
        {through > 1 && (
          <EpisodeSlider
            key={`${through}:${range ?? "all"}`}
            max={through}
            range={range ?? [1, through]}
            onChange={(r) => setRange(r[0] === 1 && r[1] === through ? null : r)}
          />
        )}
        <div className="mb-2.5 grid grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] gap-2">
          <Select label="Ranked by" value={stat} options={(d?.stats ?? [{ key: "points", name: "Points", unit: "" }]).map((s) => [s.key, s.name])} onChange={setStat} main />
          <Select label="Show" value={group} options={[["all", "Everyone free"], ...groups.map((g) => [g, g] as [string, string])]} onChange={setGroup} />
        </div>
        {rows.length ? (
          <ul className="flex flex-col">
            {rows.map((f, i) => {
              const k = list.indexOf(f.id);
              const v = value(f);
              return (
                <li key={f.id}>
                  <button
                    type="button"
                    data-fa={f.name}
                    aria-pressed={k >= 0}
                    onClick={() => tap(f.id)}
                    className={`nd-press flex w-full items-center gap-2.5 rounded-[3px] px-1.5 py-2 text-left ${k === 0 ? "bg-foreground/10 outline-2 -outline-offset-2 outline-foreground" : k > 0 ? "outline-1 -outline-offset-1 outline-input" : ""}`}
                  >
                    <span className="type-num w-6 flex-none text-center text-[18px]">
                      {k === 0 && !(own && list.length > 1) ? <Check className="mx-auto size-[18px]" strokeWidth={3} aria-hidden /> : k >= 0 ? k + 1 : i + 1}
                    </span>
                    <Face src={f.photo} name={f.name} className="size-11 flex-none rounded-[3px]" />
                    <span className="min-w-0 flex-1">
                      <b className="flex items-center gap-1.5 text-[15px]">
                        <span className="truncate">{f.name}</span>
                        {k === 0 && <span className="type-caption flex-none rounded-[2px] bg-foreground px-1 text-[11px] text-background">Your pick</span>}
                        {k > 0 && <span className="type-caption flex-none rounded-[2px] px-1 text-[11px] outline-1 -outline-offset-1 outline-input">Backup</span>}
                      </b>
                      {f.tag ? <small className="block truncate text-[12.5px] font-semibold text-good">{f.tag}</small> : <small className="block text-[12.5px] text-muted-foreground">{[role(f.name), f.group?.name].filter(Boolean).join(" · ")}</small>}
                      {stat !== "points" && (
                        <span className="mt-1 block h-1 rounded-[2px] bg-border">
                          <i className="block h-1 rounded-[2px] bg-foreground" style={{ width: `${Math.max(4, (v / max) * 100)}%` }} />
                        </span>
                      )}
                    </span>
                    {stat === "points" && <WeekBars values={weeksOf(f)} max={weekMax} />}
                    <span className="flex-none text-right">
                      <b className="type-num block text-[20px] leading-none">{Math.round(v * 10) / 10}</b>
                      <small className="text-[11px] text-muted-foreground">{unit || (v === 1 ? "time" : "times")}</small>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="rounded-[3px] bg-background p-3 text-sm text-muted-foreground">
            Nobody free fits.{" "}
            <button type="button" className="font-bold text-foreground" onClick={() => setGroup("all")}>
              Show everyone
            </button>
          </p>
        )}
        {!week.shared && (
          <button
            type="button"
            data-wv-own
            aria-pressed={own}
            onClick={() => {
              setOwn(!own);
              if (own) setList(list.slice(0, 1));
            }}
            className="mt-3 flex w-full items-center gap-3 rounded-[3px] bg-background p-3 text-left"
          >
            <span className={`relative h-6 w-10 flex-none rounded-full transition-colors ${own ? "bg-good" : "bg-secondary"}`} aria-hidden>
              <i className={`absolute top-0.5 size-5 rounded-full bg-white transition-transform ${own ? "translate-x-[18px]" : "translate-x-0.5"}`} />
            </span>
            <span>
              <b className="block text-[15px]">Choose backups</b>
              <small className="block text-[13px] text-muted-foreground">{own ? "Tap your pick first, then backups in order" : "Off: if your pick's taken, you get the best one left"}</small>
            </span>
          </button>
        )}
        <Btn data-wv-save tone="must" wide className="mt-3" disabled={!list.length || busy} onClick={() => save(list)}>
          {busy
            ? "Saving…"
            : !list.length
              ? "Choose someone"
              : own && list.length > 1
                ? `Save ${nm(pool.find((f) => f.id === list[0])?.name ?? "")} + ${list.length - 1} backup${list.length > 2 ? "s" : ""}`
                : `${nm(pool.find((f) => f.id === list[0])?.name ?? "")} comes in`}
        </Btn>
        {current.length > 0 && (
          <Btn data-wv-clear wide className="mt-2" disabled={busy} onClick={() => save([])}>
            {out ? "Clear my pick" : `Keep ${nm(drop.name)}`}
          </Btn>
        )}
      </div>
    </Sheet>
  );
}

// ---------- free agency: instant, first come, first served ----------

function FreeAgencySheet({ open, onOpenChange, week, pick = null }: { open: boolean; onOpenChange: (o: boolean) => void; week: WaiverWeek; pick?: WaiverFace | null }) {
  const nm = useContext(CastNames);
  const role = useContext(CastRoles);
  // Opened on someone (the page's Swap in): straight to who goes for them.
  const [add, setAdd] = useState<WaiverFace | null>(pick);
  const [busy, setBusy] = useState(false);
  const after = useAfterWaivers();
  const owed = week.team.filter((f) => week.replace.includes(f.id));
  const can = owed.length > 0 || week.swapsLeft > 0;
  const drops = week.team.filter((f) => week.replace.includes(f.id) || (f.out == null && week.swapsLeft > 0));
  const until = week.period?.until ? airTime(Date.parse(week.period.until)) : null;
  const go = async (drop: WaiverFace) => {
    if (!add) return;
    setBusy(true);
    try {
      await write.freeAgency(week.leagueId, add.id, drop.id);
      await after();
      toast(`${nm(add.name)}'s on your team · ${nm(drop.name)} ${drop.out != null ? "is replaced" : "is a free agent"}`);
      setAdd(null);
      onOpenChange(false);
    } catch (e) {
      toast.quiet((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        if (!o) setAdd(null);
        onOpenChange(o);
      }}
      title={add ? `Who goes for ${nm(add.name)}?` : "Free agency"}
      subtitle={add ? "They go back to free agents" : `Instant${until ? ` until ${until}` : ""} · first come, first served`}
    >
      <div data-wv-fa-sheet>
        {!add ? (
          <>
            <ul className="flex flex-col">
              {week.free.map((f) => (
                <li key={f.id} className="flex min-h-[56px] items-center gap-2.5 border-t border-border py-1.5 first:border-t-0">
                  <Face src={f.photo} name={f.name} className="size-10 flex-none rounded-[3px]" />
                  <span className="min-w-0 flex-1">
                    <b className="block text-[15px]">{f.name}</b>
                    <small className="block text-[13px] text-muted-foreground">
                      {[role(f.name), f.group?.name, `${f.points} pts`].filter(Boolean).join(" · ")}
                    </small>
                  </span>
                  {can && (
                    <Btn data-fa-add={f.name} className="h-10 px-3 text-[14px]" onClick={() => setAdd(f)}>
                      Swap in
                    </Btn>
                  )}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[13px] text-muted-foreground">
              {can ? (owed.length ? `Replace ${names(owed.map((f) => nm(f.name)))}, or use a swap.` : `${week.swapsLeft} swap${week.swapsLeft === 1 ? "" : "s"} left this week.`) : "Nothing left to move this week."}
            </p>
          </>
        ) : (
          <ul className="flex flex-col">
            {drops.map((f) => (
              <li key={f.id}>
                <button type="button" data-fa-drop={f.name} disabled={busy} onClick={() => go(f)} className="nd-press flex min-h-[56px] w-full items-center gap-2.5 border-t border-border py-1.5 text-left">
                  <Face src={f.photo} name={f.name} out={f.out != null} className="size-10 flex-none rounded-[3px]" />
                  <span className="min-w-0 flex-1">
                    <b className="block text-[15px]">{f.name}</b>
                    <small className="block text-[13px] text-muted-foreground">{f.out != null ? `Out · Episode ${f.out}` : `${f.points} pts`}</small>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Sheet>
  );
}

// ---------- How waivers work here: three answers, then when moves happen ----------

export function WaiversHow({ open, onOpenChange, how, gameName }: { open: boolean; onOpenChange: (o: boolean) => void; how: WaiverWeek["how"]; gameName: string }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="How waivers work here" subtitle={gameName}>
      <WaiversHowBody how={how} />
    </Sheet>
  );
}

/** The three answers and When moves happen (also under a game's rules on the Games tab). */
export function WaiversHowBody({ how }: { how: WaiverWeek["how"] }) {
  const L = how.lanes;
  const lane = (name: string, on: boolean[]) => (
    <div className="flex items-center gap-1">
      <span className="type-caption w-16 flex-none text-[13px] text-muted-foreground">{name}</span>
      {L.episodes.map((n, i) => (
        <i key={n} className={`h-5 flex-1 rounded-[2px] ${on[i] ? "bg-good" : "bg-secondary"} ${n <= L.now ? "opacity-50" : ""} ${n === L.now ? "outline-2 outline-foreground" : ""}`} />
      ))}
    </div>
  );
  return (
    <div data-wv-how-sheet className="flex flex-col gap-3">
        {(
          [
            ["Someone of yours voted out?", how.out],
            ["Swap someone still in?", how.swap],
            ["Two of you want the same person?", how.order],
          ] as const
        ).map(([q, a]) => (
          <div key={q} className="rounded-[3px] bg-background p-3">
            <b className="block text-[15px]">{q}</b>
            <span className="text-[14px] leading-snug text-muted-foreground">{a}</span>
          </div>
        ))}
        <p className="type-caption mt-1 text-[15px] tracking-[0.04em]">When moves happen</p>
        <div className="flex flex-col gap-1.5" data-wv-lanes>
          {lane("Replace", L.replace)}
          {lane("Swap", L.swap)}
          <div className="flex items-center gap-1">
            <span className="w-16 flex-none" />
            {L.episodes.map((n) => (
              <b key={n} className={`type-num flex-1 text-center text-[12px] ${n === L.now ? "text-foreground" : "text-muted-foreground"}`}>
                {n}
              </b>
            ))}
          </div>
        </div>
        <p className="flex items-center gap-2 text-[13px] text-muted-foreground">
          <i className="size-3 rounded-[2px] bg-good" aria-hidden />
          Open after that episode&apos;s results, until the next one airs
        </p>
        <p className="text-[13px] leading-relaxed text-muted-foreground">Picks are private until they run, then free agency until airtime. In between, teams play as they are.</p>
    </div>
  );
}

// ---------- the run plays like an episode ----------

/** The run's reveal (the mock's wvReveal): `?page=waivers-run&wv=<league>`, back closes it. Mounted on Tonight and Waivers. */
export function WaiverRunScreen({ seasonId, weeks }: { seasonId: string; weeks: WaiverWeek[] | null }) {
  const page = usePushedPage("waivers-run", ["wv"]);
  const markSeen = useMarkRunSeen(seasonId);
  const wv = useSearchParams().get("wv");
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
  const week = weeks?.find((w) => w.leagueId === wv && w.run) ?? null;
  if (!mounted) return null;
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-hidden={!page.open}
      aria-label="Waivers ran"
      className={`dark nd-fixed-x fixed inset-y-0 z-[75] flex flex-col bg-[#0b0a10] text-foreground transition-[opacity,visibility] duration-300 motion-reduce:transition-none ${page.open ? "visible opacity-100" : "invisible opacity-0"}`}
    >
      {page.open && week?.run && <RunBeats key={week.run.periodId} week={week} onSeen={() => markSeen(week.leagueId, week.run!.periodId)} onClose={page.close} />}
    </div>,
    document.body
  );
}

function Kick({ children }: { children: ReactNode }) {
  return <span className="type-caption mb-3 block text-[15px] tracking-[0.06em] text-muted-foreground">{children}</span>;
}

function RunBeats({ week, onSeen, onClose }: { week: WaiverWeek; onSeen: () => void; onClose: () => void }) {
  const nm = useContext(CastNames);
  const [k, setK] = useState(0);
  const run = week.run!;
  const mine = run.moves.filter((m) => m.you && m.outcome === "got" && m.add);
  const lost = mine.find((m) => (m.choice ?? 1) > 1 && !week.shared);
  const got = run.moves.filter((m) => m.outcome === "got");
  const beats: { key: string; node: ReactNode }[] = [
    {
      key: "open",
      node: (
        <div>
          <Kick>
            {week.gameName} · after Episode {run.episode}
          </Kick>
          <h2 className="type-caption text-[64px] leading-[.9]">
            Waivers
            <br />
            ran
          </h2>
          <p className="mt-3 text-muted-foreground">Tap anywhere to go on</p>
        </div>
      ),
    },
    ...(mine.length
      ? [
          {
            key: "yours",
            node: (
              <div>
                <Kick>{mine.length > 1 ? "Your swaps" : "You got"}</Kick>
                {mine.map((m) => (
                  <div key={m.add!.id} className="mb-3 flex items-center gap-3">
                    <Face src={m.add!.photo} name={m.add!.name} className="size-24 flex-none rounded-[4px]" />
                    <span>
                      <b className="type-caption block text-[34px] leading-[.95]">{m.add!.name}</b>
                      <small className="block text-[15px] text-muted-foreground">
                        For {m.drop ? nm(m.drop.name) : "a spot"}
                        {week.shared ? "" : ` · your ${ordinal(m.choice ?? 1)} choice`}
                      </small>
                    </span>
                  </div>
                ))}
              </div>
            ),
          },
        ]
      : []),
    ...(lost
      ? [
          {
            key: "why",
            node: (
              <div>
                <Kick>Why not your first choice</Kick>
                <p className="text-[22px] leading-snug">{lost.why.replace(/^\d+\w+ choice: /, "")}. You got the best one left.</p>
              </div>
            ),
          },
        ]
      : []),
    {
      key: "everyone",
      node: (
        <div>
          <Kick>Everyone&apos;s moves</Kick>
          {got.length ? <MovesList moves={got} shared={week.shared} /> : <p className="text-[18px] text-muted-foreground">Nobody moved this time.</p>}
        </div>
      ),
    },
    ...(week.freeAgency && week.stage === "processed"
      ? [
          {
            key: "fa",
            node: (
              <div>
                <Kick>{week.period?.until ? `Until ${airTime(Date.parse(week.period.until))}` : "Until airtime"}</Kick>
                <h2 className="type-caption text-[48px] leading-[.9]">
                  Free agency
                  <br />
                  is open
                </h2>
                <p className="mt-3 text-muted-foreground">{week.free.length ? `${names(week.free.slice(0, 2).map((f) => nm(f.name)))} ${week.free.length > 1 ? "are" : "is"} still free. ` : ""}First come, first served.</p>
              </div>
            ),
          },
        ]
      : []),
  ];
  const last = k >= beats.length - 1;
  const done = () => {
    onSeen();
    onClose();
  };
  return (
    <>
      <div className="flex h-14 flex-none items-center justify-between px-4 pt-[env(safe-area-inset-top,0px)]">
        <span className="type-caption text-[15px] tracking-[0.04em] text-muted-foreground">Waivers</span>
        {!last ? (
          <button type="button" onClick={() => setK(beats.length - 1)} className="h-11 px-2 text-[15px] font-bold">
            Skip
          </button>
        ) : (
          <button type="button" onClick={done} className="h-11 px-2 text-[15px] font-bold">
            Close
          </button>
        )}
      </div>
      <button type="button" data-stage aria-label={last ? "The last beat" : "Next"} onClick={() => !last && setK((x) => x + 1)} className="flex min-h-0 flex-1 flex-col justify-center overflow-hidden px-4 text-left">
        <div key={beats[k].key} data-beat={beats[k].key} className="nd-beat w-full">
          {beats[k].node}
        </div>
      </button>
      <div className="flex flex-none flex-col gap-2.5 px-4 pb-[calc(16px+env(safe-area-inset-bottom,0px))]">
        <div className="mb-2 flex justify-center gap-1.5" aria-hidden>
          {beats.map((b, i) => (
            <i key={b.key} className={`h-1 w-[22px] rounded-[2px] transition-colors ${i <= k ? "bg-foreground" : "bg-secondary"}`} />
          ))}
        </div>
        {last && (
          <Btn data-wv-done tone="ink" wide onClick={done}>
            Done
          </Btn>
        )}
      </div>
    </>
  );
}

/** One move as a card: who left (faded, and when) → who came in (still in, or since gone), and why where order mattered. */
function SwapCard({ m, shared }: { m: WaiverMove; shared: boolean }) {
  const nm = useContext(CastNames);
  const add = m.add!;
  const why = !shared && m.why && m.why !== "1st choice" && m.why !== "Free agency" ? m.why : m.why === "Free agency" ? "Free agency" : null;
  return (
    <li data-wv-move={m.name} className="flex items-center gap-2 rounded-[4px] bg-card py-2 pl-2 pr-2.5">
      <span className="flex min-w-0 flex-1 items-center gap-2">
        {m.drop ? (
          <>
            <Face src={m.drop.photo} name={m.drop.name} className="size-10 flex-none rounded-[3px] text-sm opacity-55 grayscale" />
            <span className="min-w-0">
              <b className="block truncate text-[15px] font-semibold text-muted-foreground">{nm(m.drop.name)}</b>
              <small className="block text-[12px] text-muted-foreground">{m.drop.out ? `Out Ep ${m.drop.out}` : m.kind === "swap" ? "Swapped out" : "Out"}</small>
            </span>
          </>
        ) : (
          <small className="text-[13px] text-muted-foreground">An open spot</small>
        )}
      </span>
      <ArrowRight className="size-4 flex-none text-muted-foreground" aria-hidden />
      <span className="flex min-w-0 flex-1 items-center gap-2">
        <Face src={add.photo} name={add.name} className="size-11 flex-none rounded-[3px] text-sm" />
        <span className="min-w-0">
          <b className="block truncate text-[15px] font-semibold">{nm(add.name)}</b>
          <small className={`block text-[12px] leading-tight ${add.out ? "text-muted-foreground" : "text-good"}`}>{add.out ? `Out Ep ${add.out}` : "Still in"}</small>
          {why && <small className="block text-[12px] leading-tight text-muted-foreground">{why}</small>}
        </span>
      </span>
    </li>
  );
}

/**
 * A run's own page, like an episode's (the mock's wvRunPage; redrawn 2026-10-31): each player's moves as cards, you first (in
 * picking order where there is one), then who made none and why. `?run=` picks the week (Episodes' rows), else the latest.
 */
export function WaiverRunPage({ weeks }: { weeks: WaiverWeek[] | null }) {
  const page = usePushedPage("waivers-ran", ["wv", "run"]);
  const params = useSearchParams();
  const wv = params.get("wv");
  const asked = params.get("run");
  const week = weeks?.find((w) => w.leagueId === wv && w.runs.length) ?? null;
  const run = (asked && week?.runs.find((r) => r.periodId === asked)) || week?.run || null;
  const { players, missed } = run ? byPlayer(run) : { players: [], missed: [] };
  const count = run ? movesIn(run) : 0;
  // The week's still going (free agency until airtime) only for the latest run, while its week is.
  const going = !!week && !!run && week.period?.id === run.periodId && week.stage === "processed";
  return (
    <PushedPage open={page.open && !!run} onClose={page.close} title={run ? `Waivers · after Episode ${run.episode}` : "Waivers"}>
      {week && run && (
        <div data-wv-run-page className="px-4 pb-12 pt-4">
          <p className="type-caption text-[14px] tracking-[0.04em]" style={{ color: gameInk(week.gameName) }}>
            {week.gameName}
          </p>
          <p className="mt-1 text-[14px] text-muted-foreground">
            Ran {airTime(Date.parse(run.at))} · {count} {count === 1 ? "move" : "moves"}
            {week.shared ? " · castaways can be on several teams, so nobody's pick was taken" : " · picks went through in picking order"}
          </p>
          {players.map((p) => (
            <section key={p.playerId} data-wv-player={p.you ? "you" : p.name} className="mt-6">
              <div className="mb-2 flex items-center gap-2.5">
                <Avatar id={p.userId ?? p.playerId} name={p.name} size={28} />
                <b className="min-w-0 flex-1 truncate text-[16px]">{p.you ? "You" : p.name}</b>
                <small className="text-[13px] text-muted-foreground">
                  {p.moves.length} {p.moves.length === 1 ? "move" : "moves"}
                </small>
              </div>
              <ul className="flex flex-col gap-1.5">
                {p.moves.map((m, i) => (
                  <SwapCard key={`${m.add!.id}-${i}`} m={m} shared={week.shared} />
                ))}
              </ul>
            </section>
          ))}
          {players.length === 0 && <p className="mt-6 text-[15px] text-muted-foreground">Nobody moved this week.</p>}
          {missed.length > 0 && (
            <p data-wv-missed className="mt-6 border-t border-border pt-3 text-[13px] leading-snug text-muted-foreground">
              No change: {missed.map((m) => `${m.you ? "you" : m.name} (${m.why.toLowerCase()})`).join(", ")}.
            </p>
          )}
          {going && (
            <p className="mt-4 flex items-center gap-1.5 text-[13px] text-muted-foreground">
              <RefreshCw className="size-3.5" aria-hidden />
              Then free agency until airtime.
            </p>
          )}
        </div>
      )}
    </PushedPage>
  );
}
