"use client";

import type { ReactNode } from "react";
import { CalendarDays, ChevronLeft, MessageCircle, Trophy, Tv, Users, type LucideIcon } from "lucide-react";
import { NavLink } from "../nav";
import { paths, type ShowTab } from "../routes";

// A show space's frame (the mock's .sbar and .tabbar, show.js showBar / tabBar): the show bar with the show's art
// behind it, tall on Tonight and compact on the other tabs (sticky), and the tab bar fixed at the bottom. During a
// tab move both hold still while the content nudges (new.css: .nd-showbar, .nd-tabbar, .nd-tabind).

/**
 * A show's art, with data-art so a channel change can find it (nav.tsx grows the tapped one into the show bar). No
 * art: the name set large on a dark plate.
 */
export function ShowArt({
  seasonId,
  artUrl,
  name,
  className = "",
  position = "center",
}: {
  seasonId: string;
  artUrl: string | null;
  name: string;
  className?: string;
  position?: string;
}) {
  return artUrl ? (
    // eslint-disable-next-line @next/next/no-img-element -- art_url can be an arbitrary external URL
    <img src={artUrl} alt="" data-art={seasonId} className={`object-cover ${className}`} style={{ objectPosition: position }} />
  ) : (
    <span
      data-art={seasonId}
      className={`dark type-caption grid place-items-center overflow-hidden bg-[linear-gradient(135deg,#2a2633,#100e15)] p-3 text-center text-[30px] leading-[.9] text-foreground/25 ${className}`}
    >
      {name}
    </span>
  );
}

export interface ShowBarShow {
  seasonId: string;
  name: string;
  seasonNumber: number | null;
  artUrl: string | null;
}

/**
 * The show bar. `tall`: Tonight's big header, the name large with `below` under it (the couch line); otherwise
 * compact and sticky, with `title` (default "Survivor · S51").
 */
export function ShowBar({
  show,
  tall,
  back,
  status,
  menu,
  title,
  below,
}: {
  show: ShowBarShow;
  tall?: boolean;
  back: { label: string; onClick: () => void };
  status?: ReactNode;
  menu?: ReactNode;
  title?: ReactNode;
  below?: ReactNode;
}) {
  const season = show.seasonNumber ? `S${show.seasonNumber}` : null;
  return (
    <header
      // Night in both themes (step 15 part 4): it's the show's art, on its own dark plate; on Studio a dark band over the light page.
      className={`nd-showbar dark isolate z-20 flex flex-col overflow-hidden px-2 pb-2.5 pt-[calc(8px+env(safe-area-inset-top,0px))] text-white ${
        tall ? "relative min-h-[250px] pb-4" : "sticky top-0 min-h-[96px]"
      }`}
    >
      <ShowArt
        seasonId={show.seasonId}
        artUrl={show.artUrl}
        name={show.name}
        position={tall ? "100% 40%" : "center"}
        className={`absolute inset-y-0 -z-[2] h-full ${tall ? "right-0 w-[70%]" : "inset-x-0 w-full"}`}
      />
      <span
        aria-hidden
        className={`absolute inset-0 -z-[1] ${
          tall
            ? "bg-[linear-gradient(90deg,var(--background)_0%,rgba(22,20,29,.85)_30%,rgba(22,20,29,.1)_65%),linear-gradient(180deg,transparent_60%,var(--background)_100%)]"
            : "bg-[linear-gradient(180deg,rgba(16,14,21,.55),rgba(16,14,21,.92))]"
        }`}
      />
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={back.onClick}
          className="flex h-10 items-center gap-0.5 rounded-[3px] bg-[rgba(16,14,21,.45)] pl-1 pr-2.5 text-[15px] font-semibold backdrop-blur-sm"
        >
          <ChevronLeft className="size-5" aria-hidden />
          {back.label}
        </button>
        {status && (
          <span className="ml-auto flex items-center gap-1.5 rounded-[2px] bg-[rgba(16,14,21,.6)] px-[9px] py-1.5 text-xs font-bold tabular-nums backdrop-blur-sm">
            {status}
          </span>
        )}
        <span className={status ? "" : "ml-auto"}>{menu}</span>
      </div>
      {tall ? (
        <>
          <h1 className="type-caption mt-auto px-2 text-[54px] [text-shadow:0_2px_20px_rgba(0,0,0,.5)]">
            {show.name.replace(/^The /, "")}
            {show.seasonNumber && (
              <small className="mt-1.5 block text-[15px] font-semibold normal-case tracking-normal opacity-90 [font-stretch:100%]">Season {show.seasonNumber}</small>
            )}
          </h1>
          {below}
        </>
      ) : (
        <b className="type-caption block px-2 pt-2.5 text-[20px]">{title ?? (season ? `${show.name} · ${season}` : show.name)}</b>
      )}
    </header>
  );
}

const TAB_META: Record<ShowTab, { label: string; icon: LucideIcon }> = {
  tonight: { label: "Tonight", icon: Tv },
  episodes: { label: "Episodes", icon: CalendarDays },
  games: { label: "Games", icon: Trophy },
  cast: { label: "Cast", icon: Users },
  chat: { label: "Chat", icon: MessageCircle },
};

/** The show's tabs. A tab move replaces the history entry: back from any tab leaves the show. */
export function TabBar({ seasonId, tabs, current, badges = {} }: { seasonId: string; tabs: readonly ShowTab[]; current: ShowTab; badges?: Partial<Record<ShowTab, number>> }) {
  const i = tabs.indexOf(current);
  const n = tabs.length;
  return (
    <nav
      aria-label="Show"
      className="nd-tabbar nd-fixed-x fixed bottom-0 z-30 grid h-[calc(66px+env(safe-area-inset-bottom,0px))] border-t border-border bg-panel-menu/94 pb-[env(safe-area-inset-bottom,0px)] backdrop-blur-[14px]"
      style={{ gridTemplateColumns: `repeat(${n}, 1fr)` }}
    >
      {tabs.map((tab) => {
        const { label, icon: Icon } = TAB_META[tab];
        const on = tab === current;
        const badge = badges[tab];
        return (
          <NavLink
            key={tab}
            href={paths.show(seasonId, tab)}
            replace
            aria-current={on ? "page" : undefined}
            className={`relative flex flex-col items-center justify-center gap-[5px] text-[11.5px] font-semibold transition-colors ${on ? "text-foreground" : "text-muted-foreground"}`}
          >
            <Icon
              className={`size-5 transition-transform duration-[350ms] ease-[cubic-bezier(.34,1.45,.64,1)] ${on ? "-translate-y-0.5 text-chyron-line" : ""}`}
              aria-hidden
            />
            {label}
            {!!badge && (
              <span className="absolute left-[calc(50%+5px)] top-[7px] grid h-[18px] min-w-[18px] place-items-center rounded-[9px] bg-live px-[5px] text-[11px] font-extrabold text-live-foreground">
                {badge}
              </span>
            )}
          </NavLink>
        );
      })}
      {i >= 0 && (
        <i
          aria-hidden
          className="nd-tabind pointer-events-none absolute -top-px h-[3px] rounded-b-[2px] bg-chyron-line"
          style={{ left: `calc(${i} * 100% / ${n} + 30% / ${n})`, width: `calc(40% / ${n})` }}
        />
      )}
    </nav>
  );
}
