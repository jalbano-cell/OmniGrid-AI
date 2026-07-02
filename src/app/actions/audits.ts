"use server";

import { revalidatePath } from "next/cache";
import { runWebsiteAudit } from "@/lib/audit/engine";

export async function runAuditAction(businessId: string) {
  const result = await runWebsiteAudit(businessId);
  revalidatePath("/audits");
  revalidatePath("/leads");
  revalidatePath(`/crm/${businessId}`);
  revalidatePath("/analytics");
  revalidatePath("/");
  return result;
}

export async function runBulkAuditAction(businessIds: string[]) {
  const results = await Promise.all(businessIds.map((id) => runWebsiteAudit(id)));
  revalidatePath("/audits");
  revalidatePath("/leads");
  revalidatePath("/analytics");
  revalidatePath("/");
  return results;
}
