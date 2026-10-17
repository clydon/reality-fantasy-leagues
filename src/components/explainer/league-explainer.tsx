"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowRight, Check, ChevronLeft, Link2, Shuffle, X } from "lucide-react";
import StateLogic from "@/lib/game/state-logic.js";
import { ruleAnswers } from "@/components/waivers/waivers-words";
import type { LeagueState } from "@/lib/game/types";
import { api } from "@/lib/api";
import { useLeagueStore, useIsPreviewingDemo } from "@/lib/store";
import { useTourRunning } from "@/lib/tour/tour-store";
import { buildTourState } from "@/lib/tour/rise-and-fall";
import { usePracticeRound } from "@/lib/tour/use-practice-round";
import { useShowCatalog, useShowTerms, type ShowTerms } from "@/lib/use-show-terms";
import { useExplainerStore } from "@/lib/explainer-store";
import { buildSample, topEvents, type Sample, type SampleCastaway } from "@/lib/explainer-sample";
import { publicMediaSrc } from "@/lib/game/selectors";
import { artStyleVars } from "@/lib/show-art-style";
import { CastawayAvatar } from "@/components/castaway-avatar";
import { m, AnimatePresence, useReducedMotion } from "@/components/motion";
import { cn } from "cn";

// "How this league works" (docs/PLAN-league-explainer.md): a short recap package, "Previously on…",
// that plays one made-up episode of THIS league -- its real cast, its show's words and its own scoring
// rules, with invented results labelled MADE-UP RESULTS on every card that shows any.
//
// Opens by itself once per membership, right after joining (membership.explainerSeen === false), and
// any time from More -> How this league works. A late joiner gets two more cards that end on the
// late-join start step, with where to start recommended from how far they've watched.
//
// One card, one idea: a visual up top, the host plate with the one line at the bottom, Next in thumb
// reach. Swipe works too; Esc skips.
//
// The last card offers the practice round (docs/PLAN-practice-round.md) under its button, for a league
// whose game type has one: a late joiner's before the start question, which it comes back to.

export function LeagueExplainer() {
  const open = useExplainerStore((s) => s.open);
  const show = useExplainerStore((s) => s.show);
  const closedIn = useExplainerStore((s) => s.closedIn);
  const mode = useLeagueStore((s) => s.mode);
  const leagueId = useLeagueStore((s) => s.leagueId);
  const unseen = useLeagueStore((s) => s.membership?.explainerSeen === false);
  const tourRunning = useTourRunning();
  const demo = useIsPreviewingDemo();

  // Once, right after joining. Never in the guided tour or the demo season.
  const due = mode === "live" && unseen && !!leagueId && !closedIn.includes(leagueId) && !tourRunning && !demo;
  useEffect(() => {
    if (due && !open) show(false);
  }, [due, open, show]);

  if (!open || mode !== "live") return null;
  return <Explainer />;
}

type Card = {
  id: string;
  /** Headline: one plain sentence. */
  title: string;
  /** One or two sentences that remove any doubt. */
  detail?: string;
  visual: ReactNode;
  /** Shows invented results: carries the MADE-UP RESULTS tag. */
  fake?: boolean;
  /** The primary button's words; Next when absent. */
  cta?: string;
  /** Primary disabled until something's chosen. */
  blocked?: boolean;
  onCta?: () => void;
};

function Explainer() {
  const router = useRouter();
  const pathname = usePathname();
  const practice = usePracticeRound();
  const raw = useLeagueStore((s) => s.rawState);
  const view = useLeagueStore((s) => s.state);
  const leagueId = useLeagueStore((s) => s.leagueId);
  const leagueName = useLeagueStore((s) => s.leagueName);
  const leagues = useLeagueStore((s) => s.leagues);
  const accounts = useLeagueStore((s) => s.playerAccounts);
  const me = useLeagueStore((s) => s.membership?.playerId ?? null);
  const card = useExplainerStore((s) => s.card);
  const go = useExplainerStore((s) => s.go);
  const replay = useExplainerStore((s) => s.replay);
  const shuffles = useExplainerStore((s) => s.shuffles);
  const shuffle = useExplainerStore((s) => s.shuffle);
  const close = useExplainerStore((s) => s.close);
  const terms = useShowTerms();
  const { data: catalog } = useShowCatalog();
  const reduced = useReducedMotion();

  const ghost = !!me && StateLogic.GhostLogic.needsStart(raw, me);
  const type = StateLogic.getLeagueType(raw);
  const settings = raw.settings;
  const shared = settings.ownershipMode === "shared";

  // Who's in play. A late joiner sees the cast as it stood before episode 1, so nobody who left later
  // shows as gone; everyone else sees whoever's still in, as far as they've revealed.
  const before = useMemo(() => (StateLogic.SpoilerLogic.viewThrough(raw, 0) as LeagueState).castaways, [raw]);
  const realCast = ghost ? before : view.castaways.filter((c) => c.status === "active");
  const noCast = realCast.length < 3;
  const pool = useMemo(() => (noCast ? buildTourState().castaways : realCast), [noCast, realCast]);
  const t: ShowTerms = noCast ? { ...terms, Castaway: "Baker", Castaways: "Bakers", castaway: "baker", castaways: "bakers" } : terms;

  const others = raw.players.filter((p) => p.id !== me && !p.disabled && !p.ghost).map((p) => p.name);
  const seed = `${leagueId}:${me}:${shuffles}`;
  const activeSlots = type.hasActiveRoster ? settings.activeSlots : 0;
  // The real next boot (from the full season, not this member's view): never shown first out.
  const nextBootId = useMemo(() => {
    const out = raw.castaways
      .filter((c) => c.status === "eliminated" && typeof c.placementOrder === "number")
      .filter((c) => !view.castaways.some((v) => v.id === c.id && v.status === "eliminated"))
      .sort((a, b) => (a.placementOrder ?? 0) - (b.placementOrder ?? 0));
    return out[0]?.id ?? null;
  }, [raw, view]);
  const sample: Sample = useMemo(
    () =>
      buildSample({
        seed,
        pool,
        teamSize: StateLogic.rosterSize(raw),
        activeSlots,
        events: type.hasActiveRoster ? topEvents(raw) : [],
        rivals: others,
        nextBootId,
      }),
    // others is rebuilt each render; the league's players only change with raw.
    [seed, pool, raw, activeSlots, type.hasActiveRoster, nextBootId], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const players = raw.players.filter((p) => !p.disabled && !p.ghost).length;
  const commissioner = accounts.find((a) => a.role === "commissioner")?.username ?? null;
  const show = catalog?.shows.find((s) => s.slug === settings.showId) ?? null;
  const showLine = [terms.showName && (settings.wikiSeason ? `${terms.showName} season ${settings.wikiSeason}` : terms.showName)].filter(Boolean)[0];
  const here = leagues.find((l) => l.id === leagueId);
  const linked = here?.group ? leagues.filter((l) => l.group?.id === here.group!.id) : [];

  const typeName = type.name as string;
  const draftDone = !type.hasRoster || StateLogic.currentDraftTurn(raw)?.isComplete === true;
  const draftGloss = shared
    ? `Blind draft: everyone picks in private, then all picks are revealed at once. The same ${t.castaway} can be on more than one team.`
    : `Snake draft: everyone takes turns picking, and the order reverses each round. Once someone picks a ${t.castaway}, nobody else can have them.`;
  const ownership =
    !type.hasRoster
      ? `there's no draft. Each episode you pick one ${t.castaway} you think will stay in the game.`
      : shared
        ? `you draft your own team, and other players can have the same ${t.castaways}.`
        : `you draft your own team, and nobody else can have your ${t.castaways}.`;


  function finish() {
    close(leagueId);
    if (!replay && leagueId) {
      useLeagueStore.setState((s) => ({ membership: s.membership && { ...s.membership, explainerSeen: true } }));
      api.markExplainerSeen(leagueId).catch(() => {});
    }
  }
  // A late joiner who skips lands on the same "Which episodes have you watched?" step, under these cards.
  const skip = finish;
  // The practice round ends back where this card's own button would have gone (or, from More, here).
  function practise() {
    finish();
    practice.start(replay ? pathname : ghost ? "/late-join" : draftDone ? "/" : "/draft");
  }

  // ---------- the cards ----------
  const cards: Card[] = [];
  cards.push({
    id: "league",
    title: leagueName ?? "Your league",
    visual: (
      <LeagueCard
        name={leagueName ?? "Your league"}
        showLine={showLine ?? null}
        players={players}
        commissioner={commissioner}
        typeLine={`${typeName}: ${ownership}`}
        linked={linked.length > 1 ? linked.map((l) => ({ id: l.id, name: l.name, type: l.type, current: l.id === leagueId })) : []}
      />
    ),
    cta: "Show me how it works",
  });

  if (type.id === "classic-draft") {
    cards.push({
      id: "draft",
      title: `You draft a team of ${StateLogic.rosterSize(raw)} ${t.castaways} before the season starts.`,
      detail: draftGloss,
      visual: <TeamRow label="Your sample team" team={sample.team} />,
    });
    cards.push({
      id: "ladder",
      fake: true,
      title: `Your ${t.castaways} earn a point each time someone else goes home.`,
      detail: `The longer they last, the more they earn. The winner of ${pool.length} ends on ${pool.length}.`,
      visual: <Ladder sample={sample} size={pool.length} onShuffle={shuffle} />,
    });
    if (settings.bonusEnabled) {
      cards.push({
        id: "bets",
        fake: true,
        title: "Each episode, you can also make side bets on what will happen.",
        detail: `A right answer earns that bet's points, usually ${settings.defaultBetPoints}. A wrong answer costs nothing, and a bet pays out only if at least two players answer.`,
        visual: <BetCard answer={sample.betAnswer} points={settings.defaultBetPoints} />,
      });
    }
  } else if (type.id === "active-roster") {
    const bench = settings.benchSlots;
    cards.push({
      id: "draft",
      title: `You draft ${StateLogic.rosterSize(raw)} ${t.castaways}. Each episode, ${activeSlots} of them start and ${bench} sit on the bench.`,
      detail: draftGloss,
      visual: <LineupRows sample={sample} />,
    });
    cards.push({
      id: "events",
      fake: true,
      title: "Only your starters score points. Points earned on the bench don't count.",
      detail: "Set your lineup before each episode airs. After that it's locked until the next one.",
      visual: <EventsCard sample={sample} onShuffle={shuffle} />,
    });
    const pickups = StateLogic.WaiverLogic.replaceRule(raw) !== "never";
    const swaps = StateLogic.WaiverLogic.windows(raw).swaps > 0;
    const from = shared ? `anyone still in the game who isn't already yours` : `${t.castaways} nobody has drafted`;
    const rules = ruleAnswers(raw);
    if (pickups || swaps) {
      cards.push({
        id: "pickups",
        fake: true,
        title: pickups ? `If one of your ${t.castaways} goes home, you can replace them.` : `You can swap one of your ${t.castaways} for someone new.`,
        detail: `${pickups ? rules.out : rules.swap} Claim from ${from}, in private; every claim processes at once before the next episode.${pickups && swaps ? ` Swaps: ${rules.swap.charAt(0).toLowerCase()}${rules.swap.slice(1)}` : ""}`,
        visual: sample.pickup ? <PickupCard out={sample.pickup.out} replacement={sample.pickup.in} gone={pickups} /> : null,
      });
    }
  } else {
    cards.push({
      id: "pick",
      title: `There's no draft. Before each episode, pick one ${t.castaway} you think will stay in the game.`,
      visual: <OnePick castaway={sample.picks[0]} />,
    });
    cards.push({
      id: "streak",
      fake: true,
      title: "Each right pick adds one to your streak. A wrong pick resets it to zero.",
      detail: "Your best streak still counts after it ends.",
      visual: <Streak picks={sample.picks} onShuffle={shuffle} />,
    });
    cards.push({
      id: "repeats",
      title: `You can't pick the same ${t.castaway} again until you've used everyone still in the game.`,
      detail: "And never the same one two episodes in a row. Players are ranked by their longest streak, then by total right picks.",
      visual: <UsedGrid picks={sample.picks} pool={pool} />,
    });
  }

  const loop =
    type.id === "pickem" ? "Make your next pick" : type.id === "active-roster" ? "Set your next lineup" : "See where you stand";
  cards.push({
    id: "end",
    title: "That's how it works. Here's what you'll do each week:",
    visual: <WeeklyLoop steps={["Watch the episode", "Reveal the results", loop]} />,
    cta: replay ? "Done" : ghost ? "Next: catching up" : draftDone ? "Go to my league" : "Go to the draft",
    onCta: replay || !ghost ? () => {
      finish();
      if (!replay) router.push(draftDone ? "/" : "/draft");
    } : undefined,
  });

  if (ghost && !replay) {
    cards.push({
      id: "late",
      title: "This season has already started. You'll play it as if it's airing now, starting from the episode you choose.",
      detail: `You go one episode at a time and see results only when you say you've watched them. Until ${commissioner ?? "the commissioner"} adds you to the league, you're hidden from the other players, and chat and side bets are off.`,
      visual: <ReplayBadge />,
      cta: "Next: choose where to start",
      onCta: finish,
    });
  }

  const i = Math.min(card, cards.length - 1);
  const c = cards[i];
  const isFirst = i === 0;
  const tag = isFirst ? "Previously on" : c.id === "late" || c.id === "watched" ? "Catching up" : `How ${typeName} works`;

  function next() {
    if (c.blocked) return;
    if (c.onCta) c.onCta();
    else if (i < cards.length - 1) go(i + 1);
    else finish();
  }
  function back() {
    if (i > 0) go(i - 1);
  }

  // Esc skips; arrows step. Keyboard users get the same moves as the buttons.
  const keys = useRef({ next, back, skip });
  useEffect(() => {
    keys.current = { next, back, skip };
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") keys.current.skip();
      else if (e.key === "ArrowRight") keys.current.next();
      else if (e.key === "ArrowLeft") keys.current.back();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // Focus moves to each card's heading, so a screen reader starts every card at its line.
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
  }, [i]);

  // Swipe: a mostly-sideways drag of 56px or more.
  const touch = useRef<{ x: number; y: number } | null>(null);
  const [dir, setDir] = useState(1);
  const prev = useRef(i);
  useEffect(() => {
    setDir(i >= prev.current ? 1 : -1);
    prev.current = i;
  }, [i]);

  const art = isFirst ? publicMediaSrc(show?.art_url) : null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="How this league works"
      className="fixed inset-0 z-[95] overflow-hidden bg-background text-foreground"
    >
      {art && (
        <div aria-hidden className="show-art show-art-door pointer-events-none absolute inset-x-0 top-0 h-[62dvh]" style={artStyleVars(show?.art_style)}>
          {/* eslint-disable-next-line @next/next/no-img-element -- art_url can be an arbitrary external URL */}
          <img src={art} alt="" />
        </div>
      )}
      <div className="relative mx-auto flex h-full w-full max-w-[420px] flex-col">
        <header className="shrink-0 px-2 pt-[calc(env(safe-area-inset-top,0px)+6px)]">
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label="Back"
              onClick={back}
              disabled={isFirst}
              className="flex size-11 items-center justify-center rounded-[3px] outline-none disabled:invisible focus-visible:outline-3 focus-visible:outline-chyron-line"
            >
              <ChevronLeft className="size-6" strokeWidth={2.2} />
            </button>
            <span className="type-caption flex h-7 min-w-0 items-center truncate bg-quiet-tag pl-2.5 pr-5 text-[14px] tracking-[0.04em] text-quiet-tag-foreground [clip-path:polygon(0_0,100%_0,calc(100%-10px)_100%,0_100%)]">
              {tag}
            </span>
            <span className="flex-1" />
            <button
              type="button"
              onClick={skip}
              className="flex min-h-11 items-center px-3 text-[15px] font-semibold text-muted-foreground underline-offset-4 outline-none hover:text-foreground hover:underline focus-visible:underline focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-chyron-line"
            >
              Skip
            </button>
          </div>
          {/* Ticks: one per card, the ones passed lit. */}
          <div className="mt-1.5 flex gap-1 px-2" aria-hidden>
            {cards.map((k, n) => (
              <span
                key={k.id}
                className={cn("h-[3px] flex-1 transition-colors duration-300", n <= i ? "bg-chyron-line" : "bg-input")}
              />
            ))}
          </div>
          <p className="sr-only">
            Card {i + 1} of {cards.length}
          </p>
        </header>

        <main
          className="relative flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-clip px-4"
          onTouchStart={(e) => (touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY })}
          onTouchEnd={(e) => {
            const s = touch.current;
            touch.current = null;
            if (!s) return;
            const dx = e.changedTouches[0].clientX - s.x;
            const dy = e.changedTouches[0].clientY - s.y;
            if (Math.abs(dx) < 56 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
            if (dx < 0 && !c.cta) next();
            else if (dx > 0) back();
          }}
        >
          <AnimatePresence mode="wait" custom={dir} initial={false}>
            <m.div
              key={`${c.id}:${shuffles}`}
              custom={dir}
              initial={reduced ? false : { opacity: 0, x: dir * 28 }}
              animate={{ opacity: 1, x: 0 }}
              exit={reduced ? { opacity: 0 } : { opacity: 0, x: dir * -28 }}
              transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
              className="mt-auto flex flex-col pb-4 pt-5"
            >
              {c.fake && <FakeTag />}
              {noCast && !isFirst && c.visual && (
                <p className="mb-3 text-[13px] text-muted-foreground">Sample cast until {terms.showName ?? "your show"}&rsquo;s cast is in.</p>
              )}
              {c.visual}
            </m.div>
          </AnimatePresence>
        </main>

        <footer className="shrink-0 px-3 pb-[calc(env(safe-area-inset-bottom,0px)+14px)] pt-2">
          {!isFirst && (
            <div className="rounded-[3px] bg-plate px-3.5 pb-3 pt-2.5 text-plate-foreground shadow-plate" aria-live="polite">
              <h2 ref={headingRef} tabIndex={-1} key={c.id} className="tour-wipe type-caption text-balance text-[23px] leading-[1.06] outline-none">
                {c.title}
              </h2>
              {c.detail && <p className="mt-1.5 text-pretty text-[15px] leading-snug text-plate-muted">{c.detail}</p>}
            </div>
          )}
          {isFirst && (
            // Card 0's heading is the league name, up in the visual; this keeps focus landing somewhere.
            <h2 ref={headingRef} tabIndex={-1} className="sr-only">
              {c.title}
            </h2>
          )}
          <button
            type="button"
            onClick={next}
            disabled={c.blocked}
            className="mt-3 flex min-h-[52px] w-full items-center justify-center gap-2 rounded-[3px] bg-chyron px-4 text-base font-bold text-chyron-foreground transition-[filter,opacity] hover:brightness-[1.06] disabled:opacity-45 disabled:hover:brightness-100 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-chyron-line"
          >
            {c.cta ?? "Next"}
            {!c.cta && <ArrowRight className="size-[18px]" strokeWidth={2.4} aria-hidden />}
          </button>
          {i === cards.length - 1 && practice.available && (
            <button
              type="button"
              onClick={practise}
              className="mt-1 flex min-h-11 w-full items-center justify-center text-[15px] font-semibold text-muted-foreground underline underline-offset-4 outline-none hover:text-foreground focus-visible:outline-2 focus-visible:outline-chyron-line"
            >
              {replay ? "Try a practice round" : "Try a practice round first"} · 3 min
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}

// ---------- pieces ----------

function FakeTag() {
  return (
    <span className="type-caption mb-3 inline-flex h-7 items-center self-start bg-live pl-2.5 pr-5 text-[14px] tracking-[0.05em] text-live-foreground [clip-path:polygon(0_0,100%_0,calc(100%-10px)_100%,0_100%)]">
      Made-up results
    </span>
  );
}

function ShuffleLink({ onShuffle }: { onShuffle: () => void }) {
  return (
    <button
      type="button"
      onClick={onShuffle}
      className="mt-2 inline-flex min-h-11 items-center gap-1.5 self-start text-[15px] font-semibold text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-2 focus-visible:outline-chyron-line"
    >
      <Shuffle className="size-4" strokeWidth={2.2} aria-hidden />
      Shuffle the made-up results
    </button>
  );
}

const pts = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
const signed = (n: number) => (n > 0 ? `+${pts(n)}` : `−${pts(Math.abs(n))}`);

/** Counts from 0 up to `to` on the lower-third rhythm; with reduced motion, just `to`. */
function useCountUp(to: number, delay = 0): number {
  const reduced = useReducedMotion();
  const [v, setV] = useState(reduced ? to : 0);
  useEffect(() => {
    if (reduced) {
      setV(to); // eslint-disable-line react-hooks/set-state-in-effect
      return;
    }
    let raf = 0;
    const t0 = performance.now() + delay;
    const tick = (now: number) => {
      const p = Math.min(1, Math.max(0, (now - t0) / 900));
      setV(to * (1 - Math.pow(1 - p, 4)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, delay, reduced]);
  return Number.isInteger(to) ? Math.round(v) : Math.round(v * 10) / 10;
}

/** Slides in after the ones before it, on the lower-third rhythm. */
function In({ n, children, className }: { n: number; children: ReactNode; className?: string }) {
  const reduced = useReducedMotion();
  return (
    <m.div
      initial={reduced ? false : { opacity: 0, x: -14 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.32, delay: 0.12 + n * 0.08, ease: [0.16, 1, 0.3, 1] }}
      className={className}
    >
      {children}
    </m.div>
  );
}

function Avatar({ c, size = "md", dim }: { c: SampleCastaway; size?: "sm" | "md" | "lg"; dim?: boolean }) {
  return (
    <CastawayAvatar
      castaway={c}
      className={cn(
        "flex shrink-0 items-center justify-center rounded-[3px] bg-secondary font-bold text-muted-foreground",
        size === "lg" ? "size-24 text-2xl" : size === "md" ? "size-14 text-base" : "size-10 text-sm",
        dim && "opacity-40 grayscale",
      )}
    />
  );
}

const firstName = (name: string) => name.split(" ")[0];

function Heading({ children }: { children: ReactNode }) {
  return <h3 className="type-caption mb-2 text-[15px] tracking-[0.04em] text-muted-foreground">{children}</h3>;
}

function LeagueCard({
  name,
  showLine,
  players,
  commissioner,
  typeLine,
  linked,
}: {
  name: string;
  showLine: string | null;
  players: number;
  commissioner: string | null;
  typeLine: string;
  linked: { id: string; name: string; type: string; current: boolean }[];
}) {
  const shown = linked.length > 4 ? linked.slice(0, 3) : linked;
  return (
    <div className="flex flex-col">
      <p className="type-caption text-balance text-[44px] leading-[0.95]">{name}</p>
      <p className="mt-3 text-[15px] text-muted-foreground">
        {showLine && <>{showLine} · </>}
        {players} {players === 1 ? "player" : "players"}
        {commissioner && <> · Run by {commissioner}</>}
      </p>
      <In n={0} className="mt-6">
        <div className="rounded-[3px] bg-plate px-3.5 py-3 text-plate-foreground shadow-plate">
          <p className="text-pretty text-[17px] font-semibold leading-snug">{typeLine}</p>
        </div>
      </In>
      {linked.length > 1 && (
        <In n={1} className="mt-6">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Link2 className="size-4" strokeWidth={2.2} aria-hidden />
            <h3 className="type-caption text-[15px] tracking-[0.04em]">Linked leagues</h3>
          </div>
          <ul className="mt-1.5">
            {shown.map((l) => (
              <li key={l.id} className="flex min-h-11 items-center justify-between gap-3 border-b border-border text-[15px]">
                <span className={cn("truncate font-semibold", l.current && "text-chyron-line")}>{l.name}</span>
                <span className="shrink-0 text-muted-foreground">{l.type}</span>
              </li>
            ))}
            {linked.length > shown.length && <li className="py-2 text-[15px] text-muted-foreground">+{linked.length - shown.length} more</li>}
          </ul>
          <p className="mt-2.5 text-pretty text-[15px] leading-snug text-muted-foreground">
            Same cast and episodes, but you make separate picks in each league. When you reveal an episode in one, it&rsquo;s revealed in all of them.
          </p>
        </In>
      )}
    </div>
  );
}

function TeamRow({ label, team }: { label: string; team: SampleCastaway[] }) {
  return (
    <div>
      <Heading>{label}</Heading>
      <ul className="grid grid-cols-4 gap-x-2.5 gap-y-3">
        {team.map((c, n) => (
          <In key={c.id} n={n}>
            <li className="flex flex-col items-center gap-1.5">
              <Avatar c={c} size="md" />
              <span className="w-full truncate text-center text-[13px] font-semibold">{firstName(c.name)}</span>
            </li>
          </In>
        ))}
      </ul>
    </div>
  );
}

function Standings({ total, rivals, delay }: { total: number; rivals: { name: string; points: number }[]; delay: number }) {
  const shown = useCountUp(total, delay);
  const rows = [...rivals.map((r) => ({ ...r, you: false })), { name: "You", points: total, you: true }].sort((a, b) => b.points - a.points);
  return (
    <div className="mt-4">
      <Heading>Standings</Heading>
      <ol>
        {rows.map((r, n) => (
          <li
            key={r.name + n}
            className={cn("flex h-10 items-center gap-3 border-b border-border px-2 text-[15px] font-semibold", r.you && "rounded-[3px] border-transparent bg-secondary")}
          >
            <span className="type-caption type-num w-5 text-[17px] text-muted-foreground">{n + 1}</span>
            <span className="flex min-w-0 flex-1 items-center gap-2">
              <span className="truncate">{r.name}</span>
              {r.you && <span className="rounded-[2px] bg-foreground px-1.5 py-px text-[11px] font-bold tracking-[0.025em] text-background">YOU</span>}
            </span>
            <span className="type-caption type-num text-[22px]">{r.you ? pts(shown) : pts(r.points)}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function Ladder({ sample, size, onShuffle }: { sample: Sample; size: number; onShuffle: () => void }) {
  // Your sample team's points at three moments of the made-up season: each climbs by 1 per elimination
  // while they're in (1 + everyone they've outlasted) and stops where they went out. The last column is
  // the finish, the same numbers the old "place in the boot order" gave.
  const moments = [
    { label: "Ep 1", k: 1 },
    { label: "Midway", k: Math.max(2, Math.floor(size / 2)) },
    { label: "Finale", k: size },
  ];
  // After k eliminations a castaway who finished `final` (went out k = final) has min(k + 1, final).
  const at = (final: number, k: number) => ({ n: Math.min(k + 1, final), out: final <= k && final < size });
  return (
    <div>
      <Heading>Your team as the season goes</Heading>
      <div className="flex h-6 items-center gap-2 px-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
        <span className="flex-1" />
        {moments.map((m) => (
          <span key={m.label} className="w-14 text-center">
            {m.label}
          </span>
        ))}
      </div>
      <ol className="flex flex-col">
        {sample.placements.map((p, n) => (
          <In key={p.castaway.id} n={n}>
            <li className="flex h-12 items-center gap-2 border-t border-border px-2">
              <Avatar c={p.castaway} size="sm" />
              <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">{firstName(p.castaway.name)}</span>
              {moments.map((m) => {
                const v = at(p.points, m.k);
                // The episode they went out is the one that shows "Out"; after it, their final, greyed.
                const justOut = v.out && (m.k === moments[0].k || at(p.points, moments[moments.indexOf(m) - 1].k).out === false);
                return (
                  <span key={m.label} className="flex w-14 items-center justify-center gap-1">
                    {justOut && <span className="rounded-[2px] bg-live px-1 text-[9px] font-extrabold uppercase text-live-foreground">Out</span>}
                    <span className={cn("type-num text-[20px]", v.out && !justOut && "text-muted-foreground")}>{v.n}</span>
                  </span>
                );
              })}
            </li>
          </In>
        ))}
      </ol>
      <Standings total={sample.total} rivals={sample.rivals} delay={600} />
      <ShuffleLink onShuffle={onShuffle} />
    </div>
  );
}

function BetCard({ answer, points }: { answer: SampleCastaway; points: number }) {
  return (
    <div>
      <Heading>A side bet</Heading>
      <In n={0}>
        <div className="rounded-[3px] bg-secondary px-3.5 py-3">
          <p className="text-[17px] font-semibold">Who goes home next?</p>
          <div className="mt-3 flex items-center gap-3">
            <Avatar c={answer} size="sm" />
            <span className="min-w-0 flex-1 text-[15px]">
              Your answer: <b>{answer.name}</b>
            </span>
            <span className="type-caption flex h-7 items-center gap-1 bg-good px-2 text-[15px] text-good-foreground">
              <Check className="size-4" strokeWidth={3} aria-hidden /> +{pts(points)}
            </span>
          </div>
        </div>
      </In>
    </div>
  );
}

function LineupRows({ sample }: { sample: Sample }) {
  const row = (title: string, list: SampleCastaway[], dim: boolean, from: number) => (
    <div className="mt-1">
      <Heading>{title}</Heading>
      <ul className="grid grid-cols-4 gap-x-2.5 gap-y-3">
        {list.map((c, n) => (
          <In key={c.id} n={from + n}>
            <li className="flex flex-col items-center gap-1.5">
              <Avatar c={c} dim={dim} />
              <span className={cn("w-full truncate text-center text-[13px] font-semibold", dim && "text-muted-foreground")}>{firstName(c.name)}</span>
            </li>
          </In>
        ))}
      </ul>
    </div>
  );
  const starters = sample.starters.map((s) => s.castaway);
  const bench = sample.bench.map((b) => b.castaway);
  return (
    <div className="flex flex-col gap-4">
      {row("Starting", starters, false, 0)}
      {bench.length > 0 && row("On the bench", bench, true, starters.length)}
    </div>
  );
}

function EventsCard({ sample, onShuffle }: { sample: Sample; onShuffle: () => void }) {
  let n = 0;
  return (
    <div>
      <Heading>One episode</Heading>
      <ul className="flex flex-col">
        {sample.starters.map((s) =>
          s.events.map((e, k) => (
            <In key={`${s.castaway.id}:${k}`} n={n++}>
              <li className="flex min-h-12 items-center gap-3 border-b border-border py-1">
                <Avatar c={s.castaway} size="sm" />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-[15px] font-semibold">{s.castaway.name}</span>
                  <span className="truncate text-[13px] text-muted-foreground">{e.label}</span>
                </span>
                <span className={cn("type-caption type-num text-[20px]", e.points < 0 && "text-muted-foreground")}>{signed(e.points)}</span>
              </li>
            </In>
          )),
        )}
        {sample.bench.slice(0, 1).map(
          (b) =>
            b.event && (
              <In key={b.castaway.id} n={n++}>
                <li className="flex min-h-12 items-center gap-3 py-1 text-muted-foreground">
                  <Avatar c={b.castaway} size="sm" dim />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-[15px] font-semibold">{b.castaway.name}</span>
                    <span className="truncate text-[13px]">{b.event.label}</span>
                  </span>
                  <span className="flex flex-col items-end">
                    <span className="type-caption type-num text-[20px] line-through decoration-2">{signed(b.event.points)}</span>
                    <span className="text-[12px]">Not counted, on the bench</span>
                  </span>
                </li>
              </In>
            ),
        )}
      </ul>
      <Standings total={sample.total} rivals={sample.rivals} delay={700} />
      <ShuffleLink onShuffle={onShuffle} />
    </div>
  );
}

function PickupCard({ out, replacement, gone }: { out: SampleCastaway; replacement: SampleCastaway; gone: boolean }) {
  return (
    <div className="flex items-center justify-center gap-4">
      <In n={0} className="flex flex-col items-center gap-2">
        <Avatar c={out} size="lg" dim />
        <span className="max-w-24 truncate text-[13px] font-semibold text-muted-foreground">{firstName(out.name)}</span>
        {gone && (
          <span className="type-caption bg-live px-2 py-1 text-[13px] tracking-[0.04em] text-live-foreground">Went home</span>
        )}
      </In>
      <ArrowRight className="size-6 shrink-0 text-muted-foreground" strokeWidth={2.2} aria-hidden />
      <In n={2} className="flex flex-col items-center gap-2">
        <Avatar c={replacement} size="lg" />
        <span className="max-w-24 truncate text-[13px] font-semibold">{firstName(replacement.name)}</span>
        <span className="type-caption bg-good px-2 py-1 text-[13px] tracking-[0.04em] text-good-foreground">Picked up</span>
      </In>
    </div>
  );
}

function OnePick({ castaway }: { castaway: SampleCastaway }) {
  return (
    <div className="flex flex-col items-center">
      <In n={0} className="flex flex-col items-center">
        <Avatar c={castaway} size="lg" />
        <div className="isolate mt-3 flex h-9 items-stretch bg-plate [--tag-slant:8px]">
          <span className="type-caption tag-cut flex items-center bg-quiet-tag pl-2.5 pr-4 text-[14px] tracking-[0.04em] text-quiet-tag-foreground">
            Your pick
          </span>
          <span className="type-caption tag-tuck flex items-center bg-plate pl-3 pr-3 text-[18px] text-plate-foreground">{castaway.name}</span>
        </div>
      </In>
    </div>
  );
}

function Streak({ picks, onShuffle }: { picks: SampleCastaway[]; onShuffle: () => void }) {
  const results = [true, true, false];
  const best = useCountUp(2, 700);
  return (
    <div>
      <Heading>Your picks, three episodes</Heading>
      <ol className="flex flex-col">
        {picks.map((c, n) => (
          <In key={c.id} n={n}>
            <li className="flex min-h-12 items-center gap-3 border-b border-border py-1">
              <span className="w-14 shrink-0 text-[13px] text-muted-foreground">Ep {n + 1}</span>
              <Avatar c={c} size="sm" />
              <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">{c.name}</span>
              {results[n] ? (
                <span className="type-caption flex h-7 items-center gap-1 bg-good px-2 text-[14px] text-good-foreground">
                  <Check className="size-4" strokeWidth={3} aria-hidden /> Stayed
                </span>
              ) : (
                <span className="type-caption flex h-7 items-center gap-1 bg-live px-2 text-[14px] text-live-foreground">
                  <X className="size-4" strokeWidth={3} aria-hidden /> Went home
                </span>
              )}
            </li>
          </In>
        ))}
      </ol>
      <dl className="mt-4 flex gap-8 px-1">
        <div>
          <dt className="text-[13px] text-muted-foreground">Best streak</dt>
          <dd className="type-caption type-num mt-1 text-[44px] leading-none">{best}</dd>
        </div>
        <div>
          <dt className="text-[13px] text-muted-foreground">Streak now</dt>
          <dd className="type-caption type-num mt-1 text-[44px] leading-none text-muted-foreground">0</dd>
        </div>
      </dl>
      <ShuffleLink onShuffle={onShuffle} />
    </div>
  );
}

function UsedGrid({ picks, pool }: { picks: SampleCastaway[]; pool: SampleCastaway[] }) {
  // The first two picks (both still in) are used up; the rest are free. Capped at 12 for a phone.
  const used = new Set(picks.slice(0, 2).map((c) => c.id));
  const shown = [...picks.slice(0, 2), ...pool.filter((c) => !picks.some((p) => p.id === c.id))].slice(0, 12);
  return (
    <div>
      <Heading>Who you can pick next</Heading>
      <ul className="grid grid-cols-4 gap-x-2.5 gap-y-3">
        {shown.map((c, n) => (
          <In key={c.id} n={n}>
            <li className="flex flex-col items-center gap-1.5">
              <Avatar c={c} dim={used.has(c.id)} />
              <span className={cn("w-full truncate text-center text-[13px] font-semibold", used.has(c.id) && "text-muted-foreground line-through")}>
                {firstName(c.name)}
              </span>
            </li>
          </In>
        ))}
      </ul>
      <p className="mt-3 text-[13px] text-muted-foreground">Crossed out: picked already, so not again until everyone still in has had a turn.</p>
    </div>
  );
}

function WeeklyLoop({ steps }: { steps: string[] }) {
  return (
    <ol className="flex flex-col">
      {steps.map((s, n) => (
        <In key={s} n={n}>
          <li className="flex items-center gap-3.5">
            <span className="type-caption type-num flex size-11 shrink-0 items-center justify-center rounded-[3px] bg-plate text-[22px] text-plate-foreground shadow-plate">
              {n + 1}
            </span>
            <span className="type-caption text-[24px]">{s}</span>
          </li>
          {n < steps.length - 1 && <span aria-hidden className="ml-[21px] block h-4 border-l-2 border-border" />}
        </In>
      ))}
    </ol>
  );
}

function ReplayBadge() {
  return (
    <div className="flex flex-col items-center gap-4">
      <In n={0}>
        <span aria-hidden className="type-caption inline-flex h-10 items-stretch overflow-hidden rounded-[2px] text-[18px] leading-none shadow-plate">
          <span className="flex items-center gap-2 bg-plate px-3 tracking-[0.06em] text-plate-foreground">
            <span className="size-[9px] rounded-full bg-live" />
            Replay
          </span>
          <span className="flex items-center bg-chyron pl-2 pr-3 tracking-[0.04em] text-chyron-foreground [clip-path:polygon(8px_0,100%_0,100%_100%,0_100%)]">
            Ep 1
          </span>
        </span>
      </In>
      <In n={1}>
        <p className="max-w-[30ch] text-center text-pretty text-[15px] leading-snug text-muted-foreground">
          This badge shows which episode you&rsquo;re on. Tap it any time to see where you are or jump to the latest episode.
        </p>
      </In>
    </div>
  );
}
