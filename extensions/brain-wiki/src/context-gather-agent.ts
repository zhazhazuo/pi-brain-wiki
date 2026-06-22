import { access } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import type {
  ContextGatherIntent,
  GatherRepoAgentInput,
  GatherRepoAgentResult,
  ResolvedExternalContext,
} from "./types.ts";

const AGENT_TIMEOUT_MS = 180_000;

export async function runRepoGatherAgent(
  input: GatherRepoAgentInput,
): Promise<GatherRepoAgentResult> {
  if (process.env.BRAIN_WIKI_SKIP_REPO_GATHER_AGENT === "1") {
    return {
      exitCode: 1,
      brief: "",
      stderr: "repo gather agent disabled",
    };
  }

  const task = await buildGatherAgentTask(input.context, input.intent, input.query);
  const args = ["--mode", "json", "-p", "--no-session", "--tools", "read,grep,find,ls,bash", task];
  const invocation = getPiInvocation(args);

  return new Promise<GatherRepoAgentResult>((resolvePromise, rejectPromise) => {
    const proc = spawn(invocation.command, invocation.args, {
      cwd: input.context.repo_path,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let settled = false;
    const messages: Array<{ role: string; content?: unknown }> = [];

    const finish = (result: GatherRepoAgentResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (input.signal) {
        input.signal.removeEventListener("abort", onAbort);
      }
      resolvePromise(result);
    };

    const onAbort = () => {
      proc.kill("SIGTERM");
      finish({
        exitCode: 1,
        brief: "",
        stderr: "External context gather agent aborted.",
      });
    };

    const timeout = setTimeout(() => {
      proc.kill("SIGTERM");
      finish({
        exitCode: 1,
        brief: "",
        stderr: `External context gather agent timed out after ${AGENT_TIMEOUT_MS}ms.`,
      });
    }, AGENT_TIMEOUT_MS);

    if (input.signal) {
      if (input.signal.aborted) {
        onAbort();
        return;
      }
      input.signal.addEventListener("abort", onAbort, { once: true });
    }

    const processLine = (line: string) => {
      if (!line.trim()) return;
      let event: { type?: string; message?: { role?: string; content?: unknown; model?: string } };
      try {
        event = JSON.parse(line);
      } catch {
        return;
      }

      if (event.type === "message_end" && event.message?.role) {
        messages.push(event.message);
        if (event.message.role === "assistant" && input.onUpdate) {
          const brief = extractAssistantText(event.message.content);
          if (brief) {
            input.onUpdate(brief);
          }
        }
      }
    };

    proc.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
      const lines = stdout.split("\n");
      stdout = lines.pop() ?? "";
      for (const line of lines) {
        processLine(line);
      }
    });

    proc.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    proc.on("error", (error) => {
      finish({
        exitCode: 1,
        brief: "",
        stderr: error.message,
      });
    });

    proc.on("close", (code) => {
      if (stdout.trim()) {
        processLine(stdout);
      }

      const assistant = [...messages].reverse().find((message) => message.role === "assistant");
      const brief = assistant ? extractAssistantText(assistant.content) : "";
      const model = typeof assistant?.content === "object" && assistant && "model" in assistant
        ? String((assistant as { model?: string }).model ?? "")
        : undefined;

      finish({
        exitCode: code ?? 1,
        brief,
        stderr: stderr.trim(),
        model: model || undefined,
      });
    });
  });
}

export async function buildGatherAgentTask(
  context: ResolvedExternalContext,
  intent: ContextGatherIntent,
  query?: string,
): Promise<string> {
  const agentsPath = join(context.repo_path, "AGENTS.md");
  let agentsInstruction = "If AGENTS.md exists in the repository root, read it first and follow repository-local agent rules.";
  try {
    await access(agentsPath);
    agentsInstruction = "Read AGENTS.md first and follow repository-local agent rules and skills.";
  } catch {
    // optional file
  }

  const scope = [
    context.seed_files.length > 0 ? `seed files: ${context.seed_files.join(", ")}` : null,
    context.include_paths.length > 0 ? `include paths: ${context.include_paths.join(", ")}` : null,
    context.exclude_paths.length > 0 ? `exclude paths: ${context.exclude_paths.join(", ")}` : null,
    context.search_terms.length > 0 ? `search terms: ${context.search_terms.join(", ")}` : null,
  ].filter(Boolean).join("\n- ");

  const intentInstruction = buildIntentInstruction(intent, query);

  return [
    "You are an isolated external-context gatherer for brain-wiki.",
    "Work only inside this repository. Do not modify files.",
    agentsInstruction,
    "Use repository-local docs, skills, and code inspection as needed.",
    "Return a concise brief for the parent wiki agent. Do not ask follow-up questions.",
  ].join("\n")
    + "\n\n"
    + [
      `Context label: ${context.label}`,
      `PKB note: ${context.pkb_note}`,
      `Intent: ${intent}`,
      query ? `Query: ${query}` : null,
      scope ? `Scope hints:\n- ${scope}` : null,
      "",
      intentInstruction,
      "",
      "Output exactly these sections:",
      "## Summary",
      "- bullet findings",
      "## Evidence",
      "- file paths and key facts",
      "## Limits",
      "- unknowns or bounds hit",
      "## Suggested follow-ups",
      "- next inspection targets",
    ].filter((line): line is string => line !== null).join("\n");
}

function buildIntentInstruction(intent: ContextGatherIntent, query?: string): string {
  switch (intent) {
    case "overview":
      return "Explain what this repository is, its purpose, top-level structure, and tech stack.";
    case "architecture":
      return "Explain entrypoints, major modules, boundaries, and important dependencies.";
    case "implementation":
      return `Locate and explain where "${query ?? ""}" is implemented with file evidence.`;
    case "recent_changes":
      return "Summarize recent commits and what changed in areas relevant to this context.";
    case "question":
      return `Answer this concrete question using bounded repository evidence: ${query ?? ""}`;
    case "handoff":
      return "Produce a compact handoff brief: current understanding, key files, and next actions.";
  }
}

function extractAssistantText(content: unknown): string {
  if (typeof content === "string") {
    return content.trim();
  }

  if (!Array.isArray(content)) {
    return "";
  }

  return content
    .map((part) => {
      if (typeof part === "string") return part;
      if (part && typeof part === "object" && "type" in part && part.type === "text" && "text" in part) {
        return String(part.text);
      }
      return "";
    })
    .join("")
    .trim();
}

function getPiInvocation(args: string[]): { command: string; args: string[] } {
  const currentScript = process.argv[1];
  if (currentScript && existsSync(currentScript)) {
    return { command: process.execPath, args: [currentScript, ...args] };
  }

  const execName = basename(process.execPath).toLowerCase();
  const isGenericRuntime = /^(node|bun)(\.exe)?$/.test(execName);
  if (!isGenericRuntime) {
    return { command: process.execPath, args };
  }

  return { command: "pi", args };
}

export function isPathWithinRepo(repoPath: string, targetPath: string): boolean {
  const resolvedRepo = resolve(repoPath);
  const resolvedTarget = resolve(targetPath);
  return resolvedTarget === resolvedRepo || resolvedTarget.startsWith(`${resolvedRepo}/`);
}
