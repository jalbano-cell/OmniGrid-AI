import { prisma } from "@/lib/db/prisma";
import { webSearchTool } from "@/lib/tools/webSearch";
import { fetchHtml } from "@/lib/audit/fetchHtml";
import { extractContactInfo } from "@/lib/services/contactExtractor";
import { logEvent, logError } from "@/lib/services/logger";
import { getLeadsFoundToday, getSettings } from "@/lib/services/settings";

export interface LeadSearchInput {
  industry: string;
  city: string;
  province?: string;
  country?: string;
  count: number;
}

export interface LeadSearchOutcome {
  requested: number;
  created: number;
  skippedDuplicates: number;
  skippedUnreachable: number;
  limitReached: boolean;
  createdBusinessIds: string[];
}

// Aggregators/directories/socials that show up in "X in Y" searches but
// aren't themselves a business's own site — we can't reliably attribute a
// single business identity to these without a lot more scraping, so we
// simply don't create leads from them.
const DIRECTORY_DOMAINS = [
  "facebook.com", "instagram.com", "linkedin.com", "twitter.com", "x.com", "tiktok.com",
  "yelp.com", "yelp.ca", "tripadvisor.com", "tripadvisor.ca", "yellowpages.ca", "yellowpages.com",
  "google.com", "maps.google.com", "g.page", "foursquare.com", "bbb.org", "indeed.com",
  "glassdoor.com", "wikipedia.org", "youtube.com", "pinterest.com", "amazon.com", "reddit.com",
  "homestars.com", "thumbtack.com", "angi.com", "houzz.com", "mapquest.com", "bing.com",
  "opentable.com", "doordash.com", "ubereats.com", "skipthedishes.com", "grubhub.com",
  "apple.com", "app.apple.com", "trustpilot.com", "canada411.ca", "411.ca",
];

function extractDomain(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function isDirectoryDomain(domain: string) {
  return DIRECTORY_DOMAINS.some((d) => domain === d || domain.endsWith(`.${d}`));
}

function cleanTitle(title: string) {
  return title.split(/[\|\-–—]/)[0].trim();
}

/**
 * Runs a web_search for "{industry} in {city}", paginating through result
 * pages, filtering out directories/socials, fetching each candidate
 * business's own homepage, extracting contact info, and persisting new
 * leads (deduped by website). Never invents a field it couldn't find.
 */
export async function discoverLeads(input: LeadSearchInput): Promise<LeadSearchOutcome> {
  const settings = await getSettings();
  const alreadyFoundToday = await getLeadsFoundToday();
  const remainingBudget = Math.max(0, settings.dailyResearchLimit - alreadyFoundToday);
  const target = Math.min(input.count, remainingBudget);

  const outcome: LeadSearchOutcome = {
    requested: input.count,
    created: 0,
    skippedDuplicates: 0,
    skippedUnreachable: 0,
    limitReached: remainingBudget <= 0,
    createdBusinessIds: [],
  };

  if (target <= 0) {
    await logEvent({
      type: "SEARCH",
      message: `Lead search skipped — daily research limit reached (${settings.dailyResearchLimit}/day)`,
      metadata: { ...input },
    });
    return outcome;
  }

  const locationParts = [input.city, input.province, input.country].filter(Boolean);
  const query = `${input.industry} in ${locationParts.join(", ")}`;

  const seenDomains = new Set<string>();
  const candidates: { domain: string; title: string; link: string; snippet: string }[] = [];

  // Tavily returns up to 20 results per call with no offset/page cursor, so
  // we run a couple of differently-worded queries and merge unique domains
  // instead of paginating a single query.
  const queryVariants = [query, `best ${input.industry} near ${input.city}`];
  for (const [i, q] of queryVariants.entries()) {
    if (candidates.length >= target * 3) break;

    const result = await webSearchTool.execute({ query: q, maxResults: 20 });
    if (!result.ok || !result.data) {
      if (i === 0) {
        // First query failed outright (e.g. not configured) — surface the error immediately.
        return outcome;
      }
      break;
    }
    if (result.data.items.length === 0) continue;

    for (const item of result.data.items) {
      const domain = extractDomain(item.link);
      if (!domain || seenDomains.has(domain) || isDirectoryDomain(domain)) continue;
      seenDomains.add(domain);
      candidates.push({ domain, title: item.title, link: item.link, snippet: item.snippet });
    }
  }

  for (const candidate of candidates) {
    if (outcome.created >= target) break;

    const existing = await prisma.business.findFirst({
      where: { website: { contains: candidate.domain } },
    });
    if (existing) {
      outcome.skippedDuplicates++;
      continue;
    }

    const fetched = await fetchHtml(candidate.link);
    if (!fetched.ok || !fetched.html) {
      outcome.skippedUnreachable++;
      await logEvent({
        type: "SEARCH",
        message: `Skipped unreachable candidate site ${candidate.domain}`,
        metadata: { domain: candidate.domain, error: fetched.error },
      });
      continue;
    }

    const contact = extractContactInfo(fetched.html, fetched.finalUrl);

    try {
      const business = await prisma.business.create({
        data: {
          name: contact.name || cleanTitle(candidate.title) || candidate.domain,
          industry: input.industry,
          city: input.city,
          province: input.province,
          country: input.country ?? "Canada",
          website: fetched.finalUrl,
          email: contact.email,
          phone: contact.phone,
          address: contact.address,
          googleProfile: contact.googleProfile,
          socialLinks: contact.socialLinks,
          source: query,
        },
      });
      outcome.created++;
      outcome.createdBusinessIds.push(business.id);
      await logEvent({
        type: "SEARCH",
        message: `Discovered lead: ${business.name} (${candidate.domain})`,
        businessId: business.id,
        metadata: { domain: candidate.domain, query },
      });
    } catch (err) {
      // Unique constraint race or similar — treat as a duplicate, not a fatal error.
      outcome.skippedDuplicates++;
      await logError(`Failed to save lead for ${candidate.domain}`, err, { query });
    }
  }

  return outcome;
}
