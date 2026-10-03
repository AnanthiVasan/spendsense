import { GoogleGenerativeAI } from "@google/generative-ai";
import { query } from "./db";
import { isGeminiConfigured } from "./llm";
import { formatInr } from "./money";
import {
  computeMonthlyMetrics,
  isMonthKey,
  latestCompleteMonth,
  listReportMonths,
  type MonthlyMetrics,
} from "./report";

export type ActionItem = {
  title: string;
  detail: string;
};

export type MonthlyReport = {
  month: string;
  score: number;
  scoreLabel: string;
  metrics: MonthlyMetrics;
  narrative: string;
  actionItems: [ActionItem, ActionItem, ActionItem];
};

function pct(value: number) {
  return `${Math.round(value * 100)}%`;
}

export function buildActionItems(metrics: MonthlyMetrics): [ActionItem, ActionItem, ActionItem] {
  const items: ActionItem[] = [];
  const top = metrics.categories[0];

  if (metrics.goalHeadline) {
    const goal = metrics.goalHeadline;
    items.push({
      title: `Trim ${goal.category} by ${pct(goal.suggestedTrimPct)}`,
      detail: `That cut saves ${formatInr(goal.projectedMonthlySaving)}/month based on the current discretionary average.`,
    });
  } else if (top) {
    items.push({
      title: `Review ${top.category} spending`,
      detail: `${top.category} was ${formatInr(top.amount)} this month (${pct(top.share)} of spend).`,
    });
  }

  if (metrics.biggestExpense) {
    const charge = metrics.biggestExpense;
    items.push({
      title: `Check the ${formatInr(charge.amount)} ${charge.merchantName} charge`,
      detail: `It posted on ${charge.occurredOn} in ${charge.category} and is the largest expense this month.`,
    });
  }

  if (metrics.spendDelta > 0) {
    items.push({
      title: "Spending is up versus last month",
      detail: `Spend is ${formatInr(metrics.spendDelta)} higher than ${metrics.previousMonth} (${pct(metrics.spendDeltaPct)}).`,
    });
  } else if (metrics.anomalyCount > 0) {
    items.push({
      title: `Review ${metrics.anomalyCount} unusual charge${metrics.anomalyCount === 1 ? "" : "s"}`,
      detail: `Anomaly alerts this month: ${metrics.anomalyCount}. Each is more than 2 standard deviations above its category mean.`,
    });
  } else {
    items.push({
      title: "Hold this savings rate",
      detail: `Net savings were ${formatInr(metrics.netSavings)} on ${formatInr(metrics.totalIncome)} income (${pct(metrics.savingsRate)} rate).`,
    });
  }

  const pads: ActionItem[] = [
    {
      title: "Compare income and spend",
      detail: `Income was ${formatInr(metrics.totalIncome)} and spend was ${formatInr(metrics.totalSpend)}.`,
    },
    {
      title: "Watch next month's top category",
      detail: top
        ? `${top.category} moved ${formatInr(top.delta)} versus ${metrics.previousMonth}.`
        : `No categorized spend was recorded for ${metrics.month}.`,
    },
    {
      title: "Recheck alerts",
      detail: `Flagged anomalies in ${metrics.month}: ${metrics.anomalyCount}.`,
    },
  ];

  for (const pad of pads) {
    if (items.length >= 3) break;
    if (!items.some((item) => item.title === pad.title)) {
      items.push(pad);
    }
  }

  return [items[0], items[1], items[2]];
}

export function mockNarrative(metrics: MonthlyMetrics) {
  const top = metrics.categories
    .slice(0, 3)
    .map((category) => `${category.category} ${formatInr(category.amount)} (${pct(category.share)})`)
    .join(", ");
  const direction =
    metrics.spendDelta > 0
      ? `up ${formatInr(metrics.spendDelta)}`
      : metrics.spendDelta < 0
        ? `down ${formatInr(Math.abs(metrics.spendDelta))}`
        : "unchanged";

  return [
    `In ${metrics.month}, income was ${formatInr(metrics.totalIncome)} and spending was ${formatInr(metrics.totalSpend)}, for net savings of ${formatInr(metrics.netSavings)} (${pct(metrics.savingsRate)} savings rate).`,
    `Versus ${metrics.previousMonth}, total spend was ${direction}.`,
    top ? `The largest spend categories were ${top}.` : "There was no categorized spend in this month.",
    metrics.biggestExpense
      ? `The single largest expense was ${formatInr(metrics.biggestExpense.amount)} at ${metrics.biggestExpense.merchantName} on ${metrics.biggestExpense.occurredOn}.`
      : "No single expense stood out.",
    `The financial-health score is ${metrics.score} (${metrics.scoreLabel}), with ${metrics.anomalyCount} anomaly alert${metrics.anomalyCount === 1 ? "" : "s"} in the month.`,
  ].join(" ");
}

async function geminiNarrative(metrics: MonthlyMetrics, actionItems: ActionItem[]) {
  const client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);
  const model = client.getGenerativeModel({
    model: "gemini-1.5-flash",
    generationConfig: { temperature: 0.2 },
  });
  const result = await model.generateContent(
    `Write a 4-6 sentence monthly financial summary.
Use ONLY the numbers in the JSON. Do not invent figures. Do not add action items; those are supplied separately.

${JSON.stringify({ metrics, actionItems })}`,
  );
  const text = result.response.text().trim();
  return text || mockNarrative(metrics);
}

export async function generateMonthlyReport(userId: string, month: string): Promise<MonthlyReport> {
  if (!isMonthKey(month)) {
    throw new Error("month must be YYYY-MM");
  }
  const metrics = await computeMonthlyMetrics(userId, month);
  const actionItems = buildActionItems(metrics);
  const narrative = isGeminiConfigured()
    ? await geminiNarrative(metrics, actionItems)
    : mockNarrative(metrics);

  await query(
    `INSERT INTO reports (user_id, month, narrative, action_items, score, metrics)
     VALUES ($1, $2, $3, $4::jsonb, $5, $6::jsonb)
     ON CONFLICT (user_id, month)
     DO UPDATE SET
       narrative = EXCLUDED.narrative,
       action_items = EXCLUDED.action_items,
       score = EXCLUDED.score,
       metrics = EXCLUDED.metrics`,
    [userId, month, narrative, JSON.stringify(actionItems), metrics.score, JSON.stringify(metrics)],
  );

  return {
    month,
    score: metrics.score,
    scoreLabel: metrics.scoreLabel,
    metrics,
    narrative,
    actionItems,
  };
}

export async function readStoredReport(userId: string, month: string): Promise<MonthlyReport | null> {
  const { rows } = await query<{
    month: string;
    narrative: string;
    action_items: ActionItem[];
    score: string;
    metrics: MonthlyMetrics;
  }>(
    `SELECT month, narrative, action_items, score::text AS score, metrics
     FROM reports
     WHERE user_id = $1 AND month = $2`,
    [userId, month],
  );
  const row = rows[0];
  if (!row) {
    return null;
  }
  const actionItems = buildActionItems(row.metrics);
  const stored = Array.isArray(row.action_items) ? row.action_items.slice(0, 3) : [];
  while (stored.length < 3) {
    stored.push(actionItems[stored.length]);
  }
  return {
    month: row.month,
    score: Number(row.score),
    scoreLabel: row.metrics.scoreLabel,
    metrics: row.metrics,
    narrative: row.narrative,
    actionItems: [stored[0], stored[1], stored[2]],
  };
}

export async function getOrCreateReport(userId: string, month?: string) {
  const months = await listReportMonths(userId);
  const selected = month && isMonthKey(month) ? month : latestCompleteMonth(months);
  const stored = await readStoredReport(userId, selected);
  const report = stored ?? (await generateMonthlyReport(userId, selected));
  return { report, availableMonths: months };
}
