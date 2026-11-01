"use client";

import { Plus } from "lucide-react";
import { useHome, useOnNow } from "../data";
import { NavLink } from "../nav";
import { paths } from "../routes";
import { Avatar } from "../ui/bars";
import { Btn } from "../ui/parts";
import { ShowArt } from "../ui/show-bar";
import { Sheet } from "../ui/sheet";
import { openWatching } from "../watching/sheets";
import { personShows, type PersonShow } from "./where";

// Someone on the couch (the user's pick F of the 2026-11-01 "Where everyone is" mocks: "we don't really have a view of the full
// couch yet"): every show they share Where I am on, how far they are in each ("Caught up · Episode 7", "Up to Episode 5 of 7"),
// who's watching along now, how far ahead of you, and Add to my shows on one you don't watch. Your own is what the couch sees
// of you, with the shows you watch privately marked as only yours. Opened from the hub's couch row and the couch's details
// (couch-sheets.tsx: openCouchSheet({ kind: "person" })). A row opens the show; nothing here moves anyone's mark.

const plainName = (name: string) => name.replace(/\s*\([^)]*\)\s*$/, "").trim() || name;

/** Add a show they watch to yours: the where sheet asks how far you are (as The couch is watching's Add does). */
function addIt(p: PersonShow, close: () => void) {
  const s = p.season;
  close();
  openWatching({
    kind: "where",
    target: {
      seasonId: s.seasonId,
      label: p.label,
      show: plainName(s.show.name),
      artUrl: s.show.artUrl,
      artPosition: "center",
      aired: s.latestAired,
      status: s.status === "upcoming" || s.status === "completed" ? s.status : "airing",
      premiere: s.premiereDate,
      seen: 0,
      following: false,
      plays: false,
    },
  });
}

export function PersonSheet({ couchId, userId, back, onOpenChange }: { couchId: string | null; userId: string | null; back?: { label: string; onClick: () => void }; onOpenChange: (o: boolean) => void }) {
  const { data: home } = useHome();
  const couch = home?.couches.find((c) => c.id === couchId) ?? null;
  const member = couch?.members.find((m) => m.userId === userId) ?? null;
  const { data: on } = useOnNow(member ? couchId : null);
  const you = !!home && member?.userId === home.user.id;
  const list = home && couch && member ? personShows(home, couch, member.userId, on?.now ?? []) : [];
  const shared = list.filter((p) => !p.private).length;
  const name = member?.name ?? "";
  return (
    <Sheet
      open={!!member}
      onOpenChange={onOpenChange}
      back={back}
      title={
        <span className="flex items-center gap-3">
          {member && <Avatar id={member.userId} name={member.name} size={36} />}
          <span className="min-w-0 truncate">{you ? "You" : name}</span>
        </span>
      }
      subtitle={you ? "What the couch sees of you" : shared ? `${shared} ${shared === 1 ? "show" : "shows"} shared with the couch` : "Nothing shared yet"}
    >
      <div data-person-sheet={name}>
        {list.map((p) => (
          <div key={p.seasonId} data-person-show={p.label} className="flex min-h-[68px] items-center gap-3 border-t border-border py-2 first:border-t-0">
            <NavLink href={paths.show(p.seasonId)} channel className="nd-press flex min-w-0 flex-1 items-center gap-3 text-left">
              <ShowArt seasonId={`person-${p.seasonId}`} artUrl={p.season.show.artUrl} name={plainName(p.season.show.name)} className="h-10 w-14 flex-none rounded-[3px] text-[15px]" />
              <span className="min-w-0 flex-1">
                <b className="block truncate text-[15px] font-semibold">{p.label}</b>
                <small className="block text-[13px]" data-person-where>
                  {p.where}
                </small>
                {p.line && (
                  <small data-person-line className={`block text-[13px] ${p.now ? "font-semibold text-good" : "text-muted-foreground"}`}>
                    {p.line}
                  </small>
                )}
              </span>
            </NavLink>
            {!p.yours && !you && (
              <Btn className="h-11 flex-none gap-1.5 px-3.5" data-person-add={p.label} onClick={() => addIt(p, () => onOpenChange(false))}>
                <Plus className="size-4" aria-hidden />
                Add
              </Btn>
            )}
          </div>
        ))}
        <p className="mt-4 text-[13px] leading-snug text-muted-foreground">
          {you
            ? list.length
              ? "Change what the couch sees in Settings, or watch a show privately from its ⋯ menu."
              : "Add a show and the couch sees how far you are in it."
            : list.length
              ? `Only what ${name} shares. A show watched privately never shows here.`
              : `${name} hasn't shared a show with the couch yet.`}
        </p>
        {you && (
          <NavLink href={paths.settings} className="mt-1 inline-flex h-11 items-center text-[15px] font-semibold underline underline-offset-[3px]">
            What your couch sees
          </NavLink>
        )}
      </div>
    </Sheet>
  );
}
