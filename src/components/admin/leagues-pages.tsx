"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import type { AdminLeague, AdminMembership, Player } from "@/lib/game/types";
import { useAdminStore } from "@/lib/admin-store";
import { BottomSheet, SheetAction } from "@/components/ui/bottom-sheet";
import { Chip, Field, MoreButton, PrimaryButton, fieldCls } from "@/components/setup/settings-ui";
import { PlainButton } from "@/components/draft/draft-ui";
import { AdminPage, Notice, Row, Rows, Section, count, errorText, shortDate } from "./admin-ui";
import { useAdminLists } from "./users-pages";
import { DangerZone } from "./season-setup";
import { cn } from "cn";

// Leagues (docs/PLAN-ux-redesign.md 3f): one row per league with its join code, and a page per league
// for its players and the accounts linked to them. Every league row used to carry a red Delete, and
// every player Change, Unlink and Delete side by side; those are in ⋯ sheets and a Danger zone now.

const PAGE = 25;

async function copyCode(code: string) {
  try {
    await navigator.clipboard.writeText(code);
    return true;
  } catch {
    return false;
  }
}

export function LeaguesPage() {
  useAdminLists();
  const router = useRouter();
  const { leagues, loaded, deleteLeague } = useAdminStore();
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(PAGE);
  const [menu, setMenu] = useState<AdminLeague | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const q = query.trim().toLowerCase();
  const matched = [...leagues]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .filter((l) => !q || l.name.toLowerCase().includes(q) || l.join_code.toLowerCase().includes(q));

  return (
    <AdminPage title="Leagues" subtitle={loaded ? `${count(leagues.length, "league")}, newest first` : undefined}>
      <label className="relative">
        <span className="sr-only">Search leagues</span>
        <Search className="pointer-events-none absolute left-3 top-1/2 size-[18px] -translate-y-1/2 text-muted-foreground" aria-hidden />
        <input className={cn(fieldCls, "pl-10")} type="search" placeholder="Search by name or code" value={query} onChange={(e) => setQuery(e.target.value)} />
      </label>
      {note && <Notice>{note}</Notice>}
      {!loaded ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : (
        <Rows>
          {matched.slice(0, limit).map((l) => (
            <Row
              key={l.id}
              href={`/admin/leagues/${l.id}`}
              title={<span className="truncate">{l.name}</span>}
              detail={`Code ${l.join_code} · created ${shortDate(l.created_at)}`}
              trailing={<MoreButton label={`${l.name}: actions`} onClick={() => setMenu(l)} />}
            />
          ))}
          {matched.length === 0 && <p className="py-4 text-muted-foreground">{leagues.length ? "Nothing matches that." : "No leagues yet."}</p>}
        </Rows>
      )}
      {matched.length > limit && (
        <button type="button" className="min-h-11 self-start text-[15px] font-semibold text-muted-foreground hover:text-foreground" onClick={() => setLimit((n) => n + PAGE)}>
          Show {Math.min(PAGE, matched.length - limit)} more
        </button>
      )}

      {menu && (
        <BottomSheet open onOpenChange={(o) => !o && setMenu(null)} title={menu.name} description={`Code ${menu.join_code}`}>
          <SheetAction onClick={() => router.push(`/admin/leagues/${menu.id}`)}>Players and accounts</SheetAction>
          <SheetAction
            onClick={async () => {
              const ok = await copyCode(menu.join_code);
              setMenu(null);
              setNote(ok ? `Copied ${menu.join_code}.` : `The code is ${menu.join_code}.`);
            }}
          >
            Copy join code
          </SheetAction>
          <SheetAction
            danger
            onClick={() => {
              setMenu(null);
              deleteLeague(menu.id, menu.name);
            }}
          >
            Delete league
          </SheetAction>
        </BottomSheet>
      )}
    </AdminPage>
  );
}

export function LeaguePage({ leagueId }: { leagueId: string }) {
  useAdminLists();
  const router = useRouter();
  const { leagues, users, loaded, membershipData, selectedLeagueId, selectLeague, unlinkMembership, deletePlayer, deleteLeague } = useAdminStore();
  const league = leagues.find((l) => l.id === leagueId);
  const [menu, setMenu] = useState<Player | null>(null);
  const [linking, setLinking] = useState<Player | null>(null);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    selectLeague(leagueId);
  }, [leagueId, selectLeague]);

  if (!loaded) return <p className="text-muted-foreground">Loading…</p>;
  if (!league) {
    return (
      <AdminPage title="League" back={{ href: "/admin/leagues", label: "Leagues" }}>
        <p className="text-muted-foreground">That league doesn&rsquo;t exist any more.</p>
      </AdminPage>
    );
  }
  const data = selectedLeagueId === leagueId ? membershipData : null;
  const membershipOf = (p: Player) => data?.memberships.find((m) => m.player_id === p.id);
  const active = data?.players.filter((p) => !p.disabled) ?? [];

  return (
    <AdminPage
      title={league.name}
      subtitle={`Code ${league.join_code} · created ${shortDate(league.created_at)}${data ? ` · ${count(active.length, "player")}` : ""}`}
      back={{ href: "/admin/leagues", label: "Leagues" }}
    >
      {note && <Notice>{note}</Notice>}
      <Section title="Players">
        {!data ? (
          <p className="text-muted-foreground">Loading…</p>
        ) : (
          <Rows>
            {data.players.map((p) => {
              const m = membershipOf(p);
              return (
                <Row
                  key={p.id}
                  dim={p.disabled}
                  title={
                    <>
                      <span className="truncate">{p.name}</span>
                      {m?.role === "commissioner" && <Chip>Commissioner</Chip>}
                    </>
                  }
                  detail={p.disabled ? "Removed from the league" : m ? `Signed in as ${m.username}` : "No account linked"}
                  trailing={!p.disabled || m ? <MoreButton label={`${p.name}: actions`} onClick={() => setMenu(p)} /> : undefined}
                />
              );
            })}
          </Rows>
        )}
        <p className="text-[13px] leading-snug text-muted-foreground">Each player is one seat, linked to at most one account. The commissioner&rsquo;s link has the commissioner role.</p>
      </Section>

      <DangerZone>
        <PlainButton
          danger
          className="self-start"
          onClick={async () => {
            await deleteLeague(league.id, league.name);
            if (!useAdminStore.getState().leagues.some((l) => l.id === league.id)) router.push("/admin/leagues");
          }}
        >
          Delete league
        </PlainButton>
        <p className="text-[13px] leading-snug text-muted-foreground">Deletes the league, its history and everyone&rsquo;s membership in it.</p>
      </DangerZone>

      {menu && (
        <BottomSheet open onOpenChange={(o) => !o && setMenu(null)} title={menu.name} description={membershipOf(menu)?.username}>
          {!menu.disabled && (
            <SheetAction
              onClick={() => {
                setLinking(menu);
                setMenu(null);
              }}
            >
              {membershipOf(menu) ? "Change account or role" : "Link an account"}
            </SheetAction>
          )}
          {membershipOf(menu) && (
            <SheetAction
              danger
              detail="Keeps the seat"
              onClick={() => {
                const m = membershipOf(menu)!;
                setMenu(null);
                unlinkMembership(m.id).then(() => setNote(`Unlinked ${m.username} from ${menu.name}.`));
              }}
            >
              Unlink account
            </SheetAction>
          )}
          {!menu.disabled && (
            <SheetAction
              danger
              onClick={() => {
                setMenu(null);
                deletePlayer(menu.id, menu.name);
              }}
            >
              Remove player
            </SheetAction>
          )}
        </BottomSheet>
      )}
      {linking && data && (
        <LinkSheet player={linking} existing={membershipOf(linking)} memberships={data.memberships} players={data.players} users={users} onClose={() => setLinking(null)} onDone={setNote} />
      )}
    </AdminPage>
  );
}

function LinkSheet({
  player,
  existing,
  memberships,
  players,
  users,
  onClose,
  onDone,
}: {
  player: Player;
  existing: AdminMembership | undefined;
  memberships: AdminMembership[];
  players: Player[];
  users: { id: string; username: string | null }[];
  onClose: () => void;
  onDone: (note: string) => void;
}) {
  const linkMembership = useAdminStore((s) => s.linkMembership);
  const [userId, setUserId] = useState(existing?.user_id ?? "");
  const [role, setRole] = useState<"member" | "commissioner">(existing?.role ?? "member");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sorted = [...users].sort((a, b) => (a.username ?? "").localeCompare(b.username ?? ""));

  async function save() {
    if (!userId) return;
    setBusy(true);
    setError(null);
    try {
      await linkMembership(player.id, userId, role);
      onDone(`${player.name} is linked to ${users.find((u) => u.id === userId)?.username ?? "that account"}.`);
      onClose();
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  }

  return (
    <BottomSheet open onOpenChange={(o) => !o && onClose()} title={existing ? "Change account" : "Link an account"} description={player.name}>
      <form
        className="flex flex-col gap-4 border-t border-border pt-4"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <Field label="Account" htmlFor="link-user">
          <select id="link-user" className={fieldCls} value={userId} onChange={(e) => setUserId(e.target.value)}>
            <option value="">Choose…</option>
            {sorted.map((u) => {
              // Someone already in this league on another seat moves to this one.
              const theirs = memberships.find((m) => m.user_id === u.id);
              const elsewhere = theirs && theirs.player_id !== player.id ? players.find((p) => p.id === theirs.player_id)?.name : null;
              return (
                <option key={u.id} value={u.id}>
                  {u.username}
                  {elsewhere ? ` (now ${elsewhere})` : ""}
                </option>
              );
            })}
          </select>
        </Field>
        <Field label="Role" htmlFor="link-role">
          <select id="link-role" className={fieldCls} value={role} onChange={(e) => setRole(e.target.value as "member" | "commissioner")}>
            <option value="member">Player</option>
            <option value="commissioner">Commissioner</option>
          </select>
        </Field>
        {error && <Notice tone="bad">{error}</Notice>}
        <PrimaryButton type="submit" disabled={busy || !userId}>
          Save
        </PrimaryButton>
      </form>
    </BottomSheet>
  );
}
