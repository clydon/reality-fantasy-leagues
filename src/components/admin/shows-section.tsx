"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { AdminShow, ShowSeason } from "@/lib/game/types";
import { api, ApiError } from "@/lib/api";
import { plural } from "@/lib/use-show-terms";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { cn } from "cn";

// Super-admin management of the show/season catalog, which used to be a hardcoded registry in
// state-logic.js (SHOWS) that needed a code change to extend. Shows list here with their seasons
// nested, since a season only means anything in the context of its show.
//
// Uses TanStack Query rather than admin-store.ts: that store loads users + leagues eagerly on tab
// mount for the tables above, whereas this section is self-contained and only needs its own
// refetch-after-mutation. Adding it to the store would couple two unrelated reload paths.
export function ShowsSection() {
  const { data, refetch, isLoading } = useQuery({
    queryKey: ["admin-shows"],
    queryFn: () => api.adminListShows(),
  });

  const [expanded, setExpanded] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  // New-show form
  const [showName, setShowName] = useState("");
  const [castawayTerm, setCastawayTerm] = useState("");
  const [tribeTerm, setTribeTerm] = useState("");

  async function run(fn: () => Promise<unknown>, successNote?: string) {
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      await fn();
      if (successNote) setNote(successNote);
      await refetch();
      return true;
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "That didn't work.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function addShow() {
    const name = showName.trim();
    if (!name) return;
    const ok = await run(
      () => api.adminCreateShow({ name, castawayTerm: castawayTerm.trim(), tribeTerm: tribeTerm.trim() }),
      `Added “${name}”.`
    );
    if (ok) {
      setShowName("");
      setCastawayTerm("");
      setTribeTerm("");
    }
  }

  const shows = data?.shows ?? [];

  return (
    <div className="mb-6 rounded-lg border border-border bg-card p-4 shadow-sm">
      <h3 className="mb-1 text-[0.7rem] font-bold uppercase tracking-wide text-muted-foreground">Shows &amp; Seasons</h3>
      <p className="mb-3 text-sm text-muted-foreground">
        The catalog leagues pick from. A season&rsquo;s wiki URL is what the connector reads to import a cast — paste the
        page straight from your browser and the API endpoint and page title are worked out from it.
      </p>

      {isLoading ? (
        <p className="text-sm italic text-muted-foreground">Loading…</p>
      ) : (
        <div className="mb-4 flex flex-col gap-2">
          {shows.map((show) => (
            <ShowRow
              key={show.id}
              show={show}
              expanded={expanded === show.id}
              onToggle={() => setExpanded(expanded === show.id ? null : show.id)}
              busy={busy}
              run={run}
            />
          ))}
          {shows.length === 0 && <p className="text-sm italic text-muted-foreground">No shows yet.</p>}
        </div>
      )}

      <div className="rounded-md border border-dashed border-border bg-secondary/40 p-2.5">
        <h4 className="mb-1.5 text-xs font-bold">Add a show</h4>
        <div className="flex flex-wrap items-center gap-1.5">
          <Input
            size="sm"
            className="min-w-[160px] flex-1"
            placeholder="Show name, e.g. Big Brother"
            value={showName}
            onChange={(e) => setShowName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addShow()}
          />
          <Input
            size="sm"
            className="w-[130px]"
            placeholder="Castaway term"
            value={castawayTerm}
            onChange={(e) => setCastawayTerm(e.target.value)}
          />
          <Input
            size="sm"
            className="w-[110px]"
            placeholder="Tribe term"
            value={tribeTerm}
            onChange={(e) => setTribeTerm(e.target.value)}
          />
          <Button size="sm" disabled={busy || !showName.trim()} onClick={addShow}>
            Add Show
          </Button>
        </div>
        <p className="mt-1 text-[0.7rem] text-muted-foreground">
          Terms default to “Castaway”/“Tribe” and are what the whole app then calls people and groups —
          Houseguests, Contestants, Factions, Teams. They also drive which wiki section the connector looks for,
          so getting them right usually means no further configuration.
        </p>
      </div>

      {note && <p className="mt-2 text-sm font-semibold text-good">{note}</p>}
      {error && <p className="mt-2 text-sm font-semibold text-destructive">{error}</p>}
    </div>
  );
}

function ShowRow({
  show,
  expanded,
  onToggle,
  busy,
  run,
}: {
  show: AdminShow;
  expanded: boolean;
  onToggle: () => void;
  busy: boolean;
  run: (fn: () => Promise<unknown>, note?: string) => Promise<boolean>;
}) {
  const [seasonNumber, setSeasonNumber] = useState("");
  const [seasonName, setSeasonName] = useState("");
  const [wikiUrl, setWikiUrl] = useState("");
  const [status, setStatus] = useState("completed");
  const [castSize, setCastSize] = useState("");

  async function addSeason() {
    const n = parseInt(seasonNumber);
    if (!Number.isInteger(n) || n < 1) return;
    const ok = await run(
      () =>
        api.adminCreateSeason(show.id, {
          seasonNumber: n,
          name: seasonName.trim() || undefined,
          wikiUrl: wikiUrl.trim() || undefined,
          status,
          castSize: castSize ? parseInt(castSize) : undefined,
        }),
      `Added season ${n} to ${show.name}.`
    );
    if (ok) {
      setSeasonNumber("");
      setSeasonName("");
      setWikiUrl("");
      setCastSize("");
    }
  }

  return (
    <div className={cn("rounded-md border border-border p-2.5", show.archived && "opacity-60")}>
      <div className="flex flex-wrap items-center gap-2">
        <button className="text-xs text-muted-foreground" onClick={onToggle} title="Show seasons">
          <span className={cn("inline-block transition-transform", expanded && "rotate-90")}>▸</span>
        </button>
        <span className="text-sm font-bold">{show.name}</span>
        <code className="rounded bg-secondary px-1 py-0.5 font-mono text-[0.65rem]">{show.slug}</code>
        {show.archived && <Badge variant="secondary">Archived</Badge>}
        <span className="text-xs text-muted-foreground">
          {show.seasons.length} season{show.seasons.length === 1 ? "" : "s"} · {show.league_count} league
          {show.league_count === 1 ? "" : "s"} · {show.castaway_term}/{show.tribe_term}
        </span>
        <span className="ml-auto flex flex-wrap gap-1.5">
          <Button
            variant="secondary"
            size="xs"
            disabled={busy}
            onClick={() =>
              run(
                () => api.adminUpdateShow(show.id, { archived: !show.archived }),
                show.archived ? `Restored ${show.name}.` : `Archived ${show.name} — hidden from the picker.`
              )
            }
          >
            {show.archived ? "Restore" : "Archive"}
          </Button>
          <Button
            variant="destructive"
            size="xs"
            disabled={busy}
            onClick={() => {
              if (!confirm(`Delete "${show.name}" and all its seasons? This can't be undone.`)) return;
              run(() => api.adminDeleteShow(show.id), `Deleted ${show.name}.`);
            }}
          >
            Delete
          </Button>
        </span>
      </div>
      {!show.wiki_api_url && (
        <p className="mt-1 text-[0.7rem] text-muted-foreground">
          No wiki API endpoint yet — it&rsquo;ll be filled in automatically from the first season URL you add.
        </p>
      )}

      {expanded && (
        <div className="mt-2 border-t border-border pt-2">
          {/* Editable after creation, because the terminology is what the whole app says AND what
              the connector uses to find the cast section -- getting it wrong shouldn't mean
              recreating the show and orphaning its leagues. */}
          <div className="mb-2 flex flex-wrap items-center gap-1.5 text-xs">
            <label className="flex items-center gap-1">
              Calls people:
              <Input
                size="sm"
                className="w-[120px]"
                defaultValue={show.castaway_term}
                disabled={busy}
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  if (v && v !== show.castaway_term) run(() => api.adminUpdateShow(show.id, { castawayTerm: v }));
                }}
              />
            </label>
            <label className="flex items-center gap-1">
              Groups:
              <Input
                size="sm"
                className="w-[110px]"
                defaultValue={show.tribe_term}
                disabled={busy}
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  if (v && v !== show.tribe_term) run(() => api.adminUpdateShow(show.id, { tribeTerm: v }));
                }}
              />
            </label>
            <label className="flex items-center gap-1">
              Cast section:
              <Input
                size="sm"
                className="w-[140px]"
                placeholder={`auto (${plural(show.castaway_term)})`}
                title="Wiki section heading holding the cast table. Leave blank to infer it from the term above."
                defaultValue={show.cast_section_heading ?? ""}
                disabled={busy}
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  if (v !== (show.cast_section_heading ?? "")) run(() => api.adminUpdateShow(show.id, { castSectionHeading: v }));
                }}
              />
            </label>
            <label className="flex min-w-[200px] flex-1 items-center gap-1">
              Wiki API:
              <Input
                size="sm"
                className="min-w-[160px] flex-1"
                placeholder="https://example.fandom.com/api.php"
                defaultValue={show.wiki_api_url ?? ""}
                disabled={busy}
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  if (v !== (show.wiki_api_url ?? "")) run(() => api.adminUpdateShow(show.id, { wikiApiUrl: v }));
                }}
              />
            </label>
          </div>

          {show.seasons.length === 0 ? (
            <p className="mb-2 text-xs italic text-muted-foreground">No seasons yet.</p>
          ) : (
            <div className="mb-2 flex flex-col gap-1">
              {show.seasons.map((s) => (
                <SeasonRow key={s.id} season={s} busy={busy} run={run} />
              ))}
            </div>
          )}

          <div className="rounded-md border border-dashed border-border bg-secondary/40 p-2">
            <h5 className="mb-1.5 text-[0.7rem] font-bold">Add a season</h5>
            <div className="flex flex-wrap items-center gap-1.5">
              <Input
                size="sm"
                type="number"
                className="w-16"
                placeholder="#"
                value={seasonNumber}
                onChange={(e) => setSeasonNumber(e.target.value)}
              />
              <Input
                size="sm"
                className="w-[130px]"
                placeholder="Name (optional)"
                value={seasonName}
                onChange={(e) => setSeasonName(e.target.value)}
              />
              <Input
                size="sm"
                className="min-w-[200px] flex-1"
                placeholder="https://survivor.fandom.com/wiki/Survivor_44"
                value={wikiUrl}
                onChange={(e) => setWikiUrl(e.target.value)}
              />
              <Select size="sm" value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="completed">Completed</option>
                <option value="airing">Airing</option>
                <option value="upcoming">Upcoming</option>
              </Select>
              <Input
                size="sm"
                type="number"
                className="w-20"
                placeholder="Cast"
                title="Starting cast size"
                value={castSize}
                onChange={(e) => setCastSize(e.target.value)}
              />
              <Button size="xs" disabled={busy || !seasonNumber} onClick={addSeason}>
                Add
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SeasonRow({
  season,
  busy,
  run,
}: {
  season: ShowSeason;
  busy: boolean;
  run: (fn: () => Promise<unknown>, note?: string) => Promise<boolean>;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded border border-border px-2 py-1 text-xs">
      <span className="font-mono font-bold">S{season.seasonNumber}</span>
      {season.name && <span>{season.name}</span>}
      <Badge variant="secondary" className="text-[0.6rem]">
        {season.status}
      </Badge>
      {season.castSize ? <span className="text-muted-foreground">{season.castSize} cast</span> : null}
      {season.wikiPageTitle ? (
        <span className="text-muted-foreground" title={season.wikiUrl || undefined}>
          wiki: <code className="font-mono">{season.wikiPageTitle}</code>
        </span>
      ) : (
        <span className="italic text-muted-foreground">no wiki page — connector can&rsquo;t import this season</span>
      )}
      <span className="ml-auto flex gap-1.5">
        <Select
          size="sm"
          value={season.status}
          disabled={busy}
          onChange={(e) => run(() => api.adminUpdateSeason(season.id, { status: e.target.value }))}
          title="Change status"
        >
          <option value="completed">Completed</option>
          <option value="airing">Airing</option>
          <option value="upcoming">Upcoming</option>
        </Select>
        <Button
          variant="destructive"
          size="xs"
          disabled={busy}
          onClick={async () => {
            if (!confirm(`Delete season ${season.seasonNumber}?`)) return;
            // The route reports leagues still pointing at this season -- they keep working, but the
            // connector loses its page title for them, so it's worth surfacing rather than silent.
            await run(async () => {
              const res = await api.adminDeleteSeason(season.id);
              if (res.leaguesAffected > 0) {
                alert(
                  `Deleted. Note: ${res.leaguesAffected} league${res.leaguesAffected === 1 ? "" : "s"} still reference ` +
                    `season ${season.seasonNumber}; the wiki connector will fall back to guessing a page title for them.`
                );
              }
            }, `Deleted season ${season.seasonNumber}.`);
          }}
        >
          ✕
        </Button>
      </span>
    </div>
  );
}
