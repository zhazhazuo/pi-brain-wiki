import { describe, expect, test } from "bun:test";
import { taskExec, taskExport, parseTaskwarriorError } from "./task-cli.ts";
import type { CommandRunner } from "./capture.ts";

function makeRunner(response: { stdout: string; stderr: string; code: number }): CommandRunner {
  return {
    exec: async () => response,
  } as CommandRunner;
}

function makeThrowingRunner(error: Error): CommandRunner {
  return {
    exec: async () => {
      throw error;
    },
  } as CommandRunner;
}

function makeTrackedRunner(response: { stdout: string; stderr: string; code: number }): CommandRunner & { calls: [string, string[]][] } {
  const calls: [string, string[]][] = [];
  return {
    exec: async (command: string, args: string[]) => {
      calls.push([command, args]);
      return response;
    },
    calls,
  } as unknown as CommandRunner & { calls: [string, string[]][] };
}

describe("taskExec", () => {
  test("returns success on clean exit", async () => {
    const runner = makeRunner({ stdout: "ok", stderr: "", code: 0 });
    const result = await taskExec(runner, ["list"]);
    expect(result.success).toBe(true);
    expect(result.stdout).toBe("ok");
    expect(result.exitCode).toBe(0);
    expect(result.command).toBe("task list");
    expect(result.dryRun).toBe(false);
    expect(result.errors).toEqual([]);
  });

  test("returns error on non-zero exit", async () => {
    const runner = makeRunner({ stdout: "", stderr: "Configuration error", code: 1 });
    const result = await taskExec(runner, ["add", "foo"]);
    expect(result.success).toBe(false);
    expect(result.errors).toContain("Configuration error");
    expect(result.command).toBe("task add foo");
    expect(result.dryRun).toBe(false);
  });

  test("returns error with exitCode 127 when runner.exec throws", async () => {
    const runner = makeThrowingRunner(new Error("spawn task ENOENT"));
    const result = await taskExec(runner, ["list"]);
    expect(result.success).toBe(false);
    expect(result.exitCode).toBe(127);
    expect(result.stdout).toBe("");
    expect(result.stderr).toBe("spawn task ENOENT");
    expect(result.command).toBe("task list");
    expect(result.dryRun).toBe(false);
    expect(result.errors).toContain("Taskwarrior not installed. Install Taskwarrior 3.4+ and configure ~/.taskrc.");
  });

  test("dry-run returns command without executing", async () => {
    const runner = makeTrackedRunner({ stdout: "", stderr: "", code: 0 });
    const result = await taskExec(runner, ["add", "test"], { dryRun: true });
    expect(result.success).toBe(true);
    expect(result.command).toBe("task add test");
    expect(result.dryRun).toBe(true);
    expect(result.errors).toEqual([]);
    expect(runner.calls).toHaveLength(0);
  });
});

describe("taskExport", () => {
  test("parses JSON array from stdout", async () => {
    const records = [
      { id: 1, uuid: "abc", description: "Test", status: "pending", urgency: 1 },
    ];
    const runner = makeRunner({ stdout: JSON.stringify(records), stderr: "", code: 0 });
    const result = await taskExport(runner, "status:pending");
    expect(result).toHaveLength(1);
    expect(result[0].description).toBe("Test");
  });

  test("returns empty array on parse failure", async () => {
    const runner = makeRunner({ stdout: "not json", stderr: "", code: 0 });
    const result = await taskExport(runner, "all");
    expect(result).toHaveLength(0);
  });

  test("returns empty array when taskExec fails", async () => {
    const runner = makeRunner({ stdout: "", stderr: "Configuration error", code: 1 });
    const result = await taskExport(runner, "status:pending");
    expect(result).toHaveLength(0);
  });
});

describe("parseTaskwarriorError", () => {
  test("detects UDA error", () => {
    const errors = parseTaskwarriorError("UDA reference 'estimate'");
    expect(errors[0]).toContain("UDA not configured. Check ~/.taskrc for required UDA definitions.");
  });

  test("detects command not found", () => {
    const errors = parseTaskwarriorError("ENOENT: command not found");
    expect(errors[0]).toContain("Taskwarrior not installed");
  });

  test("falls back to trimmed stderr for generic errors", () => {
    const errors = parseTaskwarriorError("Some random error occurred");
    expect(errors).toEqual(["Some random error occurred"]);
  });
});
