"use client";

import { useRef } from "react";
import { BookOpen, ChevronRight, CircleQuestionMark, Crown, Gavel, Shuffle, Trophy, Users, Zap } from "lucide-react";
import type { HowItWorks } from "@/lib/game/formats/rulebook-describe";
import { CAST, TRIBES } from "../fixtures/cast";
import { HOW } from "../fixtures/how-it-works";
import { PushedPage, usePushedPage } from "../ui/page";
import { Preview } from "../ui/preview";
import { ShowArt } from "../ui/show-bar";
import { Face, IconBox } from "./parts";

// How it works (the mock's rulebook.js howPage), for everyone: a page pushed over the show from its ⋯ menu and the
// Games tab (?page=how-it-works). It draws R1's view model (formats/rulebook-describe.js howItWorks): the premise,
// each episode as a rundown, the season as a cell per episode with its phases (future ones by their condition), who's
// playing, ways out, twists, what scores, and the rulebook's updates (later ones counted, never told). On a fixture
// behind Preview until step 1 serves it per season through the guard.

const STAKE: Record<string, string> = {
  reward: "text-chyron-line outline-chyron-line",
  safety: "text-good outline-good",
  goingHome: "text-live outline-live",
};

const DECIDED_ICON = (decided: string | null) => (/vote/i.test(decided ?? "") ? Users : /head/i.test(decided ?? "") ? Zap : /challenge/i.test(decided ?? "") ? Trophy : Gavel);

export function HowItWorksPage({ seasonId, name, seasonNumber, artUrl }: { seasonId: string; name: string; seasonNumber: number | null; artUrl: string | null }) {
  const how = usePushedPage("how-it-works");
  return (
    <PushedPage open={how.open} onClose={how.close} title="How it works" back={name.replace(/^The /, "")}>
      <Preview id="show.how-it-works" className="mx-2 mb-10 mt-3 pb-6">
        <HowBody how={HOW} seasonId={seasonId} name={name} seasonNumber={seasonNumber} artUrl={artUrl} />
      </Preview>
    </PushedPage>
  );
}

/** A section's heading; `jump`: the jump bar's key for it (the page scrolls to the heading). */
function Head({ jump, title, aside }: { jump?: string; title: string | null; aside?: string | null }) {
  return (
    <div data-jump-to={jump} className="mb-3 mt-[26px] flex scroll-mt-16 items-baseline justify-between gap-3 px-2">
      <h2 className="type-caption text-[24px]">{title}</h2>
      {aside && <span className="text-[13px] text-muted-foreground">{aside}</span>}
    </div>
  );
}

function HowBody({ how, seasonId, name, seasonNumber, artUrl }: { how: HowItWorks; seasonId: string; name: string; seasonNumber: number | null; artUrl: string | null }) {
  const top = useRef<HTMLDivElement>(null);
  const jump = (key: string) => {
    const el = top.current?.querySelector<HTMLElement>(`[data-jump-to="${key}"]`);
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const s = how.season;
  const short = name.replace(/^The /, "");
  return (
    <div ref={top}>
      {/* The show, its kind, and what it is in a line */}
      <section className="relative isolate flex min-h-[230px] flex-col justify-end overflow-hidden rounded-t-[4px] px-3 pb-3">
        <ShowArt seasonId={seasonId} artUrl={artUrl} name={name} className="absolute inset-0 -z-[2] size-full scale-105 blur-[3px] brightness-[.45]" />
        <span aria-hidden className="absolute inset-0 -z-[1] bg-[linear-gradient(180deg,transparent_40%,var(--background)_100%)]" />
        <h2 className="type-caption text-[56px] leading-[.9] [text-shadow:0_2px_20px_rgba(0,0,0,.5)]">
          {short}
          {seasonNumber ? ` ${seasonNumber}` : ""}
        </h2>
        <span className="mt-3 flex max-w-full items-stretch self-start">
          <span className="type-caption flex flex-none items-center gap-1.5 whitespace-nowrap bg-secondary py-1.5 pl-2.5 pr-5 text-sm tracking-[0.04em] [clip-path:polygon(0_0,100%_0,calc(100%_-_10px)_100%,0_100%)]">
            <Trophy className="size-4" aria-hidden />
            {how.kind.name}
          </span>
          {how.tagline && <span className="-ml-2 flex items-center rounded-r-[3px] bg-plate py-1.5 pl-4 pr-3 text-[15px] font-semibold text-plate-foreground">{how.tagline}</span>}
        </span>
      </section>
      {how.premise && <p className="px-2 pt-4 text-[17px] leading-relaxed">{how.premise}</p>}
      <nav aria-label="Jump to" className="mt-4 flex gap-2 overflow-x-auto px-2 [scrollbar-width:none]">
        {how.jump.map((j) => (
          <button
            key={j.key}
            type="button"
            data-try
            onClick={() => jump(j.key)}
            className="h-10 flex-none rounded-[3px] px-3 text-[15px] font-semibold text-muted-foreground outline-1 -outline-offset-1 outline-input"
          >
            {j.label}
          </button>
        ))}
      </nav>

      {/* Each episode, in order */}
      <Head jump="rundown" title={how.rundown.label} aside="In order" />
      <ol className="px-2">
        {how.rundown.segments.map((seg, i) => {
          const Icon = DECIDED_ICON(seg.decided);
          const last = i === how.rundown.segments.length - 1;
          return (
            <li key={seg.id} className="relative flex gap-3 pb-5">
              {!last && <span aria-hidden className="absolute left-[15px] top-8 h-[calc(100%-32px)] w-px bg-border" />}
              <span className="type-num grid size-8 flex-none place-items-center rounded-full text-base outline-1 -outline-offset-1 outline-input">{seg.n}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <b className="type-caption text-[22px] leading-tight">{seg.name}</b>
                  {seg.stake && (
                    <span className={`type-caption flex-none rounded-[2px] px-2 py-0.5 text-[12px] tracking-[0.08em] outline-1 -outline-offset-1 ${STAKE[seg.stake.key] ?? "text-muted-foreground outline-input"}`}>
                      {seg.stake.label}
                    </span>
                  )}
                </div>
                {seg.summary && <p className="mt-1 text-[15px] leading-snug text-muted-foreground">{seg.summary.replace(/\.$/, "")}</p>}
                {(seg.decided || seg.often) && (
                  <p className="mt-1.5 flex items-center gap-1.5 text-[13px] font-semibold text-muted-foreground">
                    <Icon className="size-4 flex-none" aria-hidden />
                    {[seg.decided, seg.often].filter(Boolean).join(" · ")}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      {/* The season: a cell per episode, then its phases */}
      <Head jump="season" title={s.label} aside={s.total ? `${s.total} ${s.unit.toLowerCase()}s` : null} />
      <div className="px-2">
        {s.cells.length > 0 && (
          <>
            <div className="flex gap-[3px]" role="img" aria-label={`${s.unit} ${s.you ?? 0} of ${s.total}`}>
              {s.cells.map((c) => (
                <i
                  key={c.n}
                  className={`h-[30px] flex-1 rounded-[2px] ${
                    c.seen ? "bg-foreground" : c.next ? "outline-2 -outline-offset-2 outline-foreground" : c.finale ? "bg-chyron-line/25 outline-1 -outline-offset-1 outline-chyron-line" : "bg-card"
                  }`}
                />
              ))}
            </div>
            <div className="mt-2 flex justify-between text-[13px] text-muted-foreground">
              <span>
                {s.unit} 1
              </span>
              {s.you ? (
                <b className="text-foreground">
                  You · {s.unit} {s.you}
                </b>
              ) : null}
              <span>
                {s.unit} {s.total}
              </span>
            </div>
          </>
        )}
        <div className="mt-3 flex items-start gap-1.5">
          {s.phases.map((p, i) => (
            <div key={p.id} className="flex min-w-0 flex-1 items-start gap-1.5">
              {i > 0 && <ChevronRight className="mt-1 size-4 flex-none text-muted-foreground" aria-hidden />}
              <div className="min-w-0">
                <b className={`type-caption block text-[19px] ${p.started ? "" : "text-muted-foreground"}`}>{p.name}</b>
                <small className="block text-[13px] leading-tight text-muted-foreground">{p.when}</small>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Who's playing */}
      <Head jump="who" title={how.who.label} aside={/^\d+ \S+/.exec(how.who.line)?.[0].replace(/,$/, "") ?? null} />
      <div className="px-2">
        <div className="grid grid-cols-6 gap-1.5">
          {CAST.map((c) => (
            <span key={c.name} className="overflow-hidden rounded-[2px] border-b-[3px]" style={{ borderBottomColor: TRIBES[c.start] }}>
              <Face src={c.photo} className="aspect-square w-full" />
            </span>
          ))}
        </div>
        <p className="mt-2.5 text-[15px] leading-snug text-muted-foreground">{[how.who.line, how.who.groups].filter(Boolean).join(" ")}</p>
      </div>

      {/* Ways out, twists */}
      {how.waysOut && (
        <>
          <Head title={how.waysOut.label} />
          <div className="flex flex-wrap gap-2 px-2">
            {how.waysOut.out.map((w) => (
              <span key={w.id} className="rounded-[3px] bg-card px-3 py-2 text-[15px] font-semibold">
                {w.name}
              </span>
            ))}
          </div>
          {how.waysOut.end && (
            <p className="mt-3 flex items-start gap-2 px-2 text-[15px] leading-snug">
              <Crown className="mt-0.5 size-[18px] flex-none text-chyron-line" aria-hidden />
              {how.waysOut.end}
            </p>
          )}
        </>
      )}
      {how.twists && (
        <>
          <Head title={how.twists.label} />
          <div className="px-2">
            {how.twists.items.map((t) => (
              <div key={t.id} className="flex items-start gap-3 border-t border-border py-3">
                <IconBox icon={Shuffle} />
                <span className="min-w-0 flex-1">
                  <b className="block text-[16px]">{t.name}</b>
                  <small className="block text-[14px] leading-snug text-muted-foreground">{t.line}</small>
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* What scores */}
      <Head jump="points" title={how.points.label} aside={how.points.aside} />
      <div className="px-2">
        {how.points.groups.map((g) => (
          <div key={g.id} className="mb-2">
            <p className="type-caption border-b border-border pb-2 pt-3 text-[13px] tracking-[0.04em] text-muted-foreground">{g.label}</p>
            {g.items.map((it) => (
              <div key={it.id} className="flex min-h-11 items-center justify-between gap-3 border-b border-border py-1.5">
                <span className="text-[15px]">{it.label}</span>
                {it.points != null && (
                  <b className={`type-num flex-none text-[22px] ${it.points > 0 ? "text-good" : it.points < 0 ? "text-live" : "text-muted-foreground"}`}>
                    {it.points > 0 ? `+${it.points}` : it.points < 0 ? `−${Math.abs(it.points)}` : "0"}
                  </b>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Updates: what changed, as far as you've seen */}
      {(how.updates.shown.length > 0 || how.updates.hidden) && (
        <>
          <Head title="Updates" />
          <div className="px-2">
            {how.updates.shown.map((u) => (
              <div key={`${u.episode}-${u.title}`} className="flex items-start gap-4 border-t border-border py-3">
                <span className="w-9 flex-none text-center">
                  <small className="type-caption block text-[11px] text-muted-foreground">Ep</small>
                  <b className="type-num text-[26px] leading-none">{u.episode}</b>
                </span>
                <span className="min-w-0 flex-1">
                  <b className="block text-[16px]">{u.title}</b>
                  <small className="block text-[14px] leading-snug text-muted-foreground">{u.detail}</small>
                </span>
                {u.tag && <span className="type-caption rounded-[2px] bg-good px-2 py-0.5 text-[12px] tracking-[0.08em] text-good-foreground">{u.tag}</span>}
              </div>
            ))}
            {how.updates.hidden && (
              <div className="flex items-start gap-4 border-t border-border py-3 text-muted-foreground">
                <span className="w-9 flex-none text-center">
                  <small className="type-caption block text-[11px]">Ep</small>
                  <b className="type-num text-[26px] leading-none">{how.updates.hidden.from}</b>
                </span>
                <span className="min-w-0 flex-1">
                  <b className="block text-[16px]">{how.updates.hidden.title}</b>
                  <small className="block text-[14px] leading-snug">{how.updates.hidden.detail}</small>
                </span>
              </div>
            )}
          </div>
        </>
      )}

      {how.lineage && (
        <p className="mt-6 flex items-start gap-2 px-2 text-[14px] leading-snug text-muted-foreground">
          <BookOpen className="mt-0.5 size-4 flex-none" aria-hidden />
          {how.lineage}
        </p>
      )}
      <div className="px-2">
        <button
          type="button"
          className="mt-3 flex h-12 w-full items-center gap-2 rounded-[3px] px-3 text-[15px] font-semibold text-muted-foreground outline-1 -outline-offset-1 outline-input"
        >
          <CircleQuestionMark className="size-[18px]" aria-hidden />
          Something off? Suggest a fix
        </button>
      </div>
    </div>
  );
}
