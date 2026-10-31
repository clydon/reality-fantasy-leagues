"use client";

import { useEffect, useRef, useState, type ComponentType, type ReactNode } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Bot, ChevronRight, Ellipsis, Eye, Link as LinkIcon, LogOut, Search, Trash2, Trophy, Unlink, User } from "lucide-react";
import { colourOf } from "@/lib/people";
import { NavLink } from "../nav";
import { paths } from "../routes";
import { Avatar } from "../ui/bars";
import { HoldSheet } from "../ui/guards";
import { Btn } from "../ui/parts";
import { Sheet } from "../ui/sheet";
import { toast } from "../ui/toast";
import { ActSheet } from "./act";
import { deskGet, deskSend, useAfterDesk, useDesk, type GameSeats, type HandOnCandidate, type HandOnGame, type LinkCandidate, type SeatEmpty, type SeatOut, type SeatPerson } from "./data";
import { agoOf, dateOf, DeskRow, PersonTags, Says, Section, useChangeToast, useDebounced } from "./parts";

// A seat's sheet and Hand on (docs/PLAN-desk-parity.md step 1 part 1c, step 6 part 6b; the mock's desk-games.js
// dgSeatSheet, dgLinkSheet, dgTakeOut, dgEmptySheet, dgOutSheet and desk.js dkHandOn). A seat is someone's place in a game,
// with its team, picks and scores, and one account signed in to it. Its sheet is the same from a person's page and a game's:
// the role (the only Commissioner's dimmed, with Hand it on first), Act as them (from the game), Link another account,
// Unlink, Open the game (from the person) and Take them out, last. A game's Seats (part 6b): signed in, empty (Link, or
// Remove the seat) and out of it (Put them back). Hand on is one sheet for a seat, a Delete (part 1c), a couch nobody runs
// (step 2) and a game's page (step 6). Server: src/lib/server/desk-seats.ts and desk-seat-moves.ts, through
// /api/desk/seats/[leagueId]/[userId], /api/desk/seats/[leagueId]/player/[playerId], /api/desk/games/[id]/accounts and
// /api/desk/hand-on.

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
  /** It has drafted: taken out, their seat stays in the standings, unplayed. */
  drafted: boolean;
  /** Their other games on its couch (Take out's "and in its other game"). */
  otherGames: number;
  /** Why no other account can sign in here (a practice game, a public pool), else null. */
  noLink: string | null;
  /** From a game's page: who's in it (their row, and whether Act as them is offered). */
  person?: SeatPerson;
}

const ROLES: [SeatRole, string, string][] = [
  ["commissioner", "Commissioner", "Results, waivers, rules and roles"],
  ["admin", "Game admin", "Results and waivers; can pick for people"],
  ["member", "Player", "Plays; sees nothing backstage"],
];
export const ROLE_TITLE: Record<SeatRole, string> = { commissioner: "Commissioner", admin: "Game admin", member: "Player" };
const A_ROLE: Record<SeatRole, string> = { commissioner: "a Commissioner", admin: "a Game admin", member: "a Player" };

/** "a, b and c" (items may hold commas of their own). */
export const andList = (a: string[]) => (a.length <= 1 ? (a[0] ?? "") : `${a.slice(0, -1).join(", ")} and ${a[a.length - 1]}`);

/** One line of what a hold does (the mock's .dk-cons). */
export const CON = "relative pl-4 text-[15px] leading-normal before:absolute before:left-0 before:top-[.6em] before:size-1.5 before:rounded-[1px] before:bg-live";

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
  chev,
  onClick,
  data,
  tone,
}: {
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  title: string;
  line: string;
  dim?: boolean;
  href?: string;
  chev?: boolean;
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
      {(href || chev) && <ChevronRight className="size-5 flex-none text-muted-foreground" aria-hidden />}
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

/** A sheet that hands on to the next (the seat's sheet to Link, Take out or Act as): the first closes, then the next opens. */
function useSteps<T extends string>(first: T) {
  const [step, setStep] = useState<T | null>(first);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const go = (next: T) => {
    setStep(null);
    timer.current = setTimeout(() => setStep(next), 250);
  };
  return { step, go };
}

/** A desk write from a sheet: closed, every desk read moves on, and the toast (with Undo). */
function useSeatSend(onClose: () => void) {
  const after = useAfterDesk();
  const said = useChangeToast();
  const [busy, setBusy] = useState(false);
  /** After a write (a hold's, which closes itself): every desk read moves on, and the toast with Undo. */
  const done = async (out: { changeId: string; text: string }) => {
    await after();
    said(out.text, out.changeId);
  };
  const send = async (path: string, body: unknown) => {
    setBusy(true);
    try {
      const out = await deskSend<{ changeId: string; text: string }>(path, body);
      onClose();
      await done(out);
    } catch (e) {
      toast.quiet((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return { send, busy, done };
}

/** "Active 12 minutes ago", or not yet. */
const activeLine = (at: string | null) => (at ? `Active ${agoOf(at)}` : "Not active yet");

/**
 * A seat's sheet: who's in which game, its role (tier 1, Undo), Act as them (from the game), Link another account (tier 1,
 * Undo: they come out), Unlink (tier 1, Undo: the seat keeps playing with nobody signed in), Open the game (from a person)
 * and Take them out, last (tier 3, a hold). The only Commissioner's other roles, Unlink and Take out are dimmed, with Hand
 * it on first (`onHandOn`).
 */
export function SeatSheet({ seat, open, onClose, onHandOn }: { seat: DeskSeat | null; open: boolean; onClose: () => void; onHandOn: (seat: DeskSeat) => void }) {
  const { step, go } = useSteps<"seat" | "link" | "out" | "act">("seat");
  const { send, busy, done } = useSeatSend(onClose);
  if (!seat) return null;
  const u = seat.user.name;
  const fromGame = !!seat.person;
  const canAct = !!seat.person && !seat.person.you && !seat.person.admin && !seat.person.waiting && !seat.person.stopped;
  const at = `/seats/${seat.leagueId}/${seat.user.id}`;
  const where = [seat.season, seat.couch?.name].filter(Boolean).join(" · ") || undefined;
  const other = seat.otherGames;
  return (
    <>
      <Sheet open={open && step === "seat"} onOpenChange={(o) => !o && onClose()} title={`${u} in ${seat.game}`} subtitle={where}>
        <div data-seat-sheet={seat.game}>
          {seat.person && (
            <div data-seat-who className="-mt-1 border-b border-border">
              <DeskRow
                href={paths.deskItem("person", seat.user.id)}
                data="seat-who"
                lead={<Avatar id={seat.user.id} name={u} size={40} colour={colourOf(seat.user.id, seat.person.colour)} />}
                title={
                  <>
                    {u}
                    <PersonTags p={seat.person} />
                  </>
                }
                line={`Signed in to this seat · ${seat.person.activeAt ? `active ${agoOf(seat.person.activeAt)}` : "not active yet"}`}
              />
            </div>
          )}
          {seat.alone && (
            <div data-seat-alone className="mb-2.5 mt-2.5 rounded-[3px] bg-background p-3.5 text-[14px] leading-normal">
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
                    if (!on) void send(at, { role: k });
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
          <div>
            {fromGame && canAct && <SheetRow data="act" icon={Eye} title={`Act as ${u}`} line="See the game as they do, for an hour · it's in their History" chev onClick={() => go("act")} />}
            <SheetRow
              data="link"
              icon={LinkIcon}
              title="Link another account"
              line={seat.noLink ?? `Its team, picks and scores go to them; ${u} comes out`}
              dim={!!seat.noLink}
              chev={!seat.noLink}
              onClick={() => (seat.noLink ? toast.quiet(seat.noLink) : go("link"))}
            />
            <SheetRow
              data="unlink"
              icon={Unlink}
              title={`Unlink ${u}'s account`}
              line={seat.alone ? "Not while they run it alone" : "The seat keeps its team and scores, with nobody signed in"}
              dim={seat.alone}
              onClick={() => {
                if (seat.alone) return toast.quiet(`${u} runs ${seat.game} alone. Hand it to someone first`);
                if (!busy) void send(at, { unlink: true });
              }}
            />
            {!fromGame && <SheetRow data="open" icon={Trophy} title={`Open ${seat.game}`} line="The game's page: its seats, its code, its delete" href={paths.deskItem("game", seat.leagueId)} onClick={onClose} />}
          </div>
          <div className="mt-[18px] border-b border-border">
            <SheetRow
              data="take-out"
              icon={LogOut}
              tone="live"
              title={`Take ${u} out of ${seat.game}`}
              line={seat.alone ? "Not while they run it alone" : seat.drafted ? "Their seat stays in the standings, unplayed" : "Their seat goes from the game"}
              dim={seat.alone}
              chev={!seat.alone}
              onClick={() => (seat.alone ? toast.quiet(`${u} runs ${seat.game} alone. Hand it to someone first`) : go("out"))}
            />
          </div>
        </div>
      </Sheet>
      <LinkSheet
        open={open && step === "link"}
        onClose={onClose}
        leagueId={seat.leagueId}
        game={seat.game}
        couch={seat.couch?.name ?? null}
        target={{ kind: "move", userId: seat.user.id, name: u, role: seat.role, alone: seat.alone }}
      />
      {canAct && <ActSheet open={open && step === "act"} onClose={onClose} p={seat.user} />}
      <HoldSheet
        open={open && step === "out"}
        onOpenChange={(o) => !o && onClose()}
        title={`Take ${u} out of ${seat.game}?`}
        subtitle={where}
        consequence=""
        body={
          <ul data-take-out className="flex flex-col gap-2 rounded-[3px] bg-background px-3.5 py-3">
            <li className={CON}>{seat.drafted ? "Their seat stays in the standings with its team and points, and nobody plays it." : `Their seat goes from ${seat.game}, from the standings too.`}</li>
            {seat.couch && (
              <li className={CON}>
                They stay on {seat.couch.name}
                {other === 1 ? " and in its other game" : other ? ` and in its ${other} other games` : ""}.
              </li>
            )}
            <li className={CON}>You can put them back from this game&apos;s page.</li>
          </ul>
        }
        alt={{ label: "Unlink their account instead", line: "The seat keeps playing, with nobody signed in to it.", onClick: () => void send(at, { unlink: true }) }}
        cta={`take ${u} out`}
        restore="Put them back from the game's page any time"
        onConfirm={async () => {
          await done(await deskSend<{ changeId: string; text: string }>(at, { takeOut: true }));
        }}
      />
    </>
  );
}

// ---------- Link an account ----------

type LinkTarget = { kind: "move"; userId: string; name: string; role: SeatRole; alone: boolean } | { kind: "empty"; playerId: string; name: string };

/** What linking someone means here (the mock's dgLinkSheet rel). */
function relLine(c: LinkCandidate, game: string, couch: string | null): string {
  switch (c.rel) {
    case "here":
      return "Signed in to it now";
    case "waiting":
      return "Waiting to get in: let them in first";
    case "stopped":
      return "Can't sign in";
    case "out":
      return `${c.out?.how === "left" ? "Left" : "Taken out of"} ${game}${c.out?.at ? ` ${dateOf(c.out.at)}` : ""}: Put back gives them their own seat`;
    case "inGame":
      return `In ${game} already: their own seat is left empty`;
    case "onCouch":
      return `On ${couch ?? "its couch"} · not in ${game}`;
    default:
      return couch ? `Not on ${couch}: they join it too` : `Not in ${game}`;
  }
}

const canChoose = (c: LinkCandidate) => c.rel === "inGame" || c.rel === "onCouch" || c.rel === "notOnCouch";

/**
 * Link an account (the mock's dgLinkSheet, "Who signs in to this seat?"): the couch's people without a seat first, then a
 * search of every account by name, username or email; each says what linking them does, and someone waiting, stopped or out
 * of the game can't be chosen. The role as a segmented choice (the only Commissioner's seat stays Commissioner), a summary of
 * what moves, and Link (tier 1, Undo; they're told).
 */
export function LinkSheet({ open, onClose, leagueId, game, couch, target }: { open: boolean; onClose: () => void; leagueId: string; game: string; couch: string | null; target: LinkTarget }) {
  const [q, setQ] = useState("");
  const [pick, setPick] = useState<LinkCandidate | null>(null);
  const alone = target.kind === "move" && target.alone;
  const [role, setRole] = useState<SeatRole>(target.kind === "move" ? (alone ? "commissioner" : target.role) : "member");
  const { send, busy } = useSeatSend(onClose);
  const term = useDebounced(q.trim(), 200);
  const path = `/games/${leagueId}/accounts?${new URLSearchParams({ q: term, ...(target.kind === "move" ? { seat: target.userId } : {}) })}`;
  const list = useQuery({
    queryKey: ["new-design", "desk", path],
    queryFn: () => deskGet<{ list: LinkCandidate[]; total: number; searched: boolean }>(path),
    enabled: open,
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  });
  const seatName = target.name;
  const data = list.data;
  const shown = data?.searched ? data.list.slice(0, 6) : data?.list ?? [];
  // Only someone the list shows can be linked (a new search drops a pick it doesn't find).
  const picked = pick && shown.some((c) => c.id === pick.id) ? pick : null;
  // The seat that runs the game, or someone who runs it alone, stays Commissioner.
  const stays = alone ? "seat" : picked?.alone ? "them" : null;
  const u = picked?.name ?? "";
  const lines = picked
    ? [
        `${u} signs in to ${seatName}'s seat: its team, picks and scores are theirs from now on, and it's named ${u} in the tables.`,
        target.kind === "move" ? `${target.name} comes out of ${game}${couch ? ` and stays on ${couch}` : ""}.` : null,
        picked.rel === "inGame" ? `${u}'s own seat in ${game} is left empty.` : null,
        picked.rel === "notOnCouch" && couch ? `${u} joins ${couch} too.` : null,
        `${u} is told. Undo from the toast, or from History.`,
      ].filter(Boolean)
    : [];
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()} title="Who signs in to this seat?" subtitle={`${seatName}'s seat · ${couch ? `${game} on ${couch}` : game}`}>
      <div data-link-sheet>
        <label className="flex h-12 items-center gap-2 rounded-[3px] bg-background px-3 outline-1 -outline-offset-1 outline-input focus-within:outline-2 focus-within:outline-chyron">
          <Search className="size-5 flex-none text-muted-foreground" aria-hidden />
          <input
            data-link-search
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Name, username or email"
            aria-label="Find an account"
            autoComplete="off"
            spellCheck={false}
            className="h-full min-w-0 flex-1 bg-transparent text-base outline-none"
          />
        </label>
        {!data ? (
          <div aria-busy className="mt-4 h-40 animate-pulse rounded-[3px] bg-background" />
        ) : (
          <>
            <SubHead aside={data.searched ? (data.total > 6 ? `6 of ${data.total}: keep typing` : data.total || "") : shown.length || ""}>
              {data.searched ? "Accounts" : couch ? `On ${couch}, not in ${game}` : "Accounts"}
            </SubHead>
            <div role="radiogroup" aria-label="Accounts" data-link-list={data.searched ? "search" : "couch"}>
              {shown.length ? (
                shown.map((c) => {
                  const ok = canChoose(c);
                  const on = picked?.id === c.id;
                  const line = relLine(c, game, couch);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      aria-disabled={!ok || undefined}
                      data-link-pick={c.name}
                      data-link-rel={c.rel}
                      onClick={() => {
                        if (!ok) return toast.quiet(line);
                        setPick(c);
                        if (c.alone) setRole("commissioner");
                      }}
                      className={`mb-1.5 flex min-h-16 w-full items-center gap-3 rounded-[3px] px-3 py-2.5 text-left ${on ? "bg-plate text-plate-foreground outline-[3px] -outline-offset-[3px] outline-chyron-line" : "bg-secondary/60"} ${ok ? "" : "opacity-55"}`}
                    >
                      <Avatar id={c.id} name={c.name} size={40} colour={colourOf(c.id, c.colour)} />
                      <span className="min-w-0 flex-1">
                        <b className="block text-[16px] [overflow-wrap:anywhere]">{c.name}</b>
                        <small className={`mt-0.5 block text-[13px] leading-snug ${on ? "text-plate-muted" : "text-muted-foreground"}`}>
                          {line}
                          {ok ? ` · ${c.activeAt ? `active ${agoOf(c.activeAt)}` : "not active yet"}` : ""}
                        </small>
                      </span>
                      <span aria-hidden className={`size-[22px] flex-none rounded-full ${on ? "shadow-[inset_0_0_0_7px_var(--color-plate-foreground)]" : "shadow-[inset_0_0_0_2px_var(--color-input)]"}`} />
                    </button>
                  );
                })
              ) : (
                <p data-link-none className="rounded-[3px] bg-background p-3.5 text-[14px] leading-snug text-muted-foreground">
                  {data.searched ? <>Nobody&apos;s called &ldquo;{term}&rdquo;. Try their email.</> : `Everyone on ${couch ?? "its couch"} has a seat. Search for someone else.`}
                </p>
              )}
            </div>
          </>
        )}
        {picked ? (
          <div data-link-foot>
            <SubHead>{u} plays as</SubHead>
            <div className="flex gap-[3px] rounded-[3px] bg-background p-[3px] outline-1 -outline-offset-1 outline-input" role="radiogroup" aria-label="Role">
              {(["member", "admin", "commissioner"] as SeatRole[]).map((k) => {
                const off = !!stays && k !== "commissioner";
                return (
                  <button
                    key={k}
                    type="button"
                    role="radio"
                    aria-checked={role === k}
                    aria-disabled={off || undefined}
                    data-link-role={k}
                    onClick={() => (off ? toast.quiet(stays === "seat" ? `${seatName}'s seat runs ${game}: it stays Commissioner` : `${u} runs ${game} alone: they stay Commissioner`) : setRole(k))}
                    className={`h-11 flex-1 rounded-[2px] text-[14px] font-bold ${role === k ? "bg-foreground text-background" : "text-muted-foreground"} ${off ? "opacity-50" : ""}`}
                  >
                    {ROLE_TITLE[k]}
                  </button>
                );
              })}
            </div>
            {stays && (
              <p className="mt-2 text-[14px] leading-snug text-muted-foreground">
                {stays === "seat" ? <>It&apos;s the seat that runs {game}, so it stays Commissioner.</> : <>{u} runs {game} alone, so they stay Commissioner.</>}
              </p>
            )}
            <p data-link-summary className="mt-3.5 rounded-[3px] bg-background p-3.5 text-[15px] leading-normal">
              {lines.join(" ")}
            </p>
            <Btn
              data-link-go
              tone="must"
              wide
              className="mt-3.5"
              disabled={busy}
              onClick={() =>
                void send(target.kind === "move" ? `/seats/${leagueId}/${target.userId}` : `/seats/${leagueId}/player/${target.playerId}`, { link: { to: picked.id, role: stays ? "commissioner" : role } })
              }
            >
              Link {u}
            </Btn>
          </div>
        ) : (
          <Btn data-link-go wide className="mt-3.5" disabled>
            Choose an account
          </Btn>
        )}
      </div>
    </Sheet>
  );
}

// ---------- a game's seats (part 6b) ----------

/** The game a seats section is on. */
export interface SeatsGame {
  id: string;
  name: string;
  season: string | null;
  couch: { id: string; name: string } | null;
}

/** An empty seat's line: who saved it, when it was unlinked, or its account deleted while the game was. */
function emptyLine(e: SeatEmpty): string {
  if (e.why === "saved") return `Saved by ${e.by ?? "someone"}'s invite`;
  if (e.why === "unlinked") return `Unlinked${e.at ? ` ${dateOf(e.at)}` : ""}`;
  if (e.why === "deleted") return "Its account was deleted";
  return "";
}

/** How someone came out of it: "Left Oct 12", "Taken out Oct 26, by you", "Removed Oct 26, by you", "Account deleted". */
function outLine(o: SeatOut): string {
  const at = o.at ? ` ${dateOf(o.at)}` : "";
  const by = o.by ? `, by ${o.by}` : "";
  if (o.how === "left") return `Left${at}`;
  if (o.how === "out") return `Taken out${at}${by}`;
  if (o.how === "removed") return `Removed${at}${by}`;
  return `Account deleted${at}`;
}

/** An empty seat's sheet (the mock's dgEmptySheet): who saved it and how it fills, Link an account, Remove the seat (tier 3). */
function EmptySeatSheet({ g, e, drafted, noLink, first, onClose }: { g: SeatsGame; e: SeatEmpty; drafted: boolean; noLink: string | null; first: "seat" | "link"; onClose: () => void }) {
  const { step, go } = useSteps<"seat" | "link" | "remove">(first);
  const { done } = useSeatSend(onClose);
  const where = g.couch ? `${g.name} · ${g.couch.name}` : g.name;
  const says =
    e.why === "saved"
      ? `${e.by ?? "Someone"} saved it for ${e.name} with an invite${e.at ? ` on ${dateOf(e.at)}` : ""}. Whoever accepts that invite gets the seat, with its team and scores. Or link an account to it now.`
      : e.why === "unlinked"
        ? `Unlinked${e.at ? ` ${dateOf(e.at)}` : ""}${e.by ? `, by ${e.by}` : ""}. It keeps its team and scores until an account signs in to it.`
        : e.why === "deleted"
          ? "Its account was deleted while the game was. It keeps its team and scores until an account signs in to it."
          : "Nobody's signed in to it. It keeps its team and scores until an account signs in to it.";
  return (
    <>
      <Sheet open={step === "seat"} onOpenChange={(o) => !o && onClose()} title={`${e.name}'s seat`} subtitle={`${g.name} · nobody signed in`}>
        <div data-empty-sheet={e.name}>
          <Says>{says}</Says>
          <Btn data-empty-link tone="must" wide className="mt-3.5 gap-2" onClick={() => (noLink ? toast.quiet(noLink) : go("link"))}>
            <LinkIcon className="size-[18px]" aria-hidden />
            Link an account
          </Btn>
          <div className="mt-[18px] border-b border-border">
            <SheetRow
              data="remove-seat"
              icon={Trash2}
              tone="live"
              title={`Remove ${e.name}'s seat`}
              line={drafted ? "Its team stays in the standings, unplayed; nobody can sign in to it" : e.why === "saved" ? "It goes from the game, and the invite can't fill it" : "It goes from the game"}
              chev
              onClick={() => go("remove")}
            />
          </div>
        </div>
      </Sheet>
      <LinkSheet open={step === "link"} onClose={onClose} leagueId={g.id} game={g.name} couch={g.couch?.name ?? null} target={{ kind: "empty", playerId: e.playerId, name: e.name }} />
      <HoldSheet
        open={step === "remove"}
        onOpenChange={(o) => !o && onClose()}
        title={`Remove ${e.name}'s seat?`}
        subtitle={where}
        consequence=""
        body={
          <ul data-remove-seat className="flex flex-col gap-2 rounded-[3px] bg-background px-3.5 py-3">
            <li className={CON}>{drafted ? "It stays in the standings with its team and points, and nobody can sign in to it." : "It goes from the game."}</li>
            {e.why === "saved" && g.couch && (
              <li className={CON}>
                {e.by ?? "Their"}&apos;s invite still lets {e.name} onto {g.couch.name}, as a new player.
              </li>
            )}
          </ul>
        }
        cta="remove the seat"
        restore="Put it back from the game's page any time"
        onConfirm={async () => done(await deskSend<{ changeId: string; text: string }>(`/seats/${g.id}/player/${e.playerId}`, { remove: true }))}
      />
    </>
  );
}

/** Someone out of the game (the mock's dgOutSheet): what happened, and Put them back (tier 1, Undo). A seat still in the standings
 *  can be erased, last (tier 3, held, no Undo; 2026-10-31): its team and scores leave the game as if they never played. */
function OutSeatSheet({ g, o, onClose }: { g: SeatsGame; o: SeatOut; onClose: () => void }) {
  const { send, busy } = useSeatSend(onClose);
  const after = useAfterDesk();
  const [erasing, setErasing] = useState(false);
  const name = o.person?.name ?? o.name;
  const happened =
    o.how === "left"
      ? `${name} left ${g.name}${o.at ? ` on ${dateOf(o.at)}` : ""}.`
      : o.how === "deleted"
        ? `${name}'s account was deleted${o.at ? ` ${dateOf(o.at)}` : ""}.`
        : `${o.how === "out" ? "Taken out" : "Removed"}${o.at ? ` ${dateOf(o.at)}` : ""}${o.by ? `, by ${o.by}` : ""}.`;
  const standing = o.stays ? " Its team stays in the standings with its points; nobody plays it." : " It's out of the standings.";
  const couch = o.person && g.couch ? (o.onCouch ? ` ${name} is still on ${g.couch.name}.` : ` ${name} isn't on ${g.couch.name} any more.`) : "";
  return (
    <>
    <Sheet open={!erasing} onOpenChange={(x) => !x && onClose()} title={o.person ? `${name}'s seat` : `${o.name}'s seat`} subtitle={`${g.name} · ${outLine(o).replace(/^./, (c) => c.toLowerCase())}`}>
      <div data-out-sheet={name}>
        <Says data="seat-out">
          {happened}
          {standing}
          {couch}
        </Says>
        {o.accountGone ? (
          <p data-out-gone className="mt-3 text-[14px] leading-snug text-muted-foreground">
            Their account was deleted, so the seat can&apos;t be theirs again.
          </p>
        ) : (
          <>
            <Btn
              data-out-back
              wide
              className="mt-3.5"
              disabled={busy}
              onClick={() => void send(o.person ? `/seats/${g.id}/${o.person.id}` : `/seats/${g.id}/player/${o.playerId}`, { putBack: true })}
            >
              Put {o.person ? name : "the seat"} back in {g.name}
            </Btn>
            <p className="mt-2 text-center text-[13px] leading-normal text-muted-foreground">
              {o.person
                ? `They sign in to it again as ${A_ROLE[o.role]}, with its team and points${o.onCouch || !g.couch ? "" : `, and rejoin ${g.couch.name}`}. They're told.`
                : "It waits for an account again."}
            </p>
          </>
        )}
        {o.person && (
          <div className="mt-3 border-b border-border">
            <DeskRow
              href={paths.deskItem("person", o.person.id)}
              data="out-person"
              lead={<Avatar id={o.person.id} name={name} size={40} colour={colourOf(o.person.id, o.person.colour)} />}
              title={name}
              line={`Their page · ${o.person.activeAt ? `active ${agoOf(o.person.activeAt)}` : "not active yet"}`}
            />
          </div>
        )}
        {o.stays && o.playerId && (
          <button type="button" data-out-erase onClick={() => setErasing(true)} className="nd-press mt-3 flex h-12 w-full items-center gap-2.5 border-t border-border pt-3 text-left text-[15px] font-semibold text-live">
            <Trash2 className="size-5" aria-hidden />
            Erase the seat
          </button>
        )}
      </div>
    </Sheet>
    {o.playerId && (
      <HoldSheet
        open={erasing}
        onOpenChange={(x) => !x && onClose()}
        title={`Erase ${name}'s seat?`}
        subtitle="This can't be undone"
        consequence={`${name}'s team, picks and scores leave ${g.name} as if they never played, and the standings count without them. A castaway only they had goes back undrafted.`}
        cta={`erase ${name}'s seat`}
        restore="Can't be undone"
        onConfirm={async () => {
          const out = await deskSend<{ text: string }>(`/seats/${g.id}/player/${o.playerId}`, { erase: true });
          onClose();
          await after();
          toast(out.text);
        }}
      />
    )}
    </>
  );
}

type SeatsOpen = { kind: "in"; seat: DeskSeat } | { kind: "empty"; e: SeatEmpty; first: "seat" | "link" } | { kind: "out"; o: SeatOut } | null;

/**
 * A game's Seats (the mock's dgSeatsHTML): "5 in · 1 empty · 1 out"; signed in (face, active, role, ⋯ for the seat's sheet),
 * empty (a dashed chair, who saved it or when it was unlinked, Link), computer players (they play on their own), and Out of it
 * (greyed: left, taken out or removed), then what a seat is.
 */
export function GameSeatsSection({ g, seats }: { g: SeatsGame; seats: GameSeats }) {
  const [open, setOpen] = useState<SeatsOpen>(null);
  const [handOn, setHandOn] = useState<DeskSeat | null>(null);
  const others = seats.in.length;
  const count = [`${seats.in.length} in`, seats.empty.length ? `${seats.empty.length} empty` : null, seats.out.length ? `${seats.out.length} out` : null, seats.computer.length ? `${seats.computer.length} computer` : null]
    .filter(Boolean)
    .join(" · ");
  const seatOf = (s: GameSeats["in"][number]): DeskSeat => ({
    leagueId: g.id,
    game: g.name,
    season: g.season,
    couch: g.couch,
    user: { id: s.person.id, name: s.person.name },
    role: s.role,
    alone: s.alone,
    others: others - 1,
    drafted: seats.drafted,
    otherGames: s.otherGames,
    noLink: seats.noLink,
    person: s.person,
  });
  const close = () => setOpen(null);
  return (
    <Section title="Seats" aside={count}>
      <div data-game-seats className="border-b border-border">
        {seats.in.map((s) => (
          <button
            key={s.person.id}
            type="button"
            data-seat={s.person.name}
            aria-label={`${s.person.name} in ${g.name}: ${ROLE_TITLE[s.role]}`}
            onClick={() => setOpen({ kind: "in", seat: seatOf(s) })}
            className="nd-press flex min-h-[62px] w-full items-center gap-3 border-t border-border py-2.5 text-left first:border-t-0"
          >
            <Avatar id={s.person.id} name={s.person.name} size={40} colour={colourOf(s.person.id, s.person.colour)} />
            <span className="min-w-0 flex-1">
              <b className="block text-[16px] font-semibold leading-snug [overflow-wrap:anywhere]">
                {s.person.name}
                <PersonTags p={s.person} />
              </b>
              <small className="mt-0.5 block text-[13px] leading-snug text-muted-foreground">
                {activeLine(s.person.activeAt)}
                {s.seatName ? ` · plays as ${s.seatName}` : ""}
              </small>
            </span>
            <span className={`whitespace-nowrap text-[14px] font-semibold ${s.role === "member" ? "text-muted-foreground" : ""}`}>{ROLE_TITLE[s.role]}</span>
            <Ellipsis className="size-[18px] flex-none text-muted-foreground" aria-hidden />
          </button>
        ))}
        {seats.empty.map((e) => {
          const why = emptyLine(e);
          return (
            <div key={e.playerId} data-seat-empty={e.name} className="flex min-h-[62px] items-center gap-2.5 border-t border-border first:border-t-0">
              <button type="button" onClick={() => setOpen({ kind: "empty", e, first: "seat" })} className="nd-press flex min-h-[62px] min-w-0 flex-1 items-center gap-3 py-2 text-left">
                <span className="grid size-10 flex-none place-items-center rounded-[3px] border-[1.5px] border-dashed border-input text-muted-foreground">
                  <User className="size-5" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <b className="block text-[16px] font-semibold leading-snug [overflow-wrap:anywhere]">{e.name}&apos;s seat</b>
                  <small className="mt-0.5 block text-[13px] leading-snug text-muted-foreground">{why ? `${why} · nobody signed in` : "Nobody signed in"}</small>
                </span>
              </button>
              {!seats.noLink && (
                <Btn data-seat-link={e.name} className="h-11 flex-none px-3.5 text-[15px]" onClick={() => setOpen({ kind: "empty", e, first: "link" })}>
                  Link
                </Btn>
              )}
            </div>
          );
        })}
        {seats.computer.map((c) => (
          <div key={c.playerId} data-seat-computer={c.name} className="flex min-h-[62px] items-center gap-3 border-t border-border py-2.5 first:border-t-0">
            <span className="grid size-10 flex-none place-items-center rounded-[3px] bg-card text-muted-foreground">
              <Bot className="size-5" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <b className="block text-[16px] font-semibold leading-snug [overflow-wrap:anywhere]">{c.name}</b>
              <small className="mt-0.5 block text-[13px] leading-snug text-muted-foreground">Computer player · {c.level} · plays on its own</small>
            </span>
          </div>
        ))}
        {!seats.in.length && !seats.empty.length && !seats.computer.length && <p className="py-3 text-[14px] text-muted-foreground">Nobody plays it yet.</p>}
      </div>
      {seats.out.length > 0 && (
        <>
          <div className="mb-1 mt-[18px] flex items-baseline justify-between gap-3">
            <h2 className="type-caption text-[17px] tracking-[0.04em] text-muted-foreground">Out of it</h2>
            {seats.out.some((o) => o.stays) && <span className="text-[13px] text-muted-foreground">Their teams stay in the standings</span>}
          </div>
          <div data-game-out className="border-y border-border">
            {seats.out.map((o) => {
              const name = o.person?.name ?? `${o.name}'s seat`;
              return (
                <button
                  key={`${o.person?.id ?? ""}:${o.playerId ?? o.name}`}
                  type="button"
                  data-seat-out={o.person?.name ?? o.name}
                  onClick={() => setOpen({ kind: "out", o })}
                  className="nd-press flex min-h-[62px] w-full items-center gap-3 border-t border-border py-2.5 text-left first:border-t-0"
                >
                  {o.person ? (
                    <span className="flex-none brightness-75 grayscale">
                      <Avatar id={o.person.id} name={o.person.name} size={40} colour={colourOf(o.person.id, o.person.colour)} />
                    </span>
                  ) : (
                    <span className="grid size-10 flex-none place-items-center rounded-[3px] border-[1.5px] border-dashed border-input text-muted-foreground">
                      <User className="size-5" aria-hidden />
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <b className="block text-[16px] font-semibold leading-snug text-muted-foreground [overflow-wrap:anywhere]">{name}</b>
                    <small className="mt-0.5 block text-[13px] leading-snug text-muted-foreground">{outLine(o)}</small>
                  </span>
                  <Ellipsis className="size-[18px] flex-none text-muted-foreground" aria-hidden />
                </button>
              );
            })}
          </div>
        </>
      )}
      <p className="mt-2.5 text-[14px] leading-snug text-muted-foreground">A seat is a place in the game, with its team, picks and scores. One account signs in to it.</p>
      <SeatSheet
        key={open?.kind === "in" ? `${open.seat.user.id}` : "none"}
        seat={open?.kind === "in" ? open.seat : null}
        open={open?.kind === "in"}
        onClose={close}
        onHandOn={(s) => {
          setOpen(null);
          setTimeout(() => setHandOn(s), 250);
        }}
      />
      {open?.kind === "empty" && <EmptySeatSheet key={open.e.playerId} g={g} e={open.e} drafted={seats.drafted} noLink={seats.noLink} first={open.first} onClose={close} />}
      {open?.kind === "out" && <OutSeatSheet key={`${open.o.person?.id ?? ""}:${open.o.playerId}`} g={g} o={open.o} onClose={close} />}
      <HandOnSheet
        open={!!handOn}
        onClose={() => setHandOn(null)}
        from={handOn ? { id: handOn.user.id, name: handOn.user.name } : null}
        games={handOn ? [{ leagueId: g.id, name: g.name, couch: g.couch?.name ?? null }] : []}
      />
    </Section>
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
