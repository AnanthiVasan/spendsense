import { describe, expect, it } from "vitest";
import {
  mockAnswerFromRows,
  REFUSAL_MESSAGE,
  toCitations,
  usableRetrievedRows,
} from "@/lib/copilot";
import type { RetrievedTransaction } from "@/lib/rag";

function row(overrides: Partial<RetrievedTransaction>): RetrievedTransaction {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    occurredOn: "2026-03-12",
    merchantName: "Starbucks",
    category: "food",
    amount: "6.40",
    rawDescription: "STARBUCKS",
    content: "2026-03-12 | Starbucks | food | amount 6.40 | STARBUCKS",
    similarity: 0.8,
    ...overrides,
  };
}

describe("copilot grounding", () => {
  it("refuses when nothing clears the similarity floor", () => {
    const usable = usableRetrievedRows([row({ similarity: 0.12 }), row({ id: "2", similarity: 0.05 })]);
    expect(usable).toEqual([]);
  });

  it("builds a deterministic mock answer with code-side totals and citations", () => {
    const rows = [
      row({ id: "aaa", amount: "10.00", category: "food" }),
      row({ id: "bbb", amount: "5.00", merchantName: "Chipotle", category: "food" }),
      row({
        id: "ccc",
        amount: "425.00",
        merchantName: "SoFi Personal Loan",
        category: "EMI",
        similarity: 0.7,
      }),
    ];
    const answer = mockAnswerFromRows("List my EMI payments", rows);
    expect(answer).toContain("[#ccc]");
    expect(answer).toContain("EMI totaled");
    expect(toCitations(rows)).toHaveLength(3);
    expect(REFUSAL_MESSAGE).toContain("enough data");
  });
});
