import * as cheerio from "cheerio";
import type { CheerioAPI } from "cheerio";

export interface Check {
  category: string;
  points: number;
  maxPoints: number;
  pass: boolean;
  message: string;
}

export interface CategoryResult {
  score: number; // 0-100
  checks: Check[];
}

function scoreCategory(checks: Check[]): CategoryResult {
  const earned = checks.reduce((sum, c) => sum + (c.pass ? c.points : 0), 0);
  const max = checks.reduce((sum, c) => sum + c.maxPoints, 0);
  return { score: max > 0 ? Math.round((earned / max) * 100) : 0, checks };
}

const CTA_WORDS = [
  "contact us", "book now", "book a", "call now", "get a quote", "request a quote",
  "schedule", "buy now", "shop now", "order online", "get started", "learn more",
  "free estimate", "free consultation", "book an appointment", "call today",
];

const TRUST_WORDS = ["testimonial", "review", "certified", "licensed", "insured", "guarantee", "award", "accredited", "bbb", "since 19", "since 20", "years of experience", "years in business"];

export function analyzeUiUx($: CheerioAPI): CategoryResult {
  const hasHeader = $("header").length > 0;
  const hasNav = $("nav").length > 0;
  const hasMain = $("main").length > 0;
  const hasFooter = $("footer").length > 0;
  const h1Count = $("h1").length;
  const hasHeadingHierarchy = h1Count >= 1 && h1Count <= 2;
  const bodyText = $("body").text().trim();

  return scoreCategory([
    { category: "uiux", points: 20, maxPoints: 20, pass: hasHeader, message: hasHeader ? "Page uses a <header> landmark" : "No <header> element found" },
    { category: "uiux", points: 20, maxPoints: 20, pass: hasNav, message: hasNav ? "Page uses a <nav> landmark" : "No <nav> element found" },
    { category: "uiux", points: 20, maxPoints: 20, pass: hasMain, message: hasMain ? "Page uses a <main> landmark" : "No <main> element found" },
    { category: "uiux", points: 15, maxPoints: 15, pass: hasFooter, message: hasFooter ? "Page has a footer" : "No <footer> element found" },
    { category: "uiux", points: 15, maxPoints: 15, pass: hasHeadingHierarchy, message: hasHeadingHierarchy ? "Has a clear single H1 heading" : `Page has ${h1Count} <h1> tags (expected exactly 1)` },
    { category: "uiux", points: 10, maxPoints: 10, pass: bodyText.length > 200, message: bodyText.length > 200 ? "Homepage has substantive body content" : "Homepage has very little visible text content" },
  ]);
}

export function analyzeMobile($: CheerioAPI): CategoryResult {
  const viewport = $('meta[name="viewport"]').attr("content") ?? "";
  const hasResponsiveViewport = /width=device-width/i.test(viewport);
  const imagesWithSrcset = $("img[srcset]").length;
  const totalImages = $("img").length;
  const appleMobileCapable = $('meta[name="apple-mobile-web-app-capable"]').length > 0;

  return scoreCategory([
    { category: "mobile", points: 60, maxPoints: 60, pass: hasResponsiveViewport, message: hasResponsiveViewport ? "Responsive viewport meta tag present" : "Missing responsive viewport meta tag (width=device-width) — page likely won't scale correctly on phones" },
    { category: "mobile", points: 25, maxPoints: 25, pass: totalImages > 0 && imagesWithSrcset / totalImages > 0.3, message: totalImages === 0 ? "No images to evaluate for responsive sizing" : imagesWithSrcset / totalImages > 0.3 ? "Many images use responsive srcset" : "Few or no images use responsive srcset for different screen sizes" },
    { category: "mobile", points: 15, maxPoints: 15, pass: appleMobileCapable, message: appleMobileCapable ? "Declares mobile web app capability" : "No mobile web app meta tags found" },
  ]);
}

export function analyzeNavigation($: CheerioAPI): CategoryResult {
  const navLinks = $("nav a, header a").length;
  const footerLinks = $("footer a").length;
  const hasSkipLink = $('a[href="#main"], a[href="#content"]').length > 0;

  return scoreCategory([
    { category: "navigation", points: 45, maxPoints: 45, pass: navLinks >= 3, message: navLinks >= 3 ? `Primary navigation has ${navLinks} links` : `Primary navigation only has ${navLinks} link(s)` },
    { category: "navigation", points: 35, maxPoints: 35, pass: footerLinks >= 3, message: footerLinks >= 3 ? `Footer provides ${footerLinks} secondary links` : "Footer has few or no secondary navigation links" },
    { category: "navigation", points: 20, maxPoints: 20, pass: hasSkipLink, message: hasSkipLink ? "Has a skip-to-content link" : "No skip-to-content link for keyboard users" },
  ]);
}

export function analyzeAccessibility($: CheerioAPI): CategoryResult {
  const images = $("img");
  const imagesWithAlt = images.filter((_, el) => Boolean($(el).attr("alt")?.trim())).length;
  const totalImages = images.length;
  const altRatio = totalImages > 0 ? imagesWithAlt / totalImages : 1;
  const hasLang = Boolean($("html").attr("lang"));
  const inputs = $("input:not([type=hidden]), textarea, select");
  const labeledInputs = inputs.filter((_, el) => {
    const id = $(el).attr("id");
    const ariaLabel = $(el).attr("aria-label");
    return Boolean(ariaLabel) || (Boolean(id) && $(`label[for="${id}"]`).length > 0);
  }).length;
  const totalInputs = inputs.length;
  const labelRatio = totalInputs > 0 ? labeledInputs / totalInputs : 1;

  return scoreCategory([
    { category: "accessibility", points: 35, maxPoints: 35, pass: altRatio >= 0.8, message: totalImages === 0 ? "No images on the page to evaluate" : `${imagesWithAlt} of ${totalImages} images have alt text` },
    { category: "accessibility", points: 25, maxPoints: 25, pass: hasLang, message: hasLang ? "Document declares a language (lang attribute)" : "Missing lang attribute on <html>" },
    { category: "accessibility", points: 25, maxPoints: 25, pass: labelRatio >= 0.8, message: totalInputs === 0 ? "No form fields on the page to evaluate" : `${labeledInputs} of ${totalInputs} form fields have associated labels` },
    { category: "accessibility", points: 15, maxPoints: 15, pass: $('[role]').length > 0 || $("nav, main, header, footer").length >= 2, message: "Uses semantic landmarks or ARIA roles" },
  ]);
}

export function analyzeSeo($: CheerioAPI, url: string): CategoryResult {
  const title = $("title").text().trim();
  const description = $('meta[name="description"]').attr("content")?.trim() ?? "";
  const canonical = $('link[rel="canonical"]').length > 0;
  const ogTags = $('meta[property^="og:"]').length > 0;
  const structuredData = $('script[type="application/ld+json"]').length > 0;
  const h1Count = $("h1").length;
  const robotsBlocked = /noindex/i.test($('meta[name="robots"]').attr("content") ?? "");

  return scoreCategory([
    { category: "seo", points: 20, maxPoints: 20, pass: title.length >= 10 && title.length <= 65, message: title ? `Title tag is ${title.length} characters ("${title}")` : "Missing <title> tag" },
    { category: "seo", points: 20, maxPoints: 20, pass: description.length >= 50 && description.length <= 160, message: description ? `Meta description is ${description.length} characters` : "Missing meta description" },
    { category: "seo", points: 15, maxPoints: 15, pass: canonical, message: canonical ? "Has a canonical link tag" : "No canonical link tag" },
    { category: "seo", points: 15, maxPoints: 15, pass: ogTags, message: ogTags ? "Has Open Graph tags for social sharing" : "No Open Graph meta tags found" },
    { category: "seo", points: 15, maxPoints: 15, pass: structuredData, message: structuredData ? "Uses structured data (JSON-LD)" : "No structured data (JSON-LD) found" },
    { category: "seo", points: 10, maxPoints: 10, pass: h1Count === 1, message: h1Count === 1 ? "Exactly one H1 heading" : `${h1Count} H1 headings found (expected 1)` },
    { category: "seo", points: 5, maxPoints: 5, pass: !robotsBlocked, message: robotsBlocked ? `Site at ${url} blocks search indexing (noindex)` : "Page is indexable by search engines" },
  ]);
}

export function analyzePerformance($: CheerioAPI, html: string, tookMs: number | null): CategoryResult {
  const sizeKb = Buffer.byteLength(html, "utf8") / 1024;
  const scripts = $("script[src]").length;
  const stylesheets = $('link[rel="stylesheet"]').length;
  const lazyImages = $("img[loading=lazy]").length;
  const totalImages = $("img").length;

  return scoreCategory([
    { category: "performance", points: 30, maxPoints: 30, pass: tookMs === null || tookMs < 1500, message: tookMs === null ? "Load time unavailable" : `Homepage responded in ${tookMs}ms`, },
    { category: "performance", points: 25, maxPoints: 25, pass: sizeKb < 300, message: `HTML document is ${sizeKb.toFixed(0)}KB` },
    { category: "performance", points: 20, maxPoints: 20, pass: scripts + stylesheets < 20, message: `Page loads ${scripts} external scripts and ${stylesheets} stylesheets` },
    { category: "performance", points: 25, maxPoints: 25, pass: totalImages === 0 || lazyImages / totalImages > 0.3, message: totalImages === 0 ? "No images to evaluate for lazy loading" : `${lazyImages} of ${totalImages} images use lazy loading` },
  ]);
}

export function analyzeCta($: CheerioAPI): CategoryResult {
  const bodyText = $("body").text().toLowerCase();
  const ctaHits = CTA_WORDS.filter((w) => bodyText.includes(w));
  const buttonLikeElements = $('a.btn, a.button, button, [class*="btn-"], [class*="button-"]').length;
  const hasPhoneCta = $('a[href^="tel:"]').length > 0;
  const hasFormCta = $("form").length > 0;

  return scoreCategory([
    { category: "cta", points: 35, maxPoints: 35, pass: ctaHits.length > 0, message: ctaHits.length > 0 ? `Uses clear call-to-action language ("${ctaHits[0]}")` : "No clear call-to-action language found on the homepage" },
    { category: "cta", points: 30, maxPoints: 30, pass: buttonLikeElements > 0, message: buttonLikeElements > 0 ? `${buttonLikeElements} button-styled call-to-action element(s) found` : "No visually distinct call-to-action buttons found" },
    { category: "cta", points: 20, maxPoints: 20, pass: hasPhoneCta, message: hasPhoneCta ? "Click-to-call phone link present" : "No click-to-call phone link found" },
    { category: "cta", points: 15, maxPoints: 15, pass: hasFormCta, message: hasFormCta ? "Has a contact/lead form" : "No contact or lead-capture form found" },
  ]);
}

export function analyzeTrust($: CheerioAPI, hasSsl: boolean, contactInfoFound: boolean): CategoryResult {
  const bodyText = $("body").text().toLowerCase();
  const trustHits = TRUST_WORDS.filter((w) => bodyText.includes(w));
  const hasPrivacyLink = $('a[href*="privacy" i]').length > 0;
  const hasTermsLink = $('a[href*="terms" i]').length > 0;

  return scoreCategory([
    { category: "trust", points: 25, maxPoints: 25, pass: hasSsl, message: hasSsl ? "Site is served over HTTPS" : "Site is not served over HTTPS — modern browsers flag this as 'Not Secure'" },
    { category: "trust", points: 25, maxPoints: 25, pass: contactInfoFound, message: contactInfoFound ? "Contact information is visible on the site" : "No visible contact information (email/phone) found" },
    { category: "trust", points: 25, maxPoints: 25, pass: trustHits.length > 0, message: trustHits.length > 0 ? `Shows trust signals (e.g. "${trustHits[0]}")` : "No testimonials, reviews, or certifications mentioned on the homepage" },
    { category: "trust", points: 25, maxPoints: 25, pass: hasPrivacyLink || hasTermsLink, message: hasPrivacyLink || hasTermsLink ? "Has a privacy policy or terms link" : "No privacy policy or terms of service link found" },
  ]);
}

export function analyzeBrand($: CheerioAPI): CategoryResult {
  const hasFavicon = $('link[rel*="icon"]').length > 0;
  const hasThemeColor = $('meta[name="theme-color"]').length > 0;
  const logoImg = $('img[alt*="logo" i], img[class*="logo" i], [class*="logo" i] img').length > 0;
  const consistentTitle = $("title").text().trim().length > 0 && $('meta[property="og:site_name"]').length > 0;

  return scoreCategory([
    { category: "brand", points: 30, maxPoints: 30, pass: hasFavicon, message: hasFavicon ? "Has a favicon" : "No favicon found" },
    { category: "brand", points: 25, maxPoints: 25, pass: logoImg, message: logoImg ? "Has an identifiable logo image" : "No clearly marked logo image found" },
    { category: "brand", points: 20, maxPoints: 20, pass: hasThemeColor, message: hasThemeColor ? "Declares a brand theme color for mobile browser chrome" : "No theme-color meta tag" },
    { category: "brand", points: 25, maxPoints: 25, pass: consistentTitle, message: consistentTitle ? "Site name is consistently declared" : "Site name isn't consistently declared across title/meta tags" },
  ]);
}

export async function checkBrokenLinks($: CheerioAPI, baseUrl: string, sampleSize = 8): Promise<string[]> {
  const hrefs = new Set<string>();
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:") || href.startsWith("javascript:")) return;
    try {
      const abs = new URL(href, baseUrl).toString();
      if (new URL(abs).hostname === new URL(baseUrl).hostname) hrefs.add(abs);
    } catch {
      // ignore unparsable hrefs
    }
  });

  const sample = Array.from(hrefs).slice(0, sampleSize);
  const broken: string[] = [];

  await Promise.all(
    sample.map(async (link) => {
      try {
        const res = await fetch(link, { method: "HEAD", signal: AbortSignal.timeout(6000) });
        if (res.status >= 400) broken.push(`${link} (HTTP ${res.status})`);
      } catch {
        broken.push(`${link} (unreachable)`);
      }
    })
  );

  return broken;
}

export function analyzeImageOptimization($: CheerioAPI): CategoryResult {
  const images = $("img");
  const total = images.length;
  const missingDimensions = images.filter((_, el) => !$(el).attr("width") || !$(el).attr("height")).length;
  const dataUriImages = images.filter((_, el) => (($(el).attr("src") ?? "")).startsWith("data:")).length;
  const modernFormat = images.filter((_, el) => /\.(webp|avif)(\?|$)/i.test($(el).attr("src") ?? "")).length;

  return scoreCategory([
    { category: "images", points: 40, maxPoints: 40, pass: total === 0 || missingDimensions / total < 0.3, message: total === 0 ? "No images to evaluate" : `${missingDimensions} of ${total} images are missing width/height attributes (can cause layout shift)` },
    { category: "images", points: 30, maxPoints: 30, pass: dataUriImages === 0, message: dataUriImages > 0 ? `${dataUriImages} image(s) are inlined as data URIs, bloating page size` : "No bloated inline data-URI images" },
    { category: "images", points: 30, maxPoints: 30, pass: total === 0 || modernFormat > 0, message: total === 0 ? "No images to evaluate" : modernFormat > 0 ? "Uses modern image formats (WebP/AVIF)" : "No modern image formats (WebP/AVIF) detected" },
  ]);
}

export { cheerio };
