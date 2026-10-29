"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { api } from "@/lib/api";

// Who's signed in, for the new design's screens: read once on the server by the signed-in layout
// (src/app/(new)/(in)/layout.tsx), which sends anyone without a session to sign in. Every read is still
// checked by its own endpoint; this is only for drawing (your initial, your name). The Viewing as bar is #3c6ea6 (white
// text at about 5:1; docs/PLAN-desk-parity.md step 1 took it from #5089c4, about 3.7:1).

export interface Me {
  id: string;
  name: string;
  isSuperAdmin: boolean;
  /** An admin viewing the app as this person (classic's "Viewing as"). */
  impersonating: boolean;
  /** When the admin's hour as them ends (Better Auth's impersonation session). */
  impersonatingUntil?: string | null;
}

const MeContext = createContext<Me | null>(null);

export function SessionProvider({ me, children }: { me: Me; children: ReactNode }) {
  return (
    <MeContext.Provider value={me}>
      {me.impersonating && <ViewingAs name={me.name} until={me.impersonatingUntil ?? null} />}
      {children}
    </MeContext.Provider>
  );
}

/** Set by Return for the desk page it goes back to, which says so once it's loaded (people.tsx). */
export const BACK_FROM_ACTING = "gys-back-from-acting";

const minutesLeft = (until: string | null) => (until ? Math.max(0, Math.ceil((Date.parse(until) - Date.now()) / 60000)) : null);

/**
 * The Viewing as bar (docs/PLAN-desk-parity.md decision 1; the mock's dkStartAs): who you are for now, the minutes left
 * of the hour, and Return to my account, which ends it (in their desk History, when it began on the desk) and goes back
 * to their desk page, else the front door. With a minute left it returns on its own, while the hour can still be ended
 * (once it's run out, the session's gone and the app would only ask you to sign in).
 */
function ViewingAs({ name, until }: { name: string; until: string | null }) {
  const [left, setLeft] = useState(() => minutesLeft(until));
  const [busy, setBusy] = useState(false);
  const going = useRef(false);
  const back = useCallback(async () => {
    if (going.current) return;
    going.current = true;
    setBusy(true);
    let to: string | null = null;
    try {
      to = (await api.stopImpersonating()).back;
      // Their desk page says so once it's loaded (people.tsx BACK_FROM_ACTING).
      if (to) sessionStorage.setItem(BACK_FROM_ACTING, name);
    } catch {
      /* the hour ended already (the front door asks you to sign in), or this tab keeps nothing */
    }
    // A full reload: the admin's own session, and their own choice of design.
    window.location.href = to ?? "/";
  }, [name]);
  useEffect(() => {
    if (!until) return;
    const tick = () => {
      const ms = Date.parse(until) - Date.now();
      setLeft(minutesLeft(until));
      if (ms < 45_000) void back();
    };
    tick();
    const t = setInterval(tick, 15_000);
    return () => clearInterval(t);
  }, [until, back]);
  return (
    <div data-viewing-as={name} className="sticky top-0 z-[60] flex items-center justify-center gap-2 bg-[#3c6ea6] px-3 py-2 text-center text-[13px] text-white">
      <span>
        Viewing as <b>{name}</b>
        {left != null && <> · {left} min left</>}
      </span>
      <button type="button" data-viewing-as-return disabled={busy} className="min-h-9 rounded-[3px] bg-white/20 px-2 py-1 font-semibold" onClick={back}>
        Return to my account
      </button>
    </div>
  );
}

export function useMe(): Me {
  const me = useContext(MeContext);
  if (!me) throw new Error("useMe outside the signed-in layout");
  return me;
}
