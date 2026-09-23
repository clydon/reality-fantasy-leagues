"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// Port of renderLoginScreen() (public/app.js) -- exact structure: 360px-wide centered column,
// banner.png, a .panel box (h3 renders as small uppercase muted text via the global h3 rule,
// hence "LOG IN" rather than a normal heading), then a full-width secondary button below the
// panel for the demo entry point. Signs in via Better Auth now (src/lib/auth.ts), this app's own
// real account system since it got a standalone backend -- accepts either a username or an
// email (see auth-client.ts's signInWithIdentifier), not username-only like the live app's own
// login. "Create an account" links to /account, which is this app's real signup now too.
export function LoginScreen({
  onLogin,
  onSkip,
  error,
  loading,
}: {
  onLogin: (identifier: string, password: string) => void;
  onSkip: () => void;
  error: string | null;
  loading: boolean;
}) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    onLogin(identifier, password);
  }

  return (
    <div className="mx-auto mt-[60px] max-w-[360px] px-4">
      <Image
        src="/banner.png"
        alt="Survivor Fantasy Engine"
        width={1024}
        height={360}
        className="mx-auto mb-2 block h-auto max-w-full"
        priority
      />
      <div className="mb-4 rounded-lg border border-border bg-card p-[18px_20px] shadow-sm">
        <h3 className="mb-2.5 text-[0.7rem] font-bold uppercase tracking-wide text-muted-foreground">Log in</h3>
        {error && <p className="mb-2 text-sm text-destructive">{error}</p>}
        <form onSubmit={submit} className="flex flex-col gap-2">
          <Input
            placeholder="Username or email"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            autoComplete="username"
          />
          <Input
            placeholder="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
          <Button type="submit" disabled={loading}>
            {loading ? "Logging in…" : "Log In"}
          </Button>
        </form>
      </div>
      <Button variant="secondary" className="w-full" onClick={onSkip}>
        🎬 Take a Tour (Preview a Mock Season)
      </Button>
      <p className="mt-3 text-center text-xs text-muted-foreground">
        New here?{" "}
        <Link href="/account" className="font-semibold text-primary hover:underline">
          Create an account
        </Link>
      </p>
    </div>
  );
}
