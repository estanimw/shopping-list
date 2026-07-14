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

  const { items } = getShoppingSnapshot(user.id);

  return <ShoppingShell initialItems={items} userName={user.name} />;
}
