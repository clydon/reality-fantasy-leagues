"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSession, signUp } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProfileSection } from "./profile-section";
import { PasswordSection } from "./password-section";
import { NotificationsSection } from "./notifications-section";
import { InstallHint } from "@/components/install-hint";
import { LogOutButton } from "@/components/log-out-button";

// This app's own, and now only, account system (Better Auth, src/lib/auth.ts -- see
// CLAUDE.md/README for the history of it becoming the one real login for everything, not a
// parallel system). Two views:
//
//   signed in  -- Account Settings: profile, password, push notification preferences, the
//                 install-app hint, sign out. Reachable from the sidebar footer / mobile More
//                 sheet, and rendered inside the app shell, so there's a way back out (see
//                 auth-gate.tsx: /account only renders bare while there's no session).
//   signed out -- SIGN UP only. This page is where "Create an account" goes; signing IN happens on
//                 the login screen, which is what the whole app falls back to without a session.
//                 A sign-in tab here was a second front door to the same thing, defaulted to the
//                 wrong half for everyone who arrived by the only link that leads here, and left
//                 the page with no branding of its own.
export function AccountPanel() {
  const { data: session, isPending } = useSession();
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
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
            <LogOutButton />
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
      const result = await signUp.email({ name, username: username.trim(), email, password });
      if (result.error) {
        setError(result.error.message || "Something went wrong.");
        return;
      }
      // Deliberately a full load, not router.refresh(): AuthGate decides between the login screen
      // and the app shell once, on mount, from its own session check (see auth-gate.tsx). Without
      // this the new account would sit on a page rendered for a signed-out visitor -- which is
      // exactly how signing up used to leave you on /account with no navigation at all.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.href = "/account";
    } catch {
      setError("Couldn't reach the server.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-[360px]">
      {/* The page's own branding. A bare "Account" heading was the only thing at the top of this
          page, which read as a settings screen rather than as the front door it actually is. */}
      <Image
        src="/banner.png"
        alt="Survivor Fantasy Engine"
        width={1024}
        height={360}
        className="mx-auto mb-2 block h-auto max-w-full"
        priority
      />
      <div className="mb-4 rounded-lg border border-border bg-card p-[18px_20px] shadow-sm">
        <h3 className="mb-2.5 text-[0.7rem] font-bold uppercase tracking-wide text-muted-foreground">Create your account</h3>
        <form onSubmit={submit} className="flex flex-col gap-2">
          <Input
            className="w-full"
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            required
          />
          {/* Asked for here rather than left null: this app is username-first everywhere it shows a
              person (players, chat, the league switcher), and the login screen accepts a username.
              An account created without one could only ever sign in by email. */}
          <Input
            className="w-full"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            required
          />
          <Input
            className="w-full"
            placeholder="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
          <Input
            className="w-full"
            placeholder="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            minLength={8}
            required
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={loading}>
            {loading ? "Please wait…" : "Create account"}
          </Button>
        </form>
      </div>
      <p className="text-center text-xs text-muted-foreground">
        Already have an account?{" "}
        <Link href="/" className="font-semibold text-primary hover:underline">
          Log in
        </Link>
      </p>
    </div>
  );
}
