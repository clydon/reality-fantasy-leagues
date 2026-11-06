"use client";

import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { ownPace } from "@/lib/game/streaming";
import { showWords } from "@/lib/game/show-words";
import { useOnNow, useSpace } from "../data";
import { useMe } from "../session";
import { Avatar } from "../ui/bars";
import { Sheet } from "../ui/sheet";
import { knownMark, marksOf, namesLine, seasonLabel, whereGroups, type Mark, type Pace } from "./where";
import { openCouchSheet } from "./couch-sheets";

// Where everyone is on a show (the user's pick B of the 2026-11-01 mocks): Tonight's header line of numbered faces opens it
// (screens/show-space.tsx CouchLine). One group per place, furthest first, in the couch's own words ("Caught up · Episode 7",
// "Up to Episode 6 of 7", ... "Not started"; at your own pace "Finished"), then whoever plays here without their place shown.
// Each row says what's worth saying (watching along now, the games they play here) and opens that person's own sheet
// (person-sheet.tsx), with a way back here. From the space read, as the guard lets it out (guard.ts visibleFollows).

function GroupHead({ title, count }: { title: ReactNode; count: number }) {
  return (
    <h3 className="type-caption flex items-center justify-between pb-2 text-[14px] tracking-[0.04em] text-muted-foreground">
      <span>{title}</span>
      <span>{count}</span>
    </h3>
  );
}

export function WhereSheet({ couchId, seasonId, onOpenChange }: { couchId: string | null; seasonId: string | null; onOpenChange: (o: boolean) => void }) {
  const me = useMe();
  const open = !!couchId && !!seasonId;
  const { data: s, isError } = useSpace(seasonId ?? "", couchId, open);
  const { data: on } = useOnNow(open ? couchId : null);
  const word = showWords(s?.show.terms).episode;
  const pace: Pace = {
    aired: s?.schedule?.latestAired ?? 0,
    total: s?.episodeCount ?? 0,
    ownPace: !!s && ownPace({ release: s.release, status: s.status, played: s.games.length > 0 }),
    word,
  };
  const { known, quiet } = marksOf(s?.people ?? null, { id: me.id, name: me.name, seen: s ? knownMark(s.you) : null });
  const groups = whereGroups(known, pace);
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
  const row = (m: Mark, unshown = false) => {
    const line = unshown ? { text: "Plays here; their place isn't shown", now: false } : lineOf(m);
    return (
      <button
        key={m.userId}
        type="button"
        data-where-person={m.name}
        onClick={() => couchId && seasonId && openCouchSheet({ kind: "person", couchId, userId: m.userId, back: { kind: "where", couchId, seasonId } })}
        className="nd-press flex min-h-[58px] w-full items-center gap-3 border-t border-border py-2 text-left"
      >
        <span className={unshown ? "opacity-50 grayscale" : ""}>
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
      open={open}
      onOpenChange={onOpenChange}
      title="Where everyone is"
      subtitle={s ? `${seasonLabel(s)}${pace.aired > 0 ? ` · ${word} ${pace.aired} is the latest` : ""}` : undefined}
    >
      {!s ? (
        // Tapped while the show's read is still on its way (or it failed): say so, never an empty sheet.
        isError ? (
          <p data-where-sheet="error" className="py-4 text-[14px] text-muted-foreground">
            Couldn&rsquo;t load where everyone is. Close this and try again in a moment.
          </p>
        ) : (
          <div data-where-sheet="loading" aria-busy className="h-48 animate-pulse rounded-[4px] bg-secondary" />
        )
      ) : (
        <div data-where-sheet>
          {groups.map((g) => (
            <section key={g.seen} data-where-group={g.seen} className="mt-3 first:mt-0">
              <GroupHead title={g.title} count={g.people.length} />
              {g.people.map((m) => row(m))}
            </section>
          ))}
          {quiet.length > 0 && (
            <section data-where-group="quiet" className="mt-3">
              <GroupHead title="Place not shown" count={quiet.length} />
              {quiet.map((m) => row(m, true))}
            </section>
          )}
          <p className="mt-4 text-[13px] leading-snug text-muted-foreground">Tap anyone for everything they watch.</p>
        </div>
      )}
    </Sheet>
  );
}
