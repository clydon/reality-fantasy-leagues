"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { AdminShow, ShowSeason, WikiSeasonSyncResult, SeasonResearchResult, ResearchCastaway, ModelUsage } from "@/lib/game/types";
import { api, ApiError } from "@/lib/api";
import { plural } from "@/lib/use-show-terms";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ChevronDownIcon } from "@/components/icons";
import { confirm } from "@/lib/confirm-store";
import { SeasonCastReview } from "./season-cast-review";
import { SeasonEpisodes } from "./season-episodes";
import { cn } from "cn";
import { AI_MODELS, costOf, estimate, formatCost } from "@/lib/ai-cost";
import { DEFAULT_FORMAT, formatFor, formatOptions } from "@/lib/game/formats/index.js";
import { useShowPaidAi } from "@/lib/paid-ai-store";

// Super-admin management of the show/season catalog, and the place a season's content comes from.
//
// Organised around the one order the work actually has to happen in, per season:
//
//   1. Cast      -- pull it from the wiki, review it, approve it. Approving is what puts it into
//                   leagues, and nothing in step 2 can match a single name until it's done.
//   2. Episodes  -- each week, pull results from the wiki and (optionally) research the episode, then
//                   review them here. Accepted results go to every league on the season on their own.
//
// Each step shows where it stands (not pulled / staged / approved; results through episode N;
// researched episodes) and offers the NEXT action as its primary button. Step 2 stays locked until
// the cast is approved, because running it earlier was the single most common way this went wrong:
// "no castaways yet" after a correct-looking cast-then-episodes sequence.
//
// Everything set once and rarely touched again -- show terminology, the wiki endpoint, archiving,
// a season's status, deleting -- lives behind a Settings toggle rather than on every row.
//
// The two paid actions (reading the wiki, web research) each take a model from the picker at the
// top, and every button that spends money says roughly how much next to it; the ones that don't
// (reviewing, approving, settings, a pull when the wiki hasn't changed) say nothing or say "free".

type Models = { wiki: string; research: string };
const DEFAULT_MODELS: Models = { wiki: "claude-haiku-4-5", research: "claude-haiku-4-5" };
const MODELS_KEY = "rfl.admin.aiModels";

// Remembered per browser -- it's one admin's cost preference, not league state. Loaded after mount
// so the server render and the first client render agree.
function useAiModels(): [Models, (m: Models) => void] {
  const [models, setModels] = useState<Models>(DEFAULT_MODELS);
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(MODELS_KEY) || "null");
      const known = (id: unknown) => AI_MODELS.some((m) => m.id === id);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time load from browser storage
      if (saved && known(saved.wiki) && known(saved.research)) setModels(saved);
    } catch {
      /* no storage: defaults are fine */
    }
  }, []);
  function save(m: Models) {
    setModels(m);
    try {
      localStorage.setItem(MODELS_KEY, JSON.stringify(m));
    } catch {
      /* not persisted this time */
    }
  }
  return [models, save];
}

/** The small grey price next to a button. */
function CostHint({ children, title }: { children: ReactNode; title?: string }) {
  return (
    <span className="text-[0.6rem] tabular-nums text-muted-foreground" title={title}>
      {children}
    </span>
  );
}

function modelLabel(id: string | null | undefined) {
  return AI_MODELS.find((m) => m.id === id)?.label ?? id ?? "";
}
export function ShowsSection() {
  const { data, refetch, isLoading } = useQuery({
    queryKey: ["admin-shows"],
    queryFn: () => api.adminListShows(),
  });

  // "" = explicitly collapsed, null = untouched (a lone show opens by default -- the common case is
  // one show, and making someone click to reach the only thing on the page is friction for nothing).
  const [expanded, setExpanded] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [addingShow, setAddingShow] = useState(false);

  const [showName, setShowName] = useState("");
  const [castawayTerm, setCastawayTerm] = useState("");
  const [tribeTerm, setTribeTerm] = useState("");
  const [format, setFormat] = useState(DEFAULT_FORMAT);
  const [models, setModels] = useAiModels();
  const showPaid = useShowPaidAi();

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
      () => api.adminCreateShow({ name, castawayTerm: castawayTerm.trim(), tribeTerm: tribeTerm.trim(), format }),
      `Added “${name}”.`
    );
    if (ok) {
      setShowName("");
      setCastawayTerm("");
      setTribeTerm("");
      setFormat(DEFAULT_FORMAT);
      setAddingShow(false);
    }
  }

  const shows = data?.shows ?? [];

  return (
    <div className="mb-6 rounded-lg border border-border bg-card p-4 shadow-sm">
      <h3 className="mb-1 text-[0.7rem] font-bold uppercase tracking-wide text-muted-foreground">Shows &amp; Seasons</h3>
      <p className="mb-3 text-sm text-muted-foreground">
        For each season: <b>1.</b> pull and approve the cast, then <b>2.</b> pull episode results each week and review
        them. Everything you accept reaches every league on the season automatically.
      </p>
      <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        {/* Wiki reading stays even with paid actions hidden: the cast pull (exempt) uses it. */}
        {(
          [
            ["wiki", "Wiki reading"],
            ...(showPaid ? ([["research", "Research"]] as const) : []),
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="flex items-center gap-1">
            {label}
            <Select size="sm" value={models[key]} onChange={(e) => setModels({ ...models, [key]: e.target.value })}>
              {AI_MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label} (${m.input}/${m.output})
                </option>
              ))}
            </Select>
          </label>
        ))}
        <span className="text-[0.65rem]" title="Per million tokens, input/output. Research also pays $0.01 per web search.">
          Prices by each button are typical per click. Reviewing, approving and settings are free.
        </span>
      </div>

      {isLoading ? (
        <p className="text-sm italic text-muted-foreground">Loading…</p>
      ) : (
        <div className="mb-3 flex flex-col gap-2">
          {shows.map((show) => {
            const open = expanded === show.id || (expanded === null && shows.length === 1);
            return (
              <ShowRow
                key={show.id}
                show={show}
                expanded={open}
                onToggle={() => setExpanded(open ? "" : show.id)}
                busy={busy}
                run={run}
                refetch={refetch}
                models={models}
              />
            );
          })}
          {shows.length === 0 && <p className="text-sm italic text-muted-foreground">No shows yet — add one to start.</p>}
        </div>
      )}

      {addingShow || shows.length === 0 ? (
        <div className="rounded-md border border-dashed border-border bg-secondary/40 p-2.5">
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
              placeholder="Castaway"
              title="What the show calls its people — Houseguest, Contestant…"
              value={castawayTerm}
              onChange={(e) => setCastawayTerm(e.target.value)}
            />
            <Input
              size="sm"
              className="w-[110px]"
              placeholder="Tribe"
              title="What the show calls its groups — Team, Faction…"
              value={tribeTerm}
              onChange={(e) => setTribeTerm(e.target.value)}
            />
            <Select size="sm" value={format} title="Which game rules the show plays by" onChange={(e) => setFormat(e.target.value)}>
              {formatOptions().map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name} rules
                </option>
              ))}
            </Select>
            <Button size="sm" disabled={busy || !showName.trim()} onClick={addShow}>
              Add show
            </Button>
            {shows.length > 0 && (
              <Button variant="secondary" size="sm" onClick={() => setAddingShow(false)}>
                Cancel
              </Button>
            )}
          </div>
          <p className="mt-1 text-[0.7rem] text-muted-foreground">
            The two terms are what the whole app calls people and groups, and how the connector finds the cast on the
            wiki. Blank means Castaway / Tribe. The rules decide how people leave, what scores, and what the wiki and
            research look for.
          </p>
        </div>
      ) : (
        <Button variant="secondary" size="sm" onClick={() => setAddingShow(true)}>
          + Add a show
        </Button>
      )}

      {note && <p className="mt-2 text-sm font-semibold text-good">{note}</p>}
      {error && <p className="mt-2 text-sm font-semibold text-destructive">{error}</p>}
    </div>
  );
}

type Run = (fn: () => Promise<unknown>, note?: string) => Promise<boolean>;

function ShowRow({
  show,
  expanded,
  onToggle,
  busy,
  run,
  refetch,
  models,
}: {
  show: AdminShow;
  expanded: boolean;
  onToggle: () => void;
  busy: boolean;
  run: Run;
  refetch: () => unknown;
  models: Models;
}) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [addingSeason, setAddingSeason] = useState(false);
  const [seasonNumber, setSeasonNumber] = useState("");
  const [wikiUrl, setWikiUrl] = useState("");
  const [status, setStatus] = useState("airing");

  async function addSeason() {
    const n = parseInt(seasonNumber);
    if (!Number.isInteger(n) || n < 1) return;
    const ok = await run(
      () => api.adminCreateSeason(show.id, { seasonNumber: n, wikiUrl: wikiUrl.trim() || undefined, status }),
      `Added season ${n}. Next: pull its cast.`
    );
    if (ok) {
      setSeasonNumber("");
      setWikiUrl("");
      setAddingSeason(false);
    }
  }

  return (
    <div className={cn("rounded-md border border-border p-2.5", show.archived && "opacity-60")}>
      <div className="flex flex-wrap items-center gap-2">
        <button className="flex items-center gap-1.5" onClick={onToggle} title={expanded ? "Hide seasons" : "Show seasons"}>
          <ChevronDownIcon className={cn("h-4 w-4 -rotate-90 text-muted-foreground transition-transform", expanded && "rotate-0")} />
          <span className="text-sm font-bold">{show.name}</span>
        </button>
        {show.archived && <Badge variant="secondary">Archived</Badge>}
        <span className="text-xs text-muted-foreground">
          {show.seasons.length} season{show.seasons.length === 1 ? "" : "s"} · {show.league_count} league
          {show.league_count === 1 ? "" : "s"}
        </span>
        <button className="ml-auto text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline" onClick={() => setSettingsOpen((v) => !v)}>
          {settingsOpen ? "Close settings" : "Settings"}
        </button>
      </div>

      {settingsOpen && <ShowSettings show={show} busy={busy} run={run} />}

      {expanded && (
        <div className="mt-2 flex flex-col gap-2">
          {show.seasons.length === 0 && !addingSeason && (
            <p className="text-xs italic text-muted-foreground">No seasons yet — add one to start pulling its cast.</p>
          )}
          {show.seasons.map((s) => (
            <SeasonCard key={s.id} season={s} busy={busy} run={run} refetch={refetch} models={models} />
          ))}

          {addingSeason || show.seasons.length === 0 ? (
            <div className="rounded-md border border-dashed border-border bg-secondary/40 p-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <Input
                  size="sm"
                  type="number"
                  className="w-20"
                  placeholder="Season #"
                  value={seasonNumber}
                  onChange={(e) => setSeasonNumber(e.target.value)}
                />
                <Input
                  size="sm"
                  className="min-w-[220px] flex-1"
                  placeholder="Wiki page URL, e.g. https://survivor.fandom.com/wiki/Survivor_51"
                  value={wikiUrl}
                  onChange={(e) => setWikiUrl(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addSeason()}
                />
                <Select size="sm" value={status} onChange={(e) => setStatus(e.target.value)}>
                  <option value="airing">Airing</option>
                  <option value="completed">Completed</option>
                  <option value="upcoming">Upcoming</option>
                </Select>
                <Button size="sm" disabled={busy || !seasonNumber} onClick={addSeason}>
                  Add season
                </Button>
                {show.seasons.length > 0 && (
                  <Button variant="secondary" size="sm" onClick={() => setAddingSeason(false)}>
                    Cancel
                  </Button>
                )}
              </div>
              <p className="mt-1 text-[0.7rem] text-muted-foreground">
                Paste the season&rsquo;s wiki page straight from your browser — the connector reads the cast and results
                from it.
              </p>
            </div>
          ) : (
            <div>
              <Button variant="secondary" size="xs" onClick={() => setAddingSeason(true)}>
                + Add a season
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Set-once show configuration. Editable (terminology is what the whole app says AND what the
// connector uses to find the cast section -- a mistake shouldn't mean recreating the show and
// orphaning its leagues), but not something anyone needs to look at week to week.
function ShowSettings({ show, busy, run }: { show: AdminShow; busy: boolean; run: Run }) {
  return (
    <div className="mt-2 flex flex-col gap-2 rounded-md bg-secondary/40 p-2 text-xs">
      <div className="flex flex-wrap items-center gap-1.5">
        <label className="flex items-center gap-1">
          People are called
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
          Groups are called
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
        <label className="flex items-center gap-1" title="How people leave, what scores, and what the wiki and research look for">
          Rules
          <Select
            size="sm"
            value={show.format}
            disabled={busy}
            onChange={async (e) => {
              const next = e.target.value;
              // Switching changes the exit methods and scoring events every league on the show uses
              // from here on. Results already recorded keep their old wording, so say so first.
              if (
                show.league_count > 0 &&
                !(await confirm(
                  `Switch ${show.name} to ${formatFor(next).name} rules? Its ${show.league_count} league` +
                    `${show.league_count === 1 ? "" : "s"} switch too. Results already recorded keep their current wording.`,
                  { confirmLabel: "Switch" }
                ))
              )
                return;
              run(() => api.adminUpdateShow(show.id, { format: next }), `${show.name} now plays by ${formatFor(next).name} rules.`);
            }}
          >
            {formatOptions().map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </Select>
        </label>
      </div>
      {/* Both of these are normally worked out automatically -- the endpoint from the first season
          URL, the heading from the term above -- so they're only here for the wiki that doesn't fit. */}
      <div className="flex flex-wrap items-center gap-1.5">
        <label className="flex min-w-[240px] flex-1 items-center gap-1">
          Wiki API
          <Input
            size="sm"
            className="min-w-[160px] flex-1"
            placeholder="auto — from the first season's URL"
            defaultValue={show.wiki_api_url ?? ""}
            disabled={busy}
            onBlur={(e) => {
              const v = e.target.value.trim();
              if (v !== (show.wiki_api_url ?? "")) run(() => api.adminUpdateShow(show.id, { wikiApiUrl: v }));
            }}
          />
        </label>
        <label className="flex items-center gap-1">
          Cast section heading
          <Input
            size="sm"
            className="w-[140px]"
            placeholder={`auto (${plural(show.castaway_term)})`}
            defaultValue={show.cast_section_heading ?? ""}
            disabled={busy}
            onBlur={(e) => {
              const v = e.target.value.trim();
              if (v !== (show.cast_section_heading ?? "")) run(() => api.adminUpdateShow(show.id, { castSectionHeading: v }));
            }}
          />
        </label>
      </div>
      <label className="flex flex-wrap items-center gap-1">
        <span title="Web research only searches these sites. Fewer, trusted sites means better answers and fewer tokens.">
          Research sites
        </span>
        <Input
          size="sm"
          className="min-w-[200px] flex-1"
          placeholder="default — the wiki plus tvline.com, parade.com"
          defaultValue={(show.research_domains ?? []).join(", ")}
          disabled={busy}
          onBlur={(e) => {
            const v = e.target.value.trim();
            if (v !== (show.research_domains ?? []).join(", ")) run(() => api.adminUpdateShow(show.id, { researchDomains: v }));
          }}
        />
      </label>
      <div className="flex flex-wrap gap-1.5">
        <Button
          variant="secondary"
          size="xs"
          disabled={busy}
          title={show.archived ? "Show it in the league show picker again" : "Hide it from the league show picker; existing leagues keep working"}
          onClick={() =>
            run(
              () => api.adminUpdateShow(show.id, { archived: !show.archived }),
              show.archived ? `Restored ${show.name}.` : `Archived ${show.name} — hidden from the picker.`
            )
          }
        >
          {show.archived ? "Restore show" : "Archive show"}
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
          Delete show
        </Button>
      </div>
    </div>
  );
}

// One season, as the two-step pipeline it is. See the file header for the order and why step 2 is
// locked until the cast is approved.
function SeasonCard({
  season,
  busy,
  run,
  refetch,
  models,
}: {
  season: ShowSeason;
  busy: boolean;
  run: Run;
  refetch: () => unknown;
  models: Models;
}) {
  const label = season.name || `Season ${season.seasonNumber}`;
  const staged = season.castStaged ?? 0;
  const approved = !!season.castApprovedAt;
  const wikiThrough = season.wikiEpisodesThrough ?? null;
  const hasWiki = !!season.wikiPageTitle;

  const [settingsOpen, setSettingsOpen] = useState(false);
  // Opens itself when there's a staged cast waiting on approval: that's the one thing to do next,
  // so it shouldn't be hidden behind a button.
  const [reviewing, setReviewing] = useState(staged > 0 && !approved);
  const pendingDecisions = season.pendingDecisions ?? 0;
  const queryClient = useQueryClient();

  // One in-flight action and one result slot per season. A pull can take a couple of minutes and
  // its result belongs next to the season it was run for, not in the section-wide note.
  const [working, setWorking] = useState<"cast" | "episodes" | "research" | null>(null);
  const [pullResult, setPullResult] = useState<WikiSeasonSyncResult | null>(null);
  const [research, setResearch] = useState<SeasonResearchResult | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [researchingEpisode, setResearchingEpisode] = useState<number | null>(null);

  async function act<T>(kind: "cast" | "episodes" | "research", fn: () => Promise<T>, onDone: (r: T) => void) {
    setWorking(kind);
    setActionError(null);
    setPullResult(null);
    setResearch(null);
    try {
      onDone(await fn());
      await refetch();
      await queryClient.invalidateQueries({ queryKey: ["season-decisions", season.id] });
    } catch (e) {
      setActionError(e instanceof ApiError ? e.message : "That didn't work.");
    } finally {
      setWorking(null);
    }
  }

  const pullCast = (force = false) =>
    act("cast", () => api.adminSyncSeason(season.id, "cast", force, models.wiki), (r) => {
      setPullResult(r);
      setReviewing(true);
    });
  const pullEpisodes = (force = false) =>
    act("episodes", () => api.adminSyncSeason(season.id, "episodes", force, models.wiki), setPullResult);
  const doResearch = async (n: number, force = false) => {
    setResearchingEpisode(n);
    await act("research", () => api.adminResearchEpisode(season.id, n, { force, model: models.research }), setResearch);
    setResearchingEpisode(null);
  };
  // The free path: notes came from the admin's own web-searching chat, not this app's paid search --
  // see api.adminResearchFromPaste and db/episode-research.js's "manual / paste import" section. Same
  // result shape as a searched run, so it reuses `research`/ResearchResult below unchanged.
  const doPasteResearch = async (n: number, notes: string, structured: boolean) => {
    setResearchingEpisode(n);
    await act("research", () => api.adminResearchFromPaste(season.id, n, notes, { model: models.research, structured }), setResearch);
    setResearchingEpisode(null);
  };

  const locked = busy || working !== null;
  const showPaid = useShowPaidAi();

  return (
    <div className="rounded-md border border-border bg-card px-2.5 py-2 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-bold">{label}</span>
        <Badge variant="secondary" className="text-[0.6rem] capitalize">
          {season.status}
        </Badge>
        {season.wikiUrl && (
          <a href={season.wikiUrl} target="_blank" rel="noreferrer" className="text-muted-foreground underline underline-offset-2">
            wiki
          </a>
        )}
        <button className="ml-auto text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline" onClick={() => setSettingsOpen((v) => !v)}>
          {settingsOpen ? "Close settings" : "Settings"}
        </button>
      </div>

      {settingsOpen && <SeasonSettings season={season} busy={busy} run={run} />}

      {!hasWiki && (
        <p className="mt-1.5 font-semibold text-destructive">
          No wiki page yet — add the season&rsquo;s wiki URL in Settings so the connector has something to read.
        </p>
      )}

      {/* Step 1 -- cast */}
      <Step
        n={1}
        title="Cast"
        done={approved}
        status={
          approved
            ? `${staged} approved — in every league on this season`
            : staged
              ? `${staged} pulled — review and approve below`
              : "Not pulled yet"
        }
      >
        {staged === 0 ? (
          <>
            <CostHint title={`Typical cost with ${modelLabel(models.wiki)}`}>{estimate("cast", models.wiki)}</CostHint>
            <Button size="xs" disabled={locked || !hasWiki} onClick={() => pullCast()}>
              {working === "cast" ? "Pulling…" : "Pull cast from wiki"}
            </Button>
          </>
        ) : (
          <>
            <Button variant="secondary" size="xs" title="Free" onClick={() => setReviewing((r) => !r)}>
              {reviewing ? "Hide cast" : "Review cast"}
            </Button>
            <button
              className="text-muted-foreground underline-offset-2 hover:text-foreground hover:underline disabled:opacity-50"
              disabled={locked || !hasWiki}
              title={`Read the cast from the wiki again (e.g. after the page was corrected) — ${estimate("cast", models.wiki)} with ${modelLabel(models.wiki)}`}
              onClick={() => pullCast(true)}
            >
              {working === "cast" ? "Pulling…" : "Re-pull"}
            </button>
            <CostHint>{estimate("cast", models.wiki)}</CostHint>
          </>
        )}
      </Step>
      {reviewing && staged > 0 && (
        <div className="ml-6">
          <SeasonCastReview seasonId={season.id} seasonLabel={label} onChanged={() => refetch()} />
        </div>
      )}

      {/* Step 2 -- episodes. Locked until the cast is approved: results are matched to people by
          name, and before approval there are no names in any league to match. */}
      <Step
        n={2}
        title="Episodes"
        done={false}
        disabled={!approved}
        status={
          !approved
            ? "Approve the cast first — results are matched to it by name"
            : pendingDecisions
              ? `${pendingDecisions} result${pendingDecisions === 1 ? "" : "s"} to review below`
              : wikiThrough
                ? `Wiki results through episode ${wikiThrough}`
                : "No results pulled yet"
        }
      >
        {approved && showPaid && (
          <>
            <CostHint title={`Typical cost with ${modelLabel(models.wiki)}. Free when the wiki hasn't changed since the last pull — nothing is sent to the model.`}>
              {estimate("episodes", models.wiki)} · free if unchanged
            </CostHint>
            <Button variant="secondary" size="xs" disabled={locked || !hasWiki} onClick={() => pullEpisodes()}>
              {working === "episodes" ? "Pulling…" : "Pull results from wiki"}
            </Button>
          </>
        )}
      </Step>

      {working && (
        <p className="mt-1.5 italic text-muted-foreground">
          {working === "research"
            ? "Searching the web and answering the checklist — tens of seconds. Leave this open."
            : "Reading the wiki — seconds for a cast, up to a couple of minutes for a season of results. Leave this open."}
        </p>
      )}
      {actionError && <p className="mt-1.5 font-semibold text-destructive">{actionError}</p>}
      {pullResult && pullResult.kind === "episodes" && (
        <PullResult result={pullResult} busy={locked} onForce={() => pullEpisodes(true)} forceCost={estimate("episodes", models.wiki)} />
      )}
      {pullResult && pullResult.kind === "cast" && pullResult.staged && (
        <p className="ml-6 mt-1 text-muted-foreground">
          {pullResult.staged.summary} <SpentNote model={pullResult.model} usage={pullResult.usage} cached={pullResult.cached} />
        </p>
      )}
      {research && (
        <ResearchResult
          research={research}
          busy={locked}
          onForce={() => doResearch(research.episode, true)}
          forceCost={estimate("research", models.research)}
        />
      )}
      {/* The season's episodes, each with what to do next -- the main path through step 2. */}
      {approved && (
        <SeasonEpisodes
          season={season}
          researching={researchingEpisode}
          locked={locked}
          onResearch={(n, force) => doResearch(n, force)}
          onPasteResearch={(n, notes, structured) => doPasteResearch(n, notes, structured)}
          onChanged={() => refetch()}
        />
      )}
    </div>
  );
}

function Step({
  n,
  title,
  status,
  done,
  disabled,
  children,
}: {
  n: number;
  title: string;
  status: string;
  done: boolean;
  disabled?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className={cn("mt-2 flex flex-wrap items-center gap-2", disabled && "opacity-60")}>
      <span
        className={cn(
          "flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[0.6rem] font-bold",
          done ? "bg-good text-white" : "bg-secondary text-foreground"
        )}
      >
        {done ? "✓" : n}
      </span>
      <span className="font-bold">{title}</span>
      <span className="text-muted-foreground">{status}</span>
      <span className="ml-auto flex flex-wrap items-center gap-1.5">{children}</span>
    </div>
  );
}

// Per-season settings: the things set once when a season is catalogued and rarely again.
function SeasonSettings({ season, busy, run }: { season: ShowSeason; busy: boolean; run: Run }) {
  return (
    <div className="mt-2 flex flex-col gap-2 rounded-md bg-secondary/40 p-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <label className="flex items-center gap-1">
          Status
          <Select
            size="sm"
            value={season.status}
            disabled={busy}
            onChange={(e) => run(() => api.adminUpdateSeason(season.id, { status: e.target.value }))}
          >
            <option value="airing">Airing</option>
            <option value="completed">Completed</option>
            <option value="upcoming">Upcoming</option>
          </Select>
        </label>
        <label className="flex items-center gap-1">
          Name
          <Input
            size="sm"
            className="w-[140px]"
            placeholder={`Season ${season.seasonNumber}`}
            defaultValue={season.name ?? ""}
            disabled={busy}
            onBlur={(e) => {
              const v = e.target.value.trim();
              if (v !== (season.name ?? "")) run(() => api.adminUpdateSeason(season.id, { name: v }));
            }}
          />
        </label>
        <label className="flex min-w-[240px] flex-1 items-center gap-1">
          Wiki URL
          <Input
            size="sm"
            className="min-w-[160px] flex-1"
            placeholder="https://survivor.fandom.com/wiki/Survivor_51"
            defaultValue={season.wikiUrl ?? ""}
            disabled={busy}
            onBlur={(e) => {
              const v = e.target.value.trim();
              if (v !== (season.wikiUrl ?? "")) run(() => api.adminUpdateSeason(season.id, { wikiUrl: v }));
            }}
          />
        </label>
      </div>
      <div>
        <Button
          variant="destructive"
          size="xs"
          disabled={busy}
          onClick={async () => {
            const ok = await confirm(
              `Delete season ${season.seasonNumber}? This clears its cast, cached wiki results, research, and every ` +
                `pending review item it produced, so you can start it over. Leagues on the season keep their own ` +
                `cast, episodes and scores.`,
              { danger: true, confirmLabel: "Delete season" }
            );
            if (!ok) return;
            await run(async () => {
              const res = await api.adminDeleteSeason(season.id);
              if (res.leaguesAffected > 0) {
                alert(
                  `Deleted. ${res.leaguesAffected} league${res.leaguesAffected === 1 ? " still points" : "s still point"} at ` +
                    `season ${season.seasonNumber} — re-add the season and they'll pick it back up.`
                );
              }
            }, `Deleted season ${season.seasonNumber}.`);
          }}
        >
          Delete season
        </Button>
      </div>
    </div>
  );
}

// What an episodes pull did: one line of outcome, the per-league breakdown behind a toggle, and any
// league that failed always visible -- a failure is the one part nobody should have to click to see.
// What a finished call actually cost, from the usage the API reported -- next to each result.
function SpentNote({ model, usage, cached }: { model?: string | null; usage?: ModelUsage | null; cached: boolean }) {
  if (cached) return <CostHint title="Nothing was sent to the model">· free (nothing new to read)</CostHint>;
  const usd = costOf(model, usage);
  if (usd == null) return null;
  const tokens = usage ? `${usage.input_tokens} in / ${usage.output_tokens} out` : "";
  const searches = usage?.web_search_requests ? `, ${usage.web_search_requests} searches` : "";
  return (
    <CostHint title={`${modelLabel(model)}: ${tokens} tokens${searches}`}>
      · cost {formatCost(usd)} ({modelLabel(model)})
    </CostHint>
  );
}

function PullResult({
  result,
  busy,
  onForce,
  forceCost,
}: {
  result: WikiSeasonSyncResult;
  busy: boolean;
  onForce: () => void;
  forceCost: string;
}) {
  const d = result.decisions;
  const showPaid = useShowPaidAi();
  return (
    <div className="ml-6 mt-1.5 rounded border border-dashed border-border bg-secondary/40 p-1.5 text-[0.7rem]">
      <p>
        {result.cached ? "Wiki unchanged since the last read." : "Read fresh from the wiki."}{" "}
        <SpentNote model={result.model} usage={result.usage} cached={result.cached} />{" "}
        {d && (d.inserted ? `${d.inserted} new result${d.inserted === 1 ? "" : "s"} to review below.` : "Nothing new to review.")}
        {d?.withdrawn ? ` ${d.withdrawn} withdrawn (no longer on the wiki).` : ""}
        {/* The only way past the revision-id cache: offered only when the cache was hit, the one case
            where pulling again would otherwise do nothing. */}
        {result.cached && showPaid && (
          <Button variant="secondary" size="xs" className="ml-1.5" disabled={busy} onClick={onForce}>
            Extract again anyway
          </Button>
        )}
        {result.cached && showPaid && (
          <span className="ml-1">
            <CostHint>{forceCost}</CostHint>
          </span>
        )}
      </p>
      {d?.unmatched?.length ? (
        <p className="mt-0.5 text-destructive">
          Couldn&rsquo;t match to the cast, so dropped: {d.unmatched.join(", ")}. Fix the name in the cast, then pull again.
        </p>
      ) : null}
      {d?.dropped?.length ? (
        <p className="mt-0.5 text-muted-foreground">
          Thrown out as impossible: {d.dropped.map((x) => `${x.name} (ep ${x.episode}: ${x.why})`).join("; ")}.
        </p>
      ) : null}
    </div>
  );
}

// What one episode's research found. The summary line says what happened to the RESULTS (they're now
// review items on each league's episode card, which is where they get confirmed); the full checklist
// is behind a toggle, since checking it item by item happens on the episode card anyway.
//
// When opened it lists EVERY castaway, including the ones nothing was found for -- a quiet row means
// "asked, nothing found", and telling that apart from "never asked" is the whole point of the
// checklist (the bug this app hit twice: a castaway who took votes and survived silently vanished).
function ResearchResult({
  research,
  busy,
  onForce,
  forceCost,
}: {
  research: SeasonResearchResult;
  busy: boolean;
  onForce: () => void;
  forceCost: string;
}) {
  const [open, setOpen] = useState(false);
  const showPaid = useShowPaidAi();
  const { payload, provenance, counts, problems } = research;
  // The answers are the checklist of the format they were asked under.
  const notesFor = (c: ResearchCastaway) => formatFor(provenance.format).research.notes(c);
  const noted = payload.castaways.filter((c) => notesFor(c).length > 0);
  const quiet = payload.castaways.filter((c) => notesFor(c).length === 0);
  const newItems = research.decisions?.inserted ?? 0;

  return (
    <div className="ml-6 mt-1.5 rounded border border-dashed border-border bg-secondary/40 p-1.5 text-[0.7rem]">
      <p>
        <b>
          Episode {research.episode}
          {payload.episodeTitle ? `: ${payload.episodeTitle}` : ""}
        </b>{" "}
        — {research.cached ? "already researched, reused" : "researched"}. {noted.length} of {counts.castaways} had
        something notable; {newItems ? `${newItems} new result${newItems === 1 ? "" : "s"} to review below` : "nothing new to review"}.{" "}
        {provenance.pasteMode === "json" ? (
          <CostHint title="Pasted as JSON and parsed directly — nothing was sent to a model">· free (parsed JSON)</CostHint>
        ) : (
          <SpentNote model={provenance.model} usage={provenance.usage} cached={research.cached} />
        )}
        <button className="ml-1 underline" onClick={() => setOpen((v) => !v)}>
          {open ? "hide details" : "details"}
        </button>
        {/* Offered whenever paid actions are: with no revision id to cache on, a re-run genuinely
            reads different pages. */}
        {showPaid && (
          <>
            <Button variant="secondary" size="xs" className="ml-1.5" disabled={busy} onClick={onForce}>
              Research again
            </Button>
            <span className="ml-1">
              <CostHint>{forceCost}</CostHint>
            </span>
          </>
        )}
      </p>
      {provenance.domainsBlocked?.length ? (
        <p className="mt-0.5 text-muted-foreground">
          {provenance.domainsBlocked.join(", ")} block{provenance.domainsBlocked.length === 1 ? "s" : ""} Anthropic&rsquo;s
          search, so {provenance.domainsBlocked.length === 1 ? "it was" : "they were"} skipped — remove from the show&rsquo;s
          research sites in Settings.
        </p>
      ) : null}
      {problems.length > 0 && (
        <ul className="mt-0.5 text-destructive">
          {problems.map((p) => (
            <li key={p}>! {p}</li>
          ))}
        </ul>
      )}
      {open && (
        <>
          <p className="mt-1">{payload.summary}</p>
          <ul className="mt-1 flex flex-col gap-0.5">
            {noted.map((c) => (
              <li key={c.name} className="flex flex-wrap items-baseline gap-1">
                <Badge
                  variant={c.confidence === "high" ? "default" : c.confidence === "medium" ? "secondary" : "outline"}
                  className="h-4 text-[0.6rem]"
                >
                  {c.confidence}
                </Badge>
                <b>{c.name}</b>
                <span>{notesFor(c).join("; ")}</span>
                {c.sources.length ? (
                  <span className="text-muted-foreground">
                    {c.sources.map((url, i) => (
                      <a key={url} href={url} target="_blank" rel="noreferrer" className="ml-1 underline underline-offset-2" title={url}>
                        [{i + 1}]
                      </a>
                    ))}
                  </span>
                ) : (
                  <span className="font-semibold text-destructive">no source</span>
                )}
              </li>
            ))}
          </ul>
          {provenance.castSkipped?.length ? (
            <p className="mt-1 text-muted-foreground">
              <b>Not asked (already out):</b> {provenance.castSkipped.join(", ")}
            </p>
          ) : null}
          {quiet.length > 0 && (
            <p className="mt-1 text-muted-foreground">
              <b>Asked, nothing found:</b> {quiet.map((c) => c.name).join(", ")}
            </p>
          )}
          {(payload.betAnswers || []).length > 0 && (
            <div className="mt-1">
              <b>Side bets settled</b> (shown to commissioners when they grade):
              <ul className="ml-4 list-disc">
                {(payload.betAnswers || []).map((b) => (
                  <li key={b.question}>
                    {b.question} — <b>{b.answer ?? "couldn’t tell"}</b>
                    {b.answer && <span className="text-muted-foreground"> ({b.confidence})</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className="mt-1 text-muted-foreground">
            <code className="font-mono">
              {provenance.provider}/{provenance.model ?? "no model"}
            </code>{" "}
            · {counts.sourced} sourced · {counts.lowConfidence} low-confidence · {counts.unknowns} unknown ·{" "}
            {provenance.provider === "paste" ? (
              <span title={provenance.pastedNotes} className="underline decoration-dotted">
                {provenance.pasteMode === "json" ? "pasted JSON, parsed directly" : "pasted notes, structured (no search)"}
              </span>
            ) : (
              <>
                <span title={provenance.pagesRead.join("\n")} className="underline decoration-dotted">
                  {provenance.pagesRead.length} pages read
                </span>
                {provenance.domains?.length ? (
                  <>
                    {" "}
                    ·{" "}
                    <span title={provenance.domains.join("\n")} className="underline decoration-dotted">
                      {provenance.domains.length} trusted sites
                    </span>
                  </>
                ) : null}
              </>
            )}
          </p>
        </>
      )}
    </div>
  );
}
