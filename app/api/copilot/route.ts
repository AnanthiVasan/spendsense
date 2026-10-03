import { NextResponse } from "next/server";
import { z } from "zod";
import { answerQuestion } from "@/lib/copilot";
import { CopilotQuotaError } from "@/lib/subscription";
import { requireUserId } from "@/lib/require-user";

export const runtime = "nodejs";

const bodySchema = z.object({
  question: z.string().trim().min(3).max(500),
});

export async function POST(request: Request) {
  const authz = await requireUserId();
  if (authz.error) {
    return authz.error;
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "question is required" }, { status: 400 });
  }

  try {
    const result = await answerQuestion(authz.userId, parsed.data.question);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof CopilotQuotaError) {
      return NextResponse.json({ error: "Upgrade to Pro" }, { status: 402 });
    }
    const message = error instanceof Error ? error.message : "copilot_failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
