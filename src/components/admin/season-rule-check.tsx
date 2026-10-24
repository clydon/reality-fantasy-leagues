"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import type { SeasonRuleChange, SeasonRuleChangeWithReview } from "@/lib/game/types";
import type { FormatData } from "@/lib/game/formats/index";
import type { SeasonCheck } from "@/lib/game/formats/season-check";
import { reviewCheck } from "@/lib/game/formats/season-check.js";
import { camelId } from "@/lib/game/formats/proposal.js";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { confirm } from "@/lib/confirm-store";
import { AskAi } from "@/components/ask-ai";
import { useShowSpoilers } from "@/lib/paid-ai-store";
import { cn } from "cn";
import {
  CategorySelect,
  Notes,
  QUESTION_TYPES,
  RuleLine,
  TierChip,
  effectiveEventId,
  effectiveQuestionKey,
  ruleAtPath,
} from "./format-review-screen";

// The season's Rules row (docs/PLAN-season-rule-changes.md): "check for rule changes" partway through
// a season, between the Cast and Episodes steps of SeasonCard -- but never in their way. Episodes don't
// wait on it; it's here for when a show changes how it's played mid-season.
//
//   - The row says where things stand: the show's rules alone, or with N changes from episode X; when a
//     check last covered; and research's own "something new happened" notes, which are the cue to run
//     one.
//   - "Check for rule changes" is the free copy/paste loop (the same shape as "Research a new show"):
//     copy the prompt into a web-searching chat, paste its answer back. "Nothing changed" is recorded
//     as it is; anything else becomes a draft to review here.
//   - The review edits the ANSWER, never the derived change, and re-runs the same reviewCheck the
//     server does, live. Approving puts it in force for research from its effective episode and offers
//     it to every league on the season. No league scores it until its commissioner adopts it.

// The change is saved before leagues are told about it, so a league that couldn't be updated is a
// footnote to a success, not an error (see pushSeasonRuleChanges).
function missedLeagues(failed: { name: string }[] | undefined): string {
  if (!failed?.length) return "";
  return ` Couldn't update ${failed.map((f) => f.name).join(", ")} — they catch up on the next change to this season's rules.`;
}

type Row = (props:{ n: ReactNode; title: string; status: string; done: boolean; disabled?: boolean; children?: ReactNode }) => ReactNode;

const STATUS_LABEL: Record<SeasonRuleChange["status"], string> = {
  draft: "Draft",
  approved: "In force",
  no_change: "No change",
  withdrawn: "Withdrawn",
};

export function SeasonRules({
  seasonId,
  seasonLabel,
  castApproved,
  locked,
  startCheck = false,
  Row,
}: {
  seasonId: string;
  seasonLabel: string;
  castApproved: boolean;
  locked: boolean;
  /** Open the check straight away (research's rules tripwire links here with ?check=1). */
  startCheck?: boolean;
  /** SeasonCard's own step row, so this one reads like its neighbours. */
  Row: Row;
}) {
  const queryClient = useQueryClient();
  const { data, error } = useQuery({
    queryKey: ["season-rule-changes", seasonId],
    queryFn: () => api.adminRuleChanges(seasonId),
    enabled: castApproved,
  });
  const [checking, setChecking] = useState(startCheck && castApproved && !locked);
  const [openId, setOpenId] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const changes = data?.changes ?? [];
  const inForce = changes.filter((c) => c.status === "approved").sort((a, b) => (a.effectiveEpisode ?? 0) - (b.effectiveEpisode ?? 0));
  const drafts = changes.filter((c) => c.status === "draft");
  const lastChecked = Math.max(0, ...changes.filter((c) => c.status === "approved" || c.status === "no_change").map((c) => c.checkedThrough ?? 0));
  const aired = data?.airedThrough ?? null;
  const flags = data?.flags ?? [];
  // A research note or a change's summary describes a twist: like everything else in Admin, it stays
  // behind "Show episode results" (the episode numbers alone say nothing about what happened).
  const showSpoilers = useShowSpoilers();
  const HIDDEN = "details hidden — tick “Show episode results” at the top to read them";
  const upToDate = lastChecked > 0 && (aired == null || lastChecked >= aired) && !flags.length && !drafts.length;

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["season-rule-changes", seasonId] });

  let status: string;
  if (!castApproved) status = "Approve the cast first";
  else if (error) status = error instanceof ApiError ? error.message : "Couldn't load";
  else if (!data) status = "Loading…";
  else {
    const rules = inForce.length
      ? `${inForce.length} change${inForce.length === 1 ? "" : "s"} in force (from ep ${inForce.map((c) => c.effectiveEpisode).join(", ")})`
      : "the show's own rules";
    const checked = lastChecked ? `checked through ep ${lastChecked}` : "not checked yet";
    status = drafts.length
      ? `${drafts.length} change${drafts.length === 1 ? "" : "s"} to review below`
      : flags.length
        ? `Research on ep ${flags.map((f) => f.episode).join(", ")} mentioned something new — check the rules`
        : `${rules[0].toUpperCase()}${rules.slice(1)} · ${checked}`;
  }

  async function act(fn: () => Promise<unknown>, done?: string) {
    setActionError(null);
    setNote(null);
    try {
      await fn();
      if (done) setNote(done);
      await refresh();
    } catch (e) {
      setActionError(e instanceof ApiError ? e.message : "That didn't work.");
    }
  }

  return (
    <>
      <Row n={2} title="Rules" done={castApproved && upToDate} disabled={!castApproved} status={status}>
        {castApproved && (
          <Button variant="secondary" size="xs" title="Free — you paste the prompt into your own AI chat" disabled={locked} onClick={() => setChecking((v) => !v)}>
            {checking ? "Cancel check" : "Check for rule changes"}
          </Button>
        )}
      </Row>
      {castApproved && (
        <div className="ml-6 flex flex-col gap-1.5">
          {flags.length > 0 && (
            <ul className="mt-1 flex flex-col gap-0.5 rounded border border-dashed border-border bg-secondary/40 p-1.5 text-[0.7rem]">
              {flags.map((f) => (
                <li key={f.episode}>
                  <b>Episode {f.episode}:</b> {showSpoilers ? f.note : <span className="text-muted-foreground">{HIDDEN}</span>}
                </li>
              ))}
            </ul>
          )}
          {checking && (
            <RuleCheckPanel
              seasonId={seasonId}
              seasonLabel={seasonLabel}
              onRecorded={(c) => {
                setChecking(false);
                refresh();
                if (c.status === "draft") setOpenId(c.id);
                else setNote(`Recorded: nothing new${c.checkedThrough ? ` through episode ${c.checkedThrough}` : ""}.`);
              }}
            />
          )}
          {changes.filter((c) => c.status !== "no_change" || c.checkedThrough === lastChecked).length > 0 && (
            <ul className="flex flex-col gap-1">
              {changes
                // Old "nothing new" records stop mattering once a later one exists; keep the latest.
                .filter((c) => c.status !== "no_change" || c.checkedThrough === lastChecked)
                .map((c) => (
                  <li key={c.id} className={cn("rounded-md border border-border px-2 py-1", c.status === "withdrawn" && "opacity-60")}>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge variant={c.status === "approved" ? "default" : "secondary"} className="text-[0.6rem]">
                        {STATUS_LABEL[c.status]}
                      </Badge>
                      {c.effectiveEpisode && c.status !== "no_change" && <span className="text-muted-foreground">from ep {c.effectiveEpisode}</span>}
                      {c.status === "no_change" && c.checkedThrough && <span className="text-muted-foreground">through ep {c.checkedThrough}</span>}
                      {c.status === "approved" && c.version > 1 && <span className="text-muted-foreground">v{c.version}</span>}
                      <span className="min-w-0 flex-1 truncate" title={showSpoilers ? (c.summary ?? "") : ""}>
                        {!c.summary ? "—" : showSpoilers ? c.summary : <span className="text-muted-foreground">{HIDDEN}</span>}
                      </span>
                      {(c.status === "draft" || c.status === "approved") && (
                        <button className="text-muted-foreground underline-offset-2 hover:text-foreground hover:underline" onClick={() => setOpenId(openId === c.id ? null : c.id)}>
                          {openId === c.id ? "close" : c.status === "draft" ? "review" : "view/edit"}
                        </button>
                      )}
                      {c.status === "approved" && (
                        <button
                          className="text-muted-foreground underline-offset-2 hover:text-destructive hover:underline disabled:opacity-50"
                          disabled={locked}
                          onClick={async () => {
                            const ok = await confirm(
                              "Withdraw this change? Research stops asking its questions and it's no longer offered to leagues. " +
                                "Leagues that adopted it keep scoring it until their commissioner removes it.",
                              { confirmLabel: "Withdraw" }
                            );
                            if (ok) {
                              let missed = "";
                              await act(async () => {
                                missed = missedLeagues((await api.adminWithdrawRuleChange(seasonId, c.id)).leaguesFailed);
                              });
                              setNote(`Withdrawn.${missed}`);
                            }
                          }}
                        >
                          withdraw
                        </button>
                      )}
                      {(c.status === "draft" || c.status === "no_change") && (
                        <button
                          className="text-muted-foreground underline-offset-2 hover:text-destructive hover:underline disabled:opacity-50"
                          disabled={locked}
                          onClick={async () => {
                            if (await confirm(c.status === "draft" ? "Delete this draft?" : "Delete this record of a check?", { confirmLabel: "Delete" })) {
                              if (openId === c.id) setOpenId(null);
                              await act(() => api.adminDeleteRuleChange(seasonId, c.id));
                            }
                          }}
                        >
                          delete
                        </button>
                      )}
                    </div>
                    {openId === c.id && (
                      <RuleChangeReview
                        seasonId={seasonId}
                        changeId={c.id}
                        onClose={() => setOpenId(null)}
                        onChanged={(message) => {
                          refresh();
                          if (message) setNote(message);
                        }}
                      />
                    )}
                  </li>
                ))}
            </ul>
          )}
          {note && <p className="font-semibold text-good">{note}</p>}
          {actionError && <p className="font-semibold text-destructive">{actionError}</p>}
        </div>
      )}
    </>
  );
}

// The free copy/paste loop: the season's own prompt (its rules as they stand), then the chat's answer.
function RuleCheckPanel({ seasonId, seasonLabel, onRecorded }: { seasonId: string; seasonLabel: string; onRecorded: (c: SeasonRuleChange) => void }) {
  const { data, isLoading, error: promptError } = useQuery({
    queryKey: ["season-rule-prompt", seasonId],
    queryFn: () => api.adminRuleCheckPrompt(seasonId),
    staleTime: 0,
  });
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const { change } = await api.adminRecordRuleCheck(seasonId, answer);
      onRecorded(change);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "That didn't work.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-1 rounded-md border border-dashed border-border bg-secondary/40 p-2.5 text-xs">
      <p className="mb-1.5 text-muted-foreground">
        Has {seasonLabel} changed how it&rsquo;s played? 1. Ask an AI with web search (ours, or copy this into any chat). 2. Its answer
        goes below. &ldquo;Nothing changed&rdquo; is a fine answer, and gets recorded too.
      </p>
      {isLoading && <p className="italic text-muted-foreground">Building the prompt…</p>}
      {promptError && <p className="font-semibold text-destructive">{promptError instanceof ApiError ? promptError.message : "Couldn't build the prompt."}</p>}
      {data && (
        <div className="flex flex-col gap-1">
          <AskAi prompt={data.prompt} task={`checking whether ${seasonLabel} changed how it's played`} onAnswer={setAnswer} answered={!!answer.trim()} />
          <Textarea readOnly rows={4} value={data.prompt} className="font-mono text-[0.65rem] text-muted-foreground" />
        </div>
      )}
      <label className="mt-1.5 flex flex-col gap-1">
        <span className="font-semibold">Paste the answer here</span>
        <Textarea
          rows={6}
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          placeholder="Paste the JSON the chat wrote back (a code fence or a line of chatter around it is fine)."
          className="font-mono text-[0.7rem]"
        />
      </label>
      <div className="mt-1.5 flex items-center gap-1.5">
        <Button size="xs" disabled={busy || !answer.trim()} onClick={submit}>
          {busy ? "Reading…" : "Record the check"}
        </Button>
      </div>
      {error && <p className="mt-1 font-semibold text-destructive">{error}</p>}
    </div>
  );
}

function RuleChangeReview({
  seasonId,
  changeId,
  onClose,
  onChanged,
}: {
  seasonId: string;
  changeId: string;
  onClose: () => void;
  onChanged: (message?: string) => void;
}) {
  const { data, error } = useQuery({
    queryKey: ["season-rule-change", seasonId, changeId],
    queryFn: () => api.adminGetRuleChange(seasonId, changeId),
    staleTime: 0,
  });
  if (error) return <p className="mt-1 font-semibold text-destructive">{error instanceof ApiError ? error.message : "Couldn't load it."}</p>;
  if (!data) return <p className="mt-1 italic text-muted-foreground">Loading…</p>;
  // Keyed on the version, so a save that moves it on starts the editor from what was stored.
  return <RuleChangeEditor key={`${data.change.id}:${data.change.version}:${data.change.status}`} seasonId={seasonId} change={data.change} onClose={onClose} onChanged={onChanged} />;
}

function RuleChangeEditor({
  seasonId,
  change,
  onClose,
  onChanged,
}: {
  seasonId: string;
  change: SeasonRuleChangeWithReview;
  onClose: () => void;
  onChanged: (message?: string) => void;
}) {
  const queryClient = useQueryClient();
  const [proposal, setProposal] = useState<SeasonCheck>(change.proposal);
  const [episode, setEpisode] = useState<number | null>(change.effectiveEpisode ?? change.review.effectiveEpisode);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const base: FormatData = change.baseData;
  const approved = change.status === "approved";

  const review = useMemo(() => reviewCheck(proposal, base, { effectiveEpisode: episode }), [proposal, base, episode]);

  // Option lists for the rule editors: the season's rules as they stand plus what this change adds.
  const newEventIds = new Set(review.delta.addEvents.map((e) => e.id));
  const ruleFieldProps = {
    events: [...base.events.filter((e) => !newEventIds.has(e.id)), ...review.delta.addEvents].map((e) => ({ id: e.id, label: e.label })),
    exitMethods: [...base.exitMethods, ...review.delta.addExitMethods.map((x) => x.name)],
    questions: [...base.research.checklist, ...review.delta.addQuestions].map((f) => ({ key: f.key, type: f.type })),
    conditionFields: [...base.research.checklist, ...review.delta.addQuestions]
      .filter((f) => !["name", "sources", "confidence"].includes(f.key))
      .map((f) => ({ key: f.key, type: f.type, values: f.values })),
    onCreateEvent: addEvent,
  };
  const categoryOptions = [...base.eventCategories.map((c) => c.label), ...review.delta.addCategories.map((c) => c.label)];
  const problemsForAt = (at: string) => review.problems.filter((p) => p.at === at).map((p) => p.message);
  const shown = new Set<string>([
    ...review.events.flatMap((e) => [`events[${e.id}]`, ...e.rules.map((r) => r.at)]),
    ...review.questions.map((q) => `questions[${q.key}]`),
    ...review.exits.map((x) => `exits[${x.name}]`),
    ...review.retire.map((r) => `retire[${r.event}]`),
    ...review.otherRules.map((r) => r.at),
  ]);
  const leftoverProblems = review.problems.filter((p) => !shown.has(p.at));

  function getRule(at: string): unknown {
    const loc = ruleAtPath(at);
    const list = loc ? proposal.rules?.[loc.list] : undefined;
    return loc && Array.isArray(list) ? list[loc.index] : undefined;
  }
  function setRule(at: string, next: unknown) {
    const loc = ruleAtPath(at);
    if (!loc) return;
    setProposal((p) => {
      const list = Array.isArray(p.rules?.[loc.list]) ? [...(p.rules![loc.list] as unknown[])] : [];
      list[loc.index] = next;
      return { ...p, rules: { ...(p.rules ?? {}), [loc.list]: list } };
    });
  }
  function removeRule(at: string) {
    const loc = ruleAtPath(at);
    if (!loc) return;
    setProposal((p) => ({
      ...p,
      rules: { ...(p.rules ?? {}), [loc.list]: (Array.isArray(p.rules?.[loc.list]) ? (p.rules![loc.list] as unknown[]) : []).filter((_, i) => i !== loc.index) },
    }));
  }
  function updateEvent(id: string, patch: Partial<{ label: string; points: number; category: string }>) {
    setProposal((p) => ({ ...p, events: (p.events ?? []).map((e) => (effectiveEventId(e) === id ? { ...e, ...patch } : e)) }));
  }
  function removeEvent(id: string) {
    setProposal((p) => ({ ...p, events: (p.events ?? []).filter((e) => effectiveEventId(e) !== id) }));
  }
  function updateQuestionType(key: string, type: string) {
    setProposal((p) => ({ ...p, questions: (p.questions ?? []).map((q) => (effectiveQuestionKey(q) === key ? { ...q, type } : q)) }));
  }
  function removeQuestion(key: string) {
    setProposal((p) => ({ ...p, questions: (p.questions ?? []).filter((q) => effectiveQuestionKey(q) !== key) }));
  }
  function removeExit(name: string) {
    setProposal((p) => ({ ...p, exitMethods: (p.exitMethods ?? []).filter((x) => (typeof x === "string" ? x : x.name) !== name) }));
  }
  function removeRetire(event: string) {
    setProposal((p) => ({ ...p, retire: (p.retire ?? []).filter((r) => (typeof r === "string" ? r : r.event) !== event) }));
  }
  // A bare new event straight from a rule's dropdown: 0 points (tracked, not scored) until set.
  function addEvent(label: string): string {
    const stem = camelId(label) || "newEvent";
    const taken = new Set([...(proposal.events ?? []).map((e) => effectiveEventId(e)), ...base.events.map((e) => e.id)]);
    let id = stem;
    for (let n = 2; taken.has(id); n++) id = `${stem}${n}`;
    setProposal((p) => ({ ...p, events: [...(p.events ?? []), { id, label, category: "Other", points: 0, tier: "C", why: "" }] }));
    return id;
  }

  async function save() {
    const res = await api.adminSaveRuleChange(seasonId, change.id, proposal, episode);
    queryClient.setQueryData(["season-rule-change", seasonId, change.id], { change: res.change });
    return res;
  }
  async function run(fn: () => Promise<string | undefined>) {
    setBusy(true);
    setError(null);
    try {
      const message = await fn();
      onChanged(message);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "That didn't work.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-1.5 rounded-md border border-border bg-card p-2.5 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={approved ? "default" : "secondary"}>{STATUS_LABEL[change.status]}</Badge>
        {approved && <span className="text-muted-foreground">v{change.version}</span>}
        <label className="flex items-center gap-1">
          From episode
          <Input
            size="sm"
            type="number"
            min={1}
            className="w-16"
            value={episode ?? ""}
            onChange={(e) => {
              const n = parseInt(e.target.value, 10);
              setEpisode(Number.isInteger(n) && n >= 1 ? n : null);
            }}
          />
        </label>
        <Button variant="secondary" size="xs" className="ml-auto" onClick={onClose}>
          Close
        </Button>
      </div>
      <label className="mt-1.5 flex flex-col gap-0.5">
        <span className="text-[0.65rem] font-bold uppercase tracking-wide text-muted-foreground">What changed (commissioners see this)</span>
        <Textarea rows={2} value={proposal.summary ?? ""} onChange={(e) => setProposal((p) => ({ ...p, summary: e.target.value }))} />
      </label>

      {review.repairs.length > 0 && (
        <div className="mt-2 rounded border border-dashed border-border bg-secondary/40 p-1.5">
          <p className="font-semibold">Left out or repaired while reading the answer:</p>
          <ul className="mt-0.5 flex flex-col gap-0.5 text-muted-foreground">
            {review.repairs.map((r, i) => (
              <li key={i}>
                <code className="font-mono text-[0.65rem]">{r.at}</code>: {r.message}
              </li>
            ))}
          </ul>
        </div>
      )}
      {leftoverProblems.length > 0 && (
        <div className="mt-2 rounded border border-destructive/40 bg-destructive/5 p-1.5">
          {leftoverProblems.map((p, i) => (
            <p key={i} className="font-semibold text-destructive">
              ! {p.message}
            </p>
          ))}
        </div>
      )}

      <Section title="New scoring events">
        {review.events.length === 0 && <p className="text-muted-foreground">None.</p>}
        {review.events.map((ev) => {
          const allProblems = [...ev.problems, ...ev.rules.flatMap((r) => problemsForAt(r.at))];
          return (
            <div key={ev.id} className={cn("rounded-md border px-2.5 py-1.5", allProblems.length ? "border-destructive/40" : "border-border")}>
              <div className="flex flex-wrap items-center gap-1.5">
                <TierChip tier={ev.tier} />
                {ev.implied && <span className="text-[0.65rem] text-muted-foreground">(automatic)</span>}
                <Input
                  size="sm"
                  className="min-w-[140px] flex-1"
                  defaultValue={ev.label}
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    if (v && v !== ev.label) updateEvent(ev.id, { label: v });
                  }}
                />
                <Input
                  size="sm"
                  type="number"
                  step="0.5"
                  className="w-16"
                  title="Suggested points -- each league's commissioner decides"
                  defaultValue={ev.points}
                  onBlur={(e) => {
                    const n = parseFloat(e.target.value);
                    if (Number.isFinite(n) && n !== ev.points) updateEvent(ev.id, { points: n });
                  }}
                />
                <CategorySelect value={ev.category} categories={categoryOptions} onChange={(v) => updateEvent(ev.id, { category: v })} />
                {ev.newCategory && <span className="text-[0.65rem] text-muted-foreground">new category</span>}
                <button className="text-muted-foreground underline-offset-2 hover:text-destructive hover:underline" onClick={() => removeEvent(ev.id)}>
                  remove
                </button>
              </div>
              <Notes problems={ev.problems} warnings={ev.warnings} />
              {ev.why && <p className="mt-0.5 text-[0.7rem] italic text-muted-foreground">{ev.why}</p>}
              {ev.rules.length > 0 && (
                <ul className="mt-1 flex flex-col gap-1 text-[0.7rem] text-muted-foreground">
                  {ev.rules.map((r) => (
                    <li key={r.at}>
                      <RuleLine
                        sentence={r.sentence}
                        problems={problemsForAt(r.at)}
                        rule={getRule(r.at)}
                        onApply={(next) => setRule(r.at, next)}
                        onRemove={() => removeRule(r.at)}
                        context={ruleAtPath(r.at)?.list ?? "research"}
                        {...ruleFieldProps}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </Section>

      {review.otherRules.length > 0 && (
        <Section title="Other new rules">
          {review.otherRules.map((r) => (
            <div key={r.at} className="rounded-md border border-border px-2.5 py-1.5">
              <RuleLine
                sentence={r.sentence}
                problems={problemsForAt(r.at)}
                rule={getRule(r.at)}
                onApply={(next) => setRule(r.at, next)}
                onRemove={() => removeRule(r.at)}
                context={ruleAtPath(r.at)?.list ?? "research"}
                {...ruleFieldProps}
              />
            </div>
          ))}
        </Section>
      )}

      <Section title="New questions research asks">
        {review.questions.length === 0 && <p className="text-muted-foreground">None.</p>}
        {review.questions.map((q) => (
          <div key={q.key} className={cn("rounded-md border px-2.5 py-1.5", q.problems.length ? "border-destructive/40" : "border-border")}>
            <div className="flex flex-wrap items-center gap-1.5">
              <TierChip tier={q.tier} />
              <code className="font-mono text-[0.7rem]">{q.key}</code>
              <span className="min-w-0 flex-1">{q.question}</span>
              <Select size="sm" value={q.type} onChange={(e) => updateQuestionType(q.key, e.target.value)}>
                {QUESTION_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Select>
              <button className="text-muted-foreground underline-offset-2 hover:text-destructive hover:underline" onClick={() => removeQuestion(q.key)}>
                remove
              </button>
            </div>
            <Notes problems={q.problems} warnings={q.warnings} />
          </div>
        ))}
      </Section>

      {review.exits.length > 0 && (
        <Section title="New ways of leaving">
          {review.exits.map((x) => (
            <div key={x.name} className="flex flex-wrap items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5">
              <b>{x.name}</b>
              <span className="text-muted-foreground">({x.kind === "finalist" ? "reaches the end" : "out"})</span>
              {x.meaning && <span className="text-muted-foreground">— {x.meaning}</span>}
              <button className="ml-auto text-muted-foreground underline-offset-2 hover:text-destructive hover:underline" onClick={() => removeExit(x.name)}>
                remove
              </button>
              <Notes problems={problemsForAt(`exits[${x.name}]`)} warnings={x.warnings} />
            </div>
          ))}
        </Section>
      )}

      {review.retire.length > 0 && (
        <Section title="Events that stop">
          {review.retire.map((r) => (
            <div key={r.event} className="flex flex-wrap items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5">
              <code className="font-mono text-[0.7rem]">{r.event}</code>
              {r.why && <span className="text-muted-foreground">— {r.why}</span>}
              <button className="ml-auto text-muted-foreground underline-offset-2 hover:text-destructive hover:underline" onClick={() => removeRetire(r.event)}>
                remove
              </button>
              <Notes problems={r.problems} warnings={[]} />
            </div>
          ))}
        </Section>
      )}

      {review.flagged.length > 0 && (
        <Section title="Flagged — needs a developer">
          {review.flagged.map((f) => (
            <div key={f.name} className="rounded-md border border-dashed border-destructive/40 bg-destructive/5 p-1.5">
              <p>
                <b>{f.name}</b> — {f.what}
              </p>
              {f.whyCode && <p className="text-muted-foreground">Why it needs code: {f.whyCode}</p>}
              {f.findings && <p className="text-muted-foreground">{f.findings}</p>}
              <p className="mt-0.5 font-semibold">Approving doesn&rsquo;t add this — only the additions above.</p>
            </div>
          ))}
        </Section>
      )}

      {review.notTrackable.length > 0 && (
        <details className="mt-2.5">
          <summary className="cursor-pointer text-[0.65rem] font-bold uppercase tracking-wide text-muted-foreground">
            Not reliably trackable ({review.notTrackable.length})
          </summary>
          <ul className="mt-1 flex flex-col gap-0.5 text-muted-foreground">
            {review.notTrackable.map((t, i) => (
              <li key={i}>
                <b>{t.fact}</b>
                {t.why ? ` — ${t.why}` : ""}
              </li>
            ))}
          </ul>
        </details>
      )}

      {review.sources.length > 0 && (
        <details className="mt-2.5">
          <summary className="cursor-pointer text-[0.65rem] font-bold uppercase tracking-wide text-muted-foreground">Sources ({review.sources.length})</summary>
          <ul className="mt-1 flex flex-col gap-0.5">
            {review.sources.map((s) => (
              <li key={s} className="truncate">
                {/^https?:\/\//.test(s) ? (
                  <a href={s} target="_blank" rel="noreferrer" className="underline underline-offset-2">
                    {s}
                  </a>
                ) : (
                  s
                )}
              </li>
            ))}
          </ul>
        </details>
      )}

      {error && <p className="mt-2 font-semibold text-destructive">{error}</p>}
      {review.problems.length > 0 && (
        <p className="mt-2 font-semibold text-destructive">
          {review.problems.length} problem{review.problems.length === 1 ? "" : "s"} to fix before {approved ? "saving" : "approving"}.
        </p>
      )}
      {!review.changed && <p className="mt-2 text-muted-foreground">This answer says nothing changed, so there&rsquo;s nothing to approve.</p>}

      <div className="mt-2.5 flex flex-wrap items-center gap-1.5 border-t border-border pt-2.5">
        {approved ? (
          <Button
            size="xs"
            disabled={busy || !review.approvable}
            title="Saving moves it to a new version. Leagues that adopted the old one keep it until their commissioner reviews this one."
            onClick={() =>
              run(async () => {
                const res = await save();
                return `Saved — leagues on this season are offered the new version.${missedLeagues(res.leaguesFailed)}`;
              })
            }
          >
            Save changes
          </Button>
        ) : (
          <>
            <Button
              size="xs"
              disabled={busy || !review.approvable}
              title={review.approvable ? "Research asks its questions from the effective episode, and every league on the season is offered it" : "Fix every problem first"}
              onClick={() =>
                run(async () => {
                  await save();
                  const res = await api.adminApproveRuleChange(seasonId, change.id);
                  onClose();
                  return `Approved — in force from episode ${res.change.effectiveEpisode}, offered to ${res.leaguesUpdated} league${res.leaguesUpdated === 1 ? "" : "s"}.${missedLeagues(res.leaguesFailed)}`;
                })
              }
            >
              Approve
            </Button>
            <Button
              variant="secondary"
              size="xs"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  await save();
                  return "Draft saved.";
                })
              }
            >
              Save as draft
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mt-2.5">
      <div className="mb-1 text-[0.65rem] font-bold uppercase tracking-wide text-muted-foreground">{title}</div>
      <div className="flex flex-col gap-1.5">{children}</div>
    </div>
  );
}
