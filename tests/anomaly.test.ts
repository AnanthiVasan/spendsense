import { describe, expect, it } from "vitest";
import {
  computeStatsFromExpenses,
  findAnomalies,
  isExpense,
  type ExpenseRow,
} from "@/lib/anomaly";
import { generateMockTransactions } from "@/lib/plaid-mock";

function expensesFromSeed(userId = "user-a"): ExpenseRow[] {
  return generateMockTransactions(userId)
    .filter((row) => isExpense(row.amount, row.seedCategory))
    .map((row) => ({
      id: row.plaidTransactionId,
      amount: row.amount,
      category: row.seedCategory,
      merchantName: row.merchantName,
    }));
}

describe("anomaly detection", () => {
  it("uses population standard deviation", () => {
    const stats = computeStatsFromExpenses([
      { id: "1", amount: 10, category: "food", merchantName: "A" },
      { id: "2", amount: 20, category: "food", merchantName: "B" },
      { id: "3", amount: 30, category: "food", merchantName: "C" },
    ]);
    expect(stats.get("food")?.mean).toBe(20);
    expect(stats.get("food")?.std).toBeCloseTo(Math.sqrt(200 / 3), 8);
  });

  it("flags only unusually large spends and skips thin categories", () => {
    const rows: ExpenseRow[] = [
      ...Array.from({ length: 6 }, (_, index) => ({
        id: `food-${index}`,
        amount: 12,
        category: "food",
        merchantName: "Chipotle",
      })),
      { id: "food-outlier", amount: 400, category: "food", merchantName: "Chipotle" },
      { id: "rare", amount: 9000, category: "health", merchantName: "Hospital" },
    ];
    const flagged = findAnomalies(rows, computeStatsFromExpenses(rows), 2, 5);
    expect(flagged.map((item) => item.transactionId)).toEqual(["food-outlier"]);
    expect(flagged[0]?.reason).toContain("food");
    expect(flagged[0]?.zScore).toBeGreaterThan(2);
  });

  it("flags the deterministic seed outliers", () => {
    const expenses = expensesFromSeed();
    const flagged = findAnomalies(expenses, computeStatsFromExpenses(expenses), 2, 5);
    const ids = flagged.map((item) => item.transactionId);
    expect(ids).toEqual(expect.arrayContaining([
      "mock_user-a_txn_outlier_travel",
      "mock_user-a_txn_outlier_shopping",
      "mock_user-a_txn_outlier_food",
    ]));
  });
});
