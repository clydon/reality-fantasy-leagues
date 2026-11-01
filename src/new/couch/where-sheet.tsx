"use client";

import { ChevronRight } from "lucide-react";
import { showWords } from "@/lib/game/show-words";
import { useOnNow, useSpace } from "../data";
import { useMe } from "../session";
import { Avatar } from "../ui/bars";
import { Sheet } from "../ui/sheet";
import { namesLine, marksOf, seasonLabel, whereGroups, type Mark } from "./where";
import { openCouchSheet } from "./couch-sheets";

// Where everyone is on a show (the user's pick B of the 2026-11-01 mocks): Tonight's header line of numbered faces opens it
// (screens/show-space.tsx CouchLine). One group per episode someone's up to, furthest first ("Caught up · Episode 7", "Up to
// Episode 6", ... "Not started"), then who plays here without sharing where they are. Each row says what's worth saying (watching
// along now, the games they play here) and opens that person's own sheet (person-sheet.tsx), with a way back here. From the
// space read, as the guard lets it out (guard.ts visibleFollows): nothing about anyone past what they share.

export function WhereSheet({ couchId, seasonId, onOpenChange }: { couchId: string | null; seasonId: string | null; onOpenChange: (o: boolean) => void }) {
  const me = useMe();
  const open = !!couchId && !!seasonId;
  const { data: s } = useSpace(seasonId ?? "", couchId, open);
  const { data: on } = useOnNow(open ? couchId : null);
  const aired = s?.schedule?.latestAired ?? 0;
  const word = showWords(s?.show.terms).episode;
  const yours = s && (s.you.following || s.you.plays) && s.you.seenThrough != null ? s.you.seenThrough : null;
  const { known, quiet } = marksOf(s?.people ?? null, { id: me.id, name: me.name, seen: yours });
  const groups = whereGroups(known, aired, word);
  const games = (userId: string) => {
    const ids = s?.people?.find((p) => p.userId === userId)?.playing ?? [];
    return [...new Set(ids.map((id) => s?.games.find((g) => g.leagueId === id)?.gameName).filter((n): n is string => !!n))];
  };
  const lineOf = (m: Mark): { text: string; now: boolean } => {
    const w = m.you ? undefined : on?.now.find((x) => x.userId === m.userId && x.seasonId === seasonId);
    if (w) return { text: `Watching ${word} ${w.episode} now`, now: true };
    const plays = games(m.userId);
    return { text: plays.length ? `Plays ${namesLine(plays, 4)}` : "Watches it", now: false };
  };
  const row = (m: Mark, quietOne = false) => {
    const line = quietOne ? { text: "Doesn't share where they are", now: false } : lineOf(m);
    return (
      <button
        key={m.userId}
        type="button"
        data-where-person={m.name}
        onClick={() => couchId && seasonId && openCouchSheet({ kind: "person", couchId, userId: m.userId, back: { kind: "where", couchId, seasonId } })}
        className="nd-press flex min-h-[58px] w-full items-center gap-3 border-t border-border py-2 text-left"
      >
        <span className={quietOne ? "opacity-50 grayscale" : ""}>
          <Avatar id={m.userId} name={m.name} size={34} />
        </span>
        <span className="min-w-0 flex-1">
          <b className="flex items-center gap-1.5 text-[15px] font-semibold">
            <span className="truncate">{m.name}</span>
            {m.you && <span className="type-caption rounded-[2px] bg-foreground px-1.5 py-px text-[10px] tracking-[0.05em] text-background">You</span>}
          </b>
          <small className={`block text-[13px] ${line.now ? "font-semibold text-good" : "text-muted-foreground"}`}>{line.text}</small>
        </span>
        <ChevronRight className="size-5 flex-none text-muted-foreground" aria-hidden />
      </button>
    );
  };
  return (
    <Sheet
      open={open && !!s}
      onOpenChange={onOpenChange}
      title="Where everyone is"
      subtitle={s ? `${seasonLabel(s)}${aired > 0 ? ` · ${word} ${aired} is the latest` : ""}` : undefined}
    >
      <div data-where-sheet>
        {groups.map((g) => (
          <section key={g.seen} data-where-group={g.seen} className="mt-3 first:mt-0">
            <h3 className="type-caption flex items-center justify-between pb-2 text-[14px] tracking-[0.04em] text-muted-foreground">
              <span>{g.title}</span>
              <span>{g.people.length}</span>
            </h3>
            {g.people.map((m) => row(m))}
          </section>
        ))}
        {quiet.length > 0 && (
          <section data-where-group="quiet" className="mt-3">
            <h3 className="type-caption flex items-center justify-between pb-2 text-[14px] tracking-[0.04em] text-muted-foreground">
              <span>Not sharing</span>
              <span>{quiet.length}</span>
            </h3>
            {quiet.map((m) => row(m, true))}
          </section>
        )}
        <p className="mt-4 text-[13px] leading-snug text-muted-foreground">Tap anyone for everything they watch.</p>
      </div>
    </Sheet>
  );
}
