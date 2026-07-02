"use server";

import { revalidatePath } from "next/cache";
import { generateOutreachEmail } from "@/lib/services/outreachGenerator";
import {
  approveAndSendOutreach,
  rejectOutreach,
  editOutreach,
  markOutreachReplied,
  markBusinessInterested,
  closeBusiness,
} from "@/lib/services/approvalWorkflow";

function revalidateOutreachPaths(businessId?: string) {
  revalidatePath("/outreach");
  revalidatePath("/emails");
  revalidatePath("/analytics");
  revalidatePath("/");
  if (businessId) revalidatePath(`/crm/${businessId}`);
}

export async function generateOutreachAction(businessId: string, auditId?: string) {
  const result = await generateOutreachEmail(businessId, auditId);
  revalidateOutreachPaths(businessId);
  return result;
}

export async function approveOutreachAction(outreachId: string, businessId: string, isFollowUp = false) {
  const result = await approveAndSendOutreach(outreachId, isFollowUp);
  revalidateOutreachPaths(businessId);
  return result;
}

export async function rejectOutreachAction(outreachId: string, businessId: string, reason?: string) {
  const result = await rejectOutreach(outreachId, reason);
  revalidateOutreachPaths(businessId);
  return result;
}

export async function editOutreachAction(
  outreachId: string,
  businessId: string,
  data: { subject?: string; body?: string; toEmail?: string }
) {
  const result = await editOutreach(outreachId, data);
  revalidateOutreachPaths(businessId);
  return result;
}

export async function markRepliedAction(outreachId: string, businessId: string) {
  const result = await markOutreachReplied(outreachId);
  revalidateOutreachPaths(businessId);
  return result;
}

export async function markInterestedAction(businessId: string) {
  const result = await markBusinessInterested(businessId);
  revalidateOutreachPaths(businessId);
  return result;
}

export async function closeBusinessAction(businessId: string, won: boolean) {
  const result = await closeBusiness(businessId, won);
  revalidateOutreachPaths(businessId);
  return result;
}
