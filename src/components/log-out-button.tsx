"use client";

import { useState } from "react";
import { logOut } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";

// Account settings' own sign-out control. The sidebar and mobile More sheet have their own
// chrome-matching rows rather than this button; all three call the same logOut() (auth-client.ts),
// which is what guarantees they all end up on "/" instead of wherever they were.
export function LogOutButton() {
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="secondary"
      disabled={busy}
      onClick={() => {
        setBusy(true);
        logOut();
      }}
    >
      {busy ? "Signing out…" : "Sign out"}
    </Button>
  );
}
