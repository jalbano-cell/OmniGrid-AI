import * as cheerio from "cheerio";
import { fetchHtml } from "@/lib/audit/fetchHtml";

export interface ResolvedMapsLead {
  ok: true;
  name: string;
  canonicalUrl: string;
}

export interface UnresolvedMapsLead {
  ok: false;
  error: string;
}

function cleanMapsName(raw: string): string {
  return raw
    .replace(/\s*[-·]\s*Google Maps\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Handles the common canonical form (…/maps/place/Business+Name/@lat,lng,zoom…) and the ?q= search form. */
function extractNameFromUrl(url: string): string | null {
  try {
    const u = new URL(url);
    const placeMatch = u.pathname.match(/\/maps\/place\/([^/]+)/);
    if (placeMatch) {
      const decoded = decodeURIComponent(placeMatch[1].replace(/\+/g, " "));
      return cleanMapsName(decoded);
    }
    const q = u.searchParams.get("q");
    if (q && !/^https?:\/\//i.test(q)) {
      return cleanMapsName(decodeURIComponent(q.replace(/\+/g, " ")));
    }
    return null;
  } catch {
    return null;
  }
}

/** Falls back to the page's Open Graph/title tags — present in the server-rendered shell even though the map itself is a JS app. */
function extractNameFromHtml(html: string): string | null {
  const $ = cheerio.load(html);
  const ogTitle = $('meta[property="og:title"]').attr("content");
  if (ogTitle) return cleanMapsName(ogTitle);
  const title = $("title").text();
  if (title) return cleanMapsName(title.split(/[|\-–—]/)[0]);
  return null;
}

/**
 * Resolves a pasted Google Maps link (short link or canonical) down to a
 * business name, by following redirects and reading only static HTML/meta
 * tags — no Maps/Places API key, no JS execution. Never invents a name: if
 * neither the URL structure nor the page's meta tags yield one, it reports
 * that plainly so the caller can type the name in by hand instead.
 */
export async function resolveGoogleMapsLink(rawUrl: string): Promise<ResolvedMapsLead | UnresolvedMapsLead> {
  let normalized: string;
  try {
    normalized = new URL(rawUrl.trim()).toString();
  } catch {
    return { ok: false, error: "That doesn't look like a valid URL" };
  }
  if (!/(^|\.)google\.[a-z.]+$|maps\.app\.goo\.gl$|goo\.gl$|g\.page$/i.test(new URL(normalized).hostname)) {
    return { ok: false, error: "That doesn't look like a Google Maps link" };
  }

  const fetched = await fetchHtml(normalized);
  if (!fetched.ok && !fetched.html) {
    return { ok: false, error: fetched.error ?? "Couldn't reach that link — check the URL and try again" };
  }

  const canonicalUrl = fetched.finalUrl || normalized;
  const name = extractNameFromUrl(canonicalUrl) ?? extractNameFromHtml(fetched.html);

  if (!name) {
    return { ok: false, error: "Couldn't automatically read the business name from that link — enter it manually below" };
  }

  return { ok: true, name, canonicalUrl };
}
