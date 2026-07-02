import * as cheerio from "cheerio";

export interface ExtractedContactInfo {
  name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  socialLinks: Record<string, string>;
  googleProfile: string | null;
}

const SOCIAL_DOMAINS: Record<string, string> = {
  "facebook.com": "facebook",
  "instagram.com": "instagram",
  "linkedin.com": "linkedin",
  "twitter.com": "twitter",
  "x.com": "twitter",
  "tiktok.com": "tiktok",
  "youtube.com": "youtube",
};

const PHONE_REGEX = /(\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/;

const HTML_ENTITIES: Record<string, string> = {
  "&amp;": "&", "&#38;": "&", "&#x26;": "&",
  "&quot;": '"', "&#34;": '"',
  "&apos;": "'", "&#39;": "'",
  "&lt;": "<", "&#60;": "<",
  "&gt;": ">", "&#62;": ">",
  "&nbsp;": " ",
};

// Some sites put raw HTML-entity-encoded text inside JSON-LD (invalid, but
// common) — decode it so a business name reads correctly instead of showing
// literal "&amp;". Only handles a fixed, safe entity list; never guesses.
function decodeHtmlEntities(value: string): string {
  return value.replace(/&(?:amp|#38|#x26|quot|#34|apos|#39|lt|#60|gt|#62|nbsp);/gi, (m) => HTML_ENTITIES[m.toLowerCase()] ?? m);
}

/**
 * Best-effort extraction of publicly visible contact info from a business's
 * own homepage HTML. Every field is either found verbatim in the markup or
 * left null — nothing here is inferred or invented.
 */
export function extractContactInfo(html: string, baseUrl: string): ExtractedContactInfo {
  const $ = cheerio.load(html);

  // Name: prefer structured data, then Open Graph, then <title>.
  let name: string | null = null;
  $('script[type="application/ld+json"]').each((_, el) => {
    if (name) return;
    try {
      const json = JSON.parse($(el).contents().text());
      const entries = Array.isArray(json) ? json : [json];
      for (const entry of entries) {
        if (entry?.name && (entry["@type"]?.includes?.("Business") || entry["@type"] === "Organization" || entry["@type"] === "LocalBusiness")) {
          name = String(entry.name);
        }
      }
    } catch {
      // Malformed JSON-LD is common on the open web — skip silently.
    }
  });
  if (!name) name = $('meta[property="og:site_name"]').attr("content") ?? null;
  if (!name) {
    const title = $("title").text().trim();
    name = title ? title.split(/[\|\-–—]/)[0].trim() : null;
  }

  // Email: first mailto link found anywhere on the page.
  let email: string | null = null;
  $('a[href^="mailto:"]').each((_, el) => {
    if (email) return;
    const href = $(el).attr("href") ?? "";
    const addr = href.replace(/^mailto:/i, "").split("?")[0].trim();
    if (addr) email = decodeURIComponent(addr);
  });

  // Phone: first tel link, else a regex match against visible body text.
  let phone: string | null = null;
  $('a[href^="tel:"]').each((_, el) => {
    if (phone) return;
    const href = $(el).attr("href") ?? "";
    const num = href.replace(/^tel:/i, "").trim();
    if (num) phone = num;
  });
  if (!phone) {
    const bodyText = $("body").text();
    const match = bodyText.match(PHONE_REGEX);
    if (match) phone = match[0].trim();
  }

  // Address: structured data only — free-text address parsing is too
  // unreliable to trust, and we'd rather show "not found" than a wrong guess.
  let address: string | null = null;
  $('script[type="application/ld+json"]').each((_, el) => {
    if (address) return;
    try {
      const json = JSON.parse($(el).contents().text());
      const entries = Array.isArray(json) ? json : [json];
      for (const entry of entries) {
        const a = entry?.address;
        if (a && typeof a === "object") {
          const parts = [a.streetAddress, a.addressLocality, a.addressRegion, a.postalCode].filter(Boolean);
          if (parts.length) address = parts.join(", ");
        }
      }
    } catch {
      // ignore malformed JSON-LD
    }
  });

  // Social + Google profile links: scan all anchors once.
  const socialLinks: Record<string, string> = {};
  let googleProfile: string | null = null;
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href") ?? "";
    if (!href) return;
    if (!googleProfile && (href.includes("google.com/maps") || href.includes("g.page"))) {
      googleProfile = href;
      return;
    }
    for (const [domain, key] of Object.entries(SOCIAL_DOMAINS)) {
      if (href.includes(domain) && !socialLinks[key]) {
        try {
          socialLinks[key] = new URL(href, baseUrl).toString();
        } catch {
          socialLinks[key] = href;
        }
      }
    }
  });

  return {
    name: name ? decodeHtmlEntities(name).trim() : null,
    email,
    phone,
    address: address ? decodeHtmlEntities(address).trim() : null,
    socialLinks,
    googleProfile,
  };
}
