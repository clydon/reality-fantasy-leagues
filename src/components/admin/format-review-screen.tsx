"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import type { AdminShow, Proposal, StoredFormat } from "@/lib/game/types";
import { reviewProposal, camelId } from "@/lib/game/formats/proposal.js";
import { BUILT_INS } from "@/lib/game/formats/rules.js";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { confirm } from "@/lib/confirm-store";
import { m, AnimatePresence } from "@/components/motion";
import { cn } from "cn";

// The row pieces (RuleLine, Notes, TierChip, CategorySelect, ...) are exported for the season "check
// for rule changes" review (season-rule-check.tsx), which edits the same kinds of rows.
//
// Step 3's review screen (docs/PLAN-stage-3-format-proposals.md): everything is built from
// `reviewProposal(proposal, { id })` -- a pure, browser-safe function -- so every edit here changes
// the PROPOSAL (never the derived data) and the problems/warnings/sentences below update live. The
// server re-derives the same thing on save and on approve.

// Mirrors proposal.js's own `ID` regex: a row's effective id, for matching an edit back to its row
// in the proposal even when the chat's raw id needed repairing into camelCase.
const VALID_ID = /^[a-z][A-Za-z0-9]*$/;
export function effectiveEventId(e: { id?: unknown; label?: unknown }): string {
  const raw = typeof e.id === "string" ? e.id.trim() : "";
  return VALID_ID.test(raw) ? raw : camelId(raw || (typeof e.label === "string" ? e.label : "") || "");
}
export function effectiveQuestionKey(q: { key?: unknown; question?: unknown }): string {
  const raw = typeof q.key === "string" ? q.key.trim() : "";
  return VALID_ID.test(raw) ? raw : camelId(raw || (typeof q.question === "string" ? q.question : "") || "");
}

// Mirrors proposal.js's own list -- not exported from there, so kept in sync by hand.
export const QUESTION_TYPES = ["answer", "integer", "string", "stringList", "enum"];

const isRuleObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const humanize = (k: string) => k.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/^./, (c) => c.toUpperCase());

// ---------- condition editing: "when { answer, is/isNot/equals/greaterThan/present }", and a flat
// "all" list of those -- the shape almost every rule's `when` actually uses. Mirrors rules.js's own
// OPS_FOR (not exported from there). "any"/"not"/nesting fall back to a scoped JSON box, same as a
// built-in's condition params (isRole/notRole) with more structure than this covers.
const OPS_FOR: Record<string, string[]> = {
  answer: ["is", "isNot"],
  string: ["is", "isNot", "present"],
  enum: ["is", "isNot", "present"],
  exitMethod: ["is", "isNot", "present"],
  integer: ["equals", "greaterThan"],
  stringList: ["present"],
};
const OP_LABELS: Record<string, string> = { is: "is", isNot: "isn't", equals: "equals", greaterThan: "is more than", present: "is" };

interface Leaf {
  answer: string;
  op: "is" | "isNot" | "equals" | "greaterThan" | "present";
  value: unknown;
}
export interface ConditionField {
  key: string;
  type: string;
  values?: string[];
}

function leafFromCond(c: unknown): Leaf | null {
  if (!isRuleObj(c) || typeof c.answer !== "string") return null;
  if (typeof c.is === "string") return { answer: c.answer, op: "is", value: c.is };
  if (typeof c.isNot === "string") return { answer: c.answer, op: "isNot", value: c.isNot };
  if (typeof c.equals === "number") return { answer: c.answer, op: "equals", value: c.equals };
  if (typeof c.greaterThan === "number") return { answer: c.answer, op: "greaterThan", value: c.greaterThan };
  if (typeof c.present === "boolean") return { answer: c.answer, op: "present", value: c.present };
  return null;
}
function condFromLeaf(l: Leaf): Record<string, unknown> {
  return { answer: l.answer, [l.op]: l.value };
}
function leavesFromWhen(when: unknown): Leaf[] | null {
  if (!isRuleObj(when)) return null;
  if ("all" in when) {
    const arr = (when as { all?: unknown }).all;
    if (!Array.isArray(arr) || !arr.length) return null;
    const leaves = arr.map(leafFromCond);
    return leaves.every((l): l is Leaf => l !== null) ? leaves : null;
  }
  if ("any" in when || "not" in when) return null;
  const single = leafFromCond(when);
  return single ? [single] : null;
}
function whenFromLeaves(leaves: Leaf[]): unknown {
  return leaves.length === 1 ? condFromLeaf(leaves[0]) : { all: leaves.map(condFromLeaf) };
}
function defaultValueFor(op: string, field: ConditionField | undefined): unknown {
  if (op === "present") return true;
  if (op === "equals" || op === "greaterThan") return 0;
  if (field?.type === "enum" && field.values?.length) return field.values[0];
  if (field?.type === "answer") return "yes";
  return "";
}

// One leaf condition ("atRisk is yes"), as a question / test / value, each a dropdown where the
// format gives one to pick from.
function LeafEditor({
  leaf,
  fields,
  exitMethods,
  removable,
  onChange,
  onRemove,
  onCreateQuestion,
}: {
  leaf: Leaf;
  fields: ConditionField[];
  exitMethods: string[];
  removable: boolean;
  onChange: (next: Leaf) => void;
  onRemove: () => void;
  onCreateQuestion?: (label: string) => string;
}) {
  const field = fields.find((f) => f.key === leaf.answer);
  const ops = OPS_FOR[field?.type ?? "answer"] ?? ["is", "isNot"];
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Select
        size="sm"
        value={leaf.answer}
        onChange={(e) => {
          if (e.target.value === "__new__") {
            const label = window.prompt('What does research answer about each person, each episode? (e.g. "did they sit out of a challenge")');
            if (label && label.trim() && onCreateQuestion) {
              const key = onCreateQuestion(label.trim());
              const newField: ConditionField = { key, type: "answer" };
              const newOps = OPS_FOR["answer"];
              onChange({ answer: key, op: newOps[0] as Leaf["op"], value: defaultValueFor(newOps[0], newField) });
            }
            return;
          }
          const f = fields.find((x) => x.key === e.target.value);
          const newOps = OPS_FOR[f?.type ?? "answer"] ?? ["is", "isNot"];
          onChange({ answer: e.target.value, op: newOps[0] as Leaf["op"], value: defaultValueFor(newOps[0], f) });
        }}
      >
        <option value="">Choose a question…</option>
        {fields.map((f) => (
          <option key={f.key} value={f.key}>
            {f.key}
          </option>
        ))}
        {onCreateQuestion && <option value="__new__">+ New question…</option>}
      </Select>
      <Select
        size="sm"
        value={leaf.op}
        onChange={(e) => onChange({ ...leaf, op: e.target.value as Leaf["op"], value: defaultValueFor(e.target.value, field) })}
      >
        {ops.map((o) => (
          <option key={o} value={o}>
            {OP_LABELS[o]}
          </option>
        ))}
      </Select>
      {leaf.op === "present" ? (
        <Select size="sm" value={String(leaf.value)} onChange={(e) => onChange({ ...leaf, value: e.target.value === "true" })}>
          <option value="true">given</option>
          <option value="false">empty</option>
        </Select>
      ) : leaf.op === "equals" || leaf.op === "greaterThan" ? (
        <Input
          size="sm"
          type="number"
          className="w-20"
          value={typeof leaf.value === "number" ? leaf.value : 0}
          onChange={(e) => onChange({ ...leaf, value: Number(e.target.value) })}
        />
      ) : field?.type === "answer" ? (
        <Select size="sm" value={String(leaf.value)} onChange={(e) => onChange({ ...leaf, value: e.target.value })}>
          {["yes", "no", "unknown"].map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </Select>
      ) : field?.type === "enum" && field.values ? (
        <Select size="sm" value={String(leaf.value)} onChange={(e) => onChange({ ...leaf, value: e.target.value })}>
          {field.values.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </Select>
      ) : field?.type === "exitMethod" ? (
        <Select size="sm" value={String(leaf.value)} onChange={(e) => onChange({ ...leaf, value: e.target.value })}>
          {exitMethods.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </Select>
      ) : (
        <Input size="sm" className="w-28" value={String(leaf.value ?? "")} onChange={(e) => onChange({ ...leaf, value: e.target.value })} />
      )}
      {removable && (
        <button className="text-muted-foreground hover:text-foreground" title="Remove this condition" onClick={onRemove}>
          ×
        </button>
      )}
    </div>
  );
}

// A condition as controls when it's a single test or a flat AND of them (almost every rule); a
// scoped JSON box, same idea as RuleLine's, for the rarer "any"/"not"/nested shapes this doesn't cover.
function ConditionEditor({
  value,
  fields,
  exitMethods,
  onChange,
  onCreateQuestion,
}: {
  value: unknown;
  fields: ConditionField[];
  exitMethods: string[];
  onChange: (next: unknown) => void;
  onCreateQuestion?: (label: string) => string;
}) {
  const leaves = leavesFromWhen(value);
  const [jsonMode, setJsonMode] = useState(false);
  const [text, setText] = useState("");
  const [err, setErr] = useState<string | null>(null);

  if (leaves === null || jsonMode) {
    return (
      <div className="flex flex-col gap-1">
        {leaves === null && (
          <p className="text-[0.65rem] italic text-muted-foreground">
            Combines &ldquo;any&rdquo;/&ldquo;not&rdquo;, or nests further than this editor covers -- raw JSON for just this condition:
          </p>
        )}
        <Textarea
          rows={5}
          defaultValue={JSON.stringify(value, null, 2)}
          onChange={(e) => setText(e.target.value)}
          className="font-mono text-[0.7rem]"
        />
        {err && <p className="text-[0.65rem] font-semibold text-destructive">{err}</p>}
        <div>
          <Button
            size="xs"
            onClick={() => {
              try {
                onChange(JSON.parse(text || JSON.stringify(value)));
                setJsonMode(false);
                setErr(null);
              } catch (e) {
                setErr(e instanceof Error ? e.message : "Invalid JSON");
              }
            }}
          >
            Apply
          </Button>
        </div>
      </div>
    );
  }

  // Narrowed once, by hand: TS doesn't carry the `leaves === null` check above into these nested
  // closures on its own.
  const safeLeaves: Leaf[] = leaves;

  function setLeaf(i: number, next: Leaf) {
    const copy = [...safeLeaves];
    copy[i] = next;
    onChange(whenFromLeaves(copy));
  }
  function removeLeaf(i: number) {
    const copy = safeLeaves.filter((_, idx) => idx !== i);
    if (copy.length) onChange(whenFromLeaves(copy));
  }
  function addLeaf() {
    const f = fields[0];
    const ops = OPS_FOR[f?.type ?? "answer"] ?? ["is", "isNot"];
    onChange(whenFromLeaves([...safeLeaves, { answer: f?.key ?? "", op: ops[0] as Leaf["op"], value: defaultValueFor(ops[0], f) }]));
  }

  return (
    <div className="flex flex-col gap-1">
      {safeLeaves.map((leaf, i) => (
        <LeafEditor
          key={i}
          leaf={leaf}
          fields={fields}
          exitMethods={exitMethods}
          removable={safeLeaves.length > 1}
          onChange={(next) => setLeaf(i, next)}
          onRemove={() => removeLeaf(i)}
          onCreateQuestion={onCreateQuestion}
        />
      ))}
      <div className="flex items-center gap-2">
        <button className="text-[0.65rem] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline" onClick={addLeaf}>
          + and…
        </button>
        <button
          className="text-[0.65rem] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          onClick={() => {
            setText(JSON.stringify(value, null, 2));
            setJsonMode(true);
          }}
        >
          edit as JSON
        </button>
      </div>
    </div>
  );
}

interface ParamSpec {
  type: string;
  fieldTypes?: string[];
}
interface BuiltInSpec {
  context: string;
  params: Record<string, ParamSpec>;
  describe: string;
}
const BUILT_IN_SPECS = BUILT_INS as Record<string, BuiltInSpec>;

// Switching a rule between built-ins (or to/from a plain condition rule): carries over `when`,
// `whenExit` and any param whose NAME exists in both the old and new shapes (`award`/`otherwise` is
// almost always one), and drops the rest rather than leaving orphaned keys the new shape doesn't
// recognize -- a dropdown change, not a raw-JSON one.
function switchBuiltIn(rule: Record<string, unknown>, newName: string): Record<string, unknown> {
  const oldSpec = typeof rule.builtIn === "string" ? BUILT_IN_SPECS[rule.builtIn] : undefined;
  const newSpec = newName ? BUILT_IN_SPECS[newName] : undefined;
  const next: Record<string, unknown> = {};
  if ("when" in rule) next.when = rule.when;
  if ("whenExit" in rule) next.whenExit = rule.whenExit;
  if (newSpec) {
    next.builtIn = newName;
    for (const key of Object.keys(newSpec.params)) {
      if (key in rule && (!oldSpec || key in oldSpec.params)) next[key] = rule[key];
    }
  } else if ("award" in rule) {
    next.award = rule.award;
  }
  return next;
}

// An "event" param as a dropdown of the format's own events, plus a way to make a new one on the
// spot (a built-in that wants a harmless "nothing happened" event, like votedForLeaver's `otherwise`,
// otherwise has no valid choice at all -- the chat can't invent one, and neither should the admin
// have to leave this row to add one).
function EventSelect({
  value,
  events,
  onChange,
  onCreate,
}: {
  value: string;
  events: { id: string; label: string }[];
  onChange: (id: string) => void;
  onCreate: (label: string) => string;
}) {
  return (
    <Select
      size="sm"
      value={value}
      onChange={(e) => {
        if (e.target.value === "__new__") {
          const label = window.prompt("Label for the new event (starts at 0 points -- set a real value in its row above):");
          if (label && label.trim()) onChange(onCreate(label.trim()));
          return;
        }
        onChange(e.target.value);
      }}
    >
      <option value="">Choose an event…</option>
      {events.map((ev) => (
        <option key={ev.id} value={ev.id}>
          {ev.label}
        </option>
      ))}
      <option value="__new__">+ New event…</option>
    </Select>
  );
}

// A category picker, not free text: two events spelled "Vote" and "Votes" silently become two
// categories instead of one, the same failure mode as a mistyped event/question id -- just quieter,
// since nothing calls it a problem. "+ New category" is still there for a genuinely new group.
export function CategorySelect({ value, categories, onChange }: { value: string; categories: string[]; onChange: (v: string) => void }) {
  const options = categories.includes(value) ? categories : [value, ...categories];
  return (
    <Select
      size="sm"
      className="w-28"
      value={value}
      onChange={(e) => {
        if (e.target.value === "__new__") {
          const v = window.prompt("New category name:");
          if (v && v.trim()) onChange(v.trim());
          return;
        }
        onChange(e.target.value);
      }}
    >
      {options.map((c) => (
        <option key={c} value={c}>
          {c}
        </option>
      ))}
      <option value="__new__">+ New category…</option>
    </Select>
  );
}

// One rule's params as actual controls -- a dropdown of real events/exit methods/questions instead
// of free text, so there's no id to spell right and no way to pick something that doesn't exist. Only
// a built-in's `event`/`exitMethod`/`field` params (and a plain rule's own `award`) get one; a
// built-in's `condition`/`role` params are rare enough that the scoped JSON "edit" above covers them.
function RuleFields({
  rule,
  builtIn,
  hasAward,
  context,
  events,
  exitMethods,
  questions,
  conditionFields,
  onSet,
  onReplace,
  onCreateEvent,
  onCreateQuestion,
}: {
  rule: Record<string, unknown>;
  builtIn: BuiltInSpec | undefined;
  hasAward: boolean;
  context: "research" | "implied";
  events: { id: string; label: string }[];
  exitMethods: string[];
  questions: { key: string; type: string }[];
  conditionFields: ConditionField[];
  onSet: (key: string, value: unknown) => void;
  onReplace: (next: Record<string, unknown>) => void;
  onCreateEvent: (label: string) => string;
  onCreateQuestion?: (label: string) => string;
}) {
  const params: [string, ParamSpec][] = builtIn ? Object.entries(builtIn.params) : hasAward ? [["award", { type: "event" }]] : [];
  const builtInOptions = Object.entries(BUILT_IN_SPECS).filter(([, b]) => b.context === context);
  const showWhen = "when" in rule;
  const showWhenExit = "whenExit" in rule;
  const whenExitList = Array.isArray(rule.whenExit) ? (rule.whenExit as unknown[]) : rule.whenExit ? [rule.whenExit] : [];
  return (
    <div className="mt-1 flex flex-col gap-1.5 rounded border border-dashed border-border bg-secondary/40 p-1.5">
      {/* Built-ins that look across people (who voted for whom, a role on either side) -- switching
          drops params the new one doesn't share by name, so re-pick those below after switching. */}
      {builtInOptions.length > 0 && (
        <label className="flex items-center gap-1.5">
          <span className="w-24 shrink-0 text-muted-foreground">Built-in</span>
          <Select size="sm" value={builtIn && typeof rule.builtIn === "string" ? rule.builtIn : ""} onChange={(e) => onReplace(switchBuiltIn(rule, e.target.value))}>
            <option value="">(none -- a plain condition rule)</option>
            {builtInOptions.map(([name]) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </Select>
        </label>
      )}
      {showWhenExit && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-24 shrink-0 text-muted-foreground">Follows leaving by</span>
          {exitMethods.map((m) => (
            <label key={m} className="flex items-center gap-1">
              <input
                type="checkbox"
                checked={whenExitList.includes(m)}
                onChange={(e) => {
                  const next = e.target.checked ? [...whenExitList, m] : whenExitList.filter((x) => x !== m);
                  onSet("whenExit", next.length === 1 ? next[0] : next);
                }}
              />
              {m}
            </label>
          ))}
        </div>
      )}
      {showWhen && (
        <div className="flex items-start gap-1.5">
          <span className="w-24 shrink-0 text-muted-foreground">When</span>
          <div className="flex-1">
            <ConditionEditor value={rule.when} fields={conditionFields} exitMethods={exitMethods} onChange={(v) => onSet("when", v)} onCreateQuestion={onCreateQuestion} />
          </div>
        </div>
      )}
      {params.map(([key, spec]) => {
        const value = rule[key];
        return (
          <label key={key} className="flex items-center gap-1.5">
            <span className="w-24 shrink-0 text-muted-foreground">{humanize(key)}</span>
            {spec.type === "event" ? (
              <EventSelect value={typeof value === "string" ? value : ""} events={events} onChange={(v) => onSet(key, v)} onCreate={onCreateEvent} />
            ) : spec.type === "exitMethod" ? (
              <Select size="sm" value={typeof value === "string" ? value : ""} onChange={(e) => onSet(key, e.target.value)}>
                <option value="">Choose an exit method…</option>
                {exitMethods.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </Select>
            ) : spec.type === "field" ? (
              <Select
                size="sm"
                value={typeof value === "string" ? value : ""}
                onChange={(e) => {
                  if (e.target.value === "__new__") {
                    const label = window.prompt('What does research answer about each person, each episode? (e.g. "did they sit out of a challenge")');
                    if (label && label.trim() && onCreateQuestion) onSet(key, onCreateQuestion(label.trim()));
                    return;
                  }
                  onSet(key, e.target.value);
                }}
              >
                <option value="">Choose a question…</option>
                {questions.map((q) => (
                  <option key={q.key} value={q.key}>
                    {q.key} ({q.type})
                  </option>
                ))}
                {onCreateQuestion && <option value="__new__">+ New question…</option>}
              </Select>
            ) : spec.type === "condition" ? (
              <div className="flex-1">
                <ConditionEditor value={value} fields={conditionFields} exitMethods={exitMethods} onChange={(v) => onSet(key, v)} onCreateQuestion={onCreateQuestion} />
              </div>
            ) : (
              <span className="text-[0.65rem] italic text-muted-foreground">use &ldquo;edit&rdquo; above for this one</span>
            )}
          </label>
        );
      })}
    </div>
  );
}

export function TierChip({ tier }: { tier: "A" | "B" | "C" | null }) {
  if (!tier) return null;
  return (
    <Badge
      variant={tier === "C" ? "destructive" : "outline"}
      className="h-4 text-[0.6rem]"
      title={
        tier === "A"
          ? "Stated plainly every episode"
          : tier === "B"
            ? "Worked out from other answers"
            : "Reported often but not always, or only in some seasons"
      }
    >
      {tier}
    </Badge>
  );
}

// A problem's/rule's `at` for a rule row: "rules.research[3]" or "rules.implied[1]".
export function ruleAtPath(at: string): { list: "research" | "implied"; index: number } | null {
  const m = /^rules\.(research|implied)\[(\d+)\]$/.exec(at);
  if (!m) return null;
  return { list: m[1] as "research" | "implied", index: Number(m[2]) };
}

// One rule, as its sentence with three ways to fix it:
//  - As soon as it has a problem (or "edit" is clicked for any rule), its params show as actual
//    controls -- dropdowns of real events/exit methods/questions, and the condition itself as
//    question/test/value rows -- so there's nothing to spell or get wrong. That covers almost every
//    rule the chat can write.
//  - "Remove" drops the rule outright when it isn't worth fixing: the event it would have awarded
//    just loses this one way of being scored (a warning, not a problem -- it can still be awarded by
//    hand, or by another rule).
//  - "edit as raw JSON", nested under the controls, is the last-resort fallback for the one shape
//    those don't cover (a condition combining "any"/"not", or nesting past a flat AND) -- a few lines
//    for just THIS rule, not the whole rules block.
export function RuleLine({
  sentence,
  problems,
  rule,
  onApply,
  onRemove,
  context,
  events,
  exitMethods,
  questions,
  conditionFields,
  onCreateEvent,
  onCreateQuestion,
}: {
  sentence: string;
  problems: string[];
  rule: unknown;
  onApply: (next: unknown) => void;
  onRemove: () => void;
  context: "research" | "implied";
  events: { id: string; label: string }[];
  exitMethods: string[];
  questions: { key: string; type: string }[];
  conditionFields: ConditionField[];
  onCreateEvent: (label: string) => string;
  onCreateQuestion?: (label: string) => string;
}) {
  const [manuallyOpen, setManuallyOpen] = useState(false);
  const [jsonOpen, setJsonOpen] = useState(false);
  const [text, setText] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const ruleObj = isRuleObj(rule) ? rule : null;
  const builtIn = ruleObj && typeof ruleObj.builtIn === "string" ? BUILT_IN_SPECS[ruleObj.builtIn] : undefined;
  const hasAward = !!ruleObj && typeof ruleObj.award === "string" && !builtIn;
  const open = problems.length > 0 || manuallyOpen;
  return (
    <div>
      <div className="flex items-start gap-1.5">
        <span className="flex-1 text-[0.8rem] font-medium text-foreground">{sentence}</span>
        {problems.length > 0 && (
          <button
            className="shrink-0 font-semibold text-destructive underline-offset-2 hover:underline"
            title="Drop this one rule. The event stays and can still be scored by hand or by another rule."
            onClick={onRemove}
          >
            remove
          </button>
        )}
        <button className="shrink-0 text-muted-foreground underline-offset-2 hover:text-foreground hover:underline" onClick={() => setManuallyOpen((v) => !v)}>
          {open ? "hide" : "edit"}
        </button>
      </div>
      <Notes problems={problems} warnings={[]} />
      {open && ruleObj && (
        <>
          <RuleFields
            rule={ruleObj}
            builtIn={builtIn}
            hasAward={hasAward}
            context={context}
            events={events}
            exitMethods={exitMethods}
            questions={questions}
            conditionFields={conditionFields}
            onSet={(key, value) => onApply({ ...ruleObj, [key]: value })}
            onReplace={onApply}
            onCreateEvent={onCreateEvent}
            onCreateQuestion={onCreateQuestion}
          />
          <button
            className="mt-0.5 text-[0.65rem] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            onClick={() => {
              setText(JSON.stringify(rule, null, 2));
              setErr(null);
              setJsonOpen((v) => !v);
            }}
          >
            {jsonOpen ? "hide raw JSON" : "edit as raw JSON"}
          </button>
          {jsonOpen && (
            <div className="mt-1 rounded border border-dashed border-border bg-secondary/40 p-1.5">
              <Textarea
                rows={Math.min(14, text.split("\n").length + 1)}
                value={text}
                onChange={(e) => setText(e.target.value)}
                className="font-mono text-[0.7rem]"
              />
              {err && <p className="mt-1 font-semibold text-destructive">{err}</p>}
              <Button
                size="xs"
                className="mt-1"
                onClick={() => {
                  try {
                    onApply(JSON.parse(text));
                    setJsonOpen(false);
                  } catch (e) {
                    setErr(e instanceof Error ? e.message : "Invalid JSON");
                  }
                }}
              >
                Apply
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export function Notes({ problems, warnings }: { problems: string[]; warnings: string[] }) {
  if (!problems.length && !warnings.length) return null;
  return (
    <ul className="mt-1 flex flex-col gap-0.5 text-[0.7rem]">
      {problems.map((p) => (
        <li key={p} className="font-semibold text-destructive">
          ! {p}
        </li>
      ))}
      {warnings.map((w) => (
        <li key={w} className="text-muted-foreground">
          {w}
        </li>
      ))}
    </ul>
  );
}

export function FormatReviewScreen({
  format,
  onClose,
  onChanged,
  saveFn = api.adminSaveFormat,
  approveFn = (id, body) => api.adminApproveFormat(id, body),
  allowExisting = true,
  onShowCreated,
}: {
  format: StoredFormat;
  onClose: () => void;
  onChanged: () => void;
  // Self-serve callers (research-show-flow.tsx) pass the non-admin equivalents, scoped to formats
  // the signed-in user created themselves.
  saveFn?: (id: string, proposal: Proposal) => Promise<{ format: StoredFormat; leaguesUpdated: number }>;
  approveFn?: (
    id: string,
    body: { createShow?: boolean; showId?: string; domains?: string[] }
  ) => Promise<{ format: StoredFormat; show: { id: string; slug: string; name: string } | null; leaguesUpdated?: number }>;
  // false for self-serve: there is no "switch an existing show onto this format" action outside
  // Admin -- that's the one boundary the whole self-serve feature rests on (see
  // src/app/api/formats/[id]/create-show/route.ts).
  allowExisting?: boolean;
  // Fired after a successful "Approve & create show", so a caller like the create-league wizard can
  // move on with the new show.
  onShowCreated?: (show: { id: string; slug: string; name: string }) => void;
}) {
  const [current, setCurrent] = useState(format);
  const [proposal, setProposal] = useState<Proposal>(format.proposal);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [pickingShow, setPickingShow] = useState(false);
  const [pickedShowId, setPickedShowId] = useState("");

  // Rule editing: the inline edits above only ever touch an event's label/points/category -- a
  // built-in's params, conditions and awards aren't a row anything here edits one field at a time
  // (that's the rule-list/flowchart editor PLAN-scoring-rules-as-data.md reserves for later). Until
  // that exists, a raw-JSON editor for just the `rules` block is the one way to fix a rule mistake
  // (a bad built-in param, a type mismatch) without leaving the app and re-pasting from scratch --
  // it still goes through the same `proposal` state, so `reviewProposal` re-validates it live.
  const [rulesEditorOpen, setRulesEditorOpen] = useState(false);
  const [rulesText, setRulesText] = useState("");
  const [rulesTextError, setRulesTextError] = useState<string | null>(null);

  function openRulesEditor() {
    setRulesText(JSON.stringify(proposal.rules ?? { research: [], implied: [] }, null, 2));
    setRulesTextError(null);
    setRulesEditorOpen(true);
  }

  function applyRulesText() {
    let parsed: unknown;
    try {
      parsed = JSON.parse(rulesText);
    } catch (e) {
      setRulesTextError(e instanceof Error ? e.message : "Invalid JSON");
      return;
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      setRulesTextError("Must be an object with research and implied lists");
      return;
    }
    setProposal((p) => ({ ...p, rules: parsed as Proposal["rules"] }));
    setRulesTextError(null);
    setRulesEditorOpen(false);
  }

  // Which suggested research domains are ticked -- initialised once from the preChecked ones a
  // fresh review suggests, never re-derived afterwards (ticking/unticking is the admin's own
  // choice, and nothing here ever applies a domain on its own).
  const [domainsChecked, setDomainsChecked] = useState<Set<string>>(
    () => new Set(reviewProposal(format.proposal, { id: format.id }).domains.filter((d) => d.preChecked).map((d) => d.domain))
  );

  const review = useMemo(() => reviewProposal(proposal, { id: current.id }), [proposal, current.id]);

  // A problem's `at` names the row it's about (`events[id]`, `rules.research[2]`, ...), and review
  // already attaches an event/question/exit/otherRule row's OWN problems to it -- but a rule that
  // awards a shown event (so it isn't in otherRules) still carries its own problems at its own `at`
  // (`rules.research[i]`), which no row would otherwise surface. Attribute those to the event row
  // whose sentence they belong to, and catch anything left over so no problem is ever silently hidden
  // behind just the bottom count.
  const problemsForAt = (at: string) => review.problems.filter((p) => p.at === at).map((p) => p.message);
  // Shared option lists for RuleFields' dropdowns -- every real event, exit method and question in
  // the format as it stands right now (including ones just added or renamed this session).
  const ruleFieldProps = {
    events: review.data.events.map((e) => ({ id: e.id, label: e.label })),
    exitMethods: review.data.exitMethods,
    questions: review.questions,
    conditionFields: review.data.research.checklist
      .filter((f) => !["name", "sources", "confidence"].includes(f.key))
      .map((f) => ({ key: f.key, type: f.type, values: f.values })),
    onCreateEvent: addEvent,
    onCreateQuestion: addQuestion,
  };
  const categoryOptions = review.categories.map((g) => g.label);
  const shownAts = useMemo(() => {
    const s = new Set<string>();
    for (const g of review.categories) for (const ev of g.events) {
      s.add(`events[${ev.id}]`);
      for (const r of ev.rules) s.add(r.at);
    }
    for (const q of review.questions) s.add(`questions[${q.key}]`);
    for (const x of review.exits) s.add(`exits[${x.name}]`);
    for (const r of review.otherRules) s.add(r.at);
    return s;
  }, [review]);
  const leftoverProblems = review.problems.filter((p) => !shownAts.has(p.at));

  function getRule(at: string): unknown {
    const loc = ruleAtPath(at);
    if (!loc) return undefined;
    const list = proposal.rules?.[loc.list];
    return Array.isArray(list) ? list[loc.index] : undefined;
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
    setProposal((p) => {
      const list = (Array.isArray(p.rules?.[loc.list]) ? (p.rules![loc.list] as unknown[]) : []).filter((_, i) => i !== loc.index);
      return { ...p, rules: { ...(p.rules ?? {}), [loc.list]: list } };
    });
  }

  // A blank rule, same shape a chat's own answer would use -- the condition starts with no question
  // picked, so it opens already in edit mode (RuleLine's `open` follows `problems.length > 0`) with the
  // dropdown ready to fill in.
  function addRuleForEvent(eventId: string) {
    setProposal((p) => ({
      ...p,
      rules: { ...(p.rules ?? {}), research: [...(Array.isArray(p.rules?.research) ? p.rules!.research! : []), { when: { answer: "", is: "yes" }, award: eventId }] },
    }));
  }

  // Same, with no award -- for a rule that only stages a fact (like Survivor's `exiled`) rather than
  // scoring a shown event.
  function addOtherRule() {
    setProposal((p) => ({
      ...p,
      rules: { ...(p.rules ?? {}), research: [...(Array.isArray(p.rules?.research) ? p.rules!.research! : []), { when: { answer: "", is: "yes" } }] },
    }));
  }

  function updateEvent(id: string, patch: Partial<{ label: string; points: number; category: string }>) {
    setProposal((p) => ({
      ...p,
      events: (p.events ?? []).map((e) => (effectiveEventId(e) === id ? { ...e, ...patch } : e)),
    }));
  }

  function updateQuestionType(key: string, type: string) {
    setProposal((p) => ({
      ...p,
      questions: (p.questions ?? []).map((q) => (effectiveQuestionKey(q) === key ? { ...q, type } : q)),
    }));
  }

  function updateQuestion(key: string, patch: Partial<{ question: string; note: string; tier: string }>) {
    setProposal((p) => ({
      ...p,
      questions: (p.questions ?? []).map((q) => (effectiveQuestionKey(q) === key ? { ...q, ...patch } : q)),
    }));
  }

  // Not pre-checked against the rules that read it -- reviewProposal already raises "a rule reads a
  // missing question" as a problem on save/approve, the same way every other dangling reference here is
  // already caught (see removeRule, which lets an event end up with zero rules too).
  function removeQuestion(key: string) {
    setProposal((p) => ({ ...p, questions: (p.questions ?? []).filter((q) => effectiveQuestionKey(q) !== key) }));
  }

  // For a rule param with no valid event to point at (a built-in's "otherwise", say) -- a new, bare
  // event right from that param's dropdown, rather than making the admin scroll up and invent one by
  // hand first. Starts at 0 points: tracked, not yet scored, same as the prompt tells the chat itself.
  function addEvent(label: string): string {
    const base = camelId(label) || "newEvent";
    const taken = new Set((proposal.events ?? []).map((e) => effectiveEventId(e)));
    let id = base;
    for (let n = 2; taken.has(id); n++) id = `${base}${n}`;
    setProposal((p) => ({
      ...p,
      events: [...(p.events ?? []), { id, label, category: "Other", points: 0, tier: "C" as const, why: "", headline: false }],
    }));
    return id;
  }

  // For a brand-new checklist fact no existing question covers -- defaults to tier A, unlike addEvent's
  // tier C: a chat's tier is a guess about research reliability, but an admin adding one by hand already
  // knows it's reliably reported, or wouldn't bother. There's no inference to make.
  function addQuestion(label: string): string {
    const base = camelId(label) || "newQuestion";
    const taken = new Set((proposal.questions ?? []).map((q) => effectiveQuestionKey(q)));
    let key = base;
    for (let n = 2; taken.has(key); n++) key = `${base}${n}`;
    setProposal((p) => ({
      ...p,
      questions: [...(p.questions ?? []), { key, type: "answer", question: label, note: "", tier: "A", where: "" }],
    }));
    return key;
  }

  function toggleDomain(domain: string) {
    setDomainsChecked((s) => {
      const next = new Set(s);
      if (next.has(domain)) next.delete(domain);
      else next.add(domain);
      return next;
    });
  }

  async function run<T extends { format: StoredFormat }>(
    fn: () => Promise<T>,
    successNote?: string,
    closeOnSuccess = false
  ): Promise<T | null> {
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      const res = await fn();
      setCurrent(res.format);
      setProposal(res.format.proposal);
      if (successNote) setNote(successNote);
      onChanged();
      if (closeOnSuccess) onClose();
      return res;
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        setError(e.message);
        try {
          const fresh = await api.adminGetFormat(current.id);
          setCurrent(fresh.format);
          setProposal(fresh.format.proposal);
        } catch {
          /* couldn't re-fetch either; the error above still tells the admin what went wrong */
        }
      } else {
        setError(e instanceof ApiError ? e.message : "That didn't work.");
      }
      return null;
    } finally {
      setBusy(false);
    }
  }

  const approved = current.status === "approved";
  const showsQuery = useQuery({ queryKey: ["admin-shows-picker"], queryFn: () => api.adminListShows(), enabled: pickingShow && allowExisting });
  const shows: AdminShow[] = showsQuery.data?.shows ?? [];
  const pickedShow = shows.find((s) => s.id === pickedShowId);

  // Approving re-derives from whatever's actually stored on the server, not from this screen's
  // in-browser edits -- so "Approve" has to save first, or it approves the format as it stood before
  // today's edits. One click does both, in order; if the save fails, nothing is approved. Returns the
  // approve result (so a caller can read `.show`) or null if either step failed.
  async function saveThenApprove<T extends { format: StoredFormat }>(doApprove: () => Promise<T>, successNote: string) {
    const saved = await run(() => saveFn(current.id, proposal));
    if (!saved) return null;
    return run(doApprove, successNote, true);
  }

  async function useForExistingShow() {
    if (!pickedShow) return;
    const ok = await confirm(
      `Switch ${pickedShow.name} to ${current.name} rules? Its ${pickedShow.league_count} league${pickedShow.league_count === 1 ? "" : "s"} switch too. ` +
        `Results already recorded keep their current wording.`,
      { confirmLabel: "Switch" }
    );
    if (!ok) return;
    await saveThenApprove(
      () => approveFn(current.id, { showId: pickedShow.id, domains: [...domainsChecked] }),
      `${current.name} now powers ${pickedShow.name}.`
    );
    setPickingShow(false);
  }

  return (
    <div className="mt-2 rounded-md border border-border bg-card p-3 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        <h4 className="text-sm font-bold">{current.name}</h4>
        <Badge variant={approved ? "default" : "secondary"}>{approved ? "Approved" : "Draft"}</Badge>
        <span className="text-muted-foreground">v{current.version}</span>
        {!rulesEditorOpen && (
          <Button
            variant="secondary"
            size="xs"
            className="ml-auto"
            title="Edit every rule at once -- for a problem attached to one rule (further down), use the edit link on that rule's own line instead"
            onClick={openRulesEditor}
          >
            Edit all rules
          </Button>
        )}
        <Button variant="secondary" size="xs" className={rulesEditorOpen ? "ml-auto" : ""} onClick={onClose}>
          Close
        </Button>
      </div>

      {review.repairs.length > 0 && (
        <div className="mt-2 rounded border border-dashed border-border bg-secondary/40 p-1.5">
          <p className="font-semibold">Repaired while reading the answer:</p>
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
          <p className="font-semibold text-destructive">Other problems:</p>
          <ul className="mt-0.5 flex flex-col gap-0.5">
            {leftoverProblems.map((p, i) => (
              <li key={i}>
                <code className="font-mono text-[0.65rem] text-muted-foreground">{p.at}</code>: {p.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {rulesEditorOpen && (
        <div className="mt-2 rounded border border-dashed border-border bg-secondary/40 p-1.5">
          <p className="mb-1">
            Raw <code className="font-mono text-[0.65rem]">rules.research</code> / <code className="font-mono text-[0.65rem]">rules.implied</code> --
            a built-in&rsquo;s params, conditions and awards aren&rsquo;t a row the screen edits one field at a time yet. Fix the
            problem above and Apply; the review recomputes as soon as you do.
          </p>
          <Textarea rows={16} value={rulesText} onChange={(e) => setRulesText(e.target.value)} className="font-mono text-[0.7rem]" />
          {rulesTextError && <p className="mt-1 font-semibold text-destructive">{rulesTextError}</p>}
          <div className="mt-1.5 flex items-center gap-1.5">
            <Button size="xs" onClick={applyRulesText}>
              Apply
            </Button>
            <Button variant="secondary" size="xs" onClick={() => setRulesEditorOpen(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Events, grouped by category like Active Roster Settings groups them. */}
      <div className="mt-3 flex flex-col gap-3">
        <AnimatePresence>
          {review.categories.map((g, gi) => (
            <div key={g.label}>
              <div className="mb-1 text-[0.65rem] font-bold uppercase tracking-wide text-muted-foreground">{g.label}</div>
              <div className="flex flex-col gap-1.5">
                {g.events.map((ev, ei) => {
                  const allProblems = [...ev.problems, ...ev.rules.flatMap((r) => problemsForAt(r.at))];
                  return (
                  <m.div
                    key={ev.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(gi * 0.04 + ei * 0.02, 0.3), duration: 0.16 }}
                    className={cn("rounded-md border px-2.5 py-1.5", allProblems.length ? "border-destructive/40" : "border-border")}
                  >
                    <div className="flex flex-wrap items-center gap-1.5">
                      <TierChip tier={ev.tier} />
                      {ev.implied && (
                        <span className="text-[0.65rem] text-muted-foreground" title="Scored automatically from how they left -- can't be added by hand">
                          (automatic)
                        </span>
                      )}
                      <Input
                        size="sm"
                        className="min-w-[140px] flex-1"
                        defaultValue={ev.label}
                        disabled={ev.implied}
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
                        title="Points"
                        defaultValue={ev.points}
                        onBlur={(e) => {
                          const n = parseFloat(e.target.value);
                          if (Number.isFinite(n) && n !== ev.points) updateEvent(ev.id, { points: n });
                        }}
                      />
                      <CategorySelect value={ev.category} categories={categoryOptions} onChange={(v) => updateEvent(ev.id, { category: v })} />
                    </div>
                    {/* The event's OWN problem (e.g. "awarded by both a research rule and an exit
                        rule") is the one to read first: it's the actual cause, and fixing it (usually
                        by removing one rule below) clears the per-rule "no event in the catalog"
                        messages those rules show too -- same root cause, not separate problems. A
                        callout box, not a plain red line, so it visibly points at what's below rather
                        than reading as one more alert mixed in with everything else. */}
                    {ev.problems.length > 0 && (
                      <div className="mt-1 rounded border border-destructive/40 bg-destructive/5 p-1.5 text-[0.7rem]">
                        {ev.problems.map((p) => (
                          <p key={p} className="font-semibold text-destructive">
                            ! {p} -- see the rules below
                          </p>
                        ))}
                      </div>
                    )}
                    {ev.warnings.length > 0 && <Notes problems={[]} warnings={ev.warnings} />}
                    {ev.why && <p className="mt-0.5 text-[0.7rem] italic text-muted-foreground">{ev.why}</p>}
                    {ev.rules.length > 0 && (
                      // More than one rule awarding the same event is exactly the confusing case
                      // (two rules fighting over one award): give each its own card so it's obvious
                      // where one ends and the next begins. One rule stays a plain line -- no need for
                      // a box around the common case.
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
                  </m.div>
                  );
                })}
              </div>
            </div>
          ))}
        </AnimatePresence>
      </div>

      <div className="mt-3">
        <div className="mb-1 flex items-center gap-2 text-[0.65rem] font-bold uppercase tracking-wide text-muted-foreground">
          <span>Other rules</span>
          <button className="font-normal normal-case text-muted-foreground underline-offset-2 hover:text-foreground hover:underline" onClick={addOtherRule}>
            + Add rule
          </button>
        </div>
        {review.otherRules.length > 0 && (
          <ul className="flex flex-col gap-1">
            {review.otherRules.map((r) => (
              <div key={r.at} className="rounded-md border border-border px-2.5 py-1.5">
                <RuleLine
                  sentence={r.sentence}
                  problems={r.problems}
                  rule={getRule(r.at)}
                  onApply={(next) => setRule(r.at, next)}
                  onRemove={() => removeRule(r.at)}
                  context={ruleAtPath(r.at)?.list ?? "research"}
                  {...ruleFieldProps}
                />
              </div>
            ))}
          </ul>
        )}
      </div>

      {/* Questions: asked every episode. Editable like the events above -- label, note, tier and type;
          removing one a rule still reads is deliberately not pre-blocked here, same as removeRule --
          reviewProposal already raises that as a problem on save/approve. */}
      <div className="mt-3">
        <div className="mb-1 flex items-center gap-2 text-[0.65rem] font-bold uppercase tracking-wide text-muted-foreground">
          <span>Questions research answers</span>
          <button
            className="font-normal normal-case text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            onClick={() => {
              const label = window.prompt('What does research answer about each person, each episode? (e.g. "did they sit out of a challenge")');
              if (label && label.trim()) addQuestion(label.trim());
            }}
          >
            + Add question
          </button>
        </div>
        <ul className="flex flex-col gap-1">
          {review.questions.map((q) => (
            <li key={q.key} className={cn("rounded-md border px-2.5 py-1.5", q.problems.length ? "border-destructive/40" : "border-border")}>
              <div className="flex flex-wrap items-center gap-1.5">
                <Select
                  size="sm"
                  className="w-14"
                  value={q.tier ?? ""}
                  title="A: stated plainly every episode · B: worked out from other answers · C: reported often but not always"
                  onChange={(e) => updateQuestion(q.key, { tier: e.target.value })}
                >
                  <option value="">tier?</option>
                  <option value="A">A</option>
                  <option value="B">B</option>
                  <option value="C">C</option>
                </Select>
                <code className="font-mono text-[0.7rem]">{q.key}</code>
                <Input
                  size="sm"
                  className="min-w-[160px] flex-1"
                  defaultValue={q.question}
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    if (v && v !== q.question) updateQuestion(q.key, { question: v });
                  }}
                />
                <Select size="sm" value={q.type} onChange={(e) => updateQuestionType(q.key, e.target.value)}>
                  {QUESTION_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </Select>
                <Input
                  size="sm"
                  className="w-28"
                  placeholder="note"
                  defaultValue={q.note}
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    if (v !== q.note) updateQuestion(q.key, { note: v });
                  }}
                />
                <button className="text-muted-foreground underline-offset-2 hover:text-destructive hover:underline" onClick={() => removeQuestion(q.key)}>
                  remove
                </button>
              </div>
              <Notes problems={q.problems} warnings={q.warnings} />
            </li>
          ))}
        </ul>
      </div>

      {/* Exit methods: read-only -- how someone leaves comes from the chat's answer, not edited here. */}
      <div className="mt-3">
        <div className="mb-1 text-[0.65rem] font-bold uppercase tracking-wide text-muted-foreground">Exit methods</div>
        <ul className="flex flex-wrap gap-1.5">
          {review.exits.map((x) => (
            <li key={x.name} className="rounded-md border border-border px-2 py-1">
              <b>{x.name}</b> <span className="text-muted-foreground">({x.kind})</span>
              <Notes problems={[]} warnings={x.warnings} />
            </li>
          ))}
        </ul>
      </div>

      {review.notTrackable.length > 0 && (
        <details className="mt-3">
          <summary className="cursor-pointer text-[0.65rem] font-bold uppercase tracking-wide text-muted-foreground">
            Not reliably trackable ({review.notTrackable.length})
          </summary>
          <ul className="mt-1 flex flex-col gap-0.5 text-muted-foreground">
            {review.notTrackable.map((t, i) => (
              <li key={i}>
                <b>{t.fact}</b>{t.why ? ` — ${t.why}` : ""}
              </li>
            ))}
          </ul>
        </details>
      )}

      {review.flagged.length > 0 && (
        <div className="mt-3 flex flex-col gap-1.5">
          <div className="text-[0.65rem] font-bold uppercase tracking-wide text-muted-foreground">Flagged -- needs a developer</div>
          {review.flagged.map((f) => (
            <div key={f.name} className="rounded-md border border-dashed border-destructive/40 bg-destructive/5 p-1.5">
              <p>
                <b>{f.name}</b> — {f.what}
              </p>
              {f.whyCode && <p className="text-muted-foreground">Why it needs code: {f.whyCode}</p>}
              {f.findings && <p className="text-muted-foreground">{f.findings}</p>}
              <p className="mt-0.5 font-semibold">Approving doesn&rsquo;t add this -- it&rsquo;s left out of the format.</p>
            </div>
          ))}
        </div>
      )}

      {review.domains.length > 0 && (
        <div className="mt-3">
          <div className="mb-1 text-[0.65rem] font-bold uppercase tracking-wide text-muted-foreground">Research sites to add</div>
          <div className="flex flex-wrap gap-2.5">
            {review.domains.map((d) => (
              <label key={d.domain} className="flex items-center gap-1" title={d.why}>
                <input type="checkbox" checked={domainsChecked.has(d.domain)} onChange={() => toggleDomain(d.domain)} />
                {d.domain}
              </label>
            ))}
          </div>
        </div>
      )}

      {note && <p className="mt-2 font-semibold text-good">{note}</p>}
      {error && <p className="mt-2 font-semibold text-destructive">{error}</p>}

      <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-border pt-2.5">
        <Button
          size="xs"
          disabled={busy || (approved && review.problems.length > 0)}
          title={approved && review.problems.length > 0 ? "An approved format has to stay valid -- fix the problems first" : undefined}
          onClick={() => run(() => saveFn(current.id, proposal), "Saved.", true)}
        >
          {approved ? "Save changes" : "Save as draft"}
        </Button>
        {!approved && (
          <>
            <Button
              variant="secondary"
              size="xs"
              disabled={busy || review.problems.length > 0}
              title={review.problems.length > 0 ? "Fix every problem first" : undefined}
              onClick={async () => {
                const res = await saveThenApprove(
                  () => approveFn(current.id, { createShow: true, domains: [...domainsChecked] }),
                  "Approved and created the show."
                );
                if (res?.show) onShowCreated?.(res.show);
              }}
            >
              Approve &amp; create show
            </Button>
            {allowExisting && (
              <Button variant="secondary" size="xs" disabled={busy || review.problems.length > 0} onClick={() => setPickingShow((v) => !v)}>
                Use for an existing show
              </Button>
            )}
          </>
        )}
      </div>
      {/* Named, not just counted: a bare count gives no way to tell whether it's the same problem
          still unresolved or a different one further up the screen. */}
      {review.problems.length > 0 && (
        <div className="mt-1.5 rounded border border-destructive/40 bg-destructive/5 p-1.5 text-[0.7rem]">
          <p className="font-semibold text-destructive">
            {review.problems.length} problem{review.problems.length === 1 ? "" : "s"} to fix before approving:
          </p>
          <ul className="mt-0.5 flex flex-col gap-0.5">
            {review.problems.map((p, i) => (
              <li key={i}>
                <code className="font-mono text-[0.65rem] text-muted-foreground">{p.at}</code>: {p.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {pickingShow && (
        <div className="mt-2 flex items-center gap-1.5 rounded border border-dashed border-border bg-secondary/40 p-1.5">
          {showsQuery.isLoading ? (
            <span className="italic text-muted-foreground">Loading shows…</span>
          ) : (
            <>
              <Select size="sm" value={pickedShowId} onChange={(e) => setPickedShowId(e.target.value)}>
                <option value="">Choose a show…</option>
                {shows.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
              <Button size="xs" disabled={busy || !pickedShowId} onClick={useForExistingShow}>
                Switch
              </Button>
              <Button variant="secondary" size="xs" disabled={busy} onClick={() => setPickingShow(false)}>
                Cancel
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
