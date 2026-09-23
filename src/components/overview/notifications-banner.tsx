"use client";

import { useRouter } from "next/navigation";
import { useNotificationsStore } from "@/lib/notifications-store";

// Port of renderOverview()'s Notifications panel (public/app.js). "needs your guess" entries are
// filtered out here since Side Bets already shows those inline -- same as the original
// (`listedNotifications = notifications.filter(n => n.kind !== 'bet-guess')`).
function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return Math.floor(s / 60) + "m ago";
  return Math.floor(s / 3600) + "h ago";
}

export function NotificationsBanner() {
  const router = useRouter();
  const notifications = useNotificationsStore((s) => s.notifications);
  const listed = notifications.filter((n) => n.kind !== "bet-guess");

  if (listed.length === 0) return null;

  return (
    <div className="mb-4 rounded-lg border border-primary bg-card p-4 shadow-sm">
      <h3 className="mb-2 text-[0.7rem] font-bold uppercase tracking-wide text-muted-foreground">Notifications</h3>
      <div className="flex flex-col">
        {listed.map((n) => (
          <button
            key={n.id}
            className="flex items-center justify-between gap-3 border-b border-border py-2.5 text-left last:border-b-0 hover:bg-secondary/50"
            onClick={() => router.push(n.tab)}
          >
            <span className="flex-1 text-sm">{n.text}</span>
            <span className="whitespace-nowrap text-xs text-muted-foreground">{timeAgo(n.ts)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
