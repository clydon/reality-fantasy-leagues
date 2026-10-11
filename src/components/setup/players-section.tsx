"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import type { LeagueState, Player } from "@/lib/game/types";
import StateLogic from "@/lib/game/state-logic.js";
import { useLeagueStore, useCanManage } from "@/lib/store";
import { useMutate } from "@/lib/use-mutate";
import { api, ApiError } from "@/lib/api";
import { BottomSheet, SheetAction } from "@/components/ui/bottom-sheet";
import { ColorInput } from "@/components/ui/color-input";
import { useShowTerms } from "@/lib/use-show-terms";
import { confirm } from "@/lib/confirm-store";
import { PlainButton } from "@/components/draft/draft-ui";
import { cn } from "cn";
import { InvitesSection } from "./invites-section";
import { Chip, GroupHead, MoreButton, PrimaryButton, RowList, SettingsPage, TextSheet, ToggleRow } from "./settings-ui";

// League Settings > Players & invites (docs/PLAN-ux-redesign.md, 2b and 1c; the canvas's
// "Settings-Players"): invites first, then one line per player -- colour, name, who they are, roster
// count -- with everything you can do to a player in its ⋯ sheet: rename, colour, computer player and
// its skill, hand over, activate, and Remove last in red.
//
// A seat with no account behind it can be a computer player (player.automated, src/lib/game/bot-logic.js),
// which makes its own moves, and any such seat can be handed over to a real account by invite: whoever
// accepts takes over the team (see join-league.ts). A player who joined after the draft is inactive
// (RosterLogic.addPlayer) until the commissioner assigns them free agents directly -- there's no fair
// turn order left to slot them into.
const LEVELS = {
  casual: { label: "Casual", help: "Plays its favourites and rarely swaps." },
  solid: { label: "Solid", help: "Follows the form and avoids anyone in danger." },
  sharp: { label: "Sharp", help: "Reads every warning sign and swaps whenever it pays." },
} as const;
const BOT_HELP = "Plays itself: drafts, sets its lineup and makes its picks from how everyone's doing so far.";

type Sheet =
  { kind: "menu" | "rename" | "colour" | "skill" | "handover" | "activate"; playerId: string } | { kind: "add"; automated: boolean };

export function PlayersPage() {
  const state = useLeagueStore((s) => s.state);
  return (
    <SettingsPage title="Players & invites">
      <InvitesSection />
      <PlayersSection state={state} />
      <LateJoinersSection />
    </SettingsPage>
  );
}

function PlayersSection({ state }: { state: LeagueState }) {
  const terms = useShowTerms();
  const leagueId = useLeagueStore((s) => s.leagueId);
  const playerAccounts = useLeagueStore((s) => s.playerAccounts);
  const myPlayerId = useLeagueStore((s) => s.membership?.playerId ?? null);
  const mode = useLeagueStore((s) => s.mode);
  const canManage = useCanManage();
  const mutate = useMutate();
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [note, setNote] = useState<{ text: string; error?: boolean } | null>(null);

  const hasRoster = StateLogic.getLeagueType(state).hasRoster;
  const players = state.players;
  const close = () => setSheet(null);
  const target = sheet && "playerId" in sheet ? state.players.find((p) => p.id === sheet.playerId) : undefined;
  const accountOf = (p: Player) => playerAccounts.find((a) => a.player_id === p.id);

  async function update(id: string, field: string, value: unknown) {
    await mutate(
      (s) => StateLogic.updatePlayer(s, id, field, value),
      () => api.updatePlayer(leagueId!, id, field, value)
    );
  }

  async function add(name: string, automated: boolean) {
    close();
    await mutate(
      (s) => StateLogic.addPlayer(s, name, { automated }),
      () => api.addPlayer(leagueId!, name, automated)
    );
  }

  async function remove(p: Player) {
    close();
    const warning = hasRoster ? `Remove "${p.name}"? Their drafted ${terms.castaways} will become free agents.` : `Remove "${p.name}"?`;
    if (!(await confirm(warning, { danger: true, confirmLabel: "Remove" }))) return;
    await mutate(
      (s) => StateLogic.removePlayer(s, p.id),
      () => api.removePlayer(leagueId!, p.id)
    );
  }

  async function handOver(p: Player, to: string) {
    try {
      await api.sendInvite(leagueId!, to, p.id);
      close();
      setNote({ text: `Invite sent to ${to}. They take over ${p.name} when they accept.` });
    } catch (err) {
      setNote({ text: err instanceof ApiError ? err.message : "Could not send the invite.", error: true });
    }
  }

  async function activate(p: Player, ids: string[]) {
    close();
    await mutate(
      (s) => StateLogic.activatePlayer(s, p.id, ids),
      () => api.activatePlayer(leagueId!, p.id, ids)
    );
  }

  function whoLine(p: Player) {
    const account = accountOf(p);
    const you = p.id === myPlayerId;
    if (p.disabled) return "Left the league";
    if (account)
      return [you ? "You" : account.username, account.role === "commissioner" ? "commissioner" : null].filter(Boolean).join(" · ");
    if (p.automated) return `Computer player · ${LEVELS[p.botLevel ?? "solid"].label}`;
    return "No account yet";
  }

  return (
    <section className="flex flex-col gap-2">
      <GroupHead>Players</GroupHead>
      <RowList>
        {players.map((p) => (
          <div key={p.id} className="flex min-h-[60px] items-center gap-3">
            <span className="size-3 shrink-0 rounded-[3px]" style={{ background: p.color }} aria-hidden />
            <span className="flex min-w-0 flex-1 flex-col gap-0.5 py-2">
              <span className="flex items-center gap-2">
                <span className="truncate text-base font-semibold">{p.name}</span>
                {p.active === false && <Chip tone="chyron">To activate</Chip>}
              </span>
              <span className="truncate text-[13px] text-muted-foreground">{whoLine(p)}</span>
            </span>
            {hasRoster && (
              <span className="shrink-0 text-[13px] text-muted-foreground">
                {StateLogic.activeOwnedCount(state, p.id)}/{StateLogic.rosterSize(state)}
              </span>
            )}
            {canManage ? (
              <MoreButton label={`Options for ${p.name}`} onClick={() => setSheet({ kind: "menu", playerId: p.id })} />
            ) : (
              <span className="w-2" />
            )}
          </div>
        ))}
      </RowList>
      {note && <p className={cn("text-sm", note.error ? "font-semibold text-live" : "text-muted-foreground")}>{note.text}</p>}
      {canManage && (
        <div className="mt-2 flex gap-2.5">
          <PlainButton className="flex-1" onClick={() => setSheet({ kind: "add", automated: false })}>
            <Plus className="size-[18px]" aria-hidden />
            Add player
          </PlainButton>
          <PlainButton className="flex-1" onClick={() => setSheet({ kind: "add", automated: true })}>
            <Plus className="size-[18px]" aria-hidden />
            Add computer
          </PlainButton>
        </div>
      )}

      {sheet?.kind === "menu" && target && (
        <BottomSheet
          open
          onOpenChange={(o) => !o && close()}
          title={
            <span className="flex items-center gap-2.5">
              <span className="size-3.5 rounded-[3px]" style={{ background: target.color }} aria-hidden />
              {target.name}
            </span>
          }
          description={whoLine(target)}
        >
          <SheetAction onClick={() => setSheet({ kind: "rename", playerId: target.id })}>Rename</SheetAction>
          <SheetAction onClick={() => setSheet({ kind: "colour", playerId: target.id })}>Colour</SheetAction>
          {!accountOf(target) && !target.disabled && (
            <SheetAction
              detail={target.automated ? "On" : "Off"}
              onClick={() => update(target.id, "automated", !target.automated).then(close)}
            >
              Computer player
            </SheetAction>
          )}
          {!accountOf(target) && target.automated && (
            <SheetAction detail={LEVELS[target.botLevel ?? "solid"].label} onClick={() => setSheet({ kind: "skill", playerId: target.id })}>
              Skill
            </SheetAction>
          )}
          {!accountOf(target) && !target.disabled && mode === "live" && (
            <SheetAction onClick={() => setSheet({ kind: "handover", playerId: target.id })}>Hand over to a person…</SheetAction>
          )}
          {hasRoster && target.active === false && (
            <SheetAction onClick={() => setSheet({ kind: "activate", playerId: target.id })}>Activate…</SheetAction>
          )}
          <SheetAction danger onClick={() => remove(target)}>
            Remove from league
          </SheetAction>
        </BottomSheet>
      )}

      {sheet?.kind === "rename" && target && (
        <TextSheet
          title={`Rename ${target.name}`}
          label="Name"
          initial={target.name}
          submit="Save"
          onClose={close}
          onSubmit={(v) => {
            close();
            if (v !== target.name) update(target.id, "name", v);
          }}
        />
      )}

      {sheet?.kind === "colour" && target && (
        <BottomSheet open onOpenChange={(o) => !o && close()} title="Colour" description={target.name}>
          <div className="flex items-center gap-3 border-t border-border py-4">
            <ColorInput value={target.color} onChange={(hex) => update(target.id, "color", hex)} swatchClassName="h-11 w-11" />
            <span className="text-[13px] text-muted-foreground">Tap the swatch, or type a hex code to match another league.</span>
          </div>
        </BottomSheet>
      )}

      {sheet?.kind === "skill" && target && (
        <BottomSheet open onOpenChange={(o) => !o && close()} title="Skill" description={target.name}>
          {(Object.keys(LEVELS) as (keyof typeof LEVELS)[]).map((k) => (
            <SheetAction
              key={k}
              detail={(target.botLevel ?? "solid") === k ? "✓" : undefined}
              onClick={() => update(target.id, "botLevel", k).then(close)}
            >
              <span className="flex flex-col gap-0.5 py-2">
                <span>{LEVELS[k].label}</span>
                <span className="text-[13px] font-normal text-muted-foreground">{LEVELS[k].help}</span>
              </span>
            </SheetAction>
          ))}
        </BottomSheet>
      )}

      {sheet?.kind === "handover" && target && (
        <TextSheet
          title="Hand over"
          description={target.name}
          label="Username or email"
          help={`When they accept, the team is theirs, points and all, under their own name${target.automated ? ", and the computer stops playing it" : ""}.`}
          submit="Send invite"
          onClose={close}
          onSubmit={(v) => handOver(target, v)}
        />
      )}

      {sheet?.kind === "activate" && target && (
        <ActivateSheet state={state} player={target} onClose={close} onActivate={(ids) => activate(target, ids)} />
      )}

      {sheet?.kind === "add" && (
        <TextSheet
          title={sheet.automated ? "Add a computer player" : "Add a player"}
          label="Name"
          help={
            sheet.automated
              ? `${BOT_HELP} Hand it over to a person any time.`
              : "Invite them afterwards from its ⋯ menu, or let them join with the code."
          }
          submit="Add"
          onClose={close}
          onSubmit={(v) => add(v, sheet.automated)}
        />
      )}
    </section>
  );
}

// A player who joined after the draft: pick up to a roster's worth of free agents to give them directly.
function ActivateSheet({
  state,
  player,
  onClose,
  onActivate,
}: {
  state: LeagueState;
  player: Player;
  onClose: () => void;
  onActivate: (ids: string[]) => void;
}) {
  const [ids, setIds] = useState<string[]>([]);
  const max = StateLogic.rosterSize(state);
  const freeAgents = StateLogic.freeAgents(state);
  return (
    <BottomSheet open onOpenChange={(o) => !o && onClose()} title="Activate" description={player.name}>
      <p className="border-t border-border py-3 text-[13px] leading-snug text-muted-foreground">
        The draft is over, so pick up to {max} free agents to give {player.name} directly.
      </p>
      <div className="flex max-h-[40vh] flex-col overflow-y-auto">
        {freeAgents.map((c) => {
          const on = ids.includes(c.id);
          return (
            <label key={c.id} className="flex min-h-12 items-center gap-3 border-t border-border text-base">
              <input
                type="checkbox"
                className="size-5 accent-[var(--chyron)]"
                checked={on}
                disabled={!on && ids.length >= max}
                onChange={(e) => setIds((list) => (e.target.checked ? [...list, c.id] : list.filter((id) => id !== c.id)))}
              />
              {c.name}
            </label>
          );
        })}
      </div>
      <PrimaryButton className="mt-3" onClick={() => onActivate(ids)}>
        {ids.length ? `Give ${ids.length} and activate` : "Activate"}
      </PrimaryButton>
    </BottomSheet>
  );
}

// Late joiners (StateLogic.GhostLogic, docs/PLAN-late-joiners.md): people who joined once the league
// was underway, playing the season from an episode of their own choosing. Nobody else in the league
// sees them -- only the commissioner, here. "Add to the league" makes them a player like any other;
// leaving them off air for good is fine too.
function LateJoinersSection() {
  const raw = useLeagueStore((s) => s.rawState);
  const leagueId = useLeagueStore((s) => s.leagueId);
  const playerAccounts = useLeagueStore((s) => s.playerAccounts);
  const canManage = useCanManage();
  const mutate = useMutate();
  const [open, setOpen] = useState<string | null>(null);
  const ghosts = StateLogic.GhostLogic.ghosts(raw);
  if (!canManage) return null;
  const target = ghosts.find((p) => p.id === open);
  const latest = StateLogic.SpoilerLogic.latestWithResults(raw);

  function where(p: Player) {
    const lj = p.lateJoin;
    if (!lj || lj.startEpisode === null) return "Choosing where to start";
    if (!lj.catchingUp) return `Started at episode ${lj.startEpisode} · caught up`;
    const on = (lj.seenThrough ?? lj.startEpisode - 1) + 1;
    return `Started at episode ${lj.startEpisode} · on episode ${on} of ${latest}`;
  }

  async function convert(p: Player) {
    setOpen(null);
    await mutate(
      (s) => StateLogic.GhostLogic.convert(s, p.id),
      () => api.convertLateJoiner(leagueId!, p.id)
    );
  }

  async function remove(p: Player) {
    setOpen(null);
    if (!(await confirm(`Remove "${p.name}"? Their team and progress go with them.`, { danger: true, confirmLabel: "Remove" }))) return;
    await mutate(
      (s) => StateLogic.removePlayer(s, p.id),
      () => api.removePlayer(leagueId!, p.id)
    );
  }

  return (
    <section className="flex flex-col gap-2">
      <GroupHead>Late joiners</GroupHead>
      <RowList>
        <ToggleRow
          label="Let people join late"
          hint={
            StateLogic.GhostLogic.allowed(raw)
              ? "Someone joining now picks an episode to start from and plays one at a time, spoiler-free. The league doesn't see them until you add them."
              : "Someone joining now gets a seat to activate, with free agents you give them."
          }
          checked={StateLogic.GhostLogic.allowed(raw)}
          onChange={(v) =>
            mutate(
              (s) => StateLogic.updateSettings(s, "allowLateJoiners", v),
              () => api.updateLeagueSettings(leagueId!, "allowLateJoiners", v)
            )
          }
        />
        {ghosts.map((p) => (
          <div key={p.id} className="flex min-h-[60px] items-center gap-3">
            <span className="size-3 shrink-0 rounded-[3px]" style={{ background: p.color }} aria-hidden />
            <span className="flex min-w-0 flex-1 flex-col gap-0.5 py-2">
              <span className="flex items-center gap-2">
                <span className="truncate text-base font-semibold">{p.name}</span>
                <Chip>{p.lateJoin?.catchingUp && p.lateJoin.startEpisode !== null ? "Replay" : "Off air"}</Chip>
              </span>
              <span className="truncate text-[13px] text-muted-foreground">
                {[playerAccounts.find((a) => a.player_id === p.id)?.username, where(p)].filter(Boolean).join(" · ")}
              </span>
            </span>
            <MoreButton label={`Options for ${p.name}`} onClick={() => setOpen(p.id)} />
          </div>
        ))}
      </RowList>

      {target && (
        <BottomSheet
          open
          onOpenChange={(o) => !o && setOpen(null)}
          title={
            <span className="flex items-center gap-2.5">
              <span className="size-3.5 rounded-[3px]" style={{ background: target.color }} aria-hidden />
              {target.name}
            </span>
          }
          description={where(target)}
        >
          {target.lateJoin?.startEpisode !== null && (
            <SheetAction onClick={() => convert(target)}>
              <span className="flex flex-col gap-0.5 py-2">
                <span>Add to the league</span>
                <span className="text-[13px] font-normal text-muted-foreground">
                  {target.lateJoin?.catchingUp
                    ? "Everyone sees them from now on. They keep catching up one episode at a time."
                    : "Everyone sees them from now on, team and points included."}
                </span>
              </span>
            </SheetAction>
          )}
          <SheetAction danger onClick={() => remove(target)}>
            Remove from league
          </SheetAction>
        </BottomSheet>
      )}
    </section>
  );
}
