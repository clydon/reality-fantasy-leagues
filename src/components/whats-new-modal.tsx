"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useIsAuthenticated, useIsPreviewingDemo, useLeagueStore } from "@/lib/store";
import { LATEST_RELEASE_ID, RELEASES, unseenItems, type WhatsNewItem } from "@/lib/whats-new";
import { ChevronRight } from "lucide-react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { cn } from "cn";
import { create } from "zustand";
import { useMoreSheetRequest } from "@/lib/more-sheet";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";

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

/** How many What's New items this account hasn't seen ("2 new" beside the menu rows). */
export function useWhatsNewCount(): number {
  const isAuthenticated = useIsAuthenticated();
  const previewingDemo = useIsPreviewingDemo();
  const { data } = useQuery({
    queryKey: ["my-settings"],
    queryFn: () => api.getMySettings(),
    enabled: isAuthenticated && !previewingDemo,
    staleTime: 5 * 60_000,
  });
  return data && data.whatsNewSeen !== LATEST_RELEASE_ID ? unseenItems(data.whatsNewSeen, data.accountCreatedAt).length : 0;
}

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
  const queryClient = useQueryClient();
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

  // What the sheet shows stays put while it slides away: closing clears `mode`, and without this the
  // content would swap to the popup's (or empty) mid-animation.
  const [view, setView] = useState<"popup" | "preview" | "all">("popup");
  if (mode && mode !== view) setView(mode);
  const open = !!mode || !!unseen;

  function dismiss() {
    const wasMode = mode;
    hide();
    setUnseen(null);
    // A preview isn't the real thing; the popup or the full list is -- it's been seen.
    // The menus' "2 new" (useWhatsNewCount) reads the same settings, so it clears too.
    if (wasMode !== "preview" && isAuthenticated)
      api
        .setMySettings({ whatsNewSeen: LATEST_RELEASE_ID })
        .then(() => queryClient.invalidateQueries({ queryKey: ["my-settings"] }))
        .catch(() => {});
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

  // The rundown: one hairline row per item, its detail right under it. They're short, so nothing hides
  // behind a tap.
  const list = (items: WhatsNewItem[]) => (
    <ul className="flex flex-col">
      {items.map((it) => (
        <li key={it.title} className="flex flex-col gap-1 border-t border-border py-3">
          <span className="text-base font-semibold leading-snug text-foreground">{it.title}</span>
          {it.detail && <p className="text-[15px] leading-snug text-muted-foreground">{it.detail}</p>}
          {it.link && (
            <button
              type="button"
              className="-mb-1 flex min-h-11 items-center gap-0.5 self-start text-[15px] font-bold text-chyron-line"
              onClick={() => follow(it.link!)}
            >
              {it.link.label}
              <ChevronRight className="size-[18px]" strokeWidth={2.4} aria-hidden />
            </button>
          )}
        </li>
      ))}
    </ul>
  );
  const dayLabel = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
  // One heading per day: several releases on the same day read as one.
  const dated = (releases: typeof RELEASES) => {
    const days: { date: string; items: WhatsNewItem[] }[] = [];
    for (const r of releases) {
      const last = days[days.length - 1];
      if (last && last.date === r.date) last.items.push(...r.items);
      else days.push({ date: r.date, items: [...r.items] });
    }
    return days.map((d) => (
      <section key={d.date} className="border-b border-border">
        <h4 className="type-caption pb-2 pt-4 text-[14px] tracking-[0.04em] text-muted-foreground">{dayLabel(d.date)}</h4>
        {list(d.items)}
      </section>
    ));
  };

  const items = view === "preview" ? RELEASES[0].items : (unseen ?? []);
  const outlined =
    "min-h-12 flex-1 rounded-[3px] border border-input bg-card text-[15px] font-bold text-foreground hover:bg-muted focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-chyron-line";

  return (
    <BottomSheet
      open={open}
      onOpenChange={(o) => !o && dismiss()}
      title="What’s new"
      description={view === "all" ? "Every update" : dayLabel(RELEASES[0].date)}
      hideCancel
      focusSheet
      footer={
        view === "all" ? (
          <button type="button" className={cn(outlined, "w-full")} onClick={dismiss}>
            Done
          </button>
        ) : (
          <div className="flex gap-2.5">
            {/* Where every update lives, for a popup that only showed the new ones. */}
            <button type="button" className={outlined} onClick={() => follow({ label: "", to: "whatsNewMenu" })}>
              All updates
            </button>
            <button
              type="button"
              onClick={dismiss}
              className="min-h-12 flex-[1.4] rounded-[3px] bg-chyron text-[15px] font-bold text-chyron-foreground transition-[filter] hover:brightness-[1.06] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-chyron-line"
            >
              Let&rsquo;s go!
            </button>
          </div>
        )
      }
    >
      {view === "all" ? (
        <>
          {dated(recent)}
          {older.length > 0 &&
            (showOlder ? (
              dated(older)
            ) : (
              <button
                type="button"
                className="flex min-h-12 items-center gap-0.5 text-[15px] font-bold text-chyron-line"
                onClick={() => setShowOlder(true)}
              >
                See older releases ({older.length})
                <ChevronRight className="size-[18px]" strokeWidth={2.4} aria-hidden />
              </button>
            ))}
        </>
      ) : (
        <div className="border-b border-border">{list(items)}</div>
      )}
    </BottomSheet>
  );
}
