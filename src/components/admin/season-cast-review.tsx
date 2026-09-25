"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { SeasonCastMember } from "@/lib/game/types";
import { api, ApiError } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { confirm } from "@/lib/confirm-store";
import { plural } from "@/lib/use-show-terms";

// Reviewing and approving one season's cast (db/migrations/0011). This is the step that used to be
// every commissioner's job -- "Apply" on a per-league cast proposal -- and it's here because a cast
// is a fact about the show, identical for every league playing the season. Whoever catalogues the
// season can now finish the job in one place, and approving pushes it into every league tracking it.
//
// The table shows exactly what a league will get: the photo, the name, and the starting tribe. Those
// three are what the connector extracts and all that leagues receive, so reviewing anything less
// would be reviewing a summary rather than the thing itself.
export function SeasonCastReview({ seasonId, seasonLabel }: { seasonId: string; seasonLabel: string }) {
  const { data, refetch, isLoading } = useQuery({
    queryKey: ["season-cast", seasonId],
    queryFn: () => api.adminSeasonCast(seasonId),
  });
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(fn: () => Promise<string | null>) {
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      const message = await fn();
      if (message) setNote(message);
      await refetch();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "That didn't work.");
    } finally {
      setBusy(false);
    }
  }

  if (isLoading) return <p className="mt-2 text-xs italic text-muted-foreground">Loading cast…</p>;

  const cast = data?.cast ?? [];
  const term = data?.castawayTerm ?? "Castaway";
  const tribeTerm = data?.tribeTerm ?? "Tribe";
  const approved = !!data?.approvedAt;
  const leagueCount = data?.leagueCount ?? 0;
  const withTribes = cast.filter((c) => c.tribeName).length;
  const heldFrom = data?.tribesFromEpisode ?? null;

  if (!cast.length) {
    return (
      <p className="mt-2 text-xs italic text-muted-foreground">
        No cast staged yet — use <b>Pull cast</b> above and it lands here for review.
      </p>
    );
  }

  async function approve() {
    const res = await api.adminApproveSeasonCast(seasonId);
    const reached = res.applied.filter((a) => !a.error);
    const addedTotal = reached.reduce((n, a) => n + a.added.length, 0);
    return (
      `Approved ${res.castSize} ${plural(term).toLowerCase()}. ` +
      (reached.length
        ? `Added ${addedTotal} to ${reached.length} league${reached.length === 1 ? "" : "s"}` +
          `${reached.map((a) => ` — ${a.leagueName}: ${a.added.length} added${a.skipped.length ? `, ${a.skipped.length} already there` : ""}`).join("")}.`
        : "No league is tracking this season yet — any that picks it will get this cast automatically.")
    );
  }

  return (
    <div className="mt-2 rounded-md border border-dashed border-border bg-secondary/40 p-2">
      <div className="mb-1.5 flex flex-wrap items-center gap-2">
        <h5 className="text-[0.7rem] font-bold uppercase tracking-wide text-muted-foreground">
          {plural(term)} — {seasonLabel}
        </h5>
        {approved ? (
          <Badge variant="secondary" className="text-[0.6rem]">
            Approved
          </Badge>
        ) : (
          <Badge className="text-[0.6rem]">Needs review</Badge>
        )}
        <span className="text-[0.7rem] text-muted-foreground">
          {cast.length} {plural(term).toLowerCase()} · {withTribes ? `${withTribes} with a ${tribeTerm.toLowerCase()}` : `no ${plural(tribeTerm).toLowerCase()}`} ·{" "}
          {leagueCount} league{leagueCount === 1 ? "" : "s"} on this season
        </span>
      </div>

      <div className="mb-2 max-h-[340px] overflow-y-auto rounded border border-border bg-card">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-card">
            <tr className="border-b border-border text-left text-[0.65rem] uppercase tracking-wide text-muted-foreground">
              <th className="w-[46px] px-2 py-1.5 font-bold">Photo</th>
              <th className="px-2 py-1.5 font-bold">Name</th>
              <th className="px-2 py-1.5 font-bold">{tribeTerm}</th>
              <th className="w-[34px] px-2 py-1.5" />
            </tr>
          </thead>
          <tbody>
            {cast.map((member) => (
              <CastRow key={member.id} member={member} busy={busy} held={heldFrom !== null} onRemove={() =>
                run(async () => {
                  if (!(await confirm(`Remove ${member.name} from this season's cast?`, { danger: true, confirmLabel: "Remove" }))) return null;
                  await api.adminEditSeasonCast(seasonId, { remove: member.id });
                  return `Removed ${member.name}.`;
                })
              } />
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <Button size="xs" disabled={busy} onClick={() => run(approve)}>
          {approved ? "Re-approve & push to leagues" : `Approve cast${leagueCount ? ` & add to ${leagueCount} league${leagueCount === 1 ? "" : "s"}` : ""}`}
        </Button>
        {/* HOLD rather than delete. The starting division is premiere-night information, so a league
            catching up from episode 0 shouldn't be handed it with the cast -- but it should get it
            the moment it reveals the premiere. The button this replaced stripped the tribes from the
            season outright, which meant they never arrived for anyone, however far a league got. */}
        <Button
          variant="secondary"
          size="xs"
          disabled={busy || withTribes === 0}
          title={
            heldFrom
              ? `Send ${plural(tribeTerm).toLowerCase()} with the cast instead of holding them`
              : `Hold the starting ${plural(tribeTerm).toLowerCase()} back until a catching-up league reveals episode 1`
          }
          onClick={() =>
            run(async () => {
              await api.adminEditSeasonCast(seasonId, { tribesFromEpisode: heldFrom ? null : 1 });
              return heldFrom
                ? `${plural(tribeTerm)} now go out with the cast.`
                : `${plural(tribeTerm)} held until episode 1 is revealed.`;
            })
          }
        >
          {heldFrom ? `Send ${plural(tribeTerm).toLowerCase()} with the cast` : `Hold ${plural(tribeTerm).toLowerCase()} until episode 1`}
        </Button>
      </div>
      <p className="mt-1 text-[0.7rem] text-muted-foreground">
        {approved
          ? `Approved — leagues on this season have it, and any league that picks this season later gets it automatically.`
          : `Nothing reaches a league until you approve. Adding is additive: a league that already has some of these keeps what it has.`}
        {heldFrom ? (
          <>
            {" "}
            {plural(tribeTerm)} are <b>held until episode {heldFrom}</b>: a league catching up gets the {plural(term).toLowerCase()}{" "}
            ungrouped now and is sorted into {plural(tribeTerm).toLowerCase()} automatically when it reveals that episode. A league
            playing live gets them straight away.
          </>
        ) : null}
      </p>
      {note && <p className="mt-1 text-[0.7rem] font-semibold text-good">{note}</p>}
      {error && <p className="mt-1 text-[0.7rem] font-semibold text-destructive">{error}</p>}
    </div>
  );
}

function CastRow({ member, busy, held, onRemove }: { member: SeasonCastMember; busy: boolean; held: boolean; onRemove: () => void }) {
  const [broken, setBroken] = useState(false);
  return (
    <tr className="border-b border-border last:border-0">
      <td className="px-2 py-1">
        {/* A plain <img>, like CastawayAvatar: these are arbitrary wiki CDN hosts, which next/image
            would need configuring one at a time. Initials stand in both when a photo didn't resolve
            AND when the URL that did resolve turns out to be dead -- the review table is exactly
            where a broken image would otherwise be mistaken for a broken import. */}
        {member.photoUrl && !broken ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={member.photoUrl} alt="" className="h-8 w-8 rounded-full object-cover" onError={() => setBroken(true)} />
        ) : (
          <span
            className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-[0.6rem] font-bold text-muted-foreground"
            title={member.photoUrl && broken ? "That photo URL didn't load" : "No photo on the wiki row"}
          >
            {member.name.split(/\s+/).slice(0, 2).map((w) => w[0]).join("")}
          </span>
        )}
      </td>
      <td className="px-2 py-1 font-semibold">{member.name}</td>
      <td className="px-2 py-1 text-muted-foreground">
        {member.tribeName ? (
          <>
            {member.tribeName}
            {held && <span className="ml-1.5 text-[0.65rem] italic opacity-70">held</span>}
          </>
        ) : (
          <span className="italic">—</span>
        )}
      </td>
      <td className="px-2 py-1">
        <button className="text-muted-foreground hover:text-destructive disabled:opacity-40" disabled={busy} onClick={onRemove} title="Remove from this season's cast">
          ✕
        </button>
      </td>
    </tr>
  );
}
