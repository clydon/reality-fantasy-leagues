"use client";

import { createAuthClient } from "better-auth/react";

// This app's own Better Auth session (see src/lib/auth.ts) -- unrelated to the SurvivorDraft
// session used elsewhere (src/lib/api.ts). baseURL defaults to same-origin, which is correct
// here since the API route lives in this same Next.js app (unlike the SurvivorDraft calls,
// which cross origins to the separate Express server over CORS).
export const authClient = createAuthClient({
  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:8935",
});

export const { useSession, signIn, signUp, signOut, requestPasswordReset, resetPassword } = authClient;
