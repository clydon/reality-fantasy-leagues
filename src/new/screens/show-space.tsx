"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { usePathname, useSearchParams } from "next/navigation";
import { BookOpen, ChevronRight, Ellipsis, KeyRound, Lock, RotateCcw, Settings, Tv, UserPlus, Users } from "lucide-react";
import { airTime, calm, justAired, ticks } from "../clock";
import { chatCouch, fill, useFill, useBackstage, useChatBadge, useCouchForSeason, useHome, useSeasonDraft, useSeasonEpisodes, useSeasonGames, useSpace, type Couch, type DraftGame, type GameRef, type GameView, type Need, type SeasonEpisodes, type SeasonHeader, type Space } from "../data";
import { leaveToDesk, ReadOnlyPanel, useReadOnly, type ReadOnlyGame } from "../read-only";
import { READ_ONLY_SAYS } from "@/lib/read-only";
import { movesByDue } from "../hub/sections";
import { useNav } from "../nav";
import { isShowTab, paths, SHOW_TABS, type ShowTab } from "../routes";
import { startTuneBack, tunedIn } from "../tune-in";
import { Cast } from "../show/cast";
import { Chat } from "../show/chat";
import { MovesSheet } from "../show/dock";
import { ProgressControl } from "../show/progress";
import { MovesStrip } from "../show/strip";
import { RemindSheet } from "../show/remind";
import { useMe } from "../session";
import { Episodes } from "../show/episodes";
import { Roster } from "../show/roster";
import { Games } from "../show/games";
import { HowItWorksPage } from "../show/how-it-works";
import { MorningSheet, RevealScreen } from "../show/reveal";
import { ShowStatsPage } from "../show/stats";
import { Tonight } from "../show/tonight";
import { WaiverOverlays } from "../show/waivers";
import { Avatar, useNow } from "../ui/bars";
import { Loaded } from "../ui/loaded";
import { toast } from "../ui/toast";
import { usePushedPage } from "../ui/page";
import { EmptyState, GuardChip, Row } from "../ui/parts";
import { RUNNER_JOBS } from "../manage/jobs";
import { Sheet } from "../ui/sheet";
import { ShowBar, TabBar } from "../ui/show-bar";
import { openCouchSheet } from "../couch/couch-sheets";
import { atEnd, caughtUpLine, knownMark, marksOf, plainName, type Mark, type Pace, type Where } from "../couch/where";
import { PoolPage } from "../show/solo";
import { MakeGamePage } from "../show/make-game";
import { GettingReadySheet, ReadyChip, ReadyLine, useFillSync } from "../show/getting-ready";
import { openWatching, type WhereTarget } from "../watching/sheets";
import { openPlan, PlanIcon } from "../couch/watch-plans";
import { WatchAlongPage } from "../show/watch-along";
import { ShowNotifySheet } from "../show/notify-sheet";
import { ShowSettingsPage, useShowSettings } from "../settings/show-page";
import { ownPace } from "@/lib/game/streaming";
import { epName, showWords } from "@/lib/game/show-words";

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
  // A game's read does what's come due in it (league-read.ts readyLeague: a waiver week opening, say), and the home's moves, read
  // beside it, can miss that: the strip said nothing of a replacement until the home's next read (step 3's Alex, 2026-11-15). So
  // once a visit, a games read that lands after the home's reads the home again.
  const qc = useQueryClient();
  const homeAgain = useRef(false);
  useEffect(() => {
    if (homeAgain.current || readOnly || !play.dataUpdatedAt || !home.dataUpdatedAt || play.dataUpdatedAt <= home.dataUpdatedAt) return;
    homeAgain.current = true;
    void qc.invalidateQueries({ queryKey: ["new-design", "home"], exact: true });
  }, [play.dataUpdatedAt, home.dataUpdatedAt, readOnly, qc]);
  const episodes = useSeasonEpisodes(seasonId, couchId, canRead);
  const couch = readOnly ? readOnlyCouch(readOnly, space.data) : yourCouch;
  const cached = readOnly ? undefined : home.data?.shows.find((s) => s.seasonId === seasonId);
  const header: SeasonHeader | undefined = space.data ?? cached;
  // Until the space comes back, the home's games for this show as the space picks them (show-space.ts games()): this
  // couch's and your own solo ones, not your games on another couch, so the count and your moves don't change once it's in.
  const games: GameRef[] = space.data?.games ?? cached?.games.filter((g) => (couchId ? g.couchId === couchId || (!!g.solo && !!g.yourRole) : !!g.yourRole)) ?? [];
  const yours = games.filter((g) => g.yourRole);
  // An archived game (step 10 part 2b) stands still: Backstage runs the rest.
  const runs = games.filter((g) => (g.yourRole === "commissioner" || g.yourRole === "admin") && !g.archived);
  const people = space.data?.people ?? null;
  // Your moves due in this couch's games here, soonest first (the home's list: actionItems; a full lineup carried in isn't due in
  // the window, the server's rule since 2026-11-19).
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
    words: showWords(header?.show.terms, header?.gameNames),
    /** You follow it (step 10): on your shows, openly or privately. */
    following: space.data ? space.data.you.following : (cached?.following ?? false),
    /** Watched privately: the couch doesn't see it on your list. */
    watchingPrivately: space.data ? space.data.you.private : (cached?.private ?? false),
    /** How where you are keeps up as episodes air (keep-up.ts): off, Live ("ask") or by itself ("auto"). */
    keepUp: (space.data ? space.data.you.keepUp : cached?.keepUp) ?? "off",
    /** When results show on this season, set on its settings page (settings Round 2, A7): null follows your account's. */
    results: space.data?.you.results ?? null,
    /** Live's "Seen it?": the episode that's ended past where you are, when there's one to ask about. */
    seenIt: (space.data ? space.data.you.seenIt : cached?.seenIt) ?? null,
    /** "Not yet" to the behind question (behind-ask.tsx): the latest aired episode then, so it isn't asked again until a newer
     *  one airs. Kept with your mark on the server (show_follows.not_yet), so every phone of yours knows. */
    notYet: space.data?.you.notYet ?? null,
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
    // A game at your own pace on it keeps the season watched at your own pace (docs/PLAN-own-pace-games.md).
    ownPace: !!header && ownPace({ release: header.release, status: header.status, played: games.some((g) => !g.ownPace) }),
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
    epWord: show.words.ep,
    names: show.words.names ?? null,
    total: h.episodeCount ?? null,
    next: show.upNext && !show.upNext.live ? { number: show.upNext.number, airAt: show.upNext.airAt ?? null } : null,
    reveal: show.plays ? (show.episodes?.reveal?.episode ?? null) : null,
    outs: Object.fromEntries((show.episodes?.episodes ?? []).filter((e) => e.status === "seen" && e.out?.length).map((e) => [e.number, e.out!.map((c) => ({ name: c.name, photo: c.photo }))])),
  };
}

/** Open where you are (or Add to my shows, on a show you don't follow). */
/** `fromSettings`: opened from the show's settings page, so the sheet doesn't point back there. */
export function openWhere(show: ShowData, openReveal?: (n: number) => void, fromSettings = false) {
  const target = whereTarget(show);
  if (target) openWatching({ kind: "where", target: { ...target, openReveal, fromSettings } });
}

/** Is this path one of this show's tabs? (Back from a page pushed over the show goes to whichever tab you left.) */
export const isTabOf = (seasonId: string) => (prev: string) => prev.startsWith(`/show/${seasonId}/`) && isShowTab(prev.split("/")[3] ?? "");

/** How many episodes a season has, as far as anyone knows: its count, else what's out. */
export const episodesOf = (show: ShowData) => show.header?.episodeCount ?? show.latestAired;

/** The season's last episode has aired ("Season over"): known once its episode count is. */
export const seasonOver = (show: Pick<ShowData, "header" | "latestAired">) => !!show.header?.episodeCount && show.latestAired >= show.header.episodeCount;

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
  // A team's game by its name ("KC @ BUF"), else "Ep 4".
  const ep = (n: number) => epName(show.words, n, "tag");
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
        On air · {ep(upNext.number)}
      </>
    );
  }
  if (episodes?.reveal) return `${ep(episodes.reveal.episode)} ${episodes.reveal.stage === "early" ? "early results" : "results are in"}`;
  if (episodes?.waiting) return `${ep(episodes.waiting.episode)} ${justAired(episodes.waiting.airAt) ? "just aired" : "aired"}`;
  if (upNext && t != null) return `${ep(upNext.number)} · ${calm(t, now)}`;
  if (seasonOver(show)) return "Season over";
  if (latestAired) return `${ep(latestAired)} aired`;
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
  // The Tune in bumper holds until what Tonight shows is in (its own read and the episodes), then folds into the header.
  const settled = !!show.header && !!show.space && !!show.episodes;
  useEffect(() => {
    if (settled) tunedIn(seasonId);
  }, [settled, seasonId]);
  // Getting it ready (show/getting-ready.tsx): while its rules, cast or episodes are being got, the header's chip and line say
  // so; a season you follow of a show that's a game, with nobody in its cast and nothing getting it, is started here, once a visit.
  const filling = ro ? null : (show.header?.filling ?? null);
  const fillRead = useFill(seasonId, !!filling);
  const f = fillRead.data;
  useFillSync(seasonId, f);
  const qc = useQueryClient();
  const started = useRef(false);
  const mine = show.following || show.plays;
  useEffect(() => {
    if (filling !== "missing" || started.current || !mine) return;
    started.current = true;
    fill
      .start(seasonId)
      .then((s) => qc.setQueryData(["new-design", "fill", seasonId], s))
      .catch(() => undefined);
  }, [filling, mine, seasonId, qc]);
  const fillOn = !!f && (f.status === "going" || f.status === "stuck");

  if (show.notFound) {
    return <EmptyState icon={Tv} title="Show not found" line="It may have been removed." />;
  }
  const tabs = show.solo ? SHOW_TABS.filter((t) => t !== "chat") : SHOW_TABS;
  // Room under the content for what sits over its foot: the tab bar, Chat's composer. (The dock went in the design round's step 3:
  // the strip under the show bar says what's yours to set on every tab but Chat.)
  const foot = 96 + (tab === "chat" ? 72 : 0);
  return (
    <>
      {show.header ? (
        <ShowBar
          show={{ seasonId, name: show.header.show.name, seasonNumber: show.header.seasonNumber, artUrl: show.header.show.artUrl, backdropUrl: show.header.show.backdropUrl }}
          tall={tab === "tonight"}
          back={
            ro
              ? { label: "Desk", onClick: () => leaveToDesk(nav, ro) }
              : // Home: the Tune in's reverse, the header dropping into the show's card (else the usual move). Back past the
                // show's own pages you jumped between, to the hub you came from, rather than a new hub on top of them.
                {
                  label: "Home",
                  onClick: () => nav.back(paths.home, undefined, startTuneBack(seasonId) ? "tune" : undefined, (p) => p.startsWith(`/show/${seasonId}/`)),
                }
          }
          // On Tonight the progress control says where the show is (step 3); the chip is the other tabs' short form of it.
          // The progress control says where the show is: tall on Tonight, a line under the bar elsewhere (step 4). Read-only keeps the chip.
          status={fillOn ? <ReadyChip f={f} /> : tab === "tonight" || !ro ? undefined : status}
          progress={fillOn ? <ReadyLine f={f} /> : undefined}
          menu={ro ? <ReadOnlyMenu /> : <ShowMenu seasonId={seasonId} show={show} />}
          below={ro ? <CouchLine show={show} /> : <ProgressControl show={show} />}
        />
      ) : (
        <div className={`animate-pulse bg-card ${tab === "tonight" ? "h-[250px]" : "h-24"}`} aria-busy />
      )}
      <main style={{ paddingBottom: `calc(${foot}px + env(safe-area-inset-bottom, 0px))` }}>
        {!ro && tab !== "tonight" && show.header && <ProgressControl show={show} compact />}
        {!ro && tab !== "chat" && show.header && <MovesStrip show={show} tab={tab} />}
        {children}
      </main>
      <TabBar
        seasonId={seasonId}
        tabs={tabs}
        current={tab}
        badges={ro ? {} : { tonight: show.movesDue + (show.episodes?.reveal ? 1 : 0), chat: tab === "chat" ? 0 : (badge.data?.unread ?? 0) }}
        labels={show.header ? { episodes: show.words.episodesTab, cast: show.words.peopleTab } : null}
      />
      {/* Read-only (src/new/read-only.tsx): only what's for looking, How it works and the stats page. */}
      {!ro && (
        <>
          <MovesSheet show={show} seasonId={seasonId} />
          <RemindSheet show={show} />
          <RevealScreen show={show} seasonId={seasonId} />
          <MorningSheet show={show} seasonId={seasonId} />
          <GettingReadySheet seasonId={seasonId} />
          <ShowSettingsPage seasonId={seasonId} show={show} />
        </>
      )}
      {show.header && (
        <HowItWorksPage seasonId={seasonId} couchId={show.couch?.id ?? null} name={show.header.show.name} seasonNumber={show.header.seasonNumber} artUrl={show.header.show.artUrl} />
      )}
      {show.header && <ShowStatsPage seasonId={seasonId} couchId={show.couch?.id ?? null} name={show.header.show.name} show={show} />}
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
  const me = useMe();
  const games = show.games.length;
  const watchers = games ? null : (show.people ?? []).filter((p) => p.watching || p.playing.length);
  const faces = watchers ?? show.people;
  // Where everyone is (the user's pick B, 2026-11-01): once anyone else here shares how far they are and something has aired,
  // the faces move into the numbered line under this one (WhereLine). Until the space read is in, the home read's couch says the
  // same (its members' shared marks, guard.ts visibleFollows), so the header doesn't grow under you when it lands.
  const seasonId = show.header?.seasonId ?? null;
  const people: ShowData["people"] =
    show.people ??
    (seasonId && show.couch
      ? show.couch.members.map((m) => ({ userId: m.userId, name: m.name, role: m.role, watching: m.watching.includes(seasonId), seen: m.userId === me.id ? null : (m.at?.[seasonId] ?? null), playing: [] }))
      : null);
  const { known, quiet } = marksOf(people, { id: me.id, name: me.name, seen: knownMark(show) });
  const where = !show.readOnly && !show.solo && !!show.couch && !!seasonId && show.latestAired > 0 && known.some((w) => !w.you);
  const pace: Pace = { aired: show.latestAired, total: show.header?.episodeCount ?? 0, ownPace: show.ownPace };
  return (
    <>
      <CouchText show={show} faces={where ? null : faces} watchers={watchers} games={games} />
      {where && show.couch && seasonId && <WhereLine known={known} quiet={quiet} pace={pace} couchId={show.couch.id} seasonId={seasonId} />}
    </>
  );
}

/** The couch line's own words (and, without the numbered line under it, its faces). */
function CouchText({ show, faces, watchers, games }: { show: ShowData; faces: ShowData["people"]; watchers: ShowData["people"]; games: number }) {
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

/**
 * The couch on this show, numbered (the user's pick B of the 2026-11-01 mocks): each face with the last episode they've seen
 * under it (yours ringed, the caught-up in bold, "–" not started), then whoever plays here without their place shown, dimmed and
 * unnumbered; then "3 caught up" over "2 catching up". It opens where everyone is (couch/where-sheet.tsx). On the show's art, so
 * its words are white on a dark glass, never muted grey (DESIGN.md Show Art).
 */
function WhereLine({ known, quiet, pace, couchId, seasonId }: { known: Where[]; quiet: Mark[]; pace: Pace; couchId: string; seasonId: string }) {
  const all = [...known, ...quiet.map((m) => ({ ...m, seen: null }))];
  const shown = all.slice(0, all.length > 6 ? 5 : 6);
  const { top, under } = caughtUpLine(known, pace);
  return (
    <button
      type="button"
      data-where-line
      onClick={() => openCouchSheet({ kind: "where", couchId, seasonId })}
      aria-label={`Where everyone is: ${top}${under ? `, ${under}` : ""}`}
      className="nd-press mx-2 mt-2.5 flex min-h-[60px] items-center gap-3 rounded-[4px] bg-[rgba(16,14,21,.6)] px-2.5 py-2 text-left backdrop-blur-sm"
    >
      <span className="flex flex-none gap-1.5" aria-hidden>
        {shown.map((w) => (
          <span
            key={w.userId}
            data-where-face={w.you ? "you" : w.name}
            data-where-seen={w.seen ?? undefined}
            data-where-quiet={w.seen == null || undefined}
            className="flex w-6 flex-col items-center gap-1"
          >
            <span className={`rounded-[3px] ${w.you ? "outline-2 outline-offset-1 outline-white" : ""} ${w.seen == null ? "opacity-45 grayscale" : ""}`}>
              <Avatar id={w.userId} name={w.name} size={24} />
            </span>
            <span className={`type-num text-[12px] leading-none ${w.seen != null && atEnd(w.seen, pace) ? "font-bold text-white" : "text-white/85"}`}>
              {w.seen == null ? " " : w.seen > 0 ? w.seen : "–"}
            </span>
          </span>
        ))}
        {all.length > shown.length && (
          <span className="flex w-6 flex-col items-center gap-1">
            <span className="type-num grid size-6 place-items-center rounded-[3px] bg-white/15 text-[11px]">+{all.length - shown.length}</span>
          </span>
        )}
      </span>
      <span className="min-w-0 flex-1">
        <b className="block truncate text-[14px] font-semibold">{top}</b>
        {under && <small className="block truncate text-[12.5px] text-white/85">{under}</small>}
      </span>
      <ChevronRight className="size-5 flex-none text-white/85" aria-hidden />
    </button>
  );
}

/** What needs whoever runs a game here (a runner's jobs: settings Round 3a dropped the results jobs, which the bot settles): a dot
 *  on the ⋯ menu and its Games you run row. */
function useBackstageNeeds(seasonId: string, show: ShowData): Need[] {
  const runs = show.runs.length > 0;
  const bs = useBackstage(seasonId, show.couch?.id ?? null, null, { enabled: runs });
  return runs ? (bs.data?.needs ?? []).filter((n) => RUNNER_JOBS.has(n.id)) : [];
}

/** A draft's line on the ⋯ menu: where it stands for you. */
function draftLine(g: DraftGame): string {
  const at = g.scheduledAt ? Date.parse(g.scheduledAt) : null;
  if (g.phase === "waiting") return at ? `${g.name} · starts ${airTime(at)}` : `${g.name} · not started yet`;
  if (g.phase === "done") return `${g.name} · done`;
  if (g.kind === "blind") {
    const left = g.seats.length - g.locked.length;
    return g.you && g.locked.includes(g.you) ? `You're in · waiting for ${left}` : "Pick your team in private";
  }
  if (g.clock?.playerId === g.you) return "You're up";
  const who = g.seats.find((s) => s.playerId === g.clock?.playerId)?.name ?? "someone";
  return `${who} is picking · round ${g.clock?.round ?? 1}`;
}

/** A draft that's waiting on you: it's your pick, or your blind team isn't in yet. */
function draftNeedsYou(g: DraftGame | undefined): boolean {
  if (!g || g.phase !== "live") return false;
  if (g.kind === "blind") return !(g.you && g.locked.includes(g.you));
  return !!g.you && g.clock?.playerId === g.you;
}

/** The show's ⋯ menu: things to do (settings Round 2, docs/design-round/settings-r2-spec.md). Settings about you on this show are
 *  under the gear beside it (settings/show-page.tsx), and the menu's foot says so once, for anyone whose habit still lands here.
 *  Up top, for whoever runs a game, Games you run here (settings Round 3a: Backstage retired) and, for a site admin, this
 *  season in Admin. Then Invite a friend, Plan a watch along, How it works, the drafts and Recent changes. What a show offers is on
 *  its tabs already (Start a game, Make it a game, Add to my shows), so it isn't repeated here. */
function ShowMenu({ seasonId, show }: { seasonId: string; show: ShowData }) {
  // A link can open the menu (`?menu=1`) or this show's Notifications (`?notify=1`: a push's Notification settings button, Your
  // settings' list of what's set on a show): settings Round 1. Read once, then the URL drops them, so back and a reload don't open
  // them again. The show's settings page opens from its own address (`?page=you`: Your settings' Your shows, couches and games).
  const params = useSearchParams();
  const settings = useShowSettings();
  const [open, setOpen] = useState(() => params.get("menu") === "1");
  const [notify, setNotify] = useState(() => params.get("notify") === "1");
  const linked = useRef(false);
  useEffect(() => {
    if (linked.current || (!params.get("menu") && !params.get("notify"))) return;
    linked.current = true;
    const url = new URL(window.location.href);
    url.searchParams.delete("menu");
    url.searchParams.delete("notify");
    window.history.replaceState(null, "", url);
  }, [params]);
  const me = useMe();
  const how = usePushedPage("how-it-works");
  const needs = useBackstageNeeds(seasonId, show);
  // The drafts, read when the menu opens (a game with a team to draft: Outlast, Weekly Lineup).
  const drafting = show.games.some((g) => g.yourRole && (g.gameType === "classic-draft" || g.gameType === "active-roster"));
  const drafts = useSeasonDraft(seasonId, show.couch?.id ?? null, { enabled: open && drafting }).data?.games ?? [];
  const room = drafts.filter((g) => g.kind === "snake");
  const blind = drafts.filter((g) => g.kind === "blind");
  const lead = (list: DraftGame[]) => list.find((g) => g.phase === "live") ?? list.find((g) => g.phase === "waiting") ?? list[0];
  const name = show.header?.show.name ?? "This show";
  const runList = [...new Set(show.runs.map((g) => g.name))];
  const runNames = runList.length < 3 ? runList.join(" and ") : `${runList.slice(0, -1).join(", ")} and ${runList[runList.length - 1]}`;
  const runCount = show.runs.length === 1 ? "1 game" : `${show.runs.length} games`;
  const subtitle = [show.header?.seasonNumber ? `Season ${show.header.seasonNumber}` : null, show.couch?.name].filter(Boolean).join(" · ");
  const canPlan = !!show.couch && !show.solo;
  const canHistory = !!show.couch && show.games.length > 0;
  const nextAt = show.upNext && !show.upNext.live ? (show.upNext.airAt ?? null) : null;
  return (
    <>
      <span className="flex items-center">
        {/* The gear: this show's settings for you (Round 0's one gear on every bar). */}
        <button type="button" aria-label="Your settings for this show" data-show-gear onClick={() => settings.show()} className="grid size-11 place-items-center rounded-[3px] text-white">
          <Settings className="size-5" aria-hidden />
        </button>
        <button type="button" aria-label={needs.length ? "Show menu: a game you run needs you" : "Show menu"} onClick={() => setOpen(true)} className="relative grid size-11 place-items-center rounded-[3px] text-white">
          <Ellipsis className="size-5" aria-hidden />
          {needs.length > 0 && <i data-menu-dot className="absolute right-1.5 top-2 size-2.5 rounded-full bg-chyron ring-2 ring-[rgba(16,14,21,.9)]" aria-hidden />}
        </button>
      </span>
      <Sheet open={open} onOpenChange={setOpen} title={name} subtitle={subtitle}>
        {/* A row that goes somewhere leaves the sheet open: the show's frame (and the sheet with it) slides away with
            the screen. Closing it first would cut the move short (Base UI closes synchronously). */}
        <div className="flex flex-col" data-menu-main>
          {/* Games you run here (settings Round 3a: Backstage retired): an index of your games, each opening its Manage this game. */}
          {show.runs.length > 0 && (
            <Row
              href={paths.backstage(seasonId)}
              icon={KeyRound}
              iconClass="bg-foreground text-background"
              title="Games you run here"
              detail={needs.length ? `${needs[0].title}${needs.length > 1 ? ` · ${needs.length - 1} more` : ""}` : `${runCount} · ${runNames}`}
              dot={needs.length > 0}
            />
          )}
          {me.isSuperAdmin && (
            <Row href={paths.deskItem("season", seasonId)} icon={Tv} iconClass="bg-foreground text-background" title="This season in Admin" detail="Cast, episodes and rules" />
          )}
          {show.couch && (
            <Row
              icon={UserPlus}
              title="Invite a friend"
              detail={`They join ${show.couch.name} with a code`}
              onClick={() => {
                setOpen(false);
                openCouchSheet({ kind: "invite", couchId: show.couch!.id, show: [name.replace(/^The /, ""), show.header?.seasonNumber].filter(Boolean).join(" ") });
              }}
            />
          )}
          {canPlan && (
            <Row
              icon={PlanIcon}
              title="Plan a watch along"
              detail={show.streaming ? "Pick a time and start together" : "Invite the couch to watch together"}
              onClick={() => {
                setOpen(false);
                openPlan({ kind: "new", seasonId, couchId: show.couch!.id });
              }}
            />
          )}
          {show.ready && (
            <Row
              icon={BookOpen}
              title="How it works"
              detail="Games and scoring, in plain words"
              onClick={() => {
                setOpen(false);
                how.show();
              }}
            />
          )}
          {room.length > 0 && (
            <Row href={`${paths.showPage(seasonId, "draft")}?game=${lead(room).leagueId}`} icon={Users} title="Draft room" detail={draftLine(lead(room))} dot={draftNeedsYou(lead(room))} />
          )}
          {blind.length > 0 && (
            <Row href={`${paths.showPage(seasonId, "blind")}?game=${lead(blind).leagueId}`} icon={Lock} title="Blind draft" detail={draftLine(lead(blind))} dot={draftNeedsYou(lead(blind))} />
          )}
          {canHistory && <Row href={paths.backstage(seasonId, "history")} icon={RotateCcw} title="Recent changes" detail="Who changed what in these games" />}
          {/* Where the settings went (PFD's gap: the old habit lands here, so the new way is taught here). */}
          <div data-menu-gear-line className="mt-3 border-t-2 border-border pt-1">
            <Row
              icon={Settings}
              title="Your settings for this show"
              detail="Notifications, how far you've watched, leaving · also under the gear"
              onClick={() => {
                setOpen(false);
                settings.show();
              }}
            />
          </div>
        </div>
      </Sheet>
      <ShowNotifySheet seasonId={seasonId} open={notify} onOpenChange={setNotify} nextAt={nextAt} finished={show.header?.status === "completed"} />
    </>
  );
}

/** One tab's content. Everything past Tonight is spoiler-guarded, so it carries the one spoiler chip. */
export function TabScreen({ seasonId, tab }: { seasonId: string; tab: ShowTab }) {
  const show = useShow(seasonId);
  if (!show.header) return show.error ? <TabError /> : <TabSkeleton />;
  return (
    // The tab's sections, all at once once they're in (ui/loaded.tsx); a tab of its own each time.
    <Loaded key={tab} fallback={<TabSkeleton />}>
      <div data-tab={tab}>
        {/* The one spoiler chip, where there's no progress control: the desk's read-only view (step 4 put the compact control on
            every other tab in its place). */}
        {tab !== "tonight" && show.readOnly && tab !== "chat" && (
          <div className="px-4 pt-4">
            <GuardChip seenThrough={show.seenThrough} ep={show.words.ep} names={show.words.names} onChange={() => openWhere(show)} />
          </div>
        )}
        {tab === "tonight" && (show.readOnly ? <ReadOnlyPanel game={show.readOnly} kind="tonight" /> : <Tonight seasonId={seasonId} show={show} />)}
        {tab === "episodes" && <Episodes seasonId={seasonId} show={show} />}
        {tab === "games" && <Games show={show} />}
        {/* A sport nobody's made a game of has a roster, not a cast with stats (show/roster.tsx). */}
        {tab === "cast" && (show.header?.show.kind === "sport" && !show.ready ? <Roster seasonId={seasonId} show={show} /> : <Cast seasonId={seasonId} show={show} />)}
        {tab === "chat" && (show.readOnly ? <ReadOnlyPanel game={show.readOnly} kind="chat" /> : <Chat seasonId={seasonId} show={show} />)}
      </div>
    </Loaded>
  );
}

/** A show that didn't load says so, with Try again (BACKLOG 85: the skeleton used to stay up for good). */
function TabError() {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  return (
    <div role="alert" data-tab-error className="px-4 pt-8">
      <b className="type-caption block text-[24px]">Couldn&rsquo;t load this show</b>
      <p className="mt-2 text-[15px] leading-snug text-muted-foreground">Check your connection, then try again.</p>
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          await qc.refetchQueries({ queryKey: ["new-design"] }).catch(() => undefined);
          setBusy(false);
        }}
        className="nd-press mt-4 flex h-12 w-full items-center justify-center rounded-[4px] font-bold outline-1 -outline-offset-1 outline-edge"
      >
        {busy ? "Trying…" : "Try again"}
      </button>
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
