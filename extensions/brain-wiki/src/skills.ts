import { access, readdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageSkillsDir = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
  "skills",
);

export function getPackageSkillsDir(): string {
  return packageSkillsDir;
}

export function getPackageSkillPaths(): string[] {
  return [packageSkillsDir];
}

export async function listPackageSkillFiles(): Promise<string[]> {
  const entries = await readdir(packageSkillsDir, { withFileTypes: true });
  const skillFiles: string[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith(".")) {
      continue;
    }

    const skillFile = join(packageSkillsDir, entry.name, "SKILL.md");
    try {
      await access(skillFile);
      skillFiles.push(skillFile);
    } catch {
      // ignore directories without SKILL.md
    }
  }

  return skillFiles.sort();
}
