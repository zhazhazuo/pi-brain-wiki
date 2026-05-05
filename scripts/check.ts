import { access, readFile } from "node:fs/promises";
import { join } from "node:path";

const requiredFiles = [
  "package.json",
  "package-lock.json",
  "README.md",
  "LICENSE",
  "extensions/brain-wiki/index.ts",
  "extensions/brain-wiki/resources/skills/brain-wiki/SKILL.md",
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

if (!Array.isArray(pkg.keywords) || !pkg.keywords.includes("pi-package")) {
  throw new Error('package.json keywords must include "pi-package"');
}

console.log("pi-brain-wiki sanity check passed");
