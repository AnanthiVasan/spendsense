import { query } from "./db";
import { formatInr } from "./money";

export type CategoryStats = {
  mean: number;
  std: number;
  count: number;
};

export type ExpenseRow = {
  id: string;
  amount: number;
  category: string;
  merchantName: string | null;
};

export type DetectedAnomaly = {
  transactionId: string;
  category: string;
  amount: number;
  mean: number;
  zScore: number;
  reason: string;
};

export type AlertRow = {
  id: string;
  transactionId: string;
  reason: string;
  zScore: number | null;
  occurredOn: string;
  merchantName: string | null;
  amount: string;
  category: string | null;
};

export function anomalySigma() {
  const value = Number(process.env.ANOMALY_SIGMA ?? 2);
  return Number.isFinite(value) && value > 0 ? value : 2;
}

export function minCategoryCount() {
  const value = Number(process.env.ANOMALY_MIN_CATEGORY_COUNT ?? 5);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 5;
}

export function isExpense(amount: number, category: string | null) {
  if (amount <= 0) {
    return false;
  }
  return (category ?? "other") !== "income";
}

export function computeStatsFromExpenses(expenses: ExpenseRow[]) {
  const grouped = new Map<string, number[]>();
  for (const expense of expenses) {
    const list = grouped.get(expense.category) ?? [];
    list.push(expense.amount);
    grouped.set(expense.category, list);
  }

  const stats = new Map<string, CategoryStats>();
  for (const [category, amounts] of grouped) {
    const count = amounts.length;
    const mean = amounts.reduce((sum, value) => sum + value, 0) / count;
    const variance = amounts.reduce((sum, value) => sum + (value - mean) ** 2, 0) / count;
    stats.set(category, { mean, std: Math.sqrt(variance), count });
  }
  return stats;
}

export function buildAnomalyReason(
  amount: number,
  category: string,
  zScore: number,
  mean: number,
) {
  return `${formatInr(amount)} on ${category} is ${zScore.toFixed(1)}σ above your ${category} average of ${formatInr(mean)}`;
}

export function findAnomalies(
  expenses: ExpenseRow[],
  stats: Map<string, CategoryStats>,
  sigma = anomalySigma(),
  minCount = minCategoryCount(),
): DetectedAnomaly[] {
  const flagged: DetectedAnomaly[] = [];

  for (const expense of expenses) {
    const categoryStats = stats.get(expense.category);
    if (!categoryStats || categoryStats.count < minCount || categoryStats.std === 0) {
      continue;
    }
    if (expense.amount <= categoryStats.mean + sigma * categoryStats.std) {
      continue;
    }
    const zScore = (expense.amount - categoryStats.mean) / categoryStats.std;
    flagged.push({
      transactionId: expense.id,
      category: expense.category,
      amount: expense.amount,
      mean: categoryStats.mean,
      zScore,
      reason: buildAnomalyReason(expense.amount, expense.category, zScore, categoryStats.mean),
    });
  }

  return flagged.sort((a, b) => b.zScore - a.zScore);
}

async function loadExpenses(userId: string): Promise<ExpenseRow[]> {
  const { rows } = await query<{
    id: string;
    amount: string;
    category: string | null;
    merchant_name: string | null;
  }>(
    `SELECT id, amount::text AS amount, category, merchant_name
     FROM transactions
     WHERE user_id = $1`,
    [userId],
  );

  return rows
    .map((row) => ({
      id: row.id,
      amount: Number(row.amount),
      category: row.category ?? "other",
      merchantName: row.merchant_name,
    }))
    .filter((row) => isExpense(row.amount, row.category));
}

export async function computeCategoryStats(userId: string) {
  const expenses = await loadExpenses(userId);
  return computeStatsFromExpenses(expenses);
}

export async function detectAnomalies(userId: string) {
  const expenses = await loadExpenses(userId);
  const stats = computeStatsFromExpenses(expenses);
  const flagged = findAnomalies(expenses, stats);

  const flaggedIds = flagged.map((item) => item.transactionId);

  if (flaggedIds.length === 0) {
    await query(`DELETE FROM alerts WHERE user_id = $1`, [userId]);
    return [];
  }

  for (const item of flagged) {
    await query(
      `INSERT INTO alerts (user_id, transaction_id, reason, z_score)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, transaction_id)
       DO UPDATE SET
         reason = EXCLUDED.reason,
         z_score = EXCLUDED.z_score`,
      [userId, item.transactionId, item.reason, item.zScore],
    );
  }

  await query(
    `DELETE FROM alerts
     WHERE user_id = $1
       AND NOT (transaction_id = ANY($2::uuid[]))`,
    [userId, flaggedIds],
  );

  return flagged;
}

export async function listAlerts(userId: string): Promise<AlertRow[]> {
  const { rows } = await query<{
    id: string;
    transaction_id: string;
    reason: string;
    z_score: string | null;
    occurred_on: string;
    merchant_name: string | null;
    amount: string;
    category: string | null;
  }>(
    `SELECT a.id,
            a.transaction_id,
            a.reason,
            a.z_score::text AS z_score,
            t.occurred_on::text AS occurred_on,
            t.merchant_name,
            t.amount::text AS amount,
            t.category
     FROM alerts a
     JOIN transactions t ON t.id = a.transaction_id AND t.user_id = a.user_id
     WHERE a.user_id = $1
     ORDER BY a.created_at DESC, a.z_score DESC NULLS LAST`,
    [userId],
  );

  return rows.map((row) => ({
    id: row.id,
    transactionId: row.transaction_id,
    reason: row.reason,
    zScore: row.z_score === null ? null : Number(row.z_score),
    occurredOn: row.occurred_on,
    merchantName: row.merchant_name,
    amount: row.amount,
    category: row.category,
  }));
}
