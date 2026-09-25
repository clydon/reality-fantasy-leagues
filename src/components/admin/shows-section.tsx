"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { AdminShow, ShowSeason, WikiSeasonSyncResult, SeasonResearchResult, ResearchCastaway } from "@/lib/game/types";
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

  // Research is per EPISODE, not per season (a search is scoped to one episode, and a season in
  // progress then costs one episode a week), so unlike the two pulls it needs an episode number
  // from whoever clicks.
  const [episode, setEpisode] = useState("1");
  const [researching, setResearching] = useState(false);
  const [research, setResearch] = useState<SeasonResearchResult | null>(null);
  const [researchError, setResearchError] = useState<string | null>(null);

  async function doResearch(force = false) {
    const n = Number(episode);
    if (!Number.isInteger(n) || n < 1) {
      setResearchError("Give it an episode number first.");
      return;
    }
    setResearching(true);
    setResearch(null);
    setResearchError(null);
    try {
      setResearch(await api.adminResearchEpisode(season.id, n, { force }));
    } catch (e) {
      setResearchError(e instanceof ApiError ? e.message : "That research didn't work.");
    } finally {
      setResearching(false);
    }
  }

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
          {/* The second connector (db/episode-research.js): a web search answering a fixed checklist,
              for the facts the wiki's tables don't carry -- idols found, sit-outs, advantages played
              against someone. Sits next to Pull episodes because it answers the same question about
              the same episode; it just asks the internet instead of a table. */}
          <span className="inline-flex items-center gap-1">
            <span className="text-muted-foreground">ep</span>
            <Input
              value={episode}
              onChange={(e) => setEpisode(e.target.value)}
              inputMode="numeric"
              className="h-6 w-11 px-1 text-center text-xs"
              aria-label="Episode number to research"
              disabled={researching}
            />
            <Button
              variant="secondary"
              size="xs"
              disabled={busy || researching || pulling !== null}
              title="Ask a web-searching model a fixed checklist about every castaway in this episode — idols, sit-outs, votes, advantages. Nothing is applied or scored; it's filed for review."
              onClick={() => doResearch()}
            >
              {researching ? "Researching…" : "Research"}
            </Button>
          </span>
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
      {researching && (
        <p className="mt-1 italic text-muted-foreground">
          Searching the web and answering the checklist for every cast member — tens of seconds, sometimes longer.
          Leave this open.
        </p>
      )}
      {researchError && <p className="mt-1 font-semibold text-destructive">{researchError}</p>}
      {research && <ResearchResult research={research} busy={researching} onForce={() => doResearch(true)} />}
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

// What one episode's research found. Written for someone deciding whether to trust it, which is a
// different job from reading a wiki pull's summary: every answer here came from a live web search
// that can't be re-run to the same result, so the three things on screen are the claim, the
// confidence, and the source behind it.
//
// EVERY castaway is listed, including the ones nothing was found for. That's deliberate and it's the
// bug this app has already hit twice: a castaway who took votes and survived produced no "event" and
// silently vanished from review. A quiet row here means "asked, nothing found" -- which is a fact
// worth seeing, and the difference between that and "we never asked" is the whole point of the
// checklist.
function ResearchResult({
  research,
  busy,
  onForce,
}: {
  research: SeasonResearchResult;
  busy: boolean;
  onForce: () => void;
}) {
  const { payload, provenance, counts, problems } = research;
  const noted = payload.castaways.filter((c) => notesFor(c).length > 0);
  const quiet = payload.castaways.filter((c) => notesFor(c).length === 0);

  return (
    <div className="mt-1 rounded border border-dashed border-border bg-secondary/40 p-1.5 text-[0.7rem]">
      <p className="text-muted-foreground">
        {research.cached
          ? "Already researched — reused the stored answers, no search and no model call."
          : `Searched the web and answered the checklist (${provenance.passes === 1 ? "one call" : "two calls"}).`}{" "}
        <code className="font-mono">
          {provenance.provider}/{provenance.model}
        </code>
        {provenance.usage ? ` · ${provenance.usage.input_tokens.toLocaleString()} in / ${provenance.usage.output_tokens.toLocaleString()} out` : null}
        {/* Offered always, not only on a cache hit like the wiki pull's: there is no revision id
            here, so "nothing changed" is never why an answer came back thin -- a re-run genuinely
            reads different pages and can genuinely do better. */}
        <Button variant="secondary" size="xs" className="ml-1.5" disabled={busy} onClick={onForce}>
          Research again
        </Button>
      </p>

      <p className="mt-1">
        <b>
          Episode {research.episode}
          {payload.episodeTitle ? `: ${payload.episodeTitle}` : ""}
        </b>
        {payload.airDate ? <span className="text-muted-foreground"> · {payload.airDate}</span> : null}
        {payload.tribalCouncilHeld !== "yes" ? (
          <span className="text-muted-foreground"> · Tribal Council: {payload.tribalCouncilHeld}</span>
        ) : null}
      </p>
      <p className="mt-0.5">{payload.summary}</p>

      <ul className="mt-1 flex flex-col gap-0.5">
        {noted.map((c) => (
          <li key={c.name} className="flex flex-wrap items-baseline gap-1">
            <Badge variant={c.confidence === "high" ? "default" : c.confidence === "medium" ? "secondary" : "outline"} className="h-4 text-[0.6rem]">
              {c.confidence}
            </Badge>
            <b>{c.name}</b>
            <span>{notesFor(c).join("; ")}</span>
            {c.sources.length ? (
              <span className="text-muted-foreground">
                {c.sources.map((url, i) => (
                  <a
                    key={url}
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="ml-1 underline underline-offset-2"
                    title={url}
                  >
                    [{i + 1}]
                  </a>
                ))}
              </span>
            ) : (
              /* A claim with nothing behind it is the one thing this whole design exists to make
                 visible, so it is called out on the row rather than only counted below. */
              <span className="font-semibold text-destructive">no source</span>
            )}
          </li>
        ))}
      </ul>

      {quiet.length > 0 && (
        <p className="mt-1 text-muted-foreground">
          <b>Asked, nothing found:</b> {quiet.map((c) => c.name).join(", ")}
        </p>
      )}

      {problems.length > 0 && (
        <ul className="mt-1 flex flex-col gap-0.5 text-destructive">
          {problems.map((p) => (
            <li key={p}>! {p}</li>
          ))}
        </ul>
      )}

      <p className="mt-1 text-muted-foreground">
        {counts.castaways} asked · {counts.sourced} with a source · {counts.lowConfidence} low-confidence ·{" "}
        {counts.unknowns} unknown answer{counts.unknowns === 1 ? "" : "s"} ·{" "}
        {provenance.pagesRead.length} page{provenance.pagesRead.length === 1 ? "" : "s"} read
        {provenance.pagesRead.length > 0 && (
          <>
            {" "}
            <span title={provenance.pagesRead.join("\n")} className="underline decoration-dotted">
              (hover for the list)
            </span>
          </>
        )}
      </p>
      <p className="mt-0.5 text-muted-foreground">
        Nothing here is applied or scored — it&rsquo;s stored for review. &ldquo;Unknown&rdquo; means the search
        couldn&rsquo;t establish it either way, which is not the same as &ldquo;no&rdquo;.
      </p>
    </div>
  );
}

// One castaway's answers as a human-readable line, listing only what actually happened. A castaway
// with nothing on this list is reported as "asked, nothing found" rather than dropped.
function notesFor(c: ResearchCastaway): string[] {
  const notes: string[] = [];
  if (c.leftTheGame === "yes") notes.push(`OUT — ${c.exitMethod || "method unknown"}`);
  if (typeof c.votesReceived === "number" && c.votesReceived > 0) notes.push(`${c.votesReceived} vote${c.votesReceived === 1 ? "" : "s"} against`);
  if (c.votedFor) notes.push(`voted ${c.votedFor}`);
  if (c.wonIndividualImmunity === "yes") notes.push("individual immunity");
  if (c.wonTribeImmunity === "yes") notes.push("tribe immunity");
  if (c.wonIndividualReward === "yes") notes.push("individual reward");
  if (c.wonTribeReward === "yes") notes.push("tribe reward");
  if (c.satOutOfChallenge === "yes") notes.push("sat out a challenge");
  if (c.foundAdvantage === "yes") notes.push(`found ${c.advantageFoundName || "an advantage"}`);
  if (c.playedAdvantage === "yes") notes.push(`played ${c.advantagePlayedName || "an advantage"}`);
  if (typeof c.votesNullified === "number" && c.votesNullified > 0) notes.push(`nullified ${c.votesNullified} vote${c.votesNullified === 1 ? "" : "s"}`);
  if (c.advantageUsedAgainstThem === "yes") notes.push("advantage used against them");
  if (c.exiled === "yes") notes.push("exiled");
  if (c.notableTwist) notes.push(c.notableTwist);
  return notes;
}
