"use server";

import { revalidatePath } from "next/cache";
import { runDailyPipeline } from "@/lib/services/dailyRun";

export async function runDailyPipelineAction() {
  const summary = await runDailyPipeline();
  revalidatePath("/settings");
  revalidatePath("/leads");
  revalidatePath("/audits");
  revalidatePath("/outreach");
  revalidatePath("/analytics");
  revalidatePath("/");
  return summary;
}
