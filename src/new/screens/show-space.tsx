"use client";

import { useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { BookOpen, Ellipsis, Eye, KeyRound, Bell, LogOut, Plus, RotateCcw, Tv, UserPlus, Users } from "lucide-react";
import { airTime, calm, justAired, ticks } from "../clock";
import { chatCouch, gameAdmin, useAfterReveal, useBackstage, useChatBadge, useCouchForSeason, useHome, useSeasonDraft, useSeasonEpisodes, useSeasonGames, useSpace, type DraftGame, type GameRef, type GameView, type Need, type OutPreview, type SeasonEpisodes, type SeasonHeader, type UpNext } from "../data";
import { movesByDue } from "../hub/sections";
import { useNav } from "../nav";
import { isShowTab, paths, SHOW_TABS, type ShowTab } from "../routes";
import { Cast } from "../show/cast";
import { Chat } from "../show/chat";
import { Dock, dockShows, MovesSheet } from "../show/dock";
import { Episodes } from "../show/episodes";
import { Games } from "../show/games";
import { HowItWorksPage } from "../show/how-it-works";
import { MorningSheet, RevealScreen } from "../show/reveal";
import { ShowStatsPage } from "../show/stats";
import { Tonight } from "../show/tonight";
import { WaiverOverlays } from "../show/waivers";
import { Avatar, useNow } from "../ui/bars";
import { HoldSheet } from "../ui/guards";
import { toast } from "../ui/toast";
import { usePushedPage } from "../ui/page";
import { EmptyState, GuardChip, Row } from "../ui/parts";
import { Preview } from "../ui/preview";
import { Sheet } from "../ui/sheet";
import { ShowBar, TabBar } from "../ui/show-bar";
import type { PreviewId } from "../preview";

// A show space (/show/[seasonId]/[tab]): the show bar (the show's art, where the next episode is, the ⋯ menu), the
// five tabs (Tonight · Episodes · Games · Cast · Chat; solo drops Chat; each in src/new/show/), the moves dock above
// the tab bar, and what opens over them: Your moves, How it works. Ported from the mock in 0d (show.js, dock.js,
// refine.js tabTonight, gamestab.js, explorer.js, rulebook.js howPage); on real leagues since step 1 (your moves, the
// tables, How it works), the cast and its stats since step 3, the couch's chat since step 4, the rest on fixtures behind
// Preview.

/** Everything a show's screens share: the couch it opens with, its header (from the home's cache until its own
 *  read comes back), its games, whether you run one of them, and your games as you play them (moves, tables). */
export function useShow(seasonId: string) {
  const home = useHome();
  const couch = useCouchForSeason(home.data, seasonId);
  const space = useSpace(seasonId, couch?.id ?? null, !!home.data);
  const play = useSeasonGames(seasonId, couch?.id ?? null, !!home.data);
  const episodes = useSeasonEpisodes(seasonId, couch?.id ?? null, !!home.data);
  const cached = home.data?.shows.find((s) => s.seasonId === seasonId);
  const header: SeasonHeader | undefined = space.data ?? cached;
  const games: GameRef[] = space.data?.games ?? cached?.games ?? [];
  const yours = games.filter((g) => g.yourRole);
  const runs = games.filter((g) => g.yourRole === "commissioner" || g.yourRole === "admin");
  const people = space.data?.people ?? null;
  // Your moves due in this couch's games here, soonest first (the home's list: actionItems).
  const moves = movesByDue(home.data?.moves.filter((m) => yours.some((g) => g.leagueId === m.leagueId)) ?? []);
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
    moves,
    movesDue: moves.length,
    /** Your games here (game-view.ts), in the couch's order; null until they've come back. */
    play: (play.data?.games ?? null) as GameView[] | null,
    /** The episodes as far as you've seen, the next to reveal, the one waiting (season-episodes.ts); null until back. */
    episodes: (episodes.data ?? null) as SeasonEpisodes | null,
    notFound: (space.error as { status?: number } | null)?.status === 404,
    error: home.error ?? space.error,
  };
}

export type ShowData = ReturnType<typeof useShow>;

/** Is this path one of this show's tabs? (Back from a page pushed over the show goes to whichever tab you left.) */
export const isTabOf = (seasonId: string) => (prev: string) => prev.startsWith(`/show/${seasonId}/`) && isShowTab(prev.split("/")[3] ?? "");

/** Where the show is, for the show bar: on air, results to reveal or waiting for them, then where the next episode is
 *  (calm days, a ticking clock inside the last day). */
function useAirStatus(upNext: UpNext | null, latestAired: number, episodeCount: number | null, episodes: SeasonEpisodes | null): ReactNode {
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
  if (episodes?.reveal) return `Ep ${episodes.reveal.episode} ${episodes.reveal.stage === "early" ? "early results" : "results are in"}`;
  if (episodes?.waiting) return `Ep ${episodes.waiting.episode} ${justAired(episodes.waiting.airAt) ? "just aired" : "aired"}`;
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
  const status = useAirStatus(show.upNext, show.latestAired, show.header?.episodeCount ?? null, show.episodes);
  // The Chat tab's badge, every 30 s (the open chat polls its own instead, and reading it clears this).
  const badge = useChatBadge(seasonId, chatCouch(show), show.episodes?.reveal?.episode ?? null, tab !== "chat");

  if (show.notFound) {
    return <EmptyState icon={Tv} title="Show not found" line="It may have been removed." />;
  }
  const tabs = show.solo ? SHOW_TABS.filter((t) => t !== "chat") : SHOW_TABS;
  const dock = dockShows(show, tab);
  // Room under the content for what sits over its foot: the tab bar, the dock, Chat's composer.
  const foot = 96 + (dock ? 72 : 0) + (tab === "chat" ? 72 : 0);
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
      <main style={{ paddingBottom: `calc(${foot}px + env(safe-area-inset-bottom, 0px))` }}>{children}</main>
      {dock && <Dock show={show} />}
      <TabBar
        seasonId={seasonId}
        tabs={tabs}
        current={tab}
        badges={{ tonight: show.movesDue + (show.episodes?.reveal ? 1 : 0), chat: tab === "chat" ? 0 : (badge.data?.unread ?? 0) }}
      />
      <MovesSheet show={show} seasonId={seasonId} />
      <RevealScreen show={show} seasonId={seasonId} />
      <MorningSheet show={show} seasonId={seasonId} />
      {show.header && (
        <HowItWorksPage seasonId={seasonId} couchId={show.couch?.id ?? null} name={show.header.show.name} seasonNumber={show.header.seasonNumber} artUrl={show.header.show.artUrl} />
      )}
      {show.header && <ShowStatsPage seasonId={seasonId} couchId={show.couch?.id ?? null} name={show.header.show.name} />}
      <WaiverOverlays seasonId={seasonId} show={show} />
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

/** What needs whoever runs a game here (Backstage's results jobs, step 5): a dot on the ⋯ menu and its Backstage row. */
function useBackstageNeeds(seasonId: string, show: ShowData): Need[] {
  const runs = show.runs.length > 0;
  const bs = useBackstage(seasonId, show.couch?.id ?? null, null, { enabled: runs });
  return runs ? (bs.data?.needs ?? []) : [];
}

/** A draft's line on the ⋯ menu: where it stands for you. */
function draftLine(g: DraftGame): string {
  const at = g.scheduledAt ? Date.parse(g.scheduledAt) : null;
  if (g.phase === "waiting") return at ? `${g.name} · starts ${airTime(at)}` : `${g.name} · not started yet`;
  if (g.phase === "done") return `${g.name} · done · see the teams`;
  if (g.kind === "blind") {
    const left = g.seats.length - g.locked.length;
    return g.you && g.locked.includes(g.you) ? `You're in · waiting for ${left}` : "Pick your team in private";
  }
  if (g.clock?.playerId === g.you) return "You're up";
  const who = g.seats.find((s) => s.playerId === g.clock?.playerId)?.name ?? "someone";
  return `${who} is picking · round ${g.clock?.round ?? 1}`;
}

/** The show's ⋯ menu: Backstage for whoever runs a game here (with a dot when it needs you), Recent changes for the
 *  couch, the drafts (for games that have one), and what's still to come. */
function ShowMenu({ seasonId, show }: { seasonId: string; show: ShowData }) {
  const [open, setOpen] = useState(false);
  const [leave, setLeave] = useState<OutPreview | null | false>(false);
  const nav = useNav();
  const refresh = useAfterReveal();
  const how = usePushedPage("how-it-works");
  const needs = useBackstageNeeds(seasonId, show);
  // The drafts, read when the menu opens (a game with a team to draft: Outlast, Weekly Lineup).
  const drafting = show.games.some((g) => g.yourRole && (g.gameType === "classic-draft" || g.gameType === "active-roster"));
  const drafts = useSeasonDraft(seasonId, show.couch?.id ?? null, { enabled: open && drafting }).data?.games ?? [];
  const room = drafts.filter((g) => g.kind === "snake");
  const blind = drafts.filter((g) => g.kind === "blind");
  const lead = (list: DraftGame[]) => list.find((g) => g.phase === "live") ?? list.find((g) => g.phase === "waiting") ?? list[0];
  const name = show.header?.show.name ?? "This show";
  const runNames = [...new Set(show.runs.map((g) => g.gameName))].join(" and ");
  const soon = (id: PreviewId, icon: typeof Bell, title: string, detail: string) => (
    <Preview id={id} tag={false} className="my-1">
      <Row icon={icon} title={title} detail={detail} onClick={() => {}} />
    </Preview>
  );
  return (
    <>
      <button type="button" aria-label={needs.length ? "Show menu: Backstage needs you" : "Show menu"} onClick={() => setOpen(true)} className="relative grid size-11 place-items-center rounded-[3px] text-white">
        <Ellipsis className="size-5" aria-hidden />
        {needs.length > 0 && <i data-menu-dot className="absolute right-1.5 top-2 size-2.5 rounded-full bg-chyron ring-2 ring-[rgba(16,14,21,.9)]" aria-hidden />}
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
            <Row
              href={paths.backstage(seasonId)}
              icon={KeyRound}
              iconClass="bg-foreground text-background"
              title="Backstage"
              detail={needs.length ? needs[0].title : `You run ${runNames}`}
              dot={needs.length > 0}
            />
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
          {show.couch && show.games.length > 0 && (
            <Row href={paths.backstage(seasonId, "history")} icon={RotateCcw} title="Recent changes" detail="What's changed in these games, and who changed it" />
          )}
          {room.length > 0 && (
            <Row href={`${paths.showPage(seasonId, "draft")}?game=${lead(room).leagueId}`} icon={Users} title="Draft room" detail={draftLine(lead(room))} />
          )}
          {blind.length > 0 && (
            <Row href={`${paths.showPage(seasonId, "blind")}?game=${lead(blind).leagueId}`} icon={Eye} title="Blind draft" detail={draftLine(lead(blind))} />
          )}
          {soon("show.invite", UserPlus, "Invite to this show", "A code; they join the couch too")}
          {soon("show.start-game", Plus, "Start a game", "Bingo night, predictions, a new league")}
          {soon("show.notifications", Bell, "Notifications", "Reminders, results and chat for this show")}
          {show.couch && show.games.some((g) => g.yourRole) && (
            <Row
              icon={LogOut}
              title="Leave these games"
              detail="Your team stays in the standings; nobody plays it"
              onClick={async () => {
                setOpen(false);
                setLeave(null);
                try {
                  setLeave(await gameAdmin.leave(seasonId, show.couch!.id, true));
                } catch (e) {
                  setLeave(false);
                  toast((e as Error).message);
                }
              }}
            />
          )}
        </div>
      </Sheet>
      {/* Tier 3: hard to undo, so a hold; never as a game's last Commissioner. */}
      <HoldSheet
        open={leave !== false}
        onOpenChange={(o) => !o && setLeave(false)}
        title="Leave these games?"
        consequence={
          leave
            ? `You leave ${leave.games.join(", ")}. ${leave.drafted ? "Your team and points stay in the standings, but nobody plays it." : "Nothing's been drafted yet, so your seat just goes."} Whoever runs the games can bring you back.`
            : null
        }
        problem={leave ? leave.problem : null}
        cta="leave"
        onConfirm={async () => {
          await gameAdmin.leave(seasonId, show.couch!.id);
          await refresh();
          toast("You've left the games here");
          nav.push(paths.home);
        }}
      />
    </>
  );
}

/** One tab's content. Everything past Tonight is spoiler-guarded, so it carries the one spoiler chip. */
export function TabScreen({ seasonId, tab }: { seasonId: string; tab: ShowTab }) {
  const show = useShow(seasonId);
  const [where, setWhere] = useState(false);
  if (!show.header) return <TabSkeleton />;
  return (
    <div data-tab={tab}>
      {tab !== "tonight" && (
        <div className="px-4 pt-4">
          <GuardChip seenThrough={show.seenThrough} onChange={() => setWhere(true)} />
        </div>
      )}
      {tab === "tonight" && <Tonight seasonId={seasonId} show={show} />}
      {tab === "episodes" && <Episodes seasonId={seasonId} show={show} />}
      {tab === "games" && <Games show={show} />}
      {tab === "cast" && <Cast seasonId={seasonId} show={show} />}
      {tab === "chat" && <Chat seasonId={seasonId} show={show} />}
      <Sheet open={where} onOpenChange={setWhere} title="Where you are" subtitle={show.header.show.name}>
        <Preview id="show.where" />
      </Sheet>
    </div>
  );
}

function TabSkeleton() {
  return (
    <div aria-busy className="animate-pulse px-4 pt-5">
      <div className="h-7 w-40 rounded-[3px] bg-card" />
      <div className="mt-4 h-48 rounded-[4px] bg-card" />
      <div className="mt-6 h-24 rounded-[4px] bg-card" />
    </div>
  );
}
