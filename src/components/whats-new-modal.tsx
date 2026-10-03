"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useIsAuthenticated, useIsPreviewingDemo, useLeagueStore } from "@/lib/store";
import { LATEST_RELEASE_ID, RELEASES, unseenItems, type WhatsNewItem } from "@/lib/whats-new";
import { Button } from "@/components/ui/button";
import { ChevronDownIcon } from "@/components/icons";
import { cn } from "cn";
import { create } from "zustand";
import { useMoreSheetRequest } from "@/lib/more-sheet";
import { useRouter } from "next/navigation";

// Opening the popup on demand:
//   "preview" -- Admin's "Preview What's New": the newest release; closing it isn't recorded (it isn't
//                the player seeing it for real), so it can be opened as often as wanted.
//   "all"     -- the More menu / sidebar's "What's new": every release, the last week's in full and
//                older ones folded under "See older releases".
export const useWhatsNewPreview = create<{
  mode: "preview" | "all" | null;
  show: () => void;
  showAll: () => void;
  hide: () => void;
}>((set) => ({
  mode: null,
  show: () => set({ mode: "preview" }),
  showAll: () => set({ mode: "all" }),
  hide: () => set({ mode: null }),
}));

// Releases within this many days of the newest show in full in the "all" view; older ones wait behind
// "See older releases".
const RECENT_DAYS = 7;

// The one-time "What's New" popup (content: src/lib/whats-new.ts). Signed-in players only, once per
// release per account: dismissing records the release id on their account. An account created after
// the release just gets it marked as seen -- none of it is "new" to them. Mounted once in AuthGate's
// shell, like ConfirmDialog.
export function WhatsNewModal() {
  const isAuthenticated = useIsAuthenticated();
  const previewingDemo = useIsPreviewingDemo();
  // An admin viewing as someone doesn't get their popup (and the server won't mark it seen anyway).
  const impersonating = useLeagueStore((s) => s.impersonating);
  // What this player hasn't seen yet (every release since the one they last dismissed); null = closed.
  const [unseen, setUnseen] = useState<WhatsNewItem[] | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showOlder, setShowOlder] = useState(false);
  const mode = useWhatsNewPreview((s) => s.mode);
  const hide = useWhatsNewPreview((s) => s.hide);
  const showAll = useWhatsNewPreview((s) => s.showAll);
  const openMoreSheet = useMoreSheetRequest((s) => s.open);
  const router = useRouter();

  useEffect(() => {
    if (!isAuthenticated || previewingDemo || impersonating) return;
    let cancelled = false;
    api
      .getMySettings()
      .then((s) => {
        if (cancelled || s.whatsNewSeen === LATEST_RELEASE_ID) return;
        const items = unseenItems(s.whatsNewSeen, s.accountCreatedAt);
        // Nothing they'd call new (their account is newer than all of it): just mark it seen.
        if (items.length === 0) {
          api.setMySettings({ whatsNewSeen: LATEST_RELEASE_ID }).catch(() => {});
          return;
        }
        setUnseen(items);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, previewingDemo, impersonating]);

  if (!mode && !unseen) return null;

  function dismiss() {
    const wasMode = mode;
    hide();
    setUnseen(null);
    setShowOlder(false);
    // A preview isn't the real thing; the popup or the full list is -- it's been seen.
    if (wasMode !== "preview" && isAuthenticated) api.setMySettings({ whatsNewSeen: LATEST_RELEASE_ID }).catch(() => {});
  }

  // A "Show me" link: a page goes straight there. What's new itself lives in the More menu on a phone
  // (open it, so they see where); on desktop there's no More menu, so straight to the full list.
  function follow(link: NonNullable<WhatsNewItem["link"]>) {
    if (link.to !== "whatsNewMenu") {
      dismiss();
      router.push(link.to);
      return;
    }
    const tabBar = document.querySelector("[data-mobile-tabbar]")?.getBoundingClientRect();
    dismiss();
    if (tabBar && tabBar.height > 0) openMoreSheet();
    else showAll();
  }

  // The "all" view: releases by date, the last week's in full, older ones folded away.
  // A week back from the NEWEST release, not from today: the latest batch always shows in full, even
  // after a quiet month.
  const latest = new Date(`${RELEASES[0].date}T12:00:00Z`).getTime();
  const cutoff = new Date(latest - RECENT_DAYS * 86400 * 1000).toISOString().slice(0, 10);
  const recent = RELEASES.filter((r) => r.date >= cutoff);
  const older = RELEASES.filter((r) => r.date < cutoff);

  const list = (items: WhatsNewItem[]) => (
    <ul className="flex flex-col divide-y divide-border">
      {items.map((it) =>
        it.detail ? (
          <li key={it.title}>
            <button
              className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm font-semibold"
              aria-expanded={expanded === it.title}
              onClick={() => setExpanded(expanded === it.title ? null : it.title)}
            >
              <span className="w-6 shrink-0 text-center text-lg" aria-hidden>
                {it.icon}
              </span>
              <span className="min-w-0 flex-1">{it.title}</span>
              <ChevronDownIcon
                className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", expanded === it.title && "rotate-180")}
              />
            </button>
            {expanded === it.title && <p className="pb-2.5 pl-[2.875rem] pr-3 text-sm text-muted-foreground">{it.detail}</p>}
            {it.link && (
              <button className="-mt-1 pb-2.5 pl-[2.875rem] text-sm font-semibold text-primary" onClick={() => follow(it.link!)}>
                {it.link.label} &rsaquo;
              </button>
            )}
          </li>
        ) : (
          <li key={it.title} className="flex items-center gap-2.5 px-3 py-2.5 text-sm font-semibold">
            <span className="w-6 shrink-0 text-center text-lg" aria-hidden>
              {it.icon}
            </span>
            {it.title}
          </li>
        )
      )}
    </ul>
  );
  // One heading per day: several releases on the same day read as one.
  const dated = (releases: typeof RELEASES) => {
    const days: { date: string; items: WhatsNewItem[] }[] = [];
    for (const r of releases) {
      const last = days[days.length - 1];
      if (last && last.date === r.date) last.items.push(...r.items);
      else days.push({ date: r.date, items: [...r.items] });
    }
    return days.map((d) => (
      <div key={d.date}>
        <div className="px-3 pb-0.5 pt-2.5 text-[0.65rem] font-bold uppercase tracking-wide text-muted-foreground">
          {new Date(`${d.date}T12:00:00`).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}
        </div>
        {list(d.items)}
      </div>
    ));
  };

  return (
    <div className="fixed inset-0 z-[1900] flex items-center justify-center bg-black/50 p-4" onClick={(e) => e.target === e.currentTarget && dismiss()}>
      <div
        role="dialog"
        aria-labelledby="whats-new-title"
        className="whats-new-pop flex max-h-[85vh] w-full max-w-[440px] flex-col overflow-hidden rounded-xl bg-card shadow-xl"
      >
        {/* A splash of the brand colour up top: new features should feel like news. */}
        <div className="bg-gradient-to-br from-primary to-[#e8a25a] px-5 pb-4 pt-5 text-white">
          <h3 id="whats-new-title" className="flex items-center gap-2 text-xl font-bold">
            <span aria-hidden>✨</span> What&rsquo;s new
          </h3>
          <p className="mt-0.5 text-sm text-white/85">{mode === "all" ? "Everything that's changed" : "Fresh in this update"}</p>
        </div>
        <div className="overflow-y-auto px-2 py-1">
          {mode === "all" ? (
            <>
              {dated(recent)}
              {older.length > 0 &&
                (showOlder ? (
                  dated(older)
                ) : (
                  <button className="w-full px-3 py-3 text-left text-sm font-semibold text-primary" onClick={() => setShowOlder(true)}>
                    See older releases ({older.length})
                  </button>
                ))}
            </>
          ) : (
            list(mode === "preview" ? RELEASES[0].items : (unseen ?? []))
          )}
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-border px-5 py-3">
          {/* Where every update lives, for a popup that only showed the new ones. */}
          {mode !== "all" ? (
            <button className="text-sm text-muted-foreground underline-offset-2 hover:underline" onClick={() => follow({ label: "", to: "whatsNewMenu" })}>
              See all updates
            </button>
          ) : (
            <span />
          )}
          <Button onClick={dismiss}>{mode === "all" ? "Close" : "Let’s go!"}</Button>
        </div>
      </div>
    </div>
  );
}
