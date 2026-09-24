"use client";

import { createAuthClient } from "better-auth/react";
import { usernameClient, adminClient } from "better-auth/client/plugins";

// This app's own, and now only, session (see src/lib/auth.ts for why "now only"). No baseURL: it
// defaults to the same-origin "/api/auth" (better-auth/dist/client/config.mjs), which is correct
// everywhere this runs since the API route lives in this same Next.js app. An explicit baseURL
// here used to read process.env.BETTER_AUTH_URL -- a SERVER-only var Next.js never inlines into
// the browser bundle (only NEXT_PUBLIC_* vars are), so every deployed environment silently fell
// back to its hardcoded "http://localhost:8935" default and every fetch failed off that machine.
export const authClient = createAuthClient({
  plugins: [usernameClient(), adminClient()],
});

export const { useSession, signIn, signUp, signOut, requestPasswordReset, resetPassword, updateUser, changePassword, admin } = authClient;

// signIn.username({username, password}) and signIn.email({email, password}) are two different
// endpoints (the username plugin doesn't also do email lookup) -- this picks the right one based
// on whether the input looks like an email, so the login form can offer one "username or email"
// field instead of asking the user which kind of thing they typed.
export function signInWithIdentifier(identifier: string, password: string) {
  return identifier.includes("@") ? signIn.email({ email: identifier, password }) : signIn.username({ username: identifier, password });
}

// The one way out, shared by the sidebar, the mobile More sheet, Account settings and the
// Dashboard. Two things it gets right that four hand-rolled copies did not:
//
//   * it always lands on "/" -- signing out from /account used to leave you sitting on /account,
//     which then re-rendered as the signup form;
//   * it's a full page load, so every piece of client state (the Zustand store's identity, loaded
//     league, cached queries) is gone rather than reset by hand. Same reasoning as AuthGate's
//     stop-impersonating and exit-demo paths, which already reload for exactly this reason.
//
// Best-effort on the network call: a failed sign-out request must still get you off the page, and
// the cookie is cleared server-side either way on the next authenticated request.
export async function logOut() {
  try {
    await signOut();
  } catch {
    // ignored on purpose -- see above
  }
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.href = "/";
}
