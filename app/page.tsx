import { ShoppingShell } from "@/components/shopping-shell";
import { getCurrentUser } from "@/lib/current-user";
import { getShoppingSnapshot } from "@/lib/shopping";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/sign-in");
  }

  const initialSnapshot = getShoppingSnapshot(user.id);

  return <ShoppingShell initialSnapshot={initialSnapshot} userId={user.id} userName={user.name} />;
}
