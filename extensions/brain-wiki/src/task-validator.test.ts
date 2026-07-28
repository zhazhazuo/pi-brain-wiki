import { describe, expect, test } from "bun:test";
import { validateModification, validatePromotion } from "./task-validator.ts";

describe("validatePromotion", () => {
  test("accepts valid payload", () => {
    const result = validatePromotion({
      description: "RD: Research type systems",
      project: "AI.TypeSystems-Research",
      scheduled: "2026-06-10",
      priority: "M",
      estimate: 1,
      tags: ["RD"],
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test("rejects missing project", () => {
    const result = validatePromotion({
      description: "RD: Research type systems",
      project: "",
      scheduled: "2026-06-10",
      priority: "M",
      estimate: 1,
      tags: ["RD"],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === "project")).toBe(true);
  });

  test("rejects invalid project format", () => {
    const result = validatePromotion({
      description: "RD: Research type systems",
      project: "Techno",
      scheduled: "2026-06-10",
      priority: "M",
      estimate: 1,
      tags: ["RD"],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === "invalid_project_format")).toBe(true);
  });

  test("rejects missing TYPE prefix", () => {
    const result = validatePromotion({
      description: "Research type systems",
      project: "AI.TypeSystems-Research",
      scheduled: "2026-06-10",
      priority: "M",
      estimate: 1,
      tags: ["RD"],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === "description")).toBe(true);
  });

  test("rejects description > 8 words after prefix", () => {
    const result = validatePromotion({
      description: "RD: This is way too many words in the description",
      project: "AI.TypeSystems-Research",
      scheduled: "2026-06-10",
      priority: "M",
      estimate: 1,
      tags: ["RD"],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === "description_too_long")).toBe(true);
  });

  test("rejects URL in description", () => {
    const result = validatePromotion({
      description: "RD: Read https://example.com",
      project: "AI.TypeSystems-Research",
      scheduled: "2026-06-10",
      priority: "M",
      estimate: 1,
      tags: ["RD"],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === "description_has_url")).toBe(true);
  });

  test("rejects invalid estimate", () => {
    const result = validatePromotion({
      description: "RD: Research type systems",
      project: "AI.TypeSystems-Research",
      scheduled: "2026-06-10",
      priority: "M",
      estimate: 5,
      tags: ["RD"],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === "estimate")).toBe(true);
  });

  test("rejects no tags", () => {
    const result = validatePromotion({
      description: "RD: Research type systems",
      project: "AI.TypeSystems-Research",
      scheduled: "2026-06-10",
      priority: "M",
      estimate: 1,
      tags: [],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === "tags")).toBe(true);
  });

  test("rejects invalid priority", () => {
    const result = validatePromotion({
      description: "RD: Research type systems",
      project: "AI.TypeSystems-Research",
      scheduled: "2026-06-10",
      priority: "X" as any,
      estimate: 1,
      tags: ["RD"],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === "priority")).toBe(true);
  });

  test("rejects missing scheduled", () => {
    const result = validatePromotion({
      description: "RD: Research type systems",
      project: "AI.TypeSystems-Research",
      scheduled: "",
      priority: "M",
      estimate: 1,
      tags: ["RD"],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === "scheduled")).toBe(true);
  });

  test("rejects invalid TYPE prefix", () => {
    const result = validatePromotion({
      description: "FOO: Research type systems",
      project: "AI.TypeSystems-Research",
      scheduled: "2026-06-10",
      priority: "M",
      estimate: 1,
      tags: ["RD"],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === "invalid_type_prefix")).toBe(true);
  });
});

describe("validateModification", () => {
  test("accepts a minimal valid modification", () => {
    const result = validateModification({ taskId: 5, scheduled: "2026-07-30" });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test("accepts a full valid modification", () => {
    const result = validateModification({
      taskId: 5,
      scheduled: "2026-07-30",
      priority: "H",
      estimate: 1.5,
      due: "2026-08-01",
      project: "AI.TypeSystems-Research",
      addTags: ["IN_PROGRESS"],
      removeTags: ["BLOCKED"],
      dependsOn: ["uuid-1"],
    });
    expect(result.valid).toBe(true);
  });

  test("rejects an empty modification", () => {
    const result = validateModification({ taskId: 5 });
    expect(result.valid).toBe(false);
    expect(result.errors[0]!.code).toBe("empty_modification");
  });

  test("rejects invalid project format", () => {
    const result = validateModification({ taskId: 5, project: "NoDot" });
    expect(result.valid).toBe(false);
    expect(result.errors[0]!.code).toBe("invalid_project_format");
  });

  test("rejects invalid priority", () => {
    const result = validateModification({ taskId: 5, priority: "X" as any });
    expect(result.valid).toBe(false);
    expect(result.errors[0]!.code).toBe("invalid_priority");
  });

  test("rejects invalid estimate", () => {
    const result = validateModification({ taskId: 5, estimate: 4 });
    expect(result.valid).toBe(false);
    expect(result.errors[0]!.code).toBe("invalid_estimate");
  });

  test("rejects more than one status tag in addTags", () => {
    const result = validateModification({
      taskId: 5,
      addTags: ["IN_PROGRESS", "BLOCKED"],
    });
    expect(result.valid).toBe(false);
    expect(result.errors[0]!.code).toBe("too_many_status_tags");
  });
});
