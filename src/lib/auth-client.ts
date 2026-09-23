"use client";

import { createAuthClient } from "better-auth/react";
import { usernameClient, adminClient } from "better-auth/client/plugins";

// This app's own, and now only, session (see src/lib/auth.ts for why "now only"). baseURL
// defaults to same-origin, correct here since the API route lives in this same Next.js app.
export const authClient = createAuthClient({
  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:8935",
  plugins: [usernameClient(), adminClient()],
});

export const { useSession, signIn, signUp, signOut, requestPasswordReset, resetPassword, admin } = authClient;

// signIn.username({username, password}) and signIn.email({email, password}) are two different
// endpoints (the username plugin doesn't also do email lookup) -- this picks the right one based
// on whether the input looks like an email, so the login form can offer one "username or email"
// field instead of asking the user which kind of thing they typed.
export function signInWithIdentifier(identifier: string, password: string) {
  return identifier.includes("@") ? signIn.email({ email: identifier, password }) : signIn.username({ username: identifier, password });
}
