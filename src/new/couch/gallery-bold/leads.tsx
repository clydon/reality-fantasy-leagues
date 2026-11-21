"use client";

import { Bot, Check, VenetianMask } from "lucide-react";
import type * as GalleryModule from "@/lib/game/start-gallery/index.js";
import type { Base, Spec } from "@/lib/game/start-gallery/index.js";
import type { CastStat } from "@/lib/game/cast-stats";
import { colourOf } from "@/lib/people";
import type { Pack } from "@/lib/game/game-words/index.js";
import { useRoster } from "../../data";
import { nextGame, type Mark } from "./sport";
import type { Whose } from "./whose";
import { TeamMark } from "../../sports/parts";
import { Avatar } from "../../ui/bars";
import { Face } from "../../show/parts";
import { FOCUS, LengthMark } from "./parts";
import { lockWords, say, type Input } from "./model";

// The lead tile (docs/design-round/wizard-r2b-shape.md): each category's best-known game drawn with this season's own things, so
// it's recognised before its name is read (PFD's R4): the faces still in as far as you've seen (the Cast tab's read, so nobody
// sees a face leave early), the next episode's questions, a card of the show's own moments, the couch paired off. One composition
// per tile (R1). The whole tile opens the game, as its square does.

type GM = typeof GalleryModule;

export interface LeadData {
  /** The cast still in as far as you've seen, with photos first; null while it loads or for a show with no cast yet. */
  faces: CastStat[] | null;
}

const Faces = ({ faces, max, safe }: { faces: CastStat[]; max: number; safe?: number }) => {
  const shown = faces.slice(0, max);
  const more = faces.length - shown.length;
  return (
    <div className="flex items-center gap-[3px]" aria-hidden>
      {shown.map((f, i) => (
        <span key={f.name} className="relative size-[34px] flex-none overflow-hidden rounded-[3px] bg-background">
          <Face src={f.photo} name={f.first} loading="lazy" className="size-full text-[15px]" />
          {safe === i && (
            <span className="absolute inset-x-0 bottom-0 grid h-3.5 place-items-center bg-foreground text-background">
              <Check className="size-3" strokeWidth={3.5} />
            </span>
          )}
        </span>
      ))}
      {more > 0 && <span className="type-caption grid h-[34px] flex-none place-items-center rounded-[3px] bg-background px-1.5 text-[14px] tabular-nums text-muted-foreground">+{more}</span>}
    </div>
  );
};

const Rows = ({ rows }: { rows: string[] }) => (
  <ol className="flex flex-col">
    {rows.map((r, i) => (
      <li key={i} className="flex items-baseline gap-2 border-t border-border py-1 text-[14px] leading-snug first:border-t-0">
        <span className="type-caption w-4 flex-none text-[13px] tabular-nums text-muted-foreground">{i + 1}</span>
        <span className="min-w-0 truncate">{r}</span>
      </li>
    ))}
  </ol>
);

const Couch = ({ input, masked }: { input: Input; masked?: number }) => {
  const people = input.marks.slice(0, 6);
  if (people.length < 2) return null;
  if (masked != null)
    return (
      <div className="flex items-center gap-1.5" aria-hidden>
        {people.map((p, i) => (
          <span key={p.userId} className="relative">
            <Avatar id={p.userId} name={p.name} size={34} colour={colourOf(p.userId)} />
            {i % 2 === 1 && i < masked * 2 && (
              <span className="absolute -bottom-1 -right-1 grid size-5 place-items-center rounded-full bg-foreground text-background">
                <VenetianMask className="size-3.5" strokeWidth={2.4} />
              </span>
            )}
          </span>
        ))}
      </div>
    );
  const pairs: [typeof people[number], typeof people[number]][] = [];
  for (let i = 0; i + 1 < people.length; i += 2) pairs.push([people[i], people[i + 1]]);
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5" aria-hidden>
      {pairs.slice(0, 2).map(([a, b]) => (
        <span key={a.userId} className="flex items-center gap-1.5 text-[14px] font-semibold">
          <Avatar id={a.userId} name={a.name} size={26} colour={colourOf(a.userId)} />
          <span className="type-caption text-[13px] text-muted-foreground">vs</span>
          <Avatar id={b.userId} name={b.name} size={26} colour={colourOf(b.userId)} />
        </span>
      ))}
    </div>
  );
};

const Card = ({ words }: { words: string[] }) => {
  const cells = [...words.slice(0, 4), "Free", ...words.slice(4, 8)];
  return (
    <div className="grid w-full grid-cols-3 gap-[3px]" aria-hidden>
      {cells.map((w, i) => (
        <span key={i} className={`type-caption flex h-[42px] items-center justify-center rounded-[2px] px-1.5 text-center text-[12px] leading-[1.05] tracking-[0.02em] ${i === 4 ? "bg-foreground text-background" : "bg-background"}`}>
          <span className="line-clamp-2">{w}</span>
        </span>
      ))}
    </div>
  );
};

/** While the cast is on its way: the strip's place held, so the tile doesn't jump when the faces come. */
const Waiting = ({ n }: { n: number }) => (
  <div className="flex items-center gap-[3px]" aria-hidden>
    {Array.from({ length: n }, (_, i) => (
      <span key={i} className="size-[34px] flex-none animate-pulse rounded-[3px] bg-background" />
    ))}
  </div>
);

/** What the tile draws, by the category and the game. */
function picture(cat: string, base: Base, spec: Spec | null, input: Input, gm: GM, data: LeadData): React.ReactNode {
  const faces = data.faces ?? [];
  const next = input.listed.find((e) => e.number === input.from);
  const when = next ? lockWords(next.airAt) : null;
  const ep = input.ep === "episode" ? "Ep" : input.ep[0].toUpperCase() + input.ep.slice(1);
  const kind = spec ? gm.kindOf(spec) : null;
  const moments = input.pg.moments.map((m) => m.label ?? "").filter((l) => l && l.length <= 22);
  if (cat === "versus") return <Couch input={input} />;
  if (cat === "party" && base.id === "traitors") return <Couch input={input} masked={2} />;
  if (data.faces === null && (kind === "draft" || cat === "pools")) return <Waiting n={cat === "pools" ? 6 : 8} />;
  if (kind === "draft" && faces.length) return <Faces faces={faces} max={8} />;
  if (cat === "pools" && faces.length)
    return (
      <div className="flex flex-col gap-1.5">
        <span className="type-caption text-[14px] tracking-[0.03em] text-muted-foreground">
          {ep} {input.from}{when ? ` · ${when}` : ""} · {["pool", "lives", "norepeat"].includes(base.id) ? "who stays?" : "who scores?"}
        </span>
        <Faces faces={faces} max={6} safe={1} />
      </div>
    );
  if (kind === "questions" && Array.isArray(spec?.ask) && spec.ask.length) {
    const qs = spec.ask.map((q) => say(String((q as { ask?: string }).ask ?? ""), input.nouns)).filter(Boolean);
    if (cat === "bets") {
      const bank = ((spec.score as { bank?: { start?: number } } | undefined)?.bank?.start) ?? 100;
      const who = faces[0]?.first ?? "someone";
      const bet = Math.round(bank / 2);
      return (
        <p className="text-[15px] leading-snug">
          <span className="type-caption mr-1.5 rounded-[2px] bg-background px-1.5 py-[1px] text-[14px] tracking-[0.04em]">Bet {bet} of {bank}</span>
          on {who} going home: right, you have <b className="tabular-nums">{bank + bet}</b>
        </p>
      );
    }
    if (cat === "solo")
      return (
        <div className="flex items-center gap-2 text-[14px]" aria-hidden>
          {input.marks.find((m) => m.you) && <Avatar id={input.marks.find((m) => m.you)!.userId} name={input.marks.find((m) => m.you)!.name} size={30} colour={colourOf(input.marks.find((m) => m.you)!.userId)} />}
          <span className="type-caption text-[13px] text-muted-foreground">vs</span>
          <span className="grid size-[30px] place-items-center rounded-full bg-background"><Bot className="size-[18px]" /></span>
          <span className="min-w-0 truncate text-muted-foreground">{qs[0]}</span>
        </div>
      );
    return <Rows rows={qs.slice(0, 3)} />;
  }
  if (kind === "card" && moments.length >= 8) return <Card words={moments} />;
  if (cat === "versus" || base.id === "h2h" || base.id === "h2hpicks") return <Couch input={input} />;
  if (cat === "party") return <Couch input={input} masked={2} />;
  if (cat === "season" && input.stages.length > 1)
    return (
      <div className="flex w-full items-stretch gap-[3px]" aria-hidden>
        {input.stages.slice(0, 3).map((s, i) => (
          <span key={s.id} className={`flex min-w-0 flex-1 flex-col rounded-[2px] px-2 py-1 ${i === 0 ? "bg-background" : "border-2 border-foreground"}`}>
            <span className="type-caption truncate text-[14px]">{s.name}</span>
            <span className="truncate text-[12px] text-muted-foreground">{i === 0 ? "game one" : `game ${i + 1} · ${s.start}`}</span>
          </span>
        ))}
      </div>
    );
  if (faces.length) return <Faces faces={faces} max={8} />;
  return null;
}

type Side = { id: string; name: string; home?: true };
const markFor = (marks: Map<string, Mark>, side: { id: string; name: string }): Mark => marks.get(side.id) ?? { abbr: side.name.split(" ").pop()!.slice(0, 3).toUpperCase(), color: null, short: side.name.split(" ").pop()! };
const order = (x: { sides: Side[] }) => [...x.sides].sort((a, b) => Number(!!a.home) - Number(!!b.home));
/** A game as a fan reads it: the visitors' mark and name, at, the home side's. */
function Matchup({ x, marks, big = false }: { x: { sides: Side[] }; marks: Map<string, Mark>; big?: boolean }) {
  const [away, home] = order(x);
  if (!away || !home) return null;
  const a = markFor(marks, away);
  const h = markFor(marks, home);
  return (
    <span className={`flex min-w-0 items-center gap-1.5 ${big ? "text-[16px] font-semibold" : "text-[14px]"}`}>
      <TeamMark abbr={a.abbr} color={a.color} size="sm" />
      <span className="truncate">{a.short}</span>
      <span className="type-caption flex-none text-[13px] text-muted-foreground">at</span>
      <TeamMark abbr={h.abbr} color={h.color} size="sm" />
      <span className="truncate">{h.short}</span>
    </span>
  );
}

/** A sport's lead pictures (the round's frame: a face per player doesn't scale, so lists and the schedule): the team's players, the
 *  next games to pick, the next game's line, a corner of the squares grid; the couch paired off as on a show. */
function SportPicture({ cat, base, spec, input, gm, pack, marks, whose }: { cat: string; base: Base; spec: Spec | null; input: Input; gm: GM; pack: Pack; marks: Map<string, Mark>; whose: Whose | null }) {
  const roster = useRoster(input.seasonId);
  const kind = spec ? gm.kindOf(spec) : null;
  const games = (pack.games ?? []).filter((g) => !g.started);
  const g = nextGame(pack);
  const when = (at?: string) => (at ? lockWords(at) : null);
  const markOf = (side: { id: string; name: string }) => markFor(marks, side);
  if (cat === "versus") return <Couch input={input} />;
  if (kind === "draft") {
    const people = (roster.data?.groups ?? []).flatMap((x) => x.people).filter((x) => x.photoUrl);
    if (people.length)
      return (
        <div className="flex items-center gap-[3px]" aria-hidden>
          {people.slice(0, 8).map((x) => (
            <span key={x.name} className="size-[34px] flex-none overflow-hidden rounded-[3px] bg-background">
              <Face src={x.photoUrl} name={x.name} loading="lazy" className="size-full" />
            </span>
          ))}
        </div>
      );
    // No headshots yet: the teams the players come from, by their marks, and the positions a draft fills. On a team's season, its
    // scope's teams and their count (whose.ts), "getting them" while they're fetched, never the page's first two teams or "0 players".
    const pos = [...new Set((pack.cast ?? []).map((c) => c.role).filter((r): r is string => !!r))].slice(0, 5);
    const count = whose ? whose.count : (pack.cast ?? []).length + (pack.castMore ?? 0);
    return (
      <div className="flex flex-wrap items-center gap-1.5" aria-hidden>
        {(whose?.teams ?? (pack.teams ?? []).slice(0, 2)).map((t) => {
          const m = markOf(t);
          return <TeamMark key={t.id} abbr={m.abbr} color={m.color} size="sm" />;
        })}
        {pos.map((p) => (
          <span key={p} className="type-caption rounded-[2px] bg-background px-2 py-[3px] text-[14px] tracking-[0.04em]">{p}</span>
        ))}
        <span className="text-[14px] text-muted-foreground">{count === null || count === 0 ? "Getting the players…" : `${count} players`}</span>
      </div>
    );
  }
  if (base.id.includes("squares") && g && g.sides.length === 2) {
    // The grid's corner: one team's last digit across the top, the other's down the side, your square in bone.
    const [away, home] = order(g);
    const top = markOf(home);
    const side = markOf(away);
    return (
      <div className="flex w-full items-start gap-2" aria-hidden>
        <span className="flex flex-col items-center gap-1 pt-[26px]">
          <TeamMark abbr={side.abbr} color={side.color} size="sm" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
          <span className="flex items-center gap-1.5">
            <TeamMark abbr={top.abbr} color={top.color} size="sm" />
            <span className="type-caption text-[13px] text-muted-foreground">last digit</span>
          </span>
          <span className="grid grid-cols-[18px_repeat(5,1fr)] gap-[3px] text-center">
            <span />
            {[0, 1, 2, 3, 4].map((n) => (
              <span key={n} className="type-caption text-[13px] tabular-nums text-muted-foreground">{n}</span>
            ))}
            {[0, 1].map((r) => (
              <span key={r} className="contents">
                <span className="type-caption text-[13px] tabular-nums text-muted-foreground">{r}</span>
                {[0, 1, 2, 3, 4].map((n) => (
                  <span key={n} className={`h-[18px] rounded-[2px] ${r === 1 && n === 3 ? "bg-foreground" : "bg-background"}`} />
                ))}
              </span>
            ))}
          </span>
        </span>
      </div>
    );
  }
  if ((cat === "predict" || cat === "bets") && g)
    return (
      <div className="flex w-full flex-col gap-1.5 leading-snug">
        <span className="type-caption text-[14px] tracking-[0.03em] text-muted-foreground">{when(g.at) ?? "Next game"}{typeof g.line === "number" ? ` · over/under ${g.line}` : ""}</span>
        <Matchup x={g} marks={marks} big />
      </div>
    );
  if (games.length)
    return (
      <ol className="flex w-full flex-col">
        {games.slice(0, cat === "pools" ? 3 : 2).map((x) => (
          <li key={`${x.episode}-${x.id ?? ""}`} className="flex items-center gap-2 border-t border-border py-1.5 first:border-t-0">
            <span className="type-caption w-[68px] flex-none truncate text-[13px] text-muted-foreground">{when(x.at) ?? `Game ${x.episode}`}</span>
            <Matchup x={x} marks={marks} />
          </li>
        ))}
      </ol>
    );
  return null;
}

export function LeadTile({ cat, base, spec, state, plain, line, input, gm, data, onOpen, pack, marks, whose = null }: { cat: string; base: Base; spec: Spec | null; state: string; plain: string; line: string; input: Input; gm: GM; data: LeadData; onOpen: () => void; pack?: Pack | null; marks?: Map<string, Mark>; whose?: Whose | null }) {
  const pic = pack ? <SportPicture cat={cat} base={base} spec={spec} input={input} gm={gm} pack={pack} marks={marks ?? new Map()} whose={whose} /> : picture(cat, base, spec, input, gm, data);
  return (
    <button type="button" data-gallery-lead={base.id} onClick={onOpen} className={`nd-press col-span-2 flex min-h-[132px] w-full flex-col gap-2.5 rounded-[4px] bg-secondary p-3.5 text-left hover:brightness-110 ${FOCUS}`}>
      <span className="flex w-full items-start justify-between gap-3">
        <b className="type-caption text-[26px] leading-[0.95]">{say(base.name, input.nouns, true)}</b>
        <span className="pt-1">{state === "plays" ? <LengthMark len={base.len} /> : <span className="type-caption text-[12px] tracking-[0.06em] text-muted-foreground">{state === "coming" ? "Coming" : "Not here"}</span>}</span>
      </span>
      {pic && <span className="flex w-full">{pic}</span>}
      <span className="text-[15px] leading-snug">{plain}{line ? <span className="text-muted-foreground"> · {line}</span> : null}</span>
    </button>
  );
}
