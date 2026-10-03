import { GoalActions } from "@/components/GoalActions";
import { mockGoalNarrative } from "@/lib/goals-narrative";
import { listSavingsGoals, recommendSavingsGoals } from "@/lib/goals";
import { auth } from "@/lib/auth";
import { formatInr } from "@/lib/money";

export default async function GoalsPage() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return null;
  }

  let goals: Awaited<ReturnType<typeof listSavingsGoals>> = [];
  let dbError: string | null = null;
  try {
    goals = await listSavingsGoals(userId);
    if (goals.length === 0) {
      await recommendSavingsGoals(userId);
      goals = await listSavingsGoals(userId);
    }
  } catch {
    dbError = "Database is not configured yet. Apply db/migrations/005_goals.sql and run npm run seed.";
  }

  const visible = goals.filter((goal) => goal.status !== "dismissed");
  const categoryGoals = visible.filter((goal) => goal.category !== "overall");
  const potential = categoryGoals
    .filter((goal) => goal.status === "suggested" || goal.status === "accepted")
    .reduce((sum, goal) => sum + goal.projectedMonthlySaving, 0);

  return (
    <section>
      <h1 className="text-2xl font-semibold tracking-tight">Goals</h1>
      <p className="mt-2 max-w-2xl text-slate-400">
        Suggestions come from discretionary spending over the last 90 days. The savings amounts are
        computed in code.
      </p>
      {dbError ? <p className="mt-4 text-sm text-amber-300">{dbError}</p> : null}

      <p className="mt-6 text-sm text-slate-200">
        Potential total monthly savings:{" "}
        <span className="font-semibold text-emerald-400">{formatInr(potential)}</span>
      </p>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        {visible.map((goal) => {
          const narrative = goal.narrative ?? mockGoalNarrative(goal);
          return (
            <article key={goal.id} className="rounded-lg border border-slate-800 bg-ink-900 p-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-lg font-medium capitalize">{goal.category}</h2>
                <span className="text-xs uppercase tracking-wide text-slate-500">{goal.status}</span>
              </div>
              <p className="mt-3 text-sm text-slate-300">{goal.rationale}</p>
              <dl className="mt-4 space-y-1 text-sm text-slate-400">
                <div>Current monthly average: {formatInr(goal.currentMonthlyAvg)}</div>
                <div>Suggested trim: {Math.round(goal.suggestedTrimPct * 100)}%</div>
                <div>Monthly saving: {formatInr(goal.projectedMonthlySaving)}</div>
                <div>Annual saving: {formatInr(goal.projectedAnnualSaving)}</div>
              </dl>
              <p className="mt-3 text-sm text-slate-200">{narrative}</p>
              {goal.status === "suggested" ? <GoalActions id={goal.id} /> : null}
            </article>
          );
        })}
      </div>
      {visible.length === 0 && !dbError ? (
        <p className="mt-6 text-sm text-slate-500">No open savings goals. Run the seed after transactions exist.</p>
      ) : null}
    </section>
  );
}
