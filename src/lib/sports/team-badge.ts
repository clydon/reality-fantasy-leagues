// A team's badge as a picture (docs/PLAN-team-logos.md L0): our own mark, never a league's logo. The same mark as
// src/new/sports/parts.tsx TeamMark (the city's short code on the team's colour, white or ink by contrast, its corner cut as the
// Lower Third's tags are), drawn as a small SVG so anything that shows a person's photo shows it as is: a team's own people (its
// defense: TeamSport.teamPeople) have no headshot, and the app never draws ESPN's logos (the user, 2026-11-22).

const INK = "#121018";

/** White or ink on a team's colour, whichever reads better (the worst on ESPN's colours 4.35:1). */
export function teamInk(hex: string | null | undefined): string {
  if (!hex || !/^[0-9a-f]{6}$/i.test(hex)) return "#fff";
  const ch = (i: number) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const l = 0.2126 * ch(0) + 0.7152 * ch(2) + 0.0722 * ch(4);
  const onWhite = 1.05 / (l + 0.05);
  const onInk = (l + 0.05) / 0.0573;
  return onWhite >= onInk ? "#fff" : INK;
}

export const teamBg = (hex: string | null | undefined) => (hex && /^[0-9a-f]{6}$/i.test(hex) ? `#${hex}` : "#4a4558");

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** The badge as a data: URL (a few hundred bytes), for a photo's place. Its code: the abbreviation, else the name's first letters.
 *  `team` ("team:<league>:<id>", couch-pictures.ts teamKey) rides along in the SVG, so a phone can show the viewer's couch's
 *  picture for that team in its place (src/new/ui/team-pictures.tsx). */
export function teamBadgeSrc(abbr: string | null | undefined, color: string | null | undefined, name?: string, team?: string): string {
  const code = (abbr || (name ?? "").split(/\s+/).map((w) => w[0] ?? "").join("") || "?").slice(0, 4).toUpperCase();
  const size = code.length >= 4 ? 30 : code.length === 3 ? 36 : 44;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"${team ? ` data-team="${esc(team)}"` : ""}>` +
    // Its faint white inner edge as TeamMark's inset shadow (rgba(255,255,255,.3)): a dark colour still reads on the dark page.
    `<clipPath id="b"><path d="M0 0H100V68L76 100H0Z"/></clipPath>` +
    `<path d="M0 0H100V68L76 100H0Z" fill="${teamBg(color)}" stroke="#fff" stroke-opacity=".3" stroke-width="6" clip-path="url(#b)"/>` +
    `<text x="50" y="50" dy="0.35em" text-anchor="middle" font-family="Arial Narrow,Arial,Helvetica,sans-serif" font-weight="700" font-size="${size}" fill="${teamInk(color)}">${esc(code)}</text>` +
    `</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/** The team a badge is for (its `team`), or null for anything else: a headshot, a photo, a badge made without one. */
export function badgeTeamOf(src: string | null | undefined): string | null {
  if (!src || !src.startsWith("data:image/svg+xml,")) return null;
  const m = /data-team%3D%22(.*?)%22/i.exec(src);
  return m ? decodeURIComponent(m[1]) : null;
}

/** An ESPN team logo's address (a.espncdn.com/i/teamlogos/…, and its resizer's ?img=/i/teamlogos/…): never kept or drawn. */
export const LEAGUE_LOGO = /espncdn\.com\/.*teamlogos\//i;

/** A team's key ("team:<league>:<id>"), as a couch's picture for it is kept (src/lib/server/couch-pictures.ts teamKey). */
export const teamKeyOf = (league: string, id: string) => `team:${league}:${id}`;
