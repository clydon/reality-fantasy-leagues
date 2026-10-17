"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueries } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useLinkedOrder } from "@/components/league-swipe";
import type { Castaway, LeagueState, ScoreRow } from "@/lib/game/types";
import StateLogic from "@/lib/game/state-logic.js";
import { useLeagueStore, useSpoilersOn } from "@/lib/store";
import { useShowTerms } from "@/lib/use-show-terms";
import { episodeRecapWins, tribeAtEpisode } from "@/lib/game/episode-recap";
import { episodePlayerPoints } from "@/lib/game/active-roster-rows";
import { castawayPhotoSrc } from "@/lib/game/selectors";
import { episodeExits, ownersLine } from "@/components/episodes/episode-status";
import { episodesLabel } from "@/components/results-in-banner";
import { CaptionPlate } from "@/components/ui/caption-plate";
import { shortNames } from "@/components/draft/draft-ui";
import { andList, waiversBase, when } from "@/components/waivers/waivers-model";
import { cn } from "cn";

// The reveal, one beat at a time (the canvas's "A · Spoilers & reveal" → Reveal-Moment): a "previously
// on" bumper, then the episode's wins as caption plates, then each person who left as a full vote-out
// card, then what it meant for you. Tap anywhere for the next beat; Skip goes straight to the recap
// (the episode's own page).
//
// Linked leagues (league-groups.ts) share one reveal: it marks every one of them seen, so it plays what
// it meant for you in each -- one "you" beat per league, the league's name quiet and its type a step
// louder above it -- rather than only the league you opened it from.
//
// Reached only from the "Reveal Episode 3?" sheet (results-in-banner.tsx). Opening this page is what
// marks the results seen -- so it's full screen (AuthGate's FULLSCREEN_ROUTES), with no alert strip or
// tab bar that could show a result before its beat. `through` is clamped to the latest episode that
// has results, so a hand-typed /reveal/99 can't mark future episodes seen before they exist.
export function RevealMoment({ through: asked }: { through: number }) {
  const router = useRouter();
  const spoilersOn = useSpoilersOn();
  const fullState = useLeagueStore((s) => s.fullState);
  const leagueName = useLeagueStore((s) => s.leagueName);
  const seen = useLeagueStore((s) => s.membership?.resultsSeenThrough);
  const me = useLeagueStore((s) => s.membership?.playerId ?? null);
  const touring = useLeagueStore((s) => s.touring);
  const markResultsSeen = useLeagueStore((s) => s.markResultsSeen);
  const showName = useShowTerms().showName ?? leagueName ?? "";

  const latest = StateLogic.SpoilerLogic.latestWithResults(fullState);
  const through = Number.isFinite(asked) ? Math.min(asked, latest) : 0;
  // Where the reveal starts: the first episode this viewer hadn't seen, read once -- marking them seen
  // (below) moves that on.
  const [from] = useState(() => {
    const hidden = spoilersOn ? StateLogic.SpoilerLogic.hiddenEpisodes(fullState, seen).filter((e) => e.number <= through) : [];
    return hidden.length ? hidden[0].number : through;
  });

  useEffect(() => {
    if (through < 1) router.replace("/episodes");
    else markResultsSeen(through);
  }, [through, markResultsSeen, router]);

  // The other leagues in this one's group, fetched fresh (the same cache the swipe peeks use).
  const leagueId = useLeagueStore((s) => s.leagueId);
  const { ids } = useLinkedOrder();
  const otherIds = ids.filter((id) => id !== leagueId);
  const fetched = useQueries({
    queries: otherIds.map((id) => ({ queryKey: ["league-peek", id], queryFn: () => api.leagueState(id), staleTime: 30_000 })),
  });
  const waiting = fetched.some((q) => q.isPending);
  const linked = otherIds.length > 0;

  const beats = useMemo(() => {
    if (through < 1) return [];
    const others = fetched.flatMap((q) => {
      const res = q.data;
      if (!res) return [];
      const mine = res.membership?.playerId ?? null;
      const full = StateLogic.GhostLogic.viewFor(res.state, mine, res.membership?.resultsSeenThrough ?? null, { full: true }) as LeagueState;
      return [{ name: res.league.name, state: full, me: mine }];
    });
    const all = buildBeats(fullState, from, through, me, linked ? { name: leagueName ?? "", others } : null);
    // The guided tour takes you to waivers itself, after the scoreboard and chat: "Your move" would skip ahead.
    return touring ? all.filter((b) => b.kind !== "move") : all;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `fetched` is a new array every render; `waiting` is when its data lands
  }, [fullState, from, through, me, linked, leagueName, waiting, touring]);
  const [step, setStep] = useState(0);
  if (through < 1) return null;

  // A group's other leagues still loading: the bumper plays, the rest waits so the beats never shift.
  const ready = !waiting;
  const beat = (ready ? beats[step] : beats[0]) ?? beats[0];
  const last = ready && step === beats.length - 1;
  const recap = `/episodes/${through}`;
  // Plates already shown for this beat's episode stay on screen above it, smaller, like a broadcast
  // stacking its lower thirds.
  const earlier = beat.kind === "win" || beat.kind === "exit" ? beats.slice(0, step).filter((b) => "ep" in b && b.ep === beat.ep) : [];

  // `dark` whatever the theme: the reveal is the broadcast itself, so it always plays on Night, like
  // the TV coming on. The rest of the app follows the viewer's choice.
  return (
    <div className="dark relative flex min-h-dvh flex-col overflow-hidden bg-background text-foreground">
      {/* The whole screen is the "next" button; links inside the beat sit above it. */}
      <button
        type="button"
        className="absolute inset-0 z-0 cursor-pointer outline-none focus-visible:outline-3 focus-visible:-outline-offset-4 focus-visible:outline-chyron-line disabled:cursor-default"
        aria-label={last ? "The reveal is over" : "Show the next result"}
        disabled={last}
        onClick={() => ready && setStep((s) => Math.min(s + 1, beats.length - 1))}
      />
      <div
        className="pointer-events-none relative z-[1] mx-auto flex w-full max-w-[480px] flex-1 flex-col"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        <header className="flex items-center justify-between gap-3 px-4">
          <span className="truncate py-3 text-sm font-bold text-muted-foreground">{linked ? showName : leagueName}</span>
          {!last && (
            <Link href={recap} className="pointer-events-auto -mr-2 px-2 py-3 text-sm font-bold text-foreground hover:underline">
              Skip
            </Link>
          )}
        </header>

        <div key={step} aria-live="polite" className="flex flex-1 flex-col motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-6 motion-safe:duration-300">
          {beat.kind === "bumper" && (
            <div className="flex flex-1 flex-col justify-center gap-3.5 px-6">
              <span className="type-caption text-[22px] tracking-[0.3em] text-muted-foreground">Previously on</span>
              <span className={cn("type-caption leading-[0.9] break-words", from === through ? "text-[64px]" : "text-[52px]")}>
                {showName && (
                  <>
                    {showName}
                    <br />
                  </>
                )}
                {episodesLabel(from, through)}
              </span>
              <span className="text-[15px] text-muted-foreground">Tap to roll the results.</span>
            </div>
          )}

          {(beat.kind === "win" || beat.kind === "exit") && (
            <div className="flex flex-1 flex-col justify-end gap-3.5 px-4 pb-6">
              {from !== through && <span className="type-caption text-[19px] text-muted-foreground">Episode {beat.ep}</span>}
              {earlier.map((b) =>
                b.kind === "win" ? b.plates.map((w) => <WinPlate key={w.key} win={w} small />) : b.kind === "exit" ? <ExitPlate key={b.key} beat={b} /> : null,
              )}
              {beat.kind === "win" ? beat.plates.map((w) => <WinPlate key={w.key} win={w} />) : <ExitCard beat={beat} />}
            </div>
          )}

          {beat.kind === "move" && (
            <div className="flex flex-1 flex-col justify-center gap-[18px] px-4 pb-6">
              {beat.recap.map((r) => (
                <CaptionPlate key={r.key} size="sm" tone={r.tone} tag={r.tag} title={r.title} className="opacity-75" />
              ))}
              <span className="type-caption mt-4 text-[64px] leading-[0.9]">Your move</span>
              <CaptionPlate tag={beat.tag} image={beat.image} title={beat.title} subtitle={beat.subtitle} className="min-h-[68px]" />
              <p className="text-base leading-normal">{beat.lede}</p>
              <div className="pointer-events-auto mt-2.5 flex flex-col gap-2.5">
                <Link
                  href={beat.href}
                  className="type-caption flex min-h-[52px] items-center justify-center rounded-[3px] bg-plate px-5 text-[20px] text-plate-foreground shadow-plate transition-[filter] hover:brightness-[0.94] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-chyron-line"
                >
                  {beat.cta}
                </Link>
                <Link href={recap} className="flex min-h-11 items-center justify-center text-[15px] font-semibold text-muted-foreground hover:text-foreground">
                  Later
                </Link>
              </div>
            </div>
          )}

          {beat.kind === "you" && (
            <div className="flex flex-1 flex-col items-start justify-center gap-3 px-6">
              {beat.league && (
                <span className="flex max-w-full items-center gap-2">
                  <span className="type-caption shrink-0 rounded-[3px] border border-input px-2 py-[3px] text-[15px] tracking-[0.05em] text-foreground">
                    {beat.league.type}
                  </span>
                  <span className="truncate text-[13px] text-muted-foreground">{beat.league.name}</span>
                </span>
              )}
              <span className="type-caption text-[30px]">{beat.title}</span>
              {beat.hero !== null && <span className="type-num text-[140px] leading-[0.8] text-chyron-line">{beat.hero}</span>}
              {beat.heroLabel && <span className="type-caption text-[19px] text-muted-foreground">{beat.heroLabel}</span>}
              {beat.lines.map((l) => (
                <span key={l} className="text-base text-muted-foreground">
                  {l}
                </span>
              ))}
              {last && (
                <>
              <Link
                href={recap}
                className="pointer-events-auto mt-2.5 flex min-h-12 items-center rounded-[3px] bg-plate px-5 text-[15px] font-bold text-plate-foreground transition-[filter] hover:brightness-[0.94] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-chyron-line"
              >
                See the full recap
              </Link>
              <Link href="/" className="pointer-events-auto -ml-1 px-1 py-3 text-sm font-semibold text-muted-foreground hover:text-foreground">
                Go to Overview
              </Link>
                </>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-center gap-1.5 pt-4" style={{ paddingBottom: "calc(26px + env(safe-area-inset-bottom, 0px))" }} aria-hidden>
          {beats.length <= 12 ? (
            beats.map((_, i) => <span key={i} className={cn("size-2 rounded-full", i <= step ? "bg-chyron-line" : "bg-input")} />)
          ) : (
            <span className="type-num text-[15px] text-muted-foreground">
              {step + 1} / {beats.length}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

type Win = { key: string; tag: string; tagStyle?: CSSProperties; title: string; subtitle?: string; image?: string };
/** One challenge: everyone who won it, together (two tribes winning immunity is one beat, not two). */
type WinBeat = { kind: "win"; ep: number; key: string; plates: Win[] };
type ExitBeat = { kind: "exit"; ep: number; key: string; c: Castaway; method: string; detail: string };
type YouBeat = { kind: "you"; title: string; hero: string | null; heroLabel?: string; lines: string[]; league?: { name: string; type: string } };
/** Waivers' last beat (docs/PLAN-midseason-waivers.md, the canvas's board 12): what's yours to do now. */
type MoveBeat = {
  kind: "move";
  tag: string;
  title: string;
  subtitle: string;
  image?: string;
  lede: string;
  href: string;
  cta: string;
  /** What came before, small: your castaways who left, and your score. */
  recap: { key: string; tone: "live" | "quiet"; tag: string; title: string }[];
};
type Beat = { kind: "bumper" } | WinBeat | ExitBeat | YouBeat | MoveBeat;

function WinPlate({ win, small }: { win: Win; small?: boolean }) {
  return (
    <CaptionPlate
      size={small ? "sm" : "md"}
      tone="good"
      tag={win.tag}
      tagStyle={win.tagStyle}
      image={win.image}
      title={win.title}
      subtitle={win.subtitle}
      className={small ? undefined : "min-h-16"}
    />
  );
}

// An earlier exit, once the next beat is on: the small live plate.
function ExitPlate({ beat }: { beat: ExitBeat }) {
  return <CaptionPlate size="sm" tone="live" tag={beat.method} image={castawayPhotoSrc(beat.c.photoUrl) ?? undefined} title={beat.c.name} subtitle={beat.detail} />;
}

// The vote-out card: the photo full width, a live-red tag and the name on a plate across its foot.
function ExitCard({ beat }: { beat: ExitBeat }) {
  const photo = castawayPhotoSrc(beat.c.photoUrl);
  const caption = (
    <>
      <span className="type-caption bg-live px-3 py-[3px] text-[15px] tracking-[0.05em] text-live-foreground">{beat.method}</span>
      <span className="flex max-w-full flex-col gap-[3px] bg-plate py-2 pl-3 pr-3.5 text-plate-foreground shadow-plate">
        <span className="type-caption text-[30px] font-black leading-[0.95]">{beat.c.name}</span>
        {beat.detail && <span className="text-[13px] text-plate-muted">{beat.detail}</span>}
      </span>
    </>
  );
  if (!photo) return <div className="flex flex-col items-start">{caption}</div>;
  return (
    <figure className="relative m-0 h-[min(300px,42dvh)] overflow-hidden rounded-[3px] bg-card">
      {/* eslint-disable-next-line @next/next/no-img-element -- cast photos are plain files under /photos, any size */}
      <img src={photo} alt="" className="size-full object-cover [object-position:center_16%]" />
      <figcaption className="absolute bottom-3.5 left-0 right-7 flex flex-col items-start">{caption}</figcaption>
    </figure>
  );
}

/** Dark or light text on a tribe colour, whichever reads. */
function inkOn(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return "#121018";
  const n = parseInt(m[1], 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.2 ? "#121018" : "#ffffff";
}

function firstName(c: Castaway) {
  return c.name.split(" ")[0];
}

type Linked = { name: string; others: { name: string; state: LeagueState; me: string | null }[] };

function buildBeats(fullState: LeagueState, from: number, through: number, me: string | null, linked: Linked | null): Beat[] {
  // The league as this viewer saw it before the reveal, and as they'll see it after.
  const before = StateLogic.SpoilerLogic.viewThrough(fullState, from - 1) as LeagueState;
  const after = StateLogic.SpoilerLogic.viewThrough(fullState, through) as LeagueState;
  const eps = episodesIn(after, from, through);
  // Whose a castaway was is read as of just before their episode: a pickup made since (waivers may have
  // processed before this viewer revealed) takes the one who left off your roster in "after".
  let asOf = before;
  const mine = (c: Castaway) => !!me && (StateLogic.getCastaway(asOf, c.id) ?? c).ownerIds.includes(me);

  const beats: Beat[] = [{ kind: "bumper" }];
  for (const ep of eps) {
    asOf = ep.number === from ? before : (StateLogic.SpoilerLogic.viewThrough(fullState, ep.number - 1) as LeagueState);
    for (const w of episodeRecapWins(after, ep)) {
      const what = `Wins ${w.label.toLowerCase()}`;
      const plates: Win[] = [];
      for (const { tribe, members } of w.tribes) {
        const yours = members.filter(mine).map(firstName);
        plates.push({
          key: `${ep.id}-${w.label}-${tribe.id}`,
          tag: tribe.name,
          tagStyle: { background: tribe.color, color: inkOn(tribe.color) },
          title: what,
          subtitle: yours.length ? `Yours: ${yours.join(", ")}` : undefined,
        });
      }
      for (const c of w.castaways) {
        plates.push({
          key: `${ep.id}-${w.label}-${c.id}`,
          tag: w.label,
          image: castawayPhotoSrc(c.photoUrl) ?? undefined,
          title: c.name,
          subtitle: [what, mine(c) && "Yours"].filter(Boolean).join(" · "),
        });
      }
      beats.push({ kind: "win", ep: ep.number, key: `${ep.id}-${w.label}`, plates });
    }
    for (const { ev, c } of episodeExits(after, ep)) {
      const tribeId = tribeAtEpisode(after, c, ep.number);
      const tribe = after.tribes.find((t) => t.id === tribeId);
      beats.push({
        kind: "exit",
        ep: ep.number,
        key: `${ep.id}-out-${c.id}`,
        c,
        method: ev.method || "Out",
        detail: [
          tribe?.name,
          typeof ev.juryVotes === "number" && `${ev.juryVotes} jury vote${ev.juryVotes === 1 ? "" : "s"}`,
          ownersLine(asOf, c, me),
        ]
          .filter(Boolean)
          .join(" · "),
      });
    }
  }
  const tag = (st: LeagueState, name: string) => ({ name, type: StateLogic.getLeagueType(st).name as string });
  const mineBeat = youBeat(before, after, eps, me);
  beats.push(linked ? { ...mineBeat, league: tag(after, linked.name) } : mineBeat);
  // The rest of the group, in its order: each as that league's own numbers (its scoring, its pick).
  for (const o of linked?.others ?? []) {
    const b = StateLogic.SpoilerLogic.viewThrough(o.state, from - 1) as LeagueState;
    const a = StateLogic.SpoilerLogic.viewThrough(o.state, through) as LeagueState;
    beats.push({ ...youBeat(b, a, episodesIn(a, from, through), o.me), league: tag(a, o.name) });
  }
  const move = moveBeat(after, through, me, beats, mineBeat);
  if (move) beats.push(move);
  return beats;
}

function episodesIn(state: LeagueState, from: number, through: number) {
  return state.episodes
    .filter((e) => e.number >= from && e.number <= through && StateLogic.episodeHasResults(e))
    .sort((a, b) => a.number - b.number);
}

const fmt = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : "0");

function ordinal(n: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function names(list: string[]) {
  return list.length <= 2 ? list.join(" and ") : `${list.slice(0, 2).join(", ")} and ${list.length - 2} more`;
}

// What it meant for you: your starters' points (Active Roster), your pick and streak (Eliminator
// Pool), or what your team earned (Classic: +1 per elimination for each castaway still in) -- then
// where that leaves you.
function youBeat(before: LeagueState, after: LeagueState, eps: LeagueState["episodes"], me: string | null): YouBeat {
  const type = StateLogic.getLeagueType(after);
  const pool = !!type.hasWeeklyPicks;
  const rowsA = StateLogic.computeScores(after);
  const rowsB = StateLogic.computeScores(before);
  const cmp = (a: ScoreRow, b: ScoreRow) => (pool ? (a.longestStreak ?? 0) - (b.longestStreak ?? 0) || a.total - b.total : a.total - b.total);
  const rankIn = (rows: ScoreRow[], r: ScoreRow) => 1 + rows.filter((o) => cmp(o, r) > 0).length;

  const mineA = rowsA.find((r) => r.playerId === me);
  if (!mineA) {
    const lead = rowsA.filter((r) => rankIn(rowsA, r) === 1);
    return {
      kind: "you",
      title: "The standings",
      hero: null,
      lines: lead.length && rowsA.length > 1 ? [`${names(lead.map((r) => r.name))} ${lead.length > 1 ? "lead" : "leads"}${pool ? "" : ` with ${lead[0].total}`}.`] : [],
    };
  }

  let title: string;
  let hero: string;
  let heroLabel: string | undefined;
  const lines: string[] = [];
  if (pool) {
    const ep = eps[eps.length - 1];
    const pick = ep && (ep.picks || []).find((p) => p.playerId === me);
    const c = pick ? StateLogic.getCastaway(after, pick.castawayId) : null;
    const out = !!pick && ep.events.some((e) => e.castawayId === pick.castawayId);
    title = !pick ? "You didn't pick" : out ? "Your pick went home" : "Your pick survived";
    if (c) lines.push(out ? `${c.name} is out.` : `${c.name} is still in.`);
    hero = String(mineA.currentStreak ?? 0);
    heroLabel = "Your streak";
  } else if (type.hasActiveRoster) {
    const pts = StateLogic.roundPoints(
      eps.reduce((t, ep) => t + (episodePlayerPoints(after, ep.id).find((r) => r.player.id === me)?.points ?? 0), 0),
    );
    title = "Your starters scored";
    hero = fmt(pts);
  } else {
    const mineB = rowsB.find((r) => r.playerId === me);
    title = "You scored";
    hero = fmt(StateLogic.roundPoints(mineA.total - (mineB?.total ?? 0)));
    const standing = mineA.roster.filter((c) => c.status !== "eliminated").length;
    const exits = eps.reduce((n, ep) => n + ep.events.length, 0);
    if (mineA.roster.length && standing > 0 && exits > 0)
      lines.push(`${standing} still in, +${exits} each${standing < mineA.roster.length ? ` · ${mineA.roster.length - standing} out` : ""}.`);
    else if (mineA.roster.length) lines.push(`${standing} of ${mineA.roster.length} still in.`);
  }

  if (rowsA.length > 1) {
    const ra = rankIn(rowsA, mineA);
    const mineB = rowsB.find((r) => r.playerId === me);
    const rb = mineB ? rankIn(rowsB, mineB) : ra;
    const tied = rowsA.filter((o) => o !== mineA && cmp(o, mineA) === 0).map((o) => o.name);
    const where = ra < rb ? "move up to" : ra > rb ? "drop to" : "stay in";
    if (tied.length === rowsA.length - 1) {
      lines.push("Everyone's still level.");
    } else if (tied.length) {
      lines.push(`You're tied for ${ordinal(ra)} with ${names(tied)}.`);
    } else if (pool) {
      lines.push(`You ${where} ${ordinal(ra)}.`);
    } else if (ra === 1) {
      const next = rowsA.filter((o) => o !== mineA).sort((a, b) => b.total - a.total)[0];
      lines.push(`You ${where} ${ordinal(ra)}, ${StateLogic.roundPoints(mineA.total - next.total)} ahead of ${next.name}.`);
    } else {
      const leader = rowsA.filter((o) => rankIn(rowsA, o) === 1);
      lines.push(`You ${where} ${ordinal(ra)}, ${StateLogic.roundPoints(leader[0].total - mineA.total)} behind ${names(leader.map((r) => r.name))}.`);
    }
  }
  return { kind: "you", title, hero, heroLabel, lines };
}

// Waivers opened by the episode just revealed, and something of yours to do in them: someone you can
// replace (claims, or free agency once they've processed), else a waiver window's swap. Nothing to do,
// no beat.
function moveBeat(after: LeagueState, through: number, me: string | null, beats: Beat[], you: YouBeat): MoveBeat | null {
  const W = StateLogic.WaiverLogic;
  if (!me || !W.enabled(after)) return null;
  const p = W.current(after);
  if (!p || p.hidden || p.episode !== through) return null;
  const player = StateLogic.getPlayer(after, me);
  if (!player || player.disabled || player.active === false || player.ghost) return null;
  const base = waiversBase(after);
  const now = Date.now();
  const fa = W.freeAgencyOn(after);
  const owed = W.replacementsOwed(after, me, p);
  const names = shortNames(after.castaways);
  const name = (id: string) => names.get(id) ?? "?";
  const losses = owed.lossIds.map((id) => StateLogic.getCastaway(after, id)).filter((c): c is Castaway => !!c);
  const next = through + 1;
  const day = p.processAt ? new Date(p.processAt).toLocaleDateString(undefined, { weekday: "long" }) : null;
  const swap = W.swapsLeft(after, p, me) > 0;
  const recap: MoveBeat["recap"] = [
    ...beats.flatMap((b) =>
      b.kind === "exit" && b.ep === through && losses.some((c) => c.id === b.c.id) ? [{ key: b.key, tone: "live" as const, tag: b.method, title: b.c.name }] : [],
    ),
    { key: "you", tone: "quiet", tag: "You", title: [you.title, you.hero].filter(Boolean).join(" ") },
  ];
  const pickupTitle = `Replace ${andList(losses.map((c) => name(c.id)))}`;
  const claimHref = losses[0] ? `${base}/claim?drop=${encodeURIComponent(losses[0].id)}` : base;
  const image = losses[0] ? castawayPhotoSrc(losses[0].photoUrl) ?? undefined : undefined;

  if (p.phase === "open") {
    const then = fa ? ` Then free agency runs until Episode ${next}.` : "";
    const settle = `Nothing is decided until ${day ? `${day} night` : "claims are due"}, when every claim processes at once.${then}`;
    if (owed.count) {
      return {
        kind: "move",
        tag: "Replace",
        title: pickupTitle,
        subtitle: after.settings.ownershipMode === "shared" ? `Pick who by ${when(p.processAt, now)}` : `Claims due ${when(p.processAt, now)}`,
        image,
        lede: `${swap ? "You can swap someone still in too, if you want. " : ""}${settle}`,
        href: claimHref,
        cta: "Make my claim",
        recap,
      };
    }
    if (swap) {
      return {
        kind: "move",
        tag: "Window",
        title: "Waiver window open",
        subtitle: `Optional · claims due ${when(p.processAt, now)}`,
        lede: `Swap one of yours still in for a free agent, if you want. Their points go with them. ${settle}`,
        href: base,
        cta: "See my team",
        recap,
      };
    }
    return null;
  }
  if (!fa) return null;
  if (owed.count) {
    return {
      kind: "move",
      tag: "Replace",
      title: pickupTitle,
      subtitle: "Claims processed · choose from free agency",
      image,
      lede: `Anyone still free is first come, first served until Episode ${next} airs.${W.autoFillOn(after) ? " Still nobody by then and you get the top free agent." : ""}`,
      href: losses[0] ? `${base}/free-agency?drop=${encodeURIComponent(losses[0].id)}` : `${base}/free-agency`,
      cta: "Choose now",
      recap,
    };
  }
  if (swap) {
    return {
      kind: "move",
      tag: "Window",
      title: "Your swap is still open",
      subtitle: `In free agency until Episode ${next} airs`,
      lede: "Claims have processed, but you can still swap one of yours still in, first come, first served.",
      href: `${base}/free-agency`,
      cta: "See free agents",
      recap,
    };
  }
  return null;
}
