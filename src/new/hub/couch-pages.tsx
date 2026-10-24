"use client";

import type { ReactNode } from "react";
import {
  ChartColumn,
  ChevronRight,
  CircleQuestionMark,
  Crown,
  Grid3x3,
  Plus,
  Repeat,
  Shield,
  ShieldCheck,
  Star,
  Trophy,
  Tv,
  Zap,
  type LucideIcon,
} from "lucide-react";
import {
  PLAYING,
  PREVIOUSLY,
  RANKINGS,
  RANKING_SHOWS,
  SHOW_COLOUR,
  STAT_DECK,
  STAT_LISTS,
  THIS_WEEK,
  TROPHIES,
  VERDICTS,
} from "../fixtures/hub";
import { GAME_STYLE, ordinal } from "../games";
import type { PreviewId } from "../preview";
import { PushedPage, usePushedPage } from "../ui/page";
import { Row, SectionHead } from "../ui/parts";
import { Preview } from "../ui/preview";
import { DemoAvatar } from "./sections";

// More on the couch (the mock's refine.js and couchpages.js): six rows on the hub, each opening a page pushed over it
// (?page=), so the back gesture closes it. The pages are on fixtures until step 8 (Hub I).

const PAGES = {
  rankings: { title: "Power rankings", line: "Where everyone stands this year", icon: Trophy, preview: "hub.rankings" },
  break: { title: "Commercial break", line: "Every game on the couch · join any", icon: Zap, preview: "hub.break" },
  numbers: { title: "By the numbers", line: "Cast stats and couch accolades", icon: ChartColumn, preview: "hub.numbers" },
  verdicts: { title: "Couch verdicts", line: "How the couch rated each episode", icon: Star, preview: "hub.verdicts" },
  previously: { title: "Previously on", line: "Spoiler-safe recaps", icon: Tv, preview: "hub.previously" },
  trophies: { title: "Trophy shelf", line: "Every season the couch has finished", icon: Crown, preview: "hub.trophies" },
} as const satisfies Record<string, { title: string; line: string; icon: LucideIcon; preview: PreviewId }>;
type PageKey = keyof typeof PAGES;
const KEYS = Object.keys(PAGES) as PageKey[];

function MoreRow({ k }: { k: PageKey }) {
  const page = usePushedPage(k);
  const p = PAGES[k];
  return <Row icon={p.icon} title={p.title} detail={p.line} onClick={page.show} />;
}

export function MoreOnTheCouch() {
  return (
    <section className="mt-8">
      <SectionHead title="More on the couch" aside="When you want it" />
      <div className="flex flex-col border-b border-border px-4">
        {KEYS.map((k) => (
          <MoreRow key={k} k={k} />
        ))}
      </div>
    </section>
  );
}

function CouchPage({ k, children }: { k: PageKey; children: ReactNode }) {
  const page = usePushedPage(k);
  return (
    <PushedPage open={page.open} onClose={page.close} title={PAGES[k].title} back="Home">
      <Preview id={PAGES[k].preview} className="mx-2 mb-10 mt-3">
        <div className="pb-4">{children}</div>
      </Preview>
    </PushedPage>
  );
}

/** The six pages, mounted with the hub (each opens over it). */
export function CouchPages() {
  return (
    <>
      <CouchPage k="rankings">
        <Rankings />
      </CouchPage>
      <CouchPage k="break">
        <CommercialBreak />
      </CouchPage>
      <CouchPage k="numbers">
        <ByTheNumbers />
      </CouchPage>
      <CouchPage k="verdicts">
        <Verdicts />
      </CouchPage>
      <CouchPage k="previously">
        <PreviouslyOn />
      </CouchPage>
      <CouchPage k="trophies">
        <TrophyShelf />
      </CouchPage>
    </>
  );
}

// ---------- shared ----------

function BigHero({ big, label, line }: { big: ReactNode; label: string; line: string }) {
  return (
    <section className="flex items-end gap-3.5 px-3 pb-1.5 pt-5">
      <b className="type-num text-[112px] leading-[.78] tracking-[-0.01em]">{big}</b>
      <div>
        <span className="type-caption block text-sm tracking-[0.06em] text-muted-foreground">{label}</span>
        <p className="mt-1.5 max-w-[28ch] text-[15px] leading-snug">{line}</p>
      </div>
    </section>
  );
}

function SpoilerSafe() {
  return (
    <div className="mx-3 mt-3.5 flex items-center gap-2 rounded-[3px] bg-good/10 px-3 py-[9px] text-[13px]">
      <ShieldCheck className="size-[15px] flex-none text-good" aria-hidden />
      <span>
        <b className="text-good">Spoiler-safe</b> · up to where you are in each show
      </span>
    </div>
  );
}

function How({ icon: Icon, lead, children }: { icon: LucideIcon; lead: string; children: ReactNode }) {
  return (
    <div className="mx-3 mt-6 flex items-start gap-3 rounded-[4px] bg-card p-3.5">
      <Icon className="mt-0.5 size-5 flex-none text-muted-foreground" aria-hidden />
      <p className="text-sm leading-normal text-muted-foreground">
        <b className="text-foreground">{lead}</b> {children}
      </p>
    </div>
  );
}

// ---------- Power rankings ----------

function Rankings() {
  const rows = [...RANKINGS].map((r) => ({ ...r, total: r.points.reduce((a, b) => a + b, 0) })).sort((a, b) => b.total - a.total);
  const me = rows.findIndex((r) => r.who === "alex");
  const max = rows[0].total;
  return (
    <>
      <BigHero big={ordinal(me + 1)} label={`This year · of ${rows.length}`} line={`${rows[0].total - rows[me].total} back of ${rows[0].who}. A good Wednesday puts you level.`} />
      <div className="mx-3 mb-1 mt-4 grid grid-cols-3 gap-1 rounded-[3px] bg-card p-1">
        {["This year", "All-time", "Head to head"].map((t, i) => (
          <span key={t} className={`grid h-9 place-items-center rounded-[2px] text-sm font-semibold ${i ? "text-muted-foreground" : "bg-foreground text-background"}`}>
            {t}
          </span>
        ))}
      </div>
      <div className="px-3">
        {rows.map((r, i) => {
          const mine = r.who === "alex";
          return (
            <div key={r.who} className={`flex h-[58px] items-center gap-3 ${mine ? "-mx-2 rounded-[3px] bg-plate px-2 text-plate-foreground" : ""}`}>
              <span className={`type-num w-5 text-[22px] ${i === 0 || mine ? "" : "text-muted-foreground"}`}>{i + 1}</span>
              <DemoAvatar who={r.who} size={30} />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5 text-[15px] font-semibold">
                  {r.who}
                  {mine && <span className="type-caption rounded-[2px] bg-plate-foreground px-1.5 py-0.5 text-[10px] text-plate">You</span>}
                  {r.move && <span className={`ml-auto text-xs ${r.move === "up" ? "text-good" : "text-muted-foreground"}`}>{r.move === "up" ? "▲" : "▼"}</span>}
                </span>
                <span className="mt-1.5 flex h-1 overflow-hidden rounded-full" style={{ width: `${(r.total / max) * 100}%` }}>
                  {r.points.map((p, k) => (
                    <i key={k} className="block h-full" style={{ width: `${(p / r.total) * 100}%`, background: SHOW_COLOUR[RANKING_SHOWS[k]] }} />
                  ))}
                </span>
              </span>
              <b className="type-num text-[24px]">{r.total}</b>
            </div>
          );
        })}
        <div className="mt-3 flex gap-3.5 text-xs text-muted-foreground">
          {RANKING_SHOWS.map((s) => (
            <span key={s} className="flex items-center gap-1.5">
              <i className="size-2.5 rounded-[2px]" style={{ background: SHOW_COLOUR[s] }} aria-hidden />
              {s}
            </span>
          ))}
        </div>
      </div>
      <How icon={Trophy} lead="One table for every game on the couch.">
        Each game you finish adds points by where you placed, so a Survivor title and a Traitors pool both count. The bar shows where your points came from.
      </How>
    </>
  );
}

// ---------- Commercial break ----------

const EP_ICON = { bingo: Grid3x3, poll: ChartColumn, quiz: CircleQuestionMark };

function CommercialBreak() {
  return (
    <>
      <section className="relative mb-1 flex h-[190px] items-end">
        <span className="absolute inset-0 grid grid-cols-7" aria-hidden>
          {["#f4f2f8", "#e0b23a", "#35b5a5", "#a76bb0", "#f2545b", "#5089c9", "#f2804b"].map((c) => (
            <i key={c} style={{ background: c }} />
          ))}
        </span>
        <div className="relative mx-3 mb-4 rounded-[3px] bg-plate px-3.5 py-2.5 text-plate-foreground shadow-plate">
          <b className="type-caption block text-[34px]">Commercial break</b>
          <small className="mt-1 block text-[13px] text-plate-muted">Every game on the couch. Join any, or none.</small>
        </div>
      </section>
      <section className="mt-6 px-3">
        <SectionHead title="You're playing" aside={`${PLAYING.length} games`} flush />
        {PLAYING.map((g) => (
          <div key={g.game + g.show} className="flex min-h-[72px] items-center gap-3 border-t border-border last:border-b">
            {/* eslint-disable-next-line @next/next/no-img-element -- fixture art from the published mock */}
            <img src={g.art} alt="" className="size-[54px] flex-none rounded-[3px] object-cover" style={{ objectPosition: g.position }} />
            <span className="min-w-0 flex-1">
              <span className="type-caption text-xs tracking-[0.05em]" style={{ color: GAME_STYLE[g.game].colour }}>
                {g.game}
              </span>
              <b className="mt-[3px] block text-base">{g.show}</b>
              <small className="mt-0.5 block text-[12.5px] text-muted-foreground">{g.line}</small>
            </span>
            {g.due ? (
              <span className="type-caption flex-none bg-chyron py-[5px] pl-2 pr-3.5 text-xs tracking-[0.06em] text-chyron-foreground [clip-path:polygon(0_0,100%_0,calc(100%_-_8px)_100%,0_100%)]">
                {g.due}
              </span>
            ) : (
              <b className="type-num text-[30px]">{g.place}</b>
            )}
          </div>
        ))}
      </section>
      <section className="mt-6 px-3">
        <SectionHead title="This week only" aside="One night each" flush />
        <div className="grid grid-cols-2 gap-2">
          {THIS_WEEK.map((e) => {
            const Icon = EP_ICON[e.icon];
            return (
              <div key={e.title} className="relative isolate flex aspect-[1/1.05] flex-col justify-end overflow-hidden rounded-[4px] p-2.5 text-white">
                {/* eslint-disable-next-line @next/next/no-img-element -- fixture art from the published mock */}
                <img src={e.art} alt="" className="absolute inset-0 -z-[2] size-full object-cover" style={{ objectPosition: e.position }} />
                <span aria-hidden className="absolute inset-0 -z-[1] bg-[linear-gradient(180deg,rgba(16,14,21,.2),rgba(16,14,21,.92)_70%)]" />
                <span className="absolute left-2.5 top-2.5 grid size-[34px] place-items-center rounded-[3px] bg-plate text-plate-foreground">
                  <Icon className="size-[18px]" aria-hidden />
                </span>
                <b className="type-caption text-[19px] leading-none">{e.title}</b>
                <small className="mt-1 text-xs opacity-85">{e.line}</small>
              </div>
            );
          })}
        </div>
        <div className="mt-6 flex items-center gap-3 rounded-[4px] p-4 outline-[1.5px] -outline-offset-[1.5px] outline-dashed outline-input">
          <Plus className="size-6 flex-none" aria-hidden />
          <span>
            <b className="block text-base">Start a game</b>
            <small className="mt-0.5 block text-[13px] text-muted-foreground">A season game, bingo, a poll or trivia. Anyone on the couch can.</small>
          </span>
        </div>
      </section>
    </>
  );
}

// ---------- By the numbers ----------

function ByTheNumbers() {
  return (
    <>
      <SpoilerSafe />
      <div className="flex snap-x snap-mandatory gap-2.5 overflow-x-auto px-3 pb-1 pt-3.5 [scrollbar-width:none]">
        {STAT_DECK.map((c) => (
          <div key={c.stat} className="relative aspect-[3/3.7] w-[calc(100%-44px)] flex-none snap-center overflow-hidden rounded-[4px] bg-card text-white shadow-[0_14px_34px_rgba(0,0,0,.45)]">
            {"couch" in c ? (
              <span className="absolute inset-x-0 bottom-[86px] top-0 grid place-items-center bg-[linear-gradient(160deg,var(--secondary),var(--background))] text-muted-foreground">
                <Crown className="size-[88px]" strokeWidth={1.2} aria-hidden />
              </span>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element -- fixture photo from the published mock
              <img src={c.photo} alt="" className="absolute inset-0 size-full object-cover [object-position:center_20%]" />
            )}
            <span className="absolute left-2.5 top-2.5 flex items-center gap-1.5 rounded-[3px] bg-[rgba(16,14,21,.75)] py-1 pl-1 pr-2 text-xs font-bold">
              {"couch" in c ? (
                "On the couch"
              ) : (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element -- fixture art from the published mock */}
                  <img src={c.showArt} alt="" className="size-[22px] rounded-[2px] object-cover" />
                  {c.show}
                </>
              )}
            </span>
            <span className="type-caption absolute bottom-[86px] left-0 max-w-[92%] bg-secondary py-[7px] pl-3 pr-[22px] text-[15px] tracking-[0.05em] [clip-path:polygon(0_0,100%_0,calc(100%_-_12px)_100%,0_100%)]">
              {c.stat}
            </span>
            <span className="absolute inset-x-0 bottom-0 flex min-h-[86px] items-end gap-3 bg-plate px-3.5 py-2.5 text-plate-foreground">
              <span className="min-w-0 flex-1">
                <b className="type-caption block text-[32px] leading-none">{c.who}</b>
                <small className="mt-1 block text-[13px] text-plate-muted">{"couch" in c ? c.line : `${c.unit} · see everyone`}</small>
              </span>
              {!("couch" in c) && <span className="type-num text-[64px] leading-[.8]">{c.n}</span>}
            </span>
          </div>
        ))}
      </div>
      {STAT_LISTS.map((s) => (
        <section key={s.show} className="mt-6 px-3">
          <SectionHead title={s.show} aside={`Up to Ep ${s.upTo}`} flush />
          {s.rows.map((r) => (
            <div key={r.stat} className="flex min-h-[58px] items-center gap-3 border-t border-border">
              {/* eslint-disable-next-line @next/next/no-img-element -- fixture photo from the published mock */}
              <img src={r.photo} alt="" className="size-[38px] rounded-[3px] object-cover [object-position:center_20%]" />
              <span className="min-w-0 flex-1">
                <b className="block text-[15px]">{r.stat}</b>
                <small className="block text-[12.5px] text-muted-foreground">{r.who} leads</small>
              </span>
              <b className="type-num text-[24px]">{r.n}</b>
              <ChevronRight className="size-5 text-muted-foreground" aria-hidden />
            </div>
          ))}
        </section>
      ))}
    </>
  );
}

// ---------- Couch verdicts ----------

function Verdicts() {
  return (
    <>
      <SpoilerSafe />
      {VERDICTS.map((v) => (
        <section key={v.show} className="mx-3 mt-[22px] border-b border-border pb-5">
          <div className="relative isolate flex min-h-[150px] items-end overflow-hidden rounded-[4px] p-3">
            {/* eslint-disable-next-line @next/next/no-img-element -- fixture art from the published mock */}
            <img src={v.art} alt="" className="absolute inset-0 -z-[2] size-full object-cover" style={{ objectPosition: v.position }} />
            <span aria-hidden className="absolute inset-0 -z-[1] bg-[linear-gradient(90deg,rgba(16,14,21,.95)_35%,rgba(16,14,21,.2))]" />
            <div>
              <span className="type-caption block text-[13px] tracking-[0.06em] text-muted-foreground">
                {v.show} · Episode {v.episode}
              </span>
              <b className="type-num mt-1.5 block text-[84px] leading-[.78]">{v.score}</b>
              <small className="mt-1 block text-[13px] text-muted-foreground">★ couch rating · from {v.from}</small>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-3.5 gap-y-2.5">
            <span className="flex items-center gap-1.5">
              <DemoAvatar who="alex" size={30} />
              <span className="flex h-[30px] items-center rounded-[3px] px-2.5 text-[13px] font-bold outline-1 -outline-offset-1 outline-input">Rate</span>
            </span>
            {v.ratings.map(([who, r]) => (
              <span key={who} className="flex items-center gap-1.5">
                <DemoAvatar who={who} size={30} />
                <b className="type-num text-[17px]">★ {r}</b>
              </span>
            ))}
          </div>
          <div className="mt-3 flex min-h-12 items-stretch overflow-hidden rounded-[3px] bg-plate text-plate-foreground shadow-plate">
            <span className="type-caption -mr-[13px] flex items-center bg-secondary py-0 pl-[11px] pr-[22px] text-[13px] text-foreground [clip-path:polygon(0_0,100%_0,calc(100%_-_13px)_100%,0_100%)]">
              {v.take.who}
            </span>
            <span className="flex flex-1 items-center py-2 pl-5 pr-2.5 text-sm">&ldquo;{v.take.text}&rdquo;</span>
          </div>
          <div className="mt-3.5 flex h-16 items-end gap-1.5" aria-label="Couch rating by episode">
            {v.byEpisode.map((r, i) => (
              <span key={i} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                <i className={`block min-h-1 w-full rounded-t-[2px] ${i === v.byEpisode.length - 1 ? "bg-foreground" : "bg-input"}`} style={{ height: `${(r - 3) * 40}%` }} />
                <small className="text-[11px] text-muted-foreground">{v.episode - v.byEpisode.length + i + 1}</small>
              </span>
            ))}
          </div>
        </section>
      ))}
      <How icon={Star} lead="Taste twin: riley.">
        You two rate within half a star 8 times in 10. jordan rates a star off the couch most weeks.
      </How>
    </>
  );
}

// ---------- Previously on ----------

function PreviouslyOn() {
  const p = PREVIOUSLY;
  const still = p.stillIn.reduce((n, g) => n + g.people.length, 0);
  return (
    <>
      <div className="flex gap-2 overflow-x-auto px-3 pb-0.5 pt-3 [scrollbar-width:none]">
        {p.shows.map((s, i) => (
          <span key={s.name} className={`flex h-11 flex-none items-center gap-2 rounded-[3px] pl-1 pr-3 text-sm font-bold ${i ? "bg-card text-muted-foreground" : "bg-foreground text-background"}`}>
            {/* eslint-disable-next-line @next/next/no-img-element -- fixture art from the published mock */}
            <img src={s.art} alt="" className="size-9 rounded-[2px] object-cover" style={{ objectPosition: s.position }} />
            {s.name}
          </span>
        ))}
      </div>
      <section className="relative isolate mx-3 mt-3 flex h-[210px] flex-col justify-end overflow-hidden rounded-[4px] p-3.5">
        {/* eslint-disable-next-line @next/next/no-img-element -- fixture art from the published mock */}
        <img src={p.art} alt="" className="absolute inset-0 -z-[2] size-full object-cover" />
        <span aria-hidden className="absolute inset-0 -z-[1] bg-[linear-gradient(180deg,rgba(16,14,21,.15),rgba(16,14,21,.92)_78%)]" />
        <span className="absolute left-3 top-3 flex items-center gap-1.5 rounded-[3px] bg-[rgba(16,14,21,.8)] px-[9px] py-[5px] text-xs font-semibold">
          <Shield className="size-3.5 text-good" aria-hidden />
          Up to Episode {p.upTo} · nothing past it
        </span>
        <b className="type-caption block text-[52px] leading-[.85]">Previously on</b>
        <span className="type-caption mt-2 block text-[24px]">{p.shows[0].name}</span>
      </section>
      <section className="mt-6 px-3">
        <SectionHead title="Last time" aside={`Episode ${p.upTo}`} flush />
        {p.lastTime.map((c) => (
          <div key={c.name} className="relative aspect-[4/3.6] overflow-hidden rounded-[4px] shadow-[0_14px_34px_rgba(0,0,0,.45)]">
            {/* eslint-disable-next-line @next/next/no-img-element -- fixture photo from the published mock */}
            <img src={c.photo} alt="" className="absolute inset-0 size-full object-cover [filter:grayscale(.2)] [object-position:center_20%]" />
            <span className="type-caption absolute bottom-[70px] left-0 bg-live py-1.5 pl-2.5 pr-5 text-sm tracking-[0.05em] text-live-foreground [clip-path:polygon(0_0,100%_0,calc(100%_-_10px)_100%,0_100%)]">
              {c.how} · Ep {p.upTo}
            </span>
            <span className="absolute inset-x-0 bottom-0 min-h-[70px] bg-plate px-3 py-2.5 text-plate-foreground">
              <b className="type-caption block text-[30px] leading-none">{c.name}</b>
              <small className="mt-1 block text-[12.5px] text-plate-muted">Finished {c.place}</small>
            </span>
          </div>
        ))}
      </section>
      <section className="mt-6 px-3">
        <SectionHead title="The story so far" aside={`${p.gone.length} gone · ${still} still in`} flush />
        <div className="flex gap-1.5 overflow-x-auto [scrollbar-width:none]">
          {p.gone.map((c, i) => (
            <span key={c.name} className="flex w-16 flex-none flex-col gap-1 text-center">
              {/* eslint-disable-next-line @next/next/no-img-element -- fixture photo from the published mock */}
              <img
                src={c.photo}
                alt=""
                className={`aspect-square w-full rounded-[3px] object-cover [object-position:center_20%] ${i === p.gone.length - 1 ? "outline-2 -outline-offset-2 outline-live" : "[filter:grayscale(1)]"}`}
              />
              <b className="text-xs">{c.name}</b>
              <small className="type-caption text-[10px] text-muted-foreground">Ep {c.ep}</small>
            </span>
          ))}
        </div>
      </section>
      <section className="mt-6 px-3">
        <SectionHead title="Still in" aside="By tribe" flush />
        {p.stillIn.map((g) => (
          <div key={g.group} className="mb-3">
            <span className="mb-1.5 flex items-center gap-2">
              <i className="size-2.5 rounded-[2px]" style={{ background: g.colour }} aria-hidden />
              <b className="type-caption text-[15px]">{g.group}</b>
              <small className="text-xs text-muted-foreground">{g.people.length}</small>
            </span>
            <div className="grid grid-cols-6 gap-1.5">
              {g.people.map((c) => (
                <span key={c.name} className="flex flex-col items-center gap-1">
                  {/* eslint-disable-next-line @next/next/no-img-element -- fixture photo from the published mock */}
                  <img src={c.photo} alt="" className="aspect-square w-full rounded-[3px] object-cover [object-position:center_20%]" />
                  <small className="text-[11px]">{c.name}</small>
                </span>
              ))}
            </div>
          </div>
        ))}
      </section>
      <section className="mt-6 px-3">
        <SectionHead title="Episode by episode" flush />
        {p.episodes.map((e) => (
          <div key={e.ep} className="flex min-h-14 items-center gap-3 border-t border-border">
            <b className="type-num w-6 text-[26px] text-muted-foreground">{e.ep}</b>
            <span className="flex">
              {e.faces.map((f) => (
                // eslint-disable-next-line @next/next/no-img-element -- fixture photo from the published mock
                <img key={f} src={f} alt="" className="size-9 rounded-[3px] object-cover [filter:grayscale(1)] [object-position:center_20%]" />
              ))}
            </span>
            <span className="flex-1 text-[15px]">{e.line}</span>
            <ChevronRight className="size-5 text-muted-foreground" aria-hidden />
          </div>
        ))}
      </section>
    </>
  );
}

// ---------- Trophy shelf ----------

const RECORD_ICON = { crown: Crown, repeat: Repeat, shield: Shield, bolt: Zap };

function TrophyShelf() {
  const t = TROPHIES;
  return (
    <>
      <BigHero big={t.titles} label={`Titles · ${t.seasons} seasons played`} line={t.line} />
      <section className="mt-6 px-3">
        <SectionHead title="Recent seasons" flush />
        <div className="grid grid-cols-2 gap-2.5">
          {t.plaques.map((p) => (
            <div key={p.show} className={`relative flex flex-col gap-[3px] overflow-hidden rounded-[4px] bg-card p-2.5 ${p.won ? "outline-[1.5px] -outline-offset-[1.5px] outline-[#e0b23a]" : ""}`}>
              {/* eslint-disable-next-line @next/next/no-img-element -- fixture art from the published mock */}
              <img src={p.art} alt="" className={`mb-1.5 h-[74px] w-full rounded-[3px] object-cover ${p.won ? "" : "[filter:saturate(.6)_brightness(.8)]"}`} />
              <span className={`type-num text-[40px] leading-[.9] ${p.won ? "text-[#e0b23a]" : ""}`}>{p.place}</span>
              <b className="type-caption text-base">{p.show}</b>
              <small className="text-[12.5px] text-muted-foreground">{p.line}</small>
              {p.ribbon && <span className="type-caption mt-1 self-start rounded-[2px] bg-secondary px-[7px] py-[3px] text-[11px] tracking-[0.06em]">{p.ribbon}</span>}
            </div>
          ))}
        </div>
      </section>
      <section className="mt-6 px-3">
        <SectionHead title="Couch records" flush />
        {t.records.map((r) => {
          const Icon = RECORD_ICON[r.icon];
          return (
            <div key={r.title} className="flex min-h-[58px] items-center gap-3 border-t border-border">
              <span className="grid size-9 flex-none place-items-center rounded-[3px] bg-card">
                <Icon className="size-[18px]" aria-hidden />
              </span>
              <span className="flex-1">
                <b className="block text-[15px]">{r.title}</b>
                <small className="block text-[12.5px] text-muted-foreground">{r.line}</small>
              </span>
              <DemoAvatar who={r.who} size={30} />
            </div>
          );
        })}
      </section>
    </>
  );
}
