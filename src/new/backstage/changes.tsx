"use client";

import { RotateCcw, Zap } from "lucide-react";
import { airTime } from "../clock";
import { backstage, useAfterResults, useChanges, type ChangeLine } from "../data";
import type { ShowData } from "../screens/show-space";
import { Avatar } from "../ui/bars";
import { Btn, EmptyState } from "../ui/parts";
import { toast } from "../ui/toast";

// Recent changes (the mock's guards.js bsHistory, docs/PLAN-new-design.md step 5): every change made to the couch's
// games here, newest first, for everyone on the couch to see. Each line says what changed (never who went home), who
// did it and when; one that moved standings says so. Whoever runs every game a change touched can undo it until the next
// episode airs (and, for results, only the newest change to that episode); then it reads "Undone by …".

export function ChangesPage({ seasonId, show }: { seasonId: string; show: ShowData }) {
  const couchId = show.couch?.id ?? null;
  const changes = useChanges(seasonId, couchId);
  const refresh = useAfterResults();

  if (changes.error) return <EmptyState icon={RotateCcw} title="Couldn't load the changes" line={(changes.error as Error).message} />;
  if (!changes.data) return <div aria-busy className="mx-4 mt-6 h-48 animate-pulse rounded-[4px] bg-card" />;
  const lines = changes.data.lines;

  const undo = async (l: ChangeLine) => {
    try {
      await backstage.undo(seasonId, couchId!, l.batch);
      await refresh();
      toast(`Undone: ${l.text.charAt(0).toLowerCase()}${l.text.slice(1)}`);
    } catch (e) {
      toast((e as Error).message);
    }
  };

  return (
    <div className="px-4 pb-12 pt-5">
      <p className="rounded-[4px] bg-card p-3.5 text-[15px] leading-snug">
        Everyone on the couch can see this list.{changes.data.runs ? " Changes can be undone until the next episode airs." : ""}
      </p>
      {!lines.length ? (
        <EmptyState icon={RotateCcw} title="Nothing's changed yet" line="Results going in, settings, roles and the cast: whatever changes in these games shows here." />
      ) : (
        <ul className="mt-3 flex flex-col" data-changes={lines.length}>
          {lines.map((l) => (
            <li key={l.batch} data-change={l.kind} className="flex min-h-16 items-center gap-3 border-t border-border py-2.5">
              {l.who ? (
                <Avatar id={l.who.userId} name={l.who.name} size={30} />
              ) : (
                <span className="grid size-[30px] flex-none place-items-center rounded-[3px] bg-secondary" aria-hidden>
                  <Zap className="size-4" />
                </span>
              )}
              <span className={`min-w-0 flex-1 ${l.undone ? "opacity-60" : ""}`}>
                <b className={`block text-[15px] font-semibold leading-snug ${l.undone ? "line-through decoration-1" : ""}`}>{l.text}</b>
                <small className="mt-0.5 block text-[12px] leading-snug text-muted-foreground">
                  {[l.who?.name ?? (l.kind === "results.correction" ? "From the shared check" : "On its own"), airTime(Date.parse(l.at)), l.tier >= 2 ? "moved standings" : null, show.games.length > 1 ? l.games.join(", ") : null]
                    .filter(Boolean)
                    .join(" · ")}
                </small>
                {l.undone && <small className="block text-[12px] text-muted-foreground">Undone by {l.undone.by ?? "someone"} · {airTime(Date.parse(l.undone.at))}</small>}
              </span>
              {l.undoable && (
                <Btn data-undo={l.batch} className="h-10 flex-none px-3 text-[14px]" onClick={() => undo(l)}>
                  Undo
                </Btn>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
