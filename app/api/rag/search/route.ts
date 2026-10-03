import { NextResponse } from "next/server";
import { z } from "zod";
import { isGeminiConfigured } from "@/lib/llm";
import { ragTopK, retrieveRelevantTransactions } from "@/lib/rag";
import { requireUserId } from "@/lib/require-user";

export const runtime = "nodejs";

const bodySchema = z.object({
  query: z.string().trim().min(1, "query is required"),
  k: z.number().int().positive().max(25).optional(),
});

export async function POST(request: Request) {
  const authz = await requireUserId();
  if (authz.error) {
    return authz.error;
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "query is required" }, { status: 400 });
  }

  const k = ragTopK(parsed.data.k);
  const started = Date.now();

  try {
    const results = await retrieveRelevantTransactions(
      authz.userId,
      parsed.data.query,
      k,
    );
    return NextResponse.json({
      query: parsed.data.query,
      k,
      mock: !isGeminiConfigured(),
      latencyMs: Date.now() - started,
      results,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "rag_search_failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
