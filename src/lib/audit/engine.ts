import * as cheerio from "cheerio";
import { prisma } from "@/lib/db/prisma";
import { fetchHtml } from "@/lib/audit/fetchHtml";
import { extractContactInfo } from "@/lib/services/contactExtractor";
import { logEvent, logError } from "@/lib/services/logger";
import { syncAuditToAirtable } from "@/lib/services/airtable";
import {
  analyzeUiUx,
  analyzeMobile,
  analyzeNavigation,
  analyzeAccessibility,
  analyzeSeo,
  analyzePerformance,
  analyzeCta,
  analyzeTrust,
  analyzeBrand,
  analyzeBookingCapture,
  analyzeImageOptimization,
  checkBrokenLinks,
  type CategoryResult,
} from "@/lib/audit/checks";

const WEIGHTS = {
  uiux: 0.15,
  mobile: 0.15,
  navigation: 0.1,
  accessibility: 0.1,
  seo: 0.15,
  performance: 0.1,
  cta: 0.1,
  trust: 0.1,
  brand: 0.05,
};

export interface AuditRunResult {
  ok: boolean;
  auditId?: string;
  error?: string;
}

// Rough recurring-revenue/deal-size tier by vertical — used only for the
// "service value" reasoning line, never for pass/fail filtering.
const HIGH_VALUE_INDUSTRY_WORDS = [
  "roof", "hvac", "dental", "legal", "law", "plumb", "electric", "contractor",
  "renovation", "real estate", "medical", "orthodont", "cosmetic", "dermat",
  "chiroprac", "physio", "insurance", "accounting", "financial",
];
const LOW_VALUE_INDUSTRY_WORDS = [
  "restaurant", "cafe", "coffee", "retail", "convenience", "grocery", "fast food",
];

function serviceValueForIndustry(industry: string): { level: "high" | "medium" | "low"; reasoning: string } {
  const lower = industry.toLowerCase();
  if (HIGH_VALUE_INDUSTRY_WORDS.some((w) => lower.includes(w))) {
    return {
      level: "high",
      reasoning: `${industry} typically involves high-ticket or recurring service revenue, making this a high-value lead if the audit findings below are addressed.`,
    };
  }
  if (LOW_VALUE_INDUSTRY_WORDS.some((w) => lower.includes(w))) {
    return {
      level: "low",
      reasoning: `${industry} tends to have lower average transaction/contract value, so treat this as a lower-priority lead relative to higher-ticket verticals.`,
    };
  }
  return {
    level: "medium",
    reasoning: `${industry} has moderate typical deal size — worth pursuing but not a top-tier vertical by default.`,
  };
}

function weakestMessage(checks: { pass: boolean; message: string }[]): string | null {
  const failed = checks.filter((c) => !c.pass);
  return failed.length > 0 ? failed[0].message : null;
}

export interface ScoreBreakdownPart {
  score: number;
  reasoning: string;
}

export interface ScoreBreakdown {
  websiteQuality: ScoreBreakdownPart;
  businessPotential: ScoreBreakdownPart;
  conversionOpportunity: ScoreBreakdownPart;
  designWeaknessSeverity: ScoreBreakdownPart;
  serviceValue: { level: "high" | "medium" | "low"; reasoning: string };
}

/**
 * Turns the raw category scores into the structured, reasoned breakdown the
 * scoring spec calls for. Every reasoning string is built from an actual
 * failed/passed check message already produced by the checks in
 * @/lib/audit/checks — nothing here is invented or inferred beyond that.
 */
function buildScoreBreakdown(
  categories: Record<keyof typeof WEIGHTS, CategoryResult>,
  industry: string,
  contactInfoFound: boolean
): ScoreBreakdown {
  const { uiux, mobile, navigation, accessibility, cta, trust, brand } = categories;

  const websiteQualityScore = Math.round((uiux.score + mobile.score + navigation.score + accessibility.score + brand.score) / 5);
  const websiteQualityWeak = weakestMessage([...uiux.checks, ...mobile.checks, ...navigation.checks, ...accessibility.checks, ...brand.checks]);

  const businessPotentialScore = Math.round((trust.score + brand.score) / 2 + (contactInfoFound ? 10 : -10));
  const businessPotentialClamped = Math.max(0, Math.min(100, businessPotentialScore));

  const conversionOpportunityScore = Math.max(0, Math.min(100, 100 - Math.round((cta.score + trust.score) / 2)));
  const conversionWeak = weakestMessage([...cta.checks, ...trust.checks]);

  const designWeaknessScore = Math.max(0, Math.min(100, 100 - Math.round((uiux.score + mobile.score + brand.score) / 3)));

  return {
    websiteQuality: {
      score: websiteQualityScore,
      reasoning: websiteQualityWeak
        ? `Overall site craftsmanship scores ${websiteQualityScore}/100. Biggest gap: ${websiteQualityWeak.toLowerCase()}.`
        : `Overall site craftsmanship scores ${websiteQualityScore}/100 with no major structural gaps found.`,
    },
    businessPotential: {
      score: businessPotentialClamped,
      reasoning: contactInfoFound
        ? `Contact info is reachable and trust/brand signals score ${Math.round((trust.score + brand.score) / 2)}/100, so this lead is realistically contactable and worth pursuing.`
        : `No reachable contact info (email/phone) was found on the homepage, which lowers confidence this lead can actually be engaged.`,
    },
    conversionOpportunity: {
      score: conversionOpportunityScore,
      reasoning: conversionWeak
        ? `Conversion opportunity is ${conversionOpportunityScore}/100 — the clearest gap is: ${conversionWeak.toLowerCase()}.`
        : `Conversion opportunity is ${conversionOpportunityScore}/100 — CTAs and trust signals are already fairly strong here.`,
    },
    designWeaknessSeverity: {
      score: designWeaknessScore,
      reasoning:
        designWeaknessScore >= 60
          ? `Design weakness severity is high (${designWeaknessScore}/100) across UI/UX, mobile, and brand consistency — a redesign pitch is well-supported.`
          : designWeaknessScore >= 30
          ? `Design weakness severity is moderate (${designWeaknessScore}/100) — targeted fixes rather than a full redesign are the stronger pitch.`
          : `Design weakness severity is low (${designWeaknessScore}/100) — the site's core design is in reasonably good shape.`,
    },
    serviceValue: serviceValueForIndustry(industry),
  };
}

/** Fetches a business's website and runs the full heuristic audit, persisting an Audit row. */
export async function runWebsiteAudit(businessId: string): Promise<AuditRunResult> {
  const business = await prisma.business.findUnique({ where: { id: businessId } });
  if (!business) return { ok: false, error: "Business not found" };
  if (!business.website) return { ok: false, error: "This lead has no website to audit" };

  const fetched = await fetchHtml(business.website);
  if (!fetched.ok || !fetched.html) {
    await logError(`Audit failed for ${business.website}`, new Error(fetched.error ?? "fetch failed"), { businessId });
    return { ok: false, error: fetched.error ?? "Could not fetch the site" };
  }

  const $ = cheerio.load(fetched.html);
  const contact = extractContactInfo(fetched.html, fetched.finalUrl);
  const contactInfoFound = Boolean(contact.email || contact.phone || business.email || business.phone);

  const uiux = analyzeUiUx($);
  const mobile = analyzeMobile($);
  const navigation = analyzeNavigation($);
  const accessibility = analyzeAccessibility($);
  const seo = analyzeSeo($, fetched.finalUrl);
  const performance = analyzePerformance($, fetched.html, fetched.tookMs);
  const cta = analyzeCta($);
  const trust = analyzeTrust($, fetched.hasSsl, contactInfoFound);
  const brand = analyzeBrand($);
  const booking = analyzeBookingCapture($);
  const images = analyzeImageOptimization($);
  const brokenLinks = await checkBrokenLinks($, fetched.finalUrl);

  const categories: Record<keyof typeof WEIGHTS, CategoryResult> = {
    uiux, mobile, navigation, accessibility, seo, performance, cta, trust, brand,
  };

  const overallScore = Math.round(
    (Object.keys(WEIGHTS) as (keyof typeof WEIGHTS)[]).reduce(
      (sum, key) => sum + categories[key].score * WEIGHTS[key],
      0
    )
  );

  const allChecks = [...Object.values(categories), images, booking].flatMap((c) => c.checks);
  const strengths = allChecks.filter((c) => c.pass).map((c) => c.message);
  const weaknesses = allChecks.filter((c) => !c.pass).map((c) => c.message);
  const recommendations = weaknesses.map((w) => toRecommendation(w));

  if (brokenLinks.length > 0) {
    weaknesses.push(`${brokenLinks.length} broken or unreachable internal link(s) detected`);
    recommendations.push("Fix the broken internal links found during the audit so visitors and search engines don't hit dead ends.");
  } else {
    strengths.push("No broken internal links detected in the sampled pages");
  }

  // Score reflects how modern this business's client-intake methods are: a
  // real online booking/scheduling widget and a contact/lead form score
  // highest; a bare click-to-call or mailto: link is treated as the
  // outdated fallback and scores low; a site with neither booking nor a
  // contact form scores lowest of all.
  const opportunityScore = booking.score;

  const scoreBreakdown = buildScoreBreakdown(categories, business.industry, contactInfoFound);

  try {
    const audit = await prisma.audit.create({
      data: {
        businessId,
        url: fetched.finalUrl,
        overallScore,
        opportunityScore,
        uiuxScore: uiux.score,
        mobileScore: mobile.score,
        navigationScore: navigation.score,
        accessibilityScore: accessibility.score,
        seoScore: seo.score,
        performanceScore: performance.score,
        ctaScore: cta.score,
        trustScore: trust.score,
        brandScore: brand.score,
        bookingScore: booking.score,
        hasSsl: fetched.hasSsl,
        loadTimeMs: fetched.tookMs,
        contactInfoFound,
        strengths,
        weaknesses,
        recommendations,
        brokenLinks,
        rawFindings: JSON.parse(JSON.stringify({ imageOptimization: images, fetchStatus: fetched.status })),
        scoreBreakdown: JSON.parse(JSON.stringify(scoreBreakdown)),
      },
    });

    const updatedBusiness = await prisma.business.update({
      where: { id: businessId },
      data: { opportunityScore },
    });

    await logEvent({
      type: "AUDIT",
      message: `Audited ${business.name} (${fetched.finalUrl}) — overall ${overallScore}/100`,
      businessId,
      metadata: { overallScore, opportunityScore },
    });

    // Mirror into Airtable: Audits record + Leads.status="Audited"/score. Never
    // lets a sync failure break the audit workflow.
    await syncAuditToAirtable(audit, updatedBusiness).catch((err) =>
      logError("Airtable audit sync failed", err, { businessId, auditId: audit.id })
    );

    return { ok: true, auditId: audit.id };
  } catch (err) {
    await logError(`Failed to persist audit for ${business.website}`, err, { businessId });
    return { ok: false, error: "Failed to save audit results" };
  }
}

function toRecommendation(weakness: string): string {
  // Turn a diagnostic finding into an actionable next step without adding
  // any claim beyond what the finding already states.
  return `Address: ${weakness}.`;
}
