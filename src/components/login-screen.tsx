"use client";

import Link from "next/link";
import { useState } from "react";
import { Play } from "lucide-react";
import { cn } from "cn";
import { Field, FORM_ERROR_ID, FormError, FrontDoor, SubmitButton } from "@/components/auth/front-door";
import { ShowRoll, ShowRollArt, useShowRoll } from "@/components/auth/show-roll";
import { SignUpForm } from "@/components/auth/sign-up-form";

// The front door: what the whole app falls back to without a session. One screen for signing in and
// creating an account, switched in place. It opens on Sign in at "/" and on Create account at
// /account, which is where every "Create an account" link goes -- an earlier sign-in tab on /account
// opened on the wrong half for exactly those visitors. Signs in via Better Auth (src/lib/auth.ts)
// with a username or an email (auth-client.ts's signInWithIdentifier); AuthGate owns the sign-in
// itself, since it loads the first league after. "Take the tour" is AuthGate's onSkip.
type Mode = "signin" | "signup";

export function LoginScreen({
  onLogin,
  onSkip,
  error,
  loading,
  initialMode = "signin",
}: {
  onLogin: (identifier: string, password: string) => void;
  onSkip: () => void;
  error: string | null;
  loading: boolean;
  initialMode?: Mode;
}) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const show = useShowRoll();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    onLogin(identifier, password);
  }

  // Tabs pattern: only the chosen tab is in the tab order; arrow keys move between the two.
  function onTabKey(e: React.KeyboardEvent) {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const next: Mode = mode === "signin" ? "signup" : "signin";
    setMode(next);
    document.getElementById(`door-tab-${next}`)?.focus();
  }

  const invalid = error ? { "aria-invalid": true, "aria-describedby": FORM_ERROR_ID } : {};

  return (
    <FrontDoor
      backdrop={<ShowRollArt name={show} />}
      aside={
        <button
          type="button"
          onClick={onSkip}
          className="flex h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[6px] border border-border px-3 text-sm font-semibold text-foreground transition-colors hover:bg-secondary focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-chyron-line"
        >
          <Play className="size-3.5 fill-current" aria-hidden />
          {/* "Tour" alone on the narrowest phones, so it never wraps beside the wordmark. */}
          <span className="max-[359px]:hidden">Take the tour</span>
          <span className="min-[360px]:hidden">Tour</span>
        </button>
      }
      title={
        <>
          <ShowRoll name={show} />
          <p className="mt-5 max-w-[34ch] text-base text-muted-foreground">
            Draft the cast with your group, score what happens each week, and see results only when you&rsquo;ve
            watched.
          </p>
        </>
      }
    >
      <div role="tablist" aria-label="Sign in or create an account" className="mb-5 flex rounded-[3px] bg-background p-[3px]">
        {(
          [
            ["signin", "Sign in"],
            ["signup", "Create account"],
          ] as const
        ).map(([v, label]) => (
          <button
            key={v}
            type="button"
            role="tab"
            id={`door-tab-${v}`}
            aria-selected={mode === v}
            aria-controls="door-panel"
            tabIndex={mode === v ? 0 : -1}
            onClick={() => setMode(v)}
            onKeyDown={onTabKey}
            className={cn(
              "min-h-11 flex-1 rounded-[2px] text-[15px] font-semibold focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-chyron-line",
              mode === v ? "bg-foreground font-bold text-background" : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div id="door-panel" role="tabpanel" aria-labelledby={`door-tab-${mode}`}>
        {mode === "signin" ? (
          <form onSubmit={submit}>
            <div className="flex flex-col gap-3.5">
              <Field
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
                label="Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                {...invalid}
                labelAside={
                  <Link href="/forgot-password" className="text-[13px] font-semibold text-chyron-line underline-offset-2 hover:underline">
                    Forgot password?
                  </Link>
                }
              />
            </div>
            {error && <FormError>{error}</FormError>}
            <SubmitButton disabled={loading}>{loading ? "Signing in…" : "Sign in"}</SubmitButton>
          </form>
        ) : (
          <SignUpForm />
        )}
      </div>
    </FrontDoor>
  );
}
