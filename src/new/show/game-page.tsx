"use client";

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Check, ChevronDown, ChevronLeft, ChevronRight, Heart, X } from "lucide-react";
import { lockTime } from "../clock";
import { useGameQuestions, useSeasonDraft, useSeasonWaivers, type GameView } from "../data";
import { useNav } from "../nav";
import { paths } from "../routes";
import { isTabOf, openWhere, useShow, type ShowData } from "../screens/show-space";
import { colourOf } from "../tune-in";
import { Avatar } from "../ui/bars";
import { EmptyState, GuardChip } from "../ui/parts";
import { Sheet } from "../ui/sheet";
import { splitFrame, frameStyle } from "@/lib/art-frame";
import { pageModel, type FaceM, type HeroM, type PageModel, type PlateM, type Standing, type StripM, type Tone } from "@/lib/game/game-page/model";
import { openBingo } from "./bingo";
import { openCall } from "./calls";
import { MovesSheet } from "./dock";
import { openMoves } from "./moves";
import { Face } from "./parts";
import { openSheet, QuestionsBody } from "./questions";
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
  const m = pageModel(g, g.page, {
    show: show.header?.show.name ?? "",
    words: show.words,
    next: show.upNext ? { number: show.upNext.number, airsAt: show.upNext.airAt } : null,
    when,
    move: move ? { kind: move.kind, title: move.title, line: move.line, due: move.due, go: move.go } : null,
    line: g.short,
    seen: show.seenThrough,
  });
  const art = show.header?.show.backdropUrl ?? show.header?.show.artUrl ?? null;
  const [colour, setColour] = useState<string | null>(null);
  useEffect(() => {
    let on = true;
    colourOf(seasonId, art).then((c) => on && setColour(c));
    return () => {
      on = false;
    };
  }, [seasonId, art]);
  const [rules, setRules] = useState(false);
  const faces = new Map(g.cast.map((c) => [c.id, c.photo]));
  return (
    <div data-game-page={g.leagueId} data-game-main={m.main} data-game-phase={m.phase} className="pb-16">
      <TitleCard m={m} art={art} colour={colour} onBack={onBack} />
      {show.header && !g.solo && (
        <div className="mt-3 px-4">
          <GuardChip seenThrough={show.seenThrough} ep={show.words.ep} onChange={() => openWhere(show)} className="h-11!" />
        </div>
      )}
      <Strip strip={m.strip} g={g} show={show} />
      <Hero hero={m.hero} />
      {m.inPlace === "questions" && <InPlaceQuestions seasonId={seasonId} g={g} />}
      <Label>The couch</Label>
      <Couch m={m} faces={faces} />
      <Previously m={m} faces={faces} />
      <Label>How it plays</Label>
      <ol className="mx-4 list-decimal pl-[18px] text-[15px] leading-[1.45] text-foreground/90" data-game-rules>
        {m.rules.slice(0, 4).map((r) => (
          <li key={r} className="mb-1.5 pl-1">
            {r}
          </li>
        ))}
      </ol>
      {m.rules.length > 4 && (
        <button type="button" onClick={() => setRules(true)} className="mx-4 inline-flex min-h-11 items-center text-[14px] font-semibold underline underline-offset-[3px]">
          All {m.rules.length} rules
        </button>
      )}
      {/* Your moves (dock.tsx), as the show's tabs have it: the strip's lineup or pick opens it on this game. */}
      {show.header && <MovesSheet show={show} seasonId={seasonId} />}
      <Sheet open={rules} onOpenChange={setRules} title="How it plays" subtitle={g.gameName}>
        <ol className="list-decimal pl-[18px] text-[15px] leading-[1.45]">
          {m.rules.map((r) => (
            <li key={r} className="mb-2 pl-1">
              {r}
            </li>
          ))}
        </ol>
      </Sheet>
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

// ---------- the big graphic: where you stand ----------

function Hero({ hero }: { hero: HeroM }) {
  const mid = hero.n != null && hero.n.length > 2;
  return (
    <section data-game-hero className="mt-6">
      {hero.stages && (
        <div className="mx-4 mb-6 flex gap-1.5">
          {hero.stages.map((s) => (
            <Plate key={s.name} tag={s.tag} tone={s.now ? "show" : "quiet"} title={s.name} size="xs" dim={!s.now} className="min-w-0 flex-1" />
          ))}
        </div>
      )}
      {hero.vs ? (
        // The face-off: the last episode's final, the two seats either side, the score on one line as big as 390 lets it be.
        <>
          <div className="mx-4 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2" data-game-vs>
            <span className="flex min-w-0 flex-col items-start gap-1.5">
              <Avatar id={hero.vs.youUser ?? hero.vs.youId} name="You" size={52} />
              <span className="type-caption text-[17px]">{hero.vs.you}</span>
            </span>
            <b className={`type-num whitespace-nowrap leading-[.8] ${scoreSize(hero.vs.you_n.length + hero.vs.them_n.length)}`}>
              {hero.vs.you_n}
              <span className="text-muted-foreground">–</span>
              {hero.vs.them_n}
            </b>
            <span className="flex min-w-0 flex-col items-end gap-1.5">
              {hero.vs.themId ? <Avatar id={hero.vs.themUser ?? hero.vs.themId} name={hero.vs.them} size={52} /> : <span className="size-[52px]" />}
              <span className="type-caption max-w-full truncate text-[17px]">{hero.vs.them}</span>
            </span>
          </div>
        </>
      ) : (
        hero.n != null && (
          <div className="mx-4 flex items-end gap-3">
            <b className={`type-num flex-none ${mid ? "text-[104px]" : "text-[140px]"} leading-[.74]`}>{hero.n}</b>
            <p className="type-caption mb-1.5 text-[26px] leading-none">
              {hero.label}
              {hero.sub && <small className="mt-1.5 block text-[14px] font-medium normal-case tracking-normal text-muted-foreground [font-stretch:100%]">{hero.sub}</small>}
            </p>
          </div>
        )
      )}
      {hero.vs && hero.sub && <p className="mx-4 mt-3 text-[14px] text-muted-foreground">{hero.sub}</p>}
      {hero.lives && (
        <div className="mx-4 mt-4 flex items-center gap-1.5" aria-label={`${hero.lives.left} of ${hero.lives.of} lives left`}>
          {Array.from({ length: hero.lives.of }, (_, i) => (
            <Heart key={i} className={`size-6 ${i < hero.lives!.left ? "fill-foreground text-foreground" : "text-muted-foreground"}`} aria-hidden />
          ))}
        </div>
      )}
      {(hero.faces.length > 0 || hero.slot) && (
        <div className="mx-4 mt-[18px] flex flex-wrap gap-x-1.5 gap-y-3" data-game-faces>
          {hero.faces.map((f) => (
            <HeroFace key={f.id} f={f} />
          ))}
          {hero.slot && (
            <span className="flex w-[54px] flex-col items-center gap-1.5">
              <span className="grid size-[52px] place-items-center rounded-[6px] border-2 border-dashed border-edge text-[22px] text-muted-foreground">+</span>
              <span className="type-caption text-[13px]">{hero.slot}</span>
            </span>
          )}
        </div>
      )}
      {hero.bars && (
        <div className="mx-4 mt-4 flex flex-col gap-2" data-game-bars>
          {hero.bars.map((b) => (
            <div key={b.name} className="flex items-center gap-2.5">
              <span className="type-caption w-[62px] truncate text-[15px]">{b.name}</span>
              <span className="h-3.5 flex-1 overflow-hidden rounded-[2px] bg-secondary">
                <i className={`block h-full origin-left ${b.you ? "bg-foreground" : "bg-muted-foreground"}`} style={{ transform: `scaleX(${Math.min(1, b.max ? b.value / b.max : 0)})` }} />
              </span>
              <span className="type-num w-[30px] text-right text-[18px]">{b.value}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/** The face-off's score size by how many digits it has ("18–14" 104px, "6.5–2.5" 72px). */
const scoreSize = (n: number) => (n <= 4 ? "text-[104px]" : n <= 6 ? "text-[72px]" : "text-[56px]");

function HeroFace({ f }: { f: FaceM }) {
  return (
    <span className="flex w-[54px] flex-col items-center gap-1.5" data-game-face={f.id}>
      <span className={`relative size-[52px] rounded-full ${f.on ? "ring-[3px] ring-foreground" : ""}`}>
        <Face src={f.photo} name={f.name} out={f.out} className={`size-[52px] rounded-full text-[18px] ${f.out ? "brightness-[.55]" : ""}`} />
        {f.badge && (
          <span className={`type-caption absolute -bottom-1 -right-1 grid h-[22px] min-w-[22px] place-items-center rounded-full px-1 text-[12px] shadow-[0_0_0_2px_var(--background)] ${TONE[f.badge.tone]}`}>
            {f.badge.text === "right" ? <Check className="size-3.5" strokeWidth={3} aria-label="right" /> : f.badge.text === "wrong" ? <X className="size-3.5" strokeWidth={3} aria-label="wrong" /> : f.badge.text}
          </span>
        )}
      </span>
      <span className={`type-caption max-w-[64px] truncate text-[13px] ${f.out ? "text-muted-foreground" : ""}`}>{f.name}</span>
      {f.line && <span className="max-w-[64px] truncate text-[12.5px] text-muted-foreground">{f.line}</span>}
    </span>
  );
}

// ---------- the move, in place ----------

function InPlaceQuestions({ seasonId, g }: { seasonId: string; g: GameView }) {
  const r = useGameQuestions(seasonId, g.leagueId, null);
  const d = r.data;
  return (
    <section id="gp-move" className="mx-4 mt-6 scroll-mt-4" data-game-move="questions">
      {r.isPending ? (
        <div aria-busy className="h-48 animate-pulse rounded-[3px] bg-card" />
      ) : !d ? (
        <p className="text-sm text-muted-foreground">Couldn&apos;t load the questions. Try again in a moment.</p>
      ) : (
        <QuestionsBody key={JSON.stringify(d.questions.map((q) => [q.id, q.mine, q.status]))} target={{ seasonId, leagueId: g.leagueId, episode: null, game: g.gameName }} d={d} onDone={() => {}} place="page" />
      )}
    </section>
  );
}

// ---------- the couch ----------

function Label({ children }: { children: ReactNode }) {
  return <h2 className="type-caption mx-4 mb-2.5 mt-8 text-[24px]">{children}</h2>;
}

/** After a reveal the couch's plates restack: each slides from where it was to its new place (FLIP, transform only). */
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

function Couch({ m, faces }: { m: PageModel; faces: Map<string, string | null> }) {
  const c = m.couch;
  const box = useRestack([...c.podium, ...c.rows].map((s) => s.playerId));
  if (c.coop)
    return (
      <div className="mx-4 flex flex-col gap-1.5" data-game-couch="coop">
        <Plate tag={c.coop.result === "won" ? "Won" : c.coop.result === "lost" ? "Lost" : "Couch"} tone={c.coop.result === "won" ? "good" : "quiet"} title={`${c.coop.lives} of ${c.coop.of} lives`} line="Together against the show" size="sm" />
        {c.podium.length > 0 && <p className="text-[13px] text-muted-foreground">{c.podium.map((s) => (s.you ? "You" : s.name)).join(", ")}{c.rows.length ? ` and ${c.rows.length} more` : ""}</p>}
      </div>
    );
  return (
    <div ref={box} data-game-couch={c.unit}>
      {c.teams && <p className="mx-4 mb-2 text-[13px] text-muted-foreground">{c.teams}</p>}
      <div className="mx-4 flex flex-col gap-1.5">
        {c.podium.map((s) => (
          <div key={s.playerId} data-restack={s.playerId}>
            <Plate tag={s.you ? `${s.rank} · You` : s.rank} tone={s.you ? "you" : "quiet"} title={s.name} line={s.sub} size="xs" right={s.value} photo={s.face ? (faces.get(s.face) ?? null) : undefined} />
          </div>
        ))}
      </div>
      {c.rows.length > 0 && (
        <div className="mx-4 mt-2">
          {c.rows.map((s) => (
            <Row key={s.playerId} s={s} />
          ))}
        </div>
      )}
      <p className="mx-4 mt-2 text-[13px] text-muted-foreground">
        {[c.unit === "Points" ? null : `Ranked by ${c.unit.toLowerCase()}`, c.note, c.players > c.podium.length + c.rows.length ? `${c.players} playing` : null].filter(Boolean).join(" · ")}
      </p>
    </div>
  );
}

function Row({ s }: { s: Standing }) {
  return (
    <div data-restack={s.playerId} className="flex min-h-12 items-center gap-2.5 border-b border-border text-[15px]">
      <span className="type-num w-7 text-center text-[18px] text-muted-foreground">{s.out ? "–" : s.rank}</span>
      <Avatar id={s.userId ?? s.playerId} name={s.name} size={28} />
      <span className="min-w-0 flex-1 py-1.5">
        <span className={`flex items-center gap-2 font-semibold ${s.out ? "text-muted-foreground" : ""}`}>
          <span className="truncate">{s.name}</span>
          {s.bot && <span className="type-caption flex-none rounded-[2px] bg-secondary px-1.5 py-0.5 text-[10px] tracking-[0.06em] text-muted-foreground">Computer</span>}
          {s.out && <span className="type-caption flex-none rounded-[2px] bg-live px-1.5 py-0.5 text-[11px] tracking-[0.04em] text-live-foreground">Out</span>}
        </span>
        {s.sub && <small className="block truncate text-[13px] font-normal text-muted-foreground">{s.sub}</small>}
      </span>
      <b className={`type-num min-w-[34px] text-right text-[20px] ${s.out ? "text-muted-foreground" : ""}`}>{s.value}</b>
    </div>
  );
}

// ---------- Previously on ----------

function Previously({ m, faces }: { m: PageModel; faces: Map<string, string | null> }) {
  const p = m.previously;
  return (
    <section data-game-previously={p.items.length}>
      <h2 className="type-caption mx-4 mb-1 mt-8 text-[32px] leading-[.9]">Previously on</h2>
      <p className="mx-4 mb-2.5 text-[13px] text-muted-foreground">{p.asOf}</p>
      {p.items.length > 0 ? (
        <div className="mx-4 flex flex-col gap-1.5">
          {p.items.map((it: PlateM, i) => (
            <Plate key={i} tag={it.tag} tone={it.tone} title={it.title} line={it.line} size="xs" photo={it.face ? (faces.get(it.face) ?? null) : undefined} />
          ))}
        </div>
      ) : (
        <div className="mx-4">
          <Plate tag="Next" tone="quiet" title="Nothing yet" line={m.phase === "before" ? p.asOf : "It fills in as you watch"} size="xs" dim />
        </div>
      )}
    </section>
  );
}
