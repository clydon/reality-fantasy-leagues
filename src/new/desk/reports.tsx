"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { keepPreviousData, useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { Search, Trophy, Tv, Users } from "lucide-react";
import { colourOf } from "@/lib/people";
import { NavLink, useNav } from "../nav";
import { paths } from "../routes";
import { Avatar } from "../ui/bars";
import { HoldSheet } from "../ui/guards";
import { Btn, EmptyState } from "../ui/parts";
import { toast } from "../ui/toast";
import { deskGet, deskSend, useAfterDesk, useDesk, type DeskReport, type ReportFilter, type ReportRow, type ReportsList } from "./data";
import { agoOf, DeleteRow, DeskHeader, DeskRow, IconLead, LatestHistory, LowerThird, Section, useChangeToast } from "./parts";
import { useDebounced } from "./people";
import { forgetDeskPage } from "./trail";

// Reports on the desk (docs/PLAN-desk-parity.md step 2; the mock's desk.js DK_LIST.reports and desk-pages.js dkReportPage):
// Find › Reports, a list like People's (what it says or who sent it; Open · Done; newest first; 25 at a time, the search
// and filter in the address), and a report's page: their words, where it was sent from, Mark done (tier 1, Undo) or Reopen,
// Act as the sender, From (the sender and the game, season or couch it came from), History, and Delete this report, last
// (tier 3, a hold: gone for good, Mark it done offered instead). Server: src/lib/server/desk-reports.ts.

const FILTERS: [ReportFilter, string][] = [
  ["open", "Open"],
  ["done", "Done"],
];

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const TAG = "type-caption ml-1.5 inline-block rounded-[2px] px-1.5 pb-0.5 pt-[3px] align-[2px] text-[11px] not-italic leading-none tracking-[0.06em]";

/** One report in a list (and in Find's search, `found`): who sent it, its title, Open, and what it's about. */
export function ReportListRow({ r, found }: { r: ReportRow; found?: boolean }) {
  return (
    <NavLink href={paths.deskItem("report", r.id)} data-report-row={r.title} data-desk-item={found ? "report" : undefined} className="nd-press flex min-h-[66px] items-center gap-3 border-t border-border py-2.5">
      <Avatar id={r.who.id ?? `gone-${r.who.name}`} name={r.who.name} size={40} colour={colourOf(r.who.id ?? r.who.name, r.who.colour)} />
      <span className="min-w-0 flex-1">
        <b className="line-clamp-2 block text-[16px] font-semibold leading-snug [overflow-wrap:anywhere]">
          {r.title}
          {!r.done && <i className={`${TAG} text-foreground outline-1 -outline-offset-1 outline-foreground`}>Open</i>}
        </b>
        <small className="mt-[3px] block truncate text-[13px] leading-snug text-muted-foreground">
          {found ? "Report · " : ""}From {r.who.name} · {r.about} · {agoOf(r.at)}
        </small>
      </span>
    </NavLink>
  );
}

/** Find › Reports: open or done, searched, newest first, 25 at a time. */
export function ReportsPage() {
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [f, setF] = useState<ReportFilter>(params.get("f") === "done" ? "done" : "open");
  const term = useDebounced(q.trim(), 200);
  // The list as it is, in the address: Back from a report comes back to it.
  useEffect(() => {
    const href = paths.deskReports({ q: term, f: f === "open" ? "" : f });
    if (href !== `${window.location.pathname}${window.location.search}`) window.history.replaceState(null, "", href);
  }, [term, f]);
  const list = useInfiniteQuery({
    queryKey: ["new-design", "desk", "reports", term, f],
    queryFn: ({ pageParam }) => deskGet<ReportsList>(`/reports?${new URLSearchParams({ q: term, f, offset: String(pageParam) })}`),
    initialPageParam: 0,
    getNextPageParam: (last, all) => {
      const n = all.reduce((a, p) => a + p.reports.length, 0);
      return n < last.total ? n : undefined;
    },
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  });
  const pages = list.data?.pages ?? [];
  const reports = [...new Map(pages.flatMap((p) => p.reports).map((r) => [r.id, r])).values()];
  const total = pages[0]?.total ?? 0;
  const counts = pages[0]?.counts;
  const left = Math.max(0, total - pages.reduce((n, p) => n + p.reports.length, 0));
  return (
    <div className="pb-16" data-desk-reports>
      <DeskHeader title="Reports" back={{ label: "Find", href: paths.desk("find") }} />
      <Section className="mt-4">
        <label className="flex h-12 items-center gap-2 rounded-[3px] bg-card px-3 outline-1 -outline-offset-1 outline-input focus-within:outline-2 focus-within:outline-chyron">
          <Search className="size-5 flex-none text-muted-foreground" aria-hidden />
          <input
            data-reports-search
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="What it says, or who sent it"
            aria-label="Find a report by what it says or who sent it"
            autoComplete="off"
            spellCheck={false}
            className="h-full min-w-0 flex-1 bg-transparent text-base outline-none"
          />
        </label>
        <div className="mt-2.5 flex flex-wrap gap-1.5" role="group" aria-label="Show">
          {FILTERS.map(([k, label]) => (
            <button
              key={k}
              type="button"
              data-reports-filter={k}
              aria-pressed={f === k}
              onClick={() => setF(k)}
              className={`inline-flex h-11 items-center gap-1.5 rounded-[2px] px-3.5 text-[15px] font-semibold transition-colors ${f === k ? "bg-foreground text-background" : "bg-secondary"}`}
            >
              {label}
              <span className={`type-num text-[15px] ${f === k ? "" : "text-muted-foreground"}`}>{counts ? counts[k] : ""}</span>
            </button>
          ))}
        </div>
        <div className="mt-1 flex min-h-11 items-center text-[13px] text-muted-foreground">
          <span data-reports-count>{list.data ? plural(total, "report", "reports") : ""}</span>
        </div>
        {!list.data ? (
          <div aria-busy className="mt-1 h-64 animate-pulse rounded-[4px] bg-card" />
        ) : reports.length ? (
          <div data-reports-list className="border-b border-border">
            {reports.map((r) => (
              <ReportListRow key={r.id} r={r} />
            ))}
          </div>
        ) : (
          <div data-reports-empty className="mt-1.5 flex flex-col items-center gap-2 rounded-[4px] bg-card px-4 py-8 text-center">
            {term ? (
              <>
                <b className="type-caption text-[22px]">Nothing matches &ldquo;{term}&rdquo;</b>
                <small className="max-w-[290px] text-[14px] leading-snug text-muted-foreground">Search looks at what a report says and who sent it, among the {f} ones.</small>
                <button type="button" data-reports-other onClick={() => setF(f === "open" ? "done" : "open")} className="text-[14px] font-bold underline decoration-input underline-offset-[3px]">
                  Search {f === "open" ? "done" : "open"} reports
                </button>
              </>
            ) : (
              <b className="type-caption text-[22px]">{f === "open" ? "Nothing open" : "Nothing done yet"}</b>
            )}
          </div>
        )}
        {left > 0 && (
          <button
            type="button"
            data-reports-more
            disabled={list.isFetchingNextPage}
            onClick={() => list.fetchNextPage()}
            className="nd-press mt-3.5 flex h-12 w-full items-center justify-center gap-1.5 rounded-[3px] bg-card text-[14px] font-bold outline-1 -outline-offset-1 outline-input"
          >
            Show {Math.min(25, left)} more <span className="font-normal text-muted-foreground">· {left} left</span>
          </button>
        )}
      </Section>
    </div>
  );
}

/**
 * A report (the mock's dkReportPage): who sent it as a lower third, their words, where it was sent from, Mark done or
 * Reopen and Act as them, From (the sender, and the game, season or couch it came from, each a link), History, and Delete
 * this report, last.
 */
export function ReportPage({ id }: { id: string }) {
  const q = useDesk<DeskReport>(`/reports/${id}`);
  const after = useAfterDesk();
  const said = useChangeToast();
  const nav = useNav();
  const client = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const back = { label: "Reports", href: paths.deskReports() };
  if (q.error)
    return (
      <>
        <DeskHeader title="Report" back={back} name={null} />
        <EmptyState title="Not here" line={(q.error as Error).message} />
      </>
    );
  if (!q.data)
    return (
      <>
        <DeskHeader title="Report" back={back} name={null} />
        <div aria-busy className="mx-4 mt-6 h-64 animate-pulse rounded-[4px] bg-card" />
      </>
    );
  const r = q.data;
  const who = r.who.name;
  const mark = async (done: boolean) => {
    setBusy(true);
    try {
      const out = await deskSend<{ changeId: string; text: string }>(`/reports/${r.id}`, { done });
      await after();
      said(out.text, out.changeId);
    } catch (e) {
      toast.quiet((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const where = r.game ? (
    r.game.couch ? (
      <DeskRow href={paths.deskItem("couch", r.game.couch.id)} data="report-game" lead={<IconLead icon={Trophy} />} title={r.game.name} line={[r.game.season, r.game.couch.name, r.game.deleted ? "deleted" : null].filter(Boolean).join(" · ")} />
    ) : (
      <DeskRow data="report-game" lead={<IconLead icon={Trophy} />} title={r.game.name} line={[r.game.season, "on no couch", r.game.deleted ? "deleted" : null].filter(Boolean).join(" · ")} />
    )
  ) : r.season ? (
    <DeskRow href={paths.deskItem("season", r.season.id)} data="report-season" lead={<IconLead icon={Tv} />} title={r.season.name} line={r.season.screen ? `The ${r.season.screen} tab` : "The show"} />
  ) : r.couch ? (
    <DeskRow href={paths.deskItem("couch", r.couch.id)} data="report-couch" lead={<IconLead icon={Users} />} title={r.couch.name} line="Their couch" />
  ) : null;
  return (
    <div className="pb-16" data-desk-report={r.done ? "done" : "open"}>
      <DeskHeader title="Report" back={back} name={r.title} kind="Report" />
      <LowerThird
        lead={
          <span className="flex-none overflow-hidden rounded-[3px] shadow-plate">
            <Avatar id={r.who.id ?? `gone-${who}`} name={who} size={64} colour={colourOf(r.who.id ?? who, r.who.colour)} />
          </span>
        }
        tag={r.done ? "Done" : "Open"}
        tone={r.done ? "stopped" : "quiet"}
        title={r.idea ? "An idea" : "A problem"}
        detail={`From ${who} · ${agoOf(r.at)}`}
      />
      <section className="mt-4 px-4">
        <blockquote data-report-words className="whitespace-pre-wrap rounded-[3px] bg-plate p-4 text-[17px] leading-normal text-plate-foreground [overflow-wrap:anywhere]">
          {r.message}
        </blockquote>
        <p data-report-from className="mt-2.5 text-[13px] leading-snug text-muted-foreground">
          {r.sentFrom}
          {r.done && r.doneAt ? ` · done ${agoOf(r.doneAt)}${r.doneBy ? `, by ${r.doneBy}` : ""}` : ""}
        </p>
      </section>
      <section className="mt-5 grid grid-cols-2 gap-2 px-4">
        <Btn data-report-done={r.done ? "reopen" : "done"} tone={r.done ? "optional" : "must"} disabled={busy} onClick={() => mark(!r.done)}>
          {r.done ? "Reopen" : "Mark done"}
        </Btn>
        <Btn
          data-report-act
          aria-disabled={r.actOff ? true : undefined}
          className={r.actOff ? "opacity-55" : ""}
          onClick={() => (r.actOff ? toast.quiet(r.actOff) : r.sender && nav.push(`${paths.deskItem("person", r.sender.id)}?act=1`))}
        >
          Act as {who}
        </Btn>
      </section>
      <Section title="From">
        <div className="border-b border-border">
          {r.sender ? (
            <DeskRow
              href={paths.deskItem("person", r.sender.id)}
              data="report-sender"
              lead={<Avatar id={r.sender.id} name={r.sender.name} size={40} colour={colourOf(r.sender.id, r.sender.colour)} />}
              title={r.sender.name}
              line={`${r.sender.email ?? "no email"} · active ${agoOf(r.sender.activeAt)}`}
            />
          ) : (
            <DeskRow data="report-sender" lead={<Avatar id={`gone-${who}`} name={who} size={40} />} title={who} line="Their account was deleted" />
          )}
          {where}
        </div>
      </Section>
      <LatestHistory lines={r.history} />
      <DeleteRow data="report" title="Delete this report" line={`Gone for good · ${who} isn't told`} onClick={() => setDeleting(true)} />
      <HoldSheet
        open={deleting}
        onOpenChange={setDeleting}
        title="Delete this report?"
        subtitle="This can't be undone"
        consequence=""
        body={
          <ul data-report-delete className="flex flex-col gap-2 rounded-[3px] bg-background p-3 text-[16px] leading-normal">
            <li>
              &ldquo;{r.title}&rdquo; goes for good. {who} isn&apos;t told.
            </li>
          </ul>
        }
        cta="delete the report"
        restore="Can't be undone"
        alt={
          r.done
            ? undefined
            : {
                label: "Mark it done instead",
                line: "It leaves the Inbox and stays in Reports › Done.",
                onClick: () => {
                  setDeleting(false);
                  void mark(true);
                },
              }
        }
        onConfirm={async () => {
          await deskSend(`/reports/${r.id}`, {}, "DELETE");
          forgetDeskPage(paths.deskItem("report", r.id));
          nav.back(paths.deskReports(), (prev) => prev === paths.deskReports());
          toast("Report deleted");
          // Every desk read moves on but this page's own, which is gone.
          await client.invalidateQueries({ queryKey: ["new-design"], predicate: (x) => x.queryKey[2] !== `/reports/${r.id}` });
        }}
      />
    </div>
  );
}
