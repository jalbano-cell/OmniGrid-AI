// Signed session token for the single shared-password gate. Uses Web Crypto
// (available in both the Node runtime and the Edge middleware runtime) so
// the same code verifies the cookie in both places.

export const SESSION_COOKIE = "omnigrid_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function getAuthSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET is not set. Add a long random string to .env (see .env.example).");
  }
  return secret;
}

async function hmac(message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(getAuthSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Buffer.from(signature).toString("hex");
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

/** Constant-time-ish comparison for the shared password itself. */
export function passwordsMatch(input: string, expected: string): boolean {
  if (!expected) return false;
  // Pad to equal length first so the length check above doesn't leak via early return timing.
  const padded = input.padEnd(expected.length, "\0").slice(0, Math.max(input.length, expected.length));
  const paddedExpected = expected.padEnd(input.length, "\0").slice(0, Math.max(input.length, expected.length));
  return timingSafeEqual(padded, paddedExpected) && input.length === expected.length;
}

export async function createSessionToken(): Promise<string> {
  const expiry = Date.now() + SESSION_TTL_MS;
  const signature = await hmac(String(expiry));
  return `${expiry}.${signature}`;
}

export async function verifySessionToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const [expiryStr, signature] = token.split(".");
  if (!expiryStr || !signature) return false;

  const expiry = Number(expiryStr);
  if (!Number.isFinite(expiry) || Date.now() > expiry) return false;

  const expectedSignature = await hmac(expiryStr);
  return timingSafeEqual(signature, expectedSignature);
}
