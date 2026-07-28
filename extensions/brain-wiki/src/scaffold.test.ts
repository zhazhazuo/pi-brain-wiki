import { describe, expect, test } from "bun:test";
import { DEFAULT_SUMMARY_TEMPLATE } from "./scaffold.ts";

describe("DEFAULT_SUMMARY_TEMPLATE", () => {
  test("is a learning record, not a content summary", () => {
    expect(DEFAULT_SUMMARY_TEMPLATE).toContain("## Core claim");
    expect(DEFAULT_SUMMARY_TEMPLATE).toContain("## Bridge");
    expect(DEFAULT_SUMMARY_TEMPLATE).toContain("## Discussion");
    expect(DEFAULT_SUMMARY_TEMPLATE).toContain("## Integration targets");
  });

  test("drops plain-summary sections", () => {
    expect(DEFAULT_SUMMARY_TEMPLATE).not.toContain("## Executive summary");
    expect(DEFAULT_SUMMARY_TEMPLATE).not.toContain("## Main claims");
    expect(DEFAULT_SUMMARY_TEMPLATE).not.toContain(
      "## Important details and data points",
    );
    expect(DEFAULT_SUMMARY_TEMPLATE).not.toContain(
      "## Entities and concepts mentioned",
    );
  });
});
