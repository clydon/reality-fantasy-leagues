"use client";

import { useState, type ReactNode } from "react";
import { Check, ChevronRight, Lock, Plus, Tv } from "lucide-react";
import { airTime, calmWhen, dayOf, ticks, timeOf } from "../clock";
import { BINGO_CARD } from "../fixtures/episode-games";
import { SEEN, STATS, statBoard, unitFor } from "../fixtures/cast";
import { standing, yourLine } from "../fixtures/standings";
import { GAME_STYLE, isGameName, ordinal, type GameName } from "../games";
import { NavLink } from "../nav";
import { paths } from "../routes";
import type { ShowData } from "../screens/show-space";
import { useNow } from "../ui/bars";
import { Btn, BtnLink } from "../ui/parts";
import { Preview } from "../ui/preview";
import { ShowArt } from "../ui/show-bar";
import { isRequired, moveCard, openMoves } from "./moves";
import { Block, Face } from "./parts";

// Tonight (the mock's refine.js tabTonight, option 2C, 2026-10-24): the phase as a heading from the clock, then
// Your moves as swipeable cards (open first with the one yellow button on the first; all done is one "You're set"
// card), Extras this week (optional, no counts), Watch along, your games and the cast's stats. No dock before
// airtime and no commissioner job (5B: Backstage and a dot on the show's ⋯ carry it). Real: the heading, the
// cards and the predictions in Extras (your moves due here, as the home lists them). On fixtures behind Preview:
// the moves sheet the cards open (step 1), bingo (12), Watch along (13), your places (1), the stats (3).

export function Tonight({ seasonId, show }: { seasonId: string; show: ShowData }) {
  const playing = show.games.some((g) => g.yourRole);
  return (
    <>
      <PhaseHead show={show} />
      {playing && <YourMoves seasonId={seasonId} show={show} />}
      <Extras show={show} />
      <WatchAlongCard seasonId={seasonId} show={show} />
      {playing && <YourGames seasonId={seasonId} show={show} />}
      <StatsCard seasonId={seasonId} />
    </>
  );
}

/** "Episode 6 · Wed 8:05 PM · in 4 days", "On air · Episode 6 · Locked at 8:05 PM". */
function PhaseHead({ show }: { show: ShowData }) {
  const up = show.upNext;
  const t = up?.airAt ? Date.parse(up.airAt) : null;
  const now = useNow(t != null && ticks(t));
  let title: ReactNode;
  let aside: string | null = null;
  if (up?.live) {
    title = (
      <>
        <i className="size-[9px] animate-pulse rounded-full bg-live" aria-hidden />
        On air · Episode {up.number}
      </>
    );
    aside = t != null ? `Locked at ${timeOf(t)}` : null;
  } else if (up) {
    title = `Episode ${up.number}`;
    aside = t != null ? calmWhen(t, now) : null;
  } else if (show.header?.episodeCount && show.latestAired >= show.header.episodeCount) {
    title = "Season over";
  } else {
    title = show.latestAired ? `Episode ${show.latestAired}` : "Coming up";
    aside = show.latestAired ? "Aired" : null;
  }
  return (
    <div className="mx-4 mt-[18px] flex items-baseline justify-between gap-3 border-b border-border pb-2.5">
      <b className="type-caption flex items-center gap-2 text-[22px]">{title}</b>
      {aside && <span className="text-sm text-muted-foreground">{aside}</span>}
    </div>
  );
}

// ---------- Your moves ----------

function YourMoves({ seasonId, show }: { seasonId: string; show: ShowData }) {
  const [at, setAt] = useState(0);
  const up = show.upNext;
  const t = up?.airAt ? Date.parse(up.airAt) : null;
  const open = show.moves.filter(isRequired);
  const kinds = open.map((m) => m.kind);
  const cards = open.map((m) => moveCard(m, seasonId, kinds.filter((k) => k === m.kind).length > 1));
  const due = open[0]?.deadline ? Date.parse(open[0].deadline) : t;

  let body: ReactNode;
  if (up?.live) {
    body = (
      <DoneCard icon={Lock} title="Your moves are locked" line="Scores stay hidden until you reveal" />
    );
  } else if (!cards.length) {
    body = (
      <DoneCard
        icon={Check}
        title={up ? `You're set for Episode ${up.number}` : "Nothing due"}
        line={t != null ? `Change anything until ${airTime(t)}` : "Nothing to set until the next episode"}
        action={up ? <Btn onClick={() => openMoves("lineup")} wide className="mt-1">Change</Btn> : undefined}
      />
    );
  } else {
    body = (
      <>
        <div
          className="-mx-4 flex snap-x snap-mandatory gap-2.5 overflow-x-auto px-4 [scrollbar-width:none]"
          onScroll={(e) => {
            const el = e.currentTarget;
            const w = (el.firstElementChild as HTMLElement | null)?.offsetWidth ?? 1;
            setAt(Math.round(el.scrollLeft / (w + 10)));
          }}
        >
          {cards.map((c, i) => (
            <div
              key={c.key}
              data-move={c.key}
              className={`flex flex-none snap-start flex-col gap-1.5 rounded-[4px] bg-card p-4 ${cards.length > 1 ? "w-[calc(100%-36px)]" : "w-full"}`}
            >
              <span className="type-num text-[30px] leading-none text-muted-foreground">{i + 1}</span>
              <b className="type-caption text-[26px] leading-none">{c.title}</b>
              <small className="block mb-2.5 text-sm leading-snug text-muted-foreground">{c.line}</small>
              {c.href ? (
                <BtnLink href={c.href} tone={i ? "optional" : "must"} wide className="mt-auto">
                  {c.action}
                </BtnLink>
              ) : (
                <Btn tone={i ? "optional" : "must"} wide className="mt-auto" onClick={() => openMoves(c.tab ?? "lineup")}>
                  {c.action}
                </Btn>
              )}
            </div>
          ))}
        </div>
        {cards.length > 1 && (
          <div className="mt-2.5 flex justify-center gap-1.5" aria-hidden>
            {cards.map((c, i) => (
              <i key={c.key} className={`h-1 w-[18px] rounded-[2px] transition-colors ${i === at ? "bg-foreground" : "bg-border"}`} />
            ))}
          </div>
        )}
      </>
    );
  }
  return (
    <Block title="Your moves" aside={up?.live ? "Locked" : cards.length ? `${cards.length} to do before ${due != null ? dayOf(due) : "airtime"}` : "All done"}>
      {body}
    </Block>
  );
}

function DoneCard({ icon: Icon, title, line, action }: { icon: typeof Check; title: string; line: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-[4px] bg-background p-4 outline-1 -outline-offset-1 outline-border">
      <span className="grid size-[34px] place-items-center rounded-full bg-good/20 text-good">
        <Icon className="size-[18px]" strokeWidth={2.6} aria-hidden />
      </span>
      <b className="type-caption text-[26px] leading-none">{title}</b>
      <small className="block mb-1 text-sm leading-snug text-muted-foreground">{line}</small>
      {action}
    </div>
  );
}

// ---------- Extras this week ----------

function ExtraRow({ title, line, state, onClick }: { title: string; line: string; state: string; onClick?: () => void }) {
  return (
    <button type="button" onClick={onClick} className="nd-press flex min-h-[60px] w-full items-center gap-3 border-t border-border py-2 text-left">
      <span className="min-w-0 flex-1">
        <b className="block text-[15px] font-semibold">{title}</b>
        <small className="mt-0.5 block text-[13px] text-muted-foreground">{line}</small>
      </span>
      <span className="text-[13px] font-semibold text-muted-foreground">{state}</span>
      <ChevronRight className="size-5 flex-none text-muted-foreground" aria-hidden />
    </button>
  );
}

function Extras({ show }: { show: ShowData }) {
  const up = show.upNext;
  const t = up?.airAt ? Date.parse(up.airAt) : null;
  const predictions = show.moves.filter((m) => m.kind === "prediction");
  if (up?.live) return null;
  return (
    <Block title="Extras this week" aside="Optional">
      {predictions.map((m) => (
        <ExtraRow key={m.leagueId} title={m.text} line={`Closes at airtime · ${m.leagueName}`} state="Open" onClick={() => openMoves("predict")} />
      ))}
      <Preview id="show.episode-games" tag={false} className="-mx-2 px-2">
        <ExtraRow title={BINGO_CARD.title} line={`Ready for ${t != null ? dayOf(t, true) : "the next episode"} · ${BINGO_CARD.line}`} state={BINGO_CARD.state} />
      </Preview>
    </Block>
  );
}

// ---------- Watch along ----------

function WatchAlongCard({ seasonId, show }: { seasonId: string; show: ShowData }) {
  const up = show.upNext;
  const t = up?.airAt ? Date.parse(up.airAt) : null;
  if (!show.header) return null;
  return (
    <Preview id="show.watch-along" className="mx-4 mt-[26px]">
      <button
        type="button"
        className="nd-press relative isolate flex min-h-[150px] w-full flex-col justify-end gap-1 overflow-hidden rounded-[4px] p-3.5 text-left text-white shadow-[0_14px_30px_rgba(0,0,0,.4)]"
      >
        <ShowArt seasonId={seasonId} artUrl={show.header.show.artUrl} name={show.header.show.name} className="absolute inset-0 -z-[2] size-full" />
        <span aria-hidden className="absolute inset-0 -z-[1] bg-[linear-gradient(180deg,rgba(16,14,21,.1),rgba(16,14,21,.9))]" />
        <span
          className={`type-caption mb-auto flex items-center gap-1.5 self-start py-1 pl-2 pr-4 text-xs tracking-[0.06em] [clip-path:polygon(0_0,100%_0,calc(100%_-_8px)_100%,0_100%)] ${
            up?.live ? "bg-live text-live-foreground" : "bg-good text-good-foreground"
          }`}
        >
          {up?.live ? (
            <>
              <i className="size-[7px] animate-pulse rounded-full bg-current" aria-hidden />
              On air
            </>
          ) : t != null ? (
            airTime(t)
          ) : (
            <>
              <Tv className="size-3.5" aria-hidden /> Any time
            </>
          )}
        </span>
        <b className="type-caption text-[32px]">Watch along</b>
        <small className="block text-[13px] opacity-90">Start when your episode starts · the couch&rsquo;s comments land as you reach them</small>
      </button>
    </Preview>
  );
}

// ---------- Your games ----------

/** The games you play here, by name (the fixture's three if none is one the new design knows). */
export function gamesPlayed(show: ShowData): GameName[] {
  const names = [...new Set(show.games.filter((g) => g.yourRole).map((g) => g.gameName))].filter(isGameName);
  return names.length ? names : (Object.keys(GAME_STYLE) as GameName[]);
}

function YourGames({ seasonId, show }: { seasonId: string; show: ShowData }) {
  const games = gamesPlayed(show);
  const tab = paths.show(seasonId, "games");
  return (
    <Preview id="show.your-games" className="mx-2 mt-[26px] px-2 pb-3 pt-4">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="type-caption text-[24px]">Your games</h2>
        <NavLink data-try href={tab} replace className="text-[15px] font-semibold">
          Standings
        </NavLink>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {games.map((g) => {
          const me = standing(g).find((r) => r.who === "alex")!;
          return (
            <NavLink
              key={g}
              data-try
              href={tab}
              replace
              className="nd-press flex min-h-[104px] flex-col gap-1.5 rounded-b-[4px] border-t-[3px] bg-card p-3"
              style={{ borderTopColor: GAME_STYLE[g].colour }}
            >
              <span className="type-caption text-xs tracking-[0.04em] text-muted-foreground">{g}</span>
              <b className="type-num text-[36px] leading-none">{ordinal(me.place)}</b>
              <small className="block text-xs text-muted-foreground">{yourLine(g)}</small>
            </NavLink>
          );
        })}
        <Preview id="show.start-game" tag={false}>
          <button type="button" className="flex min-h-[104px] w-full flex-col justify-center gap-1.5 p-3 text-left text-muted-foreground">
            <Plus className="size-5" aria-hidden />
            <b className="text-[15px] text-foreground">Start a game</b>
            <small className="block text-xs">Anyone on the couch can</small>
          </button>
        </Preview>
      </div>
    </Preview>
  );
}

// ---------- Stats ----------

function StatRows({ statKey }: { statKey: string }) {
  const rows = statBoard(statKey).slice(0, 3);
  if (!rows.length) return <p className="text-[13px] text-muted-foreground">Nothing yet</p>;
  return (
    <>
      {rows.map((r, i) => (
        <div key={r.c.name} className={`flex min-h-10 items-center gap-2 border-t border-border ${r.out ? "opacity-50" : ""}`}>
          <span className="type-num w-4 text-base text-muted-foreground">{i + 1}</span>
          <Face src={r.c.photo} out={!!r.out} className="size-[30px] rounded-[3px]" />
          <span className="flex min-w-0 flex-1 flex-col text-sm font-semibold">
            {r.c.first}
            {r.out ? <small className="block text-[10px] text-muted-foreground">Out · Ep {r.out}</small> : null}
          </span>
          <b className="type-num text-lg">{r.n}</b>
        </div>
      ))}
    </>
  );
}

function StatsCard({ seasonId }: { seasonId: string }) {
  const [lead, a, b] = [STATS[1], STATS[2], STATS[3]];
  const top = statBoard(lead.key)[0];
  return (
    <Preview id="show.stats" className="mx-2 mb-2 mt-[26px] px-2 pb-3 pt-4">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="type-caption text-[24px]">Stats</h2>
        <span className="text-[13px] text-muted-foreground">Up to Episode {SEEN} · no game needed</span>
      </div>
      {top && (
        <NavLink data-try href={`${paths.show(seasonId, "cast")}?rank=${lead.key}`} replace className="nd-press flex items-center gap-3 rounded-[4px] bg-plate p-2.5 text-plate-foreground">
          <Face src={top.c.photo} className="size-16 flex-none rounded-[3px]" />
          <span className="min-w-0">
            <span className="type-caption inline-block bg-plate-foreground py-[3px] pl-1.5 pr-3 text-[11px] tracking-[0.06em] text-plate [clip-path:polygon(0_0,100%_0,calc(100%_-_7px)_100%,0_100%)]">
              Stat of the week
            </span>
            <b className="type-caption mt-1 block text-[20px]">{lead.name}</b>
            <small className="block text-[13px] text-plate-muted">
              {top.c.first} · {top.n} {unitFor(lead.unit, top.n)}
            </small>
          </span>
        </NavLink>
      )}
      <div className="mt-3.5 grid grid-cols-2 gap-3.5">
        {[a, b].map((s) => (
          <div key={s.key} className="min-w-0">
            <span className="type-caption mb-1 block min-h-[26px] text-[13px] text-muted-foreground">{s.name}</span>
            <StatRows statKey={s.key} />
          </div>
        ))}
      </div>
      <NavLink
        data-try
        href={`${paths.show(seasonId, "cast")}?rank=${lead.key}`}
        replace
        className="mt-2.5 flex h-11 items-center justify-center gap-1 rounded-[3px] font-bold outline-1 -outline-offset-1 outline-input"
      >
        All {STATS.length - 1} stats <ChevronRight className="size-4" aria-hidden />
      </NavLink>
    </Preview>
  );
}
