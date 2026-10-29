"use client";

import { useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { BookOpen, CalendarDays, Ellipsis, EyeOff, Eye, KeyRound, Bell, LogOut, Plus, RotateCcw, Tv, UserPlus, Users, X } from "lucide-react";
import { airTime, calm, justAired, ticks } from "../clock";
import { chatCouch, gameAdmin, useAfterReveal, useAfterWatching, watching, useBackstage, useChatBadge, useCouchForSeason, useHome, useSeasonDraft, useSeasonEpisodes, useSeasonGames, useSpace, type Couch, type DraftGame, type GameRef, type GameView, type Need, type OutPreview, type SeasonEpisodes, type SeasonHeader, type Space } from "../data";
import { leaveToDesk, ReadOnlyPanel, useReadOnly, type ReadOnlyGame } from "../read-only";
import { READ_ONLY_SAYS } from "@/lib/read-only";
import { movesByDue } from "../hub/sections";
import { useNav } from "../nav";
import { isShowTab, paths, SHOW_TABS, type ShowTab } from "../routes";
import { Cast } from "../show/cast";
import { Chat } from "../show/chat";
import { Dock, dockShows, MovesSheet } from "../show/dock";
import { RemindSheet } from "../show/remind";
import { Episodes } from "../show/episodes";
import { Roster } from "../show/roster";
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
import { Sheet } from "../ui/sheet";
import { ShowBar, TabBar } from "../ui/show-bar";
import { openCouchSheet } from "../couch/couch-sheets";
import { PoolPage } from "../show/solo";
import { MakeGamePage, useOpenMake } from "../show/make-game";
import { openWatching, type WhereTarget } from "../watching/sheets";
import { openStartGame } from "../couch/start-game";
import { openPlan, PlanIcon } from "../couch/watch-plans";
import { WatchAlongPage } from "../show/watch-along";
import { ShowNotifySheet } from "../show/notify-sheet";
import { ownPace } from "@/lib/game/streaming";
import { showWords } from "@/lib/game/show-words";

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
  // A couch's game opened read-only from the desk (src/new/read-only.tsx): its couch, which isn't yours, and that game alone.
  const readOnly = useReadOnly(seasonId);
  const yourCouch = useCouchForSeason(home.data, seasonId);
  const couchId = readOnly ? readOnly.couchId : (yourCouch?.id ?? null);
  const canRead = !!home.data || !!readOnly;
  const space = useSpace(seasonId, couchId, canRead);
  const play = useSeasonGames(seasonId, couchId, canRead);
  const episodes = useSeasonEpisodes(seasonId, couchId, canRead);
  const couch = readOnly ? readOnlyCouch(readOnly, space.data) : yourCouch;
  const cached = readOnly ? undefined : home.data?.shows.find((s) => s.seasonId === seasonId);
  const header: SeasonHeader | undefined = space.data ?? cached;
  const games: GameRef[] = space.data?.games ?? cached?.games ?? [];
  const yours = games.filter((g) => g.yourRole);
  // An archived game (step 10 part 2b) stands still: Backstage runs the rest.
  const runs = games.filter((g) => (g.yourRole === "commissioner" || g.yourRole === "admin") && !g.archived);
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
    /** Opened read-only from the desk: the couch's view of this game, at your own mark; nothing here changes. */
    readOnly,
    // From the couch the home already has, so the tab bar doesn't change once the space comes back.
    solo: !readOnly && (!couch || couch.members.length <= 1),
    seenThrough: space.data ? space.data.you.seenThrough : (cached?.seenThrough ?? 0),
    /** What the show calls its episodes and its people ("Game 4", "Players": lib/game/show-words.ts, 0142). */
    words: showWords(header?.show.terms),
    /** You follow it (step 10): on your shows, openly or privately. */
    following: space.data ? space.data.you.following : (cached?.following ?? false),
    /** Watched privately: the couch doesn't see it on your list. */
    watchingPrivately: space.data ? space.data.you.private : (cached?.private ?? false),
    /** How where you are keeps up as episodes air (keep-up.ts): off, Live ("ask") or by itself ("auto"). */
    keepUp: (space.data ? space.data.you.keepUp : cached?.keepUp) ?? "off",
    /** Live's "Seen it?": the episode that's ended past where you are, when there's one to ask about. */
    seenIt: (space.data ? space.data.you.seenIt : cached?.seenIt) ?? null,
    /** You play this season (here or elsewhere): where you are moves with your games' reveals. */
    plays: space.data ? !!space.data.you.plays : !!cached?.games.length,
    /** Set up as a game (step 10): false is "Not a game yet". */
    ready: (space.data ?? cached)?.ready !== false,
    upNext: space.data?.schedule?.upNext ?? cached?.upNext ?? null,
    latestAired: space.data?.schedule?.latestAired ?? cached?.latestAired ?? 0,
    /** A season that drops every episode at once (step 14): never on the air, watched at your own pace. */
    streaming: header?.release === "binge",
    /** Its drop, while it's still to come (ms), else null. */
    dropAt: header?.release === "binge" && header.dropAt ? Date.parse(header.dropAt) : null,
    /** Watched at your own pace (step 14): a streaming season, or a finished one nobody plays a game on here. */
    ownPace: !!header && ownPace({ release: header.release, status: header.status, played: games.length > 0 }),
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

/** The couch of a game open read-only, from its space read (its people); you're not on it. */
function readOnlyCouch(ro: ReadOnlyGame, space: Space | undefined): Couch {
  return {
    id: ro.couchId,
    name: ro.couch,
    yourRole: "member",
    members: (space?.people ?? []).map((p) => ({ userId: p.userId, name: p.name, role: p.role, joinedAt: "", colour: null, picture: null, watching: [] })),
    games: space?.games ?? [],
    seasons: [],
  };
}

/** As people say a show: "The Traitors", not "The Traitors (US)". */
const plainName = (name: string) => name.replace(/\s*\([^)]*\)\s*$/, "").trim() || name;

/** Where you are in this show, for the where sheet (step 10: watching/sheets.tsx). */
export function whereTarget(show: ShowData): WhereTarget | null {
  const h = show.header;
  if (!h) return null;
  const name = plainName(h.show.name);
  return {
    seasonId: h.seasonId,
    label: `${name}${h.seasonNumber ? ` ${h.seasonNumber}` : ""}`,
    show: name,
    artUrl: h.show.artUrl,
    artPosition: "center",
    aired: show.latestAired,
    status: h.status === "upcoming" || h.status === "completed" ? h.status : "airing",
    premiere: h.premiereDate,
    seen: show.seenThrough ?? show.latestAired,
    following: show.following,
    plays: show.plays,
    keepUp: show.keepUp,
    episodeWord: show.words.episode,
  };
}

/** Open where you are (or Add to my shows, on a show you don't follow). */
export function openWhere(show: ShowData) {
  const target = whereTarget(show);
  if (target) openWatching({ kind: "where", target });
}

/** Is this path one of this show's tabs? (Back from a page pushed over the show goes to whichever tab you left.) */
export const isTabOf = (seasonId: string) => (prev: string) => prev.startsWith(`/show/${seasonId}/`) && isShowTab(prev.split("/")[3] ?? "");

/** How many episodes a season has, as far as anyone knows: its count, else what's out. */
export const episodesOf = (show: ShowData) => show.header?.episodeCount ?? show.latestAired;

/** "All 8 episodes · Netflix" (the mock's streaming wBar): a season watched at your own pace, once it's out. */
export function allOut(show: ShowData): string {
  const n = episodesOf(show);
  const network = show.header?.show.network;
  const w = show.words;
  return `${n ? `All ${n} ${w.episodes.toLowerCase()}` : `Every ${w.episode.toLowerCase()}`}${network ? ` · ${network}` : ""}`;
}

/** Where the show is, for the show bar: on air, results to reveal or waiting for them, then where the next episode is
 *  (calm days, a ticking clock inside the last day). A streaming season (step 14): when it drops, then all of it out. */
function useAirStatus(show: ShowData): ReactNode {
  const { upNext, latestAired, episodes } = show;
  const ep = show.words.ep;
  const episodeCount = show.header?.episodeCount ?? null;
  const t = upNext?.airAt ? Date.parse(upNext.airAt) : null;
  const now = useNow(t != null && ticks(t));
  if (show.streaming && !episodes?.reveal) {
    if (show.dropAt != null && show.dropAt > now) return ticks(show.dropAt, now) ? `Drops in ${calm(show.dropAt, now)}` : `Drops ${calm(show.dropAt, now)}`;
    return allOut(show);
  }
  if (show.ownPace && !upNext && !episodes?.reveal && !episodes?.waiting) return allOut(show);
  if (upNext?.live) {
    return (
      <>
        <i className="size-2 animate-pulse rounded-full bg-live" aria-hidden />
        On air · {ep} {upNext.number}
      </>
    );
  }
  if (episodes?.reveal) return `${ep} ${episodes.reveal.episode} ${episodes.reveal.stage === "early" ? "early results" : "results are in"}`;
  if (episodes?.waiting) return `${ep} ${episodes.waiting.episode} ${justAired(episodes.waiting.airAt) ? "just aired" : "aired"}`;
  if (upNext && t != null) return `${ep} ${upNext.number} · ${calm(t, now)}`;
  if (episodeCount && latestAired >= episodeCount) return "Season over";
  if (latestAired) return `${ep} ${latestAired} aired`;
  return null;
}

/** The (tabs) layout: the show bar over the tab's content, the tab bar under it. */
export function SpaceFrame({ seasonId, children }: { seasonId: string; children: ReactNode }) {
  const pathname = usePathname();
  const seg = pathname.split("/")[3] ?? "tonight";
  const tab: ShowTab = isShowTab(seg) ? seg : "tonight";
  const show = useShow(seasonId);
  const nav = useNav();
  const status = useAirStatus(show);
  const ro = show.readOnly;
  // The Chat tab's badge, every 30 s (the open chat polls its own instead, and reading it clears this). Read-only: the
  // couch's chat is theirs, so not even its count.
  const badge = useChatBadge(seasonId, ro ? null : chatCouch(show), show.episodes?.reveal?.episode ?? null, tab !== "chat");

  if (show.notFound) {
    return <EmptyState icon={Tv} title="Show not found" line="It may have been removed." />;
  }
  const tabs = show.solo ? SHOW_TABS.filter((t) => t !== "chat") : SHOW_TABS;
  const dock = !ro && dockShows(show, tab);
  // Room under the content for what sits over its foot: the tab bar, the dock, Chat's composer.
  const foot = 96 + (dock ? 72 : 0) + (tab === "chat" ? 72 : 0);
  return (
    <>
      {show.header ? (
        <ShowBar
          show={{ seasonId, name: show.header.show.name, seasonNumber: show.header.seasonNumber, artUrl: show.header.show.artUrl, backdropUrl: show.header.show.backdropUrl }}
          tall={tab === "tonight"}
          back={ro ? { label: "Desk", onClick: () => leaveToDesk(nav, ro) } : { label: "Home", onClick: () => nav.back(paths.home) }}
          status={status}
          menu={ro ? <ReadOnlyMenu /> : <ShowMenu seasonId={seasonId} show={show} />}
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
        badges={ro ? {} : { tonight: show.movesDue + (show.episodes?.reveal ? 1 : 0), chat: tab === "chat" ? 0 : (badge.data?.unread ?? 0) }}
        labels={{ episodes: show.words.episodesTab, cast: show.words.peopleTab }}
      />
      {/* Read-only (src/new/read-only.tsx): only what's for looking, How it works and the stats page. */}
      {!ro && (
        <>
          <MovesSheet show={show} seasonId={seasonId} />
          <RemindSheet show={show} />
          <RevealScreen show={show} seasonId={seasonId} />
          <MorningSheet show={show} seasonId={seasonId} />
        </>
      )}
      {show.header && (
        <HowItWorksPage seasonId={seasonId} couchId={show.couch?.id ?? null} name={show.header.show.name} seasonNumber={show.header.seasonNumber} artUrl={show.header.show.artUrl} />
      )}
      {show.header && <ShowStatsPage seasonId={seasonId} couchId={show.couch?.id ?? null} name={show.header.show.name} />}
      {!ro && (
        <>
          {/* The season's public pool (step 9 part 3), pushed from the Games tab or the solo hub (?page=pool). */}
          <PoolPage show={show} />
          {/* Make it a game (step 10 part 2a), pushed from the Games tab, Tonight's plate or the ⋯ menu (?page=make). */}
          {show.header && <MakeGamePage show={show} />}
          {/* Watch along (step 13), over the show from Tonight's card, the hub or a link (?page=watch&ep=). */}
          <WatchAlongPage show={show} />
          <WaiverOverlays seasonId={seasonId} show={show} />
        </>
      )}
    </>
  );
}

/** The ⋯ menu while read-only: everything in it would change something (the mock's DG_WRITE has #showMenu). */
function ReadOnlyMenu() {
  return (
    <button type="button" aria-label="Show menu: read-only" data-read-only-menu onClick={() => toast.quiet(READ_ONLY_SAYS)} className="grid size-11 place-items-center rounded-[3px] text-white">
      <Ellipsis className="size-5" aria-hidden />
    </button>
  );
}

/** Tonight's couch line: who's on this show with you, and how many games; on a show with no game here, who on the couch
 *  watches it (the mock's "2 on the couch watch"), "Streaming" on a season that drops at once (step 14), and "Not a game yet"
 *  on a show nobody's set up. */
function CouchLine({ show }: { show: ShowData }) {
  const games = show.games.length;
  const watchers = games ? null : (show.people ?? []).filter((p) => p.watching || p.playing.length);
  const faces = watchers ?? show.people;
  return (
    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 px-2 pt-2.5 text-[13px] font-semibold" data-couch-line>
      {faces && faces.length > 0 && (
        <span className="flex">
          {faces.slice(0, 6).map((p, i) => (
            <span key={p.userId} className={`rounded-[3px] shadow-[0_0_0_2px_var(--background)] ${i ? "-ml-1.5" : ""}`}>
              <Avatar id={p.userId} name={p.name} size={24} />
            </span>
          ))}
        </span>
      )}
      {show.readOnly
        ? `${show.readOnly.couch} · ${show.readOnly.name}`
        : show.solo
          ? "Watching solo"
          : watchers
            ? watchers.length
              ? `${watchers.length} on the couch ${watchers.length === 1 ? "watches" : "watch"}`
              : (show.couch?.name ?? "Your couch")
            : `${show.couch?.name ?? "Your couch"} · ${games} ${games === 1 ? "game" : "games"}`}
      {show.streaming && (
        <span data-streaming className="type-caption rounded-[2px] px-[7px] py-[2px] text-[11px] tracking-[0.05em] outline-1 -outline-offset-1 outline-dashed outline-white/60">
          Streaming
        </span>
      )}
      {!show.ready && (
        <span data-not-a-game className="type-caption rounded-[2px] px-[7px] py-[2px] text-[11px] tracking-[0.05em] outline-1 -outline-offset-1 outline-dashed outline-white/60">
          Not a game yet
        </span>
      )}
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
 *  couch, the drafts (for games that have one), Plan a watch along (step 11 part 3), and this show's Notifications (step 15
 *  part 2). */
function ShowMenu({ seasonId, show }: { seasonId: string; show: ShowData }) {
  const [open, setOpen] = useState(false);
  const [notify, setNotify] = useState(false);
  const [leave, setLeave] = useState<OutPreview | null | false>(false);
  const nav = useNav();
  const refresh = useAfterReveal();
  const how = usePushedPage("how-it-works");
  const openMake = useOpenMake();
  const needs = useBackstageNeeds(seasonId, show);
  // The drafts, read when the menu opens (a game with a team to draft: Outlast, Weekly Lineup).
  const drafting = show.games.some((g) => g.yourRole && (g.gameType === "classic-draft" || g.gameType === "active-roster"));
  const drafts = useSeasonDraft(seasonId, show.couch?.id ?? null, { enabled: open && drafting }).data?.games ?? [];
  const room = drafts.filter((g) => g.kind === "snake");
  const blind = drafts.filter((g) => g.kind === "blind");
  const lead = (list: DraftGame[]) => list.find((g) => g.phase === "live") ?? list.find((g) => g.phase === "waiting") ?? list[0];
  const name = show.header?.show.name ?? "This show";
  const runNames = [...new Set(show.runs.map((g) => g.gameName))].join(" and ");
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
          {show.ready && (
            <Row
              icon={BookOpen}
              title="How it works"
              detail="The show, the games and what scores, in plain words"
              onClick={() => {
                setOpen(false);
                how.show();
              }}
            />
          )}
          <WatchingRows show={show} onDone={() => setOpen(false)} />
          {show.couch && show.games.length > 0 && (
            <Row href={paths.backstage(seasonId, "history")} icon={RotateCcw} title="Recent changes" detail="What's changed in these games, and who changed it" />
          )}
          {room.length > 0 && (
            <Row href={`${paths.showPage(seasonId, "draft")}?game=${lead(room).leagueId}`} icon={Users} title="Draft room" detail={draftLine(lead(room))} />
          )}
          {blind.length > 0 && (
            <Row href={`${paths.showPage(seasonId, "blind")}?game=${lead(blind).leagueId}`} icon={Eye} title="Blind draft" detail={draftLine(lead(blind))} />
          )}
          {show.couch && !show.solo && (
            <Row
              icon={PlanIcon}
              title="Plan a watch along"
              detail={show.streaming ? "Pick a time and start together; anyone can pause for everyone" : "Invite the couch for the live airing or a shared start"}
              onClick={() => {
                setOpen(false);
                openPlan({ kind: "new", seasonId, couchId: show.couch!.id });
              }}
            />
          )}
          {show.couch && (
            <Row
              icon={UserPlus}
              title="Invite to this show"
              detail={`A code; they join ${show.couch.name} too`}
              onClick={() => {
                setOpen(false);
                openCouchSheet({ kind: "invite", couchId: show.couch!.id, show: [name.replace(/^The /, ""), show.header?.seasonNumber].filter(Boolean).join(" ") });
              }}
            />
          )}
          {show.ready ? (
            !show.solo && (
              <Row
                icon={Plus}
                title="Start a game"
                detail="A season game that fits this show. Anyone on the couch can"
                onClick={() => {
                  setOpen(false);
                  openStartGame({ seasonId, couchId: show.couch?.id ?? null });
                }}
              />
            )
          ) : (
            <Row
              icon={Plus}
              title="Make it a game"
              detail="One question to ChatGPT sets it up for every couch"
              onClick={() => {
                setOpen(false);
                openMake();
              }}
            />
          )}
          <Row
            icon={Bell}
            title="Notifications"
            detail="Reminders, results and chat for this show"
            onClick={() => {
              setOpen(false);
              setNotify(true);
            }}
          />
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
                  toast.quiet((e as Error).message);
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
            ? `You leave ${leave.games.join(", ")}. ${leave.drafted ? "Your team and points stay in the standings, but nobody plays it." : "Nothing's been drafted yet, so your seat just goes."} You stay on the couch, and whoever runs the games can bring you back.`
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
      <ShowNotifySheet seasonId={seasonId} open={notify} onOpenChange={setNotify} />
    </>
  );
}

/** The ⋯ menu's watching rows (step 10; the mock's watching.js wMenu): on your shows, watch privately and where you are, and
 *  Remove from my shows (a show you play stays: your games keep it); not on them, Add to my shows. */
function WatchingRows({ show, onDone }: { show: ShowData; onDone: () => void }) {
  const refresh = useAfterWatching();
  const nav = useNav();
  const h = show.header;
  if (!h) return null;
  const name = plainName(h.show.name);
  if (!show.following && !show.plays) {
    return (
      <Row
        icon={Plus}
        title="Add to my shows"
        detail="Then where you are: nothing past it shows"
        onClick={() => {
          onDone();
          openWhere(show);
        }}
      />
    );
  }
  return (
    <>
      {/* A switch, not a row that goes somewhere (the desk's SwitchRow, in the menu's row shape). */}
      <button
        type="button"
        role="switch"
        aria-checked={show.watchingPrivately}
        data-private-switch={show.watchingPrivately ? "on" : "off"}
        onClick={async () => {
          const on = !show.watchingPrivately;
          onDone();
          try {
            await watching.follow(h.seasonId, { following: true, private: on });
            await refresh();
            toast(on ? "Watching privately · only you see it" : "The couch can see you watch it again");
          } catch (e) {
            toast.quiet((e as Error).message);
          }
        }}
        className="nd-press flex min-h-[60px] w-full items-center gap-3 border-t border-border py-2 text-left first:border-t-0"
      >
        <span className="grid size-10 flex-none place-items-center rounded-[3px] bg-secondary">
          {show.watchingPrivately ? <EyeOff className="size-5" aria-hidden /> : <Eye className="size-5" aria-hidden />}
        </span>
        <span className="min-w-0 flex-1">
          <b className="block text-[15px] font-semibold">Watch privately</b>
          <small className="mt-0.5 block text-[13px] text-muted-foreground">Only you see this on your list. Chat and the games still work.</small>
        </span>
        <span aria-hidden className={`relative h-[30px] w-[52px] flex-none rounded-full transition-colors ${show.watchingPrivately ? "bg-foreground" : "bg-secondary"}`}>
          <i className={`absolute top-[3px] size-6 rounded-full transition-[left] ${show.watchingPrivately ? "left-[25px] bg-background" : "left-[3px] bg-muted-foreground"}`} />
        </span>
      </button>
      <Row
        icon={CalendarDays}
        title="Where you are"
        detail={show.plays ? `Moves as you reveal each ${show.words.episode.toLowerCase()}` : show.seenThrough ? `${show.words.episode} ${show.seenThrough}` : "Not started"}
        onClick={() => {
          onDone();
          openWhere(show);
        }}
      />
      {!show.plays && show.following && (
        <Row
          icon={X}
          title="Remove from my shows"
          detail="Where you are is kept if you add it again"
          onClick={async () => {
            onDone();
            try {
              await watching.follow(h.seasonId, { following: false });
              await refresh();
              toast(`${name} removed from your shows`);
              nav.push(paths.home);
            } catch (e) {
              toast.quiet((e as Error).message);
            }
          }}
        />
      )}
    </>
  );
}

/** One tab's content. Everything past Tonight is spoiler-guarded, so it carries the one spoiler chip. */
export function TabScreen({ seasonId, tab }: { seasonId: string; tab: ShowTab }) {
  const show = useShow(seasonId);
  if (!show.header) return <TabSkeleton />;
  return (
    <div data-tab={tab}>
      {tab !== "tonight" && !(show.readOnly && tab === "chat") && (
        <div className="px-4 pt-4">
          <GuardChip seenThrough={show.seenThrough} ep={show.words.ep} onChange={() => openWhere(show)} />
        </div>
      )}
      {tab === "tonight" && (show.readOnly ? <ReadOnlyPanel game={show.readOnly} kind="tonight" /> : <Tonight seasonId={seasonId} show={show} />)}
      {tab === "episodes" && <Episodes seasonId={seasonId} show={show} />}
      {tab === "games" && <Games show={show} />}
      {/* A sport nobody's made a game of has a roster, not a cast with stats (show/roster.tsx). */}
      {tab === "cast" && (show.header?.show.kind === "sport" && !show.ready ? <Roster seasonId={seasonId} show={show} /> : <Cast seasonId={seasonId} show={show} />)}
      {tab === "chat" && (show.readOnly ? <ReadOnlyPanel game={show.readOnly} kind="chat" /> : <Chat seasonId={seasonId} show={show} />)}
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
