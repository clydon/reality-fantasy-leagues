"use client";

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Check, ChevronDown, ChevronLeft, ChevronRight, Heart, X } from "lucide-react";
import { lockTime } from "../clock";
import { useQueryClient } from "@tanstack/react-query";
import { chooseTwist, setGroupSlot, useGameQuestions, useLeagueRoles, useLeagueTwist, useSeasonDraft, useSeasonWaivers, type GameView, type LeagueTwist } from "../data";
import { NavLink, useNav } from "../nav";
import { paths } from "../routes";
import { isTabOf, openWhere, useShow, type ShowData } from "../screens/show-space";
import { colourOf } from "../tune-in";
import { Avatar } from "../ui/bars";
import { EmptyState, GuardChip } from "../ui/parts";
import { ordinal } from "../games";
import { toast } from "../ui/toast";
import { has } from "@/lib/game/game-page/compile";
import { splitFrame, frameStyle } from "@/lib/art-frame";
import { pageModel, type HeroM, type PageModel, type StripM, type Tone } from "@/lib/game/game-page/model";
import type { Square } from "@/lib/game/game-plays";
import { openBingo } from "./bingo";
import { openCall } from "./calls";
import { MovesSheet } from "./dock";
import { openMoves } from "./moves";
import { Face } from "./parts";
import { answerWords, openSheet, QuestionsBody } from "./questions";
import { DrillSheets, PersonBody, totalWords, useDrill, type DrillState } from "./game-sheets";
import { playsWaivers } from "./waivers";
import { yourMove } from "./your-move";

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
  const g = show.play?.find((x) => x.leagueId === leagueId) ?? null;
  if (!show.play) return <Loading onBack={back} />;
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

function TopBar({ onBack, show }: { onBack: () => void; show: string }) {
  return (
    <div className="relative flex h-12 items-center justify-between px-2.5">
      <button type="button" onClick={onBack} data-game-back className="nd-press flex h-11 items-center gap-0.5 rounded-[3px] pl-1 pr-3 text-[15px] font-semibold">
        <ChevronLeft className="size-5" aria-hidden />
        Games
      </button>
      <span className="type-caption truncate pr-2 text-[15px] tracking-[0.06em] text-foreground/85">{show}</span>
    </div>
  );
}

function GamePageBody({ show, g, onBack }: { show: ShowData; g: GameView; onBack: () => void }) {
  const seasonId = show.header?.seasonId ?? g.leagueId;
  const couchId = show.couch?.id ?? null;
  // Your move in this game, as the Games tab's card says it (the draft and the mid-season draft included).
  const drafting = (g.gameType === "classic-draft" || g.gameType === "active-roster") && !!g.you && (g.you.team.length === 0 || g.from === null || g.through < g.from);
  const draft = useSeasonDraft(seasonId, couchId, { enabled: !!show.header && drafting }).data?.games.find((d) => d.leagueId === g.leagueId);
  const wv = useSeasonWaivers(seasonId, couchId, !!show.header && playsWaivers(show)).data?.games.find((w) => w.leagueId === g.leagueId);
  // A time as far off as it is: "Wed 8:00 PM" within the week, the date too past it (clock.ts lockTime).
  const when = (iso: string) => lockTime(Date.parse(iso));
  const move = yourMove(g, { seasonId, episode: show.words.episode, when, draft, waivers: wv });
  // Secret roles and the top scorer's twist live on the server (their own routes): read only on a game that has them.
  const roles = useLeagueRoles(g.leagueId, has(g.page, "badge", "role")).data ?? null;
  const twist = useLeagueTwist(g.leagueId, has(g.page, "move", "twist")).data ?? null;
  // A game in stages: each stage is a game of its own on the show, under this one.
  const stageGames = (show.play ?? []).filter((x) => x.stageOf === g.leagueId).map((x) => ({ leagueId: x.leagueId, name: x.name, over: x.over, airsAt: x.lineup?.airsAt ?? x.pick?.airsAt ?? null }));
  const m = pageModel(g, g.page, {
    show: show.header?.show.name ?? "",
    words: show.words,
    next: show.upNext ? { number: show.upNext.number, airsAt: show.upNext.airAt } : null,
    when,
    move: move ? { kind: move.kind, title: move.title, line: move.line, due: move.due, go: move.go } : null,
    line: g.short,
    seen: show.seenThrough,
    roles: roles ? { name: roles.roles.name, count: roles.roles.count, dealt: roles.dealt, mine: roles.mine, revealed: roles.revealed } : null,
    twist: twist ? { options: twist.twist.of, next: twist.next, played: twist.played } : null,
    stageGames,
  });
  // Every name, square, episode and face is a door (game-sheets.tsx): each a sheet over the last, the path back on top.
  const drill = useDrill();
  const art = show.header?.show.backdropUrl ?? show.header?.show.artUrl ?? null;
  const [colour, setColour] = useState<string | null>(null);
  useEffect(() => {
    let on = true;
    colourOf(seasonId, art).then((c) => on && setColour(c));
    return () => {
      on = false;
    };
  }, [seasonId, art]);
  return (
    <div data-game-page={g.leagueId} data-game-main={m.main} data-game-phase={m.phase} className="pb-16">
      <TitleCard m={m} art={art} colour={colour} onBack={onBack} />
      {show.header && !g.solo && (
        <div className="mt-3 px-4">
          <GuardChip seenThrough={show.seenThrough} ep={show.words.ep} onChange={() => openWhere(show)} className="h-11!" />
        </div>
      )}
      <Strip strip={m.strip} g={g} show={show} />
      {m.inPlace === "questions" && <InPlaceQuestions seasonId={seasonId} g={g} />}
      {m.inPlace === "twist" && twist?.next && <TwistChooser leagueId={g.leagueId} t={twist} />}
      {m.inPlace === "slots" && <SlotPicker g={g} seasonId={seasonId} />}
      {m.hero.stages && <Stages stages={m.hero.stages} seasonId={seasonId} />}
      <SeasonGrid g={g} m={m} words={show.words} due={!!move?.due} drill={drill} />
      {g.you && <YouSection g={g} m={m} show={show} seasonId={seasonId} drill={drill} />}
      <Label>How it plays</Label>
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
      {/* Your moves (dock.tsx), as the show's tabs have it: the strip's lineup or pick opens it on this game. */}
      {show.header && <MovesSheet show={show} seasonId={seasonId} />}
      <DrillSheets drill={drill} g={g} show={show} seasonId={seasonId} rules={m.rules} />
    </div>
  );
}

// ---------- the title card ----------

function TitleCard({ m, art, colour, onBack }: { m: PageModel; art: string | null; colour: string | null; onBack: () => void }) {
  const { src, frame } = splitFrame(art);
  const long = m.title.name.length > 14;
  return (
    <header className="relative overflow-hidden px-4 pb-1" data-game-title>
      {src && (
        // The show's art in its own colours (the user, 2026-11-08), washed toward Night on the left and at the foot so the title reads.
        <span aria-hidden className="absolute inset-0">
          {/* eslint-disable-next-line @next/next/no-img-element -- art_url can be an arbitrary external URL */}
          <img src={src} alt="" className="size-full object-cover" style={frame ? frameStyle(frame) : { objectPosition: "center 30%" }} />
          <span className="absolute inset-0 bg-[linear-gradient(90deg,rgba(22,20,29,.94),rgba(22,20,29,.72)_45%,rgba(22,20,29,.18)_82%,rgba(22,20,29,.6)),linear-gradient(180deg,rgba(22,20,29,.35),transparent_30%,transparent_55%,var(--background))]" />
        </span>
      )}
      <div className="relative -mx-4">
        <TopBar onBack={onBack} show={m.title.show} />
      </div>
      <h1 className={`type-caption relative mt-2 max-w-[340px] [overflow-wrap:anywhere] [text-shadow:0_2px_18px_rgba(0,0,0,.55)] ${src ? "pt-16" : "pt-2"} ${long ? "text-[48px] leading-[.88]" : "text-[64px] leading-[.86]"}`}>{m.title.name}</h1>
      <div className="relative mt-3.5 flex flex-wrap items-center gap-2">
        <Plate tag={m.title.tag} tone="show" title={m.title.when ?? m.title.show} line={m.title.line} size="sm" tagStyle={colour ? { background: colour, color: inkOn(colour) } : undefined} enter className="w-[min(300px,100%)]" />
      </div>
      {m.chips.length > 0 && (
        <ul className="relative mt-3 flex flex-wrap gap-1.5" data-game-twists aria-label="What's different about this game">
          {m.chips.map((c) => (
            <li key={c} className="type-caption flex h-7 items-center rounded-[2px] bg-background/70 px-2 text-[13px] tracking-[0.04em] text-foreground/90 outline-1 -outline-offset-1 outline-border">
              {c}
            </li>
          ))}
        </ul>
      )}
    </header>
  );
}

// ---------- plates ----------

/** Ink for a tag on a colour read from the show's art: plate ink on a light one, white on a dark one. */
function inkOn(colour: string): string {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(colour.trim());
  const rgb = m ? [m[1], m[2], m[3]].map((h) => parseInt(h, 16) / 255) : (colour.match(/\d+(\.\d+)?/g) ?? []).slice(0, 3).map((n) => Number(n) / 255);
  if (rgb.length < 3) return "var(--plate-foreground)";
  const [r, g, b] = rgb.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.18 ? "var(--plate-foreground)" : "#ffffff";
}

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

function Strip({ strip, g, show }: { strip: StripM; g: GameView; show: ShowData }) {
  const nav = useNav();
  const seasonId = show.header?.seasonId ?? "";
  const go = () => {
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
  const plate = <Plate tag={strip.tag} tone={strip.tone} title={strip.title} line={strip.line} size={strip.due ? "md" : "sm"} chevron={strip.go ? (strip.inPlace ? "down" : "right") : null} />;
  return (
    <div className="mx-4 mt-3" data-game-strip={strip.kind} data-game-due={strip.due ? "yes" : "no"}>
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
    <div className="mx-4 mt-6 flex gap-1.5" data-game-stages>
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
      toast(`${name} is in slot ${slot + 1}`);
    } catch (e) {
      toast.quiet(`Not saved: ${(e as Error).message}`);
    } finally {
      setSaving(null);
    }
  };
  const s = open[0];
  return (
    <section id="gp-move" className="mx-4 mt-6 scroll-mt-4" data-game-move="slots">
      <p className="mb-1.5 text-[13px] text-muted-foreground">
        {`A tap puts a group in slot ${s.slot + 1}${s.status === "dropped" ? " (its group ended)" : ""}${open.length > 1 ? `, then slot ${open[1].slot + 1}` : ""}`}
      </p>
      <div className="flex flex-col gap-1.5">
        {offered.groups.filter((x) => !taken.has(x.id)).map((x) => (
          <button key={x.id} type="button" data-slot-pick={`${s.slot}:${x.id}`} disabled={!!saving} onClick={() => pick(s.slot, x.id, x.name)} className="nd-press block w-full text-left disabled:opacity-60">
            <Plate tag={`Slot ${s.slot + 1}`} tone="quiet" title={saving === `${s.slot}:${x.id}` ? "Saving…" : x.name} line={x.size === 1 ? "1 still in" : `${x.size} still in`} size="xs" />
          </button>
        ))}
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
function keyLine(g: GameView): string {
  const p = g.plays;
  if (p.kind === "staged") return "Each stage keeps its own season, a grid of its own on its page: open one above. This is the overall.";
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
  const cut = m.couch.cutAfter;
  const cutAt = (i: number) => cut !== null && cut === i && i > 0;
  const unit = m.couch.unit === "Points" ? "Pts" : m.couch.unit;
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
              {cutAt(i) && <CutRow label={m.couch.cutLabel ?? "The cut"} />}
              <button
                type="button"
                data-restack={s.playerId}
                data-player={s.name}
                data-door-person={s.playerId}
                onClick={() => person(s.playerId, latest)}
                className={`nd-press flex ${ROW} items-center gap-1.5 border-t border-border text-left ${s.you ? "-ml-2 w-[calc(100%+8px)] rounded-l-[3px] bg-secondary pl-2" : "w-full"}`}
              >
                <Avatar id={s.userId ?? s.playerId} name={s.name} size={20} />
                <span className={`min-w-0 truncate text-[14px] font-semibold ${s.out ? "text-muted-foreground" : ""}`}>{s.you ? "You" : s.name}</span>
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
                  <div data-restack={s.playerId} className={`grid ${ROW} border-t border-border ${s.you ? "bg-secondary" : ""}`} style={{ gridTemplateColumns: tmpl }}>
                    {sq.map((x) => (
                      <button key={x.episode} type="button" data-square={`${s.playerId}:${x.episode}`} aria-label={`${s.name}, ${words.episode} ${x.episode}`} onClick={() => person(s.playerId, x.episode)} className={`nd-press grid place-items-center ${x.episode === latest ? (s.you ? "bg-input/45" : "bg-secondary/60") : ""}`}>
                        <Cell g={g} x={x} />
                      </button>
                    ))}
                    {p.next && <span className="grid place-items-center">{rowOf.has(s.playerId) && <NextCell set={p.next.set[s.playerId]} you={s.you} due={due} />}</span>}
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
        <div className="w-[40px] flex-none">
          <div className="type-caption flex h-[26px] items-center justify-end text-[13px] text-muted-foreground">{unit}</div>
          {rows.map((s, i) => (
            <div key={s.playerId}>
              {cutAt(i) && <CutRow />}
              <div data-restack={s.playerId} className={`flex ${ROW} flex-col items-end justify-center border-t border-border ${s.you ? "-mr-2 w-[calc(100%+8px)] rounded-r-[3px] bg-secondary pr-2" : ""}`}>
                <b className={`type-num text-[20px] leading-none ${s.out ? "text-muted-foreground" : ""}`}>{s.value}</b>
                {s.out && <span className="type-caption mt-1 rounded-[2px] bg-live px-1 text-[10px] tracking-[0.04em] text-live-foreground">Out</span>}
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
      <p className="mt-2.5 text-[12.5px] leading-[1.4] text-muted-foreground">
        {eps.length || p.kind === "staged" ? keyLine(g) : m.phase === "before" ? "It fills in from the first episode with results, as far as you've watched." : "Nothing counted yet, as far as you've watched."}
        {[m.couch.note, m.couch.players > all.length ? `${m.couch.players} playing` : null].filter(Boolean).map((x) => ` ${x}.`)}
      </p>
    </section>
  );
}

/** The next cut's line across the grid, in each of its three columns: the label on the names' side. */
function CutRow({ label }: { label?: string }) {
  return (
    <div aria-hidden={!label} data-game-cut={label ? "" : undefined} className="type-caption flex h-[18px] items-center gap-1.5 whitespace-nowrap text-[11px] tracking-[0.06em] text-muted-foreground after:flex-1 after:border-t after:border-dashed after:border-edge after:content-['']">
      {label ?? null}
    </div>
  );
}

/** One square, by kind: a pick's face (right or wrong), W or L, the points (the week's best bright), a running total, who's left. */
function Cell({ g, x }: { g: GameView; x: Square }) {
  const k = g.plays.kind;
  if (k === "pick") {
    if (!x.pick) return <span className="text-[13px] text-muted-foreground">–</span>;
    const c = x.pick.id ? g.cast.find((f) => f.id === x.pick!.id) : undefined;
    return (
      <span className="relative block size-6">
        {c ? <Face src={c.photo} name={c.name} className={`size-6 rounded-[2px] text-[10px] ${x.pick.correct === false ? "opacity-50 grayscale" : ""}`} /> : <span aria-label="No pick" className="block size-6 rounded-[2px] border border-dashed border-edge" />}
        {x.pick.correct !== null && (
          <i className={`absolute -right-[3px] -top-[3px] grid size-3 place-items-center rounded-full shadow-[0_0_0_1.5px_var(--card)] ${x.pick.correct ? "bg-good text-good-foreground" : "bg-live text-live-foreground"}`}>
            {x.pick.correct ? <Check className="size-2" strokeWidth={4} aria-label="stayed" /> : <X className="size-2" strokeWidth={4} aria-label="went home" />}
          </i>
        )}
      </span>
    );
  }
  if (k === "result") {
    if (!x.result) return <span className="text-[13px] text-muted-foreground">–</span>;
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

/** The next episode: yours Due (white, never yellow: the strip above is the one yellow), Set, or –; anyone else's Set or –. */
function NextCell({ set, you, due }: { set: boolean | null | undefined; you: boolean; due: boolean }) {
  if (you && due && !set) return <NextTag due>Due</NextTag>;
  if (set === undefined || set === null) return null;
  return set ? <NextTag>Set</NextTag> : <span className="text-[13px] text-muted-foreground">–</span>;
}

function NextTag({ due, children }: { due?: boolean; children: ReactNode }) {
  return <i className={`type-caption grid size-[26px] place-items-center rounded-[2px] border-[1.5px] border-dashed text-[10px] not-italic tracking-[0.02em] ${due ? "border-foreground text-foreground" : "border-edge text-good"}`}>{children}</i>;
}

// ---------- You ----------

/** You, the page itself under a big header (the couch framed above): your place, your sheet's door, what's yours of the twists, then
 *  your own sheet's strip and latest episode. */
function YouSection({ g, m, show, seasonId, drill }: { g: GameView; m: PageModel; show: ShowData; seasonId: string; drill: DrillState }) {
  const r = g.you!;
  const [episode, setEpisode] = useState<number | null>(null);
  const place = r.rank.startsWith("T") ? `Tied ${ordinal(Number(r.rank.slice(1)))}` : ordinal(r.place);
  const hero = m.hero;
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
      {hero.lives && (
        <div className="mx-4 mt-3 flex items-center gap-1.5" aria-label={`${hero.lives.left} of ${hero.lives.of} lives left`} data-game-hearts>
          {Array.from({ length: hero.lives.of }, (_, i) => (
            <Heart key={i} className={`size-5 ${i < hero.lives!.left ? "fill-foreground text-foreground" : "text-muted-foreground"}`} aria-hidden />
          ))}
        </div>
      )}
      {hero.notes.length > 0 && (
        <div className="mx-4 mt-3 flex flex-col gap-1.5" data-game-notes>
          {hero.notes.map((n) => (
            <Plate key={n.tag + n.title} tag={n.tag} tone={n.tone} title={n.title} line={n.line} size="xs" />
          ))}
        </div>
      )}
      <div className={`mx-4 mt-4 ${g.plays.kind === "staged" ? "hidden" : ""}`}>
        <PersonBody g={g} show={show} seasonId={seasonId} rules={m.rules} r={r} episode={episode} onEpisode={setEpisode} go={drill} onClose={() => {}} compact />
      </div>
    </section>
  );
}
