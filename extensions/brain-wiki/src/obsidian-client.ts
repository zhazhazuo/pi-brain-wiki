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
      const raw = await this.exec(["ping"]);
      const parsed = JSON.parse(raw);
      return parsed?.ok === true;
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
}
