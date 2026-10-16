"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, CircleCheck } from "lucide-react";
import type { Castaway, Episode, EpisodeResearchPanel as Panel, LeagueState, StagedResearchDecision } from "@/lib/game/types";
import StateLogic from "@/lib/game/state-logic.js";
import { ApiError } from "@/lib/api";
import { useCanManage, useLeagueStore } from "@/lib/store";
import { useShowTerms } from "@/lib/use-show-terms";
import { useResultsSource } from "@/lib/episode-results";
import { PageBackLink } from "@/components/back-link";
import { CastawayAvatar } from "@/components/castaway-avatar";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { ActButton, CopyButton, StepNum } from "@/components/admin/admin-ui";
import { Field, MoreButton, fieldCls } from "@/components/setup/settings-ui";
import { cn } from "cn";

// A commissioner's episode results, /episodes/N/research (the canvas's commissioner "Fill the gap"
// board; docs/PLAN-episode-research-compiled-cache.md). On a league-decided season this is the weekly
// job: research is staged once for the season, and each commissioner checks what it found and applies
// it to their own league.
//
// Numbered steps, the current one's number in chyron: 1 Copy the question, 2 Paste its answer (both
// free: any AI chat with web search), 3 Check and apply. When research already covers everyone -- the
// wiki, an admin or another league on the season got there first -- the first two are one done line
// and the page opens on checking. That step is **what research found**, grouped by what happened,
// each result a row you tick (or untick) with a ⋯ to correct who or what; anything already in the
// league folded away; and Apply in a sticky bar. Pasting adds to the shared research (no league
// changes); only Apply touches this league.
//
// Replaces the episode editor's old "Fill gaps with research" panel. The guided tour's commissioner
// path plays its scripted Episode 1 through this same page (lib/episode-results.ts).

type Row = StagedResearchDecision & { keep: boolean; group: string };

export function EpisodeResultsPage({ number }: { number: number }) {
  const state = useLeagueStore((s) => s.state);
  const canManage = useCanManage();
  const ep = state.episodes.find((e) => e.number === number);

  let body: React.ReactNode;
  if (!ep) body = <p className="text-base text-muted-foreground">There&rsquo;s no episode {number} in this league.</p>;
  else if (!canManage) body = <p className="text-base text-muted-foreground">Your commissioner applies each episode&rsquo;s results.</p>;
  else body = <ResultsBody key={ep.id} ep={ep} state={state} />;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2 max-nav:hidden">
        <PageBackLink />
        <h2 className="type-caption text-[28px]">Episode {number} results</h2>
      </div>
      {body}
    </div>
  );
}

function ResultsBody({ ep, state }: { ep: Episode; state: LeagueState }) {
  const router = useRouter();
  const source = useResultsSource();
  const setState = useLeagueStore((s) => s.setState);
  const markResultsSeen = useLeagueStore((s) => s.markResultsSeen);
  const terms = useShowTerms();
  const format = StateLogic.formatOf(state);
  const [panel, setPanel] = useState<Panel | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [problems, setProblems] = useState<string[]>([]);
  const [fixing, setFixing] = useState<string | null>(null);
  const [showOpened, setShowOpened] = useState(false);

  // The staged spelling, resolved to this league's own where it matches someone, so the correction
  // sheet starts on the right person.
  const leagueName = (d: { castawayName: string; leagueName?: string }) =>
    d.leagueName ?? StateLogic.Core.findCastawayByName(state, d.castawayName).castaway?.name ?? d.castawayName;

  function show(p: Panel) {
    // Rows start ticked only until the league has any of this episode's research. After that an
    // unticked row is as likely a result the commissioner already turned down as a new one -- nothing
    // records a league's "no" -- so further applies are opt-in. A row an admin flagged as wrong starts
    // unticked too.
    const started = p.staged.some((d) => d.inLeague);
    setPanel(p);
    setRows(
      p.staged
        .map((d) => ({ ...d, castawayName: leagueName(d), keep: !d.inLeague && !started && d.status !== "rejected", group: groupKey(d) }))
        // Sorted once here, not on render, so correcting a row doesn't reshuffle its group.
        .sort((a, b) => a.castawayName.localeCompare(b.castawayName))
    );
  }

  useEffect(() => {
    if (!source) return;
    let live = true;
    source
      .load(ep)
      .then((p) => live && show(p))
      .catch((e) => live && setError(e instanceof ApiError ? e.message : "Couldn't load this episode's research."));
    return () => {
      live = false;
    };
    // Loaded once per episode; the page is keyed by it.
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!source) return <p className="text-base text-muted-foreground">Research needs a real league. This one&rsquo;s a demo.</p>;
  if (!panel) return error ? <p className="font-semibold text-live">{error}</p> : <p className="text-base text-muted-foreground">Loading…</p>;

  async function submit() {
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      const p = await source!.submit(ep, answer);
      show(p);
      setProblems(p.problems ?? []);
      setAnswer("");
      setNote("Added to this episode's research. Check what it found, then apply it.");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "That answer couldn't be read.");
    } finally {
      setBusy(false);
    }
  }

  async function apply() {
    const kept = rows.filter((r) => r.keep && !r.inLeague);
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      const res = await source!.apply(
        ep,
        kept.map((r) => ({ id: r.id, kind: r.kind, castawayName: r.castawayName, method: r.method, eventType: r.eventType }))
      );
      // Applying a result is seeing it -- same as entering one by hand.
      markResultsSeen(ep.number);
      setState(res.state);
      const a = res.applied;
      const extra = [...a.skipped, ...a.unresolved.map((n) => `${n} (not in this league)`)];
      if (extra.length === 0) {
        // Everything landed: the episode's own page shows it.
        // Replaced, not pushed: back from the episode goes to Episodes, not to this finished page.
        router.replace(`/episodes/${ep.number}`);
        return;
      }
      const done = a.eliminations.length + a.events.length + a.other.length;
      setNote(`Applied ${done} result${done === 1 ? "" : "s"}. Skipped: ${extra.join("; ")}.`);
      show(await source!.load(ep));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Applying didn't work.");
    } finally {
      setBusy(false);
    }
  }

  const edit = (id: string, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const open = rows.filter((r) => !r.inLeague);
  const applied = rows.filter((r) => r.inLeague);
  const toApply = open.filter((r) => r.keep).length;
  // An admin flagged something this league already has: worth a look, so it doesn't stay folded away.
  const flagged = applied.some((r) => r.status === "rejected");
  const showApplied = showOpened || flagged;
  const castaway = (name: string) => state.castaways.find((c) => c.name === name) ?? null;

  // Grouped by what happened -- who left, then each scoring event in the show's rule order, then team
  // moves -- so a reward a whole tribe won is one heading, not ten.
  const groupRank = (key: string) => {
    if (key === "elimination") return 0;
    if (key.startsWith("role:")) return 1;
    if (key === "exiled") return 2;
    if (key === "group") return 10_000;
    const i = format.events.findIndex((e) => `event:${e.id}` === key);
    return 3 + (i < 0 ? 5_000 : i);
  };
  const groupTitle = (r: Row) =>
    r.kind === "event"
      ? (format.events.find((e) => `event:${e.id}` === r.group)?.label ?? r.group.slice("event:".length))
      : r.kind === "role"
        ? `Role: ${r.group.slice("role:".length)}`
        : r.kind === "group"
          ? `${terms.Tribe} changes`
          : kindLabel(r.kind);
  const groups = [...new Set(open.map((r) => r.group))]
    .sort((a, b) => groupRank(a) - groupRank(b) || a.localeCompare(b))
    .map((key) => {
      const members = open.filter((r) => r.group === key);
      return { key, title: groupTitle(members[0]), rows: members };
    });
  const fixRow = fixing ? rows.find((r) => r.id === fixing) ?? null : null;
  const c = panel.coverage;
  // Which step is "now": copy until something's pasted, then paste, then check.
  const current = panel.prompt ? (answer.trim() ? 2 : 1) : 3;

  return (
    <>
      <p className="text-[15px] leading-snug text-muted-foreground">
        {panel.prompt
          ? "Ask any AI chat with web search what happened, paste its answer here, then check it and apply. It's free."
          : "Research is in. Check what it found, untick anything that's wrong, then apply."}
      </p>

      <ol className="flex flex-col gap-6">
        {panel.prompt ? (
          <>
            <StepRow n={1} on={current === 1} label="Copy the question">
              <span className="text-sm leading-snug text-muted-foreground">{askLine(panel, terms.castaways)}</span>
              <CopyButton text={panel.prompt} label="Copy the question" tone={current === 1 ? "chyron" : "plain"} />
              <span className="text-[13px] text-muted-foreground">Paste it into ChatGPT, Claude, Gemini: any chat that can search the web.</span>
            </StepRow>
            <StepRow n={2} on={current === 2} label={<label htmlFor="research-answer">Paste its answer</label>}>
              <textarea
                id="research-answer"
                rows={4}
                className={cn(fieldCls, "min-h-[96px] resize-y py-3 font-mono text-sm")}
                placeholder="Paste what the chat wrote back"
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
              />
              <ActButton tone={current === 2 ? "chyron" : "plain"} disabled={busy || !answer.trim()} onClick={submit} className="self-start">
                {busy ? "Reading…" : "Read the answer"}
              </ActButton>
              <span className="text-[13px] text-muted-foreground">
                Shared with other leagues on this season. It changes yours only when you apply it.
              </span>
              {problems.length > 0 && (
                <ul className="list-disc pl-5 text-sm text-muted-foreground">
                  {problems.map((p, i) => (
                    <li key={i}>{p}</li>
                  ))}
                </ul>
              )}
            </StepRow>
          </>
        ) : (
          <li className="flex items-center gap-3">
            <CircleCheck className="size-[30px] shrink-0 text-good" strokeWidth={2} aria-hidden />
            <span className="flex flex-col gap-0.5">
              <span className="text-[15px] font-semibold">Research answered everything</span>
              <span className="text-[13px] text-muted-foreground">Nothing to copy or paste for this episode.</span>
            </span>
          </li>
        )}

        <StepRow
          n={panel.prompt ? 3 : 1}
          on={current === 3 && open.length > 0}
          label="Check and apply"
          aside={open.length > 0 && <span className="text-[13px] text-muted-foreground">{toApply} of {open.length} ticked</span>}
        >
          <section className="flex flex-col" data-tour="results-list">
            {groups.length === 0 ? (
              <p className="border-t border-border py-3 text-base text-muted-foreground">
                {applied.length > 0
                  ? "Everything research found is in your league."
                  : c.researched
                    ? "Research found nothing to score for this episode."
                    : "Nothing yet. What the chat found shows up here once you paste its answer."}
              </p>
            ) : (
              groups.map((g) => (
                <div key={g.key} className="flex flex-col">
                  <h4 className="type-caption pb-1 pt-3 text-[17px] tracking-[0.03em] text-muted-foreground">{g.title}</h4>
                  <ul className="flex flex-col border-b border-border">
                    {g.rows.map((r) => (
                      <ResultRow
                        key={r.id}
                        row={r}
                        castaway={castaway(r.castawayName)}
                        onToggle={() => edit(r.id, { keep: !r.keep })}
                        onFix={() => setFixing(r.id)}
                      />
                    ))}
                  </ul>
                </div>
              ))
            )}
            {applied.length > 0 && (
              <>
                <button
                  type="button"
                  aria-expanded={showApplied}
                  onClick={() => setShowOpened((o) => !o)}
                  className="flex min-h-[52px] items-center justify-between border-b border-border text-[15px] text-muted-foreground"
                >
                  {applied.length} already in your league
                  <ChevronDown className={cn("size-[18px] transition-transform", showApplied && "rotate-180")} strokeWidth={2.2} aria-hidden />
                </button>
                {showApplied && (
                  <ul className="flex flex-col border-b border-border">
                    {applied.map((r) => (
                      <li
                        key={r.id}
                        className={cn("flex min-h-[52px] items-center gap-3 border-t border-border py-1.5 first:border-t-0", r.status !== "rejected" && "opacity-60")}
                      >
                        <Face castaway={castaway(r.castawayName)} name={r.castawayName} />
                        <span className="flex min-w-0 flex-1 flex-col">
                          <span className="truncate text-base font-semibold">{r.castawayName}</span>
                          {r.status === "rejected" ? (
                            <span className="text-[13px] font-semibold text-live">Flagged as wrong by an admin. Check it on the episode.</span>
                          ) : (
                            <span className="truncate text-[13px] text-muted-foreground">{groupTitle(r)}</span>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </section>
          {/* Before checking is the step at hand, Apply waits at the end of the list, outlined: what's
              been found can go in now, but the sticky yellow bar is for once it's all been asked. */}
          {open.length > 0 && current !== 3 && (
            <ActButton onClick={apply} disabled={busy || toApply === 0} className="self-start">
              {busy ? "Applying…" : toApply === 0 ? "Tick a result to apply it" : `Apply ${toApply} found so far`}
            </ActButton>
          )}
        </StepRow>
      </ol>

      {error && <p className="font-semibold text-live">{error}</p>}
      {note && <p className="text-sm text-muted-foreground">{note}</p>}

      {open.length > 0 && current === 3 && (
        <div
          className="sticky bottom-[var(--tabbar-h)] z-40 -mx-4 mt-auto flex flex-col gap-2 border-t border-input bg-card px-4 py-3 shadow-bar nav:mx-0 nav:rounded-[3px] nav:border"
          data-tour="results-apply"
        >
          <button
            type="button"
            disabled={busy || toApply === 0}
            onClick={apply}
            className="min-h-12 w-full rounded-[3px] bg-chyron px-4 text-[15px] font-bold text-chyron-foreground transition-[filter] hover:brightness-[1.06] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-chyron-line disabled:bg-muted disabled:text-muted-foreground"
          >
            {busy ? "Applying…" : toApply === 0 ? "Tick a result to apply it" : `Apply ${toApply} result${toApply === 1 ? "" : "s"} to this league`}
          </button>
        </div>
      )}

      <BottomSheet open={!!fixRow} onOpenChange={(o) => !o && setFixing(null)} title="Fix this result" description={fixRow ? groupTitle(fixRow) : undefined} hideCancel>
        {fixRow && <FixFields row={fixRow} state={state} onChange={(patch) => edit(fixRow.id, { ...patch, keep: true })} />}
        <button
          type="button"
          onClick={() => setFixing(null)}
          className="mt-4 min-h-12 rounded-[3px] border border-border bg-secondary text-[15px] font-bold text-foreground"
        >
          Done
        </button>
      </BottomSheet>
    </>
  );
}

// One result: tick, face, who and how sure research is, and ⋯ to correct it. The whole row ticks.
function ResultRow({ row: r, castaway, onToggle, onFix }: { row: Row; castaway: Castaway | null; onToggle: () => void; onFix: () => void }) {
  const low = r.confidence === "low";
  const detail = [
    r.kind === "elimination" && r.method,
    r.kind === "group" && (r.method ? `Moved to ${r.method}` : "Left their team"),
    r.status === "rejected" ? "Flagged as wrong by an admin" : r.status === "accepted" && r.corrected ? "Corrected by an admin" : null,
    !castaway && "Not in this league",
    low ? "Low confidence · check first" : r.fromWiki && r.fromResearch ? "Wiki and research agree" : r.fromWiki ? "From the wiki" : "From research",
    r.sources.length > 0 && `${r.sources.length} source${r.sources.length === 1 ? "" : "s"}`,
  ].filter(Boolean);
  return (
    <li className="flex min-h-16 items-center gap-1 border-t border-border">
      <button
        type="button"
        aria-pressed={r.keep}
        onClick={onToggle}
        className="flex min-w-0 flex-1 items-center gap-3 py-2 text-left outline-none focus-visible:bg-accent"
      >
        <span
          aria-hidden
          className={cn(
            "flex size-6 shrink-0 items-center justify-center rounded-[3px]",
            r.keep ? "bg-chyron text-chyron-foreground" : "border-2 border-muted-foreground"
          )}
        >
          {r.keep && <Check className="size-4" strokeWidth={3} />}
        </span>
        <Face castaway={castaway} name={r.castawayName} />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate text-base font-semibold">{r.castawayName}</span>
          <span className={cn("truncate text-[13px]", low || !castaway || r.status === "rejected" ? "font-semibold text-accent-2" : "text-muted-foreground")}>
            {detail.join(" · ")}
          </span>
        </span>
      </button>
      <MoreButton label={`Fix ${r.castawayName}`} onClick={onFix} />
    </li>
  );
}

function Face({ castaway, name }: { castaway: Castaway | null; name: string }) {
  return (
    <CastawayAvatar
      castaway={castaway ?? { name, photoUrl: undefined }}
      className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-[2px] bg-muted text-xs font-bold text-muted-foreground [&_img]:object-top"
    />
  );
}

// Who it was, and what: corrections are checked against the league's own format when applied.
function FixFields({ row: r, state, onChange }: { row: Row; state: LeagueState; onChange: (patch: Partial<Row>) => void }) {
  const terms = useShowTerms();
  const format = StateLogic.formatOf(state);
  const known = state.castaways.some((c) => c.name === r.castawayName);
  return (
    <div className="flex flex-col gap-4 pt-2">
      <Field label={terms.Castaway} htmlFor="fix-who">
        <select id="fix-who" className={fieldCls} value={r.castawayName} onChange={(e) => onChange({ castawayName: e.target.value })}>
          {!known && <option value={r.castawayName}>{r.castawayName} (not in this league)</option>}
          {state.castaways.map((c) => (
            <option key={c.id} value={c.name}>
              {c.name}
            </option>
          ))}
        </select>
      </Field>
      {r.kind === "elimination" && (
        <Field label="How they left" htmlFor="fix-how">
          <select id="fix-how" className={fieldCls} value={r.method} onChange={(e) => onChange({ method: e.target.value })}>
            {!format.exitMethods.includes(r.method) && <option value={r.method}>{r.method}</option>}
            {format.exitMethods.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </Field>
      )}
      {r.kind === "event" && (
        <Field label="What happened" htmlFor="fix-what">
          <select id="fix-what" className={fieldCls} value={r.eventType} onChange={(e) => onChange({ eventType: e.target.value })}>
            {!format.events.some((x) => x.id === r.eventType) && <option value={r.eventType}>{r.eventType}</option>}
            {format.events.map((x) => (
              <option key={x.id} value={x.id}>
                {x.label}
              </option>
            ))}
          </select>
        </Field>
      )}
      {r.kind === "role" && format.roles && (
        <Field label="Role" htmlFor="fix-role">
          <select id="fix-role" className={fieldCls} value={r.method} onChange={(e) => onChange({ method: e.target.value })}>
            {format.roles.values.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </Field>
      )}
      {r.kind === "group" && (
        <Field label={`Moved to ${terms.tribe}`} htmlFor="fix-group">
          <input id="fix-group" className={fieldCls} value={r.method} onChange={(e) => onChange({ method: e.target.value })} />
        </Field>
      )}
      {r.sources.length > 0 && (
        <p className="flex flex-wrap gap-x-3 text-sm text-muted-foreground">
          Sources:
          {r.sources.slice(0, 4).map((url) => (
            <a key={url} href={url} target="_blank" rel="noreferrer" className="font-semibold text-chyron-line underline-offset-4 hover:underline">
              {hostOf(url)}
            </a>
          ))}
        </p>
      )}
    </div>
  );
}

// One numbered step: the number (chyron while it's the step to do now), its label with an optional
// aside on the same line, and whatever it needs underneath.
function StepRow({ n, on, label, aside, children }: { n: number; on?: boolean; label: React.ReactNode; aside?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <StepNum n={n} on={on} />
      <div className="flex min-w-0 flex-1 flex-col gap-2.5">
        <span className="flex items-baseline justify-between gap-3 pt-1">
          <span className="text-base font-semibold">{label}</span>
          {aside}
        </span>
        {children}
      </div>
    </li>
  );
}

// Who the question asks about: everyone, or only those research hasn't settled yet.
function askLine(p: Panel, people: string): string {
  const c = p.coverage;
  if (!c.researched) return `It asks what happened to all ${c.total} ${people} this episode.`;
  const unsure = c.lowConfidence.length ? `, ${c.lowConfidence.length} unsure` : "";
  return `Research has ${c.covered.length} of ${c.total}${unsure}. It asks only about the rest: ${c.needsAsking.join(", ")}.`;
}

function kindLabel(kind: StagedResearchDecision["kind"]): string {
  return { elimination: "Left the game", event: "Scored", exiled: "Exiled", role: "Role", group: "Moved" }[kind];
}

// Which group a staged result sits in: one per scoring event or role value; eliminations, exiles and
// team moves each as one.
function groupKey(d: StagedResearchDecision): string {
  if (d.kind === "event") return `event:${d.eventType}`;
  if (d.kind === "role") return `role:${d.method}`;
  return d.kind;
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "source";
  }
}
