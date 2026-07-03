import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/db/prisma";
import { logEvent, logError } from "@/lib/services/logger";
import { getSettings } from "@/lib/services/settings";
import { syncOutreachCreatedToAirtable } from "@/lib/services/airtable";
import type { Audit, Business } from "@prisma/client";

export interface GeneratedEmail {
  subject: string;
  body: string;
  summary: string;
  confidenceScore: number;
}

const TARGET_MIN_WORDS = 120;
const TARGET_MAX_WORDS = 160;

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
];

export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function pickTop<T>(arr: T[], n: number): T[] {
  return arr.slice(0, n);
}

/**
 * Deterministic, template-based writer. Zero hallucination risk: every
 * sentence is built directly from audit.strengths / audit.weaknesses, which
 * are themselves generated verbatim by the audit engine's checks. This is
 * the default writer and the guaranteed fallback if Claude isn't configured
 * or the API call fails.
 *
 * Follows the required 4-part structure: (1) specific observation from the
 * audit, (2) the business impact of that observation, (3) one small
 * actionable suggestion, (4) a soft, no-pressure CTA. Trimmed toward
 * ~120-160 words — trimming only ever removes extra real findings, never
 * pads with invented content.
 */
function buildDeterministicEmail(
  business: Business,
  audit: Audit,
  signature: string,
  agencyName: string
): GeneratedEmail {
  const weaknesses = audit.weaknesses as string[];
  const recommendations = audit.recommendations as string[];
  const topWeakness = weaknesses[0];
  const secondWeakness = weaknesses[1];
  const topRecommendation = recommendations[0];

  const subject = `Quick observation about ${business.name}'s website`;

  const bodyParts = [`Hi ${business.name} team,`, ``];

  // 1. Specific observation (from audit)
  if (topWeakness) {
    bodyParts.push(`I was looking at ${audit.url} and noticed ${topWeakness.toLowerCase()}.`);
  } else {
    bodyParts.push(`I was looking at ${audit.url} and wanted to share a quick, specific observation — not a generic pitch.`);
  }

  // 2. Business impact
  bodyParts.push(
    ``,
    `That kind of gap tends to quietly cost you visitors who'd otherwise become customers — they land on the page, hit that friction point, and leave before ever reaching out.`
  );

  // 3. Small actionable suggestion
  if (topRecommendation) {
    bodyParts.push(``, topRecommendation);
  } else if (secondWeakness) {
    bodyParts.push(``, `A small fix worth considering: address ${secondWeakness.toLowerCase()}.`);
  }

  // 4. Soft CTA — no pressure
  bodyParts.push(``, `No pressure either way — happy to send over the rest of what we found if it'd be useful.`, ``, signature || agencyName.trim());

  let body = bodyParts.join("\n");

  // Trim toward the target range by dropping the impact sentence if the
  // draft runs long — never truncate mid-sentence, never invent filler.
  if (countWords(body) > TARGET_MAX_WORDS) {
    const withoutImpact = bodyParts.filter(
      (line) => !line.startsWith("That kind of gap")
    );
    body = withoutImpact.join("\n");
  }

  const referencedFindings = [topWeakness, secondWeakness].filter(Boolean).length;
  const summary = `Outreach referencing ${referencedFindings} audit finding(s) on ${audit.url}; overall site score ${audit.overallScore}/100.`;
  const confidenceScore = Math.min(90, 55 + referencedFindings * 15 + (topRecommendation ? 10 : 0));

  return { subject, body, summary, confidenceScore };
}

async function buildWithClaude(
  business: Business,
  audit: Audit,
  signature: string,
  agencyName: string
): Promise<GeneratedEmail | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const findings = {
      url: audit.url,
      overallScore: audit.overallScore,
      strengths: audit.strengths,
      weaknesses: audit.weaknesses,
      recommendations: audit.recommendations,
    };

    const message = await client.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 900,
      system:
        "You write short, specific, non-salesy outreach emails for a marketing agency reaching out to local businesses about their website. " +
        "You must ONLY reference facts given to you in the audit findings JSON — never invent issues, statistics, or claims about tests that weren't run. " +
        "The email body MUST follow this exact 4-part structure, in order: " +
        "(1) one specific observation pulled directly from the audit findings, " +
        "(2) one sentence on the likely business impact of that observation (lost leads/customers — reasoned, not fabricated data), " +
        "(3) one small, concrete, actionable suggestion, " +
        "(4) a soft call-to-action with no pressure (e.g. offering to share more, not demanding a call). " +
        `The body must be ${TARGET_MIN_WORDS}-${TARGET_MAX_WORDS} words — concise, not a wall of text. ` +
        `Never use these banned phrases or anything equivalent to them: ${BANNED_PHRASES.join(", ")}. ` +
        "Tone: helpful, curious, professional. Goal: start a conversation, not pressure a sale. " +
        'Respond with ONLY minified JSON: {"subject": string, "body": string, "summary": string, "confidenceScore": number 0-100}. ' +
        "confidenceScore reflects how well-grounded and specific the email is in the given findings.",
      messages: [
        {
          role: "user",
          content:
            `Business name: ${business.name}\n` +
            `Industry: ${business.industry}\n` +
            `City: ${business.city}\n` +
            `Agency name: ${agencyName || "our agency"}\n` +
            `Signature to close with: ${signature || "(none provided, sign off simply)"}\n\n` +
            `Audit findings JSON:\n${JSON.stringify(findings, null, 2)}`,
        },
      ],
    });

    const text = message.content.filter((b) => b.type === "text").map((b) => b.text).join("");
    const parsed = JSON.parse(text) as GeneratedEmail;
    if (!parsed.subject || !parsed.body) return null;

    const wordCount = countWords(parsed.body);
    if (wordCount < 40 || wordCount > TARGET_MAX_WORDS + 60) {
      // Wildly outside the requested range (model ignored instructions) —
      // safer to fall back to the deterministic writer than ship a draft
      // that doesn't meet the length/structure requirement.
      await logEvent({
        type: "EMAIL_GENERATED",
        message: `Claude draft for ${business.name} was ${wordCount} words (outside allowed range) — falling back to template`,
        businessId: business.id,
      });
      return null;
    }

    return {
      subject: parsed.subject,
      body: parsed.body,
      summary: parsed.summary || "AI-generated outreach draft grounded in audit findings.",
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

export async function generateOutreachEmail(businessId: string, auditId?: string): Promise<OutreachGenerationResult> {
  const business = await prisma.business.findUnique({ where: { id: businessId } });
  if (!business) return { ok: false, error: "Business not found" };

  const audit = auditId
    ? await prisma.audit.findUnique({ where: { id: auditId } })
    : await prisma.audit.findFirst({ where: { businessId }, orderBy: { createdAt: "desc" } });

  if (!audit) {
    return { ok: false, error: "No audit found for this business. Run a website audit first." };
  }

  const settings = await getSettings();

  const generated =
    (await buildWithClaude(business, audit, settings.emailSignature, settings.agencyName)) ??
    buildDeterministicEmail(business, audit, settings.emailSignature, settings.agencyName);

  try {
    const outreach = await prisma.outreach.create({
      data: {
        businessId,
        auditId: audit.id,
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

export { pickTop, buildDeterministicEmail, buildWithClaude };
