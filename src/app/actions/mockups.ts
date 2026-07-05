"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { logEvent } from "@/lib/services/logger";
import { resolveGoogleMapsLink } from "@/lib/services/googleMapsLead";
import type { MockupStatus, Prisma } from "@prisma/client";

const MOCKUP_ITEM_INCLUDE = {
  business: {
    select: {
      id: true,
      name: true,
      industry: true,
      city: true,
      province: true,
      phone: true,
      website: true,
    },
  },
} satisfies Prisma.MockupQueueItemInclude;

export type MockupQueueItemWithBusiness = Prisma.MockupQueueItemGetPayload<{
  include: typeof MOCKUP_ITEM_INCLUDE;
}>;

export async function getMockupQueueAction(): Promise<MockupQueueItemWithBusiness[]> {
  return prisma.mockupQueueItem.findMany({
    include: MOCKUP_ITEM_INCLUDE,
    orderBy: { updatedAt: "desc" },
  });
}

export async function addToMockupQueueAction(businessId: string): Promise<MockupQueueItemWithBusiness> {
  const existing = await prisma.mockupQueueItem.findUnique({
    where: { businessId },
    include: MOCKUP_ITEM_INCLUDE,
  });
  if (existing) return existing;

  const item = await prisma.mockupQueueItem.create({
    data: { businessId },
    include: MOCKUP_ITEM_INCLUDE,
  });
  await logEvent({ type: "APPROVAL_ACTION", message: `Queued mockup for ${item.business.name}`, businessId });
  revalidatePath("/leads");
  return item;
}

/** Step 1 of "Add from Google Maps": resolve the pasted link to a business name for the user to confirm/edit before anything is created. */
export async function resolveGoogleMapsLeadAction(url: string) {
  return resolveGoogleMapsLink(url);
}

/**
 * Step 2: creates the business (for a lead found manually — e.g. on Google
 * Maps — outside the industry/city search) and queues it for a mockup.
 * These leads typically have no website of their own, so there's nothing
 * for runWebsiteAudit to audit — going straight to the mockup queue is the
 * point, not a shortcut around it.
 */
export async function addManualLeadToMockupQueueAction(input: {
  name: string;
  industry: string;
  city: string;
  province?: string;
  country?: string;
  phone?: string;
  googleProfile?: string;
  notes?: string;
}): Promise<MockupQueueItemWithBusiness> {
  const existing = await prisma.business.findFirst({
    where: { name: { equals: input.name, mode: "insensitive" }, city: { equals: input.city, mode: "insensitive" } },
  });

  const business =
    existing ??
    (await prisma.business.create({
      data: {
        name: input.name,
        industry: input.industry,
        city: input.city,
        province: input.province,
        country: input.country ?? "Canada",
        phone: input.phone || null,
        googleProfile: input.googleProfile,
        source: "Manual (Google Maps)",
      },
    }));

  if (!existing && input.notes?.trim()) {
    await prisma.note.create({ data: { businessId: business.id, content: input.notes.trim() } });
  }

  let item = await addToMockupQueueAction(business.id);
  // Also seed the queue card's own notes field with what was typed in the
  // dialog, so it shows up on the card immediately rather than only living
  // in the business's separate Notes history.
  if (input.notes?.trim() && !item.notes) {
    item = await updateMockupNotesAction(item.id, input.notes.trim());
  }

  await logEvent({
    type: "APPROVAL_ACTION",
    message: `${existing ? "Queued existing lead" : "Added manual lead"} ${business.name} to mockup queue via Google Maps link`,
    businessId: business.id,
  });
  revalidatePath("/leads");
  return item;
}

export async function updateMockupStatusAction(
  id: string,
  status: MockupStatus
): Promise<MockupQueueItemWithBusiness> {
  const item = await prisma.mockupQueueItem.update({
    where: { id },
    data: { status },
    include: MOCKUP_ITEM_INCLUDE,
  });
  revalidatePath("/leads");
  return item;
}

export async function updateMockupUrlAction(id: string, deployedUrl: string): Promise<MockupQueueItemWithBusiness> {
  const item = await prisma.mockupQueueItem.update({
    where: { id },
    data: { deployedUrl: deployedUrl.trim() || null },
    include: MOCKUP_ITEM_INCLUDE,
  });
  revalidatePath("/leads");
  return item;
}

export async function updateMockupNotesAction(id: string, notes: string): Promise<MockupQueueItemWithBusiness> {
  const item = await prisma.mockupQueueItem.update({
    where: { id },
    data: { notes },
    include: MOCKUP_ITEM_INCLUDE,
  });
  return item;
}

export async function markMockupSentAction(id: string): Promise<MockupQueueItemWithBusiness> {
  const item = await prisma.mockupQueueItem.update({
    where: { id },
    data: { status: "SENT" },
    include: MOCKUP_ITEM_INCLUDE,
  });
  revalidatePath("/leads");
  return item;
}

/** deleteMany (not delete) so removing an item whose row is already gone — e.g. stale client state — is a no-op, not a thrown error. */
export async function removeMockupAction(id: string): Promise<void> {
  await prisma.mockupQueueItem.deleteMany({ where: { id } });
  revalidatePath("/leads");
}
