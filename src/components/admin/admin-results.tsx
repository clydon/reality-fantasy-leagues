"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import type { LeagueDecisionSync, ModelUsage, ResearchCastaway, SeasonResearchResult } from "@/lib/game/types";
import { AI_MODELS, costOf, formatCost } from "@/lib/ai-cost";
import { formatFor, withChanges } from "@/lib/game/formats/index.js";
import { useShowPaidAi, useShowSpoilers } from "@/lib/paid-ai-store";
import { CaptionPlate } from "@/components/ui/caption-plate";
import { ActButton, Cost, count } from "./admin-ui";
import { cn } from "cn";

// What a finished admin action did, said plainly next to where it was run: a wiki pull, an episode's
// research, and accepting results into leagues. Spoiler-safe: with "Show episode results" off, anything
// that would name a castaway or an outcome is a count.

export function modelLabel(id: string | null | undefined) {
  return AI_MODELS.find((m) => m.id === id)?.label ?? id ?? "";
}

/** What a finished call actually cost, from the usage the API reported. */
export function SpentNote({ model, usage, cached }: { model?: string | null; usage?: ModelUsage | null; cached: boolean }) {
  if (cached) return <Cost title="Nothing was sent to the model">Free, nothing new to read.</Cost>;
  const usd = costOf(model, usage);
  if (usd == null) return null;
  const tokens = usage ? `${usage.input_tokens} in / ${usage.output_tokens} out` : "";
  const searches = usage?.web_search_requests ? `, ${usage.web_search_requests} searches` : "";
  return <Cost title={`${modelLabel(model)}: ${tokens} tokens${searches}`}>Cost {formatCost(usd)}.</Cost>;
}

const box = "flex flex-col gap-1.5 rounded-[3px] bg-card px-3.5 py-3 text-sm";

/**
 * What one episode's research found. The summary says what happened to the RESULTS (they're review
 * items now); the full checklist is behind a toggle, and lists every castaway, including the ones
 * nothing was found for -- telling "asked, nothing found" apart from "never asked" is the point.
 */
// Research's rules tripwire (db/episode-research.js rulesNote): something new about how the season is
// played. Up front, not in Details, with the one thing to do about it -- the rule check is a separate
// prompt, and a note nobody acts on means the checklist quietly stops matching the show.
// The alert strip's shape (a caption plate with a chyron tag), so it reads as a to-do, not a notice.
// The tag is its one yellow: after research the review button below is usually the other "now".
function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function RulesTripwire({ note, href }: { note: string; href: string }) {
  const showSpoilers = useShowSpoilers();
  return (
    <div role="alert" className="flex flex-col gap-2">
      {/* The chevron alone is the action, so the title still fits a 320px phone. */}
      <CaptionPlate
        tag="New"
        title="Rules changed?"
        subtitle="Research spotted something"
        action={<span className="sr-only">Check the rules</span>}
        href={href}
      />
      <p className="text-[13px] leading-snug text-muted-foreground">
        {showSpoilers ? (
          <>
            <span className="text-foreground">{note}</span>{" "}
          </>
        ) : (
          "What research found stays hidden until you tick “Show episode results”. "
        )}
        Check before the next episode. If the rules did change, research this episode again afterwards so the new questions get asked.
      </p>
    </div>
  );
}

export function ResearchResult({
  research,
  busy,
  onForce,
  forceCost,
  rulesHref,
}: {
  research: SeasonResearchResult;
  busy: boolean;
  onForce: () => void;
  forceCost: string;
  /** Where the rules tripwire's button goes; no button (and no callout) without one. */
  rulesHref?: string;
}) {
  const [open, setOpen] = useState(false);
  const showPaid = useShowPaidAi();
  const showSpoilers = useShowSpoilers();
  const { payload, provenance, counts, problems } = research;
  const notesFor = (c: ResearchCastaway) => withChanges(formatFor(provenance.format, research.formatData), research.ruleChanges).research.notes(c);
  const noted = payload.castaways.filter((c) => notesFor(c).length > 0);
  const quiet = payload.castaways.filter((c) => notesFor(c).length === 0);
  const newItems = research.decisions?.inserted ?? 0;

  return (
    <>
      {payload.rulesNote && rulesHref && <RulesTripwire note={payload.rulesNote} href={rulesHref} />}
      <div className={box} role="status">
        <p>
          <b>{research.cached ? "Already researched, reused." : "Researched."}</b> {noted.length} of {counts.castaways} had something to note;{" "}
          {newItems ? `${count(newItems, "new result")} to review.` : "nothing new to review."}{" "}
          {provenance.pasteMode === "json" ? (
            <Cost title="Pasted as JSON and read directly; nothing was sent to a model">Free.</Cost>
          ) : (
            <SpentNote model={provenance.model} usage={provenance.usage} cached={research.cached} />
          )}
        </p>
        {provenance.domainsBlocked?.length ? (
          <p className="text-muted-foreground">
            {provenance.domainsBlocked.join(", ")} block{provenance.domainsBlocked.length === 1 ? "s" : ""} Anthropic&rsquo;s search, so{" "}
            {provenance.domainsBlocked.length === 1 ? "it was" : "they were"} skipped. Remove {provenance.domainsBlocked.length === 1 ? "it" : "them"} from the
            show&rsquo;s research sites.
          </p>
        ) : null}
        {problems.length > 0 &&
          (showSpoilers ? (
            <ul className="text-destructive">
              {problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          ) : (
            <p className="text-destructive">{count(problems.length, "answer")} to double-check. Show names to see them.</p>
          ))}
        <span className="flex flex-wrap items-center gap-2">
          {/* The details are the episode's events, by name: off-limits with spoilers off. */}
          {showSpoilers && (
            <ActButton onClick={() => setOpen((v) => !v)}>
              <ChevronRight className={cn("size-4 transition-transform", open && "rotate-90")} strokeWidth={2.4} aria-hidden />
              {open ? "Hide details" : "Details"}
            </ActButton>
          )}
          {showPaid && (
            <>
              <ActButton disabled={busy} onClick={onForce}>
                Research again
              </ActButton>
              <Cost>{forceCost}</Cost>
            </>
          )}
        </span>
        {open && showSpoilers && (
          <div className="flex flex-col gap-2 border-t border-border pt-2">
            <p>{payload.summary}</p>
            {payload.rulesNote && (
              <p>
                <b>Rules note:</b> {payload.rulesNote} <span className="text-muted-foreground">See the season&rsquo;s Rules tab.</span>
              </p>
            )}
            <ul className="flex flex-col gap-1">
              {noted.map((c) => (
                <li key={c.name} className="flex flex-wrap items-baseline gap-1.5">
                  <span
                    className={cn(
                      "rounded-[2px] px-1 text-[10px] font-bold uppercase tracking-wide",
                      c.confidence === "high" ? "bg-good/20 text-good" : c.confidence === "medium" ? "bg-muted text-muted-foreground" : "bg-chyron/20 text-chyron-line",
                    )}
                  >
                    {c.confidence}
                  </span>
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
            {payload.sourcesRead?.length ? (
            <div>
              <b>Pages read</b>
              <ul className="ml-4 list-disc">
                {payload.sourcesRead.map((s) => (
                  <li key={s.url}>
                    <a href={s.url} target="_blank" rel="noreferrer" className="underline underline-offset-2">
                      {hostOf(s.url)}
                    </a>{" "}
                    <span className="text-muted-foreground">
                      {s.published ? `published ${s.published}` : "no date shown"}
                      {s.updated && s.updated !== s.published ? `, updated ${s.updated}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {provenance.castSkipped?.length ? (
              <p className="text-muted-foreground">
                <b>Not asked (already out):</b> {provenance.castSkipped.join(", ")}
              </p>
            ) : null}
            {quiet.length > 0 && (
              <p className="text-muted-foreground">
                <b>Asked, nothing found:</b> {quiet.map((c) => c.name).join(", ")}
              </p>
            )}
            {(payload.betAnswers || []).length > 0 && (
              <div>
                <b>Predictions settled</b> <span className="text-muted-foreground">(shown to commissioners when they grade)</span>
                <ul className="ml-4 list-disc">
                  {(payload.betAnswers || []).map((b) => (
                    <li key={b.question}>
                      {b.question}: <b>{b.answer ?? "couldn’t tell"}</b>
                      {b.answer && <span className="text-muted-foreground"> ({b.confidence})</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              {counts.sourced} sourced · {counts.lowConfidence} low confidence · {counts.unknowns} unknown ·{" "}
              {provenance.provider === "paste"
                ? provenance.pasteMode === "json"
                  ? "pasted JSON"
                  : "pasted notes, structured"
                : `${provenance.pagesRead.length} pages read`}
              {provenance.model ? ` · ${modelLabel(provenance.model)}` : ""}
            </p>
          </div>
        )}
      </div>
    </>
  );
}

/** What accepting or deciding results did in each league, as one line plus any problems. */
export function syncSummary(leagues: LeagueDecisionSync[], showSpoilers: boolean): { text: string; problems: string[] } {
  const applied = leagues.reduce((n, l) => n + l.applied, 0);
  const undone = leagues.reduce((n, l) => n + l.undone, 0);
  const skipped = leagues.flatMap((l) => l.skipped.map((s) => `${l.leagueName}: ${s.name}, ${s.why}`));
  const problems = [
    ...leagues.filter((l) => l.error).map((l) => `${l.leagueName}: ${l.error}`),
    // Who couldn't be applied names a castaway: a count only with spoilers off.
    ...(showSpoilers || !skipped.length ? skipped : [`${count(skipped.length, "result")} couldn't be applied. Show names to see which.`]),
  ];
  const parts = [applied && `${applied} applied`, undone && `${undone} undone`].filter(Boolean);
  return {
    text: leagues.length
      ? `${count(leagues.length, "league")} updated${parts.length ? ` (${parts.join(", ")})` : ""}.`
      : "No league plays this season yet. They'll get these results when they pick it.",
    problems,
  };
}
