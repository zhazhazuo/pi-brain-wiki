import type { CommandRunner } from "./capture.ts";
import type { TaskCliResult, TaskExportRecord } from "./types.ts";

export async function taskExec(
  runner: CommandRunner,
  args: string[],
  options?: { dryRun?: boolean },
): Promise<TaskCliResult & { command?: string; dryRun?: boolean; errors?: string[] }> {
  const command = ["task", ...args].join(" ");

  if (options?.dryRun) {
    return { success: true, stdout: "", stderr: "", exitCode: 0, command, dryRun: true, errors: [] };
  }

  try {
    const { stdout, stderr, code } = await runner.exec("task", args);
    const errors = code !== 0 ? parseTaskwarriorError(stderr) : [];
    return { success: code === 0, stdout, stderr, exitCode: code, command, dryRun: false, errors };
  } catch (error) {
    const message = (error as Error).message;
    return {
      success: false,
      stdout: "",
      stderr: message,
      exitCode: 127,
      command,
      dryRun: false,
      errors: parseTaskwarriorError(message),
    };
  }
}

export async function taskExport(
  runner: CommandRunner,
  filter: string,
): Promise<TaskExportRecord[]> {
  const result = await taskExec(runner, [filter, "export", "rc.json.array=on"]);
  if (!result.success || !result.stdout.trim()) return [];
  try {
    return JSON.parse(result.stdout) as TaskExportRecord[];
  } catch {
    return [];
  }
}

export function parseTaskwarriorError(stderr: string): string[] {
  const errors: string[] = [];
  if (stderr.includes("UDA") || stderr.includes("uda")) {
    errors.push(
      "UDA not configured. Check ~/.taskrc for required UDA definitions.",
    );
  }
  if (stderr.includes("ENOENT") || stderr.includes("command not found")) {
    errors.push("Taskwarrior not installed. Install Taskwarrior 3.4+ and configure ~/.taskrc.");
  }
  if (errors.length === 0 && stderr.trim()) {
    errors.push(stderr.trim());
  }
  return errors;
}
