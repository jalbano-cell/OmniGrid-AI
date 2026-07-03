import * as cheerio from "cheerio";
import { fetchHtml } from "@/lib/audit/fetchHtml";
import { webSearchTool } from "@/lib/tools/webSearch";
import type { Business } from "@prisma/client";

export interface BusinessProfile {
  /** Best-effort service/specialty names found on the business's own site (never invented). */
  services: string[];
  /** An explicit "serving <area>" phrase found on the site or in search snippets, if any. */
  serviceArea: string | null;
  foundedYear: number | null;
  yearsInBusiness: number | null;
  /** Meta description / og:description from the homepage — a factual, business-written summary. */
  aboutSummary: string | null;
}

export const EMPTY_BUSINESS_PROFILE: BusinessProfile = {
  services: [],
  serviceArea: null,
  foundedYear: null,
  yearsInBusiness: null,
  aboutSummary: null,
};

const NAV_SKIP_WORDS = new Set([
  "home", "about", "about us", "contact", "contact us", "blog", "gallery", "reviews",
  "testimonials", "faq", "careers", "privacy policy", "terms", "login", "sign in",
  "book now", "book online", "get a quote", "request a quote", "get estimate",
  "free estimate", "menu", "shop", "read more", "learn more", "view more",
  "why us", "our story", "call now", "get in touch", "get directions",
  "locally owned and operated", "offers", "deals", "coupons",
  "services", "our services", "what we do", "portfolio", "projects",
]);

// Nav text that's mostly digits (phone numbers, prices) isn't a service name.
function looksLikePhoneOrGarbage(text: string): boolean {
  return (text.match(/\d/g) ?? []).length >= 5;
}

function extractFoundedYear(text: string): number | null {
  const match = text.match(/\b(?:since|est\.?|established(?:\s+in)?|founded(?:\s+in)?)\s+((?:19|20)\d{2})\b/i);
  if (!match) return null;
  const year = parseInt(match[1], 10);
  const currentYear = new Date().getFullYear();
  return year >= 1900 && year <= currentYear ? year : null;
}

function extractYearsInBusiness(text: string): number | null {
  const match =
    text.match(/\b(\d{1,3})\+?\s+years?\s+(?:of\s+)?(?:experience|in business|serving)/i) ||
    text.match(/\btrusted\s+(\d{1,3})\+?\s+years?\b/i);
  if (!match) return null;
  const years = parseInt(match[1], 10);
  return years > 0 && years < 150 ? years : null;
}

function extractServiceArea(text: string): string | null {
  const match = text.match(/\bserving\s+([A-Z][A-Za-z.,'&\-\s]{2,60}?)(?:\.|,|\n|\s+(?:and|since|for)\b|$)/);
  return match ? match[1].trim() : null;
}

/** Pulls candidate service/specialty names from nav links and any "Services" section, filtering out generic site-nav boilerplate. Never invents — only text found verbatim on the page. */
function extractServices($: cheerio.CheerioAPI): string[] {
  const candidates: string[] = [];
  const seen = new Set<string>();

  function add(text: string) {
    const trimmed = text.trim();
    if (!trimmed || trimmed.length > 50 || trimmed.length < 3) return;
    if (looksLikePhoneOrGarbage(trimmed)) return;
    const lower = trimmed.toLowerCase();
    if (NAV_SKIP_WORDS.has(lower) || seen.has(lower)) return;
    seen.add(lower);
    candidates.push(trimmed);
  }

  $("nav a, header a").each((_, el) => add($(el).text()));

  const servicesHeading = $("h1, h2, h3").filter((_, el) => /services|what we (do|offer)/i.test($(el).text())).first();
  if (servicesHeading.length) {
    const container = servicesHeading.parent();
    container.find("li, h3, h4").each((_, el) => add($(el).text()));
  }

  return candidates.slice(0, 6);
}

/** Best-effort discovery + fetch of the site's own About page, so we can pull founding-year / area language often absent from the homepage. Failures here are silent — the profile just has less to work with. */
async function fetchAboutPage(homeHtml: string, baseUrl: string): Promise<string> {
  const $ = cheerio.load(homeHtml);
  let aboutHref: string | null = null;

  $("a[href]").each((_, el) => {
    if (aboutHref) return;
    const href = $(el).attr("href") ?? "";
    const text = $(el).text().trim().toLowerCase();
    if (/\babout\b/i.test(href) || text === "about" || text === "about us") {
      aboutHref = href;
    }
  });

  if (!aboutHref) return "";

  try {
    const aboutUrl = new URL(aboutHref, baseUrl).toString();
    const fetched = await fetchHtml(aboutUrl, 8_000);
    return fetched.ok ? fetched.html : "";
  } catch {
    return "";
  }
}

/**
 * Gathers ONLY factual, publicly-verifiable details about a business for
 * outreach personalization: services offered, service area, years in
 * business, and an about-page summary. Every field is either found verbatim
 * on the business's own site (or corroborated by a Tavily search snippet) or
 * left null/empty — nothing here is inferred, guessed, or invented. This
 * deliberately does NOT analyze the site for design/SEO/performance flaws;
 * that's the separate website-audit feature, which outreach no longer draws
 * on now that we're not pitching redesigns.
 */
export async function researchBusinessProfile(business: Business): Promise<BusinessProfile> {
  if (!business.website) return EMPTY_BUSINESS_PROFILE;

  const homeFetch = await fetchHtml(business.website).catch(() => null);
  const homeHtml = homeFetch?.ok ? homeFetch.html : "";
  if (!homeHtml) return EMPTY_BUSINESS_PROFILE;

  const aboutHtml = await fetchAboutPage(homeHtml, homeFetch!.finalUrl);

  const $home = cheerio.load(homeHtml);
  const combinedText = [homeHtml, aboutHtml]
    .filter(Boolean)
    .map((html) => cheerio.load(html)("body").text().replace(/\s+/g, " ").trim())
    .join(" ");

  const aboutSummaryRaw =
    $home('meta[name="description"]').attr("content") ||
    $home('meta[property="og:description"]').attr("content") ||
    null;

  const foundedYear = extractFoundedYear(combinedText);
  const yearsInBusiness = extractYearsInBusiness(combinedText) ??
    (foundedYear ? new Date().getFullYear() - foundedYear : null);
  const serviceArea = extractServiceArea(combinedText);
  const services = extractServices($home);

  // Tavily is supplementary only — used to corroborate founded-year/service-area
  // language when the site itself didn't have it, via the same strict regexes
  // (never used to free-write descriptive copy about the business).
  let tavilyFoundedYear: number | null = null;
  let tavilyServiceArea: string | null = null;
  if (!foundedYear || !serviceArea) {
    try {
      const result = await webSearchTool.execute({
        query: `"${business.name}" ${business.city}`,
        maxResults: 5,
      });
      if (result.ok && result.data) {
        const snippetText = result.data.items.map((i) => i.snippet).join(" ");
        tavilyFoundedYear = extractFoundedYear(snippetText);
        tavilyServiceArea = extractServiceArea(snippetText);
      }
    } catch {
      // Tavily is best-effort here — profile research still returns whatever
      // was found on-site if this fails.
    }
  }

  return {
    services,
    serviceArea: serviceArea ?? tavilyServiceArea,
    foundedYear: foundedYear ?? tavilyFoundedYear,
    yearsInBusiness,
    aboutSummary: aboutSummaryRaw ? aboutSummaryRaw.trim().slice(0, 220) : null,
  };
}
