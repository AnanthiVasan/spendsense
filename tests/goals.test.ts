import { describe, expect, it } from "vitest";
import { recommendFromTransactions } from "@/lib/goals";
import { generateMockTransactions } from "@/lib/plaid-mock";

describe("savings goals", () => {
  it("recommends discretionary trims from the deterministic seed and skips thin categories", () => {
    const recs = recommendFromTransactions(
      generateMockTransactions("user-a").map((row) => ({
        occurredOn: row.occurredOn,
        amount: row.amount,
        category: row.seedCategory,
      })),
      { trimPct: 0.15, minCount: 5 },
    );

    const categories = recs.map((rec) => rec.category);
    expect(categories).toContain("overall");
    expect(categories).not.toContain("EMI");
    expect(categories).not.toContain("utilities");
    expect(recs).toHaveLength(3);
    expect(recs[0]?.projectedMonthlySaving).toBeGreaterThanOrEqual(
      recs[recs.length - 1]?.projectedMonthlySaving ?? 0,
    );

    for (const rec of recs) {
      expect(rec.projectedMonthlySaving).toBeCloseTo(rec.currentMonthlyAvg * 0.15, 1);
      expect(rec.projectedAnnualSaving).toBeCloseTo(rec.projectedMonthlySaving * 12, 1);
      expect(rec.rationale).toContain("₹");
    }
  });
});
