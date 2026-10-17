"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search } from "lucide-react";
import type { AdminUser } from "@/lib/game/types";
import { api } from "@/lib/api";
import { useAdminStore } from "@/lib/admin-store";
import { useLeagueStore } from "@/lib/store";
import { realEmail } from "@/lib/no-email";
import { confirm } from "@/lib/confirm-store";
import { BottomSheet, SheetAction } from "@/components/ui/bottom-sheet";
import { Chip, Field, MoreButton, PrimaryButton, TextSheet, fieldCls } from "@/components/setup/settings-ui";
import { PlainButton } from "@/components/draft/draft-ui";
import { ActButton, AdminPage, CopyButton, Notice, Row, Rows, Section, count, errorText, shortDate, shortDateTime } from "./admin-ui";
import { DangerZone } from "./season-setup";
import { cn } from "cn";

// Users (docs/PLAN-ux-redesign.md 3f): the old table was cut off at 390px with Edit and Impersonate
// off-screen. Now each account is a row with its email and when it was last active, and everything
// else is behind its ⋯ or on its own page: profile, password, leagues, and Delete in a Danger zone.

const PAGE = 25;

type Sort = "name" | "newest" | "active";

function sortUsers(users: AdminUser[], sort: Sort): AdminUser[] {
  // Nulls (no username, never signed in) always sort last.
  const by = (a: string | null, b: string | null, dir: 1 | -1) => (a == null ? (b == null ? 0 : 1) : b == null ? -1 : dir * a.localeCompare(b, undefined, { sensitivity: "base" }));
  return [...users].sort((a, b) =>
    sort === "name" ? by(a.username, b.username, 1) : sort === "newest" ? by(a.createdAt, b.createdAt, -1) : by(a.lastLoginAt, b.lastLoginAt, -1),
  );
}

/** Loads the admin lists on first visit to any users or leagues page, and again on each return. */
export function useAdminLists() {
  const load = useAdminStore((s) => s.load);
  useEffect(() => {
    load();
  }, [load]);
}

/** A temp password, shown once: copy it and give it to them directly. */
export function TempPassword() {
  const temp = useAdminStore((s) => s.lastTempPassword);
  const dismiss = useAdminStore((s) => s.dismissTempPassword);
  if (!temp) return null;
  return (
    <div className="flex flex-col gap-2 rounded-[3px] bg-card px-4 py-3" role="status">
      <span className="text-sm text-muted-foreground">Temporary password for {temp.username}. Give it to them directly; it won&rsquo;t be shown again.</span>
      <code className="type-num text-[26px] tracking-wide">{temp.password}</code>
      <span className="flex gap-2">
        <CopyButton text={temp.password} label="Copy" tone="plain" />
        <ActButton onClick={dismiss}>Done</ActButton>
      </span>
    </div>
  );
}

export function UsersPage() {
  useAdminLists();
  const router = useRouter();
  const { users, loaded, createUser, impersonateUser, approveUser } = useAdminStore();
  const myUserId = useLeagueStore((s) => s.userId);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("name");
  const [limit, setLimit] = useState(PAGE);
  const [menu, setMenu] = useState<AdminUser | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const q = query.trim().toLowerCase();
  const matched = sortUsers(users, sort).filter((u) => !q || (u.username ?? "").toLowerCase().includes(q) || (realEmail(u.email) ?? "").toLowerCase().includes(q));
  const label = (u: AdminUser) => u.username || realEmail(u.email) || "this user";

  return (
    <AdminPage title="Users" subtitle={loaded ? count(users.length, "account") : undefined}>
      <div className="flex flex-wrap gap-2">
        <label className="relative min-w-[200px] flex-1">
          <span className="sr-only">Search users</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-[18px] -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input className={cn(fieldCls, "pl-10")} type="search" placeholder="Search" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        <select aria-label="Sort" className={cn(fieldCls, "w-auto")} value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
          <option value="name">By name</option>
          <option value="active">Last active</option>
          <option value="newest">Newest</option>
        </select>
        <ActButton onClick={() => setCreating(true)} className="min-h-12">
          <Plus className="size-5" strokeWidth={2.4} aria-hidden />
          Create
        </ActButton>
      </div>
      <TempPassword />
      {error && <Notice tone="bad">{error}</Notice>}

      {!loaded ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : (
        <Rows>
          {matched.slice(0, limit).map((u) => (
            <Row
              key={u.id}
              href={`/admin/users/${u.id}`}
              title={
                <>
                  <span className="truncate">{u.username || <span className="font-normal italic text-muted-foreground">no username</span>}</span>
                  {u.isSuperAdmin && <Chip>Admin</Chip>}
                  {u.id === myUserId && <Chip>You</Chip>}
                  {!u.approved && <Chip>Pending</Chip>}
                </>
              }
              detail={
                <span className="block truncate">
                  {realEmail(u.email) ?? "No email"} · {u.lastLoginAt ? `active ${shortDateTime(u.lastLoginAt)}` : "never signed in"}
                </span>
              }
              trailing={<MoreButton label={`${label(u)}: actions`} onClick={() => setMenu(u)} />}
            />
          ))}
          {matched.length === 0 && <p className="py-4 text-muted-foreground">Nobody matches that.</p>}
        </Rows>
      )}
      {matched.length > limit && (
        <button type="button" className="min-h-11 self-start text-[15px] font-semibold text-muted-foreground hover:text-foreground" onClick={() => setLimit((l) => l + PAGE)}>
          Show {Math.min(PAGE, matched.length - limit)} more
        </button>
      )}

      {menu && (
        <BottomSheet open onOpenChange={(o) => !o && setMenu(null)} title={label(menu)} description={realEmail(menu.email) ?? undefined}>
          {!menu.approved && (
            <SheetAction
              onClick={() => {
                setMenu(null);
                approveUser(menu.id).catch((e) => setError(errorText(e, "Couldn't approve that account.")));
              }}
              detail="Gives them access to the app on their next login"
            >
              Approve
            </SheetAction>
          )}
          <SheetAction onClick={() => router.push(`/admin/users/${menu.id}`)}>Edit</SheetAction>
          {menu.id !== myUserId && (
            <SheetAction
              onClick={() => {
                setMenu(null);
                impersonateUser(menu.id, label(menu));
              }}
              detail="See the app as they do"
            >
              Impersonate
            </SheetAction>
          )}
        </BottomSheet>
      )}
      {creating && (
        <TextSheet
          title="Create user"
          label="Username"
          help="They get a temporary password to sign in with, shown once here."
          submit="Create"
          onClose={() => setCreating(false)}
          onSubmit={async (username) => {
            setCreating(false);
            setError(null);
            try {
              await createUser(username);
            } catch (e) {
              setError(errorText(e, "Couldn't create that user."));
            }
          }}
        />
      )}
    </AdminPage>
  );
}

type UserLeague = Awaited<ReturnType<typeof api.adminUserLeagues>>["leagues"][number];

export function UserPage({ userId }: { userId: string }) {
  useAdminLists();
  const router = useRouter();
  const { users, loaded, updateUser, resetPassword, deleteUser, impersonateUser, approveUser } = useAdminStore();
  const myUserId = useLeagueStore((s) => s.userId);
  const user = users.find((u) => u.id === userId);
  const [leagues, setLeagues] = useState<UserLeague[] | null>(null);
  const [menu, setMenu] = useState(false);
  const [leagueMenu, setLeagueMenu] = useState<UserLeague | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .adminUserLeagues(userId)
      .then((r) => !cancelled && setLeagues(r.leagues))
      .catch(() => !cancelled && setLeagues([]));
    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (!loaded) return <p className="text-muted-foreground">Loading…</p>;
  if (!user) {
    return (
      <AdminPage title="User" back={{ href: "/admin/users", label: "Users" }}>
        <p className="text-muted-foreground">That account doesn&rsquo;t exist any more.</p>
      </AdminPage>
    );
  }
  const label = user.username || realEmail(user.email) || "this user";
  const isSelf = user.id === myUserId;

  async function reloadLeagues() {
    setLeagues((await api.adminUserLeagues(userId)).leagues);
  }

  async function leagueAction(fn: () => Promise<unknown>, done: string) {
    setLeagueMenu(null);
    setError(null);
    setNote(null);
    try {
      await fn();
      await reloadLeagues();
      setNote(done);
    } catch (e) {
      setError(errorText(e));
    }
  }

  return (
    <AdminPage
      title={label}
      subtitle={[user.isSuperAdmin && "Site admin", `joined ${shortDate(user.createdAt)}`, user.lastLoginAt ? `active ${shortDateTime(user.lastLoginAt)}` : "never signed in"].filter(Boolean).join(" · ")}
      back={{ href: "/admin/users", label: "Users" }}
      actions={isSelf ? undefined : { label: "Account actions", onClick: () => setMenu(true) }}
    >
      {error && <Notice tone="bad">{error}</Notice>}
      {note && <Notice>{note}</Notice>}

      {!user.approved && (
        <Notice tone="bad">
          Pending early access approval.{" "}
          <button
            type="button"
            className="font-semibold underline"
            onClick={() => approveUser(user.id).catch((e) => setError(errorText(e, "Couldn't approve that account.")))}
          >
            Approve now
          </button>
        </Notice>
      )}

      <Profile key={user.id} user={user} onSave={(changes) => updateUser(user.id, changes)} />

      <Section title="Password">
        <TempPassword />
        <PlainButton
          className="self-start"
          onClick={async () => {
            if (await confirm(`Reset ${label}'s password? Their current one stops working.`, { confirmLabel: "Reset" })) resetPassword(user.id, label);
          }}
        >
          Reset password
        </PlainButton>
        <p className="text-[13px] leading-snug text-muted-foreground">Makes a temporary password for them to sign in with. Their old one stops working.</p>
      </Section>

      <Section title="Leagues">
        {leagues === null ? (
          <p className="text-muted-foreground">Loading…</p>
        ) : leagues.length === 0 ? (
          <p className="text-muted-foreground">Not in any league.</p>
        ) : (
          <Rows>
            {leagues.map((l) => (
              <Row
                key={l.membership_id}
                href={`/admin/leagues/${l.id}`}
                title={<span className="truncate">{l.name}</span>}
                detail={l.role === "commissioner" ? "Commissioner" : "Player"}
                trailing={<MoreButton label={`${l.name}: actions`} onClick={() => setLeagueMenu(l)} />}
              />
            ))}
          </Rows>
        )}
      </Section>

      {!isSelf && (
        <DangerZone>
          <PlainButton
            danger
            className="self-start"
            onClick={async () => {
              if (await deleteUser(user.id, label)) router.push("/admin/users");
            }}
          >
            Delete account
          </PlainButton>
          <p className="text-[13px] leading-snug text-muted-foreground">Their player seats stay in their leagues, no longer tied to an account.</p>
        </DangerZone>
      )}

      <BottomSheet open={menu} onOpenChange={setMenu} title={label}>
        <SheetAction
          onClick={() => {
            setMenu(false);
            impersonateUser(user.id, label);
          }}
          detail="See the app as they do"
        >
          Impersonate
        </SheetAction>
      </BottomSheet>

      {leagueMenu && (
        <BottomSheet open onOpenChange={(o) => !o && setLeagueMenu(null)} title={leagueMenu.name} description={leagueMenu.role === "commissioner" ? "Commissioner" : "Player"}>
          <SheetAction
            onClick={() => {
              const role = leagueMenu.role === "commissioner" ? "member" : "commissioner";
              leagueAction(() => api.adminLinkMembership(leagueMenu.id, user.id, leagueMenu.player_id, role), role === "commissioner" ? "Made commissioner." : "Now a player.");
            }}
          >
            {leagueMenu.role === "commissioner" ? "Make a player" : "Make commissioner"}
          </SheetAction>
          <SheetAction
            danger
            onClick={() => leagueAction(() => api.adminUnlinkMembership(leagueMenu.id, leagueMenu.membership_id), `Unlinked from ${leagueMenu.name}. Their seat stays in the league.`)}
            detail="Keeps their seat"
          >
            Unlink from league
          </SheetAction>
        </BottomSheet>
      )}
    </AdminPage>
  );
}

function Profile({ user, onSave }: { user: AdminUser; onSave: (changes: { username?: string; email?: string }) => Promise<void> }) {
  const shownEmail = realEmail(user.email) ?? "";
  const [username, setUsername] = useState(user.username ?? "");
  const [email, setEmail] = useState(shownEmail);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dirty = username.trim() !== (user.username ?? "") || email.trim() !== shownEmail;

  async function save() {
    const changes: { username?: string; email?: string } = {};
    if (username.trim() && username.trim() !== (user.username ?? "")) changes.username = username.trim();
    if (email.trim() && email.trim() !== shownEmail) changes.email = email.trim();
    if (!Object.keys(changes).length) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await onSave(changes);
      setSaved(true);
    } catch (e) {
      setError(errorText(e, "Couldn't save those changes."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Section title="Profile">
      <form
        className="flex flex-col gap-5"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <Field label="Username" htmlFor="user-name">
          <input id="user-name" className={fieldCls} value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="off" />
        </Field>
        <Field label="Email" htmlFor="user-email">
          <input id="user-email" type="email" className={fieldCls} value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" />
        </Field>
        {error && <Notice tone="bad">{error}</Notice>}
        <span className="flex items-center gap-3">
          <PrimaryButton type="submit" disabled={saving || !dirty}>
            {saving ? "Saving…" : "Save profile"}
          </PrimaryButton>
          {saved && !dirty && <Notice>Saved.</Notice>}
        </span>
      </form>
    </Section>
  );
}
