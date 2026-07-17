import { NextResponse } from "next/server";
import { getMetrics } from "@/lib/knowledge";
import { getCapabilityStatus } from "@/lib/polygres";

export const runtime = "nodejs";

export async function GET() {
  try {
    const [status, metrics] = await Promise.all([getCapabilityStatus(), getMetrics()]);
    return NextResponse.json({ status, metrics });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to read status." },
      { status: 500 }
    );
  }
}
