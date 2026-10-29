"use client";

import { useState, type ComponentType, type ReactNode } from "react";
import { ChevronRight, Trophy, Unlink } from "lucide-react";
import { colourOf } from "@/lib/people";
import { NavLink } from "../nav";
import { paths } from "../routes";
import { Avatar } from "../ui/bars";
import { Btn } from "../ui/parts";
import { Sheet } from "../ui/sheet";
import { toast } from "../ui/toast";
import { deskSend, useAfterDesk, useDesk, type HandOnCandidate, type HandOnGame } from "./data";
import { agoOf, useChangeToast } from "./parts";

// A seat's sheet and Hand on (docs/PLAN-desk-parity.md step 1 part 1c; the mock's desk-games.js dgSeatSheet and desk.js
// dkHandOn). A seat is someone's place in a game, with its team, picks and scores, and one account signed in to it. Its
// sheet is the same from a person's page (part 1c) and a game's (step 6b, which adds Act as them, Link another account and
// Take them out): the role, the only Commissioner's dimmed with Hand it on first, Unlink, and Open the game. Hand on is
// one sheet for a seat, a Delete (part 1c), a couch nobody runs (step 2) and a game's page (step 6). Server:
// src/lib/server/desk-seats.ts, through /api/desk/seats/[leagueId]/[userId] and /api/desk/hand-on.

export type SeatRole = "commissioner" | "admin" | "member";

/** A seat, as the sheet needs it. */
export interface DeskSeat {
  leagueId: string;
  /** The game's name. */
  game: string;
  season: string | null;
  couch: { id: string; name: string } | null;
  /** The account signed in to it. */
  user: { id: string; name: string };
  role: SeatRole;
  /** Its only Commissioner. */
  alone: boolean;
  /** Others signed in to its seats (who it could be handed to). */
  others: number;
}

const ROLES: [SeatRole, string, string][] = [
  ["commissioner", "Commissioner", "Results, waivers, rules and roles"],
  ["admin", "Game admin", "Results and waivers; can pick for people"],
  ["member", "Player", "Plays; sees nothing backstage"],
];
export const ROLE_TITLE: Record<SeatRole, string> = { commissioner: "Commissioner", admin: "Game admin", member: "Player" };

/** "a, b and c" (items may hold commas of their own). */
export const andList = (a: string[]) => (a.length <= 1 ? (a[0] ?? "") : `${a.slice(0, -1).join(", ")} and ${a[a.length - 1]}`);

/** A sheet's small heading (the mock's .dk-sub). */
export function SubHead({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-2 mt-[22px] flex items-baseline justify-between gap-3 first:mt-1">
      <h2 className="type-caption text-[17px] tracking-[0.04em] text-muted-foreground">{children}</h2>
      {aside != null && <span className="text-[13px] text-muted-foreground">{aside}</span>}
    </div>
  );
}

/** A row in a sheet (the mock's .row.dk-srow): its icon, what it does and one line; dimmed when it can't be done now. */
function SheetRow({
  icon: Icon,
  title,
  line,
  dim,
  href,
  onClick,
  data,
  tone,
}: {
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  title: string;
  line: string;
  dim?: boolean;
  href?: string;
  onClick?: () => void;
  data: string;
  tone?: "live";
}) {
  const body = (
    <>
      <span className={`grid size-10 flex-none place-items-center rounded-[3px] ${tone === "live" && !dim ? "bg-live/15 text-live" : "bg-background"} ${dim ? "text-muted-foreground" : ""}`}>
        <Icon className="size-5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <b className={`block text-[16px] font-semibold leading-snug ${dim ? "text-muted-foreground" : tone === "live" ? "text-live" : ""}`}>{title}</b>
        <small className="mt-0.5 block text-[13px] leading-snug text-muted-foreground">{line}</small>
      </span>
      {href && <ChevronRight className="size-5 flex-none text-muted-foreground" aria-hidden />}
    </>
  );
  const cls = `nd-press flex min-h-[66px] w-full items-center gap-3 border-t border-border py-2.5 text-left ${dim ? "opacity-[.62]" : ""}`;
  if (href)
    return (
      <NavLink href={href} onClick={onClick} data-seat-row={data} className={cls}>
        {body}
      </NavLink>
    );
  return (
    <button type="button" data-seat-row={data} aria-disabled={dim || undefined} onClick={onClick} className={cls}>
      {body}
    </button>
  );
}

/**
 * A seat's sheet: who's in which game, its role (tier 1, Undo), Unlink (tier 1, Undo: the seat keeps playing with nobody
 * signed in) and, from a person's page, Open the game. The only Commissioner's other roles and Unlink are dimmed, with Hand
 * it on first (`onHandOn`).
 */
export function SeatSheet({ seat, open, onClose, onHandOn }: { seat: DeskSeat | null; open: boolean; onClose: () => void; onHandOn: (seat: DeskSeat) => void }) {
  const after = useAfterDesk();
  const said = useChangeToast();
  const [busy, setBusy] = useState(false);
  if (!seat) return null;
  const u = seat.user.name;
  const send = async (body: unknown) => {
    setBusy(true);
    try {
      const out = await deskSend<{ changeId: string; text: string }>(`/seats/${seat.leagueId}/${seat.user.id}`, body);
      onClose();
      await after();
      said(out.text, out.changeId);
    } catch (e) {
      toast.quiet((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()} title={`${u} in ${seat.game}`} subtitle={[seat.season, seat.couch?.name].filter(Boolean).join(" · ") || undefined}>
      <div data-seat-sheet={seat.game}>
        {seat.alone && (
          <div data-seat-alone className="mb-2.5 rounded-[3px] bg-background p-3.5 text-[14px] leading-normal">
            {seat.others ? (
              <>
                <p>
                  {u} runs {seat.game} alone. Hand it on first, so the game always has a Commissioner.
                </p>
                <Btn data-seat-hand-on wide className="mt-2.5 h-11 text-[15px]" onClick={() => onHandOn(seat)}>
                  Hand it on
                </Btn>
              </>
            ) : (
              <p>
                {u} runs {seat.game} alone, and nobody else plays it: there&apos;s nobody to hand it to yet.
              </p>
            )}
          </div>
        )}
        <SubHead>Role</SubHead>
        <div role="group" aria-label="Role">
          {ROLES.map(([k, title, line]) => {
            const on = seat.role === k;
            const blocked = seat.alone && k !== "commissioner";
            return (
              <button
                key={k}
                type="button"
                data-seat-role={k}
                aria-pressed={on}
                aria-disabled={blocked || undefined}
                disabled={busy}
                onClick={() => {
                  if (blocked) return toast.quiet("Every game needs a Commissioner. Hand it to someone first");
                  if (!on) void send({ role: k });
                }}
                className={`mb-2 flex w-full flex-col rounded-[4px] p-3 text-left ${on ? "bg-plate text-plate-foreground outline-[3px] -outline-offset-[3px] outline-chyron-line" : "bg-secondary/60"} ${blocked ? "opacity-50" : ""}`}
              >
                <b className="block text-[16px]">{title}</b>
                <small className={`block text-[13px] leading-snug ${on ? "text-plate-muted" : "text-muted-foreground"}`}>{line}</small>
              </button>
            );
          })}
        </div>
        <SubHead>The seat</SubHead>
        <div className="border-b border-border">
          <SheetRow
            data="unlink"
            icon={Unlink}
            title={`Unlink ${u}'s account`}
            line={seat.alone ? "Not while they run it alone" : "The seat keeps its team and scores, with nobody signed in"}
            dim={seat.alone}
            onClick={() => {
              if (seat.alone) return toast.quiet(`${u} runs ${seat.game} alone. Hand it to someone first`);
              if (!busy) void send({ unlink: true });
            }}
          />
          {/* Until step 6a gives games a page of their own, the game opens on its couch's page. */}
          {seat.couch && (
            <SheetRow data="open" icon={Trophy} title={`Open ${seat.game}`} line={`On ${seat.couch.name}'s page: who plays it and who runs it`} href={paths.deskItem("couch", seat.couch.id)} onClick={onClose} />
          )}
        </div>
      </div>
    </Sheet>
  );
}

/** Who took which games (the delete sheet's "dana runs ... now"). */
export interface Handed {
  to: string;
  name: string;
  games: string[];
}

/**
 * Hand on (the mock's dkHandOn): who runs these games next. One person for them all (only someone who plays every one), or
 * game by game; whoever plays there, most active first. Tier 1: a toast with Undo and History lines; the new Commissioner
 * is told, and whoever's going (`from`) stays one too until they go. `games` names them while the sheet reads who plays.
 */
export function HandOnSheet({
  open,
  onClose,
  from,
  games,
  deleting,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  from: { id: string; name: string } | null;
  games: { leagueId: string; name: string; couch: string | null }[];
  deleting?: boolean;
  onDone?: (handed: Handed[]) => void;
}) {
  const ids = games.map((g) => g.leagueId);
  const q = useDesk<{ games: HandOnGame[]; candidates: HandOnCandidate[] }>(open && ids.length ? `/hand-on?games=${ids.join(",")}${from ? `&from=${encodeURIComponent(from.id)}` : ""}` : null);
  const many = games.length > 1;
  const couches = [...new Set(games.map((g) => g.couch).filter(Boolean))] as string[];
  const where = couches.length === 1 ? couches[0] : couches.length ? `${couches.length} couches` : null;
  const sub = [where, from ? `${from.name} runs ${many ? "these" : "it"} alone` : `nobody runs ${many ? "them" : "it"}`].filter(Boolean).join(" · ");
  return (
    <Sheet
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={many ? `Hand on ${from ? `${from.name}'s` : where ? `${where}'s` : "these"} games` : `Hand on ${games[0]?.name ?? "it"}`}
      subtitle={sub}
    >
      {q.data ? (
        <HandOnBody key={ids.join()} data={q.data} from={from} deleting={deleting} manyCouches={couches.length > 1} onClose={onClose} onDone={onDone} />
      ) : q.error ? (
        <p className="text-[14px] text-muted-foreground">{(q.error as Error).message}</p>
      ) : (
        <div aria-busy className="h-56 animate-pulse rounded-[3px] bg-background" />
      )}
    </Sheet>
  );
}

function HandOnBody({
  data,
  from,
  deleting,
  manyCouches,
  onClose,
  onDone,
}: {
  data: { games: HandOnGame[]; candidates: HandOnCandidate[] };
  from: { id: string; name: string } | null;
  deleting?: boolean;
  manyCouches: boolean;
  onClose: () => void;
  onDone?: (handed: Handed[]) => void;
}) {
  const after = useAfterDesk();
  const said = useChangeToast();
  const { candidates } = data;
  const plays = (c: HandOnCandidate, g: HandOnGame) => c.plays.includes(g.leagueId);
  // A game nobody else can take (everyone else in it can't sign in) is shown, and left as it is.
  const games = data.games.filter((g) => candidates.some((c) => plays(c, g)));
  const many = games.length > 1;
  const full = candidates.filter((c) => games.length && games.every((g) => plays(c, g)));
  const [mode, setMode] = useState<"same" | "each">(full.length || !many ? "same" : "each");
  const [pick, setPick] = useState<string | null>(full[0]?.id ?? null);
  const [per, setPer] = useState<Record<string, string | undefined>>(() => Object.fromEntries(games.map((g) => [g.leagueId, candidates.find((c) => plays(c, g))?.id])));
  const [busy, setBusy] = useState(false);
  const toOf = (g: HandOnGame) => (mode === "same" ? pick : per[g.leagueId]) ?? null;
  const ready = games.length > 0 && games.every((g) => toOf(g));
  const nameOf = (id: string | null) => candidates.find((c) => c.id === id)?.name ?? "";
  const who = [...new Set(games.map(toOf).filter(Boolean))].map((id) => nameOf(id));
  const active = (c: HandOnCandidate) => (c.activeAt ? `active ${agoOf(c.activeAt)}` : "not active yet");
  const seasonLine = (g: HandOnGame) => [g.season ?? g.game, manyCouches ? g.couch : null].filter(Boolean).join(" · ");
  const go = async () => {
    if (!ready || busy) return;
    setBusy(true);
    try {
      const out = await deskSend<{ changeId: string; text: string; handed: Handed[] }>("/hand-on", { from: from?.id ?? null, moves: games.map((g) => ({ leagueId: g.leagueId, to: toOf(g) })) });
      onClose();
      await after();
      said(out.text, out.changeId);
      onDone?.(out.handed);
    } catch (e) {
      toast.quiet((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  if (!games.length)
    return (
      <p data-hand-on-nobody className="rounded-[3px] bg-background p-3.5 text-[14px] leading-normal">
        Nobody else who plays {many ? "them" : "it"} can sign in now: there&apos;s nobody to hand {many ? "them" : "it"} to.
      </p>
    );
  return (
    <div data-hand-on={mode}>
      <div className="flex flex-wrap gap-1.5">
        {data.games.map((g) => (
          <span key={g.leagueId} className="flex flex-col gap-0.5 rounded-[3px] bg-background px-2.5 py-2">
            <b className="text-[14px]">{g.name}</b>
            <small className="text-[12px] text-muted-foreground">{seasonLine(g)}</small>
          </span>
        ))}
      </div>
      {mode === "same" ? (
        <>
          <SubHead aside={many ? "Playing here" : "Playing it"}>Who runs {many ? "them" : "it"} next?</SubHead>
          <div role="radiogroup" aria-label={`Who runs ${many ? "them" : "it"} next`}>
            {candidates.map((c) => {
              const all = games.every((g) => plays(c, g));
              const on = pick === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  aria-disabled={!all || undefined}
                  data-hand-pick={c.name}
                  onClick={() => (all ? setPick(c.id) : toast.quiet(`${c.name} doesn't play every one: hand them on game by game`))}
                  className={`mb-1.5 flex min-h-16 w-full items-center gap-3 rounded-[3px] px-3 py-2.5 text-left ${on ? "bg-plate text-plate-foreground outline-[3px] -outline-offset-[3px] outline-chyron-line" : "bg-secondary/60"} ${all ? "" : "opacity-55"}`}
                >
                  <Avatar id={c.id} name={c.name} size={40} colour={colourOf(c.id, c.colour)} />
                  <span className="min-w-0 flex-1">
                    <b className="block text-[16px] [overflow-wrap:anywhere]">
                      {c.name}
                      {all && c.id === full[0]?.id && (
                        <i className={`type-caption ml-1.5 inline-block rounded-[2px] px-1.5 pb-0.5 pt-[3px] align-[2px] text-[11px] not-italic leading-none tracking-[0.06em] ${on ? "bg-plate-foreground text-plate" : "bg-foreground text-background"}`}>
                          Most active
                        </i>
                      )}
                    </b>
                    <small className={`mt-0.5 block text-[13px] leading-snug ${on ? "text-plate-muted" : "text-muted-foreground"}`}>
                      {all ? (many ? `Plays all ${games.length}` : "Plays it") : `Plays ${andList(games.filter((g) => plays(c, g)).map((g) => g.name))} only`} · {active(c)}
                    </small>
                  </span>
                  <span aria-hidden className={`size-[22px] flex-none rounded-full ${on ? "shadow-[inset_0_0_0_7px_var(--color-plate-foreground)]" : "shadow-[inset_0_0_0_2px_var(--color-input)]"}`} />
                </button>
              );
            })}
          </div>
          {many && (
            <button type="button" data-hand-each onClick={() => setMode("each")} className="mt-2 inline-flex min-h-11 items-center text-[15px] font-bold underline decoration-input underline-offset-[3px]">
              Different people for different games
            </button>
          )}
        </>
      ) : (
        <>
          {games.map((g) => (
            <div key={g.leagueId} data-hand-game={g.name} className="mt-3 border-t border-border pt-3">
              <b className="block text-[16px]">{g.name}</b>
              <small className="mb-2.5 mt-0.5 block text-[13px] text-muted-foreground">{seasonLine(g)}</small>
              <div className="flex flex-wrap gap-1.5">
                {candidates
                  .filter((c) => plays(c, g))
                  .map((c) => {
                    const on = per[g.leagueId] === c.id;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        aria-pressed={on}
                        data-hand-per={`${g.name}:${c.name}`}
                        onClick={() => setPer((p) => ({ ...p, [g.leagueId]: c.id }))}
                        className={`flex h-11 items-center gap-2 rounded-[3px] pl-2.5 pr-3 text-[15px] font-semibold ${on ? "bg-plate text-plate-foreground" : "bg-secondary/60"}`}
                      >
                        <Avatar id={c.id} name={c.name} size={24} colour={colourOf(c.id, c.colour)} />
                        {c.name}
                      </button>
                    );
                  })}
              </div>
            </div>
          ))}
          {full.length > 0 && (
            <button type="button" data-hand-same onClick={() => setMode("same")} className="mt-3 inline-flex min-h-11 items-center text-[15px] font-bold underline decoration-input underline-offset-[3px]">
              One person for all {games.length}
            </button>
          )}
        </>
      )}
      <p data-hand-note className="mb-3 mt-3.5 text-[14px] leading-normal text-muted-foreground">
        {who.length ? andList(who) : "They"} {who.length > 1 ? "are each told and become" : "is told and becomes"} Commissioner.
        {from ? ` ${from.name} stays one too${deleting ? " until the account goes" : ""}.` : ""} Undo from the toast, or from History.
      </p>
      <Btn data-hand-go tone="must" wide disabled={!ready || busy} onClick={go}>
        {mode === "same" ? (pick ? `Hand ${many ? `all ${games.length}` : "it"} to ${nameOf(pick)}` : `Choose who runs ${many ? "them" : "it"}`) : "Hand them on"}
      </Btn>
    </div>
  );
}
