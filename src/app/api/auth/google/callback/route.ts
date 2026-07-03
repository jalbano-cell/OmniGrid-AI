import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createOAuthClient } from "@/lib/google/oauthClient";
import { saveGoogleTokens } from "@/lib/google/tokenStore";
import { logEvent, logError } from "@/lib/services/logger";

const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const error = req.nextUrl.searchParams.get("error");

  if (error) {
    return NextResponse.redirect(`${appUrl}/settings?google_error=${encodeURIComponent(error)}`);
  }
  if (!code) {
    return NextResponse.redirect(`${appUrl}/settings?google_error=missing_code`);
  }

  try {
    const client = createOAuthClient();
    const { tokens } = await client.getToken(code);
    client.setCredentials(tokens);

    // Fetch the connected account's email so Settings can show who we're sending as.
    let email: string | null = null;
    try {
      const res = await client.request<{ email?: string }>({
        url: "https://www.googleapis.com/oauth2/v2/userinfo",
      });
      email = res.data.email ?? null;
    } catch {
      // Non-fatal — the connection still works without a display email.
    }

    await saveGoogleTokens(tokens, email);
    await logEvent({
      type: "TOOL_CALL",
      message: `Connected Google account${email ? ` (${email})` : ""}`,
      metadata: { scope: tokens.scope },
    });

    // Settings and Calendar are statically rendered — without this they'd keep
    // showing "not connected" until the next deploy.
    revalidatePath("/settings");
    revalidatePath("/calendar");

    return NextResponse.redirect(`${appUrl}/settings?google_connected=1`);
  } catch (err) {
    await logError("Google OAuth callback failed", err);
    return NextResponse.redirect(`${appUrl}/settings?google_error=exchange_failed`);
  }
}
