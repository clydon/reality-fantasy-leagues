"use client";

import { useEffect, useState } from "react";
import { THEME_KEY } from "./theme-script";

// Light / dark / match the device, remembered per browser. The `dark` class on <html> is what the
// styles key off (globals.css's `.dark` block and Tailwind's `dark:` variant). Light is the default,
// so nobody's app changes until they choose.
export type ThemeChoice = "light" | "dark" | "system";
const KEY = THEME_KEY;

function readChoice(): ThemeChoice {
  try {
    const t = localStorage.getItem(KEY);
    return t === "dark" || t === "system" ? t : "light";
  } catch {
    return "light";
  }
}

function apply(choice: ThemeChoice) {
  const dark = choice === "dark" || (choice === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}

/** The current choice and a setter; follows the device live while on "system". */
export function useTheme(): [ThemeChoice, (c: ThemeChoice) => void] {
  const [choice, setChoice] = useState<ThemeChoice>("light");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time read of browser storage
    setChoice(readChoice());
  }, []);

  useEffect(() => {
    if (choice !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => apply("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [choice]);

  function set(c: ThemeChoice) {
    setChoice(c);
    try {
      localStorage.setItem(KEY, c);
    } catch {
      /* not remembered this time; still applied for this visit */
    }
    apply(c);
  }
  return [choice, set];
}

export const THEME_LABELS: Record<ThemeChoice, string> = { light: "Light", dark: "Dark", system: "Match device" };
