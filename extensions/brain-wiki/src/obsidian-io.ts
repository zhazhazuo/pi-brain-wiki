import { relative } from "node:path";
import matter from "gray-matter";
import type { ObsidianClient } from "./obsidian-client.ts";

type PropertyType = "text" | "list" | "number" | "checkbox" | "date" | "datetime";

export function toObsidianPath(client: ObsidianClient, path: string): string {
  if (!path.startsWith("/")) return path.replace(/\\/g, "/");
  return relative(client.config.vaultCwd, path).replace(/\\/g, "/");
}

export function serializeMarkdownPage(frontmatterData: Record<string, any>, body: string): string {
  const content = matter.stringify(body.trimEnd() + "\n", cleanFrontmatter(frontmatterData));
  return content.endsWith("\n") ? content : `${content}\n`;
}

export async function readMarkdown(client: ObsidianClient, path: string): Promise<string> {
  return client.readFile(toObsidianPath(client, path));
}

export async function writeMarkdown(client: ObsidianClient, path: string, content: string): Promise<void> {
  await client.create(toObsidianPath(client, path), normalizeTrailingNewline(content), { overwrite: true });
}

export async function writeMarkdownPage(
  client: ObsidianClient,
  path: string,
  frontmatterData: Record<string, any>,
  body: string,
): Promise<void> {
  await writeMarkdown(client, path, serializeMarkdownPage(frontmatterData, body));
}

export async function appendMarkdown(client: ObsidianClient, path: string, content: string): Promise<void> {
  await client.append(toObsidianPath(client, path), content);
}

export async function prependMarkdown(client: ObsidianClient, path: string, content: string): Promise<void> {
  await client.prepend(toObsidianPath(client, path), content);
}

export async function setMarkdownProperty(
  client: ObsidianClient,
  path: string,
  name: string,
  value: any,
): Promise<void> {
  await client.propertySet(toObsidianPath(client, path), name, serializePropertyValue(value), inferPropertyType(value));
}

function serializePropertyValue(value: any): string {
  return Array.isArray(value) ? JSON.stringify(value) : String(value);
}

function inferPropertyType(value: any): PropertyType {
  if (Array.isArray(value)) return "list";
  if (typeof value === "number") return "number";
  if (typeof value === "boolean") return "checkbox";
  if (/^\d{4}-\d{2}-\d{2}T/.test(String(value))) return "datetime";
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return "date";
  return "text";
}

function cleanFrontmatter(frontmatterData: Record<string, any>): Record<string, any> {
  const output: Record<string, any> = {};
  for (const [key, value] of Object.entries(frontmatterData)) {
    output[key] = value === undefined ? "" : value;
  }
  return output;
}

function normalizeTrailingNewline(content: string): string {
  return content.endsWith("\n") ? content : `${content}\n`;
}
