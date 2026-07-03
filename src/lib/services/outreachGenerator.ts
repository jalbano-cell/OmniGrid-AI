import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/db/prisma";
import { logEvent, logError } from "@/lib/services/logger";
import { getSettings } from "@/lib/services/settings";
import { syncOutreachCreatedToAirtable } from "@/lib/services/airtable";
import { researchBusinessProfile, type BusinessProfile } from "@/lib/services/businessProfile";
import type { Business } from "@prisma/client";

export interface GeneratedEmail {
  subject: string;
  body: string;
  summary: string;
  confidenceScore: number;
}

const TARGET_MIN_WORDS = 80;
const TARGET_MAX_WORDS = 140;

const BANNED_PHRASES = [
  "take your business to the next level",
  "unlock your potential",
  "game-changer",
  "game changer",
  "revolutionize",
  "cutting-edge",
  "state-of-the-art",
  "in today's digital age",
  "look no further",
  "leverage",
  "streamline your workflow",
  "synergy",
  "seamless solution",
  "disrupt",
  "supercharge",
];

// Our positioning changed: we no longer sell website redesigns/audits, so no
// generated email — deterministic or Claude-drafted — may touch these topics.
// This is a hard reject, not a style preference: any match falls back to the
// deterministic template, which structurally never mentions any of these.
const FORBIDDEN_TOPICS = [
  "redesign", "outdated website", "poor seo", "seo score", "slow loading",
  "slow load time", "page speed", "bad ux", "bad ui", "ui/ux", "accessibility issue",
  "conversion optimization", "conversion rate", "website audit", "website score",
  "web design", "website design",
];

export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function containsForbiddenTopic(text: string): string | null {
  const lower = text.toLowerCase();
  return FORBIDDEN_TOPICS.find((topic) => lower.includes(topic)) ?? null;
}

function areaFor(business: Business, profile: BusinessProfile): string {
  return profile.serviceArea || [business.city, business.province].filter(Boolean).join(", ");
}

function buildOpener(business: Business, profile: BusinessProfile): string {
  const area = areaFor(business, profile);
  if (profile.foundedYear) {
    return `I came across ${business.name} and saw you've been serving ${area} since ${profile.foundedYear}.`;
  }
  if (profile.yearsInBusiness) {
    return `I came across ${business.name} and saw you've got ${profile.yearsInBusiness}+ years serving ${area}.`;
  }
  if (profile.services[0]) {
    return `I came across ${business.name} and saw you handle ${profile.services[0].toLowerCase()} for ${area}.`;
  }
  return `I came across ${business.name} while looking at ${business.industry.toLowerCase()} businesses in ${area}.`;
}

/**
 * Deterministic, template-based writer. Zero hallucination risk: every
 * personalized detail comes directly from the researched BusinessProfile
 * (itself extracted verbatim from the business's own site), never invented.
 * This is the default writer and the guaranteed fallback if Claude isn't
 * configured, the API call fails, or the Claude draft strays into a
 * forbidden topic or outside the target word range.
 *
 * Structure: (1) a factual, personalized opener, (2) the core message framed
 * as a possibility ("if this is something your team currently handles
 * manually...") rather than an assumed problem, (3) a soft, no-pressure CTA.
 */
export function buildDeterministicEmail(
  business: Business,
  profile: BusinessProfile,
  signature: string,
  agencyName: string
): GeneratedEmail {
  const closing = signature || agencyName || "OmniGrid Digital";

  const subject = `Quick question about estimate follow-up at ${business.name}`;

  const bodyParts = [
    `Hi ${business.name} team,`,
    ``,
    buildOpener(business, profile),
    ``,
    `A lot of service businesses lose potential jobs simply because quote requests and estimates are hard to consistently follow up on. If that's something your team currently handles manually, we build lightweight automation that follows up on estimates automatically, cuts down on missed opportunities, and helps turn more quotes into booked jobs — without asking you to change how you already work.`,
    ``,
    `It's meant to fit alongside whatever process you're using now, rolled out gradually rather than all at once.`,
    ``,
    `Worth a quick conversation? Happy to share how it works.`,
    ``,
    closing,
  ];

  let body = bodyParts.join("\n");

  // Trim toward the target range by dropping the rollout sentence first —
  // never truncate mid-sentence, never pad with invented content.
  if (countWords(body) > TARGET_MAX_WORDS) {
    body = bodyParts.filter((line) => !line.startsWith("It's meant to fit")).join("\n");
  }

  const factsUsed = [profile.foundedYear, profile.yearsInBusiness, profile.services[0], profile.serviceArea].filter(
    Boolean
  ).length;
  const summary = `Estimate-follow-up outreach for ${business.name}, personalized with ${factsUsed} researched business fact(s).`;
  const confidenceScore = Math.min(90, 55 + factsUsed * 10);

  return { subject, body, summary, confidenceScore };
}

async function buildWithClaude(
  business: Business,
  profile: BusinessProfile,
  signature: string,
  agencyName: string
): Promise<GeneratedEmail | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const message = await client.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 900,
      system:
        "You write short outreach emails on behalf of a company that helps local service businesses (contractors, HVAC, roofing, landscaping, etc.) automate their estimate and quote follow-up process. " +
        "We do NOT sell website redesigns, SEO, or website improvements — never mention website design, SEO, page speed, UI/UX, accessibility, conversion rate, or website audits/scoring, even in passing. " +
        "Personalize ONLY using the factual business details provided (services, service area, founded year, years in business, about-page summary) — if a fact is null/empty, do not mention it and never invent one. " +
        "Core message: many service businesses lose potential jobs because quote requests and estimates are hard to consistently follow up on; we build automation that helps them follow up faster while fitting into their existing process instead of replacing it, rolling out gradually. " +
        'Frame this as a possibility, never an assumed problem — use phrasing like "If this is something your team currently handles manually..." or "If estimate follow-up is something that still takes time each week...". ' +
        "Tone: one local business owner writing to another — conversational, concise, professional, helpful, low-pressure. Do not sound like a marketing agency, do not use buzzwords or exaggerated claims, and do not sound AI-generated. " +
        `Never use any of these words/phrases or close equivalents: ${BANNED_PHRASES.join(", ")}. ` +
        'End with ONE soft, low-pressure call to action, e.g. "Curious if this is something you\'re exploring", "Happy to share how it works", "Worth a quick conversation?", or "Let me know if you\'d like to see an example." Never use aggressive sales language or demand a call. ' +
        `The email body MUST be ${TARGET_MIN_WORDS}-${TARGET_MAX_WORDS} words. ` +
        'Respond with ONLY minified JSON: {"subject": string, "body": string, "summary": string, "confidenceScore": number 0-100}. ' +
        "confidenceScore reflects how well-grounded the email is in the given factual details (higher when more real facts were available and used).",
      messages: [
        {
          role: "user",
          content:
            `Business name: ${business.name}\n` +
            `Industry: ${business.industry}\n` +
            `Location: ${[business.city, business.province].filter(Boolean).join(", ")}\n` +
            `Agency name: ${agencyName || "OmniGrid Digital"}\n` +
            `Signature to close with: ${signature || "(none provided, sign off simply)"}\n\n` +
            `Known factual details about this business (only use what's present; omit anything null/empty from the email):\n${JSON.stringify(
              profile,
              null,
              2
            )}`,
        },
      ],
    });

    const text = message.content.filter((b) => b.type === "text").map((b) => b.text).join("");
    const parsed = JSON.parse(text) as GeneratedEmail;
    if (!parsed.subject || !parsed.body) return null;

    const wordCount = countWords(parsed.body);
    if (wordCount < 50 || wordCount > TARGET_MAX_WORDS + 40) {
      await logEvent({
        type: "EMAIL_GENERATED",
        message: `Claude draft for ${business.name} was ${wordCount} words (outside allowed range) — falling back to template`,
        businessId: business.id,
      });
      return null;
    }

    const forbidden = containsForbiddenTopic(`${parsed.subject} ${parsed.body}`);
    if (forbidden) {
      await logEvent({
        type: "EMAIL_GENERATED",
        message: `Claude draft for ${business.name} referenced a retired topic ("${forbidden}") — falling back to template`,
        businessId: business.id,
      });
      return null;
    }

    return {
      subject: parsed.subject,
      body: parsed.body,
      summary: parsed.summary || "AI-generated outreach draft about estimate follow-up automation.",
      confidenceScore: Math.max(0, Math.min(100, Math.round(parsed.confidenceScore ?? 70))),
    };
  } catch (err) {
    await logError("Claude email drafting failed, falling back to template", err, { businessId: business.id });
    return null;
  }
}

export interface OutreachGenerationResult {
  ok: boolean;
  outreachId?: string;
  error?: string;
}

export async function generateOutreachEmail(businessId: string): Promise<OutreachGenerationResult> {
  const business = await prisma.business.findUnique({ where: { id: businessId } });
  if (!business) return { ok: false, error: "Business not found" };

  const settings = await getSettings();
  const profile = await researchBusinessProfile(business);

  const generated =
    (await buildWithClaude(business, profile, settings.emailSignature, settings.agencyName)) ??
    buildDeterministicEmail(business, profile, settings.emailSignature, settings.agencyName);

  try {
    const outreach = await prisma.outreach.create({
      data: {
        businessId,
        subject: generated.subject,
        body: generated.body,
        summary: generated.summary,
        confidenceScore: generated.confidenceScore,
        toEmail: business.email,
        status: "DRAFTED",
        sequenceNumber: 0,
      },
    });

    await prisma.statusEvent.create({
      data: { businessId, status: "DRAFTED", note: "Outreach email drafted" },
    });
    await prisma.business.update({
      where: { id: businessId },
      data: { status: business.status === "NEW" ? "DRAFTED" : business.status },
    });

    await logEvent({
      type: "EMAIL_GENERATED",
      message: `Drafted outreach email for ${business.name}`,
      businessId,
      metadata: { outreachId: outreach.id, confidenceScore: generated.confidenceScore, wordCount: countWords(generated.body) },
    });

    // Mirror into Airtable: Outreach record with status "Pending Approval".
    // Never lets a sync failure break the generation workflow.
    await syncOutreachCreatedToAirtable(outreach, business).catch((err) =>
      logError("Airtable outreach sync failed", err, { businessId, outreachId: outreach.id })
    );

    return { ok: true, outreachId: outreach.id };
  } catch (err) {
    await logError(`Failed to save generated outreach for ${business.name}`, err, { businessId });
    return { ok: false, error: "Failed to save the generated email" };
  }
}
