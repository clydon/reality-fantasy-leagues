"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CopyPlus, FlaskConical, Trash2, Undo2 } from "lucide-react";
import { api } from "@/lib/api";
import type { TestCouch, TestPlayer } from "@/lib/server/test-couch";
import { paths } from "../routes";
import { useMe } from "../session";
import { Avatar } from "../ui/bars";
import { HoldSheet } from "../ui/guards";
import { Btn, Row, SectionHead } from "../ui/parts";
import { toast } from "../ui/toast";
import { Choice } from "./controls";

// A site admin's test couch (src/lib/server/test-couch.ts; docs/PLAN-researched-survivor.md): temporary tooling. The profile
// menu's switches into its test players and back (TestSwitches), and Settings' Test couch section, where it's made from one of
// your couches' seasons, its rules picked, the real games' moves copied again, and removed (TestCouchSection).

export type { TestCouch, TestPlayer };

const KEY = ["new-design", "test-couch"] as const;
type ShadowRules = NonNullable<TestCouch["couch"]>["rules"];

async function call(method: string, body?: unknown): Promise<TestCouch | null> {
  const res = await fetch("/api/test-couch", body === undefined ? { method } : { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const out = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(out.error || `Request failed (${res.status})`), { status: res.status });
  return out as TestCouch | null;
}

/** The test couch, for a site admin or while viewing as one of their test players (null otherwise). Every 10 seconds while
 *  our bot researches its rules. */
export function useTestCouch(enabled = true) {
  const me = useMe();
  return useQuery({
    queryKey: KEY,
    queryFn: () => call("GET"),
    enabled: enabled && (me.isSuperAdmin || me.impersonating),
    staleTime: 30_000,
    retry: false,
    refetchInterval: (q) => (q.state.data?.couch?.researching ? 10_000 : false),
  });
}

/** Into a test player (from you, or from another of them), or back to you (null). A full reload: their session, their home. */
export async function switchTo(userId: string | null, viewingAs: boolean) {
  if (viewingAs) await api.stopImpersonating();
  if (userId) await api.adminImpersonate(userId);
  window.location.href = paths.home;
}

const ROLE: Record<TestPlayer["role"], string> = { commissioner: "Runs the games", admin: "Game admin", member: "Plays" };

/** One test player to switch into: their face, who they stand in for, and Now on the one you're viewing as. */
function PlayerRow({ p, busy, onPick }: { p: TestPlayer; busy: boolean; onPick: () => void }) {
  return (
    <button
      type="button"
      data-test-player={p.username}
      aria-current={p.current || undefined}
      disabled={p.current || busy}
      onClick={onPick}
      className="nd-press flex min-h-[56px] w-full items-center gap-3 border-t border-border py-1.5 text-left first:border-t-0 disabled:opacity-100"
    >
      <Avatar id={p.userId} name={p.name} size={36} />
      <span className="min-w-0 flex-1">
        <b className="block truncate text-[15px] font-semibold">{p.name}</b>
        <small className="block truncate text-[12.5px] text-muted-foreground">
          For {p.standsFor} · {ROLE[p.role]}
        </small>
      </span>
      {p.current ? (
        <em className="type-caption flex-none rounded-[2px] bg-foreground px-1.5 text-[11px] not-italic text-background">Now</em>
      ) : (
        <span className="flex-none text-[13px] font-semibold text-muted-foreground">{busy ? "…" : "Switch"}</span>
      )}
    </button>
  );
}

/** The profile menu's switches: each test player, and Back to me while viewing as one. Nothing without a test couch. */
export function TestSwitches({ open }: { open: boolean }) {
  const { data } = useTestCouch(open);
  const [busy, setBusy] = useState<string | null>(null);
  if (!data?.couch || !data.players.length) return null;
  const go = async (userId: string | null) => {
    setBusy(userId ?? "me");
    try {
      await switchTo(userId, data.viewingAs);
    } catch (e) {
      setBusy(null);
      toast.quiet((e as Error).message || "Couldn't switch. Try again.");
    }
  };
  return (
    <div data-test-switches className="mt-3.5 rounded-[3px] bg-card px-3 pb-1 pt-2.5">
      <p className="type-caption flex items-baseline justify-between gap-2 text-xs tracking-[0.06em] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <FlaskConical className="size-3.5" aria-hidden />
          Test players
        </span>
        <span className="truncate normal-case tracking-normal">{data.couch.name}</span>
      </p>
      <div className="mt-1 flex flex-col">
        {data.players.map((p) => (
          <PlayerRow key={p.userId} p={p} busy={!!busy} onPick={() => go(p.userId)} />
        ))}
        {data.viewingAs && (
          <button
            type="button"
            data-test-back
            disabled={!!busy}
            onClick={() => go(null)}
            className="nd-press flex min-h-[56px] w-full items-center gap-3 border-t border-border py-1.5 text-left"
          >
            <span className="grid size-9 flex-none place-items-center rounded-full bg-foreground text-background">
              <Undo2 className="size-[18px]" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <b className="block text-[15px] font-semibold">{busy === "me" ? "Back to you…" : "Back to me"}</b>
              <small className="block text-[12.5px] text-muted-foreground">Your own account and couches</small>
            </span>
          </button>
        )}
      </div>
    </div>
  );
}

const RULES: { id: ShadowRules; title: string; line: string }[] = [
  { id: "template", title: "Today's rules, as a rulebook", line: "The show's built-in rules compiled as a rulebook: every result scores as it does now. The switch's first step" },
  { id: "same", title: "The real games' own", line: "Exactly what the real games play by: everything matches" },
  { id: "fresh", title: "Today's rules, fresh ids", line: "The same rules compiled as research compiles them: new ids, so you see what a switch breaks" },
  { id: "researched", title: "Researched by our bot", line: "ChatGPT reads the season and writes the rules, as a show added today gets them. A few minutes" },
];

/** Settings' Test couch section (site admins, as themselves). */
export function TestCouchSection() {
  const me = useMe();
  const { data } = useTestCouch(me.isSuperAdmin && !me.impersonating);
  const client = useQueryClient();
  const [pick, setPick] = useState<string | null>(null);
  const [rules, setRules] = useState<ShadowRules>("template");
  const [busy, setBusy] = useState<string | null>(null);
  const [sheet, setSheet] = useState<"copy" | "remove" | null>(null);
  if (!me.isSuperAdmin || me.impersonating || !data) return null;
  const t = data.couch;
  const adopt = (next: TestCouch | null) => client.setQueryData(KEY, next);
  const send = async (what: string, method: string, body?: unknown, said?: string) => {
    setBusy(what);
    try {
      adopt(await call(method, body));
      if (said) toast(said);
    } catch (e) {
      toast.quiet((e as Error).message);
    } finally {
      setBusy(null);
    }
  };
  const source = data.sources.find((s) => `${s.couchId}/${s.seasonId}` === pick) ?? (data.sources.length === 1 ? data.sources[0] : null);

  return (
    <section className="mt-8" data-settings-test-couch>
      <SectionHead title="Test couch" aside="Site admins" />
      {!t ? (
        <div className="px-4">
          <p className="rounded-[3px] bg-card p-3 text-[14px] leading-snug">
            A copy of one of your couches&apos; games, every move and result as they are, played by test players: one for each person, named after them, yours running the games.
            Switch into them from your profile to do what they did. Results reach it as they reach the real games.
          </p>
          {data.sources.length ? (
            <>
              <p className="type-caption mb-1 mt-4 text-xs tracking-[0.06em] text-muted-foreground">Copy</p>
              <div role="radiogroup" aria-label="Which games to copy">
                {data.sources.map((s) => {
                  const key = `${s.couchId}/${s.seasonId}`;
                  return (
                    <Choice key={key} data={key} on={source === s} title={s.label} line={`${s.games} ${s.games === 1 ? "game" : "games"}`} onPick={() => setPick(key)} />
                  );
                })}
              </div>
              <p className="type-caption mb-1 mt-4 text-xs tracking-[0.06em] text-muted-foreground">Rules</p>
              <div role="radiogroup" aria-label="What its games play by">
                {RULES.map((r) => (
                  <Choice key={r.id} data={`rules-${r.id}`} on={rules === r.id} title={r.title} line={r.line} recommended={r.id === "template"} onPick={() => setRules(r.id)} />
                ))}
              </div>
              <Btn
                wide
                tone="ink"
                data-make-test-couch
                className="mt-4"
                disabled={!source || !!busy}
                onClick={() => source && send("make", "POST", { couchId: source.couchId, seasonId: source.seasonId, rules }, "Test couch made: switch into its players from your profile")}
              >
                {busy === "make" ? "Copying the games…" : "Make the test couch"}
              </Btn>
            </>
          ) : (
            <p className="mt-3 text-[13px] text-muted-foreground">None of your couches has games on a season to copy.</p>
          )}
        </div>
      ) : (
        <div className="px-4" data-test-couch={t.name}>
          <div className="rounded-[3px] bg-card p-3">
            <b className="block text-[17px] font-semibold">{t.name}</b>
            <small className="mt-0.5 block text-[13px] leading-snug text-muted-foreground">
              Copied from {t.from} · {t.games.map((g) => g.name).join(", ")}
            </small>
            <div className="mt-2 flex flex-col">
              {data.players.map((p) => (
                <PlayerRow key={p.userId} p={p} busy={!!busy} onPick={() => (setBusy(p.userId), switchTo(p.userId, false).catch((e) => (setBusy(null), toast.quiet((e as Error).message))))} />
              ))}
            </div>
          </div>
          <p className="type-caption mb-1 mt-4 text-xs tracking-[0.06em] text-muted-foreground">Its games play by</p>
          {t.researching && (
            <p data-test-researching className="mb-1 rounded-[3px] bg-secondary p-2.5 text-[13px] leading-snug">
              Our bot is researching the rules. The games switch to them when they&apos;re in.
            </p>
          )}
          {t.message && <p className="mb-1 rounded-[3px] bg-secondary p-2.5 text-[13px] leading-snug text-live">{t.message}</p>}
          <div role="radiogroup" aria-label="What its games play by">
            {RULES.map((r) => (
              <Choice
                key={r.id}
                data={`rules-${r.id}`}
                on={t.rules === r.id}
                title={r.title}
                line={r.line}
                recommended={r.id === "template"}
                onPick={() => !busy && !t.researching && send("rules", "PATCH", { rules: r.id }, r.id === "researched" ? undefined : `Its games play by ${r.title.toLowerCase()}`)}
              />
            ))}
          </div>
          <div className="mt-3 flex flex-col">
            <Row icon={CopyPlus} title="Copy the real games again" detail="Their latest moves and results, over what was done as test players" onClick={() => setSheet("copy")} />
            <Row icon={Trash2} title="Remove the test couch" detail="Its games and test players go. The real games aren't touched" onClick={() => setSheet("remove")} />
          </div>
        </div>
      )}
      <HoldSheet
        open={sheet === "copy"}
        onOpenChange={(o) => !o && setSheet(null)}
        title="Copy the real games again?"
        consequence="Every test game becomes its real game as it is now: what was done as the test players goes. The rules stay."
        cta="copy them again"
        onConfirm={async () => {
          adopt(await call("PATCH", { copy: true }));
          setSheet(null);
          toast("Copied again");
        }}
      />
      <HoldSheet
        open={sheet === "remove"}
        onOpenChange={(o) => !o && setSheet(null)}
        title="Remove the test couch?"
        consequence="Its games and its test players go for good. The real games aren't touched. You can make another any time."
        cta="remove it"
        onConfirm={async () => {
          adopt(await call("DELETE"));
          setSheet(null);
          toast("Test couch removed");
        }}
      />
    </section>
  );
}
