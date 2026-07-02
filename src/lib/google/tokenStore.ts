import { prisma } from "@/lib/db/prisma";
import { createOAuthClient } from "./oauthClient";
import type { Credentials } from "google-auth-library";

const SINGLETON_ID = 1;

export async function saveGoogleTokens(tokens: Credentials, email?: string | null) {
  if (!tokens.refresh_token && !(await hasGoogleAuth())) {
    // Google only returns a refresh_token on the very first consent (or when
    // prompt=consent forces re-issue). If we somehow got none and have no
    // prior one stored, the connection is unusable for offline access.
    throw new Error(
      "Google did not return a refresh token. Revoke app access at https://myaccount.google.com/permissions and reconnect."
    );
  }

  const existing = await prisma.googleAuth.findUnique({ where: { id: SINGLETON_ID } });

  await prisma.googleAuth.upsert({
    where: { id: SINGLETON_ID },
    create: {
      id: SINGLETON_ID,
      accessToken: tokens.access_token ?? "",
      refreshToken: tokens.refresh_token ?? "",
      expiryDate: BigInt(tokens.expiry_date ?? Date.now()),
      scope: tokens.scope ?? "",
      email: email ?? null,
    },
    update: {
      accessToken: tokens.access_token ?? existing?.accessToken ?? "",
      // Keep the previously stored refresh_token if Google didn't send a new one.
      refreshToken: tokens.refresh_token ?? existing?.refreshToken ?? "",
      expiryDate: BigInt(tokens.expiry_date ?? Date.now()),
      scope: tokens.scope ?? existing?.scope ?? "",
      email: email ?? existing?.email ?? null,
    },
  });
}

export async function hasGoogleAuth() {
  const row = await prisma.googleAuth.findUnique({ where: { id: SINGLETON_ID } });
  return Boolean(row?.refreshToken);
}

export async function getGoogleAuthStatus() {
  const row = await prisma.googleAuth.findUnique({ where: { id: SINGLETON_ID } });
  if (!row) return { connected: false as const };
  return { connected: true as const, email: row.email, updatedAt: row.updatedAt };
}

export async function disconnectGoogle() {
  await prisma.googleAuth.deleteMany({ where: { id: SINGLETON_ID } });
}

/**
 * Returns an OAuth2 client authenticated with the stored tokens. googleapis
 * auto-refreshes the access token when expired; we persist the refreshed
 * token back to the DB via the `tokens` event so future calls skip the
 * refresh round trip.
 */
export async function getAuthenticatedGoogleClient() {
  const row = await prisma.googleAuth.findUnique({ where: { id: SINGLETON_ID } });
  if (!row?.refreshToken) {
    throw new Error("Google is not connected. Connect it from Settings first.");
  }

  const client = createOAuthClient();
  client.setCredentials({
    access_token: row.accessToken,
    refresh_token: row.refreshToken,
    expiry_date: Number(row.expiryDate),
    scope: row.scope,
  });

  client.on("tokens", (tokens) => {
    void saveGoogleTokens(tokens, row.email).catch((err) =>
      console.error("[google] failed to persist refreshed tokens:", err)
    );
  });

  return client;
}
