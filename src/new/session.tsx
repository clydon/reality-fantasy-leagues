"use client";

import { createContext, useContext, type ReactNode } from "react";
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
}

const MeContext = createContext<Me | null>(null);

export function SessionProvider({ me, children }: { me: Me; children: ReactNode }) {
  return (
    <MeContext.Provider value={me}>
      {me.impersonating && (
        <div className="sticky top-0 z-[60] flex items-center justify-center gap-2 bg-[#3c6ea6] px-3 py-2 text-center text-[13px] text-white">
          Viewing as <b>{me.name}</b>
          <button
            type="button"
            className="rounded-[3px] bg-white/20 px-2 py-1 font-semibold"
            onClick={async () => {
              await api.stopImpersonating();
              // A full reload: the admin's own session, and their own choice of design.
              // eslint-disable-next-line @next/next/no-location-assign-relative-destination
              window.location.href = "/";
            }}
          >
            Return to my account
          </button>
        </div>
      )}
      {children}
    </MeContext.Provider>
  );
}

export function useMe(): Me {
  const me = useContext(MeContext);
  if (!me) throw new Error("useMe outside the signed-in layout");
  return me;
}
