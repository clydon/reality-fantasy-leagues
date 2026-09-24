// Turns a wiki URL pasted from a browser into the two things the MediaWiki Action API actually
// needs: an API endpoint and a page title.
//
// This exists so an admin never has to know that distinction. Asking for
// "https://survivor.fandom.com/api.php" and "Survivor 44" as separate fields would be asking them to
// understand MediaWiki's URL layout; asking for the URL in their address bar is not.
//
// Shared by the admin show/season routes (which derive and store the pieces) and db/wiki-sync.js
// (which consumes them), so the two can't drift apart on how a URL is interpreted.

export interface ParsedWikiUrl {
  /** MediaWiki Action API endpoint, e.g. https://survivor.fandom.com/api.php */
  apiUrl: string;
  /** Page title in the form the API wants, e.g. "Survivor 44" (spaces, not underscores). */
  pageTitle: string;
}

// Recognises the common MediaWiki/Fandom article paths. Deliberately conservative: anything that
// isn't clearly an article URL returns null rather than a guess, so a typo surfaces as "that doesn't
// look like a wiki page URL" instead of silently producing a title that 404s later.
export function parseWikiUrl(raw: string | null | undefined): ParsedWikiUrl | null {
  const input = (raw || "").trim();
  if (!input) return null;

  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;

  // /wiki/<Title> (Fandom, most MediaWiki installs) or /index.php?title=<Title>
  let titlePart: string | null = null;
  const wikiMatch = url.pathname.match(/^\/wiki\/(.+)$/);
  if (wikiMatch) titlePart = wikiMatch[1];
  else if (url.searchParams.get("title")) titlePart = url.searchParams.get("title");
  if (!titlePart) return null;

  // Underscores are MediaWiki's URL encoding for spaces; the API wants the spaces back. decodeURI
  // handles the percent-encoding in names like "Survivor%3A_Borneo".
  let pageTitle: string;
  try {
    pageTitle = decodeURIComponent(titlePart).replace(/_/g, " ").trim();
  } catch {
    pageTitle = titlePart.replace(/_/g, " ").trim();
  }
  if (!pageTitle) return null;

  // Strip any anchor/section the person happened to copy along with the URL.
  pageTitle = pageTitle.split("#")[0].trim();
  if (!pageTitle) return null;

  return { apiUrl: `${url.protocol}//${url.host}/api.php`, pageTitle };
}
