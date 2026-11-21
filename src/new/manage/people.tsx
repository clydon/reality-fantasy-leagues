"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";
import { backstage, gameAdmin, useMembers, type LeagueRole, type Member } from "../data";
import { ComputerPlayers } from "../backstage/computer-players";
import { manageApi, type OutOfGame } from "../settings/api";
import { Avatar } from "../ui/bars";
import { HoldSheet } from "../ui/guards";
import { Sheet } from "../ui/sheet";
import { toast } from "../ui/toast";

// Settings Round 3a (docs/design-round/settings-r3-spec.md, "Who's playing"; -first-view.md, view 5): one game's people on its
// Manage this game, a row each with their role, and a sheet that shows only what's yours to change: a Commissioner sets their
// role in this game (C35: roles are per game now) and takes them out of this game alone (A14, held, restorable for 30 days);
// a Helper sees who's in. Computer players are this game's (C36). Invite and Leave aren't here: they're the couch's and the
// game's ⋯'s.

export const ROLE_WORDS: Record<LeagueRole, string> = { commissioner: "Commissioner", admin: "Helper", member: "Player" };
const ROLES: [LeagueRole, string][] = [
  ["commissioner", "Changes how it plays, and who runs it"],
  ["admin", "The lock, waivers, computer players and who's let in"],
  ["member", "Plays"],
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

export function WhoIsPlaying({ seasonId, couchId, leagueId, gameName, commissioner }: { seasonId: string; couchId: string; leagueId: string; gameName: string; commissioner: boolean }) {
  const data = useMembers(seasonId, couchId);
  const [person, setPerson] = useState<string | null>(null);
  if (!data.data) return <div aria-busy className="h-40 animate-pulse rounded-[10px] bg-card" />;
  const game = data.data.games.find((g) => g.leagueId === leagueId);
  // Runners first (Commissioners, then Helpers), then players, each by name: who runs it is what people look for here.
  const rank = (m: Member) => ({ commissioner: 0, admin: 1, member: 2 })[m.roles[leagueId]];
  const people = data.data.members.filter((m) => m.roles[leagueId]).sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
  const chosen = people.find((m) => m.userId === person) ?? null;
  return (
    <div data-who-plays={leagueId}>
      <div className="rounded-[10px] bg-card px-3.5">
        {people.map((m) => (
          <button
            key={m.userId}
            type="button"
            data-person={m.name}
            data-person-role={m.roles[leagueId]}
            onClick={() => setPerson(m.userId)}
            className="nd-press flex min-h-[60px] w-full items-center gap-3 border-t border-border py-2 text-left first:border-t-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <Avatar id={m.userId} name={m.name} size={36} />
            <span className="min-w-0 flex-1">
              <b className="flex items-center gap-2 text-[16px] font-semibold">
                <span className="truncate">{m.name}</span>
                {m.you && <span className="type-caption flex-none rounded-[2px] bg-foreground px-1.5 text-[12px] text-background">You</span>}
              </b>
              <small className="block text-[13px] text-muted-foreground">{ROLE_WORDS[m.roles[leagueId]]}</small>
            </span>
            <ChevronRight className="size-5 flex-none text-muted-foreground" aria-hidden />
          </button>
        ))}
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
          onClose={() => setPerson(null)}
        />
      )}
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
  onClose,
}: {
  seasonId: string;
  couchId: string;
  leagueId: string;
  gameName: string;
  member: Member;
  members: Member[];
  commissioner: boolean;
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
                    <b className={`text-[16px] font-semibold ${blocked ? "text-muted-foreground" : ""}`}>{ROLE_WORDS[k]}</b>
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
          ) : (
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
