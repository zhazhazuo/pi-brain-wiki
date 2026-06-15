import { connect } from "node:net";
import { homedir } from "node:os";
import { join } from "node:path";
import type { ObsidianClientConfig, BacklinkResult, SearchHit } from "./types.ts";

const DEFAULT_SOCKET_PATH = join(homedir(), ".obsidian-cli.sock");
const DEFAULT_TIMEOUT = 10000;

export class ObsidianClient {
  readonly config: ObsidianClientConfig;

  constructor(config: Partial<ObsidianClientConfig> & { vaultCwd: string }) {
    this.config = {
      socketPath: config.socketPath ?? DEFAULT_SOCKET_PATH,
      vaultCwd: config.vaultCwd,
      timeout: config.timeout ?? DEFAULT_TIMEOUT,
    };
  }

  async exec(argv: string[], params?: Record<string, string | boolean | number>): Promise<string> {
    const args = [...argv];
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        if (typeof v === "boolean") {
          if (v) args.push(k);
        } else {
          args.push(`${k}=${v}`);
        }
      }
    }
    const payload = JSON.stringify({
      argv: args,
      tty: false,
      cwd: this.config.vaultCwd,
    }) + "\n";

    return new Promise<string>((resolve, reject) => {
      const socket = connect(this.config.socketPath);
      let buffer = "";
      let settled = false;
      const timer = setTimeout(() => {
        settled = true;
        socket.destroy();
        reject(new Error(`ObsidianClient exec timeout after ${this.config.timeout}ms: ${argv.join(" ")}`));
      }, this.config.timeout);

      socket.on("connect", () => {
        socket.write(payload);
      });

      socket.on("data", (chunk: Buffer) => {
        buffer += chunk.toString();
      });

      socket.on("error", (err: Error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(err);
      });

      socket.on("close", () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (!buffer) {
          reject(new Error(`ObsidianClient connection closed before full response: ${argv.join(" ")}`));
        } else {
          resolve(buffer.trimEnd());
        }
      });
    });
  }

  async ping(): Promise<boolean> {
    try {
      const raw = await this.exec(["version"]);
      return /^\d+\.\d+\.\d+/.test(raw.trim());
    } catch {
      return false;
    }
  }

  async backlinks(file: string): Promise<BacklinkResult[]> {
    const raw = await this.exec(["backlinks"], { path: file, counts: true, format: "json" });
    if (raw.trim() === "No backlinks found.") {
      return [];
    }
    const data = parseJsonArray(raw, `Obsidian backlinks failed for ${file}`);
    return data.map((entry: any) => ({
      file: String(entry.file),
      count: Number(entry.count ?? 1),
    }));
  }

  async links(file: string): Promise<string[]> {
    const raw = await this.exec(["links"], { path: file });
    return parseLineList(raw, `Obsidian links failed for ${file}`);
  }

  async searchContext(query: string, opts?: { path?: string; limit?: number }): Promise<SearchHit[]> {
    const params: Record<string, string | boolean> = { query };
    if (opts?.path) params.path = opts.path;
    if (opts?.limit) params.limit = String(opts.limit);
    params.format = "json";

    const raw = await this.exec(["search:context"], params);
    if (raw.trim() === "No matches found.") {
      return [];
    }
    return parseJsonArray(raw, `Obsidian search:context failed for "${query}"`) as SearchHit[];
  }

  async listDir(dirPath: string): Promise<Array<{ name: string; isDir: boolean; path: string }>> {
    const [folderRaw, fileRaw] = await Promise.all([
      this.exec(["folders"], { folder: dirPath }),
      this.exec(["files"], { folder: dirPath }),
    ]);
    const folders = parseLineList(folderRaw, `Obsidian folders failed for ${dirPath}`)
      .filter((path) => path !== dirPath && parentPath(path) === dirPath)
      .map((path) => ({ name: baseName(path), isDir: true, path }));
    const files = parseLineList(fileRaw, `Obsidian files failed for ${dirPath}`)
      .filter((path) => parentPath(path) === dirPath)
      .map((path) => ({ name: baseName(path), isDir: false, path }));
    return [...folders, ...files].sort((a, b) => a.name.localeCompare(b.name));
  }

  async readFile(filePath: string): Promise<string> {
    const raw = await this.exec(["read"], { path: filePath });
    assertNoCliError(raw, `Obsidian read failed for ${filePath}`);
    return raw;
  }

  async writeFile(filePath: string, content: string): Promise<void> {
    const raw = await this.exec(["create"], { content, overwrite: true, path: filePath });
    assertNoCliError(raw, `Obsidian write failed for ${filePath}`);
  }

  // ── File Operations ────────────────────────────────────────────

  async create(
    path: string,
    content?: string,
    options?: { template?: string; overwrite?: boolean; open?: boolean }
  ): Promise<void> {
    const params: Record<string, string | boolean> = {};
    if (content !== undefined) params.content = content;
    if (options?.template) params.template = options.template;
    if (options?.overwrite) params.overwrite = true;
    if (options?.open) params.open = true;
    params.path = path;

    const raw = await this.exec(["create"], params);
    assertNoCliError(raw, `Obsidian create failed for ${path}`);
  }

  async append(
    path: string,
    content: string,
    options?: { inline?: boolean }
  ): Promise<void> {
    const params: Record<string, string | boolean> = { content, path };
    if (options?.inline) params.inline = true;

    const raw = await this.exec(["append"], params);
    assertNoCliError(raw, `Obsidian append failed for ${path}`);
  }

  async prepend(
    path: string,
    content: string,
    options?: { inline?: boolean }
  ): Promise<void> {
    const params: Record<string, string | boolean> = { content, path };
    if (options?.inline) params.inline = true;

    const raw = await this.exec(["prepend"], params);
    assertNoCliError(raw, `Obsidian prepend failed for ${path}`);
  }

  async move(from: string, to: string): Promise<void> {
    const raw = await this.exec(["move"], { to, path: from });
    assertNoCliError(raw, `Obsidian move failed for ${from} -> ${to}`);
  }

  async rename(path: string, name: string): Promise<void> {
    const raw = await this.exec(["rename"], { name, path });
    assertNoCliError(raw, `Obsidian rename failed for ${path}`);
  }

  async delete(path: string, permanent = false): Promise<void> {
    const params: Record<string, string | boolean> = {};
    if (permanent) params.permanent = true;
    params.path = path;

    const raw = await this.exec(["delete"], params);
    assertNoCliError(raw, `Obsidian delete failed for ${path}`);
  }

  // ── Graph Lint ─────────────────────────────────────────────────

  async unresolved(options?: {
    total?: boolean;
    counts?: boolean;
    verbose?: boolean;
    format?: "json" | "tsv" | "csv";
  }): Promise<any[]> {
    const params: Record<string, string | boolean> = {};
    if (options?.total) params.total = true;
    if (options?.counts) params.counts = true;
    if (options?.verbose) params.verbose = true;
    if (options?.format) params.format = options.format;

    const raw = await this.exec(["unresolved"], params);
    if (options?.format === "json") {
      return parseJsonArray(raw, "Obsidian unresolved failed").map(normalizeUnresolvedEntry);
    }
    return parseLineList(raw, "Obsidian unresolved failed");
  }

  async orphans(options?: { total?: boolean }): Promise<string[]> {
    const params: Record<string, string | boolean> = {};
    if (options?.total) params.total = true;

    const raw = await this.exec(["orphans"], params);
    return options?.total ? [raw] : parseLineList(raw, "Obsidian orphans failed");
  }

  async deadends(options?: { total?: boolean }): Promise<string[]> {
    const params: Record<string, string | boolean> = {};
    if (options?.total) params.total = true;

    const raw = await this.exec(["deadends"], params);
    return options?.total ? [raw] : parseLineList(raw, "Obsidian deadends failed");
  }

  // ── Properties ─────────────────────────────────────────────────

  async propertySet(
    file: string,
    name: string,
    value: string,
    type?: "text" | "list" | "number" | "checkbox" | "date" | "datetime"
  ): Promise<void> {
    const params: Record<string, string | boolean> = { name, value };
    if (type) params.type = type;
    params.path = file;

    const raw = await this.exec(["property:set"], params);
    assertNoCliError(raw, `Obsidian property:set failed for ${file}`);
  }

  async propertyRead(file: string, name: string): Promise<any> {
    const raw = await this.exec(["property:read"], { name, path: file });
    assertNoCliError(raw, `Obsidian property:read failed for ${file}`);
    return parseScalar(raw);
  }

  async properties(file: string, options?: {
    format?: "yaml" | "json" | "tsv";
    counts?: boolean;
  }): Promise<Record<string, any>> {
    const params: Record<string, string | boolean> = {};
    params.format = options?.format ?? "json";
    if (options?.counts) params.counts = true;
    params.path = file;

    const raw = await this.exec(["properties"], params);
    return parseJson(raw, `Obsidian properties failed for ${file}`);
  }

  // ── Search & Templates ─────────────────────────────────────────

  async search(query: string, options?: {
    path?: string;
    limit?: number;
    format?: "text" | "json";
    caseSensitive?: boolean;
    total?: boolean;
  }): Promise<any> {
    const params: Record<string, string | boolean> = { query };
    if (options?.path) params.path = options.path;
    if (options?.limit) params.limit = String(options.limit);
    if (options?.format) params.format = options.format;
    if (options?.caseSensitive) params.case = true;
    if (options?.total) params.total = true;

    const raw = await this.exec(["search"], params);
    if (options?.format === "json") {
      return parseJson(raw, `Obsidian search failed for "${query}"`);
    }
    return parseLineList(raw, `Obsidian search failed for "${query}"`);
  }

  async outline(file: string, options?: { format?: "json" | "text" }): Promise<Array<{ level: number; text: string }>> {
    const params: Record<string, string | boolean> = { path: file, format: options?.format ?? "json" };

    const raw = await this.exec(["outline"], params);
    if ((options?.format ?? "json") === "json") {
      return parseJsonArray(raw, `Obsidian outline failed for ${file}`).map((entry: any) => ({
        level: Number(entry.level),
        text: String(entry.text),
      }));
    }
    return parseLineList(raw, `Obsidian outline failed for ${file}`).map((line) => ({
      level: 1,
      text: line,
    }));
  }

  async templateRead(name: string, options?: {
    resolve?: boolean;
    title?: string;
  }): Promise<string> {
    const params: Record<string, string | boolean> = {};
    if (options?.resolve) params.resolve = true;
    if (options?.title) params.title = options.title;

    params.name = name;
    const raw = await this.exec(["template:read"], params);
    assertNoCliError(raw, `Obsidian template:read failed for "${name}"`);
    return raw;
  }

  async files(options?: {
    folder?: string;
    ext?: string;
    total?: boolean;
  }): Promise<string[]> {
    const params: Record<string, string | boolean> = {};
    if (options?.folder) params.folder = options.folder;
    if (options?.ext) params.ext = options.ext;
    if (options?.total) params.total = true;

    const raw = await this.exec(["files"], params);
    return options?.total ? [raw] : parseLineList(raw, "Obsidian files failed");
  }

  async folders(options?: {
    folder?: string;
    total?: boolean;
  }): Promise<string[]> {
    const params: Record<string, string | boolean> = {};
    if (options?.folder) params.folder = options.folder;
    if (options?.total) params.total = true;

    const raw = await this.exec(["folders"], params);
    return options?.total ? [raw] : parseLineList(raw, "Obsidian folders failed");
  }
}

function parseJson(raw: string, context: string): any {
  assertNoCliError(raw, context);
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`${context}: ${error instanceof Error ? error.message : String(error)}: ${raw}`);
  }
}

function parseJsonArray(raw: string, context: string): any[] {
  const parsed = parseJson(raw, context);
  const data = Array.isArray(parsed) ? parsed : parsed?.data;
  if (!Array.isArray(data)) {
    throw new Error(`${context}: ${raw}`);
  }
  return data;
}

function parseLineList(raw: string, context: string): string[] {
  assertNoCliError(raw, context);
  return raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

function parseScalar(raw: string): any {
  const trimmed = raw.trim();
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed);
  return trimmed;
}

function assertNoCliError(raw: string, context: string): void {
  if (/^Error:/i.test(raw.trim())) {
    throw new Error(`${context}: ${raw}`);
  }
}

function normalizeUnresolvedEntry(entry: any): any {
  if (typeof entry?.sources === "string") {
    return { ...entry, sources: [entry.sources] };
  }
  return entry;
}

function parentPath(path: string): string {
  const index = path.lastIndexOf("/");
  return index >= 0 ? path.slice(0, index) : "";
}

function baseName(path: string): string {
  const index = path.lastIndexOf("/");
  return index >= 0 ? path.slice(index + 1) : path;
}
