import { google } from "googleapis";
import { getAuthenticatedGoogleClient } from "@/lib/google/tokenStore";
import { logEvent, logError } from "@/lib/services/logger";
import type { ToolDefinition, ToolResult } from "./types";

export interface GmailSendInput {
  to: string;
  subject: string;
  body: string;
  /** Plain text by default; set true if `body` is already HTML. */
  isHtml?: boolean;
}

export interface GmailSendOutput {
  messageId: string;
  threadId: string;
}

function encodeMessage(to: string, subject: string, body: string, isHtml: boolean) {
  const contentType = isHtml ? "text/html" : "text/plain";
  const messageParts = [
    `To: ${to}`,
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    `Content-Type: ${contentType}; charset=UTF-8`,
    "",
    body,
  ];
  const message = messageParts.join("\n");
  return Buffer.from(message).toString("base64url");
}

/**
 * gmail_send(to, subject, body) — the ONLY function in this codebase allowed
 * to actually deliver an email. It is called exclusively from the Approval
 * Queue's "Approve" server action; nothing in the outreach generator or lead
 * pipeline calls this directly.
 */
async function execute({ to, subject, body, isHtml }: GmailSendInput): Promise<ToolResult<GmailSendOutput>> {
  try {
    const auth = await getAuthenticatedGoogleClient();
    const gmail = google.gmail({ version: "v1", auth });

    const raw = encodeMessage(to, subject, body, Boolean(isHtml));
    const res = await gmail.users.messages.send({
      userId: "me",
      requestBody: { raw },
    });

    await logEvent({
      type: "TOOL_CALL",
      message: `gmail_send → ${to}`,
      metadata: { to, subject, messageId: res.data.id },
    });

    return {
      ok: true,
      data: { messageId: res.data.id ?? "", threadId: res.data.threadId ?? "" },
    };
  } catch (err) {
    await logError(`gmail_send to ${to} failed`, err, { to, subject });
    return { ok: false, error: err instanceof Error ? err.message : "gmail_send failed" };
  }
}

export const gmailSendTool: ToolDefinition<GmailSendInput, GmailSendOutput> = {
  name: "gmail_send",
  description: "Send an email via the connected Google account's Gmail API.",
  execute,
};
