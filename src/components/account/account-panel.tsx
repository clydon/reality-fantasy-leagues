"use client";

import { useState } from "react";
import Link from "next/link";
import { useSession, signIn, signUp, signOut } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";

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
      <div className="rounded-lg border border-border bg-card p-[18px_20px] shadow-sm">
        <h3 className="mb-2.5 text-[0.7rem] font-bold uppercase tracking-wide text-muted-foreground">Account</h3>
        <p className="mb-1 text-sm">
          Signed in as <b>{session.user.name}</b>
        </p>
        <p className="mb-4 text-sm text-muted-foreground">{session.user.email}</p>
        <Button variant="secondary" onClick={() => signOut()}>
          Sign out
        </Button>
      </div>
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
            <input
              className="rounded-md border border-border bg-card px-2.5 py-[7px] text-[0.88rem]"
              placeholder="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              required
            />
          )}
          <input
            className="rounded-md border border-border bg-card px-2.5 py-[7px] text-[0.88rem]"
            placeholder="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
          <input
            className="rounded-md border border-border bg-card px-2.5 py-[7px] text-[0.88rem]"
            placeholder="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            minLength={8}
            required
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="rounded-md bg-primary px-[15px] py-2 text-[0.85rem] font-semibold text-primary-foreground shadow-sm hover:brightness-[1.06] disabled:opacity-40"
          >
            {loading ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in"}
          </button>
        </form>
        {mode === "signin" && (
          <p className="mt-2.5 text-xs text-muted-foreground">
            <Link href="/forgot-password" className="font-semibold text-primary hover:underline">
              Forgot your password?
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
