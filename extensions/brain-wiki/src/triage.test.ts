import { describe, expect, test } from "bun:test";
import { triageList } from "./triage.ts";

describe("triageList", () => {
  test("rejects add without an Obsidian client", async () => {
    await expect(triageList("/vault/Wiki", "add", "triage entry")).rejects.toThrow(
      "Obsidian client required",
    );
  });
});
