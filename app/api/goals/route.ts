import { NextResponse } from "next/server";
import { z } from "zod";
import { attachGoalNarratives } from "@/lib/goals-narrative";
import { listSavingsGoals, recommendSavingsGoals, setSavingsGoalStatus } from "@/lib/goals";
import { requireUserId } from "@/lib/require-user";

export const runtime = "nodejs";

const bodySchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["accepted", "dismissed"]),
});

export async function GET() {
  const authz = await requireUserId();
  if (authz.error) {
    return authz.error;
  }

  try {
    const existing = await listSavingsGoals(authz.userId);
    if (existing.length === 0) {
      await recommendSavingsGoals(authz.userId);
      await attachGoalNarratives(authz.userId);
    }
    const goals = await listSavingsGoals(authz.userId);
    const active = goals.filter((goal) => goal.status !== "dismissed");
    return NextResponse.json({
      goals,
      potentialMonthlySavings: active.reduce((sum, goal) => {
        return goal.category === "overall" ? sum : sum + goal.projectedMonthlySaving;
      }, 0),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "goals_failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const authz = await requireUserId();
  if (authz.error) {
    return authz.error;
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "id and status are required" }, { status: 400 });
  }

  const updated = await setSavingsGoalStatus(authz.userId, parsed.data.id, parsed.data.status);
  if (!updated) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const goals = await listSavingsGoals(authz.userId);
  const active = goals.filter((goal) => goal.status !== "dismissed" && goal.category !== "overall");
  return NextResponse.json({
    goals,
    potentialMonthlySavings: active.reduce((sum, goal) => sum + goal.projectedMonthlySaving, 0),
  });
}
