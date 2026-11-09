"use client";

import { Check, Minus, Plus } from "lucide-react";
import type { QuestionFace, QuestionView } from "../data";
import { Chip } from "../ui/parts";
import { toast } from "../ui/toast";
import { Face } from "./parts";

// The sixteen ways a question is answered (docs/PLAN-start-a-game-gpt.md U1; U0's Round 2 "every kind of question in its four
// states"): one control per answer kind in game-spec answers.js answerProblem, each giving exactly the value it checks, drawn the
// same on a game's own page (game-page.tsx, the move in place) and in the questions sheet (questions.tsx, Your moves). Chosen is
// white (a ring or a filled chip), never yellow: the screen's one yellow is the strip's, or the sheet's Save. A tap on what's chosen
// takes it back. Under the control, its riders (a stake, what it's worth now, a rollover, beat the bot). Weekly Calls' calls are
// Call it's sheet (calls.tsx), so `calls` is never answered here.

type Value = unknown;
type Props = { q: QuestionView; value: Value; onValue: (v: Value) => void; others?: QuestionView[] };

const first = (name: string) => name.split(" ")[0];
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const idsOf = (v: unknown): string[] => (Array.isArray(v) ? (v as string[]) : typeof v === "string" && v ? [v] : []);

/** The answers this file has a control for: all but Weekly Calls' (Call it's). */
export const ANSWERED_HERE: QuestionView["answer"][] = ["person", "group", "yesNo", "number", "overUnder", "choice", "order", "confidence", "chips", "split", "pairs", "side", "bracket", "trivia", "ticket"];

/** One question's control and its riders. A wager wraps the answer as { answer, stake }. */
export function Answer({ q, value, onValue, others = [] }: Props) {
  if (q.wager !== null && q.answer !== "ticket") {
    const bet = isObj(value) && "answer" in value ? (value as { answer: Value; stake?: number }) : null;
    const inner = { ...q, wager: null };
    const set = (answer: Value, stake: number) => onValue(answer === null || answer === undefined ? null : { answer, stake });
    return (
      <>
        <Control q={inner} value={bet?.answer ?? null} onValue={(a) => set(a, bet?.stake ?? 0)} others={others} />
        <Stake q={q} stake={bet?.stake ?? 0} disabled={!bet} onStake={(n) => bet && set(bet.answer, n)} />
        <Riders q={q} />
      </>
    );
  }
  return (
    <>
      <Control q={q} value={value} onValue={onValue} others={others} />
      <Riders q={q} />
    </>
  );
}

function Control({ q, value, onValue, others = [] }: Props) {
  if (q.each === "game") return <EachGame q={q} value={value} onValue={onValue} />;
  if (q.each === "person") return <EachPerson q={q} value={value} onValue={onValue} />;
  switch (q.answer) {
    case "person":
    case "group":
      return <Faces q={q} value={value} onValue={onValue} />;
    case "number":
      return <NumberStep value={typeof value === "number" ? value : null} max={(q.settle as { by?: string } | null)?.by === "outside" ? 10 : 100000} onValue={onValue} />;
    case "order":
    case "confidence":
      return <Order q={q} value={value} onValue={onValue} />;
    case "chips":
      return <Chips q={q} value={value} onValue={onValue} />;
    case "split":
      return <Split value={value} onValue={onValue} />;
    case "pairs":
      return <Pairs q={q} value={value} onValue={onValue} />;
    case "side":
      return <Sides faces={q.faces ?? []} value={typeof value === "string" ? value : null} onValue={onValue} label={q.ask} />;
    case "bracket":
      return <Bracket q={q} value={value} onValue={onValue} />;
    case "trivia":
      return <Trivia q={q} value={value} onValue={onValue} />;
    case "ticket":
      return <Ticket q={q} value={value} onValue={onValue} others={others} />;
    default:
      return <Options q={q} value={value} onValue={onValue} />;
  }
}

/** Yes or no, over or under, one of its options: chips. */
function Options({ q, value, onValue }: Props) {
  const options: [string, string][] =
    q.answer === "yesNo" ? [["yes", "Yes"], ["no", "No"]] : q.answer === "overUnder" ? [["over", `Over ${q.line ?? ""}`], ["under", `Under ${q.line ?? ""}`]] : (q.options ?? []).map((o) => [o, o]);
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label={q.ask}>
      {options.map(([key, label]) => (
        <Chip key={key} on={value === key} data-answer-option={key} onClick={() => onValue(value === key ? null : key)} className="h-11 px-5 text-[15px]">
          {label.trim()}
        </Chip>
      ))}
    </div>
  );
}

/** A face to tap: its photo, its name and qualifier under it, a badge in its corner (a tick, a rank). */
function FaceButton({ f, on, dim, badge, onClick, group }: { f: QuestionFace; on: boolean; dim?: boolean; badge?: string | null; onClick: () => void; group?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      data-answer-face={f.id}
      data-answer-name={f.name}
      onClick={onClick}
      className={`nd-press relative min-w-0 rounded-[3px] text-left ${on ? "outline-2 outline-offset-1 outline-foreground" : ""}`}
    >
      <Face src={f.photo} name={f.name} className={`aspect-square w-full rounded-[3px] text-[24px] ${dim ? "saturate-[.5]" : ""}`} />
      {badge && (
        <span className="type-num absolute right-1 top-1 grid size-6 place-items-center rounded-full bg-foreground text-[14px] text-background">
          {badge === "✓" ? <Check className="size-3.5" strokeWidth={3} aria-hidden /> : badge}
        </span>
      )}
      <b className="type-caption mt-1 block truncate text-[14px]">{group ? f.name : first(f.name)}</b>
    </button>
  );
}

/** Someone, or a group (A6): faces. Naming more than one, up to its pick. */
function Faces({ q, value, onValue }: Props) {
  const pick = q.pick ?? 1;
  const chosen = idsOf(value);
  const tap = (id: string) => {
    if (chosen.includes(id)) return onValue(pick === 1 ? null : chosen.filter((x) => x !== id));
    if (pick === 1) return onValue(id);
    if (chosen.length >= pick) return toast.quiet(`${pick} at most: take one off first`);
    onValue([...chosen, id]);
  };
  return (
    <>
      {q.from === "team" && <p className="mb-2 text-[13px] text-muted-foreground">From your team</p>}
      <div className="grid grid-cols-4 gap-2" role="group" aria-label={q.ask}>
        {(q.faces ?? []).map((f) => (
          <FaceButton key={f.id} f={f} on={chosen.includes(f.id)} dim={!!chosen.length && !chosen.includes(f.id)} badge={chosen.includes(f.id) ? "✓" : null} onClick={() => tap(f.id)} group={q.answer === "group"} />
        ))}
      </div>
      {pick > 1 && <p className="mt-2 text-[13px] text-muted-foreground" data-answer-count>{`${chosen.length} of ${pick} named`}</p>}
    </>
  );
}

/** A number on a stepper (an episode's rating, 0 to 10). */
function NumberStep({ value: n, max, onValue }: { value: number | null; max: number; onValue: (v: Value) => void }) {
  return (
    <div className="flex items-center gap-2" data-answer-number>
      <Step label="One less" disabled={!n} onClick={() => onValue(n === null ? 0 : Math.max(0, n - 1))} icon="minus" />
      <b className="type-num min-w-[64px] text-center text-[32px] leading-none" aria-live="polite">
        {n ?? "–"}
      </b>
      <Step label="One more" disabled={n !== null && n >= max} onClick={() => onValue(n === null ? (max === 10 ? 5 : 1) : Math.min(max, n + 1))} icon="plus" />
      {n !== null && (
        <button type="button" onClick={() => onValue(null)} className="ml-auto h-11 px-2 text-sm font-semibold text-muted-foreground">
          Take it back
        </button>
      )}
    </div>
  );
}

function Step({ label, disabled, onClick, icon }: { label: string; disabled?: boolean; onClick: () => void; icon: "minus" | "plus" }) {
  const I = icon === "minus" ? Minus : Plus;
  return (
    <button type="button" aria-label={label} disabled={disabled} onClick={onClick} className="nd-press grid size-11 flex-none place-items-center rounded-[3px] bg-secondary disabled:opacity-40">
      <I className="size-5" aria-hidden />
    </button>
  );
}

/** An order (who goes in what order) or confidence (your surest first): tap faces in turn; a tap again takes one out. */
function Order({ q, value, onValue }: Props) {
  const most = q.pick ?? (q.faces?.length ?? 1);
  const order = idsOf(value);
  const tap = (id: string) => {
    if (order.includes(id)) {
      const next = order.filter((x) => x !== id);
      return onValue(next.length ? next : null);
    }
    if (order.length >= most) return toast.quiet(`${most} at most: take one off first`);
    onValue([...order, id]);
  };
  return (
    <>
      <p className="mb-2 text-[13px] leading-snug text-muted-foreground" data-answer-order-hint>
        {q.answer === "confidence" ? `Tap your surest first: it scores the most · ${order.length} of ${most}` : `Tap them in order, first to go first · ${order.length} of ${most}`}
      </p>
      <div className="grid grid-cols-4 gap-2" role="group" aria-label={q.ask}>
        {(q.faces ?? []).map((f) => {
          const at = order.indexOf(f.id);
          return <FaceButton key={f.id} f={f} on={at >= 0} dim={at < 0 && order.length >= most} badge={at >= 0 ? String(at + 1) : null} onClick={() => tap(f.id)} />;
        })}
      </div>
    </>
  );
}

/** Chips to spread across who's still in: a stepper each, at most its chips in all. */
function Chips({ q, value, onValue }: Props) {
  const total = q.chips ?? 10;
  const v = isObj(value) ? (value as Record<string, number>) : {};
  const used = Object.values(v).reduce((a, b) => a + (Number(b) || 0), 0);
  const set = (id: string, n: number) => {
    const next = { ...v, [id]: n };
    if (n <= 0) delete next[id];
    onValue(Object.keys(next).length ? next : null);
  };
  return (
    <div data-answer-chips>
      <p className="mb-1 text-[13px] text-muted-foreground" aria-live="polite">{`${total - used} of ${total} chips left`}</p>
      {(q.faces ?? []).map((f) => {
        const n = v[f.id] ?? 0;
        return (
          <div key={f.id} className="flex min-h-[52px] items-center gap-3 border-b border-border last:border-b-0">
            <Face src={f.photo} name={f.name} className="size-9 flex-none rounded-[3px] text-sm" />
            <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">{first(f.name)}</span>
            <Step label={`One less on ${first(f.name)}`} disabled={!n} onClick={() => set(f.id, n - 1)} icon="minus" />
            <b className="type-num w-8 text-center text-[24px]">{n}</b>
            <Step label={`One more on ${first(f.name)}`} disabled={used >= total} onClick={() => set(f.id, n + 1)} icon="plus" />
          </div>
        );
      })}
    </div>
  );
}

/** How a vote splits: a few whole numbers, biggest first ("5-2-1"). */
function Split({ value, onValue }: Omit<Props, "q">) {
  const parts = Array.isArray(value) ? (value as number[]) : [];
  const shown = parts.length ? parts : [0, 0];
  const set = (i: number, n: number) => {
    const next = shown.map((x, j) => (j === i ? Math.max(0, n) : x));
    onValue(next.some((x) => x > 0) ? next : null);
  };
  return (
    <div data-answer-split>
      <p className="type-num mb-2 text-[28px]" aria-live="polite">{shown.join("–")}</p>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {shown.map((n, i) => (
          <span key={i} className="flex items-center gap-1.5">
            <Step label={`Fewer in part ${i + 1}`} disabled={!n} onClick={() => set(i, n - 1)} icon="minus" />
            <Step label={`More in part ${i + 1}`} onClick={() => set(i, n + 1)} icon="plus" />
          </span>
        ))}
        {shown.length < 5 && (
          <button type="button" onClick={() => onValue([...shown, 1])} className="h-11 px-1 text-sm font-semibold underline underline-offset-2">
            Add a part
          </button>
        )}
      </div>
    </div>
  );
}

/** Who outlasts whom, pair by pair: tap one of each pair. */
function Pairs({ q, value, onValue }: Props) {
  const v = isObj(value) ? (value as Record<string, string>) : {};
  const set = (key: string, id: string) => {
    const next = { ...v };
    if (next[key] === id) delete next[key];
    else next[key] = id;
    onValue(Object.keys(next).length ? next : null);
  };
  return (
    <div data-answer-pairs>
      {(q.pairs ?? []).map((p) => (
        <div key={p.key} className="flex min-h-[60px] items-center gap-2 border-b border-border last:border-b-0">
          {p.faces.map((f, i) => (
            <span key={f.id} className="contents">
              {i === 1 && <span className="flex-none px-1 text-[13px] text-muted-foreground">or</span>}
              <button type="button" aria-pressed={v[p.key] === f.id} data-answer-pair={`${p.key}:${f.id}`} onClick={() => set(p.key, f.id)} className={`nd-press flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-[3px] px-1.5 ${v[p.key] === f.id ? "bg-foreground text-background" : "bg-secondary"}`}>
                <Face src={f.photo} name={f.name} className="size-8 flex-none rounded-[2px] text-xs" />
                <b className="type-caption truncate text-[16px]">{first(f.name)}</b>
              </button>
            </span>
          ))}
        </div>
      ))}
      <p className="mt-2 text-[13px] text-muted-foreground">Who lasts longer in each pair</p>
    </div>
  );
}

/** A side of a game: the two teams, a big button each (the face-off). */
function Sides({ faces, value, onValue, label, disabled }: { faces: QuestionFace[]; value: string | null; onValue: (v: Value) => void; label: string; disabled?: boolean }) {
  return (
    <div className="flex items-center gap-2" role="group" aria-label={label}>
      {faces.map((f, i) => (
        <span key={f.id} className="contents">
          {i === 1 && <span className="flex-none text-[13px] text-muted-foreground">at</span>}
          <button type="button" disabled={disabled} aria-pressed={value === f.id} data-answer-side={f.id} onClick={() => onValue(value === f.id ? null : f.id)} className={`nd-press type-caption flex min-h-14 min-w-0 flex-1 items-center justify-center rounded-[3px] px-2 text-[22px] disabled:opacity-50 ${value === f.id ? "bg-plate text-plate-foreground shadow-plate" : "bg-card outline-1 -outline-offset-1 outline-border"}`}>
            <span className="truncate">{f.name}</span>
          </button>
        </span>
      ))}
    </div>
  );
}

/** One pick for each game of the week (L3 part 2f part 2): each game's sides; ranked by confidence when it says so. A started game's
 *  pick is kept as it was. */
function EachGame({ q, value, onValue }: Props) {
  const v = isObj(value) ? (value as Record<string, unknown>) : {};
  const n = q.games?.length ?? 0;
  const pickOf = (x: unknown) => (q.confidence && isObj(x) ? (x.answer as string) : (x as string)) ?? null;
  const confOf = (x: unknown) => (q.confidence && isObj(x) ? (x.confidence as number) : null);
  const set = (id: string, answer: string | null, confidence?: number | null) => {
    const next = { ...v };
    if (answer === null) delete next[id];
    else next[id] = q.confidence ? { answer, confidence: confidence ?? nextFree(next) } : answer;
    onValue(Object.keys(next).length ? next : null);
  };
  const nextFree = (x: Record<string, unknown>) => {
    const used = new Set(Object.values(x).map(confOf));
    for (let k = n; k >= 1; k--) if (!used.has(k)) return k;
    return 1;
  };
  return (
    <div data-answer-each="game">
      {(q.games ?? []).map((g) => (
        <div key={g.id} className="border-b border-border py-2.5 last:border-b-0" data-answer-game={g.id}>
          <p className="mb-1.5 flex justify-between gap-2 text-[13px] text-muted-foreground">
            <span>{g.name ?? "A game"}</span>
            <span>{g.called ? (g.called === "postponed" ? "Postponed" : "Called off") : g.started ? "Started · kept as it was" : g.line !== null ? `Line ${g.line}` : ""}</span>
          </p>
          <Sides faces={g.sides} value={pickOf(v[g.id])} onValue={(a) => set(g.id, (a as string) ?? null, confOf(v[g.id]))} label={g.name ?? "A game"} disabled={g.started || !!g.called} />
          {q.confidence && pickOf(v[g.id]) && (
            <label className="mt-2 flex items-center justify-between gap-2 text-[13px] text-muted-foreground">
              How sure (higher scores more)
              <select value={confOf(v[g.id]) ?? ""} onChange={(e) => set(g.id, pickOf(v[g.id]), Number(e.target.value))} className="h-11 rounded-[4px] bg-card px-2 text-foreground outline-1 -outline-offset-1 outline-border">
                {Array.from({ length: n }, (_, i) => n - i).map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      ))}
    </div>
  );
}

/** An answer for each one still in (A6): a row each, answered by the question's own kind. */
function EachPerson({ q, value, onValue }: Props) {
  const v = isObj(value) ? (value as Record<string, unknown>) : {};
  const base = { ...q, each: null } as QuestionView;
  const set = (id: string, a: Value) => {
    const next = { ...v };
    if (a === null || a === undefined) delete next[id];
    else next[id] = a;
    onValue(Object.keys(next).length ? next : null);
  };
  return (
    <div data-answer-each="person">
      {(q.faces ?? []).map((f) => (
        <div key={f.id} className="flex min-h-[60px] flex-wrap items-center gap-x-3 gap-y-2 border-b border-border py-2 last:border-b-0">
          <Face src={f.photo} name={f.name} className="size-9 flex-none rounded-[3px] text-sm" />
          <b className="type-caption min-w-0 flex-1 truncate text-[17px]">{first(f.name)}</b>
          <span className="flex-none">{base.answer === "number" ? <NumberStep value={typeof v[f.id] === "number" ? (v[f.id] as number) : null} max={100000} onValue={(a) => set(f.id, a)} /> : <Options q={base} value={v[f.id] ?? null} onValue={(a) => set(f.id, a)} />}</span>
        </div>
      ))}
    </div>
  );
}

/** A bracket (L4 part 2): each round's winners, the first round from the draw, every later round from your own picks before it (and
 *  whoever enters there); the final is round 1. */
function Bracket({ q, value, onValue }: Props) {
  const draw = q.draw;
  if (!draw) return <p className="text-sm text-muted-foreground">The draw isn&apos;t out yet: it opens once it is.</p>;
  const v = isObj(value) ? (value as Record<string, string[]>) : {};
  const faces = new Map(draw.entrants.map((e) => [e.id, e]));
  const rounds: { k: number; matches: [string, string | null][] }[] = [];
  for (let k = draw.first; k >= 1; k--) {
    if (k === draw.first) rounds.push({ k, matches: draw.matches.map(([a, b]) => [a.id, b.id]) });
    else {
      const from = [...(v[k + 1] ?? []), ...draw.entrants.filter((e) => e.enters === k).map((e) => e.id)];
      const ms: [string, string | null][] = [];
      for (let i = 0; i < from.length; i += 2) ms.push([from[i], from[i + 1] ?? null]);
      rounds.push({ k, matches: ms });
    }
  }
  const name = (k: number) => (k === 1 ? "Final" : k === 2 ? "Semifinals" : k === 3 ? "Quarterfinals" : `Round of ${2 ** k}`);
  const pick = (k: number, match: [string, string | null], id: string) => {
    const list = (v[k] ?? []).filter((x) => !match.includes(x));
    const next: Record<string, string[]> = { ...v, [k]: v[k]?.includes(id) ? list : [...list, id] };
    // A later round can't keep someone you no longer have winning this one.
    for (let j = k - 1; j >= 1; j--) if (next[j]) next[j] = next[j].filter((x) => (next[j + 1] ?? []).includes(x) || (faces.get(x)?.enters ?? 0) === j);
    for (const key of Object.keys(next)) if (!next[key].length) delete next[key];
    onValue(Object.keys(next).length ? next : null);
  };
  return (
    <div data-answer-bracket>
      {rounds.map((r) => (
        <div key={r.k} className="mt-3 first:mt-0">
          <p className="type-caption mb-1.5 text-[14px] tracking-[0.04em] text-muted-foreground">{name(r.k)}</p>
          {r.matches.length === 0 && <p className="text-[13px] text-muted-foreground">Pick the round before first</p>}
          <div className="flex flex-col gap-1.5">
            {r.matches.map((m, i) => (
              <div key={i} className="flex items-center gap-1.5">
                {m.map((id, j) =>
                  id ? (
                    <button key={id} type="button" aria-pressed={!!v[r.k]?.includes(id)} data-answer-bracket-pick={`${r.k}:${id}`} onClick={() => pick(r.k, m, id)} className={`nd-press type-caption min-h-11 min-w-0 flex-1 truncate rounded-[3px] px-2 text-[16px] ${v[r.k]?.includes(id) ? "bg-foreground text-background" : "bg-secondary"}`}>
                      {first(faces.get(id)?.name ?? "?")}
                    </button>
                  ) : (
                    <span key={`bye-${j}`} className="flex min-h-11 flex-1 items-center justify-center rounded-[3px] border border-dashed border-edge text-[13px] text-muted-foreground">
                      To pick
                    </span>
                  )
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/** A trivia round (A13): each question's options as chips; one you've played in the trivia sheet is kept as it was. */
function Trivia({ q, value, onValue }: Props) {
  const v = isObj(value) ? (value as Record<string, string>) : {};
  if (!q.trivia?.length) return <p className="text-sm text-muted-foreground">{q.offWhy ?? "No trivia for this round yet."}</p>;
  const set = (id: string, o: string) => {
    const next = { ...v };
    if (next[id] === o) delete next[id];
    else next[id] = o;
    onValue(Object.keys(next).length ? next : null);
  };
  return (
    <div data-answer-trivia>
      {q.trivia.map((t, i) => (
        <div key={t.id} className="border-b border-border py-2.5 last:border-b-0">
          <p className="text-[13px] text-muted-foreground">{`${i + 1} of ${q.trivia!.length} · about Episode ${t.episode}${t.played ? " · played" : ""}`}</p>
          <p className="mb-2 mt-0.5 text-[15px] font-semibold leading-snug">{t.question}</p>
          <div className="flex flex-wrap gap-2">
            {t.options.map((o) => (
              <Chip key={o} on={v[t.id] === o} disabled={t.played} onClick={() => set(t.id, o)} className="h-11 px-4 text-[15px]">
                {o}
              </Chip>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/** A ticket (C6 part 2): put some of this sheet's other questions on it, and a stake; every leg must hit, more legs pay more. */
function Ticket({ q, value, onValue, others = [] }: Props) {
  const t = q.ticket;
  const v = isObj(value) && Array.isArray(value.legs) ? (value as { legs: string[]; stake?: number }) : { legs: [], stake: 0 };
  if (!t) return null;
  const legs = t.of.map((id) => others.find((o) => o.id === id)).filter((o): o is QuestionView => !!o);
  const set = (next: { legs: string[]; stake?: number }) => onValue(next.legs.length ? next : null);
  const tap = (id: string) => {
    if (v.legs.includes(id)) return set({ ...v, legs: v.legs.filter((x) => x !== id) });
    if (v.legs.length >= t.max) return toast.quiet(`${t.max} legs at most: take one off first`);
    set({ ...v, legs: [...v.legs, id] });
  };
  const pays = v.legs.length >= t.min ? t.pays[v.legs.length - t.min] : null;
  return (
    <div data-answer-ticket>
      <p className="mb-1 text-[13px] leading-snug text-muted-foreground">{`Put ${t.min === t.max ? t.min : `${t.min} to ${t.max}`} of tonight's answers on it: every leg must hit`}</p>
      {legs.map((o) => (
        <button key={o.id} type="button" aria-pressed={v.legs.includes(o.id)} data-answer-leg={o.id} onClick={() => tap(o.id)} className="nd-press flex min-h-12 w-full items-center gap-3 border-b border-border text-left last:border-b-0">
          <span className={`grid size-7 flex-none place-items-center rounded-[3px] ${v.legs.includes(o.id) ? "bg-foreground text-background" : "outline-1 -outline-offset-1 outline-edge"}`}>{v.legs.includes(o.id) && <Check className="size-4" strokeWidth={3} aria-hidden />}</span>
          <span className="min-w-0 flex-1 text-[15px] leading-snug">{o.ask}</span>
        </button>
      ))}
      <Stake q={q} stake={v.stake ?? 0} disabled={!v.legs.length} onStake={(n) => set({ ...v, stake: n })} pays={pays} />
    </div>
  );
}

/** A stake on an answer: 0 to its most (the wager, what you have, or the bank's), what a right one pays. */
function Stake({ q, stake, disabled, onStake, pays }: { q: QuestionView; stake: number; disabled: boolean; onStake: (n: number) => void; pays?: number | null }) {
  const most = q.stakeMost ?? (typeof q.wager === "number" ? q.wager : 0);
  return (
    <div className={`mt-3 rounded-[3px] bg-secondary px-3 py-2 ${disabled ? "opacity-60" : ""}`} data-answer-stake>
      <div className="flex items-center gap-2">
        <span className="min-w-0 flex-1 text-[14px] font-semibold">Stake</span>
        <Step label="Stake less" disabled={disabled || stake <= 0} onClick={() => onStake(stake - 1)} icon="minus" />
        <b className="type-num w-10 text-center text-[24px]" aria-live="polite">{stake}</b>
        <Step label="Stake more" disabled={disabled || stake >= most} onClick={() => onStake(stake + 1)} icon="plus" />
      </div>
      <p className="mt-1 text-[13px] leading-snug text-muted-foreground">
        {disabled ? "Answer first, then stake" : `Up to ${most}${pays != null ? ` · pays ×${pays}` : ""} · ${q.odds === "pool" ? "the wrong stakes are shared by the right ones" : "right wins your stake, wrong loses it"}`}
      </p>
    </div>
  );
}

/** The lines under a control: how its points combine, what it's worth now, beat the bot. */
function Riders({ q }: { q: QuestionView }) {
  const lines: string[] = [];
  if (q.share === "split") lines.push("Split between everyone who's right");
  if (q.share === "only") lines.push("Scores only if you're the only one right");
  if (q.rollover && q.jackpot) lines.push(`Nobody got the last one: +${q.jackpot} rolled into this`);
  else if (q.rollover) lines.push("Nobody right: its points roll into the next");
  if (q.shrink && q.worth !== null) lines.push(`Worth ${q.worth} if you answer now · it shrinks each ${q.shrink.per === "change" ? "change" : "episode"}`);
  if (q.bot) lines.push(q.bot.called ? "Beat the bot: it's made its call, you'll see it at the lock" : "Beat the bot: score only where it's wrong");
  if (q.settle && "by" in q.settle && q.settle.by === "players") lines.push("Settled by what most of you say happened");
  if (!lines.length) return null;
  return (
    <ul className="mt-2.5 flex flex-col gap-1" data-answer-riders>
      {lines.map((l) => (
        <li key={l} className="rounded-[3px] bg-secondary px-3 py-2 text-[13px] leading-snug text-foreground">
          {l}
        </li>
      ))}
    </ul>
  );
}
