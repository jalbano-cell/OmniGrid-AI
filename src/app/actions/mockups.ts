"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { logEvent } from "@/lib/services/logger";
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

export async function removeMockupAction(id: string): Promise<void> {
  await prisma.mockupQueueItem.delete({ where: { id } });
  revalidatePath("/leads");
}
