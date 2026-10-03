import { describe, expect, it } from "vitest";
import bcrypt from "bcryptjs";

describe("password hashing", () => {
  it("hashes and verifies with bcrypt", async () => {
    const password = "spend-sense-pass";
    const hash = await bcrypt.hash(password, 4);
    await expect(bcrypt.compare(password, hash)).resolves.toBe(true);
    await expect(bcrypt.compare("wrong-pass", hash)).resolves.toBe(false);
  });
});
