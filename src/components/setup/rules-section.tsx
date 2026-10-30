"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { LeagueState } from "@/lib/game/types";
import type { FormatData } from "@/lib/game/formats/index";
import StateLogic from "@/lib/game/state-logic.js";
import { formatFor } from "@/lib/game/formats/index.js";
import { describeRule } from "@/lib/game/formats/rules.js";
import { scoringGroups } from "@/lib/game/scoring-groups";
import { useLeagueStore, useCanManage } from "@/lib/store";
import { useMutate } from "@/lib/use-mutate";
import { useShowTerms } from "@/lib/use-show-terms";
import { api, ApiError } from "@/lib/api";
import { confirm } from "@/lib/confirm-store";
import { BottomSheet, SheetAction } from "@/components/ui/bottom-sheet";
import { ruleSentencesFor } from "@/components/formats/format-rules-view";
import { PlainButton } from "@/components/draft/draft-ui";
import { ChevronRight, Minus, Plus } from "lucide-react";
import { cn } from "cn";
import { tourMark } from "@/lib/tour/tour-store";
import { LeagueRulesetEditor } from "./league-ruleset-editor";
import { RuleChangesSection } from "./rule-changes-section";
import { Chip, MoreButton, NotInThisLeague, PrimaryButton, ReadOnlyNote, SettingsPage, StepperRow } from "./settings-ui";

// League Settings > Scoring & rules (docs/PLAN-ux-redesign.md, 2c; the canvas's "Rules" and
// "Rules-Edit"): one line per event, grouped by the show's categories, showing only this league's
// points. Tap a row for when it scores, and -- for the commissioner of an Active Roster league -- to
// change its points in a sheet. Categories after the first two start folded, so the page fits in
// about two screens.
//
// The league can also fork its own editable copy of the show's rules (docs/PLAN-scoring-rules-as-data.md
// phase 4: "Customise", in the page's ⋯ sheet), which edits WHEN each event scores, on its own page
// (/setup/rules/edit). That copy never touches the master and never needs an admin. Read-only in mock
// mode (no real league to fork against) and for anyone who isn't this league's commissioner.
//
// What scores depends on the league type: Active Roster scores these events (settings.eventPoints);
// Classic scores by finishing place; Eliminator Pool by correct picks. For the last two the events
// are what the show records each episode, listed without points.

function useRuleset() {
  const leagueId = useLeagueStore((s) => s.leagueId);
  const mode = useLeagueStore((s) => s.mode);
  const live = mode === "live" && !!leagueId;
  const { data: meta } = useQuery({
    queryKey: ["league-ruleset", leagueId],
    queryFn: () => api.getLeagueRuleset(leagueId!),
    enabled: live,
  });
  return { live, meta, custom: meta?.custom ?? null };
}

export function RulesPage() {
  const state = useLeagueStore((s) => s.state);
  const leagueId = useLeagueStore((s) => s.leagueId);
  const setState = useLeagueStore((s) => s.setState);
  const canManage = useCanManage();
  const mutate = useMutate();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { live, meta, custom } = useRuleset();
  const [menuOpen, setMenuOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [showDiff, setShowDiff] = useState(false);
  const [openEvent, setOpenEvent] = useState<string | null>(null);
  const [allCategories, setAllCategories] = useState(false);

  const showTerms = useShowTerms();
  const type = StateLogic.getLeagueType(state);
  const ar = !!type.hasActiveRoster;
  const format = StateLogic.formatOf(state);
  const recommended = StateLogic.defaultEventPoints(state);
  const pointsOf = (id: string) => StateLogic.ActiveRosterLogic.pointsFor(state, id);
  const changed = Object.keys(recommended).filter((id) => pointsOf(id) !== recommended[id]);

  // The master this league's own copy was forked from, as it stands now -- for "a newer version is
  // out". Only resolvable for a builtin (always current, it's code) or a show_format this league's show
  // still follows (settings.showFormatData is kept current by the admin's own save). A league_ruleset
  // parent (another league's shared copy) has no live read here.
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
    const [res] = await Promise.all([
      api.leagueState(leagueId!),
      queryClient.invalidateQueries({ queryKey: ["league-ruleset", leagueId] }),
    ]);
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
      return true;
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "That didn't work.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function customise() {
    setMenuOpen(false);
    if (!meta) return;
    if (!meta.custom) {
      if (!meta.following) return;
      const ok = await run(() =>
        api.forkLeagueRuleset(leagueId!, {
          from: meta.following!.kind,
          sourceId: meta.following!.id,
        })
      );
      if (!ok) return;
    }
    router.push("/setup/rules/edit");
  }

  async function abandon() {
    setMenuOpen(false);
    const ok = await confirm("Go back to following the show's own rules? Your customised copy is discarded -- this can't be undone.", {
      confirmLabel: "Go back",
      danger: true,
    });
    if (!ok) return;
    await run(() => api.abandonLeagueRuleset(leagueId!), "Back to the show's own rules.");
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
      await api.forkLeagueRuleset(leagueId!, {
        from: custom.parentKind as "builtin" | "show_format",
        sourceId: custom.parentId!,
      });
    }, "Updated to the master's current rules.");
    setShowDiff(false);
  }

  async function updateSetting(field: string, value: unknown) {
    await mutate(
      (s) => StateLogic.updateSettings(s, field, value),
      () => api.updateLeagueSettings(leagueId!, field, value)
    );
  }
  // eventPoints is one settings field holding a map, so one event's change writes the whole object back.
  const setPoints = (id: string, points: number) =>
    updateSetting("eventPoints", {
      ...state.settings.eventPoints,
      [id]: points,
    });
  async function applyRecommended() {
    setMenuOpen(false);
    await updateSetting("eventPoints", {
      ...state.settings.eventPoints,
      ...recommended,
    });
  }

  const following = live && meta ? (custom ? "your own copy of the rules" : `${format.name}'s rules`) : `${format.name}'s rules`;
  const canFork = live && canManage && !!meta && (!!custom || !!meta.following);
  const hasMenu = canManage && (canFork || (ar && changed.length > 0));
  const groups = scoringGroups(state);
  const shownGroups = allCategories ? groups : groups.slice(0, 2);
  const eventOpen = openEvent ? format.events.find((e) => e.id === openEvent) : undefined;

  return (
    <SettingsPage title="Scoring & rules">
      <ReadOnlyNote />
      <div className="flex items-start gap-3">
        <p className="min-w-0 flex-1 text-base leading-relaxed">
          {ar ? (
            <>
              <span className="font-semibold">
                Following {following}
                {changed.length > 0 ? `, with ${changed.length} point${changed.length === 1 ? "" : "s"} changed` : ""}.
              </span>{" "}
              <span className="text-muted-foreground">Only starters score. Tap a rule to see when it scores.</span>
            </>
          ) : type.hasWeeklyPicks ? (
            <span className="text-muted-foreground">
              Each episode, every player picks someone they think survives it. A correct pick scores; the standings rank the longest streak
              of correct picks, then the total.
            </span>
          ) : (
            <span className="text-muted-foreground">
              Each of your {showTerms.castaways} earns 1 point, plus 1 every time someone else goes home. The longer they last, the
              more they earn: the first one out ends on 1, the winner on {state.castaways.length || "the cast size"}.
            </span>
          )}
        </p>
        {hasMenu && (
          <span data-tour="rules-menu" className="-mr-2 -mt-1.5">
            <MoreButton label="Rules actions" onClick={() => setMenuOpen(true)} />
          </span>
        )}
      </div>

      {type.hasWeeklyPicks && (
        <div className="border-y border-border">
          <StepperRow
            label="Points per correct pick"
            value={state.settings.pickemCorrectPoints}
            min={0}
            disabled={!canManage}
            onChange={(n) => updateSetting("pickemCorrectPoints", n)}
          />
        </div>
      )}

      {custom && diff?.changed && (
        <div className="flex flex-col gap-2 rounded-[3px] bg-card p-3.5 text-sm">
          <p className="font-semibold">The show&rsquo;s rules have changed since you customised this league&rsquo;s.</p>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              className="min-h-11 font-semibold text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
              onClick={() => setShowDiff((v) => !v)}
            >
              {showDiff ? "Hide what changed" : "See what changed"}
            </button>
            {canManage && (
              <PlainButton disabled={busy} onClick={updateFromMaster}>
                Use the show&rsquo;s new rules
              </PlainButton>
            )}
          </div>
          {showDiff && (
            <ul className="flex flex-col gap-1 text-muted-foreground">
              {diff.eventsAdded.map((l) => (
                <li key={`ea-${l}`}>+ New event: {l}</li>
              ))}
              {diff.eventsRemoved.map((l) => (
                <li key={`er-${l}`}>− No longer in the show&rsquo;s rules: {l}</li>
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

      <RuleChangesSection state={state} />

      <div className="flex flex-col gap-5">
        {!ar && <h3 className="type-caption -mb-1 text-[22px]">What the show records</h3>}
        {shownGroups.map((g) => (
          <section key={g.id} className="flex flex-col">
            <h3 className="type-caption pb-1.5 text-[18px] text-muted-foreground">{g.label}</h3>
            <div className="flex flex-col border-b border-border">
              {g.events.map((ev) => {
                const pts = pointsOf(ev.id);
                const isChanged = ar && recommended[ev.id] !== undefined && pts !== recommended[ev.id];
                return (
                  <button
                    key={ev.id}
                    type="button"
                    onClick={() => {
                      setOpenEvent(ev.id);
                      tourMark("rule-sheet");
                    }}
                    data-tour={ev.id === shownGroups[0]?.events[0]?.id ? "rule-first" : undefined}
                    className="flex min-h-[50px] items-center gap-3 border-t border-border text-left outline-none hover:bg-accent/40 focus-visible:bg-accent"
                  >
                    <span className="flex min-w-0 flex-1 items-center gap-2 text-[15px]">
                      <span className="min-w-0">{ev.label}</span>
                      {ev.implied && <span className="shrink-0 text-xs text-muted-foreground">auto</span>}
                      {isChanged && (
                        <span className="size-2 shrink-0 rounded-full bg-chyron-line" aria-label="Changed from the recommended points" />
                      )}
                    </span>
                    {ar ? (
                      <span className={cn("type-num min-w-10 text-right text-[22px]", pts === 0 && "text-muted-foreground")}>
                        {fmt(pts)}
                      </span>
                    ) : (
                      <ChevronRight className="size-[18px] shrink-0 text-muted-foreground" strokeWidth={2.2} aria-hidden />
                    )}
                  </button>
                );
              })}
            </div>
          </section>
        ))}
        {groups.length > 2 && (
          <PlainButton onClick={() => setAllCategories((v) => !v)}>
            {allCategories ? "Show fewer categories" : `Show ${groups.length - 2} more categor${groups.length - 2 === 1 ? "y" : "ies"}`}
          </PlainButton>
        )}
      </div>

      {error && <p className="text-sm font-semibold text-live">{error}</p>}
      {note && <p className="text-sm font-semibold text-good">{note}</p>}

      {menuOpen && (
        <BottomSheet open onOpenChange={(o) => !o && setMenuOpen(false)} title="Scoring & rules">
          {canFork && <SheetAction onClick={customise}>{custom ? "Edit when events score" : "Customise when events score"}</SheetAction>}
          {ar && changed.length > 0 && <SheetAction onClick={applyRecommended}>Use recommended points</SheetAction>}
          {canFork && custom && (
            <SheetAction danger onClick={abandon}>
              Go back to the show&rsquo;s rules
            </SheetAction>
          )}
        </BottomSheet>
      )}

      {eventOpen && (
        <EventSheet
          key={eventOpen.id}
          state={state}
          label={eventOpen.label}
          implied={!!eventOpen.implied}
          sentences={ruleSentencesFor(format.data, eventOpen.id)}
          points={ar ? pointsOf(eventOpen.id) : null}
          recommended={ar ? (recommended[eventOpen.id] ?? null) : null}
          editable={ar && canManage}
          onClose={() => setOpenEvent(null)}
          onSave={(n) => {
            setOpenEvent(null);
            if (n !== pointsOf(eventOpen.id)) setPoints(eventOpen.id, n);
          }}
        />
      )}
    </SettingsPage>
  );
}

function fmt(n: number) {
  return n < 0 ? `−${Math.abs(n)}` : String(n);
}

// One event: when it scores, and (Active Roster) what it's worth here, with a stepper to change it.
function EventSheet({
  state,
  label,
  implied,
  sentences,
  points,
  recommended,
  editable,
  onClose,
  onSave,
}: {
  state: LeagueState;
  label: string;
  implied: boolean;
  sentences: string[];
  points: number | null;
  recommended: number | null;
  editable: boolean;
  onClose: () => void;
  onSave: (points: number) => void;
}) {
  const [draft, setDraft] = useState(points === null ? "" : String(points));
  const n = parseFloat(draft);
  const valid = Number.isFinite(n);
  const value = valid ? StateLogic.roundPoints(n) : 0;
  const shared = state.settings.ownershipMode === "shared";
  const isChanged = points !== null && recommended !== null && points !== recommended;
  const stepBtn =
    "flex size-[52px] shrink-0 items-center justify-center rounded-[3px] border border-input text-foreground hover:bg-accent focus-visible:outline-3 focus-visible:outline-chyron-line";

  return (
    <BottomSheet
      open
      onOpenChange={(o) => !o && onClose()}
      title={
        <span className="flex items-center gap-2.5">
          {label}
          {isChanged && <Chip tone="chyron">Changed</Chip>}
        </span>
      }
    >
      <div className="flex flex-col gap-4 border-t border-border pt-4">
        {points !== null && (
          <div className="flex flex-col gap-1.5" data-tour="rule-points">
            <span className="text-sm font-semibold">Points</span>
            {editable ? (
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  className={stepBtn}
                  aria-label="One point less"
                  onClick={() => setDraft(String(StateLogic.roundPoints(value - 1)))}
                >
                  <Minus className="size-[22px]" strokeWidth={2.4} aria-hidden />
                </button>
                <input
                  aria-label="Points"
                  inputMode="decimal"
                  className="type-num min-w-0 flex-1 bg-transparent text-center text-chyron-line outline-none"
                  // Inline: the global 16px phone rule for fields (globals.css) would beat a class.
                  style={{ fontSize: 44 }}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                />
                <button
                  type="button"
                  className={stepBtn}
                  aria-label="One point more"
                  onClick={() => setDraft(String(StateLogic.roundPoints(value + 1)))}
                >
                  <Plus className="size-[22px]" strokeWidth={2.4} aria-hidden />
                </button>
              </div>
            ) : (
              <span className="type-num text-[44px]">{fmt(points)}</span>
            )}
            {recommended !== null && (
              <p className="text-[13px] leading-snug text-muted-foreground">
                Recommended {fmt(recommended)}, balanced for {shared ? "shared" : "exclusive"} ownership. Decimals are fine; 0 switches it
                off.
              </p>
            )}
          </div>
        )}
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">Scores when</span>
          {sentences.length > 0 ? (
            <ul className="flex flex-col gap-1.5">
              {sentences.map((s) => (
                <li key={s} className="rounded-[3px] border border-input bg-card px-3.5 py-2.5 text-[15px] leading-snug">
                  {s}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[15px] text-muted-foreground">
              {implied ? "Automatically, from how they leave the game or a change in their role." : "When it's recorded for an episode."}
            </p>
          )}
        </div>
        {editable && (
          <div data-tour="rule-done" className="flex flex-col">
            <PrimaryButton disabled={!valid} onClick={() => onSave(value)}>
              Done
            </PrimaryButton>
          </div>
        )}
      </div>
    </BottomSheet>
  );
}

// /setup/rules/edit: the league's own copy, editing which events score and when. Reached from the
// rules page's ⋯ sheet after Customise has made the copy.
export function RulesEditPage() {
  const leagueId = useLeagueStore((s) => s.leagueId);
  const setState = useLeagueStore((s) => s.setState);
  const canManage = useCanManage();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { live, meta, custom } = useRuleset();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const back = { href: "/setup/rules", label: "Scoring & rules" };

  if (!live || !canManage) {
    return (
      <SettingsPage title="Edit rules" back={back}>
        <NotInThisLeague what="editable rules here" />
      </SettingsPage>
    );
  }
  if (!meta)
    return (
      <SettingsPage title="Edit rules" back={back}>
        {null}
      </SettingsPage>
    );
  if (!custom) {
    return (
      <SettingsPage title="Edit rules" back={back}>
        <p className="text-base text-muted-foreground">
          This league follows the show&rsquo;s rules. Customise them from Scoring &amp; rules first.
        </p>
      </SettingsPage>
    );
  }

  async function save(next: FormatData) {
    setBusy(true);
    setError(null);
    try {
      await api.editLeagueRuleset(leagueId!, next);
      const [res] = await Promise.all([
        api.leagueState(leagueId!),
        queryClient.invalidateQueries({
          queryKey: ["league-ruleset", leagueId],
        }),
      ]);
      setState(res.state);
      router.push("/setup/rules");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "That didn't work.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <SettingsPage title="Edit rules" back={back}>
      <LeagueRulesetEditor
        key={leagueId}
        data={custom.data}
        onSave={save}
        onCancel={() => router.push("/setup/rules")}
        busy={busy}
        error={error}
      />
    </SettingsPage>
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
  return {
    changed: rulesAdded.length + rulesRemoved.length + eventsAdded.length + eventsRemoved.length > 0,
    rulesAdded,
    rulesRemoved,
    eventsAdded,
    eventsRemoved,
  };
}
