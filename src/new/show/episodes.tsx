"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowLeftRight, ChevronRight } from "lucide-react";
import { airTime } from "../clock";
import { CAST, EPISODES, SEEN, TRIBES, castaway } from "../fixtures/cast";
import { FINALE, GAMES_FROM, HAPPENED, WAIVERS, YOUR_LINEUP, YOUR_PICKS, YOUR_SCORERS, YOUR_TEAM } from "../fixtures/episodes";
import { GAME_STYLE, ordinal } from "../games";
import { NavLink } from "../nav";
import { paths } from "../routes";
import type { ShowData } from "../screens/show-space";
import { PushedPage, usePushedPage } from "../ui/page";
import { Preview } from "../ui/preview";
import { ShowArt } from "../ui/show-bar";
import { Block, Face } from "./parts";

// Episodes (the mock's show.js tabEpisodes and episodePage, waivers.js's row): this week's episode, then every
// episode with who went home and what you scored, each opening its own page (?page=ep4). Real: this week's
// episode, its art and time, and who's set for it in your games. On fixtures behind Preview: every episode and its
// page (2), the waiver window's row (6a).

/** "3 of 4 lineups set · 2 of 4 picked": who's set for the next episode in your games here, a line per kind. */
function progressLine(show: ShowData): string | null {
  const seen = new Set<string>();
  const parts = (show.play ?? [])
    .map((g) => g.progress)
    .filter((p) => !!p && !seen.has(p.label) && !!seen.add(p.label))
    .map((p) => `${p!.done} of ${p!.of} ${p!.label}`);
  return parts.length ? parts.join(" · ") : null;
}

const outIn = (e: number) => CAST.filter((c) => c.out === e);
/** Where someone who left in episode e finished: everyone still in at the start of it, counted down. */
const finished = (e: number) => CAST.length - CAST.filter((c) => c.out && c.out < e).length;

export function Episodes({ seasonId, show }: { seasonId: string; show: ShowData }) {
  const up = show.upNext;
  const t = up?.airAt ? Date.parse(up.airAt) : null;
  return (
    <>
      {up && show.header && (
        <Block title={`Episode ${up.number}`} aside={up.live ? "On now" : "This week"}>
          <div className="flex items-center gap-3 rounded-[4px] bg-card p-2.5">
            <ShowArt seasonId={seasonId} artUrl={show.header.show.artUrl} name={show.header.show.name} className="h-[60px] w-24 flex-none rounded-[3px] text-[13px]" />
            <div className="min-w-0">
              <b className="type-caption block text-[19px]">{up.live ? "On air now" : t != null ? `Airs ${airTime(t)}` : "Up next"}</b>
              {progressLine(show) && <small className="block text-[13px] text-muted-foreground">{progressLine(show)}</small>}
            </div>
          </div>
        </Block>
      )}
      <Preview id="show.episodes" className="mx-2 mt-[26px] px-2 pb-1 pt-4">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 className="type-caption text-[24px]">Every episode</h2>
          <span className="text-[13px] text-muted-foreground">{CAST.filter((c) => !c.out).length} still in</span>
        </div>
        <Preview id="show.waivers" tag={false} className="mb-1">
          <NavLink
            data-try
            href={paths.showPage(seasonId, "waivers")}
            className="nd-press flex min-h-[68px] w-full items-center gap-3 border-t border-border bg-[linear-gradient(90deg,rgba(255,197,49,.09),transparent)] px-2 text-left"
          >
            <span className="grid w-7 place-items-center text-chyron-line">
              <ArrowLeftRight className="size-5" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <b className="block text-base font-semibold">Waivers · after Episode {WAIVERS.after}</b>
              <small className="mt-0.5 block text-[13px] text-muted-foreground">
                Due {WAIVERS.due} · replace {WAIVERS.replace}
              </small>
            </span>
            <span className="text-[15px] font-semibold text-chyron-line">Open</span>
          </NavLink>
        </Preview>
        {Array.from({ length: SEEN }, (_, k) => SEEN - k).map((e) => (
          <EpisodeRow key={e} e={e} />
        ))}
        <div className="flex min-h-[68px] items-center gap-3 border-y border-border opacity-60">
          <span className="type-num w-7 text-[28px] text-muted-foreground">{SEEN + 2}</span>
          <span className="min-w-0 flex-1">
            <b className="block text-base font-semibold">+ {EPISODES - SEEN - 1} still to air</b>
            <small className="mt-0.5 block text-[13px] text-muted-foreground">
              Episodes {SEEN + 2} to {EPISODES} · {FINALE}
            </small>
          </span>
        </div>
      </Preview>
      <EpisodePage />
    </>
  );
}

function EpisodeRow({ e }: { e: number }) {
  const page = usePushedPage(`ep${e}`);
  const out = outIn(e);
  return (
    <button type="button" data-try data-ep={e} onClick={page.show} className="nd-press flex min-h-[68px] w-full items-center gap-3 border-t border-border text-left">
      <span className="type-num w-7 text-[28px] text-muted-foreground">{e}</span>
      <span className="flex">
        {out.map((c, i) => (
          <Face key={c.name} src={c.photo} out className={`size-10 rounded-[3px] shadow-[0_0_0_2px_var(--background)] ${i ? "-ml-3" : ""}`} />
        ))}
      </span>
      <span className="min-w-0 flex-1">
        <b className="block text-base font-semibold">{out.map((c) => c.first).join(" and ") || "No one"} out</b>
        <small className="mt-0.5 block text-[13px] text-muted-foreground">
          {e < GAMES_FROM ? "Before your games started" : `You +${YOUR_LINEUP[e] ?? 0} in Weekly Lineup`}
        </small>
      </span>
      <ChevronRight className="size-5 flex-none text-muted-foreground" aria-hidden />
    </button>
  );
}

/** The episode page open over the tab, whichever it is (?page=ep4). */
function EpisodePage() {
  const asked = /^ep(\d+)$/.exec(useSearchParams().get("page") ?? "");
  const ep = asked ? Number(asked[1]) : null;
  // Keep the last one while it slides away.
  const [shown, setShown] = useState(ep);
  if (ep != null && ep !== shown) setShown(ep);
  const page = usePushedPage(`ep${shown}`);
  return (
    <PushedPage open={ep != null} onClose={page.close} title={`Episode ${shown ?? ""}`} back="Episodes">
      {shown != null && <EpisodeBody e={shown} />}
    </PushedPage>
  );
}

function GameLine({ game, big, line }: { game: keyof typeof GAME_STYLE; big: string; line: string }) {
  return (
    <div className="grid grid-cols-[118px_1fr] gap-x-2.5 gap-y-0.5 border-t border-border py-3">
      <span className="type-caption row-span-2 self-center text-[13px] tracking-[0.04em]" style={{ color: GAME_STYLE[game].colour }}>
        {game}
      </span>
      <b className="text-lg">{big}</b>
      <small className="block text-[13px] text-muted-foreground">{line}</small>
    </div>
  );
}

function EpisodeBody({ e }: { e: number }) {
  const out = outIn(e);
  const scored = CAST.filter((c) => c.perEp[e - 1])
    .sort((a, b) => b.perEp[e - 1] - a.perEp[e - 1])
    .slice(0, 5);
  const team = YOUR_TEAM.map(castaway);
  const lost = team.filter((c) => c.out === e).length;
  return (
    <Preview id="show.episode" className="mx-2 mb-10 mt-3 px-2 pb-4 pt-4">
      <div className="flex flex-col gap-2.5">
        {out.map((c) => (
          <div key={c.name} className="flex min-h-[64px] items-stretch overflow-hidden rounded-[3px] bg-plate text-plate-foreground shadow-plate">
            <Face src={c.photo} out className="w-16 flex-none" />
            <span className="type-caption -mr-[13px] flex items-center bg-live py-0 pl-3 pr-[22px] text-sm tracking-[0.04em] text-live-foreground [clip-path:polygon(0_0,100%_0,calc(100%_-_13px)_100%,0_100%)]">
              Out
            </span>
            <span className="flex flex-1 flex-col justify-center py-2 pl-5 pr-3">
              <b className="type-caption text-[19px]">{c.name}</b>
              <small className="block text-[13px] text-plate-muted">
                {c.how === "Quit" ? "Quit" : "Voted out"} · finished {ordinal(finished(e))}
              </small>
            </span>
          </div>
        ))}
      </div>
      <section className="mt-[26px]">
        <h2 className="type-caption mb-3 text-[24px]">Your games</h2>
        <GameLine game="Weekly Lineup" big={e < GAMES_FROM ? "—" : `+${YOUR_LINEUP[e] ?? 0}`} line={YOUR_SCORERS[e] ?? "Before the game started"} />
        <GameLine
          game="Survival Pool"
          big={e < GAMES_FROM ? "—" : "Survived"}
          line={e < GAMES_FROM ? `Pool started Episode ${GAMES_FROM}` : `You picked ${YOUR_PICKS[e - GAMES_FROM] ?? "Kristin"}`}
        />
        <GameLine game="Outlast" big={lost ? "Lost one" : "All safe"} line={`${team.filter((c) => !c.out || c.out > e).length} of ${team.length} still in after this episode`} />
      </section>
      <section className="mt-[26px]">
        <h2 className="type-caption mb-3 text-[24px]">Top scorers</h2>
        {scored.map((c, i) => (
          <div key={c.name} className="flex h-[52px] items-center gap-2.5 border-t border-border text-[15px] font-semibold">
            <span className="type-num w-[22px] text-[22px] text-muted-foreground">{i + 1}</span>
            <Face src={c.photo} className="size-[34px] rounded-[3px]" />
            {c.name}
            <span className="type-num ml-auto text-[22px]">+{c.perEp[e - 1]}</span>
          </div>
        ))}
      </section>
      <section className="mt-[26px]">
        <h2 className="type-caption mb-3 text-[24px]">What happened</h2>
        {(HAPPENED[e] ?? []).map(([what, tribe]) => (
          <div key={what} className="flex h-12 items-center gap-3 border-t border-border">
            <span className="type-caption w-[90px] text-sm text-muted-foreground">{what}</span>
            <span className="rounded-[2px] px-2.5 py-1 text-sm font-bold" style={{ background: TRIBES[tribe], color: tribe === "Savu" ? "#fff" : "#121018" }}>
              {tribe}
            </span>
          </div>
        ))}
      </section>
    </Preview>
  );
}
