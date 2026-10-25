// Who gets in (docs/PLAN-new-design.md step 9 part 2): app_settings 'signups', changed on the admin's desk (Settings ›
// Who gets in). Read by Better Auth's create hook (src/lib/auth.ts) and by the way in (src/lib/server/way-in.ts), so it
// has no imports of its own.
//
//   approve  every new account waits until a site admin lets it in (early access, db/migrations/0058): the default, and
//            what an unset key means
//   invites  a couch's invite code lets a waiting account straight in; anyone else waits
//   open     every new account plays straight away

export type SignupMode = "approve" | "invites" | "open";

export const SIGNUP_MODES: readonly SignupMode[] = ["approve", "invites", "open"];

export function signupModeOf(value: unknown): SignupMode {
  return value === "invites" || value === "open" ? value : "approve";
}

/** Whether joining a couch with its code lets a waiting account in. */
export const invitesLetIn = (mode: SignupMode) => mode !== "approve";
