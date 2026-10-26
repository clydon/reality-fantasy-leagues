"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Check, ChevronRight, Copy, Crown, KeyRound, LogOut, PenLine, Plus, RefreshCw, Share2, Users } from "lucide-react";
import { couches, setCouch, useAfterCouch, useCurrentCouch, useHome, useInviteCode, type Couch, type LeaveCouch } from "../data";
import { useMe } from "../session";
import { useNav } from "../nav";
import { paths } from "../routes";
import { Avatar } from "../ui/bars";
import { HoldSheet } from "../ui/guards";
import { Btn, Row } from "../ui/parts";
import { Sheet } from "../ui/sheet";
import { toast } from "../ui/toast";

// Couches (docs/PLAN-new-design.md step 9; the mock's round2.js couchSwitch and newCouchSheet, index.html couchSheet and
// joinSheet): the switcher (the hub shows one couch at a time; your profile's couch line opens it), a couch's details
// (who's on it, your invite code, seasons together, leaving it), starting one, joining one with a code, and inviting
// people (Get the couch going, a show's ⋯ menu, Backstage's Members). Any screen opens them with openCouchSheet; the
// signed-in layout mounts the one host (CouchSheets). Step 15 part 1: whoever runs a couch (its owner) renames it and hands
// it on, and anyone on it gets a new code (their old one stops working).

export type CouchSheet =
  | { kind: "switch" }
  | { kind: "details"; couchId: string }
  | { kind: "invite"; couchId: string; show?: string }
  | { kind: "new" }
  | { kind: "join" }
  | { kind: "leave"; couchId: string }
  | { kind: "rename"; couchId: string }
  | { kind: "handOn"; couchId: string };

// The open sheet, and how many times each kind has opened: a sheet is keyed by its count, so each opening starts fresh
// (and a closing one keeps its key until it's gone).
type Store = { sheet: CouchSheet | null; opened: Partial<Record<CouchSheet["kind"], number>> };
let store: Store = { sheet: null, opened: {} };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const SERVER: Store = { sheet: null, opened: {} };

/** Open one of the couch sheets (closing whichever is open). */
export function openCouchSheet(sheet: CouchSheet) {
  store = { ...store, sheet: null };
  emit();
  // One frame later, so a sheet closing and the next opening are two moves, not one swap.
  setTimeout(() => {
    store = { sheet, opened: { ...store.opened, [sheet.kind]: (store.opened[sheet.kind] ?? 0) + 1 } };
    emit();
  }, 30);
}

export function closeCouchSheet() {
  store = { ...store, sheet: null };
  emit();
}

function useCouchSheet(): Store {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => store,
    () => SERVER
  );
}

/** A couch's line: what it's playing now (else lately), and how many are on it. "Survivor 51 · Traitors 5 · 4 people". */
export function couchLine(c: Couch): string {
  const now = c.seasons.filter((s) => s.status !== "completed");
  const shows = (now.length ? now : c.seasons.slice(0, 1)).slice(0, 2).map((s) => s.label);
  const people = `${c.members.length} ${c.members.length === 1 ? "person" : "people"}`;
  return [...shows, people].join(" · ");
}

/** Up to three faces, overlapping. */
export function FaceStack({ people, size = 26 }: { people: { userId: string; name: string }[]; size?: number }) {
  return (
    <span className="flex flex-none">
      {people.slice(0, 3).map((m, i) => (
        <span key={m.userId} className={`rounded-[3px] shadow-[0_0_0_2px_var(--card)] ${i ? "-ml-1.5" : ""}`}>
          <Avatar id={m.userId} name={m.name} size={size} />
        </span>
      ))}
    </span>
  );
}

/** The one host for the couch sheets (mounted once, by the signed-in layout). */
export function CouchSheets() {
  const { sheet, opened } = useCouchSheet();
  const close = (o: boolean) => !o && closeCouchSheet();
  return (
    <>
      <SwitchSheet open={sheet?.kind === "switch"} onOpenChange={close} />
      <DetailsSheet couchId={sheet?.kind === "details" ? sheet.couchId : null} onOpenChange={close} />
      <InviteSheet couchId={sheet?.kind === "invite" ? sheet.couchId : null} show={sheet?.kind === "invite" ? sheet.show : undefined} onOpenChange={close} />
      <NewCouchSheet key={`new-${opened.new ?? 0}`} open={sheet?.kind === "new"} onOpenChange={close} />
      <JoinCouchSheet key={`join-${opened.join ?? 0}`} open={sheet?.kind === "join"} onOpenChange={close} />
      <LeaveCouchSheet key={`leave-${opened.leave ?? 0}`} couchId={sheet?.kind === "leave" ? sheet.couchId : null} onOpenChange={close} />
      <RenameCouchSheet key={`rename-${opened.rename ?? 0}`} couchId={sheet?.kind === "rename" ? sheet.couchId : null} onOpenChange={close} />
      <HandOnSheet key={`handOn-${opened.handOn ?? 0}`} couchId={sheet?.kind === "handOn" ? sheet.couchId : null} onOpenChange={close} />
    </>
  );
}

// ---------- the switcher ----------

function SwitchSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { data: home } = useHome();
  const couch = useCurrentCouch(home);
  const nav = useNav();
  const list = home?.couches ?? [];
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Your couches" subtitle="The hub shows one couch at a time">
      <div className="flex flex-col" data-couch-switcher>
        {list.map((c) => {
          const on = c.id === couch?.id;
          return (
            <button
              key={c.id}
              type="button"
              data-couch={c.name}
              aria-current={on || undefined}
              onClick={() => {
                closeCouchSheet();
                if (on) return;
                setCouch(c.id);
                toast(`Switched to ${c.name}`);
                nav.push(paths.home);
              }}
              className={`nd-press flex min-h-[64px] items-center gap-3 rounded-[3px] px-2.5 text-left ${on ? "bg-secondary" : ""}`}
            >
              <FaceStack people={c.members} />
              <span className="min-w-0 flex-1">
                <b className="block truncate text-[16px] font-semibold">{c.name}</b>
                <small className="block truncate text-[13px] text-muted-foreground">{couchLine(c)}</small>
              </span>
              {on ? <Check className="size-5 flex-none" aria-label="On it now" /> : <ChevronRight className="size-5 flex-none text-muted-foreground" aria-hidden />}
            </button>
          );
        })}
      </div>
      <div className="mt-2 flex flex-col">
        {couch && <Row icon={Users} title={`${couch.name} details`} detail="Who's on it, your invite code, seasons together" onClick={() => openCouchSheet({ kind: "details", couchId: couch.id })} />}
        <Row icon={KeyRound} title="Join a couch" detail="Got a code from a friend? Pull up a seat" onClick={() => openCouchSheet({ kind: "join" })} />
      </div>
      <Btn wide className="mt-3" data-new-couch onClick={() => openCouchSheet({ kind: "new" })}>
        <Plus className="size-5" aria-hidden />
        Start a new couch
      </Btn>
    </Sheet>
  );
}

// ---------- your invite code ----------

const linkOf = (code: string) => (typeof window === "undefined" ? `/join/${code}` : `${window.location.origin}/join/${code}`);

/** The code on a bone plate, with Copy; and Send the link (the phone's share sheet, else the link copied). */
export function InviteCode({ code, couchName }: { code: string | null; couchName: string }) {
  const copy = async (text: string, said: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast(said);
    } catch {
      toast.quiet(`Couldn't copy. The code is ${code}`);
    }
  };
  return (
    <>
      <div data-invite-code={code ?? ""} className="flex h-[72px] items-center justify-between rounded-[3px] bg-plate pl-4 pr-3 text-plate-foreground">
        {code ? <b className="type-num text-[40px] tracking-[0.14em]">{code}</b> : <span aria-busy className="h-9 w-40 animate-pulse rounded-[3px] bg-plate-muted/30" />}
        <button
          type="button"
          aria-label="Copy the code"
          disabled={!code}
          onClick={() => code && copy(code, "Invite code copied")}
          className="grid size-12 place-items-center rounded-[3px] bg-plate-foreground text-plate"
        >
          <Copy className="size-5" aria-hidden />
        </button>
      </div>
      <Btn
        wide
        className="mt-2.5"
        data-share-invite
        disabled={!code}
        onClick={async () => {
          if (!code) return;
          const url = linkOf(code);
          const text = `Pull up a seat on ${couchName}: ${url}`;
          if (typeof navigator.share === "function") {
            try {
              await navigator.share({ title: couchName, text, url });
              return;
            } catch (e) {
              if ((e as Error).name === "AbortError") return;
            }
          }
          await copy(url, "Invite link copied");
        }}
      >
        <Share2 className="size-5" aria-hidden />
        Send the link
      </Btn>
    </>
  );
}

function InviteSheet({ couchId, show, onOpenChange }: { couchId: string | null; show?: string; onOpenChange: (o: boolean) => void }) {
  const { data: home } = useHome();
  const couch = home?.couches.find((c) => c.id === couchId) ?? null;
  const code = useInviteCode(couchId, !!couchId).data?.code ?? null;
  return (
    <Sheet
      open={!!couchId}
      onOpenChange={onOpenChange}
      title={show ? `Invite to ${show}` : `Invite to ${couch?.name ?? "the couch"}`}
      subtitle={show ? `They join ${couch?.name ?? "the couch"} too` : "Anyone with the code joins the couch"}
    >
      <InviteCode code={code} couchName={couch?.name ?? "the couch"} />
      <p className="mt-3 text-[13px] leading-snug text-muted-foreground">
        {couch ? `${couch.members.length} on the couch so far. ` : ""}Each game decides who can play: open to everyone on the couch, or ask first.
      </p>
    </Sheet>
  );
}

// ---------- a couch's details ----------

function DetailsSheet({ couchId, onOpenChange }: { couchId: string | null; onOpenChange: (o: boolean) => void }) {
  const { data: home } = useHome();
  const couch = home?.couches.find((c) => c.id === couchId) ?? null;
  const code = useInviteCode(couchId, !!couchId).data?.code ?? null;
  const oldest = couch?.seasons.at(-1)?.label;
  const qc = useQueryClient();
  const [renewing, setRenewing] = useState<"ask" | "busy" | null>(null);
  const renew = async () => {
    if (!couch) return;
    setRenewing("busy");
    try {
      const made = await couches.newCode(couch.id);
      qc.setQueryData(["new-design", "couch", couch.id, "invite"], made);
      toast(`New code: ${made.code}. Your old one stopped working`);
    } catch (e) {
      toast.quiet((e as Error).message);
    } finally {
      setRenewing(null);
    }
  };
  return (
    <Sheet
      open={!!couchId && !!couch}
      onOpenChange={onOpenChange}
      title={couch?.name ?? "Couch"}
      subtitle={couch ? `${couch.members.length} on the couch${oldest ? ` · since ${oldest}` : ""}` : undefined}
    >
      {couch && (
        <div data-couch-details={couch.name}>
          <div className="grid grid-cols-4 gap-x-2 gap-y-3">
            {couch.members.map((m) => (
              <div key={m.userId} className="flex min-w-0 flex-col items-center gap-1 text-center" data-member={m.name}>
                <Avatar id={m.userId} name={m.name} size={52} />
                <span className="w-full truncate text-[13px]">{m.name}</span>
                {m.role === "owner" && <small className="-mt-1 text-[11px] text-muted-foreground">Runs it</small>}
              </div>
            ))}
            <button type="button" data-invite-tile onClick={() => openCouchSheet({ kind: "invite", couchId: couch.id })} className="flex flex-col items-center gap-1 text-center">
              <span className="grid size-[52px] place-items-center rounded-[3px] outline-[1.5px] -outline-offset-[1.5px] outline-dashed outline-input">
                <Plus className="size-5" aria-hidden />
              </span>
              <span className="text-[13px]">Invite</span>
            </button>
          </div>
          <p className="type-caption mb-2 mt-5 text-xs tracking-[0.06em] text-muted-foreground">Your invite code</p>
          <InviteCode code={code} couchName={couch.name} />
          {renewing === "ask" ? (
            <div data-new-code="ask" className="mt-2 rounded-[3px] bg-background p-3 text-[13px] leading-snug">
              {code} stops working, and anyone you sent it to needs the new one. Everyone already on the couch stays.
              <div className="mt-2.5 flex gap-2">
                <Btn className="h-11 flex-1" onClick={() => setRenewing(null)}>
                  Keep it
                </Btn>
                <Btn tone="ink" className="h-11 flex-1" data-new-code-make onClick={renew}>
                  Make a new code
                </Btn>
              </div>
            </div>
          ) : (
            <button
              type="button"
              data-new-code
              disabled={!code || renewing === "busy"}
              onClick={() => setRenewing("ask")}
              className="mt-1.5 flex h-11 items-center gap-2 text-[14px] font-semibold text-muted-foreground disabled:opacity-50"
            >
              <RefreshCw className="size-4" aria-hidden />
              {renewing === "busy" ? "Making one…" : "Get a new code"}
            </button>
          )}
          {couch.seasons.length > 0 && (
            <>
              <p className="type-caption mb-2 mt-5 text-xs tracking-[0.06em] text-muted-foreground">Seasons together</p>
              <ol className="relative ml-2 border-l-2 border-border pl-5">
                {couch.seasons.map((s) => {
                  const games = couch.games.filter((g) => g.seasonId === s.seasonId);
                  const now = s.status !== "completed";
                  return (
                    <li key={s.seasonId} className="relative pb-3.5 last:pb-1">
                      <i className={`absolute -left-[29px] top-1 size-4 rounded-full border-2 ${now ? "border-foreground bg-foreground" : "border-input bg-card"}`} aria-hidden />
                      <b className="type-caption block text-[19px]">{s.label}</b>
                      <small className="block text-[13px] text-muted-foreground">
                        {now ? (s.status === "upcoming" ? "Coming up" : "Now") : "Finished"} · {games.map((g) => g.gameName).filter((n, i, a) => a.indexOf(n) === i).join(", ")}
                      </small>
                    </li>
                  );
                })}
              </ol>
            </>
          )}
          <div className="mt-4 flex flex-col">
            {couch.yourRole === "owner" && (
              <>
                <Row icon={PenLine} title="Rename the couch" detail={`It's ${couch.name} for everyone on it`} onClick={() => openCouchSheet({ kind: "rename", couchId: couch.id })} />
                {couch.members.length > 1 && (
                  <Row icon={Crown} title="Hand it on" detail="Someone else runs the couch: its name, and handing it on" onClick={() => openCouchSheet({ kind: "handOn", couchId: couch.id })} />
                )}
              </>
            )}
            <Row icon={LogOut} title="Leave this couch" detail="Its games too. Come back any time with a code." onClick={() => openCouchSheet({ kind: "leave", couchId: couch.id })} />
          </div>
        </div>
      )}
    </Sheet>
  );
}

// ---------- start one ----------

/** Start a couch: its name, then its code to send (also first run's last step). */
export function NewCouchSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [made, setMade] = useState<{ id: string; name: string; code: string } | null>(null);
  const after = useAfterCouch();
  const nav = useNav();
  const done = () => {
    closeCouchSheet();
    nav.push(paths.home);
  };
  return (
    <Sheet
      open={open}
      onOpenChange={(o) => (!o && made ? done() : onOpenChange(o))}
      title={made ? `${made.name} is ready` : "Start a couch"}
      subtitle={made ? "Send the code to your people" : "Your group, for every show you play together"}
    >
      {made ? (
        <div data-couch-made={made.name}>
          <InviteCode code={made.code} couchName={made.name} />
          <p className="mt-3 text-[13px] leading-snug text-muted-foreground">Anyone with the code joins the couch. Each game decides who can play: open to everyone, or ask first.</p>
          <Btn tone="ink" wide className="mt-4" onClick={done}>
            Go to {made.name}
          </Btn>
        </div>
      ) : (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (busy || !name.trim()) return;
            setBusy(true);
            try {
              const c = await couches.start(name);
              setCouch(c.id);
              await after();
              setMade(c);
            } catch (err) {
              toast.quiet((err as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <label className="block">
            <span className="mb-1.5 block text-[14px] font-semibold">Name it</span>
            <input
              data-couch-name
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={40}
              placeholder="Couch Council"
              autoComplete="off"
              className="h-[52px] w-full rounded-[3px] bg-background px-3.5 text-[16px] outline-1 -outline-offset-1 outline-input focus:outline-2 focus:outline-foreground"
            />
          </label>
          <p className="mt-3 text-[13px] leading-snug text-muted-foreground">You get a code to send. Anyone with it joins the couch; each game decides who can play.</p>
          <Btn type="submit" tone="must" wide className="mt-4" disabled={busy || !name.trim()}>
            {busy ? "Starting…" : "Start the couch"}
          </Btn>
        </form>
      )}
    </Sheet>
  );
}

// ---------- join one with a code ----------

const CODE_LEN = 6;

/** Join a couch with a code, then its invite page (also first run's last step, where a code can let a waiting account in). */
export function JoinCouchSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [chars, setChars] = useState<string[]>(Array(CODE_LEN).fill(""));
  const [state, setState] = useState<{ ok?: boolean; line: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const after = useAfterCouch();
  const nav = useNav();
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => inputs.current[0]?.focus(), 350);
    return () => clearTimeout(t);
  }, [open]);
  const code = chars.join("");
  const fill = (from: number, text: string) => {
    const clean = text.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (!clean) return;
    const next = [...chars];
    for (let i = 0; i < clean.length && from + i < CODE_LEN; i++) next[from + i] = clean[i];
    setChars(next);
    setState(null);
    inputs.current[Math.min(from + clean.length, CODE_LEN - 1)]?.focus();
  };
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Join a couch" subtitle="Got a code from a friend? Type it in">
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (busy || code.length < CODE_LEN) return;
          setBusy(true);
          try {
            const r = await couches.join(code);
            setState({ ok: true, line: r.already ? `You're already on ${r.name}.` : `That's ${r.name}. Pulling up a seat.` });
            setCouch(r.couchId);
            await after();
            setTimeout(() => {
              closeCouchSheet();
              toast(r.already ? `You're on ${r.name}` : `You joined ${r.name}`);
              nav.push(paths.join(code));
            }, 700);
          } catch (err) {
            setState({ ok: false, line: (err as Error).message });
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="flex justify-between gap-2" data-code-boxes>
          {chars.map((c, i) => (
            <input
              key={i}
              ref={(el) => {
                inputs.current[i] = el;
              }}
              value={c}
              aria-label={`Character ${i + 1}`}
              inputMode="text"
              autoCapitalize="characters"
              autoComplete="off"
              maxLength={CODE_LEN}
              onChange={(e) => {
                const v = e.target.value;
                if (!v) {
                  const next = [...chars];
                  next[i] = "";
                  setChars(next);
                  return;
                }
                fill(i, v.slice(-1) === c ? v.slice(0, 1) : v);
              }}
              onKeyDown={(e) => {
                if (e.key === "Backspace" && !chars[i] && i) inputs.current[i - 1]?.focus();
              }}
              onPaste={(e) => {
                e.preventDefault();
                fill(i, e.clipboardData.getData("text"));
              }}
              className={`type-num h-[60px] w-full min-w-0 rounded-[3px] bg-background text-center text-[28px] uppercase outline-1 -outline-offset-1 focus:outline-2 focus:outline-foreground ${
                state?.ok === false ? "outline-live" : state?.ok ? "outline-good" : "outline-input"
              }`}
            />
          ))}
        </div>
        <p role="status" className={`mt-3 min-h-5 text-center text-[14px] ${state?.ok === false ? "text-live" : "text-muted-foreground"}`}>
          {state?.line ?? ""}
        </p>
        <Btn type="submit" tone="must" wide className="mt-2" disabled={busy || code.length < CODE_LEN}>
          {busy ? "Joining…" : "Join"}
        </Btn>
      </form>
    </Sheet>
  );
}

// ---------- leave one ----------

function LeaveCouchSheet({ couchId, onOpenChange }: { couchId: string | null; onOpenChange: (o: boolean) => void }) {
  const [what, setWhat] = useState<LeaveCouch | null>(null);
  const { data: home } = useHome();
  const after = useAfterCouch();
  const nav = useNav();
  useEffect(() => {
    if (!couchId) return;
    couches
      .leave(couchId, true)
      .then(setWhat)
      .catch((e) => {
        closeCouchSheet();
        toast.quiet((e as Error).message);
      });
  }, [couchId]);
  const sentence = what
    ? [
        `You leave ${what.name}${what.games.length ? ` and its games (${what.games.join(", ")})` : ""}.`,
        what.games.length ? (what.drafted ? "Your teams and points stay in the standings, but nobody plays them." : "Nothing's been drafted, so your seats just go.") : "",
        what.owner ? "Someone else on it takes it over." : "",
        "You can come back any time with a code.",
      ]
        .filter(Boolean)
        .join(" ")
    : null;
  return (
    <HoldSheet
      open={!!couchId}
      onOpenChange={onOpenChange}
      title="Leave this couch?"
      consequence={sentence}
      problem={what?.problem}
      cta="leave the couch"
      onConfirm={async () => {
        if (!couchId) return;
        const out = await couches.leave(couchId);
        const other = home?.couches.find((c) => c.id !== couchId);
        if (other) setCouch(other.id);
        await after();
        toast(`You left ${out.name}`);
        nav.push(paths.home);
      }}
    />
  );
}

// ---- run the couch (step 15 part 1): its name, and handing it on ----

/** Rename a couch (whoever runs it): everyone on it sees the new name. Undo puts the old one back. */
function RenameCouchSheet({ couchId, onOpenChange }: { couchId: string | null; onOpenChange: (o: boolean) => void }) {
  const { data: home } = useHome();
  const couch = home?.couches.find((c) => c.id === couchId) ?? null;
  const after = useAfterCouch();
  const [name, setName] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const value = name ?? couch?.name ?? "";
  const save = async () => {
    if (!couch) return;
    const was = couch.name;
    setBusy(true);
    setError(null);
    try {
      const r = await couches.rename(couch.id, value);
      await after();
      closeCouchSheet();
      toast(`Renamed: ${r.name}`, {
        undo: async () => {
          await couches.rename(couch.id, was);
          await after();
        },
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet open={!!couchId && !!couch} onOpenChange={onOpenChange} title="Rename the couch" subtitle={couch ? `Everyone on ${couch.name} sees it` : undefined}>
      <form
        data-rename-couch
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <label className="flex flex-col gap-1.5">
          <span className="text-[14px] font-semibold">Its name</span>
          <input
            data-couch-rename
            value={value}
            onChange={(e) => setName(e.target.value)}
            maxLength={40}
            className="h-[52px] w-full rounded-[3px] bg-background px-3.5 text-[16px] outline-1 -outline-offset-1 outline-input focus:outline-2 focus:outline-chyron-line"
          />
        </label>
        {error && (
          <p role="alert" className="text-[13px] font-semibold text-destructive">
            {error}
          </p>
        )}
        <Btn type="submit" tone="ink" wide disabled={busy || !value.trim() || value.trim() === couch?.name}>
          {busy ? "Saving…" : "Save the name"}
        </Btn>
      </form>
    </Sheet>
  );
}

/** Hand a couch on (whoever runs it): pick who runs it next. They can rename it and hand it on; you stay on it. */
function HandOnSheet({ couchId, onOpenChange }: { couchId: string | null; onOpenChange: (o: boolean) => void }) {
  const me = useMe();
  const { data: home } = useHome();
  const couch = home?.couches.find((c) => c.id === couchId) ?? null;
  const after = useAfterCouch();
  const [to, setTo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const others = couch?.members.filter((m) => m.userId !== me.id) ?? [];
  const pick = others.find((m) => m.userId === to) ?? null;
  const hand = async () => {
    if (!couch || !pick) return;
    setBusy(true);
    try {
      await couches.handOn(couch.id, pick.userId);
      await after();
      closeCouchSheet();
      toast(`${pick.name} runs ${couch.name} now`);
    } catch (e) {
      toast.quiet((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet open={!!couchId && !!couch} onOpenChange={onOpenChange} title="Hand it on" subtitle="Who runs the couch next">
      <div data-hand-on className="flex flex-col">
        <div role="radiogroup" aria-label="Who runs it next">
          {others.map((m) => (
            <button
              key={m.userId}
              type="button"
              role="radio"
              aria-checked={to === m.userId}
              data-hand-to={m.name}
              onClick={() => setTo(m.userId)}
              className="nd-press flex min-h-[60px] w-full items-center gap-3 border-t border-border py-2 text-left first:border-t-0"
            >
              <Avatar id={m.userId} name={m.name} size={36} />
              <b className="min-w-0 flex-1 truncate text-[15px] font-semibold">{m.name}</b>
              <i className={`grid size-5 flex-none place-items-center rounded-full border-2 ${to === m.userId ? "border-foreground" : "border-input"}`} aria-hidden>
                {to === m.userId && <i className="size-2.5 rounded-full bg-foreground" />}
              </i>
            </button>
          ))}
        </div>
        <p className="mt-3 text-[13px] leading-snug text-muted-foreground">
          They can rename the couch and hand it on again. You stay on it, and nothing changes in its games: whoever runs each game still does.
        </p>
        <Btn tone="ink" wide className="mt-3" data-hand-on-go disabled={!pick || busy} onClick={hand}>
          {busy ? "Handing it on…" : pick ? `Hand it to ${pick.name}` : "Pick someone"}
        </Btn>
      </div>
    </Sheet>
  );
}
