import { NextResponse } from "next/server";
import { getGraph } from "@/lib/knowledge";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const focusId = url.searchParams.get("focusId") ?? undefined;
  const depth = Number(url.searchParams.get("depth") ?? 2);
  const limit = Number(url.searchParams.get("limit") ?? 36);

  try {
    const graph = await getGraph({
      focusId,
      depth: Math.min(Math.max(depth, 1), 4),
      limit: Math.min(Math.max(limit, 8), 80)
    });
    return NextResponse.json({ graph });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load graph." },
      { status: 500 }
    );
  }
}
