import { NextResponse } from "next/server";
import { buildConsentUrl, isGoogleOAuthConfigured } from "@/lib/google/oauthClient";

export async function GET() {
  if (!isGoogleOAuthConfigured()) {
    return NextResponse.json(
      {
        error:
          "Google OAuth is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env, then retry.",
      },
      { status: 400 }
    );
  }
  return NextResponse.redirect(buildConsentUrl());
}
