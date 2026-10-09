"use client";

import { useState } from "react";
import type { Episode, EpisodeResearchPanel as Panel, LeagueState, StagedResearchDecision } from "@/lib/game/types";
import StateLogic from "@/lib/game/state-logic.js";
import { useLeagueStore } from "@/lib/store";
import { useShowTerms } from "@/lib/use-show-terms";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ChevronDownIcon } from "@/components/icons";
import { ResultGroup } from "@/components/review-bits";
import { cn } from "cn";

// A commissioner's episode research (docs/PLAN-episode-research-compiled-cache.md): the same copy-a-
// prompt / paste-the-answer flow as Admin's research panel (season-episodes.tsx's PasteImportPanel), for
// a league no admin is researching. It leads with coverage, because research is shared: if another
// league on this season (or an admin) already researched the episode, there may be nothing to paste,
// or only a few people to ask about.
//
// Two steps, deliberately separate: pasting adds to the shared research (no league changes), and
// "Apply" puts the rows this commissioner kept into THIS league only.

// `group` is fixed from what was staged, so correcting a row's event type doesn't make it jump groups
// mid-edit.
type Row = StagedResearchDecision & { keep: boolean; group: string };

export function EpisodeResearchPanel({ ep, state }: { ep: Episode; state: LeagueState }) {
  const leagueId = useLeagueStore((s) => s.leagueId);
  const mode = useLeagueStore((s) => s.mode);
  const setState = useLeagueStore((s) => s.setState);
  const markResultsSeen = useLeagueStore((s) => s.markResultsSeen);
  const terms = useShowTerms();
  const format = StateLogic.formatOf(state);
  const [open, setOpen] = useState(false);
  const [panel, setPanel] = useState<Panel | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [answer, setAnswer] = useState("");
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [problems, setProblems] = useState<string[]>([]);

  // Research needs the database's shared cache; a demo league has none.
  if (mode === "mock") return null;

  // The staged spelling, resolved to this league's own where it matches someone, so the dropdown
  // starts on the right person.
  const leagueName = (name: string) => StateLogic.Core.findCastawayByName(state, name).castaway?.name ?? name;

  // Rows start ticked only until the league has any of this episode's research. After that, an unticked
  // row is as likely a result the commissioner already turned down as a new one -- nothing records a
  // league's "no" (the shared rows aren't theirs to reject) -- so further applies are opt-in.
  const started = (p: Panel) => p.staged.some((d) => d.inLeague);

  function show(p: Panel) {
    setPanel(p);
    setRows(
      p.staged
        .map((d) => ({ ...d, castawayName: leagueName(d.castawayName), keep: !d.inLeague && !started(p), group: groupKey(d) }))
        // Sorted once here, not on render, so renaming a row doesn't reshuffle its group.
        .sort((a, b) => a.castawayName.localeCompare(b.castawayName))
    );
  }

  async function load() {
    setBusy(true);
    setError(null);
    try {
      show(await api.episodeResearch(leagueId!, ep.id));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't load this episode's research.");
    } finally {
      setBusy(false);
    }
  }

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && !panel) load();
  }

  async function copyPrompt() {
    if (!panel?.prompt) return;
    try {
      await navigator.clipboard.writeText(panel.prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked -- the prompt's still selectable below */
    }
  }

  async function submit() {
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      const p = await api.submitEpisodeResearch(leagueId!, ep.id, answer);
      show(p);
      setProblems(p.problems ?? []);
      setAnswer("");
      setNote("Added to this episode's research. Review what it found below, then apply it to your league.");
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
      const res = await api.applyEpisodeResearch(
        leagueId!,
        ep.id,
        kept.map((r) => ({ id: r.id, castawayName: r.castawayName, method: r.method, eventType: r.eventType }))
      );
      // Applying a result is seeing it -- same as entering one by hand.
      markResultsSeen(ep.number);
      setState(res.state);
      const a = res.applied;
      const done = a.eliminations.length + a.events.length + a.other.length;
      const extra = [...a.skipped, ...a.unresolved.map((n) => `${n} (not in this league)`)];
      setNote(`Applied ${done} result${done === 1 ? "" : "s"} to this league.` + (extra.length ? ` Skipped: ${extra.join("; ")}.` : ""));
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Applying didn't work.");
    } finally {
      setBusy(false);
    }
  }

  const edit = (id: string, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const toApply = rows.filter((r) => r.keep && !r.inLeague).length;

  // Grouped by what happened -- who left, then each scoring event in the show's rule order, then team
  // moves -- so a reward a whole tribe won is one line, not ten.
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
      ? format.events.find((e) => `event:${e.id}` === r.group)?.label ?? r.group.slice("event:".length)
      : r.kind === "role"
        ? `Role: ${r.group.slice("role:".length)}`
        : r.kind === "group"
          ? `${terms.Tribe} changes`
          : kindLabel(r.kind);
  const groups = [...new Set(rows.map((r) => r.group))]
    .sort((a, b) => groupRank(a) - groupRank(b) || a.localeCompare(b))
    .map((key) => {
      const members = rows.filter((r) => r.group === key);
      return { key, title: groupTitle(members[0]), rows: members };
    });

  return (
    <div className="mb-3 rounded-md border border-border">
      <button className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left" onClick={toggle}>
        <h4 className="text-[0.7rem] font-bold uppercase tracking-wide text-muted-foreground">Research this episode</h4>
        <ChevronDownIcon className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="flex flex-col gap-2 px-3 pb-3 text-xs">
          {!panel && busy && <p className="text-muted-foreground">Loading…</p>}
          {panel && (
            <>
              <p className="font-semibold">{coverageLine(panel, terms.castaways)}</p>
              {panel.coverage.needsAsking.length > 0 && panel.coverage.researched && (
                <p className="text-muted-foreground">Still to ask about: {panel.coverage.needsAsking.join(", ")}.</p>
              )}

              {panel.prompt && (
                <>
                  <p className="text-muted-foreground">
                    1. Copy the prompt into any AI chat with web search. 2. Paste its JSON answer below. Whatever you add is
                    shared with other leagues on this season, but only changes your league when you apply it.
                  </p>
                  <div>
                    <Button variant="secondary" size="xs" onClick={copyPrompt}>
                      {copied ? "Copied!" : "Copy prompt"}
                    </Button>
                  </div>
                  <Textarea readOnly rows={3} value={panel.prompt} className="font-mono text-[0.65rem] text-muted-foreground" />
                  <Textarea
                    rows={5}
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    placeholder="Paste the JSON the chat wrote back (a code fence or a line of chatter around it is fine)."
                    className="font-mono text-[0.7rem]"
                  />
                  <div>
                    <Button size="xs" disabled={busy || !answer.trim()} onClick={submit}>
                      {busy ? "Reading…" : "Add to research"}
                    </Button>
                  </div>
                </>
              )}
              {problems.length > 0 && (
                <ul className="list-disc pl-4 text-muted-foreground">
                  {problems.map((p, i) => (
                    <li key={i}>{p}</li>
                  ))}
                </ul>
              )}

              {rows.length > 0 ? (
                <>
                  <h5 className="mt-1 font-semibold">What the research found</h5>
                  {started(panel) && rows.some((r) => !r.inLeague) && (
                    <p className="text-muted-foreground">
                      Some of this episode&apos;s research is already in your league, so nothing else is ticked — tick anything you want
                      to add.
                    </p>
                  )}
                  <div className="flex flex-col gap-1.5">
                    {groups.map((g) => {
                      const open = g.rows.filter((r) => !r.inLeague);
                      const ticked = open.filter((r) => r.keep).length;
                      const inLeague = g.rows.length - open.length;
                      // Small groups, and any with someone not in this league or a low-confidence result,
                      // start open; a big shared event (a tribe's reward win) starts as one line.
                      const needsLook = open.some((r) => r.confidence === "low" || !state.castaways.some((c) => c.name === r.castawayName));
                      return (
                        <ResultGroup
                          key={g.key}
                          title={g.title}
                          names={g.rows.map((r) => r.castawayName)}
                          noun={[terms.castaway, terms.castaways]}
                          detail={[open.length && `${ticked} of ${open.length} ticked`, inLeague && `${inLeague} already in your league`].filter(Boolean).join(", ")}
                          defaultOpen={g.key !== "group" && (g.key === "elimination" || g.rows.length <= 2 || needsLook)}
                          action={
                            open.length > 1 && (
                              <label className="flex items-center gap-1 text-[0.65rem] text-muted-foreground">
                                <input
                                  type="checkbox"
                                  checked={ticked === open.length}
                                  onChange={(e) => setRows((rs) => rs.map((r) => (r.group === g.key && !r.inLeague ? { ...r, keep: e.target.checked } : r)))}
                                />
                                all
                              </label>
                            )
                          }
                        >
                          {g.rows.map((r) => (
                            <div key={r.id} className={cn("flex flex-wrap items-center gap-1.5 rounded-md border border-border p-2", r.inLeague && "opacity-60")}>
                              <input
                                type="checkbox"
                                aria-label="Apply this result"
                                checked={r.keep && !r.inLeague}
                                disabled={r.inLeague}
                                onChange={(e) => edit(r.id, { keep: e.target.checked })}
                              />
                              <Select size="sm" value={r.castawayName} disabled={r.inLeague} onChange={(e) => edit(r.id, { castawayName: e.target.value })}>
                                {!state.castaways.some((c) => c.name === r.castawayName) && <option value={r.castawayName}>{r.castawayName} (not in league)</option>}
                                {state.castaways.map((c) => (
                                  <option key={c.id} value={c.name}>
                                    {c.name}
                                  </option>
                                ))}
                              </Select>
                              {r.kind === "elimination" && (
                                <Select size="sm" value={r.method} disabled={r.inLeague} onChange={(e) => edit(r.id, { method: e.target.value })}>
                                  {!format.exitMethods.includes(r.method) && <option value={r.method}>{r.method}</option>}
                                  {format.exitMethods.map((m) => (
                                    <option key={m} value={m}>
                                      {m}
                                    </option>
                                  ))}
                                </Select>
                              )}
                              {r.kind === "event" && (
                                <Select size="sm" value={r.eventType} disabled={r.inLeague} onChange={(e) => edit(r.id, { eventType: e.target.value })}>
                                  {!format.events.some((x) => x.id === r.eventType) && <option value={r.eventType}>{r.eventType}</option>}
                                  {format.events.map((x) => (
                                    <option key={x.id} value={x.id}>
                                      {x.label}
                                    </option>
                                  ))}
                                </Select>
                              )}
                              {r.kind === "role" && format.roles && (
                                <Select size="sm" value={r.method} disabled={r.inLeague} onChange={(e) => edit(r.id, { method: e.target.value })}>
                                  {format.roles.values.map((v) => (
                                    <option key={v} value={v}>
                                      {v}
                                    </option>
                                  ))}
                                </Select>
                              )}
                              {r.kind === "group" && (
                                <Input size="sm" className="w-[110px]" placeholder={terms.Tribe} value={r.method} disabled={r.inLeague} onChange={(e) => edit(r.id, { method: e.target.value })} />
                              )}
                              <span className="basis-full text-muted-foreground">
                                {r.inLeague
                                  ? "Already in your league."
                                  : [
                                      `${r.confidence} confidence`,
                                      r.fromWiki && r.fromResearch ? "wiki and research agree" : r.fromWiki ? "from the wiki" : "from research",
                                      r.sources.length ? `${r.sources.length} source${r.sources.length === 1 ? "" : "s"}` : "no source cited",
                                    ].join(" · ")}
                                {!r.inLeague &&
                                  r.sources.slice(0, 2).map((url) => (
                                    <a key={url} href={url} target="_blank" rel="noreferrer" className="ml-1.5 underline">
                                      {hostOf(url)}
                                    </a>
                                  ))}
                              </span>
                            </div>
                          ))}
                        </ResultGroup>
                      );
                    })}
                  </div>
                  <div>
                    <Button size="xs" disabled={busy || toApply === 0} onClick={apply}>
                      {busy ? "Applying…" : `Apply ${toApply} to this league`}
                    </Button>
                  </div>
                </>
              ) : (
                panel.coverage.researched && <p className="text-muted-foreground">The research found nothing to score for this episode.</p>
              )}
            </>
          )}
          {error && <p className="font-semibold text-destructive">{error}</p>}
          {note && <p className="text-muted-foreground">{note}</p>}
        </div>
      )}
    </div>
  );
}

// The coverage summary the panel leads with -- whether there's anything to do at all.
function coverageLine(p: Panel, people: string): string {
  const c = p.coverage;
  if (!c.researched) return `Not researched yet — the prompt asks about all ${c.total} ${people}.`;
  if (!c.needsAsking.length) return "Already fully researched — just review and apply.";
  const parts = [`${c.covered.length} of ${c.total} answered`];
  if (c.missing.length) parts.push(`${c.missing.length} missing`);
  if (c.lowConfidence.length) parts.push(`${c.lowConfidence.length} low-confidence`);
  if (!c.missing.length) parts[0] = "Fully answered";
  return parts.join(", ") + ".";
}

function kindLabel(kind: StagedResearchDecision["kind"]): string {
  return { elimination: "Left the game", event: "Scored", exiled: "Exiled", role: "Role", group: "Moved to" }[kind];
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
