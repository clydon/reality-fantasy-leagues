"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import type { LeagueState } from "@/lib/game/types";
import StateLogic from "@/lib/game/state-logic.js";
import { CastawayAvatar } from "@/components/castaway-avatar";

const PODIUM_COLORS = ["#c9a227", "#9aa3ab", "#b0703c"]; // gold, silver, bronze
const CONFETTI_COLORS = ["#c9a227", "#e4572e", "#4f9d69", "#3d7cc9", "#a45ec9", "#f2b134"];

// Overview's season-over announcement: only once the season's winner is known (for a catching-up
// league, once that's been revealed -- results only reach the state when revealed). The league's
// champion up top with confetti bursting out of the card, then the rest of the podium.
export function SeasonResultsCard({ state }: { state: LeagueState }) {
  const cardRef = useRef<HTMLDivElement>(null);
  if (!StateLogic.RevealLogic.isComplete(state)) return null;
  const scores = StateLogic.computeScores(state);
  if (scores.length === 0) return null;
  const pickem = StateLogic.getLeagueType(state).hasWeeklyPicks;
  const top = scores[0];
  // Shared first place: everyone level with the leader on what the standings rank by.
  const champs = scores.filter((r) => r.total === top.total && (!pickem || (r.longestStreak ?? 0) === (top.longestStreak ?? 0)));
  const rest = scores.slice(champs.length, 3);
  const winnerMethod = StateLogic.formatOf(state).winnerExitMethod;
  const showWinner = state.castaways.find((c) => c.exitMethod === winnerMethod);
  const score = (r: (typeof scores)[number]) => (pickem ? `${r.longestStreak ?? 0} streak` : `${r.total} pts`);

  return (
    <div ref={cardRef} className="relative mb-4 rounded-lg border-2 bg-card p-4 text-center shadow-sm" style={{ borderColor: PODIUM_COLORS[0] }}>
      <Confetti anchor={cardRef} />
      <div className="text-[0.7rem] font-bold uppercase tracking-wide text-muted-foreground">Season complete</div>
      <div className="mt-2 text-3xl" aria-hidden>
        🏆
      </div>
      <div className="mt-1 text-xl font-bold">
        {champs.map((c, i) => (
          <span key={c.playerId}>
            {i > 0 && " & "}
            <span style={{ color: c.color }}>{c.name}</span>
          </span>
        ))}
      </div>
      <div className="text-sm text-muted-foreground">
        {champs.length > 1 ? "share the league title" : "wins the league"} · {score(top)}
      </div>
      {rest.length > 0 && (
        <div className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1 text-sm">
          {rest.map((r, i) => (
            <span key={r.playerId} className="flex items-center gap-1.5">
              <span
                className="flex h-4 w-4 items-center justify-center rounded-full font-mono text-[0.6rem] font-bold text-white"
                style={{ background: PODIUM_COLORS[champs.length + i] ?? PODIUM_COLORS[2] }}
              >
                {champs.length + i + 1}
              </span>
              <span className="font-semibold">{r.name}</span>
              <span className="font-mono text-xs text-muted-foreground">{score(r)}</span>
            </span>
          ))}
        </div>
      )}
      {showWinner && (
        <div className="mt-3 flex items-center justify-center gap-2 border-t border-border pt-3 text-xs text-muted-foreground">
          <CastawayAvatar castaway={showWinner} className="flex h-6 w-6 items-center justify-center rounded-md bg-secondary text-[0.55rem] font-bold" />
          <span>
            <b className="text-foreground">{showWinner.name}</b> won the season
          </span>
        </div>
      )}
    </div>
  );
}

// ~36 pieces fanned out across the top of the card. Spread is deterministic (no Math.random in
// render), varied enough by index to read as a burst. Hidden under prefers-reduced-motion.
function Confetti({ anchor }: { anchor: React.RefObject<HTMLDivElement | null> }) {
  // Drawn in a full-screen fixed overlay portalled to <body>, clipped to the screen -- never part of
  // the page's own layout, scroll or paint. Inside the card, the pieces (flying well past it) widened
  // the page, and the animation's start and end disturbed Android Chrome's painting of the fixed tab
  // bar. The burst starts from the card's position on screen at mount, and the overlay goes once
  // it's played.
  const [origin, setOrigin] = useState<{ x: number; y: number } | null>(null);
  const [done, setDone] = useState(false);
  useEffect(() => {
    const r = anchor.current?.getBoundingClientRect();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- measured once, after layout
    if (r) setOrigin({ x: r.left + r.width / 2, y: r.top + 40 });
    const t = setTimeout(() => setDone(true), 2400);
    return () => clearTimeout(t);
  }, [anchor]);
  const pieces = Array.from({ length: 36 }, (_, i) => {
    const angle = -Math.PI / 2 + ((i * 137.5) % 180 - 90) * (Math.PI / 180) * 0.95; // fan above the card
    const dist = 70 + ((i * 53) % 90);
    return {
      i,
      style: {
        "--dx": `${Math.round(Math.cos(angle) * dist * 1.8)}px`,
        "--dy": `${Math.round(Math.sin(angle) * dist)}px`,
        "--rot": `${(i % 2 ? 1 : -1) * (240 + ((i * 71) % 360))}deg`,
        background: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        width: i % 3 ? 7 : 5,
        height: i % 3 ? 11 : 5,
        borderRadius: i % 4 === 0 ? "50%" : 1,
        animationDelay: `${(i % 6) * 25}ms`,
      } as CSSProperties,
    };
  });
  if (done || !origin) return null;
  return createPortal(
    <div className="pointer-events-none fixed inset-0 z-[60] overflow-hidden" aria-hidden>
      <div className="absolute h-0 w-0" style={{ left: origin.x, top: origin.y }}>
        {pieces.map((p) => (
          <span key={p.i} className="confetti-piece absolute left-0 top-0" style={p.style} />
        ))}
      </div>
    </div>,
    document.body
  );
}
