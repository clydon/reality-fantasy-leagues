"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import type { StoredFormatSummary } from "@/lib/game/types";
import { api } from "@/lib/api";
import { confirm } from "@/lib/confirm-store";
import { formatFor } from "@/lib/game/formats/index.js";
import { BottomSheet, SheetAction } from "@/components/ui/bottom-sheet";
import { Chip, MoreButton } from "@/components/setup/settings-ui";
import { ActButton, AdminPage, Notice, Row, Rows, Section, count, errorText, useAdminShows } from "./admin-ui";
import { FormatRulesView } from "./format-rules-view";
import { FormatReviewScreen } from "./format-review-screen";

// Formats & rules (docs/PLAN-ux-redesign.md 3e): every set of rules a show can play by. The built-in ones
// (Survivor, The Traitors...) are code, so they're read only here; researched ones are admin-owned data
// with a draft -> approved life and a real editor (format-review-screen.tsx, the canvas's
// Admin-ShowReview), opened as their own page.

export function FormatsPage() {
  const router = useRouter();
  const shows = useAdminShows();
  const formats = useQuery({
    queryKey: ["admin-formats"],
    queryFn: () => api.adminListFormats(),
  });
  const [menu, setMenu] = useState<StoredFormatSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const builtIns = (shows.data?.formatOptions ?? []).filter((o) => !o.stored);
  const usedBy = (id: string) => shows.data?.shows.filter((s) => s.format === id).length ?? 0;
  const researched = [...(formats.data?.formats ?? [])].sort((a, b) => (a.status === b.status ? a.name.localeCompare(b.name) : a.status === "draft" ? -1 : 1));

  async function remove(f: StoredFormatSummary) {
    setMenu(null);
    const ok = await confirm(`Delete ${f.name}? This can't be undone.`, {
      danger: true,
      confirmLabel: "Delete",
    });
    if (!ok) return;
    setError(null);
    try {
      await api.adminDeleteFormat(f.id);
      await formats.refetch();
    } catch (e) {
      setError(errorText(e));
    }
  }

  return (
    <AdminPage title="Formats & rules" back={{ href: "/admin/shows", label: "Shows" }}>
      <ActButton href="/admin/shows/new" className="min-h-12 self-start">
        <Plus className="size-5" strokeWidth={2.4} aria-hidden />
        Research a new show
      </ActButton>
      {error && <Notice tone="bad">{error}</Notice>}
      <Section title="Researched">
        {formats.isLoading ? (
          <p className="text-muted-foreground">Loading…</p>
        ) : researched.length === 0 ? (
          <p className="text-muted-foreground">None yet. Research a show nobody&rsquo;s written rules for, and it shows up here to review.</p>
        ) : (
          <Rows>
            {researched.map((f) => (
              <Row
                key={f.id}
                href={`/admin/formats/${encodeURIComponent(f.id)}`}
                title={
                  <>
                    <span className="truncate">{f.name}</span>
                    {f.status === "draft" ? <Chip tone="chyron">Draft</Chip> : <Chip>Approved</Chip>}
                  </>
                }
                detail={`Version ${f.version} · ${f.showCount ? `used by ${count(f.showCount, "show")}` : "no shows yet"}`}
                trailing={<MoreButton label={`${f.name}: actions`} onClick={() => setMenu(f)} />}
              />
            ))}
          </Rows>
        )}
      </Section>
      <Section title="Built in">
        <Rows>
          {builtIns.map((o) => (
            <Row
              key={o.id}
              href={`/admin/formats/${encodeURIComponent(o.id)}`}
              title={o.name}
              detail={`Read only · ${usedBy(o.id) ? `used by ${count(usedBy(o.id), "show")}` : "no shows"}`}
            />
          ))}
        </Rows>
      </Section>

      {menu && (
        <BottomSheet open onOpenChange={(o) => !o && setMenu(null)} title={menu.name} description={menu.status === "draft" ? "Draft" : "Approved"}>
          <SheetAction onClick={() => router.push(`/admin/formats/${encodeURIComponent(menu.id)}`)}>{menu.status === "draft" ? "Review" : "Open"}</SheetAction>
          <SheetAction danger onClick={() => remove(menu)} detail={menu.showCount ? `Used by ${count(menu.showCount, "show")}` : undefined}>
            Delete
          </SheetAction>
        </BottomSheet>
      )}
    </AdminPage>
  );
}

export function FormatPage({ formatId }: { formatId: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const shows = useAdminShows();
  const builtIn = shows.data?.formatOptions.find((o) => o.id === formatId && !o.stored);
  const stored = useQuery({
    queryKey: ["admin-format", formatId],
    queryFn: () => api.adminGetFormat(formatId),
    enabled: !!shows.data && !builtIn,
  });
  const back = { href: "/admin/formats", label: "Formats & rules" };
  const usedBy = shows.data?.shows.filter((s) => s.format === formatId) ?? [];
  const usedLine = usedBy.length ? `Used by ${usedBy.map((s) => s.name).join(", ")}` : "No shows use it yet";

  if (shows.isLoading) return <p className="text-muted-foreground">Loading…</p>;

  if (builtIn) {
    return (
      <AdminPage title={builtIn.name} subtitle={`Built in, read only · ${usedLine}`} back={back} wide>
        <FormatRulesView data={formatFor(builtIn.id).data} onClose={() => router.push(back.href)} />
      </AdminPage>
    );
  }
  if (stored.isLoading) return <p className="text-muted-foreground">Loading…</p>;
  const format = stored.data?.format;
  if (!format) {
    return (
      <AdminPage title="Format" back={back}>
        <Notice tone="bad">Couldn&rsquo;t load that format. It may have been deleted.</Notice>
      </AdminPage>
    );
  }
  return (
    <AdminPage
      title={format.name}
      subtitle={`${format.status === "draft" ? "Draft, not approved yet" : `Approved · version ${format.version}`} · ${usedLine}`}
      back={back}
      wide
    >
      {/* The editor's insides predate the redesign; its dropdowns would otherwise run off a phone. */}
      <div className="min-w-0 [&_select]:min-w-0 [&_select]:max-w-full">
        <FormatReviewScreen
          format={format}
          onClose={() => router.push(back.href)}
          onChanged={async () => {
            await queryClient.invalidateQueries({
              queryKey: ["admin-format", formatId],
            });
            await queryClient.invalidateQueries({
              queryKey: ["admin-formats"],
            });
            await queryClient.invalidateQueries({ queryKey: ["admin-shows"] });
          }}
          onShowCreated={(show) => router.push(`/admin/shows/${show.id}`)}
        />
      </div>
    </AdminPage>
  );
}
