"use client";

import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Bell, CalendarClock, ClipboardList, Eye, KeyRound, MessageCircle, Trophy, UserPlus, Users } from "lucide-react";
import type { MomentId } from "@/lib/moments";
import { notesApi, useAfterNotesRead, useHome, useNotes, type Note } from "../data";
import { useNav } from "../nav";
import { useNow } from "../ui/bars";
import { Sheet } from "../ui/sheet";

// The bell (docs/PLAN-new-design.md step 15 part 2; the mock's index.html notesSheet): what's happened on your couches since you
// last looked, the same moments the pushes are about, kept as a list whatever your pushes say (push-core.js keeps a notice for
// everyone it's for). Its dot comes with the home read (never polled); the list is read when it opens, and opening it reads them
// (the new ones keep their mark while it's open). Each row is worded as the spoiler guard lets it out now, and opens where it's
// about. Chat isn't here: the Chat tab has its own count.

const ICONS: Record<MomentId, typeof Bell> = {
  lineup: ClipboardList,
  early: Eye,
  final: Trophy,
  invites: UserPlus,
  couch: Users,
  backstage: KeyRound,
  chat: MessageCircle,
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

function NoteRow({ note, now, onOpen }: { note: Note; now: number; onOpen: () => void }) {
  const Icon = (note.moment && ICONS[note.moment]) || (note.link.includes("plan") ? CalendarClock : Bell);
  return (
    <button
      type="button"
      data-note={note.id}
      data-unread={note.unread ? "1" : "0"}
      onClick={onOpen}
      className="nd-press flex min-h-[64px] w-full items-center gap-3 border-t border-border py-2 text-left first:border-t-0"
    >
      <span className="grid size-10 flex-none place-items-center overflow-hidden rounded-[3px] bg-secondary">
        {note.art ? (
          // eslint-disable-next-line @next/next/no-img-element -- a show's art, already the size the rest of the hub uses
          <img src={note.art} alt="" className="size-full object-cover" draggable={false} />
        ) : (
          <Icon className="size-5" aria-hidden />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <b className="block text-[15px] font-semibold leading-snug">
          {note.title}
          {note.unread && <i className="ml-[7px] inline-block size-[7px] rounded-full bg-chyron-line align-[2px]" aria-label="New" />}
        </b>
        <small className="mt-0.5 block text-[13px] leading-snug text-muted-foreground">{note.body}</small>
      </span>
      <span className="flex-none self-start pt-1 text-[12px] text-muted-foreground">{ago(note.at, now)}</span>
    </button>
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
  const fresh = data?.notes.filter((n) => n.unread).length ?? 0;
  // Opening it reads them: once per open, after the list is here (its new rows keep their mark while it's open). Closed, the list
  // goes, so the next open reads it fresh.
  useEffect(() => {
    if (!open) {
      read.current = false;
      qc.removeQueries({ queryKey: ["new-design", "notes"] });
      return;
    }
    if (!data || read.current) return;
    read.current = true;
    if (fresh) notesApi.read().then(afterRead, () => {});
  }, [open, data, fresh, afterRead, qc]);
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Notifications" subtitle={!data ? "…" : fresh ? `${fresh} new` : "All caught up"}>
      <div data-notes-sheet>
        {data && !data.notes.length && (
          <p className="py-8 text-center text-[14px] leading-snug text-muted-foreground" data-notes-empty>
            Nothing yet. Results, reminders and what the couch is up to land here.
          </p>
        )}
        {data?.notes.map((n) => (
          <NoteRow
            key={n.id}
            note={n}
            now={now}
            onOpen={() => {
              onOpenChange(false);
              setTimeout(() => nav.push(n.link), 220);
            }}
          />
        ))}
        {notes.isError && <p className="py-6 text-center text-[14px] text-muted-foreground">Couldn&rsquo;t load them. Try again.</p>}
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
          className={`absolute right-[10px] top-[9px] size-[9px] rounded-full border-2 border-background bg-live transition-transform duration-300 motion-reduce:transition-none ${unread ? "scale-100" : "scale-0"}`}
        />
      </button>
      <NotesSheet open={open} onOpenChange={setOpen} />
    </>
  );
}
