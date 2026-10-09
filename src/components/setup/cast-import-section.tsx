"use client";

import { useMemo, useState } from "react";
import type { LeagueState } from "@/lib/game/types";
import StateLogic from "@/lib/game/state-logic.js";
import { buildCastPrompt, parseCastImport, roleChoices, toCastImport, toCastRoles, type CastRow, type ParsedCast } from "@/lib/game/formats/cast-prompt.js";
import { useLeagueStore, useCanManage } from "@/lib/store";
import { useShowTerms } from "@/lib/use-show-terms";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CastawayAvatar } from "@/components/castaway-avatar";
import { ChevronDownIcon } from "@/components/icons";
import { cn } from "cn";
import { seasonCastApi, useSeasonCastMode } from "@/lib/season-cast-api";

// "Import a cast" (docs/PLAN-cast-import-prompt.md): copy a research prompt into any web-searching
// chat, paste its JSON back, review one row per person, confirm. Same shape as "Research a new show"
// (format-research-panel.tsx), for a season's cast instead of a show's rules. Any league's
// commissioner can use it -- the wiki connector usually fills a cast in for the shows it reaches, but
// nothing stops a commissioner wanting to paste one.
//
// Applying is StateLogic.applyCastImport then applyCastRoles (the route re-parses against the
// league's format first), so it's additive: anyone already in the league is left as they are.
//
// On a league with a season (docs/PLAN-universal-season-cast.md) the people become the SEASON's
// shared cast, so the review asks whether the starting groups were public before the premiere -- it
// never assumes -- and roles stay this league's own, as episode-1 results. Once the season's cast is
// someone else's or finished, there's nothing to import into, and the section hides.
export function CastImportSection({ state }: { state: LeagueState }) {
  const leagueId = useLeagueStore((s) => s.leagueId);
  const mode = useLeagueStore((s) => s.mode);
  const setState = useLeagueStore((s) => s.setState);
  const canManage = useCanManage();
  const terms = useShowTerms();
  const [open, setOpen] = useState(false);
  const [season, setSeason] = useState(state.settings.wikiSeason ? `Season ${state.settings.wikiSeason}` : "");
  const [answer, setAnswer] = useState("");
  const [parsed, setParsed] = useState<ParsedCast | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const { mode: cast, refresh } = useSeasonCastMode();
  const [tribesPublic, setTribesPublic] = useState<boolean | null>(null);

  // The league's format with the show's own words for its people and groups.
  const base = StateLogic.formatOf(state);
  const format = useMemo(
    () => ({ name: base.name, hasGroups: base.hasGroups, roles: base.roles, terms: { castaway: terms.Castaway, tribe: terms.Tribe } }),
    [base, terms.Castaway, terms.Tribe]
  );
  const prompt = buildCastPrompt(format, { seasonName: season.trim() || undefined, showName: terms.showName ?? undefined });
  const roles = roleChoices(format);

  if (!canManage || cast.kind === "shared") return null;
  const seasonal = cast.kind === "create" || cast.kind === "creating";
  const seasonName = seasonal ? `Season ${cast.seasonNumber}` : "";

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked -- the prompt's still selectable below */
    }
  }

  function review() {
    setError(null);
    setNote(null);
    try {
      setParsed(parseCastImport(answer, format));
    } catch (e) {
      setError(e instanceof Error ? e.message : "That couldn't be read.");
    }
  }

  // Edits re-run the parser, so a fixed name clears its problem and a duplicate is caught again.
  function edit(i: number, patch: Partial<CastRow>) {
    if (!parsed) return;
    const castaways = parsed.castaways.map((c, j) => (j === i ? { ...c, ...patch } : c));
    setParsed({ ...parseCastImport({ castaways, sources: parsed.sources }, format), repairs: parsed.repairs });
  }
  function drop(i: number) {
    if (!parsed) return;
    const castaways = parsed.castaways.filter((_, j) => j !== i);
    setParsed({ ...parseCastImport({ castaways, sources: parsed.sources }, format), repairs: parsed.repairs });
  }

  const inLeague = (name: string) => state.castaways.some((c) => c.name.trim().toLowerCase() === name.trim().toLowerCase());
  const importable = parsed ? parsed.castaways.filter((c) => c.name && !c.problems.length && !inLeague(c.name)) : [];
  // Asked once per season cast, and only when this answer brings starting groups with it.
  const askTribes =
    seasonal &&
    format.hasGroups &&
    !(cast.kind === "creating" && cast.tribesConfirmed) &&
    !!parsed?.castaways.some((c) => c.startingGroup && c.startingGroup.trim());

  async function confirmImport() {
    if (!parsed) return;
    setBusy(true);
    setError(null);
    // Rows' `problems` ride along harmlessly: the parse on the other end works them out afresh.
    const proposal = { castaways: parsed.castaways.filter((c) => !c.problems.length), sources: parsed.sources };
    try {
      let added: string[];
      let recorded: string[];
      if (mode === "mock") {
        const p = parseCastImport(proposal, base);
        added = StateLogic.applyCastImport(state, toCastImport(p)).castaways;
        recorded = StateLogic.applyCastRoles(state, toCastRoles(p, base)).recorded;
        setState(state);
      } else if (seasonal) {
        const res = await seasonCastApi.importCast(leagueId!, proposal, askTribes ? (tribesPublic ? null : 1) : undefined);
        setState(res.state);
        added = res.added.castaways;
        recorded = res.roles.recorded;
        refresh();
      } else {
        const res = await api.importCast(leagueId!, proposal);
        setState(res.state);
        added = res.added.castaways;
        recorded = res.roles.recorded;
      }
      setNote(
        `Added ${added.length} ${added.length === 1 ? terms.castaway : terms.castaways}` +
          (recorded.length ? `, with ${recorded.length} starting ${recorded.length === 1 ? "role" : "roles"} recorded at episode 1` : "") +
          "."
      );
      setParsed(null);
      setAnswer("");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "The import didn't work.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="flex flex-col border-y border-border">
      <button className="flex min-h-[56px] w-full items-center justify-between gap-2 text-left" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span className="flex flex-col gap-0.5">
          <span className="text-base font-semibold">Import a cast</span>
          <span className="text-[13px] text-muted-foreground">Fill everyone in at once from an AI chat&rsquo;s answer</span>
        </span>
        <ChevronDownIcon className={cn("h-5 w-5 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="flex flex-col gap-2 pb-4 text-sm">
          {!parsed ? (
            <>
              <p className="text-muted-foreground">
                Fill the whole cast in at once: names, photos
                {format.hasGroups ? ` and starting ${terms.tribes}` : ""}
                {roles.length ? " and starting roles" : ""}. 1. Copy the prompt into any AI chat with web search. 2. Paste its
                answer below. 3. Review and import. Anyone already in the league is left as they are.
              </p>
              <div className="flex flex-wrap items-center gap-1.5">
                <Input size="sm" className="min-w-[160px] flex-1" placeholder="Season, e.g. Season 50" value={season} onChange={(e) => setSeason(e.target.value)} />
                <Button variant="secondary" size="xs" onClick={copyPrompt}>
                  {copied ? "Copied!" : "Copy prompt"}
                </Button>
              </div>
              <Textarea readOnly rows={4} value={prompt} className="font-mono text-[0.65rem] text-muted-foreground" />
              <label className="flex flex-col gap-1">
                <span className="font-semibold">Paste the answer here</span>
                <Textarea
                  rows={6}
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  placeholder="Paste the JSON the chat wrote back (a code fence or a line of chatter around it is fine)."
                  className="font-mono text-[0.7rem]"
                />
              </label>
              <div>
                <Button size="xs" disabled={!answer.trim()} onClick={review}>
                  Review
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="text-muted-foreground">
                {importable.length} new {importable.length === 1 ? terms.castaway : terms.castaways} to import. Fix anything wrong
                before importing.
                {seasonal && ` They become ${seasonName}'s shared cast, for every league on the season.`}
                {seasonal && roles.length > 0 && " Starting roles are recorded in this league only, as episode 1 results."}
              </p>
              {parsed.repairs.length > 0 && (
                <ul className="list-disc pl-4 text-muted-foreground">
                  {parsed.repairs.map((r, i) => (
                    <li key={i}>
                      <span className="font-mono">{r.at}</span>: {r.message}
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex flex-col gap-1.5">
                {parsed.castaways.map((c, i) => {
                  const already = !!c.name && inLeague(c.name);
                  return (
                    <div key={i} className={cn("flex flex-wrap items-center gap-1.5 rounded-md border border-border p-2", already && "opacity-60")}>
                      <CastawayAvatar
                        castaway={{ name: c.name || "?", photoUrl: c.photoUrl }}
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-secondary text-[0.6rem] font-bold text-muted-foreground"
                      />
                      <Input size="sm" className="min-w-[120px] flex-1" value={c.name} onChange={(e) => edit(i, { name: e.target.value })} />
                      {format.hasGroups && (
                        <Input
                          size="sm"
                          className="w-[110px]"
                          placeholder={terms.Tribe}
                          value={c.startingGroup ?? ""}
                          onChange={(e) => edit(i, { startingGroup: e.target.value })}
                        />
                      )}
                      {roles.length > 0 && (
                        <Select size="sm" value={c.startingRole ?? roles[0]} onChange={(e) => edit(i, { startingRole: e.target.value })}>
                          {roles.map((r) => (
                            <option key={r} value={r}>
                              {r}
                            </option>
                          ))}
                        </Select>
                      )}
                      <Input size="sm" className="min-w-[140px] flex-1" placeholder="Photo URL" value={c.photoUrl} onChange={(e) => edit(i, { photoUrl: e.target.value })} />
                      <Button variant="secondary" size="xs" onClick={() => drop(i)}>
                        Remove
                      </Button>
                      {(c.problems.length > 0 || already) && (
                        <span className={cn("basis-full", c.problems.length ? "font-semibold text-destructive" : "text-muted-foreground")}>
                          {c.problems.length ? c.problems.join("; ") : "Already in the league -- will be left as is."}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
              {askTribes && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="font-semibold">Were these starting {terms.tribes} public before the premiere?</span>
                  <label className="flex items-center gap-1">
                    <input type="radio" name="tribes-public" checked={tribesPublic === true} onChange={() => setTribesPublic(true)} />
                    Yes, show them now
                  </label>
                  <label className="flex items-center gap-1">
                    <input type="radio" name="tribes-public" checked={tribesPublic === false} onChange={() => setTribesPublic(false)} />
                    No, episode 1 shows them (held until each league gets there)
                  </label>
                </div>
              )}
              <div className="flex items-center gap-1.5">
                <Button size="xs" disabled={busy || importable.length === 0 || (askTribes && tribesPublic === null)} onClick={confirmImport}>
                  {busy ? "Importing…" : `Import ${importable.length}`}
                </Button>
                <Button variant="secondary" size="xs" disabled={busy} onClick={() => setParsed(null)}>
                  Back
                </Button>
              </div>
            </>
          )}
          {error && <p className="font-semibold text-destructive">{error}</p>}
          {note && <p className="text-muted-foreground">{note}</p>}
        </div>
      )}
    </section>
  );
}
