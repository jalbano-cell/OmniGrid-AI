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

  const allChecks = [...Object.values(categories), images].flatMap((c) => c.checks);
  const strengths = allChecks.filter((c) => c.pass).map((c) => c.message);
  const weaknesses = allChecks.filter((c) => !c.pass).map((c) => c.message);
  const recommendations = weaknesses.map((w) => toRecommendation(w));

  if (brokenLinks.length > 0) {
    weaknesses.push(`${brokenLinks.length} broken or unreachable internal link(s) detected`);
    recommendations.push("Fix the broken internal links found during the audit so visitors and search engines don't hit dead ends.");
  } else {
    strengths.push("No broken internal links detected in the sampled pages");
  }

  // Opportunity score: rewards agencies most where the site is weak AND the
  // business is reachable (worth the outreach effort). A pristine site gets
  // a low opportunity score regardless of contactability.
  let opportunityScore = Math.round(100 - overallScore);
  if (contactInfoFound) opportunityScore += 10;
  if (overallScore >= 85) opportunityScore -= 20;
  opportunityScore = Math.max(0, Math.min(100, opportunityScore));

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
        hasSsl: fetched.hasSsl,
        loadTimeMs: fetched.tookMs,
        contactInfoFound,
        strengths,
        weaknesses,
        recommendations,
        brokenLinks,
        rawFindings: JSON.parse(JSON.stringify({ imageOptimization: images, fetchStatus: fetched.status })),
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
