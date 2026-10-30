"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ImagePlus, Trash2 } from "lucide-react";
import { changePassword } from "@/lib/auth-client";
import { colourOf, PALETTE, pictureUrl } from "@/lib/people";
import { profileApi, useAfterProfile, useProfile, type Profile } from "../data";
import { gameColour, HOW_EACH_GAME, type GameName } from "../games";
import { useMe } from "../session";
import { Btn, Chip } from "../ui/parts";
import { Sheet } from "../ui/sheet";
import { toast } from "../ui/toast";
import { Field } from "../welcome/account";

// Settings' sheets (docs/PLAN-new-design.md step 15 part 1; the mock's settings.js and its profile's Edit): your profile (your
// name, colour and picture), Change password, Report a problem, How each game works.

/** Your face as the profile has it: your picture, else your initial on your colour. */
function BigFace({ me, p, size }: { me: { id: string; name: string }; p: Profile | undefined; size: number }) {
  const name = p?.name ?? me.name;
  return (
    <span
      data-profile-face={p?.picture != null ? "picture" : "initial"}
      className="type-num relative grid flex-none place-items-center overflow-hidden rounded-[4px] text-[#121018]"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.46), background: colourOf(me.id, p?.colour) }}
      aria-hidden
    >
      {name.slice(0, 1).toUpperCase()}
      {p?.picture != null && (
        // eslint-disable-next-line @next/next/no-img-element -- your own small picture, kept by the browser (?v=)
        <img src={pictureUrl(me.id, p.picture)} alt="" className="absolute inset-0 size-full object-cover" />
      )}
    </span>
  );
}

/** A picture made small in the browser: the middle square, 256 by 256, as a JPEG (~10-30 KB). */
async function squarePicture(file: File): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    if (!side) throw new Error("Couldn't read that picture. Try another.");
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 256;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Couldn't read that picture. Try another.");
    ctx.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, 256, 256);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't read that picture. Try another."))), "image/jpeg", 0.85)
    );
  } catch (e) {
    throw e instanceof Error && e.message.startsWith("Couldn't") ? e : new Error("Couldn't read that picture. Try another.");
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Edit your profile (the mock's me card's Edit): your name (your username: the name your couch sees, and how you sign in),
 * your colour and your picture. The colour and the picture save as you choose them; the name saves with its button, since
 * it's checked (taken, too short) and renames your seat in every game you play.
 */
export function ProfileSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const me = useMe();
  const { data: p } = useProfile(open);
  const after = useAfterProfile();
  const router = useRouter();
  const [draft, setDraft] = useState<string | null>(null);
  const [busy, setBusy] = useState<"name" | "colour" | "picture" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const name = draft ?? p?.name ?? "";
  const changed = !!p && name.trim().toLowerCase() !== p.name;

  const saveName = async () => {
    setBusy("name");
    setError(null);
    try {
      const out = await profileApi.save({ name: name.trim() });
      await after(out);
      setDraft(null);
      // The signed-in layout says your name too (the hub's top, the profile sheet's title).
      router.refresh();
      toast(`Saved: your couch sees you as ${out.name}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const pickColour = async (hex: string) => {
    if (!p || busy) return;
    const was = p.colour;
    setBusy("colour");
    try {
      await after(await profileApi.save({ colour: hex }));
      toast("Saved: your colour", {
        undo: async () => {
          await after(await profileApi.save({ colour: was }));
        },
      });
    } catch (e) {
      toast.quiet((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const choosePicture = async (f: File | undefined) => {
    if (!f) return;
    setBusy("picture");
    setError(null);
    try {
      await profileApi.picture(await squarePicture(f));
      await after();
      toast("Saved: your picture");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
      if (file.current) file.current.value = "";
    }
  };

  const removePicture = async () => {
    setBusy("picture");
    try {
      await profileApi.removePicture();
      await after();
      toast("Picture removed: your initial's back");
    } catch (e) {
      toast.quiet((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const chosen = p ? colourOf(me.id, p.colour) : null;
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Your profile" subtitle="What your couch sees of you">
      <div data-profile-sheet className="flex flex-col">
        <div className="flex items-center gap-4">
          <BigFace me={me} p={p} size={88} />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <input ref={file} type="file" accept="image/*" className="sr-only" data-picture-input onChange={(e) => choosePicture(e.target.files?.[0])} tabIndex={-1} aria-hidden />
            <Btn className="h-11 justify-start" data-picture-choose disabled={!p || busy === "picture"} onClick={() => file.current?.click()}>
              <ImagePlus className="size-5" aria-hidden />
              {busy === "picture" ? "Saving…" : p?.picture != null ? "Change picture" : "Add a picture"}
            </Btn>
            {p?.picture != null && (
              <button type="button" data-picture-remove disabled={busy === "picture"} onClick={removePicture} className="flex h-9 items-center gap-2 text-[14px] font-semibold text-muted-foreground">
                <Trash2 className="size-4" aria-hidden />
                Remove it
              </button>
            )}
          </div>
        </div>

        <div className="mt-5">
          <Field
            id="profile-name"
            label="Your name"
            hint="(the name your couch sees, and how you sign in)"
            value={name}
            onChange={(e) => {
              setDraft(e.target.value);
              setError(null);
            }}
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            maxLength={30}
            aria-invalid={error ? true : undefined}
            disabled={!p}
          />
          {error && (
            <p role="alert" data-profile-error className="mt-2 text-[13px] font-semibold text-destructive">
              {error}
            </p>
          )}
          {changed && (
            <Btn tone="ink" wide className="mt-3" data-profile-save disabled={busy === "name" || !name.trim()} onClick={saveName}>
              {busy === "name" ? "Saving…" : "Save your name"}
            </Btn>
          )}
          <p className="mt-2 text-[12px] leading-snug text-muted-foreground">Letters, numbers, underscores or dots. Your seat in every game you play takes it too.</p>
        </div>

        <p className="mt-5 text-[14px] font-semibold">Your colour</p>
        <p className="mb-2 text-[12px] leading-snug text-muted-foreground">{p?.picture != null ? "Behind your initial wherever your picture's too small to show" : "Behind your initial, everywhere your face shows"}</p>
        <div role="radiogroup" aria-label="Your colour" className="grid grid-cols-8 gap-2">
          {PALETTE.map((c) => {
            const on = chosen === c.hex;
            return (
              <button
                key={c.hex}
                type="button"
                role="radio"
                aria-checked={on}
                aria-label={c.name}
                data-colour={c.hex}
                disabled={!p || busy === "colour"}
                onClick={() => !on && pickColour(c.hex)}
                className={`grid aspect-square place-items-center rounded-[3px] text-[#121018] ${on ? "outline-2 outline-offset-2 outline-foreground" : ""}`}
                style={{ background: c.hex }}
              >
                {on && <Check className="size-4" strokeWidth={3} aria-hidden />}
              </button>
            );
          })}
        </div>
      </div>
    </Sheet>
  );
}

/** Change password: the one you have, then the new one twice (Better Auth's changePassword; other phones stay signed in). */
export function PasswordSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const close = (o: boolean) => {
    if (!o) {
      setCurrent("");
      setNext("");
      setAgain("");
      setError(null);
    }
    onOpenChange(o);
  };
  const save = async () => {
    setError(null);
    if (next.length < 8) return setError("Make the new password at least 8 characters.");
    if (next !== again) return setError("The two new passwords don't match.");
    setBusy(true);
    try {
      const r = await changePassword({ currentPassword: current, newPassword: next });
      if (r.error) setError(r.error.code === "INVALID_PASSWORD" ? "That isn't your password now." : r.error.message || "Couldn't change it. Try again.");
      else {
        close(false);
        toast("Password changed");
      }
    } catch {
      setError("Couldn't reach the server. Try again.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet open={open} onOpenChange={close} title="Change password" subtitle="At least 8 characters">
      <form
        data-password-sheet
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <Field id="pw-current" label="Your password now" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
        <Field id="pw-next" label="New password" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
        <Field id="pw-again" label="New password again" type="password" autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} />
        {error && (
          <p role="alert" className="text-[13px] font-semibold text-destructive">
            {error}
          </p>
        )}
        <Btn type="submit" tone="ink" wide disabled={busy || !current || !next || !again}>
          {busy ? "Saving…" : "Change password"}
        </Btn>
      </form>
    </Sheet>
  );
}

/** Report a problem (the mock's Help; classic's report form): a problem or an idea, in your words, straight to us. */
export function ReportSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [type, setType] = useState<"issue" | "feature">("issue");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const send = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type, message: text.trim(), route: window.location.pathname, leagueId: null, leagueName: null, installed: window.matchMedia("(display-mode: standalone)").matches }),
      });
      if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error || "Couldn't send it. Try again.");
      setText("");
      onOpenChange(false);
      toast("Sent. Thanks: we read every one");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Report a problem" subtitle="Goes straight to us">
      <div data-report-sheet className="flex flex-col gap-3">
        <div className="flex gap-2">
          <Chip on={type === "issue"} data-report-type="issue" onClick={() => setType("issue")}>
            Something&apos;s wrong
          </Chip>
          <Chip on={type === "feature"} data-report-type="feature" onClick={() => setType("feature")}>
            An idea
          </Chip>
        </div>
        <label className="block">
          <span className="sr-only">What happened</span>
          <textarea
            data-report-text
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={5}
            maxLength={4000}
            placeholder={type === "issue" ? "What happened, and where?" : "What would make it better?"}
            className="block w-full resize-y rounded-[3px] bg-background p-3 text-[16px] leading-snug outline-1 -outline-offset-1 outline-input placeholder:text-muted-foreground focus:outline-2 focus:outline-foreground"
          />
        </label>
        {error && (
          <p role="alert" className="text-[13px] font-semibold text-destructive">
            {error}
          </p>
        )}
        <Btn tone="ink" wide data-report-send disabled={busy || !text.trim()} onClick={send}>
          {busy ? "Sending…" : "Send it"}
        </Btn>
      </div>
    </Sheet>
  );
}

/** How each game works, in plain words (the mock's rulesSheet): every season game, a few lines each. */
export function GamesSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="How each game works" subtitle="Each game's own rules are on its show's Games tab">
      <div data-games-help className="flex flex-col gap-5">
        {(Object.keys(HOW_EACH_GAME) as GameName[]).map((g) => (
          <section key={g} data-game-help={g}>
            <h3 className="flex items-center gap-2.5">
              <i className="size-3 flex-none rounded-full" style={{ background: gameColour(g) }} aria-hidden />
              <b className="type-caption text-[22px]">{g}</b>
            </h3>
            <ol className="mt-1.5 flex flex-col gap-1.5 pl-[22px]">
              {HOW_EACH_GAME[g].map((line, i) => (
                <li key={i} className="list-decimal text-[14px] leading-snug text-muted-foreground marker:text-foreground">
                  {line}
                </li>
              ))}
            </ol>
          </section>
        ))}
      </div>
    </Sheet>
  );
}
