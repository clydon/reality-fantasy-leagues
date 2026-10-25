"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronRight, Ellipsis, Users } from "lucide-react";
import { backstage, gameAdmin, useMembers, type LeagueRole, type Member, type MemberGame, type OutPreview } from "../data";
import { gameColour } from "../games";
import { useNav } from "../nav";
import { paths } from "../routes";
import type { ShowData } from "../screens/show-space";
import { Avatar } from "../ui/bars";
import { HoldSheet } from "../ui/guards";
import { EmptyState, SectionHead } from "../ui/parts";
import { Preview } from "../ui/preview";
import { Sheet } from "../ui/sheet";
import { toast } from "../ui/toast";

// Backstage › Members & roles (the mock's backstage.js bsMembers and guards.js memberSheet, docs/PLAN-new-design.md step 6a):
// who runs each game here and everyone who plays. Roles can be handed off or shared: a Commissioner (results, waivers,
// rules and roles) or a Game admin (results and waivers, picking for people in a draft), as many as you like. A role
// changes at once with Undo (tier 1); taking someone out of the games, or leaving them yourself, is tier 3: a sentence
// saying what happens and a hold, restorable from Recent changes for 30 days. A game always keeps a Commissioner, so the
// last one can't step down or leave: it's refused before anyone holds. Only a Commissioner changes roles; a Game admin
// reads this page. Join requests and invites come with the couch's own join flow (step 9).

const ROLE_WORDS: Record<LeagueRole, string> = { commissioner: "Commissioner", admin: "Game admin", member: "Player" };
const ROLES: [LeagueRole, string, string][] = [
  ["commissioner", "Commissioner", "Results, waivers, rules and roles"],
  ["admin", "Game admin", "Results and waivers, can pick for people"],
  ["member", "Player", "Plays; sees nothing backstage"],
];

/** "Commissioner · all 3 games", "Player · Weekly Lineup, Survival Pool", "Commissioner of Couch Cup · Player in 2". */
function roleLine(m: Member, games: MemberGame[]): string {
  const theirs = games.filter((g) => m.roles[g.leagueId]);
  const roles = [...new Set(theirs.map((g) => m.roles[g.leagueId]))];
  if (roles.length === 1) {
    const where = theirs.length === games.length && games.length > 1 ? `all ${games.length} games` : theirs.map((g) => g.gameName).join(", ");
    return `${ROLE_WORDS[roles[0]]} · ${where}`;
  }
  return theirs.map((g) => `${ROLE_WORDS[m.roles[g.leagueId]]} in ${g.gameName}`).join(" · ");
}

function useAfter() {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: ["new-design"] });
}

export function MembersPage({ seasonId, show }: { seasonId: string; show: ShowData }) {
  const couchId = show.couch?.id ?? null;
  const data = useMembers(seasonId, couchId);
  const [person, setPerson] = useState<string | null>(null);
  const [game, setGame] = useState<string | null>(null);
  if (data.error) return <EmptyState icon={Users} title="Members aren't yours to see here" line={(data.error as Error).message} />;
  if (!data.data || !couchId) return <div aria-busy className="mx-4 mt-6 h-64 animate-pulse rounded-[4px] bg-card" />;
  const { games, members } = data.data;
  const commissioner = games.some((g) => g.yours);
  const personRow = members.find((m) => m.userId === person);
  const gameRow = games.find((g) => g.leagueId === game);
  const runners = (g: MemberGame) => members.filter((m) => m.roles[g.leagueId] === "commissioner" || m.roles[g.leagueId] === "admin");
  return (
    <div className="pb-12">
      <section className="mt-6 px-4">
        <SectionHead title="Who runs what" flush />
        <div className="flex flex-col">
          {games.map((g) => (
            <button key={g.leagueId} type="button" data-runs={g.gameName} onClick={() => setGame(g.leagueId)} className="nd-press flex min-h-[60px] items-center gap-3 border-t border-border py-2 text-left first:border-t-0">
              <i className="size-3.5 flex-none rounded-full" style={{ background: gameColour(g.gameName) }} aria-hidden />
              <span className="min-w-0 flex-1">
                <b className="block text-[16px]">{g.gameName}</b>
                <small className="block text-[13px] text-muted-foreground">{g.name}</small>
              </span>
              <span className="flex">
                {runners(g).map((m, i) => (
                  <span key={m.userId} className={`rounded-[3px] shadow-[0_0_0_2px_var(--background)] ${i ? "-ml-1.5" : ""}`}>
                    <Avatar id={m.userId} name={m.name} size={26} />
                  </span>
                ))}
              </span>
              <ChevronRight className="size-5 text-muted-foreground" aria-hidden />
            </button>
          ))}
        </div>
      </section>

      <section className="mt-[26px] px-4">
        <SectionHead
          title="Players"
          aside={
            <Preview id="show.invite" tag={false}>
              <button type="button" className="text-[15px] font-bold text-chyron-line">
                Invite
              </button>
            </Preview>
          }
          flush
        />
        <ul className="flex flex-col">
          {members.map((m) => (
            <li key={m.userId} data-member={m.name} className="flex min-h-[64px] items-center gap-3 border-t border-border py-2 first:border-t-0">
              <Avatar id={m.userId} name={m.name} size={34} />
              <span className="min-w-0 flex-1">
                <b className="flex items-center gap-2 text-[16px]">
                  <span className="truncate">{m.name}</span>
                  {m.you && <span className="type-caption flex-none rounded-[2px] bg-foreground px-1.5 text-[12px] text-background">You</span>}
                </b>
                <small className="block text-[13px] leading-snug text-muted-foreground">{roleLine(m, games)}</small>
              </span>
              <button
                type="button"
                data-member-menu={m.name}
                aria-label={`${m.name}: role`}
                onClick={() => setPerson(m.userId)}
                className="grid size-11 flex-none place-items-center rounded-[3px] outline-1 -outline-offset-1 outline-input"
              >
                <Ellipsis className="size-5" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      </section>

      <p className="px-4 pt-6 text-[14px] leading-relaxed text-muted-foreground">
        <b className="text-foreground">Commissioner:</b> results, waivers, rules and roles. <b className="text-foreground">Game admin:</b> results and waivers, and can pick for people in a
        draft. Roles can be shared, so two people can run a game.{commissioner ? "" : " Only a Commissioner changes them."}
      </p>

      {/* Someone taken out (or leaving) drops off the list when it's read again: their sheet goes with them. */}
      {personRow && (
        <MemberSheet seasonId={seasonId} couchId={couchId} show={show} member={personRow} games={games} members={members} onClose={() => setPerson(null)} />
      )}
      {gameRow && <GameSheet seasonId={seasonId} couchId={couchId} game={gameRow} members={members} onClose={() => setGame(null)} />}
    </div>
  );
}

/** The game's own sheet: who runs it, a switch each (on: Game admin). A Commissioner stays one until they hand it on. */
function GameSheet({ seasonId, couchId, game, members, onClose }: { seasonId: string; couchId: string; game: MemberGame; members: Member[]; onClose: () => void }) {
  const after = useAfter();
  const [busy, setBusy] = useState<string | null>(null);
  const players = members.filter((m) => m.roles[game.leagueId]);
  const flip = async (m: Member) => {
    const role = m.roles[game.leagueId];
    if (!game.yours) return toast("Only a Commissioner changes who runs it");
    if (role === "commissioner") return toast(m.you ? "Hand it to someone else first" : `${m.name} is a Commissioner: change it from their row`);
    setBusy(m.userId);
    try {
      const next: LeagueRole = role === "admin" ? "member" : "admin";
      const r = await gameAdmin.role(seasonId, couchId, m.userId, next, [game.leagueId]);
      await after();
      toast(`${m.name} ${next === "admin" ? `runs ${game.gameName} too` : `is a player in ${game.gameName}`}`, r.batch ? { undo: () => void undo(seasonId, couchId, r.batch, after) } : {});
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(null);
    }
  };
  return (
    <Sheet open onOpenChange={(o) => !o && onClose()} title={game.gameName} subtitle={`${game.name} · who runs it`}>
      <ul data-game-sheet className="flex flex-col">
        {players.map((m) => {
          const role = m.roles[game.leagueId];
          const on = role === "commissioner" || role === "admin";
          return (
            <li key={m.userId}>
              <button type="button" data-runner={m.name} aria-pressed={on} disabled={busy === m.userId} onClick={() => flip(m)} className="flex min-h-[60px] w-full items-center gap-3 border-t border-border py-2 text-left">
                <Avatar id={m.userId} name={m.name} size={30} />
                <span className="min-w-0 flex-1">
                  <b className="block text-[15px]">{m.name}</b>
                  <small className="block text-[13px] text-muted-foreground">{ROLE_WORDS[role]}</small>
                </span>
                <span className={`relative h-6 w-10 flex-none rounded-full transition-colors ${on ? "bg-good" : "bg-secondary"} ${role === "commissioner" ? "opacity-60" : ""}`} aria-hidden>
                  <i className={`absolute top-0.5 size-5 rounded-full bg-white transition-transform ${on ? "translate-x-[18px]" : "translate-x-0.5"}`} />
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-[13px] text-muted-foreground">Share it: turn on as many people as you like. They run results and waivers.</p>
    </Sheet>
  );
}

async function undo(seasonId: string, couchId: string, batch: string, after: () => Promise<unknown>) {
  try {
    await backstage.undo(seasonId, couchId, batch);
    await after();
    toast("Undone");
  } catch (e) {
    toast((e as Error).message);
  }
}

function MemberSheet({
  seasonId,
  couchId,
  show,
  member,
  games,
  members,
  onClose,
}: {
  seasonId: string;
  couchId: string;
  show: ShowData;
  member: Member;
  games: MemberGame[];
  members: Member[];
  onClose: () => void;
}) {
  const after = useAfter();
  const nav = useNav();
  const [hold, setHold] = useState<OutPreview | null | false>(false);
  const theirs = games.filter((g) => member.roles[g.leagueId]);
  const yours = theirs.filter((g) => g.yours);
  const roles = [...new Set(theirs.map((g) => member.roles[g.leagueId]))];
  const current = roles.length === 1 ? roles[0] : null;
  // The last Commissioner of a game they're in can't step down (roles.ts): said before they tap.
  const lastOf = theirs.filter((g) => member.roles[g.leagueId] === "commissioner" && members.filter((m) => m.roles[g.leagueId] === "commissioner").length < 2);
  const set = async (role: LeagueRole) => {
    if (!yours.length) return toast("Only a Commissioner changes roles");
    if (role !== "commissioner" && lastOf.length) return toast("Every game needs a Commissioner. Hand it to someone first.");
    try {
      const r = await gameAdmin.role(seasonId, couchId, member.userId, role, yours.map((g) => g.leagueId));
      await after();
      onClose();
      if (r.batch) toast(`${member.name} is now ${role === "commissioner" ? "a Commissioner" : role === "admin" ? "a Game admin" : "a player"}`, { undo: () => void undo(seasonId, couchId, r.batch, after) });
    } catch (e) {
      toast((e as Error).message);
    }
  };
  const askOut = async () => {
    setHold(null);
    try {
      setHold(member.you ? await gameAdmin.leave(seasonId, couchId, true) : await gameAdmin.remove(seasonId, couchId, member.userId, true));
    } catch (e) {
      setHold(false);
      toast((e as Error).message);
    }
  };
  const show_ = show.header?.show.name ?? "this show";
  const consequence = (o: OutPreview) =>
    `${member.you ? "You leave" : `${member.name} leaves`} ${o.games.join(", ")} on ${show_}. ${
      o.drafted ? `${member.you ? "Your" : "Their"} team and points stay in the standings, but nobody plays ${member.you ? "it" : "them"}.` : "Nothing's been drafted yet, so the seat just goes."
    }${member.you ? " Whoever runs the games can bring you back." : ""}`;
  return (
    <>
      <Sheet open={hold === false} onOpenChange={(o) => !o && onClose()} title={member.name} subtitle={`${show_}${show.couch ? ` · ${show.couch.name}` : ""}`}>
        <div data-member-sheet className="flex flex-col gap-2">
          {ROLES.map(([k, t, d]) => {
            const blocked = k !== "commissioner" && lastOf.length > 0;
            const on = current === k;
            return (
              <button
                key={k}
                type="button"
                data-role={k}
                aria-pressed={on}
                aria-disabled={blocked || !yours.length}
                onClick={() => (on ? undefined : set(k))}
                className={`rounded-[3px] p-3 text-left ${on ? "bg-foreground text-background" : "bg-background"} ${blocked ? "opacity-55" : ""}`}
              >
                <b className="block text-[16px]">{t}</b>
                <small className={`block text-[13px] ${on ? "text-background/75" : "text-muted-foreground"}`}>
                  {blocked ? "Make someone else Commissioner first, so the game always has one" : d}
                </small>
              </button>
            );
          })}
          {theirs.length > 1 && <p className="text-[13px] text-muted-foreground">In {yours.length === theirs.length ? `all ${theirs.length} of their games here` : yours.map((g) => g.gameName).join(" and ")}.</p>}
          {(member.you || yours.length > 0) && (
            <button type="button" data-out onClick={askOut} className="mt-2 flex min-h-[56px] flex-col justify-center rounded-[3px] border-t border-border text-left">
              <b className="text-[15px] text-live">{member.you ? "Leave these games" : "Remove from this show's games"}</b>
              <small className="text-[13px] text-muted-foreground">{member.you ? "You stay on the couch if you play anything else there" : "They keep their past results"}</small>
            </button>
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
        title={member.you ? "Leave these games?" : `Remove ${member.name}?`}
        consequence={hold ? consequence(hold) : null}
        problem={hold ? hold.problem : null}
        cta={member.you ? "leave" : `remove ${member.name}`}
        onConfirm={async () => {
          if (member.you) {
            await gameAdmin.leave(seasonId, couchId);
            await after();
            toast("You've left the games here");
            nav.push(paths.home);
          } else {
            const r = await gameAdmin.remove(seasonId, couchId, member.userId);
            await after();
            toast(`${member.name} is out · restorable for 30 days`, r.batch ? { undo: () => void undo(seasonId, couchId, r.batch!, after) } : {});
          }
        }}
      />
    </>
  );
}
