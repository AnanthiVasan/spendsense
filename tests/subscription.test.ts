import { describe, expect, it } from "vitest";
import { tierFromRecord } from "@/lib/subscription";

describe("subscription tier", () => {
  it("treats active and trialing pro as pro", () => {
    expect(tierFromRecord({ tier: "pro", status: "active" })).toBe("pro");
    expect(tierFromRecord({ tier: "pro", status: "trialing" })).toBe("pro");
  });

  it("treats past_due and canceled as free", () => {
    expect(tierFromRecord({ tier: "pro", status: "past_due" })).toBe("free");
    expect(tierFromRecord({ tier: "pro", status: "canceled" })).toBe("free");
    expect(tierFromRecord({ tier: "free", status: "active" })).toBe("free");
  });
});
