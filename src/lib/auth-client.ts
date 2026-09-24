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
