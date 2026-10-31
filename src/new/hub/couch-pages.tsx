"use client";

import { useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ChartColumn, ChevronRight, CircleQuestionMark, Crown, Gamepad2, Grid3x3, Plus, Repeat, RotateCcw, Shield, ShieldCheck, Star, Trophy, Tv, Zap, type LucideIcon } from "lucide-react";
import { COUCH_POINTS, joinNames, leadWorthNaming, POINT_GROUPS, type PointGroup } from "@/lib/game/couch-standings";
import {
  useCouchGames,
  useCouchThisWeek,
  useCouchVerdicts,
  useMyTrivia,
  useSeasonEpisodes,
  useSeasonStats,
  useStatsFor,
  type Accolade,
  type Couch,
  type CouchHub,
  type CouchRecord,
  type Home,
  type HomeShow,
  type JoinGame,
  type Plaque,
  type RankRow,
  type SeasonStats,
  type ShowVerdict,
} from "../data";
import { JoinGameRow, JoinGameSheet } from "../couch/join-game";
import { openStartGame } from "../couch/start-game";
import { airTime, dayOf } from "../clock";
import { gameInk, ordinal } from "../games";
import { NavLink } from "../nav";
import { paths } from "../routes";
import { HubStatsPage, statBoard, statOf, unitFor, useStatsPage } from "../show/stats";
import { Face } from "../show/parts";
import { openRate } from "../show/rate";
import { openCall } from "../show/calls";
import { openPoll, pollWords } from "../show/polls";
import { openBingo } from "../show/bingo";
import { openTrivia } from "../show/trivia";
import { verdictText } from "@/lib/game/ratings";
import { Avatar } from "../ui/bars";
import { PushedPage, usePushedPage } from "../ui/page";
import { Row, SectionHead } from "../ui/parts";
import { ShowArt } from "../ui/show-bar";
import { movesByDue } from "./sections";

// More on the couch (the mock's refine.js and couchpages.js): rows on the hub, each opening a page pushed over it
// (?page=), so the back gesture closes it. Real since step 8 (Hub I), from the couch's own games as you may see them
// (couch-hub.ts): power rankings, Commercial break's games, By the numbers (cast stats since step 3, the couch's
// accolades now), Previously on (each show's story up to where you are) and the trophy shelf (once a season has ended).
// Couch verdicts are real since step 12 part 1 (the couch's ratings, ratings.ts); Commercial break's This week only has each
// show's Call it and the couch's polls since part 2 (calls.ts, polls.ts couchThisWeek), and each show's bingo card and this week's
// trivia since part 3 (bingo.ts, trivia.ts). Commercial break is called All games since 2026-10-31 (the user), with a gamepad
// for its icon; its key and ?page= stay "break".

const PAGES = {
  rankings: { title: "Power rankings", line: "Couch points: who joins in most", icon: Trophy },
  break: { title: "All games", line: "Every game on the couch · join any", icon: Gamepad2 },
  numbers: { title: "By the numbers", line: "Who leads every stat, up to where you are", icon: ChartColumn },
  verdicts: { title: "Couch verdicts", line: "How the couch rated each episode", icon: Star },
  previously: { title: "Previously on", line: "The story so far, up to where you are", icon: Tv },
  trophies: { title: "Trophy shelf", line: "Every season the couch has finished", icon: Crown },
} as const satisfies Record<string, { title: string; line: string; icon: LucideIcon }>;
type PageKey = keyof typeof PAGES;

/** "1st", "T2" (a tie keeps its T). */
const placeWord = (rank: string, place: number) => (rank.startsWith("T") ? rank : ordinal(place));

/** The shows By the numbers and Previously on cover: the ones you follow and have started (or see everything of). */
function statShows(home: Home | undefined): HomeShow[] {
  return (home?.shows ?? []).filter((s) => s.following && s.seenThrough !== 0);
}

const showLabel = (s: HomeShow) => `${s.show.name.replace(/^The /, "")}${s.seasonNumber ? ` ${s.seasonNumber}` : ""}`;

/** Where you stand in a table, in words: "You lead the couch", "You're tied 1st with riley", "You're 3rd · 12 back of riley". */
function standing(rows: RankRow[], me: string): string | null {
  const mine = rows.find((r) => r.userId === me);
  if (!mine) return null;
  const level = rows.filter((r) => r.userId !== me && r.total === mine.total);
  if (level.length) return `You're tied ${ordinal(mine.place)} with ${level.map((r) => r.name).join(" and ")}`;
  if (mine.place === 1) return "You lead the couch";
  return `You're ${ordinal(mine.place)} · ${rows[0].total - mine.total} back of ${rows[0].name}`;
}

/** What each row says now: your place in Couch points (this year's once there's a year before it), your games, your titles. */
function rowLines(home: Home, hub: CouchHub | undefined): Partial<Record<PageKey, string>> {
  const r = hub?.rankings;
  const said = r ? standing(r.year ?? r.all, home.user.id) : null;
  const n = hub?.games.filter((g) => !g.ended).length ?? 0;
  const t = hub?.trophies;
  const rated = hub?.taste.shows ?? 0;
  return {
    verdicts: rated ? `How the couch rated ${rated} ${rated === 1 ? "show" : "shows"}` : undefined,
    rankings: said ? (said === "You lead the couch" && r?.year ? "You lead the couch this year" : said) : undefined,
    break: hub ? (n ? `${n} ${n === 1 ? "game" : "games"} you're in · join any` : undefined) : undefined,
    trophies: t ? `${t.titles} ${t.titles === 1 ? "title" : "titles"} · ${t.seasons} ${t.seasons === 1 ? "season" : "seasons"} played` : undefined,
  };
}

function MoreRow({ k, line }: { k: PageKey; line?: string }) {
  const page = usePushedPage(k);
  const p = PAGES[k];
  return (
    <span data-more={k} className="contents">
      <Row icon={p.icon} title={p.title} detail={line ?? p.line} onClick={page.show} />
    </span>
  );
}

/**
 * The rows, each only once it has something: power rankings once there's a couch (joining it is Couch points), Previously on once you've
 * started a show, the trophy shelf once a season the couch played has ended.
 */
export function MoreOnTheCouch({ home, hub }: { home: Home; hub: CouchHub | undefined }) {
  const lines = rowLines(home, hub);
  const started = statShows(home).length > 0;
  const keys: PageKey[] = [
    ...(hub?.rankings ? (["rankings"] as const) : []),
    "break",
    "numbers",
    "verdicts",
    ...(started ? (["previously"] as const) : []),
    ...(hub?.trophies ? (["trophies"] as const) : []),
  ];
  return (
    <section className="mt-8">
      <SectionHead title="More on the couch" aside="When you want it" />
      <div className="flex flex-col border-b border-border px-4">
        {keys.map((k) => (
          <MoreRow key={k} k={k} line={lines[k]} />
        ))}
      </div>
    </section>
  );
}

function CouchPage({ k, children }: { k: PageKey; children: ReactNode }) {
  const page = usePushedPage(k);
  return (
    <PushedPage open={page.open} onClose={page.close} title={PAGES[k].title} back="Home">
      <div data-couch-page={k} className="mb-10 mt-3 pb-4">
        {children}
      </div>
    </PushedPage>
  );
}

/** The pages, mounted with the hub (each opens over it), and the stats page By the numbers opens. */
export function CouchPages({ home, couch, hub }: { home: Home | undefined; couch: Couch | null; hub: CouchHub | undefined }) {
  const shows = statShows(home);
  return (
    <>
      <CouchPage k="rankings">
        <RankingsPage hub={hub} me={home?.user.id ?? ""} />
      </CouchPage>
      <CouchPage k="break">
        <CommercialBreak hub={hub} home={home} couch={couch} />
      </CouchPage>
      <CouchPage k="numbers">
        <ByTheNumbers shows={shows} couch={couch} accolades={hub?.accolades ?? null} />
      </CouchPage>
      <HubStatsPage couchId={couch?.id ?? null} names={new Map(shows.map((s) => [s.seasonId, s.show.name]))} />
      <CouchPage k="verdicts">
        <Verdicts couch={couch} hub={hub} />
      </CouchPage>
      <CouchPage k="previously">
        <PreviouslyOn shows={shows} couch={couch} />
      </CouchPage>
      <CouchPage k="trophies">
        <TrophyShelf hub={hub} me={home?.user.id ?? ""} couchId={couch?.id ?? null} />
      </CouchPage>
    </>
  );
}

// ---------- shared ----------

function BigHero({ big, label, line }: { big: ReactNode; label: string; line: ReactNode }) {
  return (
    <section className="flex items-end gap-3.5 px-3 pb-1.5 pt-5" data-hero>
      <b className="type-num flex-none text-[112px] leading-[.78] tracking-[-0.01em]">{big}</b>
      <div>
        <span className="type-caption block text-sm tracking-[0.06em] text-muted-foreground">{label}</span>
        <p className="mt-1.5 max-w-[28ch] text-[15px] leading-snug">{line}</p>
      </div>
    </section>
  );
}

function SpoilerSafe() {
  return (
    <div className="mx-3 mt-3.5 flex items-center gap-2 rounded-[3px] bg-good/10 px-3 py-[9px] text-[13px]">
      <ShieldCheck className="size-[15px] flex-none text-good" aria-hidden />
      <span>
        <b className="text-good">Spoiler-safe</b> · up to where you are in each show
      </span>
    </div>
  );
}

function How({ icon: Icon, lead, children }: { icon: LucideIcon; lead: string; children: ReactNode }) {
  return (
    <div className="mx-3 mt-6 flex items-start gap-3 rounded-[4px] bg-card p-3.5">
      <Icon className="mt-0.5 size-5 flex-none text-muted-foreground" aria-hidden />
      <p className="text-sm leading-normal text-muted-foreground">
        <b className="text-foreground">{lead}</b> {children}
      </p>
    </div>
  );
}

function Loading() {
  return (
    <div aria-busy className="animate-pulse px-3 pt-5">
      <div className="h-[90px] w-1/2 rounded-[4px] bg-card" />
      <div className="mt-6 h-[180px] rounded-[4px] bg-card" />
    </div>
  );
}

function Empty({ icon: Icon, title, line }: { icon: LucideIcon; title: string; line: string }) {
  return (
    <div className="mx-3 mt-6 flex items-start gap-3 rounded-[4px] bg-card p-4">
      <Icon className="mt-0.5 size-6 flex-none text-muted-foreground" aria-hidden />
      <span>
        <b className="block text-base">{title}</b>
        <small className="mt-0.5 block text-[13px] leading-snug text-muted-foreground">{line}</small>
      </span>
    </div>
  );
}

// ---------- Power rankings ----------

/** The bar's colour for each kind of joining in (the chart set). */
const GROUP_COLOURS: Record<PointGroup, string> = { play: "#f2804b", watch: "#5089c9", talk: "#a76bb0", here: "#35b5a5" };

/** A row's points by group, in the bar's order. */
const byGroup = (row: RankRow) =>
  POINT_GROUPS.map(({ group }) => ({ group, points: row.byKind.filter((k) => COUCH_POINTS.find((p) => p.kind === k.kind)?.group === group).reduce((n, k) => n + k.points, 0) })).filter((g) => g.points > 0);

function RankList({ rows, me }: { rows: RankRow[]; me: string }) {
  const max = rows[0]?.total ?? 0;
  const groups = POINT_GROUPS.filter(({ group }) => rows.some((row) => byGroup(row).some((g) => g.group === group)));
  return (
    <div className="px-3">
      {rows.map((row) => {
        const mine = row.userId === me;
        return (
          <div key={row.userId} data-rank-row={row.name} data-rank={row.rank} className={`flex h-[58px] items-center gap-3 ${mine ? "-mx-2 rounded-[3px] bg-plate px-2 text-plate-foreground" : ""}`}>
            <span className={`type-num w-7 text-[22px] ${row.place === 1 || mine ? "" : "text-muted-foreground"}`}>{row.rank}</span>
            <Avatar id={row.userId} name={row.name} size={30} />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5 text-[15px] font-semibold">
                <span className="truncate">{row.name}</span>
                {mine && <span className="type-caption rounded-[2px] bg-plate-foreground px-1.5 py-0.5 text-[10px] text-plate">You</span>}
                {row.move && (
                  <span data-move={row.move} className={`ml-auto ${row.move === "up" ? "text-good" : mine ? "text-plate-muted" : "text-muted-foreground"}`} aria-label={row.move === "up" ? "Up since last week" : "Down since last week"}>
                    {row.move === "up" ? <ArrowUp className="size-3.5" strokeWidth={2.5} aria-hidden /> : <ArrowDown className="size-3.5" strokeWidth={2.5} aria-hidden />}
                  </span>
                )}
              </span>
              <span className="mt-1.5 flex h-1 overflow-hidden rounded-full" style={{ width: `${max ? (row.total / max) * 100 : 0}%` }}>
                {byGroup(row).map((g) => (
                  <i key={g.group} className="block h-full" style={{ width: `${row.total ? (g.points / row.total) * 100 : 0}%`, background: GROUP_COLOURS[g.group] }} />
                ))}
              </span>
            </span>
            <b className="type-num text-[24px]">{row.total}</b>
          </div>
        );
      })}
      <div className="mt-3 flex flex-wrap gap-x-3.5 gap-y-1.5 text-xs text-muted-foreground" data-rank-legend>
        {groups.map(({ group, name }) => (
          <span key={group} className="flex items-center gap-1.5">
            <i className="size-2.5 rounded-[2px]" style={{ background: GROUP_COLOURS[group] }} aria-hidden />
            {name}
          </span>
        ))}
      </div>
    </div>
  );
}

/** COUCH_POINTS by what each is worth, most first: How you earn them. */
const TIERS = [...new Set(COUCH_POINTS.map((p) => p.points as number))].map((points) => ({ points, ways: COUCH_POINTS.filter((p) => p.points === points) }));

function HowYouEarn() {
  return (
    <section className="mt-8 px-3" data-how-earn>
      <SectionHead title="How you earn them" aside="Points each" flush />
      {TIERS.map(({ points, ways }) => (
        <div key={points} data-earn={points} className="flex gap-3 border-t border-border py-3">
          <b className="type-num w-8 flex-none text-[26px] leading-none">{points}</b>
          <ul className="min-w-0 flex-1 space-y-1 text-[15px] leading-snug">
            {ways.map((w) => (
              <li key={w.kind}>
                {w.says}
                {"cap" in w && <span className="text-muted-foreground"> · up to {w.cap}</span>}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}

/** Couch points (this year, once the couch has a year before it, and all time), your place as the big number; head to head
 *  against each of them from the games. */
function RankingsPage({ hub, me }: { hub: CouchHub | undefined; me: string }) {
  const [picked, setTab] = useState<"year" | "all" | "h2h" | null>(null);
  if (!hub) return <Loading />;
  const r = hub.rankings;
  if (!r) return <Empty icon={Trophy} title="No Couch points yet" line="Everyone earns them by joining in: playing, watching and talking on the couch." />;
  // This year only once the couch has done something before it; till then it opens on all time.
  const tab = picked === "h2h" || picked === "all" || (picked === "year" && r.year) ? picked : r.year ? "year" : "all";
  const rows = (tab === "year" && r.year) || r.all;
  const mine = rows.find((x) => x.userId === me);
  const lead = rows[0];
  const won = r.h2h.reduce((n, h) => n + h.won, 0);
  const lost = r.h2h.reduce((n, h) => n + h.lost, 0);
  const said = standing(rows, me);
  const gap = mine && lead ? lead.total - mine.total : 0;
  const week = mine?.week ? ` +${mine.week} this week.` : "";
  const tabs = [...(r.year ? ([["year", "This year"]] as const) : []), ["all", "All time"], ["h2h", "Head to head"]] as const;
  return (
    <>
      {tab === "h2h" ? (
        <BigHero big={`${won}–${lost}`} label="Head to head" line={r.h2h.length ? "Every game you've both played: how often you finished above each of them." : "Nobody else plays a game with you yet."} />
      ) : mine ? (
        <BigHero
          big={placeWord(mine.rank, mine.place)}
          label={`Couch points${tab === "year" ? " this year" : ""} · of ${rows.length}`}
          line={
            !said || said.startsWith("You lead") || said.startsWith("You're tied")
              ? `${said ?? "You lead the couch"}.${week}`
              : `${gap} back of ${lead.name}.${week || " A move or a rating gets you going."}`
          }
        />
      ) : (
        <BigHero big="–" label="Couch points" line="You're not on this couch's table." />
      )}
      <div role="tablist" className={`mx-3 mb-1 mt-4 grid gap-1 rounded-[3px] bg-card p-1 ${tabs.length === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
        {tabs.map(([k, label]) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={tab === k}
            data-rank-tab={k}
            onClick={() => setTab(k)}
            className={`grid h-9 place-items-center rounded-[2px] text-sm font-semibold ${tab === k ? "bg-foreground text-background" : "text-muted-foreground"}`}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "h2h" ? (
        <div className="px-3">
          {r.h2h.map((h) => (
            <div key={h.userId} data-h2h={h.name} className="flex h-[58px] items-center gap-3 border-t border-border first:border-t-0">
              <Avatar id={h.userId} name={h.name} size={30} />
              <span className="min-w-0 flex-1">
                <b className="block truncate text-[15px]">{h.name}</b>
                <small className="block text-[12.5px] text-muted-foreground">
                  in {h.games} {h.games === 1 ? "game" : "games"}
                  {h.tied ? ` · ${h.tied} level` : ""}
                </small>
              </span>
              <b className={`type-num text-[24px] ${h.won > h.lost ? "text-good" : ""}`}>
                {h.won}–{h.lost}
              </b>
            </div>
          ))}
        </div>
      ) : (
        <>
          <p className="mx-3 mb-1 mt-2.5 text-[13px] leading-snug text-muted-foreground" data-rank-explainer>
            Points for joining in, not for winning.
          </p>
          <RankList rows={rows} me={me} />
          <HowYouEarn />
        </>
      )}
    </>
  );
}

// ---------- Commercial break ----------


/** A This week only card: the show's art, an icon, what it is and a line (the mock's .cb-card.ep). */
function WeekCard({ seasonId, artUrl, name, icon: Icon, title, line, onClick, ...rest }: { seasonId: string; artUrl: string | null; name: string; icon: LucideIcon; title: string; line: string; onClick?: () => void } & Record<`data-${string}`, string>) {
  return (
    <button type="button" onClick={onClick} {...rest} className="nd-press relative isolate flex aspect-[1/1.05] flex-col justify-end overflow-hidden rounded-[4px] p-2.5 text-left text-white">
      <ShowArt seasonId={seasonId} artUrl={artUrl} name={name} className="absolute inset-0 -z-[2] size-full" />
      <span aria-hidden className="absolute inset-0 -z-[1] bg-[linear-gradient(180deg,rgba(16,14,21,.2),rgba(16,14,21,.92)_70%)]" />
      <span className="absolute left-2.5 top-2.5 grid size-[34px] place-items-center rounded-[3px] bg-plate text-plate-foreground">
        <Icon className="size-[18px]" aria-hidden />
      </span>
      <b className="type-caption text-[19px] leading-none [overflow-wrap:anywhere]">{title}</b>
      <small className="mt-1 text-xs opacity-85">{line}</small>
    </button>
  );
}

function CommercialBreak({ hub, home, couch }: { hub: CouchHub | undefined; home: Home | undefined; couch: Couch | null }) {
  const moves = movesByDue(home?.moves ?? []);
  // This week only (step 12): each of your shows' bingo card and Call it, the couch's polls, this week's trivia; read when the page
  // opens.
  const week = useCouchThisWeek(couch?.id ?? null);
  const trivia = useMyTrivia(couch?.id ?? null);
  const artOf = (seasonId: string) => week.data?.shows.find((s) => s.seasonId === seasonId)?.artUrl ?? home?.shows.find((s) => s.seasonId === seasonId)?.show.artUrl ?? null;
  const playing = hub?.games.filter((g) => !g.ended) ?? [];
  // Games on the couch you're not in (step 9): join, ask, or see it's closed.
  const all = useCouchGames(couch?.id ?? null);
  const others = (all.data?.games ?? []).filter((g) => !g.ended && !g.you?.playing);
  const [joining, setJoining] = useState<JoinGame | null>(null);
  const labelOf = (seasonId: string | null) => all.data?.seasons.find((s) => s.seasonId === seasonId);
  return (
    <>
      <section className="relative mb-1 flex h-[190px] items-end">
        <span className="absolute inset-0 grid grid-cols-7" aria-hidden>
          {["#f4f2f8", "#e0b23a", "#35b5a5", "#a76bb0", "#f2545b", "#5089c9", "#f2804b"].map((c) => (
            <i key={c} style={{ background: c }} />
          ))}
        </span>
        <div className="relative mx-3 mb-4 rounded-[3px] bg-plate px-3.5 py-2.5 text-plate-foreground shadow-plate">
          <b className="type-caption block text-[34px]">All games</b>
          <small className="mt-1 block text-[13px] text-plate-muted">Every game on the couch. Join any, or none.</small>
        </div>
      </section>
      <section className="mt-6 px-3">
        <SectionHead title="You're playing" aside={hub ? `${playing.length} ${playing.length === 1 ? "game" : "games"}` : undefined} flush />
        {!hub ? (
          <div className="h-[72px] animate-pulse rounded-[4px] bg-card" aria-busy />
        ) : playing.length ? (
          playing.map((g) => {
            const due = moves.find((m) => m.leagueId === g.leagueId);
            return (
              <NavLink key={g.leagueId} data-playing={g.leagueId} href={paths.show(g.seasonId, "games")} className="nd-press flex min-h-[72px] items-center gap-3 border-t border-border last:border-b">
                <ShowArt seasonId={g.seasonId} artUrl={g.artUrl} name={g.label} className="size-[54px] flex-none rounded-[3px]" />
                <span className="min-w-0 flex-1">
                  <span className="type-caption text-xs tracking-[0.05em]" style={{ color: gameInk(g.gameName) }}>
                    {g.gameName}
                  </span>
                  <b className="mt-[3px] block truncate text-base">{g.label}</b>
                  <small className="mt-0.5 block truncate text-[12.5px] text-muted-foreground">{due ? due.text : `${g.name} · ${g.of} playing`}</small>
                </span>
                {due ? (
                  <span className="type-caption flex-none bg-chyron py-[5px] pl-2 pr-3.5 text-xs tracking-[0.06em] text-chyron-foreground [clip-path:polygon(0_0,100%_0,calc(100%_-_8px)_100%,0_100%)]">
                    {due.deadline ? `Due ${dayOf(Date.parse(due.deadline))}` : "Due"}
                  </span>
                ) : (
                  <b className="type-num text-[30px]">{g.rank ? placeWord(g.rank, Number(g.rank.replace(/^T/, ""))) : "–"}</b>
                )}
              </NavLink>
            );
          })
        ) : (
          <p className="text-sm leading-normal text-muted-foreground">Nothing yet. A game on the couch is one tap to join once someone starts one.</p>
        )}
      </section>
      {couch && others.length > 0 && (
        <section className="mt-6 px-3" data-break-join>
          <SectionHead title="Join a game" aside={`${others.length} ${others.length === 1 ? "game" : "games"}`} flush />
          {others.map((g) => {
            const s = labelOf(g.seasonId);
            return (
              <div key={g.leagueId}>
                {s && <small className="mt-2 block text-[12.5px] font-semibold text-muted-foreground">{`${s.name.replace(/^The /, "")}${s.seasonNumber ? ` ${s.seasonNumber}` : ""}`}</small>}
                <JoinGameRow couchId={couch.id} g={g} onJoin={setJoining} />
              </div>
            );
          })}
          <JoinGameSheet couchId={couch.id} game={joining} onOpenChange={(o) => !o && setJoining(null)} />
        </section>
      )}
      <section className="mt-6 px-3">
        <SectionHead title="This week only" aside="One night each" flush />
        <div className="grid grid-cols-2 gap-2 p-1" data-break-week>
          {(week.data?.shows ?? [])
            .filter((s) => s.bingo)
            .map((s) => {
              const b = s.bingo!;
              return (
                <WeekCard
                  key={`bingo-${s.seasonId}`}
                  data-week-bingo={s.seasonId}
                  seasonId={s.seasonId}
                  artUrl={s.artUrl}
                  name={s.label}
                  icon={Grid3x3}
                  title={`Episode ${b.episode} bingo`}
                  line={b.open ? `${s.label} · ${b.ticked ? `${b.ticked} ticked` : "tap squares as it happens"}` : `${s.label} · opens ${b.airsAt ? airTime(Date.parse(b.airsAt)) : "at airtime"}`}
                  onClick={() => openBingo({ seasonId: s.seasonId, couchId: couch?.id ?? null, episode: b.episode, label: s.label, solo: false })}
                />
              );
            })}
          {(week.data?.shows ?? [])
            .filter((s) => s.calls)
            .map((s) => (
              <WeekCard
                key={`call-${s.seasonId}`}
                data-week-call={s.seasonId}
                seasonId={s.seasonId}
                artUrl={s.artUrl}
                name={s.label}
                icon={CircleQuestionMark}
                title={s.calls!.made === s.calls!.of ? "Called it" : "Call it"}
                line={`${s.label} · Episode ${s.episode} · ${s.calls!.made === s.calls!.of ? "change until" : "closes"} ${airTime(Date.parse(s.airAt))}`}
                onClick={() => openCall({ seasonId: s.seasonId, couchId: couch?.id ?? null, episode: s.episode, label: s.label, solo: false })}
              />
            ))}
          {couch &&
            (week.data?.polls ?? []).map((p) => (
              <WeekCard
                key={p.id}
                data-week-poll={p.id}
                seasonId={p.seasonId}
                artUrl={artOf(p.seasonId)}
                name={p.label}
                icon={ChartColumn}
                title={p.question}
                line={pollWords(p).line}
                onClick={() => openPoll({ kind: "vote", seasonId: p.seasonId, couchId: couch.id, pollId: p.id })}
              />
            ))}
          {(trivia.data?.rounds ?? []).map((r) => (
            <WeekCard
              key={`trivia-${r.showId}`}
              data-week-trivia={r.showId}
              seasonId={r.seasonId}
              artUrl={r.artUrl ?? artOf(r.seasonId)}
              name={r.title}
              icon={CircleQuestionMark}
              title={r.title}
              line={r.played ? `You got ${r.played.score} of ${r.played.of}${r.best ? ` · ${r.best.name} got ${r.best.score}` : ""}` : `${r.questions} questions${r.best ? ` · ${r.best.name} got ${r.best.score}` : ""}`}
              onClick={() => openTrivia({ seasonId: r.seasonId, couchId: couch?.id ?? null })}
            />
          ))}
        </div>
        {week.data && trivia.data && !week.data.shows.some((s) => s.bingo || s.calls) && !week.data.polls.length && !trivia.data.rounds.length && (
          <p className="px-1 text-sm leading-normal text-muted-foreground" data-break-week-none>
            Nothing this week: your shows&apos; bingo cards and calls come with their next episodes.
          </p>
        )}
        <button
          type="button"
          data-break-start
          onClick={() => openStartGame({ couchId: couch?.id ?? null })}
          className="nd-press mt-6 flex w-full items-center gap-3 rounded-[4px] p-4 text-left outline-[1.5px] -outline-offset-[1.5px] outline-dashed outline-input"
        >
          <Plus className="size-6 flex-none" aria-hidden />
          <span>
            <b className="block text-base">Start a game</b>
            <small className="mt-0.5 block text-[13px] text-muted-foreground">A season game on any of your shows. Anyone on the couch can.</small>
          </span>
        </button>
      </section>
    </>
  );
}

// ---------- By the numbers ----------

/** One stat card: a leader's photo, the show, the stat, their name and count. */
function StatCard({
  photo,
  chip,
  stat,
  who,
  line,
  n,
  onClick,
  className = "w-[calc(100%-44px)] flex-none snap-center",
  ...rest
}: {
  photo: ReactNode;
  chip: ReactNode;
  stat: string;
  who: string;
  line: string;
  n?: number;
  onClick?: () => void;
  className?: string;
  "data-accolade"?: string;
  "data-deck-stat"?: string;
}) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      {...(onClick ? { type: "button" as const, onClick } : {})}
      {...rest}
      className={`relative block aspect-[3/3.7] overflow-hidden rounded-[4px] bg-card text-left text-white shadow-[0_14px_34px_rgba(0,0,0,.45)] ${className}`}
    >
      {photo}
      <span className="absolute left-2.5 top-2.5 flex items-center gap-1.5 rounded-[3px] bg-[rgba(16,14,21,.75)] py-1 pl-1 pr-2 text-xs font-bold">{chip}</span>
      <span className="type-caption absolute bottom-[86px] left-0 max-w-[92%] bg-secondary py-[7px] pl-3 pr-[22px] text-[15px] tracking-[0.05em] [clip-path:polygon(0_0,100%_0,calc(100%_-_12px)_100%,0_100%)]">
        {stat}
      </span>
      <span className="absolute inset-x-0 bottom-0 flex min-h-[86px] items-end gap-3 bg-plate px-3.5 py-2.5 text-plate-foreground">
        <span className="min-w-0 flex-1">
          <b className="type-caption block truncate text-[32px] leading-none">{who}</b>
          <small className="mt-1 block text-[13px] text-plate-muted">{line}</small>
        </span>
        {n != null && <span className="type-num text-[64px] leading-[.8]">{n}</span>}
      </span>
    </Tag>
  );
}

function AccoladeCard({ a, className }: { a: Accolade; className?: string }) {
  return (
    <StatCard
      data-accolade={a.key}
      className={className}
      photo={
        <span className="absolute inset-x-0 bottom-[86px] top-0 grid place-items-center bg-[linear-gradient(160deg,var(--secondary),var(--background))] text-muted-foreground">
          <Crown className="size-[88px]" strokeWidth={1.2} aria-hidden />
        </span>
      }
      chip="On the couch"
      stat={a.stat}
      who={a.who}
      line={a.line}
    />
  );
}

/** Two sharing a lead in one 38px square, a half each, so the row's words stay in line with a lone leader's. `face` draws one at
 *  38px; its half shows the middle of it. */
function Pair<T>({ two, face }: { two: T[]; face: (item: T) => ReactNode }) {
  return (
    <span aria-hidden data-faces={two.length} className="grid size-[38px] flex-none grid-cols-2 gap-0.5 overflow-hidden rounded-[3px]">
      {two.map((item, i) => (
        <span key={i} className="relative overflow-hidden">
          <span className="absolute left-1/2 top-0 -translate-x-1/2">{face(item)}</span>
        </span>
      ))}
    </span>
  );
}

/** Today's couch accolades for the deck: "now and then", so one or two, a different pair each day. */
function todays(accolades: Accolade[]): Accolade[] {
  if (accolades.length <= 2) return accolades;
  const day = Math.floor(Date.now() / 86_400_000);
  return [0, 1].map((i) => accolades[(day + i) % accolades.length]);
}

/** By the numbers: a deck of stat cards (each show's leaders, a couch accolade or two), then every stat by show, each
 *  opening that show's stats page sorted by it, then the couch's accolades. Spoiler-safe: every number is counted up to
 *  where you are in each show (and the accolades from your copy of each game). */
function ByTheNumbers({ shows, couch, accolades }: { shows: HomeShow[]; couch: Couch | null; accolades: Accolade[] | null }) {
  const reads = useStatsFor(
    shows.map((s) => s.seasonId),
    couch?.id ?? null
  );
  const page = useStatsPage();
  const counted = shows
    .map((s, i) => ({ s, d: reads[i]?.data }))
    .filter((x): x is { s: HomeShow; d: SeasonStats } => !!x.d && x.d.through > 0 && x.d.stats.length > 1);
  // The deck: each show's featured stats with one leader alone on two or more (a headline names one person, so never a tie), a
  // show at a time, five at most.
  const decks = counted.map(({ s, d }) =>
    d.featured
      .map((key) => ({ s, stat: statOf(d, key), board: statBoard(d, key) }))
      .filter(({ board }) => board[0]?.n >= 2 && (board[1]?.n ?? 0) < board[0].n)
      .map(({ s, stat, board }) => ({ s, stat, top: board[0] }))
  );
  const deck = Array.from({ length: Math.max(0, ...decks.map((x) => x.length)) }, (_, i) => decks.map((x) => x[i]).filter(Boolean))
    .flat()
    .slice(0, 5);
  const couchCards = todays((accolades ?? []).filter((a) => !a.tied));
  const loading = reads.some((r) => r.isPending && r.fetchStatus !== "idle") || accolades === null;
  const cards: ReactNode[] = deck.map(({ s, stat, top }) => (
    <StatCard
      key={`${s.seasonId}-${stat.key}`}
      data-deck-stat={`${s.seasonId}:${stat.key}`}
      onClick={() => page.openAt(stat.key, s.seasonId)}
      photo={
        top.c.photo ? (
          // eslint-disable-next-line @next/next/no-img-element -- cast photos come from anywhere a show's cast was imported from
          <img src={top.c.photo} alt="" className="absolute inset-0 size-full object-cover [object-position:center_20%]" />
        ) : (
          <span className="absolute inset-x-0 bottom-[86px] top-0 bg-[linear-gradient(160deg,var(--secondary),var(--background))]" />
        )
      }
      chip={
        <>
          {s.show.artUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- show art from the catalog
            <img src={s.show.artUrl} alt="" className="size-[22px] rounded-[2px] object-cover" />
          )}
          {showLabel(s)}
        </>
      }
      stat={stat.name}
      who={top.c.first}
      line={`${unitFor(stat.unit, top.n) || "so far"} · see everyone`}
      n={top.n}
    />
  ));
  // A couch card third (the mock's deck.splice(2, 0, …)), the other at the end.
  couchCards.forEach((a, i) => cards.splice(i === 0 ? Math.min(2, cards.length) : cards.length, 0, <AccoladeCard key={`couch-${a.key}`} a={a} className="w-[calc(100%-44px)] flex-none snap-center" />));
  return (
    <>
      <SpoilerSafe />
      {/* Drawn once the shows' stats are in: a snapping row keeps to the card it first snapped to, so a card arriving
          ahead of it would open the deck part-way along. */}
      {loading ? (
        <div className="mx-3 mt-3.5 aspect-[3/3.7] w-[calc(100%-44px)] animate-pulse rounded-[4px] bg-card" aria-busy />
      ) : (
        cards.length > 0 && (
          <div className="flex snap-x snap-mandatory gap-2.5 overflow-x-auto px-3 pb-1 pt-3.5 [scrollbar-width:none]" data-stat-deck>
            {cards}
          </div>
        )
      )}
      {!loading && !counted.length && (
        <p className="mx-3 mt-6 text-sm leading-normal text-muted-foreground">Cast stats fill in as you watch: every number is counted up to the episode you&apos;re on in each show.</p>
      )}
      {counted.map(({ s, d }) => {
        // Each stat's lead, named only when it says something (leadWorthNaming, the season's cast the field); the rest fold into
        // one line that opens every stat.
        const leads = d.stats
          .filter((st) => st.key !== "points")
          .map((st) => {
            const board = statBoard(d, st.key);
            return { st, top: board.filter((r) => r.n === board[0]?.n) };
          })
          .filter((r) => r.top.length);
        const named = leads.filter((r) => leadWorthNaming(r.top.length, r.top[0].n, d.cast.length));
        const unnamed = leads.length - named.length;
        return (
          <section key={s.seasonId} className="mt-6 px-3" data-numbers-show={s.seasonId}>
            <SectionHead title={showLabel(s)} aside={`Up to Ep ${d.through}`} flush />
            {named.map(({ st, top }) => (
              <button
                key={st.key}
                type="button"
                data-numbers-row={st.key}
                data-leaders={top.length}
                onClick={() => page.openAt(st.key, s.seasonId)}
                className="flex min-h-[58px] w-full items-center gap-3 border-t border-border text-left"
              >
                {top.length === 1 ? (
                  <Face src={top[0].c.photo} name={top[0].c.first} className="size-[38px] flex-none rounded-[3px]" />
                ) : (
                  <Pair two={top.map((r) => r.c)} face={(c) => <Face src={c.photo} name={c.first} className="block size-[38px]" />} />
                )}
                <span className="min-w-0 flex-1">
                  <b className="block text-[15px] leading-snug">{st.name}</b>
                  <small className="block text-[12.5px] leading-snug text-muted-foreground" data-numbers-who>
                    {top.length === 1 ? `${top[0].c.first} leads` : `${joinNames(top.map((r) => r.c.first))} lead`}
                  </small>
                </span>
                <b className="type-num text-[24px]">{top[0].n}</b>
                <ChevronRight className="size-5 flex-none text-muted-foreground" aria-hidden />
              </button>
            ))}
            {unnamed > 0 && (
              <button
                type="button"
                data-numbers-more={unnamed}
                onClick={() => page.openAt(null, s.seasonId)}
                className="flex min-h-12 w-full items-center gap-3 border-t border-border text-left text-[13px] text-muted-foreground"
              >
                <span className="min-w-0 flex-1">
                  {unnamed} more {unnamed === 1 ? "stat" : "stats"} with no clear lead yet
                </span>
                <span className="font-semibold text-foreground">See all</span>
                <ChevronRight className="-ml-2 size-5 flex-none" aria-hidden />
              </button>
            )}
          </section>
        );
      })}
      {!!accolades?.length && (
        <section className="mt-6 px-3" data-accolades>
          <SectionHead title="On the couch" aside="Who stands out" flush />
          {accolades.map((a) => (
            <div key={a.key} data-accolade-row={a.key} className="flex min-h-[58px] items-center gap-3 border-t border-border">
              {a.tied ? (
                <Pair two={a.tied} face={(p) => <Avatar id={p.userId} name={p.name} size={38} />} />
              ) : a.userId ? (
                <Avatar id={a.userId} name={a.who} size={38} />
              ) : (
                <span className="grid size-[38px] flex-none place-items-center rounded-[3px] bg-secondary text-muted-foreground">
                  <Tv className="size-[18px]" aria-hidden />
                </span>
              )}
              <span className="min-w-0 flex-1">
                <b className="block text-[15px] leading-snug">{a.stat}</b>
                <small className="block text-[12.5px] text-muted-foreground">
                  {a.who} · {a.line}
                </small>
              </span>
            </div>
          ))}
        </section>
      )}
    </>
  );
}

// ---------- Couch verdicts (step 12 part 1: the couch's ratings, ratings.ts) ----------

/**
 * Couch verdicts (the mock's couchpages.js verdictsPage): a critics' panel per show you've started, for the latest episode
 * you've seen: the big score, everyone's stars (yours, or Rate), a take on a plate, the score episode by episode; then your
 * taste twin and the couch's contrarian. Read when the page opens; nothing past where you are in each show.
 */
function Verdicts({ couch, hub }: { couch: Couch | null; hub: CouchHub | undefined }) {
  const open = usePushedPage("verdicts").open;
  const v = useCouchVerdicts(couch?.id ?? null, open);
  const twin = hub?.taste.twin ?? null;
  const contrarian = hub?.accolades.find((a) => a.key === "contrarian") ?? null;
  return (
    <>
      <SpoilerSafe />
      {!v.data ? (
        <div aria-busy className="mx-3 mt-[22px] h-[260px] animate-pulse rounded-[4px] bg-card" />
      ) : v.data.shows.length ? (
        v.data.shows.map((s) => <VerdictPanel key={s.seasonId} s={s} couchId={couch?.id ?? null} />)
      ) : (
        <p className="mx-3 mt-6 text-sm leading-normal text-muted-foreground">
          Once you&apos;ve seen an episode, rate it from the show&apos;s Tonight: the couch&apos;s verdict for each show you watch lands here.
        </p>
      )}
      <How icon={Star} lead={twin ? `Taste twin: ${twin.name}.` : "Taste twins."}>
        {twin ? `${twin.line}.` : "Rate a few episodes the couch watches too, and whoever rates most like you shows up here."}
        {contrarian && ` ${contrarian.who} is the couch's contrarian: ${contrarian.line}.`}
      </How>
    </>
  );
}

function VerdictPanel({ s, couchId }: { s: ShowVerdict; couchId: string | null }) {
  // You're first among them once you've rated it.
  const others = s.mine !== null ? s.people.slice(1) : s.people;
  const rate = () => openRate({ seasonId: s.seasonId, couchId, episode: s.episode, label: s.label, solo: false });
  const top = Math.max(...s.byEpisode.map((b) => b.avg ?? 0), 0);
  return (
    <section data-verdict-show={s.seasonId} className="mx-3 mt-[22px] border-b border-border pb-5">
      <div className="relative isolate flex min-h-[150px] items-end overflow-hidden rounded-[4px] p-3">
        <ShowArt seasonId={s.seasonId} artUrl={s.artUrl} name={s.label} className="absolute inset-0 -z-[2] size-full" />
        <span aria-hidden className="absolute inset-0 -z-[1] bg-[linear-gradient(90deg,rgba(16,14,21,.95)_35%,rgba(16,14,21,.2))]" />
        <div>
          <span className="type-caption block text-[13px] tracking-[0.06em] text-muted-foreground">
            {s.label} · Episode {s.episode}
          </span>
          <b data-verdict-score className="type-num mt-1.5 block text-[84px] leading-[.78]">
            {verdictText(s.avg)}
          </b>
          <small className="mt-1 block text-[13px] text-muted-foreground">{s.n ? `★ couch rating · from ${s.n}` : "Nobody's rated it yet"}</small>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-3.5 gap-y-2.5">
        {s.mine === null && (
          <button type="button" data-verdict-rate onClick={rate} className="nd-press flex h-11 items-center rounded-[3px] px-3.5 text-sm font-bold outline-1 -outline-offset-1 outline-input">
            Rate Episode {s.episode}
          </button>
        )}
        {s.people.map((p) => (
          <button key={p.userId} type="button" onClick={rate} data-verdict-person={p.name} className="flex min-h-11 items-center gap-1.5" aria-label={`${p.name}: ${p.stars} stars`}>
            <Avatar id={p.userId} name={p.name} size={30} />
            <b className="type-num text-[17px]">★ {p.stars}</b>
          </button>
        ))}
      </div>
      {s.take && (
        <div data-verdict-take className="mt-3 flex min-h-12 items-stretch overflow-hidden rounded-[3px] bg-plate text-plate-foreground shadow-plate">
          <span className="type-caption -mr-[13px] flex items-center bg-secondary py-0 pl-[11px] pr-[22px] text-[13px] text-foreground [clip-path:polygon(0_0,100%_0,calc(100%_-_13px)_100%,0_100%)]">
            {s.take.name}
          </span>
          <span className="flex flex-1 items-center py-2 pl-5 pr-2.5 text-sm [overflow-wrap:anywhere]">&ldquo;{s.take.text}&rdquo;</span>
        </div>
      )}
      {s.byEpisode.length > 1 && (
        <div className="mt-3.5 flex h-16 items-end gap-1.5" aria-label="Couch rating by episode" data-verdict-bars>
          {s.byEpisode.map((b, i) => (
            <span key={b.episode} className="flex h-full flex-1 flex-col items-center justify-end gap-1" title={b.avg === null ? `Episode ${b.episode}: not rated` : `Episode ${b.episode}: ${verdictText(b.avg)}`}>
              <i
                className={`block min-h-1 w-full rounded-t-[2px] ${i === s.byEpisode.length - 1 ? "bg-foreground" : "bg-input"}`}
                style={{ height: b.avg === null || !top ? "4px" : `${Math.max(8, ((b.avg - 1) / 4) * 100)}%` }}
              />
              <small className="text-[11px] text-muted-foreground">{b.episode}</small>
            </span>
          ))}
        </div>
      )}
      {others.length === 0 && s.mine !== null && <p className="mt-2 text-[13px] text-muted-foreground">You&apos;re first · the couch verdict fills in as they rate</p>}
    </section>
  );
}

// ---------- Previously on ----------

const first = (name: string) => name.split(" ")[0];

/**
 * One show at a time (the mock's recapsPage, redesigned 2026-10-24): a cold open, Last time as the reveal's vote-out
 * card, the boot order as faces, who's still in by group (a secret faction stays secret), then episode by episode. All
 * from the show's episodes and cast stats, both counted on the server up to where you are (season-episodes.ts,
 * season-stats.ts). A show with no cast data gets the same frame, its last episode as large type.
 */
function PreviouslyOn({ shows, couch }: { shows: HomeShow[]; couch: Couch | null }) {
  const [pick, setPick] = useState<string | null>(null);
  const s = shows.find((x) => x.seasonId === pick) ?? shows[0];
  const eps = useSeasonEpisodes(s?.seasonId ?? "", couch?.id ?? null, !!s);
  const stats = useSeasonStats(s?.seasonId ?? "", couch?.id ?? null, null, !!s);
  if (!s) return <Empty icon={Tv} title="Nothing to recap yet" line="Add a show and say where you are; its story so far shows up here." />;
  const d = stats.isPlaceholderData ? undefined : stats.data;
  const seen = (eps.data?.episodes ?? []).filter((r) => r.status === "seen").sort((a, b) => a.number - b.number);
  const w = eps.data ? (eps.data.seenThrough ?? Math.max(0, ...seen.map((r) => r.number))) : null;
  const last = seen.find((r) => r.number === w) ?? seen[seen.length - 1];
  const cast = d?.cast ?? [];
  const gone = cast.length
    ? cast.filter((c) => c.out !== null).sort((a, b) => (a.out ?? 0) - (b.out ?? 0)).map((c) => ({ name: c.first, photo: c.photo, ep: c.out! }))
    : seen.flatMap((r) => (r.out ?? []).map((o) => ({ name: first(o.name), photo: o.photo, ep: r.number })));
  const still = cast.filter((c) => c.out === null);
  const groups = d && d.groups.length && !d.roles ? d.groups.map((g) => ({ ...g, people: still.filter((c) => c.group === g.name) })).filter((g) => g.people.length) : [{ name: "Still in", colour: "", people: still }];
  const lineOf = (r: (typeof seen)[number]) =>
    r.out?.length ? r.out.map((o) => `${first(o.name)} ${(o.method ?? "out").toLowerCase()}`).join(", ") : r.happened?.[0] ? `${r.happened[0].label}: ${r.happened[0].winners.map((x) => x.name).join(", ")}` : "Nobody went home";
  return (
    <div data-previously={s.seasonId}>
      {shows.length > 1 && (
        <div role="tablist" className="flex gap-2 overflow-x-auto px-3 pb-0.5 pt-3 [scrollbar-width:none]">
          {shows.map((x) => (
            <button
              key={x.seasonId}
              type="button"
              role="tab"
              aria-selected={x.seasonId === s.seasonId}
              data-po={x.seasonId}
              onClick={() => setPick(x.seasonId)}
              className={`flex h-11 flex-none items-center gap-2 rounded-[3px] pl-1 pr-3 text-sm font-bold ${x.seasonId === s.seasonId ? "bg-foreground text-background" : "bg-card text-muted-foreground"}`}
            >
              <ShowArt seasonId={x.seasonId} artUrl={x.show.artUrl} name={x.show.name} className="size-9 rounded-[2px]" />
              {showLabel(x)}
            </button>
          ))}
        </div>
      )}
      <section className="relative isolate mx-3 mt-3 flex h-[210px] flex-col justify-end overflow-hidden rounded-[4px] p-3.5">
        <ShowArt seasonId={s.seasonId} artUrl={s.show.artUrl} name={s.show.name} className="absolute inset-0 -z-[2] size-full" />
        <span aria-hidden className="absolute inset-0 -z-[1] bg-[linear-gradient(180deg,rgba(16,14,21,.15),rgba(16,14,21,.92)_78%)]" />
        {w !== null && (
          <span data-po-safe className="absolute left-3 top-3 flex items-center gap-1.5 rounded-[3px] bg-[rgba(16,14,21,.8)] px-[9px] py-[5px] text-xs font-semibold">
            <Shield className="size-3.5 text-good" aria-hidden />
            {eps.data?.seenThrough === null ? "Everything so far" : `Up to Episode ${w} · nothing past it`}
          </span>
        )}
        <b className="type-caption block text-[52px] leading-[.85]">Previously on</b>
        <span className="type-caption mt-2 block text-[24px]">{showLabel(s)}</span>
      </section>
      {!eps.data ? (
        <Loading />
      ) : !last ? (
        <Empty icon={Tv} title="Nothing recorded yet" line="Once an episode you've seen has results, its story starts here." />
      ) : (
        <>
          <section className="mt-6 px-3">
            <SectionHead title="Last time" aside={`Episode ${last.number}`} flush />
            {last.out?.length ? (
              <div className={last.out.length > 1 ? "grid grid-cols-2 gap-2.5" : ""}>
                {last.out.map((c) => (
                  <NavLink
                    key={c.id}
                    href={paths.show(s.seasonId, "episodes")}
                    data-po-last={c.name}
                    className={`relative block overflow-hidden rounded-[4px] shadow-[0_14px_34px_rgba(0,0,0,.45)] ${last.out!.length > 1 ? "aspect-[3/4]" : "aspect-[4/3.6]"}`}
                  >
                    <Face src={c.photo} name={c.name} className="absolute inset-0 size-full text-[64px] [filter:grayscale(.2)]" />
                    <span className="type-caption absolute bottom-[70px] left-0 bg-live py-1.5 pl-2.5 pr-5 text-sm tracking-[0.05em] text-live-foreground [clip-path:polygon(0_0,100%_0,calc(100%_-_10px)_100%,0_100%)]">
                      {c.method ?? "Out"} · Ep {last.number}
                    </span>
                    <span className="absolute inset-x-0 bottom-0 min-h-[70px] bg-plate px-3 py-2.5 text-plate-foreground">
                      <b className="type-caption block truncate text-[30px] leading-none">{first(c.name)}</b>
                      {c.place && <small className="mt-1 block text-[12.5px] text-plate-muted">Finished {ordinal(c.place)}</small>}
                    </span>
                  </NavLink>
                ))}
              </div>
            ) : (
              <NavLink href={paths.show(s.seasonId, "episodes")} className="flex items-center gap-4 rounded-[4px] bg-card p-4" data-po-last="">
                <b className="type-num text-[72px] leading-[.8]">{last.number}</b>
                <p className="type-caption text-[26px] leading-tight">{lineOf(last)}</p>
              </NavLink>
            )}
          </section>
          {gone.length > 0 && (
            <section className="mt-6 px-3">
              <SectionHead title="The story so far" aside={`${gone.length} gone${cast.length ? ` · ${still.length} still in` : ""}`} flush />
              <div className="flex gap-1.5 overflow-x-auto [scrollbar-width:none]" data-po-gone>
                {gone.map((c, i) => (
                  <span key={`${c.name}-${c.ep}`} className="flex w-16 flex-none flex-col gap-1 text-center">
                    <Face src={c.photo} name={c.name} className={`aspect-square w-full rounded-[3px] text-[24px] ${i === gone.length - 1 ? "outline-2 -outline-offset-2 outline-live" : "[filter:grayscale(1)]"}`} />
                    <b className="truncate text-xs">{c.name}</b>
                    <small className="type-caption text-[10px] text-muted-foreground">Ep {c.ep}</small>
                  </span>
                ))}
              </div>
            </section>
          )}
          {still.length > 0 && (
            <section className="mt-6 px-3" data-po-still>
              <SectionHead title="Still in" aside={d?.roles ? "Factions stay secret" : d?.groups.length ? `By ${d.groupWord}` : undefined} flush />
              {groups.map((g) => (
                <div key={g.name} className="mb-3">
                  {(groups.length > 1 || g.colour) && (
                    <span className="mb-1.5 flex items-center gap-2">
                      {g.colour && <i className="size-2.5 rounded-[2px]" style={{ background: g.colour }} aria-hidden />}
                      <b className="type-caption text-[15px]">{g.name}</b>
                      <small className="text-xs text-muted-foreground">{g.people.length}</small>
                    </span>
                  )}
                  <div className="grid grid-cols-6 gap-1.5">
                    {g.people.map((c) => (
                      <span key={c.name} className="flex min-w-0 flex-col items-center gap-1">
                        <Face src={c.photo} name={c.name} className="aspect-square w-full rounded-[3px] text-[18px]" />
                        <small className="w-full truncate text-center text-[11px]">{c.first}</small>
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </section>
          )}
          <section className="mt-6 px-3">
            <SectionHead title="Episode by episode" flush />
            {[...seen].reverse().map((r) => (
              <NavLink key={r.number} data-po-ep={r.number} href={paths.show(s.seasonId, "episodes")} className="flex min-h-14 items-center gap-3 border-t border-border">
                <b className="type-num w-7 flex-none text-[26px] text-muted-foreground">{r.number}</b>
                {!!r.out?.length && (
                  <span className="flex flex-none">
                    {r.out.map((o) => (
                      <Face key={o.id} src={o.photo} name={o.name} className="size-9 rounded-[3px] text-[14px] [filter:grayscale(1)]" />
                    ))}
                  </span>
                )}
                <span className="min-w-0 flex-1 text-[15px]">{lineOf(r)}</span>
                <ChevronRight className="size-5 flex-none text-muted-foreground" aria-hidden />
              </NavLink>
            ))}
          </section>
          <NavLink
            href={paths.watch(s.seasonId)}
            data-po-watch
            className="nd-press mx-3 mt-6 flex h-12 items-center justify-center gap-2 rounded-[3px] text-[15px] font-bold outline-1 -outline-offset-1 outline-input"
          >
            <Tv className="size-5" aria-hidden />
            Watch along · Episode {last.number + 1}
          </NavLink>
        </>
      )}
    </div>
  );
}

// ---------- Trophy shelf ----------

const RECORD_ICON: Record<CouchRecord["key"], LucideIcon> = { titles: Crown, ranItBack: Repeat, streak: Shield, average: Zap };

function plaqueLine(p: Plaque, me: string) {
  const names = p.winners.map((w) => (w.userId === me ? "You" : w.name));
  if (names.length === 1 && names[0] === "You") return `You won ${p.gameName}${p.by ? ` by ${p.by}` : ""}`;
  const who = names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}` : names[0];
  return `${who} won ${p.gameName}${p.by ? ` by ${p.by}` : ""}${names.length > 1 ? " together" : ""}`;
}

/** Your titles as the big number, a plaque per finished game, the couch's records (only once a season has ended). */
function TrophyShelf({ hub, me, couchId }: { hub: CouchHub | undefined; me: string; couchId: string | null }) {
  if (!hub) return <Loading />;
  const t = hub.trophies;
  if (!t) return <Empty icon={Crown} title="Your first trophy goes here" line="Win a season and it stays on the shelf, every season after." />;
  const line = [t.average ? `Average finish ${ordinal(t.average)}.` : null, t.leader ? `${t.leader.who.name} holds the most, with ${t.leader.titles}.` : t.titles ? "You hold the most." : null].filter(Boolean).join(" ");
  return (
    <>
      <BigHero big={t.titles} label={`${t.titles === 1 ? "Title" : "Titles"} · ${t.seasons} ${t.seasons === 1 ? "season" : "seasons"} played`} line={line || "Every season the couch finishes stays here."} />
      <section className="mt-6 px-3">
        <SectionHead title="Recent seasons" flush />
        <div className="grid grid-cols-2 gap-2.5">
          {t.plaques.map((p) => {
            const won = !!p.you && p.you.place === 1;
            return (
              <div
                key={p.leagueId}
                data-plaque={p.label}
                className={`relative flex flex-col gap-[3px] overflow-hidden rounded-[4px] bg-card p-2.5 ${won ? "outline-[1.5px] -outline-offset-[1.5px] outline-accent-2" : ""}`}
              >
                <ShowArt seasonId={p.seasonId} artUrl={p.artUrl} name={p.label} className={`mb-1.5 h-[74px] w-full rounded-[3px] ${won ? "" : "[filter:saturate(.6)_brightness(.8)]"}`} />
                <span className={`type-num text-[40px] leading-[.9] ${won ? "text-accent-2" : ""}`}>{p.you ? placeWord(p.you.rank, p.you.place) : "–"}</span>
                <b className="type-caption text-base">{p.label}</b>
                {/* A game over a span says which (step 6 of docs/PLAN-sports-data.md). */}
                {p.span && (
                  <b data-plaque-span className="text-[13px] font-semibold">
                    {p.span}
                  </b>
                )}
                <small className="text-[12.5px] text-muted-foreground">{plaqueLine(p, me)}</small>
                {p.ranItBack && <span className="type-caption mt-1 self-start rounded-[2px] bg-secondary px-[7px] py-[3px] text-[11px] tracking-[0.06em]">Ran it back</span>}
              </div>
            );
          })}
        </div>
      </section>
      {hub.again.length > 0 && (
        <section className="mt-6 px-3" data-run-it-back>
          <SectionHead title="Run it back" aside="The same game again" flush />
          {hub.again.map((a) => {
            const p = t.plaques.find((x) => x.leagueId === a.leagueId);
            return (
              <button
                key={a.leagueId}
                type="button"
                data-again={a.seasonId}
                onClick={() => openStartGame({ seasonId: a.seasonId, couchId, again: a.leagueId })}
                className="nd-press flex min-h-[60px] w-full items-center gap-3 border-t border-border text-left"
              >
                <span className="grid size-9 flex-none place-items-center rounded-[3px] bg-card">
                  <RotateCcw className="size-[18px]" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <b className="block text-[15px]">{a.label}</b>
                  <small className="block text-[12.5px] text-muted-foreground">{p ? `${p.gameName} again, after ${p.label}${p.span ? ` · ${p.span}` : ""}` : "The same game again"}</small>
                </span>
                <ChevronRight className="size-5 flex-none text-muted-foreground" aria-hidden />
              </button>
            );
          })}
        </section>
      )}
      {t.records.length > 0 && (
        <section className="mt-6 px-3">
          <SectionHead title="Couch records" flush />
          {t.records.map((r) => {
            const Icon = RECORD_ICON[r.key];
            return (
              <div key={r.key} data-record={r.key} className="flex min-h-[58px] items-center gap-3 border-t border-border">
                <span className="grid size-9 flex-none place-items-center rounded-[3px] bg-card">
                  <Icon className="size-[18px]" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <b className="block text-[15px]">{r.title}</b>
                  <small className="block text-[12.5px] text-muted-foreground">
                    {r.who.name} · {r.line}
                  </small>
                </span>
                <Avatar id={r.who.userId} name={r.who.name} size={30} />
              </div>
            );
          })}
        </section>
      )}
    </>
  );
}
