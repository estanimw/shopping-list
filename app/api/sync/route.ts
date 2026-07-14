import { getCurrentUser } from "@/lib/current-user";
import { synchronizeShopping } from "@/lib/shopping";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ error: "Tu sesión venció. Volvé a ingresar para sincronizar." }, { status: 401 });
  }

  try {
    const body = await request.json();
    const result = synchronizeShopping(user.id, body?.operations);
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json(
      { error: "No pudimos sincronizar los cambios. Volvé a intentarlo." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
}
