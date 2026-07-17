import { NextResponse } from "next/server";
import { z } from "zod";
import { captureMemory, getGraph, getMetrics, getRecentMemories } from "@/lib/knowledge";
import { getCapabilityStatus } from "@/lib/polygres";

export const runtime = "nodejs";

const CaptureSchema = z.object({
  text: z.string().min(3),
  title: z.string().optional(),
  tags: z.array(z.string()).optional(),
  sourceUrl: z.string().url().optional().or(z.literal("")),
  importance: z.number().int().min(1).max(5).optional()
});

export async function POST(request: Request) {
  try {
    const body = CaptureSchema.parse(await request.json());
    const node = await captureMemory({
      ...body,
      sourceUrl: body.sourceUrl || undefined
    });

    const [graph, recentMemories, metrics, status] = await Promise.all([
      getGraph({ focusId: node.id, depth: 2, limit: 34 }),
      getRecentMemories(8),
      getMetrics(),
      getCapabilityStatus()
    ]);

    return NextResponse.json({ node, graph, recentMemories, metrics, status });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to capture memory.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
