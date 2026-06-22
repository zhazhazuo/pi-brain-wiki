import { access, readFile } from "node:fs/promises";
import { loadSkills } from "@mariozechner/pi-coding-agent";
import {
  getPackageSkillPaths,
  listPackageSkillFiles,
} from "../extensions/brain-wiki/src/skills.ts";

const requiredFiles = [
  "package.json",
  "package-lock.json",
  "README.md",
  "LICENSE",
  "extensions/brain-wiki/index.ts",
  "skills/brain-wiki/SKILL.md",
  "extensions/brain-wiki/src/config.ts",
  "extensions/brain-wiki/src/capture.ts",
  "extensions/brain-wiki/src/indexer.ts",
  "extensions/brain-wiki/src/lint.ts",
  "extensions/brain-wiki/src/skills.ts",
  "scripts/release.ts",
  ".github/workflows/ci.yml",
  ".github/workflows/release.yml",
];

for (const path of requiredFiles) {
  await access(path);
}

const pkg = JSON.parse(await readFile("package.json", "utf8"));
if (!pkg.pi?.extensions?.includes("./extensions/brain-wiki/index.ts")) {
  throw new Error("package.json pi.extensions is missing ./extensions/brain-wiki/index.ts");
}

if (!pkg.files?.includes("skills")) {
  throw new Error('package.json files must include "skills"');
}

const skillsPath = "./skills";
if (!pkg.pi?.skills?.includes(skillsPath)) {
  throw new Error(`package.json pi.skills is missing ${skillsPath}`);
}

const packageSkillFiles = await listPackageSkillFiles();
if (packageSkillFiles.length === 0) {
  throw new Error("No skills discovered under ./skills");
}

const skillsResult = loadSkills({
  cwd: process.cwd(),
  skillPaths: [skillsPath],
  includeDefaults: false,
});
const loadedSkillFiles = new Set(skillsResult.skills.map((skill) => skill.filePath));
for (const skillFile of packageSkillFiles) {
  if (!loadedSkillFiles.has(skillFile)) {
    throw new Error(`Expected Pi skill to load: ${skillFile}`);
  }
}
if (skillsResult.diagnostics.length > 0) {
  const diagnostics = skillsResult.diagnostics
    .map((diagnostic) => `${diagnostic.path}: ${diagnostic.message}`)
    .join("\n");
  throw new Error(`Pi skill diagnostics found:\n${diagnostics}`);
}

const extensionSkillPaths = getPackageSkillPaths();
const extensionSkillsResult = loadSkills({
  cwd: process.cwd(),
  skillPaths: extensionSkillPaths,
  includeDefaults: false,
});
if (extensionSkillsResult.diagnostics.length > 0) {
  const diagnostics = extensionSkillsResult.diagnostics
    .map((diagnostic) => `${diagnostic.path}: ${diagnostic.message}`)
    .join("\n");
  throw new Error(`Extension skill path diagnostics found:\n${diagnostics}`);
}
for (const skillFile of packageSkillFiles) {
  if (!extensionSkillsResult.skills.some((skill) => skill.filePath === skillFile)) {
    throw new Error(`Extension skill discovery failed to load: ${skillFile}`);
  }
}

const extensionSource = await readFile("extensions/brain-wiki/index.ts", "utf8");
if (!extensionSource.includes("getPackageSkillPaths()")) {
  throw new Error("extensions/brain-wiki/index.ts must register package skills via getPackageSkillPaths()");
}

if (!Array.isArray(pkg.keywords) || !pkg.keywords.includes("pi-package")) {
  throw new Error('package.json keywords must include "pi-package"');
}

console.log("pi-brain-wiki sanity check passed");
