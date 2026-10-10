"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronRight, X } from "lucide-react";
import type { LeagueDecisionSync, SeasonDecision, SeasonDecisionsResponse } from "@/lib/game/types";
import type { GameFormat } from "@/lib/game/formats/index.js";
import { formatFor, withChanges } from "@/lib/game/formats/index.js";
import { api } from "@/lib/api";
import { confirm } from "@/lib/confirm-store";
import { useShowSpoilers } from "@/lib/paid-ai-store";
import { CastawayAvatar } from "@/components/castaway-avatar";
import { BottomSheet, SheetAction } from "@/components/ui/bottom-sheet";
import { Chip, PrimaryButton, fieldCls } from "@/components/setup/settings-ui";
import { ActButton, AdminPage, Notice, Row, Rows, Section, Segmented, StickyBar, count, errorText, seasonShort, useAdminSeason } from "./admin-ui";
import { syncSummary } from "./admin-results";
import { cn } from "cn";

// One episode's results, decided once here for every league playing the season (db/migrations/0019;
// the canvas's Admin-Approve; docs/PLAN-ux-redesign.md 3d). Its own page now, not a panel four levels
// down an accordion.
//
// Order: what needs a look first -- low confidence, or a name that isn't in the cast -- each with
// Accept and Reject right on the row; then everything else as one row per kind of result ("Tribal
// Council 6"), opening to its people. One sticky Accept all. Tapping any result opens a sheet with its
// sources, who decided it, and Correct...
//
// Both connectors stage into this list -- the wiki's tables and web research -- and a fact they both
// report is one row marked with both. Accepting applies it to every league on the season right away (a
// catching-up league gets it when it reveals that episode); rejecting or correcting an accepted row
// undoes it everywhere. Decided rows stay listed, so this is also the episode's permanent record.
//
// Spoilers: with "Show episode results" off (Site), the page opens with names hidden -- counts only,
// and Accept all still works -- and "Show names" reveals this episode alone.
//
// CURATOR MODE, for a league-decided season (show_seasons.results_by = 'leagues'; docs/PLAN-universal-
// season-cast.md, piece 5). Nothing here reaches a league -- each commissioner applies results to their
// own -- so Flag as wrong (reject) and Correct... fix the SHARED row every commissioner's research panel
// reads, and Confirm just marks it checked. There's no Accept all (nothing to push), and each result
// says which leagues already have it, so a result no league applied stands out.

type Cast = SeasonDecisionsResponse["cast"][number];

const nameOf = (d: SeasonDecision) => d.applied?.castawayName || d.castaway_name;

function castFor(cast: Cast[], name: string): Cast | null {
  const lower = name.trim().toLowerCase();
  return cast.find((c) => c.name.toLowerCase() === lower) ?? null;
}

function labelFor(d: SeasonDecision, format: GameFormat): string {
  if (d.kind === "elimination") {
    const method = d.applied?.method || d.method;
    return typeof d.jury_votes === "number" ? `${method} · ${count(d.jury_votes, "jury vote")}` : method;
  }
  if (d.kind === "exiled") return "Exile Island";
  if (d.kind === "role") return `Became ${d.applied?.method || d.method}`;
  if (d.kind === "group") {
    const group = d.applied && d.applied.method !== undefined ? d.applied.method : d.method;
    return group ? `Moved to ${group}` : "Left their team";
  }
  const type = d.applied?.eventType || d.event_type;
  return format.events.find((e) => e.id === type)?.label ?? type;
}

function sourcesOf(d: SeasonDecision): string {
  return d.from_wiki && d.from_research ? "Wiki and research" : d.from_wiki ? "Wiki only" : "Research only";
}

// Low confidence, or a name nobody in the cast has: the two things worth a person's eyes.
function needsLook(d: SeasonDecision, cast: Cast[]) {
  return d.status === "pending" && (d.confidence === "low" || !castFor(cast, nameOf(d)));
}

// An episode's results grouped by what happened -- who left, then each scoring event in the show's rule
// order, then team changes -- so an event a whole tribe shares reads as one row. Within a group, by tribe
// then name.
function groupByScoringEvent(decisions: SeasonDecision[], cast: Cast[], format: GameFormat) {
  const tribes = [...new Set(cast.map((c) => c.tribeName).filter(Boolean))] as string[];
  const tribeRank = (d: SeasonDecision) => {
    const t = castFor(cast, nameOf(d))?.tribeName;
    return t ? tribes.indexOf(t) : 999;
  };
  const groups = new Map<string, { key: string; title: string; rank: number; rows: SeasonDecision[] }>();
  for (const d of decisions) {
    let key: string, title: string, rank: number;
    if (d.kind === "elimination") [key, title, rank] = ["elimination", "Left the game", 0];
    else if (d.kind === "role") {
      const role = d.applied?.method || d.method;
      [key, title, rank] = [`role:${role}`, `Became ${role}`, 1];
    } else if (d.kind === "exiled") [key, title, rank] = ["exiled", "Exile Island", 2];
    else if (d.kind === "group") [key, title, rank] = ["group", "Team changes", 10_000];
    else {
      const type = d.applied?.eventType || d.event_type;
      const i = format.events.findIndex((e) => e.id === type);
      [key, title, rank] = [`event:${type}`, labelFor(d, format), 3 + (i < 0 ? 5_000 : i)];
    }
    const g = groups.get(key);
    if (g) g.rows.push(d);
    else groups.set(key, { key, title, rank, rows: [d] });
  }
  return [...groups.values()]
    .sort((a, b) => a.rank - b.rank || a.title.localeCompare(b.title))
    .map((g) => ({ ...g, rows: g.rows.sort((a, b) => tribeRank(a) - tribeRank(b) || nameOf(a).localeCompare(nameOf(b))) }));
}

export function EpisodeReview({ seasonId, episode }: { seasonId: string; episode: number }) {
  const queryClient = useQueryClient();
  const { show, season, isLoading } = useAdminSeason(seasonId);
  const { data, refetch } = useQuery({ queryKey: ["season-decisions", seasonId], queryFn: () => api.adminListDecisions(seasonId) });
  const globalSpoilers = useShowSpoilers();
  // Null follows Site's "Show episode results"; either side of the switch reveals or hides this page only.
  const [reveal, setReveal] = useState<boolean | null>(null);
  const shown = reveal ?? globalSpoilers;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sync, setSync] = useState<{ text: string; problems: string[] } | null>(null);
  const [sheetId, setSheetId] = useState<string | null>(null);

  if (isLoading || !data) return <p className="text-muted-foreground">Loading…</p>;
  if (!show || !season) return <p className="text-muted-foreground">That season doesn&rsquo;t exist any more.</p>;

  const cast = data.cast;
  const format = withChanges(formatFor(data.format, data.formatData), data.ruleChanges);
  const curator = data.resultsBy === "leagues";
  const decisions = data.decisions.filter((d) => d.episode_number === episode);
  const pending = decisions.filter((d) => d.status === "pending");
  const accepted = decisions.filter((d) => d.status === "accepted").length;
  const rejected = decisions.filter((d) => d.status === "rejected").length;
  const look = decisions.filter((d) => needsLook(d, cast));
  const groups = groupByScoringEvent(
    decisions.filter((d) => !needsLook(d, cast)),
    cast,
    format,
  );
  const sheetDecision = decisions.find((d) => d.id === sheetId) ?? null;
  const base = `/admin/seasons/${season.id}`;
  // Curator mode: results no league has, once some league has started applying this episode -- before
  // that, "nobody applied it" says nothing.
  const anyApplied = curator && decisions.some((d) => (d.in_leagues?.length ?? 0) > 0);
  const unapplied = anyApplied ? decisions.filter((d) => d.status !== "rejected" && !(d.in_leagues?.length ?? 0)).length : 0;

  async function synced(leagues: LeagueDecisionSync[]) {
    setSync(syncSummary(leagues, shown));
    await refetch();
    await queryClient.invalidateQueries({ queryKey: ["admin-shows"] });
  }

  async function run(fn: () => Promise<{ leagues: LeagueDecisionSync[] }>) {
    setBusy(true);
    setError(null);
    setSync(null);
    try {
      await synced((await fn()).leagues);
      return true;
    } catch (e) {
      setError(errorText(e));
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function acceptAll(ids?: string[]) {
    // With names hidden, accepting everything includes the ones nobody's looked at: say so first.
    if (!ids && !shown && look.length > 0) {
      const ok = await confirm(`${count(look.length, "result")} of these ${look.length === 1 ? "needs" : "need"} a look (low confidence, or not in the cast). Accept all anyway?`, {
        confirmLabel: "Accept all",
      });
      if (!ok) return;
    }
    run(() => api.adminAcceptEpisode(seasonId, episode, ids));
  }

  const decide = (d: SeasonDecision, action: "accept" | "reject", edits?: { castawayName?: string; method?: string; eventType?: string }) =>
    run(() => api.adminDecide(seasonId, d.id, action, edits)).then((ok) => ok && setSheetId(null));

  const tally = [pending.length && `${pending.length} pending`, accepted && `${accepted} ${curator ? "confirmed" : "accepted"}`, rejected && `${rejected} ${curator ? "flagged" : "rejected"}`]
    .filter(Boolean)
    .join(" · ");

  return (
    <AdminPage
      title={`Episode ${episode} results`}
      subtitle={`${seasonShort(show, season)} · ${tally || "nothing staged"}`}
      back={{ href: `${base}/episodes/${episode}`, label: `Episode ${episode}` }}
    >
      <Segmented
        label="Names"
        value={shown ? "shown" : "hidden"}
        options={[
          ["hidden", "Spoilers hidden"],
          ["shown", "Show names"],
        ]}
        onChange={(v) => setReveal(v === "shown")}
      />

      {unapplied > 0 && (
        <Notice tone="bad">{count(unapplied, "result")} no league has applied. That&rsquo;s often a rule problem: check the show&rsquo;s rules.</Notice>
      )}
      {error && <Notice tone="bad">{error}</Notice>}
      {sync && (
        <div className="flex flex-col gap-1">
          <Notice>{sync.text}</Notice>
          {sync.problems.map((p) => (
            <Notice key={p} tone="bad">
              {p}
            </Notice>
          ))}
        </div>
      )}

      {decisions.length === 0 ? (
        <p className="text-muted-foreground">Nothing staged for this episode. Pull the wiki, research it or paste research from its page.</p>
      ) : !shown ? (
        // Spoiler-free: the episode by the count, eliminations, events, roles and team changes alike.
        <Section title="This episode">
          <Rows>
            <Row title="To review" trailing={<span className="type-num text-[26px]">{pending.length}</span>} />
            <Row
              title="Need a look"
              detail="Low confidence, or a name that isn't in the cast"
              trailing={<span className="type-num text-[26px]">{look.length}</span>}
            />
            <Row title={curator ? "Confirmed" : "Accepted"} trailing={<span className="type-num text-[26px] text-muted-foreground">{accepted}</span>} />
            {rejected > 0 && <Row title={curator ? "Flagged" : "Rejected"} trailing={<span className="type-num text-[26px] text-muted-foreground">{rejected}</span>} />}
          </Rows>
          <p className="text-[13px] leading-snug text-muted-foreground">
            Who and what stay hidden. {curator ? "" : "Accept all takes them as proposed; "}Show names to check them one by one.
          </p>
        </Section>
      ) : (
        <>
          {look.length > 0 && (
            <Section title="Needs a look">
              <Rows>
                {look.map((d) => (
                  <LookRow
                    key={d.id}
                    d={d}
                    cast={cast}
                    format={format}
                    busy={busy}
                    curator={curator}
                    onOpen={() => setSheetId(d.id)}
                    onDecide={(a) => decide(d, a)}
                  />
                ))}
              </Rows>
            </Section>
          )}
          {groups.length > 0 && (
            <Section title={look.length ? "Ready" : "Results"}>
              <Rows>
                {groups.map((g) => (
                  <GroupRow
                    key={g.key}
                    title={g.title}
                    rows={g.rows}
                    cast={cast}
                    format={format}
                    curator={curator}
                    busy={busy}
                    onOpen={setSheetId}
                    onAccept={(ids) => acceptAll(ids)}
                  />
                ))}
              </Rows>
            </Section>
          )}
        </>
      )}

      {pending.length > 0 && !curator && (
        <StickyBar note={`Accepting sends results to ${count(data.leagueCount, "league")}`}>
          <ActButton tone="chyron" disabled={busy} onClick={() => acceptAll()} className="min-h-12">
            {busy ? "Accepting…" : `Accept all ${pending.length}`}
          </ActButton>
        </StickyBar>
      )}

      {sheetDecision && (
        <DecisionSheet
          key={sheetDecision.id}
          d={sheetDecision}
          cast={cast}
          format={format}
          leagueCount={data.leagueCount}
          curator={curator}
          busy={busy}
          onDecide={(a, edits) => decide(sheetDecision, a, edits)}
          onClose={() => setSheetId(null)}
        />
      )}
    </AdminPage>
  );
}

function Face({ d, cast, size = 40 }: { d: SeasonDecision; cast: Cast[]; size?: number }) {
  const member = castFor(cast, nameOf(d));
  if (!member) {
    return (
      <span className="flex shrink-0 items-center justify-center rounded-[2px] bg-live text-sm font-bold text-live-foreground" style={{ width: size, height: size }} aria-label="Not in the cast">
        ?
      </span>
    );
  }
  return (
    <span className="inline-flex shrink-0" style={{ width: size, height: size }}>
      <CastawayAvatar
        castaway={{ name: member.name, photoUrl: member.photoUrl ?? undefined }}
        className="flex size-full items-center justify-center rounded-[2px] bg-muted text-[11px] font-bold text-muted-foreground [&_img]:object-top"
      />
    </span>
  );
}

function LookRow({
  d,
  cast,
  format,
  busy,
  curator,
  onOpen,
  onDecide,
}: {
  d: SeasonDecision;
  cast: Cast[];
  format: GameFormat;
  busy: boolean;
  curator: boolean;
  onOpen: () => void;
  onDecide: (action: "accept" | "reject") => void;
}) {
  const inCast = !!castFor(cast, nameOf(d));
  const why = [!inCast ? "Not in the cast" : sourcesOf(d), d.confidence === "low" && "low confidence"].filter(Boolean).join(" · ");
  return (
    <div className="flex min-h-[64px] items-center gap-1 py-1.5">
      <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-3 self-stretch text-left outline-none focus-visible:bg-accent">
        <Face d={d} cast={cast} />
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="text-base font-semibold">
            {nameOf(d)} <span className="font-normal text-muted-foreground">· {labelFor(d, format)}</span>
          </span>
          <span className="text-[13px] font-semibold text-accent-2">{why}</span>
        </span>
      </button>
      <button
        type="button"
        aria-label={`${curator ? "Flag" : "Reject"} ${nameOf(d)}`}
        disabled={busy}
        onClick={() => onDecide("reject")}
        className="flex size-11 shrink-0 items-center justify-center rounded-[3px] text-live hover:bg-live/10 disabled:opacity-40"
      >
        <X className="size-6" strokeWidth={2.6} aria-hidden />
      </button>
      <button
        type="button"
        aria-label={`${curator ? "Confirm" : "Accept"} ${nameOf(d)}`}
        disabled={busy || !inCast}
        onClick={() => onDecide("accept")}
        className="flex size-11 shrink-0 items-center justify-center rounded-[3px] text-good hover:bg-good/10 disabled:opacity-30"
      >
        <Check className="size-6" strokeWidth={2.6} aria-hidden />
      </button>
    </div>
  );
}

function GroupRow({
  title,
  rows,
  cast,
  format,
  curator,
  busy,
  onOpen,
  onAccept,
}: {
  title: string;
  rows: SeasonDecision[];
  cast: Cast[];
  format: GameFormat;
  curator: boolean;
  busy: boolean;
  onOpen: (id: string) => void;
  onAccept: (ids: string[]) => void;
}) {
  const pendingIds = rows.filter((d) => d.status === "pending").map((d) => d.id);
  // Pending ones and anything small start open; a big decided group is one line.
  const [open, setOpen] = useState(rows.length <= 2 && pendingIds.length > 0);
  const accepted = rows.filter((d) => d.status === "accepted");
  const rejected = rows.length - pendingIds.length - accepted.length;
  const deciders = [...new Set(accepted.map((d) => d.decided_by_name).filter(Boolean))];
  const detail = pendingIds.length
    ? `${pendingIds.length} pending · ${rows.every((d) => d.from_wiki && d.from_research) ? "wiki and research agree" : rows.every((d) => d.from_wiki) ? "from the wiki" : "from research"}`
    : rejected === 0
      ? `All ${curator ? "confirmed" : "accepted"}${deciders.length === 1 ? ` by ${deciders[0]}` : ""}`
      : `${accepted.length} ${curator ? "confirmed" : "accepted"}, ${rejected} ${curator ? "flagged" : "rejected"}`;
  return (
    <div>
      <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)} className="flex min-h-[56px] w-full items-center gap-3 py-2 text-left outline-none focus-visible:bg-accent">
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-base font-semibold">
            {title} <span className="font-medium text-muted-foreground">{rows.length}</span>
          </span>
          <span className="text-[13px] text-muted-foreground">{detail}</span>
        </span>
        <ChevronRight className={cn("size-5 shrink-0 text-muted-foreground transition-transform", open && "rotate-90")} strokeWidth={2.2} aria-hidden />
      </button>
      {open && (
        <div className="flex flex-col pb-3">
          {rows.map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => onOpen(d.id)}
              className="flex min-h-[48px] items-center gap-3 border-t border-border/60 py-1.5 pl-1 text-left outline-none focus-visible:bg-accent"
            >
              <Face d={d} cast={cast} size={32} />
              <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">
                {nameOf(d)}
                {d.kind !== "event" && d.kind !== "exiled" && <span className="font-normal text-muted-foreground"> · {labelFor(d, format)}</span>}
              </span>
              <StatusChip d={d} curator={curator} />
            </button>
          ))}
          {pendingIds.length > 1 && !curator && (
            <ActButton disabled={busy} onClick={() => onAccept(pendingIds)} className="mt-2 self-start">
              Accept these {pendingIds.length}
            </ActButton>
          )}
        </div>
      )}
    </div>
  );
}

function StatusChip({ d, curator }: { d: SeasonDecision; curator: boolean }) {
  if (d.status === "pending") return <Chip>Pending</Chip>;
  if (d.status === "rejected") return <Chip tone="live">{curator ? "Flagged" : "Rejected"}</Chip>;
  return (
    <span className="shrink-0 rounded-[2px] bg-good px-1.5 py-px text-[11px] font-bold uppercase tracking-wide text-good-foreground">
      {curator ? (d.applied ? "Corrected" : "Confirmed") : "Accepted"}
    </span>
  );
}

const CONFIDENCE: Record<SeasonDecision["confidence"], string> = {
  high: "High: stated plainly by the source",
  medium: "Medium: implied by the source",
  low: "Low: inferred, or from one weak source",
};

/** One result: where it came from, who decided it, and Accept / Correct... / Reject. */
function DecisionSheet({
  d,
  cast,
  format,
  leagueCount,
  curator,
  busy,
  onDecide,
  onClose,
}: {
  d: SeasonDecision;
  cast: Cast[];
  format: GameFormat;
  leagueCount: number;
  curator: boolean;
  busy: boolean;
  onDecide: (action: "accept" | "reject", edits?: { castawayName?: string; method?: string; eventType?: string }) => void;
  onClose: () => void;
}) {
  const member = castFor(cast, nameOf(d));
  const [editing, setEditing] = useState(!member);
  const [castawayName, setCastawayName] = useState(member?.name ?? "");
  // An exit method for an elimination, a role value for a role; a team change's name is typed, since a
  // correction can name a team the season hasn't had yet.
  const methodChoices = d.kind === "role" ? (format.roles?.values ?? []) : format.exitMethods;
  const eventChoices = format.events.filter((e) => !e.implied);
  const [method, setMethod] = useState(
    d.kind === "group" ? ((d.applied && d.applied.method !== undefined ? d.applied.method : d.method) ?? "") : d.applied?.method || d.method || methodChoices[0],
  );
  const [eventType, setEventType] = useState(d.applied?.eventType || d.event_type || eventChoices[0]?.id);
  const decided =
    d.status === "pending"
      ? null
      : `${d.status === "accepted" ? (curator ? "Confirmed" : "Accepted") : curator ? "Flagged" : "Rejected"}${d.decided_by_name ? ` by ${d.decided_by_name}` : ""}${
          d.decided_at ? `, ${new Date(d.decided_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}` : ""
        }`;
  const reach = curator ? (d.in_leagues?.length ?? 0) : d.status === "accepted" ? d.applied_leagues : null;

  return (
    <BottomSheet open onOpenChange={(o) => !o && onClose()} title={nameOf(d)} description={labelFor(d, format)}>
      <dl className="mb-3 flex flex-col gap-1 border-t border-border pt-3 text-sm">
        <div className="flex gap-2">
          <dt className="w-24 shrink-0 text-muted-foreground">From</dt>
          <dd>
            {sourcesOf(d)}
            {d.sources.map((url, i) => (
              <a key={url} href={url} target="_blank" rel="noreferrer" className="ml-1.5 underline underline-offset-2" title={url}>
                [{i + 1}]
              </a>
            ))}
          </dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-24 shrink-0 text-muted-foreground">Confidence</dt>
          <dd>{CONFIDENCE[d.confidence]}</dd>
        </div>
        {!member && (
          <div className="flex gap-2">
            <dt className="w-24 shrink-0 text-muted-foreground">Cast</dt>
            <dd className="font-semibold text-destructive">Not in the cast. Pick who it was below.</dd>
          </div>
        )}
        {d.applied && (
          <div className="flex gap-2">
            <dt className="w-24 shrink-0 text-muted-foreground">Corrected</dt>
            <dd>Was {d.castaway_name}</dd>
          </div>
        )}
        {decided && (
          <div className="flex gap-2">
            <dt className="w-24 shrink-0 text-muted-foreground">Decided</dt>
            <dd>{decided}</dd>
          </div>
        )}
        {reach !== null && (
          <div className="flex gap-2">
            <dt className="w-24 shrink-0 text-muted-foreground">In leagues</dt>
            <dd title={d.in_leagues?.join(", ")}>
              {reach} of {leagueCount}
            </dd>
          </div>
        )}
      </dl>

      {editing ? (
        <div className="flex flex-col gap-3 border-t border-border py-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold">Who was it?</span>
            <select className={fieldCls} value={castawayName} onChange={(e) => setCastawayName(e.target.value)}>
              <option value="">Choose…</option>
              {cast.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          {(d.kind === "elimination" || d.kind === "role") && (
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-semibold">{d.kind === "role" ? "Role" : "How they left"}</span>
              <select className={fieldCls} value={method} onChange={(e) => setMethod(e.target.value)}>
                {methodChoices.map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            </label>
          )}
          {d.kind === "group" && (
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-semibold">Moved to</span>
              <input className={fieldCls} placeholder="Blank for no team" value={method} onChange={(e) => setMethod(e.target.value)} />
            </label>
          )}
          {d.kind === "event" && (
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-semibold">What happened</span>
              <select className={fieldCls} value={eventType} onChange={(e) => setEventType(e.target.value)}>
                {eventChoices.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.label}
                  </option>
                ))}
              </select>
            </label>
          )}
          <PrimaryButton
            disabled={busy || !castawayName}
            onClick={() =>
              onDecide("accept", {
                castawayName,
                method: d.kind === "elimination" || d.kind === "role" || d.kind === "group" ? method : undefined,
                eventType: d.kind === "event" ? eventType : undefined,
              })
            }
          >
            {curator ? "Save correction" : "Correct and accept"}
          </PrimaryButton>
        </div>
      ) : (
        <>
          {d.status !== "accepted" && (
            <SheetAction onClick={() => onDecide("accept")}>{curator ? "Confirm" : "Accept"}</SheetAction>
          )}
          <SheetAction onClick={() => setEditing(true)}>Correct…</SheetAction>
          {d.status !== "rejected" && (
            <SheetAction danger onClick={() => onDecide("reject")}>
              {curator ? "Flag as wrong" : "Reject"}
            </SheetAction>
          )}
        </>
      )}
    </BottomSheet>
  );
}
