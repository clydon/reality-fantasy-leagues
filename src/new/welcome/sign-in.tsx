"use client";

import { useState } from "react";
import { ChevronLeft } from "lucide-react";
import { api } from "@/lib/api";
import { logOutTo, requestPasswordReset, signInWithIdentifier } from "@/lib/auth-client";
import type { WayIn } from "@/lib/server/way-in";
import { NavLink, useNav } from "../nav";
import { paths, safeNext } from "../routes";
import { Wordmark } from "../ui/bars";
import { Btn } from "../ui/parts";
import { Sheet } from "../ui/sheet";
import { authError, Field, GoogleButton, OrLine } from "./account";

// Signing in (/signin, docs/PLAN-new-design.md step 9 part 2; the mock's landing.js signinRoute): Continue with Google
// when it's set up, else a username or email and a password (Better Auth; auth-client.ts picks the endpoint), Forgot
// password (Better Auth's reset email when the server can send one, resetBy()), and Start free. Then on to `next`, or to
// the design the account opens on (GET /api/me says which, and sets this device's cookie for it).

export function SignInScreen({ way, next, error }: { way: WayIn; next: string | null; error: string | null }) {
  const nav = useNav();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [problem, setProblem] = useState<string | null>(error ? "Couldn't sign in with Google. Try again, or use your username." : null);
  const [busy, setBusy] = useState(false);
  const [forgot, setForgot] = useState(false);
  const to = safeNext(next);
  const invalid = problem ? { "aria-invalid": true, "aria-describedby": "signin-error" } : {};

  async function arrive() {
    // Which design this account opens on, and whether it's been let in yet (early access).
    const me = await api.me().catch(() => null);
    const dest = to ?? (me && !me.user.approved ? paths.start(4) : me?.user.ui === "new" ? paths.home : "/");
    // A full load: each design reads who's signed in for itself.
    window.location.assign(dest);
  }

  return (
    <div className="flex min-h-dvh flex-col px-4 pb-10" data-signin>
      <header className="-mx-1.5 flex h-14 items-center justify-between pt-[env(safe-area-inset-top,0px)]">
        <button type="button" aria-label="Back" onClick={() => nav.back(paths.welcome)} className="grid size-11 place-items-center rounded-[3px]">
          <ChevronLeft className="size-5" aria-hidden />
        </button>
        <NavLink href={paths.welcome} aria-label="Game Your Show" className="pr-1.5">
          <Wordmark />
        </NavLink>
      </header>
      <h1 className="type-caption mt-3 text-[46px] leading-[.9]">
        Welcome
        <br />
        back
      </h1>
      <p className="mt-2.5 text-[15px] leading-[1.45] text-muted-foreground">Your couch is waiting.</p>
      {way.me ? (
        <div className="mt-6 flex flex-col gap-2.5" data-signed-in>
          <p className="text-[15px] leading-snug">
            You&rsquo;re signed in as <b>{way.me.name}</b>.
          </p>
          <Btn tone="ink" wide onClick={() => arrive()}>
            Open the app
          </Btn>
          <Btn wide onClick={() => logOutTo(paths.signin(next ?? undefined))}>
            Sign in as someone else
          </Btn>
        </div>
      ) : (
        <div className="mt-6 flex flex-col gap-2.5">
          {way.google && (
            <>
              <GoogleButton callbackURL={to ?? "/"} newUserCallbackURL={paths.start(1)} errorCallbackURL={`${paths.signin(next ?? undefined)}${next ? "&" : "?"}error=google`} />
              <OrLine>or</OrLine>
            </>
          )}
          <form
            className="flex flex-col gap-3"
            onSubmit={async (e) => {
              e.preventDefault();
              if (busy) return;
              setBusy(true);
              setProblem(null);
              try {
                const r = await signInWithIdentifier(identifier.trim(), password);
                if (r.error) {
                  setProblem(authError(r.error, "Couldn't sign in. Try again."));
                  setBusy(false);
                  return;
                }
                await arrive();
              } catch {
                setProblem("Couldn't reach the server. Try again.");
                setBusy(false);
              }
            }}
          >
            <Field
              id="signin-identifier"
              label="Username or email"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              required
              {...invalid}
            />
            <Field
              id="signin-password"
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              {...invalid}
              aside={
                <button type="button" data-forgot onClick={() => setForgot(true)} className="text-[13px] font-semibold text-muted-foreground underline-offset-2 hover:underline">
                  Forgot password?
                </button>
              }
            />
            {problem && (
              <p id="signin-error" role="alert" className="text-[14px] font-semibold text-live">
                {problem}
              </p>
            )}
            <Btn type="submit" tone="must" wide className="type-caption mt-1 h-14 text-[20px]" disabled={busy}>
              {busy ? "Signing in…" : "Sign in"}
            </Btn>
          </form>
          <p className="mt-1 text-center text-[13px] leading-normal text-muted-foreground">
            New here?{" "}
            <NavLink href={paths.start(1)} className="font-bold text-foreground underline underline-offset-[3px]">
              Start free
            </NavLink>
          </p>
        </div>
      )}
      <ForgotSheet open={forgot} onOpenChange={setForgot} reset={way.reset} />
    </div>
  );
}

/** Forgot password: Better Auth's reset email, when this server can send one; otherwise, plainly, who can help. */
function ForgotSheet({ open, onOpenChange, reset }: { open: boolean; onOpenChange: (o: boolean) => void; reset: WayIn["reset"] }) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Reset your password" subtitle={reset === "off" ? "By email, once it's set up" : "We'll email you a link"}>
      <div className="flex flex-col gap-3" data-forgot-sheet={reset}>
        {reset === "off" ? (
          <p className="text-[15px] leading-snug" data-reset-off>
            Password resets go by email, and this server can&rsquo;t send email yet. Ask the site admin for a temporary password.
          </p>
        ) : sent ? (
          <p className="text-[15px] leading-snug" role="status" data-reset-sent>
            If an account uses <b className="break-all">{sent}</b>, a link to set a new password is on its way. It can take a minute or two.
            {reset === "console" && <span className="mt-2 block text-[13px] text-muted-foreground">Local dev, with no email set up: the link is in the server&rsquo;s console.</span>}
          </p>
        ) : (
          <form
            className="flex flex-col gap-3"
            onSubmit={async (e) => {
              e.preventDefault();
              if (busy || !email.trim()) return;
              setBusy(true);
              // The same answer whether or not the email has an account (Better Auth says nothing either way).
              await requestPasswordReset({ email: email.trim(), redirectTo: "/reset-password" }).catch(() => null);
              setBusy(false);
              setSent(email.trim());
            }}
          >
            <Field id="reset-email" label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" placeholder="you@example.com" required />
            <Btn type="submit" tone="must" wide disabled={busy || !email.trim()}>
              {busy ? "Sending…" : "Send the link"}
            </Btn>
          </form>
        )}
        <p className="text-[13px] leading-snug text-muted-foreground">Made your account with only a username? There&rsquo;s no email to send to: ask the site admin for a temporary password.</p>
        {sent && (
          <Btn wide onClick={() => onOpenChange(false)}>
            Done
          </Btn>
        )}
      </div>
    </Sheet>
  );
}
