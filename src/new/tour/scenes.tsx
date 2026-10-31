"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ArrowUp, CalendarDays, Check, ChevronRight, Eye, Lock, MessageCircle, Plus, Search, Share, ShieldCheck, Trophy, Tv, Users } from "lucide-react";
import { useMe } from "../session";
import { ADD_TO_HOME_ART } from "../show/remind";
import { Avatar } from "../ui/bars";
import { useReducedMotion } from "../welcome/hooks";
import type { StepId, TourReminders } from "./steps";

// The tour's examples (docs/PLAN-first-time-tour.md): one short scene a step, the real thing in small, playing in the lower
// third's box, 324 x 200 (tour.tsx scales it to the box). Made-up content only: real show names appear only where nothing is
// revealed (the guide, Add a show, what the couch watches); anything with a result, a stat or a pick is Golden Crust, a
// made-up baking show whose bakers are the illustrations in public/tour/. The couch's people are the site mock's demo names,
// and "you" is your own face.
//
// Pace (the user, 2026-10-31: slower): a beat on the first picture once the step's light is on, a beat before each simulated
// tap, the tap landing, then a hold on the finished picture before it plays again. Reduced motion holds each scene on its
// teaching picture.

const LEAD = 1200;
const BEAT = 1300;
const AFTER = 320;
const HOLD = 2800;
const FADE = 320;

/** Which beat a scene is on (0: its first picture): each of `waits` is how long after the one before. It starts once `go`, holds
 *  on the last, fades and plays again; under reduced motion it stays on `still`. `quiet`: transitions off for the frame it
 *  starts over on, so nothing animates backwards under the fade. */
function useBeats(waits: readonly number[], go: boolean, still: number) {
  const reduce = useReducedMotion();
  const [s, setS] = useState({ b: 0, fading: false, quiet: false });
  useEffect(() => {
    if (reduce || !go) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    let frame = 0;
    const run = () => {
      setS({ b: 0, fading: true, quiet: true });
      frame = requestAnimationFrame(() => (frame = requestAnimationFrame(() => setS({ b: 0, fading: false, quiet: false }))));
      let at = 0;
      waits.forEach((w, i) => {
        at += w;
        timers.push(setTimeout(() => setS({ b: i + 1, fading: false, quiet: false }), at));
      });
      timers.push(setTimeout(() => setS((x) => ({ ...x, fading: true })), at + HOLD - FADE));
      timers.push(setTimeout(run, at + HOLD));
    };
    run();
    return () => {
      timers.forEach(clearTimeout);
      cancelAnimationFrame(frame);
      setS({ b: 0, fading: false, quiet: false });
    };
  }, [waits, go, reduce]);
  const { b, fading, quiet } = reduce ? { b: still, fading: false, quiet: false } : s;
  return { b, root: `size-full transition-opacity duration-300 ${fading ? "opacity-0" : "opacity-100"} ${quiet ? "[&_*]:!transition-none" : ""}` };
}
/** In and out of a scene: a fade and a small rise, keeping its place. */
const pop = (on: boolean) => `transition-[opacity,transform] duration-300 ease-[cubic-bezier(.16,1,.3,1)] ${on ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"}`;

/** A finger's tap, over the middle of whatever `relative` thing it's in. */
const Tap = ({ on }: { on: boolean }) => (on ? <span aria-hidden className="nd-tour-tap" /> : null);

const PEOPLE = { riley: ["R", "#5089c9"], jordan: ["J", "#f2804b"], alex: ["A", "#8fb86a"], casey: ["C", "#a76bb0"] } as const;
type Person = keyof typeof PEOPLE | "you";

/** Someone on the made-up couch, or you (your own face). */
function Face({ who, size = 22, className = "" }: { who: Person; size?: number; className?: string }) {
  const me = useMe();
  if (who === "you")
    return (
      <span className={`inline-flex flex-none ${className}`}>
        <Avatar id={me.id} name={me.name} size={size} />
      </span>
    );
  const [letter, colour] = PEOPLE[who];
  return (
    <span
      aria-hidden
      className={`type-num inline-grid flex-none place-items-center rounded-[3px] text-[#121018] ${className}`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.5), background: colour }}
    >
      {letter}
    </span>
  );
}

const ART = { survivor: "/tour/survivor.jpg", traitors: "/tour/traitors.jpg", pluribus: "/tour/pluribus.jpg" };
const BAKER = { gus: "/tour/gus.jpg", clive: "/tour/clive.jpg", jo: "/tour/jo.jpg", hana: "/tour/hana.jpg" };
const artBg = (url: string) => ({ backgroundImage: `linear-gradient(180deg, rgba(16,14,21,.05) 30%, rgba(16,14,21,.9)), url(${url})` });

/** A caption plate in small (the app's: a tag cut on the slant, then the white plate). */
function Plate({ tag, tone, title, line, end, className = "" }: { tag: ReactNode; tone: string; title: ReactNode; line?: ReactNode; end?: ReactNode; className?: string }) {
  return (
    <div className={`flex min-h-[50px] items-stretch overflow-hidden rounded-[3px] bg-plate text-plate-foreground shadow-plate ${className}`}>
      <span className={`tag-cut type-caption flex items-center whitespace-nowrap pl-2.5 pr-4 text-[13px] tracking-[0.04em] [--tag-slant:9px] ${tone}`}>{tag}</span>
      <span className="flex min-w-0 flex-1 flex-col justify-center gap-[3px] py-1.5 pl-1.5 pr-2">
        <b className="type-caption text-[17px]">{title}</b>
        {line && <small className="text-[12px] leading-tight text-plate-muted">{line}</small>}
      </span>
      {end}
    </div>
  );
}

/** The show's tab bar, small, the current tab marked as the app marks it. */
function Tabs({ on, people = "Cast", tap }: { on: number; people?: string; tap?: number }) {
  const tabs = [
    [Tv, "Tonight"],
    [CalendarDays, "Episodes"],
    [Trophy, "Games"],
    [Users, people],
    [MessageCircle, "Chat"],
  ] as const;
  return (
    <div className="relative grid h-[46px] grid-cols-5 border-t border-border bg-background">
      {tabs.map(([Icon, label], n) => (
        <span key={label} className={`relative grid content-center justify-items-center gap-[3px] text-[10px] font-semibold transition-colors ${n === on ? "text-foreground" : "text-muted-foreground"}`}>
          <Icon className="size-[17px]" aria-hidden />
          {label}
          <Tap on={tap === n} />
        </span>
      ))}
      <i aria-hidden className="absolute -top-px left-0 flex h-[3px] w-1/5 justify-center transition-transform duration-[380ms] ease-[cubic-bezier(.16,1,.3,1)]" style={{ transform: `translateX(${on * 100}%)` }}>
        <span className="h-[3px] w-[26px] bg-chyron-line" />
      </i>
    </div>
  );
}

// ---------- 1 · your couch: faces land on what each person watches ----------

const COUCH = [LEAD, 500, 500, 500, 700] as const;

function DayTile({ tag, day, art, name, time, faces, who, showWho }: { tag?: string; day: string; art: string; name: string; time: string; faces: [Person, boolean][]; who: ReactNode; showWho: boolean }) {
  return (
    <div>
      <div className="mb-2 flex h-[22px] items-center gap-2">
        {tag && <span className="tag-cut type-caption flex h-full items-center bg-quiet-tag pl-2 pr-3.5 text-[12px] text-quiet-tag-foreground [--tag-slant:8px]">{tag}</span>}
        <span className="type-caption text-[15px]">{day}</span>
      </div>
      <div className="dark relative flex h-[116px] flex-col justify-end overflow-hidden rounded-[4px] bg-cover bg-center p-2 text-white" style={artBg(art)}>
        <span className="absolute right-2 top-2 flex">
          {faces.map(([p, on], n) => (
            <Face
              key={p}
              who={p}
              className={`${n ? "-ml-1" : ""} rounded-[3px] shadow-[0_0_0_2px_#16141d] transition-[opacity,transform] duration-300 ease-[cubic-bezier(.16,1,.3,1)] ${on ? "scale-100 opacity-100" : "scale-[.4] opacity-0"}`}
            />
          ))}
        </span>
        <b className="type-caption text-[21px] leading-none">{name}</b>
        <small className="mt-[3px] text-xs opacity-85">{time}</small>
      </div>
      <p className={`mt-2 text-xs text-muted-foreground ${pop(showWho)}`}>{who}</p>
    </div>
  );
}

function CouchScene({ go }: { go: boolean }) {
  const { b, root } = useBeats(COUCH, go, 5);
  return (
    <div className={`grid grid-cols-2 gap-2.5 pt-0.5 ${root}`} data-beat={b}>
      <DayTile
        tag="Tonight"
        day="Wed"
        art={ART.survivor}
        name="Survivor"
        time="8:00 PM"
        faces={[["riley", b >= 1], ["jordan", b >= 3], ["you", b >= 4]]}
        who={<><b className="font-semibold text-foreground">riley, jordan</b> and you</>}
        showWho={b >= 5}
      />
      <DayTile day="Thu" art={ART.traitors} name="Traitors" time="9:00 PM" faces={[["riley", b >= 2]]} who={<b className="font-semibold text-foreground">riley</b>} showWho={b >= 5} />
    </div>
  );
}

// ---------- 2 · add any show: search, add, where you are, spoiler-safe ----------

const WORD = "Pluribus";
// 1-8: the name typed; 9: the show; 10: tap ＋; 11: added; 12: where are you; 13: tap Ep 3; 14: on Ep 3; 15: spoiler-safe
const ADD = [LEAD, ...Array<number>(WORD.length - 1).fill(110), 800, BEAT, AFTER, 900, BEAT, AFTER, 700] as const;

function AddScene({ go }: { go: boolean }) {
  const { b, root } = useBeats(ADD, go, ADD.length);
  const typed = WORD.slice(0, Math.min(b, WORD.length));
  return (
    <div className={`grid content-start gap-2 ${root}`} data-beat={b}>
      <div className="flex h-9 items-center gap-2 rounded-[4px] bg-card px-2.5 text-[14px] outline-1 -outline-offset-1 outline-edge">
        <Search className="size-4 text-muted-foreground" aria-hidden />
        {typed ? <span className="whitespace-pre">{typed}</span> : <span className="text-muted-foreground">Search or add a show</span>}
        {typed && b < 9 && <span aria-hidden className="nd-tour-caret -ml-1.5 h-[17px] w-0.5 bg-foreground" />}
      </div>
      <div className={`flex h-[52px] items-center gap-2.5 overflow-hidden rounded-[4px] bg-card pr-2 ${pop(b >= 9)}`}>
        <span className="h-[52px] w-[52px] flex-none bg-cover bg-center" style={{ backgroundImage: `url(${ART.pluribus})` }} />
        <span className="grid min-w-0 flex-1 gap-0.5">
          <b className="type-caption text-[18px] leading-none">Pluribus</b>
          <small className="text-xs text-muted-foreground">Apple TV+ · 9 episodes</small>
        </span>
        <span className={`relative grid size-8 flex-none place-items-center rounded-full transition-colors ${b >= 11 ? "bg-good text-good-foreground" : "bg-foreground/15"}`}>
          {b >= 11 ? <Check className="size-[18px]" strokeWidth={3} aria-hidden /> : <Plus className="size-[18px]" aria-hidden />}
          <Tap on={b === 10} />
        </span>
      </div>
      <div className={`flex items-center gap-2 ${pop(b >= 12)}`}>
        <span className="whitespace-nowrap text-[13px] font-semibold">Where are you?</span>
        <span className="flex gap-1.5">
          {[1, 2, 3, 4].map((n) => (
            <i
              key={n}
              className={`relative grid h-7 place-items-center rounded-[3px] px-2 text-xs font-bold not-italic transition-colors ${
                n === 3 && b >= 14 ? "bg-foreground text-background" : "text-muted-foreground outline-1 -outline-offset-1 outline-input"
              }`}
            >
              Ep {n}
              {n === 3 && <Tap on={b === 13} />}
            </i>
          ))}
        </span>
      </div>
      <span className={`inline-flex h-7 items-center gap-1.5 justify-self-start rounded-[3px] bg-good/10 px-2.5 text-xs font-bold text-(--nd-good) ${pop(b >= 15)}`}>
        <ShieldCheck className="size-[14px]" aria-hidden />
        <span>
          <b>Spoiler-safe</b> · you&rsquo;re on Ep 3
        </span>
      </span>
    </div>
  );
}

// ---------- 3 · see what they watch: riley started something; add it ----------

const THEIRS = [LEAD, BEAT + 400, AFTER] as const;

function TheirsScene({ go }: { go: boolean }) {
  const { b, root } = useBeats(THEIRS, go, THEIRS.length);
  return (
    <div className={`grid content-start gap-2.5 ${root}`} data-beat={b}>
      <div className={`flex h-[26px] items-center gap-2 text-[13px] ${pop(b >= 1)}`}>
        <Face who="riley" />
        <span className="min-w-0 flex-1 truncate">
          <b className="font-bold">riley</b> started watching Traitors 5
        </span>
        <small className="text-xs text-muted-foreground">now</small>
      </div>
      <div className="flex h-[158px] overflow-hidden rounded-[4px] bg-card">
        <div className="dark relative w-[118px] flex-none bg-cover bg-center" style={artBg(ART.traitors)}>
          <span
            className={`type-caption absolute left-2 top-2 rounded-[2px] bg-[rgba(10,8,14,.75)] px-[7px] py-[3px] text-[10px] tracking-[0.05em] text-white outline-1 -outline-offset-1 outline-dashed outline-white/50 transition-opacity duration-300 ${b >= 3 ? "opacity-0" : "opacity-100"}`}
          >
            Not on your list
          </span>
        </div>
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-2 p-3">
          <b className="type-caption text-[22px] leading-none">Traitors 5</b>
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Face who="riley" size={18} /> riley · Ep 2
          </span>
          <span className="relative h-9">
            <span
              className={`absolute inset-0 flex items-center justify-center gap-1.5 rounded-[3px] text-[13px] font-bold outline-1 -outline-offset-1 outline-edge transition-opacity duration-200 ${b >= 3 ? "opacity-0" : "opacity-100"}`}
            >
              <Plus className="size-4" aria-hidden /> Add to my shows
            </span>
            <span
              className={`absolute inset-0 flex items-center justify-center gap-1.5 rounded-[3px] bg-good/15 text-[13px] font-bold text-(--nd-good) transition-[opacity,transform] duration-300 ${b >= 3 ? "scale-100 opacity-100" : "scale-95 opacity-0"}`}
            >
              <Check className="size-4" aria-hidden /> On your list
            </span>
            <Tap on={b === 2} />
          </span>
        </div>
      </div>
    </div>
  );
}

// ---------- 4 · bring people in: share the code, someone joins ----------

const INVITE = [LEAD, AFTER, 1100, 400] as const;

function InviteScene({ go }: { go: boolean }) {
  const { b, root } = useBeats(INVITE, go, 3);
  return (
    <div className={`relative grid content-start gap-3 pt-1 ${root}`} data-beat={b}>
      {/* The app's toast, in small. */}
      <div className={`absolute inset-x-0 -top-0.5 z-[1] flex h-10 items-stretch overflow-hidden rounded-[3px] bg-plate text-plate-foreground shadow-plate ${pop(b >= 4)}`}>
        <span className="tag-cut grid place-items-center bg-good pl-2.5 pr-4 text-good-foreground [--tag-slant:9px]">
          <Check className="size-4" strokeWidth={3} aria-hidden />
        </span>
        <span className="flex items-center pl-1.5 text-[14px] font-semibold">casey joined your couch</span>
      </div>
      <div className="flex items-baseline justify-between">
        <b className="type-caption text-[20px]">Your couch</b>
        <small className="type-num text-xs font-normal text-muted-foreground">{b >= 3 ? "5" : "4"} people</small>
      </div>
      <div className="flex gap-1.5">
        <Face who="you" size={36} />
        <Face who="riley" size={36} />
        <Face who="jordan" size={36} />
        <Face who="alex" size={36} />
        <span className="relative grid size-9 place-items-center rounded-[3px] text-muted-foreground outline-1 -outline-offset-1 outline-dashed outline-edge">
          <Plus className="size-4" aria-hidden />
          <span className={`absolute inset-0 transition-[opacity,transform] duration-[420ms] ease-[cubic-bezier(.16,1,.3,1)] ${b >= 3 ? "translate-x-0 opacity-100" : "translate-x-3.5 opacity-0"}`}>
            <Face who="casey" size={36} />
          </span>
        </span>
      </div>
      <div className="flex h-14 items-center justify-between gap-2.5 rounded-[4px] bg-card pl-3 pr-2.5">
        <span>
          <small className="block text-[11px] text-muted-foreground">Invite code</small>
          <b className="type-num text-[26px] leading-none tracking-[0.12em]">K7Q2XZ</b>
        </span>
        <span className="relative h-9 w-[92px]">
          <span className={`absolute inset-0 flex items-center justify-center gap-1.5 rounded-[3px] text-[13px] font-bold outline-1 -outline-offset-1 outline-edge transition-opacity duration-200 ${b >= 2 ? "opacity-0" : ""}`}>
            <Share className="size-4" aria-hidden /> Share
          </span>
          <span className={`absolute inset-0 flex items-center justify-center gap-1.5 rounded-[3px] bg-good/15 text-[13px] font-bold text-(--nd-good) transition-opacity duration-200 ${b >= 2 ? "" : "opacity-0"}`}>
            <Check className="size-4" aria-hidden /> Shared
          </span>
          <Tap on={b === 1} />
        </span>
      </div>
    </div>
  );
}

// ---------- 5 · yellow means your move: Set, All set, Locked at airtime ----------

const MOVE = [LEAD, AFTER, BEAT + 500, 400] as const;

function MoveScene({ go }: { go: boolean }) {
  const { b, root } = useBeats(MOVE, go, 0);
  const state = b >= 4 ? "locked" : b >= 2 ? "set" : "due";
  const shown = (s: string) => `absolute inset-0 transition-[opacity,transform] duration-300 ease-[cubic-bezier(.16,1,.3,1)] ${state === s ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-1.5 opacity-0"}`;
  return (
    <div className={`flex flex-col justify-center gap-3 ${root}`} data-beat={b}>
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <CalendarDays className="size-3.5" aria-hidden />
        <b className="type-num text-[13px] text-foreground">{b >= 3 ? "Wed 8:00 PM" : "Mon 6:12 PM"}</b>· Episode 6 {b >= 3 ? "is on" : "airs Wed 8:00 PM"}
      </p>
      <div className="relative h-[58px]">
        <div className={`${shown("due")} flex items-stretch overflow-hidden rounded-[3px] bg-plate text-plate-foreground shadow-plate`}>
          <span className="flex items-center pl-2">
            {[BAKER.gus, BAKER.jo, BAKER.hana].map((src) => (
              // eslint-disable-next-line @next/next/no-img-element -- a tiny static picture from public/
              <img key={src} src={src} alt="" className="-mr-1.5 size-[30px] rounded-[3px] object-cover shadow-[0_0_0_2px_#fff]" />
            ))}
          </span>
          <span className="flex min-w-0 flex-1 flex-col justify-center gap-[3px] pl-4 pr-2">
            <b className="type-caption text-[17px]">Your pick</b>
            <small className="text-[12px] text-plate-muted">Locks Wed 8:00 PM</small>
          </span>
          <span className="flex items-center pr-2">
            <span className="relative grid h-10 place-items-center rounded-[3px] bg-chyron px-4 text-[15px] font-bold text-chyron-foreground">
              Set
              <Tap on={b === 1} />
            </span>
          </span>
        </div>
        <Plate
          className={shown("set")}
          tag={<Check className="size-4" strokeWidth={3} aria-hidden />}
          tone="bg-good text-good-foreground"
          title="All set"
          line="Change it until Wed 8:00 PM"
          end={
            <span className="flex items-center pr-2">
              <span className="grid h-10 place-items-center rounded-[3px] px-4 text-[15px] font-bold outline-1 -outline-offset-1 outline-plate-muted/50">Edit</span>
            </span>
          }
        />
        <Plate className={shown("locked")} tag={<Lock className="size-4" aria-hidden />} tone="bg-quiet-tag text-quiet-tag-foreground" title="Locked" line="Episode 6 is on · scores after you reveal" />
      </div>
    </div>
  );
}

// ---------- 6 · results wait: Reveal, who went home, the chat opens ----------

const REVEAL = [LEAD + 400, AFTER, 900] as const;

function RevealScene({ go }: { go: boolean }) {
  const { b, root } = useBeats(REVEAL, go, REVEAL.length);
  const out = b >= 2;
  return (
    <div className={`grid content-start gap-2.5 ${root}`} data-beat={b}>
      <div className="relative h-[62px]">
        <Plate
          className={`absolute inset-0 transition-[opacity,transform] duration-200 ${out ? "scale-y-[.6] opacity-0" : "opacity-100"}`}
          tag="Ep 5"
          tone="bg-chyron text-chyron-foreground"
          title="Results are in"
          line="Hidden until you reveal"
          end={
            <span className="flex items-center pr-2">
              <span className="relative flex h-10 items-center gap-1.5 rounded-[3px] bg-chyron px-3.5 text-[14px] font-bold text-chyron-foreground">
                <Eye className="size-4" aria-hidden /> Reveal
                <Tap on={b === 1} />
              </span>
            </span>
          }
        />
        <div className={`absolute inset-0 flex items-stretch overflow-hidden rounded-[3px] bg-plate text-plate-foreground shadow-plate transition-[opacity,transform] duration-300 ease-[cubic-bezier(.16,1,.3,1)] ${out ? "scale-100 opacity-100" : "scale-y-[.6] opacity-0"}`}>
          {/* eslint-disable-next-line @next/next/no-img-element -- a tiny static picture from public/ */}
          <img src={BAKER.gus} alt="" className="size-[62px] flex-none object-cover" />
          <span className="tag-cut type-caption flex items-center bg-live pl-2.5 pr-4 text-[13px] text-live-foreground [--tag-slant:9px]">Out</span>
          <span className="flex min-w-0 flex-1 flex-col justify-center gap-[3px] pl-1.5">
            <b className="type-caption text-[17px]">Gus</b>
            <small className="text-[12px] text-plate-muted">Sent home · Episode 5</small>
          </span>
        </div>
      </div>
      <div className="relative h-[108px]">
        <div className={`absolute inset-0 flex gap-2.5 rounded-[4px] p-3 outline-1 -outline-offset-1 outline-dashed outline-edge transition-[opacity,transform] duration-300 ${b >= 3 ? "-translate-y-1.5 opacity-0" : "opacity-100"}`}>
          <Eye className="mt-px size-[18px] flex-none text-muted-foreground" aria-hidden />
          <span>
            <b className="block text-sm font-bold">5 messages since Episode 5 aired</b>
            <small className="mt-[3px] block text-xs text-muted-foreground">riley and jordan have revealed it</small>
          </span>
        </div>
        <div className={`absolute inset-0 grid content-start gap-1.5 ${pop(b >= 3)}`}>
          {(
            [
              ["riley", "called it"],
              ["jordan", "no way, not Gus"],
            ] as const
          ).map(([who, said]) => (
            <div key={who} className="flex items-end gap-1.5">
              <Face who={who} />
              <span className="rounded-[4px] bg-card px-2.5 py-[7px] text-[13px]">
                <b className="mb-0.5 block text-[11px] font-semibold text-muted-foreground">{who}</b>
                {said}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------- 7 · inside each show: its cast and stats, then the standings ----------

// 1: tap Bakers; 2: the stats; 3: tap Games; 4: the standings; 5: you climb
const SHOW = [LEAD, AFTER, BEAT + 600, AFTER, BEAT] as const;

function Rows({ rows }: { rows: { who: Person; name: string; pts: number; at: number }[] }) {
  return (
    <div className="relative h-[90px]">
      {rows.map((r) => (
        <div
          key={r.who}
          className={`absolute inset-x-0 flex h-[28px] items-center gap-2.5 rounded-[3px] px-2 transition-transform duration-500 ease-[cubic-bezier(.16,1,.3,1)] ${r.who === "you" ? "bg-secondary" : ""}`}
          style={{ transform: `translateY(${r.at * 31}px)` }}
        >
          <b className="type-num w-3.5 text-[18px] text-muted-foreground">{r.at + 1}</b>
          <Face who={r.who} size={18} />
          {/* "You", never your name: these tables are made up, and your real place is on Home beside them. */}
          <span className="flex-1 text-[13px] font-semibold">{r.who === "you" ? "You" : r.name}</span>
          <b className="type-num text-[18px]">{r.pts}</b>
        </div>
      ))}
    </div>
  );
}

function ShowScene({ go }: { go: boolean }) {
  const { b, root } = useBeats(SHOW, go, 2);
  const tab = b >= 4 ? 2 : b >= 2 ? 3 : 0;
  const climbed = b >= 5;
  const panel = (on: boolean) => `absolute inset-0 transition-opacity duration-300 ${on ? "opacity-100" : "pointer-events-none opacity-0"}`;
  return (
    <div className={`flex flex-col ${root}`} data-beat={b}>
      <div className="flex h-[26px] items-baseline gap-2">
        <b className="type-caption text-[17px]">Golden Crust</b>
        <small className="text-xs text-muted-foreground">Season 3</small>
      </div>
      <div className="relative mb-1.5 mt-1 flex-1">
        <div className={panel(tab === 0)}>
          <b className="type-caption block text-[22px]">Episode 6</b>
          <small className="text-xs text-muted-foreground">Wed 8:00 PM · in 3 days</small>
        </div>
        <div className={panel(tab === 3)}>
          <div className="mb-1.5 flex items-baseline justify-between">
            <b className="type-caption text-[15px]">Star baker</b>
            <small className="text-[11px] text-muted-foreground">Episodes 1–5</small>
          </div>
          {(
            [
              [BAKER.clive, "Clive", 2],
              [BAKER.jo, "Jo", 1],
              [BAKER.hana, "Hana", 1],
            ] as const
          ).map(([src, name, n]) => (
            <div key={name} className="flex h-[28px] items-center gap-2.5">
              {/* eslint-disable-next-line @next/next/no-img-element -- a tiny static picture from public/ */}
              <img src={src} alt="" className="size-[22px] rounded-[3px] object-cover" />
              <span className="w-12 text-[13px] font-semibold">{name}</span>
              <span className="h-2 rounded-[2px] bg-chart-4" style={{ width: n * 64 }} />
              <b className="type-num ml-auto text-[16px]">{n}</b>
            </div>
          ))}
        </div>
        <div className={panel(tab === 2)}>
          <div className="mb-1 flex items-center gap-2">
            <i className="size-2.5 rounded-[2px] bg-good" aria-hidden />
            <b className="type-caption text-[15px]">Survival Pool</b>
          </div>
          <Rows
            rows={[
              { who: "jordan", name: "jordan", pts: 21, at: 0 },
              { who: "riley", name: "riley", pts: 19, at: climbed ? 2 : 1 },
              { who: "you", name: "You", pts: climbed ? 20 : 18, at: climbed ? 1 : 2 },
            ]}
          />
        </div>
      </div>
      <Tabs on={tab} people="Bakers" tap={b === 1 ? 3 : b === 3 ? 2 : undefined} />
    </div>
  );
}

// ---------- 8 · Couch points: what you do lands as points; you take the lead ----------

const POINTS = [LEAD, 900, 900, 800] as const;
const EARNED = [
  [2, "Your pick for Episode 6"],
  [1, "A chat message"],
  [5, "Following Pluribus"],
] as const;

function PointsScene({ go }: { go: boolean }) {
  const { b, root } = useBeats(POINTS, go, POINTS.length);
  const mine = 126 + EARNED.slice(0, Math.min(b, 3)).reduce((n, [p]) => n + p, 0);
  const lead = b >= 4;
  const said = b >= 4 ? null : b >= 1 ? EARNED[b - 1] : null;
  return (
    <div className={`flex flex-col ${root}`} data-beat={b}>
      <div className="mb-2 flex items-baseline justify-between">
        <b className="type-caption text-[17px]">Power rankings</b>
        <small className="text-xs text-muted-foreground">Couch points</small>
      </div>
      <Rows
        rows={[
          { who: "riley", name: "riley", pts: 132, at: lead ? 1 : 0 },
          { who: "you", name: "You", pts: mine, at: lead ? 0 : 1 },
          { who: "jordan", name: "jordan", pts: 97, at: 2 },
        ]}
      />
      <div className="mt-2 h-7">
        {said ? (
          <span key={b} className="nd-tour-rise inline-flex h-7 items-center gap-1.5 rounded-[3px] bg-good/10 px-2.5 text-xs font-bold text-(--nd-good)">
            <span className="type-num text-[14px]">+{said[0]}</span>
            {said[1]}
          </span>
        ) : lead ? (
          <span key="lead" className="nd-tour-rise inline-flex h-7 items-center gap-1.5 text-[13px] font-bold">
            <ArrowUp className="size-4" aria-hidden /> Up a place
          </span>
        ) : null}
      </div>
    </div>
  );
}

// ---------- 9 · never miss a move: a lock screen, two nudges land (or, on an iPhone, the Home Screen first) ----------

// The first nudge is there from the start (the step asks for a decision: the picture explains at once); the second lands.
const REMIND = [LEAD] as const;

function Nudge({ title, body, when, on }: { title: string; body: string; when: string; on: boolean }) {
  return (
    <div className={`flex items-start gap-2.5 rounded-[14px] bg-white/[.14] px-3 py-2 ${pop(on)}`}>
      <span className="type-caption grid size-[30px] flex-none place-items-center rounded-[7px] bg-[#ffc531] text-[10px] text-[#121018]" aria-hidden>
        GYS
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex justify-between text-[11px] font-bold text-white/75">
          <span>GAME YOUR SHOW</span>
          <span>{when}</span>
        </span>
        <b className="block truncate text-[13px] leading-snug text-white">{title}</b>
        <span className="block truncate text-[12px] leading-snug text-white/85">{body}</span>
      </span>
    </div>
  );
}

function RemindScene({ go, reminders }: { go: boolean; reminders: TourReminders }) {
  const { b, root } = useBeats(REMIND, go, REMIND.length);
  if (reminders === "install")
    return (
      <div className="grid gap-2.5">
        {/* eslint-disable-next-line @next/next/no-img-element -- a static picture from public/, at its own size */}
        <img
          src={ADD_TO_HOME_ART}
          alt="1: in Safari, tap Share, the square with an arrow pointing up. 2: tap Add to Home Screen. 3: open Game Your Show from your Home Screen."
          className="block aspect-[372/120] w-full rounded-[6px]"
        />
        <ol className="grid grid-cols-3 gap-2" aria-hidden>
          {["Tap Share", "Add to Home Screen", "Open it from there"].map((s, i) => (
            <li key={s} className="flex items-start gap-1.5 text-[13px] font-bold leading-tight">
              <i className="grid size-5 flex-none place-items-center rounded-full bg-foreground text-[12px] not-italic text-background">{i + 1}</i>
              {s}
            </li>
          ))}
        </ol>
      </div>
    );
  return (
    <div className={`dark flex flex-col gap-2 overflow-hidden rounded-[6px] bg-[linear-gradient(160deg,#3a2f5a_0%,#1d1830_55%,#120f1c_100%)] px-3 pb-3 pt-2.5 ${root}`} data-beat={b}>
      <div className="text-center leading-none text-white">
        <div className="text-[40px] font-light tracking-[-.02em]">6:00</div>
        <div className="mt-1 text-[12px] font-semibold text-white/85">Wednesday, November 4</div>
      </div>
      <Nudge title="Survival Pool: episode 6 airs in about 2 hours" body="Make your episode 6 pick" when="now" on />
      <Nudge title="Episode 6 results are in" body="Reveal when you've watched" when="9:31 PM" on={b >= 1} />
    </div>
  );
}

/** Step `id`'s example. `go`: its light is on, so it plays. */
export function Scene({ id, go, reminders }: { id: StepId; go: boolean; reminders: TourReminders }) {
  switch (id) {
    case "couch":
      return <CouchScene go={go} />;
    case "add":
      return <AddScene go={go} />;
    case "theirs":
      return <TheirsScene go={go} />;
    case "invite":
      return <InviteScene go={go} />;
    case "move":
      return <MoveScene go={go} />;
    case "reveal":
      return <RevealScene go={go} />;
    case "show":
      return <ShowScene go={go} />;
    case "points":
      return <PointsScene go={go} />;
    case "remind":
      return <RemindScene go={go} reminders={reminders} />;
  }
}

/** The arrow on the plate's Next. */
export const NextArrow = () => <ChevronRight className="size-[18px]" strokeWidth={2.5} aria-hidden />;
