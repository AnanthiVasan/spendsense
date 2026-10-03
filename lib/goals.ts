import { query } from "./db";
import { formatInr } from "./money";

export const DEFAULT_DISCRETIONARY = ["food", "entertainment", "shopping"] as const;

export type GoalStatus = "suggested" | "accepted" | "dismissed";

export type SavingsRecommendation = {
  category: string;
  currentMonthlyAvg: number;
  suggestedTrimPct: number;
  projectedMonthlySaving: number;
  projectedAnnualSaving: number;
  rationale: string;
};

export type SavedGoal = SavingsRecommendation & {
  id: string;
  status: GoalStatus;
  narrative: string | null;
};

export type SpendTxn = {
  occurredOn: string;
  amount: number;
  category: string | null;
};

export function goalTrimPct() {
  const value = Number(process.env.GOAL_TRIM_PCT ?? 0.15);
  if (!Number.isFinite(value) || value <= 0 || value >= 1) {
    return 0.15;
  }
  return value;
}

export function goalMinCount() {
  const value = Number(process.env.GOAL_MIN_COUNT ?? 5);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 5;
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function pctLabel(trim: number) {
  return `${Math.round(trim * 100)}%`;
}

function rationaleFor(category: string, monthly: number, trim: number, monthlySaving: number) {
  const annual = round2(monthlySaving * 12);
  return `${category} averages ${formatInr(monthly)}/month over the last 90 days. Trimming ${pctLabel(trim)} saves ${formatInr(monthlySaving)}/month (${formatInr(annual)}/year).`;
}

export function recommendFromTransactions(
  transactions: SpendTxn[],
  options?: { trimPct?: number; minCount?: number; discretionary?: readonly string[] },
): SavingsRecommendation[] {
  const trimPct = options?.trimPct ?? goalTrimPct();
  const minCount = options?.minCount ?? goalMinCount();
  const discretionary = new Set(
    (options?.discretionary ?? DEFAULT_DISCRETIONARY).map((item) => item.toLowerCase()),
  );

  const expenses = transactions.filter(
    (txn) => txn.amount > 0 && (txn.category ?? "").toLowerCase() !== "income",
  );
  if (expenses.length === 0) {
    return [];
  }

  const days = expenses.map((txn) => txn.occurredOn).sort();
  const spanMs =
    Date.parse(`${days[days.length - 1]}T00:00:00.000Z`) - Date.parse(`${days[0]}T00:00:00.000Z`);
  const spanDays = Math.max(30, Math.round(spanMs / 86_400_000) + 1);
  const months = spanDays / 30;

  const grouped = new Map<string, { total: number; count: number }>();
  for (const txn of expenses) {
    const category = (txn.category ?? "other").toLowerCase();
    const bucket = grouped.get(category) ?? { total: 0, count: 0 };
    bucket.total += txn.amount;
    bucket.count += 1;
    grouped.set(category, bucket);
  }

  const singles: SavingsRecommendation[] = [];
  for (const [category, bucket] of grouped) {
    if (!discretionary.has(category) || bucket.count < minCount) {
      continue;
    }
    const currentMonthlyAvg = round2(bucket.total / months);
    const projectedMonthlySaving = round2(currentMonthlyAvg * trimPct);
    if (projectedMonthlySaving <= 0) {
      continue;
    }
    singles.push({
      category,
      currentMonthlyAvg,
      suggestedTrimPct: trimPct,
      projectedMonthlySaving,
      projectedAnnualSaving: round2(projectedMonthlySaving * 12),
      rationale: rationaleFor(category, currentMonthlyAvg, trimPct, projectedMonthlySaving),
    });
  }

  singles.sort((a, b) => b.projectedMonthlySaving - a.projectedMonthlySaving);

  const ranked = [...singles];
  if (singles.length >= 2) {
    const monthlySaving = round2(singles.reduce((sum, item) => sum + item.projectedMonthlySaving, 0));
    const currentMonthlyAvg = round2(singles.reduce((sum, item) => sum + item.currentMonthlyAvg, 0));
    const parts = singles.map((item) => `${item.category} ${pctLabel(item.suggestedTrimPct)}`).join(" and ");
    ranked.push({
      category: "overall",
      currentMonthlyAvg,
      suggestedTrimPct: trimPct,
      projectedMonthlySaving: monthlySaving,
      projectedAnnualSaving: round2(monthlySaving * 12),
      rationale: `Save ${formatInr(monthlySaving)}/month by trimming ${parts} (combined discretionary average ${formatInr(currentMonthlyAvg)}/month, ${formatInr(round2(monthlySaving * 12))}/year).`,
    });
  }

  return ranked.sort((a, b) => b.projectedMonthlySaving - a.projectedMonthlySaving).slice(0, 3);
}

async function loadRecentExpenses(userId: string): Promise<SpendTxn[]> {
  const { rows } = await query<{
    occurred_on: string;
    amount: string;
    category: string | null;
  }>(
    `SELECT occurred_on::text AS occurred_on, amount::text AS amount, category
     FROM transactions
     WHERE user_id = $1
       AND amount > 0
       AND COALESCE(category, '') <> 'income'
       AND occurred_on >= (
         SELECT COALESCE(MAX(occurred_on), CURRENT_DATE) - 89
         FROM transactions
         WHERE user_id = $1
       )`,
    [userId],
  );
  return rows.map((row) => ({
    occurredOn: row.occurred_on,
    amount: Number(row.amount),
    category: row.category,
  }));
}

export async function persistRecommendations(userId: string, recs: SavingsRecommendation[]) {
  const categories = recs.map((rec) => rec.category);
  if (categories.length === 0) {
    await query(
      `UPDATE savings_goals SET status = 'dismissed'
       WHERE user_id = $1 AND status = 'suggested'`,
      [userId],
    );
    return;
  }

  for (const rec of recs) {
    await query(
      `INSERT INTO savings_goals (
         user_id, category, current_monthly_avg, suggested_trim_pct,
         projected_monthly_saving, projected_annual_saving, rationale, status
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'suggested')
       ON CONFLICT (user_id, category)
       DO UPDATE SET
         current_monthly_avg = EXCLUDED.current_monthly_avg,
         suggested_trim_pct = EXCLUDED.suggested_trim_pct,
         projected_monthly_saving = EXCLUDED.projected_monthly_saving,
         projected_annual_saving = EXCLUDED.projected_annual_saving,
         rationale = EXCLUDED.rationale`,
      [
        userId,
        rec.category,
        rec.currentMonthlyAvg,
        rec.suggestedTrimPct,
        rec.projectedMonthlySaving,
        rec.projectedAnnualSaving,
        rec.rationale,
      ],
    );
  }

  await query(
    `UPDATE savings_goals
     SET status = 'dismissed'
     WHERE user_id = $1
       AND status = 'suggested'
       AND NOT (category = ANY($2::text[]))`,
    [userId, categories],
  );
}

export async function recommendSavingsGoals(userId: string) {
  const recs = recommendFromTransactions(await loadRecentExpenses(userId));
  await persistRecommendations(userId, recs);
  return recs;
}

export async function listSavingsGoals(userId: string): Promise<SavedGoal[]> {
  const { rows } = await query<{
    id: string;
    category: string;
    current_monthly_avg: string;
    suggested_trim_pct: string;
    projected_monthly_saving: string;
    projected_annual_saving: string;
    rationale: string;
    narrative: string | null;
    status: GoalStatus;
  }>(
    `SELECT id, category, current_monthly_avg::text, suggested_trim_pct::text,
            projected_monthly_saving::text, projected_annual_saving::text,
            rationale, narrative, status
     FROM savings_goals
     WHERE user_id = $1
     ORDER BY projected_monthly_saving DESC`,
    [userId],
  );

  return rows.map((row) => ({
    id: row.id,
    category: row.category,
    currentMonthlyAvg: Number(row.current_monthly_avg),
    suggestedTrimPct: Number(row.suggested_trim_pct),
    projectedMonthlySaving: Number(row.projected_monthly_saving),
    projectedAnnualSaving: Number(row.projected_annual_saving),
    rationale: row.rationale,
    narrative: row.narrative,
    status: row.status,
  }));
}

export async function setSavingsGoalStatus(userId: string, id: string, status: GoalStatus) {
  const result = await query<{ id: string }>(
    `UPDATE savings_goals
     SET status = $1
     WHERE id = $2 AND user_id = $3
     RETURNING id`,
    [status, id, userId],
  );
  return result.rows[0]?.id ?? null;
}

export async function saveGoalNarratives(userId: string, narratives: { category: string; narrative: string }[]) {
  for (const item of narratives) {
    await query(
      `UPDATE savings_goals SET narrative = $1
       WHERE user_id = $2 AND category = $3`,
      [item.narrative, userId, item.category],
    );
  }
}
