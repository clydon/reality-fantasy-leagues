"use client";

import type { FormatData, ScoringRule } from "@/lib/game/formats/index.js";
import { describeRule, BUILT_INS } from "@/lib/game/formats/rules.js";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

// A read-only version of the stored-format review screen's event list (format-review-screen.tsx),
// for a format nobody can edit here -- a built-in (Survivor, The Traitors...) or an already-approved
// stored one looked at from a show's settings rather than from "Researched show formats". Same
// layout (events by category, rules as sentences) with every edit control stripped out.

function awardsOf(rule: ScoringRule): string[] {
  const out: string[] = [];
  if (typeof rule.award === "string") out.push(rule.award);
  const b = rule.builtIn && (BUILT_INS as Record<string, { params: Record<string, { type: string }> }>)[rule.builtIn];
  if (b) {
    for (const [k, spec] of Object.entries(b.params)) {
      if (spec.type === "event" && typeof rule[k] === "string" && k !== "award") out.push(rule[k] as string);
    }
  }
  return out;
}

function pointsOf(points: number | { exclusive: number; shared: number }): string {
  return typeof points === "number" ? String(points) : `${points.exclusive} excl. / ${points.shared} shared`;
}

export function FormatRulesView({
  data,
  onClose,
  badge = "Built-in — read only",
}: {
  data: FormatData;
  onClose: () => void;
  /** src/components/setup/rules-section.tsx reuses this for a league's own (possibly non-built-in) rules. */
  badge?: string;
}) {
  const research = data.rules.research ?? [];
  const implied = data.rules.implied ?? [];
  const allRules: { at: string; r: ScoringRule }[] = [
    ...research.map((r, i) => ({ r, at: `research[${i}]` })),
    ...implied.map((r, i) => ({ r, at: `implied[${i}]` })),
  ];
  const rulesFor = (eid: string) =>
    allRules.filter(({ r }) => awardsOf(r).includes(eid)).map(({ r, at }) => ({ at, sentence: describeRule(r, data) }));
  const eventsById = new Map(data.events.map((e) => [e.id, e]));
  const categorized = new Set(data.eventCategories.flatMap((c) => c.events));
  const uncategorized = data.events.filter((e) => !categorized.has(e.id));

  return (
    <div className="mt-2 rounded-md border border-border bg-card p-3 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        <h4 className="text-sm font-bold">{data.name}</h4>
        <Badge variant="secondary">{badge}</Badge>
        <Button variant="secondary" size="xs" className="ml-auto" onClick={onClose}>
          Close
        </Button>
      </div>

      <div className="mt-3 flex flex-col gap-3">
        {[...data.eventCategories, ...(uncategorized.length ? [{ id: "other", label: "Other", events: uncategorized.map((e) => e.id) }] : [])].map((cat) => (
          <div key={cat.id}>
            <div className="mb-1 text-[0.65rem] font-bold uppercase tracking-wide text-muted-foreground">{cat.label}</div>
            <div className="flex flex-col gap-1.5">
              {cat.events.map((eid) => {
                const ev = eventsById.get(eid);
                if (!ev) return null;
                return (
                  <div key={eid} className="rounded-md border border-border px-2.5 py-1.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {ev.implied && (
                        <span className="text-[0.65rem] text-muted-foreground" title="Scored automatically from how they left -- can't be added by hand">
                          (automatic)
                        </span>
                      )}
                      <span className="flex-1 text-[0.8rem] font-medium">{ev.label}</span>
                      <span className="tabular-nums text-muted-foreground">{pointsOf(ev.defaultPoints)} pts</span>
                    </div>
                    {rulesFor(eid).length > 0 && (
                      <ul className="mt-0.5 flex flex-col gap-0.5 text-[0.7rem] text-muted-foreground">
                        {rulesFor(eid).map((r) => (
                          <li key={r.at}>{r.sentence}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3">
        <div className="mb-1 text-[0.65rem] font-bold uppercase tracking-wide text-muted-foreground">Questions research answers</div>
        <ul className="flex flex-col gap-1">
          {data.research.checklist.map((q) => (
            <li key={q.key} className="rounded-md border border-border px-2.5 py-1.5">
              <code className="font-mono text-[0.7rem]">{q.key}</code> {q.description}
              <span className="text-muted-foreground"> ({q.type}{q.note ? `, “${q.note}”` : ""})</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-3">
        <div className="mb-1 text-[0.65rem] font-bold uppercase tracking-wide text-muted-foreground">Exit methods</div>
        <ul className="flex flex-wrap gap-1.5">
          {data.exitMethods.map((name) => (
            <li key={name} className="rounded-md border border-border px-2 py-1">
              <b>{name}</b>{" "}
              <span className="text-muted-foreground">
                ({name === data.winnerExitMethod ? "winner" : data.endgameExitMethods.includes(name) ? "finalist" : "out"})
              </span>
            </li>
          ))}
        </ul>
      </div>

      {data.roles && (
        <div className="mt-3">
          <div className="mb-1 text-[0.65rem] font-bold uppercase tracking-wide text-muted-foreground">Roles</div>
          <p>
            Default: <b>{data.roles.default}</b>. Can become: <b>{data.roles.values.join(", ")}</b>.
          </p>
        </div>
      )}
    </div>
  );
}
