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

function pickTop<T>(arr: T[], n: number): T[] {
  return arr.slice(0, n);
}

/**
 * Deterministic, template-based writer. Zero hallucination risk: every
 * sentence is built directly from audit.strengths / audit.weaknesses, which
 * are themselves generated verbatim by the audit engine's checks. This is
 * the default writer and the guaranteed fallback if Claude isn't configured
 * or the API call fails.
 */
function buildDeterministicEmail(
  business: Business,
  audit: Audit,
  signature: string,
  agencyName: string
): GeneratedEmail {
  const strengths = audit.strengths as string[];
  const weaknesses = audit.weaknesses as string[];
  const topStrength = strengths[0];
  const topWeaknesses = pickTop(weaknesses, 2);

  const greetingName = business.name;
  const observationLines = topWeaknesses.map((w) => `- ${w}`).join("\n");

  const subject = `Quick observation about ${business.name}'s website`;

  const bodyParts = [
    `Hi ${greetingName} team,`,
    ``,
    `I was looking at ${audit.url} and wanted to reach out with a couple of specific, concrete observations — not a generic pitch.`,
  ];

  if (topStrength) {
    bodyParts.push(``, `First, something you're doing well: ${topStrength.toLowerCase()}.`);
  }

  if (observationLines) {
    bodyParts.push(
      ``,
      `A couple of things stood out as opportunities:`,
      observationLines
    );
  }

  bodyParts.push(
    ``,
    `I don't want to assume anything about your plans — I just noticed these while looking at the site and thought they were worth flagging. Happy to share the rest of what we found, or just answer questions if any of this is already on your radar.`,
    ``,
    `Worth a quick chat?`,
    ``,
    signature || `${agencyName}`.trim()
  );

  const body = bodyParts.join("\n");
  const summary = `Outreach referencing ${topWeaknesses.length} audit finding(s) on ${audit.url}; overall site score ${audit.overallScore}/100.`;

  const confidenceScore = Math.min(90, 55 + topWeaknesses.length * 10 + (topStrength ? 10 : 0));

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
    };

    const message = await client.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 900,
      system:
        "You write short, specific, non-salesy outreach emails for a marketing agency reaching out to local businesses about their website. " +
        "You must ONLY reference facts given to you in the audit findings JSON — never invent issues, statistics, or claims about tests that weren't run. " +
        "Tone: helpful, curious, professional. Goal: start a conversation, not pressure a sale. No generic marketing language like 'take your business to the next level'. " +
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
      metadata: { outreachId: outreach.id, confidenceScore: generated.confidenceScore },
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
