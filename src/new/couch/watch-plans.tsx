"use client";

import { useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { CalendarPlus, Check, ChevronRight, Tv, UserPlus } from "lucide-react";
import { airTime, calm, dayDiff, dayOf } from "../clock";
import { plansApi, useHome, usePlanOptions, useSetPlans, type PlanEpisode, type PlanHow, type PlanOptions, type WatchPlan } from "../data";
import { NavLink } from "../nav";
import { paths } from "../routes";
import { Avatar } from "../ui/bars";
import { Btn, Chip } from "../ui/parts";
import { Preview } from "../ui/preview";
import { Sheet } from "../ui/sheet";
import { ShowArt } from "../ui/show-bar";
import { toast } from "../ui/toast";
import { namesOf } from "../hub/sections";
import { openCouchSheet } from "./couch-sheets";

// Planned nights (docs/PLAN-new-design.md step 11 part 3; the mock's watching.js inviteWatch and wTonight's w-plan / w-inv,
// streaming.js's plans), opened from anywhere signed in with openPlan:
//   new   Plan a watch along: which episode (your next by default), the live airing or a shared start (a day and a time; a
//         streaming season or an episode that's aired is always a shared start), who on the couch to invite (those who watch
//         it, by default), Send invites (one push to each).
//   plan  One planned night: when, who's in, I'm in / Can't make it, and for whoever planned it Call it off (Undo). Opening
//         it together (one clock for everyone in it) is step 13 part 3's (Preview); on your own time it's Tonight's Watch along.
// Also the plate a show's Tonight and a couch show's sheet carry for each plan (PlanPlates), and the row that plans one
// (PlanInvite). The plans come with the home read (watch-plans.ts); a write puts the answer's list back in it.

export type PlanTarget = { kind: "new"; seasonId: string; couchId: string; episode?: number } | { kind: "plan"; planId: string };

type Store = { target: PlanTarget | null; n: number };
let store: Store = { target: null, n: 0 };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const SERVER: Store = { target: null, n: 0 };

/** Open Plan a watch along (for a season, on a couch), or one planned night. */
export function openPlan(target: PlanTarget) {
  store = { ...store, target: null };
  emit();
  setTimeout(() => {
    store = { target, n: store.n + 1 };
    emit();
  }, 30);
}

const close = () => {
  store = { ...store, target: null };
  emit();
};

function usePlanTarget(): Store {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => store,
    () => SERVER
  );
}

/** The sheets' host, in the signed-in layout. */
export function PlanSheets() {
  const { target, n } = usePlanTarget();
  const onOpenChange = (o: boolean) => !o && close();
  return (
    <>
      <NewPlanSheet key={`new-${n}`} target={target?.kind === "new" ? target : null} onOpenChange={onOpenChange} />
      <PlanSheet key={`plan-${n}`} planId={target?.kind === "plan" ? target.planId : null} onOpenChange={onOpenChange} />
    </>
  );
}

// ---------- the words ----------

/** "The live airing", "Starting together". */
export const howWords = (how: PlanHow) => (how === "live" ? "The live airing" : "Starting together");

/** Who's in and who's asked, from where you sit: "riley and sam are in · jordan invited", "You're invited · alex planned it". */
export function whoLine(p: WatchPlan, me: string): string {
  const others = p.people.filter((x) => x.userId !== me);
  const ins = others.filter((x) => x.answer === "in").map((x) => x.name);
  const asked = others.filter((x) => x.answer === "invited").map((x) => x.name);
  const parts: string[] = [];
  if (p.you === "invited") parts.push(`You're invited · ${p.host.name} planned it`);
  else if (ins.length) parts.push(`${p.you === "host" || p.you === "in" ? "You, " : ""}${namesOf(ins)} ${ins.length === 1 && !(p.you === "host" || p.you === "in") ? "is" : "are"} in`);
  else if (p.you === "host" || p.you === "in") parts.push("You're in so far");
  if (p.you !== "invited" && asked.length) parts.push(`${namesOf(asked)} invited`);
  return parts.join(" · ");
}

// ---------- on a show's Tonight and a couch show's sheet ----------

/** The plate for each planned night here (the mock's w-plan): when, who's in, and I'm in for whoever hasn't said. */
export function PlanPlates({ plans, me }: { plans: WatchPlan[]; me: string }) {
  const setPlans = useSetPlans();
  const [busy, setBusy] = useState<string | null>(null);
  if (!plans.length) return null;
  const answer = async (p: WatchPlan) => {
    setBusy(p.id);
    try {
      setPlans((await plansApi.answer(p.id, "in")).plans);
      toast(`You're in · ${p.label} Episode ${p.episode}, ${airTime(Date.parse(p.startsAt))}`);
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(null);
    }
  };
  return (
    <div className="flex flex-col gap-2.5">
      {plans.map((p) => {
        const at = Date.parse(p.startsAt);
        const yours = p.you === "host" || p.you === "in";
        return (
          <div key={p.id} data-plan={p.id} data-plan-you={p.you ?? "none"} className="flex min-h-[86px] items-stretch overflow-hidden rounded-[3px] bg-plate text-plate-foreground shadow-plate">
            <button type="button" data-plan-open onClick={() => openPlan({ kind: "plan", planId: p.id })} className="nd-press flex min-w-0 flex-1 flex-col items-start gap-1 py-3 pl-3.5 pr-2 text-left">
              <span className="type-caption bg-plate-foreground py-[3px] pl-2 pr-3.5 text-[11px] tracking-[0.06em] text-plate [clip-path:polygon(0_0,100%_0,calc(100%_-_7px)_100%,0_100%)]">
                Watch along
              </span>
              <b className="text-[17px] leading-tight">
                Episode {p.episode} · {airTime(at)}
              </b>
              <small className="text-[13px] leading-snug text-plate-muted">
                {howWords(p.how)} · {whoLine(p, me)}
              </small>
            </button>
            <span className="flex flex-none items-center pr-3">
              {yours ? (
                // Opening it together (one clock for everyone in it) is step 13 part 3.
                <Preview id="show.watch-together" tag={false}>
                  <span className="grid h-11 place-items-center rounded-[3px] bg-plate-foreground px-4 text-[15px] font-bold text-plate">Open</span>
                </Preview>
              ) : p.you === "out" ? (
                <button type="button" onClick={() => openPlan({ kind: "plan", planId: p.id })} className="h-11 rounded-[3px] px-3 text-[13px] font-bold text-plate-muted outline-1 -outline-offset-1 outline-plate-muted/40">
                  Can&rsquo;t make it
                </button>
              ) : (
                <button
                  type="button"
                  data-plan-in
                  disabled={busy === p.id}
                  onClick={() => answer(p)}
                  className="nd-press h-11 rounded-[3px] bg-plate-foreground px-4 text-[15px] font-bold text-plate disabled:opacity-50"
                >
                  I&rsquo;m in
                </button>
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** Plan a watch along (the mock's w-inv): a quiet row, never yellow. */
export function PlanInvite({ onClick, line = "Invite the couch for the live airing, or start at the same time" }: { onClick: () => void; line?: string }) {
  return (
    <button type="button" data-plan-invite onClick={onClick} className="nd-press flex min-h-[64px] w-full items-center gap-3 rounded-[4px] bg-card p-3.5 text-left outline-1 -outline-offset-1 outline-border">
      <UserPlus className="size-6 flex-none text-good" aria-hidden />
      <span className="min-w-0 flex-1">
        <b className="block text-[16px]">Plan a watch along</b>
        <small className="block text-[13px] leading-snug text-muted-foreground">{line}</small>
      </span>
      <ChevronRight className="size-5 flex-none text-muted-foreground" aria-hidden />
    </button>
  );
}

// ---------- Plan a watch along ----------

const TIMES: [number, number][] = [
  [20, 0],
  [20, 30],
  [21, 0],
  [21, 30],
  [22, 0],
];
const DAYS_OFFERED = 4;
/** A row of chips that scrolls sideways rather than wrapping (the sheet stays short enough to reach Send). */
const ROW = "-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-0.5 [scrollbar-width:none]";
const timeLabel = ([h, m]: [number, number]) => `${h % 12 || 12}:${String(m).padStart(2, "0")} PM`;

/** The days a shared start can be on: from the day the episode's out (or today), four in a row, at local midnight. */
function startDays(out: number, now: number): number[] {
  const first = new Date(Math.max(out, now));
  first.setHours(0, 0, 0, 0);
  return Array.from({ length: DAYS_OFFERED }, (_, i) => {
    const d = new Date(first);
    d.setDate(d.getDate() + i);
    return d.getTime();
  });
}

const momentOf = (day: number, [h, m]: [number, number]) => {
  const d = new Date(day);
  d.setHours(h, m, 0, 0);
  return d.getTime();
};

/** "Nov 5". */
const dateOf = (t: number) => new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric" });

/** A day, calmly: "Tonight", "Tomorrow", "Wed" this week, "Wed Nov 11" past it. */
const dayWord = (day: number, now: number) => {
  const d = dayDiff(day, now);
  return d === 0 ? "Tonight" : d === 1 ? "Tomorrow" : d < 7 ? dayOf(day) : `${dayOf(day)} ${dateOf(day)}`;
};

/** An episode chip's line: "Ep 6 · Thu", "Ep 7 · Nov 5", "Ep 4 · aired", "Ep 6 · planned". */
const episodeChip = (e: PlanEpisode, now: number) => {
  if (e.planned) return `Ep ${e.number} · planned`;
  if (e.aired) return `Ep ${e.number} · aired`;
  const at = Date.parse(e.airAt!);
  const d = dayDiff(at, now);
  return `Ep ${e.number} · ${d === 0 ? "tonight" : d === 1 ? "tomorrow" : d < 7 ? dayOf(at) : dateOf(at)}`;
};

function NewPlanSheet({ target, onOpenChange }: { target: { seasonId: string; couchId: string; episode?: number } | null; onOpenChange: (o: boolean) => void }) {
  const [asked] = useState(target);
  const t = target ?? asked;
  const opts = usePlanOptions(t?.seasonId ?? null, t?.couchId ?? null, !!target);
  const o = opts.data;
  return (
    <Sheet open={!!target} onOpenChange={onOpenChange} title="Plan a watch along" subtitle={o?.label}>
      <div data-plan-sheet={o ? (o.blocked ? "blocked" : "ready") : "loading"} className="flex flex-col pb-2">
        {opts.error ? (
          <p className="text-[15px] text-muted-foreground">{(opts.error as Error).message}</p>
        ) : !o || !t ? (
          <div aria-busy className="h-64 animate-pulse rounded-[4px] bg-secondary" />
        ) : o.blocked ? (
          <>
            <p data-plan-blocked className="text-[15px] leading-snug text-muted-foreground">
              {o.blocked}.
            </p>
            {!o.people.length && (
              <Btn
                wide
                className="mt-3"
                onClick={() => {
                  close();
                  openCouchSheet({ kind: "invite", couchId: o.couchId, show: o.label });
                }}
              >
                <UserPlus className="size-5" aria-hidden />
                Invite someone to the couch
              </Btn>
            )}
          </>
        ) : (
          <PlanForm o={o} episode={t.episode ?? null} />
        )}
      </div>
    </Sheet>
  );
}

function PlanForm({ o, episode: asked }: { o: PlanOptions; episode: number | null }) {
  const setPlans = useSetPlans();
  const home = useHome().data;
  const me = home?.user.id ?? "";
  const [now] = useState(() => Date.now());
  const [episode, setEpisode] = useState(asked && o.episodes.some((e) => e.number === asked) ? asked : o.from!);
  const e = o.episodes.find((x) => x.number === episode) ?? o.episodes[0];
  const [pickedHow, setHow] = useState<PlanHow | null>(null);
  const how: PlanHow = e.live ? (pickedHow ?? "live") : "start";
  const out = Date.parse(e.airAt!);
  const days = startDays(out, now);
  // Valid starts: still to come, and once it's out.
  const ok = (day: number, tm: [number, number]) => momentOf(day, tm) > Math.max(now, out - 1);
  const firstDay = days.findIndex((d) => TIMES.some((tm) => ok(d, tm)));
  const [pickedDay, setDay] = useState<number | null>(null);
  const [pickedTime, setTime] = useState<number | null>(null);
  const di = pickedDay ?? Math.max(0, firstDay);
  const ti = pickedTime != null && ok(days[di], TIMES[pickedTime]) ? pickedTime : ok(days[di], TIMES[2]) ? 2 : TIMES.findIndex((tm) => ok(days[di], tm));
  const at = how === "live" ? out : ti >= 0 ? momentOf(days[di], TIMES[ti]) : null;
  const [picked, setPicked] = useState<Set<string> | null>(null);
  const invited = picked ?? new Set(o.people.filter((p) => p.watches).map((p) => p.userId));
  const [busy, setBusy] = useState(false);
  const existing = e.planned ? (home?.plans ?? []).find((p) => p.id === e.planned) ?? o.plans.find((p) => p.id === e.planned) : null;

  const send = async () => {
    if (at == null || !invited.size) return;
    setBusy(true);
    try {
      const r = await plansApi.plan(o.seasonId, o.couchId, { episode: e.number, how, startsAt: how === "start" ? new Date(at).toISOString() : undefined, invite: [...invited] });
      setPlans(r.plans);
      toast(`Invites sent · ${o.label} Episode ${e.number}, ${airTime(Date.parse(r.plan.startsAt))}`);
      close();
    } catch (err) {
      toast((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const label = "type-caption mb-2 mt-4 block text-[13px] tracking-[0.06em] text-muted-foreground first:mt-0";
  return (
    <>
      {o.episodes.length > 1 && (
        <>
          <span className={label}>Episode</span>
          {/* One row, sideways: your next first. */}
          <div className={ROW} data-plan-episodes>
            {o.episodes.map((x) => (
              <Chip key={x.number} on={x.number === e.number} data-plan-episode={x.number} onClick={() => setEpisode(x.number)} className="flex-none whitespace-nowrap">
                {episodeChip(x, now)}
              </Chip>
            ))}
          </div>
        </>
      )}
      {existing ? (
        <div className="mt-4 flex flex-col gap-2.5" data-plan-existing={existing.id}>
          <p className="text-[15px] leading-snug text-muted-foreground">
            There&rsquo;s a watch along for Episode {e.number} already. {existing.you === "host" || existing.you === "in" ? "You're in." : "Say you're in, and you're on it."}
          </p>
          <PlanPlates plans={[existing]} me={me} />
        </div>
      ) : (
        <>
          <span className={`${label} ${o.episodes.length > 1 ? "" : "!mt-0"}`}>How</span>
          <div className="flex flex-col gap-2" data-plan-how={how}>
            {e.live && (
              <HowCard
                on={how === "live"}
                dot="var(--live)"
                title="The live airing"
                line={`${airTime(out)} · everyone follows the broadcast, Ad break included`}
                data-how="live"
                onClick={() => setHow("live")}
              />
            )}
            <HowCard
              on={how === "start"}
              dot="var(--good)"
              title="Start at the same time"
              line={e.live ? "Streaming · one shared clock · anyone can pause for everyone" : `${o.release === "binge" ? "It's streaming" : `Episode ${e.number} has aired`} · one shared start · anyone can pause for everyone`}
              data-how="start"
              onClick={() => setHow("start")}
            />
          </div>
          {how === "start" && (
            <>
              <span className={label}>Day</span>
              <div className={ROW} data-plan-days>
                {days.map((d, i) => (
                  <Chip key={d} on={i === di} disabled={!TIMES.some((tm) => ok(d, tm))} data-plan-day={i} onClick={() => setDay(i)} className="flex-none whitespace-nowrap disabled:opacity-40">
                    {dayWord(d, now)}
                  </Chip>
                ))}
              </div>
              <span className={label}>Start at</span>
              <div className={ROW} data-plan-times>
                {TIMES.map((tm, i) => (
                  <Chip key={i} on={i === ti} disabled={!ok(days[di], tm)} data-plan-time={timeLabel(tm)} onClick={() => setTime(i)} className="flex-none whitespace-nowrap disabled:opacity-40">
                    {timeLabel(tm)}
                  </Chip>
                ))}
              </div>
            </>
          )}
          <span className={label}>Invite</span>
          <div className="flex flex-wrap gap-1.5" data-plan-people>
            {o.people.map((p) => (
              <Chip
                key={p.userId}
                on={invited.has(p.userId)}
                data-plan-person={p.name}
                onClick={() => {
                  const next = new Set(invited);
                  if (next.has(p.userId)) next.delete(p.userId);
                  else next.add(p.userId);
                  setPicked(next);
                }}
              >
                {p.name}
                {!p.watches && <span className="font-normal opacity-75">&nbsp;· new to it</span>}
              </Chip>
            ))}
          </div>
          <p className="mt-3 text-[13px] leading-snug text-muted-foreground">Can&rsquo;t make it? They can watch along later. Everyone&rsquo;s reactions wait for them.</p>
          <Btn tone="must" wide className="mt-3" data-plan-send disabled={busy || !invited.size || at == null} onClick={send}>
            Send invites
          </Btn>
        </>
      )}
    </>
  );
}

function HowCard({ on, dot, title, line, onClick, ...data }: { on: boolean; dot: string; title: string; line: string; onClick: () => void; "data-how": PlanHow }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      {...data}
      className={`flex w-full items-start gap-3 rounded-[4px] p-3 text-left ${on ? "bg-plate text-plate-foreground outline-[3px] -outline-offset-[3px] outline-chyron" : "bg-secondary/60"}`}
    >
      <i className="mt-[5px] size-3 flex-none rounded-full" style={{ background: dot }} aria-hidden />
      <span className="min-w-0 flex-1">
        <b className="block text-[16px]">{title}</b>
        <small className={`block text-[13px] leading-snug ${on ? "text-plate-muted" : "text-muted-foreground"}`}>{line}</small>
      </span>
    </button>
  );
}

// ---------- one planned night ----------

const ANSWER_WORD = { in: "In", invited: "Invited", out: "Can't make it" } as const;

function PlanSheet({ planId, onOpenChange }: { planId: string | null; onOpenChange: (o: boolean) => void }) {
  const home = useHome().data;
  const setPlans = useSetPlans();
  const pathname = usePathname();
  const [busy, setBusy] = useState(false);
  const [shownId] = useState(planId);
  const id = planId ?? shownId;
  const p = (home?.plans ?? []).find((x) => x.id === id) ?? null;
  const me = home?.user.id ?? "";

  const run = async (what: () => Promise<{ plans: WatchPlan[] }>, said: string, undo?: () => Promise<{ plans: WatchPlan[] }>) => {
    setBusy(true);
    try {
      setPlans((await what()).plans);
      toast(said, undo ? { undo: () => void undo().then((r) => setPlans(r.plans)).catch((e) => toast((e as Error).message)) } : {});
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const at = p ? Date.parse(p.startsAt) : 0;
  return (
    <Sheet open={!!planId} onOpenChange={onOpenChange} title="Watch along" subtitle={p ? `${p.label} · Episode ${p.episode}` : undefined}>
      {!p ? (
        <p className="pb-4 text-[15px] text-muted-foreground">This watch along was called off or is over.</p>
      ) : (
        <div data-plan-detail={p.id} data-plan-you={p.you ?? "none"} className="flex flex-col pb-2">
          <div className="relative isolate mb-3 flex h-[150px] flex-col items-start justify-end gap-1 overflow-hidden rounded-[4px] p-3.5 text-white">
            <ShowArt seasonId={`plan-${p.seasonId}`} artUrl={p.artUrl} name={p.name} className="absolute inset-0 -z-[2] size-full" />
            <span aria-hidden className="absolute inset-0 -z-[1] bg-[linear-gradient(180deg,rgba(16,14,21,.1),rgba(16,14,21,.88))]" />
            <span className="type-caption bg-good py-[3px] pl-2 pr-4 text-[11px] tracking-[0.06em] text-good-foreground [clip-path:polygon(0_0,100%_0,calc(100%_-_8px)_100%,0_100%)]">
              {howWords(p.how)}
            </span>
            <b className="type-caption text-[30px] leading-none">{airTime(at)}</b>
            <small className="text-[13px] opacity-90">
              {p.name} · Episode {p.episode} · {calm(at)}
            </small>
          </div>
          <div data-plan-people-list>
            {p.people.map((x) => (
              <div key={x.userId} data-plan-row={x.name} data-answer={x.answer} className="flex min-h-[52px] items-center gap-3 border-t border-border py-1.5 first:border-t-0">
                <Avatar id={x.userId} name={x.name} size={30} />
                <b className="min-w-0 flex-1 truncate text-[15px] font-semibold">
                  {x.name}
                  {x.userId === me && <span className="font-normal text-muted-foreground"> · you</span>}
                </b>
                <small className={`text-[13px] font-semibold ${x.answer === "in" ? "text-good" : "text-muted-foreground"}`}>
                  {x.userId === p.host.userId ? "Planned it" : ANSWER_WORD[x.answer]}
                </small>
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-col gap-2.5">
            {p.you === "host" || p.you === "in" ? (
              <Preview id="show.watch-together" tag={false}>
                <Btn tone="ink" wide>
                  <Tv className="size-5" aria-hidden />
                  Open the watch along
                </Btn>
              </Preview>
            ) : (
              <Btn tone="ink" wide data-plan-yes disabled={busy} onClick={() => run(() => plansApi.answer(p.id, "in"), `You're in · ${p.label} Episode ${p.episode}`)}>
                <Check className="size-5" aria-hidden />
                I&rsquo;m in
              </Btn>
            )}
            {p.you === "host" ? (
              <Btn
                wide
                data-plan-cancel
                disabled={busy}
                onClick={() =>
                  run(
                    () => plansApi.cancel(p.id, true),
                    `Watch along called off · ${p.label} Episode ${p.episode}`,
                    () => plansApi.cancel(p.id, false)
                  ).then(close)
                }
              >
                Call it off
              </Btn>
            ) : p.you !== "out" ? (
              <Btn wide data-plan-no disabled={busy} onClick={() => run(() => plansApi.answer(p.id, "out"), "Got it · they'll watch along without you")}>
                Can&rsquo;t make it
              </Btn>
            ) : null}
            {!pathname.startsWith(`/show/${p.seasonId}/`) && (
              <NavLink href={paths.show(p.seasonId)} className="grid h-11 place-items-center text-sm font-semibold text-muted-foreground underline-offset-2 hover:underline">
                Open the show
              </NavLink>
            )}
          </div>
        </div>
      )}
    </Sheet>
  );
}

/** The ⋯ menu's icon for the row. */
export const PlanIcon = CalendarPlus;
