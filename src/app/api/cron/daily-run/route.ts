import { NextRequest, NextResponse } from "next/server";
import { runDailyPipeline } from "@/lib/services/dailyRun";
import { logError } from "@/lib/services/logger";

// Vercel Hobby plan caps function duration at 60s regardless of this value;
// on Pro+ this allows the full pipeline (discovery + audits + drafting) room
// to finish. Batch sizes in dailyRun.ts are kept conservative either way.
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  try {
    const summary = await runDailyPipeline();
    return NextResponse.json({ ok: true, summary });
  } catch (err) {
    await logError("Daily cron run failed outright", err);
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "daily run failed" }, { status: 500 });
  }
}
