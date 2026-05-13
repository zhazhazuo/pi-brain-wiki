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

  test("exec waits for the socket to close before returning multiline responses", async () => {
    await startMockServer((socket) => {
      socket.on("data", () => {
        socket.write("[\n");
        socket.write("  {\"file\":\"A.md\"}\n");
        socket.write("]\n");
        socket.end();
      });
    });

    const client = new ObsidianClient({ socketPath, vaultCwd: "/tmp/vault", timeout: 500 });
    const result = await client.exec(["files"], { format: "json" });
    expect(result).toBe("[\n  {\"file\":\"A.md\"}\n]");
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

  test("ping uses the supported version command as its health check", async () => {
    await startMockServer((socket) => {
      socket.on("data", (data) => {
        receivedPayloads.push(data.toString());
        socket.write("1.12.7 (installer 1.12.7)\n");
        socket.end();
      });
    });

    const client = new ObsidianClient({ socketPath, vaultCwd: "/v", timeout: 500 });
    const result = await client.ping();
    expect(result).toBe(true);

    const parsed = JSON.parse(receivedPayloads[0]);
    expect(parsed.argv).toEqual(["version"]);
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

  test("backlinks uses exact path syntax and parses Obsidian JSON array response", async () => {
    await startMockServer((socket) => {
      socket.on("data", (data) => {
        const payload = JSON.parse(data.toString());
        expect(payload.argv).toEqual([
          "backlinks",
          "path=Wiki/pages/topics/Lambda.md",
          "counts",
          "format=json",
        ]);
        socket.write(JSON.stringify([
          { file: "Area/Math.md", count: "3" },
          { file: "Wiki/pages/topics/Calculus.md", count: "1" },
          { file: "Project/foo.md", count: "2" },
        ]) + "\n");
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

  test("backlinks treats Obsidian no-backlinks response as empty", async () => {
    await startMockServer((socket) => {
      socket.on("data", (data) => {
        const payload = JSON.parse(data.toString());
        expect(payload.argv).toEqual([
          "backlinks",
          "path=Wiki/pages/topics/Unlinked.md",
          "counts",
          "format=json",
        ]);
        socket.write("No backlinks found.\n");
        socket.end();
      });
    });

    const client = new ObsidianClient({ socketPath, vaultCwd: "/v", timeout: 500 });
    await expect(client.backlinks("Wiki/pages/topics/Unlinked.md")).resolves.toEqual([]);
  });

  test("searchContext uses query= syntax and parses Obsidian JSON array response", async () => {
    await startMockServer((socket) => {
      socket.on("data", (data) => {
        const payload = JSON.parse(data.toString());
        expect(payload.argv).toEqual(["search:context", "query=foo", "path=Wiki", "limit=3", "format=json"]);
        socket.write(JSON.stringify([
          { file: "Wiki/pages/topics/Foo.md", matches: [{ line: 5, text: "the foo bar" }] },
          { file: "Wiki/pages/topics/Foo.md", matches: [{ line: 12, text: "foo again" }] },
          { file: "Wiki/pages/summaries/bar.md", matches: [{ line: 1, text: "# Bar foo" }] },
        ]) + "\n");
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

  test("readFile uses exact path syntax and returns raw file content", async () => {
    await startMockServer((socket) => {
      socket.on("data", (data) => {
        const payload = JSON.parse(data.toString());
        expect(payload.argv).toEqual(["read", "path=Wiki/pages/topics/Foo.md"]);
        socket.write("# Foo\n\nBody\n");
        socket.end();
      });
    });

    const client = new ObsidianClient({ socketPath, vaultCwd: "/v", timeout: 500 });
    await expect(client.readFile("Wiki/pages/topics/Foo.md")).resolves.toBe("# Foo\n\nBody");
  });

  test("properties and propertyRead use exact path syntax and parse raw CLI outputs", async () => {
    let calls = 0;
    await startMockServer((socket) => {
      socket.on("data", (data) => {
        calls++;
        const payload = JSON.parse(data.toString());
        if (calls === 1) {
          expect(payload.argv).toEqual(["properties", "format=json", "path=Wiki/pages/topics/Foo.md"]);
          socket.write(JSON.stringify({ title: "Foo", status: "active" }) + "\n");
        } else {
          expect(payload.argv).toEqual(["property:read", "name=title", "path=Wiki/pages/topics/Foo.md"]);
          socket.write("Foo\n");
        }
        socket.end();
      });
    });

    const client = new ObsidianClient({ socketPath, vaultCwd: "/v", timeout: 500 });
    await expect(client.properties("Wiki/pages/topics/Foo.md", { format: "json" })).resolves.toEqual({ title: "Foo", status: "active" });
    await expect(client.propertyRead("Wiki/pages/topics/Foo.md", "title")).resolves.toBe("Foo");
  });

  test("files, folders, orphans, and deadends parse newline-list outputs", async () => {
    let calls = 0;
    await startMockServer((socket) => {
      socket.on("data", (data) => {
        calls++;
        const payload = JSON.parse(data.toString());
        if (calls === 1) {
          expect(payload.argv).toEqual(["files", "folder=Wiki", "ext=md"]);
          socket.write("Wiki/a.md\nWiki/b.md\n");
        } else if (calls === 2) {
          expect(payload.argv).toEqual(["folders", "folder=Wiki"]);
          socket.write("Wiki\nWiki/pages\n");
        } else if (calls === 3) {
          expect(payload.argv).toEqual(["orphans"]);
          socket.write("Wiki/a.md\nWiki/b.md\n");
        } else {
          expect(payload.argv).toEqual(["deadends"]);
          socket.write("Wiki/c.md\n");
        }
        socket.end();
      });
    });

    const client = new ObsidianClient({ socketPath, vaultCwd: "/v", timeout: 500 });
    await expect(client.files({ folder: "Wiki", ext: "md" })).resolves.toEqual(["Wiki/a.md", "Wiki/b.md"]);
    await expect(client.folders({ folder: "Wiki" })).resolves.toEqual(["Wiki", "Wiki/pages"]);
    await expect(client.orphans()).resolves.toEqual(["Wiki/a.md", "Wiki/b.md"]);
    await expect(client.deadends()).resolves.toEqual(["Wiki/c.md"]);
  });

  test("listDir combines direct child files and folders from Obsidian listings", async () => {
    let calls = 0;
    await startMockServer((socket) => {
      socket.on("data", (data) => {
        calls++;
        const payload = JSON.parse(data.toString());
        if (calls === 1) {
          expect(payload.argv).toEqual(["folders", "folder=Project"]);
          socket.write("Project\nProject/A\nProject/A/Nested\nProject/B\n");
        } else {
          expect(payload.argv).toEqual(["files", "folder=Project"]);
          socket.write("Project/root.md\nProject/A/a.md\n");
        }
        socket.end();
      });
    });

    const client = new ObsidianClient({ socketPath, vaultCwd: "/v", timeout: 500 });
    await expect(client.listDir("Project")).resolves.toEqual([
      { name: "A", isDir: true, path: "Project/A" },
      { name: "B", isDir: true, path: "Project/B" },
      { name: "root.md", isDir: false, path: "Project/root.md" },
    ]);
  });

  test("mutating file methods use exact path syntax and accept raw success text", async () => {
    let calls = 0;
    await startMockServer((socket) => {
      socket.on("data", (data) => {
        calls++;
        const payload = JSON.parse(data.toString());
        const expected = [
          ["create", "content=# Foo\n", "overwrite", "path=Wiki/foo.md"],
          ["append", "content=tail", "path=Wiki/foo.md"],
          ["prepend", "content=head", "path=Wiki/foo.md"],
          ["move", "to=Wiki/bar.md", "path=Wiki/foo.md"],
          ["rename", "name=baz.md", "path=Wiki/bar.md"],
          ["delete", "permanent", "path=Wiki/baz.md"],
        ];
        expect(payload.argv).toEqual(expected[calls - 1]);
        socket.write("OK\n");
        socket.end();
      });
    });

    const client = new ObsidianClient({ socketPath, vaultCwd: "/v", timeout: 500 });
    await client.create("Wiki/foo.md", "# Foo\n", { overwrite: true });
    await client.append("Wiki/foo.md", "tail");
    await client.prepend("Wiki/foo.md", "head");
    await client.move("Wiki/foo.md", "Wiki/bar.md");
    await client.rename("Wiki/bar.md", "baz.md");
    await client.delete("Wiki/baz.md", true);
    expect(calls).toBe(6);
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
