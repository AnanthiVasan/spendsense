import { describe, expect, it } from "vitest";
import { generateMockTransactions } from "@/lib/plaid-mock";

describe("mock Plaid transactions", () => {
  it("is deterministic for the same user", () => {
    const first = generateMockTransactions("user-a");
    const second = generateMockTransactions("user-a");
    expect(first).toEqual(second);
    expect(first.length).toBeGreaterThan(50);
  });

  it("keeps merchants, dates, and amounts stable across users", () => {
    const first = generateMockTransactions("user-a");
    const second = generateMockTransactions("user-b");
    expect(first.map((row) => [row.occurredOn, row.merchantName, row.amount])).toEqual(
      second.map((row) => [row.occurredOn, row.merchantName, row.amount]),
    );
  });
});
