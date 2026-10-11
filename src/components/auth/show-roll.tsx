"use client";

import { useEffect, useState } from "react";
import { Tv } from "lucide-react";
import { AnimatePresence, m, useReducedMotion } from "@/components/motion";

// The front door's title card: "Turn [a show] into a league." The show's name sits on a caption
// plate and rolls through shows people play, landing on "Your show" and staying there, so the
// point (any show) is the last thing it says and nothing moves while someone is typing. Under
// reduced motion it just says "Your show". Show names are text only: no network art (PRODUCT.md).
// Only competition shows research handles today; non-competition formats are still planned.
const SHOWS = ["Survivor", "The Traitors", "Big Brother", "The Challenge", "Love Island", "Drag Race"];
const LAST = "Your show";
const STEP_MS = 1500;

const EASE = [0.16, 1, 0.3, 1] as const;

export function ShowRoll() {
  const reduce = useReducedMotion();
  const [i, setI] = useState(0);
  const names = [...SHOWS, LAST];
  const done = i >= names.length - 1;

  useEffect(() => {
    if (reduce || done) return;
    const t = setTimeout(() => setI((n) => n + 1), i === 0 ? STEP_MS + 600 : STEP_MS);
    return () => clearTimeout(t);
  }, [i, reduce, done]);

  const name = reduce ? LAST : names[i];

  return (
    <>
      <h1 className="sr-only">Turn any TV show into a fantasy league.</h1>
      <div aria-hidden className="type-caption text-[clamp(44px,12.5vw,60px)] leading-[0.95]">
        <div>Turn</div>
        <m.div layout transition={{ layout: { duration: 0.35, ease: EASE } }} className="my-2.5 flex h-[1.4em] w-fit max-w-full items-stretch rounded-[3px] shadow-plate">
          <m.span layout="position" className="relative z-10 flex shrink-0 items-center bg-quiet-tag pr-[22px] pl-3 text-quiet-tag-foreground [clip-path:polygon(0_0,100%_0,84%_100%,0_100%)]">
            <Tv className="size-[0.42em]" strokeWidth={2.4} />
          </m.span>
          <span className="relative -ml-2.5 flex min-w-0 items-center overflow-hidden rounded-r-[3px] bg-plate pr-4 pl-5 text-plate-foreground">
            <AnimatePresence mode="popLayout" initial={false}>
              <m.span
                key={name}
                initial={{ y: "70%", opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: "-70%", opacity: 0 }}
                transition={{ duration: 0.4, ease: EASE }}
                className="block truncate pt-[0.06em] text-[0.8em]"
              >
                {name}
              </m.span>
            </AnimatePresence>
          </span>
        </m.div>
        <div>Into a league.</div>
      </div>
    </>
  );
}
