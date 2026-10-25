"use client";

import { useSearchParams } from "next/navigation";
import { ChevronRight, ListOrdered } from "lucide-react";
import { useSeasonStats, type CastStat, type GameView, type SeasonStats, type StatDef } from "../data";
import { NavLink } from "../nav";
import { paths } from "../routes";
import type { ShowData } from "../screens/show-space";
import { PushedPage, usePushedPage } from "../ui/page";
import { GuardChip } from "../ui/parts";
import { Face } from "./parts";

// Cast stats, no game needed (the mock's stats.js; docs/PLAN-new-design.md step 3): Tonight's Stats card (the stat of
// the week, two short boards, then every stat), and the stats page it opens, "<Show> stats", every stat sorted (the
// one you came for with everyone, the rest top five each), which links into the Cast tab's Rank. By the numbers on
// the hub opens the same page for each show. Every number is counted on the server up to where you are
// (GET /api/seasons/[id]/stats, season-stats.ts); the Cast tab's explorer reads the same answer.

/** "1 time", "2 times": a unit's first word loses its s for one. */
export const unitFor = (unit: string, n: number) => (n === 1 ? unit.replace(/^(\w+?)s\b/, "$1") : unit);

/** A stat's value for one castaway, over the episodes the stats were counted for. */
export const statValue = (c: CastStat, key: string) => (key === "points" ? c.points : (c.counts[key] ?? 0));

/** A stat by its key, else Points. */
export const statOf = (d: SeasonStats, key: string | null | undefined): StatDef => d.stats.find((s) => s.key === key) ?? d.stats[0];

/** Everyone with at least one of a stat, most first (someone still in before someone out). */
export function statBoard(d: SeasonStats, key: string) {
  return d.cast
    .map((c) => ({ c, n: statValue(c, key) }))
    .filter((r) => r.n > 0)
    .sort((a, b) => b.n - a.n || Number(a.c.out !== null) - Number(b.c.out !== null));
}

/** The castaways on your teams here (Outlast's, Weekly Lineup's), by name: the explorer's "Your team". */
export function yourTeam(play: GameView[] | null): Set<string> {
  const out = new Set<string>();
  for (const g of play ?? []) {
    if (!g.you) continue;
    const names = new Map(g.cast.map((c) => [c.id, c.name]));
    for (const id of g.you.team) {
      const n = names.get(id);
      if (n) out.add(n);
    }
  }
  return out;
}

/** The stats page (?page=stats&stat=<key>, and &season=<id> over the hub), opened at a stat or at the top. */
export function useStatsPage() {
  const page = usePushedPage("stats", ["stat", "season"]);
  return {
    open: page.open,
    close: page.close,
    openAt: (stat?: string | null, season?: string) => page.showWith({ ...(stat ? { stat } : {}), ...(season ? { season } : {}) }),
  };
}

/** A short board: the top few, numbered, faces greyed once out. */
export function StatRows({ d, statKey, max = 3 }: { d: SeasonStats; statKey: string; max?: number }) {
  const rows = statBoard(d, statKey).slice(0, max);
  if (!rows.length) return <p className="text-[13px] text-muted-foreground">Nothing yet</p>;
  return (
    <>
      {rows.map((r, i) => (
        <div key={r.c.name} data-board-row={r.c.first} className={`flex min-h-10 items-center gap-2 border-t border-border ${r.c.out !== null ? "opacity-50" : ""}`}>
          <span className="type-num w-5 flex-none text-base text-muted-foreground">{i + 1}</span>
          <Face src={r.c.photo} name={r.c.first} out={r.c.out !== null} className="size-[30px] flex-none rounded-[3px]" />
          <span className="flex min-w-0 flex-1 flex-col text-sm font-semibold">
            <span className="truncate">{r.c.first}</span>
            {r.c.out !== null ? <small className="block text-[10px] text-muted-foreground">Out · Ep {r.c.out}</small> : null}
          </span>
          <b className="type-num text-lg">{r.n}</b>
        </div>
      ))}
    </>
  );
}

// ---------- Tonight's Stats card ----------

export function StatsCard({ seasonId, show }: { seasonId: string; show: ShowData }) {
  const { data: d } = useSeasonStats(seasonId, show.couch?.id ?? null);
  const page = useStatsPage();
  if (!d || !d.through || !d.featured.length) return null;
  const [lead, ...rest] = d.featured.map((k) => statOf(d, k));
  const top = statBoard(d, lead.key)[0];
  const two = rest.slice(0, 2);
  const count = d.stats.length - 1;
  return (
    <section data-stats-card className="mx-4 mb-2 mt-[26px]">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="type-caption text-[24px]">Stats</h2>
        <span className="text-[13px] text-muted-foreground">Up to Episode {d.through} · no game needed</span>
      </div>
      {top && (
        <button type="button" data-stat-week={lead.key} onClick={() => page.openAt(lead.key)} className="nd-press flex w-full items-center gap-3 rounded-[4px] bg-plate p-2.5 text-left text-plate-foreground">
          <Face src={top.c.photo} name={top.c.first} className="size-16 flex-none rounded-[3px]" />
          <span className="min-w-0">
            <span className="type-caption inline-block bg-plate-foreground py-[3px] pl-1.5 pr-3 text-[11px] tracking-[0.06em] text-plate [clip-path:polygon(0_0,100%_0,calc(100%_-_7px)_100%,0_100%)]">
              Stat of the week
            </span>
            <b className="type-caption mt-1 block text-[20px] leading-tight">{lead.name}</b>
            <small className="block text-[13px] text-plate-muted">
              {top.c.first} · {top.n} {unitFor(lead.unit, top.n)}
            </small>
          </span>
        </button>
      )}
      {two.length > 0 && (
        <div className="mt-3.5 grid grid-cols-2 gap-3.5">
          {two.map((s) => (
            <div key={s.key} className="min-w-0">
              <span className="type-caption mb-1 line-clamp-2 block min-h-[34px] text-[13px] leading-tight text-muted-foreground">{s.name}</span>
              <StatRows d={d} statKey={s.key} />
            </div>
          ))}
        </div>
      )}
      <button type="button" data-all-stats onClick={() => page.openAt()} className="mt-2.5 flex h-11 w-full items-center justify-center gap-1 rounded-[3px] font-bold outline-1 -outline-offset-1 outline-input">
        All {count} {count === 1 ? "stat" : "stats"} <ChevronRight className="size-4" aria-hidden />
      </button>
    </section>
  );
}

// ---------- the stats page: every stat, sorted ----------

/** The page's body: the stat you came for (`focus`) with everyone, then every other stat's top five. */
function StatsBody({ d, seasonId, focus, fromHub }: { d: SeasonStats; seasonId: string; focus: string | null; fromHub?: boolean }) {
  const focused = focus && d.stats.some((s) => s.key === focus) ? focus : null;
  const order = [...d.stats.filter((s) => s.key === focused), ...d.stats.filter((s) => s.key !== focused && s.key !== "points")];
  const refocus = (key: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set("stat", key);
    window.history.replaceState(null, "", url);
    document.querySelector("[data-stats-page]")?.closest("[role=dialog]")?.scrollTo({ top: 0, behavior: "smooth" });
  };
  if (!d.through) {
    return <p className="mt-4 text-sm leading-normal text-muted-foreground">Nothing counted yet. Stats fill in as you watch, up to the episode you&apos;re on.</p>;
  }
  return (
    <>
      {focused && (
        <NavLink
          href={`${paths.show(seasonId, "cast")}?rank=${encodeURIComponent(focused)}`}
          replace={!fromHub}
          data-rank-link
          className="mt-3 flex h-11 items-center justify-center gap-2 rounded-[3px] font-bold outline-1 -outline-offset-1 outline-input"
        >
          <ListOrdered className="size-[18px]" aria-hidden />
          See everyone ranked by this
        </NavLink>
      )}
      <p className="mb-1.5 mt-3 text-[13px] leading-normal text-muted-foreground">
        Counted from each episode&apos;s results, up to Episode {d.through}. Nothing past where you are.
      </p>
      {order.map((s) => {
        const on = s.key === focused;
        return (
          <section key={s.key} data-stat-section={s.key} data-focused={on || undefined} className="mt-4">
            <button type="button" disabled={on} onClick={() => refocus(s.key)} className="mb-1.5 flex w-full items-baseline justify-between gap-3 text-left">
              <h2 className={`type-caption ${on ? "text-[26px]" : "text-[20px]"} leading-tight`}>{s.name}</h2>
              <span className="flex-none text-xs text-muted-foreground">{on ? "Sorted by this · everyone" : s.unit || "Top five"}</span>
            </button>
            <StatRows d={d} statKey={s.key} max={on ? 99 : 5} />
          </section>
        );
      })}
    </>
  );
}

function StatsPageFrame({ title, d, seasonId, focus, fromHub, open, onClose }: { title: string; d: SeasonStats | undefined; seasonId: string | null; focus: string | null; fromHub?: boolean; open: boolean; onClose: () => void }) {
  return (
    <PushedPage open={open} onClose={onClose} title={title}>
      <div data-stats-page className="px-4 pb-12 pt-3">
        {d && seasonId ? (
          <>
            <GuardChip seenThrough={d.seenThrough} />
            <StatsBody d={d} seasonId={seasonId} focus={focus} fromHub={fromHub} />
          </>
        ) : (
          <div className="mt-2 h-64 animate-pulse rounded-[4px] bg-card" aria-busy />
        )}
      </div>
    </PushedPage>
  );
}

/** The stats page over a show space (mounted by its frame). */
export function ShowStatsPage({ seasonId, couchId, name }: { seasonId: string; couchId: string | null; name: string }) {
  const page = useStatsPage();
  const focus = useSearchParams().get("stat");
  const { data } = useSeasonStats(seasonId, couchId, null, page.open);
  return <StatsPageFrame title={`${name} stats`} d={data} seasonId={seasonId} focus={focus} open={page.open} onClose={page.close} />;
}

/** The stats page over the hub (By the numbers opens it for one of your shows: &season=<id>). */
export function HubStatsPage({ couchId, names }: { couchId: string | null; names: Map<string, string> }) {
  const page = useStatsPage();
  const params = useSearchParams();
  const seasonId = params.get("season");
  const { data } = useSeasonStats(seasonId ?? "", couchId, null, page.open && !!seasonId);
  return (
    <StatsPageFrame
      title={`${(seasonId && names.get(seasonId)) || "Show"} stats`}
      d={data}
      seasonId={seasonId}
      focus={params.get("stat")}
      fromHub
      open={page.open}
      onClose={page.close}
    />
  );
}
