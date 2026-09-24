"use client";

import { useState } from "react";
import Link from "next/link";
import { useSession, signIn, signUp, signOut } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProfileSection } from "./profile-section";
import { PasswordSection } from "./password-section";
import { NotificationsSection } from "./notifications-section";
import { InstallHint } from "@/components/install-hint";

// This app's own, and now only, account system (Better Auth, src/lib/auth.ts -- see
// CLAUDE.md/README for the history of it becoming the one real login for everything, not a
// parallel system). Signed-in view is Account Settings: profile, password, push notification
// preferences, the install-app hint, and sign out. Reachable from the sidebar footer / mobile
// More sheet ("Account settings"). Signed-out view is unchanged -- sign in/sign up still work
// before a session exists, same as when this was a standalone future-signup page.
export function AccountPanel() {
  const { data: session, isPending } = useSession();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (isPending) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  if (session?.user) {
    return (
      <>
        <h2 className="mb-[18px] text-2xl font-bold tracking-tight">Account settings</h2>
        <div className="mx-auto max-w-[420px]">
          <ProfileSection />
          <PasswordSection />
          <NotificationsSection />
          <InstallHint variant="section" />
          <div className="rounded-lg border border-border bg-card p-[18px_20px] shadow-sm">
            <Button variant="secondary" onClick={() => signOut()}>
              Sign out
            </Button>
          </div>
        </div>
      </>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result =
        mode === "signup" ? await signUp.email({ name, email, password }) : await signIn.email({ email, password });
      if (result.error) setError(result.error.message || "Something went wrong.");
    } catch {
      setError("Couldn't reach the server.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <h2 className="mb-[18px] text-2xl font-bold tracking-tight">Account</h2>
      <div className="mx-auto max-w-[360px]">
        <div className="mb-4 rounded-lg border border-border bg-card p-[18px_20px] shadow-sm">
          <div className="mb-3 flex gap-1 rounded-md bg-secondary p-1 text-sm">
            <button
              type="button"
              className={`flex-1 rounded px-3 py-1.5 font-semibold ${mode === "signin" ? "bg-card shadow-sm" : "text-muted-foreground"}`}
              onClick={() => setMode("signin")}
            >
              Sign in
            </button>
            <button
              type="button"
              className={`flex-1 rounded px-3 py-1.5 font-semibold ${mode === "signup" ? "bg-card shadow-sm" : "text-muted-foreground"}`}
              onClick={() => setMode("signup")}
            >
              Sign up
            </button>
          </div>
          <form onSubmit={submit} className="flex flex-col gap-2">
            {mode === "signup" && (
              <Input
                placeholder="Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                required
              />
            )}
            <Input
              placeholder="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
            <Input
              placeholder="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              minLength={8}
              required
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" disabled={loading}>
              {loading ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in"}
            </Button>
          </form>
          {mode === "signin" && (
            <p className="mt-2.5 text-xs text-muted-foreground">
              <Link href="/forgot-password" className="font-semibold text-primary hover:underline">
                Forgot your password?
              </Link>
            </p>
          )}
        </div>
        <p className="text-center text-xs text-muted-foreground">
          <Link href="/" className="font-semibold text-primary hover:underline">
            ← Back to the app
          </Link>
        </p>
      </div>
    </>
  );
}
