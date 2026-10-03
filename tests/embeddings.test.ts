import { describe, expect, it } from "vitest";
import {
  buildTransactionText,
  cosineSimilarity,
  EMBEDDING_DIMS,
  mockEmbedText,
} from "@/lib/llm";

describe("transaction embeddings", () => {
  it("builds a canonical row string", () => {
    expect(
      buildTransactionText({
        occurredOn: "2026-09-01",
        merchantName: "SoFi Personal Loan",
        category: "EMI",
        amount: 425,
        rawDescription: "SOFI PERSONAL LOAN EMI",
      }),
    ).toBe("2026-09-01 | SoFi Personal Loan | EMI | amount 425.00 | SOFI PERSONAL LOAN EMI");
  });

  it("returns a deterministic L2-normalized 768-d mock vector", () => {
    const first = mockEmbedText("EMI sofi loan");
    const second = mockEmbedText("EMI sofi loan");
    expect(first).toHaveLength(EMBEDDING_DIMS);
    expect(first).toEqual(second);
    const norm = Math.sqrt(first.reduce((sum, value) => sum + value * value, 0));
    expect(norm).toBeCloseTo(1, 5);
  });

  it("ranks overlapping tokens above unrelated text", () => {
    const query = mockEmbedText("all EMI payments sofi loan");
    const emi = mockEmbedText(
      buildTransactionText({
        occurredOn: "2026-08-03",
        merchantName: "SoFi Personal Loan",
        category: "EMI",
        amount: 425,
        rawDescription: "SOFI PERSONAL LOAN EMI",
      }),
    );
    const payroll = mockEmbedText(
      buildTransactionText({
        occurredOn: "2026-08-03",
        merchantName: "Acme Payroll",
        category: "income",
        amount: -1900,
        rawDescription: "ACME PAYROLL DIRECT DEP",
      }),
    );
    expect(cosineSimilarity(query, emi)).toBeGreaterThan(cosineSimilarity(query, payroll));
  });
});
