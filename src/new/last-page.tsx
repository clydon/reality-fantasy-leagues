"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useMe } from "@/new/session";
import { RESUME_KEY, pathToRemember, type ResumePage } from "@/lib/resume-page";

// Remembers each signed-in page as you arrive on it, and stamps it as just left when the app is hidden, so a relaunch
// within the window reopens it (lib/resume-page.ts has the why and the launch half). Mounted once, in the signed-in
// layout, inside a Suspense (useSearchParams). Not while acting as someone: that hour ends, and their page isn't yours.

function save(userId: string, path: string) {
  try {
    localStorage.setItem(RESUME_KEY, JSON.stringify({ userId, path, at: Date.now() } satisfies ResumePage));
  } catch {
    /* not remembered: the next launch opens on Home */
  }
}

export function RememberPage() {
  const me = useMe();
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const acting = me.impersonating;

  useEffect(() => {
    if (acting) return;
    const path = pathToRemember(pathname, search);
    if (path) save(me.id, path);
  }, [acting, me.id, pathname, search]);

  useEffect(() => {
    if (acting) return;
    const onHide = () => {
      if (document.visibilityState !== "hidden") return;
      const path = pathToRemember(window.location.pathname, window.location.search);
      if (path) save(me.id, path);
    };
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, [acting, me.id]);

  return null;
}
