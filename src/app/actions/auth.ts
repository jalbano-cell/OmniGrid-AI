"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createSessionToken, passwordsMatch, SESSION_COOKIE } from "@/lib/auth/session";
import { logEvent } from "@/lib/services/logger";

export interface LoginResult {
  ok: boolean;
  error?: string;
}

export async function loginAction(password: string): Promise<LoginResult> {
  const expected = process.env.APP_PASSWORD;
  if (!expected) {
    return { ok: false, error: "APP_PASSWORD is not set on the server — see .env.example." };
  }

  if (!passwordsMatch(password, expected)) {
    await logEvent({ type: "APPROVAL_ACTION", message: "Failed login attempt" });
    return { ok: false, error: "Incorrect password" };
  }

  const token = await createSessionToken();
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  // Deliberately no redirect() here — this action is invoked imperatively
  // from a client onSubmit handler (not a native <form action>), and
  // redirect()'s special digest-throw handling is unreliable in that case.
  // The client navigates itself once it sees { ok: true }.
  return { ok: true };
}

export async function logoutAction() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
  redirect("/login");
}
