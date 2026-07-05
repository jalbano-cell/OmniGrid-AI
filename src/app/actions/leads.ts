"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { discoverLeads, type LeadSearchInput } from "@/lib/services/leadDiscovery";
import { logEvent } from "@/lib/services/logger";

export async function searchLeadsAction(input: LeadSearchInput) {
  const outcome = await discoverLeads(input);
  revalidatePath("/leads");
  revalidatePath("/");
  revalidatePath("/analytics");
  return outcome;
}

/**
 * Soft delete only — the row stays in the database so discoverLeads()'s
 * website/name dedup checks still recognize it and never recreate it if the
 * same business turns up in a later search.
 */
export async function deleteBusinessAction(businessId: string) {
  const business = await prisma.business.update({ where: { id: businessId }, data: { deletedAt: new Date() } });
  await logEvent({ type: "APPROVAL_ACTION", message: `Deleted lead ${business.name}` });
  revalidatePath("/leads");
}

export async function markDoNotContactAction(businessId: string) {
  await prisma.business.update({ where: { id: businessId }, data: { status: "DO_NOT_CONTACT" } });
  await prisma.statusEvent.create({ data: { businessId, status: "DO_NOT_CONTACT" } });
  revalidatePath("/leads");
  revalidatePath(`/crm/${businessId}`);
}

export async function addNoteAction(businessId: string, content: string) {
  if (!content.trim()) return;
  await prisma.note.create({ data: { businessId, content: content.trim() } });
  revalidatePath(`/crm/${businessId}`);
}

export async function updateBusinessContactAction(
  businessId: string,
  data: { email?: string; phone?: string; address?: string }
) {
  await prisma.business.update({ where: { id: businessId }, data });
  revalidatePath(`/crm/${businessId}`);
}
