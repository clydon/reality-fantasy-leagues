"use client";

import { inShowWords } from "@/lib/game/show-words";
import { useWithRoles } from "../sports/faces";
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, Clock, Heart, Hourglass, Minus, MoreHorizontal } from "lucide-react";
import { LATE_SET, LateMark } from "./lineup-sheet";
import { lockTime } from "../clock";
import { useQueryClient } from "@tanstack/react-query";
import { chooseTwist, couches, setGroupSlot, useAfterCouch, useGameQuestions, useLeagueRoles, useLeagueTwist, useSeasonDraft, useSeasonGame, useSeasonWaivers, type GameView, type LeagueTwist } from "../data";
import { NavLink, useNav } from "../nav";
import { paths } from "../routes";
import { isTabOf, openWhere, useShow, type ShowData } from "../screens/show-space";
import { colourOf } from "../tune-in";
import { Avatar } from "../ui/bars";
import { Btn, EmptyState, Row } from "../ui/parts";
import { Sheet } from "../ui/sheet";
import { ordinal } from "../games";
import { toast } from "../ui/toast";
import { has } from "@/lib/game/game-page/compile";
import { splitFrame, frameStyle } from "@/lib/art-frame";
import { pageModel, type HeroM, type PageModel, type StripM, type Tone } from "@/lib/game/game-page/model";
import { nightKind, type Square } from "@/lib/game/game-plays";
import { openBingo } from "./bingo";
import { openCall } from "./calls";
import { GroupRows, groupShort, MovesSheet } from "./dock";
import { openMoves } from "./moves";
import { Face } from "./parts";
import { answerWords, openSheet, QuestionsBody } from "./questions";
import { DrillSheets, NightBadge, PersonBody, totalWords, useDrill, type DrillState } from "./game-sheets";
import { GameTitleCard } from "./game-title";
import { kickerOf } from "../ui/title-card";
import { playsWaivers } from "./waivers";
import { yourMove } from "./your-move";
import { SideBetsRow, waiverLine, WeekBlock, WeekGames, YourTeam } from "./game-week";
import { oneGame, thisWeek } from "./this-week";
import { AgainRow, finalLine } from "./whats-on";
import { GameSettingsPage, useGameSettingsPage } from "../backstage/game-settings";

// A game's own page (docs/PLAN-start-a-game-gpt.md U1; the direction contract .impeccable/surfaces/src-new-show-game-page-tsx.md,
// "The broadcast segment"): any game, generated from its spec, runs like a segment of the show. A title card (the game's name in
// 64px caps over the show's art, a plate on the show's colour with when it airs), the alert strip (your move: the screen's one
// yellow), one big graphic (where you stand, at full size, in the game's own terms), the move made in place when it is the main
// block (a game of questions: the sixteen controls, answer-controls.tsx, with a named white confirm), the couch as stacked lower
// thirds then standings rows, Previously on as the reveal's stacked plates, and How it plays. What goes where is the spec's
// (src/lib/game/game-page: the grammar, the compiler, the model); this file only draws it. The quick actions stay plain and stay
// where they are: Tonight's card, the dock and the Your moves sheet. Signature motion: on open the title plate slides in on its
// tag; after a reveal the couch's plates restack in their new order. Transform and opacity only; none under reduced motion.

export function GamePageScreen({ seasonId, leagueId }: { seasonId: string; leagueId: string }) {
  const show = useShow(seasonId);
  const nav = useNav();
  const back = () => nav.back(paths.show(seasonId, "games"), isTabOf(seasonId));
  // B3: a finished game isn't in the running read; its page reads it by itself.
  const inPlay = show.play?.find((x) => x.leagueId === leagueId) ?? null;
  const one = useSeasonGame(seasonId, show.couch?.id ?? null, leagueId, !!show.play && !inPlay && !show.readOnly);
  const g = useWithRoles(inPlay ?? one.data?.games[0] ?? null, seasonId, show.header?.show.kind === "sport");
  if (!show.play || (!inPlay && !show.readOnly && one.isLoading)) return <Loading onBack={back} />;
  if (!g)
    return (
      <>
        <TopBar onBack={back} show={show.header?.show.name ?? ""} />
        <EmptyState title="This game isn't one of yours here" line="It may have ended, or you're not in it. Its couch's games are on the Games tab." />
      </>
    );
  return <GamePageBody show={show} g={g} onBack={back} />;
}

function Loading({ onBack }: { onBack: () => void }) {
  return (
    <div aria-busy>
      <TopBar onBack={onBack} show="" />
      <div className="mx-4 mt-16 h-14 w-3/4 animate-pulse rounded-[3px] bg-card" />
      <div className="mx-4 mt-6 h-[52px] w-[276px] animate-pulse rounded-[3px] bg-card" />
      <div className="mx-4 mt-8 h-[60px] animate-pulse rounded-[3px] bg-card" />
      <div className="mx-4 mt-8 h-40 animate-pulse rounded-[3px] bg-card" />
    </div>
  );
}

function TopBar({ onBack, show, game, onMenu }: { onBack: () => void; show: string; game?: string; onMenu?: () => void }) {
  return (
    <div className="relative grid h-14 grid-cols-[auto_1fr_auto] items-center gap-1 px-2.5">
      <button type="button" onClick={onBack} data-game-back className="nd-press flex h-11 items-center gap-0.5 rounded-[3px] pl-1 pr-2 text-[15px] font-semibold">
        <ChevronLeft className="size-5" aria-hidden />
        Games
      </button>
      <span className="min-w-0 text-center" data-game-name>
        {game && <small className="block truncate text-[11px] font-semibold uppercase tracking-[0.06em] text-foreground/70">{show}</small>}
        {(game ?? show) && <b className="type-caption block truncate text-[20px] leading-[1.05]">{game ?? show}</b>}
      </span>
      {onMenu ? (
        <button type="button" onClick={onMenu} aria-label="About this game" data-game-menu-open className="nd-press grid size-11 place-items-center rounded-[3px]">
          <MoreHorizontal className="size-5" aria-hidden />
        </button>
      ) : (
        <span className="size-11" />
      )}
    </div>
  );
}

function GamePageBody({ show, g, onBack }: { show: ShowData; g: GameView; onBack: () => void }) {
  const seasonId = show.header?.seasonId ?? g.leagueId;
  const couchId = show.couch?.id ?? null;
  const nav = useNav();
  const settingsPage = useGameSettingsPage();
  // Your move in this game, as the Games tab's card says it (the draft and the mid-season draft included).
  const draftsIn = (x: GameView) => (x.gameType === "classic-draft" || x.gameType === "active-roster") && !!x.you && (x.you.team.length === 0 || x.from === null || x.through < x.from);
  // A game in stages drafts in its stages: the page leads with the stage being played now, so its draft is read too (a draft that
  // waits for whoever runs the game says so here as on the strip: docs/design-round/draft-start-spec.md).
  const drafting = draftsIn(g) || (show.play ?? []).some((x) => x.stageOf === g.leagueId && draftsIn(x));
  const drafts = useSeasonDraft(seasonId, couchId, { enabled: !!show.header && drafting }).data?.games;
  const waivers = useSeasonWaivers(seasonId, couchId, !!show.header && playsWaivers(show)).data?.games;
  // A time as far off as it is: "Wed 8:00 PM" within the week, the date too past it (clock.ts lockTime).
  const when = (iso: string) => lockTime(Date.parse(iso));
  const moveOf = (x: GameView) => yourMove(x, { seasonId, episode: show.words.episode, when, draft: x.leagueId === g.leagueId || x.stageOf === g.leagueId ? drafts?.find((d) => d.leagueId === x.leagueId) : undefined, waivers: waivers?.find((w) => w.leagueId === x.leagueId) });
  const move = moveOf(g);
  // Secret roles and the top scorer's twist live on the server (their own routes): read only on a game that has them.
  const roles = useLeagueRoles(g.leagueId, has(g.page, "badge", "role")).data ?? null;
  const twist = useLeagueTwist(g.leagueId, has(g.page, "move", "twist")).data ?? null;
  // A game in stages: each stage is a game of its own on the show, under this one.
  const stageGames = (show.play ?? []).filter((x) => x.stageOf === g.leagueId).map((x) => ({ leagueId: x.leagueId, name: x.name, over: x.over, airsAt: x.lineup?.airsAt ?? x.pick?.airsAt ?? null }));
  const ctxOf = (x: GameView, mv: ReturnType<typeof yourMove>) => ({
    show: show.header?.show.name ?? "",
    words: show.words,
    next: show.upNext ? { number: show.upNext.number, airsAt: show.upNext.airAt } : null,
    when,
    move: mv ? { kind: mv.kind, title: mv.title, line: mv.line, due: mv.due, go: mv.go } : null,
    line: inShowWords(x.short, show.words),
    seen: show.seenThrough,
    roles: roles ? { name: roles.roles.name, count: roles.roles.count, dealt: roles.dealt, mine: roles.mine, revealed: roles.revealed } : null,
    twist: twist ? { options: twist.twist.of, next: twist.next, played: twist.played } : null,
    stageGames: x.leagueId === g.leagueId ? stageGames : [],
  });
  const m = pageModel(g, g.page, ctxOf(g, move));
  // A game in stages leads with the stage being played now: its week, its move (never "All set" while a stage has one: DN 33).
  // Before the game starts its hero names no stage yet: the first one still to play is the one being set up now (its draft, say).
  const firstOpen = (show.play ?? []).filter((x) => x.stageOf === g.leagueId && !x.over).sort((a, b) => (a.from ?? Infinity) - (b.from ?? Infinity))[0] ?? null;
  const nowStage = m.hero.stages?.find((st) => st.now)?.leagueId ?? firstOpen?.leagueId ?? null;
  const stage = g.plays.kind === "staged" ? ((show.play ?? []).find((x) => x.leagueId === nowStage) ?? null) : null;
  const wg = stage ?? g;
  const wmove = stage ? moveOf(stage) : move;
  const wm = stage ? pageModel(stage, stage.page, ctxOf(stage, wmove)) : m;
  const strip0 = wm.strip;
  // The lock said once: the week's label gives the time, so a lineup that locks when it airs says just that.
  const atAir = show.header?.show.kind !== "sport" && wmove?.kind === "lineup" && strip0.due && !!wg.lineup && !wg.lineup.lockedBy && !wg.lineup.eachGame && !wg.late;
  const strip = atAir ? { ...strip0, title: "Set your lineup", line: wg.lineup!.carried ? "Locks when it airs · last week's stands in till then" : "Locks when it airs" } : strip0;
  const week = thisWeek(wg, {
    words: show.words,
    total: (r) => totalWords(wg, r),
    underWay: wg.lineup?.eachGame && wg.lineup.airsAt && Date.parse(wg.lineup.airsAt) <= Date.now() ? `Under way · all locked by ${wg.lineup.eachGame.until ? when(wg.lineup.eachGame.until) : "its last game"}` : null,
    next: show.upNext ? { number: show.upNext.number, when: show.upNext.airAt ? when(show.upNext.airAt) : null } : null,
    move: wmove ? { kind: wmove.kind, due: wmove.due } : null,
    seen: show.seenThrough,
    locked: wg.locked ?? null,
    reveal: show.episodes?.reveal ?? null,
    aired: show.latestAired,
  });
  const runs = g.yourRole === "commissioner" || g.yourRole === "admin";
  const afterCouch = useAfterCouch();
  // Every name, square, episode and face is a door (game-sheets.tsx): each a sheet over the last, the path back on top.
  const drill = useDrill();
  const [menu, setMenu] = useState(false);
  // The card's name scrolled under the top: the bar that stays names the game.
  const [away, setAway] = useState(false);
  const art = show.header?.show.backdropUrl ?? show.header?.show.artUrl ?? null;
  const [colour, setColour] = useState<string | null>(null);
  useEffect(() => {
    let on = true;
    colourOf(seasonId, art).then((c) => on && setColour(c));
    return () => {
      on = false;
    };
  }, [seasonId, art]);
  const exclusive = m.chips.some((c) => /one owner/i.test(c));
  const lastEp = week?.last && week.last.result !== "final" ? week.last.episode : null;
  // Read once as the page opens (it renders only once its games are back, so on the phone); the mark is written after.
  const newsKey = `gys:game-news:${wg.leagueId}`;
  const [news] = useState(() => {
    if (lastEp === null) return false;
    try {
      return lastEp > Number(localStorage.getItem(newsKey) ?? 0);
    } catch {
      return false; // No storage (a private window): the result shows as a plain line.
    }
  });
  useEffect(() => {
    if (lastEp === null) return;
    try {
      localStorage.setItem(newsKey, String(Math.max(lastEp, Number(localStorage.getItem(newsKey) ?? 0))));
    } catch {
      // As above.
    }
  }, [lastEp, newsKey]);
  const ended = week?.tone === "out" || week?.tone === "over";
  // The card's sentence, while the game hasn't scored anything for you yet (the spec's "until your first move", as near as the view
  // can tell for every kind of game: a first result follows a first move). For the couch's others it's the game's introduction.
  const firstVisit = !ended && !week?.last && !(g.you?.total);
  // The move, in the card: the one yellow plate while it's due; a game's other moves (a claim in, answers saved) as a quiet plate;
  // a lineup that's set, one plain line to change it.
  const lineupMove = wmove?.kind === "lineup" || wmove?.kind === "pick";
  const plain = (child: ReactNode, more: ReactNode = null) => (
    <div data-game-strip={strip.kind} data-game-due="no">
      {child}
      {more}
    </div>
  );
  const movePart =
    week && lineupMove && !strip.due ? (
      ended || !wmove || !("tab" in wmove.go) || wg.lineup?.locked ? plain(null) : plain(
        <button
          type="button"
          data-week-change
          onClick={() => wmove && "tab" in wmove.go && openMoves(wmove.go.tab, wg.leagueId)}
          className="mt-0.5 inline-flex min-h-11 items-center text-[15px] font-semibold underline decoration-border underline-offset-[4px]"
        >
          {week?.tone === "behind" || week?.tone === "early" ? "Not watched it yet? Change your lineup" : "Change your lineup"}
        </button>,
        wg.lineup && wg.twists?.captain ? (
          <p data-page-captain className="mt-0.5 text-[13px] text-muted-foreground">
            {wg.twists.captain.castawayId ? `Captain: ${(wg.cast.find((c) => c.id === wg.twists.captain!.castawayId)?.name ?? "").split(" ")[0]} ×${wg.twists.captain.times}` : "No captain yet: name one in your lineup"}
          </p>
        ) : null
      )
    ) : ended && !strip.due ? (
      plain(null)
    ) : !strip.due && strip.go && !strip.inPlace && strip.tag !== "Draft" ? (
      <OptionalLine strip={strip} g={wg} show={show} />
    ) : (
      <Strip strip={strip} g={wg} show={show} className="mt-3" />
    );
  const paced = !!wg.catchUp && wg.catchUp.latest >= wg.catchUp.week && wg.revealFirst === null;
  const revealEp = wg.revealFirst ?? (paced ? wg.catchUp!.week : (show.episodes?.reveal?.episode ?? null));
  const [revealing, setRevealing] = useState(false);
  const revealHere = async () => {
    setRevealing(true);
    try {
      await couches.catchUp(seasonId, couchId, wg.leagueId);
      await afterCouch();
      toast(`${show.words.episode} ${revealEp} revealed`);
    } catch (e) {
      toast.quiet((e as Error).message);
    } finally {
      setRevealing(false);
    }
  };
  const reveal =
    week && (week.tone === "behind" || week.tone === "early") && revealEp !== null ? (
      <div className="mt-3" data-week-reveal>
        <Btn tone="ink" wide disabled={revealing} onClick={() => (paced ? revealHere() : nav.push(paths.reveal(seasonId, revealEp)))}>
          {revealing ? "Revealing…" : paced ? `I've watched ${show.words.ep} ${revealEp} · Reveal` : week.tone === "early" ? `Reveal ${show.words.ep} ${revealEp}'s early results` : `Reveal ${show.words.ep} ${revealEp}`}
        </Btn>
        <p className="mt-1.5 text-[13px] text-muted-foreground">{paced ? "Results for this game, at your own pace." : `One reveal for every game you play on ${show.header?.show.name ?? "this show"}.`}</p>
      </div>
    ) : null;
  return (
    <div data-game-page={g.leagueId} data-game-main={m.main} data-game-phase={m.phase} className="pb-16">
      {/* The bar that stays: once the card's name has scrolled under the top, the game's name and the way back (the check's P2). */}
      <div className="sticky top-0 z-20 h-0" data-game-namebar={away ? "on" : "off"}>
        <div aria-hidden={!away} inert={!away} className={`bg-background/95 shadow-[0_1px_0_var(--border)] backdrop-blur transition-opacity duration-200 motion-reduce:transition-none ${away ? "opacity-100" : "pointer-events-none opacity-0"}`}>
          <TopBar onBack={onBack} show={show.header?.show.name ?? ""} game={g.name} onMenu={() => setMenu(true)} />
        </div>
      </div>
      <header className="relative overflow-hidden pb-3" data-game-title>
        <Backdrop art={art} colour={colour} />
        <div className="relative">
          {/* The bar's centre stays empty: the card under it names the game, once (b1-title-card-spec.md, "The header"). */}
          <TopBar onBack={onBack} show="" onMenu={() => setMenu(true)} />
        </div>
        <GameTitleCard kicker={show.header ? kickerOf(show.header.show.name, show.header.seasonNumber) : ""} name={g.name} sentence={firstVisit && g.sentence ? inShowWords(g.sentence, show.words) : null} onAway={setAway} />
        {m.hero.stages && <Stages stages={m.hero.stages} seasonId={seasonId} />}
        {g.plays.kind === "staged" && (
          <StagesDone games={(show.play ?? []).filter((x) => x.stageOf === g.leagueId && x.leagueId !== stage?.leagueId && x.over)} />
        )}
        <div className="relative mt-2">
          {week ? (
            <WeekBlock
              g={wg}
              w={strip.due && week.tone === "due" ? { ...week, state: "" } : wg.over && week.kind === "standing" ? { ...week, state: finalLine(wg) } : week}
              colour={colour}
              note={waiverLine(waivers?.find((w) => w.leagueId === wg.leagueId), wg, when, show.words, wmove?.kind === "waivers" && strip.due)}
              news={news}
              move={movePart}
              reveal={reveal}
              words={show.words}
              onMatchup={(n) => (week.kind === "matchup" && n !== null ? drill.open({ kind: "matchup", playerId: wg.playerId, episode: n }) : wg.you && drill.open({ kind: "person", playerId: wg.you.playerId, episode: n }))}
              onLast={(n, pid) => drill.open({ kind: "matchup", playerId: pid ?? wg.playerId, episode: n })}
            />
          ) : (
            <Strip strip={strip} g={wg} show={show} className="mx-4" />
          )}
        </div>
      </header>
      <SideBetsRow g={wg} words={show.words} runs={runs} onOpen={() => drill.open({ kind: "bets" })} />
      {week?.tone !== "out" && <WeekGames g={wg} words={show.words} onOpen={(pid, n) => drill.open({ kind: "matchup", playerId: pid, episode: n })} />}
      {m.inPlace === "questions" && <InPlaceQuestions seasonId={seasonId} g={g} />}
      {m.inPlace === "twist" && twist?.next && <TwistChooser leagueId={g.leagueId} t={twist} />}
      {m.inPlace === "slots" && <SlotPicker g={g} seasonId={seasonId} />}
      {stage && g.you && g.from !== null && g.through >= g.from && (
        <p className="mx-4 mt-4 text-[15px]" data-game-overall>
          <b className="font-semibold">Overall:</b> {ordinal(g.you.place)} of {g.players} · {totalWords(g, g.you)} <span className="text-muted-foreground">(both stages&apos; points add up)</span>
        </p>
      )}
      {/* Round 3: Again, the same game on what comes next, once it's over (offered, never made for you). */}
      {wg.over && wg.to !== null && <AgainRow show={show} g={wg} />}
      {/* One game between two: the card above is the whole of it, so no grid of one column. Round 3: nor a one-episode game once it's
          over (its card says how it ended). */}
      {!(oneGame(wg) && wg.plays.kind === "result" && wg.players <= 2) && !(oneGame(wg) && wg.over) && <SeasonGrid g={wg} m={wm} words={show.words} due={!!wmove?.due} drill={drill} />}
      {wg.bot && <AgainstTheBot g={wg} />}
      {(m.hero.lives || m.hero.notes.length > 0) && <Notes hero={m.hero} />}
      {wg.you && wg.you.team.length > 0 ? (
        <>
          <YourTeam g={wg} words={show.words} exclusive={exclusive} onFace={(id) => drill.open({ kind: "cast", id })} onSheet={() => drill.open({ kind: "person", playerId: wg.you!.playerId, episode: null })} />
          {wg.castWeeks && (
            <div className="mx-4 mt-1" data-door-table>
              <Row title={`Everyone in this game · ${wg.cast.length}`} detail={`Their points each ${show.words.episode.toLowerCase()} at this game's scoring, and who has them`} onClick={() => drill.open({ kind: "table" })} />
            </div>
          )}
        </>
      ) : (
        // A game in stages: you in the stage being played (a pool's picks, a sheet's answers), as any game of its kind shows you.
        wg.you && wg.plays.kind !== "staged" && <YouSection g={wg} m={wm} show={show} seasonId={seasonId} drill={drill} />
      )}
      <Label>How it plays</Label>
      {/* The game in a line ("All season · Draft 3, start 2 · Only 2 moments count"): what the title card said, the rules' gist. */}
      {m.title.line && (
        <p className="mx-4 -mt-1 mb-2.5 text-[15px] font-semibold leading-snug" data-game-short>
          {m.title.line}
        </p>
      )}
      <ol className="mx-4 list-decimal pl-[18px] text-[15px] leading-[1.45] text-foreground/90" data-game-rules>
        {m.rules.slice(0, 3).map((r) => (
          <li key={r} className="mb-1.5 pl-1">
            {r}
          </li>
        ))}
      </ol>
      {m.rules.length > 3 && (
        <button type="button" data-door-rules onClick={() => drill.open({ kind: "rules" })} className="mx-4 inline-flex min-h-11 items-center gap-0.5 text-[14px] font-semibold">
          All {m.rules.length} rules
          <ChevronRight className="size-4" aria-hidden />
        </button>
      )}
      {/* Your moves (dock.tsx), as the show's tabs have it: the move opens it on this game. */}
      {show.header && <MovesSheet show={show} seasonId={seasonId} />}
      <DrillSheets drill={drill} g={wg} wg={wg} runs={runs} show={show} seasonId={seasonId} rules={m.rules} />
      <Sheet open={menu} onOpenChange={setMenu} title={m.title.name} subtitle={show.header?.show.name}>
        <div className="pb-2" data-game-menu>
          <Row title="How it plays" detail={`${m.rules.length} rules${m.chips.length ? ` · ${m.chips.join(", ").toLowerCase()}` : ""}`} onClick={() => (setMenu(false), drill.open({ kind: "rules" }))} />
          {wg.you && <Row title="Your sheet" detail="Week by week" onClick={() => (setMenu(false), drill.open({ kind: "person", playerId: wg.you!.playerId, episode: null }))} />}
          {show.header && !g.solo && (
            <Row title="Where you are" detail={show.seenThrough ? `Through ${show.words.ep} ${show.seenThrough}: nothing past it shows here` : "Results show as they come"} onClick={() => (setMenu(false), openWhere(show))} />
          )}
          {/* Round 4 (built in B4): the game's own settings, for whoever runs it. */}
          {show.couch && (g.yourRole === "commissioner" || g.yourRole === "admin") && (
            <Row title="Game settings" detail={g.yourRole === "commissioner" ? "What you set, and what you can still change" : "This episode's lock, and how the game is set"} onClick={() => (setMenu(false), settingsPage.showWith({ game: g.leagueId, from: "game" }))} />
          )}
        </div>
      </Sheet>
      {show.couch && <GameSettingsPage seasonId={seasonId} show={show} />}
    </div>
  );
}

// ---------- the top: the show's art behind This week ----------

/** The show's art in its own colours (the user, 2026-11-08), washed toward Night so the faces and numbers over it read. */
function Backdrop({ art, colour }: { art: string | null; colour: string | null }) {
  const { src, frame } = splitFrame(art);
  if (!src)
    return colour ? (
      <span aria-hidden className="absolute inset-0" style={{ background: `radial-gradient(120% 70% at 50% 18%, color-mix(in srgb, ${colour} 26%, transparent), transparent 70%)` }} />
    ) : null;
  return (
    <span aria-hidden className="absolute inset-0">
      {/* eslint-disable-next-line @next/next/no-img-element -- art_url can be an arbitrary external URL */}
      <img src={src} alt="" className="size-full object-cover" style={frame ? frameStyle(frame) : { objectPosition: "center 25%" }} />
      <span className="absolute inset-0 bg-[linear-gradient(180deg,rgba(22,20,29,.55),rgba(22,20,29,.78)_38%,rgba(22,20,29,.93)_72%,var(--background))]" />
    </span>
  );
}

/** A game in stages: each stage that's over, in a line (where you finished it, its record or points). */
function StagesDone({ games }: { games: GameView[] }) {
  const done = games.filter((x) => x.you);
  if (!done.length) return null;
  return (
    <p className="relative mx-4 mt-2 text-[13px] text-muted-foreground" data-game-stages-done>
      {done
        .map((x) => {
          const champ = x.table.find((r) => r.record?.champion);
          const who = champ ? (champ.you ? "you won it" : `${champ.name.split(" ")[0]} won it, you finished ${ordinal(x.you!.place)}`) : `you finished ${ordinal(x.you!.place)}`;
          return `${x.name.split(" · ").at(-1)}: ${who} · ${totalWords(x, x.you!)}`;
        })
        .join(". ")}
    </p>
  );
}

/** What the game's twists leave on you (a captain, a role, a handicap), and a co-op's lives. */
function Notes({ hero }: { hero: HeroM }) {
  return (
    <div className="mx-4 mt-6 flex flex-col gap-1.5" data-game-notes>
      {hero.lives && (
        <div className="flex items-center gap-1.5" aria-label={`${hero.lives.left} of ${hero.lives.of} lives left`} data-game-hearts>
          {Array.from({ length: hero.lives.of }, (_, i) => (
            <Heart key={i} className={`size-5 ${i < hero.lives!.left ? "fill-foreground text-foreground" : "text-muted-foreground"}`} aria-hidden />
          ))}
          <span className="ml-1 text-[13px] text-muted-foreground">{hero.lives.left === 1 ? "1 life left" : hero.lives.left ? `${hero.lives.left} lives left` : "No lives left"}</span>
        </div>
      )}
      {hero.notes.map((n) => (
        <Plate key={n.tag + n.title} tag={n.tag} tone={n.tone} title={/^Group slot/.test(n.tag) ? (groupShort(n.title) ?? n.title) : n.title} line={n.line} size="xs" />
      ))}
    </div>
  );
}

// ---------- plates ----------

const TONE: Record<Tone, string> = {
  chy: "bg-chyron text-chyron-foreground",
  live: "bg-live text-live-foreground",
  good: "bg-good text-good-foreground",
  quiet: "bg-quiet-tag text-quiet-tag-foreground",
  show: "bg-[#5089c9] text-[#121018]",
  you: "bg-foreground text-background",
};

/** A caption plate: an angled tag in its tone, the title in condensed caps, a line under it; a face or a number on its end. */
function Plate({
  tag,
  tone,
  title,
  line,
  size = "md",
  right,
  photo,
  chevron,
  tagStyle,
  dim,
  enter,
  className = "",
}: {
  tag: ReactNode;
  tone: Tone;
  title: ReactNode;
  line?: ReactNode;
  size?: "md" | "sm" | "xs";
  right?: ReactNode;
  photo?: string | null;
  chevron?: "right" | "down" | null;
  tagStyle?: CSSProperties;
  dim?: boolean;
  /** The page's one entrance: the tag slides in, the plate after it (the title plate, on open). */
  enter?: boolean;
  className?: string;
}) {
  const h = size === "md" ? "min-h-[60px]" : size === "sm" ? "min-h-[52px]" : "min-h-11";
  const t = size === "md" ? "text-[22px]" : size === "sm" ? "text-[19px]" : "text-[17px]";
  return (
    <div className={`flex ${h} overflow-hidden rounded-[3px] ${dim ? "bg-card text-muted-foreground" : "bg-plate text-plate-foreground shadow-plate"} ${className}`}>
      <span className={`tag-cut ${enter ? "gp-tag-in" : ""} type-caption flex flex-none items-center whitespace-nowrap py-1 pl-3 pr-[26px] text-[14px] tracking-[0.04em] ${TONE[tone]}`} style={tagStyle}>
        {tag}
      </span>
      <span className={`tag-tuck flex min-w-0 flex-1 flex-col justify-center py-2 pl-[26px] pr-3 ${enter ? "gp-plate-in" : ""}`}>
        <b className={`type-caption ${t} [overflow-wrap:anywhere]`}>{title}</b>
        {line && <span className={`mt-[3px] text-[13px] leading-[1.3] ${dim ? "text-muted-foreground" : "text-plate-muted"}`}>{line}</span>}
      </span>
      {photo !== undefined && (photo ? <Face src={photo} className="w-11 flex-none self-stretch" /> : null)}
      {right != null && <span className="type-num flex-none self-center pl-1.5 pr-3.5 text-[22px]">{right}</span>}
      {chevron && <span className="grid w-11 flex-none place-items-center">{chevron === "down" ? <ChevronDown className="size-[22px]" aria-hidden /> : <ChevronRight className="size-[22px]" aria-hidden />}</span>}
    </div>
  );
}

// ---------- the strip: your move ----------

/** Where a move goes: Your moves on this game, a page over the show, a sheet, the move made in place. */
function useStripGo(strip: StripM, g: GameView, show: ShowData) {
  const nav = useNav();
  const seasonId = show.header?.seasonId ?? "";
  return () => {
    const to = strip.go;
    if (!to) return;
    if ("tab" in to) return openMoves(to.tab, g.leagueId);
    if ("href" in to) return nav.push(to.href);
    if ("sheet" in to) {
      if (strip.inPlace) return document.getElementById("gp-move")?.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
      return openSheet({ seasonId, leagueId: g.leagueId, episode: null, game: g.gameName, finale: g.sheet?.finale });
    }
    if ("bingo" in to) return openBingo({ seasonId, couchId: show.couch?.id ?? null, episode: to.bingo, label: show.header?.show.name ?? "", solo: show.solo });
    if ("twist" in to || "slots" in to) return document.getElementById("gp-move")?.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
    if ("call" in to) return openCall({ seasonId, couchId: show.couch?.id ?? null, episode: to.call, label: show.header?.show.name ?? "", solo: show.solo });
  };
}

/** A move that isn't due, as one plain line (never the due plate's shape): optional swaps open, answers to look at again. */
function OptionalLine({ strip, g, show }: { strip: StripM; g: GameView; show: ShowData }) {
  const go = useStripGo(strip, g, show);
  return (
    <div data-game-strip={strip.kind} data-game-due="no">
      <button type="button" data-week-optional onClick={go} className="mt-1 inline-flex min-h-11 items-center gap-1 text-left text-[15px] font-semibold">
        <span>
          {strip.title} <span className="font-normal text-muted-foreground">· {strip.line}</span>
        </span>
        <ChevronRight className="size-4 flex-none" aria-hidden />
      </button>
    </div>
  );
}

function Strip({ strip, g, show, className = "mx-4 mt-3" }: { strip: StripM; g: GameView; show: ShowData; className?: string }) {
  const go = useStripGo(strip, g, show);
  // A draft that hasn't started and isn't yours to start: coming, and not yours, an hourglass on its tag (the show tabs' strip's own).
  const tag = strip.tag === "Draft" && !strip.due ? (
    <span className="inline-flex items-center gap-1.5">
      <Hourglass className="size-4" strokeWidth={2.5} aria-hidden />
      Draft
    </span>
  ) : (
    strip.tag
  );
  const plate = <Plate tag={tag} tone={strip.tone} title={strip.title} line={strip.line} size={strip.due ? "md" : "sm"} chevron={strip.go ? (strip.inPlace ? "down" : "right") : null} />;
  return (
    <div className={className} data-game-strip={strip.kind} data-game-due={strip.due ? "yes" : "no"}>
      {strip.go ? (
        <button type="button" onClick={go} className="nd-press block w-full text-left">
          {plate}
        </button>
      ) : (
        plate
      )}
    </div>
  );
}

// ---------- a game in stages: each stage's own page ----------

function Stages({ stages, seasonId }: { stages: NonNullable<HeroM["stages"]>; seasonId: string }) {
  return (
    <div className="relative mx-4 mt-1 flex gap-1.5" data-game-stages>
      {stages.map((s) =>
        s.leagueId ? (
          <NavLink key={s.name} href={paths.gamePage(seasonId, s.leagueId)} data-game-stage={s.leagueId} className="nd-press min-w-0 flex-1">
            <Plate tag={s.tag} tone={s.now ? "show" : "quiet"} title={s.name} size="xs" dim={!s.now} />
          </NavLink>
        ) : (
          <Plate key={s.name} tag={s.tag} tone={s.now ? "show" : "quiet"} title={s.name} size="xs" dim={!s.now} className="min-w-0 flex-1" />
        )
      )}
    </div>
  );
}

// ---------- the move, in place ----------

/** A game of questions answered on the page. Once every open question has your answer it folds to one line, your answers and
 *  "Change your answers" (as the twist chooser folds), so the season grid comes back into the first screen. */
function InPlaceQuestions({ seasonId, g }: { seasonId: string; g: GameView }) {
  const r = useGameQuestions(seasonId, g.leagueId, null);
  const d = r.data;
  const [editing, setEditing] = useState<boolean | null>(null);
  const open = d?.questions.filter((q) => q.status === "open") ?? [];
  const done = open.length > 0 && open.every((q) => q.mine !== null && q.mine !== undefined && q.mine !== "");
  if (d && done && !(editing ?? !done)) {
    const cast = new Map([...d.cast, ...(d.groups ?? [])].map((c) => [c.id, c]));
    return (
      <section id="gp-move" className="mx-4 mt-4 scroll-mt-4" data-game-move="questions" data-questions-state="saved">
        <p className="text-[15px] font-semibold leading-snug">{open.map((q) => answerWords(q, q.mine, cast)).join(" · ")}</p>
        <button type="button" data-questions-change onClick={() => setEditing(true)} className="inline-flex min-h-11 items-center text-[14px] font-semibold underline underline-offset-[3px]">
          Change your answers
        </button>
      </section>
    );
  }
  return (
    <section id="gp-move" className="mx-4 mt-6 scroll-mt-4" data-game-move="questions">
      {r.isPending ? (
        <div aria-busy className="h-48 animate-pulse rounded-[3px] bg-card" />
      ) : !d ? (
        <p className="text-sm text-muted-foreground">Couldn&apos;t load the questions. Try again in a moment.</p>
      ) : (
        <QuestionsBody key={JSON.stringify(d.questions.map((q) => [q.id, q.mine, q.status]))} target={{ seasonId, leagueId: g.leagueId, episode: null, game: g.gameName }} d={d} onDone={() => setEditing(false)} place="page" />
      )}
    </section>
  );
}

/** The top scorer's twist, chosen on the page: each option a plate with its multiplier on the tag (the chosen one white, the rest
 *  dim), a named white confirm only while there's a change to save; once chosen it folds to one line, "Change it" opening it. */
function TwistChooser({ leagueId, t }: { leagueId: string; t: LeagueTwist }) {
  const qc = useQueryClient();
  const [picked, setPicked] = useState<string | null>(t.next?.choice ?? null);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(!t.next?.choice);
  const name = t.twist.of.find((o) => o.id === picked)?.name ?? null;
  const changed = picked !== (t.next?.choice ?? null);
  const save = async () => {
    if (!picked) return;
    setSaving(true);
    try {
      await chooseTwist(leagueId, picked);
      await qc.invalidateQueries({ queryKey: ["new-design", "twist", leagueId] });
      setEditing(false);
      toast(`${name}: it's set for Episode ${t.next?.episode}`);
    } catch (e) {
      toast.quiet(`Not saved: ${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  };
  if (!editing)
    return (
      <section id="gp-move" className="mx-4 mt-4 scroll-mt-4" data-game-move="twist" data-twist-state="chosen">
        <button type="button" data-twist-change onClick={() => setEditing(true)} className="inline-flex min-h-11 items-center text-[14px] font-semibold underline underline-offset-[3px]">
          Change your twist
        </button>
      </section>
    );
  return (
    <section id="gp-move" className="mx-4 mt-6 scroll-mt-4" data-game-move="twist">
      <div className="flex flex-col gap-1.5" role="radiogroup" aria-label="The twist">
        {t.twist.of.map((o) => (
          <button key={o.id} type="button" role="radio" aria-checked={picked === o.id} data-twist-option={o.id} onClick={() => setPicked(o.id)} className="nd-press block w-full text-left">
            <Plate tag={`×${o.times}`} tone={picked === o.id ? "you" : "quiet"} title={o.name} size="sm" dim={picked !== null && picked !== o.id} />
          </button>
        ))}
      </div>
      {picked && changed && (
        <button type="button" data-twist-save disabled={saving} onClick={save} className="nd-press type-caption mt-3 grid min-h-[52px] w-full place-items-center rounded-[3px] bg-plate text-[20px] tracking-[0.02em] text-plate-foreground shadow-plate disabled:opacity-60">
          {saving ? "Saving…" : `Choose ${name}`}
        </button>
      )}
    </section>
  );
}

/** Your group slots, picked on the page: the groups on offer, once, as plates; a tap puts that group in your next open slot (its
 *  tag says which) and saves it (the group-slots route), as a lineup's tap does in Your moves. */
function SlotPicker({ g, seasonId }: { g: GameView; seasonId: string }) {
  const qc = useQueryClient();
  const [saving, setSaving] = useState<string | null>(null);
  const offered = g.twists.offered;
  const open = (g.twists.slots ?? []).filter((s) => s.status === "empty" || s.status === "dropped");
  if (!offered || !open.length) return null;
  const taken = new Set((g.twists.slots ?? []).map((s) => s.groupId).filter(Boolean));
  const pick = async (slot: number, groupId: string, name: string) => {
    setSaving(`${slot}:${groupId}`);
    try {
      await setGroupSlot(g.leagueId, offered.epId, g.playerId, slot, groupId);
      await qc.invalidateQueries({ queryKey: ["new-design", "games", seasonId] });
      toast(`${name} is in your group slot${(g.twists.slots ?? []).length > 1 ? ` ${slot + 1}` : ""}`);
    } catch (e) {
      toast.quiet(`Not saved: ${(e as Error).message}`);
    } finally {
      setSaving(null);
    }
  };
  const s = open[0];
  return (
    <section id="gp-move" className="mx-4 mt-6 scroll-mt-4" data-game-move="slots">
      <p className="mb-1.5 text-[13px] text-muted-foreground">{`Group slot${(g.twists.slots ?? []).length > 1 ? ` ${s.slot + 1}` : ""}${s.status === "dropped" ? " · its group ended" : ""} · a tap puts a group in it`}</p>
      <div className="rounded-[3px] bg-card p-1.5">
        <GroupRows g={g} picked={null} taken={taken} busy={saving?.split(":")[1] ?? null} onPick={(id) => pick(s.slot, id, groupShort(offered.groups.find((x) => x.id === id)?.name) ?? "The group")} />
      </div>
    </section>
  );
}

// ---------- the couch, framed: the season grid ----------

function Label({ children }: { children: ReactNode }) {
  return <h2 className="type-caption mx-4 mb-2.5 mt-8 text-[24px]">{children}</h2>;
}

/** After a reveal the grid's rows restack: each slides from where it was to its new place (FLIP, transform only). A row is three
 *  cells (its name, its squares, its total), all keyed by the seat, so they move together. */
function useRestack(keys: string[]) {
  const box = useRef<HTMLDivElement>(null);
  const last = useRef<Map<string, number> | null>(null);
  const order = keys.join(",");
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const now = new Map<string, number>();
    for (const c of el.querySelectorAll<HTMLElement>("[data-restack]")) now.set(c.dataset.restack!, c.getBoundingClientRect().top);
    const before = last.current;
    last.current = now;
    if (!before || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    for (const c of el.querySelectorAll<HTMLElement>("[data-restack]")) {
      const from = before.get(c.dataset.restack!);
      const to = now.get(c.dataset.restack!);
      if (from == null || to == null || from === to) continue;
      c.animate([{ transform: `translateY(${from - to}px)` }, { transform: "none" }], { duration: 420, easing: "cubic-bezier(.16,1,.3,1)" });
    }
  }, [order]);
  return box;
}

const ROW = "h-[50px]";
const VISIBLE = 7;
/** A big couch (or a public game's top and you): the top rows and yours, the rest behind All N. */
const BIG = 8;
const num = (n: number) => String(Math.round(n * 10) / 10);

/** What a square holds, in a line under the grid. */
function keyLine(g: GameView, words: ShowData["words"]): string {
  return keyWords(g).replaceAll("episode", words.episode.toLowerCase());
}

function keyWords(g: GameView): string {
  const p = g.plays;
  if (p.kind === "staged") return "Each stage keeps its own season on its own page. This is the overall, by points.";
  if (g.players <= 1 && p.kind !== "result") return "Each square is that episode's points. The next ones stay hidden until they lock.";
  if (p.kind === "pick") return "Each square is that episode's pick. The next ones stay hidden until they're decided.";
  if (p.kind === "result") return "Won or lost each week, against who the schedule set. A square opens that matchup.";
  if (p.kind === "race") return `Each square is the running total, climbing to ${num(p.target ?? 0)}.`;
  if (p.kind === "won") return "Each square is that episode's points; a teal one won the week.";
  if (p.blocks.includes("boots")) return "Each square is how many of their team were still in after it; a red dot, one went home.";
  if (p.kind === "lives") return "Each square is that episode's points; the couch's lives run along the foot.";
  return "Each square is that episode's points; the week's best is the bright one. The next ones stay hidden until they lock.";
}

/** The league's table as the season grid, framed in its panel (the user's pick, C): a row a person, a column an episode, a square by
 *  kind, the next episode only Set, Due or –; your row lit; every name, square and episode a door. */
function SeasonGrid({ g, m, words, due, drill }: { g: GameView; m: PageModel; words: ShowData["words"]; due: boolean; drill: DrillState }) {
  const p = g.plays;
  const all = [...m.couch.podium, ...m.couch.rows];
  const [open, setOpen] = useState(false);
  const big = all.length > BIG;
  const rows = !big || open ? all : all.filter((s, i) => i < BIG - 2 || s.you);
  const eps = p.episodes;
  const latest = eps.at(-1) ?? null;
  const cols = eps.length + (p.next ? 1 : 0);
  const many = cols > VISIBLE + 1;
  const tmpl = many ? `repeat(${cols}, 30px)` : `repeat(${cols}, minmax(0, 1fr))`;
  const box = useRestack(rows.map((s) => s.playerId));
  const scroller = useRef<HTMLDivElement>(null);
  // A long season opens on its latest columns; earlier ones scroll in from the left, the names pinned.
  useLayoutEffect(() => {
    const c = scroller.current;
    if (c && many) c.scrollLeft = c.scrollWidth;
  }, [many, cols]);
  const rowOf = new Map(g.table.map((r) => [r.playerId, r]));
  const person = (playerId: string, episode: number | null) => drill.open({ kind: "person", playerId, episode });
  const square = (playerId: string, episode: number) => (p.kind === "result" ? drill.open({ kind: "matchup", playerId, episode }) : person(playerId, episode));
  const po = p.kind === "result" ? g.matchups?.playoffs : null;
  const cut = m.couch.cutAfter ?? (po && all.length > po.teams ? po.teams : null);
  const cutLabel = m.couch.cutLabel ?? (po ? "Playoffs" : null);
  const cutAt = (i: number) => cut !== null && cut === i && i > 0;
  const unit = m.couch.unit === "Points" ? "Pts" : p.kind === "result" && g.table.some((r) => r.record?.ties) ? "W-L-T" : m.couch.unit;
  const lives = p.lives;
  return (
    <section className="mx-2 mt-6 rounded-[14px] bg-card px-4 pb-3.5 pt-4" data-game-couch={m.couch.unit} data-game-grid={p.kind}>
      <div className="mb-2.5 flex items-baseline justify-between gap-2">
        <h2 className="type-caption text-[24px]">The season</h2>
      </div>
      {m.couch.teams && <p className="mb-2 text-[13px] text-muted-foreground">{m.couch.teams}</p>}
      <div ref={box} className="flex">
        {/* The names, pinned. */}
        <div className="w-[84px] flex-none">
          <div className="h-[26px]" />
          {rows.map((s, i) => (
            <div key={s.playerId}>
              {cutAt(i) && <CutRow label={cutLabel ?? "The cut"} />}
              <button
                type="button"
                data-restack={s.playerId}
                data-player={s.name}
                data-door-person={s.playerId}
                onClick={() => person(s.playerId, latest)}
                className={`nd-press flex ${ROW} items-center gap-1.5 border-t border-border text-left ${s.you ? "-ml-2 w-[calc(100%+8px)] rounded-l-[3px] bg-secondary pl-2" : "w-full"}`}
              >
                <Avatar id={s.userId ?? s.playerId} name={s.name} size={20} />
                <span className={`min-w-0 truncate text-[14px] font-semibold ${s.out && p.kind !== "result" ? "text-muted-foreground" : ""}`}>{s.you ? "You" : s.name.split(" ")[0]}</span>
              </button>
            </div>
          ))}
          {lives && <div className={`flex ${ROW} items-center border-t border-border text-[13px] font-semibold text-muted-foreground`}>Lives</div>}
        </div>
        {/* The episodes: the latest seven in view, earlier ones a scroll away. */}
        <div ref={scroller} className={`min-w-0 flex-1 ${many ? "overflow-x-auto [scrollbar-width:none]" : ""}`}>
          <div style={{ width: many ? "max-content" : undefined }}>
            <div className="grid h-[26px]" style={{ gridTemplateColumns: tmpl }}>
              {eps.map((n) => (
                <button key={n} type="button" data-door-episode={n} aria-label={`${words.episode} ${n}`} onClick={() => drill.open({ kind: "episode", episode: n })} className={`type-caption grid h-[26px] place-items-center rounded-t-[3px] text-[13px] ${n === latest ? "bg-secondary/60 text-foreground" : "text-muted-foreground"}`}>
                  {n}
                </button>
              ))}
              {p.next && <span className="type-caption grid h-[26px] place-items-center text-[13px] text-muted-foreground">{p.next.episode}</span>}
            </div>
            {rows.map((s, i) => {
              const sq = p.rows[s.playerId] ?? [];
              return (
                <div key={s.playerId}>
                  {cutAt(i) && <CutRow />}
                  <div data-restack={s.playerId} data-row-out={s.out && p.kind !== "result" ? "" : undefined} className={`grid ${ROW} border-t border-border ${s.you ? "bg-secondary" : ""} ${s.out && p.kind !== "result" ? "[&>*]:opacity-55" : ""}`} style={{ gridTemplateColumns: tmpl }}>
                    {sq.map((x) => (
                      <button key={x.episode} type="button" data-square={`${s.playerId}:${x.episode}`} data-late={x.late ? "" : undefined} aria-label={`${s.name}, ${words.episode} ${x.episode}${x.result ? `: ${x.result.r === "W" ? "won" : x.result.r === "L" ? "lost" : "tied"}` : x.points !== null && x.points !== undefined ? `: ${num(x.points)} points` : ""}${x.late ? `. ${LATE_SET}` : ""}`} onClick={() => square(s.playerId, x.episode)} className={`nd-press relative grid place-items-center ${x.episode === latest ? (s.you ? "bg-input/45" : "bg-secondary/60") : ""}`}>
                        <Cell g={g} x={x} />
                        {x.late && <LateMark className="right-px top-px" />}
                      </button>
                    ))}
                    {p.next && <span className="grid place-items-center">{rowOf.has(s.playerId) && !(po?.seeds?.length && !rowOf.get(s.playerId)?.record?.alive) && <NextCell set={p.next.set[s.playerId]} you={s.you} due={due} />}</span>}
                  </div>
                </div>
              );
            })}
            {lives && (
              <div className={`grid ${ROW} border-t border-border`} style={{ gridTemplateColumns: tmpl }} data-game-lives>
                {eps.map((n) => (
                  <span key={n} className="type-num grid place-items-center text-[16px] text-muted-foreground">
                    {lives.after[n] ?? "–"}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
        {/* The totals, pinned. */}
        <div className={`${p.kind === "result" ? "w-[52px]" : "w-[40px]"} flex-none`}>
          <div className="type-caption flex h-[26px] items-center justify-end text-[13px] text-muted-foreground">{unit}</div>
          {rows.map((s, i) => (
            <div key={s.playerId}>
              {cutAt(i) && <CutRow />}
              <div data-restack={s.playerId} className={`flex ${ROW} flex-col items-end justify-center border-t border-border ${s.you ? "-mr-2 w-[calc(100%+8px)] rounded-r-[3px] bg-secondary pr-2" : ""}`}>
                <b className={`type-num text-[20px] leading-none ${s.out && p.kind !== "result" ? "text-muted-foreground" : ""}`}>{s.value}</b>
                {p.kind === "result" ? (
                  rowOf.get(s.playerId)?.record?.champion ? (
                    <span className="type-caption mt-1 rounded-[2px] bg-good px-1 text-[11px] tracking-[0.04em] text-good-foreground">Champ</span>
                  ) : rowOf.get(s.playerId)?.record?.seed ? (
                    <span className="mt-0.5 text-[11px] font-semibold text-muted-foreground">Seed {rowOf.get(s.playerId)!.record!.seed}</span>
                  ) : null
                ) : (
                  s.out && <span className="type-caption mt-1 rounded-[2px] bg-live px-1 text-[11px] tracking-[0.04em] text-live-foreground">Out</span>
                )}
              </div>
            </div>
          ))}
          {lives && (
            <div className={`flex ${ROW} items-center justify-end border-t border-border`}>
              <b className="type-num text-[20px]">{m.couch.coop?.lives ?? lives.of}</b>
            </div>
          )}
        </div>
      </div>
      {big && (
        <button type="button" data-grid-all onClick={() => setOpen((o) => !o)} className="mt-1 inline-flex min-h-11 items-center gap-0.5 text-[14px] font-semibold">
          {open ? "Show fewer" : `All ${all.length}`}
          <ChevronDown className={`size-4 ${open ? "rotate-180" : ""}`} aria-hidden />
        </button>
      )}
      <p className="mt-2.5 text-[13px] leading-[1.4] text-muted-foreground">
        {eps.length || p.kind === "staged" ? keyLine(g, words) : m.phase === "before" ? `It fills in from the first ${words.episode.toLowerCase()} with results, as far as you've watched.` : "Nothing counted yet, as far as you've watched."}
        {[m.couch.note, m.couch.players > all.length ? `${m.couch.players} playing` : null].filter(Boolean).map((x) => ` ${x}.`)}
        {g.waiting?.length > 0 && p.kind === "result" && (
          <span data-waiting-key className="mt-1 block">
            {g.waiting.map((w) => `${words.episode} ${w.episode}: waiting on ${w.name}'s ${p.blocks.some((b) => b === "pick" || b === "picks") ? "pick" : "lineup"}.`).join(" ")}
          </span>
        )}
        {nightKey(g).length > 0 && (
          <span data-night-key className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
            {nightKey(g)}
          </span>
        )}
        {rows.some((s) => p.rows[s.playerId]?.some((x) => x.late)) && (
          <span data-late-key className="mt-1 flex items-center gap-1.5">
            <Clock className="size-3 flex-none" aria-hidden />
            {LATE_SET}.
          </span>
        )}
      </p>
    </section>
  );
}

/** The next cut's line across the grid, in each of its three columns: the label on the names' side. */
function CutRow({ label }: { label?: string }) {
  return (
    <div aria-hidden={!label} data-game-cut={label ? "" : undefined} className="type-caption flex h-[18px] items-center gap-1.5 whitespace-nowrap text-[11px] tracking-[0.06em] text-muted-foreground after:flex-1 after:border-t after:border-dashed after:border-edge after:content-['']">
      {/* (The label runs past the names into the squares' column: its backing stops that column's dashes at it.) */}
      {label ? <span className="relative z-[1] bg-card pr-1.5">{label}</span> : null}
    </div>
  );
}

/** One square, by kind: a pick's face (right or wrong), W or L, the points (the week's best bright), a running total, who's left. */
function Cell({ g, x }: { g: GameView; x: Square }) {
  const k = g.plays.kind;
  if (k === "pick") return x.pick ? <NightCell g={g} pk={x.pick} /> : <span className="text-[13px] text-muted-foreground">–</span>;
  if (k === "result") {
    if (!x.result) return <span className="text-[13px] text-muted-foreground">–</span>;
    // Waiting on a late move (someone playing at their own pace): not won or lost yet.
    if (x.waiting) return <b data-waiting className="type-num grid size-6 place-items-center rounded-[2px] border border-dashed border-edge text-[14px] text-muted-foreground">…</b>;
    return <b className={`type-num grid size-6 place-items-center rounded-[2px] text-[14px] ${x.result.r === "W" ? "bg-good text-good-foreground" : "bg-input text-foreground"}`}>{x.result.r}</b>;
  }
  if (g.plays.blocks.includes("boots") && x.held) {
    const left = x.held.length - (x.left?.length ?? 0);
    return (
      <span className="relative">
        <b className="type-num text-[16px] text-foreground/80">{left}</b>
        {!!x.left?.length && <i aria-label="one went home" className="absolute -right-1.5 top-0 size-1.5 rounded-full bg-live" />}
      </span>
    );
  }
  if (x.points === null) return <span className="text-[13px] text-muted-foreground">–</span>;
  const v = k === "race" ? (x.total ?? 0) : x.points;
  return <b className={`type-num text-[16px] ${x.won ? "rounded-[2px] bg-good px-1 text-good-foreground" : x.best ? "text-foreground" : "text-muted-foreground"}`}>{num(v)}</b>;
}

/**
 * Round 5 (B2): a pool's night on the grid. The face is the pick; its badge is the night's outcome, a wrong second
 * pick that counted included: stayed (a tick), went home (a cross), forgiven (a shield, quiet), bought back (an arrow, the chyron's
 * line); a skipped night is a dash, never a miss; a second pick that counted is a pip at the square's foot. One glyph a square, so
 * it reads at 30 columns.
 */
function NightCell({ g, pk }: { g: GameView; pk: NonNullable<Square["pick"]> }) {
  const kind = nightKind(pk);
  if (kind === "skipped") return <Minus data-night="skipped" className="size-4 text-muted-foreground" aria-label="skipped: nobody left to pick" />;
  const deciding = pk.correct !== false && pk.second && !pk.second.void && pk.second.correct === false ? pk.second.id : pk.id;
  const c = deciding ? g.cast.find((f) => f.id === deciding) : undefined;
  return (
    <span className="relative block size-6" data-night-cell={kind ?? "waiting"}>
      {c ? <Face src={c.photo} name={c.name} className={`size-6 rounded-[2px] text-[10px] ${kind && kind !== "stayed" ? "opacity-50 grayscale" : ""}`} /> : <span aria-label="No pick" className="block size-6 rounded-[2px] border border-dashed border-edge" />}
      {kind && <NightBadge kind={kind} cost={pk.boughtBack} className="absolute -right-[5px] -top-[5px] size-3.5" />}
      {pk.second && !pk.second.void && <i role="img" data-night-second aria-label="a second pick counted" className="absolute -bottom-[5px] left-1/2 h-[3px] w-3 -translate-x-1/2 rounded-full bg-foreground" />}
    </span>
  );
}

/** Round 5 (B2): the marks a pool's grid uses, named once under it. */
function nightKey(g: GameView): ReactNode[] {
  if (g.plays.kind !== "pick") return [];
  const all = Object.values(g.plays.rows).flat().map((s) => s.pick).filter((p): p is NonNullable<Square["pick"]> => !!p);
  const out: ReactNode[] = [];
  if (all.some((p) => nightKind(p) === "forgiven")) out.push(<span key="f" className="inline-flex items-center gap-1"><NightBadge kind="forgiven" className="size-3.5" />wrong, forgiven</span>);
  if (all.some((p) => nightKind(p) === "missed")) out.push(<span key="m" className="inline-flex items-center gap-1"><NightBadge kind="missed" className="size-3.5" />no pick, missed</span>);
  if (all.some((p) => nightKind(p) === "bought")) out.push(<span key="b" className="inline-flex items-center gap-1"><NightBadge kind="bought" className="size-3.5" />out of lives, bought back in</span>);
  if (all.some((p) => p.skipped)) out.push(<span key="s" className="inline-flex items-center gap-1"><Minus className="size-3" aria-hidden />skipped: nobody left to pick</span>);
  if (all.some((p) => p.second && !p.second.void)) out.push(<span key="2" className="inline-flex items-center gap-1"><i aria-hidden className="h-[3px] w-3 rounded-full bg-foreground" />a second pick counted</span>);
  return out;
}

/**
 * Round 5 (B2, Designs needed 21): how the couch does against the bot, as far as you've seen: a row a person, the questions they
 * beat it on against those it beat them on, on one scale (Round 3's record bar), and the bot's own right calls in the heading.
 */
function AgainstTheBot({ g }: { g: GameView }) {
  const bot = g.bot;
  if (!bot || !bot.called) return null;
  const rows = g.table.filter((r) => !r.bot).map((r) => ({ r, level: 0, ...(bot.vs[r.playerId] ?? { beat: 0, beaten: 0 }) }));
  const most = Math.max(1, ...rows.map((x) => x.beat + x.beaten + (x.level ?? 0)));
  const part = (k: number, n: number) => (k ? `max(72px, ${(k / Math.max(1, n)) * 100}%)` : "0px");
  return (
    <section className="mx-4 mt-6" data-against-bot>
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <h2 className="type-caption text-[24px]">Against the bot</h2>
        <small className="text-[13px] text-muted-foreground">
          The bot: {bot.right} of {bot.called} right
        </small>
      </div>
      {rows.map(({ r, beat, beaten, level = 0 }) => {
        const n = beat + beaten + level;
        const who = r.you ? "You" : r.name.split(" ")[0];
        return (
          <div key={r.playerId} data-bot-person={r.name} className="grid min-h-11 grid-cols-[26px_52px_minmax(0,1fr)] items-center gap-2.5 border-t border-border py-1.5">
            <Avatar id={r.userId ?? r.playerId} name={r.name} size={26} />
            <span className="truncate text-[15px] font-semibold">{r.you ? "You" : r.name.split(" ")[0]}</span>
            {n ? (
              <span role="img" className="flex h-6 min-w-0 gap-px" style={{ width: `max(${[beat, level, beaten].filter(Boolean).length * 76}px, ${(n / most) * 100}%)` }} aria-label={`${who}: beat the bot on ${beat}, level on ${level}, the bot won on ${beaten}`}>
                {beat > 0 && <i className="type-num grid h-full place-items-center whitespace-nowrap bg-foreground px-1.5 text-[13px] not-italic leading-6 text-background" style={{ flex: `1 1 ${part(beat, n)}` }}>{`beat it ${beat}`}</i>}
                {level > 0 && <i className="type-num grid h-full place-items-center whitespace-nowrap bg-secondary px-1.5 text-[13px] not-italic leading-6 text-foreground" style={{ flex: `1 1 ${part(level, n)}` }}>{`level ${level}`}</i>}
                {beaten > 0 && <i className="type-num grid h-full place-items-center whitespace-nowrap bg-input px-1.5 text-[13px] not-italic leading-6 text-foreground" style={{ flex: `1 1 ${part(beaten, n)}` }}>{`it won ${beaten}`}</i>}
              </span>
            ) : (
              <span className="text-[13px] text-muted-foreground">Even so far</span>
            )}
          </div>
        );
      })}
      <p className="mt-2 text-[13px] leading-snug text-muted-foreground">Beat it: you were right and the bot wasn&apos;t. Level: you both were, so nobody scored. It won: the bot was right and you weren&apos;t.</p>
    </section>
  );
}

/** The next episode: yours Due (white, never yellow: the strip above is the one yellow), Set, or –; anyone else's Set or –. */
function NextCell({ set, you, due }: { set: boolean | null | undefined; you: boolean; due: boolean }) {
  if (you && due && !set) return <NextTag due>Due</NextTag>;
  if (set === undefined || set === null) return null;
  return set ? <NextTag>Set</NextTag> : <span className="text-[13px] text-muted-foreground">–</span>;
}

function NextTag({ due, children }: { due?: boolean; children: ReactNode }) {
  return <i className={`type-caption grid size-[26px] place-items-center rounded-[2px] border-[1.5px] border-dashed text-[11px] not-italic tracking-[0.01em] ${due ? "border-foreground text-foreground" : "border-edge text-good"}`}>{children}</i>;
}

// ---------- You ----------

/** You, the page itself under a big header (the couch framed above): your place, your sheet's door, what's yours of the twists, then
 *  your own sheet's strip and latest episode. */
function YouSection({ g, m, show, seasonId, drill }: { g: GameView; m: PageModel; show: ShowData; seasonId: string; drill: DrillState }) {
  const r = g.you!;
  const [episode, setEpisode] = useState<number | null>(null);
  const place = r.rank.startsWith("T") ? `Tied ${ordinal(Number(r.rank.slice(1)))}` : ordinal(r.place);
  return (
    <section className="mt-8" data-game-you>
      <div className="mx-4 flex items-center gap-3">
        <Avatar id={r.userId ?? r.playerId} name={r.name} size={40} />
        <div className="min-w-0">
          <b className="type-caption block text-[28px] leading-none">You</b>
          <small className="mt-1 block text-[14px] text-muted-foreground">
            {place} of {g.players} · {totalWords(g, r)}
          </small>
        </div>
        <button type="button" data-door-you onClick={() => drill.open({ kind: "person", playerId: r.playerId, episode })} className="ml-auto inline-flex min-h-11 flex-none items-center gap-0.5 text-[14px] font-semibold">
          Your sheet
          <ChevronRight className="size-4" aria-hidden />
        </button>
      </div>
      <div className={`mx-4 mt-4 ${g.plays.kind === "staged" ? "hidden" : ""}`}>
        <PersonBody g={g} show={show} seasonId={seasonId} rules={m.rules} r={r} episode={episode} onEpisode={setEpisode} go={drill} onClose={() => {}} compact />
      </div>
    </section>
  );
}
