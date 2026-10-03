import { describe, expect, it } from "vitest";
import { mockCategorize } from "@/lib/categorize";
import { ruleBasedCategorize, seedCategoryForMerchant } from "@/lib/categories";

describe("rule-based categorization", () => {
  it("is deterministic", () => {
    const input = { merchantName: "Starbucks", amount: 6.5, rawDescription: "STARBUCKS" };
    expect(ruleBasedCategorize(input)).toEqual(ruleBasedCategorize(input));
    expect(mockCategorize(input)).toEqual(ruleBasedCategorize(input));
  });

  it("maps seed merchants to the expected labels", () => {
    expect(seedCategoryForMerchant("SoFi Personal Loan", 425)).toBe("EMI");
    expect(seedCategoryForMerchant("Acme Payroll", -1900)).toBe("income");
    expect(seedCategoryForMerchant("Urban Living Apts", 2100)).toBe("other");
    expect(ruleBasedCategorize({ merchantName: "Netflix", amount: 15.49 }).category).toBe(
      "entertainment",
    );
  });

  it("flags rent as low confidence other", () => {
    const result = ruleBasedCategorize({
      merchantName: "Urban Living Apts",
      amount: 2100,
      rawDescription: "URBAN LIVING APTS RENT",
    });
    expect(result.category).toBe("other");
    expect(result.confidence).toBeLessThan(0.6);
  });
});
