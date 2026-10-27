"use client";

import { useEffect } from "react";
import { isStandalone } from "@/lib/push-client";

// In the installed app on a phone, a long press on a link or image doesn't open the browser's menu
// (copy link address, download link, open in new tab): an app's buttons don't have one. iOS gets this
// from -webkit-touch-callout in globals.css; Android has no CSS for it, so the contextmenu event its
// long press fires is cancelled here. Text boxes keep theirs (paste), and so do browser tabs and a
// desktop install's right-click.
const EDITABLE = "input, textarea, select, [contenteditable]:not([contenteditable='false'])";

export function NoLinkMenu() {
  useEffect(() => {
    if (!isStandalone() || !window.matchMedia("(pointer: coarse)").matches) return;
    const onMenu = (e: MouseEvent) => {
      if (e.target instanceof Element && e.target.closest(EDITABLE)) return;
      e.preventDefault();
    };
    document.addEventListener("contextmenu", onMenu);
    return () => document.removeEventListener("contextmenu", onMenu);
  }, []);
  return null;
}
