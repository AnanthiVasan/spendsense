import { describe, expect, it } from "vitest";
import { financialHealthScore, metricsFromRows } from "@/lib/report";
import { buildActionItems } from "@/lib/report-narrative";

describe("monthly report", () => {
  it("excludes income from spend and scores deterministically", () => {
    const metrics = metricsFromRows({
      month: "2026-09",
      anomalyCount: 1,
      goalHeadline: { category: "food", projectedMonthlySaving: 40, suggestedTrimPct: 0.15 },
      current: [
        { occurred_on: "2026-09-01", amount: "-2000", category: "income", merchant_name: "Payroll" },
        { occurred_on: "2026-09-02", amount: "100", category: "food", merchant_name: "Chipotle" },
        { occurred_on: "2026-09-03", amount: "300", category: "travel", merchant_name: "Delta" },
      ],
      previous: [
        { occurred_on: "2026-08-02", amount: "200", category: "food", merchant_name: "Chipotle" },
      ],
    });

    expect(metrics.totalIncome).toBe(2000);
    expect(metrics.totalSpend).toBe(400);
    expect(metrics.netSavings).toBe(1600);
    expect(metrics.biggestExpense?.amount).toBe(300);
    expect(metrics.score).toBe(
      financialHealthScore({
        totalIncome: metrics.totalIncome,
        totalSpend: metrics.totalSpend,
        savingsRate: metrics.savingsRate,
        anomalyCount: 1,
        spendDeltaPct: metrics.spendDeltaPct,
        hasPreviousSpend: true,
      }),
    );
    expect(metrics.score).toBeGreaterThanOrEqual(0);
    expect(metrics.score).toBeLessThanOrEqual(100);
  });

  it("always returns exactly three action items", () => {
    const metrics = metricsFromRows({
      month: "2026-09",
      anomalyCount: 0,
      goalHeadline: null,
      current: [],
      previous: [],
    });
    expect(buildActionItems(metrics)).toHaveLength(3);
  });
});
