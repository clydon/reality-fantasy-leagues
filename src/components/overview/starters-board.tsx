"use client";

import { useEffect, useRef, useState } from "react";
import type { Castaway, Episode, LeagueState, Player } from "@/lib/game/types";
import StateLogic from "@/lib/game/state-logic.js";
import { castawayEpisodeStats } from "@/lib/game/active-roster-rows";
import { useMyPlayerId } from "@/lib/store";
import { useShowTerms } from "@/lib/use-show-terms";
import { CastawayAvatar } from "@/components/castaway-avatar";
import { CastawayStatCard } from "@/components/castaway-stat-card";
import { cn } from "cn";
import { formatInTz } from "@/lib/game/air-schedule.js";
import { isKnockedOut } from "@/lib/game/selectors";
import { LineupEditor } from "./active-roster-lineup-grid";

// Active Roster's Board: who each player is starting, then the whole cast as compact chips grouped
// by current tribe. Replaces BoardGrid's full cards for this league type -- with starters being the
// thing that actually scores, "who's fielding whom" is the question the board has to answer first.
//
// Always this week's episode (StateLogic.currentEpisode), live: a player's starters show the moment
// they set them (the league poll syncs lineups -- use-league-poll.ts), and the lock only stops
// changes once the episode starts airing (ActiveRosterLogic.isLineupLocked). With no upcoming
// episode (the season's over), the last scored one, with what each starter scored.
//
// The commissioner can switch on settings.hideStartersUntilLock: then, while the episode is still
// open, other players' rows show only whether they're set -- not their starters, and not their bench
// either, since a bench is just the starters by omission. A courtesy, not a secret: every lineup is
// in the league state the client already holds.
//
// Your own lineup is set from here too: "Set lineup" / "Edit lineup" swaps everyone's rows (and the
// cast) for the lineup editor -- the same Active + Roster view as the separate lineup card
// (LineupEditor) -- and the button becomes "Done". Each tap saves as it's made, so there's nothing to
// save or cancel: Done just goes back, and "Saved ✓" confirms each change. Only for this week's
// episode while it's still open, and only for someone with a roster.
export function StartersBoard({ state }: { state: LeagueState }) {
  const myPlayerId = useMyPlayerId();
  const scored = (ep: Episode) => StateLogic.ActiveRosterLogic.episodeEvents(state, ep).length > 0;
  // Spoiler protection (SpoilerLogic.viewThrough): with results this viewer hasn't revealed, stay on
  // the first such episode -- moving on to the next one would give the boot away, its lineups already
  // missing whoever went home.
  const firstHidden = [...state.episodes].filter((ep) => ep.resultsHidden).sort((a, b) => a.number - b.number)[0];
  const shown =
    firstHidden ??
    StateLogic.currentEpisode(state) ??
    [...state.episodes].filter((ep) => StateLogic.inPlay(state, ep.number) && scored(ep)).sort((a, b) => b.number - a.number)[0] ??
    null;
  const open = !!shown && !StateLogic.ActiveRosterLogic.isLineupLocked(state, shown.id);
  const hideOthers = open && !!state.settings.hideStartersUntilLock;
  const activeSlots = StateLogic.ActiveRosterLogic.activeSlots(state);
  const players = state.players.filter((p) => p.active !== false);

  const canEdit =
    open &&
    !!myPlayerId &&
    shown.id === StateLogic.currentEpisode(state)?.id &&
    state.castaways.some((c) => c.ownerIds.includes(myPlayerId) && c.status !== "eliminated");
  const [editingRaw, setEditing] = useState(false);
  // Drops out of edit mode by itself once the lineup locks (the episode starts airing).
  const editing = editingRaw && canEdit;
  const mySet = canEdit && lineupStatus(state, shown, myPlayerId!, activeSlots).set;

  // "Saved ✓" for a moment after each change lands.
  const [saved, setSaved] = useState(false);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => clearTimeout(savedTimer.current ?? undefined), []);
  function flashSaved() {
    setSaved(true);
    clearTimeout(savedTimer.current ?? undefined);
    savedTimer.current = setTimeout(() => setSaved(false), 1500);
  }

  const boardRef = useRef<HTMLDivElement>(null);
  function done() {
    setEditing(false);
    setSaved(false);
    // From the bottom Done on a long roster, bring the board's top back into view.
    const top = boardRef.current?.getBoundingClientRect().top ?? 0;
    if (top < 0) boardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  const lockLine = shown?.airsAt ? `Lineups lock ${formatInTz(new Date(shown.airsAt), localTz())}.` : "";

  return (
    <div id="board" ref={boardRef} className="scroll-mt-20 section-shell">
      <div className="mb-0.5 flex min-h-7 items-center gap-2">
        <h3 className="min-w-0 flex-1 section-title">
          {shown ? `Episode ${shown.number} starters` : "Starters"}
        </h3>
        {editing && saved && <span className="text-xs font-semibold text-good">Saved ✓</span>}
        {canEdit && (
          <button
            className={cn(
              "shrink-0 rounded-md px-3 py-1 text-xs font-bold",
              editing || !mySet
                ? "bg-primary text-primary-foreground hover:opacity-90"
                : "border border-border text-foreground hover:bg-secondary"
            )}
            onClick={() => (editing ? done() : setEditing(true))}
          >
            {editing ? "Done" : mySet ? "Edit lineup" : "Set lineup"}
          </button>
        )}
      </div>
      <p className="mb-3 text-xs text-muted-foreground">
        {!shown
          ? "No episode to field a lineup for yet."
          : editing
            ? `Tap to start or bench — changes save as you go. ${lockLine}`
            : open
              ? `${hideOthers ? "Everyone else's starters show once it airs." : "Updates as lineups change."} ${lockLine}`
              : scored(shown)
                ? "What each starter scored."
                : `Locked — episode ${shown.number} has started.`}
      </p>
      {editing ? (
        <>
          <LineupEditor state={state} ep={shown} playerId={myPlayerId!} onSaved={flashSaved} />
          <button
            className="mt-4 w-full rounded-md bg-primary py-2 text-sm font-bold text-primary-foreground hover:opacity-90"
            onClick={done}
          >
            Done
          </button>
        </>
      ) : (
        <>
      <div className="flex flex-col divide-y divide-border">
        {players.map((p) => (
          <StarterRow
            key={p.id}
            state={state}
            player={p}
            isMe={p.id === myPlayerId}
            ep={shown}
            open={open}
            showPoints={!!shown && scored(shown)}
            hidden={hideOthers && p.id !== myPlayerId}
            activeSlots={activeSlots}
            onEdit={canEdit && p.id === myPlayerId ? () => setEditing(true) : undefined}
          />
        ))}
      </div>
      <CastByTribe state={state} />
        </>
      )}
    </div>
  );
}

// A player's lineup for one episode: who's starting, who's on the bench, and whether it's "set" --
// every slot they can fill is filled (late in a season someone may own fewer survivors).
function lineupStatus(state: LeagueState, ep: Episode, playerId: string, activeSlots: number) {
  const lineupIds = StateLogic.activeRosterLineupFor(state, ep.id, playerId);
  const starters = lineupIds.map((id) => StateLogic.getCastaway(state, id)).filter((c): c is Castaway => !!c);
  // Everyone still in the game on the roster who isn't starting.
  const bench = state.castaways.filter((c) => c.ownerIds.includes(playerId) && c.status !== "eliminated" && !lineupIds.includes(c.id));
  const need = Math.min(activeSlots, starters.length + bench.length);
  return { starters, bench, need, empty: Math.max(0, activeSlots - starters.length), set: starters.length >= need };
}

function StarterRow({
  state,
  player,
  isMe,
  ep,
  open,
  showPoints,
  hidden,
  activeSlots,
  onEdit,
}: {
  state: LeagueState;
  player: Player;
  isMe: boolean;
  ep: Episode | null;
  open: boolean;
  showPoints: boolean;
  hidden: boolean;
  activeSlots: number;
  /** Your own row while the lineup is open: an empty slot opens the lineup editor. */
  onEdit?: () => void;
}) {
  const { starters, bench, need, empty } = ep
    ? lineupStatus(state, ep, player.id, activeSlots)
    : { starters: [] as Castaway[], bench: [] as Castaway[], need: 0, empty: activeSlots };
  const emptySlot = (i: number) =>
    onEdit ? (
      <button
        key={i}
        className="flex h-10 w-10 items-center justify-center rounded-lg border-2 border-dashed border-border text-lg text-muted-foreground hover:border-primary hover:text-primary"
        title="Set lineup"
        aria-label="Set lineup"
        onClick={onEdit}
      >
        +
      </button>
    ) : (
      <div key={i} className="h-10 w-10 rounded-lg border-2 border-dashed border-border" title="Empty slot" />
    );

  return (
    <div className="py-2.5 first:pt-0 last:pb-0">
      <div className="mb-1.5 flex items-center gap-2">
        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: player.color }} />
        <span className={cn("min-w-0 flex-1 truncate text-sm font-bold", isMe && "underline decoration-2 underline-offset-2")}>
          {player.name}
        </span>
        {ep && open && (
          <span className={cn("shrink-0 text-[0.7rem] font-semibold", starters.length >= need ? "text-good" : "text-amber-600")}>
            {starters.length >= need ? "Set ✓" : `${starters.length}/${activeSlots} set`}
          </span>
        )}
      </div>
      {/* Hidden starters: one grey "?" square per slot they've filled, a dashed one per slot still
          empty -- who they picked stays private, but the league can see (and nudge them) when a
          lineup isn't full. No bench: that would give the starters away by omission. */}
      {ep && hidden && (
        <div className="flex flex-wrap gap-1.5">
          {starters.map((c) => (
            <div
              key={c.id}
              className="flex h-10 w-10 items-center justify-center rounded-lg border-2 border-border bg-muted font-bold text-muted-foreground"
              title="Hidden until the episode airs"
            >
              ?
            </div>
          ))}
          {Array.from({ length: empty }, (_, i) => emptySlot(i))}
        </div>
      )}
      {ep && !hidden && (
        // Starters left, bench right; on a narrow screen the bench wraps under, still right-aligned.
        <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
          <div className="flex flex-wrap gap-1.5">
            {starters.map((c) => (
              <Chip
                state={state}
                key={c.id}
                castaway={c}
                ring={player.color}
                points={showPoints ? castawayEpisodeStats(state, ep.id, c.id).total : undefined}
              />
            ))}
            {Array.from({ length: empty }, (_, i) => emptySlot(i))}
          </div>
          {bench.length > 0 && (
            <div className="ml-auto flex flex-wrap items-center justify-end gap-1">
              <span className="mr-0.5 text-[0.6rem] font-bold uppercase tracking-wide text-muted-foreground">Bench</span>
              {bench.map((c) => (
                <Chip state={state} key={c.id} castaway={c} small />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// `badge`: a number in the corner -- Active Roster's points (primary), Classic's finishing place
// (out, the red of BoardGrid's boot-order badge), or a medal emoji on its own.
export function Chip({
  state,
  castaway: c,
  ring,
  points,
  badgeTone = "primary",
  small,
  large,
  dim = isKnockedOut(state, c),
}: {
  state: LeagueState;
  castaway: Castaway;
  ring?: string;
  points?: number | string;
  badgeTone?: "primary" | "out" | "medal";
  small?: boolean;
  /** Eliminator Pool's board: one pick per row, so it can afford to be bigger than the default. */
  large?: boolean;
  /** Faded as out of the game -- by default whenever they are. */
  dim?: boolean;
}) {
  return (
    <div className="relative shrink-0" title={c.name}>
      <div
        className={cn(
          "overflow-hidden rounded-lg border-2",
          small ? "h-7 w-7 opacity-80" : large ? "h-14 w-14" : "h-10 w-10",
          dim && "opacity-50"
        )}
        style={{ borderColor: ring ?? "var(--border)" }}
      >
        <CastawayAvatar expandable
          castaway={c}
          className={cn(
            "flex h-full w-full items-center justify-center bg-secondary font-mono font-bold text-muted-foreground",
            small ? "text-[0.55rem]" : large ? "text-[0.75rem]" : "text-[0.65rem]"
          )}
        />
      </div>
      {points !== undefined &&
        (badgeTone === "medal" ? (
          <span className="absolute -bottom-2 -right-2 text-lg leading-none drop-shadow-sm">{points}</span>
        ) : (
          <span
            className={cn(
              "absolute -bottom-1.5 -right-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full border-2 border-card px-0.5 font-mono text-[0.55rem] font-bold leading-none",
              badgeTone === "out" ? "bg-destructive text-white" : "bg-primary text-primary-foreground"
            )}
          >
            {points}
          </span>
        ))}
    </div>
  );
}

// The whole cast, compact: a small photo per castaway grouped by current tribe (biggest group first,
// same as BoardGrid), a dot per owner beneath. Tap one for its full stat card. Classic's TeamsBoard
// shares it.
export function CastByTribe({ state }: { state: LeagueState }) {
  const terms = useShowTerms();
  const [openId, setOpenId] = useState<string | null>(null);
  const groups = [{ id: null as string | null, name: "Unassigned", color: "#4a5245" }, ...state.tribes]
    .map((g) => ({
      g,
      members: state.castaways
        .filter((c) => (c.tribeId || null) === g.id)
        .sort(
          (a, b) =>
            Number(a.status === "eliminated") - Number(b.status === "eliminated") ||
            (a.status === "eliminated" ? (b.placementOrder ?? 0) - (a.placementOrder ?? 0) : a.name.localeCompare(b.name))
        ),
    }))
    .filter((x) => x.members.length > 0)
    .sort((a, b) => b.members.length - a.members.length);
  const open = openId ? StateLogic.getCastaway(state, openId) : null;

  return (
    <div className="mt-4 border-t border-border pt-3">
      <h3 className="mb-2 section-title">
        {terms.castaways.replace(/^./, (ch) => ch.toUpperCase())}
      </h3>
      <div className="flex flex-col gap-3">
        {groups.map(({ g, members }) => (
          <div key={g.id ?? "unassigned"} className="flex gap-2">
            {state.tribes.length > 0 && <div className="w-1 shrink-0 rounded-full" style={{ background: g.color }} title={g.name} />}
            <div className="min-w-0 flex-1">
              {state.tribes.length > 0 && (
                <div className="mb-1 text-[0.65rem] font-bold uppercase tracking-wide" style={{ color: g.color }}>
                  {g.name}
                </div>
              )}
              <div className="flex flex-wrap gap-1.5">
                {members.map((c) => {
                  const owners = c.ownerIds.map((id) => StateLogic.getPlayer(state, id)).filter((p): p is Player => !!p);
                  return (
                    <button
                      key={c.id}
                      className={cn(
                        "flex w-11 flex-col items-center gap-0.5 rounded-md p-0.5 hover:bg-secondary",
                        isKnockedOut(state, c) && "opacity-45",
                        openId === c.id && "bg-secondary"
                      )}
                      onClick={() => setOpenId(openId === c.id ? null : c.id)}
                      aria-expanded={openId === c.id}
                    >
                      <div
                        className="h-9 w-9 overflow-hidden rounded-md border-2"
                        style={{ borderColor: owners[0]?.color ?? "var(--border)" }}
                      >
                        <CastawayAvatar
                          castaway={c}
                          className="flex h-full w-full items-center justify-center bg-secondary font-mono text-[0.55rem] font-bold text-muted-foreground"
                        />
                      </div>
                      <span className="w-full truncate text-center text-[0.6rem] leading-tight">{c.name.split(" ")[0]}</span>
                      <span className="flex h-1.5 gap-0.5">
                        {owners.map((o) => (
                          <span key={o.id} className="h-1.5 w-1.5 rounded-full" style={{ background: o.color }} title={o.name} />
                        ))}
                      </span>
                    </button>
                  );
                })}
              </div>
              {open && members.some((m) => m.id === open.id) && (
                <div className="mt-2 max-w-[260px]">
                  <CastawayStatCard
                    state={state}
                    castaway={open}
                    owners={open.ownerIds.map((id) => StateLogic.getPlayer(state, id)).filter((p): p is Player => !!p)}
                    showPlacementBadge={false}
                    expanded
                  />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// The viewer's own time zone, for "locked once it airs" -- the schedule itself is in the show's.
function localTz(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return undefined;
  }
}
