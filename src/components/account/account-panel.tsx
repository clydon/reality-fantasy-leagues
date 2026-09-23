"use client";

import { useState } from "react";
import Link from "next/link";
import { useSession, signIn, signUp, signOut } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// New, separate account system: Better Auth email+password with a real reset-password flow
// (src/lib/auth.ts). Deliberately its own thing, not wired into AuthGate/useLeagueStore -- this
// is this app's OWN future signup story (per docs/ARCHITECTURE.md's Phase 4), independent of the
// "log into a real SurvivorDraft league" demo flow elsewhere in this repo. See README.
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
        <h2 className="mb-[18px] text-2xl font-bold tracking-tight">Account</h2>
        <div className="mx-auto max-w-[360px]">
          <div className="mb-4 rounded-lg border border-border bg-card p-[18px_20px] shadow-sm">
            <p className="mb-1 text-sm">
              Signed in as <b>{session.user.name}</b>
            </p>
            <p className="mb-4 text-sm text-muted-foreground">{session.user.email}</p>
            <Button variant="secondary" onClick={() => signOut()}>
              Sign out
            </Button>
          </div>
          {/* This account (Better Auth) isn't connected to a SurvivorDraft league yet -- see
              CLAUDE.md/README: two deliberately separate identity systems today. Without this,
              signing up here was a dead end with no way back into the app. */}
          <div className="rounded-lg border border-dashed border-border bg-secondary/40 p-[18px_20px]">
            <p className="mb-3 text-sm text-muted-foreground">
              This account isn&rsquo;t connected to a league yet — joining or creating a league still works through
              the separate sign-in on the main app.
            </p>
            <Link href="/">
              <Button className="w-full">Continue to the app →</Button>
            </Link>
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
