import { redirect } from "next/navigation";
import { LoginForm } from "./LoginForm";
import { getSession } from "@/lib/session";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: { next?: string; error?: string };
}) {
  const session = await getSession();
  if (session) redirect(searchParams.next || "/");
  return (
    <div className="mx-auto max-w-sm space-y-6 py-12">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-semibold">Welcome to CCAF Study</h1>
        <p className="text-sm text-muted-foreground">
          Sign in with your first name and the team password.
        </p>
      </div>
      <LoginForm next={searchParams.next} error={searchParams.error} />
    </div>
  );
}
