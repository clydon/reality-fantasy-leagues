"use client";

import { useMemo, useState } from "react";
import type { FormatData } from "@/lib/game/formats/index";
import { reviewRuleset } from "@/lib/game/formats/ruleset-review.js";
import { camelId } from "@/lib/game/formats/proposal.js";
import { BarButton, ConfirmBar, PlainButton } from "@/components/draft/draft-ui";
import { Input } from "@/components/ui/input";
import { Notes, CategorySelect, RuleLine, ruleAtPath } from "@/components/formats/format-review-screen";
import { cn } from "cn";

// The editable half of League Settings > Scoring & rules, on its own page, /setup/rules/edit
// (docs/PLAN-scoring-rules-as-data.md phase 4): a league's OWN ruleset copy, as a list of rules a commissioner can read and change. Reuses
// format-review-screen.tsx's row pieces (RuleLine etc.) exactly like season-rule-check.tsx does, but
// drives them straight off a FormatData instead of a raw AI proposal -- there's no chat answer to
// repair here, only edits a commissioner makes on purpose, re-validated live by reviewRuleset.
//
// Deliberately narrower than the admin's format-review-screen:
//  - No "+ New question": a league's own checklist can't gain a question research doesn't already
//    ask (research runs once per show, from the SHOW's format, not a league's copy of it -- a new
//    question here would never be answered). Conditions can only reference questions the format
//    already has.
//  - No points field on an event, unlike the admin screen's: state-logic.js's normalization
//    unconditionally backfills settings.eventPoints with every event's current default on every load
//    ({...defaultEventPoints(s), ...existingOverrides}), and ActiveRosterLogic.pointsFor reads THAT
//    first -- so by the time a league has loaded even once, its own defaultPoints edit here would
//    silently never affect a real score. Points stay the Scoring & rules page's job
//    (settings.eventPoints, already live and working); this screen edits what award/condition rules
//    the event, not what it's worth.
//  - No event/question removal, no raw rules-block JSON escape hatch, no research-site picker: this
//    is "edit what's here", not "draft a new format" (that's the admin screen's job).
export function LeagueRulesetEditor({
  data,
  onSave,
  onCancel,
  busy,
  error,
}: {
  data: FormatData;
  onSave: (next: FormatData) => void;
  onCancel: () => void;
  busy: boolean;
  error: string | null;
}) {
  const [draft, setDraft] = useState(data);
  const review = useMemo(() => reviewRuleset(draft), [draft]);
  const at = (prefix: string) => (x: { at: string }) => x.at === prefix;
  const problemsForAt = (prefix: string) => review.problems.filter(at(prefix)).map((p) => p.message);

  const ruleFieldProps = {
    events: draft.events.map((e) => ({ id: e.id, label: e.label })),
    exitMethods: draft.exitMethods,
    questions: review.questions,
    conditionFields: draft.research.checklist
      .filter((f) => !["name", "sources", "confidence"].includes(f.key))
      .map((f) => ({ key: f.key, type: f.type, values: f.values })),
    onCreateEvent: addEvent,
  };

  function getRule(ruleAt: string): unknown {
    const loc = ruleAtPath(ruleAt);
    const list = loc ? draft.rules[loc.list] : undefined;
    return loc && Array.isArray(list) ? list[loc.index] : undefined;
  }
  function setRule(ruleAt: string, next: unknown) {
    const loc = ruleAtPath(ruleAt);
    if (!loc) return;
    setDraft((d) => {
      const list = [...d.rules[loc.list]];
      list[loc.index] = next as (typeof list)[number];
      return { ...d, rules: { ...d.rules, [loc.list]: list } };
    });
  }
  function removeRule(ruleAt: string) {
    const loc = ruleAtPath(ruleAt);
    if (!loc) return;
    setDraft((d) => ({ ...d, rules: { ...d.rules, [loc.list]: d.rules[loc.list].filter((_, i) => i !== loc.index) } }));
  }
  function addRuleForEvent(eventId: string) {
    setDraft((d) => ({
      ...d,
      rules: { ...d.rules, research: [...d.rules.research, { when: { answer: "", is: "yes" }, award: eventId }] },
    }));
  }
  function addOtherRule() {
    setDraft((d) => ({ ...d, rules: { ...d.rules, research: [...d.rules.research, { when: { answer: "", is: "yes" } }] } }));
  }
  function updateEvent(id: string, patch: Partial<{ label: string; category: string }>) {
    setDraft((d) => {
      const events = d.events.map((e) => (e.id === id && patch.label !== undefined ? { ...e, label: patch.label } : e));
      if (patch.category === undefined) return { ...d, events };
      // A category move: drop the id from wherever it lives today, add it to the chosen one
      // (making a new category row if the name doesn't exist yet -- CategorySelect's own "+ New…").
      let categories = d.eventCategories.map((c) => ({ ...c, events: c.events.filter((eid) => eid !== id) }));
      let target = categories.find((c) => c.label === patch.category);
      if (!target) {
        target = { id: camelId(patch.category) || `group${categories.length + 1}`, label: patch.category, events: [] };
        categories = [...categories, target];
      }
      categories = categories.map((c) => (c === target ? { ...c, events: [...c.events, id] } : c));
      return { ...d, events, eventCategories: categories };
    });
  }
  // Same fallback as the admin screen: a built-in rule param with no valid event to point at yet
  // (votedForLeaver's "otherwise") gets a bare one, right from that dropdown -- filed under "Other"
  // (made fresh if this ruleset has none yet) so it's never invisible: a FormatData event only shows
  // up in a category's own grid, unlike a Proposal row where category is just a field. defaultPoints
  // starts at 0 only as a placeholder the data shape requires; the league's normalization seeds
  // settings.eventPoints from it the first time the league loads with this event in its catalog, and
  // the Scoring & rules page (not this screen, see the file comment above) is where a commissioner sets
  // its real value.
  function addEvent(label: string): string {
    const base = camelId(label) || "newEvent";
    const taken = new Set(draft.events.map((e) => e.id));
    let id = base;
    for (let n = 2; taken.has(id); n++) id = `${base}${n}`;
    setDraft((d) => {
      let other = d.eventCategories.find((c) => c.label === "Other");
      const categories = other
        ? d.eventCategories.map((c) => (c === other ? { ...c, events: [...c.events, id] } : c))
        : [...d.eventCategories, (other = { id: "other", label: "Other", events: [id] })];
      return { ...d, events: [...d.events, { id, label, defaultPoints: 0 }], eventCategories: categories };
    });
    return id;
  }

  return (
    <div className="mt-2 flex flex-col gap-3">
      <p className="text-[13px] text-muted-foreground">
        What triggers each event, and under what condition. Points are set on the Scoring &amp; rules page, not here.
      </p>
      {review.leftoverProblems.length > 0 && (
        <div className="rounded border border-destructive/40 bg-destructive/5 p-1.5 text-[0.7rem]">
          <p className="font-semibold text-destructive">Other problems:</p>
          <ul className="mt-0.5 flex flex-col gap-0.5">
            {review.leftoverProblems.map((p, i) => (
              <li key={i}>
                <code className="font-mono text-[0.65rem] text-muted-foreground">{p.at}</code>: {p.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {review.categories.map((g) => (
          <div key={g.label}>
            <div className="mb-1 text-[0.65rem] font-bold uppercase tracking-wide text-muted-foreground">{g.label}</div>
            <div className="flex flex-col gap-1.5">
              {g.events.map((ev) => {
                const allProblems = [...ev.problems, ...ev.rules.flatMap((r) => problemsForAt(r.at))];
                return (
                  <div key={ev.id} className={cn("rounded-md border px-2.5 py-1.5", allProblems.length ? "border-destructive/40" : "border-border")}>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {ev.implied && (
                        <span className="text-[0.65rem] text-muted-foreground" title="Scored automatically from how they left -- can't be added by hand">
                          (automatic)
                        </span>
                      )}
                      <Input
                        size="sm"
                        className="min-w-[140px] flex-1"
                        defaultValue={ev.label}
                        onBlur={(e) => {
                          const v = e.target.value.trim();
                          if (v && v !== ev.label) updateEvent(ev.id, { label: v });
                        }}
                      />
                      <CategorySelect
                        value={g.label}
                        categories={review.categoryOptions}
                        onChange={(v) => updateEvent(ev.id, { category: v })}
                      />
                    </div>
                    {ev.problems.length > 0 && (
                      <div className="mt-1 rounded border border-destructive/40 bg-destructive/5 p-1.5 text-[0.7rem]">
                        {ev.problems.map((p) => (
                          <p key={p} className="font-semibold text-destructive">
                            ! {p} -- see the rules below
                          </p>
                        ))}
                      </div>
                    )}
                    {ev.rules.length > 0 && (
                      <ul className={cn("mt-1 flex flex-col text-[0.7rem] text-muted-foreground", ev.rules.length > 1 ? "gap-1.5" : "gap-1")}>
                        {ev.rules.map((r) => (
                          <li key={r.at} className={cn(ev.rules.length > 1 && "rounded-md border border-border bg-card px-2 py-1.5")}>
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
                    <button
                      className="mt-1 text-[0.65rem] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                      onClick={() => addRuleForEvent(ev.id)}
                    >
                      + Add rule
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div>
        <div className="mb-1 flex items-center gap-2 text-[0.65rem] font-bold uppercase tracking-wide text-muted-foreground">
          <span>Other rules</span>
          <button className="font-normal normal-case text-muted-foreground underline-offset-2 hover:text-foreground hover:underline" onClick={addOtherRule}>
            + Add rule
          </button>
        </div>
        {review.otherRules.length > 0 && (
          <ul className="flex flex-col gap-1">
            {review.otherRules.map((r) => (
              <li key={r.at} className="rounded-md border border-border px-2.5 py-1.5">
                <RuleLine
                  sentence={r.sentence}
                  problems={r.problems}
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

      {error && <p className="font-semibold text-destructive">{error}</p>}
      {review.problems.length > 0 && (
        <Notes problems={[`${review.problems.length} problem${review.problems.length === 1 ? "" : "s"} to fix before saving.`]} warnings={[]} />
      )}
      {/* Sticky above the tab bar, so saving doesn't mean scrolling to the end of a long list. */}
      <ConfirmBar
        note={review.problems.length ? "Fix the problems above first" : "Nothing applies until you save"}
        title={draft === data ? "No changes" : "Unsaved changes"}
      >
        <PlainButton disabled={busy} onClick={onCancel}>
          Cancel
        </PlainButton>
        <BarButton disabled={busy || !review.approvable || draft === data} onClick={() => onSave(draft)}>
          {busy ? "Saving…" : "Save"}
        </BarButton>
      </ConfirmBar>
    </div>
  );
}
