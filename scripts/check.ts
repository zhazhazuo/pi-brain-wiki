import { access, readFile } from "node:fs/promises";
import { join } from "node:path";
import { loadSkills } from "@mariozechner/pi-coding-agent";

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

const expectedSkills = [
  "brain-wiki",
  "recall",
  "wiki-intel",
  "wiki-map",
  "wiki-workshop",
  "workflow-extract",
  "workflow-invoke",
  "taskwarrior",
];
const skillsResult = loadSkills({
  cwd: process.cwd(),
  skillPaths: [skillsPath],
  includeDefaults: false,
});
const loadedSkillNames = new Set(skillsResult.skills.map((skill) => skill.name));
for (const name of expectedSkills) {
  if (!loadedSkillNames.has(name)) {
    throw new Error(`Expected Pi skill to load: ${name}`);
  }
}
if (skillsResult.diagnostics.length > 0) {
  const diagnostics = skillsResult.diagnostics
    .map((diagnostic) => `${diagnostic.path}: ${diagnostic.message}`)
    .join("\n");
  throw new Error(`Pi skill diagnostics found:\n${diagnostics}`);
}

if (!Array.isArray(pkg.keywords) || !pkg.keywords.includes("pi-package")) {
  throw new Error('package.json keywords must include "pi-package"');
}

console.log("pi-brain-wiki sanity check passed");
