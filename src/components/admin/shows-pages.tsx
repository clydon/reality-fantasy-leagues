"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, ScrollText, Settings2 } from "lucide-react";
import type { AdminShow, ShowSeason } from "@/lib/game/types";
import { api } from "@/lib/api";
import { confirm } from "@/lib/confirm-store";
import { plural } from "@/lib/use-show-terms";
import { STATUS_LABEL } from "@/lib/admin-season";
import { BottomSheet, SheetAction } from "@/components/ui/bottom-sheet";
import { Field, MoreOptions, PrimaryButton, fieldCls } from "@/components/setup/settings-ui";
import { PlainButton } from "@/components/draft/draft-ui";
import { ActButton, AdminPage, Notice, Row, Rows, Section, count, errorText, seasonName, useAdminShows } from "./admin-ui";
import { DangerZone } from "./season-setup";
import { cn } from "cn";

// Shows and seasons (docs/PLAN-ux-redesign.md 3b): a list of shows, then a page per show listing its
// seasons, each of which opens to its own page. Everything set once about a show -- what it calls
// people and groups, its rules, the wiki connector's settings -- is on its Settings page, with Delete in
// a Danger zone rather than beside Archive.

/** Where a season stands, in a few words, for its row: the next thing it needs, or how far it's got. */
function seasonState(s: ShowSeason): { text: string; waiting: boolean } {
  const staged = s.castStaged ?? 0;
  const pending = s.pendingDecisions ?? 0;
  if (pending > 0) return { text: `${count(pending, "result")} to review`, waiting: true };
  if (staged > 0 && !s.castApprovedAt) return { text: "Cast to approve", waiting: true };
  if (!staged && s.resultsBy !== "leagues") return { text: s.wikiPageTitle ? "No cast yet" : "No wiki page yet", waiting: false };
  if (s.wikiEpisodesThrough) return { text: `Results through episode ${s.wikiEpisodesThrough}`, waiting: false };
  return { text: s.resultsBy === "leagues" ? "Leagues decide results" : "Cast approved", waiting: false };
}

export function ShowsPage() {
  const { data, isLoading } = useAdminShows();
  const shows = data?.shows ?? [];
  // Shows with nothing in them (an abandoned test, an archived one) take a line each further down,
  // not the same room as Survivor.
  const live = shows.filter((s) => !s.archived && (s.seasons.length > 0 || s.league_count > 0));
  const rest = shows.filter((s) => !live.includes(s));
  const formatName = (id: string) => data?.formatOptions.find((o) => o.id === id)?.name ?? id;

  const showRow = (show: AdminShow) => {
    const waiting = show.seasons.some((s) => seasonState(s).waiting);
    return (
      <Row
        key={show.id}
        href={`/admin/shows/${show.id}`}
        dim={show.archived}
        title={
          <>
            {show.name}
            {waiting && <span className="size-2 rounded-full bg-chyron-line" aria-label="Needs you" />}
          </>
        }
        detail={[count(show.seasons.length, "season"), count(show.league_count, "league"), `${formatName(show.format)} rules`, show.archived && "archived"].filter(Boolean).join(" · ")}
      />
    );
  };

  return (
    <AdminPage title="Shows" subtitle={data ? `${count(shows.length, "show")} · ${count(shows.reduce((n, s) => n + s.league_count, 0), "league")}` : undefined}>
      <ActButton tone="chyron" href="/admin/shows/new" className="min-h-12 self-start">
        <Plus className="size-5" strokeWidth={2.4} aria-hidden />
        New show
      </ActButton>
      {isLoading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : (
        <>
          <Rows>
            {live.map(showRow)}
            {live.length === 0 && <p className="py-4 text-muted-foreground">No shows yet. Add one to start.</p>}
          </Rows>
          {rest.length > 0 && <MoreOptions label={`Archived and empty (${rest.length})`}>{<Rows>{rest.map(showRow)}</Rows>}</MoreOptions>}
        </>
      )}
      <Rows>
        <Row icon={ScrollText} href="/admin/formats" title="Formats & rules" detail="The rules each show plays by: built in, or researched" />
      </Rows>
    </AdminPage>
  );
}

export function ShowPage({ showId }: { showId: string }) {
  const router = useRouter();
  const { data, isLoading, refetch } = useAdminShows();
  const [menu, setMenu] = useState(false);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const show = data?.shows.find((s) => s.id === showId);
  if (isLoading) return <p className="text-muted-foreground">Loading…</p>;
  if (!show) {
    return (
      <AdminPage title="Show" back={{ href: "/admin/shows", label: "Shows" }}>
        <p className="text-muted-foreground">That show doesn&rsquo;t exist any more.</p>
      </AdminPage>
    );
  }
  const formatName = data?.formatOptions.find((o) => o.id === show.format)?.name ?? show.format;
  const seasons = [...show.seasons].sort((a, b) => b.seasonNumber - a.seasonNumber);

  async function run(fn: () => Promise<unknown>, done: string) {
    setMenu(false);
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      await fn();
      setNote(done);
      await refetch();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminPage
      title={show.name}
      subtitle={[`${formatName} rules`, count(show.league_count, "league"), show.archived && "archived"].filter(Boolean).join(" · ")}
      back={{ href: "/admin/shows", label: "Shows" }}
      actions={{ label: "Show actions", onClick: () => setMenu(true) }}
    >
      {error && <Notice tone="bad">{error}</Notice>}
      {note && <Notice>{note}</Notice>}
      <Section
        title="Seasons"
        aside={
          <ActButton onClick={() => setAdding(true)} disabled={busy}>
            <Plus className="size-[18px]" strokeWidth={2.4} aria-hidden />
            Add
          </ActButton>
        }
      >
        {seasons.length === 0 ? (
          <p className="text-muted-foreground">No seasons yet. Add one to start pulling its cast.</p>
        ) : (
          <Rows>
            {seasons.map((s) => {
              const state = seasonState(s);
              return (
                <Row
                  key={s.id}
                  href={`/admin/seasons/${s.id}`}
                  lead={<span className="type-num w-10 shrink-0 text-center text-[28px] text-muted-foreground">{s.seasonNumber}</span>}
                  title={
                    <>
                      {seasonName(s)}
                      {state.waiting && <span className="size-2 rounded-full bg-chyron-line" aria-label="Needs you" />}
                    </>
                  }
                  detail={`${STATUS_LABEL[s.status]} · ${state.text}`}
                />
              );
            })}
          </Rows>
        )}
      </Section>
      <Rows>
        <Row
          icon={Settings2}
          href={`/admin/shows/${show.id}/settings`}
          title="Show settings"
          detail={`${plural(show.castaway_term)} and ${plural(show.tribe_term).toLowerCase()} · rules · wiki connector`}
        />
      </Rows>

      {adding && (
        <AddSeasonSheet
          show={show}
          onClose={() => setAdding(false)}
          onAdded={(n) => {
            setAdding(false);
            setNote(`Added season ${n}. Next: pull its cast.`);
            refetch();
          }}
        />
      )}

      <BottomSheet open={menu} onOpenChange={setMenu} title={show.name}>
        <SheetAction onClick={() => router.push(`/admin/shows/${show.id}/settings`)}>Settings</SheetAction>
        <SheetAction
          onClick={() =>
            run(
              () => api.adminUpdateShow(show.id, { archived: !show.archived }),
              show.archived ? `Restored ${show.name}.` : `Archived ${show.name}: hidden from the show picker. Its leagues keep working.`,
            )
          }
          detail={show.archived ? undefined : "Hide from the show picker"}
        >
          {show.archived ? "Restore show" : "Archive show"}
        </SheetAction>
        <SheetAction danger onClick={() => deleteShow(show, router.push, () => setMenu(false))}>
          Delete show
        </SheetAction>
      </BottomSheet>
    </AdminPage>
  );
}

async function deleteShow(show: AdminShow, go: (href: string) => void, before: () => void) {
  before();
  const ok = await confirm(
    `Delete ${show.name} and all ${count(show.seasons.length, "season")}? This can't be undone.${show.league_count ? ` ${count(show.league_count, "league")} play it.` : ""}`,
    { danger: true, confirmLabel: "Delete show" },
  );
  if (!ok) return;
  await api.adminDeleteShow(show.id);
  go("/admin/shows");
}

function AddSeasonSheet({ show, onClose, onAdded }: { show: AdminShow; onClose: () => void; onAdded: (n: number) => void }) {
  const next = Math.max(0, ...show.seasons.map((s) => s.seasonNumber)) + 1;
  const [number, setNumber] = useState(String(next));
  const [wikiUrl, setWikiUrl] = useState("");
  const [status, setStatus] = useState("airing");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const n = parseInt(number);
  async function add() {
    if (!Number.isInteger(n) || n < 1) return;
    setBusy(true);
    setError(null);
    try {
      await api.adminCreateSeason(show.id, { seasonNumber: n, wikiUrl: wikiUrl.trim() || undefined, status });
      onAdded(n);
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  }
  return (
    <BottomSheet open onOpenChange={(o) => !o && onClose()} title="Add a season" description={show.name}>
      <form
        className="flex flex-col gap-4 border-t border-border pt-4"
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <div className="flex gap-3">
          <Field label="Season" htmlFor="new-season-n">
            <input id="new-season-n" type="number" min={1} inputMode="numeric" className={cn(fieldCls, "w-[110px]")} value={number} onChange={(e) => setNumber(e.target.value)} />
          </Field>
          <div className="min-w-0 flex-1">
            <Field label="Status" htmlFor="new-season-status">
              <select id="new-season-status" className={fieldCls} value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="upcoming">Upcoming</option>
                <option value="airing">Airing</option>
                <option value="completed">Completed</option>
              </select>
            </Field>
          </div>
        </div>
        <Field label="Wiki page" htmlFor="new-season-wiki" hint="Paste it from your browser. The connector reads the cast and results from it.">
          <input id="new-season-wiki" type="url" className={fieldCls} placeholder="https://…" value={wikiUrl} onChange={(e) => setWikiUrl(e.target.value)} />
        </Field>
        {error && <Notice tone="bad">{error}</Notice>}
        <PrimaryButton type="submit" disabled={busy || !Number.isInteger(n) || n < 1}>
          Add season {Number.isInteger(n) && n > 0 ? n : ""}
        </PrimaryButton>
      </form>
    </BottomSheet>
  );
}

// Set-once show configuration. Editable -- terminology is what the whole app says AND what the connector
// uses to find the cast section, and a mistake shouldn't mean recreating the show and orphaning its
// leagues -- but not something anyone looks at week to week.
export function ShowSettingsPage({ showId }: { showId: string }) {
  const router = useRouter();
  const { data, isLoading, refetch } = useAdminShows();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const show = data?.shows.find((s) => s.id === showId);
  if (isLoading) return <p className="text-muted-foreground">Loading…</p>;
  if (!show || !data) return <p className="text-muted-foreground">That show doesn&rsquo;t exist any more.</p>;
  const options = data.formatOptions;
  const nameOf = (id: string) => options.find((o) => o.id === id)?.name ?? id;

  async function save(changes: Parameters<typeof api.adminUpdateShow>[1], done = "Saved.") {
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      await api.adminUpdateShow(show!.id, changes);
      setNote(done);
      await refetch();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  const blur =
    (key: keyof Parameters<typeof api.adminUpdateShow>[1], current: string | null | undefined, required = false) =>
    (e: React.FocusEvent<HTMLInputElement>) => {
      const v = e.target.value.trim();
      if (required && !v) return;
      if (v !== (current ?? "")) save({ [key]: v });
    };

  return (
    <AdminPage title="Show settings" subtitle={show.name} back={{ href: `/admin/shows/${show.id}`, label: show.name }}>
      {error && <Notice tone="bad">{error}</Notice>}
      {note && <Notice>{note}</Notice>}

      <Section title="Basics">
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-2 gap-3">
            <Field label="People are called" htmlFor="show-castaway">
              <input id="show-castaway" className={fieldCls} defaultValue={show.castaway_term} disabled={busy} onBlur={blur("castawayTerm", show.castaway_term, true)} />
            </Field>
            <Field label="Groups are called" htmlFor="show-tribe">
              <input id="show-tribe" className={fieldCls} defaultValue={show.tribe_term} disabled={busy} onBlur={blur("tribeTerm", show.tribe_term, true)} />
            </Field>
          </div>
          <p className="-mt-3 text-[13px] leading-snug text-muted-foreground">What the whole app calls them, and how the connector finds the cast on the wiki.</p>
          <Field label="Rules" htmlFor="show-format" hint="How people leave, what scores, and what the wiki and research look for.">
            <span className="flex gap-2">
              <select
                id="show-format"
                className={cn(fieldCls, "min-w-0 flex-1")}
                value={show.format}
                disabled={busy}
                onChange={async (e) => {
                  const next = e.target.value;
                  // Switching changes the exit methods and scoring events every league on the show uses
                  // from here on. Results already recorded keep their old wording, so say so first.
                  if (
                    show.league_count > 0 &&
                    !(await confirm(
                      `Switch ${show.name} to ${nameOf(next)} rules? Its ${count(show.league_count, "league")} switch too. Results already recorded keep their current wording.`,
                      { confirmLabel: "Switch" },
                    ))
                  )
                    return;
                  save({ format: next }, `${show.name} now plays by ${nameOf(next)} rules.`);
                }}
              >
                {options.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
              <ActButton href={`/admin/formats/${encodeURIComponent(show.format)}`} className="min-h-12">
                View
              </ActButton>
            </span>
          </Field>
        </div>
      </Section>

      {/* Normally worked out on their own -- the endpoint from the first season's URL, the heading from the
          term above -- so they're only here for the wiki that doesn't fit. */}
      <MoreOptions label="Connector and art">
        <div className="flex flex-col gap-5">
          <Field label="Wiki API" htmlFor="show-api" hint="Blank works it out from the first season's wiki page.">
            <input id="show-api" className={fieldCls} placeholder="Automatic" defaultValue={show.wiki_api_url ?? ""} disabled={busy} onBlur={blur("wikiApiUrl", show.wiki_api_url)} />
          </Field>
          <Field label="Cast section heading" htmlFor="show-heading" hint={`Blank looks for "${plural(show.castaway_term)}".`}>
            <input id="show-heading" className={fieldCls} placeholder="Automatic" defaultValue={show.cast_section_heading ?? ""} disabled={busy} onBlur={blur("castSectionHeading", show.cast_section_heading)} />
          </Field>
          <Field label="Research sites" htmlFor="show-sites" hint="Web research only searches these. Fewer, trusted sites give better answers for fewer tokens. Blank: the wiki plus a couple of recap sites.">
            <input
              id="show-sites"
              className={fieldCls}
              placeholder="Default"
              defaultValue={(show.research_domains ?? []).join(", ")}
              disabled={busy}
              onBlur={blur("researchDomains", (show.research_domains ?? []).join(", "))}
            />
          </Field>
          <Field label="Art" htmlFor="show-art" hint="The show's tile in New league. A link, or a path to a file in public/show-art/. Blank shows its name.">
            <input id="show-art" className={fieldCls} placeholder="None" defaultValue={show.art_url ?? ""} disabled={busy} onBlur={blur("artUrl", show.art_url)} />
          </Field>
        </div>
      </MoreOptions>

      <DangerZone>
        <PlainButton
          disabled={busy}
          onClick={() => save({ archived: !show.archived }, show.archived ? `Restored ${show.name}.` : `Archived ${show.name}: hidden from the show picker. Its leagues keep working.`)}
          className="self-start"
        >
          {show.archived ? "Restore show" : "Archive show"}
        </PlainButton>
        <PlainButton danger disabled={busy} onClick={() => deleteShow(show, router.push, () => {})} className="self-start">
          Delete show
        </PlainButton>
        <p className="text-[13px] leading-snug text-muted-foreground">Archiving hides it from the show picker and keeps its leagues working. Deleting removes it and every season.</p>
      </DangerZone>
    </AdminPage>
  );
}
