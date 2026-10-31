"use client";

import { ChevronRight, KeyRound, Medal, Settings, Star, Zap } from "lucide-react";
import { couchLine, FaceStack, openCouchSheet } from "../couch/couch-sheets";
import type { Couch, CouchHub } from "../data";
import { useDesk, type Inbox } from "../desk/data";
import { ordinal } from "../games";
import { NavLink } from "../nav";
import { paths } from "../routes";
import { useMe } from "../session";
import { BackToAdminRow } from "../desk/view-as";
import { Row } from "../ui/parts";
import { ShowArt } from "../ui/show-bar";
import { Sheet } from "../ui/sheet";

// Your profile, from the hub's avatar (the mock's index.html profileSheet): your couch at the top (moved off the hub
// on 2026-10-23; it opens the couch switcher, step 9: couch-sheets.tsx), your numbers on this couch (step 8: titles, your Couch
// points and place (since 2026-10-31; this year's once the couch has a year before it), seasons played, your best show,
// predictions called, your best finish; couch-hub.ts, as far as you've seen),
// Admin for site admins (the desk, step 6b part 2, with what needs them), and Settings. Since step 12 part 1 your taste on the
// couch from its ratings (ratings.ts): Agree with the couch in place of seasons played once there's enough to say, and your
// taste twin. (A site admin's test couch switches went 2026-10-31 with the test couch, the user's call.)

/** Your numbers on the couch, or a line saying they fill in as it plays. */
function YourNumbers({ hub }: { hub: CouchHub | undefined }) {
  if (!hub) return <div aria-busy className="h-[180px] animate-pulse rounded-[4px] bg-card" />;
  const y = hub.you;
  const agree = hub.taste.agree;
  const twin = hub.taste.twin;
  const stats: [string, string][] = [
    [String(y.titles), y.titles === 1 ? "Title" : "Titles"],
    [String(y.points), "Couch points"],
    agree ? [`${agree.pct}%`, "Agree with the couch"] : [String(y.seasons), y.seasons === 1 ? "Season played" : "Seasons played"],
  ];
  return (
    <div data-your-numbers>
      <div className="grid grid-cols-3 gap-2">
        {stats.map(([n, label]) => (
          <div key={label} className="rounded-[3px] bg-secondary px-2.5 py-2">
            <b className="type-num block text-[28px]">{n}</b>
            <small className="block text-xs leading-snug text-muted-foreground">{label}</small>
          </div>
        ))}
      </div>
      {y.bestShow ? (
        <>
          <p className="type-caption mb-2 mt-4 text-xs tracking-[0.06em] text-muted-foreground">Your best show</p>
          <NavLink href={paths.show(y.bestShow.seasonId)} channel data-art-scope className="relative block h-24 overflow-hidden rounded-[4px]">
            <ShowArt seasonId={y.bestShow.seasonId} artUrl={y.bestShow.artUrl} name={y.bestShow.name} className="size-full" />
            <b className="type-caption absolute bottom-2 left-3 text-[28px] text-white [text-shadow:0_2px_12px_rgba(0,0,0,.6)]">{y.bestShow.name}</b>
          </NavLink>
        </>
      ) : (
        <p className="mt-3 text-[13px] leading-snug text-muted-foreground">Your numbers fill in as the couch plays: every game you play counts, as far as you&apos;ve seen.</p>
      )}
      <div className="mt-2 flex flex-col">
        {y.place && (
          <span data-your-place className="contents">
            <Row
              icon={Star}
              title={`${y.place.startsWith("T") ? `Tied ${ordinal(Number(y.place.slice(1)))}` : ordinal(Number(y.place))} on the couch${y.thisYear ? " this year" : ""}`}
              detail={`${y.points} Couch points`}
            />
          </span>
        )}
        {y.bestFinish && <Row icon={Medal} title={`Best finish: ${ordinal(Number(y.bestFinish.rank))}`} detail={`${y.bestFinish.gameName} · ${y.bestFinish.label}`} />}
        {y.called > 0 && <Row icon={Zap} title={`Called it: ${y.called} ${y.called === 1 ? "prediction" : "predictions"} right`} detail="In every game on the couch, as far as you've seen" />}
        {twin && (
          <span data-taste-twin className="contents">
            <Row icon={Star} title={`Taste twin: ${twin.name}`} detail={twin.line} />
          </span>
        )}
      </div>
    </div>
  );
}

export function ProfileSheet({ open, onOpenChange, me, couch, hub }: { open: boolean; onOpenChange: (open: boolean) => void; me: { name: string }; couch: Couch | null; hub: CouchHub | undefined }) {
  const { isSuperAdmin: admin, viewingAs } = useMe();
  const inbox = useDesk<Inbox>(admin && open ? "/inbox" : null);
  const needs = inbox.data?.items.length ?? 0;
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={me.name} subtitle={couch?.name}>
      {couch && (
        <button
          type="button"
          data-couch-line
          onClick={() => {
            onOpenChange(false);
            openCouchSheet({ kind: "switch" });
          }}
          className="nd-press mb-3.5 flex min-h-12 w-full items-center gap-2.5 rounded-[3px] bg-secondary py-2 pl-2 pr-3 text-left"
        >
          <FaceStack people={couch.members} size={24} />
          <span className="min-w-0 flex-1">
            <b className="block truncate text-[15px] font-semibold">{couch.name}</b>
            <small className="block truncate text-[12.5px] text-muted-foreground">{couchLine(couch)}</small>
          </span>
          <ChevronRight className="size-5 flex-none text-muted-foreground" aria-hidden />
        </button>
      )}
      {!couch && (
        <button
          type="button"
          data-couch-line
          onClick={() => {
            onOpenChange(false);
            openCouchSheet({ kind: "switch" });
          }}
          className="nd-press mb-3.5 flex min-h-12 w-full items-center gap-2.5 rounded-[3px] bg-secondary px-3 py-2 text-left"
        >
          <span className="min-w-0 flex-1">
            <b className="block text-[15px] font-semibold">No couch yet</b>
            <small className="block text-[12.5px] text-muted-foreground">Start one for your people, or join one with a code</small>
          </span>
          <ChevronRight className="size-5 flex-none text-muted-foreground" aria-hidden />
        </button>
      )}
      {couch && <YourNumbers hub={hub} />}
      {admin && (
        <NavLink href={paths.desk()} data-admin-row className="nd-press mt-3.5 flex min-h-[60px] items-center gap-3 rounded-[3px] bg-card px-3">
          <span className="grid size-9 flex-none place-items-center rounded-[3px] bg-foreground text-background">
            <KeyRound className="size-[18px]" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <b className="block text-[15px]">Admin</b>
            <small className="block text-[13px] text-muted-foreground">{inbox.data ? (needs ? `${needs} need${needs === 1 ? "s" : ""} you` : "Nothing needs you") : "Inbox, Find and Settings"}</small>
          </span>
          <ChevronRight className="size-5 text-muted-foreground" aria-hidden />
        </NavLink>
      )}
      {viewingAs && <BackToAdminRow as={viewingAs} />}
      <NavLink
        href={paths.settings}
        className="nd-press mt-3.5 flex h-[52px] items-center justify-center gap-2 rounded-[3px] bg-card text-[15px] font-bold outline-1 -outline-offset-1 outline-input"
      >
        <Settings className="size-5" aria-hidden />
        Settings
      </NavLink>
    </Sheet>
  );
}
