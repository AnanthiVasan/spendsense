import { describe, expect, it } from "vitest";
import { detectRecurringItems, forecastFromHistory, type LedgerTxn } from "@/lib/forecast";
import { generateMockTransactions } from "@/lib/plaid-mock";

function historyFromSeed(): LedgerTxn[] {
  return generateMockTransactions("user-a").map((row) => ({
    occurredOn: row.occurredOn,
    merchantName: row.merchantName,
    amount: row.amount,
    category: row.seedCategory,
  }));
}

describe("cash-flow forecast", () => {
  it("detects rent, EMI, and payroll cadences from the deterministic seed", () => {
    const items = detectRecurringItems(historyFromSeed(), "2026-10-01");
    const labels = items.map((item) => item.label);
    expect(labels).toEqual(
      expect.arrayContaining(["Urban Living Apts", "SoFi Personal Loan", "Acme Payroll"]),
    );
    expect(items.find((item) => item.label === "Urban Living Apts")?.cadence).toBe("monthly");
    expect(items.find((item) => item.label === "Acme Payroll")?.cadence).toBe("biweekly");
    expect(items.find((item) => item.label === "SoFi Personal Loan")?.cadence).toBe("monthly");
  });

  it("is deterministic and widens confidence bands over the horizon", () => {
    const history = historyFromSeed();
    const first = forecastFromHistory(history, {
      asOf: "2026-10-01",
      horizonDays: 30,
      startingBalance: 3500,
      z: 1.64,
    });
    const second = forecastFromHistory(history, {
      asOf: "2026-10-01",
      horizonDays: 30,
      startingBalance: 3500,
      z: 1.64,
    });
    expect(first).toEqual(second);
    expect(first.points).toHaveLength(30);
    const day1 = first.points[0];
    const day30 = first.points[29];
    expect(day30.upper - day30.lower).toBeGreaterThan(day1.upper - day1.lower);
    for (const point of first.points) {
      expect(point.upper).toBeGreaterThanOrEqual(point.projectedBalance);
      expect(point.projectedBalance).toBeGreaterThanOrEqual(point.lower);
    }
  });
});
