"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Clock, Lock } from "lucide-react";
import type { Castaway, LeagueState } from "@/lib/game/types";
import StateLogic from "@/lib/game/state-logic.js";
import { formatDateTime } from "@/lib/game/selectors";
import { sortByTribe } from "@/lib/game/sort-by-tribe";
import { useShowTerms } from "@/lib/use-show-terms";
import { useLeagueStore, useCanManage, useMyPlayerId } from "@/lib/store";
import { api, ApiError } from "@/lib/api";
import { Select } from "@/components/ui/select";
import { CaptionPlate } from "@/components/ui/caption-plate";
import { cn } from "cn";
import { BarButton, CastTile, ConfirmBar, PhotoSquare, PlainButton, SectionHead, TileGrid, TurnPill, shortNames, useTribeFilter } from "./draft-ui";
import { DraftTeams } from "./draft-teams";
import { CastPreview, NotStartedPlate, StartDraftButton } from "./snake-draft";

// The blind draft (shared ownership; the canvas's "Shared draft: pick 13 blind" and "Shared draft
// revealed"). Everyone picks their whole team privately, nothing shows until every player has locked
// in, then all of it reveals at once and the same castaway can be on several teams.
//
// Deliberately does NOT use useMutate: every other mutation in this app is "mutate state, get the
// whole new state back", but a blind submission's contents never enter league state at all (see
// src/lib/server/blind-draft.ts), so there's nothing for mock mode to mutate locally and the errors
// here are real, user-facing validation messages rather than the generic alert() useMutate does.
// Shared mode can't be reached in mock mode anyway (the demo league is exclusive), so a mock branch
// would be dead code.
export function BlindDraftPanel({ state }: { state: LeagueState }) {
  const terms = useShowTerms();
  const leagueId = useLeagueStore((s) => s.leagueId);
  const setState = useLeagueStore((s) => s.setState);
  const canManage = useCanManage();
  const myPlayerId = useMyPlayerId();

  // Commissioner can submit on someone's behalf so an absent player can't stall the draft; they
  // cannot READ anyone else's picks, which is why the "your locked picks" fetch below is only ever
  // made for your own seat. See the GET route's comment.
  const [actingPlayerId, setActingPlayerId] = useState<string>(myPlayerId ?? "");
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Active Roster derives this from its slot settings, so ask through rosterSize rather than
  // reading teamSize -- otherwise a blind draft in an Active Roster league would demand the wrong
  // number of picks from what the routes will accept.
  const teamSize = StateLogic.rosterSize(state);
  const started = StateLogic.isDraftStarted(state);
  const revealed = StateLogic.BlindDraftLogic.isRevealed(state);
  const eligible = StateLogic.BlindDraftLogic.eligiblePlayers(state);
  const waitingOn = StateLogic.BlindDraftLogic.waitingOn(state);
  // Grouped by faction once tribes are set, alphabetical otherwise -- same rule as the turn-based
  // draft (sort-by-tribe.ts), so both kinds of draft look alike.
  const activeCast = sortByTribe(state.castaways.filter((c) => c.status === "active"), state);
  const { shown, chips } = useTribeFilter(activeCast, state);
  const names = shortNames(activeCast);
  const iHaveLocked = !!actingPlayerId && StateLogic.BlindDraftLogic.hasLocked(state, actingPlayerId);

  // Your own submission survives a page refresh -- it isn't in league state (that's the whole point),
  // so it takes its own request. Only ever for YOUR seat, never for whoever the commissioner is
  // acting as: the route refuses anyone else's anyway. Keyed on the locked-in count so withdrawing
  // (or a poll landing someone else's lock) refetches rather than showing a stale list.
  const { data: myPicksData } = useQuery({
    queryKey: ["blind-picks", leagueId, myPlayerId, state.blindDraft.lockedPlayerIds.length],
    queryFn: () => api.myBlindPicks(leagueId!, myPlayerId!),
    enabled: !!leagueId && !!myPlayerId && !revealed,
  });
  const myLockedPicks = myPicksData?.castawayIds ?? null;

  function toggle(castawayId: string) {
    setError(null);
    setSelected((cur) => {
      if (cur.includes(castawayId)) return cur.filter((id) => id !== castawayId);
      if (cur.length >= teamSize) return cur; // full -- deselect something first
      return [...cur, castawayId];
    });
  }

  async function lockIn() {
    if (!leagueId || !actingPlayerId) return;
    setBusy(true);
    setError(null);
    try {
      const next = await api.lockBlindPicks(leagueId, actingPlayerId, selected);
      setState(next);
      setSelected([]);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not lock in your picks.");
    } finally {
      setBusy(false);
    }
  }

  async function withdraw() {
    if (!leagueId || !actingPlayerId) return;
    setBusy(true);
    setError(null);
    try {
      const next = await api.unlockBlindPicks(leagueId, actingPlayerId);
      setState(next);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not withdraw your picks.");
    } finally {
      setBusy(false);
    }
  }

  // DraftBoard swaps this panel out for the reveal once it's happened, so there's no post-reveal
  // branch here; this guard only covers the brief window where a poll lands the revealed state
  // before the parent re-renders.
  if (revealed) return null;

  const lockStrip = (
    <div className="flex flex-wrap gap-1.5" aria-label="Who's locked in">
      {eligible.map((p) => {
        const locked = StateLogic.BlindDraftLogic.hasLocked(state, p.id);
        return (
          <TurnPill key={p.id} you={p.id === myPlayerId}>
            {locked ? <Lock className="size-3.5" strokeWidth={2.4} aria-label="Locked in" /> : <Clock className="size-3.5" strokeWidth={2.4} aria-label="Still picking" />}
            {p.id === myPlayerId ? "You" : p.name}
          </TurnPill>
        );
      })}
    </div>
  );

  if (!started) {
    return (
      <div className="flex flex-col gap-6">
        <NotStartedPlate state={state} />
        <section className="flex flex-col gap-2">
          <SectionHead>How it works</SectionHead>
          <p className="text-base">
            Everyone picks {teamSize} {teamSize === 1 ? terms.castaway : terms.castaways} at once, in private.{" "}
            <span className="text-muted-foreground">
              Nothing shows until every player locks in. The same {terms.castaway} can be on several teams, so there&rsquo;s no rush.
            </span>
          </p>
          {lockStrip}
        </section>
        {canManage && <StartDraftButton state={state} blind />}
        <CastPreview state={state} />
      </div>
    );
  }

  const left = teamSize - selected.length;
  const waitingLine =
    waitingOn.length === 0 ? "Revealing…" : `Waiting on ${waitingOn.length} other player${waitingOn.length === 1 ? "" : "s"}.`;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-base">
        Pick {teamSize} {teamSize === 1 ? terms.castaway : terms.castaways}.{" "}
        <span className="text-muted-foreground">
          Picks stay hidden until all {eligible.length} players lock in. Anyone can be on several teams.
        </span>
      </p>
      {lockStrip}

      {canManage && (
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">Submitting for</span>
          <Select
            value={actingPlayerId}
            onChange={(e) => {
              setActingPlayerId(e.target.value);
              setSelected([]);
              setError(null);
            }}
          >
            <option value="">Choose a player</option>
            {eligible.map((p) => (
              <option key={p.id} value={p.id}>
                {p.id === myPlayerId ? `${p.name} (you)` : p.name}
                {StateLogic.BlindDraftLogic.hasLocked(state, p.id) ? ", locked in" : ""}
              </option>
            ))}
          </Select>
          <span className="text-[13px] text-muted-foreground">You can lock in for someone who&rsquo;s away, but you can&rsquo;t see anyone else&rsquo;s picks.</span>
        </label>
      )}

      {!actingPlayerId ? (
        <p className="text-base text-muted-foreground">Choose who you&rsquo;re submitting for.</p>
      ) : iHaveLocked ? (
        <div className="flex flex-col gap-4">
          <CaptionPlate
            tone="good"
            tag="Locked"
            title={actingPlayerId === myPlayerId ? "You're locked in" : `${StateLogic.getPlayer(state, actingPlayerId)?.name ?? "They"}'s locked in`}
            subtitle={waitingLine}
          />
          {actingPlayerId === myPlayerId && myLockedPicks && (
            <section className="flex flex-col gap-2">
              <SectionHead>Your picks</SectionHead>
              <PhotoGrid cast={myLockedPicks.map((id) => StateLogic.getCastaway(state, id)).filter((c): c is Castaway => !!c)} />
            </section>
          )}
          <PlainButton onClick={withdraw} disabled={busy}>
            Withdraw and re-pick
          </PlainButton>
        </div>
      ) : (
        <>
          {chips}
          <TileGrid>
            {shown.map((c) => {
              const isSel = selected.includes(c.id);
              const full = !isSel && left === 0;
              return (
                <CastTile
                  key={c.id}
                  castaway={c}
                  label={names.get(c.id)!}
                  state={state}
                  photoHeight={64}
                  mark={isSel ? "add" : undefined}
                  dim={full}
                  disabled={full}
                  onClick={() => toggle(c.id)}
                />
              );
            })}
          </TileGrid>
          <ConfirmBar
            note={left > 0 ? `${left} to go. Nobody sees them until everyone locks in.` : "All set. You can still change them before locking in."}
            title={`${selected.length} of ${teamSize} picked`}
          >
            <BarButton onClick={lockIn} disabled={busy || left !== 0}>
              Lock in
            </BarButton>
          </ConfirmBar>
        </>
      )}

      {error && <p className="text-sm font-semibold text-destructive">{error}</p>}
    </div>
  );
}

function PhotoGrid({ cast, badge }: { cast: Castaway[]; badge?: (c: Castaway) => React.ReactNode }) {
  const names = shortNames(cast);
  return (
    <ul className="grid grid-cols-5 gap-x-1.5 gap-y-3 sm:grid-cols-7">
      {cast.map((c) => (
        <li key={c.id} className="flex min-w-0 flex-col items-center gap-1">
          <PhotoSquare castaway={c} size={54} expandable badge={badge?.(c)} faded={c.status === "eliminated"} />
          <span className="w-full truncate text-center text-[11px] font-bold">{names.get(c.id)}</span>
        </li>
      ))}
    </ul>
  );
}

/** After the reveal: your team with how many teams share each pick, the most-picked, then everyone else. */
export function BlindReveal({ state }: { state: LeagueState }) {
  const terms = useShowTerms();
  const me = useMyPlayerId();
  const size = StateLogic.rosterSize(state);
  const players = state.players.filter((p) => StateLogic.originalDraftPicks(state, p.id).length > 0);
  // How many teams drafted each castaway.
  const shares = new Map<string, string[]>();
  for (const p of players) {
    for (const c of StateLogic.originalDraftPicks(state, p.id)) shares.set(c.id, [...(shares.get(c.id) ?? []), p.id]);
  }
  const countOf = (c: Castaway) => shares.get(c.id)?.length ?? 0;
  const badge = (c: Castaway) => {
    const n = countOf(c);
    return (
      <span
        className={cn(
          "absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] font-extrabold",
          n === 1 ? "bg-foreground text-background" : "bg-input text-foreground",
        )}
      >
        {n === 1 ? "only" : `×${n}`}
      </span>
    );
  };
  const mine = me ? StateLogic.originalDraftPicks(state, me) : [];
  const onlyMine = mine.filter((c) => countOf(c) === 1);
  const most = [...shares.entries()]
    .filter(([, ids]) => ids.length > 1)
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 3)
    .map(([id, ids]) => ({ c: StateLogic.getCastaway(state, id)!, ids }))
    .filter((x) => x.c);
  const at = formatDateTime(state.blindDraft.revealedAt);

  return (
    <div className="flex flex-col gap-6">
      <CaptionPlate
        tone="good"
        tag="Done"
        title={`Everyone's ${size} ${size === 1 ? "is" : "are"} in`}
        subtitle={at ? `Picks revealed at once, ${at}` : "Picks revealed at once"}
      />

      {mine.length > 0 && (
        <section className="flex flex-col gap-2">
          <SectionHead>Your {size}</SectionHead>
          <PhotoGrid cast={mine} badge={badge} />
          <p className="text-[13px] text-muted-foreground">
            The number is how many teams share that {terms.castaway}.
            {onlyMine.length > 0 && ` Only you have ${listNames(onlyMine.map((c) => c.name.split(" ")[0]))}.`}
          </p>
        </section>
      )}

      {most.length > 0 && (
        <section className="flex flex-col gap-1">
          <SectionHead>Most picked</SectionHead>
          <ul className="border-b border-border">
            {most.map(({ c, ids }) => (
              <li key={c.id} className="flex min-h-14 items-center gap-3 border-t border-border">
                <PhotoSquare castaway={c} expandable />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate text-base font-semibold">{c.name}</span>
                  <span className="truncate text-[13px] text-muted-foreground">
                    {ids.length === players.length
                      ? "On every team"
                      : listNames(ids.map((id) => (id === me ? "You" : (StateLogic.getPlayer(state, id)?.name ?? "?"))))}
                  </span>
                </span>
                <span className="rounded-[2px] bg-input px-1.5 py-px text-[11px] font-bold uppercase tracking-wide">×{ids.length}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <SectionHead>{mine.length > 0 ? "Other teams" : "Teams"}</SectionHead>
        <DraftTeams state={state} badge={badge} skip={mine.length > 0 ? me : null} />
      </section>
    </div>
  );
}

function listNames(names: string[]): string {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}
