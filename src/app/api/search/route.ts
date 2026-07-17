import { NextResponse } from "next/server";
import { searchKnowledge } from "@/lib/knowledge";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = url.searchParams.get("q") ?? "";
  const limit = Number(url.searchParams.get("limit") ?? 8);

  try {
    const hits = await searchKnowledge(q, Math.min(Math.max(limit, 1), 20));
    return NextResponse.json({ hits });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to search." },
      { status: 500 }
    );
  }
}
