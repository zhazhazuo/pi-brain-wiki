import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { ObsidianClient } from "./obsidian-client.ts";
import { createServer, type Socket } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { unlinkSync } from "node:fs";

describe("ObsidianClient", () => {
  let socketPath: string;
  let server: ReturnType<typeof createServer>;
  let receivedPayloads: string[];

  function startMockServer(handler: (socket: Socket) => void): Promise<void> {
    return new Promise((resolve) => {
      server = createServer(handler);
      server.listen(socketPath, resolve);
    });
  }

  beforeEach(() => {
    socketPath = join(tmpdir(), `obsidian-test-${Date.now()}-${Math.random().toString(36).slice(2)}.sock`);
    receivedPayloads = [];
  });

  afterEach(() => {
    server?.close();
    try { unlinkSync(socketPath); } catch {}
  });

  test("exec sends a JSON-framed argv payload and returns response", async () => {
    await startMockServer((socket) => {
      socket.on("data", (data) => {
        receivedPayloads.push(data.toString());
        socket.write(JSON.stringify({ ok: true, data: "pong" }) + "\n");
        socket.end();
      });
    });

    const client = new ObsidianClient({ socketPath, vaultCwd: "/tmp/vault", timeout: 500 });
    const result = await client.exec(["ping"], {});
    expect(result).toBe(JSON.stringify({ ok: true, data: "pong" }));

    const parsed = JSON.parse(receivedPayloads[0]);
    expect(parsed.argv).toEqual(["ping"]);
    expect(parsed.tty).toBe(false);
    expect(parsed.cwd).toBe("/tmp/vault");
  });

  test("exec serializes boolean params as bare flags, string params as key=value", async () => {
    await startMockServer((socket) => {
      socket.on("data", (data) => {
        receivedPayloads.push(data.toString());
        socket.write(JSON.stringify({ ok: true, data: "ok" }) + "\n");
        socket.end();
      });
    });

    const client = new ObsidianClient({ socketPath, vaultCwd: "/v", timeout: 500 });
    await client.exec(["search", "hello"], { all: true, limit: "5", path: "Wiki" });

    const parsed = JSON.parse(receivedPayloads[0]);
    expect(parsed.argv).toEqual(["search", "hello", "all", "limit=5", "path=Wiki"]);
  });

  test("ping returns true on {ok:true} response", async () => {
    await startMockServer((socket) => {
      socket.on("data", () => {
        socket.write(JSON.stringify({ ok: true, data: "alive" }) + "\n");
        socket.end();
      });
    });

    const client = new ObsidianClient({ socketPath, vaultCwd: "/v", timeout: 500 });
    const result = await client.ping();
    expect(result).toBe(true);
  });

  test("ping returns false on non-ok response", async () => {
    await startMockServer((socket) => {
      socket.on("data", () => {
        socket.write(JSON.stringify({ ok: false, error: "dead" }) + "\n");
        socket.end();
      });
    });

    const client = new ObsidianClient({ socketPath, vaultCwd: "/v", timeout: 500 });
    const result = await client.ping();
    expect(result).toBe(false);
  });

  test("ping returns false on connection refused", async () => {
    const client = new ObsidianClient({ socketPath, vaultCwd: "/v", timeout: 200 });
    const result = await client.ping();
    expect(result).toBe(false);
  });

  test("backlinks parses Obsidian backlinks response", async () => {
    await startMockServer((socket) => {
      socket.on("data", (data) => {
        const payload = JSON.parse(data.toString());
        expect(payload.argv[0]).toBe("backlinks");
        socket.write(JSON.stringify({
          ok: true,
          data: [
            { file: "Area/Math.md", count: 3 },
            { file: "Wiki/pages/topics/Calculus.md", count: 1 },
            { file: "Project/foo.md", count: 2 },
          ]
        }) + "\n");
        socket.end();
      });
    });

    const client = new ObsidianClient({ socketPath, vaultCwd: "/v", timeout: 500 });
    const result = await client.backlinks("Wiki/pages/topics/Lambda.md");
    expect(result).toEqual([
      { file: "Area/Math.md", count: 3 },
      { file: "Wiki/pages/topics/Calculus.md", count: 1 },
      { file: "Project/foo.md", count: 2 },
    ]);
  });

  test("searchContext parses Obsidian search response", async () => {
    await startMockServer((socket) => {
      socket.on("data", (data) => {
        const payload = JSON.parse(data.toString());
        expect(payload.argv).toContain("search-context");
        socket.write(JSON.stringify({
          ok: true,
          data: [
            { file: "Wiki/pages/topics/Foo.md", matches: [{ line: 5, text: "the foo bar" }] },
            { file: "Wiki/pages/topics/Foo.md", matches: [{ line: 12, text: "foo again" }] },
            { file: "Wiki/pages/summaries/bar.md", matches: [{ line: 1, text: "# Bar foo" }] },
          ]
        }) + "\n");
        socket.end();
      });
    });

    const client = new ObsidianClient({ socketPath, vaultCwd: "/v", timeout: 500 });
    const result = await client.searchContext("foo", { path: "Wiki", limit: 3 });
    expect(result).toEqual([
      { file: "Wiki/pages/topics/Foo.md", matches: [{ line: 5, text: "the foo bar" }] },
      { file: "Wiki/pages/topics/Foo.md", matches: [{ line: 12, text: "foo again" }] },
      { file: "Wiki/pages/summaries/bar.md", matches: [{ line: 1, text: "# Bar foo" }] },
    ]);
  });

  test("backlinks throws on non-ok response", async () => {
    await startMockServer((socket) => {
      socket.on("data", () => {
        socket.write(JSON.stringify({ ok: false, error: "vault not found" }) + "\n");
        socket.end();
      });
    });

    const client = new ObsidianClient({ socketPath, vaultCwd: "/v", timeout: 500 });
    await expect(client.backlinks("Wiki/nonexistent.md")).rejects.toThrow("Obsidian backlinks failed");
  });

  test("backlinks throws on missing data array", async () => {
    await startMockServer((socket) => {
      socket.on("data", () => {
        socket.write(JSON.stringify({ ok: true, data: "not-an-array" }) + "\n");
        socket.end();
      });
    });

    const client = new ObsidianClient({ socketPath, vaultCwd: "/v", timeout: 500 });
    await expect(client.backlinks("Wiki/x.md")).rejects.toThrow("Obsidian backlinks failed");
  });

  test("exec rejects on socket timeout", async () => {
    await startMockServer((_socket) => {
      // never respond
    });

    const client = new ObsidianClient({ socketPath, vaultCwd: "/v", timeout: 50 });
    await expect(client.exec(["ping"], {})).rejects.toThrow("timeout");
  });
});
