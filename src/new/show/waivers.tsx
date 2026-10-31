"use client";

import { useCallback, useState, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { ArrowLeftRight, ArrowRight, Calendar, Check, ChevronRight, CircleHelp, Play, RefreshCw, Zap } from "lucide-react";
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
import { EpisodeSlider, Select } from "./cast";
import { first } from "./moves";
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
const gotLine = (p: { you: boolean; name: string; moves: WaiverMove[] }) => {
  const one = p.moves.length === 1 ? p.moves[0] : null;
  return `${p.you ? "You" : p.name} got ${one ? `${first(one.add!.name)}${one.drop ? ` for ${first(one.drop.name)}` : ""}` : names(p.moves.map((m) => first(m.add!.name)))}`;
};

/**
 * Episodes' row for a waiver week, just above the episode that opened it (2026-10-31, the user: every week's moves where they
 * happened, at a glance, then a page of its own). A run: the game's label in its colour, what you got as a headline, your swaps as
 * faces (who left, faded, then who came in), everyone else in a line. A week still open: what's due, to the Waivers page.
 */
export function WaiverEpisodeRow({ seasonId, week, run, many }: { seasonId: string; week: WaiverWeek; run: WaiverRunView | null; many: boolean }) {
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
          {lead && <b className="mt-1 block text-base font-semibold leading-snug">{gotLine(lead)}</b>}
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
          {rest.length > 0 && <small className="mt-2 line-clamp-2 block text-[13px] leading-snug text-muted-foreground">{rest.map(gotLine).join(" · ")}</small>}
        </span>
        <ChevronRight className="mt-0.5 size-5 flex-none text-muted-foreground" aria-hidden />
      </button>
    );
  }
  return (
    <NavLink
      data-wv-ep="open"
      href={`${paths.showPage(seasonId, "waivers")}?game=${week.leagueId}`}
      className="nd-press flex min-h-[68px] w-full items-center gap-3 border-t border-border bg-[linear-gradient(90deg,rgba(255,197,49,.09),transparent)] px-2 text-left"
    >
      <span className="grid w-7 place-items-center text-chyron-line">
        <ArrowLeftRight className="size-5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <b className="block text-base font-semibold">
          {label} · after Episode {week.period?.episode}
        </b>
        <small className="mt-0.5 block text-[13px] text-muted-foreground">
          Due {week.period?.due ? airTime(Date.parse(week.period.due)) : "before airtime"} ·{" "}
          {week.replace.length ? `replace ${names(week.replace.map((id) => first(week.team.find((f) => f.id === id)?.name ?? "someone")))}` : "optional swaps"}
        </small>
      </span>
      <span className="text-[15px] font-semibold text-chyron-line">Open</span>
    </NavLink>
  );
}

/** Tonight's "Waivers ran" plate (the mock's tabTonight): a run you haven't watched, while its week is still going. */
export function WaiversRanPlate({ seasonId, show }: { seasonId: string; show: ShowData }) {
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
export function WaiverOverlays({ seasonId, show }: { seasonId: string; show: ShowData }) {
  const wv = useSeasonWaivers(seasonId, show.couch?.id ?? null, playsWaivers(show));
  return (
    <>
      <WaiverRunScreen seasonId={seasonId} weeks={wv.data?.games ?? null} />
      <WaiverRunPage weeks={wv.data?.games ?? null} />
    </>
  );
}

// ---------- the page ----------

export function WaiversScreen({ seasonId }: { seasonId: string }) {
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
            week ? (
              <>
                <ArrowLeftRight className="size-3.5" aria-hidden />
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
            <BtnLink tone="must" wide href={paths.show(seasonId)}>
              To Episode {week.revealFirst}&apos;s results
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

/** The kicker over a week's heading: when it's due, and how far off. */
function Due({ label, at }: { label: string; at: string | null }) {
  const t = at ? Date.parse(at) : null;
  const now = useNow(t != null && ticks(t));
  return (
    <div className="flex items-baseline justify-between">
      <span className="type-caption text-[15px] tracking-[0.04em] text-chyron-line">
        {label}
        {t != null ? ` ${airTime(t)}` : ""}
      </span>
      {t != null && <span className="text-[14px] tabular-nums text-muted-foreground">{calm(t, now)}</span>}
    </div>
  );
}

function OpenWeek({ seasonId, show, week }: { seasonId: string; show: ShowData; week: WaiverWeek }) {
  const [picking, setPicking] = useState<string | null>(null);
  const spots = new Map(week.spots.map((s) => [s.dropId, s.addIds]));
  const byId = new Map([...week.team, ...week.free].map((f) => [f.id, f]));
  const isOut = (f: WaiverFace) => f.out != null;
  const canReplace = (f: WaiverFace) => week.outIds.includes(f.id);
  const picked = (id: string) => (spots.get(id)?.length ?? 0) > 0;
  const open = week.replace.filter((id) => !picked(id));
  const swapSpots = week.spots.filter((s) => !week.outIds.includes(s.dropId));
  const left = Math.max(0, week.swapsLeft - swapSpots.length);
  const total = week.spots.length;
  const nameOf = (id: string) => first(byId.get(id)?.name ?? "someone");
  const head = open.length ? `Replace ${names(open.map(nameOf))}` : week.replace.length || swapSpots.length ? "Your swaps are in" : "Any swaps this week?";
  const due = week.period?.due ?? null;

  return (
    <>
      <section data-wv-week="open" className="mt-[22px] px-4">
        <Due label="Due" at={due} />
        <h2 data-wv-head className="type-caption mt-1 text-[40px] leading-[.95]">
          {head}
        </h2>
        <div className="mt-3 flex flex-wrap gap-2" data-wv-chips>
          {week.replace.map((id) => (
            <span
              key={id}
              data-chip="replace"
              className={`flex h-9 items-center gap-1.5 rounded-[3px] px-3 text-[15px] font-bold ${picked(id) ? "bg-secondary text-foreground" : "bg-chyron text-chyron-foreground"}`}
            >
              {picked(id) && <Check className="size-4" strokeWidth={3} aria-hidden />}
              Replace {nameOf(id)}
            </span>
          ))}
          {week.swapsAllowed > 0 && (
            <span data-chip="swap" className="flex h-9 items-center gap-1.5 rounded-[3px] bg-secondary px-3 text-[15px] font-bold">
              {left ? (
                `Optional · ${left} free swap${left === 1 ? "" : "s"}`
              ) : (
                <>
                  <Check className="size-4" strokeWidth={3} aria-hidden />
                  Optional swap{week.swapsAllowed > 1 ? "s" : ""} used
                </>
              )}
            </span>
          )}
        </div>
      </section>

      <section className="mt-[26px] px-4">
        <SectionHead title="Your team" aside={left ? (week.swapsAllowed >= week.team.length ? "Swap anyone" : `${left} swap${left === 1 ? "" : "s"} left`) : undefined} flush />
        <div className="flex flex-col">
          {week.team.map((f) => {
            const adds = spots.get(f.id) ?? [];
            const out = isOut(f);
            const owed = week.replace.includes(f.id);
            const can = out ? canReplace(f) : left > 0 || adds.length > 0;
            return (
              <div key={f.id} data-wv-row={f.name} className="border-t border-border py-2.5 first:border-t-0">
                <div className="flex items-center gap-3">
                  <Face src={f.photo} name={f.name} out={out} className="size-14 flex-none rounded-[3px]" />
                  <span className="min-w-0 flex-1">
                    <b className="block text-[17px] leading-tight">{f.name}</b>
                    {out ? (
                      <small className="block text-[14px] font-semibold text-live">Out · Episode {f.out}</small>
                    ) : (
                      <small className="block text-[14px] text-muted-foreground">
                        {f.points} pts{f.group ? ` · ${f.group.name}` : ""}
                      </small>
                    )}
                    {!out && f.tag && <span className="mt-1 inline-block rounded-[2px] bg-good/15 px-1.5 py-0.5 text-[12px] font-bold text-(--nd-good)">{f.tag}</span>}
                  </span>
                  {adds.length && !out ? (
                    <span className="type-caption text-[13px] tracking-[0.06em] text-muted-foreground">Going</span>
                  ) : adds.length ? null : (
                    can && (
                      <Btn
                        data-swap={f.name}
                        tone={owed ? "must" : "optional"}
                        className="h-11 min-w-[88px] px-4"
                        onClick={() => setPicking(f.id)}
                      >
                        Swap
                      </Btn>
                    )
                  )}
                </div>
                {adds.length > 0 && (
                  <button type="button" data-wv-in={f.name} onClick={() => setPicking(f.id)} className="nd-press mt-2 flex w-full items-center gap-2.5 rounded-[3px] bg-card p-2 text-left">
                    <ChevronRight className="size-4 flex-none text-muted-foreground" aria-hidden />
                    <Face src={byId.get(adds[0])?.photo ?? null} name={byId.get(adds[0])?.name} className="size-10 flex-none rounded-[3px]" />
                    <span className="min-w-0 flex-1">
                      <b className="block text-[15px]">{first(byId.get(adds[0])?.name ?? "someone")} comes in</b>
                      <small className="block text-[12.5px] text-muted-foreground">
                        {out ? `Replaces ${first(f.name)}` : "Optional swap"}
                        {!week.shared && adds.length === 1 ? " · if taken, the best one left" : ""}
                      </small>
                      {adds.length > 1 && (
                        <small className="block text-[12.5px] font-semibold">
                          Backup{adds.length > 2 ? "s" : ""}: {adds.slice(1).map(nameOf).join(", ")}
                        </small>
                      )}
                    </span>
                    <span className="text-[14px] font-bold">Change</span>
                  </button>
                )}
              </div>
            );
          })}
        </div>
        {open.length > 0 && (
          <p data-wv-fallback className="mt-3 flex items-start gap-2 text-[15px] leading-snug text-muted-foreground">
            <Zap className="mt-0.5 size-[18px] flex-none" aria-hidden />
            {week.fallback
              ? `Forget, and ${open.length === 1 ? `${nameOf(open[0])}'s spot gets` : "each open spot gets"} whoever's free with the most points.`
              : `Forget, and ${open.length === 1 ? "the spot stays" : "those spots stay"} empty.`}
          </p>
        )}
      </section>

      <Order week={week} due={due} />

      {(open.length > 0 || total > 0) && (
        <div data-wv-bar className="nd-fixed-x fixed bottom-0 z-[30] flex items-center gap-3 border-t border-border bg-background/96 px-4 pb-[calc(12px+env(safe-area-inset-bottom,0px))] pt-3 backdrop-blur-md">
          {open.length > 0 ? (
            <>
              <span className="min-w-0 flex-1">
                <small className="block text-[14px] text-muted-foreground">{open.length > 1 ? `${open.length} to replace` : `${nameOf(open[0])}'s spot is open`}</small>
                <b className="type-caption block truncate text-[24px]">Replace by {due ? airTime(Date.parse(due)) : "airtime"}</b>
              </span>
              <Btn tone="must" className="min-w-[120px]" onClick={() => setPicking(open[0])}>
                Swap
              </Btn>
            </>
          ) : (
            <>
              <span className="grid size-10 flex-none place-items-center rounded-[3px] bg-good/20 text-good">
                <Check className="size-5" strokeWidth={2.6} aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <small className="block text-[14px] text-muted-foreground">Change anything until {due ? airTime(Date.parse(due)) : "they run"}</small>
                <b className="type-caption block text-[24px]">
                  {total} swap{total === 1 ? "" : "s"} in
                </b>
              </span>
            </>
          )}
        </div>
      )}

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
    </>
  );
}

/** Picking order as faces, lowest score first (exclusive games: in a shared one nobody can take anyone from you). */
function Order({ week, due }: { week: WaiverWeek; due: string | null }) {
  if (week.shared || !week.order.length) return null;
  return (
    <section data-wv-order className="mt-[26px] px-4">
      <SectionHead title="Picking order" aside={week.orderBy === "leastPoints" ? "Lowest score first" : week.orderBy === "mostPoints" ? "Highest score first" : "Rolling"} flush />
      <ol className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(4, week.order.length)}, minmax(0, 1fr))` }}>
        {week.order.map((p, i) => (
          <li key={p.playerId} data-you={p.you || undefined} className={`flex flex-col items-center gap-1 rounded-[3px] px-1 py-2.5 ${p.you ? "bg-foreground text-background" : "bg-card"}`}>
            <span className="type-num text-[22px]">{i + 1}</span>
            <Avatar id={p.userId ?? p.playerId} name={p.name} size={34} />
            <b className="max-w-full truncate text-[15px]">{p.you ? "You" : p.name}</b>
            <small className={`text-[13px] ${p.you ? "text-background/70" : "text-muted-foreground"}`}>{p.points} pts</small>
          </li>
        ))}
      </ol>
      <p className="mt-2 text-[14px] leading-snug text-muted-foreground">Picks stay private until {due ? airTime(Date.parse(due)) : "they run"}, then go through in this order.</p>
    </section>
  );
}

function Quiet({ week }: { week: WaiverWeek }) {
  const next = week.how.lanes.episodes.find((n, i) => n > week.how.lanes.now && (week.how.lanes.swap[i] || week.how.lanes.replace[i]));
  return (
    <section data-wv-week="quiet" className="mt-[22px] px-4">
      <div className="flex items-stretch overflow-hidden rounded-[3px] bg-plate text-plate-foreground">
        <span className="type-caption tag-cut grid place-items-center bg-secondary pl-3 pr-5 text-[13px] text-foreground [--tag-slant:12px]">This week</span>
        <span className="flex-1 py-2.5 pl-2 pr-3">
          <b className="type-caption block text-[20px]">Nothing to do this week</b>
          <small className="block text-[13px] text-plate-muted">
            {week.nobodyFree ? "Nobody's free to pick up: your team plays as it is." : next ? `Next chance to move: after Episode ${next}` : "Your team plays as it is."}
          </small>
        </span>
      </div>
      {week.order.length > 0 && <Order week={week} due={null} />}
    </section>
  );
}

// ---------- after the run: who you got, everyone's moves, free agency ----------

function moveLine(m: WaiverMove, shared: boolean): { title: string; line: string } {
  const who = m.you ? "You" : m.name;
  if (m.outcome !== "got" || !m.add) return { title: `${who}: no change`, line: m.why };
  return { title: `${who} got ${first(m.add.name)}`, line: `for ${m.drop ? first(m.drop.name) : "a spot"}${shared ? "" : ` · ${m.why}`}` };
}

function RanWeek({ week }: { week: WaiverWeek }) {
  const [fa, setFa] = useState(false);
  const run = week.run;
  const mine = run?.moves.filter((m) => m.you && m.outcome === "got" && m.add) ?? [];
  const missed = run?.moves.filter((m) => m.you && m.outcome !== "got") ?? [];
  const until = week.period?.until ?? null;
  return (
    <>
      <section data-wv-week="ran" className="mt-[22px] px-4">
        <div className="flex items-baseline justify-between">
          <span className="type-caption text-[15px] tracking-[0.04em] text-good">Waivers ran</span>
          <span className="text-[14px] text-muted-foreground">After Episode {run?.episode ?? week.period?.episode}</span>
        </div>
        <h2 className="type-caption mt-1 text-[40px] leading-[.95]">
          {mine.length === 1 ? `${first(mine[0].add!.name)}'s on your team` : mine.length ? `${mine.length} swaps went through` : "No change for you"}
        </h2>
        {mine.map((m) => (
          <div key={m.add!.id} className="mt-3 flex items-center gap-3 rounded-[3px] bg-card p-2.5">
            <Face src={m.drop?.photo ?? null} name={m.drop?.name} out className="size-12 rounded-[3px]" />
            <ChevronRight className="size-5 text-muted-foreground" aria-hidden />
            <Face src={m.add!.photo} name={m.add!.name} className="size-12 rounded-[3px]" />
            <span className="min-w-0 flex-1">
              <b className="block text-[15px]">
                {first(m.add!.name)} for {m.drop ? first(m.drop.name) : "a spot"}
              </b>
              <small className="block text-[13px] text-muted-foreground">{week.shared ? "Yours" : m.why}</small>
            </span>
          </div>
        ))}
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
      {week.freeAgency && (
        <section className="mt-[26px] px-4">
          <button type="button" data-wv-fa onClick={() => setFa(true)} className="nd-press flex min-h-[60px] w-full items-center gap-3 py-2 text-left">
            <IconBox icon={Zap} />
            <span className="min-w-0 flex-1">
              <b className="block text-[15px] font-semibold">Free agency</b>
              <small className="block text-[13px] text-muted-foreground">
                {until ? `Until ${airTime(Date.parse(until))} · ` : ""}first come, first served · {week.free.length} free
              </small>
            </span>
            <ChevronRight className="size-5 text-muted-foreground" aria-hidden />
          </button>
        </section>
      )}
      <FreeAgencySheet open={fa} onOpenChange={setFa} week={week} />
    </>
  );
}

function MovesList({ moves, shared, numbered }: { moves: WaiverMove[]; shared: boolean; numbered?: boolean }) {
  return (
    <ul className="flex flex-col">
      {moves.map((m, i) => {
        const t = moveLine(m, shared);
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
          ? `${first(add?.name ?? "They")} comes in for ${first(drop.name)}${week.shared ? "" : `, unless someone ahead of you takes ${first(add?.name ?? "them")} first`}`
          : out
            ? `Cleared${week.fallback ? `. Forget, and ${first(drop.name)}'s spot gets the most points left` : ""}`
            : `${first(drop.name)} stays`
      );
      onClose();
    } catch (e) {
      toast.quiet((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const through = full.data?.through ?? 0;
  return (
    <Sheet
      open
      onOpenChange={(o) => !o && onClose()}
      title={`Who comes in for ${first(drop.name)}?`}
      subtitle={`${out ? `Replaces ${first(drop.name)}` : `Optional swap · ${first(drop.name)} goes back to free agents`}${due ? ` · due ${due}` : ""}`}
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
                    className={`nd-press flex w-full items-center gap-2.5 rounded-[3px] px-1.5 py-2 text-left ${k === 0 ? "bg-chyron/15 outline-2 -outline-offset-2 outline-chyron" : k > 0 ? "outline-1 -outline-offset-1 outline-input" : ""}`}
                  >
                    <span className="type-num w-6 flex-none text-center text-[18px]">
                      {k === 0 && !(own && list.length > 1) ? <Check className="mx-auto size-[18px]" strokeWidth={3} aria-hidden /> : k >= 0 ? k + 1 : i + 1}
                    </span>
                    <Face src={f.photo} name={f.name} className="size-11 flex-none rounded-[3px]" />
                    <span className="min-w-0 flex-1">
                      <b className="flex items-center gap-1.5 text-[15px]">
                        <span className="truncate">{f.name}</span>
                        {k === 0 && <span className="type-caption flex-none rounded-[2px] bg-chyron px-1 text-[11px] text-chyron-foreground">Your pick</span>}
                        {k > 0 && <span className="type-caption flex-none rounded-[2px] px-1 text-[11px] outline-1 -outline-offset-1 outline-input">Backup</span>}
                      </b>
                      {f.tag ? <small className="block truncate text-[12.5px] font-semibold text-good">{f.tag}</small> : <small className="block text-[12.5px] text-muted-foreground">{f.group?.name ?? ""}</small>}
                      <span className="mt-1 block h-1 rounded-[2px] bg-border">
                        <i className="block h-1 rounded-[2px] bg-foreground" style={{ width: `${Math.max(4, (v / max) * 100)}%` }} />
                      </span>
                    </span>
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
              ? "Tap someone"
              : own && list.length > 1
                ? `Save ${first(pool.find((f) => f.id === list[0])?.name ?? "")} + ${list.length - 1} backup${list.length > 2 ? "s" : ""}`
                : `${first(pool.find((f) => f.id === list[0])?.name ?? "")} comes in`}
        </Btn>
        {current.length > 0 && (
          <Btn data-wv-clear wide className="mt-2" disabled={busy} onClick={() => save([])}>
            {out ? "Clear my pick" : `Keep ${first(drop.name)}`}
          </Btn>
        )}
      </div>
    </Sheet>
  );
}

// ---------- free agency: instant, first come, first served ----------

function FreeAgencySheet({ open, onOpenChange, week }: { open: boolean; onOpenChange: (o: boolean) => void; week: WaiverWeek }) {
  const [add, setAdd] = useState<WaiverFace | null>(null);
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
      toast(`${first(add.name)}'s on your team · ${first(drop.name)} ${drop.out != null ? "is replaced" : "is a free agent"}`);
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
      title={add ? `Who goes for ${first(add.name)}?` : "Free agency"}
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
                      {[f.group?.name, `${f.points} pts`].filter(Boolean).join(" · ")}
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
              {can ? (owed.length ? `Replace ${names(owed.map((f) => first(f.name)))}, or use a swap.` : `${week.swapsLeft} swap${week.swapsLeft === 1 ? "" : "s"} left this week.`) : "Nothing left to move this week."}
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
                        For {m.drop ? first(m.drop.name) : "a spot"}
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
                <p className="mt-3 text-muted-foreground">{week.free.length ? `${names(week.free.slice(0, 2).map((f) => first(f.name)))} ${week.free.length > 1 ? "are" : "is"} still free. ` : ""}First come, first served.</p>
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
  const add = m.add!;
  const why = !shared && m.why && m.why !== "1st choice" && m.why !== "Free agency" ? m.why : m.why === "Free agency" ? "Free agency" : null;
  return (
    <li data-wv-move={m.name} className="flex items-center gap-2 rounded-[4px] bg-card py-2 pl-2 pr-2.5">
      <span className="flex min-w-0 flex-1 items-center gap-2">
        {m.drop ? (
          <>
            <Face src={m.drop.photo} name={m.drop.name} className="size-10 flex-none rounded-[3px] text-sm opacity-55 grayscale" />
            <span className="min-w-0">
              <b className="block truncate text-[15px] font-semibold text-muted-foreground">{first(m.drop.name)}</b>
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
          <b className="block truncate text-[15px] font-semibold">{first(add.name)}</b>
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
