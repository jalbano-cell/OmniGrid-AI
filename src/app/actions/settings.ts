"use server";

import { revalidatePath } from "next/cache";
import { updateSettings } from "@/lib/services/settings";

export async function updateSettingsAction(data: {
  industries?: string[];
  cities?: string[];
  dailyResearchLimit?: number;
  dailyEmailApprovalLimit?: number;
  emailSignature?: string;
  agencyName?: string;
  agencyWebsite?: string;
  agencyInfo?: string;
  approvalMode?: boolean;
}) {
  const settings = await updateSettings(data);
  revalidatePath("/settings");
  return settings;
}
