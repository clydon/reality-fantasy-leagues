"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Flag, Grid3x3, Undo2, X } from "lucide-react";
import { cap } from "@/lib/desk-bot-words";
import { AskAiPasteSheet, type AnswerCheck } from "../backstage/ask-ai";
import { paths } from "../routes";
import { Avatar } from "../ui/bars";
import { Btn, EmptyState } from "../ui/parts";
import { Sheet } from "../ui/sheet";
import { toast } from "../ui/toast";
import { deskGet, deskSend, useAfterDesk, useDesk, type BankSquare, type DeskBingo, type DeskBingoBank, type DeskResearch, type MoveLine } from "./data";
import { MovesSheet } from "./episode";
import { DeskHeader, Facts, LatestHistory, LowerThird, Section, agoOf, useChangeToast } from "./parts";
import { NowSheet } from "./research";
import { SeasonDeleteRow } from "./setup";

// A season's Bingo bank (docs/PLAN-desk-parity.md step 4, part 4c; the mock's desk-research.js rsBingoPage), from the season
// page's Running it, an episode's page (on its squares) and a bingo run's sheet: a strip of its episodes and the season's
// bank, each with how many squares deal from it; the bank chosen: who wrote it and when, how many passed its check, Write
// them again (Research's Run now) and Paste squares (Ask an AI, what it keeps said first, not checked by a second ask), its
// squares by Likely, Maybe, Long shot and Out of new cards, each square's sheet (its flags and who sent them; Hide it from
// new cards, or Show it again, which outranks two flags); History; the season's Delete. Server: src/lib/server/desk-bingo.ts.

type Bank = number | "season";
type Tier = BankSquare["tier"];
const TIERS: [Tier, string][] = [
  ["likely", "Likely"],
  ["maybe", "Maybe"],
  ["longshot", "Long shot"],
];
const NOTE = "mt-3 text-[13px] leading-snug text-muted-foreground";
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const bankOf = (raw: string | null): Bank | null => (raw === "season" ? "season" : raw && /^[1-9][0-9]{0,3}$/.test(raw) ? Number(raw) : null);
/** "Episode 6", "the season". */
const forName = (b: Bank) => (b === "season" ? "the season" : `Episode ${b}`);

/** A pasted answer looks whole: JSON with a list of squares. */
const checkSquares: AnswerCheck = (text) => {
  const a = text.indexOf("{");
  const b = text.lastIndexOf("}");
  let n = 0;
  try {
    const json = a >= 0 && b > a ? JSON.parse(text.slice(a, b + 1)) : null;
    n = Array.isArray(json?.squares) ? json.squares.length : 0;
  } catch {
    n = 0;
  }
  return n ? { ok: true, line: `Looks right: ${plural(n, "square")}` } : { ok: false, line: "That doesn't look like the whole answer. Copy all of it, from { to }." };
};

type SheetState = { k: "square"; id: string } | { k: "now" } | { k: "paste" } | { k: "pasted"; answer: string; lines: MoveLine[] } | null;

export function BingoPage({ id }: { id: string }) {
  const params = useSearchParams();
  const [pick, setPick] = useState<Bank | null>(bankOf(params.get("bank")));
  const path = `/seasons/${id}/bingo${pick != null ? `?bank=${pick}` : ""}`;
  const q = useQuery({
    queryKey: ["new-design", "desk", path],
    queryFn: () => deskGet<DeskBingo>(path),
    staleTime: 15_000,
    // Another bank's chip: the one on screen stays until it's read.
    placeholderData: (prev) => prev,
    // While our bot writes squares for it, the bank as it lands.
    refetchInterval: (x) => (x.state.data?.writing ? 4000 : false),
    retry: (n, e) => (e as { status?: number }).status !== 403 && (e as { status?: number }).status !== 404 && n < 2,
  });
  const [sheet, setSheet] = useState<SheetState>(null);
  const research = useDesk<DeskResearch>(sheet?.k === "now" ? `/seasons/${id}/research` : null);
  const after = useAfterDesk();
  const changed = useChangeToast();
  const back = { label: "Season", href: paths.deskItem("season", id) };
  if (q.error)
    return (
      <>
        <DeskHeader title="Bingo bank" back={back} name={null} />
        <EmptyState title="Not here" line={(q.error as Error).message} />
      </>
    );
  if (!q.data)
    return (
      <>
        <DeskHeader title="Bingo bank" back={back} name={null} />
        <div aria-busy className="mx-4 mt-6 h-64 animate-pulse rounded-[4px] bg-card" />
      </>
    );
  const d = q.data;
  const sel = d.sel;
  const close = () => setSheet(null);
  const choose = (b: Bank) => {
    setPick(b);
    // The URL keeps the bank (the trail's entry for this page and a reload come back to it).
    const href = paths.deskBingo(id, b);
    if (href !== `${window.location.pathname}${window.location.search}`) window.history.replaceState(null, "", href);
  };
  const done = async (out: { changeId?: string | null; text: string }) => {
    await after();
    changed(out.text, out.changeId ?? null);
  };
  const square = sheet?.k === "square" ? (d.bank?.squares.find((s) => s.id === sheet.id) ?? null) : null;
  return (
    <div className="pb-16" data-desk-bingo={String(sel)}>
      <DeskHeader title="Bingo bank" back={{ label: d.name, href: paths.deskItem("season", id) }} name="Bingo bank" />
      <LowerThird tag={d.tag} tone={d.tag === "Ready" ? "quiet" : "stopped"} title={d.name} detail={d.detail} />
      <Facts>{d.meta}</Facts>

      <Section>
        <Strip strip={d.strip} sel={sel} onPick={choose} />
        <div data-bank-panel={String(sel)} aria-busy={q.isPlaceholderData || undefined}>
          <SubHead title={d.panel.title} aside={d.panel.aside} />
          {d.bank ? (
            <BankPanel bank={d.bank} aired={d.panel.aired} onSquare={(s) => setSheet({ k: "square", id: s.id })} onWrite={() => setSheet({ k: "now" })} onPaste={() => setSheet({ k: "paste" })} />
          ) : d.panel.aired ? (
            <p data-bank-none className="mt-1 rounded-[4px] bg-card p-3.5 text-[14px] leading-snug text-muted-foreground">
              {d.panel.empty?.line}
            </p>
          ) : (
            <>
              <div data-bank-empty className="mt-1 rounded-[4px] bg-card p-3.5">
                <b className="type-caption block text-[18px]">{d.panel.empty?.title}</b>
                <small className="mt-1 block text-[14px] leading-snug text-muted-foreground">{d.panel.empty?.line}</small>
              </div>
              <WriteOrPaste write="Write them now" onWrite={() => setSheet({ k: "now" })} onPaste={() => setSheet({ k: "paste" })} />
            </>
          )}
        </div>
      </Section>

      <LatestHistory lines={d.history} emptyLine="Nothing yet." />
      <SeasonDeleteRow id={id} del={d.delete} showId={d.show.id} />

      <SquareSheet sq={square} bank={d.bank} title={d.panel.title} onClose={close} done={done} id={id} />
      {research.data && sheet?.k === "now" && <NowSheet open onClose={close} r={research.data} kind="bingo" episode={sel} />}
      <AskAiPasteSheet
        open={sheet?.k === "paste"}
        onOpenChange={(o) => !o && close()}
        title={`Squares for ${forName(sel)}`}
        subtitle="Ask an AI · about 2 minutes"
        what={`Your AI writes thirty bingo squares fitted to ${forName(sel)}: things you'd see, a few long shots, ${sel === "season" ? "naming nobody" : "at most three naming someone"}. Paste them back; at least 8 have to fit.`}
        check={checkSquares}
        tag="desk-bingo"
        question={{ key: ["new-design", "desk-question", id, "bingo", String(sel)], load: () => deskGet<{ prompt: string | null; task: string }>(`/seasons/${id}/bingo/question?bank=${sel}`) }}
        onUse={async (text) => {
          // Read first: what it keeps and leaves out is said before it's filed.
          const p = await deskSend<{ lines: MoveLine[] }>(`/seasons/${id}/bingo`, { bank: sel, paste: text, preview: true });
          setSheet({ k: "pasted", answer: text, lines: p.lines });
        }}
      />
      <MovesSheet
        open={sheet?.k === "pasted"}
        onClose={close}
        title="Save these squares?"
        subtitle={`${cap(forName(sel))} · your paste`}
        lines={sheet?.k === "pasted" ? sheet.lines : null}
        cta="Save squares"
        undoNote="A paste isn't checked by a second ask. Undo puts the old squares back."
        onConfirm={async () => {
          if (sheet?.k !== "pasted") return;
          const out = await deskSend<{ changeId: string; text: string }>(`/seasons/${id}/bingo`, { bank: sel, paste: sheet.answer });
          close();
          await done(out);
        }}
      />
    </div>
  );
}

/** A list's small heading (the mock's .dk-sub). */
function SubHead({ title, aside }: { title: string; aside?: string }) {
  return (
    <div className="mb-2 mt-5 flex items-baseline justify-between gap-3">
      <h2 className="type-caption text-[18px] tracking-[0.04em] text-muted-foreground">{title}</h2>
      {aside != null && <span className="text-right text-[13px] text-muted-foreground">{aside}</span>}
    </div>
  );
}

/** Whose squares: the episodes, the latest to come first, then the season's bank (the mock's rsStrip). */
function Strip({ strip, sel, onPick }: { strip: DeskBingo["strip"]; sel: Bank; onPick: (b: Bank) => void }) {
  const on = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    on.current?.scrollIntoView({ inline: "nearest", block: "nearest" });
  }, [sel]);
  return (
    <div role="tablist" aria-label="Whose squares" data-strip className="-mx-4 flex snap-x scroll-px-4 gap-1.5 overflow-x-auto px-4 pb-1.5 pt-0.5 [scrollbar-width:none]">
      {strip.map((x) => {
        const chosen = String(x.bank) === String(sel);
        const has = x.squares != null;
        return (
          <button
            key={String(x.bank)}
            ref={chosen ? on : undefined}
            type="button"
            role="tab"
            aria-selected={chosen}
            data-bank-chip={String(x.bank)}
            onClick={() => onPick(x.bank)}
            className={`nd-press inline-flex h-11 flex-none snap-start items-center gap-2 whitespace-nowrap rounded-[2px] px-3.5 text-[15px] font-semibold ${
              chosen ? "bg-foreground text-background" : has ? "bg-secondary" : "text-muted-foreground outline-1 -outline-offset-1 outline-input"
            }`}
          >
            {x.bank === "season" ? "The season's" : `Ep ${x.bank}`}
            {has && <span className={`type-num text-[16px] ${chosen ? "" : "text-muted-foreground"}`}>{x.squares}</span>}
          </button>
        );
      })}
    </div>
  );
}

function WriteOrPaste({ write, onWrite, onPaste }: { write: string; onWrite: () => void; onPaste: () => void }) {
  return (
    <div className="mb-1 mt-3.5 grid grid-cols-2 gap-2">
      <Btn data-bank-write className="h-12" onClick={onWrite}>
        {write}
      </Btn>
      <Btn data-bank-paste className="h-12" onClick={onPaste}>
        Paste squares
      </Btn>
    </div>
  );
}

/** A tile's tag: why it's out, or how many have flagged it. */
function tagOf(s: BankSquare): { text: string; strong: boolean } | null {
  if (s.state === "dropped") return { text: "Dropped", strong: false };
  if (s.state === "flagged") return { text: "Two flags", strong: false };
  if (s.state === "hidden") return { text: `Hidden by ${s.hiddenBy}`, strong: false };
  const since = s.flags.filter((f) => !f.overruled).length;
  return since ? { text: plural(since, "flag"), strong: true } : null;
}

function BankPanel({ bank, aired, onSquare, onWrite, onPaste }: { bank: DeskBingoBank; aired: boolean; onSquare: (s: BankSquare) => void; onWrite: () => void; onPaste: () => void }) {
  const live = bank.squares.filter((s) => s.state === "live");
  const out = bank.squares.filter((s) => s.state !== "live");
  const tile = (s: BankSquare) => {
    const t = tagOf(s);
    return (
      <button
        key={s.id}
        type="button"
        data-square={s.id}
        data-square-state={s.state}
        onClick={() => onSquare(s)}
        className={`nd-press flex min-h-[66px] flex-col items-start justify-between gap-2 rounded-[3px] px-3 py-[11px] text-left outline-1 -outline-offset-1 ${s.state === "live" ? "bg-card outline-input" : "outline-border"}`}
      >
        <span className={`text-[14px] font-semibold leading-[1.35] ${s.state === "live" ? "" : "text-muted-foreground"}`}>{s.label}</span>
        {t && (
          <i className={`type-caption rounded-[2px] px-1.5 pb-0.5 pt-[3px] text-[11px] not-italic leading-none tracking-[0.06em] outline-1 -outline-offset-1 ${t.strong ? "outline-foreground" : "text-muted-foreground outline-input"}`}>
            {t.text}
          </i>
        )}
      </button>
    );
  };
  return (
    <div data-bank>
      <p data-bank-line className="-mt-0.5 text-[13px] leading-[1.55] text-muted-foreground">
        {bank.by} · {bank.at}
        <br />
        {bank.check}
      </p>
      {!aired && <WriteOrPaste write="Write them again" onWrite={onWrite} onPaste={onPaste} />}
      {TIERS.map(([k, t]) => {
        const S = live.filter((s) => s.tier === k);
        return S.length ? (
          <div key={k} data-tier={k}>
            <SubHead title={t} aside={String(S.length)} />
            <div className="grid grid-cols-2 gap-1.5">{S.map(tile)}</div>
          </div>
        ) : null;
      })}
      {out.length > 0 && (
        <div data-tier="out">
          <SubHead title="Out of new cards" aside={String(out.length)} />
          <div className="grid grid-cols-2 gap-1.5">{out.map(tile)}</div>
        </div>
      )}
    </div>
  );
}

/** A square (the mock's rsSqSheet): it as a plate, where it's dealt, why it's out, its flags and who sent them, then Hide or Show. */
function SquareSheet({ sq, bank, title, onClose, done, id }: { sq: BankSquare | null; bank: DeskBingoBank | null; title: string; onClose: () => void; done: (out: { changeId: string; text: string }) => Promise<void>; id: string }) {
  const [busy, setBusy] = useState(false);
  if (!sq || !bank) return null;
  const tier = TIERS.find(([k]) => k === sq.tier)![1];
  const out = sq.state === "hidden" || sq.state === "flagged";
  const since = sq.flags.filter((f) => !f.overruled).length;
  const points: [typeof Grid3x3, string][] = [];
  if (sq.state === "dropped") points.push([X, bank.bot ? `Its check dropped it: ${sq.note ?? "it didn't pass"}.` : `Left out of the paste: ${sq.note ?? "it didn't fit"}.`]);
  else points.push([Grid3x3, bank.dealt ? `Dealt on ${sq.cards} of the ${bank.dealt} cards so far.` : bank.bank === "season" ? "Dealt on cards for any episode without its own." : "On nobody's card yet."]);
  if (sq.state === "flagged") points.push([Flag, "Out of new cards: two people flagged it."]);
  if (sq.state === "hidden") points.push([Flag, sq.hiddenBy === "you" ? "Out of new cards: you hid it." : `Out of new cards: ${sq.hiddenBy} hid it.`]);
  if (sq.state === "live" && sq.shownBy) points.push([Undo2, `On new cards: ${sq.shownBy === "you" ? "you" : sq.shownBy} showed it again over its flags.`]);
  const toggle = async () => {
    setBusy(true);
    try {
      const r = await deskSend<{ changeId: string; text: string }>(`/seasons/${id}/bingo`, { square: sq.id, hide: !out });
      onClose();
      await done(r);
    } catch (e) {
      toast.quiet((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet open onOpenChange={(o) => !o && onClose()} title="A square" subtitle={`${title} · ${tier}`}>
      <div data-square-sheet={sq.id}>
        <div className="type-caption mb-1 mt-0.5 rounded-[3px] bg-plate px-[18px] py-6 text-center text-[27px] leading-[1.05] text-plate-foreground shadow-plate [text-wrap:balance]">{sq.label}</div>
        <ul data-points className="mt-3 flex flex-col gap-3">
          {points.map(([Icon, t], k) => (
            <li key={k} className="flex gap-3 text-[15px] leading-snug">
              <Icon className="mt-0.5 size-5 flex-none" aria-hidden />
              <span>{t}</span>
            </li>
          ))}
        </ul>
        {sq.flags.length > 0 && (
          <>
            <SubHead title="Flagged as unfair" aside={String(sq.flags.length)} />
            <div data-flags className="border-b border-border">
              {sq.flags.map((f) => (
                <div key={f.id} data-flag={f.name} className="flex min-h-[54px] items-center gap-2.5 border-t border-border">
                  <Avatar id={f.id} name={f.name} size={32} />
                  <span className="min-w-0 flex-1">
                    <b className="block text-[14.5px] font-semibold">{f.name}</b>
                    <small className="block text-[13px] text-muted-foreground">
                      Flagged {agoOf(f.at)}
                      {f.overruled ? " · overruled" : ""}
                    </small>
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
        {sq.state === "dropped" ? (
          <p className={NOTE}>Writing them again, or a paste, replaces the bank and this with it.</p>
        ) : (
          <>
            <Btn data-square-toggle wide className="mt-4" disabled={busy} onClick={() => void toggle()}>
              {out ? "Show it again" : "Hide it from new cards"}
            </Btn>
            <p className={NOTE}>
              {out ? `Back on new cards${since >= 2 ? `: you overrule its ${since === 2 ? "two" : since} flags` : ""}.` : "Out of new cards, as two flags would put it. Show it again any time."}
            </p>
          </>
        )}
      </div>
    </Sheet>
  );
}
