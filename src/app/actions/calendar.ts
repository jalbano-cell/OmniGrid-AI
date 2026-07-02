"use server";

import { revalidatePath } from "next/cache";
import { scheduleDiscoveryCall, type ScheduleMeetingInput } from "@/lib/services/meetingService";

export async function scheduleMeetingAction(input: ScheduleMeetingInput) {
  const result = await scheduleDiscoveryCall(input);
  revalidatePath("/calendar");
  revalidatePath("/analytics");
  revalidatePath("/");
  revalidatePath(`/crm/${input.businessId}`);
  return result;
}
