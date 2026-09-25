"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { AdminShow, ShowSeason, WikiSeasonSyncResult } from "@/lib/game/types";
import { api, ApiError } from "@/lib/api";
import { plural } from "@/lib/use-show-terms";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ChevronDownIcon } from "@/components/icons";
import { confirm } from "@/lib/confirm-store";
import { SeasonCastReview } from "./season-cast-review";
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
      <p className="mb-3 text-sm text-muted-foreground">
        Each season has its own <b>Pull cast</b> and <b>Pull episodes</b> buttons, which run the connector for that
        season on the spot instead of waiting for the nightly job — one read, shared by every league tracking it. The{" "}
        <b>cast</b> is yours to review and approve here, under <b>Cast</b>, and approving puts it into every league on
        the season; <b>episode results</b> stay each commissioner&rsquo;s to confirm, on their own episode cards.
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
        <button className="text-muted-foreground" onClick={onToggle} title="Show seasons">
          <ChevronDownIcon className={cn("h-4 w-4 -rotate-90 transition-transform", expanded && "rotate-0")} />
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
            onClick={async () => {
              if (!(await confirm(`Delete "${show.name}" and all its seasons? This can't be undone.`, { danger: true, confirmLabel: "Delete" })))
                return;
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
  // A pull's own state is kept here rather than in the section's shared busy/note/error: it can run
  // for a couple of minutes, its result is a list rather than a sentence, and it belongs next to the
  // season it was run for -- three reasons the shared single-note channel above fits it badly.
  const [pulling, setPulling] = useState<"cast" | "episodes" | null>(null);
  const [result, setResult] = useState<WikiSeasonSyncResult | null>(null);
  const [pullError, setPullError] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState(false);

  async function pull(kind: "cast" | "episodes", force = false) {
    setPulling(kind);
    setResult(null);
    setPullError(null);
    try {
      const res = await api.adminSyncSeason(season.id, kind, force);
      setResult(res);
      // A cast pull's whole point is the review that follows it, so open the table rather than
      // leaving "staged for review" as a sentence with no visible next step.
      if (kind === "cast") setReviewing(true);
    } catch (e) {
      setPullError(e instanceof ApiError ? e.message : "That pull didn't work.");
    } finally {
      setPulling(null);
    }
  }

  return (
    <div className="rounded border border-border px-2 py-1 text-xs">
      <div className="flex flex-wrap items-center gap-2">
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
        <span className="ml-auto flex flex-wrap items-center gap-1.5">
          {/* Two pulls rather than one, because they're genuinely different jobs: cast has to be
              applied before episode results can be matched to anyone by name, and a season whose cast
              is settled still needs re-pulling for episodes every week. */}
          <Button
            variant="secondary"
            size="xs"
            disabled={busy || pulling !== null}
            title="Read this season's cast from the wiki and file it for review in every league tracking the season"
            onClick={() => pull("cast")}
          >
            {pulling === "cast" ? "Pulling…" : "Pull cast"}
          </Button>
          <Button
            variant="secondary"
            size="xs"
            disabled={busy || pulling !== null}
            title="Read this season's per-episode results (eliminations, scoring events) from the wiki and file them for review"
            onClick={() => pull("episodes")}
          >
            {pulling === "episodes" ? "Pulling…" : "Pull episodes"}
          </Button>
          {/* The cast is reviewed and approved here, not by each league's commissioner -- see
              db/migrations/0011 and season-cast-review.tsx. */}
          <Button
            variant="secondary"
            size="xs"
            disabled={busy}
            title="Review and approve this season's cast"
            onClick={() => setReviewing((r) => !r)}
          >
            {reviewing ? "Hide cast" : "Cast"}
          </Button>
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
              if (!(await confirm(`Delete season ${season.seasonNumber}?`, { danger: true, confirmLabel: "Delete" }))) return;
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

      {pulling && (
        <p className="mt-1 italic text-muted-foreground">
          Reading the wiki and extracting — a cast pull takes seconds, a full season of episodes can take a couple of
          minutes. Leave this open.
        </p>
      )}
      {pullError && <p className="mt-1 font-semibold text-destructive">{pullError}</p>}
      {result && <PullResult result={result} busy={busy || pulling !== null} onForce={() => pull(result.kind, true)} />}
      {reviewing && (
        <SeasonCastReview seasonId={season.id} seasonLabel={season.name || `Season ${season.seasonNumber}`} />
      )}
    </div>
  );
}

// What one pull did, reported the way the connector actually works: one read of the wiki (shared),
// then a line per league tracking the season. A league with no line isn't tracking this season.
function PullResult({
  result,
  busy,
  onForce,
}: {
  result: WikiSeasonSyncResult;
  busy: boolean;
  onForce: () => void;
}) {
  return (
    <div className="mt-1 rounded border border-dashed border-border bg-secondary/40 p-1.5 text-[0.7rem]">
      <p className="text-muted-foreground">
        {result.cached
          ? "Wiki unchanged since the last read — reused the cached extraction, no model call."
          : "Read and extracted fresh from the wiki."}{" "}
        {result.pages.map((p) => `${p.title}${p.revisionId ? ` (rev ${p.revisionId})` : ""}`).join(", ")}
        {/* The only way past the revision-id cache. Offered only on a cache hit, because that's the
            one case where clicking Pull again would do exactly nothing -- which is what you'd reach
            for after an extraction that came back wrong from unchanged wikitext. */}
        {result.cached && (
          <Button variant="secondary" size="xs" className="ml-1.5" disabled={busy} onClick={onForce}>
            Extract again anyway
          </Button>
        )}
      </p>
      {result.kind === "cast" ? (
        <p className="mt-0.5">{result.staged?.summary ?? "Staged for review."}</p>
      ) : result.leagues.length === 0 ? (
        <p className="mt-0.5 italic text-muted-foreground">
          No league is tracking this season yet, so there was nobody to file for — the extraction is cached for when
          one is.
        </p>
      ) : (
        <ul className="mt-0.5 flex flex-col gap-0.5">
          {result.leagues.map((l) => (
            <li key={l.id} className={l.ok ? "" : "text-destructive"}>
              <b>{l.name}:</b> {l.ok ? l.summary : l.error}
            </li>
          ))}
        </ul>
      )}
      {/* Spelled out for the cast case specifically: "filed a pending cast proposal" reads like the
          cast is in the league, and it isn't -- nothing from the connector is applied until a
          commissioner says so, and Pull episodes can't match a single name until that happens. That
          ordering trap is what made a correct cast-then-episodes sequence look broken. */}
      {result.kind === "cast" ? (
        <p className="mt-0.5 text-muted-foreground">
          Review it below and hit <b>Approve</b> — that&rsquo;s what puts the cast into leagues, and{" "}
          <b>Pull episodes</b> has no names to match against until it&rsquo;s done.
        </p>
      ) : (
        <p className="mt-0.5 text-muted-foreground">
          Nothing is applied automatically — episode results wait on each episode&rsquo;s card for the commissioner to
          confirm.
        </p>
      )}
    </div>
  );
}
