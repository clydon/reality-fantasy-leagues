"use client";

import { useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { BookOpen, Ellipsis, Eye, KeyRound, Bell, Plus, Tv, UserPlus, Users } from "lucide-react";
import { calm, ticks } from "../clock";
import { useCouchForSeason, useHome, useSpace, type GameRef, type SeasonHeader, type UpNext } from "../data";
import { useNav } from "../nav";
import { isShowTab, paths, SHOW_TABS, type ShowTab } from "../routes";
import { Avatar, useNow } from "../ui/bars";
import { usePushedPage, PushedPage } from "../ui/page";
import { EmptyState, GuardChip, Row } from "../ui/parts";
import { Preview } from "../ui/preview";
import { Sheet } from "../ui/sheet";
import { ShowBar, TabBar } from "../ui/show-bar";
import type { PreviewId } from "../preview";

// A show space (/show/[seasonId]/[tab]), step 0c's shell: the show bar (the show's art, where the next episode is,
// the ⋯ menu), the five tabs (Tonight · Episodes · Games · Cast · Chat; solo drops Chat) and their placeholders
// until step 0d ports them from the mock (show.js, refine.js tabTonight, gamestab.js, explorer.js).

/** Everything a show's screens share: the couch it opens with, its header (from the home's cache until its own
 *  read comes back), its games, and whether you run one of them. */
export function useShow(seasonId: string) {
  const home = useHome();
  const couch = useCouchForSeason(home.data, seasonId);
  const space = useSpace(seasonId, couch?.id ?? null, !!home.data);
  const cached = home.data?.shows.find((s) => s.seasonId === seasonId);
  const header: SeasonHeader | undefined = space.data ?? cached;
  const games: GameRef[] = space.data?.games ?? cached?.games ?? [];
  const yours = games.filter((g) => g.yourRole);
  const runs = games.filter((g) => g.yourRole === "commissioner" || g.yourRole === "admin");
  const people = space.data?.people ?? null;
  return {
    home: home.data,
    couch,
    space: space.data,
    header,
    games,
    runs,
    people,
    // From the couch the home already has, so the tab bar doesn't change once the space comes back.
    solo: !couch || couch.members.length <= 1,
    seenThrough: space.data ? space.data.you.seenThrough : (cached?.seenThrough ?? 0),
    upNext: space.data?.schedule?.upNext ?? cached?.upNext ?? null,
    latestAired: space.data?.schedule?.latestAired ?? cached?.latestAired ?? 0,
    movesDue: home.data?.moves.filter((m) => yours.some((g) => g.leagueId === m.leagueId)).length ?? 0,
    notFound: (space.error as { status?: number } | null)?.status === 404,
    error: home.error ?? space.error,
  };
}

export type ShowData = ReturnType<typeof useShow>;

/** Is this path one of this show's tabs? (Back from a page pushed over the show goes to whichever tab you left.) */
export const isTabOf = (seasonId: string) => (prev: string) => prev.startsWith(`/show/${seasonId}/`) && isShowTab(prev.split("/")[3] ?? "");

/** Where the next episode is, for the show bar: calm days, a ticking clock inside the last day, "On air" live. */
function useAirStatus(upNext: UpNext | null, latestAired: number, episodeCount: number | null): ReactNode {
  const t = upNext?.airAt ? Date.parse(upNext.airAt) : null;
  const now = useNow(t != null && ticks(t));
  if (upNext?.live) {
    return (
      <>
        <i className="size-2 animate-pulse rounded-full bg-live" aria-hidden />
        On air · Ep {upNext.number}
      </>
    );
  }
  if (upNext && t != null) return `Ep ${upNext.number} · ${calm(t, now)}`;
  if (episodeCount && latestAired >= episodeCount) return "Season over";
  if (latestAired) return `Ep ${latestAired} aired`;
  return null;
}

/** The (tabs) layout: the show bar over the tab's content, the tab bar under it. */
export function SpaceFrame({ seasonId, children }: { seasonId: string; children: ReactNode }) {
  const pathname = usePathname();
  const seg = pathname.split("/")[3] ?? "tonight";
  const tab: ShowTab = isShowTab(seg) ? seg : "tonight";
  const show = useShow(seasonId);
  const nav = useNav();
  const status = useAirStatus(show.upNext, show.latestAired, show.header?.episodeCount ?? null);

  if (show.notFound) {
    return <EmptyState icon={Tv} title="Show not found" line="It may have been removed." />;
  }
  const tabs = show.solo ? SHOW_TABS.filter((t) => t !== "chat") : SHOW_TABS;
  return (
    <>
      {show.header ? (
        <ShowBar
          show={{ seasonId, name: show.header.show.name, seasonNumber: show.header.seasonNumber, artUrl: show.header.show.artUrl }}
          tall={tab === "tonight"}
          back={{ label: "Home", onClick: () => nav.back(paths.home) }}
          status={status}
          menu={<ShowMenu seasonId={seasonId} show={show} />}
          below={<CouchLine show={show} />}
        />
      ) : (
        <div className={`animate-pulse bg-card ${tab === "tonight" ? "h-[250px]" : "h-24"}`} aria-busy />
      )}
      <main className="pb-[calc(96px+env(safe-area-inset-bottom,0px))]">{children}</main>
      <TabBar seasonId={seasonId} tabs={tabs} current={tab} badges={{ tonight: show.movesDue }} />
    </>
  );
}

/** Tonight's couch line: who's on this show with you, and how many games. */
function CouchLine({ show }: { show: ShowData }) {
  const games = show.games.length;
  return (
    <div className="flex items-center gap-2.5 px-2 pt-2.5 text-[13px] font-semibold">
      {show.people && (
        <span className="flex">
          {show.people.slice(0, 6).map((p, i) => (
            <span key={p.userId} className={`rounded-[3px] shadow-[0_0_0_2px_var(--background)] ${i ? "-ml-1.5" : ""}`}>
              <Avatar id={p.userId} name={p.name} size={24} />
            </span>
          ))}
        </span>
      )}
      {show.solo ? "Watching solo" : `${show.couch?.name ?? "Your couch"}${games ? ` · ${games} ${games === 1 ? "game" : "games"}` : ""}`}
    </div>
  );
}

/** The show's ⋯ menu: Backstage for whoever runs a game here, the drafts, and what's still to come. */
function ShowMenu({ seasonId, show }: { seasonId: string; show: ShowData }) {
  const [open, setOpen] = useState(false);
  const how = usePushedPage("how-it-works");
  const name = show.header?.show.name ?? "This show";
  const runNames = [...new Set(show.runs.map((g) => g.gameName))].join(" and ");
  const soon = (id: PreviewId, icon: typeof Bell, title: string, detail: string) => (
    <Preview id={id} tag={false} className="my-1">
      <Row icon={icon} title={title} detail={detail} onClick={() => {}} />
    </Preview>
  );
  return (
    <>
      <button type="button" aria-label="Show menu" onClick={() => setOpen(true)} className="relative grid size-11 place-items-center rounded-[3px] text-white">
        <Ellipsis className="size-5" aria-hidden />
      </button>
      <Sheet
        open={open}
        onOpenChange={setOpen}
        title={name}
        subtitle={[show.header?.seasonNumber ? `Season ${show.header.seasonNumber}` : null, show.couch?.name].filter(Boolean).join(" · ")}
      >
        {/* A row that goes somewhere leaves the sheet open: the show's frame (and the sheet with it) slides away with
            the screen. Closing it first would cut the move short (Base UI closes synchronously). */}
        <div className="flex flex-col">
          {show.runs.length > 0 && (
            <Row href={paths.backstage(seasonId)} icon={KeyRound} iconClass="bg-foreground text-background" title="Backstage" detail={`You run ${runNames}`} />
          )}
          <Row
            icon={BookOpen}
            title="How it works"
            detail="The show, the games and what scores, in plain words"
            onClick={() => {
              setOpen(false);
              how.show();
            }}
          />
          <Row href={paths.showPage(seasonId, "draft")} icon={Users} title="Draft room" detail="Pick your team in turn" />
          <Row href={paths.showPage(seasonId, "blind")} icon={Eye} title="Blind draft" detail="Pick in private, reveal together" />
          {soon("show.invite", UserPlus, "Invite to this show", "A code; they join the couch too")}
          {soon("show.start-game", Plus, "Start a game", "Bingo night, predictions, a new league")}
          {soon("show.notifications", Bell, "Notifications", "Reminders, results and chat for this show")}
        </div>
      </Sheet>
      <PushedPage open={how.open} onClose={how.close} title="How it works" back={name.replace(/^The /, "")}>
        <Preview id="show.how-it-works" className="mx-4 mt-5" />
      </PushedPage>
    </>
  );
}

const TAB_PREVIEW: Record<ShowTab, PreviewId> = {
  tonight: "show.tonight",
  episodes: "show.episodes",
  games: "show.games",
  cast: "show.cast",
  chat: "show.chat",
};

/** One tab's content. Everything past Tonight is spoiler-guarded, so it carries the one spoiler chip. */
export function TabScreen({ seasonId, tab }: { seasonId: string; tab: ShowTab }) {
  const show = useShow(seasonId);
  const [where, setWhere] = useState(false);
  return (
    <div className="px-4 pt-4">
      {tab !== "tonight" && show.header && <GuardChip seenThrough={show.seenThrough} onChange={() => setWhere(true)} className="mb-3" />}
      <Preview id={TAB_PREVIEW[tab]} />
      <Sheet open={where} onOpenChange={setWhere} title="Where you are" subtitle={show.header?.show.name}>
        <Preview id="show.where" />
      </Sheet>
    </div>
  );
}
