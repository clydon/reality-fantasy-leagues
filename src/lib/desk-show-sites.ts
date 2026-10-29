// A show's research sites (docs/PLAN-desk-parity.md part 7a): the sites our bot's prompt and the copy-and-paste brief tell
// the AI to start from (shows.research_domains, hostnames; null = our usual). Pure, for the desk's server and its sheet.

/** Our usual research sites, as db/episode-research.js domainsFor gives them (this mirrors it; check-desk-shows.js proves it
 *  against research's own context): the show's wiki host where it has one, then tvline.com and parade.com. */
export function usualSites(wikiApiUrl: string | null | undefined): string[] {
  let wiki: string | null = null;
  try {
    wiki = wikiApiUrl ? new URL(wikiApiUrl).hostname.replace(/^www\./, "") : null;
  } catch {
    /* a malformed URL just means no wiki host */
  }
  return [wiki, "tvline.com", "parade.com"].filter((x): x is string => !!x);
}

/** A site as research keeps it: its hostname ("https://www.realitytea.com/category/survivor/" -> "realitytea.com",
 *  "insidesurvivor.com" as it is), or null for anything that isn't one. */
export function siteOf(raw: unknown): string | null {
  const t = String(raw ?? "").trim().toLowerCase();
  if (!t || t.length > 300) return null;
  let host: string;
  try {
    host = new URL(/^[a-z][a-z0-9+.-]*:\/\//.test(t) ? t : `https://${t}`).hostname;
  } catch {
    return null;
  }
  host = host.replace(/^www\./, "").replace(/\.$/, "");
  return host.length <= 253 && /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(host) && /[a-z]/.test(host.split(".").at(-1)!) ? host : null;
}
