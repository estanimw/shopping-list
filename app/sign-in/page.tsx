import { AuthForm } from "@/components/auth-form";
import { getCurrentUser } from "@/lib/current-user";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function SignInPage() {
  if (await getCurrentUser()) {
    redirect("/");
  }

  return <AuthForm mode="sign-in" />;
}
