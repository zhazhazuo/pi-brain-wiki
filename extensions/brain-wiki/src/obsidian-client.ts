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

  async exec(argv: string[], params?: Record<string, string | boolean>): Promise<string> {
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
      const timer = setTimeout(() => {
        socket.destroy();
        reject(new Error(`ObsidianClient exec timeout after ${this.config.timeout}ms: ${argv.join(" ")}`));
      }, this.config.timeout);

      socket.on("connect", () => {
        socket.write(payload);
      });

      socket.on("data", (chunk: Buffer) => {
        buffer += chunk.toString();
        // Response is a single newline-delimited JSON object
        if (buffer.includes("\n")) {
          clearTimeout(timer);
          socket.end();
          resolve(buffer.trim());
        }
      });

      socket.on("error", (err: Error) => {
        clearTimeout(timer);
        reject(err);
      });

      socket.on("close", () => {
        clearTimeout(timer);
        if (!buffer.includes("\n")) {
          reject(new Error(`ObsidianClient connection closed before full response: ${argv.join(" ")}`));
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
    const raw = await this.exec(["backlinks", file]);
    const parsed = JSON.parse(raw);
    if (!parsed?.ok || !Array.isArray(parsed.data)) {
      throw new Error(`Obsidian backlinks failed for ${file}: ${raw}`);
    }
    return parsed.data as BacklinkResult[];
  }

  async searchContext(query: string, opts?: { path?: string; limit?: number }): Promise<SearchHit[]> {
    const params: Record<string, string | boolean> = {};
    if (opts?.path) params.path = opts.path;
    if (opts?.limit) params.limit = String(opts.limit);

    const raw = await this.exec(["search-context", query], params);
    const parsed = JSON.parse(raw);
    if (!parsed?.ok || !Array.isArray(parsed.data)) {
      throw new Error(`Obsidian search-context failed for "${query}": ${raw}`);
    }
    return parsed.data as SearchHit[];
  }

  async listDir(dirPath: string): Promise<Array<{ name: string; isDir: boolean; path: string }>> {
    const raw = await this.exec(["list", dirPath]);
    const parsed = JSON.parse(raw);
    if (!parsed?.ok || !Array.isArray(parsed.data)) {
      throw new Error(`Obsidian list failed for ${dirPath}: ${raw}`);
    }
    return parsed.data;
  }

  async readFile(filePath: string): Promise<string> {
    const raw = await this.exec(["read", filePath]);
    const parsed = JSON.parse(raw);
    if (!parsed?.ok || typeof parsed.data !== "string") {
      throw new Error(`Obsidian read failed for ${filePath}: ${raw}`);
    }
    return parsed.data;
  }

  async writeFile(filePath: string, content: string): Promise<void> {
    const raw = await this.exec(["write", filePath], { content });
    const parsed = JSON.parse(raw);
    if (!parsed?.ok) {
      throw new Error(`Obsidian write failed for ${filePath}: ${raw}`);
    }
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

    const raw = await this.exec(["create", path], params);
    const parsed = JSON.parse(raw);
    if (!parsed?.ok) {
      throw new Error(`Obsidian create failed for ${path}: ${raw}`);
    }
  }

  async append(
    path: string,
    content: string,
    options?: { inline?: boolean }
  ): Promise<void> {
    const params: Record<string, string | boolean> = { content };
    if (options?.inline) params.inline = true;

    const raw = await this.exec(["append", path], params);
    const parsed = JSON.parse(raw);
    if (!parsed?.ok) {
      throw new Error(`Obsidian append failed for ${path}: ${raw}`);
    }
  }

  async prepend(
    path: string,
    content: string,
    options?: { inline?: boolean }
  ): Promise<void> {
    const params: Record<string, string | boolean> = { content };
    if (options?.inline) params.inline = true;

    const raw = await this.exec(["prepend", path], params);
    const parsed = JSON.parse(raw);
    if (!parsed?.ok) {
      throw new Error(`Obsidian prepend failed for ${path}: ${raw}`);
    }
  }

  async move(from: string, to: string): Promise<void> {
    const raw = await this.exec(["move", from], { to });
    const parsed = JSON.parse(raw);
    if (!parsed?.ok) {
      throw new Error(`Obsidian move failed for ${from} -> ${to}: ${raw}`);
    }
  }

  async rename(path: string, name: string): Promise<void> {
    const raw = await this.exec(["rename", path], { name });
    const parsed = JSON.parse(raw);
    if (!parsed?.ok) {
      throw new Error(`Obsidian rename failed for ${path}: ${raw}`);
    }
  }

  async delete(path: string, permanent = false): Promise<void> {
    const params: Record<string, string | boolean> = {};
    if (permanent) params.permanent = true;

    const raw = await this.exec(["delete", path], params);
    const parsed = JSON.parse(raw);
    if (!parsed?.ok) {
      throw new Error(`Obsidian delete failed for ${path}: ${raw}`);
    }
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
    const parsed = JSON.parse(raw);
    if (!parsed?.ok) {
      throw new Error(`Obsidian unresolved failed: ${raw}`);
    }
    return parsed.data ?? [];
  }

  async orphans(options?: { total?: boolean }): Promise<string[]> {
    const params: Record<string, string | boolean> = {};
    if (options?.total) params.total = true;

    const raw = await this.exec(["orphans"], params);
    const parsed = JSON.parse(raw);
    if (!parsed?.ok) {
      throw new Error(`Obsidian orphans failed: ${raw}`);
    }
    return parsed.data ?? [];
  }

  async deadends(options?: { total?: boolean }): Promise<string[]> {
    const params: Record<string, string | boolean> = {};
    if (options?.total) params.total = true;

    const raw = await this.exec(["deadends"], params);
    const parsed = JSON.parse(raw);
    if (!parsed?.ok) {
      throw new Error(`Obsidian deadends failed: ${raw}`);
    }
    return parsed.data ?? [];
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

    const raw = await this.exec(["property:set", file], params);
    const parsed = JSON.parse(raw);
    if (!parsed?.ok) {
      throw new Error(`Obsidian property:set failed for ${file}: ${raw}`);
    }
  }

  async propertyRead(file: string, name: string): Promise<any> {
    const raw = await this.exec(["property:read", file], { name });
    const parsed = JSON.parse(raw);
    if (!parsed?.ok) {
      throw new Error(`Obsidian property:read failed for ${file}: ${raw}`);
    }
    return parsed.data;
  }

  async properties(file: string, options?: {
    format?: "yaml" | "json" | "tsv";
    counts?: boolean;
  }): Promise<Record<string, any>> {
    const params: Record<string, string | boolean> = {};
    if (options?.format) params.format = options.format;
    if (options?.counts) params.counts = true;

    const raw = await this.exec(["properties", file], params);
    const parsed = JSON.parse(raw);
    if (!parsed?.ok) {
      throw new Error(`Obsidian properties failed for ${file}: ${raw}`);
    }
    return parsed.data ?? {};
  }

  // ── Search & Templates ─────────────────────────────────────────

  async search(query: string, options?: {
    path?: string;
    limit?: number;
    format?: "text" | "json";
    caseSensitive?: boolean;
    total?: boolean;
  }): Promise<any> {
    const params: Record<string, string | boolean> = {};
    if (options?.path) params.path = options.path;
    if (options?.limit) params.limit = String(options.limit);
    if (options?.format) params.format = options.format;
    if (options?.caseSensitive) params.case = true;
    if (options?.total) params.total = true;

    const raw = await this.exec(["search", query], params);
    const parsed = JSON.parse(raw);
    if (!parsed?.ok) {
      throw new Error(`Obsidian search failed for "${query}": ${raw}`);
    }
    return parsed.data ?? [];
  }

  async templateRead(name: string, options?: {
    resolve?: boolean;
    title?: string;
  }): Promise<string> {
    const params: Record<string, string | boolean> = {};
    if (options?.resolve) params.resolve = true;
    if (options?.title) params.title = options.title;

    const raw = await this.exec(["template:read", name], params);
    const parsed = JSON.parse(raw);
    if (!parsed?.ok || typeof parsed.data !== "string") {
      throw new Error(`Obsidian template:read failed for "${name}": ${raw}`);
    }
    return parsed.data;
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
    const parsed = JSON.parse(raw);
    if (!parsed?.ok) {
      throw new Error(`Obsidian files failed: ${raw}`);
    }
    return parsed.data ?? [];
  }

  async folders(options?: {
    folder?: string;
    total?: boolean;
  }): Promise<string[]> {
    const params: Record<string, string | boolean> = {};
    if (options?.folder) params.folder = options.folder;
    if (options?.total) params.total = true;

    const raw = await this.exec(["folders"], params);
    const parsed = JSON.parse(raw);
    if (!parsed?.ok) {
      throw new Error(`Obsidian folders failed: ${raw}`);
    }
    return parsed.data ?? [];
  }
}
