import { NextResponse } from "next/server";
import { disconnectGoogle } from "@/lib/google/tokenStore";
import { logEvent } from "@/lib/services/logger";

export async function POST() {
  await disconnectGoogle();
  await logEvent({ type: "TOOL_CALL", message: "Disconnected Google account" });
  return NextResponse.json({ ok: true });
}
