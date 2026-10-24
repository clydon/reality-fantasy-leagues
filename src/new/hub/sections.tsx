"use client";

import { ChevronRight, Crown, Eye, Flame, Laugh, Link2, Plus, Tv, Trophy, ChartColumn, type LucideIcon } from "lucide-react";
import { airTime, calmWhen, ticks } from "../clock";
import type { Couch, Home, HomeShow, Move } from "../data";
import { COUCH_PROGRESS } from "../fixtures/moves";
import { FEED, GROW_NOTE, TYPING, type ReactKind } from "../fixtures/hub";
import { GET_GOING } from "../fixtures/couches";
import { ON_NOW } from "../fixtures/watch-along";
import { COUCH_WATCHING, NUDGE } from "../fixtures/watching";
import { PEOPLE, type Demo } from "../fixtures/people";
import { NavLink } from "../nav";
import { paths } from "../routes";
import { Avatar, useNow } from "../ui/bars";
import { Btn, SectionHead } from "../ui/parts";
import { Preview } from "../ui/preview";
import { ShowArt } from "../ui/show-bar";

// The hub's sections (the mock's index.html hub, refine.js wireHub, hubplus.js, watching.js, fresh.js), in the order
// screens/home.tsx lays them out. Real where it's free (your shows, their art and schedule, your moves); the rest on
// fixtures inside <Preview>, each with the step that makes it real.

/** A demo person's square, in the mock's colour. */
export function DemoAvatar({ who, size = 24 }: { who: Demo; size?: number }) {
  return <Avatar id={who} name={who} size={size} colour={PEOPLE[who]} />;
}

/** Faces in a row, overlapping (the mock's .stack). */
export function Faces({ who, size = 24 }: { who: Demo[]; size?: number }) {
  return (
    <span className="flex">
      {who.map((p, i) => (
        <span key={p} className={`rounded-[3px] shadow-[0_0_0_2px_var(--background)] ${i ? "-ml-1.5" : ""}`}>
          <DemoAvatar who={p} size={size} />
        </span>
      ))}
    </span>
  );
}

// ---------- your moves, in words ----------

const MOVE_TAG: Record<string, string> = {
  lineup: "Lineup",
  pick: "Pick",
  prediction: "Predict",
  pickup: "Waivers",
  draftTurn: "Draft",
  blindDraft: "Draft",
  lateJoin: "Start",
  results: "Results",
  invite: "Invite",
};

/** The show a move is for (a league on one of your shows), if any. */
export function showOfMove(home: Home, m: Move): HomeShow | undefined {
  return home.shows.find((s) => s.games.some((g) => g.leagueId === m.leagueId));
}

/** "your Survivor lineup locks Wed 8:05 PM", from the move and its show. */
function moveLine(m: Move, show?: HomeShow) {
  const name = show?.show.name.replace(/^The /, "") ?? m.leagueName;
  const when = m.deadline ? airTime(Date.parse(m.deadline)) : null;
  if (m.kind === "lineup") return `your ${name} lineup ${when ? `locks ${when}` : "is due"}`;
  if (m.kind === "pick") return `your ${name} pick ${when ? `locks ${when}` : "is due"}`;
  if (m.kind === "prediction") return `your ${name} prediction ${when ? `closes ${when}` : "is due"}`;
  if (m.kind === "pickup") return `${name} waivers ${when ? `close ${when}` : "are open"}`;
  return m.text.charAt(0).toLowerCase() + m.text.slice(1);
}

/** Moves in the order they're due: soonest deadline first, the ones without one after. */
export function movesByDue(moves: Move[]) {
  return [...moves].sort((a, b) => (a.deadline ? Date.parse(a.deadline) : Infinity) - (b.deadline ? Date.parse(b.deadline) : Infinity));
}

/** One line: how many moves are due and the first, or that you're all set. Taps through to the first. */
export function StatusLine({ home }: { home: Home }) {
  const moves = movesByDue(home.moves);
  const first = moves[0];
  const show = first && showOfMove(home, first);
  const body = (
    <>
      <i className={`size-2 flex-none rounded-full ${first ? "bg-chyron-line" : "bg-good"}`} aria-hidden />
      <span className="flex-1">
        {first ? (
          <>
            <b className="text-foreground">
              {moves.length} {moves.length === 1 ? "move" : "moves"} due
            </b>{" "}
            · {moveLine(first, show)}
          </>
        ) : (
          <>
            <b className="text-foreground">You&rsquo;re all set</b> · nothing due this week
          </>
        )}
      </span>
      <ChevronRight className="size-5 flex-none" aria-hidden />
    </>
  );
  const cls = "nd-press mx-4 mb-3 mt-1 flex items-center gap-2.5 rounded-[3px] bg-card px-3 py-2.5 text-left text-sm text-muted-foreground";
  return show ? (
    <NavLink href={paths.show(show.seasonId)} className={cls}>
      {body}
    </NavLink>
  ) : (
    <div className={cls}>{body}</div>
  );
}

// ---------- Up next ----------

/** The show on next: its art large, when it's on, and your move for it on a caption plate. */
export function UpNext({ home, show }: { home: Home; show: HomeShow }) {
  const up = show.upNext!;
  const t = up.airAt ? Date.parse(up.airAt) : null;
  const now = useNow(t != null && ticks(t));
  const move = movesByDue(home.moves).find((m) => show.games.some((g) => g.leagueId === m.leagueId));
  const name = show.show.name.replace(/^The /, "");
  const href = paths.show(show.seasonId);
  return (
    <section data-art-scope className="relative isolate mx-4 mt-1 flex min-h-[330px] flex-col overflow-hidden rounded-[4px] shadow-[0_18px_40px_rgba(0,0,0,.45)]">
      <span className="absolute inset-0 -z-[2] overflow-hidden">
        <ShowArt seasonId={show.seasonId} artUrl={show.show.artUrl} name={show.show.name} className="nd-kenburns size-full" />
      </span>
      <span
        aria-hidden
        className="absolute inset-0 -z-[1] bg-[linear-gradient(180deg,rgba(16,14,21,.25)_0%,rgba(16,14,21,.2)_30%,rgba(16,14,21,.88)_72%,rgba(16,14,21,.97)_100%)]"
      />
      <div className="flex flex-1 flex-col gap-2.5 p-3.5">
        <div className="flex items-center gap-2">
          <span
            className={`type-caption py-[5px] pl-[9px] pr-[18px] text-[13px] tracking-[0.06em] [clip-path:polygon(0_0,100%_0,calc(100%_-_9px)_100%,0_100%)] ${
              up.live ? "bg-live text-live-foreground" : "bg-secondary text-foreground"
            }`}
          >
            {up.live ? "On now" : "Up next"}
          </span>
          <span className="text-[13px] font-semibold text-white [text-shadow:0_1px_6px_rgba(0,0,0,.6)]">
            {show.seasonNumber ? `Season ${show.seasonNumber} · ` : ""}Ep {up.number}
            {t != null ? ` · ${airTime(t)}` : ""}
          </span>
        </div>
        <h2 className="type-caption mt-auto text-[44px] [text-shadow:0_2px_20px_rgba(0,0,0,.5)]">
          <NavLink href={href} channel className="inline-flex items-center gap-1">
            {name}
            <ChevronRight className="size-7" strokeWidth={3} aria-hidden />
          </NavLink>
        </h2>
        {t != null && !up.live && <div className="type-caption -mt-1 text-[20px] tracking-[0.02em]">{calmWhen(t, now)}</div>}
        <NavLink
          href={href}
          channel
          className="nd-press flex min-h-14 w-full items-stretch overflow-hidden rounded-[3px] bg-plate text-left text-plate-foreground shadow-plate"
        >
          <span
            className={`type-caption -mr-[13px] flex items-center whitespace-nowrap py-0 pl-[11px] pr-[22px] text-sm tracking-[0.04em] [clip-path:polygon(0_0,100%_0,calc(100%_-_13px)_100%,0_100%)] ${
              move ? "bg-chyron text-chyron-foreground" : "bg-good text-good-foreground"
            }`}
          >
            {move ? (MOVE_TAG[move.kind] ?? "To do") : "All set"}
          </span>
          <span className="flex flex-1 flex-col justify-center gap-[3px] py-[7px] pl-5 pr-2.5">
            <span className="type-caption text-[19px]">{move ? move.text : `Nothing due for Episode ${up.number}`}</span>
            <span className="text-[13px] text-plate-muted">
              {move?.deadline ? `${move.kind === "lineup" || move.kind === "pick" ? "Locks" : "Due"} ${calmWhen(Date.parse(move.deadline), now)}` : (move?.leagueName ?? "Change anything until it airs")}
            </span>
          </span>
          <span className="grid place-items-center px-3">
            <ChevronRight className="size-5" aria-hidden />
          </span>
        </NavLink>
        <div className="flex items-center justify-between gap-2.5">
          <Preview id="hub.upnext-progress" tag={false} className="-m-1 p-1">
            <span className="flex items-center gap-2.5 text-[13px] text-white/90">
              <Faces who={COUCH_PROGRESS.people} />
              {COUCH_PROGRESS.done} of {COUCH_PROGRESS.of} {COUCH_PROGRESS.label}
            </span>
          </Preview>
          <Preview id="hub.watch-along" tag={false}>
            <button
              type="button"
              className="flex h-9 items-center gap-1.5 whitespace-nowrap rounded-[3px] bg-[rgba(16,14,21,.7)] px-3 text-[13px] font-bold text-white outline-1 -outline-offset-1 outline-white/25 backdrop-blur-sm"
            >
              <Tv className="size-4" aria-hidden />
              Watch along
            </button>
          </Preview>
        </div>
      </div>
    </section>
  );
}

/** The show to put up next: on now first, then the soonest to air. */
export function nextShow(home: Home): HomeShow | null {
  const on = home.shows.filter((s) => s.upNext?.airAt);
  on.sort((a, b) => Number(b.upNext!.live) - Number(a.upNext!.live) || Date.parse(a.upNext!.airAt!) - Date.parse(b.upNext!.airAt!));
  return on[0] ?? null;
}

// ---------- On now ----------

export function OnNow() {
  return (
    <Preview id="hub.on-now" tag={false} className="mx-4 mb-3.5 mt-3.5">
      <button
        type="button"
        className="flex w-full items-center gap-2.5 rounded-[4px] bg-good/10 px-2.5 py-2 text-left outline-1 -outline-offset-1 outline-good/45"
      >
        <span className="type-caption flex flex-none items-center gap-[5px] text-[10px] tracking-[0.06em] text-good">
          <i className="size-[7px] animate-pulse rounded-full bg-good" aria-hidden />
          On now
        </span>
        <DemoAvatar who={ON_NOW.who} size={26} />
        <span className="min-w-0 flex-1">
          <b className="block truncate text-sm">
            {ON_NOW.who} is watching {ON_NOW.show}
          </b>
          <small className="text-xs text-muted-foreground">Episode {ON_NOW.episode}</small>
        </span>
        <span className="flex flex-none items-center gap-0.5 text-[13px] font-bold text-good">
          Watch along <ChevronRight className="size-3.5" aria-hidden />
        </span>
      </button>
    </Preview>
  );
}

// ---------- Your shows ----------

/** A show on your shelf: its art, name, season and night, the games you play on it, and a dot if a move is due. */
function Poster({ show, due }: { show: HomeShow; due: boolean }) {
  const night = show.upNext?.airAt ? new Date(show.upNext.airAt).toLocaleDateString("en-US", { weekday: "short" }) : null;
  return (
    <NavLink
      href={paths.show(show.seasonId)}
      channel
      className="nd-press relative isolate flex h-[232px] w-[164px] flex-none snap-start flex-col justify-end overflow-hidden rounded-[4px] p-[11px] text-white shadow-[0_12px_26px_rgba(0,0,0,.45)]"
    >
      <ShowArt seasonId={show.seasonId} artUrl={show.show.artUrl} name={show.show.name} className="absolute inset-0 -z-[2] size-full" />
      <span aria-hidden className="absolute inset-0 -z-[1] bg-[linear-gradient(180deg,rgba(10,8,14,0)_35%,rgba(10,8,14,.9)_100%)]" />
      {due && <i className="absolute right-[11px] top-[11px] size-2.5 rounded-full bg-live" aria-label="A move is due" />}
      <b className="type-caption text-[28px] leading-[.92]">{show.show.name.replace(/^The /, "")}</b>
      <span className="mt-1 text-xs font-semibold opacity-90">
        {show.seasonNumber ? `Season ${show.seasonNumber}` : show.seasonName}
        {night ? ` · ${night}` : ""}
      </span>
      {show.games.length > 0 && (
        <span className="mt-2 flex flex-wrap gap-1">
          {/* By game, once each: the same game on two couches is one chip. */}
          {[...new Set(show.games.map((g) => g.gameName))].map((name) => (
            <span key={name} className="rounded-[2px] bg-[rgba(10,8,14,.6)] px-[5px] py-[3px] text-[10px] font-bold backdrop-blur-sm">
              {name}
            </span>
          ))}
        </span>
      )}
    </NavLink>
  );
}

export function YourShows({ home }: { home: Home }) {
  const due = new Set(home.moves.map((m) => showOfMove(home, m)?.seasonId).filter(Boolean));
  return (
    <section className="mt-8">
      <SectionHead title="Your shows" aside={home.shows.length ? "Tap to open" : undefined} />
      <div className="flex gap-3 overflow-x-auto px-4 pb-[18px] pt-1 [scroll-snap-type:x_mandatory] [scrollbar-width:none]">
        {home.shows.map((s) => (
          <Poster key={s.seasonId} show={s} due={due.has(s.seasonId)} />
        ))}
        <Preview id="hub.add-show" tag={false} className="flex-none">
          <button
            type="button"
            className="flex h-[232px] w-[164px] snap-start flex-col items-center justify-center gap-2 rounded-[4px] p-3 text-center text-muted-foreground"
          >
            <span className="grid size-11 place-items-center rounded-[3px] bg-card text-foreground">
              <Plus className="size-6" aria-hidden />
            </span>
            <b className="type-caption text-[22px] text-foreground">Add a show</b>
            <small className="text-[13px] leading-snug">Tell the couch what you&rsquo;re watching.</small>
          </button>
        </Preview>
      </div>
    </section>
  );
}

// ---------- You both watch ----------

export function BothWatch() {
  return (
    <Preview id="hub.nudge" className="mx-4 mt-6">
      <div className="flex flex-col overflow-hidden rounded-[4px] bg-card">
        {/* eslint-disable-next-line @next/next/no-img-element -- fixture art from the published mock */}
        <img src={NUDGE.art} alt="" className="h-24 w-full object-cover" />
        <div className="flex flex-col gap-[5px] px-3.5 pb-3.5 pt-3">
          <span className="type-caption self-start bg-secondary py-1 pl-[7px] pr-3.5 text-[11px] tracking-[0.06em] [clip-path:polygon(0_0,100%_0,calc(100%_-_8px)_100%,0_100%)]">
            You both watch
          </span>
          <b className="text-[17px] leading-tight">
            You and {NUDGE.with.join(" and ")} both watch {NUDGE.show}
          </b>
          <small className="text-[13px] leading-snug text-muted-foreground">Nobody&rsquo;s playing it yet. Start a game and the couch hears about it once.</small>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Btn className="h-11">Make it a game</Btn>
            <Btn className="h-11">Not now</Btn>
          </div>
        </div>
      </div>
    </Preview>
  );
}

// ---------- The couch is watching ----------

export function CouchWatching() {
  return (
    <section className="mt-8">
      <SectionHead title="The couch is watching" aside="Weekly shows" />
      <Preview id="hub.couch-watching" className="mx-4">
        <div className="-mx-0 flex gap-2.5 overflow-x-auto p-2 [scrollbar-width:none]">
          {COUCH_WATCHING.map((c) => (
            <div key={c.name} className="flex w-[200px] flex-none flex-col overflow-hidden rounded-[4px] bg-card">
              <span className="relative h-24">
                {/* eslint-disable-next-line @next/next/no-img-element -- fixture art from the published mock */}
                <img src={c.art} alt="" className="size-full object-cover" style={{ objectPosition: c.position }} />
                {c.notYours && (
                  <span className="type-caption absolute left-2 top-2 rounded-[2px] bg-[rgba(10,8,14,.75)] px-[7px] py-[3px] text-[10px] tracking-[0.05em] outline-1 -outline-offset-1 outline-dashed outline-white/50">
                    Not on your list
                  </span>
                )}
                {c.onNow && (
                  <span className="type-caption absolute bottom-2 left-2 flex items-center gap-[5px] rounded-[2px] bg-good px-2 py-[3px] text-[11px] tracking-[0.04em] text-good-foreground">
                    <i className="size-1.5 animate-pulse rounded-full bg-current" aria-hidden />
                    {c.onNow} is on
                  </span>
                )}
              </span>
              <b className="type-caption px-3 pb-1 pt-2.5 text-[18px]">{c.name}</b>
              <span className="flex flex-col gap-[5px] px-3 pb-3 text-xs text-muted-foreground">
                {c.people.map(([who, where]) => (
                  <span key={who} className="flex items-center gap-1.5">
                    <DemoAvatar who={who} size={20} />
                    {who} · {where}
                  </span>
                ))}
              </span>
              {c.notYours && (
                <span className="mx-3 mb-3 flex h-10 items-center justify-center gap-1.5 rounded-[3px] text-sm font-bold outline-1 -outline-offset-1 outline-input">
                  <Plus className="size-4" aria-hidden />
                  Add to my shows
                </span>
              )}
            </div>
          ))}
        </div>
      </Preview>
    </section>
  );
}

// ---------- On the couch: the feed ----------

const REACT_ICON: Record<ReactKind, LucideIcon> = { fire: Flame, laugh: Laugh, eye: Eye, crown: Crown };

export function Feed() {
  return (
    <section className="mt-8">
      <SectionHead title="On the couch" aside={<span className="font-semibold text-chyron-line">Open chat</span>} />
      <Preview id="hub.feed" className="mx-4">
        <div className="flex flex-col px-3 pt-1">
          {FEED.map((e, i) => (
            <div key={i} className="flex items-start gap-2.5 border-t border-border py-[11px] first:border-t-0">
              <DemoAvatar who={e.who} size={34} />
              <div className="min-w-0 flex-1 text-sm leading-[1.4]">
                <b className="font-bold">{e.who}</b> {e.did}
                {e.did && e.line && <span className="mt-0.5 block text-xs text-muted-foreground">{e.line}</span>}
                {!e.did && (
                  <>
                    <span className="mt-[5px] block rounded-[3px] bg-card px-2.5 py-2 text-[15px]">{e.line}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">{e.where}</span>
                  </>
                )}
                {e.reactions && (
                  <span className="mt-2 flex gap-1.5">
                    {e.reactions.map((r) => {
                      const Icon = REACT_ICON[r.kind];
                      return (
                        <span
                          key={r.kind}
                          className={`flex h-[30px] items-center gap-1 rounded-[3px] px-2 text-[13px] font-bold ${r.mine ? "bg-chyron-line/10 outline-1 -outline-offset-1 outline-chyron-line" : "bg-card"}`}
                        >
                          <Icon className="size-3.5" aria-hidden />
                          {r.n}
                        </span>
                      );
                    })}
                  </span>
                )}
              </div>
            </div>
          ))}
          <div className="flex items-center gap-2 border-t border-border py-[11px] text-[13px] text-muted-foreground">
            <span className="flex gap-[3px]" aria-hidden>
              {[0, 1, 2].map((k) => (
                <i key={k} className="size-[5px] animate-pulse rounded-full bg-muted-foreground" style={{ animationDelay: `${k * 150}ms` }} />
              ))}
            </span>
            {TYPING}
          </div>
        </div>
      </Preview>
    </section>
  );
}

// ---------- the foot, and the new couch's extras ----------

export function Foot() {
  return (
    <Preview id="hub.foot" tag={false} className="mx-4 mt-8">
      <div className="grid grid-cols-2 gap-2.5">
        <Btn>
          <Plus className="size-5" aria-hidden />
          New league
        </Btn>
        <Btn>
          <Link2 className="size-5" aria-hidden />
          Join a couch
        </Btn>
      </div>
    </Preview>
  );
}

/** A new couch's first steps, numbered; the first is the one yellow (it's what to do now). */
export function GetGoing({ couch }: { couch: Couch | null }) {
  return (
    <Preview id="hub.get-going" className="mx-4 mb-3">
      <div className="rounded-[4px] bg-plate p-3.5 text-plate-foreground">
        <span className="type-caption inline-block bg-chyron py-1 pl-[7px] pr-3.5 text-[11px] tracking-[0.06em] text-chyron-foreground [clip-path:polygon(0_0,100%_0,calc(100%_-_8px)_100%,0_100%)]">
          New couch
        </span>
        <b className="type-caption mt-2 block text-[30px]">Get the couch going</b>
        {couch && <small className="block text-[13px] text-plate-muted">{couch.name}</small>}
        <ol className="mt-2">
          {GET_GOING.steps.map((s, i) => (
            <li key={s.title} className="flex items-center gap-3 border-t border-plate-muted/20 py-2.5">
              <span className={`type-num grid size-10 flex-none place-items-center rounded-[3px] text-[20px] ${i ? "bg-chyron-foreground text-white" : "bg-chyron text-chyron-foreground"}`}>
                {i + 1}
              </span>
              <span className="min-w-0 flex-1">
                <b className="block text-[15px] font-semibold">{s.title}</b>
                <small className="block text-[12.5px] leading-snug text-plate-muted">{s.line}</small>
              </span>
              <ChevronRight className="size-5 flex-none" aria-hidden />
            </li>
          ))}
        </ol>
      </div>
    </Preview>
  );
}

const GROW_ICON = { cup: Trophy, poll: ChartColumn, crown: Crown };

export function GrowNote() {
  return (
    <Preview id="hub.grow-note" tag={false} className="mx-4 mt-8">
      <div className="p-3.5">
        <b className="type-caption text-base">More shows up as the couch plays</b>
        <ul className="mt-2.5 flex flex-col gap-2">
          {GROW_NOTE.map((g) => {
            const Icon = GROW_ICON[g.icon];
            return (
              <li key={g.text} className="flex items-center gap-2.5 text-[13.5px] text-muted-foreground">
                <Icon className="size-4 flex-none" aria-hidden />
                {g.text}
              </li>
            );
          })}
        </ul>
      </div>
    </Preview>
  );
}
