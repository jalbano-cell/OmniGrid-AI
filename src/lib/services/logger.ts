import { prisma } from "@/lib/db/prisma";
import type { LogType, Prisma } from "@prisma/client";

interface LogInput {
  type: LogType;
  message: string;
  metadata?: Record<string, unknown>;
  businessId?: string;
}

/**
 * Central logging sink. Every tool call, search, audit, generated email,
 * approval action, calendar event, and error is written here so Settings >
 * Logs can show a full audit trail of what the system did and why.
 */
export async function logEvent({ type, message, metadata, businessId }: LogInput) {
  try {
    await prisma.logEntry.create({
      data: {
        type,
        message,
        businessId,
        metadata: (metadata ?? {}) as Prisma.InputJsonValue,
      },
    });
  } catch (err) {
    // Logging must never break the calling flow.
    console.error("[logger] failed to write log entry:", err);
  }
}

export async function logError(message: string, error: unknown, metadata?: Record<string, unknown>) {
  const errorDetail =
    error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : { error };
  await logEvent({
    type: "ERROR",
    message,
    metadata: { ...metadata, ...errorDetail },
  });
}
