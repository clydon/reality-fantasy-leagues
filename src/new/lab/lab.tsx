"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { LabOptions, LabRow, LabVerdict } from "@/lib/server/engine-lab";
import { NavLink } from "../nav";
import { paths } from "../routes";
import { useMe } from "../session";

// The engine lab (docs/PLAN-start-a-game-gpt.md step A5): plain on purpose, no design work, for trying the engine's pieces on a
// real season before the UI exists. Pick a season; pick a row of the capability tracker (its spec fills the box) or paste a
// spec; Check shows the validator's verdict on that season, the game in the engine's words and the row's status there; Start it
// as a test game puts it on your test couch or a zt- fixture's couch. Site admins only (/api/desk/lab refuses anyone else).

const PARTS: Record<LabRow["part"], string> = { dial: "The dials", example: "From a show's page", stretch: "Stretch requests", corpus: "The words corpus" };

async function call<T>(method: "GET" | "POST", body?: unknown): Promise<T> {
  const res = await fetch("/api/desk/lab", { method, headers: body ? { "content-type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
  const out = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(out.error || `HTTP ${res.status}`);
  return out as T;
}

/** A row's tag: its status as the tracker reads it (docs/ENGINE-CAPABILITIES.md), with its step while it waits. */
const needOf = (r: LabRow) => `${r.mark}${r.state === "step" && r.step ? ` ${r.step}` : ""}`;

export function EngineLab() {
  const me = useMe();
  const opts = useQuery({ queryKey: ["engine-lab"], queryFn: () => call<LabOptions>("GET"), enabled: me.isSuperAdmin });
  const [seasonId, setSeason] = useState("");
  const [rowId, setRow] = useState("");
  const [filter, setFilter] = useState("");
  const [text, setText] = useState("");
  const [verdict, setVerdict] = useState<LabVerdict | null>(null);
  const [couchId, setCouch] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [started, setStarted] = useState<{ name: string; seasonId: string } | null>(null);
  const o = opts.data;
  const rows = useMemo(() => {
    const f = filter.trim().toLowerCase();
    return (o?.rows ?? []).filter((r) => !f || `${r.id} ${r.what} ${r.page ?? ""} ${needOf(r)}`.toLowerCase().includes(f));
  }, [o, filter]);
  const row = o?.rows.find((r) => r.id === rowId) ?? null;

  if (!me.isSuperAdmin) return <Plain title="Engine lab">The engine lab is for site admins.</Plain>;

  const pick = (id: string) => {
    setRow(id);
    setVerdict(null);
    setStarted(null);
    // Its own spec, or an empty box (never the last row's: its status would be read with a spec that isn't its).
    const r = o?.rows.find((x) => x.id === id);
    setText(r?.spec ? JSON.stringify(r.spec, null, 2) : "");
  };
  const check = async () => {
    setBusy(true);
    setError(null);
    setStarted(null);
    try {
      setVerdict(await call<LabVerdict>("POST", { action: "check", seasonId, spec: text, row: rowId || undefined }));
    } catch (e) {
      setVerdict(null);
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const start = async () => {
    setBusy(true);
    setError(null);
    try {
      setStarted(await call<{ name: string; seasonId: string }>("POST", { action: "start", seasonId, couchId, spec: text }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const field = "w-full rounded-[3px] bg-card px-3 py-2 text-base outline-1 -outline-offset-1 outline-input";
  return (
    <Plain title="Engine lab">
      <p className="text-sm text-muted-foreground">
        Try the engine on a real season: pick a tracker row or paste a spec, check it, start it as a test game. The tracker&rsquo;s statuses are in docs/ENGINE-CAPABILITIES.md.
      </p>
      {opts.error && <p className="text-sm text-live">{(opts.error as Error).message}</p>}

      <label className="mt-4 block text-sm font-semibold" htmlFor="lab-season">
        Season
      </label>
      <select id="lab-season" data-lab-season value={seasonId} onChange={(e) => (setSeason(e.target.value), setVerdict(null))} className={`${field} mt-1 h-11`}>
        <option value="">Pick a season that&rsquo;s a game…</option>
        {(o?.seasons ?? []).map((s) => (
          <option key={s.seasonId} value={s.seasonId}>
            {s.label}
          </option>
        ))}
      </select>

      <label className="mt-4 block text-sm font-semibold" htmlFor="lab-row">
        A tracker row ({o?.rows.length ?? 0})
      </label>
      <input data-lab-filter value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter: an id, words, a step (A6)…" className={`${field} mt-1 h-11`} />
      <select id="lab-row" data-lab-row value={rowId} onChange={(e) => pick(e.target.value)} className={`${field} mt-2 h-11`}>
        <option value="">None: paste a spec</option>
        {(Object.keys(PARTS) as LabRow["part"][]).map((part) => (
          <optgroup key={part} label={PARTS[part]}>
            {rows
              .filter((r) => r.part === part)
              .map((r) => (
                <option key={r.id} value={r.id}>
                  [{needOf(r)}] {r.id} · {r.what.slice(0, 80)}
                </option>
              ))}
          </optgroup>
        ))}
      </select>
      {row && (
        <div data-lab-picked={row.id} className="mt-2 rounded-[3px] bg-card p-3 text-sm">
          <b className="block">{row.what}</b>
          {row.page && <span className="block text-muted-foreground">On the page of {row.page}</span>}
          <span className="block text-muted-foreground">
            In the tracker: {needOf(row)}
            {row.note ? ` · ${row.note}` : ""}
            {row.decide ? ` · ${row.decide}` : ""}
            {!row.spec ? " · no spec yet: paste one to try" : ""}
          </span>
        </div>
      )}

      <label className="mt-4 block text-sm font-semibold" htmlFor="lab-spec">
        The spec (JSON)
      </label>
      <textarea
        id="lab-spec"
        data-lab-spec
        value={text}
        onChange={(e) => (setText(e.target.value), setVerdict(null))}
        rows={12}
        spellCheck={false}
        placeholder='{ "preset": "weekly-lineup" }'
        className={`${field} mt-1 font-mono leading-snug`}
        style={{ fontSize: 16 }}
      />
      <button type="button" data-lab-check disabled={busy || !seasonId || !text.trim()} onClick={check} className="mt-3 h-11 w-full rounded-[3px] bg-foreground font-bold text-background disabled:opacity-50">
        {busy ? "Working…" : "Check it on this season"}
      </button>
      {error && (
        <p data-lab-error className="mt-3 text-sm text-live">
          {error}
        </p>
      )}

      {verdict && (
        <section data-lab-verdict={verdict.problems.length ? "problems" : verdict.waits.length ? "waits" : "plays"} className="mt-5 flex flex-col gap-3 text-sm">
          <h2 className="type-caption text-[20px]">
            {verdict.problems.length ? "Refused" : verdict.waits.length ? "Valid, but it waits" : `Plays now, as ${verdict.playsAs}`} · {verdict.label}
          </h2>
          {verdict.row && (
            <p data-lab-row-status={verdict.row.state}>
              Row {verdict.row.id} on this season: {verdict.row.mark} {verdict.row.state}
              {verdict.row.step ? ` (${verdict.row.step})` : ""}
            </p>
          )}
          {verdict.problems.length > 0 && <List title="What's wrong (specProblems, with this season's ctx)" items={verdict.problems.map((p) => `${p.at || "the spec"}: ${p.problem}`)} data="problems" />}
          {verdict.waits.length > 0 && <List title="What it waits for (specWaitsFor)" items={verdict.waits.map((w) => `${w.at || "the spec"}: ${w.problem}${w.step ? ` (${w.step})` : ""}`)} data="waits" />}
          {verdict.describe && (
            <>
              <p data-lab-sentence className="rounded-[3px] bg-card p-3 text-[15px] leading-snug">
                {verdict.describe.sentence}
              </p>
              <List title="How it works" items={verdict.describe.rules} data="rules" />
              <List title="The details nobody asked about" items={verdict.describe.details.map((d) => `${d.label}: ${d.value}${d.recommended ? " (recommended)" : ""}`)} data="details" />
            </>
          )}
          {verdict.startable && (
            <div className="rounded-[3px] bg-card p-3">
              <label className="block font-semibold" htmlFor="lab-couch">
                Start it as a test game on
              </label>
              {(o?.couches ?? []).length ? (
                <>
                  <select id="lab-couch" data-lab-couch value={couchId} onChange={(e) => setCouch(e.target.value)} className={`${field} mt-1 h-11 bg-background`}>
                    <option value="">Pick a couch…</option>
                    {(o?.couches ?? []).map((c) => (
                      <option key={c.couchId} value={c.couchId}>
                        {c.name} ({c.kind === "test" ? "your test couch" : "a zt- fixture"})
                      </option>
                    ))}
                  </select>
                  <button type="button" data-lab-start disabled={busy || !couchId} onClick={start} className="mt-2 h-11 w-full rounded-[3px] outline-1 -outline-offset-1 outline-input font-bold disabled:opacity-50">
                    Start it as a test game
                  </button>
                </>
              ) : (
                <p className="mt-1 text-muted-foreground">No test couch yet: make one in Settings › Test couch.</p>
              )}
            </div>
          )}
          {started && (
            <p data-lab-started className="rounded-[3px] bg-card p-3">
              Started {started.name}.{" "}
              <NavLink href={paths.show(started.seasonId, "games")} className="font-semibold underline underline-offset-2">
                Open its Games tab
              </NavLink>
            </p>
          )}
        </section>
      )}
    </Plain>
  );
}

function List({ title, items, data }: { title: string; items: string[]; data: string }) {
  if (!items.length) return null;
  return (
    <div data-lab-list={data}>
      <b className="block">{title}</b>
      <ul className="mt-1 list-disc pl-5 text-muted-foreground">
        {items.map((t, i) => (
          <li key={i}>{t}</li>
        ))}
      </ul>
    </div>
  );
}

/** A plain page: a back link to the desk and a title. */
function Plain({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="px-4 pb-16 pt-4" data-engine-lab>
      <NavLink href={paths.desk()} className="text-sm font-semibold text-muted-foreground">
        ‹ The desk
      </NavLink>
      <h1 className="type-caption mt-2 text-[26px]">{title}</h1>
      <div className="mt-2">{children}</div>
    </div>
  );
}
