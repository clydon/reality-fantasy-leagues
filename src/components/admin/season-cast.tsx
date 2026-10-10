"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";
import type { SeasonCastMember, ShowSeason } from "@/lib/game/types";
import { api } from "@/lib/api";
import { estimate } from "@/lib/ai-cost";
import { confirm } from "@/lib/confirm-store";
import { plural } from "@/lib/use-show-terms";
import { useAiModels, useShowSpoilers } from "@/lib/paid-ai-store";
import { seasonCastApi } from "@/lib/season-cast-api";
import { castawayPhotoSrc } from "@/lib/game/selectors";
import { BottomSheet, SheetAction } from "@/components/ui/bottom-sheet";
import { Chip, MoreButton, TextSheet, ToggleRow } from "@/components/setup/settings-ui";
import { ActButton, Cost, Notice, Rows, Section, StickyBar, count, errorText, shortDate } from "./admin-ui";
import { modelLabel } from "./admin-results";
import { SeasonFrame, useSeasonCast } from "./season-frame";
import { cn } from "cn";

// A season's Cast tab (docs/PLAN-ux-redesign.md 3c; the canvas's Admin-Cast). The cast is a fact about
// the show, the same for every league playing the season, so it's reviewed and approved once here and
// approving pushes it into every league tracking the season (db/migrations/0011).
//
// The list shows exactly what a league will get -- photo, name, starting tribe -- because those three
// are all the connector extracts and all leagues receive. Each row's ⋯ fixes one person; on an approved
// cast a fix reaches every league straight away. Approve sits in a sticky bar while there's something
// to approve; pulling again from the wiki is in the page's ⋯, since it costs money and replaces the cast.

// What the cast GET adds for a season's shared cast (db/migrations/0055): who created it, whether it's
// finished, and every change since -- each one reached every league on the season.
interface CastProvenance {
  createdByLeague?: { id: string; name: string | null } | null;
  lockedAt?: string | null;
  changes?: { field: string; before: string | null; after: string | null; changedAt: string; by: string | null; byLeague: string | null }[];
}

type Edit = { member: SeasonCastMember; field: "name" | "photo" | "tribe" };

export function SeasonCast({ seasonId }: { seasonId: string }) {
  const [menu, setMenu] = useState(false);
  return (
    <SeasonFrame seasonId={seasonId} actions={{ label: "Cast actions", onClick: () => setMenu(true) }}>
      {({ season, refetch }) => <CastTab season={season} refetchShows={refetch} menu={menu} setMenu={setMenu} />}
    </SeasonFrame>
  );
}

function CastTab({ season, refetchShows, menu, setMenu }: { season: ShowSeason; refetchShows: () => unknown; menu: boolean; setMenu: (o: boolean) => void }) {
  const queryClient = useQueryClient();
  const { data, refetch, isLoading } = useSeasonCast(season.id);
  const showSpoilers = useShowSpoilers();
  const models = useAiModels();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rowMenu, setRowMenu] = useState<SeasonCastMember | null>(null);
  const [edit, setEdit] = useState<Edit | null>(null);
  const [showAll, setShowAll] = useState(false);

  async function run(fn: () => Promise<string | null>) {
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      const message = await fn();
      if (message) setNote(message);
      await refetch();
      await refetchShows();
      await queryClient.invalidateQueries({ queryKey: ["season-decisions", season.id] });
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  if (isLoading || !data) return <p className="text-muted-foreground">Loading…</p>;

  const cast = data.cast;
  const term = data.castawayTerm;
  const tribeTerm = data.tribeTerm;
  const approved = !!data.approvedAt;
  const leagueCount = data.leagueCount;
  const heldFrom = data.tribesFromEpisode ?? null;
  const provenance = data as CastProvenance;
  const hasWiki = !!season.wikiPageTitle;
  const tribes = new Map<string, number>();
  for (const c of cast) if (c.tribeName) tribes.set(c.tribeName, (tribes.get(c.tribeName) ?? 0) + 1);
  const noPhoto = cast.filter((c) => !c.photoUrl);

  // Pulling the cast is the one paid action that stays with paid actions hidden: cheap, once a season.
  const pull = (force: boolean) =>
    run(async () => {
      const r = await api.adminSyncSeason(season.id, "cast", force, models.wiki);
      return r.staged?.summary ?? "Pulled.";
    });

  async function repull() {
    setMenu(false);
    const ok = await confirm(
      `Read the cast from the wiki again? It replaces what's staged here${approved ? " and needs approving again" : ""}. Typical cost ${estimate("cast", models.wiki)} with ${modelLabel(models.wiki)}.`,
      { confirmLabel: "Pull again" },
    );
    if (ok) pull(true);
  }

  async function approve() {
    setMenu(false);
    run(async () => {
      const res = await api.adminApproveSeasonCast(season.id);
      const reached = res.applied.filter((a) => !a.error);
      const failed = res.applied.filter((a) => a.error);
      const added = reached.reduce((n, a) => n + a.added.length, 0);
      return (
        `Approved ${res.castSize} ${plural(term).toLowerCase()}. ` +
        (reached.length
          ? `Added ${added} to ${count(reached.length, "league")}.`
          : "No league plays this season yet; any that picks it gets this cast.") +
        (failed.length ? ` Couldn't reach ${failed.map((f) => f.leagueName).join(", ")}.` : "")
      );
    });
  }

  // One person's fix (docs/PLAN-universal-season-cast.md): on an approved cast it reaches every league on
  // the season straight away, in place, rather than waiting for a re-approve.
  async function saveEdit({ member, field }: Edit, value: string) {
    setEdit(null);
    const change =
      field === "name"
        ? value && value !== member.name && { rename: { id: member.id, name: value } }
        : field === "photo"
          ? (value || null) !== (member.photoUrl || null) && { photo: { id: member.id, photoUrl: value || null } }
          : (value || null) !== (member.tribeName || null) && { tribe: { id: member.id, tribeName: value || null } };
    if (!change) return;
    if (approved && !(await confirm(`Change ${member.name} in every league on this season (${leagueCount})?`, { confirmLabel: "Change" }))) return;
    run(async () => {
      await seasonCastApi.adminEdit(season.id, change);
      return approved ? `Changed ${member.name} in every league on this season.` : `Changed ${member.name}.`;
    });
  }

  function editField(field: Edit["field"]) {
    if (rowMenu) setEdit({ member: rowMenu, field });
    setRowMenu(null);
  }

  async function remove(member: SeasonCastMember) {
    setRowMenu(null);
    if (!(await confirm(`Remove ${member.name} from this season's cast?`, { danger: true, confirmLabel: "Remove" }))) return;
    run(async () => {
      await api.adminEditSeasonCast(season.id, { remove: member.id });
      return `Removed ${member.name}.`;
    });
  }

  // HOLD rather than delete. The starting division is premiere-night information, so a league catching
  // up from episode 0 shouldn't be handed it with the cast, but should get it the moment it reveals the
  // premiere.
  const toggleHold = (hold: boolean) =>
    run(async () => {
      await api.adminEditSeasonCast(season.id, { tribesFromEpisode: hold ? 1 : null });
      return hold ? `${plural(tribeTerm)} held until episode 1 is revealed.` : `${plural(tribeTerm)} now go out with the cast.`;
    });

  if (!cast.length) {
    return (
      <>
        <Section title="No cast yet">
          <p className="text-[15px] leading-snug text-muted-foreground">
            Pull it from the season&rsquo;s wiki page. It lands here to review, and nothing reaches a league until you approve it.
          </p>
          {hasWiki ? (
            <span className="flex items-center gap-3">
              <ActButton tone="chyron" disabled={busy} onClick={() => pull(false)} className="min-h-12">
                {busy ? "Pulling…" : "Pull cast from wiki"}
              </ActButton>
              <Cost title={`Typical cost with ${modelLabel(models.wiki)}`}>{estimate("cast", models.wiki)}</Cost>
            </span>
          ) : (
            <ActButton href={`/admin/seasons/${season.id}/setup`}>Add the wiki page first</ActButton>
          )}
        </Section>
        {busy && <Notice tone="quiet">Reading the wiki, a few seconds.</Notice>}
        {error && <Notice tone="bad">{error}</Notice>}
        {note && <Notice>{note}</Notice>}
      </>
    );
  }

  const shown = showAll || cast.length <= 30 ? cast : cast.slice(0, 30);

  return (
    <>
      <p className="-mt-2 text-sm text-muted-foreground">
        {cast.length} {plural(term).toLowerCase()} · {approved ? `approved ${shortDate(data.approvedAt!)}` : "not approved yet"} · {count(leagueCount, "league")}
        {provenance.createdByLeague !== undefined && (
          <>
            {" · "}
            {provenance.createdByLeague
              ? `created by ${provenance.createdByLeague.name ?? "a deleted league"}'s commissioner${provenance.lockedAt ? "" : ", still being created"}`
              : "created in Admin"}
          </>
        )}
      </p>

      {error && <Notice tone="bad">{error}</Notice>}
      {note && <Notice>{note}</Notice>}

      <Section title={`${cast.length} ${approved ? "in the cast" : "found"}`}>
        <div className="flex flex-wrap gap-2">
          {showSpoilers ? (
            [...tribes].map(([t, n]) => (
              <Chip key={t}>
                {t} {n}
              </Chip>
            ))
          ) : tribes.size > 0 ? (
            // The starting tribes are the premiere's own reveal.
            <Chip>{plural(tribeTerm)} hidden</Chip>
          ) : null}
          {noPhoto.length > 0 && <Chip tone="chyron">{noPhoto.length} need{noPhoto.length === 1 ? "s" : ""} a photo</Chip>}
        </div>
        <Rows>
          {shown.map((member) => (
            <CastRow
              key={member.id}
              member={member}
              held={heldFrom !== null}
              busy={busy}
              onMenu={() => setRowMenu(member)}
              onPhoto={() => setEdit({ member, field: "photo" })}
            />
          ))}
        </Rows>
        {shown.length < cast.length && (
          <button type="button" className="min-h-11 self-start text-[15px] font-semibold text-muted-foreground hover:text-foreground" onClick={() => setShowAll(true)}>
            Show all {cast.length}
          </button>
        )}
      </Section>

      {tribes.size > 0 && (
        <ToggleRow
          label={`Hold starting ${plural(tribeTerm).toLowerCase()} until episode 1`}
          hint={`A league catching up gets the ${plural(term).toLowerCase()} without ${plural(tribeTerm).toLowerCase()} now, and is sorted into them when it reveals episode 1. A league playing live gets them straight away.`}
          checked={heldFrom !== null}
          disabled={busy}
          onChange={toggleHold}
        />
      )}

      {provenance.changes && provenance.changes.length > 0 && <CastChanges changes={provenance.changes} />}

      {!approved && (
        <StickyBar note="Nothing reaches a league until you approve. A league that already has some of these keeps them.">
          <ActButton tone="chyron" disabled={busy} onClick={approve} className="min-h-12">
            {leagueCount ? `Approve, send to ${count(leagueCount, "league")}` : "Approve cast"}
          </ActButton>
        </StickyBar>
      )}

      <BottomSheet open={menu} onOpenChange={setMenu} title="Cast">
        {approved && (
          <SheetAction onClick={approve} detail="Sends any missing people">
            Push to leagues again
          </SheetAction>
        )}
        {hasWiki && (
          <SheetAction onClick={repull} detail={estimate("cast", models.wiki)}>
            Pull again from wiki
          </SheetAction>
        )}
      </BottomSheet>

      {rowMenu && (
        <BottomSheet open onOpenChange={(o) => !o && setRowMenu(null)} title={rowMenu.name}>
          <SheetAction onClick={() => editField("name")}>Rename</SheetAction>
          <SheetAction onClick={() => editField("photo")}>Photo</SheetAction>
          {/* The starting tribe is only editable with spoilers on; otherwise it isn't shown at all. */}
          {showSpoilers && (
            <SheetAction onClick={() => editField("tribe")} detail={rowMenu.tribeName ?? "None"}>
              {tribeTerm}
            </SheetAction>
          )}
          <SheetAction danger onClick={() => remove(rowMenu)}>
            Remove from the cast
          </SheetAction>
        </BottomSheet>
      )}

      {edit && (
        <TextSheet
          title={edit.field === "name" ? "Rename" : edit.field === "photo" ? "Photo" : tribeTerm}
          description={edit.member.name}
          label={edit.field === "name" ? "Name" : edit.field === "photo" ? "Photo URL" : `Starting ${tribeTerm.toLowerCase()}`}
          help={edit.field === "photo" ? "A link to the image, or a path under /photos. Blank removes it." : undefined}
          initial={edit.field === "name" ? edit.member.name : edit.field === "photo" ? (edit.member.photoUrl ?? "") : (edit.member.tribeName ?? "")}
          allowEmpty={edit.field !== "name"}
          submit="Save"
          onSubmit={(v) => saveEdit(edit, v)}
          onClose={() => setEdit(null)}
        />
      )}
    </>
  );
}

function CastRow({ member, held, busy, onMenu, onPhoto }: { member: SeasonCastMember; held: boolean; busy: boolean; onMenu: () => void; onPhoto: () => void }) {
  const showSpoilers = useShowSpoilers();
  // A plain <img>: these are arbitrary wiki CDN hosts. Initials stand in both when a photo didn't
  // resolve AND when the URL that did turns out to be dead -- this list is exactly where a broken image
  // would otherwise be mistaken for a broken import.
  const [broken, setBroken] = useState(false);
  // Stored paths are relative ("photos/s51/rob.jpg"), so they're resolved from the site root, not this page.
  const src = castawayPhotoSrc(member.photoUrl);
  const hasPhoto = !!src && !broken;
  return (
    <div className="flex min-h-[58px] items-center gap-3 py-1.5">
      {hasPhoto ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src!} alt="" className="size-10 shrink-0 rounded-[2px] object-cover object-top" onError={() => setBroken(true)} />
      ) : (
        <span className="flex size-10 shrink-0 items-center justify-center rounded-[2px] bg-muted text-sm font-bold text-muted-foreground" aria-hidden>
          {member.name
            .split(/\s+/)
            .slice(0, 2)
            .map((w) => w[0])
            .join("")}
        </span>
      )}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-base font-semibold">{member.name}</span>
        {!hasPhoto && <span className="text-[13px] font-semibold text-accent-2">{member.photoUrl ? "That photo didn't load" : "No photo found"}</span>}
      </span>
      {/* The starting tribe is the premiere's own reveal: with spoilers off the chip above says they're hidden. */}
      {member.tribeName && showSpoilers && (
        <span className="max-w-[30%] truncate text-[13px] text-muted-foreground">
          {member.tribeName}
          {held ? " · held" : ""}
        </span>
      )}
      {!hasPhoto ? (
        <ActButton disabled={busy} onClick={onPhoto}>
          Add photo
        </ActButton>
      ) : (
        <MoreButton label={`${member.name}: actions`} onClick={onMenu} />
      )}
    </div>
  );
}

// The trail of changes to the season's cast. Tribe values are the premiere's own reveal, so with
// spoilers off they're left out.
function CastChanges({ changes }: { changes: NonNullable<CastProvenance["changes"]> }) {
  const [open, setOpen] = useState(false);
  const showSpoilers = useShowSpoilers();
  const label: Record<string, string> = {
    created: "created the cast",
    added: "added",
    removed: "removed",
    name: "renamed",
    photo: "changed the photo of",
    tribe: "changed a starting tribe",
    tribes_hold: "set starting tribes:",
    finished: "finished the cast",
  };
  // The tribes hold is logged as words by a commissioner and as an episode number by an admin.
  const hold = (v: string | null) => (!v ? "public before the premiere" : /^\d+$/.test(v) ? `held until episode ${v}` : v);
  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex min-h-11 items-center gap-1.5 self-start text-[15px] font-semibold text-muted-foreground hover:text-foreground"
      >
        <ChevronRight className={cn("size-5 transition-transform", open && "rotate-90")} strokeWidth={2.2} aria-hidden />
        Changes ({changes.length})
      </button>
      {open && (
        <ul className="flex flex-col gap-1 text-[13px] text-muted-foreground">
          {changes.map((c, i) => {
            const hidden = c.field === "tribe" && !showSpoilers;
            const what =
              c.field === "name"
                ? `${c.before} → ${c.after}`
                : c.field === "added"
                  ? c.after
                  : c.field === "removed"
                    ? c.before
                    : c.field === "created"
                      ? c.after && c.after !== "0"
                        ? `with ${c.after} people`
                        : ""
                      : c.field === "tribes_hold"
                        ? hold(c.after)
                        : hidden
                          ? ""
                          : c.before || c.after
                            ? `${c.before ?? "none"} → ${c.after ?? "none"}`
                            : "";
            return (
              <li key={i}>
                {new Date(c.changedAt).toLocaleString()} · {c.by ?? "automatic"}
                {c.byLeague ? ` (via ${c.byLeague})` : ""} {label[c.field] ?? c.field} {what}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
