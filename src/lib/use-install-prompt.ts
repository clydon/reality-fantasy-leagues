"use client";

import { useEffect, useState } from "react";
import { isStandalone, isIOS } from "@/lib/push-client";

// Chrome/Android's own install prompt: the browser fires this event (and suppresses its own
// mini-infobar) once it decides the page is installable, and holds it for us to trigger later
// from an actual button instead of whenever Chrome felt like asking. Not in any TS lib.
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

// One hook, shared by install-hint.tsx's section and banner variants, so "is this installable and
// how" is answered in exactly one place.
export function useInstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [standalone, setStandalone] = useState(false);

  useEffect(() => {
    // Reads a browser-only API (matchMedia/navigator.standalone) that doesn't exist during SSR --
    // there's no external system to subscribe to here, just a one-time synchronous check once
    // we're actually in the browser.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStandalone(isStandalone());
    function onPrompt(e: Event) {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    }
    function onInstalled() {
      setDeferred(null);
      setStandalone(true);
    }
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function promptInstall() {
    if (!deferred) return false;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    setDeferred(null);
    return outcome === "accepted";
  }

  return {
    standalone,
    ios: isIOS(),
    // Android/desktop Chrome offers a real one-tap prompt; iOS Safari never fires this event at
    // all (there is no programmatic install API), which is exactly why it needs its own
    // instructions instead.
    canPrompt: !!deferred,
    promptInstall,
  };
}
