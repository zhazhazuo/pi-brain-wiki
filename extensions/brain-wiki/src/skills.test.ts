import { describe, expect, test } from "bun:test";
import { loadSkills } from "@mariozechner/pi-coding-agent";
import {
  getPackageSkillPaths,
  getPackageSkillsDir,
  listPackageSkillFiles,
} from "./skills.ts";

describe("package skills discovery", () => {
  test("resolves the package skills directory", async () => {
    const skillFiles = await listPackageSkillFiles();
    expect(skillFiles.length).toBeGreaterThan(0);
    expect(skillFiles.every((path) => path.startsWith(getPackageSkillsDir()))).toBe(true);
  });

  test("loads every discovered skill from the skills directory", async () => {
    const skillFiles = await listPackageSkillFiles();
    const loaded = loadSkills({
      skillPaths: getPackageSkillPaths(),
      includeDefaults: false,
    });

    expect(loaded.diagnostics).toEqual([]);

    for (const skillFile of skillFiles) {
      expect(loaded.skills.some((skill) => skill.filePath === skillFile)).toBe(true);
    }
  });
});
