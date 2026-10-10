"use client";

import Link from "next/link";
import { Check, Plus, X } from "lucide-react";
import type { Episode, LeagueState, Player } from "@/lib/game/types";
import StateLogic from "@/lib/game/state-logic.js";
import { useMyPlayerId } from "@/lib/store";
import { pickSlots, pickWindow, type PickSlot } from "@/lib/game/pool-view";
import { CastawayAvatar } from "@/components/castaway-avatar";
import { RevealFirst, useHiddenResults } from "@/components/results-in-banner";
import { SectionHead } from "@/components/draft/draft-ui";
import { ordinal, poolKey, rankLabels } from "@/components/scoreboard/scoreboard-tab";
import { cn } from "cn";

// Eliminator Pool on Overview (the canvas's "A · Eliminator Pool": Pool-Home). The pick itself is
// made on its own page (/pick, the tab bar's Pick); here is where it leaves you:
//   your streak     -- the one number this league type is about, and where it puts you
//   your picks      -- the last few, each survived or went home, then this week's (or an open slot)
// Who else has picked this week is a chip on each Standings row (standings-card.tsx).
export function PickEmPickGrid({ state }: { state: LeagueState }) {
  const me = useMyPlayerId();
  const { hidden } = useHiddenResults();
  const { ep, open } = pickWindow(state);
  const players = state.players.filter((p) => p.active !== false);

  if (hidden.length > 0) {
    // The picks for the first unrevealed episode were locked before it aired, so nothing in them
    // gives a result away -- and otherwise you'd have no idea who you went with.
    const lockedEp = hidden[0];
    return (
      <section className="flex flex-col gap-3 sm:col-span-2">
        <RevealFirst what="make your next pick" />
        <WhoPicked state={state} ep={lockedEp} players={players} me={me} open={false} />
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-5 sm:col-span-2">
      {me && <Streak state={state} me={me} />}
      {me && <YourPicks state={state} me={me} ep={ep} open={open} />}
    </section>
  );
}

// "3 in a row", and where that leaves you. The league ranks by longest streak (poolKey), so that's
// the standing quoted; the big number is the streak you're on now.
function Streak({ state, me }: { state: LeagueState; me: string }) {
  const history = StateLogic.pickEmHistory(state, me);
  const settled = history.rows.filter((r) => r.correct !== null);
  if (settled.length === 0) return null;
  const scores = StateLogic.computeScores(state);
  const ranks = rankLabels(scores, poolKey);
  const i = scores.findIndex((r) => r.playerId === me);
  const rank = ranks[i];
  const level = ranks.every((r) => r === ranks[0]);
  const tiedWith = scores.filter((r, j) => j !== i && ranks[j] === rank).map((r) => r.name);
  const place = rank ? ordinal(parseInt(rank.replace("T", ""), 10)) : null;

  const now = history.currentStreak;
  const lastRow = settled[settled.length - 1];
  const lines = [
    now > 0
      ? now === settled.length
        ? "Every pick has survived so far."
        : `Your last ${now === 1 ? "pick" : `${now} picks`} survived.`
      : lastRow.castawayId
        ? `Your Episode ${lastRow.episode} pick went home.`
        : `No pick for Episode ${lastRow.episode}.`,
    history.longestStreak > now && `Your best is ${history.longestStreak}.`,
    place &&
      (level
        ? "Everyone's level."
        : tiedWith.length === 1
          ? `Tied for ${place} with ${tiedWith[0]}.`
          : tiedWith.length > 1
            ? `Tied for ${place}.`
            : `${place} in the league.`),
  ].filter(Boolean);

  return (
    <div className="flex items-center gap-[18px]">
      <span className="type-num text-[104px] leading-[0.8]">{now}</span>
      <span className="flex min-w-0 flex-col gap-1.5">
        <span className="type-caption text-[30px]">In a row</span>
        <span className="text-[15px] leading-snug text-muted-foreground">{lines.join(" ")}</span>
      </span>
    </div>
  );
}

// The last few picks, oldest first, then this week's: your pick (tap to change it while it's open)
// or an open slot to make one.
function YourPicks({ state, me, ep, open }: { state: LeagueState; me: string; ep: Episode | null; open: boolean }) {
  const slots = pickSlots(state, me);
  const hasThisWeek = !!ep && slots.some((s) => s.episode === ep.number);
  const shown = slots.slice(-(hasThisWeek ? 5 : 4));
  if (shown.length === 0 && !ep) return null;
  return (
    <section className="flex flex-col gap-2.5">
      <SectionHead
        aside={
          slots.some((s) => s.correct !== null) && (
            <Link href={`/scoreboard/${encodeURIComponent(me)}`} className="flex min-h-11 items-center text-sm font-semibold text-chyron-line hover:underline">
              All picks
            </Link>
          )
        }
      >
        Your picks
      </SectionHead>
      <ol className="grid grid-cols-5 gap-2 sm:grid-cols-[repeat(5,80px)] sm:gap-3">
        {shown.map((s) => (
          <PickItem key={s.episode} slot={s} href={open && ep?.number === s.episode ? "/pick" : undefined} />
        ))}
        {ep && !hasThisWeek && (
          <li className="flex min-w-0 flex-col items-center gap-1">
            {open ? (
              <Link
                href="/pick"
                aria-label={`Make your Episode ${ep.number} pick`}
                className="flex size-16 items-center justify-center rounded-[3px] border-2 border-dashed border-foreground/70 text-foreground hover:bg-accent"
              >
                <Plus className="size-6" strokeWidth={2.4} aria-hidden />
              </Link>
            ) : (
              <span className="size-16 rounded-[3px] border-2 border-dashed border-border" aria-hidden />
            )}
            <span className="text-[13px] font-semibold">Ep {ep.number}</span>
            <span className="text-xs text-muted-foreground">{open ? "Open" : "No pick"}</span>
          </li>
        )}
      </ol>
    </section>
  );
}

function PickItem({ slot, href }: { slot: PickSlot; href?: string }) {
  const { castaway: c, correct } = slot;
  const face = c ? (
    <span className="relative inline-flex size-16">
      <CastawayAvatar
        castaway={c}
        className={cn(
          "flex size-16 items-center justify-center overflow-hidden rounded-[3px] bg-muted text-xs font-bold text-muted-foreground [&_img]:object-top",
          correct === false && "grayscale brightness-[.6]",
        )}
      />
      {correct !== null && (
        <span
          className={cn(
            "absolute -bottom-1.5 -right-1.5 flex size-[22px] items-center justify-center rounded-full",
            correct ? "bg-good text-good-foreground" : "bg-live text-live-foreground",
          )}
          aria-hidden
        >
          {correct ? <Check className="size-3.5" strokeWidth={3} /> : <X className="size-3.5" strokeWidth={3} />}
        </span>
      )}
    </span>
  ) : (
    <span className="flex size-16 items-center justify-center rounded-[3px] border-2 border-dashed border-border text-muted-foreground" aria-hidden>
      &ndash;
    </span>
  );
  const label = c ? c.name.split(" ")[0] : "No pick";
  const status = correct === null ? (href ? "Change" : "Locked in") : correct ? "Survived" : c ? "Went home" : "Missed";
  return (
    <li className="flex min-w-0 flex-col items-center gap-1" aria-label={`Episode ${slot.episode}: ${c ? c.name : "no pick"}, ${status.toLowerCase()}`}>
      {href ? (
        <Link href={href} className="rounded-[3px] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-chyron-line">
          {face}
        </Link>
      ) : (
        face
      )}
      <span className="w-full truncate text-center text-[13px] font-semibold">{label}</span>
      <span className="text-xs text-muted-foreground">Ep {slot.episode}</span>
    </li>
  );
}

// Who's picked for this week. While it's open only "Picked" or "Not yet" (what they picked shows once
// it airs); after that, each one's pick.
function WhoPicked({ state, ep, players, me, open }: { state: LeagueState; ep: Episode; players: Player[]; me: string | null; open: boolean }) {
  const ordered = [...players.filter((p) => p.id === me), ...players.filter((p) => p.id !== me)];
  const picked = players.filter((p) => StateLogic.pickEmPickFor(state, ep.id, p.id)).length;
  return (
    <section className="flex flex-col gap-1">
      <SectionHead aside={<span className="pb-1.5 text-[13px] text-muted-foreground">{picked} of {players.length} picked</span>}>
        Episode {ep.number} picks
      </SectionHead>
      <div className="flex flex-col border-b border-border">
        {ordered.map((p) => {
          const pk = StateLogic.pickEmPickFor(state, ep.id, p.id);
          const c = pk ? StateLogic.getCastaway(state, pk.castawayId) : null;
          const showPick = !!c && (!open || p.id === me);
          return (
            <div key={p.id} className="flex min-h-12 items-center gap-3 border-t border-border py-1.5">
              <span className="size-2.5 shrink-0 rounded-full" style={{ background: p.color }} aria-hidden />
              <span className="min-w-0 flex-1 truncate text-base font-semibold">
                {p.id === me ? "You" : p.name}
                {showPick && <span className="font-normal text-muted-foreground"> &middot; {c!.name}</span>}
              </span>
              {showPick && (
                <CastawayAvatar
                  castaway={c!}
                  className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-[2px] bg-muted text-[10px] font-bold text-muted-foreground [&_img]:object-top"
                />
              )}
              {open && (
                <span
                  className={cn(
                    "shrink-0 rounded-[2px] px-1.5 py-px text-[11px] font-bold uppercase tracking-wide",
                    pk ? "bg-good text-good-foreground" : "bg-muted text-muted-foreground",
                  )}
                >
                  {pk ? "Picked" : "Not yet"}
                </span>
              )}
              {!open && !pk && <span className="shrink-0 text-[13px] text-muted-foreground">No pick</span>}
            </div>
          );
        })}
      </div>
    </section>
  );
}
