import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { disconnectGoogle } from "@/lib/google/tokenStore";
import { logEvent } from "@/lib/services/logger";

export async function POST() {
  await disconnectGoogle();
  await logEvent({ type: "TOOL_CALL", message: "Disconnected Google account" });
  revalidatePath("/settings");
  revalidatePath("/calendar");
  return NextResponse.json({ ok: true });
}
