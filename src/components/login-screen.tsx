"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

// Port of renderLoginScreen() (public/app.js) -- exact structure: 360px-wide centered column,
// banner.png, a .panel box (h3 renders as small uppercase muted text via the global h3 rule,
// hence "LOG IN" rather than a normal heading), then a full-width secondary button below the
// panel for the demo entry point. The live app has no signup here at all (accounts are
// commissioner-created); this POC adds a link to /account below instead, since that's this app's
// own separate, forward-looking account system (src/lib/auth.ts) -- not a port of anything in
// the live app, so it's kept visually distinct rather than folded into this "Log in" panel.
export function LoginScreen({
  onLogin,
  onSkip,
  error,
  loading,
}: {
  onLogin: (username: string, password: string) => void;
  onSkip: () => void;
  error: string | null;
  loading: boolean;
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    onLogin(username, password);
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
          <input
            className="rounded-md border border-border bg-card px-2.5 py-[7px] text-[0.88rem]"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
          />
          <input
            className="rounded-md border border-border bg-card px-2.5 py-[7px] text-[0.88rem]"
            placeholder="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
          <button
            type="submit"
            disabled={loading}
            className="rounded-md bg-primary px-[15px] py-2 text-[0.85rem] font-semibold text-primary-foreground shadow-sm hover:brightness-[1.06] disabled:opacity-40"
          >
            {loading ? "Logging in…" : "Log In"}
          </button>
        </form>
      </div>
      <button
        className="w-full rounded-md border border-border bg-card px-[15px] py-2 text-[0.85rem] font-semibold text-foreground shadow-none hover:bg-secondary"
        onClick={onSkip}
      >
        🎬 Take a Tour (Preview a Mock Season)
      </button>
      <p className="mt-3 text-center text-xs text-muted-foreground">
        Building the future version of this app?{" "}
        <Link href="/account" className="font-semibold text-primary hover:underline">
          Create an account
        </Link>
      </p>
    </div>
  );
}
