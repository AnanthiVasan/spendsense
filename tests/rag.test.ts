import { describe, expect, it } from "vitest";
import { buildTransactionText } from "@/lib/llm";
import { rowsForUser, USER_SCOPED_VECTOR_SQL } from "@/lib/rag";

describe("retrieval scoping", () => {
  it("keeps the canonical transaction text stable", () => {
    expect(
      buildTransactionText({
        occurredOn: "2026-09-15",
        merchantName: "Chipotle",
        category: "food",
        amount: 14.2,
        rawDescription: "CHIPOTLE",
      }),
    ).toBe("2026-09-15 | Chipotle | food | amount 14.20 | CHIPOTLE");
  });

  it("returns only the requested user's rows, capped at k", () => {
    const rows = [
      { userId: "a", id: "1" },
      { userId: "b", id: "2" },
      { userId: "a", id: "3" },
      { userId: "a", id: "4" },
    ];
    expect(rowsForUser(rows, "a", 2).map((row) => row.id)).toEqual(["1", "3"]);
    expect(rowsForUser(rows, "b", 8)).toEqual([{ userId: "b", id: "2" }]);
    expect(USER_SCOPED_VECTOR_SQL).toContain("WHERE user_id = $1");
    expect(USER_SCOPED_VECTOR_SQL).toContain("LIMIT $3");
    expect(USER_SCOPED_VECTOR_SQL).toContain("<=>");
  });
});
