import { describe, expect, test } from "bun:test";
import { canPromoteTask, summarizeProjectReview } from "./project-sync.ts";

describe("project review", () => {
  test("review flags blocked projects, stale active projects, and missing next actions", async () => {
    const result = summarizeProjectReview([
      {
        path: "Launch Atlas",
        title: "Launch Atlas",
        status: "blocked",
        priority: "high",
        deadline: "2026-06-20",
        nextAction: "Waiting on [[Resource/vendor-email]]",
        lastAction: "Waiting on [[Resource/vendor-email]]",
        updated: "2026-06-01",
      },
      {
        path: "Rewrite Docs",
        title: "Rewrite Docs",
        status: "active",
        priority: "medium",
        deadline: "",
        nextAction: null,
        lastAction: null,
        updated: "2026-05-01",
      },
    ], "2026-06-18");

    expect(result.blocked).toHaveLength(1);
    expect(result.noNextAction).toHaveLength(1);
    expect(result.staleActive).toHaveLength(1);
  });

  test("canPromoteTask requires cross-project, urgent, or coordination signals", () => {
    expect(canPromoteTask({ status: "open", crossProject: true })).toBe(true);
    expect(canPromoteTask({ status: "open" })).toBe(false);
    expect(canPromoteTask({ status: "done", crossProject: true })).toBe(false);
  });
});
