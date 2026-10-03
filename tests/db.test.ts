import { describe, expect, it } from "vitest";
import { usesLocalPostgres } from "@/lib/db";

describe("database driver selection", () => {
  it("uses the TCP driver for localhost CI URLs and Neon WebSockets otherwise", () => {
    expect(usesLocalPostgres("postgres://postgres:postgres@localhost:5432/spendsense")).toBe(true);
    expect(usesLocalPostgres("postgresql://user:pass@127.0.0.1:5432/db")).toBe(true);
    expect(
      usesLocalPostgres(
        "postgresql://neondb_owner:x@ep-shiny-heart-azd0137k-pooler.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require",
      ),
    ).toBe(false);
  });
});
