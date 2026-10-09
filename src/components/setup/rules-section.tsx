"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { LeagueState } from "@/lib/game/types";
import type { FormatData } from "@/lib/game/formats/index";
import StateLogic from "@/lib/game/state-logic.js";
import { formatFor } from "@/lib/game/formats/index.js";
import { describeRule } from "@/lib/game/formats/rules.js";
import { useLeagueStore, useCanManage } from "@/lib/store";
import { api, ApiError } from "@/lib/api";
import { confirm } from "@/lib/confirm-store";
import { Button } from "@/components/ui/button";
import { FormatRulesView } from "@/components/admin/format-rules-view";
import { LeagueRulesetEditor } from "./league-ruleset-editor";
import { ChevronDownIcon } from "@/components/icons";
import { cn } from "cn";

// League Settings > Rules (docs/PLAN-scoring-rules-as-data.md phase 4): the one place a league can
// read how it scores, and -- for its commissioner, in live mode -- fork its own editable copy of
// those rules ("Customise this league's rules") instead of following its show's format as-is.
// Mirrors shows-section.tsx's "view/edit rules" from the other side: there, an admin edits a MASTER
// (a built-in or a show_format) that every league on the show inherits; here, a commissioner edits
// their own COPY of one, which never touches the master and never needs admin involvement.
//
// Read-only in mock mode (no real league to fork/edit/abandon against) and for anyone who isn't this
// league's commissioner -- same "viewable by everyone, only your commissioner can change it" rule
// the rest of League Settings follows (setup-tab.tsx's banner).
export function RulesSection({ state }: { state: LeagueState }) {
  const leagueId = useLeagueStore((s) => s.leagueId);
  const mode = useLeagueStore((s) => s.mode);
  const setState = useLeagueStore((s) => s.setState);
  const canManage = useCanManage();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [showDiff, setShowDiff] = useState(false);

  const live = mode === "live" && !!leagueId;
  const { data: meta } = useQuery({
    queryKey: ["league-ruleset", leagueId],
    queryFn: () => api.getLeagueRuleset(leagueId!),
    enabled: live,
  });

  const format = StateLogic.formatOf(state);
  const custom = meta?.custom ?? null;

  // The master this league's own copy was forked from, as it stands right now -- for "a newer
  // version is out", not for display (nobody but its own commissioner edits a master, so there's
  // nothing to show here beyond whether it's moved on). Only resolvable for a builtin (always current,
  // it's just code) or a show_format this league's show still actually follows (settings.showFormatData
  // is kept current by the admin's own save, regardless of whether this league forked away from it --
  // see db/show-formats.js's unconditional push). A league_ruleset parent (another league's shared
  // copy) has no live read here -- that's the sharing/browse UI this phase deliberately leaves out.
  function currentMasterData(): FormatData | null {
    if (!custom) return null;
    if (custom.parentKind === "builtin" && custom.parentId) return formatFor(custom.parentId).data;
    if (custom.parentKind === "show_format" && custom.parentId === state.settings.showFormat && state.settings.showFormatData) {
      return state.settings.showFormatData;
    }
    return null;
  }
  const masterData = currentMasterData();
  const diff = masterData ? diffRulesets(custom!.data, masterData) : null;

  async function refresh() {
    const [res] = await Promise.all([api.leagueState(leagueId!), queryClient.invalidateQueries({ queryKey: ["league-ruleset", leagueId] })]);
    setState(res.state);
  }

  async function run(fn: () => Promise<unknown>, successNote?: string) {
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      await fn();
      await refresh();
      if (successNote) setNote(successNote);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "That didn't work.");
    } finally {
      setBusy(false);
    }
  }

  async function customise() {
    if (!meta || meta.custom || !meta.following) return;
    await run(async () => {
      await api.forkLeagueRuleset(leagueId!, { from: meta.following!.kind, sourceId: meta.following!.id });
    });
    setEditing(true);
  }

  async function saveEdits(next: FormatData) {
    await run(async () => {
      await api.editLeagueRuleset(leagueId!, next);
    }, "Saved.");
    setEditing(false);
  }

  async function abandon() {
    const ok = await confirm(
      "Go back to following the show's own rules? Your customised copy is discarded -- this can't be undone.",
      { confirmLabel: "Go back", danger: true }
    );
    if (!ok) return;
    await run(async () => {
      await api.abandonLeagueRuleset(leagueId!);
    }, "Back to the show's own rules.");
    setEditing(false);
  }

  async function updateFromMaster() {
    if (!custom || custom.parentKind === "none") return;
    const ok = await confirm(
      "Replace your customised rules with the master's current ones? Any changes you made are lost -- redo them afterwards if you still want them.",
      { confirmLabel: "Replace", danger: true }
    );
    if (!ok) return;
    await run(async () => {
      await api.abandonLeagueRuleset(leagueId!);
      await api.forkLeagueRuleset(leagueId!, { from: custom.parentKind as "builtin" | "show_format", sourceId: custom.parentId! });
    }, "Updated to the master's current rules.");
    setEditing(false);
    setShowDiff(false);
  }

  const statusLine = !live
    ? `Following ${format.name}'s rules.`
    : !meta
      ? "Loading…"
      : custom
        ? "Your own customised rules."
        : `Following ${format.name}'s rules.`;

  return (
    <div className="mb-4 rounded-lg border border-border bg-card shadow-sm">
      <button className="flex w-full items-center justify-between gap-2 p-4 text-left" onClick={() => setOpen((o) => !o)}>
        <div>
          <h3 className="text-[0.7rem] font-bold uppercase tracking-wide text-muted-foreground">Rules</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">{statusLine}</p>
        </div>
        <ChevronDownIcon className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="flex flex-col gap-2 px-4 pb-4 text-xs">
          {live && canManage && (
            <div className="flex flex-wrap items-center gap-1.5">
              {!custom ? (
                <Button size="xs" disabled={busy || !meta?.following} onClick={customise}>
                  Customise this league&rsquo;s rules
                </Button>
              ) : (
                <>
                  {!editing && (
                    <Button size="xs" disabled={busy} onClick={() => setEditing(true)}>
                      Edit
                    </Button>
                  )}
                  <Button variant="secondary" size="xs" disabled={busy} onClick={abandon}>
                    Abandon — go back to the show&rsquo;s rules
                  </Button>
                </>
              )}
            </div>
          )}

          {custom && diff?.changed && (
            <div className="rounded-md border border-primary/40 bg-primary/5 p-2">
              <p className="font-semibold">The master&rsquo;s rules have changed since you customised this league.</p>
              <div className="mt-1 flex items-center gap-1.5">
                <button className="text-muted-foreground underline-offset-2 hover:text-foreground hover:underline" onClick={() => setShowDiff((v) => !v)}>
                  {showDiff ? "hide what changed" : "see what changed"}
                </button>
                {canManage && (
                  <Button size="xs" disabled={busy} onClick={updateFromMaster}>
                    Replace with the master&rsquo;s current rules
                  </Button>
                )}
              </div>
              {showDiff && (
                <ul className="mt-1.5 flex flex-col gap-0.5 text-muted-foreground">
                  {diff.eventsAdded.map((l) => (
                    <li key={`ea-${l}`}>+ new event: {l}</li>
                  ))}
                  {diff.eventsRemoved.map((l) => (
                    <li key={`er-${l}`}>− event no longer in the master: {l}</li>
                  ))}
                  {diff.rulesAdded.map((s) => (
                    <li key={`ra-${s}`}>+ {s}</li>
                  ))}
                  {diff.rulesRemoved.map((s) => (
                    <li key={`rr-${s}`}>− {s}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {editing && custom ? (
            <LeagueRulesetEditor data={custom.data} onSave={saveEdits} onCancel={() => setEditing(false)} busy={busy} error={error} />
          ) : (
            <>
              {/* format.data (StateLogic.formatOf) already reflects a custom ruleset when one is
                  active -- it checks settings.leagueRulesetData before showFormat/showFormatData,
                  the same cache this screen's own edits write to. */}
              <FormatRulesView data={format.data} onClose={() => setOpen(false)} badge={custom ? "Your own copy — read only" : `${format.name} — read only`} />
              {error && <p className="font-semibold text-destructive">{error}</p>}
            </>
          )}
          {note && <p className="font-semibold text-good">{note}</p>}
        </div>
      )}
    </div>
  );
}

// "Here's what changed" (not a merge): every rule as its sentence, and every event, compared as sets
// -- enough to tell a commissioner what a master update would bring in without building the full
// three-way merge the plan defers (docs/PLAN-scoring-rules-as-data.md, "Merging copies").
function diffRulesets(mine: FormatData, master: FormatData) {
  const sentencesOf = (d: FormatData) => new Set([...d.rules.research, ...d.rules.implied].map((r) => describeRule(r, d)));
  const mineSentences = sentencesOf(mine);
  const masterSentences = sentencesOf(master);
  const mineEvents = new Map(mine.events.map((e) => [e.id, e]));
  const masterEvents = new Map(master.events.map((e) => [e.id, e]));
  const rulesAdded = [...masterSentences].filter((s) => !mineSentences.has(s));
  const rulesRemoved = [...mineSentences].filter((s) => !masterSentences.has(s));
  const eventsAdded = [...masterEvents.values()].filter((e) => !mineEvents.has(e.id)).map((e) => e.label);
  const eventsRemoved = [...mineEvents.values()].filter((e) => !masterEvents.has(e.id)).map((e) => e.label);
  return { changed: rulesAdded.length + rulesRemoved.length + eventsAdded.length + eventsRemoved.length > 0, rulesAdded, rulesRemoved, eventsAdded, eventsRemoved };
}
