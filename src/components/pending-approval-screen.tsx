"use client";

import { FrontDoor, FrontDoorTitle } from "@/components/auth/front-door";
import { Button } from "@/components/ui/button";

// Early access gate (db/migrations/0058_user_approval.sql): shown in place of the app shell for a
// signed-in account that hasn't been approved yet. Shares the front door's layout rather than its
// own look, since it's still a pre-app screen -- the signed-out and "signed in but pending" states
// read as two beats of the same cold open, not a dead end.
export function PendingApprovalScreen({ onSignOut }: { onSignOut: () => void }) {
  return (
    <FrontDoor
      title={
        <FrontDoorTitle
          detail={
            <>
              This app is currently in early access. If your account is approved, you&rsquo;ll gain access on your
              next login.
            </>
          }
        >
          You&rsquo;re on the list
        </FrontDoorTitle>
      }
    >
      <Button variant="secondary" onClick={onSignOut} className="w-full">
        Sign out
      </Button>
    </FrontDoor>
  );
}
