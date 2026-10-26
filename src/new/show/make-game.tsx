"use client";

import { useEffect, useRef, useState } from "react";
import { Bell, BookOpen, Check, ChevronRight, CircleAlert, Copy, Flag, Mic, RotateCcw, ShieldCheck, Trophy, Tv, Zap, type LucideIcon } from "lucide-react";
import { KINDS, OPT } from "@/lib/game/formats/rulebook-schema.js";
import { AskAiPasteSheet, type AnswerCheck } from "../backstage/ask-ai";
import { make, useAfterWatching, useMake, useMakePoll, type MakeReview, type MakeState } from "../data";
import type { ShowData } from "../screens/show-space";
import { PushedPage, usePushedPage } from "../ui/page";
import { Btn } from "../ui/parts";
import { openStartGame } from "../couch/start-game";
import { Sheet } from "../ui/sheet";
import { toast } from "../ui/toast";
import { HowItWorksBody } from "./how-it-works";
import { Face } from "./parts";

// Make it a game (docs/PLAN-new-design.md step 10 part 2a; the mock's rulebook.js makeGame and rbKindSheet): a page pushed
// over a show that isn't a game yet (?page=make), from the Games tab's and Tonight's plate and the show's ⋯ menu. It leads
// with "Ask ChatGPT for me" (free: setting up a show is on us; our bot asks how the show works, then who's in it, and the
// page shows what it finds as it comes in), with "Copy and paste it yourself" behind it (Ask an AI's sheet, a question at
// a time). Then the review: the kind as one line with Change (a series picks reality or scripted), the cast, each episode,
// what scores, where results come from and the games that fit; "See how the whole season works" opens How it works on
// the answers. Looks right sets it up for every couch (make-game.ts). One attempt per season, shared: someone else's ask
// shows here as it goes.

const KIND_ICON: Record<string, LucideIcon> = { competition: Trophy, series: Tv, talk: Mic, sport: Flag };
const partOf = (kind: string) => (kind === "sport" ? "an event" : kind === "talk" ? "a show" : "an episode");

/** Opens Make it a game over the show. */
export const useOpenMake = () => usePushedPage("make").show;

// A pasted answer reads as the whole JSON (Ask an AI's check line).
const jsonIn = (text: string): Record<string, unknown> | null => {
  const a = text.indexOf("{");
  const b = text.lastIndexOf("}");
  if (a < 0 || b <= a) return null;
  try {
    return JSON.parse(text.slice(a, b + 1));
  } catch {
    return null;
  }
};
const checkRules: AnswerCheck = (text) => {
  const j = jsonIn(text);
  const segs = Array.isArray(j?.segments) ? j.segments.length : 0;
  if (!j || (!segs && !j.cast)) return { ok: false, line: "That doesn't look like the whole answer. Copy all of it, from { to }." };
  return { ok: true, line: `Looks right: ${segs} ${segs === 1 ? "part" : "parts"} of ${partOf(String(j.kind ?? ""))}` };
};
const checkCast: AnswerCheck = (text) => {
  const n = Array.isArray(jsonIn(text)?.castaways) ? (jsonIn(text)!.castaways as unknown[]).length : 0;
  return n ? { ok: true, line: `Looks right: ${n} ${n === 1 ? "person" : "people"}` } : { ok: false, line: "That doesn't look like the whole answer. Copy all of it, from { to }." };
};

export function MakeGamePage({ show }: { show: ShowData }) {
  const page = usePushedPage("make");
  const howPage = usePushedPage("make-how");
  const h = show.header;
  const seasonId = h?.seasonId ?? "";
  const couchId = show.couch?.id ?? null;
  const state = useMake(seasonId, couchId, !!h && (page.open || howPage.open));
  const m = state.data;
  const asking = !!m?.setup?.asking;
  const poll = useMakePoll(seasonId, page.open && asking);
  const refresh = useAfterWatching();
  const [mode, setMode] = useState<"auto" | "paste" | "review">("auto");
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const carried = useRef<string | null>(null);

  // While our bot asks, a version is polled; when it moves, the page reads it all again.
  const v = poll.data?.v;
  useEffect(() => {
    if (v && m && v !== m.v) void state.refetch();
  }, [v, m, state]);

  // Our bot's ask ran out of time between its two questions (or was cut off): the page that's open carries on.
  const s = m?.setup;
  const stalled = !!s && s.via === "bot" && !s.asking && (s.stage === "rules" || s.stage === "cast");
  useEffect(() => {
    if (!page.open || !stalled || !s || carried.current === `${s.id}:${s.stage}`) return;
    carried.current = `${s.id}:${s.stage}`;
    make
      .carryOn(seasonId, couchId)
      .then(() => state.refetch())
      .catch((e) => setProblem((e as Error).message));
  }, [page.open, stalled, s, seasonId, couchId, state]);

  const act = async (fn: () => Promise<MakeState>, after?: (r: MakeState) => void) => {
    setBusy(true);
    setProblem(null);
    try {
      const r = await fn();
      await state.refetch();
      after?.(r);
    } catch (e) {
      setProblem((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const label = m?.label ?? (h ? `${h.show.name}${h.seasonNumber ? ` ${h.seasonNumber}` : ""}` : "");
  const pasting = mode === "paste" || (s?.via === "paste" && mode !== "review" && s.stage !== "ready");
  let body: React.ReactNode;
  if (!m) body = <div aria-busy className="h-72 animate-pulse rounded-[4px] bg-card" />;
  else if (m.ready) body = <Done m={m} seasonId={seasonId} couchId={couchId} />;
  else if (s && (s.asking || stalled) && !pasting) body = <Asking m={m} problem={problem} onPaste={() => setMode("paste")} />;
  else if (s?.stage === "failed" && !pasting)
    body = <Failed m={m} busy={busy} problem={problem} onAsk={() => act(() => make.ask(seasonId, couchId))} onPaste={() => setMode("paste")} />;
  else if (pasting || (s?.via === "paste" && !m.review))
    body = (
      <Paste
        m={m}
        seasonId={seasonId}
        couchId={couchId}
        onDone={() => void state.refetch()}
        onCheck={() => setMode("review")}
        onAsk={m.bot.available ? () => act(() => make.ask(seasonId, couchId), () => setMode("auto")) : null}
      />
    );
  else if (m.review)
    body = (
      <Review
        m={m}
        review={m.review}
        busy={busy}
        problem={problem}
        onHow={howPage.show}
        onAsk={(again) => act(() => make.ask(seasonId, couchId, again), () => setMode("auto"))}
        onPaste={() => setMode("paste")}
        onRestart={() => act(() => make.restart(seasonId, couchId, "all"), () => setMode("auto"))}
        onKind={(kind, start) => act(() => make.kind(seasonId, couchId, kind, start))}
        onConfirm={() =>
          act(
            () => make.confirm(seasonId, couchId),
            () => {
              void refresh();
              toast(`${label} is a game · every couch can play it`);
              page.close();
            }
          )
        }
      />
    );
  else
    body = (
      <Ask
        m={m}
        kind={h?.show.kind ?? "competition"}
        busy={busy}
        problem={problem}
        onAsk={() => act(() => make.ask(seasonId, couchId))}
        onPaste={() => setMode("paste")}
      />
    );

  const short = (h?.show.name ?? "Show").replace(/^The /, "");
  return (
    <>
      <PushedPage open={page.open} onClose={page.close} title="Make it a game" back={short}>
        <div data-make={m ? (m.ready ? "done" : (s?.stage ?? "new")) : "loading"} className="px-4 pb-12 pt-5">
          {body}
        </div>
      </PushedPage>
      {h && (
        <PushedPage open={howPage.open} onClose={howPage.close} title="How it works" back="Check it">
          <div data-make-how className="mx-2 mb-10 mt-3 pb-6">
            {m?.review ? (
              <HowItWorksBody
                page={{ how: m.review.how, cast: m.review.cast.faces.map((f) => ({ name: f.name, photo: f.photo, colour: null })) }}
                seasonId={seasonId}
                name={h.show.name}
                seasonNumber={h.seasonNumber}
                artUrl={h.show.artUrl}
              />
            ) : (
              <div aria-busy className="mx-2 h-[230px] animate-pulse rounded-[4px] bg-card" />
            )}
          </div>
        </PushedPage>
      )}
    </>
  );
}

function Title({ children, tag }: { children: React.ReactNode; tag?: string }) {
  return (
    <>
      {tag && (
        <span className="type-caption inline-block rounded-[2px] px-[7px] py-[2px] text-[11px] tracking-[0.05em] outline-1 -outline-offset-1 outline-dashed outline-white/60">{tag}</span>
      )}
      <h2 className="type-caption mt-2 text-[38px] leading-[.95]">{children}</h2>
    </>
  );
}

function Lede({ children }: { children: React.ReactNode }) {
  return <p className="mt-3 text-[16px] leading-snug text-muted-foreground">{children}</p>;
}

function Problem({ text }: { text: string | null }) {
  return text ? (
    <p role="alert" data-make-problem className="mt-3 rounded-[3px] bg-card p-3 text-[14px] leading-snug">
      {text}
    </p>
  ) : null;
}

/** "Ask ChatGPT for me": our bot (yellow is for what you must do; this is the one thing to do here). */
function AskButton({ busy, onAsk, line }: { busy: boolean; onAsk: () => void; line: string }) {
  return (
    <button
      type="button"
      data-make-ask
      disabled={busy}
      onClick={onAsk}
      className="nd-press mt-5 flex min-h-[76px] w-full items-center gap-3 rounded-[4px] bg-plate p-3.5 text-left text-plate-foreground disabled:opacity-70"
    >
      <span className="grid size-11 flex-none place-items-center rounded-[3px] bg-chyron text-chyron-foreground">
        <Zap className="size-5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <b className="block text-[17px]">{busy ? "Asking…" : "Ask ChatGPT for me"}</b>
        <small className="block text-[13px] leading-snug text-plate-muted">{line}</small>
      </span>
      <ChevronRight className="size-5 flex-none text-plate-muted" aria-hidden />
    </button>
  );
}

function PasteRow({ onPaste, line = "Any AI chat that searches the web · about 3 minutes" }: { onPaste: () => void; line?: string }) {
  return (
    <button type="button" data-make-paste onClick={onPaste} className="mt-2 flex min-h-[64px] w-full items-center gap-3 border-b border-border pb-2 text-left">
      <span className="grid size-10 flex-none place-items-center rounded-[3px] bg-secondary">
        <Copy className="size-5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <b className="block text-[15px] font-semibold">Copy and paste it yourself</b>
        <small className="block text-[13px] text-muted-foreground">{line}</small>
      </span>
      <ChevronRight className="size-5 text-muted-foreground" aria-hidden />
    </button>
  );
}

function Ask({ m, kind, busy, problem, onAsk, onPaste }: { m: MakeState; kind: string; busy: boolean; problem: string | null; onAsk: () => void; onPaste: () => void }) {
  return (
    <div data-make-view="ask">
      <Title tag="Not a game yet">Make {m.label} a game</Title>
      <Lede>
        One question to ChatGPT finds who&rsquo;s in it, how {partOf(kind)} runs and what should score. Anyone can do it, and every couch can play it after.
      </Lede>
      {m.bot.available ? (
        <AskButton busy={busy} onAsk={onAsk} line="About two minutes. Free: setting up a show is on us" />
      ) : (
        <p className="mt-5 rounded-[3px] bg-card p-3 text-[14px] leading-snug text-muted-foreground">Our bot isn&rsquo;t answering right now. Copy and paste works, and it&rsquo;s free too.</p>
      )}
      <Problem text={problem} />
      <PasteRow onPaste={onPaste} />
      <p className="mt-4 flex items-start gap-2 text-[13px] leading-snug text-muted-foreground">
        <ShieldCheck className="mt-px size-4 flex-none" aria-hidden />
        It looks up how the show works and who&rsquo;s in it, never what happened. Nothing past where you are shows here.
      </p>
    </div>
  );
}

/** What's been found so far, a line each, ticked as it comes in. */
function Found({ lines, pending }: { lines: string[]; pending: string | null }) {
  return (
    <ul data-make-found className="mt-5 flex flex-col gap-2.5">
      {lines.map((l) => (
        <li key={l} className="flex items-center gap-3 text-[16px]">
          <i className="grid size-6 flex-none place-items-center rounded-full bg-good/20 text-good">
            <Check className="size-3.5" strokeWidth={3} aria-hidden />
          </i>
          {l}
        </li>
      ))}
      {pending && (
        <li className="flex items-center gap-3 text-[16px] text-muted-foreground">
          <i className="size-6 flex-none animate-spin rounded-full border-[3px] border-border border-t-foreground motion-reduce:animate-none" aria-hidden />
          {pending}
        </li>
      )}
    </ul>
  );
}

function Asking({ m, problem, onPaste }: { m: MakeState; problem: string | null; onPaste: () => void }) {
  const s = m.setup!;
  const who = s.mine ? null : s.by ? `${s.by} asked` : "Someone else asked";
  return (
    <div data-make-view="asking" aria-live="polite">
      <Title>Asking ChatGPT</Title>
      <Lede>Reading up on {m.label}. You can leave: it carries on, and it&rsquo;s here when you come back.</Lede>
      <Found lines={s.found} pending={s.stage === "rules" ? "How it works…" : "Who's in it…"} />
      <div className="mt-6 h-1 overflow-hidden rounded-[2px] bg-border">
        <i className="nd-asking block h-full w-2/5 bg-foreground" />
      </div>
      {who && <p className="mt-3 text-[13px] text-muted-foreground">{who} · usually two or three minutes</p>}
      <Problem text={problem} />
      {problem && <PasteRow onPaste={onPaste} line="Or ask an AI yourself" />}
    </div>
  );
}

function Failed({ m, busy, problem, onAsk, onPaste }: { m: MakeState; busy: boolean; problem: string | null; onAsk: () => void; onPaste: () => void }) {
  return (
    <div data-make-view="failed">
      <Title>ChatGPT didn&rsquo;t get there</Title>
      <Lede>{m.setup?.message ?? "It didn't answer."} What it found so far is kept.</Lede>
      {m.setup && m.setup.found.length > 0 && <Found lines={m.setup.found} pending={null} />}
      {m.bot.available && <AskButton busy={busy} onAsk={onAsk} line="Ask again: what's missing" />}
      <Problem text={problem} />
      <PasteRow onPaste={onPaste} />
    </div>
  );
}

/** A step of copy and paste: its number (a tick once in), what it asks, and its Ask an AI button. */
function Step({ n, done, title, line, children }: { n: number; done: boolean; title: string; line: string; children?: React.ReactNode }) {
  return (
    <div data-make-step={n} data-done={done || undefined} className="flex gap-3 border-t border-border py-4">
      <span className={`type-num grid size-8 flex-none place-items-center rounded-full text-base ${done ? "bg-good/20 text-good" : "outline-1 -outline-offset-1 outline-input"}`}>
        {done ? <Check className="size-4" strokeWidth={3} aria-hidden /> : n}
      </span>
      <div className="min-w-0 flex-1">
        <b className="block text-[16px]">{title}</b>
        <small className="block text-[13px] leading-snug text-muted-foreground">{line}</small>
        {children}
      </div>
    </div>
  );
}

function Paste({ m, seasonId, couchId, onDone, onCheck, onAsk }: { m: MakeState; seasonId: string; couchId: string | null; onDone: () => void; onCheck: () => void; onAsk: (() => void) | null }) {
  const [sheet, setSheet] = useState<"rules" | "cast" | null>(null);
  const s = m.setup;
  const rulesIn = !!s && s.needs !== "rules";
  const castIn = rulesIn && s!.needs !== "cast";
  const castLine = s?.found.length && rulesIn && castIn ? s.found.find((l) => !/^How |things? that score|moments for|^A |^Talk/.test(l)) : null;
  const use = (part: "rules" | "cast") => async (answer: string) => {
    await make.paste(seasonId, couchId, part, answer);
    setSheet(null);
    onDone();
    toast(part === "rules" ? "Got how it works" : "Got who's in it");
  };
  return (
    <div data-make-view="paste">
      <Title>Make {m.label} a game</Title>
      <Lede>We write the questions; any AI chat that searches the web answers them. The free versions are plenty.</Lede>
      <div className="mt-5">
        <Step n={1} done={rulesIn} title="How it works" line="What happens in an episode, how people leave and what could score">
          {!rulesIn ? (
            <Btn tone="must" className="mt-3" data-make-open="rules" onClick={() => setSheet("rules")}>
              Ask an AI
            </Btn>
          ) : (
            <p className="mt-1.5 text-[13px] text-good">{s!.found.filter((l) => /^How |things? that score|moments for/.test(l)).join(" · ")}</p>
          )}
        </Step>
        <Step n={2} done={castIn} title="Who's in it" line={castLine ?? "Their names, photos and the groups they start in"}>
          {rulesIn && !castIn && (
            <Btn tone="must" className="mt-3" data-make-open="cast" onClick={() => setSheet("cast")}>
              Ask an AI
            </Btn>
          )}
        </Step>
      </div>
      <Btn tone={castIn ? "must" : "optional"} wide disabled={!castIn} data-make-check onClick={onCheck} className="mt-4">
        Check what it found
      </Btn>
      {onAsk && (
        <button type="button" onClick={onAsk} className="mt-3 flex min-h-11 items-center gap-2 text-[14px] font-semibold text-muted-foreground">
          <Zap className="size-4" aria-hidden />
          Or ask ChatGPT for me
        </button>
      )}
      <AskAiPasteSheet
        open={sheet === "rules"}
        onOpenChange={(o) => !o && setSheet(null)}
        title="How it works"
        tag="make-rules"
        what={`Ask an AI how ${m.label} works: what happens in an episode, how people leave and what could score. Then paste its whole answer back here.`}
        question={{ key: ["new-design", "make-prompt", seasonId, "rules"], load: () => make.prompt(seasonId, "rules") }}
        check={checkRules}
        onUse={use("rules")}
      />
      <AskAiPasteSheet
        open={sheet === "cast"}
        onOpenChange={(o) => !o && setSheet(null)}
        title="Who's in it"
        tag="make-cast"
        what={`Ask an AI who's in ${m.label}: their names, photos and the groups they start in. Then paste its whole answer back here.`}
        question={{ key: ["new-design", "make-prompt", seasonId, "cast", m.v], load: () => make.prompt(seasonId, "cast") }}
        check={checkCast}
        onUse={use("cast")}
      />
    </div>
  );
}

function Review({
  m,
  review,
  busy,
  problem,
  onHow,
  onAsk,
  onPaste,
  onRestart,
  onKind,
  onConfirm,
}: {
  m: MakeState;
  review: MakeReview;
  busy: boolean;
  problem: string | null;
  onHow: () => void;
  onAsk: (again?: "rules" | "cast") => void;
  onPaste: () => void;
  onRestart: () => void;
  onKind: (kind: string, start: string | null) => void;
  onConfirm: () => void;
}) {
  const [kinds, setKinds] = useState(false);
  const [all, setAll] = useState(false);
  const how = review.how;
  const Icon = KIND_ICON[review.kind.key] ?? Trophy;
  const faces = all ? review.cast.faces : review.cast.faces.slice(0, 6);
  const points = how.points.groups.flatMap((g) => g.items).slice(0, 6);
  const talk = review.kind.key === "talk";
  return (
    <div data-make-view="review">
      <Title>
        Does this
        <br />
        look right?
      </Title>
      <Lede>From ChatGPT&rsquo;s answer and the TV listing. Fix anything now, or later.</Lede>
      <button
        type="button"
        data-kind-line={review.kind.key}
        onClick={() => setKinds(true)}
        className="nd-press mt-5 flex min-h-[76px] w-full items-center gap-3 rounded-[4px] bg-card p-3 text-left outline-1 -outline-offset-1 outline-input"
      >
        <span className="grid size-12 flex-none place-items-center rounded-[3px] bg-foreground text-background">
          <Icon className="size-6" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <b className="block text-[18px]">{review.kind.name}</b>
          {review.kind.tagline && <small className="block text-[14px] leading-snug text-muted-foreground">{review.kind.tagline}</small>}
        </span>
        <span className="flex-none text-[15px] font-semibold underline underline-offset-4">Change</span>
      </button>

      {/* The cast */}
      <div className="mt-[26px] flex items-baseline justify-between gap-3">
        <h3 className="type-caption text-[24px]">{review.cast.label}</h3>
        {review.cast.count > 0 && (
          <span className="text-[13px] text-muted-foreground">
            {review.cast.count} {review.cast.unit}
          </span>
        )}
      </div>
      {review.cast.count > 0 ? (
        <>
          <div data-make-cast className="mt-3 grid grid-cols-2 gap-2">
            {faces.map((f) => (
              <div key={f.name} className="flex min-h-[64px] items-center gap-2.5 rounded-[3px] bg-card p-2">
                <Face src={f.photo} name={f.name} className="size-11 flex-none rounded-[3px] object-cover text-lg" />
                <span className="min-w-0">
                  <b className="block truncate text-[15px]">{f.name}</b>
                  {f.line && <small className="block truncate text-[12px] text-muted-foreground">{f.line}</small>}
                </span>
              </div>
            ))}
          </div>
          {review.cast.count > 6 && (
            <button type="button" onClick={() => setAll(!all)} className="mt-2 min-h-11 text-[14px] font-semibold text-muted-foreground">
              {all ? "Fewer" : `+${review.cast.count - 6} more`}
            </button>
          )}
        </>
      ) : (
        <p className="mt-2 text-[14px] leading-snug text-muted-foreground">{talk ? "A new host and guests every show: the games don't need a cast." : "Nobody yet."}</p>
      )}
      {review.needsCast && (
        <div data-make-needs-cast className="mt-3 rounded-[4px] bg-card p-3">
          <p className="text-[14px] leading-snug">Who&rsquo;s in it is still missing, and the games need it.</p>
          <div className="mt-3 flex gap-2">
            {m.bot.available && (
              <Btn tone="must" className="flex-1" disabled={busy} onClick={() => onAsk("cast")}>
                Ask ChatGPT for me
              </Btn>
            )}
            <Btn className="flex-1" onClick={onPaste}>
              Paste it
            </Btn>
          </div>
        </div>
      )}

      {/* Each episode */}
      <div className="mt-[26px] flex items-baseline justify-between gap-3">
        <h3 className="type-caption text-[24px]">{how.rundown.label}</h3>
        <span className="text-[13px] text-muted-foreground">
          {how.rundown.segments.length} {how.rundown.segments.length === 1 ? "part" : "parts"}
        </span>
      </div>
      <ol data-make-rundown className="mt-3">
        {how.rundown.segments.map((seg, i) => (
          <li key={seg.id} className="relative flex items-center gap-3 pb-3">
            {i < how.rundown.segments.length - 1 && <span aria-hidden className="absolute left-[15px] top-8 h-[calc(100%-20px)] w-px bg-border" />}
            <span className="type-num grid size-8 flex-none place-items-center rounded-full text-base outline-1 -outline-offset-1 outline-input">{seg.n}</span>
            <b className="type-caption min-w-0 flex-1 text-[20px] leading-tight">{seg.name}</b>
            {seg.stake && <span className="type-caption flex-none rounded-[2px] px-2 py-0.5 text-[12px] tracking-[0.08em] text-muted-foreground outline-1 -outline-offset-1 outline-input">{seg.stake.label}</span>}
          </li>
        ))}
      </ol>

      {/* What scores */}
      <div className="mt-[18px] flex items-baseline justify-between gap-3">
        <h3 className="type-caption text-[24px]">{how.points.label}</h3>
        <span className="text-[13px] text-muted-foreground">{talk ? "For bingo and calls" : "Suggested"}</span>
      </div>
      <div data-make-points className="mt-2">
        {points.map((it) => (
          <div key={it.id} className="flex min-h-11 items-center justify-between gap-3 border-b border-border py-1.5">
            <span className="text-[15px]">{it.label}</span>
            {it.points != null && !talk && (
              <b className={`type-num flex-none text-[22px] ${it.points > 0 ? "text-good" : it.points < 0 ? "text-live" : "text-muted-foreground"}`}>
                {it.points > 0 ? `+${it.points}` : it.points < 0 ? `−${Math.abs(it.points)}` : "0"}
              </b>
            )}
          </div>
        ))}
      </div>

      <p className="mt-5 flex items-start gap-2 text-[14px] leading-snug">
        <Bell className="mt-0.5 size-4 flex-none" aria-hidden />
        <span>
          <b>Results:</b> {how.results.replace(/\.$/, "")}.
        </span>
      </p>
      <p data-make-games className="mt-2 flex items-start gap-2 text-[14px] leading-snug">
        <Trophy className="mt-0.5 size-4 flex-none" aria-hidden />
        <span>
          <b>You can play:</b> {how.games.map((g) => g.name).join(", ")}.
        </span>
      </p>
      {review.dropped.length > 0 && (
        <p data-make-dropped className="mt-3 text-[13px] leading-snug text-muted-foreground">
          Left out because it didn&rsquo;t fit: {review.dropped.join(", ")}.
        </p>
      )}
      {review.problems.length > 0 && (
        <div role="alert" data-make-unusable className="mt-4 rounded-[4px] bg-card p-3">
          <p className="flex items-start gap-2 text-[14px] leading-snug">
            <CircleAlert className="mt-0.5 size-4 flex-none text-chyron-line" aria-hidden />
            This answer can&rsquo;t be used: {review.problems[0].replace(/\.$/, "")}.
          </p>
          <div className="mt-3 flex gap-2">
            {m.bot.available && (
              <Btn tone="must" className="flex-1" disabled={busy} onClick={() => onAsk("rules")}>
                Ask again
              </Btn>
            )}
            <Btn className="flex-1" onClick={onRestart} disabled={busy}>
              Start over
            </Btn>
          </div>
        </div>
      )}
      <Problem text={problem} />
      <p className="mt-5 flex items-start gap-2 text-[13px] leading-snug text-muted-foreground">
        <ShieldCheck className="mt-px size-4 flex-none" aria-hidden />
        Every couch can play it once it&rsquo;s set up. It&rsquo;s marked new until someone on another couch checks it.
      </p>
      <Btn tone="must" wide data-make-ok disabled={!review.approvable || busy} onClick={onConfirm} className="mt-4 h-14 text-[16px]">
        {busy ? "Setting it up…" : "Looks right · make it a game"}
      </Btn>
      <button type="button" data-make-how-link onClick={onHow} className="mt-2 flex min-h-12 w-full items-center justify-center gap-2 text-[15px] font-semibold">
        <BookOpen className="size-[18px]" aria-hidden />
        See how the whole season works
      </button>
      {!review.problems.length && (
        <button type="button" data-make-restart onClick={onRestart} disabled={busy} className="mx-auto mt-1 flex min-h-11 items-center gap-1.5 text-[13px] font-semibold text-muted-foreground">
          <RotateCcw className="size-3.5" aria-hidden />
          Start over
        </button>
      )}
      <KindSheet open={kinds} onOpenChange={setKinds} label={m.label} review={review} onUse={onKind} />
    </div>
  );
}

/** "What kind of show?" (the mock's rbKindSheet): the guess marked, the four kinds; a series picks reality or scripted. */
function KindSheet({ open, onOpenChange, label, review, onUse }: { open: boolean; onOpenChange: (o: boolean) => void; label: string; review: MakeReview; onUse: (kind: string, start: string | null) => void }) {
  const [kind, setKind] = useState(review.kind.key as string);
  const [start, setStart] = useState(review.kind.start ?? "reality");
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setKind(review.kind.key);
      setStart(review.kind.start ?? "reality");
    }
  }
  const guess = review.kind.guess;
  const guessName = `${KINDS[guess.key].name}${guess.key === "series" && guess.start ? ` · ${guess.start}` : ""}`;
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="What kind of show?" subtitle={`${label} · we guessed ${guessName.toLowerCase()}`}>
      <div data-kind-sheet className="flex flex-col gap-2 pb-2">
        {OPT.kind.map(([k, name, blurb]) => {
          const Icon = KIND_ICON[k] ?? Trophy;
          const on = k === kind;
          return (
            <div key={k}>
              <button
                type="button"
                data-kind={k}
                aria-pressed={on}
                onClick={() => setKind(k)}
                className={`flex w-full items-start gap-3 rounded-[4px] p-3 text-left ${on ? "bg-plate text-plate-foreground outline-[3px] -outline-offset-[3px] outline-chyron" : "bg-card"}`}
              >
                <span className={`grid size-10 flex-none place-items-center rounded-[3px] ${on ? "bg-plate-foreground text-plate" : "bg-secondary"}`}>
                  <Icon className="size-5" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <b className="block text-[16px]">
                    {name}
                    {k === guess.key && <span className={on ? "text-plate-muted" : "text-muted-foreground"}> · our guess</span>}
                  </b>
                  <small className={`block text-[13px] leading-snug ${on ? "text-plate-muted" : "text-muted-foreground"}`}>{blurb}</small>
                  <em className={`mt-0.5 block text-[12px] ${on ? "text-plate-muted" : "text-muted-foreground"}`}>Like {KINDS[k as keyof typeof KINDS].like}</em>
                </span>
              </button>
              {k === "series" && on && (
                <div role="radiogroup" aria-label="Where it starts from" className="mt-2 grid grid-cols-2 gap-2">
                  {(["reality", "scripted"] as const).map((st) => (
                    <button
                      key={st}
                      type="button"
                      role="radio"
                      aria-checked={start === st}
                      data-start={st}
                      onClick={() => setStart(st)}
                      className={`h-11 rounded-[3px] text-[15px] font-semibold capitalize ${start === st ? "bg-foreground text-background" : "bg-secondary"}`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        <p className="mt-1 text-[13px] leading-snug text-muted-foreground">The kind renames the parts and decides which games fit. Nothing ChatGPT found is lost.</p>
        <Btn
          tone="must"
          wide
          data-kind-use
          onClick={() => {
            onOpenChange(false);
            onUse(kind, kind === "series" ? start : null);
          }}
        >
          Use this
        </Btn>
      </div>
    </Sheet>
  );
}

/** It's a game: every couch can play it, starting with yours (Start a game: step 10 part 2b). */
function Done({ m, seasonId, couchId }: { m: MakeState; seasonId: string; couchId: string | null }) {
  return (
    <div data-make-view="done">
      <span className="grid size-12 place-items-center rounded-full bg-good/20 text-good">
        <Check className="size-6" strokeWidth={3} aria-hidden />
      </span>
      <Title>{m.label} is a game</Title>
      <Lede>{m.madeBy ? `${m.madeBy} set it up. ` : ""}Every couch can play it now, and How it works is on its Games tab.</Lede>
      <Btn tone="must" wide data-make-start className="mt-5" onClick={() => openStartGame({ seasonId, couchId })}>
        Start a game
      </Btn>
    </div>
  );
}
