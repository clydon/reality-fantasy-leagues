"use client";

// A league's Standings (docs/PLAN-sports-couch.md B1, session 4; the design: docs/design-round/league-standings-spec.md,
// -first-view.md, -shape.md): every team in the league the way the league orders it, the couch's teams found without reading.
// A league of two levels switches between its divisions and its conferences (by seed); the groups holding the couch's teams come
// first, the rows inside them never re-sorted. A row opens its splits in place, and the team's sheet from there.
//
// The whole tab is results (every record, every place, the order itself), so it's held as one: with Hide sports scores on, or a
// game in this league being watched as if live, nothing but the first group's name and one Show draws, and Show lets the table out
// for the visit (a key of its own in showScore's set: it moves no season's mark). Before the setting is known, the skeleton.

import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Eye } from "lucide-react";
import { useLeagueStandings, useSportsRecordings } from "../data";
import { Faces } from "../ui/bars";
import { SportsLabel, TeamMark } from "../sports/parts";
import { clockOf, showScore, useHideSports, useHideSportsKnown, useNow, useShownScores } from "../sports/scores";
import { openSports, useLeagueWeek } from "../sports/sheets";
import { columnsOf, couchFirst, defaultView, notesOf, splitsOf, viewOf, viewWords, type Column, type ShownGroup, type Standings, type View } from "@/lib/sports/standings";
import type { LeagueNow } from "@/lib/sports/league-now";
import { useTableTeams, type Team } from "./league-page";
import { teamKeyOf } from "@/lib/sports/team-badge";

const VIEW_KEY = (league: string) => `gys-standings-view:${league}`;
const shownKey = (league: string) => `standings:${league}`;

/** The view chosen for this league this visit (a per-viewer convenience: lost, it opens on the league's usual view). */
function useView(league: string, s: Standings | null): [View | null, (v: View) => void] {
  // Read once, in the browser (the table only draws after the client's read, so the server's render never differs).
  const [picked, setPicked] = useState<View | null>(() => {
    try {
      const v = sessionStorage.getItem(VIEW_KEY(league));
      return v === "group" || v === "parent" ? v : null;
    } catch {
      return null; // storage off (or the server): the league's usual view
    }
  });
  const pick = (v: View) => {
    setPicked(v);
    try {
      sessionStorage.setItem(VIEW_KEY(league), v);
    } catch {
      /* kept in memory for the visit */
    }
  };
  return [s ? (s.parents.length ? (picked ?? defaultView(s)) : "group") : null, pick];
}

export function LeagueStandings({ league, name, lnow }: { league: string; name: string; lnow: LeagueNow | null }) {
  const q = useLeagueStandings(league);
  const s = q.data?.standings ?? null;
  const known = useHideSportsKnown();
  const hide = useHideSports();
  const shown = useShownScores();
  const now = useNow();
  const recordings = useSportsRecordings().data?.recordings;
  const { teams, meId } = useTableTeams(league);
  const [view, setView] = useView(league, s);
  const [open, setOpen] = useState<string | null>(null);

  // A game in this league watched as if live, begun and not yet watched: the table would give its result away.
  const recording = (recordings ?? []).find((r) => r.league === league && (!r.startsAt || Date.parse(r.startsAt) <= now));
  const held = !shown.has(shownKey(league)) && (hide || !!recording);
  // Its name from this week's games ("Eagles at Jets"), so you can judge what showing the table would give away.
  const week = useLeagueWeek(league, lnow?.from ?? null, lnow?.to ?? null, !!recording);
  const recorded = recording ? week.games.find((g) => g.id === recording.game) : undefined;
  const recordingName = recording?.name ?? (recorded ? `${recorded.sides.find((x) => !x.home)?.short} at ${recorded.sides.find((x) => x.home)?.short}` : null);
  const byTeam = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);
  const groups = useMemo(() => {
    if (!s || !view) return [];
    return couchFirst(viewOf(s, view), (id) => {
      const t = byTeam.get(id);
      return { fans: t?.followers.length ?? 0, yours: !!t?.followers.some((f) => f.id === meId) };
    });
  }, [s, view, byTeam, meId]);
  const words = s ? viewWords(s) : null;
  const columns = s ? columnsOf(s) : [];
  const notes = s ? notesOf(s) : [];

  if (!known || q.isLoading) return <Skeleton />;
  if (q.isError)
    return (
      <p data-standings-failed className="mt-6 flex items-center gap-2 text-[14px] text-muted-foreground">
        Standings didn&rsquo;t load.
        <button type="button" onClick={() => void q.refetch()} className="nd-press inline-flex h-11 items-center font-semibold text-foreground underline underline-offset-[3px] focus-visible:outline-2 focus-visible:outline-foreground">
          Try again
        </button>
      </p>
    );
  if (!s || !groups.length)
    return (
      <p data-standings-none className="mt-6 text-[14px] leading-snug text-muted-foreground">
        ESPN has no standings for {name}.
      </p>
    );

  return (
    <div data-standings={view} className="pb-4">
      {words && !held && (
        <div role="group" aria-label="Group the table by" data-standings-view className="mt-4 grid h-11 grid-cols-2 rounded-[4px] p-[3px] outline-1 -outline-offset-1 outline-edge">
          {(["group", "parent"] as const).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={view === v}
              data-view={v}
              onClick={() => {
                setView(v);
                setOpen(null);
                // Your row in view (never re-sorted to the top: the league's order stays, R3).
                setTimeout(() => {
                  const r = document.querySelector("[data-standing-row][data-yours]")?.getBoundingClientRect();
                  if (r && (r.bottom > window.innerHeight - 80 || r.top < 0)) window.scrollBy({ top: r.top - window.innerHeight / 2, behavior: "smooth" });
                }, 60);
              }}
              className={`nd-press rounded-[3px] text-[14px] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-foreground ${view === v ? "bg-foreground font-bold text-background dark:bg-secondary dark:text-foreground dark:outline-1 dark:-outline-offset-1 dark:outline-foreground" : "font-semibold text-muted-foreground"}`}
            >
              {words[v]}
            </button>
          ))}
        </div>
      )}
      {lnow && !lnow.on && s.season && (
        <p data-standings-final className="mt-3 text-[13px] font-semibold text-muted-foreground">
          Final standings · {s.season}
        </p>
      )}
      {held ? (
        <section data-standings-hidden className="mt-1">
          <SportsLabel>{groups[0].name}</SportsLabel>
          <div className="rounded-[4px] bg-card px-3.5 py-3.5">
            <p className="text-[15px] leading-snug">
              {recording && !hide
                ? `You’re watching ${recordingName ?? "a game"} as if live. The standings would give it away.`
                : "Standings carry every result so far."}
            </p>
            <button
              type="button"
              data-show-standings
              onClick={() => showScore(shownKey(league))}
              className="nd-press mt-3 inline-flex h-11 items-center gap-1.5 rounded-[4px] px-3.5 text-[14px] font-semibold outline-1 -outline-offset-1 outline-edge focus-visible:outline-2 focus-visible:outline-foreground"
            >
              <Eye className="size-4" aria-hidden /> {recording && !hide ? "Show anyway" : "Show the standings"}
            </button>
          </div>
        </section>
      ) : (
        <>
          {groups.map((g) => (
            <Group key={g.id} g={g} columns={columns} league={league} byTeam={byTeam} meId={meId} notes={notes.length > 0} open={open} setOpen={setOpen} conference={view === "parent"} />
          ))}
          {notes.length > 0 && (
            <ul data-standings-notes className="mt-4 flex flex-col gap-1.5">
              {notes.map((n) => (
                <li key={n.text} className="flex items-center gap-2 text-[13px] text-muted-foreground">
                  <Swatch color={n.color} />
                  {n.text}
                </li>
              ))}
            </ul>
          )}
          <p data-standings-asof className="mt-4 text-[12px] text-muted-foreground">
            From ESPN · as of {clockOf(s.asOf)}
          </p>
        </>
      )}
    </div>
  );
}

function Skeleton() {
  return (
    <div aria-busy data-standings-loading className="mt-4 flex animate-pulse flex-col gap-2">
      <div className="h-11 rounded-[4px] bg-card" />
      {[0, 1].map((i) => (
        <div key={i} className="mt-4 flex flex-col gap-1.5">
          <div className="h-4 w-28 rounded-[2px] bg-card" />
          {[0, 1, 2, 3].map((j) => (
            <div key={j} className="h-12 rounded-[3px] bg-card" />
          ))}
        </div>
      ))}
    </div>
  );
}

function Swatch({ color }: { color: string | null }) {
  return <i aria-hidden className="size-2 flex-none rounded-[2px]" style={{ background: color ?? "var(--muted-foreground)" }} />;
}

/** A column's width: the record wider (W-L-T), soccer's short numbers narrower. */
const widthOf = (c: Column) => (c.key === "record" ? "58px" : c.key === "gp" ? "30px" : "42px");

function Group(p: {
  g: ShownGroup;
  columns: Column[];
  league: string;
  byTeam: Map<string, Team>;
  meId: string;
  notes: boolean;
  open: string | null;
  setOpen: (id: string | null) => void;
  conference: boolean;
}) {
  const { g, columns } = p;
  // The last column a chevron: a row opens (the check: rows didn't look tappable).
  const grid = `${p.notes ? "30px" : "22px"} 30px minmax(0,1fr) ${columns.map(widthOf).join(" ")} 14px`;
  // By conference, each division leader says so ("1st East"): a seed above a better record explains itself (PFD's gap), and every
  // leader is marked so the rule is learned, not only its exceptions (the check).
  const seenNotes = new Set<string>();
  return (
    <section data-standings-group={g.id} className="mt-1">
      <SportsLabel>{g.name}</SportsLabel>
      <div aria-hidden className="grid h-6 items-center gap-x-2 px-2 text-[12px] font-semibold uppercase tracking-[0.04em] text-muted-foreground" style={{ gridTemplateColumns: grid }}>
        <span className="text-center">{g.placeWord}</span>
        <span />
        <span />
        {columns.map((c) => (
          <span key={c.key} className="text-right">
            {c.label}
          </span>
        ))}
        <span />
      </div>
      <ol>
        {g.rows.map((r, i) => (
          <Row key={r.e.team} r={r} grid={grid} columns={columns} league={p.league} team={p.byTeam.get(r.e.team)} meId={p.meId} notes={p.notes} first={i === 0} open={p.open === `${g.id}:${r.e.team}`} toggle={() => p.setOpen(p.open === `${g.id}:${r.e.team}` ? null : `${g.id}:${r.e.team}`)} tag={p.conference && r.leader ? r.division : null} placeWord={g.placeWord} noteWords={!!r.e.note && !seenNotes.has(r.e.note.text) && !!seenNotes.add(r.e.note.text)} />
        ))}
      </ol>
    </section>
  );
}

function Row(p: {
  r: ShownGroup["rows"][number];
  grid: string;
  columns: Column[];
  league: string;
  team: Team | undefined;
  meId: string;
  notes: boolean;
  first: boolean;
  open: boolean;
  toggle: () => void;
  tag: string | null | undefined;
  placeWord: string;
  /** The first row of a soccer place says its name (the colour alone carried it: WCAG 1.4.1). */
  noteWords: boolean;
}) {
  const { e, place } = p.r;
  const fans = p.team?.followers ?? [];
  const yours = fans.some((f) => f.id === p.meId);
  const out = e.clinch === "out";
  // A leader's games behind as a dash, not a hyphen (it read as a missing value).
  const value = (c: Column) => ((c.key === "record" ? e.record : c.key === "gb" && p.r.gb !== undefined ? p.r.gb : e.stats[c.key]) ?? "").replace(/^-$/, "—");
  // What sits under the name: its division lead, its place's note, or In and Out; never beside it (the check: names cut to "G…").
  const under = p.tag ? `1st ${p.tag}` : p.noteWords && e.note ? e.note.text : e.clinch === "in" ? "In" : out ? "Out" : null;
  const splits = splitsOf(e, p.league);
  const said = [
    `${p.placeWord === "Seed" ? "Seed " : ""}${place ?? ""}. ${e.short}`,
    p.tag ? `first in the ${p.tag}` : null,
    e.note?.text ?? null,
    e.clinch === "in" ? "clinched" : out ? "out" : null,
    ...p.columns.map((c) => `${c.label} ${value(c)}`),
    fans.length ? `followed by ${fans.map((f) => (f.id === p.meId ? "you" : f.name)).join(", ")}` : null,
  ]
    .filter(Boolean)
    .join(", ");
  return (
    <li className={yours ? "rounded-[3px] bg-secondary" : "border-b border-border"}>
      <button
        type="button"
        data-standing-row={e.team}
        data-yours={yours || undefined}
        aria-expanded={p.open}
        aria-label={said}
        onClick={p.toggle}
        className="nd-press grid min-h-12 w-full items-center gap-x-2 rounded-[3px] px-2 text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-foreground"
        style={{ gridTemplateColumns: p.grid }}
      >
        {/* The group's first in bold foreground, never yellow (yellow is a move: the One Chyron Rule). */}
        <span className={`type-num flex items-center justify-center gap-1 text-[15px] ${p.first ? "font-bold text-foreground" : "text-muted-foreground"}`}>
          {p.notes && (e.note ? <Swatch color={e.note.color} /> : <i className="size-2 flex-none" aria-hidden />)}
          {place ?? ""}
        </span>
        <TeamMark abbr={e.abbreviation ?? e.short.slice(0, 3)} color={e.color} size="sm" team={teamKeyOf(p.league, e.team)} />
        {/* The name alone on its line (the user's call on the story: a face beside it cut it to "Cow…"); the couch's faces and what
            qualifies the team on the line under it. */}
        <span className="min-w-0 py-1">
          <span className={`block truncate text-[16px] font-bold ${out ? "text-muted-foreground" : ""}`}>{e.short}</span>
          {(fans.length > 0 || under) && (
            <span className="mt-1 flex min-w-0 items-center gap-2">
              {fans.length > 0 && <Faces marks={fans.map((f) => ({ userId: f.id, name: f.name, you: f.id === p.meId }))} size={18} max={3} ground={yours ? "var(--secondary)" : "var(--background)"} />}
              {under && <span className="truncate text-[12px] font-semibold leading-tight text-muted-foreground">{under}</span>}
            </span>
          )}
        </span>
        {/* The sport's deciding numbers in ink, the rest muted (the check: soccer's P was bold, its PTS grey). */}
        {p.columns.map((c) => (
          <span key={c.key} className={`type-num text-right leading-none ${c.strong ? "text-[16px] text-foreground" : "text-[15px] text-muted-foreground"}`}>
            {value(c)}
          </span>
        ))}
        <ChevronDown className={`size-3.5 text-muted-foreground transition-transform duration-200 ${p.open ? "rotate-180" : ""}`} aria-hidden />
      </button>
      {p.open && (
        <div data-standings-splits={e.team} className="px-2 pb-1.5" style={{ paddingLeft: `calc(${p.notes ? 30 : 22}px + 38px + 8px)` }}>
          {e.note && <p className="mb-1 text-[13px] text-muted-foreground">{e.note.text}</p>}
          {splits.length > 0 && (
            <p className="flex flex-wrap gap-x-3 gap-y-1 text-[13px] text-muted-foreground">
              {splits.map((x) => (
                <span key={x.label} className="whitespace-nowrap">
                  {x.label} <span className="type-num font-semibold text-foreground">{x.value}</span>
                </span>
              ))}
            </p>
          )}
          <button
            type="button"
            data-standings-team={e.team}
            onClick={() => openSports({ kind: "team", league: p.league, team: e.team })}
            className="nd-press -ml-1 flex h-11 items-center gap-1 rounded-[3px] px-1 text-[14px] font-semibold focus-visible:outline-2 focus-visible:outline-foreground"
          >
            Open the {e.short} <ChevronRight className="size-4" aria-hidden />
          </button>
        </div>
      )}
    </li>
  );
}

