import { query } from "./db";

export type CategoryMetric = {
  category: string;
  amount: number;
  share: number;
  previousAmount: number;
  delta: number;
};

export type MonthlyMetrics = {
  month: string;
  previousMonth: string;
  totalIncome: number;
  totalSpend: number;
  netSavings: number;
  savingsRate: number;
  spendDelta: number;
  spendDeltaPct: number;
  categories: CategoryMetric[];
  anomalyCount: number;
  biggestExpense: {
    merchantName: string;
    amount: number;
    category: string;
    occurredOn: string;
  } | null;
  goalHeadline: {
    category: string;
    projectedMonthlySaving: number;
    suggestedTrimPct: number;
  } | null;
  score: number;
  scoreLabel: string;
};

type TxnRow = {
  occurred_on: string;
  amount: string;
  category: string | null;
  merchant_name: string | null;
};

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

export function shiftMonth(month: string, delta: number) {
  const [year, mon] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, mon - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function isMonthKey(value: string) {
  return /^\d{4}-\d{2}$/.test(value);
}

/**
 * Financial-health score, 0-100. All inputs are this month's computed metrics.
 *
 * Weights:
 * - 40 pts savings rate: full marks at a 40% rate (net savings / income). Capped.
 *   0 when income is 0 or savings are negative.
 * - 30 pts spend ratio: 30 * clamp(1 - spend/income, 0, 1). 0 when spend >= income.
 * - 15 pts anomalies: 15 * clamp(1 - anomalyCount/3, 0, 1). 0 at 3 or more alerts.
 * - 15 pts trend: neutral 7.5 when month-over-month spend is flat or last month had no spend.
 *   Rises to 15 when spend fell 100% and falls to 0 when spend rose 100%.
 */
export function financialHealthScore(input: {
  totalIncome: number;
  totalSpend: number;
  savingsRate: number;
  anomalyCount: number;
  spendDeltaPct: number;
  hasPreviousSpend: boolean;
}) {
  const savingsPts =
    input.totalIncome <= 0 ? 0 : 40 * Math.min(1, Math.max(0, input.savingsRate) / 0.4);
  const spendRatio = input.totalIncome <= 0 ? 1 : input.totalSpend / input.totalIncome;
  const spendPts = 30 * Math.min(1, Math.max(0, 1 - spendRatio));
  const anomalyPts = 15 * Math.min(1, Math.max(0, 1 - input.anomalyCount / 3));
  const trendPts = input.hasPreviousSpend
    ? 7.5 * (1 - Math.min(1, Math.max(-1, input.spendDeltaPct)))
    : 7.5;
  const score = Math.round(Math.min(100, Math.max(0, savingsPts + spendPts + anomalyPts + trendPts)));
  return score;
}

export function scoreLabel(score: number) {
  if (score >= 80) return "Strong";
  if (score >= 60) return "Good";
  if (score >= 40) return "Mixed";
  return "Needs attention";
}

export function latestCompleteMonth(months: string[], today = new Date()) {
  const current = `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, "0")}`;
  const complete = months.filter((month) => month < current).sort();
  if (complete.length > 0) {
    return complete[complete.length - 1];
  }
  const sorted = [...months].sort();
  return sorted[sorted.length - 1] ?? shiftMonth(current, -1);
}

function summarize(rows: TxnRow[]) {
  let income = 0;
  let spend = 0;
  const byCategory = new Map<string, number>();
  let biggest: MonthlyMetrics["biggestExpense"] = null;

  for (const row of rows) {
    const amount = Number(row.amount);
    const category = (row.category ?? "other").toLowerCase();
    if (amount < 0 || category === "income") {
      income += Math.abs(amount);
      continue;
    }
    if (amount <= 0) {
      continue;
    }
    spend += amount;
    byCategory.set(category, (byCategory.get(category) ?? 0) + amount);
    if (!biggest || amount > biggest.amount) {
      biggest = {
        merchantName: row.merchant_name ?? "Unknown",
        amount,
        category,
        occurredOn: row.occurred_on,
      };
    }
  }

  return { income: round2(income), spend: round2(spend), byCategory, biggest };
}

export function metricsFromRows(input: {
  month: string;
  current: TxnRow[];
  previous: TxnRow[];
  anomalyCount: number;
  goalHeadline: MonthlyMetrics["goalHeadline"];
}): MonthlyMetrics {
  const current = summarize(input.current);
  const previous = summarize(input.previous);
  const netSavings = round2(current.income - current.spend);
  const savingsRate = current.income > 0 ? round2(netSavings / current.income) : 0;
  const spendDelta = round2(current.spend - previous.spend);
  const spendDeltaPct = previous.spend > 0 ? round2(spendDelta / previous.spend) : 0;

  const categories = [...current.byCategory.entries()]
    .map(([category, amount]) => {
      const previousAmount = previous.byCategory.get(category) ?? 0;
      return {
        category,
        amount: round2(amount),
        share: current.spend > 0 ? round2(amount / current.spend) : 0,
        previousAmount: round2(previousAmount),
        delta: round2(amount - previousAmount),
      };
    })
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 6);

  const score = financialHealthScore({
    totalIncome: current.income,
    totalSpend: current.spend,
    savingsRate,
    anomalyCount: input.anomalyCount,
    spendDeltaPct,
    hasPreviousSpend: previous.spend > 0,
  });

  return {
    month: input.month,
    previousMonth: shiftMonth(input.month, -1),
    totalIncome: current.income,
    totalSpend: current.spend,
    netSavings,
    savingsRate,
    spendDelta,
    spendDeltaPct,
    categories,
    anomalyCount: input.anomalyCount,
    biggestExpense: current.biggest,
    goalHeadline: input.goalHeadline,
    score,
    scoreLabel: scoreLabel(score),
  };
}

async function loadMonth(userId: string, month: string) {
  const { rows } = await query<TxnRow>(
    `SELECT occurred_on::text AS occurred_on, amount::text AS amount, category, merchant_name
     FROM transactions
     WHERE user_id = $1
       AND to_char(occurred_on, 'YYYY-MM') = $2`,
    [userId, month],
  );
  return rows;
}

export async function listReportMonths(userId: string) {
  const { rows } = await query<{ month: string }>(
    `SELECT DISTINCT to_char(occurred_on, 'YYYY-MM') AS month
     FROM transactions
     WHERE user_id = $1
     ORDER BY month`,
    [userId],
  );
  return rows.map((row) => row.month);
}

export async function computeMonthlyMetrics(userId: string, month: string): Promise<MonthlyMetrics> {
  const [current, previous, anomalyRows, goalRows] = await Promise.all([
    loadMonth(userId, month),
    loadMonth(userId, shiftMonth(month, -1)),
    query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
       FROM alerts a
       JOIN transactions t ON t.id = a.transaction_id AND t.user_id = a.user_id
       WHERE a.user_id = $1
         AND to_char(t.occurred_on, 'YYYY-MM') = $2`,
      [userId, month],
    ),
    query<{
      category: string;
      projected_monthly_saving: string;
      suggested_trim_pct: string;
    }>(
      `SELECT category, projected_monthly_saving::text, suggested_trim_pct::text
       FROM savings_goals
       WHERE user_id = $1 AND status <> 'dismissed' AND category <> 'overall'
       ORDER BY projected_monthly_saving DESC
       LIMIT 1`,
      [userId],
    ),
  ]);

  const headline = goalRows.rows[0];
  return metricsFromRows({
    month,
    current,
    previous,
    anomalyCount: Number(anomalyRows.rows[0]?.count ?? 0),
    goalHeadline: headline
      ? {
          category: headline.category,
          projectedMonthlySaving: Number(headline.projected_monthly_saving),
          suggestedTrimPct: Number(headline.suggested_trim_pct),
        }
      : null,
  });
}
