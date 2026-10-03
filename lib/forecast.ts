import { query } from "./db";

export type ForecastPoint = {
  day: string;
  projectedNet: number;
  projectedBalance: number;
  lower: number;
  upper: number;
};

export type RecurringItem = {
  label: string;
  amount: number;
  cadence: "biweekly" | "monthly";
};

export type ForecastResult = {
  horizonDays: number;
  asOf: string;
  startingBalance: number;
  points: ForecastPoint[];
  summary: {
    totalProjectedInflow: number;
    totalProjectedOutflow: number;
    projectedEndBalance: number;
    recurringItems: RecurringItem[];
    firstNegativeDay: string | null;
    lowestBalance: number;
  };
};

export type LedgerTxn = {
  occurredOn: string;
  merchantName: string | null;
  amount: number;
  category: string | null;
};

/**
 * Two-sided ~90% normal z (P(|Z|<1.64) ≈ 0.90).
 * Daily band half-width = Z * historicalDailySpendStd * sqrt(horizonIndex).
 * Index is 1-based so day 1 uses sqrt(1) and uncertainty grows like a random walk.
 */
export function forecastZ() {
  const value = Number(process.env.FORECAST_Z ?? 1.64);
  return Number.isFinite(value) && value > 0 ? value : 1.64;
}

export function forecastHorizonDays() {
  const value = Number(process.env.FORECAST_HORIZON_DAYS ?? 30);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 30;
}

export function forecastStartingBalance() {
  const value = Number(process.env.FORECAST_STARTING_BALANCE ?? 3500);
  return Number.isFinite(value) ? value : 3500;
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function addUtcDays(isoDate: string, days: number) {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function weekday(isoDate: string) {
  return new Date(`${isoDate}T00:00:00.000Z`).getUTCDay();
}

function normalizeMerchant(value: string | null) {
  return (value ?? "unknown").trim().toLowerCase().replace(/\s+/g, " ");
}

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length === 0) {
    return 0;
  }
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function populationStd(values: number[]) {
  if (values.length === 0) {
    return 0;
  }
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

type DetectedRecurring = RecurringItem & {
  merchant: string;
  nextDate: string;
  gap: number;
  isInflow: boolean;
};

function cadenceFromGap(gap: number): RecurringItem["cadence"] | null {
  if (gap >= 12 && gap <= 16) {
    return "biweekly";
  }
  if (gap >= 26 && gap <= 35) {
    return "monthly";
  }
  return null;
}

function isRecurringDue(day: string, item: DetectedRecurring) {
  const dayMs = Date.parse(`${day}T00:00:00.000Z`);
  const startMs = Date.parse(`${item.nextDate}T00:00:00.000Z`);
  const diffDays = Math.round((dayMs - startMs) / 86_400_000);
  return diffDays >= 0 && diffDays % item.gap === 0;
}

export function detectRecurringItems(history: LedgerTxn[], asOf: string): DetectedRecurring[] {
  const grouped = new Map<string, LedgerTxn[]>();
  for (const txn of history) {
    const key = normalizeMerchant(txn.merchantName);
    const list = grouped.get(key) ?? [];
    list.push(txn);
    grouped.set(key, list);
  }

  const items: DetectedRecurring[] = [];

  for (const [merchant, rows] of grouped) {
    const sorted = [...rows].sort((a, b) => a.occurredOn.localeCompare(b.occurredOn));
    if (sorted.length < 2) {
      continue;
    }

    const amounts = sorted.map((row) => row.amount);
    const typical = median(amounts);
    const similar = amounts.every((amount) => Math.abs(amount - typical) <= Math.abs(typical) * 0.2);
    if (!similar || typical === 0) {
      continue;
    }

    const gaps: number[] = [];
    for (let i = 1; i < sorted.length; i += 1) {
      const prev = new Date(`${sorted[i - 1].occurredOn}T00:00:00.000Z`).getTime();
      const next = new Date(`${sorted[i].occurredOn}T00:00:00.000Z`).getTime();
      gaps.push(Math.round((next - prev) / 86_400_000));
    }
    const gap = Math.round(median(gaps));
    const cadence = cadenceFromGap(gap);
    if (!cadence) {
      continue;
    }

    let nextDate = addUtcDays(sorted[sorted.length - 1].occurredOn, gap);
    while (nextDate <= asOf) {
      nextDate = addUtcDays(nextDate, gap);
    }

    items.push({
      label: sorted[0].merchantName ?? merchant,
      amount: round2(typical),
      cadence,
      merchant,
      nextDate,
      gap,
      isInflow: typical < 0,
    });
  }

  return items.sort((a, b) => a.label.localeCompare(b.label));
}

export function forecastFromHistory(
  history: LedgerTxn[],
  options?: { horizonDays?: number; startingBalance?: number; asOf?: string; z?: number },
): ForecastResult {
  const horizonDays = options?.horizonDays ?? forecastHorizonDays();
  const startingBalance = options?.startingBalance ?? forecastStartingBalance();
  const z = options?.z ?? forecastZ();
  const asOf =
    options?.asOf ??
    history.reduce((latest, txn) => (txn.occurredOn > latest ? txn.occurredOn : latest), "1970-01-01");

  const recurring = detectRecurringItems(history, asOf);
  const recurringMerchants = new Set(recurring.map((item) => item.merchant));

  const dailyOutflows = new Map<string, number>();
  for (const txn of history) {
    if (txn.amount <= 0) {
      continue;
    }
    if (recurringMerchants.has(normalizeMerchant(txn.merchantName))) {
      continue;
    }
    dailyOutflows.set(txn.occurredOn, (dailyOutflows.get(txn.occurredOn) ?? 0) + txn.amount);
  }

  const byWeekday: number[][] = [[], [], [], [], [], [], []];
  for (const [day, total] of dailyOutflows) {
    byWeekday[weekday(day)].push(total);
  }
  const weekdayMean = byWeekday.map((values) =>
    values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length,
  );
  const overallMean =
    dailyOutflows.size === 0
      ? 0
      : [...dailyOutflows.values()].reduce((sum, value) => sum + value, 0) / dailyOutflows.size;

  const historicalDailySpend = [...dailyOutflows.values()];
  const dailySpendStd = populationStd(historicalDailySpend);

  const points: ForecastPoint[] = [];
  let balance = startingBalance;
  let totalProjectedInflow = 0;
  let totalProjectedOutflow = 0;
  let firstNegativeDay: string | null = null;
  let lowestBalance = startingBalance;

  for (let index = 1; index <= horizonDays; index += 1) {
    const day = addUtcDays(asOf, index);
    let inflow = 0;
    let outflow = weekdayMean[weekday(day)] || overallMean;

    for (const item of recurring) {
      if (!isRecurringDue(day, item)) {
        continue;
      }
      if (item.isInflow) {
        inflow += Math.abs(item.amount);
      } else {
        outflow += item.amount;
      }
    }

    const projectedNet = round2(inflow - outflow);
    balance = round2(balance + projectedNet);
    totalProjectedInflow = round2(totalProjectedInflow + inflow);
    totalProjectedOutflow = round2(totalProjectedOutflow + outflow);
    if (balance < 0 && !firstNegativeDay) {
      firstNegativeDay = day;
    }
    if (balance < lowestBalance) {
      lowestBalance = balance;
    }

    const halfWidth = round2(z * dailySpendStd * Math.sqrt(index));
    points.push({
      day,
      projectedNet,
      projectedBalance: balance,
      lower: round2(balance - halfWidth),
      upper: round2(balance + halfWidth),
    });
  }

  return {
    horizonDays,
    asOf,
    startingBalance,
    points,
    summary: {
      totalProjectedInflow,
      totalProjectedOutflow,
      projectedEndBalance: balance,
      recurringItems: recurring.map(({ label, amount, cadence }) => ({ label, amount, cadence })),
      firstNegativeDay,
      lowestBalance,
    },
  };
}

async function loadHistory(userId: string): Promise<LedgerTxn[]> {
  const { rows } = await query<{
    occurred_on: string;
    merchant_name: string | null;
    amount: string;
    category: string | null;
  }>(
    `SELECT occurred_on::text AS occurred_on,
            merchant_name,
            amount::text AS amount,
            category
     FROM transactions
     WHERE user_id = $1
     ORDER BY occurred_on ASC`,
    [userId],
  );

  const latest = rows.reduce((max, row) => (row.occurred_on > max ? row.occurred_on : max), "");
  const windowStart = latest ? addUtcDays(latest, -89) : "1970-01-01";

  return rows
    .filter((row) => row.occurred_on >= windowStart)
    .map((row) => ({
      occurredOn: row.occurred_on,
      merchantName: row.merchant_name,
      amount: Number(row.amount),
      category: row.category,
    }));
}

export async function forecastCashflow(userId: string, horizonDays = forecastHorizonDays()) {
  const history = await loadHistory(userId);
  return forecastFromHistory(history, { horizonDays });
}
