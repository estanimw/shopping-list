import { checkDatabase } from "@/lib/shopping";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    checkDatabase();
    return Response.json({ status: "ok", storage: "sqlite" });
  } catch {
    return Response.json(
      { status: "error", storage: "sqlite" },
      { status: 503 },
    );
  }
}
