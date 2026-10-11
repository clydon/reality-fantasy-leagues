"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Clock, Lock } from "lucide-react";
import type { Episode, LeagueState } from "@/lib/game/types";
import StateLogic from "@/lib/game/state-logic.js";
import { useLeagueStore, useMyPlayerId } from "@/lib/store";
import { useMutate } from "@/lib/use-mutate";
import { api } from "@/lib/api";
import { sortByTribe } from "@/lib/game/sort-by-tribe";
import { lockLine } from "@/lib/game/lineup-view";
import { nameList, pickWindow } from "@/lib/game/pool-view";
import { useShowTerms } from "@/lib/use-show-terms";
import { BarButton, CastTile, ConfirmBar, TileGrid, shortNames, useTribeFilter } from "@/components/draft/draft-ui";
import { RevealFirst, useHiddenResults } from "@/components/results-in-banner";

// Eliminator Pool's Pick page (the canvas's "A · Eliminator Pool": Pool-Pick). This week's episode
// (StateLogic.pickEmUpcomingEpisode), everyone still in the game as tiles, and the same
// select-then-confirm bar as every other picker: tap who you think survives, then Lock in. Picks
// close when the episode starts airing (PickEmLogic.setPick). Self-service only: this sets YOUR pick.
export function PickPage() {
  const state = useLeagueStore((s) => s.state);
  const myPlayerId = useMyPlayerId();
  const { blocksChoices } = useHiddenResults();
  const { ep } = pickWindow(state);

  if (!StateLogic.getLeagueType(state).hasWeeklyPicks) {
    return (
      <p className="text-base text-muted-foreground">
        This league doesn&rsquo;t make weekly picks.{" "}
        <Link href="/" className="font-semibold text-chyron-line">
          Go to Overview
        </Link>
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex min-h-11 items-center gap-3 max-nav:hidden">
        <h2 className="type-caption flex-1 text-[28px]">Pick</h2>
        {ep && <span className="text-sm text-muted-foreground">Episode {ep.number}</span>}
      </div>
      {blocksChoices ? (
        <RevealFirst what="make your next pick" />
      ) : !ep ? (
        <p className="text-base text-muted-foreground">There&rsquo;s no episode to pick for yet.</p>
      ) : !myPlayerId ? (
        <p className="text-base text-muted-foreground">Only players in this league make picks.</p>
      ) : (
        <PickGrid key={ep.id} state={state} ep={ep} playerId={myPlayerId} />
      )}
    </div>
  );
}

function PickGrid({ state, ep, playerId }: { state: LeagueState; ep: Episode; playerId: string }) {
  const leagueId = useLeagueStore((s) => s.leagueId);
  const terms = useShowTerms();
  const mutate = useMutate();
  const { open } = pickWindow(state);
  const { blocked } = StateLogic.pickEmEligibility(state, ep.id, playerId);
  const myPick = StateLogic.pickEmPickFor(state, ep.id, playerId)?.castawayId ?? null;
  const [selected, setSelected] = useState<string | null>(null);
  const chosen = selected ?? myPick;

  const cast = sortByTribe(
    state.castaways.filter((c) => c.status !== "eliminated"),
    state,
  );
  const names = shortNames(cast);
  const { shown, chips } = useTribeFilter(cast, state);
  const nameOf = (id: string | null) => (id ? (StateLogic.getCastaway(state, id)?.name ?? "?") : null);

  // Why the greyed ones are greyed, in one sentence each.
  const cycle = cast.filter((c) => blocked[c.id]?.reason === "cycle").map((c) => names.get(c.id) ?? c.name);
  const last = cast.find((c) => blocked[c.id]?.reason === "backToBack");
  const rules = [
    cycle.length > 0 && `${nameList(cycle)} ${cycle.length === 1 ? "is" : "are"} used until you've picked everyone still in.`,
    last && `${names.get(last.id)} was your last pick, so not twice in a row.`,
  ].filter(Boolean);

  // "Locked in." for a moment after it lands.
  const [saved, setSaved] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => clearTimeout(timer.current ?? undefined), []);

  async function lockIn() {
    if (!open || !selected) return;
    const id = selected;
    const ok = await mutate(
      (s) => StateLogic.setPickEmPick(s, ep.id, playerId, id),
      () => api.setPickEmPick(leagueId!, ep.id, playerId, id),
    );
    if (!ok) return;
    setSelected(null);
    setSaved(true);
    clearTimeout(timer.current ?? undefined);
    timer.current = setTimeout(() => setSaved(false), 1500);
  }

  const when = lockLine(ep);
  // A catch-up league's episodes have no air time: picks close when the commissioner reveals it.
  const catchingUp = StateLogic.RevealLogic.isCatchingUp(state);
  const until = catchingUp ? "it's revealed" : "it airs";
  const changing = !!selected && selected !== myPick;
  const first = (id: string | null) => (id ? (names.get(id) ?? nameOf(id)) : null);

  return (
    <>
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        {open ? <Clock className="size-[18px] shrink-0" aria-hidden /> : <Lock className="size-[18px] shrink-0" aria-hidden />}
        <span>
          {open
            ? (when ?? (catchingUp ? `Open until Episode ${ep.number} is revealed` : `Locks when Episode ${ep.number} starts`))
            : `Episode ${ep.number} has started. Picks are closed.`}
        </span>
      </p>
      {open && (
        <p className="text-[15px] leading-snug">
          Who survives Episode {ep.number}?{" "}
          <span className="text-muted-foreground">
            {rules.length > 0
              ? rules.join(" ")
              : `Anyone still in. No repeats until you've picked every ${terms.castaway}, and never the same one twice in a row.`}
          </span>
        </p>
      )}
      {chips}
      <TileGrid>
        {shown.map((c) => {
          const used = blocked[c.id];
          return (
            <CastTile
              key={c.id}
              castaway={c}
              label={names.get(c.id) ?? c.name}
              state={state}
              mark={chosen === c.id ? "add" : undefined}
              dim={!!used}
              detail={used ? (used.reason === "backToBack" ? `Last pick · Ep ${used.episode}` : `Used Ep ${used.episode}`) : undefined}
              disabled={!open || !!used}
              onClick={() => setSelected(selected === c.id ? null : c.id)}
            />
          );
        })}
      </TileGrid>
      <Link href="/setup/rules" className="self-start text-sm font-semibold text-chyron-line hover:underline">
        How the Pool scores
      </Link>
      {!open ? (
        <ConfirmBar note="Your pick" title={nameOf(myPick) ?? "No pick"} />
      ) : changing ? (
        <ConfirmBar note={myPick ? `Your pick · changing from ${first(myPick)}` : "Your pick"} title={nameOf(selected)}>
          <BarButton onClick={lockIn}>Lock in {first(selected)}</BarButton>
        </ConfirmBar>
      ) : myPick ? (
        <ConfirmBar note={saved ? `Locked in. You can change it until ${until}.` : `Your pick · you can change it until ${until}`} title={nameOf(myPick)}>
          <BarButton onClick={lockIn} disabled>
            Locked in
          </BarButton>
        </ConfirmBar>
      ) : (
        <ConfirmBar note="Tap who you think survives" title="Nobody yet">
          <BarButton onClick={lockIn} disabled>
            Lock in
          </BarButton>
        </ConfirmBar>
      )}
    </>
  );
}
