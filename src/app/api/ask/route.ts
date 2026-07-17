import { NextResponse } from "next/server";
import { z } from "zod";
import { askSynapse } from "@/lib/knowledge";

export const runtime = "nodejs";

const AskSchema = z.object({
  question: z.string().min(3)
});

export async function POST(request: Request) {
  try {
    const { question } = AskSchema.parse(await request.json());
    const response = await askSynapse(question);
    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to answer." },
      { status: 400 }
    );
  }
}
