"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Check, ChevronRight } from "lucide-react";
import { backstage, gameAdmin, moves, useMembers, type GameSettings, type LeagueRole, type Member, type WaiverAdminGame } from "../data";
import { Face } from "../show/parts";
import { Btn } from "../ui/parts";
import { ComputerPlayers } from "../backstage/computer-players";
import { ClaimFor } from "../backstage/waivers";
import { airTime } from "../clock";
import { manageApi, type OutOfGame } from "../settings/api";
import { Avatar } from "../ui/bars";
import { HoldSheet } from "../ui/guards";
import { Sheet } from "../ui/sheet";
import { toast } from "../ui/toast";

// Settings Round 3a (docs/design-round/settings-r3-spec.md, "Who's playing"; -first-view.md, view 5): one game's people on its
// Manage this game, a row each with their role, and a sheet that shows only what's yours to change: a Commissioner sets their
// role in this game (C35: roles are per game now) and takes them out of this game alone (A14, held, restorable for 30 days);
// a Helper sees who's in. Computer players are this game's (C36). Invite and Leave aren't here: they're the couch's and the
// game's ⋯'s. While a waiver window is open, someone with no picks in gets Pick for them on their sheet, for a Helper too (the
// check's finding 6): a Helper's row is a door only then, since otherwise her sheet would hold nothing of hers.

export const ROLE_WORDS: Record<LeagueRole, string> = { commissioner: "Commissioner", admin: "Helper", member: "Player" };
const ROLES: [LeagueRole, string][] = [
  ["commissioner", "Changes how it plays, and who runs it"],
  ["admin", "The lock, waivers, computer players and who's let in"],
  ["member", "Sets their own team; runs nothing"],
];

function useAfter() {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: ["new-design"] });
}

async function undo(seasonId: string, couchId: string, batch: string, after: () => Promise<unknown>) {
  try {
    await backstage.undo(seasonId, couchId, batch);
    await after();
    toast("Undone");
  } catch (e) {
    toast.quiet((e as Error).message);
  }
}

export function WhoIsPlaying({
  seasonId,
  couchId,
  leagueId,
  gameName,
  commissioner,
  waivers,
  missing = null,
  ep = "Ep",
}: {
  seasonId: string;
  couchId: string;
  leagueId: string;
  gameName: string;
  commissioner: boolean;
  /** This game's waivers (Manage this game reads them once): an open window offers Pick for them on a person's sheet. */
  waivers?: WaiverAdminGame | null;
  /** Settings Round 3b (166): who hasn't set this episode's lineup or pick, with their choices: a runner sets it from their sheet. */
  missing?: GameSettings["missing"];
  /** The show's word for an episode ("Ep"). */
  ep?: string;
}) {
  const data = useMembers(seasonId, couchId);
  const [person, setPerson] = useState<string | null>(null);
  const [helping, setHelping] = useState<{ playerId: string; name: string } | null>(null);
  const [moving, setMoving] = useState<string | null>(null);
  // Settings Round 3b (166): someone who hasn't set this episode's move, and it isn't you (your own is the strip's).
  const missingFor = (m: Member) => (m.you ? null : (missing?.people.find((x) => x.userId === m.userId) ?? null));
  // Who can be picked for: the window's open, their picks aren't in, it isn't you, and you've seen the week's episode.
  const open = waivers?.period?.phase === "open" && !waivers.revealFirst ? waivers : null;
  const pickable = (m: Member) => {
    const c = open?.claims.find((x) => x.userId === m.userId);
    return c && !c.in && !c.you ? { playerId: c.playerId, name: c.name } : null;
  };
  if (!data.data) return <div aria-busy className="h-40 animate-pulse rounded-[10px] bg-card" />;
  const game = data.data.games.find((g) => g.leagueId === leagueId);
  // Runners first (Commissioners, then Helpers), then players, each by name: who runs it is what people look for here.
  const rank = (m: Member) => ({ commissioner: 0, admin: 1, member: 2 })[m.roles[leagueId]];
  const people = data.data.members.filter((m) => m.roles[leagueId]).sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
  const chosen = people.find((m) => m.userId === person) ?? null;
  return (
    <div data-who-plays={leagueId}>
      <div className="rounded-[10px] bg-card px-3.5">
        {people.map((m) => {
          const door = commissioner || !!pickable(m) || !!missingFor(m);
          const Tag = door ? "button" : "div";
          return (
          <Tag
            key={m.userId}
            {...(door ? { type: "button" as const, onClick: () => setPerson(m.userId) } : {})}
            data-person={m.name}
            data-person-role={m.roles[leagueId]}
            className="nd-press flex min-h-[60px] w-full items-center gap-3 border-t border-border py-2 text-left first:border-t-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <Avatar id={m.userId} name={m.name} size={36} />
            <span className="min-w-0 flex-1">
              <b className="flex items-center gap-2 text-[16px] font-semibold">
                <span className="truncate">{m.name}</span>
                {m.you && <span className="type-caption flex-none rounded-[2px] bg-foreground px-1.5 text-[12px] text-background">You</span>}
              </b>
              <small className="block text-[13px] text-muted-foreground">
                {ROLE_WORDS[m.roles[leagueId]]}
                {missingFor(m) && <span data-person-missing> · {missing!.kind === "lineup" ? `no lineup for ${ep} ${missing!.episode} yet` : `no pick for ${ep} ${missing!.episode} yet`}</span>}
              </small>
            </span>
            {door && <ChevronRight className="size-5 flex-none text-muted-foreground" aria-hidden />}
          </Tag>
          );
        })}
      </div>
      {game && (
        <div className="-mx-4">
          <ComputerPlayers seasonId={seasonId} couchId={couchId} games={[game]} />
        </div>
      )}
      {chosen && (
        <PersonSheet
          key={chosen.userId}
          seasonId={seasonId}
          couchId={couchId}
          leagueId={leagueId}
          gameName={gameName}
          member={chosen}
          members={people}
          commissioner={commissioner}
          pickFor={pickable(chosen)}
          moveFor={missingFor(chosen) && missing ? { kind: missing.kind, episode: missing.episode, ep } : null}
          onMoveFor={() => {
            setMoving(chosen.userId);
            setPerson(null);
          }}
          due={open?.period?.due ?? null}
          onPickFor={(who) => {
            setPerson(null);
            setHelping(who);
          }}
          onClose={() => setPerson(null)}
        />
      )}
      {moving && missing && (() => {
        const who = missing.people.find((x) => x.userId === moving);
        return who ? <MoveFor key={who.playerId} leagueId={leagueId} missing={missing} who={who} ep={ep} onClose={() => setMoving(null)} /> : null;
      })()}
      {open && <ClaimFor key={helping?.playerId ?? "none"} seasonId={seasonId} couchId={couchId} game={open} who={helping} onClose={() => setHelping(null)} />}
    </div>
  );
}

function PersonSheet({
  seasonId,
  couchId,
  leagueId,
  gameName,
  member,
  members,
  commissioner,
  pickFor,
  due,
  onPickFor,
  moveFor = null,
  onMoveFor,
  onClose,
}: {
  seasonId: string;
  couchId: string;
  leagueId: string;
  gameName: string;
  member: Member;
  members: Member[];
  commissioner: boolean;
  /** Their seat in an open waiver window with no picks in: Pick for them, first. */
  pickFor: { playerId: string; name: string } | null;
  due: string | null;
  onPickFor: (who: { playerId: string; name: string }) => void;
  /** Settings Round 3b (166): this episode's lineup or pick they haven't set: Set it for them, first. */
  moveFor?: { kind: "lineup" | "pick"; episode: number; ep: string } | null;
  onMoveFor?: () => void;
  onClose: () => void;
}) {
  const after = useAfter();
  const [hold, setHold] = useState<OutOfGame | null | false>(false);
  const [busy, setBusy] = useState(false);
  const role = member.roles[leagueId];
  // The last Commissioner can't step down (roles.ts): said on the choices before anyone taps.
  const last = role === "commissioner" && members.filter((m) => m.roles[leagueId] === "commissioner").length < 2;
  const set = async (next: LeagueRole) => {
    if (busy || next === role) return;
    setBusy(true);
    try {
      const r = await gameAdmin.role(seasonId, couchId, member.userId, next, [leagueId]);
      await after();
      onClose();
      const said = next === "commissioner" ? "a Commissioner" : next === "admin" ? "a Helper" : "a player";
      toast(`${member.you ? "You're" : `${member.name} is`} ${said} in ${gameName}`, r.batch ? { undo: () => void undo(seasonId, couchId, r.batch, after) } : undefined);
    } catch (e) {
      toast.quiet((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const askOut = async () => {
    setHold(null);
    try {
      setHold(await manageApi.removeFromGame(seasonId, couchId, member.userId, leagueId, true));
    } catch (e) {
      setHold(false);
      toast.quiet((e as Error).message);
    }
  };
  const consequence = (o: OutOfGame) =>
    `${member.name} leaves ${gameName}. ${o.drafted ? "Their team and points stay in the standings, but nobody plays them." : "Nothing's been drafted yet, so the seat just goes."} Their other games and the couch stay.`;
  const sub = commissioner ? `${ROLE_WORDS[role]} in ${gameName}` : `${ROLE_WORDS[role]} in ${gameName} · the Commissioner sets roles`;
  return (
    <>
      <Sheet open={hold === false} onOpenChange={(o) => !o && onClose()} title={member.name} subtitle={sub}>
        <div data-person-sheet={member.name} className="flex flex-col gap-2 pb-2">
          {moveFor && (
            <button type="button" data-person-move-for={member.name} onClick={() => onMoveFor?.()} className="nd-press flex min-h-[60px] items-center gap-3 rounded-[4px] bg-secondary px-3 py-2 text-left">
              <span className="min-w-0 flex-1">
                <b className="block text-[16px] font-semibold leading-tight">{moveFor.kind === "lineup" ? "Set their lineup" : "Make their pick"}</b>
                <small className="block text-[13px] leading-snug text-muted-foreground">
                  Nothing set for {moveFor.ep} {moveFor.episode} yet. It shows as set by you, and they can change it until the lock.
                </small>
              </span>
              <ChevronRight className="size-5 flex-none text-muted-foreground" aria-hidden />
            </button>
          )}
          {pickFor && (
            <button
              type="button"
              data-person-pick-for={member.name}
              onClick={() => onPickFor(pickFor)}
              className={`nd-press flex min-h-[60px] items-center gap-3 rounded-[4px] bg-secondary px-3 py-2 text-left ${commissioner ? "mb-3" : ""}`}
            >
              <span className="min-w-0 flex-1">
                <b className="block text-[16px] font-semibold leading-tight">Pick for them</b>
                <small className="block text-[13px] leading-snug text-muted-foreground">No waiver picks in yet{due ? ` · due ${airTime(Date.parse(due))}` : ""}. You won&apos;t see what they picked.</small>
              </span>
              <ChevronRight className="size-5 flex-none text-muted-foreground" aria-hidden />
            </button>
          )}
          {commissioner ? (
            <>
              <p className="type-caption text-[13px] tracking-[0.05em] text-muted-foreground">Their role in this game</p>
              {ROLES.map(([k, line]) => {
                const on = role === k;
                const blocked = last && k !== "commissioner";
                return (
                  <button
                    key={k}
                    type="button"
                    data-role={k}
                    aria-pressed={on}
                    aria-disabled={blocked}
                    disabled={busy}
                    onClick={() => (blocked ? toast.quiet("Every game needs a Commissioner. Make someone else one first.") : void set(k))}
                    className={`nd-press flex flex-col rounded-[4px] px-3 py-2.5 text-left ${on ? "bg-secondary outline-[1.5px] -outline-offset-[1.5px] outline-foreground" : blocked ? "border border-dashed border-edge" : "bg-secondary"}`}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <b className={`text-[16px] font-semibold ${blocked ? "text-muted-foreground" : ""}`}>{ROLE_WORDS[k]}</b>
                      {on && <Check className="size-5 flex-none" strokeWidth={3} aria-hidden />}
                    </span>
                    <span className="mt-0.5 text-[14px] leading-snug text-muted-foreground">{blocked ? "Make someone else Commissioner first, so the game always has one" : line}</span>
                  </button>
                );
              })}
              {!member.you && (
                <button type="button" data-remove-from-game onClick={() => void askOut()} className="nd-press mt-4 flex min-h-[56px] flex-col justify-center border-t border-border pt-2 text-left">
                  <b className="text-[15px] font-semibold">Remove from this game</b>
                  <small className="text-[13px] text-muted-foreground">Their other games and the couch stay</small>
                </button>
              )}
            </>
          ) : pickFor || moveFor ? null : (
            <p className="text-[15px] leading-snug">
              {member.you ? "You help run this game." : `${member.name} is ${role === "commissioner" ? "a Commissioner" : role === "admin" ? "a Helper" : "a player"} here.`} Only a Commissioner changes
              roles or takes someone out.
            </p>
          )}
        </div>
      </Sheet>
      <HoldSheet
        open={hold !== false}
        onOpenChange={(o) => {
          if (!o) {
            setHold(false);
            onClose();
          }
        }}
        title={`Remove ${member.name} from ${gameName}?`}
        subtitle="Their seat stops playing"
        consequence={hold ? consequence(hold) : null}
        problem={hold ? hold.problem : null}
        cta={`remove ${member.name}`}
        onConfirm={async () => {
          const r = await manageApi.removeFromGame(seasonId, couchId, member.userId, leagueId);
          await after();
          toast(`${member.name} is out of ${gameName} · restorable for 30 days`, r.batch ? { undo: () => void undo(seasonId, couchId, r.batch!, after) } : undefined);
        }}
      />
    </>
  );
}

/**
 * Set a move someone forgot (Settings Round 3b, A16's 166): their team as faces for a lineup (as many as start), or who they may
 * pick for a pool, chosen here and sent as theirs (the lineup and pick routes take a runner's, logged "Set Joanna's lineup"). Only
 * what's public: their team, who's still in. Their earlier moves aren't shown.
 */
function MoveFor({ leagueId, missing, who, ep, onClose }: { leagueId: string; missing: NonNullable<GameSettings["missing"]>; who: NonNullable<GameSettings["missing"]>["people"][number]; ep: string; onClose: () => void }) {
  const after = useAfter();
  const lineup = missing.kind === "lineup";
  const need = Math.min(missing.starters, who.options.length);
  const [chosen, setChosen] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const tap = (id: string) =>
    setChosen((c) => (c.includes(id) ? c.filter((x) => x !== id) : lineup ? (c.length >= need ? c : [...c, id]) : [id]));
  const send = async () => {
    setBusy(true);
    try {
      if (lineup) await moves.lineup(leagueId, missing.epId, who.playerId, chosen);
      else await moves.pick(leagueId, missing.epId, who.playerId, chosen[0]);
      await after();
      toast(`${lineup ? `Set ${who.name}'s lineup` : `Made ${who.name}'s pick`} for ${ep} ${missing.episode}`);
      onClose();
    } catch (e) {
      toast.quiet((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const ready = lineup ? chosen.length === need : chosen.length === 1;
  return (
    <Sheet open onOpenChange={(o) => !o && onClose()} title={lineup ? `${who.name}'s lineup` : `${who.name}'s pick`} subtitle={`${ep} ${missing.episode} · ${lineup ? `${need} start` : "who survives"}`}>
      <div data-move-for={who.name} className="flex flex-col gap-3 pb-2">
        <p className="text-[14px] leading-snug text-muted-foreground">
          {lineup ? `Choose ${need} of their team to start.` : "Choose who they think survives."} It goes in as theirs, and they can change it until the lock.
        </p>
        <div className="grid grid-cols-4 gap-2">
          {who.options.map((o) => {
            const on = chosen.includes(o.id);
            return (
              <button key={o.id} type="button" data-move-option={o.id} aria-pressed={on} onClick={() => tap(o.id)} className={`nd-press flex flex-col items-center gap-1 rounded-[4px] p-1.5 ${on ? "bg-secondary outline-[1.5px] -outline-offset-[1.5px] outline-foreground" : ""}`}>
                <Face src={o.photo} name={o.name} className="h-[60px] w-[46px] rounded-[2px] text-[15px]" />
                <span className="w-full truncate text-center text-[13px] font-semibold">{o.name.split(" ")[0]}</span>
              </button>
            );
          })}
        </div>
        <Btn tone="must" wide disabled={!ready || busy} data-move-for-go onClick={() => void send()}>
          {busy ? "Saving…" : lineup ? `Set ${who.name}'s lineup${ready ? "" : ` · ${chosen.length} of ${need}`}` : `Make ${who.name}'s pick`}
        </Btn>
      </div>
    </Sheet>
  );
}
