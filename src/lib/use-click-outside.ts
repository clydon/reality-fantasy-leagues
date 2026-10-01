import { useEffect, type RefObject } from "react";

// Calls onOutside for a pointer press anywhere outside ref's element, while `active`. Used by the
// league dropdowns (desktop switcher and MobileNav's top bar), which have no backdrop to click.
export function useClickOutside(ref: RefObject<HTMLElement | null>, active: boolean, onOutside: () => void) {
  useEffect(() => {
    if (!active) return;
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onOutside();
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [ref, active, onOutside]);
}
