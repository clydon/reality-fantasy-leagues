"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Check, Copy, User } from "lucide-react";
import { fillLine, type FillStep, type StepState, type TileState } from "@/lib/season-fill";
import { AskAiPasteSheet, type AnswerCheck } from "../backstage/ask-ai";
import { fill, useFill, type FillState } from "../data";
import { useShowColour } from "../tune-in";
import { Btn } from "../ui/parts";
import { Sheet } from "../ui/sheet";
import { toast } from "../ui/toast";
import { Face } from "./parts";

// Getting it ready (docs/PLAN-getting-it-ready.md; season-fill.ts): a season someone adds gets its rules, its cast and its
// episodes by itself, and this is how it looks while it does (the user's pick A, the Call sheet): a lower-third slate a step,
// slammed in as its turn comes, a red tally light on the one working and a check stamped on each as it lands; the cast's slate
// a strip of headshot frames, swept until the faces pop in; the episodes' a filmstrip of numbered tiles, each lit as it comes in
// (half lit with what happened, full with its results too). It plays in Add a show once a show's added, in a sheet from the
// show's header chip, and its pieces are the loading looks elsewhere: the Contestants tab's frames (CastComing), the Episodes
// tab's card (EpisodesComing), Home's poster as a no-signal card (NoSignal, B's poster). Asking ChatGPT yourself is on every
// step, the free way for everyone (the user, 2026-11-01): Ask an AI's sheet with the step's question (its short /b/ link opens
// ChatGPT with it asked, then paste the answer back; Copy for any other AI), and it's the main button while our bot is away. Reads poll while it's going (useFill); a run that stopped partway is carried on by the page
// that's open (useFillSync), and what lands reads the show again.

const TITLE: Record<FillStep, (w: FillState["words"]) => string> = {
  rules: () => "How it's played",
  cast: (w) => `The ${w.people.toLowerCase()}`,
  episodes: (w) => `${w.episodes}`,
};

/** A pasted answer looks whole: its JSON, start to end. */
const looksWhole: AnswerCheck = (text) => {
  const t = text.trim();
  const ok = t.length > 40 && t.indexOf("{") >= 0 && t.lastIndexOf("}") > t.indexOf("{");
  return { ok, line: ok ? "Looks like the whole answer" : "That doesn't look like the whole answer yet: copy all of it, JSON and all" };
};

/** What lands reads the show again (the cast, its episodes and stats, Home's poster), and a run that stopped partway is carried on
 *  by the page that's open, once each time it comes due. */
export function useFillSync(seasonId: string, f: FillState | undefined) {
  const qc = useQueryClient();
  const was = useRef<{ cast: number; lit: string; steps: string; status: string } | null>(null);
  const went = useRef<string | null>(null);
  useEffect(() => {
    if (!f) return;
    const now = { cast: f.cast.count, lit: f.episodes.map((e) => e.state[0]).join(""), steps: f.steps.map((s) => s.state[0]).join(""), status: f.status };
    const before = was.current;
    was.current = now;
    if (!before) return;
    const again = (...key: unknown[]) => qc.invalidateQueries({ queryKey: ["new-design", ...key] });
    if (now.cast !== before.cast) {
      again("stats", seasonId);
      again("space", seasonId);
    }
    if (now.lit !== before.lit) {
      again("episodes", seasonId);
      again("recaps", seasonId);
      again("stats", seasonId);
    }
    if (now.steps !== before.steps || now.status !== before.status) {
      again("space", seasonId);
      again("home");
      again("make", seasonId);
    }
    if (before.status === "going" && now.status === "done") toast(`${f.label} is ready`);
  }, [f, qc, seasonId]);
  useEffect(() => {
    if (!f?.due || went.current === f.v) return;
    went.current = f.v;
    fill
      .go(seasonId)
      .then((s) => qc.setQueryData(["new-design", "fill", seasonId], s))
      .catch(() => undefined);
  }, [f?.due, f?.v, qc, seasonId]);
}

/** The step's mark on its slate: a red tally light while it works, a check stamped when it lands. */
function SlateMark({ state, count }: { state: StepState; count?: string | null }) {
  if (state === "working")
    return (
      <span className="flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-[0.06em] text-plate-muted">
        {count}
        <i className="nd-tally size-2.5 rounded-full bg-live" aria-label="Working on it" />
      </span>
    );
  if (state === "done")
    return (
      <span className="flex items-center gap-2 text-[13px] font-bold tabular-nums text-plate-muted">
        {count}
        <span className="nd-stamp grid size-6 place-items-center rounded-[3px] bg-plate-foreground text-plate" aria-label="Done">
          <Check className="size-4" strokeWidth={3} aria-hidden />
        </span>
      </span>
    );
  if (state === "stuck") return <span className="text-[12px] font-bold uppercase tracking-[0.06em] text-live">Stopped</span>;
  return <span className="text-[12px] font-bold uppercase tracking-[0.06em] text-plate-muted">Next</span>;
}

/** A step's slate: the show's colour as the angled tag, its name on the white plate, its mark, and what it's found below. */
function Slate({ step, state, index, title, count, children }: { step: FillStep; state: StepState; index: number; title: string; count?: string | null; children?: ReactNode }) {
  return (
    <section
      data-slate={step}
      data-state={state}
      className={state === "next" ? "opacity-45" : "nd-slate-in"}
      // Re-keyed as its turn comes, so it slams in then.
      style={{ animationDelay: `${index * 90}ms` }}
    >
      <div className="flex items-stretch">
        <span aria-hidden className="w-3 flex-none bg-[var(--show)] [clip-path:polygon(0_0,100%_0,calc(100%_-_4px)_100%,0_100%)]" />
        <div className="-ml-0.5 flex min-h-11 flex-1 items-center justify-between gap-2 bg-plate py-1.5 pl-3 pr-4 text-plate-foreground [clip-path:polygon(0_0,100%_0,calc(100%_-_9px)_100%,0_100%)]">
          <b className="type-caption text-[19px] leading-none">{title}</b>
          <SlateMark state={state} count={count} />
        </div>
      </div>
      {children && <div className="mt-2 pl-3">{children}</div>}
    </section>
  );
}

/** The cast's strip: their faces as they land (a few, then "+26"), else empty frames swept while they're being found. */
function Frames({ faces, count, working, max = 7 }: { faces: FillState["cast"]["faces"]; count: number; working: boolean; max?: number }) {
  if (!faces.length) {
    return (
      <div data-frames="empty" className="flex gap-1.5" aria-hidden>
        {Array.from({ length: max }, (_, i) => (
          <span
            key={i}
            className={`grid h-11 w-9 place-items-center rounded-[3px] bg-card outline-1 -outline-offset-1 outline-border ${working ? "nd-sweep" : ""}`}
            style={{ "--d": `${i * 90}ms` } as CSSProperties}
          >
            <User className="size-4 text-muted-foreground/50" aria-hidden />
          </span>
        ))}
      </div>
    );
  }
  const shown = faces.slice(0, max);
  return (
    <div data-frames="in" className="flex items-center gap-1.5">
      {shown.map((p, i) => (
        <Face key={p.name} src={p.photo} name={p.name} title={p.name} className="nd-face-in h-11 w-9 rounded-[3px] text-[15px]" style={{ "--d": `${i * 70}ms` } as CSSProperties} />
      ))}
      {count > shown.length && <span className="nd-face-in ml-1 text-[13px] font-bold text-muted-foreground" style={{ "--d": `${shown.length * 70}ms` } as CSSProperties}>+{count - shown.length}</span>}
    </div>
  );
}

const TILE: Record<TileState, string> = {
  waiting: "bg-card text-muted-foreground outline-1 -outline-offset-1 outline-border",
  asking: "nd-tally bg-[color-mix(in_srgb,var(--show)_40%,transparent)] text-foreground",
  // What happened is in, its results still to come: lit from the bottom, half way.
  half: "nd-tile-on bg-[linear-gradient(0deg,var(--show)_0_45%,var(--card)_45%)] text-foreground outline-1 -outline-offset-1 outline-[var(--show)]",
  done: "nd-tile-on bg-[var(--show)] text-white",
  none: "text-muted-foreground outline-1 -outline-offset-1 outline-dashed outline-border",
};

/** The episodes' filmstrip: a numbered tile each, lit as it comes in (swept as a whole while the step works). */
export function Filmstrip({ tiles, working }: { tiles: FillState["episodes"]; working: boolean }) {
  return (
    <div data-filmstrip className={`flex flex-wrap gap-1 rounded-[3px] ${working ? "nd-sweep" : ""}`}>
      {tiles.map((t) => (
        // Keyed by its state too, so a tile that lights pops as it does.
        <span key={`${t.number}-${t.state}`} data-tile={t.number} data-state={t.state} className={`grid size-[26px] place-items-center rounded-[2px] text-[12px] font-bold tabular-nums ${TILE[t.state]}`}>
          {t.state === "none" ? "–" : t.number}
        </span>
      ))}
    </div>
  );
}

/** Episodes with everything in (a "half" one still has its results to come). */
const litOf = (f: FillState) => f.episodes.filter((e) => e.state === "done" || e.state === "none").length;

/** The call sheet: what's happening now on a line (the tally lit while it goes), then a slate a step. Copy and paste beneath. */
export function CallSheet({ f, onPaste }: { f: FillState; onPaste?: () => void }) {
  const colour = useShowColour(f.seasonId, f.backdropUrl || f.artUrl);
  const tiles = f.episodes.map((e) => e.state);
  const line = fillLine({ step: f.step, status: f.status, tiles, away: f.away }, f.words);
  const going = f.status === "going";
  // What's being got now can be pasted instead (free, always): while our bot's away it's the way on, so it leads.
  const pasteable = going && !!f.step && f.steps.some((s) => s.key === f.step && s.state === "working") && !(f.step === "episodes" && !f.episodes.some((e) => e.state === "waiting" || e.state === "asking"));
  return (
    <div data-call-sheet={f.status} data-step={f.step ?? ""} style={{ "--show": colour } as CSSProperties} className="flex flex-col gap-3.5">
      <p className="flex items-center gap-2 text-[14px] font-semibold" aria-live="polite">
        {going && <i className="nd-tally size-2 flex-none rounded-full bg-live" aria-hidden />}
        <span data-call-line>{line}</span>
      </p>
      {f.steps.map((s, i) => (
        <Slate
          key={`${s.key}-${s.state === "next" ? "next" : "on"}`}
          step={s.key}
          state={s.state}
          index={i}
          title={TITLE[s.key](f.words)}
          count={s.key === "cast" && f.cast.count ? String(f.cast.count) : s.key === "episodes" && f.episodes.length ? `${litOf(f)}/${f.episodes.length}` : null}
        >
          {s.key === "cast" && s.state !== "next" ? (
            <Frames faces={f.cast.faces} count={f.cast.count} working={s.state === "working"} />
          ) : s.key === "episodes" && s.state !== "next" ? (
            <Filmstrip tiles={f.episodes} working={s.state === "working"} />
          ) : null}
        </Slate>
      ))}
      {f.status === "stuck" && f.message && <p className="text-[13px] font-semibold leading-snug text-live">{f.message}</p>}
      {pasteable && onPaste && (
        <Btn tone={f.away ? "must" : "optional"} wide data-fill-paste onClick={onPaste}>
          <Copy className="size-4" aria-hidden />
          {f.away ? "Ask ChatGPT yourself, free" : "Or ask ChatGPT yourself, free"}
        </Btn>
      )}
      {pasteable && f.away && <small className="-mt-1.5 text-[13px] leading-snug text-muted-foreground">Free, any time: it opens ChatGPT with the question asked, and you paste its answer back here. Our bot carries on when it&rsquo;s back.</small>}
    </div>
  );
}

/** Ask ChatGPT yourself for the step it's on (Ask an AI's sheet: open the question in ChatGPT, paste its answer back; free). */
export function FillPasteSheet({ f, open, onOpenChange }: { f: FillState; open: boolean; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();
  const step = f.step ?? "rules";
  const what =
    step === "rules"
      ? `Ask an AI how ${f.label} works: what happens in an episode, how people leave and what could score. Then paste its whole answer back here.`
      : step === "cast"
        ? `Ask an AI who's in ${f.label}: their names, photos and the groups they start in. Then paste its whole answer back here.`
        : `Ask an AI what happened in each ${f.words.episode.toLowerCase()} of ${f.label} that's out. Then paste its whole answer back here.`;
  return (
    <AskAiPasteSheet
      open={open}
      onOpenChange={onOpenChange}
      title={TITLE[step](f.words)}
      tag={`fill-${step}`}
      what={what}
      spoiler={
        step === "episodes"
          ? `Its answer says what happens in every ${f.words.episode.toLowerCase()} that's out. Not caught up? Let our bot do it, or ask someone on the couch who is.`
          : undefined
      }
      question={{ key: ["new-design", "fill-prompt", f.seasonId, step, f.v], load: () => fill.prompt(f.seasonId) }}
      check={looksWhole}
      onUse={async (answer) => {
        qc.setQueryData(["new-design", "fill", f.seasonId], await fill.paste(f.seasonId, answer));
        toast(step === "episodes" ? "Filled in what happened" : "Got it");
        onOpenChange(false);
      }}
    />
  );
}

// ---- the sheet from the show's header ----

let openSeason: string | null = null;
const subs = new Set<() => void>();
/** Open how it's going for a season (the show header's chip, the Contestants tab). */
export function openGettingReady(seasonId: string | null) {
  openSeason = seasonId;
  subs.forEach((l) => l());
}
const useOpenSeason = () =>
  useSyncExternalStore(
    (l) => {
      subs.add(l);
      return () => subs.delete(l);
    },
    () => openSeason,
    () => null
  );

/** Copy and paste, opened from a call sheet: its own state, so the sheet that opened it can close first. */
export function useFillPaste(f: FillState | undefined) {
  const [open, setOpen] = useState(false);
  return { open: () => setOpen(true), sheet: f ? <FillPasteSheet f={f} open={open} onOpenChange={setOpen} /> : null };
}

/** How it's going, in a sheet over the show (its header chip opens it). */
export function GettingReadySheet({ seasonId }: { seasonId: string }) {
  const open = useOpenSeason() === seasonId;
  const f = useFill(seasonId).data;
  const paste = useFillPaste(f);
  return (
    <>
      <Sheet open={open && !!f} onOpenChange={(o) => !o && openGettingReady(null)} title="Getting it ready" subtitle={f?.label}>
        {f && (
          <div data-getting-ready-sheet>
            <CallSheet f={f} onPaste={paste.open} />
            {f.status === "stuck" && !f.needsLook && <RetryButton seasonId={seasonId} />}
          </div>
        )}
      </Sheet>
      {paste.sheet}
    </>
  );
}

export function RetryButton({ seasonId }: { seasonId: string }) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  return (
    <Btn
      tone="must"
      wide
      data-fill-retry
      className="mt-4"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          qc.setQueryData(["new-design", "fill", seasonId], await fill.retry(seasonId));
        } catch (e) {
          toast.quiet((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? "Starting…" : "Try again"}
    </Btn>
  );
}

/** The show header's chip while it's getting ready: the tally light and the step ("Getting ready · The cast"). */
export function ReadyChip({ f }: { f: FillState }) {
  const short = f.status === "stuck" ? "Stopped partway" : f.step === "episodes" && f.episodes.length ? `${f.words.episodes} ${litOf(f)}/${f.episodes.length}` : f.step ? TITLE[f.step](f.words) : "Almost there";
  return (
    <button type="button" data-ready-chip={f.status} onClick={() => openGettingReady(f.seasonId)} className="-my-1.5 -mx-[9px] flex items-center gap-1.5 px-[9px] py-1.5">
      <i className={`size-2 rounded-full bg-live ${f.status === "going" ? "nd-tally" : ""}`} aria-hidden />
      Getting ready · {short}
    </button>
  );
}

/** The header's progress line in the show's colour: how many steps are in, a sheen running along it while it goes. */
export function ReadyLine({ f }: { f: FillState }) {
  const colour = useShowColour(f.seasonId, f.backdropUrl || f.artUrl);
  const done = f.steps.filter((s) => s.state === "done").length + (f.episodes.length ? litOf(f) / f.episodes.length : 0) * (f.steps.some((s) => s.key === "episodes" && s.state !== "done") ? 1 : 0);
  const share = f.steps.length ? Math.min(1, Math.max(0.06, done / f.steps.length)) : 0;
  return (
    <span aria-hidden data-ready-line className="absolute inset-x-0 bottom-0 h-[3px] overflow-hidden bg-[rgba(255,255,255,.12)]">
      <span className="absolute inset-y-0 left-0 w-full origin-left transition-transform duration-700 ease-out" style={{ background: colour, transform: `scaleX(${share})` }} />
      {f.status === "going" && <span className="nd-bar-run absolute inset-y-0 left-0 w-1/3 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,.7),transparent)]" />}
    </span>
  );
}

/** The Contestants tab while the cast is coming: a wall of empty frames swept in turn, the line, and how it's going. */
export function CastComing({ f }: { f: FillState }) {
  const colour = useShowColour(f.seasonId, f.backdropUrl || f.artUrl);
  const paste = useFillPaste(f);
  const people = f.words.people.toLowerCase();
  if (f.status === "stuck") {
    return (
      <section data-cast-coming="stuck" className="px-6 py-10 text-center">
        <b className="type-caption text-[22px]">Couldn&rsquo;t find the {people}</b>
        <p className="mx-auto mt-2 max-w-[300px] text-sm leading-snug text-muted-foreground">{f.message ?? "It stopped partway."}</p>
        <div className="mx-auto max-w-[300px]">
          {!f.needsLook && <RetryButton seasonId={f.seasonId} />}
          <button type="button" data-cast-coming-open onClick={() => openGettingReady(f.seasonId)} className="mt-3 py-1.5 text-[13px] font-semibold text-muted-foreground underline underline-offset-2">
            See every step
          </button>
        </div>
      </section>
    );
  }
  const line = fillLine({ step: f.step, status: f.status, tiles: f.episodes.map((e) => e.state), away: f.away }, f.words);
  return (
    <section data-cast-coming={f.status} className="px-4 pt-6" style={{ "--show": colour } as CSSProperties}>
      <div className="flex items-stretch">
        <span aria-hidden className="w-3 flex-none bg-[var(--show)] [clip-path:polygon(0_0,100%_0,calc(100%_-_4px)_100%,0_100%)]" />
        <div className="-ml-0.5 flex min-h-11 flex-1 items-center justify-between gap-2 bg-plate py-1.5 pl-3 pr-4 text-plate-foreground [clip-path:polygon(0_0,100%_0,calc(100%_-_9px)_100%,0_100%)]">
          <b className="type-caption text-[19px] leading-none">Finding the {people}</b>
          <i className="nd-tally size-2.5 rounded-full bg-live" aria-hidden />
        </div>
      </div>
      <p className="mt-2 text-[13.5px] leading-snug text-muted-foreground" aria-live="polite">
        {line}. They show up here the moment they&rsquo;re in; you can leave this page.
      </p>
      <div className="mt-4 grid grid-cols-4 gap-2" aria-hidden>
        {Array.from({ length: 12 }, (_, i) => (
          <span key={i} className="nd-sweep grid aspect-[3/4] place-items-center rounded-[4px] bg-card outline-1 -outline-offset-1 outline-border" style={{ "--d": `${(i % 4) * 120 + Math.floor(i / 4) * 200}ms` } as CSSProperties}>
            <User className="size-7 text-muted-foreground/40" aria-hidden />
          </span>
        ))}
      </div>
      <div className="mt-4 flex flex-col items-start gap-1">
        <button type="button" data-cast-coming-open onClick={() => openGettingReady(f.seasonId)} className="py-1.5 text-[13px] font-semibold underline underline-offset-2">
          How it&rsquo;s going
        </button>
        {(f.step === "cast" || f.step === "rules") &&
          (f.away ? (
            <Btn tone="must" wide data-cast-coming-paste className="mt-1" onClick={paste.open}>
              <Copy className="size-4" aria-hidden />
              Ask ChatGPT yourself, free
            </Btn>
          ) : (
            <button type="button" data-cast-coming-paste onClick={paste.open} className="py-1.5 text-[13px] font-semibold text-muted-foreground underline underline-offset-2">
              Or ask ChatGPT yourself, free
            </button>
          ))}
      </div>
      {paste.sheet}
    </section>
  );
}

/** The Episodes tab while they're being looked up: the filmstrip and the line, in place of Fill in what happened's card. */
export function EpisodesComing({ f }: { f: FillState }) {
  const colour = useShowColour(f.seasonId, f.backdropUrl || f.artUrl);
  const paste = useFillPaste(f);
  const lit = litOf(f);
  const halves = f.episodes.filter((e) => e.state === "half").length;
  const working = f.episodes.some((e) => e.state === "waiting" || e.state === "asking");
  const ep = f.words.episode.toLowerCase();
  return (
    <section className="mt-[18px] px-4" data-episodes-coming style={{ "--show": colour } as CSSProperties}>
      <div className="flex flex-col gap-2.5 rounded-[4px] bg-card p-4 outline-1 -outline-offset-1 outline-border">
        <b className="flex items-center gap-2 text-[17px] leading-tight">
          <i className="nd-tally size-2.5 flex-none rounded-full bg-live" aria-hidden />
          Catching up on all {f.episodes.length} {f.words.episodes.toLowerCase()}
        </b>
        <small className="text-[13.5px] leading-snug text-muted-foreground" aria-live="polite">
          {halves && !working
            ? `What happened is in: each row shows it once you've seen it, never before. Now each ${ep}'s results, one at a time, for the ${f.words.people.toLowerCase()}' stats: ${lit} of ${f.episodes.length} so far. You can leave this page.`
            : `${lit} of ${f.episodes.length} in. What happened in each shows on its row once you've seen it, never before; you can leave this page.`}
        </small>
        <Filmstrip tiles={f.episodes} working={working} />
        {f.step === "episodes" &&
          f.episodes.some((e) => e.state === "waiting") &&
          (f.away ? (
            <Btn tone="must" wide data-episodes-coming-paste onClick={paste.open}>
              <Copy className="size-4" aria-hidden />
              Ask ChatGPT yourself, free
            </Btn>
          ) : (
            <button type="button" data-episodes-coming-paste onClick={paste.open} className="self-start py-1 text-[13px] font-semibold text-muted-foreground underline underline-offset-2">
              Or ask ChatGPT yourself, free
            </button>
          ))}
      </div>
      {paste.sheet}
    </section>
  );
}

/** Home's poster while its show gets ready (B's no-signal card): static over colour bars, clearing as each step lands, a bright
 *  line rolling down it, and a Getting ready tag. When it's done, Home reads again and the poster is itself. */
export function NoSignal({ seasonId }: { seasonId: string }) {
  const f = useFill(seasonId).data;
  const qc = useQueryClient();
  const status = f?.status;
  useEffect(() => {
    if (status && status !== "going") qc.invalidateQueries({ queryKey: ["new-design", "home"] });
  }, [status, qc]);
  const done = f ? f.steps.filter((s) => s.state === "done").length : 0;
  const clear = f && f.steps.length ? done / f.steps.length : 0;
  return (
    <>
      <span aria-hidden data-no-signal={status ?? "going"} className="absolute inset-0 -z-[1] overflow-hidden">
        <span className="nd-bars absolute inset-0 transition-opacity duration-700" style={{ opacity: 0.5 * (1 - clear) }} />
        <span className="nd-noise nd-static absolute -inset-1/4 mix-blend-overlay transition-opacity duration-700" style={{ opacity: 0.85 - 0.6 * clear }} />
        <span className="nd-roll absolute inset-x-0 top-0 h-1/4 bg-[linear-gradient(180deg,transparent,rgba(255,255,255,.14),transparent)]" />
      </span>
      <span data-ready-tag className="type-caption absolute left-[9px] top-[9px] flex items-center gap-1.5 bg-plate py-1 pl-[7px] pr-3 text-xs text-plate-foreground [clip-path:polygon(0_0,100%_0,calc(100%_-_7px)_100%,0_100%)]">
        <i className="nd-tally size-2 rounded-full bg-live" aria-hidden />
        Getting ready
      </span>
    </>
  );
}
