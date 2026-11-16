"use client";

import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeftRight,
  Bell,
  BellOff,
  CalendarClock,
  ClipboardList,
  Eye,
  Grid3x3,
  KeyRound,
  MessageCircle,
  Target,
  Timer,
  Trophy,
  UserPlus,
  Users,
  Vote,
} from "lucide-react";
import { notesApi, useAfterNotesRead, useHome, useNotes, type Note } from "../data";
import { useNav } from "../nav";
import { turnOn, useReach } from "../show/remind";
import { useNow } from "../ui/bars";
import { Btn } from "../ui/parts";
import { Sheet } from "../ui/sheet";

// The bell (the design round's step 8, docs/design-round/step8-notify-{spec,first-view,shape}.md): what's happened on your
// couches, the same notices the pushes are (push-core.js keeps one for everyone it's for, whatever their switches say). Newest
// first, in two bands (New, since you last looked; Earlier, the rest of the month), a notice that asks you to decide something
// first among the new. Each row: its kind's icon, the news, where it's from and what to do, when; it opens where it's about. A
// reminder whose moment has gone isn't listed (notify-prefs.ts reminderHolds). What's due now is the hub's plate, right behind
// the sheet, so it isn't said again here. While no phone of yours rings, the foot says so, with Turn on. The dot comes with the
// home read (never polled); opening the sheet reads them (the new ones stay in New while it's open). Chat has its own count.

/** Each push type's icon (push-core.js NOTIFICATION_TYPES and the new design's own). */
const ICONS: Record<string, typeof Bell> = {
  reminder: ClipboardList,
  draftTurn: Timer,
  waivers: ArrowLeftRight,
  waiverReminder: ArrowLeftRight,
  episodeResults: Eye,
  finalScores: Trophy,
  researchDone: Eye,
  flagSettled: Eye,
  newBet: Target,
  betResult: Target,
  poll: Vote,
  planned: CalendarClock,
  bingo: Grid3x3,
  chat: MessageCircle,
  invite: UserPlus,
  joinRequest: UserPlus,
  letIn: UserPlus,
  memberJoined: Users,
  couchJoined: Users,
  gameStarted: Users,
  resultsDue: KeyRound,
  wikiReview: KeyRound,
};

/** "now", "5m", "3h", "2d", then the date. */
function ago(iso: string, now: number) {
  const m = Math.max(0, Math.round((now - Date.parse(iso)) / 60_000));
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  if (m < 24 * 60) return `${Math.round(m / 60)}h`;
  if (m < 7 * 24 * 60) return `${Math.round(m / (24 * 60))}d`;
  return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric" });
}

function NoteRow({ note, now, fresh, onOpen }: { note: Note; now: number; fresh: boolean; onOpen: () => void }) {
  const Icon = ICONS[note.type] ?? (note.link.includes("plan") ? CalendarClock : Bell);
  return (
    <button
      type="button"
      data-note={note.id}
      data-unread={note.unread ? "1" : "0"}
      data-needs={note.needs ? "1" : undefined}
      onClick={onOpen}
      className="nd-press flex min-h-[60px] w-full items-start gap-3 border-t border-border py-2.5 text-left first:border-t-0"
    >
      <span className={`grid size-9 flex-none place-items-center rounded-[3px] ${fresh ? "bg-secondary text-foreground" : "bg-secondary/60 text-muted-foreground"}`}>
        <Icon className="size-[18px]" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <b className={`block text-[15px] font-semibold leading-snug ${fresh ? "" : "text-foreground/80"}`}>{note.title}</b>
        <small className="mt-0.5 block text-[13px] leading-snug text-muted-foreground">{note.body}</small>
      </span>
      <span className="flex-none pt-0.5 text-[12px] tabular-nums text-muted-foreground">{ago(note.at, now)}</span>
    </button>
  );
}

function Band({ label, notes, now, fresh, onGo }: { label: string; notes: Note[]; now: number; fresh: boolean; onGo: (href: string) => void }) {
  if (!notes.length) return null;
  return (
    <section data-notes-band={fresh ? "new" : "earlier"} className="[&+&]:mt-5">
      <h3 className="type-caption mb-0.5 text-[13px] tracking-[0.06em] text-muted-foreground">{label}</h3>
      {notes.map((n) => (
        <NoteRow key={n.id} note={n} now={now} fresh={fresh} onOpen={() => onGo(n.link)} />
      ))}
    </section>
  );
}

/** The foot, while nothing of yours rings: the bell is then the only place you hear anything. */
function PhoneFoot({ open }: { open: boolean }) {
  const { phone, reaches } = useReach(open);
  const qc = useQueryClient();
  if (!((reaches === false && (phone === "off" || phone === "install")) || phone === "blocked")) return null;
  return (
    <div data-notes-phone={phone} className="mt-5 flex items-center gap-3 border-t border-border pt-3">
      <BellOff className="size-[18px] flex-none text-muted-foreground" aria-hidden />
      <span className="min-w-0 flex-1 text-[13px] leading-snug text-muted-foreground">
        <b className="block text-[14px] font-semibold text-foreground">{phone === "blocked" ? "Blocked on this phone" : "Off on this phone"}</b>
        {phone === "install" ? "On iPhone, add Game Your Show to your Home Screen first." : phone === "blocked" ? "Allow notifications in your browser's settings." : "Everything still lands here."}
      </span>
      {phone === "off" && (
        <Btn data-notes-turn-on className="h-10 flex-none px-3.5 text-sm" onClick={() => turnOn(() => qc.invalidateQueries({ queryKey: ["new-design", "profile"] }))}>
          Turn on
        </Btn>
      )}
    </div>
  );
}

function NotesSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const notes = useNotes(open);
  const afterRead = useAfterNotesRead();
  const qc = useQueryClient();
  const nav = useNav();
  const now = useNow(false);
  const read = useRef(false);
  const data = notes.data;
  const list = data?.notes ?? [];
  // New: since you last looked, what asks you to decide first; Earlier: the rest, newest first.
  const fresh = list.filter((n) => n.unread).sort((a, b) => Number(b.needs) - Number(a.needs));
  const earlier = list.filter((n) => !n.unread);
  const go = (href: string) => {
    onOpenChange(false);
    setTimeout(() => nav.push(href), 220);
  };
  // Opening it reads them: once per open, after the list is here (its new rows stay in New while it's open). Closed, the list
  // goes, so the next open reads it fresh.
  useEffect(() => {
    if (!open) {
      read.current = false;
      qc.removeQueries({ queryKey: ["new-design", "notes"] });
      return;
    }
    if (!data || read.current) return;
    read.current = true;
    if (fresh.length) notesApi.read().then(afterRead, () => {});
  }, [open, data, fresh.length, afterRead, qc]);
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Notifications" subtitle={!data ? "…" : !fresh.length && list.length ? "Nothing new" : undefined}>
      <div data-notes-sheet>
        {data && !list.length && (
          <p className="py-8 text-center text-[14px] leading-snug text-muted-foreground" data-notes-empty>
            Nothing yet. Results, reminders and what the couch is up to land here.
          </p>
        )}
        <Band label="New" notes={fresh} now={now} fresh onGo={go} />
        <Band label="Earlier" notes={earlier} now={now} fresh={false} onGo={go} />
        {notes.isError && (
          <p className="py-6 text-center text-[14px] text-muted-foreground">
            Couldn&rsquo;t load them.{" "}
            <button type="button" className="font-bold text-foreground underline underline-offset-4" onClick={() => void notes.refetch()}>
              Try again
            </button>
          </p>
        )}
        <PhoneFoot open={open} />
      </div>
    </Sheet>
  );
}

/** The hub's bell: a dot while something's new (the home read's count), the list when tapped. */
export function NotesBell() {
  const { data: home } = useHome();
  const [open, setOpen] = useState(false);
  const unread = home?.notes?.unread ?? 0;
  return (
    <>
      <button
        type="button"
        data-bell
        data-unread={unread}
        aria-label={unread ? `Notifications: ${unread} new` : "Notifications"}
        onClick={() => setOpen(true)}
        className="relative grid size-11 place-items-center rounded-[3px] hover:bg-card"
      >
        <Bell className="size-5" aria-hidden />
        <i
          data-bell-dot
          aria-hidden
          className={`absolute right-[8px] top-[7px] size-[12px] rounded-full border-2 border-background bg-foreground transition-transform duration-300 motion-reduce:transition-none ${unread ? "scale-100" : "scale-0"}`}
        />
      </button>
      <NotesSheet open={open} onOpenChange={setOpen} />
    </>
  );
}
