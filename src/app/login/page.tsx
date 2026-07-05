import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/auth/session";
import { LoginForm } from "@/components/auth/login-form";
import { Logo } from "@/components/layout/logo";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const { from } = await searchParams;
  const cookieStore = await cookies();
  const alreadyAuthed = await verifySessionToken(cookieStore.get(SESSION_COOKIE)?.value);
  if (alreadyAuthed) redirect(from && from.startsWith("/") ? from : "/");

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <Logo size="md" withWordmark={false} />
          <div>
            <h1 className="text-lg font-semibold tracking-tight">OmniGrid AI</h1>
            <p className="text-sm text-muted-foreground mt-1">Internal Sales Outreach Platform</p>
          </div>
        </div>

        <LoginForm redirectTo={from && from.startsWith("/") ? from : "/"} />
      </div>
    </div>
  );
}
