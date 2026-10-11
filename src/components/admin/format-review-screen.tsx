"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, CircleAlert, Plus, X } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import type { AdminShow, Proposal, StoredFormat } from "@/lib/game/types";
import { reviewProposal, camelId } from "@/lib/game/formats/proposal.js";
import { BUILT_INS } from "@/lib/game/formats/rules.js";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { BottomSheet, SheetAction } from "@/components/ui/bottom-sheet";
import { Chip, Field, LockedValue, MoreOptions, PrimaryButton, RowList, TextSheet, ToggleRow, fieldCls } from "@/components/setup/settings-ui";
import { confirm } from "@/lib/confirm-store";
import { ActButton, Notice, Rows, Section, Segmented, StickyBar, count } from "./admin-ui";
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

// The quiet text buttons inside a rule's editor ("Edit", "And…"): 44px tall for a thumb, muted until hovered.
const LINK_BTN =
  "inline-flex min-h-11 shrink-0 items-center gap-1 rounded-[3px] px-2 text-[13px] font-semibold text-muted-foreground hover:bg-accent/60 hover:text-foreground focus-visible:outline-3 focus-visible:outline-chyron-line";
// A rule field's label over its control, so long labels and dropdowns both get the full width on a phone.
const FIELD_ROW = "flex flex-col gap-1";
const FIELD_LABEL = "text-[13px] font-semibold text-muted-foreground";

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
        className="min-w-0 max-w-full"
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
        <button
          type="button"
          className="flex size-11 shrink-0 items-center justify-center rounded-[3px] text-muted-foreground hover:bg-accent hover:text-foreground"
          aria-label="Remove this condition"
          onClick={onRemove}
        >
          <X className="size-[18px]" strokeWidth={2.2} aria-hidden />
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
          <p className="text-[13px] leading-snug text-muted-foreground">
            This condition combines &ldquo;any&rdquo; or &ldquo;not&rdquo;, or nests further than the dropdowns cover. Here it is as JSON:
          </p>
        )}
        <Textarea
          rows={5}
          defaultValue={JSON.stringify(value, null, 2)}
          onChange={(e) => setText(e.target.value)}
          className="font-mono text-[13px]"
        />
        {err && <p className="text-[13px] font-semibold text-destructive">{err}</p>}
        <div>
          <Button
            size="sm"
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
      <div className="flex items-center gap-1">
        <button type="button" className={LINK_BTN} onClick={addLeaf}>
          <Plus className="size-4" strokeWidth={2.4} aria-hidden />
          And…
        </button>
        <button
          type="button"
          className={LINK_BTN}
          onClick={() => {
            setText(JSON.stringify(value, null, 2));
            setJsonMode(true);
          }}
        >
          Edit as JSON
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
      className="min-w-0 max-w-full"
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
    <div className="mt-2 flex flex-col gap-3 rounded-[4px] bg-muted/50 p-3 text-[15px]">
      {/* Built-ins that look across people (who voted for whom, a role on either side) -- switching
          drops params the new one doesn't share by name, so re-pick those below after switching. */}
      {builtInOptions.length > 0 && (
        <label className={FIELD_ROW}>
          <span className={FIELD_LABEL}>Built-in</span>
          <Select className="min-w-0 max-w-full" value={builtIn && typeof rule.builtIn === "string" ? rule.builtIn : ""} onChange={(e) => onReplace(switchBuiltIn(rule, e.target.value))}>
            <option value="">None: a plain condition</option>
            {builtInOptions.map(([name]) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </Select>
        </label>
      )}
      {showWhenExit && (
        <div className={FIELD_ROW}>
          <span className={FIELD_LABEL}>Follows leaving by</span>
          <div className="flex flex-wrap gap-x-4">
          {exitMethods.map((m) => (
            <label key={m} className="flex min-h-11 items-center gap-2">
              <input
                type="checkbox"
                className="size-5 accent-[var(--chyron)]"
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
        </div>
      )}
      {showWhen && (
        <div className={FIELD_ROW}>
          <span className={FIELD_LABEL}>When</span>
          <div className="min-w-0">
            <ConditionEditor value={rule.when} fields={conditionFields} exitMethods={exitMethods} onChange={(v) => onSet("when", v)} onCreateQuestion={onCreateQuestion} />
          </div>
        </div>
      )}
      {params.map(([key, spec]) => {
        const value = rule[key];
        return (
          <label key={key} className={FIELD_ROW}>
            <span className={FIELD_LABEL}>{humanize(key)}</span>
            {spec.type === "event" ? (
              <EventSelect value={typeof value === "string" ? value : ""} events={events} onChange={(v) => onSet(key, v)} onCreate={onCreateEvent} />
            ) : spec.type === "exitMethod" ? (
              <Select className="min-w-0 max-w-full" value={typeof value === "string" ? value : ""} onChange={(e) => onSet(key, e.target.value)}>
                <option value="">Choose an exit method…</option>
                {exitMethods.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </Select>
            ) : spec.type === "field" ? (
              <Select
                className="min-w-0 max-w-full"
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
              <div className="min-w-0">
                <ConditionEditor value={value} fields={conditionFields} exitMethods={exitMethods} onChange={(v) => onSet(key, v)} onCreateQuestion={onCreateQuestion} />
              </div>
            ) : (
              <span className="text-[13px] text-muted-foreground">Use &ldquo;Edit as raw JSON&rdquo; below for this one.</span>
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
      variant="outline"
      className={cn("h-4 text-[11px]", tier === "C" && "border-accent-2/60 text-accent-2")}
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
    <div className="text-[15px]">
      <div className="flex items-start gap-1">
        <span className="min-w-0 flex-1 pt-2.5 font-semibold leading-snug text-foreground">{sentence}</span>
        {problems.length > 0 && (
          <button
            type="button"
            className={cn(LINK_BTN, "text-destructive hover:text-destructive")}
            title="Drop this one rule. The event stays and can still be scored by hand or by another rule."
            onClick={onRemove}
          >
            Remove
          </button>
        )}
        {problems.length === 0 && (
          <button type="button" aria-expanded={open} className={LINK_BTN} onClick={() => setManuallyOpen((v) => !v)}>
            {open ? "Done" : "Edit"}
          </button>
        )}
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
            type="button"
            className={cn(LINK_BTN, "mt-1")}
            onClick={() => {
              setText(JSON.stringify(rule, null, 2));
              setErr(null);
              setJsonOpen((v) => !v);
            }}
          >
            {jsonOpen ? "Hide raw JSON" : "Edit as raw JSON"}
          </button>
          {jsonOpen && (
            <div className="mt-1 rounded-[4px] bg-muted/50 p-3">
              <Textarea
                rows={Math.min(14, text.split("\n").length + 1)}
                value={text}
                onChange={(e) => setText(e.target.value)}
                className="font-mono text-[13px]"
              />
              {err && <p className="mt-1 text-[13px] font-semibold text-destructive">{err}</p>}
              <Button
                size="sm"
                className="mt-2"
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
    <ul className="mt-1 flex flex-col gap-1 text-[13px] leading-snug">
      {problems.map((p) => (
        <li key={p} className="flex items-start gap-1.5 font-semibold text-destructive">
          <CircleAlert className="mt-px size-4 shrink-0" strokeWidth={2.2} aria-hidden />
          {p}
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

// What a row on this screen opens: one event, one question, or one rule no event row shows.
type Target = { kind: "event"; id: string } | { kind: "question"; key: string } | { kind: "rule"; at: string };

// How a question's type reads to someone who isn't a developer.
const TYPE_LABELS: Record<string, string> = {
  answer: "Yes or no",
  integer: "A number",
  string: "A name or word",
  stringList: "A list of names",
  enum: "One of a set",
};
const TIER_OPTIONS = [
  ["A", "Every episode"],
  ["B", "Worked out"],
  ["C", "Patchy"],
] as const;
const TIER_HINTS: Record<string, string> = {
  A: "Recaps state it plainly every episode.",
  B: "Worked out from other answers, not reported directly.",
  C: "Reported often but not always, so some weeks it may be missed.",
};

// "When won daily is yes → Won Daily Challenge" on Won Daily Challenge's own row: the arrow and the
// name repeat the row's title, so the row keeps just the condition.
function withoutAward(sentence: string, label: string): string {
  const tail = ` → ${label}`;
  return label && sentence.endsWith(tail) ? sentence.slice(0, -tail.length) : sentence;
}

function pointsText(n: unknown): string {
  if (typeof n !== "number" || !Number.isFinite(n)) return "?";
  if (n === 0) return "0";
  return n > 0 ? `+${n}` : `−${Math.abs(n)}`;
}

/** A tappable review row: what it is, a line or two about it, a value on the right. */
function ReviewRow({
  title,
  detail,
  flags,
  value,
  onClick,
}: {
  title: ReactNode;
  detail?: ReactNode;
  flags?: ReactNode;
  value?: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-[60px] w-full items-center gap-3 py-3 text-left outline-none hover:bg-accent/40 focus-visible:bg-accent"
    >
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-base font-semibold leading-snug">{title}</span>
        {/* Built-ins' sentences run long; the row gives two lines and the sheet has the whole rule. */}
        {detail && <span className="line-clamp-2 text-[13px] leading-snug text-muted-foreground">{detail}</span>}
        {flags}
      </span>
      {value}
      <ChevronRight className="size-5 shrink-0 text-muted-foreground" strokeWidth={2.2} aria-hidden />
    </button>
  );
}

/** The small status words under a row, joined by dots: a problem in red, patchy reporting in gold. */
function Flags({ items }: { items: { text: string; tone?: "bad" | "warn" }[] }) {
  if (!items.length) return null;
  return (
    <span className="flex flex-wrap items-center gap-x-1.5 text-[13px] leading-snug">
      {items.map((f, i) => (
        <span key={f.text} className="flex items-center gap-1.5">
          {i > 0 && <span className="text-muted-foreground" aria-hidden>·</span>}
          <span className={cn(f.tone === "bad" ? "font-semibold text-destructive" : f.tone === "warn" ? "font-semibold text-accent-2" : "text-muted-foreground")}>
            {f.text}
          </span>
        </span>
      ))}
    </span>
  );
}

const sheetSelectCls = cn(fieldCls, "appearance-auto pr-2");

export function FormatReviewScreen({
  format,
  onClose,
  onChanged,
  saveFn = api.adminSaveFormat,
  approveFn = (id, body) => api.adminApproveFormat(id, body),
  allowExisting = true,
  onShowCreated,
  inPage = false,
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
  // Fired after a successful approve-and-create, so a caller like the create-league wizard can
  // move on with the new show.
  onShowCreated?: (show: { id: string; slug: string; name: string }) => void;
  // true on Admin's own format page (AdminPage gives the title, Back, and a tab bar to sit above):
  // no title row or Close here, and the actions go in a sticky bar. false inside another flow (the
  // create-league wizard), which has its own sticky footer, so the actions sit at the end instead.
  inPage?: boolean;
}) {
  const [current, setCurrent] = useState(format);
  const [proposal, setProposal] = useState<Proposal>(format.proposal);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [open, setOpen] = useState<Target | null>(null);
  const [adding, setAdding] = useState<"event" | "question" | null>(null);
  const [approving, setApproving] = useState(false);
  const [pickedShowId, setPickedShowId] = useState("");

  // The raw-JSON editor for the whole `rules` block: the last resort for a shape no row's controls
  // cover. It goes through the same `proposal` state, so `reviewProposal` re-validates it live.
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
  const dirty = useMemo(() => JSON.stringify(proposal) !== JSON.stringify(current.proposal), [proposal, current.proposal]);

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
  const allEvents = review.categories.flatMap((g) => g.events);
  type ReviewEvent = (typeof allEvents)[number];
  type ReviewQuestion = (typeof review.questions)[number];

  // Every problem names the row it's about (`events[id]`, `questions[key]`, `rules.research[2]`...).
  // A rule that awards a shown event belongs to that event's row; anything else gets its own rule
  // row; `exits[...]` and `format` have no row to open, so they're just read.
  function targetFor(at: string): Target | null {
    let m = /^events\[(.+)\]$/.exec(at);
    if (m && allEvents.some((e) => e.id === m![1])) return { kind: "event", id: m[1] };
    m = /^questions\[(.+)\]$/.exec(at);
    if (m && review.questions.some((q) => q.key === m![1])) return { kind: "question", key: m[1] };
    if (ruleAtPath(at)) {
      const owner = allEvents.find((e) => e.rules.some((r) => r.at === at));
      if (owner) return { kind: "event", id: owner.id };
      if (review.otherRules.some((r) => r.at === at)) return { kind: "rule", at };
    }
    return null;
  }
  function nameFor(at: string): string {
    const t = targetFor(at);
    if (t?.kind === "event") return allEvents.find((e) => e.id === t.id)?.label || t.id;
    if (t?.kind === "question") return review.questions.find((q) => q.key === t.key)?.question || t.key;
    if (t?.kind === "rule") return review.otherRules.find((r) => r.at === at)?.sentence ?? "A rule";
    const x = /^exits\[(.+)\]$/.exec(at);
    if (x) return `Leaving by ${x[1]}`;
    return "The format";
  }

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
  // scoring a shown event. Opens straight away, so the new row isn't left for the admin to find.
  function addOtherRule() {
    const index = Array.isArray(proposal.rules?.research) ? proposal.rules!.research!.length : 0;
    setProposal((p) => ({
      ...p,
      rules: { ...(p.rules ?? {}), research: [...(Array.isArray(p.rules?.research) ? p.rules!.research! : []), { when: { answer: "", is: "yes" } }] },
    }));
    setOpen({ kind: "rule", at: `rules.research[${index}]` });
  }

  function updateEvent(id: string, patch: Partial<{ label: string; points: number; category: string }>) {
    setProposal((p) => ({
      ...p,
      events: (p.events ?? []).map((e) => (effectiveEventId(e) === id ? { ...e, ...patch } : e)),
    }));
  }

  function updateQuestion(key: string, patch: Partial<{ question: string; note: string; tier: string; type: string }>) {
    setProposal((p) => ({
      ...p,
      questions: (p.questions ?? []).map((q) => (effectiveQuestionKey(q) === key ? { ...q, ...patch } : q)),
    }));
  }

  // Not pre-checked against the rules that read it -- reviewProposal already raises "a rule reads a
  // missing question" as a problem, the same way every other dangling reference here is caught.
  function removeQuestion(key: string) {
    setProposal((p) => ({ ...p, questions: (p.questions ?? []).filter((q) => effectiveQuestionKey(q) !== key) }));
  }

  // A new, bare event: from "Add an event", or from a rule param with no valid event to point at (a
  // built-in's "otherwise", say). Starts at 0 points: tracked, not yet scored, same as the prompt
  // tells the chat itself.
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
  const showsQuery = useQuery({ queryKey: ["admin-shows-picker"], queryFn: () => api.adminListShows(), enabled: approving && allowExisting });
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

  async function approveAsNewShow() {
    setApproving(false);
    const res = await saveThenApprove(() => approveFn(current.id, { createShow: true, domains: [...domainsChecked] }), "Approved and created the show.");
    if (res?.show) onShowCreated?.(res.show);
  }

  async function useForExistingShow() {
    if (!pickedShow) return;
    // The sheet closes first: the confirm is its own dialog, and two stacked ones fight over focus.
    setApproving(false);
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
  }

  const problemCount = review.problems.length;
  // One row per thing to fix, not per message: an event awarded twice also trips "no event in the
  // catalog" on each rule, and that's one fix, not three. The row's own message leads (it's the
  // cause); the rest are counted.
  const problemGroups = (() => {
    const groups: { key: string; at: string; target: Target | null; messages: string[] }[] = [];
    for (const p of review.problems) {
      const target = targetFor(p.at);
      const key = target ? JSON.stringify(target) : p.at;
      let g = groups.find((x) => x.key === key);
      if (!g) groups.push((g = { key, at: p.at, target, messages: [] }));
      if (p.at === `events[${target?.kind === "event" ? target.id : ""}]`) g.messages.unshift(p.message);
      else g.messages.push(p.message);
    }
    return groups;
  })();
  const eventCount = allEvents.length;
  const counts = [count(eventCount, "scoring event"), count(review.questions.length, "question"), count(review.exits.length, "way to leave", "ways to leave")].join(" · ");

  function eventFlags(ev: ReviewEvent) {
    const n = ev.problems.length + ev.rules.reduce((sum, r) => sum + problemsForAt(r.at).length, 0);
    const items: { text: string; tone?: "bad" | "warn" }[] = [];
    if (n) items.push({ text: count(n, "problem"), tone: "bad" });
    if (ev.tier === "C") items.push({ text: "Patchy reporting", tone: "warn" });
    if (ev.implied) items.push({ text: "Automatic" });
    if (!ev.rules.length) items.push({ text: "Only added by hand" });
    return items;
  }
  function questionFlags(q: ReviewQuestion) {
    const items: { text: string; tone?: "bad" | "warn" }[] = [];
    if (q.problems.length) items.push({ text: count(q.problems.length, "problem"), tone: "bad" });
    items.push({ text: q.type === "enum" && q.values?.length ? `One of: ${q.values.join(", ")}` : (TYPE_LABELS[q.type] ?? q.type) });
    if (q.tier === "C") items.push({ text: "Patchy reporting", tone: "warn" });
    if (q.warnings.some((w) => w.startsWith("no rule reads it"))) items.push({ text: "Not scored" });
    return items;
  }

  const openEvent = open?.kind === "event" ? allEvents.find((e) => e.id === open.id) : undefined;
  const openQuestion = open?.kind === "question" ? review.questions.find((q) => q.key === open.key) : undefined;
  const openRule = open?.kind === "rule" ? review.otherRules.find((r) => r.at === open.at) : undefined;

  const actions = approved ? (
    <ActButton tone="chyron" disabled={busy || !dirty || problemCount > 0} onClick={() => run(() => saveFn(current.id, proposal), "Saved.", true)} className="min-h-12">
      {busy ? "Saving…" : "Save changes"}
    </ActButton>
  ) : (
    <>
      <ActButton disabled={busy || !dirty} onClick={() => run(() => saveFn(current.id, proposal), "Saved.", true)} className="min-h-12">
        Save
      </ActButton>
      <ActButton
        tone="chyron"
        disabled={busy || problemCount > 0}
        onClick={() => (allowExisting ? setApproving(true) : approveAsNewShow())}
        className="min-h-12"
      >
        {busy ? "Working…" : allowExisting ? "Approve" : "Approve and add"}
      </ActButton>
    </>
  );
  const barNote = problemCount
    ? `Fix ${count(problemCount, "problem")} to ${approved ? "save" : "approve"}.`
    : approved
      ? dirty
        ? "Saving updates every show and league on these rules."
        : "No changes yet."
      : dirty
        ? "Unsaved changes. Approving saves them too."
        : "Nothing goes live until you approve.";

  // overflow-wrap here (and on each sheet, which portals out of this tree): a pasted answer can carry
  // a long URL with nowhere to break, and it must wrap rather than push the page sideways.
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-7 [overflow-wrap:anywhere]">
      {!inPage && (
        <div className="flex items-center gap-2">
          <h3 className="type-caption min-w-0 flex-1 truncate text-[24px]">{current.name}</h3>
          {approved ? <Chip>Approved</Chip> : <Chip>Draft</Chip>}
          <ActButton onClick={onClose}>Close</ActButton>
        </div>
      )}

      {/* The verdict first, the way an episode's results open on their coverage: can this be approved,
          and if not, exactly what's in the way, each one a row that opens what it's about. */}
      <section className="flex flex-col gap-1 rounded-[4px] bg-card p-4" aria-live="polite">
        <p className="text-base font-bold leading-snug">
          {problemCount
            ? `${count(problemCount, "problem")} to fix before ${approved ? "saving" : "approving"}.`
            : approved
              ? "These rules are live."
              : "Ready to approve. Nothing needs fixing."}
        </p>
        <p className="text-[13px] leading-snug text-muted-foreground">
          {counts}. {problemCount ? "Tap one to fix it." : "Tap any row to change it."}
        </p>
        {problemCount > 0 && (
          <ul className="-mb-2 mt-2 flex flex-col border-t border-border [&>li+li]:border-t [&>li+li]:border-border">
            {problemGroups.map((g) => {
              const t = g.target;
              const body = (
                <>
                  <CircleAlert className="mt-0.5 size-[18px] shrink-0 text-destructive" strokeWidth={2.2} aria-hidden />
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="text-[15px] font-semibold leading-snug">{nameFor(g.at)}</span>
                    <span className="text-[13px] leading-snug text-muted-foreground">
                      {g.messages[0]}
                      {g.messages.length > 1 && ` · and ${g.messages.length - 1} more`}
                    </span>
                  </span>
                </>
              );
              return (
                <li key={g.key}>
                  {t ? (
                    <button type="button" onClick={() => setOpen(t)} className="flex min-h-[52px] w-full items-start gap-2.5 py-2.5 text-left outline-none hover:bg-accent/40 focus-visible:bg-accent">
                      {body}
                      <ChevronRight className="mt-0.5 size-5 shrink-0 text-muted-foreground" strokeWidth={2.2} aria-hidden />
                    </button>
                  ) : (
                    <div className="flex min-h-[52px] items-start gap-2.5 py-2.5">{body}</div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {review.repairs.length > 0 && (
        <MoreOptions label={`Tidied ${count(review.repairs.length, "thing")} in the answer`}>
          <ul className="-mt-2 flex flex-col gap-1.5 text-[13px] leading-snug text-muted-foreground">
            {review.repairs.map((r, i) => (
              <li key={i}>
                <span className="font-semibold text-foreground">{nameFor(r.at)}</span>: {r.message}
              </li>
            ))}
          </ul>
        </MoreOptions>
      )}

      <Section title="Scoring" aside={<span className="text-[13px] text-muted-foreground">{count(eventCount, "event")}</span>}>
        <div className="flex flex-col gap-4">
          {review.categories.map((g) => (
            <div key={g.label} className="flex flex-col">
              <h4 className="type-caption pb-1.5 text-[15px] tracking-[0.04em] text-muted-foreground">{g.label}</h4>
              <Rows>
                {g.events.map((ev) => (
                  <ReviewRow
                    key={ev.id}
                    title={ev.label || <span className="text-muted-foreground">No name</span>}
                    detail={
                      ev.rules.length
                        ? `${withoutAward(ev.rules[0].sentence, ev.label)}${ev.rules.length > 1 ? ` · and ${count(ev.rules.length - 1, "more rule")}` : ""}`
                        : undefined
                    }
                    flags={<Flags items={eventFlags(ev)} />}
                    value={
                      <span className={cn("type-num shrink-0 text-[24px]", ev.points === 0 && "text-muted-foreground")} aria-label={`${ev.points} points`}>
                        {pointsText(ev.points)}
                      </span>
                    }
                    onClick={() => setOpen({ kind: "event", id: ev.id })}
                  />
                ))}
              </Rows>
            </div>
          ))}
        </div>
        <ActButton onClick={() => setAdding("event")} className="mt-1 self-start">
          <Plus className="size-[18px]" strokeWidth={2.4} aria-hidden />
          Add an event
        </ActButton>
      </Section>

      {review.otherRules.length > 0 && (
        <Section title="Other rules">
          <p className="-mt-1 text-[13px] leading-snug text-muted-foreground">These don&rsquo;t award an event on their own.</p>
          <Rows>
            {review.otherRules.map((r) => (
              <ReviewRow
                key={r.at}
                title={r.sentence}
                flags={<Flags items={r.problems.length ? [{ text: count(r.problems.length, "problem"), tone: "bad" }] : []} />}
                onClick={() => setOpen({ kind: "rule", at: r.at })}
              />
            ))}
          </Rows>
        </Section>
      )}

      <Section title="What research answers">
        <p className="-mt-1 text-[13px] leading-snug text-muted-foreground">Asked about each person, each episode.</p>
        <Rows>
          {review.questions.map((q) => (
            <ReviewRow
              key={q.key}
              title={q.question || <span className="text-muted-foreground">No question</span>}
              flags={<Flags items={questionFlags(q)} />}
              onClick={() => setOpen({ kind: "question", key: q.key })}
            />
          ))}
        </Rows>
        <ActButton onClick={() => setAdding("question")} className="mt-1 self-start">
          <Plus className="size-[18px]" strokeWidth={2.4} aria-hidden />
          Add a question
        </ActButton>
      </Section>

      {/* Read-only: how someone leaves comes from the chat's answer, not edited here. */}
      <Section title="Ways to leave">
        <Rows>
          {review.exits.map((x) => (
            <div key={x.name} className="flex min-h-12 items-center gap-3 py-2.5">
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-base font-semibold">{x.name}</span>
                {(x.meaning || x.warnings.length > 0) && (
                  <span className="text-[13px] leading-snug text-muted-foreground">
                    {[x.meaning, x.warnings.some((w) => w.startsWith("leaving this way scores nothing")) ? "Scores nothing" : ""].filter(Boolean).join(" · ")}
                  </span>
                )}
              </span>
              {x.kind !== "out" && <Chip>{x.kind === "winner" ? "Winner" : "Finalist"}</Chip>}
            </div>
          ))}
        </Rows>
      </Section>

      {review.flagged.length > 0 && (
        <Section title="Needs a developer">
          <p className="-mt-1 text-[13px] leading-snug text-muted-foreground">Approving leaves these out of the rules.</p>
          <Rows>
            {review.flagged.map((f) => (
              <div key={f.name} className="flex flex-col gap-1 py-3">
                <span className="text-base font-semibold">{f.name}</span>
                <span className="text-[15px] leading-snug">{f.what}</span>
                {f.whyCode && <span className="text-[13px] leading-snug text-muted-foreground">Why it needs code: {f.whyCode}</span>}
                {f.findings && <span className="text-[13px] leading-snug text-muted-foreground">{f.findings}</span>}
              </div>
            ))}
          </Rows>
        </Section>
      )}

      {review.domains.length > 0 && (
        <Section title="Research sites">
          <p className="-mt-1 text-[13px] leading-snug text-muted-foreground">Ticked sites are added to what research searches when you approve.</p>
          <RowList>
            {review.domains.map((d) => (
              <ToggleRow key={d.domain} label={d.domain} hint={d.why || undefined} checked={domainsChecked.has(d.domain)} onChange={() => toggleDomain(d.domain)} />
            ))}
          </RowList>
        </Section>
      )}

      <div className="flex flex-col gap-1">
        {review.notTrackable.length > 0 && (
          <MoreOptions label={`Left out: not reliably reported (${review.notTrackable.length})`}>
            <ul className="-mt-2 flex flex-col gap-1.5 text-[15px] leading-snug">
              {review.notTrackable.map((t, i) => (
                <li key={i}>
                  <span className="font-semibold">{t.fact}</span>
                  {t.why && <span className="text-muted-foreground"> · {t.why}</span>}
                </li>
              ))}
            </ul>
          </MoreOptions>
        )}
        <MoreOptions label="Advanced">
          <div className="-mt-2 flex flex-col gap-3">
            {!rulesEditorOpen ? (
              <div className="flex flex-wrap gap-2">
                <ActButton onClick={openRulesEditor}>Edit every rule as JSON</ActButton>
                <ActButton onClick={addOtherRule}>
                  <Plus className="size-[18px]" strokeWidth={2.4} aria-hidden />
                  Add a rule with no event
                </ActButton>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <p className="text-[13px] leading-snug text-muted-foreground">
                  The whole <code className="font-mono">rules</code> block, research and implied. Apply, and the review above checks it again straight away.
                </p>
                <Textarea rows={16} value={rulesText} onChange={(e) => setRulesText(e.target.value)} className="font-mono text-[13px]" />
                {rulesTextError && <Notice tone="bad">{rulesTextError}</Notice>}
                <div className="flex gap-2">
                  <ActButton tone="chyron" onClick={applyRulesText}>
                    Apply
                  </ActButton>
                  <ActButton onClick={() => setRulesEditorOpen(false)}>Cancel</ActButton>
                </div>
              </div>
            )}
          </div>
        </MoreOptions>
      </div>

      {note && <Notice>{note}</Notice>}
      {error && <Notice tone="bad">{error}</Notice>}

      {inPage ? (
        <StickyBar note={barNote}>{actions}</StickyBar>
      ) : (
        <div className="flex flex-col gap-2 border-t border-border pt-4">
          <p className="text-[13px] leading-snug text-muted-foreground">{barNote}</p>
          <div className="flex flex-wrap gap-2">{actions}</div>
        </div>
      )}

      {openEvent && (
        <EventSheet
          key={openEvent.id}
          ev={openEvent}
          categories={categoryOptions}
          onClose={() => setOpen(null)}
          onSave={(patch) => updateEvent(openEvent.id, patch)}
          onCategory={(c) => updateEvent(openEvent.id, { category: c })}
          onAddRule={() => addRuleForEvent(openEvent.id)}
          renderRule={(r) => (
            <RuleLine
              sentence={r.sentence}
              problems={problemsForAt(r.at)}
              rule={getRule(r.at)}
              onApply={(next) => setRule(r.at, next)}
              onRemove={() => removeRule(r.at)}
              context={ruleAtPath(r.at)?.list ?? "research"}
              {...ruleFieldProps}
            />
          )}
        />
      )}

      {openQuestion && (
        <QuestionSheet
          key={openQuestion.key}
          q={openQuestion}
          onClose={() => setOpen(null)}
          onSave={(patch) => updateQuestion(openQuestion.key, patch)}
          onRemove={async () => {
            const ok = await confirm(`Remove "${openQuestion.question || openQuestion.key}"? Research stops asking it, and any rule that reads it becomes a problem to fix.`, {
              danger: true,
              confirmLabel: "Remove",
            });
            if (!ok) return;
            removeQuestion(openQuestion.key);
            setOpen(null);
          }}
        />
      )}

      {openRule && (
        <BottomSheet open onOpenChange={(o) => !o && setOpen(null)} title="Rule" hideCancel>
          <div className="flex flex-col gap-4 border-t border-border pt-3 [overflow-wrap:anywhere]">
            <RuleLine
              sentence={openRule.sentence}
              problems={openRule.problems}
              rule={getRule(openRule.at)}
              onApply={(next) => setRule(openRule.at, next)}
              onRemove={() => {
                removeRule(openRule.at);
                setOpen(null);
              }}
              context={ruleAtPath(openRule.at)?.list ?? "research"}
              {...ruleFieldProps}
            />
            <PrimaryButton onClick={() => setOpen(null)}>Done</PrimaryButton>
          </div>
        </BottomSheet>
      )}

      {adding === "event" && (
        <TextSheet
          title="New event"
          label="What happens"
          help="It starts at 0 points under Other. Set its points and how it scores next."
          submit="Add event"
          onClose={() => setAdding(null)}
          onSubmit={(label) => {
            const id = addEvent(label);
            setAdding(null);
            setOpen({ kind: "event", id });
          }}
        />
      )}
      {adding === "question" && (
        <TextSheet
          title="New question"
          label="What research answers"
          help='About each person, each episode. For example, "Did they sit out of a challenge?"'
          submit="Add question"
          onClose={() => setAdding(null)}
          onSubmit={(label) => {
            const key = addQuestion(label);
            setAdding(null);
            setOpen({ kind: "question", key });
          }}
        />
      )}

      {approving && (
        <BottomSheet open onOpenChange={(o) => !o && setApproving(false)} title={`Approve ${current.name}`}>
          <SheetAction onClick={approveAsNewShow} detail="Recommended">
            Create it as a new show
          </SheetAction>
          <div className="flex flex-col gap-2 border-t border-border py-3">
            <label htmlFor="approve-existing" className="text-base font-semibold">
              Or use it for a show you already have
            </label>
            {showsQuery.isLoading ? (
              <p className="text-[13px] text-muted-foreground">Loading shows…</p>
            ) : (
              <>
                <select id="approve-existing" className={sheetSelectCls} value={pickedShowId} onChange={(e) => setPickedShowId(e.target.value)}>
                  <option value="">Choose a show…</option>
                  {shows.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                <p className="text-[13px] leading-snug text-muted-foreground">Its leagues switch to these rules. Results already recorded keep their wording.</p>
                <ActButton disabled={busy || !pickedShow} onClick={useForExistingShow} className="min-h-12">
                  {pickedShow ? `Switch ${pickedShow.name}` : "Switch"}
                </ActButton>
              </>
            )}
          </div>
        </BottomSheet>
      )}
    </div>
  );
}

// One event, opened from its row. Name and points are typed into local state and saved when the sheet
// closes (an id repaired from a bad chat id follows its label, so saving per keystroke could move the
// row out from under the sheet); the group and the rules apply as they change.
function EventSheet({
  ev,
  categories,
  onClose,
  onSave,
  onCategory,
  onAddRule,
  renderRule,
}: {
  ev: { id: string; label: string; points: number; category: string; tier: string | null; why: string; implied: boolean; problems: string[]; warnings: string[]; rules: { at: string; sentence: string }[] };
  categories: string[];
  onClose: () => void;
  onSave: (patch: Partial<{ label: string; points: number }>) => void;
  onCategory: (c: string) => void;
  onAddRule: () => void;
  renderRule: (r: { at: string; sentence: string }) => ReactNode;
}) {
  const [label, setLabel] = useState(ev.label);
  const [points, setPoints] = useState(Number.isFinite(ev.points) ? String(ev.points) : "");
  const options = categories.includes(ev.category) ? categories : [ev.category, ...categories];

  function close() {
    const patch: Partial<{ label: string; points: number }> = {};
    const l = label.trim();
    if (l && l !== ev.label && !ev.implied) patch.label = l;
    const n = parseFloat(points);
    if (Number.isFinite(n) && n !== ev.points) patch.points = n;
    if (Object.keys(patch).length) onSave(patch);
    onClose();
  }

  return (
    <BottomSheet open onOpenChange={(o) => !o && close()} title={ev.label || "Event"} description={ev.tier === "C" ? "Patchy reporting" : undefined} hideCancel>
      <div className="flex flex-col gap-5 border-t border-border pt-4 [overflow-wrap:anywhere]">
        {(ev.problems.length > 0 || ev.warnings.length > 0) && <Notes problems={ev.problems} warnings={ev.warnings.filter((w) => !w.startsWith("tier C"))} />}
        {ev.why && <p className="text-[15px] leading-snug text-muted-foreground">{ev.why}</p>}
        <div className="grid grid-cols-[1fr_96px] gap-3">
          {ev.implied ? (
            <LockedValue label="Name" value={ev.label} />
          ) : (
            <Field label="Name" htmlFor="ev-label">
              <input id="ev-label" className={fieldCls} value={label} onChange={(e) => setLabel(e.target.value)} />
            </Field>
          )}
          <Field label="Points" htmlFor="ev-points">
            <input id="ev-points" className={cn(fieldCls, "type-num text-[22px]")} type="number" inputMode="decimal" step="0.5" value={points} onChange={(e) => setPoints(e.target.value)} />
          </Field>
        </div>
        <Field label="Group" htmlFor="ev-group">
          <select
            id="ev-group"
            className={sheetSelectCls}
            value={ev.category}
            onChange={(e) => {
              if (e.target.value === "__new__") {
                const v = window.prompt("New group name:");
                if (v && v.trim()) onCategory(v.trim());
                return;
              }
              onCategory(e.target.value);
            }}
          >
            {options.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
            <option value="__new__">New group…</option>
          </select>
        </Field>
        <div className="flex flex-col gap-1">
          <span className="text-sm font-semibold">How it scores</span>
          {ev.implied && <p className="text-[13px] leading-snug text-muted-foreground">Automatic, from how they left. It can&rsquo;t be added by hand.</p>}
          {ev.rules.length ? (
            <ul className="flex flex-col border-b border-border [&>li]:border-t [&>li]:border-border [&>li]:py-1">
              {ev.rules.map((r) => (
                <li key={r.at}>{renderRule(r)}</li>
              ))}
            </ul>
          ) : (
            <p className="text-[13px] leading-snug text-muted-foreground">No rule scores it yet, so it can only be added by hand.</p>
          )}
          <button type="button" className={cn(LINK_BTN, "self-start")} onClick={onAddRule}>
            <Plus className="size-4" strokeWidth={2.4} aria-hidden />
            Add a rule
          </button>
        </div>
        <PrimaryButton onClick={close}>Done</PrimaryButton>
      </div>
    </BottomSheet>
  );
}

// One question research answers, opened from its row. Same save-on-close as EventSheet for the text;
// type and tier apply as they're picked.
function QuestionSheet({
  q,
  onClose,
  onSave,
  onRemove,
}: {
  q: { key: string; type: string; question: string; note: string; tier: string | null; where: string; problems: string[]; warnings: string[] };
  onClose: () => void;
  onSave: (patch: Partial<{ question: string; note: string; tier: string; type: string }>) => void;
  onRemove: () => void;
}) {
  const [question, setQuestion] = useState(q.question);
  const [noteText, setNoteText] = useState(q.note);

  function close() {
    const patch: Partial<{ question: string; note: string }> = {};
    const v = question.trim();
    if (v && v !== q.question) patch.question = v;
    if (noteText.trim() !== q.note) patch.note = noteText.trim();
    if (Object.keys(patch).length) onSave(patch);
    onClose();
  }

  return (
    <BottomSheet open onOpenChange={(o) => !o && close()} title="Question" description={q.key} hideCancel>
      <div className="flex flex-col gap-5 border-t border-border pt-4 [overflow-wrap:anywhere]">
        {(q.problems.length > 0 || q.warnings.length > 0) && <Notes problems={q.problems} warnings={q.warnings.filter((w) => !w.startsWith("tier C"))} />}
        <Field label="What research answers" htmlFor="q-text" hint="About each person, each episode.">
          <textarea id="q-text" rows={2} className={cn(fieldCls, "min-h-[72px] resize-y py-3 leading-snug")} value={question} onChange={(e) => setQuestion(e.target.value)} />
        </Field>
        <Field label="Answer" htmlFor="q-type">
          <select id="q-type" className={sheetSelectCls} value={q.type} onChange={(e) => onSave({ type: e.target.value })}>
            {!QUESTION_TYPES.includes(q.type) && <option value={q.type}>{q.type || "Choose…"}</option>}
            {QUESTION_TYPES.map((t) => (
              <option key={t} value={t}>
                {TYPE_LABELS[t] ?? t}
              </option>
            ))}
          </select>
        </Field>
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">How reliably it&rsquo;s reported</span>
          <Segmented label="How reliably it's reported" value={(q.tier ?? "") as "A" | "B" | "C"} options={TIER_OPTIONS} onChange={(t) => onSave({ tier: t })} />
          <p className="text-[13px] leading-snug text-muted-foreground">{q.tier ? TIER_HINTS[q.tier] : "Pick one before approving."}</p>
          {q.where && <p className="text-[13px] leading-snug text-muted-foreground">Where it&rsquo;s reported: {q.where}</p>}
        </div>
        <Field label="When the answer is yes" htmlFor="q-note" hint="A short phrase, 1 to 4 words, e.g. “at risk”. Research also searches for it.">
          <input id="q-note" className={fieldCls} value={noteText} onChange={(e) => setNoteText(e.target.value)} />
        </Field>
        <PrimaryButton onClick={close}>Done</PrimaryButton>
        <SheetAction danger onClick={onRemove}>
          Remove question
        </SheetAction>
      </div>
    </BottomSheet>
  );
}
